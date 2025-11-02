# FileCataloger Window Management Architecture Analysis

## Executive Summary

FileCataloger uses a sophisticated two-layer window architecture combining **Electron BrowserWindows** (main process) with **React UI** (renderer processes). Windows appear "invisible" because they are created with `transparent: true`, `frame: false`, and no native window decorations. The UI is built entirely in React/Tailwind CSS, creating a floating, frameless shelf that sits on top of the Electron window infrastructure.

---

## Window Creation Architecture

### 1. High-Level Window Flow

```
ApplicationController (Main Process)
    ↓
ShelfLifecycleManager (Orchestration)
    ↓
ShelfManager (Window Management)
    ↓
AdvancedWindowPool (Performance Optimization)
    ↓
BrowserWindow (Electron)
    ↓
shelf.html (HTML Template)
    ↓
React App → ShelfPage Component
    ↓
Zustand Store (State Management)
    ↓
FileRenameShelf UI (React Components)
```

### 2. Window Pooling Strategy

FileCataloger implements an **AdvancedWindowPool** to optimize window creation:

```typescript
class AdvancedWindowPool {
  private warmPool: PooledWindow[] = []; // Pre-initialized, ready to use
  private coldPool: PooledWindow[] = []; // Basic windows, need loading
  private inUseWindows = new Map<>(); // Currently active windows

  maxWarmPool: 2; // Up to 2 fully initialized windows
  maxColdPool: 3; // Up to 3 basic windows
  maxTotalPool: 5; // Total max 5 pooled windows
}
```

**Why Pooling?**

- **Cold start**: Creating new window = 500ms
- **Pooled reuse**: Getting from pool = 50ms
- **Improvement**: 90% faster window reuse

### 3. Window Configuration

Windows are created with specific properties that make them "invisible":

```typescript
const window = new BrowserWindow({
  width: 900, // Dynamic based on mode (rename vs display)
  height: 600,

  // Visual appearance
  frame: false, // No window chrome/decorations
  transparent: true, // Transparent background
  backgroundColor: undefined, // Allow transparency
  hasShadow: false, // No native shadow

  // Window behavior
  alwaysOnTop: true, // Float above all windows
  skipTaskbar: true, // Don't show in taskbar
  resizable: true, // Allow resizing
  minimizable: false, // No minimize button
  maximizable: false, // No maximize button
  closable: false, // No close button (managed by app)
  focusable: true, // Can receive focus
  movable: true, // Can be dragged
  acceptFirstMouse: true, // Click to activate

  // macOS specific
  titleBarStyle: 'hidden', // Hide title bar
  trafficLightPosition: { x: 12, y: 16 }, // Custom traffic light position
  setVisibleOnAllWorkspaces: true, // Show on all desktops

  // Security
  webPreferences: {
    contextIsolation: true, // Isolate preload script from renderer
    nodeIntegration: false, // Disable Node.js in renderer
    sandbox: true, // Enable sandbox
    preload: 'path/to/preload.js',
    webSecurity: true,
    webviewTag: false,
  },
});

// Additional configuration
window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
window.setAlwaysOnTop(true, 'floating');
```

---

## Why Windows Appear "Invisible"

### Visual Invisibility

1. **No Frame**: `frame: false` removes all window chrome
   - No title bar
   - No minimize/maximize/close buttons
   - No border
   - No native window decorations

2. **Transparent Background**: `transparent: true` + `backgroundColor: undefined`
   - Window has no opaque background
   - Only React-rendered content is visible
   - Can see through to desktop/other windows

3. **No Shadow**: `hasShadow: false`
   - No native macOS window shadow
   - Custom shadow added via CSS/Tailwind if needed

4. **Size Flexibility**: Dynamic sizing based on content
   - Rename mode: 900x600
   - Display mode: 400x600
   - Content determines what you see

### Behavioral Invisibility

- **skipTaskbar: true** - Not in taskbar, not in app switcher
- **alwaysOnTop: true** - Floats above everything (Finder, browsers, etc.)
- **focusable: true** - Can still interact (click, type, drag files)
- **closable: false** - App controls visibility, not user's close button

---

## React UI Layer on Top

### Entry Point: shelf.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FileCataloger Shelf</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
          background: transparent;        // Transparent body
          margin: 0;
          padding: 0;
          overflow: hidden;               // No scrollbars
          font-family: system fonts;
      }
      #root {
          width: 100vw;                   // Full viewport
          height: 100vh;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

### React Rendering: shelf.tsx

```typescript
// Bootstrap React application
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ShelfPage />
    </ErrorBoundary>
  </React.StrictMode>
);
```

### Main Component: ShelfPage.tsx

