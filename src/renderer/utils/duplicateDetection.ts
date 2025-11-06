/**
 * @file duplicateDetection.ts
 * @description Centralized duplicate detection logic for shelf items and files.
 * Provides consistent duplicate checking across FileDropZone and FileRenameShelf components.
 */

import { ShelfItem } from '@shared/types';
import { logger } from '@shared/logger';

/**
 * Options for duplicate detection
 */
export interface DuplicateDetectionOptions {
  /** Whether to use case-sensitive comparison (default: false) */
  caseSensitive?: boolean;
  /** Whether to log duplicate findings (default: true) */
  logDuplicates?: boolean;
}

/**
 * Check if an item is a duplicate based on its path
 */
export function isDuplicate(
  item: ShelfItem,
  existingItems: ShelfItem[],
  options: DuplicateDetectionOptions = {}
): boolean {
  const { caseSensitive = false, logDuplicates = true } = options;

  if (!item.path) return false;

  const itemPath = caseSensitive ? item.path : item.path.toLowerCase();
  const exists = existingItems.some(existingItem => {
    if (!existingItem.path) return false;
    const existingPath = caseSensitive ? existingItem.path : existingItem.path.toLowerCase();
    return existingPath === itemPath;
  });

  if (exists && logDuplicates) {
    logger.info(`📋 Skipping duplicate file/folder: ${item.name} (${item.path})`);
  }

  return exists;
}

/**
 * Filter out duplicate items from a new items array
 * Returns both non-duplicates and duplicate count
 */
export function filterDuplicates(
  newItems: ShelfItem[],
  existingItems: ShelfItem[],
  options: DuplicateDetectionOptions = {}
): { items: ShelfItem[]; duplicateCount: number } {
  const existingPaths = new Set(
    existingItems
      .map(item => item.path)
      .filter(Boolean)
      .map(path => (options.caseSensitive ? path : path!.toLowerCase()))
  );

  const filtered: ShelfItem[] = [];
  let duplicateCount = 0;

  for (const item of newItems) {
    if (!item.path) {
      filtered.push(item);
      continue;
    }

    const itemPath = options.caseSensitive ? item.path : item.path.toLowerCase();

    if (existingPaths.has(itemPath)) {
      duplicateCount++;
      if (options.logDuplicates !== false) {
        logger.info(`📋 Skipping duplicate file/folder: ${item.name} (${item.path})`);
      }
    } else {
      filtered.push(item);
      existingPaths.add(itemPath);
    }
  }

  return { items: filtered, duplicateCount };
}

/**
 * Get a formatted message for duplicate detection results
 */
export function getDuplicateMessage(
  duplicateCount: number,
  context: 'shelf' | 'rename' = 'shelf'
): { title: string; message: string } | null {
  if (duplicateCount === 0) return null;

  const fileWord = duplicateCount === 1 ? 'file' : 'files';
  const existsWord = duplicateCount === 1 ? 'exists' : 'exist';

  return {
    title: 'Duplicate Files Skipped',
    message: `${duplicateCount} ${fileWord} already ${existsWord} ${context === 'shelf' ? 'on this shelf' : 'in the selection'}`,
  };
}
