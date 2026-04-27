/* ═══════════════════════════════════════════════════════
   PHOTOVAULT — app.js
   Verzeichnis-Browser · Lightbox · Notizen · Suche
═══════════════════════════════════════════════════════ */

"use strict";

// ── DOM refs ──────────────────────────────────────────
const $  = id => document.getElementById(id);
const dirInput       = $('dirInput');
const dirList        = $('dirList');
const dirCount       = $('dirCount');
const searchInput    = $('searchInput');
const searchClear    = $('searchClear');
const gallery        = $('gallery');
const thumbGrid      = $('thumbGrid');
const welcome        = $('welcome');
const emptyDir       = $('emptyDir');
const toolbar        = $('toolbar');
const breadcrumb     = $('breadcrumb');
const imgCount       = $('imgCount');
const sizeSlider     = $('sizeSlider');
const themeToggle    = $('themeToggle');
const themeIconDark  = $('themeIconDark');
const themeIconLight = $('themeIconLight');
const sidebarToggleBtn = $('sidebarToggleBtn');
const sidebar        = $('sidebar');
const lightbox       = $('lightbox');
const lbBackdrop     = $('lbBackdrop');
const lbImg          = $('lbImg');
const lbClose        = $('lbClose');
const lbPrev         = $('lbPrev');
const lbNext         = $('lbNext');
const lbFname        = $('lbFname');
const lbFpath        = $('lbFpath');
const lbFsize        = $('lbFsize');
const lbCounter      = $('lbCounter');
const lbNoteInput    = $('lbNoteInput');
const noteSaveBtn    = $('noteSaveBtn');
const noteSaved      = $('noteSaved');
const toast          = $('toast');

// ── State ─────────────────────────────────────────────
const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i;

let dirMap      = new Map();   // dirPath → File[]
let dirTree     = [];          // [{path, label, depth, count}]
let activeDir   = null;        // currently shown dir path
let currentList = [];          // files currently shown
let lbIndex     = 0;           // lightbox current index
let notes       = {};          // { filePath: noteText }
let rootName    = '';          // top-level dir name

// ── Init ──────────────────────────────────────────────
loadTheme();
loadNotes();
applyThumbSize(Number(sizeSlider.value));

// ── File input ────────────────────────────────────────
dirInput.addEventListener('change', e => {
  const files = Array.from(e.target.files).filter(f => IMAGE_EXTS.test(f.name));
  if (!files.length) { showToast('Keine Bilder gefunden.'); return; }
  processFiles(files);
  dirInput.value = '';
});

