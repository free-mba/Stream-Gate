const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { SocksClient } = require('socks');
const httpProxy = require('http-proxy');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Set app name for macOS dock
app.setName('SlipStream GUI');

const HTTP_PROXY_PORT = 8080;
const SOCKS5_PORT = 5201;
const fs = require('fs');

// Default settings
let RESOLVER = '8.8.8.8:53';
let DOMAIN = 's.example.com';
let useTunMode = false; // Toggle between HTTP proxy and TUN mode
let verboseLogging = false; // Verbose logging toggle

// Load settings from file
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const settings = JSON.parse(data);
      if (settings.resolver) RESOLVER = settings.resolver;
      if (settings.domain) DOMAIN = settings.domain;
      if (settings.mode) useTunMode = (settings.mode === 'tun');
      if (settings.verbose !== undefined) verboseLogging = settings.verbose;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

function saveSettings(resolver, domain, mode, verbose) {
  try {
    const settings = { resolver, domain, mode };
    if (verbose !== undefined) {
      settings.verbose = verbose;
      verboseLogging = verbose;
    }
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    RESOLVER = resolver;
    DOMAIN = domain;
    if (mode) useTunMode = (mode === 'tun');
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

loadSettings();

let mainWindow;
let slipstreamProcess = null;
let httpProxyServer = null;
let isRunning = false;
let tunManager = null;
let systemProxyConfigured = false; // Track system proxy state

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const windowOptions = {
    width: 1200,
    height: 800,
    resizable: true,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  };
  
  // Set icon if it exists
  try {
    if (fs.existsSync(iconPath)) {
      windowOptions.icon = iconPath;
      console.log('Using icon:', iconPath);
      
      // On macOS, also set the dock icon (works in development)
      if (process.platform === 'darwin' && app.dock) {
        app.dock.setIcon(iconPath);
      }
    } else {
      console.log('Icon not found at:', iconPath);
    }
  } catch (err) {
    console.error('Error setting icon:', err);
  }
  
  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.loadFile('index.html');
  
  // Request admin privileges on macOS
  if (process.platform === 'darwin') {
    // Note: Electron doesn't automatically prompt for admin, but we can show a message
    // The networksetup commands will prompt for password when needed
  }
  
  // mainWindow.webContents.openDevTools(); // Uncomment for debugging
}

function getSlipstreamClientPath() {
  const platform = process.platform;
  // In packaged app, resources are in different location
  const resourcesPath = app.isPackaged 
    ? path.join(process.resourcesPath)
    : __dirname;
  
  if (platform === 'darwin') {
    return path.join(resourcesPath, 'slipstream-client-mac');
  } else if (platform === 'win32') {
    return path.join(resourcesPath, 'slipstream-client-win.exe');
  } else if (platform === 'linux') {
    return path.join(resourcesPath, 'slipstream-client-linux');
  }
  return null;
}

function startSlipstreamClient(resolver, domain) {
  const clientPath = getSlipstreamClientPath();
  if (!clientPath) {
    throw new Error('Unsupported platform');
  }

  // Ensure execute permissions on macOS and Linux (automatic, no user action needed)
  if ((process.platform === 'darwin' || process.platform === 'linux') && fs.existsSync(clientPath)) {
    try {
      // Check if file is executable, if not, make it executable
      fs.accessSync(clientPath, fs.constants.X_OK);
    } catch (err) {
      // File is not executable, set execute permission automatically
      fs.chmodSync(clientPath, 0o755);
      const binaryName = process.platform === 'darwin' ? 'slipstream-client-mac' : 'slipstream-client-linux';
      console.log(`Automatically set execute permissions on ${binaryName}`);
    }
  }

  const args = ['--resolver', resolver, '--domain', domain];
  
  slipstreamProcess = spawn(clientPath, args, {
    stdio: 'pipe',
    detached: false
  });

  slipstreamProcess.stdout.on('data', (data) => {
    console.log(`Slipstream: ${data}`);
    if (mainWindow) {
      mainWindow.webContents.send('slipstream-log', data.toString());
    }
    sendStatusUpdate();
  });

  slipstreamProcess.stderr.on('data', (data) => {
    const errorStr = data.toString();
    console.error(`Slipstream Error: ${errorStr}`);
    
    // Check for port already in use error
    if (errorStr.includes('Address already in use') || errorStr.includes('EADDRINUSE')) {
      console.warn('Port 5201 is already in use. Trying to kill existing process...');
      const { exec } = require('child_process');
      exec('lsof -ti:5201 | xargs kill -9 2>/dev/null', (err) => {
        if (!err) {
          console.log('Killed process using port 5201. Please restart the VPN.');
          if (mainWindow) {
            mainWindow.webContents.send('slipstream-error', 'Port 5201 was in use. Killed existing process. Please restart the VPN.');
          }
        }
      });
    }
    
    if (mainWindow) {
      mainWindow.webContents.send('slipstream-error', errorStr);
    }
    sendStatusUpdate();
  });

  slipstreamProcess.on('close', (code) => {
    console.log(`Slipstream process exited with code ${code}`);
    slipstreamProcess = null;
    if (mainWindow) {
      mainWindow.webContents.send('slipstream-exit', code);
    }
    sendStatusUpdate();
    if (isRunning) {
      stopService();
    }
  });

  return new Promise((resolve, reject) => {
    // Wait a bit for SOCKS5 to be ready
    setTimeout(() => {
      if (slipstreamProcess && !slipstreamProcess.killed) {
        sendStatusUpdate();
        resolve();
      } else {
        reject(new Error('Slipstream client failed to start'));
      }
    }, 2000);
  });
}

function sendStatusUpdate() {
  if (!mainWindow) return;
  
  const details = getStatusDetails();
  mainWindow.webContents.send('status-update', details);
}

function startHttpProxy() {
  return new Promise((resolve, reject) => {
    // Create SOCKS5 agent
    const socksAgent = new SocksProxyAgent(`socks5://127.0.0.1:${SOCKS5_PORT}`);
    const net = require('net');
    const https = require('https');
    const httpLib = require('http');
    
    // Create HTTP proxy server with custom CONNECT handling
    // Using 'connect' event for proper CONNECT method handling
    httpProxyServer = http.createServer();
    
    // Handle CONNECT requests separately (before they hit the request handler)
    httpProxyServer.on('connect', (req, clientSocket, head) => {
      const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const logRequest = (message, isError = false, isVerbose = false) => {
        // Skip verbose messages if verbose logging is disabled
        if (isVerbose && !verboseLogging) return;
        
        const logMsg = `[${requestId}] ${message}`;
        console.log(logMsg);
        if (mainWindow) {
          if (isError) {
            mainWindow.webContents.send('slipstream-error', logMsg);
          } else {
            mainWindow.webContents.send('slipstream-log', logMsg);
          }
        }
      };
      
      const urlParts = req.url.split(':');
      const host = urlParts[0];
      const port = parseInt(urlParts[1] || '443');
      
      logRequest(`🔒 CONNECT ${host}:${port} (HTTPS)`);
      
      // Connect through SOCKS5
      SocksClient.createConnection({
        proxy: {
          host: '127.0.0.1',
          port: SOCKS5_PORT,
          type: 5
        },
        command: 'connect',
        destination: {
          host: host,
          port: port
        }
      }).then((info) => {
        logRequest(`✅ SOCKS5 connected to ${host}:${port}`, false, true);
        
        const targetSocket = info.socket;
        
        // Send 200 response directly to client socket
        clientSocket.write('HTTP/1.1 200 Connection established\r\n\r\n');
        logRequest(`📤 Sent 200 Connection established`, false, true);
        
        // If there's any head data, write it to target
        if (head && head.length > 0) {
          targetSocket.write(head);
        }
        
        // Configure sockets
        clientSocket.setNoDelay(true);
        targetSocket.setNoDelay(true);
        
        // Error handlers
        const ignoreCodes = ['ECONNRESET', 'EPIPE', 'ECONNABORTED', 'ECANCELED', 'ETIMEDOUT'];
        clientSocket.on('error', (err) => {
          if (!ignoreCodes.includes(err.code)) {
            logRequest(`❌ Client error: ${err.code}`, true);
          }
        });
        
        targetSocket.on('error', (err) => {
          if (!ignoreCodes.includes(err.code)) {
            logRequest(`❌ Target error: ${err.code}`, true);
          }
        });
        
        // Close handlers
        clientSocket.on('close', () => {
          logRequest(`🔌 Client closed`, false, true);
          if (!targetSocket.destroyed) targetSocket.destroy();
        });
        
        targetSocket.on('close', () => {
          logRequest(`🔌 Target closed`, false, true);
          if (!clientSocket.destroyed) clientSocket.destroy();
        });
        
        // Pipe bidirectionally
        clientSocket.pipe(targetSocket, { end: false });
        targetSocket.pipe(clientSocket, { end: false });
        
        logRequest(`🔗 Tunnel active: ${host}:${port}`, false, true);
      }).catch((err) => {
        logRequest(`❌ CONNECT failed: ${err.message}`, true);
        clientSocket.write(`HTTP/1.1 500 Proxy Error\r\n\r\n${err.message}`);
        clientSocket.end();
      });
    });
    
    // Handle regular HTTP requests
    httpProxyServer.on('request', (req, res) => {
      // Debug logging
      const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const logRequest = (message, isError = false, isVerbose = false) => {
        // Skip verbose messages if verbose logging is disabled
        if (isVerbose && !verboseLogging) return;
        
        const logMsg = `[${requestId}] ${message}`;
        console.log(logMsg);
        if (mainWindow) {
          if (isError) {
            mainWindow.webContents.send('slipstream-error', logMsg);
          } else {
            mainWindow.webContents.send('slipstream-log', logMsg);
          }
        }
      };
      
      logRequest(`→ ${req.method} ${req.url}`, false, true);
      
      // Set timeout
      req.setTimeout(30000, () => {
        logRequest(`⏱️ Request timeout`, true);
        if (!res.headersSent) {
          res.writeHead(408);
          res.end('Request Timeout');
        }
      });
      
      // Handle regular HTTP requests (CONNECT is handled by 'connect' event above)
      {
        // Handle HTTP requests
        const url = require('url');
        
        // For HTTP proxy, browsers send absolute URLs in req.url
        // Format: "http://example.com/path" or "https://example.com/path"
        let targetUrl = req.url;
        let parsedUrl;
        
        // Check if it's already an absolute URL
        if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
          parsedUrl = url.parse(targetUrl);
        } else {
          // Relative URL - use Host header
          const host = req.headers.host || 'localhost';
          targetUrl = `http://${host}${targetUrl.startsWith('/') ? targetUrl : '/' + targetUrl}`;
          parsedUrl = url.parse(targetUrl);
        }
        
        const isHttps = parsedUrl.protocol === 'https:';
        const client = isHttps ? https : httpLib;
        
        // Build request options
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.path || '/',
          method: req.method,
          headers: {}
        };
        
        // Copy headers but clean them up
        for (const key in req.headers) {
          const lowerKey = key.toLowerCase();
          // Skip proxy-specific headers and connection headers
          if (lowerKey === 'host' || 
              lowerKey === 'proxy-connection' || 
              lowerKey === 'proxy-authorization' ||
              lowerKey === 'connection' ||
              lowerKey === 'upgrade' ||
              lowerKey === 'keep-alive') {
            continue;
          }
          options.headers[key] = req.headers[key];
        }
        
        // Set proper host header
        options.headers.host = parsedUrl.hostname + (parsedUrl.port ? ':' + parsedUrl.port : '');
        
          // Don't set connection header - let it be handled automatically
          // options.headers.connection = 'close';
          
          // Use SOCKS5 agent
          options.agent = socksAgent;
          
          // Set timeout
          options.timeout = 30000;
        
        logRequest(`🌐 HTTP ${req.method} ${parsedUrl.hostname}${parsedUrl.path || '/'} via SOCKS5`, false, true);
        
        const proxyReq = client.request(options, (proxyRes) => {
          logRequest(`📥 Response ${proxyRes.statusCode} from ${parsedUrl.hostname}`, false, true);
          // Copy response headers but filter out problematic ones
          const responseHeaders = {};
          for (const key in proxyRes.headers) {
            const lowerKey = key.toLowerCase();
            // Skip headers that shouldn't be forwarded
            if (lowerKey !== 'connection' && 
                lowerKey !== 'transfer-encoding' &&
                lowerKey !== 'keep-alive') {
              responseHeaders[key] = proxyRes.headers[key];
            }
          }
          
          // Don't force connection: close - let it be handled naturally
          // responseHeaders.connection = 'close';
          
          try {
            if (!res.headersSent) {
              res.writeHead(proxyRes.statusCode, responseHeaders);
              proxyRes.pipe(res);
              logRequest(`📤 Sent response ${proxyRes.statusCode} to client`, false, true);
            } else {
              logRequest(`⚠️ Response headers already sent!`, true);
            }
          } catch (err) {
            logRequest(`❌ Error writing response: ${err.message}`, true);
          }
        });
        
        // Set timeout on proxy request
        proxyReq.setTimeout(30000, () => {
          logRequest(`⏱️ Proxy request timeout`, true);
          if (!res.headersSent) {
            res.writeHead(408);
            res.end('Request Timeout');
          }
          proxyReq.destroy();
        });
        
        proxyReq.on('error', (err) => {
          logRequest(`❌ Proxy request error: ${err.message}`, true);
          if (!res.headersSent) {
            res.writeHead(500);
            res.end(err.message);
          }
        });
        
        res.on('close', () => {
          logRequest(`🔌 Response closed`, false, true);
          if (!proxyReq.destroyed) {
            proxyReq.destroy();
          }
        });
        
        req.on('error', (err) => {
          logRequest(`❌ Request error: ${err.message}`, true);
          if (!proxyReq.destroyed) {
            proxyReq.destroy();
          }
          if (!res.headersSent) {
            res.writeHead(500);
            res.end('Request Error');
          }
        });
        
        res.on('error', (err) => {
          logRequest(`❌ Response error: ${err.message}`, true);
          if (!proxyReq.destroyed) {
            proxyReq.destroy();
          }
        });
        
        // Handle request body - pipe directly
        req.pipe(proxyReq);
      }
    });

    httpProxyServer.on('upgrade', (req, socket, head) => {
      // Handle WebSocket upgrades
      const urlParts = req.url.split(':');
      const host = urlParts[0];
      const port = parseInt(urlParts[1] || '80');
      
      SocksClient.createConnection({
        proxy: {
          host: '127.0.0.1',
          port: SOCKS5_PORT,
          type: 5
        },
        command: 'connect',
        destination: {
          host: host,
          port: port
        }
      }).then((info) => {
        info.socket.write(head);
        info.socket.pipe(socket);
        socket.pipe(info.socket);
      }).catch((err) => {
        socket.end();
      });
    });

    httpProxyServer.listen(HTTP_PROXY_PORT, '127.0.0.1', () => {
      console.log(`HTTP Proxy listening on port ${HTTP_PROXY_PORT}`);
      sendStatusUpdate();
      resolve();
    });

    httpProxyServer.on('error', (err) => {
      console.error('HTTP Proxy error:', err);
      reject(err);
    });
  });
}

