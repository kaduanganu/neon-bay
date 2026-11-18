// Great Blox Heist — full 3D rebuild of the entrypoint for make.fun
// bounty gta6-01. Rewritten 18 Nov 2026 in the recorded Great Blox Heist
// 3D session: the same open-world crime game, now in true 3D on vendored
// three.js r147 — a third-person follow camera, sun light with real-time
// soft shadows, and the city built from real .glb models (characters,
// cars, shops, props) made in the recorded 3D asset session, plus the
// real title logo PNG. The same 5 missions, the same beachfront strip,
// the same ground-plane coordinates and collision — only the rendering
// is 3D. The game runs entirely offline from static files in game/
// (game/index.html + ES modules + vendored three.js + .glb models, no
// network requests). This program is the submission entrypoint: it copies
// game/ and screenshots/ to /output and writes dossier.json via the
// vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Determinism requirement: this build must produce byte-identical output
// on repeated runs, so the dossier hash is stable across runs.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, DOSSIER_CAPS),
);
