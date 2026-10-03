# The Water Cooler

A tiny, cosy pixel art office RPG. Three colleagues (the Designer, the Engineer and the Product Manager) are each convinced their new AI tools mean they don't need the other two anymore. Their own stories suggest otherwise.

Plain HTML, CSS and JavaScript. No build step, no dependencies (aside from the Pixelify Sans web font).

## Files

- `index.html` – page shell and UI
- `style.css` – layout, dialogue box, title screen, touch controls
- `game.js` – sprites, office, movement, dialogue engine, sound
- `dialogue.js` – **all of the writing**. Edit this to change or add conversations.

## Run locally

```bash
cd water-cooler
python3 -m http.server 4321
```

Then open http://localhost:4321.

## Controls

- Walk: arrow keys / WASD (touch: D-pad)
- Talk / continue: Space, Enter or E (touch: A)
- Switch character: Tab, Q or 1 / 2 / 3 (touch: B, or tap a face)
- Pause menu: Esc or P (touch: Start)
- Green screen: G, or the toggle in the header
- Shell colour: in the header, or Start → Shell
- Sound: M, or the toggle in the top right (off by default)

## Deploy

It's a static folder, so any static host works. On Vercel, create a new project from this repo, set **Root Directory** to `water-cooler`, choose the "Other" framework preset with no build command, and then add the subdomain `watercooler.jimmyleslie.design`.
