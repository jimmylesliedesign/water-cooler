import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const MODEL_URL = `${import.meta.env.BASE_URL}models/gameboy.glb`;
const FOV = 30;
const DEG = Math.PI / 180;
const ZOOM_MS = 900;

// Where the LCD and the lens window sit in the model's Glass texture (glTF UVs,
// top-left origin). Measured from game_boy_color.glb: the LCD is a flat quad
// of its own triangles, the lens is one texture with a half-transparent window.
const LCD_UV = { u0: 0.54, u1: 0.91, v0: 0.015, v1: 0.42 };
const LENS_WINDOW_UV = { u0: 0.06, u1: 0.42, v0: 0.09, v1: 0.49 };
// How much of the lens window's dark tint shows over the screen while idle. It
// fades to nothing as the camera arrives so the texture matches the live game.
const LENS_IDLE = 0.35;

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (from, to, rate, dt) => THREE.MathUtils.lerp(from, to, 1 - Math.exp(-rate * dt));

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Finds the LCD triangles inside the Glass mesh by their UVs and returns their
// corners in `space`'s local coordinates.
function findLcd(mesh, space) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (!pos || !uv) return null;
  const index = geo.index;
  const count = index ? index.count : pos.count;
  const vi = (i) => (index ? index.getX(i) : i);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  const toSpace = new THREE.Matrix4().copy(space.matrixWorld).invert().multiply(mesh.matrixWorld);
  let tris = 0;
  for (let i = 0; i < count; i += 3) {
    let cu = 0;
    let cv = 0;
    for (let k = 0; k < 3; k++) {
      cu += uv.getX(vi(i + k)) / 3;
      cv += uv.getY(vi(i + k)) / 3;
    }
    if (cu < LCD_UV.u0 || cu > LCD_UV.u1 || cv < LCD_UV.v0 || cv > LCD_UV.v1) continue;
    tris++;
    for (let k = 0; k < 3; k++) box.expandByPoint(v.fromBufferAttribute(pos, vi(i + k)).applyMatrix4(toSpace));
  }
  if (!tris) return null;
  // The front of the glass over the LCD: the highest point of any triangle
  // that overlaps it (the lens triangles are large, so test their extents).
  let front = box.max.z;
  const tri = new THREE.Box3();
  for (let i = 0; i < count; i += 3) {
    tri.makeEmpty();
    for (let k = 0; k < 3; k++) tri.expandByPoint(v.fromBufferAttribute(pos, vi(i + k)).applyMatrix4(toSpace));
    const overlaps = tri.max.x > box.min.x && tri.min.x < box.max.x && tri.max.y > box.min.y && tri.min.y < box.max.y;
    if (overlaps) front = Math.max(front, tri.max.z);
  }
  return { box, tris, front };
}

// Lets the lens window's alpha be faded by a uniform, leaving the rest of the lens alone.
function patchLens(material, uniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uLensAlpha = uniform;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uLensAlpha;\nvoid main() {')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          if (vMapUv.x > ${LENS_WINDOW_UV.u0} && vMapUv.x < ${LENS_WINDOW_UV.u1} &&
              vMapUv.y > ${LENS_WINDOW_UV.v0} && vMapUv.y < ${LENS_WINDOW_UV.v1} &&
              diffuseColor.a < 0.75) diffuseColor.a *= uLensAlpha;
        #endif`,
      );
  };
  material.customProgramCacheKey = () => 'lens-window';
  material.needsUpdate = true;
}

/**
 * Builds the 3D handheld. Resolves once the model is in and has rendered once.
 *
 * options.container    element to fill with the WebGL canvas
 * options.screen       canvas holding the game's start screen
 * options.beforeRender called every frame while the scene is looping
 * options.onLayout     called after any size change, once framing is recomputed
 * options.headerHeight () => px to keep clear at the top in play framing
 */
