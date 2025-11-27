# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Renderer Process Module Overview

This is the **renderer process** of the FileCataloger Electron application. The renderer handles all UI interactions, React components, and provides the visual interface for the shelf functionality.

### Purpose

The renderer process:

- Renders React 19 UI components for shelf windows and preferences
- Manages client-side state using Zustand stores
- Handles drag-and-drop file operations with validation
- Provides file rename features with real-time preview
- Communicates with main process via IPC channels
- Uses Tailwind CSS 4 for styling and Framer Motion for animations

### Development Commands

```bash
# Build the renderer process only
cd ../.. # Navigate to project root
yarn build:renderer

# Build all processes including renderer
yarn build

# Run in development mode (includes renderer hot reload)
yarn dev

# Type checking for renderer
yarn typecheck

# Validate renderer specifically
yarn validate:renderer
```

### Architecture

#### Core Technologies

- **React 19**: Latest React with concurrent features and improved SSR
- **TypeScript**: Strict mode enabled with path aliases
- **Zustand**: Lightweight state management with Immer middleware
- **Tailwind CSS 4**: Utility-first CSS framework with custom shelf themes
- **Framer Motion**: Animation library for smooth transitions
- **Webpack 5**: Module bundler with TypeScript and CSS processing

#### Module Structure

```
renderer/
├── components/                    # Reusable UI components
│   ├── domain/                   # Business logic components
│   │   ├── EmptyState/           # Empty shelf state display
│   │   ├── ErrorBoundary/        # Error handling wrapper
│   │   ├── FileDropZone/         # Drag-and-drop file handling
│   │   ├── ShelfDropZone/        # Shelf-specific drop zone
│   │   ├── ShelfHeader/          # Shelf window header
│   │   ├── ShelfItemComponent/   # Individual shelf item display
│   │   ├── ShelfItemList/        # List of shelf items
│   │   └── VirtualizedList/      # Performance-optimized list
│   ├── layout/                   # Layout components
│   └── primitives/               # Basic UI building blocks
├── features/                     # Feature-specific components
│   └── fileRename/               # File renaming functionality
│       ├── AddPatternButton/     # Add rename pattern component
│       ├── FileRenamePreviewList/ # Preview renamed files
│       ├── FileRenameShelf/      # Main rename interface
│       ├── PatternTab/           # Pattern configuration tabs
│       └── RenamePatternBuilder/ # Build rename patterns
├── pages/                        # Page components (entry points)
│   ├── preferences/              # Preferences window
│   └── shelf/                    # Shelf window pages
│       ├── shelf.html            # HTML template
│       ├── shelf.tsx             # Entry point
│       └── ShelfPage.tsx         # Main shelf page component
├── stores/                       # Zustand state management
│   ├── index.ts                  # Store exports
│   ├── patternStore.ts           # Rename pattern state
│   ├── shelfStore.ts             # Shelf state management
│   └── toastStore.ts             # Toast notification state
├── hooks/                        # Custom React hooks
├── utils/                        # Utility functions
│   ├── fileTypeIcons.ts          # File type icon mapping
│   ├── fileValidation.ts         # File operation validation
│   └── typeGuards.ts             # TypeScript type guards
├── constants/                    # Constants and configuration
│   ├── namingPatterns.ts         # File naming pattern definitions
│   └── shelf.ts                  # Shelf-specific constants
├── styles/                       # Global styles and CSS
└── assets/                       # Static assets
```

### Key Features

#### State Management with Zustand

The renderer uses Zustand with Immer middleware for immutable state updates:

```typescript
// Shelf store with Map-based state for performance
const useShelfStore = create<ShelfStore>()(
  devtools(
    immer((set, get) => ({
      shelves: new Map(),
      addShelf: config =>
        set(state => {
          state.shelves.set(config.id, config);
        }),
      // ... other actions
    }))
  )
);
```

#### File Rename Feature

Advanced file renaming with pattern building:

- **Two-panel layout**: File preview + pattern builder
- **Real-time preview**: Shows renamed file names as you build patterns
- **Pattern components**: Date, filename, text, counter, project name
- **Validation**: Checks for naming conflicts and invalid characters
- **Batch operations**: Rename multiple files simultaneously

#### Component Architecture

Components follow a clear hierarchy:

1. **Pages**: Entry points for different windows (`shelf.tsx`, `preferences.ts`)
2. **Features**: Complex, domain-specific functionality (`fileRename/`)
3. **Domain**: Business logic components (`ShelfHeader`, `FileDropZone`)
4. **Primitives**: Basic UI building blocks (buttons, inputs, dialogs)
5. **Layout**: Structural components (containers, grids)

