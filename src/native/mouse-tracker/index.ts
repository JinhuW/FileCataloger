import { MouseTracker } from '@shared/types';
import { NodeMouseTracker } from './node-tracker';
import { DarwinNativeTracker } from './darwin-native-tracker';

/**
 * Factory function to create appropriate mouse tracker for the current platform
 */
export function createMouseTracker(): MouseTracker {
  const platform = process.platform;
  
  switch (platform) {
    case 'darwin':
      // Use native macOS tracker with CGEventTap (no fallback)
      const tracker = new DarwinNativeTracker();
      console.log('Successfully initialized native macOS mouse tracker');
      return tracker;
      
    case 'win32':
      // Native Windows tracker not yet implemented
      throw new Error('Windows native tracker not yet implemented');
      
    case 'linux':
      // Native Linux tracker not yet implemented
      throw new Error('Linux native tracker not yet implemented');
      
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export * from './base-tracker';
export * from './node-tracker';