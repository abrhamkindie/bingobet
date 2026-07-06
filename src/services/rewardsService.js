import crypto from 'node:crypto';
import { query, withTransaction } from '../db/index.js';
import * as settingsRepo from '../db/repositories/settings.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

// Unambiguous alphabet (no 0/O/1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function utcDay(date) {
  if (!date) return null;
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
const DAY_MS = 86400000;

function randomCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Extract an uppercase referral code from a `ref_<code>` start param, or null. */
export function parseReferralCode(startParam) {
  if (!startParam) return null;
  const match = /^ref_([A-Za-z0-9]+)$/.exec(startParam);
  return match ? match[1].toUpperCase() : null;
}

/** Pure reward amount for a given streak day. */
export function rewardFor(streak, { base, streakBonus, streakMax }) {
  const steps = Math.min(Math.max(streak - 1, 0), streakMax - 1);
  return base + steps * streakBonus;
}

/** Pure daily-reward status from player fields + config, at time `nowMs`. */
export function computeDailyStatus(player, cfg, nowMs = Date.now()) {
  const today = utcDay(nowMs);
  const last = utcDay(player.last_daily_claim_at);
  const claimedToday = last === today;
  let nextStreak;
  if (claimedToday) nextStreak = player.daily_streak;
  else if (last === today - DAY_MS) nextStreak = player.daily_streak + 1;
  else nextStreak = 1;
  return {
    canClaim: !claimedToday,
    streak: player.daily_streak || 0,
    rewardPreview: rewardFor(claimedToday ? player.daily_streak : nextStreak, cfg),
    nextClaimAt: claimedToday ? new Date(today + DAY_MS).toISOString() : null,
    nextStreak,
  };
}

// ── Daily reward ────────────────────────────────────────

async function dailyConfig() {
  const [base, streakBonus, streakMax] = await Promise.all([
    settingsRepo.getNumber('daily_reward_base', 10),
    settingsRepo.getNumber('daily_streak_bonus', 5),
    settingsRepo.getNumber('daily_streak_max', 7),
  ]);
  return { base, streakBonus, streakMax };
}

/** Read-only daily status for the current player. */
export async function getDailyStatus(player) {
  const cfg = await dailyConfig();
  const { nextStreak, ...status } = computeDailyStatus(player, cfg);
  return status;
}

/** Atomically claim today's reward. Throws DAILY_ALREADY_CLAIMED if used up. */
export async function claimDaily(playerId) {
  const cfg = await dailyConfig();
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM players WHERE id = $1 FOR UPDATE', [playerId]);
    const player = rows[0];
    if (!player) throw new AppError('PLAYER_NOT_FOUND', 404, 'Player not found');

    const today = utcDay(new Date());
    const last = utcDay(player.last_daily_claim_at);
    if (last === today) throw new AppError('DAILY_ALREADY_CLAIMED', 409, 'Daily reward already claimed');

    const streak = last === today - DAY_MS ? player.daily_streak + 1 : 1;
    const reward = rewardFor(streak, cfg);

    const { rows: updated } = await client.query(
      `UPDATE players
         SET wallet_balance = wallet_balance + $2,
             daily_streak = $3,
             last_daily_claim_at = now()
       WHERE id = $1 RETURNING wallet_balance`,
      [playerId, reward, streak]
    );
    const balance = Number(updated[0].wallet_balance);

    const ref = 'BON-' + Date.now().toString(36).toUpperCase();
    await client.query(
      `INSERT INTO transactions (player_id, type, amount, balance_before, balance_after, reference, status, notes)
       VALUES ($1, 'bonus', $2, $3, $4, $5, 'completed', $6)`,
      [playerId, reward, balance - reward, balance, ref, `Daily reward (streak ${streak})`]
    );

    logger.info('Daily reward claimed', { playerId, reward, streak });
    return { reward, balance, streak };
  });
}

// ── Referrals ───────────────────────────────────────────

/** Ensure the player has a referral code, generating a unique one if absent. */
export async function ensureReferralCode(player) {
  if (player.referral_code) return player.referral_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode(6);
    try {
      const { rows } = await query(
        `UPDATE players SET referral_code = $2
         WHERE id = $1 AND referral_code IS NULL RETURNING referral_code`,
        [player.id, code]
      );
      if (rows.length) return rows[0].referral_code;
      // Someone set it concurrently — re-read.
      const { rows: cur } = await query('SELECT referral_code FROM players WHERE id = $1', [player.id]);
      if (cur[0]?.referral_code) return cur[0].referral_code;
    } catch (err) {
      if (err.code !== '23505') throw err; // ignore unique collisions, retry
    }
  }
  throw new AppError('REFERRAL_CODE_FAILED', 500, 'Could not allocate referral code');
}

/**
 * Attribute a new player to a referrer via `ref_<code>` start param.
 * No-op unless the player is brand new and not yet attributed.
 */
