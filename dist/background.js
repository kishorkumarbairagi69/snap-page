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

  // src/shared/utils.ts
  function generateId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function sanitizeFilename(input, fallback = "screenshot") {
    const cleaned = input.replace(/[/\\:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
    return cleaned.length > 0 ? cleaned : fallback;
  }
  function pad2(n) {
    return n < 10 ? `0${n}` : `${n}`;
  }
  function formatDateForFilename(d = /* @__PURE__ */ new Date()) {
    const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}`;
    return { date, time };
  }
  function applyFilenameTemplate(template, vars) {
    return template.replace(/\{title\}/g, vars.title).replace(/\{date\}/g, vars.date).replace(/\{time\}/g, vars.time);
  }
  function isRestrictedUrl(url, prefixes) {
    if (!url) return true;
    return prefixes.some((p) => url.includes(p));
  }
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function estimateCanvasBytes(width, height, bytesPerPixel = 4) {
    return Math.ceil(width) * Math.ceil(height) * bytesPerPixel;
  }

  // src/messaging/messages.ts
  function sendToTab(tabId, message) {
    const full = { ...message, requestId: message.requestId ?? generateId() };
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, full, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  // src/shared/constants.ts
  var STORAGE_KEYS = {
    SETTINGS: "snappage_settings_v1"
  };
  var DB_NAME = "snappage-db";
  var DB_VERSION = 1;
  var STORE_SCREENSHOTS = "screenshots";
  var MAX_CANVAS_DIMENSION = 16384;
  var MAX_CANVAS_AREA = 256e6;
  var MEMORY_BUDGET_BYTES = 300 * 1024 * 1024;
  var CAPTURE_RATE_LIMIT_MS = 550;
  var RESTRICTED_URL_PREFIXES = [
    "chrome://",
    "chrome-extension://",
    "edge://",
    "about:",
    "chrome.google.com/webstore",
    "chromewebstore.google.com",
    "view-source:",
    "devtools://"
  ];
  var DEFAULT_SETTINGS = {
    general: {
      defaultCaptureMode: "full",
      openResultAfterCapture: true,
      autoDownload: false,
      notifications: true,
      confirmDestructive: true
    },
    capture: {
      nestedScrollDetection: true,
      stickyHandling: true,
      iframeHandling: true,
      showProgress: true,
      restorePageState: true,
      captureDelayMs: 150
    },
    downloads: {
      defaultFormat: "png",
      jpgQuality: 0.92,
      autoDownload: false,
      saveAs: false,
      filenameTemplate: "{title}-{date}-{time}"
    },
    editor: {
      defaultFont: "Inter",
      defaultFontSize: 24,
      defaultArrowColor: "#FD79A8",
      defaultShapeColor: "#6C5CE7",
      defaultBlurRadius: 18,
      defaultBorderColor: "#6C5CE7",
      defaultPadding: 0
    },
    appearance: {
      theme: "colorful"
    },
    privacy: {
      analyticsEnabled: false
    },
    pdf: {
      defaultPageSize: "a4"
    }
  };

  // src/capture/capture-plan.ts
  function buildCapturePlan(metrics) {
    const { viewportWidth, viewportHeight, documentHeight, devicePixelRatio } = metrics;
    const totalHeight = Math.max(documentHeight, viewportHeight);
    const numSteps = Math.max(1, Math.ceil(totalHeight / viewportHeight));
    const steps = [];
    for (let i = 0; i < numSteps; i++) {
      const y = Math.min(i * viewportHeight, Math.max(0, totalHeight - viewportHeight));
      steps.push({ index: i, scrollX: 0, scrollY: y });
    }
    const dedupedSteps = steps.filter(
      (s, i) => i === 0 || s.scrollY !== steps[i - 1].scrollY
    );
    const finalPixelWidth = Math.round(viewportWidth * devicePixelRatio);
    const finalPixelHeight = Math.round(totalHeight * devicePixelRatio);
    const willSplit = finalPixelHeight > MAX_CANVAS_DIMENSION || finalPixelWidth * finalPixelHeight > MAX_CANVAS_AREA;
    return {
      steps: dedupedSteps,
      totalWidth: viewportWidth,
      totalHeight,
      viewportWidth,
      viewportHeight,
      devicePixelRatio,
      willSplit
    };
  }

  // src/capture/image-processor.ts
  async function blobToBitmap(blob) {
    return createImageBitmap(blob);
  }
  async function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
    return canvas.convertToBlob({ type, quality: type === "image/jpeg" ? quality : void 0 });
  }
  function createCanvas(width, height) {
    return new OffscreenCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }

  // src/capture/size-manager.ts
  function planSafeChunks(totalWidthCss, totalHeightCss, dpr) {
    const pixelWidth = Math.round(totalWidthCss * dpr);
    const maxHeightPixelsByDimension = MAX_CANVAS_DIMENSION;
    const maxHeightPixelsByArea = Math.floor(MAX_CANVAS_AREA / Math.max(1, pixelWidth));
    const maxHeightPixels = Math.max(200, Math.min(maxHeightPixelsByDimension, maxHeightPixelsByArea));
    const maxHeightCss = Math.floor(maxHeightPixels / dpr);
    const totalHeightPixels = Math.round(totalHeightCss * dpr);
    const estBytes = estimateCanvasBytes(pixelWidth, totalHeightPixels);
    if (estBytes <= MAX_CANVAS_AREA * 4 && totalHeightPixels <= MAX_CANVAS_DIMENSION) {
      return [{ startY: 0, endY: totalHeightCss }];
    }
    const chunks = [];
    let y = 0;
    while (y < totalHeightCss) {
      const end = Math.min(totalHeightCss, y + maxHeightCss);
      chunks.push({ startY: y, endY: end });
      y = end;
    }
    return chunks;
  }

  // src/capture/overlap-detector.ts
  function checkOverlapShift(prevCtx, prevY, nextCtx, nextY, width, overlapHeight) {
    if (overlapHeight <= 0) return true;
    try {
      const sampleWidth = Math.min(width, 64);
      const prevStrip = prevCtx.getImageData(0, prevY, sampleWidth, 1).data;
      const nextStrip = nextCtx.getImageData(0, nextY, sampleWidth, 1).data;
      let diff = 0;
      for (let i = 0; i < prevStrip.length; i++) {
        if (Math.abs(prevStrip[i] - nextStrip[i]) > 25) diff++;
      }
      const mismatchRatio = diff / prevStrip.length;
      if (mismatchRatio > 0.3) {
        logger.warn("Detected content shift between capture segments (possible lazy-load).");
        return false;
      }
      return true;
    } catch (e) {
      logger.debug("overlap check skipped", e);
      return true;
    }
  }

  // src/capture/stitcher.ts
  async function stitchSegments(segments, viewportWidthCss, totalHeightCss, dpr) {
    if (segments.length === 0) {
      throw new Error("No segments to stitch");
    }
    const chunks = planSafeChunks(viewportWidthCss, totalHeightCss, dpr);
    const blobs = [];
    const heights = [];
    const widthPx = Math.round(viewportWidthCss * dpr);
    for (const chunk of chunks) {
      const chunkHeightCss = chunk.endY - chunk.startY;
      const chunkHeightPx = Math.round(chunkHeightCss * dpr);
      const canvas = createCanvas(widthPx, chunkHeightPx);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      let prevCtx = null;
      let prevDrawnY = 0;
      for (const seg of segments) {
        const segTopCss = seg.actualY;
        const segViewportHeightCss = seg.bitmap.height / dpr;
        const segEndCss = segTopCss + segViewportHeightCss;
        if (segEndCss <= chunk.startY || segTopCss >= chunk.endY) continue;
        const drawYCss = segTopCss - chunk.startY;
        const drawYPx = Math.round(drawYCss * dpr);
        try {
          ctx.drawImage(seg.bitmap, 0, drawYPx, widthPx, seg.bitmap.height);
        } catch (e) {
          logger.error("stitch drawImage failed", e);
          throw e;
        }
        if (prevCtx) {
          checkOverlapShift(prevCtx, prevDrawnY, ctx, drawYPx, widthPx, 4);
        }
        prevCtx = ctx;
        prevDrawnY = drawYPx;
      }
      const blob = await canvasToBlob(canvas, "image/png");
      blobs.push(blob);
      heights.push(chunkHeightPx);
    }
    return { blobs, width: widthPx, heights, totalHeightCss };
  }

  // src/capture/viewport-capture.ts
  var lastCaptureAt = 0;
  async function captureVisibleViewport(windowId) {
    const elapsed = Date.now() - lastCaptureAt;
    if (elapsed < CAPTURE_RATE_LIMIT_MS) {
      await sleep(CAPTURE_RATE_LIMIT_MS - elapsed);
    }
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    lastCaptureAt = Date.now();
    const res = await fetch(dataUrl);
    return res.blob();
  }

  // src/capture/capture-engine.ts
  var SnapCancelledError = class extends Error {
    constructor() {
      super("Capture cancelled");
      this.name = "SnapCancelledError";
    }
  };
  function toSnapError(err) {
    if (err instanceof SnapCancelledError) {
      return { type: "UNKNOWN", message: "Cancelled" };
    }
    const message = err instanceof Error ? err.message : String(err);
    if (/cannot access|extension context|receiving end/i.test(message)) {
      return { type: "PERMISSION_DENIED", message: "SnapPage could not access this page.", detail: message };
    }
    return { type: "CAPTURE_FAILED", message: "Something went wrong during capture.", detail: message };
  }
  async function ensureContentScript(tabId) {
    try {
      await sendToTab(tabId, { type: "PING" });
      return;
    } catch {
    }
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
  async function validateTab(tab) {
    if (!tab.id || !tab.url) {
      return { type: "RESTRICTED_PAGE", message: "This page cannot be captured." };
    }
    if (isRestrictedUrl(tab.url, RESTRICTED_URL_PREFIXES)) {
      return {
        type: "RESTRICTED_PAGE",
        message: "This page cannot be captured",
        detail: "Chrome protects this type of page from extensions."
      };
    }
    if (tab.url.startsWith("file://")) {
      const hasAccess = await chrome.extension.isAllowedFileSchemeAccess();
      if (!hasAccess) {
        return {
          type: "FILE_URL_BLOCKED",
          message: "File access is disabled.",
          detail: 'Enable "Allow access to file URLs" in Chrome extension settings.'
        };
      }
    }
    return null;
  }
  async function runCapture(tab, mode, onProgress, signal2, captureDelayMs = 0, stickyHandling = true) {
    const tabId = tab.id;
    const windowId = tab.windowId;
    const validationError = await validateTab(tab);
    if (validationError) throw Object.assign(new Error(validationError.message), { snapError: validationError });
    onProgress({ stage: "ANALYZING", percent: 5, message: "Analyzing page" });
    await ensureContentScript(tabId);
    const analyzeResp = await sendToTab(tabId, {
      type: "CAPTURE_ANALYZE_REQUEST"
    });
    const analysis = analyzeResp.analysis;
    if (signal2.cancelled) throw new SnapCancelledError();
    if (mode === "visible") {
      onProgress({ stage: "CAPTURING", percent: 40, message: "Capturing visible area" });
      const blob = await captureVisibleViewport(windowId);
      onProgress({ stage: "FINALIZING", percent: 90, message: "Finalizing" });
      return {
        blobs: [blob],
        widthPx: Math.round(analysis.metrics.viewportWidth * analysis.metrics.devicePixelRatio),
        heightsPx: [Math.round(analysis.metrics.viewportHeight * analysis.metrics.devicePixelRatio)],
        analysis
      };
    }
    const plan = buildCapturePlan(analysis.metrics);
    onProgress({ stage: "PREPARING", percent: 10, message: "Preparing page" });
    await sendToTab(tabId, { type: "CAPTURE_PREPARE", hideSticky: stickyHandling });
    const segments = [];
    let restored = false;
    const restore = async () => {
      if (restored) return;
      restored = true;
      try {
        await sendToTab(tabId, { type: "CAPTURE_RESTORE" });
      } catch (e) {
        logger.warn("Failed to send restore message (tab may have navigated/closed)", e);
      }
    };
    try {
      for (const step of plan.steps) {
        if (signal2.cancelled) throw new SnapCancelledError();
        const scrollResp = await sendToTab(tabId, {
          type: "CAPTURE_SCROLL_TO",
          x: step.scrollX,
          y: step.scrollY,
          delayMs: captureDelayMs
        });
        if (signal2.cancelled) throw new SnapCancelledError();
        const blob = await captureVisibleViewport(windowId);
        const bitmap = await blobToBitmap(blob);
        segments.push({ bitmap, actualX: scrollResp.actualX, actualY: scrollResp.actualY });
        const percent = 15 + Math.round((step.index + 1) / plan.steps.length * 55);
        onProgress({
          stage: "CAPTURING",
          currentStep: step.index + 1,
          totalSteps: plan.steps.length,
          percent,
          message: `Capturing section ${step.index + 1} of ${plan.steps.length}`
        });
      }
    } finally {
      await restore();
    }
    onProgress({ stage: "STITCHING", percent: 75, message: "Stitching screenshot" });
    const stitched = await stitchSegments(
      segments,
      plan.viewportWidth,
      plan.totalHeight,
      plan.devicePixelRatio
    );
    for (const seg of segments) seg.bitmap.close();
    onProgress({ stage: "PROCESSING", percent: 90, message: "Processing images" });
    return {
      blobs: stitched.blobs,
      widthPx: stitched.width,
      heightsPx: stitched.heights,
      analysis
    };
  }

  // src/storage/settings.ts
  async function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
        const stored = result[STORAGE_KEYS.SETTINGS];
        if (!stored) {
          resolve(DEFAULT_SETTINGS);
          return;
        }
        resolve({
          general: { ...DEFAULT_SETTINGS.general, ...stored.general },
          capture: { ...DEFAULT_SETTINGS.capture, ...stored.capture },
          downloads: { ...DEFAULT_SETTINGS.downloads, ...stored.downloads },
          editor: { ...DEFAULT_SETTINGS.editor, ...stored.editor },
          appearance: { ...DEFAULT_SETTINGS.appearance, ...stored.appearance },
          privacy: { ...DEFAULT_SETTINGS.privacy, ...stored.privacy },
          pdf: { ...DEFAULT_SETTINGS.pdf, ...stored.pdf }
        });
      });
    });
  }

  // src/storage/indexeddb.ts
  var dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SCREENSHOTS)) {
          const store = db.createObjectStore(STORE_SCREENSHOTS, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        logger.error("IndexedDB open failed", req.error);
        reject(req.error);
      };
    });
    return dbPromise;
  }
  async function idbPut(storeName, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // src/storage/screenshots.ts
  var THUMB_MAX_WIDTH = 320;
  async function makeThumbnail(blob) {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, THUMB_MAX_WIDTH / bitmap.width);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.convertToBlob({ type: "image/jpeg", quality: 0.75 });
  }
  async function saveScreenshot(record) {
    const thumbnailBlob = record.thumbnailBlob ?? await makeThumbnail(record.imageBlob);
    const full = { ...record, thumbnailBlob };
    await idbPut(STORE_SCREENSHOTS, full);
    return full;
  }

  // src/background/downloads.ts
  async function downloadBlob({ blob, pageTitle, extension, settings, suffix }) {
    const { date, time } = formatDateForFilename();
    const base = applyFilenameTemplate(settings.filenameTemplate, {
      title: sanitizeFilename(pageTitle),
      date,
      time
    });
    const filename = `${sanitizeFilename(base)}${suffix ?? ""}.${extension}`;
    const dataUrl = await blobToDataUrl(blob);
    return new Promise((resolve, reject) => {
      chrome.downloads.download(
        {
          url: dataUrl,
          filename,
          saveAs: settings.saveAs
        },
        (downloadId) => {
          if (chrome.runtime.lastError || downloadId === void 0) {
            logger.error("Download failed", chrome.runtime.lastError?.message);
            reject(new Error(chrome.runtime.lastError?.message ?? "Download failed"));
            return;
          }
          resolve(downloadId);
        }
      );
    });
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  // src/background/capture-manager.ts
  var managerState = {
    state: "IDLE",
    progress: null,
    error: null,
    screenshotId: null,
    tabId: null
  };
  var signal = { cancelled: false };
  function getManagerState() {
    return managerState;
  }
  function cancelCapture() {
    signal.cancelled = true;
  }
  function broadcastProgress(progress) {
    managerState = { ...managerState, progress, state: progress.stage === "COMPLETE" ? "COMPLETE" : managerState.state };
    chrome.runtime.sendMessage({ type: "CAPTURE_PROGRESS", requestId: generateId(), progress }).catch(() => {
    });
  }
  async function startCapture(tab, mode) {
    if (managerState.state !== "IDLE" && managerState.state !== "COMPLETE" && managerState.state !== "ERROR" && managerState.state !== "CANCELLED") {
      logger.warn("Capture already in progress; ignoring new request.");
      return;
    }
    signal = { cancelled: false };
    managerState = { state: "ANALYZING", progress: null, error: null, screenshotId: null, tabId: tab.id ?? null };
    try {
      const settings = await getSettings();
      const result = await runCapture(
        tab,
        mode,
        (progress) => {
          managerState = { ...managerState, state: progress.stage, progress };
          broadcastProgress(progress);
        },
        signal,
        settings.capture.captureDelayMs,
        settings.capture.stickyHandling
      );
      managerState = { ...managerState, state: "FINALIZING" };
      broadcastProgress({ stage: "SAVING", percent: 92, message: "Saving screenshot" });
      const id = generateId();
      const primaryBlob = result.blobs[0];
      const extraBlobs = result.blobs.slice(1);
      const dpr = result.analysis.metrics.devicePixelRatio;
      const record = await saveScreenshot({
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        title: result.analysis.pageTitle,
        pageTitle: result.analysis.pageTitle,
        url: result.analysis.url,
        width: result.widthPx,
        height: result.heightsPx.reduce((a, b) => a + b, 0),
        format: "png",
        fileSize: result.blobs.reduce((sum, b) => sum + b.size, 0),
        edited: false,
        segments: result.blobs.length,
        imageBlob: primaryBlob,
        extraBlobs: extraBlobs.length ? extraBlobs : void 0
      });
      if (settings.general.autoDownload || settings.downloads.autoDownload) {
        try {
          await downloadBlob({
            blob: primaryBlob,
            pageTitle: record.pageTitle,
            extension: "png",
            settings: settings.downloads
          });
          for (let i = 0; i < extraBlobs.length; i++) {
            await downloadBlob({
              blob: extraBlobs[i],
              pageTitle: record.pageTitle,
              extension: "png",
              settings: settings.downloads,
              suffix: `-part${i + 2}`
            });
          }
        } catch (e) {
          logger.error("Auto-download failed", e);
        }
      }
      managerState = {
        state: "COMPLETE",
        progress: { stage: "COMPLETE", percent: 100, message: "Complete" },
        error: null,
        screenshotId: id,
        tabId: tab.id ?? null
      };
      broadcastProgress({ stage: "COMPLETE", percent: 100, message: "Complete" });
      if (settings.general.openResultAfterCapture) {
        await chrome.tabs.create({ url: chrome.runtime.getURL(`result.html?id=${id}`) });
      }
    } catch (err) {
      const isCancelled = signal.cancelled;
      const snapError = isCancelled ? { type: "UNKNOWN", message: "Capture cancelled" } : err?.snapError ?? toSnapError(err);
      logger.error("Capture failed", snapError, err);
      managerState = {
        state: isCancelled ? "CANCELLED" : "ERROR",
        progress: null,
        error: snapError,
        screenshotId: null,
        tabId: tab.id ?? null
      };
      chrome.runtime.sendMessage({ type: "CAPTURE_ERROR", requestId: generateId(), error: snapError }).catch(() => {
      });
    }
  }

  // src/background/message-router.ts
  function registerMessageRouter() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      (async () => {
        try {
          switch (message.type) {
            case "CAPTURE_START": {
              const tab = sender.tab ?? await getActiveTab();
              if (!tab) {
                sendResponse({ ok: false, error: "No active tab" });
                return;
              }
              startCapture(tab, message.mode);
              sendResponse({ ok: true });
              break;
            }
            case "CAPTURE_CANCEL": {
              cancelCapture();
              sendResponse({ ok: true });
              break;
            }
            case "GET_CAPTURE_STATE": {
              sendResponse(getManagerState());
              break;
            }
            case "PING": {
              sendResponse({ ok: true });
              break;
            }
            default:
              sendResponse({ ok: false, error: "Unhandled message type in background" });
          }
        } catch (err) {
          logger.error("Background message handler failed", err);
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
        }
      })();
      return true;
    });
  }
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // src/background/index.ts
  registerMessageRouter();
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "capture-full-page") return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) startCapture(tab, "full");
  });
  chrome.runtime.onInstalled.addListener((details) => {
    logger.info("SnapPage installed", details.reason);
    if (details.reason === "install") {
      chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    }
  });
  logger.debug("Background service worker started");
})();
