/**
 * ComponentChipV2.tsx
 *
 * Improved component chip with inline value editing.
 * Shows "ComponentName | Value" format with direct click-to-edit.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ComponentInstance,
  ComponentDefinition,
  SelectConfig,
  SelectOption,
} from '@shared/types/componentDefinition';
import { resolveComponentValue } from '@renderer/utils/componentValueResolver';
import { InlineSelectEditor } from './InlineSelectEditor';
import { useComponentLibrary } from '@renderer/hooks/useComponentLibrary';

export interface ComponentChipV2Props {
  instance: ComponentInstance;
  definition: ComponentDefinition;
  onRemove: () => void;
  onUpdateInstance?: (updates: Partial<ComponentInstance>) => void;
  canDrag?: boolean;
}

export const ComponentChipV2: React.FC<ComponentChipV2Props> = ({
  instance,
  definition,
  onRemove,
  onUpdateInstance,
  canDrag = true,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [editValue, setEditValue] = useState(instance.value || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const { updateComponent } = useComponentLibrary();

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (definition.type === 'text' || definition.type === 'select' || definition.type === 'date') {
      setIsEditing(true);
      // For date type, convert to YYYY-MM-DD format if needed
      if (definition.type === 'date' && instance.value) {
        setEditValue(instance.value);
      } else if (definition.type === 'date') {
        // Default to today
        const today = new Date().toISOString().split('T')[0];
        setEditValue(today);
      } else {
        setEditValue(instance.value || '');
      }
    }
  };

  const handleSave = () => {
    if (editValue.trim()) {
      onUpdateInstance?.({ value: editValue.trim() });
    }
    setIsEditing(false);
  };

  const handleSelectSave = (optionId: string, newOption?: SelectOption) => {
    // If new option was created, add it to the component definition
    if (newOption) {
      const currentConfig = definition.config as SelectConfig;
      updateComponent(definition.id, {
        config: {
          ...currentConfig,
          options: [...currentConfig.options, newOption],
        },
      });
    }
    onUpdateInstance?.({ value: optionId });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(instance.value || '');
    }
  };

  // Get display value
  let displayValue =
    instance.value || resolveComponentValue(instance, definition, { fileIndex: 1 });

  // For select type, show the option label instead of ID
  if (definition.type === 'select' && instance.value) {
    const selectedOption = (definition.config as SelectConfig).options.find(
      opt => opt.id === instance.value
    );
    displayValue = selectedOption?.label || instance.value;
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
      }}
    >
      <div
        draggable={canDrag && !isEditing}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          background: `${definition.color}20`,
          border: `1px solid ${definition.color}`,
          borderRadius: '6px',
          cursor: canDrag && !isEditing ? 'grab' : 'default',
          transition: 'all 0.2s',
          position: 'relative',
          maxWidth: '300px',
        }}
      >
        {/* Icon */}
        <span style={{ fontSize: '14px', flexShrink: 0 }}>{definition.icon}</span>

        {/* Name | Value */}
        {!isEditing ? (
          <div
            onClick={handleClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor:
                definition.type === 'text' ||
                definition.type === 'select' ||
                definition.type === 'date'
                  ? 'pointer'
                  : 'default',
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                color: definition.color,
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {definition.name}
            </span>
            <span
              style={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '12px',
                flexShrink: 0,
              }}
            >
              |
            </span>
            <span
              style={{
                color: definition.color,
                fontSize: '12px',
                fontWeight: 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}
              title={displayValue}
            >
              {displayValue}
            </span>
          </div>
        ) : definition.type === 'select' ? (
          // Select type shows placeholder while dropdown is rendered below
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>
            Select an option...
          </span>
        ) : // Inline editing for text/date
        definition.type === 'date' ? (
          <input
            ref={inputRef}
            type="date"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '12px',
              padding: '2px 6px',
              outline: 'none',
              minWidth: '120px',
              colorScheme: 'dark',
            }}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '12px',
              padding: '2px 6px',
              outline: 'none',
              minWidth: '80px',
            }}
            placeholder="Enter value..."
          />
        )}

        {/* Remove Button (visible on hover) */}
        {isHovered && !isEditing && (
          <button
            onClick={onRemove}
            title="Remove"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: '12px',
              borderRadius: '3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Inline Select Editor (Notion-style) */}
      {isEditing && definition.type === 'select' && (
        <InlineSelectEditor
          options={(definition.config as SelectConfig).options}
          value={instance.value || ''}
          onSave={handleSelectSave}
          onCancel={() => setIsEditing(false)}
          color={definition.color}
        />
      )}
    </div>
  );
};
