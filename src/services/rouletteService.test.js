import { describe, it, expect } from 'vitest';
import {
  getAllBetTypes,
  getBetGroups,
  getSectorColors,
  getNumberColor,
  drawNumber,
  resolveBets,
  getStraightUpKeys,
  isStraightUp,
} from './rouletteService.js';

// ── Known red/black numbers for reference ───────────────
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// ── getNumberColor ─────────────────────────────────────
describe('getNumberColor', () => {
  it('returns green for 0', () => {
    expect(getNumberColor(0)).toBe('green');
  });

  it('returns red for all red numbers', () => {
    for (const n of RED_NUMBERS) {
      expect(getNumberColor(n)).toBe('red');
    }
  });

  it('returns black for all black numbers', () => {
    for (const n of BLACK_NUMBERS) {
      expect(getNumberColor(n)).toBe('black');
    }
  });
});

// ── drawNumber ─────────────────────────────────────────
describe('drawNumber', () => {
  it('is deterministic with a fixed rng', () => {
    // rng returning 0 → floor(0 * 37) = 0
    expect(drawNumber(() => 0)).toBe(0);
    // rng returning just under 1 → floor(0.9999... * 37) = 36
    expect(drawNumber(() => 0.9999)).toBe(36);
    // rng returning 0.5 → floor(0.5 * 37) = floor(18.5) = 18
    expect(drawNumber(() => 0.5)).toBe(18);
  });

  it('always returns a value between 0 and 36', () => {
    for (let i = 0; i < 100; i++) {
      const n = drawNumber();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(36);
    }
  });
});

// ── getNumberColor (integration check with draw) ───────
describe('number colour distribution', () => {
  it('has exactly 18 red, 18 black, and 1 green number', () => {
    let red = 0, black = 0, green = 0;
    for (let n = 0; n <= 36; n++) {
      const c = getNumberColor(n);
      if (c === 'red') red++;
      else if (c === 'black') black++;
      else if (c === 'green') green++;
    }
    expect(red).toBe(18);
    expect(black).toBe(18);
    expect(green).toBe(1);
  });
});

// ── resolveBets — Even Money (1:1) ─────────────────────
describe('resolveBets — Even Money (1:1)', () => {
  describe('even', () => {
    it('wins on even numbers', () => {
      const { results } = resolveBets(2, ['even'], 10);
      expect(results[0].won).toBe(true);
      expect(results[0].payout).toBe(20); // stake back + 1× profit
    });

    it('loses on odd numbers', () => {
      const { results } = resolveBets(3, ['even'], 10);
      expect(results[0].won).toBe(false);
      expect(results[0].payout).toBe(0);
    });

    it('loses on 0', () => {
      const { results } = resolveBets(0, ['even'], 10);
      expect(results[0].won).toBe(false);
    });
  });

  describe('odd', () => {
    it('wins on odd numbers', () => {
      const { results } = resolveBets(3, ['odd'], 10);
      expect(results[0].won).toBe(true);
      expect(results[0].payout).toBe(20);
    });

    it('loses on even numbers', () => {
      const { results } = resolveBets(2, ['odd'], 10);
      expect(results[0].won).toBe(false);
    });

    it('loses on 0', () => {
      const { results } = resolveBets(0, ['odd'], 10);
      expect(results[0].won).toBe(false);
    });
  });

  describe('high (19–36)', () => {
    it('wins on 19', () => {
      const { results } = resolveBets(19, ['high'], 10);
      expect(results[0].won).toBe(true);
      expect(results[0].payout).toBe(20);
    });

    it('wins on 36', () => {
      const { results } = resolveBets(36, ['high'], 10);
      expect(results[0].won).toBe(true);
    });

    it('loses on 18', () => {
      const { results } = resolveBets(18, ['high'], 10);
      expect(results[0].won).toBe(false);
    });

    it('loses on 0', () => {
      expect(resolveBets(0, ['high'], 10).results[0].won).toBe(false);
    });
  });

  describe('low (1–18)', () => {
    it('wins on 1', () => {
      const { results } = resolveBets(1, ['low'], 10);
      expect(results[0].won).toBe(true);
      expect(results[0].payout).toBe(20);
    });

    it('wins on 18', () => {
      const { results } = resolveBets(18, ['low'], 10);
      expect(results[0].won).toBe(true);
    });

    it('loses on 19', () => {
      const { results } = resolveBets(19, ['low'], 10);
      expect(results[0].won).toBe(false);
    });
  });

  describe('red', () => {
    it('wins on every red number', () => {
      for (const n of RED_NUMBERS) {
        const { results } = resolveBets(n, ['red'], 10);
        expect(results[0].won).toBe(true);
      }
    });

    it('loses on every black number', () => {
      for (const n of BLACK_NUMBERS) {
        const { results } = resolveBets(n, ['red'], 10);
        expect(results[0].won).toBe(false);
      }
    });

    it('loses on 0', () => {
      expect(resolveBets(0, ['red'], 10).results[0].won).toBe(false);
    });
  });

  describe('black', () => {
    it('wins on every black number', () => {
      for (const n of BLACK_NUMBERS) {
        const { results } = resolveBets(n, ['black'], 10);
        expect(results[0].won).toBe(true);
      }
    });

    it('loses on every red number', () => {
      for (const n of RED_NUMBERS) {
        const { results } = resolveBets(n, ['black'], 10);
        expect(results[0].won).toBe(false);
      }
    });

    it('loses on 0', () => {
      expect(resolveBets(0, ['black'], 10).results[0].won).toBe(false);
    });
  });
});

