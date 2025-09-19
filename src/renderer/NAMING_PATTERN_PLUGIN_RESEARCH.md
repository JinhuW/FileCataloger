# Naming Pattern Plugin System - Research Report

## Executive Summary

This research report outlines a comprehensive plan to transform FileCataloger's file renaming system into a plugin-based, extensible naming pattern framework. The proposed system will allow users to create custom naming components, save patterns to their profile, and integrate external node packages for advanced functionality.

## Current State Analysis

### Existing Implementation

1. **RenamePatternBuilder Component** (`src/renderer/components/RenamePatternBuilder/RenamePatternBuilder.tsx`)
   - Fixed set of 5 component types: `date`, `fileName`, `counter`, `text`, `project`
   - Hardcoded UI with "File Format" terminology
   - Static tab system ("Format 1", "Customized")
   - No persistence of user-defined patterns
   - Limited configurability for components

2. **Data Structure** (`src/shared/types.ts`)
   ```typescript
   interface RenameComponent {
     id: string;
     type: 'date' | 'fileName' | 'counter' | 'text' | 'project';
     value?: string;
     format?: string;
     placeholder?: string;
   }
   ```

3. **Storage Infrastructure**
   - **PreferencesManager**: Stores user preferences using electron-store
   - **PersistentDataManager**: Provides both key-value (electron-store) and SQL (better-sqlite3) storage
   - Currently no storage for custom patterns or plugins

### Limitations of Current System

1. **Fixed Component Types**: Users cannot create new component types
2. **No Pattern Persistence**: Patterns are lost between sessions
3. **Limited Customization**: Component behavior is hardcoded
4. **UI Constraints**: Fixed tabs don't scale for multiple patterns
5. **No External Integration**: Cannot leverage npm packages or external tools

## Proposed Plugin Architecture

### Core Design Principles

1. **Modularity**: Each component type is a self-contained plugin
2. **Extensibility**: Users can create and install custom plugins
3. **Security**: Sandboxed execution with controlled API access
4. **Performance**: Lazy loading and efficient caching
5. **User-Friendly**: Visual plugin builder for non-technical users

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Plugin System Core                        │
├─────────────────────────────────────────────────────────────┤
│  Plugin Manager  │  Plugin Registry  │  Plugin Sandbox       │
├─────────────────┴──────────────────┴────────────────────────┤
│                    Plugin API Layer                          │
│  • Component API  • Storage API  • UI API  • Node Module API │
├─────────────────────────────────────────────────────────────┤
│                    Built-in Plugins                          │
│  Date │ FileName │ Counter │ Text │ Project │ Select │ ...  │
├───────┴──────────┴─────────┴──────┴─────────┴────────┴─────┤
│                    User Plugins                              │
│  Custom Date │ API Integration │ Database Lookup │ ...       │
└─────────────────────────────────────────────────────────────┘
```

### Plugin Interface Design

```typescript
// Core plugin interface
interface NamingPlugin {
  // Metadata
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  icon?: string;

  // Plugin type and capabilities
  type: 'component';
  capabilities: PluginCapability[];

  // Component configuration
  component: {
    // UI configuration for the component
    configSchema: JSONSchema;

    // Default configuration values
    defaultConfig: Record<string, any>;

    // Component rendering
    render: (config: any, context: RenderContext) => string;

    // Optional: Custom UI component for configuration
    configComponent?: React.ComponentType<ConfigComponentProps>;
  };

  // Lifecycle hooks
  onInstall?: () => Promise<void>;
  onUninstall?: () => Promise<void>;
  onActivate?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;
}

// Plugin capabilities
enum PluginCapability {
  FILE_SYSTEM_READ = 'file_system_read',
  NETWORK_ACCESS = 'network_access',
  NODE_MODULES = 'node_modules',
  DATABASE_ACCESS = 'database_access',
  EXTERNAL_PROCESS = 'external_process',
}

