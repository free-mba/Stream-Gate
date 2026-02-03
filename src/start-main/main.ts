/**
 * Stream Gate - Main Entry Point
 *
 * This file acts as the orchestrator, initializing all services
 * and wiring up dependencies using dependency injection.
 *
 * Architecture: Service Layer Pattern with Event-Driven Communication
 */

import { app } from 'electron';
import path from 'node:path';

const APP_NAME = 'Stream Gate';

// Import services
import EventEmitter from './services/core/EventEmitter';
import Logger from './services/core/Logger';
import WindowService from './services/infrastructure/WindowService';
import SettingsService from './services/data/SettingsService';
import ProcessManager from './services/business/ProcessManager';
import ProxyService from './services/business/ProxyService';
import SystemProxyService from './services/business/SystemProxyService';
import DNSService from './services/business/DNSService';
import DnsResolutionService from './services/business/DnsResolutionService'; // Custom Resolution
import ConnectionService from './services/orchestration/ConnectionService';
import IPCController from './services/presentation/IPCController';

// Set app name for macOS dock and menu bar
app.setName(APP_NAME);
app.setAboutPanelOptions({ applicationName: APP_NAME, version: app.getVersion() });

// Service containers (will be initialized in app.whenReady)
let eventEmitter: EventEmitter | undefined;
let logger: Logger | undefined;
let windowService: WindowService | undefined;
let settingsService: SettingsService | undefined;
let processManager: ProcessManager | undefined;
let proxyService: ProxyService | undefined;
let systemProxyService: SystemProxyService | undefined;
let dnsService: DNSService | undefined; // Tester
let dnsResolutionService: DnsResolutionService | undefined; // Resolution
let connectionService: ConnectionService | undefined;
let ipcController: IPCController | undefined;

/**
 * Initialize all services
 * Services are initialized in dependency order
 */
function initializeServices(): void {
  // Core services (no dependencies)
  eventEmitter = new EventEmitter();
  logger = new Logger(eventEmitter);

  // Infrastructure services
  windowService = new WindowService(logger, app, APP_NAME);

  // Data services
  settingsService = new SettingsService(logger, app);

  // Initialize settings after app is ready
  settingsService.initialize();

  // Set logger verbosity from settings
  logger.setVerbose(settingsService.get('verbose'));

  // Business services
  processManager = new ProcessManager({
    eventEmitter,
    logger,
    app,
    paths: { resourcesPath: path.resolve(__dirname, '../../') }
  });
  proxyService = new ProxyService(eventEmitter, logger, settingsService);
  systemProxyService = new SystemProxyService(logger, settingsService);
  dnsService = new DNSService(logger);
  dnsResolutionService = new DnsResolutionService(logger);

  // Orchestration service (depends on business services)
  connectionService = new ConnectionService({
    processManager,
    proxyService,
    systemProxyService,
    dnsResolutionService,
    settingsService,
    eventEmitter,
    logger
  });

  // Presentation service (depends on all other services)
  ipcController = new IPCController({
    connectionService,
    settingsService,
    dnsService,
    windowService,
    systemProxyService,
    logger,
    eventEmitter
  });

  // Register IPC handlers
  ipcController.registerHandlers();

  // Forward connection status changes to renderer
  connectionService?.onStatusChange((status: any, data: any) => {
    windowService?.sendToRenderer('status-update', connectionService?.getStatus());
  });

  logger.info('All services initialized');
}

/**
 * Clean up on app quit
 */
async function cleanup(): Promise<void> {
  if (logger) logger.info('Cleaning up before quit...');

  // Set quitting flag to prevent reconnection
  if (connectionService) {
    connectionService.setQuitting();
  }

  // Cleanup services and disable system proxy if we enabled it
  if (connectionService) {
    await connectionService.cleanupAndDisableProxyIfNeeded('app-quit');
  }

  // Close window
  if (windowService) {
    windowService.closeWindow();
  }

  if (logger) logger.info('Cleanup complete');
}

/**
 * Install process exit handlers for graceful shutdown
 */
function installProcessExitHandlers(): void {
  const doExit = async (code: number, reason: string): Promise<void> => {
    try {
      await cleanup();
    } catch (_) { }
    try {
      process.exit(code);
    } catch (_) { }
  };

  process.on('SIGINT', () => { void doExit(130, 'SIGINT'); });
  process.on('SIGTERM', () => { void doExit(143, 'SIGTERM'); });
  process.on('SIGHUP', () => { void doExit(129, 'SIGHUP'); });

  process.on('uncaughtException', (err: any) => {
    console.error('uncaughtException:', err);
    void doExit(1, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason: any) => {
    console.error('unhandledRejection:', reason);
    void doExit(1, 'unhandledRejection');
  });
}

// ============================================================================
// App Lifecycle Events
// ============================================================================

app.whenReady().then(async () => {
  try {
    // Initialize all services
    initializeServices();

    // Crash-recovery: if we previously enabled system proxy and the app died,
    // attempt to restore the user's system on next start.
    if (settingsService?.get('systemProxyEnabledByApp')) {
      try {
        await connectionService?.cleanupAndDisableProxyIfNeeded('startup-recovery');
      } catch (_) { }
    }

    // Create main window
    windowService?.createWindow();

    logger?.info('Application ready');

  } catch (err: any) {
    console.error('Failed to initialize application:', err);
    app.quit();
  }

  // Handle activation (macOS)
  app.on('activate', () => {
    if (windowService && !windowService.isWindowAvailable()) {
      windowService.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanup().finally(() => {
      app.quit();
    });
  }
});

let isQuitting = false;

app.on('before-quit', (event: any) => {
  if (isQuitting) return;

  // Prevent immediate quit to allow cleanup
  event.preventDefault();

  cleanup().finally(() => {
    isQuitting = true;
    app.quit();
  });
});

// Install process exit handlers
installProcessExitHandlers();

// Export services for debugging (optional)
if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
  (global as any).__SERVICES__ = {
    eventEmitter,
    logger,
    windowService,
    settingsService,
    processManager,
    proxyService,
    systemProxyService,
    dnsService,
    dnsResolutionService,
    connectionService,
    ipcController
  };
  console.log('Debug mode: Services available at global.__SERVICES__');
}
