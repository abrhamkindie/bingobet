import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import * as API from '../api.jsx';
import { StatusBadge, LoadingSpinner, PageHeader, Toolbar, MetricPill, selectClass, textareaClass, formatDate } from '../components/Utils.jsx';
import { TableCard, Pagination, DropdownMenu } from '../components/TableComponents.jsx';
import Modal from '../components/Modal.jsx';
import { ToastContext, SearchContext } from '../App.jsx';

const CATEGORY_LABELS = {
  payment: 'Payment',
  booking: 'Booking',
  host: 'Host',
  feature: 'Feature',
  other: 'Other',
};

function AutoCategoryBadge({ ticket }) {
  if (!ticket.auto_category) return null;
  const match = ticket.auto_category === ticket.category;
  const colors = match
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : 'bg-amber-50 text-amber-600 border-amber-200';
  const label = match
    ? 'AI: ' + (CATEGORY_LABELS[ticket.auto_category] || ticket.auto_category)
    : `AI suggests: ${CATEGORY_LABELS[ticket.auto_category] || ticket.auto_category}`;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold border ${colors}`} title={`Auto-detected category: ${ticket.auto_category}`}>
      <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor">
        <path d="M8 1C4.5 1 2 3.5 2 7c0 3.5 2.5 6 6 6s6-2.5 6-6c0-3.5-2.5-6-6-6zm1 10H7V7h2v4zm0-6H7V3h2v2z"/>
      </svg>
      {label}
    </span>
  );
}

const STATUS_ACTIONS = {
  open: ['in_progress', 'resolved'],
  in_progress: ['resolved', 'closed', 'open'],
  resolved: ['closed', 'open'],
  closed: ['open'],
};

export default function Tickets() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const limit = 20;
  const { addToast } = useContext(ToastContext);
  const { query } = useContext(SearchContext);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit, offset: page * limit, search: query || undefined };
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      const { items, pagination } = await API.listTickets(params);
      setItems(items || []);
      setTotal(pagination?.total || items?.length || 0);
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, page, limit, query]);

  useEffect(() => { load(); }, [load]);

  // Reload when search query changes
  useEffect(() => { setPage(0); }, [query]);

  const openDetail = useCallback(async (id) => {
    try {
      const ticket = await API.getTicket(id);
      setDetail(ticket);
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
  }, []);

  const handleStatusChange = useCallback(async (id, newStatus) => {
    try {
      await API.updateTicketStatus(id, newStatus);
      addToast(`Ticket ${newStatus === 'resolved' ? 'resolved' : newStatus === 'closed' ? 'closed' : 'opened'}`, 'success');
      load();
      if (detail?.id === id) {
        setDetail(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
  }, [load, detail]);

  const handleAssign = useCallback(async (id) => {
    try {
      // Assign to the currently logged-in admin
      const user = API.getUser();
      if (!user?.id) {
        addToast('Cannot determine admin identity', 'error');
        return;
      }
      await API.assignTicket(id, user.id);
      addToast('Ticket assigned to you', 'success');
      load();
      if (detail?.id === id) {
        openDetail(id);
      }
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    }
  }, [load, detail, openDetail]);

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || !detail) return;
    setSendingReply(true);
    try {
      const result = await API.replyToTicket(detail.id, replyText.trim());
      setDetail(result.ticket || result);
      setReplyText('');
      addToast('Reply sent', 'success');
    } catch (err) {
      addToast('Error: ' + err.message, 'error');
    } finally {
      setSendingReply(false);
    }
  }, [replyText, detail]);

  if (loading && items.length === 0) return <LoadingSpinner text="Loading tickets..." />;

  const statusOptions = ['', 'open', 'in_progress', 'resolved', 'closed'];
  const categoryOptions = ['', 'payment', 'booking', 'host', 'feature', 'other'];

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Support Tickets"
        description="Triage customer issues, AI category suggestions, assignments, and staff replies."
        actions={
          <button onClick={load} className="btn-secondary">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M13 6a5 5 0 1 0 1 3"/><path d="M13 2v4h-4"/></svg>
            Refresh
          </button>
        }
        meta={[
          <MetricPill key="loaded" label="Loaded tickets" value={items.length} />,
          <MetricPill key="open" label="Open" value={items.filter(t => t.status === 'open').length} />,
          <MetricPill key="progress" label="In progress" value={items.filter(t => t.status === 'in_progress').length} />,
          <MetricPill key="unassigned" label="Unassigned" value={items.filter(t => !t.assigned_admin_name).length} />,
        ]}
      />

      <Toolbar resultText={query.trim() ? `Search: "${query}"` : null}>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          className={selectClass}>
          <option value="">All Statuses</option>
          {statusOptions.filter(Boolean).map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/^(.)/, c => c.toUpperCase())}</option>
          ))}
        </select>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(0); }}
          className={selectClass}>
          <option value="">All Categories</option>
          {categoryOptions.filter(Boolean).map(c => (
            <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>
          ))}
        </select>
      </Toolbar>

      <TableCard headers={['ID', 'User', 'Category', 'AI', 'Subject', 'Status', 'Assigned To', 'Updated', '']}
        rows={items.map(t => [
          <span key="id" className="text-xs font-mono text-muted-light">#{t.id}</span>,
          <span key="user" className="text-xs truncate block max-w-[120px]" title={t.user_name || ''}>{t.user_name || `User #${t.user_id}`}</span>,
          <span key="cat" className="text-xs capitalize bg-surface-muted rounded-md px-2 py-0.5">{CATEGORY_LABELS[t.category] || t.category}</span>,
          <AutoCategoryBadge key="ai" ticket={t} />,
          <span key="desc" className="text-xs truncate block max-w-[200px]" title={t.description}>{t.description?.slice(0, 50)}{t.description?.length > 50 ? '...' : ''}</span>,
          <StatusBadge key="st" status={t.status} />,
          <span key="as" className="text-xs text-muted-light">{t.assigned_admin_name || '—'}</span>,
          <span key="dt" className="text-xs text-muted-light">{formatDate(t.updated_at)}</span>,
          <DropdownMenu key="ac" items={[
            { label: 'View Details', onClick: () => openDetail(t.id) },
            ...(STATUS_ACTIONS[t.status] || []).map(s => ({
              label: `Mark as ${s.replace(/_/g, ' ').replace(/^(.)/, c => c.toUpperCase())}`,
              onClick: () => handleStatusChange(t.id, s),
            })),
            { label: 'Assign to me', onClick: () => handleAssign(t.id) },
          ]} />
        ])}
      />
      <Pagination page={page} totalPages={Math.ceil(total / limit)} total={total} onPageChange={setPage} />

      {detail && (
        <Modal title={`Ticket #${detail.id}`} onClose={() => setDetail(null)}>
          <div className="space-y-5">
            {/* Status & Assignment bar */}
            <div className="flex items-center gap-3 pb-4 border-b border-line flex-wrap">
              <StatusBadge status={detail.status} />
              <span className="text-xs bg-surface-muted rounded-lg px-2 py-0.5 capitalize text-muted">
                {CATEGORY_LABELS[detail.category] || detail.category}
              </span>
              <span className="text-xs text-muted ml-auto">
                {detail.assigned_admin_name ? `Assigned to ${detail.assigned_admin_name}` : 'Unassigned'}
              </span>
            </div>

            {/* User info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-surface-muted rounded-lg p-4 border border-line">
                <div className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5">User</div>
                <div className="text-sm text-ink">{detail.user_name || '—'}</div>
                <div className="text-xs text-muted">Telegram ID: {detail.user_telegram_id || '—'}</div>
              </div>
              <div className="bg-surface-muted rounded-lg p-4 border border-line">
                <div className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5">Submitted</div>
                <div className="text-sm text-ink">{formatDate(detail.created_at)}</div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-surface-muted rounded-lg p-4 border border-line">
              <div className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5">Description</div>
              <p className="text-sm text-ink whitespace-pre-wrap break-words">{detail.description}</p>
            </div>

            {/* Screenshot */}
            {detail.screenshot_file_id && (
              <div className="bg-surface-muted rounded-lg p-4 border border-line">
                <div className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-1.5">Screenshot</div>
                <p className="text-xs text-muted">File ID: {detail.screenshot_file_id}</p>
                <p className="text-xs text-amber-600 mt-1">Screenshot is available in Telegram chat</p>
              </div>
            )}

            {/* Admin Notes */}
            {detail.admin_notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold mb-1.5">Admin Notes</div>
                <p className="text-sm text-ink whitespace-pre-wrap">{detail.admin_notes}</p>
              </div>
            )}

            {/* Conversation / Replies */}
            {detail.replies && detail.replies.length > 0 && (
              <div>
                <div className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-3">Conversation</div>
                <div className="space-y-3">
                  {detail.replies.map((r) => (
                    <div key={r.id} className={`rounded-lg p-4 border ${r.is_from_admin ? 'bg-[#e7f4fb] border-[#b9dced] ml-6' : 'bg-surface-muted border-line mr-6'}`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                          {r.is_from_admin ? r.admin_name || 'Admin' : detail.user_name || 'User'}
                        </span>
                        <span className="text-[10px] text-muted-light">{formatDate(r.created_at)}</span>
                        {r.is_from_admin && (
                          <span className="text-[9px] font-bold uppercase text-[#226489] bg-[#d8edf7] rounded-full px-1.5 py-0.5">Staff</span>
                        )}
                      </div>
                      <p className="text-sm text-ink whitespace-pre-wrap">{r.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reply box */}
            {detail.status !== 'closed' && (
              <div className="border-t border-line pt-4">
                <div className="text-[10px] text-muted uppercase tracking-wider font-semibold mb-2">Add Reply</div>
                <div className="flex gap-2">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                    className={`${textareaClass} flex-1 resize-none`}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted-light">Ctrl+Enter to send</span>
                  <div className="flex gap-2">
                    {detail.status === 'open' && (
                      <button onClick={() => handleAssign(detail.id)}
                        className="btn-secondary">
                        Assign to me
                      </button>
                    )}
                    <button onClick={handleReply} disabled={!replyText.trim() || sendingReply}
                      className="btn-primary h-9 text-xs">
                      {sendingReply ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Resolve / Close actions */}
            {detail.status !== 'closed' && (
              <div className="flex gap-2 pt-2 border-t border-line">
                {STATUS_ACTIONS[detail.status]?.map(s => (
                  <button key={s} onClick={() => handleStatusChange(detail.id, s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      s === 'resolved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        : s === 'closed'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                          : 'bg-surface-muted text-ink-soft border border-line hover:bg-surface'
                    }`}>
                    Mark as {s.replace(/_/g, ' ').replace(/^(.)/, c => c.toUpperCase())}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
