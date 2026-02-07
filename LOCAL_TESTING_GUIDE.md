# Local CI/CD Testing Guide

This guide explains how to test the GitHub Actions workflows (`ci.yml` and `release.yml`) on your local machine.

## Method 1: Using `act` (Recommended)

`act` (https://github.com/nektos/act) is a tool that allows you to run GitHub Actions locally using Docker.

### 1. Installation
On macOS, you can install it via Homebrew:
```bash
brew install act
```
*Note: You must have Docker installed and running.*

### 2. Running Workflows
To run the **CI** workflow:
```bash
act push
```

To run the **Release** workflow (simulating a tag):
```bash
act push --job build-and-release -s GITHUB_TOKEN=$(gh auth token)
```
*Note: The release workflow requires a GitHub token to download binaries from upstream. You can use your personal token or one from `gh auth token`.*

---

## Method 2: Manual Execution (Simplified)

If you don't want to use Docker/act, you can manually run the steps defined in the `release.yml`.

### 1. Setup Environment
Ensure you have `bun` installed.

### 2. Download Binaries
The release workflow fetches binaries from `Fox-Fig/slipstream-rust-plus-deploy`. You can do this manually:
```bash
bun run download:binaries
```
*This script is already configured in your `package.json` and fetches the same binaries.*

### 3. Build the UI
```bash
bun run build:ui
```

### 4. Build the Application
Depending on your platform:
- **macOS (Universal):** `bun run build:mac`
- **macOS (Apple Silicon):** `bun run build:mac:arm64`
- **Windows:** `bun run build:win`
- **Linux:** `bun run build:linux`

### 5. Check Output
Built installers will appear in the `dist/` directory.

---

## Critical Differences Locally vs. CI
1. **GitHub Context**: Many steps use `${{ github.token }}` or `${{ github.repository }}`. These variables won't be available unless you provide them (via `act` or manually).
2. **Environment**: CI runs in a fresh virtual machine. Locally, your existing `node_modules` and system configuration may affect the build.
3. **Artifacts**: The `upload-artifact` and `create-release` steps in `release.yml` will not work locally outside of `act` as they require GitHub's backend.
