/**
 * @file Tooltip.tsx
 * @description Accessible tooltip component with hover delay and positioning logic.
 * Provides contextual information with smooth animations and automatic positioning.
 *
 * @props {React.ReactNode} children - The element to wrap with tooltip functionality
 * @props {string} content - The text content to display in the tooltip
 * @props {number} delay - Delay in milliseconds before showing tooltip (default: 500ms)
 *
 * @features
 * - Hover delay to prevent tooltip spam
 * - Automatic positioning based on target element
 * - Smooth fade animations with Framer Motion
 * - Text overflow handling with ellipsis
 * - High z-index for proper layering
 * - Backdrop blur effect for modern appearance
 * - Pointer events disabled on tooltip for better UX
 *
 * @usage
 * ```tsx
 * <Tooltip content="This is helpful information" delay={300}>
 *   <button>Hover me</button>
 * </Tooltip>
 * ```
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, delay = 500 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 5,
    });

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={elementRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-block', width: '100%' }}
      >
        {children}
      </div>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: position.x,
              top: position.y,
              transform: 'translate(-50%, -100%)',
              background: 'rgba(40, 40, 40, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.9)',
              whiteSpace: 'nowrap',
              zIndex: 10000,
              pointerEvents: 'none',
              maxWidth: '400px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
