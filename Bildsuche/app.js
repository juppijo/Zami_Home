/* ═══════════════════════════════════════════════════════
   PHOTOVAULT — app.js  v2
   Lokale Ordner · HTTP-URL · Alle Bildformate · Rekursiv
═══════════════════════════════════════════════════════ */

"use strict";

/* ── DOM-Refs ─────────────────────────────────────── */
const $ = id => document.getElementById(id);

const dirInput         = $('dirInput');
const dirList          = $('dirList');
const dirCount         = $('dirCount');
const searchInput      = $('searchInput');
const searchClear      = $('searchClear');
const thumbGrid        = $('thumbGrid');
const welcome          = $('welcome');
const emptyDir         = $('emptyDir');
const toolbar          = $('toolbar');
const breadcrumb       = $('breadcrumb');
const imgCount         = $('imgCount');
const sizeSlider       = $('sizeSlider');
const themeToggle      = $('themeToggle');
const themeIconDark    = $('themeIconDark');
const themeIconLight   = $('themeIconLight');
const fullscreenBtn    = $('fullscreenBtn');
const fsExpand         = $('fsExpand');
const fsCompress       = $('fsCompress');
const sidebarToggleBtn = $('sidebarToggleBtn');
const sidebar          = $('sidebar');
const urlOpenBtn       = $('urlOpenBtn');
const urlModal         = $('urlModal');
const urlModalBackdrop = $('urlModalBackdrop');
const urlModalClose    = $('urlModalClose');
const urlInput         = $('urlInput');
const urlLoadBtn       = $('urlLoadBtn');
const urlRecents       = $('urlRecents');
const urlProgress      = $('urlProgress');
const urlProgressFill  = $('urlProgressFill');
const urlProgressText  = $('urlProgressText');
const urlError         = $('urlError');
const welcomeUrlBtn    = $('welcomeUrlBtn');
const lightbox         = $('lightbox');
const lbBackdrop       = $('lbBackdrop');
const lbImg            = $('lbImg');
const lbClose          = $('lbClose');
const lbPrev           = $('lbPrev');
const lbNext           = $('lbNext');
const lbFname          = $('lbFname');
const lbFpath          = $('lbFpath');
const lbFsize          = $('lbFsize');
const lbCounter        = $('lbCounter');
const lbNoteInput      = $('lbNoteInput');
const noteSaveBtn      = $('noteSaveBtn');
const noteSaved        = $('noteSaved');
const toast            = $('toast');

/* ── Bildformate ──────────────────────────────────── */
// Alle gängigen Formate – Regex für Dateiendungen
const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp|tiff?|svg|ico|avif|heic|heif|raw|cr2|cr3|nef|arw|dng|orf|rw2|pef|srw|x3f|jxl|jp2|j2k|tga|psd|xcf|hdr|exr|apng|mng|wbmp|cur)$/i;

// Welche Formate Browser nativ darstellen können
const BROWSER_NATIVE = /\.(jpe?g|png|gif|webp|bmp|svg|ico|avif|apng)$/i;

/* ── State ────────────────────────────────────────── */
let dirMap      = new Map();   // dirPath → [{name, url, size, isUrl, file?}]
let dirTree     = [];          // [{path, label, depth, count, isUrl}]
let activeDir   = null;
let currentList = [];          // aktuell angezeigte Einträge
let lbIndex     = 0;
let notes       = {};          // { key: noteText }
let mode        = 'local';     // 'local' | 'url'
let baseUrl     = '';          // z.B. http://192.168.1.20/data/Bilder/

/* ── Init ─────────────────────────────────────────── */
loadTheme();
loadNotes();
restoreThumbSize();

/* ════════════════════════════════════════════════════
   LOKALE DATEIEN
═════════════════════════════════════════════════════ */
dirInput.addEventListener('change', e => {
  const files = Array.from(e.target.files).filter(f => IMAGE_EXTS.test(f.name));
  if (!files.length) { showToast('Keine Bilder gefunden.'); return; }
  loadLocalFiles(files);
  dirInput.value = '';
});

