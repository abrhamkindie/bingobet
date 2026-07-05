import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Layout({ children, onLogout }) {
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: '📊' },
    { to: '/games', label: 'Games', icon: '🎯' },
    { to: '/players', label: 'Players', icon: '👥' },
    { to: '/transactions', label: 'Transactions', icon: '💰' },
  ];

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 p-4">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-emerald-400">BetBingo</h1>
          <p className="text-xs text-slate-500">Admin Console</p>
        </div>

        <nav className="space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-8 border-t border-slate-800 pt-4">
          <button onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white">
            🚪 Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
