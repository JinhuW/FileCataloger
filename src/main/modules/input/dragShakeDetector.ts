import { EventEmitter } from 'events';
import { AdvancedShakeDetector } from './shakeDetector';
import { createLogger, Logger } from '../utils/logger';
import { MousePosition } from '@shared/types';
import { MacDragMonitor, createDragMonitor } from '@native/drag-monitor';
import { MouseEventBatcher } from './mouseEventBatcher';

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
 * Native drag and shake detection for macOS
 * ONLY works with proper native module - no fallbacks
 *
 * Detection sequence:
 * 1. CGEventTap monitors mouse events globally
 * 2. When drag detected, checks NSPasteboard for files
 * 3. During active file drag, monitors for shake gesture
 * 4. Shows shelf when both conditions met
 * 5. Hides shelf immediately on mouse release
 */
export class DragShakeDetector extends EventEmitter {
  private logger: Logger;
  private shakeDetector: AdvancedShakeDetector;
  private dragMonitor: MacDragMonitor | null = null;
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
      timeWindow: 600, // 600ms to complete shake
      minDistance: 10, // Minimum movement to avoid accidental triggers
      debounceTime: 300, // Longer debounce to prevent spam
    });

    this.initializeNativeDragMonitor();
    this.setupEventHandlers();
  }

  private initializeNativeDragMonitor(): void {
    if (process.platform !== 'darwin') {
      this.logger.error('❌ This application only works on macOS');
      throw new Error('macOS required for drag detection');
    }

    try {
      this.dragMonitor = createDragMonitor();
      this.logger.debug(
        `🔧 DEBUG: createDragMonitor() returned: ${this.dragMonitor ? 'instance' : 'null'}`
      );
      if (this.dragMonitor) {
        this.logger.debug(`🔧 DEBUG: dragMonitor type: ${this.dragMonitor.constructor.name}`);
        this.logger.debug(
          `🔧 DEBUG: dragMonitor methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(this.dragMonitor)).join(', ')}`
        );
        this.logger.debug(`🔧 DEBUG: start method type: ${typeof this.dragMonitor.start}`);
      }
      this.logger.info('✅ Native drag monitor initialized');
    } catch (error: unknown) {
      this.logger.error('❌ FATAL: Native drag monitor could not be initialized');
      this.logger.error('Error:', error instanceof Error ? error.message : String(error));
      this.logger.error('');
      this.logger.error('To fix:');
      this.logger.error('1. Rebuild native modules: npm run rebuild:native');
      this.logger.error('2. Grant accessibility permissions in System Settings');
      this.logger.error('3. Restart the application');
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Set up mouse batcher handlers
    this.mouseBatcher.on('batch', (batchedEvent: BatchedEvent) => {
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
      this.logger.info('🔄 Shake detected!', {
        isDragging: this.isDragging,
        intensity: event.intensity,
        directionChanges: event.directionChanges,
      });
      if (this.isDragging) {
        this.handleDragShake(event);
      } else {
        this.logger.info('⏸️ Shake ignored - not dragging');
        this.logger.debug('⏸️ Shake ignored - not dragging');
      }
    });

    // Handle native drag events
    if (this.dragMonitor) {
      this.logger.debug('Setting up drag monitor event handlers');

      this.dragMonitor.on('dragStart', (items: DraggedItem[]) => {
        this.logger.debug('Received dragStart event with', items.length, 'items');
        this.handleDragStart(items);
      });

      // Listen for actual drag events from native monitor

      this.dragMonitor.on('dragging', (items: DraggedItem[]) => {
        this.updateDraggedItems(items);
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
    this.logger.info('📁 Drag ended');

    // PERFORMANCE OPTIMIZATION: Stop shake detection when not dragging
    this.logger.debug('⏸️ Stopping shake detection (drag ended)');
    this.shakeDetector.stop();

    this.isDragging = false;
    this.draggedItems = [];

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

    // Debug logging to trace position structure (very minimal)
    if (Math.random() < 0.001) {
      // 0.1% chance to avoid spam
      this.logger.debug('📍 Position received during drag:', {
        x: position.x,
        y: position.y,
        isDragging: this.isDragging,
      });
    }
    // Use batcher instead of direct processing to reduce CPU usage
    this.mouseBatcher.addPosition(position);
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
