# Drag Session Optimization

## Problem Statement

When users drag a file and shake to create a shelf, but continue holding the file without dropping it, the system could create duplicate shelves on subsequent shakes. Additionally, empty shelves could be destroyed prematurely while the user is still dragging.

## Solution Overview

Implemented drag session tracking to prevent duplicate shelf creation during a single drag operation and improved cleanup timing to defer shelf destruction until after drag ends.

## Key Changes

### 1. Drag Session Tracking (`DragDropCoordinator.ts`)

- **Added session tracking fields:**
  - `currentDragSessionId`: Unique ID for each drag operation
  - `shelfCreatedForCurrentDrag`: Flag to track if shelf was created
  - `dragSessionShelfId`: ID of the shelf created for current drag

- **Session lifecycle:**
  - New session ID generated on drag start
  - Session cleared on drag end
  - One shelf per drag session enforced

### 2. Duplicate Prevention Logic

- **In `handleDragShake()`:**
  - Check if shelf already created for current drag session
  - If yes, reuse existing shelf instead of creating new one
  - Only allow new shelf if previous one was destroyed

### 3. Improved Cleanup Timing (`ShelfLifecycleManager.ts`)

- **Added drag-aware tracking:**
  - `shelvesCreatedDuringDrag`: Set to track shelves created during active drag
  - Mark shelves created while dragging
  - Defer auto-hide for these shelves until drag ends

- **New `handleDragEnd()` method:**
  - Called when drag operation ends
  - Evaluates empty shelves created during drag
  - Schedules auto-hide with appropriate timeout

### 4. Enhanced Auto-Hide Logic

- **Smarter auto-hide scheduling:**
  - Block auto-hide completely during active drag
  - Extended timeout for shelves created during drag
  - Reschedule with longer timeout if drag is still active

## User Experience Improvements

### Before:

- Multiple shakes during drag → multiple shelves created
- Shelf might disappear while user still dragging
- Confusing behavior with overlapping shelves

### After:

- One shelf per drag operation (guaranteed)
- Shelf stays visible throughout drag
- Empty shelf cleaned up only after drag ends
- Consistent and predictable behavior

## Testing Scenarios

### Scenario 1: Drag-Shake-Hold

1. User drags file from Finder
2. User shakes to create shelf
3. User continues holding file (doesn't drop)
4. User shakes again
   - **Result:** No new shelf created, existing shelf shown/focused

### Scenario 2: Drag-Shake-Release

1. User drags file from Finder
2. User shakes to create shelf
3. User releases mouse without dropping
   - **Result:** Empty shelf auto-hides after 2 seconds

### Scenario 3: Drag-Shake-Drop

1. User drags file from Finder
2. User shakes to create shelf
3. User drops file on shelf
   - **Result:** Shelf remains visible with items

### Scenario 4: Multiple Drag Sessions

1. User completes first drag (with or without drop)
2. User starts new drag operation
3. User shakes during new drag
   - **Result:** New shelf created for new drag session

## Technical Details

### State Machine Integration

- Drag session awareness in state transitions
- Proper state cleanup on drag end
- Guards to prevent invalid state transitions

### Memory Management

- Proper cleanup of session tracking variables
- Timer cancellation for auto-hide
- Set clearing for tracked shelves

### Performance

- No additional overhead during normal operation
- Efficient set-based tracking
- Minimal memory footprint

## Configuration

No new configuration options required. The optimization works with existing preferences:

- `shelf.autoHideEmpty`: Controls auto-hide behavior
- `shakeDetection.dragShakeEnabled`: Controls drag+shake feature

## Future Improvements

1. Consider adding visual feedback when shelf is reused
2. Add telemetry to track how often users trigger multiple shakes
3. Consider preference for auto-hide timeout after drag
4. Add animation when focusing existing shelf

## Files Modified

- `modules/core/dragDropCoordinator.ts`
- `modules/core/shelfLifecycleManager.ts`
- Minor updates to related modules for integration

## Implementation Date

October 24, 2025

## Status

✅ Implemented and tested successfully
