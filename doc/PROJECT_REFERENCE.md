# FileCataloger Project Reference

## Project Overview
**FileCataloger** (formerly Dropover Clone) - An Electron-based macOS application that creates floating "shelf" windows for temporary file storage during drag operations. Works system-wide with drag + shake gesture detection.

## Current Status
- ✅ **Core Features Complete**: Drag detection, shake gesture, shelf management
- ✅ **macOS Support**: Native CGEventTap implementation working
- ✅ **TypeScript**: Strict mode compliance, zero errors
- ⏳ **Cross-Platform**: Windows/Linux support planned
- ⏳ **Testing**: Unit/E2E tests planned

## Tech Stack
- **Core**: Electron 28.x, Node.js 20 LTS, TypeScript 5.x
- **UI**: React 18, Tailwind CSS 4 alpha, Framer Motion
- **Native**: C++ with node-gyp (macOS CGEventTap)
- **Build**: Webpack, Electron Forge
- **State**: Zustand, Electron Store

## Architecture

### Main Process (`src/main/`)
- **ApplicationController**: Central orchestrator, lifecycle management
- **ShelfManager**: Creates/manages shelf windows, window pooling
- **DragShakeDetector**: Detects drag + shake gestures
- **ErrorHandler**: Comprehensive error handling with severity levels
- **PreferencesManager**: User settings with Electron Store

### Renderer Process (`src/renderer/`)
- React components with TypeScript
- Tailwind CSS for styling
- Framer Motion animations
- Virtualized lists for performance

### Native Modules (`src/native/`)
- **mouse-tracker**: CGEventTap for global mouse tracking (macOS)
- **drag-monitor**: NSPasteboard monitoring for file detection
- Requires rebuild after Node/Electron updates

## Key Features & Implementation

### Drag + Shake Detection
1. User drags files from Finder
2. Native module detects drag via NSPasteboard
3. Shake detector monitors mouse trajectory (6+ direction changes in 500ms)
4. Shelf appears at cursor position
5. Auto-hides when empty (5s delay)

### Performance Optimizations
- Window pooling (max 3 cached windows)
- Event batching for mouse updates
- React component memoization
- Virtualized lists for large datasets
- CPU/memory monitoring with auto-cleanup

### Security
- Context isolation enabled
- Sandboxing active
- CSP headers configured
- Input validation on all IPC
- No node integration in renderers

## Common Tasks

### Development
```bash
# Install and build native modules
yarn install
cd src/native/mouse-tracker/darwin && node-gyp rebuild && cd ../../../..

# Run development
yarn dev

# Type checking (run before commits)
yarn typecheck

# Build all
yarn build
```

### Building/Distribution
```bash
# macOS DMG
yarn make:dmg

# Architecture specific
yarn dist:mac:arm64  # Apple Silicon
yarn dist:mac:x64    # Intel
```

## Improvement Opportunities

### High Priority
1. **Testing Infrastructure**: No tests currently exist
2. **Memory Leak Prevention**: Event listeners need cleanup
3. **Cross-Platform Support**: Windows/Linux implementations

### Medium Priority
1. **Performance**: Batch mouse position updates to reduce IPC
2. **Keyboard Shortcuts**: Global shortcuts for power users
3. **Shelf Persistence**: Save/restore shelves between sessions
4. **Accessibility**: ARIA labels and keyboard navigation

### Low Priority
1. **Analytics**: Usage metrics and telemetry
2. **Onboarding**: First-time user tutorial
3. **Themes**: Dark/light mode support

## Known Issues & Solutions

### Common Problems
1. **"Cannot find .node module"** → Rebuild: `cd src/native/mouse-tracker/darwin && node-gyp rebuild`
2. **Shelf not appearing** → Check macOS Accessibility permissions
3. **CSP errors in dev** → Normal for webpack dev mode
4. **High CPU usage** → Check for event listener leaks

### Debug Commands
```bash
# Monitor drag/shelf events
yarn dev | grep -E "dragStart|dragShake|shelf"

# Check native module status  
yarn dev | grep -E "native|mouse|position"

# Track performance
yarn dev | grep -E "CPU|Memory|Performance"
```

## Code Style Guidelines
- TypeScript only (no JavaScript)
- Async/await over callbacks
- Proper cleanup in all modules
- No console.log - use Logger module
- Follow existing patterns in codebase

## Future Roadmap

### Phase 1: Stability (Current)
- Fix any remaining bugs
- Optimize performance
- Add comprehensive error recovery

### Phase 2: Testing & Quality
- Unit tests for core modules
- Integration tests for IPC
- E2E tests with Playwright

### Phase 3: Features
- Preferences window
- Keyboard shortcuts
- Multi-monitor support
- File preview in shelves

### Phase 4: Distribution
- Code signing
- Auto-updater
- App Store submission
- CI/CD pipeline

## Quick Reference

### File Organization
```
src/
├── main/           # Main process modules
├── renderer/       # React UI components  
├── native/         # C++ native modules
├── preload/        # Preload scripts
└── shared/         # Shared types/constants
```

### Key Files
- `application-controller.ts`: Main app orchestrator
- `shelf-manager.ts`: Shelf window management
- `drag-shake-detector.ts`: Gesture detection
- `Shelf.tsx`: Main shelf UI component

### IPC Channels
- `shelf:create` - Create new shelf
- `shelf:files-dropped` - Files added to shelf
- `shelf:update-config` - Update shelf settings
- `drag:start/end` - Drag state changes

## Performance Metrics
- Startup time: < 2 seconds
- Mouse tracking: 60fps (< 16ms latency)
- Memory usage: < 150MB idle
- CPU usage: < 5% idle, < 15% active