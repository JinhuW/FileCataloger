import { EventEmitter } from 'events';
import { createMouseTracker } from '@native/mouse-tracker';
import { AdvancedShakeDetector } from './shake-detector';
import { EnhancedDragDetector } from './enhanced-drag-detector';
import { createNativeDragMonitor, NativeDragMonitor } from '@native/drag-monitor';
import { ShelfManager } from './shelf-manager';
import { errorHandler, ErrorSeverity, ErrorCategory } from './error-handler';
import { PreferencesManager } from './preferences-manager';
import { MouseTracker } from '@shared/types';

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
  private shakeDetector: AdvancedShakeDetector;
  private dragDetector: EnhancedDragDetector;  // Enhanced drag detector with optimistic activation
  private nativeDragMonitor: NativeDragMonitor | null;  // Native macOS drag monitor
  private shelfManager: ShelfManager;
  
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
    
    // Initialize preferences manager
    this.preferencesManager = PreferencesManager.getInstance();
    
    // Initialize modules
    this.mouseTracker = createMouseTracker();
    this.shakeDetector = new AdvancedShakeDetector();
    
    // Try to use native drag monitor on macOS
    this.nativeDragMonitor = null;
    if (this.config.useNativeDragMonitor && process.platform === 'darwin') {
      this.nativeDragMonitor = createNativeDragMonitor();
      if (this.nativeDragMonitor) {
        console.log('✓ Native drag monitor available for macOS');
      } else {
        console.warn('⚠️ Native drag monitor failed to initialize, falling back to enhanced detector');
      }
    }
    
    // Use enhanced drag detector as fallback
    this.dragDetector = new EnhancedDragDetector();
    
    this.shelfManager = new ShelfManager();
    
    this.setupEventHandlers();
    this.setupErrorHandling();
  }

  /**
   * Start the application
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('ApplicationController is already running');
      return;
    }

    try {
      console.log('Starting Dropover application...');
      
      // Start mouse tracking
      this.mouseTracker.start();
      console.log('✓ Mouse tracker started');

      // Start shake detection (disabled by default)
      if (this.config.enableShakeGesture) {
        this.shakeDetector.start();
        console.log('✓ Shake detector started');
      } else {
        console.log('⚠️ Shake detector disabled - manual shelf creation only');
      }

      // Start drag detection
      if (this.config.enableDragDetection) {
        if (this.nativeDragMonitor) {
          // Use native drag monitor with improved change count detection
          const started = this.nativeDragMonitor.start({
            onDragStart: () => {
              console.log('Native file drag detected (fresh drag operation)');
              this.isDragging = true;
              this.hasCreatedShelfInSession = false; // Reset session flag on new drag
              this.emit('drag-started');
            },
            onDragEnd: () => {
              console.log('Native drag ended');
              this.isDragging = false;
              this.hasCreatedShelfInSession = false; // Reset session flag when drag ends
              this.emit('drag-ended');
            },
            onDragData: (data) => {
              console.log('Drag data received:', data);
            }
          });
          
          if (started) {
            console.log('✓ Native drag monitor started (using change count detection)');
            console.log('ℹ️ Drag files and shake your mouse to create a shelf');
          } else {
            console.log('⚠️ Native drag monitor failed, using enhanced detector');
            this.dragDetector.start();
          }
        } else {
          // Fall back to enhanced drag detector
          this.dragDetector.start();
          console.log('✓ Enhanced drag detector started (optimistic mode)');
        }
      } else {
        console.log('⚠️ Drag detection disabled');
      }

      this.isRunning = true;
      this.emit('started');
      
      console.log('🚀 Dropover application started successfully!');
    } catch (error) {
      console.error('Failed to start application:', error);
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
      this.shakeDetector.stop();
      this.dragDetector.stop();
      
      // Stop native drag monitor if active
      if (this.nativeDragMonitor) {
        this.nativeDragMonitor.stop();
        this.nativeDragMonitor.destroy();
      }
      
      // Close all shelves
      for (const shelfId of this.activeShelves) {
        this.shelfManager.destroyShelf(shelfId);
      }

      this.isRunning = false;
      this.emit('stopped');
    } catch (error) {
      console.error('Error stopping application:', error);
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
        console.error('Critical error detected, may need to restart:', error);
      }
    });

    // Listen for native errors to fallback
    errorHandler.on('native-error', (error) => {
      console.warn('Native module error, using fallback:', error);
    });

    // Listen for performance issues
    errorHandler.on('performance-issue', (error) => {
      console.warn('Performance issue detected:', error);
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
    // Mouse position updates -> Shake detector
    this.mouseTracker.on('position', (position) => {
      this.shakeDetector.processPosition(position);
    });

    // Mouse tracker errors
    this.mouseTracker.on('error', (error) => {
      console.error('Mouse tracker error:', error);
      this.emit('mouse-tracking-error', error);
    });

    // Shake detection -> Create shelf
    this.shakeDetector.on('shake', (shakeData) => {
      this.handleShakeGesture(shakeData);
    });

    // Enhanced drag detector events
    this.dragDetector.on('drag-start', () => {
      console.log('🎯 Drag operation started (optimistic)');
      this.emit('drag-started');
    });
    
    this.dragDetector.on('drag-end', () => {
      console.log('🛑 Drag operation ended');
      this.emit('drag-ended');
    });
    
    this.dragDetector.on('files-detected', (files) => {
      console.log('📁 Files detected in drag:', files);
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
      console.log(`📦 Item added to shelf ${shelfId}, auto-hide cancelled`);
      this.emit('shelf-item-added', shelfId, item);
    });

    this.shelfManager.on('shelf-item-removed', (shelfId, itemId) => {
      // Check if shelf is now empty and schedule auto-hide if so
      const config = this.shelfManager.getShelfConfig(shelfId);
      if (config && config.items.length === 0 && !config.isPinned) {
        console.log(`🗑️ Shelf ${shelfId} is now empty, scheduling auto-hide`);
        this.scheduleEmptyShelfAutoHide(shelfId);
      }
      this.emit('shelf-item-removed', shelfId, itemId);
    });
  }

  /**
   * Handle shake gesture
   */
  private async handleShakeGesture(shakeData: {
    directionChanges: number;
    distance: number;
    velocity: number;
    intensity: number;
    timestamp: number;
  }): Promise<void> {
    try {
      console.log('🎯 Shake gesture received in ApplicationController:', shakeData);
      
      // Check if user is dragging files (native detection or optimistic mode)
      console.log(`[Shake Handler] isDragging: ${this.isDragging}`);
      if (!this.isDragging) {
        // If no native drag detected, enable optimistic mode and check clipboard
        console.log('[Shake Handler] No native drag detected, checking clipboard...');
        this.dragDetector.enableOptimisticDragMode();
        const hasFiles = this.dragDetector.checkNow();
        console.log(`[Shake Handler] Clipboard check result: ${hasFiles}`);
        
        if (!hasFiles) {
          console.log('Shake detected but no drag operation - ignoring');
          return;
        }
        console.log('📁 Shake with clipboard files detected (optimistic mode)');
      } else {
        console.log('📁 Shake with native drag detected');
      }
      
      console.log('✅ Processing drag+shake - will create shelf');
      
      // Check preference for creating only on first drag+shake
      const prefs = this.preferencesManager.getPreferences();
      if (prefs.shelf.createOnlyOnFirstDragAndShake && this.hasCreatedShelfInSession) {
        console.log('🚫 Shelf already created in this drag session (preference: createOnlyOnFirstDragAndShake)');
        // Just show the existing shelf without creating a new one
        if (this.activeEmptyShelfId) {
          this.shelfManager.showShelf(this.activeEmptyShelfId);
        }
        return;
      }
      
      // Check if we already have an active empty shelf
      if (this.activeEmptyShelfId) {
        const shelfConfig = this.shelfManager.getShelfConfig(this.activeEmptyShelfId);
        if (shelfConfig && shelfConfig.items.length === 0) {
          console.log(`🔄 Reusing existing empty shelf: ${this.activeEmptyShelfId} (keeping at original position)`);
          // Just show the existing shelf without moving it
          this.shelfManager.showShelf(this.activeEmptyShelfId);
          // Don't move it - let it stay where it was created
          return;
        } else {
          // Shelf is no longer empty, clear reference
          this.activeEmptyShelfId = null;
        }
      }
      
      // Check if we already have too many VISIBLE shelves
      const visibleShelfCount = this.getVisibleShelfCount();
      if (visibleShelfCount >= this.config.maxSimultaneousShelves) {
        console.warn(`Maximum number of visible shelves reached (${visibleShelfCount}/${this.config.maxSimultaneousShelves})`);
        return;
      }

      // Create a new shelf at cursor position
      const currentPosition = this.mouseTracker.getCurrentPosition();
      console.log(`Current mouse position: x=${currentPosition.x}, y=${currentPosition.y}`);
      
      const shelfPosition = {
        x: currentPosition.x - 150, // Center shelf on cursor
        y: currentPosition.y - 200
      };
      console.log(`Creating shelf at position: x=${shelfPosition.x}, y=${shelfPosition.y}`);
      
      const shelfId = await this.shelfManager.createShelf({
        position: shelfPosition,
        isPinned: false,
        isVisible: true,
        items: []
      });

      console.log(`📦 New shelf created via drag+shake: ${shelfId} (${this.getVisibleShelfCount()}/${this.config.maxSimultaneousShelves} visible)`);
      
      // Track this as the active empty shelf
      this.activeEmptyShelfId = shelfId;
      this.activeShelves.add(shelfId);
      this.hasCreatedShelfInSession = true; // Mark that shelf was created in this session
      
      // Auto-hide empty shelf after timeout
      this.scheduleEmptyShelfAutoHide(shelfId);

    } catch (error) {
      console.error('Error handling shake gesture:', error);
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
        console.log(`⏰ Auto-hiding empty shelf after ${this.config.emptyShelfTimeout}ms: ${shelfId}`);
        this.shelfManager.hideShelf(shelfId);
        
        // Destroy the shelf after a short delay if still empty
        setTimeout(() => {
          const updatedConfig = this.shelfManager.getShelfConfig(shelfId);
          if (updatedConfig && updatedConfig.items.length === 0) {
            this.shelfManager.destroyShelf(shelfId);
            console.log(`🗑️ Destroyed empty shelf: ${shelfId}`);
            // Clear active empty shelf reference if it's this one
            if (this.activeEmptyShelfId === shelfId) {
              this.activeEmptyShelfId = null;
            }
          }
        }, 1000);
      } else {
        console.log(`📌 Shelf ${shelfId} has ${shelfConfig?.items.length} items - not auto-hiding`);
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
      console.log(`🚫 Cancelled auto-hide for shelf: ${shelfId}`);
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
   * Get application status
   */
  public getStatus() {
    return {
      isRunning: this.isRunning,
      activeShelves: this.getVisibleShelfCount(), // Only count visible shelves
      totalShelves: this.activeShelves.size, // Total including hidden
      modules: {
        mouseTracker: this.mouseTracker.isTracking(),
        shakeDetector: this.shakeDetector ? true : false,
        dragDetector: this.dragDetector ? true : false
      },
      analytics: {
        mouseTracker: this.mouseTracker.getPerformanceMetrics?.() || null,
        shakeDetector: this.shakeDetector.getAnalytics(),
        dragDetector: null // Analytics not available for current detector
      }
    };
  }

  /**
   * Handle drop start event from shelf
   */
  public handleDropStart(shelfId: string): void {
    console.log(`Preventing auto-hide for shelf: ${shelfId}`);
    this.activeDropOperations.add(shelfId);
  }

  /**
   * Handle drop end event from shelf
   */
  public handleDropEnd(shelfId: string): void {
    console.log(`Re-enabling auto-hide for shelf: ${shelfId}`);
    this.activeDropOperations.delete(shelfId);
  }

  /**
   * Handle files dropped on shelf
   */
  public handleFilesDropped(shelfId: string, filePaths: string[]): void {
    try {
      console.log(`📁 HANDLING DROPPED FILES on shelf ${shelfId}:`, filePaths);
      
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

      console.log(`📁 Adding ${items.length} items to shelf ${shelfId}`);

      // Add items to shelf
      for (const item of items) {
        const success = this.shelfManager.addItemToShelf(shelfId, item);
        console.log(`📁 Added item ${item.name} to shelf ${shelfId}: ${success ? 'SUCCESS' : 'FAILED'}`);
      }

      // Mark shelf as pinned since it now has content
      const config = this.shelfManager.getShelfConfig(shelfId);
      if (config) {
        config.isPinned = true;
        console.log(`📌 SHELF PINNED: ${shelfId} with ${items.length} files (items.length: ${config.items.length})`);
      } else {
        console.error(`📌 ERROR: Could not find config for shelf ${shelfId} to pin it`);
      }

      // Remove from active drop operations
      this.activeDropOperations.delete(shelfId);
      console.log(`📁 Finished handling dropped files on shelf ${shelfId}`);
      
    } catch (error) {
      console.error('📁 ERROR handling dropped files:', error);
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
        this.shakeDetector.start();
      } else if (!newConfig.enableShakeGesture && oldConfig.enableShakeGesture) {
        this.shakeDetector.stop();
      }
    }

    if ('enableDragDetection' in newConfig && this.isRunning) {
      if (newConfig.enableDragDetection && !oldConfig.enableDragDetection) {
        this.dragDetector.start();
      } else if (!newConfig.enableDragDetection && oldConfig.enableDragDetection) {
        this.dragDetector.stop();
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
    this.shakeDetector.destroy();
    
    // Stop drag detector
    this.dragDetector.stop();
    
    this.shelfManager.destroy();
    
    this.removeAllListeners();
    console.log('ApplicationController destroyed');
  }
}