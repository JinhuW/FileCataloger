import { EventEmitter } from 'events';
import { MousePosition } from '@shared/types';

export interface BatchedMouseEvent {
  positions: MousePosition[];
  startTime: number;
  endTime: number;
  averagePosition: MousePosition;
  distance: number;
  velocity: number;
}

export class MouseEventBatcher extends EventEmitter {
  private batchSize: number = 5;
  private batchInterval: number = 16; // ~60fps
  private currentBatch: MousePosition[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private lastPosition: MousePosition | null = null;
  private isActive: boolean = false;

  // Adaptive batching properties
  private adaptiveBatching: boolean = true;
  private baseBatchInterval: number = 16; // Base 60fps
  private currentInterval: number = 16;
  private lastSystemLoadCheck: number = 0;
  private systemLoadCheckInterval: number = 1000; // Check every second

  constructor(batchSize: number = 5, batchInterval: number = 16, adaptiveBatching: boolean = true) {
    super();
    this.batchSize = batchSize;
    this.batchInterval = batchInterval;
    this.baseBatchInterval = batchInterval;
    this.currentInterval = batchInterval;
    this.adaptiveBatching = adaptiveBatching;
  }

  public start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.startBatchTimer();
  }

  public stop(): void {
    this.isActive = false;

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Flush any remaining batch
    if (this.currentBatch.length > 0) {
      this.processBatch();
    }
  }

  public addPosition(position: MousePosition): void {
    if (!this.isActive) return;

    // Skip if position hasn't changed significantly
    if (
      this.lastPosition &&
      Math.abs(position.x - this.lastPosition.x) < 1 &&
      Math.abs(position.y - this.lastPosition.y) < 1
    ) {
      return;
    }

    this.currentBatch.push(position);
    this.lastPosition = position;

    // Process batch if it reaches the size limit
    if (this.currentBatch.length >= this.batchSize) {
      this.processBatch();
    }
  }

  private startBatchTimer(): void {
    if (this.batchTimer) return;

    this.batchTimer = setInterval(() => {
      // Check for adaptive batching adjustment
      if (this.adaptiveBatching) {
        this.checkAndAdjustBatchingRate();
      }

      if (this.currentBatch.length > 0) {
        this.processBatch();
      }
    }, this.currentInterval);
  }

  private processBatch(): void {
    if (this.currentBatch.length === 0) return;

    const batch = [...this.currentBatch];
    this.currentBatch = [];

    // Calculate batch statistics
    const startTime = batch[0].timestamp;
    const endTime = batch[batch.length - 1].timestamp;

    // Calculate average position
    const sumX = batch.reduce((sum, pos) => sum + pos.x, 0);
    const sumY = batch.reduce((sum, pos) => sum + pos.y, 0);
    const averagePosition: MousePosition = {
      x: sumX / batch.length,
      y: sumY / batch.length,
      timestamp: endTime,
      leftButtonDown: batch[batch.length - 1].leftButtonDown,
    };

    // Calculate total distance
    let distance = 0;
    for (let i = 1; i < batch.length; i++) {
      const dx = batch[i].x - batch[i - 1].x;
      const dy = batch[i].y - batch[i - 1].y;
      distance += Math.sqrt(dx * dx + dy * dy);
    }

    // Calculate velocity (pixels per second)
    const timeDelta = (endTime - startTime) / 1000;
    const velocity = timeDelta > 0 ? distance / timeDelta : 0;

    const batchedEvent: BatchedMouseEvent = {
      positions: batch,
      startTime,
      endTime,
      averagePosition,
      distance,
      velocity,
    };

    // Emit the batched event
    this.emit('batch', batchedEvent);

    // Also emit the last position for immediate updates
    this.emit('position', batch[batch.length - 1]);
  }

  /**
   * Check system load and adjust batching rate accordingly
   */
  private checkAndAdjustBatchingRate(): void {
    const now = Date.now();
    if (now - this.lastSystemLoadCheck < this.systemLoadCheckInterval) {
      return;
    }

    this.lastSystemLoadCheck = now;

    // Get system load metrics
    const systemLoad = this.getSystemLoad();
    this.adjustBatchingRate(systemLoad);
  }

  /**
   * Get approximated system load based on available metrics
   */
  private getSystemLoad(): number {
    try {
      // Use process.cpuUsage() to estimate load
      const cpuUsage = process.cpuUsage();
      const totalCpuTime = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

      // Simple load approximation: if CPU time is high relative to elapsed time
      // This is a rough estimate since we don't have direct system load access
      const memoryUsage = process.memoryUsage();
      const memoryLoad = memoryUsage.heapUsed / memoryUsage.heapTotal;

      // Combine CPU and memory indicators (weighted toward memory)
      return Math.min(1.0, memoryLoad * 0.7 + Math.min(totalCpuTime / 1000, 1.0) * 0.3);
    } catch (error) {
      // Fallback to low load if we can't determine system state
      return 0.3;
    }
  }

  /**
   * Adjust batching rate based on system load
   */
  private adjustBatchingRate(systemLoad: number): void {
    let newInterval = this.baseBatchInterval;

    if (systemLoad > 0.8) {
      // High load: reduce frequency to 30fps
      newInterval = Math.min(33, this.baseBatchInterval * 2);
    } else if (systemLoad > 0.6) {
      // Medium load: reduce to 45fps
      newInterval = Math.min(22, this.baseBatchInterval * 1.4);
    } else if (systemLoad < 0.3) {
      // Low load: maintain 60fps or slightly higher
      newInterval = this.baseBatchInterval;
    }

    // Only restart timer if interval changed significantly
    if (Math.abs(newInterval - this.currentInterval) > 2) {
      this.currentInterval = newInterval;

      // Restart timer with new interval
      if (this.batchTimer && this.isActive) {
        clearInterval(this.batchTimer);
        this.batchTimer = setInterval(() => {
          if (this.adaptiveBatching) {
            this.checkAndAdjustBatchingRate();
          }
          if (this.currentBatch.length > 0) {
            this.processBatch();
          }
        }, this.currentInterval);
      }
    }
  }

  /**
   * Enable or disable adaptive batching
   */
  public setAdaptiveBatching(enabled: boolean): void {
    this.adaptiveBatching = enabled;
    if (!enabled) {
      this.currentInterval = this.baseBatchInterval;
    }
  }

  /**
   * Get current batching metrics
   */
  public getBatchingMetrics(): {
    currentInterval: number;
    baseBatchInterval: number;
    adaptiveBatching: boolean;
    systemLoad: number;
  } {
    return {
      currentInterval: this.currentInterval,
      baseBatchInterval: this.baseBatchInterval,
      adaptiveBatching: this.adaptiveBatching,
      systemLoad: this.getSystemLoad(),
    };
  }

  public destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}
