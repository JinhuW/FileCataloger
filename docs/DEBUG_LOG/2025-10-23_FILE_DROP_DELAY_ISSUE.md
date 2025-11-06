# Debug Report: File Drop Display Delay Issue

**Date**: 2025-10-23
**Issue**: Files appear "one step late" when dropped on shelf - drop file A shows nothing, drop file B shows A, drop file C shows B
**Status**: RESOLVED

---

## Problem Summary

When users dropped files on the FileCataloger shelf, the files would not appear immediately. Instead:

- Drop file A → Nothing shows
- Drop file B → File A appears
- Drop file C → Files A and B appear
- File C never shows until another file is dropped

This created a frustrating user experience where the shelf always appeared to be "one step behind" the actual drops.

---

## Root Causes Identified

Through systematic debugging and log analysis, we identified **FOUR distinct root causes** that compounded to create this issue:

### 1. Stale Native Drag File Cache (PRIMARY CAUSE)

**Location**: `src/renderer/components/domain/FileDropZone/FileDropZone.tsx:65-134`

**Problem**:

- The `handleDrop` function was calling `drag:get-native-files` IPC to get file information
- This IPC returned `ApplicationController.nativeDraggedFiles` which was a **cached array from previous drag operations**
- The cache was never cleared after a drop completed
- Result: Dropping 1 file would show 4 files from a previous drag session

**Evidence from logs**:

```
[2025-10-23T19:34:07.523Z] 📦 FileDropZone: Got 4 native dragged files:
  File Cataloger, Ai Engineer Interview, 玩转算法面试 leetcode题库分门别类详细解析, AIO
[2025-10-23T19:34:07.523Z] 📦 FileDropZone: dataTransfer.files.length = 0
[2025-10-23T19:34:07.532Z] 📦 FileRenameShelf.handleFileDrop: Received 4 items
```

User dropped 1 file, but system processed 4 cached files!

**Fix**:

- Removed dependency on `drag:get-native-files`
- Use ONLY `e.dataTransfer.files` which contains the **actual files from the current drop event**
- dataTransfer.files is provided by the browser/Electron and always contains the correct, current drop data

### 2. Wrong IPC Event Parameter Order

**Location**: `src/main/modules/window/shelfManager.ts:125, 551`

**Problem**:

```typescript
// WRONG - Renderer receives shelfId as first param instead of config
window.webContents.send('shelf:config', shelfId, config);

// Renderer expects:
on('shelf:config', (newConfig: unknown) => { ... })
```

The renderer was receiving the `shelfId` string as the config object, causing type guard failures.

**Evidence from logs**:

```
[2025-10-23T19:13:22.740Z] Received shelf config: shelf_1761246801887_cfx9ixdh4 with 0 items
```

The config was being logged but contained invalid data.

**Fix**:

```typescript
// CORRECT - Send only the config object
window.webContents.send('shelf:config', config);
```

### 3. Duplicate Item Addition

**Location**: `src/renderer/pages/shelf/ShelfPage.tsx:148-154`

**Problem**:
The `handleItemAdd` function was calling TWO different IPC methods that both added items:

```typescript
// First addition
send('shelf:files-dropped', { shelfId: config.id, files: [item.name] });

// Second addition (duplicate!)
await invoke('shelf:add-item', config.id, item);
```

**Evidence from logs**:

```
Drop file A: count 0 → 1 → 2 (added twice!)
Drop file B: count 2 → 3 (shows A from previous)
```

**Fix**: Removed the redundant `shelf:files-dropped` call - only use `shelf:add-item`

### 4. Shelf ID Race Condition

**Location**: `src/renderer/pages/shelf/ShelfPage.tsx:30-31`

**Problem**:

- ShelfPage initialized with hardcoded `id: 'default'`
- Actual shelf ID (`shelf_1761247084064_vjsncmd9h`) came later via `shelf:config` event
- Users could drop files before the config event arrived
- IPC calls used wrong shelf ID, causing failures

**Evidence from logs**:

```
[2025-10-23T19:18:04.895Z] handleItemAdd called for shelf default
[2025-10-23T19:18:04.896Z] shelf:add-item result: false (FAILED - shelf doesn't exist!)
```

