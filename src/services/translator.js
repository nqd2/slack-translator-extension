/**
 * Google Translate Service
 * Handles API calls, text formatting, and error parsing
 */

const BASE_URL = 'https://translate.googleapis.com/translate_a/single';

/**
 * Translate text using Google Translate GTX endpoint
 * @param {object} params
 * @param {string} params.text - The raw text to translate
 * @param {string} [params.fromLang='auto'] - Source language code
 * @param {string} [params.toLang='en'] - Target language code
 * @returns {Promise<{ translatedText: string, detectedLang: string, targetLang: string }>}
 */
export async function translateText({ text, fromLang = 'auto', toLang = 'en' }) {
  if (!text || !text.trim()) {
    throw new Error('Empty text provided for translation');
  }

  const queryParams = new URLSearchParams({
    client: 'gtx',
    sl: fromLang,
    tl: toLang,
    dt: 't',
    q: text
  });

  const url = `${BASE_URL}?${queryParams.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Translate API error: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data[0])) {
    throw new Error('Malformed translation response from API');
  }

  // Combine segmented translation chunks
  const translatedText = data[0]
    .map((chunk) => (chunk && chunk[0] ? chunk[0] : ''))
    .join('');

  const detectedLang = data[2] || fromLang;

  return {
    translatedText,
    detectedLang,
    targetLang: toLang
  };
}
