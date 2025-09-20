#!/usr/bin/env node

/**
 * @file validate-renderer.js
 * @description Validation script to detect common renderer issues before runtime
 * Checks for:
 * - React hooks dependency issues
 * - Circular dependencies
 * - Missing error boundaries
 * - Import issues between main/renderer
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Running renderer validation...\n');

let hasErrors = false;

// 1. Run ESLint with React hooks rules
console.log('1️⃣  Checking React hooks dependencies...');
try {
  execSync('yarn eslint src/renderer --ext .ts,.tsx --rule "react-hooks/exhaustive-deps: error" --max-warnings 0', {
    stdio: 'pipe',
  });
  console.log('   ✅ React hooks dependencies OK');
} catch (error) {
  console.log('   ❌ React hooks dependency errors found:');
  console.log(error.stdout?.toString() || error.message);
  hasErrors = true;
}

// 2. Check for circular dependencies
console.log('\n2️⃣  Checking for circular dependencies...');
try {
  const madgeOutput = execSync('npx madge --circular src/renderer', {
    stdio: 'pipe',
  }).toString();

  if (madgeOutput.includes('No circular dependency found')) {
    console.log('   ✅ No circular dependencies found');
  } else {
    console.log('   ❌ Circular dependencies detected:');
    console.log(madgeOutput);
    hasErrors = true;
  }
} catch (error) {
  // madge returns non-zero exit code when circular deps found
  if (error.stdout?.toString().includes('Circular dependencies found')) {
    console.log('   ❌ Circular dependencies detected:');
    console.log(error.stdout.toString());
    hasErrors = true;
  } else {
    console.log('   ⚠️  Could not check circular dependencies (install madge)');
  }
}

// 3. Check for main process imports in renderer
console.log('\n3️⃣  Checking for invalid main process imports...');
const rendererFiles = getAllFiles('src/renderer', ['.ts', '.tsx']);
const invalidImports = [];

rendererFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');

  // Check for direct main process imports
  if (content.includes('from \'@main/') || content.includes('from "@main/')) {
    if (!file.includes('.test.') && !file.includes('.spec.')) {
      invalidImports.push({
        file,
        type: 'main process import'
      });
    }
  }

  // Check for Node.js modules that shouldn't be in renderer
  const nodeModules = ['fs', 'path', 'child_process', 'os', 'crypto'];
  nodeModules.forEach(module => {
    const importRegex = new RegExp(`from ['"]${module}['"]`);
    const requireRegex = new RegExp(`require\\(['"]${module}['"]\\)`);

    if (importRegex.test(content) || requireRegex.test(content)) {
      if (!file.includes('preload') && !file.includes('.test.')) {
        invalidImports.push({
          file,
          type: `Node.js module: ${module}`
        });
      }
    }
  });
});

if (invalidImports.length === 0) {
  console.log('   ✅ No invalid imports found');
} else {
  console.log('   ❌ Invalid imports detected:');
  invalidImports.forEach(({ file, type }) => {
    console.log(`      ${file} - ${type}`);
  });
  hasErrors = true;
}

// 4. Check for error boundaries
console.log('\n4️⃣  Checking for error boundaries...');
const mainComponents = [
  'src/renderer/shelf.tsx',
  'src/renderer/index.tsx',
  'src/renderer/preferences.tsx'
];

let missingErrorBoundaries = [];
mainComponents.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    if (!content.includes('ErrorBoundary') && !content.includes('error boundary')) {
      missingErrorBoundaries.push(file);
    }
  }
});

if (missingErrorBoundaries.length === 0) {
  console.log('   ✅ Error boundaries present in main components');
} else {
  console.log('   ⚠️  Consider adding error boundaries to:');
  missingErrorBoundaries.forEach(file => {
    console.log(`      ${file}`);
  });
}

// 5. Check for useCallback/useEffect order issues
console.log('\n5️⃣  Checking for hook definition order issues...');
const hookOrderIssues = [];

rendererFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');

  // Look for patterns where a function is used before it's defined
  const useCallbackRegex = /const\s+(\w+)\s*=\s*useCallback\(/g;
  const callbacks = [];
  let match;

  while ((match = useCallbackRegex.exec(content)) !== null) {
    callbacks.push({
      name: match[1],
      position: match.index
    });
  }

  // Check if any callback references another callback that's defined later
  callbacks.forEach((callback, index) => {
    const callbackContent = content.slice(callback.position);
    const nextBracket = callbackContent.indexOf('}, [');
    if (nextBracket > -1) {
      const deps = callbackContent.slice(0, nextBracket);

      callbacks.slice(index + 1).forEach(laterCallback => {
        if (deps.includes(laterCallback.name)) {
          hookOrderIssues.push({
            file,
            issue: `${callback.name} references ${laterCallback.name} before it's defined`
          });
        }
      });
    }
  });
});

if (hookOrderIssues.length === 0) {
  console.log('   ✅ No hook definition order issues found');
} else {
  console.log('   ❌ Hook definition order issues:');
  hookOrderIssues.forEach(({ file, issue }) => {
    console.log(`      ${file} - ${issue}`);
  });
  hasErrors = true;
}

// 6. Run TypeScript type checking
console.log('\n6️⃣  Running TypeScript type checking...');
try {
  execSync('yarn tsc --noEmit', { stdio: 'pipe' });
  console.log('   ✅ TypeScript compilation successful');
} catch (error) {
  console.log('   ❌ TypeScript errors found:');
  console.log(error.stdout?.toString() || error.message);
  hasErrors = true;
}

// Helper function to get all files recursively
function getAllFiles(dirPath, extensions, files = []) {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('__tests__')) {
      getAllFiles(fullPath, extensions, files);
    } else if (stat.isFile() && extensions.some(ext => fullPath.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

// Final summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Validation failed! Fix the errors above before continuing.');
  process.exit(1);
} else {
  console.log('✅ Renderer validation passed!');
  console.log('\n💡 Run this script before commits to catch issues early:');
  console.log('   yarn validate:renderer');
}