**Fix**:

```typescript
// BEFORE: Hardcoded default
const [config, setConfig] = useState<ShelfConfig>({ id: 'default', ... });

// AFTER: Wait for real config from main process
const [config, setConfig] = useState<ShelfConfig | null>(null);

// Add loading UI while waiting
if (!config) return <div>Loading shelf...</div>;
```

### 5. Webpack Build Cache

**Location**: Build system caching stale code

**Problem**:

- Webpack was caching compiled code
- After fixing bugs, the cached old code continued running
- Made it appear like fixes weren't working

**Fix**:

1. Updated `package.json`:
   ```json
   "dev": "yarn clean && yarn build && electron ./dist/main/index.js"
   ```
2. Updated `webpack.common.js`:
   ```javascript
   cache: process.env.NODE_ENV === 'production' ? { type: 'filesystem' } : false;
   ```

### 6. Local State vs Props Mismatch

**Location**: `src/renderer/features/fileRename/FileRenameShelf/FileRenameShelf.tsx:55`

**Problem**:

```typescript
// Component had its own local state
const [selectedFiles, setSelectedFiles] = useState<ShelfItem[]>([]);

// But also received items via props
const selectedFiles = config.items; // Prop from parent

// Result: Two sources of truth that were out of sync
```

**Fix**: Use props as single source of truth:

```typescript
// Removed local state entirely
const selectedFiles = config.items; // Use prop directly
```

---

## Data Flow Analysis

### Before Fixes (Broken Flow)

```
User drops File A
  ↓
FileDropZone.handleDrop
  ↓ (calls drag:get-native-files)
  ↓ Returns: [old_file1, old_file2, old_file3, old_file4] (STALE CACHE!)
  ↓
FileRenameShelf.handleFileDrop(4 items)
  ↓ (has local selectedFiles state)
  ↓ setSelectedFiles([...4 items])
  ↓
ShelfPage.handleItemAdd × 4 (once per item)
  ↓ (config.id = 'default' - WRONG ID!)
  ↓ invoke('shelf:add-item', 'default', item) → FAILS!
  ↓ send('shelf:files-dropped', ...) → Adds items
  ↓
Main process adds 4 items
  ↓ sends: ('shelf:config', shelfId, config) ← WRONG PARAMS!
  ↓
Renderer receives shelfId as config → Type guard fails
  ↓
Component doesn't re-render with new items
  ↓
Next drop triggers re-render showing previous drop's items
```

### After Fixes (Correct Flow)

```
User drops File A
  ↓
FileDropZone.handleDrop
  ↓ Uses e.dataTransfer.files (ACTUAL dropped files!)
  ↓ Returns: [File A] (CORRECT!)
  ↓
FileRenameShelf.handleFileDrop([File A])
  ↓ (uses config.items - no local state)
  ↓
ShelfPage.handleItemAdd(File A)
  ↓ (waits for config to load - has real shelf ID)
  ↓ invoke('shelf:add-item', 'shelf_123...', File A) → SUCCESS!
  ↓
Main process adds File A
  ↓ sends: ('shelf:config', config) ← CORRECT PARAMS!
  ↓
Renderer receives config with [File A]
  ↓ setConfig(config) → Component re-renders
  ↓ config.items = [File A]
  ↓
FileRenameShelf displays [File A] immediately
```

---

## Technical Deep Dive

### Why The Delay Appeared As "One Step Behind"

The delay pattern was caused by **React state batching + asynchronous IPC**:

1. **First drop**:
   - Cached files added to backend: [old1, old2, old3, old4]
   - `shelf:config` event sent with wrong params → rejected
   - Local state updated optimistically
   - Next render uses stale config (empty)

2. **Second drop**:
   - Previous `shelf:config` finally processed
   - Component renders with items from FIRST drop
   - New files added to backend
   - Appears "one step behind"

### Why `dataTransfer.files` Solves The Problem

`e.dataTransfer.files` is a **FileList** object provided by the browser's Drag and Drop API:

