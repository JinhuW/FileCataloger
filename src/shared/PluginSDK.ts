/**
 * @file PluginSDK.ts
 * @description Software Development Kit for creating FileCataloger plugins
 * Provides utilities, helpers, and templates for plugin development
 */

import {
  NamingPlugin,
  PluginAuthor,
  PluginEngine,
  PluginCapability,
  ComponentDefinition,
  PluginContext,
  PluginValidationResult,
} from '@shared/types/plugins';
import { JSONSchema7 } from 'json-schema';

export interface PluginBuilderOptions {
  id: string;
  name: string;
  version: string;
  author: PluginAuthor;
  description: string;
  icon?: string;
  category?: string;
  tags?: string[];
  capabilities?: PluginCapability[];
  permissions?: PluginCapability[];
  configSchema?: JSONSchema7;
  defaultConfig?: Record<string, any>;
}

export interface ComponentBuilderOptions {
  render: (context: PluginContext) => Promise<string> | string;
  preview?: (config: Record<string, any>, utils: any) => string;
  validate?: (config: Record<string, any>) => PluginValidationResult | boolean;
  setup?: (config: Record<string, any>) => Promise<void> | void;
  cleanup?: (config: Record<string, any>) => Promise<void> | void;
}

/**
 * Plugin SDK - Main entry point for plugin development
 */
export class PluginSDK {
  /**
   * Create a new naming plugin with validation and best practices
   */
  static createPlugin(
    options: PluginBuilderOptions,
    component: ComponentBuilderOptions
  ): NamingPlugin {
    // Validate required fields
    this.validatePluginOptions(options);
    this.validateComponentOptions(component);

    // Default engine requirements
    const engine: PluginEngine = {
      filecataloger: '>=2.0.0',
      node: '>=16.0.0',
      electron: '>=28.0.0',
    };

    // Build component definition
    const componentDef: ComponentDefinition = {
      render: component.render,
      preview: component.preview,
      validate: config => {
        if (!component.validate) {
          return { valid: true, errors: [], warnings: [] };
        }

        const result = component.validate(config);
        return typeof result === 'boolean'
          ? { valid: result, errors: result ? [] : ['Validation failed'], warnings: [] }
          : result;
      },
      setup: component.setup,
      cleanup: component.cleanup,
    };

    return {
      id: options.id,
      name: options.name,
      version: options.version,
      author: options.author,
      description: options.description,
      icon: options.icon,
      category: options.category,
      tags: options.tags,
      type: 'component',
      engine,
      capabilities: options.capabilities || [],
      permissions: options.permissions || [],
      component: componentDef,
      configSchema: options.configSchema,
      defaultConfig: options.defaultConfig,
    };
  }

