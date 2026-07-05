import React, { useState, useEffect } from 'react';
import { useUser, useToast } from '../App.jsx';
import * as api from '../api.js';
import Icon from '../components/Icons.jsx';
import parkAddisLogo from '../../admin/assets/logo2.png';

// Addis Ababa city centre — used only when the user's real location isn't known yet.
const DEFAULT_LOC = { lat: 9.0054, lng: 38.7636 };

export default function HomeScreen({ navigate, userLocation = null }) {
  const { user } = useUser();
  const { addToast } = useToast();
  const [nearby, setNearby] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Prefer the user's real location (resolved once on the Map screen and shared via
  // props, so no extra permission prompt here); fall back to the city centre.
  const lat = Array.isArray(userLocation) ? userLocation[0] : DEFAULT_LOC.lat;
  const lng = Array.isArray(userLocation) ? userLocation[1] : DEFAULT_LOC.lng;

  useEffect(() => {
    loadData();
    // Re-fetch the nearby list whenever the known location changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load data in parallel
      const [spotsResult, bookingsResult] = await Promise.allSettled([
        api.getNearbySpots(lat, lng, 2000),
        api.getBookings({ status: 'active', limit: 3 }),
      ]);

      if (spotsResult.status === 'fulfilled') setNearby(spotsResult.value.spots || []);
      if (bookingsResult.status === 'fulfilled') setRecentBookings(bookingsResult.value.bookings || []);
    } catch (err) {
      console.error('Home load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFindParking = () => {
    navigate('map');
  };

  const handleBookSpot = (spot) => {
    navigate('map', { spot });
  };

  return (
    <div className="home-orbit flex min-h-full flex-col gap-5 px-4 pb-6 pt-4">
      {/* Header / Welcome */}
      <HomeHero user={user} onFindParking={handleFindParking} />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <QuickAction
          icon="search"
          label="Find Parking"
          hint="Nearby spots"
          tone="cyan"
          onClick={handleFindParking}
        />

        <QuickAction
          icon="calendar"
          label="My Bookings"
          hint="View & manage"
          tone="violet"
          onClick={() => navigate('bookings')}
        />

        <QuickAction
          icon="car"
          label="My Vehicles"
          hint="Manage fleet"
          tone="emerald"
          onClick={() => navigate('profile', { section: 'vehicles' })}
        />

        {user?.role === 'host' && (
          <QuickAction
            icon="home"
            label="Host Panel"
            hint="Manage spots"
            tone="amber"
            onClick={() => navigate('profile', { section: 'host' })}
          />
        )}
      </div>

      {/* Active Bookings */}
      {recentBookings.length > 0 && (
        <section>
          <SectionHeader title="Active Bookings" action="View all" onAction={() => navigate('bookings')} />
          <div className="space-y-2">
            {recentBookings.slice(0, 2).map((b) => (
              <div
                key={b.id}
                className="home-glass-card flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3 shadow-[0_14px_34px_rgba(0,0,0,0.18)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{b.address || 'Parking spot'}</p>
                  <p className="text-xs text-slate-400">
                    Code: <span className="font-mono text-cyan-300 text-glow-cyan">{b.confirmation_code}</span>
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Nearby Spots */}
      <section>
        <SectionHeader title="Nearby Spots" action="See map" onAction={() => navigate('map')} />

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/[0.08] border-t-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]" />
          </div>
        ) : nearby.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-cyan-200/20 bg-white/[0.035] p-6 text-center shadow-[0_18px_48px_rgba(0,0,0,0.20)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <Icon name="mapPin" size={24} />
            </div>
            <p className="text-sm text-slate-400">No spots found nearby</p>
            <button
              onClick={handleFindParking}
              className="mt-3 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-black text-cyan-100 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
            >
              Browse Map
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {nearby.slice(0, 5).map((spot) => (
              <button
                key={spot.id}
                className="home-glass-card flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3 text-left shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition-all active:border-cyan-300/30 active:bg-white/[0.08]"
                onClick={() => handleBookSpot(spot)}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.12)]">
                  <Icon name="mapPin" size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{spot.address || 'Parking spot'}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-cyan-300 text-glow-cyan">{Number(spot.price_per_hour)} ETB/hr</span>
                    {spot.distance_m != null && <span>{spot.distance_m}m away</span>}
                  </div>
                </div>
                <Icon name="chevronRight" size={16} className="text-cyan-100/35" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HomeHero({ user, onFindParking }) {
  return (
    <header className="home-hero overflow-hidden rounded-[30px] border border-cyan-200/15 bg-[#050910]/90 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.52)]">
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-cyan-200/15 bg-cyan-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100">
            ParkAddis
          </span>
          <button
            onClick={onFindParking}
            className="inline-flex min-h-10 flex-none items-center gap-1.5 rounded-2xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] transition-all active:scale-[0.97] active:bg-cyan-200"
          >
            <Icon name="search" size={16} />
            Find
          </button>
        </div>

        <div className="home-core mx-auto mt-4">
          <div className="home-core__halo" />
          <div className="home-core__orb home-core__orb--brand">
            <div className="home-core__logo-tile">
              <img src={parkAddisLogo} alt="ParkAddis" className="home-core__logo" />
            </div>
            <div className="min-w-0 text-left">
              <p className="home-core__brand">ParkAddis</p>
              <p className="home-core__tagline">Smart city parking</p>
            </div>
          </div>
        </div>

        <p className="home-hero__about">
          ParkAddis helps you find, compare, and book nearby parking around Addis Ababa.
        </p>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">Welcome back,</p>
          <h1 className="mt-1 text-3xl font-black leading-none text-white text-glow-cyan">{user?.name || 'Driver'}</h1>
        </div>
      </div>
    </header>
  );
}

function QuickAction({ icon, label, hint, tone, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`home-glass-card group relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl border bg-white/[0.045] p-4 text-left shadow-[0_14px_34px_rgba(0,0,0,0.18)] transition-all active:scale-[0.97] ${homeToneBorder(tone)}`}
    >
      <div className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border ${homeToneIcon(tone)}`}>
        <Icon name={icon} size={21} />
      </div>
      <div className="relative">
        <p className="text-sm font-black text-white">{label}</p>
        <p className={`text-xs ${homeToneText(tone)}`}>{hint}</p>
      </div>
    </button>
  );
}

function SectionHeader({ title, action, onAction }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-black text-white">{title}</h2>
      <button onClick={onAction} className="text-xs font-black text-cyan-300 text-glow-cyan">
        {action}
      </button>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    reserved: 'bg-violet-300/12 text-violet-200 border-violet-300/25',
    confirmed: 'bg-cyan-300/12 text-cyan-200 border-cyan-300/25',
    active: 'bg-emerald-300/12 text-emerald-200 border-emerald-300/25',
    completed: 'bg-white/[0.06] text-slate-300 border-white/[0.08]',
    cancelled: 'bg-rose-300/12 text-rose-200 border-rose-300/25',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${styles[status] || styles.reserved}`}>
      {status}
    </span>
  );
}

function homeToneBorder(tone) {
  const styles = {
    cyan: 'border-cyan-300/18 active:border-cyan-300/35',
    emerald: 'border-emerald-300/18 active:border-emerald-300/35',
    amber: 'border-amber-300/18 active:border-amber-300/35',
    violet: 'border-violet-300/18 active:border-violet-300/35',
  };
  return styles[tone] || 'border-white/[0.08]';
}

function homeToneIcon(tone) {
  const styles = {
    cyan: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.12)]',
    emerald: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
    amber: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
    violet: 'border-violet-300/25 bg-violet-300/10 text-violet-200',
  };
  return styles[tone] || 'border-white/[0.08] bg-white/[0.06] text-slate-300';
}

function homeToneText(tone) {
  const styles = {
    cyan: 'text-cyan-200/75',
    emerald: 'text-emerald-200/75',
    amber: 'text-amber-200/75',
    violet: 'text-violet-200/75',
  };
  return styles[tone] || 'text-slate-400';
}
