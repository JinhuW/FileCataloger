import { EventEmitter } from 'events';
import { MouseTracker, MousePosition, PerformanceMetrics } from '@shared/types';

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
    lastUpdate: Date.now()
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
    const timestamp = Date.now();
    // Use full position if provided (includes button state), otherwise just x, y, timestamp
    this.lastPosition = fullPosition || { x, y, timestamp };
    this.eventCount++;
    
    // Emit position event
    this.emit('position', this.lastPosition);
  }

  protected handleError(error: Error): void {
    console.error('Mouse tracker error:', error);
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
    
    // Calculate events per second
    this.performanceMetrics.mouseEventFrequency = (this.eventCount * 1000) / timeDelta;
    
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