# Meta-Component System Implementation Plan

## Overview

Transform FileCataloger from pre-defined components to a Notion-like meta-component system where users create custom components from 4 basic building block types.

**Start Date:** 2025-10-26
**Target Completion:** TBD
**Status:** Phase 1-3 Complete ✅

---

## 🎯 Project Goals

- [ ] Enable users to create custom components from basic types (Text, Select, Date, Number)
- [ ] Provide component library management UI
- [ ] Support global and local component scopes
- [ ] Implement drag-and-drop pattern builder with custom components
- [ ] Enable inline option creation for Select components (Notion-style)
- [ ] Support component templates and import/export
- [ ] Maintain backward compatibility with existing patterns

---

## 📋 Implementation Phases

### Phase 1: Core Data Architecture ⏱️ Est. 3-4 days

#### 1.1 Type Definitions & Models ✅

**File:** `src/shared/types/componentDefinition.ts` (NEW)

- [x] Create `ComponentDefinition` interface
  - [x] Add base fields: id, name, type, icon, color, scope
  - [x] Add metadata: createdAt, updatedAt, usageCount, lastUsed, isTemplate, favorite
- [x] Create `ComponentConfig` discriminated union for type-specific configs
  - [x] TextConfig: defaultValue, placeholder, maxLength
  - [x] SelectConfig: options[], allowInlineCreate, defaultOption
  - [x] DateConfig: dateFormat, dateSource
  - [x] NumberConfig: numberFormat, padding, prefix, autoIncrement, startNumber, incrementStep
- [x] Create `SelectOption` interface (id, label, color)
- [x] Create `ComponentInstance` interface (links definition to pattern usage)
- [x] Export type guards: isTextComponent, isSelectComponent, isDateComponent, isNumberComponent

**File:** `src/shared/types.ts` (MODIFY)

- [x] Update `RenameComponent` to use `ComponentInstance` structure
- [x] Add migration types: `LegacyRenameComponent` → `ComponentInstance`
- [x] Update `RenamePattern` to use new component structure
- [x] Update `SavedPattern` to include componentDefinitions reference

**File:** `src/shared/enums.ts` (MODIFY)

- [x] Add `ComponentType` enum: TEXT, SELECT, DATE, NUMBER
- [x] Add `ComponentScope` enum: GLOBAL, LOCAL
- [x] Add `DateSource` enum: CURRENT, FILE_CREATED, FILE_MODIFIED, CUSTOM
- [x] Add `NumberFormat` enum: PLAIN, PADDED

#### 1.2 Constants & Configuration ✅

**File:** `src/renderer/constants/componentTypes.ts` (NEW)

- [x] Define `COMPONENT_TYPE_METADATA` with icons, colors, labels
- [x] Define `DATE_FORMAT_OPTIONS` array with format examples
- [x] Define `NUMBER_PADDING_OPTIONS` (1, 2, 3, 4 digits)
- [x] Define `COMPONENT_LIMITS` (max components per library: 100, max options per select: 50)
- [x] Define `COMPONENT_VALIDATION_RULES` (name length, allowed characters)

**File:** `src/renderer/constants/componentTemplates.ts` (NEW)

- [x] Create `COMMON_TEMPLATE_PACK` definitions
- [x] Create `BUSINESS_TEMPLATE_PACK` definitions
- [x] Create `CREATIVE_TEMPLATE_PACK` definitions
- [x] Create `DEVELOPMENT_TEMPLATE_PACK` definitions
- [x] Export `TEMPLATE_PACKS` registry

---

### Phase 2: State Management ⏱️ Est. 2-3 days ✅

#### 2.1 Component Library Store ✅

**File:** `src/renderer/stores/componentLibraryStore.ts` (NEW)

- [x] Create Zustand store with Immer middleware
- [x] Define state interface:
  - [x] `components: Map<string, ComponentDefinition>`
  - [x] `isLoading: boolean`
  - [x] `error: string | null`
- [x] Implement component CRUD actions:
  - [x] `addComponent(definition: ComponentDefinition)`
  - [x] `updateComponent(id: string, updates: Partial<ComponentDefinition>)`
  - [x] `deleteComponent(id: string)`
  - [x] `duplicateComponent(id: string, newName: string)`
