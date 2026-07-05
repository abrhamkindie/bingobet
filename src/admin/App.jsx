import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import * as API from './api.jsx';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Spots from './pages/Spots.jsx';
import Bookings from './pages/Bookings.jsx';
import Users from './pages/Users.jsx';
import Payments from './pages/Payments.jsx';
import Finance from './pages/Finance.jsx';
import Disputes from './pages/Disputes.jsx';
import Ratings from './pages/Ratings.jsx';
import Tickets from './pages/Tickets.jsx';
import Toast from './components/Toast.jsx';
import logoMark from './assets/logo2.png';

export const AuthContext = createContext(null);
export const ToastContext = createContext(null);
export const SearchContext = createContext('');

function App() {
  const [user, setUser] = useState(API.getUser());
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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
        <div className="min-h-screen overflow-hidden bg-[#f1f5f9] text-ink">
          <div className="mx-auto grid min-h-screen w-full max-w-7xl lg:grid-cols-[0.92fr_1.08fr]">
            <section className="flex min-h-screen flex-col justify-between px-5 py-6 sm:px-8 lg:px-12">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] shadow-[0_4px_12px_rgba(79,70,229,0.25)]">
                  <img src={logoMark} alt="ParkAddis logo" className="h-8 w-8 object-contain brightness-0 invert" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">ParkAddis</p>
                  <p className="text-xs text-muted">Admin Console</p>
                </div>
              </div>

              <div className="w-full max-w-[420px] py-10 sm:py-14">
                <p className="mb-3 text-sm font-medium text-primary">Secure operations access</p>
                <h1 className="text-3xl font-bold leading-tight text-ink sm:text-4xl">Sign in to ParkAddis</h1>
                <p className="mt-3 max-w-sm text-sm leading-6 text-muted">Continue to the protected workspace for bookings, spots, payments, and support.</p>

                <form onSubmit={handleLogin} className="mt-8 space-y-5">
                  <div className="text-left">
                    <label htmlFor="email" className="mb-2 block text-sm font-medium text-ink-soft">Email address</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-muted-light">
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3.5 5.5h13v9h-13z" />
                          <path d="m4 6 6 5 6-5" />
                        </svg>
                      </span>
                      <input type="email" id="email" name="email" placeholder="admin@parkaddis.com" required autoComplete="email"
                        className="h-12 w-full rounded-lg border border-line bg-white px-3.5 pl-11 text-sm text-ink shadow-sm transition placeholder:text-muted-light focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15" />
                    </div>
                  </div>

                  <div className="text-left">
                    <label htmlFor="password" className="mb-2 block text-sm font-medium text-ink-soft">Password</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-muted-light">
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="4" y="8" width="12" height="8" rx="1.8" />
                          <path d="M7 8V6.5a3 3 0 0 1 6 0V8" />
                        </svg>
                      </span>
                      <input type="password" id="password" name="password" placeholder="Enter your password" required autoComplete="current-password"
                        className="h-12 w-full rounded-lg border border-line bg-white px-3.5 pl-11 text-sm text-ink shadow-sm transition placeholder:text-muted-light focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15" />
                    </div>
                  </div>

                  {loginError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{loginError}</div>
                  )}

                  <button type="submit" disabled={loading}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)] transition hover:bg-primary-600 focus:outline-none focus:ring-4 focus:ring-primary/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
                    {loading ? (
                      <>
                        <span className="h-4 w-4 rounded-full border-2 border-white/35 border-t-white animate-spin" aria-hidden="true"></span>
                        Signing in
                      </>
                    ) : (
                      <>
                        Sign in
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 10h11" />
                          <path d="m11 6 4 4-4 4" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                <div className="mt-6 flex items-center gap-2 text-xs text-muted">
                  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10 2.5 16 5v4.5c0 3.6-2.4 6.4-6 8-3.6-1.6-6-4.4-6-8V5l6-2.5Z" />
                    <path d="m7.5 10 1.6 1.7 3.5-4" />
                  </svg>
                  Role-based access only
                </div>
              </div>

              <p className="text-xs text-muted">© {new Date().getFullYear()} ParkAddis</p>
            </section>

            <section className="hidden min-h-screen p-6 lg:flex">
              <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-8 text-white shadow-card-lg">
                <div className="absolute inset-0 opacity-40" aria-hidden="true">
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px]"></div>
                  <div className="absolute left-[12%] top-0 h-full w-12 rotate-[19deg] bg-[#4f46e5]/30"></div>
                  <div className="absolute right-[22%] top-0 h-full w-8 -rotate-[24deg] bg-[#818cf8]/20"></div>
                  <div className="absolute bottom-20 left-0 h-10 w-full -rotate-[8deg] bg-[#6366f1]/25"></div>
                </div>

                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-sm text-indigo-300">Live overview</p>
                    <h2 className="mt-1 text-2xl font-semibold">Addis parking control</h2>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/95 shadow-lg">
                    <img src={logoMark} alt="" className="h-8 w-8 object-contain" aria-hidden="true" />
                  </div>
                </div>

                <div className="relative my-10 grid min-h-[360px] grid-cols-[1fr_0.86fr] gap-5">
                  <div className="relative overflow-hidden rounded-xl border border-white/12 bg-white/10 p-5 backdrop-blur">
                    <div className="absolute inset-4 rounded-xl border border-dashed border-white/18" aria-hidden="true"></div>
                    <div className="relative h-full">
                      <div className="absolute left-[16%] top-[18%] h-3 w-3 rounded-full bg-[#818cf8] shadow-[0_0_0_8px_rgba(129,140,248,0.16)]"></div>
                      <div className="absolute right-[22%] top-[31%] h-3 w-3 rounded-full bg-[#f59e0b] shadow-[0_0_0_8px_rgba(245,158,11,0.16)]"></div>
                      <div className="absolute bottom-[23%] left-[42%] h-3 w-3 rounded-full bg-[#06b6d4] shadow-[0_0_0_8px_rgba(6,182,212,0.16)]"></div>
                      <div className="absolute bottom-[13%] right-[17%] h-3 w-3 rounded-full bg-white shadow-[0_0_0_8px_rgba(255,255,255,0.12)]"></div>
                      <div className="absolute left-[10%] top-[54%] rounded-lg bg-[#0f172a]/90 px-3 py-2 text-xs shadow-lg">
                        <span className="block text-white">Bole</span>
                        <span className="text-indigo-300">24 spots</span>
                      </div>
                      <div className="absolute right-[9%] top-[12%] rounded-lg bg-white px-3 py-2 text-xs text-[#0f172a] shadow-lg">
                        <span className="block font-semibold">Piassa</span>
                        <span className="text-muted">Active</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl bg-white p-5 text-[#0f172a] shadow-card-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted">Occupancy</span>
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Healthy</span>
                      </div>
                      <div className="mt-5 flex items-end justify-between">
                        <p className="text-4xl font-bold">72%</p>
                        <div className="flex h-20 items-end gap-1.5">
                          {[44, 58, 39, 74, 66, 82].map((height) => (
                            <span key={height} className="w-3 rounded-t bg-primary" style={{ height: `${height}%` }}></span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/12 bg-white/10 p-5 backdrop-blur">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <span className="text-sm text-indigo-300">Today</span>
                        <span className="font-semibold">ETB 18.4k</span>
                      </div>
                      <div className="mt-4 space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Bookings</span>
                          <span>186</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Check-ins</span>
                          <span>143</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Open tickets</span>
                          <span>9</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative grid grid-cols-3 gap-3">
                  {[
                    ['Active spots', '318'],
                    ['Paid bookings', '94%'],
                    ['Avg rating', '4.8'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                      <p className="text-xs text-white/64">{label}</p>
                      <p className="mt-2 text-xl font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
        <Toast toasts={toasts} removeToast={removeToast} />
      </ToastContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout: handleLogout }}>
      <ToastContext.Provider value={{ addToast, removeToast }}>
        <SearchContext.Provider value={{ query: searchQuery, setQuery: setSearchQuery }}>
        <Layout onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/spots" element={<Spots />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/users" element={<Users />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/disputes" element={<Disputes />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/ratings" element={<Ratings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
        <Toast toasts={toasts} removeToast={removeToast} />
        </SearchContext.Provider>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}

export default App;
