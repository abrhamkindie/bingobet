import express, { Router } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { config } from '../config/index.js';
import { healthcheck } from '../db/index.js';
import { success } from '../utils/apiResponse.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { handleWebhook, verifySignature } from '../services/chapaService.js';
import { confirmDeposit } from '../services/walletService.js';
import { logger } from '../utils/logger.js';
import * as gameRoundsRepo from '../db/repositories/gameRounds.js';
import * as playersRepo from '../db/repositories/players.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const miniappDistDir = join(__dirname, '../../dist/miniapp');
const adminDistDir = join(__dirname, '../../dist/admin');
const miniappSrcDir = join(__dirname, '../miniapp');
const adminSrcDir = join(__dirname, '../admin');

const adminDir = existsSync(adminDistDir) ? adminDistDir : adminSrcDir;
const miniappDir = existsSync(miniappDistDir) ? miniappDistDir : miniappSrcDir;

export function createPublicRouter(bot) {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({ ok: true, app: config.appName, env: config.env });
  });

  router.get('/ready', async (req, res) => {
    try {
      const dbOk = await healthcheck();
      res.status(dbOk ? 200 : 503).json({ ok: dbOk, db: dbOk });
    } catch (err) {
      res.status(503).json({ ok: false, db: false });
    }
  });

  // Mini App static files
  router.use('/miniapp', express.static(miniappDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-store');
      if (filePath.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));

  // Admin dashboard
  router.get('/admin', (req, res, next) => {
    if (req.path !== '/admin') return next();
    return res.redirect(302, '/admin/');
  });
  router.use('/admin', express.static(adminDir));
  router.get('/admin/*', (req, res) => {
    res.sendFile(join(adminDir, 'index.html'));
  });

  // Payment success page
  router.get('/payment/success', (req, res) => {
    res.send(`<!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment - BetBingo</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);min-height:100vh;
          display:flex;align-items:center;justify-content:center;padding:20px}
        .card{background:#1e293b;border:1px solid #334155;border-radius:16px;
          padding:48px 40px;max-width:420px;width:100%;text-align:center}
        .title{color:#f1f5f9;font-size:24px;margin-bottom:8px}
        .text{color:#94a3b8;font-size:15px;line-height:1.6;margin-bottom:28px}
        .btn{display:inline-flex;align-items:center;gap:8px;
          background:linear-gradient(135deg,#059669,#047857);color:white;
          text-decoration:none;padding:14px 28px;border-radius:10px;
          font-size:15px;font-weight:600;transition:all 0.2s}
        .btn:hover{transform:translateY(-2px)}
        .check{width:72px;height:72px;background:linear-gradient(135deg,#22c55e,#16a34a);
          border-radius:50%;display:flex;align-items:center;justify-content:center;
          margin:0 auto 24px;font-size:36px;color:white}
      </style>
    </head><body>
      <div class="card">
        <div class="check">✓</div>
        <h1 class="title">Payment Successful!</h1>
        <p class="text">Your transaction has been processed. Return to Telegram to continue playing.</p>
        <a class="btn" href="https://t.me/${config.botUsername}">Open Telegram</a>
      </div>
    </body></html>`);
  });

  // Chapa webhook - GET (redirect callback)
  router.get('/api/payments/chapa/webhook', async (req, res) => {
    const txRef = req.query.trx_ref || req.query.tx_ref;
    const status = req.query.status;
    if (txRef && status === 'success') {
      confirmDeposit(txRef).catch(err => logger.error('Chapa deposit confirm failed', { error: err.message, txRef }));
    }
    return res.redirect(`https://t.me/${config.botUsername}`);
  });

  // Chapa webhook - POST (server-to-server)
  router.post('/api/payments/chapa/webhook', async (req, res) => {
    try {
      const signature = req.headers['x-chapa-signature'];
      if (signature && config.chapa.webhookSecret && req.rawBody) {
        const isValid = verifySignature(req.rawBody, signature, config.chapa.webhookSecret);
        if (!isValid) return res.status(401).json({ success: false, error: 'Invalid signature' });
      }

      const webhookEvent = handleWebhook(req.body);
      if (webhookEvent.event === 'charge.success') {
        try {
          const { transaction, player } = await confirmDeposit(webhookEvent.tx_ref);
          if (bot && player?.telegram_id) {
            await bot.api.sendMessage(
              Number(player.telegram_id),
              `💳 Deposit of ${transaction.amount} ETB received! Balance: ${player.wallet_balance} ETB`
            );
          }
        } catch (err) {
          logger.error('Failed to confirm deposit', { error: err.message, txRef: webhookEvent.tx_ref });
        }
      }
      success(res, { processed: true });
    } catch (err) {
      logger.error('Chapa webhook error', { error: err.message });
      success(res, { processed: false });
    }
  });

  return router;
}
