/**
 * Accordion Translation Widget
 * Manages UI lifecycle, state transitions, and DOM interactions for Slack messages
 */
import { requestTranslation } from './messaging.js';
import { globalPrefetchQueue } from './prefetch-queue.js';

const ICONS = {
  translate: `<svg class="___sgt-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`,
  chevron: `<svg class="___sgt-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  copy: `<svg class="___sgt-action-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  check: `<svg class="___sgt-action-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
};

export class AccordionWidget {
  /**
   * @param {HTMLElement} messageNode - The Slack message node
   * @param {string} sourceText - Raw message text to translate
   * @param {() => object} getSettings - Function to get current settings
   */
  constructor(messageNode, sourceText, getSettings) {
    this.messageNode = messageNode;
    this.sourceText = sourceText;
    this.getSettings = getSettings;

    this.isTranslated = false;
    this.isExpanded = false;
    this.isLoading = false;
    this.isPrefetching = false;
    this.prefetchPromise = null;
    this.translatedText = '';
    this.detectedLang = '';

    this.actionContainer = null;
    this.triggerButton = null;
    this.translationBox = null;

    this.init();
  }

  init() {
    this.createTriggerButton();
    this.createTranslationBox();

    this.messageNode.appendChild(this.actionContainer);
    this.messageNode.appendChild(this.translationBox);

    // Register with viewport prefetch queue
    globalPrefetchQueue.observe(this, this.messageNode);
  }

  createTriggerButton() {
    this.actionContainer = document.createElement('div');
    this.actionContainer.className = '___sgt-action-container';

    this.triggerButton = document.createElement('button');
    this.triggerButton.type = 'button';
    this.triggerButton.className = '___sgt-translate-trigger';

    const settings = this.getSettings();
    const label = settings.translateLabel || 'View Translation';

    this.triggerButton.innerHTML = `
      ${ICONS.translate}
      <span class="___sgt-btn-label">${this.escape(label)}</span>
      ${ICONS.chevron}
    `;

    this.triggerButton.addEventListener('click', (e) => this.handleTriggerClick(e));
    this.actionContainer.appendChild(this.triggerButton);
  }

  createTranslationBox() {
    this.translationBox = document.createElement('div');
    this.translationBox.className = '___sgt-translation-box';
    this.translationBox.style.display = 'none';
  }

  /**
   * Background pre-fetch without opening UI
   * @returns {Promise<void>}
   */
  async prefetch() {
    if (this.isTranslated || this.isPrefetching || this.isLoading) {
      return this.prefetchPromise;
    }

    const settings = this.getSettings();
    this.isPrefetching = true;

    this.prefetchPromise = (async () => {
      try {
        const response = await requestTranslation({
          text: this.sourceText,
          fromLang: settings.translateFrom || 'auto',
          toLang: settings.translateTo || 'en'
        });

        this.isTranslated = true;
        this.translatedText = response.translatedText;
        this.detectedLang = response.detectedLang || settings.translateFrom;
        this.renderContent(response.targetLang || settings.translateTo);
      } catch {
        // Pre-fetch failures are non-blocking; on-demand click will handle retry
      } finally {
        this.isPrefetching = false;
      }
    })();

    return this.prefetchPromise;
  }

  async handleTriggerClick(e) {
    e.stopPropagation();

    if (this.isLoading) return;

    // Remove from background prefetch queue if clicked early
    globalPrefetchQueue.remove(this);

    // 0ms instant toggle if already pre-fetched
    if (this.isTranslated) {
      this.toggleAccordion();
      return;
    }

    // If prefetch is in flight, await it with loading indicator
    if (this.isPrefetching && this.prefetchPromise) {
      this.setLoading(true);
      try {
        await this.prefetchPromise;
        this.setLoading(false);
        if (this.isTranslated) {
          this.toggleAccordion();
          return;
        }
      } catch {
        this.setLoading(false);
      }
    }

    // Direct on-demand fetch fallback
    await this.fetchAndRender();
  }

