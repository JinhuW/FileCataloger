# FileCataloger Window Management Architecture - Documentation Index

This folder contains comprehensive documentation of FileCataloger's window management system.

## Quick Start

Start with one of these documents based on your needs:

### For Quick Overview

**File**: `WINDOW_ARCHITECTURE_SUMMARY.txt`

- Fast overview of how windows are created and managed
- Visual flow diagrams
- Key architectural decisions
- Quick reference for common tasks

### For Detailed Understanding

**File**: `WINDOW_MANAGEMENT_ARCHITECTURE.md`

- Comprehensive explanation of the two-layer architecture
- Why windows appear "invisible"
- State management flow
- Performance optimizations
- Debugging guide

### For Code Navigation

**File**: `WINDOW_CODE_CROSS_REFERENCE.md`

- Line-by-line code references
- File locations and purposes
- Method-by-method breakdown
- Complete execution path from user action to display
- IPC communication patterns

---

## Key Concepts

### The Two-Layer Architecture

FileCataloger uses a unique approach:

1. **Layer 1: Electron Windows (Invisible Container)**
   - Created by Electron as BrowserWindows
   - `frame: false` removes all decorations
   - `transparent: true` makes background invisible
   - Only provides OS-level window management
   - Located in `src/main/modules/window/`

2. **Layer 2: React UI (Visible Content)**
   - React components render the actual visual interface
   - Tailwind CSS provides styling
   - Zustand manages state
   - Located in `src/renderer/`

### Why "Invisible"?

The Electron window itself is invisible. It's just a transparent container. Only the React-rendered content is visible.

Configuration that makes it invisible:

- `frame: false` - No title bar, no decorations
- `transparent: true` - Transparent background
- `backgroundColor: undefined` - No opaque background
- `hasShadow: false` - No shadow

Result: Users see a floating, frameless UI that feels like a native macOS app.

### Window Pooling Strategy

Instead of destroying windows, FileCataloger reuses them:

- **Warm Pool**: 2 pre-initialized windows (50ms to get)
- **Cold Pool**: 3 basic windows (100ms to get + warmup)
- **Total Limit**: 5 windows maximum

Benefits:

- 90% faster window creation (500ms → 50ms)
- Lower memory usage
- Instant shelf appearance

---

## File Structure

### Main Process (Window Management)

```
src/main/modules/window/
├── shelf_manager.ts (377 lines)
│   ├── createShelf(): Create new shelf window
│   ├── configureShelfWindow(): Set window properties
│   ├── loadShelfContent(): Load HTML and send IPC
│   ├── destroyShelf(): Cleanup and pooling
│   └── Event handlers: moved, resized, focus, blur
│
└── advanced_window_pool.ts (460 lines)
    ├── getWindow(): Retrieve from pool
    ├── createWindow(): Create new BrowserWindow
    ├── warmUpWindow(): Pre-load HTML
    ├── releaseWindow(): Return to pool
    └── cleanup(): Garbage collection
```

### Renderer Process (UI)

```
src/renderer/
├── pages/shelf/
│   ├── shelf.html (31 lines)
│   │   └── Minimal HTML with transparent body
│   │
│   ├── shelf.tsx (64 lines)
│   │   └── React bootstrap code
│   │
│   └── ShelfPage.tsx (150+ lines)
│       ├── IPC listeners
│       ├── Zustand store subscription
│       └── Conditional rendering
│
└── stores/
    └── shelfStore.ts
        └── Zustand state management
```

---

## Common Workflows

### Understanding How Shelf Creation Works

1. Open `WINDOW_CODE_CROSS_REFERENCE.md`
2. Find the "Summary: Code Execution Path" section
3. Follow the execution flow from step 1 (user shakes) to step 9 (window visible)
4. Cross-reference with actual code using line numbers

### Debugging Window Issues

1. Consult `WINDOW_MANAGEMENT_ARCHITECTURE.md` → "Debugging Window Issues" section
2. Check main process logs: `~/Library/Application Support/FileCataloger/logs/`
3. Use the checklist in `WINDOW_ARCHITECTURE_SUMMARY.txt` → "Debugging Checklist"
4. Review specific file implementation in `WINDOW_CODE_CROSS_REFERENCE.md`

