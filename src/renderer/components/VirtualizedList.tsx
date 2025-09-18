import React, { useState, useMemo, useCallback } from 'react';
import { ShelfItem } from '@shared/types';

export interface VirtualizedListProps {
  items: ShelfItem[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: ShelfItem, index: number) => React.ReactNode;
  overscan?: number;
}

/**
 * Virtualized list component for performance optimization
 * Only renders visible items plus overscan buffer
 */
export const VirtualizedList = React.memo<VirtualizedListProps>(
  ({ items, itemHeight, containerHeight, renderItem, overscan = 3 }) => {
    const [scrollTop, setScrollTop] = useState(0);

    // Calculate visible range
    const visibleRange = useMemo(() => {
      const visibleStart = Math.floor(scrollTop / itemHeight);
      const visibleEnd = Math.min(
        visibleStart + Math.ceil(containerHeight / itemHeight),
        items.length - 1
      );

      return {
        start: Math.max(0, visibleStart - overscan),
        end: Math.min(items.length - 1, visibleEnd + overscan),
      };
    }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

    // Get visible items
    const visibleItems = useMemo(() => {
      return items.slice(visibleRange.start, visibleRange.end + 1);
    }, [items, visibleRange.start, visibleRange.end]);

    // Total height of all items
    const totalHeight = items.length * itemHeight;

    // Offset for visible items
    const offsetY = visibleRange.start * itemHeight;

    // Handle scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    }, []);

    return (
      <div
        className="virtualized-list-container"
        style={{
          height: containerHeight,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        onScroll={handleScroll}
      >
        {/* Total height spacer */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {/* Visible items container */}
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {visibleItems.map((item, index) => {
              const actualIndex = visibleRange.start + index;
              return (
                <div
                  key={item.id}
                  style={{
                    height: itemHeight,
                    marginBottom: '1px',
                  }}
                >
                  {renderItem(item, actualIndex)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

VirtualizedList.displayName = 'VirtualizedList';