function loadLocalFiles(files) {
  mode = 'local';
  baseUrl = '';
  dirMap.clear();

  for (const file of files) {
    const rel   = file.webkitRelativePath || file.name;
    const parts = rel.split('/');
    const dirPath = parts.length > 1
      ? parts.slice(0, -1).join('/')
      : '(Wurzel)';

    if (!dirMap.has(dirPath)) dirMap.set(dirPath, []);
    dirMap.get(dirPath).push({
      name  : file.name,
      url   : null,          // wird lazy per createObjectURL erzeugt
      file  : file,
      size  : file.size,
      path  : rel,
      isUrl : false
    });
  }

  const sorted = [...dirMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  dirMap = new Map(sorted);

  buildTree();
  renderSidebar();

  const first = dirTree[0]?.path;
  if (first) selectDir(first);

  const total = files.length;
  showToast(`${total} Bild${total === 1 ? '' : 'er'} in ${dirMap.size} Verzeichnis${dirMap.size === 1 ? '' : 'sen'} geladen.`);
}

/* ════════════════════════════════════════════════════
   URL-LADEN (Apache / Nginx directory listing)
═════════════════════════════════════════════════════ */

/* ── Modal öffnen / schließen ── */
function openUrlModal()  { urlModal.classList.add('open'); renderRecents(); urlInput.focus(); }
function closeUrlModal() { urlModal.classList.remove('open'); }

urlOpenBtn.addEventListener('click', openUrlModal);
welcomeUrlBtn.addEventListener('click', openUrlModal);
urlModalClose.addEventListener('click', closeUrlModal);
urlModalBackdrop.addEventListener('click', closeUrlModal);

urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') startUrlLoad(); });
urlLoadBtn.addEventListener('click', startUrlLoad);

/* ── URL-Laden Hauptfunktion ── */
async function startUrlLoad() {
  let url = urlInput.value.trim();
  if (!url) return;
  if (!url.endsWith('/')) url += '/';
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;

  urlError.style.display    = 'none';
  urlProgress.style.display = 'flex';
  urlProgressFill.style.width = '5%';
  urlProgressText.textContent = 'Verbinde …';
  urlLoadBtn.disabled = true;

  try {
    mode    = 'url';
    baseUrl = url;
    dirMap.clear();

    const visited = new Set();   // ← verhindert Doppel-Requests
    setProgress(10, `Lese: ${url}`);
    await fetchDirRecursive(url, url, 0, visited);
    setProgress(95, 'Verzeichnisstruktur aufgebaut …');

    if (dirMap.size === 0) {
      throw new Error('Keine Bilder gefunden. Bitte URL und CORS-Einstellungen prüfen.');
    }

    saveRecent(url);
    buildTree();
    renderSidebar();
    closeUrlModal();

    const first = dirTree[0]?.path;
    if (first) selectDir(first);

    const total = [...dirMap.values()].reduce((s, a) => s + a.length, 0);
    showToast(`${total} Bild${total === 1 ? '' : 'er'} von ${url} geladen.`);
    setProgress(100, 'Fertig');

  } catch (err) {
    urlError.textContent  = `⚠ ${err.message}`;
    urlError.style.display = 'block';
    setProgress(0, '');
    urlProgress.style.display = 'none';
  } finally {
    urlLoadBtn.disabled = false;
  }
}

function setProgress(pct, text) {
  urlProgressFill.style.width  = pct + '%';
  urlProgressText.textContent  = text;
}

/* ── Rekursives Einlesen des Verzeichnis-Listings ── */
async function fetchDirRecursive(url, rootUrl, depth, visited) {
  if (depth > 10) return;                 // max. Tiefenlimit

  // URL normalisieren (trailing slash, kein Fragment/Query)
  const normUrl = normalizeUrl(url);
  if (!normUrl) return;

  // Bereits besucht? → Abbruch (verhindert Endlosschleifen & Duplikate)
  if (visited.has(normUrl)) return;
  visited.add(normUrl);

  let html;
  try {
    const res = await fetch(normUrl, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status} bei ${normUrl}`);
    html = await res.text();
  } catch (e) {
    if (depth === 0) throw e;   // Root-Fehler nach oben weiterwerfen
    return;
  }

  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');
  const links  = Array.from(doc.querySelectorAll('a[href]'));

  const subDirs = [];
  const images  = [];

  for (const a of links) {
    const raw = a.getAttribute('href');
    if (!raw) continue;

    // Query-Strings (Sortierspalten), Anker, Parent-Links überspringen
    if (raw.startsWith('?') || raw.startsWith('#') ||
        raw === '../' || raw === './' || raw === '/' ||
        raw.startsWith('javascript:')) continue;

    // Absolute URL bauen und normalisieren
    let full;
    try { full = normalizeUrl(new URL(raw, normUrl).href); }
    catch { continue; }
    if (!full) continue;

    // Strikt nur unterhalb von rootUrl erlauben
    if (!full.startsWith(rootUrl)) continue;

    // Bereits besucht?
    if (visited.has(full)) continue;

    if (full.endsWith('/')) {
      subDirs.push(full);
    } else if (IMAGE_EXTS.test(full.split('/').pop().split('?')[0])) {
      images.push(full);
    }
  }

  // Bilder dieses Verzeichnisses registrieren
  if (images.length > 0) {
    if (!dirMap.has(normUrl)) dirMap.set(normUrl, []);
    for (const imgUrl of images) {
      const fname = decodeURIComponent(imgUrl.split('/').pop().split('?')[0]);
      dirMap.get(normUrl).push({
        name  : fname,
        url   : imgUrl,
        file  : null,
        size  : null,
        path  : imgUrl,
        isUrl : true
      });
    }
  }

  // Fortschritt & Unterverzeichnisse
  const label = decodeURIComponent(normUrl.replace(rootUrl, '').replace(/\/$/, '')) || '/';
  setProgress(
    Math.min(12 + depth * 10, 88),
    `Ordner ${visited.size}: ${label}`
  );

  for (const sub of subDirs) {
    await fetchDirRecursive(sub, rootUrl, depth + 1, visited);
  }
}

/* URL normalisieren: trailing slash erzwingen bei Verzeichnissen,
   Fragment und Query entfernen */
function normalizeUrl(raw) {
  try {
    const u = new URL(raw);
    u.search = '';
    u.hash   = '';
    return u.href;
  } catch { return null; }
}

/* ── Zuletzt genutzte URLs ── */
function saveRecent(url) {
  let list = getRecents();
  list = [url, ...list.filter(u => u !== url)].slice(0, 8);
  try { localStorage.setItem('pv_recents', JSON.stringify(list)); } catch {}
  renderRecents();
}
function getRecents() {
  try { return JSON.parse(localStorage.getItem('pv_recents') || '[]'); } catch { return []; }
}
function renderRecents() {
  const list = getRecents();
  urlRecents.innerHTML = '';
  if (!list.length) return;
  const label = document.createElement('div');
  label.style.cssText = 'font-size:10px;color:var(--text-3);letter-spacing:.12em;font-weight:700;margin-bottom:2px';
  label.textContent = 'ZULETZT VERWENDET';
  urlRecents.appendChild(label);
  for (const url of list) {
    const row = document.createElement('div');
    row.className = 'url-recent-item';
    row.innerHTML = `
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" width="12" height="12" style="flex-shrink:0">
        <circle cx="8" cy="8" r="6"/><polyline points="8,4 8,8 11,10"/>
      </svg>
      <span style="overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0">${url}</span>
      <button class="url-recent-del" data-url="${url}" title="Entfernen">✕</button>
    `;
    row.addEventListener('click', e => {
      if (e.target.closest('.url-recent-del')) {
        const u = e.target.closest('.url-recent-del').dataset.url;
        const updated = getRecents().filter(x => x !== u);
        try { localStorage.setItem('pv_recents', JSON.stringify(updated)); } catch {}
        renderRecents();
      } else {
        urlInput.value = url;
      }
    });
    urlRecents.appendChild(row);
  }
}

/* ════════════════════════════════════════════════════
   VERZEICHNISBAUM
═════════════════════════════════════════════════════ */
function buildTree() {
  dirTree = [];
  for (const [path, entries] of dirMap) {
    let label, depth;
    if (mode === 'url') {
      const rel = path.replace(baseUrl, '').replace(/\/$/, '');
      const parts = rel ? rel.split('/') : [];
      label = parts.length ? parts[parts.length - 1] : decodeURIComponent(baseUrl.split('/').filter(Boolean).pop() || baseUrl);
      depth = parts.length;
    } else {
      const parts = path.split('/');
      label = parts[parts.length - 1] || path;
      depth = parts.length - 1;
    }
    dirTree.push({ path, label: decodeURIComponent(label), depth, count: entries.length, isUrl: mode === 'url' });
  }
  // Alphabetisch sortieren
  dirTree.sort((a, b) => a.path.localeCompare(b.path));
}

function renderSidebar() {
  dirList.innerHTML = '';
  if (!dirTree.length) {
    dirList.innerHTML = `<div class="placeholder-msg"><p>Kein Verzeichnis geladen</p></div>`;
    dirCount.textContent = '';
    return;
  }
  dirCount.textContent = dirMap.size;

  for (const item of dirTree) {
    const el = document.createElement('div');
    el.className = `dir-item${item.isUrl ? ' url-dir' : ''} indent-${Math.min(item.depth, 3)}`;
    el.dataset.path = item.path;

    const folderSvg = item.isUrl
      ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
           <circle cx="11" cy="8" r="4"/><line x1="2" y1="8" x2="7" y2="8"/>
           <path d="M10 5.5c.8.7 1.3 1.5 1.3 2.5s-.5 1.8-1.3 2.5"/>
         </svg>`
      : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
           <path d="M1 4h5l1.5 2H15v7H1z"/>
         </svg>`;

    el.innerHTML = `
      ${folderSvg}
      <span class="dir-item-name" title="${decodeURIComponent(item.path)}">${item.label}</span>
      <span class="dir-item-badge">${item.count}</span>
    `;
    el.addEventListener('click', () => selectDir(item.path));
    dirList.appendChild(el);
  }
}

/* ════════════════════════════════════════════════════
   GALERIE ANZEIGEN
═════════════════════════════════════════════════════ */
function selectDir(path) {
  activeDir = path;
  document.querySelectorAll('.dir-item').forEach(el =>
    el.classList.toggle('active', el.dataset.path === path)
  );

  // Breadcrumb
  let crumb;
  if (mode === 'url') {
    const rel = path.replace(baseUrl, '').replace(/\/$/, '') || decodeURIComponent(baseUrl);
    crumb = rel || baseUrl;
    breadcrumb.classList.add('url-mode');
  } else {
    const parts = path.split('/');
    crumb = parts.map((p, i) => i === parts.length - 1 ? `<strong>${p}</strong>` : p + ' /').join(' ');
    breadcrumb.classList.remove('url-mode');
  }
  breadcrumb.innerHTML = crumb;

  toolbar.style.display = 'flex';
  currentList = [...(dirMap.get(path) || [])];
  renderGallery(currentList);

  const q = searchInput.value.trim();
  if (q) filterGallery(q);
}

function renderGallery(entries) {
  welcome.style.display  = 'none';
  emptyDir.style.display = 'none';
  thumbGrid.style.display = 'none';

  if (!entries.length) {
    emptyDir.style.display = 'flex';
    imgCount.textContent = '0 Bilder';
    return;
  }

  thumbGrid.style.display = 'grid';
  thumbGrid.innerHTML = '';
  imgCount.textContent = `${entries.length} Bild${entries.length === 1 ? '' : 'er'}`;

  entries.forEach((entry, i) => {
    const card = buildThumbCard(entry, i);
    thumbGrid.appendChild(card);
  });
}

function buildThumbCard(entry, index) {
  const card = document.createElement('div');
  card.className = `thumb-card${entry.isUrl ? ' url-card' : ''}`;
  card.dataset.index = index;
  card.style.animationDelay = `${Math.min(index * 16, 380)}ms`;

  const noteKey = getKey(entry);
  const hasNote = !!(notes[noteKey]?.trim());
  const canShow = BROWSER_NATIVE.test(entry.name);

  card.innerHTML = `
    <div class="thumb-skeleton"></div>
    <img alt="${entry.name}" loading="lazy">
    ${hasNote ? '<div class="thumb-note-dot" title="Hat Notiz"></div>' : ''}
    ${!canShow ? `<div class="thumb-format-badge">${ext(entry.name)}</div>` : ''}
    <div class="thumb-overlay">
      <span class="thumb-overlay-name">${entry.name}</span>
    </div>
  `;

  const img  = card.querySelector('img');
  const skel = card.querySelector('.thumb-skeleton');

  const loadImage = () => {
    let src;
    if (entry.isUrl) {
      src = entry.url;
    } else {
      if (!entry._objUrl) entry._objUrl = URL.createObjectURL(entry.file);
      src = entry._objUrl;
    }

    if (!canShow) {
      // Nicht darstellbares Format → Platzhalter-Grafik
      skel.style.background = 'var(--bg-4)';
      img.remove();
      return;
    }

    img.src = src;
    img.onload  = () => { img.classList.add('loaded'); skel.classList.add('done'); };
    img.onerror = () => {
      skel.style.background = 'var(--bg-4)';
      img.remove();
    };
  };

  // IntersectionObserver für Lazy-Load
  const io = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { io.disconnect(); loadImage(); }
  }, { rootMargin: '300px' });
  io.observe(card);

  card.addEventListener('click', () => openLightbox(index));
  return card;
}

function ext(name) {
  const m = name.match(/\.([^.]+)$/);
  return m ? m[1].toUpperCase() : '?';
}

/* ════════════════════════════════════════════════════
   LIGHTBOX
═════════════════════════════════════════════════════ */
function openLightbox(index) {
  lbIndex = index;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  showLbImage(lbIndex);
}
function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

function showLbImage(index) {
  const entry = currentList[index];
  if (!entry) return;

  lbImg.classList.add('loading');

  let src;
  if (entry.isUrl) {
    src = entry.url;
  } else {
    if (!entry._objUrl) entry._objUrl = URL.createObjectURL(entry.file);
    src = entry._objUrl;
  }

  const canShow = BROWSER_NATIVE.test(entry.name);
  if (canShow) {
    const tmp = new Image();
    tmp.onload = () => { lbImg.src = src; lbImg.classList.remove('loading'); lbImg.style.display = ''; };
    tmp.onerror = () => { showLbFallback(entry); };
    tmp.src = src;
  } else {
    showLbFallback(entry);
  }

  // Meta
  lbFname.textContent   = entry.name;
  lbFpath.textContent   = entry.path || entry.url || '';
  lbFsize.textContent   = entry.size ? formatBytes(entry.size) : (entry.isUrl ? '(URL)' : '');
  lbCounter.textContent = `${index + 1} / ${currentList.length}`;

  // Notiz
  lbNoteInput.value = notes[getKey(entry)] || '';
  noteSaved.classList.remove('show');

  lbPrev.disabled = (index === 0);
  lbNext.disabled = (index === currentList.length - 1);
}

function showLbFallback(entry) {
  lbImg.style.display = 'none';
  // Zeige Formathinweis
  let fb = lightbox.querySelector('.lb-fallback');
  if (!fb) {
    fb = document.createElement('div');
    fb.className = 'lb-fallback';
    lbImg.parentElement.appendChild(fb);
  }
  fb.innerHTML = `
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" width="56" height="56" opacity=".4">
      <rect x="6" y="6" width="52" height="52" rx="4"/>
      <polyline points="6,42 20,28 30,38 42,22 58,42"/>
      <circle cx="20" cy="18" r="5"/>
    </svg>
    <span class="lb-fallback-ext">${ext(entry.name)}</span>
    <span class="lb-fallback-msg">Keine Browservorschau verfügbar</span>
    ${entry.isUrl ? `<a class="lb-fallback-link" href="${entry.url}" target="_blank" rel="noopener">Datei öffnen ↗</a>` : ''}
  `;
  lbImg.classList.remove('loading');
}

// Fallback aufräumen beim Bildwechsel
function clearLbFallback() {
  const fb = lightbox.querySelector('.lb-fallback');
  if (fb) fb.remove();
  lbImg.style.display = '';
}

const origShowLbImage = showLbImage;
// wrap to clear fallback first
function showLightboxImage(index) {
  clearLbFallback();
  showLbImage(index);
}

lbClose.addEventListener('click', closeLightbox);
lbBackdrop.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', () => { if (lbIndex > 0) { lbIndex--; showLightboxImage(lbIndex); } });
lbNext.addEventListener('click', () => { if (lbIndex < currentList.length - 1) { lbIndex++; showLightboxImage(lbIndex); } });

document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === 'ArrowLeft')  { if (lbIndex > 0) { lbIndex--; showLightboxImage(lbIndex); } }
  if (e.key === 'ArrowRight') { if (lbIndex < currentList.length - 1) { lbIndex++; showLightboxImage(lbIndex); } }
});

// Touch-Swipe
let txStart = 0;
lightbox.addEventListener('touchstart', e => { txStart = e.touches[0].clientX; }, { passive: true });
lightbox.addEventListener('touchend',   e => {
  const dx = e.changedTouches[0].clientX - txStart;
  if (Math.abs(dx) < 50) return;
  if (dx < 0 && lbIndex < currentList.length - 1) { lbIndex++; showLightboxImage(lbIndex); }
  if (dx > 0 && lbIndex > 0)                       { lbIndex--; showLightboxImage(lbIndex); }
}, { passive: true });

/* ════════════════════════════════════════════════════
   NOTIZEN
═════════════════════════════════════════════════════ */
noteSaveBtn.addEventListener('click', saveNote);
lbNoteInput.addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') saveNote(); });

function saveNote() {
  const entry = currentList[lbIndex];
  if (!entry) return;
  const key  = getKey(entry);
  const text = lbNoteInput.value.trim();
  if (text) notes[key] = text; else delete notes[key];
  persistNotes();
  updateNoteDot(lbIndex, !!text);
  noteSaved.classList.remove('show');
  void noteSaved.offsetWidth;
  noteSaved.classList.add('show');
  setTimeout(() => noteSaved.classList.remove('show'), 2200);
}

function updateNoteDot(index, hasNote) {
  const card = thumbGrid.querySelectorAll('.thumb-card')[index];
  if (!card) return;
  let dot = card.querySelector('.thumb-note-dot');
  if (hasNote && !dot) {
    dot = document.createElement('div');
    dot.className = 'thumb-note-dot'; dot.title = 'Hat Notiz';
    card.appendChild(dot);
  } else if (!hasNote && dot) { dot.remove(); }
}

function getKey(entry) { return entry.path || entry.url || entry.name; }

function loadNotes() {
  try { notes = JSON.parse(localStorage.getItem('pv_notes') || '{}'); } catch { notes = {}; }
}
function persistNotes() {
  try { localStorage.setItem('pv_notes', JSON.stringify(notes)); } catch {}
}

/* ════════════════════════════════════════════════════
   SUCHE
═════════════════════════════════════════════════════ */
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = searchInput.value.trim();
    searchClear.classList.toggle('visible', !!q);
    filterGallery(q);
  }, 110);
});
searchClear.addEventListener('click', () => {
  searchInput.value = ''; searchClear.classList.remove('visible');
  filterGallery(''); searchInput.focus();
});

function filterGallery(query) {
  const cards = thumbGrid.querySelectorAll('.thumb-card');
  if (!query) {
    cards.forEach(c => c.classList.remove('hidden'));
    imgCount.textContent = `${currentList.length} Bild${currentList.length === 1 ? '' : 'er'}`;
    return;
  }
  const q = query.toLowerCase();
  let visible = 0;
  cards.forEach((card, i) => {
    const entry = currentList[i];
    if (!entry) return;
    const match =
      entry.name.toLowerCase().includes(q) ||
      (entry.path || '').toLowerCase().includes(q) ||
      (notes[getKey(entry)] || '').toLowerCase().includes(q);
    card.classList.toggle('hidden', !match);
    if (match) visible++;
  });
  imgCount.textContent = `${visible} / ${currentList.length} Bild${currentList.length === 1 ? '' : 'er'}`;
}

document.addEventListener('keydown', e => {
  if (lightbox.classList.contains('open')) return;
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault(); searchInput.focus(); searchInput.select();
  }
});

/* ════════════════════════════════════════════════════
   THUMBNAIL-GRÖSSE
═════════════════════════════════════════════════════ */
sizeSlider.addEventListener('input', () => applyThumbSize(Number(sizeSlider.value)));

function applyThumbSize(px) {
  thumbGrid.style.setProperty('--thumb-size', px + 'px');
  try { localStorage.setItem('pv_thumbsize', px); } catch {}
}
function restoreThumbSize() {
  const saved = localStorage.getItem('pv_thumbsize');
  if (saved) { sizeSlider.value = saved; applyThumbSize(Number(saved)); }
  else applyThumbSize(200);
}

/* ════════════════════════════════════════════════════
   THEME
═════════════════════════════════════════════════════ */
function loadTheme() {
  applyTheme(localStorage.getItem('pv_theme') || 'dark');
}
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  themeIconDark.style.display  = t === 'dark'  ? 'block' : 'none';
  themeIconLight.style.display = t === 'light' ? 'block' : 'none';
  try { localStorage.setItem('pv_theme', t); } catch {}
}
themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

/* ════════════════════════════════════════════════════
   VOLLBILD
═════════════════════════════════════════════════════ */
fullscreenBtn.addEventListener('click', toggleFullscreen);

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

document.addEventListener('fullscreenchange', () => {
  const isFs = !!document.fullscreenElement;
  fsExpand.style.display   = isFs ? 'none'  : 'block';
  fsCompress.style.display = isFs ? 'block' : 'none';
  fullscreenBtn.classList.toggle('active', isFs);
  fullscreenBtn.title = isFs ? 'Vollbild verlassen (F11)' : 'Vollbild ein/aus (F11)';
});

document.addEventListener('keydown', e => {
  if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
});

/* ════════════════════════════════════════════════════
   SIDEBAR
═════════════════════════════════════════════════════ */
sidebarToggleBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

/* ════════════════════════════════════════════════════
   DRAG & DROP
═════════════════════════════════════════════════════ */
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', async e => {
  e.preventDefault();
  if (urlModal.classList.contains('open')) return;

  const items = Array.from(e.dataTransfer.items || []);
  const allFiles = [];

  async function readEntry(entry, path) {
    if (entry.isFile) {
      await new Promise(res => entry.file(f => {
        if (IMAGE_EXTS.test(f.name)) {
          Object.defineProperty(f, 'webkitRelativePath', { value: path + f.name, configurable: true });
          allFiles.push(f);
        }
        res();
      }));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      await new Promise(res => {
        reader.readEntries(async entries => {
          for (const child of entries) await readEntry(child, path + entry.name + '/');
          res();
        });
      });
    }
  }

  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) await readEntry(entry, '');
  }

  if (allFiles.length) loadLocalFiles(allFiles);
  else showToast('Keine Bilder im gezogenen Inhalt gefunden.');
});

/* ════════════════════════════════════════════════════
   HILFSFUNKTIONEN
═════════════════════════════════════════════════════ */
function formatBytes(b) {
  if (b < 1024)        return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
