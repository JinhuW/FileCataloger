import React, { useRef } from 'react';
import { motion } from 'framer-motion';

interface ResizableShelfContainerProps {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  onResize?: (width: number, height: number) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Resizable container that syncs with window bounds
 * Provides visual feedback during resize operations
 * Ensures the invisible Electron window matches the React UI bounds
 */
export const ResizableShelfContainer: React.FC<ResizableShelfContainerProps> = ({
  width: _width, // Using 100% instead of fixed width
  height: _height, // Using 100% instead of fixed height
  minWidth = 600,
  minHeight = 400,
  maxWidth = 1600,
  maxHeight = 1200,
  onResize: _onResize, // Ignore onResize prop - using Electron's native resize
  children,
  className = '',
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={containerRef}
      className={`resizable-shelf-container ${className}`}
      initial={{ opacity: 0.3, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
      }}
      transition={{
        opacity: { duration: 0.15 },
        scale: { duration: 0.2, ease: 'easeOut' },
      }}
      style={{
        width: '100%',
        height: '100%',
        minWidth,
        minHeight,
        maxWidth,
        maxHeight,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Content */}
      {children}
    </motion.div>
  );
};

ResizableShelfContainer.displayName = 'ResizableShelfContainer';

export default ResizableShelfContainer;
