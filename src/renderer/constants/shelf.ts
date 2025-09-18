/**
 * @file shelf.ts
 * @description Centralized constants for shelf-related components.
 * These constants replace magic numbers throughout the codebase and
 * provide a single source of truth for configuration values.
 *
 * @usage
 * ```typescript
 * import { SHELF_CONSTANTS } from '@renderer/constants/shelf';
 *
 * if (items.length > SHELF_CONSTANTS.VIRTUALIZATION_THRESHOLD) {
 *   // Enable virtualization
 * }
 * ```
 */

export const SHELF_CONSTANTS = {
  // Gesture detection
  SHAKE_THRESHOLD: 6,
  SHAKE_TIMEOUT_MS: 500,
  SHAKE_MIN_DISTANCE: 100,
  SHAKE_MIN_VELOCITY: 0.8,
  SHAKE_MAX_VELOCITY: 10,
  SHAKE_VELOCITY_WEIGHT: 0.5,

  // UI behavior
  AUTO_HIDE_DELAY_MS: 5000,
  ANIMATION_DURATION_MS: 200,
  ANIMATION_STAGGER_DELAY_MS: 30,
  DRAG_HIGHLIGHT_OPACITY: 0.95,
  NORMAL_OPACITY: 0.85,

  // Performance thresholds
  VIRTUALIZATION_THRESHOLD: 50,
  OVERSCAN_COUNT: 5,
  COMPACT_MODE_THRESHOLD: 10,
  MAX_STAGGERED_ANIMATIONS: 20,

  // Dimensions
  MIN_HEIGHT: 80,
  MAX_HEIGHT: 600,
  DEFAULT_HEIGHT: 200,
  ITEM_HEIGHT: 60,
  COMPACT_ITEM_HEIGHT: 40,
  MIN_WIDTH: 300,
  MAX_WIDTH: 600,
  DEFAULT_WIDTH: 400,

  // Limits
  MAX_SHELVES: 5,
  MAX_ITEMS_PER_SHELF: 500,
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_TEXT_LENGTH: 10000,
  MAX_URL_LENGTH: 2048,

  // Timeouts and intervals
  DOUBLE_CLICK_TIMEOUT_MS: 500,
  HOVER_DELAY_MS: 500,
  TOOLTIP_DELAY_MS: 1000,
  POSITION_UPDATE_THROTTLE_MS: 16, // ~60fps

  // File operations
  SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  SUPPORTED_TEXT_EXTENSIONS:
    /\.(txt|md|json|js|ts|tsx|jsx|css|scss|html|xml|yaml|yml|sh|bash|zsh|conf|ini|env)$/i,
  THUMBNAIL_SIZE: 48,

  // Z-index layers
  Z_INDEX_BASE: 1000,
  Z_INDEX_HEADER: 1010,
  Z_INDEX_DROPDOWN: 1020,
  Z_INDEX_TOOLTIP: 1030,
  Z_INDEX_MODAL: 1040,
} as const;

// Type-safe constant type
export type ShelfConstants = typeof SHELF_CONSTANTS;

// Derived types from constants
export type SupportedImageType = (typeof SHELF_CONSTANTS.SUPPORTED_IMAGE_TYPES)[number];

// Helper functions
export const isImageTypeSupported = (mimeType: string): mimeType is SupportedImageType => {
  return SHELF_CONSTANTS.SUPPORTED_IMAGE_TYPES.includes(mimeType as SupportedImageType);
};

export const isTextFileExtension = (filename: string): boolean => {
  return SHELF_CONSTANTS.SUPPORTED_TEXT_EXTENSIONS.test(filename);
};

export const shouldVirtualize = (itemCount: number): boolean => {
  return itemCount > SHELF_CONSTANTS.VIRTUALIZATION_THRESHOLD;
};

export const shouldUseCompactMode = (itemCount: number): boolean => {
  return itemCount > SHELF_CONSTANTS.COMPACT_MODE_THRESHOLD;
};

export const getItemHeight = (isCompact: boolean): number => {
  return isCompact ? SHELF_CONSTANTS.COMPACT_ITEM_HEIGHT : SHELF_CONSTANTS.ITEM_HEIGHT;
};

export const calculateShelfHeight = (itemCount: number, isCompact: boolean): number => {
  const itemHeight = getItemHeight(isCompact);
  const baseHeight = itemCount * itemHeight;

  return Math.min(Math.max(baseHeight, SHELF_CONSTANTS.MIN_HEIGHT), SHELF_CONSTANTS.MAX_HEIGHT);
};
