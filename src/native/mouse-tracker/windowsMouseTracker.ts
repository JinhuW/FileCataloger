/**
 * @fileoverview High-performance Windows mouse tracker
 *
 * This module provides optimized mouse tracking for Windows using SetWindowsHookEx with:
 * - Event batching for 60fps performance
 * - Memory pooling to reduce allocations
 * - Button state tracking with immediate updates
 * - Comprehensive error handling and performance metrics
 *
 * Features:
 * - 60fps mouse position tracking via low-level mouse hooks
 * - Threadsafe callbacks from native to JS with batching
 * - Button state tracking (left/right mouse buttons)
 * - Performance monitoring and efficiency metrics
 * - Robust error handling
 *
 * Requirements:
 * - Windows 7+
 * - Native module built with optimized C++ implementation
 *
 * @module mouse-tracker
 */

import { EventEmitter } from 'events';
import { MouseTracker, MousePosition, PerformanceMetrics } from '@shared/types';
import { createLogger } from '@main/modules/utils/logger';
import { NativeErrorCode, getNativeErrorDescription } from '@shared/nativeErrorCodes';

const logger = createLogger('WindowsMouseTracker');

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
let nativeModule: { WindowsMouseTracker: new () => NativeMouseTracker };
try {
  nativeModule = require('./mouse_tracker_win32.node');
  logger.info('Successfully loaded optimized native Windows mouse tracker module');
} catch (error: unknown) {
  logger.error('Failed to load native Windows mouse tracker module:', error);
  throw new Error(
    `Failed to load native Windows mouse tracker module: ${error instanceof Error ? error.message : 'Unknown error'}`
  );
}

/**
 * High-performance Windows mouse tracker with event batching and memory optimization
 */
export class WindowsMouseTracker extends EventEmitter implements MouseTracker {
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
      this.nativeTracker = new nativeModule.WindowsMouseTracker();
      logger.debug('Created optimized WindowsMouseTracker instance');

      // Set up the mouse move callback with batching support
      this.nativeTracker?.onMouseMove((positionData: NativePositionData) => {
        let position: MousePosition;

        if (positionData && typeof positionData === 'object' && 'x' in positionData) {
          position = {
            x: positionData.x,
            y: positionData.y,
            timestamp: positionData.timestamp || Date.now(),
            leftButtonDown: positionData.leftButtonDown || false,
          };
        } else {
          const currentPos = this.getCurrentPosition();
          position = {
            x: currentPos.x,
            y: currentPos.y,
            timestamp: Date.now(),
            leftButtonDown: currentPos.leftButtonDown || false,
          };
        }

        this.updatePosition(position.x, position.y, position);
      });

      // Set up button state change callback
      this.nativeTracker?.onButtonStateChange((leftButton: boolean, rightButton: boolean) => {
        logger.debug(`Button state changed - Left: ${leftButton}, Right: ${rightButton}`);

        const currentPos = this.getCurrentPosition();
        const position: MousePosition = {
          x: currentPos.x,
          y: currentPos.y,
          timestamp: Date.now(),
          leftButtonDown: leftButton,
        };

        this.updatePosition(position.x, position.y, position);

        this.emit('buttonStateChange', {
          leftButtonDown: leftButton,
          rightButtonDown: rightButton,
          timestamp: Date.now(),
        });
      });

      logger.info('Optimized native Windows tracker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize native tracker:', error);
      throw new Error(`Failed to initialize native Windows tracker: ${error}`);
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
        logger.info('Windows mouse tracking started with event batching and button detection');

        // Health check
        setTimeout(() => {
          if (this.eventCount === 0) {
            logger.warn('HEALTH CHECK FAILED: No mouse events received within 2 seconds of starting');
          } else {
            logger.info(`HEALTH CHECK PASSED: ${this.eventCount} mouse events received in first 2 seconds`);
          }
        }, 2000);
      } else {
        const error = this.nativeTracker?.getLastError() ?? {
          code: NativeErrorCode.UNKNOWN_ERROR,
          message: 'Unknown error',
        };
        const errorMessage = `Failed to start native tracker: ${error.message} (Code: ${error.code})`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      logger.error('Failed to start MouseTracker:', error);
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
      logger.info('Windows mouse tracking stopped');
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
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      logger.warn('Invalid mouse position received:', { x, y });
      return;
    }

    const timestamp = Date.now();
    this.lastPosition = fullPosition || { x, y, timestamp };
    this.eventCount++;

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
   * Setup performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    this.metricsInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 1000);
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(): void {
    const now = Date.now();
    const timeDelta = now - this.lastMetricsUpdate;

    this.performanceMetrics.mouseEventFrequency =
      timeDelta > 0 ? (this.eventCount * 1000) / timeDelta : 0;

    const memUsage = process.memoryUsage();
    this.performanceMetrics.memoryUsage = memUsage.heapUsed;
    this.performanceMetrics.cpuUsage = 0;
    this.performanceMetrics.lastUpdate = now;

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

    const metrics = this.getNativePerformanceMetrics();
    if (metrics) {
      const efficiency =
        metrics.eventsProcessed > 0
          ? ((metrics.eventsBatched / metrics.eventsProcessed) * 100).toFixed(1)
          : '0';
      logger.info(
        `Final native performance metrics - Processed: ${metrics.eventsProcessed}, Batched: ${metrics.eventsBatched}, Efficiency: ${efficiency}%`
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
