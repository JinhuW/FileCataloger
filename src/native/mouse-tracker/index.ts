/**
 * @fileoverview Mouse tracker module entry point
 *
 * This file re-exports the mouse tracker functionality from the src directory.
 * It allows for cleaner imports: `from '@native/mouse-tracker'` instead of `from '@native/mouse-tracker/src'`
 *
 * IMPORTANT: Do NOT directly export platform-specific classes (MacOSMouseTracker, WindowsMouseTracker)
 * as this forces webpack to bundle and evaluate those modules on all platforms.
 * Use the factory function createMouseTracker() or the getter functions instead.
 *
 * @module mouse-tracker
 */

export { createMouseTracker, getMacOSMouseTracker, getWindowsMouseTracker } from './src/index';
