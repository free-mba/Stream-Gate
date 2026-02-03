/**
 * SystemProxyService - Platform-specific system proxy configuration
 *
 * Single Responsibility: Configure system proxy settings
 *
 * Uses Strategy Pattern for platform-specific implementations.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import Logger from '../core/Logger';
import SettingsService from '../data/SettingsService';

const execAsync = promisify(exec);
const HTTP_PROXY_PORT = 8080;

interface ProxyConfigResult {
  success: boolean;
  serviceName?: string;
}

/**
 * Base class for system proxy configuration
 */
abstract class BaseSystemProxy {
  protected logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  abstract configure(): Promise<ProxyConfigResult>;
  abstract unconfigure(serviceName?: string): Promise<ProxyConfigResult>;
  abstract verifyConfiguration(): Promise<boolean>;

  protected async _disableIfMatches(iface: string): Promise<boolean> {
    // Default empty implementation or specific logic depending on base class needs
    // Since it was part of MacSystemProxy logic in JS version, but might be useful in others?
    // Actually, looking at JS code, _disableIfMatches is only in MacSystemProxy.
    // So I will move it there or keep abstract if intended for all.
    // JS code didn't define it in Base, only Mac used it.
    return false;
  }
}

/**
 * macOS system proxy configuration
 */
class MacSystemProxy extends BaseSystemProxy {
  async configure(): Promise<ProxyConfigResult> {
    try {
      // Get list of all network services
      const { stdout } = await execAsync('networksetup -listallnetworkservices');
      const services = stdout
        .split('\n')
        .filter(line => line.trim() && !line.includes('*') && !line.includes('An asterisk'));

      // Try common interface names first
      const preferredInterfaces = ['Wi-Fi', 'Ethernet', 'USB 10/100/1000 LAN', 'Thunderbolt Bridge'];

      for (const preferred of preferredInterfaces) {
        const matching = services.find(s =>
          s.includes(preferred) || s.toLowerCase().includes(preferred.toLowerCase())
        );
        if (matching) {
          try {
            const iface = matching.trim();
            await execAsync(`networksetup -setwebproxy "${iface}" 127.0.0.1 ${HTTP_PROXY_PORT}`);
            await execAsync(`networksetup -setsecurewebproxy "${iface}" 127.0.0.1 ${HTTP_PROXY_PORT}`);
            await execAsync(`networksetup -setwebproxystate "${iface}" on`);
            await execAsync(`networksetup -setsecurewebproxystate "${iface}" on`);
            this.logger.info(`System proxy configured via networksetup on ${iface}`);
            return { success: true, serviceName: iface };
          } catch (err: any) {
            this.logger.error(`Failed to configure proxy on ${matching}:`, err.message);
            continue;
          }
        }
      }

      // If still not configured, try the first available service
      if (services.length > 0) {
        const iface = services[0].trim();
        try {
          await execAsync(`networksetup -setwebproxy "${iface}" 127.0.0.1 ${HTTP_PROXY_PORT}`);
          await execAsync(`networksetup -setsecurewebproxy "${iface}" 127.0.0.1 ${HTTP_PROXY_PORT}`);
          await execAsync(`networksetup -setwebproxystate "${iface}" on`);
          await execAsync(`networksetup -setsecurewebproxystate "${iface}" on`);
          this.logger.info(`System proxy configured via networksetup on ${iface}`);
          return { success: true, serviceName: iface };
        } catch (err: any) {
          this.logger.error(`Failed to configure proxy on ${iface}:`, err.message);
        }
      }

      return { success: false };
    } catch (err: any) {
      this.logger.error('Failed to list network services:', err.message);
      return { success: false };
    }
  }

  async unconfigure(serviceName?: string): Promise<ProxyConfigResult> {
    let changed = false;

    // Disable proxy on specific service if provided
    if (serviceName) {
      changed = await this._disableIfMatches(serviceName);
    }

    // If not changed, scan all services
    if (!changed) {
      try {
        const { stdout } = await execAsync('networksetup -listallnetworkservices');
        const services = stdout
          .split('\n')
          .filter(line => line.trim() && !line.includes('*') && !line.includes('An asterisk'));

        for (const s of services) {
          const iface = s.trim();
          if (!iface) continue;
          const did = await this._disableIfMatches(iface);
          if (did) changed = true;
        }
      } catch (_) {
        // ignore
      }
    }

    if (changed) {
      this.logger.info('System proxy unconfigured via networksetup');
    }

    return { success: changed };
  }

