/**
 * Component Library Demo
 *
 * Simplified Notion-like interface for creating and managing components
 */

import React, { useState } from 'react';
import { useComponentLibrary } from '../../hooks/useComponentLibrary';
import { ComponentService } from '../../services/componentService';
import { COMPONENT_TYPE_METADATA } from '../../constants/componentTypes';
import type { ComponentType } from '../../../shared/types/componentDefinition';

export const ComponentLibraryDemo: React.FC = () => {
  const { components, createComponent, deleteComponent } = useComponentLibrary();
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [newComponentName, setNewComponentName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📝');

  const handleCreateComponent = (type: ComponentType) => {
    if (!newComponentName.trim()) {
      // If no name entered, just create with type name as placeholder
      const meta = COMPONENT_TYPE_METADATA[type];
      const component = ComponentService.createComponent(type, `New ${meta.label}`, undefined);
      component.icon = selectedIcon; // Use selected icon
      createComponent(component);
    } else {
      const component = ComponentService.createComponent(type, newComponentName, undefined);
      component.icon = selectedIcon; // Use selected icon
      createComponent(component);
      setNewComponentName('');
    }
    setShowTypeMenu(false);
    setShowIconPicker(false);
    setSelectedIcon('📝'); // Reset to default
  };

  const commonIcons = [
    '📁',
    '📊',
    '📈',
    '📉',
    '💼',
    '🏢',
    '👤',
    '👥',
    '📧',
    '📞',
    '🌍',
    '📸',
    '🎨',
    '🎬',
    '🎵',
    '💻',
    '✅',
    '❌',
    '⚠️',
    '🚀',
    '⭐',
    '📝',
    '🎯',
    '📅',
    '🔢',
    '🏷️',
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              {/* Icon Picker Button */}
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-10 h-10 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-xl"
                title="Choose icon"
              >
                {selectedIcon}
              </button>

              <input
                type="text"
                value={newComponentName}
                onChange={e => setNewComponentName(e.target.value)}
                placeholder="Property name"
                className="flex-1 px-3 py-2 text-sm border-none focus:outline-none"
                onFocus={() => setShowTypeMenu(true)}
              />
            </div>
          </div>

          {/* Icon Picker Dropdown */}
          {showIconPicker && (
            <div className="px-6 py-3 border-b border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-2">Choose an icon</div>
              <div className="grid grid-cols-8 gap-2">
                {commonIcons.map(icon => (
                  <button
                    key={icon}
                    onClick={() => {
                      setSelectedIcon(icon);
                      setShowIconPicker(false);
                    }}
                    className={`w-10 h-10 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-xl ${
                      selectedIcon === icon ? 'bg-blue-50 ring-2 ring-blue-500' : ''
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Components (Template Shortcuts) */}
          {showTypeMenu && components.length === 0 && (
            <div className="px-6 py-3 border-b border-gray-100">
              <div className="text-xs font-medium text-gray-500 mb-2">Suggested</div>
              <div className="space-y-1">
                <button
                  onClick={() => handleCreateComponent('number')}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded text-left"
                >
                  <span className="text-lg">🔢</span>
                  <span className="text-sm">Counter</span>
                </button>
                <button
                  onClick={() => handleCreateComponent('select')}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded text-left"
                >
                  <span className="text-lg">🎯</span>
                  <span className="text-sm">Project</span>
                </button>
                <button
                  onClick={() => handleCreateComponent('select')}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded text-left"
                >
                  <span className="text-lg">📊</span>
                  <span className="text-sm">Status</span>
                </button>
              </div>
            </div>
          )}

          {/* Type Selection */}
          {showTypeMenu && (
            <div className="px-6 py-3">
              <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2">
                <span>Type</span>
                <span className="text-gray-400">🔍</span>
              </div>
              <div className="space-y-1">
                {(Object.keys(COMPONENT_TYPE_METADATA) as ComponentType[]).map(type => {
                  const meta = COMPONENT_TYPE_METADATA[type];
                  return (
                    <button
                      key={type}
                      onClick={() => handleCreateComponent(type)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded text-left transition-colors"
                    >
                      <span className="text-lg">{meta.icon}</span>
                      <span className="text-sm font-medium">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Component List */}
          {!showTypeMenu && components.length > 0 && (
            <div className="divide-y divide-gray-100">
              {components.map(component => {
                const meta = COMPONENT_TYPE_METADATA[component.type];
                return (
                  <div
                    key={component.id}
                    className="px-6 py-3 flex items-center gap-3 hover:bg-gray-50 group"
                  >
                    <span className="text-lg">{component.icon}</span>
                    <span className="flex-1 text-sm font-medium">{component.name}</span>
                    <span className="text-xs text-gray-400">{meta.label}</span>
                    <button
                      onClick={() => deleteComponent(component.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!showTypeMenu && components.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-400">
              <div className="text-4xl mb-2">📝</div>
              <p className="text-sm">Click above to create your first component</p>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="mt-6 text-center text-xs text-gray-500">
          <p>
            Create components like <strong>Project</strong>, <strong>Status</strong>, or{' '}
            <strong>Client</strong> from basic types
          </p>
        </div>
      </div>
    </div>
  );
};
