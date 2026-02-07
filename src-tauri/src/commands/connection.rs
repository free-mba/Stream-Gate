//! Connection commands
//!
//! IPC handlers for connection management.

use crate::services::connection::{ConnectionConfig, ConnectionResult, ConnectionState};
use crate::state::AppState;
use serde::Serialize;
use tauri::State;

/// Status response
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub is_running: bool,
    pub details: ConnectionState,
}

/// Start the VPN service
#[tauri::command]
pub async fn start_service(
    state: State<'_, AppState>,
    payload: ConnectionConfig,
) -> Result<ConnectionResult, String> {
    state
        .connection
        .start(payload)
        .await
        .map_err(|e| e.to_string())
}

/// Stop the VPN service
#[tauri::command]
pub async fn stop_service(state: State<'_, AppState>) -> Result<ConnectionResult, String> {
    state.connection.stop().await.map_err(|e| e.to_string())
}

/// Get current connection status
#[tauri::command]
pub fn get_status(state: State<'_, AppState>) -> StatusResponse {
    StatusResponse {
        is_running: state.connection.is_running(),
        details: state.connection.get_status(),
    }
}
