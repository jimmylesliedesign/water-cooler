// Rebrands the Game Boy model and writes the version the page loads.
//
// Takes the original Sketchfab model (game_boy_color.glb), pastes the patches in
// model-src/patches over its textures (GAME BOY → JIM BOY on the lens, Nintendo →
// Jimtendo on the shell's badge, in both its colour and its normal map), then
// optimises it into public/models/gameboy.glb.
//
//   npm run build-model

import { NodeIO } from '@gltf-transform/core';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

// Where each patch goes: material, texture slot, and its top-left pixel.
const PATCHES = [
  { file: 'glass-logo.png', material: 'Glass', slot: 'baseColor', left: 440, top: 140 },
  { file: 'case-badge-colour.png', material: 'Case', slot: 'baseColor', left: 70, top: 172 },
  { file: 'case-badge-normal.png', material: 'Case', slot: 'normal', left: 70, top: 172 },
];

const io = new NodeIO();
const doc = await io.read('game_boy_color.glb');
const materials = new Map(doc.getRoot().listMaterials().map((m) => [m.getName(), m]));

for (const p of PATCHES) {
  const material = materials.get(p.material);
  const texture = p.slot === 'normal' ? material.getNormalTexture() : material.getBaseColorTexture();
  // Lossless here; the optimise step compresses every texture once at the end.
  const image = await sharp(texture.getImage())
    .composite([{ input: join('model-src/patches', p.file), left: p.left, top: p.top }])
    .png()
    .toBuffer();
  texture.setImage(new Uint8Array(image)).setMimeType('image/png');
  console.log(`patched ${p.material} ${p.slot} with ${p.file}`);
}

const dir = mkdtempSync(join(tmpdir(), 'gameboy-'));
const edited = join(dir, 'gameboy-edited.glb');
await io.write(edited, doc);
execFileSync('npx', ['gltf-transform', 'optimize', edited, 'public/models/gameboy.glb', '--texture-compress', 'webp'], { stdio: 'inherit' });
rmSync(dir, { recursive: true, force: true });