// ── resolveBets — Columns (2:1) ────────────────────────
describe('resolveBets — Columns (2:1)', () => {
  describe('col1 (1, 4, 7…34 — n%3===1)', () => {
    it('wins on 1', () => {
      const { results } = resolveBets(1, ['col1'], 10);
      expect(results[0].won).toBe(true);
      expect(results[0].payout).toBe(30); // stake back + 2× profit
    });

    it('wins on 34', () => {
      expect(resolveBets(34, ['col1'], 10).results[0].won).toBe(true);
    });

    it('loses on 2', () => {
      expect(resolveBets(2, ['col1'], 10).results[0].won).toBe(false);
    });

    it('loses on 3', () => {
      expect(resolveBets(3, ['col1'], 10).results[0].won).toBe(false);
    });

    it('loses on 0', () => {
      expect(resolveBets(0, ['col1'], 10).results[0].won).toBe(false);
    });
  });

  describe('col2 (2, 5, 8…35 — n%3===2)', () => {
    it('wins on 2', () => {
      const { results } = resolveBets(2, ['col2'], 10);
      expect(results[0].won).toBe(true);
      expect(results[0].payout).toBe(30);
    });

    it('wins on 35', () => {
      expect(resolveBets(35, ['col2'], 10).results[0].won).toBe(true);
    });

    it('loses on 1', () => {
      expect(resolveBets(1, ['col2'], 10).results[0].won).toBe(false);
    });
  });

  describe('col3 (3, 6, 9…36 — n%3===0)', () => {
    it('wins on 3', () => {
      const { results } = resolveBets(3, ['col3'], 10);
      expect(results[0].won).toBe(true);
      expect(results[0].payout).toBe(30);
    });

    it('wins on 36', () => {
      expect(resolveBets(36, ['col3'], 10).results[0].won).toBe(true);
    });

    it('loses on 1', () => {
      expect(resolveBets(1, ['col3'], 10).results[0].won).toBe(false);
    });
  });

  it('0 loses all columns', () => {
    const cols = ['col1', 'col2', 'col3'];
    const { results, totalPayout } = resolveBets(0, cols, 10);
    expect(results.every((r) => !r.won)).toBe(true);
    expect(totalPayout).toBe(0);
  });
});

// ── resolveBets — Dozens (2:1) ─────────────────────────
describe('resolveBets — Dozens (2:1)', () => {
  describe('dozen1 (1–12)', () => {
    it('wins on 1', () => {
      const { results } = resolveBets(1, ['dozen1'], 10);
      expect(results[0].won).toBe(true);
      expect(results[0].payout).toBe(30);
    });

    it('wins on 12', () => {
      expect(resolveBets(12, ['dozen1'], 10).results[0].won).toBe(true);
    });

    it('loses on 13', () => {
      expect(resolveBets(13, ['dozen1'], 10).results[0].won).toBe(false);
    });
  });

  describe('dozen2 (13–24)', () => {
    it('wins on 13', () => {
      expect(resolveBets(13, ['dozen2'], 10).results[0].won).toBe(true);
    });

    it('wins on 24', () => {
      expect(resolveBets(24, ['dozen2'], 10).results[0].won).toBe(true);
    });

    it('loses on 12', () => {
      expect(resolveBets(12, ['dozen2'], 10).results[0].won).toBe(false);
    });
  });

  describe('dozen3 (25–36)', () => {
    it('wins on 25', () => {
      expect(resolveBets(25, ['dozen3'], 10).results[0].won).toBe(true);
    });

    it('wins on 36', () => {
      expect(resolveBets(36, ['dozen3'], 10).results[0].won).toBe(true);
    });

    it('loses on 24', () => {
      expect(resolveBets(24, ['dozen3'], 10).results[0].won).toBe(false);
    });
  });

  it('0 loses all dozens', () => {
    const dozens = ['dozen1', 'dozen2', 'dozen3'];
    const { results, totalPayout } = resolveBets(0, dozens, 10);
    expect(results.every((r) => !r.won)).toBe(true);
    expect(totalPayout).toBe(0);
  });
});

