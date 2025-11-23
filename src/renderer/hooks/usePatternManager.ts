import { useCallback, useEffect } from 'react';
import { usePatternStore } from '@renderer/stores';
import { SavedPattern } from '@shared/types';

export function usePatternManager() {
  const {
    patterns,
    activePatternId,
    error,
    addPattern,
    updatePattern,
    deletePattern,
    setActivePattern,
    duplicatePattern,
    setPatternsFromStorage,
    getActivePattern,
    getAllPatterns,
    getPatternCount,
  } = usePatternStore();

  const loadPatternsFromPreferences = useCallback(async () => {
    try {
      const preferences = await window.api.invoke('preferences:get');
      if (preferences?.namingPatterns?.savedPatterns) {
        setPatternsFromStorage(preferences.namingPatterns.savedPatterns);
      }
    } catch (error) {
      // Failed to load patterns from preferences
    }
  }, [setPatternsFromStorage]);

  // Load patterns from preferences on mount
  useEffect(() => {
    loadPatternsFromPreferences();
  }, [loadPatternsFromPreferences]);

  const savePatternToPreferences = useCallback(async (pattern: SavedPattern) => {
    try {
      const preferences = await window.api.invoke('preferences:get');
      const existingPatterns = preferences?.namingPatterns?.savedPatterns || [];
      const updatedPatterns = existingPatterns.filter((p: SavedPattern) => p.id !== pattern.id);
      updatedPatterns.push(pattern);

      await window.api.invoke('preferences:update', {
        namingPatterns: {
          ...preferences.namingPatterns,
          savedPatterns: updatedPatterns,
        },
      });

      return true;
    } catch (error) {
      // Failed to save pattern to preferences
      return false;
    }
  }, []);

  const removePatternFromPreferences = useCallback(async (patternId: string) => {
    try {
      const preferences = await window.api.invoke('preferences:get');
      const existingPatterns = preferences?.namingPatterns?.savedPatterns || [];
      const updatedPatterns = existingPatterns.filter((p: SavedPattern) => p.id !== patternId);

      await window.api.invoke('preferences:update', {
        namingPatterns: {
          ...preferences.namingPatterns,
          savedPatterns: updatedPatterns,
        },
      });

      return true;
    } catch (error) {
      // Failed to remove pattern from preferences
      return false;
    }
  }, []);

  const createPattern = useCallback(
    async (name: string) => {
      const newPattern: SavedPattern = {
        id: `pattern-${Date.now()}`,
        name,
        components: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      addPattern(newPattern);
      await savePatternToPreferences(newPattern);
      setActivePattern(newPattern.id);

      return newPattern.id;
    },
    [addPattern, savePatternToPreferences, setActivePattern]
  );

  const updatePatternWithSave = useCallback(
    async (id: string, updates: Partial<SavedPattern>) => {
      updatePattern(id, updates);

      const pattern = patterns.get(id);
      if (pattern) {
        await savePatternToPreferences({ ...pattern, ...updates, updatedAt: Date.now() });
      }
    },
    [patterns, updatePattern, savePatternToPreferences]
  );

  const deletePatternWithSave = useCallback(
    async (id: string) => {
      const pattern = patterns.get(id);
      if (pattern) {
        deletePattern(id);
        await removePatternFromPreferences(id);
      }
    },
    [patterns, deletePattern, removePatternFromPreferences]
  );

  const duplicatePatternWithSave = useCallback(
    async (id: string, newName: string) => {
      const newId = duplicatePattern(id, newName);
      if (newId) {
        const newPattern = patterns.get(newId);
        if (newPattern) {
          await savePatternToPreferences(newPattern);
        }
      }
      return newId;
    },
    [duplicatePattern, patterns, savePatternToPreferences]
  );

  return {
    patterns: getAllPatterns(),
    activePattern: getActivePattern(),
    activePatternId,
    error,
    patternCount: getPatternCount(),

    // Actions
    createPattern,
    updatePattern: updatePatternWithSave,
    deletePattern: deletePatternWithSave,
    duplicatePattern: duplicatePatternWithSave,
    setActivePattern,
    reloadPatterns: loadPatternsFromPreferences,
  };
}