// Render context provided to plugins
interface RenderContext {
  file: ShelfItem;
  index: number;
  totalFiles: number;
  timestamp: Date;
  userConfig: Record<string, any>;
}
```

### Built-in Plugin Examples

#### 1. Enhanced Date Plugin

```typescript
const enhancedDatePlugin: NamingPlugin = {
  id: 'enhanced-date',
  name: 'Enhanced Date',
  type: 'component',
  capabilities: [],
  component: {
    configSchema: {
      type: 'object',
      properties: {
        dateType: {
          type: 'string',
          enum: ['current', 'created', 'modified', 'accessed'],
          default: 'current'
        },
        format: {
          type: 'string',
          default: 'YYYYMMDD',
          examples: ['YYYYMMDD', 'DD-MM-YYYY', 'MM/DD/YY']
        },
        timezone: {
          type: 'string',
          default: 'local'
        }
      }
    },
    render: (config, context) => {
      const date = getDateByType(config.dateType, context.file);
      return formatDate(date, config.format, config.timezone);
    }
  }
};
```

#### 2. Select Type Plugin

```typescript
const selectPlugin: NamingPlugin = {
  id: 'select',
  name: 'Select from List',
  type: 'component',
  capabilities: [PluginCapability.DATABASE_ACCESS],
  component: {
    configSchema: {
      type: 'object',
      properties: {
        options: {
          type: 'array',
          items: { type: 'string' },
          default: []
        },
        allowCustom: {
          type: 'boolean',
          default: true
        },
        defaultValue: {
          type: 'string'
        }
      }
    },
    render: (config, context) => {
      return config.defaultValue || config.options[0] || '';
    },
    configComponent: SelectConfigComponent // Custom React component
  }
};
```

### User Plugin Example

```javascript
// user-plugins/api-lookup.js
module.exports = {
  id: 'api-lookup',
  name: 'API Lookup',
  type: 'component',
  capabilities: ['network_access'],
  component: {
    configSchema: {
      type: 'object',
      properties: {
        apiUrl: { type: 'string' },
        apiKey: { type: 'string', format: 'password' },
        lookupField: { type: 'string', default: 'filename' }
      }
    },
    render: async (config, context) => {
      const response = await fetch(config.apiUrl, {
        headers: { 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          [config.lookupField]: context.file.name
        })
      });
      const data = await response.json();
      return data.result || context.file.name;
    }
  }
};
```

## Implementation Plan

### Phase 1: UI Updates (Week 1)

1. **Rename "File Format" to "Naming Pattern"**
   - Update `RenamePatternBuilder.tsx` component text
   - Update related documentation and tooltips

2. **Implement Scrollable Pattern Tabs**
   ```typescript
   // Add horizontal scroll container for pattern tabs
   <ScrollContainer>
     {savedPatterns.map((pattern, index) => (
       <PatternTab
         key={pattern.id}
         active={activePattern === pattern.id}
         onClick={() => setActivePattern(pattern.id)}
       >
         {pattern.name}
       </PatternTab>
     ))}
     <AddPatternButton onClick={createNewPattern}>+</AddPatternButton>
   </ScrollContainer>
   ```

### Phase 2: Pattern Persistence (Week 2)

1. **Extend Preferences Schema**
   ```typescript
   interface AppPreferences {
     // ... existing preferences
     namingPatterns: {
       saved: SavedPattern[];
       recent: string[]; // Pattern IDs
       default: string; // Default pattern ID
     };
   }

   interface SavedPattern {
     id: string;
     name: string;
     components: RenameComponent[];
     createdAt: number;
     updatedAt: number;
     metadata?: Record<string, any>;
   }
   ```

2. **Add Pattern Management Methods**
   ```typescript
   class PatternManager {
     savePattern(pattern: SavedPattern): void;
     loadPattern(id: string): SavedPattern;
     deletePattern(id: string): void;
     listPatterns(): SavedPattern[];
     exportPattern(id: string): string;
     importPattern(data: string): SavedPattern;
   }
   ```

### Phase 3: Plugin System Core (Week 3-4)

1. **Plugin Manager Implementation**
   ```typescript
   class PluginManager {
     private plugins: Map<string, NamingPlugin>;
     private sandbox: PluginSandbox;

     async loadPlugin(path: string): Promise<void>;
     async unloadPlugin(id: string): Promise<void>;
     getPlugin(id: string): NamingPlugin;
     listPlugins(): PluginInfo[];
     validatePlugin(plugin: any): boolean;
   }
   ```

2. **Plugin Sandbox**
   ```typescript
   class PluginSandbox {
     private vm: VM; // Using vm2 or similar
     private allowedModules: Set<string>;

     async execute(
       plugin: NamingPlugin,
       method: string,
       args: any[]
     ): Promise<any>;

     validateCapabilities(
       plugin: NamingPlugin,
       requested: PluginCapability[]
     ): boolean;
   }
   ```

3. **Plugin Storage**
   ```sql
   CREATE TABLE plugins (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     version TEXT NOT NULL,
     source_path TEXT,
     config TEXT,
     enabled INTEGER DEFAULT 1,
     installed_at INTEGER NOT NULL,
     updated_at INTEGER
   );

   CREATE TABLE plugin_permissions (
     plugin_id TEXT,
     capability TEXT,
     granted INTEGER DEFAULT 0,
     granted_at INTEGER,
     FOREIGN KEY(plugin_id) REFERENCES plugins(id)
   );
   ```

### Phase 4: Built-in Plugins Migration (Week 5)

1. Convert existing components to plugins
2. Add new built-in plugins (select, enhanced date, etc.)
3. Ensure backward compatibility

### Phase 5: Plugin Marketplace (Week 6)

1. **Plugin Discovery UI**
   - Browse available plugins
   - Search and filter
   - Install/uninstall interface

2. **Plugin Development Kit**
   - Template generator
   - Development tools
   - Testing framework

## Technical Considerations

### Security

1. **Sandbox Execution**
   - Use vm2 or similar for JavaScript isolation
   - Restrict file system access
   - Control network requests
   - Limit CPU/memory usage

2. **Permission Model**
   - Explicit capability requests
   - User approval for sensitive operations
   - Revocable permissions

3. **Code Signing** (Future)
   - Verify plugin authenticity
   - Prevent tampering

### Performance

1. **Lazy Loading**
   - Load plugins on-demand
   - Cache compiled plugin code
   - Preload frequently used plugins

2. **Resource Limits**
   - Timeout for plugin execution
   - Memory usage caps
   - Concurrent execution limits

### Node Package Integration

1. **Controlled npm Access**
   ```typescript
   class PluginNodeModules {
     private allowedPackages: Set<string>;

     async install(packageName: string): Promise<void>;
     require(packageName: string): any;
     validatePackage(packageName: string): boolean;
   }
   ```

2. **Package Whitelist**
   - Pre-approved safe packages
   - User-approved packages
   - Security scanning

### User Experience

1. **Visual Plugin Builder**
   - Drag-and-drop interface
   - No-code plugin creation
   - Template library

2. **Plugin Testing**
   - Preview mode
   - Test data sets
   - Debug console

## Developer API

### Overview

The FileCataloger Plugin API provides a comprehensive set of interfaces and tools for developers to create custom naming components. The API is designed to be intuitive, secure, and powerful enough to handle complex use cases while maintaining safety and performance.

### Core APIs

#### 1. Plugin Development Kit (@filecataloger/plugin-sdk)

```typescript
// Installation: npm install @filecataloger/plugin-sdk

