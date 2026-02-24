/* ── LOKALE DATEN ── */
const localData = [
  {
    title: "🌸 Zamis Welten",
    links: [
      { label: "Zami GSheet", url: "https://juppijo.github.io/Zaminia-Zen-Theme/GSheet.html", icon: "🌐" },
      { label: "Shambala Luminia", url: "#", icon: "✨" },
      { label: "Zamis Dachwohnung", url: "#", icon: "🎨" },
      { label: "Luna (Die Katze)", url: "#", icon: "🐱" }
    ]
  },
  {
    title: "📜 Zen & Wissen",
    links: [
      { label: "50 Verse Bewusstsein", url: "#", icon: "🧘" },
      { label: "WRZT Theorie", url: "#", icon: "🌌" },
      { label: "Intersein", url: "#", icon: "☁️" }
    ]
  }
];

/* ── STATE ── */
const state = {
  hue: 180,
  isDark: false,
  isMusicPlaying: false,
  autoHue: true
};

/* ── DOM ELEMENTE ── */
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnSound      = document.getElementById('btn-sound');
const btnDark       = document.getElementById('btn-dark');
const btnSettings   = document.getElementById('btn-settings');
const panel         = document.getElementById('settings-panel');
const overlay       = document.getElementById('overlay');
const btnClose      = document.getElementById('close-settings');
const hueSlider     = document.getElementById('hue-slider');
const hueValue      = document.getElementById('hue-value');
const music         = document.getElementById('bg-music');
const grid          = document.getElementById('categories-grid');

/* ── FUNKTIONEN ── */

function updateColors(val) {
  state.hue = val;
  document.documentElement.style.setProperty('--hue', val);
  hueValue.textContent = val + "°";
  hueSlider.value = val;
  
  // Harmonien für die Swatches
  document.getElementById('sw-primary').style.background = `hsl(${val}, 70%, 50%)`;
  document.getElementById('sw-comp').style.background = `hsl(${(val + 180) % 360}, 70%, 50%)`;
  document.getElementById('sw-triad').style.background = `hsl(${(val + 120) % 360}, 70%, 50%)`;
}

function renderContent() {
  grid.innerHTML = localData.map(cat => `
    <div class="card">
      <h3 style="color:var(--clr-primary)">${cat.title}</h3>
      <ul class="link-list">
        ${cat.links.map(l => `<li><a href="${l.url}"><span>${l.icon}</span> ${l.label}</a></li>`).join('')}
      </ul>
    </div>
  `).join('');
}

/* ── EVENT LISTENERS ── */

// Fullscreen
btnFullscreen.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
    btnFullscreen.textContent = "🏁";
  } else {
    document.exitFullscreen();
    btnFullscreen.textContent = "⛶";
  }
});

// Darkmode
btnDark.addEventListener('click', () => {
  state.isDark = !state.isDark;
  document.body.classList.toggle('dark-mode', state.isDark);
  btnDark.textContent = state.isDark ? "☀️" : "🌙";
});

// Musik
btnSound.addEventListener('click', () => {
  state.isMusicPlaying = !state.isMusicPlaying;
  if (state.isMusicPlaying) {
    music.volume = 0.1; // 10% Lautstärke
    music.play();
    btnSound.textContent = "🔊";
    btnSound.classList.add('active');
  } else {
    music.pause();
    btnSound.textContent = "🔇";
    btnSound.classList.remove('active');
  }
});

// Einstellungen Panel
btnSettings.addEventListener('click', () => {
  panel.classList.add('active');
  overlay.classList.add('active');
});

[btnClose, overlay].forEach(el => el.addEventListener('click', () => {
  panel.classList.remove('active');
  overlay.classList.remove('active');
}));

// Manueller Hue-Regler
hueSlider.addEventListener('input', (e) => {
  updateColors(parseInt(e.target.value));
});

/* ── INITIALISIERUNG & AUTO-HUE ── */

renderContent();
updateColors(state.hue);

// Der 1° pro Sekunde Kreislauf
setInterval(() => {
  if (state.autoHue) {
    let nextHue = (state.hue + 1) % 360;
    updateColors(nextHue);
  }
}, 1000);