import { NamingPlugin } from '@shared/types/plugins';
import { datePlugin } from './datePlugin';
import { filenamePlugin } from './filenamePlugin';
import { counterPlugin } from './counterPlugin';

// Export all built-in plugins with TypeScript function support
export const builtinPlugins: NamingPlugin[] = [datePlugin, filenamePlugin, counterPlugin];

// Plugin registry mapping for quick access
export const builtinPluginMap = new Map<string, NamingPlugin>(
  builtinPlugins.map(plugin => [plugin.id, plugin])
);

// Helper function to get a built-in plugin by type (for backward compatibility)
export function getBuiltinPluginByType(type: string): NamingPlugin | undefined {
  switch (type) {
    case 'date':
      return datePlugin;
    case 'fileName':
      return filenamePlugin;
    case 'counter':
      return counterPlugin;
    default:
      return undefined;
  }
}

// Helper function to check if a plugin is built-in
export function isBuiltinPlugin(pluginId: string): boolean {
  return builtinPluginMap.has(pluginId);
}

// Get all available component types for UI (unlimited file type support)
export function getAvailableComponentTypes(): Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  supportedFileTypes: string; // "ALL" - no file type restrictions
}> {
  return builtinPlugins.map(plugin => ({
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    category: plugin.category || 'general',
    icon: plugin.icon,
    supportedFileTypes: 'ALL', // No file type limitations
  }));
}
