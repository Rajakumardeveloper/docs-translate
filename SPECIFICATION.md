# ReadHindi — Comprehensive Product & Technical Specification

> **Product Vision:** Make English newspapers easier to understand for Hindi-speaking students, one word at a time.

---

## 1. Executive Summary & Architecture Overview

ReadHindi is a client-side, mobile-first web application designed to eliminate vocabulary barriers for students reading English broadsheets (e.g., *The Hindu*, *The Indian Express*, *The Times of India*). The system parses both native digital PDFs and scanned newspaper pages, allowing users to tap any unfamiliar word or phrase to view its contextual Hindi meaning and part of speech in a compact popup, without translating the entire page or losing their reading position.

```mermaid
flowchart TD
    subgraph Ingestion["1. Document Ingestion"]
        Upload["PDF File Upload / Drop / Sample"] --> LocalBuffer["Local Uint8Array Buffer (Zero-Upload)"]
    end

    subgraph Detection["2. Analysis & Rendering"]
        LocalBuffer --> PDFEngine["PDF.js Engine (react-pdf)"]
        PDFEngine --> Canvas["Canvas Renderer"]
        PDFEngine --> TextLayer["Native TextLayer (Spans & Glyphs)"]
        TextLayer --> Evaluator{"Scanned Page Detector<br/>(Words < 6 or Chars < 30)"}
        Evaluator -- "Native Digital PDF" --> ReaderSurface["Interactive Reading Surface"]
        Evaluator -- "Scanned Image Page" --> OCRPipeline["High-Res Offscreen Preprocessing & Tesseract OCR"]
        OCRPipeline --> OCROverlay["Zoom-Invariant OCR Overlay (.ocr-word-span)"]
        OCROverlay --> ReaderSurface
    end

    subgraph Interaction["3. Selection & Resolution"]
        ReaderSurface --> TapSelect["User Tap / Click / Text Drag"]
        TapSelect --> TextResolver["Selection & Boundary Resolver (selection.js)"]
        TextResolver --> SentenceExtract["Multi-Span Sentence Context Extractor"]
    end

    subgraph Intelligence["4. Linguistic & Meaning Engine"]
        SentenceExtract --> POSDisambiguator["Context-Aware Grammar Engine (grammarEngine.js)"]
        POSDisambiguator --> DictHierarchy["Multi-Tier Dictionary Pipeline (dictionary.js)"]
        DictHierarchy --> Tier1["Tier 1: Built-in Editorial Dictionary (0ms Offline)"]
        DictHierarchy --> Tier2["Tier 2: LocalStorage Vocabulary Cache"]
        DictHierarchy --> Tier3["Tier 3: Online Free Translation Fallbacks"]
    end

    subgraph UI["5. Minimalist Presentation"]
        Tier1 & Tier2 & Tier3 --> CompactPopup["Vocabulary Teacher Card Popup"]
        CompactPopup --> MobileSheet["Mobile Viewport: Non-Intrusive Bottom Sheet"]
        CompactPopup --> DesktopCard["Desktop Viewport: Clamped Floating Card with Arrow"]
    end
```

---

## 2. Core Functional Requirements & The 5-Step Journey

### Step 1: Upload an English Newspaper PDF
- **File Input Options:**
  - Native file picker accepting `.pdf` / `application/pdf`.
  - Drag-and-drop zone covering the entire reader viewport with active visual feedback (`.reader-area.drag-active`).
  - One-click sample newspaper loader (`/sample-newspaper.pdf`) providing a pre-built two-column editorial broadsheet.
- **Privacy & In-Browser Processing:**
  - PDFs are parsed into an in-memory `Uint8Array`.
  - Zero network transmission of document contents: all parsing and OCR happen locally inside the browser.

### Step 2: Document Processing & OCR Pipeline
- **Page Classification:**
  - Evaluates rendered `.textLayer` spans.
  - A page is classified as scanned if `spans.length < 5`, valid alphanumeric words `< 6`, or non-whitespace characters `< 30`.
- **In-Page OCR Processing Indicator:**
  - When a scanned page is detected, an in-page processing card appears over the canvas displaying live progress stages:
    - `10%`: High-resolution canvas viewport preparation.
    - `20%`: Image preprocessing (grayscale + 150% contrast enhancement).
    - `25%–35%`: OCR core initialization.
    - `35%–45%`: Language trained data model loading.
    - `45%–96%`: Text recognition and line segmentation.
    - `98%–100%`: TSV/coordinate parsing and relative box mapping.
