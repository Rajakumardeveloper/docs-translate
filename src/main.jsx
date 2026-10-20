import React from "react";
import { createRoot } from "react-dom/client";
import { pdfjs } from "react-pdf";
import App from "./App.jsx";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "./styles.css";

// Robust helper to resolve asset URLs on any public domain or repository subpath
export function getPublicAssetUrl(relativePath) {
  if (typeof window === "undefined") return relativePath;
  const clean = relativePath.replace(/^\/+/, "");
  let pathname = window.location.pathname;
  if (!pathname.endsWith("/")) {
    pathname += "/";
  }
  return new URL(clean, window.location.origin + pathname).href;
}

// Configure local matched worker compatible with any public URL
pdfjs.GlobalWorkerOptions.workerSrc = getPublicAssetUrl("pdf.worker.min.mjs");

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
