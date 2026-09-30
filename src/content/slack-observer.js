/**
 * Slack Message DOM Observer
 * Watches Slack's virtualized list and attaches translation widgets
 */
import { AccordionWidget } from './accordion-widget.js';

export class SlackObserver {
  /**
   * @param {() => object} getSettings - Function to retrieve latest settings
   */
  constructor(getSettings) {
    this.getSettings = getSettings;
    this.isScheduled = false;
    this.observer = null;
  }

  start() {
    const root = document.querySelector('.p-client_workspace') || document.body;
    if (!root) {
      setTimeout(() => this.start(), 1000);
      return;
    }

    this.observer = new MutationObserver(() => this.scheduleScan());
    this.observer.observe(root, { childList: true, subtree: true });

    this.scheduleScan();
  }

  scheduleScan() {
    if (this.isScheduled) return;
    this.isScheduled = true;

    requestAnimationFrame(() => {
      this.scanMessages();
      this.isScheduled = false;
    });
  }

  scanMessages() {
    const messageNodes = document.querySelectorAll(
      '.p-rich_text_block:not([data-translate-ready])'
    );

    messageNodes.forEach((node) => this.processNode(node));
  }

  processNode(node) {
    // Never process our own translation boxes
    if (node.closest('.___sgt-translation-box')) return;
    if (node.dataset.translateReady) return;
    node.dataset.translateReady = 'true';

    const { sourceHtml, plainText } = this.extractContent(node);
    if (!plainText && !sourceHtml) return;

    if (!this.matchesRegex(plainText)) return;

    new AccordionWidget(node, sourceHtml, this.getSettings);
  }

  extractContent(node) {
    const clone = node.cloneNode(true);
    const elementsToRemove = clone.querySelectorAll(
      '.c-message__edited_label, .___sgt-action-container, .___sgt-translation-box'
    );
    elementsToRemove.forEach((el) => el.remove());

    delete clone.dataset.translateReady;

    const sourceHtml = clone.innerHTML ? clone.innerHTML.trim() : '';
    const plainText = node.innerText ? node.innerText.trim() : (clone.textContent ? clone.textContent.trim() : '');

    return { sourceHtml, plainText };
  }

  matchesRegex(text) {
    const settings = this.getSettings();
    if (!settings.translateRegex) return true;

    try {
      const match = settings.translateRegex.match(new RegExp('^/(.*?)/([gimy]*)$'));
      if (match) {
        const regex = new RegExp(match[1], match[2]);
        return regex.test(text);
      }
    } catch {
      // In case of invalid regex format, fallback to accepting
    }
    return true;
  }
}
