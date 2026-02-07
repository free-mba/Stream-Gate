//! DNS Resolution Service - Ported from DnsResolutionService.ts
//!
//! Resolves hostnames to IP addresses using specific DNS servers to bypass poisoning.

use crate::error::{AppError, AppResult};
use log::{error, info};
use std::net::IpAddr;
use std::str::FromStr;
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
use trust_dns_resolver::Resolver;

pub struct DnsResolutionService;

impl DnsResolutionService {
    pub fn new() -> Self {
        Self
    }

    /// Resolve a hostname to an IPv4 address using specific DNS servers
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
                        trust_negative_responses: true,
                        bind_addr: None,
                    });
                }
            }
            ResolverConfig::from_parts(None, vec![], trust_dns_resolver::config::NameServerConfigGroup::from(group))
        };

        let opts = ResolverOpts::default();
        let resolver = Resolver::new(config, opts)
            .map_err(|e| AppError::new(format!("Failed to create resolver: {}", e)))?;

        match resolver.lookup_ip(hostname) {
            Ok(lookup) => {
                // Return first IPv4 address if available, otherwise first any
                let ip = lookup.iter()
                    .find(|ip| ip.is_ipv4())
                    .or_else(|| lookup.iter().next())
                    .ok_or_else(|| AppError::new("No DNS records found"))?;
                
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