- [x] Implement option management (for Select components):
  - [x] `addOptionToComponent(componentId: string, option: SelectOption)`
  - [x] `updateOptionInComponent(componentId: string, optionId: string, updates: Partial<SelectOption>)`
  - [x] `removeOptionFromComponent(componentId: string, optionId: string)`
  - [x] `reorderOptionsInComponent(componentId: string, fromIndex: number, toIndex: number)`
- [x] Implement bulk operations:
  - [x] `setComponentsFromStorage(components: ComponentDefinition[])`
  - [x] `importComponents(components: ComponentDefinition[])`
  - [x] `exportComponent(id: string): ComponentDefinition`
- [x] Implement getters:
  - [x] `getComponent(id: string)`
  - [x] `getAllComponents()`
  - [x] `getComponentsByType(type: ComponentType)`
  - [x] `getFavoriteComponents()`
  - [x] `getRecentComponents(limit: number)`
  - [x] `getComponentCount()`
- [x] Implement utility actions:
  - [x] `toggleFavorite(id: string)`
  - [x] `incrementUsageCount(id: string)`
  - [x] `searchComponents(query: string)`

#### 2.2 Pattern Store Updates ✅

**File:** `src/renderer/stores/patternStore.ts` (MODIFY)

- [x] Update pattern state to store component instances (not definitions)
- [x] Add action: `addComponentInstance(patternId: string, definitionId: string)`
- [x] Add action: `updateComponentInstance(patternId: string, instanceId: string, updates)`
- [x] Add action: `removeComponentInstance(patternId: string, instanceId: string)`
- [x] Add action: `reorderComponentInstances(patternId: string, fromIndex: number, toIndex: number)`
- [x] Update pattern save logic to store instance references
- [ ] Add migration logic for legacy patterns (convert old components to instances) - _Moved to Phase 9_

---

### Phase 3: Business Logic & Utilities ⏱️ Est. 2-3 days ✅

#### 3.1 Component Service Layer ✅

**File:** `src/renderer/services/componentService.ts` (NEW)

- [x] Create `ComponentService` class
- [x] Implement `createComponent(type, name, config): ComponentDefinition`
  - [x] Generate UUID
  - [x] Validate name uniqueness
  - [x] Set default config based on type
  - [x] Initialize metadata
- [x] Implement `validateComponent(definition): ValidationResult`
  - [x] Check name length and characters
  - [x] Validate type-specific config
  - [x] Check for duplicate names
- [x] Implement `cloneComponent(definition, newName): ComponentDefinition`
- [x] Implement `resolveComponentInstance(instance, definition): ResolvedComponent`
  - [x] Merge instance overrides with definition config
  - [x] Return complete component ready for rendering

#### 3.2 Component Value Resolution ✅

**File:** `src/renderer/utils/componentValueResolver.ts` (NEW)

- [x] Create `resolveComponentValue(instance, context): string` function
- [x] Implement TEXT value resolution (return value or default)
- [x] Implement SELECT value resolution (lookup option label by id)
- [x] Implement DATE value resolution:
  - [x] Handle current date
  - [x] Handle file creation/modification date from context
  - [x] Format according to dateFormat config
- [x] Implement NUMBER value resolution:
  - [x] Handle auto-increment with context (file index)
  - [x] Apply padding
  - [x] Apply prefix
  - [x] Handle custom values

**File:** `src/renderer/utils/renameUtils.ts` (MODIFY)

- [ ] Update `generateRenamePreview()` to use new component resolution - _Deferred to Phase 9 (Integration)_
- [ ] Update filename construction to use resolved values - _Deferred to Phase 9 (Integration)_
- [ ] Maintain separator logic (\_) - _Deferred to Phase 9 (Integration)_
- [ ] Handle edge cases (empty components, missing values) - _Deferred to Phase 9 (Integration)_

#### 3.3 Migration Utilities ✅

**File:** `src/renderer/utils/componentMigration.ts` (NEW)

- [x] Create `migrateLegacyComponent(legacy): ComponentInstance` function
  - [x] Map `date` → Date component instance
  - [x] Map `fileName` → File Attribute formula (or Text)
  - [x] Map `counter` → Number component with auto-increment
  - [x] Map `text` → Text component instance
  - [x] Map `project` → Select component instance
