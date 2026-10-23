// ReadHindi OCR Engine Architecture
// Features:
// 1. Native PDF Text Detection: Skips OCR entirely when usable digital text exists.
// 2. Persistent Tesseract Worker Lifecycle: Reuses Web Worker across pages to eliminate 2-5s setup delays.
// 3. In-Flight Job Deduplication: Prevents duplicate OCR executions for the same page.
// 4. IndexedDB & Memory Integration: Persists recognized coordinates for instant subsequent navigation.
// 5. Non-Blocking Page Processing: Keeps UI and navigation responsive.

import { createWorker } from "tesseract.js";
import { getPublicAssetUrl } from "./assetHelper.js";
import { segmentOcrText, cleanSingleWord } from "./selection.js";
import { getCachedOcrWords, setCachedOcrWords } from "./ocrStorage.js";

// Reusable worker singleton
let sharedWorker = null;
let workerInitPromise = null;
let currentLoggerCallback = null;

// Map of in-flight page OCR promises: key -> Promise
const inFlightJobs = new Map();

/**
 * Assess whether a PDF.js page object contains reliable native digital text
 * Allows skipping OCR completely for digital newspapers, saving massive CPU and eliminating waiting
 * @param {Object} pageObj - PDF.js Page Proxy object
 * @returns {Promise<{isScanned: boolean, hasNativeText: boolean, wordCount: number, charCount: number}>}
 */
export async function evaluatePageNativeText(pageObj) {
  if (!pageObj || typeof pageObj.getTextContent !== "function") {
    return { isScanned: true, hasNativeText: false, wordCount: 0, charCount: 0 };
  }

  try {
    const textContent = await pageObj.getTextContent();
    const items = textContent?.items || [];
    if (items.length === 0) {
      return { isScanned: true, hasNativeText: false, wordCount: 0, charCount: 0 };
    }

    const combinedText = items.map((it) => it.str || "").join(" ").trim();
    const validWords = combinedText.split(/\s+/).filter((w) => cleanSingleWord(w).length >= 2);
    const charCount = combinedText.replace(/\s+/g, "").length;

    // A page is considered digital native if it contains at least 5 text items, 6 valid words, and 30 characters
    const hasNativeText = items.length >= 5 && validWords.length >= 6 && charCount >= 30;

    return {
      isScanned: !hasNativeText,
      hasNativeText,
      wordCount: validWords.length,
      charCount
    };
  } catch (err) {
    console.warn("evaluatePageNativeText error, assuming scanned fallback:", err);
    return { isScanned: true, hasNativeText: false, wordCount: 0, charCount: 0 };
  }
}

/**
 * Get or initialize the persistent singleton Tesseract worker
 * Eliminates repeated worker creation and language model reloading
 */
export async function getSharedWorker(onProgress = null) {
  currentLoggerCallback = onProgress;

  if (sharedWorker) {
    return sharedWorker;
  }

  if (workerInitPromise) {
    return workerInitPromise;
  }

  workerInitPromise = (async () => {
    const langBase = getPublicAssetUrl("");
    const workerLogger = (m) => {
      if (typeof currentLoggerCallback === "function") {
        currentLoggerCallback(m);
      }
    };

    try {
      // First attempt: local packaged traineddata with gzip
      sharedWorker = await createWorker("eng", 1, {
        langPath: langBase,
        gzip: true,
        logger: workerLogger
      });
      return sharedWorker;
    } catch (localErr) {
      console.warn("Local OCR worker init failed, using default CDN fallback:", localErr);
      try {
        sharedWorker = await createWorker("eng", 1, {
          logger: workerLogger
        });
        return sharedWorker;
      } catch (err) {
        sharedWorker = null;
        workerInitPromise = null;
        throw err;
      }
    }
  })();

  try {
    const w = await workerInitPromise;
    return w;
  } finally {
    workerInitPromise = null;
  }
}

/**
 * Gracefully terminate the shared OCR worker (e.g. on unmount or document close)
 */
export async function terminateSharedWorker() {
  if (sharedWorker) {
    try {
      await sharedWorker.terminate();
    } catch {}
    sharedWorker = null;
  }
  workerInitPromise = null;
  inFlightJobs.clear();
}

