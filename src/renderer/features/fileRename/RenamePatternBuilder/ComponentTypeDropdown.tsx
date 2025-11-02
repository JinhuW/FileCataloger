/**
 * ComponentTypeDropdown.tsx
 *
 * Notion-style dropdown for selecting component types or existing components.
 * Supports search, basic type selection, and browsing the component library.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ComponentType } from '@shared/types/componentDefinition';
import { COMPONENT_TYPE_METADATA } from '@renderer/constants/componentTypes';
import { useComponentLibrary } from '@renderer/hooks/useComponentLibrary';

export interface ComponentTypeDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: ComponentType | string) => void;
}

const MenuItem: React.FC<{
  icon: string;
  onClick: () => void;
  children: React.ReactNode;
  hint?: string;
}> = ({ icon, onClick, children, hint }) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      background: 'transparent',
      border: 'none',
      color: 'rgba(255, 255, 255, 0.9)',
      cursor: 'pointer',
      fontSize: '13px',
      textAlign: 'left',
      transition: 'background 0.15s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = 'transparent';
    }}
  >
    <span style={{ fontSize: '16px' }}>{icon}</span>
    <span style={{ flex: 1 }}>{children}</span>
    {hint && <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '11px' }}>{hint}</span>}
  </button>
);

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div style={{ padding: '4px 0' }}>
    <div
      style={{
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: '10px',
        fontWeight: 600,
        padding: '4px 12px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}
    >
      {title}
    </div>
    {children}
  </div>
);

const Divider: React.FC = () => (
  <div
    style={{
      height: '1px',
      background: 'rgba(255, 255, 255, 0.1)',
      margin: '4px 0',
    }}
  />
);

export const ComponentTypeDropdown: React.FC<ComponentTypeDropdownProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const { components } = useComponentLibrary();
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredComponents = useMemo(() => {
    if (!search.trim()) return components;

    const query = search.toLowerCase();
    return components.filter(
      c => c.name.toLowerCase().includes(query) || c.type.toLowerCase().includes(query)
    );
  }, [components, search]);

  const handleSelect = useCallback(
    (selection: ComponentType | string) => {
      onSelect(selection);
      setSearch('');
    },
    [onSelect]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    // Use setTimeout with 0ms to push the handler attachment to the next tick
    // This ensures the opening click event has fully completed
    const timer = setTimeout(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;

        // Check if click is outside both the dropdown and the trigger button
        if (dropdownRef.current && !dropdownRef.current.contains(target)) {
          // Also check if the click is not on the "+ Add Component" button
          const buttonElement = dropdownRef.current.parentElement?.querySelector('button');
          if (buttonElement && !buttonElement.contains(target)) {
            console.log('[ComponentTypeDropdown] Click outside detected, closing dropdown');
            onClose();
          }
        }
      };

      document.addEventListener('mousedown', handleClickOutside);

      // Store handler for cleanup
      (window as any).__dropdownClickHandler = handleClickOutside;
    }, 0); // Changed to 0ms - just need to defer to next tick

    return () => {
      clearTimeout(timer);
      if ((window as any).__dropdownClickHandler) {
        document.removeEventListener('mousedown', (window as any).__dropdownClickHandler);
        delete (window as any).__dropdownClickHandler;
      }
    };
  }, [isOpen, onClose]);

  // Close on Escape key
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

  if (!isOpen) {
    console.log('[ComponentTypeDropdown] Not rendering - isOpen:', isOpen);
    return null;
  }

  console.log(
    '[ComponentTypeDropdown] Rendering dropdown - isOpen:',
    isOpen,
    'components:',
    components.length
  );

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '4px',
        background: '#1a1a1a',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        width: '320px',
        maxHeight: '400px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
      }}
    >
      {/* Search Input */}
      <div style={{ padding: '12px' }}>
        <input
          type="text"
          placeholder="🔍 Search or select type..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
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

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Basic Types */}
        <Section title="BASIC TYPES">
          <MenuItem
            icon={COMPONENT_TYPE_METADATA.text.icon}
            onClick={() => handleSelect('text')}
            hint="Simple text"
          >
            Text
          </MenuItem>
          <MenuItem
            icon={COMPONENT_TYPE_METADATA.select.icon}
            onClick={() => handleSelect('select')}
            hint="Pick from list"
          >
            Select
          </MenuItem>
          <MenuItem
            icon={COMPONENT_TYPE_METADATA.date.icon}
            onClick={() => handleSelect('date')}
            hint="Date formatting"
          >
            Date
          </MenuItem>
          <MenuItem
            icon={COMPONENT_TYPE_METADATA.number.icon}
            onClick={() => handleSelect('number')}
            hint="Counter/version"
          >
            Number
          </MenuItem>
        </Section>

        {/* User's Components */}
        {filteredComponents.length > 0 && (
          <>
            <Divider />
            <Section title={`MY COMPONENTS (${filteredComponents.length})`}>
              {filteredComponents.slice(0, 10).map(component => (
                <MenuItem
                  key={component.id}
                  icon={component.icon}
                  onClick={() => handleSelect(component.id)}
                >
                  {component.name}
                </MenuItem>
              ))}
              {filteredComponents.length > 10 && (
                <div
                  style={{
                    padding: '8px 12px',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontSize: '11px',
                    fontStyle: 'italic',
                  }}
                >
                  +{filteredComponents.length - 10} more...
                </div>
              )}
            </Section>
          </>
        )}

        {/* Browse Options */}
        <Divider />
        <div style={{ padding: '4px 0' }}>
          <MenuItem icon="📚" onClick={() => handleSelect('browse')}>
            Browse Library...
          </MenuItem>
          <MenuItem icon="+" onClick={() => handleSelect('create')}>
            Create New...
          </MenuItem>
        </div>
      </div>
    </div>
  );
};
