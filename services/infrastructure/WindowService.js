/**
 * WindowService - Electron window lifecycle management
 *
 * Single Responsibility: Manage Electron window creation and communication
 */

const { BrowserWindow, app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

class WindowService {
  constructor(logger, electronApp) {
    this.logger = logger;
    this.app = electronApp || app;
    this.mainWindow = null;
  }

  /**
   * Create the main application window
   * @returns {BrowserWindow} The created window
   */
  createWindow() {
    const iconPath = path.join(__dirname, '../../assets', 'icon.png');
    const windowOptions = {
      width: 1200,
      height: 800,
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

    const isDev = process.env.NODE_ENV === 'development';
    const uiDistPath = path.join(__dirname, '../../ui/dist/index.html');

    if (isDev) {
      this.logger.info('Loading from Vite dev server...');
      this.mainWindow.loadURL('http://localhost:5173');
    } else if (fs.existsSync(uiDistPath)) {
      this.logger.info('Loading built UI from ui/dist...');
      this.mainWindow.loadFile(uiDistPath);
    } else {
      this.logger.warn('UI build not found, falling back to legacy index.html');
      this.mainWindow.loadFile(path.join(__dirname, '../../index.html'));
    }

    // Avoid "Object has been destroyed" during shutdown
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.logger.info('Main window closed');
    });

    this.logger.info('Main window created');

    // Uncomment for debugging
    // this.mainWindow.webContents.openDevTools();

    return this.mainWindow;
  }

  /**
   * Get the main window instance
   * @returns {BrowserWindow|null}
   */
  getWindow() {
    return this.mainWindow;
  }

  /**
   * Check if window can receive messages
   * @returns {boolean}
   */
  canSendToWindow() {
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
  sendToRenderer(channel, payload) {
    try {
      if (!this.canSendToWindow()) {
        return false;
      }
      this.mainWindow.webContents.send(channel, payload);
      return true;
    } catch (error) {
      // Ignore: window is closing/destroyed
      this.logger.verbose(`Failed to send to renderer on channel "${channel}": ${error.message}`);
      return false;
    }
  }

  /**
   * Close the main window
   */
  closeWindow() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
    }
  }

  /**
   * Check if window exists and is not destroyed
   * @returns {boolean}
   */
  isWindowAvailable() {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed();
  }
}

module.exports = WindowService;
