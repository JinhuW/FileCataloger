/**
 * @fileoverview Native drag monitoring factory for FileCataloger
 *
 * This module provides drag operation detection with platform-specific implementations:
 *
 * Supported platforms:
 * - macOS (darwin) with NSPasteboard - polling-based implementation
 * - Windows (win32) with OLE/COM APIs - low-level hook implementation
 *
 * Planned support:
 * - Linux (linux) with X11/Wayland APIs
 *
 * Usage:
 * ```typescript
 * const monitor = createDragMonitor();
 * if (monitor) {
 *   monitor.start();
 *   monitor.on('dragStart', (items) => console.log('Drag started:', items));
 *   monitor.on('dragEnd', () => console.log('Drag ended'));
 * }
 * ```
 *
 * @module drag-monitor
 */

import { createLogger } from '@main/modules/utils/logger';

const logger = createLogger('DragMonitorFactory');

// Define a common interface for drag monitors
export interface DragMonitor {
  start(): boolean;
  stop(): boolean;
  isDragging(): boolean;
  isMonitoring(): boolean;
  getDraggedItems(): DraggedItem[];
  destroy(): void;
  on(event: 'dragStart', listener: (items: DraggedItem[]) => void): this;
  on(event: 'dragging', listener: (items: DraggedItem[]) => void): this;
  on(event: 'dragEnd', listener: () => void): this;
  on(event: 'started', listener: () => void): this;
  on(event: 'stopped', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  emit(event: string, ...args: unknown[]): boolean;
}

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

/**
 * Factory function to create appropriate drag monitor for the current platform
 */
export function createDragMonitor(): DragMonitor | null {
  const platform = process.platform;

  switch (platform) {
    case 'darwin': {
      try {
        // Dynamically import macOS monitor to avoid loading Windows-specific code
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { MacDragMonitor } = require('./dragMonitor');
        const monitor = new MacDragMonitor();
        logger.info('Successfully initialized macOS drag monitor');
        return monitor;
      } catch (error) {
        logger.error('Failed to initialize macOS drag monitor:', error);
        return null;
      }
    }

    case 'win32': {
      try {
        // Dynamically import Windows monitor to avoid loading macOS-specific code
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { WindowsDragMonitor } = require('./dragMonitorWin');
        const monitor = new WindowsDragMonitor();
        logger.info('Successfully initialized Windows drag monitor');
        return monitor;
      } catch (error) {
        logger.error('Failed to initialize Windows drag monitor:', error);
        return null;
      }
    }

    case 'linux':
      // Native Linux drag monitor not yet implemented
      logger.warn('Linux drag monitor not yet implemented');
      return null;

    default:
      logger.warn(`Unsupported platform: ${platform}. Drag monitoring not available.`);
      return null;
  }
}

/**
 * Check if native module is available for current platform
 */
export function isNativeModuleAvailable(): boolean {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { isNativeModuleAvailable: macCheck } = require('./dragMonitor');
      return macCheck();
    } else if (platform === 'win32') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { isNativeModuleAvailable: winCheck } = require('./dragMonitorWin');
      return winCheck();
    }
  } catch {
    return false;
  }

  return false;
}

// Re-export platform-specific classes for direct use if needed
export function getMacDragMonitor(): typeof import('./dragMonitor').MacDragMonitor | null {
  if (process.platform === 'darwin') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./dragMonitor').MacDragMonitor;
  }
  return null;
}

export function getWindowsDragMonitor():
  | typeof import('./dragMonitorWin').WindowsDragMonitor
  | null {
  if (process.platform === 'win32') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./dragMonitorWin').WindowsDragMonitor;
  }
  return null;
}

// For backward compatibility, export MacDragMonitor type alias
export type MacDragMonitor = DragMonitor;
