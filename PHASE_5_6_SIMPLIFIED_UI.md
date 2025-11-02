# Phase 5-6 Simplified UI Design

**Based on Notion's Inline Component Creation Pattern**

---

## Design Philosophy

Instead of a complex modal-based system, we'll use **inline dropdown menus** integrated directly into the pattern builder, similar to Notion's property creation.

---

## Simplified Component Creation Flow

### Current Complex Flow ❌

```
Click "New Component" → Full-page modal → Fill 10+ fields → Save → Close → Find component → Drag to pattern
```

### New Streamlined Flow ✅

```
Click component type in pattern → Inline dropdown → Name + Quick config → Created & added immediately
```

---

## UI Design: Integrated Pattern Builder

### Main Interface (Simplified)

```
┌────────────────────────────────────────────────────────────────┐
│ FileCataloger - Rename Files                              [×] │
├──────────────────────┬──────────────────────────────────────────┤
│ Preview              │ Pattern Builder                          │
│ 3 files selected     │                                          │
│                      │ ┌────────────────────────────────────┐  │
│ ┌─────────────────┐ │ │ [+ Add Component ▼]                │  │
│ │ 📁 File 1        │ │ └────────────────────────────────────┘  │
│ │ 📄 File 2        │ │                                          │
│ │ 📊 File 3        │ │ No components yet                       │
│ └─────────────────┘ │ Click [+ Add Component] to start        │
│                      │                                          │
│                      │ Preview: (empty)                         │
│                      │                                          │
│                      │ 📁 /Users/jinhu/Desktop      [Browse]   │
│                      │                              [Rename]    │
└──────────────────────┴──────────────────────────────────────────┘
```

### Component Type Dropdown (Notion-style)

When user clicks **[+ Add Component ▼]**, show inline dropdown:

```
┌─────────────────────────────────────┐
│ 🔍 Search or select type...         │
├─────────────────────────────────────┤
│ BASIC TYPES                         │
│ ☐ 📝 Text          Simple text      │
│ ☐ 🎯 Select        Pick from list   │
│ ☐ 📅 Date          Date formatting  │
│ ☐ 🔢 Number        Counter/version  │
├─────────────────────────────────────┤
│ MY COMPONENTS (3)                   │
│ ☐ 📁 Project Name                   │
│ ☐ 📊 Status                         │
│ ☐ 🏷️ Category                       │
├─────────────────────────────────────┤
│ [📚 Browse Library...]              │
│ [+ Create New...]                   │
└─────────────────────────────────────┘
```

### Quick Config Popover (For New Components)

When selecting a basic type, show small popover:

```
┌───────────────────────────────────────┐
│ Create Text Component                 │
├───────────────────────────────────────┤
│ Name                                  │
│ ┌─────────────────────────────────┐  │
│ │ Project Name                    │  │
│ └─────────────────────────────────┘  │
│                                       │
│ Default Value (optional)              │
│ ┌─────────────────────────────────┐  │
│ │                                 │  │
│ └─────────────────────────────────┘  │
│                                       │
│ ☑ Save to library for reuse          │
│                                       │
│               [Cancel]  [Add]         │
└───────────────────────────────────────┘
```

```
┌───────────────────────────────────────┐
│ Create Select Component               │
├───────────────────────────────────────┤
│ Name                                  │
│ ┌─────────────────────────────────┐  │
│ │ Status                          │  │
│ └─────────────────────────────────┘  │
│                                       │
│ Options (one per line)                │
│ ┌─────────────────────────────────┐  │
│ │ Draft                           │  │
│ │ In Progress                     │  │
│ │ Complete                        │  │
│ └─────────────────────────────────┘  │
│                                       │
│ ☑ Save to library for reuse          │
│                                       │
│               [Cancel]  [Add]         │
└───────────────────────────────────────┘
```

### Pattern Builder with Components

After adding components:

