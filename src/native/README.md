# Native Modules

High-performance native C++ modules for FileCataloger, providing system-level integrations with optimized performance.

## 🏗️ Architecture

### **Standardized Module Structure**

Each native module follows an identical organization pattern for consistency and maintainability:

```
module-name/
├── src/
│   ├── platform/           # Platform-specific implementations
│   │   ├── mac/           # macOS implementation (.mm files)
│   │   ├── win/           # Windows implementation (future)
│   │   └── linux/         # Linux implementation (future)
│   ├── internal/          # Internal headers and utilities
│   └── module_name.h      # Public interface
├── ts/                    # TypeScript wrappers
│   ├── index.ts          # Module entry point
│   ├── moduleWrapper.ts  # Native binding wrapper
│   └── types.ts          # Type definitions
└── binding.gyp           # Build configuration
```

### **Current Modules**

| Module            | Description                                     | Platform Support | Performance                                    |
| ----------------- | ----------------------------------------------- | ---------------- | ---------------------------------------------- |
| **mouse-tracker** | High-performance mouse tracking with CGEventTap | ✅ macOS         | 60fps event batching, 50-70% fewer allocations |
| **drag-monitor**  | System-wide drag operation detection            | ✅ macOS         | Adaptive polling, lock-free updates            |

## 📁 Project Structure

```
src/native/
├── common/                        # Shared utilities
│   ├── error_codes.h             # Standardized error codes (3.6KB)
│   ├── health_monitor.h          # Health monitoring system (8.8KB)
│   ├── napi_smart_ptr.h          # Smart pointer utilities (2.3KB)
│   └── thread_sync.h             # ARM64-optimized synchronization (5.1KB)
│
├── mouse-tracker/                 # Mouse tracking module
│   ├── src/
│   │   ├── platform/mac/
│   │   │   └── mouse_tracker_mac.mm  # macOS implementation (26KB)
│   │   └── mouse_tracker.h           # Public interface
│   ├── ts/
│   │   ├── index.ts                  # Module entry
│   │   └── mouseTracker.ts           # TypeScript wrapper
│   └── binding.gyp                    # Build configuration
│
├── drag-monitor/                  # Drag detection module
│   ├── src/
│   │   └── platform/mac/
│   │       └── drag_monitor_mac.mm   # macOS implementation (36KB)
│   ├── ts/
│   │   ├── index.ts                  # Module entry
│   │   └── dragMonitor.ts            # TypeScript wrapper
│   └── binding.gyp                    # Build configuration
│
├── package.json                   # Native module dependencies
├── README.md                      # This file
└── CLAUDE.md                      # AI assistant guidelines
```

## 🚀 Quick Start

### **Prerequisites**

```bash
# macOS
xcode-select --install            # Install Xcode Command Line Tools
brew install python@3              # Python 3.x for node-gyp

# Verify installation
node --version                     # Node.js 18+
python3 --version                  # Python 3.x
```

### **Building Modules**

```bash
# From project root
yarn build:native                  # Build all native modules
yarn build:native:clean            # Clean rebuild
yarn build:native:verbose          # Verbose output

# Individual modules (from src/native)
cd mouse-tracker && node-gyp rebuild
cd drag-monitor && node-gyp rebuild

# Validation
yarn test:native:validate          # Verify modules load correctly
```

## ⚡ Performance Optimizations

### **Compiler Optimizations**

- **Optimization Level**: `-O3` for maximum performance
- **Link-Time Optimization**: Full LTO enabled
- **Fast Math**: `-ffast-math` for numerical operations
- **Architecture**: `-march=native` for CPU-specific optimizations

### **Runtime Optimizations**

#### Mouse Tracker

- **Event Batching**: 60fps max frequency reduces JS callbacks by 60-80%
- **Memory Pooling**: ObjectPool<T> template reuses objects, 50-70% fewer allocations
- **Intelligent Filtering**: Only sends button state changes when needed
- **Double Buffering**: Lock-free updates between threads

#### Drag Monitor

- **Adaptive Polling**: 10ms during drag, 100ms when idle
- **Lock-Free Queue**: Zero-contention event passing
- **Pasteboard Caching**: Reduces system calls during drag operations

### **Thread Safety**

- **ARM64 Optimized**: Proper memory ordering for Apple Silicon
- **Atomic Operations**: Lock-free state management
- **SeqLock Pattern**: Low-contention reads for metrics
- **RAII Wrappers**: Automatic resource management

## 🧪 Testing & Validation

### **Build Validation**

