// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// Traffic and pedestrians: the city alive. Traffic cars cruise the two
// streets and the cross avenues, slow for the car ahead and turn around
// at the end of their road instead of driving into the bay; pedestrians
// stroll the sidewalks, scatter from gunfire and from cars bearing down
// on them. Every pedestrian is a classic Roblox avatar with its own
// bright toy outfit — a printed shirt, trousers, a hair brick or a hat
// (a cap, a beanie, a police cap, a top hat) — so the blocky figures
// never repeat the same face twice in a row. In 3D they are the
// civilian .glb models, tinted to each pedestrian's shirt colour.

import {
  AVENUES, CAR_LENGTH, PALETTE, PED_COUNT, SAND_Y, STREETS, TRAFFIC_COUNT,
  TRAFFIC_SPEED_MAX, TRAFFIC_SPEED_MIN, WORLD_H, WORLD_W,
} from './config.js';
import { createCarFactory } from './vehicles.js';
import { canStand, moveWithCollision } from './world.js';
import { clamp } from './random.js';

const PED_NAMES = ['Rosa', 'Tito', 'Lena', 'Marco', 'Priya', 'Jonah', 'Cleo', 'Dante', 'Mia', 'Felix', 'Ana', 'Rudy'];
const PED_SHIRTS = ['#ff5fa2', '#ffc93c', '#2b7fd9', '#58d13d', '#9b59ff', '#ff7a3c', '#f2f2f2', '#00b5c8'];
const PED_PANTS = ['#1d2f45', '#3a2f28', '#274e31', '#4a2f45', '#222831', '#5b3a8e'];
const PED_SKINS = ['#e8b98a', '#c98d5f', '#8a5a3a', '#f2c9a0'];
const PED_HAIR = ['#14161c', '#3a2a1a', '#6e4a1f', '#8a8a8a', '#ff5fa2', '#2b7fd9'];
// Hats are separate bricks on the head: most pedestrians wear their
// hair, some a cap, a beanie, a police cap, or — rarely — a top hat.
const PED_HATS = ['hair', 'hair', 'hair', 'hair', 'cap', 'cap', 'beanie', 'beanie', 'police', 'tophat'];
// Shirt prints, painted on the torso: stripes, a smiley, or plain.
const PED_PRINTS = ['plain', 'plain', 'stripes', 'smiley', 'stripes'];
const TRAFFIC_MODELS = ['sedan', 'sedan', 'sedan', 'sport', 'truck'];

export function createTraffic(random) {
  const makeCar = createCarFactory();
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    cars.push(spawnTrafficCar(random, makeCar));
  }
  // Parked cars the player can steal, parallel-parked on the sidewalks
  // beside Harbor Lane and Shore Drive — NOT in the driving lanes. (They
  // used to sit in the lanes at street ± 19, where every traffic car
  // behind one braked for it and waited forever: a parked car at (640,146)
  // froze the whole westbound queue on Harbor Lane. On the sidewalk the
  // lane is 35+ clear of them, so traffic flows past and the player can
  // still walk up and steal one.)
  const parkedSpots = [
    { x: 640, y: 110, angle: 0 },
    { x: 560, y: 220, angle: Math.PI },
    { x: 1440, y: 348, angle: 0 },
    { x: 2240, y: 456, angle: Math.PI },
    { x: 1040, y: 110, angle: 0 },
    { x: 3040, y: 348, angle: Math.PI },
  ];
  for (const spot of parkedSpots) {
    const car = makeCar(spot.x, spot.y, spot.angle, {
      color: random.pick(PALETTE.car),
      model: random.pick(TRAFFIC_MODELS),
      parked: true,
    });
    cars.push(car);
  }
  return cars;
}

function spawnTrafficCar(random, makeCar, nearX, nearY) {
  const vertical = random.chance(0.5);
  let x;
  let y;
  let angle;
  // Right-hand traffic: the lane a car uses depends on its direction, so
  // two cars never meet head-on in the same lane. (Before this fix the
  // lane and the direction were picked independently, and two cars in one
  // lane would brake for each other and sit nose-to-nose forever — within
  // ten seconds of starting, 20 of the 26 traffic cars were frozen, and
  // everything behind them queued up. The player driving into such a jam
  // got pinned too.)
  if (vertical) {
    const avenue = random.pick(AVENUES);
    const south = random.chance(0.5);
    angle = south ? Math.PI / 2 : -Math.PI / 2;
    // Southbound cars take the west lane, northbound the east lane.
    x = avenue + (south ? -19 : 19);
    y = random.range(100, SAND_Y - 60);
  } else {
    const street = random.pick(STREETS);
    const east = random.chance(0.5);
    angle = east ? 0 : Math.PI;
    // Eastbound cars take the south lane, westbound the north lane.
    x = random.range(100, WORLD_W - 100);
    y = street + (east ? 19 : -19);
  }
  if (nearX !== undefined) {
    // Respawn out of sight: push the car to a road at least 900 away.
    let tries = 0;
    while (Math.hypot(x - nearX, y - nearY) < 900 && tries < 12) {
      x = random.range(100, WORLD_W - 100);
      y = random.range(100, SAND_Y - 60);
      tries += 1;
    }
  }
  const isTaxi = random.chance(0.12);
  const car = makeCar(x, y, angle, {
    color: isTaxi ? PALETTE.taxi : random.pick(PALETTE.car),
    kind: isTaxi ? 'taxi' : 'sedan',
    model: isTaxi ? 'taxi' : random.pick(TRAFFIC_MODELS),
  });
  car.speed = random.range(TRAFFIC_SPEED_MIN, TRAFFIC_SPEED_MAX);
  car.cruise = car.speed;
  return car;
}

