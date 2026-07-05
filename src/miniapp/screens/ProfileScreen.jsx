import React, { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import { useUser, useToast } from '../App.jsx';
import * as api from '../api.js';
import AddSpotSheet from '../components/AddSpotSheet.jsx';
import Icon from '../components/Icons.jsx';

const PROFILE_SECTIONS = new Set(['vehicles', 'favorites', 'host', 'admin', 'language', 'help']);

export default function ProfileScreen({ navigate, target = null }) {
  const { user, reload } = useUser();
  const [section, setSection] = useState(null);

  useEffect(() => {
    if (!target) return;
    setSection(PROFILE_SECTIONS.has(target.section) ? target.section : null);
  }, [target]);

  return (
    <div className="profile-orbit min-h-full px-4 pb-5 pt-4">
      {section === null && <ProfileHeader user={user} />}

      {section === null && <MainMenu user={user} setSection={setSection} />}
      {section === 'vehicles' && <VehiclesSection onBack={() => setSection(null)} />}
      {section === 'favorites' && <FavoritesSection onBack={() => setSection(null)} navigate={navigate} />}
      {section === 'host' && <HostSection onBack={() => setSection(null)} />}
      {section === 'admin' && <AdminSection onBack={() => setSection(null)} />}
      {section === 'language' && <LanguageSection onBack={() => setSection(null)} user={user} reload={reload} />}
      {section === 'help' && <HelpSection onBack={() => setSection(null)} />}
    </div>
  );
}

function ProfileHeader({ user }) {
  const initials = (user?.name || user?.username || 'D').slice(0, 1).toUpperCase();
  const role = user?.host_access?.has_host_access && user?.role === 'driver' ? 'manager' : (user?.role || 'driver');

  return (
    <div className="relative mb-5 overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[#060b12]/80 p-4 shadow-[0_22px_60px_rgba(0,0,0,0.45)]">
      <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 left-6 h-36 w-36 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/80">
            ParkAddis ID
          </span>
          <StatusPill tone={role === 'admin' ? 'cyan' : role === 'host' ? 'emerald' : 'slate'} label={role} />
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="profile-core mb-4">
            <div className="profile-core__orb">
              <div className="profile-core__initial">{initials}</div>
            </div>
          </div>
          <h1 className="max-w-full truncate text-2xl font-black text-white">{user?.name || 'Driver'}</h1>
          <div className="mt-2 flex max-w-full items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs text-slate-300">
            <Icon name="user" size={14} className="text-cyan-200" />
            <span className="truncate">{user?.username ? `@${user.username}` : `Telegram ID ${user?.telegram_id || '-'}`}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MainMenu({ user, setSection }) {
  const hasHostAccess = user?.role === 'host' || user?.role === 'admin' || user?.host_access?.has_host_access;
  const items = [
    ...(user?.role === 'admin' ? [{
      key: 'admin',
      label: 'Admin workspace',
      icon: 'shield',
      desc: 'Queues, actions, analytics, and support',
      tone: 'cyan',
    }] : []),
    { key: 'vehicles', label: 'Vehicles', icon: 'car', desc: 'Plate numbers and defaults', tone: 'cyan' },
    { key: 'favorites', label: 'Saved spots', icon: 'heart', desc: 'Parking you want to revisit', tone: 'rose' },
    {
      key: 'host',
      label: hasHostAccess ? 'Host panel' : 'List your spot',
      icon: 'home',
      desc: hasHostAccess ? 'Bookings, reports, access, and availability' : 'Submit parking for review',
      tone: 'emerald',
    },
    { key: 'language', label: 'Language', icon: 'globe', desc: user?.language_pref === 'am' ? 'አማርኛ' : 'English', tone: 'violet' },
    { key: 'help', label: 'Help and support', icon: 'helpCircle', desc: 'Guides and account support', tone: 'amber' },
  ];

  return (
    <div className="space-y-3">
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => setSection(item.key)}
          className="profile-menu-row flex w-full items-center gap-3 rounded-[22px] border border-white/[0.08] bg-white/[0.045] p-3.5 text-left shadow-[0_16px_42px_rgba(0,0,0,0.22)] transition active:border-cyan-300/35 active:bg-cyan-300/10"
        >
          <ToneIcon icon={item.icon} tone={item.tone} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">{item.label}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{item.desc}</p>
          </div>
          <Icon name="chevronRight" size={18} className="text-slate-500" />
        </button>
      ))}
    </div>
  );
}

