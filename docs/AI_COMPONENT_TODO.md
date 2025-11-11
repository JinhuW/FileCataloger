# AI Component Implementation TODO

## Overview

Add a new "AI" component type that uses OpenAI API to generate intelligent file names based on file metadata and content analysis, with "Naming Instruction" field instead of "Default Value".

---

## Phase 1: Type System & Core Definitions

### 1.1 Update Type Definitions

**File:** `src/shared/types/componentDefinition.ts`

- [ ] Add `'ai'` to `ComponentType` union type (line 12)

  ```typescript
  export type ComponentType = 'text' | 'select' | 'date' | 'number' | 'ai';
  ```

- [ ] Create new `AIConfig` interface:

  ```typescript
  export interface AIConfig {
    namingInstruction: string; // User's prompt for AI
    includeMetadata?: boolean; // Include file metadata in context
    includeContent?: boolean; // Analyze file content
  }
  ```

- [ ] Add `AIConfig` to `ComponentConfig` union type

- [ ] Add `isAIComponent()` type guard function
  ```typescript
  export function isAIComponent(
    component: ComponentDefinition
  ): component is ComponentDefinition & { config: AIConfig } {
    return component.type === 'ai';
  }
  ```

### 1.2 Update Enums

**File:** `src/shared/enums.ts`

- [ ] Add `AI = 'ai'` to `ComponentType` enum (after line 216)
  ```typescript
  export enum ComponentType {
    TEXT = 'text',
    SELECT = 'select',
    DATE = 'date',
    NUMBER = 'number',
    AI = 'ai',
  }
  ```

### 1.3 Update Component Metadata

**File:** `src/renderer/constants/componentTypes.ts`

- [ ] Add AI metadata to `COMPONENT_TYPE_METADATA`:

  ```typescript
  {
    type: 'ai' as const,
    label: 'AI Naming',
    icon: '🤖',
    color: '#9333EA', // purple
    description: 'Use AI to generate intelligent file names',
  }
  ```

- [ ] Add default AI config to `DEFAULT_COMPONENT_CONFIGS`:
  ```typescript
  ai: {
    namingInstruction: '',
    includeMetadata: true,
    includeContent: false,
  }
  ```

---

## Phase 2: External Dependencies

### 2.1 Install Required Packages

- [ ] Install OpenAI SDK: `yarn add openai`
- [ ] Install file-type: `yarn add file-type`
- [ ] Install exifreader: `yarn add exifreader`
- [ ] Install dev types: `yarn add -D @types/node`

**Libraries chosen:**

- **openai**: Official OpenAI Node.js SDK (16M+ weekly downloads)
- **file-type**: Detect file types from magic numbers (16M+ weekly downloads)
- **exifreader**: Extract EXIF metadata from images (popular, well-maintained)

---

## Phase 3: Backend Services

### 3.1 Create OpenAI Service

**New file:** `src/main/services/openAIService.ts`

- [ ] Create `OpenAIService` class
- [ ] Initialize OpenAI client with API key from config
- [ ] Implement `generateFileName()` method:
  - Takes naming instruction, file metadata, and optional content
  - Constructs prompt with context
  - Calls GPT-4 or GPT-3.5-turbo
  - Returns sanitized filename
- [ ] Add error handling with fallbacks
- [ ] Add logging with Logger module

### 3.2 Create File Analyzer Service

**New file:** `src/main/services/fileAnalyzerService.ts`

- [ ] Create `FileAnalyzerService` class
- [ ] Implement `analyzeFile()` method that:
  - Extracts file metadata (name, size, extension, dates)
  - Detects file type using `file-type` package
  - For images: Extracts EXIF data with `exifreader`
  - For text files: Reads first 1KB for context
  - Returns structured metadata object
- [ ] Add error handling
- [ ] Add support for different file types:
  - Images (JPEG, PNG, HEIC, WebP)
  - Documents (TXT, PDF, DOCX)
  - Media (MP3, MP4)
  - Archives (ZIP, TAR)

### 3.3 Add Configuration Support

**File:** `src/main/config/appConfig.ts` (or appropriate config file)

- [ ] Add `openAIApiKey?: string` to config interface
- [ ] Add getters/setters for API key
- [ ] Add encryption for API key storage (if needed)
- [ ] Add validation for API key format

**Optional:** Create settings UI

