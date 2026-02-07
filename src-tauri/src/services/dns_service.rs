//! DNS Service - Ported from DNSService.ts
//!
//! Handles DNS diagnostics, ping checks, and bulk scanning.

use crate::error::{AppError, AppResult};

use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::process::Command;
use std::str::FromStr;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
use trust_dns_resolver::Resolver;

#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

pub struct DnsService {
    app_handle: Arc<RwLock<Option<AppHandle>>>,
    is_scanning: Arc<RwLock<bool>>,
}

impl DnsService {
    pub fn new() -> Self {
        Self {
            app_handle: Arc::new(RwLock::new(None)),
            is_scanning: Arc::new(RwLock::new(false)),
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

    /// Ping a host using platform-specific ping command
    pub async fn ping_host(ip: &str, timeout_ms: u64) -> AppResult<u64> {
        let start = Instant::now();
        
        let mut cmd = Command::new("ping");
        if cfg!(target_os = "windows") {
            cmd.args(["-n", "1", "-w", &timeout_ms.to_string(), ip]);
        } else if cfg!(target_os = "macos") {
            cmd.args(["-c", "1", "-W", &timeout_ms.to_string(), ip]);
        } else {
            // Linux
            let seconds = (timeout_ms as f64 / 1000.0).ceil() as u64;
            cmd.args(["-c", "1", "-W", &seconds.to_string(), ip]);
        }

        let status = cmd.status().map_err(|e| AppError::new(format!("Ping failed: {}", e)))?;
        
        if status.success() {
            Ok(start.elapsed().as_millis() as u64)
        } else {
            Err(AppError::new("Ping failed (unreachable)"))
        }
    }

    /// Resolve a domain using a specific DNS server
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
            trust_dns_resolver::config::NameServerConfigGroup::from_ips_clear(&[ip], server_port, true),
        );
        
        let mut opts = ResolverOpts::default();
        opts.timeout = Duration::from_millis(timeout_ms);
        opts.attempts = 1;

        let resolver = Resolver::new(config, opts).map_err(|e| AppError::new(format!("Resolver error: {}", e)))?;
        
        let response = resolver.lookup_ip(domain).map_err(|e| AppError::new(format!("DNS Resolve error: {}", e)))?;
        
        let answers: Vec<String> = response.iter().map(|ip| ip.to_string()).collect();
        let duration = start.elapsed().as_millis() as u64;
        
        Ok((duration, answers))
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
        })
    }

    /// Start a high-performance DNS scan
    pub async fn start_scan(&self, servers: Vec<String>, domain: String) -> AppResult<()> {
        if let Ok(mut scanning) = self.is_scanning.write() {
            if *scanning {
                return Err(AppError::new("Scan already in progress"));
            }
            *scanning = true;
        }

        let app_handle = self.app_handle.read().map_err(|_| "Lock error")?.clone();
        let is_scanning = self.is_scanning.clone();
        let dns_service = Arc::new(Self::new()); // Need a static-ish ref for workers
        
        tokio::spawn(async move {
            let total = servers.len();
            let mut completed = 0;

            for server in servers {
                // Check if scan was cancelled
                if let Ok(scanning) = is_scanning.read() {
                    if !*scanning { break; }
                }

                // Actually we should use a worker pool/semaphore here for concurrency
                // For simplicity first, we'll do them in small batches or sequentially
                // TODO: Add semaphore for concurrency limit (parity: 50)
                
                let result = dns_service.check_single_server(&server, &domain).await;
                
                completed += 1;
                
                if let Some(ref h) = app_handle {
                    if let Ok(res) = result {
                        let _ = h.emit("dns-scan-result", res);
                    }
                    let _ = h.emit("dns-scan-progress", serde_json::json!({
                        "completed": completed,
                        "total": total
                    }));
                }
            }

            if let Ok(mut scanning) = is_scanning.write() {
                *scanning = false;
            }
            
            if let Some(ref h) = app_handle {
                let _ = h.emit("dns-scan-complete", ());
            }
        });

        Ok(())
    }

    pub fn stop_scan(&self) {
        if let Ok(mut scanning) = self.is_scanning.write() {
            *scanning = false;
        }
    }
}
