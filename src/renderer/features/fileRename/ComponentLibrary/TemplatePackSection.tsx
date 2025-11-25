/**
 * TemplatePackSection.tsx
 *
 * Section for browsing and importing template packs.
 */

import React, { useState } from 'react';
import { useComponentTemplates } from '@renderer/hooks/useComponentTemplates';
import { COMPONENT_TYPE_METADATA } from '@renderer/constants/componentTypes';
import { logger } from '@shared/logger';

export interface TemplatePackSectionProps {
  onSelect: (componentId: string) => void;
  onClose: () => void;
}

export const TemplatePackSection: React.FC<TemplatePackSectionProps> = ({ onSelect, onClose }) => {
  const { templatePacks, importTemplate } = useComponentTemplates();
  const [expandedPack, setExpandedPack] = useState<string | null>(null);

  const handleImportTemplate = async (templateId: string) => {
    try {
      const result = await importTemplate(templateId);
      if (result.success && result.componentId) {
        onSelect(result.componentId);
        onClose();
      } else {
        logger.error('Failed to import template:', result.error || 'Unknown error');
      }
    } catch (error) {
      logger.error('Failed to import template:', error);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {templatePacks.map(pack => {
        const isExpanded = expandedPack === pack.id;

        return (
          <div
            key={pack.id}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {/* Pack Header */}
            <button
              onClick={() => setExpandedPack(isExpanded ? null : pack.id)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>{pack.icon}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{pack.name}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {pack.description}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
                  {pack.components.length} components
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </div>
            </button>

            {/* Pack Components */}
            {isExpanded && (
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                }}
              >
                {pack.components.map(component => {
                  const typeMetadata = COMPONENT_TYPE_METADATA[component.type];

                  return (
                    <button
                      key={component.id}
                      onClick={() => handleImportTemplate(component.id)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        minHeight: '44px',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.borderColor = component.color;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                      }}
                    >
                      <div style={{ fontSize: '18px', flexShrink: 0 }}>{component.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
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
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