- [x] Create `migrateLegacyPattern(pattern): SavedPattern` function
- [x] Create default component definitions for legacy types
- [x] Implement one-time migration on app startup - _Migration logic ready, execution in Phase 9_

---

### Phase 4: Custom Hooks ⏱️ Est. 2 days

#### 4.1 Component Library Hook

**File:** `src/renderer/hooks/useComponentLibrary.ts` (NEW)

- [ ] Create `useComponentLibrary()` hook
- [ ] Implement persistence:
  - [ ] `loadFromPreferences()` on mount
  - [ ] `saveToPreferences()` on changes
- [ ] Return component management functions:
  - [ ] `createComponent(type, name, config)`
  - [ ] `updateComponent(id, updates)`
  - [ ] `deleteComponent(id)`
  - [ ] `duplicateComponent(id, newName)`
- [ ] Return component queries:
  - [ ] `components` (all)
  - [ ] `favoriteComponents`
  - [ ] `recentComponents`
  - [ ] `getComponentsByType(type)`
- [ ] Handle loading and error states
- [ ] Implement debounced save (prevent excessive IPC calls)

#### 4.2 Component Template Hook

**File:** `src/renderer/hooks/useComponentTemplates.ts` (NEW)

- [ ] Create `useComponentTemplates()` hook
- [ ] Load template packs from constants
- [ ] Implement `importTemplate(templateId, options)` function
- [ ] Implement `getTemplatesByCategory()` function
- [ ] Track imported templates to prevent duplicates

#### 4.3 File Rename Hook Updates

**File:** `src/renderer/hooks/useFileRename.ts` (MODIFY)

- [ ] Update to work with ComponentInstance instead of RenameComponent
- [ ] Update preview generation to resolve component values
- [ ] Update validation logic
- [ ] Maintain backward compatibility during migration period

---

### Phase 5: UI Components - Component Library ⏱️ Est. 4-5 days

#### 5.1 Component Library Manager (Main Screen)

**File:** `src/renderer/features/componentLibrary/ComponentLibraryManager.tsx` (NEW)

- [ ] Create main container component
- [ ] Implement layout:
  - [ ] Header with title, search, filters, [+ New] button
  - [ ] Component grid/list view
  - [ ] Template packs section (collapsible)
  - [ ] Footer with stats (total components, storage used)
- [ ] Implement search functionality (filter by name)
- [ ] Implement type filter (All, Text, Select, Date, Number)
- [ ] Implement sort options (Name, Usage, Recent, Type)
- [ ] Implement view toggle (Grid/List)
- [ ] Handle empty state (no components yet)
- [ ] Handle loading state
- [ ] Handle error state

**File:** `src/renderer/features/componentLibrary/ComponentCard.tsx` (NEW)

- [ ] Create component card for grid view
- [ ] Display: icon, name, type label, usage count
- [ ] Implement hover state with actions:
  - [ ] Edit button
  - [ ] Duplicate button
  - [ ] Delete button (with confirmation)
  - [ ] Favorite toggle (star icon)
- [ ] Implement click to open edit modal
- [ ] Add drag handle for reordering (optional)
- [ ] Style based on component type color

**File:** `src/renderer/features/componentLibrary/ComponentListItem.tsx` (NEW)

- [ ] Create component row for list view
- [ ] Display: icon, name, type, usage count, last used date
- [ ] Implement inline actions (edit, duplicate, delete, favorite)
- [ ] Add expand/collapse for component details
- [ ] Show option count for Select components

#### 5.2 Component Create/Edit Modal

**File:** `src/renderer/features/componentLibrary/ComponentModal.tsx` (NEW)

- [ ] Create modal with tabs or single form
- [ ] Implement form fields:
  - [ ] Component name input (required, validated)
  - [ ] Type selector (4 buttons: Text, Select, Date, Number)
  - [ ] Icon picker (dropdown or grid)
  - [ ] Color picker (preset colors)
  - [ ] Scope selector (Global/Local radio buttons)
- [ ] Implement type-specific config sections:
  - [ ] Show/hide based on selected type
  - [ ] Smooth transition when switching types
