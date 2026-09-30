# Slack Translator Chrome Extension (Manifest V3)

> Slack Translator is a Chrome Extension that can translate Slack messages directly in the Slack web app while keeping the original messages intact.

## Features (v0.2.0)

- **Viewport Pre-fetch & Zero Latency**: Automatically pre-fetches translations in the background for visible and upcoming messages as you scroll (200px margin, inspired by Instagram's feed pre-fetching). Clicking "View Translation" opens the translation instantly in 0ms!
- **1-Day (24h) TTL Smart Cache**: Pre-fetched translations are stored in `chrome.storage.local` with automatic 24-hour expiration and background pruning, saving bandwidth and preventing redundant network requests.
- **Rate-Limit Safe Concurrency Queue**: Enforces a strict concurrency limit (max 3 concurrent requests) with smart cancellation when users rapidly scroll past messages.
- **Non-Destructive Accordion Toggle**: Preserves the original message text, formatting, emojis, mentions, and code blocks. Displays translations in an expandable/collapsible quote box below the message.
- **Fast 1-Click Copy**: Built-in copy button with instant feedback to quickly copy translated text.
- **Live Settings Sync**: Changes made in Settings are applied in real time to open Slack tabs without needing a page refresh.

### License
The project is published under the [MIT license](/LICENSE).

*This project is not affiliated with Slack or Google Translate.*