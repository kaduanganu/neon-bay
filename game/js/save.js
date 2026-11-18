// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// Save and load through localStorage: cash, missions finished and the
// player's health. The save is written after every mission and every bust,
// and offered on the title screen when one exists.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? Math.max(0, Math.floor(data.cash)) : 40,
      missionsDone: Number.isFinite(data.missionsDone) ? Math.max(0, Math.min(5, Math.floor(data.missionsDone))) : 0,
      health: Number.isFinite(data.health) ? Math.max(1, Math.min(100, Math.floor(data.health))) : 100,
    };
  } catch {
    return null;
  }
}

export function writeSave(missions, player) {
  try {
    const data = {
      cash: Math.floor(player.cash),
      missionsDone: missions.index,
      health: Math.floor(player.health),
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage may be unavailable; a missing save is not fatal.
  }
}
