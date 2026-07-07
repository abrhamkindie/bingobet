const BASE = '/api/miniapp';
const TIMEOUT_MS = 15000;

/** Error that carries the backend error `code` so screens can branch reliably. */
export class ApiError extends Error {
  constructor(code, message, status, details) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getInitData() {
  const tg = window.Telegram?.WebApp;
  return tg?.initData || '';
}

/** Telegram start param (used for referral capture: `ref_<code>`). */
export function getStartParam() {
  const tg = window.Telegram?.WebApp;
  return tg?.initDataUnsafe?.start_param || null;
}

function isLocalDevHost() {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
}

async function request(path, { method = 'GET', body, params, timeout = TIMEOUT_MS } = {}) {
  let url = BASE + path;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += '?' + qs;
  }

  const headers = { 'Content-Type': 'application/json' };
  const initData = getInitData();
  if (initData) {
    headers['Authorization'] = 'Bearer ' + initData;
  } else if (isLocalDevHost()) {
    headers['X-Telegram-User-Id'] = localStorage.getItem('betbingo_dev_tg_id') || '900000001';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('TIMEOUT', 'Request timed out. Check your connection.', 0);
    }
    throw new ApiError('NETWORK', 'No connection. Please try again.', 0);
  } finally {
    clearTimeout(timer);
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    if (!res.ok) throw new ApiError('SERVER', `Server error (${res.status})`, res.status);
    throw new ApiError('BAD_RESPONSE', 'Unexpected server response', res.status);
  }

  if (!res.ok || !json.success) {
    const code = json?.error?.code || `HTTP_${res.status}`;
    const message = json?.error?.message || 'Something went wrong';
    throw new ApiError(code, message, res.status, json?.error?.details);
  }
  return json.data;
}

// ── Player ──────────────────────────────────────────────
export const getPlayer = () => {
  const startParam = getStartParam();
  return request('/player', startParam ? { params: { start_param: startParam } } : undefined);
};

// ── Games ───────────────────────────────────────────────
export const getGames = (params) => request('/games', { params });
export const getGame = (id) => request(`/games/${id}`);
export const getDrawnNumbers = (id) => request(`/games/${id}/drawn-numbers`);
export const getCompletedGames = () => request('/games/completed/list');

// ── Instant games (Keno + Spin) ─────────────────────────
export const getInstantConfig = () => request('/games/instant/config');
export const getInstantHistory = (gameType) => request('/games/instant/history', { params: gameType ? { game_type: gameType } : undefined });
export const playKeno = (stake, picks) => request('/games/keno/play', { method: 'POST', body: { stake, picks } });
export const playSpin = (stake) => request('/games/spin/play', { method: 'POST', body: { stake } });

// ── Roulette ────────────────────────────────────────────
export const getRouletteBetTypes = () => request('/games/roulette/bet-types');
export const playRoulette = (bets, stakePerBet) => request('/games/roulette/play', { method: 'POST', body: { bets, stakePerBet } });

// ── Tickets ─────────────────────────────────────────────
export const getTickets = (params) => request('/tickets', { params });
export const getTicket = (id) => request(`/tickets/${id}`);
export const buyTicket = (gameId) => request('/tickets', { method: 'POST', body: { gameId } });

// ── Wallet ──────────────────────────────────────────────
export const getWallet = () => request('/wallet');
export const deposit = (amount) => request('/wallet/deposit', { method: 'POST', body: { amount } });
export const withdraw = (amount) => request('/wallet/withdraw', { method: 'POST', body: { amount } });

// ── Daily reward ────────────────────────────────────────
export const getDaily = () => request('/player/daily');
export const claimDaily = () => request('/player/daily/claim', { method: 'POST' });

// ── Referrals ───────────────────────────────────────────
export const getReferrals = () => request('/player/referrals');

// ── Leaderboard ─────────────────────────────────────────
export const getLeaderboard = (period = 'all') => request('/leaderboard', { params: { period } });

// ── Language ────────────────────────────────────────────
export const setLanguage = (lang) => request('/player/language', { method: 'POST', body: { language: lang } });

// ── Transactions ────────────────────────────────────────
export const getTransactions = (params) => request('/transactions', { params });
