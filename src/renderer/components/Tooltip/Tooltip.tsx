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

import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SHELF_CONSTANTS } from '@renderer/constants/shelf';

export interface TooltipProps {
  children: React.ReactNode;
  content: string;
  delay?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  delay = SHELF_CONSTANTS.TOOLTIP_DELAY_MS,
  placement = 'top',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const calculatePosition = useCallback(
    (rect: DOMRect) => {
      const padding = 8;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = rect.left + rect.width / 2;
      let y = rect.top;

      // Adjust position based on placement
      switch (placement) {
        case 'top':
          y = rect.top - padding;
          break;
        case 'bottom':
          y = rect.bottom + padding;
          break;
        case 'left':
          x = rect.left - padding;
          y = rect.top + rect.height / 2;
          break;
        case 'right':
          x = rect.right + padding;
          y = rect.top + rect.height / 2;
          break;
      }

      // Prevent viewport overflow
      if (x < padding) x = padding;
      if (y < padding) y = padding;
      if (x > viewportWidth - padding) x = viewportWidth - padding;
      if (y > viewportHeight - padding) y = viewportHeight - padding;

      return { x, y };
    },
    [placement]
  );

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition(calculatePosition(rect));

    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  // Add keyboard support
  const handleFocus = (e: React.FocusEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition(calculatePosition(rect));
    setIsVisible(true);
  };

  const handleBlur = () => {
    setIsVisible(false);
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

  // Get transform based on placement
  const getTransform = () => {
    switch (placement) {
      case 'top':
        return 'translate(-50%, -100%)';
      case 'bottom':
        return 'translate(-50%, 0)';
      case 'left':
        return 'translate(-100%, -50%)';
      case 'right':
        return 'translate(0, -50%)';
    }
  };

  return (
    <>
      <div
        ref={elementRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-describedby={isVisible ? tooltipId : undefined}
        style={{ display: 'inline-block', width: '100%' }}
      >
        {children}
      </div>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: position.x,
              top: position.y,
              transform: getTransform(),
              background: 'rgba(40, 40, 40, 0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.9)',
              whiteSpace: 'nowrap',
              zIndex: SHELF_CONSTANTS.Z_INDEX_TOOLTIP,
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
