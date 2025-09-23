import { BrowserWindow, screen, ipcMain } from 'electron';
import { EventEmitter } from 'events';
import * as path from 'path';
import { ShelfConfig, DockPosition, Vector2D, ShelfItem, ShelfMode } from '@shared/types';
import { SHELF_CONSTANTS } from '@shared/constants';
import { createLogger } from '../utils/logger';
import { globalIPCRateLimiter } from '../utils/ipcRateLimiter';
import { AdvancedWindowPool } from './advancedWindowPool';

/**
 * Advanced shelf window management system
 *
 * Manages floating shelf windows with pooling, docking, and persistence
 */
export class ShelfManager extends EventEmitter {
  private logger = createLogger('ShelfManager');
  private shelves = new Map<string, BrowserWindow>();
  private shelfConfigs = new Map<string, ShelfConfig>();

  // Advanced window pool for performance optimization
  private windowPool: AdvancedWindowPool;

  // Active shelves tracking
  private activeShelves = new Set<string>();
  private dockPositions = new Map<DockPosition, string[]>();

  // Configuration
  private readonly DEFAULT_SHELF_SIZE = {
    width: SHELF_CONSTANTS.DEFAULT_WIDTH,
    height: SHELF_CONSTANTS.DEFAULT_HEIGHT,
  };
  private readonly DOCK_MARGIN = SHELF_CONSTANTS.DOCK_MARGIN;
  private readonly AUTO_HIDE_DELAY = SHELF_CONSTANTS.AUTO_HIDE_DELAY;

  constructor() {
    super();
    this.logger.info('🚀 ShelfManager constructor started');
    this.windowPool = new AdvancedWindowPool({
      maxWarmPool: 2,
      maxColdPool: 3,
      maxTotalPool: 5,
      preloadThreshold: 1,
    });
    this.logger.info('✓ AdvancedWindowPool created');
    this.initializeDockPositions();
    this.logger.info('✓ Dock positions initialized');
    this.setupEventHandlers();
    this.logger.info('✓ ShelfManager IPC event handlers registered');
  }

  /**
   * Initialize dock position tracking
   */
  private initializeDockPositions(): void {
    const positions: DockPosition[] = [
      DockPosition.TOP,
      DockPosition.RIGHT,
      DockPosition.BOTTOM,
      DockPosition.LEFT,
    ];
    positions.forEach(pos => this.dockPositions.set(pos, []));
  }

  /**
   * Wrapper for IPC handlers with rate limiting
   */
  private createRateLimitedHandler<T extends any[], R>(
    channel: string,
    handler: (event: Electron.IpcMainInvokeEvent, ...args: T) => Promise<R> | R
  ): (event: Electron.IpcMainInvokeEvent, ...args: T) => Promise<R> {
    return async (event: Electron.IpcMainInvokeEvent, ...args: T): Promise<R> => {
      // Check rate limit
      const rateLimitResult = globalIPCRateLimiter.checkRateLimit(
        channel,
        event.sender.id.toString()
      );

      if (!rateLimitResult.allowed) {
        this.logger.warn(`IPC rate limit exceeded for channel ${channel}:`, {
          senderId: event.sender.id,
          reason: rateLimitResult.reason,
          resetTime: new Date(rateLimitResult.resetTime).toISOString(),
        });

        // Throw an error that will be passed back to the renderer
        throw new Error(
          `Rate limit exceeded: ${rateLimitResult.reason}. Try again in ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`
        );
      }

      // Call the original handler
      return await handler(event, ...args);
    };
  }

  /**
   * Set up IPC event handlers - DISABLED
   * All IPC handlers moved to main/index.ts for centralized routing
   */
  private setupEventHandlers(): void {
    // NOTE: All IPC handlers have been moved to main/index.ts to avoid duplicate registrations
    // and provide centralized IPC routing. This prevents conflicts and ensures proper error handling.
    this.logger.info('📡 IPC handlers setup skipped - using centralized routing in main/index.ts');
  }

