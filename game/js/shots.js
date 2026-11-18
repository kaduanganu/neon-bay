// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session
// (camera framing fix: the chase cruisers sit closer to Danny's bumper
// so both read in the tighter frame, and the pier crew stands closer
// together north of the camera so Danny is unmistakable in the mission
// shot — Danny stands on the east side of the pier, clear of the palm
// at the pier foot, the crew is spread across the boards instead of
// single file, and no muzzle-flash ball is staged, so nothing hides him).
// Staged scenes for screenshots: deterministic setups the capture script
// loads with ?shot=<name>&seed=<n>. Each one builds a real game state, runs
// it a few frames so traffic and police settle, paints it twice and sets
// window.__shotReady so the screenshot lands on a finished frame. Every
// scene is framed like the approved 3D preview: the colourful toy shops
// along the top, Shore Drive across the middle, sand and the bright blue
// bay at the bottom — now in real 3D, with real shadows and depth. The
// camera is a staged override (a fixed 3D follow position), snapped into
// place after the settle so the framing is exact.
//
// Each shot also stages its time of day: the chase and the start screen
// are morning (09:00), the street is night (22:00) so the glowing lamps,
// lit shop windows, headlights, moon and stars show, and the mission is
// dusk (18:30). The clock is set after the settle so the hour is exact.

import { PLACES } from './world.js';
import { raiseWanted } from './police.js';
import { createCarFactory } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

