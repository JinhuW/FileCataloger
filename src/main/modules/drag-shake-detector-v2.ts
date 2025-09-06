import { EventEmitter } from 'events';
import { AdvancedShakeDetector } from './shake-detector';
import { createLogger, Logger } from './logger';
import { MousePosition } from '../../shared/types';
import { MacDragMonitor, createDragMonitor } from '../../native/drag-monitor/loader';

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
  
  private isDragging: boolean = false;
  private draggedItems: DraggedItem[] = [];
  private lastDragShakeTime: number = 0;
  private dragShakeDebounce: number = 100; // ms
  
  constructor() {
    super();
    this.logger = createLogger('DragShakeDetector');
    
    // Initialize shake detector with very easy sensitivity for testing
    this.shakeDetector = new AdvancedShakeDetector();
    this.shakeDetector.configure({
      minDirectionChanges: 1,     // Very easy - just 1 direction change
      timeWindow: 800,            // 800ms to complete shake
      minDistance: 3,             // Very low minimum movement
      debounceTime: 100           // Fast debounce
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
    // Handle shake events - only process during active drag
    this.shakeDetector.on('shake', (event) => {
      console.log('🌟 SHAKE EVENT DETECTED!', {
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
        console.log('⏸️ Shake ignored - not dragging');
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
    if (now - this.lastDragShakeTime < this.dragShakeDebounce) {
      this.logger.debug('Shake debounced - too rapid');
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
    
    // Notify shelf to hide
    this.emit('dragEnd');
  }
  
  public async start(): Promise<void> {
    this.logger.info('Starting native drag-shake detector');
    console.log('🚀 DragShakeDetector.start() called');
    
    // Start shake detector
    this.shakeDetector.start();
    this.logger.info('✅ Shake detector started');
    
    // Start native drag monitor
    if (this.dragMonitor) {
      console.log('🔧 Starting native drag monitor...');
      const success = this.dragMonitor.start();
      if (success) {
        this.logger.info('✅ System ready');
        this.logger.info('📝 Instructions:');
        this.logger.info('   1. Drag files from Finder');
        this.logger.info('   2. Shake mouse while dragging');
        this.logger.info('   3. Drop files on shelf');
        console.log('✅ DragShakeDetector fully started and listening for events');
      } else {
        this.logger.error('❌ Failed to start native drag monitor');
        console.error('❌ Failed to start native drag monitor');
      }
    } else {
      console.error('❌ No drag monitor available!');
    }
    
    this.emit('started');
  }
  
  public stop(): void {
    this.logger.info('Stopping drag-shake detector');
    
    this.shakeDetector.stop();
    
    if (this.dragMonitor) {
      this.dragMonitor.stop();
    }
    
    this.isDragging = false;
    this.draggedItems = [];
    
    this.emit('stopped');
  }
  
  public processPosition(position: MousePosition): void {
    // Debug logging to trace position structure
    if (Math.random() < 0.01) { // 1% chance to avoid spam
      console.log('📍 DragShakeDetector received position:', {
        x: position.x,
        y: position.y,
        timestamp: position.timestamp,
        leftButtonDown: position.leftButtonDown,
        typeOfX: typeof position.x,
        typeOfY: typeof position.y
      });
    }
    
    // Only log during drag to avoid spam
    if (this.isDragging && Math.random() < 0.1) { // 10% chance during drag
      console.log('🎯 DragShakeDetector: Processing position during drag', position);
    }
    this.shakeDetector.processPosition(position);
  }
  
  public destroy(): void {
    this.stop();
    
    this.shakeDetector.destroy();
    
    if (this.dragMonitor) {
      this.dragMonitor.destroy();
    }
    
    this.removeAllListeners();
  }
}