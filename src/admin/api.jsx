const API_BASE = '/api/admin';
const TOKEN_KEY = 'betbingo_admin_token';
const USER_KEY = 'betbingo_admin_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function saveAuth(token, admin) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(admin));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || json.error?.code || `HTTP ${res.status}`);
  }
  return json.data;
}

// Auth
export const login = async (email, password) => {
  const data = await request('/login', { method: 'POST', body: { email, password } });
  saveAuth(data.token, data.admin);
  return data;
};

export const register = (data) => request('/register', { method: 'POST', body: data });

// Dashboard
export const getOverview = () => request('/dashboard/overview');

// Games
export const getGames = (params) => request('/games', { params });
export const getGame = (id) => request(`/games/${id}`);
export const createGame = (data) => request('/games', { method: 'POST', body: data });
export const drawGame = (id) => request(`/games/${id}/draw`, { method: 'POST' });

// Players
export const getPlayers = (params) => request('/players', { params });
export const banPlayer = (id) => request(`/players/${id}/ban`, { method: 'POST' });
export const unbanPlayer = (id) => request(`/players/${id}/unban`, { method: 'POST' });

// Transactions
export const getTransactions = (params) => request('/transactions', { params });