- [ ] Implement validation:
  - [ ] Real-time name validation
  - [ ] Required field indicators
  - [ ] Show validation errors
- [ ] Implement actions:
  - [ ] Cancel (discard changes with confirmation if dirty)
  - [ ] Save (create or update)
  - [ ] Delete (for edit mode, with confirmation)
- [ ] Handle loading state during save
- [ ] Handle error state (show error message)

**File:** `src/renderer/features/componentLibrary/configSections/TextConfigSection.tsx` (NEW)

- [ ] Default value input
- [ ] Placeholder input
- [ ] Max length input (number, optional)
- [ ] Live preview of text component

**File:** `src/renderer/features/componentLibrary/configSections/SelectConfigSection.tsx` (NEW)

- [ ] Options list with add/edit/delete
- [ ] Option editor (label, color picker)
- [ ] Drag-and-drop reordering of options
- [ ] Import options from file button
- [ ] Import options from folder names button
- [ ] "Allow inline creation" checkbox
- [ ] Default option selector
- [ ] Live preview dropdown

**File:** `src/renderer/features/componentLibrary/configSections/DateConfigSection.tsx` (NEW)

- [ ] Format dropdown (YYYYMMDD, YYYY-MM-DD, etc.)
- [ ] Date source radio buttons (Current, File Created, File Modified, Custom)
- [ ] Custom date picker (if Custom selected)
- [ ] Live preview showing formatted date

**File:** `src/renderer/features/componentLibrary/configSections/NumberConfigSection.tsx` (NEW)

- [ ] Format selector (Plain/Padded)
- [ ] Padding dropdown (1, 2, 3, 4 digits)
- [ ] Prefix input (optional)
- [ ] Auto-increment checkbox
- [ ] Start number input (if auto-increment enabled)
- [ ] Increment step input (if auto-increment enabled)
- [ ] Live preview showing formatted number

#### 5.3 Template Browser

**File:** `src/renderer/features/componentLibrary/TemplateBrowser.tsx` (NEW)

- [ ] Display template packs in grid
- [ ] Show pack name, description, component count
- [ ] Implement expand to see components in pack
- [ ] Show preview of each component
- [ ] Implement select components to import (checkboxes)
- [ ] Implement "Import All" vs "Import Selected"
- [ ] Handle conflicts (component name already exists)
- [ ] Show success message after import
- [ ] Update component library after import

**File:** `src/renderer/features/componentLibrary/TemplatePackCard.tsx` (NEW)

- [ ] Display pack icon, name, description
- [ ] Show component count and types
- [ ] Implement expand/collapse for component list
- [ ] Show which components are already imported
- [ ] Style imported components differently

---

### Phase 6: UI Components - Pattern Builder Integration ⏱️ Est. 4-5 days

#### 6.1 Pattern Builder Updates

**File:** `src/renderer/features/fileRename/RenamePatternBuilder/index.tsx` (MODIFY)

- [ ] Add new sections:
  - [ ] "MY COMPONENTS" section (user-created components)
  - [ ] "BASIC TYPES" section (quick-create buttons)
- [ ] Update component list rendering:
  - [ ] Map over user components from library
  - [ ] Group by type or show all
  - [ ] Implement scrolling for many components
- [ ] Add action buttons:
  - [ ] [+ New Component] → opens ComponentModal
  - [ ] [📚 Manage Library] → opens ComponentLibraryManager
- [ ] Update drag-and-drop logic:
  - [ ] Handle dragging from component library to pattern
  - [ ] Create component instance on drop
  - [ ] Maintain existing reorder logic within pattern
- [ ] Update pattern area rendering:
  - [ ] Show component instances with resolved names
  - [ ] Show current values/preview for each instance
  - [ ] Add settings gear icon to each instance
- [ ] Update empty state message

**File:** `src/renderer/features/fileRename/ComponentLibrarySection.tsx` (NEW)

- [ ] Create section header: "MY COMPONENTS (count)"
- [ ] Implement component grid (scrollable)
- [ ] Render ComponentChip for each component
- [ ] Implement search/filter within section (optional)
- [ ] Handle empty state (no custom components yet)
- [ ] Add [+ New Component] button

**File:** `src/renderer/features/fileRename/BasicTypesSection.tsx` (NEW)

