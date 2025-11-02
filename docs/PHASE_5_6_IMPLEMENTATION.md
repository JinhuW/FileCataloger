# Phase 5-6 Implementation Guide: Component Library & Pattern Builder UI

**Document Version:** 1.0
**Created:** 2025-11-01
**Status:** Ready for Implementation
**Estimated Duration:** 8-10 days

---

## Table of Contents

1. [Overview](#overview)
2. [Current State](#current-state)
3. [Phase 5: Component Library UI](#phase-5-component-library-ui-4-5-days)
4. [Phase 6: Pattern Builder Integration](#phase-6-pattern-builder-integration-4-5-days)
5. [Testing Strategy](#testing-strategy)
6. [Implementation Checklist](#implementation-checklist)

---

## Overview

This document provides a detailed implementation plan for Phases 5 and 6 of the meta-component system, which focus on building the user interface for component management and pattern building.

### Prerequisites (Already Complete ✅)

- **Phase 1-3:** Core data architecture, state management, business logic
- **Phase 4:** Custom hooks (`useComponentLibrary`, `useComponentTemplates`)
- **Phase 8:** IPC handlers and persistence layer

### What We're Building

Transform FileCataloger from pre-defined components to a **Notion-like meta-component system** where users can:

1. **Create custom components** from 4 basic types (Text, Select, Date, Number)
2. **Manage a component library** with search, filter, favorites, and templates
3. **Build rename patterns** by dragging components into a builder
4. **Configure instances** with pattern-specific overrides
5. **Import/export** components and share them

---

## Current State

### Existing Shelf Rename Interface

```
┌─────────────────────────────────────────────────────────────────┐
│ FileCataloger                                              [×]  │
├──────────────────────┬──────────────────────────────────────────┤
│ Preview              │ Naming Pattern                           │
│ 1 files selected     │ ┌──────┬──────┬──────┬──────┐          │
│                      │ │Default│Custom│      │      │ Tabs    │
│ ┌─────────────────┐ │ └──────┴──────┴──────┴──────┘          │
│ │ 📁 购房计划      │ │                                          │
│ │    →            │ │ ┌────────────────────────────┐          │
│ └─────────────────┘ │ │  🎯 No pattern components  │          │
│                      │ │                            │          │
│                      │ │  Click components below to │          │
│                      │ │  build your pattern        │          │
│                      │ └────────────────────────────┘          │
│                      │                                          │
│                      │ AVAILABLE COMPONENTS                     │
│                      │ ┌──────┬──────┬──────┬──────┬──────┐  │
│                      │ │📅Date│📄File│🔢Cntr│📝Text│📁Proj│  │
│                      │ └──────┴──────┴──────┴──────┴──────┘  │
│                      │                                          │
│                      │ ℹ️ This is a built-in pattern.          │
│                      │    Create custom pattern to edit.       │
│                      │                                          │
│ ┌─────────────────┐ │ 📁 Users › jinhu › Desktop              │
│ │ Drop Files Here │ │                                [Save]    │
└──────────────────────┴──────────────────────────────────────────┘
```

### Current File Structure

```
src/renderer/
├── features/
│   └── fileRename/                    # Existing rename feature
│       ├── RenamePatternBuilder/      # To be enhanced
│       ├── FileRenamePreviewList/
│       ├── FileRenameShelf/
│       └── PatternTab/
├── stores/
│   ├── componentLibraryStore.ts       # ✅ Complete
│   └── patternStore.ts                # ✅ Complete
├── hooks/
│   ├── useComponentLibrary.ts         # ✅ Complete
│   └── useComponentTemplates.ts       # ✅ Complete
├── services/
│   └── componentService.ts            # ✅ Complete
└── utils/
    ├── componentValueResolver.ts      # ✅ Complete
    └── componentMigration.ts          # ✅ Complete
```

---

## Phase 5: Component Library UI (4-5 days)

Build the component library management interface where users create, edit, and organize custom components.

### 5.1 Component Library Manager (Main Screen)

**Estimated Time:** 2 days

#### Visual Design

```
┌────────────────────────────────────────────────────────────────┐
│ Component Library                                    [+ New] [×]│
├────────────────────────────────────────────────────────────────┤
│ 🔍 Search components...          [All▼] [Name▼] [Grid] [List] │
├────────────────────────────────────────────────────────────────┤
│ MY COMPONENTS (12)                                             │
│ ┌──────┬──────┬──────┬──────┬──────┬──────┐                  │
│ │📅Date│📝Desc│🔢Ver │🏷️Tag │📁Cat │📊Stat│                  │
│ │  ⭐ │      │  ⭐ │      │      │      │  (Cards)          │
│ └──────┴──────┴──────┴──────┴──────┴──────┘                  │
│ ┌──────┬──────┬──────┬──────┬──────┬──────┐                  │
│ │💼Dept│👤Name│📧Email│📞Phone│🌍Loc │📈Prio│                  │
│ │      │      │      │      │      │      │                  │
│ └──────┴──────┴──────┴──────┴──────┴──────┘                  │
│                                                                 │
│ ▼ TEMPLATE PACKS                                               │
│ ┌─────────────────────────────────────┐                       │
│ │ 📦 Common Pack (7 components)    [▼]│                       │
│ │ 💼 Business Pack (10 components) [▼]│                       │
│ │ 🎨 Creative Pack (10 components) [▼]│                       │
│ │ 💻 Development Pack (8 components)[▼]│                       │
│ └─────────────────────────────────────┘                       │
│                                                                 │
│ 📊 12 components • 2.4KB storage                    [Export All]│
└────────────────────────────────────────────────────────────────┘
```

#### File Structure

```typescript
src/renderer/features/componentLibrary/
├── ComponentLibraryManager.tsx       // Main container
├── ComponentLibraryHeader.tsx        // Header with search & actions
├── ComponentGrid.tsx                 // Grid view layout
├── ComponentList.tsx                 // List view layout
├── ComponentCard.tsx                 // Individual component card
├── ComponentListItem.tsx             // Individual list item
├── TemplateBrowser.tsx               // Template packs section
├── TemplatePackCard.tsx              // Template pack component
├── EmptyLibraryState.tsx            // Empty state UI
└── styles/
    └── componentLibrary.css          // Component-specific styles
```

#### Implementation Tasks

**Day 1: Layout & Header (6-8 hours)**

```typescript
// File: ComponentLibraryManager.tsx
interface ComponentLibraryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ComponentLibraryManager({ isOpen, onClose }: ComponentLibraryManagerProps) {
  const { components, isLoading, error } = useComponentLibrary();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ComponentType | 'all'>('all');
  const [sort, setSort] = useState<'name' | 'usage' | 'recent' | 'type'>('name');

  // Implementation...
}

// Tasks:
// - [ ] Create modal/dialog wrapper
// - [ ] Implement header with title and close button
// - [ ] Add search input with debounced filtering (300ms)
// - [ ] Add filter dropdown (All, Text, Select, Date, Number)
// - [ ] Add sort dropdown (Name, Usage, Recent, Type)
// - [ ] Add view toggle button (Grid/List)
// - [ ] Add [+ New] button to open ComponentModal
// - [ ] Implement responsive layout (mobile-friendly)
// - [ ] Add loading skeleton states
// - [ ] Add error boundary
```

**Day 2: Component Cards & Grid (6-8 hours)**

```typescript
// File: ComponentCard.tsx
interface ComponentCardProps {
  component: ComponentDefinition;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const ComponentCard = React.memo<ComponentCardProps>(({
  component,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="component-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onEdit(component.id)}
    >
      {/* Card content */}
    </div>
  );
});

// Card Features:
// - [ ] Display component icon (large, centered)
// - [ ] Display component name
// - [ ] Display type badge (color-coded)
// - [ ] Show usage count (bottom left)
// - [ ] Show last used date (bottom right)
// - [ ] Favorite star toggle (top-right corner)
// - [ ] Hover state with action buttons:
//   - Edit button (✏️)
//   - Duplicate button (📋)
//   - Delete button (🗑️)
// - [ ] Click anywhere to open edit modal
// - [ ] Drag handle for reordering (optional)
// - [ ] Color border based on component type
// - [ ] Tooltip on hover showing full details
// - [ ] Smooth animations (fade, scale)
```

**Day 3: Template Browser (6-8 hours)**

```typescript
// File: TemplateBrowser.tsx
export function TemplateBrowser() {
  const { templatePacks, importTemplate, importTemplatePack } = useComponentTemplates();
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());

  const handleImportPack = async (packId: string, selectedIds?: string[]) => {
    const result = await importTemplatePack(packId, selectedIds);
    if (result.success) {
      toast.success(`Imported ${result.imported} components`);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="template-browser">
      {/* Implementation */}
    </div>
  );
}

// Tasks:
// - [ ] Create collapsible template pack sections
// - [ ] Implement TemplatePackCard component
// - [ ] Show pack description and component count
// - [ ] Expand/collapse to show components in pack
// - [ ] Add checkboxes to select components to import
// - [ ] "Import All" vs "Import Selected" buttons
// - [ ] Conflict detection (show warning if name exists)
// - [ ] Show which components are already imported (grayed out)
// - [ ] Success/error toast notifications
// - [ ] Prevent importing duplicates
// - [ ] Show import progress for large packs
```

**Day 4: List View & Empty States (4-6 hours)**

```typescript
// File: ComponentListItem.tsx
interface ComponentListItemProps {
  component: ComponentDefinition;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export const ComponentListItem: React.FC<ComponentListItemProps> = ({
  component,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="component-list-item">
      {/* Table-like row */}
    </div>
  );
};

// List View Features:
// - [ ] Table-like layout with columns:
//   - Icon (fixed width, 40px)
//   - Name (flexible)
//   - Type badge (100px)
//   - Usage count (80px)
//   - Last used date (120px)
//   - Actions (120px)
// - [ ] Sortable columns (click header to sort)
// - [ ] Inline action buttons (always visible)
// - [ ] Expandable row to show full config
// - [ ] Keyboard navigation (arrow keys, Enter, Space)
// - [ ] Striped rows for readability
// - [ ] Hover state highlighting

// File: EmptyLibraryState.tsx
// - [ ] Large illustration or icon (🎨)
// - [ ] "Get started" heading
// - [ ] Helpful description text
// - [ ] Quick action buttons:
//   - "Create Your First Component"
//   - "Import from Templates"
//   - "Import from File"
// - [ ] Link to documentation/tutorial
```

**Day 5: Integration & Polish (4-6 hours)**

```typescript
// Integration Tasks:
// - [ ] Connect to useComponentLibrary hook
// - [ ] Implement real-time search filtering
// - [ ] Implement type filtering
// - [ ] Implement sorting (name, usage, recent, type)
// - [ ] Add keyboard shortcuts:
//   - Cmd+N: New component
//   - Cmd+F: Focus search
//   - Esc: Clear search / Close modal
//   - Delete: Delete selected component
// - [ ] Error handling for all operations
// - [ ] Loading states for async operations
// - [ ] Accessibility (ARIA labels, roles, focus management)
// - [ ] Animations (fade in, slide, scale)
// - [ ] Mobile responsive adjustments
// - [ ] Add confirmation dialogs for destructive actions
// - [ ] Persist view preference (grid/list)
// - [ ] Persist sort/filter preferences
```

---

### 5.2 Component Create/Edit Modal

**Estimated Time:** 2-3 days

#### Visual Design

```
┌────────────────────────────────────────────────────────┐
│ [Create Component] / [Edit: Component Name]       [×] │
├────────────────────────────────────────────────────────┤
│ Component Name *                                       │
│ ┌──────────────────────────────────────────────────┐  │
│ │ Project Name                                     │  │
│ └──────────────────────────────────────────────────┘  │
│ ⚠️ A component with this name already exists          │
│                                                        │
│ Type *                                                 │
│ ┌──────┬──────┬──────┬──────┐                        │
│ │📝Text│🎯Select│📅Date│🔢Number│  (Toggle buttons) │
│ └──────┴───────┴──────┴───────┘                       │
│                                                        │
│ Icon & Color                                           │
│ ┌────┐ ┌──────────────────────┐                      │
│ │ 📁 │ │ [Icon grid picker]   │                      │
│ └────┘ └──────────────────────┘                      │
│                                                        │
│ Colors: ● ● ● ● ● ● ● ●                               │
│                                                        │
│ Scope                                                  │
│ ◉ Global (Available in all patterns)                  │
│ ○ Local (This pattern only)                           │
│                                                        │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ SELECT CONFIGURATION                                   │
│                                                        │
│ Options                                    [+ Add Option]│
│ ┌──────────────────────────────────────┬──────┬─────┐ │
│ │ ⋮ ● Option 1                         │ [⋮] │ [×] │ │
│ │ ⋮ ● Option 2                         │ [⋮] │ [×] │ │
│ │ ⋮ ● Option 3                         │ [⋮] │ [×] │ │
│ └──────────────────────────────────────┴──────┴─────┘ │
│                                                        │
│ □ Allow inline option creation (Notion-style)         │
│                                                        │
│ Default Option                                         │
│ [Option 1 ▼]                                          │
│                                                        │
│ ─────────────────────────────────────────────────────  │
│                                                        │
│ PREVIEW                                                │
│ ┌──────────────────────────────────────────────────┐  │
│ │ 📁 Project Name ▼                                │  │
│ │   - Option 1                                     │  │
│ │   - Option 2                                     │  │
│ │   - Option 3                                     │  │
│ └──────────────────────────────────────────────────┘  │
│                                                        │
├────────────────────────────────────────────────────────┤
│                     [Cancel]  [Delete]  [Save]         │
└────────────────────────────────────────────────────────┘
```

#### File Structure

```typescript
src/renderer/features/componentLibrary/
├── ComponentModal.tsx                // Main modal wrapper
├── ComponentForm.tsx                 // Form container
├── ComponentBasicFields.tsx          // Name, type, icon, color
├── IconPicker.tsx                    // Icon selection grid
├── ColorPicker.tsx                   // Color selection palette
├── ScopePicker.tsx                   // Global/Local radio buttons
├── ComponentPreview.tsx              // Live preview panel
└── configSections/
    ├── TextConfigSection.tsx         // Text-specific config
    ├── SelectConfigSection.tsx       // Select-specific config
    ├── SelectOptionEditor.tsx        // Option editor component
    ├── DateConfigSection.tsx         // Date-specific config
    └── NumberConfigSection.tsx       // Number-specific config
```

#### Implementation Tasks

**Day 1: Modal Structure & Basic Fields (6-8 hours)**

```typescript
// File: ComponentModal.tsx
interface ComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  componentId?: string; // For edit mode
  initialType?: ComponentType; // For quick create
}

export function ComponentModal({ isOpen, onClose, componentId, initialType }: ComponentModalProps) {
  const { getComponent, createComponent, updateComponent, deleteComponent } = useComponentLibrary();
  const [formData, setFormData] = useState<Partial<ComponentDefinition>>(/* ... */);
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Implementation...
}

// Tasks:
// - [ ] Create modal shell with proper z-index
// - [ ] Implement header (title, close button)
// - [ ] Create footer with action buttons
// - [ ] Add form wrapper with validation
// - [ ] Implement name input with real-time validation
// - [ ] Create type selector (4 radio/toggle buttons)
// - [ ] Build IconPicker component (grid of 50+ icons)
// - [ ] Build ColorPicker with preset colors
// - [ ] Add ScopePicker (Global/Local radio buttons)
// - [ ] Show validation errors inline
// - [ ] Prevent modal close on backdrop click if dirty
// - [ ] Add "unsaved changes" confirmation dialog
```

**Day 2: Type-Specific Config Sections (6-8 hours)**

```typescript
// File: TextConfigSection.tsx
interface TextConfigSectionProps {
  config: TextConfig;
  onChange: (config: TextConfig) => void;
}

export const TextConfigSection: React.FC<TextConfigSectionProps> = ({ config, onChange }) => {
  return (
    <div className="config-section">
      <Input
        label="Default Value"
        value={config.defaultValue}
        onChange={(value) => onChange({ ...config, defaultValue: value })}
        placeholder="Enter default text..."
      />
      <Input
        label="Placeholder"
        value={config.placeholder}
        onChange={(value) => onChange({ ...config, placeholder: value })}
      />
      <Input
        label="Max Length"
        type="number"
        value={config.maxLength}
        onChange={(value) => onChange({ ...config, maxLength: Number(value) })}
        min={1}
        max={COMPONENT_LIMITS.MAX_TEXT_LENGTH}
      />
      <div className="character-counter">
        {config.defaultValue?.length || 0} / {config.maxLength || COMPONENT_LIMITS.MAX_TEXT_LENGTH}
      </div>
    </div>
  );
};

// SelectConfigSection.tsx Tasks:
// - [ ] Options list (sortable, drag-to-reorder)
// - [ ] Add option button with inline form
// - [ ] Option editor (label, color picker)
// - [ ] Delete option with confirmation
// - [ ] Duplicate option detection
// - [ ] "Allow inline creation" checkbox
// - [ ] Default option dropdown
// - [ ] Import options from:
//   - Text file (one per line)
//   - CSV file
//   - Folder names
// - [ ] Show option count limit (max 50)

// DateConfigSection.tsx Tasks:
// - [ ] Format dropdown with examples
// - [ ] Date source radio buttons:
//   - Current date
//   - File created date
//   - File modified date
//   - Custom date
// - [ ] Custom date picker (if Custom selected)
// - [ ] Live preview showing formatted date
// - [ ] Format examples in dropdown

// NumberConfigSection.tsx Tasks:
// - [ ] Format selector (Plain/Padded radio)
// - [ ] Padding dropdown (1-4 digits)
// - [ ] Prefix input (max 5 chars)
// - [ ] Auto-increment checkbox
// - [ ] Start number input (if auto-increment)
// - [ ] Increment step input (if auto-increment)
// - [ ] Live preview showing formatted number
// - [ ] Validation for min/max values
```

**Day 3: Option Management for Select (6-8 hours)**

```typescript
// File: SelectOptionEditor.tsx
interface SelectOptionEditorProps {
  option: SelectOption;
  onChange: (option: SelectOption) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const SelectOptionEditor: React.FC<SelectOptionEditorProps> = ({
  option,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown
}) => {
  return (
    <div className="option-editor" draggable>
      <div className="drag-handle">⋮</div>
      <div className="color-dot" style={{ backgroundColor: option.color }} />
      <input
        value={option.label}
        onChange={(e) => onChange({ ...option, label: e.target.value })}
        placeholder="Option label"
      />
      <ColorPicker
        color={option.color}
        onChange={(color) => onChange({ ...option, color })}
      />
      <button onClick={onDelete}>×</button>
    </div>
  );
};

// File: OptionImporter.tsx
// - [ ] File upload button
// - [ ] Support text file import (one option per line)
// - [ ] Support CSV import (label, color columns)
// - [ ] Support folder names import
// - [ ] Preview options before import
// - [ ] Conflict resolution:
//   - Skip duplicates
//   - Rename duplicates (append number)
//   - Replace duplicates
// - [ ] Show import progress
// - [ ] Show import summary
```

**Day 4: Preview & Validation (4-6 hours)**

```typescript
// File: ComponentPreview.tsx
interface ComponentPreviewProps {
  component: Partial<ComponentDefinition>;
  context?: ComponentResolutionContext;
}

export const ComponentPreview: React.FC<ComponentPreviewProps> = ({ component, context }) => {
  const previewValue = useMemo(() => {
    if (!component.type) return '';

    // Create temporary instance
    const instance: ComponentInstance = {
      id: 'preview',
      definitionId: 'preview',
      name: component.name || 'Preview',
      type: component.type,
      value: getPreviewValue(component),
    };

    return resolveComponentValue(instance, component as ComponentDefinition, context);
  }, [component, context]);

  return (
    <div className="component-preview">
      <h4>Preview</h4>
      <div className="preview-display">
        {renderPreview(component, previewValue)}
      </div>
    </div>
  );
};

// Validation Tasks:
// - [ ] Real-time name validation
// - [ ] Check name uniqueness (case-insensitive)
// - [ ] Validate required fields (name, type)
// - [ ] Type-specific validation:
//   - Text: max length
//   - Select: at least one option, unique labels
//   - Date: valid format string
//   - Number: valid ranges, padding
// - [ ] Show validation errors inline
// - [ ] Disable save button if invalid
// - [ ] Show error count in modal header
// - [ ] Clear errors on field change
```

**Day 5: Modal Actions & Integration (4-6 hours)**

```typescript
// Modal Actions Implementation

// Cancel button:
// - [ ] Check if form is dirty (has unsaved changes)
// - [ ] Show confirmation dialog if dirty
// - [ ] Close modal on confirm
// - [ ] Discard all changes

// Delete button (edit mode only):
// - [ ] Show confirmation dialog
// - [ ] Delete component from library
// - [ ] Close modal on success
// - [ ] Show success toast
// - [ ] Handle deletion errors

// Save button:
// - [ ] Validate all fields
// - [ ] Show validation errors if invalid
// - [ ] Create new component (create mode)
// - [ ] Update existing component (edit mode)
// - [ ] Show loading state during save
// - [ ] Close modal on success
// - [ ] Show success toast
// - [ ] Handle save errors
// - [ ] Update component library

// Keyboard Shortcuts:
// - [ ] Cmd+S: Save component
// - [ ] Esc: Cancel/Close (with confirmation if dirty)
// - [ ] Cmd+Enter: Save and close
// - [ ] Tab: Navigate between fields
// - [ ] Enter in text fields: Move to next field

// Integration:
// - [ ] Connect to useComponentLibrary hook
// - [ ] Load component data in edit mode
// - [ ] Handle create vs edit logic
// - [ ] Persist form state in localStorage (draft)
// - [ ] Auto-save draft every 30 seconds
// - [ ] Restore draft on reopen
// - [ ] Clear draft on successful save
```

---

## Phase 6: Pattern Builder Integration (4-5 days)

Enhance the existing pattern builder to work with the new component system.

### 6.1 Enhanced Pattern Builder Layout

**Estimated Time:** 3-4 days

#### Visual Design - Empty State

```
┌────────────────────────────────────────────────────────────────┐
│ NAMING PATTERN                                                 │
│ ┌──────┬──────┬──────┬──────┐                                 │
│ │Default│Custom│Saved │  +  │  (Pattern tabs)                │
│ └──────┴──────┴──────┴──────┘                                 │
│                                                                 │
│ PATTERN BUILDER                              [⚙️] [💾] [🗑️]   │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ Drag components here to build your rename pattern         ││
│ │                                                            ││
│ │ 🎯 No components yet                                       ││
│ │                                                            ││
│ │ Drag components from below or click Basic Types to start  ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ─────────────────────────────────────────────────────────────  │
│                                                                 │
│ MY COMPONENTS (12)                        [+ New] [📚 Manage] │
│ ┌──────┬──────┬──────┬──────┬──────┬──────┐                  │
│ │📅Date│📝Desc│🔢Ver │🏷️Tag │📁Cat │📊Stat│  (Draggable)   │
│ └──────┴──────┴──────┴──────┴──────┴──────┘                  │
│ ┌──────┬──────┬──────┬──────┬──────┬──────┐                  │
│ │💼Dept│👤Name│📧Email│📞Phone│🌍Loc │📈Prio│                  │
│ └──────┴──────┴──────┴──────┴──────┴──────┘                  │
│                                                    [Show More ▼]│
│                                                                 │
│ BASIC TYPES (Quick Create)                                     │
│ ┌──────┬──────┬──────┬──────┐                                │
│ │📝Text│🎯Select│📅Date│🔢Number│  (Click to quick create)    │
│ └──────┴───────┴──────┴───────┘                               │
│                                                                 │
│ 📁 Desktop                                            [Browse] │
└────────────────────────────────────────────────────────────────┘
```

#### Visual Design - With Components

```
┌────────────────────────────────────────────────────────────────┐
│ PATTERN BUILDER                              [⚙️] [💾] [🗑️]   │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            ││
│ │ │📅Date│ │📝Desc│ │🔢Ver │ │📁Cat │ │🔢Cntr│            ││
│ │ │⚙️ ×  │ │⚙️ ×  │ │⚙️ ×  │ │⚙️ ×  │ │⚙️ ×  │  (Instances)││
│ │ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘            ││
│ │                                                            ││
│ │ Preview: 20251101_Description_v1.2_Category_001.pdf       ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Instance Configuration Panel                              [×] │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ 📅 Date                                                    ││
│ │ Type: Date                                                 ││
│ │                                                            ││
│ │ Date Source                                                ││
│ │ ◉ Current date                                             ││
│ │ ○ File created date                                        ││
│ │ ○ File modified date                                       ││
│ │ ○ Custom date                                              ││
│ │                                                            ││
│ │ Format                                                     ││
│ │ [YYYYMMDD ▼]                                              ││
│ │                                                            ││
│ │ ☐ Override global settings                                ││
│ │                                                            ││
│ │ Preview: 20251101                                          ││
│ │                                                            ││
│ │                              [Cancel]  [Apply]             ││
│ └────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────┘
```

#### File Structure

```typescript
src/renderer/features/fileRename/
├── RenamePatternBuilder/
│   ├── index.tsx                       // Main pattern builder (MODIFY)
│   ├── PatternDropZone.tsx            // Drop zone for pattern (NEW)
│   ├── ComponentLibrarySection.tsx    // My Components section (NEW)
│   ├── BasicTypesSection.tsx          // Basic Types section (NEW)
│   ├── ComponentChip.tsx              // Draggable component chip (NEW)
│   ├── ComponentInstanceCard.tsx      // Instance in pattern (NEW)
│   ├── ComponentInstanceConfig.tsx    // Config panel (NEW)
│   ├── SelectInstanceConfig.tsx       // Select-specific config (NEW)
│   ├── QuickCreateModal.tsx           // Quick create modal (NEW)
│   └── PatternPreview.tsx             // Pattern preview (MODIFY)
```

#### Implementation Tasks

**Day 1: Component Library Section (6-8 hours)**

```typescript
// File: ComponentLibrarySection.tsx
interface ComponentLibrarySectionProps {
  onComponentClick: (componentId: string) => void;
  onNewComponent: () => void;
  onManageLibrary: () => void;
}

export const ComponentLibrarySection: React.FC<ComponentLibrarySectionProps> = ({
  onComponentClick,
  onNewComponent,
  onManageLibrary
}) => {
  const { components } = useComponentLibrary();
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  const displayComponents = useMemo(() => {
    const filtered = components.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
    return showAll ? filtered : filtered.slice(0, 12);
  }, [components, search, showAll]);

  return (
    <section className="component-library-section">
      <header>
        <h3>MY COMPONENTS ({components.length})</h3>
        <div className="actions">
          <button onClick={onNewComponent}>+ New</button>
          <button onClick={onManageLibrary}>📚 Manage</button>
        </div>
      </header>

      {components.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="component-grid">
            {displayComponents.map(component => (
              <ComponentChip
                key={component.id}
                component={component}
                onClick={() => onComponentClick(component.id)}
              />
            ))}
          </div>
          {!showAll && components.length > 12 && (
            <button onClick={() => setShowAll(true)}>
              Show More ({components.length - 12} more)
            </button>
          )}
        </>
      )}
    </section>
  );
};

// File: BasicTypesSection.tsx
// - [ ] Create "BASIC TYPES" header
// - [ ] Render 4 type buttons (Text, Select, Date, Number)
// - [ ] Click handler opens QuickCreateModal
// - [ ] Style with type-specific colors
// - [ ] Add tooltips explaining each type
// - [ ] Keyboard navigation support

// File: ComponentChip.tsx
interface ComponentChipProps {
  component: ComponentDefinition;
  onClick?: () => void;
  draggable?: boolean;
}

// - [ ] Render component icon and name
// - [ ] Show type badge (small)
// - [ ] Favorite star indicator
// - [ ] Draggable if draggable=true
// - [ ] Drag preview styling
// - [ ] Hover state with subtle animation
// - [ ] Click to show details tooltip
// - [ ] Color-coded border by type
```

**Day 2: Pattern Drop Zone & Instance Cards (6-8 hours)**

```typescript
// File: PatternDropZone.tsx
interface PatternDropZoneProps {
  instances: ComponentInstance[];
  onDrop: (componentId: string, index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (instanceId: string) => void;
  onConfigure: (instanceId: string) => void;
}

export const PatternDropZone: React.FC<PatternDropZoneProps> = ({
  instances,
  onDrop,
  onReorder,
  onRemove,
  onConfigure
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'component',
    drop: (item: { componentId: string }, monitor) => {
      // Handle drop
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div ref={drop} className={`pattern-drop-zone ${isOver ? 'drag-over' : ''}`}>
      {instances.length === 0 ? (
        <EmptyPatternState />
      ) : (
        <div className="pattern-instances">
          {instances.map((instance, index) => (
            <ComponentInstanceCard
              key={instance.id}
              instance={instance}
              index={index}
              onReorder={onReorder}
              onRemove={onRemove}
              onConfigure={onConfigure}
            />
          ))}
        </div>
      )}
      <PatternPreview instances={instances} />
    </div>
  );
};

// File: ComponentInstanceCard.tsx
interface ComponentInstanceCardProps {
  instance: ComponentInstance;
  index: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (instanceId: string) => void;
  onConfigure: (instanceId: string) => void;
}

// Features:
// - [ ] Display component icon and name
// - [ ] Show current value/preview
// - [ ] Settings gear icon button
// - [ ] Remove (×) button
// - [ ] Drag handle (⋮) for reordering
// - [ ] Click gear → opens config panel
// - [ ] Highlight on hover
// - [ ] Validation error indicator (red border)
// - [ ] Draggable for reordering
// - [ ] Drop target indicator during drag
```

**Day 3: Instance Configuration Panel (6-8 hours)**

```typescript
// File: ComponentInstanceConfig.tsx
interface ComponentInstanceConfigProps {
  instance: ComponentInstance;
  definition: ComponentDefinition;
  onSave: (updates: Partial<ComponentInstance>) => void;
  onClose: () => void;
}

export const ComponentInstanceConfig: React.FC<ComponentInstanceConfigProps> = ({
  instance,
  definition,
  onSave,
  onClose
}) => {
  const [localValue, setLocalValue] = useState(instance.value);
  const [overrideGlobal, setOverrideGlobal] = useState(!!instance.overrides);
  const [localOverrides, setLocalOverrides] = useState(instance.overrides || {});

  const handleApply = () => {
    onSave({
      value: localValue,
      overrides: overrideGlobal ? localOverrides : undefined,
    });
    onClose();
  };

  return (
    <div className="instance-config-panel slide-in-right">
      <header>
        <h3>{definition.icon} {definition.name}</h3>
        <span className="type-badge">{definition.type}</span>
        <button onClick={onClose}>×</button>
      </header>

      <div className="config-body">
        {renderValueInput(definition.type, localValue, setLocalValue, definition.config)}

        <div className="override-section">
          <label>
            <input
              type="checkbox"
              checked={overrideGlobal}
              onChange={(e) => setOverrideGlobal(e.target.checked)}
            />
            Override global settings
          </label>

          {overrideGlobal && (
            <div className="override-fields">
              {renderOverrideFields(definition.type, localOverrides, setLocalOverrides)}
            </div>
          )}
        </div>

        <ComponentPreview
          component={definition}
          instance={{ ...instance, value: localValue, overrides: localOverrides }}
        />
      </div>

      <footer>
        <button onClick={onClose}>Cancel</button>
        <button onClick={handleApply} className="primary">Apply</button>
      </footer>
    </div>
  );
};

// Tasks:
// - [ ] Slide-in animation from right
// - [ ] Component name and type display
// - [ ] Value input based on type:
//   - Text: text input
//   - Select: dropdown (use SelectInstanceConfig)
//   - Date: date picker or source selector
//   - Number: number input or auto-increment
// - [ ] "Override global settings" checkbox
// - [ ] Show override fields when enabled
// - [ ] Live preview updates
// - [ ] Cancel/Apply buttons
// - [ ] Keyboard shortcuts (Esc, Enter)
// - [ ] Prevent body scroll when open
// - [ ] Click outside to close (with confirmation if dirty)

// File: SelectInstanceConfig.tsx
// - [ ] Dropdown showing all options from definition
// - [ ] Search/filter for many options
// - [ ] Inline option creation (if allowInlineCreate):
//   - Input field at top of dropdown
//   - Type new value and press Enter
//   - Auto-adds option to definition
//   - Shows success feedback
// - [ ] Show option colors
// - [ ] Current selection highlighted
// - [ ] Handle empty options gracefully
// - [ ] Keyboard navigation (arrow keys, Enter)
```

**Day 4: Quick Create Modal (4-6 hours)**

```typescript
// File: QuickCreateModal.tsx
interface QuickCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: ComponentType;
  onCreated: (componentId: string) => void;
}

export const QuickCreateModal: React.FC<QuickCreateModalProps> = ({
  isOpen,
  onClose,
  type,
  onCreated
}) => {
  const { createComponent } = useComponentLibrary();
  const [name, setName] = useState('');
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [quickConfig, setQuickConfig] = useState<any>({});

  const handleCreate = async () => {
    // Validation
    if (!name.trim()) {
      toast.error('Component name is required');
      return;
    }

    // Create component
    const config = getDefaultConfigForType(type, quickConfig);
    const component = ComponentService.createComponent(type, name, config);

    if (saveToLibrary) {
      const componentId = createComponent(component);
      onCreated(componentId);
    } else {
      // Create temporary component (local scope)
      onCreated(component.id);
    }

    onClose();
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="sm">
      <DialogHeader>
        <h2>Quick Create {COMPONENT_TYPE_METADATA[type].label}</h2>
      </DialogHeader>

      <DialogBody>
        <Input
          label="Component Name"
          value={name}
          onChange={setName}
          placeholder={`My ${type} component`}
          autoFocus
        />

        {renderQuickConfigFields(type, quickConfig, setQuickConfig)}

        <Checkbox
          label="Save to component library"
          checked={saveToLibrary}
          onChange={setSaveToLibrary}
        />
      </DialogBody>

      <DialogFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleCreate} variant="primary">Create & Add to Pattern</Button>
      </DialogFooter>
    </Dialog>
  );
};

// Quick Config Fields by Type:
// Text:
//   - Default value input
// Select:
//   - Quick option creator (add 3-5 options)
//   - "Add option" button
// Date:
//   - Format dropdown (YYYYMMDD, YYYY-MM-DD, etc.)
// Number:
//   - Padding dropdown (1-4 digits)
//   - Prefix input
```

**Day 5: Drag-and-Drop & Integration (6-8 hours)**

```typescript
// Drag-and-Drop Implementation using @dnd-kit

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// Tasks:
// - [ ] Install and configure @dnd-kit
// - [ ] Wrap pattern builder in DndContext
// - [ ] Implement drag from ComponentLibrarySection
// - [ ] Implement drop into PatternDropZone
// - [ ] Implement reorder within PatternDropZone
// - [ ] Visual drag preview (component chip follows cursor)
// - [ ] Drop indicators (show where item will land)
// - [ ] Touch/mobile support
// - [ ] Keyboard support (arrow keys to reorder)
// - [ ] Accessibility (ARIA labels, screen reader support)

// Pattern Preview Updates:
// - [ ] Auto-update on pattern change
// - [ ] Show separator between components (_)
// - [ ] Resolve all component values
// - [ ] Show validation errors in preview
// - [ ] Update in real-time as user types
// - [ ] Handle empty values gracefully
// - [ ] Show file extension from context

// Integration:
// - [ ] Connect to patternStore
// - [ ] Load pattern on mount
// - [ ] Save pattern on change (debounced)
// - [ ] Handle component instance creation
// - [ ] Handle component instance updates
// - [ ] Handle component instance deletion
// - [ ] Handle component instance reordering
// - [ ] Update file rename preview list
```

---

### 6.2 Pattern Actions Toolbar

```typescript
// Pattern actions toolbar (top-right of pattern builder)

┌────────────────────────────────────┐
│ [⚙️ Settings] [💾 Save] [🗑️ Clear]│
└────────────────────────────────────┘

// File: PatternActionsToolbar.tsx
interface PatternActionsToolbarProps {
  pattern: RenamePattern;
  onSettings: () => void;
  onSave: () => void;
  onClear: () => void;
}

// Settings Dropdown:
// - [ ] Pattern separator (_, -, space, none)
// - [ ] Case conversion (none, upper, lower, title, camel, pascal)
// - [ ] Pattern name input
// - [ ] Pattern description textarea
// - [ ] Tags input (comma-separated)
// - [ ] Favorite checkbox
// - [ ] Apply button

// Save Action:
// - [ ] Validate pattern has at least one component
// - [ ] Validate all instance values are set
// - [ ] Save pattern with metadata
// - [ ] Store component instances (not full definitions)
// - [ ] Show success toast notification
// - [ ] Add to saved patterns list
// - [ ] Update recent patterns

// Clear Action:
// - [ ] Show confirmation dialog
// - [ ] "Are you sure? This will remove all components from the pattern."
// - [ ] Confirm/Cancel buttons
// - [ ] Remove all component instances on confirm
// - [ ] Reset pattern to empty state
// - [ ] Keep settings (separator, case conversion)
```

---

### 6.3 Pattern Tab System

```typescript
// Enhanced pattern tabs

┌──────────────────────────────────────────┐
│ ┌──────┬──────┬──────┬──────┐           │
│ │Default│Custom│Saved │  +  │  (Tabs)  │
│ └──────┴──────┴──────┴──────┘           │
└──────────────────────────────────────────┘

// File: PatternTabs.tsx
interface PatternTabsProps {
  activeTab: 'default' | 'custom' | string;
  onTabChange: (tabId: string) => void;
  onNewPattern: () => void;
}

// Default Pattern Tab:
// - [ ] Read-only built-in pattern
// - [ ] Shows legacy components (Date, File Name, Counter, etc.)
// - [ ] "Create custom pattern to edit" message at bottom
// - [ ] Cannot drag/drop or modify
// - [ ] Can duplicate to custom pattern

// Custom Pattern Tab:
// - [ ] User's working pattern
// - [ ] Full edit capabilities
// - [ ] Autosaves changes to localStorage (every 5s)
// - [ ] Can be saved to "Saved Patterns"
// - [ ] Shows unsaved indicator (•) if modified

// Saved Patterns Tab:
// - [ ] Dropdown showing list of saved patterns
// - [ ] Click to load pattern
// - [ ] Replaces custom pattern content
// - [ ] Can edit loaded pattern
// - [ ] "Save" updates the saved pattern
// - [ ] "Save As" creates new saved pattern

// + Button (New Pattern):
// - [ ] Creates new blank custom pattern
// - [ ] Shows name dialog first
// - [ ] Switches to new pattern tab
// - [ ] Can duplicate current pattern
```

---

## Testing Strategy

### Unit Tests

```typescript
// Component Library Store Tests
describe('componentLibraryStore', () => {
  test('adds component to library', () => {
    const store = useComponentLibraryStore.getState();
    const component = createTestComponent('text');
    store.addComponent(component);
    expect(store.getComponent(component.id)).toEqual(component);
  });

  test('updates component', () => {
    // Test update logic
  });

  test('deletes component', () => {
    // Test delete logic
  });

  test('searches components', () => {
    // Test search filtering
  });
});

// Component Service Tests
describe('ComponentService', () => {
  test('creates valid component', () => {
    const component = ComponentService.createComponent('text', 'Test', {});
    expect(component.name).toBe('Test');
    expect(component.type).toBe('text');
  });

  test('validates component name uniqueness', () => {
    // Test validation
  });

  test('clones component with new name', () => {
    // Test cloning
  });
});

// Value Resolver Tests
describe('resolveComponentValue', () => {
  test('resolves text component value', () => {
    // Test text resolution
  });

  test('resolves select component value', () => {
    // Test select resolution
  });

  test('resolves date component with format', () => {
    // Test date resolution
  });

  test('resolves number component with auto-increment', () => {
    // Test number resolution
  });
});
```

### Integration Tests

```typescript
// Component Library Integration
describe('Component Library Flow', () => {
  test('creates component and adds to library', async () => {
    render(<ComponentLibraryManager />);

    // Click "New Component"
    fireEvent.click(screen.getByText('+ New'));

    // Fill form
    fireEvent.change(screen.getByLabelText('Component Name'), {
      target: { value: 'Project' }
    });

    // Select type
    fireEvent.click(screen.getByText('Select'));

    // Add options
    // ...

    // Save
    fireEvent.click(screen.getByText('Save'));

    // Verify component appears in library
    await waitFor(() => {
      expect(screen.getByText('Project')).toBeInTheDocument();
    });
  });

  test('imports template pack', async () => {
    // Test template import flow
  });

  test('searches and filters components', () => {
    // Test search/filter
  });
});

// Pattern Builder Integration
describe('Pattern Builder Flow', () => {
  test('drags component into pattern', async () => {
    render(<RenamePatternBuilder />);

    // Get component chip
    const chip = screen.getByTestId('component-chip-date');

    // Drag to pattern zone
    fireEvent.dragStart(chip);
    fireEvent.drop(screen.getByTestId('pattern-drop-zone'));

    // Verify instance created
    await waitFor(() => {
      expect(screen.getByTestId('instance-card-date')).toBeInTheDocument();
    });
  });

  test('configures component instance', async () => {
    // Test instance configuration
  });

  test('reorders components in pattern', async () => {
    // Test reordering
  });

  test('updates pattern preview', async () => {
    // Test preview updates
  });
});
```

### E2E Tests (Playwright)

```typescript
// File: tests/e2e/component-library.spec.ts

test.describe('Component Library', () => {
  test('complete component creation flow', async ({ page }) => {
    // 1. Open component library
    await page.click('[data-testid="manage-library-btn"]');
    await expect(page.locator('text=Component Library')).toBeVisible();

    // 2. Create new Select component
    await page.click('text=+ New');
    await page.fill('[name="name"]', 'Project Status');
    await page.click('text=Select');

    // 3. Add options
    await page.click('text=+ Add Option');
    await page.fill('[name="option-0-label"]', 'In Progress');
    await page.selectOption('[name="option-0-color"]', '#3b82f6');

    await page.click('text=+ Add Option');
    await page.fill('[name="option-1-label"]', 'Completed');

    // 4. Save component
    await page.click('text=Save');

    // 5. Verify component appears
    await expect(page.locator('text=Project Status')).toBeVisible();

    // 6. Close library
    await page.click('[data-testid="close-library-btn"]');
  });

  test('import template pack', async ({ page }) => {
    // Test template import
  });
});

test.describe('Pattern Builder', () => {
  test('create pattern with custom components', async ({ page }) => {
    // 1. Open shelf with files
    // 2. Drag component to pattern
    // 3. Configure instance
    // 4. See preview update
    // 5. Save pattern
    // 6. Execute rename
  });

  test('quick create component', async ({ page }) => {
    // 1. Click Basic Type button
    // 2. Enter name and config
    // 3. Component added to pattern
    // 4. Can configure instance
  });
});
```

---

## Implementation Checklist

### Phase 5: Component Library UI ✅

#### 5.1 Component Library Manager

- [ ] Create ComponentLibraryManager.tsx container
- [ ] Implement ComponentLibraryHeader with search
- [ ] Build ComponentGrid for grid view
- [ ] Build ComponentList for list view
- [ ] Create ComponentCard with hover actions
- [ ] Create ComponentListItem for table view
- [ ] Implement TemplateBrowser with packs
- [ ] Create TemplatePackCard with expand/collapse
- [ ] Build EmptyLibraryState component
- [ ] Add search filtering (debounced)
- [ ] Add type filtering dropdown
- [ ] Add sort dropdown (name, usage, recent, type)
- [ ] Add view toggle (grid/list)
- [ ] Implement keyboard shortcuts (Cmd+N, Cmd+F)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add accessibility (ARIA, focus management)
- [ ] Add animations (fade, slide)
- [ ] Make mobile responsive

#### 5.2 Component Create/Edit Modal

- [ ] Create ComponentModal.tsx wrapper
- [ ] Implement ComponentForm with validation
- [ ] Build ComponentBasicFields (name, type, icon, color)
- [ ] Create IconPicker grid component
- [ ] Create ColorPicker palette component
- [ ] Create ScopePicker (Global/Local)
- [ ] Build TextConfigSection component
- [ ] Build SelectConfigSection component
- [ ] Build SelectOptionEditor component
- [ ] Build DateConfigSection component
- [ ] Build NumberConfigSection component
- [ ] Create ComponentPreview panel
- [ ] Implement real-time validation
- [ ] Add "unsaved changes" confirmation
- [ ] Add keyboard shortcuts (Cmd+S, Esc)
- [ ] Handle create vs edit mode
- [ ] Implement delete confirmation
- [ ] Add success/error toasts
- [ ] Test all validation rules

#### 5.3 Template Browser

- [ ] Display template packs
- [ ] Expand/collapse packs
- [ ] Show components in pack
- [ ] Select components to import
- [ ] Import All vs Import Selected
- [ ] Detect naming conflicts
- [ ] Show import progress
- [ ] Display success/error messages

### Phase 6: Pattern Builder Integration ✅

#### 6.1 Component Library Section

- [ ] Create ComponentLibrarySection.tsx
- [ ] Build BasicTypesSection.tsx
- [ ] Create ComponentChip.tsx (draggable)
- [ ] Add [+ New] button functionality
- [ ] Add [📚 Manage] button functionality
- [ ] Implement "Show More" pagination
- [ ] Add empty state for no components
- [ ] Make chips draggable

#### 6.2 Pattern Drop Zone

- [ ] Create PatternDropZone.tsx
- [ ] Build ComponentInstanceCard.tsx
- [ ] Implement drag-and-drop with @dnd-kit
- [ ] Add drop indicators
- [ ] Support reordering instances
- [ ] Show empty pattern state
- [ ] Update PatternPreview component

#### 6.3 Instance Configuration

- [ ] Create ComponentInstanceConfig.tsx panel
- [ ] Build SelectInstanceConfig.tsx
- [ ] Add slide-in animation
- [ ] Implement value inputs by type
- [ ] Add "Override global settings" toggle
- [ ] Show override fields when enabled
- [ ] Update live preview
- [ ] Add Cancel/Apply buttons
- [ ] Handle keyboard shortcuts (Esc, Enter)

#### 6.4 Quick Create Modal

- [ ] Create QuickCreateModal.tsx
- [ ] Pre-select type
- [ ] Add minimal config fields
- [ ] Add "Save to library" checkbox
- [ ] Create and add to pattern
- [ ] Show validation errors

#### 6.5 Pattern Actions

- [ ] Create PatternActionsToolbar.tsx
- [ ] Implement Settings dropdown
- [ ] Implement Save action
- [ ] Implement Clear action (with confirmation)
- [ ] Add pattern metadata editing

#### 6.6 Pattern Tabs

- [ ] Update PatternTabs.tsx
- [ ] Support Default (read-only) tab
- [ ] Support Custom (editable) tab
- [ ] Support Saved Patterns dropdown
- [ ] Add + button for new pattern
- [ ] Show unsaved indicator (•)
- [ ] Implement autosave (5s debounce)

#### 6.7 Integration

- [ ] Connect to useComponentLibrary hook
- [ ] Connect to patternStore
- [ ] Update useFileRename hook
- [ ] Handle instance creation
- [ ] Handle instance updates
- [ ] Handle instance deletion
- [ ] Handle instance reordering
- [ ] Update preview generation
- [ ] Test complete flow end-to-end

### Testing ✅

#### Unit Tests

- [ ] ComponentLibraryStore tests
- [ ] ComponentService tests
- [ ] Value resolver tests
- [ ] Pattern store tests
- [ ] Validation tests

#### Integration Tests

- [ ] Component CRUD flow
- [ ] Template import flow
- [ ] Pattern builder interaction
- [ ] Instance configuration
- [ ] Drag-and-drop

#### E2E Tests

- [ ] Create component and use in pattern
- [ ] Import template pack
- [ ] Quick create component
- [ ] Save and load pattern
- [ ] Execute rename with custom components

---

## Tips for Implementation

### 1. Start with Data Flow

Before building UI, understand the data flow:

```
ComponentDefinition (global) → ComponentInstance (in pattern) → Resolved Value (for file)
```

### 2. Use TypeScript Strictly

All props, state, and data structures should be typed:

```typescript
// Good
interface ComponentCardProps {
  component: ComponentDefinition;
  onEdit: (id: string) => void;
}

// Bad
interface ComponentCardProps {
  component: any;
  onEdit: Function;
}
```

### 3. Keep Components Small

Each component should do one thing well:

- ComponentCard: Display component
- ComponentModal: Edit component
- ComponentInstanceConfig: Configure instance

### 4. Use Memoization

Prevent unnecessary re-renders:

```typescript
const ComponentCard = React.memo<ComponentCardProps>(({ component }) => {
  // Component implementation
});

const sortedComponents = useMemo(() => {
  return components.sort((a, b) => a.name.localeCompare(b.name));
}, [components]);
```

### 5. Handle Loading States

Always show feedback:

```typescript
{isLoading ? (
  <Skeleton count={6} />
) : components.length === 0 ? (
  <EmptyState />
) : (
  <ComponentGrid components={components} />
)}
```

### 6. Add Proper Error Boundaries

Catch errors gracefully:

```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <ComponentLibraryManager />
</ErrorBoundary>
```

### 7. Test Incrementally

Test each component as you build:

1. Unit test the logic
2. Integration test the flow
3. E2E test the user journey

### 8. Follow Accessibility Guidelines

- Use semantic HTML
- Add ARIA labels
- Support keyboard navigation
- Test with screen reader
- Ensure color contrast

### 9. Optimize Performance

- Virtualize long lists (react-window)
- Debounce search inputs
- Lazy load images/icons
- Use React.memo for expensive components
- Profile with React DevTools

### 10. Document as You Build

Add JSDoc comments for complex functions:

```typescript
/**
 * Resolves a component instance value for file naming
 * @param instance - The component instance with user values
 * @param definition - The component definition with config
 * @param context - Resolution context (file metadata, index, etc.)
 * @returns The resolved string value for the file name
 */
export function resolveComponentValue(
  instance: ComponentInstance,
  definition: ComponentDefinition,
  context: ComponentResolutionContext
): string {
  // Implementation
}
```

---

## Success Criteria

Phase 5-6 is complete when:

✅ Users can create custom components from 4 basic types
✅ Component library management UI is functional and intuitive
✅ Template packs can be imported successfully
✅ Components can be dragged into pattern builder
✅ Component instances can be configured individually
✅ Pattern preview updates in real-time
✅ Patterns can be saved and loaded
✅ All unit tests pass
✅ All integration tests pass
✅ E2E test scenarios work end-to-end
✅ UI is accessible (WCAG 2.1 AA)
✅ UI is responsive (mobile-friendly)
✅ No console errors or warnings
✅ Performance is acceptable (<100ms interactions)

---

## Next Steps After Phase 5-6

1. **Phase 7:** Import/Export UI (2 days)
2. **Phase 9:** Migration & Backward Compatibility (2-3 days)
3. **Phase 10:** Comprehensive Testing (3-4 days)
4. **Phase 11:** Documentation (2 days)
5. **Phase 12:** Polish & Optimization (2-3 days)

---

**Document End**

_For questions or clarifications, refer to IMPLEMENTATION_PLAN_META_COMPONENTS.md_
