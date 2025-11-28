# Debug Notes

This file contains important debugging information to prevent recurring issues.

## Issue #1: Native Module Loading in Packaged Electron App (ASAR)

**Date**: 2025-11-27
**Severity**: CRITICAL
**Status**: FIXED

### Problem
When running the packaged Electron app (`.app` bundle with asar), native `.node` modules failed to load with error:
```
Cannot find module '/Users/.../FileCataloger.app/Contents/Resources/app.asar/dist/main/mouse_tracker_darwin.node'
```

###Root Cause
When Electron packages an app with asar:
1. JavaScript code is bundled into `app.asar` (a virtual filesystem)
2. Native `.node` files CANNOT be loaded from inside asar (binary modules need direct filesystem access)
3. Electron automatically unpacks files matching patterns in `forge.config.js` to `app.asar.unpacked/`
4. However, the `require()` calls in our code were using `__dirname`, which points to paths INSIDE the asar archive
5. The path `/path/to/app.asar/dist/main/module.node` is NOT the same as `/path/to/app.asar.unpacked/dist/main/module.node`

### Solution
Updated all four native module loaders to detect and transform asar paths:

**Files Modified:**
- `src/native/mouse-tracker/src/mouseTracker.ts`
- `src/native/mouse-tracker/src/mouseTrackerWin.ts`
- `src/native/drag-monitor/src/dragMonitor.ts`
- `src/native/drag-monitor/src/dragMonitorWin.ts`

**Fix Applied:**
```typescript
// Before (BROKEN in packaged app):
nativeModule = require(path.join(__dirname, 'module_name.node'));

// After (WORKS in packaged app):
let nativePath = path.join(__dirname, 'module_name.node');
// If running from asar, convert to .asar.unpacked path
if (nativePath.includes('.asar')) {
  nativePath = nativePath.replace(/\.asar([/\\])/i, '.asar.unpacked$1');
}
nativeModule = require(nativePath);
```

### Prevention
**DO NOT** make the following mistake again:
- ❌ Never assume `__dirname` points to the actual filesystem when loading native modules in packaged apps
- ✅ Always handle asar path transformation for `.node` files
- ✅ Test packaged apps (`yarn make:dmg`) before release, not just development mode (`yarn dev`)
- ✅ Check that `forge.config.js` has `asar: { unpack: '**/*.node' }`

### Testing Checklist
When adding new native modules:
1. ✅ Module builds correctly (`yarn build:native`)
2. ✅ Module loads in development mode (`yarn dev`)
3. ✅ Module is copied to `dist/main/` by webpack
4. ✅ Module is unpacked from asar in packaged app
5. ✅ Module loads correctly in packaged app (run the `.app` from `out/`)

### Related Configuration
- **Webpack**: `config/webpack/webpack.main.js` - CopyWebpackPlugin copies `.node` files to `dist/main/`
- **Forge**: `forge.config.js` - `asar: { unpack: '**/*.node' }` ensures native modules are unpacked
- **Module Loading**: All native module TypeScript files use 3-step fallback:
  1. Try development path: `../build/Release/module.node`
  2. Try production path: `./module.node`
  3. Try asar-aware path: `path.join(__dirname, 'module.node')` with `.asar` → `.asar.unpacked` transformation

### Lesson Learned
Electron's asar packaging is transparent for JavaScript but NOT for native modules. Always account for the `app.asar.unpacked/` directory when requiring `.node` files.
