/**
 * @file ComponentPluginBridge.ts
 * @description Bridge system for gradually migrating from hardcoded components to plugin-based architecture
 * Provides backward compatibility while enabling plugin extensibility
 */

import { RenameComponent, ShelfItem } from '@shared/types';
import {
  NamingPlugin,
  PluginContext,
  PluginFileInfo,
  PluginRuntime,
  ComponentDefinition,
  PluginAuthor,
  PluginEngine,
} from '@shared/types/plugins';
import { logger } from '@shared/logger';

export interface LegacyComponentHandler {
  type: RenameComponent['type'];
  render: (component: RenameComponent, context: ComponentExecutionContext) => string;
  preview: (component: RenameComponent) => string;
  validate: (component: RenameComponent) => boolean;
}

export interface ComponentExecutionContext {
  file: {
    name: string;
    path?: string;
    type?: string;
    extension?: string;
  };
  runtime: {
    index: number;
    total: number;
    timestamp: number;
  };
}

export interface PluginComponentDescriptor {
  id: string;
  type: RenameComponent['type'];
  name: string;
  icon: string;
  description: string;
  isBuiltIn: boolean;
  pluginSource?: string; // Plugin ID if this comes from a plugin
}

/**
 * Bridge class that provides a unified interface for both legacy hardcoded components
 * and new plugin-based components, enabling gradual migration
 */
export class ComponentPluginBridge {
  private legacyHandlers = new Map<string, LegacyComponentHandler>();
  private pluginComponents = new Map<string, NamingPlugin>();
  private componentDescriptors = new Map<string, PluginComponentDescriptor>();

  constructor() {
    this.initializeLegacyHandlers();
    logger.info('ComponentPluginBridge initialized');
  }

  /**
   * Initialize legacy component handlers for backward compatibility
   */
  private initializeLegacyHandlers(): void {
    // Date component handler
    this.legacyHandlers.set('date', {
      type: 'date',
      render: (component, context) => {
        const format = component.format || 'YYYYMMDD';
        const date = new Date(context.runtime.timestamp);
        return this.formatDate(date, format);
      },
      preview: component => {
        const format = component.format || 'YYYYMMDD';
        return this.formatDate(new Date(), format);
      },
      validate: component => {
        const validFormats = [
          'YYYYMMDD',
          'YYYY-MM-DD',
          'DD-MM-YYYY',
          'MM-DD-YYYY',
          'YYYYMM',
          'YYYY-MM',
        ];
        return !component.format || validFormats.includes(component.format);
      },
    });

    // File name component handler
    this.legacyHandlers.set('fileName', {
      type: 'fileName',
      render: (component, context) => {
        return context.file.name || component.value || 'filename';
      },
      preview: component => {
        return component.value || 'filename';
      },
      validate: () => true,
    });

    // Counter component handler
    this.legacyHandlers.set('counter', {
      type: 'counter',
      render: (component, context) => {
        const digits = component.format === '001' ? 3 : component.format === '01' ? 2 : 1;
        return String(context.runtime.index + 1).padStart(digits, '0');
      },
      preview: component => {
        const digits = component.format === '001' ? 3 : component.format === '01' ? 2 : 1;
        return '1'.padStart(digits, '0');
      },
      validate: component => {
        const validFormats = ['1', '01', '001', '0001'];
        return !component.format || validFormats.includes(component.format);
      },
    });

    // Text component handler
    this.legacyHandlers.set('text', {
      type: 'text',
      render: component => {
        return component.value || 'text';
      },
      preview: component => {
        return component.value || 'text';
      },
      validate: component => {
        return Boolean(component.value && component.value.trim());
      },
    });

    // Project component handler
    this.legacyHandlers.set('project', {
      type: 'project',
      render: component => {
        return component.value || 'project';
      },
      preview: component => {
        return component.value || 'project';
      },
      validate: component => {
        return Boolean(component.value && component.value.trim());
      },
    });

    // Register component descriptors for UI
    this.registerComponentDescriptor({
      id: 'builtin-date',
      type: 'date',
      name: 'Date',
      icon: '📅',
      description: 'Current date in various formats',
      isBuiltIn: true,
    });

    this.registerComponentDescriptor({
      id: 'builtin-filename',
      type: 'fileName',
      name: 'File Name',
      icon: '📄',
      description: 'Original file name without extension',
      isBuiltIn: true,
    });

    this.registerComponentDescriptor({
      id: 'builtin-counter',
      type: 'counter',
      name: 'Counter',
      icon: '🔢',
      description: 'Sequential numbering (001, 002, etc.)',
      isBuiltIn: true,
    });

    this.registerComponentDescriptor({
      id: 'builtin-text',
      type: 'text',
      name: 'Text',
      icon: '💬',
      description: 'Custom text input',
      isBuiltIn: true,
    });

    this.registerComponentDescriptor({
      id: 'builtin-project',
      type: 'project',
      name: 'Project',
      icon: '📁',
      description: 'Project name identifier',
      isBuiltIn: true,
    });
  }

