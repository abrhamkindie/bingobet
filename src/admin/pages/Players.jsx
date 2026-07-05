import React, { useState, useEffect, useContext } from 'react';
import * as API from '../api.jsx';
import { ToastContext } from '../App.jsx';

export default function Players() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useContext(ToastContext);

  const loadPlayers = async () => {
    try {
      const data = await API.getPlayers({ limit: 50 });
      setPlayers(data.players || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { loadPlayers(); }, []);

  const handleBan = async (id) => {
    try {
      await API.banPlayer(id);
      addToast('Player banned', 'info');
      loadPlayers();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleUnban = async (id) => {
    try {
      await API.unbanPlayer(id);
      addToast('Player unbanned', 'success');
      loadPlayers();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-white">Players</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th className="pb-3 pr-4">ID</th>
              <th className="pb-3 pr-4">Name</th>
              <th className="pb-3 pr-4">Username</th>
              <th className="pb-3 pr-4">Balance</th>
              <th className="pb-3 pr-4">Tickets</th>
              <th className="pb-3 pr-4">Total Won</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p => (
              <tr key={p.id} className="border-b border-slate-800 text-white">
                <td className="py-3 pr-4">{p.id}</td>
                <td className="py-3 pr-4">{p.name || '—'}</td>
                <td className="py-3 pr-4">@{p.username || '—'}</td>
                <td className="py-3 pr-4">{Number(p.wallet_balance).toFixed(0)} ETB</td>
                <td className="py-3 pr-4">{p.ticket_count || 0}</td>
                <td className="py-3 pr-4">{Number(p.total_won).toFixed(0)} ETB</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    p.is_banned ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>{p.is_banned ? 'Banned' : 'Active'}</span>
                </td>
                <td className="py-3 pr-4">
                  {p.is_banned ? (
                    <button onClick={() => handleUnban(p.id)}
                      className="rounded bg-emerald-600/20 px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-600/30">
                      Unban
                    </button>
                  ) : (
                    <button onClick={() => handleBan(p.id)}
                      className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-400 hover:bg-red-600/30">
                      Ban
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