```
┌────────────────────────────────────────────────────────────────┐
│ Pattern Builder                                                │
├────────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ [+ Add ▼]                │
│ │📅Date│ │📝Proj│ │🔢Ver │ │📊Stat│                           │
│ │  ⚙️  │ │  ⚙️  │ │  ⚙️  │ │  ⚙️  │  (Each has settings)     │
│ └──────┘ └──────┘ └──────┘ └──────┘                           │
│                                                                 │
│ Preview: 20251101_MyProject_v1.0_Draft.pdf                     │
│                                                                 │
│ Separator: [_ ▼]  Case: [None ▼]               [💾 Save Pattern]│
└────────────────────────────────────────────────────────────────┘
```

### Component Instance Settings (Inline Popover)

Click ⚙️ on any component to show settings:

```
   ┌──────┐
   │📅Date│
   │  ⚙️  │ ← Click here
   └──────┘
       ↓
┌─────────────────────────────────────┐
│ Date Settings                       │
├─────────────────────────────────────┤
│ Format                              │
│ ┌─────────────────────────────────┐│
│ │ YYYYMMDD ▼                      ││
│ └─────────────────────────────────┘│
│                                     │
│ Source                              │
│ ● Current date                      │
│ ○ File created date                 │
│ ○ File modified date                │
│                                     │
│ Preview: 20251101                   │
│                                     │
│              [Remove]  [Apply]      │
└─────────────────────────────────────┘
```

```
   ┌──────┐
   │🎯Stat│
   │  ⚙️  │
   └──────┘
       ↓
┌─────────────────────────────────────┐
│ Status Settings                     │
├─────────────────────────────────────┤
│ Select Value                        │
│ ┌─────────────────────────────────┐│
│ │ ● Draft                         ││
│ │ ○ In Progress                   ││
│ │ ○ Complete                      ││
│ │                                 ││
│ │ [+ Add new option...]           ││
│ └─────────────────────────────────┘│
│                                     │
│ Preview: Draft                      │
│                                     │
│              [Remove]  [Apply]      │
└─────────────────────────────────────┘
```

---

## Component Library (Simplified)

Instead of a full-screen library manager, use a **simple browser dialog**:

### Browse Library Dialog (Only when needed)

```
┌──────────────────────────────────────────────────────────┐
│ Component Library                               [×]      │
├──────────────────────────────────────────────────────────┤
│ 🔍 Search components...                                  │
├──────────────────────────────────────────────────────────┤
│ ┌────────┬────────┬────────┬────────┐                  │
│ │📁Proj  │📊Status│🏷️Cat   │👤Person│  (Click to add)  │
│ └────────┴────────┴────────┴────────┘                  │
│ ┌────────┬────────┬────────┬────────┐                  │
│ │📧Email │📞Phone │🌍Location│       │                  │
│ └────────┴────────┴────────┴────────┘                  │
│                                                          │
│ [+ Create New Component]                                 │
│                                                          │
│ ▼ TEMPLATE PACKS                                         │
│   📦 Common (7)    💼 Business (10)    🎨 Creative (10) │
└──────────────────────────────────────────────────────────┘
```

### Template Pack Quick Import

Click a template pack:

```
┌──────────────────────────────────────────────────────────┐
│ Import from Business Pack                       [×]      │
├──────────────────────────────────────────────────────────┤
│ Select components to import:                             │
│                                                          │
│ ☑ 📁 Project                                            │
│ ☑ 👥 Client                                             │
│ ☑ 📊 Status                                             │
│ ☑ 🏷️ Priority                                           │
│ ☐ 📅 Invoice Date                                       │
│ ☐ 📅 Due Date                                           │
│ ☐ 🔢 Invoice Number                                     │
│ ☐ 🔢 Order Number                                       │
│ ☐ 🏢 Department                                         │
│ ☐ 📂 Category                                           │
│                                                          │
│ [Select All]  [Select None]                             │
│                                           [Cancel] [Import] │
└──────────────────────────────────────────────────────────┘
```

---

## Revised File Structure

### Simplified Component Structure

