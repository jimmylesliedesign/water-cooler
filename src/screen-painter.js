// Paints the game's live start screen into a canvas the 3D screen uses as its
// texture. The title is DOM over the game canvas, so this copies the canvas and
// then redraws the title card from the real layout: every word, box and sprite
// is drawn at the rect the browser gave it, so the texture lines up with the
// game when the real thing is swapped in over it.

const SPLIT_SHADOWS = /,(?![^(]*\))/;

function parseShadows(value) {
  if (!value || value === 'none') return [];
  return value.split(SPLIT_SHADOWS).map((part) => {
    const color = (part.match(/rgba?\([^)]*\)|#[0-9a-f]+/i) || ['transparent'])[0];
    const [x = 0, y = 0, blur = 0] = part
      .replace(color, '')
      .trim()
      .split(/\s+/)
      .map(parseFloat);
    return { color, x, y, blur };
  });
}

const isClear = (color) => !color || color === 'transparent' || /rgba\(.*,\s*0\)$/.test(color);

export function createScreenPainter(frame) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext('2d');

  function nodes() {
    let doc;
    try {
      doc = frame.contentDocument;
    } catch {
      return null;
    }
    if (!doc || doc.readyState === 'loading') return null;
    const lcd = doc.getElementById('lcd');
    const game = doc.getElementById('game');
    const title = doc.getElementById('title');
    if (!lcd || !game || !title || !game.width) return null;
    return { doc, lcd, game, title, view: doc.defaultView };
  }

  function paintBox(el, cs) {
    const r = el.getBoundingClientRect();
    const radius = parseFloat(cs.borderTopLeftRadius) || 0;
    const border = parseFloat(cs.borderTopWidth) || 0;
    const shadow = parseShadows(cs.boxShadow)[0];
    if (shadow && !isClear(shadow.color)) {
      ctx.fillStyle = shadow.color;
      ctx.beginPath();
      ctx.roundRect(r.left + shadow.x, r.top + shadow.y, r.width, r.height, radius);
      ctx.fill();
    }
    if (border && !isClear(cs.borderTopColor)) {
      ctx.fillStyle = cs.borderTopColor;
      ctx.beginPath();
      ctx.roundRect(r.left, r.top, r.width, r.height, radius);
      ctx.fill();
    }
    if (!isClear(cs.backgroundColor)) {
      ctx.fillStyle = cs.backgroundColor;
      ctx.beginPath();
      ctx.roundRect(r.left + border, r.top + border, r.width - border * 2, r.height - border * 2, Math.max(0, radius - border));
      ctx.fill();
    }
  }

  function paintText(node, cs, doc) {
    // Draw with whatever the game actually laid out with: if its web font
    // hasn't loaded there, the browser used the next family in the stack.
    let font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    if (doc.fonts && !doc.fonts.check(font)) {
      const rest = cs.fontFamily.split(',').slice(1).join(',') || 'monospace';
      font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${rest}`;
    }
    ctx.font = font;
    if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
    const ascent = ctx.measureText('Hg').fontBoundingBoxAscent;
    const shadows = parseShadows(cs.textShadow).reverse();
    const upper = cs.textTransform === 'uppercase';
    const range = doc.createRange();
    const text = node.data;
    for (const m of text.matchAll(/\S+/g)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const r = range.getClientRects()[0];
      if (!r || !r.width) continue;
      const word = upper ? m[0].toUpperCase() : m[0];
      const y = r.top + ascent;
      for (const s of shadows) {
        ctx.fillStyle = s.color;
        ctx.fillText(word, r.left + s.x, y + s.y);
      }
      ctx.fillStyle = cs.color;
      ctx.fillText(word, r.left, y);
    }
  }

  function paintTree(el, view, doc) {
    const cs = view.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (el.localName === 'canvas') {
      const r = el.getBoundingClientRect();
      if (r.width) ctx.drawImage(el, r.left, r.top, r.width, r.height);
      return;
    }
    paintBox(el, cs);
    for (const child of el.childNodes) {
      if (child.nodeType === 1) paintTree(child, view, doc);
      else if (child.nodeType === 3 && child.data.trim()) paintText(child, cs, doc);
    }
  }

  // Returns false if there was nothing to paint, 'resized' if the canvas
  // changed size (the texture must be reallocated), otherwise true.
  function paint(scale) {
    const n = nodes();
    if (!n) return false;
    const { doc, lcd, game, title, view } = n;
    const lr = lcd.getBoundingClientRect();
    if (!lr.width || !lr.height) return false;
    const titleCS = view.getComputedStyle(title);
    const titleAlpha = title.classList.contains('is-hidden') ? 0 : parseFloat(titleCS.opacity);
    // Only the start screen is mirrored; once the game is running the overlay is the real thing.
    if (titleAlpha < 1) return false;

    const w = Math.max(2, Math.round(lr.width * scale));
    const h = Math.max(2, Math.round(lr.height * scale));
    const resized = canvas.width !== w || canvas.height !== h;
    if (resized) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(w / lr.width, 0, 0, h / lr.height, -lr.left * (w / lr.width), -lr.top * (h / lr.height));
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = view.getComputedStyle(lcd).backgroundColor;
    ctx.fillRect(lr.left, lr.top, lr.width, lr.height);

    // The game canvas, behind the title's frosted backdrop.
    const gr = game.getBoundingClientRect();
    const blur = (titleCS.backdropFilter || titleCS.webkitBackdropFilter || '').match(/blur\(([^)]+)\)/);
    if (blur) ctx.filter = `blur(${blur[1]})`;
    ctx.drawImage(game, gr.left, gr.top, gr.width, gr.height);
    ctx.filter = 'none';

    // Green screen mode tints and scanlines the LCD (the .lcd::before layer).
    if (lcd.dataset.screen === 'green') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(155, 188, 15, 0.22)';
      ctx.fillRect(lr.left, lr.top, lr.width, lr.height);
      ctx.fillStyle = 'rgba(20, 48, 12, 0.14)';
      for (let y = 0; y < lr.height; y += 3) ctx.fillRect(lr.left, lr.top + y, lr.width, 1);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.fillStyle = titleCS.backgroundColor;
    ctx.fillRect(lr.left, lr.top, lr.width, lr.height);
    for (const child of title.children) paintTree(child, view, doc);
    return resized ? 'resized' : true;
  }

  return { canvas, paint };
}
