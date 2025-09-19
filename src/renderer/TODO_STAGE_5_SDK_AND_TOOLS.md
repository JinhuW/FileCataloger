# Stage 5: Developer SDK and Tools

**Timeline**: Week 6
**Priority**: HIGH
**Dependencies**: Stage 4 completion

## Overview
This stage creates the developer tools and SDK that enable third-party developers to create, test, and distribute plugins for FileCataloger. This includes the npm package, CLI tools, documentation, and example projects.

## Day 1: SDK Package Setup

### Package Structure
- [ ] **Initialize @filecataloger/plugin-sdk**
  ```bash
  mkdir packages/plugin-sdk
  cd packages/plugin-sdk
  npm init -y
  ```

- [ ] **Configure TypeScript**
  ```json
  // tsconfig.json
  {
    "compilerOptions": {
      "target": "ES2020",
      "module": "commonjs",
      "lib": ["ES2020"],
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "moduleResolution": "node"
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules", "dist", "**/*.test.ts"]
  }
  ```

- [ ] **Package.json Configuration**
  ```json
  {
    "name": "@filecataloger/plugin-sdk",
    "version": "1.0.0",
    "description": "SDK for creating FileCataloger plugins",
    "main": "dist/index.js",
    "types": "dist/index.d.ts",
    "files": ["dist", "README.md"],
    "scripts": {
      "build": "tsc",
      "test": "jest",
      "lint": "eslint src --ext .ts",
      "prepublishOnly": "npm run build && npm test"
    },
    "keywords": ["filecataloger", "plugin", "sdk", "naming"],
    "license": "MIT",
    "peerDependencies": {
      "react": ">=18.0.0",
      "react-dom": ">=18.0.0"
    },
    "devDependencies": {
      "@types/node": "^18.0.0",
      "typescript": "^5.0.0",
      "jest": "^29.0.0",
      "eslint": "^8.0.0"
    }
  }
  ```

### Core SDK Structure
- [ ] **Create Main Entry Point**
  ```typescript
  // src/index.ts

  // Core functions
  export { createPlugin } from './core/createPlugin';
  export { defineConfig } from './core/defineConfig';
  export { validatePlugin } from './core/validatePlugin';

  // Types
  export * from './types';

  // Utils
  export * from './utils';

  // UI Components
  export * from './ui';

  // Testing utilities
  export * from './testing';

  // Constants
  export * from './constants';
  ```

## Day 2: Core SDK Implementation

### Plugin Factory
- [ ] **Implement createPlugin Function**
  ```typescript
  // src/core/createPlugin.ts

  import { NamingPlugin, PluginOptions } from '../types';
  import { validatePluginStructure } from '../validation';

  export function createPlugin(options: PluginOptions): NamingPlugin {
    // Validate options
    const validation = validatePluginStructure(options);
    if (!validation.valid) {
      throw new Error(`Invalid plugin structure: ${validation.errors.join(', ')}`);
    }

    // Transform render functions to strings if needed
    const plugin: NamingPlugin = {
      id: options.id,
      name: options.name,
      version: options.version || '1.0.0',
      author: normalizeAuthor(options.author),
      description: options.description || '',
      type: 'component',
      engine: {
        filecataloger: options.engine?.filecataloger || '>=2.0.0',
        node: options.engine?.node,
        electron: options.engine?.electron
      },
      capabilities: options.capabilities || [],
      permissions: options.permissions || [],
      component: {
        render: functionToString(options.render),
        renderBatch: options.renderBatch ? functionToString(options.renderBatch) : undefined,
        preview: options.preview ? functionToString(options.preview) : undefined,
        validate: options.validate ? functionToString(options.validate) : undefined
      },
      configSchema: options.configSchema,
      defaultConfig: options.defaultConfig,
      lifecycle: options.lifecycle ? {
        onInstall: options.lifecycle.onInstall ? functionToString(options.lifecycle.onInstall) : undefined,
        onUninstall: options.lifecycle.onUninstall ? functionToString(options.lifecycle.onUninstall) : undefined,
        onActivate: options.lifecycle.onActivate ? functionToString(options.lifecycle.onActivate) : undefined,
        onDeactivate: options.lifecycle.onDeactivate ? functionToString(options.lifecycle.onDeactivate) : undefined
      } : undefined
    };

    // Add metadata
    plugin.metadata = {
      sdkVersion: SDK_VERSION,
      createdAt: Date.now()
    };

    return plugin;
  }

  function functionToString(fn: Function | string): string {
    if (typeof fn === 'string') return fn;

    // Convert function to string, preserving async
    const fnString = fn.toString();

    // Validate it's a valid function
    try {
      new Function(`return ${fnString}`);
    } catch (error) {
      throw new Error('Invalid function provided');
    }

    return fnString;
  }

  function normalizeAuthor(author: string | PluginAuthor): PluginAuthor {
    if (typeof author === 'string') {
      return { name: author };
    }
    return author;
  }
  ```

