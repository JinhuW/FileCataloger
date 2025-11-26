/**
 * Template Packs Index
 *
 * Re-exports all template packs and helper functions.
 */

export type { ComponentTemplatePack } from './templateTypes';
export { createTemplateComponent } from './templateTypes';

export { COMMON_TEMPLATE_PACK } from './commonPack';
export { BUSINESS_TEMPLATE_PACK } from './businessPack';
export { CREATIVE_TEMPLATE_PACK } from './creativePack';
export { DEVELOPMENT_TEMPLATE_PACK } from './developmentPack';

import type { ComponentDefinition } from '@shared/types/componentDefinition';
import type { ComponentTemplatePack } from './templateTypes';
import { COMMON_TEMPLATE_PACK } from './commonPack';
import { BUSINESS_TEMPLATE_PACK } from './businessPack';
import { CREATIVE_TEMPLATE_PACK } from './creativePack';
import { DEVELOPMENT_TEMPLATE_PACK } from './developmentPack';

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
