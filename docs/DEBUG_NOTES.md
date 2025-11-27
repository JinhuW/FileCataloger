# FileCataloger Debug Notes

**Purpose**: Document bugs and their fixes to prevent recurring issues.

**Last Updated:** 2025-11-27

---

## Table of Contents

1. [Bug #1: Component Template Import Not Persisting](#bug-1-component-template-import-not-persisting)
2. [Bug #2: Pattern Component Instances Not Persisting](#bug-2-pattern-component-instances-not-persisting)
3. [Bug #3: Maximum Update Depth Exceeded](#bug-3-maximum-update-depth-exceeded)
4. [Bug #4: Shelf Disappearing During Drag](#bug-4-shelf-disappearing-during-drag)
5. [Bug #5: Click+Shake False Positives](#bug-5-clickshake-false-positives)
6. [Bug #6: Drag Session Duplicate Shelves](#bug-6-drag-session-duplicate-shelves)

---

## Bug #1: Component Template Import Not Persisting

**Fixed:** 2025-11-09

### Problem

When users tried to add components from the Browse Templates section (e.g., Department component from Business Pack), the components were added to the in-memory store but were not saved to disk. This resulted in:

- Components appearing in the library temporarily during the session
- Components disappearing after app restart
- User frustration with losing their component selections

### Root Cause

The `importTemplate()` function in `/src/renderer/hooks/useComponentTemplates.ts` was adding components to the Zustand store using `store.addComponent(template)` but was NOT calling the IPC handler to save the updated component library to disk via `window.electronAPI.invoke('component:save-library', updatedComponents)`.

In contrast, the `createComponent()` function in `/src/renderer/hooks/useComponentLibrary.ts` correctly called `saveToPreferences()` after adding components.

### Files Modified

1. `/src/renderer/hooks/useComponentTemplates.ts`
   - Made `importTemplate()` async
   - Added persistence call after `store.addComponent()`
   - Added error handling for failed saves

2. `/src/renderer/features/fileRename/ComponentLibrary/TemplatePackSection.tsx`
   - Made `handleImportTemplate()` async to handle the promise from `importTemplate()`

3. `/src/renderer/hooks/useComponentTemplates.ts` (second change)
   - Made `importTemplatePack()` async for consistency
   - Added persistence call after batch importing components

### Code Pattern to Follow

**Always persist after modifying the component library:**

```typescript
// CORRECT: Add component and save
store.addComponent(component);
const updatedComponents = store.getAllComponents();
const result = await window.electronAPI.invoke('component:save-library', updatedComponents);

// WRONG: Add component without saving
store.addComponent(component);
// Missing save call - component will be lost on restart!
```

### Prevention

- Always check if state-modifying operations include persistence
- Look for patterns where `store.addComponent()`, `store.updateComponent()`, or `store.deleteComponent()` are called without a corresponding save operation
- Use the `createComponent()`, `updateComponent()`, `deleteComponent()` methods from `useComponentLibrary` hook when possible, as they include persistence

### Testing Checklist

- [ ] Add component and verify it appears in the library
- [ ] Restart the application
- [ ] Verify the component still exists in the library
- [ ] Check developer console for any save-related errors

---

## Bug #2: Pattern Component Instances Not Persisting

**Fixed:** 2025-11-10

### Problem

When users created a new pattern and added components to it, the components would appear in the preview but would disappear when:

- Switching to another pattern and back
- Restarting the application
- Closing and reopening the pattern builder

This resulted in users losing all their work when building custom naming patterns.

### Root Cause

The pattern component instances were stored in LOCAL React state only (line 76 in `RenamePatternBuilder.tsx`) and were NEVER saved to the pattern store or persisted to disk.

**The flow was:**

1. User creates new pattern → Pattern saved with empty `components: []`
2. User adds components → Only local `instances` state updated (NO PERSISTENCE)
3. User switches pattern → Pattern loaded from disk with empty components → COMPONENTS DISAPPEAR

The `addComponentInstance()` function (line 165-198) only updated local state:

```typescript
// WRONG: Only updates local state
setInstances(prev => [...prev, newInstance]);
// Missing: No pattern update or persistence call!
```

### Files Modified

1. `/src/renderer/features/fileRename/RenamePatternBuilder/RenamePatternBuilder.tsx` (line 139-162)
   - Updated pattern loading effect to properly load instances from pattern components
   - Added support for both legacy RenameComponent and new ComponentInstance formats

2. `/src/renderer/features/fileRename/RenamePatternBuilder/RenamePatternBuilder.tsx` (line 169-188)
   - Added auto-save effect that monitors `instances` state changes
   - Automatically calls `updatePattern()` when instances change
   - Includes change detection to avoid unnecessary saves
   - Respects built-in pattern restrictions

### Code Pattern to Follow

**Always sync local UI state with persisted pattern state:**

```typescript
// CORRECT: Auto-save pattern when instances change
useEffect(() => {
  if (activePattern && !activePattern.isBuiltIn && activePatternId) {
    // Detect if instances have changed
    const hasChanged = /* change detection logic */;

    if (hasChanged) {
      // Update pattern with current instances
      updatePattern(activePatternId, { components: instances });
    }
  }
}, [instances, activePattern, activePatternId, updatePattern]);

// WRONG: Only update local state without persistence
const addComponent = (component) => {
  setInstances(prev => [...prev, component]);
  // Missing: No pattern update!
};
```

### Key Insights

1. **Local state != Persisted state**: Just because data appears in the UI doesn't mean it's saved
2. **Reactive persistence**: Use useEffect to automatically persist UI state changes
3. **Change detection**: Implement proper change detection to avoid infinite update loops
4. **Load and save symmetry**: If you load from pattern.components, you must save back to pattern.components

### Prevention

- Always trace data flow from UI state → Store state → Disk persistence
- Look for local useState that holds critical data without corresponding persistence
- Implement auto-save for important user data rather than requiring explicit save actions
- Test the "switch away and back" scenario to catch unpersisted local state
- Test the "restart app" scenario to verify persistence works end-to-end

---

## Bug #3: Maximum Update Depth Exceeded

**Fixed:** 2025-11-10

### Problem

React error "Maximum update depth exceeded" caused by TWO infinite loops in `RenamePatternBuilder` component. The application crashed when creating a new file naming pattern with the error message:

> "Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops."

### Root Cause

There were TWO problematic `useEffect` hooks with unstable dependencies:

**Loop #1: Auto-save effect (lines 169-189)**

The auto-save `useEffect` hook included `updatePattern` in its dependency array:

1. `instances` state changes
2. Effect runs and calls `updatePattern()`
3. `updatePattern` updates the pattern store
4. Pattern store update causes component re-render
5. Re-render triggers effect again because `updatePattern` reference changes
6. Loop continues infinitely → React throws error

**Loop #2: Pattern change notification effect (lines 164-168) - THE ACTUAL CULPRIT**

The pattern change effect included `onPatternChange` in its dependency array:

1. `instances` state changes
2. Effect calls `onPatternChange(instances)`
3. Parent component (`FileRenameShelf`) calls `setPatternInstances(instances)`
4. Parent re-renders, potentially creating new `onPatternChange` reference
5. Effect runs again because `onPatternChange` changed
6. Loop continues infinitely → React throws error

**The problematic code:**

```typescript
// Loop #1 - Auto-save effect
useEffect(() => {
  if (activePattern && !activePattern.isBuiltIn && activePatternId) {
    const hasChanged = /* change detection */;
    if (hasChanged) {
      updatePattern(activePatternId, { components: instances as any });
    }
  }
}, [instances, activePattern, activePatternId, updatePattern]); // ← updatePattern causes loop

// Loop #2 - Pattern change effect (THIS WAS THE MAIN ISSUE)
useEffect(() => {
  onPatternChange?.(instances);
}, [instances, onPatternChange]); // ← onPatternChange causes loop
```

### Solution: Use Refs and Debouncing to Break the Circular Dependency

The proper solution uses **three techniques** to prevent the infinite loop:

**1. Sync Flag (useRef)**: Prevents auto-save during pattern loading

```typescript
const isSyncingFromPattern = useRef(false);

// In sync effect:
isSyncingFromPattern.current = true; // Set before loading
// ... load instances from pattern ...
setTimeout(() => {
  isSyncingFromPattern.current = false;
}, 0); // Reset after tick
```

**2. Last Saved Tracking (useRef)**: Compares against last saved state, not pattern state

```typescript
const lastSavedInstances = useRef<ComponentInstance[]>([]);

// In auto-save effect:
if (isSyncingFromPattern.current) return; // Skip if syncing

const hasChanged = /* compare against lastSavedInstances.current */;
if (hasChanged) {
  lastSavedInstances.current = instances; // Update BEFORE save
  const timeoutId = setTimeout(() => updatePattern(...), 300);
  return () => clearTimeout(timeoutId);
}
```

**3. Debouncing**: Delays save call to batch rapid changes

```typescript
useEffect(() => {
  // ... change detection ...
  if (hasChanged) {
    const timeoutId = setTimeout(() => {
      updatePattern(activePatternId, { components: instances });
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId); // Cleanup on unmount or re-run
  }
}, [instances, activePatternId]); // Exclude activePattern!
```

### Files Modified

1. `/src/renderer/features/fileRename/RenamePatternBuilder/RenamePatternBuilder.tsx` (lines 84-88)
   - Added refs for loop prevention: `isSyncingFromPattern`, `lastSavedInstances`

2. `/src/renderer/features/fileRename/RenamePatternBuilder/RenamePatternBuilder.tsx` (lines 145-195)
   - Pattern sync effect with sync flag
   - Auto-save effect with debouncing and loop prevention
   - Pattern change effect removed `onPatternChange` from dependencies

### Code Pattern to Follow

**CORRECT: Bi-directional sync with loop prevention**

```typescript
// Refs to track state
const isSyncing = useRef(false);
const lastSaved = useRef<State>([]);

// Effect 1: Load from source
useEffect(() => {
  isSyncing.current = true;
  const loaded = loadFromSource(source);
  setState(prev => {
    if (hasChanged(prev, loaded)) {
      lastSaved.current = loaded;
      return loaded;
    }
    return prev;
  });
  setTimeout(() => {
    isSyncing.current = false;
  }, 0);
}, [source]);

// Effect 2: Save to source
useEffect(() => {
  if (isSyncing.current) return; // Skip during sync

  if (hasChanged(state, lastSaved.current)) {
    lastSaved.current = state;
    const timer = setTimeout(() => saveToSource(state), 300);
    return () => clearTimeout(timer);
  }
}, [state]); // Don't include source!
```

**WRONG: Including all dependencies blindly**

```typescript
// This causes infinite loops!
useEffect(() => {
  onCallback?.(state); // Calls parent's callback
}, [state, onCallback]); // ← If parent doesn't useCallback, this creates infinite loop!

useEffect(() => {
  if (someCondition) {
    stateUpdateFunction(data);
  }
}, [someCondition, data, stateUpdateFunction]); // ← If function changes on every render, infinite loop!
```

### Key Insights

1. **Callback props are often unstable**: Parent components may not memoize callbacks with `useCallback`, causing new references on every render
2. **Notification vs. Dependency**: If a callback is used to _notify_ parent of changes, exclude it from dependencies
3. **Zustand actions are usually stable**: But including them can still cause issues in complex state update cycles
4. **Change detection is crucial**: Implement proper change detection BEFORE calling state update functions
5. **ESLint rule exceptions**: Sometimes you need to disable `react-hooks/exhaustive-deps` when you understand the implications

### Prevention

- Always trace the full dependency cycle in `useEffect` hooks
- Ask: "Does this dependency cause the component to re-render?"
- Implement proper change detection BEFORE calling state update functions
- Consider using `useCallback` with stable dependencies for functions
- Use `eslint-disable-next-line` with a clear comment explaining WHY it's safe
- Test thoroughly after adding effects that call state update functions

---

## Bug #4: Shelf Disappearing During Drag

**Fixed:** 2025-11-27

### Problem

Shelves were disappearing while users were actively dragging files. The shelf would auto-hide approximately 3 seconds after creation, even when the user was still holding down the mouse button and dragging.

### Root Cause

The renderer process (React UI) was running **its own independent auto-hide timer** with NO awareness of drag state in the main process.

**Location**: `src/renderer/hooks/useShelfAutoHide.ts`

**Why This Happened:**

- **Process Isolation**: Renderer and main processes are separate in Electron
- **No IPC Communication**: Renderer had no way to know about drag state in main process
- **Dual Auto-Hide Systems**: Both main and renderer managed auto-hide independently
- **Renderer Timer Won**: Renderer's 3-second timer fired before main process checks could block it

### Evidence from Logs

```
[19:00:22.789Z] [renderer] ⏰ Shelf is empty, scheduling auto-hide in 3000ms
[19:00:22.313Z] [main] 🔒 DRAG LOCK ACQUIRED by DragShakeDetector
[19:00:25.791Z] [renderer] 🗑️ Auto-hiding empty shelf ← BYPASSED ALL PROTECTIONS
[19:00:27.388Z] [main] 📁 Drag ended ← User was STILL dragging!
```

The renderer destroyed the shelf 2 seconds before the drag even ended!

### The Fix

#### Essential Change #1: Disable Renderer Auto-Hide

**File**: `src/renderer/hooks/useShelfAutoHide.ts`

**What Changed**: Completely disabled the renderer-side auto-hide timer.

**Why**: The renderer process has no visibility into drag operations happening in the main process. Auto-hide must be managed by the main process which has access to:

- Drag state from native modules
- State machine context
- Global system events

**Code**:

```typescript
// BEFORE (WRONG):
timeoutRef.current = setTimeout(() => {
  logger.info(`🗑️ Auto-hiding empty shelf ${shelfId}`);
  onClose(); // ❌ Bypasses main process drag protection
}, delayMs);

// AFTER (CORRECT):
// DISABLED: Renderer-side auto-hide is disabled
// The main process handles all auto-hide logic with full drag state awareness
logger.debug(`Renderer auto-hide disabled - main process handles auto-hide`);
```

#### Secondary Fix: Improve Drag Detection (Optional)

**File**: `src/native/drag-monitor/src/native/mac/drag_monitor_mac.mm`

**What Changed**: Added 500ms grace period for macOS pasteboard updates.

**Why**: macOS doesn't update the pasteboard immediately when dragging starts from Finder. The original code rejected drags too quickly.

**Impact**: Better drag detection reliability, but not strictly required for the auto-hide fix.

### Verification

With the fix:

```
1. User drags file + shakes → Shelf created
2. Renderer auto-hide: DISABLED ✅
3. Main process checks drag state → PROTECTED ✅
4. User continues dragging → Shelf stays visible ✅
5. User releases drag → Main process auto-hides after ~5s ✅
```

### Files Modified

1. **src/renderer/hooks/useShelfAutoHide.ts** - ESSENTIAL: Disabled renderer auto-hide
2. **src/native/drag-monitor/src/native/mac/drag_monitor_mac.mm** - Optional: Improved drag detection

### Lesson Learned

**In multi-process architectures (like Electron), auto-hide logic must be centralized in the process that has full system state visibility.** The renderer process should NEVER independently manage operations that depend on system-level state it cannot access.

---

## Bug #5: Click+Shake False Positives

**Fixed:** 2025-11-27

### Problem

The application was incorrectly detecting **mouse click + shake** as a file drag operation, when it should only detect **actual file drag + shake**.

When a user:

1. Clicks on a file in Finder (but doesn't drag it)
2. Shakes the mouse while holding the click
3. The shelf would incorrectly appear

This happened because clicking on a file populates the macOS pasteboard with file information, even though no drag operation is occurring.

### Solution

#### 1. Filter Chromium Internal Drags ✅

**Location**: `drag_monitor_mac.mm` line 249-258

Filters out Electron's internal UI drag events that aren't file operations:

```cpp
bool isChromiumDrag = [types containsObject:@"org.chromium.chromium-initiated-drag"] ||
                     [types containsObject:@"org.chromium.chromium-renderer-initiated-drag"];

if (isChromiumDrag) {
    NSLog(@"[DragMonitor] Ignoring Chromium internal drag (not a file drag)");
    return false;
}
```

#### 2. Increased Drag Thresholds ✅

**Location**: `drag_monitor_mac.mm` line 533-535

Requires substantial movement to be considered a drag:

```cpp
const double MIN_DRAG_DISTANCE = 25.0;  // pixels - require real drag movement
const int MIN_DRAG_TIME = 150;          // milliseconds - time to initiate drag
const int MIN_MOVE_COUNT = 5;           // number of drag events - sustained movement
```

**Before**: 3px, 10ms, 1 event (way too sensitive)
**After**: 25px, 150ms, 5 events (requires intentional drag)

#### 3. Distance from Start Point Check ✅

**Location**: `drag_monitor_mac.mm` line 542-550

Verifies the mouse has moved away from the initial click location:

```cpp
double distanceFromStart = sqrt(
    pow(location.x - dragState.startPoint.x, 2) +
    pow(location.y - dragState.startPoint.y, 2)
);
const double MIN_DISTANCE_FROM_START = 20.0; // Must move 20px away from click point
```

This prevents shaking in place from being detected as a drag.

#### 4. Pasteboard Change Detection ✅ **[CRITICAL FIX]**

**Location**: `drag_monitor_mac.mm` line 483-494, 238-250

The **most important fix**: Only detect as drag if the pasteboard's `changeCount` **increases during the drag**.

**How it Works:**

```
1. User clicks on file → Pasteboard changeCount = N (file info loaded)
2. Mouse down event → We capture changeCount = N
3. User shakes in place → Pasteboard still = N → ❌ NOT a drag
4. User actually drags → macOS updates pasteboard to N+1 → ✅ Real drag!
```

**Implementation:**

**On Mouse Down**:

```cpp
@autoreleasepool {
    NSPasteboard* dragPasteboard = [NSPasteboard pasteboardWithName:NSPasteboardNameDrag];
    if (dragPasteboard) {
        // Capture the changeCount at click
        monitor->lastPasteboardChangeCount.store([dragPasteboard changeCount]);
    }
}
```

**During Drag Check**:

```cpp
NSInteger currentChangeCount = [dragPasteboard changeCount];

if (currentChangeCount <= lastPasteboardChangeCount.load()) {
    // Pasteboard hasn't changed since mouse-down = not a real drag
    NSLog(@"[DragMonitor] Pasteboard unchanged, ignoring - likely click+shake, not drag");
    return false;
}

NSLog(@"[DragMonitor] Pasteboard changed during drag - real drag detected!");
```

#### 5. TypeScript Validation ✅

**Location**: `dragMonitor.ts` line 156-161

Added validation to prevent emitting `dragStart` events with 0 files:

```typescript
if (files.length === 0) {
  logger.warn('⚠️ Drag detected but no files found - ignoring (not a file drag)');
  return;
}
```

### Testing

**❌ Click + Shake (Should NOT Trigger)**

1. Click on a file in Finder
2. Shake mouse vigorously while holding click
3. **Result**: No shelf appears (pasteboard changeCount doesn't increase)

**✅ Drag + Shake (Should Trigger)**

1. Click and START DRAGGING a file from Finder
2. Shake mouse while dragging
3. **Result**: Shelf appears (pasteboard changeCount increases when drag starts)

### Why This Works

The key insight is understanding macOS's drag lifecycle:

| Action                  | Pasteboard State                               |
| ----------------------- | ---------------------------------------------- |
| Click on file           | changeCount = N (file info loaded)             |
| Hold and shake in place | changeCount = N (no change)                    |
| **Start dragging file** | **changeCount = N+1 (macOS updates for drag)** |

By capturing the changeCount at mouse-down and only detecting drags when it increases, we can distinguish between:

- **Clicking on a file** (pasteboard populated but not changing)
- **Dragging a file** (pasteboard updates when drag initiates)

### Files Modified

1. `src/native/drag-monitor/src/native/mac/drag_monitor_mac.mm`
   - Added Chromium drag filter
   - Increased drag thresholds
   - Added distance-from-start check
   - **Added pasteboard change detection (critical fix)**

2. `src/native/drag-monitor/src/dragMonitor.ts`
   - Added file count validation

---

## Bug #6: Drag Session Duplicate Shelves

**Fixed:** 2025-10-24

### Problem

When users drag a file and shake to create a shelf, but continue holding the file without dropping it, the system could create duplicate shelves on subsequent shakes. Additionally, empty shelves could be destroyed prematurely while the user is still dragging.

### Solution

Implemented drag session tracking to prevent duplicate shelf creation during a single drag operation and improved cleanup timing to defer shelf destruction until after drag ends.

### Key Changes

#### 1. Drag Session Tracking (`DragDropCoordinator.ts`)

Added session tracking fields:

- `currentDragSessionId`: Unique ID for each drag operation
- `shelfCreatedForCurrentDrag`: Flag to track if shelf was created
- `dragSessionShelfId`: ID of the shelf created for current drag

**Session lifecycle:**

- New session ID generated on drag start
- Session cleared on drag end
- One shelf per drag session enforced

#### 2. Duplicate Prevention Logic

In `handleDragShake()`:

- Check if shelf already created for current drag session
- If yes, reuse existing shelf instead of creating new one
- Only allow new shelf if previous one was destroyed

#### 3. Improved Cleanup Timing (`ShelfLifecycleManager.ts`)

Added drag-aware tracking:

- `shelvesCreatedDuringDrag`: Set to track shelves created during active drag
- Mark shelves created while dragging
- Defer auto-hide for these shelves until drag ends

New `handleDragEnd()` method:

- Called when drag operation ends
- Evaluates empty shelves created during drag
- Schedules auto-hide with appropriate timeout

#### 4. Enhanced Auto-Hide Logic

Smarter auto-hide scheduling:

- Block auto-hide completely during active drag
- Extended timeout for shelves created during drag
- Reschedule with longer timeout if drag is still active

### User Experience Improvements

**Before:**

- Multiple shakes during drag → multiple shelves created
- Shelf might disappear while user still dragging
- Confusing behavior with overlapping shelves

**After:**

- One shelf per drag operation (guaranteed)
- Shelf stays visible throughout drag
- Empty shelf cleaned up only after drag ends
- Consistent and predictable behavior

### Files Modified

- `modules/core/dragDropCoordinator.ts`
- `modules/core/shelfLifecycleManager.ts`

---

## General Prevention Guidelines

### Testing Checklist for Critical Features

When testing features that interact with persistence or state:

- [ ] Application loads without crashing
- [ ] Feature works during session
- [ ] Changes persist after app restart
- [ ] No "Maximum update depth exceeded" errors
- [ ] React DevTools shows reasonable re-renders
- [ ] IPC communication working correctly
- [ ] No memory leaks (check with performance monitor)

### Code Review Checklist

Before committing changes:

- [ ] All state changes have corresponding persistence
- [ ] useEffect dependencies are correct and won't cause loops
- [ ] Change detection prevents unnecessary saves
- [ ] Process boundaries respected (renderer vs main)
- [ ] Native module changes tested on actual hardware
- [ ] No console.log statements (use Logger instead)
- [ ] TypeScript strict mode passing
- [ ] ESLint passing

---

**Remember**: This document is a living reference. Add new bugs as they're discovered and fixed to help prevent future issues!
