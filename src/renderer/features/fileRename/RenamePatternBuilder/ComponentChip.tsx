/**
 * ComponentChip.tsx
 *
 * Component chip displayed in the pattern builder.
 * Shows component icon, name, and provides settings/remove actions.
 */

import React, { useState } from 'react';
import { ComponentInstance, ComponentDefinition } from '@shared/types/componentDefinition';
import { ComponentSettingsPopover } from './ComponentSettingsPopover';

export interface ComponentChipProps {
  instance: ComponentInstance;
  definition: ComponentDefinition;
  onSettings?: () => void;
  onRemove: () => void;
  onUpdateInstance?: (updates: Partial<ComponentInstance>) => void;
  canDrag?: boolean;
}

export const ComponentChip: React.FC<ComponentChipProps> = ({
  instance,
  definition,
  onSettings,
  onRemove,
  onUpdateInstance,
  canDrag = true,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handleSettingsClick = () => {
    setShowSettings(true);
    onSettings?.();
  };

  const handleSaveSettings = (updates: Partial<ComponentInstance>) => {
    onUpdateInstance?.(updates);
    setShowSettings(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        draggable={canDrag}
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
          cursor: canDrag ? 'grab' : 'default',
          transition: 'all 0.2s',
          position: 'relative',
        }}
        onDragStart={
          canDrag
            ? () => {
                // Implement drag logic
              }
            : undefined
        }
      >
        {/* Icon & Name */}
        <span style={{ fontSize: '14px' }}>{definition.icon}</span>
        <span
          style={{
            color: definition.color,
            fontSize: '12px',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {definition.name}
        </span>

        {/* Actions (visible on hover) */}
        {isHovered && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              marginLeft: '4px',
            }}
          >
            {/* Settings Button */}
            <button
              onClick={handleSettingsClick}
              title="Settings"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '12px',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
              }}
            >
              ⚙️
            </button>

            {/* Remove Button */}
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
          </div>
        )}
      </div>

      {/* Settings Popover */}
      {showSettings && onUpdateInstance && (
        <ComponentSettingsPopover
          instance={instance}
          definition={definition}
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
};
