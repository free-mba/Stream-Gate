//! DNS commands
//!
//! IPC handlers for DNS checking and scanning.

use log::info;
use serde::Deserialize;
use tauri::State;
use crate::state::AppState;

/// DNS check payload
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsCheckPayload {
    pub server: String,
    #[serde(default)]
    pub domain: Option<String>,
}

/// Check a single DNS server
#[tauri::command]
pub async fn dns_check_single(
    state: State<'_, AppState>,
    payload: DnsCheckPayload,
) -> Result<crate::services::dns_service::DnsCheckResult, String> {
    let domain = payload.domain.unwrap_or_else(|| "google.com".to_string());
    info!("DNS check for server: {} with domain: {}", payload.server, domain);

    state.dns
        .check_single_server(&payload.server, &domain)
        .await
        .map_err(|e| e.to_string())
}

/// DNS scan payload
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsScanPayload {
    pub servers: Vec<String>,
    #[serde(default)]
    pub domain: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub timeout: Option<u64>,
}

/// Start DNS scan
#[tauri::command]
pub async fn dns_scan_start(
    state: State<'_, AppState>,
    payload: DnsScanPayload,
) -> Result<serde_json::Value, String> {
    let domain = payload.domain.unwrap_or_else(|| "google.com".to_string());
    let mode = payload.mode.unwrap_or_else(|| "slipstream".to_string());
    let timeout = payload.timeout.unwrap_or(3);

    info!("Starting DNS scan with {} servers and domain: {}, mode: {}, timeout: {}", payload.servers.len(), domain, mode, timeout);

    state.dns
        .start_scan(payload.servers, domain, mode, timeout)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "success": true
    }))
}

/// Stop DNS scan
#[tauri::command]
pub async fn dns_scan_stop(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    info!("Stopping DNS scan");

    state.dns.stop_scan();
    
    Ok(serde_json::json!({
        "success": true
    }))
}
