import crypto from 'node:crypto';
import { engine } from '../engine/index.js';

// Cryptographically-seeded float in [0, 1).
const secureRng = () => crypto.randomInt(0, 2 ** 31) / 2 ** 31;

// ── Pure helpers (no DB — unit tested) ──────────────────

/** Draw `count` unique numbers from 1..poolSize (partial Fisher–Yates). */
export function drawUnique(poolSize, count, rng = secureRng) {
  const nums = Array.from({ length: poolSize }, (_, i) => i + 1);
  const n = Math.min(count, poolSize);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (poolSize - i));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums.slice(0, n).sort((a, b) => a - b);
}

/** Count how many of `picks` appear in `drawn`. */
export function countHits(picks, drawn) {
  const set = new Set(drawn);
  return picks.reduce((acc, p) => acc + (set.has(p) ? 1 : 0), 0);
}

/** Look up the Keno payout multiplier for (spots picked, hits). */
export function kenoMultiplier(paytable, spots, hits) {
  const row = paytable?.[String(spots)] || {};
  return Number(row[String(hits)] || 0);
}

/** Weighted-random segment index for the spin wheel. */
export function pickWeighted(segments, rng = secureRng) {
  const total = segments.reduce((s, seg) => s + Number(seg.weight), 0);
  let r = rng() * total;
  for (let i = 0; i < segments.length; i++) {
    r -= Number(segments[i].weight);
    if (r < 0) return i;
  }
  return segments.length - 1;
}

// ── Delegated to engine ─────────────────────────────────

/** @deprecated Use engine.play('keno', ...) via GameEngine */
export async function playKeno({ playerId, stake, picks }) {
  return engine.play('keno', playerId, { stake, picks });
}

/** @deprecated Use engine.play('spin', ...) via GameEngine */
export async function playSpin({ playerId, stake }) {
  return engine.play('spin', playerId, { stake });
}

/** @deprecated Use engine.getConfig('keno') or engine.getConfig('spin') */
export async function getInstantConfig() {
  const [keno, spin] = await Promise.all([
    engine.getConfig('keno'),
    engine.getConfig('spin'),
  ]);
  return {
    minStake: Math.min(keno.minStake, spin.minStake),
    maxStake: Math.max(keno.maxStake, spin.maxStake),
    keno: keno.keno,
    spin: spin.spin,
  };
}

/** @deprecated Use engine.getHistory(gameType, playerId) via GameEngine */
export async function getInstantHistory(playerId, { limit = 30, gameType } = {}) {
  return engine.getHistory(gameType || null, playerId, { limit });
}
