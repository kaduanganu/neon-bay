// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// Danny Reyes on foot: walk and run, health, cash, entering and leaving
// cars, and shooting toward the mouse. The player object is the one thing
// every other module reads, so it stays small and plain. Danny is a
// classic Roblox avatar — a big square yellow head with the classic
// face, a teal shirt with a gold star print, dark jeans, dark hair — so
// he is easy to spot among the pedestrians. In 3D he is the danny.glb
// model; the renderer bobs and tilts it while he walks.

import {
  BULLET_DAMAGE, BULLET_RANGE, BULLET_SPEED, CAR_LENGTH, FIRE_INTERVAL,
  PLAYER_HEALTH, PLAYER_RADIUS, RUN_SPEED, WALK_SPEED,
} from './config.js';
import { moveWithCollision } from './world.js';
import { damageCar } from './vehicles.js';
import { clamp } from './random.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    health: PLAYER_HEALTH,
    cash: 40,
    car: null,
    fireCooldown: 0,
    invulnerable: 0,
    moving: false,
    running: false,
    walkPhase: 0,
  };
}

export function updatePlayer(player, input, world, dt, audio) {
  const axis = input.axis();
  const running = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = running ? RUN_SPEED : WALK_SPEED;
  player.running = running && (axis.x !== 0 || axis.y !== 0);
  player.moving = axis.x !== 0 || axis.y !== 0;
  if (player.moving) {
    const len = Math.hypot(axis.x, axis.y) || 1;
    const dx = (axis.x / len) * speed * dt;
    const dy = (axis.y / len) * speed * dt;
    const next = moveWithCollision(world, player.x, player.y, dx, dy, PLAYER_RADIUS);
    player.x = next.x;
    player.y = next.y;
    player.angle = Math.atan2(dy, dx);
    player.walkPhase += dt * (running ? 13 : 8);
  }
  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (audio) audio.setFootsteps(player.moving, player.running);
}

export function damagePlayer(player, amount, police) {
  if (player.invulnerable > 0) return false;
  player.health = clamp(player.health - amount, 0, PLAYER_HEALTH);
  player.invulnerable = 0.4;
  if (police && amount > 0) police.lastHitAt = 0;
  return player.health <= 0;
}

export function healPlayer(player, amount) {
  player.health = clamp(player.health + amount, 0, PLAYER_HEALTH);
}

// The nearest parked or driverless car close enough to steal.
export function nearestStealableCar(player, cars) {
  let best = null;
  let bestD = 70;
  for (const car of cars) {
    if (car.destroyed || car.driver) continue;
    const d = Math.hypot(car.x - player.x, car.y - player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(player, car, police, audio) {
  player.car = car;
  car.driver = player;
  car.parked = false;
  player.x = car.x;
  player.y = car.y;
  if (audio) audio.carDoor();
  // Stealing a car in front of the law is a crime.
  if (police) {
    const nearCop = police.cars.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 420);
    if (nearCop) police.raise(1, 'car theft');
    else if (police.wanted === 0 && Math.random() < 0.25) police.raise(1, 'car theft');
  }
}

export function exitCar(player, world) {
  const car = player.car;
  if (!car) return;
  car.driver = null;
  const side = { x: player.x - Math.sin(car.angle) * (CAR_LENGTH / 2 + 22), y: player.y + Math.cos(car.angle) * (CAR_LENGTH / 2 + 22) };
  const spot = moveWithCollision(world, car.x, car.y, side.x - car.x, side.y - car.y, PLAYER_RADIUS);
  player.x = spot.x;
  player.y = spot.y;
  player.car = null;
}

export function playerShoot(player, targetX, targetY, bullets, audio) {
  if (player.fireCooldown > 0 || player.car) return false;
  player.fireCooldown = FIRE_INTERVAL;
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  player.angle = angle;
  bullets.push({
    x: player.x + Math.cos(angle) * 20,
    y: player.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    range: BULLET_RANGE,
    damage: BULLET_DAMAGE,
    fromPlayer: true,
  });
  if (audio) audio.shot();
  return true;
}

export function playerColor() {
  return '#2ec4b6';
}
