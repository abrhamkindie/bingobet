import React, { useState, useEffect } from 'react';
import * as API from '../api.jsx';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.getTransactions({ limit: 50 }).then(data => {
      setTransactions(data.transactions || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-slate-400">Loading...</div>;

  const typeColors = {
    deposit: 'text-emerald-400',
    ticket_purchase: 'text-blue-400',
    winnings: 'text-amber-400',
    withdrawal: 'text-red-400',
    refund: 'text-purple-400',
  };

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-white">Transactions</h1>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th className="pb-3 pr-4">ID</th>
              <th className="pb-3 pr-4">Player</th>
              <th className="pb-3 pr-4">Type</th>
              <th className="pb-3 pr-4">Amount</th>
              <th className="pb-3 pr-4">Balance</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3 pr-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className="border-b border-slate-800 text-white">
                <td className="py-3 pr-4">{tx.id}</td>
                <td className="py-3 pr-4">{tx.player_name || tx.player_id}</td>
                <td className={`py-3 pr-4 font-medium ${typeColors[tx.type] || 'text-slate-400'}`}>{tx.type}</td>
                <td className="py-3 pr-4">{Number(tx.amount).toFixed(0)} ETB</td>
                <td className="py-3 pr-4">{Number(tx.balance_after).toFixed(0)} ETB</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    tx.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    tx.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>{tx.status}</span>
                </td>
                <td className="py-3 pr-4 text-slate-400">{new Date(tx.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
