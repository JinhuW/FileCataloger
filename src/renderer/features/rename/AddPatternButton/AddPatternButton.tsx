import React from 'react';
import { motion } from 'framer-motion';

export interface AddPatternButtonProps {
  onClick: () => void;
  disabled?: boolean;
  maxReached?: boolean;
}

export const AddPatternButton: React.FC<AddPatternButtonProps> = ({
  onClick,
  disabled = false,
  maxReached = false,
}) => {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
        border: '1px solid ' + (disabled ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'),
        borderRadius: '6px',
        padding: '6px 12px',
        color: disabled ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.6)',
        fontSize: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        minWidth: '32px',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
        }
      }}
      onMouseLeave={e => {
        if (!disabled) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
        }
      }}
      title={maxReached ? 'Maximum patterns reached' : 'Add new pattern'}
      aria-label="Add new pattern"
    >
      +
    </motion.button>
  );
};
