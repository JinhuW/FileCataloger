/**
 * Component Template Definitions
 *
 * Re-exports all template packs and helper functions from modular files.
 * This file maintains backward compatibility for existing imports.
 */

// Types and helper
export type { ComponentTemplatePack } from './templates';
export { createTemplateComponent } from './templates';

// Template packs
export { COMMON_TEMPLATE_PACK } from './templates';
export { BUSINESS_TEMPLATE_PACK } from './templates';
export { CREATIVE_TEMPLATE_PACK } from './templates';
export { DEVELOPMENT_TEMPLATE_PACK } from './templates';

// Registry and helpers
export {
  TEMPLATE_PACKS,
  getTemplatePack,
  getAllTemplatePacks,
  getTemplatePackComponents,
  searchTemplatePacks,
  getTotalTemplateComponentCount,
} from './templates';
