import { app, session } from 'electron';
import * as path from 'path';
import { createLogger, Logger } from '../utils/logger';

/**
 * Security configuration module for the Electron app
 * Implements security best practices including CSP, permissions, and protocol handling
 */
export class SecurityConfig {
  private logger: Logger;
  private isInitialized: boolean = false;

  constructor() {
    this.logger = createLogger('SecurityConfig');
  }

  /**
   * Initialize all security configurations
   */
  public initialize(): void {
    if (this.isInitialized) {
      this.logger.warn('Security configuration already initialized');
      return;
    }

    this.logger.info('Initializing security configuration');

    // Set up security headers
    this.setupContentSecurityPolicy();

    // Configure permissions
    this.configurePermissions();

    // Set up protocol security
    this.setupProtocolSecurity();

    // Additional security hardening
    this.additionalHardening();

    this.isInitialized = true;
    this.logger.info('Security configuration initialized successfully');
  }

  /**
   * Set up Content Security Policy
   */
  private setupContentSecurityPolicy(): void {
    this.logger.info('Setting up Content Security Policy');

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts and eval for React/webpack
          "style-src 'self' 'unsafe-inline'", // Allow inline styles for styled components
          "img-src 'self' data: file:", // Allow images from self, data URIs, and file protocol
          "font-src 'self'",
          "connect-src 'self'",
          "media-src 'self' file:", // Allow media from file protocol
          "object-src 'none'",
          "frame-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      };

      callback({ responseHeaders });
    });
  }

  /**
   * Configure permission handlers
   */
  private configurePermissions(): void {
    this.logger.info('Configuring permission handlers');

    // Handle permission requests
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['clipboard-read', 'clipboard-write'];

      if (allowedPermissions.includes(permission)) {
        this.logger.info(`Permission granted: ${permission}`);
        callback(true);
      } else {
        this.logger.warn(`Permission denied: ${permission}`);
        callback(false);
      }
    });

    // Handle permission checks
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      const allowedPermissions = ['clipboard-read', 'clipboard-write'];

      const allowed = allowedPermissions.includes(permission);
      this.logger.debug(`Permission check for ${permission}: ${allowed}`);
      return allowed;
    });
  }

  /**
   * Set up protocol security
   */
  private setupProtocolSecurity(): void {
    this.logger.info('Setting up protocol security');

    // Prevent navigation to external protocols
    app.on('web-contents-created', (event, contents) => {
      contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);

        // Only allow navigation to file and http/https protocols
        if (!['file:', 'http:', 'https:'].includes(parsedUrl.protocol)) {
          event.preventDefault();
          this.logger.warn(`Blocked navigation to: ${navigationUrl}`);
        }
      });

      // Prevent new window creation
      contents.setWindowOpenHandler(({ url }) => {
        this.logger.warn(`Blocked window.open to: ${url}`);
        return { action: 'deny' };
      });
    });
  }

  /**
   * Additional security hardening
   */
  private additionalHardening(): void {
    this.logger.info('Applying additional security hardening');

    // Disable remote module (deprecated but ensure it's disabled)
    app.on('web-contents-created', (event, contents) => {
      // Remote module is deprecated in newer Electron versions
      // These events may not exist, so we'll use type assertions
      (contents as any).on('remote-require', (event: any) => {
        event.preventDefault();
        this.logger.warn('Blocked remote-require attempt');
      });

      (contents as any).on('remote-get-global', (event: any) => {
        event.preventDefault();
        this.logger.warn('Blocked remote-get-global attempt');
      });
    });

    // Set secure headers for all responses
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['X-Content-Type-Options'] = 'nosniff';
      details.requestHeaders['X-Frame-Options'] = 'DENY';
      details.requestHeaders['X-XSS-Protection'] = '1; mode=block';
      details.requestHeaders['Referrer-Policy'] = 'strict-origin-when-cross-origin';

      callback({ requestHeaders: details.requestHeaders });
    });
  }

  /**
   * Validate file paths to prevent directory traversal
   */
  public validateFilePath(filePath: string, allowedBasePath?: string): boolean {
    try {
      const normalizedPath = path.normalize(filePath);
      const resolvedPath = path.resolve(filePath);

      // Check for directory traversal attempts
      if (normalizedPath.includes('..') || normalizedPath !== resolvedPath) {
        this.logger.warn(`Potential directory traversal attempt: ${filePath}`);
        return false;
      }

      // If allowedBasePath is provided, ensure the file is within it
      if (allowedBasePath) {
        const normalizedBase = path.normalize(allowedBasePath);
        if (!resolvedPath.startsWith(normalizedBase)) {
          this.logger.warn(`File path outside allowed directory: ${filePath}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error validating file path:', error);
      return false;
    }
  }

  /**
   * Sanitize filename to prevent issues
   */
  public sanitizeFilename(filename: string): string {
    // Remove any path separators and dangerous characters
    return filename
      .replace(/[/\\]/g, '_') // Replace path separators
      .replace(/\.\./g, '_') // Replace directory traversal
      .replace(/[<>:"|?*]/g, '_') // Replace invalid filename characters
      .replace(/^\./, '_') // Replace leading dot
      .trim();
  }

  /**
   * Get secure window creation options
   */
  public getSecureWindowOptions(): Electron.BrowserWindowConstructorOptions {
    return {
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false,
        experimentalFeatures: false,
        enableBlinkFeatures: undefined,
        webviewTag: false,
        navigateOnDragDrop: false,
      },
    };
  }
}

// Export singleton instance
export const securityConfig = new SecurityConfig();
