# Stage 2: Pattern Persistence

**Timeline**: Week 2
**Priority**: HIGH
**Dependencies**: Stage 1 completion

## Overview

This stage implements persistent storage for naming patterns, allowing users to save, load, and share their custom patterns. We'll leverage the existing storage infrastructure (electron-store and better-sqlite3) while adding pattern-specific functionality.

## Tasks

### Day 1: Storage Schema Design

#### Update Type Definitions

- [ ] **Extend AppPreferences Interface**

  ```typescript
  // src/shared/types/preferences.ts
  interface NamingPatternPreferences {
    savedPatterns: SavedPattern[];
    recentPatternIds: string[];
    defaultPatternId: string;
    maxPatterns: number;
    autoSave: boolean;
    autoSaveDelay: number;
  }
  ```

- [ ] **Define SavedPattern Interface**
  ```typescript
  // src/shared/types/namingPatterns.ts
  interface SavedPattern {
    id: string;
    name: string;
    components: RenameComponent[];
    createdAt: number;
    updatedAt: number;
    usageCount: number;
    tags?: string[];
    description?: string;
    author?: string;
    version: string;
    isBuiltIn: boolean;
    isDefault: boolean;
    metadata?: {
      lastUsed?: number;
      favorite?: boolean;
      category?: string;
      thumbnail?: string;
    };
  }
  ```

#### Database Schema

- [ ] **Create SQL Schema**

  ```sql
  -- patterns table
  CREATE TABLE IF NOT EXISTS patterns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    usage_count INTEGER DEFAULT 0,
    is_built_in INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    author TEXT,
    version TEXT NOT NULL,
    description TEXT,
    metadata TEXT -- JSON
  );

  -- pattern_components table
  CREATE TABLE IF NOT EXISTS pattern_components (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern_id TEXT NOT NULL,
    component_order INTEGER NOT NULL,
    component_type TEXT NOT NULL,
    component_config TEXT NOT NULL, -- JSON
    FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
  );

  -- pattern_tags table
  CREATE TABLE IF NOT EXISTS pattern_tags (
    pattern_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    PRIMARY KEY (pattern_id, tag),
    FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE
  );
  ```

- [ ] **Add Indexes**
  ```sql
  CREATE INDEX idx_patterns_name ON patterns(name);
  CREATE INDEX idx_patterns_usage ON patterns(usage_count DESC);
  CREATE INDEX idx_patterns_updated ON patterns(updated_at DESC);
  CREATE INDEX idx_components_pattern ON pattern_components(pattern_id, component_order);
  ```

### Day 2: Pattern Persistence Manager

#### Create PatternPersistenceManager Class

- [ ] **Basic Structure**

  ```typescript
  // src/main/modules/storage/patternPersistenceManager.ts
  export class PatternPersistenceManager {
    private db: Database;
    private cache: Map<string, SavedPattern>;
    private statements: Map<string, Statement>;

    // CRUD operations
    async savePattern(pattern: SavedPattern): Promise<void>;
    async loadPattern(id: string): Promise<SavedPattern | null>;
    async updatePattern(id: string, updates: Partial<SavedPattern>): Promise<void>;
    async deletePattern(id: string): Promise<boolean>;
    async listPatterns(options?: ListOptions): Promise<SavedPattern[]>;

    // Batch operations
    async saveMultiplePatterns(patterns: SavedPattern[]): Promise<void>;
    async deleteMultiplePatterns(ids: string[]): Promise<number>;

    // Search and filter
    async searchPatterns(query: string): Promise<SavedPattern[]>;
    async getPatternsByTag(tag: string): Promise<SavedPattern[]>;
    async getRecentPatterns(limit: number): Promise<SavedPattern[]>;
    async getFavoritePatterns(): Promise<SavedPattern[]>;

    // Import/Export
    async exportPattern(id: string): Promise<string>;
    async exportAllPatterns(): Promise<string>;
    async importPattern(data: string): Promise<SavedPattern>;
    async importPatterns(data: string): Promise<SavedPattern[]>;

    // Usage tracking
    async incrementUsageCount(id: string): Promise<void>;
    async getUsageStats(): Promise<PatternUsageStats>;

    // Maintenance
    async vacuum(): Promise<void>;
    async backup(): Promise<string>;
    async restore(backupPath: string): Promise<void>;
  }
  ```

