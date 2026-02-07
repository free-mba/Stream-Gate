/**
 * WindowService - Electron window lifecycle management
 *
 * Single Responsibility: Manage Electron window creation and communication
 */

import { BrowserWindow, app, App, BrowserWindowConstructorOptions } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import Logger from '../core/Logger';

export default class WindowService {
  private logger: Logger;
  private app: App;
  private appName: string;
  private mainWindow: BrowserWindow | null;

  constructor(logger: Logger, electronApp?: App, appName: string = 'Stream Gate') {
    this.logger = logger;
    this.app = electronApp || app;
    this.appName = appName;
    this.mainWindow = null;
  }

  /**
   * Create the main application window
   * @returns {BrowserWindow} The created window
   */
  createWindow(): BrowserWindow {
    // Navigate from dist/main/main.mjs -> dist/main -> dist -> root -> assets
    const iconPath = path.join(__dirname, '../../assets', 'icon.png');
    const windowOptions: BrowserWindowConstructorOptions = {
      width: 1200,
      height: 800,
      title: this.appName,
      resizable: true,
      minWidth: 900,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    };

    // Set icon if it exists
    try {
      if (fs.existsSync(iconPath)) {
        windowOptions.icon = iconPath;
        this.logger.info(`Using icon: ${iconPath}`);

        // On macOS, also set the dock icon (works in development)
        if (process.platform === 'darwin' && this.app && this.app.dock) {
          this.app.dock.setIcon(iconPath);
        }
      } else {
        this.logger.warn(`Icon not found at: ${iconPath}`);
      }
    } catch (err) {
      this.logger.error('Error setting icon', err);
    }

    this.mainWindow = new BrowserWindow(windowOptions);

    // Force-set title after page load (macOS workaround for title override)
    this.mainWindow.webContents.on('did-finish-load', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.setTitle(this.appName);
      }
    });

    // Also set title when window is ready to show
    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.setTitle(this.appName);
      }
    });

    const isDev = process.env.NODE_ENV === 'development';
    // Navigate from dist/main/main.mjs -> root -> src/start-renderer/dist
    // Use app.getAppPath() to avoid hardcoded paths from build time (CI runner path issue)
    const uiDistPath = path.join(this.app.getAppPath(), 'src/start-renderer/dist/index.html');

    // Helper to load built files
    const loadBuiltFiles = () => {
      this.logger.info(`[WindowService] resolving UI path...`);
      this.logger.info(`[WindowService] app.getAppPath(): ${this.app.getAppPath()}`);
      this.logger.info(`[WindowService] Target UI path: ${uiDistPath}`);

      try {
        if (fs.existsSync(uiDistPath)) {
          this.logger.info('[WindowService] UI file exists. Loading...');
          this.mainWindow?.loadFile(uiDistPath).catch(err => {
            this.logger.error('[WindowService] Failed to loadFile:', err);
          });
        } else {
          this.logger.error(`[WindowService] UI file NOT found at: ${uiDistPath}`);

          // Debugging: List contents of parent directories to help user find where it is
          try {
            const distDir = path.dirname(uiDistPath);
            this.logger.info(`[WindowService] Contents of ${distDir}:`, fs.readdirSync(distDir));
            const srcDir = path.join(this.app.getAppPath(), 'src');
            if (fs.existsSync(srcDir)) {
              this.logger.info(`[WindowService] Contents of ${srcDir}:`, fs.readdirSync(srcDir));
            }
          } catch (e) {
            this.logger.warn('[WindowService] Could not list directory contents:', e);
          }


          const fallbackPath = path.join(this.app.getAppPath(), 'index.html');
          this.logger.warn(`[WindowService] Falling back to ${fallbackPath}`);
          this.mainWindow?.loadFile(fallbackPath);
        }
      } catch (error) {
        this.logger.error('[WindowService] Error verifying/loading UI:', error);
      }
    };

    if (isDev) {
      this.logger.info('Loading from Vite dev server...');
      // Try dev server, fall back to built files if unavailable
      this.mainWindow.loadURL('http://localhost:5173').catch((err: Error) => {
        if (err.message.includes('ERR_CONNECTION_REFUSED')) {
          this.logger.warn('Vite dev server not running, falling back to built files...');
          loadBuiltFiles();
        } else {
          this.logger.error('Failed to load dev server', err);
        }
      });
    } else {
      loadBuiltFiles();
    }

    // Avoid "Object has been destroyed" during shutdown
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.logger.info('Main window closed');
    });

    this.logger.info('Main window created');

    // Enable DevTools for debugging white screen
    // Enable DevTools only in development and when not packaged
    if (isDev && !this.app.isPackaged) {
      this.mainWindow.webContents.openDevTools();
    }

    return this.mainWindow;
  }

  /**
   * Get the main window instance
   * @returns {BrowserWindow|null}
   */
  getWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  /**
   * Check if window can receive messages
   * @returns {boolean}
   */
  canSendToWindow(): boolean {
    return !!(
      this.mainWindow &&
      !this.mainWindow.isDestroyed() &&
      this.mainWindow.webContents &&
      !this.mainWindow.webContents.isDestroyed()
    );
  }

  /**
   * Safely send a message to the renderer process
   * @param {string} channel - IPC channel name
   * @param {*} payload - Data to send
   */
  sendToRenderer(channel: string, payload?: any): boolean {
    try {
      if (!this.canSendToWindow() || !this.mainWindow) {
        return false;
      }
      this.mainWindow.webContents.send(channel, payload);
      return true;
    } catch (error: any) {
      // Ignore: window is closing/destroyed
      this.logger.verbose(`Failed to send to renderer on channel "${channel}": ${error.message}`);
      return false;
    }
  }

  /**
   * Close the main window
   */
  closeWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
    }
  }

  /**
   * Check if window exists and is not destroyed
   * @returns {boolean}
   */
  isWindowAvailable(): boolean {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed();
  }
}
