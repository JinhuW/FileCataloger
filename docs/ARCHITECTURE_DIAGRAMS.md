# FileCataloger - Architecture Diagrams & Detailed Flows

## 1. HIGH-LEVEL APPLICATION ARCHITECTURE

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
│  │  │ (CGEventTap)     │  │ (NSPasteboard)                     │
│  │  │ - Position       │  │ - Drag Start/End                  │
│  │  │ - Button State   │  │ - File Paths                      │
│  │  └──────────────────┘  └─────────────┘ │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 2. DRAG-SHAKE-SHELF LIFECYCLE STATE MACHINE

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

Key Transitions:
- DRAG_STARTED → SHELF_CREATING (on shake + files detected)
- SHELF_ACTIVE → SHELF_RECEIVING_DROP (drop start)
- SHELF_ACTIVE → SHELF_AUTO_HIDE (empty + no drag)
- All → CLEANUP_IN_PROGRESS (cleanup complete)
```

## 3. EVENT FLOW: Mouse Drag → Shelf Creation

```
User Drags Files with Mouse Shake
    │
    ▼
┌──────────────────────────────────┐
│ Native: CGEventTap captures move │ (60fps batching)
│ - Position: (x, y)               │
│ - Button: left=true              │
└─────────────┬────────────────────┘
              │
              ▼
┌──────────────────────────────────┐
│ MouseEventBatcher                │ (10 events or 33ms)
│ - Batches position updates       │
│ - Reduces CPU overhead           │
└─────────────┬────────────────────┘
              │
              ▼
┌──────────────────────────────────┐
│ AdvancedShakeDetector            │ (JavaScript)
│ - Tracks position history        │
│ - Detects direction changes      │
│ - Triggers on 2+ changes in 600ms│
└─────────────┬────────────────────┘
              │
              ▼
┌──────────────────────────────────┐
│ Native: drag-monitor checks      │ (Concurrent)
│ NSPasteboard for drag            │
│ - Files present? → Yes           │
│ - Extract paths                  │
└─────────────┬────────────────────┘
              │
              ├─────────────────────────┐
              │                         │
         Shake + Files            No Shake or
              │                  No Files
              ▼                         │
   ┌─────────────────────┐              │
   │ DragShakeEvent      │              │
   │ {                   │              ▼
   │   isDragging: true  │        (Ignored)
   │   items: [...]      │
   │ }                   │
   └─────────┬───────────┘
             │
             ▼
   ┌─────────────────────────────────┐
   │ ApplicationController.            │ (Mutex protected)
   │ handleDragShakeEvent()            │
   │ - Check if shelf can be created   │
   │ - Validate drag state             │
   │ - Get mouse position              │
   └─────────┬───────────────────────┘
             │
             ▼
   ┌─────────────────────────────────┐
   │ ShelfManager.createShelf()        │
   │ - Acquire window from pool        │
   │ - Configure size/position         │
   │ - Load shelf.html                 │
   │ - Send config to renderer         │
   └─────────┬───────────────────────┘
             │
             ▼
   ┌─────────────────────────────────┐
   │ Renderer: ShelfPage component    │
   │ - Receive shelf:config IPC       │
   │ - Render file list               │
   │ - Show empty state               │
   └─────────┬───────────────────────┘
             │
             ▼
   ┌─────────────────────────────────┐
   │ SHELF VISIBLE                     │
   │ - User can drop files             │
   │ - Auto-hide scheduled (5 sec)     │
   └─────────────────────────────────┘
