# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with native modules in this repository.

## Current State

### Supported Platforms

- **macOS** (darwin): CGEventTap + NSPasteboard
- **Windows** (win32): SetWindowsHookEx + OLE/COM APIs

### Standardized Module Structure

All native modules follow this pattern for consistency:

```
module-name/
├── src/
│   ├── native/
│   │   ├── mac/           # macOS (.mm files)
│   │   └── win/           # Windows (.cc files)
│   ├── index.ts           # Cross-platform factory
│   ├── moduleNameMac.ts   # macOS TypeScript wrapper
│   └── moduleNameWin.ts   # Windows TypeScript wrapper
└── binding.gyp            # Build configuration (cross-platform)
```

### Active Modules

#### Mouse Tracker (`mouse-tracker/`)

**macOS Implementation:**

- **File**: `src/native/mac/mouse_tracker_mac.mm`
- **API**: CGEventTap for system-wide mouse tracking
- **Requirements**: Accessibility permissions
- **Binary**: `build/Release/mouse_tracker_darwin.node` (~79KB)

**Windows Implementation:**

- **File**: `src/native/win/mouse_tracker_win.cc`
- **API**: SetWindowsHookEx (WH_MOUSE_LL) for low-level mouse hooks
- **Requirements**: None
- **Binary**: `build/Release/mouse_tracker_win.node`

**Features (both platforms):**

- 60fps event batching
- Memory pooling for zero-allocation hot path
- Button state tracking with immediate updates
- Performance metrics

#### Drag Monitor (`drag-monitor/`)

**macOS Implementation:**

- **File**: `src/native/mac/drag_monitor_mac.mm`
- **API**: NSPasteboard polling + CGEventTap
- **Requirements**: Accessibility permissions
- **Binary**: `build/Release/drag_monitor_darwin.node` (~96KB)

**Windows Implementation:**

- **File**: `src/native/win/drag_monitor_win.cc`
- **API**: OleGetClipboard + SetWindowsHookEx
- **Requirements**: None
- **Binary**: `build/Release/drag_monitor_win.node`

**Features (both platforms):**

- Adaptive polling (10ms active, 100ms idle)
- Lock-free state updates
- File metadata extraction
- Trajectory analysis

### Shared Components (`common/`)

- `error_codes.h` - Standardized error codes (3.6KB)
- `health_monitor.h` - Health monitoring system (8.8KB)
- `napi_smart_ptr.h` - Smart pointer utilities (2.3KB)
- `thread_sync.h` - ARM64-optimized synchronization (5.1KB)

## Build Commands

```bash
# From src/native directory
npm run build                  # Build all modules
npm run build:clean            # Clean rebuild
npm run build:verbose          # Verbose output
npm run build:mouse-tracker    # Build specific module
npm run build:drag-monitor     # Build specific module
npm run test:validate          # Validate modules load correctly
npm run clean:all              # Remove all build artifacts
```

## Development Guidelines

### When Making Changes

1. **Before modifying**: Read existing implementation first
2. **Naming conventions**:
   - C++ files: `snake_case.mm/cc`
   - TypeScript: `camelCase.ts`
   - Directories: `kebab-case`
3. **After changes**:
   - Run `npm run build:clean` from `src/native`
   - Run `npm run test:validate` to verify modules load

### Adding Features

1. **Performance first**: Profile before adding features
2. **Thread safety**: Use atomic operations and lock-free algorithms
3. **Memory management**: Use RAII and smart pointers
4. **Error handling**: Use standardized error codes from `common/error_codes.h`

### Platform Support

Currently supports **macOS and Windows**. When adding Linux support:

1. Create `src/native/linux/` in each module
2. Update `binding.gyp` with Linux conditions
3. Keep platform-specific code isolated
4. Use same public interface (TypeScript wrappers handle abstraction)

## Key Optimizations in Place

### Mouse Tracker

- **Event batching**: Max 60fps to reduce JS callbacks
- **Memory pooling**: ObjectPool<T> for zero-allocation hot path
- **Button filtering**: Only sends changes, not every event
- **Double buffering**: Lock-free producer-consumer pattern

### Drag Monitor

- **Adaptive polling**: 90% CPU reduction when idle
- **Lock-free queue**: Zero contention between threads
- **Pasteboard caching**: Avoids repeated system calls
- **Trajectory analysis**: Efficient shake detection algorithm

### Build Flags

**macOS:**
- `-O3` - Maximum optimization
- `-ffast-math` - Fast floating point
- `-funroll-loops` - Loop optimization
- `LLVM_LTO: YES` - Link-time optimization
- `-fobjc-arc` - Automatic Reference Counting

**Windows:**
- `/O2` - Maximum optimization
- `/GL` - Whole program optimization
- `LinkTimeCodeGeneration: 1` - Link-time code generation

## Common Issues & Solutions

| Issue             | Platform | Solution                                               |
| ----------------- | -------- | ------------------------------------------------------ |
| Module not found  | All      | `npm run build:clean` from `src/native`                |
| Permission denied | macOS    | Grant Accessibility in System Preferences              |
| High CPU usage    | All      | Check metrics: `tracker.getNativePerformanceMetrics()` |
| Build fails       | macOS    | Verify: `xcode-select --install`                       |
| Build fails       | Windows  | Install Visual Studio Build Tools 2019+                |
| Hook not working  | Windows  | Run as administrator or check antivirus                |

## Testing

```bash
# Quick validation
npm run test:validate

# Manual test (macOS)
node -e "require('./mouse-tracker/build/Release/mouse_tracker_darwin.node')"

# Manual test (Windows)
node -e "require('./mouse-tracker/build/Release/mouse_tracker_win.node')"

# Performance check (in app)
const metrics = tracker.getNativePerformanceMetrics();
console.log(metrics); // Should show >95% batching efficiency
```

## Important Notes

- **Single version policy**: No duplicate implementations
- **Clean structure**: No build artifacts in git
- **Performance critical**: Every allocation matters
- **Thread safety**: ARM64 requires proper memory ordering
- **Error handling**: Never crash, always fallback gracefully

## File Sizes (Expected)

After build, verify sizes are reasonable:

**macOS:**

- `mouse_tracker_darwin.node`: ~79KB
- `drag_monitor_darwin.node`: ~96KB

**Windows:**

- `mouse_tracker_win.node`: ~80-100KB
- `drag_monitor_win.node`: ~100-120KB

Total native code: ~100KB source
Common headers: ~20KB

If sizes differ significantly, investigate for issues.

## Do NOT

- Create unit tests without request
- Create benchmark files without request
- Add new dependencies without discussion
- Modify build flags without testing
- Remove optimizations without profiling
- Use relaxed memory ordering on ARM64

## References for Implementation

**macOS:**

- [CGEventTap Docs](https://developer.apple.com/documentation/coregraphics/1454426-cgeventtapcreate)
- [NSPasteboard Docs](https://developer.apple.com/documentation/appkit/nspasteboard)

**Windows:**

- [SetWindowsHookEx Docs](https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowshookexw)
- [OLE Clipboard Docs](https://docs.microsoft.com/en-us/windows/win32/dataxchg/clipboard)

**General:**

- [Node-API Reference](https://nodejs.org/api/n-api.html)
- [ARM64 Memory Model](https://developer.arm.com/documentation/102336/0100)

Remember: This is production code for a performance-critical path. Every microsecond counts.
