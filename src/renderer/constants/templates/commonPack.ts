/**
 * Common Template Pack
 *
 * Essential components for everyday file naming.
 */

import { ComponentTemplatePack, createTemplateComponent } from './templateTypes';

export const COMMON_TEMPLATE_PACK: ComponentTemplatePack = {
  id: 'common-pack',
  name: 'Common Pack',
  description: 'Essential components for everyday file naming',
  icon: '📦',
  components: [
    // Text Components
    createTemplateComponent('Prefix', 'text', '📝', {
      defaultValue: '',
      placeholder: 'Enter prefix...',
      maxLength: 50,
    }),
    createTemplateComponent('Suffix', 'text', '📝', {
      defaultValue: '',
      placeholder: 'Enter suffix...',
      maxLength: 50,
    }),
    createTemplateComponent('Notes', 'text', '📋', {
      defaultValue: '',
      placeholder: 'Add notes...',
      maxLength: 100,
    }),

    // Date Components
    createTemplateComponent(
      'Created Date',
      'date',
      '📅',
      {
        dateFormat: 'YYYYMMDD',
        dateSource: 'current',
      },
      '#10b981'
    ),
    createTemplateComponent(
      'Modified Date',
      'date',
      '📅',
      {
        dateFormat: 'YYYY-MM-DD',
        dateSource: 'file-modified',
      },
      '#10b981'
    ),

    // Number Components
    createTemplateComponent(
      'Counter',
      'number',
      '🔢',
      {
        numberFormat: 'padded',
        padding: 3,
        prefix: '',
        autoIncrement: true,
        startNumber: 1,
        incrementStep: 1,
      },
      '#8b5cf6'
    ),
    createTemplateComponent(
      'Version',
      'number',
      '🏷️',
      {
        numberFormat: 'plain',
        padding: 1,
        prefix: 'v',
        autoIncrement: false,
        startNumber: 1,
        incrementStep: 1,
      },
      '#8b5cf6'
    ),
  ],
};