import {
  createPlugin,
  PluginContext,
  ComponentConfig,
  FileInfo,
  UIComponents
} from '@filecataloger/plugin-sdk';

// Create a plugin
export default createPlugin({
  id: 'my-custom-component',
  name: 'My Custom Component',
  version: '1.0.0',

  // Define configuration schema
  config: {
    schema: {
      type: 'object',
      properties: {
        prefix: { type: 'string', default: 'CUSTOM_' },
        uppercase: { type: 'boolean', default: false }
      }
    }
  },

  // Main render function
  render: async (context: PluginContext) => {
    const { file, config, utils } = context;
    let result = config.prefix + file.nameWithoutExtension;

    if (config.uppercase) {
      result = result.toUpperCase();
    }

    return result;
  },

  // Optional: Custom configuration UI
  configUI: {
    component: 'MyConfigComponent',
    size: { width: 400, height: 300 }
  }
});
```

#### 2. Plugin Context API

```typescript
interface PluginContext {
  // File information
  file: FileInfo;

  // User configuration for this component
  config: Record<string, any>;

  // Utility functions
  utils: PluginUtils;

  // Runtime information
  runtime: {
    index: number;        // Current file index
    total: number;        // Total files being renamed
    timestamp: Date;      // Current timestamp
    locale: string;       // User's locale
  };