// ── resolveBets — ABCDEF Sectors (5:1) ─────────────────
describe('resolveBets — ABCDEF Sectors (5:1)', () => {
  const sectorTests = [
    { key: 'sectorA', label: 'A 1–6',        range: [1, 6] },
    { key: 'sectorB', label: 'B 7–12',       range: [7, 12] },
    { key: 'sectorC', label: 'C 13–18',      range: [13, 18] },
    { key: 'sectorD', label: 'D 19–24',      range: [19, 24] },
    { key: 'sectorE', label: 'E 25–30',      range: [25, 30] },
    { key: 'sectorF', label: 'F 31–36',      range: [31, 36] },
  ];

  for (const { key, label, range } of sectorTests) {
    describe(label, () => {
      it(`wins on ${range[0]}`, () => {
        const { results } = resolveBets(range[0], [key], 10);
        expect(results[0].won).toBe(true);
        expect(results[0].payout).toBe(60); // stake back + 5× profit
      });

      it(`wins on ${range[1]}`, () => {
        expect(resolveBets(range[1], [key], 10).results[0].won).toBe(true);
      });

      it('loses just outside lower bound', () => {
        const outside = range[0] - 1;
        if (outside >= 1) {
          expect(resolveBets(outside, [key], 10).results[0].won).toBe(false);
        }
      });

      it('loses just outside upper bound', () => {
        const outside = range[1] + 1;
        if (outside <= 36) {
          expect(resolveBets(outside, [key], 10).results[0].won).toBe(false);
        }
      });
    });
  }

  it('0 loses all sectors', () => {
    const sectors = ['sectorA', 'sectorB', 'sectorC', 'sectorD', 'sectorE', 'sectorF'];
    const { results, totalPayout } = resolveBets(0, sectors, 10);
    expect(results.every((r) => !r.won)).toBe(true);
    expect(totalPayout).toBe(0);
  });
});

// ── resolveBets — Tweens (11:1) ────────────────────────
describe('resolveBets — Tweens (11:1)', () => {
  it('wins on 11', () => {
    const { results } = resolveBets(11, ['tweens'], 10);
    expect(results[0].won).toBe(true);
    expect(results[0].payout).toBe(120); // stake back + 11× profit
  });

  it('wins on 22', () => {
    expect(resolveBets(22, ['tweens'], 10).results[0].won).toBe(true);
  });

  it('wins on 33', () => {
    expect(resolveBets(33, ['tweens'], 10).results[0].won).toBe(true);
  });

  it('loses on 10', () => {
    expect(resolveBets(10, ['tweens'], 10).results[0].won).toBe(false);
  });

  it('loses on 34', () => {
    expect(resolveBets(34, ['tweens'], 10).results[0].won).toBe(false);
  });

  it('loses on 0', () => {
    expect(resolveBets(0, ['tweens'], 10).results[0].won).toBe(false);
  });
});

