# Slack Translator Chrome Extension (Manifest V3)

> Slack Translator is a Chrome Extension that can translate Slack messages directly in the Slack web app while keeping the original messages intact.

![Slack Translator](https://i.imgur.com/QrVTDBb.png)

## ✨ Features (v0.1.0)

- **Manifest V3 Compliant**: Built with the latest Chrome Extension Manifest V3 standards using event-driven Background Service Workers.
- **Non-Destructive Accordion Toggle**: Preserves the original message text, formatting, emojis, mentions, and code blocks. Displays translations in an expandable/collapsible quote box below the message.
- **Slack CSP Immunity**: Network requests are proxied securely through the Background Service Worker, bypassing Slack's strict Content Security Policy (CSP).
- **Fast 1-Click Copy**: Built-in copy button with instant feedback to quickly copy translated text.
- **Live Settings Sync**: Changes made in Settings are applied in real time to open Slack tabs without needing a page refresh.
- **Cross-Platform Build**: Packages extension directly with native `tar` (`bsdtar`) into `build/slack-translator.zip` on Windows, macOS, and Linux without external zip dependencies.

## 🚀 How to Install & Develop

1. Clone or download this repository.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run development mode (auto-watches `src/` and updates `dist/` in real time):
   ```bash
   pnpm dev
   ```
4. Open Chrome and navigate to `chrome://extensions/`.
5. Enable **Developer mode** (toggle in the top-right corner).
6. Click **Load unpacked** and select the [`dist/`](file:///c:/Users/ducnq/Code/slack-translate-extension-1.0.4/dist) folder.
7. Open [Slack Web App](https://app.slack.com/client/) to start translating!

## 📦 Packaging for Production

Run the build script:

```bash
pnpm build
```

This will bundle JavaScript with `esbuild`, copy all static assets to `dist/`, and package it into `build/slack-translator.zip` using system `bsdtar`.

---

### License
The project is published under the [MIT license](/LICENSE).

*This project is not affiliated with Slack or Google Translate.*