import React from 'react';
import { motion } from 'framer-motion';
import { ShelfConfig } from '@shared/types';

export interface ShelfHeaderProps {
  config: ShelfConfig;
  itemCount: number;
  onTogglePin: () => void;
  onClose: () => void;
}

export const ShelfHeader = React.memo<ShelfHeaderProps>(({
  config,
  itemCount,
  onTogglePin,
  onClose
}) => {
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
        position: 'relative'
      }}
    >
      {/* Drag Handle - invisible but covers most of the header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 100, // Leave space for buttons
          bottom: 0,
          cursor: 'move',
          // @ts-ignore - WebkitAppRegion is not in React types but works in Electron
          WebkitAppRegion: 'drag',
          zIndex: 1
        } as React.CSSProperties}
      />
      
      {/* Left Side - Title and Count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
        <motion.div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: config.isPinned ? '#10b981' : '#f59e0b'
          }}
          animate={{
            scale: config.isPinned ? [1, 1.2, 1] : 1,
          }}
          transition={{
            duration: 2,
            repeat: config.isPinned ? Infinity : 0
          }}
        />
        <span 
          style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            opacity: 0.9
          }}
        >
          Shelf
        </span>
        <span
          style={{
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '12px',
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 6px',
            borderRadius: '8px',
            minWidth: '20px',
            textAlign: 'center'
          }}
        >
          {itemCount}
        </span>
      </div>

      {/* Spacer to push actions to the right */}
      <div style={{ flex: 1 }} />

      {/* Right Side - Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', zIndex: 2, position: 'relative' }}>
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
            fontSize: '14px'
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
            fontSize: '14px'
          }}
          title="Close shelf"
        >
          ✕
        </motion.button>
      </div>
    </div>
  );
});

ShelfHeader.displayName = 'ShelfHeader';