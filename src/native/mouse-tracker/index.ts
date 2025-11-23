/**
 * @fileoverview Mouse tracker module entry point
 *
 * This file re-exports the mouse tracker functionality from the src directory.
 * It allows for cleaner imports: `from '@native/mouse-tracker'` instead of `from '@native/mouse-tracker/src'`
 *
 * @module mouse-tracker
 */

export { createMouseTracker, MacOSMouseTracker } from './src/index';
