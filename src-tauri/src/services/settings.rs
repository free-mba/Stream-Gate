//! Settings service
//!
//! Handles loading, saving, and managing application settings.
//! Maintains compatibility with the Electron settings format.

use crate::error::{AppError, AppResult};
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;
use tauri::AppHandle;
use tauri::Manager;
use uuid::Uuid;

fn deserialize_null_as_string<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let opt = Option::<String>::deserialize(deserializer)?;
    Ok(opt.unwrap_or_default())
}

/// Application settings structure
/// Matches the Electron settings format exactly
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// DNS resolvers list
    #[serde(default)]
    pub resolvers: Vec<String>,

    /// Default domain
    #[serde(default = "default_domain", deserialize_with = "deserialize_null_as_string")]
    pub domain: String,

    /// Connection mode: "proxy" or "tun"
    #[serde(default = "default_mode", deserialize_with = "deserialize_null_as_string")]
    pub mode: String,

    /// Authoritative DNS mode
    #[serde(default)]
    pub authoritative: bool,

    /// Verbose logging
    #[serde(default)]
    pub verbose: bool,

    /// SOCKS5 authentication enabled
    #[serde(default)]
    pub socks5_auth_enabled: bool,

    /// SOCKS5 auth username
    #[serde(default, deserialize_with = "deserialize_null_as_string")]
    pub socks5_auth_username: String,

    /// SOCKS5 auth password
    #[serde(default, deserialize_with = "deserialize_null_as_string")]
    pub socks5_auth_password: String,

    /// System proxy enabled by app (for crash recovery)
    #[serde(default)]
    pub system_proxy_enabled_by_app: bool,

    /// System proxy service name
    #[serde(default, deserialize_with = "deserialize_null_as_string")]
    pub system_proxy_service_name: String,

    /// Keep-alive interval in seconds
    #[serde(default = "default_keep_alive_interval")]
    pub keep_alive_interval: u32,

    /// Saved configurations
    #[serde(default)]
    pub configs: Vec<ConfigItem>,

    /// Selected configuration ID
    #[serde(default)]
    pub selected_config_id: Option<String>,

    /// Saved DNS servers
    #[serde(default = "default_saved_dns")]
    pub saved_dns: Vec<String>,

    /// Language setting
    #[serde(default = "default_language", deserialize_with = "deserialize_null_as_string")]
    pub language: String,

    /// Theme setting
    #[serde(default = "default_theme", deserialize_with = "deserialize_null_as_string")]
    pub theme: String,

    /// Custom DNS enabled
    #[serde(default)]
    pub custom_dns_enabled: bool,

    /// Primary DNS server
    #[serde(default = "default_primary_dns", deserialize_with = "deserialize_null_as_string")]
    pub primary_dns: String,

    /// Secondary DNS server
    #[serde(default = "default_secondary_dns", deserialize_with = "deserialize_null_as_string")]
    pub secondary_dns: String,
}

/// SOCKS authentication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SocksAuth {
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
}

/// Saved configuration entry
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigItem {
    pub id: String,
    pub remark: String,
    pub domain: String,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub socks: Option<SocksAuth>,
}

fn default_domain() -> String {
    String::new()
}

fn default_mode() -> String {
    "proxy".to_string()
}

fn default_keep_alive_interval() -> u32 {
    30
}

fn default_saved_dns() -> Vec<String> {
    vec!["8.8.8.8:53".to_string(), "1.1.1.1:53".to_string()]
}

fn default_language() -> String {
    "en".to_string()
}

fn default_theme() -> String {
    "system".to_string()
}

fn default_primary_dns() -> String {
    "8.8.8.8".to_string()
}

