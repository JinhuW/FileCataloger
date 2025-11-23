# FileCataloger Window Management - Code Cross-Reference

## Core Files and Their Relationships

### 1. Entry Point: Main Process Initialization

**File**: `src/main/index.ts`

- **Lines 146-160**: `onReady()` method - starts app initialization
- **Lines 149-150**: Checks accessibility permissions
- **Lines 163+**: Creates ApplicationController

**Next**: ApplicationController initialization

---

### 2. Application Orchestration

**File**: `src/main/modules/core/application_controller.ts`

- **Lines 70-94**: `initialize()` - sets up all modules
- **Lines 99-115**: `initializeMouseTracker()` - loads native module
- **Lines 78**: `initializeManagers()` - creates specialized managers
- **Lines 81**: `setupEventRouting()` - connects event listeners

**Responsibilities**:

- Initializes ShelfManager
- Initializes ShelfLifecycleManager
- Initializes DragDropCoordinator
- Routes events between modules

**Next**: ShelfLifecycleManager and ShelfManager

---

### 3. Shelf Lifecycle Management

**File**: `src/main/modules/core/shelf_lifecycle_manager.ts`

- **Key Methods**:
  - `createShelf(config)` - initiates shelf creation
  - `destroyShelf(shelfId)` - cleans up shelf
  - `getActiveShelves()` - lists current shelves

**Orchestrates**:

- Calls ShelfManager.createShelf()
- Manages shelf state machine transitions
- Handles auto-hide logic
- Tracks active shelves

**Next**: ShelfManager

---

### 4. Window Management - ShelfManager

**File**: `src/main/modules/window/shelf_manager.ts` (773 lines)

#### Critical Methods:

##### 4.1 Create Shelf (Lines 113-183)

```typescript
public async createShelf(config: Partial<ShelfConfig> = {}): Promise<string>
```

- **Line 115**: Use Mutex to prevent race conditions
- **Line 117**: Check if shelf already exists (max 1 at a time)
- **Line 141**: Generate unique shelf ID
- **Line 144-155**: Build ShelfConfig object
- **Line 158**: `acquireWindow()` from pool
- **Line 161**: `configureShelfWindow()` sets properties
- **Line 164-166**: Store shelf references
- **Line 177**: `loadShelfContent()` loads HTML
- **Line 179**: Emit 'shelf-created' event

**Flow Path**:

```
createShelf()
  ├─ shelfCreationMutex.runExclusive()
  ├─ Generate shelfId
  ├─ Build config object
  ├─ acquireWindow() → AdvancedWindowPool.getWindow()
  ├─ configureShelfWindow(window, config)
  ├─ setupWindowEventHandlers(window, shelfId)
  ├─ loadShelfContent(window, config)
  └─ return shelfId
```

##### 4.2 Acquire Window (Lines 188-190)

```typescript
private async acquireWindow(): Promise<BrowserWindow>
```

- Delegates to AdvancedWindowPool.getWindow()
- Returns existing window or creates new one

**Next**: AdvancedWindowPool

##### 4.3 Configure Shelf Window (Lines 195-228)

```typescript
private configureShelfWindow(window: BrowserWindow, config: ShelfConfig): void
```

- **Line 197-203**: Set size based on mode (rename vs display)
- **Line 206-209**: Set position
- **Line 212-213**: Set opacity
- **Line 216-220**: Set visibility
- **Line 223-226**: Set alwaysOnTop behavior

##### 4.4 Load Shelf Content (Lines 293-390)

```typescript
private async loadShelfContent(window: BrowserWindow, config: ShelfConfig): void
```

- **Line 296**: Get renderer path (shelf.html)
- **Line 308**: `window.loadFile(rendererPath)` loads HTML
- **Line 311-329**: Setup did-finish-load handler
- **Line 328**: Send config via IPC: `'shelf:config'`
- **Line 332-340**: Show window
- **Line 345-354**: Send config again for reliability

**Key Insight**: Multiple config sends ensure React receives initial state

##### 4.5 Show/Hide Shelf (Lines 473-506)

```typescript
public showShelf(shelfId: string): boolean
public hideShelf(shelfId: string): boolean
```

- Manages window visibility
- Updates config.isVisible flag

##### 4.6 Destroy Shelf (Lines 648-693)

```typescript
public destroyShelf(shelfId: string): boolean
private destroyShelfInternal(shelfId: string, forceDestroy: boolean = false): boolean
```

- **Line 667-668**: Undock if needed
- **Line 672-679**: Handle window cleanup
  - If forceDestroy: `window.destroy()`
  - Otherwise: `releaseWindow()` to pool
- **Line 683-685**: Delete tracking maps
- **Line 687**: Emit 'shelf-destroyed' event

##### 4.7 Release Window to Pool (Lines 698-700)

