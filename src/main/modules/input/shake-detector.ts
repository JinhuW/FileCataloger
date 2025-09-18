import { EventEmitter } from 'events';
import { ShakeDetector, ShakeDetectionConfig, MousePosition, Vector2D } from '@shared/types';
import { createLogger, Logger } from '../utils/logger';

/**
 * Advanced shake detection algorithm with ring buffer and vector pooling
 *
 * Detects rapid back-and-forth cursor movements that indicate user intent
 * to activate the shelf system
 */
export class AdvancedShakeDetector extends EventEmitter implements ShakeDetector {
  private logger: Logger;

  // Default configuration - ULTRA sensitive for testing
  private config: ShakeDetectionConfig = {
    minDirectionChanges: 1, // Only 1 direction change needed (very easy)
    timeWindow: 2000, // Very long time window
    minDistance: 1, // Minimum possible distance
    debounceTime: 50, // Very fast debounce
    minVelocity: 0.01, // Almost no velocity needed
    maxVelocity: 100, // High max velocity
    velocityWeight: 1.5, // Weight factor for velocity in intensity calculation
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
    maxVelocity: 0,
  };

  constructor() {
    super();
    this.logger = createLogger('ShakeDetector');
    this.initializeVectorPool();
    this.logger.info('ShakeDetector initialized with config:', this.config);
  }

  public configure(config: Partial<ShakeDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public start(): void {
    if (this.isActive) {
      this.logger.warn('ShakeDetector is already active');
      return;
    }

    this.isActive = true;
    this.resetDetectionState();
    this.logger.info('✅ ShakeDetector started - shake your mouse to trigger shelf creation');
    this.logger.info('📊 Shake config:', JSON.stringify(this.config, null, 2));
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
      // Log this occasionally to verify position events are being received
      if (Math.random() < 0.001) {
        // 0.1% chance to avoid spam
        this.logger.debug('Received position but ShakeDetector is not active:', position);
      }
      return;
    }

    // Log every 1000th position to verify active processing (minimal)
    if (this.bufferIndex % 1000 === 0) {
      this.logger.debug('Processing position (active), buffer index:', this.bufferIndex);
    }

    // Process all shake events - drag detection is handled separately
    // The drag-shake detector will validate if we're actually dragging

    // Add to ring buffer
    this.addToBuffer(position);

    // Analyze recent movement for shake pattern
    this.analyzeMovement();
  }

