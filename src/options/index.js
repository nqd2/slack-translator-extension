/**
 * Options Page Controller
 * Manages language configuration, regex filtering, and live persistence
 */
import { LANGUAGES } from '../constants/languages.js';
import { getSettings, setSettings, resetSettings } from '../services/storage.js';

const translateFrom = document.querySelector('#translate-from-dropdown');
const translateTo = document.querySelector('#translate-to-dropdown');
const translateLabel = document.querySelector('#translate-label');
const translateRegex = document.querySelector('#translate-regex');
const translateReset = document.querySelector('#translate-reset');
const regexCard = document.querySelector('#show-regex-card');
const toast = document.querySelector('#toast');

let toastTimer = null;
function showToast(message = 'Settings saved') {
  if (!toast) return;
  toast.textContent = message;
  toast.removeAttribute('hidden');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.setAttribute('hidden', ''), 200);
  }, 2200);
}

function generateLanguageDropdown(selectElement, prefix) {
  const fragment = document.createDocumentFragment();
  Object.keys(LANGUAGES).forEach((langName) => {
    const option = document.createElement('option');
    option.value = LANGUAGES[langName];
    option.id = `${prefix}${LANGUAGES[langName]}`;
    option.textContent = langName;
    fragment.appendChild(option);
  });
  selectElement.appendChild(fragment);
}

function init() {
  generateLanguageDropdown(translateFrom, 'from-');
  generateLanguageDropdown(translateTo, 'to-');

  // Load existing settings
  getSettings().then((settings) => {
    const fromOption = document.querySelector(`#from-${settings.translateFrom}`);
    if (fromOption) fromOption.selected = true;

    const toOption = document.querySelector(`#to-${settings.translateTo}`);
    if (toOption) toOption.selected = true;

    translateLabel.value = settings.translateLabel || '';
    translateRegex.value = settings.translateRegex || '';
  });

  // Event bindings
  translateFrom.addEventListener('change', async (e) => {
    await setSettings({ translateFrom: e.target.value });
    showToast('Source language updated');
  });

  translateTo.addEventListener('change', async (e) => {
    await setSettings({ translateTo: e.target.value });
    showToast('Target language updated');
  });

  translateLabel.addEventListener('blur', async (e) => {
    await setSettings({ translateLabel: e.target.value.trim() });
    showToast('Button label updated');
  });

  translateRegex.addEventListener('blur', async (e) => {
    const val = e.target.value.trim();
    if (!val) {
      e.target.removeAttribute('error');
      await setSettings({ translateRegex: '' });
      showToast('Regex filter cleared');
      return;
    }

    try {
      const match = val.match(new RegExp('^/(.*?)/([gimy]*)$'));
      if (!match) throw new Error('Invalid format');
      new RegExp(match[1], match[2]);
      e.target.removeAttribute('error');
      await setSettings({ translateRegex: val });
      showToast('Regex filter updated');
    } catch {
      e.target.setAttribute('error', '');
      await setSettings({ translateRegex: '' });
      showToast('Invalid Regex pattern (expected /pattern/flags)');
    }
  });

  const translateClearCache = document.querySelector('#translate-clear-cache');
  if (translateClearCache) {
    translateClearCache.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'clearCache' }, () => {
        showToast('Translation cache cleared');
      });
    });
  }

  translateReset.addEventListener('click', async () => {
    await resetSettings();
    chrome.runtime.sendMessage({ action: 'clearCache' });
    showToast('Restored default settings & cleared cache');
    setTimeout(() => window.location.reload(), 400);
  });

  if (regexCard) {
    regexCard.addEventListener('click', (e) => {
      document.querySelector('.regex-card').removeAttribute('hidden');
      e.target.remove();
    });
  }
}

init();
