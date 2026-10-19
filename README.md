# ReadHindi

A mobile-first React PDF reader prototype inspired by the supplied reference image.

## Run locally
1. Install Node.js 20+.
2. Extract this folder.
3. Run `npm install`
4. Run `npm run dev`
5. Open the local URL Vite prints.

## Included
- Upload and render local PDF files in-browser with PDF.js via `react-pdf`
- Page navigation, zoom, search-panel entry point and full-screen control
- Select a single English word in the PDF text layer to open the floating Hindi meaning popup
- Built-in no-key Hindi meanings for common vocabulary, with free online translation/dictionary fallbacks
- Text-to-speech pronunciation
- OCR action for scanned PDFs (uses Tesseract.js and needs an internet connection to load OCR language data)

## Notes
- PDF files are rendered locally; the app does not upload the PDF.
- Online fallback lookups send only the selected word to external dictionary/translation endpoints.
- OCR currently lists recognized words in a tap-to-lookup word list; word boxes are not yet overlaid on the scanned PDF itself.
- Browser selection can vary across mobile browsers. Desktop mouse selection and mobile text selection are supported where the PDF text layer exposes selectable text.

# docs-translate
