import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  onDismiss: (id: string) => void;
}

const typeStyles = {
  success: {
    background: 'rgba(34, 197, 94, 0.2)',
    border: 'rgba(34, 197, 94, 0.5)',
    icon: '✓',
    iconColor: '#22c55e',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: 'rgba(239, 68, 68, 0.5)',
    icon: '✕',
    iconColor: '#ef4444',
  },
  warning: {
    background: 'rgba(245, 158, 11, 0.2)',
    border: 'rgba(245, 158, 11, 0.5)',
    icon: '!',
    iconColor: '#f59e0b',
  },
  info: {
    background: 'rgba(59, 130, 246, 0.2)',
    border: 'rgba(59, 130, 246, 0.5)',
    icon: 'i',
    iconColor: '#3b82f6',
  },
};

export const Toast = React.memo<ToastProps>(
  ({ id, type, title, message, duration = 5000, onDismiss }) => {
    useEffect(() => {
      if (duration > 0) {
        const timer = setTimeout(() => {
          onDismiss(id);
        }, duration);
        return () => clearTimeout(timer);
      }
    }, [id, duration, onDismiss]);

    const style = typeStyles[type];

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        style={{
          background: style.background,
          border: `1px solid ${style.border}`,
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          minWidth: '300px',
          maxWidth: '400px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Progress bar */}
        {duration > 0 && (
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: duration / 1000, ease: 'linear' }}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: style.iconColor,
              transformOrigin: 'left',
            }}
          />
        )}

        {/* Icon */}
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: style.iconColor,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            flexShrink: 0,
          }}
        >
          {style.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1 }}>
          <h4
            style={{
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              margin: '0 0 4px',
            }}
          >
            {title}
          </h4>
          {message && (
            <p
              style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '13px',
                margin: 0,
                lineHeight: '1.4',
              }}
            >
              {message}
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={() => onDismiss(id)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '16px',
            lineHeight: 1,
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      </motion.div>
    );
  }
);

Toast.displayName = 'Toast';

export const ToastContainer = React.memo<{ children: React.ReactNode }>(({ children }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <AnimatePresence mode="sync">{children}</AnimatePresence>
    </div>
  );
});

ToastContainer.displayName = 'ToastContainer';
