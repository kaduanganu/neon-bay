// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// Keyboard and mouse input. Keys are tracked as a live set; edge-triggered
// actions (enter car, pause, shoot, confirm) are queued and consumed once by
// the main loop, so a held key never double-fires. Mouse coordinates are in
// screen pixels on the overlay canvas; the renderer turns them into a
// ground-plane aim point with a raycast, so shooting works in 3D.

export const ACTION_SHOOT = 1;
export const ACTION_ENTER_CAR = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_HORN = 16;

const KEY_ACTIONS = {
  KeyE: ACTION_ENTER_CAR,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyF: ACTION_SHOOT,
  KeyH: ACTION_HORN,
};

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false },
    queued: 0,
    audioUnlocked: false,
  };

  function queue(action) {
    input.queued |= action;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) queue(action);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    input.audioUnlocked = true;
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouse.down = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = event.clientX - rect.left;
    input.mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    input.mouse.down = true;
    queue(ACTION_SHOOT);
    input.audioUnlocked = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  input.takeActions = () => {
    const actions = input.queued;
    input.queued = 0;
    return actions;
  };
  input.down = (code) => input.keys.has(code);
  input.axis = () => {
    let x = 0;
    let y = 0;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
    return { x, y };
  };
  return input;
}
