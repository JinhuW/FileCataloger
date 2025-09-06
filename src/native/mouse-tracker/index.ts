import { MouseTracker } from '@shared/types';
import { NodeMouseTracker } from './node-tracker';
import { DarwinNativeTracker } from './darwin-native-tracker';

/**
 * Factory function to create appropriate mouse tracker for the current platform
 */
export function createMouseTracker(): MouseTracker {
  const platform = process.platform;
  
  try {
    switch (platform) {
      case 'darwin':
        // Try to use native macOS tracker with CGEventTap
        try {
          const tracker = new DarwinNativeTracker();
          console.log('Successfully initialized native macOS mouse tracker');
          return tracker;
        } catch (nativeError) {
          console.warn('Native macOS tracker unavailable, falling back to Node.js implementation');
          console.warn('This is normal if native modules haven\'t been built yet.');
          return new NodeMouseTracker();
        }
        
      case 'win32':
        // Native Windows tracker not yet implemented, use Node.js fallback  
        console.warn('Windows native tracker not yet implemented, using Node.js tracker');
        return new NodeMouseTracker();
        
      case 'linux':
        // Native Linux tracker not yet implemented, use Node.js fallback
        console.warn('Linux native tracker not yet implemented, using Node.js tracker');
        return new NodeMouseTracker();
        
      default:
        console.warn(`Unsupported platform: ${platform}, using Node.js fallback`);
        return new NodeMouseTracker();
    }
  } catch (error) {
    console.error('Failed to create mouse tracker, using Node.js fallback:', error);
    return new NodeMouseTracker();
  }
}

export * from './base-tracker';
export * from './node-tracker';