import { useEffect, useRef, useCallback } from 'react';

export interface KeyboardNavigationOptions {
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onEnter?: () => void;
  onEscape?: () => void;
  onDelete?: () => void;
  onTab?: (shiftKey: boolean) => void;
  enabled?: boolean;
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  const {
    onArrowLeft,
    onArrowRight,
    onArrowUp,
    onArrowDown,
    onEnter,
    onEscape,
    onDelete,
    onTab,
    enabled = true,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      switch (event.key) {
        case 'ArrowLeft':
          if (onArrowLeft) {
            event.preventDefault();
            onArrowLeft();
          }
          break;
        case 'ArrowRight':
          if (onArrowRight) {
            event.preventDefault();
            onArrowRight();
          }
          break;
        case 'ArrowUp':
          if (onArrowUp) {
            event.preventDefault();
            onArrowUp();
          }
          break;
        case 'ArrowDown':
          if (onArrowDown) {
            event.preventDefault();
            onArrowDown();
          }
          break;
        case 'Enter':
          if (onEnter) {
            event.preventDefault();
            onEnter();
          }
          break;
        case 'Escape':
          if (onEscape) {
            event.preventDefault();
            onEscape();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (
            onDelete &&
            (event.key === 'Delete' || (event.key === 'Backspace' && event.metaKey))
          ) {
            event.preventDefault();
            onDelete();
          }
          break;
        case 'Tab':
          if (onTab) {
            event.preventDefault();
            onTab(event.shiftKey);
          }
          break;
      }
    },
    [enabled, onArrowLeft, onArrowRight, onArrowUp, onArrowDown, onEnter, onEscape, onDelete, onTab]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);
}

export function useFocusableList<T extends HTMLElement>(
  itemCount: number,
  options?: {
    orientation?: 'horizontal' | 'vertical';
    loop?: boolean;
    onSelect?: (index: number) => void;
  }
) {
  const containerRef = useRef<T>(null);
  const currentIndexRef = useRef(0);
  const { orientation = 'horizontal', loop = true, onSelect } = options || {};

  const focusItem = useCallback((index: number) => {
    if (!containerRef.current) return;

    const items = containerRef.current.querySelectorAll(
      '[role="tab"], [role="listitem"], [tabindex="0"]'
    );
    if (items[index]) {
      (items[index] as HTMLElement).focus();
      currentIndexRef.current = index;
    }
  }, []);

  const handleKeyNavigation = useCallback(
    (event: React.KeyboardEvent) => {
      const isHorizontal = orientation === 'horizontal';
      const nextKey = isHorizontal ? 'ArrowRight' : 'ArrowDown';
      const prevKey = isHorizontal ? 'ArrowLeft' : 'ArrowUp';

      let newIndex = currentIndexRef.current;

      switch (event.key) {
        case nextKey:
          event.preventDefault();
          newIndex = currentIndexRef.current + 1;
          if (newIndex >= itemCount) {
            newIndex = loop ? 0 : itemCount - 1;
          }
          break;
        case prevKey:
          event.preventDefault();
          newIndex = currentIndexRef.current - 1;
          if (newIndex < 0) {
            newIndex = loop ? itemCount - 1 : 0;
          }
          break;
        case 'Home':
          event.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          newIndex = itemCount - 1;
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          onSelect?.(currentIndexRef.current);
          return;
      }

      if (newIndex !== currentIndexRef.current) {
        focusItem(newIndex);
      }
    },
    [itemCount, orientation, loop, onSelect, focusItem]
  );

  return {
    containerRef,
    handleKeyNavigation,
    focusItem,
    currentIndex: currentIndexRef.current,
  };
}
