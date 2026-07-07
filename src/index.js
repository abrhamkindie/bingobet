import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { createServer } from './server.js';
import { createBot } from './bot/index.js';
import { close as closeDb, healthcheck } from './db/index.js';
import { initEngine } from './engine/index.js';

async function main() {
  try {
    await healthcheck();
    logger.info('database connected');
  } catch (err) {
    logger.error('Cannot connect to database', { error: err.message });
    process.exit(1);
  }

  // Initialize GameEngine with all game plugins
  await initEngine();

  const bot = createBot();
  const { app, stopScheduler } = createServer(bot);
  const server = app.listen(config.port, () => {
    logger.info(`${config.appName} HTTP listening`, { port: config.port });
  });

  if (config.telegram.mode === 'webhook') {
    if (!config.telegram.webhookUrl) {
      logger.error('TELEGRAM_WEBHOOK_URL is required when TELEGRAM_MODE=webhook');
      process.exit(1);
    }
    try {
      await bot.api.setWebhook(config.telegram.webhookUrl);
      logger.info('webhook set', { url: config.telegram.webhookUrl });
    } catch (err) {
      logger.error('failed to set webhook', { error: err.message });
      process.exit(1);
    }
  }

  const stop = async (signal) => {
    logger.info(`received ${signal}, shutting down`);
    if (stopScheduler) stopScheduler();
    if (config.telegram.mode === 'webhook') {
      try { await bot.api.deleteWebhook(); } catch {}
    }
    await bot.stop();
    server.close();
    await closeDb();
    process.exit(0);
  };

  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));

  if (config.telegram.mode === 'polling') {
    bot.start({
      onStart: (info) => logger.info('bot started (long polling)', { username: info.username }),
      drop_pending_updates: true,
    });
  } else {
    logger.info('bot running in webhook mode');
  }
}

main().catch((err) => {
  logger.error('fatal startup error', { error: err.message });
  process.exit(1);
});
