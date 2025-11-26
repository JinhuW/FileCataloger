/**
 * Template Pack Types and Helper Functions
 */

import { v4 as uuidv4 } from 'uuid';
import type { ComponentDefinition } from '@shared/types/componentDefinition';

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

export function createTemplateComponent(
  name: string,
  type: ComponentDefinition['type'],
  icon: string,
  config: ComponentDefinition['config'],
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
