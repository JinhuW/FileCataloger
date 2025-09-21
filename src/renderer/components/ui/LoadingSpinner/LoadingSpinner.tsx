import React from 'react';
import { motion } from 'framer-motion';

export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: string;
  style?: React.CSSProperties;
}

const sizeMap = {
  small: 16,
  medium: 24,
  large: 32,
};

export const LoadingSpinner = React.memo<LoadingSpinnerProps>(
  ({ size = 'medium', color = '#3b82f6', style }) => {
    const dimension = sizeMap[size];

    return (
      <motion.svg
        width={dimension}
        height={dimension}
        viewBox="0 0 24 24"
        style={style}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="3"
          fill="none"
          strokeDasharray="31.4159"
          strokeDashoffset="10"
          strokeLinecap="round"
          opacity="0.25"
        />
        <motion.circle
          cx="12"
          cy="12"
          r="10"
          stroke={color}
          strokeWidth="3"
          fill="none"
          strokeDasharray="31.4159"
          strokeLinecap="round"
          animate={{
            strokeDashoffset: [31.4159, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.svg>
    );
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';

export const LoadingOverlay = React.memo<{ message?: string }>(({ message }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        zIndex: 100,
        backdropFilter: 'blur(4px)',
      }}
    >
      <LoadingSpinner size="large" />
      {message && (
        <p
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '14px',
            margin: 0,
          }}
        >
          {message}
        </p>
      )}
    </motion.div>
  );
});

LoadingOverlay.displayName = 'LoadingOverlay';