/**
 * Render a high-resolution offscreen canvas of a PDF page suitable for sharp OCR recognition
 */
export async function renderOcrCanvas(pageObj, targetCanvas = null) {
  if (pageObj) {
    const unscaledViewport = pageObj.getViewport({ scale: 1.0 });
    // Optimal width for newspaper OCR: 1800px (sharp for 8pt-9pt text without excessive memory consumption)
    const baseW = unscaledViewport.width || 800;
    const targetWidth = Math.min(2000, Math.max(1600, baseW * 2.0));
    const ocrScale = targetWidth / baseW;
    const ocrViewport = pageObj.getViewport({ scale: ocrScale });

    const offscreen = document.createElement("canvas");
    offscreen.width = ocrViewport.width;
    offscreen.height = ocrViewport.height;
    const ctx = offscreen.getContext("2d", { willReadFrequently: true });
    await pageObj.render({ canvasContext: ctx, viewport: ocrViewport }).promise;

    // Preprocessing: 100% grayscale and 150% contrast to separate faint newspaper print from newsprint grain
    ctx.filter = "grayscale(100%) contrast(150%)";
    ctx.drawImage(offscreen, 0, 0);
    return offscreen;
  }

  if (targetCanvas) {
    const offscreen = document.createElement("canvas");
    offscreen.width = targetCanvas.width;
    offscreen.height = targetCanvas.height;
    const ctx = offscreen.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(targetCanvas, 0, 0);
    ctx.filter = "grayscale(100%) contrast(150%)";
    ctx.drawImage(offscreen, 0, 0);
    return offscreen;
  }

  return null;
}

/**
 * Parse OCR recognition output (TSV or blocks) into structured words with relative bounding boxes
 */
export function parseOcrWords(ocrData, imageW, imageH) {
  const safeW = imageW || 1;
  const safeH = imageH || 1;
  const words = [];

  if (ocrData?.tsv) {
    const lines = ocrData.tsv.split("\n");
    for (const line of lines) {
      const cols = line.split("\t");
      if (cols.length >= 12 && cols[0] === "5") {
        const left = parseInt(cols[6], 10);
        const top = parseInt(cols[7], 10);
        const width = parseInt(cols[8], 10);
        const height = parseInt(cols[9], 10);
        const conf = parseFloat(cols[10]);
        const rawText = cols[11]?.trim();
        if (rawText && !isNaN(left) && !isNaN(top) && (isNaN(conf) || conf >= 25)) {
          const segmented = segmentOcrText(rawText, left, top, width, height, conf, safeW, safeH);
          for (const seg of segmented) {
            words.push(seg);
          }
        }
      }
    }
  } else if (ocrData?.blocks && ocrData.blocks.length > 0) {
    for (const block of ocrData.blocks) {
      for (const para of block.paragraphs || []) {
        for (const line of para.lines || []) {
          for (const w of line.words || []) {
            if (w.text && w.bbox && (w.confidence === undefined || w.confidence >= 25)) {
              const segmented = segmentOcrText(
                w.text,
                w.bbox.x0,
                w.bbox.y0,
                w.bbox.x1 - w.bbox.x0,
                w.bbox.y1 - w.bbox.y0,
                w.confidence || 90,
                safeW,
                safeH
              );
              for (const seg of segmented) {
                words.push(seg);
              }
            }
          }
        }
      }
    }
  }

  return words;
}

/**
 * Execute OCR on a specific page with persistent caching and in-flight deduplication
 * @param {Object} options
 * @param {string} options.docId - Document identifier
 * @param {number} options.pageNumber - 1-based page number
 * @param {Object} [options.pdfDoc] - PDF.js Document object
 * @param {HTMLCanvasElement} [options.fallbackCanvas] - Rendered canvas fallback
 * @param {Function} [options.onProgress] - Progress callback (stage, percentage, message)
 * @param {AbortSignal} [options.signal] - Optional abort signal
 * @returns {Promise<Array>} Array of parsed OCR words
 */
