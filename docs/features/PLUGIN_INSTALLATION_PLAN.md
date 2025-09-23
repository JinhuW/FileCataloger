# Plugin Installation System Implementation Plan

## Overview
This plan outlines the implementation of an npm-based plugin installation system for FileCataloger, allowing users to install naming pattern plugins directly from npm packages through the preferences window.

## Current Architecture Analysis

### Existing Plugin System
- **Built-in plugins**: date, counter, filename, text, project components
- **Plugin Manager**: TypeScript-based execution with validation
- **Plugin Registry**: Marketplace functionality (currently stubbed)
- **Plugin SDK**: Comprehensive toolkit for plugin development
- **Security model**: Permissions system and sandboxed execution

### Key Files
- `src/main/modules/plugins/pluginManager.ts` - Core plugin management
- `src/main/modules/plugins/PluginRegistry.ts` - Plugin discovery/marketplace
- `src/shared/types/plugins.ts` - Plugin type definitions
- `src/shared/PluginSDK.ts` - Plugin development kit
- `src/renderer/features/fileRename/RenamePatternBuilder.tsx` - UI component

## Implementation Plan

### 1. Plugin Installation Service

#### Create `src/main/modules/plugins/pluginInstaller.ts`
```typescript
export class PluginInstaller {
  private pluginsDir: string;

  constructor() {
    // Set up plugins directory at ~/Library/Application Support/FileCataloger/plugins
  }

  async installFromNpm(packageName: string): Promise<LoadedPlugin> {
    // 1. Validate package name
    // 2. Create temp directory
    // 3. Run npm install in isolated environment
    // 4. Validate plugin structure
    // 5. Move to plugins directory
    // 6. Load and register with PluginManager
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    // Remove from file system and unregister
  }

  async searchNpmRegistry(query: string): Promise<NpmPackageInfo[]> {
    // Search npm for packages with 'filecataloger-plugin' keyword
  }
}
```

### 2. IPC Communication Layer

#### Add to `src/main/index.ts`
```typescript
// Plugin management IPC handlers
ipcMain.handle('plugin:install', async (event, packageName: string) => {
  return await pluginInstaller.installFromNpm(packageName);
});

ipcMain.handle('plugin:uninstall', async (event, pluginId: string) => {
  return await pluginInstaller.uninstallPlugin(pluginId);
});

ipcMain.handle('plugin:list', async () => {
  return pluginManager.getPlugins();
});

ipcMain.handle('plugin:search', async (event, query: string) => {
  return await pluginInstaller.searchNpmRegistry(query);
});

ipcMain.handle('plugin:toggle', async (event, pluginId: string, enabled: boolean) => {
  return await pluginManager.togglePlugin(pluginId, enabled);
});
```

### 3. Preferences Window Enhancement

#### Update `src/renderer/pages/preferences/preferences.html`
Add new Plugins section:
```html
<div class="section">
  <h2>Plugins</h2>

  <div class="plugin-search">
    <input type="text" id="pluginSearch" placeholder="Search npm for plugins...">
    <button id="searchButton">Search</button>
  </div>

  <div id="searchResults" class="search-results"></div>

  <div class="installed-plugins">
    <h3>Installed Plugins</h3>
    <div id="pluginList"></div>
  </div>
</div>
```

#### Update `src/renderer/pages/preferences/preferences.ts`
```typescript
// Add plugin management functions
async function searchPlugins(query: string): Promise<void> {
  const results = await window.api.invoke('plugin:search', query);
  displaySearchResults(results);
}

async function installPlugin(packageName: string): Promise<void> {
  try {
    showInstallProgress(packageName);
    await window.api.invoke('plugin:install', packageName);
    await refreshPluginList();
    showSuccess(`Plugin "${packageName}" installed successfully`);
  } catch (error) {
    showError(`Failed to install plugin: ${error.message}`);
  }
}

async function refreshPluginList(): Promise<void> {
  const plugins = await window.api.invoke('plugin:list');
  displayInstalledPlugins(plugins);
}
```

### 4. Plugin Manager Extensions

#### Update `src/main/modules/plugins/pluginManager.ts`
```typescript
// Add methods for external plugin loading
public async loadExternalPlugin(pluginPath: string): Promise<void> {
  try {
    // Dynamic import of plugin module
    const pluginModule = await import(pluginPath);
    const plugin = pluginModule.default || pluginModule;

    // Validate plugin structure
    const validation = this.validatePlugin(plugin);
    if (!validation.valid) {
      throw new PluginValidationError(plugin.id, validation.errors.join(', '));
    }

    // Register the plugin
    await this.registerPlugin(plugin);
  } catch (error) {
    logger.error(`Failed to load external plugin from ${pluginPath}:`, error);
    throw error;
  }
}

public async scanPluginsDirectory(): Promise<void> {
  const pluginsDir = path.join(app.getPath('userData'), 'plugins');
  const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const pluginPath = path.join(pluginsDir, entry.name, 'index.js');
      if (await fs.pathExists(pluginPath)) {
        await this.loadExternalPlugin(pluginPath);
      }
    }
  }
}
```

### 5. Pattern Builder Integration

