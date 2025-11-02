/**
 * Component Templates Hook
 *
 * Hook for accessing and importing component templates.
 */

import { useCallback } from 'react';
import { useComponentLibraryStore } from '../stores/componentLibraryStore';
import {
  TEMPLATE_PACKS,
  getTemplatePack,
  getAllTemplatePacks,
  searchTemplatePacks,
  getTotalTemplateComponentCount,
} from '../constants/componentTemplates';
import { logger } from '@shared/logger';

export function useComponentTemplates() {
  const store = useComponentLibraryStore();

  // Import template component
  const importTemplate = useCallback(
    (templateId: string) => {
      const allComponents = store.getAllComponents();

      // Find template in all packs
      for (const pack of TEMPLATE_PACKS) {
        const template = pack.components.find(c => c.id === templateId);
        if (template) {
          // Check if already imported (by name)
          const exists = allComponents.find(c => c.name === template.name);
          if (exists) {
            logger.warn('Template already imported:', template.name);
            return { success: false, error: 'Component with this name already exists' };
          }

          // Import template
          store.addComponent(template);
          logger.debug('Template imported:', template.name);
          return { success: true, componentId: template.id };
        }
      }

      return { success: false, error: 'Template not found' };
    },
    [store]
  );

  // Import all templates from a pack
  const importTemplatePack = useCallback(
    (packId: string, selectedIds?: string[]) => {
      const pack = getTemplatePack(packId);
      if (!pack) {
        return { success: false, error: 'Template pack not found', imported: 0 };
      }

      const allComponents = store.getAllComponents();
      const componentsToImport = selectedIds
        ? pack.components.filter(c => selectedIds.includes(c.id))
        : pack.components;

      let imported = 0;
      const errors: string[] = [];

      for (const template of componentsToImport) {
        // Check if already exists
        const exists = allComponents.find(c => c.name === template.name);
        if (exists) {
          errors.push(`${template.name} already exists`);
          continue;
        }

        store.addComponent(template);
        imported++;
      }

      logger.debug('Template pack imported:', { packId, imported, errors: errors.length });

      return {
        success: imported > 0,
        imported,
        total: componentsToImport.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    },
    [store]
  );

  return {
    // Template packs
    templatePacks: getAllTemplatePacks(),
    getTemplatePack: getTemplatePack,
    searchTemplatePacks: searchTemplatePacks,
    totalTemplateCount: getTotalTemplateComponentCount(),

    // Actions
    importTemplate,
    importTemplatePack,
  };
}
