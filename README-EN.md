# Simple English Guide

<div align="center">
  <strong>Stream Gate Plus User Guide</strong><br>
  An optimized GUI client for connecting to Slipstream Plus servers
</div>

---

## 👀 Quick Tour (Plus Version)

- **Download & install** the app from the Releases page
- **Set your server** (`Domain`) and **DNS Resolver** (e.g., `8.8.8.8:53`)
- **Slipstream Plus Core**: Now powered by **Tauri + Rust** for maximum performance and stability.
- **DNS Checker (optional)**: run it, and click **"Use"** on any **OK** row to set your `DNS Resolver`
- **Start VPN** with the **"Connect"** button and make sure statuses show **Connected**
- **Verify** with **"Test Proxy Connection"** and check Logs if needed
- **Optional**: Share your VPN over Wi‑Fi to your phone using the built-in HTTP proxy (`8080`)

---

## 📥 Install & Setup

### Download & Install

1. Go to the latest release on GitHub:
   - [Releases (v1.0.0)](https://github.com/free-mba/Stream-Gate/releases/latest)
2. Direct downloads (v1.0.0):

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Stream-Gate-macOS-ARM64.dmg](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream-Gate-macOS-ARM64.dmg) |
| macOS (Intel) | [Stream-Gate-macOS-Intel.dmg](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream-Gate-macOS-Intel.dmg) |
| Windows (64-bit) | [Stream-Gate-Windows-x64.exe](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream-Gate-Windows-x64.exe) |
| Linux (x86_64) AppImage | [Stream-Gate-Linux-x64.AppImage](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream-Gate-Linux-x64.AppImage) |
| Linux (x86_64) DEB | [Stream-Gate-Linux-x64.deb](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream-Gate-Linux-x64.deb) |
| Android | [SlipNet](https://github.com/anonvector/SlipNet) (Recommended Client) |

### First Run

1. Open **Stream Gate**
2. (Optional) Configure:
   - **DNS Resolver**: a public DNS server (default: `8.8.8.8:53`)
   - **Domain**: your Slipstream Plus server domain (example: `s.example.com`)
   - **System Proxy**: enable auto system proxy configuration (recommended)
3. Click **"Connect"**
4. Wait until statuses show **Connected**
5. Your internet traffic is now routed through Stream Gate.

### 🔎 DNS Checker (optional)

If you’re not sure which DNS Resolver to use (or DNS hasn’t fully propagated yet), use **DNS Checker**:

1. Click **"DNS Checker"**
2. Enter a **test domain** (example: `google.com`)
3. Enter one or more **DNS server IPs** to test
4. Read the results:
   - **OK means OK** (no action needed)
   - The **"Use"** button is enabled only for **OK** rows
5. Click **"Use"** to auto-set your **DNS Resolver**

---

## 🚀 Advanced Networking

You can fine-tune the connection in the **Settings** page:

### Congestion Control
- **Auto (Default)**: Chooses the best algorithm based on your resolver mode (BBR for Authoritative, DCubic for Recursive).
- **BBR+ (Enhanced)**: The specialized Plus version algorithm. Great for unstable/wireless networks.
- **DCubic**: More aggressive. Good for stable/wired connections.

### QUIC Keep Alive
- Default is `400` seconds.
- Lower this (e.g., `30`) if you face frequent disconnects on mobile networks.

---

## 🖥️ Slipstream Plus Server Setup

To use Slipstream Plus, you need an optimized server.

### Optimized server install (one command)

```bash
bash <(curl -Ls https://raw.githubusercontent.com/Fox-Fig/slipstream-rust-plus-deploy/master/slipstream-rust-plus-deploy.sh)
```

### Server prerequisites

- A Linux server (Fedora, Rocky, CentOS, Debian, or Ubuntu)
- A domain name with DNS access
- Root or sudo access on the server

---

## 📱 Share PC Internet to Mobile (Same Wi‑Fi)

If your PC and phone are on the same Wi‑Fi network, you can configure your phone to use your PC’s internet (including the VPN) via the built-in HTTP proxy.

### Prerequisites
- PC and phone must be on the same Wi‑Fi network
- Stream Gate must be running with VPN started
- Find your PC’s IP: `ipconfig` (Windows) or `ifconfig` (macOS/Linux)

### iOS / Android
1. Go to Wi-Fi settings for your network.
2. Set **Proxy** to **Manual**.
3. **Hostname**: Your PC's IP (e.g., `192.168.1.100`).
4. **Port**: `8080`.
5. Save.

---

## ❓ FAQ

### macOS: app shows “damaged”

This is usually Gatekeeper quarantine. Fix:

```bash
xattr -cr /Applications/Stream\ Gate.app
```

### VPN won’t start

- Check ports `8080` and `5201` are not in use
- Verify `DNS Resolver` and `Domain`
- Check Logs for errors
- On Windows, run as Administrator

---

<div align="center">
  <strong>Made for those we remember</strong>
</div>
