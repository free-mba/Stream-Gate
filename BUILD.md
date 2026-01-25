# Building Slipstream VPN GUI

## Quick Start

1. **Install dependencies** (one-time setup):
```bash
npm install
```

This will download:
- Electron
- electron-builder
- All required npm packages (socks-proxy-agent, socks, system-proxy)

2. **Build the application**:

For macOS:
```bash
npm run build:mac
```

For Windows:
```bash
npm run build:win
```

For both platforms:
```bash
npm run build:all
```

3. **Output**: Built applications will be in the `dist/` folder:
   - macOS: `Slipstream VPN-1.0.0.dmg`
   - Windows: `Slipstream VPN Setup 1.0.0.exe`

## What Gets Bundled

The built applications are **completely self-contained**:
- ✅ Electron runtime
- ✅ All Node.js dependencies
- ✅ Slipstream client binaries (Mac & Windows)
- ✅ No internet connection required to run

Users can install and use the app without any additional downloads or setup.

## Development Mode

To test the app during development:
```bash
npm start
```

## Distribution

The built DMG (macOS) and EXE (Windows) installers can be distributed directly to users. They include everything needed to run the application.

## User Experience

**After Download:**
1. ✅ User downloads DMG/EXE installer
2. ✅ User installs (one click)
3. ✅ User runs the app
4. ✅ **Everything works automatically - no manual actions needed!**

**What's Hidden from Users:**
- ✅ `binaries/slipstream-client-mac-arm64` / `binaries/slipstream-client-mac-intel` / `binaries/slipstream-client-win.exe` are bundled inside the app
- ✅ Users never see these files
- ✅ No terminal commands needed
- ✅ No chmod or permission setup needed
- ✅ App automatically handles all permissions

## Troubleshooting

### Build fails with permission errors
- The app automatically sets execute permissions on first run
- For development: `chmod +x binaries/slipstream-client-mac-arm64` (or `binaries/slipstream-client-mac-intel`)

### Missing dependencies
- Run `npm install` again
- Check that all dependencies in `package.json` are installed

### App doesn't find slipstream client
- Make sure the binaries are present under `binaries/`:
  - `binaries/slipstream-client-mac-arm64`
  - `binaries/slipstream-client-mac-intel`
  - `binaries/slipstream-client-win.exe`
- Check the build logs to see if files were copied correctly
- The app automatically finds binaries in the Resources folder when packaged
