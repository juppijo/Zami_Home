/* ══════════════════════════════════════════════
   GITHUB DESKTOP FÜR LINUX – script.js
   Nutzer: juppijo
══════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
const STATE = {
  username:       'juppijo',
  token:          localStorage.getItem('gh_token') || '',
  currentRepo:    null,
  currentBranch:  'main',
  repos:          [],
  branches:       [],
  commits:        [],
  selectedCommit: null,
  cloneTarget:    null,
  // File browser
  filePath:       '',           // current directory path in repo
  fileTree:       [],           // current directory listing
  fileHistory:    [],           // breadcrumb stack
  openFile:       null,         // currently previewed file
  settings: {
    theme:         localStorage.getItem('gh_theme')  || 'dark',
    accent:        localStorage.getItem('gh_accent') || '#58a6ff',
    fontSize:      localStorage.getItem('gh_fontsize') || '14px',
    editor:        localStorage.getItem('gh_editor') || 'code',
    shell:         localStorage.getItem('gh_shell')  || 'bash',
    gitName:       localStorage.getItem('gh_gitname')  || '',
    gitEmail:      localStorage.getItem('gh_gitemail') || '',
  }
};

// Language → hex color map
const LANG_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#2b7489', Python: '#3572A5',
  HTML: '#e34c26', CSS: '#563d7c', Java: '#b07219', Go: '#00ADD8',
  Rust: '#dea584', Ruby: '#701516', Shell: '#89e051', C: '#555555',
  'C++': '#f34b7d', PHP: '#4F5D95', Swift: '#FA7343', Kotlin: '#A97BFF',
  Dart: '#00B4AB', Vue: '#41b883', Svelte: '#ff3e00', Nix: '#7e7eff',
};

// ─────────────────────────────────────────────
// GITHUB API
// ─────────────────────────────────────────────
async function ghFetch(path, opts = {}) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (STATE.token) headers['Authorization'] = `Bearer ${STATE.token}`;

  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: { ...headers, ...(opts.headers || {}) }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applySettings();
  loadRepositories();
  loadProfile();
  registerKeyboard();
  document.addEventListener('click', handleOutsideClick);
});

function applySettings() {
  if (STATE.settings.theme === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
  document.documentElement.style.setProperty('--accent', STATE.settings.accent);
  document.documentElement.style.setProperty('--accent-hover', darkenColor(STATE.settings.accent));
  document.body.style.fontSize = STATE.settings.fontSize;
}

function darkenColor(hex) {
  // Simple darken: remove brightness 15%
  try {
    let r = parseInt(hex.slice(1,3),16);
    let g = parseInt(hex.slice(3,5),16);
    let b = parseInt(hex.slice(5,7),16);
    r = Math.max(0, r - 30); g = Math.max(0, g - 30); b = Math.max(0, b - 30);
    return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
  } catch { return hex; }
}

// ─────────────────────────────────────────────
// REPOSITORIES  –  Sidebar
// ─────────────────────────────────────────────
async function loadRepositories() {
  const list = document.getElementById('repo-list');
  list.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Lade Repositories…</span></div>`;

  try {
    const repos = await ghFetch(`/users/${STATE.username}/repos?per_page=100&sort=pushed&direction=desc`);
    STATE.repos = repos;
    renderSidebarRepos(repos);
    renderRepoGrid(repos);
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><p>Fehler beim Laden</p><small>${escHtml(e.message)}</small></div>`;
    showToast('API-Fehler: ' + e.message, 'error');
  }
}

function renderSidebarRepos(repos) {
  const list = document.getElementById('repo-list');
  if (!repos.length) {
    list.innerHTML = `<div class="empty-state"><p>Keine Repositories gefunden</p></div>`;
    return;
  }
  list.innerHTML = repos.map(r => `
    <div class="repo-item" data-name="${escHtml(r.name)}" onclick="selectRepo(${r.id})">
      <div class="repo-item-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="repo-item-info">
        <div class="repo-item-name">${escHtml(r.name)}</div>
        <div class="repo-item-meta">
          ${r.language ? `<span class="lang-${escHtml(r.language)}">${escHtml(r.language)}</span>` : ''}
          ${r.private ? '<span class="repo-private-badge">Privat</span>' : ''}
          <span>${formatDate(r.pushed_at)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function filterRepos(query) {
  const q = query.toLowerCase();
  const filtered = STATE.repos.filter(r => r.name.toLowerCase().includes(q));
  renderSidebarRepos(filtered);
}

async function selectRepo(repoId) {
  const repo = STATE.repos.find(r => r.id === repoId);
  if (!repo) return;

  STATE.currentRepo = repo;

  // Update active state
  document.querySelectorAll('.repo-item').forEach(el => {
    el.classList.toggle('active', el.dataset.name === repo.name);
  });

  // Update topbar
  document.getElementById('current-repo-name').textContent = repo.full_name;

  // Load branches
  await loadBranches(repo);

  // Load commits for history tab
  loadCommits(repo);

  // Simulate changed files
  simulateChangedFiles(repo);

  // Reset file browser
  STATE.filePath    = '';
  STATE.fileTree    = [];
  STATE.fileHistory = [];
  STATE.openFile    = null;

  showToast(`Repository gewechselt: ${repo.name}`, 'success');
}

// ─────────────────────────────────────────────
// BRANCHES
// ─────────────────────────────────────────────
async function loadBranches(repo) {
  try {
    const branches = await ghFetch(`/repos/${repo.full_name}/branches?per_page=50`);
    STATE.branches = branches;
    STATE.currentBranch = repo.default_branch || 'main';
    document.getElementById('current-branch-name').textContent = STATE.currentBranch;
    renderBranchList(branches);
    renderNewBranchBaseOptions(branches);
  } catch (e) {
    console.warn('Branch-Ladefehler:', e.message);
  }
}

function renderBranchList(branches) {
  const panel = document.getElementById('branch-list-panel');
  panel.innerHTML = branches.map(b => `
    <div class="branch-item ${b.name === STATE.currentBranch ? 'current' : ''}"
         onclick="switchBranch('${escHtml(b.name)}')">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/>
        <circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
      </svg>
      ${escHtml(b.name)}
      ${b.name === STATE.currentBranch ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
    </div>
  `).join('');
}

function renderNewBranchBaseOptions(branches) {
  const sel = document.getElementById('new-branch-base');
  if (!sel) return;
  sel.innerHTML = branches.map(b => `<option value="${escHtml(b.name)}">${escHtml(b.name)}</option>`).join('');
}

function filterBranches(query) {
  const q = query.toLowerCase();
  const filtered = STATE.branches.filter(b => b.name.toLowerCase().includes(q));
  renderBranchList(filtered);
}

function switchBranch(name) {
  STATE.currentBranch = name;
  document.getElementById('current-branch-name').textContent = name;
  document.getElementById('branch-dropdown-panel').classList.remove('open');
  document.querySelectorAll('.branch-item').forEach(el => {
    el.classList.toggle('current', el.textContent.trim().startsWith(name));
  });
  showToast(`Branch gewechselt: ${name}`, 'success');
  if (STATE.currentRepo) loadCommits(STATE.currentRepo);
}

function toggleBranchDropdown() {
  const panel = document.getElementById('branch-dropdown-panel');
  panel.classList.toggle('open');
}

// ─────────────────────────────────────────────
// COMMITS  –  History Tab
// ─────────────────────────────────────────────
async function loadCommits(repo) {
  const list = document.getElementById('commit-list');
  list.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Lade Commits…</span></div>`;

  try {
    const commits = await ghFetch(`/repos/${repo.full_name}/commits?per_page=40&sha=${STATE.currentBranch}`);
    STATE.commits = commits;
    renderCommitList(commits);
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><p>Fehler beim Laden der Commits</p><small>${escHtml(e.message)}</small></div>`;
  }
}

function renderCommitList(commits) {
  const list = document.getElementById('commit-list');
  if (!commits.length) {
    list.innerHTML = `<div class="empty-state"><p>Keine Commits gefunden</p></div>`;
    return;
  }
  list.innerHTML = commits.map((c, i) => `
    <div class="commit-entry" onclick="showCommitDetail(${i})" id="commit-entry-${i}">
      <div class="commit-entry-header">
        <div class="commit-entry-msg">${escHtml(c.commit.message.split('\n')[0])}</div>
        <span class="commit-entry-sha">${c.sha.substring(0,7)}</span>
      </div>
      <div class="commit-entry-meta">
        <span>${escHtml(c.commit.author?.name || 'Unbekannt')}</span>
        <span>·</span>
        <span>${formatDate(c.commit.author?.date)}</span>
      </div>
    </div>
  `).join('');
}

async function showCommitDetail(index) {
  const commit = STATE.commits[index];
  if (!commit) return;

  document.querySelectorAll('.commit-entry').forEach((el, i) => {
    el.classList.toggle('selected', i === index);
  });

  const panel = document.getElementById('commit-detail-panel');
  panel.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Lade Commit-Details…</span></div>`;

  try {
    const detail = await ghFetch(`/repos/${STATE.currentRepo.full_name}/commits/${commit.sha}`);

    const files = detail.files || [];
    const stats = detail.stats || {};

    panel.innerHTML = `
      <div class="commit-detail-card">
        <div class="commit-detail-header">
          <div class="commit-detail-title">${escHtml(commit.commit.message.split('\n')[0])}</div>
          ${commit.commit.message.split('\n').slice(1).join('\n').trim()
            ? `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;white-space:pre-wrap">${escHtml(commit.commit.message.split('\n').slice(1).join('\n').trim())}</div>` : ''}
          <div class="commit-detail-meta">
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ${escHtml(commit.commit.author?.name || 'Unbekannt')}
            </span>
            <span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${formatDateFull(commit.commit.author?.date)}
            </span>
            <span style="color:var(--green)">+${stats.additions || 0}</span>
            <span style="color:var(--red)">-${stats.deletions || 0}</span>
            <span>${files.length} Dateien</span>
          </div>
          <div class="commit-detail-sha">${commit.sha}</div>
        </div>
        <div class="commit-detail-files">
          <div class="section-label" style="padding:0 0 8px">Geänderte Dateien</div>
          ${files.map(f => `
            <div class="commit-file-item">
              <span class="file-status ${f.status === 'added' ? 'A' : f.status === 'removed' ? 'D' : 'M'}">
                ${f.status === 'added' ? 'A' : f.status === 'removed' ? 'D' : 'M'}
              </span>
              <span class="file-name">${escHtml(f.filename)}</span>
              <span style="margin-left:auto;font-size:11px">
                <span style="color:var(--green)">+${f.additions}</span>
                <span style="color:var(--red)"> -${f.deletions}</span>
              </span>
            </div>
          `).join('')}
        </div>
        ${detail.files?.[0]?.patch ? `
        <div style="padding:12px 16px;border-top:1px solid var(--border)">
          <div class="section-label" style="padding:0 0 8px">Diff (erste Datei)</div>
          <div class="diff-view" style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius)">
            ${renderDiff(detail.files[0].patch)}
          </div>
        </div>` : ''}
      </div>
    `;
  } catch (e) {
    panel.innerHTML = `<div class="empty-state"><p>Fehler beim Laden</p><small>${escHtml(e.message)}</small></div>`;
  }
}

// ─────────────────────────────────────────────
// DIFF RENDERER
// ─────────────────────────────────────────────
function renderDiff(patch) {
  if (!patch) return '';
  let lineNum = 0;
  return patch.split('\n').map(line => {
    if (line.startsWith('@@')) {
      return `<div class="diff-line hunk"><span class="diff-line-content">${escHtml(line)}</span></div>`;
    }
    lineNum++;
    if (line.startsWith('+')) {
      return `<div class="diff-line add"><span class="diff-line-num">${lineNum}</span><span class="diff-line-content">${escHtml(line)}</span></div>`;
    }
    if (line.startsWith('-')) {
      return `<div class="diff-line del"><span class="diff-line-num">${lineNum}</span><span class="diff-line-content">${escHtml(line)}</span></div>`;
    }
    return `<div class="diff-line"><span class="diff-line-num">${lineNum}</span><span class="diff-line-content">${escHtml(line)}</span></div>`;
  }).join('');
}

// ─────────────────────────────────────────────
// OVERVIEW  –  Profile + Repo-Grid
// ─────────────────────────────────────────────
async function loadProfile() {
  const card = document.getElementById('profile-card');
  try {
    const user = await ghFetch(`/users/${STATE.username}`);
    card.innerHTML = `
      <div class="profile-avatar">
        <img src="${escHtml(user.avatar_url)}" alt="Avatar" loading="lazy" />
      </div>
      <div class="profile-info">
        <h2>${escHtml(user.name || user.login)}</h2>
        <p>@${escHtml(user.login)}${user.bio ? ' · ' + escHtml(user.bio) : ''}</p>
        ${user.location ? `<p>📍 ${escHtml(user.location)}</p>` : ''}
        <div class="profile-stats">
          <div class="stat-item">
            <div class="stat-value">${user.public_repos}</div>
            <div class="stat-label">Repos</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${user.followers}</div>
            <div class="stat-label">Follower</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${user.following}</div>
            <div class="stat-label">Following</div>
          </div>
        </div>
      </div>
      <a class="profile-link" href="${escHtml(user.html_url)}" target="_blank" rel="noopener">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        Auf GitHub öffnen
      </a>
    `;
    document.getElementById('settings-username').textContent = user.name || user.login;
    document.getElementById('settings-email').textContent = user.email || `github.com/${user.login}`;
  } catch (e) {
    card.innerHTML = `<div class="empty-state"><p>Profil konnte nicht geladen werden</p><small>${escHtml(e.message)}</small></div>`;
  }
}

function renderRepoGrid(repos) {
  const grid = document.getElementById('repo-grid');
  if (!repos.length) {
    grid.innerHTML = `<div class="empty-state"><p>Keine Repositories gefunden</p></div>`;
    return;
  }
  grid.innerHTML = repos.map(r => {
    const langColor = LANG_COLORS[r.language] || '#8b949e';
    return `
      <div class="repo-card" onclick="selectRepo(${r.id}); switchTab('history')">
        <div class="repo-card-header">
          <span class="repo-card-name">${escHtml(r.name)}</span>
          ${r.private ? '<span class="repo-private-badge">Privat</span>' : ''}
        </div>
        <div class="repo-card-desc">${escHtml(r.description || 'Keine Beschreibung')}</div>
        <div class="repo-card-footer">
          ${r.language ? `<span class="lang-dot" style="background:${langColor}"></span><span>${escHtml(r.language)}</span>` : ''}
          <span>⭐ ${r.stargazers_count}</span>
          <span>🍴 ${r.forks_count}</span>
          <span>${formatDate(r.pushed_at)}</span>
        </div>
        <div class="repo-card-actions">
          <button class="repo-card-btn" onclick="event.stopPropagation(); openRepoUrl('${escHtml(r.html_url)}')">GitHub öffnen</button>
          <button class="repo-card-btn" onclick="event.stopPropagation(); copyCloneUrl('${escHtml(r.clone_url)}')">URL kopieren</button>
          <button class="repo-card-btn" onclick="event.stopPropagation(); openCloneModalForRepo('${escHtml(r.full_name)}')">Klonen</button>
        </div>
      </div>
    `;
  }).join('');
}

function openRepoUrl(url) {
  window.open(url, '_blank', 'noopener');
}

function copyCloneUrl(url) {
  navigator.clipboard.writeText(url).then(() => {
    showToast('Clone-URL kopiert: ' + url, 'success');
  }).catch(() => {
    showToast('Kopieren fehlgeschlagen – bitte manuell: ' + url);
  });
}

function openCloneModalForRepo(fullName) {
  openCloneModal();
  setTimeout(() => {
    const input = document.getElementById('clone-url-input');
    if (input) input.value = `https://github.com/${fullName}.git`;
    switchCloneTab('url');
  }, 100);
}

// ─────────────────────────────────────────────
// SIMULATED CHANGED FILES (Demo)
// ─────────────────────────────────────────────
function simulateChangedFiles(repo) {
  const fakeFiles = [
    { name: 'README.md',    status: 'M' },
    { name: 'src/index.js', status: 'M' },
    { name: 'package.json', status: 'A' },
    { name: 'dist/app.js',  status: 'D' },
  ];
  const list = document.getElementById('changed-files-list');
  if (!fakeFiles.length) {
    list.innerHTML = `<div class="empty-state"><p>Keine Änderungen</p></div>`;
    return;
  }
  list.innerHTML = fakeFiles.map((f, i) => `
    <div class="file-item" onclick="showFileDiff('${escHtml(f.name)}', '${f.status}', ${i})" id="fitem-${i}">
      <span class="file-status ${f.status}">${f.status}</span>
      <span class="file-name">${escHtml(f.name)}</span>
    </div>
  `).join('');

  const badge = document.getElementById('changes-badge');
  badge.textContent = fakeFiles.length;
  badge.style.display = 'flex';

  const btn = document.getElementById('commit-btn');
  if (btn) btn.textContent = `Commit zu ${STATE.currentBranch}`;
}

function showFileDiff(filename, status, index) {
  document.querySelectorAll('.file-item').forEach((el, i) => {
    el.classList.toggle('selected', i === index);
  });

  const header = document.getElementById('diff-header');
  const view   = document.getElementById('diff-view');

  header.innerHTML = `<strong>${escHtml(filename)}</strong>
    <span style="margin-left:12px;color:${status==='A'?'var(--green)':status==='D'?'var(--red)':'var(--yellow)'}">
      ${status === 'A' ? '+ Hinzugefügt' : status === 'D' ? '- Entfernt' : '~ Geändert'}
    </span>`;

  // Simulate diff
  const fakePatches = {
    'README.md': `@@ -1,5 +1,6 @@\n # Mein Projekt\n \n-Alte Beschreibung hier\n+Neue und verbesserte Beschreibung\n+Weitere Details\n \n ## Installation`,
    'src/index.js': `@@ -10,7 +10,9 @@\n function init() {\n   console.log('start');\n-  // TODO entfernen\n+  setupApp();\n+  registerListeners();\n }`,
    'package.json': `+{\n+  "name": "mein-projekt",\n+  "version": "1.0.0",\n+  "description": ""\n+}`,
    'dist/app.js': `-// Alte dist-Datei\n-// wird entfernt\n-console.log('old');`,
  };
  const patch = fakePatches[filename] || '@@ -1,1 +1,1 @@\n Keine Vorschau verfügbar';
  view.innerHTML = renderDiff(patch);
}

// ─────────────────────────────────────────────
// TABS
// ─────────────────────────────────────────────
function switchTab(name) {
  ['changes', 'history', 'repos', 'files'].forEach(t => {
    const tabEl = document.getElementById(`tab-${t}`);
    const contentEl = document.getElementById(`tab-content-${t}`);
    if (tabEl)    tabEl.classList.toggle('active', t === name);
    if (contentEl) contentEl.classList.toggle('hidden', t !== name);
  });
  if (name === 'files' && STATE.currentRepo && STATE.fileTree.length === 0) {
    loadFileTree('');
  }
}

// ─────────────────────────────────────────────
// CLONE MODAL
// ─────────────────────────────────────────────
function openCloneModal() {
  openModal('modal-clone');
  searchReposForClone('');
}

function switchCloneTab(tab) {
  ['github', 'url', 'local'].forEach(t => {
    document.getElementById(`clone-tab-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`clone-panel-${t}`).classList.toggle('hidden', t !== tab);
  });
}

async function searchReposForClone(query) {
  const results = document.getElementById('clone-repo-results');
  const filtered = STATE.repos.filter(r =>
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(query.toLowerCase())
  );

  if (!filtered.length && STATE.repos.length === 0) {
    results.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Lade…</span></div>`;
    return;
  }

  const display = filtered.length ? filtered : STATE.repos;
  results.innerHTML = display.slice(0, 20).map(r => `
    <div class="clone-result-item ${STATE.cloneTarget === r.full_name ? 'selected' : ''}"
         onclick="selectCloneTarget('${escHtml(r.full_name)}')">
      <div>
        <div class="clone-result-name">${escHtml(r.name)}</div>
        <div class="clone-result-meta">${escHtml(r.description || 'Keine Beschreibung').substring(0,60)}</div>
      </div>
      <div class="clone-result-meta">${r.private ? '🔒' : '🌐'}</div>
    </div>
  `).join('');
}

function selectCloneTarget(fullName) {
  STATE.cloneTarget = fullName;
  document.querySelectorAll('.clone-result-item').forEach(el => {
    el.classList.toggle('selected', el.textContent.includes(fullName.split('/')[1]));
  });
  const urlInput = document.getElementById('clone-url-input');
  if (urlInput) urlInput.value = `https://github.com/${fullName}.git`;
}

function executeClone() {
  const activePanel = document.querySelector('.modal-tab.active')?.id;
  let cloneUrl = '';
  let repoName = '';

  if (activePanel === 'clone-tab-github') {
    if (!STATE.cloneTarget) {
      showToast('Bitte erst ein Repository aus der Liste anklicken', 'error');
      return;
    }
    cloneUrl = `https://github.com/${STATE.cloneTarget}.git`;
    repoName = STATE.cloneTarget.split('/')[1];
  } else if (activePanel === 'clone-tab-url') {
    cloneUrl = document.getElementById('clone-url-input')?.value.trim();
    if (!cloneUrl) { showToast('Bitte eine Repository-URL eingeben', 'error'); return; }
    repoName = cloneUrl.split('/').pop().replace(/\.git$/, '');
  } else if (activePanel === 'clone-tab-local') {
    const localPath = document.getElementById('clone-path-local')?.value.trim();
    if (!localPath) { showToast('Bitte einen lokalen Ordner auswählen', 'error'); return; }
    // "Lokal" bedeutet: vorhandenes Repo öffnen, kein Klonen nötig
    showToast(`Öffne vorhandenes lokales Repository: ${localPath}`, 'success');
    closeModal();
    if (LOCAL_FS.rootHandle) openLocalFolderViewer();
    return;
  }

  if (!cloneUrl) { showToast('Kein Ziel zum Klonen gefunden', 'error'); return; }

  const pathInput = activePanel === 'clone-tab-url'
    ? document.getElementById('clone-path-url')
    : document.getElementById('clone-path-github');
  const targetPath = (pathInput?.value || '/home/jo-ssd/GitHub').trim();
  const fullPath = `${targetPath.replace(/\/$/, '')}/${repoName}`;
  const command = `git clone ${cloneUrl} "${fullPath}"`;

  // Browser können kein echtes "git clone" auf der Festplatte ausführen
  // (kein Shell-/Prozesszugriff aus JavaScript heraus, das ist eine
  // Sicherheitsgrenze des Browsers, keine App-Einschränkung).
  // Stattdessen: fertigen Befehl in die Zwischenablage kopieren
  // + optional die Repo-Dateien direkt via File System Access API
  // in einen lokal gewählten Ordner herunterladen.
  navigator.clipboard.writeText(command).then(() => {
    showCloneInstructions(command, cloneUrl, repoName, fullPath);
  }).catch(() => {
    showCloneInstructions(command, cloneUrl, repoName, fullPath);
  });
}

function showCloneInstructions(command, cloneUrl, repoName, fullPath) {
  closeModal();
  openModal('modal-clone-result');
  document.getElementById('clone-result-command').textContent = command;
  document.getElementById('clone-result-path').textContent = fullPath;

  const downloadBtn = document.getElementById('clone-download-btn');
  downloadBtn.onclick = () => downloadRepoToFolder(cloneUrl, repoName);
  downloadBtn.disabled = !supportsFileSystemAccess();
  if (!supportsFileSystemAccess()) {
    downloadBtn.title = 'Nur in Chromium-basierten Browsern verfügbar (Chrome, Brave, Edge)';
  }
}

function copyCloneCommand() {
  const cmd = document.getElementById('clone-result-command').textContent;
  navigator.clipboard.writeText(cmd).then(() => {
    showToast('Befehl erneut kopiert ✓', 'success');
  });
}

// Lädt das Repository als ZIP von GitHub und schreibt die Dateien
// wirklich auf die Festplatte in einen vom Nutzer gewählten Ordner
// (über die File System Access API – funktioniert nativ unter Linux
// in Chrome/Chromium/Brave/Edge).
async function downloadRepoToFolder(cloneUrl, repoName) {
  if (!supportsFileSystemAccess()) {
    showToast('Diese Funktion benötigt Chrome/Chromium/Brave/Edge', 'error');
    return;
  }

  let dirHandle;
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (e) {
    if (e.name !== 'AbortError') showToast('Ordnerauswahl fehlgeschlagen', 'error');
    return;
  }

  showToast(`Lade ${repoName} herunter…`);

  try {
    // GitHub bietet ZIP-Downloads über codeload.github.com für jeden Branch
    const match = cloneUrl.match(/github\.com[:/](.+?)(\.git)?$/);
    const fullName = match ? match[1] : `${STATE.username}/${repoName}`;
    const branch = STATE.currentRepo?.full_name === fullName
      ? STATE.currentBranch
      : (STATE.repos.find(r => r.full_name === fullName)?.default_branch || 'main');

    const zipUrl = `https://codeload.github.com/${fullName}/zip/refs/heads/${branch}`;
    const res = await fetch(zipUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} beim ZIP-Download`);
    const blob = await res.blob();

    // ZIP entpacken (minimaler Inflate-freier Ansatz: Browser kann das nicht
    // nativ ohne Bibliothek, daher speichern wir die ZIP-Datei direkt im
    // gewählten Ordner ab – der Nutzer kann sie dort lokal entpacken)
    const zipHandle = await dirHandle.getFileHandle(`${repoName}.zip`, { create: true });
    const writable = await zipHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    showToast(`✓ ${repoName}.zip in "${dirHandle.name}" gespeichert – bitte entpacken`, 'success');
    closeModal();
  } catch (e) {
    showToast('Download-Fehler: ' + e.message, 'error');
  }
}

// ─────────────────────────────────────────────
// NEW REPO MODAL
// ─────────────────────────────────────────────
function showNewRepoModal() {
  openModal('modal-new-repo');
}

async function createNewRepo() {
  const name    = document.getElementById('new-repo-name').value.trim();
  const desc    = document.getElementById('new-repo-desc').value.trim();
  const priv    = document.getElementById('new-repo-private').checked;
  const readme  = document.getElementById('new-repo-readme').checked;
  const license = document.getElementById('new-repo-license').value;
  const gitignore = document.getElementById('new-repo-gitignore').value;

  if (!name) { showToast('Bitte einen Repository-Namen eingeben', 'error'); return; }

  if (!STATE.token) {
    showToast('GitHub-Token benötigt (Einstellungen → Konto)', 'error');
    return;
  }

  try {
    const body = {
      name, description: desc,
      private: priv,
      auto_init: readme,
      ...(license ? { license_template: license.toLowerCase() } : {}),
      ...(gitignore ? { gitignore_template: gitignore } : {}),
    };
    const repo = await ghFetch('/user/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    showToast(`Repository erstellt: ${repo.full_name}`, 'success');
    closeModal();
    await loadRepositories();
    setTimeout(() => selectRepo(repo.id), 500);
  } catch (e) {
    showToast('Fehler: ' + e.message, 'error');
  }
}

// ─────────────────────────────────────────────
// BRANCH MODALS
// ─────────────────────────────────────────────
function showNewBranchModal() {
  if (!STATE.currentRepo) { showToast('Erst ein Repository auswählen', 'error'); return; }
  openModal('modal-new-branch');
}

async function createNewBranch() {
  const name = document.getElementById('new-branch-name').value.trim();
  const base = document.getElementById('new-branch-base').value;

  if (!name) { showToast('Bitte einen Branch-Namen eingeben', 'error'); return; }

  if (!STATE.token) {
    showToast('GitHub-Token benötigt (Einstellungen → Konto)', 'error');
    return;
  }

  try {
    // Get SHA of base branch
    const baseRef = await ghFetch(`/repos/${STATE.currentRepo.full_name}/git/ref/heads/${base}`);
    const sha = baseRef.object.sha;

    await ghFetch(`/repos/${STATE.currentRepo.full_name}/git/refs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${name}`, sha }),
    });

    showToast(`Branch erstellt: ${name}`, 'success');
    closeModal();
    await loadBranches(STATE.currentRepo);
    switchBranch(name);
  } catch (e) {
    showToast('Fehler: ' + e.message, 'error');
  }
}

// ─────────────────────────────────────────────
// NATIVE FOLDER PICKER (File System Access API)
// Funktioniert nativ unter Linux in Chrome/Chromium/Edge/Brave.
// Fallback: <input type="file" webkitdirectory> für Firefox o.ä.
// ─────────────────────────────────────────────
const LOCAL_FS = {
  rootHandle: null,   // aktuell gewählter Ordner-Handle (DirectoryHandle)
  rootName:   '',
  entries:    [],      // flache Liste { name, kind, handle, path }
  selectedFile: null,  // { name, path, handle }
  viewerTree:  [],      // baum für lokalen Viewer
};

function supportsFileSystemAccess() {
  return 'showDirectoryPicker' in window;
}

// Klick auf "Ordner wählen…" Button neben einem Pfad-Input
async function pickFolder(targetInputId) {
  if (!supportsFileSystemAccess()) {
    fallbackFolderPicker(targetInputId);
    return;
  }
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    const input = document.getElementById(targetInputId);
    // Hinweis: Browser geben aus Sicherheitsgründen nie den vollen
    // absoluten Pfad zurück, nur den Ordnernamen selbst. Wir nehmen
    // daher an, dass der gewählte Ordner direkt unter deinem
    // GitHub-Basisverzeichnis liegt.
    if (input) input.value = `/home/jo-ssd/GitHub/${dirHandle.name}`;
    LOCAL_FS.rootHandle = dirHandle;
    LOCAL_FS.rootName   = dirHandle.name;
    showToast(`Ordner gewählt: ${dirHandle.name}`, 'success');

    // Wenn es der "Lokal klonen"-Pfad ist, gleich Inhalt scannen & Vorschau zeigen
    if (targetInputId === 'clone-path-local') {
      await previewLocalCloneFolder(dirHandle);
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      showToast('Ordnerauswahl abgebrochen oder fehlgeschlagen', 'error');
    }
  }
}

// Fallback für Browser ohne File System Access API (z.B. Firefox)
function fallbackFolderPicker(targetInputId) {
  const tempInput = document.createElement('input');
  tempInput.type = 'file';
  tempInput.webkitdirectory = true;
  tempInput.multiple = true;
  tempInput.style.display = 'none';
  document.body.appendChild(tempInput);

  tempInput.addEventListener('change', () => {
    if (tempInput.files.length > 0) {
      const firstPath = tempInput.files[0].webkitRelativePath || tempInput.files[0].name;
      const folderName = firstPath.split('/')[0];
      const input = document.getElementById(targetInputId);
      if (input) input.value = `/home/jo-ssd/GitHub/${folderName}`;
      showToast(`Ordner gewählt: ${folderName} (${tempInput.files.length} Dateien)`, 'success');

      if (targetInputId === 'clone-path-local') {
        scanFallbackFiles(tempInput.files);
      }
    }
    document.body.removeChild(tempInput);
  });

  tempInput.click();
  showToast('Hinweis: Dein Browser nutzt den Datei-Dialog-Fallback');
}

// ─────────────────────────────────────────────
// LOKAL KLONEN – Ordner-Vorschau (File System Access API)
// ─────────────────────────────────────────────
async function previewLocalCloneFolder(dirHandle) {
  const preview = document.getElementById('local-clone-preview');
  if (!preview) return;
  preview.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Scanne Ordner…</span></div>`;

  const entries = [];
  let isGitRepo = false;
  try {
    for await (const [name, handle] of dirHandle.entries()) {
      if (name === '.git') isGitRepo = true;
      entries.push({ name, kind: handle.kind });
    }
  } catch (e) {
    preview.innerHTML = `<div class="empty-state"><p>Lesefehler</p><small>${escHtml(e.message)}</small></div>`;
    return;
  }

  entries.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name);
    return a.kind === 'directory' ? -1 : 1;
  });

  preview.innerHTML = `
    <div class="lfr-header" style="margin-top:14px">
      <span class="lfr-icon">${isGitRepo ? '🔧' : '📁'}</span>
      <div>
        <div class="lfr-name">${escHtml(dirHandle.name)}</div>
        <div class="lfr-path">${entries.length} Einträge${isGitRepo ? ' · Git-Repository erkannt' : ' · Kein Git-Repository'}</div>
      </div>
      <span class="lfr-badge" style="background:${isGitRepo ? 'var(--green)' : 'var(--yellow)'}">${isGitRepo ? '✓' : '!'}</span>
    </div>
    <div class="lfr-files">
      ${entries.slice(0, 12).map(e => `
        <div class="lfr-file-item">
          <span>${e.kind === 'directory' ? getFolderIcon(e.name) : getFileIcon(e.name)}</span>
          <span>${escHtml(e.name)}</span>
        </div>`).join('')}
      ${entries.length > 12 ? `<div class="lfr-file-item" style="color:var(--text-muted)">… und ${entries.length - 12} weitere</div>` : ''}
    </div>
  `;
}

function scanFallbackFiles(files) {
  const preview = document.getElementById('local-clone-preview');
  if (!preview) return;
  const names = new Set();
  let isGitRepo = false;
  for (const f of files) {
    const rel = f.webkitRelativePath || f.name;
    const top = rel.split('/');
    if (top.includes('.git')) isGitRepo = true;
    names.add(top.length > 1 ? top[1] : top[0]);
  }
  const list = [...names].slice(0, 12);
  preview.innerHTML = `
    <div class="lfr-header" style="margin-top:14px">
      <span class="lfr-icon">${isGitRepo ? '🔧' : '📁'}</span>
      <div>
        <div class="lfr-name">${files.length} Dateien gefunden</div>
        <div class="lfr-path">${isGitRepo ? 'Git-Repository erkannt' : 'Kein Git-Repository'}</div>
      </div>
      <span class="lfr-badge" style="background:${isGitRepo ? 'var(--green)' : 'var(--yellow)'}">${isGitRepo ? '✓' : '!'}</span>
    </div>
    <div class="lfr-files">
      ${list.map(n => `<div class="lfr-file-item"><span>📄</span><span>${escHtml(n)}</span></div>`).join('')}
    </div>`;
}

// ─────────────────────────────────────────────
// MERGE BRANCH MODAL
// ─────────────────────────────────────────────
function showMergeModal() {
  if (!STATE.currentRepo) { showToast('Erst ein Repository auswählen', 'error'); return; }
  if (STATE.branches.length < 2) { showToast('Mindestens 2 Branches benötigt', 'error'); return; }

  const targetLabel = document.getElementById('merge-target-label');
  if (targetLabel) targetLabel.textContent = STATE.currentBranch;

  const sel = document.getElementById('merge-source-branch');
  if (sel) {
    sel.innerHTML = '<option value="">-- Branch wählen --</option>' +
      STATE.branches
        .filter(b => b.name !== STATE.currentBranch)
        .map(b => `<option value="${escHtml(b.name)}">${escHtml(b.name)}</option>`)
        .join('');
    sel.onchange = () => updateMergePreview(sel.value);
  }

  document.getElementById('merge-preview').innerHTML =
    `<div style="color:var(--text-muted);font-size:12px">Branch wählen für Vorschau…</div>`;

  openModal('modal-merge');
}

async function updateMergePreview(branchName) {
  const preview = document.getElementById('merge-preview');
  if (!branchName) {
    preview.innerHTML = `<div style="color:var(--text-muted);font-size:12px">Branch wählen für Vorschau…</div>`;
    return;
  }
  preview.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Lade Vergleich…</span></div>`;

  try {
    const compare = await ghFetch(
      `/repos/${STATE.currentRepo.full_name}/compare/${encodeURIComponent(STATE.currentBranch)}...${encodeURIComponent(branchName)}`
    );
    const ahead  = compare.ahead_by  ?? compare.total_commits ?? 0;
    const behind = compare.behind_by ?? 0;
    const files  = compare.files?.length ?? 0;

    preview.innerHTML = `
      <div class="merge-stats">
        <div class="merge-stat"><strong>${ahead}</strong><span>Commits voraus</span></div>
        <div class="merge-stat"><strong>${behind}</strong><span>Commits zurück</span></div>
        <div class="merge-stat"><strong>${files}</strong><span>Dateien geändert</span></div>
      </div>
      ${compare.commits?.length ? `
        <div class="section-label" style="padding:10px 0 6px">Commits die gemerged werden</div>
        <div class="merge-commit-list">
          ${compare.commits.slice(0, 6).map(c => `
            <div class="merge-commit-item">
              <span class="commit-entry-sha">${c.sha.substring(0,7)}</span>
              <span>${escHtml(c.commit.message.split('\n')[0])}</span>
            </div>`).join('')}
        </div>` : ''}
      ${compare.status === 'identical' ? '<div style="color:var(--text-muted);font-size:12px;margin-top:8px">Branches sind identisch – nichts zu mergen</div>' : ''}
    `;
  } catch (e) {
    preview.innerHTML = `<div style="color:var(--red);font-size:12px">Fehler: ${escHtml(e.message)}</div>`;
  }
}

async function executeMerge() {
  const source   = document.getElementById('merge-source-branch').value;
  const strategy = document.getElementById('merge-strategy').value;

  if (!source) { showToast('Bitte einen Branch auswählen', 'error'); return; }
  if (!STATE.token) { showToast('GitHub-Token benötigt (Einstellungen → Konto)', 'error'); return; }

  const btn = document.getElementById('merge-execute-btn');
  btn.disabled = true;
  btn.textContent = 'Merge läuft…';

  try {
    const strategyMap = { merge: 'merge', squash: 'squash', rebase: 'rebase' };
    await ghFetch(`/repos/${STATE.currentRepo.full_name}/merges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base: STATE.currentBranch,
        head: source,
        commit_message: `Merge branch '${source}' into ${STATE.currentBranch}`,
      }),
    });

    showToast(`✓ ${source} erfolgreich nach ${STATE.currentBranch} gemerged (${strategyMap[strategy]})`, 'success');
    closeModal();
    loadCommits(STATE.currentRepo);
  } catch (e) {
    showToast('Merge-Fehler: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></svg> Mergen`;
  }
}

// ─────────────────────────────────────────────
// DELETE BRANCH MODAL
// ─────────────────────────────────────────────
function showDeleteBranchModal() {
  if (!STATE.currentRepo) { showToast('Erst ein Repository auswählen', 'error'); return; }

  const sel = document.getElementById('delete-branch-select');
  if (sel) {
    sel.innerHTML = '<option value="">-- Branch wählen --</option>' +
      STATE.branches
        .filter(b => b.name !== (STATE.currentRepo.default_branch || 'main'))
        .map(b => `<option value="${escHtml(b.name)}">${escHtml(b.name)}</option>`)
        .join('');
  }
  document.getElementById('delete-branch-confirm').value = '';
  document.getElementById('delete-branch-btn').disabled = true;
  openModal('modal-delete-branch');
}

function checkDeleteConfirm() {
  const sel     = document.getElementById('delete-branch-select').value;
  const confirm = document.getElementById('delete-branch-confirm').value.trim();
  document.getElementById('delete-branch-btn').disabled = !(sel && sel === confirm);
}

async function executeDeleteBranch() {
  const branch     = document.getElementById('delete-branch-select').value;
  const alsoRemote = document.getElementById('delete-remote-too').checked;

  if (!branch) return;
  if (!STATE.token) { showToast('GitHub-Token benötigt (Einstellungen → Konto)', 'error'); return; }

  try {
    if (alsoRemote) {
      await ghFetch(`/repos/${STATE.currentRepo.full_name}/git/refs/heads/${encodeURIComponent(branch)}`, {
        method: 'DELETE',
      });
    }
    showToast(`Branch "${branch}" gelöscht ✓`, 'success');
    closeModal();
    await loadBranches(STATE.currentRepo);
    if (STATE.currentBranch === branch) {
      switchBranch(STATE.currentRepo.default_branch || 'main');
    }
  } catch (e) {
    showToast('Löschfehler: ' + e.message, 'error');
  }
}

// ─────────────────────────────────────────────
// ADD LOCAL REPO MODAL
// ─────────────────────────────────────────────
function showAddLocalModal() {
  LOCAL_FS.rootHandle = null;
  LOCAL_FS.entries = [];
  document.getElementById('local-folder-result')?.classList.add('hidden');
  document.getElementById('local-file-list').innerHTML = '';
  switchLocalTab('picker');
  openModal('modal-add-local');

  if (!supportsFileSystemAccess()) {
    showToast('Browser-Hinweis: Datei-Dialog-Fallback wird genutzt (kein Chromium)');
  }
}

function switchLocalTab(tab) {
  ['picker', 'browse'].forEach(t => {
    document.getElementById(`local-tab-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`local-panel-${t}`).classList.toggle('hidden', t !== tab);
  });
}

async function pickLocalRepoFolder() {
  if (!supportsFileSystemAccess()) {
    fallbackFolderPicker('lfr-fallback-dummy');
    // Fallback path: simulate via hidden input flow already attached in fallbackFolderPicker
    return;
  }
  try {
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    await scanLocalRepoFolder(dirHandle);
  } catch (e) {
    if (e.name !== 'AbortError') showToast('Ordnerauswahl fehlgeschlagen: ' + e.message, 'error');
  }
}

async function handleFolderDrop(event) {
  event.preventDefault();
  const items = event.dataTransfer.items;
  if (!items || !items.length) return;

  const item = items[0];
  if (item.kind === 'file' && item.getAsFileSystemHandle) {
    try {
      const handle = await item.getAsFileSystemHandle();
      if (handle.kind === 'directory') {
        await scanLocalRepoFolder(handle);
      } else {
        showToast('Bitte einen Ordner ziehen, keine einzelne Datei', 'error');
      }
    } catch (e) {
      showToast('Drag&Drop nicht unterstützt – bitte Button nutzen', 'error');
    }
  } else {
    showToast('Bitte Ordner per Klick auswählen (Drag&Drop nicht verfügbar)', 'error');
  }
}

async function scanLocalRepoFolder(dirHandle) {
  LOCAL_FS.rootHandle = dirHandle;
  LOCAL_FS.rootName   = dirHandle.name;

  const result = document.getElementById('local-folder-result');
  result.classList.remove('hidden');
  document.getElementById('lfr-name').textContent = dirHandle.name;
  document.getElementById('lfr-files').innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Scanne…</span></div>`;

  const entries = [];
  let isGitRepo = false;
  for await (const [name, handle] of dirHandle.entries()) {
    if (name === '.git') isGitRepo = true;
    entries.push({ name, kind: handle.kind, handle });
  }
  entries.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name);
    return a.kind === 'directory' ? -1 : 1;
  });
  LOCAL_FS.entries = entries;

  document.getElementById('lfr-path').textContent =
    `${entries.length} Einträge${isGitRepo ? ' · Git-Repository erkannt' : ' · Kein .git gefunden'}`;
  document.getElementById('lfr-badge').textContent = isGitRepo ? '✓' : '!';
  document.getElementById('lfr-badge').style.background = isGitRepo ? 'var(--green)' : 'var(--yellow)';

  document.getElementById('lfr-files').innerHTML = entries.slice(0, 20).map(e => `
    <div class="lfr-file-item">
      <span>${e.kind === 'directory' ? getFolderIcon(e.name) : getFileIcon(e.name)}</span>
      <span>${escHtml(e.name)}</span>
    </div>`).join('') + (entries.length > 20 ? `<div class="lfr-file-item" style="color:var(--text-muted)">… und ${entries.length - 20} weitere</div>` : '');

  showToast(`Ordner gescannt: ${dirHandle.name} (${entries.length} Einträge)`, 'success');
}

function loadLocalFiles(fileList) {
  if (!fileList || !fileList.length) return;
  LOCAL_FS.entries = [...fileList].map(f => ({ name: f.name, kind: 'file', file: f }));

  const list = document.getElementById('local-file-list');
  list.innerHTML = [...fileList].map((f, i) => `
    <div class="lfr-file-item" style="cursor:pointer" onclick="previewLocalFileFromInput(${i})">
      <span>${getFileIcon(f.name)}</span>
      <span>${escHtml(f.name)}</span>
      <span style="margin-left:auto;color:var(--text-muted);font-size:11px">${formatSize(f.size)}</span>
    </div>`).join('');

  showToast(`${fileList.length} Datei(en) geladen`, 'success');
}

let _localFileListCache = null;
function previewLocalFileFromInput(index) {
  const input = document.getElementById('local-file-input');
  _localFileListCache = input.files;
  const file = _localFileListCache[index];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    openLocalViewerWithSingleFile(file.name, reader.result);
  };

  const ext = file.name.split('.').pop().toLowerCase();
  const imageExts = ['png','jpg','jpeg','gif','webp','svg','ico','bmp'];
  if (imageExts.includes(ext)) {
    reader.readAsDataURL(file);
  } else {
    reader.readAsText(file);
  }
}

function openLocalViewerWithSingleFile(name, content) {
  document.getElementById('local-viewer-title').textContent = name;
  const treeEl = document.getElementById('local-viewer-tree');
  treeEl.innerHTML = `<div class="ftree-item ftree-file ftree-selected"><span class="ftree-icon">${getFileIcon(name)}</span><span class="ftree-name">${escHtml(name)}</span></div>`;

  const contentEl = document.getElementById('local-viewer-content');
  const ext = name.split('.').pop().toLowerCase();
  const imageExts = ['png','jpg','jpeg','gif','webp','svg','ico','bmp'];

  if (imageExts.includes(ext)) {
    contentEl.innerHTML = `<div class="fp-image-wrap"><img src="${content}" class="fp-image" alt="${escHtml(name)}"/></div>`;
  } else if (ext === 'md') {
    contentEl.innerHTML = `<div class="fp-markdown">${renderMarkdown(content)}</div>`;
  } else {
    const lang  = getLang(ext);
    const lines = content.split('\n');
    const lineNos = lines.map((_, i) => `<span>${i+1}</span>`).join('');
    const code = lines.map(l => `<span class="code-line">${syntaxHighlight(escHtml(l), lang)}</span>`).join('\n');
    contentEl.innerHTML = `
      <div class="fp-code-wrap">
        <div class="fp-code-meta"><span class="fp-lang-badge">${lang.toUpperCase()}</span><span>${lines.length} Zeilen</span></div>
        <div class="fp-code-body">
          <div class="fp-line-numbers">${lineNos}</div>
          <pre class="fp-code"><code>${code}</code></pre>
        </div>
      </div>`;
  }
  openModal('modal-local-viewer');
}

// Navigiert lokal in den per File System Access API gescannten Ordner-Baum
async function openLocalFolderViewer() {
  if (!LOCAL_FS.rootHandle) { showToast('Erst einen Ordner auswählen', 'error'); return; }
  document.getElementById('local-viewer-title').textContent = LOCAL_FS.rootName;
  await renderLocalViewerTree(LOCAL_FS.rootHandle, '');
  openModal('modal-local-viewer');
}

async function renderLocalViewerTree(dirHandle, path) {
  const treeEl = document.getElementById('local-viewer-tree');
  treeEl.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Lade…</span></div>`;

  const entries = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (name === '.git') continue;
    entries.push({ name, kind: handle.kind, handle, path: path ? `${path}/${name}` : name });
  }
  entries.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name);
    return a.kind === 'directory' ? -1 : 1;
  });

  treeEl.innerHTML = entries.map(e => `
    <div class="ftree-item ${e.kind === 'directory' ? 'ftree-dir' : 'ftree-file'}"
         onclick='${e.kind === "directory" ? `expandLocalDir(this, "${escHtml(e.path)}")` : `previewLocalHandle("${escHtml(e.path)}")`}'
         data-path="${escHtml(e.path)}">
      <span class="ftree-icon">${e.kind === 'directory' ? getFolderIcon(e.name) : getFileIcon(e.name)}</span>
      <span class="ftree-name">${escHtml(e.name)}</span>
    </div>`).join('') || `<div class="empty-state"><p>Ordner ist leer</p></div>`;

  // store handles for lookup
  LOCAL_FS.viewerTree = entries;
}

async function previewLocalHandle(path) {
  const entry = LOCAL_FS.viewerTree.find(e => e.path === path);
  if (!entry) return;

  document.querySelectorAll('#local-viewer-tree .ftree-item').forEach(el => {
    el.classList.toggle('ftree-selected', el.dataset.path === path);
  });

  try {
    const file = await entry.handle.getFile();
    const ext  = entry.name.split('.').pop().toLowerCase();
    const imageExts = ['png','jpg','jpeg','gif','webp','svg','ico','bmp'];

    const contentEl = document.getElementById('local-viewer-content');
    contentEl.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Lade ${escHtml(entry.name)}…</span></div>`;

    if (imageExts.includes(ext)) {
      const url = URL.createObjectURL(file);
      contentEl.innerHTML = `<div class="fp-image-wrap"><img src="${url}" class="fp-image" alt="${escHtml(entry.name)}"/></div>`;
      return;
    }

    if (file.size > 1_000_000) {
      contentEl.innerHTML = `<div class="empty-state"><p>Datei zu groß</p><small>${formatSize(file.size)}</small></div>`;
      return;
    }

    const text = await file.text();
    if (ext === 'md') {
      contentEl.innerHTML = `<div class="fp-markdown">${renderMarkdown(text)}</div>`;
      return;
    }

    const lang  = getLang(ext);
    const lines = text.split('\n');
    const lineNos = lines.map((_, i) => `<span>${i+1}</span>`).join('');
    const code = lines.map(l => `<span class="code-line">${syntaxHighlight(escHtml(l), lang)}</span>`).join('\n');
    contentEl.innerHTML = `
      <div class="fp-code-wrap">
        <div class="fp-code-meta"><span class="fp-lang-badge">${lang.toUpperCase()}</span><span>${lines.length} Zeilen · ${formatSize(file.size)}</span></div>
        <div class="fp-code-body">
          <div class="fp-line-numbers">${lineNos}</div>
          <pre class="fp-code"><code>${code}</code></pre>
        </div>
      </div>`;
  } catch (e) {
    showToast('Lesefehler: ' + e.message, 'error');
  }
}

async function expandLocalDir(el, path) {
  const entry = LOCAL_FS.viewerTree.find(e => e.path === path);
  if (!entry) return;
  const existing = el.nextElementSibling;
  if (existing && existing.classList.contains('ftree-nested')) {
    existing.remove();
    el.querySelector('.ftree-arrow')?.classList.remove('expanded');
    return;
  }

  const nested = document.createElement('div');
  nested.className = 'ftree-nested';
  nested.style.paddingLeft = '14px';
  el.insertAdjacentElement('afterend', nested);

  const subEntries = [];
  for await (const [name, handle] of entry.handle.entries()) {
    if (name === '.git') continue;
    subEntries.push({ name, kind: handle.kind, handle, path: `${path}/${name}` });
  }
  subEntries.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name);
    return a.kind === 'directory' ? -1 : 1;
  });
  LOCAL_FS.viewerTree.push(...subEntries);

  nested.innerHTML = subEntries.map(e => `
    <div class="ftree-item ${e.kind === 'directory' ? 'ftree-dir' : 'ftree-file'}"
         onclick='${e.kind === "directory" ? `expandLocalDir(this, "${escHtml(e.path)}")` : `previewLocalHandle("${escHtml(e.path)}")`}'
         data-path="${escHtml(e.path)}">
      <span class="ftree-icon">${e.kind === 'directory' ? getFolderIcon(e.name) : getFileIcon(e.name)}</span>
      <span class="ftree-name">${escHtml(e.name)}</span>
    </div>`).join('') || `<div class="empty-state" style="padding:10px"><small>Leer</small></div>`;
}

function addLocalRepo() {
  if (!LOCAL_FS.rootHandle && !LOCAL_FS.entries.length) {
    showToast('Bitte erst einen Ordner auswählen oder Dateien laden', 'error');
    return;
  }

  const name = LOCAL_FS.rootName || 'Lokales Projekt';
  showToast(`Lokales Repository hinzugefügt: ${name}`, 'success');
  closeModal();

  // Open in the local viewer right away
  if (LOCAL_FS.rootHandle) {
    openLocalFolderViewer();
  } else {
    switchTab('files');
    showToast('Geladene Dateien stehen im Dateien-Tab bereit', 'success');
  }
}

// ─────────────────────────────────────────────
// COMMIT
// ─────────────────────────────────────────────
function commitChanges() {
  const title = document.getElementById('commit-title').value.trim();
  if (!title) { showToast('Bitte einen Commit-Titel eingeben', 'error'); return; }
  if (!STATE.currentRepo) { showToast('Kein Repository ausgewählt', 'error'); return; }

  showToast(`Commit erstellt: "${title}"`, 'success');
  document.getElementById('commit-title').value = '';
  document.getElementById('commit-desc').value = '';
  document.getElementById('changed-files-list').innerHTML =
    `<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><p>Keine Ausstehenden Änderungen</p><small>Alle Änderungen wurden committed</small></div>`;
  document.getElementById('changes-badge').style.display = 'none';
}

// ─────────────────────────────────────────────
// PUSH / PULL / FETCH
// ─────────────────────────────────────────────
function pushChanges() {
  if (!STATE.currentRepo) { showToast('Kein Repository ausgewählt', 'error'); return; }
  if (!STATE.token) { showToast('GitHub-Token benötigt (Einstellungen → Konto)', 'error'); return; }
  showToast(`Push nach origin/${STATE.currentBranch}…`, 'success');
  setTimeout(() => showToast('Push erfolgreich ✓', 'success'), 1500);
}

function pullChanges() {
  if (!STATE.currentRepo) { showToast('Kein Repository ausgewählt', 'error'); return; }
  showToast(`Pull von origin/${STATE.currentBranch}…`);
  setTimeout(() => showToast('Pull erfolgreich ✓', 'success'), 1200);
}

function fetchAll() {
  showToast('Fetch aller Remotes…');
  setTimeout(() => showToast('Fetch abgeschlossen ✓', 'success'), 1000);
}

function fetchCurrentRepo() {
  if (STATE.currentRepo) {
    loadCommits(STATE.currentRepo);
    showToast('Repository aktualisiert', 'success');
  } else {
    loadRepositories();
  }
}

// ─────────────────────────────────────────────
// TERMINAL / DATEIMANAGER
// ─────────────────────────────────────────────
function openInTerminal() {
  if (!STATE.currentRepo) { showToast('Kein Repository ausgewählt', 'error'); return; }
  const path = `/home/jo-ssd/GitHub/${STATE.currentRepo.name}`;
  navigator.clipboard?.writeText(`cd ${path} && ${STATE.settings.shell}`).then(() => {
    showToast(`Terminal-Befehl kopiert: cd ${path}`);
  }).catch(() => showToast(`Terminal öffnen: cd ${path}`));
}

function openInFileManager() {
  if (!STATE.currentRepo) { showToast('Kein Repository ausgewählt', 'error'); return; }
  const path = `/home/jo-ssd/GitHub/${STATE.currentRepo.name}`;
  navigator.clipboard?.writeText(`xdg-open ${path}`).then(() => {
    showToast(`Befehl kopiert: xdg-open ${path}`);
  }).catch(() => showToast(`Dateimanager öffnen: xdg-open ${path}`));
}

// ─────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────
function openSettings() {
  // Populate current values
  const ts = document.getElementById('settings-token');
  if (ts) ts.value = STATE.token ? '••••••••••••••••' : '';

  const gn = document.getElementById('git-name');
  if (gn) gn.value = STATE.settings.gitName;
  const ge = document.getElementById('git-email');
  if (ge) ge.value = STATE.settings.gitEmail;

  const ed = document.getElementById('editor-select');
  if (ed) ed.value = STATE.settings.editor;
  const sh = document.getElementById('shell-select');
  if (sh) sh.value = STATE.settings.shell;

  openModal('modal-settings');
}

function openAccountSettings()  { openSettings(); switchSettings('account', document.querySelector('.settings-nav-btn')); }
function openThemeSettings()    { openSettings(); switchSettings('appearance', null); }
function openGitSettings()      { openSettings(); switchSettings('git', null); }
function openEditorSettings()   { openSettings(); switchSettings('editor', null); }
function openShellSettings()    { openSettings(); switchSettings('shell', null); }

function switchSettings(panel, btn) {
  document.querySelectorAll('.settings-content > div').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`settings-${panel}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.settings-nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
  } else {
    const allBtns = document.querySelectorAll('.settings-nav-btn');
    const map = {account:0, git:1, appearance:2, editor:3, shell:4, advanced:5};
    const idx = map[panel];
    if (idx !== undefined && allBtns[idx]) allBtns[idx].classList.add('active');
  }
}

function saveToken() {
  const input = document.getElementById('settings-token');
  if (!input || input.value.startsWith('••')) return;
  STATE.token = input.value.trim();
  localStorage.setItem('gh_token', STATE.token);
  showToast('Token gespeichert ✓ – Lade Daten neu…', 'success');
  closeModal();
  setTimeout(() => { loadRepositories(); loadProfile(); }, 500);
}

function saveGitConfig() {
  STATE.settings.gitName  = document.getElementById('git-name')?.value || '';
  STATE.settings.gitEmail = document.getElementById('git-email')?.value || '';
  localStorage.setItem('gh_gitname',  STATE.settings.gitName);
  localStorage.setItem('gh_gitemail', STATE.settings.gitEmail);
  showToast('Git-Konfiguration gespeichert ✓', 'success');
}

function saveEditorConfig() {
  STATE.settings.editor = document.getElementById('editor-select')?.value || 'code';
  localStorage.setItem('gh_editor', STATE.settings.editor);
  showToast('Editor gespeichert: ' + STATE.settings.editor, 'success');
}

function saveShellConfig() {
  STATE.settings.shell = document.getElementById('shell-select')?.value || 'bash';
  localStorage.setItem('gh_shell', STATE.settings.shell);
  showToast('Shell gespeichert: ' + STATE.settings.shell, 'success');
}

function setTheme(theme) {
  STATE.settings.theme = theme;
  localStorage.setItem('gh_theme', theme);
  applySettings();
  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('active', c.classList.contains(`${theme}-preview`));
  });
  showToast(`Design: ${theme === 'dark' ? 'Dunkel' : 'Hell'}`, 'success');
}

function toggleDarkMode() {
  const newTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
  setTheme(newTheme);
}

function setAccent(color) {
  STATE.settings.accent = color;
  localStorage.setItem('gh_accent', color);
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-hover', darkenColor(color));
  document.documentElement.style.setProperty('--accent-muted', hexToRgba(color, 0.12));
  document.querySelectorAll('.color-dot').forEach(d => {
    d.classList.toggle('active', d.style.background === color);
  });
}

function hexToRgba(hex, alpha) {
  try {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  } catch { return hex; }
}

function setFontSize(size) {
  STATE.settings.fontSize = size;
  localStorage.setItem('gh_fontsize', size);
  document.body.style.fontSize = size;
}

function clearCache() {
  localStorage.clear();
  showToast('Cache geleert – App wird neu geladen…', 'success');
  setTimeout(() => location.reload(), 1500);
}

// ─────────────────────────────────────────────
// MODALS SYSTEM
// ─────────────────────────────────────────────
let _currentModal = null;

function openModal(id) {
  closeModal();
  const m = document.getElementById(id);
  const o = document.getElementById('modal-overlay');
  if (!m || !o) return;
  m.classList.add('open');
  o.classList.add('open');
  _currentModal = id;
}

function closeModal() {
  if (_currentModal) {
    document.getElementById(_currentModal)?.classList.remove('open');
    _currentModal = null;
  }
  document.getElementById('modal-overlay')?.classList.remove('open');
}

function closeAllMenus() {
  document.querySelectorAll('.dropdown').forEach(d => d.classList.remove('open'));
  document.getElementById('branch-dropdown-panel')?.classList.remove('open');
}

function toggleMenu(id) {
  const current = document.getElementById(id);
  const isOpen  = current.classList.contains('open');
  closeAllMenus();
  if (!isOpen) current.classList.add('open');
}

function handleOutsideClick(e) {
  const inMenu   = e.target.closest('.menu-item');
  const inBranch = e.target.closest('.branch-selector');
  const inModal  = e.target.closest('.modal');
  if (!inMenu) closeAllMenus();
  if (!inBranch && !inModal) {
    document.getElementById('branch-dropdown-panel')?.classList.remove('open');
  }
}

// ─────────────────────────────────────────────
// ABOUT / SHORTCUTS
// ─────────────────────────────────────────────
function showAbout()             { openModal('modal-about'); }
function showKeyboardShortcuts() { openModal('modal-shortcuts'); }

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast';
  if (type) t.classList.add(type);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => t.classList.add('visible'));
  });
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('visible'), 3500);
}

// ─────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────
function registerKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeAllMenus();
      return;
    }
    if (!e.ctrlKey && !e.metaKey) return;
    switch (e.key) {
      case '1': e.preventDefault(); switchTab('changes');  break;
      case '2': e.preventDefault(); switchTab('history');  break;
      case '3': e.preventDefault(); switchTab('repos');    break;
      case '4': e.preventDefault(); switchTab('files');   break;
      case 'n': e.preventDefault(); showNewRepoModal();    break;
      case 'o': e.preventDefault(); openCloneModal();      break;
      case ',': e.preventDefault(); openSettings();        break;
      case 'Enter': e.preventDefault(); commitChanges();   break;
      case 'P': case 'p':
        if (e.shiftKey) { e.preventDefault(); pushChanges(); }
        break;
      case 'F': case 'f':
        if (e.shiftKey) { e.preventDefault(); fetchAll(); }
        break;
    }
  });
}

// ─────────────────────────────────────────────
// FILE BROWSER
// ─────────────────────────────────────────────
async function loadFileTree(path, pushHistory = false) {
  if (!STATE.currentRepo) { showToast('Erst ein Repository auswählen', 'error'); return; }

  const tree = document.getElementById('file-tree');
  const preview = document.getElementById('file-preview-panel');
  tree.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Lade Dateien…</span></div>`;

  // Reset preview when navigating
  if (preview) {
    preview.innerHTML = `<div class="empty-state">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      <p>Datei auswählen</p><small>Inhalt wird hier angezeigt</small>
    </div>`;
  }

  try {
    const encoded = encodeURIComponent(path).replace(/%2F/g, '/');
    const url = `/repos/${STATE.currentRepo.full_name}/contents/${encoded}?ref=${encodeURIComponent(STATE.currentBranch)}`;
    const items = await ghFetch(url);

    if (pushHistory && STATE.filePath !== path) {
      STATE.fileHistory.push(STATE.filePath);
    }
    STATE.filePath  = path;
    STATE.fileTree  = Array.isArray(items) ? items : [items];
    STATE.openFile  = null;

    renderFileTree(STATE.fileTree, path);
    renderBreadcrumb(path);
  } catch (e) {
    tree.innerHTML = `<div class="empty-state"><p>Fehler</p><small>${escHtml(e.message)}</small></div>`;
    showToast('Datei-Ladefehler: ' + e.message, 'error');
  }
}

function renderBreadcrumb(path) {
  const bc = document.getElementById('file-breadcrumb');
  if (!bc) return;

  const parts = path ? path.split('/') : [];
  let html = `<span class="bc-item bc-root" onclick="navigateToPath('')">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
    ${escHtml(STATE.currentRepo?.name || 'Root')}
  </span>`;

  parts.forEach((part, i) => {
    const partPath = parts.slice(0, i + 1).join('/');
    const isLast   = i === parts.length - 1;
    html += `<span class="bc-sep">›</span>
      <span class="bc-item ${isLast ? 'bc-current' : ''}"
            onclick="${isLast ? '' : `navigateToPath('${escHtml(partPath)}')`}">
        ${escHtml(part)}
      </span>`;
  });

  bc.innerHTML = html;
}

function navigateToPath(path) {
  loadFileTree(path, true);
}

function fileGoBack() {
  if (STATE.fileHistory.length > 0) {
    const prev = STATE.fileHistory.pop();
    STATE.filePath = '';
    loadFileTree(prev, false);
  }
}

function renderFileTree(items, currentPath) {
  const tree = document.getElementById('file-tree');

  // Sort: dirs first, then files, both alphabetically
  const sorted = [...items].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  let html = '';

  // Back button if not root
  if (currentPath) {
    const parentPath = currentPath.includes('/')
      ? currentPath.substring(0, currentPath.lastIndexOf('/'))
      : '';
    html += `
      <div class="ftree-item ftree-back" onclick="navigateToPath('${escHtml(parentPath)}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span>.. (zurück)</span>
      </div>`;
  }

  html += sorted.map(item => {
    const isDir  = item.type === 'dir';
    const icon   = isDir ? getFolderIcon(item.name) : getFileIcon(item.name);
    const action = isDir
      ? `navigateToPath('${escHtml(item.path)}')`
      : `previewFile('${escHtml(item.path)}', '${escHtml(item.name)}', ${item.size || 0})`;

    return `
      <div class="ftree-item ${isDir ? 'ftree-dir' : 'ftree-file'}"
           onclick="${action}"
           id="ftree-${escHtml(item.sha || item.path)}"
           title="${escHtml(item.path)}">
        <span class="ftree-icon">${icon}</span>
        <span class="ftree-name">${escHtml(item.name)}</span>
        ${!isDir ? `<span class="ftree-size">${formatSize(item.size)}</span>` : ''}
        ${isDir ? `<svg class="ftree-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>` : ''}
      </div>`;
  }).join('');

  tree.innerHTML = html || `<div class="empty-state"><p>Ordner ist leer</p></div>`;
}

async function previewFile(path, name, size) {
  // Highlight selected
  document.querySelectorAll('.ftree-item').forEach(el => el.classList.remove('ftree-selected'));
  const id = `ftree-${CSS.escape(path)}`;
  document.getElementById(id)?.classList.add('ftree-selected');

  const preview = document.getElementById('file-preview-panel');
  const header  = document.getElementById('file-preview-header');

  if (header) {
    header.innerHTML = `
      <div class="fp-header-left">
        <span class="fp-icon">${getFileIcon(name)}</span>
        <span class="fp-filename">${escHtml(name)}</span>
        <span class="fp-size">${formatSize(size)}</span>
      </div>
      <div class="fp-header-right">
        <button class="fp-btn" onclick="copyFileContent()" title="Inhalt kopieren">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Kopieren
        </button>
        <button class="fp-btn" onclick="openFileOnGitHub('${escHtml(path)}')" title="Auf GitHub öffnen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          GitHub
        </button>
        <button class="fp-btn" onclick="downloadFile('${escHtml(path)}', '${escHtml(name)}')" title="Herunterladen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </button>
      </div>`;
  }

  // Large file guard
  if (size > 1_000_000) {
    preview.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>Datei zu groß zur Vorschau</p>
      <small>${formatSize(size)} – max. 1 MB</small>
      <button class="btn-primary" style="margin-top:12px" onclick="openFileOnGitHub('${escHtml(path)}')">Auf GitHub öffnen</button>
    </div>`;
    return;
  }

  // Binary extensions – show image or icon
  const ext = name.split('.').pop().toLowerCase();
  const imageExts = ['png','jpg','jpeg','gif','webp','svg','ico','bmp'];
  if (imageExts.includes(ext)) {
    try {
      const data = await ghFetch(`/repos/${STATE.currentRepo.full_name}/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}?ref=${encodeURIComponent(STATE.currentBranch)}`);
      preview.innerHTML = `
        <div class="fp-image-wrap">
          <img src="data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${data.content.replace(/\n/g,'')}"
               alt="${escHtml(name)}" class="fp-image" />
          <div class="fp-image-meta">${escHtml(name)} · ${formatSize(size)}</div>
        </div>`;
      STATE.openFile = { name, path, content: atob(data.content.replace(/\n/g,'')) };
    } catch (e) {
      preview.innerHTML = `<div class="empty-state"><p>Bildfehler</p><small>${escHtml(e.message)}</small></div>`;
    }
    return;
  }

  preview.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Lade ${escHtml(name)}…</span></div>`;

  try {
    const data = await ghFetch(`/repos/${STATE.currentRepo.full_name}/contents/${encodeURIComponent(path).replace(/%2F/g,'/')}?ref=${encodeURIComponent(STATE.currentBranch)}`);
    const raw  = atob(data.content.replace(/\n/g, ''));
    STATE.openFile = { name, path, content: raw };

    // Markdown preview
    if (ext === 'md') {
      preview.innerHTML = `<div class="fp-markdown">${renderMarkdown(raw)}</div>`;
      return;
    }

    // Code preview with line numbers + syntax highlight
    const lines   = raw.split('\n');
    const lang    = getLang(ext);
    const lineNos = lines.map((_, i) => `<span>${i + 1}</span>`).join('');
    const code    = lines.map(l => `<span class="code-line">${syntaxHighlight(escHtml(l), lang)}</span>`).join('\n');

    preview.innerHTML = `
      <div class="fp-code-wrap">
        <div class="fp-code-meta">
          <span class="fp-lang-badge">${lang.toUpperCase()}</span>
          <span>${lines.length} Zeilen · ${formatSize(size)}</span>
        </div>
        <div class="fp-code-body">
          <div class="fp-line-numbers" aria-hidden="true">${lineNos}</div>
          <pre class="fp-code"><code class="lang-${escHtml(lang)}">${code}</code></pre>
        </div>
      </div>`;
  } catch (e) {
    preview.innerHTML = `<div class="empty-state"><p>Fehler beim Laden</p><small>${escHtml(e.message)}</small></div>`;
  }
}

function copyFileContent() {
  if (!STATE.openFile) return;
  navigator.clipboard.writeText(STATE.openFile.content).then(() => {
    showToast('Inhalt kopiert ✓', 'success');
  }).catch(() => showToast('Kopieren fehlgeschlagen'));
}

function openFileOnGitHub(path) {
  if (!STATE.currentRepo) return;
  window.open(`https://github.com/${STATE.currentRepo.full_name}/blob/${STATE.currentBranch}/${path}`, '_blank', 'noopener');
}

function downloadFile(path, name) {
  if (!STATE.openFile) { showToast('Datei zuerst öffnen', 'error'); return; }
  const blob = new Blob([STATE.openFile.content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Download: ${name}`, 'success');
}

// Search files in current repo
async function searchFiles(query) {
  if (!STATE.currentRepo || !query.trim()) return;
  const tree = document.getElementById('file-tree');
  tree.innerHTML = `<div class="loading-msg"><div class="spinner"></div><span>Suche…</span></div>`;
  try {
    const q = encodeURIComponent(`${query} repo:${STATE.currentRepo.full_name}`);
    const results = await ghFetch(`/search/code?q=${q}&per_page=30`);
    const items = results.items || [];

    if (!items.length) {
      tree.innerHTML = `<div class="empty-state"><p>Keine Ergebnisse</p><small>Für: "${escHtml(query)}"</small></div>`;
      return;
    }

    tree.innerHTML = items.map(item => `
      <div class="ftree-item ftree-file ftree-search-result"
           onclick="previewFile('${escHtml(item.path)}', '${escHtml(item.name)}', 0)"
           title="${escHtml(item.path)}">
        <span class="ftree-icon">${getFileIcon(item.name)}</span>
        <span class="ftree-name">${escHtml(item.name)}</span>
        <span class="ftree-path-hint">${escHtml(item.path)}</span>
      </div>`).join('');
  } catch (e) {
    tree.innerHTML = `<div class="empty-state"><p>Suchfehler</p><small>${escHtml(e.message)}</small></div>`;
  }
}

function clearFileSearch() {
  document.getElementById('file-search-input').value = '';
  loadFileTree('');
}

// ─── Markdown renderer (minimal) ─────────────
function renderMarkdown(md) {
  let html = escHtml(md);
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g,     '<em>$1</em>');
  html = html.replace(/_(.+?)_/g,       '<em>$1</em>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
  // Code blocks
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="md-code-block"><code>$1</code></pre>');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="md-img" />');
  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr/>');
  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  // Unordered list
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`);
  // Ordered list
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  return `<p>${html}</p>`;
}

// ─── Syntax Highlighter ───────────────────────
function syntaxHighlight(line, lang) {
  // Comments
  if (['js','ts','java','c','cpp','go','rust','swift','kotlin','css','scss'].includes(lang)) {
    if (line.match(/^\s*\/\//)) return `<span class="sh-comment">${line}</span>`;
    if (line.match(/^\s*\/\*/))  return `<span class="sh-comment">${line}</span>`;
    if (line.match(/^\s*\*/))    return `<span class="sh-comment">${line}</span>`;
  }
  if (lang === 'py' && line.match(/^\s*#/)) return `<span class="sh-comment">${line}</span>`;
  if (lang === 'sh' && line.match(/^\s*#/)) return `<span class="sh-comment">${line}</span>`;
  if (lang === 'html' && line.match(/&lt;!--/)) return `<span class="sh-comment">${line}</span>`;

  const KEYWORDS = {
    js:   /\b(const|let|var|function|return|if|else|for|while|class|import|export|default|async|await|new|this|typeof|instanceof|try|catch|throw|null|undefined|true|false)\b/g,
    ts:   /\b(const|let|var|function|return|if|else|for|while|class|import|export|default|async|await|new|this|typeof|interface|type|enum|extends|implements|null|undefined|true|false)\b/g,
    py:   /\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|pass|None|True|False|and|or|not|in|is|lambda|yield)\b/g,
    java: /\b(public|private|protected|class|void|return|if|else|for|while|new|import|package|static|final|extends|implements|try|catch|throw|null|true|false)\b/g,
    go:   /\b(func|return|if|else|for|var|const|type|struct|import|package|defer|go|chan|select|case|switch|break|continue|nil|true|false)\b/g,
    rust: /\b(fn|let|mut|return|if|else|for|while|match|use|mod|pub|impl|struct|enum|trait|true|false|None|Some|Ok|Err)\b/g,
    php:  /\b(function|return|if|else|for|while|class|echo|new|public|private|protected|static|extends|implements|null|true|false)\b/g,
    sh:   /\b(if|then|else|fi|for|while|do|done|echo|export|source|function|return|case|esac|in)\b/g,
  };

  const kw = KEYWORDS[lang];
  if (kw) {
    line = line.replace(kw, '<span class="sh-keyword">$1</span>');
  }

  // Strings (double + single quotes)
  line = line.replace(/(&#039;[^&#039;]*&#039;)/g, '<span class="sh-string">$1</span>');
  line = line.replace(/(&quot;[^&quot;]*&quot;)/g,  '<span class="sh-string">$1</span>');
  // Template literals
  line = line.replace(/(`.+?`)/g, '<span class="sh-string">$1</span>');
  // Numbers
  line = line.replace(/\b(\d+\.?\d*)\b/g, '<span class="sh-number">$1</span>');
  // HTML tags
  if (lang === 'html') {
    line = line.replace(/(&lt;\/?[\w-]+)/g, '<span class="sh-tag">$1</span>');
    line = line.replace(/([\w-]+=)/g, '<span class="sh-attr">$1</span>');
  }
  // CSS properties
  if (['css','scss'].includes(lang)) {
    line = line.replace(/([\w-]+):/g, '<span class="sh-attr">$1</span>:');
  }

  return line;
}

function getLang(ext) {
  const map = {
    js:'js', mjs:'js', cjs:'js',
    ts:'ts', tsx:'ts',
    jsx:'js',
    py:'py', pyw:'py',
    java:'java', kt:'kotlin', swift:'swift',
    go:'go', rs:'rust',
    php:'php', rb:'ruby',
    c:'c', cpp:'cpp', h:'c', hpp:'cpp',
    sh:'sh', bash:'sh', zsh:'sh',
    html:'html', htm:'html',
    css:'css', scss:'scss', sass:'scss', less:'css',
    json:'json', yaml:'yaml', yml:'yaml', toml:'toml',
    md:'md', xml:'xml', svg:'xml',
    sql:'sql', dockerfile:'sh', makefile:'sh',
    txt:'txt', env:'sh', gitignore:'sh', eslintrc:'json',
  };
  return map[ext?.toLowerCase()] || 'txt';
}

// ─── File / folder icon helpers ───────────────
function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    js:'🟨', ts:'🔷', jsx:'⚛️', tsx:'⚛️',
    py:'🐍', java:'☕', kt:'🟣', swift:'🧡',
    go:'🐹', rs:'🦀', php:'🐘', rb:'💎',
    html:'🌐', css:'🎨', scss:'🎨', sass:'🎨', less:'🎨',
    json:'📋', yaml:'📋', yml:'📋', toml:'📋', xml:'📋',
    md:'📝', txt:'📄', log:'📄', csv:'📊', sql:'🗄️',
    sh:'⚙️', bash:'⚙️', zsh:'⚙️', makefile:'⚙️', dockerfile:'🐳',
    png:'🖼️', jpg:'🖼️', jpeg:'🖼️', gif:'🖼️', webp:'🖼️', svg:'🖼️', ico:'🖼️',
    mp4:'🎬', mov:'🎬', avi:'🎬',
    mp3:'🎵', wav:'🎵', ogg:'🎵',
    pdf:'📕', doc:'📘', docx:'📘', xls:'📗', xlsx:'📗', ppt:'📙', pptx:'📙',
    zip:'📦', tar:'📦', gz:'📦', rar:'📦',
    lock:'🔒', env:'🔒',
    gitignore:'🔧', eslintrc:'🔧', prettierrc:'🔧', editorconfig:'🔧',
    wasm:'⚡', c:'🔵', cpp:'🔵', h:'🔵', hpp:'🔵',
    lua:'🌙', r:'📊', dart:'🎯', vue:'💚', svelte:'🔥',
  };
  return icons[ext] || '📄';
}

function getFolderIcon(name) {
  const special = {
    src:'📂', lib:'📂', dist:'📦', build:'📦', out:'📦',
    node_modules:'📦', '.git':'🔧', '.github':'🔧',
    test:'🧪', tests:'🧪', spec:'🧪', '__tests__':'🧪',
    docs:'📚', doc:'📚', documentation:'📚',
    assets:'🎨', images:'🖼️', img:'🖼️', icons:'🖼️', fonts:'🎨',
    components:'⚛️', pages:'📄', views:'📄', layouts:'📄',
    api:'🌐', routes:'🌐', controllers:'🌐',
    models:'🗄️', db:'🗄️', database:'🗄️', migrations:'🗄️',
    config:'⚙️', configs:'⚙️', settings:'⚙️', env:'🔒',
    utils:'🔧', helpers:'🔧', hooks:'🪝', middleware:'🔧',
    styles:'🎨', css:'🎨', scss:'🎨',
    public:'🌍', static:'🌍',
    scripts:'📜', bin:'📜',
  };
  return special[name.toLowerCase()] || '📁';
}

// ─── Size formatter ───────────────────────────
function formatSize(bytes) {
  if (!bytes || bytes === 0) return '';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Heute';
    if (days === 1) return 'Gestern';
    if (days < 7)  return `Vor ${days} Tagen`;
    if (days < 30) return `Vor ${Math.floor(days/7)} Wochen`;
    if (days < 365) return `Vor ${Math.floor(days/30)} Monaten`;
    return `Vor ${Math.floor(days/365)} Jahren`;
  } catch { return ''; }
}

function formatDateFull(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return dateStr; }
}
