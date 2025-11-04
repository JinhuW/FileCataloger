/**
 * @file useTooltip.ts
 * @description Custom hook for managing tooltip state, positioning, and interactions.
 * Handles hover delays, viewport collision detection, and keyboard accessibility.
 *
 * @usage
 * ```typescript
 * const tooltip = useTooltip({
 *   showDelay: 500,
 *   position: 'top',
 *   offset: 8,
 * });
 *
 * return (
 *   <div
 *     ref={tooltip.targetRef}
 *     onMouseEnter={tooltip.handleMouseEnter}
 *     onMouseLeave={tooltip.handleMouseLeave}
 *   >
 *     {children}
 *   </div>
 * );
 * ```
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { TooltipPosition, TooltipPositionData, TooltipState } from '@shared/types/ui';
import { SHELF_CONSTANTS } from '@renderer/constants/shelf';

export interface UseTooltipOptions {
  /** Preferred position */
  position?: TooltipPosition;
  /** Show delay in milliseconds */
  showDelay?: number;
  /** Hide delay in milliseconds */
  hideDelay?: number;
  /** Offset from target element */
  offset?: number;
  /** Whether tooltip is disabled */
  disabled?: boolean;
  /** Whether to follow mouse movement */
  followMouse?: boolean;
  /** Callback when tooltip becomes visible */
  onShow?: () => void;
  /** Callback when tooltip becomes hidden */
  onHide?: () => void;
}

export interface UseTooltipReturn {
  /** Current tooltip state */
  state: TooltipState;
  /** Reference for the target element */
  targetRef: React.RefObject<HTMLElement>;
  /** Reference for the tooltip element */
  tooltipRef: React.RefObject<HTMLDivElement>;
  /** Mouse enter handler */
  handleMouseEnter: (e: React.MouseEvent) => void;
  /** Mouse leave handler */
  handleMouseLeave: () => void;
  /** Mouse move handler (for followMouse mode) */
  handleMouseMove: (e: React.MouseEvent) => void;
  /** Focus handler for keyboard accessibility */
  handleFocus: (e: React.FocusEvent) => void;
  /** Blur handler */
  handleBlur: () => void;
  /** Manually show tooltip */
  show: () => void;
  /** Manually hide tooltip */
  hide: () => void;
}

/**
 * Custom hook for tooltip functionality
 */
