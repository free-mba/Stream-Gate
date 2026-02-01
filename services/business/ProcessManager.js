/**
 * ProcessManager - Native binary process lifecycle management
 *
 * Single Responsibility: Manage Stream Gate client process
 *
 * Handles spawning, monitoring, and terminating the native Stream Gate binary.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class ProcessManager {
  constructor(eventEmitter, logger, app) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.app = app;

    this.process = null;
  }

  /**
   * Get the path to the Stream Gate client binary
   * @returns {string|null} Path to binary or null if unsupported
   * @private
   */
  _getClientPath() {
    const platform = process.platform;
    const resourcesPath = this.app.isPackaged
      ? path.join(process.resourcesPath)
      : path.join(__dirname, '../../');

    if (platform === 'darwin') {
      const preferred =
        process.arch === 'arm64' ? 'stream-client-mac-arm64' : 'stream-client-mac-intel';
      const fallback =
        process.arch === 'arm64' ? 'stream-client-mac-intel' : 'stream-client-mac-arm64';
      const candidates = [
        // Preferred: packaged and dev both keep binaries under ./binaries/
        path.join(resourcesPath, 'binaries', preferred),
        // Back-compat: allow repo-root placement during transition
        path.join(resourcesPath, preferred),
        // Extra back-compat: legacy single mac binary name
        path.join(resourcesPath, 'binaries', 'stream-client-mac'),
        path.join(resourcesPath, 'stream-client-mac'),
        // If user runs under Rosetta, try the other arch too (if present)
        path.join(resourcesPath, 'binaries', fallback),
        path.join(resourcesPath, fallback)
      ];
      return candidates.find((p) => fs.existsSync(p)) || candidates[0];
    } else if (platform === 'win32') {
      const candidates = [
        path.join(resourcesPath, 'binaries', 'stream-client-win.exe'),
        path.join(resourcesPath, 'stream-client-win.exe')
      ];
      return candidates.find((p) => fs.existsSync(p)) || candidates[0];
    } else if (platform === 'linux') {
      const candidates = [
        path.join(resourcesPath, 'binaries', 'stream-client-linux'),
        path.join(resourcesPath, 'stream-client-linux')
      ];
      return candidates.find((p) => fs.existsSync(p)) || candidates[0];
    }
    return null;
  }

  /**
   * Ensure the binary has execute permissions (Unix only)
   * @param {string} clientPath - Path to binary
   * @private
   */
  _ensureExecutablePermissions(clientPath) {
    if ((process.platform === 'darwin' || process.platform === 'linux') && fs.existsSync(clientPath)) {
      try {
        // Check if file is executable, if not, make it executable
        fs.accessSync(clientPath, fs.constants.X_OK);
      } catch (err) {
        // File is not executable, set execute permission automatically
        try {
          fs.chmodSync(clientPath, 0o755);
          this.logger.info(`Automatically set execute permissions on ${path.basename(clientPath)}`);
        } catch (chmodErr) {
          // If file system is read-only (e.g. DMG), we can't chmod.
          if (chmodErr.code === 'EROFS') {
            this.logger.warn(`Could not set permissions on read-only filesystem: ${chmodErr.message}`);
          } else {
            this.logger.error(`Failed to set permissions: ${chmodErr.message}`);
          }
        }
      }
    }
  }

  /**
   * Start the Stream Gate client process
   * @param {string} resolver - DNS resolver (e.g., "8.8.8.8:53")
   * @param {string} domain - Stream Gate server domain
   * @param {Object} options - Additional options
   * @param {boolean} options.authoritative - Use authoritative mode instead of resolver mode
   * @returns {Promise<void>}
   */
  async start(resolver, domain, options = {}) {
    const { authoritative = false } = options;

    const clientPath = this._getClientPath();
    if (!clientPath) {
      throw new Error('Unsupported platform');
    }

    if (!fs.existsSync(clientPath)) {
      const where = this.app.isPackaged ? 'inside the app resources folder' : 'in the project folder';
      const baseMsg = `Stream Gate client binary not found ${where}.`;
      const expectedMsg = `Expected at: ${clientPath}`;
      const hint =
        process.platform === 'win32'
          ? 'This usually means the installer was built without the Windows client binary, or it was quarantined/removed by antivirus. Reinstall, or whitelist the app folder, and ensure the build includes stream-client-win.exe.\n\nWindows Defender tip: open Windows Security → Virus & threat protection → Protection history, restore/allow "stream-client-win.exe" if quarantined, and add an Exclusion for the install folder.'
          : process.platform === 'darwin'
            ? 'Ensure the correct macOS Stream Gate client binary exists under ./binaries/ (stream-client-mac-arm64 or stream-client-mac-intel) and is executable.'
            : 'Ensure the correct Stream Gate client binary exists under ./binaries/ and is executable.';
      throw new Error(`${baseMsg}\n${expectedMsg}\n${hint}`);
    }

    // Ensure execute permissions on macOS and Linux
    this._ensureExecutablePermissions(clientPath);

    const args = [
      authoritative ? '--authoritative' : '--resolver',
      resolver,
      '--domain',
      domain
    ];

    this.logger.info(`Starting Stream Gate client: ${clientPath}`, { args });

    this.process = spawn(clientPath, args, {
      stdio: 'pipe',
      detached: false
    });

    // Set up output handlers
    this.process.stdout.on('data', (data) => {
      const output = data.toString();
      this.logger.verbose(`Stream Gate: ${output}`);
      this.eventEmitter.emit('process:output', output);
    });

    this.process.stderr.on('data', (data) => {
      const errorStr = data.toString();
      this.logger.error(`Stream Gate Error: ${errorStr}`);

      // Check for port already in use error
      if (errorStr.includes('Address already in use') || errorStr.includes('EADDRINUSE')) {
        this.logger.warn('Port 5201 is already in use. Trying to kill existing process...');
        const { exec } = require('child_process');
        exec('lsof -ti:5201 | xargs kill -9 2>/dev/null', (err) => {
          if (!err) {
            this.logger.info('Killed process using port 5201. Please restart the VPN.');
            this.eventEmitter.emit('process:error', 'Port 5201 was in use. Killed existing process. Please restart the VPN.');
          }
        });
      }

      this.eventEmitter.emit('process:error', errorStr);
    });

    this.process.on('close', (code) => {
      this.logger.info(`Stream Gate process exited with code ${code}`);
      this.process = null;
      this.eventEmitter.emit('process:exit', code);
    });

    // Wait for process to be ready
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        fn(value);
      };

      // If spawn fails (e.g., ENOENT), reject instead of crashing/pretending success.
      this.process.once('error', (err) => {
        const msg = `Stream Gate failed to start: ${err.code || 'ERROR'} ${err.message || String(err)}`;
        this.logger.error(msg);
        this.process = null;
        this.eventEmitter.emit('process:error', msg);
        settle(reject, new Error(`Stream Gate client failed to start: ${err.message || String(err)}`));
      });

      // Only start the readiness timer after the process actually spawned.
      this.process.once('spawn', () => {
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.logger.info('Stream Gate client is ready');
            settle(resolve);
          } else {
            settle(reject, new Error('Stream Gate client failed to start'));
          }
        }, 2000);
      });
    });
  }

  /**
   * Stop the Stream Gate client process
   */
  stop() {
    if (this.process) {
      this.logger.info('Stopping Stream Gate client');
      this.process.kill();
      this.process = null;
    }
  }

  /**
   * Check if the process is running
   * @returns {boolean}
   */
  isRunning() {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Get the process instance
   * @returns {ChildProcess|null}
   */
  getProcess() {
    return this.process;
  }

  /**
   * Register a callback for process output events
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onOutput(callback) {
    return this.eventEmitter.on('process:output', callback);
  }

  /**
   * Register a callback for process error events
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onError(callback) {
    return this.eventEmitter.on('process:error', callback);
  }

  /**
   * Register a callback for process exit events
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  onExit(callback) {
    return this.eventEmitter.on('process:exit', callback);
  }
}

module.exports = ProcessManager;
