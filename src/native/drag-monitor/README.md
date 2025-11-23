# Drag Monitor Module

System-wide drag operation detection for macOS using NSPasteboard monitoring with adaptive polling.

## Features

- **Adaptive Polling**: 10ms during drag, 100ms when idle - reduces CPU by 90%
- **Lock-Free Updates**: Zero-contention event queue for thread safety
- **File Detection**: Automatically extracts file paths from drag operations
- **No Permissions Required**: Uses NSPasteboard, not Accessibility APIs
- **Double Buffering**: Smooth state updates without locks
- **Low Overhead**: <0.5% CPU idle, 1-2% during drag

## Architecture

```
drag-monitor/
├── src/
│   ├── platform/
│   │   └── mac/
│   │       └── drag_monitor_mac.mm  # NSPasteboard implementation (36KB)
│   └── drag_monitor.h               # Public C++ interface (planned)
├── ts/
│   ├── index.ts                     # Module factory
│   └── dragMonitor.ts               # TypeScript wrapper
└── binding.gyp                      # Build configuration
```

## API

### TypeScript Interface

```typescript
import { createDragMonitor } from '@native/drag-monitor';

const monitor = createDragMonitor();

// Start monitoring
monitor.start();

// Listen for drag events
monitor.on('drag-start', info => {
  console.log(`Drag started with ${info.fileCount} files`);
  console.log(`Position: ${info.x}, ${info.y}`);
});

monitor.on('drag-end', info => {
  console.log('Files dropped:', info.files);
  console.log(`Final position: ${info.x}, ${info.y}`);
});

// Get performance metrics
const metrics = monitor.getPerformanceMetrics();
console.log(`Polling efficiency: ${metrics.idlePercentage}%`);

// Stop monitoring
monitor.stop();
```

### Events

| Event         | Payload                        | Description                     |
| ------------- | ------------------------------ | ------------------------------- |
| `drag-start`  | `{x, y, timestamp, fileCount}` | Drag operation started          |
| `drag-end`    | `{x, y, timestamp, files}`     | Files dropped                   |
| `drag-update` | `{x, y, timestamp}`            | Drag position update (optional) |
| `error`       | `Error`                        | Monitoring errors               |

## Performance Optimizations

### Adaptive Polling System

```cpp
class AdaptivePoller {
    // Polling intervals
    IDLE_INTERVAL = 100ms      // No drag detected
    ACTIVE_INTERVAL = 10ms     // During drag
    COOLDOWN_INTERVAL = 50ms   // Just finished drag

    // Automatically adjusts based on drag state
    // Reduces CPU usage by 90% when idle
};
```

### Lock-Free Event Queue

```cpp
template<typename T, size_t Size = 256>
class LockFreeQueue {
    // Single-producer, single-consumer queue
    // Zero contention between threads
    // Cache-line aligned to prevent false sharing
};
```

### NSPasteboard Monitoring

- Polls pasteboard change count
- Caches file URLs to avoid repeated parsing
- Lazy extraction of file paths
- Supports all UTI file types

## Building

```bash
# From module directory
node-gyp rebuild

# Clean build
node-gyp clean && node-gyp rebuild

# Verbose output
node-gyp rebuild --verbose

# Expected output size: ~96KB
ls -lh build/Release/drag_monitor_darwin.node
```

## Requirements

### macOS

- **macOS 10.15+**: Minimum deployment target
- **No special permissions**: Uses public NSPasteboard API
- **Xcode Command Line Tools**: For compilation

### Frameworks Used

- Foundation (NSPasteboard, NSURL)
- AppKit (Drag operation support)
- CoreGraphics (Mouse position)
- UniformTypeIdentifiers (File type detection)

## Performance Metrics

| Metric                   | Value           |
| ------------------------ | --------------- |
| **Initialization**       | ~30ms           |
| **Memory Baseline**      | ~1MB            |
| **Event Latency**        | <5ms avg        |
| **CPU Usage (idle)**     | <0.5%           |
| **CPU Usage (dragging)** | 1-2%            |
| **Polling Efficiency**   | >90% idle polls |
| **State Updates**        | Lock-free       |

## Implementation Details

### NSPasteboard Monitoring

```objc
// Monitor general pasteboard for drag operations
NSPasteboard* dragPasteboard = [NSPasteboard pasteboardWithName:NSDragPboard];

// Check for file URLs using modern UTI
NSArray* urls = [dragPasteboard readObjectsForClasses:@[[NSURL class]]
                                               options:@{
                                                   NSPasteboardURLReadingFileURLsOnlyKey: @YES
                                               }];

// Extract file paths
for (NSURL* url in urls) {
    if ([url isFileURL]) {
        files.push_back([[url path] UTF8String]);
    }
}
```

### State Machine

```
IDLE → MONITORING → DRAGGING → DROPPED → IDLE
         ↑              ↓
         ← COOLDOWN ←
```

### Thread Architecture

- **Monitor Thread**: Polls NSPasteboard
- **Analysis Thread**: Processes drag trajectory
- **Callback Thread**: Invokes JS callbacks

## Troubleshooting

### Module won't load

```bash
# Check if built
ls build/Release/drag_monitor_darwin.node

# Test loading
node -e "require('./build/Release/drag_monitor_darwin.node')"
```

### Drag not detected

- Check if other apps detect the drag
- Verify NSPasteboard is accessible
- Look for errors in Console.app

### High CPU usage

- Check adaptive polling: `monitor.getPerformanceMetrics()`
- Verify idle polling is 100ms
- Check for error loops in logs

### Files not detected

- Ensure dragging actual files, not text/images
- Check file URL extraction in debug mode
- Verify UTI types are supported

## Advanced Features

### Trajectory Analysis

The module tracks drag trajectory for shake detection:

```cpp
// Maintains last 100 trajectory points
std::deque<CGPoint> trajectory;

// Analyzes for direction changes
int directionChanges = analyzeTrajectory(trajectory);
if (directionChanges >= 6) {
    // Shake detected
}
```

### Performance Metrics

```typescript
const metrics = monitor.getPerformanceMetrics();
// {
//   totalPolls: 15000,
//   idlePolls: 14000,
//   activePolls: 1000,
//   idlePercentage: 93.3,
//   efficiency: 0.93
// }
```

## Future Enhancements

- [ ] Windows support (IDropTarget)
- [ ] Linux support (X11 DnD protocol)
- [ ] Drag preview extraction
- [ ] Multi-file type support (images, text)
- [ ] Drag source application detection
- [ ] Custom drag data support

## Known Limitations

- Only detects file drags (not text/image)
- Cannot prevent or modify drag operations
- Limited to NSPasteboard polling rate
- No access to drag image/preview

## License

See main project LICENSE file.