### Type Definitions
- [ ] **Export Core Types**
  ```typescript
  // src/types/index.ts

  export interface PluginOptions {
    id: string;
    name: string;
    version?: string;
    author: string | PluginAuthor;
    description?: string;
    icon?: string;
    homepage?: string;
    repository?: string;
    license?: string;

    // Technical
    engine?: PluginEngine;
    capabilities?: PluginCapability[];
    permissions?: PluginPermission[];
    dependencies?: PluginDependency[];

    // Component functions
    render: RenderFunction | string;
    renderBatch?: BatchRenderFunction | string;
    preview?: PreviewFunction | string;
    validate?: ValidateFunction | string;

    // Configuration
    configSchema?: JSONSchema7;
    defaultConfig?: Record<string, any>;
    configComponent?: React.ComponentType<ConfigComponentProps> | string;

    // Lifecycle
    lifecycle?: {
      onInstall?: () => Promise<void> | void;
      onUninstall?: () => Promise<void> | void;
      onActivate?: () => Promise<void> | void;
      onDeactivate?: () => Promise<void> | void;
    };
  }

  export type RenderFunction = (context: PluginContext) => string | Promise<string>;
  export type BatchRenderFunction = (contexts: PluginContext[]) => string[] | Promise<string[]>;
  export type PreviewFunction = (config: any) => string;
  export type ValidateFunction = (value: string, config: any) => boolean | string;

  // Re-export shared types
  export type {
    NamingPlugin,
    PluginContext,
    PluginCapability,
    PluginPermission,
    PluginFileInfo,
    PluginUtils
  } from '@filecataloger/shared';
  ```

### Utility Functions
- [ ] **Create Utility Exports**
  ```typescript
  // src/utils/index.ts

  export { formatters } from './formatters';
  export { stringUtils } from './stringUtils';
  export { dateUtils } from './dateUtils';
  export { fileUtils } from './fileUtils';
  export { validators } from './validators';

  // src/utils/formatters.ts
  export const formatters = {
    date: (date: Date | number, format: string): string => {
      // Implementation matching main app
    },

    number: (num: number, format: string): string => {
      // Implementation
    },

    bytes: (bytes: number, precision: number = 2): string => {
      const units = ['B', 'KB', 'MB', 'GB', 'TB'];
      let size = bytes;
      let unitIndex = 0;

      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }

      return `${size.toFixed(precision)} ${units[unitIndex]}`;
    }
  };
  ```

## Day 3: UI Component Library

### React Components
- [ ] **Create UI Components**
  ```typescript
  // src/ui/index.ts

  export { Form } from './components/Form';
  export { Input } from './components/Input';
  export { Select } from './components/Select';
  export { Checkbox } from './components/Checkbox';
  export { Radio } from './components/Radio';
  export { Button } from './components/Button';
  export { DatePicker } from './components/DatePicker';
  export { FilePicker } from './components/FilePicker';
  export { ColorPicker } from './components/ColorPicker';
  export { Slider } from './components/Slider';
  export { Toggle } from './components/Toggle';
  export { Textarea } from './components/Textarea';
  export { Tabs } from './components/Tabs';
  export { Accordion } from './components/Accordion';

  // Hooks
  export { usePluginConfig } from './hooks/usePluginConfig';
  export { usePluginStorage } from './hooks/usePluginStorage';
  export { usePluginLogger } from './hooks/usePluginLogger';
  ```

- [ ] **Implement Form Components**
  ```typescript
  // src/ui/components/Form/Form.tsx

  import React from 'react';
  import { FormProvider, useForm } from 'react-hook-form';
  import { zodResolver } from '@hookform/resolvers/zod';

  export interface FormProps {
    children: React.ReactNode;
    onSubmit: (data: any) => void;
    schema?: any; // Zod schema
    defaultValues?: Record<string, any>;
    className?: string;
  }

  export const Form: React.FC<FormProps> & {
    Field: typeof FormField;
    Label: typeof FormLabel;
    Error: typeof FormError;
    Submit: typeof FormSubmit;
  } = ({ children, onSubmit, schema, defaultValues, className }) => {
    const methods = useForm({
      resolver: schema ? zodResolver(schema) : undefined,
      defaultValues
    });

    return (
      <FormProvider {...methods}>
        <form
          onSubmit={methods.handleSubmit(onSubmit)}
          className={className}
        >
          {children}
        </form>
      </FormProvider>
    );
  };

  // Attach sub-components
  Form.Field = FormField;
  Form.Label = FormLabel;
  Form.Error = FormError;
  Form.Submit = FormSubmit;
  ```

