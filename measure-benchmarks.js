// ReadHindi Comprehensive Benchmark & Accuracy Measurement Suite
// Measures: Selection Accuracy, OCR Accuracy, Grammar-Classification Accuracy, and Failure Rates
// Tests against: Clean text, low-quality scans, different fonts, and varied newspaper layouts.

import fs from "node:fs";
import { createWorker } from "tesseract.js";
import { cleanSingleWord, normalizeSelectionText, expandRangeToSelection } from "./src/selection.js";
import { BUILTIN_DICTIONARY, lookupText } from "./src/dictionary.js";

// Minimal polyfill for DOM constants in Node
if (typeof globalThis.Node === "undefined") {
  globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };
}

console.log("================================================================================");
console.log("       READHINDI COMPREHENSIVE BENCHMARK & ACCURACY MEASUREMENT SUITE          ");
console.log("================================================================================\n");

// Levenshtein distance for CER/WER calculation
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return d[m][n];
}

// ------------------------------------------------------------------------------
// BENCHMARK 1: SELECTION ACCURACY BENCHMARK (120 Trials)
// ------------------------------------------------------------------------------
function runSelectionBenchmark() {
  console.log("--------------------------------------------------------------------------------");
  console.log(" [BENCHMARK 1] Selection Accuracy Across Diverse Newspaper Layouts (N = 120)");
  console.log("--------------------------------------------------------------------------------");

  const testCases = [
    // 1. Clean single words across diverse editorial vocabulary (30 cases)
    ...[
      "Constitution", "democracy", "sovereignty", "judiciary", "governance",
      "fundamental", "reforms", "inflation", "resilient", "parliamentary",
      "legislation", "amendment", "federalism", "infrastructure", "agriculture",
      "manufacturing", "bilateral", "diplomatic", "sustainable", "monetary",
      "expenditure", "revenue", "deficit", "growth", "prosperity",
      "integrity", "arbitration", "jurisdiction", "secularism", "republic"
    ].map(w => ({ input: w, expected: w, type: "word", layout: "single-word" })),

    // 2. Narrow column hyphenated line wraps (20 cases)
    ...[
      { raw: "inves-\n tigation", expected: "investigation" },
      { raw: "develop-\n ment", expected: "development" },
      { raw: "demo-\n cratic", expected: "democratic" },
      { raw: "ad-\n ministration", expected: "administration" },
      { raw: "inter-\n national", expected: "international" },
      { raw: "insti-\n tutional", expected: "institutional" },
      { raw: "sus-\n tainable", expected: "sustainable" },
      { raw: "manu-\n facturing", expected: "manufacturing" },
      { raw: "agri-\n cultural", expected: "agricultural" },
      { raw: "eco-\n nomic", expected: "economic" },
      { raw: "inves-\r\n  tment", expected: "investment" },
      { raw: "legis-\n lative", expected: "legislative" },
      { raw: "amend-\n ment", expected: "amendment" },
      { raw: "parlia-\n mentary", expected: "parliamentary" },
      { raw: "gov-\n ernment", expected: "government" },
      { raw: "infra-\n structure", expected: "infrastructure" },
      { raw: "produc-\n tivity", expected: "productivity" },
      { raw: "com-\n mission", expected: "commission" },
      { raw: "sig-\n nificant", expected: "significant" },
      { raw: "pro-\n vision", expected: "provision" }
    ].map(c => ({ input: c.raw, expected: c.expected, type: "word", layout: "narrow-column-hyphen" })),

    // 3. Punctuation, brackets, and quote-wrapped words (15 cases)
    ...[
      { raw: "“Constitution”", expected: "Constitution" },
      { raw: "‘fundamental’", expected: "fundamental" },
      { raw: "(reforms)", expected: "reforms" },
      { raw: "[governance]", expected: "governance" },
      { raw: "«sovereignty»", expected: "sovereignty" },
      { raw: "“growth”,", expected: "growth" },
      { raw: "‘democracy’;", expected: "democracy" },
      { raw: "(deficit):", expected: "deficit" },
      { raw: "—resilient—", expected: "resilient" },
      { raw: "“arbitration”!", expected: "arbitration" },
      { raw: "‘judiciary’?", expected: "judiciary" },
      { raw: "“prosperity”.", expected: "prosperity" },
      { raw: "‘infrastructure’", expected: "infrastructure" },
      { raw: "(legislation)", expected: "legislation" },
      { raw: "“monetary”", expected: "monetary" }
    ].map(c => ({ input: c.raw, expected: c.expected, type: "word", layout: "punctuation-wrapped" })),

    // 4. Narrow column phrases (20 cases)
    ...[
      { raw: "fundamental rights", expected: "fundamental rights" },
      { raw: "Supreme Court of India", expected: "Supreme Court of India" },
      { raw: "monetary policy committee", expected: "monetary policy committee" },
      { raw: "economic growth in India", expected: "economic growth in India" },
      { raw: "rule of law", expected: "rule of law" },
      { raw: "freedom of speech", expected: "freedom of speech" },
      { raw: "bilateral trade relations", expected: "bilateral trade relations" },
      { raw: "public health expenditure", expected: "public health expenditure" },
      { raw: "green energy transition", expected: "green energy transition" },
      { raw: "goods and services tax", expected: "goods and services tax" },
      { raw: "high court judges", expected: "high court judges" },
      { raw: "central bank governor", expected: "central bank governor" },
      { raw: "foreign direct investment", expected: "foreign direct investment" },
      { raw: "fiscal deficit target", expected: "fiscal deficit target" },
      { raw: "sustainable urban transport", expected: "sustainable urban transport" },
      { raw: "digital public infrastructure", expected: "digital public infrastructure" },
      { raw: "parliamentary standing committee", expected: "parliamentary standing committee" },
      { raw: "inclusive economic reforms", expected: "inclusive economic reforms" },
      { raw: "national security advisor", expected: "national security advisor" },
      { raw: "agricultural export growth", expected: "agricultural export growth" }
    ].map(c => ({ input: c.raw, expected: c.expected, type: "phrase", layout: "narrow-column-phrase" })),

    // 5. Multi-line full sentences (15 cases)
    ...[
      "The Supreme Court dismissed the appeal against the high court order.",
      "Economic indicators reflect sustained momentum across domestic manufacturing sectors.",
      "The central bank maintained its benchmark repo rate unchanged on Friday.",
      "Parliament approved the new statutory regulatory framework for digital markets.",
      "Renewable energy capacity witnessed substantial additions during the previous fiscal year.",
      "The diplomatic delegation emphasized bilateral trade expansion and border stability.",
      "Public capital investment continues to drive infrastructure modernization across states.",
      "Agricultural output registered healthy growth following widespread monsoon coverage.",
      "The finance ministry reviewed quarterly direct tax revenue collections.",
      "Sustainable urban mobility projects received fresh allocation under the capital scheme.",
      "The committee recommended comprehensive structural reforms for trade facilitation.",
      "Headline retail inflation moderated towards the official four percent target.",
      "Federal relations and cooperative governance were highlighted during the chief ministers conference.",
      "Foreign portfolio investors turned net buyers in domestic equity markets.",
      "The cabinet approved expansion of production linked incentive schemes."
    ].map(s => ({ input: s, expected: s, type: "sentence", layout: "multi-line-sentence" })),

    // 6. Accidental drag & oversized full-page text dumps (10 negative cases, expected: null)
    ...[
      { raw: "The Supreme Court on Monday delivered a significant judgment regarding constitutional provisions. The bench comprising five judges held extensive hearings on federal structure and governance. Economic growth remains resilient across domestic sectors with positive indicators reported by the central bank. The government announced further reforms in manufacturing, agriculture, and infrastructure. Border security measures have been strengthened following high-level diplomatic assessments. Public health initiatives and educational developments were also reviewed by the parliamentary committee. Sustainable urban mobility and green energy transitions continue to receive substantial public investments.", expected: null, layout: "full-page-dump" },
      { raw: "--- ... ,, !!", expected: null, layout: "punctuation-only" },
      { raw: "      \n\n\t   ", expected: null, layout: "whitespace-only" },
      { raw: "", expected: null, layout: "empty" },
      { raw: "1234567890 0987654321 1122334455 6677889900 123 456 789 012 345 678 901 234 567 890 123 456 789 012 345 678 901 234 567 890 123 456 789 012 345 678 901 234 567 890 123 456 789 012 345 678 901 234", expected: null, layout: "oversized-digits" },
      { raw: "— – - — – -", expected: null, layout: "dashes-only" },
      { raw: "« » “ ” ‘ ’", expected: null, layout: "quotes-only" },
      { raw: "EDITORIAL OPINION LETTERS SPORT BUSINESS WORLD OBITUARIES CLASSIFIEDS WEATHER INDEX ARCHIVE SEARCH ABOUT CONTACT PRIVACY TERMS ADVERTISE CAREERS SUBSCRIPTION ARCHIVES FEEDS RSS APP", expected: null, layout: "newspaper-header-dump" },
      { raw: "A comprehensive assessment of structural adjustments across multiple industrial sectors conducted by independent international financial institutions demonstrated remarkable resilience despite prevailing macroeconomic uncertainties and volatile currency markets worldwide during the previous fiscal year.", expected: null, layout: "oversized-runon-paragraph" },
      { raw: ";;; ;;; ;;;", expected: null, layout: "semicolons-only" }
    ].map(c => ({ input: c.raw, expected: c.expected, layout: c.layout })),

    // 7. Alphanumeric & specialized compounds (10 cases)
    ...[
      { raw: "G20", expected: "G20", type: "word", layout: "alphanumeric" },
      { raw: "COVID-19", expected: "COVID-19", type: "word", layout: "alphanumeric" },
      { raw: "3D", expected: "3D", type: "word", layout: "alphanumeric" },
      { raw: "anti-dumping", expected: "anti-dumping", type: "word", layout: "hyphenated-compound" },
      { raw: "well-being", expected: "well-being", type: "word", layout: "hyphenated-compound" },
      { raw: "eco-friendly", expected: "eco-friendly", type: "word", layout: "hyphenated-compound" },
      { raw: "G-7", expected: "G-7", type: "word", layout: "alphanumeric" },
      { raw: "COP28", expected: "COP28", type: "word", layout: "alphanumeric" },
      { raw: "AI-driven", expected: "AI-driven", type: "word", layout: "alphanumeric-hyphen" },
      { raw: "high-tech", expected: "high-tech", type: "word", layout: "hyphenated-compound" }
    ].map(c => ({ input: c.raw, expected: c.expected, type: c.type, layout: c.layout }))
  ];

  let passed = 0;
  let failed = 0;
  const layoutStats = {};

  for (const tc of testCases) {
    const layout = tc.layout || "general";
    if (!layoutStats[layout]) layoutStats[layout] = { total: 0, passed: 0 };
    layoutStats[layout].total++;

    const mockRange = {
      collapsed: !tc.input || tc.input.trim().length === 0,
      toString: () => tc.input,
      startContainer: { nodeType: 3, textContent: tc.input },
      getBoundingClientRect: () => ({ left: 100, top: 200, width: 80, height: 18 })
    };

    const res = expandRangeToSelection(mockRange);

    let isMatch = false;
    if (tc.expected === null) {
      isMatch = res === null;
    } else {
      isMatch = res !== null && res.text === tc.expected;
    }

    if (isMatch) {
      passed++;
      layoutStats[layout].passed++;
    } else {
      failed++;
    }
  }

  const accuracy = (passed / testCases.length) * 100;
  const failureRate = (failed / testCases.length) * 100;

  console.log(`Total Selection Trials:      ${testCases.length}`);
  console.log(`Successful Extractions:      ${passed}`);
  console.log(`Failed / Inaccurate:         ${failed}`);
  console.log(`Selection Accuracy:          ${accuracy.toFixed(2)}%`);
  console.log(`Selection Failure Rate:      ${failureRate.toFixed(2)}%\n`);

  console.log("Breakdown by Layout Category:");
  for (const [layout, s] of Object.entries(layoutStats)) {
    const acc = ((s.passed / s.total) * 100).toFixed(1);
    console.log(`  - ${layout.padEnd(28)}: ${s.passed}/${s.total} (${acc}%)`);
  }
  console.log();

  return { total: testCases.length, passed, failed, accuracy, failureRate };
}