// ── resolveBets — Straight-Up Number Bets (35:1) ───────
describe('resolveBets — Straight Up (35:1)', () => {
  it('wins when number matches the selected straight-up bet', () => {
    const { results } = resolveBets(7, ['n7'], 10);
    expect(results[0].won).toBe(true);
    expect(results[0].payout).toBe(360); // stake back + 35× profit = 10 × 36
  });

  it('loses when number does not match', () => {
    const { results } = resolveBets(7, ['n17'], 10);
    expect(results[0].won).toBe(false);
    expect(results[0].payout).toBe(0);
  });

  it('wins on 0 when n0 is selected', () => {
    const { results } = resolveBets(0, ['n0'], 10);
    expect(results[0].won).toBe(true);
    expect(results[0].payout).toBe(360);
  });

  it('n0 loses on any other number', () => {
    const { results } = resolveBets(1, ['n0'], 10);
    expect(results[0].won).toBe(false);
  });

  it('correctly identifies a winning straight-up among multiple number bets', () => {
    // Bet on 5, 17, and 23 — number 17 wins
    const { results, totalPayout } = resolveBets(17, ['n5', 'n17', 'n23'], 10);
    expect(results[0].won).toBe(false); // n5
    expect(results[1].won).toBe(true);  // n17
    expect(results[1].payout).toBe(360);
    expect(results[2].won).toBe(false); // n23
    expect(totalPayout).toBe(360);
  });

  it('works alongside group bets', () => {
    // Number 13 is odd, black, low, col1 (13%3=1), dozen2, sectorC, and n13
    const { results, totalPayout } = resolveBets(13, ['n13', 'odd', 'black', 'low'], 10);
    const winners = results.filter((r) => r.won);
    expect(winners).toHaveLength(4);
    // n13:360 + odd:20 + black:20 + low:20 = 420
    expect(totalPayout).toBe(420);
  });

  it('all 37 straight-up bets lose except the matching one', () => {
    const { results, totalPayout } = resolveBets(19, getStraightUpKeys(), 10);
    const winner = results.find((r) => r.won);
    expect(winner.key).toBe('n19');
    expect(winner.payout).toBe(360);
    const losers = results.filter((r) => !r.won);
    expect(losers).toHaveLength(36);
    expect(totalPayout).toBe(360);
  });
});