  /**
   * Register a plugin component
   */
  registerPluginComponent(plugin: NamingPlugin): void {
    this.pluginComponents.set(plugin.id, plugin);

    // Register component descriptor for UI
    this.registerComponentDescriptor({
      id: plugin.id,
      type: 'text', // Default type for plugin components
      name: plugin.name,
      icon: plugin.icon || '🔌',
      description: plugin.description,
      isBuiltIn: false,
      pluginSource: plugin.id,
    });

    logger.info('Plugin component registered', { pluginId: plugin.id, name: plugin.name });
  }

  /**
   * Unregister a plugin component
   */
  unregisterPluginComponent(pluginId: string): void {
    this.pluginComponents.delete(pluginId);
    this.componentDescriptors.delete(pluginId);
    logger.info('Plugin component unregistered', { pluginId });
  }

  /**
   * Get all available component descriptors for UI
   */
  getAvailableComponents(): PluginComponentDescriptor[] {
    return Array.from(this.componentDescriptors.values());
  }

  /**
   * Get built-in component descriptors only
   */
  getBuiltInComponents(): PluginComponentDescriptor[] {
    return Array.from(this.componentDescriptors.values()).filter(desc => desc.isBuiltIn);
  }

  /**
   * Get plugin component descriptors only
   */
  getPluginComponents(): PluginComponentDescriptor[] {
    return Array.from(this.componentDescriptors.values()).filter(desc => !desc.isBuiltIn);
  }

  /**
   * Execute a component (legacy or plugin-based)
   */
  async executeComponent(
    component: RenameComponent,
    context: ComponentExecutionContext
  ): Promise<string> {
    try {
      // Try legacy handler first for backward compatibility
      const legacyHandler = this.legacyHandlers.get(component.type);
      if (legacyHandler) {
        return legacyHandler.render(component, context);
      }

      // Try plugin component
      const pluginComponent = this.pluginComponents.get(component.id || component.type);
      if (pluginComponent) {
        const pluginContext = this.createPluginContext(component, context);
        return await pluginComponent.component.render(pluginContext);
      }

      throw new Error(`Unknown component type: ${component.type}`);
    } catch (error) {
      logger.error('Component execution failed', { component, error });
      return `[Error: ${component.type}]`;
    }
  }

  /**
   * Execute multiple components in a pattern
   */
  async executePattern(
    components: RenameComponent[],
    files: ShelfItem[],
    separator: string = '_'
  ): Promise<string[]> {
    const results: string[] = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      const componentResults: string[] = [];

      for (const component of components) {
        const context: ComponentExecutionContext = {
          file: {
            name: file.name,
            path: file.path,
            type: file.type,
            extension: this.getFileExtension(file.name),
          },
          runtime: {
            index: fileIndex,
            total: files.length,
            timestamp: Date.now(),
          },
        };

        const result = await this.executeComponent(component, context);
        componentResults.push(result);
      }

      results.push(componentResults.join(separator));
    }