export function stageShot(G, shot, update, paint) {
  const makeCar = createCarFactory();
  const { player, police, missions } = G;

  if (shot === 'start') {
    G.screen = SCREEN_TITLE;
    // Fixed title framing: the strip pans behind the logo, no drift.
    G.camOverride = { cx: 1000, cz: 300, h: 30, d: 44 };
  } else if (shot === 'street') {
    G.screen = SCREEN_PLAY;
    player.x = 1600;
    player.y = 402;
    player.angle = -Math.PI / 4;
    // A busy stretch of Shore Drive: traffic passing both ways,
    // pedestrians on both sidewalks — one in a cap, one in a beanie,
    // one with a smiley shirt, so the Roblox detail shows. The scene is
    // centred 200 east of the garage, so the "Meet Mara" marker sits
    // off-frame and its label is culled.
    for (let i = 0; i < 4; i += 1) {
      const car = makeCar(1400 + i * 160, 402 + (i % 2 === 0 ? 19 : -19), i % 2 === 0 ? 0 : Math.PI, {
        color: ['#e5322b', '#2b7fd9', '#ffc93c', '#58d13d'][i],
        model: ['sedan', 'taxi', 'sport', 'truck'][i],
      });
      car.speed = 120;
      car.cruise = 120;
      G.cars.push(car);
    }
    G.peds.push(
      { x: 1560, y: 348, angle: 0.5, speed: 40, shirt: '#ff5fa2', pants: '#1d2f45', skin: '#e8b98a', hair: '#14161c', hat: 'cap', print: 'stripes', panic: 0, walkPhase: 1, retarget: 2 },
      { x: 1660, y: 456, angle: 2.4, speed: 40, shirt: '#2b7fd9', pants: '#3a2f28', skin: '#c98d5f', hair: '#3a2a1a', hat: 'beanie', print: 'smiley', panic: 0, walkPhase: 2, retarget: 2 },
      { x: 1530, y: 348, angle: -1, speed: 40, shirt: '#ffc93c', pants: '#274e31', skin: '#f2c9a0', hair: '#6e4a1f', hat: 'tophat', print: 'plain', panic: 0, walkPhase: 3, retarget: 2 },
    );
  } else if (shot === 'mission') {
    G.screen = SCREEN_PLAY;
    // Mission 3 in progress: Danny at the foot of the pier, the rival
    // crew ahead on the boards, the bay behind them. Danny stands on
    // the east side of the pier (x 2022), clear of the palm at the pier
    // foot that hid him in the first take; the crew stands close
    // together just south of him, spread across the boards so they do
    // not hide each other in a single file. No muzzle flash is staged:
    // frozen in a screenshot, the flash reads as a pale ball on top of
    // Danny, so the shot shows his bullet tracer instead.
    missions.index = 2;
    missions.state = 'active';
    missions.enemies = [
      { x: 1982, y: 545, health: 60, angle: 0, fireCooldown: 1, speed: 70 },
      { x: 2018, y: 575, health: 45, angle: 0, fireCooldown: 1.6, speed: 70 },
      { x: 1985, y: 605, health: 60, angle: 0, fireCooldown: 0.7, speed: 70 },
      { x: 2015, y: 635, health: 30, angle: 0, fireCooldown: 2.1, speed: 70 },
    ];
    player.x = 2022;
    player.y = 500;
    player.angle = Math.PI / 2;
    player.cash = 840;
    G.bullets.push({
      x: 2022, y: 540, vx: 0, vy: 780, range: 300, damage: 27, fromPlayer: true,
    });
  } else {
    // Default: 'chase' — Danny speeding east down Shore Drive in a
    // stolen car, three stars, two cruisers on his bumper, job 1 on
    // the HUD. The toy shops line the top of the frame and the bright
    // blue bay glints at the bottom, like the 3D preview.
    G.screen = SCREEN_PLAY;
    const car = makeCar(1500, 402, 0, { color: '#e5322b', model: 'sport' });
    car.speed = 380;
    car.cruise = 380;
    car.driver = player;
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    player.cash = 340;
    G.cars.push(car);
    raiseWanted(police, 3, 'chase');
    missions.index = 0;
    missions.state = 'active';
    missions.toast = 'Hot Wheels: bring the car to Solano Garage';
    missions.toastTimer = 10;
  }

  // Let the world settle for a second of simulated time, then paint twice so
  // the canvas holds a finished frame.
  for (let i = 0; i < 60; i += 1) update(1 / 60, true);
  // Stage the time of day after the settle, so the hour is exact: the
  // settle advances the clock a second, and the paint reads G.dayTime.
  // A full day is 300 s from 09:00, so 22:00 is 162.5 s and 18:30 is
  // 118.75 s. Chase and start stay in the morning.
  if (shot === 'street') G.dayTime = 162.5;
  else if (shot === 'mission') G.dayTime = 118.75;
  else G.dayTime = 0;
  // Frame the shot on the player's final position, snapped into place.
  G.camOverride = { cx: player.x, cz: player.y };
  if (shot === 'start') {
    G.camOverride = { cx: 1000, cz: 300, h: 30, d: 44 };
  } else if (shot === 'mission') {
    G.camOverride = { cx: 2000, cz: 540 };
    // The settle ran a full second, so the bullet staged before it is
    // long gone — stage a fresh tracer right before the paint so the
    // mission frame shows Danny firing at the crew.
    G.bullets.push({
      x: 2022, y: 530, vx: 0, vy: 780, range: 300, damage: 27, fromPlayer: true,
    });
    // Put the crosshair on the nearest crew member, so the shot shows
    // Danny aiming down the pier (the mouse never moves in headless).
    G.input.mouse.x = 620;
    G.input.mouse.y = 470;
  } else if (shot === 'street') {
    G.camOverride = { cx: 1600, cz: 400 };
  }
  G.camSnap = true;
  if (shot !== 'start' && shot !== 'mission' && shot !== 'street') {
    // Chase: put the cruisers right on Danny's bumper for the shot.
    // Tight spacing, so both cruisers read inside the closer camera's
    // frame instead of the second one hanging off the left edge.
    G.police.cars.forEach((cruiser, i) => {
      // Spread along the road behind Danny: two lanes, 70 apart, so the
      // cruisers never overlap each other.
      cruiser.x = player.x - 80 - i * 70;
      cruiser.y = player.y + (i === 0 ? -19 : 19);
      cruiser.angle = 0;
      cruiser.speed = 380;
    });
    // The getaway car coasts down with no input during the settle; put
    // the speed back so the HUD reads a proper chase speed. Clear any
    // spark effects the settle left behind — a frozen spark would sit
    // on top of the car in the screenshot.
    if (player.car) player.car.speed = 380;
    G.effects.length = 0;
  }
  paint();
  paint();
  window.__shotReady = true;
}
