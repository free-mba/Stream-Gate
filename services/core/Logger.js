/**
 * Logger - Structured logging with verbosity control
 *
 * Single Responsibility: Provide structured logging interface
 *
 * All logging should go through this service to ensure
 * consistent formatting and verbosity control.
 */

class Logger {
  constructor(eventEmitter) {
    this.eventEmitter = eventEmitter;
    this._verboseEnabled = false;
  }

  /**
   * Set verbosity level
   * @param {boolean} enabled - Whether verbose logging is enabled
   */
  setVerbose(enabled) {
    this._verboseEnabled = !!enabled;
  }

  /**
   * Check if verbose logging is enabled
   * @returns {boolean}
   */
  isVerbose() {
    return this._verboseEnabled;
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {Object} [meta] - Optional metadata
   */
  info(message, meta) {
    const logEntry = this._formatLog('info', message, meta);
    console.log(logEntry);

    // Emit event for UI to display
    this.eventEmitter.emit('log:message', {
      level: 'info',
      message,
      meta,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log an error message
   * @param {string} message - Error message
   * @param {Error} [error] - Optional error object
   */
  error(message, error) {
    const logEntry = this._formatLog('error', message, error);
    console.error(logEntry);

    // Emit event for UI to display
    this.eventEmitter.emit('log:error', {
      level: 'error',
      message,
      error: error ? error.message : undefined,
      stack: error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log a verbose message (only when verbose mode is enabled)
   * @param {string} message - Message to log
   * @param {Object} [meta] - Optional metadata
   */
  verbose(message, meta) {
    if (!this._verboseEnabled) {
      return;
    }

    const logEntry = this._formatLog('verbose', message, meta);
    console.log(logEntry);

    // Emit event for UI to display
    this.eventEmitter.emit('log:message', {
      level: 'verbose',
      message,
      meta,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log a warning message
   * @param {string} message - Warning message
   * @param {Object} [meta] - Optional metadata
   */
  warn(message, meta) {
    const logEntry = this._formatLog('warn', message, meta);
    console.warn(logEntry);

    // Emit event for UI to display
    this.eventEmitter.emit('log:message', {
      level: 'warn',
      message,
      meta,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Format a log entry
   * @private
   */
  _formatLog(level, message, meta) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (meta) {
      if (meta instanceof Error) {
        return `${prefix} ${message}\n${meta.stack}`;
      }
      return `${prefix} ${message} ${JSON.stringify(meta)}`;
    }

    return `${prefix} ${message}`;
  }

  /**
   * Send log message to UI renderer
   * @param {string} channel - IPC channel
   * @param {string} message - Message to send
   */
  sendToRenderer(channel, message) {
    this.eventEmitter.emit('renderer:send', {
      channel,
      message
    });
  }
}

module.exports = Logger;
