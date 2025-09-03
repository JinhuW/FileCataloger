import { EventEmitter } from 'events';
import { ShakeDetector, ShakeDetectionConfig, MousePosition, Vector2D } from '@shared/types';

/**
 * Advanced shake detection algorithm with ring buffer and vector pooling
 * 
 * Detects rapid back-and-forth cursor movements that indicate user intent
 * to activate the shelf system
 */
export class AdvancedShakeDetector extends EventEmitter implements ShakeDetector {
  // Default configuration - much more sensitive for easier shake detection
  private config: ShakeDetectionConfig = {
    minDirectionChanges: 2,     // Only 2 direction changes needed (was 4)
    timeWindow: 600,            // Increased time window for easier detection
    minDistance: 5,             // Very low minimum distance (was 8)
    debounceTime: 300           // Faster debounce for quicker re-triggering
  };

  // Ring buffer for efficient position history
  private readonly BUFFER_SIZE = 100;
  private positionBuffer: MousePosition[] = [];
  private bufferIndex: number = 0;
  private bufferFull: boolean = false;

  // Vector pool for GC optimization
  private readonly VECTOR_POOL_SIZE = 100;
  private vectorPool: Vector2D[] = [];

  // Detection state
  private isActive: boolean = false;
  private lastShakeTime: number = 0;

  // Analytics
  private analytics = {
    totalShakes: 0,
    falsePositives: 0,
    avgDirectionChanges: 0,
    avgShakeIntensity: 0,
    maxVelocity: 0
  };

  constructor() {
    super();
    this.initializeVectorPool();
  }

  public configure(config: Partial<ShakeDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public start(): void {
    if (this.isActive) {
      console.warn('ShakeDetector is already active');
      return;
    }

    this.isActive = true;
    this.resetDetectionState();
  }

  public stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
  }

  /**
   * Process mouse position update
   */
  public processPosition(position: MousePosition): void {
    if (!this.isActive) {
      return;
    }

    // Since fallback tracker doesn't have button state, process all movements
    // This allows shake detection to work when dragging files
    
    // Add to ring buffer
    this.addToBuffer(position);

    // Analyze recent movement for shake pattern
    this.analyzeMovement();
  }

  /**
   * Add position to ring buffer
   */
  private addToBuffer(position: MousePosition): void {
    this.positionBuffer[this.bufferIndex] = { ...position };
    this.bufferIndex = (this.bufferIndex + 1) % this.BUFFER_SIZE;
    
    if (this.bufferIndex === 0) {
      this.bufferFull = true;
    }
  }

  /**
   * Get positions within time window
   */
  private getRecentPositions(timeWindow: number): MousePosition[] {
    const now = Date.now();
    const cutoffTime = now - timeWindow;
    const positions: MousePosition[] = [];

    const bufferLength = this.bufferFull ? this.BUFFER_SIZE : this.bufferIndex;
    
    for (let i = 0; i < bufferLength; i++) {
      const index = (this.bufferIndex - 1 - i + this.BUFFER_SIZE) % this.BUFFER_SIZE;
      const pos = this.positionBuffer[index];
      
      if (pos && pos.timestamp >= cutoffTime) {
        positions.push(pos);
      } else {
        break; // Positions are in reverse chronological order
      }
    }

    return positions.reverse(); // Return in chronological order
  }

  /**
   * Analyze movement pattern for shake detection
   */
  private analyzeMovement(): void {
    const positions = this.getRecentPositions(this.config.timeWindow);
    
    if (positions.length < 4) {
      return; // Need at least 4 positions to detect direction changes
    }

    // Calculate direction changes
    let directionChanges = 0;
    let lastDirection: Vector2D | null = null;
    let totalDistance = 0;
    let maxVelocity = 0;

    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1];
      const curr = positions[i];
      
      const direction = this.getVector();
      direction.x = curr.x - prev.x;
      direction.y = curr.y - prev.y;

