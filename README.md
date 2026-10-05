# The Water Cooler

A tiny, cosy pixel art office RPG. Three colleagues (the Designer, the Engineer and the Product Manager) are each convinced their new AI tools mean they don't need the other two anymore. Their own stories suggest otherwise.

The game itself is plain HTML, CSS and JavaScript with no dependencies (aside from the Pixelify Sans web font for the page around it). It is drawn like a Game Boy Color game: a 160×144 screen on an 8px tile grid, 16×16 sprites with three-colour palettes, and Gold/Silver-style text boxes. Text is set in [pokemon-font](https://github.com/cooljeanius/pokemon-font), a Game Boy-style pixel font self-hosted in `public/game/fonts/` under the SIL Open Font License, snapped to its native 8×8 grid on the canvas. The landing page wraps it in a 3D Game Boy Color built with three.js and Vite: the idle device shows the game's live start screen, and pressing Space zooms in and hands over to the real game, framed exactly over the model's screen.

## Files

- `index.html`, `src/` – the 3D page
  - `src/main.js` – page states (idle → zoom → play → back), input, touch pad, sound toggle, fallback
  - `src/scene.js` – three.js scene: model, screen plane, glow, tilt, camera framing
  - `src/screen-painter.js` – paints the game's start screen into the screen texture
  - `src/page.css` – page layout and touch pad
- `public/game/` – **the game, unchanged**. It runs in an iframe; `?embed` (see `embed.css`) shows just the LCD.
  - `game.js` – the engine: movement, camera, text boxes, title screen
  - `art-sprites.js` – the characters, emotes and marker as 16×16 pixel maps
  - `art-office.js` – the office, its furniture and their little animations
  - `sound.js` – a small Game Boy-style sound chip (pulse, wave and noise channels), effects and music
  - `dialogue.js` – **all of the writing**. Edit this to change or add conversations. Lines wrap and page themselves, 18 characters a line.
  - `style.css` – the original 2D handheld, still used as the no-WebGL fallback
- `public/models/gameboy.glb` – the model the page loads, built by `npm run build-model` from the original `game_boy_color.glb`
  - `model-src/patches/` – texture patches it pastes in: JIM BOY on the lens, and plain plastic over the shell's original badge (colour and normal map)
  - `scripts/build-model.mjs` – applies the patches and optimises the model
- `public/models/jimtendo-badge.png` – the Jimtendo badge under the screen. The shell texture is too coarse for a sharp badge, so the patches blank its original one and `src/scene.js` lays this image over the same spot. It is drawn by `model-src/jimtendo-badge/`, lettered in the style of the Nintendo wordmark.

## Run locally

```bash
cd water-cooler
npm install
npm run dev
```

Then open http://localhost:5173. The game on its own is at http://localhost:5173/game/index.html.

## Controls

- Walk: arrow keys / WASD (touch: D-pad)
- Talk / continue: Space, Enter or E (touch: A)
- Switch character: Tab, Q or 1 / 2 / 3 (touch: B, or tap a face)
- Start: Space (touch: tap)
- Leave and return to the 3D view: Esc (touch: Exit)
- Green screen: G, or the toggle in the header
- Shell colour: in the header
- Sound: M, or the toggle in the top right (off by default)

## Deploy

`npm run build` writes a static site to `dist/`, so any static host works. On Vercel, create a new project from this repo, set **Root Directory** to `water-cooler`, choose the **Vite** framework preset (build command `npm run build`, output directory `dist`), and then add the subdomain `watercooler.jimmyleslie.design`.
