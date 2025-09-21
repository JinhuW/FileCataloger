import React from 'react';
import { motion } from 'framer-motion';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  style?: React.CSSProperties;
}

export const EmptyState = React.memo<EmptyStateProps>(
  ({ icon, title, description, action, style }) => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          textAlign: 'center',
          ...style,
        }}
      >
        {icon && (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            style={{
              fontSize: '48px',
              marginBottom: '16px',
              opacity: 0.8,
            }}
          >
            {icon}
          </motion.div>
        )}

        <h3
          style={{
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '16px',
            fontWeight: 600,
            margin: '0 0 8px',
          }}
        >
          {title}
        </h3>

        {description && (
          <p
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '14px',
              margin: '0 0 24px',
              maxWidth: '300px',
              lineHeight: '1.5',
            }}
          >
            {description}
          </p>
        )}

        {action && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={action.onClick}
            style={{
              background: '#3b82f6',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#2563eb';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#3b82f6';
            }}
          >
            {action.label}
          </motion.button>
        )}
      </motion.div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