async function configureSystemProxy() {
  const platform = process.platform;
  let configured = false;
  
  try {
    if (platform === 'darwin') {
      // macOS: Get list of all network services
      try {
        const { stdout } = await execAsync('networksetup -listallnetworkservices');
        const services = stdout.split('\n').filter(line => line.trim() && !line.includes('*') && !line.includes('An asterisk'));
        
        // Try common interface names first
        const preferredInterfaces = ['Wi-Fi', 'Ethernet', 'USB 10/100/1000 LAN', 'Thunderbolt Bridge'];
        
        for (const preferred of preferredInterfaces) {
          const matching = services.find(s => s.includes(preferred) || s.toLowerCase().includes(preferred.toLowerCase()));
          if (matching) {
            try {
              const iface = matching.trim();
              await execAsync(`networksetup -setwebproxy "${iface}" 127.0.0.1 ${HTTP_PROXY_PORT}`);
              await execAsync(`networksetup -setsecurewebproxy "${iface}" 127.0.0.1 ${HTTP_PROXY_PORT}`);
              // Enable the proxy
              await execAsync(`networksetup -setwebproxystate "${iface}" on`);
              await execAsync(`networksetup -setsecurewebproxystate "${iface}" on`);
              console.log(`System proxy configured and enabled via networksetup on ${iface}`);
              configured = true;
              break;
            } catch (err) {
              console.error(`Failed to configure proxy on ${matching}:`, err.message);
              continue;
            }
          }
        }
        
        // If still not configured, try the first available service
        if (!configured && services.length > 0) {
          const iface = services[0].trim();
          try {
            await execAsync(`networksetup -setwebproxy "${iface}" 127.0.0.1 ${HTTP_PROXY_PORT}`);
            await execAsync(`networksetup -setsecurewebproxy "${iface}" 127.0.0.1 ${HTTP_PROXY_PORT}`);
            // Enable the proxy
            await execAsync(`networksetup -setwebproxystate "${iface}" on`);
            await execAsync(`networksetup -setsecurewebproxystate "${iface}" on`);
            console.log(`System proxy configured and enabled via networksetup on ${iface}`);
            configured = true;
          } catch (err) {
            console.error(`Failed to configure proxy on ${iface}:`, err.message);
          }
        }
      } catch (err) {
        console.error('Failed to list network services:', err.message);
      }
    } else if (platform === 'win32') {
      // Windows: netsh
      try {
        await execAsync(`netsh winhttp set proxy proxy-server="127.0.0.1:${HTTP_PROXY_PORT}"`);
        console.log('System proxy configured via netsh');
        configured = true;
      } catch (err) {
        console.error('Failed to configure proxy via netsh:', err.message);
      }
    } else if (platform === 'linux') {
      // Linux: gsettings (GNOME) or environment variables
      try {
        // Try GNOME settings first
        await execAsync(`gsettings set org.gnome.system.proxy mode 'manual'`);
        await execAsync(`gsettings set org.gnome.system.proxy.http host '127.0.0.1'`);
        await execAsync(`gsettings set org.gnome.system.proxy.http port ${HTTP_PROXY_PORT}`);
        await execAsync(`gsettings set org.gnome.system.proxy.https host '127.0.0.1'`);
        await execAsync(`gsettings set org.gnome.system.proxy.https port ${HTTP_PROXY_PORT}`);
        console.log('System proxy configured via gsettings');
        configured = true;
      } catch (err) {
        console.error('Failed to configure proxy via gsettings:', err.message);
        console.log('Note: System proxy configuration may require manual setup on Linux');
      }
    } else {
      console.error('Unsupported platform for proxy configuration');
    }
    
    // Verify proxy is actually enabled
    if (configured && platform === 'darwin') {
      try {
        const { stdout } = await execAsync('networksetup -listallnetworkservices');
        const services = stdout.split('\n').filter(line => line.trim() && !line.includes('*') && !line.includes('An asterisk'));
        const preferredInterfaces = ['Wi-Fi', 'Ethernet', 'USB 10/100/1000 LAN', 'Thunderbolt Bridge'];
        
        for (const preferred of preferredInterfaces) {
          const matching = services.find(s => s.includes(preferred) || s.toLowerCase().includes(preferred.toLowerCase()));
          if (matching) {
            try {
              const iface = matching.trim();
              const { stdout: proxyStatus } = await execAsync(`networksetup -getwebproxy "${iface}"`);
              if (proxyStatus.includes('Enabled: Yes')) {
                systemProxyConfigured = true;
                break;
              }
            } catch (err) {
              // Continue checking
            }
          }
        }
      } catch (err) {
        // If verification fails, assume it's configured if the command succeeded
        systemProxyConfigured = configured;
      }
    } else {
      systemProxyConfigured = configured;
    }
    
    if (systemProxyConfigured) {
      sendStatusUpdate();
      if (mainWindow) {
        mainWindow.webContents.send('slipstream-log', `System proxy configured and enabled successfully`);
      }
    } else {
      if (mainWindow) {
        mainWindow.webContents.send('slipstream-error', `System proxy configuration failed. You may need admin privileges or configure manually: 127.0.0.1:${HTTP_PROXY_PORT}`);
      }
    }
    return systemProxyConfigured;
  } catch (err) {
    console.error('Failed to configure system proxy:', err);
    systemProxyConfigured = false;
    return false;
  }
}