- ✅ Always contains ONLY the files from the current drop event
- ✅ Automatically populated by the browser during the drop
- ✅ No caching - fresh for each drop
- ✅ Platform-independent and reliable

The native drag monitor was designed for DETECTING drags (for shake-to-create), not for getting file lists during drops. Using it for both purposes created the caching issue.

---

## Lessons Learned

### 1. Trust Browser APIs Over Custom Caching

**Problem**: Implemented custom native file caching thinking it would be more reliable
**Reality**: Browser's `dataTransfer.files` is already optimized and correct
**Lesson**: Use standard web APIs when available; only implement custom solutions when necessary

### 2. Single Source of Truth for State

**Problem**: FileRenameShelf maintained local `selectedFiles` state while also receiving `config.items` prop
**Reality**: Two sources of truth created synchronization issues
**Lesson**: Props should be the source of truth for derived/child components

### 3. Webpack Caching in Development

**Problem**: Made fixes but cached code kept running, making it appear fixes didn't work
**Reality**: Development should prioritize correctness over build speed
**Lesson**: Disable caching in dev mode: `cache: false` for webpack

### 4. IPC Parameter Contracts

**Problem**: Main process sent `send('shelf:config', shelfId, config)` but renderer expected `on('shelf:config', (config) => ...)`
**Reality**: No compile-time validation for IPC event parameters
**Lesson**: Document IPC contracts clearly and validate parameters on both ends

### 5. Race Conditions in Initialization

**Problem**: Component initialized with placeholder data (`id: 'default'`) before real data arrived
**Reality**: Async initialization requires proper loading states
**Lesson**: Use `null` initial state and show loading UI until real data arrives

---

## Debugging Methodology

### 1. Log Analysis Strategy

Added strategic logging at each layer:

```typescript
// FileDropZone
logger.info(`Got ${nativeDraggedFiles.length} native dragged files`);
logger.info(`dataTransfer.files.length = ${dataTransfer.files.length}`);

// FileRenameShelf
logger.info(`handleFileDrop: Received ${items.length} items`);

// ShelfPage
logger.debug(`handleItemAdd called for shelf ${config.id}`);

// ShelfManager (main process)
logger.debug(`Item added! New count: ${config.items.length}`);
```

This allowed tracing the exact flow and identifying where data was lost or duplicated.

### 2. Comparison Testing

```
Expected: Drop 1 file → Show 1 file
Actual:   Drop 1 file → Show 4 files (cached)

Expected: Drop 2 files → Show 2 files
Actual:   Drop 2 files → Show 0, then 2 on next drop
```

### 3. Filtering Logs

Used targeted log filtering to focus on relevant events:

```bash
BashOutput filter: "handleItemAdd|ADD ITEM|Item added|shelf:config"
```

This revealed the timing and sequence of events clearly.

---

## Prevention Strategies

### 1. Integration Tests

Add tests that simulate full drop flow:

```typescript
test('files appear immediately after drop', async () => {
  const shelf = await createShelf();
  await dropFiles(shelf, ['fileA.txt', 'fileB.txt']);

  // Should show immediately, not on next drop
  expect(shelf.getVisibleItems()).toEqual(['fileA.txt', 'fileB.txt']);
});
```

### 2. IPC Contract Validation

Create typed IPC channels:

```typescript
// Type-safe IPC definition
interface IPCChannels {
  'shelf:config': (config: ShelfConfig) => void;
  'shelf:add-item': (shelfId: string, item: ShelfItem) => boolean;
}

// Runtime validation
function send<K extends keyof IPCChannels>(
  channel: K,
  ...args: Parameters<IPCChannels[K]>
) { ... }
```

### 3. State Synchronization Tests

Test that UI reflects backend state:

```typescript
test('UI syncs with backend state', async () => {
  backend.addItem(item);
  await waitForUIUpdate();
  expect(ui.getItems()).toEqual(backend.getItems());
});
```

### 4. Clean Build Verification

Add pre-commit hook to verify clean builds:

```bash
# .husky/pre-commit
yarn clean
yarn build
yarn test
```

---

## Code Changes Summary

