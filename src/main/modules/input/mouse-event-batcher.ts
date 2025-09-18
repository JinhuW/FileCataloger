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

  constructor(batchSize: number = 5, batchInterval: number = 16) {
    super();
    this.batchSize = batchSize;
    this.batchInterval = batchInterval;
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
      if (this.currentBatch.length > 0) {
        this.processBatch();
      }
    }, this.batchInterval);
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

  public destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}