#### Implement Core Methods

- [ ] **Save Pattern Method**
  - Validate pattern data
  - Check for duplicates
  - Generate UUID if needed
  - Insert into patterns table
  - Insert components
  - Insert tags
  - Update cache
  - Emit 'pattern-saved' event

- [ ] **Load Pattern Method**
  - Check cache first
  - Query pattern with components
  - Reconstruct pattern object
  - Update cache
  - Return pattern or null

- [ ] **List Patterns Method**
  - Support pagination
  - Sort options (name, date, usage)
  - Filter options (built-in, custom, favorites)
  - Include component count
  - Return array of patterns

#### Validation Layer

- [ ] **Create Validation Schemas with Zod**

  ```typescript
  const PatternComponentSchema = z.object({
    id: z.string(),
    type: z.enum(['date', 'fileName', 'counter', 'text', 'project']),
    value: z.string().optional(),
    format: z.string().optional(),
    config: z.record(z.any()).optional(),
  });

  const SavedPatternSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(50),
    components: z.array(PatternComponentSchema).min(1).max(20),
    // ... other fields
  });
  ```

- [ ] **Sanitization Functions**
  - Strip dangerous characters
  - Validate component configurations
  - Ensure data integrity

### Day 3: IPC Integration

#### Create IPC Channels

- [ ] **Main Process Handlers**

  ```typescript
  // src/main/ipc/patternHandlers.ts

  // Save pattern
  ipcMain.handle('pattern:save', async (event, pattern: SavedPattern) => {
    try {
      await patternManager.savePattern(pattern);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Load pattern
  ipcMain.handle('pattern:load', async (event, id: string) => {
    return await patternManager.loadPattern(id);
  });

  // List patterns
  ipcMain.handle('pattern:list', async (event, options?: ListOptions) => {
    return await patternManager.listPatterns(options);
  });

  // Delete pattern
  ipcMain.handle('pattern:delete', async (event, id: string) => {
    return await patternManager.deletePattern(id);
  });

  // Search patterns
  ipcMain.handle('pattern:search', async (event, query: string) => {
    return await patternManager.searchPatterns(query);
  });

  // Import/Export
  ipcMain.handle('pattern:export', async (event, id: string) => {
    return await patternManager.exportPattern(id);
  });

  ipcMain.handle('pattern:import', async (event, data: string) => {
    return await patternManager.importPattern(data);
  });
  ```

#### Renderer API Layer

- [ ] **Create Pattern API**

  ```typescript
  // src/renderer/api/patterns.ts
  export const patternAPI = {
    save: (pattern: SavedPattern) => window.api.invoke('pattern:save', pattern),
    load: (id: string) => window.api.invoke('pattern:load', id),
    list: (options?: ListOptions) => window.api.invoke('pattern:list', options),
    delete: (id: string) => window.api.invoke('pattern:delete', id),
    search: (query: string) => window.api.invoke('pattern:search', query),
    export: (id: string) => window.api.invoke('pattern:export', id),
    import: (data: string) => window.api.invoke('pattern:import', data),
  };
  ```

- [ ] **Update Preload Script**
  - Expose pattern API methods
  - Add type safety
  - Handle errors gracefully

### Day 4: Auto-save and Sync

#### Implement Auto-save

- [ ] **Create Auto-save Hook**

  ```typescript
  // src/renderer/hooks/usePatternAutoSave.ts
  export function usePatternAutoSave(pattern: SavedPattern | null, delay: number = 2000) {
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<number | null>(null);

    // Debounced save function
    const debouncedSave = useMemo(
      () =>
        debounce(async (patternToSave: SavedPattern) => {
          setIsSaving(true);
          try {
            await patternAPI.save(patternToSave);
            setLastSaved(Date.now());
          } catch (error) {
            console.error('Auto-save failed:', error);
            // Show error notification
          } finally {
            setIsSaving(false);
          }
        }, delay),
      [delay]
    );

    // Effect to trigger auto-save
    useEffect(() => {
      if (pattern && pattern.components.length > 0) {
        debouncedSave(pattern);
      }
    }, [pattern, debouncedSave]);

    return { isSaving, lastSaved };
  }
  ```

