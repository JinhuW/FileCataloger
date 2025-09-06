# Dropover Drag + Shake Detection Research Report

## Executive Summary

This report analyzes how Dropover implements its signature drag + shake detection feature and compares it to our current implementation. The key finding is that Dropover uses a sophisticated system that detects file dragging operations FIRST, then responds to shake gestures to show/hide shelves.

## User-Observed Behavior

Based on user observations, Dropover exhibits these specific behaviors:

1. **File/Folder Specific Triggering**: The shelf only appears when dragging actual files or folders from Finder or other applications
2. **Immediate Dismissal**: When the user releases the drag (mouse up), the shelf disappears immediately
3. **Shake Sensitivity**: The shake gesture has adjustable sensitivity settings
4. **Global System Integration**: Works across all macOS applications that support drag operations

## Technical Implementation Analysis

### Dropover's Likely Approach

Based on research and macOS development best practices, Dropover likely uses:

1. **CGEventTap for Mouse Monitoring**
   - Monitors `kCGEventLeftMouseDown`, `kCGEventLeftMouseDragged`, and `kCGEventLeftMouseUp` events
   - Tracks mouse position and movement patterns globally

2. **NSPasteboard Drag Detection**
   - Monitors `NSPasteboardNameDrag` for changes in drag content
   - Checks for file URL types: `NSPasteboardTypeFileURL`, `NSFilenamesPboardType`, etc.
   - Validates that dragged content contains actual files/folders

3. **Shake Pattern Recognition**
   - Analyzes mouse trajectory during drag operations
   - Detects rapid direction changes indicating shake gestures
   - Uses configurable thresholds for sensitivity

4. **State Management**
   - **Drag Detection Phase**: First detects that files are being dragged
   - **Shake Detection Phase**: Only after drag is confirmed, listens for shake
   - **Shelf Display**: Shows shelf when both conditions are met
   - **Immediate Cleanup**: Hides shelf on mouse release

### Our Current Implementation

Our implementation in `drag-shake-detector.ts` attempts to replicate this behavior:

#### Native Detection (Preferred)
```typescript
// Uses CGEventTap via native module (darwin-drag-monitor.mm)
this.dragDetector = new MacDragMonitor();
```

#### Fallback Detection (When Native Fails)
```typescript
// Uses optimistic detection with EnhancedDragDetector
this.dragDetector = new EnhancedDragDetector();
```

#### Key Implementation Details

1. **Two-Stage Detection Process**:
   - Stage 1: Detect file drag operation via pasteboard monitoring
   - Stage 2: Detect shake gesture during drag operation

2. **Native CGEventTap Implementation** (`darwin-drag-monitor.mm`):
   - Monitors mouse events with minimal latency (3px, 10ms thresholds)
   - Checks pasteboard for file content when drag distance exceeds threshold
   - Supports multiple file types and UTIs

3. **Shake Detection** (`shake-detector.ts`):
   - Configurable sensitivity (currently: 1 direction change, 1px movement)
   - Time window analysis (1.5 seconds)
   - Trajectory analysis for pattern recognition

## Critical Differences from Dropover

### What Dropover Does Better

1. **Reliable File Detection**: Always correctly identifies file/folder drags
2. **Perfect Timing**: Shelf appears exactly when needed, disappears on release
3. **No False Positives**: Never triggers on non-file drags or shake-only gestures
4. **Smooth Performance**: No noticeable lag or system impact

### Our Current Limitations

1. **Native Module Issues**: 
   - Loading problems in fallback mode
   - Accessibility permission requirements
   - Build complexity (node-gyp, native compilation)

2. **Fallback Mode Problems**:
   - Cannot reliably detect file drags without native access
   - Uses "optimistic" detection (assumes drag when shake occurs)
   - May trigger false positives on shake-only gestures

3. **Timing Issues**:
   - Pasteboard access timing challenges during global event monitoring
   - Debounce delays affecting responsiveness

## Technical Challenges in macOS Drag Detection

### Pasteboard Timing Issues
```typescript
// The fundamental challenge: pasteboard content isn't available
// during CGEventTap callbacks due to security restrictions
let dragPasteboard = NSPasteboard.pasteboardWithName(.drag)
// dragPasteboard may be empty during global event monitoring
```

### Security and Permissions
- Accessibility permissions required for CGEventTap
- Sandboxing restrictions on pasteboard access
- File URL security scoping for accessing dragged files

### Cross-Application Compatibility
- Different apps expose drag data differently
- Some apps use "promised" files (not yet written to disk)
- Legacy vs. modern pasteboard types

## Recommendations for Improvement

### Short Term (Current Implementation)

1. **Improve Native Module Reliability**:
   - Fix loading issues in production builds
   - Better error handling and fallback transitions
   - Streamline build process

2. **Enhance Fallback Mode**:
   - Reduce false positives with better heuristics
   - Implement basic file detection without pasteboard access
   - Add manual trigger options (keyboard shortcuts)

### Long Term (Architectural Changes)

1. **Hybrid Detection System**:
   ```typescript
   // Combine multiple detection methods
   const detectionMethods = [
     new CGEventTapDetector(),     // Primary
     new AccessibilityDetector(),  // Fallback 1
     new PasteboardPolling(),      // Fallback 2
     new ManualTrigger()           // Last resort
   ];
   ```

2. **Machine Learning Approach**:
   - Train models on mouse movement patterns
   - Distinguish between intentional shake and normal cursor movement
   - Adapt to user-specific behavior patterns

3. **Alternative Activation Methods**:
   - Keyboard shortcuts (already implemented: Cmd+Shift+D)
   - Menu bar integration
   - Dock icon interactions
   - Edge-of-screen triggers

## Conclusion

Dropover's success comes from its precise detection of file drag operations before responding to shake gestures. The key insight is that **drag detection must come first**, followed by shake detection, not the reverse.

Our implementation challenges stem from:
1. macOS security restrictions on global pasteboard access
2. Complex native module build requirements  
3. Timing coordination between drag and shake detection systems

The path forward involves improving native module reliability while maintaining robust fallback options for when native access fails.

## Implementation Priority

1. **High Priority**: Fix native module loading and accessibility setup
2. **Medium Priority**: Improve fallback mode accuracy and reduce false positives  
3. **Low Priority**: Add alternative activation methods and ML-based detection

---

*Report generated: 2025-09-06*  
*Current implementation status: Native module functional, fallback mode active*  
*Key files: `drag-shake-detector.ts`, `darwin-drag-monitor.mm`, `enhanced-drag-detector.ts`*