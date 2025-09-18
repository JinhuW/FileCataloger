#!/usr/bin/env node

/**
 * Native Module Checker
 * Validates that native modules are properly built and compatible
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let hasErrors = false;
let hasWarnings = false;

function log(message, level = 'info') {
  const prefix = level === 'error' ? `${RED}❌` : level === 'warning' ? `${YELLOW}⚠️` : `${GREEN}✓`;
  const suffix = level !== 'info' ? RESET : '';
  console.log(`${prefix} ${message}${suffix}`);
}

// Check if native modules directory exists
const nativeDir = path.join(__dirname, '..', 'src', 'native');
if (!fs.existsSync(nativeDir)) {
  log('No native modules directory found', 'warning');
  process.exit(0);
}

console.log(`${GREEN}Checking Native Modules...${RESET}\n`);

// Expected native modules
const expectedModules = [
  {
    name: 'mouse-tracker',
    buildDir: 'src/native/mouse-tracker/build/Release',
    binary: 'mouse_tracker_darwin.node',
    required: true
  },
  {
    name: 'drag-monitor',
    buildDir: 'src/native/drag-monitor/build/Release',
    binary: 'drag_monitor_darwin.node',
    required: false
  }
];

// Check each native module
expectedModules.forEach(module => {
  const buildPath = path.join(__dirname, '..', module.buildDir);
  const binaryPath = path.join(buildPath, module.binary);

  console.log(`Checking ${module.name}...`);

  // Check if build directory exists
  if (!fs.existsSync(buildPath)) {
    if (module.required) {
      log(`  Build directory missing: ${module.buildDir}`, 'error');
      hasErrors = true;
    } else {
      log(`  Build directory missing: ${module.buildDir}`, 'warning');
      hasWarnings = true;
    }
    return;
  }

  // Check if binary exists
  if (!fs.existsSync(binaryPath)) {
    if (module.required) {
      log(`  Binary not found: ${module.binary}`, 'error');
      log('  Run: yarn rebuild:native', 'info');
      hasErrors = true;
    } else {
      log(`  Binary not found: ${module.binary}`, 'warning');
      hasWarnings = true;
    }
    return;
  }

  // Check binary architecture
  try {
    const fileInfo = execSync(`file "${binaryPath}"`, { encoding: 'utf-8' });

    // Check for correct architecture
    if (process.arch === 'arm64' && !fileInfo.includes('arm64')) {
      log(`  Binary architecture mismatch (expected arm64)`, 'error');
      hasErrors = true;
    } else if (process.arch === 'x64' && !fileInfo.includes('x86_64')) {
      log(`  Binary architecture mismatch (expected x64)`, 'error');
      hasErrors = true;
    } else {
      log(`  Binary OK: ${module.binary}`, 'info');
    }

    // Check if it's a valid Mach-O binary (macOS)
    if (process.platform === 'darwin' && !fileInfo.includes('Mach-O')) {
      log(`  Invalid binary format (expected Mach-O)`, 'error');
      hasErrors = true;
    }
  } catch (error) {
    log(`  Could not verify binary: ${error.message}`, 'warning');
    hasWarnings = true;
  }
});

// Check node-gyp configuration
const gypFiles = [
  'src/native/mouse-tracker/binding.gyp',
  'src/native/drag-monitor/binding.gyp'
];

console.log(`\n${GREEN}Checking node-gyp configurations...${RESET}`);

gypFiles.forEach(gypFile => {
  const fullPath = path.join(__dirname, '..', gypFile);
  if (fs.existsSync(fullPath)) {
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      // Basic validation - check if it's valid JSON-like structure
      if (!content.includes('targets') || !content.includes('sources')) {
        log(`  Invalid binding.gyp: ${gypFile}`, 'warning');
        hasWarnings = true;
      } else {
        log(`  Valid: ${path.basename(gypFile)}`, 'info');
      }
    } catch (error) {
      log(`  Error reading ${gypFile}: ${error.message}`, 'warning');
      hasWarnings = true;
    }
  }
});

// Check Electron version compatibility
try {
  const packageJson = require('../package.json');
  const electronVersion = packageJson.devDependencies.electron;

  console.log(`\n${GREEN}Checking Electron compatibility...${RESET}`);
  log(`  Electron version: ${electronVersion}`, 'info');

  // Check if native modules were built for this Electron version
  const electronRebuildMarker = path.join(__dirname, '..', 'node_modules', '.electron-rebuild');
  if (!fs.existsSync(electronRebuildMarker)) {
    log('  Native modules may need rebuilding for current Electron version', 'warning');
    log('  Run: yarn rebuild:native', 'info');
    hasWarnings = true;
  }
} catch (error) {
  log('Could not check Electron compatibility', 'warning');
  hasWarnings = true;
}

// Check for common C++ issues
const cppFiles = [];
function findCppFiles(dir) {
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('build')) {
      findCppFiles(fullPath);
    } else if (file.match(/\.(cpp|cc|h|hpp)$/)) {
      cppFiles.push(fullPath);
    }
  });
}

findCppFiles(nativeDir);

if (cppFiles.length > 0) {
  console.log(`\n${GREEN}Checking C++ source files...${RESET}`);

  cppFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(process.cwd(), file);

    // Check for common issues
    if (content.includes('using namespace std;')) {
      log(`  ${relativePath}: Avoid 'using namespace std' in headers`, 'warning');
      hasWarnings = true;
    }

    if (content.match(/malloc\s*\(/)) {
      log(`  ${relativePath}: Consider using new/delete or smart pointers instead of malloc`, 'warning');
      hasWarnings = true;
    }

    if (!content.includes('#include') && file.endsWith('.h')) {
      log(`  ${relativePath}: Header file missing include guards`, 'warning');
      hasWarnings = true;
    }
  });
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log(`${RED}Native module check failed with errors.${RESET}`);
  console.log('Run: yarn rebuild:native');
  process.exit(1);
} else if (hasWarnings) {
  console.log(`${YELLOW}Native module check passed with warnings.${RESET}`);
  process.exit(0);
} else {
  console.log(`${GREEN}✅ All native module checks passed!${RESET}`);
  process.exit(0);
}