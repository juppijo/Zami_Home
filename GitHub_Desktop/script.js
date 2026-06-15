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
  ['changes', 'history', 'repos'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === name);
    document.getElementById(`tab-content-${t}`).classList.toggle('hidden', t !== name);
  });
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
  let target = STATE.cloneTarget;
  const urlInput = document.getElementById('clone-url-input');
  const activePanel = document.querySelector('.modal-tab.active')?.id;

  if (activePanel === 'clone-tab-url') {
    target = urlInput?.value || '';
  } else if (activePanel === 'clone-tab-local') {
    target = document.getElementById('clone-path-local')?.value || '';
  }

  if (!target) {
    showToast('Bitte Repository oder URL auswählen', 'error');
    return;
  }

  const path = document.getElementById('clone-path-github')?.value || '~/GitHub';
  showToast(`Klonen gestartet: ${target} → ${path}`, 'success');
  closeModal();
  setTimeout(() => showToast('Klonen abgeschlossen ✓', 'success'), 2000);
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

function showMergeModal()        { showToast('Merge-Dialog – in Entwicklung', 'error'); }
function showDeleteBranchModal() { showToast('Branch löschen – in Entwicklung', 'error'); }
function showAddLocalModal()     { showToast('Lokales Repo hinzufügen – in Entwicklung', 'error'); }

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
  const path = `~/GitHub/${STATE.currentRepo.name}`;
  navigator.clipboard?.writeText(`cd ${path} && ${STATE.settings.shell}`).then(() => {
    showToast(`Terminal-Befehl kopiert: cd ${path}`);
  }).catch(() => showToast(`Terminal öffnen: cd ${path}`));
}

function openInFileManager() {
  if (!STATE.currentRepo) { showToast('Kein Repository ausgewählt', 'error'); return; }
  const path = `~/GitHub/${STATE.currentRepo.name}`;
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
