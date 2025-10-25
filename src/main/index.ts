import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  systemPreferences,
  dialog,
} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ApplicationController } from './modules/core';
import { preferencesManager } from './modules/config';
import { keyboardManager } from './modules/input';
import { performanceMonitor } from './modules/utils';
import { errorHandler, ErrorSeverity, ErrorCategory } from './modules/utils';
import { Logger, LogLevel } from './modules/utils/logger';
import { LogEntry } from '@shared/logger';
import { securityConfig } from './modules/config';
import { ShelfConfig, ShelfItem } from '@shared/types';
import { getGlobalTimerManager, destroyGlobalTimerManager } from './modules/utils';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

class FileCatalogerApp {
  private mainWindow: BrowserWindow | null = null;
  private applicationController: ApplicationController | null = null;
  private tray: Tray | null = null;
  private isQuitting: boolean = false;
  private logger: Logger;

  constructor() {
    // Initialize logger first
    this.logger = Logger.getInstance();
    // Don't create ApplicationController yet - wait until onReady
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
    app.on('before-quit', async event => {
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
        this.logger.error('Error during graceful shutdown:', error);
      }

      // Force quit after cleanup or timeout
      setImmediate(() => {
        app.exit(0);
      });
    });

    // Ensure cleanup happens even if before-quit is skipped
    app.on('will-quit', event => {
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
        message:
          'FileCataloger needs accessibility permission to detect mouse movements and file dragging.',
        detail:
          'Please grant permission in System Settings > Privacy & Security > Accessibility, then restart the app.',
        buttons: ['Open System Settings', 'Continue Without Permission', 'Quit'],
        defaultId: 0,
        cancelId: 2,
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
    this.logger.info('🚀 onReady() method called - starting application initialization');

    // Check for accessibility permissions first before any initialization
    this.logger.info('🔐 Checking accessibility permissions...');
    const hasPermissions = await this.checkAccessibilityPermissions();
    if (!hasPermissions) {
      this.logger.warn('Starting without accessibility permissions - some features may not work');
    }
    this.logger.info(`🔐 Accessibility permissions check complete: ${hasPermissions}`);

    // Hide dock icon for menu bar app (macOS)
    const prefs = preferencesManager.getPreferences();
    if (process.platform === 'darwin' && app.dock) {
      if (!prefs.showInDock) {
        app.dock.hide();
      }
    }

    // Initialize security configuration
    securityConfig.initialize();

    // Create system tray after permissions check
    this.createSystemTray();

    // Initialize and start the core application
    try {
      this.logger.info('🚀 Creating ApplicationController...');
      this.logger.info('📊 Initialization prerequisites check:');
      this.logger.info(`   ✓ Electron ready: ${app.isReady()}`);
      this.logger.info(`   ✓ Accessibility permissions: ${hasPermissions}`);
      this.logger.info(`   ✓ Security config initialized: ${securityConfig ? 'yes' : 'no'}`);
      this.logger.info(`   ✓ System tray created: ${this.tray ? 'yes' : 'no'}`);

      this.applicationController = new ApplicationController();
      this.logger.info('✅ ApplicationController created successfully');

      this.logger.info('🚀 Initializing ApplicationController...');
      await this.applicationController.initialize();
      this.logger.info('✅ ApplicationController initialized successfully');

      this.logger.info('🚀 Starting ApplicationController...');
      this.logger.info('📍 About to call applicationController.start()');
      await this.applicationController.start();
      this.logger.info('✅ ApplicationController.start() completed successfully');

      // Start keyboard manager
      keyboardManager.start();

      // Start performance monitoring (reduced frequency for better performance)
      performanceMonitor.start(30000); // Check every 30s instead of 5s

      // Setup handlers
      this.setupKeyboardHandlers();
      this.setupPerformanceHandlers();
    } catch (error) {
      this.logger.error('Failed to start application controller:', error);
      errorHandler.handleError(error as Error, {
        severity: ErrorSeverity.CRITICAL,
        category: ErrorCategory.SYSTEM,
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

      this.logger.info('✓ System tray created');

      // Set tray tooltip
      this.tray.setToolTip('FileCataloger - Drag files to create temporary shelves');

      // Create context menu
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Preferences...',
          accelerator: 'CommandOrControl+,',
          click: () => {
            preferencesManager.showPreferencesWindow();
          },
        },
        { type: 'separator' },
        {
          label: 'Create Shelf (Debug)',
          accelerator: 'CommandOrControl+Shift+S',
          click: async () => {
            this.logger.info('🔧 Manual shelf creation requested from tray');
            try {
              if (!this.applicationController) {
                this.logger.warn('ApplicationController not initialized yet');
                return;
              }
              const shelfConfig = await this.applicationController.createShelf({});
              this.logger.info('✅ Debug shelf created:', shelfConfig);
            } catch (error) {
              this.logger.error('❌ Failed to create debug shelf:', error);
            }
          },
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
          },
        },
      ]);

      this.tray.setContextMenu(contextMenu);
    } catch (error) {
      this.logger.error('Failed to create system tray:', error);
    }
  }

  private createTrayIcon(): Electron.NativeImage {
    try {
      // Try to load icon from bundled assets first
      // In development and production, webpack copies assets to dist/main/assets
      const iconPathCandidates = [
        path.join(__dirname, 'assets/logo.png'), // dist/main/assets/logo.png
        path.join(__dirname, '../../assets/logo.png'), // fallback if structure differs
      ];

      for (const candidate of iconPathCandidates) {
        if (fs.existsSync(candidate)) {
          const image = nativeImage.createFromPath(candidate);
          image.setTemplateImage(true);
          this.logger.info(`✓ Tray icon loaded from asset: ${candidate}`);
          return image;
        }
      }

      // Fallback: Use a simple geometric pattern
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
            canvas[index] = 0; // R
            canvas[index + 1] = 0; // G
            canvas[index + 2] = 0; // B
            canvas[index + 3] = 200; // A
          }
        }
      }

      const image = nativeImage.createFromBuffer(canvas, { width: size, height: size });
      image.setTemplateImage(true);

      this.logger.info('✓ Tray icon created programmatically');
      return image;
    } catch (error) {
      this.logger.error('Failed to create custom tray icon:', error);

      try {
        // Fallback: Try to create from a simple base64 PNG
        const simpleIcon =
          'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAFWSURBVDiNpZM9SwNBEIafgwQSCxsLwcJCG1sLG0uxsLGwsLGwsLBQsLGwsLGwsLGwsLGwsLBQsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLBQsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLGwsLBQsLGwsLGwsLBQ';
        const buffer = Buffer.from(simpleIcon, 'base64');
        const fallbackImage = nativeImage.createFromBuffer(buffer);
        fallbackImage.setTemplateImage(true);

        this.logger.info('✓ Using fallback tray icon');
        return fallbackImage;
      } catch (fallbackError) {
        this.logger.error('Failed to create fallback tray icon:', fallbackError);

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
              dotCanvas[index] = 0; // R
              dotCanvas[index + 1] = 0; // G
              dotCanvas[index + 2] = 0; // B
              dotCanvas[index + 3] = 255; // A
            }
          }
        }

        const dotImage = nativeImage.createFromBuffer(dotCanvas, {
          width: dotSize,
          height: dotSize,
        });
        dotImage.setTemplateImage(true);

        this.logger.info('✓ Using minimal dot tray icon');
        return dotImage;
      }
    }
  }

  private showMainWindow(): void {
    // Create window lazily if needed
    if (!this.mainWindow) {
      this.createMainWindow();
    }

    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();

      // Send initial status to renderer
      if (this.applicationController) {
        this.mainWindow.webContents.send('app:status', this.applicationController.getStatus());
      }
    }
  }

  private setupIpcHandlers(): void {
    // Register pattern handlers
    import('./ipc/pattern_handlers')
      .then(({ registerPatternHandlers }) => {
        registerPatternHandlers();
      })
      .catch(error => {
        this.logger.error('Failed to register pattern handlers:', error);
      });

    // Get application status
    ipcMain.handle('app:get-status', () => {
      if (!this.applicationController) {
        return { isRunning: false, error: 'ApplicationController not initialized' };
      }
      return this.applicationController.getStatus();
    });

    // Create shelf manually
    ipcMain.handle('app:create-shelf', async (event, config) => {
      if (!this.applicationController) {
        return null;
      }
      return await this.applicationController.createShelf(config);
    });

    // Update configuration
    ipcMain.handle('app:update-config', (event, config) => {
      if (!this.applicationController) {
        return false;
      }
      this.applicationController.updateConfig(config);
      return true;
    });

    // Handle shelf drop operations
    ipcMain.on('shelf:drop-start', (event, shelfId) => {
      if (this.applicationController) {
        this.applicationController.handleDropStart(shelfId);
      }
    });

    ipcMain.on('shelf:drop-end', (event, shelfId) => {
      if (this.applicationController) {
        this.applicationController.handleDropEnd(shelfId);
      }
    });

    ipcMain.on('shelf:add-files', (event, data) => {
      if (this.applicationController) {
        this.applicationController.handleFilesDropped(data.shelfId, data.files);
      }
    });

    ipcMain.on('shelf:files-dropped', (event, data) => {
      this.logger.debug('📡 Received shelf:files-dropped IPC:', data);
      if (this.applicationController) {
        this.applicationController.handleFilesDropped(data.shelfId, data.files);
      }
    });

    // Centralized IPC handlers for all shelf operations

    // Handle shelf creation
    ipcMain.handle('shelf:create', async (event, config: Partial<ShelfConfig>) => {
      this.logger.debug('📡 Received shelf:create IPC:', config);
      try {
        if (!this.applicationController) {
          this.logger.error('📡 ApplicationController not initialized');
          return null;
        }
        const result = await this.applicationController.createShelf(config);
        this.logger.debug('📡 shelf:create result:', result);
        return result;
      } catch (error) {
        this.logger.error('📡 Error in shelf:create handler:', error);
        return null;
      }
    });

    // Handle item addition to shelf
    ipcMain.handle('shelf:add-item', async (event, shelfId: string, item: ShelfItem) => {
      this.logger.debug('📡 Received shelf:add-item IPC:', { shelfId, item });
      try {
        if (!this.applicationController) {
          this.logger.error('📡 ApplicationController not initialized');
          return false;
        }
        // Route through ApplicationController for consistency
        const result = await this.applicationController.addItemToShelf(shelfId, item);
        this.logger.debug('📡 shelf:add-item result:', result);
        return result;
      } catch (error) {
        this.logger.error('📡 Error in shelf:add-item handler:', error);
        return false;
      }
    });

    // Handle item removal from shelf
    ipcMain.handle('shelf:remove-item', async (event, shelfId: string, itemId: string) => {
      this.logger.debug('📡 Received shelf:remove-item IPC:', { shelfId, itemId });
      try {
        if (!this.applicationController) {
          this.logger.error('📡 ApplicationController not initialized');
          return false;
        }

        this.logger.debug('📡 Calling applicationController.handleItemRemove...');
        this.logger.debug('📡 ApplicationController type:', typeof this.applicationController);
        this.logger.debug(
          '📡 handleItemRemove method exists:',
          typeof this.applicationController.handleItemRemove
        );

        if (typeof this.applicationController.handleItemRemove !== 'function') {
          this.logger.error('📡 handleItemRemove method does not exist!');
          return false;
        }

        const result = await this.applicationController.handleItemRemove(shelfId, itemId);
        this.logger.debug('📡 shelf:remove-item result:', result);
        return result;
      } catch (error) {
        this.logger.error('📡 Error in shelf:remove-item handler:', error);
        this.logger.error('📡 Error stack:', (error as Error).stack);
        return false;
      }
    });

    // Handle shelf visibility
    ipcMain.handle('shelf:show', async (event, shelfId: string) => {
      this.logger.debug('📡 Received shelf:show IPC:', { shelfId });
      try {
        if (!this.applicationController) {
          this.logger.error('📡 ApplicationController not initialized');
          return false;
        }
        const result = await this.applicationController.showShelf(shelfId);
        this.logger.debug('📡 shelf:show result:', result);
        return result;
      } catch (error) {
        this.logger.error('📡 Error in shelf:show handler:', error);
        return false;
      }
    });

    ipcMain.handle('shelf:hide', async (event, shelfId: string) => {
      this.logger.debug('📡 Received shelf:hide IPC:', { shelfId });
      try {
        if (!this.applicationController) {
          this.logger.error('📡 ApplicationController not initialized');
          return false;
        }
        const result = await this.applicationController.hideShelf(shelfId);
        this.logger.debug('📡 shelf:hide result:', result);
        return result;
      } catch (error) {
        this.logger.error('📡 Error in shelf:hide handler:', error);
        return false;
      }
    });

    // Handle shelf close
    ipcMain.handle('shelf:close', async (event, shelfId) => {
      if (!this.applicationController) {
        return false;
      }
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

    // Handle folder selection dialog
    ipcMain.handle('dialog:select-folder', async (event, defaultPath?: string) => {
      const result = await dialog.showOpenDialog({
        defaultPath: defaultPath || app.getPath('downloads'),
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Destination Folder',
        buttonLabel: 'Select Folder',
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
      }
      return null;
    });

    // Handle message box dialog
    ipcMain.handle('dialog:show-message-box', async (event, options) => {
      return await dialog.showMessageBox(options);
    });

    // Check if path is a directory
    ipcMain.handle('fs:check-path-type', async (event, paths: string[]) => {
      const results: Record<string, 'file' | 'folder' | 'unknown'> = {};

      for (const filePath of paths) {
        try {
          const stats = await fs.promises.stat(filePath);
          results[filePath] = stats.isDirectory() ? 'folder' : 'file';
        } catch (error) {
          results[filePath] = 'unknown';
        }
      }

      return results;
    });

    // Native drag file resolution
    ipcMain.handle('drag:get-native-files', async () => {
      if (!this.applicationController) {
        this.logger.debug('📁 No applicationController, returning empty array');
        return [];
      }
      const nativeFiles = this.applicationController.getNativeDraggedFiles();
      this.logger.debug('📁 Returning native dragged files:', {
        count: nativeFiles.length,
        files: nativeFiles,
        type: typeof nativeFiles,
        isArray: Array.isArray(nativeFiles),
      });
      return nativeFiles;
    });

    // Handle single file rename
    ipcMain.handle('fs:rename-file', async (event, oldPath: string, newPath: string) => {
      try {
        await fs.promises.rename(oldPath, newPath);
        this.logger.info(`✅ File renamed: ${path.basename(oldPath)} → ${path.basename(newPath)}`);
        return { success: true };
      } catch (error) {
        this.logger.error(`❌ Failed to rename file ${oldPath} to ${newPath}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Handle batch file rename
    ipcMain.handle(
      'fs:rename-files',
      async (event, operations: Array<{ oldPath: string; newPath: string }>) => {
        const results = [];
        for (const op of operations) {
          try {
            await fs.promises.rename(op.oldPath, op.newPath);
            this.logger.info(
              `✅ File renamed: ${path.basename(op.oldPath)} → ${path.basename(op.newPath)}`
            );
            results.push({ success: true, oldPath: op.oldPath, newPath: op.newPath });
          } catch (error) {
            this.logger.error(`❌ Failed to rename ${op.oldPath}:`, error);
            results.push({
              success: false,
              oldPath: op.oldPath,
              newPath: op.newPath,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
        return { success: true, results };
      }
    );

    // TEST: Add temporary test IPC for file rename validation
    ipcMain.handle('fs:test-rename', async () => {
      try {
        const testSource = '/tmp/test_rename_source.txt';
        const testTarget = '/tmp/test_rename_target.txt';

        // Test if source exists
        const sourceExists = await fs.promises
          .access(testSource)
          .then(() => true)
          .catch(() => false);
        if (!sourceExists) {
          return { success: false, error: 'Test source file not found' };
        }

        // Perform test rename
        await fs.promises.rename(testSource, testTarget);
        this.logger.info(`✅ TEST: File rename IPC working - renamed test file`);

        // Rename back for cleanup
        await fs.promises.rename(testTarget, testSource);

        return { success: true, message: 'File rename IPC backend working correctly' };
      } catch (error) {
        this.logger.error(`❌ TEST: File rename IPC failed:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  private createMainWindow(): void {
    // Only create window if it doesn't exist (lazy loading)
    if (this.mainWindow) {
      return;
    }

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
        sandbox: true, // Enable sandboxing for security
        webviewTag: false, // Explicitly set to false as per Electron security recommendations
      },
      show: false, // Don't show by default - only when requested
      title: 'FileCataloger - Status',
      minimizable: true,
      closable: true,
      resizable: false, // Fixed size window
      skipTaskbar: false,
      backgroundColor: '#ffffff', // Set white background
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
    this.mainWindow.on('close', event => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    // Clean up reference when destroyed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      // Stop status updates when window is destroyed
      getGlobalTimerManager().clearInterval('status-update');
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools();
    }

    // Set up periodic status updates
    getGlobalTimerManager().setInterval(
      'status-update',
      () => {
        if (this.mainWindow && !this.mainWindow.isDestroyed() && this.applicationController) {
          this.mainWindow.webContents.send('app:status', this.applicationController.getStatus());
        }
      },
      2000,
      'Send status updates to renderer'
    );
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  public getApplicationController(): ApplicationController | null {
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
      if (this.applicationController) {
        await this.applicationController.createShelf({});
      }
    });
  }

  private setupPerformanceHandlers(): void {
    performanceMonitor.on('performance-warning', warning => {
      this.logger.warn('Performance warning:', warning);

      // Log to error handler
      errorHandler.handleError(`Performance warning: ${warning.type}`, {
        severity: warning.type.includes('critical') ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
        category: ErrorCategory.PERFORMANCE,
        context: warning,
      });
    });

    performanceMonitor.on('performance-warning-cleared', _data => {
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
        // Stop keyboard manager
        this.logger.info('Stopping keyboard manager...');
        keyboardManager.stop();

        // Stop performance monitor (stops intervals)
        this.logger.info('Stopping performance monitor...');
        performanceMonitor.stop();
        performanceMonitor.destroy();

        // Destroy application controller (cleans up timers and native module)
        if (this.applicationController) {
          this.logger.info('Destroying application controller...');
          await this.applicationController.destroy();
        }

        // Destroy global timer manager (cleans up all timers)
        this.logger.info('Destroying global timer manager...');
        destroyGlobalTimerManager();

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
