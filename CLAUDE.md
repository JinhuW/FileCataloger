# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Dropover Desktop Clone - an Electron-based application that replicates Dropover's functionality for managing temporary file storage via floating shelves. The app features global mouse tracking, shake detection for shelf activation, and drag-and-drop file management.

## Technology Stack

- **Core**: Electron 28.x, Node.js 20 LTS, TypeScript 5.x, Only use typescript and never use javascript
- **UI**: React 18, Tailwind CSS, Framer Motion
- **Native**: node-gyp for platform-specific integrations (Win32 API, CGEventTap for macOS, X11/Wayland for Linux)
- **Build**: Electron Forge, electron-builder

## Development Commands

```bash
# Install dependencies
yarn install

# TypeScript compilation
yarn tsc

# Build the project
yarn build

# Run in development mode
yarn dev

# Package for distribution
yarn package

# Run tests
yarn test

# Type checking
yarn tsc --noEmit

# Linting (when configured)
yarn lint
```

## Project Architecture

The application follows a multi-process architecture:

### Main Process (`src/main/`)
- **Application Controller**: Lifecycle management, global event coordination
- **Mouse Tracker**: Native platform-specific mouse position tracking
- **Shake Detector**: Algorithm to detect cursor shake gestures (6+ direction changes within 500ms)
- **Drag Detector**: Global drag operation detection via pasteboard monitoring
- **Shelf Manager**: Creates and manages floating shelf windows

### Renderer Process (`src/renderer/`)
- **React Components**: Shelf UI, settings window
- **IPC Communication**: Secure bridge between renderer and main process via contextBridge

### Native Modules (`src/native/`)
- Platform-specific implementations for mouse tracking
- macOS: CGEventTap API
- Windows: Win32 hooks
- Linux: X11/Wayland events

## Key Implementation Patterns

### Platform Detection
Always use factory pattern for platform-specific code:
```typescript
switch (process.platform) {
  case 'darwin': // macOS
  case 'win32':  // Windows
  case 'linux':  // Linux
}
```

### IPC Security
All renderer-main communication must go through validated IPC channels using contextBridge in preload scripts. Never expose raw ipcRenderer.

### Window Management
- Shelves are frameless, transparent BrowserWindows
- Always set `contextIsolation: true` and `nodeIntegration: false`
- Use window pooling for performance (max 3 cached windows)

### State Persistence
- User preferences stored via electron-store
- Shelf positions and pinned states are persisted
- Recent shelves list maintained (max 10)

## File Structure Requirements

```
src/
├── main/                 # Main process code
│   ├── index.ts         # Entry point
│   ├── shake-detector.ts
│   ├── drag-detector.ts
│   ├── shelf-manager.ts
│   └── shelf.ts
├── renderer/            # React UI code
│   ├── components/
│   └── styles/
├── native/              # Platform-specific native code
│   └── mouse-tracker/
└── preload/            # Preload scripts for IPC
```

## Testing Requirements

- Unit tests for shake detection algorithm
- Integration tests for shelf creation/destruction
- Mock native modules in tests using Jest moduleNameMapper
- E2E tests using Spectron for critical user flows

## Performance Considerations

- Batch mouse events (process every 16ms for 60fps)
- Implement item virtualization for shelves with 50+ items
- Use lazy window creation and pooling
- Ring buffer for mouse position history (max 100 entries)

## Security Requirements

- Sanitize all file paths (remove `..` traversal attempts)
- Validate file types before accepting drops
- Set Content Security Policy in all HTML files
- Never log or commit sensitive information
- Sign binaries for distribution

## Development Notes

- The Implementation.md file contains detailed specifications for each module
- TypeScript strict mode is enabled - ensure all types are properly defined
- React components should use functional components with hooks
- Animations use Framer Motion - maintain 60fps performance

## Important: Drag Detection Pattern

**When implementing drag detection for Dropover-like functionality:**
- **Be optimistic**: Enable drag mode when shake is detected, even without confirmed file dragging
- **Auto-timeout**: Disable drag mode after 3 seconds to prevent accidental activation  
- **Reason**: Native file dragging from Finder is hard to detect reliably without complex native code
- **User Experience First**: Prioritize feature availability over perfect detection accuracy

See CODING_NOTES.md for detailed explanation of this issue and solution.

## Agent System for Development Workflow

This project includes specialized Claude agents in `.claude/agents/` to assist with different aspects of development:

### Available Agents
- **@electron-expert**: Main process, IPC security, window management
- **@react-frontend-expert**: React components, animations, UI/UX
- **@native-module-expert**: Platform-specific code, native integrations
- **@performance-expert**: Optimization, memory management, profiling
- **@testing-validation-expert**: Testing, validation, CI/CD

### Stage Completion Workflow

After completing any development stage, use the testing-validation expert to ensure quality:

```bash
# Example: After implementing shake detection
@testing-validation-expert Please validate the shake detection implementation:
1. Create unit tests for ShakeDetector class
2. Test edge cases and performance
3. Validate cross-platform compatibility
4. Check memory usage under load
```

### Development Stage Checklist

When finishing a feature or module:

1. **Code Review**
   ```
   @testing-validation-expert Review the [module name] for:
   - Code quality and best practices
   - Security vulnerabilities
   - Performance bottlenecks
   - Missing error handling
   ```

2. **Test Creation**
   ```
   @testing-validation-expert Generate comprehensive tests for [module name]:
   - Unit tests with >80% coverage
   - Integration tests for IPC communication
   - E2E tests for user workflows
   ```

3. **Validation**
   ```
   @testing-validation-expert Validate [module name]:
   - Run all tests and check coverage
   - Perform security audit
   - Check cross-platform compatibility
   - Verify performance benchmarks
   ```

4. **Documentation**
   ```
   @testing-validation-expert Update documentation for [module name]:
   - API documentation
   - Usage examples
   - Performance characteristics
   ```

### CI/CD Integration

Before merging any feature:
```
@testing-validation-expert Set up CI validation for this PR:
- Configure GitHub Actions workflow
- Add platform-specific tests
- Set up coverage reporting
- Configure automated security scanning
```

### Performance Validation

For performance-critical components:
```
@testing-validation-expert @performance-expert 
Create performance benchmarks for [component]:
- Measure operation throughput
- Check memory usage patterns
- Validate 60fps UI performance
- Test under stress conditions
```