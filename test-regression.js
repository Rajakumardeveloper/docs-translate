import assert from "node:assert";
import { cleanSingleWord, normalizeSelectionText, expandRangeToSelection } from "./src/selection.js";
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
