/**
 * @file ShelfHeader.tsx
 * @description Header component for shelf windows providing title, item count, and control actions.
 * Features a draggable area for window movement and animated status indicators.
 *
 * @props {ShelfConfig} config - Current shelf configuration including pin state
 * @props {number} itemCount - Number of items currently in the shelf
 * @props {function} onTogglePin - Callback to toggle shelf pin state
 * @props {function} onClose - Callback to close the shelf
 * @props {string} title - Optional custom title (defaults to "Shelf")
 *
 * @features
 * - Draggable header area for window movement (WebkitAppRegion: 'drag')
 * - Animated pin status indicator with pulsing effect when pinned
 * - Real-time item count display with styled badge
 * - Hover animations for interactive buttons
 * - Pin and close actions with tooltips
 * - Responsive layout with flex spacing
 *
 * @usage
 * ```tsx
 * <ShelfHeader
 *   config={shelfConfig}
 *   itemCount={items.length}
 *   onTogglePin={handleTogglePin}
 *   onClose={handleClose}
 *   title="Custom Shelf"
 * />
 * ```
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ShelfConfig } from '@shared/types';

export interface ShelfHeaderProps {
  config: ShelfConfig;
  itemCount: number;
  onTogglePin: () => void;
  onClose: () => void;
  title?: string;
}

export const ShelfHeader = React.memo<ShelfHeaderProps>(
  ({ config, itemCount, onTogglePin, onClose, title = 'Shelf' }) => {
    return (
      <div
        className="shelf-header"
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(5px)',
          position: 'relative',
        }}
      >
        {/* Drag Handle - invisible but covers most of the header */}
        <div
          style={
            {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 100, // Leave space for buttons
              bottom: 0,
              cursor: 'move',
              WebkitAppRegion: 'drag',
              zIndex: 1,
            } as React.CSSProperties
          }
        />

        {/* Left Side - Title and Count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
          <motion.div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: config.isPinned ? '#10b981' : '#f59e0b',
            }}
            animate={{
              scale: config.isPinned ? [1, 1.2, 1] : 1,
            }}
            transition={{
              duration: 2,
              repeat: config.isPinned ? Infinity : 0,
            }}
          />
          <span
            style={{
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              opacity: 0.9,
            }}
          >
            {title}
          </span>
          <span
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '2px 6px',
              borderRadius: '8px',
              minWidth: '20px',
              textAlign: 'center',
            }}
          >
            {itemCount}
          </span>
        </div>

        {/* Spacer to push actions to the right */}
        <div style={{ flex: 1 }} />

        {/* Right Side - Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            zIndex: 2,
            position: 'relative',
          }}
        >
          {/* Pin Toggle Button */}
          <motion.button
            onClick={onTogglePin}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            style={{
              background: 'none',
              border: 'none',
              color: config.isPinned ? '#10b981' : 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
            title={config.isPinned ? 'Unpin shelf' : 'Pin shelf'}
          >
            📌
          </motion.button>

          {/* Close Button */}
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.1, background: 'rgba(239, 68, 68, 0.2)' }}
            whileTap={{ scale: 0.95 }}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}
            title="Close shelf"
          >
            ✕
          </motion.button>
        </div>
      </div>
    );
  }
);

ShelfHeader.displayName = 'ShelfHeader';
