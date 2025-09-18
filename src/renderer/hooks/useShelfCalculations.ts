/**
 * @file useShelfCalculations.ts
 * @description React hook for performance-optimized shelf calculations.
 * Memoizes expensive calculations related to shelf dimensions, virtualization,
 * and display modes to prevent unnecessary recalculations.
 *
 * @usage
 * ```typescript
 * const { shouldVirtualize, calculatedHeight, isCompact } = useShelfCalculations(config);
 * ```
 */

import { useMemo } from 'react';
import { ShelfConfig } from '@shared/types';
import {
  SHELF_CONSTANTS,
  shouldVirtualize as shouldVirtualizeItems,
  shouldUseCompactMode,
  calculateShelfHeight,
} from '../constants/shelf';

interface ShelfCalculations {
  shouldVirtualize: boolean;
  calculatedHeight: number;
  isCompact: boolean;
  itemHeight: number;
  visibleItemCount: number;
  maxVisibleItems: number;
  hasOverflow: boolean;
  animatedItemCount: number;
}

/**
 * Hook for calculating shelf display properties
 */
export function useShelfCalculations(config: ShelfConfig): ShelfCalculations {
  return useMemo(() => {
    const itemCount = config.items.length;
    const isCompact = shouldUseCompactMode(itemCount);
    const itemHeight = isCompact
      ? SHELF_CONSTANTS.COMPACT_ITEM_HEIGHT
      : SHELF_CONSTANTS.ITEM_HEIGHT;

    const calculatedHeight = calculateShelfHeight(itemCount, isCompact);
    const maxVisibleItems = Math.floor(SHELF_CONSTANTS.MAX_HEIGHT / itemHeight);
    const hasOverflow = itemCount > maxVisibleItems;

    return {
      shouldVirtualize: shouldVirtualizeItems(itemCount),
      calculatedHeight,
      isCompact,
      itemHeight,
      visibleItemCount: Math.min(itemCount, maxVisibleItems),
      maxVisibleItems,
      hasOverflow,
      animatedItemCount: Math.min(itemCount, SHELF_CONSTANTS.MAX_STAGGERED_ANIMATIONS),
    };
  }, [config.items.length]);
}

/**
 * Hook for calculating animation delays
 */
export function useAnimationDelays(itemCount: number, enabled: boolean = true): number[] {
  return useMemo(() => {
    if (!enabled || itemCount === 0) return [];

    const maxAnimated = Math.min(itemCount, SHELF_CONSTANTS.MAX_STAGGERED_ANIMATIONS);
    const delays: number[] = [];

    for (let i = 0; i < maxAnimated; i++) {
      delays.push(i * SHELF_CONSTANTS.ANIMATION_STAGGER_DELAY_MS);
    }

    return delays;
  }, [itemCount, enabled]);
}

/**
 * Hook for calculating virtualized list properties
 */
export function useVirtualizedListCalculations(
  itemCount: number,
  containerHeight: number,
  scrollTop: number,
  itemHeight: number
) {
  return useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + visibleCount + SHELF_CONSTANTS.OVERSCAN_COUNT,
      itemCount
    );
    const offsetY = startIndex * itemHeight;

    return {
      startIndex: Math.max(0, startIndex - SHELF_CONSTANTS.OVERSCAN_COUNT),
      endIndex,
      offsetY,
      totalHeight: itemCount * itemHeight,
      visibleCount,
    };
  }, [itemCount, containerHeight, scrollTop, itemHeight]);
}

/**
 * Hook for calculating shelf opacity based on state
 */
export function useShelfOpacity(
  baseOpacity: number,
  isDragOver: boolean,
  isPinned: boolean
): number {
  return useMemo(() => {
    if (isDragOver) {
      return SHELF_CONSTANTS.DRAG_HIGHLIGHT_OPACITY;
    }
    if (!isPinned) {
      return baseOpacity * 0.8; // Slightly more transparent when unpinned
    }
    return baseOpacity;
  }, [baseOpacity, isDragOver, isPinned]);
}

/**
 * Hook for calculating shelf position constraints
 */
export function useShelfPositionConstraints(windowWidth: number, windowHeight: number) {
  return useMemo(() => {
    const padding = 20;

    return {
      minX: padding,
      maxX: windowWidth - SHELF_CONSTANTS.DEFAULT_WIDTH - padding,
      minY: padding,
      maxY: windowHeight - SHELF_CONSTANTS.DEFAULT_HEIGHT - padding,
      constrainPosition: (x: number, y: number) => ({
        x: Math.max(padding, Math.min(x, windowWidth - SHELF_CONSTANTS.DEFAULT_WIDTH - padding)),
        y: Math.max(padding, Math.min(y, windowHeight - SHELF_CONSTANTS.DEFAULT_HEIGHT - padding)),
      }),
    };
  }, [windowWidth, windowHeight]);
}