async function unconfigureSystemProxy() {
  const platform = process.platform;
  
  try {
    if (platform === 'darwin') {
      // macOS: Try to find active network interface and disable proxy
      const interfaces = ['Wi-Fi', 'Ethernet'];
      
      for (const iface of interfaces) {
        try {
          await execAsync(`networksetup -listnetworkserviceorder | grep -i "${iface}"`);
          await execAsync(`networksetup -setwebproxystate "${iface}" off`);
          await execAsync(`networksetup -setsecurewebproxystate "${iface}" off`);
          console.log(`System proxy unconfigured via networksetup on ${iface}`);
          systemProxyConfigured = false;
          sendStatusUpdate();
          return true;
        } catch (err) {
          continue;
        }
      }
      
      // Try to get first available interface
      try {
        const { stdout } = await execAsync('networksetup -listnetworkserviceorder | grep "Hardware Port" | head -1 | sed "s/.*: //"');
        const iface = stdout.trim();
        if (iface) {
          await execAsync(`networksetup -setwebproxystate "${iface}" off`);
          await execAsync(`networksetup -setsecurewebproxystate "${iface}" off`);
          console.log(`System proxy unconfigured via networksetup on ${iface}`);
          systemProxyConfigured = false;
          sendStatusUpdate();
          return true;
        }
      } catch (err) {
        console.error('Failed to unconfigure proxy via networksetup:', err);
        systemProxyConfigured = false;
        sendStatusUpdate();
        return false;
      }
      
      systemProxyConfigured = false;
      sendStatusUpdate();
      return false;
    } else if (platform === 'win32') {
      // Windows: netsh
      await execAsync('netsh winhttp reset proxy');
      console.log('System proxy unconfigured via netsh');
      systemProxyConfigured = false;
      sendStatusUpdate();
      return true;
    } else if (platform === 'linux') {
      // Linux: gsettings (GNOME)
      try {
        await execAsync(`gsettings set org.gnome.system.proxy mode 'none'`);
        console.log('System proxy unconfigured via gsettings');
        systemProxyConfigured = false;
        sendStatusUpdate();
        return true;
      } catch (err) {
        console.error('Failed to unconfigure proxy via gsettings:', err);
        systemProxyConfigured = false;
        sendStatusUpdate();
        return false;
      }
    } else {
      console.error('Unsupported platform for proxy configuration');
      systemProxyConfigured = false;
      sendStatusUpdate();
      return false;
    }
  } catch (err) {
    console.error('Failed to unconfigure system proxy:', err);
    systemProxyConfigured = false;
    sendStatusUpdate();
    return false;
  }
}

