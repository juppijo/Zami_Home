const localData = [
  {
    title: "🌸 Zamis Welten",
    links: [
      { label: "Zami GSheet", url: "https://juppijo.github.io/Zaminia-Zen-Theme/GSheet.html", icon: "🌐" },
      { label: "Shambala Luminia", url: "#", icon: "✨" },
      { label: "Zamis Dachwohnung", url: "#", icon: "🎨" },
      { label: "Luna & Mia", url: "#", icon: "🐱" }
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

const music = document.getElementById('bg-music');
const grid = document.getElementById('categories-grid');

/* ── ERWEITERTER STATE ── */
const state = { 
  hue: 180, 
  sat: 70, 
  light: 50,
  isDark: false, 
  isMusicPlaying: false, 
  autoHue: true 
};

/* ── FUNKTION ZUM AKTUALISIEREN ALLER WERTE ── */
function updateAllStyles() {
  const root = document.documentElement;
  root.style.setProperty('--hue', state.hue);
  root.style.setProperty('--sat', state.sat + '%');
  root.style.setProperty('--light', state.light + '%');

  // Anzeige-Texte aktualisieren
  document.getElementById('hue-value').textContent = state.hue + "°";
  document.getElementById('sat-value').textContent = state.sat + "%";
  document.getElementById('light-value').textContent = state.light + "%";

  // Swatches im Panel aktualisieren
  document.getElementById('sw-primary').style.background = `hsl(${state.hue}, ${state.sat}%, ${state.light}%)`;
  document.getElementById('sw-comp').style.background = `hsl(${(parseInt(state.hue) + 180) % 360}, ${state.sat}%, ${state.light}%)`;
  document.getElementById('sw-triad1').style.background = `hsl(${(parseInt(state.hue) + 120) % 360}, ${state.sat}%, ${state.light}%)`;
  document.getElementById('sw-triad2').style.background = `hsl(${(parseInt(state.hue) + 240) % 360}, ${state.sat}%, ${state.light}%)`;
}

/* ── EVENT LISTENER FÜR DIE SCHIEBER ── */
document.getElementById('hue-slider').addEventListener('input', (e) => {
  state.hue = e.target.value;
  updateAllStyles();
});

document.getElementById('sat-slider').addEventListener('input', (e) => {
  state.sat = e.target.value;
  updateAllStyles();
});

document.getElementById('light-slider').addEventListener('input', (e) => {
  state.light = e.target.value;
  updateAllStyles();
});

function updateColors(val) {
  state.hue = val;
  document.documentElement.style.setProperty('--hue', val);
  document.getElementById('hue-value').textContent = val + "°";
  
  // Swatches im Panel aktualisieren
  document.getElementById('sw-primary').style.background = `hsl(${val}, 70%, 50%)`;
  document.getElementById('sw-comp').style.background = `hsl(${(parseInt(val) + 180) % 360}, 65%, 50%)`;
  document.getElementById('sw-triad1').style.background = `hsl(${(parseInt(val) + 120) % 360}, 65%, 50%)`;
  document.getElementById('sw-triad2').style.background = `hsl(${(parseInt(val) + 240) % 360}, 65%, 50%)`;
}

function renderContent() {
  grid.innerHTML = '';
  localData.forEach(cat => {
    const card = document.createElement('div');
    card.className = 'card';
    
    // Hier wird das HTML für die Karte gesetzt
    card.innerHTML = `
      <div class="card-header">
        <span>${cat.title}</span>
        <span class="toggle-icon">▼</span>
      </div>
      <ul class="link-list">
        ${cat.links.map(l => `<li><a href="${l.url}" target="_blank">${l.icon} ${l.label}</a></li>`).join('')}
      </ul>
    `;

    // FEHLER BEHOBEN: Hier fehlte der Event-Listener für den Klick!
    const header = card.querySelector('.card-header');
    header.addEventListener('click', () => {
      card.classList.toggle('collapsed');
    });

    grid.appendChild(card);
  });
}

// Controls
document.getElementById('btn-sound').addEventListener('click', function() {
  state.isMusicPlaying = !state.isMusicPlaying;
  if (state.isMusicPlaying) {
    music.volume = 0.1;
    music.play();
    this.textContent = "🔊";
    this.classList.add('active');
  } else {
    music.pause();
    this.textContent = "🔇";
    this.classList.remove('active');
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


// Initial aufrufen
updateAllStyles();

renderContent();
updateColors(state.hue);

// Auto-Hue
setInterval(() => {
  if (state.autoHue) {
    let nextHue = (parseInt(state.hue) + 1) % 360;
    updateColors(nextHue);
  }
}, 1000);