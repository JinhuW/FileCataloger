# Debug Notes for FileCataloger

This file documents bugs and their fixes to prevent recurring issues.

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