### Main Process

**`src/main/modules/window/shelfManager.ts`**:

```typescript
// Lines 125, 551
// BEFORE:
window.webContents.send('shelf:config', shelfId, config);

// AFTER:
window.webContents.send('shelf:config', config);
```

### Renderer Process

**`src/renderer/components/domain/FileDropZone/FileDropZone.tsx`**:

```typescript
// Lines 65-150
// BEFORE: Used cached native files
let nativeDraggedFiles = await window.api.invoke('drag:get-native-files');
// ... process nativeDraggedFiles

// AFTER: Use dataTransfer.files directly
if (dataTransfer.files && dataTransfer.files.length > 0) {
  for (let i = 0; i < dataTransfer.files.length; i++) {
    const file = dataTransfer.files[i];
    const filePath = (file as unknown as { path?: string }).path;
    // ... process file
  }
}
```

**`src/renderer/features/fileRename/FileRenameShelf/FileRenameShelf.tsx`**:

```typescript
// Line 55, 68
// BEFORE: Local state
const [selectedFiles, setSelectedFiles] = useState<ShelfItem[]>([]);

// AFTER: Use props directly
const selectedFiles = config.items;
```

**`src/renderer/pages/shelf/ShelfPage.tsx`**:

```typescript
// Line 31
// BEFORE: Hardcoded default
const [config, setConfig] = useState<ShelfConfig>({ id: 'default', ... });

// AFTER: Wait for real config
const [config, setConfig] = useState<ShelfConfig | null>(null);

// Lines 148-154 - REMOVED duplicate IPC call:
// DELETED:
send('shelf:files-dropped', { shelfId: config.id, files: [item.name] });

// KEPT:
await invoke('shelf:add-item', config.id, item);
```

### Build Configuration

**`package.json`**:

```json
// Line 8
"dev": "yarn clean && yarn build && electron ./dist/main/index.js"
```

**`config/webpack/webpack.common.js`**:

```javascript
// Lines 9-12
cache: process.env.NODE_ENV === 'production'
  ? {
      type: 'filesystem',
    }
  : false;
```

---

## Architecture Issues Exposed

### 1. Native Drag Monitor Overuse

The native drag monitor (`drag-monitor`) was designed for ONE purpose: **detecting when a drag operation starts** (for shake-to-create feature).

It was being MISUSED for a second purpose: **providing file information during drops**.

**Why this is problematic**:

- Drag detection needs to persist state across drag lifecycle
- Drop handling needs fresh, per-event data
- Mixing these concerns caused cache pollution

**Proper separation**:

- ✅ Native drag monitor: Detects drag start/end (stateful)
- ✅ dataTransfer.files: Provides dropped files (stateless, event-driven)

### 2. State Management Anti-Pattern

**Anti-pattern identified**: Parent and child both maintaining overlapping state

```
ShelfPage (parent)
  └─ config.items (state)
       └─ FileRenameShelf (child)
            └─ selectedFiles (state) ← DUPLICATE!
```

**Correct pattern**: Props down, events up

```
ShelfPage (parent)
  └─ config.items (SINGLE source of truth)
       └─ FileRenameShelf (child)
            └─ const selectedFiles = config.items (READ from props)
```

### 3. IPC Over-Abstraction

Having multiple IPC channels for the same operation created confusion:

- `shelf:files-dropped` (send)
- `shelf:add-item` (invoke/handle)
- `shelf:item-added` (send)
- `shelf:config` (send)

**Recommendation**: Simplify to one primary channel per operation with clear semantics.

---

## Testing Verification

### Manual Test Cases

1. **Single file drop**:
   - ✅ Drop 1 file → Shows 1 file immediately

2. **Multiple file drop**:
   - ✅ Drop 3 files → Shows all 3 files immediately

3. **Sequential drops**:
   - ✅ Drop file A → Shows A
   - ✅ Drop file B → Shows A and B
   - ✅ Drop file C → Shows A, B, and C

4. **Duplicate detection**:
   - ✅ Drop file A → Shows A
   - ✅ Drop file A again → Toast notification, no duplicate

### Automated Test Recommendations