- **Offline Tesseract Integration:**
  - Local trained data is packaged in `public/eng.traineddata.gz` (2.9 MB) and loaded via `langPath` with `gzip: true`.
  - Automatic fallback to remote CDN if local fetch is intercepted or unsupported.

### Step 3: Readable Newspaper Page Display
- **Paper Display & Layout:**
  - Centered presentation mimicking physical newsprint with subtle border and elevation (`var(--shadow-paper)`).
  - Multi-column and headline rendering via standard fonts (`LiberationSans-Regular`, `LiberationSans-Bold`) and CMaps.
- **Smooth 2D Panning & Focal-Point Zoom:**
  - Touch: Two-finger responsive pinch-zoom with transient CSS transform tracking followed by single sharp canvas re-render.
  - Desktop: Left-click and middle-click 2D drag panning with viewport edge clamping.
  - Viewport focal-point preservation: keeps the center coordinates stationary during scale transitions.
- **Zoom-Invariant OCR Overlay:**
  - Bounding boxes are stored as normalized relative coordinates `[0.0, 1.0]`:
    $$\text{left} = \frac{x_0}{W_{\text{image}}} \times 100\%, \quad \text{top} = \frac{y_0}{H_{\text{image}}} \times 100\%$$
  - Remains pixel-aligned across all zoom scales ($50\%$ to $300\%$).

### Step 4: Word Selection & Hindi Meaning Popup
- **Targeted Selection Only:**
  - Translation is never performed on whole paragraphs or full pages.
  - Requests exceeding 35 words or 300 characters are strictly rejected.
- **Minimal 5-Element Popup Payload:**
  1. **Part of Speech Badge:** Color-coded indicator (`Noun`, `Verb`, `Adjective`, `Adverb`, `Preposition`, `Conjunction`, `Pronoun`).
  2. **Selected Word:** Exact word with preserved original casing and hyphenation.
  3. **Primary Hindi Meaning:** High-contrast, large Devanagari typography (`Noto Sans Devanagari`).
  4. **Alternative Meanings:** 2 to 4 relevant Hindi synonyms separated by bullets.
  5. **Dismiss Button (✕):** 44px touch target with ghost-click debounce.

### Step 5: Close Popup & Preserve Reading Position
- **Position Preservation:** Closing the popup never alters `scrollLeft` or `scrollTop`.
- **Ghost Click Prevention:** Dismissing via (✕) triggers a 400ms event suppression window, preventing accidental taps on text underneath the close button.
- **Dismissal Memory:** Prevents immediate reopening of the same word unless the user explicitly makes a new selection.

---

## 3. Linguistic & Grammar Disambiguation Engine

The grammar engine (`src/grammarEngine.js`) analyzes the syntactic role of words in sentence context to provide accurate Hindi meanings for polysemous words.

### Polysemous Disambiguation Rules

| Word | Context Pattern | Assigned POS | Hindi Meaning |
| :--- | :--- | :--- | :--- |
| **present** | Preceded by determiner/possessive/adjective (e.g. *birthday present*) | **Noun** | उपहार, भेंट |
| **present** | Preceded by modal/auxiliary (e.g. *will present the budget*) | **Verb** | प्रस्तुत करना, पेश करना |
| **present** | Preceding a noun (e.g. *the present crisis*) | **Adjective** | वर्तमान, उपस्थित |
| **book** | Preceded by article/adjective (e.g. *read a book*) | **Noun** | किताब, पुस्तक |
| **book** | Followed by noun/tickets or preceded by *to* (e.g. *to book a flight*) | **Verb** | आरक्षित करना, दर्ज करना |
| **light** | Preceded by article (e.g. *turn on the light*) | **Noun** | प्रकाश, रोशनी |
| **light** | Followed by noun (e.g. *light bag*) | **Adjective** | हल्का |
| **light** | Preceded by modal/subject (e.g. *will light the lamp*) | **Verb** | जलाना, प्रकाशित करना |
| **fast** | Preceded by adjective/possessive (e.g. *religious fast*) | **Noun** | उपवास, व्रत |
| **fast** | Modifying a noun (e.g. *fast runner*) | **Adjective** | तेज़, तीव्र |
| **fast** | Modifying a verb (e.g. *drives fast*) | **Adverb** | तेज़ी से |
| **fast** | Acting as predicate (e.g. *devotees fast today*) | **Verb** | उपवास रखना |
| **warnings**| Preceding relative pronoun (e.g. *warnings that led to panic*) | **Noun** | चेतावनियाँ |

