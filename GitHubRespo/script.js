/* ═══════════════════════════════════════════════════════════════
   juppijo — GitHub Repository Index  |  script.js
   GitHub API v3 (unauthenticated, public repos)
═══════════════════════════════════════════════════════════════ */

const GITHUB_USER = 'juppijo';
const API_BASE    = 'https://api.github.com';

/* ── DOM REFS ─────────────────────────────────────────────── */
const repoList      = document.getElementById('repo-list');
const loadingOverlay= document.getElementById('loading-overlay');
const themeBtn      = document.getElementById('theme-btn');
const fsBtn         = document.getElementById('fullscreen-btn');
const searchInput   = document.getElementById('search-input');
const statRepos     = document.getElementById('stat-repos');
const statFiles     = document.getElementById('stat-files');
const statLangs     = document.getElementById('stat-langs');
const welcomeScreen = document.getElementById('welcome-screen');
const filePanel     = document.getElementById('file-panel');
const panelHeader   = document.getElementById('panel-header');
const fileTreeWrap  = document.getElementById('file-tree-wrap');
const toast         = document.getElementById('toast');
const expandAllBtn  = document.getElementById('expand-all-btn');

/* ── STATE ────────────────────────────────────────────────── */
let allRepos       = [];
let activeRepo     = null;
let fileCount      = 0;
let searchQuery    = '';
let allExpanded    = false;

/* ── GITHUB PAGES LAUNCH ──────────────────────────────────── */
const GITHUB_PAGES_BASE = `https://${GITHUB_USER}.github.io`;

// Extensions that can be "launched" in the browser via GitHub Pages
const LAUNCHABLE_EXTS = new Set([
  'html', 'htm', 'pdf', 'svg', 'json', 'txt', 'md',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico',
  'mp3', 'wav', 'ogg', 'mp4', 'webm',
  'js', 'css',
]);

// Ext → launch label
const LAUNCH_LABELS = {
  html: '▶ Starten', htm: '▶ Starten',
  pdf:  '▶ PDF öffnen',
  svg:  '▶ SVG öffnen',
  mp3:  '▶ Anhören', wav: '▶ Anhören', ogg: '▶ Anhören',
  mp4:  '▶ Video', webm: '▶ Video',
  png:  '▶ Bild', jpg: '▶ Bild', jpeg: '▶ Bild', gif: '▶ Bild', webp: '▶ Bild',
};

function isLaunchable(name) {
  return LAUNCHABLE_EXTS.has(extOf(name));
}

/**
 * Build the GitHub Pages URL for a file.
 * fullName = "juppijo/RepoName"
 * filePath = "subfolder/index.html"  (from GitHub API item.path)
 */
function pagesUrl(fullName, filePath) {
  const repoName = fullName.split('/')[1];
  return `${GITHUB_PAGES_BASE}/${repoName}/${filePath}`;
}

function launchLabel(name) {
  const ext = extOf(name);
  return LAUNCH_LABELS[ext] || '▶ Öffnen';
}

/* ── FILE EXTENSION UTILS ─────────────────────────────────── */
const EXT_ICONS = {
  html:  '🌐', css: '🎨', js: '⚡', json: '📋', md: '📝',
  txt:   '📄', py: '🐍',  sh: '⚙️',  png: '🖼️',  jpg: '🖼️',
  jpeg:  '🖼️', gif: '🖼️', svg: '✏️', ico: '🔖', pdf: '📕',
  mp3:   '🎵', wav: '🎵', mp4: '🎬', zip: '📦', xml: '📄',
  yml:   '⚙️',  yaml: '⚙️', ts: '🔷', tsx: '🔷', jsx: '⚛️',
  gitignore: '🚫',
};

const EXT_COLORS = {
  html: '#e34c26', css: '#563d7c', js: '#f1e05a', json: '#aaa',
  md:   '#083fa1', py: '#3572A5', sh: '#89e051',  png: '#c9a227',
  jpg:  '#c9a227', svg: '#ff7700', ts: '#2b7489',  tsx: '#2b7489',
};

