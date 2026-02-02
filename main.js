/**
 * Stream Gate - Main Entry Point
 *
 * This file acts as the orchestrator, initializing all services
 * and wiring up dependencies using dependency injection.
 *
 * Architecture: Service Layer Pattern with Event-Driven Communication
 */

const { app } = require('electron');

const APP_NAME = 'Stream Gate';

// Import services
const EventEmitter = require('./services/core/EventEmitter');
const Logger = require('./services/core/Logger');
const WindowService = require('./services/infrastructure/WindowService');
const SettingsService = require('./services/data/SettingsService');
const ProcessManager = require('./services/business/ProcessManager');
const ProxyService = require('./services/business/ProxyService');
const SystemProxyService = require('./services/business/SystemProxyService');
const DNSService = require('./services/business/DNSService');
const DnsResolutionService = require('./services/business/DnsResolutionService'); // Custom Resolution
const ConnectionService = require('./services/orchestration/ConnectionService');
const IPCController = require('./services/presentation/IPCController');

// Set app name for macOS dock and menu bar
app.setName(APP_NAME);
app.setAboutPanelOptions({ applicationName: APP_NAME, version: app.getVersion() });

// Service containers (will be initialized in app.whenReady)
let eventEmitter;
let logger;
let windowService;
let settingsService;
let processManager;
let proxyService;
let systemProxyService;
let dnsService; // Tester
let dnsResolutionService; // Resolution
let connectionService;
let ipcController;

/**
 * Initialize all services
 * Services are initialized in dependency order
 */
function initializeServices() {
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
  processManager = new ProcessManager(eventEmitter, logger, app);
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
  connectionService.onStatusChange((status, data) => {
    windowService.sendToRenderer('status-update', connectionService.getStatus());
  });

  logger.info('All services initialized');
}

/**
 * Clean up on app quit
 */
async function cleanup() {
  logger.info('Cleaning up before quit...');

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

  logger.info('Cleanup complete');
}

/**
 * Install process exit handlers for graceful shutdown
 */
function installProcessExitHandlers() {
  const doExit = async (code, reason) => {
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

  process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err);
    void doExit(1, 'uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
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
    if (settingsService.get('systemProxyEnabledByApp')) {
      try {
        await connectionService.cleanupAndDisableProxyIfNeeded('startup-recovery');
      } catch (_) { }
    }

    // Create main window
    windowService.createWindow();

    logger.info('Application ready');

  } catch (err) {
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

app.on('before-quit', (event) => {
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
  global.__SERVICES__ = {
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
