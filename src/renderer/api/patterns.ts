import { SavedPattern } from '@shared/types';

// Type for IPC response wrapper
interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Type for list options
interface ListOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'usageCount';
  sortOrder?: 'asc' | 'desc';
  includeBuiltIn?: boolean;
  favorite?: boolean;
  tags?: string[];
}

// Helper function to handle IPC responses
function handleIPCResponse<T>(response: IPCResponse<T>): T {
  if (!response.success) {
    throw new Error(response.error || 'Operation failed');
  }
  return response.data!;
}

// Pattern API for renderer process
export const patternAPI = {
  // Basic CRUD operations
  save: async (pattern: SavedPattern): Promise<void> => {
    const response = await window.api.invoke('pattern:save', pattern);
    return handleIPCResponse(response as IPCResponse<void>);
  },

  load: async (id: string): Promise<SavedPattern | null> => {
    const response = await window.api.invoke('pattern:load', id);
    return handleIPCResponse(response as IPCResponse<SavedPattern | null>);
  },

  update: async (id: string, updates: Partial<SavedPattern>): Promise<void> => {
    const response = await window.api.invoke('pattern:update', id, updates);
    return handleIPCResponse(response as IPCResponse<void>);
  },

  delete: async (id: string): Promise<boolean> => {
    const response = await window.api.invoke('pattern:delete', id);
    return handleIPCResponse(response as IPCResponse<boolean>);
  },

  list: async (options?: ListOptions): Promise<SavedPattern[]> => {
    const response = await window.api.invoke('pattern:list', options);
    return handleIPCResponse(response as IPCResponse<SavedPattern[]>);
  },

  // Search and filtering
  search: async (query: string): Promise<SavedPattern[]> => {
    const response = await window.api.invoke('pattern:search', query);
    return handleIPCResponse(response as IPCResponse<SavedPattern[]>);
  },

  getByTag: async (tag: string): Promise<SavedPattern[]> => {
    const response = await window.api.invoke('pattern:get-by-tag', tag);
    return handleIPCResponse(response as IPCResponse<SavedPattern[]>);
  },

  getRecent: async (limit?: number): Promise<SavedPattern[]> => {
    const response = await window.api.invoke('pattern:get-recent', limit);
    return handleIPCResponse(response as IPCResponse<SavedPattern[]>);
  },

  getFavorites: async (): Promise<SavedPattern[]> => {
    const response = await window.api.invoke('pattern:get-favorites');
    return handleIPCResponse(response as IPCResponse<SavedPattern[]>);
  },

  // Usage tracking
  incrementUsage: async (id: string): Promise<void> => {
    const response = await window.api.invoke('pattern:increment-usage', id);
    return handleIPCResponse(response as IPCResponse<void>);
  },

  getStats: async (): Promise<any> => {
    const response = await window.api.invoke('pattern:get-stats');
    return handleIPCResponse(response);
  },

  // Batch operations
  saveMultiple: async (patterns: SavedPattern[]): Promise<void> => {
    const response = await window.api.invoke('pattern:save-multiple', patterns);
    return handleIPCResponse(response);
  },

  deleteMultiple: async (ids: string[]): Promise<number> => {
    const response = await window.api.invoke('pattern:delete-multiple', ids);
    return handleIPCResponse(response);
  },

  // Export operations
  export: async (id: string): Promise<string> => {
    const response = await window.api.invoke('pattern:export', id);
    return handleIPCResponse(response);
  },

  exportAll: async (): Promise<string> => {
    const response = await window.api.invoke('pattern:export-all');
    return handleIPCResponse(response);
  },

  exportToFile: async (id: string): Promise<string> => {
    const response = await window.api.invoke('pattern:export-to-file', id);
    return handleIPCResponse(response);
  },

  exportAllToFile: async (): Promise<string> => {
    const response = await window.api.invoke('pattern:export-all-to-file');
    return handleIPCResponse(response);
  },

  // Import operations
  import: async (data: string): Promise<SavedPattern> => {
    const response = await window.api.invoke('pattern:import', data);
    return handleIPCResponse(response);
  },

  importMultiple: async (data: string): Promise<SavedPattern[]> => {
    const response = await window.api.invoke('pattern:import-multiple', data);
    return handleIPCResponse(response);
  },

  importFromFile: async (): Promise<SavedPattern[]> => {
    const response = await window.api.invoke('pattern:import-from-file');
    return handleIPCResponse(response);
  },

  // Maintenance operations
  vacuum: async (): Promise<void> => {
    const response = await window.api.invoke('pattern:vacuum');
    return handleIPCResponse(response);
  },

  backup: async (): Promise<string> => {
    const response = await window.api.invoke('pattern:backup');
    return handleIPCResponse(response);
  },

  restore: async (backupPath: string): Promise<void> => {
    const response = await window.api.invoke('pattern:restore', backupPath);
    return handleIPCResponse(response);
  },

  backupToFile: async (): Promise<string> => {
    const response = await window.api.invoke('pattern:backup-to-file');
    return handleIPCResponse(response);
  },

  restoreFromFile: async (): Promise<void> => {
    const response = await window.api.invoke('pattern:restore-from-file');
    return handleIPCResponse(response);
  },
};

