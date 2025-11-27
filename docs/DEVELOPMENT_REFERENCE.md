# FileCataloger Development Reference

**Purpose**: Quick reference for common development tasks and code navigation.

**Last Updated:** 2025-11-27

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Code Navigation](#code-navigation)
4. [Common Tasks](#common-tasks)
5. [Utilities Reference](#utilities-reference)
6. [Window Settings Reference](#window-settings-reference)
7. [Debugging Guide](#debugging-guide)

---

## Quick Start

### Development Commands

```bash
# Install dependencies (native modules build automatically)
yarn install

# Run in development mode
yarn dev

# Type checking (ALWAYS run before committing)
yarn typecheck

# Linting (ALWAYS run before committing)
yarn lint

# Build all modules
yarn build

# Run tests
yarn test
yarn test:ui
yarn test:coverage

# Code quality pipeline
yarn quality:check

# Format code
yarn format
```

### Native Module Management

```bash
# Force rebuild native modules
yarn rebuild:native

# Validate native modules
yarn test:native:validate

# Debug build issues
yarn build:native:verbose
```

---

## Project Structure

```
FileCataloger/
├── src/
│   ├── main/ (8,000 lines)
│   │   ├── index.ts (939 lines) - Entry point
│   │   ├── modules/
│   │   │   ├── core/
│   │   │   │   ├── applicationController.ts (412 lines)
│   │   │   │   ├── shelfLifecycleManager.ts (357 lines)
│   │   │   │   ├── dragDropCoordinator.ts (392 lines)
│   │   │   │   ├── autoHideManager.ts (283 lines)
│   │   │   │   └── cleanupCoordinator.ts (198 lines)
│   │   │   ├── window/
│   │   │   │   ├── shelfManager.ts (773 lines)
│   │   │   │   └── advancedWindowPool.ts (460 lines)
│   │   │   ├── input/
│   │   │   │   ├── dragShakeDetector.ts
│   │   │   │   └── keyboardManager.ts
│   │   │   ├── config/
│   │   │   │   └── preferencesManager.ts
│   │   │   └── utils/
│   │   │       ├── logger.ts
│   │   │       ├── errorHandler.ts
│   │   │       ├── performanceMonitor.ts
│   │   │       ├── asyncMutex.ts
│   │   │       └── timerManager.ts
│   │   └── ipc/
│   │       ├── patternHandlers.ts
│   │       └── pluginHandlers.ts
│   │
│   ├── renderer/ (6,000 lines)
│   │   ├── stores/
│   │   │   ├── shelfStore.ts
│   │   │   ├── patternStore.ts
│   │   │   └── componentLibraryStore.ts
│   │   ├── components/
│   │   │   ├── domain/ - Business logic components
│   │   │   ├── layout/ - Structural components
│   │   │   └── primitives/ - UI building blocks
│   │   ├── features/
│   │   │   └── fileRename/ - Advanced rename feature
│   │   ├── pages/
│   │   │   ├── shelf/
│   │   │   │   ├── shelf.html
│   │   │   │   ├── shelf.tsx
│   │   │   │   └── ShelfPage.tsx
│   │   │   └── preferences/
│   │   ├── hooks/
│   │   │   ├── useIPC.ts
│   │   │   ├── useComponentLibrary.ts
│   │   │   └── useFileRename.ts
│   │   └── utils/
│   │       ├── idGenerator.ts
│   │       ├── duplicateDetection.ts
│   │       ├── devLogger.ts
│   │       └── safeStorage.ts
│   │
│   ├── native/ (2,000 lines)
│   │   ├── mouse-tracker/
│   │   │   ├── src/platform/mac/mouse_tracker_mac.mm
│   │   │   └── ts/mouseTracker.ts
│   │   └── drag-monitor/
│   │       ├── src/platform/mac/drag_monitor_darwin.mm
│   │       └── ts/dragMonitor.ts
│   │
│   ├── preload/ (275 lines)
│   │   └── index.ts - Security bridge
│   │
│   └── shared/
│       ├── types/ - Shared TypeScript types
│       ├── constants/ - App constants
│       └── enums.ts - Shared enums
│
├── config/
│   ├── webpack/ - Build configuration
│   ├── tsconfig.*.json - TypeScript configs
│   └── postcss.config.js
│
└── dist/ - Build output
    ├── main/
    ├── renderer/
    └── preload/
```

---

## Code Navigation

### Finding Features

**File search patterns:**

```bash
# Find all stores
src/renderer/stores/**/*.ts

# Find all IPC handlers
src/main/ipc/**/*.ts

# Find React components
src/renderer/components/**/*.tsx

# Find native modules
src/native/**/*.mm
```

**Content search patterns:**

```bash
# Find IPC channel definitions
grep -r "ipcMain.handle" src/main/

# Find store actions
grep -r "set(state =>" src/renderer/stores/

# Find component usage
grep -r "useShelfStore" src/renderer/
```

### Key Code Locations

#### Shelf Creation Flow

1. **Entry**: `src/main/modules/core/applicationController.ts:70-94`
2. **Lifecycle**: `src/main/modules/core/shelfLifecycleManager.ts`
3. **Window Mgmt**: `src/main/modules/window/shelfManager.ts:113-183`
4. **Window Pool**: `src/main/modules/window/advancedWindowPool.ts:60-115`
5. **HTML Load**: `src/main/modules/window/shelfManager.ts:293-390`
6. **React Boot**: `src/renderer/pages/shelf/shelf.tsx:37-63`
7. **Main Component**: `src/renderer/pages/shelf/ShelfPage.tsx`
8. **State**: `src/renderer/stores/shelfStore.ts`

#### File Rename System

1. **UI Entry**: `src/renderer/features/fileRename/FileRenameShelf/`
2. **Pattern Builder**: `src/renderer/features/fileRename/RenamePatternBuilder/`
3. **Component Library**: `src/renderer/stores/componentLibraryStore.ts`
4. **Value Resolution**: `src/renderer/utils/componentValueResolver.ts`
5. **IPC Handlers**: `src/main/ipc/patternHandlers.ts`

#### Drag Detection

1. **Native Module**: `src/native/drag-monitor/src/platform/mac/drag_monitor_darwin.mm`
2. **TS Wrapper**: `src/native/drag-monitor/ts/dragMonitor.ts`
3. **Coordinator**: `src/main/modules/core/dragDropCoordinator.ts`
4. **Shake Detector**: `src/main/modules/input/dragShakeDetector.ts`

---

## Common Tasks

### Adding a New IPC Channel

**1. Define types** in `src/shared/types/ipc.ts`:

```typescript
export interface MyChannelRequest {
  data: string;
}

export interface MyChannelResponse {
  result: string;
}
```

**2. Add handler** in `src/main/ipc/myHandlers.ts`:

```typescript
import { ipcMain } from 'electron';

ipcMain.handle(
  'my-channel',
  async (event, request: MyChannelRequest): Promise<MyChannelResponse> => {
    // Process request
    return { result: 'processed' };
  }
);
```

**3. Whitelist** in `src/preload/index.ts`:

```typescript
const ALLOWED_CHANNELS = [
  'my-channel',
  // ... other channels
];
```

**4. Use in renderer**:

```typescript
const response = await window.api.invoke('my-channel', { data: 'test' });
console.log(response.result);
```

### Creating a New Shelf Mode

**1. Add mode** to enum in `src/shared/types/shelf.ts`:

```typescript
export enum ShelfMode {
  RENAME = 'rename',
  DISPLAY = 'display',
  YOUR_MODE = 'yourMode',
}
```

**2. Update ShelfManager** to handle mode:

```typescript
// In configureShelfWindow()
if (config.mode === ShelfMode.YOUR_MODE) {
  window.setSize(customWidth, customHeight);
}
```

**3. Create renderer components**:

```typescript
// src/renderer/pages/shelf/YourModeShelf.tsx
export const YourModeShelf: React.FC = () => {
  // Your UI implementation
};
```

**4. Update ShelfPage** conditional rendering:

```typescript
{shelf?.mode === ShelfMode.YOUR_MODE && <YourModeShelf config={shelf} />}
```

### Adding a New Utility

**1. Create utility file**:

```typescript
// src/renderer/utils/myUtility.ts
export function myUtilityFunction(input: string): string {
  // Implementation
  return processedInput;
}
```

**2. Export from index** (if using barrel exports):

```typescript
// src/renderer/utils/index.ts
export * from './myUtility';
```

**3. Use in components**:

```typescript
import { myUtilityFunction } from '@renderer/utils/myUtility';
```

### Creating a Zustand Store

**Template:**

```typescript
// src/renderer/stores/myStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface MyStore {
  items: Map<string, Item>;
  isLoading: boolean;
  error: string | null;

  // Actions
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useMyStore = create<MyStore>()(
  devtools(
    immer((set, get) => ({
      items: new Map(),
      isLoading: false,
      error: null,

      addItem: item =>
        set(state => {
          state.items.set(item.id, item);
        }),

      removeItem: id =>
        set(state => {
          state.items.delete(id);
        }),

      setLoading: loading =>
        set(state => {
          state.isLoading = loading;
        }),

      setError: error =>
        set(state => {
          state.error = error;
        }),
    })),
    { name: 'MyStore' }
  )
);
```

---

## Utilities Reference

### ID Generation

```typescript
import { generateUniqueId, generatePrefixedId } from '@renderer/utils/idGenerator';

const id = generateUniqueId(); // "550e8400-e29b-41d4-a716-446655440000"
const prefixedId = generatePrefixedId('item'); // "item-550e8400-..."
```

### Safe Storage

```typescript
import {
  getStorageItem,
  setStorageItem,
  getStorageJSON,
  setStorageJSON,
  getStorageBoolean,
  setStorageBoolean,
} from '@renderer/utils/safeStorage';

// Get with default value
const enabled = getStorageBoolean('feature-enabled', false);

// Set JSON data
const success = setStorageJSON('preferences', { theme: 'dark' });
if (!success) {
  logger.warn('Failed to save');
}
```

### Duplicate Detection

```typescript
import {
  isDuplicate,
  filterDuplicates,
  getDuplicateMessage,
} from '@renderer/utils/duplicateDetection';

// Filter duplicates
const { items, duplicateCount } = filterDuplicates(newItems, existingItems, {
  logDuplicates: true,
});

// Show user message
if (duplicateCount > 0) {
  const message = getDuplicateMessage(duplicateCount, 'shelf');
  if (message) toast.warning(message.title, message.message);
}
```

### Development Logger

```typescript
import { devLogger } from '@renderer/utils/devLogger';

// Component lifecycle
devLogger.component('MyComponent', 'mount', { props });
devLogger.component('MyComponent', 'unmount');

// State changes
devLogger.state('myStore', 'updateUser', userData);

// IPC communication
devLogger.ipc('my-channel', 'send', requestData);

// Performance timing
const endTimer = devLogger.startTimer('loadData');
await fetchData();
endTimer(); // Logs: "loadData: 234.56ms"

// Grouping
devLogger.group('Data Loading', () => {
  devLogger.debug('Step 1');
  devLogger.debug('Step 2');
});
```

### Error Boundaries

```typescript
import { FeatureErrorBoundary } from '@renderer/components/domain/FeatureErrorBoundary';

<FeatureErrorBoundary
  featureName="My Feature"
  showDetails={process.env.NODE_ENV === 'development'}
  onError={(error, info) => {
    // Optional: Custom error handling
  }}
>
  <MyFeatureComponent />
</FeatureErrorBoundary>
```

---

## Window Settings Reference

### Key File Locations

```bash
# Main Window Configuration
src/main/modules/window/shelfManager.ts:195-228

# Window Pooling
src/main/modules/window/advancedWindowPool.ts:183-218

# HTML Template
src/renderer/pages/shelf/shelf.html

# React Bootstrap
src/renderer/pages/shelf/shelf.tsx
```

### Window Configuration Presets

#### Floating Transparent Shelf (Default)

```typescript
{
  frame: false,
  transparent: true,
  backgroundColor: undefined,
  hasShadow: false,
  resizable: false,
  width: 400,
  height: 300,
  show: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  vibrancy: 'under-window',

  webPreferences: {
    preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
}
```

#### Solid Resizable Window

```typescript
{
  frame: false,
  transparent: false,
  backgroundColor: '#FFFFFF',
  hasShadow: true,
  resizable: true,
  minWidth: 300,
  maxWidth: 600,
  minHeight: 200,
  maxHeight: 500,
  width: 400,
  height: 300,

  webPreferences: {
    preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    contextIsolation: true,
    nodeIntegration: false
  }
}
```

### Size Presets

```typescript
// COMPACT
width: 250, height: 200

// DEFAULT
width: 400, height: 300

// LARGE
width: 600, height: 400

// RENAME MODE
width: 900, height: 600

// DISPLAY MODE
width: 400, height: 600
```

### Quick Fixes

**Window is black/white (not transparent):**

```typescript
// Check ALL of these:
frame: false,                 // ✓ Must be false
transparent: true,            // ✓ Must be true
backgroundColor: undefined,   // ✓ Must be undefined
// Also check React: className="bg-transparent"
```

**Can't drag window:**

```tsx
// Add to React component:
<div style={{ WebkitAppRegion: 'drag' }}>{/* Draggable area */}</div>
```

**Window flickers on show:**

```typescript
show: (false, // Create hidden
  // Then:
  window.once('ready-to-show', () => {
    window.show();
  }));
```

---

## Debugging Guide

### Development Mode Features

- Shelf windows visible immediately (no auto-hide)
- Verbose logging to console
- React DevTools enabled
- Source maps for all processes

### Log Locations

**Main Process:**

```bash
~/Library/Application Support/FileCataloger/logs/
```

**Renderer Process:**

- Browser console (open DevTools with Cmd+Option+I)

**Native Modules:**

- System console (view with Console.app)

### Common Issues

#### Shelf not appearing

- [ ] Check Accessibility permissions in System Settings
- [ ] Verify native modules loaded: `yarn test:native:validate`
- [ ] Check logs for shake detection events
- [ ] Verify window pool initialized
- [ ] Check if window is hidden behind other windows

#### Build failures

- [ ] Python required for node-gyp
- [ ] Xcode command line tools needed
- [ ] Clean and rebuild: `yarn clean && yarn install`
- [ ] Check binding.gyp configuration

#### Type errors with path aliases

- [ ] Ensure webpack aliases match tsconfig paths
- [ ] Check `config/webpack/webpack.common.js`
- [ ] Verify tsconfig extends base config

#### IPC channel not found

- [ ] Verify channel in preload whitelist
- [ ] Check exact string match (case sensitive)
- [ ] Check handler is registered in main process

#### Maximum update depth exceeded

- [ ] Check useEffect dependencies
- [ ] Look for circular dependencies
- [ ] Use refs to break update loops
- [ ] See DEBUG_NOTES.md Bug #3 for detailed fix

### Debugging Checklist

**Application Won't Start:**

- [ ] Check main process logs
- [ ] Verify native modules built
- [ ] Check for port conflicts (dev server)
- [ ] Clear node_modules and reinstall

**Window Issues:**

- [ ] Check window pool stats
- [ ] Verify React mounted without errors
- [ ] Check IPC communication working
- [ ] Verify transparency settings correct

**Performance Issues:**

- [ ] Monitor window pool size
- [ ] Check for memory leaks (event listeners)
- [ ] Profile React re-renders
- [ ] Check for timer leaks
- [ ] Monitor native module CPU usage

**IPC Communication:**

- [ ] Preload script loaded (check console)
- [ ] Channel in whitelist
- [ ] Message format matches interface
- [ ] Rate limiter not triggered
- [ ] Both processes running

---

## Testing Commands

```bash
# Run all tests
yarn test

# Run specific test file
yarn test path/to/test.spec.ts

# Run tests in watch mode
yarn test --watch

# Generate coverage report
yarn test:coverage

# UI component tests
yarn test:ui

# Native module validation
yarn test:native:validate

# Full quality check (types + lint + tests)
yarn quality:check
```

---

## Performance Monitoring

### React DevTools Profiler

1. Open DevTools (Cmd+Option+I)
2. Go to "Profiler" tab
3. Click record
4. Perform action
5. Stop recording
6. Analyze flame graph

### Memory Profiling

1. Open DevTools
2. Go to "Memory" tab
3. Take heap snapshot
4. Perform actions
5. Take another snapshot
6. Compare to find leaks

### Performance Metrics

```typescript
// Use devLogger for timing
const endTimer = devLogger.startTimer('myOperation');
await performOperation();
endTimer(); // Logs duration
```

---

## Code Patterns

### Creating a React Component

```typescript
import React, { useState, useCallback, useMemo } from 'react';

interface MyComponentProps {
  data: string;
  onAction: (id: string) => void;
}

export const MyComponent = React.memo<MyComponentProps>(({
  data,
  onAction
}) => {
  const [localState, setLocalState] = useState('');

  const handleClick = useCallback(() => {
    onAction(data);
  }, [data, onAction]);

  const computedValue = useMemo(() => {
    return expensiveComputation(data);
  }, [data]);

  return (
    <div onClick={handleClick}>
      {computedValue}
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.data === nextProps.data;
});
```

### Creating a Custom Hook

```typescript
import { useState, useEffect } from 'react';

export function useMyFeature(param: string) {
  const [state, setState] = useState<MyState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchData(param);
        if (!cancelled) {
          setState(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [param]);

  return { state, isLoading, error };
}
```

### Error Handling Pattern

```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  Logger.error('Operation failed', {
    operation: 'riskyOperation',
    error,
    context: { additionalInfo },
  });

  // Show user-friendly message
  toast.error('Operation failed', 'Please try again');

  // Return fallback
  return fallbackValue;
}
```

---

## IPC Channel Reference

### Application Control

```typescript
'app:get-status'; // → {isRunning, activeShelves, modules}
'app:create-shelf'; // → shelfId
'app:update-config'; // → success
```

### Shelf Operations

```typescript
'shelf:create'; // → shelfId
'shelf:add-item'; // → success
'shelf:remove-item'; // → success
'shelf:show'; // → success
'shelf:hide'; // → success
'shelf:close'; // → success
'shelf:files-dropped'; // → processed
```

### File Operations

```typescript
'fs:check-path-type'; // → {file|folder|unknown}
'fs:rename-file'; // → {success, error?}
'fs:rename-files'; // → {results: OperationResult[]}
'drag:get-native-files'; // → [{path, name}]
```

### Pattern Operations

```typescript
'pattern:save';
'pattern:load';
'pattern:list';
'pattern:update';
'pattern:delete';
```

---

## TypeScript Configuration

### Path Aliases

```typescript
// Available in all TypeScript files
@main/*      → src/main/*
@renderer/*  → src/renderer/*
@native/*    → src/native/*
@shared/*    → src/shared/*
```

### Configurations

- `config/tsconfig.base.json` - Shared base config (DRY principle)
- `src/main/tsconfig.json` - Main process (Node.js environment)
- `src/renderer/tsconfig.json` - Renderer & preload (Browser environment with DOM types)

---

## macOS Specific Notes

### Permissions

**Accessibility Permission Required:**

- Needed for CGEventTap (mouse tracking)
- System Settings → Privacy & Security → Accessibility
- Add FileCataloger to allowed apps

### Code Signing

**For Distribution:**

```bash
# Sign the app
yarn dist

# Notarize
# Handled automatically in release process
```

### Universal Binaries

```bash
# Build for both ARM64 and x64
yarn make:dmg  # Universal DMG

# Platform-specific
yarn dist:mac:arm64  # Apple Silicon only
yarn dist:mac:x64    # Intel only
```

---

## Build & Distribution

### Development Build

```bash
yarn dev
# Hot reload enabled
# Source maps enabled
# DevTools available
```

### Production Build

```bash
yarn build
# Minified
# Source maps for debugging
# Optimized assets
```

### Creating Distributables

```bash
# macOS DMG (Universal)
yarn make:dmg

# Complete distribution
yarn dist
```

---

## Component Library Template Packs

### Available Packs

**📦 Common Pack (7 components)**

- Date, Counter, Text, Separator, File Name, Timestamp, UUID

**💼 Business Pack (10 components)**

- Invoice #, Project, Client, Status, Priority, Due Date, Department, Category, Order #, PO #

**🎨 Creative Pack (10 components)**

- Photo #, Asset Type, Resolution, Photographer, Camera, Location, Event, Subject, Copyright, Collection

**💻 Development Pack (9 components)**

- Build #, Environment, Version, Branch, Commit, Platform, Architecture, Release, Timestamp

### Using Templates

```typescript
import { useComponentTemplates } from '@renderer/hooks/useComponentTemplates';

const { templatePacks, importTemplate } = useComponentTemplates();

// Import single template
await importTemplate('common-date');

// Import entire pack
await importTemplatePack('business-pack');
```

---

## Keyboard Shortcuts

### Global

- `Cmd+Q` - Quit application
- `Cmd+,` - Open preferences
- `Cmd+R` - Reload (development)

### Pattern Builder

- `Cmd+N` - New component (planned)
- `Cmd+S` - Save pattern (planned)
- `Esc` - Close dialogs
- `Delete` - Delete selected component (planned)

---

## Quick Decision Tree

### Need to modify window behavior?

```
What are you changing?
├─ Window appearance? → src/main/modules/window/advancedWindowPool.ts createWindow()
├─ Window position? → src/main/modules/window/shelfManager.ts getDefaultPosition()
├─ Window size? → src/main/modules/window/shelfManager.ts DEFAULT_SHELF_SIZE
└─ Content loading? → src/main/modules/window/shelfManager.ts loadShelfContent()
```

### Need to add a feature?

```
What layer?
├─ System/OS level? → Main process (src/main/)
├─ UI/Interaction? → Renderer process (src/renderer/)
├─ Both? → Add IPC communication
└─ Native performance? → Native module (src/native/)
```

### Need to fix a bug?

```
Where is it happening?
├─ Window creation/management? → See ARCHITECTURE.md
├─ React rendering? → See OPTIMIZATION_HISTORY.md
├─ Drag detection? → See DEBUG_NOTES.md Bug #5
├─ State persistence? → See DEBUG_NOTES.md Bug #1/#2
└─ Infinite loops? → See DEBUG_NOTES.md Bug #3
```

---

## Performance Targets

### Current Metrics

| Metric             | Target | Current   | Status |
| ------------------ | ------ | --------- | ------ |
| Shelf Creation     | <100ms | 50ms      | ✅     |
| IPC Latency        | <10ms  | ~50ms     | 🟡     |
| Memory (idle)      | <150MB | 50-80MB   | ✅     |
| Memory (5 shelves) | <250MB | 200-250MB | ✅     |
| CPU (idle)         | <10%   | ~5%       | ✅     |
| Bundle Size        | <1MB   | ~1.5MB    | 🟡     |
| Test Coverage      | >80%   | ~2%       | ❌     |

---

## Useful Resources

### Internal Documentation

- `ARCHITECTURE.md` - System architecture and design
- `DEBUG_NOTES.md` - Known bugs and fixes
- `OPTIMIZATION_HISTORY.md` - Optimization efforts
- `IMPLEMENTATION_GUIDE.md` - This document
- `CLAUDE.md` (project root) - Development commands

### External Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

## Tips for New Developers

1. **Start with ARCHITECTURE.md** - Understand the system design
2. **Read DEBUG_NOTES.md** - Learn from past mistakes
3. **Follow code patterns** - Consistency is key
4. **Use the utilities** - Don't reinvent the wheel
5. **Test incrementally** - Test as you build
6. **Use TypeScript strictly** - No `any` types
7. **Profile before optimizing** - Measure first
8. **Document as you go** - Future you will thank you

---

## Git Workflow

### Branching

```bash
# Create feature branch
git checkout -b feature/my-feature

# Create bugfix branch
git checkout -b fix/bug-description
```

### Committing

```bash
# Stage changes
git add .

# Commit (Claude Code will help with message)
# Message format:
# - feat: new feature
# - fix: bug fix
# - refactor: code restructuring
# - docs: documentation
# - test: adding tests
# - perf: performance improvement
```

### Before Pushing

```bash
# Run quality checks
yarn typecheck
yarn lint
yarn test

# Or run all at once
yarn quality:check
```

---

**This is a living document. Update as you discover new patterns or better approaches!**
