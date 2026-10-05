// The Water Cooler: office art, Game Boy Color style (Pokemon GSC / Oracle interiors).
// Everything is fillRect with solid colours from one small shared palette.
(function () {
  'use strict';

  const ROOM_W = 336;
  const ROOM_H = 192;

  // ---- Palette (all channels near multiples of 8, GBC friendly) ------------------------------
  const K = {
    O: '#181818', // outline
    wl: '#f8f0c8', wm: '#e8d898', wd: '#b89860', // cream wall
    tl: '#78d0b0', tm: '#48a888', td: '#207060', // teal wainscot / cabinets
    fl: '#f0d8a8', fm: '#d0a870', fd: '#a07840', // floor planks
    kl: '#e89848', km: '#b86828', kd: '#703010', // desk / shelf wood
    w: '#f8f8f8', g1: '#c8c8d8', g2: '#8088a0', g3: '#404860', // whites and greys
    r: '#e04030', b: '#3068d0', lb: '#88c8f8', g: '#48a840', dg: '#206830', lg: '#98e068',
    y: '#f8d838', p: '#f088a8', cy: '#58e0d0',
    rr: '#d04048', rd: '#882030', // rug + sofa reds
    s1: '#78c0f8', s2: '#a8e0f8', // sky
  };

  let c = null;
  const R = (x, y, w, h, col) => {
    if (w <= 0 || h <= 0) return;
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };
  const P = (x, y, col) => R(x, y, 1, 1, col);
  const box = (x, y, w, h, fill) => {
    R(x, y, w, h, K.O);
    R(x + 1, y + 1, w - 2, h - 2, fill);
  };
  // fillRect clipped to a rectangle [cx, cy, cw, ch]
  const clipR = (x, y, w, h, col, cl) => {
    const x0 = Math.max(x, cl[0]);
    const y0 = Math.max(y, cl[1]);
    const x1 = Math.min(x + w, cl[0] + cl[2]);
    const y1 = Math.min(y + h, cl[1] + cl[3]);
    if (x1 > x0 && y1 > y0) R(x0, y0, x1 - x0, y1 - y0, col);
  };
  const rnd = (n) => {
    const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  // String-encoded sprite blit. map: char -> colour, '.' is transparent.
  const spr = (x, y, rows, map) => {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch !== '.' && map[ch]) P(x + i, y + j, map[ch]);
      }
    }
  };

  // 3x5 signage font
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
  function text(str, x, y, col) {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const g = FONT[ch];
      if (g) for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r][q] === '1') P(cx + q, y + r, col);
      cx += 4;
    }
  }

  // ---- Static layer ----------------------------------------------------------------------------

  const WIN = [{ x: 18, y: 6, seed: 1 }, { x: 274, y: 6, seed: 2 }];
  const panesOf = (x, y) => [
    [x + 2, y + 2, 19, 8], [x + 23, y + 2, 19, 8], // top: sky + clouds
    [x + 2, y + 12, 19, 9], [x + 23, y + 12, 19, 9], // bottom: skyline
  ];

  function paintWindowFrame(w) {
    const { x, y, seed } = w;
    R(x, y, 44, 23, K.O);
    R(x + 1, y + 1, 42, 21, K.w);
    const panes = panesOf(x, y);
    panes.forEach((p, i) => {
      if (i < 2) {
        R(p[0], p[1], p[2], p[3], K.s1);
        // glint
        P(p[0] + 2, p[1] + 1, K.w);
        P(p[0] + 2, p[1] + 2, K.w);
        P(p[0] + 3, p[1] + 1, K.w);
      } else {
        R(p[0], p[1], p[2], p[3], K.s2);
        // skyline: dark blocks with a lit window or two
        let bx = p[0];
        let k = 0;
        while (bx < p[0] + p[2]) {
          const bw = 4 + Math.floor(rnd(seed * 10 + k + i * 3) * 4);
          const bh = 3 + Math.floor(rnd(seed * 20 + k + i * 5) * 4);
          const top = p[1] + p[3] - bh;
          clipR(bx, top, bw, bh, K.g2, p);
          for (let wy = top + 1; wy < p[1] + p[3] - 2; wy += 2) {
            for (let wx = bx + 1; wx < bx + bw - 1; wx += 2) {
              if (rnd(wx * 7 + wy * 13 + seed) > 0.55) clipR(wx, wy, 1, 1, K.y, p);
            }
          }
          bx += bw + 1;
          k++;
        }
        // hedge row
        for (let tx = p[0]; tx < p[0] + p[2]; tx += 4) {
          clipR(tx, p[1] + p[3] - 2, 4, 2, K.dg, p);
          clipR(tx + 1, p[1] + p[3] - 3, 2, 1, K.dg, p);
        }
      }
    });
    // mullions
    R(x + 21, y + 1, 1, 21, K.w);
    R(x + 22, y + 1, 1, 21, K.g1);
    R(x + 1, y + 10, 42, 1, K.w);
    R(x + 1, y + 11, 42, 1, K.g1);
    // sill
    R(x - 2, y + 23, 48, 1, K.O);
    R(x - 2, y + 24, 48, 1, K.w);
    R(x - 2, y + 25, 48, 1, K.g1);
    R(x - 2, y + 26, 48, 1, K.O);
    // soft shadow on wall (solid) under the sill
    R(x - 1, y + 27, 46, 1, K.td);
  }

  function paintStatic(ctx) {
    c = ctx;

    // --- wall ---
    R(0, 0, ROOM_W, 48, K.wl);
    R(0, 0, ROOM_W, 1, K.O);
    R(0, 1, ROOM_W, 1, K.wd);
    for (let tx = 0; tx < 21; tx++) {
      const cx = tx * 16 + 8;
      const cy = tx % 2 ? 20 : 12;
      P(cx, cy - 1, K.wm);
      R(cx - 1, cy, 3, 1, K.wm);
      P(cx, cy + 1, K.wm);
    }
    // wainscot (teal) with raised panels
    R(0, 30, ROOM_W, 1, K.O);
    R(0, 31, ROOM_W, 1, K.tl);
    R(0, 32, ROOM_W, 14, K.tm);
    for (let tx = 0; tx < 21; tx++) {
      const px = tx * 16;
      R(px + 2, 34, 12, 1, K.tl);
      R(px + 2, 35, 1, 8, K.tl);
      R(px + 2, 43, 12, 1, K.td);
      R(px + 13, 35, 1, 8, K.td);
    }
    R(0, 46, ROOM_W, 1, K.td);
    R(0, 47, ROOM_W, 1, K.O);

    // --- floor: staggered planks ---
    R(0, 48, ROOM_W, ROOM_H - 48, K.fl);
    for (let ty = 3; ty < 12; ty++) {
      for (let tx = 0; tx < 21; tx++) {
        const px = tx * 16;
        const py = ty * 16;
        for (let half = 0; half < 2; half++) {
          const y = py + half * 8;
          R(px, y + 7, 16, 1, K.fm);
          R(px + (half ? 8 : 0), y, 1, 7, K.fm);
          const gx = px + 2 + Math.floor(rnd(tx * 13 + ty * 5 + half) * 11);
          const gy = y + 2 + Math.floor(rnd(tx * 3 + ty * 17 + half) * 4);
          if (gx % 8 !== (half ? 0 : 0)) R(gx, gy, 2, 1, K.fm);
          if (rnd(tx * 29 + ty * 7 + half * 3) > 0.7) P(px + 5 + (half ? 8 : 0), y + 4, K.fd);
        }
      }
    }
    R(0, 48, ROOM_W, 2, K.fm); // wall shade on the floor
    R(0, 50, ROOM_W, 1, K.fd === K.fm ? K.fm : K.fm);

    // --- rug ---
    {
      const rx = 112;
      const ry = 80;
      const rw = 112;
      const rh = 64;
      R(rx, ry, rw, rh, K.O);
      R(rx + 1, ry + 1, rw - 2, rh - 2, K.rr);
      R(rx + 3, ry + 3, rw - 6, rh - 6, K.wl);
      R(rx + 4, ry + 4, rw - 8, rh - 8, K.rd);
      R(rx + 6, ry + 6, rw - 12, rh - 12, K.rr);
      R(rx + 7, ry + 7, rw - 14, rh - 14, K.rd);
      for (let ty = 0; ty < 3; ty++) {
        for (let tx = 0; tx < 6; tx++) {
          const cx = rx + 16 + tx * 16;
          const cy = ry + 16 + ty * 16;
          R(cx - 1, cy - 3, 2, 6, K.rr);
          R(cx - 3, cy - 1, 6, 2, K.rr);
          R(cx - 2, cy - 2, 4, 4, K.rr);
          R(cx - 1, cy - 1, 2, 2, K.wl);
        }
      }
      for (let y = ry + 4; y < ry + rh - 4; y += 4) {
        R(rx - 2, y, 2, 1, K.wl);
        R(rx + rw, y, 2, 1, K.wl);
      }
    }

    // --- wall decor ---
    // light switch + socket
    box(117, 17, 4, 6, K.w);
    P(118, 19, K.g2);
    P(119, 19, K.g2);
    box(262, 36, 5, 4, K.w);
    P(263, 38, K.O);
    P(265, 38, K.O);

    // whiteboard
    {
      const x = 132;
      const y = 6;
      R(x + 1, y + 26, 72, 1, K.wd); // wall shadow
      R(x + 72, y + 1, 1, 26, K.wd);
      box(x, y, 72, 26, K.g1);
      R(x + 2, y + 2, 68, 22, K.w);
      text('Q3 ROADMAP', 136, 10, K.r);
      text('1 AI', 136, 17, K.b);
      text('2 MORE AI', 156, 17, K.b);
      text('3 ???', 136, 24, K.b);
      text('USERS', 160, 24, K.g2);
      R(159, 26, 21, 1, K.r);
      // sad face
      P(185, 24, K.b);
      P(188, 24, K.b);
      R(185, 27, 4, 1, K.b);
      P(184, 28, K.b);
      P(189, 28, K.b);
      // chart
      R(184, 10, 1, 6, K.g);
      R(184, 15, 15, 1, K.g);
      R(186, 13, 2, 2, K.g);
      R(189, 11, 2, 4, K.g);
      R(192, 12, 2, 3, K.g);
      R(195, 9, 2, 6, K.g);
      // tray with markers
      R(x + 1, y + 26, 70, 2, K.g2);
      R(x, y + 26, 72, 1, K.O);
      R(148, 32, 5, 1, K.r);
      R(155, 32, 5, 1, K.b);
      R(162, 32, 5, 1, K.g);
    }

    // poster: TEAM WORK, with an AI sticker slapped over TEAM
    {
      const x = 224;
      R(x + 1, 31, 18, 1, K.wd);
      box(x, 8, 18, 23, K.b);
      P(x + 9, 10, K.y);
      R(x + 8, 11, 3, 1, K.y);
      P(x + 9, 12, K.y);
      text('TEAM', x + 1, 16, K.w);
      text('WORK', x + 1, 23, K.w);
      R(x + 2, 29, 14, 1, K.w);
      R(x + 3, 14, 14, 8, K.y);
      R(x + 3, 21, 14, 1, K.km);
      text('AI', x + 6, 15, K.O);
      P(x + 3, 14, K.O);
    }

    // Employee of the Month: the robot
    {
      const x = 244;
      R(x + 1, 28, 16, 1, K.wd);
      box(x, 9, 16, 19, K.y);
      R(x + 2, 11, 12, 11, K.wl);
      box(x + 4, 13, 8, 6, K.g1);
      R(x + 5, 15, 6, 2, K.O);
      P(x + 6, 15, K.cy);
      P(x + 9, 15, K.cy);
      P(x + 7, 12, K.O);
      R(x + 3, 20, 10, 2, K.g2);
      R(x + 3, 23, 10, 3, K.km);
      R(x + 4, 24, 8, 1, K.y);
      R(x + 1, 27, 14, 1, K.km);
    }

    // windows
    WIN.forEach(paintWindowFrame);

    // room edges
    R(0, 48, 2, ROOM_H - 48, K.O);
    R(ROOM_W - 2, 48, 2, ROOM_H - 48, K.O);
    R(2, 48, 1, ROOM_H - 48, K.fd);
    R(ROOM_W - 3, 48, 1, ROOM_H - 48, K.fd);
    R(0, 0, 1, 48, K.O);
    R(ROOM_W - 1, 0, 1, 48, K.O);
  }

  // ---- Animated wall things ----------------------------------------------------------------

  const CLOCK = [
    '...ooooo...',
    '..owwwwwo..',
    '.owwwgwwwo.',
    'owwwwwwwwwo',
    'owwwwwwwwwo',
    'owgwwwwwgwo',
    'owwwwwwwwwo',
    'owwwwwwwwwo',
    '.owwwgwwwo.',
    '..owwwwwo..',
    '...ooooo...',
  ];

  function paintCloud(x, y, cl) {
    clipR(x + 2, y - 1, 5, 1, K.w, cl);
    clipR(x, y, 10, 2, K.w, cl);
  }

  function paintWall(ctx, t) {
    c = ctx;
    // drifting clouds in the top panes
    WIN.forEach((w) => {
      const panes = panesOf(w.x, w.y).slice(0, 2);
      panes.forEach((p, pi) => {
        for (let i = 0; i < 2; i++) {
          const span = p[2] + 20;
          const sp = 1.2 + i * 0.7;
          const off = Math.floor(rnd(w.seed * 5 + i * 3) * span);
          const cx = p[0] - 10 + ((off + Math.floor(t * sp) + pi * 20) % span);
          paintCloud(cx, p[1] + 3 + i * 3, p);
        }
        // re-draw glint on top of clouds
        P(p[0] + 2, p[1] + 1, K.s2);
      });
    });

    // wall clock, real time
    const cx = 72;
    const cy = 13;
    R(cx - 4, 20, 9, 1, K.wd);
    spr(cx - 5, cy - 5, CLOCK, { o: K.O, w: K.w, g: K.g2 });
    const now = new Date();
    const m = now.getMinutes() + now.getSeconds() / 60;
    const hr = (now.getHours() % 12) + m / 60;
    const hand = (a, len, col) => {
      for (let r = 0; r <= len; r++) P(cx + Math.round(Math.sin(a) * r), cy - Math.round(Math.cos(a) * r), col);
    };
    hand((hr / 12) * Math.PI * 2, 2, K.r);
    hand((m / 60) * Math.PI * 2, 4, K.O);
    P(cx, cy, K.O);
  }

  // ---- Furniture -----------------------------------------------------------------------------

  function steam(x, y, t, n, rise) {
    for (let i = 0; i < n; i++) {
      const ph = (t * 0.7 + i / n) % 1;
      const sx = Math.round(x + Math.sin((t + i) * 3));
      const sy = Math.round(y - ph * rise);
      P(sx, sy, ph < 0.55 ? K.w : K.g1);
    }
  }

  function monitor(x, y, w, h, screen) {
    box(x, y, w, h, K.g1);
    R(x + 2, y + 2, w - 4, h - 5, K.g3);
    screen(x + 2, y + 2, w - 4, h - 5);
    R(x + 1, y + h - 2, w - 2, 1, K.g2);
    // stand
    R(x + Math.floor(w / 2) - 1, y + h, 3, 2, K.g2);
    R(x + Math.floor(w / 2) - 3, y + h + 2, 7, 1, K.O);
  }

  function codeScreen(x, y, w, h, t, seed) {
    const scroll = Math.floor(t * 1.4 + seed * 7);
    const cols = [K.lg, K.cy, K.p, K.y, K.g1];
    const rows = Math.floor(h / 2);
    for (let r = 0; r < rows; r++) {
      const n = r + scroll;
      const indent = Math.floor(rnd(n * 3 + seed) * 3) * 2;
      const len = 2 + Math.floor(rnd(n * 7 + seed) * (w - 4 - indent));
      R(x + 1 + indent, y + 1 + r * 2, len, 1, cols[Math.floor(rnd(n * 11 + seed) * cols.length)]);
    }
    if (Math.floor(t * 2) % 2) R(x + 1, y + (rows - 1) * 2 + 1, 2, 1, K.w);
  }

  // Desk: 48 wide, 26 tall. Top face, front with kneehole and a drawer stack on the right.
  function deskBase(x, y) {
    box(x, y, 48, 14, K.kl);
    R(x + 1, y + 11, 46, 2, K.km);
    R(x + 1, y + 13, 46, 13, K.O);
    R(x + 2, y + 13, 44, 12, K.km);
    R(x + 5, y + 13, 22, 12, K.kd); // kneehole
    R(x + 28, y + 13, 1, 12, K.O);
    box(x + 30, y + 14, 15, 5, K.km);
    box(x + 30, y + 19, 15, 6, K.km);
    R(x + 35, y + 16, 5, 1, K.kl);
    R(x + 35, y + 22, 5, 1, K.kl);
    R(x + 2, y + 13, 3, 12, K.km);
    R(x + 2, y + 14, 1, 10, K.kl);
  }

  function drawEngineerDesk(ctx, t) {
    c = ctx;
    const x = 16;
    const y = 70;
    deskBase(x, y);
    monitor(x + 4, y - 10, 18, 13, (sx, sy, sw, sh) => codeScreen(sx, sy, sw, sh, t, 1));
    monitor(x + 26, y - 10, 18, 13, (sx, sy, sw, sh) => codeScreen(sx, sy, sw, sh, t, 2));
    // keyboard
    box(x + 11, y + 6, 20, 5, K.g1);
    for (let i = 0; i < 8; i++) {
      P(x + 13 + i * 2, y + 7, K.g2);
      P(x + 14 + i * 2, y + 9, K.g2);
    }
    box(x + 34, y + 7, 3, 4, K.w);
    // coffee mug
    box(x + 2, y + 5, 5, 5, K.w);
    P(x + 3, y + 6, K.kd);
    P(x + 7, y + 6, K.w);
    // sticky notes
    R(x + 39, y + 7, 4, 4, K.y);
    R(x + 42, y + 5, 4, 4, K.p);
    P(x + 40, y + 8, K.km);
    // cactus
    R(x + 40, y + 1, 3, 4, K.g);
    P(x + 39, y + 2, K.g);
    R(x + 40, y + 5, 3, 2, K.km);
  }

  function drawDesignerDesk(ctx, t) {
    c = ctx;
    const x = 16;
    const y = 134;
    deskBase(x, y);
    monitor(x + 7, y - 12, 30, 15, (sx, sy, sw, sh) => {
      R(sx, sy, sw, sh, K.w);
      const boards = [
        [K.p, 1, 1], [K.lg, 10, 1], [K.lb, 19, 1],
        [K.y, 1, 6], [K.cy, 10, 6], [K.g1, 19, 6],
      ];
      boards.forEach(([col, bx, by]) => R(sx + bx, sy + by, 7, 4, col));
      const sel = boards[Math.floor(t / 1.8) % boards.length];
      const bx = sx + sel[1] - 1;
      const by = sy + sel[2] - 1;
      R(bx, by, 9, 1, K.b);
      R(bx, by + 5, 9, 1, K.b);
      R(bx, by, 1, 6, K.b);
      R(bx + 8, by, 1, 6, K.b);
      const cx = Math.round(sx + 2 + ((Math.sin(t * 0.9) + 1) / 2) * (sw - 5));
      const cy = Math.round(sy + 1 + ((Math.cos(t * 1.3) + 1) / 2) * (sh - 4));
      P(cx, cy, K.O);
      P(cx, cy + 1, K.O);
      P(cx + 1, cy + 1, K.O);
    });
    // drawing tablet + pen
    box(x + 12, y + 6, 16, 5, K.g3);
    R(x + 14, y + 7, 12, 3, K.g2);
    R(x + 30, y + 7, 1, 4, K.y);
    // plant pot
    box(x + 39, y + 6, 5, 5, K.km);
    R(x + 40, y + 3, 3, 3, K.g);
    P(x + 39, y + 4, K.lg);
    P(x + 43, y + 4, K.lg);
    // mug with steam
    box(x + 2, y + 5, 5, 5, K.w);
    P(x + 3, y + 6, K.kd);
    P(x + 7, y + 6, K.w);
    steam(x + 4, y + 3, t, 3, 7);
  }

  function drawPmDesk(ctx, t) {
    c = ctx;
    const x = 272;
    const y = 70;
    deskBase(x, y);
    // laptop, screen facing us
    box(x + 12, y - 8, 24, 14, K.g1);
    R(x + 14, y - 6, 20, 9, K.w);
    const bars = [[7, K.r], [10, K.g], [8, K.b], [9, K.y]];
    bars.forEach(([len, col], i) => {
      const l = i === 3 ? 2 + Math.floor((t * 0.5) % 1 * 8) : len;
      R(x + 15, y - 5 + i * 2, l, 1, col);
    });
    P(x + 31, y - 5, K.r);
    R(x + 10, y + 6, 28, 1, K.O);
    box(x + 10, y + 6, 28, 5, K.g2);
    R(x + 18, y + 8, 12, 2, K.g1);
    // mug + steam
    box(x + 40, y + 5, 5, 5, K.w);
    R(x + 41, y + 6, 3, 1, K.km);
    P(x + 45, y + 7, K.w);
    steam(x + 42, y + 3, t + 1, 3, 7);
    // phone
    box(x + 3, y + 5, 4, 6, K.g3);
    if (t % 4 < 0.5) P(x + 4, y + 6, K.cy);
    // sticky notes
    R(x + 2, y + 1, 3, 3, K.y);
    R(x + 6, y + 2, 3, 3, K.p);
    R(x + 40, y + 1, 3, 3, K.lb);
    // notes along the front lip
    R(x + 8, y + 11, 3, 2, K.y);
    R(x + 14, y + 11, 3, 2, K.p);
  }

  function drawChair(ctx, cx, y) {
    c = ctx;
    box(cx - 5, y, 10, 7, K.b);
    R(cx - 4, y + 1, 8, 1, K.lb);
    box(cx - 6, y + 6, 12, 4, K.b);
    R(cx - 5, y + 7, 10, 1, K.lb);
    R(cx - 1, y + 10, 2, 2, K.g3);
    R(cx - 5, y + 12, 10, 1, K.O);
    P(cx - 5, y + 13, K.O);
    P(cx + 4, y + 13, K.O);
    P(cx, y + 13, K.O);
  }

  function drawCounter(ctx, t, s) {
    c = ctx;
    const x = 272;
    const y = 134;
    const brewing = s && s.brew > 0;
    // cabinet front
    R(x, y + 14, 48, 12, K.O);
    R(x + 1, y + 14, 46, 11, K.tm);
    R(x + 1, y + 14, 46, 1, K.tl);
    R(x + 23, y + 15, 1, 10, K.O);
    R(x + 15, y + 15, 1, 10, K.td);
    R(x + 24, y + 15, 1, 10, K.td);
    R(x + 38, y + 15, 1, 10, K.td);
    [12, 18, 28, 34].forEach((hx) => R(x + hx, y + 18, 2, 3, K.w));
    R(x + 1, y + 24, 46, 1, K.td);
    // counter top
    box(x, y, 48, 15, K.w);
    R(x + 1, y + 11, 46, 3, K.g1);
    // machine
    const mx = x + 4;
    const my = y - 14;
    box(mx, my, 20, 24, K.g3);
    R(mx + 1, my + 1, 18, 3, K.g2);
    R(mx + 2, my + 5, 16, 5, K.O);
    R(mx + 3, my + 6, 3, 3, brewing || Math.floor(t) % 3 ? K.r : K.rd);
    R(mx + 8, my + 6, 3, 3, K.lg);
    R(mx + 13, my + 6, 4, 3, K.g1);
    // brew cavity
    R(mx + 3, my + 12, 14, 8, K.O);
    R(mx + 6, my + 10, 8, 2, K.g2);
    // jug
    box(mx + 6, my + 14, 8, 8, K.s2);
    R(mx + 7, my + 18, 6, 3, K.kd);
    if (brewing) {
      R(mx + 7, my + 17, 6, 1, K.km);
      if (Math.floor(t * 8) % 2) P(mx + 10, my + 13, K.kd);
      P(mx + 10, my + 12, K.kd);
      steam(mx + 10, my - 1, t * 2, 5, 11);
      R(mx + 14, my + 7, 3, 1, K.y);
    }
    R(mx + 1, my + 22, 18, 1, K.g2);
    // mugs
    box(x + 28, y + 6, 5, 5, K.w);
    P(x + 33, y + 7, K.w);
    box(x + 34, y + 6, 5, 5, K.r);
    P(x + 39, y + 7, K.r);
    // fruit bowl
    R(x + 40, y + 8, 7, 3, K.O);
    R(x + 41, y + 8, 5, 2, K.kl);
    R(x + 40, y + 5, 3, 3, K.r);
    R(x + 43, y + 4, 3, 3, K.y);
    P(x + 44, y + 3, K.g);
  }

  function drawCooler(ctx, t, s) {
    c = ctx;
    const cx = 168;
    const gurgle = s && s.gurgle > 0;
    // base shadow on the rug
    R(cx - 8, 111, 17, 1, K.rd);
    // body
    box(cx - 7, 93, 14, 18, K.w);
    R(cx + 3, 94, 3, 16, K.g1);
    R(cx - 6, 94, 1, 16, K.w);
    box(cx - 5, 96, 9, 8, K.g1);
    R(cx - 4, 97, 3, 3, K.b);
    R(cx + 0, 97, 3, 3, K.r);
    R(cx - 4, 101, 7, 1, K.g2);
    R(cx - 4, 102, 7, 1, K.O);
    R(cx - 5, 106, 9, 3, K.g1);
    R(cx - 3, 107, 5, 1, K.g2);
    R(cx - 7, 109, 14, 2, K.g2);
    R(cx - 7, 110, 14, 1, K.O);
    // collar
    box(cx - 6, 89, 12, 5, K.g1);
    // bottle: O outline, round top
    R(cx - 6, 77, 12, 13, K.O);
    R(cx - 3, 75, 6, 2, K.O);
    R(cx - 5, 78, 10, 11, K.lb);
    R(cx - 2, 76, 4, 2, K.lb);
    R(cx - 5, 83, 10, 6, K.s1);
    R(cx - 5, 83, 10, 1, K.s2);
    R(cx - 4, 79, 1, 5, K.w);
    R(cx - 4, 77, 2, 1, K.w);
    // bubbles (light pixels rising through the bottle)
    const n = gurgle ? 7 : 2;
    for (let i = 0; i < n; i++) {
      const sp = gurgle ? 1.7 : 0.45;
      const ph = (t * sp + i / n + rnd(i * 3.1) * 0.3) % 1;
      const by = 88 - Math.floor(ph * 11);
      const bx = cx - 4 + Math.floor(rnd(i * 7.7 + Math.floor(t * sp + i / n)) * 8);
      if (by < 78) continue;
      if (gurgle && i % 3 === 0) {
        R(bx, by, 2, 2, K.w);
        P(bx, by, K.s2);
      } else {
        P(bx, by, K.w);
      }
    }
    // paper cups
    R(cx + 8, 99, 2, 6, K.O);
    R(cx + 8, 100, 1, 4, K.w);
  }

  function drawBookshelf(ctx) {
    c = ctx;
    const x = 80;
    const y = 24;
    const w = 32;
    const h = 40;
    box(x, y, w, h, K.km);
    R(x + 1, y + 1, w - 2, 2, K.kl); // top face
    R(x + 2, y + 3, w - 4, h - 7, K.O);
    R(x + 3, y + 4, w - 6, h - 9, K.kd);
    const colors = [K.r, K.y, K.b, K.g, K.p, K.w, K.cy];
    [y + 4, y + 16, y + 28].forEach((sy, s) => {
      let bx = x + 3;
      let k = 0;
      while (bx < x + w - 5) {
        const bw = 2 + Math.floor(rnd(s * 17 + k) * 2);
        const bh = 8 + Math.floor(rnd(s * 29 + k) * 3);
        if (bx + bw > x + w - 3) break;
        const col = colors[(s * 3 + k * 2 + Math.floor(rnd(s * 5 + k * 3) * 3)) % colors.length];
        if (rnd(s * 41 + k) > 0.88) {
          R(bx, sy + 11 - bw - 1, bh - 2, bw, K.O);
          R(bx, sy + 11 - bw, bh - 2, bw - 1, col);
          bx += bh - 1;
        } else {
          R(bx, sy + 11 - bh, bw, bh, K.O);
          R(bx, sy + 11 - bh + 1, bw - 1, bh - 1, col);
          bx += bw + 1;
        }
        k++;
      }
      R(x + 2, sy + 11, w - 4, 1, K.O);
      R(x + 3, sy + 12, w - 6, 1, K.kl);
    });
    R(x + 2, y + h - 4, w - 4, 3, K.km);
    R(x + 3, y + h - 4, w - 6, 1, K.kl);
    // little plant on top
    box(x + 4, y - 4, 6, 5, K.km);
    R(x + 5, y - 7, 4, 3, K.g);
    P(x + 4, y - 6, K.lg);
    P(x + 9, y - 6, K.lg);
    P(x + 6, y - 8, K.lg);
    R(x + 1, y + h, w - 2, 1, K.fm);
  }

  function drawFern(ctx, cx, base, t) {
    c = ctx;
    const top = base - 9;
    const pts = [];
    for (let i = 0; i < 7; i++) {
      const a = -1.0 + (i / 6) * 2.0 + Math.sin(t * 1.2 + i) * 0.04;
      const len = 9 + (i % 2 ? 0 : 3) + (i === 3 ? 2 : 0);
      for (let s = 1; s <= len; s++) {
        pts.push([Math.round(cx - 1 + Math.sin(a) * s * 0.8), Math.round(top - Math.cos(a) * s * 1.0 + s * s * Math.abs(Math.sin(a)) * 0.05), s, len]);
      }
    }
    pts.forEach((p) => R(p[0] - 1, p[1] - 1, 4, 4, K.O));
    pts.forEach((p) => R(p[0], p[1], 2, 2, K.g));
    pts.forEach((p) => {
      if (p[2] % 2) P(p[0], p[1], K.lg);
      else P(p[0] + 1, p[1] + 1, K.dg);
    });
    // pot (Kevin has a face)
    box(cx - 6, base - 9, 12, 4, K.kl);
    R(cx - 5, base - 8, 10, 1, K.p === K.p ? K.kl : K.kl);
    box(cx - 5, base - 6, 10, 6, K.km);
    R(cx - 4, base - 5, 1, 4, K.kl);
    P(cx - 2, base - 4, K.O);
    P(cx + 1, base - 4, K.O);
    R(cx - 1, base - 2, 2, 1, K.O);
  }

  function drawBush(ctx, cx, base) {
    c = ctx;
    const widths = [6, 10, 12, 14, 14, 14, 14, 12, 10];
    const top = base - 8 - widths.length;
    widths.forEach((wd, r) => {
      const x = cx - wd / 2;
      const y = top + r;
      R(x, y, wd, 1, K.O);
      R(x + 1, y, wd - 2, 1, K.g);
      if (r === 0) R(x, y, wd, 1, K.O);
      if (r === widths.length - 1) R(x, y, wd, 1, K.O);
    });
    // shading
    for (let r = 2; r < widths.length - 1; r++) {
      const wd = widths[r];
      R(cx + wd / 2 - 3, top + r, 2, 1, K.dg);
    }
    R(cx - 4, top + 2, 2, 1, K.lg);
    R(cx - 5, top + 3, 3, 1, K.lg);
    P(cx + 1, top + 1, K.lg);
    P(cx - 1, top + 5, K.lg);
    P(cx + 2, top + 4, K.lg);
    P(cx - 3, top + 7, K.dg);
    // pot
    box(cx - 5, base - 8, 10, 8, K.km);
    R(cx - 5, base - 8, 10, 2, K.kl);
    R(cx - 5, base - 8, 10, 1, K.O);
    R(cx - 4, base - 5, 1, 4, K.kl);
  }

  function drawSofa(ctx) {
    c = ctx;
    const x = 128;
    const y = 168;
    // back
    box(x + 4, y, 72, 12, K.r);
    R(x + 5, y + 1, 70, 2, K.p);
    for (let i = 1; i < 4; i++) R(x + 4 + i * 18, y + 3, 1, 9, K.rd);
    // cushions on the back: a yellow and a green pillow
    box(x + 10, y - 2, 9, 8, K.y);
    R(x + 11, y - 1, 7, 1, K.w);
    box(x + 59, y - 2, 9, 8, K.g);
    R(x + 60, y - 1, 7, 1, K.lg);
    // arms
    box(x, y + 2, 9, 20, K.rr);
    R(x + 1, y + 3, 7, 2, K.p);
    R(x + 7, y + 6, 1, 15, K.rd);
    box(x + 71, y + 2, 9, 20, K.rr);
    R(x + 72, y + 3, 7, 2, K.p);
    R(x + 72, y + 6, 1, 15, K.rd);
    // seat cushions
    box(x + 9, y + 10, 62, 12, K.r);
    R(x + 10, y + 11, 60, 2, K.p);
    R(x + 40, y + 12, 1, 9, K.O);
    R(x + 10, y + 19, 60, 2, K.rd);
    // feet
    R(x + 2, y + 22, 4, 2, K.O);
    R(x + 74, y + 22, 4, 2, K.O);
  }

  function drawPrinter(ctx, t) {
    c = ctx;
    // cabinet
    box(84, 178, 24, 14, K.km);
    R(85, 179, 22, 1, K.kl);
    R(95, 180, 1, 11, K.O);
    R(90, 184, 3, 1, K.kl);
    R(98, 184, 3, 1, K.kl);
    // printer body
    box(85, 167, 22, 12, K.g1);
    R(86, 168, 20, 2, K.w);
    R(88, 172, 16, 2, K.O);
    R(86, 176, 20, 1, K.g2);
    // paper
    R(88, 162, 12, 5, K.O);
    R(89, 163, 10, 4, K.w);
    R(91, 164, 6, 1, K.g2);
    // LED
    P(103, 170, Math.floor(t * 1.5) % 2 ? K.y : K.kd);
    P(101, 170, K.g);
  }

  const objects = [
    { y: 64, draw: (ctx, t, s) => drawBookshelf(ctx, t, s) },
    { y: 64, draw: (ctx, t) => drawFern(ctx, 120, 62, t) },
    { y: 96, draw: drawEngineerDesk },
    { y: 112, draw: (ctx) => drawChair(ctx, 40, 98) },
    { y: 160, draw: drawDesignerDesk },
    { y: 176, draw: (ctx) => drawChair(ctx, 40, 162) },
    { y: 96, draw: drawPmDesk },
    { y: 112, draw: (ctx) => drawChair(ctx, 296, 98) },
    { y: 160, draw: drawCounter },
    { y: 112, draw: drawCooler },
    { y: 192, draw: drawSofa },
    { y: 192, draw: drawPrinter },
    { y: 192, draw: (ctx) => drawBush(ctx, 9, 190) },
    { y: 192, draw: (ctx) => drawBush(ctx, ROOM_W - 9, 190) },
  ];

  window.WC_OFFICE = {
    PALETTE: K,
    paintStatic,
    paintWall,
    objects,
  };
})();