function extOf(name) {
  const parts = name.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function iconFor(item) {
  if (item.type === 'dir') return '📁';
  const ext = extOf(item.name);
  return EXT_ICONS[ext] || '📄';
}

function colorFor(name) {
  const ext = extOf(name);
  return EXT_COLORS[ext] || null;
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'heute';
  if (d === 1) return 'gestern';
  if (d < 7)  return `vor ${d} Tagen`;
  if (d < 30) return `vor ${Math.floor(d/7)} Wo.`;
  if (d < 365) return `vor ${Math.floor(d/30)} Mo.`;
  return `vor ${Math.floor(d/365)} J.`;
}

function langClass(lang) {
  if (!lang) return 'lang-other';
  const l = lang.toLowerCase();
  if (l === 'html') return 'lang-html';
  if (l === 'javascript') return 'lang-js';
  if (l === 'python') return 'lang-python';
  return 'lang-other';
}

/* ── TOAST ────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

/* ── THEME TOGGLE ─────────────────────────────────────────── */
(function initTheme() {
  const saved = localStorage.getItem('gh-index-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

themeBtn.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('gh-index-theme', next);
});

/* ── FULLSCREEN ───────────────────────────────────────────── */
fsBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    document.body.classList.add('is-fullscreen');
  } else {
    document.exitFullscreen().catch(() => {});
    document.body.classList.remove('is-fullscreen');
  }
});

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('is-fullscreen');
  else document.body.classList.add('is-fullscreen');
});

/* ── SEARCH ───────────────────────────────────────────────── */
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  filterRepoList();
});

function filterRepoList() {
  const items = repoList.querySelectorAll('.repo-item');
  let visible = 0;
  items.forEach(item => {
    const name = item.dataset.name || '';
    const desc = item.dataset.desc || '';
    const match = !searchQuery || name.includes(searchQuery) || desc.includes(searchQuery);
    item.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  statRepos.textContent = visible;
}

/* ── EXPAND ALL TOGGLE ────────────────────────────────────── */
expandAllBtn.addEventListener('click', () => {
  allExpanded = !allExpanded;
  expandAllBtn.textContent = allExpanded ? '⊟' : '⊞';
  document.querySelectorAll('.repo-row').forEach(row => {
    const subtree = row.closest('.repo-item')?.querySelector('.repo-subtree');
    if (subtree) {
      if (allExpanded) {
        row.classList.add('open');
        subtree.classList.add('open');
        // load if not yet loaded
        const repoName = row.closest('.repo-item')?.dataset.name;
        if (repoName && !subtree.dataset.loaded) {
          loadSidebarTree(repoName, subtree);
        }
      } else {
        row.classList.remove('open');
        subtree.classList.remove('open');
      }
    }
  });
});

/* ── FETCH HELPERS ────────────────────────────────────────── */
async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!res.ok) {
    const remaining = res.headers.get('X-RateLimit-Remaining');
    if (res.status === 403 && remaining === '0') {
      throw new Error('GitHub API Rate Limit erreicht. Bitte in einer Minute erneut versuchen.');
    }
    throw new Error(`API Fehler ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

/* ── INIT ─────────────────────────────────────────────────── */
async function init() {
  try {
    const repos = await apiFetch(`/users/${GITHUB_USER}/repos?per_page=100&sort=updated`);
    allRepos = repos;
    renderRepoList(repos);
    updateStats(repos);
    loadingOverlay.classList.add('hidden');
  } catch (err) {
    loadingOverlay.classList.add('hidden');
    showToast('⚠ ' + err.message);
    // fallback: still show page
  }
}

function updateStats(repos) {
  statRepos.textContent = repos.length;
  const langs = [...new Set(repos.map(r => r.language).filter(Boolean))];
  statLangs.textContent = langs.join(', ') || '—';
}

/* ── RENDER REPO LIST ─────────────────────────────────────── */
function renderRepoList(repos) {
  repoList.innerHTML = '';
  repos.forEach((repo, i) => {
    const li = document.createElement('li');
    li.className = 'repo-item';
    li.dataset.name = repo.name.toLowerCase();
    li.dataset.desc = (repo.description || '').toLowerCase();
    li.style.animationDelay = `${Math.min(i * 0.03, 0.5)}s`;

    const desc = repo.description
      ? `<p class="repo-desc">${escHtml(repo.description)}</p>`
      : '';

    const starHtml = repo.stargazers_count > 0
      ? `<span class="repo-star"><svg viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z"/></svg>${repo.stargazers_count}</span>`
      : '';

    li.innerHTML = `
      <div class="repo-row" role="button" aria-expanded="false">
        <svg class="repo-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 4 10 8 6 12"/>
        </svg>
        <span class="repo-icon-wrap">${repoEmoji(repo)}</span>
        <span class="repo-name">${escHtml(repo.name)}</span>
        ${repo.language ? `<span class="repo-badge ${langClass(repo.language)}">${escHtml(repo.language)}</span>` : ''}
      </div>
      ${desc}
      <div class="repo-meta">
        ${starHtml}
        <span class="repo-updated">${relativeTime(repo.updated_at)}</span>
      </div>
      <div class="repo-subtree"></div>
    `;

    const row     = li.querySelector('.repo-row');
    const subtree = li.querySelector('.repo-subtree');

    row.addEventListener('click', () => {
      const isOpen = row.classList.contains('open');
      row.classList.toggle('open', !isOpen);
      subtree.classList.toggle('open', !isOpen);
      row.setAttribute('aria-expanded', !isOpen);
      if (!isOpen && !subtree.dataset.loaded) {
        loadSidebarTree(repo.full_name, subtree);
      }
      // show file panel for this repo
      showRepoPanel(repo);
    });

    repoList.appendChild(li);
  });
}

