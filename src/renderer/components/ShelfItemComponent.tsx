import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShelfItem } from '@shared/types';

export interface ShelfItemComponentProps {
  item: ShelfItem;
  isCompact: boolean;
  onAction: (action: string, item: ShelfItem) => void;
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
    prevProps.item.createdAt === nextProps.item.createdAt &&
    prevProps.isCompact === nextProps.isCompact &&
    prevProps.onAction === nextProps.onAction
  );
};

/**
 * Individual shelf item component
 */
export const ShelfItemComponent = React.memo<ShelfItemComponentProps>(
  ({ item, isCompact, onAction }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [showActions, setShowActions] = useState(false);

    // Get item icon based on type
    const getItemIcon = useCallback((item: ShelfItem): string => {
      switch (item.type) {
        case 'file': {
          const extension = item.path ? item.path.split('.').pop()?.toLowerCase() : '';
          switch (extension) {
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'bmp':
            case 'webp':
              return '🖼️';
            case 'pdf':
              return '📄';
            case 'txt':
            case 'md':
              return '📝';
            case 'zip':
            case 'rar':
            case '7z':
              return '📦';
            case 'mp4':
            case 'mov':
            case 'avi':
              return '🎬';
            case 'mp3':
            case 'wav':
            case 'flac':
              return '🎵';
            default:
              return '📁';
          }
        }
        case 'text':
          return '📝';
        case 'url':
          return '🔗';
        case 'image':
          return '🖼️';
        default:
          return '❓';
      }
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
        className={`shelf-item ${isCompact ? 'compact' : ''}`}
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
        whileHover={{
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          scale: 1.02,
        }}
        whileTap={{ scale: 0.98 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: isCompact ? '4px 8px' : '8px 12px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          cursor: 'pointer',
          position: 'relative',
          height: '100%',
          transition: 'all 0.2s ease',
        }}
      >
        {/* Item Icon */}
        <div
          style={{
            fontSize: isCompact ? '16px' : '24px',
            marginRight: isCompact ? '8px' : '12px',
            flexShrink: 0,
          }}
        >
          {getItemIcon(item)}
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
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: isCompact ? '0' : '2px',
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
