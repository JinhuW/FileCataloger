# FileCataloger Implementation Guide

**Purpose**: Guide for implementing new features and components.

**Last Updated:** 2025-11-27

---

## Table of Contents

1. [Meta-Component System](#meta-component-system)
2. [AI Naming Component](#ai-naming-component)
3. [Adding New Component Types](#adding-new-component-types)
4. [Implementation Patterns](#implementation-patterns)

---

## Meta-Component System

### Overview

Transform FileCataloger from pre-defined components to a Notion-like meta-component system where users create custom components from 4 basic building block types.

**Status:** Phases 1-3 Complete ✅

### Core Concept

```
ComponentDefinition (global library) → ComponentInstance (in pattern) → Resolved Value (for file)
```

### Component Types

1. **📝 Text** - Static or dynamic text values
2. **🎯 Select** - Dropdown with custom options
3. **📅 Date** - Auto-formatted dates (current, file created, file modified)
4. **🔢 Number** - Auto-increment counters with padding

### Simplified UI Design

**Based on Notion's inline component creation pattern:**

```
┌────────────────────────────────────────────────────────────────┐
│ Pattern Builder                                                │
├────────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ [+ Add Component ▼]                │
│ │📅Date│ │📝Proj│ │🔢Ver │                                     │
│ │  ⚙️  │ │  ⚙️  │ │  ⚙️  │  (Each has settings)               │
│ └──────┘ └──────┘ └──────┘                                     │
│                                                                 │
│ Preview: 20251101_MyProject_v1.0.pdf                           │
└────────────────────────────────────────────────────────────────┘
```

**When clicking [+ Add Component]:**

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
└─────────────────────────────────────┘
```

### Implementation Status

#### ✅ Completed (Phases 1-3)

**Phase 1: Core Data Architecture**

- [x] Type definitions in `src/shared/types/componentDefinition.ts`
- [x] Enums in `src/shared/enums.ts`
- [x] Component metadata in `src/renderer/constants/componentTypes.ts`
- [x] Template packs (36 pre-built components)

**Phase 2: State Management**

- [x] `componentLibraryStore.ts` - Zustand store for components
- [x] `patternStore.ts` - Updated for component instances
- [x] Map-based storage with Immer middleware

**Phase 3: Business Logic & Utilities**

- [x] `componentService.ts` - Component CRUD operations
- [x] `componentValueResolver.ts` - Value resolution logic
- [x] `componentMigration.ts` - Legacy migration utilities

**Phase 4: Custom Hooks**

- [x] `useComponentLibrary.ts` - Component management
- [x] `useComponentTemplates.ts` - Template import

#### 🚧 In Progress / Planned

**Phase 5: Component Library UI** (3-4 days)

- [ ] ComponentTypeDropdown - Inline dropdown for selecting type
- [ ] QuickCreatePopover - Quick component creation
- [ ] ComponentBrowserDialog - Library browser
- [ ] TemplatePackImport - Template import dialog

**Phase 6: Pattern Builder Integration** (3-4 days)

- [ ] ComponentChip - Draggable component in pattern
- [ ] ComponentSettingsPopover - Instance configuration
- [ ] Pattern preview updates
- [ ] Drag-and-drop with @dnd-kit

**Phase 7: Import/Export** (2 days)

- [ ] Component export to JSON
- [ ] Component import from JSON
- [ ] Template pack management

**Phase 8: IPC & Persistence** (Already complete for basic ops)

- [x] `component:save-library` handler
- [x] `component:load-library` handler
- [ ] `component:export` handler
- [ ] `component:import` handler

**Phase 9: Migration & Backward Compatibility** (2-3 days)

- [ ] One-time migration from legacy patterns
- [ ] Default component definitions
- [ ] Fallback logic for missing components

**Phase 10: Testing** (3-4 days)

- [ ] Unit tests for stores and utilities
- [ ] Integration tests for UI flows
- [ ] E2E tests with Playwright

### File Structure

```typescript
src/
├── shared/types/
│   └── componentDefinition.ts          // ✅ Component types
│
├── shared/
│   └── enums.ts                         // ✅ Added component enums
│
├── renderer/
│   ├── constants/
│   │   ├── componentTypes.ts           // ✅ Metadata
│   │   └── componentTemplates.ts       // ✅ 36 templates
│   │
│   ├── stores/
│   │   ├── componentLibraryStore.ts    // ✅ Component state
│   │   └── patternStore.ts             // ✅ Updated for instances
│   │
│   ├── services/
│   │   └── componentService.ts         // ✅ Business logic
│   │
│   ├── utils/
│   │   ├── componentValueResolver.ts   // ✅ Value resolution
│   │   └── componentMigration.ts       // ✅ Migration logic
│   │
│   ├── hooks/
│   │   ├── useComponentLibrary.ts      // ✅ Component hook
│   │   └── useComponentTemplates.ts    // ✅ Template hook
│   │
│   └── features/fileRename/
│       ├── RenamePatternBuilder/       // 🚧 To be enhanced
│       ├── ComponentLibrary/           // 🚧 New UI components
│       └── QuickCreate/                // 🚧 Quick create popovers
```

---

## AI Naming Component

### Overview

Add an AI-powered component type that uses AI APIs (OpenAI, Ollama, LM Studio) to generate intelligent file names based on file metadata and content analysis.

**Status:** Not Started
**Estimated Time:** 4-5 hours

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Renderer Process                      │
│  ┌────────────────┐         ┌──────────────────┐           │
│  │ Component UI   │────────▶│ Component Store  │           │
│  │ (AI Config)    │         │ (Zustand)        │           │
│  └────────────────┘         └──────────────────┘           │
│           │                           │                      │
│           │ IPC: ai:generate-filename │                      │
│           └───────────────────────────┼──────────────────────┘
│                                       │
│                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                         Main Process                         │
│  ┌──────────────────┐                                       │
│  │ AI Naming Handler│                                       │
│  │    (IPC)         │                                       │
│  └────────┬─────────┘                                       │
│           │                                                  │
│  ┌────────▼──────────┐    ┌─────────────────────┐         │
│  │ Prompt Builder    │    │ File Analyzer       │         │
│  │ Service           │    │ Service             │         │
│  └────────┬──────────┘    └──────────┬──────────┘         │
│           │                            │                     │
│           │         ┌──────────────────▼──────────┐        │
│           └────────▶│  AI Provider Factory        │        │
│                     └──────────────────┬──────────┘        │
│                                        │                     │
│              ┌─────────────────────────┼──────────┐        │
│              │                         │          │         │
│     ┌────────▼─────┐    ┌─────────────▼───┐   ┌─▼──────┐ │
│     │ OpenAI       │    │ Ollama          │   │LM Studio│ │
│     │ Provider     │    │ Provider        │   │Provider │ │
│     └──────────────┘    └─────────────────┘   └─────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Checklist

#### Type System (30 minutes)

- [ ] Add `'ai'` to `ComponentType` union in `componentDefinition.ts`
- [ ] Create `AIConfig` interface:
  ```typescript
  export interface AIConfig {
    namingInstruction: string;
    provider: 'openai' | 'ollama' | 'lm-studio';
    model?: string;
    includeMetadata: boolean;
    includeContent: boolean;
  }
  ```
- [ ] Add to `ComponentConfig` union type
- [ ] Add `AI = 'ai'` to enums
- [ ] Add AI metadata to component types

#### Dependencies (15 minutes)

```bash
yarn add openai axios file-type exifreader pdf-parse
yarn add -D @types/node @types/pdf-parse
```

**Libraries:**

- `openai` - Official OpenAI SDK
- `axios` - HTTP client for Ollama/LM Studio
- `file-type` - MIME type detection
- `exifreader` - EXIF metadata extraction
- `pdf-parse` - PDF text extraction

#### Backend Services (2 hours)

**File:** `src/main/services/ai/types.ts`

- [ ] Define `AIProvider` interface
- [ ] Define `AIProviderConfig` type
- [ ] Define `FileAnalysis` interface
- [ ] Define `PromptContext` interface

**File:** `src/main/services/ai/AIProviderFactory.ts`

- [ ] Create factory for AI providers
- [ ] Implement provider validation
- [ ] Support OpenAI, Ollama, LM Studio

**File:** `src/main/services/ai/providers/OpenAIProvider.ts`

- [ ] Implement OpenAI API integration
- [ ] Support GPT-4o and GPT-3.5-turbo
- [ ] Handle image encoding for vision models
- [ ] Filename sanitization

**File:** `src/main/services/ai/providers/OllamaProvider.ts`

- [ ] Implement Ollama local API integration
- [ ] Support llava (vision) and llama3 models
- [ ] Handle base64 image encoding

**File:** `src/main/services/ai/providers/LMStudioProvider.ts`

- [ ] Implement LM Studio integration
- [ ] Use OpenAI-compatible API format

**File:** `src/main/services/ai/FileAnalyzerService.ts`

- [ ] MIME type detection with file-type
- [ ] EXIF extraction for images
- [ ] PDF text extraction
- [ ] Text content sampling
- [ ] Comprehensive error handling

**File:** `src/main/services/ai/PromptBuilderService.ts`

- [ ] Build context-aware prompts
- [ ] Include file metadata
- [ ] Include content samples
- [ ] Add output constraints (format, length, case style)

#### IPC Layer (30 minutes)

**File:** `src/main/ipc/aiNamingHandler.ts`

- [ ] Create handler for `'ai:generate-name'` channel
- [ ] Validate inputs
- [ ] Call FileAnalyzerService
- [ ] Call AI provider
- [ ] Return generated name or error

**File:** `src/preload/index.ts`

- [ ] Add `'ai:generate-name'` to channel whitelist

#### UI Components (1.5 hours)

**File:** `RenamePatternBuilder/ComponentTypeDropdown.tsx`

- [ ] Add AI option to dropdown
- [ ] Use 🤖 icon and purple color

**File:** `RenamePatternBuilder/QuickCreatePopover.tsx`

- [ ] Add AI-specific config UI:
  - Naming instruction textarea
  - Provider selector
  - Include metadata checkbox
  - Include content checkbox

**File:** `RenamePatternBuilder/ComponentSettingsPopover.tsx`

- [ ] Add AI instance settings
- [ ] Show naming instruction
- [ ] Show provider/model info

#### Pattern Execution (30 minutes)

**File:** Pattern execution service

- [ ] Call `window.api['ai:generate-name']` during rename
- [ ] Handle async response
- [ ] Show loading indicator
- [ ] Handle errors with fallbacks:
  - No API key: Show error, use placeholder "[AI]"
  - API failure: Show error, use original filename
  - Rate limit: Show error, queue for retry

#### Testing (30 minutes)

- [ ] Test with image files (JPEG, PNG)
- [ ] Test with text files
- [ ] Test with PDF files
- [ ] Test with no API key (error handling)
- [ ] Test with invalid API key
- [ ] Test batch rename with AI

### Security Considerations

```typescript
// API key storage
- Store encrypted in config
- Never log API keys
- Validate before sending to AI

// File analysis
- Validate all file paths
- Limit content sample size (1KB max)
- Sanitize generated filenames
- Don't send sensitive content

// Generated names
- Remove special characters
- Prevent path traversal (../)
- Limit length (255 chars)
- Validate before renaming
```

---

## Adding New Component Types

### Step-by-Step Guide

#### 1. Define the Type (30 minutes)

**File:** `src/shared/types/componentDefinition.ts`

```typescript
// Add to ComponentType union
export type ComponentType = 'text' | 'select' | 'date' | 'number' | 'yourType';

// Create config interface
export interface YourTypeConfig {
  // Your type-specific configuration
  setting1: string;
  setting2: number;
}

// Add to ComponentConfig union
export type ComponentConfig =
  | { type: 'text'; config: TextConfig }
  | { type: 'select'; config: SelectConfig }
  | { type: 'date'; config: DateConfig }
  | { type: 'number'; config: NumberConfig }
  | { type: 'yourType'; config: YourTypeConfig };

// Add type guard
export function isYourTypeComponent(
  component: ComponentDefinition
): component is ComponentDefinition & { type: 'yourType'; config: YourTypeConfig } {
  return component.type === 'yourType';
}
```

#### 2. Add to Enums (5 minutes)

**File:** `src/shared/enums.ts`

```typescript
export enum ComponentType {
  TEXT = 'text',
  SELECT = 'select',
  DATE = 'date',
  NUMBER = 'number',
  YOUR_TYPE = 'yourType',
}
```

#### 3. Add Metadata (10 minutes)

**File:** `src/renderer/constants/componentTypes.ts`

```typescript
// Add to COMPONENT_TYPE_METADATA array
{
  type: 'yourType' as const,
  label: 'Your Type Label',
  icon: '🎨', // Choose an emoji
  color: '#3B82F6', // Choose a color
  description: 'Description of what this type does',
}

// Add default config
yourType: {
  setting1: 'default value',
  setting2: 0,
}
```

#### 4. Implement Value Resolution (30 minutes)

**File:** `src/renderer/utils/componentValueResolver.ts`

```typescript
function resolveComponentValue(
  instance: ComponentInstance,
  definition: ComponentDefinition,
  context: ComponentResolutionContext
): string {
  // ... existing cases ...

  if (definition.type === 'yourType') {
    return resolveYourTypeValue(instance, definition.config, context);
  }

  // ... rest of code ...
}

function resolveYourTypeValue(
  instance: ComponentInstance,
  config: YourTypeConfig,
  context: ComponentResolutionContext
): string {
  // Implement your value resolution logic here
  // Example: combine settings with context data
  return `${config.setting1}-${config.setting2}`;
}
```

#### 5. Create UI Components (1-2 hours)

**File:** `src/renderer/features/fileRename/QuickCreate/YourTypeQuickCreate.tsx`

```typescript
interface YourTypeQuickCreateProps {
  config: YourTypeConfig;
  onChange: (config: YourTypeConfig) => void;
}

export const YourTypeQuickCreate: React.FC<YourTypeQuickCreateProps> = ({
  config,
  onChange
}) => {
  return (
    <div className="config-section">
      <Input
        label="Setting 1"
        value={config.setting1}
        onChange={(value) => onChange({ ...config, setting1: value })}
      />
      <Input
        label="Setting 2"
        type="number"
        value={config.setting2}
        onChange={(value) => onChange({ ...config, setting2: Number(value) })}
      />
    </div>
  );
};
```

**File:** `src/renderer/features/fileRename/RenamePatternBuilder/ComponentSettingsPopover.tsx`

```typescript
// Add case for your type
{definition.type === 'yourType' && (
  <YourTypeSettings
    value={value}
    onChange={setValue}
    config={definition.config}
  />
)}
```

#### 6. Update QuickCreatePopover (15 minutes)

**File:** `src/renderer/features/fileRename/RenamePatternBuilder/QuickCreatePopover.tsx`

```typescript
// Add case for your type
{type === 'yourType' && (
  <YourTypeQuickCreate
    config={yourTypeConfig}
    onChange={setYourTypeConfig}
  />
)}
```

#### 7. Update ComponentService (10 minutes)

**File:** `src/renderer/services/componentService.ts`

```typescript
case 'yourType':
  return {
    id: generateId(),
    type: 'yourType',
    name: name || 'Your Type',
    config: {
      setting1: '',
      setting2: 0,
    },
  };
```

#### 8. Test Everything (30 minutes)

- [ ] Create component of your type
- [ ] Add to pattern
- [ ] Configure instance
- [ ] Preview shows correct value
- [ ] Save pattern
- [ ] Reload pattern
- [ ] Execute rename
- [ ] Verify TypeScript compiles
- [ ] Verify ESLint passes

---

## Implementation Patterns

### Pattern 1: Adding IPC Handlers

**Steps:**

1. Define in `src/shared/types/ipc.ts`
2. Add handler in `src/main/ipc/`
3. Add to channel whitelist in `src/preload/index.ts`
4. Use via `window.api` in renderer

**Example:**

```typescript
// 1. Define types
interface MyRequest {
  data: string;
}

interface MyResponse {
  result: string;
}

// 2. Add handler
ipcMain.handle('my-channel', async (event, request: MyRequest): Promise<MyResponse> => {
  // Handle logic
  return { result: 'processed' };
});

// 3. Whitelist in preload
const ALLOWED_CHANNELS = [
  'my-channel',
  // ... other channels
];

// 4. Use in renderer
const response = await window.api.invoke('my-channel', { data: 'test' });
```

### Pattern 2: Creating Zustand Stores

**Steps:**

1. Define store interface
2. Use Immer middleware for immutable updates
3. Add devtools for debugging
4. Use Map for O(1) lookups when appropriate

**Example:**

```typescript
interface MyStore {
  items: Map<string, Item>;
  addItem: (item: Item) => void;
  removeItem: (id: string) => void;
  getItem: (id: string) => Item | undefined;
}

const useMyStore = create<MyStore>()(
  devtools(
    immer((set, get) => ({
      items: new Map(),

      addItem: item =>
        set(state => {
          state.items.set(item.id, item); // Immer allows "mutation"
        }),

      removeItem: id =>
        set(state => {
          state.items.delete(id);
        }),

      getItem: id => {
        return get().items.get(id);
      },
    })),
    { name: 'MyStore' }
  )
);
```

### Pattern 3: React Performance Optimization

**Use memoization:**

```typescript
// 1. Memo components
export const MyComponent = React.memo<Props>(
  ({ data }) => {
    // Component implementation
  },
  (prev, next) => prev.data.id === next.data.id
);

// 2. Memo callbacks
const handleClick = useCallback((id: string) => {
  doSomething(id);
}, []); // Empty deps if truly stable

// 3. Memo expensive computations
const sortedItems = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// 4. Memo selectors
const selectShelf = useCallback(state => state.getShelf(shelfId), [shelfId]);
const shelf = useShelfStore(selectShelf);
```

### Pattern 4: Error Handling

**Use error boundaries:**

```typescript
import { FeatureErrorBoundary } from '@renderer/components/domain/FeatureErrorBoundary';

<FeatureErrorBoundary
  featureName="My Feature"
  showDetails={process.env.NODE_ENV === 'development'}
  onError={(error, info) => {
    // Optional: Custom error handling
    logger.error('Feature error', { error, info });
  }}
>
  <MyFeatureComponent />
</FeatureErrorBoundary>
```

### Pattern 5: Safe Storage Access

**Always use safeStorage utility:**

```typescript
import { getStorageItem, setStorageJSON, getStorageBoolean } from '@renderer/utils/safeStorage';

// Get with default
const enabled = getStorageBoolean('feature-enabled', false);

// Set JSON
const success = setStorageJSON('preferences', { theme: 'dark' });
if (!success) {
  logger.warn('Failed to save preferences');
}
```

### Pattern 6: Development Logging

**Use devLogger in development:**

```typescript
import { devLogger } from '@renderer/utils/devLogger';

// Component lifecycle
useEffect(() => {
  devLogger.component('MyComponent', 'mount', { props });
  return () => devLogger.component('MyComponent', 'unmount');
}, []);

// State changes
devLogger.state('myStore', 'updateUser', userData);

// IPC communication
devLogger.ipc('my-channel', 'send', requestData);

// Performance timing
const endTimer = devLogger.startTimer('loadData');
await fetchData();
endTimer(); // Logs duration
```

### Pattern 7: Duplicate Detection

**Use centralized utility:**

```typescript
import { filterDuplicates, getDuplicateMessage } from '@renderer/utils/duplicateDetection';

// Filter duplicates
const { items: uniqueItems, duplicateCount } = filterDuplicates(newItems, existingItems, {
  logDuplicates: true,
});

// Show user message
if (duplicateCount > 0) {
  const message = getDuplicateMessage(duplicateCount, 'shelf');
  if (message) {
    toast.warning(message.title, message.message);
  }
}
```

---

## Best Practices

### TypeScript

1. **Always use explicit types** - No `any` unless absolutely necessary
2. **Use type guards** - Runtime type checking for IPC responses
3. **Discriminated unions** - For component configs and similar patterns
4. **Strict null checks** - Always handle null/undefined cases

### React

1. **Memoize components** - Use React.memo for expensive components
2. **Memoize callbacks** - Use useCallback for event handlers
3. **Memoize computations** - Use useMemo for expensive calculations
4. **Optimize selectors** - Memoize Zustand selectors
5. **Avoid inline objects/arrays** - They break memoization

### State Management

1. **Use Immer correctly** - Don't return new state, mutate draft
2. **Map for O(1) lookups** - Use Map instead of arrays when possible
3. **Selective subscriptions** - Only subscribe to needed state slices
4. **Change detection** - Prevent unnecessary saves with proper change detection

### IPC Communication

1. **Validate all inputs** - Use type guards for IPC responses
2. **Rate limiting** - Don't flood IPC channels
3. **Error handling** - Always handle IPC failures gracefully
4. **Type safety** - Define request/response types

### Performance

1. **Window pooling** - Reuse windows instead of creating new ones
2. **Event batching** - Batch high-frequency events (mouse, scroll)
3. **Virtual lists** - For large file lists
4. **Debouncing** - For expensive operations (search, save)
5. **Code splitting** - Lazy load non-critical features

### Security

1. **Context isolation** - Always enabled for renderers
2. **IPC validation** - Whitelist all channels
3. **Input sanitization** - Validate all user inputs
4. **Path validation** - Prevent path traversal attacks
5. **No console.log** - Use Logger module instead

---

## Testing Strategy

### Unit Tests

```typescript
// Test utilities and services
describe('ComponentService', () => {
  test('creates valid component', () => {
    const component = ComponentService.createComponent('text', 'Test', {});
    expect(component.name).toBe('Test');
    expect(component.type).toBe('text');
  });
});
```

### Integration Tests

```typescript
// Test feature flows
describe('Component Library Flow', () => {
  test('creates component and adds to library', async () => {
    render(<ComponentLibraryManager />);

    fireEvent.click(screen.getByText('+ New'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });
});
```

### E2E Tests

```typescript
// Test complete user journeys
test('create pattern with custom components', async ({ page }) => {
  // 1. Open shelf with files
  // 2. Drag component to pattern
  // 3. Configure instance
  // 4. See preview update
  // 5. Save pattern
  // 6. Execute rename
});
```

---

## Common Pitfalls

### 1. useEffect Infinite Loops

❌ **WRONG:**

```typescript
useEffect(() => {
  updateStore(data);
}, [data, updateStore]); // updateStore causes loop
```

✅ **CORRECT:**

```typescript
const updateStoreRef = useRef(updateStore);
useEffect(() => {
  updateStoreRef.current(data);
}, [data]);
```

### 2. Missing Persistence

❌ **WRONG:**

```typescript
const addItem = item => {
  setItems([...items, item]); // Only local state
};
```

✅ **CORRECT:**

```typescript
const addItem = async item => {
  setItems([...items, item]);
  await saveToStorage([...items, item]); // Persist
};
```

### 3. IPC Type Assertions

❌ **WRONG:**

```typescript
const result = (await window.api.invoke('my-channel')) as MyType;
```

✅ **CORRECT:**

```typescript
const result = await window.api.invoke('my-channel');
if (!isMyType(result)) {
  logger.warn('Invalid response');
  return fallback;
}
```

### 4. Zustand with Immer

❌ **WRONG:**

```typescript
set(state => {
  return { items: [...state.items, newItem] };
});
```

✅ **CORRECT:**

```typescript
set(state => {
  state.items.push(newItem); // Immer handles immutability
});
```

### 5. Process Boundaries

❌ **WRONG:**

```typescript
// In renderer process
setTimeout(() => {
  // Managing system-level state without main process awareness
  closeWindow();
}, 3000);
```

✅ **CORRECT:**

```typescript
// Let main process manage system operations
// Renderer only requests actions via IPC
window.api.invoke('window:schedule-close', { delay: 3000 });
```

---

## Quick Reference

### Creating a New Feature

1. **Plan**: Understand requirements and architecture
2. **Types**: Define TypeScript interfaces
3. **State**: Create Zustand store if needed
4. **Logic**: Implement business logic in services
5. **IPC**: Add handlers for main-renderer communication
6. **UI**: Build React components
7. **Test**: Write unit, integration, and E2E tests
8. **Document**: Update relevant docs

### Code Review Checklist

- [ ] TypeScript types defined for all new code
- [ ] No `any` types (or well-justified)
- [ ] Proper error handling
- [ ] IPC responses validated
- [ ] Components memoized where appropriate
- [ ] Store mutations use Immer correctly
- [ ] No console.log (use Logger)
- [ ] Tests written and passing
- [ ] Documentation updated

---

**Remember**: This is a living document. Update as you implement new features or discover better patterns!
