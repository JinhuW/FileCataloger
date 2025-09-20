# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Renderer Module Overview

This is the **renderer process** for the FileCataloger Electron application. The renderer handles all UI components, user interactions, and visual presentation of shelf windows and the main application dashboard.

### Development Commands

```bash
# Navigate to project root first
cd ../..

# Run in development mode with hot reload
yarn dev

# Build the renderer only
yarn build:renderer

# Type checking (ALWAYS run before committing)
yarn typecheck

# Linting (ALWAYS run before committing)
yarn lint

# Run tests
yarn test

# Run specific test file
yarn test src/renderer/components/Shelf/__tests__/Shelf.test.tsx
```

### Architecture

#### Entry Points

1. **index.tsx** - Main application dashboard window
   - System metrics display
   - Manual shelf creation controls
   - Active shelf information

2. **shelf.tsx** - Shelf window renderer
   - File drop handling
   - Rename mode with pattern-based batch renaming
   - Auto-mode switching based on config

3. **preferences.ts** - Preferences window
   - User settings management
   - Configuration UI

### Component Structure

```
components/
├── Shelf/                    # Main shelf container with drag handling
├── FileRenameShelf/         # Specialized rename mode shelf
├── FileRenamePreviewList/   # Preview of rename operations
├── RenamePatternBuilder/    # Visual pattern construction UI
├── ShelfItemList/           # Item list display
├── ShelfItemComponent/      # Individual item rendering
├── VirtualizedList/         # Performance-optimized list
├── FileDropZone/            # Drag and drop area
├── ErrorBoundary/           # Error handling wrapper
├── Tooltip/                 # Tooltip component
└── LazyComponents.tsx       # Code splitting
```

### State Management

Using Zustand stores in `stores/`:

- Shelf items and configuration
- Drag state tracking
- Rename patterns and preview
- UI preferences

### IPC Communication

#### Renderer → Main

```typescript
// Send messages
window.api.send('shelf:files-dropped', { shelfId, files });
window.api.send('shelf:close', { shelfId });

// Invoke with response
const result = await window.api.invoke('shelf:add-item', shelfId, item);
const config = await window.api.invoke('shelf:update-config', shelfId, changes);
```

#### Main → Renderer

```typescript
// Listen for updates
window.api.on('shelf:config', (config: ShelfConfig) => {
  // Handle config update
});

window.api.on('shelf:add-item', (item: ShelfItem) => {
  // Add item to shelf
});
```

### Testing

Tests use Vitest with React Testing Library:

```bash
# Run all renderer tests
yarn test

# Run with coverage
yarn test --coverage

# Run in watch mode
yarn test --watch
```

### Styling

- **CSS Framework**: Tailwind CSS v4 with PostCSS
- **Configuration**: `src/renderer/tailwind.config.js`
- **Global styles**: `src/renderer/styles/globals.css`
- **CSS is built automatically** via webpack during development/build

Key Tailwind customizations:

- `shelf-bg`, `shelf-border`, `shelf-hover` color utilities
- `shelf-appear`, `shelf-disappear` animations
- Custom backdrop blur values

### Performance Considerations

1. **VirtualizedList**: Use for >50 items to maintain smooth scrolling
2. **React.memo**: Applied to expensive components like ShelfItemComponent
3. **Lazy loading**: Components loaded on-demand via LazyComponents.tsx
4. **CSS transforms**: Used for animations instead of layout properties

### Important Patterns

#### Type Guards

All IPC data must be validated using type guards in `utils/typeGuards.ts`:

```typescript
if (isShelfConfig(data)) {
  // Safe to use as ShelfConfig
}
```

#### File Processing

Use utilities in `utils/fileProcessing.ts` for:

- MIME type detection
- File icon selection
- Path operations

#### Accessibility

Use `hooks/useAccessibility.ts` for:

- Keyboard navigation
- Screen reader support
- Focus management

### Common Issues

1. **Window API not available**: Check preload script is loaded correctly
2. **Type errors with IPC**: Ensure data passes through type guards
3. **Styles not applying**: Tailwind CSS processes through PostCSS automatically
4. **Performance issues**: Check if VirtualizedList threshold needs adjustment

### Path Aliases

TypeScript path aliases configured:

- `@renderer/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`
- `@main/*` → `src/main/*`
- `@native/*` → `src/native/*`

Webpack resolves these aliases automatically.

## Code Style

- Use functional components with TypeScript
- Apply React.memo to list items and expensive components
- Keep component files focused (< 200 lines)
- Use descriptive names (e.g., `ShelfItemComponent` not `Item`)
- Validate all external data with type guards
- Handle loading and error states explicitly
