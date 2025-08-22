# 📝 Changelog and Release Guide

This project uses automated changelog generation and release management with emoji commits support.

## 🎯 Commit Message Format

We use [Gitmoji](https://gitmoji.dev/) convention for commit messages with emojis. Examples:

```
✨ feat: add new file cataloging feature
🐛 fix: resolve memory leak in file scanner
📝 docs: update API documentation
♻️ refactor: improve file processing logic
🎨 style: format code with prettier
🧪 test: add unit tests for file analyzer
🔧 chore: update dependencies
```

## 📦 Release Process

### 1. Create a Changeset

When you make changes that should be included in the next release:

```bash
yarn changeset
```

This will prompt you to:

- Select which type of change (patch, minor, major)
- Write a summary of the changes
- Generate a changeset file

### 2. Version and Publish

The release process is automated via GitHub Actions, but you can also run it manually:

```bash
# Update versions and generate changelog
yarn changeset:version

# Publish release (after building)
yarn release
```

## 🤖 Automated Workflows

### Release Workflow

- Triggered on pushes to `main` branch
- Runs tests, lint, and typecheck
- Creates release PRs or publishes releases automatically
- Uses changesets to manage versions and changelogs

### Changelog Workflow

- Triggered on version tags (`v*`)
- Generates GitHub releases with changelogs
- Can be manually triggered via GitHub Actions

## 📋 Changeset Types

- **patch** 🐛: Bug fixes, small improvements
- **minor** ✨: New features, backward-compatible changes
- **major** 💥: Breaking changes

## 🔧 Configuration

- **Commitlint**: `.commitlint.config.js` - Validates commit messages
- **Changesets**: `.changeset/config.json` - Release configuration
- **Husky**: `.husky/` - Git hooks for automation

## 🎯 Best Practices

1. **Always use emojis** in commit messages for better readability
2. **Create changesets** for any user-facing changes
3. **Follow semantic versioning** when selecting changeset types
4. **Write clear summaries** in changesets for better changelogs
5. **Review generated changelogs** before publishing releases

## 🚀 Quick Start

1. Make your changes
2. Commit with emoji format: `✨ feat: your change description`
3. Run `yarn changeset` to document the change
4. Push to main branch
5. GitHub Actions will handle the rest!