export async function captureReferral({ player, startParam, isNew }) {
  if (!isNew || player.referred_by || !startParam) return;
  const code = parseReferralCode(startParam);
  if (!code) return;

  const { rows } = await query(
    'SELECT id FROM players WHERE referral_code = $1 AND id <> $2',
    [code, player.id]
  );
  const referrer = rows[0];
  if (!referrer) return;

  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      'UPDATE players SET referred_by = $2 WHERE id = $1 AND referred_by IS NULL',
      [player.id, referrer.id]
    );
    if (rowCount) {
      await client.query('UPDATE players SET referral_count = referral_count + 1 WHERE id = $1', [referrer.id]);
      logger.info('Referral captured', { playerId: player.id, referrerId: referrer.id });
    }
  });
}

/**
 * Credit the referrer when the referred player completes their FIRST deposit.
 * Idempotent via `players.referral_rewarded`. Runs inside the caller's tx.
 */
export async function creditReferralOnFirstDeposit(client, playerId) {
  const { rows } = await client.query(
    'SELECT referred_by, referral_rewarded FROM players WHERE id = $1 FOR UPDATE',
    [playerId]
  );
  const player = rows[0];
  if (!player || !player.referred_by || player.referral_rewarded) return;

  const { rows: sRows } = await client.query("SELECT value FROM settings WHERE key = 'referral_bonus_amount'");
  const bonus = Number(sRows[0]?.value ?? 25);
  if (bonus <= 0) { await client.query('UPDATE players SET referral_rewarded = true WHERE id = $1', [playerId]); return; }

  await client.query('UPDATE players SET referral_rewarded = true WHERE id = $1', [playerId]);

  const { rows: rRows } = await client.query(
    `UPDATE players SET wallet_balance = wallet_balance + $2, referral_earned = referral_earned + $2
     WHERE id = $1 RETURNING wallet_balance`,
    [player.referred_by, bonus]
  );
  const balance = Number(rRows[0].wallet_balance);
  const ref = 'REF-' + Date.now().toString(36).toUpperCase();
  await client.query(
    `INSERT INTO transactions (player_id, type, amount, balance_before, balance_after, reference, status, notes)
     VALUES ($1, 'referral_bonus', $2, $3, $4, $5, 'completed', $6)`,
    [player.referred_by, bonus, balance - bonus, balance, ref, `Referral bonus`]
  );
  logger.info('Referral bonus credited', { referrerId: player.referred_by, playerId, bonus });
}

/** Referral dashboard data for a player. */
export async function getReferralInfo(player) {
  const code = await ensureReferralCode(player);
  const bonusAmount = await settingsRepo.getNumber('referral_bonus_amount', 25);
  const { rows } = await query(
    `SELECT id, name, username, created_at, referral_rewarded AS rewarded
     FROM players WHERE referred_by = $1 ORDER BY created_at DESC LIMIT 50`,
    [player.id]
  );
  const botUser = config.botUsername || 'BetBingoBot';
  return {
    code,
    link: `https://t.me/${botUser}?start=ref_${code}`,
    count: player.referral_count || rows.length,
    earned: Number(player.referral_earned || 0),
    bonusAmount,
    invitees: rows,
  };
}

// ── Leaderboard ─────────────────────────────────────────

export async function getLeaderboard(period, playerId, limit = 50) {
  if (period === 'week') {
    const { rows } = await query(
      `SELECT p.id, p.name, p.username, COALESCE(SUM(t.amount), 0) AS total_won
         FROM transactions t
         JOIN players p ON p.id = t.player_id
        WHERE t.type = 'winnings' AND t.status = 'completed'
          AND t.created_at > now() - interval '7 days'
        GROUP BY p.id
       HAVING COALESCE(SUM(t.amount), 0) > 0
        ORDER BY total_won DESC
        LIMIT $1`,
      [limit]
    );
    const leaderboard = rows.map((r, i) => ({ ...r, rank: i + 1, total_won: Number(r.total_won) }));
    const meIndex = leaderboard.findIndex((r) => String(r.id) === String(playerId));
    const me = meIndex >= 0 ? leaderboard[meIndex] : null;
    return { period, leaderboard, me };
  }

  // All-time by total_won on players.
  const { rows } = await query(
    `SELECT id, name, username, total_won
       FROM players WHERE total_won > 0
      ORDER BY total_won DESC LIMIT $1`,
    [limit]
  );
  const leaderboard = rows.map((r, i) => ({ ...r, rank: i + 1, total_won: Number(r.total_won) }));

  let me = leaderboard.find((r) => String(r.id) === String(playerId)) || null;
  if (!me) {
    const { rows: meRows } = await query('SELECT id, name, username, total_won FROM players WHERE id = $1', [playerId]);
    const p = meRows[0];
    if (p && Number(p.total_won) > 0) {
      const { rows: rankRows } = await query(
        'SELECT COUNT(*) AS ahead FROM players WHERE total_won > $1', [p.total_won]
      );
      me = { ...p, total_won: Number(p.total_won), rank: parseInt(rankRows[0].ahead, 10) + 1 };
    }
  }
  return { period: 'all', leaderboard, me };
}
