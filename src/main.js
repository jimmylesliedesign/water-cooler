import { createScreenPainter } from './screen-painter.js';

// The page has two states around the real game, which runs untouched in an
// iframe: an idle 3D showcase with the game's start screen on the model, and a
// zoomed-in play state where the game itself sits exactly over that screen.
//
// body[data-state]: loading → idle → zoom-in → play → zoom-out → idle
//                   (or fallback, the original 2D page, if 3D can't run)

const $ = (id) => document.getElementById(id);
const body = document.body;
const frame = $('game');
const gl = $('gl');
const soundBtn = $('sound');
const soundLabel = $('soundLabel');
const prompt = $('prompt');
const bar = document.querySelector('.bar');
const pad = $('pad');

const FADE_MS = 150;
// Matches .pad's height in page.css (plus the safe area, which play framing ignores).
const PAD_HEIGHT = 164;
const SOUND_KEY = 'watercooler:sound';

let state = 'loading';
let scene = null;
const painter = createScreenPainter(frame);
const coarse = matchMedia('(pointer: coarse)');

function setState(next) {
  state = next;
  body.dataset.state = next;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// The game, in its frame
// ---------------------------------------------------------------------------

function game() {
  try {
    const doc = frame.contentDocument;
    if (doc && doc.readyState !== 'loading' && doc.getElementById('start')) return { doc, win: frame.contentWindow };
  } catch {}
  return null;
}

function whenGameReady() {
  return new Promise((resolve) => {
    const check = () => (game() ? resolve(game()) : setTimeout(check, 30));
    check();
  });
}

let soundObserver = null;

// Runs on every (re)load of the game: mirror its sound state and catch Esc
// before the game sees it, since here Esc leaves rather than opening its menu.
function attachGame() {
  const g = game();
  if (!g) return;
  const inner = g.doc.getElementById('sound');
  if (soundObserver) soundObserver.disconnect();
  soundObserver = new MutationObserver(syncSound);
  soundObserver.observe(inner, { attributes: true, attributeFilter: ['aria-pressed'] });
  syncSound();

  g.win.addEventListener(
    'keydown',
    (e) => {
      if (e.code === 'Escape' && state === 'play' && !e.repeat) {
        e.preventDefault();
        e.stopImmediatePropagation();
        exitPlay();
      }
    },
    true,
  );
  g.win.addEventListener('pointerdown', (e) => e.pointerType === 'touch' && setTouch(true), true);
}
frame.addEventListener('load', attachGame);

function readStoredSound() {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
  }
}

function syncSound() {
  const g = game();
  const on = g ? g.doc.getElementById('sound').getAttribute('aria-pressed') === 'true' : readStoredSound();
  soundBtn.setAttribute('aria-pressed', String(on));
  soundLabel.textContent = on ? 'Sound on' : 'Sound off';
}

// The header toggle drives the game's own one, so behaviour (and the saved
// setting) stays exactly as it was.
soundBtn.addEventListener('click', () => {
  const g = game();
  if (g) g.doc.getElementById('sound').click();
  else {
    try {
      localStorage.setItem(SOUND_KEY, readStoredSound() ? 'off' : 'on');
    } catch {}
  }
  syncSound();
  soundBtn.blur();
});
syncSound();

