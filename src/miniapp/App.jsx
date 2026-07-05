import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import * as api from './api.js';
import HomeScreen from './screens/HomeScreen.jsx';
import MapScreen from './screens/MapScreen.jsx';
import BookingsScreen from './screens/BookingsScreen.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';
import BottomNav from './components/BottomNav.jsx';
import Toast from './components/Toast.jsx';
import { getUserLocation, getCachedLocation } from './utils/location.js';

const SCREEN_STORAGE_KEY = 'parkaddis_last_screen';
const SCREENS = new Set(['home', 'map', 'bookings', 'profile']);

function getInitialScreen() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'return') return 'bookings';
  if (params.has('lat') && params.has('lng')) return 'map';
  const stored = localStorage.getItem(SCREEN_STORAGE_KEY);
  return SCREENS.has(stored) ? stored : 'home';
}

function unauthenticatedPaymentReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') !== 'return') return null;
  if (window.Telegram?.WebApp?.initData) return null;
  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname)) return null;

  const successUrl = new URL('/payment/success', window.location.origin);
  successUrl.searchParams.set('source', 'miniapp');
  const bookingId = params.get('bookingId');
  if (bookingId) successUrl.searchParams.set('bookingId', bookingId);
  return successUrl.toString();
}

// ── Contexts ──────────────────────────────────────────────────────────
export const UserContext = createContext(null);
export const ToastContext = createContext(null);

export function useUser() {
  return useContext(UserContext);
}
export function useToast() {
  return useContext(ToastContext);
}

