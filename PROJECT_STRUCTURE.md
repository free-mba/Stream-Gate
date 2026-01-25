# Project Structure

This document describes the structure of the SlipStream GUI project.

## Directory Layout

```
SlipStream-GUI/
├── .github/                    # GitHub templates and workflows
│   ├── ISSUE_TEMPLATE/        # Issue templates
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
├── assets/                     # Static assets
│   └── icon.png               # Application icon (1024x1024 PNG)
├── main.js                     # Electron main process
├── index.html                  # UI and renderer process
├── check-system-proxy.js       # System proxy status checker
├── tun-manager.js              # TUN interface manager (legacy, not used)
├── package.json                # Dependencies and build configuration
├── .gitignore                  # Git ignore rules
├── .npmrc                      # npm configuration
├── LICENSE                     # MIT License
├── README.md                   # Main documentation
├── BUILD.md                    # Detailed build instructions
├── CONTRIBUTING.md             # Contribution guidelines
├── PROJECT_STRUCTURE.md         # This file
├── intro.png                   # Intro modal image
├── binaries/                   # Native SlipStream client binaries (required for build)
│   ├── slipstream-client-mac-arm64   # macOS (Apple Silicon)
│   ├── slipstream-client-mac-intel   # macOS (Intel)
│   ├── slipstream-client-linux       # Linux
│   └── slipstream-client-win.exe     # Windows
└── (other files)
```

## Key Files

### Core Application

- **main.js**: Electron main process
  - Window management
  - IPC handlers
  - SlipStream client process management
  - HTTP proxy server
  - System proxy configuration

- **index.html**: Renderer process
  - UI layout and styling
  - User interactions
  - Status display
  - Logs panel
  - Settings management

### Configuration

- **package.json**: Project metadata, dependencies, and build configuration
- **.gitignore**: Files to exclude from version control
- **.npmrc**: npm configuration

### Documentation

- **README.md**: Main project documentation
- **BUILD.md**: Detailed build instructions
- **CONTRIBUTING.md**: Guidelines for contributors
- **LICENSE**: MIT License

### Assets

- **assets/icon.png**: Application icon (1024x1024 PNG)
- **intro.png**: Introduction modal image

### Binaries

- **binaries/slipstream-client-mac-arm64**: macOS SlipStream client (Apple Silicon)
- **binaries/slipstream-client-mac-intel**: macOS SlipStream client (Intel)
- **binaries/slipstream-client-linux**: Linux SlipStream client
- **binaries/slipstream-client-win.exe**: Windows SlipStream client

**Note**: These binaries are required for the build process and should be committed to the repository.

## Build Output

When building, the following directories are created:

- **dist/**: Contains built installers (DMG for macOS, EXE for Windows)
- **node_modules/**: npm dependencies (excluded from git)

## Development vs Production

### Development (`npm start`)
- Reads binaries from project root
- Uses `__dirname` for file paths
- Hot reloading available

### Production (Built App)
- Binaries are in `Resources/` folder (via `extraResources`)
- Uses `process.resourcesPath` for file paths
- All dependencies bundled in app package

## Important Notes

1. **Binaries**: The SlipStream client binaries must be in `binaries/` for the build to work.

2. **Settings**: User settings are stored in `settings.json` (excluded from git via .gitignore).

3. **Build Artifacts**: The `dist/` folder contains build outputs and should not be committed.

4. **Dependencies**: All npm packages are in `node_modules/` (excluded from git).
