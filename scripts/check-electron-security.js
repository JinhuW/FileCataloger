#!/usr/bin/env node

/**
 * Electron Security Checker
 * Validates security best practices in Electron applications
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let hasErrors = false;
let hasWarnings = false;

function log(message, level = 'info') {
  const prefix = level === 'error' ? `${RED}❌` : level === 'warning' ? `${YELLOW}⚠️` : '✓';
  const suffix = level !== 'info' ? RESET : '';
  console.log(`${prefix} ${message}${suffix}`);
}

function checkFile(filePath, checks) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      if (check.severity === 'error') {
        hasErrors = true;
        log(`${fileName}: ${check.message}`, 'error');
      } else {
        hasWarnings = true;
        log(`${fileName}: ${check.message}`, 'warning');
      }
    }
  });
}

// Security checks for main process files
const mainProcessChecks = [
  {
    pattern: /nodeIntegration:\s*true/,
    message: 'nodeIntegration should be false for security',
    severity: 'error'
  },
  {
    pattern: /contextIsolation:\s*false/,
    message: 'contextIsolation should be true for security',
    severity: 'error'
  },
  {
    pattern: /webSecurity:\s*false/,
    message: 'webSecurity should not be disabled in production',
    severity: 'error'
  },
  {
    pattern: /allowRunningInsecureContent:\s*true/,
    message: 'allowRunningInsecureContent should be false',
    severity: 'error'
  },
  {
    pattern: /experimentalFeatures:\s*true/,
    message: 'experimentalFeatures should be false in production',
    severity: 'warning'
  },
  {
    pattern: /enableRemoteModule:\s*true/,
    message: 'Remote module is deprecated and insecure',
    severity: 'error'
  },
  {
    pattern: /shell\.openExternal\([^)]*\)(?!.*noopener)/,
    message: 'shell.openExternal should validate URLs',
    severity: 'warning'
  },
  {
    pattern: /protocol\.registerHttpProtocol/,
    message: 'HTTP protocols should use HTTPS instead',
    severity: 'warning'
  },
  {
    pattern: /app\.commandLine\.appendSwitch\(['"]disable-web-security['"]\)/,
    message: 'Web security should not be disabled',
    severity: 'error'
  },
  {
    pattern: /BrowserWindow\([^)]*\)(?!.*sandbox:\s*true)/,
    message: 'Consider enabling sandbox for BrowserWindow',
    severity: 'warning'
  }
];

// Additional checks for preload scripts
const preloadChecks = [
  {
    pattern: /require\(['"]electron['"]\)/,
    message: 'Preload scripts should not directly require electron',
    severity: 'warning'
  },
  {
    pattern: /window\.\w+\s*=\s*require/,
    message: 'Avoid exposing Node APIs to renderer',
    severity: 'error'
  },
  {
    pattern: /process\.env/,
    message: 'Avoid exposing process.env to renderer',
    severity: 'warning'
  }
];

// CSP checks
const cspChecks = [
  {
    pattern: /Content-Security-Policy/,
    message: 'Good: Content Security Policy is defined',
    severity: 'info',
    required: true
  }
];

// Check main process files
const mainDir = path.join(__dirname, '..', 'src', 'main');
if (fs.existsSync(mainDir)) {
  const files = fs.readdirSync(mainDir)
    .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    .map(f => path.join(mainDir, f));

  console.log(`\n${GREEN}Checking Electron Main Process Security...${RESET}`);
  files.forEach(file => checkFile(file, mainProcessChecks));
}

// Check preload scripts
const preloadFiles = [
  path.join(__dirname, '..', 'src', 'preload', 'index.ts'),
  path.join(__dirname, '..', 'src', 'preload', 'preload.ts'),
  path.join(__dirname, '..', 'dist', 'preload', 'index.js')
];

console.log(`\n${GREEN}Checking Preload Script Security...${RESET}`);
preloadFiles.forEach(file => checkFile(file, preloadChecks));

// Check for CSP headers
const rendererDir = path.join(__dirname, '..', 'src', 'renderer');
let hasCSP = false;
if (fs.existsSync(rendererDir)) {
  const htmlFiles = fs.readdirSync(rendererDir)
    .filter(f => f.endsWith('.html'))
    .map(f => path.join(rendererDir, f));

  htmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('Content-Security-Policy')) {
      hasCSP = true;
    }
  });
}

// Check webpack configs for CSP
const webpackConfigs = [
  path.join(__dirname, '..', 'webpack.renderer.config.js'),
  path.join(__dirname, '..', 'webpack.main.config.js')
];

webpackConfigs.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('Content-Security-Policy')) {
      hasCSP = true;
    }
  }
});

if (!hasCSP) {
  log('Content Security Policy (CSP) should be configured', 'warning');
  hasWarnings = true;
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log(`${RED}Security check failed with errors.${RESET}`);
  process.exit(1);
} else if (hasWarnings) {
  console.log(`${YELLOW}Security check passed with warnings.${RESET}`);
  process.exit(0);
} else {
  console.log(`${GREEN}✅ All security checks passed!${RESET}`);
  process.exit(0);
}