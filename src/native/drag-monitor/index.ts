/**
 * @fileoverview Drag monitor module entry point
 *
 * This file re-exports the drag monitor functionality from the src directory.
 * It allows for cleaner imports: `from '@native/drag-monitor'` instead of `from '@native/drag-monitor/src'`
 *
 * @module drag-monitor
 */

export { createDragMonitor, MacDragMonitor, isNativeModuleAvailable } from './src/index';
export type { DragMonitor, DraggedItem, DragEvent } from './src/index';
