import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

export interface DraggedItem {
  path: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  extension?: string;
  exists?: boolean;
}

// Direct native module loading for Electron
function loadNativeModule(): any {
  const moduleName = 'drag_monitor_darwin.node';
  
  // Try different possible locations
  const possiblePaths = [
    // Development paths
    path.join(process.cwd(), 'dist', 'main', 'build', 'Release', moduleName),
    path.join(process.cwd(), 'src', 'native', 'drag-monitor', 'build', 'Release', moduleName),
    // Runtime paths
    path.join(__dirname, moduleName),
    path.join(__dirname, 'build', 'Release', moduleName),
  ];

  for (const modulePath of possiblePaths) {
    if (fs.existsSync(modulePath)) {
      try {
        // Use process.dlopen for native modules in Electron
        const nativeModule: any = { exports: {} };
        process.dlopen(nativeModule, modulePath);
        console.log(`✅ Native drag monitor loaded from: ${modulePath}`);
        return nativeModule.exports;
      } catch (error: any) {
        console.error(`Failed to load from ${modulePath}:`, error.message);
      }
    }
  }
  
  throw new Error('Native drag monitor module not found. Run: npm run rebuild:native');
}

// Defer loading until first use
let nativeModule: any = null;

export class MacDragMonitor extends EventEmitter {
  private nativeMonitor: any = null;
  private isMonitoring: boolean = false;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private wasActiveDrag: boolean = false;
  
  constructor() {
    super();
    
    // Load module lazily on first use
    if (!nativeModule) {
      nativeModule = loadNativeModule();
    }
    
    if (!nativeModule || !nativeModule.DarwinDragMonitor) {
      throw new Error('Native module loaded but DarwinDragMonitor class not found');
    }
    
    // Create native monitor without callbacks (using polling instead)
    this.nativeMonitor = new nativeModule.DarwinDragMonitor();
    
    console.log('✅ Native DarwinDragMonitor instance created successfully (loader)');
  }
  
  private startPolling(): void {
    if (this.pollingInterval) {
      return;
    }
    
    // Poll at 20fps (50ms) for stable drag detection
    this.pollingInterval = setInterval(() => {
      if (!this.nativeMonitor) {
        return;
      }
      
      try {
        const hasActiveDrag = this.nativeMonitor.hasActiveDrag();
        
        if (hasActiveDrag && !this.wasActiveDrag) {
          // Drag just started
          const files = this.nativeMonitor.getDraggedFiles();
          console.log('🎯 Native drag started via polling (loader)', { fileCount: files.length });
          
          const items: DraggedItem[] = files.map((file: any) => ({
            path: file.path,
            name: file.name || path.basename(file.path),
            type: file.type as 'file' | 'folder',
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
          console.log('🛑 Native drag ended via polling (loader)');
          this.emit('dragEnd');
        }
        
        this.wasActiveDrag = hasActiveDrag;
        
      } catch (error) {
        console.error('❌ Error during drag polling:', error);
      }
    }, 50);
  }
  
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.wasActiveDrag = false;
    }
  }
  
  public start(): boolean {
    if (this.isMonitoring) return true;
    
    if (!this.nativeMonitor) {
      console.error('Native monitor not initialized');
      return false;
    }
    
    try {
      const result = this.nativeMonitor.start();
      if (result) {
        this.isMonitoring = true;
        this.startPolling();
        this.emit('started');
        console.log('✅ Native drag monitor started with polling (loader)');
      }
      return result;
    } catch (error: any) {
      console.error('Failed to start drag monitor:', error.message);
      this.emit('error', error);
      return false;
    }
  }
  
  public stop(): boolean {
    if (!this.isMonitoring) return false;
    
    try {
      this.stopPolling();
      const result = this.nativeMonitor.stop();
      if (result) {
        this.isMonitoring = false;
        this.emit('stopped');
      }
      return result;
    } catch (error: any) {
      console.error('Failed to stop drag monitor:', error.message);
      return false;
    }
  }
  
  public destroy(): void {
    this.stop();
    this.stopPolling();
    this.nativeMonitor = null;
    this.removeAllListeners();
  }
}

export function createDragMonitor(): MacDragMonitor {
  return new MacDragMonitor();
}