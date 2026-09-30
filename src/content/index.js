/**
 * Content Script Entrypoint
 * Bootstraps configuration and starts Slack DOM observer
 */
import { getSettings, onSettingsChange } from '../services/storage.js';
import { SlackObserver } from './slack-observer.js';

let currentSettings = {};

async function bootstrap() {
  currentSettings = await getSettings();

  // Listen for live configuration changes from options page
  onSettingsChange((updated) => {
    currentSettings = { ...currentSettings, ...updated };
  });

  const observer = new SlackObserver(() => currentSettings);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => observer.start());
  } else {
    observer.start();
  }
}

bootstrap();
