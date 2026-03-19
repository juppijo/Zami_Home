/* ── GRUNDKONFIGURATION ── */
const jsonUrl = 'https://raw.githubusercontent.com/juppijo/Zami_Home/main/links.json';
let localData = [];

const music = document.getElementById('bg-music');
const grid = document.getElementById('categories-grid');

/* ── STATE ── */
const state = { 
  hue: 180, 
  sat: 70, 
  light: 50,
  isDark: false, 
  isMusicPlaying: false, 
  autoHue: true 
};

/* ── DATEN LADEN & RENDERN ── */
async function loadLinks() {
  try {
    const response = await fetch(jsonUrl);
    if (!response.ok) throw new Error('Fehler beim Laden der JSON');
    localData = await response.json();
    renderContent();
  } catch (error) {
    console.error("Daten konnten nicht geladen werden:", error);
  }
}

function renderContent() {
  grid.innerHTML = '';
  localData.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'card collapsed';
    card.innerHTML = `
      <div class="card-header">
        <span>${cat.title}</span>
        <span class="toggle-icon">▼</span>
      </div>
      <ul class="link-list">
        ${cat.links.map(l => `<li data-label="${l.label.toLowerCase()}" data-url="${l.url.toLowerCase()}">
          <a href="${l.url}" target="_blank">${l.icon} <span class="link-label">${l.label}</span></a>
        </li>`).join('')}
      </ul>
    `;
    const header = card.querySelector('.card-header');
    header.addEventListener('click', () => card.classList.toggle('collapsed'));
    grid.appendChild(card);
  });

  buildExtFilters();
  filterLinks();
}

/* ── DATEIENDUNGEN ERKENNEN ── */
function getExtension(url) {
  try {
    const clean = url.split('?')[0].split('#')[0];
    const parts = clean.split('/').pop().split('.');
    if (parts.length > 1) {
      const ext = parts.pop().toLowerCase();
      if (/^[a-z0-9]{1,6}$/.test(ext)) return ext;
    }
  } catch (_) {}
  return null;
}

/* ── FILTER-BUTTONS AUFBAUEN ── */
const activeExts = new Set();

function buildExtFilters() {
  const container = document.getElementById('ext-filters');
  if (!container) return;
  container.innerHTML = '';

  const extSet = new Set();
  localData.forEach(cat => cat.links.forEach(l => {
    const ext = getExtension(l.url);
    if (ext) extSet.add(ext);
  }));

  if (extSet.size === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'ext-btn active';
  allBtn.dataset.ext = '__all__';
  allBtn.textContent = '🗂 Alle';
  allBtn.addEventListener('click', () => {
    activeExts.clear();
    container.querySelectorAll('.ext-btn').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    filterLinks();
  });
  container.appendChild(allBtn);

  [...extSet].sort().forEach(ext => {
    const btn = document.createElement('button');
    btn.className = 'ext-btn';
    btn.dataset.ext = ext;
    btn.textContent = '.' + ext.toUpperCase();
    btn.addEventListener('click', () => {
      const allB = container.querySelector('[data-ext="__all__"]');
      if (activeExts.has(ext)) {
        activeExts.delete(ext);
        btn.classList.remove('active');
      } else {
        activeExts.add(ext);
        btn.classList.add('active');
      }
      if (activeExts.size > 0) {
        allB?.classList.remove('active');
      } else {
        allB?.classList.add('active');
      }
      filterLinks();
    });
    container.appendChild(btn);
  });
}

/* ── HIGHLIGHT-HELPER ── */
function highlight(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'),
    '<span class="search-highlight">$1</span>');
}

/* ── HAUPT-FILTERFUNKTION ── */
function filterLinks() {
  const query = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
  const noResults = document.getElementById('no-results');
  let visibleCards = 0;

  document.querySelectorAll('.card').forEach(card => {
    let visibleItems = 0;
    card.querySelectorAll('.link-list li').forEach(li => {
      const label = li.dataset.label || '';
      const url   = li.dataset.url   || '';
      const ext   = getExtension(url);

      const matchesQuery = !query || label.includes(query) || url.includes(query);
      const matchesExt   = activeExts.size === 0 || (ext && activeExts.has(ext));

      if (matchesQuery && matchesExt) {
        li.classList.remove('hidden');
        const labelSpan = li.querySelector('.link-label');
        if (labelSpan) labelSpan.innerHTML = highlight(labelSpan.textContent, query);
        visibleItems++;
      } else {
        li.classList.add('hidden');
        const labelSpan = li.querySelector('.link-label');
        if (labelSpan) labelSpan.innerHTML = labelSpan.textContent;
        visibleItems += 0;
      }
    });

    if (visibleItems > 0) {
      card.classList.remove('filtered-out');
      if (query) card.classList.remove('collapsed');
      visibleCards++;
    } else {
      card.classList.add('filtered-out');
    }
  });

  if (noResults) noResults.style.display = visibleCards === 0 ? 'block' : 'none';
}

/* ── SEARCH EVENT LISTENER ── */
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-input');
  const clearBtn    = document.getElementById('search-clear');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterLinks();
      clearBtn?.classList.toggle('visible', searchInput.value.length > 0);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      clearBtn.classList.remove('visible');
      filterLinks();
    });
  }
});

