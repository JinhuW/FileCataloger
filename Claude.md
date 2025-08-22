Goal:
Based on the reference project @spacedriveapp/spacedrive, create a new project that is a clone of the reference project.
But use the new UI from the reference project. @references/minimal-vite-ts

Create a production-ready Tauri application with React and TypeScript that follows best practices for code quality, project structure, and maintainability.

Project Requirements:

- Framework: Tauri 2.0+ with React 19+ and TypeScript 5+
- Build tool: Vite
- Styling: Tailwind CSS
- State Management: Zustand
- Routing: React Router v6

Code Quality Setup Required:

Frontend (TypeScript/React):

1. ESLint configuration with:
   - Airbnb or Standard style guide
   - React hooks rules
   - TypeScript strict rules
   - Import sorting rules
   - Accessibility (a11y) rules

2. Prettier configuration with:
   - 2 space indentation
   - Single quotes
   - No semicolons (or with semicolons - your preference)
   - Trailing comma for multi-line
   - 100 character line width

3. TypeScript configuration:
   - Strict mode enabled
   - Path aliases (@components, @hooks, @utils, @types)
   - No implicit any
   - Strict null checks

4. Git hooks with Husky:
   - Pre-commit: lint-staged for ESLint and Prettier
   - Pre-push: TypeScript type checking
   - Commit message validation with commitlint (conventional commits)

5. Testing setup:
   - Vitest for unit tests
   - React Testing Library
   - Coverage configuration

Backend (Rust):

1. Rustfmt configuration
2. Clippy with pedantic lints
3. Cargo workspace setup if needed

Additional Configuration:

- .editorconfig file for consistent coding styles
- .nvmrc for Node version
- VSCode settings and recommended extensions
- GitHub Actions CI/CD workflow for linting, testing, and building
- Dependabot configuration
- Environment variables setup (.env.example)

Key Architecture Decisions
Frontend Architecture

Component Structure: Feature-based organization with common components separated
State Management: Zustand stores organized by domain
API Layer: All Tauri commands wrapped in TypeScript services with proper typing
Hooks: Custom hooks for Tauri integration and business logic

Backend Architecture

Command Pattern: All IPC through well-defined Tauri commands
Service Layer: Business logic separated from Tauri commands
Error Handling: Centralized error types with proper serialization
Database: SQLite with migrations and structured query organization

Code Quality Enforcements

Type Safety: No any types, strict null checks
Import Organization: Automated sorting and path aliases
Code Formatting: Automated on save and pre-commit
Testing: Required coverage thresholds
Documentation: JSDoc/RustDoc for public APIs

Please create all necessary configuration files with explanatory comments and ensure all tools work together without conflicts. Include a comprehensive README with setup instructions and development guidelines.

# Migration Instructions for Claude Code

## IMPORTANT: Read These Documents First

1. **MIGRATION_GUIDE.md** - Comprehensive migration strategy and architecture decisions
2. **TODO_CHECKLIST.md** - Phase-by-phase implementation checklist with specific tasks

## Migration Approach

### Core Principles

1. **Preserve ALL existing functionality** - Never break or remove working features
2. **Incremental migration** - Follow the phases defined in TODO_CHECKLIST.md
3. **Test continuously** - Run quality checks after each change
4. **Type safety** - No `any` types, maintain strict TypeScript
5. **Performance first** - Consider file management at scale

### Implementation Order

Follow this EXACT order from TODO_CHECKLIST.md:

1. Phase 1: Core Infrastructure (Application structure, Routing, Layouts, Theme)
2. Phase 2: Component Migration (Essential components, File management UI)
3. Phase 3: Tauri Integration (Service layer, File operations, Performance)
4. Phase 4: Advanced Features (Animations, Search, Keyboard shortcuts)
5. Phase 5: Polish & Optimization (Testing, Documentation, Performance)

### Before Any Code Changes

```bash
# Always run these commands first
yarn typecheck  # Ensure no existing type errors
yarn lint       # Ensure code quality
yarn test       # Ensure tests pass
git status         # Ensure clean working directory
```

### After Each Implementation

```bash
# Run these commands after EVERY change
yarn typecheck  # Verify no type errors introduced
yarn lint       # Verify code quality maintained
yarn dev        # Test functionality works
```

### Component Migration Strategy

When migrating components from references/minimal-vite-ts:

1. **Copy** the component files
2. **Remove** unnecessary features (auth, e-commerce, blog)
3. **Adapt** to file management context
4. **Simplify** complex dependencies
5. **Test** with mock data before integration

### State Management Rules

- Keep Zustand for global app state
- Use React Context for theme/settings
- Local state for component-specific data
- No Redux or other state libraries

### Styling Approach

- Use Material-UI components as base
- Adapt reference theme system
- Keep consistent with desktop application patterns
- No Tailwind CSS (using MUI's sx prop and theme)

### File System Integration

When implementing file operations:

1. Start with mock data
2. Create TypeScript interfaces
3. Implement Tauri commands
4. Add error handling
5. Test with real file system

### Performance Requirements

- Virtual scrolling for > 100 items
- Lazy load all images/thumbnails
- Debounce search/filter inputs (300ms)
- Progressive loading for large directories
- Memory limit: 200MB for 100k files

### Critical Path Items

These MUST work before considering phase complete:

- Application loads without errors
- Routing navigates correctly
- File listing displays
- Theme switching works
- Tauri commands execute

### Common Pitfalls to Avoid

1. **Don't copy everything** - Many reference components aren't needed
2. **Don't break existing features** - Test thoroughly
3. **Don't ignore TypeScript errors** - Fix immediately
4. **Don't skip tests** - Quality checks are mandatory
5. **Don't over-engineer** - Start simple, enhance later

### Reference File Locations

Key files to reference during migration:

```
references/minimal-vite-ts/
├── src/app.tsx              # Provider composition pattern
├── src/routes/              # Routing architecture
├── src/layouts/dashboard/   # Layout system
├── src/theme/              # Theme configuration
├── src/components/         # Component library
└── src/sections/file-manager/ # File UI components
```

### Debugging Tips

If something breaks:

1. Check browser console for errors
2. Check Tauri console (terminal)
3. Verify all imports are correct
4. Check TypeScript errors
5. Review MIGRATION_GUIDE.md for context

### Git Commit Convention

Use conventional commits:

```bash
feat(phase-1): implement router provider
fix(theme): resolve dark mode toggle
refactor(components): simplify file grid
test(files): add file listing tests
docs: update migration progress
```

### Questions to Ask Before Implementation

1. Does this preserve existing functionality?
2. Is this the simplest solution?
3. Will this scale to thousands of files?
4. Have I tested this change?
5. Is the code type-safe?

# Important Quality Gates

Never proceed to next phase until:

- [ ] All checkboxes in current phase completed
- [ ] yarn typecheck passes
- [ ] yarn lint passes
- [ ] yarn dev works without console errors
- [ ] Basic functionality tested manually

Remember: The goal is a production-ready file cataloger that combines Spacedrive's powerful patterns with a professional UI. Quality over speed.
