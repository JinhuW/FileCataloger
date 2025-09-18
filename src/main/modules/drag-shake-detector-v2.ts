import { EventEmitter } from 'events';
import { AdvancedShakeDetector } from './shake-detector';
import { createLogger, Logger } from './logger';
import { MousePosition } from '../../shared/types';
import { MacDragMonitor, createDragMonitor } from '../../native/drag-monitor/index';
import { MouseEventBatcher } from './mouse-event-batcher';

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

  constructor() {
    super();
    this.logger = createLogger('DragShakeDetector');

    // Initialize mouse event batcher to reduce CPU usage
    this.mouseBatcher = new MouseEventBatcher(10, 33); // Batch 10 events or every 33ms (~30fps)

    // Initialize shake detector with very easy sensitivity for testing
    this.shakeDetector = new AdvancedShakeDetector();
    this.shakeDetector.configure({
      minDirectionChanges: 2,     // Require at least 2 direction changes
      timeWindow: 600,            // 600ms to complete shake
      minDistance: 10,            // Minimum movement to avoid accidental triggers
      debounceTime: 300           // Longer debounce to prevent spam
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
      this.logger.info('✅ Native drag monitor initialized');
    } catch (error: any) {
      this.logger.error('❌ FATAL: Native drag monitor could not be initialized');
      this.logger.error('Error:', error.message);
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
    this.mouseBatcher.on('batch', (batchedEvent: any) => {
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
    this.shakeDetector.on('shake', (event) => {
      this.logger.debug('🌟 Shake event detected', {
        isDragging: this.isDragging,
        intensity: event.intensity,
        directionChanges: event.directionChanges
      });
      this.logger.info('🔄 Shake detected!', {
        isDragging: this.isDragging,
        intensity: event.intensity,
        directionChanges: event.directionChanges
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
      console.log('📡 Setting up drag monitor event handlers');

      this.dragMonitor.on('dragStart', (items: DraggedItem[]) => {
        console.log('📡 Received dragStart event with', items.length, 'items');
        this.handleDragStart(items);
      });

      this.dragMonitor.on('dragging', (items: DraggedItem[]) => {
        this.updateDraggedItems(items);
      });

      this.dragMonitor.on('dragEnd', () => {
        console.log('📡 Received dragEnd event');
        this.handleDragEnd();
      });

      this.dragMonitor.on('error', (error: any) => {
        this.logger.error('Native monitor error:', error);
      });

      console.log('✅ Drag monitor event handlers registered');
    } else {
      console.error('❌ No drag monitor to attach events to!');
    }
  }

  private handleDragStart(items: DraggedItem[]): void {
    this.isDragging = true;
    this.draggedItems = items;

    this.logger.info('📎 File drag started:', {
      count: items.length,
      files: items.map(i => i.name)
    });

    // Don't show shelf yet - wait for shake!
    this.logger.info('⏳ Shake mouse to show shelf...');
    console.log('🎯 DragShakeDetector: File drag started, waiting for shake...');
  }

  private updateDraggedItems(items: DraggedItem[]): void {
    if (this.isDragging && items.length > 0) {
      this.draggedItems = items;
      this.logger.debug(`📁 Updated: ${items.length} files`);
    }
  }

  private handleDragShake(shakeEvent: any): void {
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
      directionChanges: shakeEvent.directionChanges
    });

    // Emit the drag-shake event to show shelf
    this.emit('dragShake', {
      type: 'drag-shake',
      isDragging: true,
      items: this.draggedItems,
      shakeIntensity: shakeEvent.intensity,
      directionChanges: shakeEvent.directionChanges,
      timestamp: now
    } as DragShakeEvent);
  }

  private handleDragEnd(): void {
    this.logger.info('📁 Drag ended');

    this.isDragging = false;
    this.draggedItems = [];

    // Don't emit dragEnd event - let shelves manage their own lifecycle
    // This prevents shelves from disappearing when dropping files
    // this.emit('dragEnd');
  }

  public async start(): Promise<void> {
    this.logger.info('Starting native drag-shake detector');

    // Start mouse batcher
    this.mouseBatcher.start();
    this.logger.info('✅ Mouse event batcher started');

    // Start shake detector
    this.shakeDetector.start();
    this.logger.info('✅ Shake detector started');

    // Start native drag monitor
    if (this.dragMonitor) {
      const success = this.dragMonitor.start();
      if (success) {
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
    this.logger.info('Stopping drag-shake detector');

    this.mouseBatcher.stop();
    this.shakeDetector.stop();

    if (this.dragMonitor) {
      this.dragMonitor.stop();
    }

    this.isDragging = false;
    this.draggedItems = [];

    this.emit('stopped');
  }

  public processPosition(position: MousePosition): void {
    // Debug logging to trace position structure (very minimal)
    if (Math.random() < 0.001) { // 0.1% chance to avoid spam
      this.logger.debug('📍 Position received:', {
        x: position.x,
        y: position.y,
        isDragging: this.isDragging
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
