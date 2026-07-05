import React, { useState, useEffect, useContext } from 'react';
import * as API from '../api.jsx';
import { ToastContext } from '../App.jsx';

export default function Games() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', ticketPrice: 50, maxTickets: 1000,
    maxPerPlayer: 10, numberMin: 1, numberMax: 50,
    numbersPerTicket: 6, numbersToDraw: 6, drawType: 'scheduled',
    platformFeePercent: 10,
  });
  const { addToast } = useContext(ToastContext);

  const loadGames = async () => {
    try {
      const data = await API.getGames({ limit: 50 });
      setGames(data.games || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { loadGames(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await API.createGame(form);
      addToast('Game created!', 'success');
      setShowCreate(false);
      loadGames();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDraw = async (gameId) => {
    try {
      await API.drawGame(gameId);
      addToast('Draw completed!', 'success');
      loadGames();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Games</h1>
        <button onClick={() => setShowCreate(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
          + New Game
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-xl border border-slate-700/50 bg-slate-800/50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Create Game</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="col-span-full">
              <label className="mb-1 block text-sm text-slate-400">Title</label>
              <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Ticket Price (ETB)</label>
              <input type="number" value={form.ticketPrice} onChange={e => setForm({...form, ticketPrice: Number(e.target.value)})}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Max Tickets</label>
              <input type="number" value={form.maxTickets} onChange={e => setForm({...form, maxTickets: Number(e.target.value)})}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Max Per Player</label>
              <input type="number" value={form.maxPerPlayer} onChange={e => setForm({...form, maxPerPlayer: Number(e.target.value)})}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Number Range</label>
              <div className="flex gap-2">
                <input type="number" value={form.numberMin} onChange={e => setForm({...form, numberMin: Number(e.target.value)})}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white" />
                <span className="self-center text-slate-500">-</span>
                <input type="number" value={form.numberMax} onChange={e => setForm({...form, numberMax: Number(e.target.value)})}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Numbers per Ticket</label>
              <input type="number" value={form.numbersPerTicket} onChange={e => setForm({...form, numbersPerTicket: Number(e.target.value)})}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Numbers to Draw</label>
              <input type="number" value={form.numbersToDraw} onChange={e => setForm({...form, numbersToDraw: Number(e.target.value)})}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Draw Type</label>
              <select value={form.drawType} onChange={e => setForm({...form, drawType: e.target.value})}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white">
                <option value="scheduled">Scheduled</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400">Platform Fee %</label>
              <input type="number" value={form.platformFeePercent} onChange={e => setForm({...form, platformFeePercent: Number(e.target.value)})}
                className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white" />
            </div>
            <div className="col-span-full flex gap-3">
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                Create Game
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {games.length === 0 ? (
          <p className="text-slate-400">No games yet.</p>
        ) : games.map(game => (
          <div key={game.id} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">{game.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-400">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    game.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                    game.status === 'completed' ? 'bg-slate-500/20 text-slate-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>{game.status}</span>
                  <span>{game.tickets_sold}/{game.max_tickets} tickets</span>
                  <span>{game.ticket_price} ETB each</span>
                  <span>Pool: {Number(game.prize_pool).toFixed(0)} ETB</span>
                </div>
              </div>
              <div className="flex gap-2">
                {game.status === 'active' && (
                  <button onClick={() => handleDraw(game.id)}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500">
                    Draw Now
                  </button>
                )}
                <a href={`/admin/games/${game.id}`}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
                  View
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
