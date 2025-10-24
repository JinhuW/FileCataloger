import { EventEmitter } from 'events';
import { createMouseTracker } from '@native/mouse-tracker';
import { DragShakeDetector } from '../input';
import { ShelfManager } from '../window/shelfManager';
import { PreferencesManager } from '../config/preferencesManager';
import { MouseTracker, ShelfConfig, ShelfItem } from '@shared/types';
import { Logger, createLogger } from '../utils/logger';
import { DragShelfStateMachine } from '../state/dragShelfStateMachine';
import { keyboardManager } from '../input/keyboardManager';
import { EventRegistry } from '../utils/eventRegistry';
import { errorHandler, ErrorSeverity, ErrorCategory } from '../utils/errorHandler';

// New extracted modules
import { ShelfLifecycleManager } from './shelfLifecycleManager';
import { DragDropCoordinator } from './dragDropCoordinator';
import { AutoHideManager } from './autoHideManager';
import { CleanupCoordinator } from '../utils/cleanupCoordinator';

/**
 * Refactored Application Controller - now a thin orchestrator
 *
 * Responsibilities reduced to:
 * - Module initialization and lifecycle management
 * - Event routing between modules
 * - Error handling coordination
 * - IPC interface management
 *
 * Previous responsibilities delegated to:
 * - ShelfLifecycleManager: Shelf creation/destruction/tracking
 * - DragDropCoordinator: Drag and drop operations
 * - AutoHideManager: Auto-hide scheduling and management
 * - CleanupCoordinator: Cleanup sequencing and timing
 */
export class ApplicationController extends EventEmitter {
  private readonly logger: Logger;
  private readonly eventRegistry: EventRegistry;

  // Core modules
  private mouseTracker!: MouseTracker;
  private dragShakeDetector: DragShakeDetector;
  private shelfManager: ShelfManager;
  private preferencesManager: PreferencesManager;
  private stateMachine: DragShelfStateMachine;

  // New specialized managers
  private shelfLifecycleManager!: ShelfLifecycleManager;
  private dragDropCoordinator!: DragDropCoordinator;
  private autoHideManager!: AutoHideManager;
  private cleanupCoordinator!: CleanupCoordinator;

  private isRunning = false;

  constructor() {
    super();
    this.logger = createLogger('ApplicationController');
    this.eventRegistry = new EventRegistry();

    // Initialize core modules
    this.preferencesManager = PreferencesManager.getInstance();
    this.stateMachine = new DragShelfStateMachine();
    this.dragShakeDetector = new DragShakeDetector();
    this.shelfManager = new ShelfManager();

    this.logger.info('🚀 ApplicationController initialized');
  }

  /**
   * Initialize the application
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing application modules...');

      // Initialize mouse tracker
      await this.initializeMouseTracker();

      // Initialize specialized managers
      this.initializeManagers();

      // Setup event routing
      this.setupEventRouting();

      // Setup error handling
      this.setupErrorHandling();

      // Setup keyboard shortcuts
      this.setupKeyboardShortcuts();

      this.logger.info('✅ Application initialization complete');
    } catch (error) {
      this.logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * Initialize mouse tracker with error handling
   */
  private async initializeMouseTracker(): Promise<void> {
    try {
      this.mouseTracker = createMouseTracker();
      this.logger.info('✓ Native mouse tracker initialized');
    } catch (error) {
      this.logger.error('Failed to initialize mouse tracker:', error);
      throw new Error(`Failed to initialize native mouse tracker: ${error}`);
    }
  }

  /**
   * Initialize specialized manager modules
   */
  private initializeManagers(): void {
    // Initialize shelf lifecycle manager
    this.shelfLifecycleManager = new ShelfLifecycleManager(
      this.shelfManager,
      this.preferencesManager,
      this.stateMachine
    );

    // Initialize auto-hide manager
    this.autoHideManager = new AutoHideManager(
      this.shelfLifecycleManager,
      this.preferencesManager,
      this.stateMachine
    );

    // Initialize drag-drop coordinator
    this.dragDropCoordinator = new DragDropCoordinator(
      this.mouseTracker,
      this.dragShakeDetector,
      this.shelfLifecycleManager,
      this.stateMachine,
      this.preferencesManager
    );

    // Initialize cleanup coordinator
    this.cleanupCoordinator = new CleanupCoordinator(this.stateMachine);

    this.logger.info('✓ All manager modules initialized');
  }

