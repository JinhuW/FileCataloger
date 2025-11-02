/**
 * Pattern Builder Demo
 *
 * Standalone demo page to test the new RenamePatternBuilderV2
 */

import React, { useState } from 'react';
import { RenamePatternBuilderV2 } from '../../features/fileRename/RenamePatternBuilder/RenamePatternBuilderV2';
import type { ShelfItem } from '@shared/types';

export const PatternBuilderDemo: React.FC = () => {
  const [selectedFiles] = useState<ShelfItem[]>([
    {
      id: 'demo-file-1',
      type: 'file',
      name: 'example.pdf',
      path: '/Users/demo/Documents/example.pdf',
      size: 1024,
      createdAt: Date.now(),
    },
    {
      id: 'demo-file-2',
      type: 'file',
      name: 'image.png',
      path: '/Users/demo/Pictures/image.png',
      size: 2048,
      createdAt: Date.now(),
    },
  ]);

  const handleRename = () => {
    console.log('Rename triggered!');
    alert('Rename functionality will be implemented in the next phase!');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        padding: '40px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1
            style={{
              color: '#fff',
              fontSize: '32px',
              fontWeight: 700,
              marginBottom: '8px',
            }}
          >
            🎨 Pattern Builder Demo
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
            Test the new simplified Notion-style component system
          </p>
        </div>

        {/* Demo Container */}
        <div
          style={{
            background: '#1a1a1a',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            minHeight: '600px',
          }}
        >
          <RenamePatternBuilderV2
            hasFiles={true}
            selectedFiles={selectedFiles}
            onDestinationChange={path => console.log('Destination changed:', path)}
            onRename={handleRename}
          />
        </div>

        {/* Instructions */}
        <div
          style={{
            marginTop: '32px',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '12px',
            padding: '20px',
          }}
        >
          <h3
            style={{
              color: '#3b82f6',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: '12px',
            }}
          >
            📋 Testing Instructions:
          </h3>
          <ul
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '13px',
              lineHeight: '1.8',
              paddingLeft: '20px',
            }}
          >
            <li>
              Click <strong>[+ Add Component ▼]</strong> to open the dropdown
            </li>
            <li>Select a basic type (Text, Select, Date, Number) for quick creation</li>
            <li>Or select an existing component from &quot;MY COMPONENTS&quot;</li>
            <li>Click &quot;Browse Library...&quot; to see all components and templates</li>
            <li>Hover over component chips to see settings ⚙️ and remove ✕ buttons</li>
            <li>Click ⚙️ to configure instance-specific settings</li>
            <li>Watch the live preview update as you build your pattern!</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
