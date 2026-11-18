// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// The city: a beachfront strip. From north to south: a row of bright toy
// buildings behind Harbor Lane, Harbor Lane itself, a plaza strip, the
// beachfront shop row facing Shore Drive, the north sidewalk, Shore Drive
// across the middle, the south sidewalk, sand, and the bright blue bay
// with a pier at the marina. Cross avenues join the two streets.
// Everything is generated from the seeded random, so the same seed builds
// the same city. Buildings carry a bold sign word and colour and a striped
// awning, and a roof feature — a vent, an antenna, or a water tower —
// and the streets hold street props — flower beds along the sidewalks,
// planters, benches, crates, bushes, rocks and shells on the sand — pure
// decoration the renderer builds, so the world feels full wherever the
// camera looks. Collision helpers answer the one question the rest of the
// game asks: can a thing stand (or drive) at this point?
//
// The ground plane is unchanged by the 3D rebuild: a building's rect is
// its ground footprint, and the 3D model is scaled to fit it, so collision
// still reads the same rects.

import {
  AVENUES, BUILDING_ROWS, GRID, PALETTE, PIER_TOP_Y, PIER_X, ROAD_W,
  SAND_Y, SIGN_WORDS, STREETS, WATER_Y, WORLD_H, WORLD_W,
} from './config.js';
import { clamp } from './random.js';

export const PLACES = {
  garage: { x: 520, y: 165, label: 'Solano Garage' },
  hideout: { x: 3300, y: 165, label: 'Hideout' },
  pier: { x: PIER_X, y: 600, label: 'Marina Pier' },
  bank: { x: 2600, y: 348, label: 'Bay Trust Bank' },
  marina: { x: 2150, y: 620, label: 'Marina' },
  plaza: { x: 1200, y: 402, label: 'Neon Plaza' },
  hospital: { x: 1400, y: 165, label: 'St. Coral Hospital' },
  beach: { x: 1000, y: 500, label: 'Coral Beach' },
};

