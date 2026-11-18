// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// The city police: a wanted level from 0 to 5 stars, cruisers
// that spawn at the edge of view and chase, ram and try to bust the player,
// and a heat that cools off when the player stays out of sight. Cruisers
// stay on dry land — they wait at the pier's foot instead of driving
// into the bay. In 3D the cruisers are the car-police.glb model, and the
// renderer flashes their red/blue light bars.

import { MAX_WANTED, PALETTE, SAND_Y, WANTED_DECAY_SECONDS, WORLD_H, WORLD_W } from './config.js';
import { createCarFactory } from './vehicles.js';
import { angleDiff, clamp } from './random.js';

const SPAWN_DISTANCE = 700;

export function createPolice() {
  return {
    wanted: 0,
    cars: [],
    decayTimer: 0,
    bustTimer: 0,
    lastHitAt: 0,
    makeCar: createCarFactory(),
    reason: '',
    // Raise the wanted level: missions and car theft call police.raise(n).
    raise(stars, reason) { raiseWanted(this, stars, reason); },
  };
}

export function raiseWanted(police, stars, reason) {
  police.wanted = clamp(police.wanted + stars, 0, MAX_WANTED);
  police.decayTimer = WANTED_DECAY_SECONDS;
  police.bustTimer = 0;
  if (reason) police.reason = reason;
}

export function clearWanted(police) {
  police.wanted = 0;
  police.cars = [];
  police.decayTimer = 0;
  police.bustTimer = 0;
}

function spawnCruiser(police, player) {
  // Appear off-screen in a random direction from the player, on dry land.
  const angle = Math.random() * Math.PI * 2;
  const x = clamp(player.x + Math.cos(angle) * SPAWN_DISTANCE, 90, WORLD_W - 90);
  const y = clamp(player.y + Math.sin(angle) * SPAWN_DISTANCE, 90, SAND_Y - 10);
  const car = police.makeCar(x, y, Math.atan2(player.y - y, player.x - x), {
    color: PALETTE.police,
    kind: 'police',
    model: 'police',
  });
  car.cruise = 330;
  police.cars.push(car);
  return car;
}

// How many cruisers the wanted level calls for.
function wantedCruisers(wanted) {
  if (wanted <= 0) return 0;
  if (wanted <= 1) return 1;
  if (wanted <= 2) return 2;
  if (wanted <= 3) return 3;
  if (wanted <= 4) return 4;
  return 5;
}

export function updatePolice(police, player, world, dt, effects, onBusted) {
  const target = wantedCruisers(police.wanted);
  while (police.cars.length < target) spawnCruiser(police, player);
  while (police.cars.length > target) police.cars.pop();

  if (police.wanted > 0) {
    police.decayTimer -= dt;
    if (police.decayTimer <= 0) {
      police.wanted = Math.max(0, police.wanted - 1);
      police.decayTimer = WANTED_DECAY_SECONDS;
      if (police.wanted === 0) police.cars = [];
    }
  }

  let nearest = Infinity;
  for (const cruiser of police.cars) {
    const dx = player.x - cruiser.x;
    const dy = player.y - cruiser.y;
    const d = Math.hypot(dx, dy);
    nearest = Math.min(nearest, d);
    // Steer toward the player, faster than traffic, with a little wobble.
    const want = Math.atan2(dy, dx) + Math.sin(player.x * 0.01 + cruiser.id) * 0.05;
    cruiser.angle += clamp(angleDiff(cruiser.angle, want), -2.4 * dt, 2.4 * dt);
    const top = 300 + police.wanted * 28;
    cruiser.speed += (top - cruiser.speed) * Math.min(1, dt * 1.2);
    cruiser.x += Math.cos(cruiser.angle) * cruiser.speed * dt;
    cruiser.y += Math.sin(cruiser.angle) * cruiser.speed * dt;
    // Stay on dry land: the sand's edge is as far south as a cruiser goes.
    cruiser.x = clamp(cruiser.x, 40, WORLD_W - 40);
    cruiser.y = clamp(cruiser.y, 40, SAND_Y - 10);
    // Ram: a hard hit hurts the player and shakes the camera.
    if (d < 52) {
      const push = 52 - d;
      const ux = dx / (d || 1);
      const uy = dy / (d || 1);
      if (player.car) {
        player.car.x += ux * push * 0.5;
        player.car.y += uy * push * 0.5;
        player.car.speed *= 0.55;
        cruiser.speed *= 0.4;
      } else {
        player.x += ux * push;
        player.y += uy * push;
      }
      if (effects) effects.push({ kind: 'spark', x: player.x, y: player.y, vx: ux * 120, vy: uy * 120, life: 0.4 });
    }
  }

  // Busted: on foot and a cruiser sits on top of the player, or the player is
  // slow in a car with a cruiser glued to the door.
  if (police.wanted > 0 && nearest < 46) {
    const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
    const onFoot = !player.car;
    if (onFoot || playerSpeed < 40) {
      police.bustTimer += dt;
      if (police.bustTimer > 1.6 && onBusted) onBusted();
    } else {
      police.bustTimer = 0;
    }
  } else {
    police.bustTimer = 0;
  }
  return nearest;
}
