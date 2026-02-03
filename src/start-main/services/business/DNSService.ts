/**
 * DNSService - DNS checking and validation utilities
 *
 * Single Responsibility: DNS diagnostics
 *
 * Provides utilities for:
 * - Parsing DNS server addresses
 * - Pinging hosts
 * - Resolving domains with specific DNS servers
 */

import { spawn } from 'child_process';
import dns from 'dns';
import { Worker } from 'worker_threads';
import path from 'path';
import Logger from '../core/Logger';

interface DnsServerInfo {
  ip: string;
  port: number;
  serverForNode: string;
}

interface PingResult {
  ok: boolean;
  timeMs: number;
}

interface DnsResolveResult {
  ok: boolean;
  timeMs: number;
  answers: any[];
  error?: string;
}

interface DnsCheckResult {
  ok: boolean;
  server?: string;
  ip?: string;
  port?: number;
  domain?: string;
  ping?: PingResult;
  dns?: DnsResolveResult;
  status?: string;
  error?: string;
}

interface CheckSingleServerPayload {
  server?: string;
  domain?: string;
  pingTimeoutMs?: number;
  dnsTimeoutMs?: number;
}

interface StartScanPayload {
  servers: string[];
  domain?: string;
  mode?: string;
  timeout?: number;
  workers?: number;
}

export default class DNSService {
  private logger: Logger;
  private scanWorker: Worker | null;
  private isScanning: boolean;

  constructor(logger: Logger) {
    this.logger = logger;
    this.scanWorker = null;
    this.isScanning = false;
  }

  /**
   * Parse DNS server string
   * @param {string} server - DNS server (e.g., "1.1.1.1" or "1.1.1.1:53")
   * @returns {Object|null} Parsed server info or null if invalid
   */
  parseDnsServer(server: string): DnsServerInfo | null {
    const raw = String(server || '').trim();
    if (!raw) return null;

    // Accept IPv4 with optional port (e.g. "1.1.1.1" or "1.1.1.1:53")
    const m = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/);
    if (!m) return null;

