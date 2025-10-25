import { createLogger, Logger } from './logger';

/**
 * Centralized timer management to prevent memory leaks
 * and ensure proper cleanup on application shutdown
 */
export class TimerManager {
  private logger: Logger;
  private timers = new Map<string, NodeJS.Timeout>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private destroyed = false;

  constructor(context: string = 'TimerManager') {
    this.logger = createLogger(context);
  }

  /**
   * Set a timeout with automatic tracking
   */
  public setTimeout(id: string, callback: () => void, delay: number, description?: string): void {
    if (this.destroyed) {
      this.logger.warn(`Cannot set timer '${id}' - TimerManager is destroyed`);
      return;
    }

    // Clear existing timer with same ID
    this.clearTimeout(id);

    const timer = setTimeout(() => {
      // Remove from tracking when timer fires
      this.timers.delete(id);

      try {
        callback();
      } catch (error) {
        this.logger.error(`Timer '${id}' callback error:`, error);
      }
    }, delay);

    this.timers.set(id, timer);
    this.logger.debug(`Timer set: ${id} (${delay}ms) - ${description || 'No description'}`);
  }

  /**
   * Set an interval with automatic tracking
   */
  public setInterval(
    id: string,
    callback: () => void,
    interval: number,
    description?: string
  ): void {
    if (this.destroyed) {
      this.logger.warn(`Cannot set interval '${id}' - TimerManager is destroyed`);
      return;
    }

    // Clear existing interval with same ID
    this.clearInterval(id);

    const timer = setInterval(() => {
      try {
        callback();
      } catch (error) {
        this.logger.error(`Interval '${id}' callback error:`, error);
      }
    }, interval);

    this.intervals.set(id, timer);
    this.logger.debug(`Interval set: ${id} (${interval}ms) - ${description || 'No description'}`);
  }

  /**
   * Clear a specific timeout
   */
  public clearTimeout(id: string): boolean {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
      this.logger.debug(`Timer cleared: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Clear a specific interval
   */
  public clearInterval(id: string): boolean {
    const timer = this.intervals.get(id);
    if (timer) {
      clearInterval(timer);
      this.intervals.delete(id);
      this.logger.debug(`Interval cleared: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Check if a timer exists
   */
  public hasTimer(id: string): boolean {
    return this.timers.has(id);
  }

  /**
   * Check if an interval exists
   */
  public hasInterval(id: string): boolean {
    return this.intervals.has(id);
  }

  /**
   * Clear all timers and intervals
   */
  public clearAll(): void {
    // Clear all timeouts
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
      this.logger.debug(`Cleared timeout: ${id}`);
    }
    this.timers.clear();

    // Clear all intervals
    for (const [id, timer] of this.intervals) {
      clearInterval(timer);
      this.logger.debug(`Cleared interval: ${id}`);
    }
    this.intervals.clear();

    this.logger.info(
      `Cleared all timers - ${this.timers.size} timeouts, ${this.intervals.size} intervals`
    );
  }

  /**
   * Get statistics about active timers
   */
  public getStats(): { timeouts: number; intervals: number; total: number } {
    return {
      timeouts: this.timers.size,
      intervals: this.intervals.size,
      total: this.timers.size + this.intervals.size,
    };
  }

  /**
   * Destroy the timer manager and clear all timers
   */
  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.logger.info('Destroying TimerManager...');
    this.clearAll();
    this.destroyed = true;
  }
}

// Singleton instance for global timer management
let globalTimerManager: TimerManager | null = null;

export function getGlobalTimerManager(): TimerManager {
  if (!globalTimerManager) {
    globalTimerManager = new TimerManager('GlobalTimerManager');
  }
  return globalTimerManager;
}

export function destroyGlobalTimerManager(): void {
  if (globalTimerManager) {
    globalTimerManager.destroy();
    globalTimerManager = null;
  }
}
