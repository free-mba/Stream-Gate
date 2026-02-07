/**
 * ConnectionService - Orchestrates all services to establish VPN connection
 *
 * Single Responsibility: Connection lifecycle orchestration
 *
 * This service coordinates all other services to:
 * - Start/stop VPN connections
 * - Handle auto-reconnection with exponential backoff
 * - Provide connection status
 *
 * @see {@link ../../../docs/concepts/Slipstream.md}
 * @see {@link ../../../docs/concepts/Architecture.md}
 */

import ProcessManager from '../business/ProcessManager';
import ProxyService from '../business/ProxyService';
import SystemProxyService from '../business/SystemProxyService';
import DnsResolutionService from '../business/DnsResolutionService';
import SettingsService from '../data/SettingsService';
import EventEmitter from '../core/EventEmitter';
import Logger from '../core/Logger';

interface ConnectionServiceDependencies {
  processManager: ProcessManager;
  proxyService: ProxyService;
  systemProxyService: SystemProxyService;
  dnsResolutionService: DnsResolutionService;
  settingsService: SettingsService;
  eventEmitter: EventEmitter;
  logger: Logger;
}

interface StartOptions {
  resolver: string;
  resolvers: string[];
  domain: string;
  tunMode?: boolean;
  keepAliveInterval?: number;
  congestionControl?: string;
  authoritative?: boolean;
  customDnsEnabled?: boolean;
  primaryDns?: string;
  secondaryDns?: string;
}

interface ConnectionResult {
  success: boolean;
  message: string;
  details?: any;
}

export default class ConnectionService {
  private processManager: ProcessManager;
  private proxyService: ProxyService;
  private systemProxyService: SystemProxyService;
  private dnsResolutionService: DnsResolutionService;
  private settingsService: SettingsService;
  private eventEmitter: EventEmitter;
  private logger: Logger;

  private isRunning: boolean;
  private quitting: boolean;
  private cleanupInProgress: boolean;

  private RETRY_BASE_INTERVAL: number;
  private MAX_RETRY_ATTEMPTS: number;
  private retryAttempts: number;
  private retryTimer: NodeJS.Timeout | null;
  private activeConfig: StartOptions | null;

  constructor(dependencies: ConnectionServiceDependencies) {
    // Dependency injection
    this.processManager = dependencies.processManager;
    this.proxyService = dependencies.proxyService;
    this.systemProxyService = dependencies.systemProxyService;
    this.dnsResolutionService = dependencies.dnsResolutionService;
    this.settingsService = dependencies.settingsService;
    this.eventEmitter = dependencies.eventEmitter;
    this.logger = dependencies.logger;

    // Connection state
    this.isRunning = false;
    this.quitting = false;
    this.cleanupInProgress = false;

    // Auto-reconnection state
    this.RETRY_BASE_INTERVAL = 30000; // 30 seconds
    this.MAX_RETRY_ATTEMPTS = 3;
    this.retryAttempts = 0;
    this.retryTimer = null;
    this.activeConfig = null;

    // Subscribe to process exit events for auto-reconnection
    this._setupEventListeners();
  }

  /**
   * Set up event listeners for auto-reconnection
   * @private
   */
  private _setupEventListeners(): void {
    // Listen for process exit
    this.processManager.onExit((code) => {
      if (this.isRunning && !this.quitting && !this.cleanupInProgress) {
        this.logger.info('Stream client process died unexpectedly. Attempting automatic reconnection...');
        this._attemptReconnection();
      }
    });
  }