  /**
   * Create a new shelf window
   */
  public async createShelf(config: Partial<ShelfConfig> = {}): Promise<string> {
    // Check if there's already an active shelf
    if (this.activeShelves.size >= 1) {
      this.logger.warn('Shelf creation blocked: Only 1 shelf allowed at a time');
      // Return the ID of the existing shelf and make it visible
      const existingShelfId = Array.from(this.activeShelves)[0];
      this.showShelf(existingShelfId);
      return existingShelfId;
    }

    const shelfId = this.generateShelfId();

    // Create shelf configuration
    const shelfConfig: ShelfConfig = {
      id: shelfId,
      position: config.position || this.getDefaultPosition(),
      dockPosition: config.dockPosition || null,
      isPinned: config.isPinned !== undefined ? config.isPinned : false,
      items: config.items || [],
      isVisible: config.isVisible !== undefined ? config.isVisible : true,
      opacity: config.opacity || SHELF_CONSTANTS.OPACITY,
      isDropZone: config.isDropZone || false,
      autoHide: config.autoHide || false,
      mode: config.mode || ShelfMode.RENAME, // Default to rename mode
    };

    // Get or create window
    const window = await this.acquireWindow();

    // Configure window
    this.configureShelfWindow(window, shelfConfig);

    // Store shelf
    this.shelves.set(shelfId, window);
    this.shelfConfigs.set(shelfId, shelfConfig);
    this.activeShelves.add(shelfId);

    // Handle docking
    if (shelfConfig.dockPosition) {
      this.handleShelfDocking(shelfId, shelfConfig.dockPosition);
    }

    // Set up window event handlers
    this.setupWindowEventHandlers(window, shelfId);

    // Load shelf content
    await this.loadShelfContent(window, shelfConfig);

    this.emit('shelf-created', shelfId, shelfConfig);

    return shelfId;
  }

  /**
   * Acquire a window from the advanced pool
   */
  private async acquireWindow(): Promise<BrowserWindow> {
    return await this.windowPool.getWindow();
  }

  /**
   * Configure shelf window with specific settings
   */
  private configureShelfWindow(window: BrowserWindow, config: ShelfConfig): void {
    // Set window size based on mode
    if (config.mode === ShelfMode.RENAME) {
      // Larger size for rename UI
      window.setSize(900, 600);
    } else {
      // Default shelf size
      window.setSize(this.DEFAULT_SHELF_SIZE.width, this.DEFAULT_SHELF_SIZE.height);
    }

    // Validate and set position
    const x = Math.round(config.position.x || 100);
    const y = Math.round(config.position.y || 100);

    window.setPosition(x, y);

    // Set opacity
    const opacity = config.opacity || 0.9;
    window.setOpacity(opacity);

    // Set visibility
    if (config.isVisible) {
      window.show();
    } else {
      window.hide();
    }

    // Configure window behavior based on pinned state
    if (config.isPinned) {
      window.setAlwaysOnTop(true, 'floating');
    } else {
      window.setAlwaysOnTop(true, 'floating');
    }
  }

  /**
   * Move a shelf to a new position
   */
  public moveShelf(shelfId: string, position: { x: number; y: number }): void {
    const window = this.shelves.get(shelfId);
    if (!window) {
      this.logger.warn(`Cannot move shelf ${shelfId} - window not found`);
      return;
    }

    const x = Math.round(position.x);
    const y = Math.round(position.y);
    window.setPosition(x, y);

    // Update the config
    const config = this.shelfConfigs.get(shelfId);
    if (config) {
      config.position = { x, y };
      this.shelfConfigs.set(shelfId, config);
    }

    this.logger.debug(`Moved shelf ${shelfId} to position (${x}, ${y})`);
  }

  /**
   * Set up event handlers for a shelf window
   */
  private setupWindowEventHandlers(window: BrowserWindow, shelfId: string): void {
    // Log console messages from renderer
    window.webContents.on('console-message', (_event, _level, message) => {
      this.logger.debug(`[Shelf ${shelfId}] ${message}`);
    });

    // Handle window close
    window.on('closed', () => {
      this.handleWindowClosed(shelfId);
    });

    // Handle window move
    window.on('moved', () => {
      this.handleWindowMoved(shelfId);
    });

    // Handle window resize
    window.on('resized', () => {
      this.handleWindowResized(shelfId);
    });

    // Handle focus events
    window.on('focus', () => {
      this.emit('shelf-focused', shelfId);
    });

    window.on('blur', () => {
      this.emit('shelf-blurred', shelfId);

      // ⚡ DISABLED: Auto-hide on blur - shelves should only be hidden manually or when drag ends
    });
  }

