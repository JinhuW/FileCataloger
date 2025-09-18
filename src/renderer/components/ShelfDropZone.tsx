import React from 'react';
import { motion } from 'framer-motion';
import { ShelfItem } from '@shared/types';

export interface ShelfDropZoneProps {
  isDragOver: boolean;
  onDrop: (items: ShelfItem[]) => void;
  isEmpty: boolean;
  hasSearchQuery: boolean;
}

export const ShelfDropZone = React.memo<ShelfDropZoneProps>(
  ({
    isDragOver,
    onDrop: _onDrop, // Currently unused but kept for future implementation
    isEmpty,
    hasSearchQuery,
  }) => {
    const getMessage = () => {
      if (hasSearchQuery) {
        return {
          icon: '🔍',
          title: 'No matching items',
          subtitle: 'Try a different search term',
        };
      }

      if (isEmpty) {
        return {
          icon: '📁',
          title: 'Empty shelf',
          subtitle: 'Drag files here to get started',
        };
      }

      return {
        icon: '📂',
        title: 'Drop zone',
        subtitle: 'Drag files here to add them',
      };
    };

    const message = getMessage();

    return (
      <motion.div
        className="shelf-drop-zone"
        initial={false}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeInOut' }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '200px',
          padding: '32px',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.6)',
        }}
      >
        <motion.div
          animate={{
            scale: isDragOver ? [1, 1.1, 1] : 1,
            rotate: isDragOver ? [0, 5, -5, 0] : 0,
          }}
          transition={{
            duration: 0.5,
            repeat: isDragOver ? Infinity : 0,
          }}
          style={{
            fontSize: '48px',
            marginBottom: '16px',
            opacity: isDragOver ? 1 : 0.7,
          }}
        >
          {message.icon}
        </motion.div>

        <motion.h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '18px',
            fontWeight: '600',
            color: 'white',
          }}
          animate={{
            opacity: isDragOver ? [0.7, 1, 0.7] : 0.9,
          }}
          transition={{
            duration: 1,
            repeat: isDragOver ? Infinity : 0,
          }}
        >
          {message.title}
        </motion.h3>

        <p
          style={{
            margin: 0,
            fontSize: '14px',
            opacity: 0.8,
          }}
        >
          {message.subtitle}
        </p>

        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{
              marginTop: '24px',
              padding: '8px 16px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '16px',
              fontSize: '12px',
              color: 'rgba(59, 130, 246, 0.8)',
            }}
          >
            💡 Tip: Shake your cursor to quickly show shelves
          </motion.div>
        )}
      </motion.div>
    );
  }
);

ShelfDropZone.displayName = 'ShelfDropZone';