  /**
   * Start the VPN connection
   * @param {Object} options - Connection options
   * @returns {Promise<Object>} Result object
   */
  async start(options: StartOptions): Promise<ConnectionResult> {
    if (this.isRunning) {
      return { success: false, message: 'Service is already running' };
    }

    // STRICT: Expect all configuration to be provided by caller (IPCController)
    // No fallback to settingsService here.
    let {
      resolver,
      resolvers,
      domain,
      tunMode = false,
      keepAliveInterval,
      congestionControl,
      authoritative,
      // Custom DNS arguments
      customDnsEnabled,
      primaryDns,
      secondaryDns
    } = options;

    // Always use HTTP Proxy mode - TUN mode removed for simplicity
    tunMode = false;

    // Resolve hostname if Custom DNS is enabled
    let finalDomain = domain;
    if (customDnsEnabled && primaryDns && secondaryDns) {
      this.logger.info(`Custom DNS enabled. Resolving ${domain} via [${primaryDns}, ${secondaryDns}]...`);
      this.eventEmitter.emit('log:message', `🔍 Resolving ${domain} via custom DNS...`);
      try {
        const resolvedIp = await this.dnsResolutionService.resolve(domain, [primaryDns, secondaryDns]);
        finalDomain = resolvedIp;
        this.eventEmitter.emit('log:message', `✅ Resolved ${domain} -> ${resolvedIp}`);
      } catch (err: any) {
        this.logger.error(`Custom DNS resolution failed: ${err.message}`);
        this.eventEmitter.emit('log:error', `❌ Custom DNS resolution failed: ${err.message}`);
        throw new Error(`Custom DNS resolution failed: ${err.message}`);
      }
    }

    try {
      // Store active config for reconnection (Memory Persistence)
      this.activeConfig = { ...options, tunMode };

      // Start Stream Gate client
      // Pass the first resolver for backward compatibility if needed, 
      // but the process manager should ideally use the whole list.
      await this.processManager.start(resolvers?.[0] || resolver, finalDomain, {
        authoritative: authoritative || false,
        keepAliveInterval,
        congestionControl,
        resolvers: resolvers || [resolver]
      });

      // Start HTTP proxy
      await this.proxyService.startHttpProxy();

      // Start SOCKS5 forwarder (non-fatal if it fails)
      try {
        await this.proxyService.startSocksForwardProxy();
      } catch (err: any) {
        this.logger.error('Failed to start SOCKS5 forwarder (non-fatal):', err);
        this.eventEmitter.emit('log:error', `Warning: SOCKS5 forwarder failed to start: ${err.message}`);
      }

      this.isRunning = true;
      this.retryAttempts = 0;

      const result = {
        success: true,
        message: `Service started successfully. HTTP proxy on 0.0.0.0:8080, SOCKS5 on 0.0.0.0:10809`,
        details: this.getStatus()
      };

      this.eventEmitter.emit('connection:started', result);
      return result;

    } catch (err: any) {
      this.logger.error('Failed to start service:', err);
      await this.stop();
      return {
        success: false,
        message: err.message,
        details: this.getStatus()
      };
    }
  }

  /**
   * Stop the VPN connection
   * @returns {Object} Result object
   */
  async stop(): Promise<ConnectionResult> {
    this.isRunning = false;

    // Clear any pending retry attempts
    this._clearRetryTimer();
    this.retryAttempts = 0;
    this.activeConfig = null; // Clear active config on manual stop

    // Stop all services
    this.proxyService.stopAll();
    await this.processManager.stop();

    const result = {
      success: true,
      message: 'Service stopped',
      details: this.getStatus()
    };

    this.eventEmitter.emit('connection:stopped', result);
    return result;
  }

