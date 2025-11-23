/**
 * @file CustomTooltip.tsx
 * @description Custom tooltip component with rich content support, smart positioning,
 * and smooth animations. Supports file metadata, component descriptions, and plain text.
 *
 * @features
 * - Rich content types (text, metadata, component descriptions)
 * - Smart auto-positioning with viewport collision detection
 * - Configurable show/hide delays
 * - Smooth fade + slide animations with Framer Motion
 * - Keyboard accessibility (Escape to close, focus support)
 * - Portal-based rendering for proper z-index layering
 * - Optional arrow pointing to target element
 * - Mouse follow mode for dynamic positioning
 *
 * @usage
 * ```tsx
 * // Simple text tooltip
 * <CustomTooltip content="This is helpful info">
 *   <button>Hover me</button>
 * </CustomTooltip>
 *
 * // Rich metadata tooltip
 * <CustomTooltip content={buildFileMetadataTooltip(item)} position="top">
 *   <div>File item</div>
 * </CustomTooltip>
 * ```
 */

import React, { useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { CustomTooltipProps, TooltipPosition } from '@shared/types/ui';
import { useTooltip } from '@renderer/hooks/useTooltip';
import { getTooltipContentAsString } from '@renderer/utils/tooltipUtils';
import { SHELF_CONSTANTS } from '@renderer/constants/shelf';

/**
 * CustomTooltip component
 */
export const CustomTooltip: React.FC<CustomTooltipProps> = ({
  children,
  content,
  position = 'auto',
  showDelay = SHELF_CONSTANTS.CUSTOM_TOOLTIP_SHOW_DELAY_MS,
  hideDelay = SHELF_CONSTANTS.CUSTOM_TOOLTIP_HIDE_DELAY_MS,
  showArrow = false,
  maxWidth = SHELF_CONSTANTS.CUSTOM_TOOLTIP_MAX_WIDTH,
  disabled = false,
  zIndex = SHELF_CONSTANTS.CUSTOM_TOOLTIP_Z_INDEX,
  className = '',
  followMouse = false,
  offset = SHELF_CONSTANTS.CUSTOM_TOOLTIP_OFFSET,
}) => {
  const tooltipId = useId();

  const tooltip = useTooltip({
    position,
    showDelay,
    hideDelay,
    offset,
    disabled,
    followMouse,
  });

  // Convert content to string (simple operation, no need for useMemo)
  const contentString = getTooltipContentAsString(content);

  // Don't render if no content or disabled
  if (!contentString || disabled) {
    return <>{children}</>;
  }

  // Get transform based on resolved position
  const getTransform = (resolvedPosition: string) => {
    switch (resolvedPosition) {
      case 'top':
        return 'translate(-50%, -100%)';
      case 'bottom':
        return 'translate(-50%, 0)';
      case 'left':
        return 'translate(-100%, -50%)';
      case 'right':
        return 'translate(0, -50%)';
      default:
        return 'translate(-50%, -100%)'; // Default to top
    }
  };

  // Get animation direction based on position
  const getAnimationOffset = (resolvedPosition: string) => {
    switch (resolvedPosition) {
      case 'top':
        return { y: 5 };
      case 'bottom':
        return { y: -5 };
      case 'left':
        return { x: 5 };
      case 'right':
        return { x: -5 };
      default:
        return { y: 5 };
    }
  };

  const resolvedPosition = tooltip.state.position?.resolvedPosition || 'top';
  const animationOffset = getAnimationOffset(resolvedPosition);

  return (
    <>
      {/* Target element wrapper */}
      <div
        ref={tooltip.targetRef as React.RefObject<HTMLDivElement>}
        onMouseEnter={tooltip.handleMouseEnter}
        onMouseLeave={tooltip.handleMouseLeave}
        onMouseMove={followMouse ? tooltip.handleMouseMove : undefined}
        onFocus={tooltip.handleFocus}
        onBlur={tooltip.handleBlur}
        aria-describedby={tooltip.state.isVisible ? tooltipId : undefined}
        style={{
          display: 'contents',
        }}
      >
        {children}
      </div>

      {/* Tooltip portal */}
      {createPortal(
        <AnimatePresence>
          {tooltip.state.isVisible && tooltip.state.position && (
            <motion.div
              ref={tooltip.tooltipRef}
              id={tooltipId}
              role="tooltip"
              aria-live="polite"
              aria-atomic="true"
              initial={{
                opacity: 0,
                ...animationOffset,
              }}
              animate={{
                opacity: 1,
                x: 0,
                y: 0,
              }}
              exit={{
                opacity: 0,
                ...animationOffset,
              }}
              transition={{
                duration: 0.2,
                ease: 'easeOut',
              }}
              className={className}
              style={{
                position: 'fixed',
                left: tooltip.state.position.x,
                top: tooltip.state.position.y,
                transform: getTransform(resolvedPosition),
                background: 'rgba(0, 0, 0, 0.92)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: `${SHELF_CONSTANTS.CUSTOM_TOOLTIP_BORDER_RADIUS}px`,
                padding: SHELF_CONSTANTS.CUSTOM_TOOLTIP_PADDING,
                fontSize: `${SHELF_CONSTANTS.CUSTOM_TOOLTIP_FONT_SIZE}px`,
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                lineHeight: 1.5,
                color: 'rgba(255, 255, 255, 0.95)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                zIndex,
                pointerEvents: 'none',
                maxWidth: `${maxWidth}px`,
                minWidth: `${SHELF_CONSTANTS.CUSTOM_TOOLTIP_MIN_WIDTH}px`,
                boxShadow:
                  '0 4px 20px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
              }}
            >
              {/* Tooltip content */}
              <div style={{ position: 'relative' }}>{contentString}</div>

              {/* Optional arrow */}
              {showArrow && (
                <div
                  style={{
                    position: 'absolute',
                    width: 0,
                    height: 0,
                    borderStyle: 'solid',
                    ...getArrowStyle(resolvedPosition),
                  }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

/**
 * Get arrow positioning and styling based on tooltip position
 */
const getArrowStyle = (position: TooltipPosition): React.CSSProperties => {
  const arrowSize = 6;
  const arrowColor = 'rgba(0, 0, 0, 0.92)';

  switch (position) {
    case 'top':
      return {
        bottom: -arrowSize,
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: `${arrowSize}px ${arrowSize}px 0 ${arrowSize}px`,
        borderColor: `${arrowColor} transparent transparent transparent`,
      };
    case 'bottom':
      return {
        top: -arrowSize,
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: `0 ${arrowSize}px ${arrowSize}px ${arrowSize}px`,
        borderColor: `transparent transparent ${arrowColor} transparent`,
      };
    case 'left':
      return {
        right: -arrowSize,
        top: '50%',
        transform: 'translateY(-50%)',
        borderWidth: `${arrowSize}px 0 ${arrowSize}px ${arrowSize}px`,
        borderColor: `transparent transparent transparent ${arrowColor}`,
      };
    case 'right':
      return {
        left: -arrowSize,
        top: '50%',
        transform: 'translateY(-50%)',
        borderWidth: `${arrowSize}px ${arrowSize}px ${arrowSize}px 0`,
        borderColor: `transparent ${arrowColor} transparent transparent`,
      };
    case 'auto':
      // Auto position should be resolved before arrow styling
      return {};
  }
};

// Memoize for performance
export default React.memo(CustomTooltip);
