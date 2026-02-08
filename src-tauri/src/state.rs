//! Application state management
//!
//! This module manages the global application state using Tauri's state management.

use crate::error::AppError;
use log::{error, info};
use crate::services::{
    ConnectionService, DnsResolutionService, DnsService, LogService, ProcessManager, ProxyService,
    SettingsService, SystemProxyService,
};
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter};

/// Global application state
pub struct AppState {
    /// App handle for Tauri operations
    app_handle: RwLock<Option<AppHandle>>,
    /// Settings service
    pub settings: Arc<SettingsService>,
    /// Connection service
    pub connection: Arc<ConnectionService>,
    /// Log service
    pub logs: Arc<LogService>,
    /// Process manager
    pub process: Arc<ProcessManager>,
    /// System proxy service
    pub system_proxy: Arc<SystemProxyService>,
    /// Proxy service
    pub proxy: Arc<ProxyService>,
    /// DNS service
    pub dns: Arc<DnsService>,
    /// DNS resolution service
    pub dns_resolution: Arc<DnsResolutionService>,
}

impl AppState {
    /// Create a new application state
    pub fn new() -> Self {
        let settings = Arc::new(SettingsService::new());
        Self {
            app_handle: RwLock::new(None),
            settings: settings.clone(),
            connection: Arc::new(ConnectionService::new()),
            logs: Arc::new(LogService::new()),
            process: Arc::new(ProcessManager::new()),
            system_proxy: Arc::new(SystemProxyService::new(settings.clone())),
            proxy: Arc::new(ProxyService::new(settings)),
            dns: Arc::new(DnsService::new()),
            dns_resolution: Arc::new(DnsResolutionService::new()),
        }
    }

    /// Initialize the state with the Tauri app handle
    pub fn initialize(&self, app_handle: AppHandle) -> Result<(), AppError> {
        // Store app handle
        {
            let mut handle = self
                .app_handle
                .write()
                .map_err(|_| "Failed to acquire write lock")?;
            *handle = Some(app_handle.clone());
        }

        // Initialize settings after app is ready
        self.settings.initialize(&app_handle)?;
        
        // Sync verbose logging setting
        if let Ok(settings) = self.settings.get_all() {
            self.logs.set_verbose(settings.verbose);
        }
        
        // Pass app handle to services that need it
        self.process.set_app_handle(app_handle.clone());
        self.dns.set_app_handle(app_handle.clone());

        // Initialize logs with log file path
        use tauri::Manager;
        match app_handle.path().app_log_dir() {
            Ok(log_dir) => {
                let log_file_path: std::path::PathBuf = log_dir.join("Stream Gate.log");
                info!("Detected log directory: {:?}, using file: {:?}", log_dir, log_file_path);
                self.logs.set_log_file(log_file_path);
            }
            Err(e) => {
                error!("Failed to get app log directory: {}", e);
            }
        }

        // Clear critical ports on startup
        self.process.kill_ports(&[5201, 8080, 10809]);

        // Startup recovery: if system proxy was enabled by app and it died, restore
        if self.settings.get_all().map(|s| s.system_proxy).unwrap_or(false) {
            info!("System proxy was enabled by app previously (crash recovery). Restoring...");
            let service_clone = self.connection.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = service_clone.cleanup().await {
                   error!("Startup recovery failed: {}", e);
                }
            });
        }

        // Start traffic monitoring task
        let mut traffic_rx = self.proxy.traffic_tx.subscribe();
        let app_handle_for_traffic = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            while let Ok(update) = traffic_rx.recv().await {
                let _ = app_handle_for_traffic.emit("traffic-update", update);
            }
        });

        // Initialize connection service
        self.connection.initialize(
            &app_handle,
            self.settings.clone(),
            self.process.clone(),
            self.system_proxy.clone(),
            self.proxy.clone(),
            self.dns_resolution.clone(),
        )?;

        Ok(())
    }


    pub async fn cleanup(&self) -> Result<(), AppError> {
        self.connection.cleanup().await?;
        // Also explicitly stop process manager just in case connection didn't
        self.process.stop();
        // Clear critical ports on exit
        self.process.kill_ports(&[5201, 8080, 10809]);
        Ok(())
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
