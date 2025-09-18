/**
 * @file useShelfCalculations.test.ts
 * @description Unit tests for the useShelfCalculations hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useShelfCalculations,
  useAnimationDelays,
  useVirtualizedListCalculations,
  useShelfOpacity,
  useShelfPositionConstraints,
} from '../useShelfCalculations';
import { SHELF_CONSTANTS } from '../../constants/shelf';
import type { ShelfConfig } from '@shared/types';

describe('useShelfCalculations', () => {
  const createMockConfig = (itemCount: number): ShelfConfig => ({
    id: 'test-shelf',
    position: { x: 0, y: 0 },
    dockPosition: null,
    isPinned: false,
    items: Array(itemCount)
      .fill(null)
      .map((_, i) => ({
        id: `item-${i}`,
        type: 'file' as const,
        name: `file-${i}.txt`,
        createdAt: Date.now(),
      })),
    isVisible: true,
    opacity: 1,
  });

  describe('useShelfCalculations', () => {
    it('should calculate basic properties for empty shelf', () => {
      const config = createMockConfig(0);
      const { result } = renderHook(() => useShelfCalculations(config));

      expect(result.current.shouldVirtualize).toBe(false);
      expect(result.current.calculatedHeight).toBe(SHELF_CONSTANTS.MIN_HEIGHT);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.itemHeight).toBe(SHELF_CONSTANTS.ITEM_HEIGHT);
      expect(result.current.visibleItemCount).toBe(0);
      expect(result.current.hasOverflow).toBe(false);
      expect(result.current.animatedItemCount).toBe(0);
    });

    it('should calculate properties for small shelf', () => {
      const config = createMockConfig(5);
      const { result } = renderHook(() => useShelfCalculations(config));

      expect(result.current.shouldVirtualize).toBe(false);
      expect(result.current.isCompact).toBe(false);
      expect(result.current.itemHeight).toBe(SHELF_CONSTANTS.ITEM_HEIGHT);
      expect(result.current.visibleItemCount).toBe(5);
      expect(result.current.hasOverflow).toBe(false);
      expect(result.current.animatedItemCount).toBe(5);
    });

    it('should enable compact mode for more than 10 items', () => {
      const config = createMockConfig(15);
      const { result } = renderHook(() => useShelfCalculations(config));

      expect(result.current.isCompact).toBe(true);
      expect(result.current.itemHeight).toBe(SHELF_CONSTANTS.COMPACT_ITEM_HEIGHT);
    });

    it('should enable virtualization for large item counts', () => {
      const config = createMockConfig(SHELF_CONSTANTS.VIRTUALIZATION_THRESHOLD + 10);
      const { result } = renderHook(() => useShelfCalculations(config));

      expect(result.current.shouldVirtualize).toBe(true);
    });

    it('should limit calculated height to max height', () => {
      const config = createMockConfig(100);
      const { result } = renderHook(() => useShelfCalculations(config));

      expect(result.current.calculatedHeight).toBe(SHELF_CONSTANTS.MAX_HEIGHT);
      expect(result.current.hasOverflow).toBe(true);
    });

    it('should limit animated items to max staggered animations', () => {
      const config = createMockConfig(SHELF_CONSTANTS.MAX_STAGGERED_ANIMATIONS + 10);
      const { result } = renderHook(() => useShelfCalculations(config));

      expect(result.current.animatedItemCount).toBe(SHELF_CONSTANTS.MAX_STAGGERED_ANIMATIONS);
    });

    it('should recalculate when item count changes', () => {
      const { result, rerender } = renderHook(({ config }) => useShelfCalculations(config), {
        initialProps: { config: createMockConfig(5) },
      });

      expect(result.current.visibleItemCount).toBe(5);
      expect(result.current.isCompact).toBe(false);

      rerender({ config: createMockConfig(15) });

      expect(result.current.visibleItemCount).toBe(15);
      expect(result.current.isCompact).toBe(true);
    });
  });

  describe('useAnimationDelays', () => {
    it('should return empty array when disabled', () => {
      const { result } = renderHook(() => useAnimationDelays(5, false));
      expect(result.current).toEqual([]);
    });

    it('should return empty array for zero items', () => {
      const { result } = renderHook(() => useAnimationDelays(0, true));
      expect(result.current).toEqual([]);
    });

    it('should calculate delays for each item', () => {
      const { result } = renderHook(() => useAnimationDelays(3, true));

      expect(result.current).toEqual([
        0,
        SHELF_CONSTANTS.ANIMATION_STAGGER_DELAY_MS,
        2 * SHELF_CONSTANTS.ANIMATION_STAGGER_DELAY_MS,
      ]);
    });

    it('should limit delays to max staggered animations', () => {
      const itemCount = SHELF_CONSTANTS.MAX_STAGGERED_ANIMATIONS + 5;
      const { result } = renderHook(() => useAnimationDelays(itemCount, true));

      expect(result.current).toHaveLength(SHELF_CONSTANTS.MAX_STAGGERED_ANIMATIONS);
    });

    it('should recalculate when item count changes', () => {
      const { result, rerender } = renderHook(
        ({ count, enabled }) => useAnimationDelays(count, enabled),
        { initialProps: { count: 2, enabled: true } }
      );

      expect(result.current).toHaveLength(2);

      rerender({ count: 5, enabled: true });
      expect(result.current).toHaveLength(5);
    });
  });

  describe('useVirtualizedListCalculations', () => {
    it('should calculate visible range correctly', () => {
      const { result } = renderHook(() => useVirtualizedListCalculations(100, 400, 0, 40));

      expect(result.current.visibleCount).toBe(10); // 400 / 40
      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBeGreaterThan(10); // Including overscan
      expect(result.current.offsetY).toBe(0);
      expect(result.current.totalHeight).toBe(4000); // 100 * 40
    });

    it('should include overscan items', () => {
      const { result } = renderHook(() => useVirtualizedListCalculations(100, 400, 200, 40));

      const expectedStartIndex = Math.floor(200 / 40); // 5
      const expectedVisibleCount = Math.ceil(400 / 40); // 10

      expect(result.current.startIndex).toBeLessThan(expectedStartIndex); // With overscan
      expect(result.current.endIndex).toBeGreaterThan(expectedStartIndex + expectedVisibleCount);
    });

    it('should handle scroll to bottom', () => {
      const { result } = renderHook(
        () => useVirtualizedListCalculations(50, 400, 1600, 40) // Scrolled to bottom
      );

      expect(result.current.endIndex).toBe(50); // Should not exceed total items
      expect(result.current.totalHeight).toBe(2000); // 50 * 40
    });

    it('should handle edge cases', () => {
      // No items
      const { result: noItems } = renderHook(() => useVirtualizedListCalculations(0, 400, 0, 40));
      expect(noItems.current.totalHeight).toBe(0);
      expect(noItems.current.startIndex).toBe(0);
      expect(noItems.current.endIndex).toBe(0);

      // Very small container
      const { result: smallContainer } = renderHook(() =>
        useVirtualizedListCalculations(100, 20, 0, 40)
      );
      expect(smallContainer.current.visibleCount).toBe(1);
    });
  });

  describe('useShelfOpacity', () => {
    it('should return drag highlight opacity when dragging over', () => {
      const { result } = renderHook(() => useShelfOpacity(0.8, true, false));
      expect(result.current).toBe(SHELF_CONSTANTS.DRAG_HIGHLIGHT_OPACITY);
    });

    it('should reduce opacity for unpinned shelves', () => {
      const { result } = renderHook(() => useShelfOpacity(1, false, false));
      expect(result.current).toBe(0.8); // 1 * 0.8
    });

    it('should return base opacity for pinned shelves', () => {
      const { result } = renderHook(() => useShelfOpacity(0.9, false, true));
      expect(result.current).toBe(0.9);
    });

    it('should prioritize drag over state', () => {
      const { result } = renderHook(() => useShelfOpacity(0.5, true, true));
      expect(result.current).toBe(SHELF_CONSTANTS.DRAG_HIGHLIGHT_OPACITY);
    });

    it('should recalculate when props change', () => {
      const { result, rerender } = renderHook(
        ({ opacity, isDragOver, isPinned }) => useShelfOpacity(opacity, isDragOver, isPinned),
        { initialProps: { opacity: 1, isDragOver: false, isPinned: true } }
      );

      expect(result.current).toBe(1);

      rerender({ opacity: 1, isDragOver: true, isPinned: true });
      expect(result.current).toBe(SHELF_CONSTANTS.DRAG_HIGHLIGHT_OPACITY);

      rerender({ opacity: 0.5, isDragOver: false, isPinned: false });
      expect(result.current).toBe(0.4); // 0.5 * 0.8
    });
  });

  describe('useShelfPositionConstraints', () => {
    it('should calculate position constraints', () => {
      const { result } = renderHook(() => useShelfPositionConstraints(1920, 1080));

      expect(result.current.minX).toBe(20);
      expect(result.current.minY).toBe(20);
      expect(result.current.maxX).toBe(1920 - SHELF_CONSTANTS.DEFAULT_WIDTH - 20);
      expect(result.current.maxY).toBe(1080 - SHELF_CONSTANTS.DEFAULT_HEIGHT - 20);
    });

    it('should constrain positions within bounds', () => {
      const { result } = renderHook(() => useShelfPositionConstraints(1920, 1080));

      // Test position within bounds
      const validPos = result.current.constrainPosition(500, 300);
      expect(validPos).toEqual({ x: 500, y: 300 });

      // Test position too far left
      const leftPos = result.current.constrainPosition(-100, 300);
      expect(leftPos.x).toBe(20);
      expect(leftPos.y).toBe(300);

      // Test position too far right
      const rightPos = result.current.constrainPosition(2000, 300);
      expect(rightPos.x).toBe(result.current.maxX);
      expect(rightPos.y).toBe(300);

      // Test position too high
      const topPos = result.current.constrainPosition(500, -50);
      expect(topPos.x).toBe(500);
      expect(topPos.y).toBe(20);

      // Test position too low
      const bottomPos = result.current.constrainPosition(500, 2000);
      expect(bottomPos.x).toBe(500);
      expect(bottomPos.y).toBe(result.current.maxY);
    });

    it('should recalculate when window dimensions change', () => {
      const { result, rerender } = renderHook(
        ({ width, height }) => useShelfPositionConstraints(width, height),
        { initialProps: { width: 1920, height: 1080 } }
      );

      const initialMaxX = result.current.maxX;
      const initialMaxY = result.current.maxY;

      rerender({ width: 1366, height: 768 });

      expect(result.current.maxX).toBeLessThan(initialMaxX);
      expect(result.current.maxY).toBeLessThan(initialMaxY);
    });

    it('should handle very small window sizes', () => {
      const { result } = renderHook(() => useShelfPositionConstraints(400, 300));

      // With small window, max positions might be less than min positions
      const constrainedPos = result.current.constrainPosition(200, 150);
      expect(constrainedPos.x).toBeGreaterThanOrEqual(20);
      expect(constrainedPos.y).toBeGreaterThanOrEqual(20);
    });
  });
});
