# FileCataloger Plugin System

The FileCataloger plugin system allows users to extend the application's file renaming capabilities by installing custom naming components from npm.

## Overview

The plugin system provides:

- **npm-based distribution**: Install plugins directly from npm
- **Sandboxed execution**: Plugins run in a secure, isolated environment
- **UI integration**: Plugins appear alongside built-in components in the pattern builder
- **Configuration support**: Plugins can expose configuration options
- **Hot-reloading**: Modify plugins without restarting the application
- **Type safety**: Full TypeScript support throughout

## Architecture

### Core Components

1. **Plugin Installer** (`src/main/modules/plugins/pluginInstaller.ts`)
   - Manages npm package installation
   - Validates plugin compatibility
   - Handles updates and removals

2. **Security Manager** (`src/main/modules/security/pluginSecurity.ts`)
   - Scans plugins for malicious code
   - Creates sandboxed execution contexts
   - Enforces security policies

3. **Plugin Storage** (`src/main/modules/storage/pluginStorage.ts`)
   - Persists installed plugin metadata
   - Tracks usage statistics
   - Manages plugin configuration

4. **Plugin Manager** (`src/main/modules/plugins/pluginManager.ts`)
   - Loads and executes plugins
   - Manages plugin lifecycle
   - Provides plugin APIs

5. **IPC Handlers** (`src/main/ipc/pluginHandlers.ts`)
   - Bridges main and renderer processes
   - Handles plugin-related IPC calls

6. **UI Components** (`src/renderer/pages/preferences/plugins/`)
   - Plugin search and installation UI
   - Configuration dialogs
   - Integration with pattern builder

## User Guide

### Installing Plugins

1. Open FileCataloger preferences
2. Navigate to the "Plugins" section
3. Click "Open Plugin Manager"
4. Search for plugins by name or keyword
5. Click "Install" to add a plugin
6. Configure plugin settings if needed

### Using Plugins in Patterns

1. Open the file rename shelf
2. In the pattern builder, installed plugins appear as available components
3. Click on a plugin component to add it to your pattern
4. The plugin will execute when you rename files

### Managing Plugins

- **Enable/Disable**: Toggle plugins on/off without uninstalling
- **Configure**: Access plugin-specific settings
- **Update**: Check for and install plugin updates
- **Uninstall**: Remove plugins you no longer need

## Plugin Development

See the [Plugin Development Guide](./PLUGIN_DEVELOPMENT_GUIDE.md) for detailed instructions on creating plugins.

### Quick Start

1. Create a new npm package with FileCataloger plugin metadata
2. Implement the plugin interface with your custom logic
3. Publish to npm with appropriate tags
4. Users can install your plugin through the UI

### Example Plugin Structure

```javascript
module.exports = {
  id: 'my-plugin',
  version: '1.0.0',
  metadata: {
    name: 'My Plugin',
    description: 'Adds custom naming components',
    icon: '🔌'
  },
  component: {
    render: async (context) => {
      // Generate component value
      return 'custom-value';
    }
  }
};
```

## Security

The plugin system implements multiple security layers:

1. **Code Scanning**: Automated scanning for malicious patterns
2. **Sandboxing**: Plugins run in isolated VM contexts
3. **Permission System**: Plugins must declare required permissions
4. **Resource Limits**: CPU and memory usage restrictions
5. **Network Isolation**: No unauthorized network access

## API Reference

### Plugin Context

Plugins receive a context object with:

```typescript
interface PluginContext {
  filename: string;      // Original filename without extension
  extension: string;     // File extension (e.g., '.txt')
  index: number;        // File index in batch
  config: Record<string, any>; // Plugin configuration
  utils: PluginUtils;   // Utility functions
  logger: PluginLogger; // Logging interface
}
```

### Available Utils

```typescript
interface PluginUtils {
  date: {
    format(date: Date, pattern: string): string;
    parse(dateString: string): Date;
    // ... more date utilities
  };
  string: {
    slugify(text: string): string;
    camelCase(text: string): string;
    // ... more string utilities
  };
  crypto: {
    md5(data: string | Buffer): string;
    sha256(data: string | Buffer): string;
    // ... more crypto utilities
  };
}
```

## IPC Channels

The plugin system uses these IPC channels:

- `plugin:search` - Search npm registry
- `plugin:install` - Install a plugin
- `plugin:uninstall` - Remove a plugin
- `plugin:list` - List installed plugins
- `plugin:enable` - Enable a plugin
- `plugin:disable` - Disable a plugin
- `plugin:configure` - Update plugin config
- `pattern:get-plugins` - Get plugins for pattern builder
- `pattern:execute-plugin` - Execute plugin component

## Storage

Plugin data is stored in:

- **Installed plugins**: `~/Library/Application Support/FileCataloger/plugins/`
- **Plugin database**: `~/Library/Application Support/FileCataloger/plugins.db`
- **Configuration**: Stored in the SQLite database

## Performance Considerations

- Plugins are loaded on-demand
- Batch processing support for efficiency
- Caching of plugin results where appropriate
- Resource monitoring and limits

## Troubleshooting

### Plugin Not Loading

1. Check the logs at `~/Library/Application Support/FileCataloger/logs/`
2. Verify plugin compatibility with current FileCataloger version
3. Try reinstalling the plugin
4. Check for error messages in the plugin manager

### Security Warnings

If a plugin triggers security warnings:
1. The plugin may contain potentially unsafe code
2. Check the plugin's source code and reputation
3. Contact the plugin author for clarification
4. Report suspicious plugins to the FileCataloger team

### Performance Issues

1. Disable plugins one by one to identify the cause
2. Check plugin configuration for resource-intensive options
3. Report performance issues to plugin authors

## Future Enhancements

Planned improvements to the plugin system:

1. **Plugin marketplace**: Curated plugin directory
2. **Plugin signing**: Cryptographic verification of plugins
3. **Extended APIs**: More capabilities for plugins
4. **Plugin dependencies**: Support for plugins depending on other plugins
5. **Visual plugin builder**: GUI for creating simple plugins

## Contributing

We welcome contributions to the plugin system! See our [Contributing Guide](../CONTRIBUTING.md) for details.

## Support

- [Documentation](https://docs.filecataloger.com/plugins)
- [GitHub Issues](https://github.com/filecataloger/filecataloger/issues)
- [Discord Community](https://discord.gg/filecataloger)