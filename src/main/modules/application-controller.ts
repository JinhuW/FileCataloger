import { EventEmitter } from 'events';
import { screen } from 'electron';
import { createMouseTracker } from '../../native/mouse-tracker';
import { DragShakeDetector } from './drag-shake-detector-v2';
import { ShelfManager } from './shelf-manager';
import { errorHandler, ErrorSeverity, ErrorCategory } from './error-handler';
import { PreferencesManager } from './preferences-manager';
import { MouseTracker } from '../../shared/types';
import { Logger, createLogger } from './logger';

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
  private preferencesManager: PreferencesManager;
  
  
  // Configuration
  private config = {
    autoHideDelay: 3000,
    maxSimultaneousShelves: 5,
    enableShakeGesture: true, // Enable shake detection for manual shelf creation
    enableDragDetection: true, // Enable to check for files when shake happens
    useNativeDragMonitor: true, // Use native macOS drag monitoring if available
    emptyShelfTimeout: 30000 // Auto-hide empty shelves after 30 seconds (plenty of time to drop files)
  };

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
      // For now, create the tracker anyway to avoid null reference issues
      // We need to implement a proper fallback tracker
      const NodeTracker = require('@native/mouse-tracker').NodeTracker;
      this.mouseTracker = new NodeTracker();
      this.logger.warn('⚠️ Using fallback NodeTracker for mouse tracking');
    }
    
    // Initialize combined drag and shake detector
    this.dragShakeDetector = new DragShakeDetector();
    this.logger.info('✓ Drag-shake detector initialized');
    
    this.shelfManager = new ShelfManager();
    
    this.setupEventHandlers();
    this.setupErrorHandling();
    
    // Test shelf creation removed - shelves are created on demand via shake/drag
  }

  /**
   * Start the application
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('ApplicationController is already running');
      return;
    }

    try {
      this.logger.info('Starting Dropover application...');
      
      // Start mouse tracking
      this.logger.info('Starting mouse tracker...');
      this.mouseTracker.start();
      this.logger.info('✓ Mouse tracker started');
      
      // Log initial position to verify tracking
      setTimeout(() => {
        this.logger.debug('Mouse tracker active - move your mouse to see position updates');
      }, 500);

      // Start combined drag-shake detector
      this.dragShakeDetector.start();
      this.logger.info('✓ Drag-shake detector started');

      // Shelves are created on demand via shake/drag gestures

      // Keep enhanced drag detector for compatibility
      if (this.config.enableDragDetection) {
        this.dragShakeDetector.start();
        this.logger.info('✓ Enhanced drag detector started (compatibility)');
      }

      this.isRunning = true;
      this.emit('started');
      
      this.logger.info('🚀 Dropover application started successfully!');
    } catch (error) {
      this.logger.error('Failed to start application:', error);
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
    errorHandler.on('error', (error) => {
      if (error.severity === ErrorSeverity.CRITICAL) {
        this.logger.error('Critical error detected, may need to restart:', error);
      }
    });

    // Listen for native errors to fallback
    errorHandler.on('native-error', (error) => {
      this.logger.warn('Native module error, using fallback:', error);
    });

    // Listen for performance issues
    errorHandler.on('performance-issue', (error) => {
      this.logger.warn('Performance issue detected:', error);
    });

    // Handle mouse tracker errors
    this.mouseTracker.on('error', (error: Error) => {
      errorHandler.handleError(error, {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.NATIVE,
        context: { module: 'mouse-tracker' }
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
    
    this.mouseTracker.on('position', (position) => {
      // Debug logging to trace position structure
      if (positionLogCount === 0) {
        console.log('📌 ApplicationController first position received:', {
          x: position.x,
          y: position.y,
          timestamp: position.timestamp,
          leftButtonDown: position.leftButtonDown,
          typeOfX: typeof position.x,
          typeOfY: typeof position.y
        });
      }
      
      // Log every 100th position to avoid spam
      if (++positionLogCount % 100 === 0) {
        this.logger.debug('Mouse tracking active - position:', position);
      }
      
      // Detect left button release (disabled in fallback mode since button is always "pressed")
      // In production with native tracking, this would clear shelves on button release
      if (wasLeftButtonDown && !position.leftButtonDown) {
        this.logger.info('🖱️ Left button released - clearing empty shelves');
        this.clearEmptyShelves();
      }
      
      wasLeftButtonDown = position.leftButtonDown || false;
      this.dragShakeDetector.processPosition(position);
    });

    // Mouse tracker errors
    this.mouseTracker.on('error', (error) => {
      this.logger.error('Mouse tracker error:', error);
      this.emit('mouse-tracking-error', error);
    });

    // Drag-shake detection -> Create shelf
    this.dragShakeDetector.on('dragShake', (event) => {
      this.handleDragShakeEvent(event);
    });

    // Enhanced drag detector events
    this.dragShakeDetector.on('drag-start', () => {
      this.logger.info('🎯 Drag operation started (optimistic)');
      this.emit('drag-started');
    });
    
    this.dragShakeDetector.on('drag-end', () => {
      this.logger.info('🛑 Drag operation ended');
      this.emit('drag-ended');
    });
    
    this.dragShakeDetector.on('files-detected', (files) => {
      this.logger.debug('📁 Files detected in drag:', files);
      this.emit('files-in-drag', files);
    });

    // Shelf management events
    this.shelfManager.on('shelf-created', (shelfId) => {
      this.activeShelves.add(shelfId);
      this.emit('shelf-created', shelfId);
    });

    this.shelfManager.on('shelf-destroyed', (shelfId) => {
      this.activeShelves.delete(shelfId);
      this.emit('shelf-destroyed', shelfId);
    });

    this.shelfManager.on('shelf-item-added', (shelfId, item) => {
      // Cancel auto-hide timer when items are added
      this.cancelShelfAutoHide(shelfId);
      this.logger.info(`📦 Item added to shelf ${shelfId}, auto-hide cancelled`);
      this.emit('shelf-item-added', shelfId, item);
    });

    this.shelfManager.on('shelf-item-removed', (shelfId, itemId) => {
      // Check if shelf is now empty and schedule auto-hide if so
      const config = this.shelfManager.getShelfConfig(shelfId);
      if (config && config.items.length === 0 && !config.isPinned) {
        this.logger.info(`🗑️ Shelf ${shelfId} is now empty, scheduling auto-hide`);
        this.scheduleEmptyShelfAutoHide(shelfId);
      }
      this.emit('shelf-item-removed', shelfId, itemId);
    });
  }

  /**
   * Handle drag-shake events
   */
  private async handleDragShakeEvent(event: any): Promise<void> {
    try {
      this.logger.info(`🎯 Drag-shake event: ${event.type}, dragging: ${event.isDragging}, items: ${event.items?.length || 0}`);
      
      // Only create shelf if user is dragging files
      // The drag-shake detector now properly checks for actual drag operations
      if (!event.isDragging && event.items.length === 0) {
        this.logger.info('⚠️ Shake detected but no drag operation - ignoring');
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
      
      // Create a new shelf only if we don't have any active ones
      this.logger.info('📦 Creating new shelf at cursor position');
      const currentPos = this.mouseTracker.getCurrentPosition();
      const shelfId = await this.shelfManager.createShelf({
        position: { x: currentPos.x - 150, y: currentPos.y - 200 },
        isPinned: false,
        isVisible: true,
        items: []
      });
      
      if (shelfId) {
        // Clear any existing shelves from tracking to ensure only one
        this.activeShelves.clear();
        this.activeEmptyShelfId = shelfId;
        this.activeShelves.add(shelfId);
        this.logger.info(`✅ Single shelf created: ${shelfId}`);
        
        // Schedule auto-hide for empty shelf
        this.scheduleEmptyShelfAutoHide(shelfId);
        
        // Log dragged items if any
        if (event.items && event.items.length > 0) {
          this.logger.info('📁 Dragged items detected:', event.items.map((item: any) => item.name));
        }
      }
    } catch (error) {
      this.logger.error('Error handling drag-shake event:', error);
    }
  }

  /**
   * Handle shake gesture (legacy compatibility)
   */
  private async handleShakeGesture(shakeData: {
    directionChanges: number;
    distance: number;
    velocity: number;
    intensity: number;
    timestamp: number;
  }): Promise<void> {
    try {
      this.logger.info('🎯 Shake gesture received in ApplicationController:', shakeData);
      
      // IMPORTANT: Only create shelf if we're in drag mode (drag + shake)
      // The drag-shake detector should have already set drag mode if files are being dragged
      if (!this.isDragging) {
        this.logger.info('⚠️ Shake detected but NOT dragging files - ignoring (need drag + shake)');
        return;
      }
      
      // Check if we already have an active shelf to prevent duplicates
      if (this.activeShelves.size > 0) {
        const existingShelfId = Array.from(this.activeShelves)[0];
        const shelfConfig = this.shelfManager.getShelfConfig(existingShelfId);
        if (shelfConfig && shelfConfig.isVisible) {
          this.logger.info(`♻️ Reusing existing shelf: ${existingShelfId} (preventing duplicate)`);
          return;
        }
      }
      
      // Create shelf for drag + shake
      this.logger.info('✅ DRAG + SHAKE detected - creating shelf');
      const mousePos = screen.getCursorScreenPoint();
      const shelfId = await this.shelfManager.createShelf({
        position: { x: mousePos.x, y: mousePos.y }
      });
      
      if (shelfId) {
        // Clear any existing shelves from tracking to ensure only one
        this.activeShelves.clear();
        this.activeShelves.add(shelfId);
        this.logger.info(`✅ SHELF CREATED for drag+shake: ${shelfId} at position (${mousePos.x}, ${mousePos.y})`);
        this.hasCreatedShelfInSession = true;
        
        // Schedule auto-hide for empty shelf
        this.scheduleEmptyShelfAutoHide(shelfId);
      }

    } catch (error) {
      this.logger.error('Error handling shake gesture:', error);
    }
  }


  /**
   * Schedule auto-hide for empty shelf
   */
  private scheduleEmptyShelfAutoHide(shelfId: string): void {
    // Cancel any existing timer for this shelf
    this.cancelShelfAutoHide(shelfId);
    
    // Schedule new timer
    const timer = setTimeout(() => {
      const shelfConfig = this.shelfManager.getShelfConfig(shelfId);
      if (shelfConfig && shelfConfig.items.length === 0) {
        this.logger.info(`⏰ Auto-hiding empty shelf after ${this.config.emptyShelfTimeout}ms: ${shelfId}`);
        this.shelfManager.hideShelf(shelfId);
        
        // Destroy the shelf after a short delay if still empty
        setTimeout(() => {
          const updatedConfig = this.shelfManager.getShelfConfig(shelfId);
          if (updatedConfig && updatedConfig.items.length === 0) {
            this.shelfManager.destroyShelf(shelfId);
            this.logger.info(`🗑️ Destroyed empty shelf: ${shelfId}`);
            // Clear active empty shelf reference if it's this one
            if (this.activeEmptyShelfId === shelfId) {
              this.activeEmptyShelfId = null;
            }
          }
        }, 1000);
      } else {
        this.logger.debug(`📌 Shelf ${shelfId} has ${shelfConfig?.items.length} items - not auto-hiding`);
      }
      
      // Clean up timer reference
      this.shelfAutoHideTimers.delete(shelfId);
    }, this.config.emptyShelfTimeout);
    
    // Store timer reference
    this.shelfAutoHideTimers.set(shelfId, timer);
  }
  
  /**
   * Cancel auto-hide for a shelf
   */
  private cancelShelfAutoHide(shelfId: string): void {
    const timer = this.shelfAutoHideTimers.get(shelfId);
    if (timer) {
      clearTimeout(timer);
      this.shelfAutoHideTimers.delete(shelfId);
      this.logger.debug(`🚫 Cancelled auto-hide for shelf: ${shelfId}`);
    }
  }

  /**
   * Clear all empty shelves when left button is released
   */
  private clearEmptyShelves(): void {
    if (this.activeEmptyShelfId) {
      const shelfConfig = this.shelfManager.getShelfConfig(this.activeEmptyShelfId);
      if (shelfConfig && (!shelfConfig.items || shelfConfig.items.length === 0)) {
        this.logger.info(`🗑️ Clearing empty shelf on button release: ${this.activeEmptyShelfId}`);
        this.shelfManager.destroyShelf(this.activeEmptyShelfId);
        this.activeShelves.delete(this.activeEmptyShelfId);
        this.cancelShelfAutoHide(this.activeEmptyShelfId);
        this.activeEmptyShelfId = null;
      }
    }
    
    // Also clear any other empty shelves
    for (const shelfId of this.activeShelves) {
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
  public async createShelf(config?: Partial<any>): Promise<string> {
    return await this.shelfManager.createShelf(config);
  }

  /**
   * Destroy a shelf
   */
  public async destroyShelf(shelfId: string): Promise<boolean> {
    return this.shelfManager.destroyShelf(shelfId);
  }

  /**
   * Create a test shelf for debugging
   */
  private async createTestShelf(): Promise<void> {
    try {
      this.logger.info('🧪 Creating test shelf at center of screen');
      const testShelfId = await this.shelfManager.createShelf({
        position: { x: 100, y: 100 }
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
        dragDetector: this.dragShakeDetector ? true : false
      },
      analytics: {
        mouseTracker: this.mouseTracker.getPerformanceMetrics?.() || null,
        shakeDetector: null, // Analytics removed in v2
        dragDetector: null // Native module analytics
      }
    };
  }

  /**
   * Handle drop start event from shelf
   */
  public handleDropStart(shelfId: string): void {
    this.logger.debug(`Preventing auto-hide for shelf: ${shelfId}`);
    this.activeDropOperations.add(shelfId);
  }

  /**
   * Handle drop end event from shelf
   */
  public handleDropEnd(shelfId: string): void {
    this.logger.debug(`Re-enabling auto-hide for shelf: ${shelfId}`);
    this.activeDropOperations.delete(shelfId);
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
        createdAt: Date.now()
      }));

      this.logger.info(`📁 Adding ${items.length} items to shelf ${shelfId}`);

      // Add items to shelf
      for (const item of items) {
        const success = this.shelfManager.addItemToShelf(shelfId, item);
        this.logger.debug(`📁 Added item ${item.name} to shelf ${shelfId}: ${success ? 'SUCCESS' : 'FAILED'}`);
      }

      // Mark shelf as pinned since it now has content
      const config = this.shelfManager.getShelfConfig(shelfId);
      if (config) {
        config.isPinned = true;
        this.logger.info(`📌 SHELF PINNED: ${shelfId} with ${items.length} files (items.length: ${config.items.length})`);
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