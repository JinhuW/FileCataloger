import { EventEmitter } from 'events';
import { Logger, createLogger } from '../utils/logger';
import { TimerManager } from '../utils/timer_manager';
import { PreferencesManager } from '../config/preferences_manager';
import { ShelfLifecycleManager } from './shelf_lifecycle_manager';
import { DragShelfStateMachine } from '../state/drag_shelf_state_machine';
import { SHELF_CONSTANTS } from '@shared/constants';

/**
 * Configuration for auto-hide behavior
 */
export interface AutoHideConfig {
  enabled: boolean;
  emptyShelfTimeout: number;
  checkInterval: number;
  dragBlocksHide: boolean;
  dropBlocksHide: boolean;
}

/**
 * Manages auto-hide behavior for empty shelves
 * Extracted from ApplicationController for better separation of concerns
 */
export class AutoHideManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly timerManager: TimerManager;
  private readonly pendingAutoHides = new Map<string, string>();

  private config: AutoHideConfig = {
    enabled: true,
    emptyShelfTimeout: SHELF_CONSTANTS.EMPTY_TIMEOUT,
    checkInterval: 1000,
    dragBlocksHide: true,
    dropBlocksHide: true,
  };

  constructor(
    private readonly shelfLifecycleManager: ShelfLifecycleManager,
    private readonly preferencesManager: PreferencesManager,
    private readonly stateMachine: DragShelfStateMachine
  ) {
    super();
    this.logger = createLogger('AutoHideManager');
    this.timerManager = new TimerManager('AutoHideManager');

    this.setupPreferenceListeners();
    this.setupShelfListeners();
  }

  /**
   * Setup preference change listeners
   */
  private setupPreferenceListeners(): void {
    this.preferencesManager.on('shelf-settings-changed', (settings: { autoHideEmpty: boolean }) => {
      this.config.enabled = settings.autoHideEmpty;

      if (!this.config.enabled) {
        this.cancelAllAutoHides();
        this.logger.info('🚫 Auto-hide disabled - cancelled all pending hides');
      } else {
        this.reevaluateAllShelves();
        this.logger.info('✅ Auto-hide enabled - re-evaluating all shelves');
      }
    });
  }

  /**
   * Setup shelf event listeners
   */
  private setupShelfListeners(): void {
    // Listen for shelf creation
    this.shelfLifecycleManager.on('shelf-created', (shelfId: string) => {
      const config = this.shelfLifecycleManager.getShelfConfig(shelfId);
      if (config && config.items.length === 0) {
        this.scheduleAutoHide(shelfId);
      }
    });

    // Listen for item addition (cancels auto-hide)
    this.shelfLifecycleManager.on('shelf-item-added', (shelfId: string) => {
      this.cancelAutoHide(shelfId);
    });

    // Listen for item removal (schedules auto-hide if empty)
    this.shelfLifecycleManager.on('shelf-item-removed', (shelfId: string) => {
      const config = this.shelfLifecycleManager.getShelfConfig(shelfId);
      if (config && config.items.length === 0) {
        // Use shorter timeout for manual removal
        this.scheduleAutoHide(shelfId, 3000);
      }
    });

    // Listen for shelf destruction
    this.shelfLifecycleManager.on('shelf-destroyed', (shelfId: string) => {
      this.cancelAutoHide(shelfId);
    });
  }

  /**
   * Schedule auto-hide for a specific shelf
   */
  public scheduleAutoHide(shelfId: string, customTimeout?: number): void {
    if (!this.config.enabled) {
      this.logger.debug(`Auto-hide disabled, skipping shelf ${shelfId}`);
      return;
    }

    // Cancel any existing timer
    this.cancelAutoHide(shelfId);

    const timeout = customTimeout || this.config.emptyShelfTimeout;

    // Create timer ID
    const timerId = `autohide-${shelfId}`;

    // Schedule the auto-hide
    this.timerManager.setTimeout(
      timerId,
      () => this.executeAutoHide(shelfId),
      timeout,
      `Auto-hide shelf ${shelfId}`
    );

    this.pendingAutoHides.set(shelfId, timerId);
    this.logger.info(`⏰ Scheduled auto-hide for shelf ${shelfId} in ${timeout}ms`);
  }

  /**
   * Execute auto-hide for a shelf
   */
  private async executeAutoHide(shelfId: string): Promise<void> {
    // Check if we should block auto-hide
    if (this.shouldBlockAutoHide(shelfId)) {
      // Reschedule for later
      this.logger.info(`⏸️ Auto-hide blocked for shelf ${shelfId}, rescheduling`);
      this.scheduleAutoHide(shelfId);
      return;
    }

    // Get shelf configuration
    const config = this.shelfLifecycleManager.getShelfConfig(shelfId);

    // Verify shelf is still empty and not pinned
    if (!config) {
      this.logger.debug(`Shelf ${shelfId} no longer exists`);
      return;
    }

    if (config.items.length > 0) {
      this.logger.info(`📦 Shelf ${shelfId} has items, cancelling auto-hide`);
      this.cancelAutoHide(shelfId);
      return;
    }

    if (config.isPinned) {
      this.logger.info(`📌 Shelf ${shelfId} is pinned, cancelling auto-hide`);
      this.cancelAutoHide(shelfId);
      return;
    }

    // Execute the hide
    this.logger.info(`🕐 Auto-hiding empty shelf: ${shelfId}`);
    await this.shelfLifecycleManager.destroyShelf(shelfId);
    this.pendingAutoHides.delete(shelfId);

    // Emit event
    this.emit('shelf-auto-hidden', shelfId);
  }

  /**
   * Check if auto-hide should be blocked
   */
  private shouldBlockAutoHide(_shelfId: string): boolean {
    const context = this.stateMachine.getContext();

    // Block during drag if configured
    if (this.config.dragBlocksHide && context.isDragging) {
      this.logger.debug(`Blocking auto-hide: drag in progress`);
      return true;
    }

    // Block during drop if configured
    if (this.config.dropBlocksHide && context.dropInProgress) {
      this.logger.debug(`Blocking auto-hide: drop in progress`);
      return true;
    }

    return false;
  }

  /**
   * Cancel auto-hide for a specific shelf
   */
  public cancelAutoHide(shelfId: string): void {
    const timerId = this.pendingAutoHides.get(shelfId);
    if (timerId) {
      this.timerManager.clearTimeout(`autohide-${shelfId}`);
      this.pendingAutoHides.delete(shelfId);
      this.logger.info(`❌ Cancelled auto-hide for shelf ${shelfId}`);
    }
  }

  /**
   * Cancel all pending auto-hides
   */
  public cancelAllAutoHides(): void {
    for (const [shelfId] of this.pendingAutoHides) {
      this.cancelAutoHide(shelfId);
    }
    this.logger.info(`❌ Cancelled all pending auto-hides`);
  }

  /**
   * Re-evaluate all shelves for auto-hide
   */
  public reevaluateAllShelves(): void {
    if (!this.config.enabled) {
      return;
    }

    const activeShelves = this.shelfLifecycleManager.getActiveShelves();
    let evaluated = 0;

    for (const shelfId of activeShelves) {
      const config = this.shelfLifecycleManager.getShelfConfig(shelfId);

      // Schedule auto-hide for empty, non-pinned shelves
      if (config && config.items.length === 0 && !config.isPinned) {
        this.scheduleAutoHide(shelfId);
        evaluated++;
      }
    }

    this.logger.info(`🔄 Re-evaluated ${evaluated} shelves for auto-hide`);
  }

  /**
   * Update auto-hide configuration
   */
  public updateConfig(config: Partial<AutoHideConfig>): void {
    const wasEnabled = this.config.enabled;
    Object.assign(this.config, config);

    // Handle enable/disable transitions
    if (!wasEnabled && this.config.enabled) {
      this.reevaluateAllShelves();
    } else if (wasEnabled && !this.config.enabled) {
      this.cancelAllAutoHides();
    }

    this.logger.info('Updated auto-hide configuration:', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<AutoHideConfig> {
    return { ...this.config };
  }

  /**
   * Check if a shelf has pending auto-hide
   */
  public hasPendingAutoHide(shelfId: string): boolean {
    return this.pendingAutoHides.has(shelfId);
  }

  /**
   * Get all shelves with pending auto-hide
   */
  public getPendingAutoHides(): string[] {
    return Array.from(this.pendingAutoHides.keys());
  }

  /**
   * Clean up and destroy
   */
  public destroy(): void {
    this.cancelAllAutoHides();
    this.timerManager.destroy();
    this.removeAllListeners();
    this.logger.info('AutoHideManager destroyed');
  }
}
