# Stage 1: UI Improvements and Foundation

**Timeline**: Week 1
**Priority**: HIGH
**Dependencies**: None

## Overview

This stage focuses on immediate UI improvements that enhance user experience without requiring backend changes. These improvements lay the foundation for the plugin system while providing immediate value to users.

## Tasks

### Day 1-2: Update Terminology

#### Morning Session

- [ ] **Search and Replace "File Format" → "Naming Pattern"**
  - File: `src/renderer/components/RenamePatternBuilder/RenamePatternBuilder.tsx`
  - Line 155: Change "New File Format" to "Naming Pattern"
  - Update component JSDoc header
  - Search for any other occurrences in renderer directory

- [ ] **Update Tab Labels**
  - Change "Format 1" to "Pattern 1" or "Default Pattern"
  - Change "Customized" to "Custom Pattern"
  - Add pattern names as configurable properties

- [ ] **Update Tooltips and Aria Labels**
  - Add aria-label="Naming pattern configuration"
  - Update any helper text or tooltips
  - Ensure accessibility compliance

#### Afternoon Session

- [ ] **Create Constants File**

  ```typescript
  // src/renderer/constants/namingPatterns.ts
  export const NAMING_PATTERN_LABELS = {
    HEADER: 'Naming Pattern',
    DEFAULT_PATTERN: 'Default Pattern',
    CUSTOM_PATTERN: 'Custom Pattern',
    ADD_PATTERN: 'Add New Pattern',
    MAX_PATTERNS: 20,
  };
  ```

- [ ] **Update Tests**
  - Update any test files that reference "File Format"
  - Ensure all tests pass with new terminology

### Day 2-3: Scrollable Pattern Tabs

#### Components to Create

1. **ScrollableTabContainer.tsx**

   ```typescript
   interface ScrollableTabContainerProps {
     children: React.ReactNode;
     className?: string;
     onScroll?: (direction: 'left' | 'right') => void;
   }
   ```

   - [ ] Implement horizontal scroll container
   - [ ] Add scroll indicators (left/right arrows)
   - [ ] Show/hide arrows based on scroll position
   - [ ] Smooth scroll animation (300ms)
   - [ ] Keyboard navigation (Left/Right arrow keys)
   - [ ] Touch/swipe support for trackpad

2. **PatternTab.tsx**

   ```typescript
   interface PatternTabProps {
     id: string;
     name: string;
     active: boolean;
     editable: boolean;
     onClick: () => void;
     onClose?: () => void;
     onRename?: (newName: string) => void;
   }
   ```

   - [ ] Create base tab component
   - [ ] Active/inactive styling
   - [ ] Hover and focus states
   - [ ] Close button (X) for custom patterns
   - [ ] Double-click to rename
   - [ ] Drag handle for reordering
   - [ ] Context menu (right-click)

3. **AddPatternButton.tsx**

   ```typescript
   interface AddPatternButtonProps {
     onClick: () => void;
     disabled?: boolean;
   }
   ```

   - [ ] Create "+" button component
   - [ ] Consistent styling with tabs
   - [ ] Tooltip "Add new pattern"
   - [ ] Disabled state when max patterns reached

#### Integration Tasks

- [ ] **Update RenamePatternBuilder.tsx**
  - Replace static tab buttons with ScrollableTabContainer
  - Implement dynamic tab rendering
  - Add state for active pattern ID
  - Handle tab switching logic

- [ ] **Add CSS Modules**
  ```css
  /* PatternTabs.module.css */
  .container {
    /* scroll container styles */
  }
  .tab {
    /* tab styles */
  }
  .tabActive {
    /* active tab styles */
  }
  .scrollButton {
    /* arrow button styles */
  }
  ```

### Day 3-4: Pattern State Management

#### Create Zustand Store

