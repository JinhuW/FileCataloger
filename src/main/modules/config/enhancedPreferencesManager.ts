import { app, BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';
import { EventEmitter } from 'events';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { AppPreferences } from './preferencesManager';

// Define schema for validation
const preferencesSchema = z.object({
  launchAtStartup: z.boolean(),
  showInDock: z.boolean(),
  showInMenuBar: z.boolean(),

  shakeDetection: z.object({
    enabled: z.boolean(),
    sensitivity: z.enum(['low', 'medium', 'high']),
    requiredDirectionChanges: z.number().min(2).max(10),
    timeWindow: z.number().min(100).max(2000),
    cooldownPeriod: z.number().min(500).max(5000),
  }),

  shelf: z.object({
    defaultPosition: z.enum(['cursor', 'center', 'lastPosition']),
    defaultSize: z.object({ width: z.number(), height: z.number() }),
    opacity: z.number().min(0.1).max(1),
    autoHideEmpty: z.boolean(),
    autoHideDelay: z.number(),
    maxSimultaneous: z.number().min(1).max(10),
    animationSpeed: z.enum(['slow', 'normal', 'fast', 'instant']),
    theme: z.enum(['light', 'dark', 'auto']),
    createOnlyOnFirstDragAndShake: z.boolean(),
    enableScrollingText: z.boolean(),
  }),

  fileHandling: z.object({
    maxFileSize: z.number().min(1).max(1000),
    allowedFileTypes: z.array(z.string()),
    autoOpenOnDrop: z.boolean(),
    preserveOriginal: z.boolean(),
  }),

  shortcuts: z.object({
    toggleShelf: z.string(),
    clearShelf: z.string(),
    hideAllShelves: z.string(),
    showPreferences: z.string(),
    quit: z.string(),
  }),

  performance: z.object({
    enableHardwareAcceleration: z.boolean(),
    maxCachedWindows: z.number(),
    enableVirtualization: z.boolean(),
    virtualizeThreshold: z.number(),
  }),

  privacy: z.object({
    collectAnalytics: z.boolean(),
    checkForUpdates: z.boolean(),
    sendCrashReports: z.boolean(),
  }),

  namingPatterns: z.object({
    savedPatterns: z.array(z.any()), // We could define a detailed schema for SavedPattern if needed
    defaultPatternId: z.string(),
    maxPatterns: z.number(),
  }),
});

const DEFAULT_PREFERENCES: AppPreferences = {
  launchAtStartup: false,
  showInDock: true,
  showInMenuBar: true,

  shakeDetection: {
    enabled: true,
    sensitivity: 'medium',
    requiredDirectionChanges: 6,
    timeWindow: 500,
    cooldownPeriod: 2000,
  },

  shelf: {
    defaultPosition: 'cursor',
    defaultSize: { width: 300, height: 400 },
    opacity: 0.95,
    autoHideEmpty: true,
    autoHideDelay: 5000,
    maxSimultaneous: 5,
    animationSpeed: 'normal',
    theme: 'auto',
    createOnlyOnFirstDragAndShake: true,
    enableScrollingText: true,
  },

  fileHandling: {
    maxFileSize: 100,
    allowedFileTypes: [],
    autoOpenOnDrop: false,
    preserveOriginal: true,
  },

  shortcuts: {
    toggleShelf: 'CommandOrControl+Shift+D',
    clearShelf: 'CommandOrControl+Shift+C',
    hideAllShelves: 'CommandOrControl+Shift+H',
    showPreferences: 'CommandOrControl+,',
    quit: 'CommandOrControl+Q',
  },

  performance: {
    enableHardwareAcceleration: true,
    maxCachedWindows: 3,
    enableVirtualization: true,
    virtualizeThreshold: 50,
  },

  privacy: {
    collectAnalytics: false,
    checkForUpdates: true,
    sendCrashReports: false,
  },

  namingPatterns: {
    savedPatterns: [],
    defaultPatternId: 'default-pattern',
    maxPatterns: 20,
  },
};

export class EnhancedPreferencesManager extends EventEmitter {
  private static instance: EnhancedPreferencesManager;
  private store: Store<AppPreferences>;
  private preferencesWindow: BrowserWindow | null = null;

  private constructor() {
    super();

    // Initialize electron-store with enhanced features
    this.store = new Store<AppPreferences>({
      name: 'preferences',
      defaults: DEFAULT_PREFERENCES,

      // Enable encryption for sensitive data
      // encryptionKey: 'your-encryption-key', // Uncomment for encryption

      // Clear invalid config on schema mismatch
      clearInvalidConfig: true,

      // Watch for external changes
      watch: true,

      // Custom serialization for complex objects
      serialize: (value: any) => JSON.stringify(value, null, 2),
      deserialize: (text: string) => JSON.parse(text),

      // Migration support
      migrations: {
        // '1.0.0': (store) => {
        //   // Example migration: rename old field
        //   if (store.has('oldFieldName')) {
        //     store.set('newFieldName', store.get('oldFieldName'));
        //     store.delete('oldFieldName');
        //   }
        // },
      },

      // Before saving, validate with Zod
      beforeEachMigration: (store: any, context: any) => {
        logger.info(`Migrating preferences from ${context.fromVersion} to ${context.toVersion}`);
      },
    });

    // Handle external changes
    this.store.onDidAnyChange((newValue: any, oldValue: any) => {
      if (newValue && oldValue) {
        this.detectAndEmitChanges(oldValue as AppPreferences, newValue as AppPreferences);
      }
    });

    // Add additional storage features
    this.addBackupFeatures();
    this.setupIPC();
    this.applyPreferences();
  }

  public static getInstance(): EnhancedPreferencesManager {
    if (!EnhancedPreferencesManager.instance) {
      EnhancedPreferencesManager.instance = new EnhancedPreferencesManager();
    }
    return EnhancedPreferencesManager.instance;
  }

  private addBackupFeatures(): void {
    // Create periodic backups
    setInterval(
      async () => {
        try {
          const backupPath = `${(this.store as any).path}.backup`;
          const currentData = (this.store as any).store;
          const fs = await import('fs');
          fs.writeFileSync(backupPath, JSON.stringify(currentData, null, 2));
          logger.info('Preferences backup created');
        } catch (error) {
          logger.error('Failed to create preferences backup:', error);
        }
      },
      1000 * 60 * 60
    ); // Every hour
  }

  private setupIPC(): void {
    // Get preferences with validation
    ipcMain.handle('preferences:get', () => {
      try {
        const prefs = (this.store as any).store;
        const validated = preferencesSchema.parse(prefs);
        return validated;
      } catch (error) {
        logger.error('Invalid preferences detected, returning defaults:', error);
        return DEFAULT_PREFERENCES;
      }
    });

    // Update preferences with validation
    ipcMain.handle('preferences:update', (event, updates: Partial<AppPreferences>) => {
      try {
        const current = (this.store as any).store;
        const merged = { ...current, ...updates };
        const validated = preferencesSchema.parse(merged);

        // Update store
        (this.store as any).store = validated;
        this.applyPreferences();

        return validated;
      } catch (error) {
        logger.error('Invalid preferences update:', error);
        throw new Error('Invalid preferences format');
      }
    });

    // Reset preferences
    ipcMain.handle('preferences:reset', () => {
      this.store.clear();
      (this.store as any).store = DEFAULT_PREFERENCES;
      this.applyPreferences();
      this.emit('preferences-reset', DEFAULT_PREFERENCES);
      return DEFAULT_PREFERENCES;
    });

    // Export preferences
    ipcMain.handle('preferences:export', () => {
      return JSON.stringify((this.store as any).store, null, 2);
    });

    // Import preferences with validation
    ipcMain.handle('preferences:import', (event, data: string) => {
      try {
        const imported = JSON.parse(data);
        const validated = preferencesSchema.parse(imported);
        (this.store as any).store = validated;
        this.applyPreferences();
        return true;
      } catch (error) {
        logger.error('Failed to import preferences:', error);
        return false;
      }
    });
  }

  private applyPreferences(): void {
    const preferences = (this.store as any).store;

    // Apply launch at startup
    app.setLoginItemSettings({
      openAtLogin: preferences.launchAtStartup,
    });

    // Apply dock visibility (macOS)
    if (process.platform === 'darwin' && app.dock) {
      if (preferences.showInDock) {
        app.dock.show();
      } else {
        app.dock.hide();
      }
    }

    // Emit change event for other modules to react
    this.emit('preferences-changed', preferences);
  }

  public getPreferences(): AppPreferences {
    return { ...(this.store as any).store };
  }

  public getPreference<K extends keyof AppPreferences>(key: K): AppPreferences[K] {
    return this.store.get(key);
  }

  public updatePreferences(updates: Partial<AppPreferences>): void {
    // Update preferences with validation
    try {
      const merged = { ...(this.store as any).store, ...updates };
      const validated = preferencesSchema.parse(merged);
      (this.store as any).store = validated;
      this.applyPreferences();
    } catch (error) {
      logger.error('Failed to update preferences:', error);
      throw error;
    }
  }

  private detectAndEmitChanges(oldPrefs: AppPreferences, newPrefs: AppPreferences): void {
    // Check for shake detection changes
    if (JSON.stringify(oldPrefs.shakeDetection) !== JSON.stringify(newPrefs.shakeDetection)) {
      this.emit('shake-settings-changed', newPrefs.shakeDetection);
    }

    // Check for shelf changes
    if (JSON.stringify(oldPrefs.shelf) !== JSON.stringify(newPrefs.shelf)) {
      this.emit('shelf-settings-changed', newPrefs.shelf);
    }

    // Check for shortcut changes
    if (JSON.stringify(oldPrefs.shortcuts) !== JSON.stringify(newPrefs.shortcuts)) {
      this.emit('shortcuts-changed', newPrefs.shortcuts);
    }

    // Check for performance changes
    if (JSON.stringify(oldPrefs.performance) !== JSON.stringify(newPrefs.performance)) {
      this.emit('performance-settings-changed', newPrefs.performance);
    }
  }

  public resetPreferences(): void {
    this.store.clear();
    this.store.store = DEFAULT_PREFERENCES;
    this.applyPreferences();
    this.emit('preferences-reset', DEFAULT_PREFERENCES);
  }

  public getSensitivityMultiplier(): number {
    const sensitivity = this.store.get('shakeDetection.sensitivity');
    switch (sensitivity) {
      case 'low':
        return 1.5;
      case 'medium':
        return 1.0;
      case 'high':
        return 0.7;
      default:
        return 1.0;
    }
  }

  public getAnimationDuration(): number {
    const speed = this.store.get('shelf.animationSpeed');
    switch (speed) {
      case 'slow':
        return 500;
      case 'normal':
        return 300;
      case 'fast':
        return 150;
      case 'instant':
        return 0;
      default:
        return 300;
    }
  }

  // Additional features

  public hasPreference(key: keyof AppPreferences): boolean {
    return this.store.has(key);
  }

  public getStorePath(): string {
    return (this.store as any).path;
  }

  public getStoreSize(): number {
    return (this.store as any).size;
  }

  public async restoreFromBackup(): Promise<boolean> {
    try {
      const backupPath = `${(this.store as any).path}.backup`;
      const fs = await import('fs');

      if (fs.existsSync(backupPath)) {
        const backupData = fs.readFileSync(backupPath, 'utf-8');
        const parsed = JSON.parse(backupData);
        const validated = preferencesSchema.parse(parsed);
        (this.store as any).store = validated;
        this.applyPreferences();
        logger.info('Preferences restored from backup');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to restore from backup:', error);
      return false;
    }
  }
}

// Export singleton instance
export const enhancedPreferencesManager = EnhancedPreferencesManager.getInstance();
