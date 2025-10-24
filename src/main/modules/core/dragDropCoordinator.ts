import { EventEmitter } from 'events';
import { Logger, createLogger } from '../utils/logger';
import { MouseTracker, DragItem } from '@shared/types';
import { DragShakeDetector, DragShakeEvent } from '../input/dragShakeDetector';
import { ShelfLifecycleManager } from './shelfLifecycleManager';
import { DragShelfStateMachine, DragShelfEvent as StateMachineEvent } from '../state/dragShelfStateMachine';
import { PreferencesManager } from '../config/preferencesManager';
import { AsyncMutex } from '../utils/asyncMutex';
import { TimerManager } from '../utils/timerManager';

/**
 * Coordinates drag and drop operations between mouse tracking, shake detection, and shelf management
 * Extracted from ApplicationController for better separation of concerns
 */
export class DragDropCoordinator extends EventEmitter {
  private readonly logger: Logger;
  private readonly timerManager: TimerManager;
  private readonly shelfCreationMutex: AsyncMutex;

  private nativeDraggedFiles: Array<{ path: string; name: string }> = [];
  private isDragActive = false;
  private wasLeftButtonDown = false;
  private positionLogCount = 0;

  // Drag session tracking to prevent duplicate shelves
  private currentDragSessionId: string | null = null;
  private shelfCreatedForCurrentDrag = false;
  private dragSessionShelfId: string | null = null;

