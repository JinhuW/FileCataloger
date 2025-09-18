import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, systemPreferences, dialog } from 'electron';
import * as path from 'path';
import { ApplicationController } from './modules/application-controller';
import { preferencesManager } from './modules/preferences-manager';
import { keyboardManager } from './modules/keyboard-manager';
import { performanceMonitor } from './modules/performance-monitor';
import { errorHandler, ErrorSeverity, ErrorCategory } from './modules/error-handler';
import { Logger, LogLevel } from './modules/logger';
import { LogEntry } from '../shared/logger';
import { securityConfig } from './modules/security-config';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

class FileCatalogerApp {
  private mainWindow: BrowserWindow | null = null;
  private applicationController: ApplicationController;
  private tray: Tray | null = null;
  private isQuitting: boolean = false;
  private logger: Logger;
  private statusUpdateInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize logger first
    this.logger = Logger.getInstance();
    this.applicationController = new ApplicationController();
    this.initializeApp();
  }

  private initializeApp(): void {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    app.on('ready', this.onReady.bind(this));

    // Quit when all windows are closed, except on macOS. There, it's common
    // for applications and their menu bar to stay active until the user quits
    // explicitly with Cmd + Q.
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      // For menu bar apps, don't automatically create windows
      // Users can access the app through the tray menu
    });

    // Handle app quit
    app.on('before-quit', async (event) => {
      // If already quitting, let it proceed
      if (this.isQuitting) {
        return;
      }

      // Prevent quit to do cleanup first
      event.preventDefault();
      this.isQuitting = true;

      // Perform graceful cleanup with timeout
      try {
        await this.performGracefulShutdown();
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
      }

      // Force quit after cleanup or timeout
      setImmediate(() => {
        app.exit(0);
      });
    });

    // Ensure cleanup happens even if before-quit is skipped
    app.on('will-quit', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.isQuitting = true;

        // Force immediate exit if cleanup hasn't run
        this.logger.warn('will-quit called without before-quit - forcing exit');
        app.exit(0);
      }
    });

    // Security: Prevent new window creation
    app.on('web-contents-created', (event, contents) => {
      contents.setWindowOpenHandler(({ url: _url }) => {
        // Prevent opening new windows
        return { action: 'deny' };
      });
    });
  }

  private async checkAccessibilityPermissions(): Promise<boolean> {
    // Only check on macOS
    if (process.platform !== 'darwin') {
      return true;
    }

    // Check if we have accessibility permissions
    const hasPermission = systemPreferences.isTrustedAccessibilityClient(false);

    if (!hasPermission) {
      const result = await dialog.showMessageBox({
        type: 'warning',
        title: 'Accessibility Permission Required',
        message: 'FileCataloger needs accessibility permission to detect mouse movements and file dragging.',
        detail: 'Please grant permission in System Settings > Privacy & Security > Accessibility, then restart the app.',
        buttons: ['Open System Settings', 'Continue Without Permission', 'Quit'],
        defaultId: 0,
        cancelId: 2
      });

      if (result.response === 0) {
        // Request permission (this will open system preferences)
        systemPreferences.isTrustedAccessibilityClient(true);
        // The app will need to be restarted after permission is granted
        return false;
      } else if (result.response === 2) {
        // User chose to quit
        app.quit();
        return false;
      }
      // User chose to continue without permission
      return false;
    }

    return true;
  }

  private async onReady(): Promise<void> {
    // Hide dock icon for menu bar app (macOS)
    const prefs = preferencesManager.getPreferences();
    if (process.platform === 'darwin' && app.dock) {
      if (!prefs.showInDock) {
        app.dock.hide();
      }
    }

    // Initialize security configuration
    securityConfig.initialize();

    // Create system tray
    this.createSystemTray();

    // Check for accessibility permissions on macOS
    const hasPermissions = await this.checkAccessibilityPermissions();
    if (!hasPermissions) {
      this.logger.warn('Starting without accessibility permissions - some features may not work');
    }

    // Initialize and start the core application
    try {
      await this.applicationController.start();
      // Start keyboard manager
      keyboardManager.start();

      // Start performance monitoring (reduced frequency for better performance)
      performanceMonitor.start(30000); // Check every 30s instead of 5s

      // Setup handlers
      this.setupKeyboardHandlers();
      this.setupPerformanceHandlers();
    } catch (error) {
      console.error('Failed to start application controller:', error);
      errorHandler.handleError(error as Error, {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.SYSTEM
      });
    }

    // Set up IPC handlers
    this.setupIpcHandlers();
  }


  private createSystemTray(): void {
    try {
      // Create tray icon
      const trayIcon = this.createTrayIcon();
      this.tray = new Tray(trayIcon);

      console.log('✓ System tray created');

      // Set tray tooltip
      this.tray.setToolTip('FileCataloger - Drag files to create temporary shelves');

      // Create context menu
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Show Status',
          click: () => {
            this.showMainWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CommandOrControl+,',
          click: () => {
            preferencesManager.showPreferencesWindow();
          }
        },
        {
          label: 'Performance',
          submenu: [
            {
              label: 'Show Status',
              click: () => {
                const status = performanceMonitor.getHealthStatus();
                const metrics = performanceMonitor.getMetrics();
                if (metrics) {
                  const message = `CPU: ${metrics.cpu.usage.toFixed(1)}%\nMemory: ${metrics.memory.percentage.toFixed(1)}%\nHealth: ${status.healthy ? 'Good' : 'Issues detected'}`;
                  console.log(message);
                  if (status.issues.length > 0) {
                    console.log('Issues:', status.issues.join('\n'));
                  }
                }
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Quit FileCataloger',
          accelerator: 'CommandOrControl+Q',
          click: async () => {
            this.isQuitting = true;
            this.logger.info('🛑 Quit requested from tray menu');

            // Perform graceful shutdown with timeout
            try {
              await this.performGracefulShutdown();
            } catch (error) {
              this.logger.error('Error during shutdown:', error);
            }

            // Force exit after cleanup
            app.exit(0);
          }
        }
      ]);

      this.tray.setContextMenu(contextMenu);

    } catch (error) {
      console.error('Failed to create system tray:', error);
    }
  }

  private createTrayIcon(): Electron.NativeImage {
    try {
      // Try multiple approaches to create a tray icon

      // Approach 1: Use a simple geometric pattern
      const size = 16;
      const canvas = Buffer.alloc(size * size * 4, 0);

      // Create a simple diamond/box pattern
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const index = (y * size + x) * 4;

          // Create a diamond pattern in the center
          const centerX = size / 2;
          const centerY = size / 2;
          const distance = Math.abs(x - centerX) + Math.abs(y - centerY);

          if (distance >= 3 && distance <= 5) {
            canvas[index] = 0;       // R
            canvas[index + 1] = 0;   // G
            canvas[index + 2] = 0;   // B
            canvas[index + 3] = 200; // A
          }
        }
      }

      const image = nativeImage.createFromBuffer(canvas, { width: size, height: size });
      image.setTemplateImage(true);

      console.log('✓ Tray icon created successfully');
      return image;

    } catch (error) {
      console.error('Failed to create custom tray icon:', error);

      try {
        // Fallback: Try to create from a simple base64 PNG
        const simpleIcon = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFWSURBVDiNpZM9SwNBEIafgwQSCxsLwcJCG1sLG0uxsLGwsLGwsLBQsLGwsLGwsLGwsLGwsLBQsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLBQsLGwsLGwsLBQ';
        const buffer = Buffer.from(simpleIcon, 'base64');
        const fallbackImage = nativeImage.createFromBuffer(buffer);
        fallbackImage.setTemplateImage(true);

        console.log('✓ Using fallback tray icon');
        return fallbackImage;

      } catch (fallbackError) {
        console.error('Failed to create fallback tray icon:', fallbackError);

        // Last resort: create a minimal 16x16 black dot
        const dotSize = 16;
        const dotCanvas = Buffer.alloc(dotSize * dotSize * 4, 0);

        // Draw a simple dot in the center
        const centerX = Math.floor(dotSize / 2);
        const centerY = Math.floor(dotSize / 2);

        for (let y = centerY - 2; y <= centerY + 2; y++) {
          for (let x = centerX - 2; x <= centerX + 2; x++) {
            if (x >= 0 && x < dotSize && y >= 0 && y < dotSize) {
              const index = (y * dotSize + x) * 4;
              dotCanvas[index] = 0;     // R
              dotCanvas[index + 1] = 0; // G
              dotCanvas[index + 2] = 0; // B
              dotCanvas[index + 3] = 255; // A
            }
          }
        }

        const dotImage = nativeImage.createFromBuffer(dotCanvas, { width: dotSize, height: dotSize });
        dotImage.setTemplateImage(true);

        console.log('✓ Using minimal dot tray icon');
        return dotImage;
      }
    }
  }

  private showMainWindow(): void {
    if (!this.mainWindow) {
      this.createMainWindow();
    }

    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();

      // Send status to renderer
      this.mainWindow.webContents.send('app:status', this.applicationController.getStatus());
    }
  }

  private setupIpcHandlers(): void {
    // Get application status
    ipcMain.handle('app:get-status', () => {
      return this.applicationController.getStatus();
    });

    // Create shelf manually
    ipcMain.handle('app:create-shelf', async (event, config) => {
      return await this.applicationController.createShelf(config);
    });

    // Update configuration
    ipcMain.handle('app:update-config', (event, config) => {
      this.applicationController.updateConfig(config);
      return true;
    });

    // Handle shelf drop operations
    ipcMain.on('shelf:drop-start', (event, shelfId) => {
      this.applicationController.handleDropStart(shelfId);
    });

    ipcMain.on('shelf:drop-end', (event, shelfId) => {
      this.applicationController.handleDropEnd(shelfId);
    });

    ipcMain.on('shelf:add-files', (event, data) => {
      this.applicationController.handleFilesDropped(data.shelfId, data.files);
    });

    ipcMain.on('shelf:files-dropped', (event, data) => {
      console.log('📡 Received shelf:files-dropped IPC:', data);
      this.applicationController.handleFilesDropped(data.shelfId, data.files);
    });

    // Handle shelf close
    ipcMain.handle('shelf:close', async (event, shelfId) => {
      return await this.applicationController.destroyShelf(shelfId);
    });

    // Debug handler for renderer messages
    ipcMain.on('shelf:debug', (_event, _data) => {
      // Debug logging removed for production
    });

    // Logger IPC handlers
    ipcMain.on('logger:log', (event, logEntry: LogEntry) => {
      // Forward renderer logs to main logger for file logging
      if (logEntry.processType === 'renderer') {
        const contextLogger = this.logger.createContextLogger(
          logEntry.context ? `renderer:${logEntry.context}` : 'renderer'
        );

        // Log with appropriate level
        switch (logEntry.level) {
          case LogLevel.DEBUG:
            contextLogger.debug(logEntry.message, ...(logEntry.data || []));
            break;
          case LogLevel.INFO:
            contextLogger.info(logEntry.message, ...(logEntry.data || []));
            break;
          case LogLevel.WARN:
            contextLogger.warn(logEntry.message, ...(logEntry.data || []));
            break;
          case LogLevel.ERROR:
            contextLogger.error(logEntry.message, ...(logEntry.data || []));
            break;
        }
      }
    });

    ipcMain.on('logger:set-level', (event, level: LogLevel) => {
      this.logger.setLogLevel(level);
    });
  }

  private createMainWindow(): void {
    // Create the browser window for settings/development
    this.mainWindow = new BrowserWindow({
      height: 600,
      width: 900,
      minHeight: 600,
      minWidth: 900,
      maxHeight: 600,
      maxWidth: 900,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false // Set to false for now to avoid issues
      },
      show: false, // Don't show by default - only when requested
      title: 'FileCataloger - Status',
      minimizable: true,
      closable: true,
      resizable: false, // Fixed size window
      skipTaskbar: false,
      backgroundColor: '#ffffff' // Set white background
    });

    // Load the index.html of the app from the built renderer
    const rendererPath = path.join(__dirname, '../renderer/index.html');
    this.mainWindow.loadFile(rendererPath);

    // Open DevTools in development for debugging
    if (!app.isPackaged) {
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Show window in development for debugging
    if (!app.isPackaged) {
      this.mainWindow.once('ready-to-show', () => {
        this.mainWindow?.show();
      });
    }

    // Emitted when the window is closed - hide instead of destroy for menu bar apps
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    // Clean up reference when destroyed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }

    // Set up periodic status updates
    this.statusUpdateInterval = setInterval(() => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('app:status', this.applicationController.getStatus());
      }
    }, 2000);
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  public getApplicationController(): ApplicationController {
    return this.applicationController;
  }

  private setupKeyboardHandlers(): void {
    keyboardManager.on('toggle-shelf', () => {
      // Toggle functionality to be implemented in ApplicationController
    });

    keyboardManager.on('clear-shelf', () => {
      // Clear shelf functionality
    });

    keyboardManager.on('hide-all-shelves', () => {
      // Hide all shelves functionality
    });

    keyboardManager.on('new-shelf', async () => {
      await this.applicationController.createShelf({});
    });
  }

  private setupPerformanceHandlers(): void {
    performanceMonitor.on('performance-warning', (warning) => {
      console.warn('Performance warning:', warning);

      // Log to error handler
      errorHandler.handleError(
        `Performance warning: ${warning.type}`,
        {
          severity: warning.type.includes('critical') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
          category: ErrorCategory.PERFORMANCE,
          context: warning
        }
      );
    });

    performanceMonitor.on('performance-warning-cleared', (_data) => {
      // Performance warning cleared
    });
  }

  /**
   * Perform graceful shutdown with timeout
   */
  private async performGracefulShutdown(): Promise<void> {
    this.logger.info('🔄 Starting graceful shutdown...');

    // Create a timeout promise
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout')), 5000); // 5 second timeout
    });

    // Create cleanup promise
    const cleanup = async () => {
      try {
        // Stop all intervals and timers first
        if (this.statusUpdateInterval) {
          clearInterval(this.statusUpdateInterval);
          this.statusUpdateInterval = null;
        }

        // Stop keyboard manager
        this.logger.info('Stopping keyboard manager...');
        keyboardManager.stop();

        // Stop performance monitor (stops intervals)
        this.logger.info('Stopping performance monitor...');
        performanceMonitor.stop();
        performanceMonitor.destroy();

        // Destroy application controller (cleans up timers and native module)
        this.logger.info('Destroying application controller...');
        await this.applicationController.destroy();

        // Shutdown error handler
        this.logger.info('Shutting down error handler...');
        errorHandler.shutdown();

        // Clean up tray
        if (this.tray) {
          this.logger.info('Destroying tray...');
          this.tray.destroy();
          this.tray = null;
        }

        // Close all windows
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.logger.info('Closing main window...');
          this.mainWindow.destroy();
          this.mainWindow = null;
        }

        // Close any other windows
        const windows = BrowserWindow.getAllWindows();
        this.logger.info(`Closing ${windows.length} remaining windows...`);
        windows.forEach(window => {
          if (!window.isDestroyed()) {
            window.destroy();
          }
        });

        this.logger.info('✅ Graceful shutdown complete');
      } catch (error) {
        this.logger.error('Error during cleanup:', error);
        throw error;
      }
    };

    // Race between cleanup and timeout
    try {
      await Promise.race([cleanup(), timeout]);
    } catch (error) {
      this.logger.error('Shutdown error or timeout:', error);
      // Continue with force quit
    }
  }
}

// Initialize the application
const fileCatalogerApp = new FileCatalogerApp();

export default fileCatalogerApp;
