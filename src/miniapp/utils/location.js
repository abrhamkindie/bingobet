/**
 * Cached geolocation helper — requests location once per session
 * and reuses the result to avoid repeated permission prompts.
 */

const DEFAULT_CENTER = [9.0054, 38.7636]; // Addis Ababa
const LOCATION_TIMEOUT_MS = 10000;

let cachedLocation = null;
let pendingRequest = null;

function isValidLatLng(lat, lng) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

function normalizeLocation(value) {
  const lat = Number(value?.latitude ?? value?.lat);
  const lng = Number(value?.longitude ?? value?.lng);
  return isValidLatLng(lat, lng) ? [lat, lng] : null;
}

function locationError(message = 'Location unavailable') {
  const err = new Error(message);
  err.code = 'LOCATION_UNAVAILABLE';
  return err;
}

function waitForLocationManagerInit(manager, timeoutMs) {
  if (!manager?.init || manager.isInited) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(locationError('Location manager timed out')), timeoutMs);
    try {
      manager.init(() => {
        clearTimeout(timer);
        resolve();
      });
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}

function waitForTelegramEvent(tg, eventName, timeoutMs) {
  if (!tg?.onEvent) return Promise.resolve();

  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      tg.offEvent?.(eventName, finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    try {
      tg.onEvent(eventName, finish);
    } catch {
      finish();
    }
  });
}

async function getTelegramLocation(timeoutMs) {
  const tg = window.Telegram?.WebApp;
  const manager = tg?.LocationManager;

  if (manager?.getLocation) {
    await waitForLocationManagerInit(manager, timeoutMs);
    if (manager.isLocationAvailable === false) {
      await waitForTelegramEvent(tg, 'locationManagerUpdated', Math.min(1200, timeoutMs));
    }
    if (manager.isLocationAvailable === false) {
      throw locationError('Telegram location is not available');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(locationError('Telegram location timed out')), timeoutMs);
      try {
        manager.getLocation((locationData) => {
          clearTimeout(timer);
          const location = normalizeLocation(locationData);
          if (location) resolve(location);
          else reject(locationError('Telegram location permission was not granted'));
        });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  if (typeof tg?.requestLocation === 'function') {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(locationError('Telegram location timed out')), timeoutMs);
      try {
        tg.requestLocation((first, second) => {
          clearTimeout(timer);
          const location = normalizeLocation(first) || normalizeLocation(second);
          if (location) resolve(location);
          else reject(locationError('Telegram location permission was not granted'));
        });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  throw locationError('Telegram location is not supported');
}

function getBrowserLocation({ timeoutMs, enableHighAccuracy }) {
  if (!navigator.geolocation) {
    return Promise.reject(locationError('Browser location is not supported'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = normalizeLocation(pos.coords);
        if (location) resolve(location);
        else reject(locationError());
      },
      (err) => reject(err || locationError()),
      { timeout: timeoutMs, enableHighAccuracy, maximumAge: 300000 }
    );
  });
}

/**
 * @returns {Promise<[number, number]>} [lat, lng]
 */
export function getUserLocation({
  force = false,
  allowFallback = !force,
  enableHighAccuracy = force,
  timeoutMs = LOCATION_TIMEOUT_MS,
  preferBrowser = force,
} = {}) {
  if (!force && cachedLocation) {
    return Promise.resolve(cachedLocation);
  }

  if (!force && pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    const browserFirst = async () => {
      try {
        cachedLocation = await getBrowserLocation({ timeoutMs, enableHighAccuracy });
        return cachedLocation;
      } catch {
        cachedLocation = await getTelegramLocation(timeoutMs);
        return cachedLocation;
      }
    };

    const telegramFirst = async () => {
      try {
        cachedLocation = await getTelegramLocation(timeoutMs);
        return cachedLocation;
      } catch {
        cachedLocation = await getBrowserLocation({ timeoutMs, enableHighAccuracy });
        return cachedLocation;
      }
    };

    try {
      return preferBrowser ? await browserFirst() : await telegramFirst();
    } catch (err) {
      if (allowFallback) return cachedLocation || DEFAULT_CENTER;
      throw err || locationError();
    } finally {
      if (!force) pendingRequest = null;
    }
  })();

  if (!force) pendingRequest = request;

  return request;
}

export function getCachedLocation() {
  return cachedLocation;
}

export { DEFAULT_CENTER };
