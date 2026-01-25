# SlipStream GUI

<div align="center">
  <img src="intro.png" alt="SlipStream GUI" width="400">
</div>

<div align="center">
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-blue?style=for-the-badge" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/Version-1.0.0-orange?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=for-the-badge" alt="Node.js">
  <a href="https://github.com/mirzaaghazadeh/SlipStreeamGUI/releases/latest">
    <img src="https://img.shields.io/github/v/release/mirzaaghazadeh/SlipStreeamGUI?style=for-the-badge&label=Latest%20Release" alt="Latest Release">
  </a>
  <img src="https://img.shields.io/github/actions/workflow/status/mirzaaghazadeh/SlipStreeamGUI/release.yml?style=for-the-badge&label=Build" alt="Build Status">
</div>

<br>

<div align="center">
  <strong>A modern, cross-platform GUI client for SlipStream VPN</strong><br>
  Provides secure, system-wide tunneling through an HTTP proxy interface
</div>

---

## 📥 Download & Install

### Latest Release

<div align="center">
  <a href="https://github.com/mirzaaghazadeh/SlipStreamGUI/releases/latest">
    <img src="https://img.shields.io/badge/Download-Latest%20Release-blue?style=for-the-badge&logo=github" alt="Download Latest Release">
  </a>
</div>

**Available for:**
- 🍎 macOS (DMG installer)
- 🪟 Windows (EXE installer)

### Quick Install