// ------------------------------------------------------------------------------
// BENCHMARK 2: GRAMMAR-CLASSIFICATION ACCURACY BENCHMARK (75 Trials)
// ------------------------------------------------------------------------------
function runGrammarClassificationBenchmark() {
  console.log("--------------------------------------------------------------------------------");
  console.log(" [BENCHMARK 2] Grammar & Linguistic Structure Classification (N = 75)");
  console.log("--------------------------------------------------------------------------------");

  const grammarCases = [
    // Single words (nouns, verbs, adjectives, adverbs) - 25 cases
    { text: "Constitution", expectedType: "word", pos: "Noun" },
    { text: "implement", expectedType: "word", pos: "Verb" },
    { text: "resilient", expectedType: "word", pos: "Adjective" },
    { text: "substantially", expectedType: "word", pos: "Adverb" },
    { text: "sovereignty", expectedType: "word", pos: "Noun" },
    { text: "legislation", expectedType: "word", pos: "Noun" },
    { text: "adjudicate", expectedType: "word", pos: "Verb" },
    { text: "equitable", expectedType: "word", pos: "Adjective" },
    { text: "deliberately", expectedType: "word", pos: "Adverb" },
    { text: "parliament", expectedType: "word", pos: "Noun" },
    { text: "scrutinize", expectedType: "word", pos: "Verb" },
    { text: "constitutional", expectedType: "word", pos: "Adjective" },
    { text: "unanimously", expectedType: "word", pos: "Adverb" },
    { text: "federation", expectedType: "word", pos: "Noun" },
    { text: "strengthen", expectedType: "word", pos: "Verb" },
    { text: "comprehensive", expectedType: "word", pos: "Adjective" },
    { text: "judicially", expectedType: "word", pos: "Adverb" },
    { text: "arbitration", expectedType: "word", pos: "Noun" },
    { text: "safeguard", expectedType: "word", pos: "Verb" },
    { text: "statutory", expectedType: "word", pos: "Adjective" },
    { text: "inflation", expectedType: "word", pos: "Noun" },
    { text: "accelerate", expectedType: "word", pos: "Verb" },
    { text: "fiscal", expectedType: "word", pos: "Adjective" },
    { text: "consistently", expectedType: "word", pos: "Adverb" },
    { text: "integrity", expectedType: "word", pos: "Noun" },

    // Multi-word phrases & idioms (25 cases)
    { text: "fundamental rights", expectedType: "phrase", words: 2 },
    { text: "Supreme Court of India", expectedType: "phrase", words: 4 },
    { text: "monetary policy committee", expectedType: "phrase", words: 3 },
    { text: "economic growth in India", expectedType: "phrase", words: 4 },
    { text: "rule of law", expectedType: "phrase", words: 3 },
    { text: "freedom of speech and expression", expectedType: "phrase", words: 5 },
    { text: "bilateral trade negotiations", expectedType: "phrase", words: 3 },
    { text: "gross domestic product", expectedType: "phrase", words: 3 },
    { text: "checks and balances", expectedType: "phrase", words: 3 },
    { text: "foreign exchange reserves", expectedType: "phrase", words: 3 },
    { text: "public sector banks", expectedType: "phrase", words: 3 },
    { text: "cooperative federalism", expectedType: "phrase", words: 2 },
    { text: "current account deficit", expectedType: "phrase", words: 3 },
    { text: "due process of law", expectedType: "phrase", words: 4 },
    { text: "sustainable development goals", expectedType: "phrase", words: 3 },
    { text: "ease of doing business", expectedType: "phrase", words: 4 },
    { text: "high level delegation", expectedType: "phrase", words: 3 },
    { text: "direct tax collections", expectedType: "phrase", words: 3 },
    { text: "clean energy transition", expectedType: "phrase", words: 3 },
    { text: "capital expenditure allocation", expectedType: "phrase", words: 3 },
    { text: "free trade agreement", expectedType: "phrase", words: 3 },
    { text: "parliamentary standing committee", expectedType: "phrase", words: 3 },
    { text: "statutory regulatory authority", expectedType: "phrase", words: 3 },
    { text: "chief justice of India", expectedType: "phrase", words: 4 },
    { text: "national highway network", expectedType: "phrase", words: 3 },

    // Sentences (declarative, complex, questions) (15 cases)
    { text: "The Supreme Court dismissed the appeal today.", expectedType: "sentence" },
    { text: "India's economy continues to show resilient quarterly growth.", expectedType: "sentence" },
    { text: "The central bank held the repo rate unchanged at six percent.", expectedType: "sentence" },
    { text: "Did the parliamentary standing committee approve the bill?", expectedType: "sentence" },
    { text: "The government announced substantial fiscal reforms for manufacturing.", expectedType: "sentence" },
    { text: "Renewable energy installations reached a historic milestone this month.", expectedType: "sentence" },
    { text: "Will the proposed amendments protect digital privacy rights?", expectedType: "sentence" },
    { text: "Headline retail inflation eased within the tolerance band.", expectedType: "sentence" },
    { text: "Cooperative federalism remains essential for national economic planning.", expectedType: "sentence" },
    { text: "The bench delivered a unanimous verdict on federal taxation powers.", expectedType: "sentence" },
    { text: "Foreign institutional investors registered significant net inflows.", expectedType: "sentence" },
    { text: "Sustainable urban mobility demands dedicated long-term infrastructure funding.", expectedType: "sentence" },
    { text: "The high court issued notice to the state administration.", expectedType: "sentence" },
    { text: "Monetary easing measures stimulated private sector investment demand.", expectedType: "sentence" },
    { text: "Agricultural produce markets recorded record seasonal arrivals.", expectedType: "sentence" },

    // Alphanumerics & specialized compounds (10 cases)
    { text: "G20", expectedType: "word" },
    { text: "COVID-19", expectedType: "word" },
    { text: "3D", expectedType: "word" },
    { text: "COP28", expectedType: "word" },
    { text: "anti-dumping duty", expectedType: "phrase" },
    { text: "well-being indicators", expectedType: "phrase" },
    { text: "G-7 summit", expectedType: "phrase" },
    { text: "AI-driven algorithms", expectedType: "phrase" },
    { text: "eco-friendly packaging", expectedType: "phrase" },
    { text: "high-tech manufacturing", expectedType: "phrase" }
  ];

  let passed = 0;
  let failed = 0;
  const typeStats = { word: { total: 0, passed: 0 }, phrase: { total: 0, passed: 0 }, sentence: { total: 0, passed: 0 } };

  for (const gc of grammarCases) {
    const mockRange = {
      collapsed: false,
      toString: () => gc.text,
      startContainer: { nodeType: 3, textContent: gc.text },
      getBoundingClientRect: () => ({ left: 50, top: 100, width: 120, height: 20 })
    };

    const res = expandRangeToSelection(mockRange);
    const actualType = res ? res.type : null;
    const expected = gc.expectedType;

    if (!typeStats[expected]) typeStats[expected] = { total: 0, passed: 0 };
    typeStats[expected].total++;

    if (actualType === expected) {
      passed++;
      typeStats[expected].passed++;
    } else {
      failed++;
    }
  }

  const accuracy = (passed / grammarCases.length) * 100;
  const failureRate = (failed / grammarCases.length) * 100;

  console.log(`Total Grammar Trials:        ${grammarCases.length}`);
  console.log(`Correct Classifications:     ${passed}`);
  console.log(`Misclassifications:          ${failed}`);
  console.log(`Grammar Accuracy:            ${accuracy.toFixed(2)}%`);
  console.log(`Classification Error Rate:   ${failureRate.toFixed(2)}%\n`);

  console.log("Breakdown by Grammatical Type:");
  for (const [t, s] of Object.entries(typeStats)) {
    const acc = ((s.passed / s.total) * 100).toFixed(1);
    console.log(`  - ${t.padEnd(16)}: ${s.passed}/${s.total} (${acc}%)`);
  }
  console.log();

  return { total: grammarCases.length, passed, failed, accuracy, failureRate };
}

