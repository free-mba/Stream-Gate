# Release Guide

This document explains how to create a new release for Stream Gate.

## Automated Releases

Releases can be created in two ways:

### Method 1: Manual Trigger (Recommended)

1. Go to **Actions** tab on GitHub
2. Select **Release** workflow
3. Click **Run workflow**
4. Enter the version number (e.g., `1.0.0`)
5. Click **Run workflow** button

GitHub Actions will automatically:
- Build the app for macOS and Windows
- Create a GitHub release with tag `v1.0.0`
- Upload the DMG and EXE installers
- Generate release notes

### Method 2: Tag Push

1. **Update version** in `package.json`:
   ```json
   "version": "1.0.0"
   ```

2. **Commit and push** your changes:
   ```bash
   git add package.json
   git commit -m "Bump version to 1.0.0"
   git push
   ```

3. **Create and push a tag**:
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```

4. **GitHub Actions will automatically**:
   - Build the app for macOS and Windows
   - Create a GitHub release
   - Upload the DMG and EXE installers
   - Generate release notes

### Tag Format

Tags must follow the format: `v1.0.0` (with the `v` prefix)

Examples:
- `v1.0.0`
- `v1.0.1`
- `v2.0.0`

### What Gets Built

- **macOS**: DMG installers
  - `Stream Gate-GUI-macOS-ARM64.dmg`
  - `Stream Gate-GUI-macOS-Intel.dmg`
- **Windows**: NSIS installers
  - `Stream Gate-GUI-Windows-x64.exe`
  - `Stream Gate-GUI-Windows-x86.exe`
- **Linux**: AppImage and DEB packages
  - `Stream Gate-GUI-Linux-x64.AppImage`
  - `Stream Gate-GUI-Linux-x64.deb`

### Release Notes

The GitHub Actions workflow automatically generates release notes including:
- Version number
- Download links
- Quick start instructions
- Link to changelog

You can edit the release notes on GitHub after the release is created.

## Manual Release (Alternative)

If you need to create a release manually:

1. Build locally:
   ```bash
   npm run build:all
   ```

2. Go to GitHub → Releases → Draft a new release

3. Upload the files from `dist/` folder:
   - `Stream Gate-1.0.0.dmg` (macOS)
   - `Stream Gate Setup 1.0.0.exe` (Windows)

4. Write release notes and publish

## Troubleshooting
 
### macOS: "App is damaged and can’t be opened"

xattr: [Errno 1] Operation not permitted
```

The fix is to remove the quarantine attribute using `sudo`:

```bash
sudo xattr -cr /Applications/Stream\ Gate.app
```

**Alternative Fix (No Terminal):**
1. Right-click the app in Finder.
2. Select **Open**.
3. Click **Open** in the prompt.

### Build fails in GitHub Actions

- Check that `binaries/stream-client-mac-arm64` or `binaries/stream-client-mac-intel` has execute permissions
- Verify all required files are committed
- Check the Actions logs for specific errors

### Release not created

- Ensure the tag format is correct (`v*`)
- Check that the workflow has `contents: write` permission
- Verify the tag was pushed to the remote repository