function VehiclesSection({ onBack }) {
  const { addToast } = useToast();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState('car');
  const [newColor, setNewColor] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getVehicles();
      setVehicles(data.vehicles || []);
    } catch {
      addToast('Failed to load vehicles', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (newPlate.trim().length < 3) {
      addToast('Plate must be at least 3 chars', 'error');
      return;
    }
    setAddLoading(true);
    try {
      await api.createVehicle({ plateNumber: newPlate.trim(), vehicleType: newType, color: newColor.trim() || null });
      addToast('Vehicle added', 'success');
      setShowAdd(false);
      setNewPlate('');
      setNewColor('');
      load();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteVehicle(id);
      addToast('Vehicle removed', 'success');
      load();
    } catch {
      addToast('Failed to remove vehicle', 'error');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await api.setDefaultVehicle(id);
      addToast('Default vehicle set', 'success');
      load();
    } catch {
      addToast('Failed to set default vehicle', 'error');
    }
  };

  return (
    <SectionFrame title="Vehicles" subtitle="Manage the vehicles you use for bookings" onBack={onBack}>
      {loading ? (
        <LoadingRows />
      ) : vehicles.length === 0 ? (
        <EmptyPanel icon="car" title="No vehicles added" text="Add a plate number to make future reservations faster." />
      ) : (
        <div className="space-y-3">
          {vehicles.map(v => (
            <ProfileCard key={v.id} tone="cyan">
              <div className="flex items-start gap-3">
                <ToneIcon icon={vehicleIcon(v.vehicle_type)} tone="cyan" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-base font-bold tracking-wide text-white">{v.plate_number}</p>
                    {v.is_default && <StatusPill tone="emerald" label="Default" />}
                  </div>
                  <p className="mt-1 text-xs capitalize text-slate-400">
                    {v.vehicle_type || 'car'}{v.color ? `, ${v.color}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 border-t border-white/[0.08] pt-3">
                {!v.is_default ? (
                  <button onClick={() => handleSetDefault(v.id)} className="rounded-xl border border-white/[0.08] bg-white/[0.06] py-2.5 text-sm font-black text-slate-200 active:bg-white/[0.09]">
                    Set default
                  </button>
                ) : (
                  <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 py-2.5 text-center text-sm font-black text-emerald-100">Primary vehicle</div>
                )}
                <IconButton icon="trash" label="Remove vehicle" onClick={() => handleDelete(v.id)} tone="danger" />
              </div>
            </ProfileCard>
          ))}
        </div>
      )}

      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan-200/25 bg-cyan-300/10 py-3 text-sm font-black text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.10)] active:bg-cyan-300/15"
        >
          <Icon name="plus" size={17} />
          Add vehicle
        </button>
      ) : (
        <ProfileCard className="mt-4" tone="cyan">
          <div className="grid gap-3">
            <Field label="Plate number">
              <input
                value={newPlate}
                onChange={e => setNewPlate(e.target.value.toUpperCase())}
                placeholder="AA-12345"
                className="field-input"
              />
            </Field>
            <Field label="Vehicle type">
              <select value={newType} onChange={e => setNewType(e.target.value)} className="field-input">
                <option value="car">Car</option>
                <option value="motorcycle">Motorcycle</option>
                <option value="truck">Truck</option>
              </select>
            </Field>
            <Field label="Color">
              <input
                value={newColor}
                onChange={e => setNewColor(e.target.value)}
                placeholder="Optional"
                className="field-input"
              />
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => setShowAdd(false)} className="rounded-xl border border-white/[0.08] bg-white/[0.045] py-3 text-sm font-black text-slate-300 active:bg-white/[0.08]">Cancel</button>
            <button onClick={handleAdd} disabled={addLoading} className="rounded-xl bg-cyan-300 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200 disabled:opacity-50">
              {addLoading ? 'Adding...' : 'Add'}
            </button>
          </div>
        </ProfileCard>
      )}
    </SectionFrame>
  );
}

function FavoritesSection({ onBack, navigate }) {
  const { addToast } = useToast();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getFavorites();
      setFavorites(data.favorites || []);
    } catch {
      addToast('Failed to load favorites', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (spotId) => {
    try {
      await api.removeFavorite(spotId);
      setFavorites(prev => prev.filter(f => f.id !== spotId));
      addToast('Removed from favorites', 'success');
    } catch {
      addToast('Failed to remove favorite', 'error');
    }
  };

  return (
    <SectionFrame title="Saved spots" subtitle="Parking locations you keep for quick access" onBack={onBack}>
      {loading ? (
        <LoadingRows />
      ) : favorites.length === 0 ? (
        <EmptyPanel icon="heart" title="No saved spots" text="Save useful parking spots from the map and they will appear here.">
          <button onClick={() => navigate('map')} className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200">
            Find spots
          </button>
        </EmptyPanel>
      ) : (
        <div className="space-y-3">
          {favorites.map(f => (
            <ProfileCard key={f.id} tone="rose">
              <div className="flex items-start gap-3">
                <ToneIcon icon="mapPin" tone="rose" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{f.address || 'Parking spot'}</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-300">{formatMoney(f.price_per_hour)} ETB/hr</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 border-t border-white/[0.08] pt-3">
                <button onClick={() => navigate('map', { spot: f })} className="rounded-xl border border-white/[0.08] bg-white/[0.06] py-2.5 text-sm font-black text-slate-200 active:bg-white/[0.09]">
                  Open on map
                </button>
                <IconButton icon="trash" label="Remove favorite" onClick={() => handleRemove(f.id)} tone="danger" />
              </div>
            </ProfileCard>
          ))}
        </div>
      )}
    </SectionFrame>
  );
}

function HostSection({ onBack }) {
  const { addToast } = useToast();
  const { user } = useUser();
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [hostTab, setHostTab] = useState('spots');
  const [manualCode, setManualCode] = useState('');
  const [hostAction, setHostAction] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [spotBookings, setSpotBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingAction, setBookingAction] = useState(null);
  const [lastCheckin, setLastCheckin] = useState(null);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRange, setReportRange] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [managers, setManagers] = useState([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managerForm, setManagerForm] = useState({
    identifier: '',
    spotId: '',
    canManageBookings: true,
    canManageSpots: true,
    canViewReports: false,
  });
  const [managerAction, setManagerAction] = useState(null);
  const canViewReports = user?.host_access?.can_view_reports || spots.some(s => s.can_view_reports);
  const ownsSpots = user?.host_access?.owns_spots || spots.some(s => s.is_owner);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getHostSpots();
      setSpots(data.spots || []);
    } catch (err) {
      addToast(err.message || 'Failed to load spots', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const reportParams = useCallback(() => {
    const today = dateInputValue(new Date());
    if (reportRange === 'today') {
      return { startDate: today, endDate: today, interval: 'day' };
    }
    if (reportRange === 'week') {
      return { startDate: dateInputValue(startOfCurrentWeek()), endDate: today, interval: 'day' };
    }
    if (reportRange === 'custom') {
      return {
        startDate: customStart || undefined,
        endDate: customEnd || undefined,
        interval: 'day',
      };
    }
    return { startDate: dateInputValue(startOfCurrentMonth()), endDate: today, interval: 'day' };
  }, [customEnd, customStart, reportRange]);

  const loadReport = useCallback(async () => {
    if (!canViewReports) return;
    setReportLoading(true);
    try {
      const data = await api.getHostRevenueReport(reportParams());
      setReport(data.report || null);
    } catch (err) {
      if (!String(err.message || '').includes('cannot view')) {
        addToast(err.message || 'Failed to load host report', 'error');
      }
    } finally {
      setReportLoading(false);
    }
  }, [addToast, canViewReports, reportParams]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await api.getHostBookingHistory({ limit: 20 });
      setHistory(data.bookings || []);
      setHistoryTotal(data.pagination?.total || 0);
    } catch (err) {
      addToast(err.message || 'Failed to load host history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  }, [addToast]);

  const loadManagers = useCallback(async () => {
    if (!ownsSpots) return;
    setManagersLoading(true);
    try {
      const data = await api.getHostManagers();
      setManagers(data.managers || []);
    } catch (err) {
      addToast(err.message || 'Failed to load managers', 'error');
    } finally {
      setManagersLoading(false);
    }
  }, [addToast, ownsSpots]);

  useEffect(() => {
    if (hostTab === 'reports') loadReport();
    if (hostTab === 'history') loadHistory();
    if (hostTab === 'team') loadManagers();
  }, [hostTab, loadHistory, loadManagers, loadReport]);

  const loadSpotBookings = useCallback(async (spotId) => {
    setBookingsLoading(true);
    try {
      const data = await api.getHostSpotBookings(spotId);
      setSpotBookings(data.bookings || []);
    } catch {
      addToast('Failed to load host bookings', 'error');
    } finally {
      setBookingsLoading(false);
    }
  }, [addToast]);

  const refreshSelectedBookings = useCallback(async () => {
    if (selectedSpot?.id) {
      await loadSpotBookings(selectedSpot.id);
    }
  }, [selectedSpot, loadSpotBookings]);

  const handleOpenBookings = async (spot) => {
    setSelectedSpot(spot);
    setSpotBookings([]);
    await loadSpotBookings(spot.id);
  };

  const recordCheckin = (booking, driverName) => {
    setLastCheckin({
      ...booking,
      driver_name: driverName || booking?.driver_name || null,
    });
  };

  const confirmQrToken = useCallback(async (token, scannedText) => {
    setHostAction('scan');
    try {
      const data = await api.checkinByQrToken(token);
      recordCheckin(data.booking, data.driver_name);
      addToast('Driver checked in', 'success');
      await refreshSelectedBookings();
    } catch (err) {
      if (isMissingHostCheckinRoute(err) && sendCheckinToTelegram({ type: 'checkin', token }, scannedText)) {
        addToast('Sent QR to the bot for check-in', 'info');
        return;
      }
      addToast(checkinErrorMessage(err), 'error');
    } finally {
      setHostAction(null);
    }
  }, [addToast, refreshSelectedBookings]);

  const handleScanQr = () => {
    const tg = window.Telegram?.WebApp;
    const scanQr = tg?.showScanQrPopup || tg?.openScanQrPopup;

    if (!scanQr) {
      addToast('Open the mini app in Telegram mobile to scan QR, or enter the code below.', 'info');
      return;
    }

    scanQr.call(tg, { text: 'Scan the driver booking QR' }, (scannedText) => {
      const token = parseCheckinToken(scannedText);
      if (!token) {
        addToast('That is not a ParkAddis booking QR', 'error');
        return false;
      }

      confirmQrToken(token, scannedText);
      return true;
    });
  };

  const handleManualCheckin = async (event) => {
    event?.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (code.length < 3) {
      addToast('Enter the driver confirmation code', 'error');
      return;
    }

    setHostAction('manual');
    try {
      const data = await api.checkinByCode(code);
      recordCheckin(data.booking, data.driver_name);
      setManualCode('');
      addToast('Driver checked in', 'success');
      await refreshSelectedBookings();
    } catch (err) {
      if (isMissingHostCheckinRoute(err) && sendCheckinToTelegram({ type: 'checkin_code', code })) {
        addToast('Sent code to the bot for check-in', 'info');
        return;
      }
      addToast(checkinErrorMessage(err), 'error');
    } finally {
      setHostAction(null);
    }
  };

  const handleBookingCheckin = async (booking) => {
    setBookingAction(`checkin:${booking.id}`);
    try {
      const data = await api.checkinBooking(booking.id);
      recordCheckin(data.booking, booking.driver_name);
      addToast('Booking confirmed at arrival', 'success');
      await refreshSelectedBookings();
    } catch (err) {
      addToast(checkinErrorMessage(err), 'error');
    } finally {
      setBookingAction(null);
    }
  };

  const handleCompleteBooking = async (booking) => {
    setBookingAction(`complete:${booking.id}`);
    try {
      await api.completeBooking(booking.id);
      addToast('Booking marked complete', 'success');
      await refreshSelectedBookings();
    } catch (err) {
      addToast(checkinErrorMessage(err), 'error');
    } finally {
      setBookingAction(null);
    }
  };

  const handleToggleAvailability = async (spot) => {
    try {
      await api.updateHostSpot(spot.id, { isAvailable: !spot.is_available });
      addToast(spot.is_available ? 'Spot paused' : 'Spot activated', 'success');
      load();
    } catch {
      addToast('Failed to update spot', 'error');
    }
  };

  const handleDelete = async (spotId) => {
    try {
      await api.deleteHostSpot(spotId);
      addToast('Spot removed', 'success');
      load();
    } catch {
      addToast('Failed to remove spot', 'error');
    }
  };

  const handleAssignManager = async (event) => {
    event.preventDefault();
    const managerIdentifier = managerForm.identifier.trim();
    if (!managerIdentifier) {
      addToast('Enter the manager username', 'error');
      return;
    }

    setManagerAction('assign');
    try {
      await api.assignHostManager({
        managerIdentifier,
        managerUsername: managerIdentifier,
        spotId: managerForm.spotId ? Number(managerForm.spotId) : null,
        canManageBookings: managerForm.canManageBookings,
        canManageSpots: managerForm.canManageSpots,
        canViewReports: managerForm.canViewReports,
      });
      addToast('Manager assigned', 'success');
      setManagerForm({
        identifier: '',
        spotId: '',
        canManageBookings: true,
        canManageSpots: true,
        canViewReports: false,
      });
      await loadManagers();
    } catch (err) {
      addToast(err.message || 'Failed to assign manager', 'error');
    } finally {
      setManagerAction(null);
    }
  };

  const handleRemoveManager = async (managerId) => {
    setManagerAction(`remove:${managerId}`);
    try {
      await api.removeHostManager(managerId);
      addToast('Manager access removed', 'success');
      await loadManagers();
    } catch (err) {
      addToast(err.message || 'Failed to remove manager', 'error');
    } finally {
      setManagerAction(null);
    }
  };

  return (
    <SectionFrame title="Host panel" subtitle="Operations, revenue, history, and delegated access" onBack={onBack}>
      <HostTabs
        active={hostTab}
        setActive={setHostTab}
        canViewReports={canViewReports}
        ownsSpots={ownsSpots}
      />

      {hostTab === 'spots' && (
        loading ? (
          <LoadingRows />
        ) : spots.length === 0 ? (
          <EmptyPanel icon="home" title="No host listings" text="Add your first parking spot and submit it for admin review." />
        ) : (
          <>
            {spots.some(s => s.can_manage_bookings) && (
              <HostCheckinPanel
                manualCode={manualCode}
                setManualCode={setManualCode}
                action={hostAction}
                onScan={handleScanQr}
                onManualSubmit={handleManualCheckin}
              />
            )}

            {lastCheckin && <LastCheckin booking={lastCheckin} />}

            <div className="mt-4 space-y-3">
              {spots.map(s => (
                <ProfileCard key={s.id} tone="emerald">
                  <div className="flex items-start gap-3">
                    <ToneIcon icon="parking" tone="emerald" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="min-w-0 truncate text-sm font-bold text-white">{s.address || 'My spot'}</p>
                          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {s.is_owner ? 'Owner access' : 'Manager access'}
                          </p>
                        </div>
                        <SpotStatus spot={s} />
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <InfoPill icon="creditCard" text={`${formatMoney(s.price_per_hour)} ETB/hr`} />
                        <InfoPill icon="parking" text={`${s.available_spaces ?? s.capacity} of ${s.capacity} available`} />
                      </div>
                    </div>
                  </div>
                  <div className={`mt-4 grid gap-2 border-t border-white/[0.08] pt-3 ${s.is_owner ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-2'}`}>
                    {s.can_manage_bookings && (
                      <button onClick={() => handleOpenBookings(s)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 py-2.5 text-sm font-black text-cyan-100 active:bg-cyan-300/15">
                        <Icon name="calendar" size={16} />
                        Bookings
                      </button>
                    )}
                    {s.can_manage_spots && (
                      <button onClick={() => handleToggleAvailability(s)} className="rounded-xl border border-white/[0.08] bg-white/[0.06] px-2 py-2.5 text-sm font-black text-slate-200 active:bg-white/[0.09]">
                        {s.is_available ? 'Pause' : 'Activate'}
                      </button>
                    )}
                    {s.is_owner && <IconButton icon="trash" label="Delete listing" onClick={() => handleDelete(s.id)} tone="danger" />}
                  </div>
                </ProfileCard>
              ))}
            </div>
          </>
        )
      )}

      {hostTab === 'reports' && (
        <HostReportPanel
          report={report}
          loading={reportLoading}
          range={reportRange}
          setRange={setReportRange}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
          onRefresh={loadReport}
          canViewReports={canViewReports}
        />
      )}

      {hostTab === 'history' && (
        <HostHistoryPanel
          bookings={history}
          total={historyTotal}
          loading={historyLoading}
          onRefresh={loadHistory}
        />
      )}

      {hostTab === 'team' && (
        <HostTeamPanel
          spots={spots.filter(s => s.is_owner)}
          managers={managers}
          loading={managersLoading}
          form={managerForm}
          setForm={setManagerForm}
          action={managerAction}
          onSubmit={handleAssignManager}
          onRemove={handleRemoveManager}
          ownsSpots={ownsSpots}
        />
      )}

      <button
        onClick={() => setShowAdd(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-200/25 bg-emerald-300/10 py-3 text-sm font-black text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.10)] active:bg-emerald-300/15"
      >
        <Icon name="plus" size={17} />
        Add my parking spot
      </button>

      <AddSpotSheet open={showAdd} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} />
      {selectedSpot && (
        <HostBookingsSheet
          spot={selectedSpot}
          bookings={spotBookings}
          loading={bookingsLoading}
          action={bookingAction}
          onClose={() => setSelectedSpot(null)}
          onRefresh={() => loadSpotBookings(selectedSpot.id)}
          onCheckin={handleBookingCheckin}
          onComplete={handleCompleteBooking}
        />
      )}
    </SectionFrame>
  );
}

function LanguageSection({ onBack, user, reload }) {
  const { addToast } = useToast();
  const current = user?.language_pref || 'en';
  const languages = [
    { key: 'en', label: 'English', desc: 'English interface' },
    { key: 'am', label: 'አማርኛ', desc: 'Amharic interface' },
  ];

  const handleChange = async (lang) => {
    try {
      await api.setLanguage(lang);
      addToast(lang === 'am' ? 'ቋንቋ ተቀየረ' : 'Language changed', 'success');
      reload();
    } catch {
      addToast('Failed to change language', 'error');
    }
  };

  return (
    <SectionFrame title="Language" subtitle="Choose the language used in the mini app" onBack={onBack}>
      <div className="space-y-3">
        {languages.map(lang => (
          <button
            key={lang.key}
            onClick={() => handleChange(lang.key)}
            className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${
              current === lang.key
                ? 'border-cyan-200/45 bg-cyan-300/15 shadow-[0_0_28px_rgba(34,211,238,0.16)]'
                : 'border-white/[0.08] bg-white/[0.045] active:bg-white/[0.08]'
            }`}
          >
            <ToneIcon icon="globe" tone={current === lang.key ? 'cyan' : 'slate'} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{lang.label}</p>
              <p className="mt-1 text-xs text-slate-400">{lang.desc}</p>
            </div>
            {current === lang.key && <Icon name="checkCircle" size={20} className="text-cyan-300" />}
          </button>
        ))}
      </div>
    </SectionFrame>
  );
}

function HelpSection({ onBack }) {
  const { addToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [botUsername, setBotUsername] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [query, setQuery] = useState('');
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketCategory, setTicketCategory] = useState('booking');
  const [ticketDescription, setTicketDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const ticketFormRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSupport() {
      setLoading(true);
      const [helpResult, ticketResult] = await Promise.allSettled([
        api.getHelp(),
        api.getSupportTickets(5),
      ]);

      if (cancelled) return;

      if (helpResult.status === 'fulfilled') {
        setCategories(helpResult.value.categories || []);
        setBotUsername(helpResult.value.bot_username || '');
      }
      if (ticketResult.status === 'fulfilled') {
        setTickets(ticketResult.value.tickets || []);
      }
      if (helpResult.status === 'rejected' && ticketResult.status === 'rejected') {
        addToast('Failed to load support details', 'error');
      }
      setLoading(false);
    }

    loadSupport();
    return () => { cancelled = true; };
  }, [addToast]);

  const handleContact = () => {
    if (!botUsername) {
      addToast('Support contact is unavailable right now', 'error');
      return;
    }
    const url = `https://t.me/${botUsername}`;
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, '_blank');
  };

  const handleNewTicket = () => {
    setShowTicketForm(true);
    requestAnimationFrame(() => {
      ticketFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleSubmitTicket = async (event) => {
    event.preventDefault();
    const description = ticketDescription.trim();

    if (description.length < 10) {
      addToast('Describe the issue in at least 10 characters', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.createSupportTicket({
        category: ticketCategory,
        description,
      });
      setTickets(prev => [data.ticket, ...prev].filter(Boolean).slice(0, 5));
      setTicketDescription('');
      setShowTicketForm(false);
      setExpanded('tickets');
      addToast(`Ticket #${data.ticket.id} sent to support`, 'success');
    } catch (err) {
      addToast(err.message || 'Failed to submit ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SectionFrame title="Help & support" subtitle="Search answers or reach the team" onBack={onBack}>
      {loading ? (
        <LoadingRows />
      ) : (
        <div className="space-y-4">
          <HelpSearch query={query} setQuery={setQuery} />

          <SupportContactCard onContact={handleContact} onNewTicket={handleNewTicket} />

          <QuickAnswers categories={categories} query={query} expanded={expanded} setExpanded={setExpanded} onNewTicket={handleNewTicket} />

          <RecentTickets tickets={tickets} expanded={expanded} setExpanded={setExpanded} />

          {showTicketForm && (
            <TicketForm
              ref={ticketFormRef}
              ticketCategory={ticketCategory}
              setTicketCategory={setTicketCategory}
              ticketDescription={ticketDescription}
              setTicketDescription={setTicketDescription}
              submitting={submitting}
              onSubmit={handleSubmitTicket}
              onCancel={() => setShowTicketForm(false)}
            />
          )}
        </div>
      )}
    </SectionFrame>
  );
}

function HelpSearch({ query, setQuery }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
        <Icon name="search" size={18} />
      </span>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search help…"
        className="field-input w-full pl-10 pr-10"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 active:bg-white/[0.08] active:text-white"
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

function SupportContactCard({ onContact, onNewTicket }) {
  return (
    <ProfileCard tone="cyan">
      <div className="flex items-start gap-3">
        <ToneIcon icon="send" tone="cyan" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Need a hand?</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Message the team on Telegram, or open a ticket to track a specific issue.</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onContact}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200"
        >
          <Icon name="send" size={16} />
          Telegram
        </button>
        <button
          type="button"
          onClick={onNewTicket}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.06] px-3 py-3 text-sm font-black text-slate-200 active:bg-white/[0.09]"
        >
          <Icon name="plus" size={16} />
          New ticket
        </button>
      </div>
    </ProfileCard>
  );
}

function QuickAnswers({ categories, query, expanded, setExpanded, onNewTicket }) {
  if (categories.length === 0) return null;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? categories.filter(cat =>
        String(cat.title || '').toLowerCase().includes(q) ||
        plainHelpContent(cat.content).toLowerCase().includes(q))
    : categories;

  const isSearching = q.length > 0;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick answers</p>
        <p className="mt-1 text-sm leading-5 text-slate-400">
          {isSearching
            ? `${filtered.length} answer${filtered.length === 1 ? '' : 's'} for “${query.trim()}”`
            : 'Short guides for common parking and account problems.'}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cyan-200/20 bg-black/20 px-4 py-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
            <Icon name="search" size={22} />
          </div>
          <p className="text-sm font-bold text-white">No answers match “{query.trim()}”</p>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-slate-400">Try a different word, or send a ticket and the team will help.</p>
          <button
            type="button"
            onClick={onNewTicket}
            className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200"
          >
            <Icon name="plus" size={16} />
            Send a ticket
          </button>
        </div>
      ) : (
        filtered.map(cat => {
          const open = isSearching || expanded === cat.key;
          return (
            <div key={cat.key} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.045] shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
              <button
                onClick={() => setExpanded(expanded === cat.key ? null : cat.key)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <ToneIcon icon={helpIcon(cat.key)} tone={helpTone(cat.key)} />
                <span className="min-w-0 flex-1 text-sm font-bold text-white">{cat.title}</span>
                <Icon name="chevronDown" size={18} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <div className="border-t border-white/[0.08] px-4 pb-4 pt-3">
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-300">{plainHelpContent(cat.content)}</p>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

const TicketForm = forwardRef(function TicketForm({
  ticketCategory,
  setTicketCategory,
  ticketDescription,
  setTicketDescription,
  submitting,
  onSubmit,
  onCancel,
}, ref) {
  const selected = SUPPORT_TICKET_CATEGORIES.find(item => item.key === ticketCategory);

  return (
    <form ref={ref} onSubmit={onSubmit} className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
      <div className="flex items-start gap-3">
        <ToneIcon icon="fileText" tone="cyan" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Submit a support ticket</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Use this when payment, booking, check-in, or host access is not working.</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close ticket form"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-400 active:bg-white/[0.08] active:text-white"
        >
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="mt-4">
        <Field label="Category">
          <div className="grid grid-cols-2 gap-2">
            {SUPPORT_TICKET_CATEGORIES.map(item => {
              const active = ticketCategory === item.key;
              return (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setTicketCategory(item.key)}
                  className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                    active
                      ? 'border-cyan-200/45 bg-cyan-300/15'
                      : 'border-white/[0.08] bg-black/20 active:bg-white/[0.07]'
                  }`}
                >
                  <Icon name={item.icon} size={17} className={active ? 'text-cyan-300' : 'text-slate-400'} />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{item.label}</span>
                  {active && <Icon name="check" size={16} className="text-cyan-300" />}
                </button>
              );
            })}
          </div>
        </Field>
        {selected && <p className="mt-2 text-xs leading-5 text-slate-400">{selected.hint}</p>}
      </div>

      <div className="mt-4">
        <Field label="What happened?">
          <textarea
            value={ticketDescription}
            onChange={e => setTicketDescription(e.target.value)}
            rows={5}
            maxLength={1000}
            placeholder="Include booking code, payment reference, spot name, date, and what you expected to happen."
            className="field-input resize-none leading-6"
          />
        </Field>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-[11px] leading-4 text-slate-500">{ticketDescription.trim().length}/1000</p>
        <button
          type="submit"
          disabled={submitting || ticketDescription.trim().length < 10}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200 disabled:opacity-50"
        >
          <Icon name="fileText" size={17} />
          {submitting ? 'Sending...' : 'Send ticket'}
        </button>
      </div>
    </form>
  );
});

function AdminSection({ onBack }) {
  const { addToast } = useToast();
  const [workspace, setWorkspace] = useState(null);
  const [adminReport, setAdminReport] = useState(null);
  const [activeMode, setActiveMode] = useState('queue');
  const [adminReportType, setAdminReportType] = useState('payments');
  const [adminReportRange, setAdminReportRange] = useState('month');
  const [adminCustomStart, setAdminCustomStart] = useState('');
  const [adminCustomEnd, setAdminCustomEnd] = useState('');
  const [activeQueue, setActiveQueue] = useState('pending_spots');
  const [queueCache, setQueueCache] = useState({});
  const [queueLoading, setQueueLoading] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [operationDetail, setOperationDetail] = useState(null);
  const [decision, setDecision] = useState(null);
  const [replyText, setReplyText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminWorkspace();
      setWorkspace(data);
      setQueueCache({});
    } catch (err) {
      const message = err.message || 'Failed to load admin workspace';
      setError(message);
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const adminReportParams = useCallback(() => (
    buildAdminReportParams({
      type: adminReportType,
      range: adminReportRange,
      customStart: adminCustomStart,
      customEnd: adminCustomEnd,
    })
  ), [adminCustomEnd, adminCustomStart, adminReportRange, adminReportType]);

  const loadAdminReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const data = await api.getAdminReport(adminReportParams());
      setAdminReport(data.report || data);
    } catch (err) {
      addToast(err.message || 'Failed to load admin reports', 'error');
    } finally {
      setReportLoading(false);
    }
  }, [addToast, adminReportParams]);

  useEffect(() => {
    if (activeMode === 'reports') {
      loadAdminReport();
    }
  }, [activeMode, loadAdminReport]);

  const runAdminAction = useCallback(async (key, run, successMessage) => {
    setAction(key);
    try {
      const result = await run();
      addToast(successMessage, 'success');
      await load();
      return result || true;
    } catch (err) {
      addToast(err.message || 'Admin action failed', 'error');
      return null;
    } finally {
      setAction(null);
    }
  }, [addToast, load]);

  const loadQueuePage = useCallback(async (queueKey = activeQueue, { append = true } = {}) => {
    const workspaceQueue = workspace?.queues?.[queueKey] || { items: [], total: 0 };
    const cachedQueue = queueCache[queueKey];
    const baseQueue = cachedQueue || workspaceQueue;
    const offset = append ? (baseQueue.items || []).length : 0;
    const key = `${queueKey}:${append ? 'append' : 'reload'}`;

    setQueueLoading(key);
    try {
      const page = await fetchAdminQueue(queueKey, offset);
      setQueueCache(prev => ({
        ...prev,
        [queueKey]: mergeAdminQueuePage(queueKey, page, append ? baseQueue.items : []),
      }));
    } catch (err) {
      addToast(err.message || 'Failed to load queue', 'error');
    } finally {
      setQueueLoading(null);
    }
  }, [activeQueue, addToast, queueCache, workspace]);

  const openQueue = useCallback((queueKey) => {
    setActiveQueue(queueKey);
    setActiveMode('queue');
  }, []);

  const handleRejectSpot = useCallback((spot) => {
    setDecision({
      actionKey: `spot:reject:${spot.id}`,
      icon: 'parking',
      tone: 'rose',
      title: 'Reject listing',
      subtitle: spot.address || `Spot #${spot.id}`,
      submitLabel: 'Reject listing',
      fields: [
        { name: 'reason', label: 'Reason', type: 'textarea', defaultValue: spot.rejection_reason || '', placeholder: 'Missing photos, incorrect location, duplicate listing...' },
      ],
      onSubmit: (values) => runAdminAction(`spot:reject:${spot.id}`, () => api.rejectAdminSpot(spot.id, values.reason.trim()), 'Spot rejected'),
    });
  }, [runAdminAction]);

  const handleCancelBooking = useCallback((booking) => {
    setDecision({
      actionKey: `booking:cancel:${booking.id}`,
      icon: 'calendar',
      tone: 'rose',
      title: 'Cancel booking',
      subtitle: booking.confirmation_code || booking.address || `Booking #${booking.id}`,
      submitLabel: 'Cancel booking',
      fields: [
        { name: 'reason', label: 'Reason', type: 'textarea', defaultValue: 'Cancelled by admin', required: true },
      ],
      onSubmit: (values) => runAdminAction(`booking:cancel:${booking.id}`, () => api.cancelAdminBooking(booking.id, values.reason.trim()), 'Booking cancelled'),
    });
  }, [runAdminAction]);

  const handleResolveDispute = useCallback((dispute, mode) => {
    const isReject = mode === 'reject';
    setDecision({
      actionKey: `dispute:${mode}:${dispute.id}`,
      icon: 'shield',
      tone: isReject ? 'rose' : 'emerald',
      title: isReject ? 'Reject dispute' : 'Resolve dispute',
      subtitle: dispute.confirmation_code || dispute.address || `Dispute #${dispute.id}`,
      submitLabel: isReject ? 'Reject dispute' : 'Resolve dispute',
      fields: [
        { name: 'resolution', label: isReject ? 'Rejection reason' : 'Resolution note', type: 'textarea', required: true },
      ],
      onSubmit: (values) => {
        const run = isReject
          ? () => api.rejectAdminDispute(dispute.id, values.resolution.trim())
          : () => api.resolveAdminDispute(dispute.id, values.resolution.trim());
        return runAdminAction(`dispute:${mode}:${dispute.id}`, run, isReject ? 'Dispute rejected' : 'Dispute resolved');
      },
    });
  }, [runAdminAction]);

  const handleBanUser = useCallback((user) => {
    setDecision({
      actionKey: `user:ban:${user.id}`,
      icon: 'user',
      tone: 'rose',
      title: 'Ban user',
      subtitle: user.name || user.username || `User #${user.id}`,
      submitLabel: 'Ban user',
      fields: [
        { name: 'reason', label: 'Reason', type: 'textarea', defaultValue: user.ban_reason || '', placeholder: 'Fraud, abuse, repeated no-show...' },
      ],
      onSubmit: (values) => runAdminAction(`user:ban:${user.id}`, () => api.banAdminUser(user.id, values.reason.trim()), 'User banned'),
    });
  }, [runAdminAction]);

  const handleSetUserRole = useCallback((user) => {
    setDecision({
      actionKey: `user:role:${user.id}`,
      icon: 'shield',
      tone: 'cyan',
      title: 'Change role',
      subtitle: user.name || user.username || `User #${user.id}`,
      submitLabel: 'Update role',
      fields: [
        {
          name: 'role',
          label: 'Role',
          type: 'select',
          defaultValue: user.role || 'driver',
          required: true,
          options: [
            { value: 'driver', label: 'Driver' },
            { value: 'host', label: 'Host' },
            { value: 'admin', label: 'Admin' },
          ],
        },
      ],
      onSubmit: (values) => runAdminAction(`user:role:${user.id}`, () => api.setAdminUserRole(user.id, values.role), 'Role updated'),
    });
  }, [runAdminAction]);

  const handleCreatePayout = useCallback(async (balance) => {
    const defaultAmount = String(Math.max(0, Number(balance.balance || 0)));
    const key = `payout:create:${balance.host_id}`;
    setDecision({
      actionKey: key,
      icon: 'receipt',
      tone: 'emerald',
      title: 'Create payout',
      subtitle: balance.host_name || `Host #${balance.host_id}`,
      submitLabel: 'Create payout',
      fields: [
        { name: 'amount', label: 'Amount', type: 'number', defaultValue: defaultAmount, required: true },
        { name: 'note', label: 'Note', type: 'textarea', defaultValue: 'Mini app payout' },
        { name: 'markSent', label: 'Mark sent now', type: 'checkbox', defaultValue: false },
      ],
      onSubmit: async (values) => {
        const amount = Number(values.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          addToast('Amount must be greater than 0', 'error');
          return null;
        }

        setAction(key);
        try {
          const data = await api.createAdminPayout(balance.host_id, amount, String(values.note || '').trim());
          if (values.markSent && data?.payout?.id) {
            await api.markAdminPayoutSent(data.payout.id);
            addToast('Payout marked sent', 'success');
          } else {
            addToast('Payout created', 'success');
          }
          await load();
          return true;
        } catch (err) {
          addToast(err.message || 'Payout failed', 'error');
          return null;
        } finally {
          setAction(null);
        }
      },
    });
  }, [addToast, load]);

  const openTicket = useCallback(async (ticket) => {
    setAction(`ticket:open:${ticket.id}`);
    try {
      const data = await api.getAdminTicket(ticket.id);
      setTicketDetail(data.ticket || data);
      setReplyText('');
    } catch (err) {
      addToast(err.message || 'Failed to load ticket', 'error');
    } finally {
      setAction(null);
    }
  }, [addToast]);

  const openPayment = useCallback(async (payment) => {
    setAction(`payment:open:${payment.id}`);
    try {
      const data = await api.getAdminPayment(payment.id);
      setPaymentDetail(data.payment || data);
    } catch (err) {
      addToast(err.message || 'Failed to load payment', 'error');
    } finally {
      setAction(null);
    }
  }, [addToast]);

  const openOperation = useCallback((type, item) => {
    setOperationDetail({ type, item });
  }, []);

  const handleRefundPayment = useCallback((payment) => {
    const key = `payment:refund:${payment.id}`;
    setDecision({
      actionKey: key,
      icon: 'creditCard',
      tone: 'rose',
      title: 'Refund payment',
      subtitle: `${formatMoney(payment.amount)} ETB - ${payment.reference || payment.confirmation_code || `Payment #${payment.id}`}`,
      submitLabel: 'Refund payment',
      fields: [],
      onSubmit: async () => {
        setAction(key);
        try {
          const data = await api.refundAdminPayment(payment.id);
          const updated = data.payment || data;
          setPaymentDetail(prev => prev?.id === payment.id ? { ...prev, ...updated } : prev);
          addToast('Payment refunded', 'success');
          await load();
          return true;
        } catch (err) {
          addToast(err.message || 'Refund failed', 'error');
          return null;
        } finally {
          setAction(null);
        }
      },
    });
  }, [addToast, load]);

  const handleTicketStatus = useCallback(async (ticket, status) => {
    await runAdminAction(
      `ticket:status:${ticket.id}:${status}`,
      () => api.updateAdminTicketStatus(ticket.id, status),
      `Ticket marked ${formatStatusLabel(status)}`
    );
    if (ticketDetail?.id === ticket.id) {
      try {
        const data = await api.getAdminTicket(ticket.id);
        setTicketDetail(data.ticket || data);
      } catch {
        setTicketDetail(prev => prev ? { ...prev, status } : prev);
      }
    }
  }, [runAdminAction, ticketDetail]);

  const handleTicketReply = useCallback(async (event) => {
    event.preventDefault();
    const message = replyText.trim();
    if (!message || !ticketDetail) return;

    setAction(`ticket:reply:${ticketDetail.id}`);
    try {
      const data = await api.replyAdminTicket(ticketDetail.id, message);
      setTicketDetail(data.ticket || data);
      setReplyText('');
      addToast('Reply sent', 'success');
      await load();
    } catch (err) {
      addToast(err.message || 'Reply failed', 'error');
    } finally {
      setAction(null);
    }
  }, [addToast, load, replyText, ticketDetail]);

  const queues = workspace?.queues || {};
  const currentQueue = queueCache[activeQueue] || queues[activeQueue] || { items: [], total: 0 };
  const activeQueueLoading = queueLoading?.startsWith(`${activeQueue}:`);

  const handlers = {
    approveSpot: (spot) => runAdminAction(`spot:approve:${spot.id}`, () => api.approveAdminSpot(spot.id), 'Spot approved'),
    rejectSpot: handleRejectSpot,
    suspendSpot: (spot) => runAdminAction(`spot:suspend:${spot.id}`, () => api.suspendAdminSpot(spot.id), 'Spot suspended'),
    reactivateSpot: (spot) => runAdminAction(`spot:reactivate:${spot.id}`, () => api.reactivateAdminSpot(spot.id), 'Spot reactivated'),
    openTicket,
    openPayment,
    openOperation,
    ticketStatus: handleTicketStatus,
    cancelBooking: handleCancelBooking,
    refundPayment: handleRefundPayment,
    createPayout: handleCreatePayout,
    resolveDispute: (dispute) => handleResolveDispute(dispute, 'resolve'),
    rejectDispute: (dispute) => handleResolveDispute(dispute, 'reject'),
    banUser: handleBanUser,
    unbanUser: (user) => runAdminAction(`user:unban:${user.id}`, () => api.unbanAdminUser(user.id), 'User unbanned'),
    setUserRole: handleSetUserRole,
  };

  return (
    <SectionFrame title="Admin workspace" subtitle="Review live queues, support tickets, payouts, and account actions" onBack={onBack}>
      {loading && !workspace ? (
        <LoadingRows />
      ) : error ? (
        <EmptyPanel icon="shield" title="Admin workspace unavailable" text={error}>
          <button onClick={load} className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200">
            Try again
          </button>
        </EmptyPanel>
      ) : (
        <div className="space-y-4">
          <AdminWorkspaceHeader queues={queues} loading={loading} onRefresh={load} />
          <AdminModeTabs activeMode={activeMode} setActiveMode={setActiveMode} />

          {activeMode === 'queue' && (
            <>
              <AdminQueueTabs queues={queues} activeQueue={activeQueue} setActiveQueue={setActiveQueue} />
              <AdminQueueContent
                queueKey={activeQueue}
                queue={currentQueue}
                action={action}
                handlers={handlers}
                loading={activeQueueLoading}
                onLoadMore={() => loadQueuePage(activeQueue, { append: true })}
                onReload={() => loadQueuePage(activeQueue, { append: false })}
              />
            </>
          )}

          {activeMode === 'reports' && (
            <AdminReportsPanel
              report={adminReport}
              workspace={workspace}
              loading={reportLoading}
              onRefresh={loadAdminReport}
              openQueue={openQueue}
              reportType={adminReportType}
              setReportType={setAdminReportType}
              range={adminReportRange}
              setRange={setAdminReportRange}
              customStart={adminCustomStart}
              setCustomStart={setAdminCustomStart}
              customEnd={adminCustomEnd}
              setCustomEnd={setAdminCustomEnd}
            />
          )}

          {activeMode === 'actions' && (
            <AdminActionHub
              overview={workspace?.overview || {}}
              queues={queues}
              openQueue={openQueue}
              onRefresh={load}
            />
          )}

          <button
            onClick={load}
            disabled={loading}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 py-3 text-sm font-black text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.12)] active:bg-cyan-300/15 disabled:opacity-50"
          >
            <Icon name="refreshCw" size={16} />
            {loading ? 'Refreshing...' : 'Refresh workspace'}
          </button>
        </div>
      )}

      {ticketDetail && (
        <AdminTicketSheet
          ticket={ticketDetail}
          replyText={replyText}
          setReplyText={setReplyText}
          action={action}
          onClose={() => setTicketDetail(null)}
          onReply={handleTicketReply}
          onStatus={(status) => handleTicketStatus(ticketDetail, status)}
        />
      )}

      {paymentDetail && (
        <AdminPaymentSheet
          payment={paymentDetail}
          action={action}
          onClose={() => setPaymentDetail(null)}
          onRefund={handleRefundPayment}
        />
      )}

      {decision && (
        <AdminDecisionSheet
          key={decision.actionKey}
          decision={decision}
          action={action}
          onClose={() => setDecision(null)}
        />
      )}

      {operationDetail && (
        <AdminOperationSheet
          detail={operationDetail}
          action={action}
          handlers={handlers}
          onClose={() => setOperationDetail(null)}
        />
      )}
    </SectionFrame>
  );
}

function AdminModeTabs({ activeMode, setActiveMode }) {
  const modes = [
    { key: 'queue', label: 'Queue', icon: 'shield' },
    { key: 'reports', label: 'Reports', icon: 'barChart' },
    { key: 'actions', label: 'Actions', icon: 'zap' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.08] bg-black/20 p-1">
      {modes.map(mode => {
        const active = activeMode === mode.key;
        return (
          <button
            key={mode.key}
            type="button"
            onClick={() => setActiveMode(mode.key)}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-2 text-xs font-black transition ${
              active
                ? 'bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.22)]'
                : 'text-slate-400 active:bg-white/[0.07] active:text-white'
            }`}
          >
            <Icon name={mode.icon} size={15} />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

function AdminReportsPanel({
  report,
  workspace,
  loading,
  onRefresh,
  openQueue,
  reportType,
  setReportType,
  range,
  setRange,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
}) {
  const queues = workspace?.queues || {};
  const openWork = ADMIN_QUEUE_TABS.reduce((sum, tab) => sum + Number(queues[tab.key]?.total || 0), 0);
  const config = adminReportConfig(reportType);
  const summaryCards = adminReportSummaryCards(reportType, report?.summary || {}, openWork);
  const trend = report?.trend || [];
  const primaryBreakdown = adminPrimaryBreakdown(reportType, report?.breakdowns || {});
  const secondaryBreakdown = adminSecondaryBreakdown(reportType, report?.breakdowns || {});
  const rows = report?.rows || [];

  return (
    <div className="space-y-4">
      <ProfileCard tone={config.tone}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <ToneIcon icon={config.icon} tone={config.tone} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin report</p>
              <p className="mt-1 truncate text-lg font-black text-white">{config.label}</p>
              <p className="mt-1 text-xs text-slate-400">{adminReportRangeLabel(report, range)}</p>
            </div>
          </div>
          <IconButton icon="refreshCw" label="Refresh reports" onClick={onRefresh} />
        </div>
      </ProfileCard>

      <AdminReportTypeTabs active={reportType} setActive={setReportType} />

      <AdminReportRangeControls
        range={range}
        setRange={setRange}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        loading={loading}
        onRefresh={onRefresh}
      />

      {loading && !report ? <LoadingRows /> : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {summaryCards.map(card => (
              <AdminReportMetric key={card.label} {...card} />
            ))}
          </div>

          <AdminReportSection title={`${config.label} trend`} actionLabel={loading ? 'Loading...' : 'Refresh'} onAction={onRefresh}>
            {trend.length === 0 ? (
              <AdminMutedLine text="No trend data in this range." />
            ) : (
              <AdminTrendBars rows={trend} type={reportType} />
            )}
          </AdminReportSection>

          <AdminReportSection title={primaryBreakdown.title}>
            {primaryBreakdown.rows.length === 0 ? (
              <AdminMutedLine text="No breakdown data in this range." />
            ) : primaryBreakdown.rows.map((row, index) => (
              <AdminBarRow
                key={`${primaryBreakdown.title}-${row.label || index}`}
                label={formatStatusLabel(row.label)}
                value={adminBreakdownValue(row, reportType)}
                rawValue={Number(row.amount ?? row.count ?? 0)}
                max={adminBreakdownMax(primaryBreakdown.rows, reportType)}
                tone={adminBreakdownTone(reportType, row.label)}
              />
            ))}
          </AdminReportSection>

          {secondaryBreakdown.rows.length > 0 && (
            <AdminReportSection title={secondaryBreakdown.title}>
              {secondaryBreakdown.rows.map((row, index) => (
                <AdminBarRow
                  key={`${secondaryBreakdown.title}-${row.label || index}`}
                  label={formatStatusLabel(row.label)}
                  value={adminBreakdownValue(row, reportType)}
                  rawValue={Number(row.amount ?? row.count ?? 0)}
                  max={adminBreakdownMax(secondaryBreakdown.rows, reportType)}
                  tone={adminBreakdownTone(reportType, row.label)}
                />
              ))}
            </AdminReportSection>
          )}

          {reportType === 'marketplace' && (report?.top_spots || []).length > 0 && (
            <AdminReportSection title="Top spots">
              {(report.top_spots || []).map(spot => (
                <AdminReportRow
                  key={spot.id}
                  icon="parking"
                  tone="emerald"
                  title={spot.address || `Spot #${spot.id}`}
                  subtitle={`${Number(spot.booking_count || 0)} bookings / ${Number(spot.rating_avg || 0).toFixed(1)} rating`}
                  value={`${formatMoney(spot.total_revenue)} ETB`}
                />
              ))}
            </AdminReportSection>
          )}

          <AdminReportSection title={`Recent ${config.label.toLowerCase()}`}>
            {rows.length === 0 ? (
              <AdminMutedLine text="No rows found for this report range." />
            ) : rows.map((row, index) => (
              <AdminReportResultRow key={`${reportType}-${row.id || index}-${row.created_at || index}`} type={reportType} row={row} />
            ))}
          </AdminReportSection>

          <AdminReportSection title="Queue pressure">
            <div className="space-y-2">
              {ADMIN_QUEUE_TABS.slice(0, 4).map(tab => (
                <AdminQueuePressureRow
                  key={tab.key}
                  tab={tab}
                  total={Number(queues[tab.key]?.total || 0)}
                  max={Math.max(1, ...ADMIN_QUEUE_TABS.map(item => Number(queues[item.key]?.total || 0)))}
                  onOpen={() => openQueue(tab.key)}
                />
              ))}
            </div>
          </AdminReportSection>
        </>
      )}
    </div>
  );
}

function AdminReportTypeTabs({ active, setActive }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2">
        {ADMIN_REPORT_TYPES.map(item => {
          const selected = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActive(item.key)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
                selected
                  ? 'border-cyan-200/45 bg-cyan-300/15 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.14)]'
                  : 'border-white/[0.08] bg-white/[0.045] text-slate-400 active:bg-white/[0.08]'
              }`}
            >
              <Icon name={item.icon} size={15} />
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AdminReportRangeControls({
  range,
  setRange,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  loading,
  onRefresh,
}) {
  return (
    <ProfileCard tone="slate">
      <div className="grid grid-cols-5 gap-1.5">
        {ADMIN_REPORT_RANGES.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setRange(item.key)}
            className={`min-h-9 rounded-xl border px-2 text-[11px] font-black ${
              range === item.key
                ? 'border-cyan-200/45 bg-cyan-300/15 text-cyan-100'
                : 'border-white/[0.08] bg-black/20 text-slate-400 active:bg-white/[0.07]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {range === 'custom' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Start">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="field-input" />
          </Field>
          <Field label="End">
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="field-input" />
          </Field>
        </div>
      )}

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200 disabled:opacity-50"
      >
        <Icon name="barChart" size={17} />
        {loading ? 'Loading report...' : 'Apply report filter'}
      </button>
    </ProfileCard>
  );
}

function AdminTrendBars({ rows, type }) {
  const max = Math.max(1, ...rows.map(row => Number(adminTrendValue(row, type))));

  return (
    <div className="grid grid-cols-6 items-end gap-2">
      {rows.slice(-12).map(row => {
        const value = Number(adminTrendValue(row, type));
        const height = `${Math.max(10, Math.min(100, (value / max) * 100))}%`;
        return (
          <div key={`${row.label}-${row.period_start}`} className="grid min-h-[132px] min-w-0 grid-rows-[1fr_auto] gap-2">
            <div className="flex items-end rounded-xl border border-white/[0.08] bg-black/20 p-1.5">
              <div className={`w-full rounded-lg ${adminToneStripe(adminReportConfig(type).tone)}`} style={{ height }} />
            </div>
            <div className="min-w-0 text-center">
              <p className="truncate text-[10px] font-black text-white">{adminTrendLabel(value, type)}</p>
              <p className="truncate text-[9px] text-slate-500">{shortReportLabel(row.label)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdminReportResultRow({ type, row }) {
  if (type === 'payments') {
    return (
      <AdminReportRow
        icon="creditCard"
        tone={adminPaymentTone(row.status)}
        title={`${formatMoney(row.amount)} ETB`}
        subtitle={`${row.address || 'Parking'} / ${row.reference || row.confirmation_code || 'No reference'}`}
        value={formatStatusLabel(row.status)}
      />
    );
  }
  if (type === 'bookings') {
    return (
      <AdminReportRow
        icon="calendar"
        tone={bookingStatusTone(row.status)}
        title={row.confirmation_code || row.address || `Booking #${row.id}`}
        subtitle={`${row.address || 'Parking'} / ${formatDate(row.start_time)} ${formatTime(row.start_time)}`}
        value={`${formatMoney(row.total_price)} ETB`}
      />
    );
  }
  if (type === 'marketplace') {
    return (
      <AdminReportRow
        icon="parking"
        tone={adminSpotTone(row.status)}
        title={row.address || `Spot #${row.id}`}
        subtitle={row.owner_name || 'Host listing'}
        value={formatStatusLabel(row.status)}
      />
    );
  }
  if (type === 'support') {
    return (
      <AdminReportRow
        icon={row.kind === 'dispute' ? 'shield' : 'fileText'}
        tone={row.kind === 'dispute' ? adminDisputeTone(row.status) : supportStatusTone(row.status)}
        title={row.title || `${formatStatusLabel(row.kind)} #${row.id}`}
        subtitle={formatStatusLabel(row.kind || row.label)}
        value={formatStatusLabel(row.status || row.label)}
      />
    );
  }
  if (type === 'users') {
    return (
      <AdminReportRow
        icon="user"
        tone={row.is_banned ? 'rose' : row.role === 'admin' ? 'violet' : 'cyan'}
        title={row.name || row.username || `User #${row.id}`}
        subtitle={row.username ? `@${row.username}` : `Telegram ID ${row.telegram_id || '-'}`}
        value={row.is_banned ? 'Banned' : formatStatusLabel(row.role)}
      />
    );
  }
  return (
    <AdminReportRow
      icon="receipt"
      tone={row.status === 'sent' ? 'emerald' : row.status === 'cancelled' ? 'rose' : 'amber'}
      title={`${formatMoney(row.amount)} ETB`}
      subtitle={row.host_name || `Host #${row.host_id}`}
      value={formatStatusLabel(row.status)}
    />
  );
}

function AdminReportRow({ icon, tone, title, subtitle, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
      <ToneIcon icon={icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-bold text-white">{title}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{subtitle}</p>
          </div>
          <StatusPill tone={tone} label={value} />
        </div>
      </div>
    </div>
  );
}

function AdminActionHub({ overview, queues, openQueue, onRefresh }) {
  const scenarios = [
    { key: 'pending_spots', label: 'Listing review', icon: 'parking', tone: 'amber', count: queues.pending_spots?.total, detail: 'host submissions' },
    { key: 'open_tickets', label: 'Support desk', icon: 'fileText', tone: 'cyan', count: queues.open_tickets?.total, detail: 'user tickets' },
    { key: 'open_disputes', label: 'Dispute desk', icon: 'shield', tone: 'rose', count: queues.open_disputes?.total, detail: 'open cases' },
    { key: 'payment_review', label: 'Payment review', icon: 'creditCard', tone: 'emerald', count: queues.payment_review?.total, detail: 'finance checks' },
    { key: 'recent_bookings', label: 'Booking control', icon: 'calendar', tone: 'violet', count: queues.recent_bookings?.total, detail: 'reservations' },
    { key: 'host_balances', label: 'Payouts', icon: 'receipt', tone: 'emerald', count: queues.host_balances?.total, detail: `${formatMoney(overview.pending_payouts)} ETB pending` },
    { key: 'recent_users', label: 'Account access', icon: 'user', tone: 'cyan', count: queues.recent_users?.total, detail: 'roles and bans' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {scenarios.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => openQueue(item.key)}
            className={`min-h-[118px] rounded-2xl border bg-white/[0.045] p-3 text-left shadow-[0_16px_42px_rgba(0,0,0,0.18)] active:bg-white/[0.07] ${profileToneBorder(item.tone)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <ToneIcon icon={item.icon} tone={item.tone} />
              <span className="rounded-full border border-white/[0.08] bg-black/25 px-2 py-0.5 text-[10px] font-black text-slate-300">
                {Number(item.count || 0)}
              </span>
            </div>
            <p className="mt-3 truncate text-sm font-black text-white">{item.label}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{item.detail}</p>
          </button>
        ))}
      </div>

      <ProfileCard tone="slate">
        <div className="flex items-start gap-3">
          <ToneIcon icon="barChart" tone="cyan" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Workspace health</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <InfoPill icon="calendar" text={`${Number(overview.total_bookings || 0)} bookings`} />
              <InfoPill icon="parking" text={`${Number(overview.active_spots || 0)} active spots`} />
              <InfoPill icon="creditCard" text={`${formatMoney(overview.total_revenue)} ETB`} />
              <InfoPill icon="receipt" text={`${formatMoney(overview.pending_payouts)} ETB due`} />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 py-3 text-sm font-black text-cyan-100 active:bg-cyan-300/15"
        >
          <Icon name="refreshCw" size={16} />
          Refresh all queues
        </button>
      </ProfileCard>
    </div>
  );
}

function AdminReportSection({ title, actionLabel, onAction, children }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.18)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {actionLabel && (
          <button type="button" onClick={onAction} className="text-xs font-black text-cyan-200 active:text-cyan-100">
            {actionLabel}
          </button>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function AdminReportMetric({ label, value, icon, tone }) {
  return (
    <div className={`rounded-2xl border bg-white/[0.045] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.16)] ${profileToneBorder(tone)}`}>
      <div className="flex items-center justify-between gap-2">
        <ToneIcon icon={icon} tone={tone} />
        <p className="truncate text-xl font-black text-white">{value ?? 0}</p>
      </div>
      <p className="mt-3 truncate text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function AdminQueuePressureRow({ tab, total, max, onOpen }) {
  const width = `${Math.max(5, Math.min(100, (Number(total || 0) / max) * 100))}%`;
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-xl border border-white/[0.08] bg-black/20 p-3 text-left active:bg-white/[0.06]">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-white">
          <Icon name={tab.icon} size={15} className={adminToneText(tab.tone)} />
          <span className="truncate">{tab.label}</span>
        </span>
        <span className="text-xs font-black text-slate-300">{total}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${adminToneStripe(tab.tone)}`} style={{ width }} />
      </div>
    </button>
  );
}

function AdminBarRow({ label, value, rawValue, max, tone }) {
  const numeric = Number(rawValue ?? value ?? 0);
  const width = `${Math.max(5, Math.min(100, (numeric / Math.max(1, max)) * 100))}%`;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-bold text-white">{label}</p>
        <p className="flex-none text-xs font-black text-slate-300">{value ?? 0}</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${adminToneStripe(tone)}`} style={{ width }} />
      </div>
    </div>
  );
}

function AdminMutedLine({ text }) {
  return <div className="rounded-xl border border-dashed border-white/[0.10] bg-black/20 px-4 py-5 text-center text-xs leading-5 text-slate-500">{text}</div>;
}

function AdminWorkspaceHeader({ queues, loading, onRefresh }) {
  const openWork = Number(queues.pending_spots?.total || 0)
    + Number(queues.open_tickets?.total || 0)
    + Number(queues.open_disputes?.total || 0)
    + Number(queues.payment_review?.total || 0);

  return (
    <div className="admin-hero overflow-hidden rounded-[30px] border border-cyan-200/15 bg-[#050910]/90 shadow-[0_28px_80px_rgba(0,0,0,0.52)]">
      <div className="relative p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-cyan-200/15 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">
            Live ops
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100 shadow-[0_0_22px_rgba(34,211,238,0.12)] active:bg-cyan-300/10 disabled:opacity-50"
            aria-label="Refresh workspace"
          >
            <Icon name="refreshCw" size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="admin-core mx-auto mt-4">
          <div className="admin-core__halo" />
          <div className="admin-core__coin">
            <Icon name="shield" size={46} />
          </div>
          <div className="admin-core__chip admin-core__chip--left">
            <span>{Number(queues.open_tickets?.total || 0)}</span>
            <small>Tickets</small>
          </div>
          <div className="admin-core__chip admin-core__chip--right">
            <span>{Number(queues.payment_review?.total || 0)}</span>
            <small>Pay</small>
          </div>
        </div>

        <div className="mt-4 text-center">
          <h3 className="text-4xl font-black leading-none text-white text-glow-cyan">{openWork}</h3>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.22em] text-cyan-100/75">Open tasks</p>
          <p className="mx-auto mt-2 max-w-[18rem] text-xs leading-5 text-slate-400">Approve listings, resolve support, review payouts, and protect the marketplace.</p>
        </div>
      </div>
    </div>
  );
}

function AdminQueueTabs({ queues, activeQueue, setActiveQueue }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1">
      <div className="flex min-w-max gap-2">
        {ADMIN_QUEUE_TABS.map(tab => {
          const isActive = activeQueue === tab.key;
          const total = Number(queues[tab.key]?.total || 0);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveQueue(tab.key)}
              className={`min-w-[102px] rounded-[20px] border px-3 py-3 text-left transition ${
                isActive
                  ? 'border-cyan-200/45 bg-cyan-300/15 text-white shadow-[0_0_28px_rgba(34,211,238,0.18)]'
                  : 'border-white/[0.08] bg-white/[0.04] text-slate-300 active:bg-white/[0.07]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <Icon name={tab.icon} size={18} className={isActive ? 'text-cyan-300' : 'text-slate-500'} />
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${isActive ? 'bg-cyan-200 text-slate-950' : 'bg-white/[0.07] text-slate-400'}`}>
                  {total}
                </span>
              </div>
              <span className="mt-2 block text-xs font-black">{tab.label}</span>
              <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">{tab.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AdminQueueContent({ queueKey, queue, action, handlers, loading, onLoadMore, onReload }) {
  const items = queue?.items || [];
  const tab = ADMIN_QUEUE_TABS.find(item => item.key === queueKey);
  if (items.length === 0) {
    return (
      <>
        {loading ? (
          <LoadingRows />
        ) : (
          <EmptyPanel
            icon={tab?.icon || 'shield'}
            title={`No ${String(tab?.label || 'items').toLowerCase()} queued`}
            text="New admin work appears here as drivers and hosts use ParkAddis."
          >
            <button onClick={onReload} className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200">
              Refresh queue
            </button>
          </EmptyPanel>
        )}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.045] px-4 py-3 shadow-[0_16px_42px_rgba(0,0,0,0.18)]">
        <div>
          <p className="text-sm font-black text-white">{tab?.label || 'Queue'}</p>
          <p className="mt-0.5 text-xs text-slate-500">{items.length} visible of {Number(queue?.total || items.length)} total</p>
        </div>
        <StatusPill tone={tab?.tone || 'slate'} label={tab?.action || 'Manage'} />
      </div>
      {items.map(item => {
        if (queueKey === 'pending_spots') {
          return <AdminSpotCard key={item.id} spot={item} action={action} handlers={handlers} />;
        }
        if (queueKey === 'open_tickets') {
          return <AdminTicketCard key={item.id} ticket={item} action={action} handlers={handlers} />;
        }
        if (queueKey === 'open_disputes') {
          return <AdminDisputeCard key={item.id} dispute={item} action={action} handlers={handlers} />;
        }
        if (queueKey === 'payment_review') {
          return <AdminPaymentCard key={item.id} payment={item} action={action} handlers={handlers} />;
        }
        if (queueKey === 'recent_bookings') {
          return <AdminBookingCard key={item.id} booking={item} action={action} handlers={handlers} />;
        }
        if (queueKey === 'host_balances') {
          return <AdminBalanceCard key={item.host_id} balance={item} action={action} handlers={handlers} />;
        }
        return <AdminUserCard key={item.id} user={item} action={action} handlers={handlers} />;
      })}
      <AdminQueueFooter queue={queue} loading={loading} onLoadMore={onLoadMore} onReload={onReload} />
    </div>
  );
}

function AdminQueueFooter({ queue, loading, onLoadMore, onReload }) {
  const items = queue?.items || [];
  const total = Number(queue?.total || items.length);
  const hasMore = adminQueueHasMore(queue);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-500">{items.length} of {total} loaded</span>
        <button type="button" onClick={onReload} disabled={loading} className="font-black text-cyan-200 active:text-cyan-100 disabled:opacity-50">
          Reload
        </button>
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 py-3 text-sm font-black text-cyan-100 active:bg-cyan-300/15 disabled:opacity-50"
        >
          <Icon name="plus" size={16} />
          {loading ? 'Loading...' : 'Load more'}
        </button>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-black/20 py-3 text-center text-xs font-semibold text-slate-500">
          All visible items loaded
        </div>
      )}
    </div>
  );
}

function AdminSpotCard({ spot, action, handlers }) {
  const tone = adminSpotTone(spot.status);
  return (
    <AdminOpsCard
      icon="parking"
      tone={tone}
      eyebrow={`Spot #${spot.id}`}
      title={spot.address || `Spot #${spot.id}`}
      subtitle={spot.owner_name || `Host #${spot.owner_id || '-'}`}
      status={formatStatusLabel(spot.status)}
      meta={[
        ['creditCard', `${formatMoney(spot.price_per_hour)} ETB/hr`],
        ['parking', `${spot.available_spaces ?? spot.capacity} of ${spot.capacity} available`],
      ]}
      onOpen={() => handlers.openOperation('spot', spot)}
    >
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3">
        {spot.status === 'pending_approval' && (
          <>
            <AdminActionButton icon="check" label="Approve" disabled={!!action} loading={action === `spot:approve:${spot.id}`} onClick={() => handlers.approveSpot(spot)} tone="emerald" />
            <AdminActionButton icon="x" label="Reject" disabled={!!action} loading={action === `spot:reject:${spot.id}`} onClick={() => handlers.rejectSpot(spot)} tone="rose" />
          </>
        )}
        {spot.status === 'active' && (
          <AdminActionButton icon="x" label="Suspend" disabled={!!action} loading={action === `spot:suspend:${spot.id}`} onClick={() => handlers.suspendSpot(spot)} tone="amber" />
        )}
        {['suspended', 'rejected'].includes(spot.status) && (
          <AdminActionButton icon="check" label="Reactivate" disabled={!!action} loading={action === `spot:reactivate:${spot.id}`} onClick={() => handlers.reactivateSpot(spot)} tone="emerald" />
        )}
      </div>
    </AdminOpsCard>
  );
}

function AdminTicketCard({ ticket, action, handlers }) {
  const tone = supportStatusTone(ticket.status);
  return (
    <AdminOpsCard
      icon="fileText"
      tone={tone}
      eyebrow={`Ticket #${ticket.id}`}
      title={ticket.user_name || `User #${ticket.user_id}`}
      subtitle={formatStatusLabel(ticket.category)}
      status={supportStatusLabel(ticket.status)}
      meta={[
        ['calendar', formatDate(ticket.updated_at || ticket.created_at)],
        ['fileText', `${Number(ticket.reply_count || 0)} replies`],
      ]}
      onOpen={() => handlers.openTicket(ticket)}
    >
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-300">{ticket.description}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3">
        <AdminActionButton icon="fileText" label="Open" disabled={!!action} loading={action === `ticket:open:${ticket.id}`} onClick={() => handlers.openTicket(ticket)} tone="cyan" />
        {ticket.status === 'open' && (
          <AdminActionButton icon="clock" label="Start" disabled={!!action} loading={action === `ticket:status:${ticket.id}:in_progress`} onClick={() => handlers.ticketStatus(ticket, 'in_progress')} />
        )}
        {ticket.status !== 'resolved' && (
          <AdminActionButton icon="checkCircle" label="Resolve" disabled={!!action} loading={action === `ticket:status:${ticket.id}:resolved`} onClick={() => handlers.ticketStatus(ticket, 'resolved')} tone="emerald" />
        )}
      </div>
    </AdminOpsCard>
  );
}

function AdminDisputeCard({ dispute, action, handlers }) {
  const tone = adminDisputeTone(dispute.status);
  return (
    <AdminOpsCard
      icon="shield"
      tone={tone}
      eyebrow={`Dispute #${dispute.id}`}
      title={dispute.address || `Booking #${dispute.booking_id}`}
      subtitle={dispute.raised_by_name || `User #${dispute.raised_by || '-'}`}
      status={formatStatusLabel(dispute.status)}
      meta={[
        ['receipt', dispute.confirmation_code || 'No code'],
        ['calendar', formatDate(dispute.created_at)],
      ]}
      onOpen={() => handlers.openOperation('dispute', dispute)}
    >
      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-300">{dispute.reason}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3">
        {dispute.status === 'open' ? (
          <>
            <AdminActionButton icon="checkCircle" label="Resolve" disabled={!!action} loading={action === `dispute:resolve:${dispute.id}`} onClick={() => handlers.resolveDispute(dispute)} tone="emerald" />
            <AdminActionButton icon="x" label="Reject" disabled={!!action} loading={action === `dispute:reject:${dispute.id}`} onClick={() => handlers.rejectDispute(dispute)} tone="rose" />
          </>
        ) : (
          <p className="text-xs leading-5 text-slate-400">{dispute.resolution || 'No further action available'}</p>
        )}
      </div>
    </AdminOpsCard>
  );
}

function AdminPaymentCard({ payment, action, handlers }) {
  const tone = adminPaymentTone(payment.status);
  const reference = payment.reference || payment.confirmation_code || 'No reference';
  const subtitle = payment.address || `Booking #${payment.booking_id || '-'}`;

  return (
    <div className={`admin-ops-card overflow-hidden rounded-[24px] border bg-white/[0.045] shadow-[0_18px_48px_rgba(0,0,0,0.25)] ${adminToneBorder(tone)}`}>
      <div className={`h-px ${adminToneStripe(tone)}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <ToneIcon icon="creditCard" tone={tone} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Payment review</p>
              <p className="mt-1 truncate text-xl font-black text-white">{formatMoney(payment.amount)} ETB</p>
              <p className="mt-1 truncate text-xs leading-5 text-slate-400">{subtitle}</p>
            </div>
          </div>
          <StatusPill tone={tone} label={formatStatusLabel(payment.status)} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <InfoPill icon="receipt" text={reference} />
          <InfoPill icon="creditCard" text={formatStatusLabel(payment.method || 'payment')} />
          <InfoPill icon="calendar" text={formatDate(payment.created_at)} />
          <InfoPill icon="user" text={payment.driver_name || 'Driver'} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3">
          <AdminActionButton icon="fileText" label="Details" disabled={!!action} loading={action === `payment:open:${payment.id}`} onClick={() => handlers.openPayment(payment)} tone="cyan" />
          {payment.status === 'paid' ? (
            <AdminActionButton icon="x" label="Refund" disabled={!!action} loading={action === `payment:refund:${payment.id}`} onClick={() => handlers.refundPayment(payment)} tone="rose" />
          ) : (
            <div className="flex min-h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-black/20 px-3 text-center text-xs font-semibold leading-4 text-slate-500">
              Review only
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminBookingCard({ booking, action, handlers }) {
  const canCancel = !['cancelled', 'completed', 'expired'].includes(booking.status);
  const tone = bookingStatusTone(booking.status);
  return (
    <AdminOpsCard
      icon="calendar"
      tone={tone}
      eyebrow={`Booking #${booking.id}`}
      title={booking.address || `Booking #${booking.id}`}
      subtitle={booking.driver_name || `Driver #${booking.driver_id || '-'}`}
      status={formatStatusLabel(booking.status)}
      meta={[
        ['calendar', formatDate(booking.start_time)],
        ['clock', `${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`],
        ['receipt', booking.confirmation_code || 'No code'],
        ['creditCard', `${formatMoney(booking.total_price)} ETB`],
      ]}
      onOpen={() => handlers.openOperation('booking', booking)}
    >
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3">
        {canCancel ? (
          <>
            <AdminActionButton icon="fileText" label="Details" disabled={!!action} onClick={() => handlers.openOperation('booking', booking)} tone="cyan" />
            <AdminActionButton icon="x" label="Cancel" disabled={!!action} loading={action === `booking:cancel:${booking.id}`} onClick={() => handlers.cancelBooking(booking)} tone="rose" />
          </>
        ) : (
          <AdminActionButton icon="fileText" label="Details" disabled={!!action} onClick={() => handlers.openOperation('booking', booking)} tone="cyan" />
        )}
      </div>
    </AdminOpsCard>
  );
}

function AdminBalanceCard({ balance, action, handlers }) {
  return (
    <AdminOpsCard
      icon="receipt"
      tone="emerald"
      eyebrow={`Host #${balance.host_id}`}
      title={balance.host_name || `Host #${balance.host_id}`}
      subtitle={`Telegram ID ${balance.owner_telegram_id || '-'}`}
      status={`${formatMoney(balance.balance)} ETB due`}
      meta={[
        ['creditCard', `${formatMoney(balance.total_earned)} earned`],
        ['receipt', `${formatMoney(balance.total_paid)} paid`],
      ]}
      onOpen={() => handlers.openOperation('balance', balance)}
    >
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3">
        <AdminActionButton icon="fileText" label="Details" disabled={!!action} onClick={() => handlers.openOperation('balance', balance)} tone="cyan" />
        <AdminActionButton icon="check" label="Payout" disabled={!!action} loading={action === `payout:create:${balance.host_id}`} onClick={() => handlers.createPayout(balance)} tone="emerald" />
      </div>
    </AdminOpsCard>
  );
}

function AdminUserCard({ user, action, handlers }) {
  const tone = user.is_banned ? 'rose' : user.role === 'admin' ? 'violet' : 'cyan';
  return (
    <AdminOpsCard
      icon="user"
      tone={tone}
      eyebrow={`User #${user.id}`}
      title={user.name || user.username || `User #${user.id}`}
      subtitle={user.username ? `@${user.username}` : `Telegram ID ${user.telegram_id || '-'}`}
      status={user.is_banned ? 'Banned' : formatStatusLabel(user.role)}
      meta={[
        ['shield', formatStatusLabel(user.role)],
        ['calendar', formatDate(user.created_at || user.updated_at)],
      ]}
      onOpen={() => handlers.openOperation('user', user)}
    >
      {user.ban_reason && <p className="mt-3 line-clamp-2 text-xs leading-5 text-rose-200">{user.ban_reason}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3">
        <AdminActionButton icon="shield" label="Role" disabled={!!action} loading={action === `user:role:${user.id}`} onClick={() => handlers.setUserRole(user)} />
        {user.is_banned ? (
          <AdminActionButton icon="check" label="Unban" disabled={!!action} loading={action === `user:unban:${user.id}`} onClick={() => handlers.unbanUser(user)} tone="emerald" />
        ) : (
          <AdminActionButton icon="x" label="Ban" disabled={!!action} loading={action === `user:ban:${user.id}`} onClick={() => handlers.banUser(user)} tone="rose" />
        )}
      </div>
    </AdminOpsCard>
  );
}

function AdminTicketSheet({ ticket, replyText, setReplyText, action, onClose, onReply, onStatus }) {
  return (
    <Sheet onClose={onClose}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Support ticket</p>
          <h3 className="mt-1 text-lg font-bold text-white">Ticket #{ticket.id}</h3>
          <p className="mt-1 truncate text-xs text-slate-400">{ticket.user_name || `User #${ticket.user_id}`}</p>
        </div>
        <IconButton icon="x" label="Close ticket" onClick={onClose} />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
        <div className="flex items-start justify-between gap-3">
          <StatusPill tone={supportStatusTone(ticket.status)} label={supportStatusLabel(ticket.status)} />
          <span className="text-xs capitalize text-slate-500">{ticket.category}</span>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-200">{ticket.description}</p>
        {ticket.admin_notes && <p className="mt-3 rounded-xl border border-white/[0.08] bg-black/25 p-3 text-xs leading-5 text-slate-400">{ticket.admin_notes}</p>}
      </div>

      <div className="mt-4 space-y-3">
        {(ticket.replies || []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.12] bg-black/20 px-4 py-6 text-center text-xs text-slate-500">
            No replies yet
          </div>
        ) : (
          ticket.replies.map(reply => (
            <div key={reply.id} className={`rounded-2xl border p-3 ${reply.is_from_admin ? 'border-cyan-300/25 bg-cyan-300/10' : 'border-white/[0.08] bg-white/[0.045]'}`}>
              <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
                <span>{reply.is_from_admin ? (reply.admin_name || 'Admin') : 'User'}</span>
                <span>{formatDateTimeShort(reply.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-200">{reply.message}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={onReply} className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
        <Field label="Reply">
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Write a clear update for the user."
            className="field-input resize-none leading-6"
          />
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {ticket.status !== 'resolved' && (
            <button
              type="button"
              onClick={() => onStatus('resolved')}
              disabled={!!action}
              className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 py-3 text-sm font-black text-emerald-100 active:bg-emerald-300/15 disabled:opacity-50"
            >
              Resolve
            </button>
          )}
          <button
            type="submit"
            disabled={!!action || replyText.trim().length < 2}
            className="rounded-xl bg-cyan-300 px-3 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200 disabled:opacity-50"
          >
            {action === `ticket:reply:${ticket.id}` ? 'Sending...' : 'Send reply'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function AdminPaymentSheet({ payment, action, onClose, onRefund }) {
  const isRefundable = payment.status === 'paid';
  const tone = adminPaymentTone(payment.status);

  return (
    <Sheet onClose={onClose}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment review</p>
          <h3 className="mt-1 text-lg font-bold text-white">Payment #{payment.id}</h3>
          <p className="mt-1 truncate text-xs text-slate-400">{payment.address || `Booking #${payment.booking_id || '-'}`}</p>
        </div>
        <IconButton icon="x" label="Close payment" onClick={onClose} />
      </div>

      <div className={`admin-ops-card overflow-hidden rounded-[24px] border bg-white/[0.045] shadow-[0_18px_48px_rgba(0,0,0,0.25)] ${adminToneBorder(tone)}`}>
        <div className={`h-px ${adminToneStripe(tone)}`} />
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</p>
              <p className="mt-1 text-2xl font-black text-white">{formatMoney(payment.amount)} ETB</p>
            </div>
            <StatusPill tone={tone} label={formatStatusLabel(payment.status)} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <InfoPill icon="receipt" text={payment.reference || payment.confirmation_code || 'No reference'} />
            <InfoPill icon="creditCard" text={formatStatusLabel(payment.method || 'payment')} />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <AdminDetailSection title="Booking">
          <AdminDetailRow label="Code" value={payment.confirmation_code || `#${payment.booking_id || '-'}`} />
          <AdminDetailRow label="Status" value={payment.booking_status ? formatStatusLabel(payment.booking_status) : '-'} />
          <AdminDetailRow label="Payment" value={payment.booking_payment_status ? formatStatusLabel(payment.booking_payment_status) : '-'} />
          <AdminDetailRow label="Time" value={`${formatDateTimeShort(payment.start_time) || '-'} to ${formatDateTimeShort(payment.end_time) || '-'}`} />
        </AdminDetailSection>

        <AdminDetailSection title="People and spot">
          <AdminDetailRow label="Spot" value={payment.address || `#${payment.spot_id || '-'}`} />
          <AdminDetailRow label="Driver" value={payment.driver_name || payment.driver_telegram_id || '-'} />
          <AdminDetailRow label="Host" value={payment.owner_name || payment.owner_telegram_id || '-'} />
        </AdminDetailSection>

        <AdminDetailSection title="Settlement">
          <AdminDetailRow label="Commission" value={`${formatMoney(payment.commission_amount)} ETB`} />
          <AdminDetailRow label="Host payout" value={`${formatMoney(payment.host_payout_amount)} ETB`} />
          <AdminDetailRow label="Created" value={formatDateTimeShort(payment.created_at) || '-'} />
          <AdminDetailRow label="Updated" value={formatDateTimeShort(payment.updated_at) || '-'} />
        </AdminDetailSection>
      </div>

      <div className="mt-4 border-t border-white/[0.08] pt-3">
        {isRefundable ? (
          <AdminActionButton
            icon="x"
            label="Refund payment"
            disabled={!!action}
            loading={action === `payment:refund:${payment.id}`}
            onClick={() => onRefund(payment)}
            tone="rose"
          />
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 py-3 text-center text-xs leading-5 text-slate-400">
            No refund action is available for this payment status.
          </div>
        )}
      </div>
    </Sheet>
  );
}

function AdminDecisionSheet({ decision, action, onClose }) {
  const initialValues = (decision.fields || []).reduce((values, field) => ({
    ...values,
    [field.name]: field.defaultValue ?? (field.type === 'checkbox' ? false : ''),
  }), {});
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState('');
  const busy = action === decision.actionKey;

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    for (const field of decision.fields || []) {
      if (field.required && !String(values[field.name] || '').trim()) {
        setError(`${field.label} is required`);
        return;
      }
    }

    const result = await decision.onSubmit(values);
    if (result) onClose();
  };

  return (
    <Sheet onClose={busy ? undefined : onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <ToneIcon icon={decision.icon || 'shield'} tone={decision.tone || 'cyan'} />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirm action</p>
              <h3 className="mt-1 text-lg font-bold text-white">{decision.title}</h3>
              {decision.subtitle && <p className="mt-1 truncate text-xs text-slate-400">{decision.subtitle}</p>}
            </div>
          </div>
          <IconButton icon="x" label="Close action" onClick={busy ? undefined : onClose} />
        </div>

        {(decision.fields || []).length > 0 && (
          <div className="space-y-3">
            {decision.fields.map(field => (
              <AdminDecisionField
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={(value) => handleChange(field.name, value)}
              />
            ))}
          </div>
        )}

        {error && <div className="mt-3 rounded-xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-sm text-rose-100">{error}</div>}

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/[0.08] pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-white/[0.08] bg-white/[0.045] py-3 text-sm font-black text-slate-300 active:bg-white/[0.08] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`rounded-xl py-3 text-sm font-black disabled:opacity-50 ${adminDecisionButtonClass(decision.tone)}`}
          >
            {busy ? 'Working...' : decision.submitLabel || 'Confirm'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function AdminDecisionField({ field, value, onChange }) {
  if (field.type === 'textarea') {
    return (
      <Field label={field.label}>
        <textarea
          value={value || ''}
          onChange={event => onChange(event.target.value)}
          rows={field.rows || 4}
          maxLength={field.maxLength || 1000}
          placeholder={field.placeholder}
          className="field-input resize-none leading-6"
        />
      </Field>
    );
  }

  if (field.type === 'select') {
    return (
      <Field label={field.label}>
        <select value={value || ''} onChange={event => onChange(event.target.value)} className="field-input">
          {(field.options || []).map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </Field>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
        <span className="text-sm font-bold text-slate-200">{field.label}</span>
        <input
          type="checkbox"
          checked={!!value}
          onChange={event => onChange(event.target.checked)}
          className="h-5 w-5 accent-cyan-300"
        />
      </label>
    );
  }

  return (
    <Field label={field.label}>
      <input
        type={field.type || 'text'}
        value={value || ''}
        onChange={event => onChange(event.target.value)}
        placeholder={field.placeholder}
        min={field.min}
        step={field.step}
        className="field-input"
      />
    </Field>
  );
}

function AdminOperationSheet({ detail, action, handlers, onClose }) {
  const { type, item } = detail || {};
  const titleMap = {
    spot: 'Listing review',
    dispute: 'Dispute detail',
    booking: 'Booking detail',
    balance: 'Payout detail',
    user: 'User detail',
  };
  const iconMap = {
    spot: 'parking',
    dispute: 'shield',
    booking: 'calendar',
    balance: 'receipt',
    user: 'user',
  };
  const toneMap = {
    spot: adminSpotTone(item?.status),
    dispute: adminDisputeTone(item?.status),
    booking: bookingStatusTone(item?.status),
    balance: 'emerald',
    user: item?.is_banned ? 'rose' : item?.role === 'admin' ? 'violet' : 'cyan',
  };
  const title = operationTitle(type, item);
  const subtitle = operationSubtitle(type, item);
  const tone = toneMap[type] || 'slate';

  return (
    <Sheet onClose={onClose}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <ToneIcon icon={iconMap[type] || 'shield'} tone={tone} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titleMap[type] || 'Operation detail'}</p>
            <h3 className="mt-1 truncate text-lg font-bold text-white">{title}</h3>
            <p className="mt-1 truncate text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <IconButton icon="x" label="Close operation" onClick={onClose} />
      </div>

      {type === 'spot' && <AdminSpotDetail spot={item} action={action} handlers={handlers} />}
      {type === 'dispute' && <AdminDisputeDetail dispute={item} action={action} handlers={handlers} />}
      {type === 'booking' && <AdminBookingDetail booking={item} action={action} handlers={handlers} />}
      {type === 'balance' && <AdminBalanceDetail balance={item} action={action} handlers={handlers} />}
      {type === 'user' && <AdminUserDetail user={item} action={action} handlers={handlers} />}
    </Sheet>
  );
}

function AdminSpotDetail({ spot, action, handlers }) {
  return (
    <div className="space-y-3">
      <AdminDetailSection title="Listing">
        <AdminDetailRow label="Status" value={formatStatusLabel(spot.status)} />
        <AdminDetailRow label="Address" value={spot.address || '-'} />
        <AdminDetailRow label="Host" value={spot.owner_name || `#${spot.owner_id || '-'}`} />
        <AdminDetailRow label="Price" value={`${formatMoney(spot.price_per_hour)} ETB/hr`} />
        <AdminDetailRow label="Capacity" value={`${spot.available_spaces ?? spot.capacity ?? 0} of ${spot.capacity ?? 0} available`} />
      </AdminDetailSection>
      {spot.rejection_reason && (
        <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm leading-6 text-rose-100">
          {spot.rejection_reason}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {spot.status === 'pending_approval' && (
          <>
            <AdminActionButton icon="check" label="Approve" disabled={!!action} loading={action === `spot:approve:${spot.id}`} onClick={() => handlers.approveSpot(spot)} tone="emerald" />
            <AdminActionButton icon="x" label="Reject" disabled={!!action} loading={action === `spot:reject:${spot.id}`} onClick={() => handlers.rejectSpot(spot)} tone="rose" />
          </>
        )}
        {spot.status === 'active' && (
          <AdminActionButton icon="x" label="Suspend" disabled={!!action} loading={action === `spot:suspend:${spot.id}`} onClick={() => handlers.suspendSpot(spot)} tone="amber" />
        )}
        {['suspended', 'rejected'].includes(spot.status) && (
          <AdminActionButton icon="check" label="Reactivate" disabled={!!action} loading={action === `spot:reactivate:${spot.id}`} onClick={() => handlers.reactivateSpot(spot)} tone="emerald" />
        )}
      </div>
    </div>
  );
}

function AdminDisputeDetail({ dispute, action, handlers }) {
  return (
    <div className="space-y-3">
      <AdminDetailSection title="Case">
        <AdminDetailRow label="Status" value={formatStatusLabel(dispute.status)} />
        <AdminDetailRow label="Booking" value={dispute.confirmation_code || `#${dispute.booking_id || '-'}`} />
        <AdminDetailRow label="Raised by" value={dispute.raised_by_name || `#${dispute.raised_by || '-'}`} />
        <AdminDetailRow label="Created" value={formatDateTimeShort(dispute.created_at) || '-'} />
      </AdminDetailSection>
      <AdminDetailSection title="Reason">
        <div className="py-2 text-sm leading-6 text-slate-200">{dispute.reason || 'No reason provided'}</div>
      </AdminDetailSection>
      {dispute.resolution && (
        <AdminDetailSection title="Resolution">
          <div className="py-2 text-sm leading-6 text-slate-200">{dispute.resolution}</div>
        </AdminDetailSection>
      )}
      {dispute.status === 'open' && (
        <div className="grid grid-cols-2 gap-2">
          <AdminActionButton icon="checkCircle" label="Resolve" disabled={!!action} loading={action === `dispute:resolve:${dispute.id}`} onClick={() => handlers.resolveDispute(dispute)} tone="emerald" />
          <AdminActionButton icon="x" label="Reject" disabled={!!action} loading={action === `dispute:reject:${dispute.id}`} onClick={() => handlers.rejectDispute(dispute)} tone="rose" />
        </div>
      )}
    </div>
  );
}

function AdminBookingDetail({ booking, action, handlers }) {
  const canCancel = !['cancelled', 'completed', 'expired'].includes(booking.status);
  return (
    <div className="space-y-3">
      <AdminDetailSection title="Booking">
        <AdminDetailRow label="Status" value={formatStatusLabel(booking.status)} />
        <AdminDetailRow label="Code" value={booking.confirmation_code || '-'} />
        <AdminDetailRow label="Driver" value={booking.driver_name || `#${booking.driver_id || '-'}`} />
        <AdminDetailRow label="Spot" value={booking.address || `#${booking.spot_id || '-'}`} />
        <AdminDetailRow label="Time" value={`${formatDateTimeShort(booking.start_time) || '-'} to ${formatDateTimeShort(booking.end_time) || '-'}`} />
      </AdminDetailSection>
      <AdminDetailSection title="Payment">
        <AdminDetailRow label="Amount" value={`${formatMoney(booking.total_price)} ETB`} />
        <AdminDetailRow label="Payment" value={booking.payment_status ? formatStatusLabel(booking.payment_status) : '-'} />
        <AdminDetailRow label="Created" value={formatDateTimeShort(booking.created_at) || '-'} />
      </AdminDetailSection>
      {canCancel ? (
        <AdminActionButton icon="x" label="Cancel booking" disabled={!!action} loading={action === `booking:cancel:${booking.id}`} onClick={() => handlers.cancelBooking(booking)} tone="rose" />
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 py-3 text-center text-xs leading-5 text-slate-400">
          No booking action is available for this status.
        </div>
      )}
    </div>
  );
}

function AdminBalanceDetail({ balance, action, handlers }) {
  return (
    <div className="space-y-3">
      <AdminDetailSection title="Host">
        <AdminDetailRow label="Name" value={balance.host_name || `Host #${balance.host_id}`} />
        <AdminDetailRow label="Telegram" value={balance.owner_telegram_id || '-'} />
      </AdminDetailSection>
      <AdminDetailSection title="Settlement">
        <AdminDetailRow label="Earned" value={`${formatMoney(balance.total_earned)} ETB`} />
        <AdminDetailRow label="Paid" value={`${formatMoney(balance.total_paid)} ETB`} />
        <AdminDetailRow label="Balance" value={`${formatMoney(balance.balance)} ETB`} />
      </AdminDetailSection>
      <AdminActionButton icon="check" label="Create payout" disabled={!!action} loading={action === `payout:create:${balance.host_id}`} onClick={() => handlers.createPayout(balance)} tone="emerald" />
    </div>
  );
}

function AdminUserDetail({ user, action, handlers }) {
  return (
    <div className="space-y-3">
      <AdminDetailSection title="Account">
        <AdminDetailRow label="Name" value={user.name || '-'} />
        <AdminDetailRow label="Username" value={user.username ? `@${user.username}` : '-'} />
        <AdminDetailRow label="Telegram" value={user.telegram_id || '-'} />
        <AdminDetailRow label="Role" value={formatStatusLabel(user.role)} />
        <AdminDetailRow label="Status" value={user.is_banned ? 'Banned' : 'Active'} />
      </AdminDetailSection>
      {user.ban_reason && (
        <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm leading-6 text-rose-100">
          {user.ban_reason}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <AdminActionButton icon="shield" label="Change role" disabled={!!action} loading={action === `user:role:${user.id}`} onClick={() => handlers.setUserRole(user)} />
        {user.is_banned ? (
          <AdminActionButton icon="check" label="Unban" disabled={!!action} loading={action === `user:unban:${user.id}`} onClick={() => handlers.unbanUser(user)} tone="emerald" />
        ) : (
          <AdminActionButton icon="x" label="Ban" disabled={!!action} loading={action === `user:ban:${user.id}`} onClick={() => handlers.banUser(user)} tone="rose" />
        )}
      </div>
    </div>
  );
}

function operationTitle(type, item = {}) {
  if (type === 'spot') return item.address || `Spot #${item.id || '-'}`;
  if (type === 'dispute') return item.address || item.confirmation_code || `Dispute #${item.id || '-'}`;
  if (type === 'booking') return item.confirmation_code || item.address || `Booking #${item.id || '-'}`;
  if (type === 'balance') return item.host_name || `Host #${item.host_id || '-'}`;
  if (type === 'user') return item.name || item.username || `User #${item.id || '-'}`;
  return 'Operation';
}

function operationSubtitle(type, item = {}) {
  if (type === 'spot') return `${item.owner_name || `Host #${item.owner_id || '-'}`} - ${formatStatusLabel(item.status)}`;
  if (type === 'dispute') return `${item.raised_by_name || `User #${item.raised_by || '-'}`} - ${formatStatusLabel(item.status)}`;
  if (type === 'booking') return `${item.driver_name || `Driver #${item.driver_id || '-'}`} - ${formatStatusLabel(item.status)}`;
  if (type === 'balance') return `${formatMoney(item.balance)} ETB due`;
  if (type === 'user') return item.username ? `@${item.username}` : `Telegram ID ${item.telegram_id || '-'}`;
  return 'Admin operation';
}

function AdminDetailSection({ title, children }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100/60">{title}</p>
      <div className="mt-3 divide-y divide-white/[0.08]">{children}</div>
    </div>
  );
}

function AdminDetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="max-w-[62%] text-right text-sm font-semibold leading-5 text-slate-200">{value}</span>
    </div>
  );
}

function AdminOpsCard({ icon, tone = 'slate', eyebrow, title, subtitle, status, meta = [], onOpen, children }) {
  return (
    <div className={`admin-ops-card overflow-hidden rounded-[24px] border bg-white/[0.045] shadow-[0_18px_48px_rgba(0,0,0,0.25)] ${adminToneBorder(tone)}`}>
      <div className={`h-px ${adminToneStripe(tone)}`} />
      <div className="p-4">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="flex min-w-0 items-start gap-3">
            <ToneIcon icon={icon} tone={tone} />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{eyebrow}</p>
              <p className="mt-1 truncate text-base font-black text-white">{title}</p>
              <p className="mt-1 truncate text-xs leading-5 text-slate-400">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-none flex-col items-end gap-2">
            <StatusPill tone={tone} label={status} />
            <Icon name="chevronRight" size={17} className="text-cyan-100/35" />
          </div>
        </button>
        {meta.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            {meta.map(([metaIcon, text], index) => (
              <InfoPill key={`${metaIcon}-${index}`} icon={metaIcon} text={text || '-'} />
            ))}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function AdminCard({ icon, tone, children }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
      <div className="flex items-start gap-3">
        <ToneIcon icon={icon} tone={tone} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

function AdminActions({ children }) {
  return <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.08] pt-3">{children}</div>;
}

function AdminActionButton({ icon, label, onClick, disabled, loading, tone = 'slate' }) {
  const styles = {
    slate: 'border-white/[0.08] bg-white/[0.06] text-slate-200 active:bg-white/[0.09]',
    cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.10)] active:bg-cyan-300/15',
    emerald: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100 active:bg-emerald-300/15',
    amber: 'border-amber-300/25 bg-amber-300/10 text-amber-100 active:bg-amber-300/15',
    rose: 'border-rose-300/25 bg-rose-300/10 text-rose-100 active:bg-rose-300/15',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black disabled:opacity-50 ${styles[tone] || styles.slate}`}
    >
      <Icon name={icon} size={16} />
      {loading ? 'Working...' : label}
    </button>
  );
}

const ADMIN_QUEUE_TABS = [
  { key: 'pending_spots', label: 'Spots', icon: 'parking', tone: 'amber', action: 'Review', hint: 'Approvals' },
  { key: 'open_tickets', label: 'Tickets', icon: 'fileText', tone: 'cyan', action: 'Support', hint: 'Replies' },
  { key: 'open_disputes', label: 'Disputes', icon: 'shield', tone: 'amber', action: 'Resolve', hint: 'Cases' },
  { key: 'payment_review', label: 'Payments', icon: 'creditCard', tone: 'emerald', action: 'Finance', hint: 'Refunds' },
  { key: 'recent_bookings', label: 'Bookings', icon: 'calendar', tone: 'violet', action: 'Manage', hint: 'Recent' },
  { key: 'host_balances', label: 'Payouts', icon: 'receipt', tone: 'emerald', action: 'Settle', hint: 'Balances' },
  { key: 'recent_users', label: 'Users', icon: 'user', tone: 'cyan', action: 'Accounts', hint: 'Access' },
];

const ADMIN_REPORT_TYPES = [
  { key: 'payments', label: 'Payments', icon: 'creditCard', tone: 'emerald' },
  { key: 'bookings', label: 'Bookings', icon: 'calendar', tone: 'violet' },
  { key: 'marketplace', label: 'Marketplace', icon: 'parking', tone: 'amber' },
  { key: 'support', label: 'Support', icon: 'fileText', tone: 'cyan' },
  { key: 'users', label: 'Users', icon: 'user', tone: 'cyan' },
  { key: 'finance', label: 'Finance', icon: 'receipt', tone: 'emerald' },
];

const ADMIN_REPORT_RANGES = [
  { key: 'today', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
];

const SUPPORT_TICKET_CATEGORIES = [
  { key: 'payment', label: 'Payment', icon: 'creditCard', tone: 'cyan', hint: 'Failed payment, refund, receipt, or double charge.' },
  { key: 'booking', label: 'Booking', icon: 'calendar', tone: 'emerald', hint: 'Reservation, confirmation code, cancellation, or check-in.' },
  { key: 'host', label: 'Host or spot', icon: 'parking', tone: 'amber', hint: 'Spot access, host unavailable, listing, payout, or availability.' },
  { key: 'feature', label: 'Feature request', icon: 'star', tone: 'violet', hint: 'Missing tool, improvement idea, or app feedback.' },
  { key: 'other', label: 'Other', icon: 'helpCircle', tone: 'slate', hint: 'Anything that does not fit the other categories.' },
];

function RecentTickets({ tickets, expanded, setExpanded }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.045] shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
      <button
        onClick={() => setExpanded(expanded === 'tickets' ? null : 'tickets')}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <ToneIcon icon="fileText" tone="emerald" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-white">Your recent tickets</span>
          <span className="mt-1 block text-xs text-slate-400">{tickets.length ? `${tickets.length} recent support request${tickets.length > 1 ? 's' : ''}` : 'No tickets sent yet'}</span>
        </span>
        <Icon name="chevronDown" size={18} className={`text-slate-500 transition-transform ${expanded === 'tickets' ? 'rotate-180' : ''}`} />
      </button>
      {expanded === 'tickets' && (
        <div className="border-t border-white/[0.08] p-4">
          {tickets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-cyan-200/20 bg-black/20 px-4 py-6 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                <Icon name="fileText" size={22} />
              </div>
              <p className="text-sm font-bold text-white">No tickets yet</p>
              <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-slate-400">When support needs to review an issue, send a ticket from this page.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(ticket => (
                <div key={ticket.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">Ticket #{ticket.id}</p>
                      <p className="mt-1 text-xs capitalize text-slate-400">{ticket.category?.replace(/_/g, ' ') || 'Support'}</p>
                    </div>
                    <StatusPill tone={supportStatusTone(ticket.status)} label={supportStatusLabel(ticket.status)} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-300">{ticket.description}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-2 text-[11px] text-slate-500">
                    <span>{formatDate(ticket.updated_at || ticket.created_at)}</span>
                    <span>{Number(ticket.reply_count || 0)} repl{Number(ticket.reply_count || 0) === 1 ? 'y' : 'ies'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function supportStatusTone(status) {
  if (status === 'resolved') return 'emerald';
  if (status === 'in_progress') return 'cyan';
  if (status === 'closed') return 'slate';
  return 'amber';
}

function supportStatusLabel(status) {
  const labels = {
    open: 'Open',
    in_progress: 'In progress',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return labels[status] || 'Open';
}

function helpIcon(key) {
  if (key.includes('payment')) return 'creditCard';
  if (key.includes('booking') || key.includes('checkin')) return 'calendar';
  if (key.includes('host') || key.includes('listing')) return 'parking';
  if (key.includes('find')) return 'mapPin';
  if (key.includes('faq')) return 'helpCircle';
  return 'fileText';
}

function helpTone(key) {
  if (key.includes('payment')) return 'cyan';
  if (key.includes('host') || key.includes('listing')) return 'emerald';
  if (key.includes('faq') || key.includes('contact')) return 'amber';
  return 'slate';
}

function plainHelpContent(content) {
  return String(content || '').replace(/\*/g, '').trim();
}

function HostCheckinPanel({ manualCode, setManualCode, action, onScan, onManualSubmit }) {
  return (
    <ProfileCard tone="cyan">
      <div className="flex items-start gap-3">
        <ToneIcon icon="qrCode" tone="cyan" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Driver check-in</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Scan the driver booking QR or enter the confirmation code from their booking.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        <button
          onClick={onScan}
          disabled={!!action}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200 disabled:opacity-50"
        >
          <Icon name="qrCode" size={18} />
          {action === 'scan' ? 'Confirming...' : 'Scan QR'}
        </button>
        <form onSubmit={onManualSubmit} className="grid grid-cols-[1fr_auto] gap-2">
          <input
            value={manualCode}
            onChange={e => setManualCode(e.target.value.toUpperCase())}
            placeholder="PK-7F3K9"
            autoComplete="off"
            className="field-input font-mono"
          />
          <button
            type="submit"
            disabled={!!action}
            className="flex min-h-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.06] px-4 text-sm font-black text-slate-200 active:bg-white/[0.09] disabled:opacity-50"
          >
            {action === 'manual' ? '...' : 'Confirm'}
          </button>
        </form>
      </div>
    </ProfileCard>
  );
}

function LastCheckin({ booking }) {
  return (
    <ProfileCard className="mt-3" tone="emerald">
      <div className="flex items-start gap-3">
        <ToneIcon icon="checkCircle" tone="emerald" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-bold text-white">Checked in</p>
            <StatusPill tone="emerald" label="Active" />
          </div>
          <p className="mt-1 truncate text-xs text-slate-300">{booking.driver_name || 'Driver'} at {booking.address || 'parking spot'}</p>
          <p className="mt-2 font-mono text-xs font-semibold text-emerald-300">{booking.confirmation_code}</p>
        </div>
      </div>
    </ProfileCard>
  );
}

function HostTabs({ active, setActive, canViewReports, ownsSpots }) {
  const tabs = [
    { key: 'spots', label: 'Ops', icon: 'parking', enabled: true },
    { key: 'reports', label: 'Reports', icon: 'barChart', enabled: canViewReports },
    { key: 'history', label: 'History', icon: 'fileText', enabled: true },
    { key: 'team', label: 'Team', icon: 'users', enabled: ownsSpots },
  ];

  return (
    <div className="-mx-4 mb-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => tab.enabled && setActive(tab.key)}
            disabled={!tab.enabled}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-black transition ${
              active === tab.key
                ? 'border-emerald-200/45 bg-emerald-300/15 text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.14)]'
                : 'border-white/[0.08] bg-white/[0.045] text-slate-400 active:bg-white/[0.08]'
            } disabled:opacity-40`}
          >
            <Icon name={tab.icon} size={15} />
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function HostReportPanel({
  report,
  loading,
  range,
  setRange,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  onRefresh,
  canViewReports,
}) {
  if (!canViewReports) {
    return <EmptyPanel icon="receipt" title="Reports unavailable" text="The owner has not enabled report access for this account." />;
  }

  const summary = report?.summary || {};
  const presets = report?.presets || {};
  const recent = report?.recent_bookings || [];
  const bySpot = report?.by_spot || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <ReportPreset label="Today" value={presets.today?.earnings} count={presets.today?.bookings} active={range === 'today'} onClick={() => setRange('today')} />
        <ReportPreset label="Week" value={presets.week?.earnings} count={presets.week?.bookings} active={range === 'week'} onClick={() => setRange('week')} />
        <ReportPreset label="Month" value={presets.month?.earnings} count={presets.month?.bookings} active={range === 'month'} onClick={() => setRange('month')} />
      </div>

      <ProfileCard tone="emerald">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected range</p>
            <p className="mt-1 text-2xl font-black text-white">{formatMoney(summary.host_earnings)} ETB</p>
            <p className="mt-1 text-xs text-slate-400">{Number(summary.paid_bookings || 0)} paid bookings</p>
          </div>
          <IconButton icon="refreshCw" label="Refresh report" onClick={onRefresh} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <InfoPill icon="creditCard" text={`${formatMoney(summary.gross_revenue)} gross`} />
          <InfoPill icon="receipt" text={`${formatMoney(summary.commission)} commission`} />
        </div>
      </ProfileCard>

      <ProfileCard tone="slate">
        <div className="grid grid-cols-2 gap-2">
          {['today', 'week', 'month', 'custom'].map(item => (
            <button
              key={item}
              onClick={() => setRange(item)}
              className={`rounded-xl border px-3 py-2.5 text-xs font-black capitalize ${
                range === item
                  ? 'border-cyan-200/45 bg-cyan-300/15 text-cyan-100'
                  : 'border-white/[0.08] bg-black/20 text-slate-300 active:bg-white/[0.07]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Start">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="field-input" />
            </Field>
            <Field label="End">
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="field-input" />
            </Field>
          </div>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200 disabled:opacity-50"
        >
          <Icon name="barChart" size={17} />
          {loading ? 'Loading...' : 'Apply report filter'}
        </button>
      </ProfileCard>

      {loading && !report ? <LoadingRows /> : (
        <>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">By spot</p>
            {bySpot.length === 0 ? (
              <EmptyPanel icon="parking" title="No paid bookings" text="Paid booking revenue will appear here." />
            ) : bySpot.slice(0, 5).map(row => (
              <ProfileCard key={row.id} tone="slate">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{row.address || 'Parking spot'}</p>
                    <p className="mt-1 text-xs text-slate-400">{row.paid_bookings} paid bookings</p>
                  </div>
                  <p className="text-sm font-black text-emerald-300">{formatMoney(row.host_earnings)} ETB</p>
                </div>
              </ProfileCard>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent paid bookings</p>
            {recent.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-sm text-slate-400">No paid booking history in this range.</div>
            ) : recent.map(booking => (
              <HostHistoryCard key={booking.id} booking={booking} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ReportPreset({ label, value, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`min-w-0 rounded-2xl border p-3 text-left ${
        active
          ? 'border-emerald-200/45 bg-emerald-300/15 shadow-[0_0_24px_rgba(52,211,153,0.14)]'
          : 'border-white/[0.08] bg-white/[0.045] active:bg-white/[0.08]'
      }`}
    >
      <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{formatMoney(value)} ETB</p>
      <p className="mt-1 text-[11px] text-slate-400">{Number(count || 0)} bookings</p>
    </button>
  );
}

function HostHistoryPanel({ bookings, total, loading, onRefresh }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booking history</p>
          <p className="mt-1 text-sm text-slate-400">{Number(total || 0)} bookings across accessible spots</p>
        </div>
        <IconButton icon="refreshCw" label="Refresh history" onClick={onRefresh} />
      </div>
      {loading ? (
        <LoadingRows />
      ) : bookings.length === 0 ? (
        <EmptyPanel icon="calendar" title="No booking history" text="Bookings for assigned spots will appear here." />
      ) : (
        bookings.map(booking => <HostHistoryCard key={booking.id} booking={booking} />)
      )}
    </div>
  );
}

function HostHistoryCard({ booking }) {
  const earned = booking.host_payout_amount ?? booking.total_price ?? booking.amount;
  return (
    <ProfileCard tone="slate">
      <div className="flex items-start gap-3">
        <ToneIcon icon="calendar" tone={bookingStatusTone(booking.status)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{booking.address || 'Parking spot'}</p>
              <p className="mt-1 font-mono text-xs font-semibold text-cyan-300">{booking.confirmation_code}</p>
            </div>
            <StatusPill tone={bookingStatusTone(booking.status)} label={booking.status || 'booking'} />
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <InfoPill icon="user" text={booking.driver_name || 'Driver'} />
            <InfoPill icon="clock" text={`${formatDate(booking.start_time)} ${formatTime(booking.start_time)}`} />
            <InfoPill icon="creditCard" text={booking.payment_status || booking.payment_record_status || 'unpaid'} />
            <InfoPill icon="receipt" text={`${formatMoney(earned)} ETB`} />
          </div>
        </div>
      </div>
    </ProfileCard>
  );
}

function HostTeamPanel({ spots, managers, loading, form, setForm, action, onSubmit, onRemove, ownsSpots }) {
  if (!ownsSpots) {
    return <EmptyPanel icon="users" title="Owner access required" text="Only the parking owner can assign or remove managers." />;
  }

  return (
    <div className="space-y-4">
      <ProfileCard tone="emerald">
        <div className="flex items-start gap-3">
          <ToneIcon icon="users" tone="emerald" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white">Assign a manager</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">The user must start the bot first. Use their Telegram username, such as @abel.</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          <Field label="Manager username">
            <input
              value={form.identifier}
              onChange={e => setForm(prev => ({ ...prev, identifier: e.target.value.trim() }))}
              placeholder="@username"
              autoCapitalize="none"
              autoComplete="off"
              className="field-input"
            />
          </Field>
          <Field label="Scope">
            <select value={form.spotId} onChange={e => setForm(prev => ({ ...prev, spotId: e.target.value }))} className="field-input">
              <option value="">All my spots</option>
              {spots.map(spot => (
                <option key={spot.id} value={spot.id}>{spot.address || `Spot ${spot.id}`}</option>
              ))}
            </select>
          </Field>
          <div className="grid gap-2">
            <ToggleLine label="Manage bookings" checked={form.canManageBookings} onChange={value => setForm(prev => ({ ...prev, canManageBookings: value }))} />
            <ToggleLine label="Pause or activate spots" checked={form.canManageSpots} onChange={value => setForm(prev => ({ ...prev, canManageSpots: value }))} />
            <ToggleLine label="View revenue reports" checked={form.canViewReports} onChange={value => setForm(prev => ({ ...prev, canViewReports: value }))} />
          </div>
          <button
            type="submit"
            disabled={!!action}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(110,231,183,0.28)] active:bg-emerald-200 disabled:opacity-50"
          >
            <Icon name="plus" size={17} />
            {action === 'assign' ? 'Assigning...' : 'Assign manager'}
          </button>
        </form>
      </ProfileCard>

      {loading ? (
        <LoadingRows />
      ) : managers.length === 0 ? (
        <EmptyPanel icon="users" title="No managers assigned" text="Assigned users will appear here with their scope and permissions." />
      ) : (
        <div className="space-y-3">
          {managers.map(manager => (
            <ProfileCard key={manager.id} tone={manager.is_active ? 'slate' : 'rose'}>
              <div className="flex items-start gap-3">
                <ToneIcon icon="user" tone={manager.is_active ? 'cyan' : 'rose'} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{manager.manager_name || manager.manager_username || manager.manager_telegram_id}</p>
                      <p className="mt-1 text-xs text-slate-400">{manager.spot_address || 'All spots'}</p>
                    </div>
                    <StatusPill tone={manager.is_active ? 'emerald' : 'rose'} label={manager.is_active ? 'Active' : 'Off'} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                    {manager.can_manage_bookings && <SmallTag label="Bookings" />}
                    {manager.can_manage_spots && <SmallTag label="Spots" />}
                    {manager.can_view_reports && <SmallTag label="Reports" />}
                  </div>
                </div>
              </div>
              {manager.is_active && (
                <div className="mt-4 border-t border-white/[0.08] pt-3">
                  <button
                    onClick={() => onRemove(manager.id)}
                    disabled={!!action}
                    className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-300/10 py-2.5 text-sm font-black text-rose-100 active:bg-rose-300/15 disabled:opacity-50"
                  >
                    <Icon name="trash" size={16} />
                    {action === `remove:${manager.id}` ? 'Removing...' : 'Remove access'}
                  </button>
                </div>
              )}
            </ProfileCard>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleLine({ label, checked, onChange }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5">
      <span className="text-sm font-bold text-slate-200">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-5 w-5 accent-emerald-300"
      />
    </label>
  );
}

function SmallTag({ label }) {
  return (
    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 font-bold text-cyan-100">{label}</span>
  );
}

function HostBookingsSheet({ spot, bookings, loading, action, onClose, onRefresh, onCheckin, onComplete }) {
  return (
    <Sheet onClose={onClose}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Host bookings</p>
          <h3 className="mt-1 truncate text-lg font-bold text-white">{spot.address || 'Parking spot'}</h3>
          <p className="mt-1 text-xs text-slate-400">Upcoming and active reservations for this listing.</p>
        </div>
        <IconButton icon="x" label="Close bookings" onClick={onClose} />
      </div>

      <button
        onClick={onRefresh}
        disabled={loading}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 py-2.5 text-sm font-black text-cyan-100 active:bg-cyan-300/15 disabled:opacity-50"
      >
        <Icon name="refreshCw" size={16} />
        {loading ? 'Refreshing...' : 'Refresh bookings'}
      </button>

      {loading ? (
        <LoadingRows />
      ) : bookings.length === 0 ? (
        <EmptyPanel icon="calendar" title="No active bookings" text="Paid and upcoming bookings for this spot will appear here." />
      ) : (
        <div className="space-y-3">
          {bookings.map(booking => (
            <HostBookingCard
              key={booking.id}
              booking={booking}
              action={action}
              onCheckin={() => onCheckin(booking)}
              onComplete={() => onComplete(booking)}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}

function HostBookingCard({ booking, action, onCheckin, onComplete }) {
  const canCheckin = ['reserved', 'confirmed'].includes(booking.status);
  const canComplete = booking.status === 'active';
  const actionKey = canCheckin ? `checkin:${booking.id}` : `complete:${booking.id}`;
  const isBusy = action === actionKey;

  return (
    <ProfileCard tone="slate">
      <div className="flex items-start gap-3">
        <ToneIcon icon="user" tone="slate" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{booking.driver_name || 'Driver'}</p>
              <p className="mt-1 font-mono text-xs font-semibold text-cyan-300">{booking.confirmation_code}</p>
            </div>
            <StatusPill tone={bookingStatusTone(booking.status)} label={booking.status || 'reserved'} />
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <InfoPill icon="calendar" text={formatDate(booking.start_time)} />
            <InfoPill icon="clock" text={`${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}`} />
            <InfoPill icon="creditCard" text={booking.payment_status || 'unpaid'} />
            <InfoPill icon="receipt" text={`${formatMoney(booking.total_price)} ETB`} />
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-white/[0.08] pt-3">
        {canCheckin && (
          <button
            onClick={onCheckin}
            disabled={!!action}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-3 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(110,231,183,0.28)] active:bg-emerald-200 disabled:opacity-50"
          >
            <Icon name="checkCircle" size={17} />
            {isBusy ? 'Confirming...' : 'Confirm arrival'}
          </button>
        )}
        {canComplete && (
          <button
            onClick={onComplete}
            disabled={!!action}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200 disabled:opacity-50"
          >
            <Icon name="check" size={17} />
            {isBusy ? 'Completing...' : 'Mark complete'}
          </button>
        )}
        {!canCheckin && !canComplete && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.045] py-3 text-center text-sm font-semibold text-slate-500">
            No host action available
          </div>
        )}
      </div>
    </ProfileCard>
  );
}

function Sheet({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm" onClick={onClose}>
      <div className="profile-sheet max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[30px] border-t border-cyan-200/15 bg-[#060a12] p-5 shadow-[0_-28px_80px_rgba(0,0,0,0.62)]" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function SectionFrame({ title, subtitle, onBack, children }) {
  return (
    <div>
      <div className="mb-5 flex items-start gap-3">
        <button
          onClick={onBack}
          aria-label="Back"
          className="mt-1 flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045] text-cyan-100/75 shadow-[0_0_18px_rgba(34,211,238,0.08)] active:bg-white/[0.08] active:text-white"
        >
          <Icon name="arrowLeft" size={19} />
        </button>
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ProfileCard({ children, tone = 'slate', className = '' }) {
  return (
    <div className={`profile-glass-card rounded-2xl border bg-white/[0.045] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.24)] ${profileToneBorder(tone)} ${className}`}>
      {children}
    </div>
  );
}

function ToneIcon({ icon, tone = 'cyan' }) {
  const styles = {
    cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,0.12)]',
    emerald: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
    rose: 'border-rose-300/25 bg-rose-300/10 text-rose-200',
    amber: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
    violet: 'border-violet-300/25 bg-violet-300/10 text-violet-200',
    slate: 'border-white/[0.08] bg-white/[0.06] text-slate-300',
  };
  return (
    <div className={`flex h-11 w-11 flex-none items-center justify-center rounded-2xl border ${styles[tone] || styles.cyan}`}>
      <Icon name={icon} size={21} />
    </div>
  );
}

function IconButton({ icon, label, onClick, tone = 'neutral' }) {
  const style = tone === 'danger'
    ? 'border-rose-300/25 bg-rose-300/10 text-rose-200 active:bg-rose-300/15'
    : 'border-white/[0.08] bg-white/[0.06] text-slate-300 active:bg-white/[0.09]';

  return (
    <button onClick={onClick} aria-label={label} className={`flex h-10 w-10 items-center justify-center rounded-xl border ${style}`}>
      <Icon name={icon} size={18} />
    </button>
  );
}

function StatusPill({ tone, label }) {
  const styles = {
    cyan: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
    emerald: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
    amber: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
    rose: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
    violet: 'border-violet-300/30 bg-violet-300/10 text-violet-100',
    slate: 'border-white/[0.08] bg-white/[0.06] text-slate-300',
  };
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${styles[tone] || styles.slate}`}>{label}</span>;
}

function SpotStatus({ spot }) {
  if (spot.status === 'pending_approval') return <StatusPill tone="amber" label="Pending" />;
  if (spot.status === 'rejected') return <StatusPill tone="rose" label="Rejected" />;
  return <StatusPill tone={spot.is_available ? 'emerald' : 'slate'} label={spot.is_available ? 'Active' : 'Paused'} />;
}

function InfoPill({ icon, text }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/20 px-2.5 py-2 text-slate-300">
      <Icon name={icon} size={14} className="text-cyan-100/60" />
      <span className="truncate">{text}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function EmptyPanel({ icon, title, text, children }) {
  return (
    <div className="rounded-2xl border border-dashed border-cyan-200/20 bg-white/[0.035] px-5 py-9 text-center shadow-[0_18px_48px_rgba(0,0,0,0.20)]">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
        <Icon name={icon} size={27} />
      </div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-400">{text}</p>
      {children}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map(item => (
        <div key={item} className="rounded-2xl border border-white/[0.08] bg-white/[0.045] p-4">
          <div className="flex gap-3">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-white/[0.08]" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.08]" />
              <div className="h-3 w-full animate-pulse rounded bg-white/[0.08]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function vehicleIcon(type) {
  if (type === 'motorcycle') return 'motorcycle';
  if (type === 'truck') return 'truck';
  return 'car';
}

function parseCheckinToken(value) {
  if (!value) return null;
  const text = String(value);
  const deepLink = text.match(/(?:start=|startapp=)checkin_([A-Za-z0-9_-]+)/);
  if (deepLink) return deepLink[1];
  const payload = text.match(/^checkin_([A-Za-z0-9_-]+)$/);
  if (payload) return payload[1];
  return null;
}

function sendCheckinToTelegram(data, scannedText) {
  const tg = window.Telegram?.WebApp;
  if (tg?.closeScanQrPopup) {
    tg.closeScanQrPopup();
  }

  if (typeof tg?.sendData === 'function') {
    tg.sendData(JSON.stringify(data));
    return true;
  }

  if (scannedText && typeof window.location.assign === 'function') {
    window.location.assign(scannedText);
    return true;
  }

  return false;
}

function isMissingHostCheckinRoute(err) {
  const message = String(err?.message || '');
  return message.includes('Route POST /api/miniapp/host/checkin not found') || message.includes('HTTP 404');
}

function checkinErrorMessage(err) {
  const message = err?.message || '';
  const map = {
    NOT_FOUND: 'Booking not found for this QR or code',
    NOT_OWNER: 'Only the spot owner or an assigned manager can confirm this booking',
    ALREADY_CHECKED_IN: 'This driver is already checked in',
    INVALID_STATE: 'This booking cannot be checked in right now',
    EXPIRED: 'This booking has expired',
    NOT_COMPLETABLE: 'This booking cannot be completed yet',
  };
  return map[message] || message || 'Check-in failed';
}

function bookingStatusTone(status) {
  if (status === 'active') return 'emerald';
  if (status === 'reserved' || status === 'confirmed') return 'cyan';
  if (status === 'pending') return 'amber';
  if (status === 'cancelled' || status === 'expired') return 'rose';
  return 'slate';
}

function adminSpotTone(status) {
  if (status === 'active') return 'emerald';
  if (status === 'pending_approval') return 'amber';
  if (status === 'rejected' || status === 'suspended') return 'rose';
  return 'slate';
}

function adminDisputeTone(status) {
  if (status === 'resolved') return 'emerald';
  if (status === 'rejected') return 'rose';
  if (status === 'open') return 'amber';
  return 'slate';
}

function adminPaymentTone(status) {
  if (status === 'paid') return 'emerald';
  if (status === 'awaiting_review' || status === 'pending') return 'amber';
  if (status === 'failed' || status === 'refunded') return 'rose';
  return 'slate';
}

function profileToneBorder(tone) {
  const styles = {
    cyan: 'border-cyan-300/18',
    emerald: 'border-emerald-300/18',
    amber: 'border-amber-300/18',
    rose: 'border-rose-300/18',
    violet: 'border-violet-300/18',
    slate: 'border-white/[0.08]',
  };
  return styles[tone] || styles.slate;
}

function adminToneBorder(tone) {
  const styles = {
    cyan: 'border-cyan-300/20',
    emerald: 'border-emerald-300/18',
    amber: 'border-amber-300/20',
    rose: 'border-rose-300/20',
    violet: 'border-violet-300/20',
    slate: 'border-white/[0.08]',
  };
  return styles[tone] || styles.slate;
}

function adminToneStripe(tone) {
  const styles = {
    cyan: 'bg-gradient-to-r from-transparent via-cyan-300 to-transparent',
    emerald: 'bg-gradient-to-r from-transparent via-emerald-300 to-transparent',
    amber: 'bg-gradient-to-r from-transparent via-amber-300 to-transparent',
    rose: 'bg-gradient-to-r from-transparent via-rose-300 to-transparent',
    violet: 'bg-gradient-to-r from-transparent via-violet-300 to-transparent',
    slate: 'bg-gradient-to-r from-transparent via-white/20 to-transparent',
  };
  return styles[tone] || styles.slate;
}

function adminToneText(tone) {
  const styles = {
    cyan: 'text-cyan-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
    violet: 'text-violet-300',
    slate: 'text-slate-300',
  };
  return styles[tone] || styles.slate;
}

function adminDecisionButtonClass(tone) {
  const styles = {
    cyan: 'bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200',
    emerald: 'bg-emerald-300 text-slate-950 shadow-[0_0_24px_rgba(110,231,183,0.28)] active:bg-emerald-200',
    amber: 'bg-amber-300 text-slate-950 shadow-[0_0_24px_rgba(252,211,77,0.24)] active:bg-amber-200',
    rose: 'bg-rose-300 text-slate-950 shadow-[0_0_24px_rgba(253,164,175,0.24)] active:bg-rose-200',
    violet: 'bg-violet-300 text-slate-950 shadow-[0_0_24px_rgba(196,181,253,0.24)] active:bg-violet-200',
    slate: 'bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200',
  };
  return styles[tone] || styles.slate;
}

async function fetchAdminQueue(queueKey, offset = 0) {
  const limit = 20;
  if (queueKey === 'pending_spots') {
    return api.getAdminSpots({ status: 'pending_approval', limit, offset });
  }
  if (queueKey === 'open_tickets') {
    return api.getAdminTickets({ status: 'open', limit, offset });
  }
  if (queueKey === 'open_disputes') {
    return api.getAdminDisputes({ status: 'open', limit, offset });
  }
  if (queueKey === 'payment_review') {
    return api.getAdminPayments({ status: 'awaiting_review', limit, offset });
  }
  if (queueKey === 'recent_bookings') {
    return api.getAdminBookings({ limit, offset });
  }
  if (queueKey === 'host_balances') {
    const data = await api.getAdminBalances();
    const items = data.items || [];
    return { items, pagination: { total: items.length, limit: items.length, offset: 0, has_more: false } };
  }
  if (queueKey === 'recent_users') {
    return api.getAdminUsers({ limit, offset });
  }
  return { items: [], pagination: { total: 0, limit, offset: 0, has_more: false } };
}

function mergeAdminQueuePage(queueKey, page = {}, previousItems = []) {
  const pageItems = page.items || [];
  const mergedItems = dedupeAdminQueueItems(queueKey, [...previousItems, ...pageItems]);
  const total = Number(page.pagination?.total ?? page.total ?? mergedItems.length);

  return {
    total,
    items: mergedItems,
    pagination: {
      total,
      limit: Number(page.pagination?.limit || pageItems.length || 20),
      offset: Number(page.pagination?.offset || 0),
      has_more: page.pagination?.has_more ?? mergedItems.length < total,
    },
  };
}

function dedupeAdminQueueItems(queueKey, items) {
  const seen = new Set();
  return items.filter(item => {
    const key = adminQueueItemKey(queueKey, item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function adminQueueItemKey(queueKey, item = {}) {
  if (queueKey === 'host_balances') return `host:${item.host_id}`;
  return `${queueKey}:${item.id}`;
}

function adminQueueHasMore(queue = {}) {
  if (typeof queue.pagination?.has_more === 'boolean') return queue.pagination.has_more;
  return Number(queue.total || 0) > (queue.items || []).length;
}

function maxReportCount(rows = []) {
  return Math.max(1, ...rows.map(row => Number(row.count || 0)));
}

function maxReportAmount(rows = []) {
  return Math.max(1, ...rows.map(row => Number(row.total_amount || 0)));
}

function adminActivityIcon(type) {
  const value = String(type || '');
  if (value.includes('payment')) return 'creditCard';
  if (value.includes('booking')) return 'calendar';
  if (value.includes('spot')) return 'parking';
  if (value.includes('ticket') || value.includes('support')) return 'fileText';
  if (value.includes('dispute')) return 'shield';
  if (value.includes('user')) return 'user';
  return 'fileText';
}

function adminActivityTone(type, status) {
  const value = String(type || '');
  if (value.includes('payment')) return adminPaymentTone(status);
  if (value.includes('booking')) return bookingStatusTone(status);
  if (value.includes('spot')) return adminSpotTone(status);
  if (value.includes('dispute')) return adminDisputeTone(status);
  if (value.includes('ticket') || value.includes('support')) return supportStatusTone(status);
  return 'slate';
}

function adminReportConfig(type) {
  return ADMIN_REPORT_TYPES.find(item => item.key === type) || ADMIN_REPORT_TYPES[0];
}

function buildAdminReportParams({ type, range, customStart, customEnd }) {
  const today = dateInputValue(new Date());
  let startDate = dateInputValue(startOfCurrentMonth());
  let endDate = today;
  let interval = 'day';

  if (range === 'today') {
    startDate = today;
    endDate = today;
    interval = 'hour';
  } else if (range === 'week') {
    startDate = dateInputValue(startOfCurrentWeek());
    interval = 'day';
  } else if (range === 'year') {
    startDate = dateInputValue(startOfCurrentYear());
    interval = 'month';
  } else if (range === 'custom') {
    startDate = customStart || startDate;
    endDate = customEnd || endDate;
    interval = adminCustomInterval(startDate, endDate);
  }

  return { type, startDate, endDate, interval, limit: 10 };
}

function adminCustomInterval(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.max(1, Math.ceil((end - start) / 86400000));
  if (days <= 2) return 'hour';
  if (days <= 120) return 'day';
  if (days <= 900) return 'month';
  return 'year';
}

function adminReportRangeLabel(report, fallbackRange) {
  const start = report?.range?.start_date;
  const end = report?.range?.end_date;
  if (start && end) return `${start} to ${end}`;
  const labels = {
    today: 'Today',
    week: 'This week',
    month: 'This month',
    year: 'This year',
    custom: 'Custom range',
  };
  return labels[fallbackRange] || 'This month';
}

function adminReportSummaryCards(type, summary = {}, openWork = 0) {
  if (type === 'payments') {
    return [
      { label: 'Paid amount', value: `${formatMoney(summary.paid_amount)} ETB`, icon: 'creditCard', tone: 'emerald' },
      { label: 'Total payments', value: summary.total_payments ?? 0, icon: 'receipt', tone: 'cyan' },
      { label: 'Commission', value: `${formatMoney(summary.commission_amount)} ETB`, icon: 'barChart', tone: 'violet' },
      { label: 'Needs review', value: summary.review_payments ?? 0, icon: 'shield', tone: 'amber' },
    ];
  }
  if (type === 'bookings') {
    return [
      { label: 'Bookings', value: summary.total_bookings ?? 0, icon: 'calendar', tone: 'violet' },
      { label: 'Paid value', value: `${formatMoney(summary.paid_value)} ETB`, icon: 'creditCard', tone: 'emerald' },
      { label: 'Active', value: summary.active_bookings ?? 0, icon: 'clock', tone: 'cyan' },
      { label: 'Cancelled', value: summary.cancelled_bookings ?? 0, icon: 'x', tone: 'rose' },
    ];
  }
  if (type === 'marketplace') {
    return [
      { label: 'New spots', value: summary.new_spots ?? 0, icon: 'parking', tone: 'amber' },
      { label: 'Approved', value: summary.approved_spots ?? 0, icon: 'checkCircle', tone: 'emerald' },
      { label: 'Pending now', value: summary.pending_spots ?? 0, icon: 'shield', tone: 'amber' },
      { label: 'Active now', value: summary.active_spots ?? 0, icon: 'parking', tone: 'cyan' },
    ];
  }
  if (type === 'support') {
    return [
      { label: 'Tickets', value: summary.tickets_created ?? 0, icon: 'fileText', tone: 'cyan' },
      { label: 'Resolved', value: summary.tickets_resolved ?? 0, icon: 'checkCircle', tone: 'emerald' },
      { label: 'Disputes', value: summary.disputes_created ?? 0, icon: 'shield', tone: 'amber' },
      { label: 'Open work', value: Number(summary.open_tickets || 0) + Number(summary.open_disputes || 0), icon: 'clock', tone: 'rose' },
    ];
  }
  if (type === 'users') {
    return [
      { label: 'New users', value: summary.new_users ?? 0, icon: 'user', tone: 'cyan' },
      { label: 'Drivers', value: summary.total_drivers ?? 0, icon: 'car', tone: 'emerald' },
      { label: 'Hosts', value: summary.total_hosts ?? 0, icon: 'home', tone: 'amber' },
      { label: 'Banned', value: summary.banned_users ?? 0, icon: 'shield', tone: 'rose' },
    ];
  }
  return [
    { label: 'Payouts', value: summary.payouts_created ?? 0, icon: 'receipt', tone: 'emerald' },
    { label: 'Payout amount', value: `${formatMoney(summary.payout_amount)} ETB`, icon: 'creditCard', tone: 'cyan' },
    { label: 'Sent amount', value: `${formatMoney(summary.sent_amount)} ETB`, icon: 'checkCircle', tone: 'emerald' },
    { label: 'Open tasks', value: openWork, icon: 'shield', tone: 'amber' },
  ];
}

function adminPrimaryBreakdown(type, breakdowns = {}) {
  if (type === 'payments') return { title: 'Status breakdown', rows: breakdowns.status || [] };
  if (type === 'bookings') return { title: 'Booking status', rows: breakdowns.status || [] };
  if (type === 'marketplace') return { title: 'Listing status', rows: breakdowns.status || [] };
  if (type === 'support') return { title: 'Ticket categories', rows: breakdowns.category || [] };
  if (type === 'users') return { title: 'Roles', rows: breakdowns.role || [] };
  return { title: 'Payout status', rows: breakdowns.status || [] };
}

function adminSecondaryBreakdown(type, breakdowns = {}) {
  if (type === 'payments') return { title: 'Payment methods', rows: breakdowns.method || [] };
  if (type === 'bookings') return { title: 'Payment status', rows: breakdowns.payment_status || [] };
  if (type === 'support') return { title: 'Ticket status', rows: breakdowns.ticket_status || [] };
  return { title: '', rows: [] };
}

function adminBreakdownValue(row, type) {
  if (['payments', 'finance'].includes(type) && row.amount !== undefined) {
    return `${formatMoney(row.amount)} ETB`;
  }
  return row.count ?? 0;
}

function adminBreakdownMax(rows, type) {
  if (['payments', 'finance'].includes(type)) {
    return Math.max(1, ...rows.map(row => Number(row.amount ?? row.count ?? 0)));
  }
  return Math.max(1, ...rows.map(row => Number(row.count ?? row.amount ?? 0)));
}

function adminBreakdownTone(type, label) {
  if (type === 'payments') return adminPaymentTone(label);
  if (type === 'bookings') return bookingStatusTone(label);
  if (type === 'marketplace') return adminSpotTone(label);
  if (type === 'support') return label === 'resolved' ? 'emerald' : label === 'open' ? 'amber' : label === 'payment' ? 'cyan' : 'slate';
  if (type === 'finance') return label === 'sent' ? 'emerald' : label === 'cancelled' ? 'rose' : 'amber';
  return label === 'admin' ? 'violet' : label === 'host' ? 'amber' : 'cyan';
}

function adminTrendValue(row, type) {
  if (['payments', 'finance'].includes(type)) return Number(row.amount || row.paid_amount || 0);
  if (type === 'bookings') return Number(row.count || row.paid_count || 0);
  return Number(row.count || row.tickets || row.disputes || 0);
}

function adminTrendLabel(value, type) {
  if (['payments', 'finance'].includes(type)) return formatMoney(value);
  return String(value);
}

function shortReportLabel(label) {
  const text = String(label || '');
  if (text.length <= 7) return text;
  return text.slice(5);
}

function formatStatusLabel(value) {
  return String(value || 'Unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
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

function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfCurrentWeek() {
  const date = new Date();
  const day = date.getDay();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

function startOfCurrentMonth() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
}

function startOfCurrentYear() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setMonth(0, 1);
  return date;
}

function formatDateTimeShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
