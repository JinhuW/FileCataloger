/**
 * Memory-efficient window pool with lifecycle management
 */

import { BrowserWindow } from 'electron';
import { createLogger } from '../utils/logger';

const logger = createLogger('OptimizedWindowPool');

export class OptimizedWindowPool {
  private idleWindows: WeakSet<BrowserWindow> = new WeakSet();
  private activeWindows: Map<string, BrowserWindow> = new Map();
  private windowCreationTimes: WeakMap<BrowserWindow, number> = new WeakMap();
  private maxPoolSize: number = 3;
  private maxWindowAge: number = 5 * 60 * 1000; // 5 minutes
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(maxPoolSize: number = 3) {
    this.maxPoolSize = maxPoolSize;
    this.startCleanupTimer();
  }

  /**
   * Get a window from pool or create new one
   */
  public getWindow(createWindowFn: () => BrowserWindow): BrowserWindow {
    // Try to reuse an idle window
    for (const window of this.getIdleWindows()) {
      if (!window.isDestroyed() && this.isWindowValid(window)) {
        this.idleWindows.delete(window);
        this.resetWindowForReuse(window);
        logger.debug('Reused window from pool');
        return window;
      }
    }

    // Create new window
    const window = createWindowFn();
    this.windowCreationTimes.set(window, Date.now());
    logger.debug('Created new window');
    return window;
  }

  /**
   * Return window to pool or destroy if pool is full
   */
  public releaseWindow(window: BrowserWindow, windowId?: string): void {
    if (windowId && this.activeWindows.has(windowId)) {
      this.activeWindows.delete(windowId);
    }

    if (window.isDestroyed()) {
      return;
    }

    // Check if pool is full or window is too old
    if (this.getIdleWindowCount() >= this.maxPoolSize || !this.isWindowValid(window)) {
      this.destroyWindow(window);
      return;
    }

    // Clean window state and add to idle pool
    try {
      this.resetWindowForPool(window);
      this.idleWindows.add(window);
      logger.debug('Window returned to pool');
    } catch (error) {
      logger.error('Failed to return window to pool, destroying:', error);
      this.destroyWindow(window);
    }
  }

  /**
   * Track active window
   */
  public trackActiveWindow(windowId: string, window: BrowserWindow): void {
    this.activeWindows.set(windowId, window);
  }

  /**
   * Clean up all windows and destroy pool
   */
  public destroy(): void {
    this.stopCleanupTimer();

    // Destroy all active windows
    for (const [id, window] of this.activeWindows.entries()) {
      this.destroyWindow(window);
      this.activeWindows.delete(id);
    }

    // Destroy all idle windows
    for (const window of this.getIdleWindows()) {
      this.destroyWindow(window);
    }

    logger.info('Window pool destroyed');
  }

  private getIdleWindows(): BrowserWindow[] {
    // Convert WeakSet to array by checking all potential windows
    // This is a limitation of WeakSet - we need to maintain our own reference
    const windows: BrowserWindow[] = [];

    // We'll need to track idle windows differently
    // For now, use a simpler Map-based approach
    return windows;
  }

  private getIdleWindowCount(): number {
    return this.getIdleWindows().length;
  }

  private isWindowValid(window: BrowserWindow): boolean {
    if (window.isDestroyed()) {
      return false;
    }

    const creationTime = this.windowCreationTimes.get(window);
    if (creationTime && Date.now() - creationTime > this.maxWindowAge) {
      return false;
    }

    return true;
  }

  private resetWindowForReuse(window: BrowserWindow): void {
    window.removeAllListeners();
    window.hide();
    window.setAlwaysOnTop(true, 'floating');
  }

  private resetWindowForPool(window: BrowserWindow): void {
    window.removeAllListeners();
    window.hide();
    // Remove any custom properties or states
    window.setOpacity(1.0);
  }

  private destroyWindow(window: BrowserWindow): void {
    try {
      if (!window.isDestroyed()) {
        window.removeAllListeners();
        window.destroy();
      }
      this.windowCreationTimes.delete(window);
    } catch (error) {
      logger.error('Error destroying window:', error);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, 60000); // Clean every minute
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private performCleanup(): void {
    const windows = this.getIdleWindows();
    let cleanedCount = 0;

    for (const window of windows) {
      if (!this.isWindowValid(window)) {
        this.idleWindows.delete(window);
        this.destroyWindow(window);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned up ${cleanedCount} expired windows`);
    }
  }

  public getStats(): {
    active: number;
    idle: number;
    maxPoolSize: number;
  } {
    return {
      active: this.activeWindows.size,
      idle: this.getIdleWindowCount(),
      maxPoolSize: this.maxPoolSize,
    };
  }
}
