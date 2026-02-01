# Stream Gate Architecture

> **Note**: This document provides a detailed technical overview of the Stream Gate application.

## 🏗 High-Level Overview

Stream Gate is a modern, cross-platform GUI for the Stream Gate VPN client. It is built using **Electron** for the desktop shell and **React** for the user interface. The application follows a **Service Layer Pattern** in the backend (Electron Main process) to decouple business logic from the presentation layer.

### Technology Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | React 19, Vite, Tailwind CSS, Radix UI (shadcn), Jotai, Framer Motion |
| **Backend** | Electron, Node.js, `http-proxy`, `socks`, `ip` |
| **Core Engine** | Pre-compiled binary (`stream-client`) written in Go/Rust |
| **Storage** | JSON-based local storage (`settings.json`) |

---

## 🖥 Frontend Architecture (Renderer)

The frontend is a Single Page Application (SPA) located in the `/ui` directory.

### Key Components

*   **Router**: `react-router-dom` manages navigation between views:
    *   `/` (Home): Main connection toggle and status.
    *   `/config`: Server management (Import/Export).
    *   `/dns`: Advanced DNS performance tester.
    *   `/settings`: Application preferences.

*   **State Management (Jotai)**:
    *   We use **Jotai** (`ui/src/store.ts`) for atomic state management.
    *   **Atoms**: `configAtom`, `connectionStatusAtom`, `trafficAtom`, `languageAtom`.
    *   **Performance**: The DNS Tester uses `splitAtom` to render high-frequency updates for individual table rows without re-rendering the entire list.

*   **Internationalization (i18n)**:
    *   Custom hook `useTranslation` (`ui/src/lib/i18n.ts`).
    *   Supports **English (LTR)** and **Persian (RTL)**.
    *   The entire UI dynamically adjusts direction (`dir="rtl"`) and layout based on the selected language.

*   **Styling**:
    *   **Tailwind CSS**: Utility-first styling.
    *   **Dark Mode**: Native support via `dark` class on the root element.
    *   **Animations**: Framer Motion for smooth transitions (modals, page transitions).

---

## ⚙️ Backend Architecture (Main Process)

The backend is orchestrator for the system-level operations. It resides in the `/services` directory and is initialized in `main.js`.

### Service Layer Pattern

The backend is structured into distinct services with clear responsibilities, managed via Dependency Injection (DI).

| Service | Responsibility | Dependencies |
|---------|----------------|--------------|
| `IPCController` | Routes IPC messages from Frontend to Services. | All Services |
| `ConnectionService` | Orchestrates the "Connect" flow (Start Proxy -> Start Bin -> Set System). | `ProcessManager`, `ProxyService`, `SystemProxyService` |
| `ProcessManager` | Manages the lifecycle (spawn/kill) of the `stream-client` binary. | `EventEmitter`, `Logger` |
| `ProxyService` | Runs an internal HTTP proxy that chains to the SOCKS5 connection. | `http-proxy`, `net` |
| `SystemProxyService` | Configures the OS (Windows/Mac/Linux) to use the local proxy. | `child_process` (sys commands) |
| `SettingsService` | Persists configuration to `settings.json`. | `Logger` |
| `DNSService` | Logic for testing DNS servers (latency, compatibility). | `Logger` |

### IPC Communication

Communication between React and Electron uses the `contextBridge` for security.

1.  **Renderer**: Calls `window.electron.invoke('start-service', config)`.
2.  **Main (IPCController)**: Listens for `start-service`, calls `connectionService.start()`.
3.  **Main (ConnectionService)**:
    *   Starts Internal Proxy.
    *   Spawns `stream-client` binary.
    *   Sets System Proxy.
    *   Emits `status-update`.
4.  **Renderer**: Receives `status-update` via `window.electron.on(...)` and updates Jotai state.

---

## 🚀 Key Features Implementation

### 1. Connection Flow
When a user clicks "CONNECT":
1.  **Validation**: Setup checks if a valid configuration is selected.
2.  **Binary Execution**: `ProcessManager` spawns the platform-specific binary from `/binaries`.
3.  **Log Streaming**: stdout/stderr from the binary are streamed to the UI via IPC.
4.  **System Proxy**: If enabled, `SystemProxyService` executes OS commands (`networksetup` on macOS, registry on Windows) to route system traffic through the local HTTP proxy port.

### 2. DNS Tester
The DNS Tester (`DNSService`) is a standout feature with an 85% detection rate for compatible servers.
*   **Mechanism**: It attempts to resolve a specific domain through a list of potential DNS servers via the VPN tunnel.
*   **Parallelism**: Tests run in parallel batches to speed up processing.
*   **Verification**: It validates the response to ensure the DNS is not just creating a false positive (poisoning).

### 3. Configuration Management
*   **Format**: Supports `ssgate://` custom URI scheme.
*   **Base64**: Configs use a custom Base64-encoded format containing server details and keys.
*   **Storage**: Saved in `settings.json` in the user's `userData` directory.

### 4. Traffic Monitoring
*   The backend monitors the bytes flowing through the internal `ProxyService`.
*   It emits `traffic-update` events every second.
*   The frontend visualizes this as Download/Upload speed.

---

## 📁 Directory Structure Breakdown

```
Stream-Gate/
├── binaries/           # Platform-specific executables (git-ignored mostly)
├── docs/               # Documentation
├── scripts/            # Build and utility scripts
├── services/           # Backend Logic (Node.js)
│   ├── business/       # DNS, Process, Proxy, SystemProxy logic
│   ├── core/           # EventEmitters, Loggers
│   ├── data/           # Settings persistence
│   ├── infrastructure/ # Window management
│   ├── orchestration/  # Connection workflows
│   └── presentation/   # IPC Controllers
├── ui/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── pages/      # Route pages
│   │   ├── store.ts    # Jotai state definitions
│   │   └── lib/        # Utilities (i18n, utils)
├── main.js             # Electron Entry Point
└── package.json        # Project manifest
```
