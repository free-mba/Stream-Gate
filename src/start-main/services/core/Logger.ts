/**
 * Logger - Structured logging with verbosity control
 *
 * Single Responsibility: Provide structured logging interface
 *
 * All logging should go through this service to ensure
 * consistent formatting and verbosity control.
 */

import EventEmitter from './EventEmitter';

interface LogEntry {
  timestamp: number;
  iso: string;
  level: string;
  message: string;
  meta: any;
}

export default class Logger {
  private eventEmitter: EventEmitter;
  private _verboseEnabled: boolean;
  private _logs: LogEntry[];
  private readonly _MAX_LOG_AGE: number;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
    this._verboseEnabled = false;
    this._logs = []; // Store logs in memory
    this._MAX_LOG_AGE = 2 * 60 * 1000; // 2 minutes in milliseconds
  }

  /**
   * Set verbosity level
   * @param {boolean} enabled - Whether verbose logging is enabled
   */
  setVerbose(enabled: boolean): void {
    this._verboseEnabled = !!enabled;
  }

  /**
   * Check if verbose logging is enabled
   * @returns {boolean}
   */
  isVerbose(): boolean {
    return this._verboseEnabled;
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   * @param {Object} [meta] - Optional metadata
   */
  info(message: string, meta?: any): void {
    this._addLog('info', message, meta);
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
  error(message: string, error?: Error | any): void {
    this._addLog('error', message, error);
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
  verbose(message: string, meta?: any): void {
    if (!this._verboseEnabled) {
      return;
    }

    this._addLog('verbose', message, meta);
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
  warn(message: string, meta?: any): void {
    this._addLog('warn', message, meta);
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
   * Add log to internal storage and prune old logs
   * @private
   */
  private _addLog(level: string, message: string, meta: any): void {
    const timestamp = Date.now();
    const entry: LogEntry = {
      timestamp,
      iso: new Date(timestamp).toISOString(),
      level,
      message,
      meta: meta instanceof Error ? { message: meta.message, stack: meta.stack } : meta
    };

    this._logs.push(entry);
    this._pruneLogs();
  }

  /**
   * Remove logs older than MAX_LOG_AGE
   * @private
   */
  private _pruneLogs(): void {
    const cutoff = Date.now() - this._MAX_LOG_AGE;
    // Optimization: if the first log is new enough, everything is new enough
    if (this._logs.length > 0 && this._logs[0].timestamp > cutoff) {
      return;
    }

    // Filter out old logs
    // Using filter is simpler, but if array is huge, splice might be better. 
    // Given 2 minutes retention, it might not get too huge unless spamming.
    // We can just find the index where to slice.
    const splitIndex = this._logs.findIndex(log => log.timestamp > cutoff);
    if (splitIndex > 0) {
      this._logs = this._logs.slice(splitIndex);
    } else if (splitIndex === -1 && this._logs.length > 0 && this._logs[this._logs.length - 1].timestamp <= cutoff) {
      // All logs are too old
      this._logs = [];
    }
  }

  /**
   * Get all stored logs
   * @returns {Array} Array of log objects
   */
  getLogs(): LogEntry[] {
    // Perform a prune before returning to ensure freshness
    this._pruneLogs();
    return this._logs;
  }

  /**
   * Format a log entry
   * @private
   */
  private _formatLog(level: string, message: string, meta: any): string {
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
  sendToRenderer(channel: string, message: any): void {
    this.eventEmitter.emit('renderer:send', {
      channel,
      message
    });
  }
}
