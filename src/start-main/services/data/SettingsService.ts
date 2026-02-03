/**
 * SettingsService - Settings persistence and validation
 *
 * Single Responsibility: Manage application settings
 *
 * Handles loading, saving, and validating settings from disk.
 * Migrates legacy settings to userData directory for packaged apps.
 */

import path from 'node:path';
import fs from 'node:fs';
import { App } from 'electron';
import crypto from 'node:crypto';
import Logger from '../core/Logger';

// Define configuration interfaces
interface SocksAuth {
  username?: string;
  password?: string;
}

interface ConfigItem {
  id: string;
  remark: string;
  domain: string;
  country?: string;
  socks?: SocksAuth;
}

export interface Settings {
  resolver: string;
  domain: string;
  mode: 'proxy' | 'tun';
  authoritative: boolean;
  verbose: boolean;
  socks5AuthEnabled: boolean;
  socks5AuthUsername?: string;
  socks5AuthPassword?: string;
  systemProxyEnabledByApp: boolean;
  systemProxyServiceName: string;
  configs: ConfigItem[];
  selectedConfigId: string | null;
  savedDns: string[];
  customDnsEnabled: boolean;
  primaryDns: string;
  secondaryDns: string;
}

interface DnsServerParseResult {
  ip: string;
  port: number;
  serverForNode: string;
}

interface ImportResult {
  success: boolean;
  count?: number;
  errors?: number | string;
  error?: string;
}

export default class SettingsService {
  private logger: Logger;
  private app: App;
  private defaults: Settings;
  private settings: Settings;
  private SETTINGS_FILE_BASENAME: string;
  private SETTINGS_FILE: string | null;
  private LEGACY_SETTINGS_FILE: string;

  constructor(logger: Logger, app: App) {
    this.logger = logger;
    this.app = app;

    // Default settings
    this.defaults = {
      resolver: '8.8.8.8:53',
      domain: 's.example.com',
      mode: 'proxy',
      authoritative: false,
      verbose: false,
      socks5AuthEnabled: false,
      socks5AuthUsername: '',
      socks5AuthPassword: '',
      systemProxyEnabledByApp: false,
      systemProxyServiceName: '',
      configs: [], // Array of { id, remark, domain, socks: { username, password }, country }
      selectedConfigId: null, // ID of the currently selected configuration
      savedDns: ['8.8.8.8:53', '1.1.1.1:53'], // Custom/Saved DNS list
      // Custom DNS Configuration (Remote/Outbound Resolve)
      customDnsEnabled: false,
      primaryDns: '8.8.8.8',
      secondaryDns: '1.1.1.1'
    };

    // Current in-memory settings
    this.settings = { ...this.defaults };

    // File paths
    this.SETTINGS_FILE_BASENAME = 'settings.json';
    this.SETTINGS_FILE = null;
    this.LEGACY_SETTINGS_FILE = path.join(__dirname, '../../', this.SETTINGS_FILE_BASENAME);
  }

  /**
   * Initialize settings (load from disk)
   * Should be called after app.whenReady()
   */
  initialize(): void {
    try {
      this.ensureSettingsFilePath();
      this.load();
      this.logger.info('Settings initialized', this.settings);
    } catch (err) {
      this.logger.error('Failed to initialize settings', err);
    }
  }

  /**
   * Get the settings file path
   * @returns {string} Path to settings file
   */
  getSettingsFilePath(): string {
    try {
      const dir = this.app.getPath('userData');
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (_) { }
      return path.join(dir, this.SETTINGS_FILE_BASENAME);
    } catch (_) {
      // Extremely defensive fallback (shouldn't happen in normal Electron runtime)
      return this.LEGACY_SETTINGS_FILE;
    }
  }

  /**
   * Ensure settings file path is set
   * @private
   */
  private ensureSettingsFilePath(): void {
    if (!this.SETTINGS_FILE) {
      this.SETTINGS_FILE = this.getSettingsFilePath();
    }
  }

  /**
   * Load settings from disk
   */
  load(): void {
    try {
      this.ensureSettingsFilePath();

      if (!this.SETTINGS_FILE) throw new Error('Settings file path could not be determined');

      // One-time migration: if a legacy settings file exists but userData settings doesn't,
      // copy it to userData so packaged apps can persist changes.
      if (!fs.existsSync(this.SETTINGS_FILE) && fs.existsSync(this.LEGACY_SETTINGS_FILE)) {
        try {
          const legacyData = fs.readFileSync(this.LEGACY_SETTINGS_FILE, 'utf8');
          fs.writeFileSync(this.SETTINGS_FILE, legacyData);
          this.logger.info(`Migrated legacy settings from ${this.LEGACY_SETTINGS_FILE}`);
        } catch (err) {
          this.logger.warn(`Settings migration skipped: ${err}`);
        }
      }

      if (fs.existsSync(this.SETTINGS_FILE)) {
        const data = fs.readFileSync(this.SETTINGS_FILE, 'utf8');
        const loadedSettings = JSON.parse(data);

        // Merge with defaults, only updating valid keys
        this.settings = { ...this.defaults, ...loadedSettings };

        this.logger.verbose('Settings loaded from disk', this.settings);
      } else {
        // Save defaults if no settings file exists
        this.save();
        this.logger.info('Created default settings file');
      }
    } catch (err) {
      this.logger.error('Failed to load settings', err);
    }
  }

