import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShelfConfig, ShelfItem } from '../../shared/types';
import { ShelfHeader } from './ShelfHeader';
import { ShelfItemList } from './ShelfItemList';
import { ShelfDropZone } from './ShelfDropZone';
import { ErrorBoundary } from './ErrorBoundary';
import { SHELF_CONSTANTS, ANIMATION_CONSTANTS } from '../../shared/constants';

export interface ShelfProps {
  config: ShelfConfig;
  onConfigChange: (config: Partial<ShelfConfig>) => void;
  onItemAdd: (item: ShelfItem) => void;
  onItemRemove: (itemId: string) => void;
  onClose: () => void;
}

/**
 * Main shelf component with compound component pattern
 */
export const Shelf = React.memo<ShelfProps>(({
  config,
  onConfigChange,
  onItemAdd,
  onItemRemove,
  onClose
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [shelfHeight, setShelfHeight] = useState<number>(SHELF_CONSTANTS.DEFAULT_HEIGHT); // Dynamic shelf height

  // Use items directly without filtering
  const filteredItems = config.items;

  // Handle item actions
  const handleItemAction = useCallback((action: string, item: ShelfItem) => {
    switch (action) {
      case 'remove':
        onItemRemove(item.id);
        break;
      case 'open':
        // Handle opening item
        break;
      case 'copy':
        // Handle copying item
        navigator.clipboard.writeText(item.content || item.name);
        break;
    }
  }, [onItemRemove]);

  // Handle drop events
  const handleDrop = useCallback((items: ShelfItem[]) => {
    console.log('🎯 handleDrop called with', items.length, 'items');
    items.forEach((item, index) => {
      console.log(`📤 Adding item ${index + 1}/${items.length}:`, item);
      onItemAdd(item);
    });
    setIsDragOver(false);
  }, [onItemAdd]);

  // Handle configuration changes
  const handleConfigChange = useCallback((changes: Partial<ShelfConfig>) => {
    onConfigChange(changes);
  }, [onConfigChange]);

  // Toggle compact mode and adjust height based on item count
  useEffect(() => {
    const itemCount = config.items.length;
    setIsCompact(itemCount > SHELF_CONSTANTS.COMPACT_MODE_THRESHOLD);
    
    // Dynamically adjust shelf height based on content
    const itemHeight = itemCount > SHELF_CONSTANTS.COMPACT_MODE_THRESHOLD ? SHELF_CONSTANTS.ITEM_HEIGHT_COMPACT : SHELF_CONSTANTS.ITEM_HEIGHT_NORMAL;
    const itemMargin = itemCount > SHELF_CONSTANTS.COMPACT_MODE_THRESHOLD ? SHELF_CONSTANTS.ITEM_MARGIN_COMPACT : SHELF_CONSTANTS.ITEM_MARGIN_NORMAL;
    const headerHeight = SHELF_CONSTANTS.HEADER_HEIGHT;
    const containerPadding = SHELF_CONSTANTS.CONTAINER_PADDING;
    const minContentHeight = SHELF_CONSTANTS.MIN_CONTENT_HEIGHT;
    const maxContentHeight = SHELF_CONSTANTS.MAX_CONTENT_HEIGHT;
    
    if (itemCount === 0) {
      // When empty, show a reasonable size for the drop zone
      setShelfHeight(SHELF_CONSTANTS.EMPTY_SHELF_HEIGHT);
    } else {
      // Calculate ideal height based on items (including margins between them)
      const totalItemsHeight = itemCount * (itemHeight + itemMargin) + containerPadding;
      const contentHeight = Math.min(
        Math.max(totalItemsHeight, minContentHeight), 
        maxContentHeight
      );
      const idealHeight = headerHeight + contentHeight + SHELF_CONSTANTS.EXTRA_HEIGHT_PADDING;
      
      // Set height within bounds
      setShelfHeight(Math.min(Math.max(idealHeight, SHELF_CONSTANTS.MIN_HEIGHT), SHELF_CONSTANTS.MAX_HEIGHT));
    }
  }, [config.items.length]);

  return (
    <ErrorBoundary>
      <motion.div
        className={`shelf-container ${config.isPinned ? 'pinned' : ''} ${isCompact ? 'compact' : ''}`}
        initial={{ opacity: ANIMATION_CONSTANTS.SHELF_INITIAL_OPACITY, scale: ANIMATION_CONSTANTS.SHELF_INITIAL_SCALE }}
        animate={{ 
          opacity: config.isVisible ? config.opacity : 0,
          scale: config.isVisible ? 1 : 0.9
        }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          overflow: 'visible', // Allow content to be visible but clip at borders
          minWidth: '280px',
          maxWidth: '400px',
          height: `${shelfHeight}px`,
          minHeight: '200px',
          maxHeight: '600px',
          transition: 'height 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // This is crucial - it allows the drop
          e.dataTransfer.dropEffect = 'copy';
          setIsDragOver(true);
        }}
        onDragLeave={(e) => {
          // Only set drag over to false if we're leaving the shelf entirely
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          
          if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
            setIsDragOver(false);
            
            // Notify main process that drop operation ended
            if (window.api) {
              window.api.send('shelf:drop-end', config.id);
              console.log('🎣 Drop operation ended on shelf:', config.id);
            }
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(true);
          
          // Notify main process that drop operation started
          if (window.api) {
            window.api.send('shelf:drop-start', config.id);
            console.log('🎯 Drop operation started on shelf:', config.id);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
          
          // Notify main process that drop is being processed
          if (window.api) {
            window.api.send('shelf:drop-end', config.id);
            console.log('📦 Processing drop on shelf:', config.id);
          }
          
          // Handle drop event
          
          // Handle native drag and drop
          const dataTransfer = e.dataTransfer;
          if (dataTransfer) {
            // Process dataTransfer
            const items: ShelfItem[] = [];
            
            // Handle dropped files
            if (dataTransfer.files && dataTransfer.files.length > 0) {
              for (let i = 0; i < dataTransfer.files.length; i++) {
                const file = dataTransfer.files[i];
                const item: ShelfItem = {
                  id: `file-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 11)}`,
                  type: file.type.startsWith('image/') ? 'image' : 'file',
                  name: file.name,
                  path: (file as any).path || undefined, // Electron adds path property to File objects
                  size: file.size,
                  createdAt: Date.now()
                };
                items.push(item);
              }
            }
            
            // Handle dropped text
            const text = dataTransfer.getData('text/plain');
            if (text && dataTransfer.files.length === 0) {
              const item: ShelfItem = {
                id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                type: 'text',
                name: 'Dropped Text',
                content: text,
                createdAt: Date.now()
              };
              items.push(item);
            }
            
            // Handle dropped URLs
            const url = dataTransfer.getData('text/uri-list');
            if (url && url !== text && dataTransfer.files.length === 0) {
              try {
                const urlObj = new URL(url);
                const item: ShelfItem = {
                  id: `url-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                  type: 'url',
                  name: urlObj.hostname || 'URL',
                  content: url,
                  createdAt: Date.now()
                };
                items.push(item);
              } catch (e) {
                // If URL parsing fails, treat it as text
                if (!text) {
                  const item: ShelfItem = {
                    id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                    type: 'text',
                    name: 'Dropped Content',
                    content: url,
                    createdAt: Date.now()
                  };
                  items.push(item);
                }
              }
            }
            
            // Add the items to the shelf
            if (items.length > 0) {
              console.log('📦 Dropping', items.length, 'items on shelf', config.id);
              console.log('Items:', items);
              
              // Immediately notify main process about dropped files
              console.log('🔍 Checking window.api:', !!window.api);
              console.log('🤔 Window properties:', Object.keys(window).filter(k => k.includes('api') || k.includes('electron')));
              console.log('💻 Full window.api:', window.api);
              console.log('🆔 Current shelf ID:', config.id);
              
              if (window.api && items.length > 0) {
                const filePaths = items
                  .filter(item => item.type === 'file' && item.path)
                  .map(item => item.path as string);
                
                console.log('📝 Found', filePaths.length, 'file paths:', filePaths);
                
                if (filePaths.length > 0) {
                  console.log('📡 Notifying main process about', filePaths.length, 'dropped files');
                  window.api.send('shelf:files-dropped', { shelfId: config.id, files: filePaths });
                } else {
                  console.warn('⚠️ No file paths found in dropped items');
                }
              } else {
                console.error('❌ Cannot notify main process: window.api =', !!window.api, ', items =', items.length);
              }
              
              handleDrop(items);
            } else {
              console.warn('⚠️ No items to drop');
            }
          }
        }}
      >
        {/* Inner container to properly handle overflow */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'transparent'
        }}>
          {/* Shelf Header - Sticky position */}
          <div style={{ 
            flexShrink: 0, 
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'rgba(30, 30, 30, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <ShelfHeader
              config={config}
              itemCount={filteredItems.length}
              onTogglePin={() => handleConfigChange({ isPinned: !config.isPinned })}
              onClose={onClose}
            />
          </div>

          {/* Shelf Content */}
          <div className="shelf-content" style={{ 
            flex: 1, 
            overflow: 'auto',
            minHeight: '150px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            <AnimatePresence mode="sync">
              {filteredItems.length > 0 ? (
                <ShelfItemList
                  key="items"
                  items={filteredItems}
                  isCompact={isCompact}
                  onItemAction={handleItemAction}
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
                zIndex: 1000
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{
                  color: 'rgba(59, 130, 246, 0.8)',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}
              >
                Drop files here
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </ErrorBoundary>
  );
});

Shelf.displayName = 'Shelf';