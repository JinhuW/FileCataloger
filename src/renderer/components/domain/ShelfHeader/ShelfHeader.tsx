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
import { ShelfConfig } from '@shared/types';

export interface ShelfHeaderProps {
  config: ShelfConfig;
  itemCount: number; // Keep for backwards compatibility but not displayed
  onClose: () => void; // Keep for backwards compatibility but not used
  title?: string;
}

export const ShelfHeader = React.memo<ShelfHeaderProps>(
  ({ config: _config, itemCount: _itemCount, onClose: _onClose, title = 'Shelf' }) => {
    return (
      <div
        className="shelf-header"
        style={{
          padding: '12px 16px',
          paddingTop: '40px', // Extra padding for traffic lights
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
              left: 72, // Start after traffic lights (20px + 52px button width)
              right: 0,
              bottom: 0,
              cursor: 'move',
              WebkitAppRegion: 'drag',
              zIndex: 1,
            } as React.CSSProperties
          }
        />

        {/* Center - Title Only - Absolutely centered */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 0, // Behind drag handle so it doesn't interfere
            pointerEvents: 'none', // Don't interfere with dragging
          }}
        >
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
        </div>
      </div>
    );
  }
);

ShelfHeader.displayName = 'ShelfHeader';
