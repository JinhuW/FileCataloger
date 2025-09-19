/**
 * @file useAccessibility.ts
 * @description React hooks for enhancing accessibility in shelf components.
 * Provides ARIA attributes, keyboard navigation, and screen reader support.
 *
 * @features
 * - ARIA attributes for semantic markup
 * - Keyboard navigation support
 * - Live region announcements
 * - Focus management
 * - Screen reader optimizations
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ShelfConfig, ShelfItem } from '@shared/types';

/**
 * Provides ARIA attributes for the main shelf container
 */
export function useShelfAccessibility(config: ShelfConfig) {
  const itemCount = config.items.length;
  const statusText = config.isPinned ? 'pinned' : 'unpinned';

  return {
    role: 'region',
    'aria-label': `File shelf ${config.id} with ${itemCount} item${itemCount !== 1 ? 's' : ''}, ${statusText}`,
    'aria-live': 'polite' as const,
    'aria-atomic': false,
    'aria-busy': false,
    'aria-dropeffect': 'copy' as const,
    tabIndex: 0,
  };
}

/**
 * Provides ARIA attributes for individual shelf items
 */
export function useShelfItemAccessibility(item: ShelfItem, index: number, totalCount: number) {
  return {
    role: 'listitem',
    'aria-label': `${item.name}, ${item.type} item ${index + 1} of ${totalCount}`,
    'aria-posinset': index + 1,
    'aria-setsize': totalCount,
    'aria-describedby': item.path ? `${item.name}-path` : undefined,
    tabIndex: 0,
  };
}

/**
 * Hook for keyboard navigation in lists
 */
export function useKeyboardNavigation<T extends HTMLElement>(
  items: ShelfItem[],
  onItemSelect?: (item: ShelfItem) => void,
  onItemRemove?: (itemId: string) => void,
  onClose?: () => void
) {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const containerRef = useRef<T>(null);

  const focusItem = useCallback((index: number) => {
    if (containerRef.current) {
      const items = containerRef.current.querySelectorAll('[role="listitem"]');
      const item = items[index] as HTMLElement;
      if (item) {
        item.focus();
        setSelectedIndex(index);
      }
    }
  }, []); // Empty dependency array - stable reference

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { key, ctrlKey, metaKey } = event;
      const cmdKey = ctrlKey || metaKey;

      switch (key) {
        case 'ArrowDown':
          event.preventDefault();
          if (selectedIndex < items.length - 1) {
            focusItem(selectedIndex + 1);
          } else {
            focusItem(0); // Wrap to start
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (selectedIndex > 0) {
            focusItem(selectedIndex - 1);
          } else {
            focusItem(items.length - 1); // Wrap to end
          }
          break;

        case 'Home':
          event.preventDefault();
          focusItem(0);
          break;

        case 'End':
          event.preventDefault();
          focusItem(items.length - 1);
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < items.length && onItemSelect) {
            onItemSelect(items[selectedIndex]);
          }
          break;

        case 'Delete':
        case 'Backspace':
          if (selectedIndex >= 0 && selectedIndex < items.length && onItemRemove) {
            event.preventDefault();
            const itemToRemove = items[selectedIndex];
            onItemRemove(itemToRemove.id);

            // Move focus to next item or previous if at end
            if (selectedIndex >= items.length - 1 && selectedIndex > 0) {
              focusItem(selectedIndex - 1);
            }
          }
          break;

        case 'Escape':
          event.preventDefault();
          if (onClose) {
            onClose();
          }
          break;

        case 'a':
          if (cmdKey) {
            event.preventDefault();
            // Select all items (could trigger a select all state)
          }
          break;

        case 'c':
          if (cmdKey && selectedIndex >= 0) {
            event.preventDefault();
            const item = items[selectedIndex];
            if (item.content || item.path) {
              navigator.clipboard.writeText(item.content || item.path || item.name);
            }
          }
          break;
      }
    },
    [selectedIndex, items.length, focusItem, onItemSelect, onItemRemove, onClose]
  );

  return {
    containerRef,
    selectedIndex,
    handleKeyDown,
    focusItem,
  };
}

/**
 * Hook for managing focus trap within a container
 */
export function useFocusTrap(enabled: boolean = true) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
    );

    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    return () => container.removeEventListener('keydown', handleTabKey);
  }, [enabled]);

  return containerRef;
}

/**
 * Hook for live region announcements
 */
export function useLiveAnnouncer() {
  const [announcement, setAnnouncement] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const announce = useCallback((message: string) => {
    // Clear any pending announcement
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set the announcement
    setAnnouncement(message);

    // Clear after a delay to allow next announcement
    timeoutRef.current = setTimeout(() => {
      setAnnouncement('');
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    announcement,
    announce,
    ariaLive: 'polite' as const,
    role: 'status',
    'aria-atomic': true,
  };
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useShelfKeyboardShortcuts(config: {
  onTogglePin?: () => void;
  onClose?: () => void;
  onClear?: () => void;
}) {
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const { key, ctrlKey, metaKey, shiftKey } = event;
      const cmdKey = ctrlKey || metaKey;

      // Cmd/Ctrl + Shift + P: Toggle pin
      if (cmdKey && shiftKey && key === 'P' && config.onTogglePin) {
        event.preventDefault();
        config.onTogglePin();
      }

      // Cmd/Ctrl + W: Close shelf
      if (cmdKey && key === 'w' && config.onClose) {
        event.preventDefault();
        config.onClose();
      }

      // Cmd/Ctrl + K: Clear shelf
      if (cmdKey && key === 'k' && config.onClear) {
        event.preventDefault();
        config.onClear();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [config]);
}
