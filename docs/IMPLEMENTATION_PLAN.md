# FileCataloger Renderer - Implementation Plan

## Overview

This plan addresses critical issues found during code review, organized by priority and dependencies. Each phase builds upon the previous one to minimize disruption and ensure stability.

## Phase 1: Critical Security & Stability (Day 1-2)

**Goal**: Fix memory leaks, type safety, and security vulnerabilities

### 1.1 Create Type Guards Module

Create `src/renderer/utils/typeGuards.ts`:

```typescript
// Type guards for IPC messages
export function isShelfConfig(obj: unknown): obj is ShelfConfig {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'position' in obj &&
    'items' in obj &&
    Array.isArray((obj as any).items)
  );
}

export function isAppStatus(obj: unknown): obj is AppStatus {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'isRunning' in obj &&
    'modules' in obj &&
    'analytics' in obj
  );
}

export function isShelfItem(obj: unknown): obj is ShelfItem {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'type' in obj &&
    'name' in obj &&
    'createdAt' in obj
  );
}
```

### 1.2 Fix Event Listeners

Update all components with proper cleanup:

```typescript
// App.tsx
useEffect(() => {
  if (!window.api) return;

  const cleanup = window.api.on('app:status', (status: unknown) => {
    if (isAppStatus(status)) {
      setAppStatus(status);
      setIsLoading(false);
    }
  });

  return cleanup; // Direct cleanup function
}, []);

// shelf.tsx
useEffect(() => {
  if (!window.api) return;

  const cleanups: (() => void)[] = [];

  cleanups.push(
    window.api.on('shelf:config', (config: unknown) => {
      if (isShelfConfig(config)) {
        setConfig(config);
      }
    })
  );

  cleanups.push(
    window.api.on('shelf:add-item', (item: unknown) => {
      if (isShelfItem(item)) {
        setConfig(prev => ({
          ...prev,
          items: [...prev.items, item],
        }));
      }
    })
  );

  return () => cleanups.forEach(cleanup => cleanup());
}, []);
```

### 1.3 Add XSS Protection

Update ErrorBoundary.tsx:

```typescript
import DOMPurify from 'dompurify';

// In render method
{process.env.NODE_ENV === 'development' && (
  <pre className="mt-4 text-xs text-left bg-gray-100 p-4 rounded overflow-auto">
    {DOMPurify.sanitize(error?.stack || error?.toString() || '')}
  </pre>
)}
```

## Phase 2: Performance & Code Organization (Day 3-4)

**Goal**: Extract utilities, optimize performance, reduce duplication

### 2.1 Create Shared Constants

Create `src/renderer/constants/shelf.ts`:

```typescript
export const SHELF_CONSTANTS = {
  // Gesture detection
  SHAKE_THRESHOLD: 6,
  SHAKE_TIMEOUT_MS: 500,

  // UI behavior
  AUTO_HIDE_DELAY_MS: 5000,
  ANIMATION_DURATION_MS: 200,

  // Performance
  VIRTUALIZATION_THRESHOLD: 50,
  OVERSCAN_COUNT: 5,

  // Dimensions
  MIN_HEIGHT: 80,
  MAX_HEIGHT: 600,
  DEFAULT_HEIGHT: 200,
  ITEM_HEIGHT: 60,
  COMPACT_ITEM_HEIGHT: 40,

  // Limits
  MAX_SHELVES: 5,
  MAX_ITEMS_PER_SHELF: 500,
} as const;
```

### 2.2 Extract File Processing Utilities

Create `src/renderer/utils/fileProcessing.ts`:

```typescript
import { ShelfItem } from '@shared/types';

export function createShelfItem(
  file: File,
  index: number,
  baseType: 'file' | 'text' | 'url' | 'image' = 'file'
): ShelfItem {
  const id = `${baseType}-${Date.now()}-${index}-${crypto.randomUUID()}`;

  return {
    id,
    type: determineFileType(file),
    name: file.name,
    path: (file as any).path,
    size: file.size,
    createdAt: Date.now(),
    thumbnail: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
  };
}

export function determineFileType(file: File): ShelfItem['type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('text/')) return 'text';
  if (file.name.match(/\.(txt|md|json|js|ts|tsx|css|html)$/i)) return 'text';
  return 'file';
}

export async function processDroppedFiles(dataTransfer: DataTransfer): Promise<ShelfItem[]> {
  const items: ShelfItem[] = [];
  const files = Array.from(dataTransfer.files);

  for (let i = 0; i < files.length; i++) {
    items.push(createShelfItem(files[i], i));
  }

  // Handle text/URL drops
  const text = dataTransfer.getData('text/plain');
  if (text && files.length === 0) {
    const isUrl = /^https?:\/\//i.test(text);
    items.push({
      id: `${isUrl ? 'url' : 'text'}-${Date.now()}-${crypto.randomUUID()}`,
      type: isUrl ? 'url' : 'text',
      name: isUrl ? new URL(text).hostname : text.substring(0, 30) + '...',
      content: text,
      createdAt: Date.now(),
    });
  }

  return items;
}
```

### 2.3 Performance Optimizations

Create memoized selectors:

```typescript
// src/renderer/hooks/useShelfCalculations.ts
import { useMemo } from 'react';
import { ShelfConfig } from '@shared/types';
import { SHELF_CONSTANTS } from '../constants/shelf';

export function useShelfCalculations(config: ShelfConfig) {
  const shouldVirtualize = useMemo(
    () => config.items.length > SHELF_CONSTANTS.VIRTUALIZATION_THRESHOLD,
    [config.items.length]
  );

  const calculatedHeight = useMemo(() => {
    const baseHeight = config.items.length * SHELF_CONSTANTS.ITEM_HEIGHT;
    return Math.min(Math.max(baseHeight, SHELF_CONSTANTS.MIN_HEIGHT), SHELF_CONSTANTS.MAX_HEIGHT);
  }, [config.items.length]);

  const isCompact = useMemo(() => config.items.length > 10, [config.items.length]);

  return { shouldVirtualize, calculatedHeight, isCompact };
}
```

