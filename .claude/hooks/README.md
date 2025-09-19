# FileCataloger Auto-Rebuild Hook System

## Overview

This hook system automatically rebuilds the FileCataloger application after Claude Code makes changes, providing intelligent build management without interrupting the development workflow.

## Features

### 🚀 Intelligent Build Triggers
- **Change Tracking**: Monitors all file modifications made by Claude Code
- **Batch Processing**: Waits for 3+ changes before triggering builds (configurable)
- **Smart Analysis**: Determines optimal build strategy based on file types changed
- **Priority System**: Handles critical changes (native modules, configs) with higher priority

### 🔧 Build Strategies
1. **Full Rebuild**: For configuration changes, package.json updates
2. **Native Rebuild**: When native C++ modules are modified
3. **Incremental Build**: For TypeScript/JavaScript source changes
4. **Hot Reload**: For renderer and style changes
5. **Minimal**: For documentation or test-only changes

### 📊 Real-time Feedback
- Clear progress indicators during builds
- Color-coded status messages
- Build timing information
- Error summaries with actionable fixes

### 🛡️ Error Handling
- Non-blocking for non-critical errors
- Graceful degradation on build failures
- Automatic retry logic for transient issues
- Preservation of working state

## Installation

The hook system is automatically installed when you clone the FileCataloger repository. To verify installation:

```bash
# Check hook files exist
ls -la .claude/hooks/scripts/

# Verify executability
.claude/hooks/scripts/auto-rebuild.sh --version
```

## Configuration

### Hook Configuration File
Location: `.claude/hooks/post-code-completion.json`

```json
{
  "rebuildThreshold": 3,      // Number of changes before auto-rebuild
  "idleTimeout": 5000,         // Ms to wait when idle before building
  "autoRestart": true,         // Auto-restart dev server
  "smartRebuild": true         // Use intelligent build strategy
}
```

### Environment Variables
Set in `.claude/settings.local.json`:

- `CLAUDE_AUTO_START_DEV`: Auto-start dev server (default: true)
- `CLAUDE_STOP_DEV_ON_END`: Stop dev server on session end (default: false)
- `PROJECT_ROOT`: Project root directory (auto-detected)

## Usage

### Automatic Operation
The hook runs automatically when:
1. Claude Code edits/writes files (PostToolUse)
2. A batch of operations completes (PreCompact)
3. The session ends (SessionEnd)

### Manual Trigger
Run the rebuild manually:
```bash
.claude/hooks/scripts/integrate-auto-rebuild.sh
```

### Monitoring

Watch build logs:
```bash
tail -f /tmp/claude_fc_build.log
```

Check change tracking:
```bash
cat /tmp/claude_fc_changes.log
```

## File Type Handling

### Native Modules (Priority: 10)
- Files: `*.cc`, `*.h`, `*.gyp`
- Action: Full native rebuild + restart

### Configuration (Priority: 9)
- Files: `package.json`, `tsconfig.json`, `webpack.*.js`
- Action: Full rebuild + restart

### Main Process (Priority: 8)
- Files: `src/main/**/*.ts`
- Action: Build main + restart

### Preload Scripts (Priority: 7)
- Files: `src/preload/**/*.ts`
- Action: Build preload + restart

### Renderer (Priority: 6)
- Files: `src/renderer/**/*.{ts,tsx}`
- Action: Build renderer + hot reload

### Styles (Priority: 4)
- Files: `*.css`, `tailwind.config.js`
- Action: Build renderer + hot reload

### Tests (Priority: 2)
- Files: `*.test.ts`, `*.spec.ts`
- Action: Run tests

### Documentation (Priority: 0)
- Files: `*.md`, `README`, `CHANGELOG`
- Action: No rebuild needed

## Build Output Examples

### Successful Build
```
═══════════════════════════════════════════════════════
🔄 AUTO-REBUILD INITIATED
═══════════════════════════════════════════════════════
📋 Running: yarn typecheck
  ✅ Success
📋 Running: yarn lint
  ✅ Success
🏗️ Building application...
  ✅ Build successful
═══════════════════════════════════════════════════════
✨ Auto-rebuild complete
═══════════════════════════════════════════════════════
```

### Build with Warnings
```
📝 Change tracked: ShelfManager.ts
🔍 Analyzing 3 changed files...
📦 Source code changes detected
📋 Running: yarn typecheck
  ⚠️ Warning: Check output
     src/main/modules/window/shelfManager.ts:45:7 - error TS2322
📋 Running: yarn lint
  ✅ Success
```

## Troubleshooting

### Hook Not Triggering
1. Check hook is enabled in settings
2. Verify file permissions: `chmod +x .claude/hooks/scripts/*.sh`
3. Check change log: `cat /tmp/claude_fc_changes.log`

### Build Failures
1. Check build log: `tail -n 50 /tmp/claude_fc_build.log`
2. Run manual build: `yarn build`
3. Clear cache: `yarn clean && yarn build`

### Native Module Issues
1. Rebuild manually: `yarn rebuild:native`
2. Check Node version compatibility
3. Ensure Xcode Command Line Tools installed (macOS)

### Dev Server Issues
1. Check for port conflicts: `lsof -i :3000`
2. Kill orphaned processes: `pkill -f "electron.*FileCataloger"`
3. Restart manually: `yarn dev`

## Performance Optimization

### Build Cache
The system maintains a build cache to avoid unnecessary rebuilds:
- Cache location: `/tmp/claude_fc_build_cache.json`
- Expiry: 5 minutes
- Invalidation: On file category changes

### Batching Strategy
- Collects changes for 3+ files before building
- Immediate build for critical files (package.json, native modules)
- Idle timeout triggers pending builds

### Resource Management
- Limits concurrent builds to 1
- Graceful server restart with connection draining
- Memory-efficient change tracking

## Development

### Adding New File Patterns
Edit `.claude/hooks/scripts/change-analyzer.js`:

```javascript
const FILE_PATTERNS = {
  myCategory: {
    patterns: [/\.custom$/],
    actions: ['build:custom'],
    priority: 5
  }
};
```

### Custom Build Commands
Modify `buildCommandSequence()` in `change-analyzer.js`:

```javascript
case 'custom':
  commands.push({
    cmd: 'yarn build:custom',
    description: 'Building custom modules',
    critical: true
  });
  break;
```

### Hook Debugging
Enable verbose logging:
```bash
export CLAUDE_HOOK_DEBUG=1
.claude/hooks/scripts/integrate-auto-rebuild.sh
```

## Best Practices

1. **Let the hook manage builds** - Avoid manual builds during active Claude sessions
2. **Review build output** - Check for warnings even on successful builds
3. **Clear state on issues** - Use `yarn clean` if builds become inconsistent
4. **Monitor performance** - Watch for slow builds and optimize as needed
5. **Keep dependencies updated** - Regular `yarn install` after package.json changes

## Integration with Claude Code

The hook system integrates seamlessly with Claude Code's workflow:

1. **PostToolUse**: Tracks changes after each edit
2. **PreCompact**: Processes pending changes before session compaction
3. **SessionEnd**: Final build and cleanup
4. **Automatic Quality Checks**: Runs typecheck and lint before builds

## Security Considerations

- Hooks run with user permissions
- Build commands are predefined (no arbitrary execution)
- Temporary files use secure paths
- Process management uses PID verification

## Contributing

To improve the hook system:
1. Test changes thoroughly
2. Update this documentation
3. Maintain backward compatibility
4. Follow existing code patterns

## License

Part of the FileCataloger project - MIT License