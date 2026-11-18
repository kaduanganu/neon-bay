// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the 3D renderer paints what is there. The game
// moves between five screens: title, play, paused, busted and complete.
// ?seed=N fixes the city. ?shot=chase|street|mission|start (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
//
// The 3D models load asynchronously (GLTFLoader), so boot waits for the
// renderer's ready promise before the loop or the staging starts. If
// WebGL cannot start, the status line says so and the game does not run.

import { STEP, WORLD_H, WORLD_W } from './config.js';
import { createRandom } from './random.js';
import { createWorld, PLACES } from './world.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_PAUSE, ACTION_SHOOT, createInput } from './input.js';
import { createPlayer, damagePlayer, enterCar, exitCar, healPlayer, nearestStealableCar, playerShoot, updatePlayer } from './player.js';
import { createTraffic, createPedestrians, updatePedestrians, updateTraffic } from './traffic.js';
import { clearWanted, createPolice, raiseWanted, updatePolice } from './police.js';
import { activeMarker, allMissionsDone, createMissions, tryStartMission, updateBullets, updateEnemies, updateMissions } from './missions.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { drawBusted, drawComplete, drawHUD, drawPaused, drawTitle } from './hud.js';
import { loadSave, writeSave } from './save.js';
import { stageShot } from './shots.js';
import { collideCars, damageCar, driveCar } from './vehicles.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const overlay = document.getElementById('hud');
const status = document.getElementById('status');
const renderer = createRenderer(canvas, overlay);

function createGame(seedValue) {
  const random = createRandom(seedValue);
  const world = createWorld(random);
  const player = createPlayer(PLACES.garage.x + 40, PLACES.garage.y + 60);
  const cars = createTraffic(random);
  const peds = createPedestrians(random, world);
  const police = createPolice();
  const missions = createMissions();
  return {
    seed: seedValue, random, world, player, cars, peds, police, missions,
    bullets: [], effects: [], audio: createAudio(), input: null,
    time: 0, dayTime: 0, screen: SCREEN_TITLE,
    save: loadSave(), marker: null, bustedTimer: 0, renderer,
    camOverride: null, camSnap: false,
  };
}

const G = createGame(seed);
G.input = createInput(canvas);
// Debug handle for play-testing (read-only from the console).
window.__greatBloxHeist = G;

function announce(message) {
  status.textContent = message;
}

function resetGame(fromSave) {
  const fresh = createGame(seed);
  G.random = fresh.random;
  G.world = fresh.world;
  G.player = fresh.player;
  G.cars = fresh.cars;
  G.peds = fresh.peds;
  G.police = fresh.police;
  G.missions = fresh.missions;
  G.bullets = [];
  G.effects = [];
  G.time = 0;
  G.dayTime = 0;
  G.camOverride = null;
  G.camSnap = false;
  if (fromSave && G.save) {
    G.missions.index = G.save.missionsDone;
    G.player.cash = G.save.cash;
    G.player.health = G.save.health;
    announce(`Welcome back, Danny. ${G.save.missionsDone}/5 jobs done, $${G.save.cash} in your pocket.`);
  } else {
    announce('Danny Reyes, fresh off the bus with $40. Mara Solano is waiting at the garage.');
  }
  G.screen = SCREEN_PLAY;
}

function applyBusted() {
  const p = G.player;
  p.cash = Math.max(0, p.cash - 150);
  if (p.car) { p.car.driver = null; p.car = null; }
  p.x = PLACES.hideout.x;
  p.y = PLACES.hideout.y;
  p.health = 100;
  p.invulnerable = 2;
  clearWanted(G.police);
  G.bullets = [];
  G.missions.enemies = [];
  G.screen = SCREEN_BUSTED;
  G.audio.busted();
  writeSave(G.missions, p);
  announce('Busted. You paid $150 in bail and woke up at the hideout.');
}

function updateEffects(dt) {
  for (const e of G.effects) {
    e.life -= dt;
    if (e.kind === 'spark') {
      e.x += (e.vx || 0) * dt;
      e.y += (e.vy || 0) * dt;
    }
  }
  G.effects = G.effects.filter((e) => e.life > 0);
}

