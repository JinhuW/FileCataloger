/**
 * @file useShelfItems.ts
 * @description Custom hook for managing shelf items with IPC synchronization.
 * Handles add, remove, update operations with optimistic updates using React 19's useOptimistic.
 */

import { useEffect, useCallback, useOptimistic } from 'react';
import { ShelfItem } from '@shared/types';
import { useShelfStore } from '@renderer/stores/shelfStore';
import { useIPC } from './useIPC';
import { isShelfItem } from '@renderer/utils/typeGuards';
import { logger } from '@shared/logger';

/**
 * Action type for optimistic updates
 */
type OptimisticAction =
  | { type: 'add'; item: ShelfItem }
  | { type: 'addMultiple'; items: ShelfItem[] }
  | { type: 'remove'; itemId: string }
  | { type: 'update'; itemId: string; updates: Partial<ShelfItem> };

/**
 * Result of the useShelfItems hook
 */
export interface UseShelfItemsResult {
  /**
   * Current array of shelf items
   */
  items: ShelfItem[];
  /**
   * Add a single item to the shelf
   */
  addItem: (item: ShelfItem) => Promise<void>;
  /**
   * Add multiple items to the shelf
   */
  addItems: (items: ShelfItem[]) => Promise<void>;
  /**
   * Remove an item from the shelf
   */
  removeItem: (itemId: string) => Promise<void>;
  /**
   * Update an item in the shelf
   */
  updateItem: (itemId: string, updates: Partial<ShelfItem>) => Promise<void>;
  /**
   * Clear all items from the shelf
   */
  clearItems: () => Promise<void>;
}

/**
 * Hook for managing shelf items with Zustand store and IPC sync.
 * Provides optimistic updates and automatic synchronization with main process.
 *
 * @param shelfId - Unique identifier for the shelf
 * @returns Object with items array and CRUD operations
 *
 * @example
 * ```typescript
 * const { items, addItem, removeItem } = useShelfItems(shelfId);
 *
 * // Add an item
 * await addItem(newShelfItem);
 *
 * // Remove an item
 * await removeItem(itemId);
 * ```
 */
