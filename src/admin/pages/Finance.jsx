import React, { useState, useEffect, useContext } from 'react';
import * as API from '../api.jsx';
import { KpiCard, LoadingSpinner, PageHeader, MetricPill, inputClass, textareaClass, formatCurrency } from '../components/Utils.jsx';
import { TableCard } from '../components/TableComponents.jsx';
import Modal from '../components/Modal.jsx';
import { ToastContext } from '../App.jsx';

export default function Finance() {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { addToast } = useContext(ToastContext);

  const load = async () => {
    setLoading(true);
    try {
      const data = await API.getBalances();
      setBalances(Array.isArray(data) ? data : []);
    } catch (err) { addToast('Error: ' + err.message, 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalDue = balances.reduce((s, b) => s + Number(b.balance_due || b.amount_due || 0), 0);
  const totalPaid = balances.reduce((s, b) => s + Number(b.total_paid || 0), 0);

  if (loading) return <LoadingSpinner text="Loading finance..." />;

  return (
    <>
      <PageHeader
        eyebrow="Financial"
        title="Finance"
        description="Track host balances, payouts, and platform settlement obligations."
        actions={
          <>
            <button onClick={load} className="btn-secondary">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 6a5 5 0 1 0 1 3"/><path d="M13 2v4h-4"/></svg>
              Refresh
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
              Create Payout
            </button>
          </>
        }
        meta={[
          <MetricPill key="due" label="Total due" value={formatCurrency(totalDue)} />,
          <MetricPill key="paid" label="Total paid" value={formatCurrency(totalPaid)} />,
          <MetricPill key="hosts" label="Active hosts" value={balances.length} />,
          <MetricPill key="ready" label="Ready payouts" value={balances.filter(b => Number(b.balance_due || b.amount_due || 0) > 0).length} />,
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Due to Hosts" value={formatCurrency(totalDue)}
          icon={<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path d="M10 1v18M15 5H8a3 3 0 1 0 0 6h4a3 3 0 1 1 0 6H5"/></svg>}
          color="from-amber-500 to-amber-600" />
        <KpiCard label="Total Paid Out" value={formatCurrency(totalPaid)}
          icon={<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path d="M4 8a4 4 0 0 1 8 0M8 12V4M6 6l2-2 2 2"/></svg>}
          color="from-green-500 to-green-600" />
        <KpiCard label="Active Hosts" value={balances.length}
          icon={<svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path d="M14 8a4 4 0 0 0-8 0"/><path d="M2 18a8 8 0 0 1 16 0"/></svg>}
          color="from-blue-500 to-blue-600" />
      </div>

      <TableCard title="Host Balances" headers={['Host ID', 'Host Name', 'Amount Due', 'Total Paid', '']}
        rows={balances.map(b => {
          const due = Number(b.balance_due || b.amount_due || 0);
          return [
            <span key="id" className="text-xs font-mono text-muted-light">#{b.host_id || b.id}</span>,
            <span key="nm" className="text-xs">{b.host_name || 'Host #' + (b.host_id || b.id)}</span>,
            <span key="du" className="font-semibold text-xs">{formatCurrency(due)}</span>,
            <span key="pd" className="text-xs text-muted-light">{formatCurrency(b.total_paid)}</span>,
            due > 0
              ? <button key="ac" onClick={() => window.confirm('Pay ' + formatCurrency(due) + ' to ' + (b.host_name || '') + '?') && API.createPayout(Number(b.host_id || b.id), Number(due), 'Auto payout').then(() => { addToast('Payout created', 'success'); load(); }).catch(e => addToast(e.message, 'error'))}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-primary rounded-lg bg-primary text-white text-[11px] font-semibold cursor-pointer hover:bg-primary-600">Pay Out</button>
              : null,
          ];
        })}
      />

      {showCreate && (
        <Modal title="Create Payout" onClose={() => setShowCreate(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            const hostId = parseInt(fd.get('hostId'));
            const amount = parseFloat(fd.get('amount'));
            const note = fd.get('note') || '';
            if (!hostId || !amount) { addToast('Host ID and amount required', 'error'); return; }
            try {
              await API.createPayout(hostId, amount, note);
              addToast('Payout created', 'success');
              setShowCreate(false);
              load();
            } catch (err) { addToast(err.message, 'error'); }
          }}>
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-light mb-1.5">Host ID</label>
              <input name="hostId" type="number" min="1" required className={inputClass} />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-light mb-1.5">Amount (ETB)</label>
              <input name="amount" type="number" min="1" step="0.01" required className={inputClass} />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-light mb-1.5">Note</label>
              <textarea name="note" rows="2" className={`${textareaClass} min-h-[72px]`}></textarea>
            </div>
            <button type="submit" className="btn-primary">Create Payout</button>
          </form>
        </Modal>
      )}
    </>
  );
}
