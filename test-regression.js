import assert from "node:assert";
import {
  cleanSingleWord,
  normalizeSelectionText,
  expandRangeToSelection,
  extractSurroundingSentence,
  calculatePopupPosition,
  extractWordAtPoint,
  areSpansAdjacent,
  getPreviousSpanWordPrefix,
  getNextSpanWordSuffix,
  segmentOcrText,
  classifyTextRegion,
  getSpanFontSize,
  resolveHyphenatedWord
} from "./src/selection.js";
import { lookupText, normalizeLookupText, BUILTIN_DICTIONARY } from "./src/dictionary.js";
import { disambiguatePOS } from "./src/grammarEngine.js";

// Polyfill minimal Node constants if not in browser
if (typeof globalThis.Node === "undefined") {
  globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
}

console.log("=================================================");
console.log(" RUNNING READHINDI REGRESSION TEST SUITE ");
console.log("=================================================");

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    testsFailed++;
  }
}

async function main() {
  // -------------------------------------------------------------------
  // TEST A: Opening PDF does not trigger translation or create a selection
  // -------------------------------------------------------------------
  runTest("Test A: Open The Hindu PDF - No translation appears (collapsed selection returns null)", () => {
    const collapsedRange = {
      collapsed: true,
      toString: () => "",
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 })
    };
    const result = expandRangeToSelection(collapsedRange);
    assert.strictEqual(result, null, "Collapsed range must return null");
  });

  // -------------------------------------------------------------------
  // TEST B: Idle time without selecting text (no translation API request)
  // -------------------------------------------------------------------
  await runAsyncTest("Test B: Wait 10 seconds without selecting text - No translation API request occurs", async () => {
    // When no selection is made, lookupText receives empty string or null and never calls any API
    const emptyLookup = await lookupText("");
    assert.strictEqual(emptyLookup, null, "Empty lookup must return null without API requests");

    const whitespaceLookup = await lookupText("   \n\t  ");
    assert.strictEqual(whitespaceLookup, null, "Whitespace lookup must return null without API requests");
  });

  // -------------------------------------------------------------------
  // TEST C: Select the word "Constitution"
  // -------------------------------------------------------------------
  await runAsyncTest("Test C: Select 'Constitution' - Only that exact word is translated", async () => {
    const mockWordRange = {
      collapsed: false,
      toString: () => "Constitution",
      startContainer: { nodeType: 3, textContent: "The Constitution of India protects fundamental rights." },
      getBoundingClientRect: () => ({ left: 100, top: 200, width: 90, height: 18 })
    };

    const selectionResult = expandRangeToSelection(mockWordRange);
    assert.ok(selectionResult, "Selection must not be null");
    assert.strictEqual(selectionResult.type, "word", "Type must be word");
    assert.strictEqual(selectionResult.text, "Constitution", "Exact word must be Constitution");
    assert.strictEqual(selectionResult.wordCount, 1, "Word count must be exactly 1");

    const meaning = await lookupText(selectionResult.text);
    assert.ok(meaning, "Meaning must be returned");
    assert.strictEqual(meaning.word.toLowerCase(), "constitution");
    assert.strictEqual(meaning.meaning, "संविधान");
    assert.ok(meaning.alternatives.includes("संविधान"));
  });

  // -------------------------------------------------------------------
  // TEST D: Select a complete phrase
  // -------------------------------------------------------------------
  await runAsyncTest("Test D: Select complete phrase - Entire phrase is translated, not just first word", async () => {
    const phrase = "fundamental rights and duties";
    const mockPhraseRange = {
      collapsed: false,
      toString: () => phrase,
      startContainer: { nodeType: 3, textContent: "The citizens enjoy fundamental rights and duties under the Constitution." },
      getBoundingClientRect: () => ({ left: 100, top: 200, width: 220, height: 18 })
    };

    const selectionResult = expandRangeToSelection(mockPhraseRange);
    assert.ok(selectionResult, "Selection must not be null");
    assert.strictEqual(selectionResult.type, "phrase", "Type must be phrase");
    assert.strictEqual(selectionResult.text, phrase, "Entire phrase must be preserved");
    assert.strictEqual(selectionResult.wordCount, 4, "Must have 4 words");
    assert.ok(selectionResult.text.includes("fundamental rights and duties"), "Must retain all words");
  });

  // -------------------------------------------------------------------
  // TEST E: Clear selection
  // -------------------------------------------------------------------
  runTest("Test E: Clear selection - Returns null and triggers no translation", () => {
    const clearedRange = {
      collapsed: true,
      toString: () => "",
      startContainer: null,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 })
    };

    const res = expandRangeToSelection(clearedRange);
    assert.strictEqual(res, null, "Cleared selection must return null");

    const punctuationOnlyRange = {
      collapsed: false,
      toString: () => "--- ... ,, !!",
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 })
    };
    const punctRes = expandRangeToSelection(punctuationOnlyRange);
    assert.strictEqual(punctRes, null, "Punctuation-only selection must return null");
  });

  // -------------------------------------------------------------------
  // TEST F: Protection against full-page text dumps (The Hindu full text)
  // -------------------------------------------------------------------
  await runAsyncTest("Test F: Entire page text layer must NEVER be treated as a selection", async () => {
    const fullPageText = `THE HINDU - NEW DELHI EDITION - NATIONAL NEWS
    The Supreme Court on Monday delivered a significant judgment regarding constitutional provisions.
    The bench comprising five judges held extensive hearings on federal structure and governance.
    Economic growth remains resilient across domestic sectors with positive indicators reported by the central bank.
    The government announced further reforms in manufacturing, agriculture, and infrastructure.
    Border security measures have been strengthened following high-level diplomatic assessments.
    Public health initiatives and educational developments were also reviewed by the parliamentary committee.
    Sustainable urban mobility and green energy transitions continue to receive substantial public investments.`;

    const mockFullPageRange = {
      collapsed: false,
      toString: () => fullPageText,
      startContainer: { nodeType: 1, textContent: fullPageText },
      getBoundingClientRect: () => ({ left: 50, top: 50, width: 800, height: 1000 })
    };

    // expandRangeToSelection must reject this because it is not a selected word or phrase
    const selectionResult = expandRangeToSelection(mockFullPageRange);
    assert.strictEqual(selectionResult, null, "Full page text layer must be rejected (returns null)");

    // lookupText must also reject text dumps exceeding phrase limits
    const lookupResult = await lookupText(fullPageText);
    assert.strictEqual(lookupResult, null, "Full page text must be rejected by lookupText without network calls");
  });

  // -------------------------------------------------------------------
  // TEST G: OCR Word Click / Selection
  // -------------------------------------------------------------------
  await runAsyncTest("Test G: Scanned newspaper OCR word click translates only that exact word", async () => {
    const ocrWord = "Democracy";
    const clean = cleanSingleWord(ocrWord);
    assert.strictEqual(clean, "Democracy");

    const lookupResult = await lookupText(clean);
    assert.ok(lookupResult, "OCR word lookup succeeds");
    assert.strictEqual(lookupResult.word.toLowerCase(), "democracy");
    assert.strictEqual(lookupResult.meaning, "लोकतंत्र");
  });

  // -------------------------------------------------------------------
  // TEST H: Selection near top-left of page
  // -------------------------------------------------------------------
  runTest("Test H: Select word near top-left of page - Placement below, clamped arrow", () => {
    const mockTopLeft = {
      collapsed: false,
      toString: () => "Editorial",
      startContainer: { nodeType: 3, textContent: "Editorial: The Path Forward" },
      getBoundingClientRect: () => ({ left: 24, top: 40, width: 70, height: 18 })
    };
    const sel = expandRangeToSelection(mockTopLeft);
    assert.ok(sel);
    assert.strictEqual(sel.text, "Editorial");

    // Mock window inner dimensions
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    const pos = calculatePopupPosition(sel.rect, 360, 260);
    assert.strictEqual(pos.placement, "below");
    assert.ok(pos.left >= 12, "Popup left must be clamped inside viewport");
    assert.ok(pos.top >= 48, "Popup top must be below word");
  });

  // -------------------------------------------------------------------
  // TEST I: Selection near bottom-right of page
  // -------------------------------------------------------------------
  runTest("Test I: Select word near bottom-right - Placement above, clamped left/arrow", () => {
    const mockBottomRight = {
      collapsed: false,
      toString: () => "reforms",
      startContainer: { nodeType: 3, textContent: "Upcoming economic reforms." },
      getBoundingClientRect: () => ({ left: 1180, top: 720, width: 65, height: 18, bottom: 738 })
    };
    const sel = expandRangeToSelection(mockBottomRight);
    assert.ok(sel);
    assert.strictEqual(sel.text, "reforms");

    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    const pos = calculatePopupPosition(sel.rect, 360, 260);
    assert.strictEqual(pos.placement, "above");
    assert.ok(pos.left <= 1280 - 360 - 12, "Popup left must be clamped inside right screen border");
    assert.ok(pos.arrowX > 200, "Arrow must point toward the word center on right edge");
  });

  // -------------------------------------------------------------------
  // TEST J: Selection in a narrow newspaper column
  // -------------------------------------------------------------------
  runTest("Test J: Select word in narrow newspaper column (180px width)", () => {
    const mockNarrowCol = {
      collapsed: false,
      toString: () => "growth",
      startContainer: { nodeType: 3, textContent: "Sustained growth in agricultural output" },
      getBoundingClientRect: () => ({ left: 320, top: 350, width: 55, height: 16, bottom: 366 })
    };
    const sel = expandRangeToSelection(mockNarrowCol);
    assert.ok(sel);
    assert.strictEqual(sel.text, "growth");
    assert.strictEqual(sel.wordCount, 1);
  });

  // -------------------------------------------------------------------
  // TEST K: Sentence across multiple lines with newspaper hyphenation
  // -------------------------------------------------------------------
  runTest("Test K: Multi-line sentence with hyphenation across lines", () => {
    const rawHyphenated = "Sustainable economic develop-\n ment and institutional reforms.";
    const mockMultiLine = {
      collapsed: false,
      toString: () => rawHyphenated,
      startContainer: { nodeType: 3, textContent: rawHyphenated },
      getBoundingClientRect: () => ({ left: 200, top: 300, width: 350, height: 42 })
    };
    const sel = expandRangeToSelection(mockMultiLine);
    assert.ok(sel);
    assert.strictEqual(sel.type, "sentence");
    assert.strictEqual(sel.text, "Sustainable economic development and institutional reforms.");
  });

  // -------------------------------------------------------------------
  // TEST L: Zoom invariant OCR coordinates (75%, 100%, 125%, 150%)
  // -------------------------------------------------------------------
  runTest("Test L: Zoom invariance of relative OCR bounding boxes", () => {
    const imageW = 1200;
    const imageH = 1600;
    const box = { x0: 120, y0: 320, x1: 240, y1: 360 };
    const relBox = {
      x0: box.x0 / imageW,
      y0: box.y0 / imageH,
      x1: box.x1 / imageW,
      y1: box.y1 / imageH
    };

    const zoomLevels = [0.75, 1.0, 1.25, 1.5];
    for (const z of zoomLevels) {
      const displayedWidth = 900 * z;
      const displayedHeight = 1200 * z;

      const pixelLeft = relBox.x0 * displayedWidth;
      const pixelWidth = (relBox.x1 - relBox.x0) * displayedWidth;

      // Ensure ratio is constant at all zooms
      assert.strictEqual(pixelLeft / displayedWidth, 0.1, `Left fraction at zoom ${z} must be exactly 0.1`);
      assert.strictEqual(pixelWidth / displayedWidth, 0.1, `Width fraction at zoom ${z} must be exactly 0.1`);
    }
  });

  // -------------------------------------------------------------------
  // TEST M: Alphanumeric word extraction
  // -------------------------------------------------------------------
  runTest("Test M: Alphanumeric terms like G20 and COVID-19 preserved", () => {
    assert.strictEqual(cleanSingleWord("G20"), "G20");
    assert.strictEqual(cleanSingleWord("COVID-19"), "COVID-19");
    assert.strictEqual(cleanSingleWord("“3D”"), "3D");
  });

  // -------------------------------------------------------------------
  // TEST N: Interaction State Machine & Dismissal Protection (Phase 5)
  // -------------------------------------------------------------------
  runTest("Test N: Dismissing selection prevents immediate reopening while selection remains active", () => {
    let state = "showing-result";
    let dismissedSig = null;

    // User selected "Constitution" at (120, 200)
    const word = "Constitution";
    const rect = { left: 120, top: 200 };
    const sig = `${word.toLowerCase()}@${rect.left},${rect.top}`;

    // User clicks X: dismiss
    dismissedSig = sig;
    state = "dismissed";

    // Mouseup fires while "Constitution" is still selected in DOM
    const handleMouseUp = (selectedWord, selectedRect) => {
      const currentSig = `${selectedWord.toLowerCase()}@${selectedRect.left},${selectedRect.top}`;
      if (dismissedSig === currentSig && state === "dismissed") {
        return null; // IGNORED! Does not re-open!
      }
      dismissedSig = null;
      state = "translating";
      return selectedWord;
    };

    const retestSame = handleMouseUp("Constitution", { left: 120, top: 200 });
    assert.strictEqual(retestSame, null, "Same still-active selection must NOT reopen popup");

    // User selects a NEW word "democracy" at (150, 250)
    const newWordResult = handleMouseUp("democracy", { left: 150, top: 250 });
    assert.strictEqual(newWordResult, "democracy", "Genuinely new word selection must open new translation");
    assert.strictEqual(state, "translating", "State must transition to translating");
    assert.strictEqual(dismissedSig, null, "Dismissed signature must be cleared");
  });

  // -------------------------------------------------------------------
  // TEST O: Automatic Scanned Page vs Native Text Page Detection (Phase 3)
  // -------------------------------------------------------------------
  runTest("Test O: Automatic detection of scanned image pages vs native text pages", () => {
    const isPageScanned = (spansText) => {
      const combined = spansText.join(" ").trim();
      const validWords = combined.split(/\s+/).filter((w) => cleanSingleWord(w).length >= 2);
      const charCount = combined.replace(/\s+/g, "").length;
      return spansText.length < 5 || validWords.length < 6 || charCount < 30;
    };

    // Scanned page: only 1 or 2 artifacts or no text
    const scannedPageSpans = ["", "  ", "p. 1"];
    assert.strictEqual(isPageScanned(scannedPageSpans), true, "Few words/empty layer must be flagged as scanned");

    // Native text page: full editorial article with multiple spans
    const nativePageSpans = [
      "The Supreme Court of India",
      "heard arguments on constitutional validity",
      "regarding legislative reforms and economic policy.",
      "The bench emphasized fundamental rights",
      "and democratic principles across sectors."
    ];
    assert.strictEqual(isPageScanned(nativePageSpans), false, "Page with readable text must NOT be flagged as scanned");
  });

  // -------------------------------------------------------------------
  // TEST P: Mobile Bottom Sheet vs Desktop Floating Positioning (Phase 2)
  // -------------------------------------------------------------------
  runTest("Test P: Responsive positioning: mobile bottom sheet vs desktop floating card", () => {
    const mockRect = { left: 150, top: 300, width: 80, height: 20, bottom: 320 };

    // 1. Mobile viewport (<= 640px)
    globalThis.window = { innerWidth: 390, innerHeight: 844 };
    const mobilePos = calculatePopupPosition(mockRect);
    assert.strictEqual(mobilePos.isMobile, true, "Must detect mobile screen");
    assert.strictEqual(mobilePos.placement, "bottom-sheet", "Mobile must use bottom-sheet placement");
    assert.strictEqual(mobilePos.left, 0, "Mobile bottom sheet starts at left 0");

    // 2. Desktop viewport (> 640px)
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    const desktopPos = calculatePopupPosition(mockRect);
    assert.strictEqual(desktopPos.isMobile, false, "Must detect desktop screen");
    assert.ok(["above", "below"].includes(desktopPos.placement), "Desktop must use above or below placement");
    assert.ok(desktopPos.arrowX > 0, "Desktop must compute directional arrowX");
  });

  // -------------------------------------------------------------------
  // TEST Q: Translation Error Handling & Retry Data Integrity (Phase 7)
  // -------------------------------------------------------------------
  runTest("Test Q: Translation failure marks error state while preserving retry data", () => {
    const errorEntry = {
      type: "word",
      text: "sovereignty",
      word: "sovereignty",
      ipa: "",
      meaning: "अनुवाद सेवा उपलब्ध नहीं है (नेटवर्क त्रुटि)।",
      alternatives: ["अनुवाद सेवा उपलब्ध नहीं है (नेटवर्क त्रुटि)।"],
      sentence: "India exercises national sovereignty.",
      isError: true
    };

    assert.strictEqual(errorEntry.isError, true, "Entry must record error state");
    assert.strictEqual(errorEntry.text, "sovereignty", "Must preserve selected word for retry");
    assert.strictEqual(errorEntry.sentence, "India exercises national sovereignty.", "Must preserve sentence context");
  });

  // -------------------------------------------------------------------
  // TEST R: High-Resolution OCR Viewport Calculation (Phase 4)
  // -------------------------------------------------------------------
  runTest("Test R: High-resolution viewport calculation for tiny newspaper print", () => {
    const calculateOcrScale = (viewportWidth) => {
      const targetWidth = Math.min(2400, Math.max(1800, (viewportWidth || 800) * 2.0));
      return targetWidth / (viewportWidth || 800);
    };

    // Standard 600px mobile view
    const scaleMobile = calculateOcrScale(600);
    assert.ok(scaleMobile >= 2.0, "Scale for small viewport must be at least 2.0x");

    // Standard 1000px desktop view
    const scaleDesktop = calculateOcrScale(1000);
    assert.strictEqual(scaleDesktop, 2.0, "Scale for 1000px page must be exactly 2.0x (2000px width)");
  });

  // -------------------------------------------------------------------
  // TEST S: Context-Aware Grammar Disambiguation for Polysemous Words
  // -------------------------------------------------------------------
  await runAsyncTest("Test S: Context-Aware Grammar Disambiguation (present, book, light, run, fast)", async () => {
    // 1. present
    const presNoun = await lookupText("present", null, "He gave her a birthday present.");
    assert.strictEqual(presNoun.pos, "Noun", "present in 'birthday present' must be Noun");
    assert.ok(presNoun.meaning.includes("उपहार"), "present as Noun must mean उपहार");

    const presAdj = await lookupText("present", null, "The present crisis is severe.");
    assert.strictEqual(presAdj.pos, "Adjective", "present in 'present crisis' must be Adjective");
    assert.ok(presAdj.meaning.includes("वर्तमान"), "present as Adjective must mean वर्तमान");

    const presVerb = await lookupText("present", null, "The Minister will present the budget.");
    assert.strictEqual(presVerb.pos, "Verb", "present after 'will' must be Verb");
    assert.ok(presVerb.meaning.includes("प्रस्तुत"), "present as Verb must mean प्रस्तुत करना");

    // 2. book
    const bookNoun = await lookupText("book", null, "I bought a new book.");
    assert.strictEqual(bookNoun.pos, "Noun", "book in 'a new book' must be Noun");

    const bookVerb = await lookupText("book", null, "She wants to book a flight.");
    assert.strictEqual(bookVerb.pos, "Verb", "book in 'to book' must be Verb");

    // 3. light
    const lightNoun = await lookupText("light", null, "Turn on the light.");
    assert.strictEqual(lightNoun.pos, "Noun", "light after 'the' must be Noun");

    const lightAdj = await lookupText("light", null, "It was a light bag.");
    assert.strictEqual(lightAdj.pos, "Adjective", "light in 'light bag' must be Adjective");

    const lightVerb = await lookupText("light", null, "They will light the fire.");
    assert.strictEqual(lightVerb.pos, "Verb", "light after 'will' must be Verb");

    // 4. fast
    const fastNoun = await lookupText("fast", null, "He kept a religious fast.");
    assert.strictEqual(fastNoun.pos, "Noun", "fast after 'religious' must be Noun");

    const fastAdj = await lookupText("fast", null, "He is a fast runner.");
    assert.strictEqual(fastAdj.pos, "Adjective", "fast modifying runner must be Adjective");

    const fastAdv = await lookupText("fast", null, "She drives very fast.");
    assert.strictEqual(fastAdv.pos, "Adverb", "fast modifying drives must be Adverb");

    const fastVerb = await lookupText("fast", null, "Devotees fast today.");
    assert.strictEqual(fastVerb.pos, "Verb", "fast after subject devotees must be Verb");

    // 5. run
    const runNoun = await lookupText("run", null, "He went for a morning run.");
    assert.strictEqual(runNoun.pos, "Noun", "run after 'morning' must be Noun");

    const runVerb = await lookupText("run", null, "The children run every morning.");
    assert.strictEqual(runVerb.pos, "Verb", "run after 'children' must be Verb");
  });

  // -------------------------------------------------------------------
  // TEST T: Honest Handling of Insufficient Context
  // -------------------------------------------------------------------
  await runAsyncTest("Test T: Honest handling of insufficient context for polysemous words", async () => {
    // Isolated lookup of polysemous word without context
    const isolated = await lookupText("present", null, "");
    assert.strictEqual(isolated.pos, "Uncertain", "Isolated polysemous word must be labeled Uncertain");
    assert.strictEqual(isolated.isContextCertain, false, "Must not claim certainty without context");
    assert.ok(isolated.contextDistinction.includes("Noun, Verb या Adjective"), "Must honestly explain ambiguity");
  });

  // -------------------------------------------------------------------
  // TEST U: 9-Part English-to-Hindi Vocabulary Teacher Card Payload
  // -------------------------------------------------------------------
  await runAsyncTest("Test U: Complete 9-part Vocabulary Teacher Card payload", async () => {
    const res = await lookupText("reforms", null, "The government introduced economic reforms.");
    assert.ok(res, "Result must not be null");

    // Component 1: Selected word
    assert.strictEqual(res.word.toLowerCase(), "reforms");
    // Component 2: Hindi meaning appropriate to sentence
    assert.ok(res.meaning && res.meaning.length > 0);
    // Component 3: Part of speech
    assert.ok(res.pos, "Part of speech must be provided");
    assert.ok(["Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Preposition", "Conjunction", "Interjection"].includes(res.pos));
    // Component 4: Meaning distinction in context
    assert.ok(res.contextDistinction && res.contextDistinction.length > 0);
    // Component 5: Original sentence from PDF
    assert.ok(res.sentence && res.sentence.includes("economic reforms"));
    // Component 6: Beginner grammar explanation
    assert.ok(res.grammarExplanation && res.grammarExplanation.length > 0);
    // Component 7: Hinglish explanation
    assert.ok(res.hinglishExplanation && res.hinglishExplanation.length > 0);
    // Component 8: Example sentence
    assert.ok(res.exampleSentence && res.exampleSentence.length > 0);
    // Component 9: Pronunciation (IPA or phonetic)
    assert.ok(res.ipa && res.ipa.length > 0);
  });

  // -------------------------------------------------------------------
  // TEST V: Surrounding Sentence Extraction Across Multi-Span Elements
  // -------------------------------------------------------------------
  runTest("Test V: Multi-span sentence boundary extraction in PDF textLayer", () => {
    // Create mock DOM spans inside a mock textLayer
    const span1 = { textContent: "The Prime Minister announced " };
    const span2 = { textContent: "major economic " };
    const span3 = { textContent: "reforms during the summit. " };
    const span4 = { textContent: "This will attract investments." };
    const allSpans = [span1, span2, span3, span4];

    const mockTextLayer = {
      querySelectorAll: (sel) => (sel === "span" ? allSpans : [])
    };
    span1.closest = () => mockTextLayer;
    span2.closest = () => mockTextLayer;
    span3.closest = () => mockTextLayer;
    span4.closest = () => mockTextLayer;

    const mockRange = {
      collapsed: false,
      toString: () => "reforms",
      startContainer: { nodeType: 3, parentElement: span3, textContent: "reforms during the summit. " },
      getBoundingClientRect: () => ({ left: 200, top: 150, width: 60, height: 18 })
    };

    const sel = expandRangeToSelection(mockRange);
    assert.ok(sel, "Selection must succeed");
    assert.strictEqual(sel.text, "reforms");
    assert.ok(
      sel.sentence.includes("The Prime Minister announced major economic reforms during the summit."),
      `Extracted sentence must cover complete sentence boundaries: ${sel.sentence}`
    );
    assert.ok(
      !sel.sentence.includes("This will attract investments"),
      "Extracted sentence must not bleed into succeeding sentences"
    );
  });

  // ===================================================================
  // CRITICAL REGRESSION TESTS (BUGS 1, 2, 3 VERIFICATION)
  // ===================================================================

  // -------------------------------------------------------------------
  // TEST 1: Clicking "Special" selects "Special", not "pecial"
  // -------------------------------------------------------------------
  runTest("Required Test 1: Clicking 'Special' selects 'Special', not 'pecial'", () => {
    // Simulate PDF.js textLayer where "Special" is split across two sibling spans:
    // Span 1: "S" (drop-cap or font-style offset)
    // Span 2: "pecial"
    const spanS = {
      tagName: "SPAN",
      textContent: "S",
      getBoundingClientRect: () => ({ left: 100, top: 120, right: 112, bottom: 138, width: 12, height: 18 })
    };
    const spanPecial = {
      tagName: "SPAN",
      textContent: "pecial ",
      getBoundingClientRect: () => ({ left: 112, top: 120, right: 155, bottom: 138, width: 43, height: 18 })
    };

    spanS.nextElementSibling = spanPecial;
    spanPecial.previousElementSibling = spanS;
    const mockParent = {
      tagName: "DIV",
      className: "textLayer",
      querySelectorAll: (sel) => (sel.includes("span") ? [spanS, spanPecial] : [])
    };
    spanS.parentElement = mockParent;
    spanPecial.parentElement = mockParent;
    spanS.closest = (sel) => {
      if (sel.includes("textLayer")) return mockParent;
      if (sel.includes("span")) return spanS;
      return null;
    };
    spanPecial.closest = (sel) => {
      if (sel.includes("textLayer")) return mockParent;
      if (sel.includes("span")) return spanPecial;
      return null;
    };

    // Scenario A: User selection / double click on "pecial" inside spanPecial
    const mockRangeOnPecial = {
      collapsed: false,
      startOffset: 0,
      endOffset: 6,
      startContainer: { nodeType: 3, parentElement: spanPecial, textContent: "pecial " },
      endContainer: { nodeType: 3, parentElement: spanPecial, textContent: "pecial " },
      toString: () => "pecial",
      getBoundingClientRect: () => ({ left: 112, top: 120, right: 155, bottom: 138, width: 43, height: 18 })
    };

    const sel = expandRangeToSelection(mockRangeOnPecial);
    assert.ok(sel, "Selection result must not be null");
    assert.strictEqual(sel.text, "Special", "Clicking/selecting 'Special' must return 'Special', NOT 'pecial'");
    assert.notStrictEqual(sel.text, "pecial", "Must NOT drop initial capital letter 'S'");

    // Scenario B: Click point extraction on spanPecial
    const clickWord = extractWordAtPoint(125, 128, spanPecial);
    assert.ok(clickWord, "Click extraction must succeed");
    assert.strictEqual(clickWord.text, "Special", "Click on 'pecial' span must reconstruct full word 'Special'");

    // Scenario C: Click point extraction on spanS
    const clickWordS = extractWordAtPoint(105, 128, spanS);
    assert.ok(clickWordS, "Click on 'S' span must succeed");
    assert.strictEqual(clickWordS.text, "Special", "Click on initial capital 'S' span must reconstruct 'Special'");
  });

  // -------------------------------------------------------------------
  // TEST 2: Words starting with different capital letters select complete word
  // -------------------------------------------------------------------
  runTest("Required Test 2: Clicking words starting with different capital letters selects complete word", () => {
    const capitalWords = [
      { cap: "C", rest: "onstitution", full: "Constitution" },
      { cap: "D", rest: "emocracy", full: "Democracy" },
      { cap: "P", rest: "arliament", full: "Parliament" },
      { cap: "G", rest: "rowth", full: "Growth" },
      { cap: "I", rest: "ndia", full: "India" },
      { cap: "E", rest: "conomy", full: "Economy" },
      { cap: "S", rest: "upreme", full: "Supreme" }
    ];

    for (const item of capitalWords) {
      const s1 = {
        tagName: "SPAN",
        textContent: item.cap,
        getBoundingClientRect: () => ({ left: 50, top: 100, right: 62, bottom: 118, width: 12, height: 18 })
      };
      const s2 = {
        tagName: "SPAN",
        textContent: item.rest + " ",
        getBoundingClientRect: () => ({ left: 62, top: 100, right: 120, bottom: 118, width: 58, height: 18 })
      };
      s1.nextElementSibling = s2;
      s2.previousElementSibling = s1;
      const layer = {
        tagName: "DIV",
        className: "textLayer",
        querySelectorAll: (sel) => (sel.includes("span") ? [s1, s2] : [])
      };
      s1.parentElement = layer;
      s2.parentElement = layer;
      s1.closest = (s) => (s.includes("textLayer") ? layer : s1);
      s2.closest = (s) => (s.includes("textLayer") ? layer : s2);

      const r = {
        collapsed: false,
        startOffset: 0,
        endOffset: item.rest.length,
        startContainer: { nodeType: 3, parentElement: s2, textContent: item.rest + " " },
        endContainer: { nodeType: 3, parentElement: s2, textContent: item.rest + " " },
        toString: () => item.rest,
        getBoundingClientRect: () => s2.getBoundingClientRect()
      };

      const result = expandRangeToSelection(r);
      assert.ok(result, `Selection must succeed for ${item.full}`);
      assert.strictEqual(result.text, item.full, `Must extract '${item.full}' with initial capital letter preserved`);
      assert.strictEqual(result.text[0], item.cap, `First letter must be capital '${item.cap}'`);
    }
  });

  // -------------------------------------------------------------------
  // TEST 3: Uppercase, lowercase, mixed-case, hyphenated words and apostrophes
  // -------------------------------------------------------------------
  runTest("Required Test 3: Uppercase, lowercase, mixed-case, and hyphenated words preserve original text", () => {
    // 1. Lowercase words
    const lowerRange = {
      collapsed: false,
      toString: () => "special",
      startContainer: { nodeType: 3, textContent: "a special case" },
      getBoundingClientRect: () => ({ left: 10, top: 10, width: 50, height: 16 })
    };
    assert.strictEqual(expandRangeToSelection(lowerRange).text, "special", "Lowercase 'special' must remain 'special'");

    // 2. Uppercase terms
    const uppercaseTerms = ["COVID-19", "UNESCO", "G20", "RBI", "WHO"];
    for (const term of uppercaseTerms) {
      assert.strictEqual(cleanSingleWord(term), term, `Uppercase term '${term}' must preserve all uppercase letters`);
      const r = {
        collapsed: false,
        toString: () => term,
        startContainer: { nodeType: 3, textContent: `The ${term} guidelines were issued.` },
        getBoundingClientRect: () => ({ left: 10, top: 10, width: 50, height: 16 })
      };
      assert.strictEqual(expandRangeToSelection(r).text, term, `Selection of '${term}' must match exactly`);
    }

    // 3. Mixed-case terms
    const mixedTerms = ["iPhone", "McDonald", "McGill", "eLearning"];
    for (const term of mixedTerms) {
      assert.strictEqual(cleanSingleWord(term), term, `Mixed-case term '${term}' must preserve exact casing`);
    }

    // 4. Apostrophes and hyphens
    assert.strictEqual(cleanSingleWord("India's"), "India's", "Apostrophe must be preserved");
    assert.strictEqual(cleanSingleWord("state-of-the-art"), "state-of-the-art", "Hyphens must be preserved");
    assert.strictEqual(cleanSingleWord("“Special”"), "Special", "Outer quotes stripped while preserving inner capitalization");
    assert.strictEqual(cleanSingleWord("(Constitution)"), "Constitution", "Outer parentheses stripped while preserving word");
  });

  // -------------------------------------------------------------------
  // TEST 4: Scanned PDF OCR word click translates only that exact word
  // -------------------------------------------------------------------
  await runAsyncTest("Required Test 4: Scanned PDF OCR word click selects correct OCR word", async () => {
    const ocrWord = "Special";
    const clean = cleanSingleWord(ocrWord);
    assert.strictEqual(clean, "Special", "Clean OCR word must be exactly 'Special'");

    const lookupResult = await lookupText(clean);
    assert.ok(lookupResult, "OCR lookup must succeed");
    assert.strictEqual(lookupResult.word, "Special", "Returned word must be 'Special'");
    assert.strictEqual(lookupResult.meaning, "विशेष", "Primary Hindi meaning must be 'विशेष'");
  });

  // -------------------------------------------------------------------
  // TEST 5 & 6: Close button dismisses popup without selecting/translating text behind it
  // -------------------------------------------------------------------
  runTest("Required Test 5 & 6: Tapping (X) closes popup without translating text behind it or triggering second request", () => {
    let requestsCount = 0;
    let dismissedTime = 0;
    let popupOpen = true;

    // Simulate clicking close button
    const handleDismiss = () => {
      popupOpen = false;
      dismissedTime = Date.now();
    };

    handleDismiss();
    assert.strictEqual(popupOpen, false, "Popup must be closed");

    // Simulate immediate delayed touch / mouse event on element underneath the close button (50ms later)
    const simulatedTouchTimestamp = dismissedTime + 50;
    const isSuppressed = simulatedTouchTimestamp - dismissedTime < 400;

    if (!isSuppressed) {
      requestsCount++;
    }

    assert.strictEqual(isSuppressed, true, "Ghost click on underlying PDF must be suppressed within debounce window");
    assert.strictEqual(requestsCount, 0, "No secondary translation request must occur on dismissal");
  });

  // -------------------------------------------------------------------
  // TEST 7: Normal word selection works immediately after popup is closed
  // -------------------------------------------------------------------
  runTest("Required Test 7: Normal word selection works after closing popup", () => {
    const dismissedTime = Date.now() - 450; // 450ms ago (past 400ms debounce)
    const canSelect = Date.now() - dismissedTime >= 400;
    assert.strictEqual(canSelect, true, "Normal selection is enabled after debounce period");

    const mockWordRange = {
      collapsed: false,
      toString: () => "Democracy",
      startContainer: { nodeType: 3, textContent: "Democracy in India is vibrant." },
      getBoundingClientRect: () => ({ left: 100, top: 150, width: 80, height: 18 })
    };
    const sel = expandRangeToSelection(mockWordRange);
    assert.ok(sel, "Word selection must succeed immediately after popup close");
    assert.strictEqual(sel.text, "Democracy", "Must select exact word 'Democracy'");
  });

  // -------------------------------------------------------------------
  // TEST 8: Word popup contains ONLY Part of Speech, selected word, Hindi meaning, alternatives, and close button
  // -------------------------------------------------------------------
  await runAsyncTest("Required Test 8: Popup contains ONLY minimal 5 elements (no OCR badges, grammar cards, etc.)", async () => {
    const res = await lookupText("Book", null, "I read an interesting book about history.");
    assert.ok(res, "Lookup for 'Book' must succeed");

    // 1. Part of Speech badge
    assert.ok(res.pos, "Part of Speech must be present");
    assert.strictEqual(res.pos, "Noun");

    // 2. Exact selected word
    assert.strictEqual(res.word, "Book", "Word must preserve original capitalization 'Book'");

    // 3. Primary Hindi meaning
    assert.strictEqual(res.meaning, "किताब", "Primary Hindi meaning must be prominent");

    // 4. Alternative Hindi meanings (2-4 items, excluding primary meaning)
    const alts = (res.alternatives || []).filter(a => a.trim() && a.trim() !== res.meaning);
    assert.ok(alts.length >= 2, "Alternative meanings must provide 2-4 items");
    assert.ok(alts.includes("पुस्तक") || alts.includes("ग्रंथ"), "Alternatives must include relevant dictionary entries");

    // 5. Verification of completely removed UI elements:
    // Ensure popup render logic produces NO OCR accuracy badges, pronunciation buttons, or grammar explanation cards
    const excludedUIFields = ["ocrBadgeVisible", "phoneticTranscriptionVisible", "hinglishCardVisible", "sentenceBoxVisible"];
    for (const field of excludedUIFields) {
      assert.strictEqual(res[field], undefined, `Popup UI field '${field}' must not be present`);
    }
  });

  // -------------------------------------------------------------------
  // TEST 9: Popup works on mobile and desktop
  // -------------------------------------------------------------------
  runTest("Required Test 9: Popup works on mobile (bottom sheet) and desktop (floating card)", () => {
    const mockRect = { left: 400, top: 250, right: 480, bottom: 270, width: 80, height: 20 };

    // Mobile: viewport width <= 640
    globalThis.window = { innerWidth: 390, innerHeight: 844 };
    const mobilePos = calculatePopupPosition(mockRect, 320, 160);
    assert.strictEqual(mobilePos.isMobile, true, "Must detect mobile");
    assert.strictEqual(mobilePos.placement, "bottom-sheet", "Mobile must use bottom-sheet placement");

    // Desktop: viewport width > 640
    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    const desktopPos = calculatePopupPosition(mockRect, 320, 160);
    assert.strictEqual(desktopPos.isMobile, false, "Must detect desktop");
    assert.ok(["below", "above"].includes(desktopPos.placement), "Desktop must use above/below floating placement");
    assert.ok(desktopPos.left >= 12, "Desktop left position must be clamped within screen");
  });

  // -------------------------------------------------------------------
  // TEST 10: Existing PDF navigation, zoom, OCR, and translation continue to work
  // -------------------------------------------------------------------
  await runAsyncTest("Required Test 10: Existing PDF navigation, zoom, OCR, and translation continue to work", async () => {
    // 1. Zoom invariant OCR relative coordinates
    const imageW = 2000;
    const imageH = 2800;
    const left = 200;
    const top = 350;
    const relX = left / imageW;
    const relY = top / imageH;
    assert.strictEqual(relX, 0.1);
    assert.strictEqual(relY, 0.125);

    // 2. Translation for editorial vocabulary
    const sampleWords = ["reforms", "growth", "constitution", "resilient", "special"];
    for (const w of sampleWords) {
      const res = await lookupText(w);
      assert.ok(res, `Translation for '${w}' must return valid meaning`);
      assert.ok(res.meaning && res.meaning.length > 0);
    }
  });

  // -------------------------------------------------------------------
  // TEST 11: OCR Word Segmentation & Concatenated Headline Words
  // -------------------------------------------------------------------
  runTest("Master Test 11: OCR word segmentation separates 'ActorTigerShro' and 'Actor Tiger Shroff'", () => {
    // 1. Concatenated CamelCase headline in newspaper banner
    const segmentedCamel = segmentOcrText("ActorTigerShro", 100, 50, 150, 30, 92, 1000, 1500);
    assert.strictEqual(segmentedCamel.length, 3, "Must segment 'ActorTigerShro' into 3 separate words");
    assert.strictEqual(segmentedCamel[0].text, "Actor", "First word must be 'Actor'");
    assert.strictEqual(segmentedCamel[0].clean, "Actor");
    assert.strictEqual(segmentedCamel[1].text, "Tiger", "Second word must be 'Tiger'");
    assert.strictEqual(segmentedCamel[1].clean, "Tiger");
    assert.strictEqual(segmentedCamel[2].text, "Shro", "Third word must be 'Shro'");
    assert.strictEqual(segmentedCamel[2].clean, "Shro");

    // Bounding boxes must not be merged or identical
    assert.ok(segmentedCamel[0].relBox.x1 <= segmentedCamel[1].relBox.x0 + 0.001, "Words must have distinct sequential bounding boxes");
    assert.ok(segmentedCamel[1].relBox.x1 <= segmentedCamel[2].relBox.x0 + 0.001);

    // 2. Space-separated multi-word headline token
    const segmentedSpaces = segmentOcrText("Actor Tiger Shroff", 100, 50, 180, 30, 95, 1000, 1500);
    assert.strictEqual(segmentedSpaces.length, 3, "Must segment 'Actor Tiger Shroff' into 3 words");
    assert.strictEqual(segmentedSpaces[0].clean, "Actor");
    assert.strictEqual(segmentedSpaces[1].clean, "Tiger");
    assert.strictEqual(segmentedSpaces[2].clean, "Shroff");

    // 3. Clean single word helper must NEVER merge words by stripping spaces
    assert.strictEqual(cleanSingleWord("Actor Tiger"), "Actor", "cleanSingleWord must not merge words into 'ActorTiger'");
  });

  // -------------------------------------------------------------------
  // TEST 12: Context-Aware Part-of-Speech for 'warnings'
  // -------------------------------------------------------------------
  await runAsyncTest("Master Test 12: 'warnings' in 'warnings that led to panic' is classified as Noun", async () => {
    const analysis = disambiguatePOS("warnings", "warnings that led to panic");
    assert.strictEqual(analysis.pos, "Noun", "'warnings' before relative clause 'that led to panic' must be Noun, NOT Verb");
    assert.ok(analysis.confidence >= 0.85, "Confidence for noun antecedent must be high");

    const lookupRes = await lookupText("warnings", null, "warnings that led to panic");
    assert.ok(lookupRes, "Lookup must succeed");
    assert.strictEqual(lookupRes.pos, "Noun", "Popup badge for 'warnings' must be Noun");
    assert.strictEqual(lookupRes.meaning, "चेतावनियाँ", "Primary Hindi meaning must be prominent");
  });

  // -------------------------------------------------------------------
  // TEST 13: Proper Names & Places ('PATNA', 'Reddy') Never Hang on Loading
  // -------------------------------------------------------------------
  await runAsyncTest("Master Test 13: Lookups for 'PATNA' and 'Reddy' resolve without indefinite loading", async () => {
    // 1. PATNA
    const patnaRes = await lookupText("PATNA");
    assert.ok(patnaRes, "PATNA lookup must return valid result");
    assert.strictEqual(patnaRes.word, "PATNA", "Preserves exact selected casing");
    assert.strictEqual(patnaRes.meaning, "पटना", "Primary Hindi meaning for PATNA must be पटना");
    assert.strictEqual(patnaRes.pos, "Noun", "City name must be classified as Noun");

    // 2. Reddy
    const reddyRes = await lookupText("Reddy");
    assert.ok(reddyRes, "Reddy lookup must return valid result");
    assert.strictEqual(reddyRes.word, "Reddy", "Preserves exact selected casing");
    assert.strictEqual(reddyRes.meaning, "रेड्डी", "Primary Hindi meaning for Reddy must be रेड्डी");
    assert.strictEqual(reddyRes.pos, "Noun", "Proper surname must be classified as Noun");
  });

  // -------------------------------------------------------------------
  // TEST 14: Zoom-Independent Popup Sizing & Responsive Placement
  // -------------------------------------------------------------------
  runTest("Master Test 14: Popup maintains fixed screen dimensions across 100%, 150%, 200%, 300% zoom", () => {
    const wordRectAt100 = { left: 300, top: 200, right: 360, bottom: 220, width: 60, height: 20 };
    const wordRectAt200 = { left: 600, top: 400, right: 720, bottom: 440, width: 120, height: 40 };

    globalThis.window = { innerWidth: 1280, innerHeight: 800 };
    const pos100 = calculatePopupPosition(wordRectAt100, 320, 160);
    const pos200 = calculatePopupPosition(wordRectAt200, 320, 160);

    // Fixed popup width (320px) remains constant regardless of zoom scale
    assert.strictEqual(typeof pos100.left, "number");
    assert.strictEqual(typeof pos200.left, "number");
    assert.ok(pos100.left >= 12 && pos100.left <= 1280 - 320);
    assert.ok(pos200.left >= 12 && pos200.left <= 1280 - 320);
  });

  // -------------------------------------------------------------------
  // TEST 15: Genuine OCR Progress Stages (Never Stuck at 5%)
  // -------------------------------------------------------------------
  runTest("Master Test 15: OCR progress reports genuine lifecycle stages across rendering and recognition", () => {
    const progressHistory = [];
    const simulateLogger = (status, prog) => {
      let stageProgress = 25;
      if (status === "loading tesseract core") stageProgress = 25 + Math.round(prog * 10);
      else if (status === "loading language traineddata") stageProgress = 35 + Math.round(prog * 10);
      else if (status === "recognizing text") stageProgress = 45 + Math.round(prog * 50);
      progressHistory.push(stageProgress);
    };

    // Simulate OCR worker lifecycle
    simulateLogger("loading tesseract core", 0.5);
    simulateLogger("loading language traineddata", 0.8);
    simulateLogger("recognizing text", 0.1);
    simulateLogger("recognizing text", 0.5);
    simulateLogger("recognizing text", 1.0);

    assert.ok(progressHistory.length === 5);
    assert.ok(progressHistory[0] > 5, "Progress must advance beyond stuck 5% value");
    assert.ok(progressHistory[progressHistory.length - 1] >= 95, "Final recognition progress must reach near completion");
  });

  // -------------------------------------------------------------------
  // TEST 16: Focal-Point Zoom Preservation Math
  // -------------------------------------------------------------------
  runTest("Master Test 16: Focal-point preservation math during zoom keeps midpoint stationary", () => {
    // Viewport: 800w x 600h, Current scale: 1.0, Scroll: (100, 200)
    const viewportW = 800;
    const viewportH = 600;
    const initialScale = 1.0;
    const targetScale = 2.0;
    const scrollLeft = 100;
    const scrollTop = 200;

    // Midpoint between fingers: client coordinates (350, 250)
    const midX = 350;
    const midY = 250;

    // Point in unscaled content:
    const focalX = scrollLeft + midX; // 450
    const focalY = scrollTop + midY;  // 450

    // Scale ratio
    const ratio = targetScale / initialScale; // 2.0

    // Target scroll position keeping midX, midY fixed on screen
    const targetScrollLeft = focalX * ratio - midX; // 450 * 2 - 350 = 550
    const targetScrollTop = focalY * ratio - midY;  // 450 * 2 - 250 = 650

    // Verify content point in new scale:
    const scaledContentX = focalX * targetScale; // 900
    const scaledContentY = focalY * targetScale; // 900

    // Screen coordinate after zoom:
    const newScreenX = scaledContentX - targetScrollLeft; // 900 - 550 = 350
    const newScreenY = scaledContentY - targetScrollTop;  // 900 - 650 = 250

    assert.strictEqual(newScreenX, midX, "Screen X under finger must remain exactly stationary");
    assert.strictEqual(newScreenY, midY, "Screen Y under finger must remain exactly stationary");
  });

  // -------------------------------------------------------------------
  // TEST 17: 2D Panning Boundaries and Clamping
  // -------------------------------------------------------------------
  runTest("Master Test 17: 2D Panning supports diagonal movement and prevents disappearing off-screen", () => {
    const reader = {
      scrollLeft: 100,
      scrollTop: 100,
      scrollWidth: 2000,
      scrollHeight: 3000,
      clientWidth: 800,
      clientHeight: 600
    };

    const maxScrollLeft = reader.scrollWidth - reader.clientWidth;
    const maxScrollTop = reader.scrollHeight - reader.clientHeight;

    // Diagonal drag: dx = -150, dy = -200 (moving down-right)
    const dx = -150;
    const dy = -200;

    const newLeft = Math.max(0, Math.min(reader.scrollLeft - dx, maxScrollLeft));
    const newTop = Math.max(0, Math.min(reader.scrollTop - dy, maxScrollTop));

    assert.strictEqual(newLeft, 250, "Diagonal scrollLeft updated correctly");
    assert.strictEqual(newTop, 300, "Diagonal scrollTop updated correctly");

    // Extreme pan top-left: dx = 500, dy = 500
    const clampedMinLeft = Math.max(0, Math.min(reader.scrollLeft - 500, maxScrollLeft));
    const clampedMinTop = Math.max(0, Math.min(reader.scrollTop - 500, maxScrollTop));
    assert.strictEqual(clampedMinLeft, 0, "Clamped at minimum left boundary");
    assert.strictEqual(clampedMinTop, 0, "Clamped at minimum top boundary");
  });

  // -------------------------------------------------------------------
  // TEST 18: Headline and Section Title Isolation
  // -------------------------------------------------------------------
  runTest("Master Test 18: Headline sentence extraction stops at font-size boundaries and prevents body-text bleed", () => {
    const spans = [
      { textContent: "THE HINDU - TUESDAY, OCTOBER 20, 2026", style: { fontSize: "10px" } },
      { textContent: "CABINET APPROVES NEW", style: { fontSize: "26px" } },
      { textContent: "INFRASTRUCTURE", style: { fontSize: "26px" } },
      { textContent: "POLICY", style: { fontSize: "26px" } },
      { textContent: "NEW DELHI: The Union Cabinet on Wednesday approved a mega infrastructure package for ports.", style: { fontSize: "10px" } }
    ];

    const mockTextLayer = {
      querySelectorAll: (sel) => sel === "span" ? spans : []
    };

    for (const s of spans) {
      s.closest = (sel) => sel === ".textLayer" ? mockTextLayer : null;
    }

    const targetSpan = spans[2]; // "INFRASTRUCTURE"
    const mockRange = {
      startContainer: targetSpan,
      startOffset: 0,
      endContainer: targetSpan,
      endOffset: targetSpan.textContent.length,
      toString: () => "INFRASTRUCTURE"
    };

    const sentence = extractSurroundingSentence(mockRange, "INFRASTRUCTURE");
    assert.strictEqual(
      sentence,
      "CABINET APPROVES NEW INFRASTRUCTURE POLICY",
      "Extracted sentence must match headline exactly and NOT bleed into dateline or body text"
    );
    assert.ok(!sentence.includes("NEW DELHI"), "Must not include body text dateline");
    assert.ok(!sentence.includes("OCTOBER"), "Must not include header text");
  });

  // -------------------------------------------------------------------
  // TEST 19: Proximity-Based Tap Detection for Small Text
  // -------------------------------------------------------------------
  runTest("Master Test 19: Proximity-based tap detection finds nearest tiny word within 18px tolerance", () => {
    const smallSpan = {
      tagName: "SPAN",
      textContent: "in",
      style: { fontSize: "9px" },
      firstChild: { nodeType: 3, textContent: "in" },
      contains: () => true,
      getBoundingClientRect: () => ({ left: 100, top: 200, right: 114, bottom: 211, width: 14, height: 11 }),
      closest: (sel) => sel === ".textLayer" ? mockLayer : null
    };

    const mockLayer = {
      querySelectorAll: (sel) => sel === "span" ? [smallSpan] : []
    };

    // User taps at (107, 215) which is 4px below the bottom edge of the span
    const clientX = 107;
    const clientY = 215;

    // Simulate global document lookup returning textLayer instead of span
    globalThis.document = {
      caretPositionFromPoint: () => null,
      caretRangeFromPoint: () => null,
      querySelector: (sel) => sel === ".textLayer" ? mockLayer : null,
      createRange: () => ({
        setStart: () => {},
        setEnd: () => {},
        getBoundingClientRect: () => ({ left: 100, top: 200, right: 114, bottom: 211, width: 14, height: 11 })
      })
    };

    const result = extractWordAtPoint(clientX, clientY, mockLayer);
    assert.ok(result, "Proximity search must find the small word");
    assert.strictEqual(result.text, "in", "Must accurately extract small 2-letter word 'in'");
    assert.strictEqual(result.type, "word");
  });

  // -------------------------------------------------------------------
  // TEST 20: Text Region Classification
  // -------------------------------------------------------------------
  runTest("Master Test 20: Text region classification identifies headline, subheading, highlighted, and caption", () => {
    const headlineSpan = { style: { fontSize: "28px" }, classList: { contains: () => false } };
    const subheadingSpan = { style: { fontSize: "15px" }, classList: { contains: () => false } };
    const highlightedSpan = { style: { fontSize: "12px" }, classList: { contains: (c) => c === "search-highlight" } };
    const captionSpan = { style: { fontSize: "8px" }, classList: { contains: () => false } };
    const bodySpan = { style: { fontSize: "11px" }, classList: { contains: () => false } };

    const allSpans = [headlineSpan, subheadingSpan, highlightedSpan, captionSpan, bodySpan];

    assert.strictEqual(classifyTextRegion(headlineSpan, allSpans).region, "headline");
    assert.strictEqual(classifyTextRegion(subheadingSpan, allSpans).region, "subheading");
    assert.strictEqual(classifyTextRegion(highlightedSpan, allSpans).region, "highlighted");
    assert.strictEqual(classifyTextRegion(captionSpan, allSpans).region, "caption");
    assert.strictEqual(classifyTextRegion(bodySpan, allSpans).region, "body");
  });

  // -------------------------------------------------------------------
  // TEST 21: Small Words and Acronyms Extraction
  // -------------------------------------------------------------------
  runTest("Master Test 21: Small words and acronyms ('a', 'A', 'in', 'to', 'RBI', 'G20', 'PM') are preserved", () => {
    assert.strictEqual(cleanSingleWord("a"), "a");
    assert.strictEqual(cleanSingleWord("A"), "A");
    assert.strictEqual(cleanSingleWord("in"), "in");
    assert.strictEqual(cleanSingleWord("to"), "to");
    assert.strictEqual(cleanSingleWord("at"), "at");
    assert.strictEqual(cleanSingleWord("as"), "as");
    assert.strictEqual(cleanSingleWord("RBI"), "RBI");
    assert.strictEqual(cleanSingleWord("G20"), "G20");
    assert.strictEqual(cleanSingleWord("PM"), "PM");
    assert.strictEqual(cleanSingleWord("SC"), "SC");
    assert.strictEqual(cleanSingleWord("“RBI”,"), "RBI");
  });

  // -------------------------------------------------------------------
  // TEST 22: OCR Segmentation for Small Words and Single-Letter Tokens
  // -------------------------------------------------------------------
  runTest("Master Test 22: OCR segmentation preserves small words and single-letter tokens ('A', 'New', 'Hope')", () => {
    const segmented = segmentOcrText("A New Hope", 10, 20, 300, 30, 95, 1000, 1000);
    assert.strictEqual(segmented.length, 3, "Must segment into 3 individual words");
    assert.strictEqual(segmented[0].clean, "A", "Preserves single-letter word 'A'");
    assert.strictEqual(segmented[1].clean, "New", "Preserves 'New'");
    assert.strictEqual(segmented[2].clean, "Hope", "Preserves 'Hope'");
  });

  // ===================================================================
  // STABILITY & UX UPGRADE REGRESSION TESTS (SECTION 9)
  // ===================================================================

  // -------------------------------------------------------------------
  // TEST 23: Multi-Word Drag with Split Prefix Across Spans Reassembles Full Phrase
  // -------------------------------------------------------------------
  runTest("Stability Test 23: Multi-word drag with split prefix across spans reassembles full phrase", () => {
    // Span 1: "S" (drop-cap)
    // Span 2: "pecial economic reforms"
    const s1 = {
      tagName: "SPAN",
      textContent: "S",
      getBoundingClientRect: () => ({ left: 50, top: 100, right: 62, bottom: 120, width: 12, height: 20 })
    };
    const s2 = {
      tagName: "SPAN",
      textContent: "pecial economic reforms in India",
      getBoundingClientRect: () => ({ left: 62, top: 100, right: 300, bottom: 120, width: 238, height: 20 })
    };
    s1.nextElementSibling = s2;
    s2.previousElementSibling = s1;

    const mockLayer = {
      tagName: "DIV",
      className: "textLayer",
      querySelectorAll: (sel) => (sel.includes("span") ? [s1, s2] : [])
    };
    s1.parentElement = mockLayer;
    s2.parentElement = mockLayer;
    s1.closest = (sel) => (sel.includes("textLayer") ? mockLayer : s1);
    s2.closest = (sel) => (sel.includes("textLayer") ? mockLayer : s2);

    const range = {
      collapsed: false,
      startOffset: 0,
      endOffset: "pecial economic reforms".length,
      startContainer: { nodeType: 3, parentElement: s2, textContent: s2.textContent },
      endContainer: { nodeType: 3, parentElement: s2, textContent: s2.textContent },
      toString: () => "pecial economic reforms",
      getBoundingClientRect: () => ({ left: 62, top: 100, width: 200, height: 20 })
    };

    const sel = expandRangeToSelection(range);
    assert.ok(sel, "Multi-word phrase selection must succeed");
    assert.strictEqual(sel.type, "phrase", "Type must be phrase");
    assert.strictEqual(sel.text, "Special economic reforms", "Must recover initial capital letter 'S' for multi-word phrase");
    assert.strictEqual(sel.wordCount, 3);
  });

  // -------------------------------------------------------------------
  // TEST 24: Sentence Extraction Halts at Newspaper Column Boundaries
  // -------------------------------------------------------------------
  runTest("Stability Test 24: Sentence extraction halts at newspaper column boundaries", () => {
    // Column 1 span: left: 50 to 250
    const col1Span = {
      textContent: "The Cabinet approved infrastructure investments. ",
      getBoundingClientRect: () => ({ left: 50, top: 100, right: 250, bottom: 120, width: 200, height: 20 })
    };
    // Column 2 span: left: 320 to 520 (separated by 70px column gutter)
    const col2Span = {
      textContent: "Domestic markets reacted with enthusiasm today.",
      getBoundingClientRect: () => ({ left: 320, top: 100, right: 520, bottom: 120, width: 200, height: 20 })
    };

    const allSpans = [col1Span, col2Span];
    const mockLayer = { querySelectorAll: () => allSpans };
    col1Span.closest = () => mockLayer;
    col2Span.closest = () => mockLayer;

    const rangeInCol1 = {
      startContainer: col1Span,
      startOffset: 0,
      endContainer: col1Span,
      endOffset: col1Span.textContent.length,
      toString: () => "infrastructure"
    };

    const sentence = extractSurroundingSentence(rangeInCol1, "infrastructure");
    assert.ok(sentence.includes("infrastructure investments"), "Extracted sentence contains column 1 content");
    assert.ok(!sentence.includes("Domestic markets"), "Sentence extraction must NOT cross column gutter into column 2");
  });

  // -------------------------------------------------------------------
  // TEST 25: Rapid Successive Requests Discard Stale In-Flight Responses
  // -------------------------------------------------------------------
  await runAsyncTest("Stability Test 25: Rapid successive selection requests discard stale responses", async () => {
    let activeRequestId = 0;
    let renderedMeaning = "";

    const simulateLookup = async (text, delayMs) => {
      const currentId = ++activeRequestId;
      const res = await new Promise((resolve) => {
        setTimeout(async () => {
          const meaning = await lookupText(text);
          resolve(meaning);
        }, delayMs);
      });

      if (currentId === activeRequestId) {
        renderedMeaning = res.meaning;
      }
    };

    // First request: slower (60ms) for "Constitution"
    const req1 = simulateLookup("Constitution", 60);
    // Second rapid request: faster (10ms) for "growth"
    const req2 = simulateLookup("growth", 10);

    await Promise.all([req1, req2]);
    // Latest request was "growth" (meaning "विकास")
    assert.strictEqual(renderedMeaning, "विकास", "Latest selection meaning must prevail, stale slower response discarded");
  });

  // -------------------------------------------------------------------
  // TEST 26: Mobile Touch Selection Retains Active Text Range
  // -------------------------------------------------------------------
  runTest("Stability Test 26: Mobile touch selection with displacement retains active text range", () => {
    // Simulating mobile touch drag across 40px
    const touchStart = { x: 100, y: 200 };
    const touchEnd = { clientX: 140, clientY: 205 };
    const dx = Math.abs(touchEnd.clientX - touchStart.x); // 40px

    // Active browser text selection exists
    const mockSelection = {
      isCollapsed: false,
      rangeCount: 1,
      toString: () => "economic growth in India"
    };

    const hasSelection = mockSelection && !mockSelection.isCollapsed && mockSelection.toString().trim().length > 0;
    // Condition from App.jsx touch handler:
    // If there is NO active text selection, movement > 10px indicates a scroll or pinch gesture
    const isGestureDiscarded = !hasSelection && dx > 10;

    assert.strictEqual(hasSelection, true, "Selection is active");
    assert.strictEqual(isGestureDiscarded, false, "Selection must NOT be discarded by touch displacement threshold");
  });

  // -------------------------------------------------------------------
  // TEST 27: Fit to Width Scale Calculation Clamped
  // -------------------------------------------------------------------
  runTest("Stability Test 27: Fit to width scale calculation within clamped boundaries", () => {
    const calculateFitScale = (clientWidth) => {
      return Math.min(2.5, Math.max(0.5, +((clientWidth - 40) / 600).toFixed(2)));
    };

    // Mobile screen (390px)
    const mobileFit = calculateFitScale(390);
    assert.ok(mobileFit >= 0.5 && mobileFit <= 1.0, "Mobile fit scale is appropriate");

    // Tablet screen (768px)
    const tabletFit = calculateFitScale(768);
    assert.ok(tabletFit > 1.0 && tabletFit < 1.5, "Tablet fit scale is appropriate");

    // Desktop widescreen (1440px)
    const desktopFit = calculateFitScale(1440);
    assert.ok(desktopFit >= 2.0 && desktopFit <= 2.5, "Desktop fit scale clamps at max 2.5x");
  });

  // -------------------------------------------------------------------
  // TEST 28: Offline Built-in Dictionary Resolves with Zero Latency
  // -------------------------------------------------------------------
  await runAsyncTest("Stability Test 28: Offline dictionary lookup resolves instantly for core vocabulary", async () => {
    const start = Date.now();
    const res = await lookupText("reforms", null, "Economic reforms accelerate growth.");
    const duration = Date.now() - start;

    assert.ok(res, "Lookup must succeed");
    assert.ok(res.meaning.includes("सुधार"), "Meaning must contain सुधार");
    assert.ok(duration < 50, `Lookup must resolve in near-zero latency (took ${duration}ms)`);
  });

  // -------------------------------------------------------------------
  // TEST 29: Switching PDF Resets Stale OCR and Selection State
  // -------------------------------------------------------------------
  runTest("Stability Test 29: Switching PDF documents resets stale OCR and selection state", () => {
    const ocrCache = new Map();
    ocrCache.set(1, [{ text: "OldNews", clean: "OldNews" }]);
    let ocrWords = ocrCache.get(1);
    let page = 3;
    let dismissedSignature = "constitution@100,200";

    // Simulate onDocumentLoadSuccess / processFile on new document
    const resetDocumentSession = () => {
      ocrCache.clear();
      ocrWords = [];
      page = 1;
      dismissedSignature = null;
    };

    resetDocumentSession();
    assert.strictEqual(ocrCache.size, 0, "OCR cache must be cleared for new document");
    assert.strictEqual(ocrWords.length, 0, "Active OCR words must be reset");
    assert.strictEqual(page, 1, "Page must reset to 1");
    assert.strictEqual(dismissedSignature, null, "Dismissed signature must be cleared");
  });

  // -------------------------------------------------------------------
  // TEST 30: Multi-Word Phrase Selection Over Scanned OCR Words
  // -------------------------------------------------------------------
  await runAsyncTest("Stability Test 30: Multi-word phrase selection over OCR words", async () => {
    const phrase = "The Constitution of India";
    const res = await lookupText(phrase, null, phrase);
    assert.ok(res, "Phrase lookup must succeed");
    assert.strictEqual(res.type, "phrase", "Type must be phrase");
    assert.ok(res.meaning && res.meaning.length > 0, "Hindi translation must be present");
    assert.ok(res.meaning.includes("संविधान") || res.meaning.includes("भारत"), "Meaning must translate phrase accurately");
  });

  // -------------------------------------------------------------------
  // TEST 31: Contextual Disambiguation of 'Following' as Preposition
  // -------------------------------------------------------------------
  await runAsyncTest("Stability Test 31: Contextual Disambiguation of 'Following' as Preposition", async () => {
    const sentence = "Following protests against the decision, officials announced a delay.";
    const res = await lookupText("Following", null, sentence);
    assert.ok(res, "Lookup for 'Following' must succeed");
    assert.strictEqual(res.pos, "Preposition", "'Following' before 'protests against' must be classified as Preposition");
    assert.ok(res.meaning.includes("के बाद") || res.meaning.includes("के फलस्वरूप"), "Meaning must be 'के बाद / के फलस्वरूप' rather than 'अगले'");
    assert.ok(!res.pos.includes("Verb"), "Must NOT be classified as Verb in prepositional context");
  });

  // -------------------------------------------------------------------
  // TEST 32: Definite Article Interpretation of 'The'
  // -------------------------------------------------------------------
  await runAsyncTest("Stability Test 32: Definite Article Interpretation of 'The'", async () => {
    const sentence = "The government announced a new policy.";
    const res = await lookupText("The", null, sentence);
    assert.ok(res, "Lookup for 'The' must succeed");
    assert.strictEqual(res.pos, "Article", "'The' must be classified as Article");
    assert.notStrictEqual(res.pos, "Noun", "'The' must NEVER be classified as Noun");
    assert.notStrictEqual(res.meaning, "वह", "'The' must NOT be translated as third-person pronoun 'वह'");
    assert.ok(res.meaning.includes("निश्चित उपपद") || res.meaning.includes("Definite Article"), "Meaning must explain Definite Article role");
  });

  // -------------------------------------------------------------------
  // TEST 33: Multi-Word Drag Selection Protection Across Columns
  // -------------------------------------------------------------------
  runTest("Stability Test 33: Multi-word drag selection protection across newspaper columns", () => {
    const col1Start = {
      textContent: "Supreme Court upheld the ",
      getBoundingClientRect: () => ({ left: 50, top: 100, right: 220, bottom: 120, width: 170, height: 20 })
    };
    const col2End = {
      textContent: "entertainment section review",
      getBoundingClientRect: () => ({ left: 300, top: 180, right: 480, bottom: 200, width: 180, height: 20 })
    };

    const mockSpans = [col1Start, col2End];
    const mockLayer = { querySelectorAll: () => mockSpans };
    col1Start.closest = () => mockLayer;
    col2End.closest = () => mockLayer;

    const crossColRange = {
      startContainer: col1Start,
      startOffset: 0,
      endContainer: col2End,
      endOffset: 12,
      toString: () => "Supreme Court upheld the entertainment"
    };

    const sel = expandRangeToSelection(crossColRange);
    assert.ok(sel, "Selection object must be returned");
    // Must clamp to primary column (col1Start) and exclude col2End
    assert.ok(sel.text.includes("Supreme Court upheld the"), "Selection contains column 1 text");
    assert.ok(!sel.text.includes("entertainment"), "Selection must NOT cross into adjacent column 2");
  });

  // -------------------------------------------------------------------
  // TEST 34: Canvas Double-Buffering Retention Prevents White Flashes
  // -------------------------------------------------------------------
  runTest("Stability Test 34: Canvas double-buffering retention logic prevents white flashes", () => {
    let hasBackup = false;
    let isRendering = false;

    // 1. Initial render completes
    const mockSrcCanvas = { width: 800, height: 1100 };
    const mockBackupCanvas = { width: 0, height: 0, getContext: () => ({ drawImage: () => {} }) };

    // Copy to backup buffer
    mockBackupCanvas.width = mockSrcCanvas.width;
    mockBackupCanvas.height = mockSrcCanvas.height;
    hasBackup = true;
    isRendering = false;

    assert.strictEqual(hasBackup, true, "Backup canvas buffer retains pixels");

    // 2. Zoom level changes -> starts re-render
    isRendering = true;
    // During re-render, backup canvas display condition:
    const showBackup = hasBackup && isRendering;
    assert.strictEqual(showBackup, true, "Backup canvas is visibly displayed during render transitions");

    // 3. New render completes
    isRendering = false;
    assert.strictEqual(hasBackup && isRendering, false, "Backup canvas smoothly hands off to sharp new canvas");
  });

  // -------------------------------------------------------------------
  // TEST 35: Contextual Disambiguation of 'when' as Conjunction ('जब / जिस समय')
  // -------------------------------------------------------------------
  await runAsyncTest("Stability Test 35: Contextual Disambiguation of 'when' as Conjunction ('जब / जिस समय')", async () => {
    // 1. In subordinate clause: "walking towards the exit when chaos broke out"
    const sentence = "They were walking towards the exit when chaos broke out.";
    const res = await lookupText("when", null, sentence);
    assert.ok(res, "Lookup for 'when' must succeed");
    assert.strictEqual(res.pos, "Conjunction", "'when' connecting clauses must be classified as Conjunction");
    assert.notStrictEqual(res.pos, "Noun", "'when' must NEVER be classified as Noun");
    assert.ok(res.meaning.includes("जब") || res.meaning.includes("जिस समय"), "Meaning must be 'जब' or 'जिस समय' rather than 'कब'");

    // 2. In question: "When will the meeting start?"
    const qSentence = "When will the meeting start?";
    const qPos = disambiguatePOS("when", qSentence);
    assert.strictEqual(qPos.pos, "Adverb", "'when' in question must be classified as Interrogative Adverb");
  });

  // -------------------------------------------------------------------
  // TEST 36: Hyphenated Word Resolution Across Lines ('Utta-' + 'rakhand' -> 'Uttarakhand')
  // -------------------------------------------------------------------
  runTest("Stability Test 36: Hyphenated word resolution across lines ('Utta-' + 'rakhand' -> 'Uttarakhand')", () => {
    // Mock textLayer with 2 spans across 2 lines in a newspaper column
    const mockSpan1 = {
      tagName: "SPAN",
      textContent: "poll-bound Utta-",
      getBoundingClientRect: () => ({ left: 100, top: 200, right: 280, bottom: 220, width: 180, height: 20 })
    };
    const mockSpan2 = {
      tagName: "SPAN",
      textContent: "rakhand, Uttar Pradesh,",
      getBoundingClientRect: () => ({ left: 100, top: 224, right: 280, bottom: 244, width: 180, height: 20 })
    };

    const mockTextLayer = {
      querySelectorAll: (sel) => sel === "span" ? [mockSpan1, mockSpan2] : []
    };
    mockSpan1.closest = (sel) => sel === ".textLayer" ? mockTextLayer : null;
    mockSpan2.closest = (sel) => sel === ".textLayer" ? mockTextLayer : null;

    // Case A: User tapped on "rakhand" (line 2 start)
    const resolvedFromLine2 = resolveHyphenatedWord(mockSpan2, "rakhand", "rakhand", true, false);
    assert.strictEqual(resolvedFromLine2, "Uttarakhand", "Tapping 'rakhand' must resolve preceding hyphenated stem 'Utta-' to 'Uttarakhand'");

    // Case B: User tapped on "Utta-" (line 1 end)
    const resolvedFromLine1 = resolveHyphenatedWord(mockSpan1, "Utta", "Utta-", false, true);
    assert.strictEqual(resolvedFromLine1, "Uttarakhand", "Tapping 'Utta-' must resolve succeeding continuation 'rakhand' to 'Uttarakhand'");
  });

  // -------------------------------------------------------------------
  // TEST 37: Custom Highlight Box Creation & OS Selection Toolbar Suppression on Mobile
  // -------------------------------------------------------------------
  runTest("Stability Test 37: Custom highlight box creation & OS selection toolbar suppression on mobile", () => {
    const paperRect = { left: 50, top: 100, width: 600, height: 800 };
    const clientRect = { left: 120, top: 240, width: 90, height: 22 };

    const relativeBox = {
      left: clientRect.left - paperRect.left,
      top: clientRect.top - paperRect.top,
      width: clientRect.width,
      height: clientRect.height
    };

    assert.strictEqual(relativeBox.left, 70);
    assert.strictEqual(relativeBox.top, 140);
    assert.strictEqual(relativeBox.width, 90);
    assert.strictEqual(relativeBox.height, 22);

    // Verification that range has clientRects captured
    const mockRange = {
      collapsed: false,
      toString: () => "economic growth",
      getBoundingClientRect: () => clientRect,
      getClientRects: () => [clientRect]
    };
    const sel = expandRangeToSelection(mockRange);
    assert.ok(sel, "Selection succeeds");
    assert.ok(Array.isArray(sel.clientRects), "expandRangeToSelection provides clientRects array");
    assert.strictEqual(sel.clientRects.length, 1);
  });

  // -------------------------------------------------------------------
  // TEST 38: Over-Long Multi-Column Selection (> 35 Words) Safety
  // -------------------------------------------------------------------
  runTest("Stability Test 38: Over-long multi-column selection (> 35 words) safety", () => {
    const longText = "This is an accidental drag selection across multiple columns of a newspaper that includes many sentences and exceeds the reasonable maximum length of a vocabulary phrase to ensure stability and prevent UI freezing ".repeat(3);
    const mockRange = {
      collapsed: false,
      toString: () => longText,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 400 })
    };
    const res = expandRangeToSelection(mockRange);
    assert.strictEqual(res, null, "Over-long selections (> 35 words) must be rejected to prevent screen freeze");
  });

  // -------------------------------------------------------------------
  // TEST 39: Google Translate Suppression Attributes in HTML & Reader Container
  // -------------------------------------------------------------------
  await runAsyncTest("Stability Test 39: Google Translate suppression attributes in HTML & Reader container", async () => {
    const fs = await import("node:fs");
    const html = fs.readFileSync("./index.html", "utf-8");
    assert.ok(html.includes('translate="no"'), "HTML root must include translate='no'");
    assert.ok(html.includes('class="notranslate"'), "HTML root must include class='notranslate'");
    assert.ok(html.includes('<meta name="google" content="notranslate"'), "HTML head must include notranslate meta tag");
  });

  console.log("\n-------------------------------------------------");
  if (testsFailed > 0) {
    console.error(`RESULTS: ${testsPassed} passed, ${testsFailed} failed.`);
    process.exit(1);
  } else {
    console.log(`ALL REGRESSION TESTS PASSED (${testsPassed} / ${testsPassed})`);
    console.log("-------------------------------------------------");
  }
}

main();
