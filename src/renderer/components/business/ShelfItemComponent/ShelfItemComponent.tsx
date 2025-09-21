/**
 * @file ShelfItemComponent.tsx
 * @description Individual shelf item component with rich interaction features including hover states,
 * context menus, and quick actions. Supports both compact and normal display modes.
 *
 * @props {ShelfItem} item - The shelf item data to display
 * @props {boolean} isCompact - Whether to render in compact mode (smaller size)
 * @props {function} onAction - Callback for item actions (open, copy, remove)
 *
 * @features
 * - Context-aware file type icons based on file extension
 * - Hover states with quick action buttons (copy, remove)
 * - Right-click context menu with full action list
 * - Compact and normal display modes with different layouts
 * - File size formatting (B, KB, MB, GB)
 * - Relative time formatting (just now, 5m ago, 2h ago, etc.)
 * - Smooth animations and transitions
 * - Optimized re-rendering with custom comparison function
 *
 * @usage
 * ```tsx
 * <ShelfItemComponent
 *   item={shelfItem}
 *   isCompact={items.length > threshold}
 *   onAction={handleItemAction}
 * />
 * ```
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShelfItem } from '@shared/types';
import { useShelfItemAccessibility } from '@renderer/hooks/useAccessibility';
import { getFileIcon, getTypeIcon } from '@renderer/utils/fileTypeIcons';

export interface ShelfItemComponentProps {
  item: ShelfItem;
  isCompact: boolean;
  onAction: (action: string, item: ShelfItem) => void;
  index: number;
  totalCount: number;
  isSelected?: boolean;
}

/**
 * Comparison function for React.memo to prevent unnecessary re-renders
 */
const shelfItemPropsAreEqual = (
  prevProps: ShelfItemComponentProps,
  nextProps: ShelfItemComponentProps
): boolean => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.size === nextProps.item.size &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.index === nextProps.index &&
    prevProps.totalCount === nextProps.totalCount &&
    prevProps.item.createdAt === nextProps.item.createdAt &&
    prevProps.isCompact === nextProps.isCompact &&
    prevProps.onAction === nextProps.onAction
  );
};

/**
 * Individual shelf item component
 */
export const ShelfItemComponent = React.memo<ShelfItemComponentProps>(
  ({ item, isCompact, onAction, index, totalCount, isSelected = false }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showActions, setShowActions] = useState(false);

    // Debug logging for hover state
    useEffect(() => {
      if (isHovered) {
        // Debug logging removed for production
      }
    }, [isHovered, item.name]);

    // Get ARIA attributes for accessibility
    const itemAccessibility = useShelfItemAccessibility(item, index, totalCount);

    // Get item icon based on type
    const getItemIcon = useCallback((item: ShelfItem): string => {
      if (item.type === 'file' && item.path) {
        return getFileIcon(item.path);
      }
      return getTypeIcon(item.type);
    }, []);

    // Format item size
    const formatSize = useCallback((bytes?: number): string => {
      if (!bytes) return '';

      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;

      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }

      return `${size.toFixed(1)} ${units[unitIndex]}`;
    }, []);

    // Format creation date
    const formatDate = useCallback((timestamp: number): string => {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    }, []);

    const handleAction = useCallback(
      (action: string, event: React.MouseEvent) => {
        event.stopPropagation();
        onAction(action, item);
      },
      [onAction, item]
    );

    const handleItemClick = useCallback(() => {
      onAction('open', item);
    }, [onAction, item]);

    return (
      <motion.div
        className={`shelf-item ${isCompact ? 'compact' : ''} ${isSelected ? 'selected' : ''}`}
        {...itemAccessibility}
        onClick={handleItemClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          setShowActions(false);
        }}
        onContextMenu={e => {
          e.preventDefault();
          setShowActions(!showActions);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleItemClick();
          }
        }}
        whileHover={{
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          scale: 1.02,
        }}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: isCompact ? '4px 8px' : '8px 12px',
          background: isSelected ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          border: isSelected
            ? '2px solid rgba(255, 255, 255, 0.3)'
            : '1px solid rgba(255, 255, 255, 0.1)',
          cursor: 'pointer',
          position: 'relative',
          height: '100%',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
      >
        {/* Item Icon */}
        <div
          style={{
            width: isCompact ? '16px' : '24px',
            height: isCompact ? '16px' : '24px',
            marginRight: isCompact ? '8px' : '12px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={getItemIcon(item)}
            alt={`${item.type} icon`}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'brightness(0.9)',
            }}
          />
        </div>

        {/* Item Content */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          {/* Item Name */}
          <div
            style={{
              color: 'white',
              fontSize: isCompact ? '12px' : '14px',
              fontWeight: '500',
              marginBottom: isCompact ? '0' : '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={item.name}
          >
            {item.name}
          </div>

          {/* Item Details (only in non-compact mode) */}
          {!isCompact && (
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '11px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <span>{item.type}</span>
              {item.size && <span>{formatSize(item.size)}</span>}
              <span>{formatDate(item.createdAt)}</span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <AnimatePresence>
          {(isHovered || showActions) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{
                display: 'flex',
                gap: '4px',
                marginLeft: '8px',
              }}
            >
              {/* Copy Button */}
              <motion.button
                onClick={e => handleAction('copy', e)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'rgba(59, 130, 246, 0.8)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontSize: '10px',
                }}
                title="Copy"
              >
                📋
              </motion.button>

              {/* Remove Button */}
              <motion.button
                onClick={e => handleAction('remove', e)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'rgba(239, 68, 68, 0.8)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  fontSize: '10px',
                }}
                title="Remove"
              >
                🗑️
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context Menu */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                background: 'rgba(0, 0, 0, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '4px',
                zIndex: 1000,
                minWidth: '100px',
              }}
            >
              <button
                onClick={e => handleAction('open', e)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  padding: '4px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  fontSize: '12px',
                }}
              >
                Open
              </button>
              <button
                onClick={e => handleAction('copy', e)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  padding: '4px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  fontSize: '12px',
                }}
              >
                Copy
              </button>
              <button
                onClick={e => handleAction('remove', e)}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  padding: '4px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  fontSize: '12px',
                }}
              >
                Remove
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  },
  shelfItemPropsAreEqual
);

ShelfItemComponent.displayName = 'ShelfItemComponent';
