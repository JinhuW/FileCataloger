import { AppPreferences } from '@main/modules/config/preferencesManager';
import { logger } from '@shared/logger';

interface PreferencesUI {
  currentPreferences: AppPreferences | null;
  hasChanges: boolean;
}

const preferencesUI: PreferencesUI = {
  currentPreferences: null,
  hasChanges: false,
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadPreferences();
  setupEventListeners();
});

// Load preferences from main process
async function loadPreferences(): Promise<void> {
  try {
    preferencesUI.currentPreferences = await window.api.invoke<AppPreferences>('preferences:get');
    if (preferencesUI.currentPreferences) {
      updateUI(preferencesUI.currentPreferences);
    }
  } catch (error) {
    logger.error('Failed to load preferences:', error);
  }
}

// Update UI with preference values
function updateUI(prefs: AppPreferences): void {
  // General
  const launchAtStartupEl = document.getElementById('launchAtStartup') as HTMLInputElement;
  const showInDockEl = document.getElementById('showInDock') as HTMLInputElement;
  const showInMenuBarEl = document.getElementById('showInMenuBar') as HTMLInputElement;

  if (launchAtStartupEl) launchAtStartupEl.checked = prefs.launchAtStartup;
  if (showInDockEl) showInDockEl.checked = prefs.showInDock;
  if (showInMenuBarEl) showInMenuBarEl.checked = prefs.showInMenuBar;

  // Shelf Appearance
  const opacitySlider = document.getElementById('opacity') as HTMLInputElement;
  if (opacitySlider) {
    const opacityValue = Math.round(prefs.shelf.opacity * 100);
    opacitySlider.value = opacityValue.toString();
    const opacityLabel = opacitySlider.nextElementSibling as HTMLElement;
    if (opacityLabel) {
      opacityLabel.textContent = `${opacityValue}%`;
    }
  }

  const animationSpeedEl = document.getElementById('animationSpeed') as HTMLSelectElement;
  const themeEl = document.getElementById('theme') as HTMLSelectElement;

  if (animationSpeedEl) animationSpeedEl.value = prefs.shelf.animationSpeed;
  if (themeEl) themeEl.value = prefs.shelf.theme;

  // Shake Detection
  const dragShakeEnabledEl = document.getElementById('dragShakeEnabled') as HTMLInputElement;
  const sensitivityEl = document.getElementById('sensitivity') as HTMLSelectElement;

  if (dragShakeEnabledEl)
    dragShakeEnabledEl.checked = prefs.shakeDetection.dragShakeEnabled ?? true;
  if (sensitivityEl) sensitivityEl.value = prefs.shakeDetection.sensitivity;

  // Keyboard Shortcuts
  const createShelfShortcutEl = document.getElementById('createShelfShortcut') as HTMLInputElement;
  const toggleShelfShortcutEl = document.getElementById('toggleShelfShortcut') as HTMLInputElement;
  const clearShelfShortcutEl = document.getElementById('clearShelfShortcut') as HTMLInputElement;

  if (createShelfShortcutEl) {
    const shortcut = prefs.shortcuts.createShelf || 'CommandOrControl+Option+S';
    createShelfShortcutEl.value = formatShortcutForDisplay(shortcut);
    createShelfShortcutEl.setAttribute('data-shortcut', shortcut);
  }
  if (toggleShelfShortcutEl) {
    const shortcut = prefs.shortcuts.toggleShelf || 'CommandOrControl+Shift+D';
    toggleShelfShortcutEl.value = formatShortcutForDisplay(shortcut);
    toggleShelfShortcutEl.setAttribute('data-shortcut', shortcut);
  }
  if (clearShelfShortcutEl) {
    const shortcut = prefs.shortcuts.clearShelf || 'CommandOrControl+Shift+C';
    clearShelfShortcutEl.value = formatShortcutForDisplay(shortcut);
    clearShelfShortcutEl.setAttribute('data-shortcut', shortcut);
  }

  // Shelf Behavior
  const autoHideEl = document.getElementById('autoHide') as HTMLInputElement;
  const enableScrollingTextEl = document.getElementById('enableScrollingText') as HTMLInputElement;

  if (autoHideEl) autoHideEl.checked = prefs.shelf.autoHideEmpty;
  if (enableScrollingTextEl) {
    enableScrollingTextEl.checked = prefs.shelf.enableScrollingText ?? true;
  }

  const autoHideDelaySlider = document.getElementById('autoHideDelay') as HTMLInputElement;
  if (autoHideDelaySlider) {
    autoHideDelaySlider.value = prefs.shelf.autoHideDelay.toString();
    const delayLabel = autoHideDelaySlider.nextElementSibling as HTMLElement;
    if (delayLabel) {
      delayLabel.textContent = `${prefs.shelf.autoHideDelay / 1000}s`;
    }
  }

  const maxShelvesSlider = document.getElementById('maxShelves') as HTMLInputElement;
  if (maxShelvesSlider) {
    maxShelvesSlider.value = prefs.shelf.maxSimultaneous.toString();
    const maxLabel = maxShelvesSlider.nextElementSibling as HTMLElement;
    if (maxLabel) {
      maxLabel.textContent = prefs.shelf.maxSimultaneous.toString();
    }
  }
}

