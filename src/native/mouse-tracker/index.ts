/**
 * @fileoverview High-performance mouse tracker for FileCataloger
 *
 * This module provides optimized mouse tracking for macOS using CGEventTap with
 * advanced performance optimizations including event batching, memory pooling,
 * and intelligent throttling.
 *
 * Currently supports:
 * - macOS (darwin) with CGEventTap - highly optimized C++ implementation
 *
 * Planned support:
 * - Windows (win32) with Win32 APIs
 * - Linux (linux) with X11/Wayland APIs
 *
 * Usage:
 * ```typescript
 * const tracker = createMouseTracker();
 * tracker.start();
 * tracker.on('position', (position) => console.log(position));
 * tracker.on('buttonStateChange', (state) => console.log(state));
 * ```
 *
 * @module mouse-tracker
 */

import { MouseTracker as IMouseTracker } from '@shared/types';
import { MacOSMouseTracker } from './mouseTracker';
import { createLogger } from '@main/modules/utils/logger';

const logger = createLogger('MouseTrackerFactory');

/**
 * Factory function to create appropriate mouse tracker for the current platform
 */
export function createMouseTracker(): IMouseTracker {
  const platform = process.platform;

  switch (platform) {
    case 'darwin': {
      try {
        // Use optimized native macOS tracker with event batching and memory pooling
        const tracker = new MacOSMouseTracker();
        logger.info('Successfully initialized optimized macOS mouse tracker');
        return tracker;
      } catch (error) {
        logger.error('Failed to initialize optimized mouse tracker:', error);
        throw new Error(
          `Failed to initialize macOS mouse tracker: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    case 'win32': {
      try {
        // Use optimized native Windows tracker with event batching and memory pooling
        const { WindowsMouseTracker } = require('./windowsMouseTracker');
        const tracker = new WindowsMouseTracker();
        logger.info('Successfully initialized optimized Windows mouse tracker');
        return tracker;
      } catch (error) {
        logger.error('Failed to initialize Windows mouse tracker:', error);
        throw new Error(
          `Failed to initialize Windows mouse tracker: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    case 'linux':
      // Native Linux tracker not yet implemented
      throw new Error('Linux native tracker not yet implemented. Platform not supported.');

    default:
      throw new Error(`Unsupported platform: ${platform}. Supported platforms: darwin (macOS), win32 (Windows)`);
  }
}

// Export the main tracker classes for direct use if needed
export { MacOSMouseTracker };
export { WindowsMouseTracker } from './windowsMouseTracker';
