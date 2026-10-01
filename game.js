(() => {
  'use strict';

  const { TALKS, IDLE, PROPS } = window.WC_SCRIPT;

  const ROOM_W = 320;
  const ROOM_H = 192;
  const FLOOR_TOP = 45;
  const FLOOR_BOTTOM = 186;
  const OUT = '#2b2230';
  const SHADOW = 'rgba(58, 34, 32, 0.2)';
  const WALK_SPEED = 56;

  const IDS = ['designer', 'engineer', 'pm'];
  const NAMES = {
    designer: 'The Designer',
    engineer: 'The Engineer',
    pm: 'The Product Manager',
    ai: 'The Assistant',
  };
  const SHORT = { designer: 'Designer', engineer: 'Engineer', pm: 'PM' };
  const LETTER = { designer: 'D', engineer: 'E', pm: 'P', ai: 'A' };
  const BY_LETTER = { D: 'designer', E: 'engineer', P: 'pm', A: 'ai' };
  const VOICE = { designer: 540, engineer: 360, pm: 680, ai: 920 };

  const $ = (id) => document.getElementById(id);
  const el = {
    bar: $('bar'),
    stage: $('stage'),
    canvas: $('game'),
    dock: $('dock'),
    help: $('help'),
    hint: $('hint'),
    switcher: $('switcher'),
    toast: $('toast'),
    dialogue: $('dialogue'),
    dlgName: $('dlgName'),
    dlgText: $('dlgText'),
    dlgLive: $('dlgLive'),
    portrait: $('portrait'),
    title: $('title'),
    start: $('start'),
    cast: $('cast'),
    sound: $('sound'),
    soundLabel: $('soundLabel'),
    dpad: $('dpad'),
    tA: $('tA'),
    tSwap: $('tSwap'),
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

  const rnd = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let ctx = null;
  const mainCtx = el.canvas.getContext('2d');

  function R(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  }
  function P(x, y, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  }
  function box(x, y, w, h, fill, out = OUT) {
    R(x - 1, y - 1, w + 2, h + 2, out);
    R(x, y, w, h, fill);
  }
  function ellipse(cx, cy, rx, ry, col) {
    ctx.fillStyle = col;
    for (let y = -ry; y <= ry; y++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
    }
  }
  function withCtx(c, fn) {
    const prev = ctx;
    ctx = c;
    fn();
    ctx = prev;
  }

  // Tiny 3x5 pixel font for wall signage.
  const FONT = {
    A: ['010', '101', '111', '101', '101'],
    D: ['110', '101', '101', '101', '110'],
    E: ['111', '100', '110', '100', '111'],
    I: ['111', '010', '010', '010', '111'],
    K: ['101', '101', '110', '101', '101'],
    M: ['101', '111', '111', '101', '101'],
    O: ['010', '101', '101', '101', '010'],
    P: ['110', '101', '110', '100', '100'],
    Q: ['010', '101', '101', '110', '011'],
    R: ['110', '101', '110', '101', '101'],
    S: ['011', '100', '010', '001', '110'],
    T: ['111', '010', '010', '010', '010'],
    U: ['101', '101', '101', '101', '111'],
    W: ['101', '101', '111', '111', '101'],
    1: ['010', '110', '010', '010', '111'],
    2: ['110', '001', '010', '100', '111'],
    3: ['110', '001', '010', '001', '110'],
    '?': ['110', '001', '010', '000', '010'],
  };
  function pixText(str, x, y, col) {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const g = FONT[ch];
      if (g) {
        for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '1') P(cx + c, y + r, col);
      }
      cx += 4;
    }
  }

  // ---------------------------------------------------------------------------
  // Character sprites (12x18 pixel maps, auto-outlined)
  // ---------------------------------------------------------------------------

  const CHARS = {
    designer: {
      pal: {
        H: '#2a2030', h: '#4a3a55', u: '#5c4c60', S: '#f3c9a8', R: '#f0a08a', E: '#2a2030', G: '#4a4258',
        T: '#3b3647', t: '#2c2836', P: '#2f2b3a', F: '#f2efe8', O: '#1c1622',
      },
      rows: {
        down: [
          '............',
          '...HHhHH....',
          '..HHHHHHHH..',
          '.HHHHHHHHHH.',
          '.uHHHHHHHHu.',
          '.uSSSSSSSSu.',
          '.SGEGSSGEGS.',
          '.SRGSSSSGRS.',
          '..SSSSSSSS..',
          '...TTTTTT...',
          '..TTTTTTTT..',
          '.TTTTTTTTTT.',
          '.TtTTTTTTtT.',
          '.STTTTTTTTS.',
          '..TTTTTTTT..',
        ],
        up: [
          '............',
          '...HHhHH....',
          '..HHHHHHHH..',
          '.HHHHHHHHHH.',
          '.uHHHHHHHHu.',
          '.uHHHHHHHHu.',
          '.uuuuuuuuuu.',
          '.SuuuuuuuuS.',
          '..SSSSSSSS..',
          '...TTTTTT...',
          '..TTTTTTTT..',
          '.TTTTTTTTTT.',
          '.TtTTTTTTtT.',
          '.STTTTTTTTS.',
          '..TTTTTTTT..',
        ],
        side: [
          '............',
          '...HHhHH....',
          '..HHHHHHHH..',
          '.HHHHHHHHHH.',
          '.uHHHHHHHHH.',
          '.uuSSSSSSSS.',
          '.uuSGGGGEGS.',
          '.uSSSSSSGRS.',
          '..SSSSSSSS..',
          '....TTTTT...',
          '...TTTTTT...',
          '...TTTTTT...',
          '...TTtTTT...',
          '...TTSTTT...',
          '...TTTTTT...',
        ],
      },
    },
    engineer: {
      pal: {
        H: '#5b3a24', h: '#7d5434', S: '#c68d66', R: '#d9806a', E: '#2a2030', T: '#6e9a7c', t: '#58806a',
        W: '#f2efe8', K: '#2f2b3a', P: '#465a85', F: '#7a5236',
      },
      rows: {
        down: [
          '............',
          '....HHHH....',
          '..HHHhHHHH..',
          '.HHHhHHHHHH.',
          '.HHHSSHHHHH.',
          '.HSSSSSSSSH.',
          '.HSESSSSESH.',
          '.HRESSSSERH.',
          '.HSSSSSSSSH.',
          '.HKKTTTTKKH.',
          '.TKKTTTTKKT.',
          '.TTTWTTWTTT.',
          '.TTTWTTWTTT.',
          '.STttttttTS.',
          '..TTTTTTTT..',
        ],
        up: [
          '............',
          '....HHHH....',
          '..HHHhHHHH..',
          '.HHHhHHHHHH.',
          '.HHHHHHHHHH.',
          '.HHHHHHHHHH.',
          '.HHHHHHHHHH.',
          '.HHHHHHHHHH.',
          '.HHHHHHHHHH.',
          '.THHHHHHHHT.',
          '.TTHHHHHHTT.',
          '.TTTTTTTTTT.',
          '.TTTTTTTTTT.',
          '.STTTTTTTTS.',
          '..TTTTTTTT..',
        ],
        side: [
          '............',
          '....HHHH....',
          '..HHHhHHHH..',
          '.HHHhHHHHHH.',
          '.HHHHHHHSHH.',
          '.HHHHSSSSSS.',
          '.HHHSSSSESS.',
          '.HHHSSSSERS.',
          '.HHHSSSSSS..',
          '.HHtTTKK....',
          '..ttTTKKT...',
          '...TTTTTT...',
          '...TTtTTT...',
          '...TTSTTT...',
          '...TTTTTT...',
        ],
      },
    },
    pm: {
      pal: {
        H: '#d4a24c', h: '#e8c070', S: '#f0c09a', R: '#ef9e86', E: '#2a2030', T: '#34426e',
        U: '#b6d4ee', L: '#e05a4f', Y: '#f7f3ea', P: '#c9b089', F: '#6b4429',
      },
      rows: {
        down: [
          '............',
          '....HHHH....',
          '..HHHHHHHH..',
          '.HHHHHHhhHH.',
          '.HHHHHHSSSH.',
          '.HSSSSSSSSH.',
          '.SSESSSSESS.',
          '.SRESSSSERS.',
          '..SSSSSSSS..',
          '...ULUULU...',
          '..TTLUULTT..',
          '.UTTULLUTTU.',
          '.UTTUYYUTTU.',
          '.STTUYYUTTS.',
          '..TTTTTTTT..',
        ],
        up: [
          '............',
          '....HHHH....',
          '..HHHHHHHH..',
          '.HHHHHHHHHH.',
          '.HHHHHHHHHH.',
          '.HHHHHHHHHH.',
          '.HHHHHHHHHH.',
          '.SHHHHHHHHS.',
          '..SSSSSSSS..',
          '...ULLLLU...',
          '..TTTTTTTT..',
          '.UTTTTTTTTU.',
          '.UTTTTTTTTU.',
          '.STTTTTTTTS.',
          '..TTTTTTTT..',
        ],
        side: [
          '............',
          '....HHHH....',
          '..HHHHHHHH..',
          '.HHHHHHHHHH.',
          '.HHHHHHSSSH.',
          '.HHHSSSSSSS.',
          '.HHSSSSSESS.',
          '.HSSSSSSERS.',
          '..SSSSSSSS..',
          '....UUUL....',
          '...TTTTLT...',
          '...TTUTYT...',
          '...TTUTYT...',
          '...TTSTTT...',
          '...TTTTTT...',
        ],
      },
    },
  };

  const LEGS = {
    front: [
      ['..PPPPPPPP..', '..PPP..PPP..', '..FFF..FFF..'],
      ['..PPPPPPPP..', '..PPP..FFF..', '..FFF.......'],
      ['..PPPPPPPP..', '..FFF..PPP..', '.......FFF..'],
    ],
    side: [
      ['...PPPPPP...', '....PPPP....', '....FFFFF...'],
      ['...PPPPPP...', '...PP..PP...', '..FF....FF..'],
      ['...PPPPPP...', '....PPPP....', '...FFFF.....'],
    ],
  };

  const AI_PAL = { B: '#ece8f6', b: '#b9b2d6', D: '#2d2b4f', C: '#7ef0dc', Y: '#ffd36b' };
  const AI_ROWS = [
    '.....Y......',
    '.....b......',
    '..BBBBBBBB..',
    '.BDDDDDDDDB.',
    '.BDCDDDDCDB.',
    '.BDDDDDDDDB.',
    '.BDCDDDDCDB.',
    '.BDDCCCCDDB.',
    '.BDDDDDDDDB.',
    '..BBBBBBBB..',
    '....bbbb....',
  ];

  function buildSprite(rows, pal) {
    const h = rows.length;
    const w = rows[0].length;
    const W = w + 2;
    const H = h + 2;
    const [c, x] = makeCanvas(W, H);
    const filled = new Uint8Array(W * H);
    for (let j = 0; j < h; j++) {
      if (rows[j].length !== w) console.warn('Sprite row width mismatch', rows[j]);
      for (let i = 0; i < w; i++) {
        const col = pal[rows[j][i]];
        if (!col) continue;
        x.fillStyle = col;
        x.fillRect(i + 1, j + 1, 1, 1);
        filled[(j + 1) * W + i + 1] = 1;
      }
    }
    x.fillStyle = pal.O || OUT;
    const at = (a, b) => a >= 0 && b >= 0 && a < W && b < H && filled[b * W + a];
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        if (filled[j * W + i]) continue;
        if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) x.fillRect(i, j, 1, 1);
      }
    }
    return c;
  }

  function blinkRows(rows, from = 'E', to = 'S') {
    let done = false;
    return rows.map((r) => {
      if (!done && r.includes(from)) {
        done = true;
        return r.split(from).join(to);
      }
      return r;
    });
  }

  const sprites = {};
  for (const id of IDS) {
    const def = CHARS[id];
    sprites[id] = {};
    for (const view of ['down', 'up', 'side']) {
      const legs = LEGS[view === 'side' ? 'side' : 'front'];
      sprites[id][view] = legs.map((l) => buildSprite(def.rows[view].concat(l), def.pal));
      if (view !== 'up') {
        const closed = blinkRows(def.rows[view]);
        sprites[id][view + 'Blink'] = legs.map((l) => buildSprite(closed.concat(l), def.pal));
      }
    }
  }
  const aiSprite = buildSprite(AI_ROWS, AI_PAL);
  const aiBlink = buildSprite(blinkRows(AI_ROWS, 'C', 'D'), AI_PAL);

  function paintPortrait(canvas, id) {
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvas.width, canvas.height);
    if (id === 'ai') c.drawImage(aiSprite, 0, 0);
    else c.drawImage(sprites[id].down[0], 0, 0, 14, 12, 0, 0, 14, 12);
  }

  // ---------------------------------------------------------------------------
  // The office
  // ---------------------------------------------------------------------------

  const bg = (() => {
    const [c, x] = makeCanvas(ROOM_W, ROOM_H);
    withCtx(x, () => {
      // Back wall
      R(0, 0, ROOM_W, FLOOR_TOP, '#f1e3c6');
      for (let i = 0; i < ROOM_W; i += 8) R(i, 2, 1, 28, '#eadab9');
      R(0, 0, ROOM_W, 2, '#7a5238');
      R(0, 30, ROOM_W, 1, '#7f9874');
      R(0, 31, ROOM_W, 1, '#c7d6bc');
      R(0, 32, ROOM_W, 10, '#a9c09d');
      for (let i = 6; i < ROOM_W; i += 12) R(i, 33, 1, 8, '#91aa86');
      R(0, 42, ROOM_W, 2, '#6f5444');
      R(0, 44, ROOM_W, 1, '#5a4236');

      // Light switch and plug socket
      box(118, 18, 3, 4, '#f7f3ea');
      P(119, 19, '#c9c4b8');
      box(250, 36, 4, 3, '#f7f3ea');
      P(251, 37, OUT);
      P(252, 37, OUT);

      // Floorboards
      const tones = ['#c99c6d', '#c3956a', '#cda274'];
      for (let row = 0, y = FLOOR_TOP; y < FLOOR_BOTTOM; row++, y += 8) {
        const h = Math.min(8, FLOOR_BOTTOM - y);
        let px = -((row * 13) % 32);
        let k = 0;
        while (px < ROOM_W) {
          R(px, y, 32, h, tones[Math.floor(rnd(row * 31 + k) * 3)]);
          R(px, y, 1, h, '#b0845a');
          px += 32;
          k++;
        }
        R(0, y + h - 1, ROOM_W, 1, '#b48759');
        for (let i = 0; i < 12; i++) {
          const gx = Math.floor(rnd(row * 97 + i) * ROOM_W);
          R(gx, y + 2 + Math.floor(rnd(row * 53 + i) * 4), 3, 1, 'rgba(120, 80, 45, 0.16)');
        }
      }
      R(0, FLOOR_TOP, ROOM_W, 2, 'rgba(70, 40, 30, 0.18)');

      // Rug under the cooler
      ellipse(160, 120, 53, 25, OUT);
      ellipse(160, 120, 52, 24, '#e2a86e');
      ellipse(160, 120, 48, 21, '#c8664e');
      ellipse(160, 120, 41, 17, '#e7b97f');
      ellipse(160, 120, 39, 16, '#c8664e');
      ellipse(160, 120, 24, 9, '#b85a46');
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const dx = Math.round(160 + Math.cos(a) * 44.5);
        const dy = Math.round(120 + Math.sin(a) * 18.5);
        P(dx, dy - 1, '#f3cf98');
        R(dx - 1, dy, 3, 1, '#f3cf98');
        P(dx, dy + 1, '#f3cf98');
      }
      for (let y = -6; y <= 6; y += 2) {
        R(105, 120 + y, 2, 1, '#efd6a8');
        R(213, 120 + y, 2, 1, '#efd6a8');
      }

      // Whiteboard
      box(124, 6, 72, 26, '#c9ccd8');
      R(126, 8, 68, 22, '#fbfbf6');
      pixText('Q3 ROADMAP', 128, 10, '#d5534a');
      pixText('1 AI', 128, 17, '#3d6fb6');
      pixText('2 MORE AI', 148, 17, '#3d6fb6');
      pixText('3 ???', 128, 24, '#3d6fb6');
      pixText('USERS', 152, 24, '#a9a9b3');
      R(151, 26, 21, 1, '#d5534a');
      // sad face
      P(177, 24, '#3d6fb6');
      P(180, 24, '#3d6fb6');
      R(177, 27, 4, 1, '#3d6fb6');
      P(176, 28, '#3d6fb6');
      P(181, 28, '#3d6fb6');
      // doodled chart
      R(176, 10, 1, 6, '#4f9a63');
      R(176, 15, 14, 1, '#4f9a63');
      R(178, 13, 2, 2, '#4f9a63');
      R(181, 11, 2, 4, '#4f9a63');
      R(184, 12, 2, 3, '#4f9a63');
      R(187, 9, 2, 6, '#4f9a63');
      // marker tray
      R(126, 32, 68, 2, '#9aa0b0');
      R(140, 31, 5, 1, '#d5534a');
      R(147, 31, 5, 1, '#3d6fb6');
      R(154, 31, 5, 1, '#4f9a63');

      // Poster
      box(204, 8, 18, 22, '#5f9aa0');
      P(212, 10, '#f6d36b');
      R(211, 11, 3, 1, '#f6d36b');
      P(212, 12, '#f6d36b');
      pixText('TEAM', 205, 16, '#fdf8ee');
      pixText('WORK', 205, 23, '#fdf8ee');
      R(207, 22, 10, 1, 'rgba(0, 0, 0, 0.18)');
      R(206, 14, 10, 8, '#ffe27a');
      pixText('AI', 208, 15, OUT);

      // Employee of the month
      box(230, 9, 14, 17, '#d9a441');
      R(231, 10, 12, 15, '#efe7d6');
      box(233, 12, 8, 6, '#ece8f6');
      R(234, 13, 6, 4, '#2d2b4f');
      P(235, 14, '#7ef0dc');
      P(238, 14, '#7ef0dc');
      R(236, 16, 2, 1, '#7ef0dc');
      R(233, 20, 8, 3, '#d9a441');
      R(234, 21, 6, 1, '#b8862f');

      // Room edges
      R(0, 0, 4, ROOM_H, '#3d3240');
      R(ROOM_W - 4, 0, 4, ROOM_H, '#3d3240');
      R(0, FLOOR_BOTTOM, ROOM_W, ROOM_H - FLOOR_BOTTOM, '#3d3240');
      R(4, FLOOR_TOP, 1, FLOOR_BOTTOM - FLOOR_TOP, 'rgba(0, 0, 0, 0.12)');
      R(ROOM_W - 5, FLOOR_TOP, 1, FLOOR_BOTTOM - FLOOR_TOP, 'rgba(0, 0, 0, 0.12)');
      R(4, FLOOR_BOTTOM - 1, ROOM_W - 8, 1, 'rgba(0, 0, 0, 0.15)');
    });
    return c;
  })();

  function cloud(x, y) {
    R(x + 2, y - 1, 5, 1, '#ffffff');
    R(x, y, 10, 2, '#ffffff');
    R(x - 1, y + 2, 12, 1, '#eef5fa');
  }

  function drawWindow(x, y, w, h, t, seed) {
    box(x, y, w, h, '#fdf8ee');
    const ix = x + 2;
    const iy = y + 2;
    const iw = w - 4;
    const ih = h - 4;
    const bands = ['#8fc8ea', '#a6d4ee', '#c2e0ef', '#f2dcb8'];
    const bh = Math.ceil(ih / bands.length);
    bands.forEach((b, i) => R(ix, iy + i * bh, iw, Math.min(bh, ih - i * bh), b));
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();
    for (let i = 0; i < 3; i++) {
      const span = iw + 30;
      const cx = ix - 15 + ((rnd(seed * 5 + i) * span + t * (1.5 + i * 0.8)) % span);
      cloud(Math.round(cx), iy + 3 + i * 4);
    }
    let bx = ix;
    let k = 0;
    while (bx < ix + iw) {
      const bw = 5 + Math.floor(rnd(seed * 10 + k) * 7);
      const bh2 = 4 + Math.floor(rnd(seed * 20 + k) * 9);
      R(bx, iy + ih - bh2, bw, bh2, k % 2 ? '#a7b4cb' : '#b8c3d6');
      for (let wy = iy + ih - bh2 + 2; wy < iy + ih - 1; wy += 3) {
        for (let wx = bx + 1; wx < bx + bw - 1; wx += 2) if (rnd(wx * 7 + wy * 13) > 0.55) P(wx, wy, '#fff1c2');
      }
      bx += bw + 1;
      k++;
    }
    for (let tx = ix - 2; tx < ix + iw; tx += 6) ellipse(tx + 3, iy + ih, 3, 2, '#7fae78');
    ctx.restore();
    R(x + Math.floor(w / 2) - 1, y, 2, h, '#fdf8ee');
    R(x, y + Math.floor(h / 2) - 1, w, 2, '#fdf8ee');
    R(ix + 2, iy + 1, 1, 3, 'rgba(255, 255, 255, 0.5)');
    R(ix + 3, iy + 1, 2, 1, 'rgba(255, 255, 255, 0.5)');
    box(x - 2, y + h + 1, w + 4, 2, '#fdf8ee');
  }

  function drawClock() {
    const cx = 88;
    const cy = 9;
    ellipse(cx, cy, 6, 6, OUT);
    ellipse(cx, cy, 5, 5, '#fdf8ee');
    P(cx, cy - 4, '#a9a5b8');
    P(cx, cy + 4, '#a9a5b8');
    P(cx - 4, cy, '#a9a5b8');
    P(cx + 4, cy, '#a9a5b8');
    const now = new Date();
    const m = now.getMinutes() + now.getSeconds() / 60;
    const hr = (now.getHours() % 12) + m / 60;
    const hand = (a, len, col) => {
      for (let r = 0; r <= len; r++) P(cx + Math.round(Math.sin(a) * r), cy - Math.round(Math.cos(a) * r), col);
    };
    hand((hr / 12) * Math.PI * 2, 2, OUT);
    hand((m / 60) * Math.PI * 2, 4, '#5a4d5e');
    P(cx, cy, '#d5534a');
  }

  function drawSunbeams(t) {
    for (const [x0, x1] of [[16, 64], [256, 304]]) {
      for (let y = 30; y < 150; y++) {
        const a = 0.11 * (1 - (y - 30) / 130);
        const off = Math.round(((y - 30) * 62) / 120);
        const left = x0 + off;
        const right = Math.min(x1 + off, ROOM_W - 4);
        if (right <= left) continue;
        ctx.fillStyle = `rgba(255, 236, 186, ${a.toFixed(3)})`;
        ctx.fillRect(left, y, right - left, 1);
      }
    }
    for (let i = 0; i < 20; i++) {
      const x0 = i % 2 ? 256 : 16;
      const u = (rnd(i) + t * 0.018 * (0.5 + rnd(i + 9))) % 1;
      const y = 34 + u * 104;
      const x = x0 + rnd(i + 3) * 46 + ((y - 30) * 62) / 120 + Math.sin(t * 0.7 + i) * 2;
      if (x > ROOM_W - 5) continue;
      const a = 0.3 + 0.3 * Math.sin(t * 2 + i * 1.7);
      ctx.fillStyle = `rgba(255, 248, 220, ${a.toFixed(2)})`;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  function steam(x, y, t, n = 3, rise = 7) {
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.7 + i / n) % 1;
      const sx = Math.round(x + Math.sin((t + i) * 3) * 1);
      const sy = Math.round(y - ph * rise);
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.7 * (1 - ph)).toFixed(2)})`;
      ctx.fillRect(sx, sy, 1, 1);
    }
  }

  function monitor(x, y, w, h, screen) {
    box(x, y, w, h, '#2f2b3a');
    R(x + 1, y + 1, w - 2, h - 2, '#1f2333');
    screen(x + 1, y + 1, w - 2, h - 2);
    R(x + Math.floor(w / 2) - 1, y + h, 2, 2, '#5f6678');
    R(x + Math.floor(w / 2) - 3, y + h + 2, 6, 1, '#4a5062');
  }

  function codeScreen(x, y, w, h, t, seed) {
    const scroll = Math.floor(t * 1.4 + seed * 7);
    const cols = ['#7ed492', '#7cc8e8', '#e88fb4', '#e9d27a', '#b9b2d6'];
    const rows = Math.floor(h / 2);
    for (let r = 0; r < rows; r++) {
      const n = r + scroll;
      const indent = Math.floor(rnd(n * 3 + seed) * 3) * 2;
      const len = 2 + Math.floor(rnd(n * 7 + seed) * (w - 4 - indent));
      R(x + 1 + indent, y + 1 + r * 2, len, 1, cols[Math.floor(rnd(n * 11 + seed) * cols.length)]);
    }
    if (Math.floor(t * 2) % 2) R(x + 2, y + (rows - 1) * 2 + 1, 2, 1, '#f2efe8');
  }

  function deskBase(x, y) {
    ellipse(x + 22, y + 24, 24, 3, SHADOW);
    R(x + 1, y + 18, 3, 6, '#5e3b25');
    R(x + 40, y + 18, 3, 6, '#5e3b25');
    box(x, y, 44, 19, '#b9834f');
    R(x, y, 44, 1, '#d09a63');
    R(x, y + 13, 44, 6, '#8f5d37');
    R(x, y + 13, 44, 1, '#734a2c');
    box(x + 30, y + 15, 11, 3, '#9c6840');
    P(x + 35, y + 16, '#e3c08f');
  }

  function drawEngineerDesk(t) {
    const x = 8;
    const y = 60;
    deskBase(x, y);
    monitor(x + 3, y - 9, 17, 12, (sx, sy, sw, sh) => codeScreen(sx, sy, sw, sh, t, 1));
    monitor(x + 22, y - 9, 17, 12, (sx, sy, sw, sh) => codeScreen(sx, sy, sw, sh, t, 2));
    box(x + 12, y + 8, 18, 3, '#d8d5e0');
    for (let i = 0; i < 8; i++) P(x + 13 + i * 2, y + 9, '#a9a5b8');
    box(x + 33, y + 8, 2, 3, '#d8d5e0');
    box(x + 40, y + 3, 3, 5, '#7bc96f');
    R(x + 40, y + 3, 3, 1, '#c8d0d8');
    // rubber duck
    R(x + 2, y + 7, 5, 3, '#f6d04d');
    R(x + 4, y + 5, 3, 3, '#f6d04d');
    P(x + 7, y + 6, '#ef8a3a');
    P(x + 5, y + 6, OUT);
  }

  function drawDesignerDesk(t) {
    const x = 8;
    const y = 118;
    deskBase(x, y);
    monitor(x + 7, y - 11, 28, 14, (sx, sy, sw, sh) => {
      R(sx, sy, sw, sh, '#ebe7f1');
      const boards = [
        ['#f6b6a6', 1, 1], ['#a9d6c2', 10, 1], ['#b8c6f2', 19, 1],
        ['#f7dc8a', 1, 7], ['#d9c2f0', 10, 7], ['#ffffff', 19, 7],
      ];
      boards.forEach(([c, bx, by]) => R(sx + bx, sy + by, 7, 4, c));
      const [, selX, selY] = boards[Math.floor(t / 1.8) % boards.length];
      ctx.strokeStyle = '#3d8bff';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx + selX - 0.5, sy + selY - 0.5, 8, 5);
      const cx = Math.round(sx + 2 + ((Math.sin(t * 0.9) + 1) / 2) * (sw - 5));
      const cy = Math.round(sy + 2 + ((Math.cos(t * 1.3) + 1) / 2) * (sh - 5));
      P(cx, cy, OUT);
      P(cx, cy + 1, OUT);
      P(cx + 1, cy + 1, OUT);
    });
    R(x + 31, y - 11, 4, 4, '#ffe27a');
    box(x + 13, y + 8, 14, 4, '#3a3640');
    R(x + 14, y + 9, 12, 2, '#55506a');
    R(x + 29, y + 8, 1, 4, '#e8e2d0');
    box(x + 38, y + 6, 4, 3, '#c7774f');
    R(x + 38, y + 4, 4, 2, '#7fb37a');
    P(x + 39, y + 3, '#9fd18f');
    P(x + 41, y + 3, '#9fd18f');
    box(x + 2, y + 6, 4, 4, '#f2efe8');
    P(x + 6, y + 7, '#f2efe8');
    steam(x + 4, y + 4, t);
  }

  function drawPmDesk(t) {
    const x = 268;
    const y = 60;
    deskBase(x, y);
    box(x + 12, y - 6, 20, 11, '#9aa3b5');
    R(x + 13, y - 5, 18, 9, '#f4f2f8');
    const bars = [[0, 6, '#e07a5f'], [3, 8, '#81b29a'], [7, 6, '#3d6fb6'], [10, 7, '#f2cc8f']];
    bars.forEach(([bx, bw, c], i) => {
      const len = i === 3 ? 1 + Math.floor(((t * 0.5) % 1) * bw) : bw;
      R(x + 14 + bx, y - 4 + i * 2, len, 1, c);
    });
    box(x + 10, y + 5, 24, 3, '#c3c8d6');
    R(x + 18, y + 6, 8, 1, '#a9afc0');
    box(x + 37, y + 4, 4, 5, '#f2efe8');
    R(x + 37, y + 4, 4, 1, '#6b4429');
    steam(x + 39, y + 2, t + 1);
    box(x + 3, y + 8, 3, 4, '#2f2b3a');
    if (t % 4 < 0.4) P(x + 4, y + 9, '#7ef0dc');
    [[2, 1, '#ffe27a'], [6, 3, '#f7a8c4'], [2, 5, '#9fd3f0'], [35, 10, '#ffe27a']].forEach(([nx, ny, c]) =>
      R(x + nx, y + ny, 3, 3, c),
    );
    R(x + 6, y + 14, 3, 3, '#ffe27a');
    R(x + 12, y + 15, 3, 3, '#f7a8c4');
    R(x + 19, y + 14, 3, 3, '#9fd3f0');
    R(x + 24, y + 15, 3, 3, '#ffe27a');
  }

  function drawChair(cx, y) {
    ellipse(cx, y + 12, 6, 2, SHADOW);
    R(cx - 5, y + 11, 10, 1, '#3a3640');
    P(cx - 5, y + 12, '#3a3640');
    P(cx + 4, y + 12, '#3a3640');
    R(cx - 1, y + 8, 2, 3, '#5f6678');
    box(cx - 6, y + 6, 12, 3, '#4b4658');
    box(cx - 5, y, 10, 6, '#5a546b');
    R(cx - 4, y + 1, 8, 1, '#6e6882');
  }

  const counterState = { brew: 0 };
  function drawCounter(t) {
    const x = 268;
    const y = 118;
    ellipse(x + 22, y + 25, 24, 3, SHADOW);
    box(x, y + 12, 44, 12, '#7f9db5');
    R(x + 14, y + 13, 1, 11, '#6a879e');
    R(x + 29, y + 13, 1, 11, '#6a879e');
    P(x + 12, y + 17, '#e8e2d0');
    P(x + 16, y + 17, '#e8e2d0');
    P(x + 31, y + 17, '#e8e2d0');
    box(x, y, 44, 12, '#e8e3d8');
    R(x, y, 44, 1, '#f7f3ea');
    R(x, y + 11, 44, 1, '#cfc8b8');
    // coffee machine
    box(x + 4, y - 10, 12, 16, '#3a3640');
    R(x + 5, y - 9, 10, 3, '#4a4552');
    P(x + 13, y - 8, counterState.brew > 0 || Math.floor(t) % 3 ? '#e0584a' : '#7a3a35');
    R(x + 8, y - 5, 4, 1, '#1f1b24');
    box(x + 7, y, 6, 5, '#9ec8d8');
    R(x + 7, y + 2, 6, 3, '#5a3826');
    if (counterState.brew > 0) {
      steam(x + 10, y - 12, t * 2, 5, 10);
      if (Math.floor(t * 8) % 2) P(x + 10, y - 4, '#5a3826');
    }
    box(x + 20, y + 4, 3, 4, '#f2efe8');
    box(x + 25, y + 4, 3, 4, '#e07a5f');
    ellipse(x + 36, y + 7, 5, 2, '#d7c3a3');
    R(x + 33, y + 4, 2, 2, '#f0a040');
    R(x + 36, y + 3, 2, 2, '#f0a040');
    R(x + 38, y + 5, 2, 2, '#e8c547');
  }

  const cooler = { bubbles: [], next: 3 };
  function drawCooler() {
    const cx = 160;
    const b = 112;
    ellipse(cx, b, 9, 3, SHADOW);
    box(cx - 7, b - 18, 14, 18, '#ebe8f1');
    R(cx + 3, b - 18, 4, 18, '#d3cfdf');
    R(cx - 4, b - 14, 8, 6, '#c9c4d8');
    R(cx - 3, b - 13, 2, 2, '#5aa8e0');
    R(cx + 1, b - 13, 2, 2, '#e0584a');
    R(cx - 4, b - 8, 8, 1, '#8a86a0');
    R(cx - 7, b - 1, 14, 1, '#bdb8cc');
    R(cx + 4, b - 6, 2, 3, '#f7f3ea');
    box(cx - 6, b - 32, 12, 13, '#8fd0f0');
    R(cx - 6, b - 32, 12, 1, '#b8e4f8');
    R(cx - 6, b - 26, 12, 1, '#6fbbe4');
    R(cx - 6, b - 22, 12, 1, '#6fbbe4');
    R(cx - 4, b - 30, 1, 8, '#d8f2ff');
    R(cx - 2, b - 19, 4, 1, '#6fbbe4');
    for (const bub of cooler.bubbles) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(Math.round(cx + bub.x), Math.round(b - 20 - bub.y), bub.big ? 2 : 1, bub.big ? 2 : 1);
    }
  }

  function drawBookshelf() {
    const x = 74;
    const y = 16;
    const w = 28;
    const h = 38;
    R(x + 1, y + h, w, 2, SHADOW);
    box(x, y, w, h, '#8a5a38');
    R(x + 2, y + 2, w - 4, h - 4, '#5e3b26');
    const colors = ['#d5634e', '#e3a857', '#5e8fb5', '#7aa86f', '#a46fb0', '#ecd9b0', '#4d6a8f'];
    const shelves = [y + 2, y + 13, y + 24];
    shelves.forEach((sy, s) => {
      let bx = x + 3;
      let k = 0;
      while (bx < x + w - 4) {
        const bw = 2 + Math.floor(rnd(s * 17 + k) * 2);
        const bh = 6 + Math.floor(rnd(s * 29 + k) * 3);
        if (bx + bw > x + w - 3) break;
        if (rnd(s * 41 + k) > 0.86) {
          R(bx, sy + 9 - bh + 2, bh - 2, bw, colors[(s * 3 + k) % colors.length]);
          bx += bh - 1;
        } else {
          R(bx, sy + 9 - bh, bw, bh, colors[(s * 3 + k) % colors.length]);
          R(bx, sy + 9 - bh + 2, bw, 1, 'rgba(255, 255, 255, 0.25)');
          bx += bw;
        }
        k++;
      }
      R(x + 2, sy + 9, w - 4, 2, '#a8754a');
    });
    R(x + 2, y + h - 3, w - 4, 1, '#a8754a');
    box(x + 3, y - 4, 5, 4, '#c7774f');
    ellipse(x + 5, y - 6, 3, 2, '#5e9b5a');
    P(x + 4, y - 8, '#7fbf78');
  }

  function drawFern(cx, base, t) {
    ellipse(cx, base, 7, 2, SHADOW);
    const fronds = 7;
    for (let i = 0; i < fronds; i++) {
      const a = -1.25 + (i / (fronds - 1)) * 2.5 + Math.sin(t * 1.2 + i) * 0.05;
      const len = 9 + (i % 2 ? 2 : 4);
      for (let s = 2; s <= len; s++) {
        const px = Math.round(cx + Math.sin(a) * s);
        const py = Math.round(base - 9 - Math.cos(a) * s * 0.95 + s * s * 0.035);
        P(px, py, '#3f7444');
        if (s % 2 === 0) {
          P(px - 1, py, '#5e9b5a');
          P(px + 1, py, '#5e9b5a');
          P(px, py - 1, '#78b56f');
        }
      }
    }
    box(cx - 5, base - 8, 10, 7, '#c7774f');
    box(cx - 6, base - 10, 12, 2, '#d98a5e');
    R(cx - 4, base - 6, 1, 4, '#d98a5e');
  }

  function drawBush(cx, base) {
    ellipse(cx, base, 8, 2, SHADOW);
    ellipse(cx, base - 14, 8, 7, OUT);
    ellipse(cx, base - 14, 7, 6, '#3f7444');
    ellipse(cx - 1, base - 15, 6, 5, '#5e9b5a');
    P(cx - 3, base - 17, '#8cc47f');
    P(cx + 1, base - 18, '#8cc47f');
    P(cx + 3, base - 14, '#8cc47f');
    box(cx - 4, base - 7, 8, 6, '#c7774f');
    R(cx - 3, base - 6, 1, 4, '#d98a5e');
  }

  function drawSofa() {
    const x = 130;
    const y = 158;
    const w = 60;
    ellipse(160, 181, 32, 3, SHADOW);
    box(x + 4, y, w - 8, 8, '#8fb0cf');
    R(x + 21, y, 1, 8, '#7798ba');
    R(x + 38, y, 1, 8, '#7798ba');
    box(x + 9, y - 3, 8, 6, '#f2c46d');
    R(x + 10, y - 2, 6, 1, '#f7d891');
    box(x, y - 2, 6, 21, '#6d8fb5');
    box(x + w - 6, y - 2, 6, 21, '#6d8fb5');
    R(x, y - 2, 6, 1, '#8fb0cf');
    R(x + w - 6, y - 2, 6, 1, '#8fb0cf');
    box(x + 6, y + 7, w - 12, 12, '#5f80a8');
    R(x + 6, y + 7, w - 12, 2, '#7a9cc2');
    for (let i = x + 12; i < x + w - 8; i += 9) P(i, y + 13, '#4f6f96');
    R(x + 2, y + 19, 2, 2, '#4a3528');
    R(x + w - 4, y + 19, 2, 2, '#4a3528');
  }

  function drawPrinter(t) {
    ellipse(89, 180, 13, 2, SHADOW);
    box(78, 168, 22, 12, '#8a5a38');
    R(89, 169, 1, 10, '#734a2c');
    P(87, 174, '#e3c08f');
    P(91, 174, '#e3c08f');
    box(80, 160, 18, 8, '#e1dee8');
    R(80, 160, 18, 2, '#f2f0f5');
    R(82, 163, 14, 1, '#4a4552');
    R(84, 157, 10, 3, '#fdfdf8');
    P(96, 165, Math.floor(t * 1.5) % 2 ? '#f0a040' : '#8a6a3a');
  }

  // Draw order is by "y" (the bottom edge of each thing), so characters can walk behind furniture.
  const decor = [
    { y: 54, draw: drawBookshelf },
    { y: 56, draw: (t) => drawFern(113, 56, t) },
    { y: 84, draw: drawEngineerDesk },
    { y: 99, draw: () => drawChair(30, 87) },
    { y: 142, draw: drawDesignerDesk },
    { y: 157, draw: () => drawChair(30, 145) },
    { y: 84, draw: drawPmDesk },
    { y: 99, draw: () => drawChair(290, 87) },
    { y: 142, draw: drawCounter },
    { y: 112, draw: drawCooler },
    { y: 180, draw: drawSofa },
    { y: 180, draw: drawPrinter },
    { y: 182, draw: () => drawBush(15, 182) },
    { y: 182, draw: () => drawBush(305, 182) },
  ];

  const solids = [
    [74, 46, 28, 10],
    [107, 48, 12, 9],
    [8, 58, 44, 26],
    [24, 93, 12, 6],
    [8, 116, 44, 26],
    [24, 151, 12, 6],
    [268, 58, 44, 26],
    [284, 93, 12, 6],
    [268, 112, 44, 30],
    [152, 105, 16, 9],
    [130, 160, 60, 21],
    [77, 166, 24, 15],
    [8, 173, 14, 10],
    [298, 173, 14, 10],
  ];

  const props = [
    { id: 'whiteboard', label: 'Read the whiteboard', zone: [124, 36, 72, 16], mark: [160, 5] },
    { id: 'poster', label: 'Look at the poster', zone: [200, 36, 26, 16], mark: [213, 7] },
    { id: 'employee', label: 'Look at the photo', zone: [226, 36, 24, 16], mark: [237, 8] },
    { id: 'window', label: 'Look outside', zone: [14, 36, 52, 18], mark: [40, 4] },
    { id: 'window', label: 'Look outside', zone: [254, 36, 52, 18], mark: [280, 4] },
    { id: 'bookshelf', label: 'Browse the bookshelf', zone: [70, 36, 34, 24], mark: [96, 15] },
    { id: 'kevin', label: 'Say hi to Kevin', zone: [102, 40, 22, 22], mark: [113, 34] },
    { id: 'engineerDesk', label: "Look at the Engineer's desk", own: 'Check your screens', zone: [4, 54, 54, 36], mark: [30, 50] },
    { id: 'designerDesk', label: "Look at the Designer's desk", own: 'Check your artboards', zone: [4, 112, 54, 36], mark: [30, 106] },
    { id: 'pmDesk', label: "Look at the PM's desk", own: 'Check your tabs', zone: [262, 54, 54, 36], mark: [290, 53] },
    { id: 'coffee', label: 'Make a coffee', zone: [262, 108, 54, 40], mark: [278, 106], sfx: 'brew' },
    { id: 'cooler', label: 'Use the water cooler', zone: [140, 94, 40, 28], mark: [160, 78], sfx: 'gurgle' },
    { id: 'sofa', label: 'Look at the couch', zone: [126, 154, 68, 32], mark: [160, 153] },
    { id: 'printer', label: 'Check the printer', zone: [72, 158, 34, 28], mark: [89, 155] },
    { id: 'plant', label: 'Look at the plant', zone: [4, 164, 24, 22], mark: [15, 159] },
    { id: 'plant', label: 'Look at the plant', zone: [294, 164, 24, 22], mark: [305, 159] },
  ];
  const ownDesk = { engineerDesk: 'engineer', designerDesk: 'designer', pmDesk: 'pm' };

  // ---------------------------------------------------------------------------
  // People
  // ---------------------------------------------------------------------------

  const makePerson = (id, x, y, dir) => ({
    id, x, y, dir, moving: false, animT: 0, blink: 1 + Math.random() * 3, lookT: 1 + Math.random() * 3,
  });
  const people = {
    designer: makePerson('designer', 134, 118, 'right'),
    engineer: makePerson('engineer', 186, 118, 'left'),
    pm: makePerson('pm', 160, 142, 'up'),
  };
  const ai = { x: 206, y: 94, t: 0, blink: 2 };

  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const frameOf = (p) => (p.moving ? [1, 0, 2, 0][Math.floor(p.animT / 0.13) % 4] : 0);
  const aiBob = () => Math.round(Math.sin(time * 2.6) * 1.5);

  function faceToward(p, x, y) {
    const dx = x - p.x;
    const dy = y - p.y;
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 'right' : 'left';
    else p.dir = dy > 0 ? 'down' : 'up';
  }

  const RING = { designer: '#f08a6e', engineer: '#7fc79a', pm: '#8ea3e8' };

  function drawPerson(p) {
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    if (p.id === playerId && state !== 'title') {
      ellipse(x, y, 7, 3, RING[p.id]);
      ellipse(x, y, 6, 2, 'rgba(255, 255, 255, 0.35)');
    }
    ellipse(x, y, 5, 2, SHADOW);
    const view = p.dir === 'up' ? 'up' : p.dir === 'down' ? 'down' : 'side';
    const blink = p.blink < 0 && view !== 'up';
    const spr = sprites[p.id][blink ? view + 'Blink' : view][frameOf(p)];
    if (p.dir === 'left') {
      ctx.save();
      ctx.translate(x + 7, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(spr, 0, y - 19);
      ctx.restore();
    } else {
      ctx.drawImage(spr, x - 7, y - 19);
    }
  }

  function drawAI() {
    const x = Math.round(ai.x);
    const y = Math.round(ai.y);
    const bob = aiBob();
    ellipse(x, y, 4 - (bob > 0 ? 1 : 0), 1, 'rgba(58, 34, 32, 0.16)');
    ctx.fillStyle = 'rgba(126, 240, 220, 0.12)';
    ellipse(x, y - 21 + bob, 10, 9, 'rgba(126, 240, 220, 0.12)');
    ctx.drawImage(ai.blink < 0 ? aiBlink : aiSprite, x - 7, y - 27 + bob);
    const tw = (time * 1.3) % 3;
    if (tw < 0.5) {
      const sx = x + 7 + Math.round(Math.sin(time) * 2);
      const sy = y - 28 + bob;
      const c = tw < 0.25 ? '#ffd36b' : '#fff3c4';
      P(sx, sy - 1, c);
      P(sx - 1, sy, c);
      P(sx, sy, c);
      P(sx + 1, sy, c);
      P(sx, sy + 1, c);
    }
  }

  // ---------------------------------------------------------------------------
  // Speech bubbles and markers
  // ---------------------------------------------------------------------------

  const GLYPHS = {
    '!': ['..#..', '..#..', '..#..', '.....', '..#..'],
    '?': ['.###.', '....#', '..##.', '.....', '..#..'],
    note: ['..##.', '..#.#', '..#..', '###..', '##...'],
    heart: ['.#.#.', '#####', '#####', '.###.', '..#..'],
    dots: ['.....', '.....', '#.#.#', '.....', '.....'],
    spark: ['..#..', '.###.', '#####', '.###.', '..#..'],
  };
  const GLYPH_COL = {
    '!': '#d5534a', '?': '#3d6fb6', note: '#7a5cd6', heart: '#e0587a', dots: OUT, spark: '#e3a530',
  };

  function drawBubble(x, y, kind) {
    const top = y - 10;
    R(x - 4, top, 9, 1, OUT);
    R(x - 4, top + 8, 9, 1, OUT);
    R(x - 5, top + 1, 1, 7, OUT);
    R(x + 5, top + 1, 1, 7, OUT);
    R(x - 4, top + 1, 9, 7, '#fdf8ee');
    P(x - 1, top + 8, '#fdf8ee');
    P(x - 2, top + 9, OUT);
    P(x - 1, top + 9, '#fdf8ee');
    P(x, top + 9, OUT);
    P(x - 1, top + 10, OUT);
    const g = GLYPHS[kind];
    const col = GLYPH_COL[kind];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (g[r][c] === '#') P(x - 2 + c, top + 2 + r, col);
  }

  function drawSweat(x, y, t) {
    const dx = x + 6;
    const dy = y + 4 + Math.floor((t * 5) % 3);
    R(dx - 1, dy - 1, 3, 1, OUT);
    R(dx - 2, dy, 5, 3, OUT);
    R(dx - 1, dy + 3, 3, 1, OUT);
    P(dx, dy - 1, '#bfe6fb');
    R(dx - 1, dy, 3, 3, '#7cc4ec');
    P(dx - 1, dy, '#bfe6fb');
  }

  function drawArrow(x, tip) {
    const ty = tip - 4;
    R(x - 3, ty, 7, 2, OUT);
    R(x - 2, ty + 1, 5, 1, '#fdf8ee');
    R(x - 2, ty + 2, 5, 1, OUT);
    R(x - 1, ty + 2, 3, 1, '#fdf8ee');
    R(x - 1, ty + 3, 3, 1, OUT);
    P(x, ty + 3, '#fdf8ee');
    P(x, ty + 4, OUT);
  }

  function headPos(id) {
    if (id === 'ai') return [Math.round(ai.x), Math.round(ai.y) - 28 + aiBob()];
    const p = people[id];
    return [Math.round(p.x), Math.round(p.y) - 21];
  }

  const particles = [];
  function burst(x, y) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const sp = 18 + Math.random() * 18;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - 10, life: 0.6 + Math.random() * 0.3, age: 0 });
    }
  }

  // ---------------------------------------------------------------------------
  // Sound (tiny WebAudio synth, muted by default)
  // ---------------------------------------------------------------------------

  const Sound = {
    on: false,
    ac: null,
    master: null,
    noiseBuf: null,
    init() {
      try {
        this.on = localStorage.getItem('watercooler:sound') === 'on';
      } catch (e) {
        this.on = false;
      }
    },
    ensure() {
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ac = new AC();
        this.master = this.ac.createGain();
        this.master.gain.value = 0.6;
        this.master.connect(this.ac.destination);
      }
      if (this.ac.state === 'suspended') this.ac.resume();
      return this.ac;
    },
    set(on) {
      this.on = on;
      try {
        localStorage.setItem('watercooler:sound', on ? 'on' : 'off');
      } catch (e) {
        /* storage unavailable */
      }
      if (on) this.ensure();
    },
    tone(freq, dur, { type = 'square', vol = 0.05, to = null, at = 0 } = {}) {
      if (!this.on) return;
      const ac = this.ensure();
      if (!ac) return;
      const t0 = ac.currentTime + at;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    },
    noise(dur, { vol = 0.04, freq = 1000, at = 0 } = {}) {
      if (!this.on) return;
      const ac = this.ensure();
      if (!ac) return;
      if (!this.noiseBuf) {
        const len = ac.sampleRate;
        this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = ac.currentTime + at;
      const src = ac.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    },
    blip(id) {
      const f = VOICE[id];
      if (!f) return;
      this.tone(f * (0.94 + Math.random() * 0.12), 0.05, { type: id === 'ai' ? 'triangle' : 'square', vol: id === 'ai' ? 0.06 : 0.025 });
    },
    step() {
      this.noise(0.04, { vol: 0.05, freq: 650 });
    },
    open() {
      this.tone(660, 0.07, { type: 'triangle', vol: 0.06 });
      this.tone(990, 0.09, { type: 'triangle', vol: 0.05, at: 0.06 });
    },
    close() {
      this.tone(740, 0.06, { type: 'triangle', vol: 0.04 });
      this.tone(520, 0.08, { type: 'triangle', vol: 0.04, at: 0.05 });
    },
    swap() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1, { type: 'triangle', vol: 0.05, at: i * 0.06 }));
    },
    gurgle() {
      for (let i = 0; i < 6; i++) {
        const f = 180 + Math.random() * 160;
        this.tone(f, 0.08, { type: 'sine', vol: 0.12, to: f * 2.4, at: i * 0.1 + Math.random() * 0.04 });
      }
    },
    brew() {
      this.noise(0.9, { vol: 0.05, freq: 500 });
      for (let i = 0; i < 4; i++) {
        this.tone(300 + Math.random() * 120, 0.06, { type: 'sine', vol: 0.06, to: 700, at: 0.3 + i * 0.12 });
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------

  let state = 'title';
  let playerId = 'designer';
  let target = null;
  let time = 0;
  let camX = 0;
  let viewW = ROOM_W;
  let emote = null;
  const talkCount = {};
  const propCount = {};
  const lastIdle = {};
  const keys = { up: false, down: false, left: false, right: false };
  const touchDir = { x: 0, y: 0 };
  let touchUI = window.matchMedia('(pointer: coarse)').matches;

  const player = () => people[playerId];

  function blocked(x, y, self) {
    if (x < 10 || x > ROOM_W - 10 || y < 52 || y > FLOOR_BOTTOM - 3) return true;
    const fx = x - 4;
    const fy = y - 3;
    for (const r of solids) {
      if (fx < r[0] + r[2] && fx + 8 > r[0] && fy < r[1] + r[3] && fy + 3 > r[1]) return true;
    }
    for (const id of IDS) {
      const o = people[id];
      if (o === self) continue;
      if (Math.abs(o.x - x) < 9 && Math.abs(o.y - y) < 5) return true;
    }
    return false;
  }

  function findTarget() {
    const p = player();
    const v = DIRV[p.dir];
    const tx = p.x + v[0] * 9;
    const ty = p.y - 3 + v[1] * 9;
    let best = null;
    let bd = Infinity;
    for (const id of IDS) {
      if (id === playerId) continue;
      const o = people[id];
      const d = Math.hypot(o.x - tx, o.y - 3 - ty);
      if (d < 13 && d < bd) {
        bd = d;
        best = { kind: 'npc', id };
      }
    }
    const ad = Math.hypot(ai.x - tx, ai.y - 4 - ty);
    if (ad < 15 && ad < bd) {
      bd = ad;
      best = { kind: 'npc', id: 'ai' };
    }
    for (const it of props) {
      const [zx, zy, zw, zh] = it.zone;
      if (tx < zx || tx > zx + zw || ty < zy || ty > zy + zh) continue;
      const d = Math.hypot(tx - (zx + zw / 2), ty - (zy + zh / 2)) * 0.5 + 10;
      if (d < bd) {
        bd = d;
        best = { kind: 'prop', it };
      }
    }
    return best;
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
      if (t.id === 'ai') faceToward(me, ai.x, ai.y);
      else {
        faceToward(me, people[t.id].x, people[t.id].y);
        faceToward(people[t.id], me.x, me.y);
      }
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
      for (let i = 0; i < 8; i++) {
        cooler.bubbles.push({ x: -3 + Math.random() * 6, y: -Math.random() * 3, v: 6 + Math.random() * 6, big: Math.random() < 0.4 });
      }
    }
    if (it.sfx === 'brew') {
      Sound.brew();
      counterState.brew = 2.2;
    }
    openDialogue(propLines(it.id), null);
  }

  // ---------------------------------------------------------------------------
  // Dialogue
  // ---------------------------------------------------------------------------

  const dlg = { lines: null, i: 0, shown: 0, full: '', who: null, wait: 0, partner: null, lastChar: 0 };

  function openDialogue(lines, partner) {
    if (!lines || !lines.length) return;
    state = 'dialogue';
    dlg.lines = lines;
    dlg.i = 0;
    dlg.partner = partner;
    el.dialogue.hidden = false;
    Sound.open();
    showLine();
    updateSwitcher();
  }

  function showLine() {
    const [who, text, kind] = dlg.lines[dlg.i];
    const id = who === 'N' ? 'narrator' : BY_LETTER[who];
    dlg.who = id;
    dlg.full = text;
    dlg.shown = 0;
    dlg.lastChar = 0;
    dlg.wait = 0.08;
    el.dialogue.dataset.who = id;
    el.dlgName.textContent = id === 'narrator' ? '' : NAMES[id];
    el.dlgText.textContent = '';
    el.dlgLive.textContent = id === 'narrator' ? text : `${NAMES[id]}: ${text}`;
    el.dialogue.classList.add('is-typing');
    if (id !== 'narrator') paintPortrait(el.portrait, id);
    emote = kind && id !== 'narrator' ? { who: id, kind, t: 0 } : null;
  }

  function advanceDialogue() {
    if (dlg.shown < dlg.full.length) {
      dlg.shown = dlg.full.length;
      el.dlgText.textContent = dlg.full;
      el.dialogue.classList.remove('is-typing');
      return;
    }
    dlg.i++;
    if (dlg.i >= dlg.lines.length) closeDialogue();
    else showLine();
  }

  function closeDialogue() {
    el.dialogue.hidden = true;
    el.dialogue.classList.remove('is-typing');
    el.dlgLive.textContent = '';
    state = 'play';
    emote = null;
    dlg.partner = null;
    Sound.close();
    updateSwitcher();
  }

  function updateDialogue(dt) {
    if (emote) emote.t += dt;
    if (dlg.shown >= dlg.full.length) return;
    if (dlg.wait > 0) {
      dlg.wait -= dt;
      return;
    }
    dlg.shown = Math.min(dlg.full.length, dlg.shown + dt * 48);
    const n = Math.floor(dlg.shown);
    while (dlg.lastChar < n) {
      const ch = dlg.full[dlg.lastChar];
      dlg.lastChar++;
      if (ch !== ' ' && dlg.lastChar % 2 === 0) Sound.blip(dlg.who);
      if ('.!?,'.includes(ch) && dlg.lastChar < dlg.full.length && dlg.full[dlg.lastChar] === ' ') {
        dlg.wait = ch === ',' ? 0.08 : 0.18;
        dlg.shown = dlg.lastChar;
        break;
      }
    }
    el.dlgText.textContent = dlg.full.slice(0, dlg.lastChar);
    if (dlg.lastChar >= dlg.full.length) {
      dlg.shown = dlg.full.length;
      el.dialogue.classList.remove('is-typing');
    }
  }

  // ---------------------------------------------------------------------------
  // UI: switcher, toast, hint, title
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
    c.width = 14;
    c.height = 12;
    paintPortrait(c, id);
    const label = document.createElement('span');
    label.textContent = SHORT[id];
    const k = document.createElement('kbd');
    k.textContent = String(i + 1);
    b.append(c, label, k);
    b.addEventListener('click', () => {
      b.blur();
      if (state === 'title') start();
      switchTo(id);
    });
    el.switcher.append(b);
    whoButtons[id] = b;
  });

  function updateSwitcher() {
    for (const id of IDS) {
      whoButtons[id].setAttribute('aria-pressed', String(id === playerId));
      whoButtons[id].disabled = state === 'dialogue';
    }
  }

  IDS.forEach((id) => {
    const fig = document.createElement('figure');
    const c = document.createElement('canvas');
    c.width = 14;
    c.height = 20;
    c.getContext('2d').drawImage(sprites[id].down[0], 0, 0);
    const cap = document.createElement('figcaption');
    cap.textContent = SHORT[id];
    fig.append(c, cap);
    el.cast.append(fig);
  });

  let toastTimer = 0;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 1700);
  }

  let lastHint = null;
  function updateHint() {
    const key = touchUI ? 'A' : 'Space';
    let html = '';
    if (state === 'dialogue') html = `<kbd>${key}</kbd> Continue`;
    else if (state === 'play' && target) html = `<kbd>${key}</kbd> ${targetLabel(target)}`;
    else if (state === 'play') html = 'Walk over to someone and say hi';
    if (html !== lastHint) {
      el.hint.innerHTML = html;
      lastHint = html;
    }
  }

  function switchTo(id) {
    if (state !== 'play' || id === playerId) return;
    const prev = player();
    prev.moving = false;
    prev.animT = 0;
    playerId = id;
    const p = player();
    burst(p.x, p.y - 10);
    Sound.swap();
    toast(`You're now ${NAMES[id]}`);
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
          ? "You're The Designer. Walk with the pad, press A to talk, and tap Swap (or a face below) to become someone else."
          : "You're The Designer. Walk with the arrow keys, press Space to talk, and press Tab to become someone else.",
      ],
    ];
  }

  function start() {
    if (state !== 'title') return;
    el.title.classList.add('is-hidden');
    el.title.setAttribute('aria-hidden', 'true');
    state = 'play';
    if (Sound.on) Sound.ensure();
    updateSwitcher();
    openDialogue(intro(), null);
  }

  function setSoundUI() {
    el.sound.setAttribute('aria-pressed', String(Sound.on));
    el.soundLabel.textContent = Sound.on ? 'Sound on' : 'Sound off';
  }

  function toggleSound() {
    Sound.set(!Sound.on);
    setSoundUI();
    if (Sound.on) Sound.open();
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

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onLink = document.activeElement && document.activeElement.matches('a, #sound');
    if (MOVE_KEYS[e.code]) {
      keys[MOVE_KEYS[e.code]] = true;
      e.preventDefault();
      return;
    }
    if (ACTION_KEYS.has(e.code)) {
      if (onLink && (e.code === 'Space' || e.code === 'Enter')) return;
      e.preventDefault();
      if (!e.repeat) action();
      return;
    }
    if (e.code === 'Tab' && state !== 'title' && !onLink) {
      e.preventDefault();
      cycleSwitch(e.shiftKey ? -1 : 1);
      return;
    }
    if (e.code === 'KeyQ') return cycleSwitch(1);
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      switchTo(IDS[Number(e.code.slice(-1)) - 1]);
      return;
    }
    if (e.code === 'KeyM') toggleSound();
  });

  window.addEventListener('keyup', (e) => {
    if (MOVE_KEYS[e.code]) keys[MOVE_KEYS[e.code]] = false;
  });

  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    touchDir.x = touchDir.y = 0;
  });

  el.sound.addEventListener('click', () => {
    toggleSound();
    el.sound.blur();
  });
  el.start.addEventListener('click', (e) => {
    e.stopPropagation();
    start();
  });
  el.title.addEventListener('click', start);
  el.dialogue.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state === 'dialogue') advanceDialogue();
  });

  function enableTouchUI() {
    if (touchUI) return;
    touchUI = true;
    document.body.classList.add('is-touch');
    lastHint = null;
    resize();
  }
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') enableTouchUI();
  }, { capture: true });

  // D-pad: slide your thumb around it, eight directions.
  const arrows = [...el.dpad.querySelectorAll('.dpad__arrow')];
  let dpadPointer = null;
  function dpadFrom(e) {
    const r = el.dpad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    touchDir.x = 0;
    touchDir.y = 0;
    if (Math.hypot(dx, dy) > 12) {
      const oct = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
      const map = {
        0: [1, 0], 1: [1, 1], 2: [0, 1], 3: [-1, 1], 4: [-1, 0], '-4': [-1, 0], '-3': [-1, -1], '-2': [0, -1], '-1': [1, -1],
      };
      [touchDir.x, touchDir.y] = map[oct];
    }
    for (const a of arrows) {
      const d = a.dataset.d;
      const on = (d === 'up' && touchDir.y < 0) || (d === 'down' && touchDir.y > 0) || (d === 'left' && touchDir.x < 0) || (d === 'right' && touchDir.x > 0);
      a.classList.toggle('is-on', on);
    }
  }
  function dpadEnd(e) {
    if (e.pointerId !== dpadPointer) return;
    dpadPointer = null;
    touchDir.x = touchDir.y = 0;
    arrows.forEach((a) => a.classList.remove('is-on'));
  }
  el.dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dpadPointer = e.pointerId;
    el.dpad.setPointerCapture(e.pointerId);
    dpadFrom(e);
  });
  el.dpad.addEventListener('pointermove', (e) => {
    if (e.pointerId === dpadPointer) dpadFrom(e);
  });
  el.dpad.addEventListener('pointerup', dpadEnd);
  el.dpad.addEventListener('pointercancel', dpadEnd);

  function pressable(btn, fn) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('is-down');
      fn();
    });
    const up = () => btn.classList.remove('is-down');
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  }
  pressable(el.tA, action);
  pressable(el.tSwap, () => (state === 'title' ? start() : cycleSwitch(1)));

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  function resize() {
    document.body.classList.toggle('is-touch', touchUI);
    const portrait = window.innerHeight > window.innerWidth;
    const reserve = touchUI && portrait ? 190 : 0;
    const padX = touchUI ? 16 : 48;
    const availW = window.innerWidth - padX;
    const availH =
      window.innerHeight - el.bar.offsetHeight - el.dock.offsetHeight - el.help.offsetHeight - reserve - 20;
    let s = Math.min(availW / ROOM_W, availH / ROOM_H);
    let w = ROOM_W;
    if (s < 2 && availW / Math.max(1, availH) < 1.3) {
      // Narrow screens: zoom in and let the camera follow the player.
      s = Math.max(1, Math.min(2, availH / ROOM_H));
      w = Math.min(ROOM_W, Math.floor(availW / s));
    } else if (s >= 2) {
      s = Math.floor(s);
    }
    s = Math.max(0.5, s);
    viewW = w;
    el.canvas.width = w;
    el.canvas.height = ROOM_H;
    mainCtx.imageSmoothingEnabled = false;
    vignette = null;
    el.stage.style.width = `${Math.round(w * s)}px`;
    el.stage.style.height = `${Math.round(ROOM_H * s)}px`;
    el.stage.style.setProperty('--s', s.toFixed(3));
    el.dock.style.width = `${Math.round(w * s)}px`;
    camX = clamp(player().x - viewW / 2, 0, ROOM_W - viewW);
  }
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  function update(dt) {
    time += dt;
    const me = player();

    if (state === 'play') {
      const dx = clamp((keys.right ? 1 : 0) - (keys.left ? 1 : 0) + touchDir.x, -1, 1);
      const dy = clamp((keys.down ? 1 : 0) - (keys.up ? 1 : 0) + touchDir.y, -1, 1);
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        const sp = WALK_SPEED * dt;
        const mx = (dx / len) * sp;
        const my = (dy / len) * sp;
        if (!blocked(me.x + mx, me.y, me)) me.x += mx;
        if (!blocked(me.x, me.y + my, me)) me.y += my;
        const horiz = dx > 0 ? 'right' : dx < 0 ? 'left' : null;
        const vert = dy > 0 ? 'down' : dy < 0 ? 'up' : null;
        if (me.dir !== horiz && me.dir !== vert) me.dir = horiz || vert;
        const prev = frameOf(me);
        me.moving = true;
        me.animT += dt;
        const f = frameOf(me);
        if (f !== prev && f !== 0) Sound.step();
      } else {
        me.moving = false;
        me.animT = 0;
      }
      target = findTarget();
    } else {
      me.moving = false;
      me.animT = 0;
    }

    for (const id of IDS) {
      const p = people[id];
      p.blink -= dt;
      if (p.blink < -0.13) p.blink = 2 + Math.random() * 3.5;
      if (id === playerId || state === 'title') continue;
      if (state === 'dialogue' && dlg.partner === id) continue;
      const d = Math.hypot(me.x - p.x, me.y - p.y);
      if (d < 34) {
        faceToward(p, me.x, me.y);
        p.lookT = 1.5;
      } else {
        p.lookT -= dt;
        if (p.lookT <= 0) {
          p.lookT = 2.5 + Math.random() * 4;
          if (Math.random() < 0.6) faceToward(p, 160, 108);
          else p.dir = pick(['down', 'left', 'right', 'down']);
        }
      }
    }

    if (!(state === 'dialogue' && dlg.partner === 'ai')) ai.t += dt;
    ai.x = 206 + Math.sin(ai.t * 0.45) * 14;
    ai.y = 94 + Math.sin(ai.t * 0.9) * 5;
    ai.blink -= dt;
    if (ai.blink < -0.15) ai.blink = 2.5 + Math.random() * 3;

    cooler.next -= dt;
    if (cooler.next <= 0) {
      cooler.next = 4 + Math.random() * 5;
      for (let i = 0; i < 2; i++) cooler.bubbles.push({ x: -2 + Math.random() * 4, y: -i * 2, v: 5 + Math.random() * 3, big: false });
    }
    for (const b of cooler.bubbles) {
      b.y += b.v * dt;
      b.x += Math.sin(time * 6 + b.v) * dt * 2;
    }
    cooler.bubbles = cooler.bubbles.filter((b) => b.y < 10);

    if (counterState.brew > 0) counterState.brew -= dt;

    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
    }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].age > particles[i].life) particles.splice(i, 1);

    if (state === 'dialogue') updateDialogue(dt);

    const goal = clamp(me.x - viewW / 2, 0, ROOM_W - viewW);
    camX += (goal - camX) * Math.min(1, dt * 5);

    updateHint();
  }

  let vignette = null;
  function drawVignette() {
    const w = el.canvas.width;
    if (!vignette || vignette.width !== w) {
      const [c, x] = makeCanvas(w, ROOM_H);
      const g = x.createRadialGradient(w / 2, ROOM_H * 0.55, Math.min(w, ROOM_H) * 0.35, w / 2, ROOM_H * 0.55, Math.max(w, ROOM_H) * 0.78);
      g.addColorStop(0, 'rgba(40, 20, 30, 0)');
      g.addColorStop(1, 'rgba(40, 20, 30, 0.26)');
      x.fillStyle = g;
      x.fillRect(0, 0, w, ROOM_H);
      vignette = c;
    }
    mainCtx.drawImage(vignette, 0, 0);
  }

  function render() {
    ctx = mainCtx;
    ctx.setTransform(1, 0, 0, 1, -Math.round(camX), 0);
    ctx.drawImage(bg, 0, 0);
    drawWindow(14, 5, 52, 24, time, 1);
    drawWindow(254, 5, 52, 24, time, 2);
    drawClock();
    drawSunbeams(time);

    const ents = decor.slice();
    for (const id of IDS) {
      const p = people[id];
      ents.push({ y: p.y, draw: () => drawPerson(p) });
    }
    ents.push({ y: ai.y, draw: drawAI });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) e.draw(time);

    for (const p of particles) {
      const k = 1 - p.age / p.life;
      ctx.fillStyle = k > 0.5 ? '#fff3c4' : '#ffd36b';
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      ctx.fillRect(x, y, 1, 1);
      if (k > 0.6) {
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
      }
    }

    if (state === 'play') {
      for (const id of [...IDS, 'ai']) {
        if (id === playerId) continue;
        if (target && target.kind === 'npc' && target.id === id) continue;
        const key = `${playerId}>${id}`;
        if ((talkCount[key] || 0) >= (TALKS[key] || []).length) continue;
        const [x, y] = headPos(id);
        drawBubble(x, y + Math.round(Math.sin(time * 2.5 + id.length) * 0.8), 'dots');
      }
      if (target) {
        const [x, y] = target.kind === 'npc' ? headPos(target.id) : target.it.mark;
        drawArrow(x, y - 1 - Math.round(Math.abs(Math.sin(time * 5)) * 2));
      }
    }
    if (state === 'dialogue' && emote) {
      const [x, y] = headPos(emote.who);
      if (emote.kind === 'sweat') drawSweat(x, y, emote.t);
      else drawBubble(x, y - Math.round(Math.min(1, emote.t * 8) * 2) + 2, emote.kind);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawVignette();
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

  Sound.init();
  setSoundUI();
  updateSwitcher();
  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  requestAnimationFrame(rafLoop);
  setTimeout(startTimerLoopIfNeeded, 400);
})();
