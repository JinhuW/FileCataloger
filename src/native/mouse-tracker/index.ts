/**
 * @fileoverview Platform-agnostic mouse tracker factory
 *
 * This module provides a factory function to create the appropriate mouse tracker
 * for the current operating system. Currently only macOS is supported via CGEventTap.
 *
 * Architecture:
 * - Factory pattern for platform abstraction
 * - Returns native tracker for macOS (DarwinNativeTracker)
 * - Throws errors for unsupported platforms (Windows/Linux)
 *
 * Usage:
 * ```typescript
 * const tracker = createMouseTracker();
 * tracker.start();
 * tracker.onMouseMove((position) => console.log(position));
 * ```
 *
 * @module mouse-tracker
 */

import { MouseTracker } from '@shared/types';
// import { NodeMouseTracker } from './nodeTracker'; // Not used currently
import { DarwinNativeTracker } from './darwinNativeTracker';
import { createLogger } from '@main/modules/utils/logger';

const logger = createLogger('MouseTrackerFactory');

/**
 * Factory function to create appropriate mouse tracker for the current platform
 */
export function createMouseTracker(): MouseTracker {
  const platform = process.platform;

  switch (platform) {
    case 'darwin': {
      try {
        // Use native macOS tracker with CGEventTap (no fallback)
        const tracker = new DarwinNativeTracker();
        logger.info('Successfully initialized native macOS mouse tracker');
        return tracker;
      } catch (error) {
        logger.error('Failed to initialize Darwin native tracker:', error);
        throw new Error(
          `Failed to initialize macOS mouse tracker: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    case 'win32':
      // Native Windows tracker not yet implemented
      throw new Error('Windows native tracker not yet implemented. Platform not supported.');

    case 'linux':
      // Native Linux tracker not yet implemented
      throw new Error('Linux native tracker not yet implemented. Platform not supported.');

    default:
      throw new Error(`Unsupported platform: ${platform}. Supported platforms: darwin (macOS)`);
  }
}

export * from './baseTracker';
export * from './nodeTracker';
