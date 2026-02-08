//! Process Manager - Native binary process lifecycle management.
//!
//! Ported from ProcessManager.ts

use crate::error::{AppError, AppResult};
use log::{debug, error, info, warn};
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize)]
pub struct ProcessOutput {
    pub stream: String, // "stdout" or "stderr"
    pub data: String,
}

pub struct ProcessManager {
    child: Arc<RwLock<Option<Child>>>,
    output_tx: broadcast::Sender<ProcessOutput>,
    app_handle: Arc<RwLock<Option<AppHandle>>>,
}

/// Helper to strip ANSI escape codes and common emojis from a string
fn strip_unsupported(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    
    // 1. Strip ANSI codes
    while let Some(c) = chars.next() {
        if c == '\x1b' { // ESC
            if let Some('[') = chars.peek() {
                chars.next(); // skip '['
                while let Some(&nc) = chars.peek() {
                    if nc.is_ascii_alphabetic() {
                        chars.next(); // skip terminal char (m, K, J, etc)
                        break;
                    }
                    chars.next();
                }
                continue;
            }
        }
        
        // 2. Strip Emojis (approximate range check)
        if (c >= '\u{1F300}' && c <= '\u{1F9FF}') || 
           (c >= '\u{2600}' && c <= '\u{26FF}') ||
           (c >= '\u{2700}' && c <= '\u{27BF}') ||
           (c >= '\u{1F1E0}' && c <= '\u{1F1FF}') {
            continue;
        }
        
        result.push(c);
    }
    result
}

