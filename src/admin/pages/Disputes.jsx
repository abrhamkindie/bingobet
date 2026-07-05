import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import * as API from '../api.jsx';
import { StatusBadge, LoadingSpinner, PageHeader, Toolbar, DetailGrid, MetricPill, selectClass, formatDate, formatDateShort } from '../components/Utils.jsx';
import { TableCard, Pagination, DropdownMenu } from '../components/TableComponents.jsx';
import Modal from '../components/Modal.jsx';
import { ToastContext, SearchContext } from '../App.jsx';

export default function Disputes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState(null);
  const limit = 20;
  const { addToast } = useContext(ToastContext);
  const { query } = useContext(SearchContext);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit, offset: page * limit };
      if (status) params.status = status;
      const { items, pagination } = await API.listDisputes(params);
      setItems(items || []); setTotal(pagination?.total || items?.length || 0);
    } catch (err) { addToast('Error: ' + err.message, 'error'); }
    finally { setLoading(false); }
  }, [status, page, limit]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(d =>
      String(d.id).includes(q) ||
      String(d.booking_id || '').includes(q) ||
      (d.reason || '').toLowerCase().includes(q) ||
      (d.raised_by_name || d.raised_by || '').toLowerCase().includes(q) ||
      (d.status || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  if (loading) return <LoadingSpinner text="Loading disputes..." />;

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Disputes"
        description="Resolve booking issues and keep a clear audit trail for customer escalations."
        actions={
          <button onClick={load} className="btn-secondary">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 6a5 5 0 1 0 1 3"/><path d="M13 2v4h-4"/></svg>
            Refresh
          </button>
        }
        meta={[
          <MetricPill key="loaded" label="Loaded disputes" value={items.length} />,
          <MetricPill key="visible" label="Visible rows" value={filtered.length} />,
          <MetricPill key="open" label="Open" value={items.filter(d => d.status === 'open').length} />,
          <MetricPill key="resolved" label="Resolved" value={items.filter(d => d.status === 'resolved').length} />,
        ]}
      />
      <Toolbar resultText={query.trim() && items.length !== filtered.length ? `Showing ${filtered.length} of ${items.length} disputes` : null}>
        <select id="dispute-status-filter" name="dispute-status-filter" aria-label="Filter by status" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className={selectClass}>
          <option value="">All Status</option><option value="open">Open</option><option value="resolved">Resolved</option>
        </select>
      </Toolbar>
      <TableCard headers={['ID', 'Booking', 'Raised By', 'Reason', 'Status', 'Date', '']}
        rows={filtered.map(d => [
          <span key="id" className="text-xs font-mono text-muted-light">#{d.id}</span>,
          <span key="bk" className="text-xs">{d.booking_id || '-'}</span>,
          <span key="rb" className="text-xs">{d.raised_by_name || d.raised_by || '-'}</span>,
          <span key="rs" className="text-xs truncate block max-w-[160px]" title={d.reason || ''}>{(d.reason || '-').slice(0, 50)}</span>,
          <StatusBadge key="st" status={d.status} />,
          <span key="dt" className="text-xs text-muted-light">{formatDateShort(d.created_at)}</span>,
          <DropdownMenu key="ac" items={[
            { label: 'View Details', onClick: () => API.getDispute(d.id).then(setDetail).catch(e => addToast(e.message, 'error')) },
            ...(d.status === 'open' ? [{ label: 'Resolve', onClick: () => { const r = prompt('Resolution:'); if (r) window.confirm('Resolve this dispute?') && API.resolveDispute(d.id, r).then(() => { addToast('Resolved', 'success'); load(); }).catch(e => addToast(e.message, 'error')); } }] : []),
          ]} />
        ])}
      />
      <Pagination page={page} totalPages={Math.ceil(total / limit)} total={total} onPageChange={setPage} />

      {detail && (
        <Modal title={`Dispute #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="mb-5 flex items-center gap-3 pb-4 border-b border-line">
            <StatusBadge status={detail.status} />
          </div>
          <DetailGrid
            items={[
              ['ID', detail.id], ['Booking', detail.booking_id || '-'],
              ['Status', <StatusBadge key="s" status={detail.status} />],
              ['Raised By', detail.raised_by_name || detail.raised_by || '-'],
              ['Reason', detail.reason || detail.description || '-'],
              ['Date', formatDate(detail.created_at)],
            ]}
          />
          {detail.resolution && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="text-xs text-emerald-600 font-semibold mb-1">Resolution</div>
              <p className="text-sm text-ink">{detail.resolution}</p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
