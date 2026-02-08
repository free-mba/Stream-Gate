# Project Structure

This document describes the structure of the Stream Gate project (Tauri + React + Rust).

## Directory Layout

```
Stream-Gate/
├── .github/                    # GitHub templates and workflows
│   ├── ISSUE_TEMPLATE/        # Issue templates
│   └── workflows/              # CI/CD workflows (release.yml, etc.)
├── assets/                     # Static assets (icons)
├── binaries/                   # Sidecar binaries (downloaded via script)
│   ├── stream-client-mac-arm64
│   ├── stream-client-mac-intel
│   ├── stream-client-linux
│   └── stream-client-win.exe
├── dist/                       # Build output directory
├── public/                     # Public static files
├── scripts/                    # Utility scripts (download/verify binaries)
├── src-tauri/                  # Rust Backend (Tauri Core)
│   ├── src/
│   │   ├── commands/           # IPC command handlers
│   │   ├── main.rs             # Application entry point
│   │   └── lib.rs              # Shared library code
│   ├── Cargo.toml              # Rust dependencies
│   ├── tauri.conf.json         # Tauri configuration
│   └── capabilities/           # Security capabilities
├── src/                        # Frontend Source (React/TypeScript)
│   └── start-renderer/         # Main renderer code
│       ├── src/
│       │   ├── features/       # Feature-based modules (Settings, Logs)
│       │   ├── services/       # Frontend services (IPC, etc.)
│       │   ├── store/          # State management
│       │   └── Main.tsx        # App entry point
├── index.html                  # HTML entry point
├── package.json                # NPM dependencies
├── README.md                   # Main documentation
├── BUILD.md                    # Build instructions
└── PROJECT_STRUCTURE.md        # This file
```

## Key Components

### Backend (`src-tauri`)
- **`main.rs`**: Entry point, initializes the Tauri runtime.
- **`commands/`**: Contains Rust functions exposed to the frontend via `#[tauri::command]`.
- **`tauri.conf.json`**: Configures windows, permissions, bundle settings, and sidecars.

### Frontend (`src/start-renderer`)
- **`Main.tsx`**: The root React component.
- **`features/`**: Contains UI components organized by feature (e.g., `Config`, `Settings`).
- **`services/IpcService.ts`**: Handles communication with the Rust backend.

### Binaries
External binaries (Sidecars) are stored in `binaries/` and bundled with the app. They are not committed to Git but are downloaded/verified via scripts in `scripts/`.
