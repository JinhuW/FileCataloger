# CLAUDE.md - Main Module

This file provides guidance for working with the **main module** of the FileCataloger Electron application.

## Module Overview

The main module (`src/main/`) contains the Electron main process code that orchestrates the entire application. It handles system integration, native API access, window management, and coordinates all core functionality.

## Development Commands

```bash
# Build main module only
yarn build:main

# Type check main module
yarn typecheck

# Lint main module
yarn lint

# Run application (builds all modules first)
yarn dev
```

## Architecture

### Entry Point

- **`index.ts`**: Application entry point, creates `FileCatalogerApp` instance
- **`FileCatalogerApp`**: Main application class handling Electron lifecycle

### Module Structure

```
src/main/modules/
├── core/
│   └── application-controller.ts    # Central orchestrator
├── input/
│   ├── drag-shake-detector.ts       # Mouse gesture detection
│   ├── mouse-event-batcher.ts       # Performance optimization
│   ├── shake-detector.ts            # Shake gesture logic
│   └── keyboard-manager.ts          # Global keyboard shortcuts
├── window/
│   ├── shelf-manager.ts             # Shelf window lifecycle
│   └── optimized-window-pool.ts     # Window pooling for performance
├── config/
│   ├── preferences-manager.ts       # User settings
│   └── security-config.ts           # CSP and security headers
└── utils/
    ├── logger.ts                    # Structured logging
    ├── error-handler.ts             # Error management
    └── performance-monitor.ts       # Resource monitoring
```

## Core Components

### ApplicationController (`core/application-controller.ts`)

Central orchestrator that manages:

- Mouse tracking via native modules
- Drag/shake detection coordination
- Shelf creation and lifecycle
- IPC message routing
- Event coordination between modules

**Key Methods:**

- `start()`: Initialize all subsystems
- `createShelf(config)`: Create new shelf window
- `destroyShelf(id)`: Clean up shelf and resources
- `handleFilesDropped(shelfId, files)`: Process file drop operations

### DragShakeDetector (`input/drag-shake-detector.ts`)

Detects mouse shake gestures (6+ direction changes in 500ms) to trigger shelf creation.

- Integrates with native mouse tracker
- Batches mouse events for performance
- Prevents duplicate shelf creation during drag sessions

### ShelfManager (`window/shelf-manager.ts`)

Manages shelf window lifecycle:

- Window creation and positioning
- Auto-hide timers (5s delay when empty)
- Maximum shelf limits (5 simultaneous)
- Window pooling for performance

### PreferencesManager (`config/preferences-manager.ts`)

Handles user settings with Electron Store:

- Shake sensitivity configuration
- Auto-hide delay settings
- Performance monitoring options
- Accessibility permission status

## IPC Communication

All IPC follows strict schemas defined in `@shared/ipc-schema.ts`:

### Main → Renderer

- `app:status` - Application status updates
- `shelf:update` - Shelf state changes

### Renderer → Main

- `app:get-status` - Request current status
- `app:create-shelf` - Manual shelf creation
- `shelf:files-dropped` - File drop notifications
- `shelf:close` - Close specific shelf

## Native Integration

### Mouse Tracking

- Uses native C++ module `@native/mouse-tracker`
- Requires Accessibility permissions on macOS
- CGEventTap integration for system-level mouse monitoring
- Automatic permission check on startup

### System Tray

- Menu bar application with system tray icon
- Context menu with status, preferences, and quit options
- Custom tray icon generation (geometric pattern fallback)

## Performance Considerations

### Event Batching

- Mouse events batched to reduce CPU usage
- Performance monitor tracks CPU/memory usage
- Automatic cleanup on high memory usage

### Window Pooling

- Reuse shelf windows to reduce creation overhead
- Maximum 5 simultaneous shelves
- Auto-hide timers prevent resource leaks

### Resource Management

- Comprehensive cleanup on app shutdown
- Native module destruction on exit
- Timer cleanup to prevent memory leaks

## Security

### Electron Security

- Context isolation enabled
- Node integration disabled in renderers
- Sandbox mode consideration (currently disabled)
- CSP headers via `security-config.ts`

### Permission Handling

- Accessibility permission checks on startup
- Graceful degradation without permissions
- User prompt with system preferences access

## Error Handling

### Structured Error Management

- Error severity levels (LOW, MEDIUM, HIGH, CRITICAL)
- Error categories (SYSTEM, NETWORK, USER_INPUT, PERFORMANCE)
- Comprehensive logging with file rotation
- Performance monitoring integration

### Common Error Scenarios

1. **Native module binding failures**: Check node-gyp rebuild
2. **Accessibility permission denied**: Graceful fallback
3. **Shelf creation failures**: Resource cleanup and retry
4. **IPC communication errors**: Schema validation failures

## Development Guidelines

### Code Patterns

- Use TypeScript for all new code
- Follow existing module structure
- Use the Logger module (not console.log)
- Implement proper error boundaries
- Handle async operations with try/catch

### Testing Mouse Functionality

- Development mode shows shelves immediately
- DevTools available for IPC debugging
- Check `~/Library/Application Support/FileCataloger/logs/` for detailed logs

### Module Dependencies

- `@shared/*` - Shared types and constants
- `@native/*` - Native C++ modules
- `electron` - Electron APIs
- Import from relative module paths

## Debugging

### Common Issues

1. **Module not found**: Check path aliases in tsconfig.json
2. **Native binding errors**: Rebuild native modules
3. **IPC failures**: Verify schema compliance
4. **Permission issues**: Check macOS Accessibility settings

### Development Tools

- Electron DevTools for renderer debugging
- Main process logs via Logger module
- Performance metrics via PerformanceMonitor
- IPC message tracing in development mode

## Important Notes

- ALWAYS run `yarn typecheck` before committing
- Native modules must be rebuilt after Electron version changes
- Test permission handling in production builds
- Monitor performance logs for memory leaks
- Use structured logging for all output
