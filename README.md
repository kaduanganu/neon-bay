# Great Blox Heist

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/kaduanganu/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/kaduanganu/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Great Blox Heist** is an original 3D open-world crime game in bright Roblox style, built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

Danny Reyes arrives in the sun-soaked beachfront city with $40 and a name to make. Fixer Mara Solano has five jobs for him — steal a getaway car, run a timed delivery to the marina, clear a rival crew off the pier, lose a three-star police manhunt, and finally hit the Bay Trust Bank — if the police let him finish them.

## Real 3D

The game runs in true 3D on vendored three.js r147 (`game/assets3d/vendor/`), with a third-person follow camera behind and above the player, a sun light with real-time soft shadows, sky and fog. The city is built from real `.glb` models (`game/assets3d/`) — every one built in code in a recorded session and exported with GLTFExporter:

- **People are classic Roblox avatars**: big square heads in classic yellow with the classic face — two black dot eyes and a small smile — hair or a hat as a separate brick on top (police caps, red caps, top hats, beanies), torsos with printed shirts (Danny's gold star, a police badge, a smiley, stripes), and blocky arms and legs that bob and tilt while walking.
- **Buildings are real 3D shops**: bright brick facades with bold sign boards (24H, TACOS, HOTEL), striped awnings, glass storefronts with doors, gold handles and welcome mats — and studded roofs with parapet rims and roof features: vents, AC units, antennas, and water towers on legs.
- **Cars are real 3D toy cars**: windshields and side windows with glints, door seams and handles, headlights and taillights, bumpers, wheels with grey hubs, license plates; the police cruiser has black doors, a gold badge and a flashing red/blue light bar; the taxi has checkers and a roof sign; the truck has an open bed with cargo boxes; the sports car has a spoiler.
- **Props are finished too**: palms with ringed trunks and layered canopy leaves, lamps with glowing heads and light pools, slatted benches, flower beds with individual flowers, studded crates, signposts with readable BEACH and PIER signs, red hydrants with caps and side nozzles, and boats bobbing beside the pier.

The city is a beachfront strip: a row of colourful shops along the north edge, a cream sidewalk with lamps, planters and flower beds, then Shore Drive, a grey road with white dashed lane markings and crosswalks, then another sidewalk, sand with pebbles and shells, and the bright blue bay with white wave curls and a pier at the marina. Behind the shops runs Harbor Lane with a second row of buildings, joined by cross avenues.

Gameplay still runs on the same 2D ground-plane coordinates as the earlier 2.5D version — the same map, the same collision, the same missions — only the rendering is 3D.

## The title screen

The first thing you see is a game cover: the real **GREAT BLOX HEIST** logo (`game/assets/logo.png`) over the 3D city panning behind it, a gold subtitle ("A BLOCKY OPEN-WORLD CRIME CAPER"), the story and the five jobs in clean panels, and a pulsing start button.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests: the game is plain static files under `game/` (three.js vendored locally, `.glb` models loaded from relative paths).

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive a car |
| Shift | Run |
| Mouse | Aim (raycast onto the ground) |
| Click / F | Shoot |
| E | Steal a car / leave a car |
| Enter | Start a job at its marker |
| P / Esc | Pause |
| M | Mute |

## Features

- **Open world**: a 3600×1100 beachfront city — Harbor Lane, the shop row, Shore Drive, the beach, the bay and a marina pier — explored on foot and by car, in real 3D.
- **Traffic and pedestrians**: cars cruise the two streets and the cross avenues and slow for the car ahead; pedestrians stroll the sidewalks and scatter from gunfire.
- **Cars to steal**: parked cars and taxis along Harbor Lane and Shore Drive; stealing one in front of the law raises your wanted level.
- **Wanted level**: 0–5 stars. Police cruisers spawn, chase, ram and try to bust you; the heat cools off when you stay out of sight.
- **Five story missions** with a mission tracker, markers, timers, enemy gunmen and cash rewards.
- **Combat**: aim with the mouse, shoot on foot, fight the rival crew on the pier.
- **HUD**: minimap, health, cash, speed, wanted stars and the current objective, in bright rounded toy panels over the 3D view.
- **Day/night cycle**: a full 24-hour day runs in 5 minutes of play, starting at 09:00 — the sun and sky, street lamps, headlights, moon and stars all follow the clock, and a HUD clock pill (sun by day, moon by night) shows the time.
- **Menus and save**: title screen, pause, busted screen, and progress saved to localStorage (continue with C on the title screen).
- **Sound**: synthesized WebAudio effects and a synthwave bass loop — no audio files.

## Layout

```
game/
  index.html        page shell (WebGL canvas + 2D HUD overlay + status line)
  assets/
    logo.png        the GREAT BLOX HEIST title logo
  assets3d/
    *.glb           the 16 real 3D models: characters, cars, shops, props
    vendor/         three.js r147 (three.min.js, GLTFLoader.js) — vendored, exempt
  js/
    config.js       tuning: world, physics, wanted rules, bright toy palette, 3D scale
    random.js       seeded RNG, math helpers, deterministic hash
    world.js        beachfront strip generation, roads, collision, props, lamps
    player.js       Danny on foot, stealing cars, shooting
    vehicles.js     car physics and collisions
    traffic.js      traffic cars and pedestrians
    police.js       wanted level and police cruisers
    missions.js     the five jobs, enemy gunmen, bullets
    hud.js          HUD, minimap, title/pause/busted screens (2D overlay)
    audio.js        synthesized WebAudio SFX and music
    render.js       three.js renderer: scene, ground, models, camera, effects
    input.js        keyboard and mouse
    save.js         localStorage save/load
    shots.js        staged screenshot scenes (?shot=chase|street|mission|start)
    main.js         boot, fixed-step loop, screens
screenshots/        four renders of the game itself
main.ts             hands the entry in (copies game/ + screenshots/, writes dossier.json)
serve.ts            tiny static server for local play
vendor/            make.fun's dossier library (unchanged)
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=kaduanganu&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