// ── getStraightUpKeys & isStraightUp ─────────────────────
describe('getStraightUpKeys', () => {
  it('returns 37 keys from n0 to n36', () => {
    const keys = getStraightUpKeys();
    expect(keys).toHaveLength(37);
    expect(keys[0]).toBe('n0');
    expect(keys[36]).toBe('n36');
  });

  it('all keys are unique', () => {
    const keys = getStraightUpKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('isStraightUp', () => {
  it('returns true for n-prefixed keys', () => {
    expect(isStraightUp('n0')).toBe(true);
    expect(isStraightUp('n17')).toBe(true);
    expect(isStraightUp('n36')).toBe(true);
  });

  it('returns false for non-number keys', () => {
    expect(isStraightUp('even')).toBe(false);
    expect(isStraightUp('col1')).toBe(false);
    expect(isStraightUp('tweens')).toBe(false);
    expect(isStraightUp('')).toBe(false);
  });
});

// ── resolveBets — combined / edge cases ─────────────────
describe('resolveBets — combined & edge cases', () => {
  it('correctly combines multiple winning bets', () => {
    // Number 14 is even, red, low (1–18), col2 (14%3=2), dozen2 (13–24), sectorC (13–18)
    const { results, totalPayout } = resolveBets(14, ['even', 'red', 'low', 'col2', 'dozen2', 'sectorC'], 10);
    const winners = results.filter((r) => r.won);
    expect(winners).toHaveLength(6);
    // Each win pays 20 (1:1) or 30 (2:1) or 60 (5:1)
    // even: 20, red: 20, low: 20, col2: 30, dozen2: 30, sectorC: 60
    expect(totalPayout).toBe(180);
  });

  it('correctly handles mixed wins and losses', () => {
    // Number 1 is odd, red, low, col1, dozen1, sectorA, NOT even/black/high
    const { results, totalPayout } = resolveBets(1, ['even', 'odd', 'red', 'black', 'high', 'low', 'col1', 'col2', 'dozen1', 'dozen2', 'sectorA', 'sectorB', 'tweens'], 10);
    const winners = results.filter((r) => r.won).map((r) => r.key);
    expect(winners).toEqual(['odd', 'red', 'low', 'col1', 'dozen1', 'sectorA']);
    const losers = results.filter((r) => !r.won).map((r) => r.key);
    expect(losers).toEqual(['even', 'black', 'high', 'col2', 'dozen2', 'sectorB', 'tweens']);
    // odd:20 + red:20 + low:20 + col1:30 + dozen1:30 + sectorA:60 = 180
    expect(totalPayout).toBe(180);
  });

  it('returns empty results for empty bet list', () => {
    const { results, totalPayout } = resolveBets(7, [], 10);
    expect(results).toEqual([]);
    expect(totalPayout).toBe(0);
  });

  it('rounds payouts correctly', () => {
    // Test with fractional stakes
    const { results } = resolveBets(2, ['even'], 33.33);
    expect(results[0].payout).toBe(66.66); // 33.33 * 2 = 66.66
  });

  it('handles large stakes', () => {
    const { results } = resolveBets(11, ['tweens'], 500);
    expect(results[0].won).toBe(true);
    expect(results[0].payout).toBe(6000); // 500 * 12 = 6000
  });

  it('handles max stake', () => {
    const { results } = resolveBets(36, ['col3'], 1000);
    expect(results[0].won).toBe(true);
    expect(results[0].payout).toBe(3000);
  });

  it('only straight-up n0 wins on 0; all group bets lose', () => {
    const groupBets = ['even', 'odd', 'high', 'low', 'red', 'black', 'col1', 'col2', 'col3', 'dozen1', 'dozen2', 'dozen3', 'sectorA', 'sectorB', 'sectorC', 'sectorD', 'sectorE', 'sectorF', 'tweens'];
    const { results, totalPayout } = resolveBets(0, [...groupBets, 'n0'], 10);
    const winners = results.filter((r) => r.won);
    expect(winners).toHaveLength(1);
    expect(winners[0].key).toBe('n0');
    expect(winners[0].payout).toBe(360);
    expect(results.filter((r) => !r.won)).toHaveLength(groupBets.length);
    expect(totalPayout).toBe(360);
  });
});

// ── getAllBetTypes ────────────────────────────────────
describe('getAllBetTypes', () => {
  it('returns 56 bet types (19 grouped + 37 straight-up)', () => {
    const types = getAllBetTypes();
    expect(types).toHaveLength(56);
  });

  it('each bet type has key, label, payout, and check function', () => {
    for (const bet of getAllBetTypes()) {
      expect(bet).toHaveProperty('key');
      expect(bet).toHaveProperty('label');
      expect(bet).toHaveProperty('payout');
      expect(typeof bet.check).toBe('function');
    }
  });

  it('has unique keys', () => {
    const keys = getAllBetTypes().map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('payout values match expected odds', () => {
    const map = Object.fromEntries(getAllBetTypes().map((b) => [b.key, b.payout]));
    expect(map.even).toBe(1);
    expect(map.col1).toBe(2);
    expect(map.dozen1).toBe(2);
    expect(map.sectorA).toBe(5);
    expect(map.tweens).toBe(11);
    expect(map.n0).toBe(35);
    expect(map.n17).toBe(35);
    expect(map.n36).toBe(35);
  });
});

// ── getBetGroups ───────────────────────────────────────
describe('getBetGroups', () => {
  it('returns 5 groups', () => {
    expect(getBetGroups()).toHaveLength(5);
  });

  it('each group has category, payout, and bets array', () => {
    for (const group of getBetGroups()) {
      expect(group).toHaveProperty('category');
      expect(group).toHaveProperty('payout');
      expect(Array.isArray(group.bets)).toBe(true);
      expect(group.bets.length).toBeGreaterThan(0);
    }
  });

  it('groups contain the right bet keys', () => {
    const groups = getBetGroups();
    const evenMoney = groups.find((g) => g.category === 'Even Money');
    expect(evenMoney.bets).toEqual(['even', 'odd', 'high', 'low', 'red', 'black']);

    const columns = groups.find((g) => g.category === 'Columns');
    expect(columns.bets).toEqual(['col1', 'col2', 'col3']);

    const tweens = groups.find((g) => g.category === 'Tweens');
    expect(tweens.bets).toEqual(['tweens']);
  });
});

// ── getSectorColors ────────────────────────────────────
describe('getSectorColors', () => {
  it('returns 6 colour keys', () => {
    const colors = getSectorColors();
    expect(Object.keys(colors)).toHaveLength(6);
  });

  it('has entries for sectorA through sectorF', () => {
    const colors = getSectorColors();
    expect(colors.sectorA).toBe('#ef4444');
    expect(colors.sectorB).toBe('#f59e0b');
    expect(colors.sectorC).toBe('#22c55e');
    expect(colors.sectorD).toBe('#3b82f6');
    expect(colors.sectorE).toBe('#8b5cf6');
    expect(colors.sectorF).toBe('#ec4899');
  });
});
