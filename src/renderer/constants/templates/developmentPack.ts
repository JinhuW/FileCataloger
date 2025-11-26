/**
 * Development Template Pack
 *
 * Components for software development and versioning.
 */

import { ComponentTemplatePack, createTemplateComponent } from './templateTypes';

export const DEVELOPMENT_TEMPLATE_PACK: ComponentTemplatePack = {
  id: 'development-pack',
  name: 'Development Pack',
  description: 'Components for software development and versioning',
  icon: '💻',
  components: [
    // Select Components
    createTemplateComponent(
      'Environment',
      'select',
      '🌍',
      {
        options: [
          { id: '1', label: 'Development', color: '#6b7280' },
          { id: '2', label: 'Staging', color: '#eab308' },
          { id: '3', label: 'Production', color: '#10b981' },
        ],
        allowInlineCreate: false,
        defaultOption: '1',
      },
      '#3b82f6'
    ),
    createTemplateComponent(
      'Build Type',
      'select',
      '🔧',
      {
        options: [
          { id: '1', label: 'Debug', color: '#6b7280' },
          { id: '2', label: 'Release', color: '#10b981' },
        ],
        allowInlineCreate: false,
        defaultOption: '1',
      },
      '#3b82f6'
    ),
    createTemplateComponent(
      'Branch',
      'select',
      '🌿',
      {
        options: [
          { id: '1', label: 'main', color: '#10b981' },
          { id: '2', label: 'develop', color: '#3b82f6' },
          { id: '3', label: 'feature', color: '#8b5cf6' },
          { id: '4', label: 'hotfix', color: '#ef4444' },
        ],
        allowInlineCreate: true,
        defaultOption: '2',
      },
      '#3b82f6'
    ),

    // Date Components
    createTemplateComponent(
      'Build Date',
      'date',
      '📅',
      {
        dateFormat: 'YYYYMMDD',
        dateSource: 'current',
      },
      '#10b981'
    ),
    createTemplateComponent(
      'Release Date',
      'date',
      '🚀',
      {
        dateFormat: 'YYYY-MM-DD',
        dateSource: 'current',
      },
      '#10b981'
    ),

    // Text Components
    createTemplateComponent('Version Tag', 'text', '🏷️', {
      defaultValue: '',
      placeholder: 'v1.0.0',
      maxLength: 20,
    }),
    createTemplateComponent('Commit Hash', 'text', '🔑', {
      defaultValue: '',
      placeholder: 'Short commit hash...',
      maxLength: 10,
    }),

    // Number Components
    createTemplateComponent(
      'Build Number',
      'number',
      '🔢',
      {
        numberFormat: 'plain',
        padding: 1,
        prefix: 'build-',
        autoIncrement: true,
        startNumber: 1,
        incrementStep: 1,
      },
      '#8b5cf6'
    ),
    createTemplateComponent(
      'Patch Version',
      'number',
      '🔢',
      {
        numberFormat: 'plain',
        padding: 1,
        prefix: '',
        autoIncrement: false,
        startNumber: 0,
        incrementStep: 1,
      },
      '#8b5cf6'
    ),
  ],
};