// ------------------------------------------------------------------------------
// BENCHMARK 3: REAL OCR ACCURACY ACROSS SCANS, FONTS & LAYOUTS
// ------------------------------------------------------------------------------
async function runOcrAccuracyBenchmark() {
  console.log("--------------------------------------------------------------------------------");
  console.log(" [BENCHMARK 3] OCR Accuracy & Character Error Rates on Real Scans & Fonts");
  console.log("--------------------------------------------------------------------------------");

  const ocrSamples = [
    {
      id: "phototest.tif",
      name: "Real Document Print Scan (Standard Font)",
      path: "test_data/phototest.tif",
      groundTruth: "This is a lot of 12 point text to test the ocr code and see if it works on all types of file format. The quick brown dog jumped over the lazy fox. The quick brown dog jumped over the lazy fox. The quick brown dog jumped over the lazy fox. The quick brown dog jumped over the lazy fox."
    },
    {
      id: "trainingtimes.tif",
      name: "Newspaper Editorial Font (Times New Roman / Serif)",
      path: "test_data/trainingtimes.tif",
      groundTruth: "To simple burn running of goods lately."
    },
    {
      id: "trainingital.tif",
      name: "Newspaper Caption / Quote Font (Italic Style)",
      path: "test_data/trainingital.tif",
      groundTruth: "To simple burn running of goods lately."
    },
    {
      id: "phototestrot.tif",
      name: "Skewed / 90° Rotated Scan (Without Deskew)",
      path: "test_data/phototestrot.tif",
      groundTruth: "This is a lot of 12 point text to test the ocr code and see if it works on all types of file format. The quick brown dog jumped over the lazy fox. The quick brown dog jumped over the lazy fox. The quick brown dog jumped over the lazy fox. The quick brown dog jumped over the lazy fox."
    }
  ];

  const results = [];
  const worker = await createWorker("eng");

  for (const sample of ocrSamples) {
    if (!fs.existsSync(sample.path)) {
      console.log(`Skipping ${sample.id} (file not found)`);
      continue;
    }

    const tStart = Date.now();
    const ret = await worker.recognize(sample.path, {}, { tsv: true });
    const durationMs = Date.now() - tStart;

    // Parse words and bounding boxes from TSV
    const lines = (ret.data.tsv || "").split("\n");
    const words = [];
    let lowConfidenceCount = 0;

    for (const line of lines) {
      const cols = line.split("\t");
      if (cols.length >= 12 && cols[0] === "5") {
        const conf = parseFloat(cols[10]);
        const rawText = cols[11]?.trim();
        if (rawText) {
          words.push({ text: rawText, conf });
          if (conf < 40) {
            lowConfidenceCount++;
          }
        }
      }
    }

    const rawExtracted = ret.data.text.replace(/\s+/g, " ").trim();
    const gt = sample.groundTruth.replace(/\s+/g, " ").trim();

    // Compute Character Error Rate (CER) and Word Error Rate (WER)
    const charDist = levenshteinDistance(rawExtracted, gt);
    const cer = (charDist / Math.max(1, gt.length)) * 100;

    const gtWords = gt.split(/\s+/);
    const extWords = rawExtracted.split(/\s+/);
    const wordDist = levenshteinDistance(extWords, gtWords);
    const wer = (wordDist / Math.max(1, gtWords.length)) * 100;

    const avgConf = words.length > 0 ? words.reduce((a, b) => a + b.conf, 0) / words.length : 0;
    const wordDropRate = words.length > 0 ? (lowConfidenceCount / words.length) * 100 : 0;
    const wordAccuracy = Math.max(0, 100 - wer);

    results.push({
      sample: sample.name,
      file: sample.id,
      wordCount: words.length,
      avgConfidence: avgConf,
      cer: Math.min(100, cer),
      wer: Math.min(100, wer),
      wordAccuracy: Math.min(100, wordAccuracy),
      lowConfDropRate: wordDropRate,
      durationMs
    });
  }

  await worker.terminate();

  console.log("Measured OCR Benchmark Results Table:\n");
  console.log("| Dataset / Font Condition                  | Words | Avg Conf | CER (%) | WER (%) | Accuracy (%) | Drop Rate (%) | Latency |");
  console.log("|:------------------------------------------|------:|---------:|--------:|--------:|-------------:|--------------:|--------:|");

  for (const r of results) {
    const nameCol = r.sample.padEnd(41).slice(0, 41);
    const wCol = String(r.wordCount).padStart(5);
    const confCol = (r.avgConfidence.toFixed(1) + "%").padStart(8);
    const cerCol = (r.cer.toFixed(1) + "%").padStart(7);
    const werCol = (r.wer.toFixed(1) + "%").padStart(7);
    const accCol = (r.wordAccuracy.toFixed(1) + "%").padStart(12);
    const dropCol = (r.lowConfDropRate.toFixed(1) + "%").padStart(13);
    const timeCol = (r.durationMs + "ms").padStart(7);

    console.log(`| ${nameCol} | ${wCol} | ${confCol} | ${cerCol} | ${werCol} | ${accCol} | ${dropCol} | ${timeCol} |`);
  }
  console.log();

  return results;
}

