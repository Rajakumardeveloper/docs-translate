# ReadHindi

> **Product Vision:** Make English newspapers easier to understand for Hindi-speaking students, one word at a time.

A modern, mobile-first newspaper PDF reader built to help students read English newspapers naturally and build vocabulary with instant, distraction-free Hindi meanings.

## Simple 5-Step User Journey

1. **Upload an English Newspaper PDF:** Upload any local newspaper PDF (supports both text-based and scanned image broadsheets) via file picker, drag-and-drop, or test immediately using the built-in sample newspaper.
2. **Process Document Using OCR When Required:** Automatically detects scanned pages with fine 8pt–9pt newsprint, pre-processes the canvas, and extracts words using high-resolution OCR with local offline language data (`eng.traineddata.gz`).
3. **Display Readable Newspaper Pages:** Enjoy smooth two-finger pinch zoom, focal-point preservation, and desktop/touch 2D panning across wide newspaper broadsheets. Scanned pages overlay interactive, transparent, zoom-invariant word bounding boxes.
4. **Select Any Word for Meaning & Part of Speech:** Tap or select any word to open a compact popup (or mobile bottom sheet) displaying its Part of Speech (Noun, Verb, Adjective, etc.), exact capitalized word, primary Hindi meaning, and dictionary alternatives.
5. **Close & Continue Reading:** Tap `✕` or anywhere outside to dismiss the popup and continue reading from the exact same position without page jumping.

## Key Features

- **Mobile-First Responsive Design:** Sleek bottom sheet on mobile screens (≤640px) that never covers the line being read, and clamped floating cards on desktop.
- **Context-Aware Grammar Engine:** Disambiguates polysemous words (e.g. *present* as Noun vs. Verb vs. Adjective; *warnings* before relative clauses) by analyzing surrounding sentence context.
- **No Full-Page Translation:** Preserves reading immersion by only translating words selected by the user.
- **100% Client-Side & Private:** All PDF rendering and OCR are processed locally in your browser. PDFs are never uploaded to any remote server.
- **Offline Editorial Dictionary:** Hundreds of national affairs, constitutional, and economic terms resolve instantly with 0ms latency, backed by free fallback lookups.

## Getting Started

### Prerequisites
- Node.js 20+

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Run Regression Test Suite (43 Tests)
```bash
npm test
```

### Run Accuracy & Performance Benchmarks
```bash
npm run benchmark
```
