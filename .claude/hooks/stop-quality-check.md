# Stop Quality Check Hook

## Overview
This hook runs automatically when Claude Code is interrupted (CTRL+C or stop button) to perform quality checks on the FileCataloger codebase and provide actionable feedback.

## Configuration
The hook is configured in `.claude/settings.local.json`:

```json
"Stop": [
  {
    "matcher": ".*",
    "hooks": [
      {
        "type": "command",
        "command": "/Users/jinhu/Development/File_Cataloger_Project/FileCataloger/.claude/scripts/stop-quality-check.sh",
        "timeout": 3000
      }
    ]
  }
]
```

## Scripts

### Main Script: `stop-quality-check.sh`
- **Purpose**: Runs essential quality checks (TypeScript, ESLint, Prettier)
- **Exit Code**: Always returns 0 (non-blocking)
- **Output**: Reports issues and provides Claude Code with fix commands
- **Timeout**: 3 seconds (configured in hook)

### Aggressive Script: `stop-quality-check-aggressive.sh`
- **Purpose**: More detailed prompting for Claude Code to fix issues
- **Usage**: Can be swapped in for more aggressive auto-fix prompting
- **Features**: Creates quick-fix scripts and detailed action lists

## Checks Performed

1. **TypeScript** (`yarn typecheck`)
   - Critical check for type errors
   - Must pass for code integrity

2. **ESLint** (`yarn lint`)
   - Critical check for code quality
   - Provides auto-fix suggestions

3. **Prettier** (`yarn format:check`)
   - Warning check for code formatting
   - Auto-fixable with `yarn format`

4. **Console.log Detection**
   - Checks for console.log usage (should use Logger module)
   - Lists files needing updates

## Fix Commands

When issues are found, the script provides Claude Code with specific commands:

- `yarn lint --fix` - Auto-fix ESLint issues
- `yarn format` - Auto-format with Prettier
- `yarn typecheck` - Review TypeScript errors
- `yarn quality:check` - Run all checks after fixes

## Troubleshooting

### Issue: Hook fails with status code 1
**Solution**: Scripts now fixed to always exit with 0

### Issue: No output from hook
**Cause**: Script might be timing out
**Solution**: The 3-second timeout is sufficient for basic checks

### Issue: Hook not running
**Check**: Ensure `.claude/settings.local.json` contains the Stop hook configuration

## Testing

To test the hook manually:
```bash
# Run the script directly
bash .claude/scripts/stop-quality-check.sh

# Check exit code
echo $?  # Should be 0
```

## Notes

- The hook is non-blocking: issues are reported but don't prevent Claude Code from stopping
- The script continues running checks even if some fail
- All output is designed to prompt Claude Code for automatic fixes
- The script creates a log file at `/tmp/fc_quality_check.log` for debugging