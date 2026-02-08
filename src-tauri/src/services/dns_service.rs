//! DNS Service - Ported from DNSService.ts
//!
//! Handles DNS diagnostics, ping checks, and bulk scanning.

use crate::error::{AppError, AppResult};

use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::str::FromStr;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use rand::{Rng, thread_rng};
use data_encoding::BASE32_NOPAD;

use trust_dns_resolver::TokioAsyncResolver;
use trust_dns_resolver::proto::rr::RecordType;
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts, NameServerConfigGroup};
use tokio::sync::Semaphore;
use tokio::process::Command as AsyncCommand;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnsStats {
    pub avg_time: f64,
    pub max_time: f64,
    pub std_dev: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")] // Ensure camelCase for JS compatibility
pub struct DnsCheckResult {
    pub ok: bool,
    pub server: String,
    pub ip: String,
    pub port: u16,
    pub domain: String,
    pub ping_time_ms: u64,
    pub dns_time_ms: u64,
    pub answers: Vec<String>,
    pub status: String,
    pub error: Option<String>,
    // New fields for comprehensive scan
    pub is_compatible: bool,
    pub score: u32,
    pub max_score: u32,
    pub details: String,
    pub stats: Option<DnsStats>,
}

pub struct DnsService {
    app_handle: Arc<RwLock<Option<AppHandle>>>,
    is_scanning: Arc<RwLock<bool>>,
    scan_id: Arc<RwLock<u64>>,
}

impl DnsService {
    pub fn new() -> Self {
        Self {
            app_handle: Arc::new(RwLock::new(None)),
            is_scanning: Arc::new(RwLock::new(false)),
            scan_id: Arc::new(RwLock::new(0)),
        }
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        if let Ok(mut h) = self.app_handle.write() {
            *h = Some(handle);
        }
    }

    /// Parse DNS server string (e.g. "1.1.1.1:53")
    pub fn parse_server(server: &str) -> Option<(String, u16)> {
        let parts: Vec<&str> = server.split(':').collect();
        if parts.is_empty() {
            return None;
        }

        let ip = parts[0].to_string();
        let port = if parts.len() > 1 {
            parts[1].parse::<u16>().unwrap_or(53)
        } else {
            53
        };

        // Basic IP validation
        if IpAddr::from_str(&ip).is_ok() {
            Some((ip, port))
        } else {
            None
        }
    }

    fn generate_random_subdomain() -> String {
        const CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
        let mut rng = thread_rng();
        (0..8)
            .map(|_| {
                let idx = rng.gen_range(0..CHARS.len());
                CHARS[idx] as char
            })
            .collect()
    }

    fn generate_base32_payload(length: usize) -> String {
        let mut rng = thread_rng();
        let mut bytes = vec![0u8; length];
        rng.fill(&mut bytes[..]);
        let base32 = BASE32_NOPAD.encode(&bytes);
        
        // Add inline dots every 57 characters
        let mut result = String::new();
        for (i, chunk) in base32.as_bytes().chunks(57).enumerate() {
            if i > 0 {
                result.push('.');
            }
            result.push_str(std::str::from_utf8(chunk).unwrap());
        }
        result
    }

    /// Ping a host using platform-specific ping command (Async)
    pub async fn ping_host(ip: &str, timeout_ms: u64) -> AppResult<u64> {
        let start = Instant::now();
        
        let mut cmd = AsyncCommand::new("ping");
        if cfg!(target_os = "windows") {
            cmd.args(["-n", "1", "-w", &timeout_ms.to_string(), ip]);
        } else if cfg!(target_os = "macos") {
            cmd.args(["-c", "1", "-W", &timeout_ms.to_string(), ip]);
        } else {
            // Linux
            let seconds = (timeout_ms as f64 / 1000.0).ceil() as u64;
            cmd.args(["-c", "1", "-W", &seconds.to_string(), ip]);
        }

        let status = cmd.status().await.map_err(|e| AppError::new(format!("Ping failed: {}", e)))?;
        
        if status.success() {
            Ok(start.elapsed().as_millis() as u64)
        } else {
            Err(AppError::new("Ping failed (unreachable)"))
        }
    }

    /// Resolve a domain using a specific DNS server (Async)
    pub async fn resolve_with_server(
        &self,
        server_ip: &str,
        server_port: u16,
        domain: &str,
        timeout_ms: u64,
    ) -> AppResult<(u64, Vec<String>)> {
        let start = Instant::now();
        
        // Configure resolver to use specific server
        let ip = IpAddr::from_str(server_ip).map_err(|_| "Invalid IP")?;
        let config = ResolverConfig::from_parts(
            None,
            vec![], 
            NameServerConfigGroup::from_ips_clear(&[ip], server_port, true),
        );
        
        let mut opts = ResolverOpts::default();
        opts.timeout = Duration::from_millis(timeout_ms);
        opts.attempts = 1;

        let resolver = TokioAsyncResolver::tokio(config, opts);
        
        let response = resolver.lookup_ip(domain).await.map_err(|e| AppError::new(format!("DNS Resolve error: {}", e)))?;
        
        let answers: Vec<String> = response.iter().map(|ip| ip.to_string()).collect();
        let duration = start.elapsed().as_millis() as u64;
        
        Ok((duration, answers))
    }

    /// Helper to resolve a record and return true if successful or if we get a valid DNS response (NXDOMAIN etc)
    async fn resolve_record_simple(
        server_ip: &str,
        server_port: u16,
        domain: &str,
        record_type: RecordType,
        timeout_ms: u64,
    ) -> bool {
        let ip = match IpAddr::from_str(server_ip) {
            Ok(i) => i,
            Err(_) => return false,
        };
        
        let config = ResolverConfig::from_parts(
            None,
            vec![], 
            NameServerConfigGroup::from_ips_clear(&[ip], server_port, true),
        );
        
        let mut opts = ResolverOpts::default();
        opts.timeout = Duration::from_millis(timeout_ms);
        opts.attempts = 1;

        let resolver = TokioAsyncResolver::tokio(config, opts);
        
        match resolver.lookup(domain, record_type).await {
            Ok(_) => true,
            Err(e) => {
                use trust_dns_resolver::error::ResolveErrorKind;
                match e.kind() {
                    ResolveErrorKind::NoRecordsFound { .. } => true,
                    // If the server refused, it's technically "reachable" and adhering to protocol, 
                    // but for DNSTT we might need it to be recursive?
                    // JS logic accepts EREFUSED for Slipstream, and ENOTFOUND/NXDOMAIN for DNSTT.
                    // For DNSTT logic:
                    // if (err.code === 'ENOTFOUND' || err.code === 'NXDOMAIN') -> true
                    // trust-dns NoRecordsFound covers NXDOMAIN and NoData.
                    _ => false,
                }
            }
        }
    }
    
    /// Test DNSTT Compatibility
    async fn test_dnstt(
        server_ip: &str, 
        server_port: u16, 
        domain: &str, 
        timeout_ms: u64
    ) -> (bool, u32, String) {
        let mut details = Vec::new();
        let mut score = 0;
        
        // Test 1: NS record support
        let rand_sub = Self::generate_random_subdomain();
        let query_domain = format!("{}.{}", rand_sub, domain);
        if Self::resolve_record_simple(server_ip, server_port, &query_domain, RecordType::NS, timeout_ms).await {
            score += 1;
            details.push("NS✓");
        } else {
            details.push("NS✗");
        }

        // Test 2: TXT record support
        let rand_sub = Self::generate_random_subdomain();
        let query_domain = format!("{}.{}", rand_sub, domain);
        if Self::resolve_record_simple(server_ip, server_port, &query_domain, RecordType::TXT, timeout_ms).await {
            score += 1;
            details.push("TXT✓");
        } else {
            details.push("TXT✗");
        }

        // Test 3: Random Subdomain 1 (A record)
        let rand_sub1 = Self::generate_random_subdomain();
        let rand_sub2 = Self::generate_random_subdomain();
        let query_domain = format!("{}.{}.{}", rand_sub1, rand_sub2, domain);
        if Self::resolve_record_simple(server_ip, server_port, &query_domain, RecordType::A, timeout_ms).await {
             score += 1;
             details.push("RND1✓");
        } else {
             details.push("RND1✗");
        }

        // Test 4: Random Subdomain 2 (A record)
        let rand_sub1 = Self::generate_random_subdomain();
        let rand_sub2 = Self::generate_random_subdomain();
        let query_domain = format!("{}.{}.{}", rand_sub1, rand_sub2, domain);
        if Self::resolve_record_simple(server_ip, server_port, &query_domain, RecordType::A, timeout_ms).await {
             score += 1;
             details.push("RND2✓");
        } else {
             details.push("RND2✗");
        }

        let is_compatible = score == 4;
        (is_compatible, score, details.join(" "))
    }

    /// Test Slipstream Compatibility (15 queries with increasing payload)
    async fn test_slipstream(
        server_ip: &str,
        server_port: u16,
        domain: &str,
        timeout_ms: u64
    ) -> (bool, u32, String, Option<DnsStats>) {
        let mut successful = 0;
        let mut response_times = Vec::new();
        let total_queries = 15;
        
        let ip = match IpAddr::from_str(server_ip) {
            Ok(i) => i,
            Err(_) => return (false, 0, "Invalid IP".to_string(), None),
        };

        for i in 0..total_queries {
            let payload_size = 20 + (i * 5);
            let base32_sub = Self::generate_base32_payload(payload_size);
            let query_domain = format!("{}.{}", base32_sub, domain);

            let start = Instant::now();
            
            let config = ResolverConfig::from_parts(
                None,
                vec![], 
                NameServerConfigGroup::from_ips_clear(&[ip], server_port, true),
            );
            
            let mut opts = ResolverOpts::default();
            opts.timeout = Duration::from_millis(timeout_ms);
            opts.attempts = 1;

            let resolver = TokioAsyncResolver::tokio(config, opts);
            
            let result = resolver.lookup(query_domain, RecordType::TXT).await;
            let elapsed = start.elapsed().as_millis() as f64;
            
            match result {
                Ok(_) => {
                    successful += 1;
                    response_times.push(elapsed);
                },
                Err(e) => {
                    use trust_dns_resolver::error::ResolveErrorKind;
                    match e.kind() {
                        ResolveErrorKind::NoRecordsFound { .. } => {
                             successful += 1;
                             response_times.push(elapsed);
                        },
                        ResolveErrorKind::Timeout => {
                            // Fail
                        },
                        _ => {
                            // Check for network errors (Io) vs DNS errors (Proto, Msg, etc)
                            if let ResolveErrorKind::Io(_) = e.kind() {
                                // Fail
                            } else {
                                // Treat other DNS errors (Refused, ServFail) as "reachable"
                                successful += 1;
                                response_times.push(elapsed);
                            }
                        }
                    }
                }
            }
        }
        
        if response_times.is_empty() {
             return (false, 0, "FAIL(0/15)".to_string(), None);
        }

        let avg_time = response_times.iter().sum::<f64>() / response_times.len() as f64;
        let max_time = response_times.iter().cloned().fold(0./0., f64::max); 
        
        let mut std_dev = 0.0;
        if response_times.len() > 1 {
            let variance = response_times.iter().map(|t| (t - avg_time).powi(2)).sum::<f64>() / (response_times.len() as f64 - 1.0);
            std_dev = variance.sqrt();
        }

        let passes_all = successful >= 13 && avg_time < 1000.0 && max_time < 3000.0 && std_dev < 500.0;
        let score = if passes_all { 3 } else { 0 };
        
        let details = if passes_all {
             format!("OK({}/15) {:.0}ms σ{:.0}", successful, avg_time, std_dev)
        } else {
             format!("FAIL({}/15)", successful)
        };

        (passes_all, score, details, Some(DnsStats { avg_time, max_time: if max_time.is_nan() { 0.0 } else { max_time }, std_dev }))
    }

    /// Check a single DNS server
    pub async fn check_single_server(&self, server: &str, domain: &str) -> AppResult<DnsCheckResult> {
        let (ip, port) = Self::parse_server(server).ok_or("Invalid DNS server format")?;
        
        let ping_res = Self::ping_host(&ip, 2000).await;
        let mut ping_time = 0;
        let mut status = "Unreachable".to_string();
        
        if let Ok(time) = ping_res {
            ping_time = time;
            status = "Ping Only".to_string();
        }

        let mut dns_time = 0;
        let mut answers = vec![];
        let mut error = None;

        if ping_res.is_ok() {
            match self.resolve_with_server(&ip, port, domain, 2500).await {
                Ok((time, ans)) => {
                    dns_time = time;
                    answers = ans;
                    status = "OK".to_string();
                }
                Err(e) => {
                    error = Some(e.to_string());
                }
            }
        } else {
            error = Some("Ping failed".to_string());
        }

        Ok(DnsCheckResult {
            ok: status == "OK",
            server: format!("{}:{}", ip, port),
            ip,
            port,
            domain: domain.to_string(),
            ping_time_ms: ping_time,
            dns_time_ms: dns_time,
            answers,
            status,
            error,
            is_compatible: false, // Default for single check
            score: 0,
            max_score: 0,
            details: String::new(),
            stats: None,
        })
    }

    /// Start a high-performance DNS scan
    pub async fn start_scan(&self, servers: Vec<String>, domain: String, mode: String, timeout_sec: u64) -> AppResult<()> {
        if let Ok(mut scanning) = self.is_scanning.write() {
            if *scanning {
                return Err(AppError::new("Scan already in progress"));
            }
            *scanning = true;
        }

        let app_handle = self.app_handle.read().map_err(|_| "Lock error")?.clone();
        let is_scanning = self.is_scanning.clone();
        let scan_id_lock = self.scan_id.clone();
        
        // Increment scan ID for new scan
        let current_scan_id = {
             let mut id = self.scan_id.write().map_err(|_| "Lock error")?;
             *id += 1;
             *id
        };

        let dns_service = Arc::new(Self::new());
        
        tokio::spawn(async move {
            let total = servers.len();
            let completed = Arc::new(tokio::sync::Mutex::new(0));
            let semaphore = Arc::new(Semaphore::new(50)); // Concurrency limit

            let mut tasks = Vec::new();

            for server in servers {
                // Check if scan was cancelled or ID changed
                if let Ok(scanning) = is_scanning.read() {
                    if !*scanning { break; }
                }
                if let Ok(id) = scan_id_lock.read() {
                    if *id != current_scan_id { break; }
                }

                let app_handle = app_handle.clone();
                let _dns_service = dns_service.clone(); 
                let domain = domain.clone();
                let mode = mode.clone();
                let completed = completed.clone();
                let semaphore = semaphore.clone();
                let is_scanning = is_scanning.clone();
                let scan_id_lock = scan_id_lock.clone();

                let task = tokio::spawn(async move {
                    let _permit = semaphore.acquire().await;
                    
                    // Check again inside task in case it was stopped while waiting for permit
                    if let Ok(id) = scan_id_lock.read() {
                        if *id != current_scan_id { return; }
                    }
                    if let Ok(scanning) = is_scanning.read() {
                        if !*scanning { return; }
                    }

                    if let Some(ref h) = app_handle {
                        let _ = h.emit("dns-scan-item-start", &server);
                    }

                    let (ip_str, port) = match Self::parse_server(&server) {
                         Some((i, p)) => (i, p),
                         None => {
                             let invalid_res = DnsCheckResult {
                                 ok: false,
                                 server: server.clone(), ip: "".into(), port: 0, domain: domain.clone(),
                                 ping_time_ms: 0, dns_time_ms: 0, answers: vec![], 
                                 status: "Invalid Server".into(), error: Some("Invalid format".into()),
                                 is_compatible: false, score: 0, max_score: 0, details: "Invalid".into(), stats: None,
                             };
                             
                             let mut comp = completed.lock().await;
                             *comp += 1;
                             let current_completed = *comp;
                             drop(comp);

                             if let Some(ref h) = app_handle {
                                 // Check scan ID before emitting
                                 if let Ok(id) = scan_id_lock.read() {
                                     if *id == current_scan_id {
                                         let _ = h.emit("dns-scan-result", invalid_res);
                                         let _ = h.emit("dns-scan-progress", serde_json::json!({ "completed": current_completed, "total": total }));
                                     }
                                 }
                             }
                             return;
                         }
                    };

                    let result = if mode == "dnstt" {
                        let (compatible, score, details) = Self::test_dnstt(&ip_str, port, &domain, timeout_sec * 1000).await;
                        DnsCheckResult {
                            ok: compatible,
                            server: server.clone(),
                            ip: ip_str.clone(), port, domain: domain.clone(),
                            ping_time_ms: 0, dns_time_ms: 0, answers: vec![],
                            status: if compatible { "OK".to_string() } else { "Incompatible".to_string() },
                            error: None,
                            is_compatible: compatible, score, max_score: 4, details, stats: None
                        }
                    } else {
                        // Default to slipstream
                        let (compatible, score, details, stats) = Self::test_slipstream(&ip_str, port, &domain, timeout_sec * 1000).await;
                         DnsCheckResult {
                            ok: compatible,
                            server: server.clone(),
                            ip: ip_str.clone(), port, domain: domain.clone(),
                            ping_time_ms: 0, 
                            dns_time_ms: if let Some(s) = &stats { s.avg_time as u64 } else { 0 },
                            answers: vec![],
                            status: if compatible { "OK".to_string() } else { "Incompatible".to_string() },
                            error: None,
                            is_compatible: compatible, score, max_score: 3, details, stats
                        }
                    };
                    
                    let mut comp = completed.lock().await;
                    *comp += 1;
                    let current_completed = *comp;
                    drop(comp);
                    
                    if let Some(ref h) = app_handle {
                        // Check scan ID before emitting results
                        if let Ok(id) = scan_id_lock.read() {
                            if *id == current_scan_id {
                                let _ = h.emit("dns-scan-result", result);
                                let _ = h.emit("dns-scan-progress", serde_json::json!({
                                    "completed": current_completed,
                                    "total": total
                                }));
                            }
                        }
                    }
                });
                tasks.push(task);
            }

            // Wait for all tasks to complete or scan to be stopped
            for task in tasks {
                let _ = task.await;
            }

            if let Ok(mut scanning) = is_scanning.write() {
                *scanning = false;
            }
            
            if let Some(ref h) = app_handle {
                // Only emit complete if we are still the active scan
                 if let Ok(id) = scan_id_lock.read() {
                    if *id == current_scan_id {
                         let _ = h.emit("dns-scan-complete", ());
                    }
                }
            }
        });

        Ok(())
    }

    pub fn stop_scan(&self) {
        if let Ok(mut scanning) = self.is_scanning.write() {
            *scanning = false;
        }
        if let Ok(mut id) = self.scan_id.write() {
            *id += 1; // Invalidate current scan
        }
    }
}