async function startService(resolver, domain, tunMode = false) {
  if (isRunning) {
    return { success: false, message: 'Service is already running' };
  }

  // Always use HTTP Proxy mode - TUN mode removed for simplicity
  useTunMode = false;

  try {
    // Save settings
    if (resolver && domain) {
      saveSettings(resolver, domain, useTunMode ? 'tun' : 'proxy');
    } else {
      resolver = RESOLVER;
      domain = DOMAIN;
    }

    // Start Slipstream client (always needed)
    await startSlipstreamClient(resolver, domain);
    
    if (useTunMode) {
      // TUN mode - true system-wide VPN
      try {
        tunManager = require('./tun-manager');
        const tunResult = await tunManager.startTunMode();
        
        if (!tunResult.success) {
          throw new Error(tunResult.message);
        }
        
        isRunning = true;
        sendStatusUpdate();
        
        if (mainWindow) {
          mainWindow.webContents.send('slipstream-log', 'TUN mode: HTTP Proxy is not used (TUN provides system-wide tunneling)');
        }
        
        return {
          success: true,
          message: tunResult.message,
          details: {
            slipstreamRunning: slipstreamProcess !== null && !slipstreamProcess.killed,
            tunRunning: true,
            proxyRunning: false,
            systemProxyConfigured: false,
            mode: 'TUN'
          }
        };
      } catch (err) {
        console.error('TUN mode failed:', err);
        if (mainWindow) {
          mainWindow.webContents.send('slipstream-error', `TUN mode failed: ${err.message}. Falling back to HTTP Proxy mode.`);
        }
        // Fallback to HTTP proxy mode
        useTunMode = false;
        // Stop Slipstream if it was started
        if (slipstreamProcess) {
          slipstreamProcess.kill();
          slipstreamProcess = null;
        }
        return await startService(resolver, domain, false);
      }
    } else {
      // HTTP proxy mode
      await startHttpProxy();
      
      // HTTP proxy is listening - system proxy configuration is optional
      // Check if user wants system proxy configured (from settings or toggle)
      
      if (mainWindow) {
        mainWindow.webContents.send('slipstream-log', 'HTTP Proxy mode: TUN Interface is not used (only needed for TUN mode)');
      }
      
      isRunning = true;
      sendStatusUpdate();
      
      return { 
        success: true, 
        message: 'Service started successfully. HTTP proxy is listening on 127.0.0.1:8080',
        details: {
          slipstreamRunning: slipstreamProcess !== null && !slipstreamProcess.killed,
          proxyRunning: true,
          tunRunning: false,
          systemProxyConfigured: systemProxyConfigured,
          mode: 'HTTP Proxy'
        }
      };
    }
  } catch (err) {
    stopService();
    return { success: false, message: err.message, details: getStatusDetails() };
  }
}

