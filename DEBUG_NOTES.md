# Debug Notes for FileCataloger

This file documents bugs and their fixes to prevent recurring issues.

---

## Bug #3: Maximum Update Depth Exceeded - Infinite Loop in useEffect Dependencies (Fixed: 2025-11-10)

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

### Files Modified

1. `/src/renderer/features/fileRename/RenamePatternBuilder/RenamePatternBuilder.tsx` (lines 84-88)
   - **Added refs for loop prevention**:
     - `isSyncingFromPattern` - Flag to prevent auto-save when loading from pattern
     - `lastSavedInstances` - Track last saved state to prevent redundant saves

2. `/src/renderer/features/fileRename/RenamePatternBuilder/RenamePatternBuilder.tsx` (lines 145-195)
   - **Pattern sync effect**:
     - Set `isSyncingFromPattern.current = true` before loading
     - Update `lastSavedInstances.current` when loading new instances
     - Reset flag with `setTimeout(() => isSyncingFromPattern.current = false, 0)`
     - Added proper change detection in `setInstances` callback

3. `/src/renderer/features/fileRename/RenamePatternBuilder/RenamePatternBuilder.tsx` (lines 197-201)
   - **Pattern change effect**: Removed `onPatternChange` from dependency array
   - Effect now only depends on: `instances`

4. `/src/renderer/features/fileRename/RenamePatternBuilder/RenamePatternBuilder.tsx` (lines 203-234)
   - **Auto-save effect with debouncing and loop prevention**:
     - Check `isSyncingFromPattern.current` and skip if true
     - Compare against `lastSavedInstances.current` instead of `activePattern.components`
     - Update `lastSavedInstances.current` BEFORE calling `updatePattern`
     - Added 300ms debounce with `setTimeout`
     - Removed `activePattern` from dependencies (only `instances`, `activePatternId`)
     - Return cleanup function to cancel pending saves

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
6. **State update cycles**: Always trace the full cycle: state change → effect → function call → parent re-render → new callback → ...

### Prevention

- Always trace the full dependency cycle in `useEffect` hooks
- Ask: "Does this dependency cause the component to re-render?"
- Implement proper change detection BEFORE calling state update functions
- Consider using `useCallback` with stable dependencies for functions
- Use `eslint-disable-next-line` with a clear comment explaining WHY it's safe
- Test thoroughly after adding effects that call state update functions

### Testing Checklist

When testing effects that update state:

- [ ] Application loads without crashing
- [ ] No "Maximum update depth exceeded" errors in console
- [ ] Effect only runs when actual dependencies change
- [ ] Change detection logic prevents unnecessary updates
- [ ] Function calls within effect don't trigger infinite loops
- [ ] React DevTools shows reasonable number of re-renders

---

## Bug #1: Component Template Import Not Persisting (Fixed: 2025-11-09)

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
- When creating new hooks or utilities that modify the component library, ensure they either:
  1. Call the persistence layer directly, OR
  2. Use existing hooks that already handle persistence

### Testing Checklist

When testing component library operations:

- [ ] Add component and verify it appears in the library
- [ ] Restart the application
- [ ] Verify the component still exists in the library
- [ ] Check developer console for any save-related errors

---

## Bug #2: Pattern Component Instances Not Persisting (Fixed: 2025-11-10)

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

### Testing Checklist

When testing pattern operations:

- [ ] Create a new pattern
- [ ] Add several components to the pattern
- [ ] Switch to another pattern
- [ ] Switch back to the original pattern
- [ ] Verify all components are still there
- [ ] Restart the application
- [ ] Verify the pattern still has all its components
- [ ] Check that updatePattern is called when components change (dev tools)