  /**
   * Setup event routing between modules
   */
  private setupEventRouting(): void {
    // Route shelf lifecycle events
    this.eventRegistry.register(
      this.shelfLifecycleManager,
      'shelf-created',
      (shelfId: string) => this.emit('shelf-created', shelfId),
      'routing'
    );

    this.eventRegistry.register(
      this.shelfLifecycleManager,
      'shelf-destroyed',
      (shelfId: string) => this.emit('shelf-destroyed', shelfId),
      'routing'
    );

    // Route drag-drop events
    this.eventRegistry.register(
      this.dragDropCoordinator,
      'drag-started',
      (items: any) => this.emit('drag-started', items),
      'routing'
    );

    this.eventRegistry.register(
      this.dragDropCoordinator,
      'drag-ended',
      () => this.emit('drag-ended'),
      'routing'
    );

    // Route auto-hide events
    this.eventRegistry.register(
      this.autoHideManager,
      'shelf-auto-hidden',
      (shelfId: string) => this.emit('shelf-auto-hidden', shelfId),
      'routing'
    );

    // Route cleanup events
    this.eventRegistry.register(
      this.cleanupCoordinator,
      'clear-empty-shelves',
      () => this.shelfLifecycleManager.clearEmptyShelves(),
      'routing'
    );

    this.eventRegistry.register(
      this.cleanupCoordinator,
      'clear-drop-operations',
      () => this.shelfLifecycleManager.clearAllDropOperations(),
      'routing'
    );

    this.logger.info('✓ Event routing configured');
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.eventRegistry.register(
      errorHandler as any,
      'error',
      (error: any) => {
        if (error.severity === ErrorSeverity.CRITICAL) {
          this.logger.error('Critical error detected:', error);
          this.emit('critical-error', error);
        }
      },
      'error-handling'
    );

    this.eventRegistry.register(
      this.mouseTracker as any,
      'error',
      (error: Error) => {
        errorHandler.handleError(error, {
          severity: ErrorSeverity.HIGH,
          category: ErrorCategory.NATIVE,
          context: { module: 'mouse-tracker' }
        });
      },
      'error-handling'
    );

    this.logger.info('✓ Error handling configured');
  }

  /**
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    this.eventRegistry.register(
      keyboardManager as any,
      'create-shelf',
      () => this.createShelfViaShortcut(),
      'keyboard'
    );

    this.eventRegistry.register(
      keyboardManager as any,
      'new-shelf',
      () => this.createShelfViaShortcut(),
      'keyboard'
    );

    this.logger.info('✓ Keyboard shortcuts configured');
  }

  /**
   * Start the application
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Application already running');
      return;
    }

    try {
      this.logger.info('Starting application...');

      // Start drag-drop coordinator (handles mouse tracking)
      this.dragDropCoordinator.start();

      // Mark as running
      this.isRunning = true;

      this.logger.info('✅ Application started successfully');
      this.emit('started');
    } catch (error) {
      this.logger.error('Failed to start application:', error);
      this.emit('start-error', error);
      throw error;
    }
  }

  /**
   * Stop the application
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Application not running');
      return;
    }

    try {
      this.logger.info('Stopping application...');

      // Stop drag-drop coordinator
      this.dragDropCoordinator.stop();

      // Clear all shelves
      await this.shelfLifecycleManager.destroyAllShelves();

      // Mark as stopped
      this.isRunning = false;

      this.logger.info('✅ Application stopped successfully');
      this.emit('stopped');
    } catch (error) {
      this.logger.error('Error stopping application:', error);
      this.emit('stop-error', error);
    }
  }

  /**
   * Create shelf via keyboard shortcut
   */
  private async createShelfViaShortcut(): Promise<void> {
    this.logger.info('⌨️ Creating shelf via keyboard shortcut');

    const currentPos = this.mouseTracker.getCurrentPosition();

    await this.shelfLifecycleManager.createShelf({
      position: {
        x: currentPos.x - 150,
        y: currentPos.y - 200
      }
    });
  }

  // ============================================
  // Public API for IPC handlers
  // ============================================

  /**
   * Create a new shelf
   */
  public async createShelf(config: Partial<ShelfConfig>): Promise<string | null> {
    return this.shelfLifecycleManager.createShelf(config);
  }

