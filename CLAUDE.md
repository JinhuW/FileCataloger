# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
```bash
# Install dependencies
yarn install

# Build native modules (required after install)
cd src/native/mouse-tracker/darwin
node-gyp rebuild
cd ../../../..

# Run in development mode
yarn dev

# Build all modules
yarn build

# Type checking (ALWAYS run before committing)
yarn typecheck

# Linting (ALWAYS run before committing)
yarn lint

# Clean build artifacts
yarn clean
```

### Building and Packaging
```bash
# Build for macOS (DMG)
yarn make:dmg

# Build for specific architecture
yarn dist:mac:arm64  # Apple Silicon
yarn dist:mac:x64    # Intel Macs

# Full distribution build
yarn dist
```

## Architecture Overview

This is a **FileCataloger** - an Electron-based desktop application that creates floating "shelf" windows for temporary file storage during drag operations. The application uses native macOS APIs for mouse tracking and drag detection.

### Core Components

1. **Main Process** (`src/main/`)
   - `ApplicationController`: Central orchestrator managing all modules
   - `ShelfManager`: Manages creation, positioning, and lifecycle of shelf windows
   - `DragShakeDetector`: Detects mouse shake gestures to trigger shelf creation
   - `PreferencesManager`: Handles user preferences with Electron Store
   - Native mouse tracking via CGEventTap (macOS)

2. **Renderer Process** (`src/renderer/`)
   - React 19 + TypeScript for UI
   - Tailwind CSS for styling
   - Framer Motion for animations
   - Zustand for state management

3. **Native Modules** (`src/native/`)
   - `mouse-tracker`: Platform-specific mouse tracking (C++ for macOS)
   - Requires `node-gyp` for building

### Key Patterns

- **IPC Communication**: Strict schema-based IPC between main and renderer
- **Error Handling**: Comprehensive error handling with severity levels
- **Performance Monitoring**: Built-in CPU/memory monitoring
- **Logging**: Structured logging with file rotation
- **Security**: Context isolation, sandboxing, CSP headers

### Shelf Creation Flow
1. User shakes mouse (6+ direction changes in 500ms)
2. `DragShakeDetector` detects pattern
3. `ApplicationController` creates shelf via `ShelfManager`
4. Shelf window appears at cursor position
5. User drags files onto shelf
6. Shelf auto-hides when empty (after 5s delay)

## Important Notes

### Native Module Building
- The application uses native C++ modules for mouse tracking
- These MUST be rebuilt after `yarn install` or Node/Electron version changes
- If you see errors about missing `.node` files, run the native build commands above

### macOS Permissions
- Application requires Accessibility permissions for mouse tracking
- Users will be prompted on first run
- Test in production mode to verify permission handling

### TypeScript Configuration
- Strict mode is enabled - no implicit `any`
- Path aliases configured (e.g., `@main/*`, `@renderer/*`)
- Separate configs for main/renderer processes

### Debugging
- Development mode shows shelf windows immediately for testing
- Check console logs for detailed operation traces
- Performance issues logged to `~/Library/Application Support/FileCataloger/logs/`

### Common Issues
1. **Native module errors**: Rebuild with `node-gyp rebuild` in native module directory
2. **Shelf not appearing**: Check Accessibility permissions in macOS settings
3. **Type errors**: Run `yarn typecheck` before committing
4. **Build failures**: Ensure Python is installed for `node-gyp`

## Code Style
- Use TypeScript for all new code
- Follow existing patterns in the codebase
- No console.log in production - use the Logger module
- Prefer functional components with hooks in React
- Use proper error boundaries and error handling