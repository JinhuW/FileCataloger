import { BaseMouseTracker } from './base-tracker';
import * as path from 'path';
import { MousePosition } from '@shared/types';

/**
 * Native macOS mouse tracker using Core Graphics
 */
export class DarwinNativeTracker extends BaseMouseTracker {
  private nativeTracker: {
    start: () => void;
    stop: () => void;
    getMousePosition: () => { x: number; y: number };
  } | null = null;

  constructor() {
    super();
    
    try {
      // Try multiple possible paths for the native module
      const possiblePaths = [
        path.join(__dirname, 'darwin', 'build', 'Release', 'mouse_tracker_darwin.node'),
        path.join(process.cwd(), 'src', 'native', 'mouse-tracker', 'darwin', 'build', 'Release', 'mouse_tracker_darwin.node'),
        path.join(process.cwd(), 'dist', 'main', 'darwin', 'build', 'Release', 'mouse_tracker_darwin.node')
      ];
      
      let nativeModule = null;
      let successPath = '';
      
      for (const modulePath of possiblePaths) {
        try {
          // Use eval to prevent webpack from processing this require
          nativeModule = eval('require')(modulePath);
          successPath = modulePath;
          break;
        } catch (loadError) {
          continue;
        }
      }
      
      if (!nativeModule) {
        throw new Error('Could not find native module in any expected location');
      }
      
      // Create instance with callback
      this.nativeTracker = new nativeModule.MacOSMouseTracker((position: MousePosition) => {
        this.handleMouseMove(position);
      });
    } catch (error) {
      console.error('Failed to load native macOS tracker:', error);
      throw new Error(`Failed to initialize native macOS tracker: ${error}`);
    }
  }

  /**
   * Handle mouse move events from native module
   */
  private handleMouseMove(position: MousePosition): void {
    // Use base class method to update position and emit events
    // The position object already contains the button state
    this.updatePosition(position.x, position.y, position);
  }

  /**
   * Start tracking mouse position
   */
  public start(): void {
    if (this.isActive) {
      console.warn('DarwinNativeTracker is already tracking');
      return;
    }

    try {
      this.initializeTracking();
      this.isActive = true;
    } catch (error) {
      console.error('Failed to start DarwinNativeTracker:', error);
      
      // Check for accessibility permission error
      if (error instanceof Error && error.message.includes('Accessibility permission')) {
        console.error('\n⚠️  IMPORTANT: Accessibility permission required!');
        console.error('Please grant permission in:');
        console.error('System Preferences > Security & Privacy > Privacy > Accessibility');
        console.error('Add and enable your terminal or Electron app\n');
        
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
      console.warn('DarwinNativeTracker is not tracking');
      return;
    }

    try {
      this.cleanupTracking();
      this.isActive = false;
    } catch (error) {
      console.error('Failed to stop DarwinNativeTracker:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Initialize the native tracking
   */
  protected initializeTracking(): void {
    if (!this.nativeTracker) {
      throw new Error('Native tracker not initialized');
    }
    this.nativeTracker.start();
  }

  /**
   * Cleanup the native tracking
   */
  protected cleanupTracking(): void {
    if (this.nativeTracker) {
      this.nativeTracker.stop();
    }
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