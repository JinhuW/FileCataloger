/**
 * @file useShelfAutoHide.ts
 * @description Custom hook for managing shelf auto-hide behavior.
 * Automatically hides empty unpinned shelves after a configurable delay.
 * CRITICAL: Respects drag state to prevent hiding during active drag operations.
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

  /**
   * CRITICAL FIX: Disable renderer-side auto-hide
   *
   * The renderer process has no knowledge of drag state in the main process.
   * This caused shelves to disappear while users were still dragging files.
   *
   * Auto-hide is now EXCLUSIVELY managed by the main process which has
   * full visibility into drag operations, global drag lock, and state machine.
   *
   * The main process will send IPC messages to close shelves when appropriate.
   *
   * See: src/main/modules/core/auto_hide_manager.ts
   *      src/main/modules/core/shelf_lifecycle_manager.ts
   */

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // DISABLED: Renderer-side auto-hide is disabled to prevent premature shelf closure
    // The main process handles all auto-hide logic with full drag state awareness
    logger.debug(
      `Renderer auto-hide disabled for shelf ${shelfId} - main process handles auto-hide`
    );

    // Return cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [shelfId, isEmpty, isPinned, enabled, delayMs, onClose]);
}
