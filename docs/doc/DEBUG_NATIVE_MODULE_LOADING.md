# Debug: Comprehensive Native Module Loading Analysis

## The Problem

Native modules (`.node` files) fail to load despite being present in the filesystem, with errors such as:

```
Failed to load native module. Tried paths: [multiple paths]
Module did not self-register
Cannot find module './mouse_tracker_darwin.node'
```

This issue occurs even when:

- The `.node` file exists in the expected location
- File permissions are correct
- The module was successfully built with `node-gyp`

## Root Cause Analysis

The native module loading failure stems from multiple interconnected issues related to webpack bundling, path resolution, and Electron's module loading context:

### 1. Webpack Module Resolution vs Node.js require()

**Issue**: Webpack's module resolution system differs fundamentally from Node.js's native `require()` function:

- **Webpack bundling**: During compilation, webpack processes `require()` statements and attempts to bundle or externalize modules
- **Native modules**: `.node` files cannot be bundled by webpack and must be loaded at runtime
- **Path resolution**: Webpack resolves paths at compile-time, while `.node` files need runtime path resolution

**Evidence**: In `webpack.main.config.js`, native modules are externalized:

```javascript
externals: {
  './mouse_tracker_darwin.node': 'commonjs ./mouse_tracker_darwin.node',
  './drag_monitor_darwin.node': 'commonjs ./drag_monitor_darwin.node'
}
```

### 2. \_\_dirname Context Mismatch

**Issue**: In webpack-compiled code, `__dirname` points to the compiled output directory (`dist/main`), not the source location:

- **Expected**: `src/native/mouse-tracker/darwin/build/Release/`
- **Actual**: `dist/main/` (after webpack compilation)
- **Impact**: Relative path calculations fail because the reference point is incorrect

**Evidence**: The `DarwinNativeTracker.loadNativeModule()` method shows multiple path resolution attempts:

```typescript
// This fails because __dirname is dist/main, not the source location
path.join(__dirname, moduleName);
```

### 3. Electron vs Node.js Module Loading Context

**Issue**: Electron's module loading context differs from standard Node.js:

- **App packaging**: Different paths in development vs production (app.asar)
- **Resource paths**: Native modules must be in `app.asar.unpacked` in production
- **Permission model**: Electron's sandboxing affects module loading
- **Context isolation**: Main process vs renderer process module access

## Failed Approaches and Why They Don't Work

### 1. Direct require() with Relative Paths

```typescript
// ❌ FAILS: Relative to wrong __dirname after webpack compilation
const nativeModule = require('./mouse_tracker_darwin.node');
```

**Why it fails**: `__dirname` points to `dist/main` instead of source location

### 2. Using \_\_dirname for Path Construction

```typescript
// ❌ FAILS: __dirname context is wrong after webpack bundling
const modulePath = path.join(__dirname, '..', '..', 'native', 'mouse_tracker_darwin.node');
```

**Why it fails**: Webpack changes the execution context, making `__dirname` unreliable

### 3. process.cwd() Based Paths

```typescript
// ❌ UNRELIABLE: Working directory can change
const modulePath = path.join(process.cwd(), 'src', 'native', 'mouse_tracker_darwin.node');
```

**Why it fails**: `process.cwd()` depends on where the process was started, not where the code is

### 4. Static Path Assumptions

```typescript
// ❌ FRAGILE: Breaks in different environments
const modulePath = '/absolute/path/to/mouse_tracker_darwin.node';
```

**Why it fails**: Different paths in development, production, and across machines

## Working Solution Approach

The successful approach implemented in `darwin-native-tracker.ts` uses a comprehensive path resolution strategy:

### 1. app.getAppPath() for Reliable Base Path

```typescript
const appPath = app ? app.getAppPath() : process.cwd();
```

**Why it works**: `app.getAppPath()` provides consistent base path regardless of webpack compilation

### 2. Multiple Path Resolution Strategy

```typescript
const paths: string[] = [];

// Production paths (packaged app)
if (app && app.isPackaged) {
  const resourcesPath = process.resourcesPath || '';
  paths.push(
    path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'native', 'mouse-tracker', moduleName),
    path.join(resourcesPath, 'app', 'dist', 'native', 'mouse-tracker', moduleName)
  );
}

// Development paths
paths.push(
  // From dist directory (webpack output)
  path.join(appPath, 'dist', 'native', 'mouse-tracker', moduleName),
  // From build directory (development)
  path.join(appPath, 'src', 'native', 'mouse-tracker', 'darwin', 'build', 'Release', moduleName)
);
```

