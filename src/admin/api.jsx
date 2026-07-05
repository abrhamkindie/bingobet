/**
 * Admin Dashboard API Client
 *
 * Handles JWT authentication and provides typed methods for all
 * admin REST endpoints.
 */
const TOKEN_KEY = 'parkaddis_admin_token';
const USER_KEY = 'parkaddis_admin_user';

// ── Token Management ────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch { return null; }
}

function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isAuthenticated() {
  return !!getToken();
}

// ── HTTP Client ─────────────────────────────────────────────────────────

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(path, opts);
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      window.location.reload();
      throw new Error('Session expired — please login again');
    }

    const err = new Error(
      (data.error && data.error.message) ||
      (data.message) ||
      `Request failed (${res.status})`
    );
    err.status = res.status;
    err.code = data.error && data.error.code;
    err.data = data;
    throw err;
  }

  return data;
}

function buildQuery(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? '?' + s : '';
}

// ── Auth ────────────────────────────────────────────────────────────────

export async function login(email, password) {
  const data = await request('POST', '/api/admin/login', { email, password });
  const payload = data.data || data;
  setToken(payload.token);
  setUser(payload.admin);
  return payload;
}

export function logout() {
  clearToken();
}

// ── Analytics ──────────────────────────────────────────────────────────

export async function getAnalyticsOverview() {
  const data = await request('GET', '/api/admin/analytics/overview');
  return data.data || data;
}

export async function getAnalyticsRevenue(period) {
  const q = period ? '?period=' + period : '';
  const data = await request('GET', '/api/admin/analytics/revenue' + q);
  return data.data || data;
}

export async function getAnalyticsBookings() {
  const data = await request('GET', '/api/admin/analytics/bookings');
  return data.data || data;
}

export async function getTopSpots(limit) {
  const data = await request('GET', '/api/admin/analytics/top-spots' + buildQuery({ limit }));
  return data.data || data;
}

export async function getRecentActivity(limit) {
  const data = await request('GET', '/api/admin/analytics/activity' + buildQuery({ limit }));
  return data.data || data;
}

export async function getBotUsageAnalytics(days) {
  const data = await request('GET', '/api/admin/analytics/bot-usage' + buildQuery({ days }));
  return data.data || data;
}

// ── Spots ───────────────────────────────────────────────────────────────

export async function listSpots(params) {
  const data = await request('GET', '/api/admin/spots' + buildQuery(params));
  return { items: data.data || data, pagination: data.pagination };
}

export async function getSpot(id) {
  const data = await request('GET', '/api/admin/spots/' + id);
  return data.data || data;
}

export async function approveSpot(id) {
  const data = await request('POST', '/api/admin/spots/' + id + '/approve');
  return data.data || data;
}

export async function rejectSpot(id, reason) {
  const data = await request('POST', '/api/admin/spots/' + id + '/reject', { reason });
  return data.data || data;
}

export async function suspendSpot(id) {
  const data = await request('POST', '/api/admin/spots/' + id + '/suspend');
  return data.data || data;
}

export async function updateSpotPrice(id, price) {
  const data = await request('PUT', '/api/admin/spots/' + id + '/price', { price });
  return data.data || data;
}

export async function createSpot(body) {
  const data = await request('POST', '/api/admin/spots', body);
  return data.data || data;
}

export async function updateSpot(id, body) {
  const data = await request('PUT', '/api/admin/spots/' + id, body);
  return data.data || data;
}

// ── Bookings ────────────────────────────────────────────────────────────

export async function listBookings(params) {
  const data = await request('GET', '/api/admin/bookings' + buildQuery(params));
  return { items: data.data || data, pagination: data.pagination };
}

export async function getBooking(id) {
  const data = await request('GET', '/api/admin/bookings/' + id);
  return data.data || data;
}

export async function cancelBooking(id, reason) {
  const data = await request('POST', '/api/admin/bookings/' + id + '/cancel', { reason });
  return data.data || data;
}

