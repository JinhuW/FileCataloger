/**
 * ComponentEditDialog.tsx
 *
 * Dialog for editing and deleting existing components.
 * Pre-fills all component data and provides update/delete actions.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type {
  SelectOption,
  SelectConfig,
  DateConfig,
  NumberConfig,
  TextConfig,
} from '@shared/types/componentDefinition';
import {
  isSelectComponent,
  isDateComponent,
  isNumberComponent,
  isTextComponent,
} from '@shared/types/componentDefinition';
import {
  COMPONENT_TYPE_METADATA,
  DATE_FORMAT_OPTIONS,
  NUMBER_PADDING_OPTIONS,
} from '@renderer/constants/componentTypes';
import { useComponentLibrary } from '@renderer/hooks/useComponentLibrary';
import { useToast } from '@renderer/stores';
import { EmojiIconPicker } from '@renderer/components/primitives';

export interface ComponentEditDialogProps {
  componentId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (componentId: string) => void;
  onDeleted: (componentId: string) => void;
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

export const ComponentEditDialog: React.FC<ComponentEditDialogProps> = ({
  componentId,
  isOpen,
  onClose,
  onUpdated,
  onDeleted,
}) => {
  const { getComponent, updateComponent, deleteComponent } = useComponentLibrary();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [selectedIcon, setSelectedIcon] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const component = componentId ? getComponent(componentId) : null;
  const metadata = component ? COMPONENT_TYPE_METADATA[component.type] : null;

  // Load component data when dialog opens
  useEffect(() => {
    if (isOpen && component) {
      setName(component.name);
      setDescription(component.description || '');
      setSelectedIcon(component.icon); // Load current icon
      setShowDeleteConfirm(false); // Reset delete confirmation
      setShowIconPicker(false); // Reset icon picker

      // Load type-specific config
      if (isSelectComponent(component)) {
        const selectConfig = component.config as SelectConfig;
        const optionsText = selectConfig.options.map(opt => opt.label).join('\n');
        setConfig({ ...selectConfig, optionsText });
      } else if (isDateComponent(component)) {
        setConfig(component.config as DateConfig);
      } else if (isNumberComponent(component)) {
        setConfig(component.config as NumberConfig);
      } else if (isTextComponent(component)) {
        setConfig(component.config as TextConfig);
      }
    }
  }, [isOpen, component]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
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

  const handleUpdate = useCallback(() => {
    if (!name.trim() || !component) return;

    // Parse options for select type
    let finalConfig = { ...config };
    if (component.type === 'select' && config.optionsText) {
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

    // Update the component
    updateComponent(component.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      icon: selectedIcon,
      config: finalConfig,
    });

    toast.success('Component Updated', `${name} has been updated successfully`);
    onUpdated(component.id);
    onClose();
  }, [
    component,
    name,
    description,
    selectedIcon,
    config,
    updateComponent,
    onUpdated,
    onClose,
    toast,
  ]);

  const handleDelete = useCallback(() => {
    if (!component) return;

    deleteComponent(component.id);
    toast.success('Component Deleted', `${component.name} has been removed from your library`);
    onDeleted(component.id);
    onClose();
  }, [component, deleteComponent, onDeleted, onClose, toast]);

  if (!isOpen || !component || !metadata) return null;

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
        ref={dialogRef}
        className="component-grid-scrollable"
        style={{
          background: '#1a1a1a',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          padding: '20px',
          width: '400px',
          maxHeight: '90vh',
          overflow: 'auto',
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
          {selectedIcon || metadata?.icon || '📝'} Edit {metadata?.label || 'Component'}
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
              placeholder="Component name"
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
        {isTextComponent(component) && (
          <Input
            label="Default Value (optional)"
            value={(config as TextConfig).defaultValue || ''}
            onChange={value => setConfig({ ...config, defaultValue: value })}
            placeholder="Optional default text"
          />
        )}

        {isSelectComponent(component) && (
          <Textarea
            label="Options (one per line)"
            value={config.optionsText || ''}
            onChange={value => setConfig({ ...config, optionsText: value })}
            placeholder="Draft&#10;In Progress&#10;Complete"
            rows={4}
          />
        )}

        {isDateComponent(component) && (
          <Select
            label="Format"
            value={(config as DateConfig).dateFormat || 'YYYYMMDD'}
            onChange={value => setConfig({ ...config, dateFormat: value })}
            options={DATE_FORMAT_OPTIONS.map(opt => ({
              value: opt.format,
              label: `${opt.label} (${opt.example})`,
            }))}
          />
        )}

        {isNumberComponent(component) && (
          <Select
            label="Padding"
            value={(config as NumberConfig).padding?.toString() || '3'}
            onChange={value => setConfig({ ...config, padding: parseInt(value, 10) })}
            options={NUMBER_PADDING_OPTIONS.map(opt => ({
              value: opt.value.toString(),
              label: `${opt.label} (${opt.example})`,
            }))}
          />
        )}

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
            }}
          >
            <p
              style={{
                color: 'rgba(239, 68, 68, 1)',
                fontSize: '13px',
                margin: '0 0 12px 0',
                fontWeight: 500,
              }}
            >
              Are you sure you want to delete this component?
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'space-between',
            marginTop: showDeleteConfirm ? '0' : '16px',
          }}
        >
          {/* Delete button on the left */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={showDeleteConfirm}
            style={{
              padding: '8px 16px',
              background: showDeleteConfirm ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: showDeleteConfirm ? 'rgba(239, 68, 68, 0.5)' : '#ef4444',
              fontSize: '13px',
              fontWeight: 500,
              cursor: showDeleteConfirm ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              if (!showDeleteConfirm) {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              }
            }}
            onMouseLeave={e => {
              if (!showDeleteConfirm) {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              }
            }}
          >
            Delete
          </button>

          {/* Save and Cancel on the right */}
          <div style={{ display: 'flex', gap: '8px' }}>
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
              onClick={handleUpdate}
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
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
