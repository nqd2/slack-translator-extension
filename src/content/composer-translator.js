/**
 * Composer Translator for Slack
 * Injects Translate icon button and 2 language dropdowns (source & target) with swap button
 * directly into Slack's top sticky formatting bar (.p-texty_sticky_formatting_bar .p-composer__body).
 */

import { LANGUAGES } from '../constants/languages.js';
import { requestTranslation } from './messaging.js';
import { protectTokens } from './token-protector.js';
import { setSettings } from '../services/storage.js';

const POPULAR_LANG_CODES = ['en', 'vi', 'ja', 'ko', 'zh-CN', 'fr', 'de', 'es', 'ru'];

function getLanguageName(code) {
  if (code === 'auto') return 'Auto Detect';
  for (const [name, c] of Object.entries(LANGUAGES)) {
    if (c.toLowerCase() === (code || '').toLowerCase()) return name;
  }
  return code ? code.toUpperCase() : 'English';
}

const ICONS = {
  translate: `<svg class="___sgt-composer-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M10.73 12.56l-2.12-2.09.02-.03c1.45-1.62 2.48-3.48 3.09-5.44H14.17V3.33H8.33V1.67H6.67v1.66H.83v1.66h9.31c-.55 1.62-1.44 3.15-2.64 4.48-.78-.86-1.42-1.8-1.93-2.8H3.88c.61 1.36 1.44 2.64 2.48 3.8l-4.24 4.18 1.18 1.18 4.17-4.17 2.59 2.59.67-1.7zm4.7-4.23h-1.67L9.93 18.33h1.67l.93-2.5h3.96l.93 2.5h1.67L15.43 8.33zm-2.18 5.83l1.35-3.61 1.35 3.61h-2.7z"/></svg>`,
  chevron: `<svg class="___sgt-composer-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 8 10 13 15 8"></polyline></svg>`,
  swap: `<svg class="___sgt-swap-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="12" height="12" fill="currentColor"><path fill-rule="evenodd" d="M13.2 4.2a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1 0 1.06l-3 3a.75.75 0 1 1-1.06-1.06l1.72-1.7H3.75a.75.75 0 0 1 0-1.5h11.17l-1.72-1.74a.75.75 0 0 1 0-1.06ZM6.8 15.8a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 0 1 0-1.06l3-3a.75.75 0 1 1 1.06 1.06l-1.72 1.7h11.17a.75.75 0 0 1 0 1.5H4.08l1.72 1.74a.75.75 0 0 1 0 1.06Z" clip-rule="evenodd"/></svg>`,
  search: `<svg class="___sgt-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  undo: `<svg class="___sgt-undo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>`,
  check: `<svg class="___sgt-undo-check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  close: `<svg class="___sgt-undo-close" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
};

export class ComposerTranslator {
  constructor(getSettings) {
    this.getSettings = getSettings;
    this.activeUndoToast = null;
    this.undoTimeout = null;
    this.observer = null;
    this.isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

    // Portal dropdown state
    this.portalMenu = null;
    this.activeTriggerBtn = null;
    this.currentMode = null; // 'from' or 'to'
  }

