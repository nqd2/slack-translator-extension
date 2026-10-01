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
    try {
      if (!chrome.runtime?.id) {
        reject(
          new Error('Extension đã được cập nhật hoặc reload. Vui lòng tải lại (F5) tab Slack này.')
        );
        return;
      }

      chrome.runtime.sendMessage(
        {
          action: 'translate',
          text,
          fromLang,
          toLang
        },
        (response) => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || '';
            if (msg.includes('Extension context invalidated') || !chrome.runtime?.id) {
              reject(
                new Error('Extension đã được cập nhật hoặc reload. Vui lòng tải lại (F5) tab Slack này.')
              );
            } else {
              reject(new Error(msg));
            }
            return;
          }
          if (!response || !response.success) {
            reject(new Error((response && response.error) || 'Translation request failed'));
            return;
          }
          resolve(response);
        }
      );
    } catch (err) {
      if (err.message && (err.message.includes('Extension context invalidated') || !chrome.runtime?.id)) {
        reject(
          new Error('Extension đã được cập nhật hoặc reload. Vui lòng tải lại (F5) tab Slack này.')
        );
      } else {
        reject(err);
      }
    }
  });
}