function repoEmoji(repo) {
  const l = (repo.language || '').toLowerCase();
  if (l === 'html') return '🌐';
  if (l === 'javascript') return '⚡';
  if (l === 'python') return '🐍';
  if (l === 'css') return '🎨';
  return '📦';
}

/* ── SIDEBAR MINI TREE ────────────────────────────────────── */
async function loadSidebarTree(fullName, container) {
  container.dataset.loaded = '1';
  container.innerHTML = '<p style="padding:6px 16px 6px 56px;font-size:0.62rem;color:var(--text-3)">Lade…</p>';
  try {
    const items = await apiFetch(`/repos/${fullName}/contents/`);
    container.innerHTML = '';
    const ul = document.createElement('ul');
    ul.style.cssText = 'list-style:none;padding:4px 0';
    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    }).forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;padding:4px 16px 4px 24px;font-size:0.7rem;color:${item.type==='dir'?'var(--accent)':'var(--text-2)'};cursor:pointer;transition:background 0.15s;border-radius:4px;margin:0 4px" 
             class="sidebar-file-row"
             data-path="${escHtml(item.path)}" data-type="${item.type}" data-url="${escHtml(item.html_url)}">
          <span style="flex-shrink:0">${iconFor(item)}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(item.name)}</span>
          ${item.size ? `<span style="font-size:0.58rem;color:var(--text-3)">${formatSize(item.size)}</span>` : ''}
        </div>
      `;
      const row = li.querySelector('.sidebar-file-row');
      row.addEventListener('mouseenter', () => { row.style.background = 'var(--bg-hover)'; });
      row.addEventListener('mouseleave', () => { row.style.background = ''; });
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.type === 'file') {
          window.open(item.html_url, '_blank');
        }
      });
      ul.appendChild(li);
    });
    container.appendChild(ul);
    fileCount += items.filter(i => i.type === 'file').length;
    statFiles.textContent = fileCount;
  } catch(err) {
    container.innerHTML = `<p style="padding:6px 16px 6px 56px;font-size:0.62rem;color:var(--accent-red)">${escHtml(err.message)}</p>`;
  }
}

/* ── MAIN PANEL: SHOW REPO ────────────────────────────────── */
function showRepoPanel(repo) {
  // Mark active
  document.querySelectorAll('.repo-row').forEach(r => r.classList.remove('active'));
  const row = [...document.querySelectorAll('.repo-row')].find(r =>
    r.querySelector('.repo-name')?.textContent === repo.name
  );
  if (row) row.classList.add('active');

  activeRepo = repo;
  welcomeScreen.style.display = 'none';
  filePanel.style.display = 'flex';

  loadMainTree(repo.full_name, '', repo.html_url);
}

async function loadMainTree(fullName, subPath, repoUrl) {
  const path = subPath ? `/${subPath}` : '';
  const apiPath = `/repos/${fullName}/contents${path}`;

  // Breadcrumb
  const parts = fullName.split('/').concat(subPath ? subPath.split('/') : []);
  panelHeader.innerHTML = `
    <nav class="breadcrumb">
      ${parts.map((seg, i) => {
        const isCurrent = i === parts.length - 1;
        return `<span class="breadcrumb-seg ${isCurrent ? 'current' : ''}"
          data-index="${i}">${escHtml(seg)}</span>${i < parts.length - 1 ? '<span class="breadcrumb-sep">›</span>' : ''}`;
      }).join('')}
    </nav>
    <div class="panel-actions">
      <a class="panel-action-btn launch-pages-btn" href="https://${GITHUB_USER}.github.io/${fullName.split('/')[1]}/" target="_blank" title="GitHub Pages starten">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        Starten
      </a>
      <a class="panel-action-btn" href="${repoUrl}" target="_blank">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        GitHub
      </a>
    </div>
  `;

  // Breadcrumb nav
  panelHeader.querySelectorAll('.breadcrumb-seg:not(.current)').forEach(seg => {
    seg.addEventListener('click', () => {
      const idx = parseInt(seg.dataset.index);
      if (idx === 0) {
        // navigate to user
      } else if (idx === 1) {
        // navigate to repo root
        loadMainTree(fullName, '', repoUrl);
      } else {
        const subParts = parts.slice(2, idx + 1);
        loadMainTree(fullName, subParts.join('/'), repoUrl);
      }
    });
  });

  fileTreeWrap.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:20px;color:var(--text-3);font-size:0.75rem">
    <div style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite"></div>
    Lade Dateien…
  </div>`;

  try {
    const items = await apiFetch(apiPath);
    renderMainTree(items, fullName, subPath, repoUrl);
  } catch(err) {
    fileTreeWrap.innerHTML = `<p style="padding:20px;font-size:0.75rem;color:var(--accent-red)">⚠ ${escHtml(err.message)}</p>`;
    showToast('⚠ ' + err.message);
  }
}