/* ── STYLING FUNKTIONEN ── */
function updateAllStyles() {
  const root = document.documentElement;
  root.style.setProperty('--hue', state.hue);
  root.style.setProperty('--sat', state.sat + '%');
  root.style.setProperty('--light', state.light + '%');

  document.getElementById('hue-value').textContent = state.hue + "°";
  document.getElementById('sat-value').textContent = state.sat + "%";
  document.getElementById('light-value').textContent = state.light + "%";

  document.getElementById('sw-primary').style.background = `hsl(${state.hue}, ${state.sat}%, ${state.light}%)`;
  document.getElementById('sw-comp').style.background = `hsl(${(parseInt(state.hue) + 180) % 360}, ${state.sat}%, ${state.light}%)`;
  document.getElementById('sw-triad1').style.background = `hsl(${(parseInt(state.hue) + 120) % 360}, ${state.sat}%, ${state.light}%)`;
  document.getElementById('sw-triad2').style.background = `hsl(${(parseInt(state.hue) + 240) % 360}, ${state.sat}%, ${state.light}%)`;
}

/* ── EVENT LISTENER (CONTROLS) ── */
document.getElementById('hue-slider').addEventListener('input', (e) => { state.hue = e.target.value; updateAllStyles(); });
document.getElementById('sat-slider').addEventListener('input', (e) => { state.sat = e.target.value; updateAllStyles(); });
document.getElementById('light-slider').addEventListener('input', (e) => { state.light = e.target.value; updateAllStyles(); });

document.getElementById('btn-sound').addEventListener('click', function() {
  state.isMusicPlaying = !state.isMusicPlaying;
  if (state.isMusicPlaying) {
    music.volume = 0.1;
    music.play();
    this.textContent = "🔊";
  } else {
    music.pause();
    this.textContent = "🔇";
  }
});

document.getElementById('btn-dark').addEventListener('click', function() {
  state.isDark = !state.isDark;
  document.body.classList.toggle('dark-mode', state.isDark);
  this.textContent = state.isDark ? "☀️" : "🌙";
});

document.getElementById('btn-fullscreen').addEventListener('click', function() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    this.textContent = "🏁";
  } else {
    document.exitFullscreen();
    this.textContent = "⛶";
  }
});

document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('settings-panel').classList.add('active');
  document.getElementById('overlay').classList.add('active');
});

document.getElementById('close-settings').addEventListener('click', () => {
  document.getElementById('settings-panel').classList.remove('active');
  document.getElementById('overlay').classList.remove('active');
});

/* ── INTRO LOGIK (VIDEO & TON) ── */
window.addEventListener('DOMContentLoaded', () => {
  const introOverlay = document.getElementById('intro-overlay');
  const video = document.getElementById('intro-video');
  const text = document.getElementById('intro-text');
  const unmuteBtn = document.getElementById('unmute-btn');
  const videoHint = document.getElementById('video-hint');
  const logoClick = document.getElementById('header-logo-click');

  // Funktion zum Entstummen
  const enableSound = () => {
    video.muted = false;
    if (unmuteBtn) unmuteBtn.textContent = "🔇 Ton ausschalten";
    if (videoHint) videoHint.textContent = "🔊 Ton ist an";
  };

  /* DER TRICK: Ein einziger Klick auf das ganze Intro-Fenster
  introOverlay.addEventListener('click', () => {
    video.muted = false; // Ton geht an
    video.play();        // Video spielt (falls es noch nicht lief)
    
    // Optional: Startet auch die Hintergrundmusik
    music.volume = 0.1;
    music.play();
    state.isMusicPlaying = true;
    document.getElementById('btn-sound').textContent = "🔊";
    
    console.log("Interaktion erkannt: Ton ist jetzt überall erlaubt!");
  }, { once: true }); // {once: true} sorgt dafür, dass der Klick nur einmal registriert wird
  // ... Rest deiner Animation (shrink etc.) */

  // Klick auf Video
  video.addEventListener('click', enableSound);

  // Klick auf Button
  unmuteBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Verhindert doppeltes Auslösen
    enableSound();
  });

  // Klick auf Logo im Header (Hintergrundmusik + Video-Ton)
  logoClick.addEventListener('click', () => {
    enableSound();
    if (music.paused) {
      music.volume = 0.1;
      music.play();
      state.isMusicPlaying = true;
      document.getElementById('btn-sound').textContent = "🔊";
    }
  });

  // Intro-Animation starten
  setTimeout(() => {
    text.style.opacity = '1';
    text.style.transform = 'translateY(0)';
    video.play().catch(e => console.log("Autoplay blocked"));
  }, 500);

  video.onended = () => finishIntro();

  // Sicherheits-Timeout für das Intro
  setTimeout(() => {
    if (!introOverlay.classList.contains('shrink')) finishIntro();
  }, 8000);

  function finishIntro() {
    introOverlay.classList.add('shrink');
    setTimeout(() => {
      introOverlay.style.display = 'none';
    }, 1200);
  }
});

/* ── INITIALISIERUNG ── */
loadLinks();
updateAllStyles();

setInterval(() => {
  if (state.autoHue) {
    state.hue = (parseInt(state.hue) + 1) % 360;
    updateAllStyles();
  }
}, 1000);