## Phase 3: Accessibility & UX (Day 5-6)

**Goal**: Make application accessible and improve user experience

### 3.1 Add ARIA Attributes

Create accessibility hook:

```typescript
// src/renderer/hooks/useAccessibility.ts
export function useShelfAccessibility(config: ShelfConfig) {
  return {
    role: 'region',
    'aria-label': `Shelf ${config.id} with ${config.items.length} items`,
    'aria-live': 'polite',
    'aria-atomic': 'false',
    tabIndex: 0,
  };
}

export function useShelfItemAccessibility(item: ShelfItem, index: number) {
  return {
    role: 'listitem',
    'aria-label': `${item.name}, ${item.type} item ${index + 1}`,
    'aria-posinset': index + 1,
    tabIndex: 0,
  };
}
```

### 3.2 Keyboard Navigation

Add keyboard support to Shelf.tsx:

```typescript
const handleKeyDown = useCallback(
  (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        if (selectedItemId) {
          handleItemRemove(selectedItemId);
        }
        break;
      case 'Escape':
        handleClose();
        break;
      case 'ArrowDown':
        e.preventDefault();
        selectNextItem();
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectPreviousItem();
        break;
      case 'Enter':
        if (selectedItemId) {
          const item = config.items.find(i => i.id === selectedItemId);
          if (item?.path) {
            window.api.openPath(item.path);
          }
        }
        break;
    }
  },
  [selectedItemId, config.items]
);
```

### 3.3 Tooltip Improvements

Update Tooltip.tsx with better positioning:

```typescript
const calculatePosition = useCallback(
  (triggerRect: DOMRect, tooltipRect: DOMRect): { top: number; left: number } => {
    const padding = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = triggerRect.top - tooltipRect.height - padding;
    let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;

    // Prevent viewport overflow
    if (top < padding) {
      top = triggerRect.bottom + padding;
    }
    if (left < padding) {
      left = padding;
    }
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }

    return { top, left };
  },
  []
);
```

## Phase 4: Component Refactoring (Day 7-8)

**Goal**: Split large components, improve maintainability

### 4.1 Split Shelf.tsx

Extract into smaller components:

```
src/renderer/components/Shelf/
├── Shelf.tsx (main container, ~150 lines)
├── ShelfDragHandler.tsx (drag logic)
├── ShelfAnimationController.tsx (animation state)
├── ShelfItemManager.tsx (item CRUD operations)
└── hooks/
    ├── useShelfDrag.ts
    ├── useShelfAnimation.ts
    └── useShelfItems.ts
```

### 4.2 Create Composition Pattern

```typescript
// New Shelf.tsx structure
export const Shelf: React.FC<ShelfProps> = ({ config, ...props }) => {
  const dragHandlers = useShelfDrag(config);
  const animationState = useShelfAnimation(config);
  const itemManager = useShelfItems(config, props.onItemAdd);

  return (
    <ShelfContainer {...animationState}>
      <ShelfDragHandler {...dragHandlers}>
        <ShelfHeader config={config} onClose={props.onClose} />
        <ShelfItemManager
          items={config.items}
          onRemove={props.onItemRemove}
          virtualize={itemManager.shouldVirtualize}
        />
        {config.items.length === 0 && <ShelfDropZone />}
      </ShelfDragHandler>
    </ShelfContainer>
  );
};
```

## Phase 5: Testing & Documentation (Day 9-10)

**Goal**: Add tests and improve documentation

### 5.1 Unit Test Setup

Create test files for critical components:

```typescript
// src/renderer/components/__tests__/Shelf.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Shelf } from '../Shelf';

describe('Shelf Component', () => {
  const mockConfig = {
    id: 'test-shelf',
    items: [],
    // ... other required fields
  };

  it('renders with empty state', () => {
    render(<Shelf config={mockConfig} />);
    expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
  });

  it('handles file drops correctly', async () => {
    // Test implementation
  });
});
```

### 5.2 Integration Tests

Test IPC communication:

```typescript
// Mock window.api for testing
global.window.api = {
  on: jest.fn((channel, callback) => {
    // Return cleanup function
    return () => {};
  }),
  invoke: jest.fn(),
  send: jest.fn(),
};
```

## Implementation Priority Matrix

| Task              | Impact | Effort | Priority | Dependencies    |
| ----------------- | ------ | ------ | -------- | --------------- |
| Type Guards       | High   | Low    | P0       | None            |
| Memory Leak Fix   | High   | Low    | P0       | Type Guards     |
| XSS Protection    | High   | Low    | P0       | None            |
| Extract Constants | Medium | Low    | P1       | None            |
| Extract Utilities | Medium | Medium | P1       | Constants       |
| Performance Hooks | Medium | Medium | P1       | Utilities       |
| Accessibility     | High   | Medium | P2       | None            |
| Keyboard Nav      | High   | High   | P2       | Accessibility   |
| Component Split   | Low    | High   | P3       | All above       |
| Unit Tests        | Medium | High   | P3       | Component Split |

## Success Metrics

- No memory leaks in 24-hour stress test
- All user inputs properly validated
- Lighthouse accessibility score > 95
- Component render time < 16ms for 60fps
- Zero type errors with strict TypeScript
- Test coverage > 80% for critical paths

## Rollback Plan

Each phase is designed to be atomic. If issues arise:

1. Revert the specific phase commits
2. Hotfix critical issues only
3. Re-implement with lessons learned
4. Use feature flags for gradual rollout
