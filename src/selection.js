// ReadHindi Selection and Viewport Geometry Helper
// Robust multi-word phrase extraction, single-word boundary expansion, and positioning

// Clean a single word for dictionary lookup
export function cleanSingleWord(raw) {
  if (!raw) return "";
  let w = raw.trim();
  // Strip leading & trailing quotes, brackets, punctuations
  w = w.replace(/^[“"‘'(\[{<«»\s,.:;!?-]+|[”"’')\]}>«»\s,.:;!?-]+$/g, "");
  // Keep valid English word characters
  w = w.replace(/[^A-Za-z'-]/g, "");
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

const isWordChar = (c) => /[A-Za-z'-]/.test(c);

// Expand and extract complete selection (supports both single words AND multi-word phrases)
export function expandRangeToSelection(range) {
  if (!range || range.collapsed) return null;

  const rawText = range.toString();
  const normalized = normalizeSelectionText(rawText);

  // If selection contains only empty/whitespace characters or has no word/alphanumeric characters
  if (!normalized || normalized.length < 1 || !/[A-Za-z0-9\u0900-\u097F]/.test(normalized)) {
    return null;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const rect = range.getBoundingClientRect();

  // CASE 1: MULTI-WORD PHRASE OR SENTENCE
  // (e.g., "economic growth in India" or "The government announced new economic reforms")
  if (words.length > 1) {
    // Determine whether it's a full sentence or a phrase
    const isSentence = /[.?!]$/.test(normalized) || words.length >= 6;

    // Get surrounding context from the container
    let container = range.startContainer;
    const textLayer = container?.parentElement?.closest(".textLayer") ||
                      container?.closest?.(".textLayer") ||
                      container?.parentElement?.closest(".ocr-overlay");
    const sentence = textLayer?.innerText?.slice(0, 240) || "";

    return {
      type: isSentence ? "sentence" : "phrase",
      text: normalized,
      wordCount: words.length,
      rect,
      sentence
    };
  }

  // CASE 2: SINGLE WORD SELECTION OR CLICK
  // (e.g., "growth", or partial click "scovery")
  let container = range.startContainer;
  let start = range.startOffset;
  let end = range.endOffset;

  // If container is an ELEMENT_NODE, resolve down to TEXT_NODE
  if (container && container.nodeType === Node.ELEMENT_NODE) {
    if (container.childNodes && container.childNodes.length > 0) {
      const idx = Math.min(start, container.childNodes.length - 1);
      const child = container.childNodes[idx];
      if (child.nodeType === Node.TEXT_NODE) {
        container = child;
        start = 0;
        end = child.textContent.length;
      } else if (child.firstChild && child.firstChild.nodeType === Node.TEXT_NODE) {
        container = child.firstChild;
        start = 0;
        end = container.textContent.length;
      }
    }
  }

  const singleClean = cleanSingleWord(normalized);

  // If already selecting a complete single word of length >= 2
  if (singleClean && singleClean.length >= 2 && !/[0-9]/.test(singleClean)) {
    // Check if partial (e.g. 'scovery' where preceding char in container is 'i' or preceding span is 'D')
    if (container && container.nodeType === Node.TEXT_NODE) {
      const fullText = container.textContent || "";
      let s = start;
      let e = end;
      while (s > 0 && isWordChar(fullText[s - 1])) s--;
      while (e < fullText.length && isWordChar(fullText[e])) e++;

      let expandedText = cleanSingleWord(fullText.slice(s, e));

      // Also check previous sibling span (e.g. "Di" in prev span + "scovery" in this span)
      const parentSpan = container.parentElement;
      if (s === 0 && parentSpan) {
        const prev = parentSpan.previousElementSibling;
        if (prev && (prev.tagName === "SPAN" || prev.classList?.contains("ocr-word-span"))) {
          const prevText = prev.textContent || "";
          const match = prevText.match(/[A-Za-z]+$/);
          if (match && prevText.endsWith(match[0])) {
            expandedText = match[0] + expandedText;
          }
        }
      }

      // Check next sibling span
      if (e >= fullText.length && parentSpan) {
        const next = parentSpan.nextElementSibling;
        if (next && (next.tagName === "SPAN" || next.classList?.contains("ocr-word-span"))) {
          const nextText = next.textContent || "";
          const match = nextText.match(/^[A-Za-z]+/);
          if (match && nextText.startsWith(match[0])) {
            expandedText = expandedText + match[0];
          }
        }
      }

      if (expandedText && expandedText.length >= singleClean.length) {
        return {
          type: "word",
          text: expandedText,
          wordCount: 1,
          rect,
          sentence: fullText
        };
      }
    }

    return {
      type: "word",
      text: singleClean,
      wordCount: 1,
      rect,
      sentence: container?.parentElement?.closest(".textLayer")?.innerText?.slice(0, 160) || ""
    };
  }

  if (!container || container.nodeType !== Node.TEXT_NODE) {
    if (singleClean) {
      return {
        type: "word",
        text: singleClean,
        wordCount: 1,
        rect,
        sentence: ""
      };
    }
    return null;
  }

  const text = container.textContent || "";

  // If caret is collapsed (no active selection made), return null safely
  if (start === end) {
    return null;
  }

  while (start > 0 && isWordChar(text[start - 1])) start--;
  while (end < text.length && isWordChar(text[end])) end++;

  let wordPart = text.slice(start, end);

  // Check sibling spans in case PDF.js split the word across multiple spans (e.g. "Di" + "scovery")
  let prefix = "";
  let suffix = "";
  const parentSpan = container.parentElement;

  if (start === 0 && parentSpan) {
    const prev = parentSpan.previousElementSibling;
    if (prev && prev.tagName === "SPAN") {
      const prevText = prev.textContent || "";
      const match = prevText.match(/[A-Za-z]+$/);
      if (match && prevText.endsWith(match[0])) {
        prefix = match[0];
      }
    }
  }

  if (end >= text.length && parentSpan) {
    const next = parentSpan.nextElementSibling;
    if (next && next.tagName === "SPAN") {
      const nextText = next.textContent || "";
      const match = nextText.match(/^[A-Za-z]+/);
      if (match && nextText.startsWith(match[0])) {
        suffix = match[0];
      }
    }
  }

  const finalWord = cleanSingleWord(prefix + wordPart + suffix);
  if (!finalWord || (finalWord.length < 2 && !["a", "i", "A", "I"].includes(finalWord))) {
    return null;
  }

  let wordRect = null;
  try {
    const wordRange = document.createRange();
    wordRange.setStart(container, start);
    wordRange.setEnd(container, Math.min(end, text.length));
    wordRect = wordRange.getBoundingClientRect();
  } catch (err) {
    wordRect = parentSpan?.getBoundingClientRect() || rect;
  }

  const textLayer = parentSpan?.closest(".textLayer");
  let sentence = "";
  if (textLayer) {
    const allText = textLayer.innerText || "";
    const idx = allText.toLowerCase().indexOf(finalWord.toLowerCase());
    if (idx !== -1) {
      const sStart = Math.max(0, idx - 50);
      const sEnd = Math.min(allText.length, idx + finalWord.length + 70);
      sentence = allText.slice(sStart, sEnd).replace(/\s+/g, " ").trim();
    }
  }

  return {
    type: "word",
    text: finalWord,
    wordCount: 1,
    rect: wordRect,
    sentence
  };
}

// Extract word or phrase when user taps or clicks directly at a point
export function getWordAtPointOrTarget(clientX, clientY, target) {
  // If target has data-word attribute (from OCR span)
  if (target?.getAttribute?.("data-word")) {
    const w = cleanSingleWord(target.getAttribute("data-word"));
    if (w) {
      return {
        type: "word",
        text: w,
        wordCount: 1,
        rect: target.getBoundingClientRect(),
        sentence: ""
      };
    }
  }

  let span = target?.closest ? target.closest(".textLayer span, .ocr-word-span") : null;

  // If target was the .textLayer div or container, find the span at (clientX, clientY)
  if (!span) {
    const layer = target?.closest ? target.closest(".textLayer, .ocr-overlay") : null;
    if (layer) {
      const spans = layer.querySelectorAll("span");
      for (const s of spans) {
        const r = s.getBoundingClientRect();
        if (
          clientX >= r.left - 4 &&
          clientX <= r.right + 4 &&
          clientY >= r.top - 4 &&
          clientY <= r.bottom + 4
        ) {
          span = s;
          break;
        }
      }
    }
  }

  if (!span) return null;

  const text = span.textContent || "";
  if (!text.trim()) return null;

  const words = text.trim().split(/\s+/).filter(Boolean);
  // If span has only one word
  if (words.length === 1) {
    const w = cleanSingleWord(words[0]);
    if (w && w.length >= 2) {
      return {
        type: "word",
        text: w,
        wordCount: 1,
        rect: span.getBoundingClientRect(),
        sentence: span.closest(".textLayer")?.innerText?.slice(0, 160) || ""
      };
    }
  }

  // Try caretRangeFromPoint
  let range = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(clientX, clientY);
  }
  if (range) {
    const res = expandRangeToSelection(range);
    if (res && res.text) return res;
  }

  // Fallback: estimate by click relative X position in span
  const rect = span.getBoundingClientRect();
  if (rect.width > 0) {
    const relX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const charIdx = Math.max(0, Math.min(text.length - 1, Math.floor(relX * text.length)));
    let s = charIdx, e = charIdx;
    while (s > 0 && isWordChar(text[s - 1])) s--;
    while (e < text.length && isWordChar(text[e])) e++;
    const w = cleanSingleWord(text.slice(s, e));
    if (w && w.length >= 2) {
      return {
        type: "word",
        text: w,
        wordCount: 1,
        rect,
        sentence: span.closest(".textLayer")?.innerText?.slice(0, 160) || ""
      };
    }
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