- [ ] Create section header: "BASIC TYPES (Quick Create)"
- [ ] Render 4 type buttons (Text, Select, Date, Number)
- [ ] Implement click handler → opens QuickCreateModal
- [ ] Style buttons with type colors and icons

**File:** `src/renderer/features/fileRename/ComponentChip.tsx` (NEW)

- [ ] Create draggable component chip
- [ ] Display: icon, name, type (small text)
- [ ] Implement drag start (set data transfer)
- [ ] Style with component type color
- [ ] Hover state with subtle animation
- [ ] Click to see component details (tooltip or modal)

#### 6.2 Pattern Instance Configuration

**File:** `src/renderer/features/fileRename/ComponentInstanceCard.tsx` (NEW)

- [ ] Create card for component instance in pattern
- [ ] Display: icon, name, current value/preview
- [ ] Implement drag handle for reordering
- [ ] Implement settings gear icon
- [ ] Click gear → open ComponentInstanceConfig panel
- [ ] Implement remove button (x)
- [ ] Style with component type color
- [ ] Show validation errors if any

**File:** `src/renderer/features/fileRename/ComponentInstanceConfig.tsx` (NEW)

- [ ] Create slide-out panel or popover for instance config
- [ ] Show component name and type (read-only)
- [ ] Implement type-specific value inputs:
  - [ ] TEXT: text input for value
  - [ ] SELECT: dropdown with options (+ inline create if enabled)
  - [ ] DATE: date picker or use current/file date radio
  - [ ] NUMBER: number input or use auto-increment
- [ ] Show "Override global settings" toggle (for local overrides)
- [ ] Show overridable settings if toggle enabled
- [ ] Implement Cancel/Apply buttons
- [ ] Live preview update on change

**File:** `src/renderer/features/fileRename/SelectInstanceConfig.tsx` (NEW)

- [ ] Render dropdown with options from component definition
- [ ] Implement search/filter for many options
- [ ] Implement inline option creation (if enabled):
  - [ ] Type new value
  - [ ] Press Enter to create
  - [ ] Update component definition
- [ ] Show option colors
- [ ] Handle empty options gracefully

#### 6.3 Quick Create Modal

**File:** `src/renderer/features/fileRename/QuickCreateModal.tsx` (NEW)

- [ ] Create compact modal for quick component creation
- [ ] Pre-select type based on which button was clicked
- [ ] Show minimal fields:
  - [ ] Name input (required)
  - [ ] Key config option (e.g., format for Date, options for Select)
  - [ ] "Save to library" checkbox (checked by default)
- [ ] Implement Create button:
  - [ ] Validate input
  - [ ] Create component definition (if save to library)
  - [ ] Add to current pattern immediately
- [ ] Implement Cancel button
- [ ] Show error state if validation fails

---

### Phase 7: Component Import/Export ⏱️ Est. 2 days

#### 7.1 Export Functionality

**File:** `src/renderer/features/componentLibrary/ExportDialog.tsx` (NEW)

- [ ] Create export dialog
- [ ] Show component selection (checkboxes)
- [ ] Implement "Select All" / "Deselect All"
- [ ] Show export format options:
  - [ ] JSON (single file)
  - [ ] Individual files (one per component)
- [ ] Implement "Export" button
- [ ] Trigger file save dialog (electron)
- [ ] Generate JSON export with metadata
- [ ] Show success message with file location

**File:** `src/renderer/utils/componentExport.ts` (NEW)

- [ ] Create `exportComponentToJSON(component): string` function
- [ ] Create `exportComponentsToJSON(components): string` function
- [ ] Include version metadata for future compatibility
- [ ] Validate exported JSON structure

#### 7.2 Import Functionality

**File:** `src/renderer/features/componentLibrary/ImportDialog.tsx` (NEW)

- [ ] Create import dialog
- [ ] Implement file picker (electron)
- [ ] Parse and validate JSON
- [ ] Show preview of components to import
- [ ] Detect naming conflicts
- [ ] Offer conflict resolution options:
  - [ ] Skip existing
  - [ ] Rename imported (append number)
  - [ ] Overwrite existing
- [ ] Implement "Import" button
- [ ] Show progress during import
- [ ] Show summary of imported components

