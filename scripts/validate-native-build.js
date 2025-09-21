#!/usr/bin/env node
/**
 * @fileoverview Simple native module build validation
 *
 * This script validates that native modules are built correctly and can be loaded.
 * It's a simple alternative to the comprehensive TypeScript test suite.
 */

const fs = require('fs');
const path = require('path');

function validateNativeModules() {
  console.log('🔍 Validating native module builds...');

  const projectRoot = path.resolve(__dirname, '..');
  const distMain = path.join(projectRoot, 'dist', 'main');

  // Check if dist/main directory exists
  if (!fs.existsSync(distMain)) {
    console.error('❌ dist/main directory not found. Run: npm run build');
    return false;
  }

  // Check native modules
  const modules = [
    { name: 'mouse_tracker_darwin.node', description: 'Optimized Mouse Tracker' },
    { name: 'drag_monitor_darwin.node', description: 'Drag Monitor' }
  ];

  let allValid = true;

  for (const module of modules) {
    const modulePath = path.join(distMain, module.name);

    if (!fs.existsSync(modulePath)) {
      console.error(`❌ ${module.description}: ${module.name} not found`);
      allValid = false;
      continue;
    }

    const stats = fs.statSync(modulePath);
    const sizeKB = Math.round(stats.size / 1024);

    if (stats.size < 10000) {
      console.error(`❌ ${module.description}: File too small (${sizeKB}KB) - likely build error`);
      allValid = false;
      continue;
    }

    // Try to load the module
    try {
      const loadedModule = require(modulePath);
      if (!loadedModule) {
        throw new Error('Module exports are empty');
      }
      console.log(`✅ ${module.description}: ${sizeKB}KB - Loaded successfully`);
    } catch (error) {
      console.error(`❌ ${module.description}: Failed to load - ${error.message}`);
      allValid = false;
    }
  }

  return allValid;
}

function showBuildInstructions() {
  console.log('\\n📋 Build Instructions:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1. Build native modules:    npm run build:native');
  console.log('2. Build full application:  npm run build');
  console.log('3. Run application:         npm run dev');
  console.log('\\n🔧 Individual module builds:');
  console.log('   cd src/native/mouse-tracker/darwin && node-gyp rebuild');
  console.log('   cd src/native/drag-monitor && node-gyp rebuild');
  console.log('\\n🧪 Testing:');
  console.log('   node scripts/validate-native-build.js');
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showBuildInstructions();
    process.exit(0);
  }

  console.log('🏗️  FileCataloger Native Module Validator');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const valid = validateNativeModules();

  if (valid) {
    console.log('\\n🎉 All native modules validated successfully!');
    console.log('✅ Ready for development and production use');
    process.exit(0);
  } else {
    console.log('\\n❌ Native module validation failed');
    showBuildInstructions();
    process.exit(1);
  }
}

main();