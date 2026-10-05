(() => {
  'use strict';

  const { TALKS, IDLE, PROPS } = window.WC_SCRIPT;
  const ART = window.WC_SPRITES;
  const OFFICE = window.WC_OFFICE;
  const Sound = window.WC_SOUND;

  // A Game Boy Color screen: 160x144, built from 8px tiles. People and furniture
  // sit on 16px metatiles, like the overworld in Gold and Silver.
  const SCREEN_W = 160;
  const SCREEN_H = 144;
  const TILE = 8;
  const T = 16;
  const COLS = 21;
  const ROWS = 12;
  const WALL_ROWS = 3;
  const ROOM_W = COLS * T;
  const ROOM_H = ROWS * T;
  // Where the player stands on screen: metatile (4, 4), sprites drawn 4px up.
  const HERO_X = 64;
  const HERO_Y = 64;
  const SPRITE_LIFT = 4;
  // One tile per 16 frames at 60fps, the classic walking pace.
  const STEP_TIME = 16 / 60;
  const TURN_DELAY = 0.09;
  // Text: 18 characters a line, two lines a box, like Gold and Silver.
  const LINE_CHARS = 18;
  const LINE_W = LINE_CHARS * 8;
  const CHARS_PER_SEC = 45;

  const VOID = '#000000';
  const INK = '#181818';
  const PAPER = '#f8f8f8';
  const FRAME_MID = '#6880b0';

  const IDS = ['designer', 'engineer', 'pm'];
  const NAMES = {
    designer: 'The Designer',
    engineer: 'The Engineer',
    pm: 'The Product Manager',
    ai: 'The Assistant',
  };
  // How each speaker is labelled in the text box, GBC style.
  const TAGS = { designer: 'DESIGNER', engineer: 'ENGINEER', pm: 'PM', ai: 'ASSISTANT' };
  const SHORT = { designer: 'Designer', engineer: 'Engineer', pm: 'PM' };
  const LETTER = { designer: 'D', engineer: 'E', pm: 'P', ai: 'A' };
  const BY_LETTER = { D: 'designer', E: 'engineer', P: 'pm', A: 'ai' };

  const $ = (id) => document.getElementById(id);
  const el = {
    device: $('device'),
    lcd: $('lcd'),
    stage: $('stage'),
    canvas: $('game'),
    hint: $('hint'),
    switcher: $('switcher'),
    dlgLive: $('dlgLive'),
    title: $('title'),
    start: $('start'),
    sound: $('sound'),
    soundLabel: $('soundLabel'),
    screenBtn: $('screenBtn'),
    screenLabel: $('screenLabel'),
    shellBtn: $('shellBtn'),
    shellLabel: $('shellLabel'),
    dpad: $('dpad'),
    btnA: $('btnA'),
    btnB: $('btnB'),
    btnSelect: $('btnSelect'),
    btnStart: $('btnStart'),
  };

  // ---------------------------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------------------------

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return [c, x];
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  el.canvas.width = SCREEN_W;
  el.canvas.height = SCREEN_H;
  const ctx = el.canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;

  function R(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  }

  // ---------------------------------------------------------------------------
  // Sprites: 16x16, three colours and transparent, like GBC OBJ palettes
  // ---------------------------------------------------------------------------

  const mirror = (rows) => rows.map((r) => r.split('').reverse().join(''));

  function buildSprite(rows, pal) {
    const [c, x] = makeCanvas(rows[0].length, rows.length);
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const k = '123'.indexOf(row[i]);
        if (k < 0) continue;
        x.fillStyle = pal[k];
        x.fillRect(i, j, 1, 1);
      }
    });
    return c;
  }

  // Walking up or down swaps feet by mirroring the step frame, as GSC does.
  const sprites = {};
  for (const id of IDS) {
    const def = ART.people[id];
    const b = (rows) => buildSprite(rows, def.pal);
    sprites[id] = {
      down: [b(def.down[0]), b(def.down[1]), b(mirror(def.down[1]))],
      up: [b(def.up[0]), b(def.up[1]), b(mirror(def.up[1]))],
      left: [b(def.left[0]), b(def.left[1])],
      right: [b(mirror(def.left[0])), b(mirror(def.left[1]))],
    };
  }
  const aiFrames = ART.ai.frames.map((f) => buildSprite(f, ART.ai.pal));
  const emotes = {};
  for (const k of ['!', '?', 'note', 'heart', 'dots', 'spark', 'sweat']) {
    if (ART.emotes[k]) emotes[k] = buildSprite(ART.emotes[k], ART.emotes.pal);
  }
  const marker = buildSprite(ART.marker.rows, ART.marker.pal);
  // Twinkles for swapping characters: a big and a small star.
  const STAR_PAL = ['#f8f8f8', '#f8d838', '#181818'];
  const stars = [
    ['...3....', '..323...', '.32123..', '3211123.', '.32123..', '..323...', '...3....', '........'],
    ['........', '........', '...3....', '..313...', '...3....', '........', '........', '........'],
  ].map((rows) => buildSprite(rows, STAR_PAL));

  // ---------------------------------------------------------------------------
  // Text: the Gold/Silver pixel font, snapped to its native 8x8 grid
  // ---------------------------------------------------------------------------

  // pokemon-font is drawn on a 2x grid at 16px, so sampling every other pixel
  // gives the exact 8x8 glyphs. Each glyph is cached per colour as a tiny canvas.
  const FONT = '16px "pokemon-font"';
  let fontReady = false;
  const glyphBits = new Map();
  const glyphCache = new Map();
  const gc = document.createElement('canvas');
  gc.width = 16;
  gc.height = 24;
  const gx = gc.getContext('2d', { willReadFrequently: true });

  function bitsFor(ch) {
    if (glyphBits.has(ch)) return glyphBits.get(ch);
    gx.clearRect(0, 0, 16, 24);
    gx.font = FONT;
    gx.textBaseline = 'alphabetic';
    gx.fillStyle = '#000';
    gx.fillText(ch, 0, 18);
    const d = gx.getImageData(0, 0, 16, 24).data;
    // Rows 0-9 of the cell; capitals start on row 1, descenders reach row 9.
    const bits = new Uint8Array(8 * 10);
    let any = false;
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 8; c++) {
        const on = d[((r * 2 + 2) * 16 + c * 2) * 4 + 3] > 127;
        bits[r * 8 + c] = on ? 1 : 0;
        any = any || on;
      }
    }
    const out = any || ch === ' ' ? bits : null;
    glyphBits.set(ch, out);
    return out;
  }

  // A copyright sign, which the font draws too small to read at 8px.
  const COPYRIGHT = ['..###...', '.#...#..', '#.###.#.', '#.#...#.', '#.###.#.', '.#...#..', '..###...'];
  glyphBits.set('©', Uint8Array.from({ length: 80 }, (_, i) => {
    const r = Math.floor(i / 8) - 1;
    return r >= 0 && r < 7 && COPYRIGHT[r][i % 8] === '#' ? 1 : 0;
  }));

  const bitsOf = (ch) => bitsFor(ch) || bitsFor('?');

  // Text is spaced by each glyph's ink, one pixel apart, so narrow letters and
  // punctuation sit snugly instead of floating in a full 8px cell.
  const SPACE_W = 4;
  const inkCache = new Map();
  function ink(ch) {
    let k = inkCache.get(ch);
    if (k) return k;
    const bits = bitsOf(ch);
    let l = 8;
    let r = -1;
    for (let i = 0; i < bits.length; i++) {
      if (!bits[i]) continue;
      l = Math.min(l, i % 8);
      r = Math.max(r, i % 8);
    }
    k = r < 0 ? { l: 0, w: SPACE_W } : { l, w: r - l + 2 };
    inkCache.set(ch, k);
    return k;
  }

  function measure(str) {
    if (!fontReady) return str.length * 8;
    let w = 0;
    for (const ch of str) w += ch === ' ' ? SPACE_W : ink(ch).w;
    return w;
  }

  function glyph(ch, col) {
    const key = ch + col;
    let g = glyphCache.get(key);
    if (g) return g;
    const bits = bitsOf(ch);
    const [c, x] = makeCanvas(8, 10);
    x.fillStyle = col;
    for (let i = 0; i < bits.length; i++) if (bits[i]) x.fillRect(i % 8, Math.floor(i / 8), 1, 1);
    glyphCache.set(key, c);
    return c;
  }

  // y is the top of the text row (a tile row); glyphs start one pixel above it.
  // Returns the x just after the last glyph.
  function text(str, x, y, col = INK) {
    if (!fontReady) return x;
    for (const ch of str) {
      if (ch === ' ') {
        x += SPACE_W;
        continue;
      }
      const k = ink(ch);
      ctx.drawImage(glyph(ch, col), x - k.l, y - 1);
      x += k.w;
    }
    return x;
  }

  const centred = (str, y, col) => text(str, Math.round((SCREEN_W - measure(str)) / 2), y, col);

  // Characters the font lacks are swapped for ones it has.
  function normalise(str) {
    return str
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...');
  }

  // Greedy word wrap to the text box's width in pixels. Words too long for a
  // line break after an underscore, hyphen or slash where they can.
  function wrap(str, width = LINE_W) {
    const words = normalise(str).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    const fits = (s) => measure(s) <= width;
    for (let w of words) {
      while (!fits(w)) {
        const lead = line ? line + ' ' : '';
        let cut = 0;
        let soft = 0;
        for (let i = 1; i < w.length; i++) {
          if (!fits(lead + w.slice(0, i))) break;
          cut = i;
          if ('_-/'.includes(w[i - 1])) soft = i;
        }
        if (soft) cut = soft;
        if (cut < 3) {
          if (line) lines.push(line);
          line = '';
          if (cut === 0 && !lead) cut = 1;
          else continue;
        }
        lines.push(lead + w.slice(0, cut));
        line = '';
        w = w.slice(cut);
      }
      if (!line) line = w;
      else if (fits(line + ' ' + w)) line += ' ' + w;
      else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // A framed box on the tile grid: x, y, w, h in tiles.
  function frameBox(tx, ty, tw, th) {
    const x = tx * TILE;
    const y = ty * TILE;
    const w = tw * TILE;
    const h = th * TILE;
    R(x, y, w, h, PAPER);
    // Outer line, rounded at the corners, then a thin inner rule.
    R(x + 2, y + 1, w - 4, 2, INK);
    R(x + 2, y + h - 3, w - 4, 2, INK);
    R(x + 1, y + 2, 2, h - 4, INK);
    R(x + w - 3, y + 2, 2, h - 4, INK);
    R(x + 4, y + 4, w - 8, 1, FRAME_MID);
    R(x + 4, y + h - 5, w - 8, 1, FRAME_MID);
    R(x + 4, y + 4, 1, h - 8, FRAME_MID);
    R(x + w - 5, y + 4, 1, h - 8, FRAME_MID);
  }

  // The blinking "more" arrow, from the font itself.
  function downArrow(x, y) {
    if (Math.floor(time * 2.5) % 2 === 0) text('▼', x, y);
  }

  // Big two-tone letters for the logo: the font's glyphs made bold, doubled,
  // outlined and given a hard drop shadow, like a GBC title logo.
  function bigWord(str, fill, light, outline, shadow) {
    const adv = 18;
    const w = str.length * adv + 4;
    const h = 26;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < str.length; i++) {
      const bits = bitsFor(str[i]);
      if (!bits) continue;
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          const on = (c < 8 && bits[r * 8 + c]) || (c > 0 && bits[r * 8 + c - 1]);
          if (!on) continue;
          for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) mask[(r * 2 + dy) * w + 1 + i * adv + c * 2 + dx] = 1;
        }
      }
    }
    const [c, x] = makeCanvas(w, h);
    const at = (i, j) => i >= 0 && j >= 0 && i < w && j < h && mask[j * w + i];
    const edge = (i, j) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(i + dx, j + dy)) return true;
      return false;
    };
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (at(i, j)) x.fillStyle = j < 10 ? light : fill;
        else if (edge(i, j)) x.fillStyle = outline;
        else if (edge(i - 1, j - 2) || edge(i, j - 2)) x.fillStyle = shadow;
        else continue;
        x.fillRect(i, j, 1, 1);
      }
    }
    return c;
  }

  // ---------------------------------------------------------------------------
  // Screen modes
  // ---------------------------------------------------------------------------

  // Four shades of pea soup, picked by brightness like the original LCD.
  const GREENS = [
    [8, 56, 16],
    [48, 96, 48],
    [136, 168, 8],
    [152, 184, 16],
  ];
  const GREEN_LUT = new Uint8Array(256);
  for (let l = 0; l < 256; l++) GREEN_LUT[l] = l < 72 ? 0 : l < 138 ? 1 : l < 196 ? 2 : 3;

  let screenMode = 'colour';
  let shellTheme = 'grey';

  // Post-processing on the finished frame: the green screen, and palette fades
  // to white (stepped, the way GBC games fade between scenes).
  function finishFrame() {
    const fadeStep = Math.round(fade.level * 4) / 4;
    if (screenMode !== 'green' && fadeStep === 0) return;
    const img = ctx.getImageData(0, 0, SCREEN_W, SCREEN_H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];
      if (fadeStep) {
        r += (248 - r) * fadeStep;
        g += (248 - g) * fadeStep;
        b += (248 - b) * fadeStep;
      }
      if (screenMode === 'green') [r, g, b] = GREENS[GREEN_LUT[(r * 77 + g * 150 + b * 29) >> 8]];
      d[i] = r & 0xf8;
      d[i + 1] = g & 0xf8;
      d[i + 2] = b & 0xf8;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintPortrait(canvas, id) {
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(sprites[id].down[0], 0, 0);
  }

  // ---------------------------------------------------------------------------
  // The office
  // ---------------------------------------------------------------------------

  const bg = (() => {
    const [c, x] = makeCanvas(ROOM_W, ROOM_H);
    OFFICE.paintStatic(x);
    return c;
  })();

  const COOLER_TILE = [10, 6];
  const office = { brew: 0, gurgle: 0 };

  // [col, row, width, height] in tiles.
  const SOLIDS = [
    [5, 3, 2, 1],
    [7, 3, 1, 1],
    [1, 4, 3, 2],
    [2, 6, 1, 1],
    [1, 8, 3, 2],
    [2, 10, 1, 1],
    [17, 4, 3, 2],
    [18, 6, 1, 1],
    [17, 8, 3, 2],
    [COOLER_TILE[0], COOLER_TILE[1], 1, 1],
    [8, 11, 5, 1],
    [5, 11, 2, 1],
    [0, 11, 1, 1],
    [20, 11, 1, 1],
  ];
  const solid = new Uint8Array(COLS * ROWS);
  for (let ty = 0; ty < WALL_ROWS; ty++) for (let tx = 0; tx < COLS; tx++) solid[ty * COLS + tx] = 1;
  for (const [sx, sy, sw, sh] of SOLIDS) {
    for (let ty = sy; ty < sy + sh; ty++) for (let tx = sx; tx < sx + sw; tx++) solid[ty * COLS + tx] = 1;
  }

  // Things you can face and press A on. Tiles are [col, row, width, height];
  // mark is where the little arrow points, in room pixels.
  const props = [
    { id: 'whiteboard', label: 'Read the whiteboard', tiles: [8, 2, 5, 1], mark: [168, 4] },
    { id: 'poster', label: 'Look at the poster', tiles: [14, 2, 1, 1], mark: [236, 6] },
    { id: 'employee', label: 'Look at the photo', tiles: [15, 2, 1, 1], mark: [248, 7] },
    { id: 'window', label: 'Look outside', tiles: [1, 2, 3, 1], mark: [40, 4] },
    { id: 'window', label: 'Look outside', tiles: [17, 2, 3, 1], mark: [296, 4] },
    { id: 'bookshelf', label: 'Browse the bookshelf', tiles: [5, 2, 2, 2], mark: [96, 14] },
    { id: 'kevin', label: 'Say hi to Kevin', tiles: [7, 3, 1, 1], mark: [120, 38] },
    { id: 'engineerDesk', label: "Look at the Engineer's desk", own: 'Check your screens', tiles: [1, 4, 3, 3], mark: [40, 58] },
    { id: 'designerDesk', label: "Look at the Designer's desk", own: 'Check your artboards', tiles: [1, 8, 3, 3], mark: [40, 120] },
    { id: 'pmDesk', label: "Look at the PM's desk", own: 'Check your tabs', tiles: [17, 4, 3, 3], mark: [296, 62] },
    { id: 'coffee', label: 'Make a coffee', tiles: [17, 8, 3, 2], mark: [284, 122], sfx: 'brew' },
    { id: 'cooler', label: 'Use the water cooler', tiles: [COOLER_TILE[0], COOLER_TILE[1], 1, 1], mark: [168, 76], sfx: 'gurgle' },
    { id: 'sofa', label: 'Look at the couch', tiles: [8, 11, 5, 1], mark: [168, 165] },
    { id: 'printer', label: 'Check the printer', tiles: [5, 11, 2, 1], mark: [96, 165] },
    { id: 'plant', label: 'Look at the plant', tiles: [0, 11, 1, 1], mark: [9, 167] },
    { id: 'plant', label: 'Look at the plant', tiles: [20, 11, 1, 1], mark: [ROOM_W - 9, 167] },
  ];
  if (OFFICE.marks) for (const p of props) if (OFFICE.marks[p.id]) p.mark = OFFICE.marks[p.id];
  const ownDesk = { engineerDesk: 'engineer', designerDesk: 'designer', pmDesk: 'pm' };

  // ---------------------------------------------------------------------------
  // People
  // ---------------------------------------------------------------------------

  const makePerson = (id, tx, ty, dir) => ({
    id, tx, ty, px: tx * T, py: ty * T, dir,
    moving: false, to: null, t: 0, parity: 0, frame: 0, turnT: 0, bumpT: 0,
    lookT: 1 + Math.random() * 3,
  });
  const people = {
    designer: makePerson('designer', 8, 7, 'right'),
    engineer: makePerson('engineer', 12, 7, 'left'),
    pm: makePerson('pm', 10, 8, 'up'),
  };
  const ai = {
    tx: 14, ty: 5, px: 14 * T, py: 5 * T, moving: false, to: null, from: null, t: 0, wanderT: 4,
  };
  const AI_AREA = { x0: 13, y0: 4, x1: 15, y1: 6 };

  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  // The Assistant hovers: up a pixel, down a pixel, on a slow two-beat.
  const aiBob = () => (Math.floor(time * 2) % 2 ? -1 : 0);

  function occupant(tx, ty, self) {
    for (const id of IDS) {
      const p = people[id];
      if (p === self) continue;
      if ((p.tx === tx && p.ty === ty) || (p.moving && p.to[0] === tx && p.to[1] === ty)) return p;
    }
    if (ai !== self && ((ai.tx === tx && ai.ty === ty) || (ai.moving && ai.to[0] === tx && ai.to[1] === ty))) return ai;
    return null;
  }

  function blockedTile(tx, ty, self) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    if (solid[ty * COLS + tx]) return true;
    return !!occupant(tx, ty, self);
  }

  function faceToward(p, x, y) {
    const dx = x - p.px;
    const dy = y - p.py;
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
    else p.dir = dy > 0 ? 'down' : 'up';
  }

  function drawPerson(p) {
    const set = sprites[p.id][p.dir];
    // Frames: 0 standing, 1 step, 2 the other foot (side views have one step).
    const f = Math.min(p.frame, set.length - 1);
    ctx.drawImage(set[f], Math.round(p.px), Math.round(p.py) - SPRITE_LIFT);
  }

  function drawAI() {
    const f = aiFrames[Math.floor(time * 2) % aiFrames.length];
    ctx.drawImage(f, Math.round(ai.px), Math.round(ai.py) - SPRITE_LIFT - 2 + aiBob());
  }

  // Top of a speaker's sprite, in room pixels.
  function headPos(id) {
    if (id === 'ai') return [Math.round(ai.px), Math.round(ai.py) - SPRITE_LIFT - 2 + aiBob()];
    const p = people[id];
    return [Math.round(p.px), Math.round(p.py) - SPRITE_LIFT];
  }

  // A sparkle of 2-frame stars when you swap who you are.
  const sparkle = { x: 0, y: 0, t: 1 };

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------

  let state = 'title';
  let playerId = 'designer';
  let target = null;
  let time = 0;
  let emote = null;
  const fade = { level: 0, dir: 0, then: null };
  const toastState = { msg: '', t: 0 };
  const talkCount = {};
  const propCount = {};
  const lastIdle = {};
  // Most recently pressed direction wins, like a real D-pad.
  const dirStack = [];
  let touchDir = null;
  let touchUI = window.matchMedia('(pointer: coarse)').matches;

  const player = () => people[playerId];
  const heldDir = () => (dirStack.length ? dirStack[dirStack.length - 1] : touchDir);

  function tryStep(p) {
    const [dx, dy] = DIRV[p.dir];
    const nx = p.tx + dx;
    const ny = p.ty + dy;
    if (blockedTile(nx, ny, p)) return false;
    p.moving = true;
    p.to = [nx, ny];
    p.t = 0;
    p.parity ^= 1;
    p.bumpT = 0;
    return true;
  }

  // Whole pixels only, and a stride frame for the first half of each step.
  function placeStep(p) {
    const k = Math.floor(p.t * T);
    p.px = p.tx * T + (p.to[0] - p.tx) * k;
    p.py = p.ty * T + (p.to[1] - p.ty) * k;
    p.frame = p.t < 0.5 ? (p.parity ? 1 : 2) : 0;
  }

  function arrive(p) {
    p.tx = p.to[0];
    p.ty = p.to[1];
    p.px = p.tx * T;
    p.py = p.ty * T;
    p.moving = false;
    p.to = null;
    p.t = 0;
  }

  function updateWalker(p, want, dt) {
    if (p.moving) {
      p.t += dt / STEP_TIME;
      if (p.t < 1) return placeStep(p);
      const over = p.t - 1;
      arrive(p);
      // Keep walking without a pause if the direction is still held.
      if (want) {
        p.dir = want;
        if (tryStep(p)) {
          p.t = over;
          return placeStep(p);
        }
      }
      p.frame = 0;
      return;
    }
    if (!want) {
      p.turnT = 0;
      p.bumpT = 0;
      p.frame = 0;
      return;
    }
    // A quick tap turns on the spot; holding walks.
    if (want !== p.dir) {
      p.dir = want;
      p.turnT = TURN_DELAY;
      p.frame = 0;
      return;
    }
    if (p.turnT > 0) {
      p.turnT -= dt;
      return;
    }
    if (tryStep(p)) return placeStep(p);
    // Walking into a wall: march on the spot with a thud every other step.
    const before = Math.floor(p.bumpT / 0.22);
    p.bumpT += dt;
    const phase = Math.floor(p.bumpT / 0.22);
    p.frame = [1, 0, 2, 0][phase % 4];
    if (phase !== before && phase % 2 === 0) Sound.bump();
    if (p.bumpT === dt) Sound.bump();
  }

  function updateAI(dt) {
    if (state === 'dialogue' && dlg.partner === 'ai') return;
    if (ai.moving) {
      // A pixel a frame, one tile per step, like everyone else.
      ai.t += dt / (STEP_TIME * 1.5);
      const k = Math.min(T, Math.floor(ai.t * T));
      ai.px = ai.from[0] * T + (ai.to[0] - ai.from[0]) * k;
      ai.py = ai.from[1] * T + (ai.to[1] - ai.from[1]) * k;
      if (ai.t >= 1) {
        ai.tx = ai.to[0];
        ai.ty = ai.to[1];
        ai.moving = false;
        ai.to = null;
      }
      return;
    }
    ai.wanderT -= dt;
    if (ai.wanderT > 0) return;
    ai.wanderT = 3 + Math.random() * 4;
    const [dx, dy] = DIRV[pick(Object.keys(DIRV))];
    const nx = ai.tx + dx;
    const ny = ai.ty + dy;
    if (nx < AI_AREA.x0 || nx > AI_AREA.x1 || ny < AI_AREA.y0 || ny > AI_AREA.y1) return;
    if (blockedTile(nx, ny, ai)) return;
    ai.from = [ai.tx, ai.ty];
    ai.to = [nx, ny];
    ai.t = 0;
    ai.moving = true;
  }

  function findTarget() {
    const p = player();
    if (p.moving) return null;
    const [dx, dy] = DIRV[p.dir];
    const fx = p.tx + dx;
    const fy = p.ty + dy;
    const who = occupant(fx, fy, p);
    if (who === ai) return { kind: 'npc', id: 'ai' };
    if (who) return { kind: 'npc', id: who.id };
    for (const it of props) {
      const [x, y, w, h] = it.tiles;
      if (fx >= x && fx < x + w && fy >= y && fy < y + h) return { kind: 'prop', it };
    }
    return null;
  }

  function targetLabel(t) {
    if (!t) return '';
    if (t.kind === 'npc') return `Talk to ${NAMES[t.id]}`;
    if (t.it.own && ownDesk[t.it.id] === playerId) return t.it.own;
    return t.it.label;
  }

  function propLines(id) {
    const variants = PROPS[id];
    const n = propCount[id] || 0;
    propCount[id] = n + 1;
    const v = variants[n % variants.length];
    let lines;
    if (v.own) lines = v.own === playerId ? v.lines : v.others;
    else lines = v.lines.slice();
    if (v.mine && v.mine[playerId]) lines = lines.concat([['N', v.mine[playerId]]]);
    return lines;
  }

  function interact(t) {
    const me = player();
    if (t.kind === 'npc') {
      if (t.id !== 'ai') faceToward(people[t.id], me.px, me.py);
      const key = `${playerId}>${t.id}`;
      const n = talkCount[key] || 0;
      const list = TALKS[key] || [];
      talkCount[key] = n + 1;
      let lines;
      if (n < list.length) lines = list[n];
      else {
        const pool = IDLE[t.id].filter((l) => l !== lastIdle[key]);
        const line = pick(pool.length ? pool : IDLE[t.id]);
        lastIdle[key] = line;
        lines = [[LETTER[t.id], line]];
      }
      openDialogue(lines, t.id);
      return;
    }
    const it = t.it;
    if (it.sfx === 'gurgle') {
      Sound.gurgle();
      office.gurgle = 1.6;
    }
    if (it.sfx === 'brew') {
      Sound.brew();
      office.brew = 2.2;
    }
    openDialogue(propLines(it.id), null);
  }

  // ---------------------------------------------------------------------------
  // Dialogue: a Gold/Silver text box on rows 12-17, two lines of 18
  // ---------------------------------------------------------------------------

  // When the player stands low on the screen the box moves to the top, as in
  // the Oracle games, so it never hides who is talking.
  let boxRow = 12;
  const lineY = (k) => (boxRow + 2 + k * 2) * TILE;

  // rows: the wrapped lines of this entry. top: the first row on screen.
  // typing: which row is being typed (top or top + 1), n: characters shown.
  const dlg = { lines: null, i: 0, who: null, rows: [], top: 0, typing: 0, n: 0, wait: 0, scroll: 0, partner: null };

  function openDialogue(lines, partner) {
    if (!lines || !lines.length) return;
    state = 'dialogue';
    boxRow = player().py - SPRITE_LIFT - camera()[1] > 80 ? 0 : 12;
    dlg.lines = lines;
    dlg.i = 0;
    dlg.partner = partner;
    Sound.open();
    showLine();
    updateSwitcher();
  }

  function showLine() {
    const [who, line, kind] = dlg.lines[dlg.i];
    const id = who === 'N' ? 'narrator' : BY_LETTER[who];
    dlg.who = id;
    // Speakers are named at the start of their line, the way GBC RPGs did it.
    dlg.rows = wrap(id === 'narrator' ? line : `${TAGS[id]}: ${line}`);
    dlg.tagLen = id === 'narrator' ? 0 : TAGS[id].length + 1;
    dlg.top = 0;
    dlg.typing = 0;
    dlg.n = 0;
    dlg.wait = 0.06;
    dlg.scroll = 0;
    el.dlgLive.textContent = id === 'narrator' ? line : `${NAMES[id]}: ${line}`;
    emote = kind && id !== 'narrator' ? { who: id, kind, t: 0 } : null;
  }

  const rowDone = () => dlg.n >= (dlg.rows[dlg.typing] || '').length;
  const pageDone = () => rowDone() && (dlg.typing === dlg.top + 1 || dlg.typing === dlg.rows.length - 1);
  const waiting = () => state === 'dialogue' && !dlg.scroll && pageDone();

  function advanceDialogue() {
    if (dlg.scroll) return;
    if (!pageDone()) {
      // A finishes the box at once, like holding A in Gold and Silver.
      dlg.typing = Math.min(dlg.top + 1, dlg.rows.length - 1);
      dlg.n = dlg.rows[dlg.typing].length;
      dlg.wait = 0;
      return;
    }
    Sound.confirm();
    if (dlg.typing < dlg.rows.length - 1) {
      // More of this line to come: scroll it up one row.
      dlg.scroll = 0.0001;
      return;
    }
    dlg.i++;
    if (dlg.i >= dlg.lines.length) closeDialogue();
    else showLine();
  }

  function closeDialogue() {
    el.dlgLive.textContent = '';
    state = 'play';
    emote = null;
    dlg.partner = null;
    Sound.close();
    updateSwitcher();
  }

  function updateDialogue(dt) {
    if (emote) emote.t += dt;
    if (dlg.scroll) {
      // Two 8px hops, a few frames apart.
      dlg.scroll += dt;
      if (dlg.scroll >= 0.1) {
        dlg.scroll = 0;
        dlg.top++;
        dlg.typing = dlg.top + 1;
        dlg.n = 0;
      }
      return;
    }
    if (rowDone()) {
      if (dlg.typing < dlg.top + 1 && dlg.typing < dlg.rows.length - 1) {
        dlg.typing++;
        dlg.n = 0;
      }
      return;
    }
    if (dlg.wait > 0) {
      dlg.wait -= dt;
      return;
    }
    const row = dlg.rows[dlg.typing];
    const before = Math.floor(dlg.n);
    dlg.n = Math.min(row.length, dlg.n + dt * CHARS_PER_SEC);
    for (let k = before; k < Math.floor(dlg.n); k++) {
      const ch = row[k];
      if (ch !== ' ' && k % 2 === 0 && dlg.who !== 'narrator') Sound.blip(dlg.who);
      if ('.!?,'.includes(ch) && row[k + 1] === ' ') {
        dlg.wait = ch === ',' ? 0.06 : 0.14;
        dlg.n = k + 1;
        break;
      }
    }
  }

  function drawRow(i, y, count) {
    const row = dlg.rows[i];
    if (!row) return;
    const shown = row.slice(0, count);
    // The speaker's tag, in their colour, on the first row only.
    if (i === 0 && dlg.tagLen) {
      // The Assistant's cyan is too pale for text on white; use a deep teal.
      const col = ART.people[dlg.who] ? ART.people[dlg.who].pal[1] : '#188898';
      const after = text(shown.slice(0, dlg.tagLen), TILE, y, col);
      text(shown.slice(dlg.tagLen), after, y);
    } else text(shown, TILE, y);
  }

  function drawDialogue() {
    frameBox(0, boxRow, 20, 6);
    const count = (i) => (i < dlg.typing ? Infinity : i === dlg.typing ? Math.floor(dlg.n) : 0);
    if (dlg.scroll) {
      // Mid-scroll: the old second row sits halfway, the box is otherwise clear.
      const hop = dlg.scroll < 0.05 ? 8 : 16;
      ctx.save();
      ctx.beginPath();
      ctx.rect(TILE, lineY(0) - 2, SCREEN_W - 2 * TILE, 28);
      ctx.clip();
      drawRow(dlg.top, lineY(0) - hop, Infinity);
      drawRow(dlg.top + 1, lineY(1) - hop, Infinity);
      ctx.restore();
      return;
    }
    drawRow(dlg.top, lineY(0), count(dlg.top));
    drawRow(dlg.top + 1, lineY(1), count(dlg.top + 1));
    if (waiting()) downArrow(18 * TILE, (boxRow + 5) * TILE);
  }

  // ---------------------------------------------------------------------------
  // UI: switcher (outside the screen), toast, hint, title
  // ---------------------------------------------------------------------------

  const whoButtons = {};
  IDS.forEach((id, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'who';
    b.dataset.id = id;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', `Play as ${NAMES[id]}`);
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    paintPortrait(c, id);
    const label = document.createElement('span');
    label.textContent = SHORT[id];
    const k = document.createElement('kbd');
    k.textContent = String(i + 1);
    b.append(c, label, k);
    b.addEventListener('click', () => {
      b.blur();
      switchTo(id);
    });
    el.switcher.append(b);
    whoButtons[id] = b;
  });

  function updateSwitcher() {
    const locked = state !== 'play';
    el.switcher.setAttribute('aria-hidden', String(locked && state === 'title'));
    for (const id of IDS) {
      whoButtons[id].setAttribute('aria-pressed', String(id === playerId));
      whoButtons[id].disabled = locked;
    }
  }

  function toast(msg) {
    toastState.msg = msg;
    toastState.t = 1.6;
  }

  let lastHint = null;
  function updateHint() {
    const key = touchUI ? 'A' : 'Space';
    const swap = touchUI ? 'B' : 'Tab';
    let html = '';
    if (state === 'dialogue') html = `<kbd>${key}</kbd> Continue`;
    else if (state === 'play' && target) html = `<kbd>${key}</kbd> ${targetLabel(target)}`;
    else if (state === 'play') html = `Walk over to someone and say hi <kbd>${swap}</kbd> Switch`;
    if (html !== lastHint) {
      el.hint.innerHTML = html;
      lastHint = html;
    }
  }

  function switchTo(id) {
    if (state !== 'play' || id === playerId) return;
    const prev = player();
    prev.frame = 0;
    prev.turnT = 0;
    prev.bumpT = 0;
    playerId = id;
    const p = player();
    sparkle.x = p.px;
    sparkle.y = p.py - SPRITE_LIFT;
    sparkle.t = 0;
    Sound.swap();
    toast(`You're ${TAGS[id]}!`);
    updateSwitcher();
    target = null;
  }

  function cycleSwitch(step = 1) {
    const i = IDS.indexOf(playerId);
    switchTo(IDS[(i + step + IDS.length) % IDS.length]);
  }

  function intro() {
    const now = new Date();
    const day = now.toLocaleDateString('en-GB', { weekday: 'long' });
    const clock = now
      .toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
      .replace(/\s/g, '')
      .toLowerCase();
    return [
      ['N', `${day}, ${clock}. The office water cooler.`],
      ['N', 'Everyone here has just discovered AI tools. Everyone is very, very excited.'],
      ['N', 'Mostly about not needing each other anymore.'],
      [
        'N',
        touchUI
          ? "You're the DESIGNER. Walk with the pad, press A to talk, and B to become someone else."
          : "You're the DESIGNER. Walk with the arrow keys, Space to talk, and Tab to become someone else.",
      ],
    ];
  }

  // Fade to white in palette steps, run `then`, and fade back in.
  function fadeThrough(then) {
    fade.dir = 1;
    fade.then = then;
  }

  function start() {
    if (state !== 'title' || fade.dir) return;
    el.title.classList.add('is-hidden');
    el.title.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-title');
    el.switcher.removeAttribute('aria-hidden');
    state = 'starting';
    if (Sound.on) Sound.ensure();
    Sound.jingle();
    fadeThrough(() => {
      state = 'play';
      if (Sound.on) Sound.startMusic('office');
      updateSwitcher();
      openDialogue(intro(), null);
    });
  }

  function setSoundUI() {
    el.sound.setAttribute('aria-pressed', String(Sound.on));
    el.soundLabel.textContent = Sound.on ? 'Sound on' : 'Sound off';
  }

  function toggleSound() {
    Sound.set(!Sound.on);
    setSoundUI();
    if (Sound.on) {
      Sound.startMusic(state === 'title' ? 'title' : 'office');
      Sound.open();
    } else Sound.stopMusic();
  }

  function setScreen(mode) {
    screenMode = mode;
    el.lcd.dataset.screen = mode;
    el.screenBtn.setAttribute('aria-pressed', String(mode === 'green'));
    el.screenLabel.textContent = mode === 'green' ? 'Green' : 'Colour';
    store('watercooler:screen', mode);
  }

  function setShell(theme) {
    shellTheme = theme;
    el.device.dataset.shell = theme;
    el.shellBtn.setAttribute('aria-pressed', String(theme === 'purple'));
    el.shellLabel.textContent = theme === 'purple' ? 'Purple' : 'Grey';
    store('watercooler:shell', theme);
  }

  function store(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* storage unavailable */
    }
  }
  function recall(key, fallback) {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  const MOVE_KEYS = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  };
  const ACTION_KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'KeyE', 'KeyZ', 'KeyX']);

  function action() {
    if (state === 'title') start();
    else if (state === 'dialogue') advanceDialogue();
    else if (state === 'play' && target) interact(target);
  }

  function back(step = 1) {
    if (state === 'title') start();
    else if (state === 'dialogue') advanceDialogue();
    else if (state === 'play') cycleSwitch(step);
  }

  function startButton() {
    if (state === 'title') start();
  }

  // The handheld's buttons mirror every input source (keys, mouse, touch), so a
  // button stays pressed until all of the sources holding it have let go.
  const shellButtons = { a: el.btnA, b: el.btnB, select: el.btnSelect, start: el.btnStart };
  const holders = { a: new Set(), b: new Set(), select: new Set(), start: new Set() };

  function hold(name, source, on) {
    if (on) holders[name].add(source);
    else holders[name].delete(source);
    shellButtons[name].classList.toggle('is-down', holders[name].size > 0);
  }

  function releaseSource(source) {
    for (const name in holders) if (holders[name].has(source)) hold(name, source, false);
  }

  function renderDpad() {
    const d = heldDir();
    for (const dir of ['up', 'down', 'left', 'right']) el.dpad.classList.toggle(`is-${dir}`, d === dir);
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onLink = document.activeElement && document.activeElement.matches('a, .bar button');
    const dir = MOVE_KEYS[e.code];
    if (dir) {
      e.preventDefault();
      if (!dirStack.includes(dir)) dirStack.push(dir);
      renderDpad();
      return;
    }
    if (ACTION_KEYS.has(e.code)) {
      if (onLink && (e.code === 'Space' || e.code === 'Enter')) return;
      e.preventDefault();
      hold('a', e.code, true);
      if (!e.repeat) action();
      return;
    }
    if (e.code === 'Tab' && state !== 'title' && !onLink) {
      e.preventDefault();
      hold('b', e.code, true);
      if (!e.repeat) back(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.code === 'KeyQ') {
      hold('b', e.code, true);
      if (!e.repeat) back(1);
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      hold('start', e.code, true);
      if (!e.repeat) startButton();
      return;
    }
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      switchTo(IDS[Number(e.code.slice(-1)) - 1]);
      return;
    }
    if (e.code === 'KeyG' && !e.repeat) {
      setScreen(screenMode === 'green' ? 'colour' : 'green');
      return;
    }
    if (e.code === 'KeyM') {
      hold('select', e.code, true);
      if (!e.repeat) toggleSound();
    }
  });

  window.addEventListener('keyup', (e) => {
    const dir = MOVE_KEYS[e.code];
    if (dir) {
      // Two keys can map to the same direction (arrow and WASD), so only drop it once both are up.
      const others = Object.entries(MOVE_KEYS).some(([code, d]) => d === dir && code !== e.code && heldCodes.has(code));
      if (!others) {
        const i = dirStack.indexOf(dir);
        if (i >= 0) dirStack.splice(i, 1);
      }
      renderDpad();
    }
    releaseSource(e.code);
  });

  const heldCodes = new Set();
  window.addEventListener('keydown', (e) => heldCodes.add(e.code), { capture: true });
  window.addEventListener('keyup', (e) => heldCodes.delete(e.code), { capture: true });

  window.addEventListener('blur', () => {
    dirStack.length = 0;
    heldCodes.clear();
    touchDir = null;
    for (const name in holders) {
      holders[name].clear();
      shellButtons[name].classList.remove('is-down');
    }
    renderDpad();
  });

  el.sound.addEventListener('click', () => {
    toggleSound();
    el.sound.blur();
  });
  el.screenBtn.addEventListener('click', () => {
    setScreen(screenMode === 'green' ? 'colour' : 'green');
    el.screenBtn.blur();
  });
  el.shellBtn.addEventListener('click', () => {
    setShell(shellTheme === 'purple' ? 'grey' : 'purple');
    el.shellBtn.blur();
  });
  el.start.addEventListener('click', (e) => {
    e.stopPropagation();
    start();
  });
  el.title.addEventListener('click', start);
  // Tapping the screen moves the text along.
  el.stage.addEventListener('pointerdown', (e) => {
    if (state !== 'dialogue') return;
    e.preventDefault();
    advanceDialogue();
  });

  function enableTouchUI() {
    if (touchUI) return;
    touchUI = true;
    document.body.classList.add('is-touch');
    lastHint = null;
  }
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') enableTouchUI();
  }, { capture: true });

  // Throws if the pointer is no longer active, which must not swallow the press.
  function capture(target, pointerId) {
    try {
      target.setPointerCapture(pointerId);
    } catch {}
  }

  // D-pad: slide your thumb around it. Four directions, like the real thing.
  let dpadPointer = null;
  function dpadFrom(e) {
    const r = el.dpad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    let dir = null;
    if (Math.hypot(dx, dy) > r.width * 0.12) {
      dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    }
    touchDir = dir;
    renderDpad();
  }
  function dpadEnd(e) {
    if (e.pointerId !== dpadPointer) return;
    dpadPointer = null;
    touchDir = null;
    renderDpad();
  }
  el.dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dpadPointer = e.pointerId;
    capture(el.dpad, e.pointerId);
    dpadFrom(e);
  });
  el.dpad.addEventListener('pointermove', (e) => {
    if (e.pointerId === dpadPointer) dpadFrom(e);
  });
  el.dpad.addEventListener('pointerup', dpadEnd);
  el.dpad.addEventListener('pointercancel', dpadEnd);

  function pressable(name, fn) {
    const btn = shellButtons[name];
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(btn, e.pointerId);
      hold(name, `p${e.pointerId}`, true);
      fn();
    });
    const up = (e) => hold(name, `p${e.pointerId}`, false);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  }
  pressable('a', action);
  pressable('b', () => back(1));
  pressable('select', toggleSound);
  pressable('start', startButton);

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  // Scale the 160x144 screen by a whole number of device pixels where it can, so
  // every game pixel is the same size, and centre it in the LCD.
  // The GBC's LCD shows a fine grid between its pixels. It is drawn over the
  // game on its own canvas at device resolution, each line on the device pixel
  // where a game pixel starts, and left off when pixels are too small to see it.
  const dots = document.createElement('canvas');
  dots.className = 'dots';
  dots.setAttribute('aria-hidden', 'true');
  el.canvas.after(dots);

  function drawDots(w, h, dpr) {
    const k = (w * dpr) / SCREEN_W;
    dots.hidden = k < 3;
    if (dots.hidden) return;
    dots.width = Math.round(w * dpr);
    dots.height = Math.round(h * dpr);
    const d = dots.getContext('2d');
    d.clearRect(0, 0, dots.width, dots.height);
    const line = Math.max(1, Math.round(k * 0.12));
    d.fillStyle = 'rgba(16, 24, 16, 0.17)';
    for (let i = 0; i < SCREEN_W; i++) d.fillRect(Math.round(i * k), 0, line, dots.height);
    for (let j = 0; j < SCREEN_H; j++) d.fillRect(0, Math.round(j * k), dots.width, line);
  }

  function fitScreen() {
    const sw = el.stage.clientWidth;
    const sh = el.stage.clientHeight;
    if (!sw || !sh) return;
    const dpr = window.devicePixelRatio || 1;
    const fit = Math.min(sw / SCREEN_W, sh / SCREEN_H);
    // Snap down to whole device pixels unless that would shrink it a lot. In
    // the 3D page the frame is sized to the model's screen, so fill it.
    const whole = Math.floor(fit * dpr) / dpr;
    const embedded = document.documentElement.classList.contains('embed');
    const scale = !embedded && whole >= fit * 0.8 ? whole : fit;
    const w = SCREEN_W * scale;
    const h = SCREEN_H * scale;
    const rect = {
      position: 'absolute',
      width: `${w}px`,
      height: `${h}px`,
      left: `${Math.round(((sw - w) / 2) * dpr) / dpr}px`,
      top: `${Math.round(((sh - h) / 2) * dpr) / dpr}px`,
    };
    Object.assign(el.canvas.style, rect);
    Object.assign(dots.style, rect);
    drawDots(w, h, dpr);
  }
  window.addEventListener('resize', fitScreen);
  if ('ResizeObserver' in window) new ResizeObserver(fitScreen).observe(el.stage);

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  function update(dt) {
    time += dt;
    const me = player();

    if (fade.dir) {
      fade.level += fade.dir * dt * 4;
      if (fade.dir > 0 && fade.level >= 1) {
        fade.level = 1;
        fade.dir = -1;
        const then = fade.then;
        fade.then = null;
        if (then) then();
      } else if (fade.dir < 0 && fade.level <= 0) {
        fade.level = 0;
        fade.dir = 0;
      }
    }

    for (const id of IDS) {
      const p = people[id];
      updateWalker(p, id === playerId && state === 'play' ? heldDir() : null, dt);
    }
    target = state === 'play' ? findTarget() : null;

    for (const id of IDS) {
      const p = people[id];
      if (id === playerId || state === 'title' || p.moving) continue;
      if (state === 'dialogue' && dlg.partner === id) continue;
      const d = Math.abs(me.tx - p.tx) + Math.abs(me.ty - p.ty);
      if (d <= 2) {
        faceToward(p, me.px, me.py);
        p.lookT = 1.5;
      } else {
        p.lookT -= dt;
        if (p.lookT <= 0) {
          p.lookT = 2.5 + Math.random() * 4;
          if (Math.random() < 0.6) faceToward(p, COOLER_TILE[0] * T, COOLER_TILE[1] * T);
          else p.dir = pick(['down', 'left', 'right', 'down']);
        }
      }
    }

    updateAI(dt);
    if (office.brew > 0) office.brew = Math.max(0, office.brew - dt);
    if (office.gurgle > 0) office.gurgle = Math.max(0, office.gurgle - dt);
    if (sparkle.t < 1) sparkle.t += dt;
    if (toastState.t > 0) toastState.t -= dt;

    if (state === 'dialogue') updateDialogue(dt);
    updateHint();
  }

  // The room, its furniture and everyone in it, with the camera at (cx, cy).
  function drawWorld(cx, cy) {
    ctx.setTransform(1, 0, 0, 1, -cx, -cy);
    ctx.drawImage(bg, 0, 0);
    OFFICE.paintWall(ctx, time);
    const ents = OFFICE.objects.map((o) => ({ y: o.y, draw: () => o.draw(ctx, time, office) }));
    for (const id of IDS) {
      const p = people[id];
      ents.push({ y: p.py + 16, draw: () => drawPerson(p) });
    }
    ents.push({ y: ai.py + 16, draw: drawAI });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw();

    if (sparkle.t < 0.6) {
      const k = Math.floor(sparkle.t * 10) % 2;
      ctx.drawImage(stars[k], sparkle.x - 6, sparkle.y - 2);
      ctx.drawImage(stars[1 - k], sparkle.x + 14, sparkle.y + 2);
      ctx.drawImage(stars[k], sparkle.x + 6, sparkle.y - 10);
    }

    if (state === 'play') {
      // Who still has something new to say to you.
      if (Math.floor(time * 1.5) % 2 === 0) {
        for (const id of [...IDS, 'ai']) {
          if (id === playerId) continue;
          if (target && target.kind === 'npc' && target.id === id) continue;
          const key = `${playerId}>${id}`;
          if ((talkCount[key] || 0) >= (TALKS[key] || []).length) continue;
          const [x, y] = headPos(id);
          ctx.drawImage(emotes.dots, x, y - 16);
        }
      }
      if (target) {
        const bounce = Math.floor(time * 3) % 2;
        if (target.kind === 'npc') {
          const [x, y] = headPos(target.id);
          ctx.drawImage(marker, x + 4, y - 10 - bounce);
        } else {
          const [x, y] = target.it.mark;
          ctx.drawImage(marker, x - 4, y - 8 - bounce);
        }
      }
    }
    if (state === 'dialogue' && emote) {
      const [x, y] = headPos(emote.who);
      const e = emotes[emote.kind];
      if (e) ctx.drawImage(e, x, y - (emote.t < 0.08 ? 12 : 16));
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // The camera keeps the player at metatile (4, 4) but never shows past the
  // room's walls.
  function camera() {
    const me = player();
    return [clamp(me.px - HERO_X, 0, ROOM_W - SCREEN_W), clamp(me.py - HERO_Y, 0, ROOM_H - SCREEN_H)];
  }

  let logo = null;
  function drawTitle() {
    R(0, 0, SCREEN_W, SCREEN_H, PAPER);
    if (!logo && fontReady) {
      logo = {
        water: bigWord('WATER', '#2868c8', '#78b8f8', INK, '#a0a0b8'),
        cooler: bigWord('COOLER', '#2868c8', '#78b8f8', INK, '#a0a0b8'),
      };
    }
    // A window onto the office, with the cast chatting round the cooler.
    const vy = 7 * TILE;
    const vh = 8 * TILE;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, vy, SCREEN_W, vh);
    ctx.clip();
    drawWorld(COOLER_TILE[0] * T + 8 - SCREEN_W / 2, 78 - vy);
    ctx.restore();
    R(0, vy - 2, SCREEN_W, 2, INK);
    R(0, vy + vh, SCREEN_W, 2, INK);

    centred('THE', 2, '#c03828');
    if (logo) {
      ctx.drawImage(logo.water, Math.round((SCREEN_W - logo.water.width) / 2), 10);
      ctx.drawImage(logo.cooler, Math.round((SCREEN_W - logo.cooler.width) / 2), 31);
    }
    if (Math.floor(time * 1.6) % 2 === 0) centred('PRESS START', 124);
    centred('©2026 JIMTENDO', 135, '#787878');
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (state === 'title' || (state === 'starting' && fade.dir > 0)) {
      drawTitle();
    } else {
      R(0, 0, SCREEN_W, SCREEN_H, VOID);
      const [cx, cy] = camera();
      drawWorld(cx, cy);
      if (state === 'dialogue') drawDialogue();
      if (toastState.t > 0) {
        frameBox(0, 0, 20, 3);
        centred(toastState.msg, TILE);
      }
    }
    finishFrame();
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    update(dt);
    render();
  }

  // Some embedded webviews never fire requestAnimationFrame; fall back to a timer there.
  let loopMode = null;
  function rafLoop(now) {
    if (loopMode === 'timer') return;
    loopMode = 'raf';
    tick(now);
    requestAnimationFrame(rafLoop);
  }
  function startTimerLoopIfNeeded() {
    if (loopMode) return;
    if (document.visibilityState !== 'visible') {
      setTimeout(startTimerLoopIfNeeded, 500);
      return;
    }
    loopMode = 'timer';
    (function loop() {
      tick(performance.now());
      setTimeout(loop, 16);
    })();
  }

  if (document.fonts && document.fonts.load) {
    document.fonts.load(FONT).then(
      () => {
        fontReady = true;
      },
      () => {
        fontReady = true;
      },
    );
  } else fontReady = true;

  Sound.init();
  setSoundUI();
  setShell(recall('watercooler:shell', 'grey') === 'purple' ? 'purple' : 'grey');
  setScreen(recall('watercooler:screen', 'colour') === 'green' ? 'green' : 'colour');
  document.body.classList.toggle('is-touch', touchUI);
  updateSwitcher();
  fitScreen();
  requestAnimationFrame(rafLoop);
  setTimeout(startTimerLoopIfNeeded, 400);

  // For tests and tools: a read-only peek at the game and its text layout.
  window.WC_GAME = {
    wrap, measure, state: () => state, dlg, people, LINE_W,
    say: (lines, partner = null) => state === 'play' && openDialogue(lines, partner),
    talks: TALKS,
  };
})();
