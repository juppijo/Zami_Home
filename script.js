/* ══════════════════════════════════════
   ZAMINIA HOME – script.js
   ══════════════════════════════════════ */

/* ── State ── */
const state = {
  hue:      parseInt(localStorage.getItem('hue') ?? 180),
  dark:     localStorage.getItem('dark') === 'true',
  sound:    false,
  settingsOpen: false,
};

/* ── DOM Refs ── */
const root         = document.documentElement;
const grid         = document.getElementById('categories-grid');
const hueSlider    = document.getElementById('hue-slider');
const hueVal       = document.getElementById('hue-value');
const btnDark      = document.getElementById('btn-dark');
const btnSound     = document.getElementById('btn-sound');
const btnFullscreen= document.getElementById('btn-fullscreen');
const btnSettings  = document.getElementById('btn-settings');
const settingsPanel= document.getElementById('settings-panel');
const overlay      = document.getElementById('overlay');
const swatches     = document.querySelectorAll('.color-swatch');

/* ── Audio Context (Web Audio API) ── */
let audioCtx = null;
let audioNodes = {};

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Simple ambient drone: two oscillators + reverb-like delay
  const master = audioCtx.createGain();
  master.gain.setValueAtTime(0.06, audioCtx.currentTime);
  master.connect(audioCtx.destination);

  const delay = audioCtx.createDelay(4);
  delay.delayTime.value = 2;
  const feedback = audioCtx.createGain();
  feedback.gain.value = 0.35;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(master);

  const osc1 = audioCtx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 110;
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = 165;

  [osc1, osc2].forEach(o => {
    const g = audioCtx.createGain();
    g.gain.value = 0.5;
    o.connect(g);
    g.connect(delay);
    g.connect(master);
    o.start();
  });

  audioNodes = { master, osc1, osc2 };
}

function setSound(on) {
  state.sound = on;
  if (on) {
    initAudio();
    if (audioCtx?.state === 'suspended') audioCtx.resume();
    audioNodes.master?.gain.setTargetAtTime(0.06, audioCtx.currentTime, 0.5);
  } else {
    audioNodes.master?.gain.setTargetAtTime(0, audioCtx?.currentTime ?? 0, 0.5);
  }
  btnSound.textContent   = on ? '🔊' : '🔇';
  btnSound.title         = on ? 'Ton aus' : 'Ton an';
  btnSound.classList.toggle('active', on);
}

/* ── Dark Mode ── */
function setDark(on) {
  state.dark = on;
  document.body.setAttribute('data-theme', on ? 'dark' : '');
  localStorage.setItem('dark', on);
  btnDark.textContent = on ? '☀️' : '🌙';
  btnDark.title       = on ? 'Light Mode' : 'Dark Mode';
  btnDark.classList.toggle('active', on);
}

/* ── Hue ── */
function setHue(h) {
  state.hue = h;
  root.style.setProperty('--hue', h);
  localStorage.setItem('hue', h);
  hueSlider.value  = h;
  hueVal.textContent = h + '°';
  updateSwatches(h);
}

function updateSwatches(h) {
  const palette = [
    { label: 'Primär',     bg: `hsl(${h}, 70%, 50%)` },
    { label: 'Hell',       bg: `hsl(${h}, 70%, 75%)` },
    { label: 'Dunkel',     bg: `hsl(${h}, 70%, 30%)` },
    { label: 'Komp.',      bg: `hsl(${(h+180)%360}, 65%, 50%)` },
    { label: 'Analog +',   bg: `hsl(${(h+30)%360},  65%, 50%)` },
    { label: 'Analog −',   bg: `hsl(${(h+330)%360}, 65%, 50%)` },
    { label: 'Triade',     bg: `hsl(${(h+120)%360}, 65%, 50%)` },
  ];
  swatches.forEach((sw, i) => {
    if (palette[i]) sw.style.background = palette[i].bg;
  });
}

/* ── Settings Panel ── */
function toggleSettings() {
  state.settingsOpen = !state.settingsOpen;
  settingsPanel.classList.toggle('open', state.settingsOpen);
  overlay.classList.toggle('active', state.settingsOpen);
  btnSettings.classList.toggle('active', state.settingsOpen);
}

function closeSettings() {
  state.settingsOpen = false;
  settingsPanel.classList.remove('open');
  overlay.classList.remove('active');
  btnSettings.classList.remove('active');
}

/* ── Fullscreen ── */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    btnFullscreen.textContent = '⛶';
    btnFullscreen.title = 'Fullscreen beenden';
    btnFullscreen.classList.add('active');
  } else {
    document.exitFullscreen();
    btnFullscreen.textContent = '⛶';
    btnFullscreen.title = 'Fullscreen';
    btnFullscreen.classList.remove('active');
  }
}

document.addEventListener('fullscreenchange', () => {
  const isFs = !!document.fullscreenElement;
  btnFullscreen.textContent = isFs ? '⊡' : '⛶';
  btnFullscreen.classList.toggle('active', isFs);
});

/* ── Load Categories from JSON ── */
async function loadLinks() {
  try {
    const res  = await fetch('links.json');
    if (!res.ok) throw new Error('links.json nicht gefunden');
    const data = await res.json();
    renderCategories(data.categories);
  } catch (err) {
    grid.innerHTML = `<div class="error-msg">
      ⚠️ Fehler beim Laden der Links:<br><code>${err.message}</code><br>
      <small>Stelle sicher, dass <strong>links.json</strong> im gleichen Ordner liegt.</small>
    </div>`;
    console.error(err);
  }
}

function renderCategories(categories) {
  grid.innerHTML = '';
  categories.forEach((cat, idx) => {
    const card = document.createElement('article');
    card.className = 'category-card';
    card.style.animationDelay = `${idx * 0.07}s`;

    const header = document.createElement('div');
    header.className = 'card-header';
    header.textContent = cat.title;

    const ul = document.createElement('ul');
    ul.className = 'link-list';

    cat.links.forEach(link => {
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href   = link.url;
      a.target = '_blank';
      a.rel    = 'noopener noreferrer';
      a.innerHTML = `
        <span class="link-icon">${link.icon || '🔗'}</span>
        <span>${link.label}</span>
        <span class="link-arrow">→</span>`;
      li.appendChild(a);
      ul.appendChild(li);
    });

    card.appendChild(header);
    card.appendChild(ul);
    grid.appendChild(card);
  });
}

/* ── Event Listeners ── */
btnDark.addEventListener('click', () => setDark(!state.dark));
btnSound.addEventListener('click', () => setSound(!state.sound));
btnFullscreen.addEventListener('click', toggleFullscreen);
btnSettings.addEventListener('click', toggleSettings);
overlay.addEventListener('click', closeSettings);

hueSlider.addEventListener('input', (e) => setHue(parseInt(e.target.value)));

/* Keyboard shortcut: Escape = close settings */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSettings();
  if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); }
});

/* ── Init ── */
function init() {
  setDark(state.dark);
  setHue(state.hue);
  setSound(false);
  loadLinks();
}

init();