function renderMainTree(items, fullName, subPath, repoUrl) {
  const sorted = [...items].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  const ul = document.createElement('ul');
  ul.className = 'file-tree';

  sorted.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'file-entry';
    li.style.animationDelay = `${Math.min(i * 0.02, 0.3)}s`;

    const isDir = item.type === 'dir';
    const dotColor = colorFor(item.name);

    const canLaunch = !isDir && isLaunchable(item.name);
    const pgUrl = canLaunch ? pagesUrl(fullName, item.path) : '';

    li.innerHTML = `
      <div class="file-row ${isDir ? 'is-dir' : 'is-file'}">
        ${isDir ? `<svg class="file-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 4 10 8 6 12"/></svg>` : `<span style="width:12px"></span>`}
        <span class="file-icon">${iconFor(item)}</span>
        ${dotColor ? `<span class="ext-dot" style="background:${dotColor}"></span>` : ''}
        <span class="file-label">${escHtml(item.name)}</span>
        ${item.size ? `<span class="file-size">${formatSize(item.size)}</span>` : ''}
        ${canLaunch ? `<a class="launch-btn" href="${escHtml(pgUrl)}" target="_blank" title="GitHub Pages: ${escHtml(pgUrl)}">${launchLabel(item.name)}</a>` : ''}
      </div>
      ${isDir ? '<ul class="sub-tree"></ul>' : ''}
    `;

    const row = li.querySelector('.file-row');
    // Prevent launch-btn click from also triggering row click
    li.querySelector('.launch-btn')?.addEventListener('click', e => e.stopPropagation());

    row.addEventListener('click', () => {
      if (isDir) {
        const isOpen = row.classList.contains('dir-open');
        row.classList.toggle('dir-open', !isOpen);
        const sub = li.querySelector('.sub-tree');
        sub.classList.toggle('open', !isOpen);
        if (!isOpen && !sub.dataset.loaded) {
          sub.dataset.loaded = '1';
          sub.innerHTML = '<li style="padding:4px 0 4px 8px;font-size:0.68rem;color:var(--text-3)">Lade…</li>';
          loadSubDir(item.path, fullName, repoUrl, sub);
        }
      } else {
        window.open(item.html_url, '_blank');
      }
    });

    ul.appendChild(li);
  });

  fileTreeWrap.innerHTML = '';
  fileTreeWrap.appendChild(ul);
}

