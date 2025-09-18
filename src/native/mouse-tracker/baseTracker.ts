/**
 * @fileoverview Abstract base class for mouse tracker implementations
 *
 * This module provides the foundation for all mouse tracking implementations,
 * handling common functionality like event emission, performance monitoring,
 * and state management.
 *
 * Architecture:
 * - Extends EventEmitter for position/error events
 * - Tracks performance metrics (event frequency, memory usage)
 * - Maintains last known mouse position
 * - Provides common lifecycle methods (start/stop)
 *
 * Implementations must override:
 * - start(): Begin tracking mouse movements
 * - stop(): Stop tracking and cleanup resources
 * - initializeTracking(): Setup platform-specific tracking
 * - cleanupTracking(): Teardown platform-specific resources
 *
 * Events emitted:
 * - 'position': MousePosition data with x, y, timestamp, and button states
 * - 'error': Error objects from tracking failures
 *
 * @module base-tracker
 */

import { EventEmitter } from 'events';
import { MouseTracker, MousePosition, PerformanceMetrics } from '@shared/types';
import { createLogger } from '@main/modules/utils/logger';

const logger = createLogger('BaseMouseTracker');

/**
 * Base class for mouse tracking implementations
 * Provides common functionality and event handling
 */
export abstract class BaseMouseTracker extends EventEmitter implements MouseTracker {
  protected isActive: boolean = false;
  protected lastPosition: MousePosition = { x: 0, y: 0, timestamp: Date.now() };
  protected performanceMetrics: PerformanceMetrics = {
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
  }

  abstract start(): void;
  abstract stop(): void;
  protected abstract initializeTracking(): void;
  protected abstract cleanupTracking(): void;

  public getCurrentPosition(): MousePosition {
    return { ...this.lastPosition };
  }

  public isTracking(): boolean {
    return this.isActive;
  }

  protected updatePosition(x: number, y: number, fullPosition?: MousePosition): void {
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

  protected handleError(error: Error): void {
    logger.error('Mouse tracker error:', error);
    this.emit('error', error);
  }

  private setupPerformanceMonitoring(): void {
    // Update performance metrics every second
    this.metricsInterval = setInterval(() => {
      this.updatePerformanceMetrics();
    }, 1000);
  }

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

  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  protected destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    this.removeAllListeners();
    this.isActive = false;
  }
}
