import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import * as API from '../api.jsx';
import { StatusBadge, LoadingSpinner, PageHeader, Toolbar, DetailGrid, MetricPill, selectClass, inputClass, formatDate, formatDateShort, formatCurrency } from '../components/Utils.jsx';
import { TableCard, Pagination, DropdownMenu } from '../components/TableComponents.jsx';
import Modal from '../components/Modal.jsx';
import { ToastContext, SearchContext } from '../App.jsx';

export default function Bookings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editBooking, setEditBooking] = useState(null);
  const [saving, setSaving] = useState(false);
  const limit = 20;
  const { addToast } = useContext(ToastContext);
  const { query } = useContext(SearchContext);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit, offset: page * limit };
      if (status) params.status = status;
      if (paymentStatus) params.paymentStatus = paymentStatus;
      const { items, pagination } = await API.listBookings(params);
      setItems(items || []);
      setTotal(pagination?.total || items?.length || 0);
    } catch (err) { addToast('Error: ' + err.message, 'error'); }
    finally { setLoading(false); }
  }, [status, paymentStatus, page, limit]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(b =>
      String(b.id).includes(q) ||
      (b.spot_address || '').toLowerCase().includes(q) ||
      (b.driver_name || '').toLowerCase().includes(q) ||
      (b.status || '').toLowerCase().includes(q) ||
      (b.payment_status || '').toLowerCase().includes(q) ||
      (b.confirmation_code || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setSaving(true);
    try {
      await API.createBooking({
        driverId: parseInt(fd.get('driverId')),
        spotId: parseInt(fd.get('spotId')),
        startTime: fd.get('startTime'),
        endTime: fd.get('endTime'),
        totalPrice: parseFloat(fd.get('totalPrice') || '0'),
        status: fd.get('status') || 'reserved',
        paymentStatus: fd.get('paymentStatus') || 'unpaid',
        confirmationCode: fd.get('confirmationCode'),
      });
      addToast('Booking created', 'success');
      setShowCreate(false);
      load();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    if (fd.get('status')) body.status = fd.get('status');
    if (fd.get('payment_status')) body.payment_status = fd.get('payment_status');
    if (fd.get('start_time')) body.start_time = fd.get('start_time');
    if (fd.get('end_time')) body.end_time = fd.get('end_time');
    const tp = fd.get('total_price');
    if (tp) body.total_price = parseFloat(tp);
    const cc = fd.get('confirmation_code');
    if (cc) body.confirmation_code = cc;
    setSaving(true);
    try {
      await API.updateBooking(editBooking.id, body);
      addToast('Booking updated', 'success');
      setEditBooking(null);
      load();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner text="Loading bookings..." />;

  return (
    <>
      <PageHeader
        eyebrow="Management"
        title="Bookings"
        description="Track active reservations, payment state, confirmation codes, and cancellations."
        actions={
          <>
            <button onClick={load} className="btn-secondary">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 6a5 5 0 1 0 1 3"/><path d="M13 2v4h-4"/></svg>
              Refresh
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
              New Booking
            </button>
          </>
        }
        meta={[
          <MetricPill key="loaded" label="Loaded bookings" value={items.length} />,
          <MetricPill key="visible" label="Visible rows" value={filtered.length} />,
          <MetricPill key="paid" label="Paid" value={items.filter(b => b.payment_status === 'paid').length} />,
          <MetricPill key="active" label="Active" value={items.filter(b => b.status === 'active').length} />,
        ]}
      />
      <Toolbar resultText={query.trim() && items.length !== filtered.length ? `Showing ${filtered.length} of ${items.length} bookings` : null}>
        <select id="booking-status-filter" name="booking-status-filter" aria-label="Filter by status" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className={selectClass}>
          <option value="">All Status</option>
          <option value="reserved">Reserved</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
        <select id="booking-payment-filter" name="booking-payment-filter" aria-label="Filter by payment status" value={paymentStatus} onChange={e => { setPaymentStatus(e.target.value); setPage(0); }}
          className={selectClass}>
          <option value="">All Payment</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="refunded">Refunded</option>
        </select>
      </Toolbar>
      <TableCard headers={['ID', 'Spot', 'Driver', 'Status', 'Payment', 'Amount', 'Time', '']}
        rows={filtered.map(b => [
          <span key="id" className="text-xs font-mono text-muted-light">#{b.id}</span>,
          <span key="sp" className="text-xs truncate block max-w-[140px]" title={b.spot_address || ''}>{b.spot_address || '#' + b.spot_id}</span>,
          <span key="dr" className="text-xs">{b.driver_name || '-'}</span>,
          <StatusBadge key="st" status={b.status} />,
          <StatusBadge key="pm" status={b.payment_status || 'unpaid'} />,
          <span key="am" className="font-semibold text-xs">{formatCurrency(b.total_amount || b.amount)}</span>,
          <span key="tm" className="text-xs text-muted-light">{formatDateShort(b.start_time)}</span>,
          <DropdownMenu key="ac" items={[
            { label: 'View Details', onClick: () => API.getBooking(b.id).then(setDetail).catch(e => addToast(e.message, 'error')) },
            { label: 'Edit', onClick: () => setEditBooking(b) },
            ...(b.status !== 'cancelled' ? [{ label: 'Cancel Booking', onClick: () => { const r = prompt('Cancellation reason:'); if (r !== null) { window.confirm('Cancel this booking?') && API.cancelBooking(b.id, r).then(() => { addToast('Cancelled', 'warning'); load(); }).catch(e => addToast(e.message, 'error')); } } }] : []),
          ]} />
        ])}
      />
      <Pagination page={page} totalPages={Math.ceil(total / limit)} total={total} onPageChange={setPage} />

      {/* Create Booking Modal */}
      {showCreate && (
        <Modal title="Create Booking" onClose={() => !saving && setShowCreate(false)}>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="create-booking-driver" className="block text-xs font-medium text-muted-light mb-1">Driver ID *</label>
              <input id="create-booking-driver" name="driverId" type="number" min="1" required autoComplete="off" className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-booking-spot" className="block text-xs font-medium text-muted-light mb-1">Spot ID *</label>
              <input id="create-booking-spot" name="spotId" type="number" min="1" required autoComplete="off" className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-booking-start" className="block text-xs font-medium text-muted-light mb-1">Start Time *</label>
              <input id="create-booking-start" name="startTime" type="datetime-local" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-booking-end" className="block text-xs font-medium text-muted-light mb-1">End Time *</label>
              <input id="create-booking-end" name="endTime" type="datetime-local" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-booking-price" className="block text-xs font-medium text-muted-light mb-1">Total Price (ETB)</label>
              <input id="create-booking-price" name="totalPrice" type="number" min="0" step="0.01" className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-booking-code" className="block text-xs font-medium text-muted-light mb-1">Confirm. Code</label>
              <input id="create-booking-code" name="confirmationCode" autoComplete="off" className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-booking-status" className="block text-xs font-medium text-muted-light mb-1">Status</label>
              <select id="create-booking-status" name="status" className={inputClass}>
                <option value="reserved">Reserved</option>
                <option value="confirmed">Confirmed</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label htmlFor="create-booking-payment" className="block text-xs font-medium text-muted-light mb-1">Payment Status</label>
              <select id="create-booking-payment" name="paymentStatus" className={inputClass}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setShowCreate(false)} disabled={saving}
                className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving}
                className="btn-primary">{saving ? 'Creating...' : 'Create Booking'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Booking Modal */}
      {editBooking && (
        <Modal title={`Edit Booking #${editBooking.id}`} onClose={() => !saving && setEditBooking(null)}>
          <form onSubmit={handleEdit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-booking-status" className="block text-xs font-medium text-muted-light mb-1">Status</label>
              <select id="edit-booking-status" name="status" defaultValue={editBooking.status} className={inputClass}>
                <option value="reserved">Reserved</option>
                <option value="confirmed">Confirmed</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-booking-payment" className="block text-xs font-medium text-muted-light mb-1">Payment Status</label>
              <select id="edit-booking-payment" name="payment_status" defaultValue={editBooking.payment_status || 'unpaid'} className={inputClass}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-booking-start" className="block text-xs font-medium text-muted-light mb-1">Start Time</label>
              <input id="edit-booking-start" name="start_time" type="datetime-local" defaultValue={editBooking.start_time ? editBooking.start_time.slice(0, 16) : ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-booking-end" className="block text-xs font-medium text-muted-light mb-1">End Time</label>
              <input id="edit-booking-end" name="end_time" type="datetime-local" defaultValue={editBooking.end_time ? editBooking.end_time.slice(0, 16) : ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-booking-price" className="block text-xs font-medium text-muted-light mb-1">Total Price</label>
              <input id="edit-booking-price" name="total_price" type="number" min="0" step="0.01" defaultValue={editBooking.total_amount || editBooking.total_price || ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-booking-code" className="block text-xs font-medium text-muted-light mb-1">Confirm. Code</label>
              <input id="edit-booking-code" name="confirmation_code" defaultValue={editBooking.confirmation_code || ''} autoComplete="off" className={inputClass} />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setEditBooking(null)} disabled={saving}
                className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving}
                className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`Booking #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="mb-5 flex items-center gap-3 pb-4 border-b border-line">
            <StatusBadge status={detail.status} />
          </div>
          <DetailGrid
            items={[
              ['ID', detail.id], ['Status', <StatusBadge key="s" status={detail.status} />],
              ['Spot', detail.spot_address || '#' + detail.spot_id], ['Driver', detail.driver_name || '-'],
              ['Start', formatDate(detail.start_time)], ['End', formatDate(detail.end_time)],
              ['Amount', formatCurrency(detail.total_amount || detail.amount)],
              ['Payment', <StatusBadge key="p" status={detail.payment_status || 'unpaid'} />],
              ['Confirmation', detail.confirmation_code || '-'], ['Created', formatDate(detail.created_at)],
            ]}
          />
          {detail.cancellation_reason && (
            <div className="mt-4 bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="text-xs text-rose-600 font-semibold mb-1">Cancellation Reason</div>
              <p className="text-sm text-ink">{detail.cancellation_reason}</p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
