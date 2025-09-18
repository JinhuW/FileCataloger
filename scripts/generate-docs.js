#!/usr/bin/env node

/**
 * Documentation Generator
 * Generates TypeDoc documentation for the project
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

function log(message, level = 'info') {
  const prefix = level === 'error' ? `${RED}❌` : level === 'warning' ? `${YELLOW}⚠️` : `${GREEN}✓`;
  const suffix = level !== 'info' ? RESET : '';
  console.log(`${prefix} ${message}${suffix}`);
}

console.log(`${GREEN}Generating Documentation...${RESET}\n`);

// Check if TypeDoc is installed
try {
  execSync('npx typedoc --version', { stdio: 'ignore' });
} catch (error) {
  log('TypeDoc is not installed. Installing...', 'warning');
  execSync('yarn add -D typedoc', { stdio: 'inherit' });
}

// Create TypeDoc configuration if it doesn't exist
const typeDocConfigPath = path.join(process.cwd(), 'typedoc.json');
if (!fs.existsSync(typeDocConfigPath)) {
  log('Creating TypeDoc configuration...', 'info');

  const config = {
    "$schema": "https://typedoc.org/schema.json",
    "entryPoints": ["src"],
    "entryPointStrategy": "expand",
    "out": "docs/api",
    "exclude": [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/*.test.ts",
      "**/*.spec.ts"
    ],
    "theme": "default",
    "name": "FileCataloger API Documentation",
    "includeVersion": true,
    "excludePrivate": true,
    "excludeProtected": false,
    "excludeInternal": true,
    "readme": "README.md",
    "plugin": [],
    "categorizeByGroup": true,
    "navigation": {
      "includeCategories": true,
      "includeGroups": true
    },
    "hideGenerator": false,
    "searchInComments": true
  };

  fs.writeFileSync(typeDocConfigPath, JSON.stringify(config, null, 2));
  log('TypeDoc configuration created', 'info');
}

// Generate documentation
log('Running TypeDoc...', 'info');

try {
  const output = execSync('npx typedoc', { encoding: 'utf-8' });
  console.log(output);

  // Check if documentation was generated
  const docsDir = path.join(process.cwd(), 'docs', 'api');
  if (fs.existsSync(docsDir)) {
    const files = fs.readdirSync(docsDir);
    if (files.length > 0) {
      log(`Documentation generated successfully in ${docsDir}`, 'info');

      // Count generated files
      let htmlCount = 0;
      let totalSize = 0;

      function countFiles(dir) {
        const entries = fs.readdirSync(dir);
        entries.forEach(entry => {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            countFiles(fullPath);
          } else if (entry.endsWith('.html')) {
            htmlCount++;
            totalSize += stat.size;
          }
        });
      }

      countFiles(docsDir);

      console.log(`\n${GREEN}Documentation Statistics:${RESET}`);
      console.log(`  - HTML files generated: ${htmlCount}`);
      console.log(`  - Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Output directory: ${docsDir}`);

      // Generate a simple index if it doesn't exist
      const indexPath = path.join(docsDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        log('Generating documentation index...', 'warning');
      }

    } else {
      log('No documentation files were generated', 'error');
      process.exit(1);
    }
  } else {
    log('Documentation directory was not created', 'error');
    process.exit(1);
  }

  // Generate markdown documentation summary
  console.log(`\n${GREEN}Generating documentation summary...${RESET}`);

  const summaryPath = path.join(process.cwd(), 'docs', 'SUMMARY.md');
  const summary = `# FileCataloger Documentation Summary

Generated: ${new Date().toISOString()}

## API Documentation
The full API documentation is available in \`docs/api/index.html\`.

## Quick Links
- [Main Process APIs](api/modules/main.html)
- [Renderer Process APIs](api/modules/renderer.html)
- [Native Modules](api/modules/native.html)
- [IPC Interfaces](api/interfaces.html)

## Architecture Overview
FileCataloger is built with:
- Electron for cross-platform desktop support
- TypeScript for type safety
- React for the UI layer
- Native C++ modules for system integration

## Key Modules
- **ApplicationController**: Main application orchestrator
- **ShelfManager**: Manages floating shelf windows
- **DragShakeDetector**: Detects shake gestures
- **PreferencesManager**: User settings management

## Getting Started
See README.md for installation and development instructions.
`;

  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, summary);
  log('Documentation summary created', 'info');

  console.log(`\n${GREEN}✅ Documentation generation completed successfully!${RESET}`);
  console.log(`\nTo view the documentation, open: ${path.join(docsDir, 'index.html')}`);

} catch (error) {
  log(`Documentation generation failed: ${error.message}`, 'error');
  console.error(error.toString());
  process.exit(1);
}