  /**
   * Add position to ring buffer
   */
  private addToBuffer(position: MousePosition): void {
    // Ensure position has all required fields
    const positionToStore: MousePosition = {
      x: position.x,
      y: position.y,
      timestamp: position.timestamp || Date.now(),
      leftButtonDown: position.leftButtonDown || false,
    };

    // Removed excessive position buffer logging

    this.positionBuffer[this.bufferIndex] = positionToStore;
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

    // Log analysis attempts occasionally to verify this method is being called
    if (this.bufferIndex % 50 === 0) {
      this.logger.debug(
        'Analyzing movement:',
        positions.length,
        'positions in last',
        this.config.timeWindow,
        'ms'
      );
    }

    // More aggressive logging for debugging
    if (this.bufferIndex % 20 === 0 && positions.length > 0) {
      this.logger.debug(`📊 Analyzing ${positions.length} positions for shake detection`);
    }

    if (positions.length < 4) {
      if (this.bufferIndex % 100 === 0) {
        this.logger.debug(
          'Not enough positions for shake detection:',
          positions.length,
          '< 4 required'
        );
      }
      return; // Need at least 4 positions to detect direction changes
    }

    // Calculate direction changes with velocity tracking
    let directionChanges = 0;
    let lastDirection: Vector2D | null = null;
    let totalDistance = 0;
    let maxVelocity = 0;
    let avgVelocity = 0;
    let velocityCount = 0;
    let accelerationChanges = 0;
    let lastVelocity = 0;

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

      // Calculate velocity with filtering
      const timeDelta = curr.timestamp - prev.timestamp;
      let velocity = 0;
      if (timeDelta > 0) {
        velocity = distance / timeDelta;

        // Filter out erratic movements
        if (this.config.maxVelocity && velocity > this.config.maxVelocity) {
          velocity = this.config.maxVelocity;
        }

        // Track velocity statistics
        if (this.config.minVelocity && velocity >= this.config.minVelocity) {
          maxVelocity = Math.max(maxVelocity, velocity);
          avgVelocity = (avgVelocity * velocityCount + velocity) / (velocityCount + 1);
          velocityCount++;

          // Track acceleration changes (rapid speed changes indicate shake)
          if (lastVelocity > 0) {
            const acceleration = Math.abs(velocity - lastVelocity) / timeDelta;
            if (acceleration > 0.01) {
              // Significant acceleration change
              accelerationChanges++;
            }
          }
          lastVelocity = velocity;
        }
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

    // Log analysis results occasionally for debugging
    if (directionChanges > 0 && this.bufferIndex % 25 === 0) {
      this.logger.debug(
        `Movement analysis: ${directionChanges} direction changes (need ${this.config.minDirectionChanges}), distance: ${totalDistance.toFixed(1)} (need ${this.config.minDistance}), avg velocity: ${avgVelocity.toFixed(2)}, acceleration changes: ${accelerationChanges}`
      );
    }

    // Enhanced shake detection with velocity consideration
    const minVel = this.config.minVelocity || 0.5;
    const velocityWeight = this.config.velocityWeight || 1.5;
    const velocityFactor = avgVelocity >= minVel ? velocityWeight : 0.5;
    const hasValidVelocity = maxVelocity >= minVel && avgVelocity >= minVel * 0.7;
    const hasAccelerationPattern = accelerationChanges >= Math.max(1, directionChanges - 1);

    // Check if shake pattern detected with velocity-based criteria
    if (directionChanges >= this.config.minDirectionChanges && hasValidVelocity) {
      this.logger.info(
        `✅ Velocity-based shake detected! Changes: ${directionChanges}, Distance: ${totalDistance}, Avg Velocity: ${avgVelocity.toFixed(2)}, Acceleration Changes: ${accelerationChanges}`
      );
      this.logger.debug(
        `🎉 Velocity-based shake: ${directionChanges} changes, ${totalDistance.toFixed(2)} distance`
      );
      this.handleShakeDetected(directionChanges, totalDistance, avgVelocity * velocityFactor);
    } else if (directionChanges >= this.config.minDirectionChanges + 1 && hasAccelerationPattern) {
      // Alternative detection: more direction changes with acceleration pattern
      this.logger.info(
        `✅ Acceleration-based shake detected! Changes: ${directionChanges}, Acceleration Changes: ${accelerationChanges}`
      );
      this.logger.debug(`🎊 Acceleration-based shake: ${directionChanges} changes`);
      this.handleShakeDetected(directionChanges, totalDistance, maxVelocity);
    } else if (directionChanges >= this.config.minDirectionChanges) {
      // Even easier detection for testing
      this.logger.debug(
        `🎈 Simple shake: ${directionChanges} changes, ${totalDistance.toFixed(2)} distance`
      );
      this.handleShakeDetected(directionChanges, totalDistance, 1.0);
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
      this.logger.debug(
        `🔄 Shake debounced: ${timeSinceLastShake}ms < ${this.config.debounceTime}ms`
      );
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

    this.logger.info(
      `🎯 SHAKE DETECTED! Changes: ${directionChanges}, Distance: ${distance.toFixed(1)}, Velocity: ${velocity.toFixed(2)}, Intensity: ${intensity.toFixed(2)}`
    );

    // Emit shake event
    this.logger.info(
      '🎯 SHAKE DETECTED! Direction changes:',
      directionChanges,
      'Intensity:',
      intensity.toFixed(2)
    );
    this.emit('shake', {
      directionChanges,
      distance,
      velocity,
      intensity,
      timestamp: now,
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
