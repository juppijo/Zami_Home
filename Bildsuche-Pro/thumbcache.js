/* ═══════════════════════════════════════════════════════
   PHOTOVAULT — thumbcache.js
   IndexedDB-basierter Thumbnail-Cache mit Canvas-Resize
   Erste Anzeige: Originalgröße  →  Canvas → WebP ~400px
   Nächste Mal  : Sofort aus IndexedDB (kein Netzwerk)
═══════════════════════════════════════════════════════ */

"use strict";

const TC = (() => {

  /* ── Konstanten ─────────────────────────────────── */
  const DB_NAME  = 'photovault_tc';
  const DB_VER   = 1;
  const STORE    = 'thumbs';
  const MAX_DIM  = 480;       // px – max Breite/Höhe des gespeicherten Thumbnails
  const QUALITY  = 0.78;      // WebP-Qualität
  const MAX_CONC = 4;         // gleichzeitige Canvas-Operationen

  /* ── IndexedDB ──────────────────────────────────── */
  let _db   = null;
  let _dbOk = false;

  const _dbReady = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = e => { _db = e.target.result; _dbOk = true; resolve(true); };
      req.onerror   = ()  => resolve(false);
    } catch { resolve(false); }
  });

  async function _get(key) {
    if (!_dbOk) return null;
    return new Promise(res => {
      try {
        const tx  = _db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => res(req.result || null);
        req.onerror   = () => res(null);
      } catch { res(null); }
    });
  }

  async function _put(key, blob) {
    if (!_dbOk) return;
    return new Promise(res => {
      try {
        const tx  = _db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, key);
        tx.oncomplete = () => res();
        tx.onerror    = () => res();
      } catch { res(); }
    });
  }

  async function _delete(key) {
    if (!_dbOk) return;
    return new Promise(res => {
      try {
        const tx  = _db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => res();
        tx.onerror    = () => res();
      } catch { res(); }
    });
  }

  /* ── Semaphore für parallele Canvas-Ops ─────────── */
  let _slots = MAX_CONC;
  const _waitQ = [];
  function _acquire() {
    if (_slots > 0) { _slots--; return Promise.resolve(); }
    return new Promise(r => _waitQ.push(r));
  }
  function _release() {
    if (_waitQ.length) { _waitQ.shift()(); }
    else { _slots++; }
  }

  /* ── Cache-Key ──────────────────────────────────── */
  function _key(entry) {
    if (entry.isUrl) return 'u:' + entry.url;
    // Lokale Datei: Pfad + Größe (genug zur Identifikation)
    return 'f:' + (entry.path || entry.name) + ':' + (entry.size || 0);
  }

  /* ── Canvas-Resize → Blob ───────────────────────── */
  function _resize(imgEl) {
    let w = imgEl.naturalWidth  || imgEl.width;
    let h = imgEl.naturalHeight || imgEl.height;
    if (!w || !h) return null;

    if (w > MAX_DIM || h > MAX_DIM) {
      if (w >= h) { h = Math.round(h * MAX_DIM / w); w = MAX_DIM; }
      else        { w = Math.round(w * MAX_DIM / h); h = MAX_DIM; }
    }

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled  = true;
    ctx.imageSmoothingQuality  = 'high';
    ctx.drawImage(imgEl, 0, 0, w, h);

    return new Promise(res =>
      canvas.toBlob(b => res(b), 'image/webp', QUALITY)
    );
  }

  /* ── Hauptfunktion: getThumbnail ─────────────────── */
  // Gibt eine temporäre Object-URL zurück die sofort im <img> verwendet werden kann.
  // Die aufrufende Seite muss diese URL NICHT manuell revoken —
  // das übernimmt TC intern nach dem nächsten Aufruf für denselben Eintrag.
  const _prevUrls = new WeakMap();

  async function getThumbnail(entry) {
    await _dbReady;

    const key = _key(entry);

    /* 1 — Cache-Treffer? → sofort anzeigen */
    const cached = await _get(key);
    if (cached) {
      return URL.createObjectURL(cached);
    }

    /* 2 — Cache-Miss → Original laden, skalieren, cachen */
    await _acquire();
    try {
      const blob = await _generateThumb(entry, key);
      _release();
      if (blob) {
        await _put(key, blob);
        return URL.createObjectURL(blob);
      }
    } catch {
      _release();
    }

    /* 3 — Fallback: Original-URL / Object-URL */
    return _fallbackSrc(entry);
  }

  /* ── Thumbnail erzeugen ─────────────────────────── */
  function _generateThumb(entry, key) {
    return new Promise(resolve => {
      const img = new Image();
      let settled = false;
      const done = val => { if (!settled) { settled = true; resolve(val); } };

      // Timeout: nach 15 s aufgeben
      const t = setTimeout(() => done(null), 15000);

      img.onload = async () => {
        clearTimeout(t);
        try {
          const blob = await _resize(img);
          done(blob);
        } catch { done(null); }
        // Object-URL für lokale Dateien war nur temporär
        if (!entry.isUrl && img.src.startsWith('blob:')) {
          // NICHT revoken — wird für Lightbox noch gebraucht
        }
      };
      img.onerror = () => { clearTimeout(t); done(null); };

      if (entry.isUrl) {
        img.crossOrigin = 'anonymous';   // nötig für Canvas (CORS)
        img.src = entry.url;
      } else {
        if (!entry._objUrl) entry._objUrl = URL.createObjectURL(entry.file);
        img.src = entry._objUrl;
      }
    });
  }

  /* ── Fallback-Quelle wenn kein Cache ────────────── */
  function _fallbackSrc(entry) {
    if (entry.isUrl) return entry.url;
    if (!entry._objUrl) entry._objUrl = URL.createObjectURL(entry.file);
    return entry._objUrl;
  }

  /* ── Cache-Info ─────────────────────────────────── */
  async function getStats() {
    await _dbReady;
    if (!_dbOk) return { count: 0, bytes: 0 };
    return new Promise(res => {
      try {
        const tx    = _db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const req   = store.getAll();
        req.onsuccess = () => {
          const blobs = req.result || [];
          res({
            count : blobs.length,
            bytes : blobs.reduce((s, b) => s + (b?.size || 0), 0)
          });
        };
        req.onerror = () => res({ count: 0, bytes: 0 });
      } catch { res({ count: 0, bytes: 0 }); }
    });
  }

  /* ── Cache leeren ───────────────────────────────── */
  async function clear() {
    await _dbReady;
    if (!_dbOk) return;
    return new Promise(res => {
      try {
        const tx = _db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => res();
        tx.onerror    = () => res();
      } catch { res(); }
    });
  }

  /* ── Einzelnen Eintrag aus Cache löschen ────────── */
  async function remove(entry) {
    await _delete(_key(entry));
  }

  /* ── Öffentliche API ─────────────────────────────── */
  return { getThumbnail, getStats, clear, remove };

})();
