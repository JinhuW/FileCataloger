# FileCataloger Build Scripts

This directory contains all build, validation, and development scripts for the FileCataloger project.

## 📁 Directory Structure

```
scripts/
├── native/                    # Native C++ module build system
│   ├── native-config.ts      # Module configuration
│   ├── build-native.ts       # Build orchestrator
│   └── README.md            # Detailed native build docs
│
├── install-native.js         # Smart native module installer
├── validate-native-build.js  # Module validation
├── validate-renderer.js      # Renderer code validation
├── test-native-modules.ts    # Comprehensive native module tests
├── claude-review.js          # AI code review integration
├── git-add-with-review.sh    # Git pre-commit with AI review
└── README.md                # This file
```

## 🚀 Key Scripts

### Native Module Management

| Script                     | Purpose                      | Usage                       |
| -------------------------- | ---------------------------- | --------------------------- |
| `install-native.js`        | Auto-installs native modules | `yarn install` (automatic)  |
| `validate-native-build.js` | Validates built modules      | `yarn test:native:validate` |
| `test-native-modules.ts`   | Full test suite              | `yarn test:native`          |
| `native/build-native.ts`   | Build orchestrator           | `yarn build:native`         |

### Development Tools

| Script                   | Purpose              | Usage                    |
| ------------------------ | -------------------- | ------------------------ |
| `validate-renderer.js`   | Checks renderer code | `yarn validate:renderer` |
| `claude-review.js`       | AI code review       | `yarn review`            |
| `git-add-with-review.sh` | Review before commit | `yarn git:add`           |

## 🔧 Common Tasks

### Building Native Modules

```bash
# Automatic (on install)
yarn install

# Manual rebuild
yarn build:native

# Clean rebuild
yarn build:native:clean

# Debug build issues
yarn build:native:verbose

# Validate modules work
yarn test:native:validate
```

### Code Quality

```bash
# Run all quality checks
yarn quality:check

# AI code review
yarn review

# Review staged files
yarn review:staged

# Git add with review
yarn git:add
```

### Testing

```bash
# All tests
yarn test

# Native module tests
yarn test:native

# Quick validation
yarn test:native:smoke

# Performance benchmarks
yarn test:native:benchmark
```

## 🏗️ Build Pipeline

The scripts work together in this flow:

```
yarn install
    └─> postinstall hook
        └─> install-native.js
            ├─> Try prebuild-install (downloads binaries)
            ├─> Try electron-rebuild (compiles for Electron)
            └─> Try manual build (node-gyp fallback)

yarn build
    └─> build:native (electron-rebuild)
    └─> build:renderer (webpack)
    └─> build:preload (webpack)
    └─> build:main (webpack)
        └─> Copies .node files to dist/

yarn dev
    └─> Runs built application
```

## 🎯 Script Features

### Smart Installation (`install-native.js`)

- **Three-tier fallback** ensures modules always build
- **Automatic Electron version detection**
- **Clear error messages** with troubleshooting steps
- **Zero configuration** for developers

### Build Orchestration (`native/build-native.ts`)

- **Parallel builds** for multiple modules
- **Platform-specific optimizations**
- **Centralized configuration**
- **Verbose debugging mode**

### Validation (`validate-native-build.js`)

- **File size checks** detect build failures
- **Module loading tests** ensure compatibility
- **Performance metrics** for optimization
- **Clear status reporting**

### AI Integration (`claude-review.js`)

- **Pre-commit code review**
- **Security vulnerability detection**
- **Best practices enforcement**
- **Automated suggestions**

## 🔍 Troubleshooting

### Native Module Issues

```bash
# Check if modules exist
ls -la dist/main/*.node

# Verify Electron compatibility
yarn native:check

# Full verbose rebuild
yarn clean && yarn build:native:verbose

# Manual module test
node -e "require('./dist/main/mouse_tracker_darwin.node')"
```

### Common Problems

1. **Build fails on install**
   - Install Xcode Command Line Tools: `xcode-select --install`
   - Check Python 3: `python3 --version`

2. **Modules not found**
   - Run full build: `yarn build`
   - Check dist directory: `ls dist/main/`

3. **Version mismatch**
   - Rebuild for current Electron: `yarn rebuild:native`

## 📚 Documentation

- [Native Build System](./native/README.md) - Detailed native module docs
- [Project README](../README.md) - Main project documentation
- [Native Modules](../src/native/README.md) - Module implementation details

## 🤝 Contributing

When adding new scripts:

1. Follow existing naming conventions
2. Add to appropriate `package.json` scripts
3. Document in this README
4. Include `--help` option if applicable
5. Add error handling and clear messages

## 📊 Performance

Script execution times (M1 Mac):

- `install-native.js`: ~5s (with cached binaries)
- `build-native.ts`: ~15s (clean build)
- `validate-native-build.js`: <1s
- `test-native-modules.ts`: ~10s (full suite)

---

_For detailed native module build documentation, see [native/README.md](./native/README.md)_