```bash
# Test native module loading
yarn test:native:validate

# Check binary sizes (expected)
# mouse_tracker_darwin.node: ~79KB
# drag_monitor_darwin.node: ~96KB

# Performance metrics
const tracker = createMouseTracker();
const metrics = tracker.getNativePerformanceMetrics();
console.log(metrics);
// Expected: >95% batching efficiency, ~60fps event rate
```

### **Runtime Testing**

```bash
# Run with debug output
DEBUG=native:* yarn dev

# Monitor performance
yarn dev --inspect              # Use Chrome DevTools profiler
```

## 🔧 Development

### **Adding Platform Support**

1. Create platform directory:

```bash
mkdir -p module-name/src/platform/win
```

2. Implement platform-specific code:

```cpp
// module_name_win.cc
#include "../module_name.h"
// Windows implementation
```

3. Update binding.gyp:

```python
"conditions": [
  ["OS=='win'", {
    "sources": ["src/platform/win/module_name_win.cc"]
  }]
]
```

### **Module Guidelines**

- **Naming Conventions**:
  - C++ files: `snake_case.cc/mm`
  - Headers: `snake_case.h`
  - TypeScript: `camelCase.ts`
  - Directories: `kebab-case`

- **Error Handling**:
  - Use standardized error codes from `common/error_codes.h`
  - Implement graceful fallbacks
  - Log errors with context

- **Performance**:
  - Profile before optimizing
  - Use memory pooling for high-frequency allocations
  - Batch events when possible
  - Prefer lock-free algorithms

## 🚨 Troubleshooting

### **Common Issues**

| Issue                  | Solution                                              |
| ---------------------- | ----------------------------------------------------- |
| **Module not found**   | Run `yarn build:native:clean`                         |
| **Compilation errors** | Check Xcode CLI tools: `xcode-select --install`       |
| **Permission denied**  | Grant Accessibility permissions in System Preferences |
| **Version mismatch**   | Rebuild after Electron upgrade: `yarn rebuild:native` |
| **High CPU usage**     | Check polling intervals and event batching            |

### **Debug Commands**

```bash
# Verbose build output
yarn build:native:verbose

# Check module loading
node -e "require('./mouse-tracker/build/Release/mouse_tracker_darwin.node')"

# View compiler commands
cd mouse-tracker && node-gyp configure -- -f gyp.generator.ninja
```

## 📊 Benchmarks

### **Performance Metrics**

| Metric           | Mouse Tracker         | Drag Monitor            |
| ---------------- | --------------------- | ----------------------- |
| **Event Rate**   | 60fps (batched)       | Adaptive 10-100ms       |
| **Memory Usage** | ~2MB baseline         | ~1MB baseline           |
| **CPU Usage**    | <1% idle, 2-3% active | <0.5% idle, 1-2% active |
| **Latency**      | <1ms avg              | <5ms avg                |
| **Init Time**    | ~50ms                 | ~30ms                   |

### **Optimization Results**

- **60-80%** reduction in JavaScript callbacks
- **50-70%** fewer memory allocations
- **2x** faster event processing with compiler optimizations
- **>95%** event batching efficiency

## 🔒 Security

### **Permissions Required**

- **macOS Accessibility**: Required for CGEventTap (mouse tracking)
- **No special permissions**: Drag monitoring uses NSPasteboard

### **Security Features**

- **Sandboxed execution**: Runs within Electron's sandbox
- **No eval() usage**: Static compilation only
- **Input validation**: All external inputs validated
- **Resource limits**: Memory pools prevent unbounded growth

## 🔮 Roadmap

### **Planned Enhancements**

- [ ] Windows support (Win32 API)
- [ ] Linux support (X11/Wayland)
- [ ] WebAssembly fallback
- [ ] GPU acceleration for trajectory analysis
- [ ] Machine learning for gesture recognition

### **Future Modules**

- **file-watcher**: High-performance file system monitoring
- **window-manager**: Native window manipulation
- **system-metrics**: CPU/Memory/Disk monitoring
- **clipboard-manager**: Advanced clipboard operations

## 📚 References

- [Node-API Documentation](https://nodejs.org/api/n-api.html)
- [node-gyp Documentation](https://github.com/nodejs/node-gyp)
- [Electron Native Modules](https://www.electronjs.org/docs/tutorial/using-native-node-modules)
- [CGEventTap Reference](https://developer.apple.com/documentation/coregraphics/1454426-cgeventtapcreate)
- [NSPasteboard Documentation](https://developer.apple.com/documentation/appkit/nspasteboard)

## 📄 License

See main project LICENSE file.