```typescript
private releaseWindow(window: BrowserWindow): void
```

- Delegates to `this.windowPool.releaseWindow(window)`

**Next**: AdvancedWindowPool

---

### 5. Window Pooling - AdvancedWindowPool

**File**: `src/main/modules/window/advanced_window_pool.ts` (460 lines)

#### Critical Methods:

##### 5.1 Get Window (Lines 60-115)

```typescript
async getWindow(): Promise<BrowserWindow>
```

- **Line 62-76**: Check warm pool first
  - If available: increment usage, return
  - Warm pool = pre-initialized, ready to use
- **Line 78-93**: Check cold pool
  - If available: warm it up, return
  - Cold pool = basic windows, need HTML loading
- **Line 96-114**: Create new if pools empty
  - Create, warm up, return
- **Line 74, 91, 113**: Call `schedulePreload()` after getting window

**Performance Note**:

- Warm pool: 50ms (pre-loaded)
- Cold pool: 100ms (needs warming)
- New window: 500ms (full creation)

##### 5.2 Create Window (Lines 183-218)

```typescript
private createWindow(): BrowserWindow
```

- **Line 184-211**: Create BrowserWindow with config:
  - **Line 187-188**: 900x600 size (rename mode defaults)
  - **Line 187**: `frame: false` - no window chrome
  - **Line 188**: `transparent: true` - transparent background
  - **Line 189**: `backgroundColor: undefined` - allow transparency
  - **Line 190**: `alwaysOnTop: true` - float above everything
  - **Line 191**: `skipTaskbar: true` - hidden from taskbar
  - **Line 201**: `titleBarStyle: 'hidden'` - macOS title bar
  - **Line 202**: `trafficLightPosition: { x: 12, y: 16 }` - custom traffic lights
  - **Line 203-210**: Security settings (contextIsolation, sandbox)
- **Line 214**: `setVisibleOnAllWorkspaces(true)` - show on all desktops
- **Line 215**: `setAlwaysOnTop(true, 'floating')` - ensure floating

**Key Window Properties**:

```typescript
// VISUAL
frame: false; // No decorations
transparent: true; // Transparent background
backgroundColor: undefined; // No opaque background
hasShadow: false; // No native shadow

// BEHAVIOR
alwaysOnTop: true; // Float above other windows
skipTaskbar: true; // Hidden from taskbar
focusable: true; // Can receive focus
movable: true; // Can be dragged
closable: false; // No close button (app controls)

// SECURITY
contextIsolation: true; // Isolate preload
nodeIntegration: false; // No Node in renderer
sandbox: true; // Enable sandbox
```

**Why These Properties Make Windows "Invisible"**:

- `frame: false` removes all window chrome
- `transparent: true` makes background transparent
- `backgroundColor: undefined` enforces transparency
- Only React content is visible (opaque text/UI)

##### 5.3 Warm Up Window (Lines 223-243)

```typescript
private async warmUpWindow(pooledWindow: PooledWindow): Promise<void>
```

- **Line 232**: `window.loadFile(rendererPath)` loads shelf.html
- **Line 236**: Mark `pooledWindow.isWarm = true` after load
- Pre-loads HTML for fast reuse

**Why Warm Up?**

- First use of window must load HTML (slow)
- Subsequent uses in pool skip loading (fast)
- Warm pool = pre-warmed, ready instantly

##### 5.4 Release Window (Lines 120-178)

```typescript
releaseWindow(window: BrowserWindow): void
```

- **Line 121-132**: Get pooledWindow tracking object
- **Line 134-137**: If destroyed, skip pooling
- **Line 140**: `cleanWindowState(window)` resets properties
- **Line 143-152**: Check total pool size
  - If full: destroy window
  - If under limit: return to pool
- **Line 155-177**: Determine which pool:
  - Warm pool: if recently used or multiple uses
  - Cold pool: if not warm pool
  - Destroy: if no pool space

##### 5.5 Clean Window State (Lines 248-263)

```typescript
private cleanWindowState(window: BrowserWindow): void
```

- **Line 256**: `window.hide()` - hide from view
- **Line 257**: `window.setPosition(0, 0)` - reset position
- **Line 258**: `window.setSize(900, 600)` - reset size
- **Line 259**: `window.setOpacity(1.0)` - reset opacity
- **Line 255**: `window.removeAllListeners()` - cleanup events

**Purpose**: Reset window to neutral state before pooling

##### 5.6 Cleanup Timer (Lines 335-389)

```typescript
private startCleanupTimer(): void
private cleanup(): void
```

- **Line 340-342**: Run cleanup every 60 seconds
- **Line 351-364**: Clean up ghost windows
  - Detect destroyed windows
  - Remove from tracking
- **Line 366-378**: Clean up stale cold windows
  - Remove if older than 5 minutes
