// Paints the game's live start screen into a canvas the 3D screen uses as its
// texture. The game draws its title screen on its own 160x144 canvas, so this
// copies that canvas at the rect it has in the frame, letterboxed the same way,
// so the texture lines up with the game when the real thing is swapped in.

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

    // The title screen is drawn on the game canvas itself, letterboxed like the real thing.
    const gr = game.getBoundingClientRect();
    const fit = Math.min(gr.width / game.width, gr.height / game.height);
    const dw = game.width * fit;
    const dh = game.height * fit;
    ctx.fillStyle = view.getComputedStyle(game.parentElement).backgroundColor;
    ctx.fillRect(gr.left, gr.top, gr.width, gr.height);
    ctx.drawImage(game, gr.left + (gr.width - dw) / 2, gr.top + (gr.height - dh) / 2, dw, dh);

    // Green screen mode tints and scanlines the LCD (the .lcd::before layer).
    if (lcd.dataset.screen === 'green') {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(155, 188, 15, 0.22)';
      ctx.fillRect(lr.left, lr.top, lr.width, lr.height);
      ctx.fillStyle = 'rgba(20, 48, 12, 0.14)';
      for (let y = 0; y < lr.height; y += 3) ctx.fillRect(lr.left, lr.top + y, lr.width, 1);
      ctx.globalCompositeOperation = 'source-over';
    }
    return resized ? 'resized' : true;
  }

  return { canvas, paint };
}
