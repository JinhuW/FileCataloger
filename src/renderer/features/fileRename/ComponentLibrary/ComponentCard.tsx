/**
 * ComponentCard.tsx
 *
 * Card component for displaying a single component in the library browser.
 */

import React, { useState } from 'react';
import { ComponentDefinition } from '@shared/types/componentDefinition';
import { COMPONENT_TYPE_METADATA } from '@renderer/constants/componentTypes';

export interface ComponentCardProps {
  component: ComponentDefinition;
  onClick: () => void;
  onSettingsClick?: (e: React.MouseEvent) => void;
}

export const ComponentCard: React.FC<ComponentCardProps> = ({
  component,
  onClick,
  onSettingsClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const typeMetadata = COMPONENT_TYPE_METADATA[component.type];

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        background: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.05)',
        border: `1px solid ${isHovered ? component.color : 'rgba(255, 255, 255, 0.1)'}`,
        borderRadius: '6px',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        minHeight: '30px',
      }}
    >
      {/* Main clickable area */}
      <button
        onClick={onClick}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flex: 1,
          padding: 0,
          minWidth: 0,
        }}
      >
        {/* Icon */}
        <div style={{ fontSize: '18px', flexShrink: 0 }}>{component.icon}</div>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div
            style={{
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={component.name}
          >
            {component.name}
          </div>
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '10px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {typeMetadata.label}
          </div>
        </div>
      </button>

      {/* Settings button */}
      {onSettingsClick && (
        <button
          onClick={e => {
            e.stopPropagation();
            onSettingsClick(e);
          }}
          style={{
            background: isHovered ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            border: 'none',
            borderRadius: '4px',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '14px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = isHovered
              ? 'rgba(255, 255, 255, 0.1)'
              : 'transparent';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
          title="Component settings"
        >
          ⚙️
        </button>
      )}
    </div>
  );
};
