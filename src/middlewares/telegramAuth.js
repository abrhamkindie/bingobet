import crypto from 'node:crypto';
import { config } from '../config/index.js';
import * as playersRepo from '../db/repositories/players.js';
import { logger } from '../utils/logger.js';

export function telegramAuth() {
  return async (req, res, next) => {
    try {
      if (config.env === 'development') {
        const devId = req.headers['x-telegram-user-id'];
        if (devId) {
          const dbPlayer = await playersRepo.upsertPlayer({
            telegramId: Number(devId),
            name: 'Dev User',
            username: 'dev',
          });
          req.tgUser = { id: Number(devId), first_name: 'Dev' };
          req.dbPlayer = dbPlayer;
          return next();
        }
      }

      const authHeader = req.headers.authorization;
      let initData = null;

      if (authHeader?.startsWith('Bearer ')) {
        initData = authHeader.slice(7);
      } else if (req.headers['x-telegram-init-data']) {
        initData = req.headers['x-telegram-init-data'];
      }

      if (!initData) {
        return res.status(401).json({ success: false, error: 'Missing Telegram initData' });
      }

      const parsed = new URLSearchParams(initData);
      const userJson = parsed.get('user');
      if (!userJson) {
        return res.status(401).json({ success: false, error: 'No user in initData' });
      }

      let tgUser;
      try { tgUser = JSON.parse(userJson); } catch {
        return res.status(401).json({ success: false, error: 'Malformed user in initData' });
      }

      if (config.env !== 'development') {
        const receivedHash = parsed.get('hash');
        if (!receivedHash) return res.status(401).json({ success: false, error: 'Missing hash' });

        const entries = [];
        for (const [key, value] of parsed.entries()) {
          if (key !== 'hash') entries.push(`${key}=${value}`);
        }
        entries.sort();
        const dataCheckString = entries.join('\n');

        const secretKey = crypto
          .createHmac('sha256', 'WebAppData')
          .update(config.botToken)
          .digest();

        const computedHash = crypto
          .createHmac('sha256', secretKey)
          .update(dataCheckString)
          .digest('hex');

        if (computedHash !== receivedHash) {
          return res.status(401).json({ success: false, error: 'Invalid signature' });
        }

        const authDate = Number(parsed.get('auth_date'));
        if (authDate) {
          const now = Math.floor(Date.now() / 1000);
          if (now - authDate > 86400) return res.status(401).json({ success: false, error: 'initData expired' });
        }
      }

      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');
      const dbPlayer = await playersRepo.upsertPlayer({
        telegramId: tgUser.id,
        name,
        username: tgUser.username,
      });

      if (dbPlayer.is_banned) {
        return res.status(403).json({ success: false, error: 'Account suspended' });
      }

      req.tgUser = tgUser;
      req.dbPlayer = dbPlayer;
      next();
    } catch (err) {
      logger.error('telegramAuth error', { error: err.message });
      return res.status(500).json({ success: false, error: 'Auth failed' });
    }
  };
}
