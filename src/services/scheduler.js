import cron from 'node-cron';
import * as gameRoundsRepo from '../db/repositories/gameRounds.js';
import { query } from '../db/index.js';
import { logger } from '../utils/logger.js';

let scheduledTasks = [];

async function checkScheduledDraws(bot) {
  logger.info('Checking for scheduled draws...');
  try {
    const games = await gameRoundsRepo.getScheduledDrawsDue();
    for (const game of games) {
      logger.info('Starting scheduled draw', { gameId: game.id, title: game.title });

      // Run the draw
      const { rows } = await query(`SELECT complete_game_draw($1) AS result`, [game.id]);
      const result = rows[0]?.result;

      // Notify players (best effort)
      if (bot && result) {
        try {
          // Get all tickets for this game to notify winners
          const { rows: tickets } = await query(
            `SELECT t.*, p.telegram_id, p.language_pref
             FROM tickets t
             JOIN players p ON p.id = t.player_id
             WHERE t.game_round_id = $1 AND t.is_winner = true`,
            [game.id]
          );

          for (const ticket of tickets) {
            try {
              const lang = ticket.language_pref || 'en';
              const text = `🎉 *CONGRATULATIONS!* You won ${ticket.prize_amount} ETB in '${game.title}'!\nYour ticket #${ticket.position} matched ${ticket.matched_count} numbers!`;
              await bot.api.sendMessage(Number(ticket.telegram_id), text, { parse_mode: 'Markdown' });
            } catch { /* best effort */ }
          }
        } catch { /* best effort */ }
      }

      logger.info('Scheduled draw completed', { gameId: game.id, result });
    }
  } catch (err) {
    logger.error('Scheduled draw check failed', { error: err.message });
  }
}

export function startScheduler(bot) {
  logger.info('Starting BetBingo scheduler...');
  const task = cron.schedule('* * * * *', () => { checkScheduledDraws(bot); });
  scheduledTasks.push(task);
  checkScheduledDraws(bot);
  return task;
}

export function stopScheduler() {
  scheduledTasks.forEach(t => t.stop());
  scheduledTasks = [];
  logger.info('Scheduler stopped');
}
