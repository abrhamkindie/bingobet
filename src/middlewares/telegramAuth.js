/**
 * Telegram WebApp authentication middleware.
 *
 * Validates the `initData` string sent by Telegram's WebApp SDK.
 * Uses HMAC-SHA256 as documented at:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * On success, attaches `req.tgUser` (raw Telegram user) and `req.dbUser`
 * (the database user row, upserted on the fly).
 *
 * @module middlewares/telegramAuth
 */

import crypto from 'node:crypto';
import { config } from '../config/index.js';
import * as usersRepo from '../db/repositories/users.js';
import { logger } from '../utils/logger.js';

/**
 * Validate Telegram WebApp initData and attach user to request.
 *
 * The client sends the initData either as:
 *   - `Authorization: Bearer <initData>` header, or
 *   - `X-Telegram-Init-Data` header
 *
 * In development mode, the middleware accepts:
 *   - `X-Telegram-User-Id` header for local testing
 *   - Or falls back to parsing user from initData without strict validation
 */
export function telegramAuth() {
  return async (req, res, next) => {
    try {
      // ── Dev bypass for local testing ──────────────────────────────
      if (config.env === 'development') {
        const devId = req.headers['x-telegram-user-id'];
        if (devId) {
          const dbUser = await usersRepo.upsertUser({
            telegramId: Number(devId),
            name: 'Dev User',
            username: 'dev',
          });
          req.tgUser = { id: Number(devId), first_name: 'Dev' };
          req.dbUser = dbUser;
          return next();
        }
      }

      // ── Extract initData ──────────────────────────────────────────
      const authHeader = req.headers.authorization;
      let initData = null;

      if (authHeader?.startsWith('Bearer ')) {
        initData = authHeader.slice(7);
      } else if (req.headers['x-telegram-init-data']) {
        initData = req.headers['x-telegram-init-data'];
      }

      if (!initData) {
        logger.warn('telegramAuth: No initData provided');
        return res.status(401).json({ success: false, error: 'Missing Telegram initData' });
      }

      // ── Parse user from initData ──────────────────────────────────
      const parsed = new URLSearchParams(initData);
      const userJson = parsed.get('user');
      
      if (!userJson) {
        logger.warn('telegramAuth: No user in initData');
        return res.status(401).json({ success: false, error: 'No user in initData' });
      }

      let tgUser;
      try {
        tgUser = JSON.parse(userJson);
      } catch {
        logger.warn('telegramAuth: Malformed user JSON');
        return res.status(401).json({ success: false, error: 'Malformed user in initData' });
      }

      // ── Validate the hash (skip in development for easier testing) ─
      if (config.env !== 'development') {
        const receivedHash = parsed.get('hash');
        if (!receivedHash) {
          return res.status(401).json({ success: false, error: 'Missing hash in initData' });
        }

        // Build the data-check-string
        const entries = [];
        for (const [key, value] of parsed.entries()) {
          if (key !== 'hash') entries.push(`${key}=${value}`);
        }
        entries.sort();
        const dataCheckString = entries.join('\n');

        // Secret key = HMAC-SHA256("WebAppData", botToken)
        const secretKey = crypto
          .createHmac('sha256', 'WebAppData')
          .update(config.botToken)
          .digest();

        // Hash = HMAC-SHA256(secretKey, dataCheckString)
        const computedHash = crypto
          .createHmac('sha256', secretKey)
          .update(dataCheckString)
          .digest('hex');

        if (computedHash !== receivedHash) {
          logger.warn('telegramAuth: Invalid hash signature');
          return res.status(401).json({ success: false, error: 'Invalid initData signature' });
        }

        // Check auth_date freshness
        const authDate = Number(parsed.get('auth_date'));
        if (authDate) {
          const now = Math.floor(Date.now() / 1000);
          if (now - authDate > 86400) {
            return res.status(401).json({ success: false, error: 'initData expired' });
          }
        }
      } else {
        logger.info('telegramAuth: Dev mode - skipping hash validation', { tgUserId: tgUser.id });
      }

      // ── Upsert the DB user ────────────────────────────────────────
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');
      const dbUser = await usersRepo.upsertUser({
        telegramId: tgUser.id,
        name,
        username: tgUser.username,
      });

      if (dbUser.is_banned) {
        return res.status(403).json({ success: false, error: 'Account suspended' });
      }

      req.tgUser = tgUser;
      req.dbUser = dbUser;
      next();
    } catch (err) {
      logger.error('telegramAuth error', { error: err.message, stack: err.stack });
      return res.status(500).json({ success: false, error: 'Auth failed: ' + err.message });
    }
  };
}
