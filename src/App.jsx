import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  BookOpen,
  Search,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Volume2,
  X,
  FileText,
  Maximize,
  Minimize,
  ZoomIn,
  Upload,
  Languages,
  LoaderCircle,
  ScanText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RotateCcw
} from "lucide-react";
import { createWorker } from "tesseract.js";
import { lookupText, normalizeLookupText } from "./dictionary.js";
import {
  cleanSingleWord,
  normalizeSelectionText,
  expandRangeToSelection,
  extractWordAtPoint,
  calculatePopupPosition
} from "./selection.js";

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightTargetWord(sentence, targetWord) {
  if (!sentence || !targetWord) return sentence;
  const cleanWord = targetWord.trim();
  if (!cleanWord) return sentence;
  try {
    const escaped = escapeRegex(cleanWord);
    const regex = new RegExp(`\\b(${escaped})\\b`, "gi");
    const parts = sentence.split(regex);
    if (parts.length <= 1) return sentence;
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="pdf-word-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  } catch {
    return sentence;
  }
}

export default function App() {
  // Document state
  const [file, setFile] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [isScannedPage, setIsScannedPage] = useState(false);

  // Popup & dictionary state
  const [entry, setEntry] = useState(null);
  const [popupPos, setPopupPos] = useState({ left: 20, top: 120, arrowX: 40, placement: "below" });
  const [activeWordRect, setActiveWordRect] = useState(null);
  const [busy, setBusy] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchNotice, setSearchNotice] = useState("");

  // Pages Drawer state
  const [showPagesDrawer, setShowPagesDrawer] = useState(false);
  const [pageJumpInput, setPageJumpInput] = useState("1");

  // OCR state
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrWords, setOcrWords] = useState([]);
  const [showOcrBoxes, setShowOcrBoxes] = useState(true);
  const [notice, setNotice] = useState("");

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Element refs
  const fileInput = useRef(null);
  const pdfCanvas = useRef(null);
  const pagePaperRef = useRef(null);
  const readerAreaRef = useRef(null);
  const popupRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const touchStartPos = useRef({ x: 0, y: 0 });
  const ocrCache = useRef(new Map());

  // Interaction State Machine (Phase 5)
  // States: 'idle' | 'selecting' | 'translating' | 'showing-result' | 'dismissed'
  const [interactionState, setInteractionState] = useState("idle");
  const dismissedSignatureRef = useRef(null);
  const justDismissedTimeRef = useRef(0);
  const touchInsidePopupRef = useRef(false);
  const touchEndTimerRef = useRef(null);

  // Background OCR Pipeline Refs (Phase 3 & 4)
  const activeOcrPageRef = useRef(null);
  const ocrAbortTokenRef = useRef(0);

  // PDF.js options to support diverse newspaper encodings, CMaps, and standard fonts
  const pdfOptions = useMemo(() => {
    let pathname = typeof window !== "undefined" ? window.location.pathname : "/";
    if (!pathname.endsWith("/")) pathname += "/";
    const base = typeof window !== "undefined" ? window.location.origin + pathname : "/";

    return {
      cMapUrl: new URL("cmaps/", base).href,
      cMapPacked: true,
      standardFontDataUrl: new URL("standard_fonts/", base).href,
      enableXfa: true
    };
  }, []);

  // Safely close active dictionary/translation popup and abort any in-flight requests
  const closePopup = useCallback(() => {
    requestIdRef.current++;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setEntry(null);
    setActiveWordRect(null);
    setBusy(false);
  }, []);

  // Explicit dismissal handler for (X) button: marks selection dismissed so it does not immediately reopen
  const handleDismiss = useCallback((e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    justDismissedTimeRef.current = Date.now();
    touchInsidePopupRef.current = true;
    if (touchEndTimerRef.current) {
      clearTimeout(touchEndTimerRef.current);
      touchEndTimerRef.current = null;
    }
    if (entry) {
      const textSig = (entry.text || entry.word || "").trim().toLowerCase();
      const rectSig = activeWordRect ? `${Math.round(activeWordRect.left)},${Math.round(activeWordRect.top)}` : "";
      dismissedSignatureRef.current = `${textSig}@${rectSig}`;
    }
    setInteractionState("dismissed");
    closePopup();
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  }, [entry, activeWordRect, closePopup]);

  // Reset states on new file
  const onDocumentLoadSuccess = (doc) => {
    setPdfDoc(doc);
    setNumPages(doc.numPages);
    setPage(1);
    setPageJumpInput("1");
    closePopup();
    setInteractionState("idle");
    dismissedSignatureRef.current = null;
    ocrAbortTokenRef.current++;
    activeOcrPageRef.current = null;
    setOcrBusy(false);
    setOcrProgress(0);
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
    setOcrWords([]);
    setSearchResults([]);
    setSearchNotice("");
    setNotice("");
    ocrCache.current.clear();
  };

  const onDocumentLoadError = (err) => {
    console.error("PDF Load Error:", err);
    let msg = "PDF खोलने में असमर्थ। कृपया वैध PDF फ़ाइल चुनें।";
    if (err?.name === "PasswordException") {
      msg = "यह PDF पासवर्ड सुरक्षित है। पासवर्ड दर्ज करें।";
    } else if (err?.name === "InvalidPDFException") {
      msg = "यह फ़ाइल अमान्य या दूषित PDF है (Invalid or Corrupted PDF)।";
    }
    setNotice(msg);
  };

  const handlePassword = (callback) => {
    const pw = window.prompt("यह PDF पासवर्ड सुरक्षित है। पासवर्ड दर्ज करें (Enter PDF Password):");
    callback(pw || "");
  };

  // Open dictionary or translation popup strictly for a validated user selection
  const openMeaning = useCallback(async (item) => {
    let text = "";
    let rect = null;
    let sentence = "";
    let type = "word";
    let ocrConfidence = undefined;

    if (typeof item === "string") {
      text = normalizeSelectionText(item);
    } else if (item && typeof item === "object") {
      text = item.text || item.word || "";
      rect = item.rect || null;
      sentence = item.sentence || "";
      type = item.type || (text.includes(" ") ? "phrase" : "word");
      ocrConfidence = item.ocrConfidence;
    }

    // 1. Safety check: Trim whitespace and return early if selection is empty
    text = (text || "").trim();
    if (!text || text.length < 1) {
      return;
    }

    // 2. Reject selections that contain no letters or digits (e.g. only dashes, quotes, or punctuation)
    if (!/[A-Za-z0-9\u0900-\u097F]/.test(text)) {
      return;
    }

    // 3. Strict check: ReadHindi translates a user-selected word or phrase.
    // Whole-document selections or full-page text dumps (> 35 words or > 300 chars) are NOT phrases.
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 35 || text.length > 300) {
      return;
    }

    // 4. For single words, validate and clean
    if (words.length === 1) {
      const clean = cleanSingleWord(text);
      if (!clean || (clean.length < 2 && !["a", "i", "A", "I"].includes(clean))) {
        return;
      }
      text = clean;
    }

    // Check against dismissed selection signature
    const textSig = text.trim().toLowerCase();
    const rectSig = rect ? `${Math.round(rect.left)},${Math.round(rect.top)}` : "";
    const currentSig = `${textSig}@${rectSig}`;
    if (dismissedSignatureRef.current === currentSig && interactionState === "dismissed") {
      return;
    }

    dismissedSignatureRef.current = null;
    setInteractionState("translating");

    // Increment request token to discard any previous in-flight responses
    const currentReqId = ++requestIdRef.current;

    // Cancel any previous in-flight request before initiating a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setActiveWordRect(rect);
    const pos = calculatePopupPosition(rect, 320, 160);
    setPopupPos(pos);

    const isMultiWord = words.length > 1;
    const initialType = isMultiWord ? (type === "sentence" ? "sentence" : "phrase") : "word";

    setEntry({
      type: initialType,
      text,
      word: text,
      ipa: initialType === "word" ? `/${text}/` : "",
      meaning: initialType === "word" ? "अर्थ खोज रहे हैं…" : "अनुवाद कर रहे हैं… (Translating phrase…)",
      alternatives: [initialType === "word" ? "अर्थ खोज रहे हैं…" : "अनुवाद कर रहे हैं…"],
      sentence,
      ocrConfidence,
      isError: false
    });
    setBusy(true);

    try {
      const res = await lookupText(text, signal, sentence);
      if (!signal.aborted && currentReqId === requestIdRef.current) {
        if (res) {
          setEntry({ ...res, ocrConfidence, isError: false });
          setInteractionState("showing-result");
          if (rect) {
            setPopupPos(calculatePopupPosition(rect, 320, 160));
          }
        }
      }
    } catch (e) {
      if (e.name !== "AbortError" && !signal.aborted && currentReqId === requestIdRef.current) {
        setEntry({
          type: initialType,
          text,
          word: text,
          ipa: "",
          meaning: "अनुवाद सेवा उपलब्ध नहीं है (नेटवर्क त्रुटि)।",
          alternatives: ["अनुवाद सेवा उपलब्ध नहीं है (नेटवर्क त्रुटि)।"],
          sentence,
          ocrConfidence,
          isError: true
        });
        setInteractionState("showing-result");
      }
    } finally {
      if (!signal.aborted && currentReqId === requestIdRef.current) {
        setBusy(false);
      }
    }
  }, [interactionState]);

  // Retry failed translation
  const retryTranslation = useCallback(() => {
    if (entry && entry.text) {
      openMeaning({
        text: entry.text,
        word: entry.word,
        sentence: entry.sentence,
        type: entry.type,
        rect: activeWordRect
      });
    }
  }, [entry, activeWordRect, openMeaning]);

  // Update popup position when scrolling reader area
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (entry && activeWordRect) {
        setPopupPos(calculatePopupPosition(activeWordRect, 320, 160));
      }
    };
    const area = readerAreaRef.current;
    if (area) {
      area.addEventListener("scroll", handleScrollOrResize, { passive: true });
    }
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      if (area) area.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [entry, activeWordRect]);

  // High-Resolution Automatic & Manual OCR Pipeline for Scanned Newspaper Pages (Phase 3 & 4)
  const processPageOCR = useCallback(
    async (targetPage, isManual = false) => {
      if (!pdfDoc && !pdfCanvas.current) {
        if (isManual) setNotice("पहले PDF खोलें, फिर OCR चलाएँ।");
        return;
      }

      if (ocrCache.current.has(targetPage)) {
        if (page === targetPage) {
          setOcrWords(ocrCache.current.get(targetPage));
        }
        if (isManual) setNotice(`पेज ${targetPage} के लिए कैश किया गया OCR लोड किया गया।`);
        return;
      }

      if (activeOcrPageRef.current === targetPage) {
        return;
      }

      const currentOcrToken = ++ocrAbortTokenRef.current;
      activeOcrPageRef.current = targetPage;
      setOcrBusy(true);
      setOcrProgress(5);
      setNotice(
        isManual
          ? `पेज ${targetPage}: OCR विश्लेषण शुरू हो रहा है (5%)…`
          : `पेज ${targetPage}: स्कैन किया गया पेज — स्वचालित OCR विश्लेषण जारी है (5%)…`
      );

      let worker = null;
      try {
        let offscreen = null;

        // Render at high resolution (1800px to 2400px width) so small 8pt-9pt newsprint is razor sharp
        if (pdfDoc) {
          try {
            const pageObj = await pdfDoc.getPage(targetPage);
            if (ocrAbortTokenRef.current !== currentOcrToken) return;

            const unscaledViewport = pageObj.getViewport({ scale: 1.0 });
            const targetWidth = Math.min(2400, Math.max(1800, (unscaledViewport.width || 800) * 2.0));
            const ocrScale = targetWidth / (unscaledViewport.width || 800);
            const ocrViewport = pageObj.getViewport({ scale: ocrScale });

            offscreen = document.createElement("canvas");
            offscreen.width = ocrViewport.width;
            offscreen.height = ocrViewport.height;
            const ctx = offscreen.getContext("2d", { willReadFrequently: true });
            await pageObj.render({ canvasContext: ctx, viewport: ocrViewport }).promise;
          } catch (renderErr) {
            console.warn("High-res PDF offscreen render fallback:", renderErr);
          }
        }

        // Fallback to active canvas if direct page render unavailable
        if (!offscreen && pdfCanvas.current) {
          const srcCanvas = pdfCanvas.current;
          offscreen = document.createElement("canvas");
          offscreen.width = srcCanvas.width;
          offscreen.height = srcCanvas.height;
          const ctx = offscreen.getContext("2d");
          ctx.drawImage(srcCanvas, 0, 0);
        }

        if (!offscreen || ocrAbortTokenRef.current !== currentOcrToken) return;

        // Image preprocessing for difficult newsprint: contrast enhancement & grayscale
        const ctx = offscreen.getContext("2d");
        ctx.filter = "grayscale(100%) contrast(150%)";
        ctx.drawImage(offscreen, 0, 0);

        setOcrProgress(20);

        worker = await createWorker("eng", 1, {
          logger: (m) => {
            if (m.status === "recognizing text" && typeof m.progress === "number") {
              if (ocrAbortTokenRef.current === currentOcrToken) {
                setOcrProgress(Math.min(99, Math.round(m.progress * 100)));
              }
            }
          }
        });

        if (ocrAbortTokenRef.current !== currentOcrToken) {
          await worker.terminate();
          return;
        }

        const ret = await worker.recognize(offscreen, {}, { blocks: true, tsv: true });
        await worker.terminate();
        worker = null;

        if (ocrAbortTokenRef.current !== currentOcrToken) return;

        const imageW = offscreen.width || 1;
        const imageH = offscreen.height || 1;
        const words = [];

        if (ret.data?.tsv) {
          const lines = ret.data.tsv.split("\n");
          for (const line of lines) {
            const cols = line.split("\t");
            if (cols.length >= 12 && cols[0] === "5") {
              const left = parseInt(cols[6], 10);
              const top = parseInt(cols[7], 10);
              const width = parseInt(cols[8], 10);
              const height = parseInt(cols[9], 10);
              const conf = parseFloat(cols[10]);
              const rawText = cols[11]?.trim();
              const clean = cleanSingleWord(rawText);
              if (clean && clean.length >= 2 && !isNaN(left) && !isNaN(top) && (isNaN(conf) || conf >= 25)) {
                words.push({
                  text: rawText,
                  clean,
                  relBox: {
                    x0: left / imageW,
                    y0: top / imageH,
                    x1: (left + width) / imageW,
                    y1: (top + height) / imageH
                  },
                  confidence: conf
                });
              }
            }
          }
        } else if (ret.data?.blocks && ret.data.blocks.length > 0) {
          for (const block of ret.data.blocks) {
            for (const para of block.paragraphs || []) {
              for (const line of para.lines || []) {
                for (const w of line.words || []) {
                  const clean = cleanSingleWord(w.text);
                  if (clean && clean.length >= 2 && w.bbox && (w.confidence === undefined || w.confidence >= 25)) {
                    words.push({
                      text: w.text.trim(),
                      clean,
                      relBox: {
                        x0: w.bbox.x0 / imageW,
                        y0: w.bbox.y0 / imageH,
                        x1: w.bbox.x1 / imageW,
                        y1: w.bbox.y1 / imageH
                      },
                      confidence: w.confidence
                    });
                  }
                }
              }
            }
          }
        }

        ocrCache.current.set(targetPage, words);

        if (page === targetPage) {
          setOcrWords(words);
          if (words.length === 0) {
            setNotice(`पेज ${targetPage} पर स्पष्ट टेक्स्ट नहीं मिला।`);
          } else {
            setNotice(`OCR सफल: पेज ${targetPage} पर ${words.length} शब्द पहचाने गए। शब्द या वाक्य चुनें।`);
          }
        }
      } catch (err) {
        if (ocrAbortTokenRef.current === currentOcrToken) {
          console.error("OCR error:", err);
          setNotice("OCR विश्लेषण पूरा नहीं हो सका।");
        }
      } finally {
        if (worker) {
          try {
            await worker.terminate();
          } catch {}
        }
        if (activeOcrPageRef.current === targetPage) {
          activeOcrPageRef.current = null;
          setOcrBusy(false);
          setOcrProgress(0);
        }
      }
    },
    [pdfDoc, page]
  );

  const runOCR = useCallback(() => {
    processPageOCR(page, true);
  }, [processPageOCR, page]);

  // Mixed PDF Auto-Detection & Automatic OCR Pipeline
  // Inspects rendered text spans; if page is scanned/image-based, triggers OCR in background
  // NEVER triggers translation automatically
  const onTextLayerRenderSuccess = useCallback(() => {
    if (!pagePaperRef.current) return;
    const textLayer = pagePaperRef.current.querySelector(".textLayer");
    if (!textLayer) return;

    // Assess usability of native text layer
    const spans = Array.from(textLayer.querySelectorAll("span"));
    const combinedText = spans.map((s) => s.textContent || "").join(" ").trim();
    const validWords = combinedText.split(/\s+/).filter((w) => cleanSingleWord(w).length >= 2);
    const charCount = combinedText.replace(/\s+/g, "").length;

    // A page is scanned if it has fewer than 6 recognizable words or < 30 characters
    const isScanned = spans.length < 5 || validWords.length < 6 || charCount < 30;
    setIsScannedPage(isScanned);

    if (isScanned) {
      if (ocrCache.current.has(page)) {
        setOcrWords(ocrCache.current.get(page));
      } else {
        setOcrWords([]);
        // Automatically start background OCR for this scanned page
        processPageOCR(page, false);
      }
    } else {
      setOcrWords([]);
    }
  }, [page, processPageOCR]);

  // Process text selection across PDF text spans or OCR overlays
  const processSelectionOrClick = useCallback(
    (e) => {
      // If clicking inside the popup, let popup buttons handle their events
      if (popupRef.current && e?.target && popupRef.current.contains(e.target)) return;

      // Prevent accidental ghost selection immediately after dismissal
      if (Date.now() - justDismissedTimeRef.current < 400) {
        return;
      }

      // 1. Check if user made an active text selection across PDF text spans or OCR overlays
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const container =
          range.commonAncestorContainer?.nodeType === (typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1)
            ? range.commonAncestorContainer
            : range.commonAncestorContainer?.parentElement;

        const startEl =
          range.startContainer?.nodeType === (typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1)
            ? range.startContainer
            : range.startContainer?.parentElement;
        const endEl =
          range.endContainer?.nodeType === (typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1)
            ? range.endContainer
            : range.endContainer?.parentElement;

        const isInsideTextLayer =
          container?.closest?.(".textLayer") ||
          startEl?.closest?.(".textLayer") ||
          endEl?.closest?.(".textLayer");

        const isInsideOcr =
          container?.closest?.(".ocr-overlay") ||
          startEl?.closest?.(".ocr-overlay") ||
          endEl?.closest?.(".ocr-overlay");

        if (isInsideTextLayer || isInsideOcr) {
          const found = expandRangeToSelection(range);
          if (found && found.text && found.text.trim()) {
            const rect = found.rect;
            const textSig = found.text.trim().toLowerCase();
            const rectSig = rect ? `${Math.round(rect.left)},${Math.round(rect.top)}` : "";
            const currentSig = `${textSig}@${rectSig}`;

            if (dismissedSignatureRef.current === currentSig && interactionState === "dismissed") {
              return; // Do not reopen previously dismissed selection!
            }

            openMeaning(found);
            return;
          }
        }
      }

      // 2. For scanned PDFs: check if user explicitly clicked an OCR recognized word box
      const ocrSpan = e.target?.closest?.(".ocr-word-span");
      if (ocrSpan && ocrSpan.getAttribute("data-word")) {
        const word = ocrSpan.getAttribute("data-word");
        const clean = cleanSingleWord(word);
        const idxStr = ocrSpan.getAttribute("data-idx");
        const confStr = ocrSpan.getAttribute("data-conf");
        const idx = idxStr !== null ? parseInt(idxStr, 10) : -1;
        const ocrConfidence = confStr !== null ? parseInt(confStr, 10) : 100;

        if (clean && clean.length >= 2) {
          const rect = ocrSpan.getBoundingClientRect();
          const currentSig = `${clean.toLowerCase()}@${Math.round(rect.left)},${Math.round(rect.top)}`;
          if (dismissedSignatureRef.current === currentSig && interactionState === "dismissed") {
            return;
          }

          // Reconstruct surrounding sentence from sibling OCR words
          let ocrSentence = "";
          if (idx >= 0 && ocrWords.length > 0) {
            const startI = Math.max(0, idx - 12);
            const endI = Math.min(ocrWords.length, idx + 13);
            const windowWords = ocrWords.slice(startI, endI).map(w => w.clean || w.text);
            ocrSentence = windowWords.join(" ").trim();
          }

          openMeaning({
            type: "word",
            text: clean,
            wordCount: 1,
            rect,
            sentence: ocrSentence,
            ocrConfidence
          });
          return;
        }
      }

      // 3. For text-based PDFs: check if user clicked on a word in the PDF text layer
      const clientX = typeof e.clientX === "number" ? e.clientX : 0;
      const clientY = typeof e.clientY === "number" ? e.clientY : 0;
      const targetEl = e.target || (typeof document !== "undefined" && clientX && clientY ? document.elementFromPoint(clientX, clientY) : null);
      const textSpan = targetEl?.closest?.(".textLayer span");
      if (textSpan && clientX && clientY) {
        const foundWord = extractWordAtPoint(clientX, clientY, textSpan);
        if (foundWord && foundWord.text && foundWord.text.trim()) {
          const rect = foundWord.rect;
          const textSig = foundWord.text.trim().toLowerCase();
          const rectSig = rect ? `${Math.round(rect.left)},${Math.round(rect.top)}` : "";
          const currentSig = `${textSig}@${rectSig}`;

          if (dismissedSignatureRef.current === currentSig && interactionState === "dismissed") {
            return;
          }

          openMeaning(foundWord);
          return;
        }
      }

      // 4. Otherwise: User clicked blank space, background, or collapsed non-text selection
      // Dismiss active popup safely, transition to idle, clear dismissed signature
      if (entry) {
        closePopup();
      }
      setInteractionState("idle");
      dismissedSignatureRef.current = null;
    },
    [entry, interactionState, openMeaning, closePopup, ocrWords]
  );

  useEffect(() => {
    const onTouchStart = (e) => {
      if (popupRef.current && e.target && popupRef.current.contains(e.target)) {
        touchInsidePopupRef.current = true;
        return;
      }
      touchInsidePopupRef.current = false;
      if (e.touches && e.touches[0]) {
        touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onMouseUp = (e) => {
      if (popupRef.current && e.target && popupRef.current.contains(e.target)) {
        return;
      }
      if (Date.now() - justDismissedTimeRef.current < 400) {
        return;
      }
      processSelectionOrClick(e);
    };

    const onTouchEnd = (e) => {
      if (touchInsidePopupRef.current) {
        touchInsidePopupRef.current = false;
        return;
      }
      if (Date.now() - justDismissedTimeRef.current < 400) {
        return;
      }
      if (e.changedTouches && e.changedTouches[0]) {
        const touch = e.changedTouches[0];
        const dx = Math.abs(touch.clientX - touchStartPos.current.x);
        const dy = Math.abs(touch.clientY - touchStartPos.current.y);
        // If movement exceeds 10px, this was a scroll or pinch-zoom, not a tap or selection
        if (dx > 10 || dy > 10) {
          return;
        }

        // Before running, check if touch was inside popup
        if (popupRef.current) {
          const rect = popupRef.current.getBoundingClientRect();
          if (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
          ) {
            return;
          }
        }

        if (touchEndTimerRef.current) {
          clearTimeout(touchEndTimerRef.current);
        }
        touchEndTimerRef.current = setTimeout(() => {
          touchEndTimerRef.current = null;
          if (Date.now() - justDismissedTimeRef.current < 400) {
            return;
          }
          const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
          processSelectionOrClick({
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: targetEl
          });
        }, 120);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchend", onTouchEnd);
      if (touchEndTimerRef.current) {
        clearTimeout(touchEndTimerRef.current);
      }
    };
  }, [processSelectionOrClick]);

  // Safe page navigation (ensures any open popups or pending requests close)
  const goToPage = (p) => {
    const target = Math.max(1, Math.min(p, numPages || 1));
    closePopup();
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
    setPage(target);
    setPageJumpInput(String(target));
    if (ocrCache.current.has(target)) {
      setOcrWords(ocrCache.current.get(target));
    } else {
      setOcrWords([]);
    }
  };

  // File upload handler
  const handleFileChange = async (e) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        setNotice("कृपया केवल PDF (.pdf) फ़ाइल चुनें।");
        return;
      }
      closePopup();
      try {
        window.getSelection()?.removeAllRanges();
      } catch {}

      // Reset OCR cache, active words, and search state so second PDF has no stale data
      ocrCache.current.clear();
      setOcrWords([]);
      setIsScannedPage(false);
      setSearchResults([]);
      setSearchNotice("");
      setPage(1);
      setPageJumpInput("1");

      try {
        const buffer = await f.arrayBuffer();
        setFile({ data: new Uint8Array(buffer) });
        setNotice("");
      } catch (err) {
        console.warn("ArrayBuffer read fallback:", err);
        setFile(f);
        setNotice("");
      }
    }
  };

  // Zoom controls (closes any open popup and never triggers translation)
  const zoomIn = () => { closePopup(); setScale((s) => Math.min(2.5, +(s + 0.15).toFixed(2))); };
  const zoomOut = () => { closePopup(); setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2))); };
  const zoomReset = () => { closePopup(); setScale(1.0); };
  const cycleZoom = () => {
    closePopup();
    const levels = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    const currIdx = levels.findIndex((l) => Math.abs(l - scale) < 0.1);
    const nextIdx = (currIdx + 1) % levels.length;
    setScale(levels[nextIdx]);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    const el = document.documentElement;
    const isFull = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement
    );
    if (isFull) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    } else {
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(
        !!(
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement
        )
      );
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  // In-Document PDF text search
  const executeSearch = async () => {
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      setSearchNotice("खोजने के लिए शब्द लिखें।");
      return;
    }
    if (!pdfDoc) {
      setSearchNotice("पहले PDF अपलोड करें।");
      return;
    }

    setIsSearching(true);
    setSearchNotice("PDF में खोज रहे हैं…");

    try {
      const matches = [];
      for (let p = 1; p <= pdfDoc.numPages; p++) {
        const pageObj = await pdfDoc.getPage(p);
        const textContent = await pageObj.getTextContent();
        const pageText = textContent.items.map((it) => it.str).join(" ");
        const regex = new RegExp(escapeRegex(q), "gi");
        let m;
        while ((m = regex.exec(pageText)) !== null) {
          matches.push({
            page: p,
            index: m.index,
            snippet: pageText.slice(Math.max(0, m.index - 25), m.index + q.length + 25)
          });
        }
      }

      setSearchResults(matches);
      if (matches.length > 0) {
        setSearchIndex(0);
        setPage(matches[0].page);
        setSearchNotice(`${matches.length} परिणाम मिले। परिणाम 1 / ${matches.length}`);
      } else {
        setSearchNotice(`“${q}” के लिए कोई परिणाम नहीं मिला।`);
      }
    } catch (err) {
      console.error("Search error:", err);
      setSearchNotice("खोजने में समस्या हुई।");
    } finally {
      setIsSearching(false);
    }
  };

  const nextSearchMatch = () => {
    if (!searchResults.length) return;
    const nextIdx = (searchIndex + 1) % searchResults.length;
    setSearchIndex(nextIdx);
    goToPage(searchResults[nextIdx].page);
    setSearchNotice(`परिणाम ${nextIdx + 1} / ${searchResults.length}`);
  };

  const prevSearchMatch = () => {
    if (!searchResults.length) return;
    const prevIdx = (searchIndex - 1 + searchResults.length) % searchResults.length;
    setSearchIndex(prevIdx);
    goToPage(searchResults[prevIdx].page);
    setSearchNotice(`परिणाम ${prevIdx + 1} / ${searchResults.length}`);
  };



  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="top-header">
        <div className="brand" onClick={() => !file && fileInput.current?.click()}>
          <div className="logo" aria-hidden="true">
            <BookOpen size={34} strokeWidth={2.4} />
          </div>
          <div>
            <div className="brand-name">
              Read<span>Hindi</span>
            </div>
            <div className="tagline">Read English. Understand Hindi.</div>
          </div>
        </div>

        <div className="header-actions">
          <button
            aria-label="खोजें (Search in PDF)"
            title="Search in PDF"
            className={showSearch ? "action-active" : ""}
            onClick={() => setShowSearch((v) => !v)}
          >
            <Search size={22} />
          </button>
          <button
            aria-label="PDF अपलोड करें (Upload PDF)"
            title="Upload PDF"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={22} />
          </button>
          <button
            aria-label="अतिरिक्त विकल्प"
            title="More Options"
            onClick={() => setShowPagesDrawer((v) => !v)}
          >
            <MoreVertical size={22} />
          </button>
        </div>
      </header>

      {/* PDF Reader Toolbar */}
      <nav className="reader-toolbar" aria-label="PDF Controls">
        <div className="page-controls">
          <button
            disabled={!file || page <= 1}
            onClick={() => goToPage(page - 1)}
            aria-label="पिछला पेज (Previous page)"
            title="Previous Page"
          >
            <ChevronLeft size={19} />
          </button>
          <button
            className="page-display-btn"
            onClick={() => setShowPagesDrawer(true)}
            title="Click to jump to page"
            aria-label={`Page ${page} of ${numPages || 1}`}
          >
            <span className="current-page">{page}</span>
            <span className="muted">/ {numPages || "—"}</span>
          </button>
          <button
            disabled={!file || page >= numPages}
            onClick={() => goToPage(page + 1)}
            aria-label="अगला पेज (Next page)"
            title="Next Page"
          >
            <ChevronRight size={19} />
          </button>
        </div>

        <div className="tool-separator" />

        <div className="zoom-group">
          <button
            className="zoom-button"
            onClick={zoomOut}
            disabled={!file || scale <= 0.5}
            aria-label="ज़ूम कम करें (Zoom out)"
            title="Zoom Out"
          >
            <Minus size={17} />
          </button>
          <button
            className="scale-label"
            onClick={zoomReset}
            title="Reset Zoom to 100%"
            aria-label={`Current Zoom ${Math.round(scale * 100)}%`}
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            className="zoom-button"
            onClick={zoomIn}
            disabled={!file || scale >= 2.5}
            aria-label="ज़ूम बढ़ाएँ (Zoom in)"
            title="Zoom In"
          >
            <Plus size={17} />
          </button>
        </div>

        <button
          className="upload-inline"
          onClick={() => fileInput.current?.click()}
          aria-label="PDF अपलोड करें"
          title="Upload Newspaper PDF"
        >
          <Upload size={16} />
          <span>Upload PDF</span>
        </button>
      </nav>

      {/* In-Document Real Search Bar */}
      {showSearch && (
        <div className="search-bar" role="search">
          <div className="search-input-wrap">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && executeSearch()}
              placeholder="Search words in newspaper PDF…"
              autoFocus
            />
            {query && (
              <button
                className="clear-search-btn"
                onClick={() => {
                  setQuery("");
                  setSearchResults([]);
                  setSearchNotice("");
                }}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button className="search-submit-btn" onClick={executeSearch} disabled={isSearching}>
            {isSearching ? <LoaderCircle size={16} className="spin" /> : "Search"}
          </button>

          {searchResults.length > 0 && (
            <div className="search-match-nav">
              <span className="match-counter">
                {searchIndex + 1}/{searchResults.length}
              </span>
              <button onClick={prevSearchMatch} title="Previous Match" aria-label="Previous Match">
                <ChevronUp size={18} />
              </button>
              <button onClick={nextSearchMatch} title="Next Match" aria-label="Next Match">
                <ChevronDown size={18} />
              </button>
            </div>
          )}

          <button
            className="close-search-btn"
            onClick={() => setShowSearch(false)}
            aria-label="Close search"
          >
            <X size={19} />
          </button>
        </div>
      )}

      {/* Scanned/Image-based Page Banner */}
      {isScannedPage && !ocrBusy && ocrWords.length === 0 && file && (
        <div className="scanned-page-alert">
          <div className="alert-content">
            <AlertCircle size={18} />
            <span>इस पेज पर टेक्स्ट लेयर नहीं मिला (Scanned Image Page) — टेक्स्ट चुनने के लिए OCR चलाएँ</span>
          </div>
          <button className="alert-ocr-btn" onClick={runOCR}>
            <ScanText size={15} /> Run OCR on Page
          </button>
        </div>
      )}

      {/* Notice Strip */}
      {(searchNotice || notice) && (
        <div className="app-notice-strip">
          <span>{searchNotice || notice}</span>
          <button onClick={() => { setSearchNotice(""); setNotice(""); }} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Newspaper Reader Area */}
      <main className="reader-area" ref={readerAreaRef}>
        {!file ? (
          <div className="welcome-card">
            <div className="welcome-icon">
              <BookOpen size={46} strokeWidth={2.2} />
            </div>
            <h1>Read English. Understand Hindi.</h1>
            <p>
              Upload your daily English newspaper PDF. Select an individual word or a complete phrase
              to view its accurate Hindi meaning and translation.
            </p>

            <button
              className="primary-btn"
              onClick={() => fileInput.current?.click()}
              aria-label="Upload Newspaper PDF"
            >
              <Upload size={18} /> Upload Newspaper PDF
            </button>

            <div className="feature-row">
              <span>
                <Languages size={17} /> Word & Phrase Translation
              </span>
              <span>
                <Volume2 size={17} /> Audio Pronunciation
              </span>
              <span>
                <ScanText size={17} /> Scanned PDF OCR
              </span>
              <span>
                <Sparkles size={17} /> Offline Dictionary
              </span>
            </div>

            <p className="privacy-note">
              100% Private & In-Browser: Your PDF is processed locally and never uploaded to any external server.
            </p>
          </div>
        ) : (
          <div className="pdf-stage">
            <Document
              file={file}
              options={pdfOptions}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              onPassword={handlePassword}
              loading={
                <div className="pdf-loading-state">
                  <LoaderCircle size={28} className="spin" />
                  <span>PDF लोड हो रही है… (Loading Newspaper)</span>
                </div>
              }
            >
              <div className="page-paper" ref={pagePaperRef}>
                <Page
                  pageNumber={page}
                  scale={scale}
                  width={Math.min(window.innerWidth - 24, 920)}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  canvasRef={pdfCanvas}
                  onRenderTextLayerSuccess={onTextLayerRenderSuccess}
                  loading={
                    <div className="page-loading-state">
                      <LoaderCircle size={22} className="spin" />
                      <span>पेज {page} लोड हो रहा है…</span>
                    </div>
                  }
                />

                {/* Scanned PDF interactive transparent selectable OCR layer */}
                {ocrWords.length > 0 && showOcrBoxes && (
                  <div className="ocr-overlay" aria-label="Interactive OCR selectable words">
                    {ocrWords.map((item, idx) => {
                      const leftPct = (item.relBox.x0 * 100).toFixed(3);
                      const topPct = (item.relBox.y0 * 100).toFixed(3);
                      const widthPct = Math.max(0.1, (item.relBox.x1 - item.relBox.x0) * 100).toFixed(3);
                      const heightPct = Math.max(0.1, (item.relBox.y1 - item.relBox.y0) * 100).toFixed(3);

                      return (
                        <span
                          key={`${item.clean}-${idx}`}
                          className={`ocr-word-span ${
                            entry?.text?.toLowerCase() === item.clean.toLowerCase() ? "active" : ""
                          }`}
                          style={{
                            left: `${leftPct}%`,
                            top: `${topPct}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`
                          }}
                          data-word={item.clean}
                          data-idx={idx}
                          data-conf={Math.round(item.confidence || 0)}
                          title={`“${item.clean}” (OCR: ${Math.round(item.confidence || 0)}%) — Click for meaning or drag to select`}
                        >
                          {item.text}{" "}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </Document>

            {/* OCR Bar for Scanned/Image-based newspapers */}
            <div className="ocr-action-bar">
              <button
                className="ocr-btn"
                onClick={runOCR}
                disabled={ocrBusy}
                aria-label="Run OCR on scanned page"
              >
                <ScanText size={17} />
                <span>
                  {ocrBusy
                    ? `OCR विश्लेषण जारी है (${ocrProgress}%)…`
                    : "Scanned Newspaper? Run OCR on Page"}
                </span>
              </button>

              {ocrWords.length > 0 && (
                <button
                  className="ocr-toggle-btn"
                  onClick={() => setShowOcrBoxes((v) => !v)}
                  title="Toggle OCR interactive boxes"
                >
                  {showOcrBoxes ? "Hide Word Boxes" : `Show ${ocrWords.length} OCR Words`}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Extremely Minimal English-to-Hindi Meaning Popup (or Mobile Bottom Sheet) */}
      {entry && (
        <div
          ref={popupRef}
          className={`meaning-popup ${popupPos.placement}`}
          style={{
            position: "fixed",
            left: `${popupPos.left}px`,
            top: `${popupPos.top}px`,
            "--arrow-x": `${popupPos.arrowX}px`,
            pointerEvents: "auto",
            zIndex: 1000
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onTouchStart={(e) => {
            touchInsidePopupRef.current = true;
            e.stopPropagation();
          }}
          onTouchEnd={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label={`Meaning: ${entry.text || entry.word}`}
        >
          {/* Top Row: Part of Speech Badge (Left) & Functional Close Button (Right) */}
          <div className="popup-top-row">
            {entry.pos && entry.pos !== "Uncertain" ? (
              <span className={`pos-badge pos-${entry.pos.toLowerCase()}`}>
                {entry.pos}
              </span>
            ) : (
              <span className="pos-badge pos-default">
                {entry.type === "phrase" ? "Phrase" : (entry.type === "sentence" ? "Sentence" : "Word")}
              </span>
            )}

            <button
              className="close-btn"
              type="button"
              onClick={handleDismiss}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onTouchStart={(e) => {
                touchInsidePopupRef.current = true;
                e.stopPropagation();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDismiss(e);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Close"
              title="Close (✕)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Exact selected word with original capitalization */}
          <div className="popup-word">
            {entry.text || entry.word}
          </div>

          {/* Primary Hindi meaning prominently displayed */}
          {entry.isError ? (
            <div className="error-retry-box">
              <p className="error-message">{entry.meaning}</p>
              <button
                className="retry-btn"
                type="button"
                onClick={retryTranslation}
                aria-label="Retry Translation"
              >
                <RotateCcw size={14} /> पुनः प्रयास करें (Retry)
              </button>
            </div>
          ) : (
            <div className="popup-primary-meaning">
              {entry.meaning}
            </div>
          )}

          {/* Alternative Hindi meanings: 2-4 relevant alternatives when available */}
          {(() => {
            const rawAlts = Array.isArray(entry.alternatives) ? entry.alternatives : [];
            const primaryClean = (entry.meaning || "").trim().toLowerCase();
            const filteredAlts = rawAlts.filter(
              (alt) => alt && alt.trim() && alt.trim().toLowerCase() !== primaryClean
            );
            const displayAlts = filteredAlts.slice(0, 4);

            if (displayAlts.length > 0 && !entry.isError) {
              return (
                <div className="popup-alternatives">
                  <span className="alts-label">अन्य अर्थ:</span>{" "}
                  <span className="alts-list">{displayAlts.join(" · ")}</span>
                </div>
              );
            }
            return null;
          })()}

          {/* Minimal status indicator if translation is in progress */}
          {busy && (
            <div className="popup-loading-bar">
              खोज रहे हैं…
            </div>
          )}
        </div>
      )}

      {/* Pages Navigator Drawer / Jump Modal */}
      {showPagesDrawer && (
        <div className="modal-backdrop" onClick={() => setShowPagesDrawer(false)}>
          <div className="pages-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Page Navigator</h3>
              <button
                className="close-drawer-btn"
                onClick={() => setShowPagesDrawer(false)}
                aria-label="Close Page Navigator"
              >
                <X size={20} />
              </button>
            </div>

            {file ? (
              <div className="drawer-body">
                <div className="jump-row">
                  <label htmlFor="jump-input">Jump to page:</label>
                  <input
                    id="jump-input"
                    type="number"
                    min={1}
                    max={numPages || 1}
                    value={pageJumpInput}
                    onChange={(e) => setPageJumpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const p = parseInt(pageJumpInput, 10);
                        if (p >= 1 && p <= numPages) {
                          goToPage(p);
                          setShowPagesDrawer(false);
                        }
                      }
                    }}
                  />
                  <span>of {numPages}</span>
                  <button
                    className="jump-go-btn"
                    onClick={() => {
                      const p = parseInt(pageJumpInput, 10);
                      if (p >= 1 && p <= numPages) {
                        goToPage(p);
                        setShowPagesDrawer(false);
                      }
                    }}
                  >
                    Go
                  </button>
                </div>

                <div className="quick-pages-grid">
                  {Array.from({ length: numPages }, (_, i) => i + 1).map((pNum) => (
                    <button
                      key={pNum}
                      className={`page-pill-btn ${pNum === page ? "active" : ""}`}
                      onClick={() => {
                        goToPage(pNum);
                        setShowPagesDrawer(false);
                      }}
                    >
                      Page {pNum}
                    </button>
                  ))}
                </div>

                <div className="drawer-divider" />

                <button
                  className="drawer-upload-btn"
                  onClick={() => {
                    setShowPagesDrawer(false);
                    fileInput.current?.click();
                  }}
                >
                  <Upload size={16} /> Upload Another PDF
                </button>
              </div>
            ) : (
              <div className="drawer-empty">
                <p>No PDF is currently loaded.</p>
                <button
                  className="primary-btn"
                  onClick={() => {
                    setShowPagesDrawer(false);
                    fileInput.current?.click();
                  }}
                >
                  <Upload size={17} /> Choose PDF File
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <footer className="bottom-nav">
        <button
          className={showPagesDrawer ? "active" : ""}
          onClick={() => {
            if (!file) {
              fileInput.current?.click();
            } else {
              setShowPagesDrawer((v) => !v);
            }
          }}
          aria-label="Pages Navigator"
        >
          <FileText size={22} />
          <span>Pages</span>
        </button>

        <button
          className={showSearch ? "active" : ""}
          onClick={() => setShowSearch((v) => !v)}
          aria-label="Search within PDF"
        >
          <Search size={22} />
          <span>Search</span>
        </button>

        <button onClick={cycleZoom} aria-label={`Zoom level ${Math.round(scale * 100)}%`}>
          <ZoomIn size={22} />
          <span>{Math.round(scale * 100)}%</span>
        </button>

        <button onClick={toggleFullscreen} aria-label="Toggle Full Screen">
          {isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
          <span>{isFullscreen ? "Exit Full" : "Full Screen"}</span>
        </button>
      </footer>

      {/* Hidden File Input */}
      <input
        ref={fileInput}
        className="hidden-input"
        type="file"
        accept="application/pdf,.pdf"
        onClick={(e) => {
          e.target.value = "";
        }}
        onChange={handleFileChange}
      />
    </div>
  );
}