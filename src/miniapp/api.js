const BASE = '/api/miniapp';

function getInitData() {
  const tg = window.Telegram?.WebApp;
  return tg?.initData || '';
}

function isLocalDevHost() {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
}

async function request(path, { method = 'GET', body, params } = {}) {
  let url = BASE + path;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += '?' + qs;
  }

  const headers = { 'Content-Type': 'application/json' };
  const initData = getInitData();
  if (initData) {
    headers['Authorization'] = 'Bearer ' + initData;
  } else if (isLocalDevHost()) {
    headers['X-Telegram-User-Id'] = localStorage.getItem('betbingo_dev_tg_id') || '900000001';
  }

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json();
  if (!res.ok || !json.success) {
    const message = json.error?.message || json.error?.code || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json.data;
}

// Player
export const getPlayer = () => request('/player');

// Games
export const getGames = (params) => request('/games', { params });
export const getGame = (id) => request(`/games/${id}`);
export const getDrawnNumbers = (id) => request(`/games/${id}/drawn-numbers`);
export const getCompletedGames = () => request('/games/completed/list');

// Tickets
export const getTickets = (params) => request('/tickets', { params });
export const getTicket = (id) => request(`/tickets/${id}`);
export const buyTicket = (gameId) => request('/tickets', { method: 'POST', body: { gameId } });

// Wallet
export const getWallet = () => request('/wallet');
export const deposit = (amount) => request('/wallet/deposit', { method: 'POST', body: { amount } });
export const withdraw = (amount) => request('/wallet/withdraw', { method: 'POST', body: { amount } });

// Language
export const setLanguage = (lang) => request('/player/language', { method: 'POST', body: { language: lang } });

// Transactions
export const getTransactions = (params) => request('/transactions', { params });