```typescript
describe('File Drop Synchronization', () => {
  test('files appear immediately after drop', async () => {
    const shelf = await openShelf();
    await dropFiles(['test.txt']);
    expect(await shelf.getVisibleItems()).toEqual(['test.txt']);
  });

  test('multiple files show all at once', async () => {
    const shelf = await openShelf();
    await dropFiles(['a.txt', 'b.txt', 'c.txt']);
    expect(await shelf.getVisibleItems()).toHaveLength(3);
  });

  test('no stale cache from previous drops', async () => {
    const shelf = await openShelf();
    await dropFiles(['old1.txt', 'old2.txt']);
    await shelf.clear();
    await dropFiles(['new.txt']);
    expect(await shelf.getVisibleItems()).toEqual(['new.txt']);
  });
});
```

---

## Performance Impact

### Before

- Drop latency: **1+ full render cycle delay**
- Memory: Cached file data accumulating
- CPU: Duplicate item processing

### After

- Drop latency: **Immediate** (single render cycle)
- Memory: No caching overhead
- CPU: Single-pass item processing

---

## Future Improvements

### 1. Type-Safe IPC Layer

Create a centralized IPC definition with compile-time checking:

```typescript
// src/shared/ipc/contracts.ts
export const IPCContracts = {
  'shelf:config': {
    direction: 'main→renderer' as const,
    params: z.object({ config: ShelfConfigSchema }),
  },
  'shelf:add-item': {
    direction: 'renderer→main' as const,
    params: z.tuple([z.string(), ShelfItemSchema]),
    returns: z.boolean(),
  },
} as const;
```

### 2. React Query for State Sync

Use React Query to manage server state:

```typescript
const { data: shelfItems } = useQuery({
  queryKey: ['shelf', shelfId, 'items'],
  queryFn: () => window.api.invoke('shelf:get-items', shelfId),
});
```

### 3. Event Sourcing Pattern

Instead of imperative commands, use events:

```typescript
// Current: invoke('shelf:add-item', ...)
// Better: emit event, subscribe to state changes
emitEvent('file-dropped', { shelfId, files });
subscribeToState('shelf:items-changed', items => setItems(items));
```

### 4. Development Mode Safeguards

Add assertions in development:

```typescript
if (process.env.NODE_ENV === 'development') {
  assert(items.length === dataTransfer.files.length, 'Item count mismatch - possible cache issue!');
}
```

---

## Debug Notes for Future Reference

### Key Debugging Insight

**The "one step behind" pattern is almost always caused by**:

1. Stale cached data
2. Async state updates not being awaited
3. Multiple sources of truth getting out of sync

### How to Reproduce (Before Fix)

1. Start app
2. Drag 4 files over shelf (but don't drop - just hover)
3. Cancel drag
4. Drop single file
5. → Shows 4 files (the cached ones from step 2)

### Log Patterns to Watch For

**Bad pattern** (indicates caching issue):

```
User action: Drop 1 file
Logs show: Processing 4 files
```

**Bad pattern** (indicates duplicate processing):

```
Item added! New count: 1
Item added! New count: 2  ← Should not happen for single drop
```

**Bad pattern** (indicates parameter mismatch):

```
Sending: ('shelf:config', 'shelf_123', {...})
Receiving: config = 'shelf_123' ← Should be object!
```

---

## Conclusion

This issue was a perfect storm of **compounding problems**:

- Stale cache (primary)
- Wrong IPC parameters (prevented fixes from working)
- Duplicate additions (caused count mismatches)
- Race conditions (caused intermittent failures)
- Build caching (made debugging harder)
- State duplication (caused render issues)

Each issue individually might have been minor, but together they created a confusing "one step behind" behavior that was difficult to diagnose without systematic log analysis.

The fix required addressing ALL six root causes. Fixing only one or two would have left the issue partially broken.

**Key Takeaway**: In multi-process applications with complex state synchronization, always validate:

1. Data source freshness (no stale caches)
2. IPC parameter contracts
3. Single source of truth for state
4. Build system integrity
5. Race condition handling
6. Initialization timing
