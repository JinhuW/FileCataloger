# Drag Detection Fix - Click+Shake Prevention

## Problem

The application was incorrectly detecting **mouse click + shake** as a file drag operation, when it should only detect **actual file drag + shake**.

### Specific Issue

When a user:

1. Clicks on a file in Finder (but doesn't drag it)
2. Shakes the mouse while holding the click
3. The shelf would incorrectly appear

This happened because clicking on a file populates the macOS pasteboard with file information, even though no drag operation is occurring.

---

## Solution

### 1. **Filter Chromium Internal Drags** ✅

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

### 2. **Increased Drag Thresholds** ✅

**Location**: `drag_monitor_mac.mm` line 533-535

Requires substantial movement to be considered a drag:

```cpp
const double MIN_DRAG_DISTANCE = 25.0;  // pixels - require real drag movement
const int MIN_DRAG_TIME = 150;          // milliseconds - time to initiate drag
const int MIN_MOVE_COUNT = 5;           // number of drag events - sustained movement
```

**Before**: 3px, 10ms, 1 event (way too sensitive)
**After**: 25px, 150ms, 5 events (requires intentional drag)

### 3. **Distance from Start Point Check** ✅

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

### 4. **Pasteboard Change Detection** ✅ **[CRITICAL FIX]**

**Location**: `drag_monitor_mac.mm` line 483-494, 238-250

The **most important fix**: Only detect as drag if the pasteboard's `changeCount` **increases during the drag**.

#### How it Works:

```
1. User clicks on file → Pasteboard changeCount = N (file info loaded)
2. Mouse down event → We capture changeCount = N
3. User shakes in place → Pasteboard still = N → ❌ NOT a drag
4. User actually drags → macOS updates pasteboard to N+1 → ✅ Real drag!
```

#### Implementation:

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

### 5. **TypeScript Validation** ✅

**Location**: `dragMonitor.ts` line 156-161

Added validation to prevent emitting `dragStart` events with 0 files:

```typescript
if (files.length === 0) {
  logger.warn('⚠️ Drag detected but no files found - ignoring (not a file drag)');
  return;
}
```

---

## Testing

### ❌ Click + Shake (Should NOT Trigger)

1. Click on a file in Finder
2. Shake mouse vigorously while holding click
3. **Result**: No shelf appears (pasteboard changeCount doesn't increase)

### ✅ Drag + Shake (Should Trigger)

1. Click and START DRAGGING a file from Finder
2. Shake mouse while dragging
3. **Result**: Shelf appears (pasteboard changeCount increases when drag starts)

---

## Why This Works

The key insight is understanding macOS's drag lifecycle:

| Action                  | Pasteboard State                               |
| ----------------------- | ---------------------------------------------- |
| Click on file           | changeCount = N (file info loaded)             |
| Hold and shake in place | changeCount = N (no change)                    |
| **Start dragging file** | **changeCount = N+1 (macOS updates for drag)** |

By capturing the changeCount at mouse-down and only detecting drags when it increases, we can distinguish between:

- **Clicking on a file** (pasteboard populated but not changing)
- **Dragging a file** (pasteboard updates when drag initiates)

---

## Files Modified

1. `src/native/drag-monitor/src/native/mac/drag_monitor_mac.mm`
   - Added Chromium drag filter
   - Increased drag thresholds
   - Added distance-from-start check
   - **Added pasteboard change detection (critical fix)**

2. `src/native/drag-monitor/src/dragMonitor.ts`
   - Added file count validation

3. `src/main/modules/core/drag_drop_coordinator.ts`
   - Improved error messages

---

## Building

```bash
cd src/native
npm run build:drag-monitor
```

---

## Summary

The fix uses **four layers of validation**:

1. ✅ Filter Chromium internal drags
2. ✅ Require substantial movement (25px, 150ms, 5 events)
3. ✅ Require 20px movement from click point
4. ✅ **Require pasteboard changeCount to increase** (the key fix)

This ensures only **actual file drag operations** are detected, not clicks and shakes.
