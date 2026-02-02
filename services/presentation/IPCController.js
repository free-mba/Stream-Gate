/**
 * IPCController - Route IPC messages to appropriate services
 *
 * Single Responsibility: IPC routing
 *
 * This service acts as the presentation layer, routing IPC messages
 * from the renderer process to the appropriate backend services.
 */

const { ipcMain, shell } = require('electron');
const https = require('node:https');

class IPCController {
  constructor(dependencies) {
    this.connectionService = dependencies.connectionService;
    this.settingsService = dependencies.settingsService;
    this.dnsService = dependencies.dnsService;
    this.windowService = dependencies.windowService;
    this.systemProxyService = dependencies.systemProxyService;
    this.logger = dependencies.logger;
    this.eventEmitter = dependencies.eventEmitter;

    // Set up log forwarding to renderer
    this._setupLogForwarding();
  }

  /**
   * Forward log events to renderer
   * @private
   */
  _setupLogForwarding() {
    // Forward log messages to renderer
    this.eventEmitter.on('log:message', (data) => {
      const level = data && data.level ? data.level.toUpperCase() : 'INFO';
      const message = data && data.message ? data.message : String(data);
      this.windowService.sendToRenderer('stream-log', `[${level}] ${message}`);
    });

    this.eventEmitter.on('log:error', (data) => {
      this.windowService.sendToRenderer('stream-error', `[ERROR] ${data.message}`);
    });

    // Forward process output
    this.eventEmitter.on('process:output', (data) => {
      this.windowService.sendToRenderer('stream-log', data);
    });

    this.eventEmitter.on('process:error', (data) => {
      this.windowService.sendToRenderer('stream-error', data);
    });

    // Forward proxy logs
    this.eventEmitter.on('proxy:log', (data) => {
      this.windowService.sendToRenderer('stream-log', data);
    });

    this.eventEmitter.on('proxy:error', (data) => {
      this.windowService.sendToRenderer('stream-error', data);
    });

    // Forward traffic updates
    this.eventEmitter.on('traffic-update', (data) => {
      this.windowService.sendToRenderer('traffic-update', data);
    });
  }

  /**
   * Register all IPC handlers
   */
  registerHandlers() {
    // Connection management
    ipcMain.handle('start-service', this._handleStartService.bind(this));
    ipcMain.handle('stop-service', this._handleStopService.bind(this));
    ipcMain.handle('get-status', this._handleGetStatus.bind(this));

    // Settings management
    ipcMain.handle('get-settings', this._handleGetSettings.bind(this));
    ipcMain.handle('set-authoritative', this._handleSetAuthoritative.bind(this));
    ipcMain.handle('set-resolver', this._handleSetResolver.bind(this));
    ipcMain.handle('set-verbose', this._handleSetVerbose.bind(this));
    ipcMain.handle('set-socks5-auth', this._handleSetSocks5Auth.bind(this));
    ipcMain.handle('save-settings', this._handleSaveSettings.bind(this));
    ipcMain.handle('import-configs', this._handleImportConfigs.bind(this));
    ipcMain.handle('export-configs', this._handleExportConfigs.bind(this));

    // System proxy management
    ipcMain.handle('toggle-system-proxy', this._handleToggleSystemProxy.bind(this));
    ipcMain.handle('check-system-proxy', this._handleCheckSystemProxy.bind(this));

    // DNS checking
    ipcMain.handle('dns-check-single', this._handleDNSCheckSingle.bind(this));
    ipcMain.handle('dns-scan-start', this._handleDNSScanStart.bind(this));
    ipcMain.handle('dns-scan-stop', this._handleDNSScanStop.bind(this));

    // App information
    ipcMain.handle('get-version', this._handleGetVersion.bind(this));
    ipcMain.handle('check-update', this._handleCheckUpdate.bind(this));

    // Utilities
    ipcMain.handle('test-proxy', this._handleTestProxy.bind(this));
    ipcMain.handle('open-external', this._handleOpenExternal.bind(this));

    this.logger.info('IPC handlers registered');
  }