```

## 4. STATE MANAGEMENT ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│              Main Process State                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ApplicationController (EventEmitter)                          │
│  ├─ activeDropOperations: Set<shelfId>                       │
│  ├─ activeShelves: Set<shelfId>                              │
│  ├─ nativeDraggedFiles: Array<{path, name}>                  │
│  ├─ stateMachine: DragShelfStateMachine                       │
│  └─ timerManager: TimerManager                               │
│       └─ timers: Map<id, timeout>                            │
│                                                               │
│ ShelfManager                                                  │
│  ├─ shelves: Map<shelfId, BrowserWindow>                     │
│  ├─ shelfConfigs: Map<shelfId, ShelfConfig>                  │
│  ├─ dockPositions: Map<position, shelfId[]>                  │
│  └─ windowPool: AdvancedWindowPool                           │
│       ├─ warmPool: BrowserWindow[]                           │
│       └─ coldPool: BrowserWindow[]                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                           │
                    IPC Channel
                    (preload validation)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Renderer Process State (Zustand)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ useShelfStore (with Immer + DevTools)                        │
│  ├─ shelves: Map<shelfId, ShelfConfig>                       │
│  │   └─ ShelfConfig                                          │
│  │       ├─ id: string                                       │
│  │       ├─ position: {x, y}                                 │
│  │       ├─ items: ShelfItem[]                               │
│  │       │   └─ ShelfItem                                    │
│  │       │       ├─ id: string                               │
│  │       │       ├─ name: string                             │
│  │       │       ├─ path: string                             │
│  │       │       ├─ type: 'file'|'folder'                    │
│  │       │       └─ size?: number                            │
│  │       ├─ isPinned: boolean                                │
│  │       ├─ isVisible: boolean                               │
│  │       ├─ opacity: number                                  │
│  │       └─ mode: 'rename'                                   │
│  ├─ activeShelfId: string | null                             │
│  └─ dragOverShelfId: string | null                           │
│                                                               │
│ usePatternStore                                              │
│  ├─ patterns: Map<patternId, RenamePattern>                  │
│  └─ recent: RenamePattern[]                                  │
│                                                               │
│ useToastStore                                                │
│  └─ messages: Toast[]                                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 5. IPC COMMUNICATION MATRIX

```
┌─────────────────────────────────────────────────────────────┐
│  Main Process IPC Handlers (23 core channels)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ App Control:                                                  │
│  ├─ app:get-status → {isRunning, activeShelves, modules}    │
│  ├─ app:create-shelf → shelfId                              │
│  └─ app:update-config → success                             │
│                                                               │
│ Shelf Operations:                                             │
│  ├─ shelf:create → shelfId                                   │
│  ├─ shelf:add-item → success                                 │
│  ├─ shelf:remove-item → success                             │
│  ├─ shelf:show → success                                     │
│  ├─ shelf:hide → success                                     │
│  ├─ shelf:close → success                                    │
│  ├─ shelf:drop-start (notify)                               │
│  ├─ shelf:drop-end (notify)                                 │
│  └─ shelf:files-dropped → processed                         │
│                                                               │
│ File Operations:                                              │
│  ├─ fs:check-path-type → {file|folder|unknown}             │
│  ├─ fs:rename-file → {success, error?}                      │
│  ├─ fs:rename-files → {results: OperationResult[]}          │
│  └─ drag:get-native-files → [{path, name}]                  │
│                                                               │
│ Pattern Operations (25 channels):                             │
│  ├─ pattern:save                                             │
│  ├─ pattern:load                                             │
│  ├─ pattern:list                                             │
│  ├─ pattern:update                                           │
│  ├─ pattern:delete                                           │
│  └─ ... (20 more pattern channels)                           │
│                                                               │
│ Plugin Operations (16 channels):                              │
│  ├─ plugin:install                                           │
│  ├─ plugin:execute                                           │
│  ├─ plugin:list                                              │
│  └─ ... (13 more plugin channels)                            │
│                                                               │
│ Dialogs & System:                                             │
│  ├─ dialog:select-folder → path                             │
│  ├─ dialog:show-message-box → response                      │
│  ├─ logger:log (notify - from renderer)                     │
│  └─ logger:set-level (notify)                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 6. TIMING FLOW: Auto-Hide Logic

```
File Drop → Empty Shelf Created
    │
    └─ 500ms delay ────────────────────┐
                                       │
                                       ▼
                        Is drag still active?
                        ├─ NO: Schedule auto-hide
                        └─ YES: Skip (reschedule later)
                             │
                             ▼
                    ┌────────────────────────────┐
                    │ scheduleEmptyShelfAutoHide │ 5s
                    └────────┬───────────────────┘
                             │
                             ▼
                    ┌────────────────────────────┐
                    │ Check pre-conditions       │
                    │ - Is drag active?          │
                    │ - Has items?               │
                    │ - Is receiving drops?      │
                    │ - Is pinned?               │
                    └────────┬───────────────────┘
                             │
                    ┌────────┴──────────┐
                    │                   │
                Any condition failed   All clear
                    │                   │
                    ▼                   ▼
            (Reschedule)        ┌────────────────────┐
                                │ Hide shelf window  │
                                └────────┬───────────┘
                                         │
                                    1000ms delay
                                         │
                                         ▼
                                ┌────────────────────┐
                                │ Re-check           │
                                │ - Still empty?     │
                                │ - Still dragging?  │
                                │ - Getting drops?   │
                                └────────┬───────────┘
                                         │
                            ┌────────────┴──────────┐
                            │                       │
                        Any change       All checks pass
                            │                       │
                            ▼                       ▼
                    (Keep visible)         ┌──────────────┐
                                          │ Destroy shelf│
                                          └──────────────┘

Issues:
- Multiple delays without synchronization (500ms, 5000ms, 1000ms)
- No observable metrics for timeout state
- Timing critical - could fail on slow systems
```

## 7. MODULE DEPENDENCY GRAPH