fn default_secondary_dns() -> String {
    "1.1.1.1".to_string()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            resolvers: vec![],
            domain: default_domain(),
            mode: default_mode(),
            authoritative: false,
            verbose: false,
            socks5_auth_enabled: false,
            socks5_auth_username: String::new(),
            socks5_auth_password: String::new(),
            system_proxy_enabled_by_app: false,
            system_proxy_service_name: String::new(),
            keep_alive_interval: default_keep_alive_interval(),
            configs: vec![],
            selected_config_id: None,
            saved_dns: default_saved_dns(),
            language: default_language(),
            theme: default_theme(),
            custom_dns_enabled: false,
            primary_dns: default_primary_dns(),
            secondary_dns: default_secondary_dns(),
        }
    }
}

/// Settings service for managing application settings
pub struct SettingsService {
    settings: RwLock<Settings>,
    settings_path: RwLock<Option<PathBuf>>,
}

impl SettingsService {
    /// Create a new settings service
    pub fn new() -> Self {
        Self {
            settings: RwLock::new(Settings::default()),
            settings_path: RwLock::new(None),
        }
    }

    /// Initialize the settings service with the app handle
    pub fn initialize(&self, app_handle: &AppHandle) -> AppResult<()> {
        // Get the app data directory
        let app_data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| AppError::new(format!("Failed to get app data dir: {}", e)))?;

        // Ensure the directory exists
        fs::create_dir_all(&app_data_dir)?;

        // Set the settings path
        let settings_path = app_data_dir.join("settings.json");
        {
            let mut path = self.settings_path.write().map_err(|_| "Lock error")?;
            *path = Some(settings_path.clone());
        }

        // Load settings
        self.load()?;