// ------------------------------------------------------------------------------
// BENCHMARK 4: TRANSLATION RESOLUTION & FAILURE RATES
// ------------------------------------------------------------------------------
async function runTranslationBenchmark() {
  console.log("--------------------------------------------------------------------------------");
  console.log(" [BENCHMARK 4] Translation Reliability & Separate Failure Rate Breakdown");
  console.log("--------------------------------------------------------------------------------");

  const editorialVocabularySample = [
    "growth", "resilient", "reforms", "reform", "demand", "economy", "economic",
    "strong", "positive", "focus", "inflation", "central", "policy", "stability",
    "domestic", "output", "quarterly", "banking", "sovereignty", "judiciary",
    "democracy", "constitution", "parliament", "federal", "bilateral",
    "revenue", "deficit", "infrastructure", "expenditure", "monetary"
  ];

  let offlineHits = 0;
  for (const term of editorialVocabularySample) {
    if (BUILTIN_DICTIONARY[term.toLowerCase()]) {
      offlineHits++;
    }
  }

  const editorialCoverage = (offlineHits / editorialVocabularySample.length) * 100;
  console.log(`Editorial Vocabulary Sample:   ${editorialVocabularySample.length} terms`);
  console.log(`Built-in Offline Hits:         ${offlineHits}`);
  console.log(`Instant Offline Coverage:      ${editorialCoverage.toFixed(1)}% (0ms latency)\n`);

  // Test online fallback & live translation lookup
  const liveTerms = ["judiciary", "federalism", "sovereign", "amendment", "arbitration"];
  let liveSuccess = 0;
  let liveFail = 0;

  for (const term of liveTerms) {
    try {
      const res = await lookupText(term);
      if (res && res.meaning && !res.meaning.includes("उपलब्ध नहीं")) {
        liveSuccess++;
      } else {
        liveFail++;
      }
    } catch {
      liveFail++;
    }
  }

  const liveAccuracy = (liveSuccess / liveTerms.length) * 100;
  const liveFailRate = (liveFail / liveTerms.length) * 100;

  console.log(`Live Lookup Test Terms:        ${liveTerms.length}`);
  console.log(`Live Lookup Successes:         ${liveSuccess}`);
  console.log(`Live Lookup Accuracy:          ${liveAccuracy.toFixed(1)}%`);
  console.log(`Live Failure Rate:             ${liveFailRate.toFixed(1)}%\n`);

  return { editorialCoverage, liveAccuracy, liveFailRate };
}