```typescript
export const ShelfPage: React.FC = () => {
  // Gets shelf configuration from main process via IPC
  const [shelfId, setShelfId] = useState<string | null>(null);
  const { invoke, on, isConnected } = useIPC();

  // Zustand store for state management
  const shelf = useShelfStore(state =>
    shelfId ? state.getShelf(shelfId) : null
  );

  // Listen for IPC messages from main process
  useEffect(() => {
    const cleanup = on('shelf:config', (newConfig: unknown) => {
      if (isShelfConfig(newConfig)) {
        // Update Zustand store with new config
        addShelf(newConfig);
      }
    });
    return cleanup;
  }, []);

  // Render based on shelf mode
  if (!shelf) return <div>Loading...</div>;

  return (
    <div className="shelf-container">
      {shelf.mode === ShelfMode.RENAME && <FileRenameShelf />}
      {shelf.mode === ShelfMode.DISPLAY && <DisplayShelf />}
    </div>
  );
};
```

---

## Communication Flow: Main Process → Renderer

### Window Lifecycle

```
1. User shakes mouse while dragging files
   ↓
2. DragDropCoordinator detects drag-shake
   ↓
3. ShelfLifecycleManager.createShelf() called
   ↓
4. ShelfManager.acquireWindow() gets window from pool
   ↓
5. loadShelfContent() loads shelf.html into window
   ↓
6. window.webContents.send('shelf:config', config)
   ↓
7. Preload script receives IPC message
   ↓
8. React component updates Zustand store
   ↓
9. React rerenders with files
   ↓
10. window.show() makes visible
```

### IPC Communication Pattern

```
Main Process (ShelfManager)
    ↓
window.webContents.send('shelf:config', ShelfConfig)
    ↓
Preload Script (src/preload/index.ts)
    ↓
window.electronAPI.shelf.onConfigUpdate(callback)
    ↓
React Component (ShelfPage)
    ↓
Zustand Store (shelfStore)
    ↓
React Rerender
    ↓
UI Updates (FileRenameShelf)
```

---

## The Key Insight: Two-Layer Architecture

### Layer 1: Electron Window (Main Process)

```
BrowserWindow
├── frame: false → No visible window frame
├── transparent: true → Transparent background
├── alwaysOnTop: true → Float above everything
├── skipTaskbar: true → Hidden from taskbar
└── webContents → Loads HTML/React content
```

**Purpose**: Provide the OS-level window container that can be positioned, moved, and sized.

### Layer 2: React UI (Renderer Process)

```
HTML (shelf.html)
├── body { background: transparent }
├── #root div (100vw × 100vh)
└── React App (ShelfPage)
    ├── Zustand Store
    ├── IPC Communication
    └── UI Components (Tailwind CSS)
```

**Purpose**: Render all visual content as transparent-background React components.

### Result

- The Electron window is invisible (no frame, transparent background)
- Only the React-rendered UI is visible (Tailwind-styled components)
- The shelf appears to be a "floating UI" but it's actually:
  - Powered by an invisible Electron BrowserWindow
  - Filled with React components
  - Styled with Tailwind CSS
  - Positioned by the main process

---

## State Management: Zustand Store

```typescript
interface Shelf {
  id: string;
  position: { x: number; y: number };
  items: ShelfItem[];
  mode: ShelfMode;
  isVisible: boolean;
  isPinned: boolean;
  opacity: number;
  dockPosition: DockPosition | null;
}

interface ShelfStore {
  shelves: Map<string, Shelf>;

  // Actions
  addShelf: (config: ShelfConfig) => void;
  updateShelf: (id: string, updates: Partial<Shelf>) => void;
  addItemToShelf: (id: string, item: ShelfItem) => void;
  removeItemFromShelf: (id: string, itemId: string) => void;
  getShelf: (id: string) => Shelf | undefined;
}

const useShelfStore = create<ShelfStore>()(
  devtools(
    immer((set, get) => ({
      shelves: new Map(),
      addShelf: config =>
        set(state => {
          state.shelves.set(config.id, config);
        }),
      // ... other actions
    }))
  )
);
```

**Why Map-based storage?**

- O(1) lookups by shelf ID
- Efficient updates
- Handles multiple shelves (though limited to 1 active at a time)

---

## Window Lifecycle Events

### Creation → Display

```
ShelfManager.createShelf()
├── acquireWindow() → Gets from pool
├── configureShelfWindow() → Sets size, position, opacity
├── setupWindowEventHandlers()
│   ├── 'closed' → cleanup
│   ├── 'moved' → update position
│   ├── 'resized' → update size
│   ├── 'focus' → emit event
│   └── 'blur' → emit event
├── loadShelfContent() → Load shelf.html
│   ├── window.loadFile(shelf.html)
│   ├── window.webContents.send('shelf:config', config)
│   └── window.show()
└── return shelfId
```

### Hiding (Pooling Back)

```
ShelfManager.destroyShelf(shelfId)
├── undockShelf() if docked
├── releaseWindow() → Return to pool
│   ├── cleanWindowState()
│   │   ├── window.hide()
│   │   ├── window.setPosition(0, 0)
│   │   ├── window.setSize(900, 600)
│   │   └── window.setOpacity(1.0)
│   └── Add to warm/cold pool
├── Delete configs
└── Delete from activeShelves
```

### Cleanup (Timers)

```
ShelfManager.destroy()
├── Destroy all pooled windows
├── Clear all listeners
└── Stop cleanup timers
```

---

## Why This Architecture?

### Benefits

