import React, { useCallback, useRef, useState } from "react";
import { Page } from "react-pdf";
import { LoaderCircle } from "lucide-react";

/**
 * Isolated & Memoized PDF Page Paper Component
 *
 * Implements double-buffering: retains the previously rendered sharp canvas
 * until a replacement render completes, completely eliminating white/blank
 * screen flashes during zoom and page changes.
 *
 * Strictly decoupled from dictionary, search, and popup state so text selection
 * and translation lookups NEVER cause the PDF canvas or textLayer to re-render.
 */
function PdfPagePaperImpl({
  pageNumber,
  scale,
  baseWidth,
  pdfCanvasRef,
  onTextLayerRenderSuccess,
  onPageRenderSuccess,
  isScannedPage,
  ocrBusy,
  ocrProgress,
  ocrWords,
  showOcrBoxes,
  activeSelectedText,
  pagePaperRef
}) {
  const backupCanvasRef = useRef(null);
  const [hasBackup, setHasBackup] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  // When a new render finishes, copy canvas to backup buffer
  const handleRenderSuccess = useCallback(
    (pageObj) => {
      setIsRendering(false);
      try {
        const src = pdfCanvasRef?.current;
        const backup = backupCanvasRef?.current;
        if (src && backup && src.width > 0 && src.height > 0) {
          backup.width = src.width;
          backup.height = src.height;
          const ctx = backup.getContext("2d");
          if (ctx) {
            ctx.drawImage(src, 0, 0);
            setHasBackup(true);
          }
        }
      } catch (e) {
        console.warn("Canvas double-buffering sync warning:", e);
      }
      if (onPageRenderSuccess) {
        onPageRenderSuccess(pageObj);
      }
    },
    [pdfCanvasRef, onPageRenderSuccess]
  );

  return (
    <div className="page-paper" ref={pagePaperRef}>
      {/* Double-buffered backup canvas: keeps previous image visible during render transitions */}
      <canvas
        ref={backupCanvasRef}
        className="pdf-backup-canvas"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          display: hasBackup && isRendering ? "block" : "none",
          zIndex: 1
        }}
        aria-hidden="true"
      />

      <Page
        pageNumber={pageNumber}
        scale={scale}
        width={baseWidth}
        renderTextLayer={true}
        renderAnnotationLayer={true}
        canvasRef={pdfCanvasRef}
        onRenderSuccess={handleRenderSuccess}
        onRenderTextLayerSuccess={onTextLayerRenderSuccess}
        loading={
          <div className="page-loading-state" style={{ opacity: hasBackup ? 0 : 1 }}>
            <LoaderCircle size={22} className="spin" />
            <span>पेज {pageNumber} लोड हो रहा है…</span>
          </div>
        }
      />

      {/* Scanned PDF In-Page OCR Processing Indicator */}
      {isScannedPage && ocrBusy && (
        <div className="ocr-processing-overlay" aria-live="polite">
          <div className="ocr-processing-card">
            <div className="ocr-spinner">
              <LoaderCircle size={38} className="spin" />
            </div>
            <h3 className="ocr-processing-title">स्कैन किया गया पेज प्रोसेस हो रहा है…</h3>
            <p className="ocr-processing-sub">
              Processing scanned newspaper with OCR ({ocrProgress}%)
            </p>
            <div className="ocr-progress-track">
              <div
                className="ocr-progress-fill"
                style={{ width: `${Math.max(8, ocrProgress)}%` }}
              />
            </div>
            <span className="ocr-processing-tip">
              टेक्स्ट पहचान पूर्ण होते ही आप किसी भी शब्द या वाक्य पर टैप करके अर्थ देख सकेंगे।
            </span>
          </div>
        </div>
      )}

      {/* Scanned PDF interactive transparent selectable OCR layer */}
      {isScannedPage && ocrWords.length > 0 && showOcrBoxes && (
        <div className="ocr-overlay" aria-label="Interactive OCR selectable words">
          {ocrWords.map((item, idx) => {
            const leftPct = (item.relBox.x0 * 100).toFixed(3);
            const topPct = (item.relBox.y0 * 100).toFixed(3);
            const widthPct = Math.max(0.1, (item.relBox.x1 - item.relBox.x0) * 100).toFixed(3);
            const heightPct = Math.max(0.1, (item.relBox.y1 - item.relBox.y0) * 100).toFixed(3);
            const isActive = activeSelectedText
              ? item.clean?.toLowerCase() === activeSelectedText.toLowerCase()
              : false;

            return (
              <span
                key={`${item.clean}-${idx}`}
                className={`ocr-word-span ${isActive ? "active" : ""}`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`
                }}
                data-word={item.clean}
                data-idx={idx}
                data-conf={Math.round(item.confidence || 0)}
                title={`“${item.clean}” (OCR: ${Math.round(item.confidence || 0)}%) — Click for meaning or drag to select`}
              >
                {item.text}{" "}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Custom memo comparator: only re-render if PDF presentation properties genuinely change
export const PdfPagePaper = React.memo(PdfPagePaperImpl, (prev, next) => {
  return (
    prev.pageNumber === next.pageNumber &&
    prev.scale === next.scale &&
    prev.baseWidth === next.baseWidth &&
    prev.isScannedPage === next.isScannedPage &&
    prev.ocrBusy === next.ocrBusy &&
    prev.ocrProgress === next.ocrProgress &&
    prev.showOcrBoxes === next.showOcrBoxes &&
    prev.activeSelectedText === next.activeSelectedText &&
    prev.ocrWords === next.ocrWords
  );
});

export default PdfPagePaper;
