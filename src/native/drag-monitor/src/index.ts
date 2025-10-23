/**
 * @fileoverview Native drag monitoring factory for FileCataloger
 *
 * This module provides drag operation detection for macOS using NSPasteboard.
 * It monitors when files are being dragged from Finder or other applications.
 *
 * Currently supports:
 * - macOS (darwin) with NSPasteboard - polling-based implementation
 *
 * Planned support:
 * - Windows (win32) with Win32 APIs
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

import { MacDragMonitor, isNativeModuleAvailable } from './dragMonitor';
import { createLogger } from '@main/modules/utils/logger';

const logger = createLogger('DragMonitorFactory');

/**
 * Factory function to create appropriate drag monitor for the current platform
 */
export function createDragMonitor(): MacDragMonitor | null {
  const platform = process.platform;

  switch (platform) {
    case 'darwin': {
      try {
        // Use native macOS drag monitor with NSPasteboard polling
        const monitor = new MacDragMonitor();
        logger.info('Successfully initialized macOS drag monitor');
        return monitor;
      } catch (error) {
        logger.error('Failed to initialize macOS drag monitor:', error);
        // Return null instead of throwing to allow graceful degradation
        return null;
      }
    }

    case 'win32':
      // Native Windows drag monitor not yet implemented
      logger.warn('Windows drag monitor not yet implemented');
      return null;

    case 'linux':
      // Native Linux drag monitor not yet implemented
      logger.warn('Linux drag monitor not yet implemented');
      return null;

    default:
      logger.warn(`Unsupported platform: ${platform}. Drag monitoring not available.`);
      return null;
  }
}

// Export types and classes for direct use if needed
export { MacDragMonitor, isNativeModuleAvailable };
export type { DraggedItem, DragEvent } from './dragMonitor';
