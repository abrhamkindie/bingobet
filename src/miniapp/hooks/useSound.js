/**
 * Programmatic sound effects for the roulette wheel using the Web Audio API.
 * No external audio files needed — everything is synthesised at runtime.
 *
 * ⚠️ All timing uses `ctx.currentTime` internally. Callers must NOT pass
 *    timestamps — scheduling is handled relative to the AudioContext clock.
 *
 * Falls back silently when AudioContext is unavailable (e.g. in testing / SSR).
 */

let ctx = null;

function getCtx() {
  if (!ctx && typeof AudioContext !== 'undefined') {
    ctx = new AudioContext();
  }
  // Resume on first user interaction (browser autoplay policy).
  if (ctx?.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** Return the current AudioContext time (seconds) or 0 if unavailable. */
function now() {
  const c = getCtx();
  return c ? c.currentTime : 0;
}

// ── Helpers ────────────────────────────────────────────

function playTone(freq, startTime, duration, type = 'sine', volume = 0.12) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playNoise(startTime, duration, volume = 0.04) {
  const c = getCtx();
  if (!c) return;
  const bufSize = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = (Math.random() * 2 - 1) * volume;
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  src.connect(gain).connect(c.destination);
  src.start(startTime);
  src.stop(startTime + duration);
}

// ── Public sounds ──────────────────────────────────────

/**
 * Play a single tick sound (like the roulette ball bouncing off a diamond).
 * Called repeatedly during the spin animation at varying intervals.
 */
export function playTick() {
  const t = now();
  if (!t) return;
  playTone(1800, t, 0.04, 'square', 0.035);
  playNoise(t, 0.02, 0.015);
}

/**
 * Play a "ball rolling" rattle — short burst of noise + low tone.
 */
export function playRattle() {
  const t = now();
  if (!t) return;
  playTone(90, t, 0.08, 'sine', 0.06);
  playNoise(t, 0.06, 0.025);
}

/**
 * Winning fanfare — ascending major arpeggio (C E G C).
 */
export function playWin() {
  const t = now();
  if (!t) return;
  const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
  const base = t + 0.05;
  notes.forEach((freq, i) => {
    playTone(freq, base + i * 0.12, 0.4, 'sine', 0.1);
    playTone(freq / 2, base + i * 0.12, 0.35, 'triangle', 0.04);
  });
  // Sparkle
  for (let i = 0; i < 3; i++) {
    playTone(2000 + Math.random() * 2000, t + 0.6 + i * 0.08, 0.15, 'sine', 0.025);
  }
}

/**
 * Loss sound — a short descending sigh.
 */
export function playLose() {
  const t = now();
  if (!t) return;
  const base = t + 0.05;
  playTone(400, base, 0.25, 'triangle', 0.08);
  playTone(350, base + 0.08, 0.25, 'triangle', 0.06);
  playTone(300, base + 0.16, 0.3, 'triangle', 0.04);
  playTone(60, base + 0.2, 0.2, 'sine', 0.06);
}

/**
 * Spin start — a short whoosh to signal the wheel is turning.
 */
export function playSpinStart() {
  const c = getCtx();
  if (!c) return;
  const t = c.currentTime;
  // Rising pitch sweep
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.25);
  gain.gain.setValueAtTime(0.04, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.35);
  playNoise(t, 0.1, 0.03);
}
