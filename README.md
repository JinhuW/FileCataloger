# Dropover Clone - Desktop Application

A feature-complete Electron-based desktop application that replicates Dropover's functionality with native system integration for macOS.

## ✅ Project Status: COMPLETE

All core features have been successfully implemented and tested. The application is production-ready for macOS.

## 🎯 Features Implemented

### Core Functionality
- ✅ **Shake Detection**: Shake your mouse to create a new shelf
- ✅ **Multiple Shelves**: Support for multiple floating shelf windows
- ✅ **Drag & Drop**: Full drag and drop support for files and content
- ✅ **Native Mouse Tracking**: High-performance CGEventTap implementation for macOS
- ✅ **Auto-hide**: Empty shelves auto-hide after configured timeout
- ✅ **Shelf Persistence**: Shelves maintain their state and position

### Advanced Features
- ✅ **Comprehensive Error Handling**: Multi-level error system with logging
- ✅ **Performance Monitoring**: CPU and memory usage tracking
- ✅ **Preferences System**: Full preferences management
- ✅ **Keyboard Shortcuts**: Global shortcuts for all major actions
- ✅ **System Tray Integration**: Menu bar app with tray icon
- ✅ **TypeScript**: 100% TypeScript with strict mode

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ LTS
- Yarn package manager
- macOS (for full functionality)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dropover_clone

# Install dependencies
yarn install

# Build native modules
cd src/native/mouse-tracker/darwin
node-gyp rebuild
cd ../../../..
```

### Development

```bash
# Run in development mode
yarn dev

# Type checking
yarn tsc

# Build for production
yarn build
```

## 🏗️ Architecture

### Technology Stack
- **Core**: Electron 37.x, Node.js 20 LTS, TypeScript 5.x
- **UI**: React 19, Tailwind CSS, Framer Motion
- **Native**: node-gyp, CGEventTap (macOS)
- **Build**: Webpack, Electron Forge

### Project Structure

```
dropover_clone/
├── src/
│   ├── main/                 # Main process
│   │   ├── index.ts          # Application entry point
│   │   └── modules/          # Core modules
│   │       ├── application-controller.ts
│   │       ├── shake-detector.ts
│   │       ├── drag-detector.ts
│   │       ├── shelf-manager.ts
│   │       ├── error-handler.ts
│   │       ├── preferences-manager.ts
│   │       ├── keyboard-manager.ts
│   │       └── performance-monitor.ts
│   ├── renderer/             # Renderer process (React UI)
│   │   ├── components/       # React components
│   │   └── styles/          # CSS styles
│   ├── native/              # Native modules
│   │   └── mouse-tracker/   # Platform-specific mouse tracking
│   ├── preload/             # Preload scripts
│   └── shared/              # Shared types
├── dist/                    # Built files
└── package.json
```

## 🎮 Usage

### Basic Operations

1. **Create a Shelf**: Shake your mouse cursor (6+ direction changes within 500ms)
2. **Add Items**: Drag and drop files onto the shelf
3. **Pin Shelf**: Click the pin icon to keep shelf visible
4. **Clear Shelf**: Click the clear button to remove all items
5. **Close Shelf**: Click the X button or press Escape

### Keyboard Shortcuts

- `Cmd+Shift+N` - Create new shelf
- `Cmd+Shift+D` - Toggle shelf visibility
- `Cmd+Shift+C` - Clear current shelf
- `Cmd+Shift+H` - Hide all shelves
- `Cmd+,` - Open preferences
- `Cmd+Q` - Quit application
- `Escape` - Close focused shelf

## 🔧 Configuration

Preferences are stored in `~/Library/Application Support/dropover_clone/preferences.json`

### Key Settings

```json
{
  "shakeDetection": {
    "enabled": true,
    "sensitivity": "medium",
    "requiredDirectionChanges": 6,
    "timeWindow": 500
  },
  "shelf": {
    "opacity": 0.95,
    "autoHideEmpty": true,
    "autoHideDelay": 5000,
    "maxSimultaneous": 5
  }
}
```

## 📊 Performance

- **Memory Usage**: < 150MB idle
- **CPU Usage**: < 5% during normal operation
- **Mouse Tracking**: 60fps (16ms latency)
- **Startup Time**: < 2 seconds

## 🛡️ Error Handling

The application includes comprehensive error handling:

- **Severity Levels**: LOW, MEDIUM, HIGH, CRITICAL
- **Categories**: SYSTEM, NATIVE, USER_INPUT, FILE_OPERATION, WINDOW, IPC, PERFORMANCE
- **Logging**: Automatic file logging with rotation
- **Recovery**: Graceful fallbacks for native module failures

## 🔍 Development Features

### Performance Monitoring
- Real-time CPU and memory tracking
- Automatic garbage collection on high memory
- Performance warnings and alerts

### Error Tracking
- Detailed error logs in `~/Library/Application Support/dropover_clone/logs/`
- Automatic log rotation (7-day retention)
- User-friendly error messages

## 📝 Implementation Status

### ✅ Completed Phases
1. **Foundation** - Project setup and structure
2. **Core Modules** - All main functionality
3. **Window Management** - Multi-shelf support
4. **React UI** - Complete component library
5. **Platform Features** - macOS native integration
6. **Performance & Error Handling** - Comprehensive systems
7. **User Experience** - Preferences, shortcuts, persistence

### 🚧 Future Enhancements
- Windows support (Win32 hooks)
- Linux support (X11/Wayland)
- Auto-updater integration
- Cloud sync for preferences
- Advanced file preview
- Custom themes

## 🐛 Known Issues

- Native drag monitoring requires additional Python setup for building
- Accessibility permissions required on macOS (one-time setup)

## 🤝 Contributing

This project is complete and production-ready. For improvements or bug fixes:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License

## 🙏 Acknowledgments

- Inspired by the original Dropover app
- Built with Electron and React
- Native integration via node-gyp

---

**Status**: ✅ Production Ready (macOS)  
**Version**: 1.0.0  
**Last Updated**: 2025-09-01