export const useTooltip = (options: UseTooltipOptions = {}): UseTooltipReturn => {
  const {
    position = 'auto',
    showDelay = SHELF_CONSTANTS.CUSTOM_TOOLTIP_SHOW_DELAY_MS,
    hideDelay = SHELF_CONSTANTS.CUSTOM_TOOLTIP_HIDE_DELAY_MS,
    offset = SHELF_CONSTANTS.CUSTOM_TOOLTIP_OFFSET,
    disabled = false,
    followMouse = false,
    onShow,
    onHide,
  } = options;

  const [state, setState] = useState<TooltipState>({
    isVisible: false,
    position: null,
    targetRect: null,
  });

  const targetRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Calculate optimal tooltip position with viewport collision detection
   */
  const calculatePosition = useCallback(
    (targetRect: DOMRect, tooltipWidth?: number, tooltipHeight?: number): TooltipPositionData => {
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      // Get tooltip dimensions (estimate if not available)
      const tooltipW = tooltipWidth || SHELF_CONSTANTS.CUSTOM_TOOLTIP_MAX_WIDTH;
      const tooltipH = tooltipHeight || 60; // Rough estimate

      // Calculate available space in each direction
      const space = {
        top: targetRect.top,
        bottom: viewport.height - targetRect.bottom,
        left: targetRect.left,
        right: viewport.width - targetRect.right,
      };

      // Determine best position
      let resolvedPosition: TooltipPosition = position;

      if (position === 'auto') {
        // Auto-select position with most available space
        if (space.bottom >= tooltipH) {
          resolvedPosition = 'bottom';
        } else if (space.top >= tooltipH) {
          resolvedPosition = 'top';
        } else if (space.right >= tooltipW) {
          resolvedPosition = 'right';
        } else if (space.left >= tooltipW) {
          resolvedPosition = 'left';
        } else {
          // Default to bottom if no ideal position
          resolvedPosition = 'bottom';
        }
      }

      // Calculate position coordinates
      let x = 0;
      let y = 0;

      switch (resolvedPosition) {
        case 'top':
          x = targetRect.left + targetRect.width / 2;
          y = targetRect.top - offset;
          break;
        case 'bottom':
          x = targetRect.left + targetRect.width / 2;
          y = targetRect.bottom + offset;
          break;
        case 'left':
          x = targetRect.left - offset;
          y = targetRect.top + targetRect.height / 2;
          break;
        case 'right':
          x = targetRect.right + offset;
          y = targetRect.top + targetRect.height / 2;
          break;
      }

      // Prevent viewport overflow with padding
      const viewportPadding = 8;
      x = Math.max(viewportPadding, Math.min(x, viewport.width - viewportPadding));
      y = Math.max(viewportPadding, Math.min(y, viewport.height - viewportPadding));

      return {
        x,
        y,
        resolvedPosition,
      };
    },
    [position, offset]
  );

  /**
   * Update tooltip position based on target element
   */
  const updatePosition = useCallback(
    (mouseX?: number, mouseY?: number) => {
      if (!targetRef.current) return;

      const targetRect = targetRef.current.getBoundingClientRect();
      const tooltipEl = tooltipRef.current;
      const tooltipWidth = tooltipEl?.offsetWidth;
      const tooltipHeight = tooltipEl?.offsetHeight;

      let positionData = calculatePosition(targetRect, tooltipWidth, tooltipHeight);

      // Override with mouse position if followMouse is enabled
      if (followMouse && mouseX !== undefined && mouseY !== undefined) {
        positionData = {
          ...positionData,
          x: mouseX,
          y: mouseY,
        };
      }

      setState(prev => ({
        ...prev,
        position: positionData,
        targetRect,
      }));
    },
    [calculatePosition, followMouse]
  );

  /**
   * Show tooltip after delay
   */
  const show = useCallback(() => {
    if (disabled) return;

    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Clear any pending show timeout
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }

    showTimeoutRef.current = setTimeout(() => {
      updatePosition();
      setState(prev => ({ ...prev, isVisible: true }));
      onShow?.();
    }, showDelay);
  }, [disabled, showDelay, updatePosition, onShow]);

  /**
   * Hide tooltip after delay
   */
  const hide = useCallback(() => {
    // Clear any pending show timeout
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    if (hideDelay > 0) {
      hideTimeoutRef.current = setTimeout(() => {
        setState(prev => ({ ...prev, isVisible: false }));
        onHide?.();
      }, hideDelay);
    } else {
      setState(prev => ({ ...prev, isVisible: false }));
      onHide?.();
    }
  }, [hideDelay, onHide]);

  /**
   * Mouse enter handler
   */
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      if (followMouse) {
        updatePosition(e.clientX, e.clientY);
      }
      show();
    },
    [show, followMouse, updatePosition]
  );

  /**
   * Mouse leave handler
   */
  const handleMouseLeave = useCallback(() => {
    hide();
  }, [hide]);

  /**
   * Mouse move handler (for followMouse mode)
   */
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (followMouse && state.isVisible) {
        updatePosition(e.clientX, e.clientY);
      }
    },
    [followMouse, state.isVisible, updatePosition]
  );

  /**
   * Focus handler for keyboard accessibility
   */
  const handleFocus = useCallback(
    (_e: React.FocusEvent) => {
      updatePosition();
      setState(prev => ({ ...prev, isVisible: true }));
      onShow?.();
    },
    [updatePosition, onShow]
  );

  /**
   * Blur handler
   */
  const handleBlur = useCallback(() => {
    hide();
  }, [hide]);

  /**
   * Cleanup timeouts on unmount
   */
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle Escape key to close tooltip
   */
  useEffect(() => {
    if (!state.isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isVisible, hide]);

  return {
    state,
    targetRef,
    tooltipRef,
    handleMouseEnter,
    handleMouseLeave,
    handleMouseMove,
    handleFocus,
    handleBlur,
    show,
    hide,
  };
};
