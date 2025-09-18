# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Native Module Development

### Building Native Modules

```bash
# Build mouse-tracker module (macOS)
cd mouse-tracker/darwin
node-gyp rebuild
cd ../..

# Build drag-monitor module (macOS)
cd drag-monitor
node-gyp rebuild
cd ..

# Or rebuild all native modules from project root
cd ../..  # Go to project root
yarn rebuild:native
```

### Prerequisites

- Node.js 20+ with node-gyp installed globally
- Python 3.x (required by node-gyp)
- Xcode Command Line Tools (macOS)
- macOS 10.15+ for CGEventTap API

## Architecture Overview

The native modules provide low-level system integration for:

1. **Mouse Tracker** (`mouse-tracker/`)
   - High-performance mouse position tracking using CGEventTap
   - Tracks position, button states, and movement events
   - 60fps tracking with minimal CPU overhead

2. **Drag Monitor** (`drag-monitor/`)
   - Monitors system drag operations using NSPasteboard
   - Detects when files are being dragged
   - Extracts file paths and metadata from drag operations

### Module Structure

```
native/
├── mouse-tracker/
│   ├── index.ts                    # Platform abstraction layer
│   ├── darwin-native-tracker.ts    # macOS TypeScript wrapper
│   ├── base-tracker.ts             # Abstract base class
│   ├── node-tracker.ts             # Pure Node.js fallback (unused)
│   └── darwin/
│       ├── binding.gyp             # Build configuration
│       ├── mouse_tracker_darwin.mm # Objective-C++ implementation
│       └── mouse_tracker.mm        # Legacy implementation
└── drag-monitor/
    ├── index.ts                    # TypeScript wrapper
    ├── binding.gyp                 # Build configuration
    ├── darwin-drag-monitor.mm      # macOS implementation
    └── src/
        └── drag_monitor.mm         # Core implementation
```

## Key Implementation Details

### Mouse Tracker

The mouse tracker uses macOS CGEventTap API for system-wide mouse monitoring:

1. **Event Tap Creation**: Creates a system event tap to intercept mouse events
2. **Threadsafe Callbacks**: Uses N-API threadsafe functions to call JS from native thread
3. **Position Data**: Returns `{x, y, timestamp, leftButtonDown}` objects
4. **Performance**: Batches events to maintain 60fps without overwhelming JS thread

Key methods:

- `start()`: Begins mouse tracking
- `stop()`: Stops tracking and cleans up resources
- `onMouseMove(callback)`: Registers movement callback
- `onMouseButton(callback)`: Registers button event callback
- `getPosition()`: Gets current mouse position synchronously

### Drag Monitor

The drag monitor uses NSPasteboard to detect file drag operations:

1. **Pasteboard Monitoring**: Polls general pasteboard for drag data
2. **File Path Extraction**: Extracts file URLs from pasteboard
3. **Metadata Collection**: Gets file type, size, and extension
4. **Event Emission**: Emits drag start/end events with file data

Key methods:

- `start()`: Begins monitoring drag operations
- `stop()`: Stops monitoring
- `isDragging()`: Returns current drag state
- `getDraggedItems()`: Returns array of dragged files

## Common Build Issues

1. **Missing Python**

   ```bash
   # Install Python 3 if missing
   brew install python3
   ```

2. **node-gyp not found**

   ```bash
   npm install -g node-gyp
   ```

3. **Xcode Command Line Tools**

   ```bash
   xcode-select --install
   ```

4. **Module not found after build**
   - Check that `.node` file exists in build/Release/
   - Ensure webpack is configured to copy native modules
   - Verify electron-rebuild ran after install

5. **Architecture mismatch**
   ```bash
   # Rebuild for correct architecture
   node-gyp rebuild --arch=arm64  # Apple Silicon
   node-gyp rebuild --arch=x64    # Intel
   ```

## Native Module Guidelines

### When modifying native code:

1. Always clean before rebuild: `node-gyp clean && node-gyp rebuild`
2. Test in both development and production builds
3. Check for memory leaks using Instruments (macOS)
4. Ensure proper cleanup in destructors
5. Use N-API for Node.js compatibility

### Threading considerations:

- CGEventTap callbacks run on separate thread
- Always use threadsafe functions for JS callbacks
- Avoid blocking operations in event callbacks
- Properly synchronize shared state with atomics/mutexes

### Error handling:

- Check all Core Foundation function returns
- Release CF objects properly (CFRelease)
- Handle accessibility permission denials gracefully
- Provide meaningful error messages to JS layer

### Performance tips:

- Batch mouse events to reduce JS calls
- Use atomic operations for simple state
- Minimize allocations in hot paths
- Profile with Instruments for bottlenecks

## Platform Support

Currently only macOS is fully implemented. Future platforms:

### Windows (planned)

- Use SetWindowsHookEx for mouse tracking
- IDropTarget for drag monitoring
- Requires Win32 API knowledge

### Linux (planned)

- X11/XInput2 for mouse tracking
- XDND protocol for drag monitoring
- Wayland support consideration

## Security Considerations

1. **Accessibility Permissions**: Required on macOS for CGEventTap
2. **Code Signing**: Native modules should be signed for distribution
3. **Sandboxing**: May conflict with Electron sandboxing
4. **Input Monitoring**: Users must grant explicit permission

## Debugging Native Modules

```bash
# Debug build with symbols
node-gyp rebuild --debug

# Use lldb for debugging
lldb node
(lldb) run path/to/electron .

# Check for memory leaks
leaks --atExit -- node path/to/test.js

# Profile with Instruments
instruments -t "Time Profiler" node
```

## Testing Approach

Native modules should be tested separately:

```javascript
// Basic test for mouse tracker
const tracker = require('./mouse_tracker_darwin.node');
const mt = new tracker.MacOSMouseTracker();

mt.onMouseMove(pos => {
  console.log('Position:', pos);
});

mt.start();
setTimeout(() => mt.stop(), 5000);
```