### Modifying Window Behavior

1. Identify what you want to change:
   - Window appearance? → Look in `advanced_window_pool.ts` `createWindow()`
   - Window position? → Look in `shelf_manager.ts` `getDefaultPosition()`
   - Window size? → Look in `shelf_manager.ts` `DEFAULT_SHELF_SIZE`
   - Content loading? → Look in `shelf_manager.ts` `loadShelfContent()`

2. Find the exact lines in `WINDOW_CODE_CROSS_REFERENCE.md`
3. Make changes and test

### Adding a New Window Feature

1. Determine if it's Electron-level (main process) or UI-level (renderer)
2. For main process: Modify `shelf_manager.ts` or `advanced_window_pool.ts`
3. For renderer: Modify `ShelfPage.tsx` or create new component
4. If both: Use IPC to communicate (example in `WINDOW_CODE_CROSS_REFERENCE.md`)

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

## IPC Communication Patterns

### Main → Renderer

**shelf:config** - Send after creating shelf or updating contents

```
ShelfManager.createShelf() → window.webContents.send('shelf:config', config)
→ ShelfPage receives via useIPC().on('shelf:config', ...)
→ Updates Zustand store
→ React re-renders
```

### Renderer → Main

**shelf:files-dropped** - When user drops files on shelf

```
FileRenameShelf component → window.electronAPI.shelf.filesDropped(shelfId, items)
→ IPC channel handler in src/main/index.ts
→ ShelfManager.addItemToShelf()
→ Send updated config back to renderer
```

---

## State Flow Diagram

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
    │ FileRenameShelf displays current shelf items
    │ Tailwind CSS styling applied
    │ Window shows new content
```

---

## Key Insights

1. **Transparency is Everything**: The invisible window is a feature, not a bug. It allows custom UI without Electron's default window decorations.

2. **Pooling Saves Time**: Pre-creating and reusing windows cuts response time 90%. This is critical for the shake gesture UX.

3. **Two-Process Communication**: Main process handles OS stuff, renderer handles UI. IPC bridges them seamlessly.

4. **Zustand for Simplicity**: Map-based storage with Immer provides fast lookups and immutable updates.

5. **Modularity Works**: Each module (ShelfManager, AdvancedWindowPool, etc.) has one job. Easy to understand and maintain.

---

## Related Documentation

- **Project README**: `../../README.md` - Overview of FileCataloger
- **Main Process CLAUDE.md**: `src/main/CLAUDE.md` - Main process architecture
- **Renderer CLAUDE.md**: `src/renderer/CLAUDE.md` - Renderer process architecture
- **Development Guide**: `../../CLAUDE.md` - How to develop and test

---

## Questions Answered

### How are shelf windows created and managed?

See `WINDOW_MANAGEMENT_ARCHITECTURE.md` → "Window Creation Architecture"

### Why do windows appear invisible?

See `WINDOW_MANAGEMENT_ARCHITECTURE.md` → "Why Windows Appear 'Invisible'"

### What is the relationship between main process and renderer?

See `WINDOW_MANAGEMENT_ARCHITECTURE.md` → "The Key Insight: Two-Layer Architecture"

### How does window pooling work?

See `WINDOW_ARCHITECTURE_SUMMARY.txt` → "Window Pooling Strategy"

### What's the complete code path from user action to display?

See `WINDOW_CODE_CROSS_REFERENCE.md` → "Summary: Code Execution Path"

### How are windows configured?

See `WINDOW_CODE_CROSS_REFERENCE.md` → "Section 5: Window Pooling - AdvancedWindowPool" → "5.2 Create Window"

### Where is the React UI mounted?

See `WINDOW_CODE_CROSS_REFERENCE.md` → "Section 7: React Bootstrap" and "Section 8: Main Page Component"

---

## Next Steps

1. **For Development**: Start with the code cross-reference and follow the execution path
2. **For Understanding**: Read the full architecture document and then the summary
3. **For Debugging**: Use the checklist and code references to locate the issue
4. **For Modifications**: Find the relevant section in the code reference and make changes

---

**Last Updated**: 2025-11-02  
**Scope**: Window management and architecture  
**Related**: src/main/modules/window/, src/renderer/pages/shelf/