export function createWorld(random) {
  const buildings = [];
  const palms = [];
  const lamps = [];
  const props = [];

  // Two building rows (north row, shop row): two or three buildings per
  // block, kept clear of the avenues. A building's rect is its ground
  // footprint; the 3D shop model is scaled to fit it.
  for (const row of BUILDING_ROWS) {
    for (let ax = 0; ax < AVENUES.length - 1; ax += 1) {
      const x0 = AVENUES[ax] + ROAD_W / 2 + 14;
      const x1 = AVENUES[ax + 1] - ROAD_W / 2 - 14;
      const count = random.chance(0.5) ? 3 : 2;
      for (let i = 0; i < count; i += 1) {
        const w = random.range(90, 160);
        const h = row.h;
        const bx = count === 1
          ? (x0 + x1) / 2 - w / 2
          : x0 + 8 + i * ((x1 - x0 - w - 8) / Math.max(1, count - 1));
        const by = row.y;
        const color = random.pick(PALETTE.building);
        const roof = random.pick(PALETTE.roof);
        buildings.push({
          x: bx, y: by, w, h, color, roof,
          sign: random.pick(SIGN_WORDS),
          signColor: random.pick(PALETTE.neon),
          awning: random.pick(PALETTE.awning),
          awningStyle: random.int(0, 2),
          // Roof feature — a vent, an antenna, or a water tower on legs.
          roofFeature: random.pick(['vent', 'vent', 'vent', 'antenna', 'tower']),
        });
        // Planters and crates hug the building walls, on the sidewalk
        // in front of the shop row, inside the block for the north row.
        if (row.y > 200) {
          if (random.chance(0.7)) {
            props.push({ kind: 'planter', x: bx + random.range(0, w - 16), y: by + h + 4, v: random.int(0, 1) });
          }
          if (random.chance(0.5)) {
            props.push({ kind: 'crate', x: bx - 20, y: by + random.range(10, h - 26), v: 0 });
          }
        } else if (random.chance(0.4)) {
          props.push({ kind: 'bush', x: bx + w + 6, y: by + random.range(8, h - 24), v: random.int(0, 1) });
        }
      }
      // Flower beds line the sidewalk in front of the shop row.
      if (row.y > 200) {
        const bedY = row.y + row.h + 4;
        for (let bx = x0 + 10; bx < x1 - 48; bx += 64) {
          if (random.chance(0.65)) {
            props.push({ kind: 'flowerbed', x: bx, y: bedY, v: random.int(0, 1) });
          }
        }
      }
    }
  }

  // Benches on the plaza strip between Harbor Lane and the shop row.
  for (let x = 300; x < WORLD_W - 200; x += 420) {
    if (random.chance(0.6)) {
      props.push({ kind: 'bench', x: x + random.range(0, 120), y: 208, v: 0 });
    }
    if (random.chance(0.5)) {
      props.push({ kind: 'bush', x: x + random.range(0, 160), y: 212, v: random.int(0, 1) });
    }
  }

  // Palms on the sand and a few in planters along the south sidewalk.
  for (let x = 120; x < WORLD_W - 100; x += 110) {
    if (random.chance(0.7)) palms.push({ x: x + random.range(-20, 20), y: SAND_Y + random.range(8, 44) });
  }
  for (let x = 500; x < WORLD_W - 200; x += 500) {
    if (random.chance(0.6)) palms.push({ x: x + random.range(-30, 30), y: 446 });
  }

  // Rocks and shells scattered on the sand.
  for (let x = 80; x < WORLD_W - 80; x += 70) {
    if (random.chance(0.4)) props.push({ kind: 'rock', x: x + random.range(-16, 16), y: SAND_Y + random.range(10, 44), v: 0 });
    if (random.chance(0.35)) props.push({ kind: 'shell', x: x + random.range(-16, 16), y: SAND_Y + random.range(6, 46), v: random.int(0, 2) });
  }

  // Street lamps along both sidewalks of Shore Drive and Harbor Lane.
  for (let x = 200; x < WORLD_W - 100; x += 200) {
    lamps.push({ x, y: 348 });
    lamps.push({ x: x + 100, y: 456 });
    if (x % 400 === 0) lamps.push({ x, y: 148 });
  }

  // Signposts and hydrants at the junctions.
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      if (random.chance(0.6)) {
        props.push({ kind: 'signpost', x: ax - ROAD_W / 2 - 14, y: sy - ROAD_W / 2 - 14, v: random.int(0, 1) });
      }
      if (random.chance(0.4)) {
        props.push({ kind: 'hydrant', x: ax + ROAD_W / 2 + 14, y: sy + ROAD_W / 2 + 14, v: 0 });
      }
    }
  }
  return { buildings, palms, lamps, props, places: PLACES };
}

export function onRoad(x, y) {
  const half = ROAD_W / 2;
  for (const ax of AVENUES) {
    // Avenues run from the north edge down to the sand.
    if (Math.abs(x - ax) <= half && y < SAND_Y) return true;
  }
  for (const sy of STREETS) if (Math.abs(y - sy) <= half) return true;
  return false;
}

export function inWater(x, y) {
  return y >= WATER_Y;
}

export function onPier(x, y) {
  return Math.abs(x - PIER_X) <= 34 && y >= PIER_TOP_Y && y <= WATER_Y + 220;
}

export function buildingAt(world, x, y, pad = 0) {
  for (const b of world.buildings) {
    if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return b;
  }
  return null;
}

// True when a circle of the given radius can sit at (x, y): not inside a
// building, not in the water (unless it is on the pier), inside the world.
export function canStand(world, x, y, radius = 10) {
  if (x < radius || y < radius || x > WORLD_W - radius || y > WORLD_H - radius) return false;
  if (inWater(x, y) && !onPier(x, y)) return false;
  return !buildingAt(world, x, y, radius);
}

// Slide a moving circle along walls: try the full step, then each axis alone.
export function moveWithCollision(world, x, y, dx, dy, radius) {
  const nx = x + dx;
  const ny = y + dy;
  if (canStand(world, nx, ny, radius)) return { x: nx, y: ny };
  if (canStand(world, nx, y, radius)) return { x: nx, y };
  if (canStand(world, x, ny, radius)) return { x, y: ny };
  return { x, y };
}

// Nearest point on a road to (x, y): used to snap spawned cars onto asphalt.
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y: clamp(y, 60, SAND_Y - 60) }; }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 60, WORLD_W - 60), y: sy }; }
  }
  return best;
}
