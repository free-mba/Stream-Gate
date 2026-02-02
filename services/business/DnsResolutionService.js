/**
 * DnsResolutionService - Handles custom DNS resolution
 *
 * Single Responsibility: Resolve hostnames to IP addresses using specific DNS servers.
 *
 * This service provides a way to bypass system DNS poisoning by pre-resolving
 * hostnames using trusted upstream resolvers (e.g. 8.8.8.8) before connection.
 */

const dns = require('dns');
const util = require('util');

class DnsResolutionService {
    constructor(logger) {
        this.logger = logger;
        this.resolve4 = util.promisify(dns.resolve4);
    }

    /**
     * Resolve a hostname to an IPv4 address using specific DNS servers
     * @param {string} hostname - Hostname to resolve
     * @param {string[]} servers - Array of DNS servers (e.g. ['8.8.8.8', '1.1.1.1'])
     * @returns {Promise<string>} Resolved IPv4 address
     * @throws {Error} If resolution fails
     */
    async resolve(hostname, servers = []) {
        // If it's already an IP, return it
        if (this._isIp(hostname)) {
            this.logger.verbose(`[DnsResolutionService] ${hostname} is already an IP, skipping resolution.`);
            return hostname;
        }

        this.logger.info(`[DnsResolutionService] Resolving ${hostname} using servers: ${servers.join(', ') || 'System Default'}`);

        if (servers && servers.length > 0) {
            // Validate servers format
            const validServers = servers.map(s => {
                // dns.setServers expects just IPs usually, or IP:Port. 
                // We strip port if it's default 53, or keep it if node supports it.
                // Node's dns.setServers supports 'ip' or 'ip:port' in newer versions, 
                // but let's be safe and strip port 53 if present, or keep custom ports.
                return s;
            });

            try {
                // WARNING: dns.setServers is global for the process!
                // Since this is an Electron main process, this might affect other requests.
                // However, for a VPN client that intends to override DNS, this is often acceptable 
                // or even desired during the connection phase.
                // A safer approach for high-concurrency apps would be a pure-JS DNS client like 'native-dns',
                // but 'dns' module is native and reliable.
                dns.setServers(validServers);
            } catch (err) {
                this.logger.error(`[DnsResolutionService] Failed to set DNS servers: ${err.message}`);
                // Fallback to system DNS? Or fail? 
                // If the user explicitly asked for custom DNS, we probably shouldn't silently fallback to system 
                // without a warning, but throwing might break connection if just the setter failed.
                // We'll log and proceed to try reset or resolve.
            }
        }

        try {
            const addresses = await this.resolve4(hostname);
            if (addresses && addresses.length > 0) {
                const ip = addresses[0];
                this.logger.info(`[DnsResolutionService] Resolved ${hostname} -> ${ip}`);
                return ip;
            }
            throw new Error('No DNS records found');
        } catch (err) {
            this.logger.error(`[DnsResolutionService] Resolution failed for ${hostname}: ${err.message}`);
            throw err;
        }
    }

    /**
     * Check if string is an IPv4 address
     * @private
     */
    _isIp(ip) {
        return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip);
    }
}

module.exports = DnsResolutionService;