- **Line 384-388**: Log pool status

---

### 6. HTML Template - shelf.html

**File**: `src/renderer/pages/shelf/shelf.html` (31 lines)

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
          background: transparent;        // Line 15: Transparent body
          margin: 0; padding: 0;
          overflow: hidden;               // Line 18: No scrollbars
      }
      #root {
          width: 100vw;                   // Line 23: Full width
          height: 100vh;                  // Line 24: Full height
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <!-- React mounting point -->
  </body>
</html>
```

**Key Points**:

- Minimal HTML - just a root div
- Transparent background throughout
- Full viewport dimensions (100vw x 100vh)
- No scrollbars (overflow: hidden)

---

### 7. React Bootstrap - shelf.tsx

**File**: `src/renderer/pages/shelf/shelf.tsx` (64 lines)

```typescript
// Lines 16-31: Global error handlers
window.addEventListener('error', event => { /* log error */ });
window.addEventListener('unhandledrejection', event => { /* log rejection */ });

// Lines 37-63: React mounting
const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);  // Line 42
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <ShelfPage />                         // Line 48: Main component
      </ErrorBoundary>
    </React.StrictMode>
  );
}
```

**Flow**:

1. Find #root element in DOM
2. Create React root
3. Render ShelfPage component
4. ErrorBoundary catches React errors

**Next**: ShelfPage component

---

### 8. Main Page Component - ShelfPage.tsx

**File**: `src/renderer/pages/shelf/ShelfPage.tsx` (150+ lines)

```typescript
export const ShelfPage: React.FC = () => {
  // Line 33: Local state for shelf ID
  const [shelfId, setShelfId] = useState<string | null>(null);

  // Line 34: IPC hook for communication
  const { invoke, on, isConnected } = useIPC();

  // Line 37-41: Zustand store subscriptions
  const shelf = useShelfStore(state =>
    shelfId ? state.getShelf(shelfId) : null
  );
  const addShelf = useShelfStore(state => state.addShelf);

  // Line 65-85: Listen for shelf config from main process
  useEffect(() => {
    if (!isConnected) return;

    const cleanup = on('shelf:config', (newConfig: unknown) => {
      if (isShelfConfig(newConfig)) {
        // Line 80: Set shelf ID on first config
        // Line 85: Update Zustand store
        addShelf(newConfig);
      }
    });
    return cleanup;
  }, [isConnected]);

  // Conditional rendering based on mode
  return (
    <div>
      {shelf?.mode === ShelfMode.RENAME && <FileRenameShelf />}
      {shelf?.mode === ShelfMode.DISPLAY && <DisplayShelf />}
    </div>
  );
};
```

**Key Methods**:

- **useIPC()** (Line 34): Custom hook for IPC communication
  - `invoke()`: Send request to main process
  - `on()`: Listen for IPC messages
  - `isConnected`: Check if preload ready
- **useShelfStore()** (Line 37-41): Zustand store subscription
  - Returns current shelf data
  - Triggers re-render when shelf changes

**Flow**:

1. Component mounts
2. Waits for IPC 'shelf:config' message
3. Updates Zustand store with config
4. Renders appropriate UI (rename or display)

**Next**: Zustand store

---

### 9. State Management - shelfStore.ts

**File**: `src/renderer/stores/shelfStore.ts`

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

const useShelfStore = create<ShelfStore>()(
  devtools(
    immer((set, get) => ({
      shelves: new Map(),

      addShelf: (config: ShelfConfig) =>
        set(state => {
          state.shelves.set(config.id, config);
        }),

      updateShelf: (id: string, updates: Partial<Shelf>) =>
        set(state => {
          const shelf = state.shelves.get(id);
          if (shelf) {
            state.shelves.set(id, { ...shelf, ...updates });
          }
        }),

      addItemToShelf: (id: string, item: ShelfItem) =>
        set(state => {
          const shelf = state.shelves.get(id);
          if (shelf) {
            shelf.items.push(item);
          }
        }),

      removeItemFromShelf: (id: string, itemId: string) =>
        set(state => {
          const shelf = state.shelves.get(id);
          if (shelf) {
            shelf.items = shelf.items.filter(item => item.id !== itemId);
          }
        }),
    }))
  )
);
```

**Design Choices**:

- **Map<shelfId, Shelf>**: O(1) lookups
- **Immer**: Immutable updates with mutable syntax
- **devtools**: Redux DevTools integration

---

### 10. IPC Communication Flow

#### Main → Renderer

**File**: `src/main/modules/window/shelf_manager.ts`

**Line 328**: Send config after loading

```typescript
window.webContents.send('shelf:config', config);
```

**Line 566**: Send after adding items

```typescript
window.webContents.send('shelf:config', config);
window.webContents.send('shelf:item-added', item);
```