function getStatusDetails() {
  let tunStatus = { tunRunning: false };
  if (tunManager) {
    try {
      tunStatus = tunManager.getTunStatus();
    } catch (err) {
      console.error('Error getting TUN status:', err);
    }
  }
  
  const currentMode = useTunMode ? 'TUN' : 'HTTP Proxy';
  
  return {
    slipstreamRunning: slipstreamProcess !== null && !slipstreamProcess.killed,
    proxyRunning: httpProxyServer !== null,
    tunRunning: tunStatus.tunRunning || false,
    systemProxyConfigured: systemProxyConfigured,
    mode: currentMode
  };
}

function stopService() {
  isRunning = false;
  
  // Stop TUN mode if active
  if (useTunMode && tunManager) {
    try {
      tunManager.stopTunMode();
    } catch (err) {
      console.error('Error stopping TUN mode:', err);
    }
    tunManager = null;
  }
  
  // Stop HTTP proxy
  if (httpProxyServer) {
    httpProxyServer.close();
    httpProxyServer = null;
  }
  
  // Stop Slipstream client
  if (slipstreamProcess) {
    slipstreamProcess.kill();
    slipstreamProcess = null;
  }
  
  // Note: We don't auto-configure system proxy, so no need to unconfigure
  // If user manually configured it, they can manually unconfigure it
  
  useTunMode = false;
  sendStatusUpdate();
  
  return { 
    success: true, 
    message: 'Service stopped',
    details: getStatusDetails()
  };
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopService();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopService();
});

