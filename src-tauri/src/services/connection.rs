//! Connection service
//!
//! Orchestrates the VPN connection lifecycle including process management,
//! proxy configuration, and status tracking.

use crate::error::AppResult;
use crate::services::{
    DnsResolutionService, ProcessManager, ProxyService, SettingsService, SystemProxyService,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};

/// Connection status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Disconnecting,
    Error,
}

/// Connection state information
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionState {
    pub status: ConnectionStatus,
    pub message: Option<String>,
    pub resolvers: Vec<String>,
    pub domain: Option<String>,
    pub proxy_port: Option<u16>,
    pub socks_port: Option<u16>,
    pub system_proxy_enabled: bool,
}

impl Default for ConnectionState {
    fn default() -> Self {
        Self {
            status: ConnectionStatus::Disconnected,
            message: None,
            resolvers: vec![],
            domain: None,
            proxy_port: None,
            socks_port: None,
            system_proxy_enabled: false,
        }
    }
}

/// Event payload for status updates
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionEvent {
    pub is_running: bool,
    pub details: ConnectionState,
}

/// Connection service for managing VPN connections
pub struct ConnectionService {
    state: RwLock<ConnectionState>,
    app_handle: RwLock<Option<AppHandle>>,
    settings: RwLock<Option<Arc<SettingsService>>>,
    process_manager: RwLock<Option<Arc<ProcessManager>>>,
    system_proxy: RwLock<Option<Arc<SystemProxyService>>>,
    proxy_service: RwLock<Option<Arc<ProxyService>>>,
    dns_resolution: RwLock<Option<Arc<DnsResolutionService>>>,
    _is_quitting: RwLock<bool>,
}

impl ConnectionService {
    /// Create a new connection service
    pub fn new() -> Self {
        Self {
            state: RwLock::new(ConnectionState::default()),
            app_handle: RwLock::new(None),
            settings: RwLock::new(None),
            process_manager: RwLock::new(None),
            system_proxy: RwLock::new(None),
            proxy_service: RwLock::new(None),
            dns_resolution: RwLock::new(None),
            _is_quitting: RwLock::new(false),
        }
    }

    /// Initialize the connection service
    pub fn initialize(
        &self,
        app_handle: &AppHandle,
        settings: Arc<SettingsService>,
        process_manager: Arc<ProcessManager>,
        system_proxy: Arc<SystemProxyService>,
        proxy_service: Arc<ProxyService>,
        dns_resolution: Arc<DnsResolutionService>,
    ) -> AppResult<()> {
        // Store references
        {
            let mut handle = self.app_handle.write().map_err(|_| "Lock error")?;
            *handle = Some(app_handle.clone());
        }
        {
            let mut svc = self.settings.write().map_err(|_| "Lock error")?;
            *svc = Some(settings);
        }
        {
            let mut svc = self.process_manager.write().map_err(|_| "Lock error")?;
            *svc = Some(process_manager);
        }
        {
            let mut svc = self.system_proxy.write().map_err(|_| "Lock error")?;
            *svc = Some(system_proxy);
        }
        {
            let mut svc = self.proxy_service.write().map_err(|_| "Lock error")?;
            *svc = Some(proxy_service);
        }
        {
            let mut svc = self.dns_resolution.write().map_err(|_| "Lock error")?;
            *svc = Some(dns_resolution);
        }

        info!("Connection service initialized");
        Ok(())
    }

    /// Get current connection status
    pub fn get_status(&self) -> ConnectionState {
        self.state.read().map(|s| s.clone()).unwrap_or_default()
    }

    /// Check if connection is running
    pub fn is_running(&self) -> bool {
        self.state
            .read()
            .map(|s| {
                s.status == ConnectionStatus::Connected || s.status == ConnectionStatus::Connecting
            })
            .unwrap_or(false)
    }