### 3. File Existence Check Before require()

```typescript
const uniquePaths = [...new Set(paths)].filter(p => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
});
```

**Why it's essential**: Prevents require() failures on non-existent files

### 4. Comprehensive Error Handling with Diagnostics

```typescript
for (const modulePath of uniquePaths) {
  try {
    const nativeModule = require(modulePath);
    console.log('✅ Successfully loaded native module from:', modulePath);
    return nativeModule;
  } catch (err) {
    console.log(`❌ Failed to load from ${modulePath}:`, (err as Error).message);
  }
}
```

### 5. Webpack Integration via CopyWebpackPlugin

```javascript
// webpack.main.config.js
new CopyWebpackPlugin({
  patterns: [
    {
      from: path.join(
        __dirname,
        'src/native/mouse-tracker/darwin/build/Release/mouse_tracker_darwin.node'
      ),
      to: path.join(__dirname, 'dist/native/mouse-tracker/mouse_tracker_darwin.node'),
      noErrorOnMissing: true,
    },
  ],
});
```

**Purpose**: Ensures native modules are copied to predictable locations in the dist directory

## Additional Complexity: ABI Compatibility

Beyond path resolution, native modules must be compiled for the correct runtime:

### Node.js vs Electron ABI Mismatch

- **Problem**: Native modules built for Node.js won't work with Electron's V8 version
- **Solution**: Rebuild for Electron's specific version

```bash
cd src/native/mouse-tracker/darwin
node-gyp rebuild --target=37.4.0 --arch=arm64 --dist-url=https://electronjs.org/headers
```

## Important Notes for Future Development

### 1. Path Resolution Strategy

- **Always use app.getAppPath()** as the base for path calculations in Electron main process
- **Never rely on \_\_dirname** after webpack compilation
- **Always check file existence** before attempting to require() native modules
- **Implement fallback paths** for different environments (dev/prod/packaged)

### 2. Webpack Configuration Requirements

- **Externalize native modules** in webpack config
- **Use CopyWebpackPlugin** to move .node files to predictable locations
- **Set node: { \_\_dirname: false }** to preserve original \_\_dirname behavior where possible

### 3. Build Process Dependencies

- **Native modules must be rebuilt** for Electron's specific version
- **Rebuild required after** Node.js/Electron version changes
- **Architecture-specific builds** needed (arm64 vs x64)

### 4. Error Handling Best Practices

- **Implement graceful degradation** when native modules fail to load
- **Provide diagnostic information** about attempted paths
- **Check for common issues** (permissions, ABI mismatch, missing dependencies)

### 5. Development vs Production Differences

- **Development**: Modules loaded from `src/native/.../build/Release/`
- **Production (packaged)**: Modules loaded from `app.asar.unpacked/dist/native/`
- **Production (unpackaged)**: Modules loaded from `dist/native/`

### 6. Debugging Checklist

When native module loading fails:

1. ✅ Verify the .node file exists at expected paths
2. ✅ Check file permissions (should be executable)
3. ✅ Confirm ABI compatibility (rebuilt for correct Electron version)
4. ✅ Validate webpack externals configuration
5. ✅ Test CopyWebpackPlugin is copying files correctly
6. ✅ Check if app has necessary system permissions (e.g., Accessibility on macOS)
7. ✅ Verify no missing native dependencies (ldd on Linux, otool on macOS)

## Prevention Strategies

### 1. Automated Testing

```bash
# Add to package.json scripts
"test:native": "node -e \"console.log(require('./dist/native/mouse-tracker/mouse_tracker_darwin.node'))\""
```

### 2. CI/CD Integration

- Include native module building in CI pipeline
- Test module loading in different environments
- Validate both development and production scenarios

### 3. Documentation

- Document native module dependencies clearly
- Include platform-specific build instructions
- Maintain troubleshooting guides for common issues

This comprehensive analysis should prevent similar native module loading issues by addressing the root causes: webpack compilation context changes, path resolution complexity, and the multi-environment nature of Electron applications.
