/**
 * Translation Cache Service (chrome.storage.local)
 * Manages caching translations with a 24-hour (1-day) TTL and automatic pruning
 */

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (1 day)
export const CACHE_PREFIX = 'st_cache_';

/**
 * Generate a deterministic hash key for cached translations
 * @param {string} text
 * @param {string} fromLang
 * @param {string} toLang
 * @returns {Promise<string>}
 */
export async function getCacheKey(text, fromLang = 'auto', toLang = 'en') {
  const normalized = (text || '').trim();
  let hashStr = '';

  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    try {
      const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
      hashStr = Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32);
    } catch {
      // Fallback to manual hashing if subtle crypto fails
    }
  }

  if (!hashStr) {
    // Fast 32-bit FNV-1a / DJB2 combination
    let hash = 5381;
    for (let i = 0; i < normalized.length; i++) {
      hash = ((hash << 5) + hash) + normalized.charCodeAt(i);
      hash |= 0;
    }
    hashStr = Math.abs(hash).toString(16);
  }

  return `${CACHE_PREFIX}${fromLang}_${toLang}_${hashStr}`;
}

/**
 * Retrieve cached translation if valid and not expired
 * @param {string} text
 * @param {string} fromLang
 * @param {string} toLang
 * @returns {Promise<{ translatedText: string, detectedLang: string, targetLang: string } | null>}
 */
export async function getCachedTranslation(text, fromLang = 'auto', toLang = 'en') {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;

  try {
    const key = await getCacheKey(text, fromLang, toLang);
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime?.lastError || !result || !result[key]) {
          resolve(null);
          return;
        }

        const entry = result[key];
        const age = Date.now() - (entry.timestamp || 0);

        if (age >= CACHE_TTL_MS) {
          // Expired - clean it up in background
          chrome.storage.local.remove([key]);
          resolve(null);
          return;
        }

        resolve({
          translatedText: entry.translatedText,
          detectedLang: entry.detectedLang,
          targetLang: entry.targetLang
        });
      });
    });
  } catch (err) {
    console.warn('[Slack Translator] Cache read error:', err);
    return null;
  }
}

/**
 * Store translation in local cache with current timestamp
 * @param {string} text
 * @param {string} fromLang
 * @param {string} toLang
 * @param {object} result
 * @param {string} result.translatedText
 * @param {string} result.detectedLang
 * @param {string} result.targetLang
 * @returns {Promise<void>}
 */
export async function setCachedTranslation(text, fromLang = 'auto', toLang = 'en', result = {}) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  try {
    const key = await getCacheKey(text, fromLang, toLang);
    const entry = {
      translatedText: result.translatedText,
      detectedLang: result.detectedLang,
      targetLang: result.targetLang,
      timestamp: Date.now()
    };

    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: entry }, () => {
        resolve();
      });
    });
  } catch (err) {
    console.warn('[Slack Translator] Cache write error:', err);
  }
}

/**
 * Prune all expired translations from chrome.storage.local
 * @returns {Promise<number>} Number of pruned keys
 */
export async function pruneExpiredCache() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return 0;

  return new Promise((resolve) => {
    chrome.storage.local.get(null, (allData) => {
      if (chrome.runtime?.lastError || !allData) {
        resolve(0);
        return;
      }

      const now = Date.now();
      const keysToRemove = [];

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(CACHE_PREFIX)) {
          if (!value || !value.timestamp || now - value.timestamp >= CACHE_TTL_MS) {
            keysToRemove.push(key);
          }
        }
      }

      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove, () => {
          resolve(keysToRemove.length);
        });
      } else {
        resolve(0);
      }
    });
  });
}

/**
 * Clear all translation cache entries
 * @returns {Promise<void>}
 */
export async function clearAllCache() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  return new Promise((resolve) => {
    chrome.storage.local.get(null, (allData) => {
      if (chrome.runtime?.lastError || !allData) {
        resolve();
        return;
      }

      const keysToRemove = Object.keys(allData).filter((k) => k.startsWith(CACHE_PREFIX));
      if (keysToRemove.length > 0) {
        chrome.storage.local.remove(keysToRemove, () => resolve());
      } else {
        resolve();
      }
    });
  });
}
