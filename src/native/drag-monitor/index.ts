import { EventEmitter } from 'events';
import * as path from 'path';
import { createLogger } from '@main/modules/utils/logger';

const logger = createLogger('DragMonitor');

export interface DraggedItem {
  path: string;
  name: string;
  type?: 'file' | 'folder';
  isDirectory?: boolean;
  isFile?: boolean;
  size?: number;
  extension?: string;
  exists?: boolean;
}

export interface DragEvent {
  isDragging: boolean;
  items: DraggedItem[];
}

// Direct require for the native module - webpack will handle this as an external
let nativeModule: any = null;

try {
  // Since webpack copies the module to dist/main, we can require it directly
  // The webpack externals configuration will handle the correct path resolution
  nativeModule = require('./drag_monitor_darwin.node');
  logger.info('Successfully loaded drag monitor native module');
} catch (error) {
  // Native module not available - will be handled gracefully
  logger.info('Drag monitor native module not available - using fallback');
}

export class MacDragMonitor extends EventEmitter {
  private nativeMonitor: any = null;
  private isMonitoring: boolean = false;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private wasActiveDrag: boolean = false;
  private pollCount: number = 0;

  constructor() {
    super();
    this.initializeNativeMonitor();
  }

  private initializeNativeMonitor(): void {
    if (!nativeModule) {
      throw new Error(
        'Native drag monitor module not available. Run: cd src/native/drag-monitor && node-gyp rebuild'
      );
    }

    if (!nativeModule.DarwinDragMonitor) {
      throw new Error('DarwinDragMonitor class not found in native module');
    }

    try {
      // Create native monitor instance without callbacks (using polling instead)
      this.nativeMonitor = new nativeModule.DarwinDragMonitor();

      logger.info('✅ Native DarwinDragMonitor instance created successfully');
    } catch (error: any) {
      logger.error('❌ Failed to initialize native drag monitor:', error);
      logger.error('Error details:', error.message);
      throw error;
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }

    // Poll at 60fps (16ms) for responsive drag detection
    this.pollingInterval = setInterval(() => {
      if (!this.nativeMonitor) {
        return;
      }

      this.pollCount++;

      try {
        const hasActiveDrag = this.nativeMonitor.hasActiveDrag();

        // Log every 60 polls (about once per second)
        if (this.pollCount % 60 === 0) {
          logger.debug(
            `🔍 Drag monitor polling #${this.pollCount}: hasActiveDrag=${hasActiveDrag}`
          );
        }

        if (hasActiveDrag && !this.wasActiveDrag) {
          // Drag just started
          const files = this.nativeMonitor.getDraggedFiles();
          logger.info('🎯 Native drag started via polling', { fileCount: files.length });

          const items: DraggedItem[] = files.map((file: any) => ({
            path: file.path,
            name: file.name || path.basename(file.path),
            type: file.type as 'file' | 'folder',
            isDirectory: file.isDirectory,
            isFile: file.isFile,
            size: file.size,
            extension: file.extension,
            exists: file.exists,
          }));

          logger.debug(`📂 Processing ${items.length} dragged items`);
          items.forEach(item => {
            logger.debug(`  - ${item.type}: ${item.name}`);
          });

          this.emit('dragStart', items);
          this.emit('dragging', items);
        } else if (!hasActiveDrag && this.wasActiveDrag) {
          // Drag just ended
          logger.info('🛑 Native drag ended via polling');
          this.emit('dragEnd');
        }

        this.wasActiveDrag = hasActiveDrag;
      } catch (error) {
        logger.error('❌ Error during drag polling:', error);
      }
    }, 16);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.wasActiveDrag = false;
    }
  }

  public start(): boolean {
    if (this.isMonitoring) {
      return false;
    }

    if (!this.nativeMonitor) {
      return false;
    }

    try {
      const result = this.nativeMonitor.start();
      if (result) {
        this.isMonitoring = true;
        this.startPolling();
        this.emit('started');
        logger.info('✅ Native drag monitor started successfully with polling');
      } else {
        logger.warn('⚠️ Native drag monitor failed to start - may need accessibility permissions');
      }
      return result;
    } catch (error) {
      logger.error('❌ Failed to start drag monitor:', error);
      this.emit('error', error);
      return false;
    }
  }

  public stop(): boolean {
    if (!this.isMonitoring) {
      return false;
    }

    if (!this.nativeMonitor) {
      return false;
    }

    try {
      this.stopPolling();
      const result = this.nativeMonitor.stop();
      if (result) {
        this.isMonitoring = false;
        this.emit('stopped');
      }
      return result;
    } catch (error) {
      logger.error('❌ Failed to stop drag monitor:', error);
      this.emit('error', error);
      return false;
    }
  }

  public isDragging(): boolean {
    return this.nativeMonitor?.isMonitoring() || false;
  }

  public getDraggedItems(): DraggedItem[] {
    return [];
  }

  public destroy(): void {
    if (this.isMonitoring) {
      this.stop();
    }

    this.stopPolling();
    this.nativeMonitor = null;
    this.removeAllListeners();
  }
}

export function createDragMonitor(): MacDragMonitor | null {
  try {
    return new MacDragMonitor();
  } catch (error) {
    logger.error('❌ Could not create MacDragMonitor:', error);
    return null;
  }
}

export function isNativeModuleAvailable(): boolean {
  return nativeModule !== null && nativeModule.DarwinDragMonitor !== undefined;
}
