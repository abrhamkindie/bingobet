import { describe, it, expect } from 'vitest';
import {
  rewardFor,
  computeDailyStatus,
  parseReferralCode,
  utcDay,
} from './rewardsService.js';

const cfg = { base: 10, streakBonus: 5, streakMax: 7 };
const DAY = 86400000;
const NOW = Date.UTC(2026, 6, 6, 12, 0, 0); // 2026-07-06 12:00 UTC

describe('rewardFor', () => {
  it('gives the base reward on day 1', () => {
    expect(rewardFor(1, cfg)).toBe(10);
  });
  it('adds the streak bonus per consecutive day', () => {
    expect(rewardFor(2, cfg)).toBe(15);
    expect(rewardFor(3, cfg)).toBe(20);
  });
  it('caps the bonus at streakMax', () => {
    expect(rewardFor(7, cfg)).toBe(10 + 6 * 5); // 40
    expect(rewardFor(50, cfg)).toBe(40); // no growth beyond the cap
  });
  it('never returns less than base for streak 0/negative', () => {
    expect(rewardFor(0, cfg)).toBe(10);
  });
});

describe('computeDailyStatus', () => {
  it('lets a brand-new player claim (streak becomes 1)', () => {
    const s = computeDailyStatus({ last_daily_claim_at: null, daily_streak: 0 }, cfg, NOW);
    expect(s.canClaim).toBe(true);
    expect(s.nextStreak).toBe(1);
    expect(s.rewardPreview).toBe(10);
  });

  it('continues the streak when the last claim was yesterday', () => {
    const s = computeDailyStatus(
      { last_daily_claim_at: new Date(NOW - DAY), daily_streak: 3 },
      cfg,
      NOW
    );
    expect(s.canClaim).toBe(true);
    expect(s.nextStreak).toBe(4);
    expect(s.rewardPreview).toBe(rewardFor(4, cfg));
  });

  it('resets the streak when a day was missed', () => {
    const s = computeDailyStatus(
      { last_daily_claim_at: new Date(NOW - 3 * DAY), daily_streak: 5 },
      cfg,
      NOW
    );
    expect(s.canClaim).toBe(true);
    expect(s.nextStreak).toBe(1);
  });

  it('blocks a second claim on the same UTC day', () => {
    const s = computeDailyStatus(
      { last_daily_claim_at: new Date(NOW - 3600_000), daily_streak: 2 },
      cfg,
      NOW
    );
    expect(s.canClaim).toBe(false);
    expect(s.nextClaimAt).toBeTruthy();
  });
});

describe('utcDay', () => {
  it('returns null for empty input', () => {
    expect(utcDay(null)).toBeNull();
  });
  it('collapses timestamps within a day to the same value', () => {
    expect(utcDay(Date.UTC(2026, 6, 6, 1))).toBe(utcDay(Date.UTC(2026, 6, 6, 23)));
  });
});

describe('parseReferralCode', () => {
  it('extracts and uppercases a valid ref_ code', () => {
    expect(parseReferralCode('ref_ab12cd')).toBe('AB12CD');
  });
  it('returns null for non-referral or empty params', () => {
    expect(parseReferralCode(null)).toBeNull();
    expect(parseReferralCode('startgame')).toBeNull();
    expect(parseReferralCode('ref_')).toBeNull();
    expect(parseReferralCode('ref_bad!code')).toBeNull();
  });
});