```typescript
src/renderer/features/fileRename/
├── RenamePatternBuilder/
│   ├── index.tsx                          // Main builder (MODIFY)
│   ├── ComponentTypeDropdown.tsx         // [+ Add Component] dropdown (NEW)
│   ├── QuickCreatePopover.tsx            // Quick component creator (NEW)
│   ├── ComponentChip.tsx                 // Component in pattern (NEW)
│   ├── ComponentSettingsPopover.tsx      // Settings for instance (NEW)
│   └── PatternPreview.tsx                // Preview section (MODIFY)
│
├── ComponentLibrary/
│   ├── ComponentBrowserDialog.tsx        // Simple library browser (NEW)
│   ├── ComponentCard.tsx                 // Component card (NEW)
│   └── TemplatePackImport.tsx            // Template import dialog (NEW)
│
└── QuickCreate/
    ├── TextQuickCreate.tsx               // Text component quick create
    ├── SelectQuickCreate.tsx             // Select component quick create
    ├── DateQuickCreate.tsx               // Date component quick create
    └── NumberQuickCreate.tsx             // Number component quick create
```

---

## Implementation Approach

### Phase 5: Core Components (3-4 days)

**Day 1: Component Type Dropdown & Quick Create**

```typescript
// File: ComponentTypeDropdown.tsx
interface ComponentTypeDropdownProps {
  onSelect: (type: ComponentType | string) => void; // type or existing component ID
  isOpen: boolean;
  onClose: () => void;
}

export const ComponentTypeDropdown: React.FC<ComponentTypeDropdownProps> = ({
  onSelect,
  isOpen,
  onClose
}) => {
  const { components } = useComponentLibrary();
  const [search, setSearch] = useState('');

  const filteredComponents = useMemo(() => {
    return components.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [components, search]);

  return (
    <Popover isOpen={isOpen} onClose={onClose}>
      <Input
        placeholder="Search or select type..."
        value={search}
        onChange={setSearch}
        autoFocus
      />

      <Section title="BASIC TYPES">
        <MenuItem icon="📝" onClick={() => onSelect('text')}>
          Text <span className="hint">Simple text</span>
        </MenuItem>
        <MenuItem icon="🎯" onClick={() => onSelect('select')}>
          Select <span className="hint">Pick from list</span>
        </MenuItem>
        <MenuItem icon="📅" onClick={() => onSelect('date')}>
          Date <span className="hint">Date formatting</span>
        </MenuItem>
        <MenuItem icon="🔢" onClick={() => onSelect('number')}>
          Number <span className="hint">Counter/version</span>
        </MenuItem>
      </Section>

      {filteredComponents.length > 0 && (
        <Section title={`MY COMPONENTS (${filteredComponents.length})`}>
          {filteredComponents.map(component => (
            <MenuItem
              key={component.id}
              icon={component.icon}
              onClick={() => onSelect(component.id)}
            >
              {component.name}
            </MenuItem>
          ))}
        </Section>
      )}

      <Divider />
      <MenuItem icon="📚" onClick={() => onSelect('browse')}>
        Browse Library...
      </MenuItem>
      <MenuItem icon="+" onClick={() => onSelect('create')}>
        Create New...
      </MenuItem>
    </Popover>
  );
};

// Tasks:
// - [ ] Create dropdown with search
// - [ ] Show basic types (4 options)
// - [ ] Show user's components (filtered by search)
// - [ ] Handle selection (type or component ID)
// - [ ] Add keyboard navigation
// - [ ] Add "Browse Library" option
// - [ ] Style with proper spacing and icons
```

**Day 2: Quick Create Popovers**

