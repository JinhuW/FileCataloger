import { BrowserWindow } from 'electron';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { SHELF_CONSTANTS } from '@shared/constants';

/**
 * Advanced Window Pool with Warm/Cold Pool Architecture
 *
 * Provides optimized window management with:
 * - Warm pool: Pre-initialized windows ready for immediate use
 * - Cold pool: Basic windows that need initialization
 * - Smart preloading based on usage patterns
 * - Memory management and cleanup
 */

export interface PooledWindow {
  window: BrowserWindow;
  isWarm: boolean;
  lastUsed: number;
  createdAt: number;
  usageCount: number;
}

export interface WindowPoolConfig {
  maxWarmPool: number;
  maxColdPool: number;
  maxTotalPool: number;
  warmupTimeoutMs: number;
  coldWindowTimeoutMs: number;
  preloadThreshold: number; // Preload when warm pool drops below this
}

export class AdvancedWindowPool {
  private logger = createLogger('AdvancedWindowPool');
  private warmPool: PooledWindow[] = [];
  private coldPool: PooledWindow[] = [];
  private inUseWindows = new Map<string, PooledWindow>();

  private config: WindowPoolConfig = {
    maxWarmPool: 2,
    maxColdPool: 3,
    maxTotalPool: 5,
    warmupTimeoutMs: 1000,
    coldWindowTimeoutMs: 300000, // 5 minutes
    preloadThreshold: 1,
  };

