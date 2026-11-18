// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session
// (camera framing fix: the toast and controls moved up, so the bottom
// of the screen is a clean vertical stack — toast, controls, then the
// HTML status pill — and the pill can never overlap the controls bar).
// The HUD and the menus, drawn on the 2D overlay canvas over the 3D
// world: health and cash, wanted stars, speed, the mission objective, the
// minimap, toasts, and the title, pause, busted and complete screens.
// Roblox style: bright rounded toy panels, bold rounded type, vivid pink
// and yellow accents on clean white and dark navy. The minimap paints
// the same beachfront strip in miniature — bright green blocks, grey
// roads, the blue bay and the pier.
//
// The title screen is a game cover: the real GREAT BLOX HEIST logo
// (game/assets/logo.png, made in the recorded asset session) over the
// panning 3D city, a gold subtitle, the story and the five jobs in clean
// panels, and a pulsing start button. The title is set in solid
// Roblox-style square letters on ONE line — thick stroked vector
// letterforms with softly rounded corners and a slight forward slant,
// a dark outline and a darker 3D extrusion offset down-right, like the
// Roblox logo lettering: GREAT in yellow, BLOX in pink, HEIST in cyan,
// letters bounced and tilted a little so it reads playful. The same
// Roblox-style letters are drawn live by robloxText() for the title
// fallback, the complete screen and BUSTED, so the title treatment is
// one design everywhere. The bottom of the title screen is a strict
// stack with real gaps — controls, then the start button, then the
// credit line, then the HTML status pill — so nothing overlaps.

import {
  AVENUES, MAX_WANTED, PIER_X, PIER_TOP_Y, SAND_Y, STREETS, WATER_Y,
  WORLD_H, WORLD_W,
} from './config.js';
import { dayHourFrom } from './config.js';
import { MISSION_DEFS, currentMission, missionObjective } from './missions.js';
import { allMissionsDone } from './missions.js';

const MINI_W = 210;
const MINI_H = 64;
const FONT = '"Trebuchet MS", Verdana, sans-serif';