  /**
   * Load shelf content
   */
  private async loadShelfContent(window: BrowserWindow, config: ShelfConfig): Promise<void> {
    // Load the React shelf renderer HTML
    // Use __dirname which is more reliable in packaged apps
    const rendererPath = path.join(__dirname, '../renderer/shelf.html');

    try {
      this.logger.debug(`Loading shelf window from: ${rendererPath}`);
      const preloadPath = path.join(__dirname, '../preload/index.js');
      this.logger.debug(`Preload script path: ${preloadPath}`);
      // Import fs at the top of the file for these checks
      const fs = await import('fs');
      this.logger.debug(`Renderer exists: ${fs.existsSync(rendererPath)}`);
      this.logger.debug(`Preload exists: ${fs.existsSync(preloadPath)}`);

      // Load the file first
      await window.loadFile(rendererPath);

      // Send configuration after loading
      window.webContents.once('did-finish-load', () => {
        this.logger.debug(`Shelf window loaded, sending config for ${config.id}`);

        // Check if preload worked
        window.webContents
          .executeJavaScript(
            `
          // Debug logging for API availability
          // console.log('Checking window.api from main:', typeof window.api);
          // console.log('Checking window.electronAPI from main:', typeof window.electronAPI);
          typeof window.api !== 'undefined' || typeof window.electronAPI !== 'undefined'
        `
          )
          .then(hasApi => {
            this.logger.debug(`Preload API available in renderer: ${hasApi}`);
          });

        window.webContents.send('shelf:config', config);
      });

      // Show the window after successful loading
      if (config.isVisible) {
        this.logger.debug(`Showing shelf window ${config.id}`);
        window.show();
        window.focus();

        // Temporarily disable DevTools to avoid crashes
        // if (process.env.NODE_ENV !== 'production') {
        //   window.webContents.openDevTools({ mode: 'detach' });
        // }
      }

      // Also send config after a delay as fallback
      setTimeout(() => {
        if (!window.isDestroyed()) {
          window.webContents.send('shelf:config', config);
        }
      }, 500);
    } catch (error) {
      this.logger.error('Failed to load shelf content:', error);
      this.logger.error('Attempted path:', rendererPath);

      // Fallback: try loading without a path
      try {
        await window.loadURL('data:text/html,<h1>Shelf Loading Error</h1>');
        window.webContents.send('shelf:config', config);

        // Force show the window after content is loaded
        if (config.isVisible) {
          window.show();
          window.focus();
        }
      } catch (fallbackError) {
        this.logger.error('Failed to load fallback shelf content:', fallbackError);
        // Last resort: load a basic HTML page
        await window.loadURL(`data:text/html,
          <html>
            <head><title>Shelf ${config.id}</title></head>
            <body style="background: rgba(0,0,0,0.8); color: white; padding: 20px; font-family: sans-serif;">
              <h3>Shelf ${config.id}</h3>
              <p>Items: ${config.items.length}</p>
              <div id="items"></div>
            </body>
          </html>
        `);

        // Force show the window after content is loaded
        if (config.isVisible) {
          window.show();
          window.focus();
        }
      }
    }
  }

  /**
   * Get default position for new shelves
   */
  private getDefaultPosition(): Vector2D {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    return {
      x: Math.floor(width / 2 - this.DEFAULT_SHELF_SIZE.width / 2),
      y: Math.floor(height / 2 - this.DEFAULT_SHELF_SIZE.height / 2),
    };
  }