```typescript
// File: QuickCreatePopover.tsx
interface QuickCreatePopoverProps {
  type: ComponentType;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (componentId: string) => void;
}

export const QuickCreatePopover: React.FC<QuickCreatePopoverProps> = ({
  type,
  isOpen,
  onClose,
  onCreated
}) => {
  const { createComponent } = useComponentLibrary();
  const [name, setName] = useState('');
  const [config, setConfig] = useState<any>({});
  const [saveToLibrary, setSaveToLibrary] = useState(true);

  const handleCreate = () => {
    const component = ComponentService.createComponent(type, name, config);

    let componentId;
    if (saveToLibrary) {
      componentId = createComponent(component);
    } else {
      componentId = component.id;
      // Store as temporary component
    }

    onCreated(componentId);
    onClose();
  };

  return (
    <Popover isOpen={isOpen} onClose={onClose} size="sm">
      <h3>Create {COMPONENT_TYPE_METADATA[type].label} Component</h3>

      <Input
        label="Name"
        value={name}
        onChange={setName}
        placeholder={`e.g., Project Name`}
        autoFocus
      />

      {type === 'select' && (
        <Textarea
          label="Options (one per line)"
          value={config.options || ''}
          onChange={(value) => setConfig({ options: value })}
          placeholder="Draft\nIn Progress\nComplete"
          rows={4}
        />
      )}

      {type === 'date' && (
        <Select
          label="Format"
          value={config.format || 'YYYYMMDD'}
          onChange={(value) => setConfig({ format: value })}
          options={DATE_FORMAT_OPTIONS}
        />
      )}

      {type === 'number' && (
        <Select
          label="Padding"
          value={config.padding || 3}
          onChange={(value) => setConfig({ padding: value })}
          options={NUMBER_PADDING_OPTIONS}
        />
      )}

      <Checkbox
        label="Save to library for reuse"
        checked={saveToLibrary}
        onChange={setSaveToLibrary}
      />

      <ButtonGroup>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleCreate} variant="primary" disabled={!name.trim()}>
          Add
        </Button>
      </ButtonGroup>
    </Popover>
  );
};

// Tasks:
// - [ ] Create small popover (300px width)
// - [ ] Name input (required)
// - [ ] Type-specific quick config:
//   - Text: default value (optional)
//   - Select: options textarea (one per line)
//   - Date: format dropdown
//   - Number: padding dropdown
// - [ ] "Save to library" checkbox
// - [ ] Create component on submit
// - [ ] Close popover after creation
// - [ ] Show validation errors
```

**Day 3: Component Chips & Pattern Builder**

```typescript
// File: ComponentChip.tsx
interface ComponentChipProps {
  instance: ComponentInstance;
  definition: ComponentDefinition;
  onSettings: () => void;
  onRemove: () => void;
  canDrag?: boolean;
}

export const ComponentChip: React.FC<ComponentChipProps> = ({
  instance,
  definition,
  onSettings,
  onRemove,
  canDrag = true
}) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="component-chip" draggable={canDrag}>
      <span className="icon">{definition.icon}</span>
      <span className="name">{definition.name}</span>

      <div className="actions">
        <button
          className="settings-btn"
          onClick={() => setShowSettings(true)}
          title="Settings"
        >
          ⚙️
        </button>
        <button
          className="remove-btn"
          onClick={onRemove}
          title="Remove"
        >
          ×
        </button>
      </div>

      {showSettings && (
        <ComponentSettingsPopover
          instance={instance}
          definition={definition}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={(updates) => {
            // Update instance
            setShowSettings(false);
          }}
        />
      )}
    </div>
  );
};

// Updated Pattern Builder
// File: RenamePatternBuilder/index.tsx
export const RenamePatternBuilder: React.FC = () => {
  const [instances, setInstances] = useState<ComponentInstance[]>([]);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [quickCreateType, setQuickCreateType] = useState<ComponentType | null>(null);

  const handleSelectType = (selection: ComponentType | string) => {
    if (selection === 'text' || selection === 'select' || selection === 'date' || selection === 'number') {
      // Basic type - show quick create
      setQuickCreateType(selection);
      setShowTypeDropdown(false);
    } else if (selection === 'browse') {
      // Open library browser
      setShowLibraryBrowser(true);
    } else {
      // Existing component ID - add directly
      addComponentInstance(selection);
      setShowTypeDropdown(false);
    }
  };

  return (
    <div className="pattern-builder">
      <div className="pattern-area">
        {instances.map((instance, index) => (
          <ComponentChip
            key={instance.id}
            instance={instance}
            definition={getDefinition(instance.definitionId)}
            onSettings={() => openSettings(instance.id)}
            onRemove={() => removeInstance(instance.id)}
          />
        ))}

        <button
          className="add-component-btn"
          onClick={() => setShowTypeDropdown(true)}
        >
          + Add Component ▼
        </button>

        {showTypeDropdown && (
          <ComponentTypeDropdown
            isOpen={showTypeDropdown}
            onClose={() => setShowTypeDropdown(false)}
            onSelect={handleSelectType}
          />
        )}

        {quickCreateType && (
          <QuickCreatePopover
            type={quickCreateType}
            isOpen={!!quickCreateType}
            onClose={() => setQuickCreateType(null)}
            onCreated={addComponentInstance}
          />
        )}
      </div>

      <PatternPreview instances={instances} />
    </div>
  );
};
```