  /**
   * Destroy a shelf
   */
  public async destroyShelf(shelfId: string): Promise<boolean> {
    return this.shelfLifecycleManager.destroyShelf(shelfId);
  }

  /**
   * Get shelf configuration
   */
  public getShelfConfig(shelfId: string): ShelfConfig | null {
    return this.shelfLifecycleManager.getShelfConfig(shelfId);
  }

  /**
   * Show a shelf
   */
  public async showShelf(shelfId: string): Promise<boolean> {
    try {
      this.shelfLifecycleManager.showShelf(shelfId);
      return true;
    } catch (error) {
      this.logger.error(`Failed to show shelf ${shelfId}:`, error);
      return false;
    }
  }

  /**
   * Hide a shelf
   */
  public async hideShelf(shelfId: string): Promise<boolean> {
    try {
      this.shelfManager.hideShelf(shelfId);
      return true;
    } catch (error) {
      this.logger.error(`Failed to hide shelf ${shelfId}:`, error);
      return false;
    }
  }

  /**
   * Add item to shelf
   */
  public async addItemToShelf(shelfId: string, item: ShelfItem): Promise<boolean> {
    try {
      await this.shelfManager.addItemToShelf(shelfId, item);
      return true;
    } catch (error) {
      this.logger.error(`Failed to add item to shelf ${shelfId}:`, error);
      return false;
    }
  }

  /**
   * Remove item from shelf
   */
  public async handleItemRemove(shelfId: string, itemId: string): Promise<boolean> {
    try {
      await this.shelfManager.removeItemFromShelf(shelfId, itemId);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove item ${itemId} from shelf ${shelfId}:`, error);
      return false;
    }
  }

  /**
   * Handle drop start on shelf
   */
  public handleDropStart(shelfId: string): void {
    this.shelfLifecycleManager.markShelfReceivingDrop(shelfId);
  }

  /**
   * Handle drop end on shelf
   */
  public handleDropEnd(shelfId: string): void {
    this.shelfLifecycleManager.markDropComplete(shelfId);
  }

  /**
   * Handle files dropped on shelf
   */
  public async handleFilesDropped(shelfId: string, files: string[]): Promise<void> {
    await this.handleFileDrop(shelfId, files);
  }

  /**
   * Get native dragged files
   */
  public getNativeDraggedFiles(): Array<{ path: string; name: string }> {
    return this.dragDropCoordinator.getNativeDraggedFiles();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: any): void {
    // Handle config updates as needed
    // For now, just log the config change
    this.logger.info('Configuration update requested:', config);
  }

  /**
   * Handle file drop on shelf
   */
  public async handleFileDrop(shelfId: string, files: string[]): Promise<void> {
    this.dragDropCoordinator.handleDropOnShelf(shelfId, files);

    // Add files to shelf
    for (const file of files) {
      await this.shelfManager.addItemToShelf(shelfId, {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'file' as any,
        path: file,
        name: file.split('/').pop() || file,
        createdAt: Date.now()
      });
    }

    this.dragDropCoordinator.completeDropOperation(shelfId);
  }

  /**
   * Get application status
   */
  public getStatus(): {
    isRunning: boolean;
    isDragging: boolean;
    activeShelves: number;
    mouseTracking: boolean;
    dragShakeEnabled: boolean;
  } {
    const preferences = this.preferencesManager.getPreferences();

    return {
      isRunning: this.isRunning,
      isDragging: this.dragDropCoordinator.isDragging(),
      activeShelves: this.shelfLifecycleManager.getActiveShelves().size,
      mouseTracking: this.mouseTracker?.isTracking() || false,
      dragShakeEnabled: preferences.shakeDetection.dragShakeEnabled
    };
  }

  /**
   * Clean up and destroy
   */
  public async destroy(): Promise<void> {
    await this.stop();

    // Clean up event registry
    this.eventRegistry.cleanupAll();

    // Destroy all managers
    this.shelfLifecycleManager?.destroy();
    this.dragDropCoordinator?.destroy();
    this.autoHideManager?.destroy();
    this.cleanupCoordinator?.destroy();

    // Destroy core modules
    this.mouseTracker?.removeAllListeners();
    this.dragShakeDetector?.destroy();
    this.shelfManager?.destroy();

    this.logger.info('ApplicationController destroyed');
  }
}