  /**
   * Handle start-service
   * @private
   */
  async _handleStartService(event, payload) {
    // Gather complete configuration here (Controller responsibility)
    const config = {
      resolver: payload.resolver,
      domain: payload.domain,
      authoritative: this.settingsService.get('authoritative'), // Global setting
      keepAliveInterval: payload.keepAliveInterval !== undefined
        ? payload.keepAliveInterval
        : this.settingsService.get('keepAliveInterval'),
      congestionControl: payload.congestionControl !== undefined
        ? payload.congestionControl
        : this.settingsService.get('congestionControl'),
      tunMode: payload.tunMode
    };

    // Save "Last Used" connection settings (Persistence responsibility)
    this.settingsService.save({
      resolver: config.resolver,
      domain: config.domain,
      mode: config.tunMode ? 'tun' : 'proxy'
    });

    return await this.connectionService.start(config);
  }

  /**
   * Handle stop-service
   * @private
   */
  async _handleStopService() {
    await this.connectionService.cleanupAndDisableProxyIfNeeded('user-stop');
    return {
      success: true,
      message: 'Service stopped',
      details: this.connectionService.getStatus()
    };
  }

  /**
   * Handle get-status
   * @private
   */
  _handleGetStatus() {
    return {
      isRunning: this.connectionService.isConnectionRunning(),
      details: this.connectionService.getStatus()
    };
  }

  /**
   * Handle get-settings
   * @private
   */
  _handleGetSettings() {
    return this.settingsService.getAll();
  }

