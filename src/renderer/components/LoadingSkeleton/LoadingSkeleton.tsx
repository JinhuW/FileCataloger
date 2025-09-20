import React from 'react';
import { motion } from 'framer-motion';

export interface LoadingSkeletonProps {
  variant?: 'text' | 'rect' | 'circle' | 'tab';
  width?: string | number;
  height?: string | number;
  count?: number;
  style?: React.CSSProperties;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'rect',
  width = '100%',
  height = '20px',
  count = 1,
  style,
  className,
}) => {
  const baseStyle: React.CSSProperties = {
    background:
      'linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.08) 100%)',
    backgroundSize: '200% 100%',
    borderRadius: variant === 'circle' ? '50%' : variant === 'tab' ? '6px' : '4px',
    width,
    height: variant === 'tab' ? '32px' : height,
    ...style,
  };

  const skeletonElement = (
    <motion.div
      className={className}
      animate={{
        backgroundPosition: ['200% 0', '-200% 0'],
      }}
      transition={{
        duration: 1.5,
        ease: 'linear',
        repeat: Infinity,
      }}
      style={baseStyle}
    />
  );

  if (count === 1) {
    return skeletonElement;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array.from({ length: count }, (_, index) => (
        <motion.div
          key={index}
          className={className}
          animate={{
            backgroundPosition: ['200% 0', '-200% 0'],
          }}
          transition={{
            duration: 1.5,
            ease: 'linear',
            repeat: Infinity,
            delay: index * 0.1,
          }}
          style={baseStyle}
        />
      ))}
    </div>
  );
};

export const TabSkeleton: React.FC = () => (
  <div style={{ display: 'flex', gap: '8px' }}>
    <LoadingSkeleton variant="tab" width="120px" />
    <LoadingSkeleton variant="tab" width="100px" />
    <LoadingSkeleton variant="tab" width="140px" />
  </div>
);

export const PatternBuilderSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
    {/* Header */}
    <LoadingSkeleton width="150px" height="16px" />

    {/* Tabs */}
    <TabSkeleton />

    {/* Pattern area */}
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        padding: '16px',
        height: '120px',
      }}
    >
      <LoadingSkeleton width="60%" height="14px" />
    </div>

    {/* Components */}
    <div>
      <LoadingSkeleton width="120px" height="12px" style={{ marginBottom: '12px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
        {Array.from({ length: 5 }, (_, i) => (
          <LoadingSkeleton key={i} height="40px" />
        ))}
      </div>
    </div>

    {/* Button */}
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <LoadingSkeleton width="120px" height="40px" />
    </div>
  </div>
);
