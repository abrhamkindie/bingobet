import { Router } from 'express';
import { query as dbQuery } from '../../db/index.js';
import { authenticate } from '../../middlewares/auth.js';
import { success } from '../../utils/apiResponse.js';

export function createAdminDashboardRouter() {
  const router = Router();
  router.use(authenticate);

  router.get('/overview', async (req, res, next) => {
    try {
      const [players, games, tickets, revenue, payouts, winners] = await Promise.all([
        dbQuery("SELECT COUNT(*) FROM players"),
        dbQuery("SELECT COUNT(*) FROM game_rounds WHERE status IN ('upcoming', 'active', 'drawing')"),
        dbQuery("SELECT COUNT(*) FROM tickets"),
        dbQuery("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'deposit' AND status = 'completed'"),
        dbQuery("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'winnings' AND status = 'completed'"),
        dbQuery("SELECT COUNT(DISTINCT player_id) FROM tickets WHERE is_winner = true"),
      ]);

      const overview = {
        total_players: parseInt(players.rows[0].count, 10),
        active_games: parseInt(games.rows[0].count, 10),
        total_tickets: parseInt(tickets.rows[0].count, 10),
        total_revenue: Number(revenue.rows[0].coalesce),
        total_payout: Number(payouts.rows[0].coalesce),
        total_winners: parseInt(winners.rows[0].count, 10),
      };

      success(res, overview);
    } catch (err) { next(err); }
  });

  return router;
}