  constructor(
    private readonly mouseTracker: MouseTracker,
    private readonly dragShakeDetector: DragShakeDetector,
    private readonly shelfLifecycleManager: ShelfLifecycleManager,
    private readonly stateMachine: DragShelfStateMachine,
    private readonly preferencesManager: PreferencesManager
  ) {
    super();
    this.logger = createLogger('DragDropCoordinator');
    this.timerManager = new TimerManager('DragDropCoordinator');
    this.shelfCreationMutex = new AsyncMutex();

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for drag and drop coordination
   */
  private setupEventHandlers(): void {
    // Mouse position updates
    this.mouseTracker.on('position', (position: any) => {
      this.handleMousePosition(position);
    });

    // Drag-shake detection
    this.dragShakeDetector.on('dragShake', (event: DragShakeEvent) => {
      this.handleDragShake(event);
    });

    // Drag lifecycle events
    this.dragShakeDetector.on('drag-start', (items: DragItem[]) => {
      this.handleDragStart(items);
    });

    this.dragShakeDetector.on('drag-end', () => {
      this.handleDragEnd();
    });

    this.dragShakeDetector.on('files-detected', (files: string[]) => {
      this.handleFilesDetected(files);
    });

    // Preference changes
    this.preferencesManager.on('shake-settings-changed', (settings: any) => {
      this.handleShakeSettingsChanged(settings);
    });
  }

  /**
   * Handle mouse position updates
   */
  private handleMousePosition(position: any): void {
    // Log first position for debugging
    if (this.positionLogCount === 0) {
      this.logger.debug('First position received:', {
        x: position.x,
        y: position.y,
        timestamp: position.timestamp,
        leftButtonDown: position.leftButtonDown
      });
    }

    // Log periodically to avoid spam
    if (++this.positionLogCount % 1000 === 0) {
      this.logger.debug('Mouse tracking active - position:', position);
    }

    // Detect mouse button release
    if (this.wasLeftButtonDown && !position.leftButtonDown) {
      this.handleMouseRelease();
    }

    this.wasLeftButtonDown = position.leftButtonDown || false;

    // Forward to drag-shake detector
    this.dragShakeDetector.processPosition(position);
  }

  /**
   * Handle mouse button release
   */
  private handleMouseRelease(): void {
    this.logger.info('🖱️ Left button released - checking drag state');

    const context = this.stateMachine.getContext();

    if (!context.isDragging) {
      // Quick cleanup for non-drag scenarios
      this.logger.info('🧹 No drag operation - quick cleanup');
      this.timerManager.setTimeout(
        'no-drag-cleanup',
        () => {
          this.shelfLifecycleManager.clearEmptyShelves();
        },
        200,
        'Quick cleanup for non-drag scenarios'
      );
    } else {
      // Extended cleanup for drag operations
      this.logger.info('⏰ Drag operation detected - extended cleanup delay');
      this.timerManager.setTimeout(
        'drag-cleanup',
        () => {
          this.logger.info('⏰ Checking for empty shelves after drag');
          this.shelfLifecycleManager.clearEmptyShelves();
        },
        3000,
        'Clean up empty shelves after drag'
      );
    }
  }

  /**
   * Handle drag-shake event for shelf creation
   */
  private async handleDragShake(event: DragShakeEvent): Promise<void> {
    await this.shelfCreationMutex.runExclusive(async () => {
      try {
        this.logger.info(`🎯 Drag-shake event: ${event.type}, dragging: ${event.isDragging}`);

        // Check if drag + shake is enabled
        const preferences = this.preferencesManager.getPreferences();
        if (!preferences.shakeDetection.dragShakeEnabled) {
          this.logger.info('⚠️ Drag + shake disabled - ignoring');
          return;
        }

        // Only create shelf if dragging files
        if (!event.isDragging || !event.items || event.items.length === 0) {
          this.logger.info('⚠️ Shake detected but no drag operation - ignoring');
          return;
        }

        // Check if shelf was already created for current drag session
        if (this.shelfCreatedForCurrentDrag && this.dragSessionShelfId) {
          this.logger.info(`🔄 Shelf already created for this drag session: ${this.dragSessionShelfId}`);

          // Check if the shelf still exists
          const shelfConfig = this.shelfLifecycleManager.getShelfConfig(this.dragSessionShelfId);
          if (shelfConfig) {
            this.logger.info(`♻️ Reusing existing drag session shelf: ${this.dragSessionShelfId}`);
            this.shelfLifecycleManager.showShelf(this.dragSessionShelfId);
            return;
          } else {
            // Shelf was destroyed, allow creating a new one
            this.logger.info('⚠️ Previous shelf destroyed, creating new one');
            this.shelfCreatedForCurrentDrag = false;
            this.dragSessionShelfId = null;
          }
        }

        // Check if we can create shelf
        if (!this.stateMachine.canCreateShelf()) {
          this.logger.info('⚠️ Cannot create shelf in current state');
          return;
        }

        // Send shake detected event
        this.stateMachine.send(StateMachineEvent.SHAKE_DETECTED);

        // Check for existing active shelf from previous drag session
        const context = this.stateMachine.getContext();
        if (context.activeShelfId && !this.shelfCreatedForCurrentDrag) {
          const shelfConfig = this.shelfLifecycleManager.getShelfConfig(context.activeShelfId);
          if (shelfConfig && shelfConfig.isVisible) {
            this.logger.info(`♻️ Reusing existing shelf from previous session: ${context.activeShelfId}`);
            this.dragSessionShelfId = context.activeShelfId;
            this.shelfCreatedForCurrentDrag = true;
            this.shelfLifecycleManager.showShelf(context.activeShelfId);
            return;
          }
        }

        // Create new shelf
        await this.createShelfForDrag(event);

      } catch (error) {
        this.logger.error('Error handling drag-shake event:', error);
        this.emit('drag-shake-error', error);
      }
    });
  }

  /**
   * Create a new shelf for drag operation
   */
  private async createShelfForDrag(event: DragShakeEvent): Promise<void> {
    this.logger.info('📦 Creating new shelf at cursor position');

    const currentPos = this.mouseTracker.getCurrentPosition();
    const preferences = this.preferencesManager.getPreferences();

    // Don't add items to shelf on creation - shelf should start empty
    // Items should only be added when the user drops them onto the shelf

    const shelfId = await this.shelfLifecycleManager.createShelf({
      position: {
        x: currentPos.x - 150,
        y: currentPos.y - 200
      },
      isPinned: false, // Don't pin until items are dropped
      isVisible: true,
      opacity: preferences.shelf.opacity,
      items: [] // Shelf starts empty - no items until drop
    });

    if (shelfId) {
      this.logger.info(`✅ Shelf created for drag: ${shelfId} (empty - awaiting drop)`);

      // Mark this shelf as created for current drag session
      this.shelfCreatedForCurrentDrag = true;
      this.dragSessionShelfId = shelfId;

      // Log dragged items that user is currently dragging (but not dropped yet)
      if (event.items && event.items.length > 0) {
        this.logger.info('📁 User is dragging:', event.items.map((item: DragItem) => item.name));
        this.logger.info('⏳ Shelf is ready - drop files onto it to add them');
      }

      // Don't mark drop as complete since shelf is empty
      // Drop completion will happen when files are actually dropped

      this.emit('shelf-created-for-drag', shelfId, event.items);
    }
  }

  /**
   * Handle drag start event
   */
  private handleDragStart(items: DragItem[]): void {
    this.logger.info('🎯 Drag operation started');
    this.isDragActive = true;

    // Generate new drag session ID
    this.currentDragSessionId = `drag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.shelfCreatedForCurrentDrag = false;
    this.dragSessionShelfId = null;

    this.logger.info(`📋 New drag session: ${this.currentDragSessionId}`);

    // Store dragged files
    this.nativeDraggedFiles = items.map(item => ({
      path: item.path,
      name: item.name
    }));

    this.logger.info(`📁 Stored ${this.nativeDraggedFiles.length} dragged files`);

    // Update state machine
    this.stateMachine.send(StateMachineEvent.START_DRAG);

    this.emit('drag-started', items);
  }

  /**
   * Handle drag end event
   */
  private handleDragEnd(): void {
    this.logger.info(`🛑 Drag operation ended (session: ${this.currentDragSessionId})`);

    // Always clear drag state immediately to unblock desktop operations
    this.isDragActive = false;

    // Update state machine first to ensure proper state transition
    this.stateMachine.send(StateMachineEvent.END_DRAG);

    // Check if shelf was created for this drag but is still empty
    if (this.shelfCreatedForCurrentDrag && this.dragSessionShelfId) {
      const shelfConfig = this.shelfLifecycleManager.getShelfConfig(this.dragSessionShelfId);
      if (shelfConfig && shelfConfig.items.length === 0) {
        this.logger.info(`📦 Shelf ${this.dragSessionShelfId} created but empty - will be auto-hidden`);
        // Mark shelf for auto-hide since drag ended without drop
        this.shelfLifecycleManager.scheduleEmptyShelfAutoHide(this.dragSessionShelfId, 2000);
      }
    }

    // Clear drag session tracking after handling shelf
    this.currentDragSessionId = null;
    this.shelfCreatedForCurrentDrag = false;
    this.dragSessionShelfId = null;

    // Clear native dragged files immediately
    this.nativeDraggedFiles = [];

    // Schedule cleanup operations
    this.schedulePostDragCleanup();

    this.emit('drag-ended');
  }

  /**
   * Schedule cleanup after drag ends
   */
  private schedulePostDragCleanup(): void {
    // Notify shelf lifecycle manager that drag has ended
    this.shelfLifecycleManager.handleDragEnd();

    // Stage 1: Clear drop operations (500ms)
    this.timerManager.setTimeout(
      'clear-drop-operations',
      () => {
        this.shelfLifecycleManager.clearAllDropOperations();

        // Stage 2: Clear empty shelves (3000ms)
        this.timerManager.setTimeout(
          'clear-empty-shelves',
          () => {
            this.logger.info('🧹 Checking for empty shelves');
            this.shelfLifecycleManager.clearEmptyShelves();

            // Clear native dragged files
            this.nativeDraggedFiles = [];
            this.logger.info('🗑️ Cleared native dragged files');

            // Re-evaluate remaining shelves
            this.shelfLifecycleManager.reevaluateEmptyShelvesForAutoHide();
          },
          3000,
          'Clear empty shelves after drop'
        );
      },
      500,
      'Clear drop operations'
    );
  }

  /**
   * Handle files detected during drag
   */
  private handleFilesDetected(files: string[]): void {
    this.logger.debug('📁 Files detected in drag:', files);
    this.emit('files-detected', files);
  }

  /**
   * Handle shake settings change
   */
  private async handleShakeSettingsChanged(settings: any): Promise<void> {
    this.logger.info('🎯 Shake settings changed:', {
      enabled: settings.enabled,
      dragShakeEnabled: settings.dragShakeEnabled
    });

    if (!settings.dragShakeEnabled) {
      // Stop tracking to save CPU
      this.logger.info('🚫 Drag + shake disabled - stopping tracking');
      this.dragShakeDetector?.stop();
      this.mouseTracker?.stop();
    } else {
      // Restart tracking if needed
      this.logger.info('✅ Drag + shake enabled - restarting tracking');

      if (!this.mouseTracker.isTracking()) {
        await new Promise(resolve => setTimeout(resolve, 100));
        this.mouseTracker.start();
      }

      if (this.dragShakeDetector) {
        await new Promise(resolve => setTimeout(resolve, 100));
        this.dragShakeDetector.start();
      }
    }
  }

  /**
   * Handle drop operation on a shelf
   */
  public handleDropOnShelf(shelfId: string, files: string[]): void {
    this.logger.info(`📥 Drop on shelf ${shelfId}: ${files.length} files`);

    // Mark shelf as receiving drop
    this.shelfLifecycleManager.markShelfReceivingDrop(shelfId);

    // Process drop will be handled by shelf manager
    // Just emit event for tracking
    this.emit('drop-on-shelf', shelfId, files);
  }

  /**
   * Complete drop operation
   */
  public completeDropOperation(shelfId: string): void {
    this.shelfLifecycleManager.markDropComplete(shelfId);
    this.emit('drop-complete', shelfId);
  }

  /**
   * Get native dragged files
   */
  public getNativeDraggedFiles(): Array<{ path: string; name: string }> {
    return [...this.nativeDraggedFiles];
  }

  /**
   * Check if drag is active
   */
  public isDragging(): boolean {
    return this.isDragActive;
  }

  /**
   * Start drag and drop tracking
   */
  public start(): void {
    if (!this.mouseTracker.isTracking()) {
      this.mouseTracker.start();
    }
    this.dragShakeDetector.start();
    this.logger.info('✅ DragDropCoordinator started');
  }

  /**
   * Stop drag and drop tracking
   */
  public stop(): void {
    this.mouseTracker.stop();
    this.dragShakeDetector.stop();
    this.timerManager.clearAll();
    this.logger.info('⏹️ DragDropCoordinator stopped');
  }

  /**
   * Clean up and destroy
   */
  public destroy(): void {
    this.stop();
    this.timerManager.destroy();
    this.removeAllListeners();
    this.logger.info('DragDropCoordinator destroyed');
  }
}