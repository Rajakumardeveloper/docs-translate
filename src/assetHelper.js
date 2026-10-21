/**
 * ReadHindi Asset URL Resolver
 *
 * Resolves static public assets (PDF.js worker, CMaps, standard fonts,
 * Tesseract traineddata, sample broadsheet PDF) across any hosting environment:
 * - Local dev server (http://localhost:5173/)
 * - Production root domain (https://example.com/)
 * - GitHub Pages subpath (https://username.github.io/repo/)
 * - Local preview server (http://localhost:4173/)
 * - Direct file:// protocol inspection
 *
 * Never throws an unhandled exception or crashes the React root.
 */
export function getPublicAssetUrl(relativePath) {
  if (typeof window === "undefined" || !window.location) {
    return relativePath;
  }

  const clean = String(relativePath || "").replace(/^\/+/, "");

  // 1. Try resolving against window.location.href (handles subpaths and index.html safely)
  try {
    const href = window.location.href;
    if (href && href !== "about:blank") {
      // In URL resolution, if base ends with a filename like /index.html,
      // resolving 'file.ext' against it replaces 'index.html' with 'file.ext'.
      // If relativePath ends with a slash (like cmaps/), it forms the correct directory path.
      return new URL(clean, href).href;
    }
  } catch {
    // Continue to fallback
  }

  // 2. Try resolving against origin + pathname directory
  try {
    const origin = window.location.origin && window.location.origin !== "null" ? window.location.origin : "";
    let pathname = window.location.pathname || "/";
    if (!pathname.endsWith("/")) {
      const lastSlash = pathname.lastIndexOf("/");
      pathname = lastSlash >= 0 ? pathname.slice(0, lastSlash + 1) : "/";
    }
    const base = origin ? `${origin}${pathname}` : (typeof document !== "undefined" && document.baseURI) || "/";
    return new URL(clean, base).href;
  } catch {
    // Continue to fallback
  }

  // 3. Fallback to clean relative path
  return clean || "./";
}
