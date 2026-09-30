/**
 * Content Script Messaging Client
 * Sends translation requests to the Background Service Worker
 */

/**
 * Request translation from background service worker
 * @param {object} params
 * @param {string} params.text - Raw text
 * @param {string} params.fromLang - Source language code
 * @param {string} params.toLang - Target language code
 * @returns {Promise<{ translatedText: string, detectedLang: string, targetLang: string }>}
 */
export function requestTranslation({ text, fromLang, toLang }) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: 'translate',
        text,
        fromLang,
        toLang
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.success) {
          reject(new Error((response && response.error) || 'Translation request failed'));
          return;
        }
        resolve(response);
      }
    );
  });
}
