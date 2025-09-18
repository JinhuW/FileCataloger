// Shared type definitions for the application

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

export type DockPosition = 'top' | 'right' | 'bottom' | 'left';

export interface ShelfItem {
  id: string;
  type: 'file' | 'text' | 'url' | 'image';
  name: string;
  path?: string;
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
  mode?: 'default' | 'rename'; // Shelf mode - default or rename
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
  type: 'date' | 'fileName' | 'counter' | 'text' | 'project';
  value?: string;
  format?: string; // For date components
  placeholder?: string;
}

export interface RenamePattern {
  components: RenameComponent[];
}

export interface FileRenamePreview {
  originalName: string;
  newName: string;
  selected: boolean;
}
