# Architecture: Stream Gate

This document outlines the high-level architecture of the Stream Gate application, following the **Service-Oriented** pattern for the backend and **Feature-Based** architecture for the frontend.

## 1. System Overview

Stream Gate is an Electron-based application that acts as a GUI for the `stream-client` binary. It manages:
- **Process Lifecycle**: Starting/stopping the VPN core.
- **System Proxy**: Configuring macOS/Windows/Linux network settings.
- **IPC Communication**: Bridging the React Frontend and Node.js Backend.

### Directory Structure

```
/
├── src/
│   ├── start-main/           # Electron Main Process (Backend)
│   │   ├── main.js           # Entry Point
│   │   └── services/         # Business Logic Layer
│   │       ├── business/     # Setup logic (DNS, Proxy, Process)
│   │       ├── core/         # Utilities (Logger, Events)
│   │       ├── data/         # Persistence (Settings)
│   │       ├── infrastructure/ # OS interactions (Window)
│   │       ├── orchestration/  # Co-ordination (ConnectionService)
│   │       └── presentation/   # IPC Controllers
│   │
│   └── start-renderer/       # Vite/React Application (Frontend)
│       └── src/
│           ├── features/     # Feature Modules (Connection, Settings...)
│           ├── layouts/      # Layout components
│           ├── lib/          # Utilities
│           └── store/        # State Management (Jotai)
```

## 2. Backend Architecture (Service Layer)

The backend is built on **Dependency Injection (DI)**. Services are instantiated in `main.js` and injected into consumers.

- **Infrastructure Layer**: Handles low-level OS tasks (e.g., `WindowService` for Electron windows).
- **Data Layer**: Manages persistent state (`SettingsService`).
- **Business Layer**: Implements domain logic (e.g., `ProxyService` configures system proxy, `ProcessManager` spawns the binary).
- **Orchestration Layer**: Coordinates multiple services (`ConnectionService` uses `ProcessManager` and `ProxyService` to establish a connection).
- **Presentation Layer**: Exposes functionality to the frontend via `IPCController`.

**Key Pattern**: "The Middle Layer". The frontend never calls `exec` or internal logic directly. It sends strictly typed IPC messages which `IPCController` validates and routes to the appropriate Service.

## 3. Frontend Architecture (Feature-Based)

The frontend uses a **Feature-Based** directory structure to ensure scalability.

- **Features**: Each major domain (Connection, Settings, DNS Tester) is a self-contained module in `src/features/`.
- **State Management**: **Jotai** is used for atomic state management, avoiding prop-drilling.
- **Design System**: A custom "High-Luxury Glassmorphism" system using Tailwind CSS variables.

### Feature Module Structure
Each feature (e.g., `features/Connection`) contains:
- `components/`: UI components specific to this feature.
- `hooks/`: Business logic hooks (e.g., `useConnectionStatus`).
- `ConnectionPage.tsx`: The main view for the feature.

## 4. Concepts

- **[Slipstream](./Slipstream.md)**: The underlying protocol and binary.
- **[QUIC](./Quic.md)**: The transport layer used for high-performance connections.
- **[SOCKS5](./SOCKS5.md)**: The proxy protocol used for local traffic routing.
