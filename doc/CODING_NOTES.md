# CODING_NOTES.md

## Native File Drag Detection on macOS - Complete Solution

### Problem
The application couldn't detect file dragging from Finder, Desktop, or other apps. Initially tried using clipboard monitoring which was unreliable and couldn't detect actual drag operations.

### Solution: Native macOS Drag Monitor

#### 1. **Native Module Implementation** (`src/native/drag-monitor/darwin-drag-monitor.mm`)
- Uses CGEventTap API to monitor system-wide mouse events
- Monitors NSPasteboard drag pasteboard for file detection
- Tracks drag state with minimum thresholds to avoid false positives

Key components:
```cpp
// Monitor these mouse events
CGEventMask eventMask = (1 << kCGEventLeftMouseDown) | 
                       (1 << kCGEventLeftMouseUp) |
                       (1 << kCGEventLeftMouseDragged);

// Detection thresholds (tunable for sensitivity)
const double MIN_DRAG_DISTANCE = 3.0;  // pixels
const int MIN_DRAG_TIME = 10;          // milliseconds
const int MIN_MOVE_COUNT = 1;          // drag events
```

#### 2. **Comprehensive Pasteboard Type Detection**
Detects files from various sources by checking multiple pasteboard types:
- `NSPasteboardTypeFileURL` - Modern file URLs (most apps)
- `NSFilenamesPboardType` - Legacy filename format
- `public.file-url` - Public UTI for files
- `com.apple.pasteboard.promised-file-content` - Promised files (browser downloads)
- `com.apple.pasteboard.promised-file-url` - URL promises

#### 3. **TypeScript Integration** (`src/native/drag-monitor/index.ts`)
Provides EventEmitter interface for the native module:
```typescript
const nativeDragMonitor = createNativeDragMonitor();
nativeDragMonitor.on('drag-start', () => console.log('Drag started'));
nativeDragMonitor.on('drag-data', (data) => console.log('Files:', data));
nativeDragMonitor.on('drag-end', () => console.log('Drag ended'));
```

#### 4. **Application Integration** (`src/main/modules/application-controller.ts`)
- Tracks `isDragging` state from native monitor
- Requires BOTH drag AND shake gestures
- Manages single active empty shelf

### Shake Detection Tuning

#### Sensitivity Settings (`src/main/modules/shake-detector.ts`)
Adjust these parameters for shake sensitivity:
```typescript
private config: ShakeDetectionConfig = {
  minDirectionChanges: 2,    // Lower = easier to trigger (was 4)
  timeWindow: 600,           // Higher = more time to complete gesture
  minDistance: 5,            // Lower = smaller movements count
  debounceTime: 300         // Lower = can trigger more frequently
};
```

### Building and Running

1. **Compile Native Module**:
   ```bash
   cd src/native/drag-monitor
   node-gyp rebuild
   # OR use electron-rebuild for Electron compatibility
   npx electron-rebuild
   ```

2. **Copy to dist folder** (handled by webpack):
   ```javascript
   // webpack.main.config.js
   new CopyWebpackPlugin({
     patterns: [
       {
         from: 'src/native/drag-monitor/build/Release/drag_monitor_darwin.node',
         to: 'build/Release/drag_monitor_darwin.node'
       }
     ]
   })
   ```

3. **Run the app**:
   ```bash
   yarn build && yarn dev
   ```

### Troubleshooting

1. **"Could not load native module"**: Run `npx electron-rebuild`
2. **False positives from clicks**: Increase `MIN_DRAG_DISTANCE` and `MIN_DRAG_TIME`
3. **Shake too hard to trigger**: Decrease `minDirectionChanges` and `minDistance`
4. **Drag not detected**: Check Accessibility permissions in System Preferences

### Platform Considerations

This implementation is macOS-specific. For cross-platform support:
- Keep native modules in separate directories (`darwin/`, `win32/`, `linux/`)
- Use factory pattern in TypeScript wrapper to load platform-specific module
- Fallback to clipboard monitoring for unsupported platforms

### Performance Notes

- Native module runs in separate thread to avoid blocking main process
- Uses pasteboard change count to avoid redundant checks
- Ring buffer for mouse position history (max 100 entries)
- Efficient distance calculations with early exit conditions