  /**
   * Save current settings to disk
   * @param {Object} overrides - Optional key-value pairs to override
   */
  save(overrides: Partial<Settings> = {}): void {
    try {
      this.ensureSettingsFilePath();

      if (!this.SETTINGS_FILE) throw new Error('Settings file path could not be determined');

      // Update in-memory settings first
      this.settings = { ...this.settings, ...overrides };

      // Ensure mode is either 'proxy' or 'tun'
      if (this.settings.mode !== 'proxy' && this.settings.mode !== 'tun') {
        this.settings.mode = 'proxy';
      }

      // Ensure boolean values are actually booleans
      this.settings.authoritative = !!this.settings.authoritative;
      this.settings.verbose = !!this.settings.verbose;
      this.settings.socks5AuthEnabled = !!this.settings.socks5AuthEnabled;
      // Duplicate check removed in TS version
      this.settings.systemProxyEnabledByApp = !!this.settings.systemProxyEnabledByApp;
      this.settings.customDnsEnabled = !!this.settings.customDnsEnabled;

      // Ensure strings are actually strings
      if (typeof this.settings.socks5AuthUsername !== 'string') {
        this.settings.socks5AuthUsername = '';
      }
      if (typeof this.settings.socks5AuthPassword !== 'string') {
        this.settings.socks5AuthPassword = '';
      }
      if (typeof this.settings.systemProxyServiceName !== 'string') {
        this.settings.systemProxyServiceName = '';
      }
      if (typeof this.settings.primaryDns !== 'string') {
        this.settings.primaryDns = '8.8.8.8';
      }
      if (typeof this.settings.secondaryDns !== 'string') {
        this.settings.secondaryDns = '1.1.1.1';
      }

      // Ensure configs is an array
      if (!Array.isArray(this.settings.configs)) {
        this.settings.configs = [];
      }

      // Write to disk
      fs.writeFileSync(this.SETTINGS_FILE, JSON.stringify(this.settings, null, 2));

      this.logger.verbose('Settings saved to disk', this.settings);
    } catch (err) {
      this.logger.error('Failed to save settings', err);
    }
  }

  /**
   * Get a setting value
   * @param {string} key - Setting key
   * @returns {*} Setting value
   */
  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.settings[key];
  }

  /**
   * Set a setting value (does not auto-save, call save() to persist)
   * @param {string} key - Setting key
   * @param {*} value - Setting value
   */
  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings[key] = value;
  }

  /**
   * Get all settings
   * @returns {Object} All settings
   */
  getAll(): Settings {
    return { ...this.settings };
  }

  /**
   * Validate DNS resolver format
   * @param {string} value - Resolver to validate
   * @returns {boolean} True if valid
   */
  validateResolver(value: string): boolean {
    const parsed = this.parseDnsServer(value);
    return parsed !== null;
  }

  /**
   * Parse DNS server string
   * @param {string} server - DNS server string (e.g., "1.1.1.1" or "1.1.1.1:53")
   * @returns {Object|null} Parsed server info or null if invalid
   */
  parseDnsServer(server: string): DnsServerParseResult | null {
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
   * Reset settings to defaults
   */
  resetToDefaults(): void {
    this.settings = { ...this.defaults };
    this.save();
    this.logger.info('Settings reset to defaults');
  }

  /**
   * Export all configs as ssgate:name//base64 strings
   * @returns {string} String with one config format per line
   */
  exportConfigs(): string {
    const configs = this.settings.configs || [];
    return configs.map(config => {
      const remark = config.remark || 'Imported';
      const data: Partial<ConfigItem> = { ...config };
      delete data.id; // Don't export local ID
      const base64 = Buffer.from(JSON.stringify(data)).toString('base64');
      return `ssgate:${remark}//${base64}`;
    }).join('\n');
  }

  /**
   * Import configurations from strings
   * @param {string} importData - Multi-line string of ssgate format
   * @returns {Object} Result of import
   */
  importConfigs(importData: string): ImportResult {
    if (!importData || typeof importData !== 'string') {
      return { success: false, error: 'Invalid import data' };
    }

    const lines = importData.split('\n').map(l => l.trim()).filter(l => l.startsWith('ssgate:'));
    const importedConfigs: ConfigItem[] = [];
    let errorCount = 0;

    for (const line of lines) {
      try {
        const parts = line.split('//');
        if (parts.length < 2) {
          errorCount++;
          continue;
        }

        const prefix = parts[0]; // ssgate:Remark
        const base64 = parts.slice(1).join('//'); // The rest is base64
        const remark = prefix.replace(/^ssgate:/, '') || 'Imported';

        const json = Buffer.from(base64, 'base64').toString('utf8');
        const configData: Partial<ConfigItem> = JSON.parse(json);

        // Basic validation
        if (!configData.domain) {
          errorCount++;
          continue;
        }

        const newConfig: ConfigItem = {
          id: crypto.randomUUID(),
          remark: configData.remark || remark,
          domain: configData.domain,
          country: configData.country || '🏳️',
          socks: configData.socks || {}
        };

        importedConfigs.push(newConfig);
      } catch (err) {
        this.logger.error('Failed to parse config line', err);
        errorCount++;
      }
    }

    if (importedConfigs.length > 0) {
      const currentConfigs = Array.isArray(this.settings.configs) ? this.settings.configs : [];
      this.save({ configs: [...currentConfigs, ...importedConfigs] });
    }

    return {
      success: true,
      count: importedConfigs.length,
      errors: errorCount
    };
  }
}
