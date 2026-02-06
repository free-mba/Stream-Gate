# Electron to Tauri Migration Plan

> **Stream Gate (Client for Slipstream Plus)**
> Comprehensive step-by-step migration from Electron + TypeScript to Tauri + Rust

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Service Mapping](#service-mapping)
4. [Rust Module Structure](#rust-module-structure)
5. [Testing Strategy](#testing-strategy)
6. [Migration Phases](#migration-phases)
7. [Test Hierarchy](#test-hierarchy)
8. [Implementation Tasks](#implementation-tasks)

---

## Executive Summary

### Current State (Electron)
- **Main Process**: TypeScript with 11 modular services
- **Renderer**: React + Vite + TailwindCSS
- **Communication**: Electron IPC (ipcMain/ipcRenderer)
- **Bundle Size**: ~150MB+ (Chromium + Node.js overhead)

### Target State (Tauri)
- **Core Backend**: Rust with equivalent services
- **Frontend**: Same React + Vite (reusable)
- **Communication**: Tauri IPC commands
- **Bundle Size**: ~10-20MB (native WebView + Rust binary)

### Key Benefits
- **90%+ bundle size reduction**
- **Lower RAM usage** (no Chromium embedding)
- **Better security** (Rust memory safety)
- **Native performance** (compiled binary)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CURRENT (Electron)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     start-renderer (React/Vite)                      │   │
│  │  - Components, Features, State (Jotai)                               │   │
│  │  - IpcService.ts (window.require('electron').ipcRenderer)            │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   │ Electron IPC                            │
│  ┌────────────────────────────────▼────────────────────────────────────┐   │
│  │                        start-main (TypeScript)                       │   │
│  │                                                                      │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │   │ EventEmitter │  │    Logger    │  │     WindowService        │  │   │
│  │   └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │                    SettingsService                           │  │   │
│  │   │  - load/save JSON, validate, import/export configs           │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  │   ┌───────────────┐  ┌───────────────┐  ┌────────────────────────┐  │   │
│  │   │ ProcessManager │  │  ProxyService │  │   SystemProxyService  │  │   │
│  │   │ (spawn binary) │  │ (HTTP/SOCKS5) │  │ (macOS/Win/Linux)     │  │   │
│  │   └───────────────┘  └───────────────┘  └────────────────────────┘  │   │
│  │   ┌───────────────────────┐  ┌───────────────────────────────────┐  │   │
│  │   │      DNSService       │  │      DnsResolutionService         │  │   │
│  │   │ (ping, resolve, scan) │  │     (custom DNS resolution)       │  │   │
│  │   └───────────────────────┘  └───────────────────────────────────┘  │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │                   ConnectionService                          │  │   │
│  │   │  - Orchestrates all services, reconnection logic             │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │                     IPCController                            │  │   │
│  │   │  - Routes IPC messages to services                           │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ▼ MIGRATION ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                               TARGET (Tauri)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     start-renderer (React/Vite) ★ REUSED            │   │
│  │  - Same Components, Features, State                                  │   │
│  │  - TauriIpcService.ts (replace Electron IPC with Tauri invoke)       │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   │ Tauri IPC (invoke/listen)               │
│  ┌────────────────────────────────▼────────────────────────────────────┐   │
│  │                          src-tauri (Rust)                            │   │
│  │                                                                      │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │   │
│  │   │ event_bus    │  │    logger    │  │     (Tauri manages)      │  │   │
│  │   └──────────────┘  └──────────────┘  └──────────────────────────┘  │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │                      settings.rs                             │  │   │
│  │   │  - serde JSON load/save, validation, import/export           │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  │   ┌───────────────┐  ┌───────────────┐  ┌────────────────────────┐  │   │
│  │   │ process_mgr   │  │  proxy.rs     │  │   system_proxy.rs     │  │   │
│  │   │ (Command)     │  │ (tokio net)   │  │ (platform cfg)        │  │   │
│  │   └───────────────┘  └───────────────┘  └────────────────────────┘  │   │
│  │   ┌───────────────────────┐  ┌───────────────────────────────────┐  │   │
│  │   │      dns.rs           │  │       dns_resolver.rs             │  │   │
│  │   │ (trust-dns-resolver)  │  │     (custom DNS resolution)       │  │   │
│  │   └───────────────────────┘  └───────────────────────────────────┘  │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │                    connection.rs                             │  │   │
│  │   │  - Orchestrates all services, reconnection logic             │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  │   ┌──────────────────────────────────────────────────────────────┐  │   │
│  │   │                      commands.rs                             │  │   │
│  │   │  - #[tauri::command] handlers (replaces IPCController)       │  │   │
│  │   └──────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Mapping

| Electron Service (TypeScript) | Tauri Module (Rust) | Description |
|-------------------------------|---------------------|-------------|
| `EventEmitter.ts` | `event_bus.rs` | Internal pub/sub (tokio broadcast) |
| `Logger.ts` | `logger.rs` | Structured logging with `tracing` crate |
| `WindowService.ts` | *Tauri built-in* | Window management is native to Tauri |
| `SettingsService.ts` | `settings.rs` | JSON load/save with `serde` |
| `ProcessManager.ts` | `process_manager.rs` | Spawn/kill binary with `std::process::Command` |
| `ProxyService.ts` | `proxy.rs` | HTTP/SOCKS5 proxy with `tokio` + `hyper` |
| `SystemProxyService.ts` | `system_proxy.rs` | Platform-specific proxy config |
| `DNSService.ts` | `dns.rs` | DNS ping/resolve with `trust-dns-resolver` |
| `DnsResolutionService.ts` | `dns_resolver.rs` | Custom DNS resolution |
| `ConnectionService.ts` | `connection.rs` | Orchestration service |
| `IPCController.ts` | `commands.rs` | Tauri `#[tauri::command]` handlers |

---

## Rust Module Structure

```
src-tauri/
├── Cargo.toml                    # Dependencies: tauri, tokio, serde, etc.
├── tauri.conf.json              # Tauri configuration
├── build.rs                     # Build script
├── icons/                       # App icons
└── src/
    ├── main.rs                  # Entry point, Tauri setup
    ├── lib.rs                   # Module exports
    ├── commands.rs              # All #[tauri::command] functions
    ├── state.rs                 # AppState struct (shared state)
    │
    ├── core/                    # Core infrastructure
    │   ├── mod.rs
    │   ├── event_bus.rs         # Event pub/sub
    │   └── logger.rs            # Logging utilities
    │
    ├── services/                # Business logic
    │   ├── mod.rs
    │   ├── settings.rs          # Settings persistence
    │   ├── process_manager.rs   # Binary process management
    │   ├── proxy.rs             # HTTP/SOCKS5 proxy servers
    │   ├── system_proxy.rs      # OS proxy configuration
    │   ├── dns.rs               # DNS utilities
    │   ├── dns_resolver.rs      # Custom DNS resolution
    │   └── connection.rs        # Connection orchestration
    │
    └── tests/                   # Integration tests
        ├── settings_test.rs
        ├── process_manager_test.rs
        ├── proxy_test.rs
        ├── dns_test.rs
        ├── connection_test.rs
        └── commands_test.rs
```

---

## Testing Strategy

### Test Categories

| Category | Purpose | Tools |
|----------|---------|-------|
| **Unit Tests** | Test individual Rust modules | `cargo test` |
| **Integration Tests** | Test service interactions | `cargo test --test` |
| **Frontend-Backend Tests** | Test Tauri IPC commands | Tauri + Playwright/WebDriver |
| **E2E Tests** | Full user flows | Playwright + Tauri app |

### Test Hierarchy (Execution Order)

Tests must pass in this order before proceeding to the next phase:

```
Level 1: Core Infrastructure ─────────────────────────────────────────────────
  ├─ [T1.1] event_bus::tests        # Event pub/sub works
  ├─ [T1.2] logger::tests           # Logging works
  └─ [T1.3] settings::tests         # Settings load/save/validate works

Level 2: Standalone Services ─────────────────────────────────────────────────
  ├─ [T2.1] process_manager::tests  # Binary spawn/kill works
  ├─ [T2.2] dns::tests              # DNS ping/resolve works
  ├─ [T2.3] dns_resolver::tests     # Custom DNS resolution works
  └─ [T2.4] system_proxy::tests     # OS proxy config works

Level 3: Composite Services ──────────────────────────────────────────────────
  ├─ [T3.1] proxy::tests            # HTTP/SOCKS proxy servers work
  └─ [T3.2] connection::tests       # Connection orchestration works

Level 4: IPC Commands ────────────────────────────────────────────────────────
  ├─ [T4.1] commands::settings      # get-settings, save-settings
  ├─ [T4.2] commands::connection    # start-service, stop-service, get-status
  ├─ [T4.3] commands::dns           # dns-check-single, dns-scan-start/stop
  ├─ [T4.4] commands::proxy         # toggle-system-proxy, check-system-proxy
  └─ [T4.5] commands::misc          # get-version, check-update, open-external

Level 5: Frontend Integration ────────────────────────────────────────────────
  ├─ [T5.1] TauriIpcService         # Frontend can invoke all commands
  ├─ [T5.2] Status updates          # Backend emits events, frontend receives
  └─ [T5.3] Config management       # Create/edit/delete/import/export configs

Level 6: End-to-End ──────────────────────────────────────────────────────────
  ├─ [T6.1] Full connection flow    # Select config → Connect → Verify → Disconnect
  ├─ [T6.2] Settings persistence    # Change settings → Restart → Settings preserved
  └─ [T6.3] Error recovery          # Connection drops → Auto-reconnect works
```

---

## Migration Phases

### Phase 0: Setup Tauri Project
- [ ] Initialize Tauri project structure
- [ ] Configure `Cargo.toml` with dependencies
- [ ] Configure `tauri.conf.json`
- [ ] Set up Rust workspace
- [ ] Configure bundling for external binary

### Phase 1: Core Infrastructure (Rust)
- [ ] Implement `event_bus.rs`
- [ ] Implement `logger.rs`
- [ ] Write and pass `T1.1`, `T1.2` tests

### Phase 2: Settings Service (Rust)
- [ ] Implement `settings.rs` (JSON persistence)
- [ ] Implement settings validation
- [ ] Implement config import/export
- [ ] Write and pass `T1.3` tests

### Phase 3: Process Manager (Rust)
- [ ] Implement `process_manager.rs`
- [ ] Handle binary path resolution
- [ ] Handle process stdout/stderr streaming
- [ ] Write and pass `T2.1` tests

### Phase 4: DNS Services (Rust)
- [ ] Implement `dns.rs` (ping, resolve)
- [ ] Implement `dns_resolver.rs` (custom resolution)
- [ ] Write and pass `T2.2`, `T2.3` tests

### Phase 5: System Proxy (Rust)
- [ ] Implement `system_proxy.rs`
- [ ] Implement macOS proxy configuration
- [ ] Implement Windows proxy configuration
- [ ] Implement Linux proxy configuration
- [ ] Write and pass `T2.4` tests

### Phase 6: Proxy Service (Rust)
- [ ] Implement `proxy.rs` HTTP proxy
- [ ] Implement SOCKS5 forwarder
- [ ] Implement traffic monitoring
- [ ] Write and pass `T3.1` tests

### Phase 7: Connection Service (Rust)
- [ ] Implement `connection.rs`
- [ ] Implement auto-reconnection logic
- [ ] Implement graceful shutdown
- [ ] Write and pass `T3.2` tests

### Phase 8: Tauri Commands (Rust)
- [ ] Implement `commands.rs` with all `#[tauri::command]` handlers
- [ ] Set up shared `AppState`
- [ ] Register commands in Tauri builder
- [ ] Write and pass `T4.1` through `T4.5` tests

### Phase 9: Frontend Integration
- [ ] Create `TauriIpcService.ts` (drop-in replacement for Electron IPC)
- [ ] Update build configuration
- [ ] Test all features work via Tauri
- [ ] Write and pass `T5.1` through `T5.3` tests

### Phase 10: Polish & E2E
- [ ] Run full E2E test suite
- [ ] Fix any integration issues
- [ ] Performance optimization
- [ ] Bundle size verification
- [ ] Write and pass `T6.1` through `T6.3` tests

---

## Implementation Tasks

### Task 0.1: Initialize Tauri Project
**Priority**: 🔴 Critical
**Depends On**: None

```bash
# In project root
cd /Volumes/External/Projects/slipstream-android-client/SlipStreamGUI
npm create tauri-app@latest . -- --template vanilla --manager npm
# Or initialize manually for existing project
cargo install tauri-cli
cargo tauri init
```

**Files to Create**:
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`

**Acceptance Criteria**:
- [ ] `cargo tauri dev` runs successfully
- [ ] Empty window opens with React frontend

---

### Task 0.2: Configure Cargo Dependencies
**Priority**: 🔴 Critical
**Depends On**: Task 0.1

**Cargo.toml dependencies**:
```toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
trust-dns-resolver = "0.23"
hyper = { version = "1", features = ["full"] }
hyper-util = "0.1"
tokio-socks = "0.5"
base64 = "0.21"
uuid = { version = "1", features = ["v4"] }
thiserror = "1"
anyhow = "1"
dirs = "5"
```

**Acceptance Criteria**:
- [ ] `cargo build` succeeds
- [ ] All dependencies resolve

---

### Task 1.1: Implement Event Bus
**Priority**: 🟡 High
**Depends On**: Task 0.2
**Test**: `T1.1`

**File**: `src-tauri/src/core/event_bus.rs`

```rust
// Basic structure
pub struct EventBus {
    sender: tokio::sync::broadcast::Sender<Event>,
}

impl EventBus {
    pub fn new() -> Self;
    pub fn emit(&self, event: Event);
    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<Event>;
}
```

**Acceptance Criteria**:
- [ ] Can emit events
- [ ] Multiple subscribers receive events
- [ ] Test `T1.1` passes

---

### Task 1.2: Implement Logger
**Priority**: 🟡 High
**Depends On**: Task 0.2
**Test**: `T1.2`

**File**: `src-tauri/src/core/logger.rs`

Using `tracing` crate for structured logging.

**Acceptance Criteria**:
- [ ] Info/error/verbose logging works
- [ ] Logs can be stored in memory (for UI display)
- [ ] Test `T1.2` passes

---

### Task 2.1: Implement Settings Service
**Priority**: 🔴 Critical
**Depends On**: Task 1.1, Task 1.2
**Test**: `T1.3`

**File**: `src-tauri/src/services/settings.rs`

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct Settings {
    pub resolver: String,
    pub domain: String,
    pub mode: String,
    pub authoritative: bool,
    pub verbose: bool,
    pub socks5_auth_enabled: bool,
    pub socks5_auth_username: Option<String>,
    pub socks5_auth_password: Option<String>,
    pub system_proxy_enabled_by_app: bool,
    pub system_proxy_service_name: String,
    pub configs: Vec<ConfigItem>,
    pub selected_config_id: Option<String>,
    pub saved_dns: Vec<String>,
    pub custom_dns_enabled: bool,
    pub primary_dns: String,
    pub secondary_dns: String,
}

impl SettingsService {
    pub fn new(app_data_dir: PathBuf) -> Self;
    pub fn load(&mut self) -> Result<()>;
    pub fn save(&self) -> Result<()>;
    pub fn get<T>(&self, key: &str) -> Option<T>;
    pub fn set<T>(&mut self, key: &str, value: T);
    pub fn import_configs(&mut self, data: &str) -> ImportResult;
    pub fn export_configs(&self) -> String;
}
```

**Acceptance Criteria**:
- [ ] Settings load from JSON file
- [ ] Settings save to JSON file
- [ ] Validation works for resolver format
- [ ] Config import/export works
- [ ] Test `T1.3` passes

---

### Task 3.1: Implement Process Manager
**Priority**: 🔴 Critical
**Depends On**: Task 1.1, Task 1.2
**Test**: `T2.1`

**File**: `src-tauri/src/services/process_manager.rs`

```rust
pub struct ProcessManager {
    process: Option<tokio::process::Child>,
    output_tx: tokio::sync::broadcast::Sender<String>,
}

impl ProcessManager {
    pub async fn start(&mut self, resolver: &str, domain: &str, options: StartOptions) -> Result<()>;
    pub async fn stop(&mut self) -> Result<()>;
    pub fn is_running(&self) -> bool;
    pub fn subscribe_output(&self) -> Receiver<String>;
}
```

**Acceptance Criteria**:
- [ ] Binary path resolved for all platforms
- [ ] Process spawns successfully
- [ ] stdout/stderr captured and streamed
- [ ] Process stops gracefully
- [ ] Test `T2.1` passes

---

### Task 4.1: Implement DNS Service
**Priority**: 🟡 High
**Depends On**: Task 1.2
**Test**: `T2.2`

**File**: `src-tauri/src/services/dns.rs`

```rust
pub struct DnsService;

impl DnsService {
    pub async fn ping_host(ip: &str, timeout_ms: u64) -> PingResult;
    pub async fn resolve_with_server(server: &str, domain: &str, timeout_ms: u64) -> DnsResolveResult;
    pub async fn check_single_server(payload: CheckPayload) -> DnsCheckResult;
}
```

**Acceptance Criteria**:
- [ ] Ping works across platforms
- [ ] DNS resolution with specific server works
- [ ] Timeout handling works
- [ ] Test `T2.2` passes

---

### Task 4.2: Implement DNS Resolver Service
**Priority**: 🟡 High
**Depends On**: Task 4.1
**Test**: `T2.3`

**File**: `src-tauri/src/services/dns_resolver.rs`

**Acceptance Criteria**:
- [ ] Custom DNS resolution works
- [ ] Bypasses system DNS
- [ ] Test `T2.3` passes

---

### Task 5.1: Implement System Proxy Service
**Priority**: 🟡 High
**Depends On**: Task 2.1
**Test**: `T2.4`

**File**: `src-tauri/src/services/system_proxy.rs`

```rust
pub trait SystemProxy {
    async fn configure(&self) -> Result<ProxyConfigResult>;
    async fn unconfigure(&self, service_name: Option<&str>) -> Result<ProxyConfigResult>;
    async fn verify_configuration(&self) -> Result<bool>;
}

// Platform implementations
pub struct MacSystemProxy;
pub struct WindowsSystemProxy;
pub struct LinuxSystemProxy;
```

**Acceptance Criteria**:
- [ ] macOS system proxy configure/unconfigure works
- [ ] Windows registry modification works
- [ ] Linux gsettings/environment works
- [ ] Test `T2.4` passes

---

### Task 6.1: Implement Proxy Service
**Priority**: 🟡 High
**Depends On**: Task 2.1, Task 1.1
**Test**: `T3.1`

**File**: `src-tauri/src/services/proxy.rs`

```rust
pub struct ProxyService {
    http_proxy: Option<tokio::task::JoinHandle<()>>,
    socks_forward: Option<tokio::task::JoinHandle<()>>,
    traffic_up: AtomicU64,
    traffic_down: AtomicU64,
}

impl ProxyService {
    pub async fn start_http_proxy(&mut self) -> Result<()>;
    pub async fn start_socks_forward_proxy(&mut self) -> Result<()>;
    pub async fn stop_all(&mut self);
    pub fn get_traffic_stats(&self) -> TrafficStats;
}
```

**Acceptance Criteria**:
- [ ] HTTP proxy listens on port 8080
- [ ] CONNECT tunneling works
- [ ] SOCKS5 forwarding works
- [ ] Traffic monitoring works
- [ ] Test `T3.1` passes

---

### Task 7.1: Implement Connection Service
**Priority**: 🔴 Critical
**Depends On**: Task 3.1, Task 5.1, Task 6.1, Task 4.2
**Test**: `T3.2`

**File**: `src-tauri/src/services/connection.rs`

```rust
pub struct ConnectionService {
    process_manager: ProcessManager,
    proxy_service: ProxyService,
    system_proxy_service: Box<dyn SystemProxy>,
    dns_resolver: DnsResolver,
    settings: Arc<Mutex<Settings>>,
    status: ConnectionStatus,
}

impl ConnectionService {
    pub async fn start(&mut self, options: StartOptions) -> Result<ConnectionResult>;
    pub async fn stop(&mut self) -> Result<ConnectionResult>;
    pub fn get_status(&self) -> ConnectionStatus;
    pub async fn cleanup_and_disable_proxy(&mut self, reason: &str) -> Result<()>;
}
```

**Acceptance Criteria**:
- [ ] Full connection lifecycle works
- [ ] Auto-reconnection with backoff works
- [ ] Graceful shutdown works
- [ ] Test `T3.2` passes

---

### Task 8.1: Implement Tauri Commands
**Priority**: 🔴 Critical
**Depends On**: Task 7.1
**Test**: `T4.1` - `T4.5`

**File**: `src-tauri/src/commands.rs`

```rust
#[tauri::command]
async fn start_service(state: State<'_, AppState>, payload: StartPayload) -> Result<ConnectionResult, String>;

#[tauri::command]
async fn stop_service(state: State<'_, AppState>) -> Result<ConnectionResult, String>;

#[tauri::command]
fn get_status(state: State<'_, AppState>) -> StatusResponse;

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Settings;

#[tauri::command]
fn save_settings(state: State<'_, AppState>, settings: Settings) -> Result<(), String>;

// ... all other commands
```

**IPC Command Mapping**:

| Electron Channel | Tauri Command |
|------------------|---------------|
| `start-service` | `start_service` |
| `stop-service` | `stop_service` |
| `get-status` | `get_status` |
| `get-settings` | `get_settings` |
| `save-settings` | `save_settings` |
| `set-authoritative` | `set_authoritative` |
| `set-resolver` | `set_resolver` |
| `set-verbose` | `set_verbose` |
| `set-socks5-auth` | `set_socks5_auth` |
| `import-configs` | `import_configs` |
| `export-configs` | `export_configs` |
| `toggle-system-proxy` | `toggle_system_proxy` |
| `check-system-proxy` | `check_system_proxy` |
| `dns-check-single` | `dns_check_single` |
| `dns-scan-start` | `dns_scan_start` |
| `dns-scan-stop` | `dns_scan_stop` |
| `get-version` | `get_version` |
| `check-update` | `check_update` |
| `test-proxy` | `test_proxy` |
| `open-external` | `open_external` |
| `get-logs` | `get_logs` |

**Acceptance Criteria**:
- [ ] All commands registered in Tauri
- [ ] All commands work correctly
- [ ] Tests `T4.1` through `T4.5` pass

---

### Task 9.1: Create Tauri IPC Service for Frontend
**Priority**: 🔴 Critical
**Depends On**: Task 8.1
**Test**: `T5.1` - `T5.3`

**File**: `src/start-renderer/src/services/TauriIpcService.ts`

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const ipc = {
    invoke: async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
        // Convert channel names: 'get-settings' -> 'get_settings'
        const rustCommand = command.replace(/-/g, '_');
        return invoke<T>(rustCommand, args);
    },
    on: (event: string, callback: (payload: unknown) => void) => {
        return listen(event, (e) => callback(e.payload));
    },
    removeListener: () => {},
    send: () => {}
};
```

**Acceptance Criteria**:
- [ ] All frontend features work with Tauri backend
- [ ] Status updates received via events
- [ ] Tests `T5.1` through `T5.3` pass

---

### Task 10.1: E2E Testing & Final Verification
**Priority**: 🔴 Critical
**Depends On**: Task 9.1
**Test**: `T6.1` - `T6.3`

**Acceptance Criteria**:
- [ ] Full connection flow works
- [ ] Settings persist across restarts
- [ ] Error recovery and reconnection work
- [ ] Bundle size < 25MB
- [ ] Tests `T6.1` through `T6.3` pass

---

## Frontend Modifications Required

### IpcService.ts → TauriIpcService.ts

The existing `IpcService.ts` uses `window.require('electron').ipcRenderer`. This needs to be replaced with Tauri's `invoke` API.

**Strategy**: Create an abstraction layer that:
1. Detects runtime (Tauri vs Electron vs Browser)
2. Routes calls accordingly

```typescript
// services/IpcService.ts
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

const isTauri = '__TAURI__' in window;

export const ipc = {
    invoke: async <T>(channel: string, ...args: unknown[]): Promise<T> => {
        if (isTauri) {
            const command = channel.replace(/-/g, '_');
            return invoke<T>(command, args[0] as Record<string, unknown> || {});
        }
        // Fallback to Electron or mock
        // ...
    },
    on: (channel: string, callback: (event: unknown, ...args: unknown[]) => void): UnlistenFn | void => {
        if (isTauri) {
            return listen(channel, (e) => callback(e, e.payload));
        }
        // Fallback
    }
};
```

---

## Notes for AI Agent

When implementing this migration:

1. **Follow the test hierarchy** - Do not proceed to the next level until all tests at the current level pass.

2. **One service at a time** - Implement and test each Rust module independently before integrating.

3. **Use the progress file** - Update `MIGRATION_PROGRESS.md` after completing each task.

4. **Preserve interfaces** - The Tauri commands should accept the same parameters and return the same structures as the Electron IPC handlers.

5. **Error handling** - Use `Result<T, String>` for Tauri commands to properly propagate errors to the frontend.

6. **State management** - Use `tauri::State<AppState>` to share state between commands.

7. **Async operations** - Use `tokio` for all async operations in Rust.

---

## Resources

- [Tauri v2 Documentation](https://v2.tauri.app/)
- [Tauri Plugin System](https://v2.tauri.app/develop/plugins/)
- [tokio Documentation](https://tokio.rs/)
- [serde Documentation](https://serde.rs/)
- [trust-dns-resolver](https://docs.rs/trust-dns-resolver/)

---

*Last Updated: 2026-02-05*
