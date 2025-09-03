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
        // Use native macOS tracker with CGEventTap
        return new DarwinNativeTracker();
        
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