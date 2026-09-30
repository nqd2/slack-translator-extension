/**
 * Background Service Worker (Manifest V3)
 * Proxies translation requests to bypass Slack CSP and handles action clicks
 */
import { translateText } from '../services/translator.js';

// Open options page on extension action icon click
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// Handle incoming messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    translateText(request)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});
