import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import * as API from '../api.jsx';
import { LoadingSpinner, PageHeader, Toolbar, MetricPill, formatDateShort } from '../components/Utils.jsx';
import { TableCard, Pagination, DropdownMenu } from '../components/TableComponents.jsx';
import { ToastContext, SearchContext } from '../App.jsx';

export default function Ratings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const { addToast } = useContext(ToastContext);
  const { query } = useContext(SearchContext);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items, pagination } = await API.listRatings({ limit, offset: page * limit }).catch(() => ({ items: [], pagination: null }));
      setItems(items || []);
      setTotal(pagination?.total || items?.length || 0);
    } catch (err) { addToast('Error: ' + err.message, 'error'); }
    finally { setLoading(false); }
  }, [page, limit]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(r =>
      String(r.id).includes(q) ||
      (r.spot_address || '').toLowerCase().includes(q) ||
      (r.driver_name || '').toLowerCase().includes(q) ||
      (r.comment || '').toLowerCase().includes(q) ||
      String(r.score || '').includes(q)
    );
  }, [items, query]);

  if (loading) return <LoadingSpinner text="Loading ratings..." />;

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Ratings"
        description="Review parking feedback, spot quality signals, and moderation actions."
        actions={
          <button onClick={load} className="btn-secondary">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 6a5 5 0 1 0 1 3"/><path d="M13 2v4h-4"/></svg>
            Refresh
          </button>
        }
        meta={[
          <MetricPill key="loaded" label="Loaded ratings" value={items.length} />,
          <MetricPill key="visible" label="Visible rows" value={filtered.length} />,
          <MetricPill key="high" label="4+ scores" value={items.filter(r => Number(r.score) >= 4).length} />,
          <MetricPill key="low" label="Low scores" value={items.filter(r => Number(r.score) > 0 && Number(r.score) < 3).length} />,
        ]}
      />
      <Toolbar resultText={query.trim() && items.length !== filtered.length ? `Showing ${filtered.length} of ${items.length} ratings` : null} />
      <TableCard headers={['ID', 'Spot', 'Driver', 'Score', 'Comment', 'Date', '']}
        rows={filtered.map(r => [
          <span key="id" className="text-xs font-mono text-muted-light">#{r.id}</span>,
          <span key="sp" className="text-xs">{r.spot_address || '#' + r.spot_id}</span>,
          <span key="dr" className="text-xs">{r.driver_name || '-'}</span>,
          <span key="sc" className={`inline-flex items-center gap-0.5 text-xs font-bold ${r.score >= 4 ? 'text-emerald-600' : r.score >= 3 ? 'text-amber-600' : 'text-rose-600'}`}>{r.score || '-'}/5</span>,
          <span key="cm" className="text-xs truncate block max-w-[180px] text-muted-light" title={r.comment || ''}>{(r.comment || '-').slice(0, 40)}</span>,
          <span key="dt" className="text-xs text-muted-light">{formatDateShort(r.created_at)}</span>,
          <DropdownMenu key="ac" items={[
            { label: 'Delete Rating', onClick: () => window.confirm('Delete this rating?') && API.deleteRating(r.id).then(() => { addToast('Deleted', 'warning'); load(); }).catch(e => addToast(e.message, 'error')) },
          ]} />
        ])}
      />
      <Pagination page={page} totalPages={Math.ceil(total / limit)} total={total} onPageChange={setPage} />
    </>
  );
}
