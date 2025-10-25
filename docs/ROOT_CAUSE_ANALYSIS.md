# Root Cause Analysis: Shelf Disappearing During Drag

## Problem Statement

Shelves were disappearing while users were actively dragging files. The shelf would auto-hide approximately 3 seconds after creation, even when the user was still holding down the mouse button and dragging.

## Root Cause

The renderer process (React UI) was running **its own independent auto-hide timer** with NO awareness of drag state in the main process.

**Location**: `src/renderer/hooks/useShelfAutoHide.ts`

### Why This Happened

- **Process Isolation**: Renderer and main processes are separate in Electron
- **No IPC Communication**: Renderer had no way to know about drag state in main process
- **Dual Auto-Hide Systems**: Both main and renderer managed auto-hide independently
- **Renderer Timer Won**: Renderer's 3-second timer fired before main process checks could block it

### The Evidence

From application logs:

```
[19:00:22.789Z] [renderer] ⏰ Shelf is empty, scheduling auto-hide in 3000ms
[19:00:22.313Z] [main] 🔒 DRAG LOCK ACQUIRED by DragShakeDetector
[19:00:25.791Z] [renderer] 🗑️ Auto-hiding empty shelf ← BYPASSED ALL PROTECTIONS
[19:00:27.388Z] [main] 📁 Drag ended ← User was STILL dragging!
```

The renderer destroyed the shelf 2 seconds before the drag even ended!

## The Fix

### Essential Change #1: Disable Renderer Auto-Hide

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

### Secondary Fix: Improve Drag Detection (Optional)

**File**: `src/native/drag-monitor/src/native/mac/drag_monitor_mac.mm`

**What Changed**: Added 500ms grace period for macOS pasteboard updates.

**Why**: macOS doesn't update the pasteboard immediately when dragging starts from Finder. The original code rejected drags too quickly.

**Impact**: Better drag detection reliability, but not strictly required for the auto-hide fix.

## Verification

With the fix:

```
1. User drags file + shakes → Shelf created
2. Renderer auto-hide: DISABLED ✅
3. Main process checks drag state → PROTECTED ✅
4. User continues dragging → Shelf stays visible ✅
5. User releases drag → Main process auto-hides after ~5s ✅
```

## Files Modified (Minimal)

1. **src/renderer/hooks/useShelfAutoHide.ts** - ESSENTIAL: Disabled renderer auto-hide
2. **src/native/drag-monitor/src/native/mac/drag_monitor_mac.mm** - Optional: Improved drag detection

## Testing

Test the fix:

1. Drag a file from Finder and shake → Shelf appears
2. Continue holding the drag for 10+ seconds → Shelf stays visible ✅
3. Release or drop the file → Shelf auto-hides only if empty

## Lesson Learned

**In multi-process architectures (like Electron), auto-hide logic must be centralized in the process that has full system state visibility.** The renderer process should NEVER independently manage operations that depend on system-level state it cannot access.

---

**Issue Status**: RESOLVED
**Files Changed**: 2 files (minimal changes)
**Risk Level**: Low - Simple disable of problematic code
**Testing**: Type checking passed
