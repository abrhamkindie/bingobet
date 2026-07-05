import React, { useContext, useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AuthContext } from '../App.jsx';
import * as API from '../api.jsx';
import logoMark from '../assets/logo2.png';

const navItems = [
  { section: 'Overview', items: [
    { to: '/dashboard', label: 'Dashboard', icon: 'M3 3h7v7H3zm11 0h7v7h-7zm0 11h7v7h-7zm-11 0h7v7H3z' },
  ]},
  { section: 'Management', items: [
    { to: '/spots', label: 'Spots', icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z' },
    { to: '/bookings', label: 'Bookings', icon: 'M8 2v4h8V2M3 6h18v14H3zm0 7h18' },
    { to: '/users', label: 'Users', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 8a8 8 0 0 1 16 0' },
  ]},
  { section: 'Financial', items: [
    { to: '/payments', label: 'Payments', icon: 'M1 5h22v14H1zm0 7h22' },
    { to: '/finance', label: 'Finance', icon: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  ]},
  { section: 'Support', items: [
    { to: '/tickets', label: 'Tickets', icon: 'M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9zM7 9h10M7 12h7M7 15h4' },
    { to: '/disputes', label: 'Disputes', icon: 'M12 2l3 3h4v4l3 3-3 3v4h-4l-3 3-3-3H5v-4l-3-3 3-3V5h4z' },
    { to: '/ratings', label: 'Ratings', icon: 'M12 2l3 6 6 1-4.5 4.5L17 20l-5-3-5 3 1.5-6.5L4 9l6-1z' },
  ]},
];

export default function Sidebar({ onLogout }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const [counts, setCounts] = useState({ pending_spots: 0, open_disputes: 0, open_tickets: 0 });

  useEffect(() => {
    const fetchCounts = () => {
      API.getAnalyticsOverview()
        .then(data => {
          setCounts({
            pending_spots: Number(data.pending_spots || 0),
            open_disputes: Number(data.open_disputes || 0),
            open_tickets: Number(data.open_tickets || 0),
          });
        })
        .catch(() => {});
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 45000);
    return () => clearInterval(interval);
  }, []);

  const badge = (count) => count > 0
    ? <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#eef2ff] text-[#4f46e5] text-[10px] font-bold leading-none">{count > 99 ? '99+' : count}</span>
    : null;

  const NavIcon = ({ paths }) => (
    <svg className="shrink-0" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths} />
    </svg>
  );

  return (
    <aside id="sidebar" className="w-64 bg-white text-ink flex flex-col shrink-0 overflow-y-auto relative z-10 border-r border-line shadow-sidebar max-md:hidden max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-[120]">
      {/* Branding */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 px-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(79,70,229,0.25)]">
            <img src={logoMark} alt="ParkAddis logo" className="h-8 w-8 object-contain brightness-0 invert" />
          </div>
          <div className="min-w-0">
            <span className="text-base font-bold text-ink block leading-tight tracking-tight">ParkAddis</span>
            <span className="text-[10px] text-muted font-semibold uppercase tracking-[0.15em]">Admin Console</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-4 flex flex-col gap-0.5 overflow-y-auto">
        {navItems.map((group) => (
          <React.Fragment key={group.section}>
            <div className="text-[10px] text-muted font-semibold uppercase tracking-[0.12em] px-3 pt-5 pb-1.5">{group.section}</div>
            {group.items.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => document.querySelector('.app-layout')?.classList.remove('show-mobile-sidebar')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium no-underline transition-all duration-200 ${
                    isActive
                      ? 'text-[#4f46e5] bg-[#eef2ff]'
                      : 'text-muted hover:text-ink hover:bg-[#f8fafc]'
                  }`}
              >
                <span className={`shrink-0 flex items-center justify-center w-5 h-5 transition-colors ${
                    isActive ? 'text-[#4f46e5]' : 'text-muted'
                  }`}>
                    <NavIcon paths={item.icon} />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.to === '/spots' && badge(counts.pending_spots)}
                  {item.to === '/tickets' && badge(counts.open_tickets)}
                  {item.to === '/disputes' && badge(counts.open_disputes)}
                </NavLink>
              );
            })}
          </React.Fragment>
        ))}
      </nav>

      {/* User profile */}
      <div className="p-4 border-t border-line">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-muted border border-line mb-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink truncate">{user?.name || user?.email}</div>
            <div className="text-[10px] text-muted truncate capitalize">{user?.role || 'admin'}</div>
          </div>
        </div>
        <button onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-transparent border border-line rounded-lg text-xs text-muted font-semibold cursor-pointer transition-all hover:bg-danger-soft hover:text-danger hover:border-red-200 active:scale-[0.98]">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