// Setup event listeners
function setupEventListeners(): void {
  // Track changes
  document
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')
    .forEach(element => {
      element.addEventListener('change', () => {
        preferencesUI.hasChanges = true;
      });
    });

  // Opacity slider
  const opacitySlider = document.getElementById('opacity') as HTMLInputElement;
  opacitySlider?.addEventListener('input', e => {
    const target = e.target as HTMLInputElement;
    const label = target.nextElementSibling as HTMLElement;
    if (label) {
      label.textContent = `${target.value}%`;
    }
  });

  // Auto-hide delay slider
  const autoHideDelaySlider = document.getElementById('autoHideDelay') as HTMLInputElement;
  autoHideDelaySlider?.addEventListener('input', e => {
    const target = e.target as HTMLInputElement;
    const label = target.nextElementSibling as HTMLElement;
    if (label) {
      label.textContent = `${parseInt(target.value) / 1000}s`;
    }
  });

  // Max shelves slider
  const maxShelvesSlider = document.getElementById('maxShelves') as HTMLInputElement;
  maxShelvesSlider?.addEventListener('input', e => {
    const target = e.target as HTMLInputElement;
    const label = target.nextElementSibling as HTMLElement;
    if (label) {
      label.textContent = target.value;
    }
  });

  // Save button
  const saveButton = document.getElementById('saveButton');
  saveButton?.addEventListener('click', savePreferences);

  // Reset button
  const resetButton = document.getElementById('resetButton');
  resetButton?.addEventListener('click', resetPreferences);

  // Setup keyboard shortcut recording
  setupShortcutRecording();

  // Prevent form submission on Enter (except when recording shortcuts)
  document.addEventListener('keydown', e => {
    const activeElement = document.activeElement as HTMLElement;
    if (e.key === 'Enter' && !activeElement?.classList.contains('recording')) {
      e.preventDefault();
      if (preferencesUI.hasChanges) {
        savePreferences();
      }
    }
  });
}

