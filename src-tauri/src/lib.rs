//! Stream Gate - Tauri Backend
//!
//! This module provides the Tauri backend implementation for Stream Gate,
//! a VPN client with HTTP proxy functionality.
//!
//! # Architecture
//!
//! The backend follows a service-oriented architecture:
//! - `commands/` - IPC command handlers (presentation layer)
//! - `services/` - Business logic services
//! - `state.rs` - Application state management
//! - `error.rs` - Error types and handling

mod commands;
mod error;
mod services;
mod state;

use log::info;
use state::AppState;
use tauri::Manager;

/// Initialize and run the Tauri application
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .manage(AppState::new())
        .setup(|app| {
            info!("Stream Gate Tauri backend starting...");

            // Initialize services with app handle
            let app_handle = app.handle().clone();
            let state = app.state::<AppState>();
            state.initialize(app_handle)?;

            info!("Stream Gate initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Connection management
            commands::connection::start_service,
            commands::connection::stop_service,
            commands::connection::get_status,
            // Settings management
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::set_authoritative,
            commands::settings::set_resolvers,
            commands::settings::set_verbose,
            commands::settings::set_socks5_auth,
            commands::settings::import_configs,
            commands::settings::export_configs,
            // System proxy
            commands::proxy::toggle_system_proxy,
            commands::proxy::check_system_proxy,
            // DNS
            commands::dns::dns_check_single,
            commands::dns::dns_scan_start,
            commands::dns::dns_scan_stop,
            // App info
            commands::app::get_version,
            commands::app::check_update,
            // Utilities
            commands::utility::test_proxy,
            commands::utility::open_external,
            commands::utility::get_logs,
            commands::utility::get_log_path,
            commands::utility::copy_to_clipboard,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Stream Gate")
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { .. } => {
                info!("Exit requested, stopping services...");
                let state = app_handle.state::<AppState>();
                // We need a blocking way to stop, or spawn a thread.
                // Since we can't await here easily without a runtime, 
                // and `cleanup` is async, we might need a blocking wrapper or 
                // ensure the process manager kill command is synchronous-ish.
                // The `ProcessManager::stop` is synchronous (fire and forget kill).
                // `ConnectionService::cleanup` is async.
                
                // For now, let's at least try to trigger the stop via the state if possible,
                // or simpler: just find the process manager and kill it.
                // But `AppState` wraps everything.
                
                // Let's spawn a thread to do the cleanup blocking?
                // Or just use tauri's async runtime?
                tauri::async_runtime::block_on(async {
                    if let Err(e) = state.cleanup().await {
                        log::error!("Failed to cleanup on exit: {}", e);
                    }
                });
            }
            _ => {}
        });
}