    /// Start a connection
    pub async fn start(&self, config: ConnectionConfig) -> AppResult<ConnectionResult> {
        info!("Starting connection with config: {:?}", config);

        // Update state to connecting
        {
            let mut state = self.state.write().map_err(|_| "Lock error")?;
            state.status = ConnectionStatus::Connecting;
            state.resolvers = config.resolvers.clone();
            state.domain = Some(config.domain.clone());
            state.message = Some("Connecting...".to_string());
        }

        self.emit_status_update();

        let process_manager = self
            .process_manager
            .read()
            .ok()
            .and_then(|g| g.clone())
            .ok_or("Process manager not initialized")?;
        let dns_resolution = self
            .dns_resolution
            .read()
            .ok()
            .and_then(|g| g.clone())
            .ok_or("DNS resolution not initialized")?;
        let proxy_service = self
            .proxy_service
            .read()
            .ok()
            .and_then(|g| g.clone())
            .ok_or("Proxy service not initialized")?;
        let system_proxy = self
            .system_proxy
            .read()
            .ok()
            .and_then(|g| g.clone())
            .ok_or("System proxy not initialized")?;

        // 1. Resolve domain if custom DNS is enabled
        let target_domain = if config.custom_dns_enabled && !config.resolvers.is_empty() {
            match dns_resolution
                .resolve(&config.domain, config.resolvers.clone())
                .await
            {
                Ok(ip) => ip,
                Err(e) => {
                    error!("DNS Resolution failed: {}", e);
                    return self.fail_connection(format!("DNS Resolve failed: {}", e)).await;
                }
            }
        } else {
            config.domain.clone()
        };

        // 2. Start native process
        let mut args = vec![];
        for r in &config.resolvers {
            args.push(if config.authoritative {
                "--authoritative".to_string()
            } else {
                "--resolver".to_string()
            });
            args.push(r.clone());
        }
        args.push("--domain".to_string());
        args.push(target_domain);

        if let Some(itv) = config.keep_alive_interval {
            args.push("--keep-alive-interval".to_string());
            args.push(itv.to_string());
        }
        if let Some(ref cc) = config.congestion_control {
            if cc != "auto" {
                args.push("--congestion-control".to_string());
                args.push(cc.clone());
            }
        }

        if let Err(e) = process_manager.start(args).await {
            error!("Process failed to start: {}", e);
            return self.fail_connection(format!("Process failed: {}", e)).await;
        }

        // 3. Start proxy servers
        if let Err(e) = proxy_service.start_http_proxy().await {
            error!("HTTP Proxy failed to start: {}", e);
            let _ = process_manager.stop();
            return self.fail_connection(format!("HTTP Proxy failed: {}", e)).await;
        }
        
        if let Err(e) = proxy_service.start_socks_forward_proxy().await {
            error!("SOCKS Forward Proxy failed to start: {}", e);
            // Non-critical (?) or critical? Matching Electron pattern usually starts all.
            // If it fails, maybe we just log it for now as it is a bridge.
            // But to be safe and avoid partial state:
             let _ = process_manager.stop();
             proxy_service.stop_all();
             return self.fail_connection(format!("SOCKS Bridge failed: {}", e)).await;
        }

        // 4. Configure system proxy if requested
        if config.tun_mode {
            // In original UI this might be labeled differently, but system proxy is what we want
            let _ = system_proxy.configure().await;
        }

        // Update state to connected
        {
            let mut state = self.state.write().map_err(|_| "Lock error")?;
            state.status = ConnectionStatus::Connected;
            state.proxy_port = Some(8080);
            state.socks_port = Some(5201);
            state.message = Some("Connected".to_string());
            state.system_proxy_enabled = config.tun_mode;
        }

        self.emit_status_update();

        Ok(ConnectionResult {
            success: true,
            message: "Connection established".to_string(),
            details: self.get_status(),
        })
    }

    async fn fail_connection(&self, message: String) -> AppResult<ConnectionResult> {
        {
            let mut state = self.state.write().map_err(|_| "Lock error")?;
            state.status = ConnectionStatus::Error;
            state.message = Some(message.clone());
        }

        self.emit_status_update();

        Ok(ConnectionResult {
            success: false,
            message,
            details: self.get_status(),
        })
    }

    /// Stop the connection
    pub async fn stop(&self) -> AppResult<ConnectionResult> {
        info!("Stopping connection");

        // Update state to disconnecting
        {
            let mut state = self.state.write().map_err(|_| "Lock error")?;
            state.status = ConnectionStatus::Disconnecting;
            state.message = Some("Disconnecting...".to_string());
        }

        self.emit_status_update();

        // 1. Unconfigure system proxy
        let system_proxy = self.system_proxy.read().ok().and_then(|g| g.clone());
        if let Some(sp) = system_proxy {
            let _ = sp.unconfigure().await;
        }

        // 2. Stop proxy servers
        let proxy_service = self.proxy_service.read().ok().and_then(|g| g.clone());
        if let Some(ps) = proxy_service {
            ps.stop_all();
        }

        // 3. Stop native process
        let process_manager = self.process_manager.read().ok().and_then(|g| g.clone());
        if let Some(pm) = process_manager {
            pm.stop();
        }

        // Update state to disconnected
        {
            let mut state = self.state.write().map_err(|_| "Lock error")?;
            *state = ConnectionState::default();
        }

        self.emit_status_update();

        Ok(ConnectionResult {
            success: true,
            message: "Disconnected".to_string(),
            details: self.get_status(),
        })
    }

    /// Mark the app as quitting to prevent reconnection attempts
    #[allow(dead_code)]
    pub fn set_quitting(&self) {
        if let Ok(mut quitting) = self._is_quitting.write() {
            *quitting = true;
        }
    }

    /// Emit status update event
    fn emit_status_update(&self) {
        let app_handle = self.app_handle.read().ok().and_then(|guard| (*guard).clone());
        if let Some(h) = app_handle {
            let status = self.get_status();
            let is_running = self.is_running();
            let event = ConnectionEvent {
                is_running,
                details: status,
            };
            let _ = h.emit("status-update", event);
        }
    }

    /// Cleanup and disable system proxy if needed
    #[allow(dead_code)]
    pub async fn cleanup(&self) -> AppResult<()> {
        // Stop connection if running
        if self.is_running() {
            let _ = self.stop().await;
        }

        Ok(())
    }
}

impl Default for ConnectionService {
    fn default() -> Self {
        Self::new()
    }
}

/// Connection configuration
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub resolvers: Vec<String>,
    pub domain: String,
    #[serde(default)]
    pub authoritative: bool,
    #[serde(default)]
    pub tun_mode: bool,
    #[serde(default)]
    pub keep_alive_interval: Option<u32>,
    #[serde(default)]
    pub congestion_control: Option<String>,
    #[serde(default)]
    pub custom_dns_enabled: bool,
    #[serde(default)]
    pub _primary_dns: Option<String>,
    #[serde(default)]
    pub _secondary_dns: Option<String>,
}

/// Connection result
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionResult {
    pub success: bool,
    pub message: String,
    pub details: ConnectionState,
}
