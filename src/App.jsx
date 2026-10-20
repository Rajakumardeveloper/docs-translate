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
  AlertCircle
} from "lucide-react";
import { createWorker } from "tesseract.js";
import { lookupText, normalizeLookupText } from "./dictionary.js";
import {
  cleanSingleWord,
  normalizeSelectionText,
  expandRangeToSelection,
  calculatePopupPosition
} from "./selection.js";

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const [altIndex, setAltIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

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

  // Reset states on new file
  const onDocumentLoadSuccess = (doc) => {
    setPdfDoc(doc);
    setNumPages(doc.numPages);
    setPage(1);
    setPageJumpInput("1");
    closePopup();
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

    if (typeof item === "string") {
      text = normalizeSelectionText(item);
    } else if (item && typeof item === "object") {
      text = item.text || item.word || "";
      rect = item.rect || null;
      sentence = item.sentence || "";
      type = item.type || (text.includes(" ") ? "phrase" : "word");
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

    // Increment request token to discard any previous in-flight responses
    const currentReqId = ++requestIdRef.current;

    // Cancel any previous in-flight request before initiating a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setActiveWordRect(rect);
    const pos = calculatePopupPosition(rect, 360, 260);
    setPopupPos(pos);

    setAltIndex(0);
    const isMultiWord = words.length > 1;
    const initialType = isMultiWord ? (type === "sentence" ? "sentence" : "phrase") : "word";

    setEntry({
      type: initialType,
      text,
      word: text,
      ipa: initialType === "word" ? `/${text}/` : "",
      meaning: initialType === "word" ? "अर्थ खोज रहे हैं…" : "अनुवाद कर रहे हैं… (Translating phrase…)",
      alternatives: [initialType === "word" ? "अर्थ खोज रहे हैं…" : "अनुवाद कर रहे हैं…"],
      sentence
    });
    setBusy(true);

    try {
      const res = await lookupText(text, signal, sentence);
      if (!signal.aborted && currentReqId === requestIdRef.current) {
        if (res) {
          setEntry(res);
          if (rect) {
            setPopupPos(calculatePopupPosition(rect, 360, 260));
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
          sentence
        });
      }
    } finally {
      if (!signal.aborted && currentReqId === requestIdRef.current) {
        setBusy(false);
      }
    }
  }, []);

  // Update popup position when scrolling reader area
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (entry && activeWordRect) {
        setPopupPos(calculatePopupPosition(activeWordRect, 360, 260));
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

  // Check text content on page render (Mixed PDF Auto-Detection)
  // NEVER triggers translation; only checks whether OCR overlay is needed for scanned pages
  const onTextLayerRenderSuccess = useCallback(() => {
    if (!pagePaperRef.current) return;
    const textLayer = pagePaperRef.current.querySelector(".textLayer");
    if (!textLayer) return;

    // Count rendered text spans directly without accessing full-page innerText
    const spans = textLayer.querySelectorAll("span");
    const hasFewWords = spans.length < 5;
    setIsScannedPage(hasFewWords);

    // If page is scanned and we already have cached OCR results for this page, load them
    if (hasFewWords && ocrCache.current.has(page)) {
      setOcrWords(ocrCache.current.get(page));
    } else if (!hasFewWords && !ocrCache.current.has(page)) {
      setOcrWords([]);
    }
  }, [page]);

  // Process text selection across PDF text spans or OCR overlays
  const processSelectionOrClick = useCallback(
    (e) => {
      // If clicking inside the popup, let popup buttons handle their events
      if (popupRef.current && popupRef.current.contains(e.target)) return;

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
        if (clean && clean.length >= 2) {
          openMeaning({
            type: "word",
            text: clean,
            wordCount: 1,
            rect: ocrSpan.getBoundingClientRect(),
            sentence: ""
          });
          return;
        }
      }

      // 3. Otherwise: No active selection was made (clicked background, scrolled, zoomed, or empty click)
      // Dismiss active popup safely and NEVER trigger automatic translation
      closePopup();
    },
    [openMeaning, closePopup]
  );

  useEffect(() => {
    const onTouchStart = (e) => {
      if (e.touches && e.touches[0]) {
        touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onMouseUp = (e) => processSelectionOrClick(e);
    const onTouchEnd = (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const touch = e.changedTouches[0];
        const dx = Math.abs(touch.clientX - touchStartPos.current.x);
        const dy = Math.abs(touch.clientY - touchStartPos.current.y);
        // If movement exceeds 10px, this was a scroll or pinch-zoom, not a tap or selection
        if (dx > 10 || dy > 10) {
          return;
        }
        setTimeout(() => {
          processSelectionOrClick({
            clientX: touch.clientX,
            clientY: touch.clientY,
            target: document.elementFromPoint(touch.clientX, touch.clientY)
          });
        }, 130);
      }
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [processSelectionOrClick]);

  // Audio pronunciation of word, phrase, or sentence
  const speakText = () => {
    const targetText = entry?.text || entry?.word;
    if (!targetText || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(targetText);
    utter.lang = "en-US";
    utter.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find((v) => v.lang.startsWith("en"));
    if (enVoice) utter.voice = enVoice;

    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  // Alternative meanings cycle
  const changeAlt = (dir) => {
    if (!entry?.alternatives?.length) return;
    const total = entry.alternatives.length;
    setAltIndex((prev) => (prev + dir + total) % total);
  };

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

  // Advanced OCR for scanned & image-based newspaper pages
  const runOCR = async () => {
    if (!pdfCanvas.current) {
      setNotice("पहले PDF खोलें, फिर OCR चलाएँ।");
      return;
    }

    // Check if page already has cached OCR
    if (ocrCache.current.has(page)) {
      setOcrWords(ocrCache.current.get(page));
      setNotice(`पेज ${page} के लिए कैश किया गया OCR लोड किया गया।`);
      return;
    }

    setOcrBusy(true);
    setOcrProgress(5);
    setNotice("OCR इंजन शुरू हो रहा है (Initializing OCR Engine)…");

    try {
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text" && typeof m.progress === "number") {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      // Preprocess image for difficult/low-contrast newsprint: apply contrast & grayscale
      const srcCanvas = pdfCanvas.current;
      const imageW = srcCanvas.width || 1;
      const imageH = srcCanvas.height || 1;
      const offscreen = document.createElement("canvas");
      offscreen.width = srcCanvas.width;
      offscreen.height = srcCanvas.height;
      const ctx = offscreen.getContext("2d");
      ctx.filter = "grayscale(100%) contrast(140%)";
      ctx.drawImage(srcCanvas, 0, 0);

      setNotice("स्कैन किए गए अख़बार का विश्लेषण जारी है…");
      const ret = await worker.recognize(offscreen, {}, { blocks: true, tsv: true });
      await worker.terminate();

      const words = [];
      if (ret.data?.blocks && ret.data.blocks.length > 0) {
        for (const block of ret.data.blocks) {
          for (const para of block.paragraphs || []) {
            for (const line of para.lines || []) {
              for (const w of line.words || []) {
                const clean = cleanSingleWord(w.text);
                if (clean && clean.length >= 2 && w.bbox) {
                  const left = w.bbox.x0;
                  const top = w.bbox.y0;
                  const right = w.bbox.x1;
                  const bottom = w.bbox.y1;
                  words.push({
                    text: w.text.trim(),
                    clean,
                    relBox: {
                      x0: left / imageW,
                      y0: top / imageH,
                      x1: right / imageW,
                      y1: bottom / imageH
                    },
                    confidence: w.confidence
                  });
                }
              }
            }
          }
        }
      } else if (ret.data?.tsv) {
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
            if (clean && clean.length >= 2 && !isNaN(left) && !isNaN(top)) {
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
      }

      console.log(`OCR detected ${words.length} words with relative bounding boxes.`);

      ocrCache.current.set(page, words);
      setOcrWords(words);
      setIsScannedPage(false);

      if (words.length === 0) {
        setNotice("इस पेज पर टेक्स्ट नहीं मिला। बेहतर स्पष्ट स्कैन आज़माएँ।");
      } else {
        setNotice(`OCR सफल: पेज पर ${words.length} शब्द पहचाने गए। शब्द या वाक्य चुनें।`);
      }
    } catch (err) {
      console.error("OCR error:", err);
      setNotice("OCR नहीं चल पाया। इंटरनेट कनेक्शन जाँचें।");
    } finally {
      setOcrBusy(false);
      setOcrProgress(0);
    }
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
                          title={`“${item.clean}” — Click for meaning or drag across words to translate phrase`}
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

      {/* Floating Hindi Dictionary & Phrase Translation Popup */}
      {entry && (
        <div
          ref={popupRef}
          className={`meaning-popup ${popupPos.placement}`}
          style={{
            position: "fixed",
            left: `${popupPos.left}px`,
            top: `${popupPos.top}px`,
            "--arrow-x": `${popupPos.arrowX}px`
          }}
          role="dialog"
          aria-label={`Hindi Meaning of ${entry.text || entry.word}`}
        >
          {/* Header */}
          <div className="popup-head">
            <button
              className={`sound-btn ${isSpeaking ? "speaking" : ""}`}
              onClick={speakText}
              aria-label="Listen to English pronunciation"
              title="Pronounce Selection"
            >
              <Volume2 size={20} />
            </button>

            <div className="word-block">
              {entry.type && entry.type !== "word" && (
                <span className="type-badge">
                  {entry.type === "sentence" ? "Sentence Translation" : "Phrase Translation"}
                </span>
              )}
              <strong>{entry.text || entry.word}</strong>
              {entry.ipa ? <small>{entry.ipa}</small> : null}
            </div>

            <button
              className="close-btn"
              onClick={() => {
                setEntry(null);
                setActiveWordRect(null);
              }}
              aria-label="Close Dialog"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Meaning / Translation */}
          <div className="main-meaning">
            {entry.alternatives?.[altIndex] || entry.meaning}
          </div>

          {/* English definition if available */}
          {entry.definition && <p className="definition">{entry.definition}</p>}

          {/* Alternative Meanings Pills (only when multiple alternatives exist) */}
          {entry.alternatives && entry.alternatives.length > 1 && (
            <>
              <div className="other-label">Other meanings:</div>
              <div className="alternatives">
                {entry.alternatives.map((alt, i) => (
                  <button
                    key={`${alt}-${i}`}
                    className={`alt-pill ${i === altIndex ? "active" : ""}`}
                    onClick={() => setAltIndex(i)}
                    title={`Select “${alt}”`}
                  >
                    <span className="dot">•</span>
                    {alt}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Footer with arrows & position indicator if multiple alternatives exist */}
          {entry.alternatives && entry.alternatives.length > 1 && (
            <div className="popup-footer">
              <button
                onClick={() => changeAlt(-1)}
                aria-label="Previous alternative meaning"
                title="Previous Meaning"
              >
                <ChevronLeft size={18} />
              </button>

              <span className="meaning-counter">
                {Math.min(altIndex + 1, entry.alternatives.length)} / {entry.alternatives.length}
              </span>

              <button
                onClick={() => changeAlt(1)}
                aria-label="Next alternative meaning"
                title="Next Meaning"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Context sentence if available */}
          {entry.sentence && (
            <div className="context-line" title="Context sentence">
              {entry.sentence}
            </div>
          )}

          {busy && (
            <div className="lookup-note">
              {entry.type === "word" ? "अर्थ खोज रहे हैं…" : "अनुवाद कर रहे हैं…"}
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