# Code Review Integration Setup

This document explains the automated code review system integrated with FileCataloger's development workflow.

## Overview

The code review system automatically analyzes TypeScript/JavaScript code before files are staged for commit. It uses Claude Code agents and automated checks to ensure code quality, security, and adherence to project standards.

## Components

### 1. Claude Code Agents

- **`code-reviewer`**: General TypeScript/Electron code review
- **`react-ui-reviewer`**: React component and UI code review

Located in `.claude/agents/`

### 2. Git Hooks

- **`pre-stage`**: Runs review before files are staged
- **`pre-commit`**: Existing quality checks (typecheck, lint, format)

Located in `.husky/`

### 3. Scripts

- **`git-add-with-review.sh`**: Wrapper for git add with automatic review
- **`claude-review.js`**: Node.js integration with review logic

Located in `scripts/`

## Installation

The system is already configured in the project. To ensure it's active:

```bash
# Install dependencies (includes husky)
yarn install

# Make scripts executable
chmod +x scripts/git-add-with-review.sh
chmod +x scripts/claude-review.js
chmod +x .husky/pre-stage

# Initialize review directories
mkdir -p .claude/review-cache .claude/review-reports
```

## Usage

### Basic Usage

#### Option 1: Use the wrapper script (recommended)

```bash
# Add files with automatic review
yarn git:add src/main/index.ts

# Add all modified files with review
yarn git:add --all

# Skip review when needed
yarn git:add --skip-review src/renderer/App.tsx
```

#### Option 2: Use Git aliases

First, include the local Git config:

```bash
# Add to your global .gitconfig
git config --global include.path /path/to/FileCataloger/.gitconfig.local
```

Then use the aliases:

```bash
# Add with review
git addr src/main/index.ts

# Add all with review
git addall

# Skip review (emergency use)
git addr-skip src/test.ts

# Review staged files
git review-staged

# View latest review report
git review-report
```

#### Option 3: Direct script usage

```bash
# Review specific files
yarn review src/main/index.ts src/renderer/App.tsx

# Review all staged files
yarn review:staged

# Review all modified files
node scripts/claude-review.js --all
```

### Bypassing Review

There are several ways to bypass the review when necessary:

```bash
# Method 1: Environment variable
SKIP_REVIEW=1 git add .

# Method 2: Wrapper script flag
./scripts/git-add-with-review.sh --skip-review .

# Method 3: Standard git (bypasses hook)
git add --no-verify .
```

**Note**: Bypassing review should only be done when absolutely necessary (e.g., fixing critical production issues).

## Review Process

### What Gets Reviewed

- TypeScript files (`*.ts`, `*.tsx`)
- JavaScript files (`*.js`, `*.jsx`)
- Maximum 10 files per review session

### What Gets Checked

1. **TypeScript Compilation**
   - Type safety
   - No implicit `any`
   - Proper type definitions

2. **Code Quality**
   - ESLint rules
   - Prettier formatting
   - Naming conventions

3. **Security**
   - No `eval()` or `new Function()`
   - Proper input validation
   - Safe HTML rendering

4. **Performance**
   - Async/await patterns
   - Memory leak prevention
   - Event listener cleanup

5. **Project Standards**
   - Use of Logger instead of console.log
   - CamelCase file naming
   - Path aliases usage

6. **Electron-Specific**
   - Process isolation
   - IPC security
   - Native module safety

### Review Results

Reviews produce three severity levels:

- **🚨 Critical Issues**: Must be fixed (blocks staging)
- **⚠️ Warnings**: Should be fixed (allows staging)
- **💡 Suggestions**: Consider fixing (informational)

## Cache Management

Reviews are cached for 1 hour to improve performance:

```bash
# Clear review cache
rm -rf .claude/review-cache/*

# Or use Git alias
git review-clean

# Force fresh review
./scripts/git-add-with-review.sh --force-review src/main/index.ts
```

## Reports

Review reports are saved in `.claude/review-reports/`:

```bash
# View latest reports
ls -lt .claude/review-reports/ | head -5

# Open latest report
open .claude/review-reports/review-*.md
```

## Configuration

### Hook Configuration

Edit `.claude/hooks/pre-stage-review.json`:

```json
{
  "config": {
    "maxFilesPerReview": 10,
    "cacheTimeout": 3600,
    "severityThreshold": "warning"
  }
}
```

### Exclude Patterns

Files matching these patterns are never reviewed:
- `node_modules/**`
- `dist/**`
- `*.test.ts`
- `*.spec.tsx`

## Troubleshooting

### Review Not Running

```bash
# Check hook is executable
ls -l .husky/pre-stage

# Test review directly
node scripts/claude-review.js src/main/index.ts

# Check for errors
cat .claude/review.log
```

### Cache Issues

```bash
# Clear all cache
rm -rf .claude/review-cache/*

# Check cache size
du -sh .claude/review-cache/
```

### Performance Issues

```bash
# Reduce files per review
# Edit .claude/hooks/pre-stage-review.json
# Set "maxFilesPerReview": 5
```

## Integration with CI/CD

For CI environments, the review is automatically skipped:

```yaml
# GitHub Actions example
- name: Run tests
  env:
    CI: true  # This skips the review
  run: yarn test
```

## Best Practices

1. **Fix Critical Issues Immediately**
   - Don't accumulate technical debt
   - Critical issues block commits for a reason

2. **Address Warnings Before PR**
   - Warnings indicate potential problems
   - Clean code before requesting review

3. **Consider Suggestions**
   - Suggestions improve code quality
   - Implement when time permits

4. **Keep Cache Clean**
   - Cache auto-cleans after 24 hours
   - Manual cleanup if needed

5. **Don't Disable Permanently**
   - Use `SKIP_REVIEW` sparingly
   - Re-enable after emergency fixes

## Advanced Usage

### Custom Review Agents

Create custom agents in `.claude/agents/`:

```markdown
---
name: custom-reviewer
description: Custom review for specific patterns
model: opus
color: purple
---

Your custom review instructions...
```

### Integrate with Pre-commit

The system works alongside existing pre-commit hooks:

```bash
# Full quality pipeline
yarn git:add .          # Review before staging
git commit -m "feat: x" # Pre-commit checks run
```

### Batch Review

Review multiple files efficiently:

```bash
# Review in batches
find src -name "*.ts" -type f | xargs -n 5 yarn review
```

## Support

For issues or questions:
1. Check this documentation
2. Review error messages in `.claude/review.log`
3. Check the project's CLAUDE.md for patterns
4. Consult team lead for project-specific rules