  async fetchAndRender() {
    this.setLoading(true);
    const settings = this.getSettings();

    try {
      const response = await requestTranslation({
        text: this.sourceText,
        fromLang: settings.translateFrom || 'auto',
        toLang: settings.translateTo || 'en'
      });

      this.isTranslated = true;
      this.translatedText = response.translatedText;
      this.detectedLang = response.detectedLang || settings.translateFrom;

      this.renderContent(response.targetLang || settings.translateTo);
      this.setLoading(false);
      this.toggleAccordion();
      globalPrefetchQueue.unobserve(this, this.messageNode);
    } catch (err) {
      this.setLoading(false);
      console.warn('[Slack Translator] Translation failed:', err);
      const labelSpan = this.triggerButton.querySelector('.___sgt-btn-label');
      if (labelSpan) labelSpan.textContent = 'Error (Click to retry)';
    }
  }

  setLoading(loading) {
    this.isLoading = loading;
    const labelSpan = this.triggerButton.querySelector('.___sgt-btn-label');
    if (loading) {
      this.triggerButton.classList.add('___sgt-loading');
      if (labelSpan) labelSpan.textContent = 'Translating...';
    } else {
      this.triggerButton.classList.remove('___sgt-loading');
    }
  }

  toggleAccordion() {
    this.isExpanded = !this.isExpanded;
    const labelSpan = this.triggerButton.querySelector('.___sgt-btn-label');

    if (this.isExpanded) {
      this.translationBox.style.display = 'block';
      this.triggerButton.classList.add('___sgt-active');
      if (labelSpan) labelSpan.textContent = 'Hide Translation';
    } else {
      this.translationBox.style.display = 'none';
      this.triggerButton.classList.remove('___sgt-active');
      const settings = this.getSettings();
      if (labelSpan) labelSpan.textContent = settings.translateLabel || 'Show Translation';
    }
  }

  renderContent(targetLang) {
    this.translationBox.innerHTML = `
      <div class="___sgt-box-header">
        <div class="___sgt-box-meta">
          <span class="___sgt-provider-badge">Google Translate</span>
          <span class="___sgt-lang-pair">${this.escape(this.detectedLang)} &rarr; ${this.escape(targetLang)}</span>
        </div>
        <div class="___sgt-box-controls">
          <button type="button" class="___sgt-btn-copy" title="Copy translated text">
            ${ICONS.copy}
            <span class="___sgt-copy-text">Copy</span>
          </button>
          <button type="button" class="___sgt-btn-close" title="Hide translation">&times;</button>
        </div>
      </div>
      <div class="___sgt-box-body">
        <div class="___sgt-translated-text p-rich_text_block">${this.sanitize(this.translatedText)}</div>
      </div>
      <div class="___sgt-box-footer">
        <a href="https://translate.google.com/" target="_blank" rel="noopener noreferrer" class="___sgt-attribution-link">
          Google Translate
        </a>
      </div>
    `;

    // Bind copy button
    const copyBtn = this.translationBox.querySelector('.___sgt-btn-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => this.handleCopy(e, copyBtn));
    }

    // Bind close button
    const closeBtn = this.translationBox.querySelector('.___sgt-btn-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isExpanded) this.toggleAccordion();
      });
    }
  }

  async handleCopy(e, copyBtn) {
    e.stopPropagation();
    try {
      const textElement = this.translationBox.querySelector('.___sgt-translated-text');
      const textToCopy = textElement ? textElement.innerText : this.translatedText;
      await navigator.clipboard.writeText(textToCopy);
      copyBtn.classList.add('___sgt-copied');
      copyBtn.innerHTML = `${ICONS.check} <span class="___sgt-copy-text">Copied!</span>`;
      setTimeout(() => {
        copyBtn.classList.remove('___sgt-copied');
        copyBtn.innerHTML = `${ICONS.copy} <span class="___sgt-copy-text">Copy</span>`;
      }, 2000);
    } catch (err) {
      console.error('[Slack Translator] Clipboard error:', err);
    }
  }

  sanitize(html) {
    if (!html) return '';
    try {
      const template = document.createElement('template');
      template.innerHTML = html;

      // Strip dangerous HTML tags
      const dangerousTags = ['script', 'iframe', 'object', 'embed', 'link', 'style', 'base', 'meta'];
      dangerousTags.forEach((tag) => {
        template.content.querySelectorAll(tag).forEach((el) => el.remove());
      });

      // Strip dangerous attributes (inline event handlers, JS links)
      template.content.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase();
          const val = attr.value.trim().toLowerCase();
          if (name.startsWith('on') || val.startsWith('javascript:') || val.startsWith('data:text/html')) {
            el.removeAttribute(attr.name);
          }
        }
      });

      return template.innerHTML;
    } catch {
      return this.escape(html);
    }
  }

  escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
