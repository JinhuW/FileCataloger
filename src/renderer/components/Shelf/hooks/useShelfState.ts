/**
 * @file useShelfState.ts
 * @description Custom hooks for managing shelf state and interactions.
 * Consolidates shelf-specific logic for reusability.
 */

import { useState, useCallback, useEffect } from 'react';
import { ShelfConfig, ShelfItem } from '@shared/types';
import { logger } from '@shared/logger';
import { cleanupItemThumbnails } from '@renderer/utils/fileProcessing';

/**
 * Hook for managing shelf drag state
 */
export function useShelfDragState() {
  const [isDragOver, setIsDragOver] = useState(false);

  return {
    isDragOver,
    setIsDragOver,
  };
}

/**
 * Hook for managing shelf items with IPC sync
 */
export function useShelfItems(
  config: ShelfConfig,
  onItemAdd: (item: ShelfItem) => void,
  onItemRemove: (itemId: string) => void,
  announce: (message: string) => void
) {
  // Handle item actions with announcements
  const handleItemAction = useCallback(
    (action: string, item: ShelfItem) => {
      switch (action) {
        case 'remove':
          onItemRemove(item.id);
          announce(`${item.name} removed from shelf`);
          break;
        case 'open':
          if (item.path && window.api) {
            window.api.send('shelf:open-item', { path: item.path });
            announce(`Opening ${item.name}`);
          }
          break;
        case 'copy':
          navigator.clipboard.writeText(item.content || item.name);
          announce(`${item.name} copied to clipboard`);
          break;
      }
    },
    [onItemRemove, announce]
  );

  // Handle drop events with announcements
  const handleDrop = useCallback(
    (items: ShelfItem[]) => {
      logger.debug('handleDrop called with', items.length, 'items');
      items.forEach((item, index) => {
        logger.debug(`Adding item ${index + 1}/${items.length}:`, item);
        onItemAdd(item);
      });

      // Announce to screen readers
      const itemText = items.length === 1 ? 'item' : 'items';
      announce(`${items.length} ${itemText} added to shelf`);
    },
    [onItemAdd, announce]
  );

  // Cleanup thumbnails on unmount
  useEffect(() => {
    return () => {
      cleanupItemThumbnails(config.items);
    };
  }, []);

  return {
    handleItemAction,
    handleDrop,
  };
}

/**
 * Hook for managing shelf configuration
 */
export function useShelfConfig(onConfigChange: (config: Partial<ShelfConfig>) => void) {
  const handleConfigChange = useCallback(
    (changes: Partial<ShelfConfig>) => {
      onConfigChange(changes);
    },
    [onConfigChange]
  );

  return {
    handleConfigChange,
  };
}
