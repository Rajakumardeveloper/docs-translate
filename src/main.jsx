import React from "react";
import { createRoot } from "react-dom/client";
import { pdfjs } from "react-pdf";
import App from "./App.jsx";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "./styles.css";

// Configure local matched worker
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
