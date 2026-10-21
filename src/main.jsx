import React from "react";
import { createRoot } from "react-dom/client";
import { pdfjs } from "react-pdf";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { getPublicAssetUrl } from "./assetHelper.js";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "./styles.css";

// Configure local matched worker compatible with any public URL
pdfjs.GlobalWorkerOptions.workerSrc = getPublicAssetUrl("pdf.worker.min.mjs");

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
