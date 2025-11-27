# Changelog

All notable changes to FileCataloger will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-27

### 🎉 Initial Release

First production-ready release of FileCataloger for macOS.

### Added

#### Core Features

- Drag + shake detection for intuitive shelf creation
- Multiple floating shelf windows with window pooling (max 5 simultaneous)
- Full drag-and-drop support for files and content
- Native mouse tracking using CGEventTap (macOS)
- Auto-hide for empty shelves after configurable timeout
- Shelf persistence with state and position memory

#### User Interface

- React-based modern UI with Tailwind CSS
- Framer Motion animations for smooth transitions
- Virtualized lists for performance with large file collections
- Multiple shelf modes (display, rename)
- Pin functionality to keep shelves visible
- Individual item removal with × button
- Clear all functionality

#### File Operations

- File rename feature with pattern builder
- Live preview for rename operations
- Batch rename with conflict detection
- Saved pattern management
- Undo support for rename operations

#### System Integration

- System tray integration with menu
- Global keyboard shortcuts for all major actions
- macOS Accessibility integration for shake detection
- Native drag monitoring via NSPasteboard

#### Developer Features

- 100% TypeScript with strict mode
- Comprehensive error handling with severity levels
- Performance monitoring with CPU and memory tracking
- Automatic garbage collection on high memory
- Detailed logging system with file rotation (7-day retention)
- Security features: context isolation, sandboxing, CSP headers

#### Build & Distribution

- Electron Forge build system
- Universal DMG for macOS (Apple Silicon + Intel)
- Code signing with Apple Developer ID
- Notarization for macOS Gatekeeper
- Automated native module building

#### Testing & Quality

- Unit tests with Vitest
- Native module validation tests
- Type checking with TypeScript
- ESLint with security plugins
- Prettier code formatting
- Comprehensive quality check pipeline

#### Documentation

- Complete README with architecture overview
- Detailed development guide (CLAUDE.md)
- Inline JSDoc comments
- Configuration examples

### Performance

- Memory usage: < 150MB idle
- CPU usage: < 5% during normal operation
- Mouse tracking: 60fps (16ms latency)
- Startup time: < 2 seconds

### Security

- All renderer processes use context isolation
- Sandboxed renderer processes
- IPC channel whitelist validation
- Input sanitization and validation
- Memory-safe native C++ code with bounds checking

### Known Limitations

- macOS only (Windows support experimental)
- Requires Accessibility permissions for shake detection
- Python required for building native modules
- Maximum 5 simultaneous shelves (configurable)

## [Unreleased]

### Planned Features

- [ ] Windows native support (Win32 hooks)
- [ ] Linux support (X11/Wayland)
- [ ] Auto-updater integration
- [ ] Cloud sync for preferences
- [ ] Advanced file preview
- [ ] Custom themes and styling
- [ ] Shelf templates
- [ ] Export/import shelf configurations

---

## Release Notes

### Version Numbering

- **Major version** (X.0.0): Breaking changes, major new features
- **Minor version** (1.X.0): New features, backwards compatible
- **Patch version** (1.0.X): Bug fixes, minor improvements

### Support Policy

- Latest major version: Full support
- Previous major version: Security fixes only
- Older versions: No support

[1.0.0]: https://github.com/JinhuW/FileCataloger/releases/tag/v1.0.0
[Unreleased]: https://github.com/JinhuW/FileCataloger/compare/v1.0.0...HEAD