```
┌──────────────────────────────────────────────────────────────┐
│ src/main/index.ts (Entry)                                    │
│  └─ FileCatalogerApp                                         │
│      ├─ ApplicationController                                │
│      │   ├─ MouseTracker (Native)                            │
│      │   ├─ DragShakeDetector                                │
│      │   │   ├─ AdvancedShakeDetector                        │
│      │   │   ├─ DragMonitor (Native)                         │
│      │   │   └─ MouseEventBatcher                            │
│      │   ├─ ShelfManager                                     │
│      │   │   ├─ AdvancedWindowPool                           │
│      │   │   └─ IPCRateLimiter                               │
│      │   ├─ PreferencesManager                               │
│      │   ├─ TimerManager                                     │
│      │   ├─ DragShelfStateMachine                            │
│      │   └─ KeyboardManager                                  │
│      ├─ PreferencesManager (Singleton)                       │
│      ├─ KeyboardManager                                      │
│      ├─ PerformanceMonitor                                   │
│      ├─ ErrorHandler                                         │
│      └─ Logger (Singleton)                                   │
│           └─ CircularLogBuffer                               │
│                                                               │
│ Shared Dependencies:                                          │
│  ├─ @shared/types                                            │
│  ├─ @shared/constants                                        │
│  ├─ @shared/enums                                            │
│  └─ @shared/logger                                           │
│                                                               │
│ Native Modules:                                               │
│  ├─ @native/mouse-tracker                                    │
│  │   └─ createMouseTracker()                                 │
│  └─ @native/drag-monitor                                     │
│      └─ createDragMonitor()                                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

## 8. NATIVE MODULE ARCHITECTURE

```
┌────────────────────────────────────────────────┐
│ C++ Native Module (mouse-tracker)              │
├────────────────────────────────────────────────┤
│                                                 │
│ MouseTracker (C++)                             │
│  ├─ CGEventTap (Global mouse monitor)          │
│  │   └─ Captures every mouse move              │
│  ├─ ObjectPool<MousePosition> (Memory pool)    │
│  ├─ EventListener pattern                      │
│  └─ ~79KB compiled module                      │
│                                                 │
└────────────────────────────────────────────────┘
              │ (Node.js Binding)
              ▼
┌────────────────────────────────────────────────┐
│ TypeScript Wrapper (ts/mouseTracker.ts)        │
├────────────────────────────────────────────────┤
│                                                 │
│ exports.createMouseTracker()                   │
│  └─ Returns EventEmitter instance              │
│      ├─ on('position', listener)               │
│      ├─ start()                                │
│      ├─ stop()                                 │
│      └─ isTracking(): boolean                  │
│                                                 │
└────────────────────────────────────────────────┘
              │ (JavaScript Layer)
              ▼
┌────────────────────────────────────────────────┐
│ ApplicationController integration               │
├────────────────────────────────────────────────┤
│                                                 │
│ this.mouseTracker.on('position', pos => {     │
│   dragShakeDetector.processPosition(pos)      │
│ })                                             │
│                                                 │
└────────────────────────────────────────────────┘

Build Process:
  prebuild-install (try prebuilt binaries)
    ↓ (if fails)
  electron-rebuild (compile for Electron)
    ↓ (if fails)
  Manual build (using provided binding.gyp)
```

## 9. WINDOW POOL LIFECYCLE

```
Application Start
    │
    ▼
┌─────────────────────────────────┐
│ AdvancedWindowPool created      │
│ ├─ maxWarmPool: 2               │
│ ├─ maxColdPool: 3               │
│ ├─ warmPool: []                 │
│ └─ coldPool: []                 │
└─────────┬───────────────────────┘
          │
          ▼
  Preload windows on demand
          │
    ┌─────┴──────┐
    │             │
    ▼             ▼
┌────────────┐ ┌─────────────┐
│ Warm Pool  │ │ Cold Pool   │
│ (Ready)    │ │ (Creating)  │
│ [2 max]    │ │ [3 max]     │
└────────────┘ └─────────────┘
    │             │
    └─────┬───────┘
          │
  User creates shelf
          │
          ▼
┌──────────────────────────────┐
│ shelfManager.createShelf()   │
│  └─ acquireWindow()          │
│     ├─ Try warm pool first   │
│     ├─ Move to cold pool     │
│     └─ Or create new window  │
└──────────────────────────────┘
          │
          ▼
┌──────────────────────────────┐
│ Configure & Load             │
│ ├─ Set size                  │
│ ├─ Set position              │
│ ├─ Load shelf.html           │
│ └─ Show window               │
└──────────────────────────────┘
          │
  Shelf used/closed
          │
          ▼
┌──────────────────────────────┐
│ releaseWindow()              │
│ ├─ Reset window state        │
│ ├─ Move to warm pool         │
│ └─ Or move to cold pool      │
└──────────────────────────────┘

