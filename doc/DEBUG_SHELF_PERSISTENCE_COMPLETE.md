# Shelf Persistence Debug Documentation

## Issue Overview
The shelf window was disappearing even after files were successfully dropped into it. This was a critical issue that prevented the core functionality of the application from working properly.

## Root Cause Analysis

### 1. **Primary Issue: Preload Script Path Error**
- The preload script path was incorrect: `../preload/index.js` instead of `../../preload/index.js`
- This caused the renderer process to crash with "Cannot find module" error
- Without the preload script, `window.api` was undefined, breaking all IPC communication

### 2. **Timing Race Condition**
- Native drag monitor detects mouse button release and immediately fires `dragEnd`
- ApplicationController receives `drag-end` and starts clearing empty shelves
- Browser/renderer processes the drop event AFTER native dragEnd
- Shelf is destroyed before drop event can be processed

### 3. **Missing IPC Communication**
- Renderer couldn't notify main process about dropped files
- Backend thought shelves were empty even after files were dropped
- No mechanism to protect shelves during active drop operations

## Solution Implementation

### Phase 1: Initial Attempts
1. **Removed drag-end shelf clearing** - Partial success but caused other issues
2. **Added async IPC improvements** - Helped with reliability but didn't solve core issue
3. **Added delay to shelf clearing** - Worked around timing issue but not ideal

### Phase 2: Core Fix Implementation

#### 1. **Fixed Preload Script Path**
```typescript
// shelf-manager.ts
webPreferences: {
  // Changed from: path.join(__dirname, '../preload/index.js')
  preload: path.join(__dirname, '../../preload/index.js'),
}
```

#### 2. **Enhanced Drop Event Handling**
Added IPC notifications for drop start/end in Shelf.tsx:
```typescript
onDragEnter={(e) => {
  window.api.send('shelf:drop-start', config.id);
}}

onDrop={(e) => {
  window.api.send('shelf:drop-end', config.id);
  // Process drop and notify backend about files
  window.api.send('shelf:files-dropped', { shelfId: config.id, files: filePaths });
}}
```

#### 3. **Protected Shelf Cleanup Logic**
```typescript
private clearEmptyShelves(): void {
  // Don't clear shelves that are actively receiving drops
  if (this.activeDropOperations.size > 0) {
    this.logger.info('⏸️ Skipping shelf cleanup - drop operations in progress');
    return;
  }
  
  // Don't clear shelves during active drag operation
  if (this.isDragging) {
    this.logger.info('📌 Skipping shelf cleanup - drag still in progress');
    return;
  }
  
  // Only clear truly empty shelves
  if (shelfConfig && shelfConfig.items.length === 0) {
    this.shelfManager.destroyShelf(shelfId);
  }
}
```

#### 4. **Improved Shelf Lifecycle Management**
- Track active drop operations with `activeDropOperations` Set
- Cancel auto-hide timers when items are added
- Mark shelves as "expecting drops" during drag operations
- Pin shelves automatically when they receive content

### Phase 3: Final Optimizations

1. **Configurable Timing**
   - Immediate empty shelf check on mouse release (removed 2-second delay)
   - Reduced auto-hide timeout from 30 seconds to 5 seconds
   - Made shelves more responsive to user actions

2. **Debug Enhancements**
   - Added console message forwarding from renderer to main
   - Enhanced logging throughout IPC flow
   - Added debug output for window.api availability

## Technical Details

### IPC Channel Flow
1. `shelf:drop-start` - Notifies when drag enters shelf
2. `shelf:files-dropped` - Sends file paths to backend
3. `shelf:add-item` - Adds individual items to shelf
4. `shelf:drop-end` - Notifies when drop completes

### State Management
- `isDragging` - Tracks global drag state
- `activeDropOperations` - Set of shelf IDs currently receiving drops
- `activeEmptyShelfId` - Tracks the single active empty shelf
- `shelfAutoHideTimers` - Map of shelf IDs to timer references

### Key Configuration
```typescript
config = {
  autoHideDelay: 3000,           // Not currently used
  maxSimultaneousShelves: 5,     
  enableShakeGesture: true,      
  enableDragDetection: true,     
  useNativeDragMonitor: true,    
  emptyShelfTimeout: 5000        // Auto-hide empty shelves after 5 seconds
}
```

## Testing Checklist

### Basic Functionality
- [ ] Drag files from Finder
- [ ] Shake mouse while dragging - shelf appears
- [ ] Drop files on shelf - shelf persists
- [ ] Release mouse without dropping - shelf disappears immediately

### Edge Cases
- [ ] Multiple quick drag operations
- [ ] Drop multiple files at once
- [ ] Drop different file types (images, documents, folders)
- [ ] Cancel drop operation (ESC or drag away)
- [ ] Create multiple shelves in succession

### Timing Tests
- [ ] Empty shelf auto-hides after 5 seconds
- [ ] Shelf with items never auto-hides
- [ ] Drop operation protection works during entire drop

## Known Issues & Limitations

1. **Renderer Crashes**: If preload path is wrong, renderer crashes with alert dialog
2. **Native Module Errors**: "Failed to start native drag monitor" is expected (duplicate start)
3. **Performance Warning**: CPU usage spikes during drag operations

## Debug Commands

```bash
# Watch for key events during drag/drop
yarn dev | grep -E "button released|DROP START|DROP END|files-dropped|DESTROYING SHELF"

# Monitor IPC communication
yarn dev | grep -E "IPC:|shelf:add-item|window.api"

# Track shelf lifecycle
yarn dev | grep -E "shelf_.*created|shelf_.*destroyed|Single shelf created"
```

## Future Improvements

1. **Alternative Drop Detection**
   - Use Electron's native file drop events
   - Implement drop detection in main process
   - Add file type filtering before drop

2. **Better Error Handling**
   - Graceful fallback when preload fails
   - Recovery mechanism for renderer crashes
   - User-friendly error messages

3. **Performance Optimizations**
   - Reduce CPU usage during drag operations
   - Optimize native module polling frequency
   - Implement shelf window pooling

## Summary

The shelf persistence issue was ultimately caused by a simple path error that cascaded into a complete communication breakdown between the renderer and main process. The fix involved:

1. Correcting the preload script path
2. Adding proper drop event notifications
3. Implementing protection for shelves during drop operations
4. Fine-tuning the timing for better user experience

The application now correctly:
- Creates shelves on drag + shake
- Accepts dropped files
- Persists shelves with content
- Cleans up empty shelves appropriately