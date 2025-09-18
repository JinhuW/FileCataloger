/**
 * @file Shelf.tsx
 * @description Main shelf component that provides a floating, draggable window for temporary file storage.
 * Features dynamic height adjustment, drag-and-drop support, and multiple display modes.
 *
 * @props {ShelfConfig} config - Complete shelf configuration including items, visibility, and settings
 * @props {function} onConfigChange - Callback for updating shelf configuration
 * @props {function} onItemAdd - Callback when new items are added to the shelf
 * @props {function} onItemRemove - Callback when items are removed from the shelf
 * @props {function} onClose - Callback when shelf is closed
 *
 * @key-features
 * - Dynamic height adjustment based on item count
 * - Compact mode for large item collections (>COMPACT_MODE_THRESHOLD)
 * - Drag-and-drop support for files, text, and URLs
 * - Animated transitions and hover effects
 * - IPC communication with main process for file operations
 * - Real-time drag state management and visual feedback
 * - Auto-scrolling content area with sticky header
 *
 * @usage
 * ```tsx
 * <Shelf
 *   config={shelfConfig}
 *   onConfigChange={handleConfigChange}
 *   onItemAdd={handleItemAdd}
 *   onItemRemove={handleItemRemove}
 *   onClose={handleClose}
 * />
 * ```
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShelfConfig, ShelfItem } from '@shared/types';
import { ShelfHeader } from '../ShelfHeader';
import { ShelfItemList } from '../ShelfItemList';
import { ShelfDropZone } from '../ShelfDropZone';
import { ErrorBoundary } from '../ErrorBoundary';
import { SHELF_CONSTANTS } from '@renderer/constants/shelf';
import { processDroppedFiles, cleanupItemThumbnails } from '@renderer/utils/fileProcessing';
import { useShelfCalculations, useShelfOpacity } from '@renderer/hooks/useShelfCalculations';
import {
  useShelfAccessibility,
  useKeyboardNavigation,
  useLiveAnnouncer,
  useShelfKeyboardShortcuts,
} from '@renderer/hooks/useAccessibility';
import { logger } from '@shared/logger';

export interface ShelfProps {
  config: ShelfConfig;
  onConfigChange: (config: Partial<ShelfConfig>) => void;
  onItemAdd: (item: ShelfItem) => void;
  onItemRemove: (itemId: string) => void;
  onClose: () => void;
}
export const Shelf = React.memo<ShelfProps>(
  ({ config, onConfigChange, onItemAdd, onItemRemove, onClose }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    // Use performance-optimized calculations
    const { calculatedHeight, isCompact } = useShelfCalculations(config);

    // Calculate dynamic opacity
    const dynamicOpacity = useShelfOpacity(config.opacity, isDragOver, config.isPinned);

    // Accessibility hooks
    const shelfAccessibility = useShelfAccessibility(config);
    const { announcement, announce, ...announceProps } = useLiveAnnouncer();
    const {
      containerRef,
      selectedIndex,
      handleKeyDown: handleListKeyDown,
    } = useKeyboardNavigation<HTMLDivElement>(
      config.items,
      item => {
        if (item.path && window.api) {
          window.api.send('shelf:open-item', { path: item.path });
        }
      },
      onItemRemove,
      onClose
    );

    // Global keyboard shortcuts
    useShelfKeyboardShortcuts({
      onTogglePin: () => onConfigChange({ isPinned: !config.isPinned }),
      onClose,
      onClear: () => {
        config.items.forEach(item => onItemRemove(item.id));
        announce('All items cleared from shelf');
      },
    });

    // Use items directly without filtering
    const filteredItems = config.items;

    // Handle item actions
    const handleItemAction = useCallback(
      (action: string, item: ShelfItem) => {
        switch (action) {
          case 'remove':
            onItemRemove(item.id);
            announce(`${item.name} removed from shelf`);
            break;
          case 'open':
            if (item.path && window.api) {
              window.api.send('shelf:open-item', { path: item.path });
              announce(`Opening ${item.name}`);
            }
            break;
          case 'copy':
            navigator.clipboard.writeText(item.content || item.name);
            announce(`${item.name} copied to clipboard`);
            break;
        }
      },
      [onItemRemove, announce]
    );

    // Handle drop events
    const handleDrop = useCallback(
      (items: ShelfItem[]) => {
        logger.debug('handleDrop called with', items.length, 'items');
        items.forEach((item, index) => {
          logger.debug(`Adding item ${index + 1}/${items.length}:`, item);
          onItemAdd(item);
        });
        setIsDragOver(false);

        // Announce to screen readers
        const itemText = items.length === 1 ? 'item' : 'items';
        announce(`${items.length} ${itemText} added to shelf`);
      },
      [onItemAdd, announce]
    );

    // Handle configuration changes
    const handleConfigChange = useCallback(
      (changes: Partial<ShelfConfig>) => {
        onConfigChange(changes);
      },
      [onConfigChange]
    );

    // Cleanup item thumbnails on unmount
    useEffect(() => {
      return () => {
        cleanupItemThumbnails(config.items);
      };
    }, [config.items]);

    return (
      <ErrorBoundary>
        <motion.div
          ref={containerRef}
          className={`shelf-container ${config.isPinned ? 'pinned' : ''} ${isCompact ? 'compact' : ''}`}
          {...shelfAccessibility}
          onKeyDown={handleListKeyDown}
          initial={{
            opacity: 0,
            scale: 0.95,
          }}
          animate={{
            opacity: config.isVisible ? dynamicOpacity : 0,
            scale: config.isVisible ? 1 : 0.9,
          }}
          transition={{ duration: SHELF_CONSTANTS.ANIMATION_DURATION_MS / 1000, ease: 'easeOut' }}
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            overflow: 'visible', // Allow content to be visible but clip at borders
            minWidth: `${SHELF_CONSTANTS.MIN_WIDTH}px`,
            maxWidth: `${SHELF_CONSTANTS.MAX_WIDTH}px`,
            height: `${calculatedHeight}px`,
            minHeight: `${SHELF_CONSTANTS.MIN_HEIGHT}px`,
            maxHeight: `${SHELF_CONSTANTS.MAX_HEIGHT}px`,
            transition: 'height 0.3s ease-out',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
          onDragOver={e => {
            e.preventDefault();
            e.stopPropagation();
            // This is crucial - it allows the drop
            e.dataTransfer.dropEffect = 'copy';
            setIsDragOver(true);
          }}
          onDragLeave={e => {
            // Only set drag over to false if we're leaving the shelf entirely
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;

            if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
              setIsDragOver(false);

              // Notify main process that drop operation ended
              if (window.api) {
                window.api.send('shelf:drop-end', config.id);
                logger.debug('Drop operation ended on shelf:', config.id);
              }
            }
          }}
          onDragEnter={e => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(true);

            // Notify main process that drop operation started
            if (window.api) {
              window.api.send('shelf:drop-start', config.id);
              logger.debug('Drop operation started on shelf:', config.id);
            }
          }}
          onDrop={async e => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(false);

            // Notify main process that drop is being processed
            if (window.api) {
              window.api.send('shelf:drop-end', config.id);
              logger.debug('Processing drop on shelf:', config.id);
            }

            // Process dropped items using utility function
            try {
              const items = await processDroppedFiles(e.dataTransfer);
              if (items.length > 0) {
                logger.debug('Dropping', items.length, 'items on shelf', config.id);
                logger.debug('Items:', items);

                // Notify main process about dropped files
                if (window.api) {
                  const filePaths = items
                    .filter(item => item.type === 'file' && item.path)
                    .map(item => item.path as string);

                  if (filePaths.length > 0) {
                    logger.debug('Notifying main process about', filePaths.length, 'dropped files');
                    window.api.send('shelf:files-dropped', {
                      shelfId: config.id,
                      files: filePaths,
                    });
                  }
                }

                handleDrop(items);
              } else {
                logger.debug('No valid items to drop');
              }
            } catch (error) {
              logger.error('Error processing drop:', error);
            }
          }}
        >
          {/* Inner container to properly handle overflow */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '12px',
              overflow: 'hidden',
              background: 'transparent',
            }}
          >
            {/* Shelf Header - Sticky position */}
            <div
              style={{
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                zIndex: 100,
                background: 'rgba(30, 30, 30, 0.95)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <ShelfHeader
                config={config}
                itemCount={filteredItems.length}
                onTogglePin={() => handleConfigChange({ isPinned: !config.isPinned })}
                onClose={onClose}
              />
            </div>

            {/* Shelf Content */}
            <div
              className="shelf-content"
              style={{
                flex: 1,
                overflow: 'auto',
                minHeight: '150px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              <AnimatePresence mode="sync">
                {filteredItems.length > 0 ? (
                  <ShelfItemList
                    key="items"
                    items={filteredItems}
                    isCompact={isCompact}
                    onItemAction={handleItemAction}
                    selectedIndex={selectedIndex}
                  />
                ) : (
                  <ShelfDropZone
                    key="dropzone"
                    isDragOver={isDragOver}
                    onDrop={handleDrop}
                    isEmpty={config.items.length === 0}
                    hasSearchQuery={false}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Drag Over Overlay */}
          <AnimatePresence>
            {isDragOver && (
              <motion.div
                className="drag-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '2px dashed rgba(59, 130, 246, 0.5)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 1000,
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{
                    color: 'rgba(59, 130, 246, 0.8)',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    textAlign: 'center',
                  }}
                >
                  Drop files here
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live announcements for screen readers */}
          <div
            {...announceProps}
            style={{
              position: 'absolute',
              left: '-10000px',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
            }}
          >
            {announcement}
          </div>
        </motion.div>
      </ErrorBoundary>
    );
  }
);

Shelf.displayName = 'Shelf';
