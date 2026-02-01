# Stream Gate Architecture

## Overview
Stream Gate is an Electron-based application that provides a user-friendly interface for the Stream Gate VPN client. It allows users to manage configurations, test DNS servers, and toggle the VPN connection.

## System Components

### 1. Frontend (Renderer Process)
*   **Framework**: React 18 with Vite
*   **Styling**: Tailwind CSS + Shadcn UI
*   **State Management**: React State + Jotai (for performance-critical parts like DNS testing)
*   **Routing**: React Router DOM
*   **Communication**: `useIpc` hook wrapping `window.electron` API

### 2. Backend (Main Process)
*   **Entry Point**: `main.js`
*   **Service Layer**:
    *   `IPCController.js`: Routes IPC messages to appropriate services.
    *   `SettingsService.js`: Manages configuration persistence (`settings.json`).
    *   `WindowService.js`: Manages BrowserWindow lifecycle.
    *   `ProcessManager.js`: Manages the external Stream Gate binary.
    *   `ConnectionService.js`: High-level connection state management.
    *   `DnsService.js`: Handles DNS testing and validation.

### 3. External Binary
*   The application bundles the `stream-client` binary for different platforms (macOS, Windows, Linux).
*   It is spawned as a child process when the connection is toggled.

## Data Flow
1.  **User Action**: User clicks "Connect" in UI.
2.  **IPC Call**: `useIpc` invokes `start-service` event.
3.  **Main Process**: `IPCController` receives event, delegates to `ConnectionService`.
4.  **Process Management**: `ProcessManager` spawns the binary with arguments from `SettingsService`.
5.  **Feedback**: Logs and status updates are streamed back to UI via `status-update` and `log:message` events.

## Directory Structure
*   `/ui`: React frontend source.
*   `/services`: Backend service modules.
    *   `/business`: Core logic (Process, Connection).
    *   `/data`: Data access (Settings).
    *   `/infrastructure`: System interaction (Window, Logger).
    *   `/presentation`: IPC routing.
*   `/binaries`: Platform-specific executables.

## Security
*   IPC context isolation is enabled.
*   `settings.json` stores credentials locally.
*   SOCKS5 authentication is supported per-config or globally (global deprecated in UI).