// Helper functions for common operations

// Check if a pattern name is available
export async function isPatternNameAvailable(name: string, excludeId?: string): Promise<boolean> {
  try {
    const patterns = await patternAPI.list();
    return !patterns.some(p => p.name === name && p.id !== excludeId);
  } catch (error) {
    console.warn('Failed to check pattern name availability:', error);
    return true; // Assume available if check fails
  }
}

// Get a unique name for a new pattern
export async function getUniquePatternName(baseName: string): Promise<string> {
  let name = baseName;
  let counter = 1;

  while (!(await isPatternNameAvailable(name))) {
    name = `${baseName} (${counter})`;
    counter++;
  }

  return name;
}

// Toggle favorite status of a pattern
export async function togglePatternFavorite(pattern: SavedPattern): Promise<SavedPattern> {
  const updatedPattern = {
    ...pattern,
    metadata: {
      ...pattern.metadata,
      favorite: !pattern.metadata?.favorite,
    },
  };

  await patternAPI.update(pattern.id, updatedPattern);
  return updatedPattern;
}

// Duplicate a pattern with a new name
export async function duplicatePattern(
  pattern: SavedPattern,
  newName?: string
): Promise<SavedPattern> {
  const name = newName || (await getUniquePatternName(`${pattern.name} Copy`));

  const duplicatedPattern: SavedPattern = {
    ...pattern,
    id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBuiltIn: false,
    isDefault: false,
    metadata: {
      ...pattern.metadata,
      usageCount: 0,
      lastUsed: undefined,
    },
  };

  await patternAPI.save(duplicatedPattern);
  return duplicatedPattern;
}

// Export patterns with validation
export async function exportPatternsWithValidation(patternIds?: string[]): Promise<string> {
  try {
    if (!patternIds || patternIds.length === 0) {
      return await patternAPI.exportAll();
    } else if (patternIds.length === 1) {
      return await patternAPI.export(patternIds[0]);
    } else {
      // Export multiple specific patterns
      const patterns = await Promise.all(patternIds.map(id => patternAPI.load(id)));

      const validPatterns = patterns.filter(p => p !== null) as SavedPattern[];

      if (validPatterns.length === 0) {
        throw new Error('No valid patterns found to export');
      }

      const exportData = {
        version: '1.0.0',
        patterns: validPatterns,
        exportDate: new Date().toISOString(),
        checksum: generateSimpleChecksum(validPatterns),
      };

      return JSON.stringify(exportData, null, 2);
    }
  } catch (error) {
    throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Simple checksum generator for client-side validation
function generateSimpleChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}
