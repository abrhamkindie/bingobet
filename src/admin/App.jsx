import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import * as API from './api.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Games from './pages/Games.jsx';
import Players from './pages/Players.jsx';
import DrawPage from './pages/DrawPage.jsx';
import Transactions from './pages/Transactions.jsx';
import Toast from './components/Toast.jsx';

export const AuthContext = createContext(null);
export const ToastContext = createContext(null);

function App() {
  const [user, setUser] = useState(API.getUser());
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthed = !!user;

  const addToast = (message, type) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const handleLogin = async (e) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    setLoginError('');
    setLoading(true);
    try {
      await API.login(email, password);
      setUser(API.getUser());
      addToast('Welcome back!', 'success');
      navigate('/dashboard');
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    API.logout();
    setUser(null);
    addToast('Signed out', 'info');
    navigate('/');
  };

  if (!isAuthed) {
    return (
      <ToastContext.Provider value={{ addToast, removeToast }}>
        <div className="min-h-screen bg-[#0f172a] text-white">
          <div className="mx-auto flex min-h-screen max-w-md items-center justify-center p-6">
            <div className="w-full">
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-emerald-400">BetBingo</h1>
                <p className="mt-2 text-slate-400">Admin Console</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Email</label>
                  <input type="email" name="email" required autoComplete="email"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
                  <input type="password" name="password" required autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                </div>

                {loginError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{loginError}</div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </div>
          </div>
        </div>
        <Toast toasts={toasts} removeToast={removeToast} />
      </ToastContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout: handleLogout }}>
      <ToastContext.Provider value={{ addToast, removeToast }}>
        <Layout onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/games" element={<Games />} />
            <Route path="/games/:id" element={<DrawPage />} />
            <Route path="/players" element={<Players />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
        <Toast toasts={toasts} removeToast={removeToast} />
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;