**File:** `src/renderer/utils/componentImport.ts` (NEW)

- [ ] Create `parseComponentJSON(json): ComponentDefinition[]` function
- [ ] Create `validateImportedComponent(component): ValidationResult` function
- [ ] Implement version compatibility checks
- [ ] Handle missing fields with defaults
- [ ] Generate new UUIDs for imported components

---

### Phase 8: IPC & Persistence ⏱️ Est. 2 days

#### 8.1 IPC Handlers

**File:** `src/main/ipc/componentHandlers.ts` (NEW)

- [ ] Create IPC handler: `component:save-library`
  - [ ] Receive component library data
  - [ ] Save to preferences/storage
  - [ ] Return success/error
- [ ] Create IPC handler: `component:load-library`
  - [ ] Load component library from storage
  - [ ] Return component definitions
- [ ] Create IPC handler: `component:export`
  - [ ] Receive component data and file path
  - [ ] Write JSON to file system
  - [ ] Return success/error
- [ ] Create IPC handler: `component:import`
  - [ ] Receive file path
  - [ ] Read and parse JSON
  - [ ] Return parsed components

**File:** `src/preload/index.ts` (MODIFY)

- [ ] Add IPC channel whitelist entries:
  - [ ] `component:save-library`
  - [ ] `component:load-library`
  - [ ] `component:export`
  - [ ] `component:import`
- [ ] Expose APIs in window.api:
  - [ ] `saveComponentLibrary(data)`
  - [ ] `loadComponentLibrary()`
  - [ ] `exportComponents(components, filePath)`
  - [ ] `importComponents(filePath)`

#### 8.2 Storage Schema

**File:** `src/main/services/storageService.ts` (MODIFY)

- [ ] Add storage key: `componentLibrary`
- [ ] Implement JSON serialization/deserialization
- [ ] Implement version migration for storage schema
- [ ] Handle storage errors gracefully
- [ ] Implement backup before overwrite

**Storage Structure:**

```json
{
  "version": "1.0",
  "components": {
    "uuid-1": {
      /* ComponentDefinition */
    },
    "uuid-2": {
      /* ComponentDefinition */
    }
  },
  "metadata": {
    "lastUpdated": 1234567890,
    "componentCount": 2
  }
}
```

---

### Phase 9: Migration & Backward Compatibility ⏱️ Est. 2-3 days

#### 9.1 One-Time Migration

**File:** `src/renderer/migrations/componentMigration.ts` (NEW)

- [ ] Create migration runner
- [ ] Check if migration already completed (flag in storage)
- [ ] Load existing patterns from storage
- [ ] Create default component definitions for legacy types:
  - [ ] Date component (name: "Date", format: YYYYMMDD)
  - [ ] File Name component (Text type, formula-based or hardcoded)
  - [ ] Counter component (Number, auto-increment, padding: 3)
  - [ ] Text component (Text type)
  - [ ] Project component (Select type, empty options)
- [ ] Convert legacy pattern components to instances
- [ ] Save migrated patterns
- [ ] Save default component library
- [ ] Set migration completed flag
- [ ] Log migration results

**File:** `src/renderer/App.tsx` (MODIFY)

- [ ] Add migration check on app startup
- [ ] Run migration if needed (before rendering main UI)
- [ ] Show migration progress/status
- [ ] Handle migration errors gracefully
- [ ] Show notification after successful migration

#### 9.2 Fallback & Error Handling

**File:** `src/renderer/utils/componentFallback.ts` (NEW)

- [ ] Create fallback logic for missing component definitions
- [ ] Create default component definition generator
- [ ] Handle corrupted component data
- [ ] Log warnings for fallback usage
- [ ] Provide user-facing error messages

---

### Phase 10: Testing ⏱️ Est. 3-4 days

#### 10.1 Unit Tests

**File:** `src/renderer/stores/componentLibraryStore.test.ts` (NEW)

- [ ] Test component CRUD operations
- [ ] Test option management for Select components
- [ ] Test getters and queries
- [ ] Test store state persistence
- [ ] Test error handling

**File:** `src/renderer/utils/componentValueResolver.test.ts` (NEW)