  /**
   * Handle set-authoritative
   * @private
   */
  _handleSetAuthoritative(event, enable) {
    try {
      this.settingsService.save({ authoritative: !!enable });
      return { success: true, enabled: this.settingsService.get('authoritative') };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle set-resolver
   * @private
   */
  _handleSetResolver(event, payload) {
    try {
      const parsed = this.settingsService.parseDnsServer(payload?.resolver);
      if (!parsed) {
        return {
          success: false,
          error: 'Invalid DNS resolver. Use IPv4:port (e.g. 1.1.1.1:53).'
        };
      }

      // Force port 53 (DNS Checker "Use" button behavior)
      const normalized = `${parsed.ip}:53`;
      this.settingsService.save({ resolver: normalized });
      return { success: true, resolver: normalized };
    } catch (err) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Handle set-verbose
   * @private
   */
  _handleSetVerbose(event, verbose) {
    this.logger.setVerbose(verbose);
    this.settingsService.save({ verbose });
    return { success: true, verbose: this.logger.isVerbose() };
  }

  /**
   * Handle set-socks5-auth
   * @private
   */
  _handleSetSocks5Auth(event, auth) {
    const enabled = !!auth?.enabled;
    const username = typeof auth?.username === 'string' ? auth.username : this.settingsService.get('socks5AuthUsername');
    const password = typeof auth?.password === 'string' ? auth.password : this.settingsService.get('socks5AuthPassword');

    this.settingsService.save({
      socks5AuthEnabled: enabled,
      socks5AuthUsername: username,
      socks5AuthPassword: password
    });

    return {
      success: true,
      socks5AuthEnabled: enabled,
      socks5AuthUsername: username,
      socks5AuthPassword: password
    };
  }

  /**
   * Handle save-settings
   * @private
   */
  _handleSaveSettings(event, settings) {
    try {
      this.settingsService.save(settings);
      return { success: true, settings: this.settingsService.getAll() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle import-configs
   * @private
   */
  _handleImportConfigs(event, importData) {
    try {
      return this.settingsService.importConfigs(importData);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle export-configs
   * @private
   */
  _handleExportConfigs() {
    try {
      return { success: true, data: this.settingsService.exportConfigs() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle toggle-system-proxy
   * @private
   */
  async _handleToggleSystemProxy(event, enable) {
    if (enable) {
      const result = await this.systemProxyService.configure();
      this._sendStatusUpdate();
      return { success: result.success, configured: this.systemProxyService.isEnabled() };
    } else {
      const result = await this.systemProxyService.unconfigure();
      this._sendStatusUpdate();
      return { success: result.success, configured: this.systemProxyService.isEnabled() };
    }
  }

  /**
   * Handle check-system-proxy
   * @private
   */
  async _handleCheckSystemProxy() {
    const { checkSystemProxyStatus } = require('../../check-system-proxy');
    const isConfigured = await checkSystemProxyStatus();
    return { configured: isConfigured };
  }

  /**
   * Handle dns-check-single
   * @private
   */
  async _handleDNSCheckSingle(event, payload) {
    return await this.dnsService.checkSingleServer(payload);
  }

  /**
   * Handle get-version
   * @private
   */
  _handleGetVersion() {
    const packageJson = require('../../package.json');
    return packageJson.version;
  }

  /**
   * Handle check-update
   * @private
   */
  async _handleCheckUpdate() {
    try {
      const packageJson = require('../../package.json');
      const currentVersion = packageJson.version;

      return new Promise((resolve) => {
        const options = {
          hostname: 'api.github.com',
          path: '/repos/free-mba/Stream-Gate/releases/latest',
          method: 'GET',
          headers: {
            'User-Agent': 'stream-client-gui',
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
                const latestVersion = release.tag_name.replace(/^v/, '');

                const hasUpdate = this._compareVersions(latestVersion, currentVersion) > 0;

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
  }

  /**
   * Handle test-proxy
   * @private
   */
  async _handleTestProxy() {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const http = require('node:http');

      const options = {
        hostname: '127.0.0.1',
        port: 8080,
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
          const status = Number(res.statusCode) || 0;

          if (status < 200 || status >= 300) {
            resolve({
              success: false,
              error: `Proxy returned HTTP ${status}${data ? `: ${String(data).slice(0, 200)}` : ''}`,
              responseTime
            });
            return;
          }

          try {
            const json = JSON.parse(data);
            resolve({
              success: true,
              ip: json.origin || 'Unknown',
              responseTime
            });
          } catch (err) {
            resolve({
              success: false,
              error: `Invalid response from proxy (not JSON). ${String(err?.message || err)}`,
              responseTime,
              raw: String(data).slice(0, 200)
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
  }

  /**
   * Handle open-external
   * @private
   */
  async _handleOpenExternal(event, url) {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err) {
      this.logger.error('Failed to open external URL:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send status update to renderer
   * @private
   */
  _sendStatusUpdate() {
    this.windowService.sendToRenderer('status-update', this.connectionService.getStatus());
  }

  /**
   * SemVer-ish comparison
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
   * @private
   */
  _compareVersions(v1, v2) {
    function normalize(v) {
      const raw = String(v || '').trim().replace(/^v/i, '');
      const noBuild = raw.split('+')[0];
      const [core, prereleaseRaw] = noBuild.split('-', 2);
      const nums = core
        .split('.')
        .slice(0, 3)
        .map((p) => {
          const m = String(p || '').match(/^(\d+)/);
          return m ? Number(m[1]) : 0;
        });
      while (nums.length < 3) nums.push(0);
      const prerelease = prereleaseRaw ? prereleaseRaw.split('.').filter(Boolean) : null;
      return { nums, prerelease };
    }

    function compareIdentifiers(a, b) {
      const an = /^\d+$/.test(a);
      const bn = /^\d+$/.test(b);
      if (an && bn) {
        const ai = Number(a);
        const bi = Number(b);
        if (ai > bi) return 1;
        if (ai < bi) return -1;
        return 0;
      }
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      if (a > b) return 1;
      if (a < b) return -1;
      return 0;
    }

    const A = normalize(v1);
    const B = normalize(v2);

    for (let i = 0; i < 3; i++) {
      if (A.nums[i] > B.nums[i]) return 1;
      if (A.nums[i] < B.nums[i]) return -1;
    }

    if (!A.prerelease && !B.prerelease) return 0;
    if (!A.prerelease && B.prerelease) return 1;
    if (A.prerelease && !B.prerelease) return -1;

    const len = Math.max(A.prerelease.length, B.prerelease.length);
    for (let i = 0; i < len; i++) {
      const ai = A.prerelease[i];
      const bi = B.prerelease[i];
      if (ai === undefined) return -1;
      if (bi === undefined) return 1;
      const c = compareIdentifiers(ai, bi);
      if (c !== 0) return c;
    }
    return 0;
  }
  /**
   * Handle dns-scan-start
   * @private
   */
  async _handleDNSScanStart(event, payload) {
    this.dnsService.startScan(
      payload,
      (completed, total) => {
        this.windowService.sendToRenderer('dns-scan-progress', { completed, total });
      },
      (result) => {
        this.windowService.sendToRenderer('dns-scan-result', result);
      },
      () => {
        this.windowService.sendToRenderer('dns-scan-complete');
      }
    );
    return { success: true };
  }

  /**
   * Handle dns-scan-stop
   * @private
   */
  async _handleDNSScanStop() {
    await this.dnsService.stopScan();
    return { success: true };
  }
}

module.exports = IPCController;
