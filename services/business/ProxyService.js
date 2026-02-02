/**
 * ProxyService - HTTP proxy server and SOCKS5 forwarder
 *
 * Single Responsibility: Manage proxy servers
 *
 * Handles:
 * - HTTP proxy server on port 8080
 * - SOCKS5-to-HTTP bridge on port 10809 (for network sharing)
 */

const http = require('http');
const https = require('https');
const net = require('net');
const url = require('url');
const { SocksClient } = require('socks');
const { SocksProxyAgent } = require('socks-proxy-agent');

// Constants
const HTTP_PROXY_PORT = 8080;
const SOCKS5_PORT = 5201;
const SOCKS5_FORWARD_PORT = 10809;

class ProxyService {
  constructor(eventEmitter, logger, settingsService) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.settingsService = settingsService;

    this.httpProxyServer = null;
    this.socksForwardServer = null;

    // Traffic stats
    this.bytesUplink = 0;
    this.bytesDownlink = 0;
    this.prevUplink = 0;
    this.prevDownlink = 0;
    this.trafficInterval = null;
  }

  /**
   * Build SOCKS5 URL with optional authentication
   * @returns {string} SOCKS5 URL
   * @private
   */
  _buildSocks5Url() {
    const settings = this.settingsService.getAll();
    let u = 'anonymous';
    let p = 'anonymous';

    if (settings.socks5AuthEnabled && settings.socks5AuthUsername && settings.socks5AuthPassword) {
      u = encodeURIComponent(settings.socks5AuthUsername);
      p = encodeURIComponent(settings.socks5AuthPassword);
    }

    return `socks5://${u}:${p}@127.0.0.1:${SOCKS5_PORT}`;
  }

  /**
   * Get or create SOCKS5 agent
   * @param {string} socksUrl - SOCKS5 URL
   * @returns {SocksProxyAgent}
   * @private
   */
  _getSocksAgent(socksUrl) {
    // Create new agent each time to pick up auth changes
    return new SocksProxyAgent(socksUrl);
  }

  /**
   * Get SOCKS5 proxy configuration
   * @returns {Object} SOCKS5 proxy config
   * @private
   */
  _getSocksProxyConfig() {
    const settings = this.settingsService.getAll();
    const config = {
      host: '127.0.0.1',
      port: SOCKS5_PORT,
      type: 5
    };

    if (settings.socks5AuthEnabled && settings.socks5AuthUsername && settings.socks5AuthPassword) {
      config.userId = settings.socks5AuthUsername;
      config.password = settings.socks5AuthPassword;
    } else {
      // Force User/Password auth method (0x02) by providing default credentials.
      // The server rejects NoAuth (0x00), so we must offer 0x02.
      config.userId = 'anonymous';
      config.password = 'anonymous';
    }

    return config;
  }

  /**
   * Start traffic monitoring
   * @private
   */
  _startTrafficMonitor() {
    if (this.trafficInterval) clearInterval(this.trafficInterval);

    this.prevUplink = this.bytesUplink;
    this.prevDownlink = this.bytesDownlink;

    this.trafficInterval = setInterval(() => {
      const nowUp = this.bytesUplink;
      const nowDown = this.bytesDownlink;

      const speedUp = nowUp - this.prevUplink;
      const speedDown = nowDown - this.prevDownlink;

      this.prevUplink = nowUp;
      this.prevDownlink = nowDown;

      // Emit even if zero, so UI clears
      this.eventEmitter.emit('traffic-update', {
        up: speedUp < 0 ? 0 : speedUp,
        down: speedDown < 0 ? 0 : speedDown
      });
    }, 1000);
  }

  /**
   * Stop traffic monitoring
   * @private
   */
  _stopTrafficMonitor() {
    if (this.trafficInterval) {
      clearInterval(this.trafficInterval);
      this.trafficInterval = null;
    }
  }

  /**
   * Increment uplink counter
   * @param {number} bytes 
   */
  _addUplink(bytes) {
    this.bytesUplink += bytes;
  }

  /**
   * Increment downlink counter
   * @param {number} bytes 
   */
  _addDownlink(bytes) {
    this.bytesDownlink += bytes;
  }

  /**
   * Start the HTTP proxy server
   * @returns {Promise<void>}
   */
  async startHttpProxy() {
    return new Promise((resolve, reject) => {
      try {
        const socksUrl = this._buildSocks5Url();
        const socksAgent = this._getSocksAgent(socksUrl);
        const settings = this.settingsService.getAll();

        // Create HTTP proxy server
        this.httpProxyServer = http.createServer();

        // Handle CONNECT requests (HTTPS)
        this.httpProxyServer.on('connect', (req, clientSocket, head) => {
          this._handleConnect(req, clientSocket, head);
        });

        // Handle regular HTTP requests
        this.httpProxyServer.on('request', (req, res) => {
          this._handleRequest(req, res, socksAgent);
        });

        // Handle WebSocket upgrades
        this.httpProxyServer.on('upgrade', (req, socket, head) => {
          this._handleUpgrade(req, socket, head);
        });

        this.httpProxyServer.listen(HTTP_PROXY_PORT, '0.0.0.0', () => {
          this.logger.info(`HTTP Proxy listening on port ${HTTP_PROXY_PORT}`);
          this.eventEmitter.emit('proxy:started', { type: 'http', port: HTTP_PROXY_PORT });
          this._startTrafficMonitor();
          resolve();
        });

        this.httpProxyServer.on('error', (err) => {
          this.logger.error('HTTP Proxy error:', err);
          reject(err);
        });
      } catch (err) {
        this.logger.error('Failed to start HTTP proxy:', err);
        reject(err);
      }
    });
  }

  /**
   * Handle CONNECT requests (for HTTPS)
   * @private
   */
  _handleConnect(req, clientSocket, head) {
    const settings = this.settingsService.getAll();
    const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    const logRequest = (message, isError = false, isVerbose = false) => {
      if (isVerbose && !settings.verbose) return;
      const logMsg = `[${requestId}] ${message}`;
      this.logger.info(logMsg);
      this.eventEmitter.emit(isError ? 'proxy:error' : 'proxy:log', logMsg);
    };

    const urlParts = req.url.split(':');
    const host = urlParts[0];
    const port = parseInt(urlParts[1] || '443');

    logRequest(`🔒 CONNECT ${host}:${port} (HTTPS)`, false, true);

    const socksProxy = this._getSocksProxyConfig();

    SocksClient.createConnection({
      proxy: socksProxy,
      command: 'connect',
      destination: { host, port }
    }).then((info) => {
      logRequest(`✅ SOCKS5 connected to ${host}:${port}`, false, true);

      const targetSocket = info.socket;

      // Send 200 response
      clientSocket.write('HTTP/1.1 200 Connection established\r\n\r\n');
      logRequest(`📤 Sent 200 Connection established`, false, true);

      // Write head data if present
      if (head && head.length > 0) {
        targetSocket.write(head);
        this._addUplink(head.length);
      }

      // Configure sockets
      clientSocket.setNoDelay(true);
      targetSocket.setNoDelay(true);

      // Traffic counting
      clientSocket.on('data', (chunk) => {
        this._addUplink(chunk.length);
      });
      targetSocket.on('data', (chunk) => {
        this._addDownlink(chunk.length);
      });

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
  }

  /**
   * Handle regular HTTP requests
   * @private
   */
  _handleRequest(req, res, socksAgent) {
    const settings = this.settingsService.getAll();
    const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

    const logRequest = (message, isError = false, isVerbose = false) => {
      if (isVerbose && !settings.verbose) return;
      const logMsg = `[${requestId}] ${message}`;
      this.logger.info(logMsg);
      this.eventEmitter.emit(isError ? 'proxy:error' : 'proxy:log', logMsg);
    };

    logRequest(`→ ${req.method} ${req.url}`, false, true);

    // Track request body size (uplink)
    req.on('data', (chunk) => {
      this._addUplink(chunk.length);
    });

    // Set timeout
    req.setTimeout(30000, () => {
      logRequest(`⏱️ Request timeout`, true);
      if (!res.headersSent) {
        res.writeHead(408);
        res.end('Request Timeout');
      }
    });

    // Parse URL
    let targetUrl = req.url;
    let parsedUrl;

    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      parsedUrl = url.parse(targetUrl);
    } else {
      const host = req.headers.host || 'localhost';
      targetUrl = `http://${host}${targetUrl.startsWith('/') ? targetUrl : '/' + targetUrl}`;
      parsedUrl = url.parse(targetUrl);
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    // Build request options
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path || '/',
      method: req.method,
      headers: {}
    };

    // Copy headers, skipping proxy-specific ones
    for (const key in req.headers) {
      const lowerKey = key.toLowerCase();
      if (['host', 'proxy-connection', 'proxy-authorization', 'connection', 'upgrade', 'keep-alive'].includes(lowerKey)) {
        continue;
      }
      options.headers[key] = req.headers[key];
    }

    options.headers.host = parsedUrl.hostname + (parsedUrl.port ? ':' + parsedUrl.port : '');
    options.agent = socksAgent;
    options.timeout = 30000;

    logRequest(`🌐 HTTP ${req.method} ${parsedUrl.hostname}${parsedUrl.path || '/'} via SOCKS5`, false, true);

    const proxyReq = client.request(options, (proxyRes) => {
      logRequest(`📥 Response ${proxyRes.statusCode} from ${parsedUrl.hostname}`, false, true);

      // Copy response headers
      const responseHeaders = {};
      for (const key in proxyRes.headers) {
        const lowerKey = key.toLowerCase();
        if (!['connection', 'transfer-encoding', 'keep-alive'].includes(lowerKey)) {
          responseHeaders[key] = proxyRes.headers[key];
        }
      }

      try {
        if (!res.headersSent) {
          res.writeHead(proxyRes.statusCode, responseHeaders);

          // Track response body size (downlink)
          proxyRes.on('data', (chunk) => {
            this._addDownlink(chunk.length);
          });

          proxyRes.pipe(res);
          logRequest(`📤 Sent response ${proxyRes.statusCode} to client`, false, true);
        } else {
          logRequest(`⚠️ Response headers already sent!`, true);
        }
      } catch (err) {
        logRequest(`❌ Error writing response: ${err.message}`, true);
      }
    });

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

    req.pipe(proxyReq);
  }

  /**
   * Handle WebSocket upgrade requests
   * @private
   */
  _handleUpgrade(req, socket, head) {
    const urlParts = req.url.split(':');
    const host = urlParts[0];
    const port = parseInt(urlParts[1] || '80');

    const socksProxy = this._getSocksProxyConfig();

    SocksClient.createConnection({
      proxy: socksProxy,
      command: 'connect',
      destination: { host, port }
    }).then((info) => {
      info.socket.write(head);
      this._addUplink(head.length);

      // Traffic counting
      socket.on('data', (chunk) => {
        this._addUplink(chunk.length);
      });
      info.socket.on('data', (chunk) => {
        this._addDownlink(chunk.length);
      });

      info.socket.pipe(socket);
      socket.pipe(info.socket);
    }).catch((err) => {
      this.logger.error('WebSocket upgrade failed:', err);
      socket.end();
    });
  }

  /**
   * Start the SOCKS5-to-HTTP forwarder (for network sharing)
   * @returns {Promise<void>}
   */
  async startSocksForwardProxy() {
    return new Promise((resolve, reject) => {
      try {
        if (this.socksForwardServer) {
          this.socksForwardServer.close();
        }

        this.socksForwardServer = net.createServer((clientSocket) => {
          this._handleSocksForwardClient(clientSocket);
        });

        this.socksForwardServer.listen(SOCKS5_FORWARD_PORT, '0.0.0.0', () => {
          const msg = `SOCKS-to-HTTP Bridge listening on 0.0.0.0:${SOCKS5_FORWARD_PORT} -> Local HTTP Proxy :${HTTP_PROXY_PORT}`;
          this.logger.info(msg);
          this.eventEmitter.emit('proxy:started', { type: 'socks-forward', port: SOCKS5_FORWARD_PORT });
          this.eventEmitter.emit('log:message', `✅ ${msg}`);
          resolve();
        });

        this.socksForwardServer.on('error', (err) => {
          this.logger.error('SOCKS Forwarder error:', err);
          this.eventEmitter.emit('proxy:error', `SOCKS Forwarder error: ${err.message}`);
          reject(err);
        });
      } catch (err) {
        this.logger.error('Failed to start SOCKS forwarder:', err);
        reject(err);
      }
    });
  }

  /**
   * Handle SOCKS5 forward client connection
   * @private
   */
  _handleSocksForwardClient(clientSocket) {
    const settings = this.settingsService.getAll();
    const requestId = Math.random().toString(36).substr(2, 5);

    // SOCKS5 State Machine
    clientSocket.once('data', (greeting) => {
      // Handshake greeting
      if (greeting[0] !== 0x05) {
        clientSocket.destroy();
        return;
      }

      // Respond with No Auth
      clientSocket.write(Buffer.from([0x05, 0x00]));

      clientSocket.once('data', (request) => {
        // Connection request
        if (request[0] !== 0x05 || request[1] !== 0x01) {
          clientSocket.destroy();
          return;
        }

        let host;
        let port;
        let offset = 4;
        const atyp = request[3];

        try {
          if (atyp === 0x01) { // IPv4
            host = `${request[4]}.${request[5]}.${request[6]}.${request[7]}`;
            offset = 8;
          } else if (atyp === 0x03) { // Domain
            const len = request[4];
            host = request.slice(5, 5 + len).toString();
            offset = 5 + len;
          } else {
            clientSocket.destroy();
            return;
          }
          port = request.readUInt16BE(offset);
        } catch (err) {
          clientSocket.destroy();
          return;
        }

        if (settings.verbose) {
          this.logger.verbose(`[SOCKS-TO-HTTP-${requestId}] Bridge request: ${host}:${port}`);
          this.eventEmitter.emit('proxy:log', `[Bridge 10809] SOCKS5 CONNECT ${host}:${port}`);
        }

        // Connect to local HTTP Proxy
        const httpProxySocket = net.connect(HTTP_PROXY_PORT, '127.0.0.1');

        httpProxySocket.on('connect', () => {
          if (settings.verbose) {
            this.logger.verbose(`[SOCKS-TO-HTTP-${requestId}] Connected to local HTTP proxy`);
          }

          // Send HTTP CONNECT request
          let connectMsg = `CONNECT ${host}:${port} HTTP/1.1\r\n`;
          connectMsg += `Host: ${host}:${port}\r\n`;
          connectMsg += `Proxy-Connection: Keep-Alive\r\n`;
          connectMsg += `User-Agent: stream-bridge/1.0\r\n`;

          // Add auth if configured
          if (settings.socks5AuthEnabled && settings.socks5AuthUsername && settings.socks5AuthPassword) {
            const auth = Buffer.from(`${settings.socks5AuthUsername}:${settings.socks5AuthPassword}`).toString('base64');
            connectMsg += `Proxy-Authorization: Basic ${auth}\r\n`;
          }

          connectMsg += `\r\n`;
          httpProxySocket.write(connectMsg);
        });

        httpProxySocket.once('data', (data) => {
          const response = data.toString();
          if (settings.verbose) {
            this.logger.verbose(`[SOCKS-TO-HTTP-${requestId}] Proxy response: ${response.split('\r\n')[0]}`);
          }

          if (response.includes('200 Connection established') || response.includes('HTTP/1.1 200') || response.includes('HTTP/1.0 200')) {
            if (settings.verbose) {
              this.logger.verbose(`[SOCKS-TO-HTTP-${requestId}] HTTP Tunnel established`);
            }

            // Respond success to SOCKS client
            clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));

            // Config sockets
            clientSocket.setNoDelay(true);
            httpProxySocket.setNoDelay(true);

            // Traffic counting (Bridge is just a recursive call to HTTP proxy, so we count traffic here too or rely on the HTTP proxy to count it?
            // If we count here AND in HTTP proxy, we double count locally initiated SOCKS traffic.
            // But if we use SOCKS stats to display, we want the total.
            // Since this just pipes to Local HTTP Proxy, the Local HTTP Proxy (via _handleConnect) will count the traffic!
            // BUT: The data between Client <-> Bridge is what we want to measure if it's external.
            // However, since we treat everything passing through THIS app instance as "Traffic", and proper HTTP proxy counts it...
            // Wait, this is `net.connect(HTTP_PROXY_PORT)`. The `httpProxyServer` will receive this connection.
            // So `_handleConnect` in `httpProxyServer` WILL be called.
            // And that method counts traffic.
            // So we DO NOT need to count traffic here, or we will double-count for SOCKS clients.
            // Correct.

            // Pipe bidirectionally
            clientSocket.pipe(httpProxySocket);
            httpProxySocket.pipe(clientSocket);
          } else {
            if (settings.verbose) {
              this.logger.error(`[SOCKS-TO-HTTP-${requestId}] HTTP Proxy rejected:`, response.split('\r\n')[0]);
            }
            // Respond failure
            clientSocket.write(Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
            clientSocket.destroy();
            httpProxySocket.destroy();
          }
        });

        const cleanup = () => {
          if (!clientSocket.destroyed) clientSocket.destroy();
          if (!httpProxySocket.destroyed) httpProxySocket.destroy();
        };

        clientSocket.on('error', (err) => {
          if (settings.verbose && err.code !== 'ECONNRESET') {
            this.logger.error(`[SOCKS-TO-HTTP-${requestId}] Client socket error:`, err.message);
          }
          cleanup();
        });

        httpProxySocket.on('error', (err) => {
          if (settings.verbose) {
            this.logger.error(`[SOCKS-TO-HTTP-${requestId}] HTTP Proxy socket error:`, err.message);
          }
          cleanup();
        });

        clientSocket.on('close', cleanup);
        httpProxySocket.on('close', cleanup);
        clientSocket.setTimeout(600000); // 10 min
        clientSocket.on('timeout', cleanup);
      });
    });

    clientSocket.on('error', (err) => {
      if (settings.verbose && err.code !== 'ECONNRESET') {
        this.logger.error(`[SOCKS-TO-HTTP-${requestId}] Initial handshaking error:`, err.message);
      }
    });
  }

  /**
   * Stop the HTTP proxy server
   */
  stopHttpProxy() {
    this._stopTrafficMonitor();
    if (this.httpProxyServer) {
      this.logger.info('Stopping HTTP proxy server');
      this.httpProxyServer.close();
      this.httpProxyServer = null;
      this.eventEmitter.emit('proxy:stopped', { type: 'http' });
    }
  }

  /**
   * Stop the SOCKS5 forwarder
   */
  stopSocksForwardProxy() {
    if (this.socksForwardServer) {
      this.logger.info('Stopping SOCKS5 forwarder');
      this.socksForwardServer.close();
      this.socksForwardServer = null;
      this.eventEmitter.emit('proxy:stopped', { type: 'socks-forward' });
    }
  }

  /**
   * Stop all proxy servers
   */
  stopAll() {
    this.stopHttpProxy();
    this.stopSocksForwardProxy();
  }

  /**
   * Check if HTTP proxy is running
   * @returns {boolean}
   */
  isHttpProxyRunning() {
    return this.httpProxyServer !== null;
  }

  /**
   * Check if SOCKS forwarder is running
   * @returns {boolean}
   */
  isSocksForwardRunning() {
    return this.socksForwardServer !== null &&
      this.socksForwardServer.listening;
  }

  /**
   * Get proxy status
   * @returns {Object}
   */
  getStatus() {
    return {
      httpProxyRunning: this.isHttpProxyRunning(),
      httpProxyPort: HTTP_PROXY_PORT,
      socksForwardRunning: this.isSocksForwardRunning(),
      socksForwardPort: SOCKS5_FORWARD_PORT,
      socks5Port: SOCKS5_PORT
    };
  }
}

module.exports = ProxyService;
