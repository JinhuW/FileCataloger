/**
 * ComponentSettingsPopover.tsx
 *
 * Inline popover for configuring component instance settings.
 * Type-specific forms for different component types.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ComponentInstance,
  ComponentDefinition,
  TextConfig,
  SelectConfig,
  DateConfig,
  NumberConfig,
} from '@shared/types/componentDefinition';
import { DATE_FORMAT_OPTIONS, NUMBER_PADDING_OPTIONS } from '@renderer/constants/componentTypes';
import { resolveComponentValue } from '@renderer/utils/componentValueResolver';

export interface ComponentSettingsPopoverProps {
  instance: ComponentInstance;
  definition: ComponentDefinition;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ComponentInstance>) => void;
}

const Input: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div style={{ marginBottom: '12px' }}>
    <label
      style={{
        display: 'block',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '11px',
        fontWeight: 500,
        marginBottom: '4px',
      }}
    >
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
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
  <div style={{ marginBottom: '12px' }}>
    <label
      style={{
        display: 'block',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '11px',
        fontWeight: 500,
        marginBottom: '4px',
      }}
    >
      {label}
    </label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '6px 10px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '4px',
        color: '#fff',
        fontSize: '12px',
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} style={{ background: '#1a1a1a' }}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const RadioGroup: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: '12px' }}>
    <label
      style={{
        display: 'block',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '11px',
        fontWeight: 500,
        marginBottom: '6px',
      }}
    >
      {label}
    </label>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {options.map(opt => (
        <label
          key={opt.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          <input
            type="radio"
            name={label}
            value={opt.value}
            checked={value === opt.value}
            onChange={e => onChange(e.target.value)}
            style={{ cursor: 'pointer' }}
          />
          {opt.label}
        </label>
      ))}
    </div>
  </div>
);

export const ComponentSettingsPopover: React.FC<ComponentSettingsPopoverProps> = ({
  instance,
  definition,
  isOpen,
  onClose,
  onSave,
}) => {
  const [value, setValue] = useState(instance.value || '');
  const [overrides, setOverrides] = useState(instance.overrides || {});
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const handleApply = useCallback(() => {
    onSave({ value, overrides });
  }, [value, overrides, onSave]);

  const handleRemove = useCallback(() => {
    if (window.confirm('Remove this component from the pattern?')) {
      // This will be handled by parent component
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  // Calculate preview value
  const previewValue = resolveComponentValue(
    { ...instance, value, overrides },
    definition,
    { fileIndex: 1 } // Sample context
  );

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
        zIndex: 1002,
      }}
    >
      <div
        ref={popoverRef}
        style={{
          background: '#1a1a1a',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '10px',
          padding: '16px',
          width: '320px',
          maxHeight: '500px',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h3
          style={{
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 12px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {definition.icon} {definition.name} Settings
        </h3>

        {/* Type-specific settings */}
        {definition.type === 'text' && (
          <Input
            label="Value"
            value={value}
            onChange={setValue}
            placeholder={(definition.config as TextConfig).placeholder || 'Enter text'}
          />
        )}

        {definition.type === 'select' && (
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                display: 'block',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '11px',
                fontWeight: 500,
                marginBottom: '4px',
              }}
            >
              Select Value
            </label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '6px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '4px',
              }}
            >
              {(definition.config as SelectConfig).options.map(option => (
                <label
                  key={option.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '4px 6px',
                    borderRadius: '3px',
                    background: value === option.id ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (value !== option.id) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (value !== option.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="select-option"
                    value={option.id}
                    checked={value === option.id}
                    onChange={e => setValue(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: option.color || definition.color,
                    }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {definition.type === 'date' && (
          <>
            <Select
              label="Format"
              value={overrides.dateFormat || (definition.config as DateConfig).dateFormat}
              onChange={dateFormat => setOverrides({ ...overrides, dateFormat })}
              options={DATE_FORMAT_OPTIONS.map(opt => ({
                value: opt.format,
                label: `${opt.label} (${opt.example})`,
              }))}
            />
            <RadioGroup
              label="Source"
              value={overrides.dateSource || (definition.config as DateConfig).dateSource}
              onChange={dateSource => setOverrides({ ...overrides, dateSource: dateSource as any })}
              options={[
                { value: 'current', label: 'Current date' },
                { value: 'fileCreated', label: 'File created date' },
                { value: 'fileModified', label: 'File modified date' },
              ]}
            />
          </>
        )}

        {definition.type === 'number' && (
          <Select
            label="Padding"
            value={(
              overrides.padding ||
              (definition.config as NumberConfig).padding ||
              3
            ).toString()}
            onChange={padding => setOverrides({ ...overrides, padding: parseInt(padding, 10) })}
            options={NUMBER_PADDING_OPTIONS.map(opt => ({
              value: opt.value.toString(),
              label: `${opt.label} (${opt.example})`,
            }))}
          />
        )}

        {/* Preview */}
        <div
          style={{
            marginTop: '12px',
            padding: '8px 10px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '4px',
          }}
        >
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '10px',
              marginBottom: '2px',
            }}
          >
            Preview
          </div>
          <div
            style={{
              color: '#3b82f6',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {previewValue || '(empty)'}
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            marginTop: '16px',
            display: 'flex',
            gap: '8px',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={handleRemove}
            style={{
              padding: '6px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '4px',
              color: '#ef4444',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: '6px 12px',
                background: '#3b82f6',
                border: 'none',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