  /**
   * Create a simple text transformation plugin
   */
  static createTextTransformPlugin(
    id: string,
    name: string,
    description: string,
    transform: (text: string, config: any) => string
  ): NamingPlugin {
    return this.createPlugin(
      {
        id,
        name,
        version: '1.0.0',
        author: { name: 'Plugin Developer' },
        description,
        category: 'text-transform',
        tags: ['text', 'transform'],
        configSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              title: 'Text Input',
              description: 'The text to transform',
            },
          },
          required: ['text'],
        } as JSONSchema7,
        defaultConfig: { text: 'sample' },
      },
      {
        render: async context => {
          const text = context.config.text || '';
          return transform(text, context.config);
        },
        preview: config => {
          const text = config.text || 'sample';
          return transform(text, config);
        },
        validate: config => ({
          valid: Boolean(config.text),
          errors: config.text ? [] : ['Text is required'],
          warnings: [],
        }),
      }
    );
  }

  /**
   * Create a date formatting plugin
   */
  static createDatePlugin(
    id: string,
    name: string,
    description: string,
    formatFn: (date: Date, format: string) => string,
    supportedFormats: string[]
  ): NamingPlugin {
    return this.createPlugin(
      {
        id,
        name,
        version: '1.0.0',
        author: { name: 'Plugin Developer' },
        description,
        category: 'date-time',
        tags: ['date', 'time', 'format'],
        configSchema: {
          type: 'object',
          properties: {
            format: {
              type: 'string',
              enum: supportedFormats,
              title: 'Date Format',
              description: 'Format pattern for date output',
            },
          },
        } as JSONSchema7,
        defaultConfig: { format: supportedFormats[0] },
      },
      {
        render: async context => {
          const format = context.config.format || supportedFormats[0];
          const date = new Date(context.runtime.timestamp);
          return formatFn(date, format);
        },
        preview: config => {
          const format = config.format || supportedFormats[0];
          return formatFn(new Date(), format);
        },
        validate: config => ({
          valid: !config.format || supportedFormats.includes(config.format),
          errors:
            config.format && !supportedFormats.includes(config.format)
              ? [`Unsupported format: ${config.format}`]
              : [],
          warnings: [],
        }),
      }
    );
  }

  /**
   * Create a file-based plugin
   */
  static createFilePlugin(
    id: string,
    name: string,
    description: string,
    handler: (file: any, config: any) => string
  ): NamingPlugin {
    return this.createPlugin(
      {
        id,
        name,
        version: '1.0.0',
        author: { name: 'Plugin Developer' },
        description,
        category: 'file-info',
        tags: ['file', 'metadata'],
        capabilities: [PluginCapability.FILE_SYSTEM_READ],
        permissions: [PluginCapability.FILE_SYSTEM_READ],
      },
      {
        render: async context => {
          return handler(context.file, context.config);
        },
        preview: config => {
          const mockFile = {
            name: 'example.txt',
            path: '/path/to/example.txt',
            size: 1024,
            extension: 'txt',
          };
          return handler(mockFile, config);
        },
      }
    );
  }

  /**
   * Validate plugin options
   */
  private static validatePluginOptions(options: PluginBuilderOptions): void {
    const errors: string[] = [];

    if (!options.id) errors.push('Plugin ID is required');
    if (!options.name) errors.push('Plugin name is required');
    if (!options.version) errors.push('Plugin version is required');
    if (!options.author?.name) errors.push('Plugin author name is required');
    if (!options.description) errors.push('Plugin description is required');

    if (options.id && !/^[a-z0-9-_]+$/.test(options.id)) {
      errors.push(
        'Plugin ID must contain only lowercase letters, numbers, hyphens, and underscores'
      );
    }

    if (options.version && !/^\d+\.\d+\.\d+/.test(options.version)) {
      errors.push('Plugin version should follow semantic versioning (x.y.z)');
    }

    if (errors.length > 0) {
      throw new Error(`Plugin validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Validate component options
   */
  private static validateComponentOptions(component: ComponentBuilderOptions): void {
    if (!component.render) {
      throw new Error('Component render function is required');
    }

    if (typeof component.render !== 'function') {
      throw new Error('Component render must be a function');
    }
  }
}

/**
 * Utility functions for common plugin development tasks
 */
export class PluginUtils {
  /**
   * Format date with common patterns
   */
  static formatDate(date: Date, pattern: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    const patterns: { [key: string]: string } = {
      YYYY: String(year),
      YY: String(year).slice(-2),
      MM: month,
      M: String(date.getMonth() + 1),
      DD: day,
      D: String(date.getDate()),
      HH: hours,
      H: String(date.getHours()),
      mm: minutes,
      m: String(date.getMinutes()),
      ss: seconds,
      s: String(date.getSeconds()),
    };

    return pattern.replace(/YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s/g, match => patterns[match] || match);
  }

  /**
   * Text case transformations
   */
  static textTransforms = {
    camelCase: (text: string): string => {
      return text
        .replace(/[^a-zA-Z0-9]/g, ' ')
        .split(' ')
        .map((word, index) => {
          if (index === 0) return word.toLowerCase();
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join('');
    },

    pascalCase: (text: string): string => {
      return text
        .replace(/[^a-zA-Z0-9]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    },

    kebabCase: (text: string): string => {
      return text
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    },

    snakeCase: (text: string): string => {
      return text
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();
    },

    titleCase: (text: string): string => {
      return text
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    },

    slugify: (text: string): string => {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s-]+/g, '-');
    },
  };

  /**
   * File name utilities
   */
  static fileUtils = {
    getExtension: (filename: string): string => {
      const lastDot = filename.lastIndexOf('.');
      return lastDot > 0 ? filename.substring(lastDot + 1) : '';
    },

    getBasename: (filename: string): string => {
      const lastDot = filename.lastIndexOf('.');
      return lastDot > 0 ? filename.substring(0, lastDot) : filename;
    },

    sanitizeFilename: (filename: string): string => {
      // Remove or replace invalid characters for file names
      const invalidChars = '<>:"/\\|?*';
      let result = '';

      for (let i = 0; i < filename.length; i++) {
        const char = filename[i];
        const charCode = char.charCodeAt(0);

        if (invalidChars.includes(char)) {
          result += '_';
        } else if (charCode >= 0 && charCode <= 31) {
          // Skip control characters
          continue;
        } else if (charCode >= 128 && charCode <= 159) {
          // Skip extended control characters
          continue;
        } else {
          result += char;
        }
      }

      return result.replace(/^[.\s]+|[.\s]+$/g, '').substring(0, 255);
    },

    isValidFilename: (filename: string): boolean => {
      const invalidChars = '<>:"/\\|?*';
      const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;

      // Check for invalid characters
      for (let i = 0; i < filename.length; i++) {
        const char = filename[i];
        const charCode = char.charCodeAt(0);

        if (invalidChars.includes(char)) return false;
        if (charCode >= 0 && charCode <= 31) return false;
        if (charCode >= 128 && charCode <= 159) return false;
      }

      return (
        filename.length > 0 &&
        filename.length <= 255 &&
        !reservedNames.test(filename) &&
        !filename.startsWith('.') &&
        !filename.endsWith('.')
      );
    },
  };

  /**
   * Number formatting utilities
   */
  static numberUtils = {
    padZero: (num: number, digits: number): string => {
      return String(num).padStart(digits, '0');
    },

    formatBytes: (bytes: number, decimals: number = 2): string => {
      if (bytes === 0) return '0 Bytes';

      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    formatDuration: (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    },
  };

  /**
   * Create a plugin template for quick development
   */
  static createTemplate(templateType: 'text' | 'date' | 'file' | 'custom'): string {
    const templates = {
      text: `
import { PluginSDK, PluginUtils } from '@shared/PluginSDK';

export default PluginSDK.createPlugin(
  {
    id: 'my-text-plugin',
    name: 'My Text Plugin',
    version: '1.0.0',
    author: { name: 'Your Name', email: 'your.email@example.com' },
    description: 'Custom text transformation plugin',
    category: 'text-transform',
    tags: ['text', 'custom'],
    configSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', title: 'Text Input' },
        transform: {
          type: 'string',
          enum: ['none', 'uppercase', 'lowercase', 'camelcase'],
          default: 'none',
        },
      },
      required: ['text'],
    },
    defaultConfig: { text: 'sample', transform: 'none' },
  },
  {
    render: async (context) => {
      const { text, transform } = context.config;
      
      switch (transform) {
        case 'uppercase':
          return text.toUpperCase();
        case 'lowercase':
          return text.toLowerCase();
        case 'camelcase':
          return PluginUtils.textTransforms.camelCase(text);
        default:
          return text;
      }
    },
    preview: (config) => {
      const { text = 'sample', transform = 'none' } = config;
      
      switch (transform) {
        case 'uppercase':
          return text.toUpperCase();
        case 'lowercase':
          return text.toLowerCase();
        case 'camelcase':
          return PluginUtils.textTransforms.camelCase(text);
        default:
          return text;
      }
    },
    validate: (config) => ({
      valid: Boolean(config.text),
      errors: config.text ? [] : ['Text is required'],
      warnings: [],
    }),
  }
);
      `,

      date: `
import { PluginSDK, PluginUtils } from '@shared/PluginSDK';

export default PluginSDK.createDatePlugin(
  'my-date-plugin',
  'My Date Plugin',
  'Custom date formatting plugin',
  (date, format) => PluginUtils.formatDate(date, format),
  ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM-DD-YYYY', 'YYYYMMDD']
);
      `,

      file: `
import { PluginSDK } from '@shared/PluginSDK';

export default PluginSDK.createFilePlugin(
  'my-file-plugin',
  'My File Plugin',
  'Custom file information plugin',
  (file, config) => {
    // Access file properties: file.name, file.path, file.size, etc.
    return file.name.toUpperCase();
  }
);
      `,

      custom: `
import { PluginSDK } from '@shared/PluginSDK';

export default PluginSDK.createPlugin(
  {
    id: 'my-custom-plugin',
    name: 'My Custom Plugin',
    version: '1.0.0',
    author: { name: 'Your Name' },
    description: 'A fully custom plugin',
    category: 'utility',
    capabilities: [], // Add required capabilities
    permissions: [], // Add required permissions
  },
  {
    render: async (context) => {
      // Your custom logic here
      return 'custom-output';
    },
    preview: (config) => {
      return 'preview';
    },
    validate: (config) => ({
      valid: true,
      errors: [],
      warnings: [],
    }),
  }
);
      `,
    };

    return templates[templateType];
  }

  /**
   * Validate plugin options
   */
  private static validatePluginOptions(options: PluginBuilderOptions): void {
    const errors: string[] = [];

    if (!options.id) errors.push('Plugin ID is required');
    if (!options.name) errors.push('Plugin name is required');
    if (!options.version) errors.push('Plugin version is required');
    if (!options.author?.name) errors.push('Plugin author name is required');
    if (!options.description) errors.push('Plugin description is required');

    if (options.id && !/^[a-z0-9-_]+$/.test(options.id)) {
      errors.push(
        'Plugin ID must contain only lowercase letters, numbers, hyphens, and underscores'
      );
    }

    if (errors.length > 0) {
      throw new Error(`Plugin options validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Validate component options
   */
  private static validateComponentOptions(component: ComponentBuilderOptions): void {
    if (!component.render) {
      throw new Error('Component render function is required');
    }

    if (typeof component.render !== 'function') {
      throw new Error('Component render must be a function');
    }
  }
}

// Export utility functions for direct use
// export { PluginUtils }; // Already declared above

// Export common plugin creation helpers
export const createPlugin = PluginSDK.createPlugin;
export const createTextTransformPlugin = PluginSDK.createTextTransformPlugin;
export const createDatePlugin = PluginSDK.createDatePlugin;
export const createFilePlugin = PluginSDK.createFilePlugin;
// export const createTemplate = PluginSDK.createTemplate; // Method doesn't exist

// Export validation helpers
export const validatePlugin = (plugin: NamingPlugin): PluginValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!plugin.id) errors.push('Plugin ID is required');
  if (!plugin.name) errors.push('Plugin name is required');
  if (!plugin.version) errors.push('Plugin version is required');
  if (!plugin.component?.render) errors.push('Component render function is required');

  // Advanced validation
  if (plugin.id && !/^[a-z0-9-_]+$/.test(plugin.id)) {
    errors.push('Plugin ID format is invalid');
  }

  if (plugin.version && !/^\d+\.\d+\.\d+/.test(plugin.version)) {
    warnings.push('Version should follow semantic versioning');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