1. **Download** the latest release for your platform from the [Releases page](https://github.com/mirzaaghazadeh/SlipStreamGUI/releases/latest)
2. **Install** the application (double-click the installer)
3. **Run** the app and click "Start VPN"

That's it! No additional setup required.

---

## 🚀 Quick Start Guide

### First Time Setup

1. **Launch SlipStream GUI** after installation

2. **Configure Settings** (optional):
   - **DNS Resolver**: Your DNS server (default: `8.8.8.8:53`)
   - **Domain**: Your SlipStream server domain (default: `s.example.com`)
   - **System Proxy**: Toggle to auto-configure system proxy (recommended)

3. **Start the VPN**:
   - Click the **"Start VPN"** button
   - Wait for status indicators to show "Running"
   - Your traffic is now routed through SlipStream!

### Using the VPN

- **Status Panel**: Monitor connection status in real-time
- **Logs Panel**: View connection activity and debug information
- **Verbose Logging**: Toggle detailed logs for troubleshooting
- **Test Connection**: Use the "Test Proxy Connection" button to verify functionality
- **Stop VPN**: Click "Stop VPN" when you want to disconnect

### Setting Up a SlipStream Server

To use SlipStream GUI, you need a SlipStream server running. For detailed instructions on deploying your own SlipStream server, check out:

🔗 **[slipstream-rust-deploy](https://github.com/AliRezaBeigy/slipstream-rust-deploy)**

This repository provides a one-click deployment script for setting up a SlipStream server, including:

- ✅ **One-command installation**: Automated server deployment
- ✅ **DNS configuration guide**: Step-by-step DNS setup instructions
- ✅ **Multiple deployment modes**: SOCKS proxy or SSH tunneling
- ✅ **Prebuilt binaries**: Fast installation for supported platforms
- ✅ **Systemd integration**: Automatic service management
- ✅ **TLS certificates**: Automatic certificate generation

**Quick Server Setup:**

```bash
# One-command server installation
bash <(curl -Ls https://raw.githubusercontent.com/AliRezaBeigy/slipstream-rust-deploy/master/slipstream-rust-deploy.sh)
```

**What You'll Need:**
- A Linux server (Fedora, Rocky, CentOS, Debian, or Ubuntu)
- A domain name with DNS access
- Root or sudo access on the server

**After Server Setup:**
1. Configure your DNS records (see the [slipstream-rust-deploy](https://github.com/AliRezaBeigy/slipstream-rust-deploy) repository for detailed DNS setup)
2. Wait for DNS propagation (can take up to 24 hours)
3. In SlipStream GUI, enter your server domain (e.g., `s.example.com`)
4. Enter your DNS resolver (e.g., `YOUR_SERVER_IP:53`)
5. Click "Start VPN" to connect!

---

## ✨ Features

- 🖥️ **Cross-Platform**: Native support for macOS and Windows
- 🔒 **System-Wide VPN**: Routes all traffic through SlipStream VPN
- 🎨 **Modern GUI**: Intuitive interface with real-time status and logs
- ⚙️ **Auto-Configuration**: Automatically configures system proxy settings
- 📦 **Self-Contained**: All dependencies bundled (no internet required after installation)
- 🔍 **Verbose Logging**: Optional detailed logging for debugging
- 🧪 **Connection Testing**: Built-in proxy connection tester
- 📊 **Real-Time Status**: Monitor VPN connection status at a glance

---

## 🐛 Troubleshooting

### VPN won't start

- Check that ports 8080 and 5201 are not in use
- Verify your DNS resolver and domain settings
- Check the logs panel for error messages

### System proxy not working

- Ensure the "Configure System Proxy" toggle is enabled
- On macOS, you may be prompted for administrator password
- Some apps may bypass system proxy (configure them manually)

### Connection issues

- Use the "Test Proxy Connection" button to verify functionality
- Enable verbose logging for detailed connection information
- Check that your SlipStream server domain is correct

---

## 👨‍💻 For Developers

### Prerequisites

- Node.js 16+ and npm
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/mirzaaghazadeh/SlipStreamGUI.git
cd SlipStreamGUI

# Install dependencies
npm install
```

### Development

```bash
# Run in development mode
npm start
```

### Building

```bash
# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win

# Build for both platforms
npm run build:all
```

Built applications will be in the `dist/` folder.

For detailed build instructions, see [BUILD.md](BUILD.md).

---

## 📖 How It Works

SlipStream GUI creates a multi-layer proxy architecture:

```
Your Applications
    ↓ HTTP/HTTPS
HTTP Proxy Server (127.0.0.1:8080)
    ↓ SOCKS5 Protocol
SOCKS5 Client (127.0.0.1:5201)
    ↓ Encrypted Tunnel
SlipStream VPN Server
```

### Architecture

1. **SlipStream Client**: Runs the native binary (`slipstream-client-mac` or `slipstream-client-win.exe`) that establishes a SOCKS5 proxy on port 5201
2. **HTTP Proxy Server**: Node.js server listening on port 8080 that converts HTTP requests to SOCKS5
3. **System Proxy**: Automatically configures system proxy settings to route all traffic through the VPN

---

## 📁 Project Structure

```
SlipStream-GUI/
├── assets/              # App icons and images
│   └── icon.png
├── main.js              # Electron main process
├── index.html           # UI and renderer process
├── check-system-proxy.js # System proxy status checker
├── package.json         # Dependencies and build config
├── BUILD.md            # Detailed build instructions
├── README.md           # This file
└── .gitignore          # Git ignore rules
```

For detailed project structure, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

---

## 🔧 Technical Details

### Technologies

- **Electron**: Cross-platform desktop framework
- **Node.js**: Backend runtime
- **HTTP Proxy**: Node.js HTTP module for proxy server
- **SOCKS5**: Protocol for VPN tunneling
- **IPC**: Inter-process communication between main and renderer

### Ports

- **8080**: HTTP Proxy Server
- **5201**: SOCKS5 Proxy (SlipStream client)

### Configuration

Settings are stored in `settings.json` (created automatically):
- DNS Resolver
- Domain
- Verbose logging preference

---

## 📝 Requirements

- **macOS**: 10.13+ (High Sierra or later)
- **Windows**: Windows 10 or later
- **No special privileges**: Works immediately after installation
- **No internet required**: After installation, everything is self-contained

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

For detailed contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Related Projects

- **[slipstream-rust-deploy](https://github.com/AliRezaBeigy/slipstream-rust-deploy)**: Deploy your own SlipStream server

---

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- Uses [electron-builder](https://www.electron.build/) for packaging

---

<div align="center">
  <strong>Made with ❤️ for those we remember</strong>
</div>