  // Storage API
  storage: PluginStorage;

  // Event emitter
  events: EventEmitter;
}

interface FileInfo {
  path: string;                  // Full file path
  name: string;                  // Filename with extension
  nameWithoutExtension: string;  // Filename without extension
  extension: string;             // File extension (including dot)
  size: number;                  // File size in bytes
  type: string;                  // MIME type
  created: Date;                 // Creation date
  modified: Date;                // Last modified date
  accessed: Date;                // Last accessed date
  metadata?: Record<string, any>; // Custom metadata
}

interface PluginUtils {
  // File system utilities (sandboxed)
  fs: {
    readFile: (path: string) => Promise<Buffer>;
    exists: (path: string) => Promise<boolean>;
    getStats: (path: string) => Promise<FileStats>;
  };

  // Formatting utilities
  format: {
    date: (date: Date, format: string) => string;
    number: (num: number, format: string) => string;
    bytes: (bytes: number, precision?: number) => string;
  };

  // String manipulation
  string: {
    slugify: (text: string) => string;
    camelCase: (text: string) => string;
    pascalCase: (text: string) => string;
    kebabCase: (text: string) => string;
    snakeCase: (text: string) => string;
  };

  // Hashing utilities
  crypto: {
    md5: (data: string | Buffer) => string;
    sha256: (data: string | Buffer) => string;
    uuid: () => string;
  };

  // Network utilities (requires permission)
  http?: {
    get: (url: string, options?: HttpOptions) => Promise<Response>;
    post: (url: string, data: any, options?: HttpOptions) => Promise<Response>;
  };

  // Database utilities (requires permission)
  db?: {
    query: (sql: string, params?: any[]) => Promise<any[]>;
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
}
```

#### 3. UI Component API

```typescript
import {
  Input,
  Select,
  Checkbox,
  DatePicker,
  ColorPicker,
  FileSelector,
  Button,
  Form
} from '@filecataloger/plugin-sdk/ui';

// Custom configuration component
export const MyConfigComponent: React.FC<ConfigComponentProps> = ({
  config,
  onChange,
  errors
}) => {
  return (
    <Form>
      <Form.Field>
        <Form.Label>Prefix</Form.Label>
        <Input
          value={config.prefix}
          onChange={(value) => onChange({ ...config, prefix: value })}
          error={errors?.prefix}
        />
      </Form.Field>

      <Form.Field>
        <Form.Label>Date Format</Form.Label>
        <Select
          value={config.dateFormat}
          onChange={(value) => onChange({ ...config, dateFormat: value })}
          options={[
            { value: 'YYYY-MM-DD', label: 'ISO Date' },
            { value: 'MM/DD/YYYY', label: 'US Format' },
            { value: 'DD/MM/YYYY', label: 'EU Format' }
          ]}
        />
      </Form.Field>

      <Form.Field>
        <Checkbox
          label="Convert to uppercase"
          checked={config.uppercase}
          onChange={(checked) => onChange({ ...config, uppercase: checked })}
        />
      </Form.Field>
    </Form>
  );
};
```

#### 4. Storage API

```typescript
interface PluginStorage {
  // Local storage (per-plugin)
  local: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
    clear: () => Promise<void>;
  };

