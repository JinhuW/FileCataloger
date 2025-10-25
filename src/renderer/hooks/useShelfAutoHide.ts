/**
 * @file useShelfAutoHide.ts
 * @description Custom hook for managing shelf auto-hide behavior.
 * Automatically hides empty unpinned shelves after a configurable delay.
 */

import { useEffect, useRef } from 'react';
import { AUTO_HIDE } from '@renderer/constants/ui';
import { logger } from '@shared/logger';

/**
 * Options for shelf auto-hide behavior
 */
export interface UseShelfAutoHideOptions {
  /**
   * Delay in milliseconds before auto-hiding (defaults to AUTO_HIDE.DELAY_MS)
   */
  delayMs?: number;
  /**
   * Whether auto-hide is enabled (defaults to true)
   */
  enabled?: boolean;
  /**
   * Callback executed when shelf should close
   */
  onClose: () => void;
}

/**
 * Hook for managing shelf auto-hide behavior.
 * Automatically triggers close callback when shelf is empty and unpinned.
 *
 * @param shelfId - Unique identifier for the shelf
 * @param isEmpty - Whether the shelf has no items
 * @param isPinned - Whether the shelf is pinned
 * @param options - Configuration options
 *
 * @example
 * ```typescript
 * useShelfAutoHide(
 *   shelfId,
 *   items.length === 0,
 *   config.isPinned,
 *   { onClose: handleClose }
 * );
 * ```
 */
export function useShelfAutoHide(
  shelfId: string,
  isEmpty: boolean,
  isPinned: boolean,
  options: UseShelfAutoHideOptions
): void {
  const { delayMs = AUTO_HIDE.DELAY_MS, enabled = true, onClose } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Only auto-hide if enabled, empty, and not pinned
    if (!enabled || !isEmpty || isPinned) {
      return;
    }

    logger.info(`⏰ Shelf ${shelfId} is empty and unpinned, scheduling auto-hide in ${delayMs}ms`);

    timeoutRef.current = setTimeout(() => {
      logger.info(`🗑️ Auto-hiding empty shelf ${shelfId}`);
      onClose();
    }, delayMs);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        logger.debug(`Clearing auto-hide timer for shelf ${shelfId}`);
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [shelfId, isEmpty, isPinned, enabled, delayMs, onClose]);
}