// ── App ───────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [screen, setScreen] = useState(getInitialScreen);
  const [paymentReturn, setPaymentReturn] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [mapLocationRequest, setMapLocationRequest] = useState(null);
  const [mapFocusSpot, setMapFocusSpot] = useState(null);
  const [profileTarget, setProfileTarget] = useState(null);
  const [userLocation, setUserLocation] = useState(() => getCachedLocation());
  const [paymentReturnRedirectUrl] = useState(unauthenticatedPaymentReturnUrl);

  const requestMapLocation = useCallback(({ preferBrowser = true } = {}) => {
    const request = getUserLocation({
      force: true,
      allowFallback: false,
      enableHighAccuracy: true,
      timeoutMs: 10000,
      preferBrowser,
    });
    // Share the resolved location with other screens (e.g. Home's Nearby list)
    // so they can be location-aware without triggering their own prompt.
    request.then((loc) => { if (loc) setUserLocation(loc); }).catch(() => {});
    setMapLocationRequest({ id: Date.now(), request });
  }, []);

  useEffect(() => {
    if (paymentReturnRedirectUrl) {
      window.location.replace(paymentReturnRedirectUrl);
    }
  }, [paymentReturnRedirectUrl]);

  // Telegram WebApp init
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.('#0a0a0f');
      tg.setBackgroundColor?.('#0a0a0f');
    }
  }, []);

  useEffect(() => {
    if (SCREENS.has(screen)) {
      localStorage.setItem(SCREEN_STORAGE_KEY, screen);
    }
  }, [screen]);

  // Load user
  const loadUser = useCallback(async () => {
    if (paymentReturnRedirectUrl) return;
    setLoading(true);
    setError(null);
    try {
      console.log('MiniApp: Loading user...');
      const tg = window.Telegram?.WebApp;
      console.log('MiniApp: initData available:', !!tg?.initData);
      const u = await api.getUser();
      console.log('MiniApp: User loaded:', u);
      setUser(u);
    } catch (err) {
      console.error('MiniApp: Error loading user:', err);
      setError(err.message || 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [paymentReturnRedirectUrl]);

  useEffect(() => {
    if (!paymentReturnRedirectUrl) loadUser();
  }, [loadUser, paymentReturnRedirectUrl]);

  useEffect(() => {
    if (paymentReturnRedirectUrl || screen !== 'map' || mapLocationRequest) return;
    requestMapLocation({ preferBrowser: false });
  }, [mapLocationRequest, paymentReturnRedirectUrl, requestMapLocation, screen]);

  // Toast helpers
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearPaymentReturn = useCallback(() => {
    setPaymentReturn(null);
  }, []);

  const navigate = useCallback((nextScreen, options = {}) => {
    if (nextScreen === 'map') {
      // Focus a specific spot only when one was passed; otherwise clear any stale
      // focus so a generic "open map" tap doesn't re-open a previously tapped spot.
      setMapFocusSpot(options.spot ? { nonce: Date.now(), spot: options.spot } : null);
      requestMapLocation();
    }
    if (nextScreen === 'profile') {
      setProfileTarget({ nonce: Date.now(), section: options.section || null });
    }
    setScreen(nextScreen);
  }, [requestMapLocation]);

  useEffect(() => {
    if (paymentReturnRedirectUrl || loading || error) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'return') return;

    const bookingId = params.get('bookingId');
    setScreen('bookings');
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);

    if (!bookingId) {
      addToast('Open My Bookings to check your payment.', 'info');
      return;
    }

    setPaymentReturn({ bookingId, nonce: Date.now() });
  }, [paymentReturnRedirectUrl, loading, error, addToast]);

  if (paymentReturnRedirectUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] bg-gradient-mesh">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
          <p className="text-sm text-slate-400">Opening payment confirmation...</p>
        </div>
      </div>
    );
  }

  // ── Loading state ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] bg-gradient-mesh">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
            <div className="absolute inset-0 h-12 w-12 rounded-full bg-cyan-400/20 blur-xl animate-pulse" />
          </div>
          <p className="text-sm text-slate-400">Loading ParkAddis...</p>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f] bg-gradient-mesh p-6">
        <div className="glass-card max-w-sm p-6 text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h2 className="mb-2 text-lg font-semibold text-white">Connection Error</h2>
          <p className="mb-4 text-sm text-slate-400">{error}</p>
          <button
            onClick={loadUser}
            className="rounded-xl bg-cyan-500/20 border border-cyan-500/30 px-6 py-3 text-sm font-semibold text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)] active:bg-cyan-500/30"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Main app ────────────────────────────────────────────────────────
  return (
    <UserContext.Provider value={{ user, reload: loadUser }}>
      <ToastContext.Provider value={{ addToast }}>
        <div className="relative flex h-screen flex-col bg-[#0a0a0f] bg-gradient-mesh">
          {/* Screen content */}
          <div className="relative min-h-0 flex-1">
            <div className={`absolute inset-0 overflow-y-auto overflow-x-hidden bg-[#0a0a0f] ${screen === 'home' ? 'z-10' : 'pointer-events-none invisible'}`}>
              <HomeScreen navigate={navigate} userLocation={userLocation} />
            </div>
            {screen === 'map' && (
              <div className="absolute inset-0 z-10 pointer-events-auto">
                <MapScreen
                  active
                  navigate={navigate}
                  locationRequest={mapLocationRequest}
                  requestLocation={requestMapLocation}
                  focusSpot={mapFocusSpot}
                />
              </div>
            )}
            <div className={`absolute inset-0 overflow-y-auto overflow-x-hidden bg-[#0a0a0f] ${screen === 'bookings' ? 'z-10' : 'pointer-events-none invisible'}`}>
              <BookingsScreen
                navigate={navigate}
                paymentReturn={paymentReturn}
                clearPaymentReturn={clearPaymentReturn}
              />
            </div>
            <div className={`absolute inset-0 overflow-y-auto overflow-x-hidden bg-[#0a0a0f] ${screen === 'profile' ? 'z-10' : 'pointer-events-none invisible'}`}>
              <ProfileScreen navigate={navigate} target={profileTarget} />
            </div>
          </div>

          {/* Bottom navigation */}
          <BottomNav screen={screen} navigate={navigate} />

          {/* Toast notifications */}
          <Toast toasts={toasts} removeToast={removeToast} />
        </div>
      </ToastContext.Provider>
    </UserContext.Provider>
  );
}