Benefits:
- Reduces window creation latency
- Saves memory by capping total (5 max)
- Warm pool keeps frequently used windows ready
- Cold pool can be garbage collected if unused
```

## 10. CRITICAL TIMING DEPENDENCIES

```
Mouse Drag Operation Lifetime:

0ms ────────── User starts drag, shakes mouse
    │
    │ 300ms debounce (debounceTime in DragShakeDetector)
    │
    ├─────── Shake detected, shelf created
    │
    ├─ 500ms ─── Check if still dragging (critical!)
    │           └─ If drag still active: skip auto-hide
    │           └─ If drag ended: schedule auto-hide
    │
    │ (Drag continues - user drops files)
    │
    ├─ 3000ms ─── Drag end detected
    │           └─ Schedule empty shelf cleanup
    │
    ├─ 500ms ──── Clear drop operation tracking
    │
    ├─ 3000ms ─── Empty shelf cleanup delay
    │           └─ Allows drop processing to complete
    │
    ├─ 5000ms ─── Auto-hide empty shelf
    │           └─ Becomes invisible
    │
    └─ 6000ms ─── Destroy shelf if still empty
                └─ Frees memory

ISSUES:
- Total: 3000ms + 500ms + 3000ms + 5000ms = 11.5 seconds
- Multiple hardcoded delays scattered in code
- No adaptation for slow systems
- No observability of timing state
- Race conditions possible if timings overlap
```

---

## File Organization Summary

```
FileCataloger/
├── src/
│   ├── main/                          (8,000 lines)
│   │   ├── index.ts                   (939 lines)
│   │   ├── modules/
│   │   │   ├── core/
│   │   │   │   └── applicationController.ts  (1,372 lines) ⚠️
│   │   │   ├── window/
│   │   │   │   └── shelfManager.ts
│   │   │   ├── input/
│   │   │   │   ├── dragShakeDetector.ts
│   │   │   │   ├── keyboardManager.ts
│   │   │   │   └── shakeDetector.ts
│   │   │   ├── config/
│   │   │   │   ├── preferencesManager.ts
│   │   │   │   └── securityConfig.ts
│   │   │   ├── utils/
│   │   │   │   ├── logger.ts
│   │   │   │   ├── errorHandler.ts
│   │   │   │   ├── performanceMonitor.ts
│   │   │   │   ├── asyncMutex.ts
│   │   │   │   └── timerManager.ts
│   │   │   └── state/
│   │   │       └── dragShelfStateMachine.ts
│   │   └── ipc/
│   │       ├── patternHandlers.ts
│   │       └── pluginHandlers.ts
│   │
│   ├── renderer/                      (6,000 lines)
│   │   ├── stores/
│   │   │   ├── shelfStore.ts          (Zustand + Immer)
│   │   │   ├── patternStore.ts
│   │   │   └── toastStore.ts
│   │   ├── components/
│   │   │   ├── domain/                (Business logic)
│   │   │   ├── layout/                (Structural)
│   │   │   └── primitives/            (UI blocks)
│   │   ├── features/
│   │   │   └── fileRename/            (Advanced rename)
│   │   ├── pages/
│   │   │   ├── shelf/
│   │   │   ├── preferences/
│   │   │   └── plugins/
│   │   └── hooks/
│   │       └── useIPC.ts
│   │
│   ├── native/                        (2,000 lines)
│   │   ├── mouse-tracker/
│   │   │   ├── src/platform/mac/
│   │   │   │   └── mouse_tracker_mac.mm
│   │   │   └── ts/
│   │   │       └── mouseTracker.ts
│   │   └── drag-monitor/
│   │       ├── src/platform/mac/
│   │       │   └── drag_monitor_darwin.mm
│   │       └── ts/
│   │           └── dragMonitor.ts
│   │
│   ├── preload/
│   │   └── index.ts                   (275 lines - Security bridge)
│   │
│   └── shared/
│       ├── types/                     (Shared type defs)
│       ├── constants/                 (App constants)
│       └── logger/                    (Shared logger types)
│
├── config/
│   ├── webpack/
│   │   ├── webpack.common.js
│   │   ├── webpack.main.js
│   │   ├── webpack.renderer.js
│   │   ├── webpack.preload.js
│   │   └── webpack.dev.js
│   ├── tsconfig.base.json             (Shared TS config)
│   ├── tsconfig.main.json             (Main process)
│   ├── tsconfig.renderer.json         (Renderer process)
│   └── postcss.config.js
│
├── scripts/
│   ├── install-native.js              (Smart installer)
│   ├── validate-native-build.js
│   ├── test-native-modules.ts
│   └── claude-review.js
│
└── dist/                              (Build output)
    ├── main/
    ├── renderer/
    └── preload/
```

---

**Total Lines of Code (excluding node_modules)**: ~17,000
**Test Coverage**: ~2%
**Architecture Score**: B+ (Solid but with room for improvement)
