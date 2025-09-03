import { EventEmitter } from 'events';
import { clipboard } from 'electron';
import { DragDetector } from '@shared/types';

/**
 * Enhanced drag detector with optimistic activation
 * 
 * This detector uses multiple strategies to detect file dragging:
 * 1. Monitors clipboard/pasteboard for file content
 * 2. Uses optimistic activation - assumes dragging when conditions are met
 * 3. Auto-disables after timeout to prevent false positives
 */
export class EnhancedDragDetector extends EventEmitter implements DragDetector {
  private isActive: boolean = false;
  private isDragging: boolean = false;
  private dragTimeout: NodeJS.Timeout | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastClipboardCheck: number = 0;
  
  // Configuration
  private readonly DRAG_TIMEOUT = 3000; // Auto-disable after 3 seconds
  private readonly CHECK_INTERVAL = 100; // Check clipboard every 100ms during potential drag
  
  constructor() {
    super();
  }

  public start(): void {
    if (this.isActive) {
      console.warn('EnhancedDragDetector is already active');
      return;
    }

    this.isActive = true;
    console.log('✅ Enhanced drag detector started');
  }

  public stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.stopDragMode();
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    console.log('❌ Enhanced drag detector stopped');
  }

  /**
   * Enable drag mode optimistically when shake is detected
   * This is called when user shakes the mouse, assuming they might be dragging
   */
  public enableOptimisticDragMode(): void {
    if (!this.isActive) return;
    
    console.log('🎯 Optimistic drag mode ENABLED - assuming user is dragging');
    this.isDragging = true;
    this.emit('drag-start');
    
    // Start checking clipboard for actual file content
    this.startClipboardMonitoring();
    
    // Set timeout to auto-disable
    this.resetDragTimeout();
  }

  /**
   * Start monitoring clipboard for file content
   */
  private startClipboardMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(() => {
      this.checkForFiles();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Check if files are being dragged
   */
  private checkForFiles(): boolean {
    try {
      // Check various clipboard formats that indicate file dragging
      const formats = clipboard.availableFormats();
      console.log('📋 Available clipboard formats:', formats);
      
      // Check for file-related formats
      const hasFiles = formats.some(format => 
        format.includes('file') || 
        format.includes('File') ||
        format.includes('public.file-url') ||
        format.includes('NSFilenamesPboardType') ||
        format.includes('text/uri-list') ||
        format.includes('text/x-moz-url')
      );
      
      if (hasFiles) {
        console.log('✅ Files detected in drag operation!');
        
        // Try to get file paths
        let filePaths: string[] = [];
        
        // Try different methods to get file paths
        if (formats.includes('public.file-url')) {
          const fileUrl = clipboard.read('public.file-url');
          if (fileUrl) filePaths.push(fileUrl);
        }
        
        // Try reading as text (might contain file URLs)
        const text = clipboard.readText();
        if (text && text.startsWith('file://')) {
          filePaths.push(text);
        }
        
        if (filePaths.length > 0) {
          console.log('📁 Detected file paths:', filePaths);
          this.emit('files-detected', filePaths);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking clipboard:', error);
      return false;
    }
  }

  /**
   * Reset the drag timeout
   */
  private resetDragTimeout(): void {
    // Clear existing timeout
    if (this.dragTimeout) {
      clearTimeout(this.dragTimeout);
    }
    
    // Set new timeout
    this.dragTimeout = setTimeout(() => {
      this.stopDragMode();
    }, this.DRAG_TIMEOUT);
  }

  /**
   * Stop drag mode
   */
  private stopDragMode(): void {
    if (!this.isDragging) return;
    
    console.log('🛑 Drag mode DISABLED (timeout or manual)');
    this.isDragging = false;
    this.emit('drag-end');
    
    // Stop clipboard monitoring
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // Clear timeout
    if (this.dragTimeout) {
      clearTimeout(this.dragTimeout);
      this.dragTimeout = null;
    }
  }

  /**
   * Check if currently in drag mode
   */
  public isDraggingFiles(): boolean {
    return this.isDragging;
  }

  /**
   * Force check for files (used when shake is detected)
   */
  public checkNow(): boolean {
    return this.checkForFiles();
  }
}