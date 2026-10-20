// ReadHindi Selection and Viewport Geometry Helper
// Robust multi-word phrase extraction, single-word boundary extraction, and positioning

// Clean a single word for dictionary lookup
export function cleanSingleWord(raw) {
  if (!raw) return "";
  let w = raw.trim();
  // Strip leading & trailing quotes, brackets, punctuations
  w = w.replace(/^[“"‘'(\[{<«»\s,.:;!?-]+|[”"’')\]}>«»\s,.:;!?-]+$/g, "");
  // Keep valid English word characters and digits
  w = w.replace(/[^A-Za-z0-9'-]/g, "");
  return w;
}

// Normalize multi-word selections, phrases, or full sentences
export function normalizeSelectionText(raw) {
  if (!raw) return "";
  let text = raw.trim();

  // Fix hyphenated line breaks across newspaper lines/columns (e.g., "inves-\n tigation" -> "investigation")
  text = text.replace(/([A-Za-z]+)-\s*[\r\n]+\s*([A-Za-z]+)/g, "$1$2");

  // Replace remaining newlines and multiple spaces with a single clean space
  text = text.replace(/\s+/g, " ").trim();

  // Strip outer quotes, brackets, bullets, or leading/trailing dashes
  text = text.replace(/^[“"‘'(\[{<«»—–\s]+|[”"’')\]}>«»—–\s]+$/g, "");

  return text;
}

// Expand and extract complete selection (supports both single words AND multi-word phrases)
export function expandRangeToSelection(range) {
  if (!range || range.collapsed) return null;

  const rawText = range.toString();
  const normalized = normalizeSelectionText(rawText);

  // If selection contains only empty/whitespace characters or has no alphanumeric characters
  if (!normalized || normalized.length < 1 || !/[A-Za-z0-9\u0900-\u097F]/.test(normalized)) {
    return null;
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  // Strict guard: ReadHindi translates a selected word or phrase, never an entire article or page dump.
  // Reject selections exceeding 35 words or 300 characters.
  if (words.length === 0 || words.length > 35 || normalized.length > 300) {
    return null;
  }

  const rect = range.getBoundingClientRect();

  // Extract surrounding context locally from the immediate container without reading full-page textLayer.innerText
  const isTextNode = range.startContainer?.nodeType === (typeof Node !== "undefined" ? Node.TEXT_NODE : 3);
  const localContainer = isTextNode ? range.startContainer.parentElement : range.startContainer;
  const localText = (localContainer?.textContent || "").replace(/\s+/g, " ").trim();
  let sentence = "";
  if (localText && localText.length > normalized.length) {
    const idx = localText.toLowerCase().indexOf(normalized.toLowerCase());
    if (idx !== -1) {
      const sStart = Math.max(0, idx - 50);
      const sEnd = Math.min(localText.length, idx + normalized.length + 70);
      sentence = localText.slice(sStart, sEnd).trim();
    } else {
      sentence = localText.slice(0, 160).trim();
    }
  }

  // CASE 1: MULTI-WORD PHRASE OR SENTENCE (e.g. "economic growth in India", "Constitution of India")
  if (words.length > 1) {
    const isSentence = /[.?!]$/.test(normalized) || words.length >= 6;
    return {
      type: isSentence ? "sentence" : "phrase",
      text: normalized,
      wordCount: words.length,
      rect,
      sentence: sentence || normalized
    };
  }

  // CASE 2: SINGLE WORD SELECTION (e.g. "Constitution", "reforms")
  const singleClean = cleanSingleWord(normalized);
  if (singleClean && singleClean.length >= 1 && /[A-Za-z]/.test(singleClean)) {
    return {
      type: "word",
      text: singleClean,
      wordCount: 1,
      rect,
      sentence
    };
  }

  return null;
}

// Calculate clamped floating popup position near target word or phrase
export function calculatePopupPosition(wordRect, popupWidth = 360, popupHeight = 260) {
  if (!wordRect || (!wordRect.width && !wordRect.height && !wordRect.top)) {
    return {
      left: Math.max(12, (window.innerWidth - popupWidth) / 2),
      top: 100,
      arrowX: popupWidth / 2,
      placement: "below"
    };
  }

  const wordCenterX = wordRect.left + (wordRect.width ? wordRect.width / 2 : 15);
  const wordTop = wordRect.top;
  const wordBottom = wordRect.bottom || wordRect.top + 20;

  // Horizontal position centered over word, clamped inside viewport
  let left = wordCenterX - popupWidth / 2;
  left = Math.max(12, Math.min(left, window.innerWidth - popupWidth - 12));

  // Pointer arrow positioned directly above/below word center
  let arrowX = wordCenterX - left;
  arrowX = Math.max(22, Math.min(arrowX, popupWidth - 26));

  const topBarrier = 80; // Below header
  const bottomBarrier = window.innerHeight - 70; // Above bottom nav

  const spaceBelow = bottomBarrier - wordBottom;
  const spaceAbove = wordTop - topBarrier;

  let top = wordBottom + 8;
  let placement = "below";

  if (spaceBelow >= popupHeight + 12) {
    top = wordBottom + 8;
    placement = "below";
  } else if (spaceAbove >= popupHeight + 12) {
    top = Math.max(topBarrier + 5, wordTop - popupHeight - 8);
    placement = "above";
  } else {
    // Limited vertical room: place on side with more clearance
    if (spaceBelow >= spaceAbove) {
      top = Math.max(topBarrier + 5, Math.min(wordBottom + 8, bottomBarrier - popupHeight - 8));
      placement = "below";
    } else {
      top = Math.max(topBarrier + 5, wordTop - popupHeight - 8);
      placement = "above";
    }
  }

  return { left, top, arrowX, placement };
}
