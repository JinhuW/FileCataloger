/**
 * @file ui.ts
 * @description UI constants for the FileCataloger renderer process.
 * Centralizes magic numbers, dimensions, timing values, and UI configuration.
 */

/**
 * Animation durations in seconds
 */
export const ANIMATION = {
  /**
   * Default animation duration for transitions
   */
  DURATION: 0.2,
  /**
   * Ease function for animations
   */
  EASE: 'easeOut',
} as const;

/**
 * Auto-hide timing configuration
 */
export const AUTO_HIDE = {
  /**
   * Delay in milliseconds before auto-hiding empty unpinned shelves
   */
  DELAY_MS: 3000,
} as const;

/**
 * Shelf window dimensions
 */
export const SHELF_DIMENSIONS = {
  /**
   * Default shelf width in pixels
   */
  WIDTH: 900,
  /**
   * Default shelf height in pixels
   */
  HEIGHT: 600,
} as const;

/**
 * File drop zone dimensions
 */
export const DROP_ZONE = {
  /**
   * Icon size for normal mode (in pixels)
   */
  ICON_SIZE_NORMAL: 80,
  /**
   * Icon size for compact mode (in pixels)
   */
  ICON_SIZE_COMPACT: 32,
  /**
   * Padding for normal mode
   */
  PADDING_NORMAL: '40px',
  /**
   * Padding for compact mode
   */
  PADDING_COMPACT: '12px',
} as const;

/**
 * Toast notification durations in milliseconds
 */
export const TOAST_DURATION = {
  /**
   * Default toast duration
   */
  DEFAULT: 3000,
  /**
   * Duration for success messages
   */
  SUCCESS: 3000,
  /**
   * Duration for error messages
   */
  ERROR: 5000,
  /**
   * Duration for warning messages
   */
  WARNING: 4000,
  /**
   * Duration for info messages
   */
  INFO: 3000,
} as const;

/**
 * Component spacing and sizing
 */
export const SPACING = {
  /**
   * Gap between components in compact mode
   */
  COMPACT_GAP: '12px',
  /**
   * Standard padding
   */
  STANDARD_PADDING: '12px',
  /**
   * Header padding
   */
  HEADER_PADDING: '12px 16px',
} as const;

/**
 * File operation configuration
 */
export const FILE_OPERATIONS = {
  /**
   * Maximum number of concurrent file rename operations
   */
  MAX_CONCURRENT_RENAMES: 5,
  /**
   * Counter padding for file numbering (e.g., 001, 002, 003)
   */
  COUNTER_PADDING: 3,
} as const;
