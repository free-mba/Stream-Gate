# Electron to Tauri Migration Issues

> **Date**: 2026-02-07
> **Status**: Critical - Application Non-Functional

This document outlines the critical issues found when comparing the original Electron implementation with the Tauri migration.

---

## Summary

The Tauri migration is **non-functional** because the HTTP proxy service was left as a stub implementation. Additionally, there are several naming mismatches and missing fields that prevent the application from working correctly.

---

## 🔴 CRITICAL: HTTP Proxy Service is a Stub

### Location
- **Electron**: `src/start-main/services/business/ProxyService.ts` (735 lines)
- **Tauri**: `src-tauri/src/services/proxy_service.rs` (133 lines)

### Issue
The Electron version contains a fully functional HTTP proxy server that handles:
- HTTP request forwarding to SOCKS5
- HTTPS CONNECT tunneling
- WebSocket upgrade support
- SOCKS5 authentication
- Traffic monitoring (uplink/downlink)
- SOCKS5-to-HTTP bridge on port 10809

The Tauri version contains only stub code:

```rust
pub async fn start_http_proxy(&self) -> AppResult<()> {
    if self.is_http_proxy_running() {
        return Ok(());
    }

    info!("Starting HTTP Proxy on port 8080");

    // TODO: Implement actual hyper-based HTTP proxy
    // For now, this is a stub that logs and waits

    let (tx, mut rx) = tokio::sync::oneshot::channel::<()>();
    // ... just spawns a task and returns
}
```

**Impact**: No proxy server actually runs - all traffic fails.

---

## 🟠 High Priority Issues

### 1. IPC Event Name Mismatch

**Location**: `src-tauri/src/services/connection.rs`

| Component | Electron Event | Tauri Event | Status |
|-----------|----------------|-------------|--------|
| Connection status | `status-update` | `connection-status` | ❌ MISMATCH |
| Stream logs | `stream-log` | `stream-log` | ✅ Match |
| Stream errors | `stream-error` | `stream-error` | ✅ Match |
| Traffic updates | `traffic-update` | Not implemented | ❌ Missing |
| DNS scan progress | `dns-scan-progress` | Not implemented | ❌ Missing |
| DNS scan result | `dns-scan-result` | Not implemented | ❌ Missing |
| DNS scan complete | `dns-scan-complete` | Not implemented | ❌ Missing |

**Tauri code emitting wrong event** (`connection.rs:150, 247, 266, 289, 317`):
```rust
let _ = h.emit("connection-status", self.get_status());
```

**Frontend expects** (from Electron):
```typescript
windowService.sendToRenderer('status-update', this.connectionService.getStatus());
```

**Impact**: UI never receives connection status updates.

---

### 2. Settings Field Naming Mismatch

**Location**:
- Tauri: `src-tauri/src/services/settings.rs`
- Frontend: `src/start-renderer/src/services/TauriIpcService.ts`

| Electron (camelCase) | Tauri (snake_case) | TauriIpcService expects |
|----------------------|-------------------|-------------------------|
| `socks5AuthEnabled` | `socks5_auth_enabled` | `socks5AuthEnabled` ✅ |
| `socks5AuthUsername` | `socks5_auth_username` | `socks5AuthUsername` ✅ |
| `socks5AuthPassword` | `socks5_auth_password` | `socks5AuthPassword` ✅ |

The Rust struct uses snake_case (correct for Rust), but the save() method in `settings.rs:259-272` looks for camelCase keys from JSON:

```rust
"socks5AuthEnabled" => {
    if let Some(b) = value.as_bool() {
        settings.socks5_auth_enabled = b;
    }
}
```

This is actually correct, but needs verification that the frontend sends the right format.

---

### 3. Missing Settings Fields

**Location**: `src-tauri/src/services/settings.rs`

The Tauri `Settings` struct is missing these fields from the Electron version:

| Field | Electron Type | Tauri Status |
|-------|---------------|--------------|
| `selectedConfigId` | `string \| null` | ❌ Missing |
| `savedDns` | `string[]` | ❌ Missing |
| `language` | `'en' \| 'fa'` | ❌ Missing |
| `theme` | `'light' \| 'dark' \| 'system'` | ❌ Missing |
| `customDnsEnabled` | `boolean` | ⚠️ In ConnectionConfig only |
| `primaryDns` | `string` | ⚠️ In ConnectionConfig only |
| `secondaryDns` | `string` | ⚠️ In ConnectionConfig only |

**Default values in Electron** (`SettingsService.ts:80-98`):
```typescript
this.defaults = {
  resolvers: ['8.8.8.8:53'],
  domain: 's.example.com',
  mode: 'proxy',
  authoritative: false,
  verbose: false,
  socks5AuthEnabled: false,
  socks5AuthUsername: '',
  socks5AuthPassword: '',
  systemProxyEnabledByApp: false,
  systemProxyServiceName: '',
  configs: [],
  selectedConfigId: null,
  savedDns: ['8.8.8.8:53', '1.1.1.1:53'],
  customDnsEnabled: false,
  primaryDns: '8.8.8.8',
  secondaryDns: '1.1.1.1'
};
```