    return results;
  }

  /**
   * Preview a component's output
   */
  previewComponent(component: RenameComponent): string {
    try {
      // Try legacy handler first
      const legacyHandler = this.legacyHandlers.get(component.type);
      if (legacyHandler) {
        return legacyHandler.preview(component);
      }

      // Try plugin component preview
      const pluginComponent = this.pluginComponents.get(component.id || component.type);
      if (pluginComponent?.component.preview) {
        return pluginComponent.component.preview(component, {} as any); // Mock utils for preview
      }

      return `[${component.type}]`;
    } catch (error) {
      logger.error('Component preview failed', { component, error });
      return `[Error: ${component.type}]`;
    }
  }

  /**
   * Validate a component's configuration
   */
  validateComponent(component: RenameComponent): boolean {
    try {
      // Try legacy handler first
      const legacyHandler = this.legacyHandlers.get(component.type);
      if (legacyHandler) {
        return legacyHandler.validate(component);
      }

      // Try plugin component validation
      const pluginComponent = this.pluginComponents.get(component.id || component.type);
      if (pluginComponent?.component.validate) {
        const result = pluginComponent.component.validate(component);
        return typeof result === 'boolean' ? result : result.valid;
      }

      return true; // Default to valid if no validation available
    } catch (error) {
      logger.error('Component validation failed', { component, error });
      return false;
    }
  }

  /**
   * Create a plugin context from legacy component context
   */
  private createPluginContext(
    component: RenameComponent,
    context: ComponentExecutionContext
  ): PluginContext {
    const pluginFileInfo: PluginFileInfo = {
      path: context.file.path || '',
      name: context.file.name,
      nameWithoutExtension: this.getNameWithoutExtension(context.file.name),
      extension: context.file.extension || '',
      size: 0, // Not available in legacy context
      type: context.file.type || 'file',
      created: Date.now(),
      modified: Date.now(),
      accessed: Date.now(),
      isDirectory: false,
      isHidden: false,
    };

    const pluginRuntime: PluginRuntime = {
      index: context.runtime.index,
      total: context.runtime.total,
      timestamp: context.runtime.timestamp,
      locale: 'en-US',
      platform: process.platform,
      isDarkMode: false,
      appVersion: '2.0.0',
      pluginVersion: '1.0.0',
    };

    return {
      file: pluginFileInfo,
      config: component,
      utils: {} as any, // TODO: Implement plugin utilities
      runtime: pluginRuntime,
      storage: {} as any, // TODO: Implement plugin storage
      events: {} as any, // TODO: Implement plugin events
      logger: logger as any, // TODO: Implement plugin logger
    };
  }

  /**
   * Register a component descriptor
   */
  private registerComponentDescriptor(descriptor: PluginComponentDescriptor): void {
    this.componentDescriptors.set(descriptor.id, descriptor);
  }

  /**
   * Format date according to specified format
   */
  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (format) {
      case 'YYYYMMDD':
        return `${year}${month}${day}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      case 'MM-DD-YYYY':
        return `${month}-${day}-${year}`;
      case 'YYYYMM':
        return `${year}${month}`;
      case 'YYYY-MM':
        return `${year}-${month}`;
      default:
        return `${year}${month}${day}`;
    }
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot + 1) : '';
  }

  /**
   * Get filename without extension
   */
  private getNameWithoutExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(0, lastDot) : filename;
  }

  /**
   * Convert legacy component to plugin-compatible format (for migration)
   */
  convertLegacyComponentToPlugin(component: RenameComponent): NamingPlugin | null {
    const legacyHandler = this.legacyHandlers.get(component.type);
    if (!legacyHandler) {
      return null;
    }

    const pluginId = `builtin-${component.type}`;
    const componentDef: ComponentDefinition = {
      render: async (context: PluginContext) => {
        const legacyContext: ComponentExecutionContext = {
          file: {
            name: context.file.name,
            path: context.file.path,
            type: context.file.type,
            extension: context.file.extension,
          },
          runtime: {
            index: context.runtime.index,
            total: context.runtime.total,
            timestamp: context.runtime.timestamp,
          },
        };
        return legacyHandler.render(component, legacyContext);
      },
      preview: config => legacyHandler.preview(config as RenameComponent),
      validate: config => ({
        valid: legacyHandler.validate(config as RenameComponent),
        errors: [],
      }),
    };

    const author: PluginAuthor = {
      name: 'FileCataloger Team',
      email: 'support@filecataloger.com',
    };

    const engine: PluginEngine = {
      filecataloger: '>=2.0.0',
    };

    return {
      id: pluginId,
      name: `Built-in ${component.type} Component`,
      version: '1.0.0',
      author,
      description: `Legacy ${component.type} component converted to plugin format`,
      type: 'component',
      engine,
      capabilities: [],
      permissions: [],
      component: componentDef,
    };
  }

  /**
   * Check if a component type is available
   */
  isComponentAvailable(type: string): boolean {
    return (
      this.legacyHandlers.has(type) ||
      Array.from(this.pluginComponents.values()).some(plugin => plugin.id === type)
    );
  }

  /**
   * Get component descriptor by type or ID
   */
  getComponentDescriptor(typeOrId: string): PluginComponentDescriptor | undefined {
    // Try by ID first
    const byId = this.componentDescriptors.get(typeOrId);
    if (byId) return byId;

    // Try by type for built-in components
    return Array.from(this.componentDescriptors.values()).find(
      desc => desc.type === typeOrId && desc.isBuiltIn
    );
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.legacyHandlers.clear();
    this.pluginComponents.clear();
    this.componentDescriptors.clear();
    logger.info('ComponentPluginBridge destroyed');
  }
}
