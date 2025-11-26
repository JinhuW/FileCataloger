/**
 * Creative Template Pack
 *
 * Components for creative assets and media files.
 */

import { ComponentTemplatePack, createTemplateComponent } from './templateTypes';

export const CREATIVE_TEMPLATE_PACK: ComponentTemplatePack = {
  id: 'creative-pack',
  name: 'Creative Pack',
  description: 'Components for creative assets and media files',
  icon: '🎨',
  components: [
    // Select Components
    createTemplateComponent(
      'Asset Type',
      'select',
      '🎨',
      {
        options: [
          { id: '1', label: 'Photo', color: '#3b82f6' },
          { id: '2', label: 'Video', color: '#ec4899' },
          { id: '3', label: 'Audio', color: '#8b5cf6' },
          { id: '4', label: 'Graphic', color: '#10b981' },
          { id: '5', label: 'Document', color: '#6b7280' },
        ],
        allowInlineCreate: true,
        defaultOption: '1',
      },
      '#3b82f6'
    ),
    createTemplateComponent(
      'Resolution',
      'select',
      '📐',
      {
        options: [
          { id: '1', label: '720p', color: '#6b7280' },
          { id: '2', label: '1080p', color: '#3b82f6' },
          { id: '3', label: '4K', color: '#10b981' },
          { id: '4', label: '8K', color: '#ef4444' },
        ],
        allowInlineCreate: true,
      },
      '#3b82f6'
    ),
    createTemplateComponent(
      'Color Space',
      'select',
      '🌈',
      {
        options: [
          { id: '1', label: 'sRGB', color: '#3b82f6' },
          { id: '2', label: 'Adobe RGB', color: '#ef4444' },
          { id: '3', label: 'ProPhoto RGB', color: '#8b5cf6' },
        ],
        allowInlineCreate: false,
      },
      '#3b82f6'
    ),

    // Date Components
    createTemplateComponent(
      'Shoot Date',
      'date',
      '📸',
      {
        dateFormat: 'YYYYMMDD',
        dateSource: 'file-created',
      },
      '#10b981'
    ),
    createTemplateComponent(
      'Edit Date',
      'date',
      '✂️',
      {
        dateFormat: 'YYYY-MM-DD',
        dateSource: 'file-modified',
      },
      '#10b981'
    ),

    // Text Components
    createTemplateComponent('Photographer', 'text', '📷', {
      defaultValue: '',
      placeholder: 'Photographer name...',
      maxLength: 50,
    }),
    createTemplateComponent('Editor', 'text', '✏️', {
      defaultValue: '',
      placeholder: 'Editor name...',
      maxLength: 50,
    }),
    createTemplateComponent('Location', 'text', '📍', {
      defaultValue: '',
      placeholder: 'Location...',
      maxLength: 100,
    }),

    // Number Components
    createTemplateComponent(
      'Take Number',
      'number',
      '🎬',
      {
        numberFormat: 'padded',
        padding: 2,
        prefix: 'T',
        autoIncrement: true,
        startNumber: 1,
        incrementStep: 1,
      },
      '#8b5cf6'
    ),
    createTemplateComponent(
      'Sequence',
      'number',
      '📸',
      {
        numberFormat: 'padded',
        padding: 4,
        prefix: '',
        autoIncrement: true,
        startNumber: 1,
        incrementStep: 1,
      },
      '#8b5cf6'
    ),
  ],
};
