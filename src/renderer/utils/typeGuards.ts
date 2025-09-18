/**
 * @file typeGuards.ts
 * @description Type guard functions for validating IPC communication data.
 * These guards ensure type safety when receiving data from the main process,
 * preventing runtime errors from invalid data shapes.
 *
 * @usage
 * ```typescript
 * window.api.on('shelf:config', (data: unknown) => {
 *   if (isShelfConfig(data)) {
 *     setConfig(data); // data is now typed as ShelfConfig
 *   }
 * });
 * ```
 */

import type {
  ShelfConfig,
  ShelfItem,
  Vector2D,
  DockPosition,
  AppStatus,
  FileInfo,
  RenamePattern,
} from '@shared/types';
import { logger } from '@shared/logger';

/**
 * Type guard for Vector2D
 */
export function isVector2D(obj: unknown): obj is Vector2D {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).x === 'number' &&
    typeof (obj as any).y === 'number'
  );
}

/**
 * Type guard for DockPosition
 */
export function isDockPosition(obj: unknown): obj is DockPosition {
  return typeof obj === 'string' && ['top', 'bottom', 'left', 'right'].includes(obj);
}

/**
 * Type guard for ShelfItem
 */
export function isShelfItem(obj: unknown): obj is ShelfItem {
  if (typeof obj !== 'object' || obj === null) return false;

  const item = obj as any;

  return (
    typeof item.id === 'string' &&
    typeof item.type === 'string' &&
    ['file', 'text', 'url', 'image'].includes(item.type) &&
    typeof item.name === 'string' &&
    typeof item.createdAt === 'number' &&
    (item.path === undefined || typeof item.path === 'string') &&
    (item.content === undefined || typeof item.content === 'string') &&
    (item.size === undefined || typeof item.size === 'number') &&
    (item.thumbnail === undefined || typeof item.thumbnail === 'string')
  );
}

/**
 * Type guard for ShelfConfig
 */
export function isShelfConfig(obj: unknown): obj is ShelfConfig {
  if (typeof obj !== 'object' || obj === null) return false;

  const config = obj as any;

  return (
    typeof config.id === 'string' &&
    isVector2D(config.position) &&
    (config.dockPosition === null || isDockPosition(config.dockPosition)) &&
    typeof config.isPinned === 'boolean' &&
    Array.isArray(config.items) &&
    config.items.every((item: unknown) => isShelfItem(item)) &&
    typeof config.isVisible === 'boolean' &&
    typeof config.opacity === 'number' &&
    config.opacity >= 0 &&
    config.opacity <= 1 &&
    (config.mode === undefined || config.mode === 'default' || config.mode === 'rename')
  );
}

/**
 * Type guard for AppStatus modules
 */
function isAppModules(obj: unknown): obj is AppStatus['modules'] {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).mouseTracker === 'boolean' &&
    typeof (obj as any).shakeDetector === 'boolean' &&
    typeof (obj as any).dragDetector === 'boolean'
  );
}

/**
 * Type guard for AppStatus analytics
 */
function isAppAnalytics(obj: unknown): obj is AppStatus['analytics'] {
  if (typeof obj !== 'object' || obj === null) return false;

  const analytics = obj as any;

  return (
    typeof analytics.mouseTracker === 'object' &&
    analytics.mouseTracker !== null &&
    typeof analytics.mouseTracker.eventsPerSecond === 'number' &&
    typeof analytics.mouseTracker.cpuUsage === 'number' &&
    typeof analytics.mouseTracker.memoryUsage === 'number' &&
    typeof analytics.shakeDetector === 'object' &&
    analytics.shakeDetector !== null &&
    typeof analytics.shakeDetector.shakesDetected === 'number' &&
    typeof analytics.shakeDetector.lastShakeTime === 'number' &&
    typeof analytics.dragDetector === 'object' &&
    analytics.dragDetector !== null &&
    typeof analytics.dragDetector.dragsDetected === 'number' &&
    typeof analytics.dragDetector.filesDropped === 'number'
  );
}

/**
 * Type guard for AppStatus
 */
export function isAppStatus(obj: unknown): obj is AppStatus {
  if (typeof obj !== 'object' || obj === null) return false;

  const status = obj as any;

  return (
    typeof status.isRunning === 'boolean' &&
    typeof status.activeShelves === 'number' &&
    isAppModules(status.modules) &&
    isAppAnalytics(status.analytics)
  );
}

/**
 * Type guard for FileInfo (used in file rename operations)
 */
export function isFileInfo(obj: unknown): obj is FileInfo {
  if (typeof obj !== 'object' || obj === null) return false;

  const file = obj as any;

  return (
    typeof file.path === 'string' &&
    typeof file.name === 'string' &&
    typeof file.newName === 'string' &&
    (file.error === undefined || typeof file.error === 'string')
  );
}

/**
 * Type guard for RenamePattern
 */
export function isRenamePattern(obj: unknown): obj is RenamePattern {
  if (typeof obj !== 'object' || obj === null) return false;

  const pattern = obj as any;

  return (
    typeof pattern.id === 'string' &&
    typeof pattern.type === 'string' &&
    ['text', 'originalName', 'date', 'counter', 'extension'].includes(pattern.type) &&
    (pattern.value === undefined || typeof pattern.value === 'string') &&
    (pattern.format === undefined || typeof pattern.format === 'string') &&
    (pattern.startValue === undefined || typeof pattern.startValue === 'number') &&
    (pattern.padding === undefined || typeof pattern.padding === 'number')
  );
}

/**
 * Type guard for arrays of a specific type
 */
export function isArrayOf<T>(arr: unknown, itemGuard: (item: unknown) => item is T): arr is T[] {
  return Array.isArray(arr) && arr.every(itemGuard);
}

/**
 * Safe parsing helper that logs errors in development
 */
export function safeParse<T>(
  data: unknown,
  guard: (data: unknown) => data is T,
  context: string
): T | null {
  if (guard(data)) {
    return data;
  }

  if (process.env.NODE_ENV === 'development') {
    logger.error(`Type guard failed for ${context}:`, data);
  }

  return null;
}
