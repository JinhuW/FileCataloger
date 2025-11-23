import { app, globalShortcut, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { preferencesManager } from '../config/preferences_manager';
import { errorHandler, ErrorSeverity, ErrorCategory } from '../utils/error_handler';
import { logger } from '../utils/logger';

export interface KeyboardShortcut {
  accelerator: string;
  action: string;
  enabled: boolean;
  description: string;
}

export class KeyboardManager extends EventEmitter {
  private static instance: KeyboardManager;
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isActive: boolean = false;

  private constructor() {
    super();
    this.setupDefaultShortcuts();
    this.listenForPreferenceChanges();
  }

  public static getInstance(): KeyboardManager {
    if (!KeyboardManager.instance) {
      KeyboardManager.instance = new KeyboardManager();
    }
    return KeyboardManager.instance;
  }

  private setupDefaultShortcuts(): void {
    const prefs = preferencesManager.getPreferences();

    // Define default shortcuts
    const defaultShortcuts: KeyboardShortcut[] = [
      {
        accelerator: prefs.shortcuts.toggleShelf,
        action: 'toggle-shelf',
        enabled: true,
        description: 'Toggle shelf visibility',
      },
      {
        accelerator: prefs.shortcuts.clearShelf,
        action: 'clear-shelf',
        enabled: true,
        description: 'Clear current shelf',
      },
      {
        accelerator: prefs.shortcuts.hideAllShelves,
        action: 'hide-all-shelves',
        enabled: true,
        description: 'Hide all shelves',
      },
      {
        accelerator: prefs.shortcuts.showPreferences,
        action: 'show-preferences',
        enabled: true,
        description: 'Show preferences window',
      },
      {
        accelerator: prefs.shortcuts.quit,
        action: 'quit-app',
        enabled: true,
        description: 'Quit application',
      },
      // Additional shortcuts
      // Removed - this is now handled by create-shelf from preferences
      {
        accelerator: 'CommandOrControl+Shift+P',
        action: 'pin-shelf',
        enabled: true,
        description: 'Pin/unpin current shelf',
      },
      {
        accelerator: 'CommandOrControl+Option+Shift+S',
        action: 'save-shelf',
        enabled: true,
        description: 'Save shelf contents',
      },
      {
        accelerator: 'CommandOrControl+Shift+O',
        action: 'open-shelf',
        enabled: true,
        description: 'Open saved shelf',
      },
      {
        accelerator: 'CommandOrControl+Tab',
        action: 'next-shelf',
        enabled: true,
        description: 'Switch to next shelf',
      },
      {
        accelerator: 'CommandOrControl+Shift+Tab',
        action: 'previous-shelf',
        enabled: true,
        description: 'Switch to previous shelf',
      },
      {
        accelerator: 'Escape',
        action: 'close-focused-shelf',
        enabled: true,
        description: 'Close focused shelf',
      },
    ];

    // Store shortcuts
    defaultShortcuts.forEach(shortcut => {
      this.shortcuts.set(shortcut.action, shortcut);
    });
  }

  private listenForPreferenceChanges(): void {
    preferencesManager.on('shortcuts-changed', (shortcuts: Record<string, string>) => {
      this.updateShortcuts(shortcuts);
    });
  }

  private updateShortcuts(shortcuts: Record<string, string>): void {
    // Unregister all current shortcuts
    this.unregisterAll();

    // Update shortcut accelerators
    Object.entries(shortcuts).forEach(([action, accelerator]) => {
      const actionKey = action.replace(/([A-Z])/g, '-$1').toLowerCase();
      const shortcut = this.shortcuts.get(actionKey);

      if (shortcut) {
        shortcut.accelerator = accelerator;
      }
    });

    // Re-register if active
    if (this.isActive) {
      this.registerAll();
    }
  }

  public start(): void {
    if (this.isActive) {
      logger.warn('KeyboardManager is already active');
      return;
    }

    this.isActive = true;
    this.registerAll();
  }

  public stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    this.unregisterAll();
  }

  private registerAll(): void {
    this.shortcuts.forEach(shortcut => {
      if (shortcut.enabled) {
        this.registerShortcut(shortcut);
      }
    });
  }

  private unregisterAll(): void {
    globalShortcut.unregisterAll();
  }

  private registerShortcut(shortcut: KeyboardShortcut): void {
    try {
      logger.info(
        `Registering shortcut with globalShortcut: ${shortcut.accelerator} -> ${shortcut.action}`
      );
      const registered = globalShortcut.register(shortcut.accelerator, () => {
        logger.info(`Shortcut triggered: ${shortcut.accelerator} -> ${shortcut.action}`);
        this.handleShortcut(shortcut.action);
      });

      if (!registered) {
        logger.warn(`Failed to register shortcut: ${shortcut.accelerator}`);
        errorHandler.handleError(`Failed to register shortcut: ${shortcut.accelerator}`, {
          severity: ErrorSeverity.LOW,
          category: ErrorCategory.SYSTEM,
          context: { shortcut },
        });
      } else {
        logger.info(
          `✓ Successfully registered shortcut: ${shortcut.accelerator} -> ${shortcut.action}`
        );
      }
    } catch (error) {
      errorHandler.handleError(error as Error, {
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.SYSTEM,
        context: { shortcut },
      });
    }
  }

  private handleShortcut(action: string): void {
    logger.info(`Handling shortcut action: ${action}`);

    // Emit event for action
    this.emit('shortcut', action);

    // Handle built-in actions
    switch (action) {
      case 'toggle-shelf':
        this.emit('toggle-shelf');
        break;

      case 'clear-shelf':
        this.emit('clear-shelf');
        break;

      case 'hide-all-shelves':
        this.emit('hide-all-shelves');
        break;

      case 'show-preferences':
        preferencesManager.showPreferencesWindow();
        break;

      case 'quit-app':
        app.quit();
        break;

      case 'new-shelf':
        this.emit('new-shelf');
        break;

      case 'create-shelf':
        this.emit('create-shelf');
        break;

      case 'pin-shelf':
        this.emit('pin-shelf');
        break;

      case 'save-shelf':
        this.emit('save-shelf');
        break;

      case 'open-shelf':
        this.emit('open-shelf');
        break;

      case 'next-shelf':
        this.emit('next-shelf');
        break;

      case 'previous-shelf':
        this.emit('previous-shelf');
        break;

      case 'close-focused-shelf': {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow && focusedWindow.getTitle().includes('Shelf')) {
          focusedWindow.close();
        }
        break;
      }

      default:
        // Unhandled shortcut action: ${action}
        break;
    }
  }

  public registerCustomShortcut(
    accelerator: string,
    action: string,
    description: string = ''
  ): boolean {
    try {
      logger.info(`Attempting to register custom shortcut: ${accelerator} for action: ${action}`);

      // Check if accelerator is already in use
      if (this.isAcceleratorInUse(accelerator)) {
        logger.warn(`Accelerator already in use: ${accelerator}`);
        return false;
      }

      // Create new shortcut
      const shortcut: KeyboardShortcut = {
        accelerator,
        action,
        enabled: true,
        description,
      };

      // Store and register
      this.shortcuts.set(action, shortcut);

      if (this.isActive) {
        this.registerShortcut(shortcut);
        logger.info(`Custom shortcut registered with globalShortcut: ${accelerator}`);
      } else {
        logger.warn(
          `KeyboardManager not active, shortcut stored but not registered: ${accelerator}`
        );
      }

      return true;
    } catch (error) {
      errorHandler.handleError(error as Error, {
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.SYSTEM,
        context: { accelerator, action },
      });
      return false;
    }
  }

  public unregisterCustomShortcut(action: string): boolean {
    const shortcut = this.shortcuts.get(action);

    if (!shortcut) {
      return false;
    }

    // Unregister if active
    if (this.isActive) {
      globalShortcut.unregister(shortcut.accelerator);
    }

    // Remove from shortcuts
    this.shortcuts.delete(action);

    return true;
  }

  private isAcceleratorInUse(accelerator: string): boolean {
    for (const shortcut of this.shortcuts.values()) {
      if (shortcut.accelerator === accelerator) {
        return true;
      }
    }
    return false;
  }

  public getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  public getShortcut(action: string): KeyboardShortcut | undefined {
    return this.shortcuts.get(action);
  }

  public enableShortcut(action: string): boolean {
    const shortcut = this.shortcuts.get(action);

    if (!shortcut) {
      return false;
    }

    shortcut.enabled = true;

    if (this.isActive) {
      this.registerShortcut(shortcut);
    }

    return true;
  }

  public disableShortcut(action: string): boolean {
    const shortcut = this.shortcuts.get(action);

    if (!shortcut) {
      return false;
    }

    shortcut.enabled = false;

    if (this.isActive) {
      globalShortcut.unregister(shortcut.accelerator);
    }

    return true;
  }

  public isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }

  public destroy(): void {
    this.stop();
    this.removeAllListeners();
    this.shortcuts.clear();
  }
}

// Export singleton instance
export const keyboardManager = KeyboardManager.getInstance();
