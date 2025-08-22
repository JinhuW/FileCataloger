# FileCataloger Migration Guide: Spacedrive → Minimal-Vite-TS UI

## Overview

This guide provides comprehensive instructions for migrating the FileCataloger project from its current basic structure to a production-ready application using the minimal-vite-ts reference UI while preserving Spacedrive's core file management patterns.

## Migration Philosophy

### Core Principles

1. **Preserve Functionality**: Never lose existing features during migration
2. **Incremental Migration**: Phase-based approach to minimize risk
3. **Type Safety First**: Maintain strict TypeScript throughout
4. **Performance Aware**: Consider file management scale from the start
5. **Desktop-First**: Optimize for Tauri desktop experience

### What We're Building

A professional file cataloger application that combines:

- **Spacedrive's** powerful file management patterns
- **Minimal-Vite-TS's** production-ready UI components
- **Tauri's** native desktop capabilities

## Pre-Migration Checklist

### ✅ Current Assets to Preserve

- [x] Tauri 2.0 configuration and backend
- [x] TypeScript strict configuration
- [x] ESLint + Prettier + Husky setup
- [x] Commitlint configuration
- [x] GitHub Actions CI/CD
- [x] Package.json scripts and dependencies

### ⚠️ Dependencies to Review

Before starting, ensure these core dependencies are aligned:

```json
{
  "@mui/material": "^7.3.1",
  "react": "^19.1.0",
  "react-router-dom": "^7.8.1",
  "zustand": "^5.0.7",
  "framer-motion": "^12.23.12",
  "@tanstack/react-query": "^5.67.0"
}
```

## Phase 1: Core Infrastructure (Week 1)

### 1.1 Application Initialization Pattern

**Current Structure** (`src/main.tsx`):

```typescript
// Simple ReactDOM.createRoot pattern
```

**Target Structure**:

```typescript
// Provider composition with error boundaries
// RouterProvider with lazy loading
// Theme and settings providers
```

**Migration Steps**:

1. Create `src/app.tsx` with provider composition
2. Update `src/main.tsx` to use RouterProvider
3. Add error boundary components
4. Implement loading states and suspense boundaries

### 1.2 Routing Architecture

**Current**: Inline routes in App.tsx
**Target**: Section-based routing with lazy loading

**Migration Steps**:

1. Create `src/routes/` directory structure:
   ```
   routes/
   ├── sections/
   │   ├── dashboard.tsx
   │   ├── files.tsx
   │   └── settings.tsx
   ├── paths.ts
   └── hooks/
   ```
2. Define path constants in `paths.ts`
3. Implement lazy loading for route sections
4. Add route-based code splitting

### 1.3 Layout System

**Create Layout Templates**:

```
layouts/
├── dashboard/      # Main app layout with sidebar
├── auth/          # Future: authentication layouts
├── simple/        # Minimal layout for modals/popups
└── core/          # Shared layout components
```

**Key Components**:

- Header with navigation
- Sidebar with file tree
- Main content area with toolbar
- Status bar (Tauri-specific)

### 1.4 Enhanced Theme System

**Migrate from Basic to Advanced Theme**:

1. Copy theme structure from reference
2. Add CSS variables support
3. Implement settings drawer
4. Add theme persistence to localStorage
5. Support system preference detection

## Phase 2: Component Migration (Week 2-3)

### 2.1 Priority Component List

**Essential Components** (Copy and Adapt):

```
components/
├── file-thumbnail/     # File preview system
├── upload/            # Drag-drop upload
├── table/             # File listing table
├── custom-dialog/     # Confirmation dialogs
├── empty-content/     # Empty states
├── loading-screen/    # Loading states
├── scrollbar/         # Custom scrollbar
└── search-not-found/  # Search results
```

**File Management Specific**:

```
sections/
├── file-manager/      # Core file management UI
│   ├── file-manager-grid-view.tsx
│   ├── file-manager-table.tsx
│   ├── file-manager-filters.tsx
│   └── file-manager-panel.tsx
```

### 2.2 Component Adaptation Strategy

For each component:

1. **Copy** component files from reference
2. **Strip** unnecessary features (auth, e-commerce)
3. **Adapt** to file management context
4. **Integrate** with Tauri commands
5. **Test** with mock data

### 2.3 State Management Integration

**Zustand Stores to Create**:

```typescript
// stores/fileStore.ts
interface FileStore {
  files: File[]
  selectedFiles: Set<string>
  viewMode: 'grid' | 'list'
  sortBy: SortOptions
  filters: FilterOptions
}

// stores/uiStore.ts
interface UIStore {
  sidebarOpen: boolean
  settingsOpen: boolean
  uploadDialogOpen: boolean
}
```

## Phase 3: Tauri Integration (Week 3-4)

### 3.1 Enhanced Service Layer

**Current**: Basic command wrapper
**Target**: Type-safe service architecture

```typescript
// services/tauri/
├── commands/
│   ├── file.commands.ts
│   ├── system.commands.ts
│   └── preferences.commands.ts
├── events/
│   ├── file.events.ts
│   └── system.events.ts
└── types/
    └── tauri.types.ts
```

### 3.2 File System Integration

**Implement Spacedrive Patterns**:

1. Virtual file system abstraction
2. Background indexing
3. Thumbnail generation
4. File type detection
5. Context menu integration

### 3.3 Performance Optimizations

**For Large File Sets**:

- Virtual scrolling (react-window)
- Lazy loading thumbnails
- Debounced search
- Pagination or infinite scroll
- Background processing queue

