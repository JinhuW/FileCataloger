/**
 * TypeScript enums for better type safety and IDE support
 */

/**
 * Window dock positions
 */
export enum DockPosition {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left',
  NONE = 'none',
}

/**
 * Shelf display modes
 */
export enum ShelfMode {
  DEFAULT = 'default',
  RENAME = 'rename',
  COMPACT = 'compact',
}

/**
 * Item types in shelf
 */
export enum ShelfItemType {
  FILE = 'file',
  FOLDER = 'folder',
  TEXT = 'text',
  URL = 'url',
  IMAGE = 'image',
}

// LogLevel is already defined in logger.ts, so we'll skip it here to avoid conflicts

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories for better organization
 */
export enum ErrorCategory {
  SYSTEM = 'system',
  NATIVE = 'native',
  PERFORMANCE = 'performance',
  USER = 'user',
  NETWORK = 'network',
  FILE_SYSTEM = 'file_system',
}

/**
 * Process types in Electron
 */
export enum ProcessType {
  MAIN = 'main',
  RENDERER = 'renderer',
  WORKER = 'worker',
}

/**
 * Window states
 */
export enum WindowState {
  NORMAL = 'normal',
  MAXIMIZED = 'maximized',
  MINIMIZED = 'minimized',
  FULLSCREEN = 'fullscreen',
  HIDDEN = 'hidden',
}

/**
 * Platform identifiers
 */
export enum Platform {
  WINDOWS = 'win32',
  MAC = 'darwin',
  LINUX = 'linux',
}

/**
 * File operation actions
 */
export enum FileOperation {
  COPY = 'copy',
  MOVE = 'move',
  DELETE = 'delete',
  RENAME = 'rename',
  CREATE = 'create',
}

/**
 * Module status for health checks
 */
export enum ModuleStatus {
  INITIALIZING = 'initializing',
  READY = 'ready',
  RUNNING = 'running',
  STOPPED = 'stopped',
  ERROR = 'error',
  DESTROYED = 'destroyed',
}

/**
 * User preference keys
 */
export enum PreferenceKey {
  THEME = 'theme',
  SHELF_OPACITY = 'shelf.opacity',
  SHELF_AUTO_HIDE = 'shelf.autoHide',
  SHELF_DOCK_POSITION = 'shelf.dockPosition',
  SHOW_IN_DOCK = 'showInDock',
  START_AT_LOGIN = 'startAtLogin',
  ENABLE_ANIMATIONS = 'enableAnimations',
  ENABLE_SOUNDS = 'enableSounds',
  DEBUG_MODE = 'debugMode',
}

/**
 * Theme options
 */
export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  AUTO = 'auto',
}

/**
 * Component types for meta-component system
 */
export enum ComponentType {
  TEXT = 'text',
  SELECT = 'select',
  DATE = 'date',
  NUMBER = 'number',
}

/**
 * Component scope (global or pattern-specific)
 */
export enum ComponentScope {
  GLOBAL = 'global',
  LOCAL = 'local',
}

/**
 * Date source for date components
 */
export enum DateSource {
  CURRENT = 'current',
  FILE_CREATED = 'file-created',
  FILE_MODIFIED = 'file-modified',
  CUSTOM = 'custom',
}

/**
 * Number format for number components
 */
export enum NumberFormat {
  PLAIN = 'plain',
  PADDED = 'padded',
}
