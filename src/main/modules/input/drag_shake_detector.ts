import { EventEmitter } from 'events';
import { AdvancedShakeDetector } from './shake_detector';
import { createLogger, Logger } from '../utils/logger';
import { MousePosition } from '@shared/types';
import {
  DragMonitor,
  createDragMonitor,
  DraggedItem as NativeDraggedItem,
} from '@native/drag-monitor';
import { MouseEventBatcher } from './mouse_event_batcher';

export interface DraggedItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
}

export interface DragShakeEvent {
  type: 'drag-shake';
  isDragging: boolean;
  items: DraggedItem[];
  shakeIntensity?: number;
  directionChanges?: number;
  timestamp: number;
}

export interface ShakeEventData {
  directionChanges: number;
  distance: number;
  velocity: number;
  intensity: number;
  timestamp: number;
}

export interface BatchedEvent {
  positions: MousePosition[];
}

/**
 * Cross-platform drag and shake detection
 * Supports macOS (CGEventTap + NSPasteboard) and Windows (SetWindowsHookEx + OLE)
 *
 * Detection sequence:
 * 1. Low-level mouse hook monitors mouse events globally
 * 2. When drag detected, checks clipboard/pasteboard for files
 * 3. During active file drag, monitors for shake gesture
 * 4. Shows shelf when both conditions met
 * 5. Hides shelf immediately on mouse release
 */
export class DragShakeDetector extends EventEmitter {
  private logger: Logger;
  private shakeDetector: AdvancedShakeDetector;
  private dragMonitor: DragMonitor | null = null;
  private mouseBatcher: MouseEventBatcher;

  private isDragging: boolean = false;
  private draggedItems: DraggedItem[] = [];
  private lastDragShakeTime: number = 0;
  private dragShakeDebounce: number = 400; // ms - much longer to prevent multiple shelves
  private isRunning: boolean = false;

  constructor() {
    super();
    this.logger = createLogger('DragShakeDetector');

    // Initialize mouse event batcher to reduce CPU usage
    this.mouseBatcher = new MouseEventBatcher(10, 33); // Batch 10 events or every 33ms (~30fps)

    // Initialize shake detector with very easy sensitivity for testing
    this.shakeDetector = new AdvancedShakeDetector();
    this.shakeDetector.configure({
      minDirectionChanges: 2, // Require at least 2 direction changes
      timeWindow: 800, // 800ms to complete shake (more time)
      minDistance: 5, // Lower threshold for easier detection
      debounceTime: 300, // Longer debounce to prevent spam
    });

    this.initializeNativeDragMonitor();
    this.setupEventHandlers();
  }