async function loadSubDir(path, fullName, repoUrl, container) {
  try {
    const items = await apiFetch(`/repos/${fullName}/contents/${path}`);
    const sorted = [...items].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });
    container.innerHTML = '';
    sorted.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'file-entry';
      li.style.animationDelay = `${i * 0.02}s`;
      const isDir = item.type === 'dir';
      const dotColor = colorFor(item.name);
      const canLaunch = !isDir && isLaunchable(item.name);
      const pgUrl = canLaunch ? pagesUrl(fullName, item.path) : '';
      li.innerHTML = `
        <div class="file-row ${isDir ? 'is-dir' : 'is-file'}">
          ${isDir ? `<svg class="file-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 4 10 8 6 12"/></svg>` : `<span style="width:12px"></span>`}
          <span class="file-icon">${iconFor(item)}</span>
          ${dotColor ? `<span class="ext-dot" style="background:${dotColor}"></span>` : ''}
          <span class="file-label">${escHtml(item.name)}</span>
          ${item.size ? `<span class="file-size">${formatSize(item.size)}</span>` : ''}
          ${canLaunch ? `<a class="launch-btn" href="${escHtml(pgUrl)}" target="_blank" title="GitHub Pages: ${escHtml(pgUrl)}">${launchLabel(item.name)}</a>` : ''}
        </div>
        ${isDir ? '<ul class="sub-tree"></ul>' : ''}
      `;
      const row = li.querySelector('.file-row');
      li.querySelector('.launch-btn')?.addEventListener('click', e => e.stopPropagation());
      row.addEventListener('click', () => {
        if (isDir) {
          const isOpen = row.classList.contains('dir-open');
          row.classList.toggle('dir-open', !isOpen);
          const sub = li.querySelector('.sub-tree');
          sub.classList.toggle('open', !isOpen);
          if (!isOpen && !sub.dataset.loaded) {
            sub.dataset.loaded = '1';
            sub.innerHTML = '<li style="padding:4px 0 4px 8px;font-size:0.68rem;color:var(--text-3)">Lade…</li>';
            loadSubDir(item.path, fullName, repoUrl, sub);
          }
        } else {
          window.open(item.html_url, '_blank');
        }
      });
      container.appendChild(li);
    });
    fileCount += items.filter(i => i.type === 'file').length;
    statFiles.textContent = fileCount;
  } catch(err) {
    container.innerHTML = `<li style="padding:4px 0 4px 8px;font-size:0.68rem;color:var(--accent-red)">⚠ ${escHtml(err.message)}</li>`;
  }
}

/* ── HTML ESCAPE ──────────────────────────────────────────── */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── KEYBOARD SHORTCUT ────────────────────────────────────── */
document.addEventListener('keydown', e => {
  // Ctrl/Cmd + K → focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  // Escape → blur search
  if (e.key === 'Escape') {
    searchInput.blur();
  }
  // F11 → toggle fullscreen
  if (e.key === 'F11') {
    e.preventDefault();
    fsBtn.click();
  }
});

/* ── START ────────────────────────────────────────────────── */
init();