- [ ] Test TEXT resolution (value, default, empty)
- [ ] Test SELECT resolution (lookup by id, missing option)
- [ ] Test DATE resolution (all formats, all sources)
- [ ] Test NUMBER resolution (plain, padded, prefix, auto-increment)

**File:** `src/renderer/utils/componentMigration.test.ts` (NEW)

- [ ] Test legacy component conversion
- [ ] Test legacy pattern migration
- [ ] Test edge cases (empty patterns, missing fields)

**File:** `src/renderer/services/componentService.test.ts` (NEW)

- [ ] Test component creation
- [ ] Test validation logic
- [ ] Test cloning

#### 10.2 Integration Tests

**File:** `src/renderer/features/componentLibrary/ComponentLibraryManager.test.tsx` (NEW)

- [ ] Test rendering component list
- [ ] Test search and filter
- [ ] Test component creation flow
- [ ] Test component editing
- [ ] Test component deletion with confirmation

**File:** `src/renderer/features/fileRename/RenamePatternBuilder.test.tsx` (NEW)

- [ ] Test adding components to pattern
- [ ] Test configuring component instances
- [ ] Test removing components
- [ ] Test reordering components
- [ ] Test pattern preview updates

#### 10.3 E2E Tests

**File:** `tests/e2e/componentLibrary.spec.ts` (NEW)

- [ ] Test complete component creation workflow
- [ ] Test using custom components in patterns
- [ ] Test inline option creation for Select
- [ ] Test pattern save and reload
- [ ] Test component export/import
- [ ] Test template import

**File:** `tests/e2e/migration.spec.ts` (NEW)

- [ ] Test migration from legacy patterns
- [ ] Test backward compatibility
- [ ] Test migrated patterns work correctly

---

### Phase 11: Documentation ⏱️ Est. 2 days

#### 11.1 User Documentation

**File:** `docs/user-guide/meta-components.md` (NEW)

- [ ] Write "Understanding Components" section
- [ ] Write "Creating Your First Component" tutorial
- [ ] Write "Component Types Reference" (all 4 types)
- [ ] Write "Using Components in Patterns" guide
- [ ] Write "Component Library Management" guide
- [ ] Write "Importing Templates" guide
- [ ] Write "Sharing Components" guide
- [ ] Add screenshots and examples

**File:** `docs/user-guide/migration-guide.md` (NEW)

- [ ] Explain automatic migration process
- [ ] Document changes from old to new system
- [ ] Provide troubleshooting tips
- [ ] Explain backward compatibility

#### 11.2 Developer Documentation

**File:** `docs/developer/component-architecture.md` (NEW)

- [ ] Document component system architecture
- [ ] Explain ComponentDefinition vs ComponentInstance
- [ ] Document type-specific configs
- [ ] Explain value resolution process
- [ ] Document storage schema
- [ ] Add architecture diagrams

**File:** `docs/developer/adding-component-types.md` (NEW)

- [ ] Guide for adding new component types (future)
- [ ] Explain type system extensions
- [ ] Document required interfaces
- [ ] Provide code examples

#### 11.3 Update Existing Docs

**File:** `CLAUDE.md` (MODIFY)

- [ ] Update architecture overview
- [ ] Document new file structure
- [ ] Update common tasks section
- [ ] Add component system quick reference

---

### Phase 12: Polish & Optimization ⏱️ Est. 2-3 days

#### 12.1 Performance Optimization

- [ ] Optimize component library rendering (virtualization if >100 components)
- [ ] Implement memoization for component resolution
- [ ] Debounce pattern preview updates
- [ ] Optimize storage writes (batch updates)
- [ ] Profile and optimize render performance
- [ ] Implement lazy loading for template packs

#### 12.2 UX Improvements

- [ ] Add keyboard shortcuts:
  - [ ] Cmd+N: New component
  - [ ] Cmd+F: Search components
  - [ ] Cmd+E: Edit selected component
  - [ ] Delete: Delete selected component
- [ ] Add tooltips for all actions
- [ ] Improve error messages (user-friendly)
- [ ] Add loading skeletons
- [ ] Add empty state illustrations
- [ ] Implement undo/redo for component edits (optional)
- [ ] Add component usage preview (where is it used)

#### 12.3 Accessibility

