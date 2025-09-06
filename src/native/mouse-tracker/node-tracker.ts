import { BaseMouseTracker } from './base-tracker';
import { screen } from 'electron';

/**
 * Node.js fallback mouse tracker
 * 
 * This implementation provides basic mouse tracking functionality
 * for development and testing purposes. In production, platform-specific
 * native modules would provide more efficient tracking.
 */
export class NodeMouseTracker extends BaseMouseTracker {
  private pollInterval?: NodeJS.Timeout;
  private readonly POLL_RATE = 60; // 60 FPS
  private readonly POLL_INTERVAL = 1000 / this.POLL_RATE;
  private isLeftButtonDown: boolean = false;

  constructor() {
    super();
    this.setupButtonSimulation();
  }
  
  private setupButtonSimulation(): void {
    // In fallback mode, we cannot detect real mouse buttons
    // Shelf creation will require actual drag operations
    console.log('⚠️ Fallback mode: Mouse button detection not available');
    console.log('📌 Shelf will only appear when dragging files');
    
    // Default to false - no button simulation
    this.isLeftButtonDown = false;
  }

  start(): void {
    if (this.isActive) {
      console.warn('NodeMouseTracker is already active');
      return;
    }

    try {
      this.initializeTracking();
      this.isActive = true;
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  stop(): void {
    if (!this.isActive) {
      return;
    }

    try {
      this.cleanupTracking();
      this.isActive = false;
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  protected initializeTracking(): void {
    // Get current cursor position using Electron's screen API
    // Note: This has limitations as it only works when the app has focus
    this.updateCurrentPosition();
    
    // Start polling for position changes
    this.pollInterval = setInterval(() => {
      this.updateCurrentPosition();
    }, this.POLL_INTERVAL);
  }

  protected cleanupTracking(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  private updateCurrentPosition(): void {
    try {
      // Get cursor position from Electron's screen API
      const point = screen.getCursorScreenPoint();
      
      // Only update if position has changed
      if (point.x !== this.lastPosition.x || point.y !== this.lastPosition.y) {
        this.updatePosition(point.x, point.y, {
          x: point.x,
          y: point.y,
          timestamp: Date.now(),
          leftButtonDown: false // Cannot detect button state in fallback mode
        });
      }
    } catch (error) {
      // Screen API might not be available in some contexts
      // For development, we can simulate mouse movement
      this.simulateMouseMovement();
    }
  }

  private simulateMouseMovement(): void {
    // Simulate random mouse movement for development/testing
    // This won't be used in production with native trackers
    const time = Date.now();
    const x = 400 + Math.sin(time / 1000) * 200;
    const y = 300 + Math.cos(time / 1500) * 150;
    
    this.updatePosition(Math.round(x), Math.round(y));
  }

  protected destroy(): void {
    this.stop();
    super.destroy();
  }
}