// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// Seeded random numbers (mulberry32) and the small math helpers the
// world generator, the traffic spawner and the police use. One seed builds
// the same city every time, which is what the screenshot scenes rely on.
// tileHash is a separate deterministic hash: given a coordinate and a salt
// it always returns the same 0..1 value, so ground detail is stable across
// runs and across sessions without touching the seeded random stream.

export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    range(min, max) {
      return min + next() * (max - min);
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}

// Deterministic 0..1 hash of integer coordinates plus a salt.
export function tileHash(tx, ty, salt = 0) {
  let h = (Math.imul(tx | 0, 73856093) ^ Math.imul(ty | 0, 19349663) ^ Math.imul(salt | 0, 83492791)) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  // The final XOR is a signed 32-bit operation: without the >>> 0 it can
  // go negative, which used to hand the tile painters negative variants
  // and left whole tiles unpainted (black).
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967296;
}

export function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

// Shortest signed turn from angle a toward angle b.
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