- [ ] Create `src/renderer/pages/preferences/AISettings.tsx`
- [ ] Add form for entering OpenAI API key
- [ ] Add "Test Connection" button
- [ ] Show usage/cost info

### 3.4 Create IPC Handler

**New file:** `src/main/ipc/aiNamingHandler.ts`

- [ ] Create handler for `'ai:generate-name'` channel
- [ ] Handler should:
  - Receive file path and naming instruction
  - Call FileAnalyzerService to get metadata
  - Call OpenAIService to generate name
  - Return generated name or error
- [ ] Add validation for inputs
- [ ] Add rate limiting (optional)

**Update:** `src/preload/index.ts`

- [ ] Add `'ai:generate-name'` to channel whitelist
- [ ] Add TypeScript interface for the API call

---

## Phase 4: UI Components

### 4.1 Update Component Type Dropdown

**File:** `src/renderer/features/fileRename/RenamePatternBuilder/ComponentTypeDropdown.tsx`

- [ ] Add AI MenuItem in BASIC TYPES section (after Number)
- [ ] Use icon (🤖) and color (#9333EA) from metadata
- [ ] Ensure proper click handling to create AI component

### 4.2 Update Quick Create Popover

**File:** `src/renderer/features/fileRename/RenamePatternBuilder/QuickCreatePopover.tsx`

- [ ] Add `aiConfig` state for AI components
- [ ] Add conditional rendering for AI type:
  ```typescript
  {type === 'ai' && (
    <>
      <Textarea
        label="Naming Instruction"
        placeholder="e.g., Extract project name and date from document"
        value={aiConfig.namingInstruction}
        onChange={(e) => setAiConfig({
          ...aiConfig,
          namingInstruction: e.target.value
        })}
        rows={3}
      />
      <Checkbox
        label="Include file metadata"
        checked={aiConfig.includeMetadata}
        onChange={(checked) => setAiConfig({
          ...aiConfig,
          includeMetadata: checked
        })}
      />
      <Checkbox
        label="Analyze file content"
        checked={aiConfig.includeContent}
        onChange={(checked) => setAiConfig({
          ...aiConfig,
          includeContent: checked
        })}
      />
    </>
  )}
  ```
- [ ] Handle AI config in component creation
- [ ] Add validation for naming instruction (not empty)

### 4.3 Update Component Edit Dialog

**File:** `src/renderer/features/fileRename/ComponentEditDialog.tsx`

- [ ] Add same "Naming Instruction" field for AI type
- [ ] Add metadata/content checkboxes
- [ ] Pre-fill with existing config when editing AI component
- [ ] Handle AI config updates on save

---

## Phase 5: Component Service Logic

### 5.1 Update Component Service

**File:** `src/renderer/services/componentService.ts`

- [ ] Add AI case to `createComponent()` method:

  ```typescript
  case 'ai':
    return {
      id: generateId(),
      type: 'ai',
      name: name || 'AI Name',
      config: {
        namingInstruction: '',
        includeMetadata: true,
        includeContent: false,
      },
    };
  ```

- [ ] Add validation for AI config:
  - Ensure `namingInstruction` is not empty
  - Validate instruction length (max 500 chars?)

### 5.2 Update Pattern Execution

**File:** Find and update the pattern execution service (likely `src/renderer/services/patternExecutionService.ts` or similar)

- [ ] When processing AI component during rename:
  - Call `window.api['ai:generate-name']` with file path and instruction
  - Handle async response
  - Insert generated name into pattern
  - Handle errors with fallback strategies:
    - No API key: Show error, use placeholder "[AI]"
    - API failure: Show error, use original filename
    - Rate limit: Show error, queue for retry
- [ ] Add loading indicator for AI generation
- [ ] Add progress tracking for batch operations

---

## Phase 6: Testing & Validation

### 6.1 Type Checking

- [ ] Run `yarn typecheck` and fix any type errors
- [ ] Ensure all new files have proper TypeScript types
- [ ] No implicit `any` types

### 6.2 Code Quality

- [ ] Run `yarn lint` and fix linting issues
- [ ] Run `yarn format` to format code
- [ ] Follow Google TypeScript Style Guide

### 6.3 Manual Testing Scenarios

- [ ] Create AI component with basic instruction
- [ ] Test with image files (JPEG, PNG)
- [ ] Test with text files (TXT, MD)
- [ ] Test with document files (PDF, DOCX)
- [ ] Test with no API key configured (should show error)
- [ ] Test with invalid API key (should show error)
- [ ] Test with API rate limit (should handle gracefully)
- [ ] Test editing existing AI component
- [ ] Test saving pattern with AI component
- [ ] Test loading saved pattern with AI component
- [ ] Test batch rename with AI component
- [ ] Verify no console.log usage (use Logger instead)

### 6.4 Edge Cases

- [ ] Empty naming instruction
- [ ] Very long naming instruction (>500 chars)
- [ ] Special characters in generated names
- [ ] Files with no metadata
- [ ] Binary files with no readable content
- [ ] Large files (>100MB)
- [ ] Network timeout handling
- [ ] Concurrent AI requests

---

## Files to Create/Modify Summary

### New Files (3)

1. ✅ `src/main/services/openAIService.ts` - OpenAI integration
2. ✅ `src/main/services/fileAnalyzerService.ts` - File analysis
3. ✅ `src/main/ipc/aiNamingHandler.ts` - IPC handler

### Modified Files (9)

1. ✅ `src/shared/types/componentDefinition.ts` - Add AI type
2. ✅ `src/shared/enums.ts` - Add AI enum
3. ✅ `src/renderer/constants/componentTypes.ts` - Add AI metadata
4. ✅ `src/renderer/features/fileRename/RenamePatternBuilder/ComponentTypeDropdown.tsx` - Add AI option
5. ✅ `src/renderer/features/fileRename/RenamePatternBuilder/QuickCreatePopover.tsx` - Add naming instruction field
6. ✅ `src/renderer/features/fileRename/ComponentEditDialog.tsx` - Add naming instruction field
7. ✅ `src/renderer/services/componentService.ts` - Handle AI creation
8. ✅ `src/preload/index.ts` - Add IPC channel
9. ✅ Pattern execution service - Call AI during rename

### Optional Files (1)

1. ⭕ `src/renderer/pages/preferences/AISettings.tsx` - Settings UI

---

## Implementation Order

1. **Phase 1** - Type definitions (foundational, must go first)
2. **Phase 2** - Install dependencies
3. **Phase 3** - Backend services (can be done in parallel)
4. **Phase 4** - UI components (depends on Phase 1)
5. **Phase 5** - Service logic integration (depends on Phases 3 & 4)
6. **Phase 6** - Testing and validation

---

## Estimated Time

- Phase 1-2: 30 minutes (types, deps)
- Phase 3: 1-2 hours (services, IPC)
- Phase 4: 1 hour (UI components)
- Phase 5: 1 hour (logic integration)
- Phase 6: 30 minutes (testing)

**Total: ~4-5 hours**

---

## Notes & Considerations

### Security

- Store API key securely (encrypted in config)
- Validate all file paths before reading
- Sanitize generated filenames (remove special chars, path traversal)
- Rate limit API calls to prevent abuse
- Don't send sensitive file content to OpenAI

### Performance

- Cache file analysis results
- Batch API requests when possible
- Show progress indicators for long operations
- Implement request queuing for large batches

### UX

- Clear error messages for API issues
- Helpful placeholder text in naming instruction field
- Preview tooltip showing what will be sent to AI
- Show estimated cost per rename (optional)

### Future Enhancements

- Support for other AI providers (Claude, local models)
- Template library for common naming patterns
- Learning from user corrections
- Bulk operations with progress tracking
- A/B testing different prompts

---

## Debug Checklist

If something doesn't work:

- [ ] Check TypeScript errors: `yarn typecheck`
- [ ] Check linting: `yarn lint`
- [ ] Check console for errors (both main and renderer)
- [ ] Verify API key is configured
- [ ] Check IPC channel is whitelisted in preload
- [ ] Verify file paths are absolute
- [ ] Check Logger output for service errors
- [ ] Test with simple files first (small TXT files)
- [ ] Verify OpenAI API quota/billing

---

## Completion Criteria

✅ All checkboxes above are marked complete
✅ `yarn typecheck` passes with no errors
✅ `yarn lint` passes with no errors
✅ Manual testing scenarios all pass
✅ No console.log statements (use Logger instead)
✅ Application restarts successfully: `yarn dev`
✅ User can create AI component with naming instruction
✅ Generated filenames are valid and sensible
✅ Error handling works gracefully
✅ Documentation is updated (if needed)

---

**Last Updated:** 2025-11-04
**Status:** Not Started