  // User storage (shared across devices)
  user: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };

  // Temporary storage (cleared on restart)
  temp: {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
    delete: (key: string) => void;
  };
}
```

#### 5. Event API

```typescript
interface PluginEvents {
  // Listen to events
  on(event: 'config-changed', handler: (config: any) => void): void;
  on(event: 'file-added', handler: (file: FileInfo) => void): void;
  on(event: 'before-rename', handler: (files: FileInfo[]) => void): void;
  on(event: 'after-rename', handler: (results: RenameResult[]) => void): void;

  // Emit custom events
  emit(event: string, data?: any): void;

  // Remove listeners
  off(event: string, handler: Function): void;
}
```

### Advanced Features

#### 1. Async Components

```typescript
export default createPlugin({
  id: 'async-lookup',
  name: 'Async Lookup',

  // Async render function
  render: async (context: PluginContext) => {
    const { file, utils, config } = context;

    // Make API call (requires network permission)
    if (utils.http) {
      const response = await utils.http.get(config.apiUrl, {
        params: { filename: file.name }
      });

      return response.data.suggestedName || file.name;
    }

    return file.name;
  },

  // Declare required permissions
  permissions: ['network'],

  // Timeout for async operations
  timeout: 5000
});
```

#### 2. Batch Processing

```typescript
export default createPlugin({
  id: 'sequence-generator',
  name: 'Sequence Generator',

  // Batch mode for better performance
  batchMode: true,

  // Process all files at once
  renderBatch: async (contexts: PluginContext[]) => {
    // Generate sequence based on all files
    const sorted = contexts.sort((a, b) =>
      a.file.name.localeCompare(b.file.name)
    );

    return sorted.map((context, index) => {
      const { config } = context;
      const paddedIndex = String(index + 1).padStart(config.digits || 3, '0');
      return `${config.prefix}${paddedIndex}`;
    });
  }
});
```

#### 3. External Module Integration

```typescript
// package.json
{
  "name": "filecataloger-plugin-exif",
  "version": "1.0.0",
  "filecataloger": {
    "permissions": ["filesystem"],
    "allowedModules": ["exif-parser", "sharp"]
  },
  "dependencies": {
    "exif-parser": "^0.1.12",
    "sharp": "^0.31.0"
  }
}

// index.js
import exifParser from 'exif-parser';
import sharp from 'sharp';

export default createPlugin({
  id: 'exif-date',
  name: 'EXIF Date',

  render: async (context) => {
    const { file, utils, config } = context;

    if (!file.type.startsWith('image/')) {
      return file.nameWithoutExtension;
    }

    try {
      const buffer = await utils.fs.readFile(file.path);
      const parser = exifParser.create(buffer);
      const result = parser.parse();

      if (result.tags.DateTimeOriginal) {
        const date = new Date(result.tags.DateTimeOriginal * 1000);
        return utils.format.date(date, config.format || 'YYYY-MM-DD');
      }
    } catch (error) {
      console.error('EXIF parsing failed:', error);
    }

    return file.nameWithoutExtension;
  }
});
```

### Plugin Manifest

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "author": {
    "name": "John Doe",
    "email": "john@example.com",
    "url": "https://example.com"
  },
  "description": "A powerful naming component for FileCataloger",
  "homepage": "https://github.com/johndoe/filecataloger-awesome-plugin",
  "repository": {
    "type": "git",
    "url": "https://github.com/johndoe/filecataloger-awesome-plugin.git"
  },
  "license": "MIT",
  "engines": {
    "filecataloger": ">=2.0.0",
    "node": ">=14.0.0"
  },
  "filecataloger": {
    "type": "component",
    "permissions": ["filesystem", "network"],
    "allowedModules": ["axios", "lodash"],
    "configSchema": {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "apiKey": {
          "type": "string",
          "format": "password",
          "description": "API key for external service"
        }
      }
    }
  },
  "keywords": ["filecataloger", "plugin", "naming", "api"],
  "main": "dist/index.js",
  "files": ["dist", "README.md", "LICENSE"]
}
```

### Testing Your Plugin

