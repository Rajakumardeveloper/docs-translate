// ReadHindi IndexedDB & In-Memory Persistent OCR Storage
// Persists scanned newspaper OCR text, relative coordinates, and word metadata
// Enables instant zero-wait retrieval across page navigation, zoom, and browser reloads

const DB_NAME = "readhindi_ocr_cache_v1";
const DB_VERSION = 1;
const STORE_NAME = "page_ocr_records";

// In-memory fallback for test environments (Node.js) or when IndexedDB is restricted
const memoryCache = new Map();

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
          store.createIndex("docId", "docId", { unique: false });
        }
      };

      request.onsuccess = (e) => {
        resolve(e.target.result);
      };

      request.onerror = (e) => {
        console.warn("IndexedDB open error, using memory fallback:", e);
        resolve(null);
      };
    } catch (err) {
      console.warn("IndexedDB initialization exception, using memory fallback:", err);
      resolve(null);
    }
  });
}

function buildKey(docId, pageNumber) {
  const safeDoc = (docId || "default_doc").replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safeDoc}_p${pageNumber}`;
}

/**
 * Retrieve cached OCR words and coordinates for a given document and page
 * @param {string} docId - Document fingerprint or filename
 * @param {number} pageNumber - Page index (1-based)
 * @returns {Promise<Array|null>} Array of OCR words or null if not cached
 */
export async function getCachedOcrWords(docId, pageNumber) {
  const key = buildKey(docId, pageNumber);

  // Check memory cache first (instant)
  if (memoryCache.has(key)) {
    return memoryCache.get(key);
  }

  const db = await openDatabase();
  if (!db) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_NAME], "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);

      req.onsuccess = (e) => {
        const record = e.target.result;
        if (record && Array.isArray(record.words)) {
          // Populate memory cache for subsequent instant synchronous lookups
          memoryCache.set(key, record.words);
          resolve(record.words);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persist OCR words and coordinates for a given document and page
 * @param {string} docId - Document fingerprint or filename
 * @param {number} pageNumber - Page index (1-based)
 * @param {Array} words - Array of parsed OCR words
 * @param {Object} [metadata={}] - Optional metadata (imageW, imageH, etc.)
 */
export async function setCachedOcrWords(docId, pageNumber, words, metadata = {}) {
  if (!words || !Array.isArray(words)) return;
  const key = buildKey(docId, pageNumber);

  // Always keep in memory cache
  memoryCache.set(key, words);

  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_NAME], "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const record = {
        key,
        docId: docId || "default_doc",
        pageNumber,
        words,
        metadata,
        updatedAt: Date.now()
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Check if a page is already cached (synchronous check in memory, or async in IDB)
 */
export function hasMemoryCachedOcr(docId, pageNumber) {
  const key = buildKey(docId, pageNumber);
  return memoryCache.has(key);
}

/**
 * Clear cache for a specific document or entire storage
 */
export async function clearOcrCache(docId = null) {
  if (docId) {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith(`${docId}_`)) {
        memoryCache.delete(key);
      }
    }
  } else {
    memoryCache.clear();
  }

  const db = await openDatabase();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_NAME], "readwrite");
      const store = tx.objectStore(STORE_NAME);
      if (docId) {
        const index = store.index("docId");
        const req = index.openKeyCursor(IDBKeyRange.only(docId));
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            store.delete(cursor.primaryKey);
            cursor.continue();
          } else {
            resolve(true);
          }
        };
        req.onerror = () => resolve(false);
      } else {
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      }
    } catch {
      resolve(false);
    }
  });
}
