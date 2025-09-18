#!/usr/bin/env node

/**
 * Documentation Validator
 * Checks TypeScript JSDoc comments and documentation completeness
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let totalFiles = 0;
let documentedFiles = 0;
let undocumentedExports = [];
let warnings = [];

function log(message, level = 'info') {
  const prefix = level === 'error' ? `${RED}❌` : level === 'warning' ? `${YELLOW}⚠️` : `${GREEN}✓`;
  const suffix = level !== 'info' ? RESET : '';
  console.log(`${prefix} ${message}${suffix}`);
}

/**
 * Check if a TypeScript node has JSDoc documentation
 */
function hasJSDoc(node) {
  const jsDocTags = ts.getJSDocTags(node);
  const jsDocComments = ts.getJSDocCommentsAndTags(node);
  return jsDocComments && jsDocComments.length > 0;
}

/**
 * Get the name of a TypeScript node
 */
function getNodeName(node) {
  if (node.name) {
    return node.name.getText();
  }
  return '<anonymous>';
}

/**
 * Check a TypeScript source file for documentation
 */
function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const relativePath = path.relative(process.cwd(), filePath);
  let fileHasExports = false;
  let undocumentedCount = 0;

  function visit(node) {
    // Check exported functions
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      fileHasExports = true;
      if (!hasJSDoc(node)) {
        undocumentedExports.push(`${relativePath}: function ${getNodeName(node)}`);
        undocumentedCount++;
      }
    }

    // Check exported classes
    if (ts.isClassDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      fileHasExports = true;
      if (!hasJSDoc(node)) {
        undocumentedExports.push(`${relativePath}: class ${getNodeName(node)}`);
        undocumentedCount++;
      }

      // Check public methods
      node.members.forEach(member => {
        if (ts.isMethodDeclaration(member) &&
            !member.modifiers?.some(m => m.kind === ts.SyntaxKind.PrivateKeyword)) {
          if (!hasJSDoc(member) && member.name) {
            warnings.push(`${relativePath}: method ${getNodeName(node)}.${member.name.getText()} lacks documentation`);
          }
        }
      });
    }

    // Check exported interfaces
    if (ts.isInterfaceDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      fileHasExports = true;
      if (!hasJSDoc(node)) {
        undocumentedExports.push(`${relativePath}: interface ${getNodeName(node)}`);
        undocumentedCount++;
      }
    }

    // Check exported type aliases
    if (ts.isTypeAliasDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      fileHasExports = true;
      if (!hasJSDoc(node)) {
        warnings.push(`${relativePath}: type ${getNodeName(node)} lacks documentation`);
      }
    }

    // Check exported constants
    if (ts.isVariableStatement(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      fileHasExports = true;
      node.declarationList.declarations.forEach(decl => {
        if (!hasJSDoc(node) && !hasJSDoc(decl)) {
          warnings.push(`${relativePath}: const ${decl.name.getText()} lacks documentation`);
        }
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (fileHasExports) {
    totalFiles++;
    if (undocumentedCount === 0) {
      documentedFiles++;
    }
  }

  return { hasExports: fileHasExports, undocumentedCount };
}

/**
 * Find all TypeScript files in a directory
 */
function findTsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and build directories
      if (!entry.includes('node_modules') && !entry.includes('dist') && !entry.includes('build')) {
        findTsFiles(fullPath, files);
      }
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      // Skip test files and type definition files
      if (!entry.includes('.test.') && !entry.includes('.spec.') && !entry.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

// Check critical documentation files
console.log(`${GREEN}Checking Documentation Files...${RESET}\n`);

const requiredDocs = [
  { file: 'README.md', required: true },
  { file: 'CLAUDE.md', required: true },
  { file: 'LICENSE', required: false },
  { file: 'CHANGELOG.md', required: false }
];

let missingRequired = false;
requiredDocs.forEach(({ file, required }) => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    if (stats.size < 100) {
      log(`${file} appears to be incomplete (${stats.size} bytes)`, 'warning');
    } else {
      log(`${file} present`, 'info');
    }
  } else if (required) {
    log(`${file} is missing`, 'error');
    missingRequired = true;
  } else {
    log(`${file} is missing (optional)`, 'warning');
  }
});

// Check TypeScript documentation
console.log(`\n${GREEN}Checking TypeScript Documentation...${RESET}\n`);

const srcDir = path.join(process.cwd(), 'src');
const tsFiles = findTsFiles(srcDir);

console.log(`Found ${tsFiles.length} TypeScript files to check\n`);

tsFiles.forEach(file => {
  try {
    checkFile(file);
  } catch (error) {
    log(`Error checking ${path.relative(process.cwd(), file)}: ${error.message}`, 'warning');
  }
});

// Check package.json documentation fields
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  console.log(`\n${GREEN}Checking package.json documentation fields...${RESET}`);

  const docFields = ['description', 'keywords', 'author', 'license', 'repository', 'homepage', 'bugs'];

  docFields.forEach(field => {
    if (!packageJson[field] || (Array.isArray(packageJson[field]) && packageJson[field].length === 0)) {
      warnings.push(`package.json: missing ${field}`);
    }
  });
}

// Summary
console.log('\n' + '='.repeat(50));

const coverage = totalFiles > 0 ? Math.round((documentedFiles / totalFiles) * 100) : 100;

console.log(`\nDocumentation Coverage: ${coverage}% (${documentedFiles}/${totalFiles} files)`);

if (undocumentedExports.length > 0) {
  console.log(`\n${YELLOW}Undocumented Exports:${RESET}`);
  undocumentedExports.slice(0, 10).forEach(item => {
    console.log(`  - ${item}`);
  });
  if (undocumentedExports.length > 10) {
    console.log(`  ... and ${undocumentedExports.length - 10} more`);
  }
}

if (warnings.length > 0) {
  console.log(`\n${YELLOW}Warnings:${RESET}`);
  warnings.slice(0, 10).forEach(warning => {
    console.log(`  - ${warning}`);
  });
  if (warnings.length > 10) {
    console.log(`  ... and ${warnings.length - 10} more`);
  }
}

if (missingRequired) {
  console.log(`\n${RED}Documentation validation failed: Required documentation files are missing.${RESET}`);
  process.exit(1);
} else if (coverage < 50) {
  console.log(`\n${RED}Documentation validation failed: Coverage is below 50%.${RESET}`);
  process.exit(1);
} else if (coverage < 80) {
  console.log(`\n${YELLOW}Documentation validation passed with warnings. Consider improving coverage.${RESET}`);
  process.exit(0);
} else {
  console.log(`\n${GREEN}✅ Documentation validation passed!${RESET}`);
  process.exit(0);
}