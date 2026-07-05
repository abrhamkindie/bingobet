import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../App.jsx';
import * as api from '../api.js';
import Icon from '../components/Icons.jsx';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'active', label: 'Active' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function openExternalUrl(url) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) {
    tg.openLink(url);
    return;
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = url;
}

export default function BookingsScreen({ navigate, paymentReturn, clearPaymentReturn }) {
  const { addToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [qrData, setQrData] = useState(null);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 20 };
      if (filter !== 'all') params.status = filter;
      const data = await api.getBookings(params);
      setBookings(data.bookings || []);
    } catch {
      addToast('Failed to load bookings', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, addToast]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleViewDetail = async (bookingId) => {
    try {
      const data = await api.getBookingDetail(bookingId);
      setSelectedBooking(data);
      setShowDetail(true);
    } catch {
      addToast('Failed to load booking details', 'error');
    }
  };

  const handleCancel = async (bookingId) => {
    try {
      await api.cancelBooking(bookingId);
      addToast('Booking cancelled', 'success');
      setShowDetail(false);
      loadBookings();
    } catch (err) {
      addToast(err.message || 'Failed to cancel', 'error');
    }
  };

  const refreshDetail = async (bookingId) => {
    const data = await api.getBookingDetail(bookingId);
    setSelectedBooking(data);
    return data;
  };

  const handlePay = async (bookingId) => {
    setActionLoading('pay');
    try {
      const data = await api.payBooking(bookingId, 'chapa');
      if (data.checkoutUrl) {
        openExternalUrl(data.checkoutUrl);
        addToast(data.reused ? 'Payment checkout reopened' : 'Payment checkout opened', 'info');
      } else {
        addToast('Payment initiated', 'success');
      }
      await refreshDetail(bookingId);
      loadBookings();
    } catch (err) {
      addToast(err.message || 'Payment failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckPayment = async (bookingId) => {
    setActionLoading('check');
    try {
      const data = await api.checkBookingPayment(bookingId);
      setSelectedBooking(prev => prev ? { ...prev, booking: data.booking, payment: data.payment } : prev);
      if (data.paid || data.qrAvailable) {
        addToast('Payment confirmed. QR is ready.', 'success');
        const qr = await api.getBookingQr(bookingId);
        setQrData(qr);
      } else if (data.failed) {
        addToast('Payment was not completed. You can retry payment.', 'error');
      } else {
        addToast('Payment is still pending', 'info');
      }
      loadBookings();
    } catch (err) {
      addToast(err.message || 'Failed to check payment', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleShowQr = async (bookingId) => {
    setActionLoading('qr');
    try {
      const data = await api.getBookingQr(bookingId);
      setQrData(data);
    } catch (err) {
      addToast(err.message || 'QR is not ready yet', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuickPay = async (event, bookingId) => {
    event.stopPropagation();
    await handlePay(bookingId);
  };

  const handleQuickQr = async (event, bookingId) => {
    event.stopPropagation();
    await handleShowQr(bookingId);
  };

  useEffect(() => {
    if (!paymentReturn?.bookingId) return;

    let cancelled = false;
    const bookingId = paymentReturn.bookingId;

    async function handlePaymentReturn() {
      setActionLoading('check');
      try {
        const data = await api.checkBookingPayment(bookingId);
        if (cancelled) return;

        if (data.paid || data.qrAvailable) {
          addToast('Payment confirmed. Your QR is ready.', 'success');
          const qr = await api.getBookingQr(bookingId);
          if (!cancelled) setQrData(qr);
        } else if (data.failed) {
          addToast('Payment was not completed. You can retry payment.', 'error');
        } else {
          addToast('Payment is still pending. Tap Check Payment after completing checkout.', 'info');
        }
        loadBookings();
      } catch {
        if (!cancelled) addToast('Open My Bookings to check your payment.', 'info');
      } finally {
        if (!cancelled) {
          setActionLoading(null);
          clearPaymentReturn?.();
        }
      }
    }

    handlePaymentReturn();

    return () => {
      cancelled = true;
    };
  }, [paymentReturn, clearPaymentReturn, addToast, loadBookings]);

  const handleRate = async () => {
    if (!selectedBooking) return;
    setRatingLoading(true);
    try {
      await api.submitRating(selectedBooking.booking.id, ratingScore, ratingComment || null);
      addToast('Rating submitted!', 'success');
      setShowRating(false);
      setShowDetail(false);
      setRatingComment('');
      setRatingScore(5);
    } catch (err) {
      addToast(err.message || 'Failed to submit rating', 'error');
    } finally {
      setRatingLoading(false);
    }
  };

  const latestPayment = selectedBooking?.payment;
  const canCancel = selectedBooking &&
    selectedBooking.booking.payment_status === 'unpaid' &&
    ['pending', 'reserved', 'confirmed'].includes(selectedBooking.booking.status);
  const canPay = selectedBooking &&
    selectedBooking.booking.payment_status === 'unpaid' &&
    !['cancelled', 'completed', 'expired'].includes(selectedBooking.booking.status);
  const canCheckPayment = selectedBooking && latestPayment?.method === 'chapa' && latestPayment.status === 'pending';
  const canShowQr = selectedBooking && selectedBooking.booking.payment_status === 'paid' && selectedBooking.booking.checkin_token;
  const canRate = selectedBooking && selectedBooking.booking.status === 'completed';
  const activeCount = bookings.filter(b => ['active', 'reserved', 'confirmed', 'pending'].includes(b.status)).length;
  const unpaidCount = bookings.filter(b => b.payment_status === 'unpaid' && !['cancelled', 'completed', 'expired'].includes(b.status)).length;

  return (
    <div className="bookings-orbit min-h-full px-4 pb-6 pt-5">
      {/* Header */}
      <BookingsHero activeCount={activeCount} unpaidCount={unpaidCount} onNew={() => navigate('map')} />

      {/* At-a-glance metrics */}
      <div className="mb-5 grid grid-cols-2 gap-2">
        <MetricCard icon="calendar" label="Open bookings" value={activeCount} tone="cyan" />
        <MetricCard icon="creditCard" label="Need payment" value={unpaidCount} tone="amber" />
      </div>

      {/* Status filters — edge-to-edge scroll */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-none rounded-full border px-3.5 py-2 text-xs font-black transition-all active:scale-[0.97] ${
              filter === f.key
                ? 'border-cyan-200/45 bg-cyan-300/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.16)]'
                : 'border-white/[0.08] bg-white/[0.045] text-slate-400 hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : bookings.length === 0 ? (
        <EmptyState navigate={navigate} />
      ) : (
        <div className="space-y-3">
          {bookings.map(b => (
            <BookingCard
              key={b.id}
              booking={b}
              actionLoading={actionLoading}
              onOpen={() => handleViewDetail(b.id)}
              onPay={(event) => handleQuickPay(event, b.id)}
              onQr={(event) => handleQuickQr(event, b.id)}
            />
          ))}
        </div>
      )}

      {showDetail && selectedBooking && (
        <Sheet onClose={() => setShowDetail(false)}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Booking details</p>
              <h3 className="mt-1 truncate text-lg font-bold text-white">{selectedBooking.booking.address || 'Parking spot'}</h3>
              <p className="mt-1 font-mono text-sm font-semibold text-cyan-300">{selectedBooking.booking.confirmation_code}</p>
            </div>
            <IconButton label="Close" icon="x" onClick={() => setShowDetail(false)} />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <DetailTile icon="calendar" label="Start" value={formatDateTime(selectedBooking.booking.start_time)} />
            <DetailTile icon="clock" label="End" value={formatDateTime(selectedBooking.booking.end_time)} />
          </div>

          <div className="mb-5 divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-white/[0.045] px-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
            <DetailRow label="Status" value={<StatusBadge status={selectedBooking.booking.status} />} />
            <DetailRow label="Payment" value={<PaymentBadge status={selectedBooking.booking.payment_status} />} />
            <DetailRow label="Total" value={`${formatMoney(selectedBooking.booking.total_price)} ETB`} highlight />
          </div>

          <div className="grid gap-2">
            {canPay && (
              <ActionButton
                icon="creditCard"
                label={actionLoading === 'pay' ? 'Opening...' : latestPayment?.checkout_url ? 'Resume Payment' : 'Pay Now'}
                disabled={!!actionLoading}
                onClick={() => handlePay(selectedBooking.booking.id)}
                tone="primary"
              />
            )}
            {canCheckPayment && (
              <ActionButton
                icon="checkCircle"
                label={actionLoading === 'check' ? 'Checking...' : 'Check Payment'}
                disabled={!!actionLoading}
                onClick={() => handleCheckPayment(selectedBooking.booking.id)}
                tone="cyan"
              />
            )}
            {canShowQr && (
              <ActionButton
                icon="qrCode"
                label={actionLoading === 'qr' ? 'Loading...' : 'Show QR'}
                disabled={!!actionLoading}
                onClick={() => handleShowQr(selectedBooking.booking.id)}
                tone="cyan"
              />
            )}
            {canRate && (
              <ActionButton
                icon="star"
                label="Rate Spot"
                onClick={() => { setShowDetail(false); setShowRating(true); }}
                tone="amber"
              />
            )}
            {canCancel && (
              <ActionButton
                icon="x"
                label="Cancel Booking"
                onClick={() => handleCancel(selectedBooking.booking.id)}
                tone="danger"
              />
            )}
          </div>
        </Sheet>
      )}

      {qrData && (
        <Sheet onClose={() => setQrData(null)}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Check-in access</p>
              <h3 className="mt-1 text-lg font-bold text-white">Booking QR</h3>
              <p className="mt-1 font-mono text-sm font-semibold text-cyan-300">{qrData.confirmationCode}</p>
            </div>
            <IconButton label="Close" icon="x" onClick={() => setQrData(null)} />
          </div>
          <div className="mb-5 flex justify-center rounded-3xl border border-cyan-200/20 bg-white p-5 shadow-[0_0_34px_rgba(34,211,238,0.14)]">
            <img src={qrData.qrDataUrl} alt="Booking check-in QR" className="h-56 w-56" />
          </div>
          <div className="mb-5 divide-y divide-white/[0.08] rounded-2xl border border-white/[0.08] bg-white/[0.045] px-3.5">
            <DetailRow label="Start" value={formatDateTime(qrData.booking?.start_time)} />
            <DetailRow label="End" value={formatDateTime(qrData.booking?.end_time)} />
            <DetailRow label="Code" value={qrData.confirmationCode} highlight />
          </div>
          <ActionButton icon="check" label="Done" onClick={() => setQrData(null)} tone="neutral" />
        </Sheet>
      )}

      {showRating && selectedBooking && (
        <Sheet onClose={() => setShowRating(false)}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Completed booking</p>
              <h3 className="mt-1 text-lg font-bold text-white">Rate this spot</h3>
            </div>
            <IconButton label="Close" icon="x" onClick={() => setShowRating(false)} />
          </div>

          <div className="mb-5 flex justify-center gap-2.5">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setRatingScore(star)}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all active:scale-90 ${
                  star <= ratingScore
                    ? 'border-amber-300/40 bg-amber-300/15 text-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.18)]'
                    : 'border-white/[0.08] bg-white/[0.045] text-slate-600 hover:text-slate-400'
                }`}
                aria-label={`${star} star rating`}
              >
                <Icon name="star" size={22} className={star <= ratingScore ? 'fill-current' : ''} />
              </button>
            ))}
          </div>

          <textarea
            value={ratingComment}
            onChange={(e) => setRatingComment(e.target.value)}
            placeholder="Leave a comment (optional)"
            className="mb-5 w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-3.5 text-sm text-white outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-300/50"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-2">
            <ActionButton icon="x" label="Cancel" onClick={() => setShowRating(false)} tone="neutral" />
            <ActionButton
              icon="check"
              label={ratingLoading ? 'Submitting...' : 'Submit'}
              onClick={handleRate}
              disabled={ratingLoading}
              tone="amber"
            />
          </div>
        </Sheet>
      )}
    </div>
  );
}

function BookingsHero({ activeCount, unpaidCount, onNew }) {
  return (
    <header className="bookings-hero mb-5 overflow-hidden rounded-[30px] border border-cyan-200/15 bg-[#050910]/90 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.52)]">
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-cyan-200/15 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">
            Reservations
          </span>
          <button
            onClick={onNew}
            className="inline-flex min-h-10 flex-none items-center gap-1.5 rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] transition-all active:scale-[0.97] active:bg-cyan-200"
          >
            <Icon name="plus" size={16} />
            New
          </button>
        </div>

        <div className="booking-core mx-auto mt-4">
          <div className="booking-core__halo" />
          <div className="booking-core__card">
            <Icon name="calendar" size={42} />
          </div>
          <div className="booking-core__chip booking-core__chip--left">
            <span>{activeCount}</span>
            <small>Open</small>
          </div>
          <div className="booking-core__chip booking-core__chip--right">
            <span>{unpaidCount}</span>
            <small>Pay</small>
          </div>
        </div>

        <div className="mt-4 text-center">
          <h1 className="text-3xl font-black leading-none text-white text-glow-cyan">Bookings</h1>
          <p className="mx-auto mt-2 max-w-[18rem] text-xs leading-5 text-slate-400">Track reservations, payment status, QR access, ratings, and cancellations.</p>
        </div>
      </div>
    </header>
  );
}

function BookingCard({ booking, actionLoading, onOpen, onPay, onQr }) {
  const canPay = booking.payment_status === 'unpaid' && !['cancelled', 'completed', 'expired'].includes(booking.status);
  const canShowQr = booking.payment_status === 'paid' && booking.checkin_token;

  return (
    <button
      onClick={onOpen}
      className={`booking-glass-card w-full rounded-[24px] border bg-white/[0.045] p-4 text-left shadow-[0_18px_48px_rgba(0,0,0,0.25)] transition-all hover:bg-white/[0.06] active:scale-[0.995] ${bookingToneBorder(booking.status)}`}
    >
      {/* Top: identity + status */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,0.12)]">
          <Icon name="parking" size={21} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2.5">
            <p className="truncate text-sm font-semibold text-white">{booking.address || 'Parking spot'}</p>
            <StatusBadge status={booking.status} />
          </div>
          <p className="mt-0.5 font-mono text-xs tracking-wide text-cyan-300/90">{booking.confirmation_code}</p>
        </div>
      </div>

      {/* Meta: schedule (left) vs amount (right), baseline-aligned */}
      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3.5">
        <div className="min-w-0 space-y-1.5">
          <InfoLine icon="calendar" text={formatDate(booking.start_time)} />
          <InfoLine icon="clock" text={`${formatTime(booking.start_time)} – ${formatTime(booking.end_time)}`} />
        </div>
        <div className="flex flex-none flex-col items-end gap-1.5">
          <p className="text-base font-bold leading-none text-white">
            {formatMoney(booking.total_price)} <span className="text-xs font-medium text-slate-400">ETB</span>
          </p>
          <PaymentBadge status={booking.payment_status} />
        </div>
      </div>

      {(canPay || canShowQr) && (
        <div className="mt-3.5 border-t border-white/[0.08] pt-3.5">
          {canPay && (
            <InlineAction
              icon="creditCard"
              label={booking.payment?.checkout_url ? 'Resume payment' : 'Pay now'}
              disabled={!!actionLoading}
              onClick={onPay}
            />
          )}
          {canShowQr && (
            <InlineAction
              icon="qrCode"
              label="Show QR"
              disabled={!!actionLoading}
              onClick={onQr}
            />
          )}
        </div>
      )}
    </button>
  );
}

function MetricCard({ icon, label, value, tone }) {
  const styles = {
    cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200',
    amber: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${styles[tone]}`}>
          <Icon name={icon} size={18} />
        </span>
        <span className="text-3xl font-bold leading-none tabular-nums text-white">{value}</span>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-300">{label}</p>
    </div>
  );
}

function EmptyState({ navigate }) {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-cyan-200/20 bg-white/[0.035] px-5 py-12 text-center shadow-[0_18px_48px_rgba(0,0,0,0.20)]">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
        <Icon name="calendar" size={28} />
      </div>
      <h2 className="text-base font-bold text-white">No bookings yet</h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-300">Reserve a nearby parking spot and your booking details will appear here.</p>
      <button
        onClick={() => navigate('map')}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] transition-all active:scale-[0.97] active:bg-cyan-200"
      >
        <Icon name="mapPin" size={16} />
        Find parking
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(item => (
        <div key={item} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 flex-none animate-pulse rounded-2xl bg-white/[0.08]" />
            <div className="flex-1 space-y-2.5">
              <div className="h-3.5 w-2/3 animate-pulse rounded bg-white/[0.08]" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-white/[0.08]" />
            </div>
          </div>
          <div className="mt-3.5 flex items-center justify-between border-t border-white/[0.06] pt-3.5">
            <div className="h-3 w-24 animate-pulse rounded bg-white/[0.08]" />
            <div className="h-4 w-16 animate-pulse rounded bg-white/[0.08]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Sheet({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="profile-sheet max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[30px] border-t border-cyan-200/15 bg-[#060a12] shadow-[0_-28px_80px_rgba(0,0,0,0.62)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex justify-center bg-[#060a12]/95 pb-2 pt-3 backdrop-blur-xl">
          <span className="h-1 w-9 rounded-full bg-cyan-200/25" />
        </div>
        <div className="px-5 pb-6 pt-1 glass-sheet-text">{children}</div>
      </div>
    </div>
  );
}

function IconButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] text-slate-400 transition-all hover:bg-white/[0.09] hover:text-white"
    >
      <Icon name={icon} size={17} />
    </button>
  );
}

function InlineAction({ icon, label, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 py-2.5 text-sm font-black text-cyan-100 transition-all hover:bg-cyan-300/15 active:scale-[0.99] disabled:opacity-50"
    >
      <Icon name={icon} size={16} />
      {label}
    </button>
  );
}

function ActionButton({ icon, label, onClick, disabled, tone = 'neutral' }) {
  const styles = {
    primary: 'bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] hover:bg-cyan-200',
    cyan: 'border border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15',
    amber: 'bg-amber-300 text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.22)] hover:bg-amber-200',
    danger: 'border border-rose-300/25 bg-rose-300/10 text-rose-100 hover:bg-rose-300/15',
    neutral: 'border border-white/[0.08] bg-white/[0.06] text-white hover:bg-white/[0.09]',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-black transition-all active:scale-[0.99] disabled:opacity-50 ${styles[tone]}`}
    >
      <Icon name={icon} size={17} />
      {label}
    </button>
  );
}

function InfoLine({ icon, text }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-300">
      <Icon name={icon} size={14} className="flex-none text-cyan-100/60" />
      <span className="truncate">{text}</span>
    </div>
  );
}

function DetailTile({ icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
      <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
        <Icon name={icon} size={16} />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-white">{value || '-'}</p>
    </div>
  );
}

function DetailRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-medium text-slate-300">{label}</span>
      <span className={`text-right text-sm ${highlight ? 'text-lg font-bold text-cyan-300' : 'font-medium text-white'}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-300/12 text-amber-200 border-amber-300/25',
    reserved: 'bg-violet-300/12 text-violet-200 border-violet-300/25',
    confirmed: 'bg-cyan-300/12 text-cyan-200 border-cyan-300/25',
    active: 'bg-emerald-300/12 text-emerald-200 border-emerald-300/25',
    completed: 'bg-white/[0.06] text-slate-300 border-white/[0.08]',
    cancelled: 'bg-rose-300/12 text-rose-200 border-rose-300/25',
  };
  const dots = {
    pending: 'bg-amber-400',
    reserved: 'bg-blue-400',
    confirmed: 'bg-cyan-400',
    active: 'bg-emerald-400',
    completed: 'bg-white/50',
    cancelled: 'bg-rose-400',
  };
  return (
    <span className={`inline-flex flex-none items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase leading-none ${styles[status] || styles.reserved}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status] || dots.reserved}`} />
      {status || 'reserved'}
    </span>
  );
}

function PaymentBadge({ status }) {
  const styles = {
    unpaid: 'bg-amber-300/12 text-amber-200 border-amber-300/25',
    paid: 'bg-emerald-300/12 text-emerald-200 border-emerald-300/25',
    pending: 'bg-cyan-300/12 text-cyan-200 border-cyan-300/25',
    awaiting_review: 'bg-violet-300/12 text-violet-200 border-violet-300/25',
    failed: 'bg-rose-300/12 text-rose-200 border-rose-300/25',
    refunded: 'bg-white/[0.06] text-slate-300 border-white/[0.08]',
  };
  return (
    <span className={`inline-flex flex-none rounded-full border px-2.5 py-1 text-[10px] font-black uppercase leading-none ${styles[status] || styles.unpaid}`}>
      {(status || 'unpaid').replace('_', ' ')}
    </span>
  );
}

function bookingToneBorder(status) {
  const styles = {
    pending: 'border-amber-300/18',
    reserved: 'border-violet-300/18',
    confirmed: 'border-cyan-300/18',
    active: 'border-emerald-300/18',
    completed: 'border-white/[0.08]',
    cancelled: 'border-rose-300/18',
    expired: 'border-rose-300/18',
  };
  return styles[status] || 'border-white/[0.08]';
}

function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US') : '0';
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