function paint() {
  renderer.drawWorld(G);
  if (G.screen === SCREEN_PLAY) drawHUD(G, renderer);
  else if (G.screen === SCREEN_TITLE) drawTitle(G, renderer);
  else if (G.screen === SCREEN_PAUSED) drawPaused(G, renderer);
  else if (G.screen === SCREEN_BUSTED) drawBusted(G, renderer);
  else if (G.screen === SCREEN_COMPLETE) drawComplete(G, renderer);
}

function step(dt, staging = false) {
  G.time += dt;
  const { input, player, police } = G;

  if (G.screen === SCREEN_TITLE) {
    // The title camera pans along the beachfront strip behind the logo:
    // colourful toy shops at the top of the frame, Shore Drive across
    // the middle, sand and the bright blue bay at the bottom. The
    // renderer owns the pan; the loop just keeps the city alive.
    updateTraffic(G.cars, G.world, dt, G.effects, player);
    updatePedestrians(G.peds, G.world, player, G.cars, dt, null);
    if (!staging) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        G.audio.unlock();
        resetGame(false);
      } else if (input.keys.has('KeyC') && G.save) {
        input.keys.delete('KeyC');
        G.audio.unlock();
        resetGame(true);
      }
    }
    return;
  }

  if (!staging) {
    if (G.screen === SCREEN_PAUSED) {
      const actions = input.takeActions();
      if (actions & ACTION_PAUSE) G.screen = SCREEN_PLAY;
      return;
    }
    if (G.screen === SCREEN_BUSTED) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        G.screen = SCREEN_PLAY;
        announce('Back on the streets. Mara still has work for you.');
      }
      return;
    }
    if (G.screen === SCREEN_COMPLETE) {
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) resetGame(false);
      return;
    }
  }
  // The day/night clock advances only while actually playing: this
  // point is reached only after the title branch and the
  // paused/busted/complete branches have returned early, so the clock
  // runs on PLAY, freezes when paused/busted/complete, and never
  // advances on the title screen (the title stays morning).
  G.dayTime += dt;
  if (G.screen !== SCREEN_PLAY) return;

  const actions = staging ? 0 : input.takeActions();

  // Mute toggle.
  if (!staging && input.keys.has('KeyM')) {
    input.keys.delete('KeyM');
    const muted = G.audio.toggleMute();
    announce(muted ? 'Sound off.' : 'Sound on.');
  }

  // Pause.
  if (actions & ACTION_PAUSE) {
    G.screen = SCREEN_PAUSED;
    G.audio.setEngine(0, false);
    return;
  }

  // Start a job at its marker.
  if (actions & ACTION_CONFIRM) {
    if (tryStartMission(G.missions, player, police, G.audio)) {
      announce(`${G.missions.toast}`);
    }
  }

  // Shooting — mouse click, F, or a held mouse button, on foot only.
  // The aim point comes from a raycast onto the ground plane, so the
  // mouse aims where it points in 3D.
  const wantShoot = (actions & ACTION_SHOOT) || (!staging && input.mouse.down);
  if (wantShoot && !player.car) {
    const aim = renderer.pickGround(input.mouse.x, input.mouse.y);
    if (playerShoot(player, aim.x, aim.y, G.bullets, G.audio)) {
      const nearCop = police.cars.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 500);
      if (nearCop) raiseWanted(police, 1, 'shots fired');
      G.peds.forEach((ped) => { if (Math.hypot(ped.x - player.x, ped.y - player.y) < 320) ped.panic = 2; });
    }
  }

  // Enter or exit a car.
  if (actions & ACTION_ENTER_CAR) {
    if (player.car) {
      exitCar(player, G.world);
      G.audio.carDoor();
      G.audio.setEngine(0, false);
    } else {
      const car = nearestStealableCar(player, G.cars);
      if (car) {
        enterCar(player, car, police, G.audio);
        announce(car.kind === 'taxi' ? 'You took a taxi. The meter is not running.' : 'Car stolen. Keep it smooth.');
      }
    }
  }

  if (player.car) {
    const car = player.car;
    const steering = (input.down('KeyA') || input.down('ArrowLeft') || input.down('KeyD') || input.down('ArrowRight'));
    driveCar(car, input, G.world, dt, () => G.audio.crash());
    // The player rides in the car: position and camera follow the car.
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    // Hard cornering at speed leaves skid marks on the asphalt.
    if (steering && Math.abs(car.speed) > 240 && Math.random() < 0.35) {
      G.effects.push({ kind: 'skid', x: car.x, y: car.y, angle: car.angle, life: 5 });
    }
    if (car.destroyed) {
      exitCar(player, G.world);
      if (damagePlayer(player, 20, police)) applyBusted();
      G.effects.push({ kind: 'smoke', x: car.x, y: car.y, life: 1.2 });
    }
    G.audio.setEngine(car.speed, true);
  } else {
    updatePlayer(player, input, G.world, dt, G.audio);
  }

  // Bump into other cars while driving.
  if (player.car) {
    for (const other of G.cars) {
      if (other !== player.car && collideCars(player.car, other)) G.audio.crash();
    }
    for (const cruiser of police.cars) {
      if (collideCars(player.car, cruiser)) G.audio.crash();
    }
  }

  updateTraffic(G.cars, G.world, dt, G.effects, player);
  updatePedestrians(G.peds, G.world, player, G.cars, dt, G.bullets.length ? { x: player.x, y: player.y } : null);
  updatePolice(police, player, G.world, dt, G.effects, () => applyBusted());
  updateEnemies(G.missions, { player, bullets: G.bullets, effects: G.effects, audio: G.audio }, dt);
  G.bullets = updateBullets(G.bullets, {
    player, missions: G.missions, world: G.world, effects: G.effects, police,
  }, dt);

  const missionEvent = updateMissions(G.missions, {
    player, police, cars: G.cars, bullets: G.bullets, effects: G.effects, audio: G.audio, world: G.world, time: G.time,
  }, dt);
  if (missionEvent === 'completed') {
    writeSave(G.missions, player);
    if (allMissionsDone(G.missions)) {
      G.screen = SCREEN_COMPLETE;
    } else {
      announce(G.missions.toast);
    }
  } else if (missionEvent === 'failed') {
    announce(G.missions.toast);
  }

  // The hospital patches Danny up when he stands nearby.
  const hospital = PLACES.hospital;
  if (!player.car && Math.hypot(player.x - hospital.x, player.y - hospital.y) < 140) {
    healPlayer(player, 4 * dt);
  }

  // A wrecked car smokes; a dead player gets busted.
  if (player.health <= 0) {
    applyBusted();
    return;
  }

  G.marker = activeMarker(G.missions);
  updateEffects(dt);
}

let last = performance.now();
function frame(now) {
  const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  let remaining = elapsed;
  while (remaining > 0) {
    const dt = Math.min(STEP, remaining);
    step(dt);
    remaining -= dt;
  }
  paint();
  requestAnimationFrame(frame);
}

// Test hook: advance the simulation by a fixed number of game seconds
// without waiting for real time (headless WebGL renders slowly, so the
// play-test drives the game through this instead of wall-clock waits).
G.advance = (seconds) => {
  const steps = Math.max(1, Math.round(seconds / STEP));
  for (let i = 0; i < steps; i += 1) step(STEP);
  paint();
};

async function boot() {
  const ok = await renderer.ready;
  if (!ok || !renderer.webglOK) {
    announce(`Great Blox Heist could not start 3D: ${renderer.webglError || 'WebGL unavailable'}`);
    window.__webglError = renderer.webglError || 'WebGL unavailable';
    return;
  }
  announce('Great Blox Heist — a blocky open-world crime game in 3D.');
  if (shot) {
    stageShot(G, shot, (dt) => step(dt, true), paint);
  } else {
    requestAnimationFrame(frame);
  }
}

boot();
