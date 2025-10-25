import { EventEmitter } from 'events';
import { createLogger } from './logger';

/**
 * Manages event listener registration and automatic cleanup
 * Prevents memory leaks by tracking all registered listeners
 */
export class EventRegistry {
  private readonly logger = createLogger('EventRegistry');
  private readonly listeners: Map<string, Array<{ emitter: EventEmitter; event: string; handler: (...args: any[]) => void }>> = new Map();
  private readonly cleanupFunctions: Array<() => void> = [];

  /**
   * Register an event listener with automatic cleanup tracking
   * @param emitter The event emitter to listen on
   * @param event The event name
   * @param handler The event handler function
   * @param group Optional group name for batch cleanup
   * @returns Cleanup function to unregister this specific listener
   */
  public register(
    emitter: EventEmitter,
    event: string,
    handler: (...args: any[]) => void,
    group: string = 'default'
  ): () => void {
    // Register the listener
    emitter.on(event, handler as any);

    // Track the listener
    if (!this.listeners.has(group)) {
      this.listeners.set(group, []);
    }
    this.listeners.get(group)!.push({ emitter, event, handler });

    // Return cleanup function
    const cleanup = () => {
      emitter.removeListener(event, handler as any);
      const groupListeners = this.listeners.get(group);
      if (groupListeners) {
        const index = groupListeners.findIndex(
          l => l.emitter === emitter && l.event === event && l.handler === handler
        );
        if (index !== -1) {
          groupListeners.splice(index, 1);
        }
      }
    };

    this.cleanupFunctions.push(cleanup);
    return cleanup;
  }

  /**
   * Register a one-time event listener with automatic cleanup tracking
   */
  public registerOnce(
    emitter: EventEmitter,
    event: string,
    handler: (...args: any[]) => void,
    group: string = 'default'
  ): () => void {
    // Wrap handler to auto-cleanup after execution
    const wrappedHandler = (...args: any[]) => {
      handler(...args);
      this.unregisterListener(emitter, event, wrappedHandler, group);
    };

    emitter.once(event, wrappedHandler);

    // Track the listener
    if (!this.listeners.has(group)) {
      this.listeners.set(group, []);
    }
    this.listeners.get(group)!.push({ emitter, event, handler: wrappedHandler });

    // Return cleanup function
    return () => this.unregisterListener(emitter, event, wrappedHandler, group);
  }

  /**
   * Unregister a specific listener
   */
  private unregisterListener(
    emitter: EventEmitter,
    event: string,
    handler: (...args: any[]) => void,
    group: string
  ): void {
    emitter.removeListener(event, handler as any);
    const groupListeners = this.listeners.get(group);
    if (groupListeners) {
      const index = groupListeners.findIndex(
        l => l.emitter === emitter && l.event === event && l.handler === handler
      );
      if (index !== -1) {
        groupListeners.splice(index, 1);
      }
    }
  }

  /**
   * Clean up all listeners in a specific group
   */
  public cleanupGroup(group: string): void {
    const groupListeners = this.listeners.get(group);
    if (!groupListeners) return;

    let cleanedCount = 0;
    for (const { emitter, event, handler } of groupListeners) {
      try {
        emitter.removeListener(event, handler as any);
        cleanedCount++;
      } catch (error) {
        this.logger.error(`Failed to remove listener for ${event}:`, error);
      }
    }

    this.listeners.delete(group);
    this.logger.info(`Cleaned up ${cleanedCount} listeners in group '${group}'`);
  }

  /**
   * Clean up all registered listeners
   */
  public cleanupAll(): void {
    let totalCleaned = 0;

    // Clean up all groups
    for (const groupListeners of this.listeners.values()) {
      for (const { emitter, event, handler } of groupListeners) {
        try {
          emitter.removeListener(event, handler as any);
          totalCleaned++;
        } catch (error) {
          this.logger.error(`Failed to remove listener for ${event}:`, error);
        }
      }
    }

    // Clear all tracking
    this.listeners.clear();
    this.cleanupFunctions.length = 0;

    this.logger.info(`Cleaned up ${totalCleaned} total listeners`);
  }

  /**
   * Get statistics about registered listeners
   */
  public getStats(): { totalListeners: number; groups: Map<string, number> } {
    const groups = new Map<string, number>();
    let totalListeners = 0;

    for (const [group, listeners] of this.listeners) {
      groups.set(group, listeners.length);
      totalListeners += listeners.length;
    }

    return { totalListeners, groups };
  }

  /**
   * Check if there are any registered listeners
   */
  public hasListeners(): boolean {
    for (const listeners of this.listeners.values()) {
      if (listeners.length > 0) return true;
    }
    return false;
  }
}