**Impact**: Settings won't persist correctly; UI elements will be broken.

---

### 7. IPC Command Argument Mismatches

**Location**: `src/start-renderer/src/services/TauriIpcService.ts` vs `src-tauri/src/commands/*.rs`

The Tauri IPC adapter sends flattened arguments, but the Rust backend expects specific named fields or wrapped payloads for several commands.

| Command | Frontend Sends | Rust Expects | Status |
|---------|----------------|--------------|--------|
| `start-service` | `{ ...config }` | `{ payload: ConnectionConfig }` | ❌ Mismatch |
| `toggle-system-proxy` | `{ payload: boolean }` | `{ enable: boolean }` | ❌ Mismatch |
| `dns-check-single` | `{ ...params }` | `{ payload: DnsCheckPayload }` | ❌ Mismatch |
| `open-external` | `{ payload: string }` | `{ url: string }` | ❌ Mismatch |

**Impact**: These commands fail silently or with deserialization errors, causing "nothing works" symptoms.

---

## 🟡 Medium Priority Issues

### 4. DNS Service is a Stub

**Location**: `src-tauri/src/commands/dns.rs`

The DNS service commands exist but are not fully implemented. The Electron version has:
- `DNSService.ts` - Full DNS resolution checking
- `DnsResolutionService.ts` - Custom DNS resolution via trust-dns
- Batch scanning with progress callbacks
- Individual server testing

The Tauri version has stub implementations that return mock data.

---

### 5. Traffic Monitoring Not Implemented

**Electron** (`ProxyService.ts:117-154`):
```typescript
private _startTrafficMonitor(): void {
  this.trafficInterval = setInterval(() => {
    const speedUp = nowUp - this.prevUplink;
    const speedDown = nowDown - this.prevDownlink;
    this.eventEmitter.emit('traffic-update', { up: speedUp, down: speedDown });
  }, 1000);
}
```

**Tauri**: The struct has a `_traffic_tx` broadcast channel but it's never actually used to send data.

---

### 6. Proxy Testing Implementation Different

**Electron** (`IPCController.ts:437-505`):
```typescript
async _handleTestProxy() {
  const options = {
    hostname: '127.0.0.1',
    port: 8080,
    path: 'http://httpbin.org/ip',
    // ... actual HTTP request through proxy
  };
}
```

**Tauri** (`commands/utility.rs`):
Uses `reqwest` but may not properly route through the local SOCKS5 proxy.

---

## Component Status Summary

| Component | Electron | Tauri | Status |
|-----------|----------|-------|--------|
| HTTP Proxy Server | ✅ Full (735 lines) | ❌ STUB (TODO) | **CRITICAL** |
| System Proxy Config | ✅ Full | ✅ Full | OK |
| Process Spawning | ✅ Full | ✅ Full | OK |
| Settings Storage | ✅ Full | ⚠️ Missing fields | **Broken** |
| DNS Service | ✅ Full | ❌ STUB | Partial |
| IPC Events | ✅ All channels | ⚠️ Name mismatch | **Broken** |
| Traffic Monitoring | ✅ Full | ❌ Not wired up | Missing |

---

## Recommended Fix Order

1. **[CRITICAL]** Implement HTTP proxy server in Rust using `hyper`
2. **[HIGH]** Fix IPC event name: `connection-status` → `status-update`
3. **[HIGH]** Fix IPC Command Arguments (Frontend Bridge)
4. **[HIGH]** Add missing settings fields
5. **[MEDIUM]** Implement DNS service
6. **[MEDIUM]** Wire up traffic monitoring
7. **[LOW]** Add missing DNS event emissions

---

## File References

### Electron (Working)
- `src/start-main/services/presentation/IPCController.ts` - IPC routing (630 lines)
- `src/start-main/services/business/ProxyService.ts` - HTTP proxy (735 lines)
- `src/start-main/services/business/ProcessManager.ts` - Binary lifecycle (302 lines)
- `src/start-main/services/business/SystemProxyService.ts` - OS proxy config
- `src/start-main/services/data/SettingsService.ts` - Settings persistence (396 lines)
- `src/start-main/services/business/DNSService.ts` - DNS checking
- `src/start-main/services/business/DnsResolutionService.ts` - Custom DNS

### Tauri (Broken)
- `src-tauri/src/lib.rs` - Main entry
- `src-tauri/src/services/proxy_service.rs` - **STUB** (133 lines)
- `src-tauri/src/services/connection.rs` - Connection orchestration
- `src-tauri/src/services/process_manager.rs` - Process spawning
- `src-tauri/src/services/system_proxy.rs` - OS proxy config
- `src-tauri/src/services/settings.rs` - Settings (missing fields)
- `src-tauri/src/commands/dns.rs` - DNS stubs

### Frontend Bridge
- `src/start-renderer/src/services/IpcService.ts` - IPC abstraction
- `src/start-renderer/src/services/TauriIpcService.ts` - Tauri adapter
