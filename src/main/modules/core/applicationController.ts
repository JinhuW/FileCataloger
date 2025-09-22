import { EventEmitter } from 'events';
import { createMouseTracker } from '@native/mouse-tracker';
import { DragShakeDetector } from '../input';
import { ShelfManager } from '../window/shelfManager';
import { errorHandler, ErrorSeverity, ErrorCategory } from '../utils/errorHandler';
import { PreferencesManager } from '../config/preferencesManager';
import { MouseTracker, DragShakeEvent, DragItem, ShelfConfig, ShelfItem } from '@shared/types';
import { Logger, createLogger } from '../utils/logger';
import { SHELF_CONSTANTS, APP_CONSTANTS, PERFORMANCE_CONSTANTS } from '@shared/constants';

/**
 * Main application controller that coordinates all modules
 *
 * This is the central orchestrator that manages:
 * - Mouse tracking
 * - Shake detection
 * - Drag detection
 * - Shelf management
 * - Event coordination
 */
export class ApplicationController extends EventEmitter {
  private mouseTracker: MouseTracker;
  private dragShakeDetector: DragShakeDetector;
  private shelfManager: ShelfManager;
  private logger: Logger;

  private isRunning: boolean = false;
  private activeShelves = new Set<string>();
  private activeDropOperations = new Set<string>(); // Track shelves receiving drops
  private shelfAutoHideTimers = new Map<string, NodeJS.Timeout>(); // Track auto-hide timers
  private isDragging: boolean = false; // Track current drag state
  private activeEmptyShelfId: string | null = null; // Track the single active empty shelf
  private hasCreatedShelfInSession: boolean = false; // Track if shelf was created in this drag session
  private shelfCreationInProgress: boolean = false; // Prevent race conditions in shelf creation
  private preferencesManager: PreferencesManager;

  // Configuration
  private config = {
    autoHideDelay: SHELF_CONSTANTS.AUTO_HIDE_DELAY,
    maxSimultaneousShelves: APP_CONSTANTS.MAX_SIMULTANEOUS_SHELVES,
    enableShakeGesture: true, // Enable shake detection for manual shelf creation
    enableDragDetection: true, // Enable to check for files when shake happens
    useNativeDragMonitor: true, // Use native macOS drag monitoring if available
    emptyShelfTimeout: SHELF_CONSTANTS.EMPTY_TIMEOUT,
  };

  // Track cleanup for memory leak prevention
  private cleanupTimers = new Set<NodeJS.Timeout>();

  constructor() {
    super();

    // Initialize logger with context
    this.logger = createLogger('ApplicationController');
    this.logger.info('🚀 ApplicationController constructor started');

    // Initialize preferences manager
    this.preferencesManager = PreferencesManager.getInstance();
    this.logger.info('✓ PreferencesManager initialized');

    // Initialize modules
    try {
      this.mouseTracker = createMouseTracker();
      this.logger.info('✓ Mouse tracker initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize mouse tracker:', error);
      // Re-throw the error since mouse tracking is required
      throw new Error(`Failed to initialize native mouse tracker: ${error}`);
    }

    // Initialize combined drag and shake detector
    this.dragShakeDetector = new DragShakeDetector();
    this.logger.info('✓ Drag-shake detector initialized');

    this.shelfManager = new ShelfManager();
    this.logger.info('✓ ShelfManager initialized');

    this.setupEventHandlers();
    this.setupErrorHandling();

    // Test shelf creation removed - shelves are created on demand via shake/drag
  }