**Line 606**: Send after removing items

```typescript
window.webContents.send('shelf:item-removed', itemId);
```

#### Renderer Listener

**File**: `src/renderer/pages/shelf/ShelfPage.tsx`

**Line 68**: Listen for config updates

```typescript
const cleanup = on('shelf:config', (newConfig: unknown) => {
  if (isShelfConfig(newConfig)) {
    addShelf(newConfig); // Update Zustand store
  }
});
```

---

### 11. Window Lifecycle Event Handlers

**File**: `src/main/modules/window/shelf_manager.ts`, Lines 257-288

```typescript
private setupWindowEventHandlers(window: BrowserWindow, shelfId: string): void {
  // Line 259-261: Console messages
  window.webContents.on('console-message', (_event, _level, message) => {
    this.logger.debug(`[Shelf ${shelfId}] ${message}`);
  });

  // Line 264-266: Window closed
  window.on('closed', () => {
    this.handleWindowClosed(shelfId);
  });

  // Line 269-271: Window moved
  window.on('moved', () => {
    this.handleWindowMoved(shelfId);
  });

  // Line 274-276: Window resized
  window.on('resized', () => {
    this.handleWindowResized(shelfId);
  });

  // Line 279-281: Window focus
  window.on('focus', () => {
    this.emit('shelf-focused', shelfId);
  });

  // Line 283-287: Window blur
  window.on('blur', () => {
    this.emit('shelf-blurred', shelfId);
  });
}
```

---

## Summary: Code Execution Path

### From User Action to Window Display

```
1. User shakes mouse during drag
   └─ DragShakeDetector (src/main/modules/input/)

2. Shake event detected
   └─ DragDropCoordinator.handleDragShake()

3. Shelf creation requested
   └─ ShelfLifecycleManager.createShelf()

4. Shelf creation started
   └─ ShelfManager.createShelf() [Line 113]
      ├─ Mutex prevents duplicate [Line 115]
      ├─ Generate shelf ID [Line 141]
      ├─ Build config [Line 144-155]
      ├─ acquireWindow() [Line 158]
      │  └─ AdvancedWindowPool.getWindow() [Line 60]
      │     ├─ Check warm pool [Line 62-76]
      │     ├─ Check cold pool [Line 78-93]
      │     └─ Create if needed [Line 96-114]
      │        └─ createWindow() [Line 183]
      │           └─ new BrowserWindow({ frame: false, transparent: true, ... })
      ├─ configureShelfWindow() [Line 161]
      │  ├─ setSize() [Line 199-202]
      │  ├─ setPosition() [Line 209]
      │  ├─ setOpacity() [Line 212]
      │  └─ show() [Line 217]
      ├─ setupWindowEventHandlers() [Line 174]
      └─ loadShelfContent() [Line 177]
         ├─ window.loadFile(shelf.html) [Line 308]
         ├─ window.webContents.send('shelf:config', config) [Line 328]
         └─ window.show() [Line 334]

5. HTML loads, React bootstraps
   └─ shelf.tsx [Entry point]
      ├─ Mount React to #root [Line 42]
      └─ Render ShelfPage component [Line 48]

6. ShelfPage receives IPC config
   └─ useIPC().on('shelf:config', ...) [Line 68]
      └─ addShelf(config) → Zustand store [Line 85]

7. Zustand store updates
   └─ useShelfStore state updated [shelfStore.ts]
      └─ Triggers React re-render

8. React renders UI
   └─ ShelfPage renders based on mode
      ├─ If rename: <FileRenameShelf />
      └─ If display: <DisplayShelf />

9. Window is visible
   └─ React components styled with Tailwind CSS
      └─ Transparent window shows only styled content
```

---

## Key Files Quick Reference

| Component      | File                                             | Lines   | Purpose                |
| -------------- | ------------------------------------------------ | ------- | ---------------------- |
| App Entry      | src/main/index.ts                                | 146-160 | Initialize app         |
| Orchestrator   | src/main/modules/core/application_controller.ts  | 70-94   | Coordinate modules     |
| Lifecycle      | src/main/modules/core/shelf_lifecycle_manager.ts | N/A     | Manage shelf lifecycle |
| Window Manager | src/main/modules/window/shelf_manager.ts         | 113-773 | Create/manage windows  |
| Window Pool    | src/main/modules/window/advanced_window_pool.ts  | 60-178  | Reuse windows          |
| HTML           | src/renderer/pages/shelf/shelf.html              | 1-31    | Window template        |
| React Boot     | src/renderer/pages/shelf/shelf.tsx               | 1-64    | Mount React app        |
| Main Page      | src/renderer/pages/shelf/ShelfPage.tsx           | 30-100+ | Primary component      |
| State          | src/renderer/stores/shelfStore.ts                | N/A     | Zustand store          |
