# Code Review Integration - Quick Start Guide

## 🚀 Quick Commands

### Review and Stage Files

```bash
# Add single file with review
yarn git:add src/main/index.ts

# Add all files with review
yarn git:add --all

# Skip review when needed
SKIP_REVIEW=1 git add .
```

### Review Without Staging

```bash
# Review specific files
yarn review src/main/index.ts src/renderer/App.tsx

# Review all staged files
yarn review:staged

# Review all modified files
node scripts/claude-review.js --all
```

## 📋 What Gets Reviewed

- ✅ TypeScript files (`.ts`, `.tsx`)
- ✅ JavaScript files (`.js`, `.jsx`)
- ✅ Maximum 10 files per review
- ❌ Test files are excluded
- ❌ `node_modules/` and `dist/` are excluded

## 🎯 Review Checks

| Check                          | Type       | Blocks Staging |
| ------------------------------ | ---------- | -------------- |
| TypeScript errors              | Critical   | ✅ Yes         |
| ESLint errors                  | Critical   | ✅ Yes         |
| Security issues (`eval`, etc.) | Critical   | ✅ Yes         |
| `console.log` usage            | Warning    | ❌ No          |
| Missing error handling         | Warning    | ❌ No          |
| TODO/FIXME comments            | Suggestion | ❌ No          |

## 🔄 Workflow

1. **Make changes** to your code
2. **Run review** with `yarn git:add <files>`
3. **Fix critical issues** if any are found
4. **Stage files** (automatic after successful review)
5. **Commit** with confidence

## 🆘 Emergency Override

When you need to bypass review (hotfixes, etc.):

```bash
# Method 1: Environment variable
SKIP_REVIEW=1 git add .

# Method 2: Standard git
git add --no-verify .
```

## 📊 View Reports

Review reports are saved automatically:

```bash
# List recent reports
ls -lt .claude/review-reports/ | head -5

# Open latest report (macOS)
open .claude/review-reports/review-*.md
```

## 🧹 Cache Management

Reviews are cached for 1 hour:

```bash
# Clear cache manually
rm -rf .claude/review-cache/*
```

## 🧪 Test Integration

Verify everything is working:

```bash
./scripts/test-review-integration.sh
```

## 📚 Full Documentation

See [docs/CODE_REVIEW_SETUP.md](docs/CODE_REVIEW_SETUP.md) for complete documentation.
