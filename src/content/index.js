/**
 * Content Script Entrypoint
 * Bootstraps configuration and starts Slack DOM observer
 */
import { getSettings, onSettingsChange } from '../services/storage.js';
import { SlackObserver } from './slack-observer.js';
import { ComposerTranslator } from './composer-translator.js';

let currentSettings = {};

async function bootstrap() {
  currentSettings = await getSettings();

  // Listen for live configuration changes from options page
  onSettingsChange((updated) => {
    currentSettings = { ...currentSettings, ...updated };
  });

  const observer = new SlackObserver(() => currentSettings);
  const composerTranslator = new ComposerTranslator(() => currentSettings);

  const startAll = () => {
    observer.start();
    composerTranslator.start();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAll);
  } else {
    startAll();
  }
}

bootstrap();