  protected async _disableIfMatches(iface: string): Promise<boolean> {
    try {
      // We need to typecase execAsync return or handle catch properly. 
      // execAsync returns Promise<{stdout, stderr}>
      const [{ stdout: web }, { stdout: sec }] = await Promise.all([
        execAsync(`networksetup -getwebproxy "${iface}"`).catch(() => ({ stdout: '', stderr: '' })),
        execAsync(`networksetup -getsecurewebproxy "${iface}"`).catch(() => ({ stdout: '', stderr: '' }))
      ]);

      const matches =
        (web.includes('Enabled: Yes') && web.includes('127.0.0.1') && web.includes(String(HTTP_PROXY_PORT))) ||
        (sec.includes('Enabled: Yes') && sec.includes('127.0.0.1') && sec.includes(String(HTTP_PROXY_PORT)));

      if (!matches) return false;

      await execAsync(`networksetup -setwebproxystate "${iface}" off`).catch(() => { });
      await execAsync(`networksetup -setsecurewebproxystate "${iface}" off`).catch(() => { });
      return true;
    } catch (_) {
      return false;
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('networksetup -listallnetworkservices');
      const services = stdout
        .split('\n')
        .filter(line => line.trim() && !line.includes('*') && !line.includes('An asterisk'));

      const preferredInterfaces = ['Wi-Fi', 'Ethernet', 'USB 10/100/1000 LAN', 'Thunderbolt Bridge'];

      for (const preferred of preferredInterfaces) {
        const matching = services.find(s =>
          s.includes(preferred) || s.toLowerCase().includes(preferred.toLowerCase())
        );
        if (matching) {
          try {
            const iface = matching.trim();
            const { stdout: proxyStatus } = await execAsync(`networksetup -getwebproxy "${iface}"`);
            if (proxyStatus.includes('Enabled: Yes')) {
              return true;
            }
          } catch (err) {
            // Continue checking
          }
        }
      }
      return false;
    } catch (err) {
      return false;
    }
  }
}

/**
 * Windows system proxy configuration
 */
class WindowsSystemProxy extends BaseSystemProxy {
  async configure(): Promise<ProxyConfigResult> {
    try {
      await execAsync(`netsh winhttp set proxy proxy-server="127.0.0.1:${HTTP_PROXY_PORT}"`);
      this.logger.info('System proxy configured via netsh');
      return { success: true, serviceName: 'winhttp' };
    } catch (err: any) {
      this.logger.error('Failed to configure proxy via netsh:', err.message);
      return { success: false };
    }
  }

  async unconfigure(serviceName?: string): Promise<ProxyConfigResult> {
    try {
      // Check if current proxy matches our configuration
      const { stdout } = await execAsync('netsh winhttp show proxy');
      const matches =
        (stdout.includes('127.0.0.1:8080')) ||
        (stdout.includes('127.0.0.1') && stdout.includes(String(HTTP_PROXY_PORT)));

      if (!matches) {
        return { success: false };
      }

      await execAsync('netsh winhttp reset proxy');
      this.logger.info('System proxy unconfigured via netsh');
      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to unconfigure proxy via netsh:', err.message);
      return { success: false };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('netsh winhttp show proxy');
      return stdout.includes('127.0.0.1') && stdout.includes(String(HTTP_PROXY_PORT));
    } catch (err) {
      return false;
    }
  }
}

/**
 * Linux system proxy configuration
 */
class LinuxSystemProxy extends BaseSystemProxy {
  async configure(): Promise<ProxyConfigResult> {
    try {
      // Try GNOME settings first
      await execAsync(`gsettings set org.gnome.system.proxy mode 'manual'`);
      await execAsync(`gsettings set org.gnome.system.proxy.http host '127.0.0.1'`);
      await execAsync(`gsettings set org.gnome.system.proxy.http port ${HTTP_PROXY_PORT}`);
      await execAsync(`gsettings set org.gnome.system.proxy.https host '127.0.0.1'`);
      await execAsync(`gsettings set org.gnome.system.proxy.https port ${HTTP_PROXY_PORT}`);
      this.logger.info('System proxy configured via gsettings');
      return { success: true, serviceName: 'gsettings' };
    } catch (err: any) {
      this.logger.error('Failed to configure proxy via gsettings:', err.message);
      this.logger.info('Note: System proxy configuration may require manual setup on Linux');
      return { success: false };
    }
  }

