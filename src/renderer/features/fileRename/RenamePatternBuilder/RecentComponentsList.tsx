/**
 * RecentComponentsList.tsx
 *
 * Shows recently used components as draggable buttons.
 * Users can click or drag components into the pattern area.
 */

import React, { useState } from 'react';
import { ComponentDefinition } from '@shared/types/componentDefinition';
import { COMPONENT_TYPE_METADATA } from '@renderer/constants/componentTypes';

interface RecentComponentItemProps {
  component: ComponentDefinition;
  onSelect: (componentId: string) => void;
  onSettings?: (componentId: string) => void;
}

const RecentComponentItem: React.FC<RecentComponentItemProps> = ({
  component,
  onSelect,
  onSettings,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const typeMetadata = COMPONENT_TYPE_METADATA[component.type];

  return (
    <div
      draggable={true}
      onDragStart={e => {
        setIsDragging(true);
        e.dataTransfer.setData('componentId', component.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onDragEnd={() => setIsDragging(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        background: isHovered ? `${component.color}25` : `${component.color}15`,
        border: `1px solid ${isHovered ? component.color : `${component.color}40`}`,
        borderRadius: '6px',
        cursor: isDragging ? 'grabbing' : 'default',
        transition: 'all 0.2s',
        minHeight: '44px',
      }}
    >
      {/* Main clickable area */}
      <button
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(component.id);
        }}
        draggable={false}
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
          color: '#fff',
          pointerEvents: 'auto',
        }}
        title={
          component.description
            ? `${component.name}\n${component.description}`
            : `${component.name} - ${typeMetadata.label}`
        }
      >
        {/* Icon */}
        <span style={{ fontSize: '18px', flexShrink: 0 }}>{component.icon}</span>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: component.color,
            }}
          >
            {component.name}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'rgba(255, 255, 255, 0.4)',
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
      {onSettings && (
        <button
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            onSettings(component.id);
          }}
          draggable={false}
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
            pointerEvents: 'auto',
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

export interface RecentComponentsListProps {
  recentComponents: ComponentDefinition[];
  onSelectComponent: (componentId: string) => void;
  onSettingsClick?: (componentId: string) => void;
  showTitle?: boolean;
}

export const RecentComponentsList: React.FC<RecentComponentsListProps> = ({
  recentComponents,
  onSelectComponent,
  onSettingsClick,
  showTitle = true,
}) => {
  if (recentComponents.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.4)',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📚</div>
        <div style={{ fontSize: '12px' }}>No components yet</div>
        <div style={{ fontSize: '11px', marginTop: '4px' }}>Create components to see them here</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      {showTitle && (
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '10px',
            fontWeight: 600,
            padding: '0 0 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}
        >
          Recent Components ({recentComponents.length})
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          overflowY: 'auto', // Enable vertical scrolling
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0,
          paddingRight: '4px', // Space for scrollbar
        }}
      >
        {recentComponents.map(component => (
          <RecentComponentItem
            key={component.id}
            component={component}
            onSelect={onSelectComponent}
            onSettings={onSettingsClick}
          />
        ))}
      </div>
    </div>
  );
};
