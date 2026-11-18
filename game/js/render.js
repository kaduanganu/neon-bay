// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session
// (camera framing fix: gameplay uses a narrower 48-degree field of
// view and a tighter follow camera; the title screen keeps the old
// 55-degree wide view and the old wide framing, so it does not change
// — the tighter follow values live in config.js).
// The renderer: Great Blox Heist in true 3D, built from the real .glb
// models in game/assets3d/ on vendored three.js r147. A third-person
// follow camera behind and above the player, like a GTA-style 3D game,
// with a sun directional light, real-time soft shadows, sky and fog, and
// the same beachfront strip as before — shops row, Shore Drive, sand and
// the bright blue bay. Gameplay still runs on the 2D ground-plane
// coordinates: 1 world unit is SCALE 3D units, so a character model
// (~1.95 tall) reads as ~30 world units and a car model (2.47 long) as
// ~38. The HUD and menus are drawn on a 2D overlay canvas on top of the
// WebGL canvas, so the panels stay crisp.
//
// Day/night: a 300-second cycle from 09:00 (DAY_LENGTH_SECONDS /
// DAY_START_HOUR and dayHourFrom in config.js) drives the sun, sky,
// fog, lamps, lit shop windows, headlights, moonlight, the moon and
// the stars — see applyDayNight. G.dayTime is seconds since 09:00,
// advanced only while the screen is PLAY; the title screen freezes it
// at 0, so the title stays a morning by itself, with no special
// handling here. If G.dayTime is missing (main.js has not landed it
// yet), dayHourFrom treats it as 0.
//
// Draw calls are kept modest: the ground is a handful of boxes plus
// InstancedMeshes for dashes, crosswalks and speckles; every model is
// cloned from a loaded .glb (geometries and materials shared); three.js
// frustum-culls whatever is off screen. Shadows come from one 2048
// directional shadow map that follows the player.

