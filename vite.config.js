import { defineConfig } from 'vite';

// The game itself lives in public/game and is served as-is; only the 3D page is bundled.
export default defineConfig({
  build: { target: 'es2020' },
});
