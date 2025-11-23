/**
 * Component Template Definitions
 *
 * Pre-built component templates organized in packs.
 * Users can import these templates to quickly set up common components.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ComponentDefinition } from '../../shared/types/componentDefinition';

// ============================================================================
// Template Pack Interface
// ============================================================================

export interface ComponentTemplatePack {
  id: string;
  name: string;
  description: string;
  icon: string;
  components: ComponentDefinition[];
}

// ============================================================================
// Helper Function to Create Template Component
// ============================================================================

function createTemplateComponent(
  name: string,
  type: ComponentDefinition['type'],
  icon: string,
  config: any,
  color?: string
): ComponentDefinition {
  const now = Date.now();
  return {
    id: uuidv4(),
    name,
    type,
    icon,
    color,
    scope: 'global',
    config,
    metadata: {
      createdAt: now,
      updatedAt: now,
      usageCount: 0,
      isTemplate: true,
      favorite: false,
    },
  };
}

// ============================================================================
// Common Template Pack
// ============================================================================

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

// ============================================================================
// Business Template Pack
// ============================================================================

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

// ============================================================================
// Creative Template Pack
// ============================================================================

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

// ============================================================================
// Development Template Pack
// ============================================================================

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

// ============================================================================
// Template Pack Registry
// ============================================================================

export const TEMPLATE_PACKS: ComponentTemplatePack[] = [
  COMMON_TEMPLATE_PACK,
  BUSINESS_TEMPLATE_PACK,
  CREATIVE_TEMPLATE_PACK,
  DEVELOPMENT_TEMPLATE_PACK,
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get template pack by ID
 */
export function getTemplatePack(id: string): ComponentTemplatePack | undefined {
  return TEMPLATE_PACKS.find(pack => pack.id === id);
}

/**
 * Get all template packs
 */
export function getAllTemplatePacks(): ComponentTemplatePack[] {
  return TEMPLATE_PACKS;
}

/**
 * Get components from a template pack
 */
export function getTemplatePackComponents(packId: string): ComponentDefinition[] {
  const pack = getTemplatePack(packId);
  return pack ? pack.components : [];
}

/**
 * Search template packs by query
 */
export function searchTemplatePacks(query: string): ComponentTemplatePack[] {
  const lowerQuery = query.toLowerCase();
  return TEMPLATE_PACKS.filter(
    pack =>
      pack.name.toLowerCase().includes(lowerQuery) ||
      pack.description.toLowerCase().includes(lowerQuery) ||
      pack.components.some(comp => comp.name.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get total component count across all template packs
 */
export function getTotalTemplateComponentCount(): number {
  return TEMPLATE_PACKS.reduce((total, pack) => total + pack.components.length, 0);
}
