//! Utility commands
//!
//! IPC handlers for miscellaneous utilities.

use crate::state::AppState;
use log::info;
use serde::Serialize;
use tauri::State;

/// Proxy test result
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyTestResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_time: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Test the proxy connection
#[tauri::command]
pub async fn test_proxy() -> Result<ProxyTestResult, String> {
    info!("Testing proxy connection");

    let start = std::time::Instant::now();

    // Try to connect through the local proxy
    let client = reqwest::Client::builder()
        .proxy(reqwest::Proxy::http("http://127.0.0.1:8080").map_err(|e| e.to_string())?)
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    match client.get("http://httpbin.org/ip").send().await {
        Ok(response) => {
            let response_time = start.elapsed().as_millis() as u64;

            if !response.status().is_success() {
                return Ok(ProxyTestResult {
                    success: false,
                    ip: None,
                    response_time: Some(response_time),
                    error: Some(format!("Proxy returned HTTP {}", response.status())),
                });
            }

            match response.json::<serde_json::Value>().await {
                Ok(json) => {
                    let ip = json["origin"].as_str().map(String::from);
                    Ok(ProxyTestResult {
                        success: true,
                        ip,
                        response_time: Some(response_time),
                        error: None,
                    })
                }
                Err(e) => Ok(ProxyTestResult {
                    success: false,
                    ip: None,
                    response_time: Some(response_time),
                    error: Some(format!("Invalid response: {}", e)),
                }),
            }
        }
        Err(e) => Ok(ProxyTestResult {
            success: false,
            ip: None,
            response_time: None,
            error: Some(e.to_string()),
        }),
    }
}

/// Open external URL in default browser
#[tauri::command]
pub async fn open_external(url: String) -> Result<serde_json::Value, String> {
    info!("Opening external URL: {}", url);

    // Use the shell plugin to open URLs
    match open::that(&url) {
        Ok(_) => Ok(serde_json::json!({ "success": true })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "error": e.to_string()
        })),
    }
}

/// Get application logs
#[tauri::command]
pub fn get_logs(state: State<'_, AppState>) -> Vec<serde_json::Value> {
    state
        .logs
        .get_logs()
        .into_iter()
        .map(|entry| {
            serde_json::json!({
                "timestamp": entry.timestamp,
                "level": entry.level,
                "message": entry.message
            })
        })
        .collect()
}

#[tauri::command]
pub fn get_log_path(state: State<'_, AppState>) -> String {
    state.logs.get_log_path()
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    info!("Copying text to clipboard ({} chars)", text.len());
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())?;
    Ok(())
}
