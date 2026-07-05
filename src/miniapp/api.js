/**
 * API client for the ParkAddis Mini App.
 * Sends Telegram initData with every request for authentication.
 */

const BASE = '/api/miniapp';

function getInitData() {
  const tg = window.Telegram?.WebApp;
  return tg?.initData || '';
}

function isLocalDevHost() {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
}

function cleanParams(params) {
  if (!params) return null;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
  );
}

async function request(path, { method = 'GET', body, params } = {}) {
  let url = BASE + path;
  const safeParams = cleanParams(params);
  if (safeParams) {
    const qs = new URLSearchParams(safeParams).toString();
    if (qs) url += '?' + qs;
  }

  const headers = { 'Content-Type': 'application/json' };
  const initData = getInitData();
  if (initData) {
    headers['Authorization'] = 'Bearer ' + initData;
  } else if (isLocalDevHost()) {
    headers['X-Telegram-User-Id'] = localStorage.getItem('parkaddis_dev_tg_id') || '900000001';
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    const message = json.error?.message || json.error?.code || json.error || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return json.data;
}

// ── User ──────────────────────────────────────────────────────────────
export const getUser = () => request('/user');
export const setLanguage = (language) => request('/user/language', { method: 'PUT', body: { language } });

// ── Spots ─────────────────────────────────────────────────────────────
export const getNearbySpots = (lat, lng, radius) =>
  request('/spots/nearby', { params: { lat, lng, radius } });
export const getMapSpots = ({ lat, lng, limit } = {}) =>
  request('/spots/map', { params: { lat, lng, limit } });
export const searchSpots = ({ q, lat, lng, limit } = {}) =>
  request('/spots/search', { params: { q, lat, lng, limit } });
export const getAreas = () => request('/areas');
export const getSpotsByArea = (key) => request(`/spots/area/${key}`);
export const getSpotDetail = (id) => request(`/spots/${id}`);
export const getSpotReviews = (spotId) => request(`/spots/${spotId}/reviews`);
export const getSpotAvailability = (spotId, params) => request(`/spots/${spotId}/availability`, { params });
export const reverseGeocode = (lat, lng) => request('/geo/reverse', { params: { lat, lng } });

// ── Bookings ──────────────────────────────────────────────────────────
export const getBookings = (params) => request('/bookings', { params });
export const getBookingDetail = (id) => request(`/bookings/${id}`);
export const createBooking = ({ spotId, startOffsetMin, hours, vehicleId }) =>
  request('/bookings', { method: 'POST', body: { spotId, startOffsetMin, hours, vehicleId } });
export const cancelBooking = (id) => request(`/bookings/${id}/cancel`, { method: 'POST' });
export const payBooking = (id, method = 'chapa') =>
  request(`/bookings/${id}/pay`, { method: 'POST', body: { method } });
export const checkBookingPayment = (id) =>
  request(`/bookings/${id}/payment/check`, { method: 'POST' });
export const getBookingQr = (id) => request(`/bookings/${id}/qr`);

// ── Vehicles ──────────────────────────────────────────────────────────
export const getVehicles = () => request('/vehicles');
export const createVehicle = (data) => request('/vehicles', { method: 'POST', body: data });
export const updateVehicle = (id, data) => request(`/vehicles/${id}`, { method: 'PUT', body: data });
export const deleteVehicle = (id) => request(`/vehicles/${id}`, { method: 'DELETE' });
export const setDefaultVehicle = (id) => request(`/vehicles/${id}/default`, { method: 'POST' });

// ── Favorites ─────────────────────────────────────────────────────────
export const getFavorites = () => request('/favorites');
export const addFavorite = (spotId) => request(`/favorites/${spotId}`, { method: 'POST' });
export const removeFavorite = (spotId) => request(`/favorites/${spotId}`, { method: 'DELETE' });

// ── Ratings ───────────────────────────────────────────────────────────
export const submitRating = (bookingId, score, comment) =>
  request('/ratings', { method: 'POST', body: { bookingId, score, comment } });
export const getUnratedBookings = () => request('/ratings/unrated');
export const getRatableBooking = (spotId) => request(`/spots/${spotId}/ratable-booking`);

// ── Host ──────────────────────────────────────────────────────────────
export const getHostSpots = () => request('/host/spots');
export const createHostSpot = (data) => request('/host/spots', { method: 'POST', body: data });
export const updateHostSpot = (id, data) => request(`/host/spots/${id}`, { method: 'PUT', body: data });
export const deleteHostSpot = (id) => request(`/host/spots/${id}`, { method: 'DELETE' });
export const getHostSpotBookings = (spotId) => request(`/host/spots/${spotId}/bookings`);
export const getHostRevenueReport = (params) => request('/host/reports/revenue', { params });
export const getHostBookingHistory = (params) => request('/host/bookings', { params });
export const getHostManagers = () => request('/host/managers');
export const assignHostManager = (data) => request('/host/managers', { method: 'POST', body: data });
export const updateHostManager = (id, data) => request(`/host/managers/${id}`, { method: 'PUT', body: data });
export const removeHostManager = (id) => request(`/host/managers/${id}`, { method: 'DELETE' });
export const checkinByQrToken = (token) => request('/host/checkin', { method: 'POST', body: { token } });
export const checkinByCode = (confirmationCode) =>
  request('/host/checkin', { method: 'POST', body: { confirmationCode } });
export const checkinBooking = (bookingId) => request(`/host/bookings/${bookingId}/checkin`, { method: 'POST' });
export const completeBooking = (bookingId) => request(`/host/bookings/${bookingId}/complete`, { method: 'POST' });

// ── Help ──────────────────────────────────────────────────────────────
export const getHelp = () => request('/help');
export const getSupportTickets = (limit = 5) => request('/support/tickets', { params: { limit } });
export const createSupportTicket = (data) => request('/support/tickets', { method: 'POST', body: data });

// ── Admin ─────────────────────────────────────────────────────────────
export const getAdminWorkspace = () => request('/admin/workspace');
export const getAdminOverview = () => request('/admin/overview');
export const getAdminReport = (params) => request('/admin/reports', { params });
export const getAdminSpots = (params) => request('/admin/spots', { params });
export const approveAdminSpot = (id) => request(`/admin/spots/${id}/approve`, { method: 'POST' });
export const rejectAdminSpot = (id, reason) => request(`/admin/spots/${id}/reject`, { method: 'POST', body: { reason } });
export const suspendAdminSpot = (id) => request(`/admin/spots/${id}/suspend`, { method: 'POST' });
export const reactivateAdminSpot = (id) => request(`/admin/spots/${id}/reactivate`, { method: 'POST' });
export const getAdminTickets = (params) => request('/admin/tickets', { params });
export const getAdminTicket = (id) => request(`/admin/tickets/${id}`);
export const updateAdminTicketStatus = (id, status, adminNotes) =>
  request(`/admin/tickets/${id}/status`, { method: 'POST', body: { status, adminNotes } });
export const replyAdminTicket = (id, message) => request(`/admin/tickets/${id}/reply`, { method: 'POST', body: { message } });
export const getAdminBookings = (params) => request('/admin/bookings', { params });
export const cancelAdminBooking = (id, reason) => request(`/admin/bookings/${id}/cancel`, { method: 'POST', body: { reason } });
export const getAdminUsers = (params) => request('/admin/users', { params });
export const banAdminUser = (id, reason) => request(`/admin/users/${id}/ban`, { method: 'POST', body: { reason } });
export const unbanAdminUser = (id) => request(`/admin/users/${id}/unban`, { method: 'POST' });
export const setAdminUserRole = (id, role) => request(`/admin/users/${id}/role`, { method: 'PUT', body: { role } });
export const getAdminPayments = (params) => request('/admin/payments', { params });
export const getAdminPayment = (id) => request(`/admin/payments/${id}`);
export const refundAdminPayment = (id) => request(`/admin/payments/${id}/refund`, { method: 'POST' });
export const getAdminBalances = () => request('/admin/finance/balances');
export const createAdminPayout = (hostId, amount, note) =>
  request('/admin/finance/payouts', { method: 'POST', body: { hostId, amount, note } });
export const markAdminPayoutSent = (id) => request(`/admin/finance/payouts/${id}/sent`, { method: 'POST' });
export const getAdminDisputes = (params) => request('/admin/disputes', { params });
export const resolveAdminDispute = (id, resolution) =>
  request(`/admin/disputes/${id}/resolve`, { method: 'POST', body: { resolution } });
export const rejectAdminDispute = (id, resolution) =>
  request(`/admin/disputes/${id}/reject`, { method: 'POST', body: { resolution } });
