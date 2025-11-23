/**
 * QuickCreatePopover.tsx
 *
 * Compact popover for quickly creating components with minimal configuration.
 * Type-specific forms for Text, Select, Date, and Number components.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ComponentType, SelectOption } from '@shared/types/componentDefinition';
import {
  COMPONENT_TYPE_METADATA,
  DATE_FORMAT_OPTIONS,
  NUMBER_PADDING_OPTIONS,
} from '@renderer/constants/componentTypes';
import { ComponentService } from '@renderer/services/componentService';
import { useComponentLibrary } from '@renderer/hooks/useComponentLibrary';
import { EmojiIconPicker } from '@renderer/components/primitives';

export interface QuickCreatePopoverProps {
  type: ComponentType;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (componentId: string) => void;
}

const Input: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}> = ({ label, value, onChange, placeholder, autoFocus }) => (
  <div style={{ marginBottom: '16px' }}>
    <label
      style={{
        display: 'block',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '12px',
        fontWeight: 500,
        marginBottom: '6px',
      }}
    >
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '13px',
        outline: 'none',
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }}
    />
  </div>
);

const Textarea: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}> = ({ label, value, onChange, placeholder, rows = 3 }) => (
  <div style={{ marginBottom: '16px' }}>
    <label
      style={{
        display: 'block',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '12px',
        fontWeight: 500,
        marginBottom: '6px',
      }}
    >
      {label}
    </label>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '13px',
        outline: 'none',
        resize: 'vertical',
        fontFamily: 'inherit',
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }}
    />
  </div>
);

const Select: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: '16px' }}>
    <label
      style={{
        display: 'block',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '12px',
        fontWeight: 500,
        marginBottom: '6px',
      }}
    >
      {label}
    </label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '8px 12px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '13px',
        outline: 'none',
        cursor: 'pointer',
      }}
      onFocus={e => {
        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
      }}
      onBlur={e => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const Checkbox: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <div style={{ marginBottom: '16px' }}>
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: '13px',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ cursor: 'pointer' }}
      />
      {label}
    </label>
  </div>
);

export const QuickCreatePopover: React.FC<QuickCreatePopoverProps> = ({
  type,
  isOpen,
  onClose,
  onCreated,
}) => {
  const { createComponent } = useComponentLibrary();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [selectedIcon, setSelectedIcon] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const metadata = COMPONENT_TYPE_METADATA[type];

  // Reset state when popover opens
  useEffect(() => {
    if (isOpen && metadata) {
      setName('');
      setDescription('');
      setConfig({});
      setSaveToLibrary(true);
      setSelectedIcon(metadata.icon || '📝'); // Default to type icon
      setShowIconPicker(false);
    }
  }, [isOpen, type, metadata]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCreate = useCallback(() => {
    if (!name.trim()) return;

    // Parse options for select type
    let finalConfig = { ...config };
    if (type === 'select' && config.optionsText) {
      const options: SelectOption[] = config.optionsText
        .split('\n')
        .filter((line: string) => line.trim())
        .map((line: string, index: number) => ({
          id: `opt-${Date.now()}-${index}`,
          label: line.trim(),
          color: COMPONENT_TYPE_METADATA.select.color,
        }));
      finalConfig = { ...config, options, optionsText: undefined };
    }

    const component = ComponentService.createComponent(type, name.trim(), finalConfig);

    // Add description if provided
    if (description.trim()) {
      component.description = description.trim();
    }

    // Set custom icon if selected
    if (selectedIcon) {
      component.icon = selectedIcon;
    }

    if (saveToLibrary) {
      createComponent(component);
      onCreated(component.id);
    } else {
      // For temporary components, just return the component (handled by parent)
      onCreated(component.id);
    }

    onClose();
  }, [
    type,
    name,
    description,
    selectedIcon,
    config,
    saveToLibrary,
    createComponent,
    onCreated,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
      }}
    >
      <div
        ref={popoverRef}
        style={{
          background: '#1a1a1a',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          padding: '20px',
          width: '360px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h3
          style={{
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            margin: '0 0 16px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {selectedIcon || metadata?.icon || '📝'} Create {metadata?.label || 'New'} Component
        </h3>

        {/* Name field with icon selector */}
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <label
            style={{
              display: 'block',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '6px',
            }}
          >
            Name
          </label>
          <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
            {/* Icon Button */}
            <button
              type="button"
              onClick={() => setShowIconPicker(!showIconPicker)}
              style={{
                width: '40px',
                height: '40px',
                flexShrink: 0,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              {selectedIcon || metadata?.icon || '📝'}
            </button>

            {/* Name Input */}
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Project Name"
              autoFocus
              style={{
                flex: 1,
                padding: '8px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            />

            {/* Icon Picker Dropdown */}
            <EmojiIconPicker
              selectedIcon={selectedIcon}
              onSelect={setSelectedIcon}
              isOpen={showIconPicker}
              onClose={() => setShowIconPicker(false)}
            />
          </div>
        </div>

        <Input
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="Describe this component..."
        />

        {/* Type-specific config */}
        {type === 'text' && (
          <Input
            label="Default Value (optional)"
            value={config.defaultValue || ''}
            onChange={value => setConfig({ ...config, defaultValue: value })}
            placeholder="Optional default text"
          />
        )}

        {type === 'select' && (
          <Textarea
            label="Options (one per line)"
            value={config.optionsText || ''}
            onChange={value => setConfig({ ...config, optionsText: value })}
            placeholder="Draft&#10;In Progress&#10;Complete"
            rows={4}
          />
        )}

        {type === 'date' && (
          <Select
            label="Format"
            value={config.dateFormat || 'YYYYMMDD'}
            onChange={value => setConfig({ ...config, dateFormat: value })}
            options={DATE_FORMAT_OPTIONS.map(opt => ({
              value: opt.format,
              label: `${opt.label} (${opt.example})`,
            }))}
          />
        )}

        {type === 'number' && (
          <Select
            label="Padding"
            value={config.padding?.toString() || '3'}
            onChange={value => setConfig({ ...config, padding: parseInt(value, 10) })}
            options={NUMBER_PADDING_OPTIONS.map(opt => ({
              value: opt.value.toString(),
              label: `${opt.label} (${opt.example})`,
            }))}
          />
        )}

        <Checkbox
          label="Save to library for reuse"
          checked={saveToLibrary}
          onChange={setSaveToLibrary}
        />

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            style={{
              padding: '8px 16px',
              background: name.trim() ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};
