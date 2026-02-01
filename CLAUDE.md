# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stream Gate is a cross-platform desktop VPN client built with Electron. It creates a multi-layer proxy architecture where user applications connect to an HTTP proxy (port 8080), which forwards to a SOCKS5 client (port 5201), which tunnels through an encrypted connection to a Stream Gate VPN server.

**Technology Stack:**
- Electron 28.0.0 (desktop framework)
- Vanilla HTML/CSS/JavaScript (no frontend frameworks)
- Node.js (backend runtime)
- Native C++ binaries (Stream Gate client executables)

**Key Files:**
- `main.js` - Electron main process (2000+ lines), handles process management, IPC, HTTP proxy server, system proxy configuration
- `index.html` - UI renderer with embedded CSS/JS
- `binaries/` - Platform-specific native client binaries (downloaded from upstream)
- `scripts/download-binaries.js` - Fetches latest binaries from GitHub releases

## Development Commands

```bash
# Development
npm start                    # Run in development mode with hot reload

# Binary management (must run before building)
npm run download:binaries    # Download latest native client binaries
npm run verify:binaries      # Verify binary integrity (auto-runs before builds)
npm run clean:binaries       # Remove downloaded binaries

# Building (requires binaries in binaries/)
npm run build:mac            # Build universal macOS DMG
npm run build:mac:arm64      # Build for Apple Silicon only
npm run build:mac:x64        # Build for Intel Macs only
npm run build:win            # Build Windows installer (NSIS)
npm run build:linux          # Build Linux packages (AppImage + DEB)
npm run build:all            # Build for all platforms

# Build output
dist/                        # Contains built installers
```

**Note:** Build commands have pre-hooks that automatically verify binaries exist. The download script fetches from `free-mba/Stream Gate-rust-deploy` releases on GitHub.

## Architecture

### Multi-Layer Proxy Design

```
User Applications
    ↓ HTTP/HTTPS (127.0.0.1:8080)
HTTP Proxy Server (Node.js http-proxy)
    ↓ SOCKS5 Protocol (127.0.0.1:5201)
SOCKS5 Client (Stream Gate-client binary)
    ↓ Encrypted Tunnel
Stream Gate VPN Server
```

### Main Process Architecture (main.js)

**Key Components:**

1. **Settings Management** (`loadSettings()`, `saveSettings()`)
   - Stored in `settings.json` in Electron's userData directory (platform-specific)
   - Includes: resolver, domain, verbose logging, SOCKS5 auth, system proxy state
   - One-time migration from legacy local settings file

2. **Process Management**
   - Spawns native Stream Gate client binaries as child processes
   - Platform-aware binary selection (mac-arm64, mac-intel, win, linux)
   - Automatic executable permission handling on Unix systems
   - Graceful process termination on app quit

3. **HTTP Proxy Server** (port 8080)
   - Uses `http-proxy` package to convert HTTP requests to SOCKS5
   - Optionally exposes SOCKS5 forwarder on port 10809 for network sharing
   - Routes all traffic through SOCKS5 client on port 5201

4. **System Proxy Configuration**
   - macOS: Uses `networksetup` command
   - Windows: Registry modifications
   - Linux: Writes to `/etc/environment`
   - Safety: Only disables system proxy if the app originally enabled it (`systemProxyEnabledByApp` flag)

5. **IPC Communication**
   - Two-way communication between main and renderer processes
   - Settings updates, status queries, process control
   - DNS checker utility integration

### Renderer Process (index.html)

**UI Sections:**
- Status panel (real-time connection status)
- Settings panel (DNS resolver, domain, SOCKS5 auth)
- DNS Checker (test multiple DNS servers)
- Logs panel with verbose toggle
- Start/Stop VPN controls

**Patterns:**
- Pure JavaScript (no frameworks)
- Direct DOM manipulation
- `ipcRenderer` for main process communication
- Event-driven status updates

## Build Configuration

**electron-builder setup (package.json):**

- **macOS**: Universal DMG with both ARM64 and x64 binaries in `extraResources`
- **Windows**: NSIS installer with one-click disabled (allows directory selection)
- **Linux**: AppImage and DEB packages

**Binary Path Resolution:**
- Development: Uses `__dirname` (project root)
- Production: Uses `process.resourcesPath` (app Resources folder)
- Binaries are copied via `extraResources` build config

## Important Patterns

### Settings Persistence
Settings are stored in platform-specific userData directory (NOT in project directory):
```javascript
// Correct way to get settings path
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
```

### Binary Execution
```javascript
// Platform-aware binary selection
const binaryName = process.platform === 'darwin' ? 'Stream Gate-client-mac-arm64' : ...
const binaryPath = path.join(isDev ? __dirname : process.resourcesPath, 'binaries', binaryName);
spawn(binaryPath, args, { stdio: 'pipe' });
```

### System Proxy Safety
The app tracks whether it enabled the system proxy (`systemProxyEnabledByApp`) to ensure it only disables proxies it originally configured, preventing disruption of user's manual proxy settings.

### Auto-Reconnection
Implements 3-attempt reconnection with exponential backoff (30s, 60s, 120s delays) for robust connectivity.

## Testing

No formal test framework. Manual testing via:
- "Test Proxy Connection" button in UI
- DNS Checker utility for DNS connectivity testing
- Verbose logging toggle for debugging
- Console.log statements throughout codebase

## Common Workflows

### Adding New Settings
1. Add variable to `main.js` global scope
2. Update `loadSettings()` to read from JSON
3. Update `saveSettings()` to write to JSON
4. Add UI controls in `index.html`
5. Wire up IPC handlers in `main.js`

### Updating Native Binaries
1. Run `npm run download:binaries` to fetch latest from upstream
2. Test locally with `npm start`
3. Commit new binaries to repository
4. Build and release

### Platform-Specific Code
Use `process.platform` checks:
- `'darwin'` - macOS
- `'win32'` - Windows
- `'linux'` - Linux

## Related Projects

- **Stream Gate-rust-deploy** (https://github.com/AliRezaBeigy/Stream Gate-rust-deploy): Server deployment scripts and source of native client binaries