  private cleanupTimer: NodeJS.Timeout | null = null;
  private preloadTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<WindowPoolConfig>) {
    this.config = { ...this.config, ...config };
    this.startCleanupTimer();
    this.logger.info('AdvancedWindowPool initialized', this.config);
  }

  /**
   * Get a window from the pool, prioritizing warm windows
   */
  async getWindow(): Promise<BrowserWindow> {
    // Try warm pool first (pre-initialized)
    let pooledWindow = this.warmPool.pop();
    if (pooledWindow && !pooledWindow.window.isDestroyed()) {
      pooledWindow.lastUsed = Date.now();
      pooledWindow.usageCount++;
      this.inUseWindows.set(this.getWindowId(pooledWindow.window), pooledWindow);

      this.logger.debug('Retrieved warm window from pool', {
        warmPoolSize: this.warmPool.length,
        coldPoolSize: this.coldPool.length,
        usageCount: pooledWindow.usageCount,
      });

      this.schedulePreload();
      return pooledWindow.window;
    }

    // Try cold pool
    pooledWindow = this.coldPool.pop();
    if (pooledWindow && !pooledWindow.window.isDestroyed()) {
      this.logger.debug('Retrieved cold window, warming up...', {
        warmPoolSize: this.warmPool.length,
        coldPoolSize: this.coldPool.length,
      });

      await this.warmUpWindow(pooledWindow);
      pooledWindow.lastUsed = Date.now();
      pooledWindow.usageCount++;
      this.inUseWindows.set(this.getWindowId(pooledWindow.window), pooledWindow);

      this.schedulePreload();
      return pooledWindow.window;
    }

    // Create new window if pool is empty
    this.logger.debug('Creating new window - pools empty', {
      warmPoolSize: this.warmPool.length,
      coldPoolSize: this.coldPool.length,
    });

    const newWindow = this.createWindow();
    pooledWindow = {
      window: newWindow,
      isWarm: false,
      lastUsed: Date.now(),
      createdAt: Date.now(),
      usageCount: 1,
    };

    await this.warmUpWindow(pooledWindow);
    this.inUseWindows.set(this.getWindowId(newWindow), pooledWindow);

    this.schedulePreload();
    return newWindow;
  }

  /**
   * Return a window to the pool
   */
  releaseWindow(window: BrowserWindow): void {
    const windowId = this.getWindowId(window);
    const pooledWindow = this.inUseWindows.get(windowId);

    if (!pooledWindow) {
      // Window not from pool, destroy it
      if (!window.isDestroyed()) {
        window.destroy();
      }
      return;
    }

    this.inUseWindows.delete(windowId);

    if (window.isDestroyed()) {
      this.logger.debug('Window destroyed, not returning to pool');
      return;
    }

    // Clean window state
    this.cleanWindowState(window);

    // Determine which pool to return to
    const totalPoolSize = this.warmPool.length + this.coldPool.length;

    if (totalPoolSize >= this.config.maxTotalPool) {
      // Pool is full, destroy window
      this.logger.debug('Pool full, destroying window', {
        totalPoolSize,
        maxTotalPool: this.config.maxTotalPool,
      });
      window.destroy();
      return;
    }

    // Return to warm pool if space available and recently used
    const recentlyUsed = Date.now() - pooledWindow.lastUsed < 30000; // 30 seconds
    if (
      this.warmPool.length < this.config.maxWarmPool &&
      (recentlyUsed || pooledWindow.usageCount > 1)
    ) {
      pooledWindow.isWarm = true;
      this.warmPool.push(pooledWindow);
      this.logger.debug('Returned window to warm pool', {
        warmPoolSize: this.warmPool.length,
        usageCount: pooledWindow.usageCount,
      });
    } else if (this.coldPool.length < this.config.maxColdPool) {
      pooledWindow.isWarm = false;
      this.coldPool.push(pooledWindow);
      this.logger.debug('Returned window to cold pool', {
        coldPoolSize: this.coldPool.length,
      });
    } else {
      // No space in pools, destroy window
      window.destroy();
      this.logger.debug('No pool space available, destroyed window');
    }
  }

  /**
   * Create a new browser window
   */
  private createWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: SHELF_CONSTANTS.DEFAULT_WIDTH, // Use constants for sizing
      height: SHELF_CONSTANTS.DEFAULT_HEIGHT,
      minWidth: SHELF_CONSTANTS.MIN_WIDTH, // Add min constraints
      minHeight: SHELF_CONSTANTS.MIN_HEIGHT,
      maxWidth: SHELF_CONSTANTS.MAX_WIDTH, // Add max constraints
      maxHeight: SHELF_CONSTANTS.MAX_HEIGHT,
      frame: false,
      transparent: true,
      backgroundColor: undefined,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: SHELF_CONSTANTS.RESIZABLE,
      minimizable: true,
      maximizable: false,
      closable: true,
      focusable: true,
      show: false,
      movable: true,
      hasShadow: false,
      acceptFirstMouse: true,
      titleBarStyle: 'hiddenInset', // Show traffic lights always, hide title bar
      trafficLightPosition: { x: 20, y: 15 }, // Position traffic lights at top of window
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        preload: path.join(__dirname, '../preload/index.js'),
        webSecurity: true,
        webviewTag: false,
      },
    });

    // Set window properties
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.setAlwaysOnTop(true, 'floating');

    return window;
  }

  /**
   * Warm up a window by preloading content
   */
  private async warmUpWindow(pooledWindow: PooledWindow): Promise<void> {
    if (pooledWindow.isWarm) {
      return;
    }

    const { window } = pooledWindow;

    try {
      // Preload the shelf HTML
      const rendererPath = path.join(__dirname, '../renderer/shelf.html');
      await window.loadFile(rendererPath);

      // Mark as warm after successful preload
      pooledWindow.isWarm = true;

      this.logger.debug('Window warmed up successfully');
    } catch (error) {
      this.logger.warn('Failed to warm up window:', error);
      // Keep as cold window, it will be warmed up when needed
    }
  }

  /**
   * Clean window state before returning to pool
   */
  private cleanWindowState(window: BrowserWindow): void {
    if (window.isDestroyed()) {
      return;
    }

    try {
      // Reset window state
      window.removeAllListeners();
      window.hide();
      window.setPosition(0, 0);
      // Don't reset size - preserve last used dimensions for better UX
      // window.setSize(900, 600); // REMOVED to support dynamic sizing
      window.setOpacity(1.0);
    } catch (error) {
      this.logger.warn('Error cleaning window state:', error);
    }
  }

  /**
   * Get unique window ID
   */
  private getWindowId(window: BrowserWindow): string {
    return window.id.toString();
  }

  /**
   * Schedule preloading of warm windows
   */
  private schedulePreload(): void {
    if (this.preloadTimer) {
      return;
    }

    this.preloadTimer = setTimeout(() => {
      this.preloadTimer = null;
      this.preloadWarmWindows();
    }, 100);
  }

  /**
   * Preload warm windows if below threshold
   */
  private async preloadWarmWindows(): Promise<void> {
    if (this.warmPool.length >= this.config.preloadThreshold) {
      return;
    }

    const totalPoolSize = this.warmPool.length + this.coldPool.length + this.inUseWindows.size;

    if (totalPoolSize >= this.config.maxTotalPool) {
      return;
    }

    // Try to warm up cold windows first
    if (this.coldPool.length > 0 && this.warmPool.length < this.config.maxWarmPool) {
      const coldWindow = this.coldPool.pop();
      if (coldWindow && !coldWindow.window.isDestroyed()) {
        this.logger.debug('Preloading: warming up cold window');
        await this.warmUpWindow(coldWindow);
        this.warmPool.push(coldWindow);
        return;
      }
    }

    // Create new window if we have space
    if (
      this.warmPool.length < this.config.maxWarmPool &&
      totalPoolSize < this.config.maxTotalPool
    ) {
      this.logger.debug('Preloading: creating new warm window');

      const window = this.createWindow();
      const pooledWindow: PooledWindow = {
        window,
        isWarm: false,
        lastUsed: 0,
        createdAt: Date.now(),
        usageCount: 0,
      };

      await this.warmUpWindow(pooledWindow);
      this.warmPool.push(pooledWindow);
    }
  }

  /**
   * Start cleanup timer for removing stale windows
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // Run cleanup every minute
  }

  /**
   * Cleanup stale windows and optimize pool sizes
   */
  private cleanup(): void {
    const now = Date.now();

    // EMERGENCY: Clean up ghost windows from crashed renderers
    const ghostWindows: string[] = [];
    for (const [windowId, pooledWindow] of this.inUseWindows.entries()) {
      if (pooledWindow.window.isDestroyed() || pooledWindow.window.webContents.isDestroyed()) {
        ghostWindows.push(windowId);
        this.logger.debug(`Found ghost window: ${windowId}`);
      }
    }

    // Remove ghost windows from tracking
    for (const windowId of ghostWindows) {
      this.inUseWindows.delete(windowId);
      this.logger.debug(`Cleaned up ghost window: ${windowId}`);
    }

    // Clean up cold windows that are too old
    this.coldPool = this.coldPool.filter(pooledWindow => {
      const age = now - pooledWindow.createdAt;
      const isStale = age > this.config.coldWindowTimeoutMs;

      if (isStale && !pooledWindow.window.isDestroyed()) {
        this.logger.debug('Cleaning up stale cold window', { age: age / 1000 });
        pooledWindow.window.destroy();
        return false;
      }

      return !pooledWindow.window.isDestroyed();
    });

    // Clean up destroyed windows from warm pool
    this.warmPool = this.warmPool.filter(pooledWindow => !pooledWindow.window.isDestroyed());

    // Log pool status
    this.logger.debug('Pool cleanup completed', {
      warmPoolSize: this.warmPool.length,
      coldPoolSize: this.coldPool.length,
      inUseCount: this.inUseWindows.size,
    });
  }

  /**
   * Get pool statistics
   */
  getPoolStats(): {
    warmPoolSize: number;
    coldPoolSize: number;
    inUseCount: number;
    totalPoolSize: number;
    config: WindowPoolConfig;
  } {
    return {
      warmPoolSize: this.warmPool.length,
      coldPoolSize: this.coldPool.length,
      inUseCount: this.inUseWindows.size,
      totalPoolSize: this.warmPool.length + this.coldPool.length,
      config: { ...this.config },
    };
  }

  /**
   * Update pool configuration
   */
  updateConfig(newConfig: Partial<WindowPoolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Pool configuration updated', this.config);
  }

  /**
   * Destroy all windows and cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.preloadTimer) {
      clearTimeout(this.preloadTimer);
      this.preloadTimer = null;
    }

    // Destroy all warm pool windows
    for (const pooledWindow of this.warmPool) {
      if (!pooledWindow.window.isDestroyed()) {
        pooledWindow.window.destroy();
      }
    }

    // Destroy all cold pool windows
    for (const pooledWindow of this.coldPool) {
      if (!pooledWindow.window.isDestroyed()) {
        pooledWindow.window.destroy();
      }
    }

    // Destroy all in-use windows
    for (const pooledWindow of this.inUseWindows.values()) {
      if (!pooledWindow.window.isDestroyed()) {
        pooledWindow.window.destroy();
      }
    }

    this.warmPool = [];
    this.coldPool = [];
    this.inUseWindows.clear();

    this.logger.info('AdvancedWindowPool destroyed');
  }
}
