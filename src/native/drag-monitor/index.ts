import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

// Declare webpack's special require function
declare const __non_webpack_require__: NodeRequire | undefined;

export interface DraggedItem {
  path: string;
  name: string;
  type?: 'file' | 'folder';
  isDirectory?: boolean;
  isFile?: boolean;
  size?: number;
  extension?: string;
  exists?: boolean;
}

export interface DragEvent {
  isDragging: boolean;
  items: DraggedItem[];
}

// Try to load the native module directly
let nativeModule: any = null;

try {
  // First try: Direct require of the node file that webpack copies
  // Webpack should copy drag_monitor_darwin.node to dist/main/
  nativeModule = require('./drag_monitor_darwin.node');
  console.log('✅ Loaded native drag monitor via direct require');
} catch (e1) {
  console.log('Direct require failed, trying alternate paths...');
  
  try {
    // Second try: Load from build directory
    nativeModule = require('./build/Release/drag_monitor_darwin.node');
    console.log('✅ Loaded native drag monitor from build directory');
  } catch (e2) {
    try {
      // Third try: Use absolute path
      const modulePath = path.join(process.cwd(), 'dist', 'main', 'drag_monitor_darwin.node');
      if (fs.existsSync(modulePath)) {
        nativeModule = require(modulePath);
        console.log('✅ Loaded native drag monitor from absolute path:', modulePath);
      }
    } catch (e3) {
      console.error('❌ Could not load native drag monitor module');
    }
  }
}

// Log the module load result
if (nativeModule) {
  console.log('🔍 Native module load result:', {
    hasModule: true,
    hasDarwinDragMonitor: !!(nativeModule.DarwinDragMonitor),
    moduleKeys: Object.keys(nativeModule)
  });
} else {
  console.log('🔍 Native module load result: Module not loaded');
}

export class MacDragMonitor extends EventEmitter {
  private nativeMonitor: any = null;
  private isMonitoring: boolean = false;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private wasActiveDrag: boolean = false;
  private pollCount: number = 0;
  
  constructor() {
    super();
    this.initializeNativeMonitor();
  }
  
  private initializeNativeMonitor(): void {
    if (!nativeModule) {
      throw new Error('Native drag monitor module not available. Run: cd src/native/drag-monitor && node-gyp rebuild');
    }
    
    if (!nativeModule.DarwinDragMonitor) {
      throw new Error('DarwinDragMonitor class not found in native module');
    }
    
    try {
      // Create native monitor instance without callbacks (using polling instead)
      this.nativeMonitor = new nativeModule.DarwinDragMonitor();
      
      console.log('✅ Native DarwinDragMonitor instance created successfully');
    } catch (error: any) {
      console.error('❌ Failed to initialize native drag monitor:', error);
      console.error('Error details:', error.message);
      throw error;
    }
  }
  
  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }
    
    // Poll at 60fps (16ms) for responsive drag detection
    this.pollingInterval = setInterval(() => {
      if (!this.nativeMonitor) {
        return;
      }
      
      this.pollCount++;
      
      try {
        const hasActiveDrag = this.nativeMonitor.hasActiveDrag();
        
        // Log every 60 polls (about once per second)
        if (this.pollCount % 60 === 0) {
          console.log(`🔍 Drag monitor polling #${this.pollCount}: hasActiveDrag=${hasActiveDrag}`);
        }
        
        if (hasActiveDrag && !this.wasActiveDrag) {
          // Drag just started
          const files = this.nativeMonitor.getDraggedFiles();
          console.log('🎯 Native drag started via polling', { fileCount: files.length });
          
          const items: DraggedItem[] = files.map((file: any) => ({
            path: file.path,
            name: file.name || path.basename(file.path),
            type: file.type as 'file' | 'folder',
            isDirectory: file.isDirectory,
            isFile: file.isFile,
            size: file.size,
            extension: file.extension,
            exists: file.exists
          }));
          
          console.log(`📂 Processing ${items.length} dragged items`);
          items.forEach(item => {
            console.log(`  - ${item.type}: ${item.name}`);
          });
          
          this.emit('dragStart', items);
          this.emit('dragging', items);
          
        } else if (!hasActiveDrag && this.wasActiveDrag) {
          // Drag just ended
          console.log('🛑 Native drag ended via polling');
          this.emit('dragEnd');
        }
        
        this.wasActiveDrag = hasActiveDrag;
        
      } catch (error) {
        console.error('❌ Error during drag polling:', error);
      }
    }, 16);
  }
  
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.wasActiveDrag = false;
    }
  }
  
  public start(): boolean {
    if (this.isMonitoring) {
      return false;
    }
    
    if (!this.nativeMonitor) {
      return false;
    }
    
    try {
      const result = this.nativeMonitor.start();
      if (result) {
        this.isMonitoring = true;
        this.startPolling();
        this.emit('started');
        console.log('✅ Native drag monitor started successfully with polling');
      } else {
        console.warn('⚠️ Native drag monitor failed to start - may need accessibility permissions');
      }
      return result;
    } catch (error) {
      console.error('❌ Failed to start drag monitor:', error);
      this.emit('error', error);
      return false;
    }
  }
  
  public stop(): boolean {
    if (!this.isMonitoring) {
      return false;
    }
    
    if (!this.nativeMonitor) {
      return false;
    }
    
    try {
      this.stopPolling();
      const result = this.nativeMonitor.stop();
      if (result) {
        this.isMonitoring = false;
        this.emit('stopped');
      }
      return result;
    } catch (error) {
      console.error('❌ Failed to stop drag monitor:', error);
      this.emit('error', error);
      return false;
    }
  }
  
  public isDragging(): boolean {
    return this.nativeMonitor?.isMonitoring() || false;
  }
  
  public getDraggedItems(): DraggedItem[] {
    return [];
  }
  
  public destroy(): void {
    if (this.isMonitoring) {
      this.stop();
    }
    
    this.stopPolling();
    this.nativeMonitor = null;
    this.removeAllListeners();
  }
}

export function createDragMonitor(): MacDragMonitor | null {
  try {
    return new MacDragMonitor();
  } catch (error) {
    console.error('❌ Could not create MacDragMonitor:', error);
    return null;
  }
}

export function isNativeModuleAvailable(): boolean {
  return nativeModule !== null && nativeModule.DarwinDragMonitor !== undefined;
}