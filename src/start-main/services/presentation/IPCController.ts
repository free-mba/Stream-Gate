/**
 * IPCController - Route IPC messages to appropriate services
 *
 * Single Responsibility: IPC routing
 *
 * This service acts as the presentation layer, routing IPC messages
 * from the renderer process to the appropriate backend services.
 */

import { ipcMain, shell, IpcMainInvokeEvent } from 'electron';
import https from 'node:https';
import http from 'node:http';
import ConnectionService from '../orchestration/ConnectionService';
import SettingsService from '../data/SettingsService';
import DNSService from '../business/DNSService';
import WindowService from '../infrastructure/WindowService';
import SystemProxyService from '../business/SystemProxyService';
import Logger from '../core/Logger';
import EventEmitter from '../core/EventEmitter';
import { checkSystemProxyStatus } from '../../utils/SystemProxyChecker';

interface IPCControllerDependencies {
  connectionService: ConnectionService;
  settingsService: SettingsService;
  dnsService: DNSService;
  windowService: WindowService;
  systemProxyService: SystemProxyService;
  logger: Logger;
  eventEmitter: EventEmitter;
}

export default class IPCController {
  private connectionService: ConnectionService;
  private settingsService: SettingsService;
  private dnsService: DNSService;
  private windowService: WindowService;
  private systemProxyService: SystemProxyService;
  private logger: Logger;
  private eventEmitter: EventEmitter;

