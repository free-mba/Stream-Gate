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

const { spawn } = require('child_process');
const dns = require('dns');

class DNSService {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Parse DNS server string
   * @param {string} server - DNS server (e.g., "1.1.1.1" or "1.1.1.1:53")
   * @returns {Object|null} Parsed server info or null if invalid
   */
  parseDnsServer(server) {
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
  async pingHost(ip, timeoutMs = 2000) {
    const platform = process.platform;
    const timeout = Math.max(250, Number(timeoutMs) || 2000);

    let args = [];
    if (platform === 'win32') {
      args = ['-n', '1', '-w', String(timeout), ip];
    } else if (platform === 'darwin') {
      args = ['-c', '1', '-W', String(timeout), ip];
    } else {
      // linux: ping -c 1 -W <seconds>
      args = ['-c', '1', '-W', String(Math.ceil(timeout / 1000)), ip];
    }

    const start = Date.now();
    return await new Promise((resolve) => {
      const child = spawn('ping', args, { stdio: 'ignore' });
      let settled = false;

      const done = (ok) => {
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
  _withTimeout(promise, timeoutMs, errorMessage) {
    const timeout = Math.max(250, Number(timeoutMs) || 2500);
    let t = null;
    const timeoutPromise = new Promise((_, reject) => {
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
  async dnsResolveWithServer(serverForNode, domain, timeoutMs = 2500) {
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
      } catch (err2) {
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
  async checkSingleServer(payload) {
    try {
      const serverParsed = this.parseDnsServer(payload?.server);
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
      const dnsRes = ping.ok
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
    } catch (err) {
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
  async checkMultipleServers(servers, domain, options = {}) {
    const results = [];

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
}

module.exports = DNSService;