export function useShelfItems(shelfId: string | null): UseShelfItemsResult {
  const { invoke, on, isConnected } = useIPC();
  const shelf = useShelfStore(state => (shelfId ? state.getShelf(shelfId) : null));
  const addItemToShelf = useShelfStore(state => state.addItemToShelf);
  const addItemsToShelf = useShelfStore(state => state.addItemsToShelf);
  const removeItemFromShelf = useShelfStore(state => state.removeItemFromShelf);
  const updateItemInShelf = useShelfStore(state => state.updateItemInShelf);
  const clearShelfItems = useShelfStore(state => state.clearShelfItems);

  // React 19: useOptimistic for immediate UI feedback
  const [optimisticItems, addOptimisticUpdate] = useOptimistic(
    shelf?.items || [],
    (state: ShelfItem[], action: OptimisticAction) => {
      switch (action.type) {
        case 'add':
          return [...state, action.item];
        case 'addMultiple':
          return [...state, ...action.items];
        case 'remove':
          return state.filter(item => item.id !== action.itemId);
        case 'update':
          return state.map(item =>
            item.id === action.itemId ? { ...item, ...action.updates } : item
          );
        default:
          return state;
      }
    }
  );

  // Listen for item-related IPC events from main process
  useEffect(() => {
    if (!isConnected || !shelfId) return;

    const cleanups: (() => void)[] = [];

    // Listen for item additions
    cleanups.push(
      on('shelf:add-item', (item: unknown) => {
        if (isShelfItem(item)) {
          logger.debug(`Received shelf:add-item event for shelf ${shelfId}`);
          addItemToShelf(shelfId, item);
        } else if (process.env.NODE_ENV === 'development') {
          logger.warn('Received invalid shelf item:', item);
        }
      })
    );

    // Listen for item removals
    cleanups.push(
      on('shelf:remove-item', (itemId: unknown) => {
        if (typeof itemId === 'string') {
          logger.debug(`Received shelf:remove-item event for shelf ${shelfId}, item ${itemId}`);
          removeItemFromShelf(shelfId, itemId);
        } else if (process.env.NODE_ENV === 'development') {
          logger.warn('Received invalid item ID:', itemId);
        }
      })
    );

    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [isConnected, shelfId, on, addItemToShelf, removeItemFromShelf]);

  // Add a single item
  const addItem = useCallback(
    async (item: ShelfItem) => {
      if (!shelfId) {
        logger.error('Cannot add item: shelfId is null');
        return;
      }

      logger.debug(`Adding item to shelf ${shelfId}:`, item.name);

      // React 19: Add optimistic update for immediate UI feedback
      addOptimisticUpdate({ type: 'add', item });

      // Update store (this will be the source of truth after IPC confirms)
      addItemToShelf(shelfId, item);

      // Sync with main process
      if (isConnected) {
        try {
          await invoke('shelf:add-item', shelfId, item);
          logger.debug(`Successfully synced item add for shelf ${shelfId}`);
        } catch (error) {
          logger.error('Failed to add item via IPC:', error);
          // Zustand store will revert on next sync from main process
        }
      } else {
        logger.warn('IPC not connected, item add not synced');
      }
    },
    [shelfId, isConnected, invoke, addItemToShelf, addOptimisticUpdate]
  );

  // Add multiple items
  const addItems = useCallback(
    async (items: ShelfItem[]) => {
      if (!shelfId) {
        logger.error('Cannot add items: shelfId is null');
        return;
      }

      logger.debug(`Adding ${items.length} items to shelf ${shelfId}`);

      // React 19: Add optimistic update for immediate UI feedback
      addOptimisticUpdate({ type: 'addMultiple', items });

      // Update store
      addItemsToShelf(shelfId, items);

      // Sync each item with main process
      if (isConnected) {
        const promises = items.map(item => invoke('shelf:add-item', shelfId, item));
        try {
          await Promise.all(promises);
          logger.debug(`Successfully synced ${items.length} items for shelf ${shelfId}`);
        } catch (error) {
          logger.error('Failed to add items via IPC:', error);
        }
      } else {
        logger.warn('IPC not connected, items add not synced');
      }
    },
    [shelfId, isConnected, invoke, addItemsToShelf, addOptimisticUpdate]
  );

  // Remove an item
  const removeItem = useCallback(
    async (itemId: string) => {
      if (!shelfId) {
        logger.error('Cannot remove item: shelfId is null');
        return;
      }

      logger.debug(`Removing item ${itemId} from shelf ${shelfId}`);

      // React 19: Add optimistic update for immediate UI feedback
      addOptimisticUpdate({ type: 'remove', itemId });

      // Update store
      removeItemFromShelf(shelfId, itemId);

      // Sync with main process
      if (isConnected) {
        try {
          await invoke('shelf:remove-item', shelfId, itemId);
          logger.debug(`Successfully synced item removal for shelf ${shelfId}`);
        } catch (error) {
          logger.error('Failed to remove item via IPC:', error);
        }
      } else {
        logger.warn('IPC not connected, item removal not synced');
      }
    },
    [shelfId, isConnected, invoke, removeItemFromShelf, addOptimisticUpdate]
  );

  // Update an item
  const updateItem = useCallback(
    async (itemId: string, updates: Partial<ShelfItem>) => {
      if (!shelfId) {
        logger.error('Cannot update item: shelfId is null');
        return;
      }

      logger.debug(`Updating item ${itemId} in shelf ${shelfId}`);

      // Optimistic update
      updateItemInShelf(shelfId, itemId, updates);

      // Sync with main process
      if (isConnected) {
        try {
          await invoke('shelf:update-item', shelfId, itemId, updates);
          logger.debug(`Successfully synced item update for shelf ${shelfId}`);
        } catch (error) {
          logger.error('Failed to update item via IPC:', error);
          // Note: No rollback needed - next sync from main process will correct state if needed
        }
      } else {
        logger.warn('IPC not connected, item update not synced');
      }
    },
    [shelfId, isConnected, invoke, updateItemInShelf]
  );

  // Clear all items
  const clearItems = useCallback(async () => {
    if (!shelfId) {
      logger.error('Cannot clear items: shelfId is null');
      return;
    }

    logger.debug(`Clearing all items from shelf ${shelfId}`);

    // Optimistic update
    clearShelfItems(shelfId);

    // Sync with main process
    if (isConnected) {
      try {
        await invoke('shelf:clear-items', shelfId);
        logger.debug(`Successfully synced item clear for shelf ${shelfId}`);
      } catch (error) {
        logger.error('Failed to clear items via IPC:', error);
        // Note: No rollback needed - next sync from main process will correct state if needed
      }
    } else {
      logger.warn('IPC not connected, item clear not synced');
    }
  }, [shelfId, isConnected, invoke, clearShelfItems]);

  return {
    items: optimisticItems, // React 19: Use optimistic items for immediate UI feedback
    addItem,
    addItems,
    removeItem,
    updateItem,
    clearItems,
  };
}
