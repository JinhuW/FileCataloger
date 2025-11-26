/**
 * Business Template Pack
 *
 * Components for business documents and workflow.
 */

import { ComponentTemplatePack, createTemplateComponent } from './templateTypes';

export const BUSINESS_TEMPLATE_PACK: ComponentTemplatePack = {
  id: 'business-pack',
  name: 'Business Pack',
  description: 'Components for business documents and workflow',
  icon: '💼',
  components: [
    // Select Components
    createTemplateComponent(
      'Project',
      'select',
      '📁',
      {
        options: [
          { id: '1', label: 'Project Alpha', color: '#ef4444' },
          { id: '2', label: 'Project Beta', color: '#10b981' },
          { id: '3', label: 'Project Gamma', color: '#3b82f6' },
        ],
        allowInlineCreate: true,
        defaultOption: '1',
      },
      '#3b82f6'
    ),
    createTemplateComponent(
      'Client',
      'select',
      '👥',
      {
        options: [
          { id: '1', label: 'Client A', color: '#ef4444' },
          { id: '2', label: 'Client B', color: '#10b981' },
          { id: '3', label: 'Client C', color: '#8b5cf6' },
        ],
        allowInlineCreate: true,
      },
      '#3b82f6'
    ),
    createTemplateComponent(
      'Status',
      'select',
      '📊',
      {
        options: [
          { id: '1', label: 'Draft', color: '#6b7280' },
          { id: '2', label: 'Review', color: '#eab308' },
          { id: '3', label: 'Final', color: '#10b981' },
          { id: '4', label: 'Approved', color: '#3b82f6' },
        ],
        allowInlineCreate: false,
        defaultOption: '1',
      },
      '#3b82f6'
    ),
    createTemplateComponent(
      'Priority',
      'select',
      '🏷️',
      {
        options: [
          { id: '1', label: 'Low', color: '#6b7280' },
          { id: '2', label: 'Medium', color: '#eab308' },
          { id: '3', label: 'High', color: '#f97316' },
          { id: '4', label: 'Urgent', color: '#ef4444' },
        ],
        allowInlineCreate: false,
        defaultOption: '2',
      },
      '#3b82f6'
    ),

    // Date Components
    createTemplateComponent(
      'Invoice Date',
      'date',
      '📅',
      {
        dateFormat: 'YYYY-MM-DD',
        dateSource: 'current',
      },
      '#10b981'
    ),
    createTemplateComponent(
      'Due Date',
      'date',
      '⏰',
      {
        dateFormat: 'YYYY-MM-DD',
        dateSource: 'custom',
      },
      '#10b981'
    ),

    // Number Components
    createTemplateComponent(
      'Invoice Number',
      'number',
      '🔢',
      {
        numberFormat: 'padded',
        padding: 4,
        prefix: 'INV',
        autoIncrement: true,
        startNumber: 1000,
        incrementStep: 1,
      },
      '#8b5cf6'
    ),
    createTemplateComponent(
      'Order Number',
      'number',
      '🔢',
      {
        numberFormat: 'padded',
        padding: 4,
        prefix: 'ORD',
        autoIncrement: true,
        startNumber: 1,
        incrementStep: 1,
      },
      '#8b5cf6'
    ),

    // Text Components
    createTemplateComponent('Department', 'text', '🏢', {
      defaultValue: '',
      placeholder: 'Department name...',
      maxLength: 50,
    }),
    createTemplateComponent('Category', 'text', '📂', {
      defaultValue: '',
      placeholder: 'Category...',
      maxLength: 50,
    }),
  ],
};
