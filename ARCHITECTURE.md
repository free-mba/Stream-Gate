# System Architecture

## Overview

Stream Gate is a cross-platform VPN client and proxy tool built using **Tauri**. It leverages a **Rust** backend for high-performance system operations and networking, and a **React/TypeScript** frontend for the user interface.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Tauri Core (Rust)                         │
│  - System Tray Management                                       │
│  - Global Shortcut Handling                                     │
│  - Window Management                                            │
│  - Native System Integrations                                   │
└─────────────────────────────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   IPC Commands  │  │   System Tray   │  │ Lifecycle Mgr   │
│  - Invoke Handlers │  │  - Menu events  │  │  - App start    │
│  - Events (emit)│  │  - Status updates│  │  - Cleanup      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Frontend (React)                          │
│  - User Interface (Settings, Logs, Connection Status)           │
│  - IPC Communication (via @tauri-apps/api)                      │
│  - State Management                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Module Breakdown

### 1. Rust Backend (`src-tauri`)

The backend is responsible for all privileged and heavy operations.

#### **Core Components**
- **`main.rs`**: The entry point. Initializes Tauri, setup handlers, and runs the application loop.
- **`lib.rs`**: Library entry point, exposing the `run` function used by mobile targets (if applicable).
- **`commands`**: Modules defining callable Tauri commands (IPC handlers).

#### **Services**
- **Proxy Service**: Manages the local HTTP/SOCKS5 proxy servers.
- **VPN Service**: Handling TUN/TAP interfaces (future scope) or managing external VPN binaries.
- **DNS Service**: Resolves domains and performs connectivity checks using `trust-dns-resolver`.

### 2. Frontend (`src/start-renderer`)

The frontend is a Single Page Application (SPA) built with React.

#### **Key Areas**
- **`features/`**: Feature-based folder structure (e.g., `Config`, `Logs`, `Settings`).
- **`services/IpcService.ts`**: Abstraction layer over Tauri's IPC `invoke` calls.
- **`store/`**: Global state management (Zustand/Redux).

## Communication

### IPC (Inter-Process Communication)
Communication between the Frontend and Backend happens via Tauri's IPC mechanism:
1.  **Commands**: Frontend calls `invoke('command_name', { args })` -> Backend executes function -> Returns `Result`.
2.  **Events**: Backend emits events (e.g., `log://log`) -> Frontend listens via `listen()`.

### Data Persistence
- **Settings**: Stored in `settings.json` in the platform-specific app data directory, managed by the Rust backend.

## Build System

- **Frontend**: Built using `vite` (or compatible bundler through `bun`).
- **Backend**: Built using `cargo`.
- **Bundling**: `tauri build` orchestrates the entire process, producing `.dmg`, `.exe`, or `.AppImage`.