### Component Hooks
- [ ] **Implement Plugin Hooks**
  ```typescript
  // src/ui/hooks/usePluginConfig.ts

  export function usePluginConfig<T = any>(): {
    config: T;
    updateConfig: (updates: Partial<T>) => void;
    resetConfig: () => void;
    errors: Record<string, string>;
  } {
    // Implementation that connects to parent window
    const [config, setConfig] = useState<T>({} as T);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
      // Listen for config updates from parent
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'config-update') {
          setConfig(event.data.config);
        }
        if (event.data.type === 'config-errors') {
          setErrors(event.data.errors);
        }
      };

      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, []);

    const updateConfig = useCallback((updates: Partial<T>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);

      // Send to parent
      window.parent.postMessage({
        type: 'config-change',
        config: newConfig
      }, '*');
    }, [config]);

    const resetConfig = useCallback(() => {
      window.parent.postMessage({ type: 'config-reset' }, '*');
    }, []);

    return { config, updateConfig, resetConfig, errors };
  }
  ```

## Day 4: CLI Tools

### CLI Package
- [ ] **Create @filecataloger/cli**
  ```typescript
  // packages/cli/src/index.ts

  #!/usr/bin/env node

  import { Command } from 'commander';
  import { version } from '../package.json';
  import { create } from './commands/create';
  import { test } from './commands/test';
  import { build } from './commands/build';
  import { publish } from './commands/publish';
  import { validate } from './commands/validate';

  const program = new Command();

  program
    .name('filecataloger')
    .description('CLI tools for FileCataloger plugin development')
    .version(version);

  program
    .command('create [name]')
    .description('Create a new plugin project')
    .option('-t, --template <template>', 'Use a specific template')
    .option('-l, --language <language>', 'TypeScript or JavaScript', 'typescript')
    .action(create);

  program
    .command('test [path]')
    .description('Test a plugin')
    .option('-w, --watch', 'Watch mode')
    .option('-c, --coverage', 'Generate coverage report')
    .action(test);

  program
    .command('build [path]')
    .description('Build a plugin for distribution')
    .option('-o, --output <path>', 'Output directory')
    .option('--no-minify', 'Skip minification')
    .action(build);

  program
    .command('validate [path]')
    .description('Validate a plugin')
    .option('--strict', 'Enable strict validation')
    .action(validate);

  program
    .command('publish [path]')
    .description('Publish plugin to registry')
    .option('--dry-run', 'Perform a dry run')
    .action(publish);

  program.parse(process.argv);
  ```

### Plugin Scaffolding
- [ ] **Implement Create Command**
  ```typescript
  // packages/cli/src/commands/create.ts

  import inquirer from 'inquirer';
  import { createProject } from '../utils/createProject';
  import { installDependencies } from '../utils/installDependencies';

  export async function create(name?: string, options?: CreateOptions) {
    // Prompt for missing information
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Plugin name:',
        default: name,
        when: !name,
        validate: validatePluginName
      },
      {
        type: 'input',
        name: 'description',
        message: 'Plugin description:'
      },
      {
        type: 'list',
        name: 'template',
        message: 'Choose a template:',
        choices: [
          { name: 'Basic Plugin', value: 'basic' },
          { name: 'Advanced Plugin with UI', value: 'advanced' },
          { name: 'Multi-component Plugin', value: 'multi' },
          { name: 'External API Plugin', value: 'api' }
        ],
        when: !options.template
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features:',
        choices: [
          { name: 'Custom UI Component', value: 'ui' },
          { name: 'Batch Processing', value: 'batch' },
          { name: 'File System Access', value: 'fs' },
          { name: 'Network Access', value: 'network' },
          { name: 'Database Storage', value: 'storage' }
        ]
      }
    ]);

    const projectPath = await createProject({
      ...options,
      ...answers
    });

    // Install dependencies
    console.log('Installing dependencies...');
    await installDependencies(projectPath);

    console.log(`
Plugin created successfully!

Next steps:
  cd ${answers.name || name}
  npm run dev

Happy plugin development! 🎉
    `);
  }
  ```

### Project Templates
- [ ] **Create Plugin Templates**
  ```typescript
  // packages/cli/templates/basic/src/index.ts

  import { createPlugin } from '@filecataloger/plugin-sdk';

  export default createPlugin({
    id: '{{pluginId}}',
    name: '{{pluginName}}',
    version: '1.0.0',
    author: {
      name: '{{authorName}}',
      email: '{{authorEmail}}'
    },
    description: '{{description}}',

    configSchema: {
      type: 'object',
      properties: {
        prefix: {
          type: 'string',
          default: '',
          description: 'Prefix to add before the value'
        }
      }
    },

    render: (context) => {
      const { file, config } = context;
      return config.prefix + file.nameWithoutExtension;
    }
  });
  ```

