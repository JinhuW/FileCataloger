/**
 * @file PatternTabSection.tsx
 * @description Header section with scrollable pattern tabs and add button.
 */

import React from 'react';
import { ScrollableTabContainer } from '@renderer/components/layout';
import { PatternTab } from '../PatternTab';
import { AddPatternButton } from '../AddPatternButton';
import { LoadingSpinner } from '@renderer/components/primitives';
import { PATTERN_VALIDATION } from '@renderer/constants/namingPatterns';
import type { RenamePattern } from '@shared/types/componentDefinition';

const MAX_PATTERNS = PATTERN_VALIDATION.MAX_PATTERNS;

export interface PatternTabSectionProps {
  patterns: RenamePattern[];
  activePatternId: string | null;
  patternCount: number;
  draggedPatternId: string | null;
  isSaving: boolean;
  onPatternSelect: (id: string) => void;
  onPatternDelete: (id: string) => void;
  onPatternRename: (id: string, newName: string) => void;
  onPatternDragStart: (id: string) => void;
  onPatternDragEnd: () => void;
  onPatternDrop: (targetId: string) => void;
  onAddPattern: () => void;
}

export const PatternTabSection: React.FC<PatternTabSectionProps> = React.memo(
  ({
    patterns,
    activePatternId,
    patternCount,
    draggedPatternId,
    isSaving,
    onPatternSelect,
    onPatternDelete,
    onPatternRename,
    onPatternDragStart,
    onPatternDragEnd,
    onPatternDrop,
    onAddPattern,
  }) => {
    return (
      <div style={{ marginBottom: '16px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <h3
            style={{
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              margin: 0,
            }}
          >
            Naming Pattern
          </h3>
          {isSaving && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LoadingSpinner size="small" />
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>Saving...</span>
            </div>
          )}
        </div>

        <ScrollableTabContainer>
          {patterns.map(pattern => (
            <PatternTab
              key={pattern.id}
              id={pattern.id}
              name={pattern.name}
              active={pattern.id === activePatternId}
              editable={true}
              isDragging={draggedPatternId === pattern.id}
              onClick={() => onPatternSelect(pattern.id)}
              onClose={() => onPatternDelete(pattern.id)}
              onRename={newName => onPatternRename(pattern.id, newName)}
              onDragStart={() => onPatternDragStart(pattern.id)}
              onDragEnd={onPatternDragEnd}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                onPatternDrop(pattern.id);
              }}
            />
          ))}
          <AddPatternButton
            onClick={onAddPattern}
            disabled={patternCount >= MAX_PATTERNS}
            maxReached={patternCount >= MAX_PATTERNS}
          />
        </ScrollableTabContainer>
      </div>
    );
  }
);

PatternTabSection.displayName = 'PatternTabSection';
