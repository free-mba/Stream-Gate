/**
 * ConnectionService - Orchestrates all services to establish VPN connection
 *
 * Single Responsibility: Connection lifecycle orchestration
 *
 * This service coordinates all other services to:
 * - Start/stop VPN connections
 * - Handle auto-reconnection with exponential backoff
 * - Provide connection status
 */

class ConnectionService {
  constructor(dependencies) {
    // Dependency injection
    this.processManager = dependencies.processManager;
    this.proxyService = dependencies.proxyService;
    this.systemProxyService = dependencies.systemProxyService;
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
    this.lastUsedResolver = null;
    this.lastUsedDomain = null;

    // Subscribe to process exit events for auto-reconnection
    this._setupEventListeners();
  }

  /**
   * Set up event listeners for auto-reconnection
   * @private
   */
  _setupEventListeners() {
    // Listen for process exit
    this.processManager.onExit((code) => {
      if (this.isRunning && !this.quitting && !this.cleanupInProgress) {
        this.logger.info('Stream Gate process died unexpectedly. Attempting automatic reconnection...');
        this._attemptReconnection();
      }
    });
  }

  /**
   * Start the VPN connection
   * @param {Object} options - Connection options
   * @param {string} options.resolver - DNS resolver
   * @param {string} options.domain - Server domain
   * @param {boolean} options.tunMode - Whether to use TUN mode (not used, always HTTP proxy)
   * @returns {Promise<Object>} Result object
   */
  async start(options = {}) {
    if (this.isRunning) {
      return { success: false, message: 'Service is already running' };
    }

    let { resolver, domain, tunMode = false } = options;

    // Always use HTTP Proxy mode - TUN mode removed for simplicity
    tunMode = false;

    try {
      // Use provided values or fall back to settings
      if (!resolver || !domain) {
        resolver = this.settingsService.get('resolver');
        domain = this.settingsService.get('domain');
      }

      // Save settings
      this.settingsService.save({
        resolver,
        domain,
        mode: tunMode ? 'tun' : 'proxy'
      });

      // Save for reconnection attempts
      this.lastUsedResolver = resolver;
      this.lastUsedDomain = domain;

      // Start Stream Gate client
      const authoritative = this.settingsService.get('authoritative');
      await this.processManager.start(resolver, domain, { authoritative });

      // Start HTTP proxy
      await this.proxyService.startHttpProxy();

      // Start SOCKS5 forwarder (non-fatal if it fails)
      try {
        await this.proxyService.startSocksForwardProxy();
      } catch (err) {
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

    } catch (err) {
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
  stop() {
    this.isRunning = false;

    // Clear any pending retry attempts
    this._clearRetryTimer();
    this.retryAttempts = 0;

    // Stop all services
    this.proxyService.stopAll();
    this.processManager.stop();

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
  async cleanupAndDisableProxyIfNeeded(reason = 'shutdown') {
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
        } catch (err) {
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
  _attemptReconnection() {
    // Don't retry if user manually stopped or we're quitting
    if (!this.isRunning || this.quitting || this.cleanupInProgress) {
      this.retryAttempts = 0;
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
        this.processManager.stop();

        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to restart
        const authoritative = this.settingsService.get('authoritative');
        await this.processManager.start(
          this.lastUsedResolver || this.settingsService.get('resolver'),
          this.lastUsedDomain || this.settingsService.get('domain'),
          { authoritative }
        );
        await this.proxyService.startHttpProxy();

        // Also restart SOCKS5 forwarder
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
        this.eventEmitter.emit('connection:reconnected', {
          attempts: this.retryAttempts
        });

      } catch (err) {
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
  _clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /**
   * Get connection status
   * @returns {Object} Status object
   */
  getStatus() {
    const proxyStatus = this.proxyService.getStatus();

    return {
      Stream GateRunning: this.processManager.isRunning(),
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
  isConnectionRunning() {
    return this.isRunning;
  }

  /**
   * Set quitting flag (for graceful shutdown)
   */
  setQuitting() {
    this.quitting = true;
  }

  /**
   * Subscribe to status changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onStatusChange(callback) {
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

module.exports = ConnectionService;
