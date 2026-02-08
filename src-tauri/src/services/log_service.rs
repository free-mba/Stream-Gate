//! Log service
//!
//! Manages application logging with history retention.

use log::Level;
use serde::Serialize;
use std::sync::RwLock;
use std::path::PathBuf;
use std::fs::File;
use std::io::{BufRead, BufReader};

/// Maximum number of log entries to retain
const MAX_LOG_ENTRIES: usize = 1000;

/// Log entry structure
#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

/// Log service for managing application logs
pub struct LogService {
    logs: RwLock<Vec<LogEntry>>,
    verbose: RwLock<bool>,
    log_file: RwLock<Option<PathBuf>>,
}

impl LogService {
    /// Create a new log service
    pub fn new() -> Self {
        Self {
            logs: RwLock::new(Vec::with_capacity(MAX_LOG_ENTRIES)),
            verbose: RwLock::new(false),
            log_file: RwLock::new(None),
        }
    }

    /// Add a log entry
    #[allow(dead_code)]
    pub fn log(&self, level: Level, message: &str) {
        // Skip verbose logs if not enabled
        if level == Level::Debug || level == Level::Trace {
            if let Ok(verbose) = self.verbose.read() {
                if !*verbose {
                    return;
                }
            }
        }

        let entry = LogEntry {
            timestamp: chrono::Utc::now().to_rfc3339(),
            level: level.to_string().to_uppercase(),
            message: message.to_string(),
        };

        if let Ok(mut logs) = self.logs.write() {
            logs.push(entry);

            // Trim old entries if over limit
            if logs.len() > MAX_LOG_ENTRIES {
                let drain_count = logs.len() - MAX_LOG_ENTRIES;
                logs.drain(0..drain_count);
            }
        }
    }

    /// Add info log
    #[allow(dead_code)]
    pub fn info(&self, message: &str) {
        self.log(Level::Info, message);
    }

    /// Add error log
    #[allow(dead_code)]
    pub fn error(&self, message: &str) {
        self.log(Level::Error, message);
    }

    /// Add warning log
    #[allow(dead_code)]
    pub fn warn(&self, message: &str) {
        self.log(Level::Warn, message);
    }

    /// Add debug log (only if verbose enabled)
    #[allow(dead_code)]
    pub fn debug(&self, message: &str) {
        self.log(Level::Debug, message);
    }

    /// Get all logs
    pub fn get_logs(&self) -> Vec<LogEntry> {
        // First try to get logs from memory
        let in_memory_logs = self.logs.read().map(|l| l.clone()).unwrap_or_default();
        if !in_memory_logs.is_empty() {
            return in_memory_logs;
        }

        // If memory is empty, try to read from file
        self.get_logs_from_file()
    }

    /// Get current log file path (for debugging)
    pub fn get_log_path(&self) -> String {
        self.log_file.read()
            .map(|p| p.as_ref().map(|path| path.to_string_lossy().to_string()).unwrap_or_else(|| "None".to_string()))
            .unwrap_or_else(|_| "Locked".to_string())
    }

    /// Set the log file path
    pub fn set_log_file(&self, path: PathBuf) {
        if let Ok(mut log_file) = self.log_file.write() {
            *log_file = Some(path);
        }
    }

    /// Read logs from the log file and parse them
    pub fn get_logs_from_file(&self) -> Vec<LogEntry> {
        let path = match self.log_file.read() {
            Ok(p) => match &*p {
                Some(path) => path.clone(),
                None => {
                    log::warn!("No log file path configured");
                    return Vec::new();
                },
            },
            Err(_) => return Vec::new(),
        };

        log::info!("Reading logs from {:?}", path);
        if !path.exists() {
            log::warn!("Log file does not exist at {:?}", path);
            return Vec::new();
        }

        let file = match File::open(&path) {
            Ok(f) => f,
            Err(e) => {
                log::error!("Failed to open log file {:?}: {}", path, e);
                return Vec::new();
            },
        };

        let reader = BufReader::new(file);
        let mut logs = Vec::new();
        let mut count = 0;

        // Pattern: [2026-02-08][11:18:30][stream_gate_lib::services::proxy_service][ERROR] Message
        for line in reader.lines().flatten() {
            count += 1;
            if line.is_empty() {
                continue;
            }

            // Simple parsing logic
            if line.starts_with('[') {
                let parts: Vec<&str> = line.splitn(5, ']').collect();
                if parts.len() >= 5 {
                    let timestamp = parts[0].trim_start_matches('[').to_string();
                    let time = parts[1].trim_start_matches('[').to_string();
                    let level = parts[3].trim_start_matches('[').to_string();
                    let message = parts[4].trim().to_string();

                    logs.push(LogEntry {
                        timestamp: format!("{} {}", timestamp, time),
                        level,
                        message,
                    });
                }
            }
        }

        log::info!("Parsed {} log entries from {} total lines", logs.len(), count);

        // Keep only the last MAX_LOG_ENTRIES
        if logs.len() > MAX_LOG_ENTRIES {
            let start = logs.len() - MAX_LOG_ENTRIES;
            logs = logs[start..].to_vec();
        }

        logs
    }

    /// Clear all logs
    #[allow(dead_code)]
    pub fn clear(&self) {
        if let Ok(mut logs) = self.logs.write() {
            logs.clear();
        }
    }

    /// Set verbose mode
    pub fn set_verbose(&self, enabled: bool) {
        if let Ok(mut verbose) = self.verbose.write() {
            *verbose = enabled;
        }
    }

    /// Check if verbose mode is enabled
    #[allow(dead_code)]
    pub fn is_verbose(&self) -> bool {
        self.verbose.read().map(|v| *v).unwrap_or(false)
    }
}

impl Default for LogService {
    fn default() -> Self {
        Self::new()
    }
}
