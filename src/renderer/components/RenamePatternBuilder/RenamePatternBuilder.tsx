/**
 * @file RenamePatternBuilder.tsx
 * @description Interactive pattern builder for constructing file rename templates using drag-and-drop
 * components. Provides real-time preview and customizable rename patterns.
 *
 * @props {RenameComponent[]} components - Array of rename pattern components in order
 * @props {function} onChange - Callback when pattern components change
 * @props {function} onRename - Callback to execute the rename operation
 * @props {boolean} hasFiles - Whether files are selected for renaming
 *
 * @features
 * - Visual pattern builder with drag-and-drop component arrangement
 * - Five component types: date, fileName, counter, text, project
 * - Real-time preview of pattern with sample values
 * - Tab-based interface for different pattern formats
 * - Component removal with visual feedback
 * - Rename button with state-dependent styling
 * - Future expansion area for component customization
 *
 * @component-types
 * - date: Current date in YYYYMMDD format
 * - fileName: Original file name (without extension)
 * - counter: Sequential numbering (001, 002, etc.)
 * - text: Custom text input
 * - project: Project name identifier
 *
 * @usage
 * ```tsx
 * <RenamePatternBuilder
 *   components={patternComponents}
 *   onChange={setPatternComponents}
 *   onRename={executeRename}
 *   hasFiles={selectedFiles.length > 0}
 * />
 * ```
 */

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RenameComponent } from '@shared/types';

export interface RenamePatternBuilderProps {
  components: RenameComponent[];
  onChange: (components: RenameComponent[]) => void;
  onRename: () => void;
  hasFiles: boolean;
}

export const RenamePatternBuilder: React.FC<RenamePatternBuilderProps> = ({
  components,
  onChange,
  onRename,
  hasFiles,
}) => {
  const [activeTab, setActiveTab] = useState(0);

  const availableComponents = [
    { type: 'date', label: 'Date', icon: '📅' },
    { type: 'fileName', label: 'File Name', icon: '📄' },
    { type: 'counter', label: 'Counter', icon: '🔢' },
    { type: 'text', label: 'Text', icon: '💬' },
    { type: 'project', label: 'Project', icon: '📁' },
  ];

  const addComponent = useCallback(
    (type: RenameComponent['type']) => {
      const newComponent: RenameComponent = {
        id: `${type}-${Date.now()}`,
        type,
        value: type === 'text' ? 'New Text' : undefined,
        format: type === 'date' ? 'YYYYMMDD' : undefined,
      };

      onChange([...components, newComponent]);
    },
    [components, onChange]
  );

  const removeComponent = useCallback(
    (id: string) => {
      onChange(components.filter(c => c.id !== id));
    },
    [components, onChange]
  );

  // For future use: updating component values
  // const updateComponent = useCallback((id: string, updates: Partial<RenameComponent>) => {
  //   onChange(components.map(c => c.id === id ? { ...c, ...updates } : c));
  // }, [components, onChange]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
      }}
    >
      {/* Header with tabs */}
      <div
        style={{
          marginBottom: '16px',
        }}
      >
        <h3
          style={{
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            margin: '0 0 12px',
          }}
        >
          New File Format
        </h3>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '8px',
          }}
        >
          <button
            style={{
              background: activeTab === 0 ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              border: '1px solid ' + (activeTab === 0 ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)'),
              borderRadius: '6px',
              color: activeTab === 0 ? '#3b82f6' : 'rgba(255, 255, 255, 0.6)',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setActiveTab(0)}
          >
            Format 1
          </button>
          <button
            style={{
              background: activeTab === 1 ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              border: '1px solid ' + (activeTab === 1 ? '#3b82f6' : 'rgba(255, 255, 255, 0.2)'),
              borderRadius: '6px',
              color: activeTab === 1 ? '#3b82f6' : 'rgba(255, 255, 255, 0.6)',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setActiveTab(1)}
          >
            Customized
          </button>
        </div>
      </div>

      {/* Pattern Builder Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Current Pattern */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '16px',
            minHeight: '80px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              minHeight: '48px',
              alignItems: 'center',
            }}
          >
            {components.length === 0 ? (
              <span
                style={{
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '14px',
                }}
              >
                Click components below to build your pattern
              </span>
            ) : (
              components.map((component, index) => (
                <motion.div
                  key={component.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {index > 0 && <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>_</span>}
                  <div
                    style={{
                      background: 'rgba(59, 130, 246, 0.2)',
                      border: '1px solid #3b82f6',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        color: '#3b82f6',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {component.type === 'date' && '20250917'}
                      {component.type === 'fileName' && (component.value || 'File Name')}
                      {component.type === 'counter' && '001'}
                      {component.type === 'text' && (component.value || 'Text')}
                      {component.type === 'project' && (component.value || 'Project')}
                    </span>
                    <button
                      onClick={() => removeComponent(component.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.4)',
                        cursor: 'pointer',
                        padding: '2px',
                        fontSize: '10px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Available Components */}
        <div>
          <h4
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '12px',
              fontWeight: 600,
              margin: '0 0 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Available Components
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
            }}
          >
            {availableComponents.map(comp => (
              <button
                key={comp.type}
                onClick={() => addComponent(comp.type as RenameComponent['type'])}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <span>{comp.icon}</span>
                <span>{comp.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Configuration for selected component */}
        {components.length > 0 && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '12px',
              marginTop: '8px',
            }}
          >
            <p
              style={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '12px',
                margin: 0,
              }}
            >
              Click on components above to configure them
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}
      >
        <button
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: 'rgba(255, 255, 255, 0.6)',
            padding: '10px 20px',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Customize
        </button>
        <button
          onClick={onRename}
          disabled={!hasFiles || components.length === 0}
          style={{
            background: hasFiles && components.length > 0 ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '8px',
            color: hasFiles && components.length > 0 ? '#fff' : 'rgba(255, 255, 255, 0.3)',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: hasFiles && components.length > 0 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          Rename
        </button>
      </div>
    </div>
  );
};