  /**
   * Start the application
   */
  public async start(): Promise<void> {
    this.logger.info('📍 ApplicationController.start() method called');

    if (this.isRunning) {
      this.logger.warn('ApplicationController is already running');
      return;
    }

    try {
      this.logger.info('🚀 Starting FileCataloger application...');

      // Start mouse tracking
      this.logger.info('🖱️ Starting mouse tracker...');
      this.mouseTracker.start();
      this.logger.info('✓ Mouse tracker started');

      // Log initial position to verify tracking
      setTimeout(() => {
        this.logger.debug('Mouse tracker active - move your mouse to see position updates');
      }, 500);

      // Start combined drag-shake detector
      this.logger.info('🔄 Starting drag-shake detector...');
      this.dragShakeDetector.start();
      this.logger.info('✓ Drag-shake detector started');

      // Shelves are created on demand via shake/drag gestures

      this.isRunning = true;
      this.emit('started');

      this.logger.info('🎉 FileCataloger application started successfully!');
      this.logger.info('📊 Application status - isRunning:', this.isRunning);
    } catch (error) {
      this.logger.error('❌ Failed to start application:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the application
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop all modules
      this.mouseTracker.stop();
      this.dragShakeDetector.stop();

      // Close all shelves
      for (const shelfId of this.activeShelves) {
        this.shelfManager.destroyShelf(shelfId);
      }

      this.isRunning = false;
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error stopping application:', error);
      this.emit('error', error);
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // Listen for critical errors
    errorHandler.on('error', error => {
      if (error.severity === ErrorSeverity.CRITICAL) {
        this.logger.error('Critical error detected, may need to restart:', error);
      }
    });

    // Listen for native errors to fallback
    errorHandler.on('native-error', error => {
      this.logger.warn('Native module error, using fallback:', error);
    });

    // Listen for performance issues
    errorHandler.on('performance-issue', error => {
      this.logger.warn('Performance issue detected:', error);
    });

    // Handle mouse tracker errors
    this.mouseTracker.on('error', (error: Error) => {
      errorHandler.handleError(error, {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.NATIVE,
        context: { module: 'mouse-tracker' },
      });
    });
  }

  /**
   * Set up event handlers between modules
   */
  private setupEventHandlers(): void {
    // Mouse position updates -> Drag-shake detector
    let positionLogCount = 0;
    let wasLeftButtonDown = false;

    this.mouseTracker.on('position', position => {
      // Debug logging to trace position structure
      if (positionLogCount === 0) {
        this.logger.debug('ApplicationController first position received:', {
          x: position.x,
          y: position.y,
          timestamp: position.timestamp,
          leftButtonDown: position.leftButtonDown,
          typeOfX: typeof position.x,
          typeOfY: typeof position.y,
        });
      }

      // Log every Nth position to avoid spam
      if (++positionLogCount % PERFORMANCE_CONSTANTS.POSITION_LOG_INTERVAL === 0) {
        this.logger.debug('Mouse tracking active - position:', position);
      }

      // Enhanced mouse release detection with drag-state awareness
      if (wasLeftButtonDown && !position.leftButtonDown) {
        this.logger.info('🖱️ Left button released - checking drag state and empty shelves');

        // Immediate cleanup if no drag was in progress
        if (!this.isDragging) {
          this.logger.info('🧹 Immediate cleanup - no drag operation detected');
          setTimeout(() => {
            this.clearEmptyShelves();
          }, 200); // Quick cleanup for non-drag scenarios
        } else {
          // Standard delay for drag operations to allow drop completion
          this.logger.info('⏰ Drag operation detected - using standard delay for cleanup');
          setTimeout(() => {
            this.logger.info('⏰ Checking for empty shelves after drag completion delay');
            this.clearEmptyShelves();
          }, 1000); // 1 second delay for drag operations
        }
      }

      wasLeftButtonDown = position.leftButtonDown || false;
      this.dragShakeDetector.processPosition(position);
    });

    // Mouse tracker errors
    this.mouseTracker.on('error', error => {
      this.logger.error('Mouse tracker error:', error);
      this.emit('mouse-tracking-error', error);
    });

    // Drag-shake detection -> Create shelf
    this.dragShakeDetector.on('dragShake', event => {
      this.handleDragShakeEvent(event);
    });

    // Enhanced drag detector events
    this.dragShakeDetector.on('drag-start', () => {
      this.logger.info('🎯 Drag operation started (optimistic)');
      this.isDragging = true;
      this.emit('drag-started');
    });

    this.dragShakeDetector.on('drag-end', () => {
      this.logger.info('🛑 Drag operation ended');
      this.isDragging = false;

      // Remove all shelves from active drop operations after a delay
      setTimeout(() => {
        if (this.activeDropOperations.size > 0) {
          this.logger.info(
            `🧹 Clearing ${this.activeDropOperations.size} shelves from drop operations`
          );
          this.activeDropOperations.clear();
        }

        // IMPORTANT: Clean up empty shelves immediately when drag ends (acts as mouse release)
        this.logger.info(
          '🧹 Immediate cleanup of empty shelves on drag end (equivalent to mouse release)'
        );
        this.clearEmptyShelves();

        // Also re-evaluate any remaining shelves for auto-hide scheduling
        this.logger.info('🔄 Re-evaluating remaining shelves for auto-hide after drag completion');
        this.reevaluateEmptyShelvesForAutoHide();
      }, 200); // 200ms delay to ensure drops are processed, then immediate cleanup

      this.emit('drag-ended');
    });

    this.dragShakeDetector.on('files-detected', files => {
      this.logger.debug('📁 Files detected in drag:', files);
      this.emit('files-in-drag', files);
    });

    // Shelf management events
    this.shelfManager.on('shelf-created', shelfId => {
      this.activeShelves.add(shelfId);
      this.emit('shelf-created', shelfId);
    });

    this.shelfManager.on('shelf-destroyed', shelfId => {
      this.activeShelves.delete(shelfId);
      this.emit('shelf-destroyed', shelfId);
    });

    this.shelfManager.on('shelf-item-added', (shelfId, item) => {
      // Cancel auto-hide timer when items are added
      this.cancelShelfAutoHide(shelfId);
      this.logger.info(`📦 Item added to shelf ${shelfId}, auto-hide cancelled`);

      // Remove from empty shelf tracking
      if (this.activeEmptyShelfId === shelfId) {
        this.logger.info(`🎆 Shelf ${shelfId} is no longer empty - removing from empty tracking`);
        this.activeEmptyShelfId = null;
      }

      // Remove from active drop operations if it was there
      if (this.activeDropOperations.has(shelfId)) {
        this.logger.info(`🎯 Removing ${shelfId} from active drop operations`);
        this.activeDropOperations.delete(shelfId);
      }

      this.emit('shelf-item-added', shelfId, item);
    });

    this.shelfManager.on('shelf-item-removed', (shelfId, itemId) => {
      // Check if shelf is now empty and schedule auto-hide if so
      const config = this.shelfManager.getShelfConfig(shelfId);
      if (config && config.items.length === 0 && !config.isPinned) {
        this.logger.info(
          `🗑️ Shelf ${shelfId} is now empty after manual removal, scheduling auto-hide`
        );

        // Cancel any existing auto-hide timer first
        this.cancelShelfAutoHide(shelfId);

        // Schedule auto-hide with shorter delay for manual removal (3 seconds instead of 5)
        this.scheduleEmptyShelfAutoHide(shelfId, 3000);
      }
      this.emit('shelf-item-removed', shelfId, itemId);
    });
  }

  /**
   * Handle drag-shake events
   */
  private async handleDragShakeEvent(event: DragShakeEvent): Promise<void> {
    try {
      this.logger.info(
        `🎯 Drag-shake event: ${event.type}, dragging: ${event.isDragging}, items: ${event.items?.length || 0}`
      );

      // Only create shelf if user is dragging files
      // The drag-shake detector now properly checks for actual drag operations
      if (!event.isDragging || !event.items || event.items.length === 0) {
        this.logger.info('⚠️ Shake detected but no drag operation - ignoring');
        return;
      }

      // CRITICAL: Ensure drag state is set when processing drag-shake event
      // This prevents the first shelf from auto-hiding before drag state is established
      if (!this.isDragging) {
        this.logger.info('🔄 Setting drag state from drag-shake event (timing fix)');
        this.isDragging = true;
      }

      // Prevent race condition: if shelf creation is already in progress, ignore
      if (this.shelfCreationInProgress) {
        this.logger.info(
          '⏳ RACE CONDITION PREVENTED: Shelf creation already in progress - ignoring duplicate event'
        );
        return;
      }

      // Check if we already have ANY active shelf to prevent duplicates
      if (this.activeShelves.size > 0 || this.activeEmptyShelfId) {
        const existingShelfId = this.activeEmptyShelfId || Array.from(this.activeShelves)[0];
        const shelfConfig = this.shelfManager.getShelfConfig(existingShelfId);
        if (shelfConfig && shelfConfig.isVisible) {
          this.logger.info(`♻️ Reusing existing shelf: ${existingShelfId} (preventing duplicate)`);
          this.shelfManager.showShelf(existingShelfId);
          return;
        }
      }

      // Set flag to prevent concurrent shelf creation
      this.shelfCreationInProgress = true;
      this.logger.info('🚩 FLAG SET: Shelf creation in progress');

      // Create a new shelf only if we don't have any active ones
      this.logger.info('📦 Creating new shelf at cursor position');
      const currentPos = this.mouseTracker.getCurrentPosition();

      const preferences = this.preferencesManager.getPreferences();
      const shelfId = await this.shelfManager.createShelf({
        position: { x: currentPos.x - 150, y: currentPos.y - 200 },
        isPinned: false,
        isVisible: true,
        opacity: preferences.shelf.opacity,
        mode: 'rename', // Always create rename mode shelves
        items: [], // Start with empty shelf - let user drop files
      });

      if (shelfId) {
        // Clear any existing shelves from tracking to ensure only one
        this.activeShelves.clear();
        this.activeEmptyShelfId = shelfId;
        // Note: shelf will be added to activeShelves by the 'shelf-created' event handler
        this.logger.info(`✅ Single shelf created: ${shelfId}`);

        // Schedule auto-hide for empty shelf with delay to ensure drag state is established
        // This prevents the first shelf from disappearing during initial drag operations
        setTimeout(() => {
          // Double-check: only schedule auto-hide if we're not currently dragging
          // and the shelf is still empty and exists
          const currentConfig = this.shelfManager.getShelfConfig(shelfId);
          if (!this.isDragging && currentConfig && currentConfig.items.length === 0) {
            this.logger.info(`⏰ Scheduling delayed auto-hide for empty shelf: ${shelfId}`);
            this.scheduleEmptyShelfAutoHide(shelfId);
          } else if (this.isDragging) {
            this.logger.info(
              `🔒 Skipping auto-hide scheduling - drag still in progress for shelf: ${shelfId}`
            );
          } else if (currentConfig && currentConfig.items.length > 0) {
            this.logger.info(`📦 Skipping auto-hide scheduling - shelf has items: ${shelfId}`);
          }
        }, 500); // 500ms delay to allow drag state to stabilize

        // Log dragged items if any
        if (event.items && event.items.length > 0) {
          this.logger.info(
            '📁 Dragged items detected:',
            event.items.map((item: DragItem) => item.name)
          );
        }
      }
    } catch (error) {
      this.logger.error('Error handling drag-shake event:', error);
    } finally {
      // Always clear the flag when done
      this.shelfCreationInProgress = false;
      this.logger.info('🏁 FLAG CLEARED: Shelf creation complete');
    }
  }

  /**
   * Schedule auto-hide for empty shelf
   */
  private scheduleEmptyShelfAutoHide(shelfId: string, customTimeout?: number): void {
    // Cancel any existing timer for this shelf
    this.cancelShelfAutoHide(shelfId);

    // Use custom timeout or default
    const timeout = customTimeout || this.config.emptyShelfTimeout;

    // Schedule new timer
    const timer = setTimeout(() => {
      // Remove from cleanup tracking when timer fires
      this.cleanupTimers.delete(timer);

      // CRITICAL: Don't auto-hide shelves during active drag operations
      if (this.isDragging) {
        this.logger.info(`🖱️ Shelf ${shelfId} auto-hide blocked - drag operation in progress`);
        this.scheduleEmptyShelfAutoHide(shelfId); // Reschedule after drag ends
        return;
      }

      // Don't auto-hide shelves that are receiving drops
      if (this.activeDropOperations.has(shelfId)) {
        this.logger.info(`⏸️ Shelf ${shelfId} is receiving drops - rescheduling auto-hide`);
        this.scheduleEmptyShelfAutoHide(shelfId); // Reschedule
        return;
      }

      const shelfConfig = this.shelfManager.getShelfConfig(shelfId);
      // Skip auto-hide for rename mode shelves
      if (shelfConfig && shelfConfig.mode === 'rename') {
        this.logger.info(`🔒 Shelf ${shelfId} is in rename mode - skipping auto-hide`);
        return;
      }

      if (shelfConfig && shelfConfig.items.length === 0) {
        this.logger.info(`⏰ Auto-hiding empty shelf after ${timeout}ms: ${shelfId}`);
        this.shelfManager.hideShelf(shelfId);

        // Destroy the shelf after a short delay if still empty
        setTimeout(() => {
          // CRITICAL: Final check - don't destroy during active drag operations
          if (this.isDragging) {
            this.logger.info(
              `🖱️ Shelf ${shelfId} destruction blocked - drag operation in progress`
            );
            // Reschedule the entire auto-hide process
            this.scheduleEmptyShelfAutoHide(shelfId);
            return;
          }

          // Final check - don't destroy if it has items or is receiving drops
          if (this.activeDropOperations.has(shelfId)) {
            this.logger.info(`⏸️ Shelf ${shelfId} is now receiving drops - cancelling destroy`);
            return;
          }

          const updatedConfig = this.shelfManager.getShelfConfig(shelfId);
          if (updatedConfig && updatedConfig.items.length === 0) {
            this.shelfManager.destroyShelf(shelfId);
            this.logger.info(`🗑️ Destroyed empty shelf: ${shelfId}`);
            // Clear active empty shelf reference if it's this one
            if (this.activeEmptyShelfId === shelfId) {
              this.activeEmptyShelfId = null;
            }
          } else if (updatedConfig && updatedConfig.items.length > 0) {
            this.logger.info(
              `📦 Shelf ${shelfId} now has ${updatedConfig.items.length} items - keeping it visible`
            );
            this.shelfManager.showShelf(shelfId); // Make sure it's visible
          }
        }, 1000);
      } else {
        this.logger.debug(
          `📌 Shelf ${shelfId} has ${shelfConfig?.items.length} items - not auto-hiding`
        );
      }

      // Clean up timer reference
      this.shelfAutoHideTimers.delete(shelfId);
    }, timeout);

    // Store timer reference for both tracking systems
    this.shelfAutoHideTimers.set(shelfId, timer);
    this.cleanupTimers.add(timer);
    this.logger.info(`⏰ Scheduled auto-hide for shelf ${shelfId} in ${timeout}ms`);
  }

  /**
   * Cancel auto-hide for a shelf
   */
  private cancelShelfAutoHide(shelfId: string): void {
    const timer = this.shelfAutoHideTimers.get(shelfId);
    if (timer) {
      clearTimeout(timer);
      this.shelfAutoHideTimers.delete(shelfId);
      this.cleanupTimers.delete(timer);
      this.logger.debug(`🚫 Cancelled auto-hide for shelf: ${shelfId}`);
    }
  }

  /**
   * Re-evaluate empty shelves for auto-hide after drag operations complete
   */
  private reevaluateEmptyShelvesForAutoHide(): void {
    // Check all active shelves and schedule auto-hide for empty ones
    for (const shelfId of this.activeShelves) {
      const shelfConfig = this.shelfManager.getShelfConfig(shelfId);

      // Only schedule auto-hide for empty shelves that aren't currently scheduled
      if (
        shelfConfig &&
        shelfConfig.items.length === 0 &&
        !shelfConfig.isPinned &&
        !this.shelfAutoHideTimers.has(shelfId) &&
        !this.activeDropOperations.has(shelfId)
      ) {
        this.logger.info(
          `🔄 Scheduling auto-hide for empty shelf after drag completion: ${shelfId}`
        );
        this.scheduleEmptyShelfAutoHide(shelfId);
      }
    }

    // Handle the single active empty shelf if it exists
    if (this.activeEmptyShelfId) {
      const shelfConfig = this.shelfManager.getShelfConfig(this.activeEmptyShelfId);
      if (
        shelfConfig &&
        shelfConfig.items.length === 0 &&
        !this.shelfAutoHideTimers.has(this.activeEmptyShelfId) &&
        !this.activeDropOperations.has(this.activeEmptyShelfId)
      ) {
        this.logger.info(
          `🔄 Scheduling auto-hide for active empty shelf after drag completion: ${this.activeEmptyShelfId}`
        );
        this.scheduleEmptyShelfAutoHide(this.activeEmptyShelfId);
      }
    }
  }

  /**
   * Clear all empty shelves when left button is released
   */
  private clearEmptyShelves(): void {
    this.logger.info(
      `🔍 clearEmptyShelves called - isDragging: ${this.isDragging}, activeDropOps: ${this.activeDropOperations.size}, activeShelves: ${this.activeShelves.size}, activeEmptyShelf: ${this.activeEmptyShelfId}`
    );

    // Don't clear shelves that are actively receiving drops
    if (this.activeDropOperations.size > 0) {
      this.logger.info('⏸️ Skipping shelf cleanup - drop operations in progress');
      return;
    }

    // Don't clear shelves during active drag operation
    if (this.isDragging) {
      this.logger.info('📎 Skipping shelf cleanup - drag still in progress');
      return;
    }

    if (this.activeEmptyShelfId) {
      // Double check the shelf is still empty and not receiving drops
      const shelfConfig = this.shelfManager.getShelfConfig(this.activeEmptyShelfId);
      if (
        shelfConfig &&
        (!shelfConfig.items || shelfConfig.items.length === 0) &&
        !this.activeDropOperations.has(this.activeEmptyShelfId)
      ) {
        this.logger.info(`🗑️ Clearing empty shelf on button release: ${this.activeEmptyShelfId}`);
        this.shelfManager.destroyShelf(this.activeEmptyShelfId);
        this.activeShelves.delete(this.activeEmptyShelfId);
        this.cancelShelfAutoHide(this.activeEmptyShelfId);
        this.activeEmptyShelfId = null;
      } else if (shelfConfig && shelfConfig.items.length > 0) {
        this.logger.info(
          `📦 Shelf ${this.activeEmptyShelfId} has ${shelfConfig.items.length} items - keeping it`
        );
        this.activeEmptyShelfId = null; // Clear reference since it's no longer empty
      }
    }

    // Also clear any other empty shelves
    for (const shelfId of this.activeShelves) {
      if (this.activeDropOperations.has(shelfId)) {
        continue; // Skip shelves receiving drops
      }

      const shelfConfig = this.shelfManager.getShelfConfig(shelfId);
      if (shelfConfig && (!shelfConfig.items || shelfConfig.items.length === 0)) {
        this.logger.info(`🗑️ Clearing additional empty shelf: ${shelfId}`);
        this.shelfManager.destroyShelf(shelfId);
        this.activeShelves.delete(shelfId);
        this.cancelShelfAutoHide(shelfId);
      }
    }
  }

  /**
   * Create a shelf manually
   */
  public async createShelf(config?: Partial<ShelfConfig>): Promise<string> {
    const preferences = this.preferencesManager.getPreferences();
    const finalConfig = {
      opacity: preferences.shelf.opacity,
      ...config,
    };
    return await this.shelfManager.createShelf(finalConfig);
  }

  /**
   * Add item to shelf
   */
  public async addItemToShelf(shelfId: string, item: ShelfItem): Promise<boolean> {
    this.logger.info(
      `📦 ApplicationController: Adding item to shelf - shelf: ${shelfId}, item: ${item.name}`
    );
    const result = this.shelfManager.addItemToShelf(shelfId, item);
    this.logger.info(`📦 ApplicationController: Add item result: ${result}`);
    return result;
  }

  /**
   * Show shelf
   */
  public async showShelf(shelfId: string): Promise<boolean> {
    this.logger.info(`👁️ ApplicationController: Showing shelf - ${shelfId}`);
    const result = this.shelfManager.showShelf(shelfId);
    this.logger.info(`👁️ ApplicationController: Show shelf result: ${result}`);
    return result;
  }

  /**
   * Hide shelf
   */
  public async hideShelf(shelfId: string): Promise<boolean> {
    this.logger.info(`🙈 ApplicationController: Hiding shelf - ${shelfId}`);
    const result = this.shelfManager.hideShelf(shelfId);
    this.logger.info(`🙈 ApplicationController: Hide shelf result: ${result}`);
    return result;
  }

  /**
   * Destroy a shelf
   */
  public async destroyShelf(shelfId: string): Promise<boolean> {
    return this.shelfManager.forceDestroyShelf(shelfId);
  }

  /**
   * Create a test shelf for debugging
   */
  private async createTestShelf(): Promise<void> {
    try {
      this.logger.info('🧪 Creating test shelf at center of screen');
      const preferences = this.preferencesManager.getPreferences();
      const testShelfId = await this.shelfManager.createShelf({
        position: { x: 100, y: 100 },
        opacity: preferences.shelf.opacity,
      });
      this.logger.info('🧪 Test shelf created with ID:', testShelfId);
      this.activeShelves.add(testShelfId);
    } catch (error) {
      this.logger.error('🧪 Failed to create test shelf:', error);
    }
  }

  /**
   * Get application status
   */
  public getStatus() {
    return {
      isRunning: this.isRunning,
      activeShelves: this.getVisibleShelfCount(), // Only count visible shelves
      totalShelves: this.activeShelves.size, // Total including hidden
      modules: {
        mouseTracker: this.mouseTracker.isTracking(),
        shakeDetector: this.dragShakeDetector ? true : false,
        dragDetector: this.dragShakeDetector ? true : false,
      },
      analytics: {
        mouseTracker: this.mouseTracker.getPerformanceMetrics?.() || null,
        shakeDetector: null, // Analytics removed in v2
        dragDetector: null, // Native module analytics
      },
    };
  }

  /**
   * Handle drop start event from shelf
   */
  public handleDropStart(shelfId: string): void {
    this.logger.info(`🎯 DROP START on shelf: ${shelfId}`);
    this.activeDropOperations.add(shelfId);

    // Cancel any auto-hide timer while dropping
    this.cancelShelfAutoHide(shelfId);

    // Make sure shelf stays visible during drop
    const config = this.shelfManager.getShelfConfig(shelfId);
    if (config && !config.isVisible) {
      this.logger.info(`👁️ Making shelf visible during drop: ${shelfId}`);
      this.shelfManager.showShelf(shelfId);
    }
  }

  /**
   * Handle drop end event from shelf
   */
  public handleDropEnd(shelfId: string): void {
    this.logger.info(`🎣 DROP END on shelf: ${shelfId}`);
    this.activeDropOperations.delete(shelfId);

    // Check if shelf is still empty after drop
    const config = this.shelfManager.getShelfConfig(shelfId);
    if (config && config.items.length === 0 && !config.isPinned) {
      this.logger.info(`🕒 Shelf ${shelfId} still empty after drop - rescheduling auto-hide`);
      this.scheduleEmptyShelfAutoHide(shelfId);
    } else if (config && config.items.length > 0) {
      this.logger.info(
        `📦 Shelf ${shelfId} has ${config.items.length} items after drop - keeping visible`
      );
    }
  }

  /**
   * Handle item removal from shelf
   */
  public async handleItemRemove(shelfId: string, itemId: string): Promise<boolean> {
    this.logger.info(
      `🗑️ ApplicationController: Handling item removal - shelf: ${shelfId}, item: ${itemId}`
    );

    const result = this.shelfManager.removeItemFromShelf(shelfId, itemId);
    this.logger.info(`🗑️ ApplicationController: Item removal result: ${result}`);

    // Trigger the same logic that the event handler would have triggered
    if (result) {
      const config = this.shelfManager.getShelfConfig(shelfId);
      if (config && config.items.length === 0 && !config.isPinned) {
        this.logger.info(
          `🗑️ ApplicationController: Shelf ${shelfId} is now empty after manual removal, scheduling auto-hide`
        );

        // Cancel any existing auto-hide timer first
        this.cancelShelfAutoHide(shelfId);

        // Schedule auto-hide with shorter delay for manual removal (3 seconds)
        this.scheduleEmptyShelfAutoHide(shelfId, 3000);
      }

      // Also emit the event for consistency (in case event handlers get restored later)
      this.emit('shelf-item-removed', shelfId, itemId);
    }

    return result;
  }

  /**
   * Handle files dropped on shelf
   */
  public handleFilesDropped(shelfId: string, filePaths: string[]): void {
    try {
      this.logger.info(`📁 HANDLING DROPPED FILES on shelf ${shelfId}:`, filePaths);

      // Cancel any auto-hide timer since shelf now has files
      this.cancelShelfAutoHide(shelfId);

      // Convert file paths to shelf items
      const items = filePaths.map(filePath => ({
        id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        type: 'file' as const,
        name: filePath.split('/').pop() || filePath,
        path: filePath,
        createdAt: Date.now(),
      }));

      this.logger.info(`📁 Adding ${items.length} items to shelf ${shelfId}`);

      // Add items to shelf
      for (const item of items) {
        const success = this.shelfManager.addItemToShelf(shelfId, item);
        this.logger.debug(
          `📁 Added item ${item.name} to shelf ${shelfId}: ${success ? 'SUCCESS' : 'FAILED'}`
        );
      }

      // Mark shelf as pinned since it now has content
      const config = this.shelfManager.getShelfConfig(shelfId);
      if (config) {
        config.isPinned = true;
        this.logger.info(
          `📌 SHELF PINNED: ${shelfId} with ${items.length} files (items.length: ${config.items.length})`
        );
      } else {
        this.logger.error(`📌 ERROR: Could not find config for shelf ${shelfId} to pin it`);
      }

      // Remove from active drop operations
      this.activeDropOperations.delete(shelfId);
      this.logger.info(`📁 Finished handling dropped files on shelf ${shelfId}`);
    } catch (error) {
      this.logger.error('📁 ERROR handling dropped files:', error);
      this.activeDropOperations.delete(shelfId);
    }
  }

  /**
   * Get count of visible shelves only
   */
  private getVisibleShelfCount(): number {
    let visibleCount = 0;
    for (const shelfId of this.activeShelves) {
      const config = this.shelfManager.getShelfConfig(shelfId);
      if (config && config.isVisible) {
        visibleCount++;
      }
    }
    return visibleCount;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<typeof this.config>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };

    // Apply configuration changes
    if ('enableShakeGesture' in newConfig && this.isRunning) {
      if (newConfig.enableShakeGesture && !oldConfig.enableShakeGesture) {
        this.dragShakeDetector.start();
      } else if (!newConfig.enableShakeGesture && oldConfig.enableShakeGesture) {
        this.dragShakeDetector.stop();
      }
    }

    if ('enableDragDetection' in newConfig && this.isRunning) {
      if (newConfig.enableDragDetection && !oldConfig.enableDragDetection) {
        this.dragShakeDetector.start();
      } else if (!newConfig.enableDragDetection && oldConfig.enableDragDetection) {
        this.dragShakeDetector.stop();
      }
    }
  }

  /**
   * Cleanup and destroy
   */
  public async destroy(): Promise<void> {
    await this.stop();

    // Clean up all timers to prevent memory leaks
    for (const timer of this.cleanupTimers) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();

    // Clear all shelf auto-hide timers
    for (const timer of this.shelfAutoHideTimers.values()) {
      clearTimeout(timer);
    }
    this.shelfAutoHideTimers.clear();

    // Destroy all modules
    this.mouseTracker.removeAllListeners();
    this.dragShakeDetector.destroy();

    // Stop drag detector
    this.dragShakeDetector.stop();

    this.shelfManager.destroy();

    this.removeAllListeners();
    this.logger.info('ApplicationController destroyed');
  }
}
