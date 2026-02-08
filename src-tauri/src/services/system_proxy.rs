//! System Proxy Service - Ported from SystemProxyService.ts
//!
//! Handles platform-specific system proxy configuration.

use crate::error::{AppError, AppResult};
use crate::services::SettingsService;
use log::{info, warn};
use std::process::Command;
use std::sync::Arc;

const HTTP_PROXY_PORT: u16 = 8080;

#[derive(Debug, Clone)]
pub struct ProxyConfigResult {
    pub success: bool,
    pub service_name: Option<String>,
}

pub struct SystemProxyService {
    settings: Arc<SettingsService>,
}

impl SystemProxyService {
    pub fn new(settings: Arc<SettingsService>) -> Self {
        Self { settings }
    }

    pub async fn is_configured(&self) -> bool {
        self.settings
            .get_all()
            .map(|s| s.system_proxy)
            .unwrap_or(false)
    }

    pub async fn configure(&self) -> AppResult<ProxyConfigResult> {
        let result = if cfg!(target_os = "macos") {
            self.configure_macos().await?
        } else if cfg!(target_os = "windows") {
            self.configure_windows().await?
        } else if cfg!(target_os = "linux") {
            self.configure_linux().await?
        } else {
            warn!("System proxy not supported on this platform");
            ProxyConfigResult {
                success: false,
                service_name: None,
            }
        };

        if result.success {
            let _ = self.settings.save(serde_json::json!({
                "systemProxy": true,
                "systemProxyServiceName": result.service_name.clone().unwrap_or_default()
            }));
            info!("System proxy configured and enabled successfully");
        }

        Ok(result)
    }

    pub async fn unconfigure(&self) -> AppResult<ProxyConfigResult> {
        let settings = self.settings.get_all()?;
        
        if !settings.system_proxy {
            info!("System proxy was not configured by this app, skipping");
            return Ok(ProxyConfigResult {
                success: false,
                service_name: None,
            });
        }

        let result = if cfg!(target_os = "macos") {
            self.unconfigure_macos(Some(settings.system_proxy_service_name)).await?
        } else if cfg!(target_os = "windows") {
            self.unconfigure_windows().await?
        } else if cfg!(target_os = "linux") {
            self.unconfigure_linux().await?
        } else {
            ProxyConfigResult {
                success: false,
                service_name: None,
            }
        };

        if result.success {
            let _ = self.settings.save(serde_json::json!({
                "systemProxy": false,
                "systemProxyServiceName": ""
            }));
        }

        Ok(result)
    }

    // --- macOS Implementation ---

    async fn configure_macos(&self) -> AppResult<ProxyConfigResult> {
        let output = Command::new("networksetup")
            .arg("-listallnetworkservices")
            .output()
            .map_err(|e| AppError::new(format!("Failed to list network services: {}", e)))?;

        let services_str = String::from_utf8_lossy(&output.stdout);
        let services: Vec<&str> = services_str
            .lines()
            .filter(|l| !l.is_empty() && !l.contains('*'))
            .collect();

        let preferred = ["Wi-Fi", "Ethernet", "USB 10/100/1000 LAN", "Thunderbolt Bridge"];

        for p in preferred {
            if let Some(service) = services.iter().find(|s| s.contains(p)) {
                if self.sm_set_proxy(service).is_ok() {
                    return Ok(ProxyConfigResult {
                        success: true,
                        service_name: Some(service.to_string()),
                    });
                }
            }
        }

        if let Some(service) = services.first() {
            if self.sm_set_proxy(service).is_ok() {
                return Ok(ProxyConfigResult {
                    success: true,
                    service_name: Some(service.to_string()),
                });
            }
        }

        Ok(ProxyConfigResult {
            success: false,
            service_name: None,
        })
    }