  async unconfigure(serviceName?: string): Promise<ProxyConfigResult> {
    try {
      // Check if current proxy matches our configuration
      let matches = false;
      try {
        const [
          { stdout: mode },
          { stdout: httpHost },
          { stdout: httpPort },
          { stdout: httpsHost },
          { stdout: httpsPort }
        ] = await Promise.all([
          execAsync(`gsettings get org.gnome.system.proxy mode`).catch(() => ({ stdout: '', stderr: '' })),
          execAsync(`gsettings get org.gnome.system.proxy.http host`).catch(() => ({ stdout: '', stderr: '' })),
          execAsync(`gsettings get org.gnome.system.proxy.http port`).catch(() => ({ stdout: '', stderr: '' })),
          execAsync(`gsettings get org.gnome.system.proxy.https host`).catch(() => ({ stdout: '', stderr: '' })),
          execAsync(`gsettings get org.gnome.system.proxy.https port`).catch(() => ({ stdout: '', stderr: '' }))
        ]);

        const m = String(mode || '');
        const hh = String(httpHost || '');
        const hp = String(httpPort || '');
        const sh = String(httpsHost || '');
        const sp = String(httpsPort || '');

        const portStr = String(HTTP_PROXY_PORT);
        matches =
          m.includes('manual') &&
          ((hh.includes('127.0.0.1') && hp.includes(portStr)) ||
            (sh.includes('127.0.0.1') && sp.includes(portStr)));
      } catch (_) {
        matches = false;
      }

      if (!matches && !serviceName) {
        return { success: false };
      }

      await execAsync(`gsettings set org.gnome.system.proxy mode 'none'`);
      this.logger.info('System proxy unconfigured via gsettings');
      return { success: true };
    } catch (err: any) {
      this.logger.error('Failed to unconfigure proxy via gsettings:', err.message);
      return { success: false };
    }
  }

  async verifyConfiguration(): Promise<boolean> {
    try {
      const { stdout: mode } = await execAsync(`gsettings get org.gnome.system.proxy mode`);
      const { stdout: httpHost } = await execAsync(`gsettings get org.gnome.system.proxy.http host`);
      const { stdout: httpPort } = await execAsync(`gsettings get org.gnome.system.proxy.http port`);

      return mode.includes('manual') &&
        httpHost.includes('127.0.0.1') &&
        httpPort.includes(String(HTTP_PROXY_PORT));
    } catch (err) {
      return false;
    }
  }
}

/**
 * Main SystemProxyService - Factory for platform-specific implementations
 */
export default class SystemProxyService {
  private logger: Logger;
  private settingsService: SettingsService;
  private impl: BaseSystemProxy | null;

  constructor(logger: Logger, settingsService: SettingsService) {
    this.logger = logger;
    this.settingsService = settingsService;

    // Create platform-specific implementation
    const platform = process.platform;
    if (platform === 'darwin') {
      this.impl = new MacSystemProxy(logger);
    } else if (platform === 'win32') {
      this.impl = new WindowsSystemProxy(logger);
    } else if (platform === 'linux') {
      this.impl = new LinuxSystemProxy(logger);
    } else {
      this.logger.warn(`Unsupported platform for system proxy: ${platform}`);
      this.impl = null;
    }
  }

  /**
   * Configure system proxy
   * @returns {Promise<{success: boolean, serviceName?: string}>}
   */
  async configure(): Promise<ProxyConfigResult> {
    if (!this.impl) {
      this.logger.warn('System proxy configuration not supported on this platform');
      return { success: false };
    }

    const result = await this.impl.configure();

    if (result.success) {
      this.settingsService.save({
        systemProxyEnabledByApp: true,
        systemProxyServiceName: result.serviceName || ''
      });
      this.logger.info('System proxy configured and enabled successfully');
    } else {
      this.logger.error('System proxy configuration failed. You may need admin privileges.');
    }

    return result;
  }

  /**
   * Unconfigure system proxy (only if we configured it)
   * @returns {Promise<{success: boolean}>}
   */
  async unconfigure(): Promise<ProxyConfigResult> {
    if (!this.impl) {
      return { success: false };
    }

    const systemProxyEnabledByApp = this.settingsService.get('systemProxyEnabledByApp');
    const systemProxyServiceName = this.settingsService.get('systemProxyServiceName');

    // Only unconfigure if this app originally configured it
    if (!systemProxyEnabledByApp) {
      this.logger.info('System proxy was not configured by this app, skipping unconfiguration');
      return { success: false };
    }

    const result = await this.impl.unconfigure(systemProxyServiceName);

    if (result.success) {
      this.settingsService.save({
        systemProxyEnabledByApp: false,
        systemProxyServiceName: ''
      });
    }

    return result;
  }

  /**
   * Verify system proxy is configured
   * @returns {Promise<boolean>}
   */
  async verifyConfiguration(): Promise<boolean> {
    if (!this.impl) {
      return false;
    }
    return await this.impl.verifyConfiguration();
  }

  /**
   * Check if system proxy is enabled by this app
   * @returns {boolean}
   */
  isEnabled(): boolean {
    return this.settingsService.get('systemProxyEnabledByApp') || false;
  }

  /**
   * Get the active service name
   * @returns {string}
   */
  getActiveService(): string {
    return this.settingsService.get('systemProxyServiceName') || '';
  }
}
