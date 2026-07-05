import React, { useState, useEffect } from 'react';
import * as API from '../api.jsx';

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.getOverview().then(setOverview).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-400">Loading...</div>;
  }

  const stats = overview || {};

  const cards = [
    { label: 'Total Players', value: stats.total_players || 0, color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    { label: 'Active Games', value: stats.active_games || 0, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    { label: 'Total Revenue', value: `${stats.total_revenue || 0} ETB`, color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
    { label: 'Total Payout', value: `${stats.total_payout || 0} ETB`, color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    { label: 'Tickets Sold', value: stats.total_tickets || 0, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
    { label: 'Winners', value: stats.total_winners || 0, color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-white">BetBingo Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(card => (
          <div key={card.label} className={`rounded-xl border p-5 ${card.color}`}>
            <p className="text-sm opacity-80">{card.label}</p>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-slate-700/50 bg-slate-800/30 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/admin/games" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Manage Games
          </a>
          <a href="/admin/players" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
            View Players
          </a>
          <a href="/admin/transactions" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500">
            Transactions
          </a>
        </div>
      </div>
    </div>
  );
}
