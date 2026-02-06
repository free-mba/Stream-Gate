# Modular Architecture Refactoring Plan

## Overview

This document outlines the modular architecture for refactoring `main.js` following SOLID principles. The architecture uses a **Service Layer Pattern** with **Event-Driven Communication** and **Dependency Injection**.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         main.js (Orchestrator)                   │
│  - Initializes all services                                      │
│  - Wires up dependencies for Slipstream Plus                     │
│  - Handles app lifecycle                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  IPC Controller │  │ Window Service  │  │  Event Emitter  │
│  - Routes IPC   │  │  - Creates win  │  │  - Pub/Sub      │
│    to services  │  │  - Manages life │  │  - Broadcasts   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Settings Service│  │Connection Service│  │   DNS Service   │
│  - Load/save    │  │  - Orchestrates  │  │  - DNS checker  │
│  - Validate     │  │    all services  │  │  - Ping hosts   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Process Manager │  │  Proxy Service  │  │SystemProxy Svc  │
│  - Spawn/kill   │  │  - HTTP proxy   │  │  - Platform cfg │
│  - Monitor proc │  │  - SOCKS fwd    │  │  - macOS/Win/Lx │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Module Breakdown

### 1. Core/Infrastructure Layer

#### `services/EventEmitter.js`
**Responsibility**: Centralized event pub/sub system
```javascript
class EventEmitter {
  on(event, callback)
  off(event, callback)
  emit(event, data)
}
```
**Events emitted**:
- `service:started`
- `service:stopped`
- `service:error`
- `log:message`
- `log:error`
- `status:changed`

#### `services/Logger.js`
**Responsibility**: Structured logging with verbosity control
```javascript
class Logger {
  info(message, meta)
  error(message, error)
  verbose(message, meta)
  setVerbose(enabled)
}
```

#### `services/WindowService.js`
**Responsibility**: Electron window lifecycle management
```javascript
class WindowService {
  createWindow()
  getWindow()
  sendToRenderer(channel, data)
  canSendToWindow()
}
```

---

### 2. Data Layer

#### `services/SettingsService.js`
**Responsibility**: Settings persistence and validation
```javascript
class SettingsService {
  // Single Responsibility: Only handle settings
  load()
  save(updates)
  get(key)
  set(key, value)
  getAll()
  validateResolver(value) {
    // Only accept IPv4:port format (e.g., 8.8.8.8:53)
    return this.DNSService.validate(value);
  }
```

**Dependencies**: None (infrastructure only)

---

### 3. Business Logic Layer

#### `services/ProcessManager.js`
**Responsibility**: Native binary process lifecycle
```javascript
class ProcessManager {
  // Single Responsibility: Process spawning and monitoring
  start(resolver, domain, options)
  stop()
  isRunning()
  getProcess()
  onOutput(callback)
  onError(callback)
  onExit(callback)
}
```

**Dependencies**: EventEmitter, Logger

#### `services/ProxyService.js`
**Responsibility**: HTTP proxy server and SOCKS5 forwarder
```javascript
class ProxyService {
  // Single Responsibility: HTTP & SOCKS5 proxy servers
  startHttpProxy(options)
  startSocksForwardProxy(options)
  stopHttpProxy()
  stopSocksForwardProxy()
  isHttpProxyRunning()
  isSocksForwardRunning()
}
```

**Dependencies**: EventEmitter, Logger, SettingsService (for auth)

#### `services/SystemProxyService.js`
**Responsibility**: Platform-specific system proxy configuration
```javascript
class SystemProxyService {
  // Single Responsibility: System proxy configuration
  configure()
  unconfigure()
  isEnabled()
  getActiveService()
  verifyConfiguration()
}

// Platform-specific implementations (Strategy Pattern)
class MacSystemProxy { /* ... */ }
class WindowsSystemProxy { /* ... */ }
class LinuxSystemProxy { /* ... */ }
```

**Dependencies**: SettingsService, Logger

#### `services/DNSService.js`
**Responsibility**: DNS checking and validation utilities
```javascript
class DNSService {
  // Single Responsibility: DNS diagnostics
  parseDnsServer(server)
  pingHost(ip, timeout)
  resolveWithServer(server, domain, timeout)
  checkSingleServer(server, domain, options)
}
```

**Dependencies**: Logger

---

### 4. Orchestration Layer

#### `services/ConnectionService.js`
**Responsibility**: Orchestrates all services to establish VPN connection
```javascript
class ConnectionService {
  // Single Responsibility: Connection lifecycle orchestration
  start(options)
  stop()
  getStatus()
  retry()
  isRunning()
  onStatusChange(callback)

  // Private methods
  _attemptReconnection()
  _clearRetryTimer()
  _startAllServices()
  _stopAllServices()
}
```

**Dependencies**:
- ProcessManager
- ProxyService
- SystemProxyService
- SettingsService
- EventEmitter
- Logger