  constructor(dependencies: IPCControllerDependencies) {
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
  private _setupLogForwarding(): void {
    // Forward log messages to renderer
    this.eventEmitter.on('log:message', (data: any) => {
      // Handle data as object or string
      const dataObj = typeof data === 'object' && data !== null ? data : { message: String(data) };
      const level = dataObj.level ? String(dataObj.level).toUpperCase() : 'INFO';
      const message = dataObj.message ? dataObj.message : String(data);
      this.windowService.sendToRenderer('stream-log', `[${level}] ${message}`);
    });

    this.eventEmitter.on('log:error', (data: any) => {
      const message = typeof data === 'object' && data !== null && 'message' in data ? (data as any).message : String(data);
      this.windowService.sendToRenderer('stream-error', `[ERROR] ${message}`);
    });

    // Forward process output
    this.eventEmitter.on('process:output', (data: any) => {
      this.windowService.sendToRenderer('stream-log', data);
    });

    this.eventEmitter.on('process:error', (data: any) => {
      this.windowService.sendToRenderer('stream-error', data);
    });

    // Forward proxy logs
    this.eventEmitter.on('proxy:log', (data: any) => {
      this.windowService.sendToRenderer('stream-log', data);
    });

    this.eventEmitter.on('proxy:error', (data: any) => {
      this.windowService.sendToRenderer('stream-error', data);
    });

    // Forward traffic updates
    this.eventEmitter.on('traffic-update', (data: any) => {
      this.windowService.sendToRenderer('traffic-update', data);
    });
  }

  /**
   * Register all IPC handlers
   */
  registerHandlers(): void {
    // Connection management
    ipcMain.handle('start-service', this._handleStartService.bind(this));
    ipcMain.handle('stop-service', this._handleStopService.bind(this));
    ipcMain.handle('get-status', this._handleGetStatus.bind(this));

    // Settings management
    ipcMain.handle('get-settings', this._handleGetSettings.bind(this));
    ipcMain.handle('set-authoritative', this._handleSetAuthoritative.bind(this));
    ipcMain.handle('set-resolvers', this._handleSetResolvers.bind(this));
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
    ipcMain.handle('get-logs', this._handleGetLogs.bind(this));

    this.logger.info('IPC handlers registered');
  }

  /**
   * Handle start-service
   * @private
   */
  async _handleStartService(event: IpcMainInvokeEvent, payload: any) {
    // Gather complete configuration here (Controller responsibility)
    const config = {
      resolvers: payload.resolvers || [],
      domain: payload.domain,
      authoritative: this.settingsService.get('authoritative'), // Global setting
      keepAliveInterval: payload.keepAliveInterval ?? this.settingsService.get('keepAliveInterval' as any),
      congestionControl: payload.congestionControl ?? (payload.config?.congestionControl || 'auto'),
      tunMode: payload.tunMode,
      customDnsEnabled: payload.customDnsEnabled, // Pass these through
      primaryDns: payload.primaryDns,
      secondaryDns: payload.secondaryDns
    };

    // Save "Last Used" connection settings (Persistence responsibility)
    this.settingsService.save({
      resolvers: config.resolvers,
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
  _handleSetAuthoritative(event: IpcMainInvokeEvent, enable: boolean) {
    try {
      this.settingsService.save({ authoritative: !!enable });
      return { success: true, enabled: this.settingsService.get('authoritative') };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle set-resolvers
   * @private
   */
  _handleSetResolvers(event: IpcMainInvokeEvent, payload: { resolvers: string[] }) {
    try {
      const resolvers = payload?.resolvers;
      if (!Array.isArray(resolvers) || resolvers.length === 0) {
        return { success: false, error: 'No resolvers provided' };
      }

      const valid = resolvers.every(r => this.settingsService.validateResolver(r));
      if (!valid) {
        return {
          success: false,
          error: 'One or more invalid DNS resolvers. Use IPv4:port (e.g. 1.1.1.1:53).'
        };
      }

      this.settingsService.save({ resolvers });
      return { success: true, resolvers: this.settingsService.get('resolvers') };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  /**
   * Handle set-verbose
   * @private
   */
  _handleSetVerbose(event: IpcMainInvokeEvent, verbose: boolean) {
    this.logger.setVerbose(verbose);
    this.settingsService.save({ verbose });
    return { success: true, verbose: this.logger.isVerbose() };
  }

  /**
   * Handle set-socks5-auth
   * @private
   */
  _handleSetSocks5Auth(event: IpcMainInvokeEvent, auth: any) {
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
  _handleSaveSettings(event: IpcMainInvokeEvent, settings: any) {
    try {
      this.settingsService.save(settings);
      return { success: true, settings: this.settingsService.getAll() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle import-configs
   * @private
   */
  _handleImportConfigs(event: IpcMainInvokeEvent, importData: string) {
    try {
      return this.settingsService.importConfigs(importData);
    } catch (err: any) {
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
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle toggle-system-proxy
   * @private
   */
  async _handleToggleSystemProxy(event: IpcMainInvokeEvent, enable: boolean) {
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
    const isConfigured = await checkSystemProxyStatus();
    return { configured: isConfigured };
  }

  /**
   * Handle dns-check-single
   * @private
   */
  async _handleDNSCheckSingle(event: IpcMainInvokeEvent, payload: any) {
    return await this.dnsService.checkSingleServer(payload);
  }

  /**
   * Handle get-version
   * @private
   */
  _handleGetVersion() {
    try {
      return require('../../../../../package.json').version;
    } catch (e) {
      return '0.0.0';
    }
  }

  /**
   * Handle check-update
   * @private
   */
  async _handleCheckUpdate() {
    try {
      const version = this._handleGetVersion();

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

        const req = https.request(options, (res: any) => {
          let data = '';

          res.on('data', (chunk: any) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const release = JSON.parse(data);
                const latestVersion = release.tag_name.replace(/^v/, '');

                const hasUpdate = this._compareVersions(latestVersion, version) > 0;

                resolve({
                  success: true,
                  hasUpdate: hasUpdate,
                  currentVersion: version,
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
            } catch (err: any) {
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
    } catch (err: any) {
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

      const req = http.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => {
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
          } catch (err: any) {
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
  async _handleOpenExternal(event: IpcMainInvokeEvent, url: string) {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to open external URL:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle get-logs
   * @private
   */
  _handleGetLogs() {
    return this.logger.getLogs();
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
  _compareVersions(v1: string, v2: string) {
    function normalize(v: string) {
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

    function compareIdentifiers(a: any, b: any) {
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

    // Prerelease check
    if (!A.prerelease || !B.prerelease) return 0; // Should satisfy TS, logic covered above

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
  async _handleDNSScanStart(event: IpcMainInvokeEvent, payload: any) {
    this.dnsService.startScan(
      payload,
      (completed: any, total: any) => {
        this.windowService.sendToRenderer('dns-scan-progress', { completed, total });
      },
      (result: any) => {
        this.windowService.sendToRenderer('dns-scan-result', result);
      },
      () => {
        this.windowService.sendToRenderer('dns-scan-complete', undefined);
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