- [ ] Ensure keyboard navigation works throughout
- [ ] Add ARIA labels to all interactive elements
- [ ] Test with screen reader
- [ ] Ensure sufficient color contrast
- [ ] Add focus indicators
- [ ] Support reduced motion preferences

#### 12.4 Error Handling & Validation

- [ ] Add comprehensive error boundaries
- [ ] Implement graceful degradation
- [ ] Add validation error messages
- [ ] Implement retry logic for failed operations
- [ ] Add error reporting/logging
- [ ] Show user-friendly error dialogs

---

## 📊 Progress Tracking

### Overall Progress

- [ ] Phase 1: Core Data Architecture (0/6 tasks)
- [ ] Phase 2: State Management (0/2 tasks)
- [ ] Phase 3: Business Logic & Utilities (0/3 tasks)
- [ ] Phase 4: Custom Hooks (0/3 tasks)
- [ ] Phase 5: UI Components - Component Library (0/3 tasks)
- [ ] Phase 6: UI Components - Pattern Builder Integration (0/3 tasks)
- [ ] Phase 7: Component Import/Export (0/2 tasks)
- [ ] Phase 8: IPC & Persistence (0/2 tasks)
- [ ] Phase 9: Migration & Backward Compatibility (0/2 tasks)
- [ ] Phase 10: Testing (0/3 tasks)
- [ ] Phase 11: Documentation (0/3 tasks)
- [ ] Phase 12: Polish & Optimization (0/4 tasks)

**Total Tasks:** 36 major sections
**Completed:** 0
**In Progress:** 0
**Remaining:** 36

---

## 🚀 Getting Started

### Prerequisites

- [ ] Review current pattern system implementation
- [ ] Review Zustand store patterns in codebase
- [ ] Review IPC communication setup
- [ ] Set up development environment

### First Steps

1. **Start with Phase 1** - Core data models are foundation
2. **Test thoroughly** - Write tests as you build, not after
3. **Incremental deployment** - Use feature flags if needed
4. **User feedback** - Get feedback early and often

---

## 🔄 Release Strategy

### Alpha Release (Internal Testing)

- [ ] Complete Phases 1-6 (core functionality)
- [ ] Basic testing completed
- [ ] Migration working
- [ ] Internal dogfooding

### Beta Release (Limited Users)

- [ ] Complete Phases 7-9 (import/export, migration)
- [ ] Integration tests passing
- [ ] User documentation ready
- [ ] Performance optimization done

### Production Release

- [ ] All phases complete
- [ ] E2E tests passing
- [ ] Full documentation
- [ ] Migration thoroughly tested
- [ ] Performance benchmarks met

---

## 📝 Notes & Decisions

### Open Questions

1. Should we support component folders/categories for organization?
2. Should components have versions (for breaking changes)?
3. Should we implement component sharing server/API?
4. What analytics should we track?

### Design Decisions

- **Scope:** Chose both global and local to balance reusability and flexibility
- **Limit:** 100 components per library (soft limit with warnings)
- **Storage:** JSON in preferences (simple, portable, version-controllable)
- **Migration:** One-time automatic on first launch (with backup)

### Future Enhancements (Post-Launch)

- [ ] Formula components (advanced computed values)
- [ ] Multi-select components (multiple values)
- [ ] Conditional logic (if-then rules)
- [ ] Component marketplace/sharing platform
- [ ] Cloud sync for component libraries
- [ ] AI-powered pattern suggestions
- [ ] Component usage analytics dashboard

---

## 🆘 Troubleshooting

### Common Issues

**Migration fails:**

- Check logs in `~/Library/Application Support/FileCataloger/logs/`
- Ensure storage is not corrupted
- Try manual migration recovery

**Components not appearing:**

- Check component library loaded correctly
- Verify IPC channels working
- Check console for errors

**Pattern preview not updating:**

- Check component value resolution logic
- Verify store subscriptions working
- Check for render optimization issues

---

## 📚 References

- Notion Database Properties: https://notion.so/help/database-properties
- Zustand Documentation: https://zustand-demo.pmnd.rs/
- Electron IPC: https://www.electronjs.org/docs/latest/api/ipc-main
- React DnD: https://react-dnd.github.io/react-dnd/

---

**Last Updated:** 2025-10-26
**Maintained By:** FileCataloger Development Team
