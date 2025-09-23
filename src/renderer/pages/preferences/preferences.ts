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
  const shakeEnabledEl = document.getElementById('shakeEnabled') as HTMLInputElement;
  const sensitivityEl = document.getElementById('sensitivity') as HTMLSelectElement;

  if (shakeEnabledEl) shakeEnabledEl.checked = prefs.shakeDetection.enabled;
  if (sensitivityEl) sensitivityEl.value = prefs.shakeDetection.sensitivity;

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

  // Plugin manager button
  const pluginManagerButton = document.getElementById('openPluginManagerButton');
  pluginManagerButton?.addEventListener('click', () => {
    // Open plugin manager in a new window
    window.open('/plugins.html', 'plugin-manager', 'width=900,height=700');
  });

  // Prevent form submission on Enter
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
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
      enabled: (document.getElementById('shakeEnabled') as HTMLInputElement)?.checked,
      sensitivity: (document.getElementById('sensitivity') as HTMLSelectElement)?.value as
        | 'low'
        | 'medium'
        | 'high',
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
