// Jimtendo lettering, built the way the Nintendo wordmark is: heavy vertical
// stems, thinner horizontals, tall x-height. Units are pixels of a reference
// logo whose x-height is 91; baseline is y = 0, up is negative.
const M = { x: 91, cap: 135, asc: 132, stem: 41, hair: 20, bar: 14, gap: 22, over: 2 };

function glyphs(ctx) {
  const { x: X, cap: C, asc: A, stem: S, hair: Hh, bar: B, over: O } = M;
  const fill = (fn) => { ctx.globalCompositeOperation = 'source-over'; ctx.beginPath(); fn(); ctx.fill(); };
  const cut = (fn) => { ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); fn(); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; };
  const rect = (x, y, w, h) => () => ctx.rect(x, y, w, h);
  const ell = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2) => () => ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
  // A ring: thick sides, thin top and bottom.
  const ring = (x0, w, top, bot) => {
    const cx = x0 + w / 2, cy = (top + bot) / 2, rx = w / 2, ry = (bot - top) / 2;
    fill(ell(cx, cy, rx, ry));
    cut(ell(cx, cy, rx - S * 0.93, ry - Hh));
  };
  // An arch over two stems (n, and each half of m), opening downward.
  // Square on the stem side, a big rounded shoulder on the right, and a tall
  // round-topped counter, so the top thins to a hairline where it leaves the stem.
  const arch = (x0, w, inner) => {
    const top = -X - O;
    fill(() => ctx.roundRect(x0, top, w, -top, [0, w * 0.42, 0, 0]));
    const il = x0 + S;
    cut(() => ctx.roundRect(il, top + Hh * 0.8, inner, -top - Hh * 0.8 + 1, [inner / 2, inner / 2, 0, 0]));
  };
  return {
    J: { w: 92, draw(x) {
      fill(rect(x + 92 - S, -C, S, C - 44 + 2));  // overlaps the hook so no seam shows
      const cx = x + 46, cy = -44;
      fill(() => { ctx.ellipse(cx, cy, 46, 44 + O, 0, 0, Math.PI); ctx.closePath(); });
      // The counter runs from a thinner left terminal to the stem's inside edge.
      const il = x + 22, ir = x + 92 - S;
      cut(() => { ctx.ellipse((il + ir) / 2, cy, (ir - il) / 2, 44 + O - Hh, 0, 0, Math.PI); ctx.closePath(); });
    } },
    i: { w: 45, draw(x) { fill(rect(x, -X, 45, X)); fill(rect(x, -X - 44, 45, 29)); } },
    m: { w: 180, draw(x) { arch(x, 110, 29); arch(x + 70, 110, 29); } },
    n: { w: 122, draw(x) { arch(x, 122, 41); } },
    t: { w: 84, draw(x) {
      fill(rect(x + 20, -X - 22, 44, X + 22));
      fill(rect(x, -X, 84, B));
    } },
    e: { w: 112, draw(x) {
      ring(x, 112, -X - O, O);
      const barTop = -X / 2 - B / 2 - 4;
      fill(rect(x + 8, barTop, 98, B));
      // The aperture: open below the bar on the right, ending the lower
      // stroke in a flat, upright terminal.
      cut(rect(x + 80, barTop + B, 60, -barTop - B + O + 1));
    } },
    d: { w: 114, draw(x) { ring(x, 108, -X - O, O); fill(rect(x + 114 - S, -A, S, A)); } },
    o: { w: 109, draw(x) { ring(x, 109, -X - O, O); } },
  };
}

// Draws `word` with its baseline at y = 0, starting at x = 0. Returns the advance.
function setWord(ctx, word) {
  const G = glyphs(ctx);
  let x = 0;
  for (const ch of word) { G[ch].draw(x); x += G[ch].w + M.gap; }
  return x - M.gap;
}
