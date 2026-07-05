/**
 * @file Google Maps integration service.
 *
 * Provides road-distance calculation using the Google Maps Distance Matrix API.
 * Falls back gracefully when no API key is configured.
 *
 * @module services/googleMaps
 */

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { directionsUrl } from '../utils/maps.js';

const DISTANCE_MATRIX_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json';

/**
 * Check whether a Google Maps API key is available.
 * @returns {boolean}
 */
export function hasMapsApiKey() {
  return Boolean(config.googleMaps?.apiKey);
}

/**
 * Fetch road distances from one origin to multiple destinations using the
 * Google Maps Distance Matrix API.
 *
 * @param {object} options
 * @param {number} options.originLat  - Origin latitude
 * @param {number} options.originLng  - Origin longitude
 * @param {Array<{lat: number, lng: number, index: number}>} options.destinations
 *        Each destination must have `lat`, `lng`, and the original `index` in the
 *        source array so results can be mapped back.
 * @param {'driving'|'walking'} [options.mode='driving'] - Travel mode
 * @returns {Promise<Array<{index: number, distance_m: number|null, duration_s: number|null}>>}
 *          Results in the same order as `destinations`, with `distance_m` set to
 *          the road distance in meters (or null if the element failed).
 */
export async function getRoadDistances({ originLat, originLng, destinations, mode = 'driving' }) {
  if (!hasMapsApiKey() || destinations.length === 0) {
    return destinations.map((d) => ({ index: d.index, distance_m: null, duration_s: null }));
  }

  const origin = `${originLat},${originLng}`;
  const dests = destinations.map((d) => `${d.lat},${d.lng}`);

  // Split into batches of 25 (API limit per request)
  const BATCH_SIZE = 25;
  const batches = [];
  for (let i = 0; i < dests.length; i += BATCH_SIZE) {
    batches.push(dests.slice(i, i + BATCH_SIZE));
  }

  const results = [];

  for (const batch of batches) {
    const params = new URLSearchParams({
      origins: origin,
      destinations: batch.join('|'),
      mode,
      key: config.googleMaps.apiKey,
    });

    try {
      const response = await fetch(`${DISTANCE_MATRIX_URL}?${params}`, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        logger.warn('Google Maps Distance Matrix API returned error', {
          status: response.status,
        });
        batch.forEach(() => results.push({ distance_m: null, duration_s: null }));
        continue;
      }

      const data = await response.json();

      if (data.status !== 'OK') {
        logger.warn('Google Maps Distance Matrix non-OK status', {
          status: data.status,
          errorMessage: data.error_message,
        });
        batch.forEach(() => results.push({ distance_m: null, duration_s: null }));
        continue;
      }

      const elements = data.rows?.[0]?.elements || [];
      elements.forEach((el) => {
        if (el.status === 'OK' && el.distance?.value != null) {
          results.push({
            distance_m: el.distance.value,
            duration_s: el.duration?.value ?? null,
          });
        } else {
          results.push({ distance_m: null, duration_s: null });
        }
      });
    } catch (err) {
      logger.warn('Google Maps Distance Matrix request failed', {
        error: err.message,
      });
      batch.forEach(() => results.push({ distance_m: null, duration_s: null }));
    }
  }

  // Map back to original destination indices
  return results.map((r, i) => ({
    index: destinations[i]?.index ?? i,
    distance_m: r.distance_m,
    duration_s: r.duration_s,
  }));
}

export { directionsUrl };
