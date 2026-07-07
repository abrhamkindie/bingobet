/**
 * RngProvider — shared random number generation abstraction.
 *
 * Production: uses Node.js crypto.randomInt for cryptographic security.
 * Tests: inject a seeded PRNG for deterministic results.
 *
 * All game plugins should use the engine's RNG rather than importing crypto directly.
 */

import crypto from 'node:crypto';

/**
 * Create an RNG provider.
 *
 * @param {number} [seed] — optional seed for deterministic PRNG (testing only)
 * @returns {{ next: () => number, int: (min:number, max:number) => number, shuffle: <T>(arr:T[]) => T[] }}
 */
export function createRngProvider(seed) {
  if (seed !== undefined) {
    // Simple LCG seeded PRNG for deterministic tests
    let s = seed >>> 0;
    if (s === 0) s = 1;
    return {
      /** Float in [0, 1). */
      next() {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
      },
      /** Integer in [min, max] inclusive. */
      int(min, max) {
        return min + Math.floor(this.next() * (max - min + 1));
      },
      /** Fisher–Yates shuffle (mutates in place). */
      shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = this.int(0, i);
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
      },
    };
  }

  // Production: cryptographically secure
  return {
    /** Float in [0, 1). */
    next() {
      return crypto.randomInt(0, 2 ** 31) / 2 ** 31;
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return crypto.randomInt(min, max + 1);
    },
    /** Fisher–Yates shuffle (mutates in place). */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

/** Default secure RNG instance for production use. */
export const secureRng = createRngProvider();
