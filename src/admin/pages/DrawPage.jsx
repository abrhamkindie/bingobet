import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import * as API from '../api.jsx';
import { ToastContext } from '../App.jsx';

export default function DrawPage() {
  const { id } = useParams();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useContext(ToastContext);

  const loadGame = async () => {
    try {
      const data = await API.getGame(id);
      setGame(data.game || data);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { loadGame(); }, [id]);

  const handleDraw = async () => {
    try {
      await API.drawGame(id);
      addToast('Draw completed!', 'success');
      loadGame();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;
  if (!game) return <div className="p-6 text-slate-400">Game not found.</div>;

  const tiers = typeof game.prize_tiers === 'string' ? JSON.parse(game.prize_tiers) : game.prize_tiers;

  return (
    <div className="p-6">
      <div className="mb-6">
        <a href="/admin/games" className="text-sm text-emerald-400 hover:text-emerald-300">← Back to Games</a>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">{game.title}</h1>
        <p className="mt-1 text-slate-400">{game.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox label="Status" value={game.status} />
        <StatBox label="Tickets Sold" value={`${game.tickets_sold}/${game.max_tickets}`} />
        <StatBox label="Prize Pool" value={`${Number(game.prize_pool).toFixed(0)} ETB`} />
        <StatBox label="Ticket Price" value={`${game.ticket_price} ETB`} />
        <StatBox label="Number Range" value={`${game.number_min}-${game.number_max}`} />
        <StatBox label="Per Ticket" value={`${game.numbers_per_ticket} numbers`} />
        <StatBox label="Numbers to Draw" value={game.numbers_to_draw} />
        <StatBox label="Platform Fee" value={`${game.platform_fee_percent}%`} />
        <StatBox label="Winners" value={game.winner_count || 0} />
        <StatBox label="Total Payout" value={`${Number(game.total_payout || 0).toFixed(0)} ETB`} />
        <StatBox label="Draw Type" value={game.draw_type} />
        <StatBox label="Max Per Player" value={game.max_tickets_per_player} />
      </div>

      {game.drawn_numbers && game.drawn_numbers.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Drawn Numbers</h2>
          <div className="flex flex-wrap gap-3">
            {game.drawn_numbers.map((n, i) => (
              <span key={i}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
                {String(n).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
      )}

      {tiers && (
        <div className="mt-6 rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Prize Tiers</h2>
          <div className="space-y-2">
            {tiers.map((tier, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-4 py-2">
                <span className="text-white">Match {tier.match}</span>
                <span className="text-emerald-400">
                  {tier.is_jackpot ? '💰 JACKPOT!' : `${tier.payout_multiplier}x`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {game.status === 'active' && (
        <button onClick={handleDraw}
          className="mt-6 w-full rounded-lg bg-amber-600 px-6 py-3 text-lg font-bold text-white hover:bg-amber-500">
          🎲 Start Draw Now
        </button>
      )}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
