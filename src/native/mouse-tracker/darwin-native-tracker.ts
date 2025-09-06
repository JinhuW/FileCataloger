import { BaseMouseTracker } from './base-tracker';
import { MousePosition } from '@shared/types';
import * as path from 'path';

/**
 * Native macOS mouse tracker using Core Graphics
 */
export class DarwinNativeTracker extends BaseMouseTracker {
  private nativeTracker: any = null;
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    // Load the native module - try multiple paths
    // When running from dist, we need to look in the src directory
    const possiblePaths = [
      // Direct path from project root (most reliable)
      path.join(process.cwd(), 'src', 'native', 'mouse-tracker', 'darwin', 'build', 'Release', 'mouse_tracker_darwin.node'),
      // Look for the copied module in dist/main
      path.join(process.cwd(), 'dist', 'main', 'mouse_tracker_darwin.node'),
      // Webpack may bundle it with a hash
      path.join(__dirname, '..', '4ea58c2179beb80aedba968829348ba5.node'),
      // Relative to dist directory
      path.join(__dirname, '..', '..', '..', '..', 'src', 'native', 'mouse-tracker', 'darwin', 'build', 'Release', 'mouse_tracker_darwin.node'),
      // Development path
      path.join(__dirname, 'build', 'Release', 'mouse_tracker_darwin.node')
    ];
    
    let nativeModule: any = null;
    let loadedPath: string = '';
    
    for (const modulePath of possiblePaths) {
      try {
        nativeModule = require(modulePath);
        loadedPath = modulePath;
        console.log('✅ Successfully loaded native macOS tracker from:', loadedPath);
        break;
      } catch (err) {
        // Log which path failed for debugging
        console.debug(`Tried loading from: ${modulePath} - not found`);
        continue;
      }
    }
    
    if (!nativeModule) {
      throw new Error(`Failed to load native module from any of: ${possiblePaths.join(', ')}`);
    }
    
    try {
      
      // Create the tracker instance
      this.nativeTracker = new nativeModule.MacOSMouseTracker();
      console.log('Created MacOSMouseTracker instance');
      
      // Set up the mouse move callback
      // The native module passes a position object as the first parameter
      this.nativeTracker.onMouseMove((positionData: any) => {
        // Handle both old format (4 params) and new format (position object)
        let position: MousePosition;
        
        if (typeof positionData === 'object' && positionData.x !== undefined) {
          // New format: position object from native module
          position = {
            x: positionData.x,
            y: positionData.y,
            timestamp: positionData.timestamp || Date.now(),
            leftButtonDown: positionData.leftButtonDown || false
          };
        } else {
          // Old format: separate parameters (for backwards compatibility)
          const x = arguments[0] as number;
          const y = arguments[1] as number;
          const leftButton = arguments[2] as boolean;
          position = {
            x,
            y,
            timestamp: Date.now(),
            leftButtonDown: leftButton
          };
        }
        
        // Log button state changes for debugging
        const currentPos = this.getCurrentPosition();
        if (currentPos.leftButtonDown !== position.leftButtonDown) {
          console.log(`🖱️ Left button ${position.leftButtonDown ? 'pressed' : 'released'}`);
        }
        
        this.updatePosition(position.x, position.y, position);
      });
      
      // Set up button state change callback
      this.nativeTracker.onButtonStateChange((leftButton: boolean, rightButton: boolean) => {
        console.log(`🎯 Button state changed - Left: ${leftButton}, Right: ${rightButton}`);
        
        // Update current position with new button state
        const currentPos = this.getCurrentPosition();
        const position: MousePosition = {
          x: currentPos.x,
          y: currentPos.y,
          timestamp: Date.now(),
          leftButtonDown: leftButton
        };
        
        this.updatePosition(position.x, position.y, position);
        
        // Emit button state change event
        this.emit('buttonStateChange', {
          leftButtonDown: leftButton,
          rightButtonDown: rightButton,
          timestamp: Date.now()
        });
      });
      
      console.log('Native macOS tracker initialized successfully');
    } catch (error) {
      console.error('Failed to load native module:', error);
      throw new Error(`Failed to initialize native macOS tracker: ${error}`);
    }
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
      const success = this.nativeTracker.start();
      if (success) {
        this.isActive = true;
        console.log('✅ Native macOS mouse tracking started with button detection');
        
        // Also start a fallback polling mechanism just in case
        this.startPolling();
      } else {
        throw new Error('Failed to start native tracker - may need accessibility permissions');
      }
    } catch (error) {
      console.error('Failed to start DarwinNativeTracker:', error);
      
      // Check for accessibility permission error
      if (error instanceof Error && error.message.includes('accessibility')) {
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
   * Start fallback polling for position updates
   */
  private startPolling(): void {
    // Poll every 16ms (60 FPS) as a fallback
    this.pollingInterval = setInterval(() => {
      // The native module callbacks should handle updates
      // This is just a safety mechanism
    }, 16);
  }

  /**
   * Stop fallback polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
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
      this.stopPolling();
      
      if (this.nativeTracker) {
        this.nativeTracker.stop();
      }
      
      this.isActive = false;
      console.log('Native macOS mouse tracking stopped');
    } catch (error) {
      console.error('Failed to stop DarwinNativeTracker:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * Initialize the native tracking
   */
  protected initializeTracking(): void {
    // Handled in start()
  }

  /**
   * Cleanup the native tracking
   */
  protected cleanupTracking(): void {
    // Handled in stop()
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