// The day/night clock as HH:MM, 24-hour, from the day-cycle time.
function formatClock(G) {
  const hour = dayHourFrom(G.dayTime);
  const hh = Math.floor(hour);
  const mm = Math.floor((hour - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// Night is 18:30–05:30, matching the renderer's night.
function isNightHour(hour) {
  return hour < 5.5 || hour >= 18.5;
}

export function drawHUD(G, renderer) {
  const { ctx, view } = renderer;
  const { player, police } = G;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash and health.
  panel(ctx, 14, 12, 210, 64, '#ffd23e');
  ctx.fillStyle = '#1d7a33';
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText(`$${Math.floor(player.cash).toLocaleString('en-US')}`, 28, 42);
  ctx.fillStyle = '#d9d9d9';
  ctx.fillRect(28, 52, 150, 10);
  ctx.fillStyle = player.health > 30 ? '#37d67a' : '#e0392b';
  ctx.fillRect(28, 52, 150 * Math.max(0, player.health / 100), 10);
  ctx.fillStyle = '#14161c';
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText(`HP ${Math.ceil(player.health)}`, 184, 61);

  // Top-centre: wanted stars.
  const starW = 30;
  const totalW = MAX_WANTED * starW;
  const sx = (view.w - totalW) / 2;
  ctx.font = `26px ${FONT}`;
  ctx.textAlign = 'center';
  for (let i = 0; i < MAX_WANTED; i += 1) {
    ctx.fillStyle = i < police.wanted ? '#ffd23e' : 'rgba(255,255,255,0.45)';
    ctx.fillText('★', sx + i * starW + starW / 2, 44);
  }
  if (police.wanted > 0) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText('POLICE ON YOUR TAIL', view.w / 2, 70);
  }
  ctx.textAlign = 'left';

  // Top-right: speed, only when driving.
  if (player.car) {
    panel(ctx, view.w - 154, 12, 140, 52, '#2ee6ff');
    ctx.fillStyle = '#14161c';
    ctx.font = `bold 26px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(player.car.speed) * 0.32)}`, view.w - 62, 44);
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillStyle = '#e84a8a';
    ctx.fillText('km/h', view.w - 24, 44);
    ctx.textAlign = 'left';
  }

  // Top-right: the day/night clock pill — a sun icon by day, a moon
  // icon at night, plus the time as HH:MM. On foot it takes the same
  // slot the speed panel uses when driving (y 12); when driving it
  // sits directly below the speed panel (y 12..64), so it never
  // overlaps anything.
  const dayHour = dayHourFrom(G.dayTime);
  const night = isNightHour(dayHour);
  const clockY = player.car ? 76 : 12;
  panel(ctx, view.w - 154, clockY, 140, 40, night ? '#2d7dff' : '#ffd23e');
  ctx.fillStyle = '#14161c';
  ctx.font = `bold 16px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${night ? '☾' : '☀'} ${formatClock(G)}`, view.w - 84, clockY + 27);
  ctx.textAlign = 'left';

  // Mission objective, under the cash panel. The header line is drawn
  // chunky — a dark outline around heavy type — so the job title reads
  // as a blocky toy label, like the title screen lettering.
  const def = currentMission(G.missions);
  panel(ctx, 14, 86, 430, 44, '#ff5fa2');
  ctx.fillStyle = '#e84a8a';
  ctx.font = `bold 14px ${FONT}`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(20,22,28,0.55)';
  ctx.lineWidth = 3;
  const headText = def ? `JOB ${G.missions.index + 1}/5 — ${def.title}` : 'GREAT BLOX HEIST';
  ctx.strokeText(headText, 28, 104);
  ctx.fillText(headText, 28, 104);
  ctx.fillStyle = '#14161c';
  ctx.font = `13px ${FONT}`;
  ctx.fillText(missionObjective(G.missions), 28, 122);

  // Toast under the objective, lifted 40 px above its old spot: the
  // bottom of the screen is now a strict vertical stack — toast, then
  // the controls bar, then the HTML #status pill at the very bottom —
  // so the toast, the controls and the pill can never overlap each
  // other at any window width.
  if (G.missions.toastTimer > 0 && G.missions.toast) {
    const tw = Math.min(640, ctx.measureText(G.missions.toast).width + 32);
    panel(ctx, (view.w - tw) / 2, view.h - 148, tw, 36, '#ffd23e');
    ctx.fillStyle = '#14161c';
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(G.missions.toast, view.w / 2, view.h - 124);
    ctx.textAlign = 'left';
  }

  // Bottom-left: controls reminder, lifted 40 px above its old spot so
  // it sits clear above the HTML #status pill (bottom: 10 px) at every
  // window width — vertical separation, never horizontal luck.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  roundRect(ctx, 14, view.h - 84, 330, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#14161c';
  ctx.font = `12px ${FONT}`;
  ctx.fillText('WASD move/drive · E steal car · Click shoot · P pause · M mute', 24, view.h - 64);

  drawMinimap(G, renderer);
  drawCrosshair(G, renderer);
  ctx.restore();
}

