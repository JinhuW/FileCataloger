/**
 * @fileoverview Windows drag monitor implementation
 *
 * This module provides the WindowsDragMonitor class that wraps the native
 * drag monitoring functionality for Windows using OLE/COM APIs.
 *
 * Features:
 * - Real-time drag detection with polling-based approach
 * - File metadata extraction (path, name, type, size)
 * - Support for multiple file selection
 * - Event-driven API with drag start/end notifications
 *
 * Architecture:
 * - Uses native C++ module for OLE clipboard and hook monitoring
 * - Polls at 10fps for responsive drag detection
 * - Emits events when drag state changes
 * - Handles errors gracefully with fallback behavior
 *
 * @module drag-monitor
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import { createLogger } from '@main/modules/utils/logger';

const logger = createLogger('WindowsDragMonitor');

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

interface NativeDragMonitor {
  start(): boolean;
  stop(): boolean;
  hasActiveDrag(): boolean;
  getDraggedFiles(): Array<{
    path: string;
    name?: string;
    type?: string;
    isDirectory?: boolean;
    isFile?: boolean;
    size?: number;
    extension?: string;
    exists?: boolean;
  }>;
  isMonitoring(): boolean;
}

interface NativeDragModule {
  WindowsDragMonitor: new () => NativeDragMonitor;
}

// Load native module
let nativeModule: NativeDragModule | null = null;

try {
  try {
    // Development: from native module build directory
    nativeModule = require('../build/Release/drag_monitor_win.node');
  } catch {
    try {
      // Production: from dist/main (webpack output)
      nativeModule = require('./drag_monitor_win.node');
    } catch {
      // Last resort: absolute path from __dirname
      nativeModule = require(path.join(__dirname, 'drag_monitor_win.node'));
    }
  }
  logger.info('Successfully loaded Windows drag monitor native module');
} catch (error) {
  logger.info('Windows drag monitor native module not available - using fallback');
}

/**
 * Windows drag monitor with polling-based detection
 */
export class WindowsDragMonitor extends EventEmitter {
  private nativeMonitor: NativeDragMonitor | null = null;
  private monitoring: boolean = false;
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
        'Windows native drag monitor module not available. Run: cd src/native/drag-monitor && node-gyp rebuild'
      );
    }

    if (!nativeModule.WindowsDragMonitor) {
      throw new Error('WindowsDragMonitor class not found in native module');
    }

    try {
      this.nativeMonitor = new nativeModule.WindowsDragMonitor();
      logger.info('Windows native drag monitor instance created successfully');
    } catch (error: unknown) {
      logger.error('Failed to initialize Windows native drag monitor:', error);
      throw error;
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }

    // Poll at 10fps (100ms) for good performance
    this.pollingInterval = setInterval(() => {
      if (!this.nativeMonitor) {
        return;
      }

      this.pollCount++;

      try {
        const hasActiveDrag = this.nativeMonitor.hasActiveDrag();

        // Log health check periodically
        if (this.pollCount % 600 === 0) {
          logger.debug(
            `Drag monitor health check: hasActiveDrag=${hasActiveDrag}, polls=${this.pollCount}`
          );
        }

        if (hasActiveDrag && !this.wasActiveDrag) {
          // Drag just started
          const files = this.nativeMonitor.getDraggedFiles();
          logger.info('Windows drag started via polling', { fileCount: files.length });

          if (files.length === 0) {
            logger.warn('Drag detected but no files found - ignoring');
            return;
          }

          const items: DraggedItem[] = files.map(file => ({
            path: file.path,
            name: file.name || path.basename(file.path),
            type: file.type as 'file' | 'folder',
            isDirectory: file.isDirectory,
            isFile: file.isFile,
            size: file.size,
            extension: file.extension,
            exists: file.exists,
          }));

          logger.debug(`Processing ${items.length} dragged items`);
          items.forEach(item => {
            logger.debug(`  - ${item.type}: ${item.name}`);
          });

          this.emit('dragStart', items);
          this.emit('dragging', items);
        } else if (!hasActiveDrag && this.wasActiveDrag) {
          // Drag just ended
          logger.info('Windows drag ended via polling');
          this.emit('dragEnd');
        }

        this.wasActiveDrag = hasActiveDrag;
      } catch (error) {
        logger.error('Error during drag polling:', error);
      }
    }, 100);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.wasActiveDrag = false;
    }
  }

  public start(): boolean {
    logger.debug('WindowsDragMonitor.start() called');
    if (this.monitoring) {
      logger.debug('Already monitoring, returning false');
      return false;
    }

    try {
      let result = false;
      if (this.nativeMonitor) {
        logger.debug('Calling nativeMonitor.start()');
        result = this.nativeMonitor.start();
        logger.debug(`nativeMonitor.start() returned: ${result}`);
      } else {
        logger.debug('No native monitor available');
        result = false;
      }

      if (result) {
        this.monitoring = true;
        this.startPolling();
        this.emit('started');
        logger.info('Windows drag monitor started successfully');
      } else {
        logger.warn('Windows drag monitor failed to start');
      }
      return result;
    } catch (error) {
      logger.error('Failed to start drag monitor:', error);
      this.emit('error', error);
      return false;
    }
  }

  public stop(): boolean {
    if (!this.monitoring) {
      return false;
    }

    if (!this.nativeMonitor) {
      return false;
    }

    try {
      this.stopPolling();
      const result = this.nativeMonitor.stop();
      if (result) {
        this.monitoring = false;
        this.emit('stopped');
      }
      return result;
    } catch (error) {
      logger.error('Failed to stop drag monitor:', error);
      this.emit('error', error);
      return false;
    }
  }

  public isDragging(): boolean {
    return this.nativeMonitor?.hasActiveDrag() || false;
  }

  public isMonitoring(): boolean {
    return this.monitoring;
  }

  public getDraggedItems(): DraggedItem[] {
    if (!this.nativeMonitor) {
      return [];
    }

    try {
      const files = this.nativeMonitor.getDraggedFiles();
      return files.map(file => ({
        path: file.path,
        name: file.name || path.basename(file.path),
        type: file.type as 'file' | 'folder',
        isDirectory: file.isDirectory,
        isFile: file.isFile,
        size: file.size,
        extension: file.extension,
        exists: file.exists,
      }));
    } catch (error) {
      logger.error('Error getting dragged items:', error);
      return [];
    }
  }

  public destroy(): void {
    if (this.monitoring) {
      this.stop();
    }

    this.stopPolling();
    this.nativeMonitor = null;
    this.removeAllListeners();
  }
}

/**
 * Check if the native module is available
 */
export function isNativeModuleAvailable(): boolean {
  return nativeModule !== null && nativeModule.WindowsDragMonitor !== undefined;
}
