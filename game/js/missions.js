// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// The story: five jobs for fixer Mara Solano, from a stolen getaway car to
// the Bay Trust Bank score. Each mission has a start marker (press Enter
// there), a target, and its own win condition; the module also owns enemy
// gunmen and every bullet in the world, player-fired or not. All markers
// sit on the beachfront strip: the garage and hospital on Harbor Lane,
// the bank on Shore Drive, the pier reaching into the bay. The 3D rebuild
// changes nothing here — the same 2D ground-plane coordinates, the same
// missions, only the rendering is 3D.

import {
  BULLET_SPEED, ENEMY_HEALTH, MISSION_REWARDS,
} from './config.js';
import { PLACES } from './world.js';
import { angleDiff, clamp } from './random.js';
import { damagePlayer } from './player.js';

export const MISSION_DEFS = [
  {
    title: 'Hot Wheels',
    briefing: 'Mara needs a clean getaway car. Steal any car and bring it to the garage.',
    reward: MISSION_REWARDS[0],
    start: { x: 620, y: 165, label: 'Meet Mara' },
    target: { x: PLACES.garage.x, y: PLACES.garage.y, label: 'Solano Garage' },
  },
  {
    title: 'Sunset Run',
    briefing: 'A package for the marina, and the clock is running. 75 seconds, no excuses.',
    reward: MISSION_REWARDS[1],
    start: { x: 700, y: 200, label: 'Pick up the package' },
    target: { x: PLACES.pier.x, y: PLACES.pier.y, label: 'Marina Pier' },
    timeLimit: 75,
  },
  {
    title: 'Pier Shootout',
    briefing: 'Rival crew holds the pier. Clear them out — all four of them.',
    reward: MISSION_REWARDS[2],
    start: { x: 2000, y: 460, label: 'The pier' },
    target: { x: PLACES.pier.x, y: PLACES.pier.y, label: 'Marina Pier' },
  },
  {
    title: 'Lose the Heat',
    briefing: 'The police are all over you. Three stars — shake them off and go dark.',
    reward: MISSION_REWARDS[3],
    start: { x: 1400, y: 402, label: 'Lay low' },
    target: null,
  },
  {
    title: 'The Bay Bank Score',
    briefing: 'Bay Trust Bank. Grab the cash, then vanish to the hideout before the law closes in.',
    reward: MISSION_REWARDS[4],
    start: { x: 2560, y: 348, label: 'Bay Trust Bank' },
    target: { x: PLACES.hideout.x, y: PLACES.hideout.y, label: 'Hideout' },
  },
];

export function createMissions() {
  return {
    index: 0,
    state: 'idle', // idle | active | done
    timer: 0,
    stage: 0,
    enemies: [],
    toast: '',
    toastTimer: 0,
    started: false,
  };
}

export function currentMission(missions) {
  return missions.index < MISSION_DEFS.length ? MISSION_DEFS[missions.index] : null;
}

export function allMissionsDone(missions) {
  return missions.index >= MISSION_DEFS.length;
}

// The marker the player must reach right now: the start point while idle,
// the target while active.
export function activeMarker(missions) {
  const def = currentMission(missions);
  if (!def) return null;
  if (missions.state === 'idle') return def.start;
  return def.target;
}

export function missionObjective(missions) {
  const def = currentMission(missions);
  if (!def) return 'All jobs done — the city is yours, Danny.';
  if (missions.state === 'idle') return `${def.title}: go to ${def.start.label} and press Enter`;
  if (missions.index === 0) return `${def.title}: steal a car, then bring it to the garage`;
  if (missions.index === 1) return `${def.title}: reach the pier in ${Math.max(0, Math.ceil(missions.timer))}s`;
  if (missions.index === 2) return `${def.title}: take out the crew — ${missions.enemies.length} left`;
  if (missions.index === 3) return `${def.title}: lose the cops — get your wanted level to zero`;
  if (missions.index === 4) {
    return missions.stage === 0
      ? `${def.title}: get inside the bank and grab the cash`
      : `${def.title}: escape to the hideout`;
  }
  return def.title;
}

function setToast(missions, text) {
  missions.toast = text;
  missions.toastTimer = 4;
}

export function tryStartMission(missions, player, police, audio) {
  const def = currentMission(missions);
  if (!def || missions.state !== 'idle') return false;
  const d = Math.hypot(player.x - def.start.x, player.y - def.start.y);
  if (d > 110) return false;
  missions.state = 'active';
  missions.stage = 0;
  missions.timer = def.timeLimit || 0;
  missions.started = true;
  if (missions.index === 2) {
    // The rival crew waits on the pier — on the boards, not in the water.
    missions.enemies = [
      { x: 1990, y: 570, health: ENEMY_HEALTH, angle: 0, fireCooldown: 1, speed: 70 },
      { x: 2010, y: 610, health: ENEMY_HEALTH, angle: 0, fireCooldown: 1.6, speed: 70 },
      { x: 1995, y: 660, health: ENEMY_HEALTH, angle: 0, fireCooldown: 0.7, speed: 70 },
      { x: 2005, y: 710, health: ENEMY_HEALTH, angle: 0, fireCooldown: 2.1, speed: 70 },
    ];
  }
  if (missions.index === 3) {
    police.raise(3, 'Mara set you up — the police are coming');
  }
  setToast(missions, `${def.title}: ${def.briefing}`);
  if (audio) audio.missionStart();
  return true;
}

