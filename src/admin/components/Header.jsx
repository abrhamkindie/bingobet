import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { SearchContext } from '../App.jsx';
import { ToastContext } from '../App.jsx';
import * as API from '../api.jsx';
import { formatDateShort } from './Utils.jsx';

export default function Header() {
  const { query, setQuery } = useContext(SearchContext);
  const { addToast } = useContext(ToastContext);
  const [inputVal, setInputVal] = useState(query);
  const [showNotif, setShowNotif] = useState(false);
  const [activity, setActivity] = useState([]);
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setQuery(inputVal);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [inputVal, setQuery]);

  const fetchActivity = useCallback(async () => {
    setLoadingNotif(true);
    try {
      const data = await API.getRecentActivity(15);
      const items = Array.isArray(data) ? data : [];
      setActivity(items);
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      setUnreadCount(items.filter(a => new Date(a.created_at || Date.now()).getTime() > dayAgo).length);
    } catch {
    } finally {
      setLoadingNotif(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 60000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const notifIcons = {
    booking: <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1"/><line x1="2" y1="7" x2="14" y2="7"/></svg>,
    payment: <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 5h14v10H1zm0 4h14"/></svg>,
    dispute: <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1v14M2 5l4 4-4 4M14 5l-4 4 4 4"/></svg>,
  };

  const notifColors = {
    booking: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
    payment: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
    dispute: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  };

  const activityLabel = (a) => {
    if (a.type === 'booking') return a.details ? `New booking at ${a.details}` : `Booking #${a.id}`;
    if (a.type === 'payment') return `Payment ${a.status} — ${a.reference || ''}`;
    if (a.type === 'dispute') return `Dispute: ${(a.reference || '').substring(0, 40)}`;
    return a.action || a.description || `Activity #${a.id}`;
  };

  const toggleMobileSidebar = () => {
    document.querySelector('.app-layout')?.classList.toggle('show-mobile-sidebar');
  };

  return (
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-line bg-white shrink-0 gap-4 relative z-20 max-md:px-4">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button onClick={toggleMobileSidebar}
          className="hidden max-md:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-muted hover:text-ink hover:bg-surface-muted transition-colors">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-light" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            type="text"
            placeholder="Search records..."
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            className="h-9 w-full pl-9 pr-8 rounded-lg border border-line bg-surface-muted text-ink text-sm placeholder:text-muted-light transition-colors focus:bg-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
          {inputVal && (
            <button
              onClick={() => { setInputVal(''); setQuery(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-light hover:text-ink transition-colors"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 h-9 rounded-lg border border-line bg-surface-muted px-3 text-xs text-muted-light">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          {new Date().toLocaleDateString('en-ET', { month: 'short', day: 'numeric' })}
        </div>
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotif(!showNotif); if (!showNotif) fetchActivity(); }}
            className="relative h-9 w-9 flex items-center justify-center rounded-lg border border-line bg-surface-muted text-muted cursor-pointer transition-all hover:bg-surface hover:text-ink active:scale-[0.97]"
            title="Recent activity"
          >
            <svg viewBox="0 0 20 20" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 2C7.5 2 5 4 5 8v3l-2 3h14l-2-3V8c0-4-2.5-6-5-6z"/>
              <path d="M8 16a2 2 0 0 0 4 0"/>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm ring-2 ring-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-line rounded-xl shadow-pop z-[200] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <span className="text-sm font-semibold text-ink">Recent Activity</span>
                <button onClick={fetchActivity} className="text-xs text-muted hover:text-ink bg-transparent border-none cursor-pointer transition-colors" title="Refresh">&#x21bb;</button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loadingNotif && activity.length === 0 ? (
                  <div className="flex items-center justify-center py-10"><div className="w-5 h-5 border-2 border-primary-tint border-t-primary rounded-full animate-spin"></div></div>
                ) : activity.length === 0 ? (
                  <div className="text-center py-10 text-muted text-xs">No recent activity</div>
                ) : (
                  activity.map((a, i) => {
                    const nc = notifColors[a.type] || { bg: 'bg-slate-100', text: 'text-muted', dot: 'bg-slate-400' };
                    const icon = notifIcons[a.type] || null;
                    return (
                      <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-line last:border-0 hover:bg-surface-muted transition-colors cursor-pointer">
                        <div className={`w-7 h-7 rounded-lg ${nc.bg} flex items-center justify-center shrink-0 ${nc.text}`}>{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-ink truncate">{activityLabel(a)}</div>
                          <div className="text-[10px] text-muted mt-0.5">{formatDateShort(a.created_at)}</div>
                        </div>
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${nc.dot}`}></span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
