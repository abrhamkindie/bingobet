import { describe, it, expect } from 'vitest';
import {
  drawUnique,
  countHits,
  kenoMultiplier,
  pickWeighted,
} from './instantGamesService.js';

describe('drawUnique', () => {
  it('draws the requested count of unique in-range numbers', () => {
    const drawn = drawUnique(40, 10);
    expect(drawn).toHaveLength(10);
    expect(new Set(drawn).size).toBe(10);
    expect(Math.min(...drawn)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...drawn)).toBeLessThanOrEqual(40);
  });
  it('returns sorted ascending', () => {
    const drawn = drawUnique(40, 10);
    expect([...drawn].sort((a, b) => a - b)).toEqual(drawn);
  });
  it('is deterministic with a fixed rng', () => {
    expect(drawUnique(40, 5, () => 0)).toEqual([1, 2, 3, 4, 5]);
  });
  it('never exceeds the pool size', () => {
    expect(drawUnique(5, 10)).toHaveLength(5);
  });
});

describe('countHits', () => {
  it('counts matches between picks and drawn', () => {
    expect(countHits([1, 2, 3], [2, 3, 9, 10])).toBe(2);
    expect(countHits([7, 8], [1, 2])).toBe(0);
    expect(countHits([5], [5])).toBe(1);
  });
});

describe('kenoMultiplier', () => {
  const paytable = { 3: { 2: 2, 3: 16 }, 8: { 8: 600 } };
  it('returns the configured multiplier for spots/hits', () => {
    expect(kenoMultiplier(paytable, 3, 3)).toBe(16);
    expect(kenoMultiplier(paytable, 3, 2)).toBe(2);
    expect(kenoMultiplier(paytable, 8, 8)).toBe(600);
  });
  it('returns 0 when there is no payout tier', () => {
    expect(kenoMultiplier(paytable, 3, 0)).toBe(0);
    expect(kenoMultiplier(paytable, 99, 1)).toBe(0);
  });
});

describe('pickWeighted', () => {
  const segs = [{ weight: 50 }, { weight: 50 }];
  it('selects by cumulative weight', () => {
    expect(pickWeighted(segs, () => 0.1)).toBe(0);
    expect(pickWeighted(segs, () => 0.9)).toBe(1);
  });
  it('always returns a valid index', () => {
    const many = Array.from({ length: 8 }, () => ({ weight: 1 }));
    for (let i = 0; i < 50; i++) {
      const idx = pickWeighted(many);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(many.length);
    }
  });
  it('respects heavy weighting', () => {
    const skewed = [{ weight: 999 }, { weight: 1 }];
    // rng just under 1.0 lands in the tiny last segment
    expect(pickWeighted(skewed, () => 0.9999)).toBe(1);
    expect(pickWeighted(skewed, () => 0.0)).toBe(0);
  });
});
