# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development

```bash
# Install dependencies (native modules build automatically)
yarn install

# Run in development mode
yarn dev

# Type checking (ALWAYS run before committing)
yarn typecheck

# Linting (ALWAYS run before committing)
yarn lint

# Build all modules
yarn build

# Clean build artifacts
yarn clean
```

### Native Module Management

```bash
# Force rebuild native modules (rarely needed - install handles this)
yarn rebuild:native

# Validate native modules are working
yarn test:native:validate

# Debug build issues
yarn build:native:verbose
```

### Testing and Quality

```bash
# Run test suites
yarn test                  # Unit tests
yarn test:ui              # UI component tests
yarn test:coverage        # Coverage report
yarn test:native          # Native module tests

# Code quality pipeline (runs all checks)
yarn quality:check

# Individual quality commands
yarn format               # Format code with Prettier
yarn format:check         # Check formatting
yarn security:check       # Audit dependencies
yarn validate:renderer    # Validate renderer code
```

### Building and Distribution

```bash
# Build for macOS
yarn make:dmg             # Universal DMG
yarn dist:mac:arm64       # Apple Silicon only
yarn dist:mac:x64         # Intel only

# Complete distribution
yarn dist
```

## Architecture Overview

FileCataloger is an Electron application that creates floating "shelf" windows for temporary file storage. Users trigger shelf creation by shaking the mouse while dragging files.

### Multi-Process Architecture

```
Main Process (Node.js)              Renderer Process (Chromium)
├─ applicationController ◄──IPC──► React UI + Zustand State
├─ shelfManager                    └─ Multiple shelf windows
├─ dragShakeDetector
└─ Native Modules (C++)
    ├─ mouse-tracker (CGEventTap)
    └─ drag-monitor (NSPasteboard)
```

### Core Module Relationships

1. **ApplicationController** (`src/main/modules/core/applicationController.ts`)
   - Central orchestrator using event-driven patterns
   - Manages module lifecycle and inter-module communication
   - Implements drag/shelf state machine with AsyncMutex

2. **ShelfManager** (`src/main/modules/window/shelfManager.ts`)
   - Window pooling for performance (5 shelf max)
   - Handles positioning, docking, and auto-hide
   - Manages shelf modes (rename, display)

3. **DragShakeDetector** (`src/main/modules/input/dragShakeDetector.ts`)
   - Combines native drag monitoring with shake detection
   - 6+ direction changes in 500ms triggers shelf
   - Fallback to Node.js implementation if native fails

4. **Native Integration**
   - **MouseTracker**: 60fps event batching, memory pooling
   - **DragMonitor**: Polls NSPasteboard for drag state

### IPC Communication Schema

All IPC channels are strictly validated in preload script:

```typescript
// Application control
'app:get-status'; // Request app state
'app:create-shelf'; // Manual shelf creation
'app:update-config'; // Update configuration

// Shelf operations
'shelf:create'; // Create new shelf
'shelf:files-dropped'; // Handle file drops
'shelf:remove-item'; // Remove single item
'shelf:close'; // Close shelf window

// Pattern operations (file rename)
'pattern:save'; // Save rename pattern
'pattern:list'; // List saved patterns
'pattern:execute'; // Execute rename
```

### State Management

- **Main Process**: Event-driven with state machines
- **Renderer**: Zustand stores with Immer middleware
  - `shelfStore`: Map-based storage for performance
  - `patternStore`: Rename pattern management

### TypeScript Configuration

Separate configs for security and type safety, organized within each subproject:

- `src/main/tsconfig.json` - Main process (Node.js environment)
- `src/renderer/tsconfig.json` - Renderer process (Browser environment)
- `config/tsconfig.base.json` - Shared base configuration (DRY principle)
- Path aliases: `@main/*`, `@renderer/*`, `@native/*`, `@shared/*`

The TypeScript configuration uses project references for proper type isolation between processes.

## Key Implementation Details

### Native Module Integration

- **Smart Installer**: Located at `scripts/install-native.js`
- **Build Strategy**: prebuild-install → electron-rebuild → manual
- **Validation**: Checks module sizes (mouse-tracker: ~79KB, drag-monitor: ~96KB)
- **Location**: Built modules copied to `dist/main/`

### Performance Optimizations

- **Event Batching**: Mouse events capped at 60fps
- **Memory Pooling**: ObjectPool<T> template in C++
- **Window Pooling**: Reuses shelf windows
- **Virtual Lists**: For large file collections
- **Selective Re-renders**: Zustand selectors

### Security Model

- **Context Isolation**: Enabled for all renderers
- **Sandboxing**: With selective API exposure
- **CSP Headers**: Configured in production
- **IPC Validation**: Whitelist-based channel filtering

### File Rename System

Located in `src/renderer/features/fileRename/`:

- Pattern builder with live preview
- Batch operations with undo support
- Saved pattern management
- Real-time conflict detection

## Common Development Tasks

### Adding a New IPC Channel

1. Define in `src/shared/types/ipc.ts`
2. Add handler in `src/main/ipc/`
3. Add to channel whitelist in `src/preload/index.ts`
4. Use via `window.api` in renderer

### Creating a New Shelf Mode

1. Add mode to `ShelfMode` enum in `src/shared/types/shelf.ts`
2. Update `shelfManager.createShelf()` to handle mode
3. Create renderer components in `src/renderer/pages/shelf/`
4. Update shelf store if needed

## Debugging

### Development Mode Features

- Shelf windows visible immediately (no hide)
- Verbose logging to console
- React DevTools enabled
- Source maps for all processes

### Log Locations

- **Main**: `~/Library/Application Support/FileCataloger/logs/`
- **Renderer**: Browser console
- **Native**: System console (view with Console.app)

### Common Issues

1. **Shelf not appearing**
   - Check Accessibility permissions in System Settings
   - Verify native modules loaded: `yarn test:native:validate`
   - Check logs for shake detection events

2. **Build failures**
   - Python required for node-gyp
   - Xcode command line tools needed
   - Clean and rebuild: `yarn clean && yarn install`

3. **Type errors with path aliases**
   - Ensure webpack aliases match tsconfig paths
   - Check `config/webpack/webpack.common.js`

4. **IPC channel not found**
   - Verify channel in preload whitelist
   - Check exact string match (case sensitive)

## macOS Specific Notes

- **Permissions**: Accessibility required for CGEventTap
- **Code Signing**: Required for distribution builds
- **Notarization**: Use `yarn dist` for notarized builds
- **Universal Binaries**: Builds for both ARM64 and x64

## Project-Specific Patterns

### Error Handling

```typescript
// Use ErrorHandler with severity levels
ErrorHandler.handle(error, {
  severity: 'HIGH',
  category: 'NATIVE',
  context: { module: 'mouseTracker' },
});
```

### Logging

```typescript
// Use Logger module, not console.log
Logger.info('Shelf created', {
  shelfId,
  position,
  mode,
});
```

### Performance Monitoring

```typescript
// Automatic cleanup on high memory
PerformanceMonitor.on('high-memory', () => {
  // Cleanup logic
});
```

- Please restart the appliation and let me test it
