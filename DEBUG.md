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