// Save preferences
async function savePreferences(): Promise<void> {
  const updates: Partial<AppPreferences> = {
    launchAtStartup: (document.getElementById('launchAtStartup') as HTMLInputElement)?.checked,
    showInDock: (document.getElementById('showInDock') as HTMLInputElement)?.checked,
    showInMenuBar: (document.getElementById('showInMenuBar') as HTMLInputElement)?.checked,

    shelf: {
      ...preferencesUI.currentPreferences?.shelf,
      opacity:
        parseFloat((document.getElementById('opacity') as HTMLInputElement)?.value || '100') / 100,
      animationSpeed: (document.getElementById('animationSpeed') as HTMLSelectElement)?.value as
        | 'slow'
        | 'normal'
        | 'fast'
        | 'instant',
      theme: (document.getElementById('theme') as HTMLSelectElement)?.value as
        | 'light'
        | 'dark'
        | 'auto',
      autoHideEmpty: (document.getElementById('autoHide') as HTMLInputElement)?.checked,
      autoHideDelay: parseInt(
        (document.getElementById('autoHideDelay') as HTMLInputElement)?.value || '5000'
      ),
      maxSimultaneous: parseInt(
        (document.getElementById('maxShelves') as HTMLInputElement)?.value || '5'
      ),
      enableScrollingText: (document.getElementById('enableScrollingText') as HTMLInputElement)
        ?.checked,
    },

    shakeDetection: {
      ...preferencesUI.currentPreferences?.shakeDetection,
      enabled: true, // Always enabled for backwards compatibility
      dragShakeEnabled: (document.getElementById('dragShakeEnabled') as HTMLInputElement)?.checked,
      sensitivity: (document.getElementById('sensitivity') as HTMLSelectElement)?.value as
        | 'low'
        | 'medium'
        | 'high',
    },

    shortcuts: {
      ...preferencesUI.currentPreferences?.shortcuts,
      createShelf: getShortcutValue('createShelfShortcut', 'CommandOrControl+Option+S'),
      toggleShelf: getShortcutValue('toggleShelfShortcut', 'CommandOrControl+Shift+D'),
      clearShelf: getShortcutValue('clearShelfShortcut', 'CommandOrControl+Shift+C'),
    },
  };

  try {
    await window.api.invoke('preferences:update', updates);
    showStatus('Preferences saved successfully!');
    preferencesUI.hasChanges = false;
  } catch (error) {
    logger.error('Failed to save preferences:', error);
    showStatus('Failed to save preferences', 'error');
  }
}

// Reset preferences to defaults
async function resetPreferences(): Promise<void> {
  if (confirm('Are you sure you want to reset all preferences to their default values?')) {
    try {
      const defaults = await window.api.invoke<AppPreferences>('preferences:reset');
      updateUI(defaults);
      showStatus('Preferences reset to defaults');
      preferencesUI.hasChanges = false;
    } catch (error) {
      logger.error('Failed to reset preferences:', error);
      showStatus('Failed to reset preferences', 'error');
    }
  }
}

// Show status message
function showStatus(message: string, type: 'success' | 'error' = 'success'): void {
  const statusEl = document.getElementById('statusMessage') as HTMLElement;
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.style.background = type === 'error' ? '#dc3545' : '#28a745';
  statusEl.classList.add('show');

  setTimeout(() => {
    statusEl.classList.remove('show');
  }, 3000);
}

