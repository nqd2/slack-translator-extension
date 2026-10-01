# Slack Translator Chrome Extension (Manifest V3)

> Slack Translator is a Chrome Extension that can translate Slack messages directly in the Slack web app while keeping the original messages intact.

## Features (v0.3.0)

- **Outgoing Message Composer Translator**: Translate your draft message directly in Slack's composer toolbar before sending, with 1-click translation or keyboard shortcut (`Ctrl+Shift+T` / `Cmd+Shift+T`).
- **Smart Token & Mention Protection**: Intelligently safeguards Slack user/channel mentions, emojis, URLs, and code blocks (`...` and ```...```) so they remain untouched during translation.
- **Composer Language Selector & Quick Swap**: Integrated source/target language dropdowns with quick search and swap button directly in the formatting bar.
- **Instant Undo Toast**: Non-destructive translation with a floating Undo toast and timeout to quickly revert changes if needed.
- **Rich Text & Layout Preservation**: Preserves paragraph breaks, line breaks (`<br>`), blockquotes, code blocks, lists, emojis, and `@channel` / `@user` mentions with native Slack styling for incoming messages.
- **Viewport Pre-fetch & Zero Latency**: Automatically pre-fetches translations in the background for visible and upcoming messages as you scroll (200px margin). Clicking "View Translation" opens the translation instantly in 0ms!
- **1-Day (24h) TTL Smart Cache**: Pre-fetched translations are stored in `chrome.storage.local` with automatic 24-hour expiration and background pruning.
- **Rate-Limit Safe Concurrency Queue**: Enforces a strict concurrency limit (max 3 concurrent requests) with smart cancellation when users rapidly scroll past messages.
- **Non-Destructive Accordion Toggle**: Displays translations in a sleek, non-intrusive collapsible card below the message.
- **Fast 1-Click Copy**: Built-in copy button with formatted text copying.
- **Live Settings Sync**: Changes made in Settings are applied in real time to open Slack tabs without needing a page refresh.

### License
The project is published under the [MIT license](/LICENSE).

*This project is not affiliated with Slack or Google Translate.*