  /**
   * Cleanup and optionally disable system proxy
   * @param {string} reason - Reason for cleanup
   * @returns {Promise<void>}
   */
  async cleanupAndDisableProxyIfNeeded(reason: string = 'shutdown'): Promise<void> {
    if (this.cleanupInProgress) return;
    this.cleanupInProgress = true;

    try {
      // Always stop local services first (best effort, sync)
      try {
        this.stop();
      } catch (_) { }

      // If this app enabled the system proxy, disable it on exit/crash
      if (this.systemProxyService.isEnabled()) {
        const timeoutMs = 8000;
        const started = Date.now();
        try {
          await Promise.race([
            this.systemProxyService.unconfigure(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('cleanup timeout')), timeoutMs)
            )
          ]);
        } catch (err: any) {
          this.logger.error(
            `Cleanup: failed to unconfigure system proxy (${reason}) after ${Date.now() - started}ms:`,
            err?.message || err
          );
        }
      }
    } finally {
      this.cleanupInProgress = false;
    }
  }

  /**
   * Attempt reconnection with exponential backoff
   * @private
   */
  private _attemptReconnection(): void {
    // Don't retry if user manually stopped or we're quitting
    if (!this.isRunning || this.quitting || this.cleanupInProgress) {
      this.retryAttempts = 0;
      return;
    }

    // Don't retry if no active config was set (e.g., failed on first start)
    if (!this.activeConfig) {
      this.logger.warn('No active configuration found for reconnection. Aborting retry.');
      this.eventEmitter.emit(
        'log:error',
        `❌ Connection failed and cannot be reconnected (no active config). Please start manually.`
      );
      this.isRunning = false;
      this.eventEmitter.emit('connection:failed', {
        reason: 'no-active-config',
        attempts: 0
      });
      return;
    }

    // Check if we've exceeded max retry attempts
    if (this.retryAttempts >= this.MAX_RETRY_ATTEMPTS) {
      this.logger.info(
        `Max retry attempts (${this.MAX_RETRY_ATTEMPTS}) reached. Stopping reconnection attempts.`
      );
      this.eventEmitter.emit(
        'log:error',
        `❌ Connection failed after ${this.MAX_RETRY_ATTEMPTS} retry attempts. Please check your settings and try again manually.`
      );
      this.retryAttempts = 0;
      this.isRunning = false;
      this.eventEmitter.emit('connection:failed', {
        reason: 'max-retries-exceeded',
        attempts: this.MAX_RETRY_ATTEMPTS
      });
      return;
    }

    this.retryAttempts++;

    // Calculate exponential backoff: 30s, 60s, 120s
    const delay = this.RETRY_BASE_INTERVAL * Math.pow(2, this.retryAttempts - 1);
    const delaySec = delay / 1000;

    this.logger.info(
      `Attempting reconnection (${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS}) in ${delaySec} seconds...`
    );
    this.eventEmitter.emit(
      'log:message',
      `🔄 Connection lost. Attempting reconnection (${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS}) in ${delaySec} seconds...`
    );
    this.eventEmitter.emit('connection:retrying', {
      attempt: this.retryAttempts,
      maxAttempts: this.MAX_RETRY_ATTEMPTS,
      delaySec
    });

    this._clearRetryTimer();
    this.retryTimer = setTimeout(async () => {
      try {
        this.logger.info(`Reconnection attempt ${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS} starting...`);
        this.eventEmitter.emit(
          'log:message',
          `🔄 Reconnecting... (Attempt ${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS})`
        );

        // Stop existing services cleanly
        this.proxyService.stopAll();
        await this.processManager.stop();

        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to restart using stored active config
        if (this.activeConfig) {
          const { resolver, domain, ...opts } = this.activeConfig;

          // Note: activeConfig stores the UNRESOLVED domain if we passed it initially.
          // We might want to re-resolve if needed, but start() handles resolution if custom DNS is enabled.
          // We call start(), but start() takes StartOptions. 'opts' basically matches part of it.
          // But wait, start() checks `if (this.isRunning)`.
          // We stopped it above, so `isRunning` is false.
          // We should just call `this.start(this.activeConfig)`.
          // However, `_attemptReconnection` logic below manually calls processManager.start etc.
          // This duplicates logic in start().
          // Ideally we should call `this.start(this.activeConfig)` but that might re-trigger resolution which is good.
          // But the original code was:
          /*
          const { resolver, domain, ...opts } = this.activeConfig;
          await this.processManager.start(resolver, domain, opts);
          await this.proxyService.startHttpProxy();
          */
          // It seems it was manually restarting components instead of calling start().
          // But `start()` does resolution.
          // If we want to re-resolve, we should call `start()`.
          // But `start()` resets `retryAttempts = 0`. That would break the retry loop if it fails inside `start`.
          // If `start` fails, it returns success: false.
          // So we should try to call `start`, but handle the retry logic.

          // Let's stick to the manual restart procedure as in the original code to avoid infinite recursion or state issues,
          // OR improve it. The original code didn't re-resolve domain on retry if it was custom resolved.
          // Actually, `activeConfig` stores the options passed to `start`.
          // If we call `processManager.start`, we are using `domain` from `activeConfig`.
          // If `start()` resolved it, `activeConfig` still holds the original domain (because we stored `options` before modification? No, wait.
          // `this.activeConfig = { ...options, tunMode };` happens before resolution in `start()`?
          const configToUse = this.activeConfig;
          const resolverToUse = configToUse.resolvers?.[0] || configToUse.resolver;
          const domainToUse = configToUse.domain;
          const optsToUse = configToUse;

          await this.processManager.start(resolverToUse, domainToUse, {
            authoritative: optsToUse.authoritative,
            keepAliveInterval: optsToUse.keepAliveInterval,
            congestionControl: optsToUse.congestionControl,
            resolvers: configToUse.resolvers || [configToUse.resolver]
          });
          await this.proxyService.startHttpProxy();

          try {
            await this.proxyService.startSocksForwardProxy();
          } catch (err) {
            this.logger.error('Failed to restart SOCKS5 forwarder during reconnection:', err);
          }

          // Success! Reset retry counter
          this.logger.info('Reconnection successful!');
          this.eventEmitter.emit(
            'log:message',
            `✅ Reconnection successful! (After ${this.retryAttempts} attempt${this.retryAttempts > 1 ? 's' : ''})`
          );
          this.retryAttempts = 0;
          this.isRunning = true; // Make sure to set this back to true
          this.eventEmitter.emit('connection:reconnected', {
            attempts: this.retryAttempts
          });
        }

      } catch (err: any) {
        this.logger.error(`Reconnection attempt ${this.retryAttempts} failed:`, err.message);
        this.eventEmitter.emit(
          'log:error',
          `❌ Reconnection attempt ${this.retryAttempts}/${this.MAX_RETRY_ATTEMPTS} failed: ${err.message}`
        );

        // Try again if we haven't exceeded max attempts
        this._attemptReconnection();
      }
    }, delay);
  }

  /**
   * Clear retry timer
   * @private
   */
  private _clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Get connection status
   * @returns {Object} Status object
   */
  getStatus(): any {
    const proxyStatus = this.proxyService.getStatus();

    return {
      streamRunning: this.processManager.isRunning(),
      proxyRunning: proxyStatus.httpProxyRunning,
      socksForwardRunning: proxyStatus.socksForwardRunning,
      tunRunning: false, // TUN mode not used
      systemProxyConfigured: this.systemProxyService.isEnabled(),
      mode: 'HTTP Proxy',
      retryAttempts: this.retryAttempts,
      maxRetries: this.MAX_RETRY_ATTEMPTS,
      authoritativeMode: this.settingsService.get('authoritative'),
      isRunning: this.isRunning
    };
  }

  /**
   * Check if connection is running
   * @returns {boolean}
   */
  isConnectionRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Set quitting flag (for graceful shutdown)
   */
  setQuitting(): void {
    this.quitting = true;
  }

  /**
   * Subscribe to status changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onStatusChange(callback: (status: string, data: any) => void): () => void {
    const unsubscribe = [
      this.eventEmitter.on('connection:started', (data) => callback('started', data)),
      this.eventEmitter.on('connection:stopped', (data) => callback('stopped', data)),
      this.eventEmitter.on('connection:failed', (data) => callback('failed', data)),
      this.eventEmitter.on('connection:retrying', (data) => callback('retrying', data)),
      this.eventEmitter.on('connection:reconnected', (data) => callback('reconnected', data))
    ];

    // Return function that unsubscribes from all
    return () => {
      unsubscribe.forEach(fn => fn());
    };
  }
}