## Day 5: Testing and Documentation

### Testing Framework
- [ ] **Create Test Utilities**
  ```typescript
  // src/testing/index.ts

  export { createMockContext } from './mockContext';
  export { createMockFile } from './mockFile';
  export { PluginTestRunner } from './runner';
  export { expect } from './matchers';

  // src/testing/runner.ts
  export class PluginTestRunner {
    private plugin: NamingPlugin;

    constructor(plugin: NamingPlugin) {
      this.plugin = plugin;
    }

    async test(
      description: string,
      context: Partial<PluginContext>,
      expected: string | RegExp
    ): Promise<TestResult> {
      const fullContext = createMockContext(context);

      try {
        const result = await this.executePlugin(fullContext);

        if (typeof expected === 'string') {
          return {
            pass: result === expected,
            actual: result,
            expected
          };
        } else {
          return {
            pass: expected.test(result),
            actual: result,
            expected: expected.toString()
          };
        }
      } catch (error) {
        return {
          pass: false,
          error: error.message
        };
      }
    }

    async testBatch(
      description: string,
      contexts: Partial<PluginContext>[],
      expected: string[]
    ): Promise<TestResult> {
      // Batch testing implementation
    }

    async benchmark(
      iterations: number = 1000
    ): Promise<BenchmarkResult> {
      // Performance testing
    }
  }
  ```

### Documentation Generator
- [ ] **Create Documentation Tools**
  ```typescript
  // packages/cli/src/commands/docs.ts

  export async function generateDocs(pluginPath: string) {
    const plugin = await loadPlugin(pluginPath);
    const docs = generatePluginDocs(plugin);

    // Generate README.md
    const readme = `# ${plugin.name}

${plugin.description}

## Installation

\`\`\`bash
npm install ${plugin.id}
\`\`\`

## Configuration

${generateConfigDocs(plugin.configSchema)}

## Examples

${generateExamples(plugin)}

## API Reference

${generateAPIReference(plugin)}

## License

${plugin.license || 'MIT'}
`;

    await fs.writeFile('README.md', readme);
  }
  ```

### API Documentation
- [ ] **Generate TypeDoc Documentation**
  ```json
  // typedoc.json
  {
    "entryPoints": ["src/index.ts"],
    "out": "docs/api",
    "theme": "default",
    "includeVersion": true,
    "categorizeByGroup": true,
    "categoryOrder": [
      "Core",
      "Types",
      "Utils",
      "UI",
      "Testing"
    ]
  }
  ```

### Example Projects
- [ ] **Create Example Plugins**
  - Simple text transformer
  - API integration example
  - File metadata reader
  - Complex UI example
  - Multi-language plugin

## Publishing Infrastructure

### NPM Publishing
- [ ] **Configure NPM Publishing**
  ```json
  // .npmrc
  @filecataloger:registry=https://registry.npmjs.org/
  //registry.npmjs.org/:_authToken=${NPM_TOKEN}
  ```

- [ ] **GitHub Actions for Publishing**
  ```yaml
  # .github/workflows/publish.yml
  name: Publish SDK

  on:
    release:
      types: [created]

  jobs:
    publish:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - uses: actions/setup-node@v3
          with:
            node-version: 18
            registry-url: https://registry.npmjs.org/

        - run: npm ci
        - run: npm test
        - run: npm run build
        - run: npm publish --access public
          env:
            NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}
  ```

### Plugin Registry
- [ ] **Create Plugin Registry API**
  - Plugin submission endpoint
  - Version management
  - Download tracking
  - Search API

## Developer Experience

### VS Code Extension
- [ ] **Create VS Code Extension**
  - Syntax highlighting for plugin files
  - IntelliSense for SDK
  - Snippets for common patterns
  - Integrated testing
  - Debugging support

### Developer Portal
- [ ] **Build Developer Portal**
  - Getting started guide
  - API reference
  - Example gallery
  - Community plugins
  - Support forum

## Deliverables

1. **@filecataloger/plugin-sdk NPM Package**
   - Core plugin creation functions
   - TypeScript definitions
   - Utility functions
   - UI components

2. **@filecataloger/cli NPM Package**
   - Project scaffolding
   - Build tools
   - Testing framework
   - Publishing tools

3. **Documentation**
   - API reference
   - Getting started guide
   - Example projects
   - Best practices

4. **Developer Tools**
   - VS Code extension
   - Project templates
   - Testing utilities

## Success Criteria

- [ ] SDK published to NPM
- [ ] CLI tool functional
- [ ] Documentation complete
- [ ] 5+ example plugins
- [ ] VS Code extension available
- [ ] Developer portal live

## Next Stage

Stage 6 will create the Plugin Marketplace UI and backend infrastructure for discovering, installing, and managing community plugins.