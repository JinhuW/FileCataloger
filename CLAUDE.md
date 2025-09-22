# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development

```bash
# Install dependencies
yarn install

# Build native modules (required after install)
cd src/native/mouse-tracker/darwin && node-gyp rebuild && cd ../../drag-monitor && node-gyp rebuild && cd ../../../..
# OR use the convenience command:
yarn rebuild:native

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

### Testing and Quality Checks

```bash
# Run tests
yarn test
yarn test:ui
yarn test:coverage

# Test native modules
yarn test:native
yarn test:native:smoke
yarn test:native:benchmark
yarn test:native:validate

# Format code
yarn format
yarn format:check

# Security audit
yarn security:check

# Quality checks (type + lint + format + audit)
yarn quality:check

# Validate renderer code
yarn validate:renderer

# Generate TypeDoc documentation
yarn docs:generate
```

## Architecture Overview

FileCataloger is an Electron-based desktop application that creates floating "shelf" windows for temporary file storage during drag operations. The application uses native macOS APIs for mouse tracking and drag detection.

### Core Components

1. **Main Process** (`src/main/`)
   - `applicationController`: Central orchestrator managing all modules
   - `shelfManager`: Manages creation, positioning, and lifecycle of shelf windows
   - `dragShakeDetector`: Detects mouse shake gestures to trigger shelf creation
   - `preferencesManager`: Handles user preferences with Electron Store
   - Native mouse tracking via CGEventTap (macOS)

2. **Renderer Process** (`src/renderer/`)
   - React 19 + TypeScript for UI
   - Tailwind CSS for styling
   - Framer Motion for animations
   - Zustand for state management with Immer middleware

3. **Native Modules** (`src/native/`)
   - `mouse-tracker`: Platform-specific mouse tracking (C++ for macOS)
   - `drag-monitor`: Native drag detection using NSPasteboard
   - Built with node-gyp using monorepo architecture

### Key Patterns

- **IPC Communication**: Strict schema-based IPC between main and renderer
- **Error Handling**: Comprehensive error handling with severity levels
- **Performance Monitoring**: Built-in CPU/memory monitoring
- **Logging**: Structured logging with file rotation
- **Security**: Context isolation, sandboxing, CSP headers

### Shelf Creation Flow

1. User shakes mouse (6+ direction changes in 500ms) while dragging files
2. `dragShakeDetector` detects pattern
3. `applicationController` creates shelf via `shelfManager`
4. Shelf window appears at cursor position
5. User drops files onto shelf
6. Shelf auto-hides when empty (after 5s delay)

## Project Structure

```
src/
├── main/modules/
│   ├── core/
│   │   └── applicationController.ts  # Central orchestrator
│   ├── input/
│   │   ├── dragShakeDetector.ts     # Combined drag/shake detection
│   │   └── mouseEventBatcher.ts     # Performance optimization
│   ├── window/
│   │   ├── shelfManager.ts          # Window lifecycle
│   │   └── optimizedWindowPool.ts   # Window pooling
│   ├── config/
│   │   ├── preferencesManager.ts    # User preferences
│   │   └── securityConfig.ts        # Security headers
│   └── utils/
│       ├── logger.ts                 # Structured logging
│       ├── errorHandler.ts           # Error management
│       └── performanceMonitor.ts     # Resource monitoring
├── renderer/
│   ├── components/
│   │   ├── domain/                   # Business logic components
│   │   └── primitives/               # Basic UI building blocks
│   ├── features/
│   │   └── fileRename/               # File renaming functionality
│   ├── pages/
│   │   ├── preferences/              # Preferences window
│   │   └── shelf/                    # Shelf window pages
│   └── stores/
│       └── shelfStore.ts             # Zustand state management
└── shared/
    ├── types/                        # TypeScript interfaces
    ├── constants.ts                  # Shared constants
```

## Important Notes

### Native Module Building

- **Automatic Installation**: Native modules rebuild automatically during `yarn install` via intelligent installer
- **Multi-Strategy Approach**: Tries prebuild-install → electron-rebuild → manual build as needed
- **Zero Configuration**: No manual rebuild steps required for normal development
- **Smart Validation**: Automatic verification that modules load correctly (79KB + 96KB expected)
- **Electron Integration**: Automatic version matching with current Electron version

#### Manual Commands (rarely needed)
```bash
yarn rebuild:native              # Force rebuild if automatic install fails
npm run install:native           # Run smart installer with validation
yarn build:native:verbose        # Debug build issues
```

### macOS Permissions

- Application requires Accessibility permissions for mouse tracking
- Users will be prompted on first run
- Test in production mode to verify permission handling

### TypeScript Configuration

- Strict mode is enabled - no implicit `any`
- Path aliases configured (e.g., `@main/*`, `@renderer/*`, `@native/*`, `@shared/*`)
- Separate configs for main/renderer processes in `config/` directory
- Project references used for better build performance
- Run `yarn typecheck` to check all TypeScript files across the project

### IPC Communication

All IPC messages follow strict schemas defined in `src/shared/ipcSchema.ts`:

- `app:get-status` - Get application status
- `app:create-shelf` - Create shelf manually
- `shelf:files-dropped` - Handle file drops
- `shelf:close` - Close specific shelf

### Window Management

- Uses window pooling for performance
- Shelf windows are frameless with custom drag regions
- Auto-positioning avoids screen edges
- Support for multiple simultaneous shelves (max 5)

### Performance Considerations

- Mouse events batched for efficiency (60fps max)
- Virtual scrolling for large file lists
- Window pooling reduces creation overhead
- Automatic garbage collection on high memory usage

### Debugging

- Development mode shows shelf windows immediately for testing
- Check console logs for detailed operation traces
- Performance issues logged to `~/Library/Application Support/FileCataloger/logs/`
- Use `yarn dev` with Chrome DevTools for debugging

### Common Issues

1. **Native module errors**: Rebuild with `yarn rebuild:native`
2. **Shelf not appearing**: Check Accessibility permissions in macOS settings
3. **Type errors**: Run `yarn typecheck` before committing
4. **Build failures**: Ensure Python is installed for `node-gyp`
5. **Module not found**: Check path aliases in webpack configs match tsconfig
6. **Electron version mismatch**: Ensure native modules are rebuilt after Electron updates

## Code Style

- Use TypeScript for all new code
- Follow existing file naming conventions
- No console.log in production - use the Logger module
- Prefer functional components with hooks in React
- Use proper error boundaries and error handling
- Always handle async errors with try/catch
- Use Zod for runtime validation of external data

## Pre-commit Hooks

The project uses Husky for pre-commit hooks that automatically run:

- Prettier formatting
- ESLint fixes
- TypeScript type checking
- Renderer validation

These checks ensure code quality before commits are made.