// ------------------------------------------------------------------------------
// SUMMARY REPORT
// ------------------------------------------------------------------------------
async function main() {
  const selRes = runSelectionBenchmark();
  const gramRes = runGrammarClassificationBenchmark();
  const ocrRes = await runOcrAccuracyBenchmark();
  const transRes = await runTranslationBenchmark();

  console.log("================================================================================");
  console.log("                  FINAL MEASURED ACCURACY & FAILURE SUMMARY                     ");
  console.log("================================================================================\n");

  console.log(`1. Selection Accuracy (Clean Text, Wraps & Edge Bounds): ${selRes.accuracy.toFixed(2)}% (Failure: ${selRes.failureRate.toFixed(2)}%)`);
  console.log(`2. Grammar-Classification Accuracy (Word / Phrase / Sent): ${gramRes.accuracy.toFixed(2)}% (Error: ${gramRes.failureRate.toFixed(2)}%)`);

  const cleanOcr = ocrRes.filter(r => !r.file.includes("rot"));
  const avgCleanOcrAcc = cleanOcr.reduce((a, b) => a + b.wordAccuracy, 0) / cleanOcr.length;
  const avgCleanOcrConf = cleanOcr.reduce((a, b) => a + b.avgConfidence, 0) / cleanOcr.length;
  const rotatedOcr = ocrRes.find(r => r.file.includes("rot"));

  console.log(`3. OCR Word Accuracy (Clean Print & Editorial Fonts):     ${avgCleanOcrAcc.toFixed(2)}% (Avg Conf: ${avgCleanOcrConf.toFixed(1)}%)`);
  if (rotatedOcr) {
    console.log(`   - Skewed / Rotated Scan Accuracy (without deskew):      ${rotatedOcr.wordAccuracy.toFixed(2)}% (Failure/Drop: ${rotatedOcr.lowConfDropRate.toFixed(1)}%)`);
  }

  console.log(`4. Editorial Vocabulary Coverage (Instant Zero-Latency):   ${transRes.editorialCoverage.toFixed(1)}%`);
  console.log(`5. Fallback Translation Availability:                      ${transRes.liveAccuracy.toFixed(1)}% (Failure: ${transRes.liveFailRate.toFixed(1)}%)`);
  console.log("\n================================================================================");
}

main();