// Warn before closing with unsaved changes
window.addEventListener('beforeunload', e => {
  if (preferencesUI.hasChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Keyboard shortcut recording functionality
function setupShortcutRecording(): void {
  const shortcutInputs = document.querySelectorAll<HTMLInputElement>('.shortcut-input');
  const resetButtons = document.querySelectorAll<HTMLButtonElement>('.reset-shortcut');

  // Default shortcuts
  const defaultShortcuts: Record<string, string> = {
    createShelf: 'CommandOrControl+Option+S',
    toggleShelf: 'CommandOrControl+Shift+D',
    clearShelf: 'CommandOrControl+Shift+C',
  };

  // Track the currently recording input
  let currentlyRecording: HTMLInputElement | null = null;

  shortcutInputs.forEach(input => {
    // Remove readonly initially to allow proper focus
    input.removeAttribute('readonly');

    // Prevent text input by default
    input.addEventListener('keydown', e => {
      if (!input.classList.contains('recording')) {
        e.preventDefault();
      }
    });

    input.addEventListener('focus', () => {
      if (!input.classList.contains('recording')) {
        startRecording(input);
        currentlyRecording = input;
      }
    });

    input.addEventListener('blur', () => {
      // Delay to allow button clicks to process
      setTimeout(() => {
        if (input.classList.contains('recording')) {
          stopRecording(input);
          currentlyRecording = null;
        }
      }, 100);
    });
  });

  // Global keydown handler for recording
  document.addEventListener(
    'keydown',
    e => {
      if (currentlyRecording && currentlyRecording.classList.contains('recording')) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
          stopRecording(currentlyRecording);
          currentlyRecording.blur();
          currentlyRecording = null;
          return;
        }

        const shortcut = recordKeyCombination(e);
        if (shortcut) {
          const input = currentlyRecording;
          input.value = formatShortcutForDisplay(shortcut);
          input.setAttribute('data-shortcut', shortcut);
          stopRecording(input);
          input.blur();
          currentlyRecording = null;
          preferencesUI.hasChanges = true;
        }
      }
    },
    true
  ); // Use capture phase

  resetButtons.forEach(button => {
    button.addEventListener('click', e => {
      e.preventDefault();
      const shortcutType = button.getAttribute('data-shortcut');
      if (shortcutType && defaultShortcuts[shortcutType]) {
        const input = document.getElementById(`${shortcutType}Shortcut`) as HTMLInputElement;
        if (input) {
          input.value = formatShortcutForDisplay(defaultShortcuts[shortcutType]);
          input.setAttribute('data-shortcut', defaultShortcuts[shortcutType]);
          preferencesUI.hasChanges = true;
        }
      }
    });
  });
}

function startRecording(input: HTMLInputElement): void {
  input.classList.add('recording');
  input.value = 'Press keys...';
  input.focus();
}

function stopRecording(input: HTMLInputElement): void {
  input.classList.remove('recording');
  const currentShortcut = input.getAttribute('data-shortcut');
  if (currentShortcut) {
    input.value = formatShortcutForDisplay(currentShortcut);
  } else {
    // Restore original value
    const prefs = preferencesUI.currentPreferences;
    if (prefs) {
      const inputId = input.id;
      if (inputId === 'createShelfShortcut') {
        input.value = formatShortcutForDisplay(prefs.shortcuts.createShelf);
      } else if (inputId === 'toggleShelfShortcut') {
        input.value = formatShortcutForDisplay(prefs.shortcuts.toggleShelf);
      } else if (inputId === 'clearShelfShortcut') {
        input.value = formatShortcutForDisplay(prefs.shortcuts.clearShelf);
      }
    }
  }
}

function recordKeyCombination(e: KeyboardEvent): string | null {
  const keys: string[] = [];

  // Check for modifier keys
  if (e.ctrlKey || e.metaKey) keys.push('CommandOrControl');
  if (e.altKey) keys.push('Alt'); // Will be formatted for display later
  if (e.shiftKey) keys.push('Shift');

  // Get the main key
  let mainKey = e.key;

  // Skip if only modifier keys are pressed
  if (['Control', 'Meta', 'Alt', 'Shift', 'Command', 'Option'].includes(mainKey)) {
    return null;
  }

  // Normalize key names for Electron
  const keyMap: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ' ': 'Space',
    Enter: 'Return',
    Escape: 'Escape',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Tab: 'Tab',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
  };

  // Handle special characters and function keys
  if (mainKey.length === 1) {
    // Single character - uppercase it
    mainKey = mainKey.toUpperCase();
  } else if (mainKey.startsWith('F') && /^F\d+$/.test(mainKey)) {
    // Function key - keep as is
  } else {
    // Use the mapping or keep the original
    mainKey = keyMap[mainKey] || mainKey;
  }

  // Require at least one modifier key for safety (except for function keys)
  if (keys.length === 0 && !mainKey.startsWith('F')) {
    return null;
  }

  keys.push(mainKey);
  return keys.join('+');
}

function formatShortcutForDisplay(shortcut: string): string {
  if (!shortcut) return '';

  // Convert Electron accelerator format to display format
  // Detect platform based on user agent
  const isMac = navigator.userAgent.includes('Mac');

  return shortcut
    .replace('CommandOrControl', isMac ? 'Cmd' : 'Ctrl')
    .replace('Alt', isMac ? 'Option' : 'Alt')
    .replace('Return', 'Enter');
}

function formatShortcutForElectron(shortcut: string): string {
  if (!shortcut) return '';

  // Convert display format to Electron accelerator format
  // Detect platform based on user agent
  const isMac = navigator.userAgent.includes('Mac');

  return shortcut
    .replace(isMac ? 'Cmd' : 'Ctrl', 'CommandOrControl')
    .replace(isMac ? 'Option' : 'Alt', 'Alt')
    .replace('Enter', 'Return');
}

function getShortcutValue(inputId: string, defaultValue: string): string {
  const input = document.getElementById(inputId) as HTMLInputElement;
  if (!input) return defaultValue;

  // Get the stored shortcut or use current display value
  const storedShortcut = input.getAttribute('data-shortcut');
  if (storedShortcut) {
    return storedShortcut;
  }

  // Convert display value to Electron format
  return formatShortcutForElectron(input.value) || defaultValue;
}