  private initializeNativeDragMonitor(): void {
    const platform = process.platform;

    // Check for supported platforms
    if (platform !== 'darwin' && platform !== 'win32') {
      this.logger.error(`Unsupported platform: ${platform}`);
      throw new Error(
        `Platform ${platform} is not supported. Only macOS and Windows are supported.`
      );
    }

    try {
      this.dragMonitor = createDragMonitor();
      this.logger.debug(`createDragMonitor() returned: ${this.dragMonitor ? 'instance' : 'null'}`);
      if (this.dragMonitor) {
        this.logger.debug(`dragMonitor type: ${this.dragMonitor.constructor.name}`);
        this.logger.debug(`start method type: ${typeof this.dragMonitor.start}`);
      }
      this.logger.info(
        `Native drag monitor initialized for ${platform === 'darwin' ? 'macOS' : 'Windows'}`
      );
    } catch (error: unknown) {
      this.logger.error('FATAL: Native drag monitor could not be initialized');
      this.logger.error('Error:', error instanceof Error ? error.message : String(error));
      this.logger.error('');
      this.logger.error('To fix:');
      this.logger.error('1. Rebuild native modules: npm run rebuild:native');
      if (platform === 'darwin') {
        this.logger.error('2. Grant accessibility permissions in System Settings');
      }
      this.logger.error('3. Restart the application');
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Set up mouse batcher handlers
    this.mouseBatcher.on('batch', (batchedEvent: BatchedEvent) => {
      // Log batch event for debugging
      if (this.isDragging) {
        this.logger.debug('🔍 Batch event received during drag:', {
          positionCount: batchedEvent.positions.length,
          isDragging: this.isDragging,
        });
      }

      // Process batched positions for shake detection
      batchedEvent.positions.forEach((pos: MousePosition) => {
        this.shakeDetector.processPosition(pos);
      });
    });

    // Handle immediate position updates for critical events
    this.mouseBatcher.on('position', (position: MousePosition) => {
      // Still emit position for other components that need real-time updates
      this.emit('position', position);
    });

    // Handle shake events - only process during active drag
    this.shakeDetector.on('shake', (event: ShakeEventData) => {
      this.logger.debug('🌟 Shake event detected', {
        isDragging: this.isDragging,
        intensity: event.intensity,
        directionChanges: event.directionChanges,
      });
      if (this.isDragging) {
        this.handleDragShake(event);
      } else {
        this.logger.debug('⏸️ Shake ignored - not dragging');
      }
    });

    // Handle native drag events
    if (this.dragMonitor) {
      this.logger.debug('Setting up drag monitor event handlers');

      this.dragMonitor.on('dragStart', (items: NativeDraggedItem[]) => {
        this.logger.debug('Received dragStart event with', items.length, 'items');
        this.handleDragStart(this.convertNativeItems(items));
      });

      // Listen for actual drag events from native monitor

      this.dragMonitor.on('dragging', (items: NativeDraggedItem[]) => {
        this.updateDraggedItems(this.convertNativeItems(items));
      });

      this.dragMonitor.on('dragEnd', () => {
        this.logger.debug('Received dragEnd event');
        this.handleDragEnd();
      });

      this.dragMonitor.on('error', (error: Error) => {
        this.logger.error('Native monitor error:', error);
      });

      this.logger.debug('Drag monitor event handlers registered');
    } else {
      this.logger.error('No drag monitor to attach events to!');
    }
  }

  private handleDragStart(items: DraggedItem[]): void {
    // Don't emit duplicate drag starts
    if (this.isDragging) {
      this.logger.debug('📎 Duplicate drag start ignored - already dragging');
      return;
    }

    // Reset position counter for debugging
    this.positionLogCount = 0;

    this.isDragging = true;
    this.draggedItems = items;

    this.logger.info('📎 File drag started:', {
      count: items.length,
      files: items.map(i => i.name),
    });

    // PERFORMANCE OPTIMIZATION: Start shake detection only when dragging
    this.logger.debug('🚀 Starting shake detection (drag active)');
    this.shakeDetector.start();

    // Emit drag start event for state machine
    this.logger.info('📡 EMITTING: drag-start event to ApplicationController');
    this.emit('drag-start', items);

    // Don't show shelf yet - wait for shake!
    this.logger.info('⏳ Shake mouse to show shelf...');
    this.logger.debug('DragShakeDetector: File drag started, waiting for shake...');
  }

  private updateDraggedItems(items: DraggedItem[]): void {
    if (this.isDragging && items.length > 0) {
      this.draggedItems = items;
      this.logger.debug(`📁 Updated: ${items.length} files`);
    }
  }

  private handleDragShake(shakeEvent: ShakeEventData): void {
    const now = Date.now();

    // Debounce rapid shakes
    const timeSinceLastShake = now - this.lastDragShakeTime;
    if (timeSinceLastShake < this.dragShakeDebounce) {
      this.logger.info(`🛡️ Shake DEBOUNCED: ${timeSinceLastShake}ms < ${this.dragShakeDebounce}ms`);
      return;
    }

    this.lastDragShakeTime = now;

    this.logger.info('🎯 DRAG + SHAKE TRIGGERED!', {
      files: this.draggedItems.length,
      intensity: shakeEvent.intensity,
      directionChanges: shakeEvent.directionChanges,
    });

    // Emit the drag-shake event to show shelf
    this.emit('dragShake', {
      type: 'drag-shake',
      isDragging: true,
      items: this.draggedItems,
      shakeIntensity: shakeEvent.intensity,
      directionChanges: shakeEvent.directionChanges,
      timestamp: now,
    } as DragShakeEvent);
  }

  private handleDragEnd(): void {
    // Ensure drag end is only processed once
    if (!this.isDragging) {
      this.logger.debug('📁 Duplicate drag end ignored - not dragging');
      return;
    }

    this.logger.info('📁 Drag ended');

    // Clear drag state immediately to unblock system operations
    this.isDragging = false;
    this.draggedItems = [];

    // PERFORMANCE OPTIMIZATION: Stop shake detection when not dragging
    this.logger.debug('⏸️ Stopping shake detection (drag ended)');
    this.shakeDetector.stop();

    // Emit drag-end event to allow proper shelf cleanup
    // The ApplicationController will handle smart cleanup logic
    this.logger.info('📡 EMITTING: drag-end event to ApplicationController');
    this.emit('drag-end');
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('DragShakeDetector is already running');
      return;
    }

    this.logger.info('Starting native drag-shake detector');

    // Start mouse batcher
    this.mouseBatcher.start();
    this.logger.info('✅ Mouse event batcher started');

    // PERFORMANCE OPTIMIZATION: Don't start shake detector until drag begins
    this.logger.info('✅ Shake detector initialized (will start on drag)');

    // Start native drag monitor
    if (this.dragMonitor) {
      this.logger.debug('🔧 DEBUG: About to call dragMonitor.start()');
      const success = this.dragMonitor.start();
      this.logger.debug(`🔧 DEBUG: dragMonitor.start() returned: ${success}`);
      if (success) {
        this.isRunning = true;
        this.logger.info('✅ System ready');
        this.logger.info('📝 Instructions:');
        this.logger.info('   1. Drag files from Finder');
        this.logger.info('   2. Shake mouse while dragging');
        this.logger.info('   3. Drop files on shelf');
      } else {
        this.logger.error('❌ Failed to start native drag monitor');
      }
    } else {
      this.logger.error('❌ No drag monitor available!');
    }

    this.emit('started');
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Stopping drag-shake detector');

    this.mouseBatcher.stop();

    // PERFORMANCE OPTIMIZATION: Ensure shake detector is stopped
    if (this.shakeDetector) {
      this.shakeDetector.stop();
    }

    if (this.dragMonitor) {
      this.dragMonitor.stop();
    }

    this.isDragging = false;
    this.draggedItems = [];
    this.isRunning = false;

    this.emit('stopped');
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public processPosition(position: MousePosition): void {
    // PERFORMANCE OPTIMIZATION: Only process positions during drag operations
    if (!this.isDragging) {
      return; // Skip all processing when not dragging - MAJOR CPU savings
    }

    // Debug logging - log first few positions to verify flow
    if (!this.positionLogCount) {
      this.positionLogCount = 0;
    }
    this.positionLogCount++;

    if (this.positionLogCount <= 5 || this.positionLogCount % 100 === 0) {
      this.logger.debug(`📍 Position #${this.positionLogCount} received during drag:`, {
        x: position.x,
        y: position.y,
        isDragging: this.isDragging,
      });
    }

    // Use batcher instead of direct processing to reduce CPU usage
    this.mouseBatcher.addPosition(position);
  }

  private positionLogCount = 0;

  /**
   * Convert native drag items to local DraggedItem format
   */
  private convertNativeItems(nativeItems: NativeDraggedItem[]): DraggedItem[] {
    return nativeItems.map(item => ({
      name: item.name,
      path: item.path,
      type: item.type === 'folder' || item.isDirectory ? 'folder' : 'file',
    }));
  }

  public destroy(): void {
    this.stop();

    this.mouseBatcher.destroy();
    this.shakeDetector.destroy();

    if (this.dragMonitor) {
      this.dragMonitor.destroy();
    }

    this.removeAllListeners();
  }
}
