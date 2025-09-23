import * as vm from 'vm';
import { createHash } from 'crypto';
import * as path from 'path';
import * as fs from 'fs-extra';
import { logger } from '../utils/logger';
import { PluginCapability } from '@shared/types/plugins';

export interface SecurityReport {
  safe: boolean;
  risks: SecurityRisk[];
  recommendations: string[];
}

export interface SecurityRisk {
  type: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  location?: string;
}

export interface SandboxOptions {
  timeout: number;
  memoryLimit: number;
  permissions: PluginCapability[];
}

export class PluginSecurityManager {
  private blacklistedModules = [
    'child_process',
    'cluster',
    'dgram',
    'dns',
    'net',
    'tls',
    'http',
    'https',
  ];

  private dangerousGlobals = ['process', 'require', '__dirname', '__filename', 'module', 'exports'];

  private maliciousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /new\s+Function/,
    /require\s*\(\s*['"`]child_process/,
    /\.exec\s*\(/,
    /\.execSync\s*\(/,
    /\.spawn\s*\(/,
    /\.fork\s*\(/,
  ];

  /**
   * Scan plugin code for security issues
   */
  async scanPlugin(pluginPath: string): Promise<SecurityReport> {
    const risks: SecurityRisk[] = [];
    const recommendations: string[] = [];

    try {
      // Read all JavaScript files
      const files = await this.findJavaScriptFiles(pluginPath);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        const fileRisks = await this.scanFileContent(content, file);
        risks.push(...fileRisks);
      }

      // Check package.json for suspicious dependencies
      const packageJsonPath = path.join(pluginPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        const depRisks = this.checkDependencies(packageJson);
        risks.push(...depRisks);
      }

      // Generate recommendations
      if (risks.some(r => r.type === 'high')) {
        recommendations.push(
          'This plugin contains high-risk code patterns and should be reviewed carefully'
        );
      }

      if (risks.some(r => r.category === 'network')) {
        recommendations.push('This plugin may access network resources');
      }

      return {
        safe: risks.filter(r => r.type === 'high').length === 0,
        risks,
        recommendations,
      };
    } catch (error) {
      logger.error('Failed to scan plugin:', error);
      return {
        safe: false,
        risks: [
          {
            type: 'high',
            category: 'scan-error',
            description: 'Failed to complete security scan',
          },
        ],
        recommendations: ['Could not complete security scan'],
      };
    }
  }

  /**
   * Scan file content for security issues
   */
  private async scanFileContent(content: string, filePath: string): Promise<SecurityRisk[]> {
    const risks: SecurityRisk[] = [];

    // Check for malicious patterns
    for (const pattern of this.maliciousPatterns) {
      if (pattern.test(content)) {
        risks.push({
          type: 'high',
          category: 'dangerous-code',
          description: `Potentially dangerous code pattern detected: ${pattern}`,
          location: filePath,
        });
      }
    }

    // Check for blacklisted module usage
    for (const module of this.blacklistedModules) {
      const importPattern = new RegExp(`require\\s*\\(\\s*['"\`]${module}['"\`]\\s*\\)`);
      const importStatementPattern = new RegExp(`import\\s+.*\\s+from\\s+['"\`]${module}['"\`]`);

      if (importPattern.test(content) || importStatementPattern.test(content)) {
        risks.push({
          type: 'medium',
          category: 'restricted-module',
          description: `Uses restricted module: ${module}`,
          location: filePath,
        });
      }
    }

    // Check for file system access
    if (/fs\.|require\(['"`]fs['"`]\)/.test(content)) {
      risks.push({
        type: 'medium',
        category: 'file-system',
        description: 'Accesses file system',
        location: filePath,
      });
    }

    // Check for network access
    if (/fetch\(|axios|XMLHttpRequest/.test(content)) {
      risks.push({
        type: 'low',
        category: 'network',
        description: 'May perform network requests',
        location: filePath,
      });
    }

    return risks;
  }

  /**
   * Check dependencies for security issues
   */
  private checkDependencies(packageJson: any): SecurityRisk[] {
    const risks: SecurityRisk[] = [];
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const [dep, version] of Object.entries(allDeps)) {
      // Check for suspicious dependencies
      if (this.blacklistedModules.includes(dep)) {
        risks.push({
          type: 'high',
          category: 'dangerous-dependency',
          description: `Depends on restricted module: ${dep}`,
        });
      }

      // Check for git dependencies (potential security risk)
      if (typeof version === 'string' && version.includes('git')) {
        risks.push({
          type: 'medium',
          category: 'git-dependency',
          description: `Uses git dependency: ${dep}`,
        });
      }
    }

    return risks;
  }

  /**
   * Create sandboxed execution context
   */
  createSandbox(options: SandboxOptions): vm.Context {
    const sandbox = {
      // Provide safe globals
      console: {
        log: (...args: any[]) => logger.info('[Plugin]', ...args),
        error: (...args: any[]) => logger.error('[Plugin]', ...args),
        warn: (...args: any[]) => logger.warn('[Plugin]', ...args),
        info: (...args: any[]) => logger.info('[Plugin]', ...args),
      },

      // Safe utilities
      setTimeout: (_fn: () => void, _delay: number) => {
        if (_delay > options.timeout) {
          throw new Error('Timeout exceeds maximum allowed');
        }
        return setTimeout(_fn, _delay);
      },

      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,

      // Custom error class
      Error,

      // Restricted require function
      require: this.createRestrictedRequire(options.permissions),
    };

    // Remove dangerous globals
    for (const global of this.dangerousGlobals) {
      Object.defineProperty(sandbox, global, {
        get() {
          throw new Error(`Access to ${global} is not allowed`);
        },
      });
    }

    return vm.createContext(sandbox);
  }

  /**
   * Create restricted require function
   */
  private createRestrictedRequire(permissions: PluginCapability[]) {
    return (module: string) => {
      // Check if module is allowed
      if (this.blacklistedModules.includes(module)) {
        throw new Error(`Module ${module} is not allowed`);
      }

      // Check permissions for specific modules
      if (module === 'fs' && !permissions.includes(PluginCapability.FILE_SYSTEM_READ)) {
        throw new Error('File system access not permitted');
      }

      if (
        ['http', 'https', 'net'].includes(module) &&
        !permissions.includes(PluginCapability.NETWORK_ACCESS)
      ) {
        throw new Error('Network access not permitted');
      }

      // Allow whitelisted modules
      const whitelisted = ['path', 'url', 'querystring', 'util'];
      if (whitelisted.includes(module)) {
        return require(module);
      }

      throw new Error(`Module ${module} is not allowed`);
    };
  }

  /**
   * Execute code in sandbox with resource limits
   */
  async executeInSandbox(code: string, sandbox: vm.Context, options: SandboxOptions): Promise<any> {
    const script = new vm.Script(code);

    // Monitor memory usage
    const startMemory = process.memoryUsage().heapUsed;
    let memoryCheckInterval: NodeJS.Timeout;

    try {
      // Set up memory monitoring
      memoryCheckInterval = setInterval(() => {
        const currentMemory = process.memoryUsage().heapUsed;
        const usedMemory = currentMemory - startMemory;

        if (usedMemory > options.memoryLimit) {
          throw new Error('Memory limit exceeded');
        }
      }, 100);

      // Execute the script
      const result = await script.runInContext(sandbox, {
        timeout: options.timeout,
      });

      return result;
    } finally {
      if (memoryCheckInterval!) {
        clearInterval(memoryCheckInterval);
      }
    }
  }

  /**
   * Calculate plugin hash for integrity checking
   */
  async calculatePluginHash(pluginPath: string): Promise<string> {
    const hash = createHash('sha256');
    const files = await this.findJavaScriptFiles(pluginPath);

    for (const file of files.sort()) {
      const content = await fs.readFile(file);
      hash.update(content);
    }

    return hash.digest('hex');
  }

  /**
   * Find all JavaScript files in plugin
   */
  private async findJavaScriptFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && entry.name !== 'node_modules') {
        files.push(...(await this.findJavaScriptFiles(fullPath)));
      } else if (entry.isFile() && /\.(js|mjs|ts)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

export const pluginSecurity = new PluginSecurityManager();
