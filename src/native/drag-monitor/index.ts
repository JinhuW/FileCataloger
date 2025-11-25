/**
 * @fileoverview Drag monitor module entry point
 *
 * This file re-exports the drag monitor functionality from the src directory.
 * It allows for cleaner imports: `from '@native/drag-monitor'` instead of `from '@native/drag-monitor/src'`
 *
 * IMPORTANT: Do NOT directly export platform-specific classes (MacDragMonitor, WindowsDragMonitor)
 * as this forces webpack to bundle and evaluate those modules on all platforms.
 * Use the factory function createDragMonitor() or the getter functions instead.
 *
 * @module drag-monitor
 */

export {
  createDragMonitor,
  isNativeModuleAvailable,
  getMacDragMonitor,
  getWindowsDragMonitor,
} from './src/index';
export type { DragMonitor, DraggedItem, DragEvent, MacDragMonitor } from './src/index';
