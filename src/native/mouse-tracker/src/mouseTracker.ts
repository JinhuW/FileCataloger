/**
 * @fileoverview High-performance macOS mouse tracker
 *
 * This module provides optimized mouse tracking for macOS using CGEventTap with:
 * - Event batching for 60fps performance
 * - Memory pooling to reduce allocations
 * - Button state tracking with immediate updates
 * - Comprehensive error handling and performance metrics
 *
 * Features:
 * - 60fps mouse position tracking via CGEventTap
 * - Threadsafe callbacks from native to JS with batching
 * - Button state tracking (left/right mouse buttons)
 * - Performance monitoring and efficiency metrics
 * - Robust error handling with accessibility permission detection
 *
 * Requirements:
 * - macOS 10.15+
 * - Accessibility permissions granted by user
 * - Native module built with optimized C++ implementation
 *
 * @module mouse-tracker
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import { MouseTracker, MousePosition, PerformanceMetrics } from '@shared/types';
import { createLogger } from '@main/modules/utils/logger';
import { NativeErrorCode, getNativeErrorDescription } from '@shared/nativeErrorCodes';

const logger = createLogger('MouseTracker');

// Native module interfaces
interface NativeError {
  code: number;
  message: string;
}

interface NativePerformanceMetrics {
  eventsProcessed: number;
  eventsBatched: number;
}

interface NativePositionData {
  x: number;
  y: number;
  timestamp?: number;
  leftButtonDown?: boolean;
}

interface NativeMouseTracker {
  start(): boolean;
  stop(): void;
  onMouseMove(callback: (position: NativePositionData) => void): void;
  onButtonStateChange(callback: (leftButton: boolean, rightButton: boolean) => void): void;
  getLastError(): NativeError;
  getPerformanceMetrics(): NativePerformanceMetrics;
}

// Load native module
let nativeModule: { MacOSMouseTracker: new () => NativeMouseTracker };
try {
  // Try multiple paths to find the native module
  try {
    // Development: from native module build directory
    nativeModule = require('../build/Release/mouse_tracker_darwin.node');
  } catch {
    try {
      // Production: from dist/main (webpack output)
      nativeModule = require('./mouse_tracker_darwin.node');
    } catch {
      // Asar packaged: need to convert asar path to unpacked path
      let nativePath = path.join(__dirname, 'mouse_tracker_darwin.node');
      // If running from asar, convert to .asar.unpacked path
      if (nativePath.includes('.asar')) {
        nativePath = nativePath.replace(/\.asar([/\\])/i, '.asar.unpacked$1');
      }
      nativeModule = require(nativePath);
    }
  }
  logger.info('Successfully loaded optimized native mouse tracker module');
} catch (error: unknown) {
  logger.error('Failed to load native mouse tracker module:', error);
  throw new Error(
    `Failed to load native mouse tracker module: ${error instanceof Error ? error.message : 'Unknown error'}`
  );
}

/**
 * High-performance macOS mouse tracker with event batching and memory optimization
 */
export class MacOSMouseTracker extends EventEmitter implements MouseTracker {
  private nativeTracker: NativeMouseTracker | null = null;
  private isActive: boolean = false;
  private lastPosition: MousePosition = { x: 0, y: 0, timestamp: Date.now() };
  private performanceMetrics: PerformanceMetrics = {
    mouseEventFrequency: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    lastUpdate: Date.now(),
  };