**Day 4: Component Settings Popover**

```typescript
// File: ComponentSettingsPopover.tsx
interface ComponentSettingsPopoverProps {
  instance: ComponentInstance;
  definition: ComponentDefinition;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ComponentInstance>) => void;
}

export const ComponentSettingsPopover: React.FC<ComponentSettingsPopoverProps> = ({
  instance,
  definition,
  isOpen,
  onClose,
  onSave
}) => {
  const [value, setValue] = useState(instance.value);
  const [overrides, setOverrides] = useState(instance.overrides || {});

  return (
    <Popover isOpen={isOpen} onClose={onClose} anchor="bottom-start">
      <h3>{definition.icon} {definition.name} Settings</h3>

      {definition.type === 'text' && (
        <Input
          label="Value"
          value={value || ''}
          onChange={setValue}
          placeholder={definition.config.placeholder}
        />
      )}

      {definition.type === 'select' && (
        <SelectInstanceSettings
          value={value}
          onChange={setValue}
          options={definition.config.options}
          allowInlineCreate={definition.config.allowInlineCreate}
        />
      )}

      {definition.type === 'date' && (
        <DateInstanceSettings
          value={value}
          onChange={setValue}
          config={definition.config}
        />
      )}

      {definition.type === 'number' && (
        <NumberInstanceSettings
          value={value}
          onChange={setValue}
          config={definition.config}
        />
      )}

      <PatternPreview instance={instance} value={value} />

      <ButtonGroup>
        <Button onClick={() => onSave({ value })}>Remove</Button>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => { onSave({ value, overrides }); onClose(); }} variant="primary">
          Apply
        </Button>
      </ButtonGroup>
    </Popover>
  );
};
```

### Phase 6: Library Browser (2 days)

**Day 5-6: Simple Library Browser**

```typescript
// File: ComponentBrowserDialog.tsx
export const ComponentBrowserDialog: React.FC = ({ isOpen, onClose, onSelect }) => {
  const { components } = useComponentLibrary();
  const [search, setSearch] = useState('');

  return (
    <Dialog isOpen={isOpen} onClose={onClose} size="md">
      <DialogHeader>
        <h2>Component Library</h2>
      </DialogHeader>

      <DialogBody>
        <Input
          placeholder="Search components..."
          value={search}
          onChange={setSearch}
        />

        <div className="component-grid">
          {filteredComponents.map(component => (
            <ComponentCard
              key={component.id}
              component={component}
              onClick={() => {
                onSelect(component.id);
                onClose();
              }}
            />
          ))}
        </div>

        <Button onClick={() => setShowCreateModal(true)}>
          + Create New Component
        </Button>

        <TemplatePacksSection />
      </DialogBody>
    </Dialog>
  );
};
```

---

## Benefits of Simplified Approach

✅ **Faster workflow** - Create components in 2 clicks instead of 10
✅ **Less overwhelming** - No full-screen modals
✅ **Better UX** - Everything happens in context
✅ **Notion-like** - Familiar pattern for users
✅ **Less code** - Simpler components, easier to maintain
✅ **Inline editing** - Settings right where you need them

---

## Key Changes from Original Plan

| Original                              | Simplified                        |
| ------------------------------------- | --------------------------------- |
| Full-screen Component Library Manager | Small dialog, only when needed    |
| Complex modal for component creation  | Quick popover with minimal fields |
| Separate drag-and-drop section        | Integrated [+ Add] button         |
| Large settings panel                  | Small popover near component      |
| 10+ input fields                      | 2-3 essential fields              |

---

## Implementation Priority

1. **Week 1:** ComponentTypeDropdown + QuickCreatePopover
2. **Week 2:** ComponentChip + ComponentSettingsPopover
3. **Week 3:** ComponentBrowserDialog + Polish

**Total: 3 weeks instead of 8-10 days**

This simplified approach is more maintainable, user-friendly, and faster to implement!
