# Native Module Build System

This directory contains the unified build system for FileCataloger's native C++ modules. It provides centralized configuration, automated building, and intelligent installation strategies.

## 🏗️ Architecture Overview

```
scripts/native/
├── native-config.ts      # Centralized configuration for all native modules
├── build-native.ts       # Unified build orchestrator
├── README.md            # This file
└── dist/                # Compiled JavaScript (auto-generated)
```

## 🚀 Quick Start

```bash
# Automatic installation (runs on yarn install)
yarn install

# Manual rebuild all native modules
yarn build:native

# Clean rebuild (removes artifacts first)
yarn build:native:clean

# Build specific module
yarn build:native --module=mouse-tracker

# Verbose output for debugging
yarn build:native:verbose
```

## 📋 Module Configuration

All native modules are defined in `native-config.ts`:

```typescript
export const NATIVE_MODULES: NativeModuleConfig[] = [
  {
    name: 'mouse-tracker',
    displayName: 'Mouse Tracker',
    platforms: ['darwin'],
    buildPath: path.join(NATIVE_ROOT, 'mouse-tracker', 'darwin'),
    binding: 'binding.gyp',
    targetName: 'mouse_tracker_darwin',
    buildArgs: ['--release', '--verbose'],
    postBuild: ['cp build/Release/*.node ../../'],
  },
  // Add more modules here...
];
```

## 🔧 Build System Features

### 1. **Multi-Strategy Installation** (`install-native.js`)

The installer tries three strategies in order:

1. **Prebuild Download** - Fastest, downloads pre-compiled binaries
2. **Electron Rebuild** - Compiles for your exact Electron version
3. **Manual Build** - Direct node-gyp compilation as fallback

### 2. **Unified Build Process** (`build-native.ts`)

- **Parallel Builds**: Compile multiple modules simultaneously
- **Clean Builds**: Remove artifacts before building
- **Selective Building**: Build only specific modules
- **Verbose Logging**: Detailed output for troubleshooting

### 3. **Platform-Specific Optimization**

Each platform has optimized compiler settings:

```typescript
'darwin-arm64': {
  compiler: 'clang++',
  flags: [
    '-O3',               // Maximum optimization
    '-ffast-math',       // Fast floating-point
    '-march=native',     // CPU-specific optimizations
    '-std=c++17',        // Modern C++
    '-fobjc-arc'         // Automatic Reference Counting
  ]
}
```

## 🛠️ Adding a New Native Module

1. **Create module structure**:

   ```
   src/native/your-module/
   ├── binding.gyp          # Build configuration
   ├── your_module.cc       # C++ implementation
   └── index.ts             # TypeScript wrapper
   ```

2. **Add to configuration** (`native-config.ts`):

   ```typescript
   {
     name: 'your-module',
     displayName: 'Your Module',
     platforms: ['darwin', 'win32', 'linux'],
     buildPath: path.join(NATIVE_ROOT, 'your-module'),
     binding: 'binding.gyp',
     targetName: 'your_module'
   }
   ```

3. **Build and test**:
   ```bash
   yarn build:native --module=your-module
   yarn test:native:validate
   ```

## 🔍 Validation

The build system includes automatic validation:

```bash
# Validate all built modules
yarn test:native:validate

# Output:
# ✅ Mouse Tracker: 79KB - Loaded successfully
# ✅ Drag Monitor: 112KB - Loaded successfully
```

## 🐛 Troubleshooting

### Build Failures

1. **Check prerequisites**:

   ```bash
   # macOS
   xcode-select --install

   # Install node-gyp globally
   npm install -g node-gyp

   # Verify Python 3.x
   python3 --version
   ```

2. **Clean rebuild**:

   ```bash
   yarn clean
   yarn build:native:clean
   ```

3. **Verbose debugging**:
   ```bash
   yarn build:native:verbose
   ```

### Module Loading Errors

1. **Check Electron version compatibility**:

   ```bash
   yarn native:check
   ```

2. **Verify module locations**:

   ```bash
   ls -la dist/main/*.node
   ```

3. **Test module directly**:
   ```bash
   node -e "require('./dist/main/mouse_tracker_darwin.node')"
   ```

## 📊 Performance Optimizations

The build system applies several optimizations automatically:

- **Link-Time Optimization (LTO)**: Whole-program optimization
- **Fast Math**: Relaxed floating-point for speed
- **CPU-Specific Instructions**: Uses native CPU features
- **Memory Pooling**: Reduces allocations in hot paths
- **Event Batching**: Limits callback frequency

## 🔒 Security Considerations

- Native modules run with full system access
- Code signing required for distribution
- Accessibility permissions needed for input monitoring
- Sandboxing partially disabled for native module access

## 📦 Distribution

For production builds:

```bash
# Build for distribution
yarn dist

# Platform-specific builds
yarn dist:mac:arm64    # Apple Silicon
yarn dist:mac:x64      # Intel Macs
```

## 🤝 Contributing

When modifying the build system:

1. Update `native-config.ts` for configuration changes
2. Test with all modules: `yarn build:native:clean`
3. Verify validation passes: `yarn test:native:validate`
4. Document any new build flags or options

## 📚 Related Documentation

- [Native Module Architecture](../../src/native/README.md)
- [Mouse Tracker Module](../../src/native/mouse-tracker/README.md)
- [Drag Monitor Module](../../src/native/drag-monitor/README.md)
- [Electron Native Modules Guide](https://www.electronjs.org/docs/tutorial/using-native-node-modules)

## 🎯 Design Goals

1. **Zero Configuration**: Works out of the box with `yarn install`
2. **Fast Iteration**: Quick rebuilds during development
3. **Reliable CI/CD**: Consistent builds across environments
4. **Easy Debugging**: Clear error messages and logging
5. **Future-Proof**: Easy to add new modules and platforms

## 📈 Metrics

Current module sizes (optimized):

- Mouse Tracker: ~79KB
- Drag Monitor: ~112KB

Build times (M1 Mac):

- Clean build: ~15 seconds
- Incremental: ~3 seconds
- Parallel build: ~8 seconds (both modules)

## 🆘 Support

If you encounter issues:

1. Check this README first
2. Run validation: `yarn test:native:validate`
3. Enable verbose mode: `yarn build:native:verbose`
4. Check [DEBUG_NOTES.md](../../DEBUG_NOTES.md) for known issues
5. Open an issue with full error output

---

_Last updated: 2024_
