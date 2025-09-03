import { app, BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface AppPreferences {
  // General
  launchAtStartup: boolean;
  showInDock: boolean;
  showInMenuBar: boolean;
  
  // Shake Detection
  shakeDetection: {
    enabled: boolean;
    sensitivity: 'low' | 'medium' | 'high';
    requiredDirectionChanges: number;
    timeWindow: number;
    cooldownPeriod: number;
  };
  
  // Shelf Behavior
  shelf: {
    defaultPosition: 'cursor' | 'center' | 'lastPosition';
    defaultSize: { width: number; height: number };
    opacity: number;
    autoHideEmpty: boolean;
    autoHideDelay: number;
    maxSimultaneous: number;
    animationSpeed: 'slow' | 'normal' | 'fast' | 'instant';
    theme: 'light' | 'dark' | 'auto';
    createOnlyOnFirstDragAndShake: boolean; // Only create shelf on first drag+shake action
  };
  
  // File Handling
  fileHandling: {
    maxFileSize: number; // in MB
    allowedFileTypes: string[];
    autoOpenOnDrop: boolean;
    preserveOriginal: boolean;
  };
  
  // Keyboard Shortcuts
  shortcuts: {
    toggleShelf: string;
    clearShelf: string;
    hideAllShelves: string;
    showPreferences: string;
    quit: string;
  };
  
  // Performance
  performance: {
    enableHardwareAcceleration: boolean;
    maxCachedWindows: number;
    enableVirtualization: boolean;
    virtualizeThreshold: number;
  };
  
  // Privacy & Security
  privacy: {
    collectAnalytics: boolean;
    checkForUpdates: boolean;
    sendCrashReports: boolean;
  };
}

const DEFAULT_PREFERENCES: AppPreferences = {
  launchAtStartup: false,
  showInDock: true,
  showInMenuBar: true,
  
  shakeDetection: {
    enabled: true,
    sensitivity: 'medium',
    requiredDirectionChanges: 6,
    timeWindow: 500,
    cooldownPeriod: 2000
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
    createOnlyOnFirstDragAndShake: true // Default: only create on first drag+shake
  },
  
  fileHandling: {
    maxFileSize: 100,
    allowedFileTypes: [],
    autoOpenOnDrop: false,
    preserveOriginal: true
  },
  
  shortcuts: {
    toggleShelf: 'CommandOrControl+Shift+D',
    clearShelf: 'CommandOrControl+Shift+C',
    hideAllShelves: 'CommandOrControl+Shift+H',
    showPreferences: 'CommandOrControl+,',
    quit: 'CommandOrControl+Q'
  },
  
  performance: {
    enableHardwareAcceleration: true,
    maxCachedWindows: 3,
    enableVirtualization: true,
    virtualizeThreshold: 50
  },
  
  privacy: {
    collectAnalytics: false,
    checkForUpdates: true,
    sendCrashReports: false
  }
};

export class PreferencesManager extends EventEmitter {
  private static instance: PreferencesManager;
  private preferences: AppPreferences;
  private preferencesPath: string;
  private preferencesWindow: BrowserWindow | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    
    this.preferencesPath = path.join(
      app.getPath('userData'),
      'preferences.json'
    );
    
    this.preferences = this.loadPreferences();
    this.setupIPC();
    this.applyPreferences();
  }

  public static getInstance(): PreferencesManager {
    if (!PreferencesManager.instance) {
      PreferencesManager.instance = new PreferencesManager();
    }
    return PreferencesManager.instance;
  }

  private loadPreferences(): AppPreferences {
    try {
      if (fs.existsSync(this.preferencesPath)) {
        const data = fs.readFileSync(this.preferencesPath, 'utf-8');
        const loaded = JSON.parse(data);
        
        // Merge with defaults to ensure all keys exist
        return this.mergeWithDefaults(loaded);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
    
    return { ...DEFAULT_PREFERENCES };
  }

  private mergeWithDefaults(loaded: Partial<AppPreferences>): AppPreferences {
    // Deep merge loaded preferences with defaults
    const merged = { ...DEFAULT_PREFERENCES };
    
    if (loaded.launchAtStartup !== undefined) merged.launchAtStartup = loaded.launchAtStartup;
    if (loaded.showInDock !== undefined) merged.showInDock = loaded.showInDock;
    if (loaded.showInMenuBar !== undefined) merged.showInMenuBar = loaded.showInMenuBar;
    
    if (loaded.shakeDetection) {
      merged.shakeDetection = { ...merged.shakeDetection, ...loaded.shakeDetection };
    }
    
    if (loaded.shelf) {
      merged.shelf = { ...merged.shelf, ...loaded.shelf };
    }
    
    if (loaded.fileHandling) {
      merged.fileHandling = { ...merged.fileHandling, ...loaded.fileHandling };
    }
    
    if (loaded.shortcuts) {
      merged.shortcuts = { ...merged.shortcuts, ...loaded.shortcuts };
    }
    
    if (loaded.performance) {
      merged.performance = { ...merged.performance, ...loaded.performance };
    }
    
    if (loaded.privacy) {
      merged.privacy = { ...merged.privacy, ...loaded.privacy };
    }
    
    return merged;
  }

  private savePreferences(): void {
    // Debounce saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      try {
        const dir = path.dirname(this.preferencesPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(
          this.preferencesPath,
          JSON.stringify(this.preferences, null, 2)
        );
      } catch (error) {
        console.error('Failed to save preferences:', error);
      }
    }, 500);
  }

  private setupIPC(): void {
    // Get preferences
    ipcMain.handle('preferences:get', () => {
      return this.preferences;
    });
    
    // Update preferences
    ipcMain.handle('preferences:update', (event, updates: Partial<AppPreferences>) => {
      this.updatePreferences(updates);
      return this.preferences;
    });
    
    // Reset preferences
    ipcMain.handle('preferences:reset', () => {
      this.resetPreferences();
      return this.preferences;
    });
    
    // Export preferences
    ipcMain.handle('preferences:export', () => {
      return this.exportPreferences();
    });
    
    // Import preferences
    ipcMain.handle('preferences:import', (event, data: string) => {
      return this.importPreferences(data);
    });
  }

  private applyPreferences(): void {
    // Apply launch at startup
    app.setLoginItemSettings({
      openAtLogin: this.preferences.launchAtStartup
    });
    
    // Apply dock visibility (macOS)
    if (process.platform === 'darwin' && app.dock) {
      if (this.preferences.showInDock) {
        app.dock.show();
      } else {
        app.dock.hide();
      }
    }
    
    // Emit change event for other modules to react
    this.emit('preferences-changed', this.preferences);
  }

  public getPreferences(): AppPreferences {
    return { ...this.preferences };
  }

  public getPreference<K extends keyof AppPreferences>(key: K): AppPreferences[K] {
    return this.preferences[key];
  }

  public updatePreferences(updates: Partial<AppPreferences>): void {
    const oldPreferences = { ...this.preferences };
    
    // Update preferences
    this.preferences = this.mergeWithDefaults({
      ...this.preferences,
      ...updates
    });
    
    // Save to disk
    this.savePreferences();
    
    // Apply changes
    this.applyPreferences();
    
    // Notify about specific changes
    this.detectAndEmitChanges(oldPreferences, this.preferences);
  }

  private detectAndEmitChanges(
    oldPrefs: AppPreferences,
    newPrefs: AppPreferences
  ): void {
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
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.savePreferences();
    this.applyPreferences();
    this.emit('preferences-reset', this.preferences);
  }

  public exportPreferences(): string {
    return JSON.stringify(this.preferences, null, 2);
  }

  public importPreferences(data: string): boolean {
    try {
      const imported = JSON.parse(data);
      this.updatePreferences(imported);
      return true;
    } catch (error) {
      console.error('Failed to import preferences:', error);
      return false;
    }
  }

  public showPreferencesWindow(): void {
    if (this.preferencesWindow && !this.preferencesWindow.isDestroyed()) {
      this.preferencesWindow.focus();
      return;
    }
    
    this.preferencesWindow = new BrowserWindow({
      width: 700,
      height: 600,
      title: 'Dropover Preferences',
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../preload/index.js')
      }
    });
    
    // Load preferences UI
    const preferencesPath = path.join(__dirname, '../../renderer/preferences.html');
    if (fs.existsSync(preferencesPath)) {
      this.preferencesWindow.loadFile(preferencesPath);
    } else {
      // Fallback to a simple HTML content
      this.preferencesWindow.loadURL(`data:text/html,
        <html>
          <head>
            <title>Preferences</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                padding: 20px;
                background: #f5f5f5;
              }
              h1 { color: #333; }
              .section {
                background: white;
                padding: 15px;
                margin: 10px 0;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              label {
                display: flex;
                align-items: center;
                margin: 10px 0;
              }
              input[type="checkbox"] {
                margin-right: 10px;
              }
              input[type="range"] {
                flex: 1;
                margin: 0 10px;
              }
              .value {
                min-width: 50px;
                text-align: right;
              }
            </style>
          </head>
          <body>
            <h1>Dropover Preferences</h1>
            <div class="section">
              <h2>General</h2>
              <label>
                <input type="checkbox" id="launchAtStartup">
                Launch at startup
              </label>
              <label>
                <input type="checkbox" id="showInMenuBar" checked>
                Show in menu bar
              </label>
            </div>
            <div class="section">
              <h2>Shake Detection</h2>
              <label>
                <input type="checkbox" id="shakeEnabled" checked>
                Enable shake gesture
              </label>
              <label>
                Sensitivity:
                <input type="range" id="sensitivity" min="1" max="3" value="2">
                <span class="value">Medium</span>
              </label>
            </div>
            <div class="section">
              <h2>Shelf</h2>
              <label>
                Opacity:
                <input type="range" id="opacity" min="50" max="100" value="95">
                <span class="value">95%</span>
              </label>
              <label>
                <input type="checkbox" id="autoHide" checked>
                Auto-hide empty shelves
              </label>
            </div>
            <script>
              // Simple preferences UI logic
              document.querySelectorAll('input').forEach(input => {
                input.addEventListener('change', (e) => {
                  // Send to main process via IPC
                });
              });
            </script>
          </body>
        </html>
      `);
    }
    
    this.preferencesWindow.on('closed', () => {
      this.preferencesWindow = null;
    });
  }

  public getDefaultPreferences(): AppPreferences {
    return { ...DEFAULT_PREFERENCES };
  }

  public getSensitivityMultiplier(): number {
    switch (this.preferences.shakeDetection.sensitivity) {
      case 'low': return 1.5;
      case 'medium': return 1.0;
      case 'high': return 0.7;
      default: return 1.0;
    }
  }

  public getAnimationDuration(): number {
    switch (this.preferences.shelf.animationSpeed) {
      case 'slow': return 500;
      case 'normal': return 300;
      case 'fast': return 150;
      case 'instant': return 0;
      default: return 300;
    }
  }
}

// Export singleton instance
export const preferencesManager = PreferencesManager.getInstance();