  // Performance monitoring
  private eventCount: number = 0;
  private lastMetricsUpdate: number = Date.now();
  private metricsInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.setupPerformanceMonitoring();
    this.initializeNativeTracker();
  }

  /**
   * Initialize the native tracker with optimized callbacks
   */
  private initializeNativeTracker(): void {
    try {
      // Create the optimized tracker instance
      this.nativeTracker = new nativeModule.MacOSMouseTracker();
      logger.debug('Created optimized MacOSMouseTracker instance');

      // Set up the mouse move callback with batching support
      this.nativeTracker?.onMouseMove((positionData: NativePositionData) => {
        let position: MousePosition;

        if (positionData && typeof positionData === 'object' && 'x' in positionData) {
          // New optimized format: position object from native module with batching
          position = {
            x: positionData.x,
            y: positionData.y,
            timestamp: positionData.timestamp || Date.now(),
            leftButtonDown: positionData.leftButtonDown || false,
          };
        } else {
          // Fallback format: use current position if data is invalid
          const currentPos = this.getCurrentPosition();
          position = {
            x: currentPos.x,
            y: currentPos.y,
            timestamp: Date.now(),
            leftButtonDown: currentPos.leftButtonDown || false,
          };
        }

        // Update position and emit event
        this.updatePosition(position.x, position.y, position);
      });

      // Set up button state change callback for immediate feedback
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

      logger.info('Optimized native macOS tracker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize native tracker:', error);
      throw new Error(`Failed to initialize native macOS tracker: ${error}`);
    }
  }

  /**
   * Start tracking mouse position with optimized performance
   */
  public start(): void {
    if (this.isActive) {
      logger.warn('MouseTracker is already tracking');
      return;
    }

    try {
      if (!this.nativeTracker) {
        throw new Error('Native tracker not initialized');
      }

      const success = this.nativeTracker.start();
      if (success) {
        this.isActive = true;
        logger.info(
          '✅ Optimized macOS mouse tracking started with event batching and button detection'
        );

        // Health check: Verify mouse events start flowing within 2 seconds
        setTimeout(() => {
          if (this.eventCount === 0) {
            logger.warn(
              '⚠️ HEALTH CHECK FAILED: No mouse events received within 2 seconds of starting'
            );
            logger.warn('This may indicate CGEventTap is not capturing events properly');
          } else {
            logger.info(
              `✅ HEALTH CHECK PASSED: ${this.eventCount} mouse events received in first 2 seconds`
            );
          }
        }, 2000);
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
      logger.error('Failed to start MouseTracker:', error);

      // Check for accessibility permission error
      if (error instanceof Error && error.message.includes('accessibility')) {
        logger.error('\\n⚠️  IMPORTANT: Accessibility permission required!');
        logger.error('Please grant permission in:');
        logger.error('System Preferences > Security & Privacy > Privacy > Accessibility');
        logger.error('Add and enable your terminal or Electron app\\n');

        // Emit error event
        this.emit('error', new Error('Accessibility permission required'));
      }

      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Stop tracking mouse position
   */
  public stop(): void {
    if (!this.isActive) {
      logger.warn('MouseTracker is not tracking');
      return;
    }

    try {
      if (this.nativeTracker) {
        try {
          this.nativeTracker.stop();
        } catch (stopError) {
          logger.error('Error stopping native tracker:', stopError);
        }
      }

      this.isActive = false;
      logger.info('Optimized macOS mouse tracking stopped');
    } catch (error) {
      logger.error('Failed to stop MouseTracker:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Get current mouse position
   */
  public getCurrentPosition(): MousePosition {
    return { ...this.lastPosition };
  }

  /**
   * Check if tracker is currently active
   */
  public isTracking(): boolean {
    return this.isActive;
  }

  /**
   * Get performance metrics (both JS and native)
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get native performance metrics from optimized C++ implementation
   */
  public getNativePerformanceMetrics(): NativePerformanceMetrics | null {
    if (!this.nativeTracker) {
      return null;
    }

    try {
      return this.nativeTracker.getPerformanceMetrics();
    } catch (error) {
      logger.warn('Failed to get native performance metrics:', error);
      return null;
    }
  }

  /**
   * Update mouse position and emit events
   */
  private updatePosition(x: number, y: number, fullPosition?: MousePosition): void {
    // Validate coordinates
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      logger.warn('Invalid mouse position received:', { x, y });
      return;
    }

    const timestamp = Date.now();
    // Use full position if provided (includes button state), otherwise just x, y, timestamp
    this.lastPosition = fullPosition || { x, y, timestamp };
    this.eventCount++;

    // Emit position event
    this.emit('position', this.lastPosition);
  }

  /**
   * Handle tracker errors
   */
  private handleError(error: Error): void {
    logger.error('Mouse tracker error:', error);
    this.emit('error', error);
  }

  /**
   * Setup performance monitoring for JS-side metrics
   */
  private setupPerformanceMonitoring(): void {
    // Update performance metrics every second
    this.metricsInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 1000);
  }

  /**
   * Update JS-side performance metrics
   */
  private updatePerformanceMetrics(): void {
    const now = Date.now();
    const timeDelta = now - this.lastMetricsUpdate;

    // Calculate events per second (avoid division by zero)
    this.performanceMetrics.mouseEventFrequency =
      timeDelta > 0 ? (this.eventCount * 1000) / timeDelta : 0;

    // Get memory usage
    const memUsage = process.memoryUsage();
    this.performanceMetrics.memoryUsage = memUsage.heapUsed;

    // CPU usage would require additional implementation
    this.performanceMetrics.cpuUsage = 0; // TODO: Implement CPU monitoring

    this.performanceMetrics.lastUpdate = now;

    // Reset counters
    this.eventCount = 0;
    this.lastMetricsUpdate = now;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.isActive) {
      this.stop();
    }

    // Log final performance metrics before cleanup
    const metrics = this.getNativePerformanceMetrics();
    if (metrics) {
      const efficiency =
        metrics.eventsProcessed > 0
          ? ((metrics.eventsBatched / metrics.eventsProcessed) * 100).toFixed(1)
          : '0';
      logger.info(
        `🏁 Final native performance metrics - Processed: ${metrics.eventsProcessed}, Batched: ${metrics.eventsBatched}, Efficiency: ${efficiency}%`
      );
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    this.removeAllListeners();
    this.nativeTracker = null;
    this.isActive = false;
  }
}
