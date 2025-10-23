# Mouse Tracker Module

High-performance system-wide mouse tracking for macOS using CGEventTap with advanced optimizations.

## Features

- **60fps Event Batching**: Reduces JavaScript callbacks by 60-80%
- **Memory Pooling**: ObjectPool<T> template reduces allocations by 50-70%
- **Intelligent Filtering**: Only sends button state changes when needed
- **Thread-Safe**: Lock-free updates with proper ARM64 memory ordering
- **Low Latency**: <1ms average event processing time
- **Minimal CPU**: <1% idle, 2-3% during active tracking

## Architecture

```
mouse-tracker/
├── src/
│   ├── platform/
│   │   └── mac/
│   │       └── mouse_tracker_mac.mm  # CGEventTap implementation (26KB)
│   └── mouse_tracker.h               # Public C++ interface
├── ts/
│   ├── index.ts                      # Module factory
│   └── mouseTracker.ts               # TypeScript wrapper
└── binding.gyp                       # Build configuration
```

## API

### TypeScript Interface

```typescript
import { createMouseTracker } from '@native/mouse-tracker';

const tracker = createMouseTracker();

// Start tracking
tracker.start();

// Listen for mouse events
tracker.on('position', position => {
  console.log(`Mouse at: ${position.x}, ${position.y}`);
});

tracker.on('buttonStateChange', state => {
  console.log(`Buttons: L=${state.left}, R=${state.right}`);
});

// Get performance metrics
const metrics = tracker.getNativePerformanceMetrics();
console.log(`Batching efficiency: ${metrics.batchingEfficiency}%`);

// Stop tracking
tracker.stop();
```

### Events

| Event               | Payload                                                | Description                        |
| ------------------- | ------------------------------------------------------ | ---------------------------------- |
| `position`          | `{x, y, timestamp, leftButtonDown?, rightButtonDown?}` | Mouse position updates (60fps max) |
| `buttonStateChange` | `{left, right, timestamp}`                             | Button state changes only          |
| `error`             | `Error`                                                | Tracking errors                    |

## Performance Optimizations

### Event Batching

- Queues mouse events and sends at 60fps maximum
- Intermediate positions discarded if not processed in time
- Button states always preserved

### Memory Pooling

```cpp
template<typename T, size_t PoolSize = 100>
class ObjectPool {
    // Reuses allocated objects to prevent heap fragmentation
    // Pre-allocates PoolSize objects on initialization
};
```

### Thread Architecture

- **Main Thread**: Event tap callback (high priority)
- **Batch Thread**: Event batching and filtering
- **JS Thread**: Callback invocation via ThreadSafeFunction

## Building

```bash
# From module directory
node-gyp rebuild

# Clean build
node-gyp clean && node-gyp rebuild

# Verbose output
node-gyp rebuild --verbose

# Expected output size: ~79KB
ls -lh build/Release/mouse_tracker_darwin.node
```

## Requirements

### macOS

- **Accessibility Permission**: Required for CGEventTap
- **macOS 10.15+**: Minimum deployment target
- **Xcode Command Line Tools**: For compilation

### Granting Permissions

1. System Preferences → Security & Privacy → Privacy
2. Select "Accessibility"
3. Add your application (Terminal.app for development)
4. Restart the application

## Performance Metrics

| Metric                  | Value    |
| ----------------------- | -------- |
| **Initialization**      | ~50ms    |
| **Memory Baseline**     | ~2MB     |
| **Event Latency**       | <1ms avg |
| **CPU Usage (idle)**    | <1%      |
| **CPU Usage (active)**  | 2-3%     |
| **Batching Efficiency** | >95%     |
| **Max Event Rate**      | 60fps    |

## Troubleshooting

### Module won't load

```bash
# Check if built
ls build/Release/mouse_tracker_darwin.node

# Test loading
node -e "require('./build/Release/mouse_tracker_darwin.node')"
```

### Permission denied

- Ensure Accessibility permissions granted
- Restart application after granting permissions

### High CPU usage

- Check if event batching is working: `tracker.getNativePerformanceMetrics()`
- Verify 60fps cap is active
- Look for error spam in logs

### Memory leaks

- Module uses RAII and smart pointers
- Check for JS callback reference leaks
- Use `--inspect` flag to profile

## Implementation Details

### CGEventTap Setup

```objc
// High-level event tap for mouse events
CGEventMask eventMask =
    CGEventMaskBit(kCGEventMouseMoved) |
    CGEventMaskBit(kCGEventLeftMouseDown) |
    CGEventMaskBit(kCGEventLeftMouseUp) |
    CGEventMaskBit(kCGEventRightMouseDown) |
    CGEventMaskBit(kCGEventRightMouseUp);

eventTap = CGEventTapCreate(
    kCGSessionEventTap,
    kCGHeadInsertEventTap,
    kCGEventTapOptionDefault,
    eventMask,
    eventCallback,
    this
);
```

### Compiler Optimizations

- `-O3`: Maximum optimization level
- `-ffast-math`: Fast floating-point operations
- `-march=native`: CPU-specific optimizations
- Link-Time Optimization (LTO) enabled

## Future Enhancements

- [ ] Windows support (SetWindowsHookEx)
- [ ] Linux support (X11/XInput2)
- [ ] Gesture recognition
- [ ] Multi-monitor support improvements
- [ ] Relative motion tracking
- [ ] Acceleration curves

## License

See main project LICENSE file.