    fn sm_set_proxy(&self, service: &str) -> AppResult<()> {
        let commands = [
            format!("networksetup -setwebproxy \"{}\" 127.0.0.1 {}", service, HTTP_PROXY_PORT),
            format!("networksetup -setsecurewebproxy \"{}\" 127.0.0.1 {}", service, HTTP_PROXY_PORT),
            format!("networksetup -setwebproxystate \"{}\" on", service),
            format!("networksetup -setsecurewebproxystate \"{}\" on", service),
        ];

        for cmd in commands {
            let status = Command::new("sh")
                .arg("-c")
                .arg(&cmd)
                .status()
                .map_err(|e| AppError::new(format!("Command failed: {}. Error: {}", cmd, e)))?;
            
            if !status.success() {
                return Err(AppError::new(format!("Command returned error: {}", cmd)));
            }
        }
        Ok(())
    }

    async fn unconfigure_macos(&self, service_name: Option<String>) -> AppResult<ProxyConfigResult> {
        // Just disable on all services for safety, but prioritize the one we know
        if let Some(name) = service_name {
            let _ = self.sm_disable_proxy(&name);
        }

        let output = Command::new("networksetup")
            .arg("-listallnetworkservices")
            .output()
            .map_err(|e| AppError::new(format!("Failed to list network services: {}", e)))?;

        let services_str = String::from_utf8_lossy(&output.stdout);
        for service in services_str.lines().filter(|l| !l.is_empty() && !l.contains('*')) {
            let _ = self.sm_disable_proxy(service);
        }

        Ok(ProxyConfigResult {
            success: true,
            service_name: None,
        })
    }

    fn sm_disable_proxy(&self, service: &str) -> AppResult<()> {
        let commands = [
            format!("networksetup -setwebproxystate \"{}\" off", service),
            format!("networksetup -setsecurewebproxystate \"{}\" off", service),
        ];

        for cmd in commands {
            let _ = Command::new("sh").arg("-c").arg(&cmd).status();
        }
        Ok(())
    }

    // --- Windows Implementation ---

    async fn configure_windows(&self) -> AppResult<ProxyConfigResult> {
        let cmd = format!("netsh winhttp set proxy proxy-server=\"127.0.0.1:{}\"", HTTP_PROXY_PORT);
        let status = Command::new("cmd")
            .arg("/c")
            .arg(&cmd)
            .status()
            .map_err(|e| AppError::new(format!("Failed to configure windows proxy: {}", e)))?;

        Ok(ProxyConfigResult {
            success: status.success(),
            service_name: Some("winhttp".to_string()),
        })
    }

    async fn unconfigure_windows(&self) -> AppResult<ProxyConfigResult> {
        let status = Command::new("cmd")
            .arg("/c")
            .arg("netsh winhttp reset proxy")
            .status()
            .map_err(|e| AppError::new(format!("Failed to reset windows proxy: {}", e)))?;

        Ok(ProxyConfigResult {
            success: status.success(),
            service_name: None,
        })
    }

    // --- Linux Implementation ---

    async fn configure_linux(&self) -> AppResult<ProxyConfigResult> {
        // Porting gsettings calls
        let commands = [
            "gsettings set org.gnome.system.proxy mode 'manual'",
            &format!("gsettings set org.gnome.system.proxy.http host '127.0.0.1'"),
            &format!("gsettings set org.gnome.system.proxy.http port {}", HTTP_PROXY_PORT),
            &format!("gsettings set org.gnome.system.proxy.https host '127.0.0.1'"),
            &format!("gsettings set org.gnome.system.proxy.https port {}", HTTP_PROXY_PORT),
        ];

        let mut success = true;
        for cmd in commands {
            let s = Command::new("sh").arg("-c").arg(cmd).status();
            if s.is_err() || !s.unwrap().success() {
                success = false;
                break;
            }
        }

        Ok(ProxyConfigResult {
            success,
            service_name: Some("gsettings".to_string()),
        })
    }

    async fn unconfigure_linux(&self) -> AppResult<ProxyConfigResult> {
        let status = Command::new("sh")
            .arg("-c")
            .arg("gsettings set org.gnome.system.proxy mode 'none'")
            .status();

        Ok(ProxyConfigResult {
            success: status.is_ok() && status.unwrap().success(),
            service_name: None,
        })
    }
}
