//! DNS Resolution Service - Ported from DnsResolutionService.ts
//!
//! Resolves hostnames to IP addresses using specific DNS servers to bypass poisoning.

use crate::error::{AppError, AppResult};
use log::{error, info};
use std::net::IpAddr;
use std::str::FromStr;
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts, LookupIpStrategy};
use trust_dns_resolver::TokioAsyncResolver;

pub struct DnsResolutionService;

impl DnsResolutionService {
    pub fn new() -> Self {
        Self
    }

    /// Resolve a hostname to an IPv4 address using specific DNS servers
    #[allow(dead_code)]
    pub async fn resolve(&self, hostname: &str, servers: Vec<String>) -> AppResult<String> {
        // If it's already an IP, return it
        if IpAddr::from_str(hostname).is_ok() {
            return Ok(hostname.to_string());
        }

        info!("Resolving {} using servers: {:?}", hostname, servers);

        let config = if servers.is_empty() {
            ResolverConfig::default()
        } else {
            let mut group = vec![];
            for s in servers {
                let parts: Vec<&str> = s.split(':').collect();
                if let Ok(ip) = IpAddr::from_str(parts[0]) {
                    let port = if parts.len() > 1 {
                        parts[1].parse::<u16>().unwrap_or(53)
                    } else {
                        53
                    };
                    group.push(trust_dns_resolver::config::NameServerConfig {
                        socket_addr: std::net::SocketAddr::new(ip, port),
                        protocol: trust_dns_resolver::config::Protocol::Udp,
                        tls_dns_name: None,
                        trust_negative_responses: false,
                        bind_addr: None,
                    });
                    group.push(trust_dns_resolver::config::NameServerConfig {
                        socket_addr: std::net::SocketAddr::new(ip, port),
                        protocol: trust_dns_resolver::config::Protocol::Tcp,
                        tls_dns_name: None,
                        trust_negative_responses: false,
                        bind_addr: None,
                    });
                }
            }
            ResolverConfig::from_parts(None, vec![], trust_dns_resolver::config::NameServerConfigGroup::from(group))
        };

        let mut opts = ResolverOpts::default();
        opts.ip_strategy = LookupIpStrategy::Ipv4Only;
        let resolver = TokioAsyncResolver::tokio(config, opts);

        match resolver.lookup_ip(hostname).await {
            Ok(lookup) => {
                // Return first IPv4 address (matching TS resolve4)
                let ip = lookup.iter()
                    .find(|ip| ip.is_ipv4())
                    .ok_or_else(|| AppError::new("No IPv4 records found"))?;
                
                let ip_str = ip.to_string();
                info!("Resolved {} -> {}", hostname, ip_str);
                Ok(ip_str)
            }
            Err(e) => {
                error!("Resolution failed for {}: {}", hostname, e);
                Err(AppError::new(format!("Resolution failed: {}", e)))
            }
        }
    }
}
