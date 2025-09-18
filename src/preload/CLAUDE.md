# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Preload Module Overview

This is the **preload script** for the FileCataloger Electron application. The preload script runs in the renderer process but has access to Node.js APIs, acting as a secure bridge between the main process and renderer process.

### Purpose

The preload script:

- Exposes a limited, secure API to the renderer process via `contextBridge`
- Validates IPC channels to prevent unauthorized communication
- Provides logging capabilities back to the main process
- Ensures context isolation for security

### Key Features

1. **Dual API Exposure**: Exposes both `window.api` and `window.electronAPI` for compatibility
2. **Channel Validation**: Strict whitelist of allowed IPC channels
3. **Development Logging**: Logs preload script lifecycle in development mode
4. **Type Safety**: Exports TypeScript interface for the exposed API

### Development Commands

```bash
# Build the preload script
cd ../.. # Navigate to project root
yarn build:preload

# Type checking (run from project root)
yarn typecheck

# Full build including preload
yarn build
```

### Architecture

#### IPC Channel Categories

1. **Application channels** (`app:*`)
   - `app:ready` - Application initialization complete
   - `app:status` - Application status updates
   - `app:get-status` - Request current status
   - `app:create-shelf` - Create shelf manually
   - `app:update-config` - Update configuration

2. **Shelf channels** (`shelf:*`)
   - Lifecycle: `create`, `destroy`, `ready`, `close`
   - Interaction: `files-dropped`, `add-files`, `drop-start`, `drop-end`
   - Management: `toggle-pin`, `open-item`, `show-menu`
   - State: `items-updated`, `config`, `update-config`, `debug`

3. **Settings channels** (`settings:*`)
   - `settings:get` - Retrieve settings
   - `settings:set` - Update settings

4. **Logger channels** (`logger:*`)
   - `logger:log` - Send log messages
   - `logger:set-level` - Change log level

### API Methods

The exposed API provides four methods:

```typescript
{
  send: (channel: ValidChannel, data: unknown) => void;
  on: (channel: ValidChannel, func: (...args: unknown[]) => void) => void;
  removeAllListeners: (channel: ValidChannel) => void;
  invoke: (channel: ValidChannel, ...args: unknown[]) => Promise<unknown>;
}
```

### Important Notes

#### Security Considerations

- Only whitelisted channels can be used
- All invalid channel attempts are logged
- Context isolation prevents direct access to Node.js APIs
- No file system or process access from renderer

#### Development Tips

- Check browser console for preload script logs in development
- Invalid channel errors appear in main process logs
- Type definitions for renderer are in `src/renderer/window.d.ts`

#### Common Issues

1. **API not available**: Check that preload script is loaded in webPreferences
2. **Channel errors**: Ensure channel is in `validChannels` array
3. **Type errors**: Import types from `src/renderer/window.d.ts`

### Build Configuration

- **Webpack Config**: `config/webpack/webpack.preload.js`
- **Entry Point**: `src/preload/index.ts`
- **Output**: `dist/preload/index.js`
- **Target**: `electron-preload`
- **TypeScript**: Uses project root `tsconfig.json`

### Adding New IPC Channels

1. Add the channel to the `validChannels` array in `src/preload/index.ts`
2. Update type definitions if needed
3. Implement the channel handler in the main process
4. Use the channel in the renderer via `window.api` or `window.electronAPI`

### Code Style

- Use TypeScript strict mode
- Validate all inputs
- Log errors via IPC to main process
- Keep the API surface minimal and secure