export async function performPageOCR({
  docId,
  pageNumber,
  pdfDoc,
  fallbackCanvas,
  onProgress,
  signal
}) {
  const safeDocId = docId || "current_doc";
  const jobKey = `${safeDocId}_p${pageNumber}`;

  // 1. Check persistent cache first (instant 0ms)
  const cachedWords = await getCachedOcrWords(safeDocId, pageNumber);
  if (cachedWords && Array.isArray(cachedWords)) {
    if (onProgress) {
      onProgress({ stage: "completed", progress: 100, message: `पेज ${pageNumber} के लिए कैश किया गया OCR लोड किया गया।` });
    }
    return cachedWords;
  }

  // 2. Return existing in-flight job if already running (deduplication)
  if (inFlightJobs.has(jobKey)) {
    return inFlightJobs.get(jobKey);
  }

  // 3. Create new OCR processing job
  const jobPromise = (async () => {
    try {
      if (signal?.aborted) return [];

      if (onProgress) {
        onProgress({ stage: "rendering", progress: 10, message: `पेज ${pageNumber}: हाई-रेज़ोल्यूशन पेज तैयार हो रहा है (10%)…` });
      }

      let pageObj = null;
      if (pdfDoc && typeof pdfDoc.getPage === "function") {
        try {
          pageObj = await pdfDoc.getPage(pageNumber);
        } catch (e) {
          console.warn("pdfDoc.getPage fallback:", e);
        }
      }

      if (signal?.aborted) return [];

      const offscreen = await renderOcrCanvas(pageObj, fallbackCanvas);
      if (!offscreen || signal?.aborted) return [];

      if (onProgress) {
        onProgress({ stage: "preprocessing", progress: 20, message: `पेज ${pageNumber}: इमेज प्री-प्रोसेसिंग पूर्ण (20%)…` });
      }

      const progressBridge = (m) => {
        if (signal?.aborted) return;
        let prog = 25;
        let msg = `पेज ${pageNumber}: OCR इंजन लोड हो रहा है…`;
        if (m.status === "loading tesseract core" || m.status === "initializing tesseract") {
          prog = 25 + Math.round((m.progress || 0) * 10);
          msg = `पेज ${pageNumber}: OCR इंजन लोड हो रहा है (${prog}%)…`;
        } else if (m.status === "loading language traineddata" || m.status === "initializing api") {
          prog = 35 + Math.round((m.progress || 0) * 10);
          msg = `पेज ${pageNumber}: भाषा मॉडल लोड हो रहा है (${prog}%)…`;
        } else if (m.status === "recognizing text" && typeof m.progress === "number") {
          prog = 45 + Math.round(m.progress * 50);
          msg = `पेज ${pageNumber}: टेक्स्ट पहचान जारी है (${prog}%)…`;
        }
        if (onProgress) {
          onProgress({ stage: "recognizing", progress: Math.min(96, Math.max(10, prog)), message: msg });
        }
      };

      const worker = await getSharedWorker(progressBridge);
      if (signal?.aborted) return [];

      const ret = await worker.recognize(offscreen, {}, { blocks: true, tsv: true });
      if (signal?.aborted) return [];

      if (onProgress) {
        onProgress({ stage: "parsing", progress: 98, message: `पेज ${pageNumber}: शब्द संरचना और निर्देशांक मैपिंग (98%)…` });
      }

      const words = parseOcrWords(ret.data, offscreen.width, offscreen.height);

      // Persist in IndexedDB + memory
      await setCachedOcrWords(safeDocId, pageNumber, words, {
        imageW: offscreen.width,
        imageH: offscreen.height
      });

      if (onProgress) {
        onProgress({
          stage: "completed",
          progress: 100,
          message: words.length > 0
            ? `OCR सफल: पेज ${pageNumber} पर ${words.length} शब्द पहचाने गए।`
            : `पेज ${pageNumber} पर स्पष्ट टेक्स्ट नहीं मिला।`
        });
      }

      return words;
    } catch (err) {
      if (!signal?.aborted) {
        console.error(`Page ${pageNumber} OCR error:`, err);
        if (onProgress) {
          onProgress({ stage: "error", progress: 0, message: `पेज ${pageNumber} पर OCR विश्लेषण पूरा नहीं हो सका।` });
        }
      }
      return [];
    } finally {
      inFlightJobs.delete(jobKey);
    }
  })();

  inFlightJobs.set(jobKey, jobPromise);
  return jobPromise;
}
