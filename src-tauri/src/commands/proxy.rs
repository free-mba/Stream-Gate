//! Proxy commands
//!
//! IPC handlers for system proxy management.

use serde::Serialize;
use tauri::State;
use crate::state::AppState;
use log::{info, error};

/// System proxy result
#[derive(Debug, Serialize)]
pub struct ProxyResult {
    pub success: bool,
    pub configured: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Toggle system proxy
#[tauri::command]
pub async fn toggle_system_proxy(
    state: State<'_, AppState>,
    enable: bool,
) -> Result<ProxyResult, String> {
    info!("Toggle system proxy: {}", enable);

    let res = if enable {
        state.system_proxy.configure().await
    } else {
        state.system_proxy.unconfigure().await
    };

    match res {
        Ok(_) => Ok(ProxyResult {
            success: true,
            configured: enable,
            error: None,
        }),
        Err(e) => {
            error!("Failed to toggle system proxy: {}", e);
            Ok(ProxyResult {
                success: false,
                configured: !enable,
                error: Some(e.to_string()),
            })
        }
    }
}

/// Check current system proxy status
#[tauri::command]
pub async fn check_system_proxy(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    info!("Checking system proxy status");

    let configured = state.system_proxy.is_configured().await;
    
    Ok(serde_json::json!({
        "configured": configured
    }))
}
