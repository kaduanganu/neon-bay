// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// Cars: arcade driving physics, car-to-car bumps and building collisions.
// A car is a plain object the traffic spawner, the police and the player all
// share: { x, y, angle, speed, color, kind, model, driver, health, destroyed }.
// `model` picks the 3D model — sedan, sport, truck, taxi or police — while
// `kind` keeps the old meaning the game logic needs. The 3D renderer maps
// each model to a .glb and tints the body to the car's colour.

import {
  CAR_ACCEL, CAR_BRAKE, CAR_LENGTH, CAR_REVERSE_SPEED, CAR_TOP_SPEED, CAR_WIDTH,
  PALETTE, WORLD_H, WORLD_W,
} from './config.js';
import { buildingAt, inWater, onPier } from './world.js';
import { clamp } from './random.js';

export function makeCar(x, y, angle, opts = {}) {
  const kind = opts.kind || 'sedan';
  return {
    x, y, angle, speed: 0,
    color: opts.color || '#e5322b',
    kind,
    model: opts.model || (kind === 'police' ? 'police' : kind === 'taxi' ? 'taxi' : 'sedan'),
    driver: opts.driver || null,
    health: opts.health || 100,
    destroyed: false,
    parked: !!opts.parked,
    honk: 0,
  };
}

// Cars get unique ids from a factory, so the traffic spawner, the police and
// the player can all tell them apart.
export function createCarFactory() {
  let id = 1;
  return (x, y, angle, opts = {}) => {
    const car = makeCar(x, y, angle, opts);
    car.id = id;
    id += 1;
    return car;
  };
}

// Drive the player's car with the keyboard: W/S throttle and brake/reverse,
// A/D steering that scales with speed, and a handbrake feel at low speed.
export function driveCar(car, input, world, dt, onCrash) {
  if (car.destroyed) return;
  const forward = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');

  if (forward) car.speed += CAR_ACCEL * dt;
  if (back) {
    if (car.speed > 8) car.speed -= CAR_BRAKE * dt;
    else car.speed -= CAR_ACCEL * 0.55 * dt;
  }
  if (!forward && !back) {
    car.speed -= Math.sign(car.speed) * 190 * dt;
    if (Math.abs(car.speed) < 6) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR_REVERSE_SPEED, CAR_TOP_SPEED);

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const grip = clamp(Math.abs(car.speed) / 120, 0, 1);
  car.angle += steer * 2.5 * grip * dt * Math.sign(car.speed || 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (carHitsWall(world, nx, ny, car.angle)) {
    car.speed *= -0.25;
    damageCar(car, 8);
    if (onCrash) onCrash();
  } else {
    car.x = clamp(nx, 30, WORLD_W - 30);
    car.y = clamp(ny, 30, WORLD_H - 30);
  }
}

// A car's corners against buildings and water (the pier is drivable).
export function carHitsWall(world, x, y, angle) {
  const hl = CAR_LENGTH / 2;
  const hw = CAR_WIDTH / 2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (const [ox, oy] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) {
    const px = x + ox * cos - oy * sin;
    const py = y + ox * sin + oy * cos;
    if (inWater(px, py) && !onPier(px, py)) return true;
    if (buildingAt(world, px, py, 0)) return true;
  }
  return false;
}

export function carsOverlap(a, b) {
  return rectOverlap(a, b) !== null;
}

// Two cars overlap if their 48x23 rectangles overlap (a separating-axis
// test on both cars' forward and side axes). A circle check with the
// length as the radius is wrong: two parallel cars 36 apart have a
// 13-unit gap between their bodies, but the circle said they overlapped —
// so a car driving along the sidewalk sideswiped every car in the next
// lane, got shoved into the shop fronts and was destroyed against the
// wall. The test returns the least-penetration axis and depth so the
// collision can push the cars apart along it.
const CAR_HALF_L = CAR_LENGTH / 2;
const CAR_HALF_W = CAR_WIDTH / 2;
function rectOverlap(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const axes = [
    [Math.cos(a.angle), Math.sin(a.angle)],
    [-Math.sin(a.angle), Math.cos(a.angle)],
    [Math.cos(b.angle), Math.sin(b.angle)],
    [-Math.sin(b.angle), Math.cos(b.angle)],
  ];
  let minDepth = Infinity;
  let minAxis = axes[0];
  for (const [ux, uy] of axes) {
    const dist = Math.abs(dx * ux + dy * uy);
    const ea = CAR_HALF_L * Math.abs(Math.cos(a.angle) * ux + Math.sin(a.angle) * uy)
      + CAR_HALF_W * Math.abs(-Math.sin(a.angle) * ux + Math.cos(a.angle) * uy);
    const eb = CAR_HALF_L * Math.abs(Math.cos(b.angle) * ux + Math.sin(b.angle) * uy)
      + CAR_HALF_W * Math.abs(-Math.sin(b.angle) * ux + Math.cos(b.angle) * uy);
    const depth = ea + eb - dist;
    if (depth <= 0) return null;
    if (depth < minDepth) {
      minDepth = depth;
      minAxis = [ux, uy];
    }
  }
  return { axis: minAxis, depth: minDepth };
}

// Push two overlapping cars apart and trade a little speed; returns true on a hit.
export function collideCars(a, b) {
  if (a.destroyed || b.destroyed) return false;
  const hit = rectOverlap(a, b);
  if (!hit) return false;
  // Push apart along the least-penetration axis, a one way and b the other.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let [ux, uy] = hit.axis;
  if (dx * ux + dy * uy < 0) {
    ux = -ux;
    uy = -uy;
  }
  const push = hit.depth / 2 + 0.5;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  const impact = Math.abs(a.speed - b.speed);
  if (impact > 60) {
    damageCar(a, impact * 0.05);
    damageCar(b, impact * 0.05);
  }
  // Share momentum instead of swapping speeds. A swap dead-stops the
  // player behind a stopped car: every frame the player's speed becomes
  // half of ~0, so a traffic jam pins the car forever even with the
  // throttle held down. Averaging lets the player shove the other car
  // along and keep driving.
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg;
  b.speed = avg;
  return true;
}

export function damageCar(car, amount) {
  if (car.destroyed) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.destroyed = true;
    car.speed = 0;
  }
}
