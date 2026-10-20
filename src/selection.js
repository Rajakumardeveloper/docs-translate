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

// Extract surrounding sentence boundary from PDF textLayer spans or local context
export function extractSurroundingSentence(range, normalizedText) {
  if (!range) return "";

  try {
    // 1. Identify start node and container
    const isTextNode = range.startContainer?.nodeType === (typeof Node !== "undefined" ? Node.TEXT_NODE : 3);
    const startSpan = isTextNode ? range.startContainer.parentElement : range.startContainer;
    if (!startSpan) return "";

    // 2. Check if inside PDF.js text layer
    const textLayer = startSpan.closest?.(".textLayer");
    if (textLayer) {
      // PDF.js text layer contains sibling <span> elements in reading order
      const allSpans = Array.from(textLayer.querySelectorAll("span"));
      const currentIdx = allSpans.indexOf(startSpan);

      if (currentIdx !== -1) {
        // Gather a window of spans around current selection (up to 15 spans before and after)
        const windowStart = Math.max(0, currentIdx - 15);
        const windowEnd = Math.min(allSpans.length, currentIdx + 16);
        const windowSpans = allSpans.slice(windowStart, windowEnd);

        // Concatenate text while fixing line-break hyphenations
        let combined = "";
        for (const s of windowSpans) {
          const t = (s.textContent || "").trim();
          if (t) {
            combined += (combined ? " " : "") + t;
          }
        }
        // Normalize hyphenated words across lines (e.g., "inves- tigation" -> "investigation")
        combined = combined.replace(/([A-Za-z]+)-\s+([A-Za-z]+)/g, "$1$2");
        combined = combined.replace(/\s+/g, " ").trim();

        // Find position of normalized target text in combined window
        const targetClean = (normalizedText || "").toLowerCase();
        const foundIdx = combined.toLowerCase().indexOf(targetClean);

        if (foundIdx !== -1) {
          // Look backwards for sentence start (punctuation followed by space, or start of string)
          const textBefore = combined.slice(0, foundIdx);
          const startMatches = [...textBefore.matchAll(/[.?!]\s+/g)];
          const sentenceStartIndex = startMatches.length > 0
            ? startMatches[startMatches.length - 1].index + startMatches[startMatches.length - 1][0].length
            : 0;

          // Look forwards for sentence end
          const textAfter = combined.slice(foundIdx + targetClean.length);
          const endMatch = textAfter.match(/[.?!](\s|$)/);
          const sentenceEndIndex = endMatch
            ? foundIdx + targetClean.length + endMatch.index + 1
            : combined.length;

          const sentence = combined.slice(sentenceStartIndex, sentenceEndIndex).trim();
          if (sentence.length >= targetClean.length) {
            return sentence;
          }
        }
      }
    }

    // 3. Fallback to immediate parent/container text
    const localText = (startSpan.textContent || "").replace(/\s+/g, " ").trim();
    if (localText && localText.length >= (normalizedText?.length || 0)) {
      const idx = localText.toLowerCase().indexOf((normalizedText || "").toLowerCase());
      if (idx !== -1) {
        const sStart = Math.max(0, idx - 60);
        const sEnd = Math.min(localText.length, idx + (normalizedText?.length || 0) + 80);
        return localText.slice(sStart, sEnd).trim();
      }
      return localText;
    }
  } catch (err) {
    console.warn("Sentence extraction fallback:", err);
  }

  return "";
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

  // Extract clean surrounding sentence from PDF textLayer spans or local context
  const extractedSentence = extractSurroundingSentence(range, normalized);

  // Fallback to local container if extractedSentence is empty
  let sentence = extractedSentence;
  if (!sentence) {
    const isTextNode = range.startContainer?.nodeType === (typeof Node !== "undefined" ? Node.TEXT_NODE : 3);
    const localContainer = isTextNode ? range.startContainer.parentElement : range.startContainer;
    const localText = (localContainer?.textContent || "").replace(/\s+/g, " ").trim();
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
      sentence: sentence || ""
    };
  }

  return null;
}

// Calculate clamped floating popup position near target word or phrase (or mobile bottom sheet)
export function calculatePopupPosition(wordRect, popupWidth = 360, popupHeight = 260) {
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 640;
  if (isMobile) {
    return {
      left: 0,
      top: 0,
      arrowX: 0,
      placement: "bottom-sheet",
      isMobile: true
    };
  }

  const winW = typeof window !== "undefined" ? window.innerWidth : 1280;
  const winH = typeof window !== "undefined" ? window.innerHeight : 800;

  if (!wordRect || (!wordRect.width && !wordRect.height && !wordRect.top)) {
    return {
      left: Math.max(12, (winW - popupWidth) / 2),
      top: 100,
      arrowX: popupWidth / 2,
      placement: "below",
      isMobile: false
    };
  }

  const wordCenterX = wordRect.left + (wordRect.width ? wordRect.width / 2 : 15);
  const wordTop = wordRect.top;
  const wordBottom = wordRect.bottom || wordRect.top + 20;

  // Horizontal position centered over word, clamped inside viewport
  let left = wordCenterX - popupWidth / 2;
  left = Math.max(12, Math.min(left, winW - popupWidth - 12));

  // Pointer arrow positioned directly above/below word center
  let arrowX = wordCenterX - left;
  arrowX = Math.max(22, Math.min(arrowX, popupWidth - 26));

  const topBarrier = 80; // Below header
  const bottomBarrier = winH - 70; // Above bottom nav

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

  return { left, top, arrowX, placement, isMobile: false };
}
