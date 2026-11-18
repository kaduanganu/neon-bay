// Rewritten 18 Nov 2026 in the recorded Great Blox Heist 3D session.
// Sound, synthesized live with WebAudio — no audio files. A low synthwave
// bass loop for the drive, plus shots, sirens, doors, crashes, pickups and
// mission jingles. Everything is created lazily on the first user gesture so
// the page never needs an audio permission prompt before play.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    engineOsc: null,
    engineGain: null,
    stepGain: null,
    musicTimer: null,
    muted: false,
    stepPhase: 0,
  };

  function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0.16;
      audio.musicGain.connect(audio.master);
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineGain.connect(audio.master);
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 55;
      audio.engineOsc.connect(audio.engineGain);
      audio.engineOsc.start();
      audio.stepGain = audio.ctx.createGain();
      audio.stepGain.gain.value = 0.0;
      audio.stepGain.connect(audio.master);
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  // A slow synthwave bass line: A minor, one bar looping, plus a soft pad.
  const BASS_LINE = [55, 0, 55, 65.41, 0, 55, 49, 55, 55, 0, 55, 65.41, 82.41, 73.42, 65.41, 55];
  let bassStep = 0;
  function startMusic() {
    if (audio.musicTimer) return;
    audio.musicTimer = window.setInterval(() => {
      if (!audio.ctx || audio.muted) return;
      const freq = BASS_LINE[bassStep % BASS_LINE.length];
      bassStep += 1;
      if (!freq) return;
      const t = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = audio.ctx.createGain();
      gain.gain.setValueAtTime(0.9, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(audio.musicGain);
      osc.start(t);
      osc.stop(t + 0.3);
    }, 170);
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t);
  }

  audio.unlock = ensure;

  audio.shot = () => {
    ensure();
    noise(0.12, 0.5, 2800);
    blip(190, 0.08, 'square', 0.18, 60);
  };

  audio.enemyShot = (distance) => {
    if (distance > 700) return;
    ensure();
    noise(0.1, 0.16, 1800);
  };

  audio.carDoor = () => {
    ensure();
    blip(140, 0.09, 'square', 0.2, 90);
    noise(0.06, 0.15, 900);
  };

  audio.crash = () => {
    ensure();
    noise(0.25, 0.4, 500);
    blip(70, 0.2, 'sawtooth', 0.25, 40);
  };

  audio.pickup = () => {
    ensure();
    blip(660, 0.09, 'sine', 0.25);
    window.setTimeout(() => blip(990, 0.12, 'sine', 0.25), 90);
  };

  audio.alarm = () => {
    ensure();
    for (let i = 0; i < 3; i += 1) {
      window.setTimeout(() => blip(880, 0.16, 'square', 0.2, 660), i * 180);
    }
  };

  audio.siren = () => {
    ensure();
    blip(700, 0.5, 'sine', 0.07, 950);
  };

  audio.missionStart = () => {
    ensure();
    blip(523, 0.12, 'triangle', 0.3);
    window.setTimeout(() => blip(659, 0.12, 'triangle', 0.3), 120);
  };

  audio.missionComplete = () => {
    ensure();
    [523, 659, 784, 1046].forEach((f, i) => {
      window.setTimeout(() => blip(f, 0.18, 'triangle', 0.3), i * 110);
    });
  };

  audio.missionFail = () => {
    ensure();
    blip(392, 0.25, 'sawtooth', 0.2, 196);
  };

  audio.busted = () => {
    ensure();
    [440, 415, 392, 370].forEach((f, i) => {
      window.setTimeout(() => blip(f, 0.3, 'sawtooth', 0.2), i * 200);
    });
  };

  audio.setEngine = (speed, driving) => {
    if (!audio.ctx) return;
    // A non-finite speed must never reach setTargetAtTime: it throws, and
    // an exception out of step() stops the whole game loop. (One headless
    // probe run once threw here with a NaN car speed that no reproduction
    // has since produced — the guard makes the game immune either way.)
    if (!Number.isFinite(speed)) speed = 0;
    const target = driving ? 0.05 + Math.min(0.12, Math.abs(speed) / 440 * 0.12) : 0;
    audio.engineGain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 0.22, audio.ctx.currentTime, 0.1);
  };

  audio.setFootsteps = (moving, running) => {
    if (!audio.ctx) return;
    if (!moving) {
      audio.stepGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
      return;
    }
    audio.stepPhase += running ? 0.09 : 0.06;
    if (audio.stepPhase > 1) {
      audio.stepPhase = 0;
      noise(0.05, 0.06, 700);
    }
  };

  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  return audio;
}