function processFiles(files) {
  dirMap.clear();

  for (const file of files) {
    const rel   = file.webkitRelativePath || file.name;
    const parts = rel.split('/');
    if (parts.length < 2) {
      // Flat file without dir (fallback)
      const dir = '(Wurzel)';
      if (!dirMap.has(dir)) dirMap.set(dir, []);
      dirMap.get(dir).push(file);
      continue;
    }
    rootName = parts[0];
    const dirPath = parts.slice(0, parts.length - 1).join('/');
    if (!dirMap.has(dirPath)) dirMap.set(dirPath, []);
    dirMap.get(dirPath).push(file);
  }

  // Sort dirs alphabetically
  const sorted = [...dirMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  dirMap = new Map(sorted);

  buildDirTree();
  renderDirList();

  // Auto-select first dir
  const firstDir = dirTree[0]?.path;
  if (firstDir) selectDir(firstDir);

  showToast(`${files.length} Bild${files.length === 1 ? '' : 'er'} in ${dirMap.size} Verzeichnis${dirMap.size === 1 ? '' : 'sen'} geladen.`);
}

// ── Directory tree builder ─────────────────────────────
function buildDirTree() {
  dirTree = [];
  for (const [path] of dirMap) {
    const parts = path.split('/');
    const depth = parts.length - 1;        // root = depth 0
    const label = parts[parts.length - 1] || path;
    const count = dirMap.get(path).length;
    dirTree.push({ path, label, depth, count });
  }
}

function renderDirList() {
  dirList.innerHTML = '';
  if (!dirTree.length) {
    dirList.innerHTML = `<div class="placeholder-msg"><p>Kein Verzeichnis geladen</p></div>`;
    dirCount.textContent = '';
    return;
  }

  dirCount.textContent = `${dirMap.size}`;

  for (const item of dirTree) {
    const el = document.createElement('div');
    el.className = `dir-item indent-${Math.min(item.depth, 3)}`;
    el.dataset.path = item.path;

    const folderIcon = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M1 4h5l1.5 2H15v7H1z"/>
    </svg>`;

    el.innerHTML = `
      ${folderIcon}
      <span class="dir-item-name" title="${item.path}">${item.label}</span>
      <span class="dir-item-badge">${item.count}</span>
    `;
    el.addEventListener('click', () => selectDir(item.path));
    dirList.appendChild(el);
  }
}

// ── Select directory ───────────────────────────────────
function selectDir(path) {
  activeDir = path;

  // Update sidebar highlight
  document.querySelectorAll('.dir-item').forEach(el => {
    el.classList.toggle('active', el.dataset.path === path);
  });

  // Update breadcrumb
  const parts = path.split('/');
  breadcrumb.innerHTML = parts
    .map((p, i) => i === parts.length - 1 ? `<strong>${p}</strong>` : `${p} /`)
    .join(' ');

  toolbar.style.display = 'flex';

  const files = dirMap.get(path) || [];
  currentList  = [...files];
  renderGallery(currentList);

  // Re-apply search filter
  const q = searchInput.value.trim();
  if (q) filterGallery(q);
}

// ── Render gallery ─────────────────────────────────────
function renderGallery(files) {
  welcome.style.display   = 'none';
  emptyDir.style.display  = 'none';
  thumbGrid.style.display = 'none';

  if (!files.length) {
    emptyDir.style.display = 'flex';
    imgCount.textContent = '0 Bilder';
    return;
  }

  thumbGrid.style.display = 'grid';
  thumbGrid.innerHTML = '';
  imgCount.textContent = `${files.length} Bild${files.length === 1 ? '' : 'er'}`;

  files.forEach((file, i) => {
    const card = createThumbCard(file, i);
    thumbGrid.appendChild(card);
  });
}

function createThumbCard(file, index) {
  const card = document.createElement('div');
  card.className = 'thumb-card';
  card.dataset.index = index;
  card.style.animationDelay = `${Math.min(index * 18, 400)}ms`;

  const noteKey = getFileKey(file);
  const hasNote = !!(notes[noteKey]?.trim());

  card.innerHTML = `
    <div class="thumb-skeleton"></div>
    <img alt="${file.name}" loading="lazy">
    ${hasNote ? '<div class="thumb-note-dot" title="Hat Notiz"></div>' : ''}
    <div class="thumb-overlay">
      <span class="thumb-overlay-name">${file.name}</span>
    </div>
  `;

  const img = card.querySelector('img');
  const skel = card.querySelector('.thumb-skeleton');

  // Lazy load with IntersectionObserver
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      const url = URL.createObjectURL(file);
      img.src = url;
      img.onload  = () => { img.classList.add('loaded'); skel.classList.add('done'); };
      img.onerror = () => { skel.style.background = 'var(--bg-4)'; };
    }
  }, { rootMargin: '200px' });
  observer.observe(card);

  card.addEventListener('click', () => openLightbox(index));
  return card;
}

// ── Lightbox ───────────────────────────────────────────
function openLightbox(index) {
  lbIndex = index;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  showLightboxImage(lbIndex);
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  // Revoke any previously-created object URLs is handled per-image
}

function showLightboxImage(index) {
  const file = currentList[index];
  if (!file) return;

  lbImg.classList.add('loading');
  const url = URL.createObjectURL(file);
  const tmp = new Image();
  tmp.onload = () => {
    lbImg.src = url;
    lbImg.classList.remove('loading');
  };
  tmp.src = url;

  // Meta
  lbFname.textContent  = file.name;
  lbFpath.textContent  = file.webkitRelativePath || activeDir;
  lbFsize.textContent  = formatBytes(file.size);
  lbCounter.textContent = `${index + 1} / ${currentList.length}`;

  // Note
  const key = getFileKey(file);
  lbNoteInput.value = notes[key] || '';
  noteSaved.classList.remove('show');

  // Nav buttons
  lbPrev.disabled = (index === 0);
  lbNext.disabled = (index === currentList.length - 1);
}

lbClose.addEventListener('click', closeLightbox);
lbBackdrop.addEventListener('click', closeLightbox);

lbPrev.addEventListener('click', () => {
  if (lbIndex > 0) { lbIndex--; showLightboxImage(lbIndex); }
});
lbNext.addEventListener('click', () => {
  if (lbIndex < currentList.length - 1) { lbIndex++; showLightboxImage(lbIndex); }
});

// Keyboard navigation
document.addEventListener('keydown', e => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape')      closeLightbox();
  if (e.key === 'ArrowLeft')   { if (lbIndex > 0) { lbIndex--; showLightboxImage(lbIndex); } }
  if (e.key === 'ArrowRight')  { if (lbIndex < currentList.length - 1) { lbIndex++; showLightboxImage(lbIndex); } }
});

// Touch swipe in lightbox
let touchStartX = 0;
lightbox.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
lightbox.addEventListener('touchend',   e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) < 50) return;
  if (dx < 0 && lbIndex < currentList.length - 1) { lbIndex++; showLightboxImage(lbIndex); }
  if (dx > 0 && lbIndex > 0)                       { lbIndex--; showLightboxImage(lbIndex); }
}, { passive: true });

// ── Notes ──────────────────────────────────────────────
noteSaveBtn.addEventListener('click', saveCurrentNote);
lbNoteInput.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') saveCurrentNote();
});

function saveCurrentNote() {
  const file = currentList[lbIndex];
  if (!file) return;
  const key  = getFileKey(file);
  const text = lbNoteInput.value.trim();

  if (text) notes[key] = text;
  else       delete notes[key];

  persistNotes();
  updateThumbNoteDot(lbIndex, !!text);

  noteSaved.classList.remove('show');
  void noteSaved.offsetWidth;           // reflow to restart transition
  noteSaved.classList.add('show');
  setTimeout(() => noteSaved.classList.remove('show'), 2000);
}

function updateThumbNoteDot(index, hasNote) {
  const card = thumbGrid.querySelectorAll('.thumb-card')[index];
  if (!card) return;
  let dot = card.querySelector('.thumb-note-dot');
  if (hasNote && !dot) {
    dot = document.createElement('div');
    dot.className = 'thumb-note-dot';
    dot.title = 'Hat Notiz';
    card.appendChild(dot);
  } else if (!hasNote && dot) {
    dot.remove();
  }
}

function getFileKey(file) {
  return file.webkitRelativePath || file.name;
}

function loadNotes() {
  try { notes = JSON.parse(localStorage.getItem('photovault_notes') || '{}'); }
  catch { notes = {}; }
}

function persistNotes() {
  try { localStorage.setItem('photovault_notes', JSON.stringify(notes)); }
  catch { /* quota exceeded */ }
}

// ── Search ─────────────────────────────────────────────
let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const q = searchInput.value.trim();
    searchClear.classList.toggle('visible', !!q);
    filterGallery(q);
  }, 120);
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.classList.remove('visible');
  filterGallery('');
  searchInput.focus();
});

function filterGallery(query) {
  if (!query) {
    // Show all
    thumbGrid.querySelectorAll('.thumb-card').forEach(c => c.classList.remove('hidden'));
    imgCount.textContent = `${currentList.length} Bild${currentList.length === 1 ? '' : 'er'}`;
    return;
  }
  const q = query.toLowerCase();
  let visible = 0;
  thumbGrid.querySelectorAll('.thumb-card').forEach((card, i) => {
    const file = currentList[i];
    if (!file) return;
    const fname = file.name.toLowerCase();
    const fpath = (file.webkitRelativePath || '').toLowerCase();
    const note  = (notes[getFileKey(file)] || '').toLowerCase();
    const match = fname.includes(q) || fpath.includes(q) || note.includes(q);
    card.classList.toggle('hidden', !match);
    if (match) visible++;
  });
  imgCount.textContent = `${visible} / ${currentList.length} Bild${currentList.length === 1 ? '' : 'er'}`;
}

// ── Thumbnail size slider ──────────────────────────────
sizeSlider.addEventListener('input', () => applyThumbSize(Number(sizeSlider.value)));

function applyThumbSize(px) {
  thumbGrid.style.setProperty('--thumb-size', px + 'px');
  // persist preference
  try { localStorage.setItem('photovault_thumbsize', px); } catch {}
}

// Restore size preference
const savedSize = localStorage.getItem('photovault_thumbsize');
if (savedSize) {
  sizeSlider.value = savedSize;
  applyThumbSize(Number(savedSize));
}

// ── Theme ──────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem('photovault_theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeIconDark.style.display  = theme === 'dark'  ? 'block' : 'none';
  themeIconLight.style.display = theme === 'light' ? 'block' : 'none';
  try { localStorage.setItem('photovault_theme', theme); } catch {}
}

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
});

// ── Sidebar toggle ─────────────────────────────────────
sidebarToggleBtn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

// ── Toast helper ───────────────────────────────────────
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── Utility ────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Drag & drop onto window ────────────────────────────
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', async e => {
  e.preventDefault();
  const items = Array.from(e.dataTransfer.items || []);
  const allFiles = [];

  async function readEntry(entry, path = '') {
    if (entry.isFile) {
      await new Promise(res => entry.file(f => {
        // Attach relative path manually
        Object.defineProperty(f, 'webkitRelativePath', {
          value: path + f.name, configurable: true
        });
        if (IMAGE_EXTS.test(f.name)) allFiles.push(f);
        res();
      }));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      await new Promise(res => {
        reader.readEntries(async entries => {
          for (const child of entries) {
            await readEntry(child, path + entry.name + '/');
          }
          res();
        });
      });
    }
  }

  for (const item of items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) await readEntry(entry);
  }

  if (allFiles.length) processFiles(allFiles);
  else showToast('Keine Bilder im gezogenen Inhalt gefunden.');
});

// ── Keyboard shortcut for search ──────────────────────
document.addEventListener('keydown', e => {
  if (lightbox.classList.contains('open')) return;
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
});
