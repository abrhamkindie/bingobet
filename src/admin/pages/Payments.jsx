import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import * as API from '../api.jsx';
import { StatusBadge, LoadingSpinner, PageHeader, Toolbar, MetricPill, selectClass, formatDateShort, formatCurrency } from '../components/Utils.jsx';
import { TableCard, Pagination, DropdownMenu } from '../components/TableComponents.jsx';
import { ToastContext, SearchContext } from '../App.jsx';

export default function Payments() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [method, setMethod] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const { addToast } = useContext(ToastContext);
  const { query } = useContext(SearchContext);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit, offset: page * limit };
      if (status) params.status = status;
      if (method) params.method = method;
      const { items, pagination } = await API.listPayments(params);
      setItems(items || []);
      setTotal(pagination?.total || items?.length || 0);
    } catch (err) { addToast('Error: ' + err.message, 'error'); }
    finally { setLoading(false); }
  }, [status, method, page]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(p =>
      String(p.id).includes(q) ||
      String(p.booking_id || '').includes(q) ||
      (p.transaction_ref || '').toLowerCase().includes(q) ||
      (p.payment_method || '').toLowerCase().includes(q) ||
      (p.status || '').toLowerCase().includes(q) ||
      String(p.amount || '').includes(q)
    );
  }, [items, query]);

  if (loading) return <LoadingSpinner text="Loading payments..." />;

  return (
    <>
      <PageHeader
        eyebrow="Financial"
        title="Payments"
        description="Monitor payment status, methods, references, and refund actions."
        actions={
          <button onClick={load} className="btn-secondary">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 6a5 5 0 1 0 1 3"/><path d="M13 2v4h-4"/></svg>
            Refresh
          </button>
        }
        meta={[
          <MetricPill key="loaded" label="Loaded payments" value={items.length} />,
          <MetricPill key="visible" label="Visible rows" value={filtered.length} />,
          <MetricPill key="paid" label="Paid" value={items.filter(p => p.status === 'paid').length} />,
          <MetricPill key="amount" label="Loaded value" value={formatCurrency(items.reduce((s, p) => s + Number(p.amount || 0), 0))} />,
        ]}
      />
      <Toolbar resultText={query.trim() && items.length !== filtered.length ? `Showing ${filtered.length} of ${items.length} payments` : null}>
        <select id="payment-status-filter" name="payment-status-filter" aria-label="Filter by status" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className={selectClass}>
          <option value="">All Status</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="pending">Pending</option><option value="refunded">Refunded</option>
        </select>
        <select id="payment-method-filter" name="payment-method-filter" aria-label="Filter by payment method" value={method} onChange={e => { setMethod(e.target.value); setPage(0); }}
          className={selectClass}>
          <option value="">All Methods</option><option value="chapa">Chapa</option><option value="cash">Cash</option><option value="manual">Manual</option>
        </select>
      </Toolbar>
      <TableCard headers={['ID', 'Booking', 'Amount', 'Method', 'Status', 'Reference', 'Date', '']}
        rows={filtered.map(p => [
          <span key="id" className="text-xs font-mono text-muted-light">#{p.id}</span>,
          <span key="bk" className="text-xs">{p.booking_id || '-'}</span>,
          <span key="am" className="font-semibold text-xs">{formatCurrency(p.amount)}</span>,
          <span key="mt" className="text-xs">{p.payment_method || '-'}</span>,
          <StatusBadge key="st" status={p.status} />,
          <span key="rf" className="text-xs text-muted-light">{p.transaction_ref || '-'}</span>,
          <span key="dt" className="text-xs text-muted-light">{formatDateShort(p.created_at)}</span>,
          <DropdownMenu key="ac" items={[
            ...(p.status === 'paid' ? [{ label: 'Refund', onClick: () => window.confirm('Refund?') && API.refundPayment(p.id).then(() => { addToast('Refunded', 'warning'); load(); }).catch(e => addToast(e.message, 'error')) }] : []),
          ]} />
        ])}
      />
      <Pagination page={page} totalPages={Math.ceil(total / limit)} total={total} onPageChange={setPage} />
    </>
  );
}