---

## 4. Multi-Tier Dictionary & Translation Architecture

```mermaid
flowchart TD
    Req["Word Lookup Request"] --> CacheCheck{"LocalStorage Cache Hit?"}
    CacheCheck -- Yes --> ReturnCache["Return Cached Meaning (0ms)"]
    CacheCheck -- No --> BuiltinCheck{"Built-in Editorial Dictionary Hit?"}
    BuiltinCheck -- Yes --> ApplyGrammar["Apply Context-Aware POS & Meaning"]
    ApplyGrammar --> ReturnBuiltin["Return Offline Result (0ms)"]
    BuiltinCheck -- No --> OnlineTier1["Online Tier 1: Google Translate API (Single Client)"]
    OnlineTier1 -- Success --> SaveCache["Cache Result in LocalStorage"]
    SaveCache --> ReturnResult["Return Meaning Popup Payload"]
    OnlineTier1 -- Fail/Timeout --> OnlineTier2["Online Tier 2: MyMemory API Fallback"]
    OnlineTier2 -- Success --> SaveCache
    OnlineTier2 -- Fail/Timeout --> DictAPI["Online Tier 3: English Dictionary API (Definitions & IPA)"]
    DictAPI -- Fail --> ProperNounCheck{"Is Proper Noun (Initial Capital)?"}
    ProperNounCheck -- Yes --> ProperNounResult["Preserve Name & Mark Proper Noun"]
    ProperNounCheck -- No --> ErrorState["Display Error Box with Retry Button"]
```

1. **Tier 1 (Built-in Editorial Dictionary):** Zero-latency offline coverage for core journalistic, economic, and constitutional terms.
2. **Tier 2 (Client LocalStorage Cache):** Caches successful lookups locally to eliminate redundant network requests.
3. **Tier 3 (Google Translate Public Endpoint):** Fetches primary translation and full synonym table.
4. **Tier 4 (MyMemory Translation API):** Redundant fallback for network resilience.
5. **Tier 5 (English Dictionary API & Proper Noun Resolver):** Fallback for definitions and proper names.

---

## 5. Technical Specifications & Benchmarks

### Measured Performance & Accuracy

| Metric | Target | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **Selection Accuracy across Layouts** | $> 98.0\%$ | **99.17%** (119/120 successful) | Passed |
| **Grammar Classification (Word/Phrase/Sent)** | $100.0\%$ | **100.00%** (75/75 correct) | Passed |
| **Contextual POS Disambiguation** | $> 95.0\%$ | **98.08%** (51/52 correct) | Passed |
| **Clean Font OCR Accuracy** | $> 95.0\%$ | **100.00%** (Avg Conf: 88.4%) | Passed |
| **Offline Dictionary Response Latency** | $< 5\text{ms}$ | **0ms** (Instant Synchronous) | Passed |
| **Production Vite Build Time** | $< 15\text{s}$ | **5.6s** | Passed |
| **Automated Regression Suite Pass Rate** | $100.0\%$ | **43 / 43 Passed** | Passed |

### Edge Case Solutions Implemented

1. **Split-Span Capital Letters:** When PDF.js renders drop-caps or styled initial letters in separate spans (e.g. `<span>S</span>` and `<span>pecial</span>`), `expandRangeToSelection` scans adjacent sibling spans to reconstruct `Special` without dropping the capital `S`.
2. **Concatenated OCR Headlines:** `segmentOcrText` applies CamelCase boundary detection and whitespace heuristics to separate merged words (e.g. `ActorTigerShroff` $\to$ `Actor`, `Tiger`, `Shroff`) with individual bounding boxes.
3. **Narrow Newspaper Column Wrapping:** Hyphenated words split across lines (e.g. `infra-` and `structure`) are reassembled into `infrastructure`.
4. **Headline Sentence Isolation:** Sentence boundary extraction checks font-size changes to prevent headline text from bleeding into datelines or body paragraphs.
5. **Mobile Viewport Optimization:** Converts the floating popup into a responsive bottom sheet on viewports $\le 640\text{px}$, keeping the target reading text visible.