  start() {
    this.scanAndAttach();

    // Watch for Slack rendering/toggling formatting bars dynamically
    this.observer = new MutationObserver(() => this.scanAndAttach());
    this.observer.observe(document.body, { childList: true, subtree: true });

    // Global Hotkey (Ctrl+Shift+T or Cmd+Shift+T)
    window.addEventListener('keydown', (e) => this.handleGlobalHotkey(e), true);

    // Close portal menu on click outside, resize, scroll, or Escape
    document.addEventListener('pointerdown', (e) => {
      if (this.portalMenu && this.portalMenu.style.display !== 'none') {
        if (!this.portalMenu.contains(e.target) && (!this.activeTriggerBtn || !this.activeTriggerBtn.contains(e.target))) {
          this.closePortalMenu();
        }
      }
    });

    window.addEventListener('resize', () => this.closePortalMenu(), { passive: true });
    window.addEventListener(
      'scroll',
      (e) => {
        // Do not close if scrolling inside the portal menu itself!
        if (this.portalMenu && (this.portalMenu === e.target || this.portalMenu.contains(e.target))) {
          return;
        }
        this.closePortalMenu();
      },
      { passive: true, capture: true }
    );
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.portalMenu && this.portalMenu.style.display !== 'none') {
        this.closePortalMenu();
      }
    });
  }

  getOutgoingSourceLang() {
    const settings = this.getSettings();
    return settings.outgoingTranslateFrom || 'auto';
  }

  setOutgoingSourceLang(code) {
    setSettings({ outgoingTranslateFrom: code });
    const label = code === 'auto' ? 'AUTO' : code.toUpperCase();
    document.querySelectorAll('.___sgt-from-code').forEach((el) => {
      el.textContent = label;
    });
  }

  getOutgoingTargetLang() {
    const settings = this.getSettings();
    return settings.outgoingTranslateTo || 'en';
  }

  setOutgoingTargetLang(code) {
    setSettings({ outgoingTranslateTo: code });
    document.querySelectorAll('.___sgt-to-code').forEach((el) => {
      el.textContent = code.toUpperCase();
    });
  }

  scanAndAttach() {
    // Specifically search for Slack's formatting bars (.p-texty_sticky_formatting_bar .p-composer__body or .p-composer__body)
    const formattingBodies = document.querySelectorAll(
      '.p-texty_sticky_formatting_bar .p-composer__body, .p-composer__body'
    );

    formattingBodies.forEach((body) => {
      this.attachToFormattingBar(body);
    });
  }

  attachToFormattingBar(formattingBody) {
    // Prevent attaching more than once to the same formatting bar
    if (formattingBody.querySelector('.___sgt-composer-group')) return;

    // Must be a valid formatting bar with buttons
    const hasButtons = formattingBody.querySelector('.p-composer__button, [data-qa="bold-composer-button"]');
    if (!hasButtons) return;

    const group = this.createFormattingGroup(formattingBody);
    formattingBody.appendChild(group);
  }

  findAssociatedEditor(formattingBody) {
    const composerRoot =
      formattingBody.closest('.c-message_composer, [data-qa="message_editor"], [data-qa="texty_composer"], .p-workspace__primary_view, .p-threads_view__footer, .p-threads_flexpane_container') ||
      formattingBody.parentElement.closest('[data-qa="message_editor"], .c-message_composer, .p-workspace__primary_view') ||
      document;

    return composerRoot.querySelector(
      'div[contenteditable="true"][role="textbox"], div.ql-editor[contenteditable="true"]'
    );
  }

  createFormattingGroup(formattingBody) {
    const group = document.createElement('div');
    group.className = '___sgt-composer-group';

    const shortcutText = this.isMac ? '⌘+Shift+T' : 'Ctrl+Shift+T';

    // 1. Separator (matching Slack's .p-composer__separator)
    const sep = document.createElement('span');
    sep.className = 'p-composer__separator';
    group.appendChild(sep);

    // 2. Translate Button (ICON ONLY, matching Slack's formatting button classes)
    const translateBtn = document.createElement('button');
    translateBtn.type = 'button';
    translateBtn.className =
      'c-button-unstyled c-icon_button c-icon_button--size_smedium p-composer__button p-composer__button--composer_ia p-composer__selection_button p-composer__button--sticky c-icon_button--default ___sgt-composer-translate-btn';
    translateBtn.setAttribute('data-qa', 'translate-composer-button');
    translateBtn.setAttribute('aria-label', 'Translate message');
    translateBtn.title = `Dịch tin nhắn trước khi gửi (${shortcutText})`;
    translateBtn.innerHTML = ICONS.translate;

    translateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const editor = this.findAssociatedEditor(formattingBody);
      this.executeTranslation(editor, formattingBody, translateBtn);
    });
    group.appendChild(translateBtn);

    // 3. Source Language Dropdown Trigger
    const fromCode = this.getOutgoingSourceLang();
    const fromLabel = fromCode === 'auto' ? 'AUTO' : fromCode.toUpperCase();

    const fromTrigger = document.createElement('button');
    fromTrigger.type = 'button';
    fromTrigger.className = '___sgt-composer-lang-trigger ___sgt-lang-from';
    fromTrigger.title = 'Ngôn ngữ nguồn (Source Language)';
    fromTrigger.innerHTML = `
      <span class="___sgt-from-code">${fromLabel}</span>
      ${ICONS.chevron}
    `;

    fromTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePortalMenu(fromTrigger, 'from');
    });
    group.appendChild(fromTrigger);

    // 4. Swap Button (Hoán đổi 2 chiều)
    const swapBtn = document.createElement('button');
    swapBtn.type = 'button';
    swapBtn.className = '___sgt-lang-swap-btn';
    swapBtn.title = 'Hoán đổi ngôn ngữ nguồn và đích';
    swapBtn.innerHTML = ICONS.swap;

    swapBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleSwapLanguages();
    });
    group.appendChild(swapBtn);

    // 5. Target Language Dropdown Trigger
    const toCode = this.getOutgoingTargetLang();
    const toLabel = toCode.toUpperCase();

    const toTrigger = document.createElement('button');
    toTrigger.type = 'button';
    toTrigger.className = '___sgt-composer-lang-trigger ___sgt-lang-to';
    toTrigger.title = 'Ngôn ngữ dịch sang (Target Language)';
    toTrigger.innerHTML = `
      <span class="___sgt-to-code">${toLabel}</span>
      ${ICONS.chevron}
    `;

    toTrigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePortalMenu(toTrigger, 'to');
    });
    group.appendChild(toTrigger);

    return group;
  }

  handleSwapLanguages() {
    const currentFrom = this.getOutgoingSourceLang();
    const currentTo = this.getOutgoingTargetLang();

    if (currentFrom === 'auto') {
      // When source is auto, set source to current target and target to vi (or en if target is vi)
      const newFrom = currentTo;
      const newTo = currentTo === 'vi' ? 'en' : 'vi';
      this.setOutgoingSourceLang(newFrom);
      this.setOutgoingTargetLang(newTo);
    } else {
      // Direct swap
      this.setOutgoingSourceLang(currentTo);
      this.setOutgoingTargetLang(currentFrom);
    }
  }

  /* ========================================================================
     Portal Dropdown Menu (Fixed in Body, Screen-Edge Aligned)
     ======================================================================== */
  ensurePortalMenu() {
    if (this.portalMenu) return this.portalMenu;

    const menu = document.createElement('div');
    menu.className = '___sgt-portal-menu';
    menu.id = '___sgt-lang-portal';
    menu.style.display = 'none';

    // 1. Search Box (Fixed Header)
    const searchBox = document.createElement('div');
    searchBox.className = '___sgt-portal-search-box';
    searchBox.innerHTML = `
      ${ICONS.search}
      <input type="text" class="___sgt-portal-search-input" placeholder="Search language..." spellcheck="false" autocomplete="off" />
    `;
    menu.appendChild(searchBox);

    const searchInput = searchBox.querySelector('input');
    searchInput.addEventListener('input', (e) => {
      this.filterLanguageList(e.target.value);
    });
    searchInput.addEventListener('click', (e) => e.stopPropagation());

    // 2. Scrollable List Container (Slim custom scrollbar)
    const scrollList = document.createElement('div');
    scrollList.className = '___sgt-portal-scroll-list';

    // Prevent wheel events from reaching background Slack chat
    scrollList.addEventListener(
      'wheel',
      (e) => {
        e.stopPropagation();
      },
      { passive: true }
    );

    // Auto Detect Item (visible only in 'from' mode)
    const autoOption = document.createElement('button');
    autoOption.type = 'button';
    autoOption.className = '___sgt-lang-item ___sgt-auto-item';
    autoOption.dataset.code = 'auto';
    autoOption.dataset.name = 'auto detect';
    autoOption.innerHTML = `<span class="___sgt-item-name">✨ Auto Detect</span> <span class="___sgt-item-code">AUTO</span>`;
    autoOption.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectLanguage('auto');
    });
    scrollList.appendChild(autoOption);

    // Popular Section
    const popularSection = document.createElement('div');
    popularSection.className = '___sgt-lang-section ___sgt-lang-popular';
    const popularHeader = document.createElement('div');
    popularHeader.className = '___sgt-lang-header';
    popularHeader.textContent = 'Popular';
    popularSection.appendChild(popularHeader);

    POPULAR_LANG_CODES.forEach((code) => {
      const name = getLanguageName(code);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = '___sgt-lang-item';
      item.dataset.code = code;
      item.dataset.name = name.toLowerCase();
      item.innerHTML = `<span class="___sgt-item-name">${name}</span> <span class="___sgt-item-code">${code.toUpperCase()}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectLanguage(code);
      });
      popularSection.appendChild(item);
    });
    scrollList.appendChild(popularSection);

    // All Languages Section
    const allSection = document.createElement('div');
    allSection.className = '___sgt-lang-section ___sgt-lang-all';
    const allHeader = document.createElement('div');
    allHeader.className = '___sgt-lang-header';
    allHeader.textContent = 'All Languages';
    allSection.appendChild(allHeader);

    Object.keys(LANGUAGES)
      .sort()
      .forEach((name) => {
        const code = LANGUAGES[name];
        const item = document.createElement('button');
        item.type = 'button';
        item.className = '___sgt-lang-item';
        item.dataset.code = code;
        item.dataset.name = name.toLowerCase();
        item.innerHTML = `<span class="___sgt-item-name">${name}</span> <span class="___sgt-item-code">${code.toUpperCase()}</span>`;
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectLanguage(code);
        });
        allSection.appendChild(item);
      });
    scrollList.appendChild(allSection);

    menu.appendChild(scrollList);
    document.body.appendChild(menu);
    this.portalMenu = menu;
    return menu;
  }

  togglePortalMenu(triggerBtn, mode) {
    const menu = this.ensurePortalMenu();
    const isOpen = menu.style.display !== 'none' && this.activeTriggerBtn === triggerBtn;

    if (isOpen) {
      this.closePortalMenu();
    } else {
      this.openPortalMenu(triggerBtn, mode);
    }
  }

  openPortalMenu(triggerBtn, mode) {
    const menu = this.ensurePortalMenu();
    this.currentMode = mode;

    if (this.activeTriggerBtn) {
      this.activeTriggerBtn.classList.remove('___sgt-active');
    }

    this.activeTriggerBtn = triggerBtn;
    triggerBtn.classList.add('___sgt-active');

    // Show or hide "Auto Detect" option based on mode
    const autoItem = menu.querySelector('.___sgt-auto-item');
    if (autoItem) {
      autoItem.style.display = mode === 'from' ? 'flex' : 'none';
    }

    // Compute placement relative to trigger button
    const rect = triggerBtn.getBoundingClientRect();
    const menuWidth = 240;
    const padding = 10;

    let left = rect.right - menuWidth;
    if (left + menuWidth > window.innerWidth - padding) {
      left = window.innerWidth - menuWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    menu.style.left = `${Math.round(left)}px`;
    menu.style.right = 'auto';

    // Drop up if space below is limited
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceAbove > 300 || spaceAbove > spaceBelow) {
      menu.style.bottom = `${Math.round(window.innerHeight - rect.top + 6)}px`;
      menu.style.top = 'auto';
    } else {
      menu.style.top = `${Math.round(rect.bottom + 6)}px`;
      menu.style.bottom = 'auto';
    }

    menu.style.display = 'flex';

    // Reset search
    const searchInput = menu.querySelector('.___sgt-portal-search-input');
    if (searchInput) {
      searchInput.value = '';
      this.filterLanguageList('');
      setTimeout(() => searchInput.focus(), 40);
    }
  }

  closePortalMenu() {
    if (this.portalMenu) {
      this.portalMenu.style.display = 'none';
    }
    if (this.activeTriggerBtn) {
      this.activeTriggerBtn.classList.remove('___sgt-active');
      this.activeTriggerBtn = null;
    }
    this.currentMode = null;
  }

  selectLanguage(code) {
    if (this.currentMode === 'from') {
      this.setOutgoingSourceLang(code);
    } else {
      this.setOutgoingTargetLang(code);
    }
    this.closePortalMenu();
  }

  filterLanguageList(query) {
    if (!this.portalMenu) return;
    const q = (query || '').trim().toLowerCase();

    // Auto item
    const autoItem = this.portalMenu.querySelector('.___sgt-auto-item');
    if (autoItem && this.currentMode === 'from') {
      autoItem.style.display = !q || 'auto'.includes(q) || 'auto detect'.includes(q) ? 'flex' : 'none';
    }

    const popularSection = this.portalMenu.querySelector('.___sgt-lang-popular');
    if (popularSection) {
      popularSection.style.display = q ? 'none' : 'block';
    }

    const items = this.portalMenu.querySelectorAll('.___sgt-lang-all .___sgt-lang-item');
    items.forEach((item) => {
      const name = (item.dataset.name || '').toLowerCase();
      const code = (item.dataset.code || '').toLowerCase();
      if (!q || name.includes(q) || code === q || code.startsWith(q)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  /* ========================================================================
     Hotkey & Translation Execution
     ======================================================================== */
  handleGlobalHotkey(e) {
    const isHotkey =
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey &&
      (e.code === 'KeyT' || (e.key && e.key.toLowerCase() === 't'));

    if (!isHotkey) return;

    let editor = document.activeElement;
    if (!editor || !editor.isContentEditable) {
      editor = document.querySelector(
        'div[contenteditable="true"][role="textbox"], div.ql-editor[contenteditable="true"]'
      );
    }

    if (editor && editor.isContentEditable) {
      e.preventDefault();
      e.stopPropagation();

      const formattingBar = document.querySelector('.p-texty_sticky_formatting_bar .p-composer__body, .p-composer__body');
      const translateBtn = formattingBar ? formattingBar.querySelector('.___sgt-composer-translate-btn') : null;

      this.executeTranslation(editor, formattingBar, translateBtn);
    }
  }

  async executeTranslation(editor, formattingBody, translateBtn) {
    if (!editor) return;

    const rawText = (editor.innerText || editor.textContent || '').trim();
    if (!rawText) {
      if (translateBtn) {
        translateBtn.classList.add('___sgt-shake');
        setTimeout(() => translateBtn.classList.remove('___sgt-shake'), 400);
      }
      return;
    }

    if (translateBtn) {
      translateBtn.classList.add('___sgt-loading');
    }

    try {
      const fromLang = this.getOutgoingSourceLang() || 'auto';
      const toLang = this.getOutgoingTargetLang() || 'en';

      const { protectedText, restore } = protectTokens(rawText);

      const response = await requestTranslation({
        text: protectedText,
        fromLang,
        toLang
      });

      const finalTranslated = restore(response.translatedText);
      this.replaceEditorText(editor, finalTranslated);
      this.showUndoToast(editor, formattingBody, rawText, toLang);
    } catch (err) {
      console.warn('[Slack Translator] Composer translation failed:', err);
      if (translateBtn) {
        translateBtn.classList.add('___sgt-btn-error');
        setTimeout(() => translateBtn.classList.remove('___sgt-btn-error'), 2000);
      }
    } finally {
      if (translateBtn) {
        translateBtn.classList.remove('___sgt-loading');
      }
    }
  }

  replaceEditorText(editor, newText) {
    editor.focus();

    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);

      let success = document.execCommand('insertText', false, newText);

      if (!success) {
        const dt = new DataTransfer();
        dt.setData('text/plain', newText);
        const pasteEvent = new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true
        });
        editor.dispatchEvent(pasteEvent);
      }
    } catch {
      editor.innerText = newText;
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: newText }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  showUndoToast(editor, formattingBody, originalText, targetLang) {
    this.dismissUndoToast();

    const targetLangName = getLanguageName(targetLang);

    const toast = document.createElement('div');
    toast.className = '___sgt-undo-toast';
    toast.innerHTML = `
      <div class="___sgt-undo-content">
        ${ICONS.check}
        <span class="___sgt-undo-msg">Đã dịch sang <b>${targetLangName}</b></span>
      </div>
      <button type="button" class="___sgt-undo-btn">
        ${ICONS.undo}
        <span>Hoàn tác</span>
      </button>
      <button type="button" class="___sgt-undo-close-btn" title="Đóng">
        ${ICONS.close}
      </button>
    `;

    const undoBtn = toast.querySelector('.___sgt-undo-btn');
    undoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.replaceEditorText(editor, originalText);
      this.dismissUndoToast();
    });

    const closeBtn = toast.querySelector('.___sgt-undo-close-btn');
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dismissUndoToast();
    });

    const onEditorInput = () => {
      this.dismissUndoToast();
      editor.removeEventListener('input', onEditorInput);
    };
    editor.addEventListener('input', onEditorInput, { once: true });

    const composerContainer =
      (formattingBody && formattingBody.closest('.c-message_composer, [data-qa="message_editor"]')) ||
      (editor && editor.parentElement) ||
      document.body;

    composerContainer.appendChild(toast);
    this.activeUndoToast = toast;

    this.undoTimeout = setTimeout(() => {
      this.dismissUndoToast();
    }, 15000);
  }

  dismissUndoToast() {
    if (this.undoTimeout) {
      clearTimeout(this.undoTimeout);
      this.undoTimeout = null;
    }
    if (this.activeUndoToast) {
      const toast = this.activeUndoToast;
      this.activeUndoToast = null;
      toast.classList.add('___sgt-toast-fadeout');
      setTimeout(() => toast.remove(), 200);
    }
  }
}