#### Update `src/renderer/features/fileRename/RenamePatternBuilder.tsx`
```typescript
// Fetch all plugins including external ones
const [availablePlugins, setAvailablePlugins] = useState<NamingPlugin[]>([]);

useEffect(() => {
  async function loadPlugins() {
    const plugins = await window.electronAPI.plugin.list();
    setAvailablePlugins(plugins.filter(p => p.isActive));
  }
  loadPlugins();
}, []);

// Update availableComponents to include plugin components
const availableComponents = [
  ...defaultComponents,
  ...availablePlugins.map(plugin => ({
    type: plugin.id,
    label: plugin.name,
    icon: plugin.icon || '🔌',
    plugin: true,
  }))
];

// Handle plugin component execution
const executePluginComponent = async (pluginId: string, context: PluginContext) => {
  const plugin = availablePlugins.find(p => p.id === pluginId);
  if (plugin) {
    return await window.electronAPI.plugin.execute(pluginId, context);
  }
};
```

### 6. Plugin Package Structure

#### Example Plugin Package
```
filecataloger-plugin-example/
├── package.json
├── index.js
├── README.md
└── LICENSE

// package.json
{
  "name": "filecataloger-plugin-timestamp",
  "version": "1.0.0",
  "description": "Unix timestamp plugin for FileCataloger",
  "main": "index.js",
  "keywords": ["filecataloger-plugin", "naming", "timestamp"],
  "author": "Plugin Developer",
  "license": "MIT",
  "engines": {
    "filecataloger": ">=2.0.0"
  },
  "filecataloger": {
    "pluginVersion": "2.0.0",
    "permissions": ["system_info"]
  }
}

// index.js
const { PluginSDK } = require('@filecataloger/plugin-sdk');

module.exports = PluginSDK.createPlugin({
  id: 'timestamp-plugin',
  name: 'Unix Timestamp',
  version: '1.0.0',
  author: { name: 'Plugin Developer' },
  description: 'Adds Unix timestamp to filenames',
  category: 'date-time',
  tags: ['timestamp', 'unix', 'epoch'],
}, {
  render: async (context) => {
    const timestamp = Math.floor(Date.now() / 1000);
    return context.config.prefix ?
      `${context.config.prefix}${timestamp}` :
      timestamp.toString();
  },
  preview: (config) => {
    const timestamp = Math.floor(Date.now() / 1000);
    return config.prefix ?
      `${config.prefix}${timestamp}` :
      timestamp.toString();
  }
});
```

### 7. Security Considerations

#### Plugin Sandboxing
- Run plugins in VM context with limited globals
- Restrict file system access based on declared permissions
- Validate all plugin outputs before use
- Implement timeout for plugin execution

#### Package Validation
```typescript
async function validatePluginPackage(packagePath: string): Promise<boolean> {
  const packageJson = await fs.readJson(path.join(packagePath, 'package.json'));

  // Check for required fields
  if (!packageJson.keywords?.includes('filecataloger-plugin')) {
    throw new Error('Not a FileCataloger plugin');
  }

  if (!packageJson.filecataloger?.pluginVersion) {
    throw new Error('Missing FileCataloger plugin metadata');
  }

  // Verify main entry point exists
  const mainFile = path.join(packagePath, packageJson.main || 'index.js');
  if (!await fs.pathExists(mainFile)) {
    throw new Error('Plugin entry point not found');
  }

  return true;
}
```

### 8. Implementation Timeline

#### Phase 1: Core Infrastructure (Week 1)
- [ ] Create PluginInstaller class
- [ ] Set up plugins directory structure
- [ ] Implement npm package installation logic
- [ ] Add plugin validation

#### Phase 2: IPC & Main Process (Week 2)
- [ ] Add IPC handlers for plugin operations
- [ ] Extend PluginManager for external plugins
- [ ] Implement plugin scanning on startup
- [ ] Add plugin state persistence

#### Phase 3: UI Integration (Week 3)
- [ ] Update preferences window with plugins tab
- [ ] Create plugin search interface
- [ ] Add installed plugins list with controls
- [ ] Implement progress indicators

#### Phase 4: Pattern Builder (Week 4)
- [ ] Update RenamePatternBuilder to show plugins
- [ ] Implement plugin component execution
- [ ] Add plugin configuration UI
- [ ] Test with example plugins

#### Phase 5: Testing & Polish (Week 5)
- [ ] Create example plugin packages
- [ ] Test installation/uninstallation flow
- [ ] Add error handling and recovery
- [ ] Write documentation

### 9. Testing Strategy

#### Unit Tests
- Plugin validation logic
- Package installation process
- Plugin execution sandboxing

#### Integration Tests
- Full installation flow from UI
- Plugin loading and registration
- Pattern builder integration

#### Example Test Plugins
1. **Simple Text Transform**: Uppercase/lowercase converter
2. **Advanced Date Plugin**: Multiple timezone support
3. **File Metadata Plugin**: Extract EXIF data
4. **Custom Counter**: Roman numerals, hex values

### 10. Documentation

#### For Plugin Developers
- Plugin development guide
- API reference for PluginSDK
- Example plugin templates
- Publishing guidelines

#### For Users
- How to search and install plugins
- Managing installed plugins
- Troubleshooting guide
- Security best practices

## Success Criteria

1. Users can search npm for FileCataloger plugins
2. One-click installation from preferences window
3. Installed plugins appear in pattern builder
4. Plugins execute safely in sandboxed environment
5. Easy management (enable/disable/uninstall)
6. Clear error messages for failures
7. Performance remains unaffected

## Future Enhancements

- Plugin marketplace UI within app
- Plugin ratings and reviews
- Auto-update functionality
- Plugin configuration persistence
- Share patterns with plugins included