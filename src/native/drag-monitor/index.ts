import { EventEmitter } from 'events';
import path from 'path';

export interface DragData {
  type: 'files' | 'text' | 'image' | 'unknown';
  files?: Array<{ path: string; name: string }>;
  text?: string;
  timestamp: number;
}

export interface DragMonitorOptions {
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragData?: (data: DragData) => void;
}

export class NativeDragMonitor extends EventEmitter {
  private nativeModule: any;
  private monitor: any;
  private isMonitoring: boolean = false;

  constructor() {
    super();
    try {
      // Direct require for the native module
      this.nativeModule = require('./build/Release/drag_monitor_darwin.node');
      console.log('[NativeDragMonitor] Native module loaded successfully');
    } catch (error) {
      console.error('[NativeDragMonitor] Failed to load native module:', error);
      throw error;
    }
  }

  public start(options?: DragMonitorOptions): boolean {
    if (this.isMonitoring) {
      return true;
    }

    try {
      const callbacks = {
        onDragStart: () => {
          console.log('[NativeDragMonitor] Drag started');
          this.emit('drag-start');
          options?.onDragStart?.();
        },
        onDragEnd: () => {
          console.log('[NativeDragMonitor] Drag ended');
          this.emit('drag-end');
          options?.onDragEnd?.();
        },
        onDragData: (data: DragData) => {
          console.log('[NativeDragMonitor] Drag data received:', data);
          this.emit('drag-data', data);
          options?.onDragData?.(data);
        }
      };

      this.monitor = new this.nativeModule.DarwinDragMonitor(callbacks);
      const success = this.monitor.start();

      if (success) {
        this.isMonitoring = true;
        console.log('[NativeDragMonitor] Started monitoring');
      } else {
        console.error('[NativeDragMonitor] Failed to start monitoring');
      }

      return success;
    } catch (error) {
      console.error('[NativeDragMonitor] Error starting monitor:', error);
      return false;
    }
  }

  public stop(): boolean {
    if (!this.isMonitoring || !this.monitor) {
      return false;
    }

    try {
      const success = this.monitor.stop();
      if (success) {
        this.isMonitoring = false;
        this.monitor = null;
        console.log('[NativeDragMonitor] Stopped monitoring');
      }
      return success;
    } catch (error) {
      console.error('[NativeDragMonitor] Error stopping monitor:', error);
      return false;
    }
  }

  public isActive(): boolean {
    return this.isMonitoring && this.monitor?.isMonitoring?.() === true;
  }

  public destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}

export function createNativeDragMonitor(): NativeDragMonitor | null {
  if (process.platform !== 'darwin') {
    console.warn('[NativeDragMonitor] Native drag monitoring is only available on macOS');
    return null;
  }

  try {
    return new NativeDragMonitor();
  } catch (error) {
    console.error('[NativeDragMonitor] Failed to create native drag monitor:', error);
    return null;
  }
}