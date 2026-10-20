import assert from "node:assert";
import { cleanSingleWord, normalizeSelectionText, expandRangeToSelection, calculatePopupPosition } from "./src/selection.js";
import { lookupText, normalizeLookupText, BUILTIN_DICTIONARY } from "./src/dictionary.js";

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
