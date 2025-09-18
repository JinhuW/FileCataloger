#!/usr/bin/env node

/**
 * Check Electron main process files for security issues
 * Used by lint-staged for incremental checks
 */

const fs = require('fs');
const path = require('path');

// Get files from command line args (passed by lint-staged)
const files = process.argv.slice(2);

if (files.length === 0) {
  process.exit(0);
}

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let hasErrors = false;

// Security patterns to check
const securityPatterns = [
  {
    pattern: /eval\(/,
    message: 'Avoid using eval() in main process',
    severity: 'error'
  },
  {
    pattern: /Function\(['"`]/,
    message: 'Avoid dynamic Function constructor',
    severity: 'error'
  },
  {
    pattern: /child_process\.exec\(/,
    message: 'Use execFile instead of exec for security',
    severity: 'warning'
  },
  {
    pattern: /\.innerHTML\s*=/,
    message: 'Avoid innerHTML in main process',
    severity: 'warning'
  },
  {
    pattern: /document\.write/,
    message: 'Avoid document.write',
    severity: 'error'
  },
  {
    pattern: /nodeIntegration:\s*true/,
    message: 'nodeIntegration should be false',
    severity: 'error'
  },
  {
    pattern: /contextIsolation:\s*false/,
    message: 'contextIsolation should be true',
    severity: 'error'
  },
  {
    pattern: /webviewTag:\s*true/,
    message: 'webviewTag should be false unless required',
    severity: 'warning'
  }
];

files.forEach(file => {
  if (!fs.existsSync(file)) {
    return;
  }

  const content = fs.readFileSync(file, 'utf-8');
  const relativePath = path.relative(process.cwd(), file);

  securityPatterns.forEach(({ pattern, message, severity }) => {
    if (pattern.test(content)) {
      if (severity === 'error') {
        console.log(`${RED}❌ ${relativePath}: ${message}${RESET}`);
        hasErrors = true;
      } else {
        console.log(`${YELLOW}⚠️  ${relativePath}: ${message}${RESET}`);
      }
    }
  });
});

process.exit(hasErrors ? 1 : 0);