    const ip = m[1];
    const port = m[2] ? Number(m[2]) : 53;
    if (!Number.isFinite(port) || port < 1 || port > 65535) return null;

    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
      return null;
    }

    return { ip, port, serverForNode: `${ip}:${port}` };
  }

  /**
   * Ping a host
   * @param {string} ip - IP address to ping
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<{ok: boolean, timeMs: number}>}
   */
  async pingHost(ip: string, timeoutMs: number = 2000): Promise<PingResult> {
    const platform = process.platform;
    const timeout = Math.max(250, Number(timeoutMs) || 2000);

    let args: string[] = [];
    if (platform === 'win32') {
      args = ['-n', '1', '-w', String(timeout), ip];
    } else if (platform === 'darwin') {
      args = ['-c', '1', '-W', String(timeout), ip];
    } else {
      // linux: ping -c 1 -W <seconds> (using seconds, ceil to ensure at least 1)
      args = ['-c', '1', '-W', String(Math.ceil(timeout / 1000)), ip];
    }

    const start = Date.now();
    return await new Promise<PingResult>((resolve) => {
      const child = spawn('ping', args, { stdio: 'ignore' });
      let settled = false;

      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve({ ok, timeMs: Date.now() - start });
      };

      const killTimer = setTimeout(() => {
        try { child.kill(); } catch (_) { }
        done(false);
      }, timeout + 1500);

      child.on('error', () => {
        clearTimeout(killTimer);
        done(false);
      });

      child.on('close', (code) => {
        clearTimeout(killTimer);
        done(code === 0);
      });
    });
  }

  /**
   * Wrap a promise with timeout
   * @param {Promise} promise - Promise to wrap
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {string} errorMessage - Error message on timeout
   * @returns {Promise}
   * @private
   */
  private _withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    const timeout = Math.max(250, Number(timeoutMs) || 2500);
    let t: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
      t = setTimeout(() => reject(new Error(errorMessage || 'Timeout')), timeout);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (t) clearTimeout(t);
    });
  }

  /**
   * Resolve a domain using a specific DNS server
   * @param {string} serverForNode - DNS server in format "ip:port"
   * @param {string} domain - Domain to resolve
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<{ok: boolean, timeMs: number, answers: Array, error?: string}>}
   */
  async dnsResolveWithServer(serverForNode: string, domain: string, timeoutMs: number = 2500): Promise<DnsResolveResult> {
    const resolver = new dns.promises.Resolver();
    resolver.setServers([serverForNode]);

    const start = Date.now();
    try {
      const answers = await this._withTimeout(
        resolver.resolve4(domain),
        timeoutMs,
        'DNS resolve timeout'
      );
      return { ok: true, timeMs: Date.now() - start, answers };
    } catch (err) {
      // Try AAAA as fallback (some domains may be IPv6-only)
      try {
        const answers = await this._withTimeout(
          resolver.resolve6(domain),
          timeoutMs,
          'DNS resolve timeout'
        );
        return { ok: true, timeMs: Date.now() - start, answers };
      } catch (err2: any) {
        return {
          ok: false,
          timeMs: Date.now() - start,
          answers: [],
          error: err2?.message || String(err2)
        };
      }
    }
  }

  /**
   * Check a single DNS server
   * @param {Object} payload - Check parameters
   * @param {string} payload.server - DNS server address
   * @param {string} payload.domain - Test domain
   * @param {number} payload.pingTimeoutMs - Ping timeout
   * @param {number} payload.dnsTimeoutMs - DNS timeout
   * @returns {Promise<Object>} Check result
   */
  async checkSingleServer(payload: CheckSingleServerPayload): Promise<DnsCheckResult> {
    try {
      const server = payload?.server;
      if (!server) {
        return {
          ok: false,
          error: 'Server address is required.'
        }
      }
      const serverParsed = this.parseDnsServer(server);
      const domain = String(payload?.domain || '').trim();
      const pingTimeoutMs = Number(payload?.pingTimeoutMs) || 2000;
      const dnsTimeoutMs = Number(payload?.dnsTimeoutMs) || 2500;

      if (!serverParsed) {
        return {
          ok: false,
          error: 'Invalid DNS server. Use IPv4 or IPv4:port (e.g. 1.1.1.1 or 1.1.1.1:53).'
        };
      }

      if (!domain) {
        return {
          ok: false,
          error: 'Test domain is required (e.g. google.com).'
        };
      }

      const ping = await this.pingHost(serverParsed.ip, pingTimeoutMs);
      const dnsRes: DnsResolveResult = ping.ok
        ? await this.dnsResolveWithServer(serverParsed.serverForNode, domain, dnsTimeoutMs)
        : { ok: false, timeMs: 0, answers: [], error: 'Ping failed' };

      let status = 'Unreachable';
      if (ping.ok && dnsRes.ok) status = 'OK';
      else if (ping.ok) status = 'Ping Only';

      return {
        ok: true,
        server: serverParsed.serverForNode,
        ip: serverParsed.ip,
        port: serverParsed.port,
        domain,
        ping,
        dns: dnsRes,
        status
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err?.message || String(err)
      };
    }
  }

  /**
   * Check multiple DNS servers
   * @param {Array<string>} servers - List of DNS servers
   * @param {string} domain - Test domain
   * @param {Object} options - Options
   * @returns {Promise<Array>} Array of check results
   */
  async checkMultipleServers(servers: string[], domain: string, options: Partial<CheckSingleServerPayload> = {}): Promise<DnsCheckResult[]> {
    const results: DnsCheckResult[] = [];

    for (const server of servers) {
      const result = await this.checkSingleServer({
        server,
        domain,
        ...options
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Start a high-performance DNS scan using worker threads
   * @param {Object} payload
   * @param {Array<string>} payload.servers
   * @param {string} payload.domain
   * @param {string} payload.mode - 'dnstt' or 'Stream Gate'
   * @param {number} payload.timeout - timeout in seconds
   * @param {number} payload.workers - concurrency count
   * @param {Function} onProgress - callback(completedCount, totalCount)
   * @param {Function} onResult - callback(resultItem)
   * @param {Function} onComplete - callback()
   */
  async startScan(
    payload: StartScanPayload,
    onProgress?: (completed: number, total: number) => void,
    onResult?: (result: any) => void,
    onComplete?: () => void
  ): Promise<void> {
    if (this.scanWorker) {
      await this.stopScan();
    }

    const servers = payload.servers || [];
    const domain = payload.domain || 'google.com';
    const mode = payload.mode || 'stream';
    const timeout = payload.timeout || 3;
    const concurrency = Math.min(Math.max(1, payload.workers || 50), 500);

    this.logger.info(`Starting DNS Scan: ${servers.length} servers, mode=${mode}, concurrency=${concurrency}`);

    // Update path reference to be compatible with built structure or source structure
    // Since we are compiling, we should expect the worker script to be copied or exist nearby.
    // NOTE: This might need adjustment in build script to ensure `dns-scanner-worker.js` is in `dist/scripts` or similar.
    // For now assuming the relative path still works if structure is preserved.
    const workerPath = path.join(__dirname, '../../scripts/dns-scanner-worker.js'); // This likely refers to src location.

    // In production/dist, we might need a different path.
    // Let's assume for now it will be handled or we are running from src.
    if (!require('fs').existsSync(workerPath)) {
      this.logger.warn(`Worker script not found at ${workerPath}`);
    }

    this.scanWorker = new Worker(workerPath);

    let completed = 0;
    let active = 0;
    let queueIndex = 0;
    const total = servers.length;
    this.isScanning = true;

    const processQueue = () => {
      if (!this.isScanning) return;

      while (active < concurrency && queueIndex < total) {
        const server = servers[queueIndex++];
        if (this.scanWorker) {
          this.scanWorker.postMessage({ server, domain, mode, timeout });
          active++;
        }
      }

      if (active === 0 && queueIndex >= total) {
        this.stopScan();
        if (onComplete) onComplete();
      }
    };

    this.scanWorker.on('message', (msg) => {
      active--;
      completed++;

      if (onResult) onResult(msg);
      if (onProgress) onProgress(completed, total);

      processQueue();
    });

    this.scanWorker.on('error', (err) => {
      this.logger.error('DNS Worker Error:', err);
    });

    this.scanWorker.on('exit', (code) => {
      if (code !== 0 && this.isScanning) {
        this.logger.error(`DNS Worker stopped with exit code ${code}`);
      }
    });

    // Initial fill
    processQueue();
  }

  async stopScan(): Promise<void> {
    this.isScanning = false;
    if (this.scanWorker) {
      await this.scanWorker.terminate();
      this.scanWorker = null;
      this.logger.info('DNS Scan stopped');
    }
  }
}
