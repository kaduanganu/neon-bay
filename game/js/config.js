// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session
// (camera framing fix: a tighter follow camera, so the player and the
// chase fill the frame instead of reading as a distant diorama).
// Great Blox Heist tuning: every number the other modules use lives here,
// so the whole game can be rebalanced from this one file. The palette is
// bright Roblox / blocky-toy daylight — vivid saturated colours, grey
// roads with white dashes, tan sand and a bright blue sea — and every
// colour the 3D renderer paints comes from it.
//
// Art direction (true 3D, built from the real .glb models in
// game/assets3d/): the city is a beachfront strip in real 3D — a row of
// brightly coloured shops with readable signs and striped awnings along
// the north edge, a sidewalk, a grey road (Shore Drive) across the middle,
// another sidewalk, then sand and the bright blue bay to the south, with
// a pier at the marina. Behind the shops runs Harbor Lane with a second
// row of buildings; cross avenues join the two streets. The camera is a
// third-person follow camera behind and above the player, like a GTA-style
// 3D game, with a sun light and real-time soft shadows. People are the
// classic Roblox avatars (big square yellow heads, printed shirts) as
// real 3D models; cars are chunky toy cars with light bars, checkers and
// cargo; the ground is 3D geometry — asphalt, slabs, sand, animated sea.
//
// One 2D world unit is SCALE 3D units: the 3600x1100 city is 234x71.5
// 3D units, a character model (~1.95 tall) reads as ~30 world units,
// and a car model (2.47 long) reads as ~38. Gameplay — collision,
// missions, physics — still runs on the exact same 2D ground-plane
// coordinates as the 2.5D game; only the rendering is 3D.

export const WORLD_W = 3600;
export const WORLD_H = 1100;

// One 2D world unit in 3D units.
export const SCALE = 0.065;

// Road grid: avenues run north-south, streets east-west. Harbor Lane is
// the back street (y 165); Shore Drive is the beachfront road (y 402).
export const GRID = 400;
export const ROAD_W = 72;
export const AVENUES = [400, 1200, 2000, 2800, 3400];
export const STREETS = [165, 402];

// Horizontal sidewalk bands (y ranges) the ground builder uses.
export const SIDEWALK_BANDS = [
  [90, 130],
  [200, 240],
  [330, 366],
  [438, 474],
];

// Building rows: the north row behind Harbor Lane, and the beachfront
// shop row facing Shore Drive. Each entry is { y, h }.
export const BUILDING_ROWS = [
  { y: 10, h: 80 },
  { y: 240, h: 90 },
];

// The bay: water along the south edge, sand above it, a pier at the marina.
export const WATER_Y = 528;
export const SAND_Y = 474;
export const PIER_X = 2000;
export const PIER_TOP_Y = 474;

// Follow camera: how far south and how high above the player it sits,
// in 3D units. Tight on purpose: the old wide values (30 high, 44 back)
// turned the whole city into a distant diorama — empty sky on top,
// empty sea at the bottom, the player car a speck. At 9 high and 14
// back the player car and the chase fill the frame, nearby shops, cars
// and pedestrians are readable, and the horizon sits near the top edge
// so almost no sky shows. The camera looks slightly north of the
// player, so the shops read at the top of the frame and the bay at the
// bottom. The title screen keeps the old wide values (see render.js),
// so its framing does not change.
export const CAM_HEIGHT = 9;
export const CAM_DIST = 14;
export const CAM_LOOK_NORTH = 8;

export const STEP = 1 / 60;
export const SAVE_KEY = 'greatbloxheist-save-v1';

// Player on foot.
export const WALK_SPEED = 178;
export const RUN_SPEED = 268;
export const PLAYER_RADIUS = 13;
export const PLAYER_HEALTH = 100;

// Cars.
export const CAR_LENGTH = 48;
export const CAR_WIDTH = 23;
export const CAR_ACCEL = 360;
export const CAR_BRAKE = 640;
export const CAR_TOP_SPEED = 440;
export const CAR_REVERSE_SPEED = 170;
export const CAR_HEALTH = 100;

// Combat.
export const BULLET_SPEED = 780;
export const BULLET_RANGE = 580;
export const BULLET_DAMAGE = 27;
export const FIRE_INTERVAL = 0.22;
export const ENEMY_HEALTH = 60;

// Wanted level.
export const MAX_WANTED = 5;
export const WANTED_DECAY_SECONDS = 22;

// Traffic and pedestrians.
export const TRAFFIC_COUNT = 26;
export const PED_COUNT = 48;
export const TRAFFIC_SPEED_MIN = 95;
export const TRAFFIC_SPEED_MAX = 150;

// Mission rewards, in order.
export const MISSION_REWARDS = [300, 500, 700, 900, 1500];

export const PALETTE = {
  asphalt: '#6b6b6b',
  asphaltLine: '#f2f2f2',
  sidewalk: '#f2e6c9',
  sidewalkEdge: '#d9c9a3',
  grass: '#58d13d',
  grassDark: '#3fb32a',
  sand: '#f7c873',
  water: '#1e9ff0',
  waterDeep: '#1583d8',
  waterGlint: '#bfe9ff',
  // Classic Roblox yellow: every avatar head, and the colour of the
  // studs' glint.
  classicYellow: '#f5cd30',
  // Toy-shop colours, straight from the mockup: teal, pink, yellow,
  // green, purple, orange.
  building: ['#00b5c8', '#ff5fa2', '#ffc93c', '#58d13d', '#9b59ff', '#ff7a3c'],
  roof: ['#0099ab', '#e84a8a', '#f0b41f', '#45b82e', '#8446e8', '#e8662a'],
  palm: '#2fae4e',
  car: ['#e5322b', '#2b7fd9', '#ffc93c', '#f2f2f2', '#222831', '#58d13d', '#ff5fa2', '#ff7a3c'],
  police: '#1c4fd6',
  taxi: '#ffc93c',
  neon: ['#ff2ea6', '#2ee6ff', '#ffd23e', '#7dff6a', '#ff7a3c'],
  // Bold awning stripes: bright colour / white, like the mockup.
  awning: [
    ['#ffc93c', '#ffffff'],
    ['#ff2d55', '#ffffff'],
    ['#ff7a3c', '#ffffff'],
    ['#2e9bff', '#ffffff'],
    ['#9b59ff', '#ffffff'],
  ],
};

export const SIGN_WORDS = ['TACOS', 'HOTEL', 'BAR', '24H', 'PIER', 'NEON', 'CLUB', 'DINER', 'GYM', 'PIZZA', 'BLOX'];

// Day/night cycle: one full 24-hour day lasts DAY_LENGTH_SECONDS of
// play. The game starts at DAY_START_HOUR (09:00, morning), and
// G.dayTime (seconds since the start of the day, advanced only while
// the screen is PLAY) drives the renderer's sun, sky, lamps and
// headlights. dayHourFrom is pure, so the renderer and the tests can
// share the same clock.
export const DAY_LENGTH_SECONDS = 300;
export const DAY_START_HOUR = 9;

export function dayHourFrom(dayTime) {
  return (DAY_START_HOUR + ((dayTime || 0) / DAY_LENGTH_SECONDS) * 24) % 24;
}
