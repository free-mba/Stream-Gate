# Building Stream Gate (Client for Slipstream Plus)

## Quick Start

1. **Install dependencies** (one-time setup):
```bash
bun install
```

This will download:
- Electron
- electron-builder
- All required npm packages (socks-proxy-agent, socks, system-proxy)

2. **Build the application**:

For macOS:
```bash
bun run build:mac
```

For Windows:
```bash
bun run build:win
```

For both platforms:
```bash
bun run build:all
```

3. **Output**: Built applications will be in the `dist/` folder:
   - macOS: `Stream-Gate-macOS-1.0.0.dmg`
   - Windows: `Stream-Gate-Windows-Setup-1.0.0.exe`

## What Gets Bundled

The built applications are **completely self-contained**:
- ✅ Electron runtime (during migration)
- ✅ All Node.js dependencies
- ✅ Slipstream Plus client binaries (Mac & Windows)
- ✅ No internet connection required to run

Users can install and use the app without any additional downloads or setup.

## Development Mode

To test the app during development:
```bash
bun start
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
- ✅ `binaries/stream-client` is bundled inside the app
- ✅ Users never see these files
- ✅ No terminal commands needed
- ✅ No chmod or permission setup needed
- ✅ App automatically handles all permissions

## Troubleshooting

### Build fails with permission errors
- The app automatically sets execute permissions on first run
- For development: `chmod +x binaries/stream-client`

### Missing dependencies
- Run `bun install` again
- Check that all dependencies in `package.json` are installed

### App doesn't find client binary
- Make sure the binaries are present under `binaries/`
- Check the build logs to see if files were copied correctly
- The app automatically finds binaries in the Resources folder when packaged
