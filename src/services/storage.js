/**
 * Storage Service - Wrapper for chrome.storage.sync
 */

export const DEFAULT_SETTINGS = Object.freeze({
  translateFrom: 'auto',
  translateTo: 'en',
  outgoingTranslateFrom: 'auto',
  outgoingTranslateTo: 'en',
  translateLabel: 'View Translation',
  translateRegex: ''
});

/**
 * Retrieve current settings with defaults
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
      resolve({ ...DEFAULT_SETTINGS, ...items });
    });
  });
}

/**
 * Update partial settings
 * @param {Partial<typeof DEFAULT_SETTINGS>} partialSettings
 * @returns {Promise<void>}
 */
export async function setSettings(partialSettings) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(partialSettings, () => {
      resolve();
    });
  });
}

/**
 * Reset settings to default values
 * @returns {Promise<void>}
 */
export async function resetSettings() {
  return setSettings(DEFAULT_SETTINGS);
}

/**
 * Listen for live settings changes across tabs
 * @param {(newSettings: Partial<typeof DEFAULT_SETTINGS>) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onSettingsChange(callback) {
  const listener = (changes, area) => {
    if (area !== 'sync') return;
    const updated = {};
    for (const key of Object.keys(changes)) {
      if (key in DEFAULT_SETTINGS) {
        updated[key] = changes[key].newValue;
      }
    }
    if (Object.keys(updated).length > 0) {
      callback(updated);
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
