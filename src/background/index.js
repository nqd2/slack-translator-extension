import { translateText } from '../services/translator.js';
import {
  getCachedTranslation,
  setCachedTranslation,
  pruneExpiredCache,
  clearAllCache
} from '../services/cache.js';

// Open options page on extension action icon click
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// Run cache pruning on service worker initialization
pruneExpiredCache().catch((err) => {
  console.warn('[Slack Translator] Cache prune error:', err);
});

async function handleTranslate({ text, fromLang = 'auto', toLang = 'en' }) {
  if (!text || !text.trim()) {
    throw new Error('Empty text provided for translation');
  }

  // Skip translation if source and target are explicitly identical
  if (fromLang !== 'auto' && fromLang === toLang) {
    return {
      translatedText: text,
      detectedLang: fromLang,
      targetLang: toLang,
      fromCache: true
    };
  }

  // 1. Check local cache (TTL 24h)
  const cached = await getCachedTranslation(text, fromLang, toLang);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  // 2. Fetch from Google Translate API
  const result = await translateText({ text, fromLang, toLang });

  // 3. Persist in local cache
  await setCachedTranslation(text, fromLang, toLang, result);

  return { ...result, fromCache: false };
}

// Handle incoming messages from content scripts and options page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslate(request)
      .then((result) => sendResponse({ success: true, ...result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'clearCache') {
    clearAllCache()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