export async function createBooking(body) {
  const data = await request('POST', '/api/admin/bookings', body);
  return data.data || data;
}

export async function updateBooking(id, body) {
  const data = await request('PUT', '/api/admin/bookings/' + id, body);
  return data.data || data;
}

// ── Users ───────────────────────────────────────────────────────────────

export async function listUsers(params) {
  const data = await request('GET', '/api/admin/users' + buildQuery(params));
  return { items: data.data || data, pagination: data.pagination };
}

export async function getUserDetail(id) {
  const data = await request('GET', '/api/admin/users/' + id);
  return data.data || data;
}

export async function banUser(id, reason) {
  const data = await request('POST', '/api/admin/users/' + id + '/ban', { reason });
  return data.data || data;
}

export async function unbanUser(id) {
  const data = await request('POST', '/api/admin/users/' + id + '/unban');
  return data.data || data;
}

export async function setUserRole(id, role) {
  const data = await request('PUT', '/api/admin/users/' + id + '/role', { role });
  return data.data || data;
}

export async function createUser(body) {
  const data = await request('POST', '/api/admin/users', body);
  return data.data || data;
}

export async function updateUser(id, body) {
  const data = await request('PUT', '/api/admin/users/' + id, body);
  return data.data || data;
}

// ── Payments ────────────────────────────────────────────────────────────

export async function listPayments(params) {
  const data = await request('GET', '/api/admin/payments' + buildQuery(params));
  return { items: data.data || data, pagination: data.pagination };
}

export async function refundPayment(id) {
  const data = await request('POST', '/api/admin/payments/' + id + '/refund');
  return data.data || data;
}

// ── Finance ─────────────────────────────────────────────────────────────

export async function getBalances() {
  const data = await request('GET', '/api/admin/finance/balances');
  return data.data || data;
}

export async function createPayout(hostId, amount, note) {
  const data = await request('POST', '/api/admin/finance/payouts', { hostId, amount, note });
  return data.data || data;
}

export async function markPayoutSent(id) {
  const data = await request('POST', '/api/admin/finance/payouts/' + id + '/sent');
  return data.data || data;
}

// ── Disputes ────────────────────────────────────────────────────────────

export async function listDisputes(params) {
  const data = await request('GET', '/api/admin/disputes' + buildQuery(params));
  return { items: data.data || data, pagination: data.pagination };
}

export async function getDispute(id) {
  const data = await request('GET', '/api/admin/disputes/' + id);
  return data.data || data;
}

export async function resolveDispute(id, resolution) {
  const data = await request('POST', '/api/admin/disputes/' + id + '/resolve', { resolution });
  return data.data || data;
}

// ── Support Tickets ─────────────────────────────────────────────────────

export async function listTickets(params) {
  const data = await request('GET', '/api/admin/tickets' + buildQuery(params));
  return { items: data.data || data, pagination: data.pagination };
}

export async function getTicket(id) {
  const data = await request('GET', '/api/admin/tickets/' + id);
  return data.data || data;
}

export async function assignTicket(id, adminId) {
  const data = await request('POST', '/api/admin/tickets/' + id + '/assign', { adminId });
  return data.data || data;
}

export async function updateTicketStatus(id, status, adminNotes) {
  const data = await request('POST', '/api/admin/tickets/' + id + '/status', { status, adminNotes });
  return data.data || data;
}

export async function replyToTicket(id, message) {
  const data = await request('POST', '/api/admin/tickets/' + id + '/reply', { message });
  return data.data || data;
}

// ── Ratings ─────────────────────────────────────────────────────────────

export async function listRatings(params) {
  const data = await request('GET', '/api/admin/ratings' + buildQuery(params));
  return { items: data.data || data, pagination: data.pagination };
}

export async function deleteRating(id) {
  const data = await request('DELETE', '/api/admin/ratings/' + id);
  return data.data || data;
}
