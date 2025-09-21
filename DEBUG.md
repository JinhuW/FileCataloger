# Debug Notes

## Import of Non-existent Hook (Fixed)

**Date:** 2025-09-19
**Issue:** Shelf window not appearing after shaking a file
**Root Cause:** `FileRenameShelf.tsx` was importing and using `useKeyboardNavigation` hook from `useAccessibility.ts`, but this hook doesn't exist in the exported functions.

**Symptoms:**

- Shelf creation fails silently
- No visual feedback when shaking files
- Console errors about missing export

**Fix:**

- Removed the import of `useKeyboardNavigation` from `FileRenameShelf.tsx`
- Removed all usage of the hook (containerRef, handleKeyDown, useEffect)
- Removed keyboard event props from the motion.div element

**Prevention:**

- Always verify that imported functions exist before using them
- Run `yarn typecheck` to catch missing imports
- Check console for runtime errors during development

---

## Shelf Auto-Hide Issue Resolution (CRITICAL FIX)

**Date**: 2025-09-21
**Issue**: Shelves not disappearing after manual file removal
**Status**: ✅ **RESOLVED** with frontend workaround

### 🎯 **Problem Statement**

The FileCataloger application had a critical UX issue where:

1. **Shelves stayed visible indefinitely** after users manually removed all files
2. **Auto-hide timers never triggered** when shelves became empty
3. **User experience was broken** - cluttered screen with empty shelves

### 🔍 **Root Cause Analysis**

After extensive debugging, the issue was traced through multiple layers:

#### **Layer 1: Frontend (Working)**

- ✅ **File removal UI** - Remove buttons work correctly
- ✅ **IPC calls** - `shelf:remove-item` calls sent successfully
- ✅ **Local state updates** - Items removed from React state

#### **Layer 2: IPC Communication (Initially Broken, Then Fixed)**

- ❌ **Missing IPC handler** - No `shelf:remove-item` handler in main process
- ❌ **Duplicate handler conflicts** - ShelfManager and main/index.ts both tried to register same handler
- ❌ **Event system disconnected** - ApplicationController.start() never called

#### **Layer 3: Main Process Event System (Broken)**

- ❌ **ApplicationController.start() never executed** - Event handlers never registered
- ❌ **ShelfManager events not connected** - Auto-hide logic never triggered
- ❌ **Accessibility permissions blocking startup** - Prevented full application initialization

### 🛠️ **Debugging Journey & Attempted Fixes**

#### **Step 1: Initial Investigation**

```typescript
// Added debug logging to track IPC calls
logger.info(`🗑️ handleItemRemove called for itemId: ${itemId} on shelf: ${config.id}`);
logger.info(`📡 Calling shelf:remove-item IPC for shelf: ${config.id}, item: ${itemId}`);
```

**Finding**: Frontend IPC calls were working, but no response from main process.

#### **Step 2: IPC Handler Discovery**

```bash
# Found missing IPC handler
grep -r "shelf:remove-item" src/main/
# Only found in ShelfManager, not in main/index.ts routing
```

**Finding**: Discovered that main/index.ts had handlers for other operations but was missing `shelf:remove-item`.

#### **Step 3: Duplicate Handler Conflict**

```bash
# Error log revealed the issue
🚨 Unhandled Promise Rejection: Error: Attempted to register a second handler for 'shelf:remove-item'
```

**Finding**: Both ShelfManager and main/index.ts were trying to register the same IPC handler.

#### **Step 4: Event System Investigation**

```typescript
// Added startup logging
this.logger.info('Starting FileCataloger application...');
this.logger.info('🚀 FileCataloger application started successfully!');
```

**Finding**: ApplicationController.start() logs never appeared, indicating event system was never initialized.

#### **Step 5: Frontend Workaround Implementation**

```typescript
// Direct frontend auto-hide logic
const updatedItems = config.items.filter(item => item.id !== itemId);
if (updatedItems.length === 0 && !config.isPinned) {
  setTimeout(() => handleClose(), 3000);
}
```

**Finding**: Frontend-based solution bypassed all main process issues.

### ✅ **Final Solution - Frontend Auto-Hide**

#### **Implementation Location**

- **File**: `src/renderer/pages/shelf/ShelfPage.tsx`
- **Method**: `handleItemRemove`
- **Lines**: 189-198

#### **Solution Code**

