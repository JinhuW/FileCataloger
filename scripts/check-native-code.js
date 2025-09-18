#!/usr/bin/env node

/**
 * Native C++ Code Checker
 * Used by lint-staged to check C++ files
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
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let hasErrors = false;
let hasWarnings = false;

// C++ code quality patterns
const cppPatterns = [
  {
    pattern: /\bmalloc\s*\(/,
    message: 'Use new/delete or smart pointers instead of malloc/free',
    severity: 'warning'
  },
  {
    pattern: /\bfree\s*\(/,
    message: 'Use new/delete or smart pointers instead of malloc/free',
    severity: 'warning'
  },
  {
    pattern: /using\s+namespace\s+std\s*;/,
    message: 'Avoid "using namespace std;" in header files',
    severity: 'warning',
    headerOnly: true
  },
  {
    pattern: /\bgoto\s+/,
    message: 'Avoid using goto statements',
    severity: 'error'
  },
  {
    pattern: /\b(strcpy|strcat|sprintf|gets)\s*\(/,
    message: 'Use safe string functions (strncpy, strncat, snprintf)',
    severity: 'error'
  },
  {
    pattern: /\/\/\s*TODO/i,
    message: 'TODO comment found',
    severity: 'warning'
  },
  {
    pattern: /\/\/\s*FIXME/i,
    message: 'FIXME comment found',
    severity: 'warning'
  },
  {
    pattern: /\bsystem\s*\(/,
    message: 'Avoid using system() calls',
    severity: 'error'
  }
];

// Memory leak patterns
const memoryPatterns = [
  {
    pattern: /new\s+\w+(?!.*delete)/,
    message: 'Potential memory leak: new without corresponding delete',
    severity: 'warning'
  },
  {
    pattern: /new\s*\[(?!.*delete\s*\[)/,
    message: 'Potential memory leak: new[] without corresponding delete[]',
    severity: 'warning'
  }
];

files.forEach(file => {
  if (!fs.existsSync(file)) {
    return;
  }

  const content = fs.readFileSync(file, 'utf-8');
  const relativePath = path.relative(process.cwd(), file);
  const isHeader = file.endsWith('.h') || file.endsWith('.hpp');

  console.log(`${GREEN}Checking: ${relativePath}${RESET}`);

  // Check include guards for header files
  if (isHeader) {
    const guardPattern = /#ifndef\s+\w+\s*\n\s*#define\s+\w+/;
    const pragmaOnce = /#pragma\s+once/;

    if (!guardPattern.test(content) && !pragmaOnce.test(content)) {
      console.log(`${YELLOW}⚠️  Missing include guards or #pragma once${RESET}`);
      hasWarnings = true;
    }
  }

  // Check C++ patterns
  cppPatterns.forEach(({ pattern, message, severity, headerOnly }) => {
    if (headerOnly && !isHeader) return;

    if (pattern.test(content)) {
      if (severity === 'error') {
        console.log(`${RED}  ❌ ${message}${RESET}`);
        hasErrors = true;
      } else {
        console.log(`${YELLOW}  ⚠️  ${message}${RESET}`);
        hasWarnings = true;
      }
    }
  });

  // Basic memory leak detection (very simple heuristic)
  const lines = content.split('\n');
  let newCount = 0;
  let deleteCount = 0;

  lines.forEach((line, index) => {
    // Count new/delete (simplified)
    if (/\bnew\s+/.test(line) && !/\/\//.test(line.split('new')[0])) {
      newCount++;
    }
    if (/\bdelete\s+/.test(line) && !/\/\//.test(line.split('delete')[0])) {
      deleteCount++;
    }

    // Check line length
    if (line.length > 120) {
      console.log(`${YELLOW}  ⚠️  Line ${index + 1}: Line exceeds 120 characters${RESET}`);
      hasWarnings = true;
    }
  });

  if (newCount > deleteCount + 2) {
    console.log(`${YELLOW}  ⚠️  Possible memory leak: ${newCount} 'new' vs ${deleteCount} 'delete'${RESET}`);
    hasWarnings = true;
  }

  // Check for Node.js addon patterns
  if (content.includes('Napi::')) {
    // Node-API specific checks
    if (content.includes('Napi::String::New') && !content.includes('Napi::MemoryManagement')) {
      console.log(`${YELLOW}  ⚠️  Consider using Napi::MemoryManagement for string handling${RESET}`);
      hasWarnings = true;
    }

    if (!content.includes('Napi::HandleScope')) {
      console.log(`${YELLOW}  ⚠️  Consider using HandleScope for Napi objects${RESET}`);
      hasWarnings = true;
    }
  }
});

// Summary
if (hasErrors) {
  console.log(`\n${RED}Native code check failed with errors.${RESET}`);
  process.exit(1);
} else if (hasWarnings) {
  console.log(`\n${YELLOW}Native code check passed with warnings.${RESET}`);
  process.exit(0);
} else {
  console.log(`\n${GREEN}✅ Native code checks passed!${RESET}`);
  process.exit(0);
}