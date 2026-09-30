/**
 * Viewport Pre-fetch Concurrency Queue
 * Observes messages entering near-viewport (+200px margin) and throttles background pre-fetching
 * to ensure zero-latency translation on click while protecting Google Translate from rate limits (429).
 */

export class PrefetchQueue {
  /**
   * @param {object} options
   * @param {number} [options.maxConcurrent=3] - Maximum parallel translation requests
   * @param {number} [options.throttleDelay=60] - Inter-request delay in milliseconds
   * @param {string} [options.rootMargin='200px 0px 200px 0px'] - Pre-fetch trigger margin
   */
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || 3;
    this.throttleDelay = options.throttleDelay ?? 60;
    this.rootMargin = options.rootMargin || '200px 0px 200px 0px';

    this.activeCount = 0;
    this.pendingQueue = [];
    this.elementMap = new WeakMap();

    this.observer = new IntersectionObserver((entries) => this.handleIntersection(entries), {
      root: null, // viewport
      rootMargin: this.rootMargin,
      threshold: 0.01
    });
  }

  /**
   * Register a widget and DOM element for prefetch observation
   * @param {object} widget
   * @param {HTMLElement} element
   */
  observe(widget, element) {
    if (!element || !widget) return;
    this.elementMap.set(element, widget);
    widget.__prefetchElement = element;
    this.observer.observe(element);
  }

  /**
   * Unregister element and widget
   * @param {object} widget
   * @param {HTMLElement} [element]
   */
  unobserve(widget, element) {
    const el = element || widget.__prefetchElement;
    if (el) {
      this.observer.unobserve(el);
      this.elementMap.delete(el);
    }
    this.remove(widget);
  }

  /**
   * Remove widget from pending queue if present
   * @param {object} widget
   */
  remove(widget) {
    const idx = this.pendingQueue.indexOf(widget);
    if (idx !== -1) {
      this.pendingQueue.splice(idx, 1);
    }
  }

  /**
   * Handle IntersectionObserver entry events
   * @param {IntersectionObserverEntry[]} entries
   */
  handleIntersection(entries) {
    for (const entry of entries) {
      const widget = this.elementMap.get(entry.target);
      if (!widget) continue;

      if (widget.isTranslated) {
        this.unobserve(widget, entry.target);
        continue;
      }

      if (entry.isIntersecting) {
        // Enqueue if not already fetching or queued
        if (!widget.isPrefetching && !this.pendingQueue.includes(widget)) {
          this.pendingQueue.push(widget);
          this.processQueue();
        }
      } else {
        // Drop from queue if user rapidly scrolled past before fetch started
        this.remove(widget);
      }
    }
  }

  /**
   * Dispatch pending requests up to max concurrency
   */
  processQueue() {
    while (this.activeCount < this.maxConcurrent && this.pendingQueue.length > 0) {
      const widget = this.pendingQueue.shift();
      if (!widget || widget.isTranslated || widget.isPrefetching) {
        continue;
      }

      this.activeCount++;
      this.dispatchItem(widget);
    }
  }

  /**
   * Run prefetch for a single widget with concurrency cleanup
   * @param {object} widget
   */
  async dispatchItem(widget) {
    try {
      await widget.prefetch();
    } catch {
      // Prefetch fails silently; manual click provides user retry
    } finally {
      this.activeCount--;
      if (widget.__prefetchElement) {
        this.unobserve(widget, widget.__prefetchElement);
      }

      if (this.throttleDelay > 0) {
        setTimeout(() => this.processQueue(), this.throttleDelay);
      } else {
        this.processQueue();
      }
    }
  }
}

// Global shared singleton for content script
export const globalPrefetchQueue = new PrefetchQueue();