function completeMission(missions, player, audio) {
  const def = currentMission(missions);
  if (!def) return;
  player.cash += def.reward;
  missions.index += 1;
  missions.state = 'idle';
  missions.stage = 0;
  missions.enemies = [];
  setToast(missions, `${def.title} complete — +$${def.reward}`);
  if (audio) audio.missionComplete();
}

function failMission(missions, reason, audio) {
  missions.state = 'idle';
  missions.stage = 0;
  missions.enemies = [];
  setToast(missions, `Job failed: ${reason}. Go back to the marker and try again.`);
  if (audio) audio.missionFail();
}

// ctx: { player, police, cars, bullets, effects, audio, world, time }
// Returns 'completed' | 'failed' | null for the main loop to react to.
export function updateMissions(missions, ctx, dt) {
  if (missions.toastTimer > 0) missions.toastTimer -= dt;
  if (missions.state !== 'active') return null;
  const def = currentMission(missions);
  const { player } = ctx;
  const target = def.target;

  if (missions.index === 0) {
    // Steal a car, then park it at the garage.
    if (!player.car) return null;
    if (target && Math.hypot(player.x - target.x, player.y - target.y) < 110) {
      completeMission(missions, player, ctx.audio);
      return 'completed';
    }
    return null;
  }

  if (missions.index === 1) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      failMission(missions, 'the package arrived late', ctx.audio);
      return 'failed';
    }
    if (target && Math.hypot(player.x - target.x, player.y - target.y) < 110) {
      completeMission(missions, player, ctx.audio);
      return 'completed';
    }
    return null;
  }

  if (missions.index === 2) {
    if (missions.enemies.length === 0) {
      completeMission(missions, player, ctx.audio);
      return 'completed';
    }
    return null;
  }

  if (missions.index === 3) {
    if (ctx.police.wanted === 0) {
      completeMission(missions, player, ctx.audio);
      return 'completed';
    }
    return null;
  }

  if (missions.index === 4) {
    if (missions.stage === 0) {
      // Stand inside the bank doors to grab the cash.
      const bank = PLACES.bank;
      if (Math.hypot(player.x - bank.x, player.y - bank.y) < 130) {
        missions.stage = 1;
        player.cash += 250;
        ctx.police.raise(2, 'bank alarm');
        setToast(missions, 'Cash grabbed (+$250). Now run — the police are coming!');
        if (ctx.audio) ctx.audio.alarm();
      }
      return null;
    }
    if (target && Math.hypot(player.x - target.x, player.y - target.y) < 110) {
      completeMission(missions, player, ctx.audio);
      return 'completed';
    }
    return null;
  }
  return null;
}

// Enemy gunmen: walk toward the player, shoot with a shaky aim.
export function updateEnemies(missions, ctx, dt) {
  const { player, bullets, effects } = ctx;
  for (const enemy of missions.enemies) {
    const d = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    const want = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.angle += clamp(angleDiff(enemy.angle, want), -3 * dt, 3 * dt);
    if (d > 220) {
      enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
      enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
    }
    enemy.fireCooldown -= dt;
    if (enemy.fireCooldown <= 0 && d < 520) {
      enemy.fireCooldown = 1.1 + Math.random() * 0.9;
      const aim = want + (Math.random() - 0.5) * 0.22;
      bullets.push({
        x: enemy.x + Math.cos(aim) * 20,
        y: enemy.y + Math.sin(aim) * 20,
        vx: Math.cos(aim) * BULLET_SPEED * 0.85,
        vy: Math.sin(aim) * BULLET_SPEED * 0.85,
        range: 520,
        damage: 9,
        fromPlayer: false,
      });
      if (effects) effects.push({ kind: 'muzzle', x: enemy.x, y: enemy.y, life: 0.08 });
      if (ctx.audio) ctx.audio.enemyShot(d);
    }
  }
}

export function updateBullets(bullets, ctx, dt) {
  const { player, missions, world, effects } = ctx;
  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.range -= Math.hypot(bullet.vx, bullet.vy) * dt;
    bullet.dead = bullet.range <= 0;
    if (bullet.dead) continue;
    if (bullet.fromPlayer) {
      for (const enemy of missions.enemies) {
        if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < 16) {
          enemy.health -= bullet.damage;
          bullet.dead = true;
          if (effects) effects.push({ kind: 'spark', x: bullet.x, y: bullet.y, vx: 0, vy: 0, life: 0.25 });
          break;
        }
      }
      // A bullet can also smash a police cruiser's window.
      for (const cruiser of ctx.police.cars) {
        if (!bullet.dead && Math.hypot(bullet.x - cruiser.x, bullet.y - cruiser.y) < 26) {
          bullet.dead = true;
          break;
        }
      }
    } else if (!player.car) {
      if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < 14) {
        bullet.dead = true;
        damagePlayer(player, bullet.damage, ctx.police);
        if (effects) effects.push({ kind: 'spark', x: bullet.x, y: bullet.y, vx: 0, vy: 0, life: 0.25 });
      }
    }
  }
  missions.enemies = missions.enemies.filter((e) => e.health > 0);
  return bullets.filter((b) => !b.dead);
}
