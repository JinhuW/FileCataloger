/**
 * @fileoverview High-performance mouse tracker for FileCataloger
 *
 * This module provides optimized mouse tracking with platform-specific
 * implementations using native APIs:
 *
 * Supported platforms:
 * - macOS (darwin) with CGEventTap - highly optimized C++ implementation
 * - Windows (win32) with SetWindowsHookEx - low-level mouse hooks
 *
 * Planned support:
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
        // Dynamically import macOS tracker to avoid loading Windows-specific code
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { MacOSMouseTracker } = require('./mouseTracker');
        const tracker = new MacOSMouseTracker();
        logger.info('Successfully initialized optimized macOS mouse tracker');
        return tracker;
      } catch (error) {
        logger.error('Failed to initialize macOS mouse tracker:', error);
        throw new Error(
          `Failed to initialize macOS mouse tracker: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    case 'win32': {
      try {
        // Dynamically import Windows tracker to avoid loading macOS-specific code
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { WindowsMouseTracker } = require('./mouseTrackerWin');
        const tracker = new WindowsMouseTracker();
        logger.info('Successfully initialized Windows mouse tracker');
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
      throw new Error(
        `Unsupported platform: ${platform}. Supported platforms: darwin (macOS), win32 (Windows)`
      );
  }
}

// Re-export platform-specific classes for direct use if needed
// These are conditionally imported to avoid cross-platform issues
export function getMacOSMouseTracker(): typeof import('./mouseTracker').MacOSMouseTracker | null {
  if (process.platform === 'darwin') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./mouseTracker').MacOSMouseTracker;
  }
  return null;
}

export function getWindowsMouseTracker():
  | typeof import('./mouseTrackerWin').WindowsMouseTracker
  | null {
  if (process.platform === 'win32') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./mouseTrackerWin').WindowsMouseTracker;
  }
  return null;
}
