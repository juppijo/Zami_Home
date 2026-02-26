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
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header">
        <span>${cat.title}</span>
        <span class="toggle-icon">▼</span>
      </div>
      <ul class="link-list">
        ${cat.links.map(l => `<li><a href="${l.url}" target="_blank">${l.icon} ${l.label}</a></li>`).join('')}
      </ul>
    `;
    const header = card.querySelector('.card-header');
    header.addEventListener('click', () => card.classList.toggle('collapsed'));
    grid.appendChild(card);
  });
}

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