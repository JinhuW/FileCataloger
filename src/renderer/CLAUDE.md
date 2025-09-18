# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Renderer Module Overview

The FileCataloger renderer module is a React 19 + TypeScript UI layer for floating shelf windows that handle temporary file storage during drag operations. It implements a dual-window architecture with sophisticated drag-and-drop handling and performance optimizations.

## Development Commands

```bash
# Run the full application in development mode
yarn dev

# Type checking for renderer code
yarn typecheck

# Linting
yarn lint

# Format code
yarn format
```

## Architecture

### Entry Points

- `index.tsx` - Main dashboard window (status monitoring UI)
- `shelf.tsx` - Floating shelf windows (supports default and rename modes)

### Component Hierarchy

```
App.tsx (Dashboard)
└── Motion-animated status display

shelf.tsx (Shelf Windows)
├── Shelf (mode: 'default')
│   ├── ShelfHeader
│   ├── ShelfItemList
│   │   ├── VirtualizedList (>50 items)
│   │   └── ShelfItemComponent[]
│   └── ShelfDropZone
└── FileRenameShelf (mode: 'rename')
    ├── ShelfHeader
    ├── FileDropZone
    ├── RenamePatternBuilder
    └── FileRenamePreviewList
```

### Key Technologies

- **React 19** with Concurrent Features
- **TypeScript** with strict mode
- **Tailwind CSS 4** for styling
- **Framer Motion 12** for animations
- **IPC Communication** for main process interaction

## Component Patterns

### State Management

- Local React state (no global state management)
- Configuration-driven from main process via IPC
- Memoization with React.memo and custom comparisons

### Performance Optimizations

- **VirtualizedList**: Windowing for lists >50 items
- **React.memo**: Prevents unnecessary re-renders
- **useCallback**: Memoized event handlers
- **Dynamic sizing**: Content-based shelf dimensions

### Error Handling

- ErrorBoundary wrapper for all major components
- Graceful fallback UI with retry functionality
- Development mode shows detailed error information

## IPC Communication

All IPC methods are type-safe and defined in `window.d.ts`:

```typescript
// Request/Response pattern
window.api.invoke('shelf:add-item', shelfId, item);

// Event listening pattern
window.api.on('shelf:config', (config: ShelfConfig) => {});

// Send notifications
window.api.send('shelf:files-dropped', { shelfId, files });
```

### Available IPC Channels

- `shelf:config` - Receive shelf configuration updates
- `shelf:add-item` - Add item to shelf
- `shelf:remove-item` - Remove item from shelf
- `shelf:files-dropped` - Notify about dropped files
- `app:get-status` - Get application status

## Styling Approach

### Tailwind Configuration

Extended with shelf-specific utilities in `tailwind.config.js`:

- Custom colors: `shelf-bg`, `shelf-border`, `shelf-hover`
- Animations: `shelf-appear`, `drag-pulse`
- Backdrop filters for glassmorphism effects

### Dynamic Styling

- Position and dimensions use inline styles
- State-based classes for interactions
- Framer Motion for complex animations

## Type System

Core types are defined in `@shared/types`:

```typescript
interface ShelfItem {
  id: string;
  type: 'file' | 'text' | 'url' | 'image';
  name: string;
  path?: string;
  content?: string;
  size?: number;
  createdAt: number;
  thumbnail?: string;
}

interface ShelfConfig {
  id: string;
  position: Vector2D;
  dockPosition: DockPosition | null;
  isPinned: boolean;
  items: ShelfItem[];
  isVisible: boolean;
  opacity: number;
  mode?: 'default' | 'rename';
}
```

## Component Guidelines

### Creating New Components

1. Use functional components with TypeScript
2. Implement React.memo with custom comparison when appropriate
3. Handle errors with try/catch or error boundaries
4. Use Framer Motion for animations
5. Follow existing patterns for IPC communication

### File Organization

```
components/
├── [ComponentName].tsx        # Component implementation
├── Shelf/                     # Complex components in folders
│   ├── Shelf.tsx
│   ├── ShelfHeader.tsx
│   └── ShelfDropZone.tsx
└── shared/                    # Shared utilities
```

## Common Patterns

### Drag & Drop Implementation

```typescript
const handleDrop = useCallback(async (e: React.DragEvent) => {
  e.preventDefault();
  const items = await window.api.invoke('drag:process-drop', e.dataTransfer);
  // Handle items...
}, []);
```

### Animation Pattern

```typescript
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.95 }}
  transition={{ duration: 0.2 }}
>
```

### Performance Pattern

```typescript
const MemoizedComponent = React.memo(Component, (prev, next) => {
  return prev.id === next.id && prev.items.length === next.items.length;
});
```

## Debugging Tips

1. **DevTools**: Use Chrome DevTools in development mode
2. **React DevTools**: Install React Developer Tools extension
3. **IPC Logging**: Check main process console for IPC messages
4. **Performance**: Use React Profiler for render analysis

## Common Issues

1. **Shelf not updating**: Check IPC event listeners are properly set up
2. **Performance issues**: Verify VirtualizedList is activating for large lists
3. **Styling issues**: Check Tailwind classes are being compiled
4. **Type errors**: Ensure imports use correct path aliases (`@shared/*`, `@renderer/*`)
5. **Animation glitches**: Verify AnimatePresence wraps conditional renders

## Testing Approach

Currently no formal tests. When adding tests:

- Use React Testing Library for component tests
- Mock window.api for IPC communication
- Test error boundaries with error scenarios
- Verify accessibility with screen reader tests
