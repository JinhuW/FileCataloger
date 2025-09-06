# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## CRITICAL FEATURE REQUIREMENTS - DO NOT CHANGE

### Drag + Shake Detection Feature
**IMPORTANT**: The core feature is **drag + shake detection**. The shelf should ONLY appear when:
1. User is actively dragging files/folders from Finder or other apps
2. AND shakes the mouse while dragging

**DO NOT**:
- Create shelves on shake alone (without drag)
- Change this core behavior without explicit user request
- Assume shake-only triggering is acceptable

**Current Challenge**: 
- Native drag detection module has loading issues in fallback mode
- Need to properly detect when files are being dragged from Finder BEFORE shake occurs
- The system should detect the drag operation first, then respond to shake gesture

## Essential Commands

### Development
```bash
# Install dependencies
yarn install

# Build native modules (required for mouse tracking)
cd src/native/mouse-tracker/darwin && node-gyp rebuild && cd ../../../..
cd src/native/drag-monitor && yarn install && node-gyp rebuild && cd ../..

# Run development server
yarn dev

# Type checking - MUST RUN before committing
yarn tsc
# or
yarn typecheck
```

### Build & Production
```bash
# Build all components
yarn build

# Build individual components
yarn build:main      # Main process
yarn build:renderer   # React UI
yarn build:preload   # Preload scripts

# Start built application
yarn start

# Package for distribution
yarn package
yarn make
```

## Architecture Overview

This is an Electron desktop application that replicates Dropover's functionality with native macOS integration.

### Core Components

1. **Main Process** (`src/main/`)
   - `ApplicationController`: Central coordinator for all modules
   - `ShelfManager`: Manages multiple shelf windows
   - `DragShakeDetector`: Combines drag detection with shake gestures
   - `PerformanceMonitor`: CPU/memory tracking with auto-cleanup
   - `PreferencesManager`: User settings with ElectronStore
   - `KeyboardManager`: Global shortcuts
   - `ErrorHandler`: Multi-level error system with categorization
   - `Logger`: File-based logging with rotation

2. **Native Modules** (`src/native/`)
   - `mouse-tracker`: CGEventTap-based mouse tracking for macOS
   - `drag-monitor`: Native drag detection module
   - Built with node-gyp, requires rebuild after node_modules changes

3. **Renderer Process** (`src/renderer/`)
   - React 19 with TypeScript
   - Tailwind CSS for styling
   - Framer Motion for animations
   - Zustand for state management

4. **IPC Communication**
   - Typed IPC channels defined in `src/shared/types.ts`
   - Contextual bridge exposed via preload script

### Module Interactions

- **Shake Detection**: Mouse tracker → DragShakeDetector → ShelfManager → Creates shelf window
- **Error Flow**: Any module → ErrorHandler → Logger → File system
- **Preferences**: PreferencesManager ↔ All modules (singleton pattern)
- **Performance**: PerformanceMonitor → Triggers GC on high memory → Logs warnings

## Critical Implementation Details

### Native Module Requirements
- **macOS Accessibility**: App requires accessibility permissions for mouse tracking
- **Python**: Required for node-gyp to build native modules
- **Build Order**: Native modules must be built before running the app

### Window Management
- Shelves are frameless, always-on-top BrowserWindows
- Each shelf has unique ID tracked by ShelfManager
- Windows persist position and state between sessions

### Error Handling Strategy
- Four severity levels: LOW, MEDIUM, HIGH, CRITICAL
- Seven categories: SYSTEM, NATIVE, USER_INPUT, FILE_OPERATION, WINDOW, IPC, PERFORMANCE
- Automatic fallback to Node.js mouse tracking if native fails
- User-friendly error messages with technical details in logs

### Performance Constraints
- Memory limit: 500MB triggers GC
- CPU limit: 80% triggers performance warning
- Mouse tracking: Must maintain 60fps (16ms latency)
- Empty shelf auto-hide: 5 seconds default

## TypeScript Configuration

- **Strict mode enabled** - All strict checks active
- Path aliases configured:
  - `@main/*` → `src/main/*`
  - `@renderer/*` → `src/renderer/*`
  - `@native/*` → `src/native/*`
  - `@shared/*` → `src/shared/*`

## File Organization

- Components follow PascalCase: `ShelfManager.ts`
- Modules export singleton instances: `export const shelfManager = new ShelfManager()`
- Shared types in `src/shared/types.ts`
- Logger types in `src/shared/logger.ts`

## Testing Approach

No test framework is currently configured. To add tests:
1. Install test framework (Jest/Vitest recommended)
2. Add test scripts to package.json
3. Create `__tests__` directories in respective modules

## Known Issues & Workarounds

1. **Native module build failures**: Ensure Python 3.x and Xcode Command Line Tools installed
2. **Accessibility permissions**: Guide users through System Preferences → Security & Privacy → Accessibility
3. **High memory usage**: PerformanceMonitor auto-triggers GC at 500MB threshold

## Development Notes

- Always run `yarn tsc` before committing to catch type errors
- Native modules require rebuild after Node version changes
- Preferences stored at `~/Library/Application Support/dropover_clone/`
- Logs stored at `~/Library/Application Support/dropover_clone/logs/` with 7-day retention