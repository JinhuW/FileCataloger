/**
 * @file PatternBuilderCanvas.tsx
 * @description Canvas area for building patterns with component chips,
 * add component button, and metadata components grid.
 */

import React, { useRef, useCallback } from 'react';
import { ComponentInstance, ComponentDefinition } from '@shared/types/componentDefinition';
import { EmptyState } from '@renderer/components/domain';
import { ComponentChip } from './ComponentChip';
import { ComponentTypeDropdown } from './ComponentTypeDropdown';
import { MetadataComponentsGrid } from './MetadataComponentsGrid';
import { PATTERN_VALIDATION } from '@renderer/constants/namingPatterns';

export interface PatternBuilderCanvasProps {
  instances: ComponentInstance[];
  draggedInstanceId: string | null;
  showTypeDropdown: boolean;
  refreshKey: number;
  userComponents: ComponentDefinition[];
  systemComponents: ComponentDefinition[];
  recentComponentsCount: number;
  getComponent: (id: string) => ComponentDefinition | undefined;
  onRemoveInstance: (instanceId: string) => void;
  onUpdateInstance: (instanceId: string, updates: Partial<ComponentInstance>) => void;
  onInstanceDragStart: (instanceId: string) => void;
  onInstanceDragEnd: () => void;
  onInstanceDragOver: (instanceId: string, e: React.DragEvent) => void;
  onInstanceDrop: (targetInstanceId: string) => void;
  onAddComponentFromDrop: (componentId: string) => void;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
  onSelectType: (selection: string) => void;
  onSelectComponent: (componentId: string) => void;
  onSettingsClick: (componentId: string) => void;
}

export const PatternBuilderCanvas: React.FC<PatternBuilderCanvasProps> = React.memo(
  ({
    instances,
    draggedInstanceId,
    showTypeDropdown,
    refreshKey,
    userComponents,
    systemComponents,
    recentComponentsCount,
    getComponent,
    onRemoveInstance,
    onUpdateInstance,
    onInstanceDragStart,
    onInstanceDragEnd,
    onInstanceDragOver,
    onInstanceDrop,
    onAddComponentFromDrop,
    onToggleDropdown,
    onCloseDropdown,
    onSelectType,
    onSelectComponent,
    onSettingsClick,
  }) => {
    const addComponentButtonRef = useRef<HTMLButtonElement>(null);

    const handleButtonMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
    }, []);

    const handleButtonMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    }, []);

    const handleToggleDropdown = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggleDropdown();
      },
      [onToggleDropdown]
    );

    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflow: 'visible',
        }}
      >
        {/* Current Pattern */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '12px',
            height: '168px',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          onDragOver={e => {
            e.preventDefault();
            // Change cursor based on whether limit is reached
            if (instances.length >= PATTERN_VALIDATION.MAX_COMPONENTS) {
              e.dataTransfer.dropEffect = 'none';
            } else {
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={e => {
            e.preventDefault();
            const componentId = e.dataTransfer.getData('componentId');
            if (componentId) {
              onAddComponentFromDrop(componentId);
            }
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: instances.length === 0 ? 'center' : 'flex-start',
              alignContent: instances.length === 0 ? 'center' : 'flex-start',
              justifyContent: instances.length === 0 ? 'center' : 'flex-start',
              minHeight: '144px',
            }}
          >
            {instances.length === 0 ? (
              <EmptyState
                icon="🎯"
                title="No components yet"
                description="Click [+ Add Component] below to start building your pattern"
                compact={true}
                style={{ width: '100%' }}
              />
            ) : (
              instances.map((instance, index) => {
                const definition = getComponent(instance.definitionId);
                if (!definition) return null;

                return (
                  <React.Fragment key={instance.id}>
                    {index > 0 && <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>_</span>}
                    <div
                      onDragOver={e => onInstanceDragOver(instance.id, e)}
                      onDrop={e => {
                        e.preventDefault();
                        onInstanceDrop(instance.id);
                      }}
                      style={{ display: 'inline-block' }}
                    >
                      <ComponentChip
                        instance={instance}
                        definition={definition}
                        onRemove={() => onRemoveInstance(instance.id)}
                        onUpdateInstance={updates => onUpdateInstance(instance.id, updates)}
                        canDrag={true}
                        onDragStart={() => onInstanceDragStart(instance.id)}
                        onDragEnd={onInstanceDragEnd}
                        isDragging={draggedInstanceId === instance.id}
                      />
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>

        {/* Add Component Button */}
        <div style={{ position: 'relative' }}>
          <button
            ref={addComponentButtonRef}
            onClick={handleToggleDropdown}
            aria-label="Add component to pattern"
            aria-expanded={showTypeDropdown}
            aria-haspopup="menu"
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px dashed rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              padding: '10px 16px',
              color: 'rgba(255, 255, 255, 0.8)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={handleButtonMouseEnter}
            onMouseLeave={handleButtonMouseLeave}
          >
            + Add Component ▼
          </button>

          <ComponentTypeDropdown
            isOpen={showTypeDropdown}
            onClose={onCloseDropdown}
            onSelect={onSelectType}
            anchorRef={addComponentButtonRef}
          />
        </div>

        {/* Recent Components Section */}
        <div>
          {/* Title outside the box */}
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '10px',
              fontWeight: 600,
              padding: '0 0 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            File MetaData Components ({recentComponentsCount})
          </div>

          {/* Components grid */}
          <div
            className="component-grid-scrollable"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '12px',
              maxHeight: '252px',
              overflow: 'auto',
            }}
          >
            <MetadataComponentsGrid
              key={refreshKey}
              components={userComponents}
              systemComponents={systemComponents}
              onSelectComponent={onSelectComponent}
              onSettingsClick={onSettingsClick}
              showTitle={false}
            />
          </div>
        </div>
      </div>
    );
  }
);

PatternBuilderCanvas.displayName = 'PatternBuilderCanvas';
