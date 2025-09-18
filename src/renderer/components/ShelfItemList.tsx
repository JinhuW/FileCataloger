import React, { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShelfItem } from '@shared/types';
import { ShelfItemComponent } from './ShelfItemComponent';
import { VirtualizedList } from './VirtualizedList';

export interface ShelfItemListProps {
  items: ShelfItem[];
  isCompact: boolean;
  onItemAction: (action: string, item: ShelfItem) => void;
}

/**
 * Virtualized list component for shelf items
 * Optimizes rendering for large numbers of items
 */
export const ShelfItemList = React.memo<ShelfItemListProps>(
  ({ items, isCompact, onItemAction }) => {
    // Calculate item height based on display mode
    const itemHeight = useMemo(() => {
      return isCompact ? 32 : 60;
    }, [isCompact]);

    // Calculate margin between items
    const itemMargin = isCompact ? 1 : 4;

    // Calculate total height needed for all items (including margins)
    const totalItemsHeight = items.length * (itemHeight + itemMargin) + 16; // 16px for container padding

    // Container height - make it responsive
    const maxHeight = 400;
    const containerHeight = Math.min(totalItemsHeight, maxHeight);

    // Determine if scrollbar is needed
    const needsScrollbar = totalItemsHeight > maxHeight;

    // Render individual item
    const renderItem = useCallback(
      (item: ShelfItem, index: number) => {
        return (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
            style={{
              height: itemHeight,
              marginBottom: index === items.length - 1 ? 0 : isCompact ? '1px' : '4px',
            }}
          >
            <ShelfItemComponent item={item} isCompact={isCompact} onAction={onItemAction} />
          </motion.div>
        );
      },
      [itemHeight, isCompact, onItemAction, items.length]
    );

    // Use virtualization for large lists
    if (items.length > 50) {
      return (
        <div
          className="shelf-item-list virtualized"
          style={{
            height: containerHeight,
            overflow: 'hidden',
          }}
        >
          <VirtualizedList
            items={items}
            itemHeight={itemHeight}
            containerHeight={containerHeight}
            renderItem={renderItem}
            overscan={5}
          />
        </div>
      );
    }

    // Regular rendering for smaller lists
    return (
      <div
        className={`shelf-item-list ${needsScrollbar ? 'has-scrollbar' : 'no-scrollbar'}`}
        style={{
          padding: '8px',
          // Remove fixed height to let parent handle scrolling
          overflowY: 'visible',
          overflowX: 'hidden',
          position: 'relative',
        }}
      >
        {/* Show item count indicator when scrollbar is active */}
        {needsScrollbar && (
          <div
            className="item-count-indicator"
            style={{
              position: 'sticky',
              top: 0,
              right: 0,
              padding: '4px 8px',
              background: 'rgba(0, 0, 0, 0.6)',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '10px',
              borderRadius: '4px',
              zIndex: 10,
              textAlign: 'right',
              marginBottom: '4px',
            }}
          >
            {items.length} items • Scroll to see more
          </div>
        )}
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => renderItem(item, index))}
        </AnimatePresence>
      </div>
    );
  }
);

ShelfItemList.displayName = 'ShelfItemList';