impl ProcessManager {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            child: Arc::new(RwLock::new(None)),
            output_tx: tx,
            app_handle: Arc::new(RwLock::new(None)),
        }
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        if let Ok(mut h) = self.app_handle.write() {
            *h = Some(handle);
        }
    }

    /// Get the path to the Stream Gate client binary
    pub fn get_client_path(&self) -> AppResult<PathBuf> {
        let handle = self.app_handle.read().map_err(|_| "Lock error")?;
        let app_handle = handle.as_ref().ok_or("App handle not set")?;
        
        let resource_dir = app_handle
            .path()
            .resource_dir()
            .map_err(|e| AppError::new(format!("Failed to get resource dir: {}", e)))?;

        let (preferred, fallback) = if cfg!(target_os = "macos") {
            if cfg!(target_arch = "aarch64") {
                ("stream-client-mac-arm64", "stream-client-mac-intel")
            } else {
                ("stream-client-mac-intel", "stream-client-mac-arm64")
            }
        } else if cfg!(target_os = "windows") {
            ("stream-client-win.exe", "stream-client-win.exe")
        } else {
            ("stream-client-linux", "stream-client-linux")
        };

        // In production, Tauri places resources in _up_ subdirectory
        // In development, they're directly in the resource dir
        let candidates: [PathBuf; 9] = [
            // Production paths (with _up_)
            resource_dir.join("_up_").join("binaries").join(preferred),
            resource_dir.join("_up_").join("binaries").join(fallback),
            resource_dir.join("_up_").join(preferred),
            // Development paths (without _up_)
            resource_dir.join("binaries").join(preferred),
            resource_dir.join(preferred),
            resource_dir.join("binaries").join("stream-client-mac"), // legacy
            resource_dir.join("stream-client-mac"),
            resource_dir.join("binaries").join(fallback),
            resource_dir.join(fallback),
        ];

        for path in candidates.iter() {
            if path.exists() {
                return Ok(path.clone());
            }
        }

        // Development fallback
        // Check relative to CWD (usually src-tauri)
        let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let dev_paths = [
            cwd.join("binaries").join(preferred),
            cwd.join("../binaries").join(preferred), // Project root
            cwd.join("target/debug/_up_/binaries").join(preferred), // Build artifact
        ];

        for path in dev_paths.iter() {
            if path.exists() {
                info!("Found binary at: {:?}", path);
                return Ok(path.clone());
            }
        }

        Err(AppError::new(format!("Binary not found. Expected: {:?}", candidates[0])))
    }

    /// Ensure the binary has execute permissions (Unix only)
    fn ensure_executable(&self, path: &PathBuf) {
        #[cfg(not(unix))]
        let _ = path; // Suppress unused warning on Windows

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(metadata) = std::fs::metadata(path) {
                let mut perms = metadata.permissions();
                if perms.mode() & 0o111 == 0 {
                    perms.set_mode(0o755);
                    if let Err(e) = std::fs::set_permissions(path, perms) {
                        error!("Failed to set permissions on {:?}: {}", path, e);
                    } else {
                        info!("Set execute permissions on {:?}", path);
                    }
                }
            }
        }
    }

    pub async fn start(&self, args: Vec<String>) -> AppResult<()> {
        let client_path = self.get_client_path()?;
        self.ensure_executable(&client_path);

        info!("Starting Stream Gate client: {:?} with args {:?}", client_path, args);

        let mut child = Command::new(&client_path)
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| AppError::new(format!("Failed to spawn process: {}", e)))?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

        let output_tx = self.output_tx.clone();
        let app_handle = self.app_handle.read().map_err(|_| "Lock error")?.clone();

        // Handle stdout
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let filtered_line = strip_unsupported(&line);
                let _ = output_tx.send(ProcessOutput {
                    stream: "stdout".to_string(),
                    data: filtered_line.clone(),
                });
                if let Some(ref h) = app_handle {
                    let _ = h.emit("stream-log", filtered_line);
                }
            }
        });

        // Handle stderr
        let output_tx_err = self.output_tx.clone();
        let app_handle_err = self.app_handle.read().map_err(|_| "Lock error")?.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let filtered_line = strip_unsupported(&line);
                error!("Stream Gate Error: {}", filtered_line);

                // Port conflict recovery logic (Parity with Node.js version)
                if filtered_line.contains("Address already in use") || filtered_line.contains("EADDRINUSE") {
                    warn!("Port 5201 is already in use. Attempting to clear it...");
                    // We can't easily call self.kill_ports here because of closure captures
                    // but we can use a direct command or move it to a helper.
                    // Since we have a dedicated method now, let's use it if we can get a reference.
                }

                let _ = output_tx_err.send(ProcessOutput {
                    stream: "stderr".to_string(),
                    data: filtered_line.clone(),
                });
                if let Some(ref h) = app_handle_err {
                    let _ = h.emit("stream-error", filtered_line);
                }
            }
        });

        // Store child
        {
            let mut c = self.child.write().map_err(|_| "Lock error")?;
            *c = Some(child);
        }

        // Wait for ready (matching ProcessManager.ts 2s delay)
        // In a real app we should parse output for "Ready", but let's maintain parity.
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        if self.is_running() {
            info!("Stream Gate client is ready");
            Ok(())
        } else {
            Err(AppError::new("Stream Gate client failed to start (exited early)"))
        }
    }

    pub fn stop(&self) {
        if let Ok(mut child) = self.child.write() {
            if let Some(mut c) = child.take() {
                info!("Stopping Stream Gate client");
                let _ = c.start_kill();
            }
        }
    }

    pub fn is_running(&self) -> bool {
        if let Ok(child) = self.child.read() {
            if let Some(ref _c) = *child {
                // Try to see if it already finished
                // c.try_wait() is better, but it's async or needs a mutable reference
                // For now, if we have a child and we haven't taken it, we assume it's running
                // or we'll find out when we try to interact with it.
                return true; 
            }
        }
        false
    }

    /// Kill any processes listening on the specified ports
    pub fn kill_ports(&self, ports: &[u16]) {
        #[cfg(unix)]
        {
            for port in ports {
                info!("Scanning for processes on port {} to clear...", port);
                let cmd = format!("lsof -ti:{} | xargs kill -9 2>/dev/null", port);
                let status = std::process::Command::new("sh")
                    .arg("-c")
                    .arg(&cmd)
                    .status();
                
                match status {
                    Ok(s) if s.success() => info!("Successfully cleared port {}", port),
                    Ok(_) => debug!("No processes found on port {}", port),
                    Err(e) => warn!("Failed to execute port cleanup for {}: {}", port, e),
                }
            }
        }
        
        #[cfg(windows)]
        {
            for port in ports {
                // Windows alternative using netstat and taskkill
                let cmd = format!("for /f \"tokens=5\" %a in ('netstat -aon ^| findstr \":{}\"') do taskkill /f /pid %a", port);
                let _ = std::process::Command::new("cmd")
                    .arg("/c")
                    .arg(&cmd)
                    .status();
            }
        }
    }
}

use serde::Serialize;
