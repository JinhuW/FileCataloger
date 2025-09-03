import { EventEmitter } from 'events';
import { clipboard } from 'electron';
import { DragDetector, DragData } from '@shared/types';

/**
 * Simple pasteboard-based drag detector
 * 
 * This checks if files are on the pasteboard when needed.
 * Works well for Finder drags (pasteboard updates immediately).
 * Desktop drags update pasteboard only on drop.
 */
export class SimplePasteboardDetector extends EventEmitter implements DragDetector {
  private isActive: boolean = false;

  public start(): void {
    if (this.isActive) {
      return;
    }
    this.isActive = true;
  }

  public stop(): void {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
  }

  /**
   * Check if files are currently being dragged
   * Called synchronously when shake is detected
   */
  public isDraggingFiles(): boolean {
    if (!this.isActive) {
      return false;
    }

    try {
      // Check if there are file paths on the clipboard
      const formats = clipboard.availableFormats();
      
      // More comprehensive check for file dragging
      // macOS specific formats when dragging from Finder
      const hasFiles = formats.some(format => 
        format.includes('public.file-url') ||          // macOS file URL
        format.includes('NSFilenamesPboardType') ||    // macOS filenames
        format.includes('com.apple.pasteboard.promised-file-url') || // macOS promised files
        format.includes('file') || 
        format.includes('FileNameW') || 
        format.includes('FileNameMap')
      );

      if (hasFiles) {
        return true;
      }

      // Check HTML for file references (sometimes files are represented in HTML)
      const html = clipboard.readHTML();
      if (html && html.includes('file://')) {
        return true;
      }

      // Also check for file URLs in text
      const text = clipboard.readText();
      if (text && text.startsWith('file://')) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking pasteboard:', error);
      return false;
    }
  }
}