# Simple English Guide

<div align="center">
  <strong>Stream Gate User Guide</strong><br>
  A simple GUI for connecting to Stream Gate VPN
</div>

---

## 👀 Quick Tour

- **Download & install** the app from the Releases page
- **Set your server** (`Domain`) and **DNS Resolver** (if needed)
- **DNS Checker (optional)**: run it, and click **"Use"** on any **OK** row to set your `DNS Resolver`
- **Start VPN** with the **"Start VPN"** button and make sure statuses show **Running**
- **Verify** with **"Test Proxy Connection"** and check Logs if needed
- **Optional**: Share your VPN over Wi‑Fi to your phone using the built-in HTTP proxy (`8080`)

---

## 📥 Install & Setup

### Download & Install

1. Go to the latest release on GitHub:
   - [Releases (latest)](https://github.com/free-mba/Stream-Gate/releases/latest)
2. Direct downloads (latest release):

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Stream Gate-GUI-macOS-ARM64.dmg](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream Gate-GUI-macOS-ARM64.dmg) |
| macOS (Intel) | [Stream Gate-GUI-macOS-Intel.dmg](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream Gate-GUI-macOS-Intel.dmg) |
| Windows (64-bit) | [Stream Gate-GUI-Windows-x64.exe](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream Gate-GUI-Windows-x64.exe) |
| Windows (32-bit) | [Stream Gate-GUI-Windows-x86.exe](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream Gate-GUI-Windows-x86.exe) |
| Linux (x86_64) AppImage | [Stream Gate-GUI-Linux-x64.AppImage](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream Gate-GUI-Linux-x64.AppImage) |
| Linux (x86_64) DEB | [Stream Gate-GUI-Linux-x64.deb](https://github.com/free-mba/Stream-Gate/releases/latest/download/Stream Gate-GUI-Linux-x64.deb) |

If a direct download fails, use the [Releases page](https://github.com/free-mba/Stream-Gate/releases/latest).

### First Run

1. Open **Stream Gate**
2. (Optional) Configure:
   - **DNS Resolver**: your DNS server (default: `8.8.8.8:53`)
   - **Domain**: your Stream Gate server domain (default: `s.example.com`)
   - **System Proxy**: enable auto system proxy configuration (recommended)
3. Click **"Start VPN"**
4. Wait until statuses show **Running**
5. Your internet traffic is now routed through Stream Gate.

### 🔎 DNS Checker (optional)

If you’re not sure which DNS Resolver to use (or DNS hasn’t fully propagated yet), use **DNS Checker**:

1. Click **"DNS Checker"**
2. Enter a **test domain** (example: `google.com`)
3. Enter one or more **DNS server IPs** to test
4. Read the results:
   - **OK means OK** (no action needed)
   - The **"Use"** button is enabled only for **OK** rows
5. Click **"Use"** to auto-set your **DNS Resolver** (the app forces port `53`)

---

## 🖥️ Stream Gate Server Setup

To use Stream Gate, you need a Stream Gate server. You can deploy your own server or use an existing one.

### Simple server install (one command)

```bash
bash <(curl -Ls https://raw.githubusercontent.com/AliRezaBeigy/Stream Gate-rust-deploy/master/Stream Gate-rust-deploy.sh)
```

### Server prerequisites

- A Linux server (Fedora, Rocky, CentOS, Debian, or Ubuntu)
- A domain name with DNS access
- Root or sudo access on the server

### After server setup

1. Configure your DNS records (see [Stream Gate-rust-deploy](https://github.com/AliRezaBeigy/Stream Gate-rust-deploy))
2. Wait for DNS propagation (can take up to 24 hours)
3. In Stream Gate, enter your domain (example: `s.example.com`)
4. Enter your DNS resolver (example: `YOUR_SERVER_IP:53`)
5. Click **"Start VPN"**

---

## 📱 Share PC Internet to Mobile (Same Wi‑Fi)

If your PC and phone are on the same Wi‑Fi network, you can configure your phone to use your PC’s internet (including the VPN) via the built-in HTTP proxy.

### Prerequisites

- PC and phone must be on the same Wi‑Fi network
- Stream Gate must be running with VPN started
- You need your PC’s local IP address

### Find your PC’s local IP

**macOS/Linux:**

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
# or
ip addr show
```

**Windows:**

```cmd
ipconfig
```

Your IP will usually look like `192.168.1.XXX` or `10.0.0.XXX`.

### iOS (iPhone/iPad)

1. **Settings** → **Wi‑Fi**
2. Tap **(i)** next to your connected network
3. Scroll to **HTTP Proxy**
4. Select **Manual**
5. Set **Server** = your PC IP (example: `192.168.1.100`)
6. Set **Port** = `8080`
7. Leave **Authentication** off
8. Tap **Save**

To disable later: set **HTTP Proxy** back to **Off**.

### Android

1. **Settings** → **Wi‑Fi**
2. Long-press your connected network
3. Select **Modify network** / **Network details**
4. Open **Advanced options**
5. Set **Proxy** = **Manual**
6. **Proxy hostname** = your PC IP (example: `192.168.1.100`)
7. **Proxy port** = `8080`
8. Tap **Save**

To disable later: set Proxy back to **None**.

### ⚠️ Important notes

- Ensure your firewall allows inbound connections on port `8080`
- This only works while both devices are on the same network
- If your PC IP changes, update the phone proxy settings
- Some apps may ignore system proxy settings and need per-app configuration

---

## 🎯 Using the VPN

### Status panel

- Watch live connection status
- Check the 3 indicators:
  - **Stream Gate Client**
  - **HTTP Proxy**
  - **System Proxy**

### Logs panel

- View connection activity and debug info
- Enable **Verbose Logging** for more details

### Test connection

- Use **"Test Proxy Connection"** to verify the proxy is working

### Stop VPN

- Click **"Stop VPN"** to disconnect
- System proxy should be disabled automatically

---

## ❓ FAQ

### macOS: app shows “damaged”

This is usually Gatekeeper quarantine. Fix:

```bash
xattr -cr /Applications/Stream Gate\ GUI.app
```

### VPN won’t start

- Check ports `8080` and `5201` are not in use
- Verify `DNS Resolver` and `Domain`
- Check Logs for errors
- On Windows, run as Administrator

### System proxy not working

- Make sure “Configure System Proxy” is enabled
- On macOS, you may be asked for admin password
- On Windows, run as Administrator
- Some apps may bypass system proxy

---

<div align="center">
  <strong>Made for those we remember</strong>
</div>

