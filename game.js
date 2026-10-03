(() => {
  'use strict';

  const { TALKS, IDLE, PROPS } = window.WC_SCRIPT;

  // The office is a grid of 16px tiles, like a GBA interior.
  const T = 16;
  const COLS = 21;
  const ROWS = 12;
  const WALL_ROWS = 3;
  const ROOM_W = COLS * T;
  const ROOM_H = ROWS * T;
  const OUT = '#2b2230';
  const SHADOW = 'rgba(58, 34, 32, 0.22)';
  // One tile per 16 frames at 60fps, the classic walking pace.
  const STEP_TIME = 16 / 60;
  const TURN_DELAY = 0.09;

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
    device: $('device'),
    lcd: $('lcd'),
    stage: $('stage'),
    canvas: $('game'),
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
    menu: $('menu'),
    menuList: $('menuList'),
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

  const rnd = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  let ctx = null;
  const mainCtx = el.canvas.getContext('2d', { willReadFrequently: true });

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
  function shifted(dx, dy, fn) {
    ctx.save();
    ctx.translate(dx, dy);
    fn();
    ctx.restore();
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
  // Character sprites (14x20 pixel maps, auto-outlined to 16x22)
  // ---------------------------------------------------------------------------

  const LEGS = {
    front: [
      ['...PPPPPPPP...', '...PP....PP...', '...FF....FF...'],
      ['...PPPPPPPP...', '...PP....FF...', '...FF.........'],
      ['...PPPPPPPP...', '...FF....PP...', '........FF....'],
    ],
    side: [
      ['....PPPPPP....', '.....PPPP.....', '.....FFFFF....'],
      ['....PPPPPP....', '....PP..PP....', '...FF....FF...'],
      ['....PPPPPP....', '.....PPPP.....', '....FFFF......'],
    ],
  };

  const CHARS = {
    designer: {
      pal: {
        O: '#16111c', H: '#2a2236', h: '#5a4a70', S: '#f3c9a8', s: '#dca382', E: '#2a2030',
        R: '#f0a08a', G: '#6a6480', T: '#3e3952', t: '#2c2839', P: '#2c2935', F: '#efe9e0',
      },
      rows: {
        down: [
          '....HHHHHH....',
          '..HHhhHHHHHH..',
          '.HHHHHHHHHHHH.',
          '.HHHHSSSSHHHH.',
          '.HHHSSSSSSHHH.',
          '.HHGGSSSSGGHH.',
          '.HHSGEGGEGSHH.',
          '.HHSSSSSSSSHH.',
          '.HHsSSSSSSsHH.',
          '..HHSSSSSSHH..',
          '...HssSSssH...',
          '....TTTTTT....',
          '...TTTTTTTT...',
          '..TTTTTTTTTT..',
          '.TtTTTTTTTTTt.',
          '.STTTTTTTTTTS.',
          '..TTTTTTTTTT..',
        ],
        up: [
          '....HHHHHH....',
          '..HHhhHHHHHH..',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHhhhhHHHH.',
          '..HHHHHHHHHH..',
          '...HHHHHHHH...',
          '....TTTTTT....',
          '...TTTTTTTT...',
          '..TTTTTTTTTT..',
          '.TTTTTTTTTTTt.',
          '.STTTTTTTTTTS.',
          '..TTTTTTTTTT..',
        ],
        side: [
          '....HHHHHH....',
          '..HHhhHHHHH...',
          '.HHHHHHHHHHH..',
          '.HHHHHHSSHHH..',
          '.HHHHHSSSSHH..',
          '.HHHHGGSSSSH..',
          '.HHHHSSGESSH..',
          '.HHHHSSSSSSH..',
          '.HHHHSsSSSRs..',
          '..HHHssSSSs...',
          '...HHHssss....',
          '....TTTTTT....',
          '....TTTTTTT...',
          '....TTTTTTT...',
          '....TTtTTTt...',
          '....TTSTTTT...',
          '....TTTTTTT...',
        ],
      },
    },
    engineer: {
      pal: {
        O: '#2b1d14', H: '#6b4428', h: '#8f6339', S: '#c98f68', s: '#a87252', E: '#2a2030',
        R: '#d9806a', T: '#6e9a7c', t: '#56806a', W: '#f2efe8', K: '#34303c', P: '#465a85',
        F: '#7a5236',
      },
      rows: {
        down: [
          '....HHHHHH....',
          '..HHHhHHHHHH..',
          '.HHHHHHHHHHHH.',
          '.HHHHSSSSHHHH.',
          '.HHHSSSSSSHHH.',
          '.HHSS.SS.SSHH.',
          '.HHSSESSSESSH.',
          '.HHSSSSSSSSHH.',
          '.HHsRSSSSRsHH.',
          '..HHSSSSSSHH..',
          '...HssSSssH...',
          '....KKTTKK....',
          '...TKKTTKKT...',
          '..TTTTWTTTTT..',
          '.TTTTWTTWTTTt.',
          '.SsTtttttttsS.',
          '..TTTTTTTTTT..',
        ],
        up: [
          '....HHHHHH....',
          '..HHHhHHHHHH..',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '..HHHHHHHHHH..',
          '...sHHHHHHs...',
          '....KKTTKK....',
          '...TKKTTKKT...',
          '..TTTTTTTTTT..',
          '.TTTTTTTTTTTt.',
          '.STTTTTTTTTTS.',
          '..TTTTTTTTTT..',
        ],
        side: [
          '....HHHHHH....',
          '..HHHhHHHHH...',
          '.HHHHHHHHHHH..',
          '.HHHHHHHSHHH..',
          '.HHHHHSSSSHH..',
          '.HHHHSSSSSSH..',
          '.HHHHsSSSESH..',
          '.HHHHsSSSSSH..',
          '.HHHHsSSSSRs..',
          '..HHHssSSSs...',
          '...HHHssss....',
          '....KKKTTT....',
          '....TKKTTTT...',
          '....TTTTTTT...',
          '....TTTTTTt...',
          '....TTSTTTt...',
          '....TtTTTTt...',
        ],
      },
    },
    pm: {
      pal: {
        O: '#2a2238', H: '#e0b050', h: '#f4d68a', S: '#f2c4a0', s: '#d9a07e', E: '#2a2030',
        R: '#ef9e86', T: '#34426e', t: '#262f52', U: '#bcd8f0', L: '#e05a4f', Y: '#f7f3ea',
        P: '#c9b089', F: '#6b4429',
      },
      rows: {
        down: [
          '....HHHHHH....',
          '..HHHHHHhhHH..',
          '.HHHHHHHHHHHH.',
          '.HHHHHSSSHHHH.',
          '.HHHSSSSSSHHH.',
          '.HHSS.SS.SSHH.',
          '.HHSSESSSESSH.',
          '.HHSSSSSSSSHH.',
          '.HHsRSSSSRsHH.',
          '..HHSSSSSSHH..',
          '...HssSSssH...',
          '....TTUUTT....',
          '...TTLULTLT...',
          '..TTTTULLTTT..',
          '.TTTTUYYUTTTt.',
          '.SsTTUYYUTTsS.',
          '..TTTTTTTTTT..',
        ],
        up: [
          '....HHHHHH....',
          '..HHHHHHhhHH..',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '.HHHHHHHHHHHH.',
          '..HHHHHHHHHH..',
          '...sHHHHHHs...',
          '....TTLLTT....',
          '...TTTTTTTT...',
          '..TTTTTTTTTT..',
          '.TTTTTTTTTTTt.',
          '.STTTTTTTTTTS.',
          '..TTTTTTTTTT..',
        ],
        side: [
          '....HHHHHH....',
          '..HHHHHHhhH...',
          '.HHHHHHHHHHH..',
          '.HHHHHHHSSHH..',
          '.HHHHHSSSSSH..',
          '.HHHHSSSSSSH..',
          '.HHHHsSSSESH..',
          '.HHHHsSSSSSH..',
          '.HHHHsSSSSRs..',
          '..HHHssSSSs...',
          '...HHHssss....',
          '....TTUUTT....',
          '....TTLUTTT...',
          '....TTTLTTT...',
          '....TTSTYTt...',
          '....TTSTTTt...',
          '....TtTTTTt...',
        ],
      },
    },
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

  // Closing the top row of each eye leaves the bottom row as a shut-eye line.
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

  // ---------------------------------------------------------------------------
  // Screen modes
  // ---------------------------------------------------------------------------

  // Four shades of pea soup, picked by brightness like the original LCD.
  const GREENS = [
    [15, 56, 15],
    [48, 98, 48],
    [139, 172, 15],
    [155, 188, 15],
  ];
  const GREEN_LUT = new Uint8Array(256);
  for (let l = 0; l < 256; l++) GREEN_LUT[l] = l < 72 ? 0 : l < 138 ? 1 : l < 196 ? 2 : 3;

  let screenMode = 'colour';
  let shellTheme = 'grey';

  function quantize(c, w, h) {
    const img = c.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const g = GREENS[GREEN_LUT[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]];
      d[i] = g[0];
      d[i + 1] = g[1];
      d[i + 2] = g[2];
    }
    c.putImageData(img, 0, 0);
  }

  function finishSmallCanvas(canvas) {
    if (screenMode === 'green') quantize(canvas.getContext('2d'), canvas.width, canvas.height);
  }

  function paintPortrait(canvas, id, green = false) {
    const c = canvas.getContext('2d', { willReadFrequently: true });
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvas.width, canvas.height);
    if (id === 'ai') c.drawImage(aiSprite, 1, 1);
    else c.drawImage(sprites[id].down[0], 0, 0, 16, 14, 0, 0, 16, 14);
    if (green) finishSmallCanvas(canvas);
  }

  // ---------------------------------------------------------------------------
  // The office: floor, walls and everything fixed to them
  // ---------------------------------------------------------------------------

  const RUG = { x: 7, y: 5, w: 7, h: 4 };

  const bg = (() => {
    const [c, x] = makeCanvas(ROOM_W, ROOM_H);
    withCtx(x, () => {
      // Wallpaper, with a small motif centred on every tile.
      R(0, 0, ROOM_W, 32, '#f1e3c6');
      for (let i = 0; i < ROOM_W; i += 4) R(i, 2, 1, 28, i % 8 ? '#eee0c1' : '#e8d8b6');
      for (let tx = 0; tx < COLS; tx++) {
        const cx = tx * T + 8;
        P(cx, 9, '#dcc9a3');
        P(cx - 1, 10, '#dcc9a3');
        P(cx + 1, 10, '#dcc9a3');
        P(cx, 11, '#dcc9a3');
        P(cx, 23, '#e2d1ae');
      }
      R(0, 0, ROOM_W, 2, '#7a5238');
      R(0, 2, ROOM_W, 1, '#9a6c4a');

      // Wainscot panels, one per tile.
      R(0, 30, ROOM_W, 1, '#6f8a66');
      R(0, 31, ROOM_W, 1, '#d2dfc6');
      for (let tx = 0; tx < COLS; tx++) {
        const px = tx * T;
        R(px, 32, T, 12, '#a9c09d');
        R(px + 2, 34, T - 4, 1, '#c2d4b6');
        R(px + 2, 34, 1, 8, '#c2d4b6');
        R(px + 2, 42, T - 4, 1, '#8ba57f');
        R(px + T - 3, 34, 1, 9, '#8ba57f');
        R(px, 32, 1, 12, '#93ad87');
      }
      R(0, 44, ROOM_W, 3, '#6f5444');
      R(0, 44, ROOM_W, 1, '#8a6b57');
      R(0, 47, ROOM_W, 1, '#4f3a2f');

      // Floor: two staggered planks per tile.
      const tones = ['#cfa274', '#c99c6d', '#c4966a', '#d2a77a'];
      for (let ty = WALL_ROWS; ty < ROWS; ty++) {
        for (let tx = 0; tx < COLS; tx++) {
          const px = tx * T;
          const py = ty * T;
          for (let half = 0; half < 2; half++) {
            const y = py + half * 8;
            const seam = half ? 8 : 0;
            const toneL = tones[Math.floor(rnd(tx * 7 + ty * 31 + half * 3) * tones.length)];
            const toneR = tones[Math.floor(rnd(tx * 7 + ty * 31 + half * 3 + 1) * tones.length)];
            if (seam) {
              R(px, y, seam, 8, toneL);
              R(px + seam, y, T - seam, 8, toneR);
            } else {
              R(px, y, T, 8, toneL);
            }
            R(px, y, T, 1, 'rgba(255, 236, 200, 0.35)');
            R(px, y + 7, T, 1, '#a97d52');
            R(px + seam, y, 1, 7, '#b0845a');
            const gx = px + 2 + Math.floor(rnd(tx * 13 + ty * 5 + half) * 11);
            R(gx, y + 3 + Math.floor(rnd(tx * 3 + ty * 17 + half) * 3), 3, 1, 'rgba(120, 80, 45, 0.18)');
          }
        }
      }
      R(0, WALL_ROWS * T, ROOM_W, 3, 'rgba(70, 40, 30, 0.2)');
      R(0, WALL_ROWS * T + 3, ROOM_W, 1, 'rgba(70, 40, 30, 0.08)');

      // Rug under the cooler, laid on the grid.
      const rx = RUG.x * T;
      const ry = RUG.y * T;
      const rw = RUG.w * T;
      const rh = RUG.h * T;
      R(rx + 2, ry + 3, rw, rh, 'rgba(70, 40, 30, 0.18)');
      box(rx + 1, ry + 1, rw - 2, rh - 2, '#e2a86e');
      R(rx + 3, ry + 3, rw - 6, rh - 6, '#c8664e');
      R(rx + 5, ry + 5, rw - 10, rh - 10, '#e7b97f');
      R(rx + 6, ry + 6, rw - 12, rh - 12, '#c8664e');
      R(rx + 6, ry + 6, rw - 12, 1, '#d77a60');
      for (let tx = 0; tx < RUG.w; tx++) {
        for (let ty = 0; ty < RUG.h; ty++) {
          const cx = rx + tx * T + 8;
          const cy = ry + ty * T + 8;
          if (tx === 0 || ty === 0 || tx === RUG.w - 1 || ty === RUG.h - 1) continue;
          P(cx, cy - 2, '#f3cf98');
          R(cx - 1, cy - 1, 3, 1, '#f3cf98');
          R(cx - 2, cy, 5, 1, '#f3cf98');
          R(cx - 1, cy + 1, 3, 1, '#f3cf98');
          P(cx, cy + 2, '#f3cf98');
          P(cx, cy, '#b85a46');
        }
      }
      for (let i = 0; i < RUG.w * 2; i++) {
        const cx = rx + i * 8 + 4;
        R(cx - 1, ry + 9, 2, 2, '#f3cf98');
        R(cx - 1, ry + rh - 11, 2, 2, '#f3cf98');
      }
      for (let y = ry + 4; y < ry + rh - 4; y += 3) {
        R(rx - 2, y, 2, 1, '#efd6a8');
        R(rx + rw, y, 2, 1, '#efd6a8');
      }

      // Light switch and plug socket
      box(117, 17, 3, 4, '#f7f3ea');
      P(118, 18, '#c9c4b8');
      box(262, 36, 4, 3, '#f7f3ea');
      P(263, 37, OUT);
      P(264, 37, OUT);

      // Whiteboard
      shifted(8, 0, () => {
        R(126, 34, 70, 2, 'rgba(58, 34, 32, 0.18)');
        box(124, 6, 72, 26, '#c9ccd8');
        R(126, 8, 68, 22, '#fbfbf6');
        R(126, 8, 68, 1, '#ffffff');
        pixText('Q3 ROADMAP', 128, 10, '#d5534a');
        pixText('1 AI', 128, 17, '#3d6fb6');
        pixText('2 MORE AI', 148, 17, '#3d6fb6');
        pixText('3 ???', 128, 24, '#3d6fb6');
        pixText('USERS', 152, 24, '#a9a9b3');
        R(151, 26, 21, 1, '#d5534a');
        P(177, 24, '#3d6fb6');
        P(180, 24, '#3d6fb6');
        R(177, 27, 4, 1, '#3d6fb6');
        P(176, 28, '#3d6fb6');
        P(181, 28, '#3d6fb6');
        R(176, 10, 1, 6, '#4f9a63');
        R(176, 15, 14, 1, '#4f9a63');
        R(178, 13, 2, 2, '#4f9a63');
        R(181, 11, 2, 4, '#4f9a63');
        R(184, 12, 2, 3, '#4f9a63');
        R(187, 9, 2, 6, '#4f9a63');
        R(126, 32, 68, 2, '#9aa0b0');
        R(140, 31, 5, 1, '#d5534a');
        R(147, 31, 5, 1, '#3d6fb6');
        R(154, 31, 5, 1, '#4f9a63');
      });

      // Poster
      shifted(23, 0, () => {
        R(204, 31, 18, 1, 'rgba(58, 34, 32, 0.18)');
        box(204, 8, 18, 22, '#5f9aa0');
        P(212, 10, '#f6d36b');
        R(211, 11, 3, 1, '#f6d36b');
        P(212, 12, '#f6d36b');
        pixText('TEAM', 205, 16, '#fdf8ee');
        pixText('WORK', 205, 23, '#fdf8ee');
        R(207, 22, 10, 1, 'rgba(0, 0, 0, 0.18)');
        R(206, 14, 10, 8, '#ffe27a');
        pixText('AI', 208, 15, OUT);
      });

      // Employee of the month
      shifted(11, 0, () => {
        box(230, 9, 14, 17, '#d9a441');
        R(231, 10, 12, 15, '#efe7d6');
        box(233, 12, 8, 6, '#ece8f6');
        R(234, 13, 6, 4, '#2d2b4f');
        P(235, 14, '#7ef0dc');
        P(238, 14, '#7ef0dc');
        R(236, 16, 2, 1, '#7ef0dc');
        R(233, 20, 8, 3, '#d9a441');
        R(234, 21, 6, 1, '#b8862f');
      });

      // Room edges
      R(0, WALL_ROWS * T, 2, ROOM_H, '#3d3240');
      R(ROOM_W - 2, WALL_ROWS * T, 2, ROOM_H, '#3d3240');
      R(2, WALL_ROWS * T, 1, ROOM_H, 'rgba(0, 0, 0, 0.12)');
      R(ROOM_W - 3, WALL_ROWS * T, 1, ROOM_H, 'rgba(0, 0, 0, 0.12)');
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
    const cx = 72;
    const cy = 13;
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
    R(x + 1, y + 24, 44, 2, SHADOW);
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
    const x = 18;
    const y = 70;
    deskBase(x, y);
    monitor(x + 3, y - 9, 17, 12, (sx, sy, sw, sh) => codeScreen(sx, sy, sw, sh, t, 1));
    monitor(x + 22, y - 9, 17, 12, (sx, sy, sw, sh) => codeScreen(sx, sy, sw, sh, t, 2));
    box(x + 12, y + 8, 18, 3, '#d8d5e0');
    for (let i = 0; i < 8; i++) P(x + 13 + i * 2, y + 9, '#a9a5b8');
    box(x + 33, y + 8, 2, 3, '#d8d5e0');
    box(x + 40, y + 3, 3, 5, '#7bc96f');
    R(x + 40, y + 3, 3, 1, '#c8d0d8');
    R(x + 2, y + 7, 5, 3, '#f6d04d');
    R(x + 4, y + 5, 3, 3, '#f6d04d');
    P(x + 7, y + 6, '#ef8a3a');
    P(x + 5, y + 6, OUT);
  }

  function drawDesignerDesk(t) {
    const x = 18;
    const y = 134;
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
    const x = 274;
    const y = 70;
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
    const x = 274;
    const y = 134;
    R(x + 1, y + 24, 44, 2, SHADOW);
    box(x, y + 12, 44, 12, '#7f9db5');
    R(x + 14, y + 13, 1, 11, '#6a879e');
    R(x + 29, y + 13, 1, 11, '#6a879e');
    P(x + 12, y + 17, '#e8e2d0');
    P(x + 16, y + 17, '#e8e2d0');
    P(x + 31, y + 17, '#e8e2d0');
    box(x, y, 44, 12, '#e8e3d8');
    R(x, y, 44, 1, '#f7f3ea');
    R(x, y + 11, 44, 1, '#cfc8b8');
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

  const COOLER_TILE = [10, 6];
  const cooler = { bubbles: [], next: 3 };
  function drawCooler() {
    const cx = COOLER_TILE[0] * T + 8;
    const b = COOLER_TILE[1] * T + 14;
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
    const x = 82;
    const y = 24;
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
    const y = 170;
    const w = 76;
    const cx = x + w / 2;
    ellipse(cx, y + 21, w / 2 + 2, 2, SHADOW);
    box(x + 4, y, w - 8, 8, '#8fb0cf');
    for (let i = 1; i < 4; i++) R(x + 4 + Math.round(((w - 8) * i) / 4), y, 1, 8, '#7798ba');
    box(x + 9, y - 3, 8, 6, '#f2c46d');
    R(x + 10, y - 2, 6, 1, '#f7d891');
    box(x + w - 18, y - 3, 8, 6, '#e07a5f');
    R(x + w - 17, y - 2, 6, 1, '#ec9a83');
    box(x, y - 2, 6, 21, '#6d8fb5');
    box(x + w - 6, y - 2, 6, 21, '#6d8fb5');
    R(x, y - 2, 6, 1, '#8fb0cf');
    R(x + w - 6, y - 2, 6, 1, '#8fb0cf');
    box(x + 6, y + 7, w - 12, 12, '#5f80a8');
    R(x + 6, y + 7, w - 12, 2, '#7a9cc2');
    for (let i = x + 12; i < x + w - 8; i += 9) P(i, y + 13, '#4f6f96');
  }

  function drawPrinter(t) {
    shifted(7, 10, () => {
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
    });
  }

  // Draw order is by the bottom edge of each thing, so people can stand behind furniture.
  const decor = [
    { y: 64, draw: drawBookshelf },
    { y: 64, draw: (t) => drawFern(120, 62, t) },
    { y: 96, draw: drawEngineerDesk },
    { y: 112, draw: () => drawChair(40, 98) },
    { y: 160, draw: drawDesignerDesk },
    { y: 176, draw: () => drawChair(40, 162) },
    { y: 96, draw: drawPmDesk },
    { y: 112, draw: () => drawChair(296, 98) },
    { y: 160, draw: drawCounter },
    { y: 112, draw: drawCooler },
    { y: 192, draw: drawSofa },
    { y: 192, draw: drawPrinter },
    { y: 192, draw: () => drawBush(9, 190) },
    { y: 192, draw: () => drawBush(ROOM_W - 9, 190) },
  ];

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

  // Things you can face and press A on. Tiles are [col, row, width, height].
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
  const ownDesk = { engineerDesk: 'engineer', designerDesk: 'designer', pmDesk: 'pm' };

  // ---------------------------------------------------------------------------
  // People
  // ---------------------------------------------------------------------------

  const makePerson = (id, tx, ty, dir) => ({
    id, tx, ty, px: tx * T, py: ty * T, dir,
    moving: false, to: null, t: 0, parity: 0, frame: 0, turnT: 0, bumpT: 0,
    blink: 1 + Math.random() * 3, lookT: 1 + Math.random() * 3,
  });
  const people = {
    designer: makePerson('designer', 8, 7, 'right'),
    engineer: makePerson('engineer', 12, 7, 'left'),
    pm: makePerson('pm', 10, 8, 'up'),
  };
  const ai = {
    tx: 14, ty: 5, px: 14 * T, py: 5 * T, moving: false, to: null, from: null, t: 0, wanderT: 4, blink: 2, bobT: 0,
  };
  const AI_AREA = { x0: 13, y0: 4, x1: 15, y1: 6 };

  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const aiBob = () => Math.round(Math.sin(ai.bobT * 2.6) * 1.5);

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

  const RING = { designer: '#f08a6e', engineer: '#7fc79a', pm: '#8ea3e8' };

  function drawPerson(p) {
    const x = Math.round(p.px);
    const y = Math.round(p.py);
    const fx = x + 8;
    const fy = y + 14;
    if (p.id === playerId && state !== 'title') {
      ellipse(fx, fy, 7, 3, RING[p.id]);
      ellipse(fx, fy, 6, 2, 'rgba(255, 255, 255, 0.35)');
    }
    ellipse(fx, fy, 5, 2, SHADOW);
    const view = p.dir === 'up' ? 'up' : p.dir === 'down' ? 'down' : 'side';
    const blink = p.blink < 0 && view !== 'up';
    const spr = sprites[p.id][blink ? view + 'Blink' : view][p.frame];
    const bounce = p.frame !== 0 ? -1 : 0;
    const top = y + 16 - spr.height + bounce;
    if (p.dir === 'left') {
      ctx.save();
      ctx.translate(x + 16, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(spr, 0, top);
      ctx.restore();
    } else {
      ctx.drawImage(spr, x, top);
    }
  }

  function drawAI() {
    const x = Math.round(ai.px) + 8;
    const y = Math.round(ai.py) + 14;
    const bob = aiBob();
    ellipse(x, y, 4 - (bob > 0 ? 1 : 0), 1, 'rgba(58, 34, 32, 0.16)');
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
    const dx = x + 7;
    const dy = y + 5 + Math.floor((t * 5) % 3);
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
    if (id === 'ai') return [Math.round(ai.px) + 8, Math.round(ai.py) + 14 - 28 + aiBob()];
    const p = people[id];
    return [Math.round(p.px) + 8, Math.round(p.py) - 7];
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
      store('watercooler:sound', on ? 'on' : 'off');
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
    bump() {
      this.tone(120, 0.08, { type: 'square', vol: 0.05, to: 70 });
      this.noise(0.05, { vol: 0.04, freq: 400 });
    },
    cursor() {
      this.tone(1320, 0.035, { type: 'square', vol: 0.025 });
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

  function placeStep(p) {
    const k = Math.floor(p.t * T);
    p.px = p.tx * T + (p.to[0] - p.tx) * k;
    p.py = p.ty * T + (p.to[1] - p.ty) * k;
    const beat = Math.floor(p.t * 4);
    p.frame = beat === 0 ? (p.parity ? 1 : 2) : beat === 2 ? (p.parity ? 2 : 1) : 0;
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
    const before = Math.floor(p.bumpT / 0.22);
    p.bumpT += dt;
    const phase = Math.floor(p.bumpT / 0.22);
    p.frame = [1, 0, 2, 0][phase % 4];
    if (phase !== before && phase % 2 === 0) Sound.bump();
    if (p.bumpT === dt) Sound.bump();
  }

  function updateAI(dt) {
    if (state === 'dialogue' && dlg.partner === 'ai') return;
    ai.bobT += dt;
    if (ai.moving) {
      ai.t += dt / 0.7;
      const e = ai.t < 1 ? 0.5 - Math.cos(ai.t * Math.PI) / 2 : 1;
      ai.px = (ai.from[0] + (ai.to[0] - ai.from[0]) * e) * T;
      ai.py = (ai.from[1] + (ai.to[1] - ai.from[1]) * e) * T;
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

  // The untyped remainder stays in the layout (invisibly), so lines wrap in
  // their final place and words never jump to the next line mid-word.
  const typedText = document.createTextNode('');
  const restText = document.createElement('span');
  restText.className = 'dialogue__rest';
  el.dlgText.append(typedText, restText);
  function setTyped(n) {
    typedText.data = dlg.full.slice(0, n);
    restText.textContent = dlg.full.slice(n);
  }

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
    setTyped(0);
    el.dlgLive.textContent = id === 'narrator' ? text : `${NAMES[id]}: ${text}`;
    el.dialogue.classList.add('is-typing');
    if (id !== 'narrator') paintPortrait(el.portrait, id, true);
    emote = kind && id !== 'narrator' ? { who: id, kind, t: 0 } : null;
  }

  function advanceDialogue() {
    if (dlg.shown < dlg.full.length) {
      dlg.shown = dlg.full.length;
      dlg.lastChar = dlg.full.length;
      setTyped(dlg.full.length);
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
    setTyped(dlg.lastChar);
    if (dlg.lastChar >= dlg.full.length) {
      dlg.shown = dlg.full.length;
      el.dialogue.classList.remove('is-typing');
    }
  }

  // ---------------------------------------------------------------------------
  // Start menu
  // ---------------------------------------------------------------------------

  const MENU = [
    { id: 'swap', label: () => 'Swap' },
    { id: 'screen', label: () => `Screen: ${screenMode === 'green' ? 'Green' : 'Colour'}` },
    { id: 'shell', label: () => `Shell: ${shellTheme === 'purple' ? 'Purple' : 'Grey'}` },
    { id: 'sound', label: () => `Sound: ${Sound.on ? 'On' : 'Off'}` },
    { id: 'exit', label: () => 'Exit' },
  ];
  const menu = { i: 0 };

  function renderMenu() {
    el.menuList.replaceChildren(
      ...MENU.map((m, i) => {
        const li = document.createElement('li');
        li.textContent = m.label();
        li.setAttribute('role', 'menuitem');
        if (i === menu.i) li.className = 'is-on';
        li.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          menu.i = i;
          activateMenu();
        });
        return li;
      }),
    );
  }

  function openMenu() {
    if (state !== 'play') return;
    state = 'menu';
    menu.i = 0;
    el.menu.hidden = false;
    renderMenu();
    Sound.open();
    updateSwitcher();
  }

  function closeMenu() {
    if (state !== 'menu') return;
    state = 'play';
    el.menu.hidden = true;
    Sound.close();
    updateSwitcher();
  }

  function moveMenu(dir) {
    if (dir !== 'up' && dir !== 'down') return;
    menu.i = (menu.i + (dir === 'down' ? 1 : -1) + MENU.length) % MENU.length;
    Sound.cursor();
    renderMenu();
  }

  function activateMenu() {
    const id = MENU[menu.i].id;
    if (id === 'swap') {
      closeMenu();
      cycleSwitch(1);
      return;
    }
    if (id === 'exit') return closeMenu();
    if (id === 'screen') setScreen(screenMode === 'green' ? 'colour' : 'green');
    if (id === 'shell') setShell(shellTheme === 'purple' ? 'grey' : 'purple');
    if (id === 'sound') toggleSound();
    Sound.cursor();
    renderMenu();
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
    c.width = 16;
    c.height = 14;
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

  const castCanvases = IDS.map((id) => {
    const fig = document.createElement('figure');
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 22;
    const cap = document.createElement('figcaption');
    cap.textContent = SHORT[id];
    fig.append(c, cap);
    el.cast.append(fig);
    return [c, id];
  });
  function paintCast() {
    for (const [c, id] of castCanvases) {
      const x = c.getContext('2d', { willReadFrequently: true });
      x.clearRect(0, 0, c.width, c.height);
      x.drawImage(sprites[id].down[0], 0, 0);
      finishSmallCanvas(c);
    }
  }

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
    const menuKey = touchUI ? 'Start' : 'Esc';
    let html = '';
    if (state === 'dialogue') html = `<kbd>${key}</kbd> Continue`;
    else if (state === 'menu') html = `<kbd>${key}</kbd> Choose <kbd>${touchUI ? 'B' : 'Esc'}</kbd> Back`;
    else if (state === 'play' && target) html = `<kbd>${key}</kbd> ${targetLabel(target)}`;
    else if (state === 'play') html = `Walk over to someone and say hi <kbd>${menuKey}</kbd> Menu`;
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
    burst(p.px + 8, p.py + 4);
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
          ? "You're The Designer. Walk with the pad, press A to talk, and press B (or tap a face below) to become someone else."
          : "You're The Designer. Walk with the arrow keys, press Space to talk, and press Tab to become someone else.",
      ],
    ];
  }

  function start() {
    if (state !== 'title') return;
    el.title.classList.add('is-hidden');
    el.title.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-title');
    el.switcher.removeAttribute('aria-hidden');
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
    if (state === 'menu') renderMenu();
  }

  function setScreen(mode) {
    screenMode = mode;
    el.lcd.dataset.screen = mode;
    el.screenBtn.setAttribute('aria-pressed', String(mode === 'green'));
    el.screenLabel.textContent = mode === 'green' ? 'Green' : 'Colour';
    store('watercooler:screen', mode);
    paintCast();
    if (state === 'dialogue' && dlg.who && dlg.who !== 'narrator') paintPortrait(el.portrait, dlg.who, true);
    if (state === 'menu') renderMenu();
  }

  function setShell(theme) {
    shellTheme = theme;
    el.device.dataset.shell = theme;
    el.shellBtn.setAttribute('aria-pressed', String(theme === 'purple'));
    el.shellLabel.textContent = theme === 'purple' ? 'Purple' : 'Grey';
    store('watercooler:shell', theme);
    if (state === 'menu') renderMenu();
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
    else if (state === 'menu') activateMenu();
    else if (state === 'play' && target) interact(target);
  }

  function back(step = 1) {
    if (state === 'title') start();
    else if (state === 'menu') closeMenu();
    else if (state === 'dialogue') advanceDialogue();
    else cycleSwitch(step);
  }

  function startButton() {
    if (state === 'title') start();
    else if (state === 'menu') closeMenu();
    else openMenu();
  }

  function pressDir(dir) {
    if (state === 'menu') moveMenu(dir);
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
      pressDir(dir);
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
      e.preventDefault();
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
    if (dir !== touchDir) {
      touchDir = dir;
      if (dir) pressDir(dir);
    }
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

  // The screen's size comes from CSS. Match the canvas to its aspect ratio at
  // 192 game pixels tall; anything narrower than the room makes the camera follow.
  function resize() {
    document.body.classList.toggle('is-touch', touchUI);
    const sw = el.stage.clientWidth;
    const sh = el.stage.clientHeight;
    if (!sw || !sh) return;
    const w = clamp(Math.round((ROOM_H * sw) / sh), 1, ROOM_W);
    if (w !== el.canvas.width || el.canvas.height !== ROOM_H) {
      el.canvas.width = w;
      el.canvas.height = ROOM_H;
      mainCtx.imageSmoothingEnabled = false;
    }
    viewW = w;
    el.stage.style.setProperty('--cols', String(w));
    camX = cameraGoal();
  }
  window.addEventListener('resize', resize);
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(el.stage);

  // The camera is locked to the player, so the world scrolls under them.
  const cameraGoal = () => clamp(Math.round(player().px + 8 - viewW / 2), 0, ROOM_W - viewW);

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  function update(dt) {
    time += dt;
    const me = player();

    for (const id of IDS) {
      const p = people[id];
      updateWalker(p, id === playerId && state === 'play' ? heldDir() : null, dt);
      p.blink -= dt;
      if (p.blink < -0.13) p.blink = 2 + Math.random() * 3.5;
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

    camX = cameraGoal();
    updateHint();
  }

  function render() {
    ctx = mainCtx;
    ctx.setTransform(1, 0, 0, 1, -camX, 0);
    ctx.drawImage(bg, 0, 0);
    drawWindow(18, 6, 44, 23, time, 1);
    drawWindow(274, 6, 44, 23, time, 2);
    drawClock();

    const ents = decor.slice();
    for (const id of IDS) {
      const p = people[id];
      ents.push({ y: p.py + 16, draw: () => drawPerson(p) });
    }
    ents.push({ y: ai.py + 16, draw: drawAI });
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
        drawArrow(x, y - 1 - (Math.floor(time * 3) % 2));
      }
    }
    if (state === 'dialogue' && emote) {
      const [x, y] = headPos(emote.who);
      if (emote.kind === 'sweat') drawSweat(x, y, emote.t);
      else drawBubble(x, y - Math.round(Math.min(1, emote.t * 8) * 2) + 2, emote.kind);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (screenMode === 'green') quantize(mainCtx, el.canvas.width, el.canvas.height);
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
  setShell(recall('watercooler:shell', 'grey') === 'purple' ? 'purple' : 'grey');
  setScreen(recall('watercooler:screen', 'colour') === 'green' ? 'green' : 'colour');
  updateSwitcher();
  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  requestAnimationFrame(rafLoop);
  setTimeout(startTimerLoopIfNeeded, 400);
})();
