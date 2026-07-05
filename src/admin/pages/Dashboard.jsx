import React, { useState, useEffect, useContext } from 'react';
import * as API from '../api.jsx';
import { KpiCard, LoadingSpinner, EmptyState, PageHeader, formatCurrency } from '../components/Utils.jsx';
import { BarChart, AreaChart, DonutChart, ChartCard } from '../components/Charts.jsx';
import { TableCard } from '../components/TableComponents.jsx';
import { ToastContext } from '../App.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addToast } = useContext(ToastContext);

  useEffect(() => {
    async function load() {
      try {
        const [overview, revenue, bookingStats, topSpots, activity] = await Promise.all([
          API.getAnalyticsOverview(),
          API.getAnalyticsRevenue().catch(() => null),
          API.getAnalyticsBookings().catch(() => null),
          API.getTopSpots(5).catch(() => []),
          API.getRecentActivity(10).catch(() => []),
        ]);
        const botUsage = await API.getBotUsageAnalytics(30).catch(() => null);
        setData({ overview, revenue, bookingStats, topSpots, activity, botUsage });
      } catch (err) {
        setError(err.message);
        addToast('Dashboard error: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner text="Loading dashboard..." />;
  if (error) return <EmptyState text="Failed to load dashboard" />;
  if (!data) return null;

  const { overview, revenue, bookingStats, topSpots, activity, botUsage } = data;
  const totalSpots = (overview.total_spots || 0) + (overview.active_spots || 0);

  const kpis = [
    { label: 'Total Users', value: overview.total_users || 0, trend: 12.5,
      icon: <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-7 9a7 7 0 0 1 14 0H3z"/></svg>,
      color: 'from-blue-500 to-blue-600' },
    { label: 'Parking Spots', value: overview.active_spots || 0, trend: 5.2,
      icon: <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><circle cx="10" cy="10" r="3"/><path d="M10 0C6.5 0 3 2.5 3 7c0 5 7 11 7 11s7-6 7-11c0-4.5-3.5-7-7-7z"/></svg>,
      color: 'from-emerald-500 to-emerald-600' },
    { label: 'Active Bookings', value: overview.active_bookings || 0, trend: -3.1,
      icon: <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><rect x="2" y="3" width="16" height="15" rx="2"/><line x1="2" y1="8" x2="18" y2="8" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/></svg>,
      color: 'from-violet-500 to-violet-600' },
    { label: 'Revenue', value: formatCurrency(overview.total_revenue), trend: 18.7,
      icon: <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path d="M10 1v18M15 5H8a3 3 0 1 0 0 6h4a3 3 0 1 1 0 6H5"/></svg>,
      color: 'from-amber-500 to-amber-600' },
    { label: 'Completed', value: overview.completed_bookings || 0, trend: 8.3,
      icon: <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><polygon points="10 1 12.5 6.5 18 7.5 14 11.5 15 17 10 14.5 5 17 6 11.5 2 7.5 7.5 6.5 10 1"/></svg>,
      color: 'from-cyan-500 to-cyan-600' },
    { label: 'Avg Rating', value: overview.avg_rating ? Number(overview.avg_rating).toFixed(1) : '\u2014', trend: 0.4,
      icon: <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><polygon points="10 1 12.5 6.5 18 7.5 14 11.5 15 17 10 14.5 5 17 6 11.5 2 7.5 7.5 6.5 10 1"/></svg>,
      color: 'from-rose-500 to-rose-600' },
  ];

  const totalBookings = overview.total_bookings || 0;
  const pendingSpots = overview.pending_spots || 0;
  const pendingPayouts = overview.pending_payouts || 0;
  const liveOccupancy = totalBookings > 0
    ? Math.min(100, Math.round(((overview.active_bookings || 0) / totalBookings) * 100))
    : 0;
  const botSummary = botUsage?.summary || {};
  const funnelMax = Math.max(...(botUsage?.funnel || []).map(s => Number(s.count || 0)), 1);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Dashboard"
        description="A live control view for parking supply, bookings, payments, and support activity."
        actions={
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-soft bg-surface border border-line rounded-lg px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live data
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 mb-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-6 text-white shadow-card-lg">
          <div className="absolute inset-0 opacity-30" aria-hidden="true">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:54px_54px]"></div>
            <div className="absolute left-[18%] top-0 h-full w-10 rotate-[18deg] bg-[#4f46e5]/30"></div>
            <div className="absolute bottom-16 left-0 h-9 w-full -rotate-[6deg] bg-[#6366f1]/25"></div>
          </div>
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-indigo-300">Today at a glance</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight">Addis parking network</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
                {totalBookings} bookings processed with {overview.active_bookings || 0} currently active and {overview.completed_bookings || 0} completed.
              </p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/12 px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">Occupancy signal</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">{liveOccupancy}%</p>
            </div>
          </div>
          <div className="relative mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ['Revenue', formatCurrency(overview.total_revenue)],
              ['Avg rating', overview.avg_rating ? Number(overview.avg_rating).toFixed(1) : '-'],
              ['Active spots', overview.active_spots || 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/55">{label}</p>
                <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Action queue</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Needs attention</h3>
            </div>
            <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-primary">Ops</span>
          </div>
          <div className="mt-5 space-y-3">
            {[
              ['Pending spot approvals', pendingSpots, 'bg-amber-50 text-amber-700'],
              ['Open disputes', overview.open_disputes || 0, 'bg-red-50 text-red-700'],
              ['Open tickets', overview.open_tickets || 0, 'bg-blue-50 text-blue-700'],
              ['Pending payouts', formatCurrency(pendingPayouts), 'bg-emerald-50 text-emerald-700'],
            ].map(([label, value, tone]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-line bg-surface-muted px-4 py-3">
                <span className="text-sm font-medium text-ink-soft">{label}</span>
                <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${tone}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-7">
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
        {bookingStats?.byStatus?.length > 0 && (
          <ChartCard title="Bookings by Status" subtitle="Distribution across all statuses">
            <BarChart items={bookingStats.byStatus.map(s => ({
              label: s.status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              value: Number(s.count),
              hex: s.status === 'completed' ? '#24a26a' : s.status === 'cancelled' ? '#d94a5e' : s.status === 'pending' ? '#d99a21' : s.status === 'active' || s.status === 'in_progress' ? '#27a3ad' : '#3b6ea8'
            }))} />
          </ChartCard>
        )}
        {bookingStats?.byPaymentMethod?.length > 0 && (
          <ChartCard title="Payment Methods" subtitle="Revenue by payment channel">
            <DonutChart items={bookingStats.byPaymentMethod.map(s => ({ label: s.method || 'unknown', value: Number(s.count) }))} />
          </ChartCard>
        )}
      </div>

      {botUsage && (
        <div className="mb-7">
          <PageHeader
            eyebrow="Bot Analytics"
            title="Telegram Bot Usage"
            description="Usage signals for whether the bot is being visited, searched, and converted into bookings."
            meta={[
              <div key="dau" className="rounded-lg border border-line bg-surface-muted px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Daily active</p>
                <p className="mt-1 text-sm font-semibold text-ink tabular-nums">{botSummary.daily_active_users || 0}</p>
              </div>,
              <div key="wau" className="rounded-lg border border-line bg-surface-muted px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Weekly active</p>
                <p className="mt-1 text-sm font-semibold text-ink tabular-nums">{botSummary.weekly_active_users || 0}</p>
              </div>,
              <div key="starts" className="rounded-lg border border-line bg-surface-muted px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Starts</p>
                <p className="mt-1 text-sm font-semibold text-ink tabular-nums">{botSummary.starts || 0}</p>
              </div>,
              <div key="last" className="rounded-lg border border-line bg-surface-muted px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Last activity</p>
                <p className="mt-1 text-sm font-semibold text-ink tabular-nums">
                  {botSummary.last_event_at ? new Date(botSummary.last_event_at).toLocaleDateString('en-ET', { month: 'short', day: 'numeric' }) : '-'}
                </p>
              </div>,
            ]}
          />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ChartCard title="Bot Active Users" subtitle="Daily active bot users over the selected window">
              <AreaChart data={(botUsage.trend || []).slice(0, 14).reverse().map(r => ({
                label: r.period,
                value: Number(r.active_users || 0),
              }))} />
            </ChartCard>

            <ChartCard title="Bot Funnel" subtitle="Unique users by key product step">
              <div className="space-y-3">
                {(botUsage.funnel || []).map((step) => {
                  const count = Number(step.count || 0);
                  const width = Math.max((count / funnelMax) * 100, count > 0 ? 5 : 0);
                  return (
                    <div key={step.step} className="grid grid-cols-[120px_1fr_48px] items-center gap-3 text-xs">
                      <span className="font-medium text-ink-soft truncate" title={step.label}>{step.label}</span>
                      <div className="h-7 rounded-lg border border-line bg-surface-muted overflow-hidden">
                        <div className="h-full rounded-lg bg-[#27a3ad]" style={{ width: `${width}%` }}></div>
                      </div>
                      <span className="text-right font-semibold text-ink tabular-nums">{count}</span>
                    </div>
                  );
                })}
              </div>
            </ChartCard>

            <ChartCard title="Top Bot Events" subtitle="Most common tracked actions">
              <BarChart items={(botUsage.breakdown || []).map((event) => ({
                label: String(event.event_name || '').replace(/_/g, ' '),
                value: Number(event.count || 0),
                hex: event.event_name === 'bot_update' ? '#8ed9bd' : '#27a3ad',
              }))} />
            </ChartCard>

            <ChartCard title="Bot Conversion Signals" subtitle="30-day activity counts">
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Unique users', botSummary.unique_users || 0],
                  ['Searches', botSummary.searches || 0],
                  ['Bookings', botSummary.bookings_created || 0],
                  ['Payments started', botSummary.payments_initiated || 0],
                  ['Support tickets', botSummary.support_tickets || 0],
                  ['Events', botSummary.total_events || 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-line bg-surface-muted p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
                    <p className="mt-2 text-xl font-bold text-ink tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {/* Revenue Chart */}
      {revenue?.length > 0 && (
        <div className="mb-7">
          <ChartCard title="Revenue Trend" subtitle="Daily revenue over the last 30 days">
            <AreaChart data={revenue.slice(0, 14).reverse().map(r => ({ label: r.period || r.date || '', value: Number(r.revenue || r.amount || 0) }))} />
          </ChartCard>
        </div>
      )}

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
        {topSpots?.length > 0 && (
          <ChartCard title="Top Performing Spots" subtitle="By booking volume and revenue">
            <TableCard headers={['#', 'Address', 'Bookings', 'Revenue', 'Rating']}
              rows={topSpots.map((s, i) => [
                <span key="r" className="text-muted-light text-xs font-mono">{String(i + 1).padStart(2, '0')}</span>,
                <span key="a" className="text-xs truncate block max-w-[150px]" title={s.address || ''}>{s.address || '-'}</span>,
                <span key="b" className="font-semibold text-xs tabular-nums">{s.booking_count || 0}</span>,
                <span key="v" className="text-xs tabular-nums">{formatCurrency(s.revenue)}</span>,
                <span key="t" className="text-xs tabular-nums">{s.avg_rating ? Number(s.avg_rating).toFixed(1) : '-'}</span>,
              ])}
            />
          </ChartCard>
        )}
        {activity?.length > 0 && (
          <ChartCard title="Recent Activity" subtitle="Latest platform events">
            <div className="flex flex-col">
              {activity.slice(0, 8).map((a, i) => {
                const dotClr = a.type === 'booking' ? 'bg-[#27a3ad]' : a.type === 'payment' ? 'bg-emerald-500' : a.type === 'dispute' ? 'bg-amber-500' : 'bg-slate-400';
                const dotBg = a.type === 'booking' ? 'bg-[#e7f4fb]' : a.type === 'payment' ? 'bg-emerald-50' : a.type === 'dispute' ? 'bg-[#fff7e6]' : 'bg-slate-100';
                return (
                  <div key={i} className="flex items-start gap-3 py-3 border-b border-line last:border-0 group hover:bg-surface-muted -mx-1 px-1 rounded-lg transition-colors">
                    <div className={`w-7 h-7 rounded-lg ${dotBg} flex items-center justify-center shrink-0`}>
                      <div className={`w-2 h-2 rounded-full ${dotClr}`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-ink truncate group-hover:text-brand transition-colors">{a.description || a.action || ''}</div>
                      <div className="text-[10px] text-muted mt-0.5">{new Date(a.created_at || a.timestamp).toLocaleDateString('en-ET', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        )}
      </div>
    </>
  );
}
