/**
 * ComponentBrowserDialog.tsx
 *
 * Simple dialog for browsing and selecting components from the library.
 * Includes search, template packs, and component creation.
 */

import React, { useState, useMemo } from 'react';
import { ComponentType } from '@shared/types/componentDefinition';
import { useComponentLibrary } from '@renderer/hooks/useComponentLibrary';
import { ComponentCard } from './ComponentCard';
import { TemplatePackSection } from './TemplatePackSection';

export interface ComponentBrowserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (componentId: string) => void;
  onCreateNew?: () => void;
  onEditComponent?: (componentId: string) => void;
}

export const ComponentBrowserDialog: React.FC<ComponentBrowserDialogProps> = ({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
  onEditComponent,
}) => {
  const { components, searchComponents } = useComponentLibrary();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ComponentType | 'all'>('all');
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSettingsClick = (componentId: string) => {
    if (onEditComponent) {
      onEditComponent(componentId);
    }
    // If no handler provided, silently ignore the settings click
  };

  const filteredComponents = useMemo(() => {
    let filtered = search ? searchComponents(search) : components;

    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => c.type === typeFilter);
    }

    return filtered;
  }, [components, search, typeFilter, searchComponents]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1003,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a1a1a',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '12px',
          width: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              color: '#fff',
              fontSize: '18px',
              fontWeight: 600,
              margin: 0,
            }}
          >
            Component Library
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Search & Filters */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <input
            type="text"
            placeholder="🔍 Search components..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
              marginBottom: '12px',
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          />

          {/* Type Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(
              [
                { value: 'all' as const, label: 'All' },
                { value: 'text' as const, label: '📝 Text' },
                { value: 'select' as const, label: '🎯 Select' },
                { value: 'date' as const, label: '📅 Date' },
                { value: 'number' as const, label: '🔢 Number' },
              ] as const
            ).map(filter => (
              <button
                key={filter.value}
                onClick={() => setTypeFilter(filter.value)}
                style={{
                  padding: '6px 12px',
                  background:
                    typeFilter === filter.value
                      ? 'rgba(59, 130, 246, 0.2)'
                      : 'rgba(255, 255, 255, 0.05)',
                  border:
                    typeFilter === filter.value
                      ? '1px solid rgba(59, 130, 246, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: typeFilter === filter.value ? '#3b82f6' : 'rgba(255, 255, 255, 0.7)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: typeFilter === filter.value ? 600 : 400,
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {!showTemplates ? (
            <>
              {/* Component Grid */}
              {filteredComponents.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                  }}
                >
                  {filteredComponents.map(component => (
                    <ComponentCard
                      key={component.id}
                      component={component}
                      onClick={() => {
                        onSelect(component.id);
                        onClose();
                      }}
                      onSettingsClick={() => handleSettingsClick(component.id)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: 'rgba(255, 255, 255, 0.5)',
                  }}
                >
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
                  <div style={{ fontSize: '14px' }}>No components found</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    {search
                      ? 'Try a different search term'
                      : 'Create your first component to get started'}
                  </div>
                </div>
              )}
            </>
          ) : (
            <TemplatePackSection onSelect={onSelect} onClose={onClose} />
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            style={{
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {showTemplates ? '← Back to Library' : '📦 Browse Templates'}
          </button>

          <button
            onClick={() => {
              onCreateNew?.();
              onClose();
            }}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            + Create New Component
          </button>
        </div>
      </div>
    </div>
  );
};
