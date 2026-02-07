//! Log service
//!
//! Manages application logging with history retention.

use log::Level;
use serde::Serialize;
use std::sync::RwLock;

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
}

impl LogService {
    /// Create a new log service
    pub fn new() -> Self {
        Self {
            logs: RwLock::new(Vec::with_capacity(MAX_LOG_ENTRIES)),
            verbose: RwLock::new(false),
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
        self.logs.read().map(|l| l.clone()).unwrap_or_default()
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