// Synthetic keys go through the game's own keyboard handler.
function sendKey(type, code) {
  const g = game();
  if (!g) return;
  const key = { Space: ' ', KeyP: 'p', KeyQ: 'q' }[code] || code;
  g.doc.body.dispatchEvent(new g.win.KeyboardEvent(type, { code, key, bubbles: true, cancelable: true }));
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

// The frame always has the size the screen will have once zoomed in, so the
// start screen painted from it is laid out exactly as the overlay will be.
function layout() {
  if (!scene) return;
  const r = scene.playScreenRect();
  Object.assign(frame.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
  body.style.setProperty('--prompt-y', `${Math.round(scene.idleBottom() + 28)}px`);
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

async function enterPlay() {
  if (state !== 'idle') return;
  setState('zoom-in');
  await scene.zoomIn();
  if (state !== 'zoom-in') return;
  layout();
  // Crossfade the real game in over its texture, then start it.
  setState('play');
  frame.removeAttribute('aria-hidden');
  frame.tabIndex = 0;
  await wait(FADE_MS);
  if (state !== 'play') return;
  const g = await whenGameReady();
  g.doc.getElementById('start').click();
  frame.focus();
  g.win.focus();
}

async function exitPlay() {
  if (state !== 'play') return;
  setState('zoom-out');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.blur();
  window.focus();
  for (const b of pad.querySelectorAll('.is-down')) b.classList.remove('is-down');
  const back = scene.zoomOut();
  // Reset once the overlay has faded: a fresh load is the game's own start state.
  wait(FADE_MS + 20).then(() => {
    if (state !== 'play') frame.contentWindow.location.reload();
  });
  await back;
  if (state === 'zoom-out') setState('idle');
}

function fallback(err) {
  if (err) console.warn('[gameboy] 3D unavailable, using the 2D handheld', err);
  if (scene) {
    scene.dispose();
    scene = null;
  }
  setState('fallback');
  frame.removeAttribute('style');
  frame.removeAttribute('aria-hidden');
  frame.tabIndex = 0;
  frame.addEventListener('load', () => frame.contentWindow.focus(), { once: true });
  frame.src = 'game/index.html';
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

function setTouch(on) {
  body.classList.toggle('is-touch', on);
  if (scene) scene.setTouch(on);
}
setTouch(coarse.matches);
window.addEventListener('pointerdown', (e) => e.pointerType === 'touch' && setTouch(true), { capture: true });

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (state === 'idle' && e.code === 'Space') {
    if (document.activeElement && document.activeElement.matches('a, button')) return;
    e.preventDefault();
    enterPlay();
  } else if (state === 'play' && e.code === 'Escape') {
    exitPlay();
  }
});

$('scene').addEventListener('click', () => {
  if (state === 'idle') enterPlay();
});

window.addEventListener('pointermove', (e) => {
  if (!scene || e.pointerType === 'touch') return;
  scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, 1 - (e.clientY / window.innerHeight) * 2);
});
document.documentElement.addEventListener('pointerleave', () => scene && scene.setPointer(0, 0));

// Touch pad: each button holds its key down for as long as it's pressed.
for (const btn of pad.querySelectorAll('button')) {
  const code = btn.dataset.key;
  const press = (e) => {
    e.preventDefault();
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {}
    btn.classList.add('is-down');
    if (btn.dataset.action === 'exit') exitPlay();
    else sendKey('keydown', code);
  };
  const release = () => {
    if (!btn.classList.contains('is-down')) return;
    btn.classList.remove('is-down');
    if (code) sendKey('keyup', code);
  };
  btn.addEventListener('pointerdown', press);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);
  btn.addEventListener('lostpointercapture', release);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------------------------------------------------------------------------
// Boot: three.js and the model load after first paint
// ---------------------------------------------------------------------------

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

async function boot() {
  if (!hasWebGL()) return fallback(new Error('WebGL is not available'));
  try {
    const { createScene } = await import('./scene.js');
    if (document.fonts) {
      // The idle screen is painted here, not in the game's frame, so this
      // document needs the game's screen font too (same file, same relative URL).
      const screenFont = new FontFace(
        'pokemon-font',
        "url('game/fonts/pokemon-font.woff2') format('woff2'), url('game/fonts/pokemon-font.woff') format('woff')",
      );
      document.fonts.add(screenFont);
      await Promise.all([
        document.fonts.load('600 16px "Pixelify Sans"'),
        screenFont.load(),
      ]).catch(() => {});
    }
    scene = await createScene({
      container: gl,
      screen: painter.canvas,
      headerHeight: () => bar.getBoundingClientRect().bottom,
      footerHeight: () => (body.classList.contains('is-touch') ? PAD_HEIGHT : 0),
      onLayout: layout,
      beforeRender() {
        if (state === 'play' || !scene) return;
        const painted = painter.paint(Math.min(window.devicePixelRatio || 1, 2));
        if (painted) scene.screenChanged(painted === 'resized');
      },
    });
    scene.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      fallback(new Error('WebGL context lost'));
    });
    scene.setTouch(body.classList.contains('is-touch'));
    layout();
    setState('idle');
  } catch (err) {
    fallback(err);
  }
}

requestAnimationFrame(() => setTimeout(boot, 0));

// Free the GPU resources and listeners when the page goes away for good
// (kept as-is if it's only parked in the back/forward cache).
window.addEventListener('pagehide', (e) => {
  if (e.persisted || !scene) return;
  scene.dispose();
  scene = null;
  if (soundObserver) soundObserver.disconnect();
});

// Debug hook for checking states and framing from the console.
window.__gameboy = {
  get state() {
    return state;
  },
  get scene() {
    return scene;
  },
  enterPlay,
  exitPlay,
};
