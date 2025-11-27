# FileCataloger Architecture Documentation

**Last Updated:** 2025-11-27
**Version:** 1.0

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Window Management](#window-management)
4. [Multi-Process Communication](#multi-process-communication)
5. [State Management](#state-management)
6. [Module Relationships](#module-relationships)
7. [Performance Optimizations](#performance-optimizations)

---

## Overview

FileCataloger is an Electron application that creates floating "shelf" windows for temporary file storage. Users trigger shelf creation by shaking the mouse while dragging files.

### Core Technologies

- **Electron**: Multi-process desktop application framework
- **React**: UI rendering and component architecture
- **TypeScript**: Type-safe development
- **Zustand**: State management with Immer middleware
- **C++ Native Modules**: High-performance mouse tracking and drag detection
- **Tailwind CSS**: Utility-first styling

---

## System Architecture

### Multi-Process Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Electron Application                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Main Process    │  │ Renderer Process │  │ Preload      │  │
│  │  (Node.js)       │  │ (Chromium/React) │  │ (Security    │  │
│  │                  │  │                  │  │  Bridge)     │  │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │              │  │
│  │ │ App          │ │  │ │ React UI     │ │  │ Context      │  │
│  │ │ Controller   │ │  │ │ Components   │ │  │ Isolation    │  │
│  │ │              │ │  │ │              │ │  │ + IPC        │  │
│  │ ├──────────────┤ │  │ ├──────────────┤ │  │ Validation   │  │
│  │ │ Shelf        │ │  │ │ Zustand      │ │  │              │  │
│  │ │ Manager      │ │  │ │ Stores       │ │  │ Whitelist:   │  │
│  │ │              │ │  │ │              │ │  │ 131 channels │  │
│  │ │ ┌──────────┐ │ │  │ │ shelfStore   │ │  └──────────────┘  │
│  │ │ │Window    │ │ │  │ │ patternStore │ │         ▲           │
│  │ │ │Pool      │ │ │  │ │ toastStore   │ │         │           │
│  │ │ └──────────┘ │ │  │ └──────────────┘ │  ┌──────┴────────┐  │
│  │ ├──────────────┤ │  │ ┌──────────────┐ │  │ window.api    │  │
│  │ │ Drag-Shake   │ │  │ │ File Rename  │ │  │ window.       │  │
│  │ │ Detector     │ │◄─┼─┤ Feature      │ │  │ electronAPI   │  │
│  │ │              │ │  │ │              │ │  └──────────────┘  │
│  │ ├──────────────┤ │  │ └──────────────┘ │                    │
│  │ │ Performance  │ │  └──────────────────┘                    │
│  │ │ Monitor      │ │                                           │
│  │ │              │ │                                           │
│  │ └──────────────┘ │                                           │
│  └─────────┬────────┘                                           │
│            │                                                    │
│            ▼                                                    │
│  ┌─────────────────────────────────────────┐                   │
│  │     Native Modules (C++/macOS)          │                   │
│  │                                         │                   │
│  │  ┌──────────────────┐  ┌─────────────┐ │                   │
│  │  │ mouse-tracker    │  │ drag-monitor │ │                   │
│  │  │ (CGEventTap)     │  │ (NSPasteboard)│                   │
│  │  │ - Position       │  │ - Drag Start/End                  │
│  │  │ - Button State   │  │ - File Paths │                    │
│  │  └──────────────────┘  └─────────────┘ │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Core Module Relationships

```
ApplicationController (Central Orchestrator)
├── ShelfLifecycleManager
│   └── Manages shelf creation/destruction
├── DragDropCoordinator
│   └── Handles drag/shake detection
├── AutoHideManager
│   └── Manages auto-hide behavior
├── ShelfManager
│   ├── Window pooling
│   ├── Window configuration
│   └── Content loading
└── Native Modules
    ├── MouseTracker (C++)
    └── DragMonitor (C++)
```

---

## Window Management

### Two-Layer Architecture

FileCataloger uses a unique two-layer approach:

#### Layer 1: Electron Windows (Invisible Container)

```typescript
{
  frame: false,              // No window decorations
  transparent: true,         // Transparent background
  backgroundColor: undefined, // No opaque background
  hasShadow: false,          // No shadow
  alwaysOnTop: true,         // Float above everything
  skipTaskbar: true,         // Hidden from taskbar

  // Security settings
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
}
```

**Purpose**: Provides OS-level window management (positioning, sizing, focus)

#### Layer 2: React UI (Visible Content)

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        background: transparent;
      }
      #root {
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

**Purpose**: Renders all visual content with React + Tailwind CSS

**Result**: Users see a floating, frameless UI that feels like a native macOS app.

### Window Pooling Strategy

Instead of destroying windows, FileCataloger reuses them:

```
┌────────────────────────────────────┐
│     AdvancedWindowPool             │
├────────────────────────────────────┤
│                                    │
│  Warm Pool (2 windows)             │
│  ├─ Pre-initialized                │
│  ├─ HTML already loaded            │
│  └─ 50ms to acquire                │
│                                    │
│  Cold Pool (3 windows)             │
│  ├─ Basic windows                  │
│  ├─ Need HTML loading              │
│  └─ 100ms to acquire               │
│                                    │
│  Total Limit: 5 windows            │
│                                    │
└────────────────────────────────────┘
```

**Benefits**:

- 90% faster window creation (500ms → 50ms)
- Lower memory usage
- Instant shelf appearance

### Window Lifecycle

```
User Action (Drag + Shake)
    ↓
DragShakeDetector
    ↓
ShelfLifecycleManager.createShelf()
    ↓
ShelfManager.acquireWindow()
    ├─ Try warm pool (50ms)
    ├─ Try cold pool (100ms)
    └─ Create new (500ms)
    ↓
configureShelfWindow()
    ├─ Set size (900x600 or 400x600)
    ├─ Set position (at cursor)
    ├─ Set opacity
    └─ Set always-on-top
    ↓
loadShelfContent()
    ├─ Load shelf.html
    ├─ Send IPC config
    └─ React renders UI
    ↓
window.show()
    ↓
User interacts with shelf
    ↓
destroyShelf() or releaseWindow()
    └─ Return to pool for reuse
```

---

## Multi-Process Communication

### IPC Architecture

```
Main Process                    Preload Script              Renderer Process
    │                                │                            │
    │  window.webContents.send()     │                            │
    ├───────────────────────────────>│                            │
    │        'shelf:config'           │   window.api.on()         │
    │                                 ├───────────────────────────>│
    │                                 │                            │
    │                                 │                            │
    │                                 │  window.api.invoke()       │
    │<────────────────────────────────┤<───────────────────────────┤
    │  ipcMain.handle()               │                            │
    │    'shelf:files-dropped'        │                            │
```

### IPC Communication Patterns

#### Main → Renderer

**shelf:config** - Send shelf configuration

```typescript
// Main Process (ShelfManager)
window.webContents.send('shelf:config', config);

// Renderer (ShelfPage)
const cleanup = on('shelf:config', newConfig => {
  if (isShelfConfig(newConfig)) {
    addShelf(newConfig); // Update Zustand store
  }
});
```

#### Renderer → Main

**shelf:files-dropped** - Handle file drops

```typescript
// Renderer (FileRenameShelf)
window.electronAPI.shelf.filesDropped(shelfId, items);

// Main Process (IPC Handler)
ipcMain.handle('shelf:files-dropped', async (event, shelfId, items) => {
  return shelfManager.addItemToShelf(shelfId, items);
});
```

### IPC Channel Whitelist

The preload script validates all IPC communication:

```typescript
// 131 whitelisted channels including:
- app:get-status
- app:create-shelf
- shelf:create
- shelf:files-dropped
- shelf:remove-item
- shelf:close
- pattern:save
- pattern:list
- pattern:execute
```

---

## State Management

### Main Process State

```typescript
ApplicationController (EventEmitter)
├─ activeDropOperations: Set<shelfId>
├─ activeShelves: Set<shelfId>
├─ nativeDraggedFiles: Array<{path, name}>
├─ stateMachine: DragShelfStateMachine
└─ timerManager: TimerManager

ShelfManager
├─ shelves: Map<shelfId, BrowserWindow>
├─ shelfConfigs: Map<shelfId, ShelfConfig>
├─ dockPositions: Map<position, shelfId[]>
└─ windowPool: AdvancedWindowPool
```

### Renderer Process State (Zustand)

```typescript
useShelfStore (with Immer + DevTools)
├─ shelves: Map<shelfId, ShelfConfig>
│   └─ ShelfConfig
│       ├─ id: string
│       ├─ position: {x, y}
│       ├─ items: ShelfItem[]
│       ├─ isPinned: boolean
│       ├─ isVisible: boolean
│       ├─ opacity: number
│       └─ mode: 'rename'
├─ activeShelfId: string | null
└─ dragOverShelfId: string | null

usePatternStore
├─ patterns: Map<patternId, RenamePattern>
└─ recent: RenamePattern[]

useToastStore
└─ messages: Toast[]
```

### State Synchronization Flow

```
Main Process (ShelfManager)
    │ stores shelf configs
    │ config.position, config.items, config.mode
    │
    ├─ Sends via IPC: window.webContents.send('shelf:config', config)
    │
    v
Renderer Process (ShelfPage)
    │ receives config via useIPC().on()
    │
    ├─ Updates Zustand store: addShelf(config)
    │
    v
Zustand Store (shelfStore)
    │ shelves: Map<shelfId, Shelf>
    │
    ├─ React components subscribe
    │
    v
React Components
    │ const shelf = useShelfStore(state => state.getShelf(shelfId))
    │
    ├─ When shelf changes → re-render
    │
    v
UI Updates
```

---

## Module Relationships

### Main Process Modules

```
src/main/modules/
├── core/
│   ├── applicationController.ts (412 lines) - Central orchestrator
│   ├── shelfLifecycleManager.ts (357 lines) - Shelf CRUD
│   ├── dragDropCoordinator.ts (392 lines) - Drag/drop handling
│   ├── autoHideManager.ts (283 lines) - Auto-hide logic
│   └── cleanupCoordinator.ts (198 lines) - Cleanup sequencing
│
├── window/
│   ├── shelfManager.ts (773 lines) - Window management
│   └── advancedWindowPool.ts (460 lines) - Window pooling
│
├── input/
│   ├── dragShakeDetector.ts - Shake detection
│   ├── keyboardManager.ts - Keyboard shortcuts
│   └── shakeDetector.ts - Advanced shake algorithm
│
├── config/
│   ├── preferencesManager.ts - User preferences
│   └── securityConfig.ts - Security settings
│
└── utils/
    ├── logger.ts - Logging system
    ├── errorHandler.ts - Error handling
    ├── performanceMonitor.ts - Performance tracking
    ├── asyncMutex.ts - Concurrency control
    └── timerManager.ts - Timer management
```

### Renderer Process Structure

```
src/renderer/
├── pages/shelf/
│   ├── shelf.html - HTML template
│   ├── shelf.tsx - React bootstrap
│   └── ShelfPage.tsx - Main component
│
├── features/fileRename/
│   ├── FileRenameShelf/
│   ├── RenamePatternBuilder/
│   └── FileRenamePreviewList/
│
├── stores/
│   ├── shelfStore.ts - Shelf state
│   ├── patternStore.ts - Pattern state
│   └── componentLibraryStore.ts - Component library
│
├── hooks/
│   ├── useIPC.ts - IPC communication
│   ├── useComponentLibrary.ts - Component management
│   └── useFileRename.ts - Rename operations
│
└── utils/
    ├── componentValueResolver.ts - Component resolution
    ├── duplicateDetection.ts - Duplicate filtering
    ├── devLogger.ts - Development logging
    └── safeStorage.ts - Safe localStorage wrapper
```

---

## Performance Optimizations

### 1. Window Pooling

```
Metric              | Before | After | Improvement
--------------------|--------|-------|------------
Window Creation     | 500ms  | 50ms  | 90% faster
Memory Per Window   | 80MB   | -     | Reused
Active Windows      | 1-5    | 1-5   | Same
Pool Overhead       | 0MB    | 50MB  | Trade-off
```

### 2. Event Batching

```typescript
// Mouse events capped at 60fps
MouseEventBatcher
├─ Batch size: 10 events or 33ms
├─ Reduces CPU by 70%
└─ Prevents event flooding
```

### 3. React Optimizations

```typescript
// Memoization
export const FileItem = React.memo(
  ({ file }) => {
    // Component implementation
  },
  (prev, next) => prev.file.id === next.file.id
);

// Zustand selectors
const selectShelf = useCallback(state => state.getShelf(shelfId), [shelfId]);
const shelf = useShelfStore(selectShelf);
```

### 4. IPC Performance

```
- Request batching
- Response caching
- Rate limiting: 100 messages/sec per window
- MessageChannel for heavy data
```

### 5. Native Module Optimization

```
- CGEventTap: 60fps event batching
- ObjectPool<T> memory pooling
- Adaptive sampling based on activity
- Performance profiling built-in
```

---

## Drag-Shake-Shelf Lifecycle

```
                    ┌─────────────────┐
                    │      IDLE       │
                    └────────┬────────┘
                             │
                    START_DRAG│
                             │
                    ┌────────▼─────────┐
                    │  DRAG_STARTED    │
                    └────────┬─────────┘
                             │
                    SHAKE_DETECTED│
                             │
                    ┌────────▼──────────┐
                    │ SHELF_CREATING    │
                    └────────┬─────────┘
                             │
                    SHELF_CREATED│
                             │
                    ┌────────▼────────────┐
                    │  SHELF_ACTIVE      │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
     DROP_STARTED    END_DRAG │         ITEMS_ADDED
            │                │                │
            ▼                ▼                ▼
    ┌─────────────┐  ┌───────────┐  ┌──────────────┐
    │SHELF_REC.   │  │SHELF_AUTO-│  │SHELF_ACTIVE  │
    │DROP         │  │HIDE_SCHED │  │(has items)   │
    └─────┬───────┘  └───┬───────┘  └──────┬───────┘
          │              │                 │
          └──────────┬───┴─────────────────┘
                     │
           AUTO_HIDE_TRIGGERED or CLEANUP_COMPLETE
                     │
                     ▼
            ┌───────────────────┐
            │CLEANUP_IN_PROGRESS│
            └─────────┬─────────┘
                      │
                      ▼
                   ┌─────────────┐
                   │    IDLE     │
                   └─────────────┘
```

---

## File Structure Summary

```
FileCataloger/
├── src/
│   ├── main/ (8,000 lines)
│   │   ├── index.ts (939 lines)
│   │   ├── modules/ (Core modules)
│   │   └── ipc/ (IPC handlers)
│   │
│   ├── renderer/ (6,000 lines)
│   │   ├── stores/ (Zustand)
│   │   ├── components/ (React)
│   │   ├── features/ (Business logic)
│   │   └── hooks/ (Custom hooks)
│   │
│   ├── native/ (2,000 lines)
│   │   ├── mouse-tracker/ (C++)
│   │   └── drag-monitor/ (C++)
│   │
│   ├── preload/ (275 lines)
│   │   └── index.ts (Security bridge)
│   │
│   └── shared/
│       ├── types/ (Shared type defs)
│       └── constants/ (App constants)
│
├── config/
│   ├── webpack/ (Build configs)
│   └── tsconfig.*.json (TypeScript)
│
└── dist/ (Build output)
    ├── main/
    ├── renderer/
    └── preload/
```

---

## Key Architectural Decisions

### 1. Why Two-Layer Windows?

**Decision**: Transparent Electron windows + React UI

**Rationale**:

- Custom styling without Electron decorations
- Modern UI framework (React)
- Performance (GPU-accelerated rendering)
- Flexibility (easy to modify UI)

### 2. Why Window Pooling?

**Decision**: Reuse windows instead of destroy/create

**Rationale**:

- 90% faster shelf creation
- Better user experience (instant appearance)
- Lower CPU usage
- Trade-off: 50MB memory for 5 pooled windows (acceptable)

### 3. Why Zustand over Redux?

**Decision**: Zustand with Immer middleware

**Rationale**:

- Less boilerplate than Redux
- Built-in Immer for immutability
- DevTools support
- Map-based storage for O(1) lookups

### 4. Why Native Modules?

**Decision**: C++ modules for mouse tracking

**Rationale**:

- Performance (60fps mouse tracking)
- System-level access (CGEventTap)
- Low overhead (memory pooling)
- macOS native API integration

### 5. Why IPC Whitelist?

**Decision**: Validated channel whitelist in preload

**Rationale**:

- Security (prevent arbitrary IPC calls)
- Type safety (validated payloads)
- Rate limiting (prevent flooding)
- Audit trail (all channels documented)

---

## Performance Characteristics

### Window Creation Times

| Source        | Time   | Notes                        |
| ------------- | ------ | ---------------------------- |
| Warm pool     | 50ms   | Pre-initialized, HTML loaded |
| Cold pool     | 100ms  | Needs warmup (HTML loading)  |
| New window    | 500ms  | Full creation from scratch   |
| Network delay | Varies | Minimal for local shelf.html |

### Memory Usage

| State     | Memory    | Notes            |
| --------- | --------- | ---------------- |
| App idle  | 50-80MB   | No windows       |
| 1 shelf   | 100-120MB | Window + React   |
| 3 shelves | 150-180MB | Multiple windows |
| 5 shelves | 200-250MB | Max pool size    |

### Event Performance

- Mouse events: Capped at 60fps (16.67ms batches)
- IPC messages: Rate limited to 100/second per window
- React re-renders: Optimized with selectors and React.memo

---

## Conclusion

FileCataloger's architecture combines:

1. **Electron's multi-process model** for security and stability
2. **Transparent windows** for custom, frameless UI
3. **Window pooling** for 90% faster performance
4. **React + Zustand** for modern, maintainable UI
5. **Native C++ modules** for high-performance input tracking
6. **IPC validation** for secure cross-process communication

This architecture delivers a responsive, native-feeling macOS application with excellent performance and maintainability.
