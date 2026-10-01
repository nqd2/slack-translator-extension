/**
 * Token Protector for Machine Translation
 * Preserves Slack special tokens (mentions, channels, emojis, code blocks, URLs)
 * from being altered or broken by Google Translate.
 */

const TOKEN_PREFIX = 'SLKTOKEN_';

export function protectTokens(text) {
  if (!text || typeof text !== 'string') {
    return {
      protectedText: text || '',
      restore: (str) => str || ''
    };
  }

  const tokens = [];

  // Patterns to protect, matched in order of specificity
  const combinedRegex = new RegExp(
    [
      // 1. Multiline code blocks: ```...```
      '(```[\\s\\S]*?```)',
      // 2. Inline code: `...`
      '(`[^`\\n]+`)',
      // 3. URLs
      '(https?:\\/\\/[^\\s<]+)',
      // 4. Slack user/channel IDs: <@U12345|name>, <#C12345|name>, <!subteam^S123|name>
      '(<[@#!][A-Za-z0-9_\\-\\^]+(?:\\|[^>]+)?>)',
      // 5. Plain mentions: @here, @channel, @everyone, @username
      '(@[\\w.\\-]+)',
      // 6. Slack emojis: :smile:, :+1:, etc.
      '(:[a-zA-Z0-9_\\-\\+]+:)',
      // 7. Plain channels: #channel-name
      '(#[a-zA-Z0-9_\\-]+)'
    ].join('|'),
    'g'
  );

  const protectedText = text.replace(combinedRegex, (match) => {
    const id = tokens.length;
    tokens.push(match);
    return `__${TOKEN_PREFIX}${id}__`;
  });

  const restore = (translatedText) => {
    if (!translatedText || tokens.length === 0) {
      return translatedText || '';
    }

    // Matches __SLKTOKEN_0__, __ slktoken_0 __, slktoken_0, etc.
    const restoreRegex = /_{0,2}\s*slktoken_?(\d+)\s*_{0,2}/gi;

    return translatedText.replace(restoreRegex, (match, indexStr) => {
      const idx = parseInt(indexStr, 10);
      if (idx >= 0 && idx < tokens.length) {
        return tokens[idx];
      }
      return match;
    });
  };

  return { protectedText, restore };
}
