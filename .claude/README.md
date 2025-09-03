# Claude Code Configuration for Dropover Clone

This directory contains specialized Claude Code resources for developing the Dropover desktop clone.

## 🤖 Specialized Subagents

### `electron-expert.md`
- **Focus**: Main process architecture, IPC security, window management
- **Use**: For Electron-specific features like system tray, global shortcuts, native integration
- **Invoke**: `/agents electron-expert`

### `native-module-expert.md`  
- **Focus**: Platform-specific native code, mouse tracking, performance optimization
- **Use**: For implementing native modules, cross-platform compatibility
- **Invoke**: `/agents native-module-expert`

### `react-frontend-expert.md`
- **Focus**: React components, animations, desktop UI patterns
- **Use**: For renderer process development, shelf components, UI/UX
- **Invoke**: `/agents react-frontend-expert`

### `performance-expert.md`
- **Focus**: Performance optimization, memory management, testing strategies
- **Use**: For profiling, optimization, comprehensive testing setup
- **Invoke**: `/agents performance-expert`

## 🎨 Custom Output Style

### `electron-desktop-dev.md`
- **Purpose**: Specialized behavior for Electron development
- **Features**: Security-first approach, performance focus, cross-platform considerations
- **Activate**: `/output-style electron-desktop-dev`

## 🔗 Development Hooks

Configured in `settings.local.json`:

- **PostToolUse**: Alerts when TypeScript/JavaScript files are modified
- **UserPromptSubmit**: Reminds about TypeScript type checking
- **Permissions**: Allows yarn package management commands

## Usage Examples

```bash
# Switch to Electron-focused output style
/output-style electron-desktop-dev

# Get help with main process development
/agents electron-expert "Help me implement secure IPC for shelf management"

# Get React/UI assistance
/agents react-frontend-expert "Create a virtualized shelf component with animations"

# Optimize performance
/agents performance-expert "Help me optimize mouse event batching"

# Native module development
/agents native-module-expert "Implement cross-platform mouse tracking"
```

## Best Practices

1. **Start with output style**: Always activate `electron-desktop-dev` for consistent behavior
2. **Use appropriate agents**: Match the agent expertise to your specific task
3. **Security first**: The configuration emphasizes secure IPC and input validation
4. **Performance aware**: All agents consider memory usage and optimization
5. **Cross-platform**: Agents handle platform differences appropriately

## Project Structure

The agents are designed to work with this project structure:
```
src/
├── main/          # Main process (electron-expert)
├── renderer/      # React UI (react-frontend-expert)
├── native/        # Native modules (native-module-expert)
└── preload/       # IPC bridge (electron-expert)
```

This configuration provides comprehensive support for professional Electron development with security, performance, and user experience as top priorities.