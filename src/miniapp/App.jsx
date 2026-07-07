import React, { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { WifiOff, RotateCw } from 'lucide-react';
import * as api from './api.js';
import { errorMessage, t } from './i18n.js';
import { useOnline } from './hooks/useOnline.js';
import { useTelegram } from './hooks/useTelegram.js';

import HomeScreen from './screens/HomeScreen.jsx';
import GamesScreen from './screens/GamesScreen.jsx';
import DrawScreen from './screens/DrawScreen.jsx';
import TicketsScreen from './screens/TicketsScreen.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';
import DepositScreen from './screens/DepositScreen.jsx';
import WithdrawScreen from './screens/WithdrawScreen.jsx';
import ReferralScreen from './screens/ReferralScreen.jsx';
import LeaderboardScreen from './screens/LeaderboardScreen.jsx';
import KenoScreen from './screens/KenoScreen.jsx';
import SpinScreen from './screens/SpinScreen.jsx';
import RouletteScreen from './screens/RouletteScreen.jsx';

import TopBar from './components/TopBar.jsx';
import BottomNav from './components/BottomNav.jsx';
import Toast from './components/Toast.jsx';
import Coin from './components/ui/Coin.jsx';

export const PlayerContext = createContext(null);
export const ToastContext = createContext(null);

export function usePlayer() { return useContext(PlayerContext); }
export function useToast() { return useContext(ToastContext); }

const MAIN_TABS = ['home', 'games', 'draw', 'tickets', 'profile'];
const SECONDARY = {
  deposit: 'profile',
  withdraw: 'profile',
  referrals: 'profile',
  leaderboard: 'home',
  keno: 'games',
  spin: 'games',
  roulette: 'games',
};

export default function App() {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [screen, setScreen] = useState('home');
  const [toasts, setToasts] = useState([]);
  const online = useOnline();
  const { haptic } = useTelegram();
  const historyRef = useRef([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 3200);
    if (type === 'error') haptic('error');
    else if (type === 'success') haptic('success');
  }, [haptic]);

  const removeToast = useCallback((id) => setToasts((prev) => prev.filter((x) => x.id !== id)), []);

  const navigate = useCallback((next) => {
    setScreen((cur) => {
      if (next !== cur) historyRef.current.push(cur);
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setScreen(() => {
      const prev = historyRef.current.pop();
      return prev || SECONDARY[screen] || 'home';
    });
  }, [screen]);

  // Locally patch the player (e.g. after deposit/withdraw/buy) without a full reload.
  const patchPlayer = useCallback((patch) => {
    setPlayer((p) => (p ? { ...p, ...patch } : p));
  }, []);

  const loadPlayer = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const p = await api.getPlayer();
      setPlayer(p);
    } catch (err) {
      setAuthError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => {
    api.getPlayer().then(setPlayer).catch(() => {});
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.('#0b0713');
      tg.setBackgroundColor?.('#0b0713');
    }
  }, []);

  useEffect(() => { loadPlayer(); }, [loadPlayer]);

  // ── Loading splash ──
  if (loading) {
    return (
      <div className="coin-bg flex h-full flex-col items-center justify-center gap-5">
        <Coin size={72} floating>₿</Coin>
        <p className="text-sm font-black tracking-wide text-white">{t.appName}</p>
      </div>
    );
  }

  // ── Auth / connection failure ──
  if (authError) {
    const offline = authError.code === 'NETWORK' || authError.code === 'TIMEOUT';
    return (
      <div className="coin-bg flex h-full flex-col items-center justify-center px-8 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/5">
          <WifiOff size={30} className="text-coin-300" />
        </div>
        <h1 className="mt-5 text-lg font-black text-white">
          {offline ? "Can't reach BetBingo" : 'Sign-in failed'}
        </h1>
        <p className="mt-2 max-w-xs text-sm text-slate-400">
          {offline ? errorMessage(authError) : 'Open this app from inside Telegram to continue.'}
        </p>
        <button
          onClick={loadPlayer}
          className="btn-coin mt-6 inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-black text-amber-950"
        >
          <RotateCw size={16} /> {t.reconnect}
        </button>
      </div>
    );
  }

  const isMain = MAIN_TABS.includes(screen);

  return (
    <PlayerContext.Provider value={{ player, reload, patchPlayer }}>
      <ToastContext.Provider value={{ addToast }}>
        <div className="relative flex h-screen flex-col bg-night-950">
          {!online && (
            <div className="z-50 flex items-center justify-center gap-2 bg-rose-600/90 py-1.5 text-xs font-bold text-white backdrop-blur">
              <WifiOff size={13} /> {t.offline}
            </div>
          )}

          <div className="relative min-h-0 flex-1">
            {/* Main tab screens kept mounted to preserve scroll/state */}
            <Layer active={screen === 'home'}>
              <TopBar player={player} navigate={navigate} />
              <HomeScreen navigate={navigate} />
            </Layer>
            <Layer active={screen === 'games'}>
              <TopBar player={player} navigate={navigate} />
              <GamesScreen navigate={navigate} />
            </Layer>
            <Layer active={screen === 'draw'}>
              <TopBar player={player} navigate={navigate} />
              <DrawScreen navigate={navigate} active={screen === 'draw'} />
            </Layer>
            <Layer active={screen === 'tickets'}>
              <TopBar player={player} navigate={navigate} />
              <TicketsScreen navigate={navigate} />
            </Layer>
            <Layer active={screen === 'profile'}>
              <TopBar player={player} navigate={navigate} />
              <ProfileScreen navigate={navigate} />
            </Layer>

            {/* Secondary stacked screens (mounted only when active) */}
            {screen === 'deposit' && (
              <Layer active><DepositScreen onBack={goBack} /></Layer>
            )}
            {screen === 'withdraw' && (
              <Layer active><WithdrawScreen onBack={goBack} /></Layer>
            )}
            {screen === 'referrals' && (
              <Layer active><ReferralScreen onBack={goBack} /></Layer>
            )}
            {screen === 'leaderboard' && (
              <Layer active><LeaderboardScreen onBack={goBack} /></Layer>
            )}
            {screen === 'keno' && (
              <Layer active><KenoScreen onBack={goBack} /></Layer>
            )}
            {screen === 'spin' && (
              <Layer active><SpinScreen onBack={goBack} /></Layer>
            )}
            {screen === 'roulette' && (
              <Layer active><RouletteScreen onBack={goBack} /></Layer>
            )}
          </div>

          <BottomNav screen={screen} navigate={navigate} />
          <Toast toasts={toasts} removeToast={removeToast} />
        </div>
      </ToastContext.Provider>
    </PlayerContext.Provider>
  );
}

function Layer({ active, children }) {
  return (
    <div className={`absolute inset-0 overflow-y-auto ${active ? 'z-10' : 'pointer-events-none invisible'}`}>
      {children}
    </div>
  );
}