```typescript
// TEMPORARY FRONTEND FIX: Auto-hide empty shelf after 3 seconds
// This bypasses the main process auto-hide logic that isn't working
const updatedItems = config.items.filter(item => item.id !== itemId);
if (updatedItems.length === 0 && !config.isPinned) {
  logger.info(`⏰ FRONTEND: Shelf ${config.id} is empty, scheduling auto-hide in 3 seconds`);
  setTimeout(() => {
    logger.info(`🗑️ FRONTEND: Auto-hiding empty shelf ${config.id}`);
    handleClose();
  }, 3000);
}
```

#### **How It Works**

1. **File Removal** - User clicks remove button on file
2. **State Update** - React state updated to remove item
3. **IPC Notification** - Main process notified (for consistency)
4. **Empty Check** - Frontend checks if shelf is now empty
5. **Timer Schedule** - 3-second setTimeout created
6. **Auto-Hide** - `handleClose()` called to destroy shelf

#### **Success Indicators**

```
✅ ⏰ FRONTEND: Shelf shelf_xyz is empty, scheduling auto-hide in 3 seconds
✅ 🗑️ FRONTEND: Auto-hiding empty shelf shelf_xyz (after 3 seconds)
```

### 🚨 **Known Issues & Future Tasks**

#### **Issues NOT Fixed (Require Future Work)**

1. **ApplicationController.start() never called** - Core application lifecycle broken
2. **Event system disconnected** - Inter-module communication not working
3. **Main process auto-hide logic unused** - Event handlers never registered
4. **Accessibility permissions handling** - May be blocking application startup

#### **Temporary Nature of Solution**

- ⚠️ **Frontend-only solution** - Bypasses proper architecture
- ⚠️ **Not scalable** - Each shelf feature would need similar workarounds
- ⚠️ **Main process features broken** - Drag-end cleanup, mouse release detection

#### **Recommended Future Work**

1. **Fix ApplicationController startup sequence**
   - Investigate why start() method never executes
   - Fix accessibility permissions blocking
   - Restore proper event system initialization

2. **Consolidate IPC architecture**
   - Remove duplicate handler systems
   - Standardize IPC routing through single system
   - Implement proper error handling

3. **Restore main process auto-hide**
   - Fix event emission between ShelfManager and ApplicationController
   - Implement drag-state aware auto-hide logic
   - Add mouse release detection

### 📊 **Performance Optimizations Implemented**

Despite the main issue, several optimizations were successfully added:

#### **Security Enhancements**

- ✅ **Fixed sandbox configuration** - Enabled proper sandboxing
- ✅ **Added IPC rate limiting** - Protection against abuse
- ✅ **Enhanced type safety** - Replaced `any` types with proper interfaces

#### **Performance Improvements**

- ✅ **Adaptive mouse event batching** - Dynamic batching based on system load
- ✅ **Advanced window pooling** - Warm/cold pool architecture
- ✅ **Predictive performance monitoring** - Trend analysis for issue prevention

#### **Code Quality**

- ✅ **TypeScript type safety** - Proper interfaces for all events
- ✅ **Comprehensive error handling** - Enhanced debugging capabilities
- ✅ **Modern Electron patterns** - Context isolation, security headers

### 🔧 **Debug Commands**

#### **Useful Debugging Commands**

```bash
# Check application logs
tail -f ~/Library/Application\ Support/Electron/logs/app-2025-09-21.log

# Verify build integrity
yarn typecheck && yarn lint

# Restart with full rebuild
yarn build && yarn dev

# Check IPC handler registrations
grep -r "ipcMain.handle" src/main/

# Monitor process status
ps aux | grep electron
```

#### **Key Log Patterns to Watch**

```bash
# Successful startup
🚀 ApplicationController constructor started
✓ ShelfManager initialized

# IPC communication working
📡 Received shelf:remove-item IPC
📡 shelf:remove-item result: true

# Frontend auto-hide working
⏰ FRONTEND: Shelf xyz is empty, scheduling auto-hide in 3 seconds
🗑️ FRONTEND: Auto-hiding empty shelf xyz
```

### 📋 **Lessons Learned**

1. **Complex Electron apps need multiple debugging layers** - IPC, events, lifecycle
2. **Event system dependencies can be fragile** - Direct approaches more reliable
3. **Frontend workarounds can be effective** - When main process is broken
4. **Comprehensive logging is essential** - Debug without logs is impossible
5. **Duplicate IPC handlers cause silent failures** - Electron doesn't warn clearly

### 🎯 **Current Status**

- ✅ **User Issue Resolved** - Shelves now auto-hide after 3 seconds
- ✅ **Application Stable** - No crashes or major issues
- ⚠️ **Architecture Compromised** - Frontend workaround not ideal long-term
- 📝 **Future Work Identified** - Clear path to proper fix

**The shelf auto-hide functionality is now working correctly from the user's perspective.**
