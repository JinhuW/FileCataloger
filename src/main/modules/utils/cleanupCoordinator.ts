import { EventEmitter } from 'events';
import { Logger, createLogger } from './logger';
import { TimerManager } from './timerManager';
import { DragShelfStateMachine, DragShelfEvent, DragShelfState } from '../state/dragShelfStateMachine';

/**
 * Cleanup operations that can be scheduled
 */
export enum CleanupOperation {
  CLEAR_DROP_OPERATIONS = 'clear_drop_operations',
  CLEAR_EMPTY_SHELVES = 'clear_empty_shelves',
  CLEAR_NATIVE_FILES = 'clear_native_files',
  EVALUATE_AUTO_HIDE = 'evaluate_auto_hide',
}

/**
 * Cleanup configuration
 */
interface CleanupConfig {
  dropOperationsClearDelay: number;  // Delay before clearing drop operations (ms)
  emptyShelfClearDelay: number;      // Delay before clearing empty shelves (ms)
  nativeFilesClearDelay: number;     // Delay before clearing native files (ms)
}

/**
 * Coordinates cleanup operations based on state machine transitions
 * Replaces complex nested setTimeout logic with event-driven approach
 */
export class CleanupCoordinator extends EventEmitter {
  private readonly logger: Logger;
  private readonly timerManager: TimerManager;
  private readonly stateMachine: DragShelfStateMachine;

  private readonly config: CleanupConfig = {
    dropOperationsClearDelay: 500,
    emptyShelfClearDelay: 3000,
    nativeFilesClearDelay: 3000,
  };

  private pendingOperations = new Set<CleanupOperation>();

  constructor(stateMachine: DragShelfStateMachine) {
    super();
    this.logger = createLogger('CleanupCoordinator');
    this.timerManager = new TimerManager('CleanupCoordinator');
    this.stateMachine = stateMachine;

    this.setupStateListeners();
  }

  /**
   * Setup listeners for state machine transitions
   */
  private setupStateListeners(): void {
    this.stateMachine.on('stateChanged', ({ previousState, currentState, event }) => {
      this.logger.debug(`State changed: ${previousState} → ${currentState} (${event})`);

      // Handle transitions to CLEANUP_IN_PROGRESS state
      if (currentState === DragShelfState.CLEANUP_IN_PROGRESS) {
        this.scheduleCleanupSequence();
      }

      // Handle drag end events
      if (event === DragShelfEvent.END_DRAG) {
        this.handleDragEnd(currentState);
      }

      // Handle auto-hide scheduling
      if (currentState === DragShelfState.SHELF_AUTO_HIDE_SCHEDULED) {
        this.scheduleAutoHide();
      }

      // Handle cleanup completion
      if (event === DragShelfEvent.CLEANUP_COMPLETE) {
        this.handleCleanupComplete();
      }
    });
  }

  /**
   * Schedule the full cleanup sequence
   */
  private scheduleCleanupSequence(): void {
    this.logger.info('📋 Starting cleanup sequence');

    // Stage 1: Clear drop operations (500ms)
    this.scheduleOperation(
      CleanupOperation.CLEAR_DROP_OPERATIONS,
      this.config.dropOperationsClearDelay,
      () => {
        this.emit('clear-drop-operations');
        this.pendingOperations.delete(CleanupOperation.CLEAR_DROP_OPERATIONS);

        // Stage 2: Clear empty shelves and native files (3000ms after drop operations)
        this.scheduleOperation(
          CleanupOperation.CLEAR_EMPTY_SHELVES,
          this.config.emptyShelfClearDelay,
          () => {
            this.emit('clear-empty-shelves');
            this.pendingOperations.delete(CleanupOperation.CLEAR_EMPTY_SHELVES);

            // Also clear native files
            this.emit('clear-native-files');

            // Stage 3: Re-evaluate remaining shelves for auto-hide
            this.scheduleOperation(
              CleanupOperation.EVALUATE_AUTO_HIDE,
              0,
              () => {
                this.emit('evaluate-auto-hide');
                this.pendingOperations.delete(CleanupOperation.EVALUATE_AUTO_HIDE);

                // Signal cleanup complete to state machine
                this.stateMachine.send(DragShelfEvent.CLEANUP_COMPLETE);
              }
            );
          }
        );
      }
    );
  }

  /**
   * Handle drag end event based on current state
   */
  private handleDragEnd(currentState: DragShelfState): void {
    const context = this.stateMachine.getContext();

    if (currentState === DragShelfState.CLEANUP_IN_PROGRESS) {
      // Already in cleanup, let it continue
      this.logger.info('🧹 Drag ended - cleanup already in progress');
      return;
    }

    if (currentState === DragShelfState.SHELF_AUTO_HIDE_SCHEDULED) {
      // Schedule auto-hide for empty shelf
      this.logger.info('⏰ Drag ended - auto-hide scheduled for empty shelf');
      return;
    }

    if (currentState === DragShelfState.SHELF_ACTIVE && context.hasItems) {
      // Shelf has items, no cleanup needed
      this.logger.info('📦 Drag ended - shelf has items, no cleanup needed');
      return;
    }
  }

  /**
   * Schedule auto-hide operation
   */
  private scheduleAutoHide(): void {
    this.logger.info('⏰ Scheduling auto-hide for empty shelf');

    // Schedule the auto-hide trigger
    this.scheduleOperation(
      CleanupOperation.CLEAR_EMPTY_SHELVES,
      5000, // Default 5 second delay for auto-hide
      () => {
        // Check if we're still in auto-hide state
        if (this.stateMachine.getState() === DragShelfState.SHELF_AUTO_HIDE_SCHEDULED) {
          this.stateMachine.send(DragShelfEvent.AUTO_HIDE_TRIGGERED);
        }
      }
    );
  }

  /**
   * Handle cleanup completion
   */
  private handleCleanupComplete(): void {
    this.logger.info('✅ Cleanup sequence completed');
    this.cancelAllOperations();
  }

  /**
   * Schedule a cleanup operation with a delay
   */
  private scheduleOperation(
    operation: CleanupOperation,
    delay: number,
    callback: () => void
  ): void {
    // Cancel any existing timer for this operation
    this.timerManager.clearTimeout(`cleanup-${operation}`);

    // Track pending operation
    this.pendingOperations.add(operation);

    // Schedule new timer
    this.timerManager.setTimeout(
      `cleanup-${operation}`,
      () => {
        this.logger.debug(`Executing cleanup operation: ${operation}`);
        callback();
      },
      delay,
      `Cleanup operation: ${operation}`
    );
  }

  /**
   * Cancel a specific cleanup operation
   */
  public cancelOperation(operation: CleanupOperation): void {
    this.timerManager.clearTimeout(`cleanup-${operation}`);
    this.pendingOperations.delete(operation);
    this.logger.debug(`Cancelled cleanup operation: ${operation}`);
  }

  /**
   * Cancel all pending cleanup operations
   */
  public cancelAllOperations(): void {
    for (const operation of this.pendingOperations) {
      this.cancelOperation(operation);
    }
    this.logger.debug('Cancelled all cleanup operations');
  }

  /**
   * Check if a cleanup operation is pending
   */
  public isOperationPending(operation: CleanupOperation): boolean {
    return this.pendingOperations.has(operation);
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<CleanupConfig>): void {
    Object.assign(this.config, config);
    this.logger.info('Updated cleanup configuration:', this.config);
  }

  /**
   * Destroy the coordinator
   */
  public destroy(): void {
    this.cancelAllOperations();
    this.timerManager.destroy();
    this.removeAllListeners();
    this.logger.info('CleanupCoordinator destroyed');
  }
}