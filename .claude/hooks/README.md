# FileCataloger Build Check and Refresh Hook System

## Overview

This hook system automatically validates and refreshes your FileCataloger application whenever Claude Code modifies files, ensuring build quality and catching errors immediately.

## What It Does

After every file edit or write operation, the hook:

1. **TypeScript Compilation Check** - Validates that all TypeScript files compile without errors
2. **Linting Verification** - Runs ESLint to catch code style issues
3. **Development Server Monitoring** - Checks if the dev server is running and notifies about hot-reload status
4. **Native Module Detection** - Alerts when C++ native modules are changed (may require rebuild)
5. **Smart Process Management** - Identifies when main process files change (requiring app restart)

## Hook Behavior

### Blocking Errors

The hook will **block further operations** if TypeScript compilation errors are detected, prompting Claude Code to fix them immediately.

### Non-blocking Warnings

Linting issues and other warnings are reported but won't block operations - they're informational for awareness.

### Auto-Reload Detection

- **Renderer Changes**: Automatically hot-reloaded when `yarn dev` is running
- **Main Process Changes**: Electron restarts automatically via the dev server
- **Native Module Changes**: Notifies that a rebuild may be needed

## Configuration

The hook is configured in `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/build-check-and-refresh.sh",
            "timeout": 45
          }
        ]
      }
    ]
  }
}
```

## Testing the Hook

To test if the hook is working:

1. Create a file with intentional TypeScript errors
2. Claude Code will be blocked and prompted to fix the errors
3. Once fixed, the application will auto-reload

## Customization

You can modify the hook behavior by editing `.claude/hooks/build-check-and-refresh.sh`:

- Adjust which file types trigger checks
- Add additional validation steps
- Modify blocking vs non-blocking criteria
- Customize feedback messages

## Troubleshooting

If the hook isn't running:

1. Ensure the script is executable: `chmod +x .claude/hooks/build-check-and-refresh.sh`
2. Check that `.claude/settings.local.json` is properly configured
3. Restart Claude Code to reload settings

## Benefits

- **Immediate Error Detection**: Catches TypeScript and build errors instantly
- **Automatic Quality Enforcement**: Ensures code quality standards are maintained
- **Smart Context Awareness**: Knows when to reload vs restart based on file changes
- **Developer Productivity**: Reduces manual checking and validation steps
