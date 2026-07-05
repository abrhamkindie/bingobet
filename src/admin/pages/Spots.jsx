import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import * as API from '../api.jsx';
import { StatusBadge, LoadingSpinner, PageHeader, Toolbar, DetailGrid, MetricPill, selectClass, inputClass, checkboxClass, formatDate, formatDateShort, formatCurrency } from '../components/Utils.jsx';
import { TableCard, Pagination, DropdownMenu } from '../components/TableComponents.jsx';
import Modal from '../components/Modal.jsx';
import { ToastContext, SearchContext } from '../App.jsx';

export default function Spots() {
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editSpot, setEditSpot] = useState(null);
  const [saving, setSaving] = useState(false);
  const limit = 20;
  const { addToast } = useContext(ToastContext);
  const { query } = useContext(SearchContext);

  const filteredSpots = useMemo(() => {
    if (!query.trim()) return spots;
    const q = query.toLowerCase();
    return spots.filter(s =>
      String(s.id).includes(q) ||
      (s.address || '').toLowerCase().includes(q) ||
      (s.owner_name || '').toLowerCase().includes(q) ||
      (s.status || '').toLowerCase().includes(q) ||
      (s.price_per_hour || '').toString().includes(q)
    );
  }, [spots, query]);

  const filteredTotalPages = Math.ceil(filteredSpots.length / limit);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit, offset: page * limit };
      if (status) params.status = status;
      const { items, pagination } = await API.listSpots(params);
      setSpots(items || []);
      setTotal(pagination?.total || items?.length || 0);
    } catch (err) {
      addToast('Failed to load spots: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [status, page, limit]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (action, msg, successMsg) => {
    const confirmed = window.confirm(msg);
    if (!confirmed) return;
    try {
      await action();
      addToast(successMsg, 'success');
      load();
    } catch (err) { addToast(err.message, 'error'); }
  };

  if (loading) return <LoadingSpinner text="Loading spots..." />;

  const handleCreate = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setSaving(true);
    try {
      await API.createSpot({
        ownerId: parseInt(fd.get('ownerId')),
        address: fd.get('address'),
        lat: parseFloat(fd.get('lat')),
        lng: parseFloat(fd.get('lng')),
        pricePerHour: parseFloat(fd.get('pricePerHour')),
        capacity: parseInt(fd.get('capacity') || '1'),
        covered: fd.get('covered') === 'on',
        guarded: fd.get('guarded') === 'on',
        evCharging: fd.get('evCharging') === 'on',
        accessInstructions: fd.get('accessInstructions') || null,
        status: fd.get('status') || 'active',
        isAvailable: fd.get('isAvailable') !== 'off',
      });
      addToast('Spot created', 'success');
      setShowCreate(false);
      load();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    if (fd.get('address')) body.address = fd.get('address');
    const price = fd.get('price_per_hour');
    if (price) body.price_per_hour = parseFloat(price);
    const cap = fd.get('capacity');
    if (cap) body.capacity = parseInt(cap);
    body.covered = fd.get('covered') === 'on';
    body.guarded = fd.get('guarded') === 'on';
    body.ev_charging = fd.get('ev_charging') === 'on';
    body.access_instructions = fd.get('access_instructions') || null;
    body.is_available = fd.get('is_available') !== 'off';
    const st = fd.get('status');
    if (st) body.status = st;
    const lat = fd.get('lat');
    const lng = fd.get('lng');
    if (lat && lng) { body.lat = parseFloat(lat); body.lng = parseFloat(lng); }
    setSaving(true);
    try {
      await API.updateSpot(editSpot.id, body);
      addToast('Spot updated', 'success');
      setEditSpot(null);
      load();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader
        eyebrow="Management"
        title="Spots"
        description="Review parking inventory, approve new hosts, and keep live availability accurate."
        actions={
          <>
            <button onClick={load} className="btn-secondary">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 6a5 5 0 1 0 1 3"/><path d="M13 2v4h-4"/></svg>
              Refresh
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
              New Spot
            </button>
          </>
        }
        meta={[
          <MetricPill key="total" label="Loaded spots" value={spots.length} />,
          <MetricPill key="filtered" label="Visible rows" value={filteredSpots.length} />,
          <MetricPill key="pending" label="Pending" value={spots.filter(s => s.status === 'pending_approval').length} />,
          <MetricPill key="active" label="Active" value={spots.filter(s => s.status === 'active').length} />,
        ]}
      />
      <Toolbar resultText={query.trim() && spots.length !== filteredSpots.length ? `Showing ${filteredSpots.length} of ${spots.length} spots` : null}>
        <select id="spot-status-filter" name="spot-status-filter" aria-label="Filter by status" value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}
          className={selectClass}>
          <option value="">All Status</option>
          <option value="pending_approval">Pending</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </select>
      </Toolbar>

      <TableCard headers={['ID', 'Address', 'Capacity', 'Price/hr', 'Status', 'Owner', 'Rating', 'Created', '']}
        rows={filteredSpots.map(s => [
          <span key="id" className="text-xs font-mono text-muted-light">#{s.id}</span>,
          <span key="ad" className="text-xs truncate block max-w-[180px]" title={s.address || ''}>{s.address || '-'}</span>,
          <span key="cap" className="text-xs">{s.available_spaces ?? s.capacity}/{s.capacity}</span>,
          <span key="pr" className="font-semibold text-xs">{formatCurrency(s.price_per_hour)}</span>,
          <StatusBadge key="st" status={s.status} />,
          <span key="ow" className="text-xs">{s.owner_name || '-'}</span>,
          <span key="rt" className="text-xs">{s.rating_avg ? Number(s.rating_avg).toFixed(1) : '-'}</span>,
          <span key="cr" className="text-xs text-muted-light">{formatDateShort(s.created_at)}</span>,
          <DropdownMenu key="ac" items={[
            { label: 'View Details', onClick: () => API.getSpot(s.id).then(setDetail).catch(e => addToast(e.message, 'error')), icon: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3C4.5 3 1.5 8 1.5 8s3 5 6.5 5 6.5-5 6.5-5-3-5-6.5-5z"/><circle cx="8" cy="8" r="2.5"/></svg> },
            { label: 'Edit', onClick: () => setEditSpot(s), icon: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l2 2-8 8H4v-2l8-8z"/></svg> },
            ...(s.status === 'pending_approval' ? [
              { label: 'Approve', onClick: () => doAction(() => API.approveSpot(s.id), 'Approve this spot?', 'Spot approved'), icon: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 4L6 12l-4-4"/></svg> },
              { label: 'Reject', onClick: () => { const r = prompt('Rejection reason:'); if (r !== null) doAction(() => API.rejectSpot(s.id, r), 'Reject this spot?', 'Spot rejected'); }, icon: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8"/></svg> },
            ] : []),
            ...(s.status === 'active' ? [{ label: 'Suspend', onClick: () => doAction(() => API.suspendSpot(s.id), 'Suspend this spot?', 'Spot suspended'), icon: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><line x1="5" y1="8" x2="11" y2="8"/></svg> }] : []),
            { label: 'Edit Price', onClick: () => { const p = prompt('New price per hour (ETB):', s.price_per_hour); if (p && !isNaN(p) && Number(p) > 0) doAction(() => API.updateSpotPrice(s.id, Number(p)), 'Update price?', 'Price updated'); }, icon: <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l2 2-8 8H4v-2l8-8z"/></svg> },
          ]} />
        ])}
      />
      {!query.trim() && <Pagination page={page} totalPages={filteredTotalPages} total={filteredSpots.length} onPageChange={setPage} />}

      {/* Create Spot Modal */}
      {showCreate && (
        <Modal title="Create Spot" onClose={() => !saving && setShowCreate(false)}>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="create-spot-ownerId" className="block text-xs font-medium text-muted-light mb-1">Owner ID *</label>
              <input id="create-spot-ownerId" name="ownerId" type="number" min="1" required autoComplete="off" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="create-spot-address" className="block text-xs font-medium text-muted-light mb-1">Address</label>
              <input id="create-spot-address" name="address" autoComplete="off" className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-spot-lat" className="block text-xs font-medium text-muted-light mb-1">Latitude *</label>
              <input id="create-spot-lat" name="lat" type="number" step="any" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-spot-lng" className="block text-xs font-medium text-muted-light mb-1">Longitude *</label>
              <input id="create-spot-lng" name="lng" type="number" step="any" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-spot-price" className="block text-xs font-medium text-muted-light mb-1">Price/hr (ETB) *</label>
              <input id="create-spot-price" name="pricePerHour" type="number" min="1" step="0.01" required className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-spot-capacity" className="block text-xs font-medium text-muted-light mb-1">Capacity</label>
              <input id="create-spot-capacity" name="capacity" type="number" min="1" defaultValue="1" className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-spot-status" className="block text-xs font-medium text-muted-light mb-1">Status</label>
              <select id="create-spot-status" name="status" className={`${inputClass} h-[38px]`}>
                <option value="active">Active</option>
                <option value="pending_approval">Pending Approval</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="create-spot-access" className="block text-xs font-medium text-muted-light mb-1">Access instructions</label>
              <textarea id="create-spot-access" name="accessInstructions" rows="3" className={inputClass} />
            </div>
            <div className="flex items-end gap-4 pb-2">
              <label className="flex items-center gap-2 text-xs text-muted-light"><input id="create-spot-covered" name="covered" type="checkbox" className={checkboxClass} /> Covered</label>
              <label className="flex items-center gap-2 text-xs text-muted-light"><input id="create-spot-guarded" name="guarded" type="checkbox" className={checkboxClass} /> Guarded</label>
              <label className="flex items-center gap-2 text-xs text-muted-light"><input id="create-spot-ev" name="evCharging" type="checkbox" className={checkboxClass} /> EV</label>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setShowCreate(false)} disabled={saving}
                className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving}
                className="btn-primary">{saving ? 'Creating...' : 'Create Spot'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Spot Modal */}
      {editSpot && (
        <Modal title={`Edit Spot #${editSpot.id}`} onClose={() => !saving && setEditSpot(null)}>
          <form onSubmit={handleEdit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="edit-spot-address" className="block text-xs font-medium text-muted-light mb-1">Address</label>
              <input id="edit-spot-address" name="address" defaultValue={editSpot.address || ''} autoComplete="off" className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-spot-lat" className="block text-xs font-medium text-muted-light mb-1">Latitude</label>
              <input id="edit-spot-lat" name="lat" type="number" step="any" defaultValue={editSpot.lat || ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-spot-lng" className="block text-xs font-medium text-muted-light mb-1">Longitude</label>
              <input id="edit-spot-lng" name="lng" type="number" step="any" defaultValue={editSpot.lng || ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-spot-price" className="block text-xs font-medium text-muted-light mb-1">Price/hr (ETB)</label>
              <input id="edit-spot-price" name="price_per_hour" type="number" min="1" step="0.01" defaultValue={editSpot.price_per_hour || ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-spot-capacity" className="block text-xs font-medium text-muted-light mb-1">Capacity</label>
              <input id="edit-spot-capacity" name="capacity" type="number" min="1" defaultValue={editSpot.capacity || 1} className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-spot-status" className="block text-xs font-medium text-muted-light mb-1">Status</label>
              <select id="edit-spot-status" name="status" defaultValue={editSpot.status} className={`${inputClass} h-[38px]`}>
                <option value="active">Active</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="suspended">Suspended</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="edit-spot-access" className="block text-xs font-medium text-muted-light mb-1">Access instructions</label>
              <textarea id="edit-spot-access" name="access_instructions" rows="3" defaultValue={editSpot.access_instructions || ''} className={inputClass} />
            </div>
            <div className="flex items-end gap-4 pb-2">
              <label className="flex items-center gap-2 text-xs text-muted-light"><input id="edit-spot-covered" name="covered" type="checkbox" defaultChecked={editSpot.covered} className={checkboxClass} /> Covered</label>
              <label className="flex items-center gap-2 text-xs text-muted-light"><input id="edit-spot-guarded" name="guarded" type="checkbox" defaultChecked={editSpot.guarded} className={checkboxClass} /> Guarded</label>
              <label className="flex items-center gap-2 text-xs text-muted-light"><input id="edit-spot-ev" name="ev_charging" type="checkbox" defaultChecked={editSpot.ev_charging} className={checkboxClass} /> EV</label>
              <label className="flex items-center gap-2 text-xs text-muted-light"><input id="edit-spot-available" name="is_available" type="checkbox" defaultChecked={editSpot.is_available !== false} className={checkboxClass} /> Available</label>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setEditSpot(null)} disabled={saving}
                className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving}
                className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`Spot #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="mb-5 flex items-center gap-3 pb-4 border-b border-line">
            <StatusBadge status={detail.status} />
            <span className="text-sm text-muted-light">Created {formatDate(detail.created_at)}</span>
          </div>
          {detail.photos?.length > 0 && (
            <div className="mb-5 grid grid-cols-2 md:grid-cols-3 gap-3">
              {detail.photos.map((src, index) => (
                <a key={src || index} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-line bg-paper">
                  <img src={src} alt="Spot" className="h-32 w-full object-cover" />
                </a>
              ))}
            </div>
          )}
          <DetailGrid
            items={[
              ['ID', detail.id], ['Address', detail.address || '-'],
              ['Price/hr', formatCurrency(detail.price_per_hour)], ['Status', <StatusBadge key="s" status={detail.status} />],
              ['Lat / Lng', (detail.lat || '-') + ' / ' + (detail.lng || '-')],
              ['Capacity', (detail.available_spaces ?? detail.capacity) + ' of ' + detail.capacity + ' available'],
              ['Bookings', detail.booking_count || 0],
              ['Covered', detail.covered ? '\u2713' : '\u2014'], ['Guarded', detail.guarded ? '\u2713' : '\u2014'],
              ['EV Charging', detail.ev_charging ? '\u2713' : '\u2014'],
              ['Access', detail.access_instructions || '-'],
              ['Rating', detail.rating_avg ? Number(detail.rating_avg).toFixed(1) + ' (' + (detail.rating_count || 0) + ' reviews)' : 'No ratings'],
              ['Owner', detail.owner_name || detail.owner_email || '-'],
            ]}
          />
          {detail.status === 'pending_approval' && (
            <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
              <button onClick={() => doAction(() => API.approveSpot(detail.id), 'Approve this spot?', 'Spot approved').then(() => setDetail(null))} className="btn-primary">Approve</button>
              <button onClick={() => { const r = prompt('Rejection reason:'); if (r !== null) doAction(() => API.rejectSpot(detail.id, r), 'Reject this spot?', 'Spot rejected').then(() => setDetail(null)); }} className="btn-secondary">Reject</button>
            </div>
          )}
          {detail.rejection_reason && (
            <div className="mt-4 bg-rose-50 border border-rose-200 rounded-lg p-4">
              <div className="text-xs text-rose-600 font-semibold mb-1">Rejection Reason</div>
              <p className="text-sm text-ink">{detail.rejection_reason}</p>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