```typescript
import { testPlugin } from '@filecataloger/plugin-sdk/testing';

describe('My Plugin', () => {
  it('should format files correctly', async () => {
    const result = await testPlugin({
      plugin: myPlugin,
      files: [
        { name: 'test.jpg', size: 1024 },
        { name: 'example.png', size: 2048 }
      ],
      config: {
        prefix: 'IMG_',
        uppercase: true
      }
    });

    expect(result).toEqual(['IMG_TEST', 'IMG_EXAMPLE']);
  });
});
```

### Publishing Your Plugin

1. **Prepare your plugin**
   ```bash
   npm run build
   npm test
   npm run lint
   ```

2. **Publish to npm**
   ```bash
   npm publish --tag filecataloger-plugin
   ```

3. **Submit to FileCataloger Registry**
   ```bash
   npx @filecataloger/cli submit-plugin
   ```

### Security Guidelines

1. **Never store sensitive data in plain text**
2. **Validate all user inputs**
3. **Use the provided sandboxed APIs**
4. **Request only necessary permissions**
5. **Handle errors gracefully**
6. **Respect user privacy**

### Best Practices

1. **Performance**
   - Cache expensive operations
   - Use batch mode for multiple files
   - Implement timeouts for async operations

2. **User Experience**
   - Provide clear configuration options
   - Include helpful descriptions
   - Offer sensible defaults
   - Show progress for long operations

3. **Error Handling**
   - Always return a fallback value
   - Log errors appropriately
   - Provide user-friendly error messages

4. **Documentation**
   - Include comprehensive README
   - Document all configuration options
   - Provide usage examples
   - List required permissions

### Example Plugins

1. **[filecataloger-plugin-git](https://github.com/example/filecataloger-plugin-git)**
   - Add git branch, commit hash to filenames

2. **[filecataloger-plugin-weather](https://github.com/example/filecataloger-plugin-weather)**
   - Include current weather in filename

3. **[filecataloger-plugin-translate](https://github.com/example/filecataloger-plugin-translate)**
   - Translate filenames to different languages

4. **[filecataloger-plugin-barcode](https://github.com/example/filecataloger-plugin-barcode)**
   - Extract barcode/QR code data from images

### Support and Resources

- **Documentation**: https://filecataloger.dev/docs/plugins
- **API Reference**: https://filecataloger.dev/api
- **Plugin Examples**: https://github.com/filecataloger/plugin-examples
- **Community Forum**: https://community.filecataloger.dev
- **Discord Server**: https://discord.gg/filecataloger

## Migration Strategy

1. **Backward Compatibility**
   - Existing patterns continue to work
   - Automatic migration to new format
   - Gradual feature rollout

2. **User Education**
   - Interactive tutorials
   - Example plugins
   - Documentation

## Risk Assessment

### Technical Risks

1. **Security Vulnerabilities**
   - Mitigation: Robust sandboxing, code review

2. **Performance Impact**
   - Mitigation: Lazy loading, resource limits

3. **Complexity**
   - Mitigation: Phased rollout, extensive testing

### User Risks

1. **Learning Curve**
   - Mitigation: Intuitive UI, tutorials

2. **Plugin Quality**
   - Mitigation: Review process, ratings system

## Recommendations

1. **Start with Phase 1-2**: Immediate UI improvements and pattern persistence
2. **Prototype Plugin System**: Build proof-of-concept with 1-2 plugins
3. **Security First**: Invest in robust sandboxing before full rollout
4. **Community Feedback**: Beta test with power users
5. **Iterative Development**: Release features incrementally

## Conclusion

The proposed naming pattern plugin system will transform FileCataloger's renaming capabilities from a static feature into a dynamic, extensible platform. By allowing users to create custom components and integrate external tools, we can meet diverse user needs while maintaining security and performance.

The phased implementation approach ensures we can deliver immediate value (UI improvements and pattern persistence) while building toward the full plugin ecosystem. With proper security measures and a focus on user experience, this system will significantly enhance FileCataloger's utility and appeal to power users.

## Next Steps

1. Review and approve the research findings
2. Prioritize implementation phases
3. Allocate development resources
4. Create detailed technical specifications for Phase 1
5. Begin UI updates and pattern persistence implementation