export async function createScene({ container, screen, beforeRender, onLayout, headerHeight }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.7;
  room.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });

  const key = new THREE.DirectionalLight(0xfff4e6, 1.4);
  key.position.set(2.5, 3.5, 5);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100);
  const tanHalf = Math.tan((FOV * DEG) / 2);

  // ---- Model ----------------------------------------------------------------

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(MODEL_URL);
  const model = gltf.scene;

  const names = [];
  let glass = null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    names.push({ mesh: o.name, parent: o.parent && o.parent.name, materials: mats.map((m) => m.name) });
    if (mats.some((m) => m.name === 'Glass')) glass = o;
  });
  console.info('[gameboy] meshes and materials', JSON.stringify(names));

  // The device turns about its own centre.
  const device = new THREE.Group();
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const bounds = new THREE.Box3().setFromObject(model);
  bounds.getSize(size);
  bounds.getCenter(centre);
  model.position.sub(centre);
  device.add(model);
  scene.add(device);
  scene.updateMatrixWorld(true);
  const local = new THREE.Box3().setFromObject(model);

  const lcd = glass && findLcd(glass, device);
  if (!lcd) throw new Error('Could not find the screen on the Game Boy model');
  console.info('[gameboy] screen: LCD quad in', glass.name || '(unnamed)', 'material Glass,', lcd.tris, 'triangles, z', lcd.box.max.z.toFixed(4), 'lens front', lcd.front.toFixed(4));

  const lensAlpha = { value: LENS_IDLE };
  patchLens(glass.material, lensAlpha);
  // The glossy lens mirrors the whole room at some angles and hides the screen; tone it down.
  glass.material.envMapIntensity = 0.12;
  // Its rough finish also spreads the key light into a milky haze; a smoother
  // lens keeps the highlight to a small glint.
  glass.material.roughness = 0.25;

  // ---- Screen ---------------------------------------------------------------

  // A plane flush on the LCD, showing the game's real start screen. It has its
  // own 0-1 UVs, so the canvas keeps the usual flipY (glTF's flipY=false only
  // applies to textures mapped through the model's own UVs).
  const screenTex = new THREE.CanvasTexture(screen);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.magFilter = THREE.NearestFilter;
  // Nearest when magnified keeps the pixel art crisp; linear when shrunk in
  // the idle view stops the title text shimmering as the device tilts.
  screenTex.minFilter = THREE.LinearFilter;
  screenTex.generateMipmaps = false;

  const screenSize = lcd.box.getSize(new THREE.Vector3());
  const screenCentre = lcd.box.getCenter(new THREE.Vector3());
  // Idle, the screen sits on the LCD, recessed under the lens. The lens's
  // opaque frame overlaps the LCD's edges by a few pixels through parallax,
  // so during the zoom the screen slides up to the front of the glass, where
  // nothing covers it and it can match the real game overlay exactly.
  const lift = size.z * 0.0015;
  const screenZ = lcd.box.max.z + lift;
  const screenFrontZ = lcd.front + lift;
  const screenMat = new THREE.MeshBasicMaterial({
    map: screenTex,
    // Unlit and untouched by tone mapping: the screen shows the game's own colours.
    toneMapped: false,
  });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(screenSize.x, screenSize.y), screenMat);
  screenMesh.name = 'GameScreen';
  screenMesh.position.set(screenCentre.x, screenCentre.y, screenZ);
  device.add(screenMesh);

  // Soft additive glow from the screen. It sits just behind the device so the
  // shell occludes it and only the halo around the silhouette shows; in front,
  // additive light over the glossy lens reads as a milky haze.
  const glowTex = radialTexture([
    [0, 'rgba(255,226,170,0.32)'],
    [0.4, 'rgba(255,214,150,0.14)'],
    [0.7, 'rgba(242,196,109,0.04)'],
    [1, 'rgba(242,196,109,0)'],
  ]);
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 1,
    toneMapped: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(screenSize.x * 3.2, screenSize.x * 3.2, 1);
  glow.position.set(screenCentre.x, screenCentre.y, local.min.z - size.z * 0.2);
  device.add(glow);

  // Soft contact shadow on the "floor" under the device.
  const shadowTex = radialTexture([
    [0, 'rgba(0,0,0,0.55)'],
    [0.5, 'rgba(0,0,0,0.25)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x * 1.5, size.z * 4),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = local.min.y - size.y * 0.06;
  scene.add(shadow);

  // ---- Framing --------------------------------------------------------------

  let width = 1;
  let height = 1;
  const idlePos = new THREE.Vector3();
  const playPos = new THREE.Vector3();

  // Idle: the whole device centred, a little high to leave room for the prompt.
  function computeIdle() {
    const aspect = width / height;
    const fitH = (size.y / 2) / (tanHalf * 0.6);
    const fitW = (size.x / 2) / (tanHalf * aspect * 0.72);
    const d = Math.max(fitH, fitW) + local.max.z;
    const lift = 0.07; // device centre sits this far above the middle, in NDC
    idlePos.set(0, -lift * d * tanHalf, d);
  }

  // Play: front-on, the screen large and centred horizontally with the body
  // running off the bottom edge. Everything is derived from the screen quad
  // and the viewport, so it holds at any size.
  function computePlay() {
    const aspect = width / height;
    const portrait = aspect < 1;
    const ratio = screenSize.y / screenSize.x;
    const top = Math.max(headerHeight() + 12, height * (portrait ? 0.1 : 0.08));
    let sw = width * (portrait ? 0.88 : 0.62);
    // Keep some of the body visible under the screen (and room for the touch pad on phones).
    const maxH = height - top - height * (portrait ? 0.34 : 0.14);
    if (sw * ratio > maxH) sw = maxH / ratio;
    const sh = sw * ratio;
    const d = (screenSize.x / 2) * height / (sw * tanHalf);
    const ndcY = 1 - (2 * (top + sh / 2)) / height;
    playPos.set(screenCentre.x, screenCentre.y - ndcY * d * tanHalf, screenFrontZ + d);
  }

  const corners = [
    new THREE.Vector3(-0.5, 0.5, 0),
    new THREE.Vector3(0.5, 0.5, 0),
    new THREE.Vector3(0.5, -0.5, 0),
    new THREE.Vector3(-0.5, -0.5, 0),
  ];
  const probe = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100);
  const tmp = new THREE.Vector3();

  // The screen's rectangle in CSS pixels once the zoom has landed, from its
  // projected corners (the device is level and front-on there).
  function playScreenRect() {
    probe.aspect = width / height;
    probe.position.copy(playPos);
    probe.updateProjectionMatrix();
    probe.updateMatrixWorld(true);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const c of corners) {
      // Corners in device space with the device at rest (no tilt or drift).
      tmp.set(c.x * screenSize.x + screenCentre.x, c.y * screenSize.y + screenCentre.y, screenFrontZ).project(probe);
      const x = (tmp.x * 0.5 + 0.5) * width;
      const y = (-tmp.y * 0.5 + 0.5) * height;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }

  // Bottom of the device in the idle view, in CSS pixels.
  function idleBottom() {
    probe.aspect = width / height;
    probe.position.copy(idlePos);
    probe.updateProjectionMatrix();
    probe.updateMatrixWorld(true);
    tmp.set(0, local.min.y, local.max.z).project(probe);
    return (-tmp.y * 0.5 + 0.5) * height;
  }

  // ---- State and motion -----------------------------------------------------

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let touch = false;
  let mode = 'idle'; // idle | in | out | play
  let zoom = 0; // 0 idle framing, 1 play framing
  let zoomFrom = 0;
  let zoomTo = 0;
  let zoomStart = 0;
  let zoomDone = null;
  const tilt = { x: 0, y: 0, px: 0, py: 0 };
  const tiltFrom = { x: 0, y: 0, px: 0, py: 0 };
  const pointer = { x: 0, y: 0 };
  let clock = performance.now();
  let time = 0;
  let raf = 0;

  function applyZoom(e) {
    camera.position.lerpVectors(idlePos, playPos, e);
    screenMesh.position.z = THREE.MathUtils.lerp(screenZ, screenFrontZ, e);
    lensAlpha.value = LENS_IDLE * (1 - e);
  }

  function update(now) {
    const dt = Math.min(0.05, (now - clock) / 1000);
    clock = now;
    time += dt;
    const still = reducedMotion.matches;

    if (mode === 'in' || mode === 'out') {
      const t = Math.min(1, (now - zoomStart) / (still ? 1 : ZOOM_MS));
      const e = easeInOutCubic(t);
      zoom = zoomFrom + (zoomTo - zoomFrom) * e;
      // Ease the tilt out with the camera so it arrives exactly level and front-on.
      const keep = mode === 'in' ? 1 - e : 0;
      tilt.x = tiltFrom.x * keep;
      tilt.y = tiltFrom.y * keep;
      tilt.px = tiltFrom.px * keep;
      tilt.py = tiltFrom.py * keep;
      if (t >= 1) {
        mode = zoomTo === 1 ? 'play' : 'idle';
        const done = zoomDone;
        zoomDone = null;
        if (done) done();
      }
    } else if (mode === 'idle') {
      let ty = 0;
      let tx = 0;
      let tpx = 0;
      let tpy = 0;
      if (still) {
        // Hold still.
      } else if (touch) {
        // A slow float in place of cursor tracking.
        ty = Math.sin(time * 0.45) * 5 * DEG;
        tx = Math.sin(time * 0.31 + 1) * 2.5 * DEG;
        tpy = Math.sin(time * 0.7) * size.y * 0.008;
      } else {
        ty = pointer.x * 12 * DEG;
        tx = -pointer.y * 8 * DEG;
        tpx = pointer.x * size.x * 0.03;
        tpy = pointer.y * size.y * 0.015;
      }
      tilt.y = damp(tilt.y, ty, 4, dt);
      tilt.x = damp(tilt.x, tx, 4, dt);
      tilt.px = damp(tilt.px, tpx, 4, dt);
      tilt.py = damp(tilt.py, tpy, 4, dt);
    }

    device.rotation.set(tilt.x, tilt.y, 0);
    device.position.set(tilt.px, tilt.py, 0);
    applyZoom(zoom);

    // Gentle glow pulse while idle; gone (and the screen exactly 1:1) in play.
    const pulse = still ? 0 : Math.sin(time * 1.6) * 0.5 + 0.5;
    const idleness = 1 - zoom;
    glowMat.opacity = (0.75 + pulse * 0.25) * idleness;
    glow.visible = glowMat.opacity > 0.001;
    screenMat.color.setScalar(1 + pulse * 0.05 * idleness);
  }

  function render() {
    renderer.render(scene, camera);
  }

  function frame(now) {
    raf = 0;
    if (beforeRender && mode !== 'play') beforeRender();
    update(now);
    render();
    if (mode !== 'play') loop();
  }

  function loop() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // ---- Size -----------------------------------------------------------------

  let dprQuery = null;
  function watchDpr() {
    if (dprQuery) dprQuery.removeEventListener('change', onDpr);
    dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    dprQuery.addEventListener('change', onDpr);
  }
  function onDpr() {
    watchDpr();
    resize();
  }

  function resize() {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    computeIdle();
    computePlay();
    applyZoom(zoom);
    if (onLayout) onLayout();
    // Play is static, so it only needs a fresh frame when the size changes.
    if (mode === 'play') {
      update(performance.now());
      render();
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  watchDpr();
  resize();

  // ---- API ------------------------------------------------------------------

  function zoomTowards(target) {
    return new Promise((resolve) => {
      if (zoomDone) zoomDone();
      tiltFrom.x = tilt.x;
      tiltFrom.y = tilt.y;
      tiltFrom.px = tilt.px;
      tiltFrom.py = tilt.py;
      zoomFrom = zoom;
      zoomTo = target;
      zoomStart = performance.now();
      mode = target === 1 ? 'in' : 'out';
      zoomDone = resolve;
      clock = performance.now();
      loop();
    });
  }

  update(performance.now());
  render();
  loop();

  return {
    renderer,
    zoomIn: () => zoomTowards(1),
    zoomOut: () => zoomTowards(0),
    setPointer(x, y) {
      pointer.x = THREE.MathUtils.clamp(x, -1, 1);
      pointer.y = THREE.MathUtils.clamp(y, -1, 1);
    },
    setTouch(on) {
      touch = on;
    },
    screenChanged(resized) {
      // A new size needs fresh GPU storage rather than an update in place.
      if (resized) screenTex.dispose();
      screenTex.needsUpdate = true;
    },
    playScreenRect,
    idleBottom,
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (dprQuery) dprQuery.removeEventListener('change', onDpr);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) {
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
          m.dispose();
        }
      });
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
