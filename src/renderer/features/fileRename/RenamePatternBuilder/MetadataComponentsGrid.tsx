/**
 * MetadataComponentsGrid.tsx
 *
 * Displays all file metadata components from the library in a grid layout.
 * Users can click or drag components into the pattern area.
 */

import React, { useState } from 'react';
import { ComponentDefinition } from '@shared/types/componentDefinition';
import { COMPONENT_TYPE_METADATA } from '@renderer/constants/componentTypes';
import { CustomTooltip } from '@renderer/components/primitives';
import { buildActionTooltip } from '@renderer/utils/tooltipUtils';

interface MetadataComponentItemProps {
  component: ComponentDefinition;
  onSelect: (componentId: string) => void;
  onSettings?: (componentId: string) => void;
  isSystemComponent?: boolean;
}

const MetadataComponentItem: React.FC<MetadataComponentItemProps> = ({
  component,
  onSelect,
  onSettings,
  isSystemComponent = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const typeMetadata = COMPONENT_TYPE_METADATA[component.type];

  // Button content - reusable
  const buttonContent = (
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
  );

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
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: 'all 0.2s',
        minHeight: '30px',
      }}
    >
      {/* Main clickable area with conditional tooltip */}
      {component.description ? (
        <CustomTooltip content={component.description} position="top" showDelay={600}>
          {buttonContent}
        </CustomTooltip>
      ) : (
        buttonContent
      )}

      {/* Lock icon for system components or Settings button for user components */}
      {isSystemComponent ? (
        <CustomTooltip content="System component - cannot be deleted" position="top">
          <div
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'rgba(255, 255, 255, 0.3)',
              fontSize: '12px',
              pointerEvents: 'none',
            }}
          >
            🔒
          </div>
        </CustomTooltip>
      ) : (
        onSettings && (
          <CustomTooltip content={buildActionTooltip('Component settings')} position="top">
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
            >
              ⚙️
            </button>
          </CustomTooltip>
        )
      )}
    </div>
  );
};

export interface MetadataComponentsGridProps {
  components: ComponentDefinition[]; // User components
  systemComponents?: ComponentDefinition[]; // System components
  onSelectComponent: (componentId: string) => void;
  onSettingsClick?: (componentId: string) => void;
  showTitle?: boolean;
}

export const MetadataComponentsGrid: React.FC<MetadataComponentsGridProps> = ({
  components,
  systemComponents = [],
  onSelectComponent,
  onSettingsClick,
  showTitle = true,
}) => {
  const totalComponents = systemComponents.length + components.length;

  if (totalComponents === 0) {
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
          File MetaData Components ({totalComponents})
        </div>
      )}
      <div
        className="component-grid-scrollable"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1.2fr))',
          gap: '8px',
          overflowY: 'auto', // Enable vertical scrolling
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0,
          paddingRight: '4px', // Space for scrollbar
        }}
      >
        {/* Render system components first */}
        {systemComponents.map(component => (
          <MetadataComponentItem
            key={component.id}
            component={component}
            onSelect={onSelectComponent}
            onSettings={undefined} // System components cannot be edited
            isSystemComponent={true}
          />
        ))}
        {/* Then render user components */}
        {components.map(component => (
          <MetadataComponentItem
            key={component.id}
            component={component}
            onSelect={onSelectComponent}
            onSettings={onSettingsClick}
            isSystemComponent={false}
          />
        ))}
      </div>
    </div>
  );
};
