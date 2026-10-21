// ReadHindi Selection and Viewport Geometry Helper
// Robust multi-word phrase extraction, single-word boundary extraction, cross-span word reconstruction, and positioning

// Clean a single word for dictionary lookup
export function cleanSingleWord(raw) {
  if (!raw) return "";
  let w = raw.trim();
  // Strip leading & trailing quotes, brackets, punctuations
  w = w.replace(/^[“"‘'(\[{<«»\s,.:;!?-]+|[”"’')\]}>«»\s,.:;!?-]+$/g, "");
  // If multiple space-separated words are passed, pick only the first word instead of merging words
  if (/\s/.test(w)) {
    w = w.split(/\s+/)[0];
    w = w.replace(/^[“"‘'(\[{<«»\s,.:;!?-]+|[”"’')\]}>«»\s,.:;!?-]+$/g, "");
  }
  // Keep valid English word characters, digits, hyphens, and apostrophes
  w = w.replace(/[^A-Za-z0-9'-]/g, "");
  return w;
}

// Accurately segment OCR text tokens into individual words with proportional bounding boxes
// Prevents merging of adjacent words (e.g. "ActorTigerShro" -> "Actor", "Tiger", "Shro")
export function segmentOcrText(rawText, left, top, width, height, conf, imageW, imageH) {
  if (!rawText || !rawText.trim()) return [];
  const trimmed = rawText.trim();
  const safeImgW = imageW || 1;
  const safeImgH = imageH || 1;

  // 1. Separate by explicit whitespace
  const spaceTokens = trimmed.split(/\s+/).filter(Boolean);

  // 2. Identify potential CamelCase concatenated words (e.g., "ActorTigerShro" in tight headline fonts)
  let wordTokens = [];
  for (const st of spaceTokens) {
    const camelMatch = st.match(/[A-Z][a-z0-9'-]+|[A-Z]+(?=[A-Z][a-z0-9]|\b)|[a-z0-9'-]+/g);
    if (camelMatch && camelMatch.length > 1 && camelMatch.join("").toLowerCase() === st.toLowerCase()) {
      wordTokens.push(...camelMatch);
    } else {
      wordTokens.push(st);
    }
  }

  if (wordTokens.length === 0) return [];

  // Single word token
  if (wordTokens.length === 1) {
    const clean = cleanSingleWord(wordTokens[0]);
    const isSingleValid = ["a", "i", "A", "I"].includes(clean);
    if (!clean || (clean.length < 2 && !isSingleValid)) return [];
    return [{
      text: wordTokens[0],
      clean,
      relBox: {
        x0: left / safeImgW,
        y0: top / safeImgH,
        x1: (left + width) / safeImgW,
        y1: (top + height) / safeImgH
      },
      confidence: conf
    }];
  }

  // Multi-word OCR line/token: partition bounding box proportionally across words
  const totalChars = wordTokens.reduce((sum, w) => sum + Math.max(1, w.length), 0);
  const results = [];
  let currentX = left;

  for (const token of wordTokens) {
    const clean = cleanSingleWord(token);
    const isSingleValid = ["a", "i", "A", "I"].includes(clean);
    const tokenW = Math.max(1, Math.round((Math.max(1, token.length) / totalChars) * width));
    if (clean && (clean.length >= 2 || isSingleValid)) {
      results.push({
        text: token,
        clean,
        relBox: {
          x0: currentX / safeImgW,
          y0: top / safeImgH,
          x1: (currentX + tokenW) / safeImgW,
          y1: (top + height) / safeImgH
        },
        confidence: conf
      });
    }
    currentX += tokenW;
  }

  return results;
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

// Determine if two PDF textLayer spans are visually on the same line and adjacent
export function areSpansAdjacent(s1, s2) {
  if (!s1 || !s2 || s1 === s2) return false;
  try {
    const r1 = s1.getBoundingClientRect ? s1.getBoundingClientRect() : null;
    const r2 = s2.getBoundingClientRect ? s2.getBoundingClientRect() : null;
    if (r1 && r2 && (r1.width > 0 || r1.height > 0) && (r2.width > 0 || r2.height > 0)) {
      const vOverlap = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
      const minH = Math.min(r1.height, r2.height);
      const isSameLine = vOverlap >= minH * 0.35 || Math.abs(r1.top - r2.top) <= Math.max(6, minH * 0.5);
      if (!isSameLine) return false;
      const gap = r2.left - r1.right;
      return gap >= -8 && gap <= 8;
    }
  } catch {}
  // Fallback for mock environments (e.g. Node tests with sibling DOM elements)
  return s1.parentElement === s2.parentElement;
}

// Scan backwards in adjacent previous spans for word characters continuing this word (e.g., "S" before "pecial")
export function getPreviousSpanWordPrefix(span) {
  let prefix = "";
  let curr = span?.previousElementSibling;
  while (curr && curr.tagName === "SPAN" && areSpansAdjacent(curr, curr.nextElementSibling)) {
    const text = curr.textContent || "";
    if (!text) break;
    if (/\s$/.test(text)) break;
    const match = text.match(/[A-Za-z0-9'’\-]+$/);
    if (match) {
      prefix = match[0] + prefix;
      if (match[0].length < text.length) break;
    } else {
      break;
    }
    curr = curr.previousElementSibling;
  }
  return prefix;
}

// Scan forwards in adjacent next spans for word characters continuing this word
export function getNextSpanWordSuffix(span) {
  let suffix = "";
  let curr = span?.nextElementSibling;
  while (curr && curr.tagName === "SPAN" && areSpansAdjacent(curr.previousElementSibling, curr)) {
    const text = curr.textContent || "";
    if (!text) break;
    if (/^\s/.test(text)) break;
    const match = text.match(/^[A-Za-z0-9'’\-]+/);
    if (match) {
      suffix += match[0];
      if (match[0].length < text.length) break;
    } else {
      break;
    }
    curr = curr.nextElementSibling;
  }
  return suffix;
}

// Estimate font size of a PDF text span
export function getSpanFontSize(span) {
  if (!span) return 12;
  try {
    if (span.style && span.style.fontSize) {
      const fs = parseFloat(span.style.fontSize);
      if (!isNaN(fs) && fs > 0) return fs;
    }
    if (span.getBoundingClientRect) {
      const r = span.getBoundingClientRect();
      if (r && r.height > 0) return r.height;
    }
  } catch {}
  return 12;
}

// Classify layout region: 'headline' | 'subheading' | 'highlighted' | 'body' | 'caption'
export function classifyTextRegion(span, allSpans) {
  if (!span) return { region: "body", fontSize: 12, isBold: false, isHighlighted: false };
  let fontSize = 12;
  let isBold = false;
  let isHighlighted = false;

  try {
    fontSize = getSpanFontSize(span);
    const computed = typeof window !== "undefined" && window.getComputedStyle ? window.getComputedStyle(span) : null;
    if (computed) {
      const weight = computed.fontWeight;
      if (weight === "bold" || parseInt(weight, 10) >= 600) {
        isBold = true;
      }
      const bg = computed.backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)" && !bg.includes("255, 255, 255")) {
        isHighlighted = true;
      }
    }
    if (span.classList?.contains("search-highlight") || span.closest?.(".pdf-word-highlight") || span.closest?.(".ocr-word-span.active")) {
      isHighlighted = true;
    }
  } catch {}

  // Compare with median font size if allSpans provided
  let medianFs = 12;
  if (Array.isArray(allSpans) && allSpans.length > 0) {
    const sizes = allSpans.map(getSpanFontSize).filter(s => s > 0).sort((a, b) => a - b);
    if (sizes.length > 0) {
      medianFs = sizes[Math.floor(sizes.length / 2)];
    }
  }

  let region = "body";
  if (isHighlighted) {
    region = "highlighted";
  } else if (fontSize >= Math.max(18, medianFs * 1.5) || (fontSize >= Math.max(15, medianFs * 1.3) && isBold)) {
    region = "headline";
  } else if (fontSize >= Math.max(13, medianFs * 1.15) || isBold) {
    region = "subheading";
  } else if (fontSize <= Math.min(9, medianFs * 0.8)) {
    region = "caption";
  }

  return { region, fontSize, isBold, isHighlighted };
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
    if (textLayer && typeof textLayer.querySelectorAll === "function") {
      // PDF.js text layer contains sibling <span> elements in reading order
      const allSpans = Array.from(textLayer.querySelectorAll("span"));
      const currentIdx = allSpans.indexOf(startSpan);

      if (currentIdx !== -1) {
        const startFontSize = getSpanFontSize(startSpan);

        // Gather spans around current selection with structural boundary awareness (headlines vs body, and column boundaries)
        let windowStart = currentIdx;
        while (windowStart > 0 && windowStart > currentIdx - 15) {
          const prevSpan = allSpans[windowStart - 1];
          const prevFs = getSpanFontSize(prevSpan);
          // Stop at major font-size transition between headline and body text (> 35% difference)
          if (startFontSize > 0 && prevFs > 0 && Math.abs(prevFs - startFontSize) / Math.max(prevFs, startFontSize) > 0.35) {
            break;
          }
          // Stop at newspaper column boundary (non-overlapping horizontal bounds with vertical gap)
          try {
            const rCurr = startSpan.getBoundingClientRect ? startSpan.getBoundingClientRect() : null;
            const rPrev = prevSpan.getBoundingClientRect ? prevSpan.getBoundingClientRect() : null;
            if (rCurr && rPrev && rCurr.width > 0 && rPrev.width > 0) {
              const noHorizontalOverlap = rPrev.right < rCurr.left - 30 || rCurr.right < rPrev.left - 30;
              if (noHorizontalOverlap && Math.abs(rCurr.top - rPrev.top) > 8) {
                break;
              }
            }
          } catch {}
          const prevText = (prevSpan.textContent || "").trim();
          if (/[.?!]$/.test(prevText)) {
            break;
          }
          windowStart--;
        }

        let windowEnd = currentIdx;
        while (windowEnd < allSpans.length - 1 && windowEnd < currentIdx + 15) {
          const nextSpan = allSpans[windowEnd + 1];
          const nextFs = getSpanFontSize(nextSpan);
          if (startFontSize > 0 && nextFs > 0 && Math.abs(nextFs - startFontSize) / Math.max(nextFs, startFontSize) > 0.35) {
            break;
          }
          // Stop at newspaper column boundary
          try {
            const rCurr = startSpan.getBoundingClientRect ? startSpan.getBoundingClientRect() : null;
            const rNext = nextSpan.getBoundingClientRect ? nextSpan.getBoundingClientRect() : null;
            if (rCurr && rNext && rCurr.width > 0 && rNext.width > 0) {
              const noHorizontalOverlap = rNext.right < rCurr.left - 30 || rCurr.right < rNext.left - 30;
              if (noHorizontalOverlap && Math.abs(rCurr.top - rNext.top) > 8) {
                break;
              }
            }
          } catch {}
          const currText = (allSpans[windowEnd].textContent || "").trim();
          if (/[.?!]$/.test(currText)) {
            break;
          }
          windowEnd++;
        }

        const windowSpans = allSpans.slice(windowStart, windowEnd + 1);

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

        if (combined.length >= targetClean.length) {
          return combined;
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

  const rect = range.getBoundingClientRect ? range.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };

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

  const isTextNode = range.startContainer?.nodeType === (typeof Node !== "undefined" ? Node.TEXT_NODE : 3);
  const startSpan = isTextNode ? range.startContainer.parentElement : range.startContainer;
  const regionInfo = classifyTextRegion(startSpan);

  // CASE 1: MULTI-WORD PHRASE OR SENTENCE (e.g. "economic growth in India", "Constitution of India")
  if (words.length > 1) {
    let phraseText = normalized;
    // Check if initial word or trailing word continuation was split across PDF textLayer spans
    try {
      if (startSpan?.closest?.(".textLayer")) {
        const textInSpan = startSpan.textContent || "";
        const startOff = typeof range.startOffset === "number" ? range.startOffset : 0;
        const leadingText = textInSpan.slice(0, startOff);
        if (!leadingText || !/\S/.test(leadingText)) {
          const prefix = getPreviousSpanWordPrefix(startSpan);
          if (prefix && !phraseText.toLowerCase().startsWith(prefix.toLowerCase())) {
            phraseText = prefix + phraseText;
          }
        }

        const endIsTextNode = range.endContainer?.nodeType === (typeof Node !== "undefined" ? Node.TEXT_NODE : 3);
        const endSpan = endIsTextNode ? range.endContainer.parentElement : range.endContainer;
        const textInEndSpan = endSpan?.textContent || "";
        const endOff = typeof range.endOffset === "number" ? range.endOffset : textInEndSpan.length;
        const trailingText = textInEndSpan.slice(endOff);
        if (!trailingText || !/\S/.test(trailingText)) {
          const suffix = getNextSpanWordSuffix(endSpan);
          if (suffix && !phraseText.toLowerCase().endsWith(suffix.toLowerCase())) {
            phraseText = phraseText + suffix;
          }
        }
      }
    } catch (e) {
      console.warn("Multi-span phrase expansion warning:", e);
    }

    const phraseWords = phraseText.split(/\s+/).filter(Boolean);
    const isSentence = /[.?!]$/.test(phraseText) || phraseWords.length >= 6;
    return {
      type: isSentence ? "sentence" : "phrase",
      text: phraseText,
      wordCount: phraseWords.length,
      rect,
      sentence: sentence || phraseText,
      region: regionInfo.region,
      fontSize: regionInfo.fontSize,
      isBold: regionInfo.isBold
    };
  }

  // CASE 2: SINGLE WORD SELECTION (e.g. "Constitution", "reforms", or "Special")
  let singleClean = cleanSingleWord(normalized);
  if (singleClean && singleClean.length >= 1 && /[A-Za-z]/.test(singleClean)) {
    // Check if initial capital letter or word continuation was split across PDF textLayer spans
    try {
      if (startSpan?.closest?.(".textLayer")) {
        const textInSpan = startSpan.textContent || "";
        const startOff = typeof range.startOffset === "number" ? range.startOffset : 0;
        const leadingText = textInSpan.slice(0, startOff);

        // If selection starts at the beginning of the span or has no preceding non-whitespace
        if (!leadingText || !/\S/.test(leadingText)) {
          const prefix = getPreviousSpanWordPrefix(startSpan);
          if (prefix) {
            singleClean = cleanSingleWord(prefix + singleClean);
          }
        }

        const endIsTextNode = range.endContainer?.nodeType === (typeof Node !== "undefined" ? Node.TEXT_NODE : 3);
        const endSpan = endIsTextNode ? range.endContainer.parentElement : range.endContainer;
        const textInEndSpan = endSpan?.textContent || "";
        const endOff = typeof range.endOffset === "number" ? range.endOffset : textInEndSpan.length;
        const trailingText = textInEndSpan.slice(endOff);

        if (!trailingText || !/\S/.test(trailingText)) {
          const suffix = getNextSpanWordSuffix(endSpan);
          if (suffix) {
            singleClean = cleanSingleWord(singleClean + suffix);
          }
        }
      }
    } catch (e) {
      console.warn("Span expansion warning:", e);
    }

    return {
      type: "word",
      text: singleClean,
      wordCount: 1,
      rect,
      sentence: sentence || "",
      region: regionInfo.region,
      fontSize: regionInfo.fontSize,
      isBold: regionInfo.isBold
    };
  }

  return null;
}

// Extract the exact word at a click or tap point in the PDF text layer
export function extractWordAtPoint(clientX, clientY, target) {
  let textNode = null;
  let offset = 0;

  if (typeof document !== "undefined") {
    if (document.caretPositionFromPoint) {
      try {
        const pos = document.caretPositionFromPoint(clientX, clientY);
        if (pos && pos.offsetNode) {
          if (pos.offsetNode.nodeType === (typeof Node !== "undefined" ? Node.TEXT_NODE : 3)) {
            textNode = pos.offsetNode;
            offset = pos.offset;
          } else if (pos.offsetNode.nodeType === (typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1)) {
            textNode = pos.offsetNode.firstChild;
            offset = 0;
          }
        }
      } catch {}
    } else if (document.caretRangeFromPoint) {
      try {
        const r = document.caretRangeFromPoint(clientX, clientY);
        if (r && r.startContainer) {
          if (r.startContainer.nodeType === (typeof Node !== "undefined" ? Node.TEXT_NODE : 3)) {
            textNode = r.startContainer;
            offset = r.startOffset;
          } else if (r.startContainer.nodeType === (typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1)) {
            textNode = r.startContainer.firstChild;
            offset = 0;
          }
        }
      } catch {}
    }
  }

  let span = (target?.tagName === "SPAN" ? target : null) ||
               target?.closest?.(".textLayer span") ||
               target?.closest?.("span") ||
               (textNode?.parentElement?.tagName === "SPAN" ? textNode.parentElement : textNode?.parentElement?.closest?.("span"));

  // Euclidean proximity fallback for small text or taps landing near glyph edges (tolerance: 18px)
  if (!span && typeof document !== "undefined" && clientX && clientY) {
    const textLayer = target?.closest?.(".textLayer") || document.querySelector(".textLayer");
    if (textLayer && typeof textLayer.querySelectorAll === "function") {
      const candidates = Array.from(textLayer.querySelectorAll("span"));
      let bestDist = Infinity;
      let bestSpan = null;
      for (const s of candidates) {
        const textContent = s.textContent || "";
        if (!textContent.trim()) continue;
        if (s.getBoundingClientRect) {
          const r = s.getBoundingClientRect();
          const dx = Math.max(0, r.left - clientX, clientX - r.right);
          const dy = Math.max(0, r.top - clientY, clientY - r.bottom);
          const dist = Math.hypot(dx, dy);
          if (dist < bestDist) {
            bestDist = dist;
            bestSpan = s;
          }
        }
      }
      if (bestSpan && bestDist <= 18) {
        span = bestSpan;
        textNode = span.firstChild || span;
        const sRect = span.getBoundingClientRect();
        const textLen = (span.textContent || "").length;
        if (textLen > 0 && sRect.width > 0) {
          const frac = Math.max(0, Math.min(1, (clientX - sRect.left) / sRect.width));
          offset = Math.min(textLen - 1, Math.floor(frac * textLen));
        }
      }
    }
  }

  if (!span) return null;

  if (!textNode || (span.contains && !span.contains(textNode))) {
    textNode = span.firstChild || span;
    offset = 0;
  }

  const text = span.textContent || "";
  if (!text || text.trim().length === 0) return null;

  if (offset >= text.length) offset = Math.max(0, text.length - 1);
  if (/\s/.test(text[offset])) {
    if (offset > 0 && !/\s/.test(text[offset - 1])) {
      offset = offset - 1;
    } else if (offset + 1 < text.length && !/\s/.test(text[offset + 1])) {
      offset = offset + 1;
    } else {
      let found = -1;
      for (let delta = 1; delta <= 3; delta++) {
        if (offset - delta >= 0 && !/\s/.test(text[offset - delta])) {
          found = offset - delta;
          break;
        }
        if (offset + delta < text.length && !/\s/.test(text[offset + delta])) {
          found = offset + delta;
          break;
        }
      }
      if (found !== -1) {
        offset = found;
      } else {
        return null;
      }
    }
  }

  let start = offset;
  let end = offset;
  while (start > 0 && /[A-Za-z0-9'’\-]/.test(text[start - 1])) {
    start--;
  }
  while (end < text.length && /[A-Za-z0-9'’\-]/.test(text[end])) {
    end++;
  }

  let localWord = text.slice(start, end);
  if (!localWord || !/[A-Za-z0-9]/.test(localWord)) return null;

  let prefix = "";
  if (start === 0) {
    prefix = getPreviousSpanWordPrefix(span);
  }

  let suffix = "";
  if (end === text.length) {
    suffix = getNextSpanWordSuffix(span);
  }

  const rawFullWord = prefix + localWord + suffix;
  const cleanWord = cleanSingleWord(rawFullWord);
  if (!cleanWord || !/[A-Za-z]/.test(cleanWord) || (cleanWord.length < 2 && !["a", "i", "A", "I"].includes(cleanWord))) {
    return null;
  }

  let rect = span.getBoundingClientRect ? span.getBoundingClientRect() : { left: 0, top: 0, width: 60, height: 20 };
  try {
    if (typeof document !== "undefined" && document.createRange && textNode && textNode.nodeType === (typeof Node !== "undefined" ? Node.TEXT_NODE : 3)) {
      const r = document.createRange();
      r.setStart(textNode, start);
      r.setEnd(textNode, end);
      const localR = r.getBoundingClientRect();
      const spanR = span.getBoundingClientRect();
      rect = {
        left: prefix ? spanR.left : localR.left,
        top: spanR.top,
        right: suffix ? spanR.right : localR.right,
        bottom: spanR.bottom,
        width: (suffix ? spanR.right : localR.right) - (prefix ? spanR.left : localR.left),
        height: spanR.height
      };
    }
  } catch {}

  const mockRange = {
    startContainer: textNode,
    startOffset: start,
    endContainer: textNode,
    endOffset: end,
    toString: () => cleanWord,
    getBoundingClientRect: () => rect
  };
  const sentence = extractSurroundingSentence(mockRange, cleanWord);
  const regionInfo = classifyTextRegion(span);

  return {
    type: "word",
    text: cleanWord,
    wordCount: 1,
    rect,
    sentence: sentence || "",
    region: regionInfo.region,
    fontSize: regionInfo.fontSize,
    isBold: regionInfo.isBold
  };
}

// Calculate clamped floating popup position near target word or phrase (or mobile bottom sheet)
export function calculatePopupPosition(wordRect, popupWidth = 320, popupHeight = 160) {
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