## Phase 4: Advanced Features (Week 4+)

### 4.1 Animation System

- Integrate Framer Motion
- Page transitions
- Micro-interactions
- Drag gesture support

### 4.2 Advanced Search

- Full-text search
- Filter combinations
- Saved searches
- Search history

### 4.3 File Operations

- Multi-select actions
- Batch operations
- Undo/redo system
- Operation queue

## Migration Commands Reference

### Development Workflow

```bash
# Start development with hot reload
yarn dev

# Type checking
yarn typecheck

# Linting
yarn lint
yarn lint:fix

# Testing
yarn test
yarn test:coverage

# Build
yarn build
npm run tauri build
```

### Component Generation

```bash
# Create new component (manual for now)
# Follow pattern in components/[component-name]/
# - index.ts (exports)
# - [component-name].tsx (implementation)
# - types.ts (TypeScript types)
# - styles.tsx (styled components if needed)
```

## Code Style Guidelines

### Import Order (Enforced by ESLint)

```typescript
// 1. React and core libraries
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// 2. Third-party libraries
import { Box, Button } from '@mui/material'
import { motion } from 'framer-motion'

// 3. Internal imports (absolute)
import { useFileStore } from '@/stores/fileStore'
import { FileGrid } from '@/components/file-grid'

// 4. Relative imports
import { FileItem } from './file-item'

// 5. Types
import type { FileType } from '@/types'
```

### Component Structure

```typescript
// 1. Types/interfaces
interface FileGridProps {
  files: File[];
  onSelect: (id: string) => void;
}

// 2. Component definition
export function FileGrid({ files, onSelect }: FileGridProps) {
  // 3. Hooks
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);

  // 4. Handlers
  const handleSelect = (id: string) => {
    // implementation
  };

  // 5. Effects
  useEffect(() => {
    // side effects
  }, []);

  // 6. Render
  return (
    <Box>
      {/* JSX */}
    </Box>
  );
}
```

## Testing Strategy

### Unit Tests

- Components: React Testing Library
- Stores: Direct Zustand testing
- Utils: Vitest unit tests

### Integration Tests

- Tauri commands: Mock IPC layer
- File operations: Mock file system
- User flows: Testing Library user events

### E2E Tests (Future)

- WebDriver for Tauri apps
- Critical user paths
- Performance benchmarks

## Performance Benchmarks

### Target Metrics

- **Initial Load**: < 2 seconds
- **File List Render**: < 100ms for 10,000 items (virtualized)
- **Search Response**: < 50ms for local search
- **Thumbnail Load**: Progressive, < 200ms per visible item
- **Memory Usage**: < 200MB for 100,000 indexed files

## Troubleshooting Guide

### Common Issues

**1. Type Errors After Migration**

- Run `yarn typecheck` to identify issues
- Check `tsconfig.json` path aliases
- Ensure all imports use correct paths

**2. Styling Conflicts**

- Check MUI theme provider setup
- Verify CSS-in-JS configuration
- Look for global CSS conflicts

**3. Tauri Command Failures**

- Verify capability permissions
- Check command registration in main.rs
- Review IPC payload serialization

**4. Performance Issues**

- Profile with React DevTools
- Check for unnecessary re-renders
- Verify virtualization is working
- Monitor Tauri backend performance

## Rollback Strategy

If migration issues arise:

1. **Git branches**: Keep migration in separate branch
2. **Feature flags**: Toggle new UI components
3. **Incremental rollout**: Test with subset of features
4. **Backup**: Keep original `src/` structure until stable

## Success Criteria

### Phase 1 Complete When:

- [ ] App loads with new provider structure
- [ ] Routing works with lazy loading
- [ ] Layout system displays correctly
- [ ] Theme switching works

### Phase 2 Complete When:

- [ ] File grid/list views work
- [ ] Upload functionality works
- [ ] Search and filters work
- [ ] All essential components migrated

### Phase 3 Complete When:

- [ ] Tauri commands fully integrated
- [ ] File operations work correctly
- [ ] Performance meets benchmarks
- [ ] No regression in functionality

### Phase 4 Complete When:

- [ ] Animations enhance UX
- [ ] Advanced features implemented
- [ ] Testing coverage > 80%
- [ ] Production build optimized

## Resources

### Reference Documentation

- [Tauri 2.0 Docs](https://v2.tauri.app)
- [MUI Components](https://mui.com/components)
- [React Router v7](https://reactrouter.com)
- [Zustand](https://zustand.docs.pmnd.rs)
- [Framer Motion](https://www.framer.com/motion)

### Example Implementations

- Reference UI: `/references/minimal-vite-ts/`
- Spacedrive: [GitHub](https://github.com/spacedriveapp/spacedrive)

### Support Channels

- GitHub Issues: Project repository
- Discord: Tauri community
- Stack Overflow: Tagged questions

## Notes for Claude Code

### When Implementing:

1. **Always preserve existing functionality** - Never break working features
2. **Type everything** - No `any` types allowed
3. **Test incrementally** - Verify each change works
4. **Commit frequently** - Small, focused commits
5. **Document decisions** - Comment why, not what

### Code Quality Checks:

Before marking any task complete, ensure:

```bash
yarn typecheck  # No errors
yarn lint       # No errors
yarn test       # All passing
yarn build      # Successful build
```

### Performance Considerations:

- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Lazy load images and thumbnails
- Debounce search and filter inputs
- Use Web Workers for heavy computations

This guide should be treated as the source of truth for the migration process. Update it as you discover new patterns or requirements.
