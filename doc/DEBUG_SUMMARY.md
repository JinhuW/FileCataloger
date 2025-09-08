# FileCataloger Debug Summary

## Quick Reference for Common Issues

### 1. Native Module Crashes
**Symptoms**: Segmentation faults, V8 API locking errors, app crashes on drag
**Solution**: Use proper N-API thread-safe functions, never call JS directly from native threads
**Key Files**: `src/native/mouse-tracker/darwin/mouse-tracker.cc`

### 2. Shelf Not Appearing
**Symptoms**: Drag + shake doesn't create shelf, or shelf appears immediately
**Causes**: 
- Missing Accessibility permissions (macOS)
- Native module not built (`yarn build` required)
- Event flow issues (check `dragStart` vs `dragShake`)
**Solution**: Check permissions, rebuild native modules, verify event handlers

### 3. Shelf Disappearing After Drop
**Symptoms**: Files dropped but shelf vanishes immediately
**Root Cause**: Incorrect preload script path or timing race conditions
**Solution**: Fix path to `../../preload/index.js`, implement drop operation protection

### 4. Build/Development Issues
**Common Errors**:
- "Cannot find module .../mouse-tracker.node" → Run `node-gyp rebuild` in native module directory
- CSP blocking webpack in dev → Set `webSecurity: false` for shelf windows in development
- Type errors → Always run `yarn typecheck` before committing

## Critical Implementation Details

### Thread Safety Pattern
```cpp
// WRONG - Causes crashes
dispatch_async(dispatch_get_main_queue(), ^{
    callback(position);  // Direct JS call from native thread
});

// CORRECT - Use N-API thread safety
napi_call_threadsafe_function(tsfn, data, napi_tsfn_blocking);
```

### Shelf Lifecycle Protection
```typescript
// Protect shelves during drop operations
if (this.activeDropOperations.size > 0) {
    return; // Don't clear shelves
}
```

### Required Build Steps
```bash
# After fresh clone or node_modules update
yarn install
cd src/native/mouse-tracker/darwin
node-gyp rebuild
cd ../../../..
yarn build
```

## Known Gotchas

1. **Timestamp Format**: Native module returns nanoseconds, JS expects milliseconds
2. **Position Data**: Avoid double-wrapping objects between native/JS boundary
3. **Path Resolution**: Shelf preload must be `../../preload/index.js` not `../preload/index.js`
4. **macOS Permissions**: Must have Accessibility access for mouse tracking
5. **Development CSP**: Webpack requires `unsafe-eval` in development mode

## Debug Commands

```bash
# Monitor drag/drop events
yarn dev | grep -E "dragStart|dragShake|DROP|shelf"

# Check native module issues
yarn dev | grep -E "native|mouse|position"

# Track shelf lifecycle
yarn dev | grep -E "created|destroyed|files-dropped"
```

## Resolution Checklist

When debugging issues:
1. ✓ Check macOS Accessibility permissions
2. ✓ Rebuild native modules if needed
3. ✓ Verify preload script path
4. ✓ Check console for IPC communication
5. ✓ Monitor CPU usage (should be <5% idle)
6. ✓ Run typecheck before committing

## Native File Drag Detection

### Overview
The application uses native macOS APIs to detect file dragging from Finder, Desktop, and other apps. This replaces the unreliable clipboard monitoring approach.

### Architecture
1. **CGEventTap API**: Monitors system-wide mouse events (down, up, drag)
2. **NSPasteboard**: Checks drag pasteboard for file content
3. **EventEmitter**: Provides JS interface for native events

### Key Detection Thresholds
```typescript
// Drag detection (src/native/drag-monitor/)
MIN_DRAG_DISTANCE: 3.0  // pixels
MIN_DRAG_TIME: 10       // milliseconds
MIN_MOVE_COUNT: 1       // drag events

// Shake detection (src/main/modules/shake-detector.ts)
minDirectionChanges: 2  // Lower = easier to trigger
timeWindow: 600        // Higher = more time allowed
minDistance: 5         // Lower = smaller movements count
debounceTime: 300     // Lower = can trigger more frequently
```

### Supported Pasteboard Types
- `NSPasteboardTypeFileURL` - Modern file URLs
- `NSFilenamesPboardType` - Legacy format
- `public.file-url` - Public UTI
- `com.apple.pasteboard.promised-file-content` - Browser downloads
- `com.apple.pasteboard.promised-file-url` - URL promises

### Building Native Drag Monitor
```bash
cd src/native/drag-monitor
node-gyp rebuild
# OR for Electron compatibility
npx electron-rebuild
```

### Troubleshooting Drag Detection
1. **Files not detected**: Check Accessibility permissions
2. **False positives**: Increase MIN_DRAG_DISTANCE and MIN_DRAG_TIME
3. **Shake too difficult**: Decrease minDirectionChanges and minDistance
4. **Module load error**: Run `npx electron-rebuild`

## Historical Issues (Resolved)

- **V8 Locking Errors**: Fixed by proper thread-safe implementation
- **Polling vs Callbacks**: Callbacks work correctly with proper thread safety
- **Memory Management**: Resolved with correct N-API usage
- **CSP Blocking React**: Fixed with development-specific security settings
- **Clipboard Monitoring**: Replaced with native drag detection using CGEventTap

## Native Module Loading (Webpack Issue)

### Problem
Native modules fail to load when using dynamic require() with webpack. Webpack transforms dynamic requires into context modules which don't work with .node files.

### Current Status
- Native modules are packaged to fixed location: `dist/native-modules/`
- Centralized loader created but webpack's require transformation prevents loading
- Error: "Cannot find module" even when file exists at the path

### Temporary Workaround
The application successfully loads native modules during development by:
1. Building native modules: `cd src/native/mouse-tracker/darwin && node-gyp rebuild`
2. Webpack copies them to `dist/native-modules/`
3. Using direct file paths in the loader

### Permanent Solutions (TODO)
1. **Option 1**: Use webpack externals to exclude native modules from bundling
2. **Option 2**: Use electron's native require (bypassing webpack)
3. **Option 3**: Pre-build native modules and include as static assets
4. **Option 4**: Use electron-rebuild for better compatibility

### Build Commands
```bash
# Build native modules
cd src/native/mouse-tracker/darwin && node-gyp rebuild
cd ../../../..
cd src/native/drag-monitor && node-gyp rebuild
cd ../..

# Build and run
yarn build
yarn electron ./dist/main/index.js
```