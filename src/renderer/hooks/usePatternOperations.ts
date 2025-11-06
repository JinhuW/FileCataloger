/**
 * @file usePatternOperations.ts
 * @description Custom hook for pattern CRUD operations.
 * Extracts pattern management logic for better code organization.
 */

import { useCallback, useState } from 'react';
import { useToast } from '@renderer/stores';
import { usePatternManager } from './usePatternManager';

export function usePatternOperations() {
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();
  const { createPattern, updatePattern, deletePattern } = usePatternManager();

  /**
   * Create a new pattern with the given name
   */
  const handleCreatePattern = useCallback(
    async (patternName: string) => {
      if (!patternName.trim()) {
        toast.error('Invalid Pattern Name', 'Pattern name cannot be empty');
        return false;
      }

      setIsSaving(true);
      try {
        await createPattern(patternName.trim());
        toast.success('Pattern Created', `"${patternName.trim()}" has been created`);
        return true;
      } catch (error) {
        toast.error('Failed to Create Pattern', 'Please try again');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [createPattern, toast]
  );

  /**
   * Rename an existing pattern
   */
  const handleRenamePattern = useCallback(
    async (patternId: string, newName: string) => {
      try {
        await updatePattern(patternId, { name: newName });
        toast.success('Pattern Renamed', 'Pattern has been renamed successfully');
        return true;
      } catch (error) {
        toast.error('Failed to Rename Pattern', 'Please try again');
        return false;
      }
    },
    [updatePattern, toast]
  );

  /**
   * Delete a pattern after confirmation
   */
  const handleDeletePattern = useCallback(
    async (patternId: string, patternName?: string) => {
      const confirmMessage = patternName
        ? `Are you sure you want to delete "${patternName}"?`
        : 'Are you sure you want to delete this pattern?';

      if (window.confirm(confirmMessage)) {
        try {
          await deletePattern(patternId);
          toast.success('Pattern Deleted', 'Pattern has been deleted successfully');
          return true;
        } catch (error) {
          toast.error('Failed to Delete Pattern', 'Please try again');
          return false;
        }
      }
      return false;
    },
    [deletePattern, toast]
  );

  return {
    isSaving,
    handleCreatePattern,
    handleRenamePattern,
    handleDeletePattern,
  };
}