      const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
      totalDistance += distance;

      // Skip small movements
      if (distance < this.config.minDistance) {
        this.returnVector(direction);
        continue;
      }

      // Calculate velocity
      const timeDelta = curr.timestamp - prev.timestamp;
      if (timeDelta > 0) {
        const velocity = distance / timeDelta;
        maxVelocity = Math.max(maxVelocity, velocity);
      }

      // Normalize direction
      if (distance > 0) {
        direction.x /= distance;
        direction.y /= distance;
      }

      // Check for direction change
      if (lastDirection && this.isDirectionChange(lastDirection, direction)) {
        directionChanges++;
      }

      if (lastDirection) {
        this.returnVector(lastDirection);
      }
      lastDirection = direction;
    }

    if (lastDirection) {
      this.returnVector(lastDirection);
    }

    // Update analytics
    this.analytics.maxVelocity = Math.max(this.analytics.maxVelocity, maxVelocity);

    // Check if shake pattern detected
    if (directionChanges >= this.config.minDirectionChanges) {
      this.handleShakeDetected(directionChanges, totalDistance, maxVelocity);
    }
  }

  /**
   * Check if there's a significant direction change
   */
  private isDirectionChange(prev: Vector2D, curr: Vector2D): boolean {
    // Calculate dot product to determine angle between directions
    const dotProduct = prev.x * curr.x + prev.y * curr.y;
    
    // Threshold for direction change (roughly 90 degrees)
    const threshold = 0.3;
    
    return dotProduct < threshold;
  }

  /**
   * Handle shake detection
   */
  private handleShakeDetected(directionChanges: number, distance: number, velocity: number): void {
    const now = Date.now();
    const timeSinceLastShake = now - this.lastShakeTime;
    
    // Check debounce time
    if (timeSinceLastShake < this.config.debounceTime) {
      console.log(`🔄 Shake detected but debounced (${timeSinceLastShake}ms < ${this.config.debounceTime}ms)`);
      return;
    }

    // Calculate shake intensity
    const intensity = (directionChanges * distance * velocity) / 1000;

    // Update analytics
    this.analytics.totalShakes++;
    this.analytics.avgDirectionChanges = 
      (this.analytics.avgDirectionChanges + directionChanges) / this.analytics.totalShakes;
    this.analytics.avgShakeIntensity = 
      (this.analytics.avgShakeIntensity + intensity) / this.analytics.totalShakes;

    this.lastShakeTime = now;
    
    console.log(`🎯 SHAKE DETECTED! Changes: ${directionChanges}, Distance: ${distance.toFixed(1)}, Velocity: ${velocity.toFixed(2)}, Intensity: ${intensity.toFixed(2)}`);
    
    // Emit shake event
    this.emit('shake', {
      directionChanges,
      distance,
      velocity,
      intensity,
      timestamp: now
    });
  }

  /**
   * Reset detection state
   */
  private resetDetectionState(): void {
    this.positionBuffer = [];
    this.bufferIndex = 0;
    this.bufferFull = false;
  }

  /**
   * Initialize vector pool for GC optimization
   */
  private initializeVectorPool(): void {
    for (let i = 0; i < this.VECTOR_POOL_SIZE; i++) {
      this.vectorPool.push({ x: 0, y: 0 });
    }
  }

  /**
   * Get a vector from the pool
   */
  private getVector(): Vector2D {
    const vector = this.vectorPool.pop();
    if (vector) {
      vector.x = 0;
      vector.y = 0;
      return vector;
    }
    return { x: 0, y: 0 };
  }

  /**
   * Return a vector to the pool
   */
  private returnVector(vector: Vector2D): void {
    if (this.vectorPool.length < this.VECTOR_POOL_SIZE) {
      this.vectorPool.push(vector);
    }
  }

  /**
   * Get analytics data
   */
  public getAnalytics() {
    return { ...this.analytics };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.resetDetectionState();
    this.vectorPool = [];
  }
}