import {
  AVENUES, BUILDING_ROWS, CAM_DIST, CAM_HEIGHT, CAM_LOOK_NORTH, CAR_LENGTH,
  CAR_WIDTH, DAY_START_HOUR, PALETTE, PIER_TOP_Y, PIER_X, ROAD_W, SAND_Y, SCALE,
  SIDEWALK_BANDS, STREETS, WATER_Y, WORLD_H, WORLD_W, dayHourFrom,
} from './config.js';
import { onPier, onRoad } from './world.js';
import { tileHash, clamp, lerp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

const MODEL_FILES = [
  'danny', 'police', 'civilian-1', 'civilian-2',
  'car-sport-red', 'car-police', 'car-taxi', 'truck',
  'shop-24h', 'shop-hotel', 'shop-tacos',
  'palm', 'lamp', 'bench', 'hydrant', 'crate',
];
const SHOP_MODELS = ['shop-24h', 'shop-hotel', 'shop-tacos'];
const CAR_SCALE = (CAR_LENGTH * SCALE) / 2.47; // car .glb is 2.47 long

function hexToNum(hex) {
  return parseInt(String(hex).slice(1), 16);
}

export function createRenderer(canvas, overlay) {
  const THREE = window.THREE;
  const renderer = {
    canvas,
    overlay,
    ctx: overlay.getContext('2d'),
    view: { w: 1280, h: 720 },
    ready: null,
    webglOK: false,
    webglError: null,
    logoImg: null,
    fps: 0,
    // Day/night state, refreshed every frame by applyDayNight; the
    // play-test reads dayNight.isNight and lampsOn.
    dayNight: { hour: DAY_START_HOUR, darkness: 0, isNight: false, sunUp: 1 },
    lampsOn: false,
  };

  if (!THREE) {
    renderer.webglError = 'three.js failed to load';
    renderer.ready = Promise.resolve(false);
    return renderer;
  }

  let gl = null;
  try {
    gl = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (e) {
    renderer.webglError = `WebGL failed to start: ${e && e.message ? e.message : e}`;
    renderer.ready = Promise.resolve(false);
    return renderer;
  }
  renderer.webglOK = true;
  gl.outputEncoding = THREE.sRGBEncoding;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  // Exposed for the play-test's performance read-out (draw calls, triangles).
  renderer.glInfo = gl.info;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7ec8f7);
  scene.fog = new THREE.Fog(0x7ec8f7, 150, 340);
  const camera = new THREE.PerspectiveCamera(48, 1280 / 720, 0.1, 900);

  const sun = new THREE.DirectionalLight(0xfff2d9, 1.15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -48;
  sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 48;
  sun.shadow.camera.bottom = -48;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a6b42, 0.55);
  scene.add(hemi);
  // Dim bluish moonlight: 0 by day, the main night light after dark.
  // It casts no shadows — one shadow map (the sun's) is enough.
  const moonLight = new THREE.DirectionalLight(0x93a7ff, 0);
  scene.add(moonLight);
  scene.add(moonLight.target);

  // ---- day/night: sun, sky, lamps, windows, headlights, moon, stars ----
  // One full day is DAY_LENGTH_SECONDS of play starting at
  // DAY_START_HOUR (09:00); G.dayTime is seconds since then, advanced
  // only while the screen is PLAY.
  const SKY_KEYS = [
    // hour, sky colour: dark blue night, pale dawn, bright blue day,
    // orange-pink sunset, purple dusk, back to night.
    [0, 0x0a1230], [4.5, 0x0a1230], [5.5, 0x2c2a55], [6.5, 0xf2b98a],
    [7.5, 0x9fd4f2], [9, 0x7ec8f7], [16.5, 0x7ec8f7], [17.5, 0xffc27a],
    [18.5, 0xff7a4d], [19.5, 0x4a3f78], [20.5, 0x0a1230], [24, 0x0a1230],
  ];
  const SUN_DAY = new THREE.Color(0xfff2d9); // pale warm white at noon
  const SUN_LOW = new THREE.Color(0xff8a2a); // deep orange when low
  const HEMI_DAY_SKY = new THREE.Color(0xbfe3ff);
  const HEMI_NIGHT_SKY = new THREE.Color(0x4a5a8a);
  const HEMI_DAY_GROUND = new THREE.Color(0x8a6b42);
  const HEMI_NIGHT_GROUND = new THREE.Color(0x232838);
  const skyA = new THREE.Color();
  const skyB = new THREE.Color();
  function skyColorAt(hour, out) {
    for (let i = 0; i < SKY_KEYS.length - 1; i += 1) {
      const [h0, c0] = SKY_KEYS[i];
      const [h1, c1] = SKY_KEYS[i + 1];
      if (hour >= h0 && hour <= h1) {
        return out.setHex(c0).lerp(skyB.setHex(c1), (hour - h0) / (h1 - h0));
      }
    }
    return out.setHex(SKY_KEYS[SKY_KEYS.length - 1][1]);
  }
  // 0 in full day (07:30-17:00), 1 in full night (20:00-05:00), lerped
  // through dawn and dusk.
  function darknessAt(hour) {
    if (hour >= 7.5 && hour <= 17) return 0;
    if (hour >= 20 || hour <= 5) return 1;
    if (hour > 17) return (hour - 17) / 3;
    return 1 - (hour - 5) / 2.5;
  }
  // Soft radial glow texture, shared by the lamp sprites and the moon.
  function radialTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = radialTexture();
  // One shared material per effect, so one opacity update drives every
  // lamp, window and headlight beam in the scene.
  const lampGlowMat = new THREE.SpriteMaterial({
    map: glowTex, color: 0xffc46b, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const windowMat = new THREE.MeshBasicMaterial({
    color: 0xffc46b, transparent: true, opacity: 0, fog: false, depthWrite: false,
  });
  const windowGeo = new THREE.PlaneGeometry(1, 1);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const coneGeo = new THREE.ConeGeometry(0.3, 2.2, 12, 1, true);
  const lampGlows = []; // THREE.Sprite, one per street lamp
  const windowPlanes = []; // lit shopfront planes, one per building
  const headlightCones = []; // beam cones, two per car
  // Warm-white emissive materials found in the .glb clones — the car
  // headlight bulbs and the lamp bulbs, which already carry a warm
  // emissive in the models. Driving their shared emissiveIntensity is
  // what makes them glow at night. The red taillights and the police
  // light bar are far redder/bluer and fail the green/blue ratios, so
  // they are left alone.
  const nightGlowMats = new Set();
  function collectWarmGlow(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (!m || !m.emissive) continue;
        const e = m.emissive;
        if (e.r > 0.1 && e.r >= e.g && e.g >= e.b && e.g > 0.4 * e.r && e.b > 0.1 * e.r) {
          nightGlowMats.add(m);
        }
      }
    });
  }
  // The moon: a pale disc low over the northern horizon.
  const moonMat = new THREE.SpriteMaterial({
    map: glowTex, color: 0xf4f1de, transparent: true, opacity: 0,
    depthWrite: false, fog: false,
  });
  const moonSprite = new THREE.Sprite(moonMat);
  moonSprite.scale.set(16, 16, 1);
  moonSprite.visible = false;
  scene.add(moonSprite);
  // Stars: a dome of points over the city, fading in with darkness.
  const STAR_COUNT = 350;
  const starGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(STAR_COUNT * 3);
    const cx0 = (WORLD_W * SCALE) / 2;
    const cz0 = (WORLD_H * SCALE) / 2;
    for (let i = 0; i < STAR_COUNT; i += 1) {
      const a = tileHash(i, 1, 7) * Math.PI * 2;
      const e = 0.12 + tileHash(i, 2, 7) * 1.35;
      const r = 300;
      pos[i * 3] = cx0 + Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = 10 + Math.sin(e) * r;
      pos[i * 3 + 2] = cz0 + Math.sin(a) * Math.cos(e) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  }
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0, fog: false, depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.visible = false;
  scene.add(stars);
  // One real spotlight that follows the player's car at night; the
  // lamp and headlight glow itself is emissive + sprites only, so the
  // light count stays low.
  const playerSpot = new THREE.SpotLight(0xffe9a8, 0, 32, 0.55, 0.5, 1);
  playerSpot.castShadow = false;
  scene.add(playerSpot);
  scene.add(playerSpot.target);

  function applyDayNight(hour) {
    const darkness = darknessAt(hour);
    const sunUp = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
    renderer.dayNight = { hour, darkness, isNight: darkness > 0.5, sunUp };
    renderer.lampsOn = darkness >= 0.5;
    // Sky and fog share one colour, lerped through the keyframes.
    skyColorAt(hour, skyA);
    scene.background.copy(skyA);
    scene.fog.color.copy(skyA);
    // Sun: pale warm white at noon, deep orange when low, out at night.
    sun.color.copy(SUN_LOW).lerp(SUN_DAY, sunUp);
    sun.intensity = 1.15 * sunUp;
    // Night floor: the hemisphere never drops below 0.35 and cools off,
    // and the dim bluish moonlight takes over, so nights stay readable.
    hemi.intensity = 0.35 + 0.20 * (1 - darkness);
    hemi.color.copy(HEMI_DAY_SKY).lerp(HEMI_NIGHT_SKY, darkness);
    hemi.groundColor.copy(HEMI_DAY_GROUND).lerp(HEMI_NIGHT_GROUND, darkness);
    moonLight.intensity = 0.45 * darkness;
    // Lamps, shop windows and headlight beams fade in with darkness.
    const glowOn = darkness > 0.02;
    lampGlowMat.opacity = darkness * 0.85;
    windowMat.opacity = darkness * 0.85;
    coneMat.opacity = darkness * 0.14;
    for (const s of lampGlows) s.visible = glowOn;
    for (const w of windowPlanes) w.visible = glowOn;
    for (const c of headlightCones) c.visible = glowOn;
    for (const m of nightGlowMats) m.emissiveIntensity = 1 + darkness * 1.3;
    // Moon and stars fade in with darkness, out by day.
    moonMat.opacity = darkness;
    moonSprite.visible = glowOn;
    starMat.opacity = darkness * 0.9;
    stars.visible = glowOn;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(w * pr);
    canvas.height = Math.floor(h * pr);
    overlay.width = w;
    overlay.height = h;
    renderer.view.w = w;
    renderer.view.h = h;
    gl.setPixelRatio(pr);
    gl.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- shared materials and geometries ----
  const std = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0.02 }, o || {}));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function groundBox(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(boxGeo, std(color));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // ---- the ground: grass base, roads, sidewalks, sand, sea, pier ----
  const W3 = WORLD_W * SCALE;
  const H3 = WORLD_H * SCALE;
  groundBox(W3, 0.1, H3, PALETTE.grass, W3 / 2, -0.05, H3 / 2);
  // Roads: avenues run north-south, streets east-west.
  for (const ax of AVENUES) {
    groundBox(ROAD_W * SCALE, 0.06, H3, PALETTE.asphalt, ax * SCALE, 0, H3 / 2);
  }
  for (const sy of STREETS) {
    groundBox(W3, 0.06, ROAD_W * SCALE, PALETTE.asphalt, W3 / 2, 0, sy * SCALE);
  }
  // Sidewalk bands, plus paved shop rows and avenue-side strips.
  for (const [y0, y1] of SIDEWALK_BANDS) {
    groundBox(W3, 0.06, (y1 - y0) * SCALE, PALETTE.sidewalk, W3 / 2, 0.02, ((y0 + y1) / 2) * SCALE);
  }
  for (const row of BUILDING_ROWS) {
    groundBox(W3, 0.06, row.h * SCALE, PALETTE.sidewalk, W3 / 2, 0.02, (row.y + row.h / 2) * SCALE);
  }
  for (const ax of AVENUES) {
    groundBox(0.55, 0.06, H3, PALETTE.sidewalk, (ax - ROAD_W / 2 - 4) * SCALE, 0.02, H3 / 2);
    groundBox(0.55, 0.06, H3, PALETTE.sidewalk, (ax + ROAD_W / 2 + 4) * SCALE, 0.02, H3 / 2);
  }
  // Sand and the bay.
  groundBox(W3, 0.05, (WATER_Y - SAND_Y) * SCALE, PALETTE.sand, W3 / 2, 0.02, ((SAND_Y + WATER_Y) / 2) * SCALE);
  const waterMat = std(PALETTE.water, { roughness: 0.35, metalness: 0.1 });
  // The bay runs from the sand's edge south past the end of the world, so
  // the bottom of the frame is sea, not empty sky, when the camera looks
  // south past the beach.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W3, (1500 - WATER_Y) * SCALE), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(W3 / 2, 0.06, ((WATER_Y + 1500) / 2) * SCALE);
  water.receiveShadow = true;
  scene.add(water);
  // The pier: wooden boards out into the bay, with posts.
  const pier = groundBox(68 * SCALE, 0.14, (WATER_Y + 220 - PIER_TOP_Y) * SCALE, '#c9a06a', PIER_X * SCALE, 0.05, ((PIER_TOP_Y + WATER_Y + 220) / 2) * SCALE);
  pier.castShadow = true;
  for (let i = 0; i < 6; i += 1) {
    const z = (PIER_TOP_Y + 20 + i * 42) * SCALE;
    for (const sx of [-30, 30]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8), std('#8a6b42'));
      post.position.set((PIER_X + sx) * SCALE, 0.1, z);
      post.castShadow = true;
      scene.add(post);
    }
  }
  // Boats bobbing beside the pier, built from boxes.
  const boats = [];
  for (const [bx, hull] of [[PIER_X - 90, '#ffffff'], [PIER_X + 95, '#2b7fd9']]) {
    const boat = new THREE.Group();
    const h1 = new THREE.Mesh(boxGeo, std(hull));
    h1.scale.set(2.6, 0.45, 1.1);
    h1.position.y = 0.25;
    h1.castShadow = true;
    boat.add(h1);
    const cab = new THREE.Mesh(boxGeo, std('#ffffff'));
    cab.scale.set(1.0, 0.5, 0.8);
    cab.position.set(-0.2, 0.65, 0);
    cab.castShadow = true;
    boat.add(cab);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), std('#8a6b42'));
    mast.position.set(0.5, 0.9, 0);
    boat.add(mast);
    boat.position.set(bx * SCALE, 0.06, (WATER_Y + 60) * SCALE);
    scene.add(boat);
    boats.push(boat);
  }

  // ---- instanced small decor: lane dashes, crosswalks, speckles ----
  function instanced(geo, mat, transforms) {
    const mesh = new THREE.InstancedMesh(geo, mat, transforms.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    transforms.forEach((t, i) => {
      e.set(t.rx || 0, t.ry || 0, t.rz || 0);
      q.setFromEuler(e);
      p.set(t.x, t.y, t.z);
      s.set(t.sx || 1, t.sy || 1, t.sz || 1);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      if (t.color) mesh.setColorAt(i, new THREE.Color(t.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  const dashGeo = new THREE.BoxGeometry(1, 1, 1);
  const dashMat = std('#f2f2f2');
  const dashT = [];
  for (const sy of STREETS) {
    for (let x = 40; x < WORLD_W - 40; x += 42) {
      dashT.push({ x: x * SCALE, y: 0.045, z: sy * SCALE, sx: 1.3, sy: 0.02, sz: 0.14 });
    }
  }
  for (const ax of AVENUES) {
    for (let y = 40; y < SAND_Y - 40; y += 42) {
      dashT.push({ x: ax * SCALE, y: 0.045, z: y * SCALE, sx: 0.14, sy: 0.02, sz: 1.3 });
    }
  }
  instanced(dashGeo, dashMat, dashT);
  // Crosswalks: white stripes across each road at every junction.
  const crossT = [];
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      for (let i = 0; i < 8; i += 1) {
        crossT.push({ x: (ax - 30 + i * 8.5) * SCALE, y: 0.045, z: (sy - ROAD_W / 2 - 8) * SCALE, sx: 0.45, sy: 0.02, sz: 2.2 });
        crossT.push({ x: (ax - 30 + i * 8.5) * SCALE, y: 0.045, z: (sy + ROAD_W / 2 + 8) * SCALE, sx: 0.45, sy: 0.02, sz: 2.2 });
        crossT.push({ x: (ax - ROAD_W / 2 - 8) * SCALE, y: 0.045, z: (sy - 30 + i * 8.5) * SCALE, sx: 2.2, sy: 0.02, sz: 0.45 });
        crossT.push({ x: (ax + ROAD_W / 2 + 8) * SCALE, y: 0.045, z: (sy - 30 + i * 8.5) * SCALE, sx: 2.2, sy: 0.02, sz: 0.45 });
      }
    }
  }
  instanced(dashGeo, dashMat, crossT);
  // Sand pebbles and shells, grass flowers — deterministic speckles.
  const speckT = [];
  for (let i = 0; i < 160; i += 1) {
    const tx = Math.floor(tileHash(i, 3, 11) * 220);
    const ty = Math.floor(tileHash(i, 7, 11) * 68);
    const wx = 60 + tx;
    const wy = SAND_Y + 6 + (ty % 44);
    speckT.push({
      x: wx * SCALE, y: 0.055, z: wy * SCALE,
      sx: 0.1, sy: 0.05, sz: 0.1,
      color: tileHash(i, 5, 11) < 0.5 ? '#d9a05f' : '#ffffff',
    });
  }
  for (let i = 0; i < 120; i += 1) {
    const wx = 60 + Math.floor(tileHash(i, 13, 23) * 3400);
    const wy = 100 + Math.floor(tileHash(i, 17, 23) * 360);
    if (onRoad(wx, wy) || onPier(wx, wy)) continue;
    speckT.push({
      x: wx * SCALE, y: 0.055, z: wy * SCALE,
      sx: 0.12, sy: 0.06, sz: 0.12,
      color: ['#ff5fa2', '#ffd23e', '#ffffff', '#ff7a3c'][i % 4],
    });
  }
  instanced(dashGeo, std('#ffffff'), speckT);
  // White wave curls on the bay, bobbing with time.
  const waveGeo = new THREE.BoxGeometry(1, 1, 1);
  const waveMat = std('#ffffff');
  const waves = [];
  for (let i = 0; i < 26; i += 1) {
    const m = new THREE.Mesh(waveGeo, waveMat);
    const wx = 80 + tileHash(i, 21, 31) * 3400;
    const wy = WATER_Y + 20 + tileHash(i, 29, 31) * 480;
    m.scale.set(1.4 + tileHash(i, 3, 31) * 0.8, 0.03, 0.22);
    m.position.set(wx * SCALE, 0.08, wy * SCALE);
    m.rotation.y = 0.3;
    m.userData.phase = i * 0.7;
    scene.add(m);
    waves.push(m);
  }

  // ---- model loading: every .glb, plus the title logo ----
  const models = {};
  const loader = new THREE.GLTFLoader();
  function loadModel(name) {
    return new Promise((resolve, reject) => {
      loader.load(`assets3d/${name}.glb`, (gltf) => {
        gltf.scene.traverse((o) => {
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });
        models[name] = gltf.scene;
        resolve(gltf.scene);
      }, undefined, reject);
    });
  }
  const logoPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { renderer.logoImg = img; resolve(true); };
    img.onerror = () => resolve(false);
    img.src = 'assets/logo.png';
  });
  renderer.ready = Promise.all([
    ...MODEL_FILES.map(loadModel),
    logoPromise,
  ]).then(() => true).catch((e) => {
    renderer.webglError = `model load failed: ${e && e.message ? e.message : e}`;
    return false;
  });

  // Tint every mesh whose material colour matches `fromHex` to `toHex`,
  // cloning the material once per source material so clones stay
  // independent. The .glb bodies use plain-colour materials, so a red
  // sports car becomes a blue sedan just by retinting its body colour.
  function tintClone(root, fromHex, toHex) {
    const cache = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      const replaced = list.map((m) => {
        if (!m || !m.color || m.color.getHex() !== fromHex) return m;
        if (!cache.has(m)) {
          const c = m.clone();
          c.color.setHex(toHex);
          cache.set(m, c);
        }
        return cache.get(m);
      });
      o.material = Array.isArray(o.material) ? replaced : replaced[0];
    });
  }

  // ---- static world: buildings, palms, lamps, props ----
  let staticBuilt = false;
  // Small code-built props the .glb set does not cover: flower beds,
  // planters, bushes, rocks, shells and signposts.
  const signTexCache = {};
  function signTexture(word) {
    if (signTexCache[word]) return signTexCache[word];
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#f2f2f2';
    x.fillRect(0, 0, 256, 128);
    x.strokeStyle = '#14161c';
    x.lineWidth = 8;
    x.strokeRect(6, 6, 244, 116);
    x.fillStyle = '#14161c';
    x.font = 'bold 52px "Trebuchet MS", Verdana, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(word, 128, 68);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    signTexCache[word] = t;
    return t;
  }
  function codeProp(kind, v) {
    const g = new THREE.Group();
    if (kind === 'flowerbed') {
      const soil = new THREE.Mesh(boxGeo, std('#5a4030'));
      soil.scale.set(1.0, 0.16, 0.42);
      soil.position.y = 0.08;
      soil.castShadow = true;
      g.add(soil);
      for (let i = 0; i < 5; i += 1) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
          std(['#ff5fa2', '#ffd23e', '#ffffff', '#ff7a3c', '#ff5fa2'][i]));
        f.position.set(-0.36 + i * 0.18, 0.2, (i % 2 === 0 ? -0.08 : 0.08));
        g.add(f);
      }
    } else if (kind === 'planter') {
      const box = new THREE.Mesh(boxGeo, std('#8a6b42'));
      box.scale.set(0.5, 0.3, 0.5);
      box.position.y = 0.15;
      box.castShadow = true;
      g.add(box);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), std('#2fae4e'));
      bush.position.y = 0.45;
      bush.castShadow = true;
      g.add(bush);
    } else if (kind === 'bush') {
      const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), std('#2fae4e'));
      b1.position.y = 0.28;
      b1.castShadow = true;
      g.add(b1);
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), std('#58d13d'));
      b2.position.set(0.25, 0.2, 0.1);
      b2.castShadow = true;
      g.add(b2);
    } else if (kind === 'rock') {
      const r = new THREE.Mesh(boxGeo, std('#8a8f98'));
      r.scale.set(0.32, 0.2, 0.26);
      r.position.y = 0.1;
      r.rotation.y = v * 0.7;
      r.castShadow = true;
      g.add(r);
    } else if (kind === 'shell') {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.12, 10), std('#ffffff'));
      s.position.y = 0.06;
      s.castShadow = true;
      g.add(s);
    } else if (kind === 'signpost') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.3, 8), std('#5a4030'));
      pole.position.y = 0.65;
      pole.castShadow = true;
      g.add(pole);
      const board = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
        map: signTexture(v === 0 ? 'BEACH' : 'PIER'), roughness: 0.8,
      }));
      board.scale.set(0.85, 0.42, 0.05);
      board.position.y = 1.25;
      board.castShadow = true;
      g.add(board);
    }
    return g;
  }
  function buildStatic(world) {
    if (staticBuilt) return;
    staticBuilt = true;
    // Buildings: cycle the three shop models, scaled to each footprint.
    // The shop front (+Z in the model) faces south, toward the road.
    world.buildings.forEach((b, i) => {
      const src = models[SHOP_MODELS[i % SHOP_MODELS.length]];
      const g = src.clone();
      const sx = (b.w * SCALE) / 4.4;
      const sz = (b.h * SCALE) / 3.47;
      g.scale.set(sx, 1.15, sz);
      g.position.set((b.x + b.w / 2) * SCALE, 0, (b.y + b.h / 2) * SCALE);
      scene.add(g);
      // Lit shopfront at night: a thin warm plane on the south face,
      // just proud of the model's storefront glass (the glass sits at
      // 1.34 model units out; the plane sits at 1.36), at window
      // height. The .glb files are untouched.
      const win = new THREE.Mesh(windowGeo, windowMat);
      win.scale.set(2.31 * sx, 0.85, 1);
      win.position.set(
        (b.x + b.w / 2) * SCALE, 0.98,
        (b.y + b.h / 2) * SCALE + 1.36 * sz + 0.03,
      );
      scene.add(win);
      windowPlanes.push(win);
    });
    for (const p of world.palms) {
      const g = models.palm.clone();
      g.scale.setScalar(0.85);
      g.position.set(p.x * SCALE, 0, p.y * SCALE);
      scene.add(g);
    }
    for (const l of world.lamps) {
      const g = models.lamp.clone();
      g.position.set(l.x * SCALE, 0, l.y * SCALE);
      scene.add(g);
      // The lamp's own bulb already carries a warm emissive; driving
      // it (see collectWarmGlow) plus a soft additive glow sprite at
      // the bulb's spot (the bulb sits ~2.34 high, 0.42 out along +X)
      // is what lights the lamp at night. No real point light per
      // lamp — there are dozens of them.
      collectWarmGlow(g);
      const glow = new THREE.Sprite(lampGlowMat);
      glow.position.set(l.x * SCALE + 0.42, 2.34, l.y * SCALE);
      glow.scale.setScalar(2.4);
      scene.add(glow);
      lampGlows.push(glow);
    }
    for (const p of world.props) {
      let g = null;
      if (p.kind === 'bench') g = models.bench.clone();
      else if (p.kind === 'hydrant') g = models.hydrant.clone();
      else if (p.kind === 'crate') g = models.crate.clone();
      else g = codeProp(p.kind, p.v || 0);
      g.position.set(p.x * SCALE, 0, p.y * SCALE);
      scene.add(g);
    }
  }

  // ---- dynamic objects: cars, people, the player ----
  const dynGroups = new Map(); // game object -> THREE.Group
  const flashBars = []; // police clones' light-bar materials
  function collectFlashBars(group) {
    const entry = { red: [], blue: [] };
    group.traverse((o) => {
      if (!o.isMesh) return;
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) {
        if (!m || !m.emissive) continue;
        const hex = m.emissive.getHex();
        if (hex === 0xff2d2d && !entry.red.includes(m)) entry.red.push(m);
        if (hex === 0x2d7dff && !entry.blue.includes(m)) entry.blue.push(m);
      }
    });
    if (entry.red.length || entry.blue.length) flashBars.push(entry);
  }
  function carGroup(car) {
    let name;
    let tintFrom = 0;
    if (car.model === 'police') name = 'car-police';
    else if (car.model === 'taxi') name = 'car-taxi';
    else if (car.model === 'truck') { name = 'truck'; tintFrom = 0x2b7fd9; }
    else { name = 'car-sport-red'; tintFrom = 0xe0392b; }
    const g = models[name].clone();
    if (tintFrom) tintClone(g, tintFrom, hexToNum(car.color));
    g.scale.setScalar(CAR_SCALE);
    if (car.model === 'police') collectFlashBars(g);
    // Headlights: the model already has two warm emissive bulbs on the
    // front face (+X end, the car's forward axis); driving them at
    // night (see collectWarmGlow) plus a short translucent beam cone
    // each is what lights the car up after dark.
    collectWarmGlow(g);
    for (const sz of [-0.35, 0.35]) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.rotation.z = Math.PI / 2; // apex at the bulb, base forward
      cone.position.set(2.25, 0.6, sz);
      g.add(cone);
      headlightCones.push(cone);
    }
    return g;
  }
  function personGroup(o, modelName, shirtFrom, shirtTo) {
    const g = models[modelName].clone();
    if (shirtFrom && shirtTo) tintClone(g, shirtFrom, hexToNum(shirtTo));
    return g;
  }
  function getPersonGroup(ped, isEnemy) {
    if (isEnemy) return personGroup(ped, 'civilian-1', 0xff5fa2, '#8e2f2f');
    const idx = (ped.name || '').length % 2;
    if (idx === 0) return personGroup(ped, 'civilian-1', 0xff5fa2, ped.shirt);
    return personGroup(ped, 'civilian-2', 0x58d13d, ped.shirt);
  }
  function syncDynamic(G) {
    const live = new Set();
    // `make` is a factory: only called when the object has no group yet,
    // so a clone is built once per object, not once per frame.
    const place = (obj, make) => {
      live.add(obj);
      let g = dynGroups.get(obj);
      if (!g) {
        g = make();
        dynGroups.set(obj, g);
        scene.add(g);
      }
      return g;
    };
    // The player (Danny).
    const p = G.player;
    if (!p.car) {
      const g = place(p, () => models.danny.clone());
      const bob = p.moving ? Math.abs(Math.sin(p.walkPhase)) * 0.07 : 0;
      g.position.set(p.x * SCALE, bob, p.y * SCALE);
      g.rotation.set(p.moving ? Math.sin(p.walkPhase) * 0.05 : 0, Math.PI / 2 - p.angle, 0);
    } else if (dynGroups.has(p)) {
      scene.remove(dynGroups.get(p));
      dynGroups.delete(p);
    }
    // Traffic, parked cars and the player's car.
    for (const car of G.cars) {
      const g = place(car, () => carGroup(car));
      g.position.set(car.x * SCALE, 0, car.y * SCALE);
      g.rotation.set(car.destroyed ? 0 : 0, -car.angle, car.destroyed ? 0.14 : 0);
    }
    // Police cruisers.
    for (const cruiser of G.police.cars) {
      const g = place(cruiser, () => carGroup(cruiser));
      g.position.set(cruiser.x * SCALE, 0, cruiser.y * SCALE);
      g.rotation.set(0, -cruiser.angle, 0);
    }
    // Pedestrians.
    for (const ped of G.peds) {
      const g = place(ped, () => getPersonGroup(ped, false));
      const bob = Math.abs(Math.sin(ped.walkPhase)) * 0.06;
      g.position.set(ped.x * SCALE, bob, ped.y * SCALE);
      g.rotation.set(Math.sin(ped.walkPhase) * 0.04, Math.PI / 2 - ped.angle, 0);
    }
    // Enemy gunmen.
    for (const enemy of G.missions.enemies) {
      const g = place(enemy, () => getPersonGroup(enemy, true));
      const bob = Math.abs(Math.sin(G.time * 7 + enemy.x)) * 0.05;
      g.position.set(enemy.x * SCALE, bob, enemy.y * SCALE);
      g.rotation.set(0, Math.PI / 2 - enemy.angle, 0);
      // Health bar: a small red box floating above the head.
      if (!enemy._bar) {
        const bar = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color: 0xe0392b }));
        bar.scale.set(0.7, 0.09, 0.02);
        bar.position.set(0, 2.05, 0);
        g.add(bar);
        enemy._bar = bar;
      }
      enemy._bar.scale.x = 0.7 * Math.max(0, enemy.health / 60);
    }
    // Drop groups for objects that left the world (despawned cruisers,
    // a reset game) so they stop drawing.
    for (const [obj, g] of dynGroups) {
      if (!live.has(obj)) {
        scene.remove(g);
        dynGroups.delete(obj);
      }
    }
  }

  // ---- bullets: pooled yellow tracers ----
  const BULLET_POOL = 48;
  const bulletGeo = new THREE.BoxGeometry(2.4, 0.2, 0.2);
  const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe66d });
  const bulletMeshes = [];
  for (let i = 0; i < BULLET_POOL; i += 1) {
    const m = new THREE.Mesh(bulletGeo, bulletMat);
    m.visible = false;
    scene.add(m);
    bulletMeshes.push(m);
  }
  function syncBullets(G) {
    for (let i = 0; i < BULLET_POOL; i += 1) {
      const mesh = bulletMeshes[i];
      const b = G.bullets[i];
      if (!b) { mesh.visible = false; continue; }
      mesh.visible = true;
      mesh.position.set(b.x * SCALE, 0.9, b.y * SCALE);
      mesh.rotation.set(0, -Math.atan2(b.vy, b.vx), 0);
    }
  }

  // ---- effects: sparks, muzzle flashes, smoke, skid marks ----
  const effectMeshes = new Map(); // effect object -> THREE.Mesh
  const sparkGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffc83c });
  const muzzleGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const muzzleMat = new THREE.MeshBasicMaterial({ color: 0xfff096 });
  const smokeGeo = new THREE.SphereGeometry(0.55, 10, 8);
  const skidGeo = new THREE.BoxGeometry(0.9, 0.02, 0.22);
  function syncEffects(G) {
    const live = new Set(G.effects);
    for (const e of G.effects) {
      let mesh = effectMeshes.get(e);
      if (!mesh) {
        if (e.kind === 'spark') mesh = new THREE.Mesh(sparkGeo, sparkMat);
        else if (e.kind === 'muzzle') mesh = new THREE.Mesh(muzzleGeo, muzzleMat);
        else if (e.kind === 'smoke') {
          mesh = new THREE.Mesh(smokeGeo, new THREE.MeshStandardMaterial({
            color: 0x787878, transparent: true, opacity: 0.4, roughness: 1,
          }));
        } else if (e.kind === 'skid') {
          mesh = new THREE.Mesh(skidGeo, new THREE.MeshBasicMaterial({
            color: 0x14121a, transparent: true, opacity: 0.4,
          }));
        } else continue;
        effectMeshes.set(e, mesh);
        scene.add(mesh);
      }
      if (e.kind === 'spark') {
        mesh.position.set(e.x * SCALE, 0.9, e.y * SCALE);
        const s = 0.6 + e.life * 2;
        mesh.scale.setScalar(Math.max(0.1, s));
      } else if (e.kind === 'muzzle') {
        mesh.position.set(e.x * SCALE, 0.9, e.y * SCALE);
      } else if (e.kind === 'smoke') {
        mesh.position.set(e.x * SCALE, 0.8, e.y * SCALE);
        mesh.scale.setScalar(1 + (1.2 - e.life) * 1.4);
        mesh.material.opacity = Math.max(0, e.life * 0.35);
      } else if (e.kind === 'skid') {
        mesh.position.set(e.x * SCALE, 0.05, e.y * SCALE);
        mesh.rotation.set(0, -e.angle, 0);
        mesh.material.opacity = Math.max(0, e.life * 0.1);
      }
    }
    for (const [e, mesh] of effectMeshes) {
      if (!live.has(e)) {
        scene.remove(mesh);
        effectMeshes.delete(e);
      }
    }
  }

  // ---- the mission marker: beacon column, pulsing ring, screen label ----
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 7, 16),
    new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.3, 1.75, 32),
    new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);
  const markerV = new THREE.Vector3();
  function drawMarkerLabel(G) {
    const { ctx, view } = renderer;
    const marker = G.marker;
    if (!marker || !marker.label) return;
    markerV.set(marker.x * SCALE, 1.2, marker.y * SCALE).project(camera);
    if (markerV.z > 1) return;
    const sx = (markerV.x * 0.5 + 0.5) * view.w;
    const sy = (-markerV.y * 0.5 + 0.5) * view.h;
    // A marker outside the frame has no label: without this, a job far
    // away would float a stray label at the edge of the screen. The
    // margin (70 px) is wider than half a label, so a label never pokes
    // in from the edge when its marker is off-frame.
    if (sx < 70 || sx > view.w - 70 || sy < 78 || sy > view.h) return;
    ctx.font = 'bold 13px "Trebuchet MS", Verdana, sans-serif';
    const tw = ctx.measureText(marker.label).width;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.strokeStyle = '#ff5fa2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(sx - tw / 2 - 9, sy - 72, tw + 18, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#14161c';
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, sx, sy - 56);
    ctx.textAlign = 'left';
  }

  // ---- camera: follow, title pan, or a staged override ----
  const camPos = new THREE.Vector3(65, 42, 46);
  const camLook = new THREE.Vector3(65, 0, 20);
  let lastDraw = performance.now();
  function updateCamera(G) {
    const now = performance.now();
    const dt = clamp((now - lastDraw) / 1000, 0.001, 0.05);
    lastDraw = now;
    let cx;
    let cz;
    let h = CAM_HEIGHT;
    let d = CAM_DIST;
    if (G.camOverride) {
      cx = G.camOverride.cx;
      cz = G.camOverride.cz;
      h = G.camOverride.h || CAM_HEIGHT;
      d = G.camOverride.d || CAM_DIST;
    } else if (G.screen === SCREEN_TITLE) {
      cx = 1000 + Math.sin(G.time * 0.05) * 500;
      cz = 300;
      // The title pan keeps the old wide framing (30 high, 44 back):
      // the tight follow values are for gameplay only, so the title
      // screen looks exactly as it did.
      h = 30;
      d = 44;
    } else {
      cx = G.player.x;
      cz = G.player.y;
      const speedFactor = G.player.car ? Math.min(1, Math.abs(G.player.car.speed) / 440) : 0;
      h = CAM_HEIGHT * (1 + speedFactor * 0.25);
      d = CAM_DIST * (1 + speedFactor * 0.25);
    }
    // Field of view follows the screen, not the camera branch: the
    // title screen keeps the old wide 55-degree view, so its framing
    // is pixel-identical to before, while gameplay uses the tighter
    // 48-degree view. The staged title shot sets SCREEN_TITLE too, so
    // it also keeps 55.
    const wantFov = G.screen === SCREEN_TITLE ? 55 : 48;
    if (camera.fov !== wantFov) {
      camera.fov = wantFov;
      camera.updateProjectionMatrix();
    }
    const desPos = new THREE.Vector3(cx * SCALE, h, cz * SCALE + d);
    const desLook = new THREE.Vector3(cx * SCALE, 0, cz * SCALE - CAM_LOOK_NORTH);
    if (G.camSnap) {
      camPos.copy(desPos);
      camLook.copy(desLook);
      G.camSnap = false;
    } else {
      const k = 1 - Math.exp(-3.5 * dt);
      camPos.lerp(desPos, k);
      camLook.lerp(desLook, k);
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // The sun and its shadow box follow the camera centre. The sun
    // rides high at noon (42, as before) and drops toward the horizon
    // at dawn and dusk for long shadows; at night its intensity is 0.
    const sunH = 8 + 34 * (renderer.dayNight.sunUp || 0);
    sun.position.set(cx * SCALE + 25, sunH, cz * SCALE + 18);
    sun.target.position.set(cx * SCALE, 0, cz * SCALE);
    sun.target.updateMatrixWorld();
    // The moonlight follows the camera centre too, from the north-west.
    moonLight.position.set(cx * SCALE - 20, 30, cz * SCALE - 15);
    moonLight.target.position.set(cx * SCALE, 0, cz * SCALE);
    moonLight.target.updateMatrixWorld();
    // The moon hangs low over the northern horizon, at the top of the
    // frame when the camera looks north.
    moonSprite.position.set(cx * SCALE - 35, 16, cz * SCALE - 130);
  }

  // ---- per-frame draw ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();
  renderer.pickGround = (mx, my) => {
    ndc.set((mx / renderer.view.w) * 2 - 1, -(my / renderer.view.h) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.ray.intersectPlane(groundPlane, hitPoint);
    if (!hit) return { x: 0, y: 0 };
    return { x: hitPoint.x / SCALE, y: hitPoint.z / SCALE };
  };

  let frameCount = 0;
  let fpsTime = performance.now();
  renderer.drawWorld = (G) => {
    const { ctx, view } = renderer;
    ctx.clearRect(0, 0, view.w, view.h);
    buildStatic(G.world);
    syncDynamic(G);
    syncBullets(G);
    syncEffects(G);
    // Day/night: the clock drives the sun, sky, lamps, windows,
    // headlights, moon and stars. G.dayTime is 0 on the title screen,
    // so the title stays a 09:00 morning automatically.
    applyDayNight(dayHourFrom(G.dayTime));
    // The player's headlights throw one real pool of light at night.
    const playerCar = G.player.car;
    if (playerCar && renderer.dayNight.darkness > 0) {
      playerSpot.intensity = renderer.dayNight.darkness * 1.6;
      playerSpot.position.set(playerCar.x * SCALE, 1.4, playerCar.y * SCALE);
      playerSpot.target.position.set(
        (playerCar.x + Math.cos(playerCar.angle) * 8) * SCALE, 0,
        (playerCar.y + Math.sin(playerCar.angle) * 8) * SCALE,
      );
      playerSpot.target.updateMatrixWorld();
    } else {
      playerSpot.intensity = 0;
    }
    // Police light bars flash red/blue, alternating with time.
    const flash = Math.floor(G.time * 3) % 2 === 0;
    for (const bar of flashBars) {
      for (const m of bar.red) m.emissiveIntensity = flash ? 1.4 : 0.15;
      for (const m of bar.blue) m.emissiveIntensity = flash ? 0.15 : 1.4;
    }
    // The sea breathes: wave curls bob and drift, boats rock.
    for (const w of waves) {
      w.position.y = 0.08 + Math.sin(G.time * 1.5 + w.userData.phase) * 0.03;
    }
    for (let i = 0; i < boats.length; i += 1) {
      boats[i].position.y = 0.06 + Math.sin(G.time * 1.1 + i * 2.1) * 0.06;
      boats[i].rotation.z = Math.sin(G.time * 0.9 + i) * 0.03;
    }
    // The mission marker.
    if (G.marker) {
      beacon.visible = true;
      ring.visible = true;
      beacon.position.set(G.marker.x * SCALE, 3.5, G.marker.y * SCALE);
      ring.position.set(G.marker.x * SCALE, 0.07, G.marker.y * SCALE);
      const pulse = 1 + Math.sin(G.time * 4) * 0.15;
      ring.scale.setScalar(pulse);
    } else {
      beacon.visible = false;
      ring.visible = false;
    }
    updateCamera(G);
    gl.render(scene, camera);
    drawMarkerLabel(G);
    frameCount += 1;
    const now = performance.now();
    if (now - fpsTime >= 1000) {
      renderer.fps = Math.round((frameCount * 1000) / (now - fpsTime));
      frameCount = 0;
      fpsTime = now;
    }
  };

  renderer.clear = () => {
    const { ctx, view } = renderer;
    ctx.clearRect(0, 0, view.w, view.h);
  };

  return renderer;
}