        info!("Settings initialized from {:?}", settings_path);
        Ok(())
    }

    /// Load settings from disk
    pub fn load(&self) -> AppResult<()> {
        let path = {
            let path_guard = self.settings_path.read().map_err(|_| "Lock error")?;
            path_guard.clone()
        };

        if let Some(path) = path {
            if path.exists() {
                match fs::read_to_string(&path) {
                    Ok(content) => {
                        match serde_json::from_str::<Settings>(&content) {
                            Ok(loaded) => {
                                let mut settings = self.settings.write().map_err(|_| "Lock error")?;
                                *settings = loaded;
                                info!("Settings loaded successfully");
                            }
                            Err(e) => {
                                error!("Failed to parse settings: {}", e);
                                // Keep defaults
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to read settings file: {}", e);
                    }
                }
            } else {
                // Create default settings file
                self.save_to_disk()?;
            }
        }

        Ok(())
    }

    /// Save settings to disk
    fn save_to_disk(&self) -> AppResult<()> {
        let path = {
            let path_guard = self.settings_path.read().map_err(|_| "Lock error")?;
            path_guard.clone()
        };

        if let Some(path) = path {
            let settings = self.settings.read().map_err(|_| "Lock error")?;
            let content = serde_json::to_string_pretty(&*settings)?;
            fs::write(&path, content)?;
            info!("Settings saved to {:?}", path);
        }

        Ok(())
    }

    /// Get all settings
    pub fn get_all(&self) -> AppResult<Settings> {
        let settings = self.settings.read().map_err(|_| "Lock error")?;
        Ok(settings.clone())
    }

    /// Update settings (partial update)
    pub fn save(&self, updates: serde_json::Value) -> AppResult<Settings> {
        {
            let mut settings = self.settings.write().map_err(|_| "Lock error")?;

            // Merge updates into current settings
            if let Some(obj) = updates.as_object() {
                for (key, value) in obj {
                    match key.as_str() {
                        "resolvers" => {
                            if let Some(arr) = value.as_array() {
                                settings.resolvers = arr
                                    .iter()
                                    .filter_map(|v| v.as_str().map(String::from))
                                    .collect();
                            }
                        }
                        "domain" => {
                            if let Some(s) = value.as_str() {
                                settings.domain = s.to_string();
                            }
                        }
                        "mode" => {
                            if let Some(s) = value.as_str() {
                                settings.mode = s.to_string();
                            }
                        }
                        "authoritative" => {
                            if let Some(b) = value.as_bool() {
                                settings.authoritative = b;
                            }
                        }
                        "verbose" => {
                            if let Some(b) = value.as_bool() {
                                settings.verbose = b;
                            }
                        }
                        "socks5AuthEnabled" => {
                            if let Some(b) = value.as_bool() {
                                settings.socks5_auth_enabled = b;
                            }
                        }
                        "socks5AuthUsername" => {
                            if let Some(s) = value.as_str() {
                                settings.socks5_auth_username = s.to_string();
                            }
                        }
                        "socks5AuthPassword" => {
                            if let Some(s) = value.as_str() {
                                settings.socks5_auth_password = s.to_string();
                            }
                        }
                        "systemProxyEnabledByApp" => {
                            if let Some(b) = value.as_bool() {
                                settings.system_proxy_enabled_by_app = b;
                            }
                        }
                        "systemProxyServiceName" => {
                            if let Some(s) = value.as_str() {
                                settings.system_proxy_service_name = s.to_string();
                            }
                        }
                        "keepAliveInterval" => {
                            if let Some(n) = value.as_u64() {
                                settings.keep_alive_interval = n as u32;
                            }
                        }
                        "configs" => {
                            if let Ok(configs) = serde_json::from_value(value.clone()) {
                                settings.configs = configs;
                            }
                        }
                        "selectedConfigId" => {
                            if let Some(s) = value.as_str() {
                                settings.selected_config_id = if s.is_empty() { None } else { Some(s.to_string()) };
                            } else if value.is_null() {
                                settings.selected_config_id = None;
                            }
                        }
                        "savedDns" => {
                            if let Some(arr) = value.as_array() {
                                settings.saved_dns = arr
                                    .iter()
                                    .filter_map(|v| v.as_str().map(String::from))
                                    .collect();
                            }
                        }
                        "language" => {
                            if let Some(s) = value.as_str() {
                                settings.language = s.to_string();
                            }
                        }
                        "theme" => {
                            if let Some(s) = value.as_str() {
                                settings.theme = s.to_string();
                            }
                        }
                        "customDnsEnabled" => {
                            if let Some(b) = value.as_bool() {
                                settings.custom_dns_enabled = b;
                            }
                        }
                        "primaryDns" => {
                            if let Some(s) = value.as_str() {
                                settings.primary_dns = s.to_string();
                            }
                        }
                        "secondaryDns" => {
                            if let Some(s) = value.as_str() {
                                settings.secondary_dns = s.to_string();
                            }
                        }
                        _ => {
                            // Unknown key, ignore
                        }
                    }
                }
            }
        }

        self.save_to_disk()?;
        self.get_all()
    }

    /// Validate a DNS resolver format (IPv4:port)
    pub fn validate_resolver(resolver: &str) -> bool {
        // Match format: x.x.x.x:port
        let parts: Vec<&str> = resolver.split(':').collect();
        if parts.len() != 2 {
            return false;
        }

        // Validate IP
        let ip_parts: Vec<&str> = parts[0].split('.').collect();
        if ip_parts.len() != 4 {
            return false;
        }

        for part in ip_parts {
            if part.parse::<u8>().is_err() {
                return false;
            }
        }

        // Validate port
        if let Ok(port) = parts[1].parse::<u16>() {
            port > 0
        } else {
            false
        }
    }

    /// Export configs as ssgate strings
    pub fn export_configs(&self) -> AppResult<String> {
        let settings = self.settings.read().map_err(|_| "Lock error")?;
        info!("Exporting {} configurations", settings.configs.len());
        
        let mut lines = Vec::new();
        for config in &settings.configs {
            let mut data_map = serde_json::Map::new();
            data_map.insert("remark".to_string(), serde_json::Value::String(config.remark.clone()));
            data_map.insert("domain".to_string(), serde_json::Value::String(config.domain.clone()));
            if let Some(country) = &config.country {
                 data_map.insert("country".to_string(), serde_json::Value::String(country.clone()));
            }
            if let Some(socks) = &config.socks {
                let mut socks_map = serde_json::Map::new();
                socks_map.insert("username".to_string(), serde_json::Value::String(socks.username.clone()));
                socks_map.insert("password".to_string(), serde_json::Value::String(socks.password.clone()));
                data_map.insert("socks".to_string(), serde_json::Value::Object(socks_map));
            }

            let json_str = serde_json::to_string(&data_map)?;
            use base64::{Engine as _, engine::general_purpose};
            let encoded = general_purpose::STANDARD.encode(json_str);
            lines.push(format!("ssgate:{}//{}", config.remark, encoded));
        }

        Ok(lines.join("\n"))
    }

    /// Import configs from ssgate strings
    pub fn import_configs(&self, data: &str) -> AppResult<ImportResult> {
        // Check if data is valid
        info!("Importing configurations from data: {} chars", data.len());
        if data.trim().is_empty() {
             error!("Import failed: empty data");
             return Err(AppError::new("Invalid import data"));
        }

        let lines: Vec<&str> = data.split('\n')
            .map(|l| l.trim())
            .filter(|l| l.starts_with("ssgate:"))
            .collect();
            
        let mut imported_configs: Vec<ConfigItem> = Vec::new();
        let mut error_count = 0;

        use base64::{Engine as _, engine::general_purpose};

        for line in lines {
            // Format: ssgate:Remark//base64
            // We need to split by // but first part is ssgate:Remark
            if let Some(idx) = line.find("//") {
                let prefix = &line[0..idx]; // ssgate:Remark
                let base64_str = &line[idx+2..];
                
                let remark_prefix = prefix.strip_prefix("ssgate:").unwrap_or("Imported");
                
                match general_purpose::STANDARD.decode(base64_str) {
                    Ok(decoded_bytes) => {
                         if let Ok(json_str) = String::from_utf8(decoded_bytes) {
                             if let Ok(val) = serde_json::from_str::<serde_json::Value>(&json_str) {
                                  // Extract fields
                                  let domain = val.get("domain").and_then(|v| v.as_str()).map(String::from);
                                  
                                  if let Some(domain) = domain {
                                      let remark = val.get("remark").and_then(|v| v.as_str()).unwrap_or(remark_prefix).to_string();
                                      let country = val.get("country").and_then(|v| v.as_str()).map(String::from);
                                      
                                      let socks = val.get("socks").and_then(|v| {
                                          let username = v.get("username").and_then(|u| u.as_str()).unwrap_or("").to_string();
                                          let password = v.get("password").and_then(|p| p.as_str()).unwrap_or("").to_string();
                                          Some(SocksAuth { username, password })
                                      });

                                      imported_configs.push(ConfigItem {
                                          id: Uuid::new_v4().to_string(),
                                          remark,
                                          domain,
                                          country,
                                          socks,
                                      });
                                  } else {
                                      error_count += 1;
                                  }
                             } else {
                                 error_count += 1;
                             }
                         } else {
                             error_count += 1;
                         }
                    },
                    Err(_) => {
                        error_count += 1;
                    }
                }
            } else {
                error!("Invalid line format: {}", line);
                error_count += 1;
            }
        }

        let imported_count = imported_configs.len();
        info!("Imported {} configs, {} errors", imported_count, error_count);

        if imported_count > 0 {
            let mut settings = self.settings.write().map_err(|_| "Lock error")?;
            // Append
            settings.configs.extend(imported_configs);
        }
        
        if error_count > 0 {
            error!("Import completed with {} errors", error_count);
        }

        self.save_to_disk()?;

        Ok(ImportResult {
            success: true,
            imported_count,
        })
    }
}

impl Default for SettingsService {
    fn default() -> Self {
        Self::new()
    }
}

/// Import result
#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub success: bool,
    pub imported_count: usize,
}
