import { EventEmitter } from 'events';
import { createMouseTracker } from '@native/mouse-tracker';
import { DragShakeDetector } from '../input';
import { ShelfManager } from '../window/shelfManager';
import { errorHandler, ErrorSeverity, ErrorCategory } from '../utils/errorHandler';
import { PreferencesManager } from '../config/preferencesManager';
import { MouseTracker, DragShakeEvent, DragItem, ShelfConfig, ShelfItem } from '@shared/types';
import { Logger, createLogger } from '../utils/logger';
import { SHELF_CONSTANTS, APP_CONSTANTS, PERFORMANCE_CONSTANTS } from '@shared/constants';
import { ShelfItemType, ShelfMode } from '@shared/enums';
import { TimerManager } from '../utils/timerManager';
import { AsyncMutex } from '../utils/asyncMutex';
import { DragShelfStateMachine, DragShelfEvent } from '../state/dragShelfStateMachine';
import { keyboardManager } from '../input/keyboardManager';

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
  private preferencesManager: PreferencesManager;
  private timerManager: TimerManager;
  private shelfCreationMutex: AsyncMutex;
  private stateMachine: DragShelfStateMachine;

  // Configuration
  private config = {
    autoHideDelay: SHELF_CONSTANTS.AUTO_HIDE_DELAY,
    maxSimultaneousShelves: APP_CONSTANTS.MAX_SIMULTANEOUS_SHELVES,
    enableShakeGesture: true, // Enable shake detection for manual shelf creation
    enableDragDetection: true, // Enable to check for files when shake happens
    useNativeDragMonitor: true, // Use native macOS drag monitoring if available
    emptyShelfTimeout: SHELF_CONSTANTS.EMPTY_TIMEOUT,
  };

  // Store native dragged files for full path resolution
  private nativeDraggedFiles: Array<{ path: string; name: string }> = [];

  constructor() {
    super();

    // Initialize logger with context
    this.logger = createLogger('ApplicationController');
    this.logger.info('🚀 ApplicationController constructor started');

    // Initialize preferences manager
    this.preferencesManager = PreferencesManager.getInstance();
    this.logger.info('✓ PreferencesManager initialized');

    // Initialize timer manager
    this.timerManager = new TimerManager('ApplicationController');
    this.logger.info('✓ TimerManager initialized');

    // Initialize mutex for shelf creation
    this.shelfCreationMutex = new AsyncMutex();
    this.logger.info('✓ AsyncMutex initialized');

    // Initialize state machine
    this.stateMachine = new DragShelfStateMachine();
    this.stateMachine.on('stateChanged', ({ previousState, currentState, event }) => {
      this.logger.debug(`State changed: ${previousState} -> ${currentState} (${event})`);
    });
    this.logger.info('✓ DragShelfStateMachine initialized');

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
    this.setupPreferenceHandlers();
    this.setupKeyboardShortcuts();

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

      // Check if drag + shake is enabled before starting mouse tracking
      const appPrefs = this.preferencesManager.getPreferences();
      const dragShakeEnabled = appPrefs.shakeDetection?.dragShakeEnabled ?? true;

      if (dragShakeEnabled) {
        // Start mouse tracking only if drag+shake is enabled
        this.logger.info('🖱️ Starting mouse tracker (drag+shake enabled)...');

        try {
          // Use timeout wrapper to prevent hanging
          const startPromise = new Promise<void>((resolve, reject) => {
            try {
              this.mouseTracker.start();
              // If we get here without hanging, it worked
              setTimeout(() => resolve(), 100); // Small delay to let native module initialize
            } catch (error) {
              reject(error);
            }
          });

          const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error('Mouse tracker start timeout')), 1000);
          });

          await Promise.race([startPromise, timeoutPromise]);
          this.logger.info('✅ Mouse tracker started successfully');

          // Log initial position to verify tracking
          this.timerManager.setTimeout(
            'initial-tracking-log',
            () => {
              this.logger.debug('Mouse tracker active - move your mouse to see position updates');
            },
            500,
            'Initial mouse tracking verification'
          );
        } catch (error) {
          this.logger.error('❌ Mouse tracker failed to start:', error);
          // Mouse tracking is REQUIRED for shake detection - throw error
          throw new Error('Mouse tracking is required for shake detection');
        }
      } else {
        this.logger.info('💤 Drag + shake disabled - skipping mouse tracker to save CPU');
      }

      if (dragShakeEnabled) {
        // Start combined drag-shake detector with timeout protection
        this.logger.info('🔄 Starting drag-shake detector (enabled in preferences)...');
        try {
          await Promise.race([
            new Promise<void>(resolve => {
              this.dragShakeDetector.start();
              resolve();
            }),
            new Promise<void>((_, reject) => {
              setTimeout(() => reject(new Error('Drag-shake detector start timeout')), 2000);
            }),
          ]);
          this.logger.info('✓ Drag-shake detector started');
        } catch (error) {
          this.logger.error('❌ Failed to start drag-shake detector:', error);
          // Don't throw - continue with limited functionality
          this.logger.warn('⚠️ Continuing without drag-shake detection');
        }
      } else {
        this.logger.info('🚫 Drag + shake disabled in preferences - not starting detector');
      }

      // Start keyboard manager for shortcuts
      this.logger.info('⌨️ Starting keyboard manager...');
      keyboardManager.start();
      this.logger.info('✓ Keyboard manager started');

      // Register custom create shelf shortcut after keyboard manager starts
      const prefs = this.preferencesManager.getPreferences();
      const registered = keyboardManager.registerCustomShortcut(
        prefs.shortcuts.createShelf,
        'create-shelf',
        'Create a new shelf at cursor position'
      );
      if (registered) {
        this.logger.info(`✓ Registered create-shelf shortcut: ${prefs.shortcuts.createShelf}`);
      } else {
        this.logger.warn(
          `⚠️ Failed to register create-shelf shortcut: ${prefs.shortcuts.createShelf}`
        );
      }

      // Shelves are created on demand via shake/drag gestures or shortcuts

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
      keyboardManager.stop();

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
   * Set up preference change handlers
   */
  private setupPreferenceHandlers(): void {
    // Listen for preference changes
    this.preferencesManager.on('preferences-changed', preferences => {
      this.logger.info('🔧 Preferences changed, checking autoHideEmpty setting');

      // If auto-hide was disabled, cancel all existing auto-hide timers
      if (!preferences.shelf.autoHideEmpty) {
        this.logger.info('🚫 Auto-hide disabled - cancelling all existing auto-hide timers');
        for (const shelfId of this.activeShelves) {
          this.cancelShelfAutoHide(shelfId);
        }
      } else {
        this.logger.info('✅ Auto-hide enabled - re-evaluating empty shelves');
        // If auto-hide was enabled, re-evaluate empty shelves
        this.reevaluateEmptyShelvesForAutoHide();
      }
    });

    // Listen for specific shelf setting changes
    this.preferencesManager.on('shelf-settings-changed', shelfSettings => {
      this.logger.info('🏠 Shelf settings changed:', {
        autoHideEmpty: shelfSettings.autoHideEmpty,
      });

      if (!shelfSettings.autoHideEmpty) {
        // Cancel auto-hide timers if disabled
        for (const shelfId of this.activeShelves) {
          this.cancelShelfAutoHide(shelfId);
        }
      } else {
        // Re-evaluate empty shelves if enabled
        this.reevaluateEmptyShelvesForAutoHide();
      }
    });

    // Listen for shake detection setting changes
    this.preferencesManager.on('shake-settings-changed', async shakeSettings => {
      this.logger.info('🎯 Shake settings changed:', {
        enabled: shakeSettings.enabled,
        dragShakeEnabled: shakeSettings.dragShakeEnabled,
      });

      // Handle drag + shake toggle
      if (!shakeSettings.dragShakeEnabled) {
        this.logger.info(
          '🚫 Drag + shake disabled - stopping mouse tracking and drag detector to save CPU'
        );
        this.dragShakeDetector?.stop();
        this.mouseTracker?.stop();
        this.logger.info('💤 Mouse tracking stopped - CPU resources freed');
      } else if (this.isRunning) {
        this.logger.info('✅ Drag + shake enabled - restarting mouse tracking and drag detector');

        // Restart mouse tracker with error handling
        if (this.mouseTracker && !this.mouseTracker.isTracking()) {
          try {
            // Ensure tracker is fully stopped before restarting
            await new Promise(resolve => setTimeout(resolve, 100));
            this.mouseTracker.start();
            this.logger.info('🖱️ Mouse tracking restarted successfully');
          } catch (error) {
            this.logger.error('Failed to restart mouse tracking:', error);
            // Emit error event for UI notification
            this.emit('mouse-tracking-error', error);
          }
        }

        // Restart drag shake detector with error handling
        if (this.dragShakeDetector) {
          try {
            await new Promise(resolve => setTimeout(resolve, 100));
            this.dragShakeDetector.start();
            this.logger.info('🎯 Drag shake detector restarted successfully');
          } catch (error) {
            this.logger.error('Failed to restart drag shake detector:', error);
            // Continue without drag detection
            this.logger.warn('⚠️ Continuing without drag-shake detection');
          }
        }
      }
    });
  }

  /**
   * Set up keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    // Listen for create shelf shortcut
    keyboardManager.on('create-shelf', () => {
      this.logger.info('📋 Create shelf shortcut triggered');
      this.createShelfViaShortcut();
    });

    // Also listen for the new-shelf event from default shortcuts
    keyboardManager.on('new-shelf', () => {
      this.logger.info('📋 New shelf shortcut triggered');
      this.createShelfViaShortcut();
    });

    // Listen for preference changes to update shortcuts
    this.preferencesManager.on('shortcuts-changed', (shortcuts: Record<string, string>) => {
      if (shortcuts.createShelf) {
        // Unregister old and register new
        keyboardManager.unregisterCustomShortcut('create-shelf');
        const registered = keyboardManager.registerCustomShortcut(
          shortcuts.createShelf,
          'create-shelf',
          'Create a new shelf at cursor position'
        );
        if (registered) {
          this.logger.info(`✓ Updated create-shelf shortcut to: ${shortcuts.createShelf}`);
        } else {
          this.logger.warn(
            `⚠️ Failed to update create-shelf shortcut to: ${shortcuts.createShelf}`
          );
        }
      }
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

        // Check state machine instead of boolean flag
        const context = this.stateMachine.getContext();
        if (!context.isDragging) {
          this.logger.info('🧹 Immediate cleanup - no drag operation detected');
          this.timerManager.setTimeout(
            'no-drag-cleanup',
            () => {
              this.clearEmptyShelves();
            },
            200,
            'Quick cleanup for non-drag scenarios'
          );
        } else {
          // Longer delay for drag operations to allow drop completion
          this.logger.info('⏰ Drag operation detected - using extended delay for cleanup');
          this.timerManager.setTimeout(
            'drag-cleanup',
            () => {
              this.logger.info('⏰ Checking for empty shelves after drag completion delay');
              this.clearEmptyShelves();
            },
            3000, // Increased from 1000ms to 3000ms to give more time for drop processing
            'Clean up empty shelves after drag'
          );
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

    // Enhanced drag detector events with state machine
    this.dragShakeDetector.on('drag-start', (items: Array<{ path: string; name: string }>) => {
      this.logger.info('📡 RECEIVED: drag-start event from DragShakeDetector');
      this.logger.info('🎯 Drag operation started (optimistic)');
      // Store native dragged files for later use

      this.nativeDraggedFiles =
        items?.map(item => ({
          path: item.path,
          name: item.name,
        })) || [];

      this.logger.info(
        `📁 Stored ${this.nativeDraggedFiles.length} native dragged files with full paths`
      );
      this.stateMachine.send(DragShelfEvent.START_DRAG);
      this.emit('drag-started');
    });

    this.dragShakeDetector.on('drag-end', () => {
      this.logger.info('📡 RECEIVED: drag-end event from DragShakeDetector');
      this.logger.info('🛑 Drag operation ended');
      // Don't clear native dragged files immediately - keep them for drop operations
      this.stateMachine.send(DragShelfEvent.END_DRAG);

      // Remove all shelves from active drop operations after a delay
      this.timerManager.setTimeout(
        'drag-end-cleanup',
        () => {
          if (this.activeDropOperations.size > 0) {
            this.logger.info(
              `🧹 Clearing ${this.activeDropOperations.size} shelves from drop operations`
            );
            this.activeDropOperations.clear();
          }

          // IMPORTANT: Give sufficient time for drop operations to complete
          // File drops can take time to process, especially with validation
          this.logger.info('⏰ Scheduling empty shelf cleanup after drop processing window');

          // Schedule cleanup with a longer delay to allow drop operations to complete
          this.timerManager.setTimeout(
            'empty-shelf-cleanup',
            () => {
              this.logger.info('🧹 Checking for empty shelves after drop processing delay');
              this.clearEmptyShelves();

              // Clear native dragged files after drop operations have had time to complete
              this.logger.info('🗑️ Clearing native dragged files after drop processing');
              this.nativeDraggedFiles = [];

              // Also re-evaluate any remaining shelves for auto-hide scheduling
              this.logger.info(
                '🔄 Re-evaluating remaining shelves for auto-hide after drag completion'
              );
              this.reevaluateEmptyShelvesForAutoHide();
            },
            3000, // Give 3 seconds for drop operations to complete
            'Clean up empty shelves after drop processing'
          );
        },
        500, // Initial delay to clear drop operations tracking
        'Process drop operations and schedule cleanup'
      );

      this.emit('drag-ended');
    });

    this.dragShakeDetector.on('files-detected', files => {
      this.logger.debug('📁 Files detected in drag:', files);
      this.emit('files-in-drag', files);
    });

    // Shelf management events
    this.shelfManager.on('shelf-created', shelfId => {
      this.activeShelves.add(shelfId);
      this.stateMachine.send(DragShelfEvent.SHELF_CREATED, { shelfId });
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

      // Update state machine
      this.stateMachine.send(DragShelfEvent.ITEMS_ADDED);

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

        // Update state machine
        this.stateMachine.send(DragShelfEvent.ITEMS_REMOVED);

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
    // Use mutex to prevent concurrent shelf creation
    await this.shelfCreationMutex.runExclusive(async () => {
      try {
        this.logger.info(
          `🎯 Drag-shake event: ${event.type}, dragging: ${event.isDragging}, items: ${event.items?.length || 0}`
        );

        // Check if drag + shake is enabled in preferences
        const preferences = this.preferencesManager.getPreferences();
        if (!preferences.shakeDetection.dragShakeEnabled) {
          this.logger.info('⚠️ Drag + shake is disabled in preferences - ignoring');
          return;
        }

        // Only create shelf if user is dragging files
        // The drag-shake detector now properly checks for actual drag operations
        if (!event.isDragging || !event.items || event.items.length === 0) {
          this.logger.info('⚠️ Shake detected but no drag operation - ignoring');
          return;
        }

        // Check if can create shelf through state machine
        if (!this.stateMachine.canCreateShelf()) {
          this.logger.info('⚠️ Cannot create shelf in current state');
          return;
        }

        // Send shake detected event
        this.stateMachine.send(DragShelfEvent.SHAKE_DETECTED);

        // Check if we already have an active shelf through state machine
        const context = this.stateMachine.getContext();
        if (context.activeShelfId) {
          const shelfConfig = this.shelfManager.getShelfConfig(context.activeShelfId);
          if (shelfConfig && shelfConfig.isVisible) {
            this.logger.info(
              `♻️ Reusing existing shelf: ${context.activeShelfId} (preventing duplicate)`
            );
            this.shelfManager.showShelf(context.activeShelfId);
            return;
          }
        }

        // Create a new shelf only if we don't have any active ones
        this.logger.info('📦 Creating new shelf at cursor position');
        const currentPos = this.mouseTracker.getCurrentPosition();

        const shelfPrefs = this.preferencesManager.getPreferences();
        const shelfId = await this.shelfManager.createShelf({
          position: { x: currentPos.x - 150, y: currentPos.y - 200 },
          isPinned: false,
          isVisible: true,
          opacity: shelfPrefs.shelf.opacity,
          mode: ShelfMode.RENAME, // Always create rename mode shelves
          items: [], // Start with empty shelf - let user drop files
        });

        if (shelfId) {
          // Clear any existing shelves from tracking to ensure only one
          this.activeShelves.clear();
          // Note: shelf will be added to activeShelves by the 'shelf-created' event handler
          this.logger.info(`✅ Single shelf created: ${shelfId}`);

          // Schedule auto-hide for empty shelf with delay to ensure drag state is established
          // This prevents the first shelf from disappearing during initial drag operations
          this.timerManager.setTimeout(
            `shelf-autohide-check-${shelfId}`,
            () => {
              // Double-check: only schedule auto-hide if we're not currently dragging
              // and the shelf is still empty and exists
              const ctx = this.stateMachine.getContext();
              const currentConfig = this.shelfManager.getShelfConfig(shelfId);
              if (!ctx.isDragging && currentConfig && currentConfig.items.length === 0) {
                this.logger.info(`⏰ Scheduling delayed auto-hide for empty shelf: ${shelfId}`);
                this.scheduleEmptyShelfAutoHide(shelfId);
              } else if (ctx.isDragging) {
                this.logger.info(
                  `🔒 Skipping auto-hide scheduling - drag still in progress for shelf: ${shelfId}`
                );
              } else if (currentConfig && currentConfig.items.length > 0) {
                this.logger.info(`📦 Skipping auto-hide scheduling - shelf has items: ${shelfId}`);
              }
            },
            500,
            'Check if shelf should be auto-hidden after drag state stabilizes'
          );

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
      }
    });
  }

  /**
   * Schedule auto-hide for empty shelf
   */
  private scheduleEmptyShelfAutoHide(shelfId: string, customTimeout?: number): void {
    // Check if auto-hide is enabled in preferences
    const preferences = this.preferencesManager.getPreferences();
    if (!preferences.shelf.autoHideEmpty) {
      this.logger.info(
        `🚫 Auto-hide disabled in preferences - skipping auto-hide for shelf: ${shelfId}`
      );
      return;
    }

    // Cancel any existing timer for this shelf
    this.cancelShelfAutoHide(shelfId);

    // Use custom timeout or default
    const timeout = customTimeout || this.config.emptyShelfTimeout;

    // Schedule new timer with TimerManager
    this.timerManager.setTimeout(
      `shelf-autohide-${shelfId}`,
      () => {
        // CRITICAL: Don't auto-hide shelves during active drag operations
        const context = this.stateMachine.getContext();
        if (context.isDragging) {
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
        if (shelfConfig && shelfConfig.mode === ShelfMode.RENAME) {
          this.logger.info(`🔒 Shelf ${shelfId} is in rename mode - skipping auto-hide`);
          return;
        }

        if (shelfConfig && shelfConfig.items.length === 0) {
          this.logger.info(`⏰ Auto-hiding empty shelf after ${timeout}ms: ${shelfId}`);
          this.shelfManager.hideShelf(shelfId);

          // Destroy the shelf after a short delay if still empty
          this.timerManager.setTimeout(
            `shelf-destroy-${shelfId}`,
            () => {
              // CRITICAL: Final check - don't destroy during active drag operations
              const ctx = this.stateMachine.getContext();
              if (ctx.isDragging) {
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
                // Send cleanup complete to state machine
                this.stateMachine.send(DragShelfEvent.CLEANUP_COMPLETE);
              } else if (updatedConfig && updatedConfig.items.length > 0) {
                this.logger.info(
                  `📦 Shelf ${shelfId} now has ${updatedConfig.items.length} items - keeping it visible`
                );
                this.shelfManager.showShelf(shelfId); // Make sure it's visible
              }
            },
            1000,
            `Destroy empty shelf ${shelfId}`
          );
        } else {
          this.logger.debug(
            `📌 Shelf ${shelfId} has ${shelfConfig?.items.length} items - not auto-hiding`
          );
        }
      },
      timeout,
      `Auto-hide empty shelf ${shelfId}`
    );

    this.logger.info(`⏰ Scheduled auto-hide for shelf ${shelfId} in ${timeout}ms`);
  }

  /**
   * Cancel auto-hide for a shelf
   */
  private cancelShelfAutoHide(shelfId: string): void {
    const timerId = `shelf-autohide-${shelfId}`;
    if (this.timerManager.clearTimeout(timerId)) {
      this.logger.debug(`🚫 Cancelled auto-hide for shelf: ${shelfId}`);
    }
    // Also try to clear the destroy timer if it exists
    this.timerManager.clearTimeout(`shelf-destroy-${shelfId}`);
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
        !this.timerManager.hasTimer(`shelf-autohide-${shelfId}`) &&
        !this.activeDropOperations.has(shelfId)
      ) {
        this.logger.info(
          `🔄 Scheduling auto-hide for empty shelf after drag completion: ${shelfId}`
        );
        this.scheduleEmptyShelfAutoHide(shelfId);
      }
    }

    // Handle the single active empty shelf if it exists
    const activeShelfId = this.stateMachine.getContext().activeShelfId;
    if (activeShelfId) {
      const shelfConfig = this.shelfManager.getShelfConfig(activeShelfId);
      if (
        shelfConfig &&
        shelfConfig.items.length === 0 &&
        !this.timerManager.hasTimer(`shelf-autohide-${activeShelfId}`) &&
        !this.activeDropOperations.has(activeShelfId)
      ) {
        this.logger.info(
          `🔄 Scheduling auto-hide for active empty shelf after drag completion: ${activeShelfId}`
        );
        this.scheduleEmptyShelfAutoHide(activeShelfId);
      }
    }
  }

  /**
   * Clear all empty shelves when left button is released
   */
  private clearEmptyShelves(): void {
    const context = this.stateMachine.getContext();
    this.logger.info(
      `🔍 clearEmptyShelves called - isDragging: ${context.isDragging}, activeDropOps: ${this.activeDropOperations.size}, activeShelves: ${this.activeShelves.size}, activeShelfId: ${context.activeShelfId}`
    );

    // Check if auto-hide is enabled in preferences
    const preferences = this.preferencesManager.getPreferences();
    if (!preferences.shelf.autoHideEmpty) {
      this.logger.info('🚫 Auto-hide disabled in preferences - skipping empty shelf cleanup');
      return;
    }

    // Don't clear shelves that are actively receiving drops
    if (this.activeDropOperations.size > 0) {
      this.logger.info('⏸️ Skipping shelf cleanup - drop operations in progress');
      return;
    }

    // Don't clear shelves during active drag operation
    if (context.isDragging) {
      this.logger.info('📎 Skipping shelf cleanup - drag still in progress');
      return;
    }

    const activeShelfId = context.activeShelfId;
    if (activeShelfId) {
      // Double check the shelf is still empty and not receiving drops
      const shelfConfig = this.shelfManager.getShelfConfig(activeShelfId);
      if (
        shelfConfig &&
        (!shelfConfig.items || shelfConfig.items.length === 0) &&
        !this.activeDropOperations.has(activeShelfId)
      ) {
        this.logger.info(`🗑️ Clearing empty shelf on button release: ${activeShelfId}`);
        this.shelfManager.destroyShelf(activeShelfId);
        this.activeShelves.delete(activeShelfId);
        this.cancelShelfAutoHide(activeShelfId);
        this.stateMachine.send(DragShelfEvent.CLEANUP_COMPLETE);
      } else if (shelfConfig && shelfConfig.items.length > 0) {
        this.logger.info(
          `📦 Shelf ${activeShelfId} has ${shelfConfig.items.length} items - keeping it`
        );
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
    const stateContext = this.stateMachine.getContext();
    return {
      isRunning: this.isRunning,
      activeShelves: this.getVisibleShelfCount(), // Only count visible shelves
      totalShelves: this.activeShelves.size, // Total including hidden
      state: {
        currentState: this.stateMachine.getState(),
        isDragging: stateContext.isDragging,
        hasActiveShelf: stateContext.activeShelfId !== null,
        dropInProgress: stateContext.dropInProgress,
      },
      modules: {
        mouseTracker: this.mouseTracker.isTracking(),
        shakeDetector: this.dragShakeDetector ? true : false,
        dragDetector: this.dragShakeDetector ? true : false,
        stateMachine: true,
      },
      analytics: {
        mouseTracker: this.mouseTracker.getPerformanceMetrics?.() || null,
        shakeDetector: null, // Analytics removed in v2
        dragDetector: null, // Native module analytics
      },
    };
  }

  /**
   * Get native dragged files with full paths
   */
  public getNativeDraggedFiles(): Array<{ path: string; name: string }> {
    return this.nativeDraggedFiles;
  }

  /**
   * Handle drop start event from shelf
   */
  public handleDropStart(shelfId: string): void {
    this.logger.info(`🎯 DROP START on shelf: ${shelfId}`);
    this.activeDropOperations.add(shelfId);
    this.stateMachine.send(DragShelfEvent.DROP_STARTED);

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
    this.stateMachine.send(DragShelfEvent.DROP_ENDED);

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
      this.logger.debug(
        `🔧 DEBUG: Input filePaths analysis:`,
        filePaths.map(fp => ({
          value: fp,
          length: fp.length,
          hasSlash: fp.includes('/'),
          isFullPath: fp.startsWith('/'),
          type: typeof fp,
        }))
      );

      // Cancel any auto-hide timer since shelf now has files
      this.cancelShelfAutoHide(shelfId);

      // Convert file paths to shelf items using system metadata
      const items: ShelfItem[] = [];

      for (const filePath of filePaths) {
        let itemType = ShelfItemType.FILE;
        let size: number | undefined;
        const fileName = filePath.split('/').pop() || filePath;

        // Try to get the full path from native drag data
        let fullPath = filePath;
        if (!filePath.startsWith('/')) {
          // This is just a filename, try to find the full path from native drag data
          const nativeFile = this.nativeDraggedFiles.find(
            f => f.name === filePath || f.path.endsWith(filePath)
          );
          if (nativeFile) {
            fullPath = nativeFile.path;
            this.logger.debug(
              `📂 Resolved full path from native drag data: ${filePath} -> ${fullPath}`
            );
          }
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const fs = require('fs');
          this.logger.debug(`Checking path: "${fullPath}" (exists: ${fs.existsSync(fullPath)})`);
          const stats = fs.statSync(fullPath);

          this.logger.debug(`Stats for ${fileName}:`, {
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            isSymbolicLink: stats.isSymbolicLink(),
            mode: stats.mode,
            size: stats.size,
          });

          if (stats.isDirectory()) {
            itemType = ShelfItemType.FOLDER;
            this.logger.info(`✅ System metadata: ${fileName} -> FOLDER (isDirectory: true)`);
          } else if (stats.isFile()) {
            itemType = ShelfItemType.FILE;
            size = stats.size;
            this.logger.info(`📄 System metadata: ${fileName} -> FILE (size: ${size})`);
          } else {
            // Handle special cases (symlinks, etc.)
            itemType = ShelfItemType.FILE;
            this.logger.info(`📄 System metadata: ${fileName} -> FILE (special type)`);
          }
        } catch (error) {
          // Fallback to extension-based detection if fs.stat fails
          const hasExtension = fileName.includes('.') && !fileName.startsWith('.');
          itemType = hasExtension ? ShelfItemType.FILE : ShelfItemType.FOLDER;
          this.logger.error(
            `❌ Fallback detection: ${fileName} -> ${itemType} (stat failed: ${error})`
          );
        }

        items.push({
          id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          type: itemType,
          name: fileName,
          path: fullPath,
          size,
          createdAt: Date.now(),
        });
      }

      this.logger.info(`📁 Processing ${items.length} items for shelf ${shelfId}`);

      // Check for duplicates against existing items in the shelf
      const existingConfig = this.shelfManager.getShelfConfig(shelfId);
      const existingPaths = new Set<string>();
      if (existingConfig && existingConfig.items) {
        existingConfig.items.forEach(existingItem => {
          if (existingItem.path) {
            existingPaths.add(existingItem.path);
          }
        });
      }

      // Filter out duplicate items
      const newItems = items.filter(item => {
        if (item.path && existingPaths.has(item.path)) {
          this.logger.info(`📋 Skipping duplicate file/folder: ${item.name} (${item.path})`);
          return false;
        }
        return true;
      });

      this.logger.info(
        `📁 Adding ${newItems.length} new items to shelf ${shelfId} (${items.length - newItems.length} duplicates skipped)`
      );

      // EMERGENCY: Force garbage collection to prevent memory accumulation
      if (global.gc) {
        global.gc();
        this.logger.debug('🗑️ Forced garbage collection after file processing');
      }
      this.logger.debug(
        `🔧 DEBUG: Created items with paths:`,
        newItems.map(item => ({
          id: item.id,
          name: item.name,
          path: item.path,
          pathType: typeof item.path,
        }))
      );

      // Add items to shelf
      for (const item of newItems) {
        const success = this.shelfManager.addItemToShelf(shelfId, item);
        this.logger.debug(
          `📁 Added item ${item.name} to shelf ${shelfId}: ${success ? 'SUCCESS' : 'FAILED'}`
        );
      }

      // Mark shelf as pinned since it now has content
      const config = this.shelfManager.getShelfConfig(shelfId);
      if (config && newItems.length > 0) {
        config.isPinned = true;
        this.logger.info(
          `📌 SHELF PINNED: ${shelfId} with ${newItems.length} new files (total items: ${config.items.length})`
        );
      } else if (!config) {
        this.logger.error(`📌 ERROR: Could not find config for shelf ${shelfId} to pin it`);
      } else if (newItems.length === 0) {
        this.logger.info(`📌 No new items added to shelf ${shelfId} - all were duplicates`);
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
   * Create a shelf manually via keyboard shortcut
   */
  public async createShelfViaShortcut(): Promise<void> {
    await this.shelfCreationMutex.runExclusive(async () => {
      try {
        this.logger.info('⌨️ Creating shelf via keyboard shortcut');

        // Check if we can create a shelf
        const context = this.stateMachine.getContext();
        if (context.activeShelfId) {
          const shelfConfig = this.shelfManager.getShelfConfig(context.activeShelfId);
          if (shelfConfig && shelfConfig.isVisible) {
            this.logger.info(`♻️ Reusing existing shelf: ${context.activeShelfId}`);
            this.shelfManager.showShelf(context.activeShelfId);
            return;
          }
        }

        // Get current mouse position for shelf placement
        const currentPos = this.mouseTracker.getCurrentPosition();
        const preferences = this.preferencesManager.getPreferences();

        // Create shelf at cursor position
        const shelfId = await this.shelfManager.createShelf({
          position: { x: currentPos.x - 150, y: currentPos.y - 200 },
          isPinned: false,
          isVisible: true,
          opacity: preferences.shelf.opacity,
          mode: ShelfMode.RENAME,
          items: [],
        });

        if (shelfId) {
          this.activeShelves.clear();
          this.logger.info(`✅ Shelf created via shortcut: ${shelfId}`);

          // Schedule auto-hide for empty shelf
          this.timerManager.setTimeout(
            `shelf-autohide-check-${shelfId}`,
            () => {
              const currentConfig = this.shelfManager.getShelfConfig(shelfId);
              if (currentConfig && currentConfig.items.length === 0) {
                this.logger.info(`⏰ Scheduling auto-hide for empty shelf: ${shelfId}`);
                this.scheduleEmptyShelfAutoHide(shelfId);
              }
            },
            500,
            'Check if shelf should be auto-hidden'
          );
        }
      } catch (error) {
        this.logger.error('Error creating shelf via shortcut:', error);
      }
    });
  }

  /**
   * Cleanup and destroy
   */
  public async destroy(): Promise<void> {
    await this.stop();

    // Clean up all timers using TimerManager
    this.timerManager.destroy();

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
