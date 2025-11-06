/**
 * InlineSelectEditor.tsx
 *
 * Notion-style inline select editor with search and create-on-the-fly functionality.
 * Allows users to select existing options or create new ones by typing.
 */

import React, { useState, useRef, useEffect } from 'react';
import { SelectOption } from '@shared/types/componentDefinition';
import { generatePrefixedId } from '@renderer/utils/idGenerator';

export interface InlineSelectEditorProps {
  options: SelectOption[];
  value: string;
  onSave: (optionId: string, newOption?: SelectOption) => void;
  onCancel: () => void;
  color: string;
  anchorRef?: React.RefObject<HTMLElement>;
}

export const InlineSelectEditor: React.FC<InlineSelectEditorProps> = ({
  options,
  value,
  onSave,
  onCancel,
  color,
  anchorRef,
}) => {
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({
    top: window.innerHeight / 2,
    left: window.innerWidth / 2,
  });

  // Filter options by search
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search creates a new option
  const isNewOption =
    search.trim() && !options.find(opt => opt.label.toLowerCase() === search.trim().toLowerCase());

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Calculate dropdown position based on anchor
  useEffect(() => {
    if (!anchorRef?.current) {
      // Fallback to center if no anchor provided
      setPosition({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2,
      });
      return;
    }

    const updatePosition = () => {
      const anchorRect = anchorRef.current!.getBoundingClientRect();
      const dropdownWidth = 300;
      const dropdownMaxHeight = 250;
      const offset = 4;

      // Calculate position below the anchor
      let top = anchorRect.bottom + offset;
      let left = anchorRect.left;

      // Prevent overflow on the right
      const viewportWidth = window.innerWidth;
      if (left + dropdownWidth > viewportWidth - 8) {
        left = viewportWidth - dropdownWidth - 8;
      }

      // Prevent overflow on the left
      if (left < 8) {
        left = 8;
      }

      // Prevent overflow at the bottom (show above if needed)
      const viewportHeight = window.innerHeight;
      if (top + dropdownMaxHeight > viewportHeight - 8) {
        // Show above the anchor instead
        top = anchorRect.top - dropdownMaxHeight - offset;

        // If it still overflows, position at the top
        if (top < 8) {
          top = 8;
        }
      }

      setPosition({ top, left });
    };

    updatePosition();

    // Recalculate on scroll or resize
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [anchorRef]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev =>
        Math.min(prev + 1, filteredOptions.length + (isNewOption ? 0 : -1))
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isNewOption && highlightedIndex === filteredOptions.length) {
        // Create new option
        const newOption: SelectOption = {
          id: generatePrefixedId('opt'),
          label: search.trim(),
          color: color,
        };
        onSave(newOption.id, newOption);
      } else if (filteredOptions[highlightedIndex]) {
        // Select existing option
        onSave(filteredOptions[highlightedIndex].id);
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleSelectOption = (optionId: string) => {
    onSave(optionId);
  };

  const handleCreateOption = () => {
    if (search.trim()) {
      const newOption: SelectOption = {
        id: generatePrefixedId('opt'),
        label: search.trim(),
        color: color,
      };
      onSave(newOption.id, newOption);
    }
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: anchorRef ? `${position.top}px` : '50%',
        left: anchorRef ? `${position.left}px` : '50%',
        transform: anchorRef ? 'none' : 'translate(-50%, -50%)',
        background: '#1a1a1a',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
        minWidth: '280px',
        maxWidth: '320px',
        zIndex: 10000,
        overflow: 'hidden',
      }}
    >
      {/* Search Input */}
      <div style={{ padding: '8px' }}>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search or create option..."
          style={{
            width: '100%',
            padding: '6px 10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '12px',
            outline: 'none',
          }}
        />
      </div>

      {/* Options List */}
      <div
        style={{
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {filteredOptions.map((option, index) => (
          <button
            key={option.id}
            onClick={() => handleSelectOption(option.id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: highlightedIndex === index ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={() => setHighlightedIndex(index)}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: option.color || color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                flex: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {option.label}
            </span>
            {value === option.id && <span style={{ color: '#3b82f6', fontSize: '14px' }}>✓</span>}
          </button>
        ))}

        {/* Create New Option */}
        {isNewOption && (
          <button
            onClick={handleCreateOption}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background:
                highlightedIndex === filteredOptions.length
                  ? 'rgba(59, 130, 246, 0.2)'
                  : 'transparent',
              border: 'none',
              borderTop: filteredOptions.length > 0 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              color: '#3b82f6',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'left',
              fontWeight: 500,
              transition: 'background 0.15s',
            }}
            onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
          >
            <span style={{ fontSize: '14px' }}>+</span>
            <span>Create &quot;{search.trim()}&quot;</span>
          </button>
        )}

        {/* Empty State */}
        {filteredOptions.length === 0 && !isNewOption && (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '11px',
            }}
          >
            No options found
            {search && <div style={{ marginTop: '4px' }}>Type to create a new option</div>}
          </div>
        )}
      </div>
    </div>
  );
};
