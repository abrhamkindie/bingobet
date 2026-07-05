import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import * as API from '../api.jsx';
import { StatusBadge, LoadingSpinner, PageHeader, Toolbar, DetailGrid, MetricPill, selectClass, inputClass, formatDate, formatDateShort } from '../components/Utils.jsx';
import { TableCard, Pagination, DropdownMenu } from '../components/TableComponents.jsx';
import Modal from '../components/Modal.jsx';
import { ToastContext, SearchContext } from '../App.jsx';

export default function Users() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const limit = 20;
  const { addToast } = useContext(ToastContext);
  const { query } = useContext(SearchContext);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit, offset: page * limit };
      if (role) params.role = role;
      const { items, pagination } = await API.listUsers(params);
      setItems(items || []); setTotal(pagination?.total || items?.length || 0);
    } catch (err) { addToast('Error: ' + err.message, 'error'); }
    finally { setLoading(false); }
  }, [role, page, limit]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(u =>
      String(u.id).includes(q) ||
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.telegram_id || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q) ||
      (u.is_banned ? 'banned' : 'active').includes(q)
    );
  }, [items, query]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setSaving(true);
    try {
      await API.createUser({
        telegramId: parseInt(fd.get('telegramId')),
        name: fd.get('name'),
        username: fd.get('username'),
        phone: fd.get('phone'),
        role: fd.get('role') || 'driver',
        languagePref: fd.get('languagePref') || 'en',
      });
      addToast('User created', 'success');
      setShowCreate(false);
      load();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {};
    if (fd.get('name')) body.name = fd.get('name');
    if (fd.get('username')) body.username = fd.get('username');
    if (fd.get('phone')) body.phone = fd.get('phone');
    if (fd.get('role')) body.role = fd.get('role');
    if (fd.get('language_pref')) body.language_pref = fd.get('language_pref');
    setSaving(true);
    try {
      await API.updateUser(editUser.id, body);
      addToast('User updated', 'success');
      setEditUser(null);
      load();
    } catch (err) { addToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner text="Loading users..." />;

  return (
    <>
      <PageHeader
        eyebrow="Management"
        title="Users"
        description="Manage drivers, hosts, admins, account status, and Telegram identities."
        actions={
          <>
            <button onClick={load} className="btn-secondary">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 6a5 5 0 1 0 1 3"/><path d="M13 2v4h-4"/></svg>
              Refresh
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3v10M3 8h10"/></svg>
              New User
            </button>
          </>
        }
        meta={[
          <MetricPill key="loaded" label="Loaded users" value={items.length} />,
          <MetricPill key="visible" label="Visible rows" value={filtered.length} />,
          <MetricPill key="hosts" label="Hosts" value={items.filter(u => u.role === 'host').length} />,
          <MetricPill key="banned" label="Banned" value={items.filter(u => u.is_banned).length} />,
        ]}
      />
      <Toolbar resultText={query.trim() && items.length !== filtered.length ? `Showing ${filtered.length} of ${items.length} users` : null}>
        <select id="users-role-filter" name="users-role-filter" aria-label="Filter by role" value={role} onChange={e => { setRole(e.target.value); setPage(0); }}
          className={selectClass}>
          <option value="">All Roles</option><option value="driver">Drivers</option><option value="host">Hosts</option><option value="admin">Admins</option>
        </select>
      </Toolbar>
      <TableCard headers={['ID', 'Name', 'Email', 'Role', 'Telegram', 'Status', 'Joined', '']}
        rows={filtered.map(u => [
          <span key="id" className="text-xs font-mono text-muted-light">#{u.id}</span>,
          <span key="nm" className="text-xs">{u.name || '-'}</span>,
          <span key="em" className="text-xs text-muted-light">{u.email || '-'}</span>,
          <StatusBadge key="rl" status={u.role} />,
          <span key="tg" className="text-xs text-muted-light">{u.telegram_id || '-'}</span>,
          u.is_banned
            ? <span key="st" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border border-rose-200 bg-rose-100 text-rose-700"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Banned</span>
            : <span key="st" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border border-emerald-200 bg-emerald-100 text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Active</span>,
          <span key="dt" className="text-xs text-muted-light">{formatDateShort(u.created_at)}</span>,
          <DropdownMenu key="ac" items={[
            { label: 'View Details', onClick: () => API.getUserDetail(u.id).then(setDetail).catch(e => addToast(e.message, 'error')) },
            { label: 'Edit', onClick: () => setEditUser(u) },
            ...(u.is_banned
              ? [{ label: 'Unban User', onClick: () => window.confirm('Unban this user?') && API.unbanUser(u.id).then(() => { addToast('Unbanned', 'success'); load(); }).catch(e => addToast(e.message, 'error')) }]
              : [{ label: 'Ban User', onClick: () => { const r = prompt('Ban reason:'); if (r !== null) window.confirm('Ban this user?') && API.banUser(u.id, r).then(() => { addToast('Banned', 'warning'); load(); }).catch(e => addToast(e.message, 'error')); } }]),
          ]} />
        ])}
      />
      <Pagination page={page} totalPages={Math.ceil(total / limit)} total={total} onPageChange={setPage} />

      {/* Create User Modal */}
      {showCreate && (
        <Modal title="Create User" onClose={() => !saving && setShowCreate(false)}>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="create-user-telegram" className="block text-xs font-medium text-muted-light mb-1">Telegram ID *</label>
              <input id="create-user-telegram" name="telegramId" type="number" min="1" required autoComplete="off" className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-user-name" className="block text-xs font-medium text-muted-light mb-1">Name</label>
              <input id="create-user-name" name="name" autoComplete="name" className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-user-username" className="block text-xs font-medium text-muted-light mb-1">Username</label>
              <input id="create-user-username" name="username" autoComplete="username" className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-user-phone" className="block text-xs font-medium text-muted-light mb-1">Phone</label>
              <input id="create-user-phone" name="phone" type="tel" autoComplete="tel" className={inputClass} />
            </div>
            <div>
              <label htmlFor="create-user-role" className="block text-xs font-medium text-muted-light mb-1">Role</label>
              <select id="create-user-role" name="role" className={inputClass}>
                <option value="driver">Driver</option>
                <option value="host">Host</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label htmlFor="create-user-language" className="block text-xs font-medium text-muted-light mb-1">Language</label>
              <select id="create-user-language" name="languagePref" className={inputClass}>
                <option value="en">English</option>
                <option value="am">Amharic</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setShowCreate(false)} disabled={saving}
                className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving}
                className="btn-primary">{saving ? 'Creating...' : 'Create User'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Modal title={`Edit User #${editUser.id}`} onClose={() => !saving && setEditUser(null)}>
          <form onSubmit={handleEdit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-user-name" className="block text-xs font-medium text-muted-light mb-1">Name</label>
              <input id="edit-user-name" name="name" defaultValue={editUser.name || ''} autoComplete="name" className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-user-username" className="block text-xs font-medium text-muted-light mb-1">Username</label>
              <input id="edit-user-username" name="username" defaultValue={editUser.username || ''} autoComplete="username" className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-user-phone" className="block text-xs font-medium text-muted-light mb-1">Phone</label>
              <input id="edit-user-phone" name="phone" defaultValue={editUser.phone || ''} type="tel" autoComplete="tel" className={inputClass} />
            </div>
            <div>
              <label htmlFor="edit-user-role" className="block text-xs font-medium text-muted-light mb-1">Role</label>
              <select id="edit-user-role" name="role" defaultValue={editUser.role} className={inputClass}>
                <option value="driver">Driver</option>
                <option value="host">Host</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-user-language" className="block text-xs font-medium text-muted-light mb-1">Language</label>
              <select id="edit-user-language" name="language_pref" defaultValue={editUser.language_pref || 'en'} className={inputClass}>
                <option value="en">English</option>
                <option value="am">Amharic</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2 border-t border-line">
              <button type="button" onClick={() => setEditUser(null)} disabled={saving}
                className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving}
                className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`User #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="mb-5 flex items-center gap-3 pb-4 border-b border-line">
            <StatusBadge status={detail.role} />
            {detail.is_banned
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border border-rose-200 bg-rose-100 text-rose-700">Banned</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border border-emerald-200 bg-emerald-100 text-emerald-700">Active</span>}
          </div>
          <DetailGrid
            items={[
              ['ID', detail.id], ['Name', detail.name || '-'], ['Email', detail.email || '-'],
              ['Role', <StatusBadge key="r" status={detail.role} />],
              ['Telegram ID', detail.telegram_id || '-'], ['Phone', detail.phone || '-'],
              ['Language', detail.language_pref || '-'], ['Joined', formatDate(detail.created_at)],
            ]}
          />
        </Modal>
      )}
    </>
  );
}