#### IPC Communication

Renderer communicates with main process via typed IPC:

```typescript
// From renderer to main
window.electronAPI.shelf.filesDropped(shelfId, items);
window.electronAPI.shelf.close(shelfId);
window.electronAPI.app.getStatus();

// From main to renderer (via preload)
window.electronAPI.shelf.onConfigUpdate(callback);
window.electronAPI.shelf.onItemsUpdate(callback);
```

### Important Notes

#### TypeScript Configuration

- **Strict mode enabled**: No implicit `any` types allowed
- **Path aliases**: Use `@renderer/*`, `@shared/*`, `@main/*` for imports
- **Separate tsconfig**: `src/renderer/tsconfig.json` for renderer-specific settings
- **React 19 types**: Latest React types with concurrent features

#### Styling with Tailwind CSS

Custom configuration in `tailwind.config.js`:

```javascript
// Custom shelf-specific colors and animations
colors: {
  'shelf-bg': 'rgba(0, 0, 0, 0.8)',
  'shelf-border': 'rgba(255, 255, 255, 0.1)',
  'shelf-hover': 'rgba(255, 255, 255, 0.05)',
},
animation: {
  'shelf-appear': 'fadeIn 0.2s ease-out',
  'shelf-disappear': 'fadeOut 0.2s ease-out',
}
```

#### Performance Optimizations

- **Virtualized lists**: For large file collections (`VirtualizedList`)
- **React.memo**: Memoized components to prevent unnecessary re-renders
- **Zustand selectors**: Optimized state subscriptions
- **Code splitting**: Separate bundles for shelf and preferences pages

#### Error Handling

- **Error boundaries**: Catch and display React errors gracefully
- **Validation**: Client-side file operation validation before IPC calls
- **Fallback UI**: Empty states and loading indicators
- **User feedback**: Toast notifications for operations

### Development Workflow

#### Component Creation

1. **Choose component type**: Primitive, domain, or feature component
2. **Create folder structure**: `ComponentName/index.tsx` + `ComponentName.tsx`
3. **Add TypeScript interfaces**: Define props and state types
4. **Implement React.memo**: For performance optimization
5. **Add to index.ts**: Export from appropriate barrel file

#### Testing Components

```bash
# Run component tests
yarn test

# Test with UI interface
yarn test:ui

# Test file rename feature specifically
yarn test:native:validate
```

#### Debugging Renderer

- **Chrome DevTools**: Available in development mode
- **React DevTools**: Install browser extension for component inspection
- **Zustand DevTools**: State changes visible in browser dev tools
- **Console logging**: Use structured logging (avoid production logs)

### Common Patterns

#### Zustand Store Actions

```typescript
// Always use Immer for state updates
const updateShelf = (id: string, updates: Partial<ShelfConfig>) =>
  set(
    state => {
      const shelf = state.shelves.get(id);
      if (shelf) {
        state.shelves.set(id, { ...shelf, ...updates });
      }
    },
    false,
    'updateShelf'
  );
```

#### React Component Props

```typescript
// Use strict typing for all props
interface ComponentProps {
  config: ShelfConfig;
  onConfigChange: (config: Partial<ShelfConfig>) => void;
  onClose: () => void;
}

export const Component = React.memo<ComponentProps>(({ config, onConfigChange, onClose }) => {
  // Component implementation
});
```

#### IPC Error Handling

```typescript
// Always handle IPC errors gracefully
try {
  const result = await window.electronAPI.shelf.performAction(data);
  // Handle success
} catch (error) {
  logger.error('IPC action failed:', error);
  // Show user-friendly error message
}
```

### Code Style

- Use functional components with hooks (no class components)
- Prefer React.memo for performance-critical components
- Use Tailwind classes over inline styles
- Follow camelCase for file names (`ShelfHeader.tsx`)
- Use TypeScript strict mode (no `any` types)
- Handle async operations with proper error boundaries
- Use Zustand actions instead of direct state mutation
- Import types separately from values when possible

### Common Issues

1. **State not updating**: Check Zustand action implementation with Immer
2. **IPC not working**: Verify preload script exposes required APIs
3. **Styles not applying**: Check Tailwind config and PostCSS setup
4. **Performance issues**: Use React.memo and virtualized lists
5. **Type errors**: Ensure all imports use correct path aliases
6. **Animation glitches**: Check Framer Motion dependencies and variants