export function updateTraffic(cars, world, dt, effects, player) {
  for (const car of cars) {
    if (car.destroyed || car.parked || car.driver) continue;
    // Ease back to cruising speed and keep to the lane.
    car.speed += (car.cruise - car.speed) * Math.min(1, dt * 1.5);
    const ahead = carAhead(cars, car);
    if (ahead < 90) car.speed = Math.max(0, car.speed - 320 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const vertical = Math.abs(Math.sin(car.angle)) > 0.5;
    if (vertical) {
      // Avenues end at the sand: turn around instead of driving into
      // the bay. Turning around also switches the car to the other lane
      // (mirror across the avenue), which is the correct lane for the
      // new direction — otherwise it would drive head-on into oncoming
      // cars and deadlock again.
      if (ny < 80 || ny > SAND_Y - 40) {
        car.angle += Math.PI;
        const avenue = nearestOf(AVENUES, car.x);
        car.x = avenue - (car.x - avenue);
        car.y = clamp(car.y, 90, SAND_Y - 50);
      } else {
        car.x = nx;
        car.y = ny;
      }
    } else if (nx < 80 || nx > WORLD_W - 80) {
      // Reached the end of a street: turn around at the next junction,
      // switching to the other lane the same way.
      car.angle += Math.PI;
      const street = nearestOf(STREETS, car.y);
      car.y = street - (car.y - street);
      car.x = clamp(car.x, 90, WORLD_W - 90);
    } else {
      car.x = nx;
      car.y = ny;
    }
  }
}

// The road centre-line nearest to a coordinate (a street or an avenue).
function nearestOf(list, v) {
  let best = list[0];
  for (const n of list) {
    if (Math.abs(n - v) < Math.abs(best - v)) best = n;
  }
  return best;
}

// Distance to the nearest car ahead in the same lane, or Infinity.
function carAhead(cars, car) {
  let best = Infinity;
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const carVertical = Math.abs(fy) > 0.5;
  for (const other of cars) {
    if (other === car || other.destroyed) continue;
    const otherVertical = Math.abs(Math.sin(other.angle)) > 0.5;
    // At a crossing, the avenue car yields to the street car: a street
    // car never brakes for a crossing avenue car, so exactly one of the
    // two yields and the intersection clears. (Without this, both cars
    // brake for each other and sit nose-to-nose forever — the whole city
    // gridlocked within a minute, queues spilling onto every road.)
    if (carVertical !== otherVertical && !carVertical) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (along > 0 && along < best && side < 30) best = along;
  }
  return best;
}

export function createPedestrians(random, world) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    // Spawn on walkable ground only: never inside a shop or in the bay.
    let x = 0;
    let y = 0;
    let placed = false;
    for (let tries = 0; tries < 12; tries += 1) {
      const vertical = random.chance(0.5);
      x = vertical ? random.pick(AVENUES) + random.range(-60, 60) : random.range(100, WORLD_W - 100);
      y = vertical ? random.range(100, SAND_Y - 60) : random.pick(STREETS) + random.range(-60, 60);
      if (world && canStand(world, x, y, 10)) { placed = true; break; }
    }
    if (!placed) {
      // Fallback: a junction on Shore Drive, always walkable.
      x = 400;
      y = 402;
    }
    peds.push({
      x, y,
      angle: random.range(0, Math.PI * 2),
      speed: random.range(28, 55),
      name: PED_NAMES[i % PED_NAMES.length],
      shirt: random.pick(PED_SHIRTS),
      pants: random.pick(PED_PANTS),
      skin: random.pick(PED_SKINS),
      hair: random.pick(PED_HAIR),
      hat: random.pick(PED_HATS),
      print: random.pick(PED_PRINTS),
      panic: 0,
      walkPhase: random.range(0, Math.PI * 2),
      retarget: random.range(0, 4),
    });
  }
  return peds;
}

export function updatePedestrians(peds, world, player, cars, dt, gunfire) {
  for (const ped of peds) {
    ped.retarget -= dt;
    // Flee gunfire and cars that come too close.
    let fleeX = 0;
    let fleeY = 0;
    if (gunfire && Math.hypot(ped.x - gunfire.x, ped.y - gunfire.y) < 320) {
      fleeX = ped.x - gunfire.x;
      fleeY = ped.y - gunfire.y;
      ped.panic = 2.5;
    }
    for (const car of cars) {
      if (car.destroyed) continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 70 && Math.abs(car.speed) > 20) {
        fleeX = ped.x - car.x;
        fleeY = ped.y - car.y;
        ped.panic = 1.5;
        break;
      }
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      const len = Math.hypot(fleeX, fleeY) || 1;
      ped.angle = Math.atan2(fleeY / len, fleeX / len);
      const next = moveWithCollision(world, ped.x, ped.y,
        Math.cos(ped.angle) * ped.speed * 2.6 * dt,
        Math.sin(ped.angle) * ped.speed * 2.6 * dt, 10);
      ped.x = next.x;
      ped.y = next.y;
    } else {
      if (ped.retarget <= 0) {
        ped.angle = ped.angle + (Math.random() - 0.5) * 1.6;
        ped.retarget = 2 + Math.random() * 3;
      }
      const next = moveWithCollision(world, ped.x, ped.y,
        Math.cos(ped.angle) * ped.speed * dt,
        Math.sin(ped.angle) * ped.speed * dt, 10);
      ped.x = next.x;
      ped.y = next.y;
    }
    // Stay on dry land: never wander into the bay.
    ped.x = clamp(ped.x, 60, WORLD_W - 60);
    ped.y = clamp(ped.y, 60, SAND_Y - 10);
    ped.walkPhase += dt * (ped.panic > 0 ? 14 : 7);
  }
}
