import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import * as api from './api.js';
import HomeScreen from './screens/HomeScreen.jsx';
import GamesScreen from './screens/GamesScreen.jsx';
import DrawScreen from './screens/DrawScreen.jsx';
import TicketsScreen from './screens/TicketsScreen.jsx';
import ProfileScreen from './screens/ProfileScreen.jsx';
import DepositScreen from './screens/DepositScreen.jsx';
import BottomNav from './components/BottomNav.jsx';
import Toast from './components/Toast.jsx';

export const PlayerContext = createContext(null);
export const ToastContext = createContext(null);

export function usePlayer() { return useContext(PlayerContext); }
export function useToast() { return useContext(ToastContext); }

export default function App() {
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState('home');
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const navigate = useCallback((next) => setScreen(next), []);

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
    (async () => {
      try {
        const p = await api.getPlayer();
        setPlayer(p);
      } catch { /* ignore */ } finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-cyan-400" />
          <p className="text-sm text-slate-500">BetBingo</p>
        </div>
      </div>
    );
  }

  return (
    <PlayerContext.Provider value={{ player, reload: () => { setLoading(true); api.getPlayer().then(setPlayer).finally(() => setLoading(false)); } }}>
      <ToastContext.Provider value={{ addToast }}>
        <div className="relative flex h-screen flex-col bg-[#0a0a0f]">
          <div className="relative min-h-0 flex-1">
            <div className={`absolute inset-0 overflow-y-auto ${screen === 'home' ? 'z-10' : 'pointer-events-none invisible'}`}>
              <HomeScreen navigate={navigate} />
            </div>
            <div className={`absolute inset-0 overflow-y-auto ${screen === 'games' ? 'z-10' : 'pointer-events-none invisible'}`}>
              <GamesScreen navigate={navigate} />
            </div>
            <div className={`absolute inset-0 overflow-y-auto ${screen === 'draw' ? 'z-10' : 'pointer-events-none invisible'}`}>
              <DrawScreen navigate={navigate} />
            </div>
            <div className={`absolute inset-0 overflow-y-auto ${screen === 'tickets' ? 'z-10' : 'pointer-events-none invisible'}`}>
              <TicketsScreen navigate={navigate} />
            </div>
            <div className={`absolute inset-0 overflow-y-auto ${screen === 'profile' ? 'z-10' : 'pointer-events-none invisible'}`}>
              <ProfileScreen navigate={navigate} />
            </div>
            <div className={`absolute inset-0 overflow-y-auto ${screen === 'deposit' ? 'z-10' : 'pointer-events-none invisible'}`}>
              <DepositScreen navigate={navigate} onBack={() => navigate('profile')} />
            </div>
          </div>
          <BottomNav screen={screen} navigate={navigate} />
          <Toast toasts={toasts} removeToast={removeToast} />
        </div>
      </ToastContext.Provider>
    </PlayerContext.Provider>
  );
}