**Auto-reconnection logic**: Encapsulated here with exponential backoff

---

### 5. Presentation Layer

#### `services/IPCController.js`
**Responsibility**: Route IPC messages to appropriate services
```javascript
class IPCController {
  // Single Responsibility: IPC routing
  registerHandlers()

  // IPC Handlers (delegated to services)
  _handleStartService()
  _handleStopService()
  _handleGetStatus()
  _handleGetSettings()
  _handleSetSettings()
  _handleDNSSingleCheck()
  // ... etc
}
```

**Dependencies**:
- ConnectionService
- SettingsService
- DNSService
- WindowService
- SystemProxyService
- Logger

---

## File Structure

```
Stream-Gate/
├── main.js                          # Orchestrator (minimal)
├── services/                        # All business logic
│   ├── core/
│   │   ├── EventEmitter.js         # Pub/sub system
│   │   └── Logger.js               # Structured logging
│   ├── infrastructure/
│   │   └── WindowService.js        # Window management
│   ├── data/
│   │   └── SettingsService.js      # Settings persistence
│   ├── business/
│   │   ├── ProcessManager.js       # Binary process management
│   │   ├── ProxyService.js         # HTTP/SOCKS5 proxy servers
│   │   ├── SystemProxyService.js   # System proxy configuration
│   │   └── DNSService.js           # DNS checking utilities
│   ├── orchestration/
│   │   └── ConnectionService.js    # Connection orchestration
│   └── presentation/
│       └── IPCController.js        # IPC routing
├── utils/                           # Shared utilities
│   ├── constants.js                # Ports, timeouts, etc.
│   └── helpers.js                  # Pure functions
└── index.html                       # UI (unchanged)
```

## Communication Patterns

### 1. Service Communication (Event-Driven)

```javascript
// Services emit events, don't call each other directly
eventEmitter.emit('service:started', { service: 'proxy', port: 8080 });

// Other services listen
eventEmitter.on('service:started', (data) => {
  logger.info(`Service ${data.service} started`);
  windowService.sendToRenderer('status-update', getStatus());
});
```

### 2. IPC Communication (Request/Response)

```javascript
// IPC Controller routes to services
ipcMain.handle('start-service', async (event, options) => {
  return await connectionService.start(options);
});

// Service returns structured response
{
  success: true,
  message: 'Service started',
  details: { /* status object */ }
}
```

### 3. Dependency Injection

```javascript
// main.js injects dependencies
const processManager = new ProcessManager(eventEmitter, logger);
const proxyService = new ProxyService(eventEmitter, logger, settingsService);
const connectionService = new ConnectionService({
  processManager,
  proxyService,
  systemProxyService,
  settingsService,
  eventEmitter,
  logger
});
```

## SOLID Principles Applied

### Single Responsibility Principle
Each service has ONE reason to change:
- `SettingsService` → Settings format changes
- `ProcessManager` → Binary interface changes
- `ProxyService` → Proxy protocol changes
- `SystemProxyService` → OS configuration changes

### Open/Closed Principle
Services are closed for modification but open for extension:
- Add new platform support by extending `SystemProxyService`
- Add new proxy type by extending `ProxyService`
- No need to modify existing code

### Liskov Substitution Principle
Services can be swapped:
- `MacSystemProxy` ↔ `WindowsSystemProxy` ↔ `LinuxSystemProxy`
- Any service implementing the same interface can replace another

### Interface Segregation Principle
Services expose only what clients need:
- `ProcessManager` doesn't expose settings methods
- `DNSService` doesn't expose connection methods
- Clients depend only on methods they use

### Dependency Inversion Principle
High-level modules depend on abstractions:
- `ConnectionService` depends on service interfaces, not implementations
- `IPCController` depends on service abstractions
- Easy to mock for testing

## Benefits

1. **Testability**: Each service can be unit tested in isolation
2. **Maintainability**: Changes are localized to specific services
3. **Scalability**: New features can be added without modifying existing code
4. **Readability**: Clear separation of concerns makes code easier to understand
5. **Reusability**: Services can be reused in different contexts
6. **Flexibility**: Services can be swapped or extended easily

## Migration Strategy

1. **Phase 1**: Create infrastructure (EventEmitter, Logger)
2. **Phase 2**: Extract data layer (SettingsService)
3. **Phase 3**: Extract business logic (ProcessManager, ProxyService, etc.)
4. **Phase 4**: Create orchestration (ConnectionService)
5. **Phase 5**: Create presentation layer (IPCController)
6. **Phase 6**: Refactor main.js to use new services

## Backward Compatibility

- All IPC handler names remain the same
- Response formats remain unchanged
- UI (index.html) requires NO changes
- Settings format remains compatible

## Next Steps

1. Review and approve this architecture
2. Create the folder structure
3. Implement services one by one
4. Update main.js to use services
5. Test all functionality

---

**Questions?** Please review this architecture and provide feedback before implementation begins.
