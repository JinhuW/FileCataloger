// Shared type definitions for the application

import { DockPosition, ShelfItemType, ShelfMode } from './enums';

// Re-export for convenience
export { DockPosition, ShelfItemType, ShelfMode };

export interface Vector2D {
  x: number;
  y: number;
}

export interface MousePosition extends Vector2D {
  timestamp: number;
  leftButtonDown?: boolean;
}

export interface MouseTracker {
  start(): void;
  stop(): void;
  getCurrentPosition(): MousePosition;
  isTracking(): boolean;
  getPerformanceMetrics?(): PerformanceMetrics | null;
  on(event: 'position', listener: (position: MousePosition) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  removeAllListeners(event?: string): void;
}

export interface ShakeDetectionConfig {
  minDirectionChanges: number;
  timeWindow: number; // milliseconds
  minDistance: number; // pixels
  debounceTime: number; // milliseconds
  minVelocity?: number; // minimum velocity in pixels/ms
  maxVelocity?: number; // maximum velocity to filter out erratic movements
  velocityWeight?: number; // weight factor for velocity in intensity calculation
}

export interface ShakeDetector {
  configure(config: Partial<ShakeDetectionConfig>): void;
  start(): void;
  stop(): void;
  on(event: 'shake', listener: () => void): void;
  removeAllListeners(event?: string): void;
}

export interface DragData {
  types: string[];
  files: string[];
  text?: string;
  html?: string;
}

export interface DragDetector {
  start(): void;
  stop(): void;
  on(event: 'drag-start', listener: (data: DragData) => void): void;
  on(event: 'drag-end', listener: () => void): void;
  removeAllListeners(event?: string): void;
}

export interface DragShakeEvent {
  type: 'dragShake';
  isDragging: boolean;
  items?: Array<{
    name: string;
    path: string;
    type: string;
  }>;
  position: Vector2D;
  timestamp: number;
}

export interface DragItem {
  name: string;
  path: string;
  type: string;
}

// DockPosition is now imported from enums.ts

export interface ShelfItem {
  id: string;
  type: ShelfItemType;
  name: string;
  path?: string; // Optional - browser File API doesn't always provide full path
  content?: string;
  size?: number;
  createdAt: number;
  thumbnail?: string;
}

export interface ShelfConfig {
  id: string;
  position: Vector2D;
  dockPosition: DockPosition | null;
  isPinned: boolean;
  items: ShelfItem[];
  isVisible: boolean;
  opacity: number;
  isDropZone?: boolean; // True if this is a temporary drop zone
  autoHide?: boolean; // True if shelf should auto-hide when drag ends
  mode?: ShelfMode; // Shelf mode
}

export interface PerformanceMetrics {
  mouseEventFrequency: number; // events per second
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
  lastUpdate: number; // timestamp
}

// File Rename Types
export interface RenameComponent {
  id: string;
  type: 'date' | 'fileName' | 'counter' | 'text' | 'project' | string; // Allow plugin types
  value?: string;
  format?: string; // For date components
  placeholder?: string;
  pluginId?: string; // For plugin components
  config?: Record<string, any>; // Plugin-specific configuration
}

export interface RenamePattern {
  components: RenameComponent[];
}

export interface SavedPattern {
  id: string;
  name: string;
  components: RenameComponent[];
  createdAt: number;
  updatedAt: number;
  isBuiltIn: boolean;
  isDefault: boolean;
  metadata?: {
    description?: string;
    usageCount?: number;
    lastUsed?: number;
    favorite?: boolean;
  };
}

export interface FileRenamePreview {
  originalName: string;
  newName: string;
  selected: boolean;
  type?: ShelfItem['type'];
}

// Application status types
export interface AppStatus {
  isRunning: boolean;
  activeShelves: number;
  modules: {
    mouseTracker: boolean;
    shakeDetector: boolean;
    dragDetector: boolean;
  };
  analytics: {
    mouseTracker: {
      eventsPerSecond: number;
      cpuUsage: number;
      memoryUsage: number;
    };
    shakeDetector: {
      shakesDetected: number;
      lastShakeTime: number;
    };
    dragDetector: {
      dragsDetected: number;
      filesDropped: number;
    };
  };
}

// File info for rename operations
export interface FileInfo {
  path: string;
  name: string;
  newName: string;
  error?: string;
}
