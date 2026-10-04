"use strict";
(() => {
  // src/shared/logger.ts
  var PREFIX = "[SnapPage]";
  var DEBUG = false;
  var logger = {
    debug: (...args) => {
      if (DEBUG) console.debug(PREFIX, ...args);
    },
    info: (...args) => console.info(PREFIX, ...args),
    warn: (...args) => console.warn(PREFIX, ...args),
    error: (...args) => console.error(PREFIX, ...args)
  };

  // src/content/frame-detector.ts
  function detectFrames() {
    const frames = Array.from(document.querySelectorAll("iframe, frame"));
    return frames.map((el) => {
      const frameEl = el;
      let sameOrigin = false;
      try {
        sameOrigin = !!frameEl.contentDocument;
      } catch {
        sameOrigin = false;
      }
      const rect = frameEl.getBoundingClientRect();
      return {
        src: frameEl.src || "(same-document frame)",
        sameOrigin,
        width: rect.width,
        height: rect.height
      };
    });
  }

  // src/content/scroll-container-detector.ts
  function detectScrollContainers(limit = 25) {
    const candidates = [];
    const all = document.querySelectorAll("*");
    let count = 0;
    for (const el of Array.from(all)) {
      if (count > 4e3) break;
      count++;
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const scrollableY = (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight - el.clientHeight > 40;
      const scrollableX = (overflowX === "auto" || overflowX === "scroll") && el.scrollWidth - el.clientWidth > 40;
      if (!scrollableY && !scrollableX) continue;
      if (el.clientWidth < 80 || el.clientHeight < 80) continue;
      candidates.push({
        selector: describeSelector(el),
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        isPrimary: false
      });
    }
    candidates.sort((a, b) => b.scrollHeight * b.scrollWidth - a.scrollHeight * a.scrollWidth);
    const top = candidates.slice(0, limit);
    if (top.length > 0) top[0].isPrimary = true;
    return top;
  }
  function describeSelector(el) {
    if (el.id) return `#${el.id}`;
    const cls = (el.className || "").toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
    const tag = el.tagName.toLowerCase();
    return cls.length ? `${tag}.${cls.join(".")}` : tag;
  }

  // src/content/sticky-detector.ts
  function detectStickyElements() {
    const info = [];
    const elements = [];
    const all = document.querySelectorAll("body *");
    let count = 0;
    for (const el of Array.from(all)) {
      if (count > 5e3) break;
      count++;
      const style = window.getComputedStyle(el);
      if (style.position !== "fixed" && style.position !== "sticky") continue;
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) continue;
      info.push({
        selector: el.id ? `#${el.id}` : el.tagName.toLowerCase(),
        position: style.position,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
      elements.push(el);
    }
    return { info, elements };
  }

  // src/content/page-analyzer.ts
  function measurePage() {
    const html = document.documentElement;
    const body = document.body;
    const documentHeight = Math.max(
      html.scrollHeight,
      html.offsetHeight,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0
    );
    const documentWidth = Math.max(
      html.scrollWidth,
      html.offsetWidth,
      body ? body.scrollWidth : 0,
      body ? body.offsetWidth : 0
    );
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    return {
      viewportWidth,
      viewportHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      documentWidth,
      documentHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollHeight: html.scrollHeight,
      scrollWidth: html.scrollWidth,
      zoomFactor: window.visualViewport ? window.visualViewport.scale : 1
    };
  }
  function analyzePage() {
    const metrics = measurePage();
    const { info: stickyElements } = detectStickyElements();
    const frames = detectFrames();
    const scrollContainers = detectScrollContainers();
    return {
      metrics,
      stickyElements,
      frames,
      scrollContainers,
      pageTitle: document.title || "Untitled Page",
      url: location.href
    };
  }

  // src/content/page-preparer.ts
  var STYLE_ID = "snappage-capture-style";
  var currentState = null;
  function preparePage(hideSticky) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    *, *::before, *::after {
      animation-play-state: paused !important;
      transition: none !important;
      scroll-behavior: auto !important;
      caret-color: transparent !important;
    }
    html, body { scroll-behavior: auto !important; }
  `;
    document.documentElement.appendChild(style);
    const hiddenElements = [];
    if (hideSticky) {
      const { elements } = detectStickyElements();
      for (const el of elements) {
        hiddenElements.push({ el, originalVisibility: el.style.visibility });
        el.style.setProperty("visibility", "hidden", "important");
      }
    }
    currentState = {
      originalScrollX: window.scrollX,
      originalScrollY: window.scrollY,
      hiddenElements,
      styleInjected: true
    };
    return currentState;
  }
  function getPreparedState() {
    return currentState;
  }
  function clearPreparedState() {
    currentState = null;
  }

  // src/content/page-restorer.ts
  function restorePage() {
    const state = getPreparedState();
    try {
      document.getElementById(STYLE_ID)?.remove();
    } catch (e) {
      logger.warn("restorePage: failed to remove style", e);
    }
    if (state) {
      for (const { el, originalVisibility } of state.hiddenElements) {
        try {
          if (originalVisibility) {
            el.style.setProperty("visibility", originalVisibility);
          } else {
            el.style.removeProperty("visibility");
          }
        } catch (e) {
          logger.warn("restorePage: failed to restore element visibility", e);
        }
      }
      try {
        window.scrollTo({ left: state.originalScrollX, top: state.originalScrollY, behavior: "auto" });
      } catch (e) {
        logger.warn("restorePage: failed to restore scroll position", e);
      }
    }
    clearPreparedState();
  }

  // src/shared/utils.ts
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function waitForPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }

  // src/content/scroll-manager.ts
  async function scrollTo(x, y, extraDelayMs = 0) {
    window.scrollTo({ left: x, top: y, behavior: "auto" });
    await waitForPaint();
    if (extraDelayMs > 0) await sleep(extraDelayMs);
    return { actualX: window.scrollX, actualY: window.scrollY };
  }
  function getCurrentScroll() {
    return { actualX: window.scrollX, actualY: window.scrollY };
  }

  // src/content/index.ts
  var GLOBAL_FLAG = "__snappage_content_injected__";
  if (!window[GLOBAL_FLAG]) {
    window[GLOBAL_FLAG] = true;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      (async () => {
        try {
          switch (message.type) {
            case "PING": {
              sendResponse({ ok: true });
              break;
            }
            case "CAPTURE_ANALYZE_REQUEST": {
              const analysis = analyzePage();
              sendResponse({
                type: "CAPTURE_ANALYZE_RESULT",
                requestId: message.requestId,
                analysis
              });
              break;
            }
            case "CAPTURE_PREPARE": {
              preparePage(message.hideSticky ?? true);
              sendResponse({ type: "CAPTURE_PREPARE_DONE", requestId: message.requestId });
              break;
            }
            case "CAPTURE_SCROLL_TO": {
              const result = await scrollTo(message.x, message.y, message.delayMs ?? 0);
              sendResponse({
                type: "CAPTURE_SCROLL_DONE",
                requestId: message.requestId,
                actualX: result.actualX,
                actualY: result.actualY
              });
              break;
            }
            case "CAPTURE_RESTORE": {
              restorePage();
              sendResponse({ type: "CAPTURE_RESTORE_DONE", requestId: message.requestId });
              break;
            }
            case "CAPTURE_CANCEL": {
              restorePage();
              sendResponse({ ok: true });
              break;
            }
            default:
              sendResponse({ ok: false, error: "Unknown message type" });
          }
        } catch (err) {
          logger.error("content script handler failed", err);
          try {
            restorePage();
          } catch {
          }
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      })();
      return true;
    });
    window.addEventListener("beforeunload", () => {
      restorePage();
    });
    logger.debug("content script ready", { url: location.href, scroll: getCurrentScroll() });
  }
})();
