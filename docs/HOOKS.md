# Code Quality Hooks Documentation

This document describes the comprehensive code quality hook system implemented for the FileCataloger project.

## Overview

The project uses a multi-layered approach to ensure code quality:
- **Husky**: Git hooks management
- **lint-staged**: Run checks only on staged files
- **commitlint**: Enforce commit message conventions
- **Custom scripts**: Specialized checks for Electron, native modules, and documentation

## Installation

The hooks are automatically installed when you run:
```bash
yarn install
```

## Git Hooks

### Pre-commit Hook
Runs before each commit to ensure code quality:
1. **Native Module Check**: Validates native C++ modules are built correctly
2. **Lint-staged**: Runs targeted checks on staged files
3. **TypeScript Check**: Full project type checking
4. **Security Check**: Electron security best practices
5. **Documentation Validation**: Checks JSDoc completeness
6. **Dependency Check**: Validates package.json dependencies

### Commit-msg Hook
Validates commit message format using commitlint.

**Commit Message Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding/updating tests
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes
- `revert`: Reverting a previous commit
- `native`: Native C++ module changes
- `security`: Security fixes/improvements
- `deps`: Dependency updates

**Scopes:**
- `main`: Main process
- `renderer`: Renderer process
- `preload`: Preload scripts
- `native`: Native modules
- `shelf`: Shelf functionality
- `drag`: Drag detection
- `prefs`: Preferences
- `build`: Build configuration
- `deps`: Dependencies
- `docs`: Documentation
- `tests`: Test files
- `config`: Configuration

**Example:**
```
feat(shelf): add auto-hide functionality for empty shelves

Shelves now automatically hide after 5 seconds when empty.
This improves the user experience by reducing clutter.

Closes #123
```

### Pre-push Hook
Runs comprehensive checks before pushing:
1. Full project build
2. Test suite execution
3. Native module validation
4. Security audit
5. Documentation validation

## Lint-staged Configuration

The `.lintstagedrc.json` file configures file-specific checks:

### TypeScript/TSX Files
- Prettier formatting
- ESLint fixing
- TypeScript type checking

### JavaScript/JSX Files
- Prettier formatting
- ESLint fixing

### JSON/CSS/Markdown Files
- Prettier formatting

### Main Process TypeScript Files
- Additional Electron security checks

### Native C++ Files
- C++ code quality checks
- Memory leak detection
- Include guard validation

## Quality Check Scripts

### Security Check (`yarn security:check`)
Validates Electron security best practices:
- Context isolation enabled
- Node integration disabled
- Web security enabled
- CSP headers present
- Sandbox mode configuration

### Native Module Check (`yarn native:check`)
Validates native modules:
- Binary files exist
- Architecture compatibility (arm64/x64)
- Node-gyp configuration
- Electron version compatibility

### Documentation Validation (`yarn docs:validate`)
Checks documentation completeness:
- JSDoc comments for exported functions/classes
- README.md and CLAUDE.md presence
- Package.json documentation fields
- TypeScript documentation coverage

### Documentation Generation (`yarn docs:generate`)
Generates API documentation using TypeDoc:
- Creates HTML documentation in `docs/api/`
- Generates documentation summary
- Configures navigation and search

### Dependency Check (`yarn deps:check`)
Validates dependencies:
- Duplicate dependency detection
- Security vulnerability scanning
- Unused dependency detection
- Outdated package checking
- Peer dependency validation

## Running Checks Manually

### Run All Checks
```bash
yarn quality:check
```

### Individual Checks
```bash
# TypeScript type checking
yarn typecheck

# ESLint
yarn lint
yarn lint:fix

# Prettier formatting
yarn format
yarn format:check

# Security
yarn security:check

# Native modules
yarn native:check

# Documentation
yarn docs:validate
yarn docs:generate

# Dependencies
yarn deps:check
```

## Bypassing Hooks (Emergency Only)

If you need to bypass hooks in an emergency:
```bash
# Bypass pre-commit hook
git commit --no-verify -m "emergency: message"

# Bypass pre-push hook
git push --no-verify
```

**⚠️ Warning**: Only bypass hooks in genuine emergencies. Always fix issues properly afterward.

## Troubleshooting

### Native Module Build Errors
```bash
# Rebuild native modules
yarn rebuild:native

# Full rebuild
cd src/native/mouse-tracker/darwin
node-gyp rebuild
```

### Hook Not Running
```bash
# Reinstall husky
yarn husky install
```

### TypeScript Errors
```bash
# Check for type errors
yarn typecheck

# Update TypeScript definitions
yarn add -D @types/node@latest
```

### Security Warnings
Review the security warnings and either:
1. Fix the security issue
2. Add an exception with documentation if the risk is acceptable

## Configuration Files

- `.husky/`: Git hooks
- `.lintstagedrc.json`: Lint-staged configuration
- `commitlint.config.js`: Commit message rules
- `.eslintrc.js`: ESLint rules
- `.prettierrc`: Prettier formatting rules
- `scripts/`: Custom validation scripts

## Best Practices

1. **Always run checks before committing**: Let the pre-commit hook do its job
2. **Write clear commit messages**: Follow the conventional format
3. **Keep dependencies updated**: Run `yarn deps:check` regularly
4. **Document your code**: Add JSDoc comments to exported functions
5. **Test thoroughly**: Especially after modifying native modules
6. **Review security warnings**: Don't ignore security checks

## Adding New Checks

To add a new check:

1. Create a script in `scripts/`
2. Add a package.json script
3. Update lint-staged configuration if needed
4. Add to pre-commit or pre-push hook
5. Document in this file

## Support

For issues with the hooks system:
1. Check this documentation
2. Review error messages carefully
3. Run individual checks to isolate problems
4. Check git hook logs in `.husky/`