- [ ] **Local Storage Backup**
  - Save to localStorage immediately
  - Sync to main process
  - Handle offline scenarios
  - Recover from crashes

#### Conflict Resolution

- [ ] **Handle Concurrent Edits**
  - Version tracking
  - Last-write-wins strategy
  - Optional merge UI
  - Conflict notifications

- [ ] **Sync Status Indicator**
  - Show sync status in UI
  - Indicate unsaved changes
  - Display last saved time
  - Error states

### Day 5: Import/Export Features

#### Export Functionality

- [ ] **Single Pattern Export**

  ```typescript
  interface ExportedPattern {
    version: '1.0.0';
    pattern: SavedPattern;
    exportDate: string;
    appVersion: string;
    checksum: string;
  }
  ```

  - Include all pattern data
  - Add metadata
  - Generate checksum
  - Format as JSON
  - Offer download

- [ ] **Bulk Export**
  - Export all patterns
  - Export selected patterns
  - Include categories/tags
  - ZIP compression option
  - Progress indicator

#### Import Functionality

- [ ] **Import Validation**
  - Verify file format
  - Check version compatibility
  - Validate checksum
  - Scan for security issues
  - Handle duplicates

- [ ] **Import UI**
  - Drag and drop support
  - File picker
  - Preview before import
  - Conflict resolution options
  - Success/error feedback

#### Pattern Sharing

- [ ] **Share via Link**
  - Generate shareable links
  - Copy to clipboard
  - QR code generation
  - Expiration options

- [ ] **Pattern Collections**
  - Bundle related patterns
  - Collection metadata
  - Import entire collections
  - Collection management

## Testing Requirements

### Unit Tests

- [ ] Test PatternPersistenceManager methods
- [ ] Test validation functions
- [ ] Test import/export logic
- [ ] Test conflict resolution
- [ ] Test error scenarios

### Integration Tests

- [ ] Test IPC communication
- [ ] Test database operations
- [ ] Test auto-save functionality
- [ ] Test concurrent access
- [ ] Test data migration

### E2E Tests

- [ ] Save and load patterns
- [ ] Import/export workflows
- [ ] Auto-save scenarios
- [ ] Error recovery
- [ ] Performance tests

## Migration Strategy

### Upgrade Path

- [ ] **From Stage 1 to Stage 2**
  - Detect existing patterns in memory
  - Offer to save to persistent storage
  - Maintain backward compatibility
  - No data loss

### Data Migration

- [ ] **Version 1.0 to 2.0**
  ```typescript
  async function migratePatterns() {
    // Check for old format
    // Convert to new format
    // Save to database
    // Verify migration
    // Clean up old data
  }
  ```

## Performance Considerations

- [ ] **Caching Strategy**
  - LRU cache for patterns
  - Preload frequently used
  - Cache invalidation
  - Memory limits

- [ ] **Database Optimization**
  - Prepared statements
  - Transaction batching
  - Index usage
  - Query optimization

- [ ] **Background Operations**
  - Non-blocking saves
  - Worker thread for exports
  - Progressive loading
  - Lazy component loading

## Security Considerations

- [ ] **Input Validation**
  - Sanitize all inputs
  - Prevent SQL injection
  - XSS prevention
  - Path traversal protection

- [ ] **Data Encryption**
  - Encrypt sensitive data
  - Secure storage keys
  - Safe export format
  - Import scanning

## Deliverables

1. **Persistent Storage System**
   - Database schema implemented
   - CRUD operations working
   - Cache layer functional

2. **Import/Export System**
   - Single pattern export
   - Bulk operations
   - Format validation

3. **Auto-save Functionality**
   - Debounced saving
   - Conflict resolution
   - Status indicators

4. **IPC Integration**
   - All channels implemented
   - Error handling
   - Type safety

## Success Criteria

- [ ] Patterns persist across app restarts
- [ ] Auto-save works within 2 seconds
- [ ] Import/export maintains data integrity
- [ ] No data loss during operations
- [ ] Performance remains smooth
- [ ] All tests pass with >85% coverage

## Next Stage

Stage 3 will build the plugin architecture core, allowing patterns to use custom components beyond the built-in types.
