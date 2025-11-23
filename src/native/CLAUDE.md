# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with native modules in this repository.

## Current State

### Standardized Module Structure

All native modules follow this pattern for consistency:

```
module-name/
├── src/
│   ├── platform/           # Platform-specific implementations
│   │   └── mac/           # macOS (.mm files)
│   └── module_name.h      # Public interface (if exists)
├── ts/                    # TypeScript wrappers
│   ├── index.ts
│   └── moduleWrapper.ts
└── binding.gyp           # Build configuration at module root
```

### Active Modules

#### Mouse Tracker (`mouse-tracker/`)

- **Implementation**: `src/platform/mac/mouse_tracker_mac.mm` (26KB)
- **Performance**: 60fps batching, 50-70% fewer allocations, <1ms latency
- **Requirements**: macOS Accessibility permissions
- **Binary**: `build/Release/mouse_tracker_darwin.node` (~79KB)

#### Drag Monitor (`drag-monitor/`)

- **Implementation**: `src/platform/mac/drag_monitor_mac.mm` (36KB)
- **Performance**: Adaptive polling (10ms active, 100ms idle), lock-free updates
- **Requirements**: No special permissions (uses NSPasteboard)
- **Binary**: `build/Release/drag_monitor_darwin.node` (~96KB)

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

Currently **macOS only**. When adding platform support:

1. Create `src/platform/win/` or `src/platform/linux/`
2. Update `binding.gyp` conditions
3. Keep platform-specific code isolated
4. Use same public interface

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

- `-O3` - Maximum optimization
- `-ffast-math` - Fast floating point
- `-march=native` - CPU-specific optimizations
- LTO enabled - Link-time optimization

## Common Issues & Solutions

| Issue             | Solution                                               |
| ----------------- | ------------------------------------------------------ |
| Module not found  | `npm run build:clean` from `src/native`                |
| Permission denied | Grant Accessibility in System Preferences              |
| High CPU usage    | Check metrics: `tracker.getNativePerformanceMetrics()` |
| Build fails       | Verify: `xcode-select --install`                       |

## Testing

```bash
# Quick validation
npm run test:validate

# Manual test
node -e "require('./mouse-tracker/build/Release/mouse_tracker_darwin.node')"

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

- `mouse_tracker_darwin.node`: ~79KB
- `drag_monitor_darwin.node`: ~96KB
- Total native code: ~62KB source
- Common headers: ~20KB

If sizes differ significantly, investigate for issues.

## Do NOT

- Create unit tests without request
- Create benchmark files without request
- Add new dependencies without discussion
- Modify build flags without testing
- Remove optimizations without profiling
- Use relaxed memory ordering on ARM64

## References for Implementation

- [CGEventTap Docs](https://developer.apple.com/documentation/coregraphics/1454426-cgeventtapcreate)
- [NSPasteboard Docs](https://developer.apple.com/documentation/appkit/nspasteboard)
- [Node-API Reference](https://nodejs.org/api/n-api.html)
- [ARM64 Memory Model](https://developer.arm.com/documentation/102336/0100)

Remember: This is production code for a performance-critical path. Every microsecond counts.
