//! Settings commands
//!
//! IPC handlers for settings management.

use crate::services::settings::Settings;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Generic result response
#[derive(Debug, Serialize)]
pub struct ResultResponse<T> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(flatten)]
    pub data: Option<T>,
}

impl<T> ResultResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            error: None,
            data: Some(data),
        }
    }

    pub fn error(msg: impl Into<String>) -> Self {
        Self {
            success: false,
            error: Some(msg.into()),
            data: None,
        }
    }
}

/// Get all settings
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    state.settings.get_all().map_err(|e| e.to_string())
}

/// Save/update settings
#[tauri::command]
pub fn save_settings(
    state: State<'_, AppState>,
    settings: serde_json::Value,
) -> Result<ResultResponse<Settings>, String> {
    match state.settings.save(settings) {
        Ok(updated) => Ok(ResultResponse::success(updated)),
        Err(e) => Ok(ResultResponse::error(e.to_string())),
    }
}

/// Set authoritative DNS mode
#[tauri::command]
pub fn set_authoritative(
    state: State<'_, AppState>,
    enable: bool,
) -> Result<serde_json::Value, String> {
    let updates = serde_json::json!({ "authoritative": enable });
    state.settings.save(updates).map_err(|e| e.to_string())?;

    let current = state.settings.get_all().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "success": true,
        "enabled": current.authoritative
    }))
}

/// Resolver payload
#[derive(Debug, Deserialize)]
pub struct ResolversPayload {
    pub resolvers: Vec<String>,
}

/// Set DNS resolvers
#[tauri::command]
pub fn set_resolvers(
    state: State<'_, AppState>,
    payload: ResolversPayload,
) -> Result<serde_json::Value, String> {
    if payload.resolvers.is_empty() {
        return Ok(serde_json::json!({
            "success": false,
            "error": "No resolvers provided"
        }));
    }

    // Validate all resolvers
    use crate::services::SettingsService;
    for resolver in &payload.resolvers {
        if !SettingsService::validate_resolver(resolver) {
            return Ok(serde_json::json!({
                "success": false,
                "error": "One or more invalid DNS resolvers. Use IPv4:port (e.g. 1.1.1.1:53)."
            }));
        }
    }

    let updates = serde_json::json!({ "resolvers": payload.resolvers });
    state.settings.save(updates).map_err(|e| e.to_string())?;

    let current = state.settings.get_all().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "success": true,
        "resolvers": current.resolvers
    }))
}

/// Set verbose logging
#[tauri::command]
pub fn set_verbose(state: State<'_, AppState>, verbose: bool) -> Result<serde_json::Value, String> {
    state.logs.set_verbose(verbose);

    let updates = serde_json::json!({ "verbose": verbose });
    state.settings.save(updates).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "success": true,
        "verbose": verbose
    }))
}

/// SOCKS5 auth payload
#[derive(Debug, Deserialize)]
pub struct Socks5AuthPayload {
    pub enabled: bool,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
}

/// Set SOCKS5 authentication
#[tauri::command]
pub fn set_socks5_auth(
    state: State<'_, AppState>,
    auth: Socks5AuthPayload,
) -> Result<serde_json::Value, String> {
    let current = state.settings.get_all().map_err(|e| e.to_string())?;

    let username = auth.username.unwrap_or(current.socks5_auth_username.clone());
    let password = auth.password.unwrap_or(current.socks5_auth_password.clone());

    let updates = serde_json::json!({
        "socks5AuthEnabled": auth.enabled,
        "socks5AuthUsername": username,
        "socks5AuthPassword": password
    });

    state.settings.save(updates).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "success": true,
        "socks5AuthEnabled": auth.enabled,
        "socks5AuthUsername": username,
        "socks5AuthPassword": password
    }))
}

/// Import configurations
#[tauri::command]
pub fn import_configs(
    state: State<'_, AppState>,
    import_data: String,
) -> Result<serde_json::Value, String> {
    match state.settings.import_configs(&import_data) {
        Ok(result) => Ok(serde_json::json!({
            "success": true,
            "importedCount": result.imported_count
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "error": e.to_string()
        })),
    }
}

/// Export configurations
#[tauri::command]
pub fn export_configs(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    match state.settings.export_configs() {
        Ok(data) => Ok(serde_json::json!({
            "success": true,
            "data": data
        })),
        Err(e) => Ok(serde_json::json!({
            "success": false,
            "error": e.to_string()
        })),
    }
}
