/**
 * Application-wide constants to avoid magic numbers
 * All hardcoded values should be defined here for better maintainability
 */

/**
 * Shelf-related constants
 */
export const SHELF_CONSTANTS = {
  DEFAULT_WIDTH: 900, // Updated to match current UI
  DEFAULT_HEIGHT: 800, // Increased to show all UI content
  MIN_WIDTH: 600, // Minimum width for usability
  MAX_WIDTH: 1600, // Maximum width for reasonable UI
  MIN_HEIGHT: 500,
  MAX_HEIGHT: 1200, // Reduced for better UX
  AUTO_HIDE_DELAY: 3000, // milliseconds
  EMPTY_TIMEOUT: 5000, // milliseconds
  DOCK_MARGIN: 10,
  MAX_POOL_SIZE: 3,
  OPACITY: 0.9,
  RESIZABLE: true, // Allow users to resize shelf windows
  WINDOW_ANIMATION_DURATION: 200, // milliseconds
  // Item display thresholds
  COMPACT_MODE_THRESHOLD: 20, // Show compact view when more than 20 items
  ITEM_HEIGHT_NORMAL: 60,
  ITEM_HEIGHT_COMPACT: 32,
  ITEM_MARGIN_NORMAL: 4,
  ITEM_MARGIN_COMPACT: 1,
  HEADER_HEIGHT: 48,
  CONTAINER_PADDING: 16,
  MIN_CONTENT_HEIGHT: 150,
  MAX_CONTENT_HEIGHT: 430,
  EMPTY_SHELF_HEIGHT: 250,
  EXTRA_HEIGHT_PADDING: 20,
} as const;

/**
 * Animation constants
 */
export const ANIMATION_CONSTANTS = {
  DURATION: 200, // milliseconds
  EASING: 'ease-out',
  SHELF_INITIAL_SCALE: 0.9,
  SHELF_INITIAL_OPACITY: 0,
  DRAG_OVER_SCALE: 1.05,
  ITEM_STAGGER_DELAY: 50, // milliseconds
} as const;

/**
 * Performance constants
 */
export const PERFORMANCE_CONSTANTS = {
  MEMORY_LIMIT_MB: 500,
  CPU_LIMIT_PERCENT: 80,
  MOUSE_TRACKING_FPS: 60,
  MOUSE_TRACKING_INTERVAL: 16, // milliseconds (60fps)
  POSITION_LOG_INTERVAL: 3600, // Log every 3600th position update (1 per minute at 60fps)
  PERFORMANCE_CHECK_INTERVAL: 5000, // milliseconds
  GC_TRIGGER_THRESHOLD_MB: 500,
} as const;

/**
 * Drag and shake detection constants
 */
export const DRAG_SHAKE_CONSTANTS = {
  SHAKE_THRESHOLD: 300, // pixels
  SHAKE_TIME_WINDOW: 500, // milliseconds
  DRAG_START_DELAY: 100, // milliseconds
  POSITION_HISTORY_SIZE: 10,
  MIN_SHAKE_MOVEMENTS: 3,
  DIRECTION_CHANGE_THRESHOLD: 0.5, // radians
  MOUSE_POSITION_TIMEOUT: 100, // milliseconds
} as const;

/**
 * Application configuration constants
 */
export const APP_CONSTANTS = {
  MAX_SIMULTANEOUS_SHELVES: 5,
  AUTO_SAVE_INTERVAL: 30000, // milliseconds
  LOG_RETENTION_DAYS: 7,
  DEFAULT_WINDOW_TITLE: 'FileCataloger',
  PRELOAD_SCRIPT_NAME: 'preload.js',
  RENDERER_ENTRY: 'renderer/index.html',
} as const;

/**
 * IPC channel names
 */
export const IPC_CHANNELS = {
  // Shelf operations
  SHELF_CREATE: 'shelf:create',
  SHELF_DESTROY: 'shelf:destroy',
  SHELF_SHOW: 'shelf:show',
  SHELF_HIDE: 'shelf:hide',
  SHELF_DOCK: 'shelf:dock',
  SHELF_UNDOCK: 'shelf:undock',
  SHELF_ADD_ITEM: 'shelf:add-item',
  SHELF_REMOVE_ITEM: 'shelf:remove-item',
  SHELF_UPDATE_CONFIG: 'shelf:update-config',

  // Window events
  WINDOW_READY: 'window:ready',
  WINDOW_DROP_START: 'window:drop-start',
  WINDOW_DROP_END: 'window:drop-end',
  WINDOW_FILES_DROPPED: 'window:files-dropped',
  WINDOW_RESIZE: 'window:resize',
  WINDOW_RESIZED: 'window:resized',
  WINDOW_GET_BOUNDS: 'window:get-bounds',

  // Application events
  APP_ERROR: 'app:error',
  APP_LOG: 'app:log',
  APP_PERFORMANCE_WARNING: 'app:performance-warning',
} as const;

/**
 * File type constants
 */
export const FILE_TYPE_CONSTANTS = {
  MAX_FILE_SIZE_MB: 100,
  ALLOWED_EXTENSIONS: [
    '.txt',
    '.pdf',
    '.doc',
    '.docx',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.mp3',
    '.mp4',
    '.mov',
    '.zip',
    '.rar',
    '.7z',
  ],
  PREVIEW_TIMEOUT: 3000, // milliseconds
} as const;

/**
 * Error handling constants
 */
export const ERROR_CONSTANTS = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // milliseconds
  ERROR_LOG_CONTEXT_LINES: 10,
  MAX_ERROR_STACK_DEPTH: 10,
} as const;

/**
 * Native module constants
 */
export const NATIVE_MODULE_CONSTANTS = {
  FALLBACK_TIMEOUT: 5000, // milliseconds - timeout before falling back to JS implementation
  HEALTH_CHECK_INTERVAL: 30000, // milliseconds
  MAX_RECONNECT_ATTEMPTS: 3,
  RECONNECT_DELAY: 2000, // milliseconds
} as const;

/**
 * Keyboard shortcut constants
 */
export const KEYBOARD_CONSTANTS = {
  MODIFIER_KEYS: {
    CREATE_SHELF: 'CommandOrControl+Shift+D',
    HIDE_ALL_SHELVES: 'Escape',
    TOGGLE_SHELF: 'CommandOrControl+Shift+S',
    CLEAR_ALL: 'CommandOrControl+Shift+C',
  },
  DEBOUNCE_DELAY: 300, // milliseconds
} as const;

/**
 * Window creation constants
 */
export const WINDOW_CONSTANTS = {
  MIN_WIDTH: 200,
  MIN_HEIGHT: 200,
  TASKBAR_HEIGHT_ESTIMATE: 40,
  DOCK_HEIGHT_ESTIMATE: 60,
  SCREEN_EDGE_MARGIN: 10,
  WINDOW_SHADOW_BLUR: 20,
  WINDOW_BORDER_RADIUS: 10,
} as const;

/**
 * Timer and delay constants
 */
export const TIMER_CONSTANTS = {
  DEBOUNCE_DELAY: 300, // milliseconds
  THROTTLE_DELAY: 100, // milliseconds
  UI_UPDATE_DELAY: 16, // milliseconds (60fps)
  LONG_PRESS_DURATION: 500, // milliseconds
  DOUBLE_CLICK_INTERVAL: 300, // milliseconds
} as const;