1. **Performance**: Window pooling reduces 500ms → 50ms creation time
2. **Memory Efficient**: Reuses windows instead of destroying/recreating
3. **Responsive**: Shake gesture immediately shows window
4. **Modern UI**: React + Tailwind for polished interface
5. **OS Integration**: Electron provides native OS window features
6. **Security**: Context isolation, sandboxing, IPC validation
7. **Flexibility**: Easy to add/remove features in React

### Trade-offs

1. **Complexity**: Two-layer architecture requires coordination
2. **IPC Overhead**: Communication between main/renderer processes
3. **Reload on Files**: Window content reloads when files dropped (optimizable)
4. **Keyboard Input**: Window must have focus for keyboard shortcuts

---

## Key Configuration Files

### 1. Window Pool Configuration (ShelfManager)

```typescript
this.windowPool = new AdvancedWindowPool({
  maxWarmPool: 2, // Pre-initialized windows
  maxColdPool: 3, // Basic windows
  maxTotalPool: 5, // Max total windows
  preloadThreshold: 1, // Preload when below 1 warm window
});
```

### 2. Webpack Renderer Configuration

```javascript
entry: {
  shelf: 'src/renderer/pages/shelf/shelf.tsx',
  preferences: 'src/renderer/pages/preferences/preferences.ts',
  demo: 'src/renderer/pages/demo/demo.tsx'
},

output: {
  path: 'dist/renderer',
  filename: '[name].js'
},

plugins: [
  new HtmlWebpackPlugin({
    template: 'src/renderer/pages/shelf/shelf.html',
    filename: 'shelf.html',
    chunks: ['shelf']
  })
]
```

### 3. TypeScript Configuration (Renderer)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "paths": {
      "@renderer/*": ["src/renderer/*"],
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/renderer/**/*"]
}
```

---

## Debugging Window Issues

### Window Not Appearing?

1. Check if window pool initialized
2. Verify shake detection triggered
3. Check shelf.html loading
4. Verify React mounting succeeded
5. Check window.show() called

### Window Appearing Invisible?

1. Check transparent: true setting (correct)
2. Check React content rendering
3. Verify Tailwind CSS loaded
4. Check if z-index issues (alwaysOnTop should handle)

### Performance Issues?

1. Monitor window pool stats
2. Check for window leaks
3. Verify event listeners cleaned up
4. Monitor React re-renders

### IPC Communication Failing?

1. Check preload script loaded
2. Verify IPC channel in whitelist
3. Check console for errors
4. Verify payload format

---

## Code Flow Example: File Drop

```
User drops files on shelf window
    ↓
React onDrop handler (FileRenameShelf)
    ↓
window.electronAPI.shelf.filesDropped(shelfId, files)
    ↓
IPC channel: 'shelf:files-dropped'
    ↓
Main process handler (src/main/index.ts)
    ↓
ShelfManager.addItemToShelf(shelfId, item)
    ↓
Config updated in shelfConfigs Map
    ↓
window.webContents.send('shelf:config', updatedConfig)
    ↓
React receives IPC event
    ↓
Zustand store updates
    ↓
ShelfPage rerenders
    ↓
FileRenameShelf displays new files
    ↓
User sees files in shelf UI
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Process (Node.js)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ApplicationController                                      │
│  ├── ShelfLifecycleManager                                 │
│  ├── DragDropCoordinator                                   │
│  ├── AutoHideManager                                       │
│  └── ShelfManager                                          │
│      ├── AdvancedWindowPool                                │
│      │   ├── Warm Pool (2 windows)                         │
│      │   ├── Cold Pool (3 windows)                         │
│      │   └── In-Use Map                                    │
│      └── BrowserWindow Manager                             │
│          ├── window.hide/show()                             │
│          ├── window.setPosition()                           │
│          └── window.setSize()                               │
│                                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                    IPC Bridge
                         │
┌────────────────────────┴────────────────────────────────────┐
│              Renderer Process (Chromium + React)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  shelf.html (transparent background)                       │
│      └── React Root                                         │
│          └── ShelfPage                                      │
│              ├── useIPC() hook                              │
│              ├── Zustand shelfStore                         │
│              └── Conditional Rendering                      │
│                  ├── FileRenameShelf (Rename Mode)         │
│                  └── DisplayShelf (Display Mode)            │
│                      ├── FileDropZone (Tailwind)           │
│                      ├── ShelfItemList (Virtualized)        │
│                      └── EmptyState (Fallback UI)           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

FileCataloger's window architecture uses:

1. **Invisible Electron Windows** - Created with `frame: false` and `transparent: true`
2. **React UI Layer** - All visual content rendered in React components
3. **Window Pooling** - 5 windows max, warm/cold pool strategy for performance
4. **IPC Communication** - Main process sends config, renderer updates UI
5. **Zustand State** - Client-side state management for shelf data
6. **Tailwind CSS** - Styling for the React components

The "invisibility" is achieved by stripping away all window chrome and using transparent backgrounds, allowing only the React-rendered UI to be visible. This creates a modern, custom-styled floating window that feels lightweight and responsive while leveraging Electron's OS-level window management capabilities.