  /**
   * Generate unique shelf ID
   */
  private generateShelfId(): string {
    return `shelf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Handle shelf docking
   */
  private handleShelfDocking(shelfId: string, position: DockPosition): void {
    const config = this.shelfConfigs.get(shelfId);
    if (!config) return;

    const dockedShelves = this.dockPositions.get(position) || [];
    dockedShelves.push(shelfId);
    this.dockPositions.set(position, dockedShelves);

    // Calculate docked position
    const dockedPosition = this.calculateDockedPosition(position, dockedShelves.length - 1);
    config.position = dockedPosition;

    // Update window position
    const window = this.shelves.get(shelfId);
    if (window) {
      window.setPosition(dockedPosition.x, dockedPosition.y);
    }
  }

  /**
   * Calculate position for docked shelf
   */
  private calculateDockedPosition(position: DockPosition, index: number): Vector2D {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const shelfWidth = this.DEFAULT_SHELF_SIZE.width;
    const shelfHeight = this.DEFAULT_SHELF_SIZE.height;

    switch (position) {
      case 'top':
        return {
          x: this.DOCK_MARGIN + index * (shelfWidth + this.DOCK_MARGIN),
          y: this.DOCK_MARGIN,
        };

      case 'right':
        return {
          x: width - shelfWidth - this.DOCK_MARGIN,
          y: this.DOCK_MARGIN + index * (shelfHeight + this.DOCK_MARGIN),
        };

      case 'bottom':
        return {
          x: this.DOCK_MARGIN + index * (shelfWidth + this.DOCK_MARGIN),
          y: height - shelfHeight - this.DOCK_MARGIN,
        };

      case 'left':
        return {
          x: this.DOCK_MARGIN,
          y: this.DOCK_MARGIN + index * (shelfHeight + this.DOCK_MARGIN),
        };

      default:
        return this.getDefaultPosition();
    }
  }

  /**
   * Show shelf
   */
  public showShelf(shelfId: string): boolean {
    const window = this.shelves.get(shelfId);
    const config = this.shelfConfigs.get(shelfId);

    if (window && config) {
      window.show();
      config.isVisible = true;
      this.emit('shelf-shown', shelfId);
      return true;
    }

    return false;
  }

  /**
   * Hide shelf
   */
  public hideShelf(shelfId: string): boolean {
    const window = this.shelves.get(shelfId);
    const config = this.shelfConfigs.get(shelfId);

    if (window && config) {
      this.logger.debug(
        `HIDING SHELF: ${shelfId} (items: ${config.items.length}, pinned: ${config.isPinned})`
      );
      // Stack trace logged for debugging shelf lifecycle
      window.hide();
      config.isVisible = false;
      this.emit('shelf-hidden', shelfId);
      return true;
    }

    return false;
  }

  /**
   * Dock shelf
   */
  public dockShelf(shelfId: string, position: DockPosition): boolean {
    const config = this.shelfConfigs.get(shelfId);
    if (!config) return false;

    // Undock from current position first
    if (config.dockPosition) {
      this.undockShelf(shelfId);
    }

    config.dockPosition = position;
    this.handleShelfDocking(shelfId, position);

    this.emit('shelf-docked', shelfId, position);
    return true;
  }

  /**
   * Undock shelf
   */
  public undockShelf(shelfId: string): boolean {
    const config = this.shelfConfigs.get(shelfId);
    if (!config || !config.dockPosition) return false;

    // Remove from dock position tracking
    const dockedShelves = this.dockPositions.get(config.dockPosition) || [];
    const index = dockedShelves.indexOf(shelfId);
    if (index > -1) {
      dockedShelves.splice(index, 1);
      this.dockPositions.set(config.dockPosition, dockedShelves);
    }

    config.dockPosition = null;
    this.emit('shelf-undocked', shelfId);
    return true;
  }

  /**
   * Add item to shelf
   */
  public addItemToShelf(shelfId: string, item: ShelfItem): boolean {
    const config = this.shelfConfigs.get(shelfId);
    const window = this.shelves.get(shelfId);

    this.logger.debug(`ADD ITEM TO SHELF: ${shelfId}`);
    this.logger.debug(`  - Config exists: ${!!config}`);
    this.logger.debug(`  - Window exists: ${!!window}`);
    this.logger.debug(`  - Window destroyed: ${window ? window.isDestroyed() : 'N/A'}`);
    this.logger.debug(`  - Current items: ${config?.items.length || 0}`);
    this.logger.debug(`  - Item to add:`, item);

    if (config && window && !window.isDestroyed()) {
      config.items.push(item);
      this.logger.debug(`  Item added! New count: ${config.items.length}`);

      // Notify renderer
      window.webContents.send('shelf:item-added', item);
      this.emit('shelf-item-added', shelfId, item);

      // Make sure shelf is visible and won't auto-hide
      if (!config.isVisible) {
        this.logger.debug(`  Making shelf visible`);
        this.showShelf(shelfId);
      }

      // Mark as pinned since it has content
      if (!config.isPinned && config.items.length > 0) {
        this.logger.debug(`  Pinning shelf with content`);
        config.isPinned = true;
      }

      return true;
    }

    this.logger.debug(`  FAILED to add item!`);
    return false;
  }

  /**
   * Remove item from shelf
   */
  public removeItemFromShelf(shelfId: string, itemId: string): boolean {
    const config = this.shelfConfigs.get(shelfId);
    const window = this.shelves.get(shelfId);

    if (config && window) {
      const index = config.items.findIndex(item => item.id === itemId);
      if (index > -1) {
        const removedItem = config.items.splice(index, 1)[0];

        // Add debug logging for item removal
        this.logger.debug(`🗑️ ShelfManager: Removed item ${itemId} from shelf ${shelfId}`);
        this.logger.debug(`🗑️ ShelfManager: Shelf now has ${config.items.length} items`);

        // Notify renderer
        window.webContents.send('shelf:item-removed', itemId);

        // IMPORTANT: Always emit the event so ApplicationController can handle empty shelf logic
        this.emit('shelf-item-removed', shelfId, removedItem);

        // Do NOT automatically destroy empty shelves here - let ApplicationController handle it
        // The ApplicationController has the proper logic for auto-hide timers and drag state checking

        return true;
      }
    }

    return false;
  }

  /**
   * Update shelf configuration
   */
  public updateShelfConfig(shelfId: string, changes: Partial<ShelfConfig>): boolean {
    const config = this.shelfConfigs.get(shelfId);
    const window = this.shelves.get(shelfId);

    if (!config) {
      this.logger.warn(`Shelf not found: ${shelfId}`);
      return false;
    }

    // Update the configuration
    const updatedConfig = { ...config, ...changes };
    this.shelfConfigs.set(shelfId, updatedConfig);

    // Send updated config to renderer
    if (window && !window.isDestroyed()) {
      window.webContents.send('shelf:config', updatedConfig);
    }

    return true;
  }

  /**
   * Destroy shelf
   */
  public destroyShelf(shelfId: string): boolean {
    return this.destroyShelfInternal(shelfId, false);
  }

  public forceDestroyShelf(shelfId: string): boolean {
    return this.destroyShelfInternal(shelfId, true);
  }

  private destroyShelfInternal(shelfId: string, forceDestroy: boolean = false): boolean {
    const window = this.shelves.get(shelfId);
    const config = this.shelfConfigs.get(shelfId);

    if (window || config) {
      this.logger.debug(
        `${forceDestroy ? 'FORCE ' : ''}DESTROYING SHELF: ${shelfId} (items: ${config?.items.length || 0}, pinned: ${config?.isPinned || false})`
      );
      // Stack trace logged for debugging shelf lifecycle

      // Undock if needed
      if (config?.dockPosition) {
        this.undockShelf(shelfId);
      }

      // Handle window cleanup
      if (window && !window.isDestroyed()) {
        if (forceDestroy) {
          // Force immediate destruction for user-initiated close
          window.destroy();
        } else {
          // Use pool for performance optimization
          this.releaseWindow(window);
        }
      }

      // Clean up tracking
      this.shelves.delete(shelfId);
      this.shelfConfigs.delete(shelfId);
      this.activeShelves.delete(shelfId);

      this.emit('shelf-destroyed', shelfId);
      this.logger.debug(`Shelf destroyed: ${shelfId}`);
      return true;
    }

    return false;
  }

  /**
   * Release window back to advanced pool
   */
  private releaseWindow(window: BrowserWindow): void {
    this.windowPool.releaseWindow(window);
  }

  /**
   * Handle window closed event
   */
  private handleWindowClosed(shelfId: string): void {
    this.destroyShelf(shelfId);
  }

  /**
   * Handle window moved event
   */
  private handleWindowMoved(shelfId: string): void {
    const window = this.shelves.get(shelfId);
    const config = this.shelfConfigs.get(shelfId);

    if (window && config) {
      const [x, y] = window.getPosition();
      config.position = { x, y };
      this.emit('shelf-moved', shelfId, { x, y });
    }
  }

  /**
   * Handle window resized event
   */
  private handleWindowResized(shelfId: string): void {
    const window = this.shelves.get(shelfId);

    if (window) {
      const [width, height] = window.getSize();
      this.emit('shelf-resized', shelfId, { width, height });
    }
  }

  /**
   * Get all active shelves
   */
  public getActiveShelves(): string[] {
    return Array.from(this.activeShelves);
  }

  /**
   * Get shelf configuration
   */
  public getShelfConfig(shelfId: string): ShelfConfig | undefined {
    return this.shelfConfigs.get(shelfId);
  }

  /**
   * Destroy all shelves and clean up
   */
  public destroy(): void {
    // Destroy all active shelves
    for (const shelfId of this.activeShelves) {
      this.destroyShelf(shelfId);
    }

    // Destroy window pool
    this.windowPool.destroy();

    // Remove IPC handlers
    ipcMain.removeAllListeners('shelf:create');
    ipcMain.removeAllListeners('shelf:destroy');
    ipcMain.removeAllListeners('shelf:show');
    ipcMain.removeAllListeners('shelf:hide');
    ipcMain.removeAllListeners('shelf:dock');
    ipcMain.removeAllListeners('shelf:undock');
    ipcMain.removeAllListeners('shelf:add-item');
    ipcMain.removeAllListeners('shelf:remove-item');

    this.removeAllListeners();
  }
}
