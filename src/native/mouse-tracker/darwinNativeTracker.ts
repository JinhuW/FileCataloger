/**
 * @fileoverview macOS native mouse tracker implementation
 *
 * This module wraps the native macOS mouse tracking functionality provided by
 * the C++ addon (mouse_tracker_darwin.node). It uses CGEventTap for high-performance,
 * system-wide mouse tracking.
 *
 * Key features:
 * - 60fps mouse position tracking via CGEventTap
 * - Threadsafe callbacks from native to JS
 * - Button state tracking (left/right mouse buttons)
 * - Fallback polling for position queries
 *
 * Requirements:
 * - macOS 10.15+
 * - Accessibility permissions granted by user
 * - Native module built with node-gyp
 *
 * Performance considerations:
 * - Events are processed on a separate thread
 * - Callbacks are batched to avoid overwhelming JS thread
 * - Minimal CPU usage (~1-2% when active)
 *
 * @module darwin-native-tracker
 */

import { BaseMouseTracker } from './baseTracker';
import { MousePosition } from '@shared/types';
import { createLogger } from '@main/modules/utils/logger';
import { NativeErrorCode, getNativeErrorDescription } from '@shared/nativeErrorCodes';

const logger = createLogger('DarwinNativeTracker');

// Direct require for the native module - webpack will handle this as an external
let nativeModule: any;
try {
  // Since webpack copies the module to dist/main, we can require it directly
  // The webpack externals configuration will handle the correct path resolution
  nativeModule = require('./mouse_tracker_darwin.node');
  logger.info('Successfully loaded native mouse tracker module');
} catch (error: any) {
  logger.error('Failed to load native mouse tracker module:', error);
  throw new Error(
    `Failed to load native mouse tracker module: ${error?.message || 'Unknown error'}`
  );
}

/**
 * Native macOS mouse tracker using Core Graphics
 */
interface NativeError {
  code: number;
  message: string;
}

interface NativeMouseTracker {
  start(): boolean;
  stop(): void;
  onMouseMove(callback: (position: any) => void): void;
  onButtonStateChange(callback: (leftButton: boolean, rightButton: boolean) => void): void;
  getLastError(): NativeError;
}

export class DarwinNativeTracker extends BaseMouseTracker {
  private nativeTracker: NativeMouseTracker | null = null;

  constructor() {
    super();

    try {
      // Create the tracker instance
      this.nativeTracker = new nativeModule.MacOSMouseTracker();
      logger.debug('Created MacOSMouseTracker instance');

      // Set up the mouse move callback
      // The native module passes a position object as the first parameter
      this.nativeTracker?.onMouseMove((...args: any[]) => {
        const positionData = args[0];
        // Handle both old format (4 params) and new format (position object)
        let position: MousePosition;

        if (typeof positionData === 'object' && positionData.x !== undefined) {
          // New format: position object from native module
          position = {
            x: positionData.x,
            y: positionData.y,
            timestamp: positionData.timestamp || Date.now(),
            leftButtonDown: positionData.leftButtonDown || false,
          };
        } else {
          // Old format: separate parameters (for backwards compatibility)
          const x = args[0] as number;
          const y = args[1] as number;
          const leftButton = args[2] as boolean;
          position = {
            x,
            y,
            timestamp: Date.now(),
            leftButtonDown: leftButton,
          };
        }

        // Log button state changes for debugging
        const currentPos = this.getCurrentPosition();
        if (currentPos.leftButtonDown !== position.leftButtonDown) {
          logger.debug(`🖱️ Left button ${position.leftButtonDown ? 'pressed' : 'released'}`);
        }

        this.updatePosition(position.x, position.y, position);
      });

      // Set up button state change callback
      this.nativeTracker?.onButtonStateChange((leftButton: boolean, rightButton: boolean) => {
        logger.debug(`🎯 Button state changed - Left: ${leftButton}, Right: ${rightButton}`);

        // Update current position with new button state
        const currentPos = this.getCurrentPosition();
        const position: MousePosition = {
          x: currentPos.x,
          y: currentPos.y,
          timestamp: Date.now(),
          leftButtonDown: leftButton,
        };

        this.updatePosition(position.x, position.y, position);

        // Emit button state change event
        this.emit('buttonStateChange', {
          leftButtonDown: leftButton,
          rightButtonDown: rightButton,
          timestamp: Date.now(),
        });
      });

      logger.info('Native macOS tracker initialized successfully');
    } catch (error) {
      logger.error('Failed to load native module:', error);
      throw new Error(`Failed to initialize native macOS tracker: ${error}`);
    }
  }

  /**
   * Start tracking mouse position
   */
  public start(): void {
    if (this.isActive) {
      logger.warn('DarwinNativeTracker is already tracking');
      return;
    }

    try {
      if (!this.nativeTracker) {
        throw new Error('Native tracker not initialized');
      }
      const success = this.nativeTracker.start();
      if (success) {
        this.isActive = true;
        logger.info('✅ Native macOS mouse tracking started with button detection');

        // Also start a fallback polling mechanism just in case
        this.startPolling();
      } else {
        // Get detailed error information
        const error = this.nativeTracker?.getLastError() ?? {
          code: NativeErrorCode.UNKNOWN_ERROR,
          message: 'Unknown error',
        };
        const errorMessage = `Failed to start native tracker: ${error.message} (Code: ${error.code})`;

        // Check for specific error codes
        if (error.code === NativeErrorCode.ACCESSIBILITY_PERMISSION_DENIED) {
          logger.error('⚠️ ACCESSIBILITY PERMISSION REQUIRED');
          logger.error(getNativeErrorDescription(error.code));
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      logger.error('Failed to start DarwinNativeTracker:', error);

      // Check for accessibility permission error
      if (error instanceof Error && error.message.includes('accessibility')) {
        logger.error('\n⚠️  IMPORTANT: Accessibility permission required!');
        logger.error('Please grant permission in:');
        logger.error('System Preferences > Security & Privacy > Privacy > Accessibility');
        logger.error('Add and enable your terminal or Electron app\n');

        // Emit error event
        this.emit('error', new Error('Accessibility permission required'));
      }

      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Start fallback polling for position updates
   */
  private startPolling(): void {
    // Disabled: Polling creates unnecessary CPU usage
    // Native event tap should handle all updates
    // If native tracking fails, better to show error than consume CPU
  }

  /**
   * Stop fallback polling
   */
  private stopPolling(): void {
    // Method kept for future use if polling is re-enabled
  }

  /**
   * Stop tracking mouse position
   */
  public stop(): void {
    if (!this.isActive) {
      logger.warn('DarwinNativeTracker is not tracking');
      return;
    }

    try {
      this.stopPolling();

      if (this.nativeTracker) {
        try {
          this.nativeTracker.stop();
        } catch (stopError) {
          logger.error('Error stopping native tracker:', stopError);
        }
      }

      this.isActive = false;
      logger.info('Native macOS mouse tracking stopped');
    } catch (error) {
      logger.error('Failed to stop DarwinNativeTracker:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Initialize the native tracking
   */
  protected initializeTracking(): void {
    // Handled in start()
  }

  /**
   * Cleanup the native tracking
   */
  protected cleanupTracking(): void {
    // Handled in stop()
  }

  /**
   * Cleanup resources
   */
  protected destroy(): void {
    if (this.isActive) {
      this.stop();
    }

    this.nativeTracker = null;
    super.destroy();
  }
}
