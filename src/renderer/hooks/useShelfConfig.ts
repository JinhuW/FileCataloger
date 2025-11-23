/**
 * @file useShelfConfig.ts
 * @description Custom hook for managing shelf configuration with IPC synchronization.
 * Provides centralized configuration management and syncs with the main process.
 */

import { useEffect, useCallback } from 'react';
import { ShelfConfig } from '@shared/types';
import { useShelfStore } from '@renderer/stores/shelfStore';
import { useIPC } from './useIPC';
import { isShelfConfig } from '@renderer/utils/typeGuards';
import { logger } from '@shared/logger';

/**
 * Result of the useShelfConfig hook
 */
export interface UseShelfConfigResult {
  /**
   * Current shelf configuration (null if not loaded or not found)
   */
  config: ShelfConfig | null;
  /**
   * Update the shelf configuration
   */
  updateConfig: (changes: Partial<ShelfConfig>) => Promise<void>;
  /**
   * Whether the configuration is loading
   */
  isLoading: boolean;
}

/**
 * Hook for managing shelf configuration with Zustand store and IPC sync.
 * Automatically synchronizes shelf config updates with the main process.
 *
 * @param shelfId - Unique identifier for the shelf (optional, can be null during initialization)
 * @returns Object with config, updateConfig function, and loading state
 *
 * @example
 * ```typescript
 * const { config, updateConfig, isLoading } = useShelfConfig(shelfId);
 *
 * // Update configuration
 * await updateConfig({ isPinned: true });
 * ```
 */
export function useShelfConfig(shelfId: string | null): UseShelfConfigResult {
  const { invoke, on, isConnected } = useIPC();
  const shelf = useShelfStore(state => (shelfId ? state.getShelf(shelfId) : null));
  const addShelf = useShelfStore(state => state.addShelf);
  const updateShelfInStore = useShelfStore(state => state.updateShelf);

  // Listen for configuration updates from main process
  useEffect(() => {
    if (!isConnected || !shelfId) return;

    const cleanup = on('shelf:config', (newConfig: unknown) => {
      if (isShelfConfig(newConfig)) {
        logger.debug(
          `Received shelf config update for ${shelfId}:`,
          newConfig.id,
          'with',
          newConfig.items.length,
          'items'
        );

        // Update or add the shelf in the store
        if (shelf) {
          updateShelfInStore(newConfig.id, newConfig);
        } else {
          addShelf(newConfig);
        }
      } else if (process.env.NODE_ENV === 'development') {
        logger.warn('Received invalid shelf config:', newConfig);
      }
    });

    return cleanup;
  }, [isConnected, shelfId, on, shelf, addShelf, updateShelfInStore]);

  // Update configuration and sync with main process
  const updateConfig = useCallback(
    async (changes: Partial<ShelfConfig>) => {
      if (!shelfId) {
        logger.error('Cannot update config: shelfId is null');
        return;
      }

      // Update local store first (optimistic update)
      updateShelfInStore(shelfId, changes);

      // Notify main process of configuration changes
      if (isConnected) {
        try {
          await invoke('shelf:update-config', shelfId, changes);
          logger.debug(`Successfully synced config update for shelf ${shelfId}`);
        } catch (error) {
          logger.error('Failed to update config via IPC:', error);
          // TODO: Consider rolling back the optimistic update on error
        }
      } else {
        logger.warn('IPC not connected, config update not synced');
      }
    },
    [shelfId, isConnected, invoke, updateShelfInStore]
  );

  return {
    config: shelf || null,
    updateConfig,
    isLoading: !isConnected || (shelfId !== null && !shelf),
  };
}