// A bright toy panel: white fill, thick coloured edge, rounded corners.
function panel(ctx, x, y, w, h, edge) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 3;
  roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 8);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function drawMinimap(G, renderer) {
  const { ctx, view } = renderer;
  const x0 = view.w - MINI_W - 14;
  const y0 = view.h - MINI_H - 14;
  const sx = MINI_W / WORLD_W;
  const sy = MINI_H / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  roundRect(ctx, x0 - 4, y0 - 4, MINI_W + 8, MINI_H + 8, 10);
  ctx.fill();
  ctx.strokeStyle = '#2ee6ff';
  ctx.lineWidth = 3;
  roundRect(ctx, x0 - 4, y0 - 4, MINI_W + 8, MINI_H + 8, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x0, y0, MINI_W, MINI_H);
  ctx.clip();
  ctx.fillStyle = '#58d13d';
  ctx.fillRect(x0, y0, MINI_W, MINI_H);
  // Water and sand.
  ctx.fillStyle = '#1e9ff0';
  ctx.fillRect(x0, y0 + WATER_Y * sy, MINI_W, MINI_H - WATER_Y * sy);
  ctx.fillStyle = '#f7c873';
  ctx.fillRect(x0, y0 + SAND_Y * sy, MINI_W, (WATER_Y - SAND_Y) * sy);
  // Roads: grey.
  ctx.fillStyle = '#6b6b6b';
  for (const ax of AVENUES) ctx.fillRect(x0 + ax * sx - 2, y0, 4, MINI_H);
  for (const sy2 of STREETS) ctx.fillRect(x0, y0 + sy2 * sy - 2, MINI_W, 4);
  // Pier.
  ctx.fillStyle = '#c9a06a';
  ctx.fillRect(x0 + PIER_X * sx - 2, y0 + PIER_TOP_Y * sy, 4, MINI_H - PIER_TOP_Y * sy);
  // Mission marker.
  if (G.marker) {
    const pulse = 1 + Math.sin(G.time * 5) * 0.3;
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.arc(x0 + G.marker.x * sx, y0 + G.marker.y * sy, 5 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#2d7dff';
  for (const cruiser of G.police.cars) {
    ctx.beginPath();
    ctx.arc(x0 + cruiser.x * sx, y0 + cruiser.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player: a white dot with a dark ring, always on top.
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + G.player.x * sx, y0 + G.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  // North arrow.
  ctx.fillStyle = '#14161c';
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText('N', x0 + MINI_W - 12, y0 + 14);
  ctx.restore();
}

function drawCrosshair(G, renderer) {
  if (G.player.car || G.screen !== 'play') return;
  const { ctx } = renderer;
  const { x, y } = G.input.mouse;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 13, y);
  ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 13, y);
  ctx.moveTo(x, y - 13);
  ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x, y + 13);
  ctx.stroke();
}

function dimScreen(renderer, alpha) {
  const { ctx, view } = renderer;
  ctx.fillStyle = `rgba(6,8,16,${alpha})`;
  ctx.fillRect(0, 0, view.w, view.h);
}

function centreText(ctx, view, y, text, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, view.w / 2, y);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------------
// Roblox-style square letters: the title font, drawn as thick stroked
// vector paths — NOT made of little cubes and NOT a pixel grid. Each
// letter is a solid chunky letterform with softly rounded corners (round
// caps and joins), drawn with a thick dark outline and a darker 3D
// extrusion offset down-right, like the Roblox logo lettering. The whole
// line leans slightly forward and letters bounce and tilt a little, so
// it reads playful. The same font drives the logo PNG (see
// shot-tools/gta6-logo-export.mjs and /tmp/great-logo/render.html) and
// the live titles here. Glyphs live in a 100-unit em (cap height 100,
// stroke 24); 'R' is a rounded-rect ring, the rest are stroked paths.
// ---------------------------------------------------------------------------
const ROBLOX_FONT = {
  A: { w: 92, segs: [[['M', 10, 98], ['L', 46, 6], ['L', 82, 98]], [['M', 28, 64], ['L', 64, 64]]] },
  B: { w: 80, segs: [[['M', 10, 98], ['L', 10, 6]], [['M', 10, 6], ['L', 42, 6], ['A', 42, 23, 17, -1.5708, 1.5708, false], ['L', 10, 40]], [['M', 10, 40], ['L', 44, 40], ['A', 44, 69, 29, -1.5708, 1.5708, false], ['L', 10, 98]]] },
  C: { w: 86, segs: [[['M', 70, 20], ['A', 46, 50, 38, -1.0, 1.0, true]]] },
  D: { w: 88, segs: [[['M', 10, 98], ['L', 10, 6]], [['M', 10, 6], ['L', 42, 6], ['A', 42, 50, 44, -1.5708, 1.5708, false], ['L', 10, 94]]] },
  E: { w: 82, segs: [[['M', 10, 98], ['L', 10, 6]], [['M', 10, 6], ['L', 74, 6]], [['M', 10, 50], ['L', 62, 50]], [['M', 10, 98], ['L', 74, 98]]] },
  F: { w: 76, segs: [[['M', 10, 98], ['L', 10, 6]], [['M', 10, 6], ['L', 70, 6]], [['M', 10, 50], ['L', 60, 50]]] },
  G: { w: 86, segs: [[['M', 78, 30], ['A', 46, 50, 38, -0.9, 1.2, true]], [['M', 46, 60], ['L', 80, 60]]] },
  H: { w: 88, segs: [[['M', 10, 98], ['L', 10, 6]], [['M', 78, 98], ['L', 78, 6]], [['M', 10, 50], ['L', 78, 50]]] },
  I: { w: 40, segs: [[['M', 20, 98], ['L', 20, 6]]] },
  J: { w: 78, segs: [[['M', 68, 6], ['L', 68, 72], ['C', 68, 90, 54, 96, 42, 94], ['C', 32, 92, 24, 86, 20, 76]]] },
  K: { w: 84, segs: [[['M', 10, 98], ['L', 10, 6]], [['M', 58, 6], ['L', 16, 50]], [['M', 34, 46], ['L', 76, 98]]] },
  L: { w: 76, segs: [[['M', 10, 98], ['L', 10, 6]], [['M', 10, 98], ['L', 70, 98]]] },
  M: { w: 90, segs: [[['M', 8, 98], ['L', 8, 6], ['L', 45, 54], ['L', 82, 6], ['L', 82, 98]]] },
  N: { w: 88, segs: [[['M', 10, 98], ['L', 10, 6], ['L', 78, 98], ['L', 78, 6]]] },
  O: { w: 88, segs: [[['R', 4, 6, 80, 88, 22]]] },
  P: { w: 72, segs: [[['M', 10, 98], ['L', 10, 6]], [['M', 10, 6], ['L', 42, 6], ['A', 42, 25, 19, -1.5708, 1.5708, false], ['L', 10, 44]]] },
  Q: { w: 88, segs: [[['R', 4, 6, 80, 88, 22]], [['M', 56, 70], ['L', 82, 96]]] },
  R: { w: 84, segs: [[['M', 10, 98], ['L', 10, 6]], [['M', 10, 6], ['L', 42, 6], ['A', 42, 25, 19, -1.5708, 1.5708, false], ['L', 10, 44]], [['M', 34, 44], ['L', 76, 98]]] },
  S: { w: 82, segs: [[['M', 68, 24], ['C', 58, 6, 30, 4, 20, 22], ['C', 12, 38, 28, 48, 44, 50], ['C', 60, 52, 76, 60, 72, 76], ['C', 68, 92, 40, 96, 26, 86]]] },
  T: { w: 88, segs: [[['M', 6, 6], ['L', 82, 6]], [['M', 44, 6], ['L', 44, 98]]] },
  U: { w: 88, segs: [[['M', 10, 6], ['L', 10, 66], ['C', 10, 92, 78, 92, 78, 66], ['L', 78, 6]]] },
  V: { w: 88, segs: [[['M', 8, 6], ['L', 44, 98], ['L', 80, 6]]] },
  W: { w: 90, segs: [[['M', 6, 6], ['L', 22, 98], ['L', 45, 34], ['L', 68, 98], ['L', 84, 6]]] },
  X: { w: 88, segs: [[['M', 8, 6], ['L', 80, 98]], [['M', 80, 6], ['L', 8, 98]]] },
  Y: { w: 88, segs: [[['M', 8, 6], ['L', 44, 50], ['L', 80, 6]], [['M', 44, 50], ['L', 44, 98]]] },
  Z: { w: 88, segs: [[['M', 80, 6], ['L', 8, 6], ['L', 80, 98], ['L', 8, 98]]] },
};
const LETTER_GAP = 10; // units between letters
const SPACE_W = 42; // units for a space
const STROKE_W = 24; // units, the thick Roblox stroke
const OUTLINE = '#14161c';

function glyphPath(ch) {
  const g = ROBLOX_FONT[ch];
  const p = new Path2D();
  if (!g) return p;
  for (const sub of g.segs) {
    for (const cmd of sub) {
      if (cmd[0] === 'M') p.moveTo(cmd[1], cmd[2]);
      else if (cmd[0] === 'L') p.lineTo(cmd[1], cmd[2]);
      else if (cmd[0] === 'C') p.bezierCurveTo(cmd[1], cmd[2], cmd[3], cmd[4], cmd[5], cmd[6]);
      else if (cmd[0] === 'A') p.arc(cmd[1], cmd[2], cmd[3], cmd[4], cmd[5], cmd[6]);
      else if (cmd[0] === 'R') {
        const [_, x, y, w, h, r] = cmd;
        p.moveTo(x + r, y);
        p.lineTo(x + w - r, y);
        p.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
        p.lineTo(x + w, y + h - r);
        p.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
        p.lineTo(x + r, y + h);
        p.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
        p.lineTo(x, y + r);
        p.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
        p.closePath();
      }
    }
  }
  return p;
}

// Side shade for a front-face colour: mixed toward black.
function robloxShades(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (v, to, t) => Math.round(v + (to - v) * t);
  const css = (rr, gg, bb) => `rgb(${rr},${gg},${bb})`;
  return {
    front: hex,
    side: css(mix(r, 0, 0.38), mix(g, 0, 0.38), mix(b, 0, 0.38)),
  };
}

// One solid Roblox-style letter at (x, yTop), cap height s. Depth copy
// offset down-right in the dark side shade, then a thick dark outline,
// then the front face.
function drawRobloxLetter(ctx, ch, x, yTop, s, shades, dy, rotDeg) {
  const g = ROBLOX_FONT[ch];
  if (!g) return;
  const sc = s / 100;
  const path = glyphPath(ch);
  ctx.save();
  ctx.translate(x + (g.w * sc) / 2, yTop + s / 2 + dy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.scale(sc, sc);
  ctx.translate(-g.w / 2, -50);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.save();
  ctx.translate(10, 12);
  ctx.strokeStyle = shades.side;
  ctx.lineWidth = STROKE_W;
  ctx.stroke(path);
  ctx.restore();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = STROKE_W + 10;
  ctx.stroke(path);
  ctx.strokeStyle = shades.front;
  ctx.lineWidth = STROKE_W;
  ctx.stroke(path);
  ctx.restore();
}

// Roblox-style square-letter text, always on ONE line. (x, y) is the text
// position with the caller's textAlign and the alphabetic baseline, like
// fillText: the glyph box bottom sits on y. `font` only sets the cap
// height (e.g. '900 84px …'); `face` is the default front colour,
// `opts.wordColors` colours each word in turn, and `opts.maxWidth`
// scales the cap height down so long titles fit. The whole line leans
// slightly forward and letters alternate a small bounce and tilt, so it
// reads playful instead of rigid.
function robloxText(ctx, x, y, text, font, face, opts) {
  const { wordColors, maxWidth } = opts || {};
  let size = parseInt((/(\d+)px/).exec(font)?.[1] || '64', 10);
  const words = String(text).toUpperCase().split(' ');
  let totalUnits = 0;
  for (const word of words) {
    for (const ch of word) totalUnits += (ROBLOX_FONT[ch] ? ROBLOX_FONT[ch].w : 60) + LETTER_GAP;
    totalUnits -= LETTER_GAP;
    totalUnits += SPACE_W;
  }
  totalUnits -= SPACE_W;
  const mw = maxWidth || 1160;
  if (totalUnits * (size / 100) > mw) size = (mw / totalUnits) * 100;
  const sc = size / 100;
  const totalW = totalUnits * sc;
  const align = ctx.textAlign;
  let cx = x;
  if (align === 'center') cx = x - totalW / 2;
  else if (align === 'right' || align === 'end') cx = x - totalW;
  const textCx = cx + totalW / 2;
  const cy = y - size / 2;
  ctx.save();
  ctx.translate(textCx, cy);
  ctx.transform(1, 0, -0.13, 1, 0, 0);
  ctx.translate(-textCx, -cy);
  let k = 0;
  words.forEach((word, wi) => {
    const shades = robloxShades((wordColors && wordColors[wi % wordColors.length]) || face);
    for (let i = 0; i < word.length; i += 1) {
      const ch = word[i];
      const g = ROBLOX_FONT[ch];
      if (!g) { cx += 60 * sc; k += 1; continue; }
      const dy = (k % 2 === 0 ? -1 : 1) * size * 0.035;
      const rot = (k % 2 === 0 ? -1.6 : 1.6);
      drawRobloxLetter(ctx, ch, cx, y - size, size, shades, dy, rot);
      cx += (g.w + LETTER_GAP) * sc;
      k += 1;
    }
    cx += SPACE_W * sc;
  });
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Title screen: a game cover over the panning 3D city. The real logo
// image (assets/logo.png) sits at the top on one line; below it a gold
// subtitle pill, the story and the five jobs in clean panels, and a
// pulsing start button. The bottom is a strict stack with real gaps at
// 1280x720 — controls (588/608), start button (614..656), credit line
// (baseline 676), HTML status pill (top ~682) — so the button, the
// credit line and the pill can never overlap. The old "Saved:" line is
// gone: it sat at 692, colliding with the pill, and the start button
// already says "OR C TO CONTINUE YOUR SAVED GAME" when a save exists.
// ---------------------------------------------------------------------------
export function drawTitle(G, renderer) {
  const { ctx, view } = renderer;
  // A light dim so the panning 3D city shows through behind the cover.
  dimScreen(renderer, 0.38);
  // A dark gradient at the top so the logo reads over the shops.
  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, 'rgba(6,8,16,0.55)');
  grad.addColorStop(1, 'rgba(6,8,16,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.w, 260);

  // The logo: the real GREAT BLOX HEIST title art, one line, centred.
  const logo = renderer.logoImg;
  if (logo) {
    const lw = Math.min(1200, view.w - 60);
    const lh = (lw / logo.width) * logo.height;
    ctx.drawImage(logo, (view.w - lw) / 2, 30, lw, lh);
  } else {
    // Fallback if the logo image has not loaded yet: Roblox-style letters.
    ctx.textAlign = 'center';
    robloxText(ctx, view.w / 2, 130, 'GREAT BLOX HEIST', `900 84px ${FONT}`, '#ffd23e', { wordColors: ['#ffd23e', '#ff5fa2', '#2ee6ff'] });
    ctx.textAlign = 'left';
  }

  // Gold subtitle on a dark navy pill, just below the logo.
  const sub = 'A BLOCKY OPEN-WORLD CRIME CAPER';
  ctx.font = `bold 19px ${FONT}`;
  const subW = ctx.measureText(sub).width + 44;
  ctx.fillStyle = 'rgba(20,22,28,0.85)';
  roundRect(ctx, (view.w - subW) / 2, 180, subW, 34, 17);
  ctx.fill();
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 2;
  roundRect(ctx, (view.w - subW) / 2, 180, subW, 34, 17);
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.textAlign = 'center';
  ctx.fillText(sub, view.w / 2, 203);
  ctx.textAlign = 'left';

  // The story, in a clean white panel.
  panel(ctx, (view.w - 760) / 2, 452, 760, 62, '#ff5fa2');
  ctx.fillStyle = '#14161c';
  ctx.font = `16px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Danny Reyes came to the city with $40 and a name to make.', view.w / 2, 477);
  ctx.fillText('Fixer Mara Solano has five jobs for him — if the police let him finish them.', view.w / 2, 500);
  ctx.textAlign = 'left';

  // The five jobs as chips, with their rewards.
  ctx.font = `bold 13px ${FONT}`;
  const chips = MISSION_DEFS.map((d, i) => `${i + 1} · ${d.title} — $${d.reward}`);
  const chipWs = chips.map((c) => ctx.measureText(c).width + 24);
  const chipsTotal = chipWs.reduce((a, b) => a + b, 0) + 10 * (chips.length - 1);
  let cx = (view.w - chipsTotal) / 2;
  chips.forEach((c, i) => {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(ctx, cx, 528, chipWs[i], 30, 15);
    ctx.fill();
    ctx.strokeStyle = '#2ee6ff';
    ctx.lineWidth = 2;
    roundRect(ctx, cx, 528, chipWs[i], 30, 15);
    ctx.stroke();
    ctx.fillStyle = '#14161c';
    ctx.textAlign = 'center';
    ctx.fillText(c, cx + chipWs[i] / 2, 548);
    ctx.textAlign = 'left';
    cx += chipWs[i] + 10;
  });

  // Controls, two lines.
  centreText(ctx, view, 588, 'WASD / Arrows — move and drive      E — steal / leave a car      Mouse — aim      Click / F — shoot', `15px ${FONT}`, '#cfe3ff');
  centreText(ctx, view, 608, 'Shift — run      Enter — start a job      P / Esc — pause      M — mute', `15px ${FONT}`, '#cfe3ff');

  // The pulsing start button.
  const pulse = 0.72 + Math.sin(G.time * 4) * 0.28;
  const prompt = G.save
    ? 'PRESS ENTER TO START — OR C TO CONTINUE YOUR SAVED GAME'
    : '▶  PRESS ENTER TO START  ◀';
  ctx.font = `bold 20px ${FONT}`;
  const promptW = ctx.measureText(prompt).width + 48;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#37d67a';
  roundRect(ctx, (view.w - promptW) / 2, 614, promptW, 42, 21);
  ctx.fill();
  ctx.strokeStyle = '#14161c';
  ctx.lineWidth = 3;
  roundRect(ctx, (view.w - promptW) / 2, 614, promptW, 42, 21);
  ctx.stroke();
  ctx.fillStyle = '#14161c';
  ctx.textAlign = 'center';
  ctx.fillText(prompt, view.w / 2, 642);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  // The credit line, clear of the button above (ends 656) and the HTML
  // status pill below (top ~682): baseline 676, glyphs ~664..676.
  centreText(ctx, view, view.h - 44, 'An original game. No Rockstar names, characters, art or music — just Great Blox Heist.', `12px ${FONT}`, '#3d4c63');
}

export function drawPaused(G, renderer) {
  const { view } = renderer;
  dimScreen(renderer, 0.6);
  centreText(renderer.ctx, view, view.h * 0.4, 'PAUSED', `bold 56px ${FONT}`, '#fff');
  centreText(renderer.ctx, view, view.h * 0.4 + 44, 'Press P or Esc to keep playing', `17px ${FONT}`, '#ffd23e');
  centreText(renderer.ctx, view, view.h * 0.4 + 76, `Jobs done: ${G.missions.index}/5 · Cash: $${Math.floor(G.player.cash)} · ${formatClock(G)}`, `15px ${FONT}`, '#ddd');
}

export function drawBusted(G, renderer) {
  const { ctx, view } = renderer;
  dimScreen(renderer, 0.72);
  ctx.textAlign = 'center';
  robloxText(ctx, view.w / 2, view.h * 0.38, 'BUSTED', `900 84px ${FONT}`, '#ff5a4e', {});
  ctx.textAlign = 'left';
  centreText(ctx, view, view.h * 0.38 + 40, 'The police took you in. Bail cost $150 — back to the hideout.', `17px ${FONT}`, '#fff');
  centreText(ctx, view, view.h * 0.38 + 78, 'Press Enter to get back on the streets', `bold 18px ${FONT}`, '#7dff9b');
}

export function drawComplete(G, renderer) {
  const { ctx, view } = renderer;
  dimScreen(renderer, 0.55);
  ctx.textAlign = 'center';
  robloxText(ctx, view.w / 2, view.h * 0.36, 'GREAT BLOX HEIST IS YOURS', `900 64px ${FONT}`, '#ffd23e', { wordColors: ['#ffd23e', '#ff5fa2', '#2ee6ff', '#ffffff', '#ffffff'], maxWidth: 1160 });
  ctx.textAlign = 'left';
  centreText(ctx, view, view.h * 0.36 + 44, 'All five jobs done. Mara is impressed — and the city knows your name.', `18px ${FONT}`, '#fff');
  centreText(ctx, view, view.h * 0.36 + 80, `Final cash: $${Math.floor(G.player.cash)}`, `bold 20px ${FONT}`, '#7dff9b');
  centreText(ctx, view, view.h * 0.36 + 116, 'Press Enter to play again', `16px ${FONT}`, '#cfe3ff');
}
