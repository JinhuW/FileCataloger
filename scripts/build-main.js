#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

console.log('🔨 Building main process...');

// Clean dist directory (main process parts)
const distPath = path.join(__dirname, '..', 'dist');
// Only remove main process directories, keep renderer
fs.removeSync(path.join(distPath, 'main'));
fs.removeSync(path.join(distPath, 'native'));
fs.removeSync(path.join(distPath, 'shared'));
fs.ensureDirSync(distPath);

// Compile TypeScript
console.log('📦 Compiling TypeScript...');
execSync('npx tsc -p tsconfig.main.json', { stdio: 'inherit' });

// Copy native modules
console.log('🔗 Copying native modules...');
const nativeModules = [
  {
    from: 'src/native/drag-monitor/build/Release/drag_monitor_darwin.node',
    to: 'dist/native/drag-monitor/drag_monitor_darwin.node'
  },
  {
    from: 'src/native/mouse-tracker/darwin/build/Release/mouse_tracker_darwin.node', 
    to: 'dist/native/mouse-tracker/mouse_tracker_darwin.node'
  }
];

for (const module of nativeModules) {
  const sourcePath = path.join(__dirname, '..', module.from);
  const destPath = path.join(__dirname, '..', module.to);
  
  if (fs.existsSync(sourcePath)) {
    fs.ensureDirSync(path.dirname(destPath));
    fs.copySync(sourcePath, destPath);
    console.log(`✅ Copied ${path.basename(sourcePath)}`);
  } else {
    console.warn(`⚠️  Native module not found: ${sourcePath}`);
    console.warn('   Run: npm run rebuild:native');
  }
}

// Copy package.json for native module resolution
const packageJson = require('../package.json');
const mainPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  main: 'index.js',
  dependencies: packageJson.dependencies
};

fs.writeJsonSync(
  path.join(distPath, 'main', 'package.json'),
  mainPackageJson,
  { spaces: 2 }
);

console.log('✅ Main process build complete!');