// IPC handlers
ipcMain.handle('start-service', async (event, settings) => {
  return await startService(settings?.resolver, settings?.domain, settings?.tunMode || false);
});

ipcMain.handle('stop-service', () => {
  return stopService();
});

ipcMain.handle('get-status', () => {
  return { 
    isRunning,
    details: getStatusDetails()
  };
});

ipcMain.handle('get-settings', () => {
  return {
    resolver: RESOLVER,
    domain: DOMAIN,
    mode: useTunMode ? 'tun' : 'proxy',
    verbose: verboseLogging
  };
});

ipcMain.handle('get-version', () => {
  const packageJson = require('./package.json');
  return packageJson.version;
});

ipcMain.handle('check-update', async () => {
  try {
    const https = require('https');
    const packageJson = require('./package.json');
    const currentVersion = packageJson.version;
    
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/mirzaaghazadeh/SlipStreamGUI/releases/latest',
        method: 'GET',
        headers: {
          'User-Agent': 'SlipStream-GUI',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const release = JSON.parse(data);
              const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present
              
              // Compare versions (simple string comparison works for semantic versioning)
              const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
              
              resolve({
                success: true,
                hasUpdate: hasUpdate,
                currentVersion: currentVersion,
                latestVersion: latestVersion,
                releaseUrl: release.html_url,
                releaseNotes: release.body || ''
              });
            } else {
              resolve({
                success: false,
                error: `GitHub API returned status ${res.statusCode}`
              });
            }
          } catch (err) {
            resolve({
              success: false,
              error: `Failed to parse response: ${err.message}`
            });
          }
        });
      });
      
      req.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });
      
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });
      
      req.end();
    });
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
});

