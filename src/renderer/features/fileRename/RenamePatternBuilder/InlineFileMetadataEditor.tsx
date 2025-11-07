/**
 * InlineFileMetadataEditor.tsx
 *
 * Inline editor for selecting file metadata fields.
 * Shows grouped options: Basic, Dates, Images.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { FileMetadataField } from '@shared/types/componentDefinition';
import {
  FILE_METADATA_FIELD_OPTIONS,
  type FileMetadataFieldOption,
} from '@renderer/constants/componentTypes';

export interface InlineFileMetadataEditorProps {
  value: FileMetadataField;
  onSave: (field: FileMetadataField) => void;
  onCancel: () => void;
  color: string;
  anchorRef?: React.RefObject<HTMLElement>;
}

export const InlineFileMetadataEditor: React.FC<InlineFileMetadataEditorProps> = ({
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
  const filteredOptions = FILE_METADATA_FIELD_OPTIONS.filter(
    opt =>
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      opt.description.toLowerCase().includes(search.toLowerCase())
  );

  // Group filtered options by category
  const groupedOptions: Record<string, FileMetadataFieldOption[]> = {
    basic: filteredOptions.filter(opt => opt.category === 'basic'),
    dates: filteredOptions.filter(opt => opt.category === 'dates'),
    images: filteredOptions.filter(opt => opt.category === 'images'),
  };

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
      if (!anchorRef.current) return;
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const dropdownWidth = 340;
      const dropdownMaxHeight = 350;
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
      setHighlightedIndex(prev => Math.min(prev + 1, filteredOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        onSave(filteredOptions[highlightedIndex].value as FileMetadataField);
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const handleSelectField = (field: FileMetadataField) => {
    onSave(field);
  };

  const categoryLabels = {
    basic: 'Basic File Info',
    dates: 'Date Information',
    images: 'Image Metadata',
  };

  const categoryEmojis = {
    basic: '📄',
    dates: '📅',
    images: '🖼️',
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
        minWidth: '320px',
        maxWidth: '380px',
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
          placeholder="Search file metadata fields..."
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
          maxHeight: '300px',
          overflowY: 'auto',
        }}
      >
        {/* Render grouped options */}
        {(Object.keys(groupedOptions) as Array<keyof typeof groupedOptions>).map(category => {
          const options = groupedOptions[category];
          if (options.length === 0) return null;

          return (
            <div key={category}>
              {/* Category Header */}
              <div
                style={{
                  padding: '6px 12px',
                  fontSize: '10px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.4)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderTop: category !== 'basic' ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '12px' }}>{categoryEmojis[category]}</span>
                {categoryLabels[category]}
              </div>

              {/* Category Options */}
              {options.map(option => {
                const globalIndex = filteredOptions.indexOf(option);
                return (
                  <button
                    key={option.value}
                    onClick={() => handleSelectField(option.value as FileMetadataField)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '2px',
                      padding: '8px 12px',
                      background:
                        highlightedIndex === globalIndex
                          ? 'rgba(245, 158, 11, 0.2)'
                          : 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={() => setHighlightedIndex(globalIndex)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{option.label}</span>
                      {value === option.value && (
                        <span style={{ color: color, fontSize: '14px' }}>✓</span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'rgba(255, 255, 255, 0.4)',
                        lineHeight: '1.3',
                      }}
                    >
                      {option.description}
                    </span>
                    {option.requiresImageFile && (
                      <span
                        style={{
                          fontSize: '9px',
                          color: 'rgba(245, 158, 11, 0.6)',
                          marginTop: '2px',
                        }}
                      >
                        ⚠️ Images only
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Empty State */}
        {filteredOptions.length === 0 && (
          <div
            style={{
              padding: '16px',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '11px',
            }}
          >
            No metadata fields found
          </div>
        )}
      </div>
    </div>
  );
};
