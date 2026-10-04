import { defineConfig } from 'vite';

// The game itself lives in public/game and is served as-is; only the 3D page is bundled.
export default defineConfig({
  // Relative URLs, so the build works from any folder, not just a domain root.
  base: './',
  build: {
    target: 'es2020',
    // three.js is one lazily loaded chunk (~165 kB gzipped), fetched after first paint.
    chunkSizeWarningLimit: 700,
  },
});