- [ ] **Create patternStore.ts**

  ```typescript
  interface PatternState {
    patterns: Map<string, SavedPattern>;
    activePatternId: string | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    addPattern: (pattern: SavedPattern) => void;
    updatePattern: (id: string, updates: Partial<SavedPattern>) => void;
    deletePattern: (id: string) => void;
    setActivePattern: (id: string) => void;
    duplicatePattern: (id: string) => void;
    reorderPatterns: (fromIndex: number, toIndex: number) => void;
  }
  ```

- [ ] **Implement Pattern Validation**
  - Maximum 20 patterns per user
  - Pattern name length: 1-50 characters
  - Unique pattern names
  - At least one component required

- [ ] **Add Optimistic Updates**
  - Update UI immediately
  - Rollback on error
  - Show loading states appropriately

#### Create Custom Hooks

- [ ] **usePatternManager.ts**

  ```typescript
  export function usePatternManager() {
    // Wrap store methods with error handling
    // Add loading states
    // Implement undo/redo functionality
  }
  ```

- [ ] **useActivePattern.ts**
  ```typescript
  export function useActivePattern() {
    // Get current active pattern
    // Subscribe to changes
    // Memoize expensive operations
  }
  ```

### Day 4-5: UI Polish and Testing

#### Animations and Transitions

- [ ] **Tab Switching Animation**
  - Fade transition (200ms)
  - Slide animation for tab indicator
  - Smooth height transitions

- [ ] **Drag and Drop Feedback**
  - Ghost image while dragging
  - Drop zone indicators
  - Reorder animation

- [ ] **Loading States**
  - Skeleton loaders for tabs
  - Spinner for save operations
  - Error state UI

#### Empty States and Edge Cases

- [ ] **No Patterns State**
  - Friendly empty state message
  - Call-to-action to create first pattern
  - Illustration or icon

- [ ] **Error Handling UI**
  - Toast notifications for errors
  - Inline error messages
  - Retry mechanisms

#### Accessibility

- [ ] **Keyboard Navigation**
  - Tab through all interactive elements
  - Arrow keys for tab selection
  - Enter to activate, Delete to remove
  - Escape to cancel operations

- [ ] **Screen Reader Support**
  - Proper ARIA labels
  - Live regions for updates
  - Role attributes

#### Testing

- [ ] **Unit Tests**
  - Test each new component
  - Test state management logic
  - Test validation functions

- [ ] **Integration Tests**
  - Test tab switching
  - Test pattern CRUD operations
  - Test error scenarios

- [ ] **Visual Regression Tests**
  - Screenshot tests for different states
  - Cross-browser compatibility
  - Dark/light theme support

## Deliverables

1. **Updated UI with new terminology**
   - All "File Format" references changed to "Naming Pattern"
   - Consistent labeling throughout

2. **Scrollable Pattern Tab System**
   - Working horizontal scroll
   - Tab management (add, remove, reorder)
   - Smooth animations

3. **Pattern State Management**
   - Zustand store implementation
   - Custom hooks for pattern operations
   - Optimistic updates

4. **Polished User Experience**
   - Loading states
   - Error handling
   - Animations
   - Accessibility

## Success Criteria

- [ ] Users can create up to 20 custom patterns
- [ ] Pattern tabs scroll smoothly when exceeding viewport
- [ ] All operations feel instant (optimistic updates)
- [ ] No accessibility regressions
- [ ] All existing tests pass
- [ ] New features have >80% test coverage

## Code Review Checklist

- [ ] TypeScript types are properly defined
- [ ] Components follow existing patterns
- [ ] No console.log statements
- [ ] Proper error boundaries
- [ ] Memory leaks prevented (cleanup effects)
- [ ] Performance: No unnecessary re-renders
- [ ] Accessibility: Can use with keyboard only
- [ ] Documentation: JSDoc comments added

## Notes

- Start with terminology changes (low risk, high impact)
- Build components in isolation before integration
- Use Storybook for component development if available
- Consider feature flag for gradual rollout
- Keep backward compatibility in mind

## Next Stage

Stage 2 will add persistence to these patterns, allowing users to save and load their custom patterns across sessions.