// Simple version comparison function
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

ipcMain.handle('set-verbose', (event, verbose) => {
  verboseLogging = verbose;
  saveSettings(RESOLVER, DOMAIN, useTunMode ? 'tun' : 'proxy', verbose);
  return { success: true, verbose: verboseLogging };
});

ipcMain.handle('check-system-proxy', async () => {
  const { checkSystemProxyStatus } = require('./check-system-proxy');
  const isConfigured = await checkSystemProxyStatus();
  systemProxyConfigured = isConfigured;
  return { configured: isConfigured };
});

ipcMain.handle('toggle-system-proxy', async (event, enable) => {
  if (enable) {
    const configured = await configureSystemProxy();
    // Update status after configuration
    sendStatusUpdate();
    return { success: configured, configured: systemProxyConfigured };
  } else {
    const unconfigured = await unconfigureSystemProxy();
    // Update status after unconfiguration
    sendStatusUpdate();
    return { success: unconfigured, configured: systemProxyConfigured };
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error('Failed to open external URL:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('test-proxy', async () => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const http = require('http');
    
    const options = {
      hostname: '127.0.0.1',
      port: HTTP_PROXY_PORT,
      path: 'http://httpbin.org/ip',
      method: 'GET',
      headers: {
        'Host': 'httpbin.org'
      },
      timeout: 10000
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        try {
          const json = JSON.parse(data);
          resolve({
            success: true,
            ip: json.origin,
            responseTime: responseTime
          });
        } catch (err) {
          resolve({
            success: true,
            ip: 'Unknown',
            responseTime: responseTime,
            raw: data
          });
        }
      });
    });
    
    req.on('error', (err) => {
      resolve({
        success: false,
        error: err.message
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });
    
    req.end();
  });
});
