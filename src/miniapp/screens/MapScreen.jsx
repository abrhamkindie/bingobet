import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../App.jsx';
import * as api from '../api.js';
import Icon from '../components/Icons.jsx';
import { getUserLocation, DEFAULT_CENTER } from '../utils/location.js';

const NEARBY_RADIUS_M = 2000;
const ALL_SPOTS_FALLBACK_RADIUS_M = 100000;
const ALL_SPOTS_LIMIT = 250;
const SEARCH_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 350;
const TILE_ERROR_FALLBACK_THRESHOLD = 3;
const MAP_TILE_LAYERS = [
  {
    name: 'osm',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
    },
  },
  {
    name: 'street',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      maxZoom: 20,
      subdomains: 'abcd',
    },
  },
];

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeSpot(spot) {
  const source = spot || {};
  const lat = toFiniteNumber(source.lat ?? source.latitude);
  const lng = toFiniteNumber(source.lng ?? source.lon ?? source.longitude);
  return { ...source, lat, lng };
}

function isValidLatLng(lat, lng) {
  return (
    Number.isFinite(lat) &&
    lat >= -90 && lat <= 90 &&
    Number.isFinite(lng) &&
    lng >= -180 && lng <= 180
  );
}

function parseInitialLocation() {
  const params = new URLSearchParams(window.location.search);
  const lat = toFiniteNumber(params.get('lat'));
  const lng = toFiniteNumber(params.get('lng'));
  return isValidLatLng(lat, lng) ? [lat, lng] : null;
}

function fmtDistance(meters) {
  const number = Number(meters);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number >= 1000 ? `${(number / 1000).toFixed(1)} km` : `${Math.round(number)} m`;
}

// Great-circle distance in metres between two [lat, lng] points.
function haversineMeters(from, to) {
  if (!from || !to) return null;
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function fmtMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('en-US') : '0';
}

function openExternalUrl(url) {
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) {
    tg.openLink(url);
    return;
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) window.location.href = url;
}

function googleMapsDirectionsUrl(origin, spot) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', `${spot.lat},${spot.lng}`);
  url.searchParams.set('travelmode', 'driving');
  if (isValidLatLng(origin?.[0], origin?.[1])) {
    url.searchParams.set('origin', `${origin[0]},${origin[1]}`);
  }
  return url.toString();
}


function tileSeed(coords, salt = 0) {
  let value = ((coords.x * 73856093) ^ (coords.y * 19349663) ^ (coords.z * 83492791) ^ salt) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

function createLocalMapTile(coords) {
  const tile = document.createElement('canvas');
  const size = 256;
  tile.width = size;
  tile.height = size;
  tile.style.width = `${size}px`;
  tile.style.height = `${size}px`;

  const ctx = tile.getContext('2d');
  if (!ctx) return tile;

  ctx.fillStyle = '#edf3f4';
  ctx.fillRect(0, 0, size, size);

  const seed = tileSeed(coords);
  const parkX = 28 + (seed % 132);
  const parkY = 24 + ((seed >>> 4) % 130);
  const parkW = 64 + (seed % 34);
  const parkH = 42 + ((seed >>> 8) % 28);
  const radius = 16;
  ctx.fillStyle = 'rgba(167, 205, 178, 0.32)';
  ctx.beginPath();
  ctx.moveTo(parkX + radius, parkY);
  ctx.lineTo(parkX + parkW - radius, parkY);
  ctx.quadraticCurveTo(parkX + parkW, parkY, parkX + parkW, parkY + radius);
  ctx.lineTo(parkX + parkW, parkY + parkH - radius);
  ctx.quadraticCurveTo(parkX + parkW, parkY + parkH, parkX + parkW - radius, parkY + parkH);
  ctx.lineTo(parkX + radius, parkY + parkH);
  ctx.quadraticCurveTo(parkX, parkY + parkH, parkX, parkY + parkH - radius);
  ctx.lineTo(parkX, parkY + radius);
  ctx.quadraticCurveTo(parkX, parkY, parkX + radius, parkY);
  ctx.fill();

  ctx.strokeStyle = '#d4e0e3';
  ctx.lineWidth = 1;
  for (let i = -64; i < size + 96; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i + ((coords.y % 2) * 16), 0);
    ctx.lineTo(i - 36 + ((coords.y % 2) * 16), size);
    ctx.stroke();
  }
  for (let i = -32; i < size + 64; i += 56) {
    ctx.beginPath();
    ctx.moveTo(0, i + ((coords.x % 2) * 12));
    ctx.lineTo(size, i - 20 + ((coords.x % 2) * 12));
    ctx.stroke();
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const drawRoad = (points, width) => {
    ctx.strokeStyle = '#c2d0d5';
    ctx.lineWidth = width + 3;
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.strokeStyle = '#fffdf7';
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  drawRoad([
    [-28, 154 + (seed % 28)],
    [70, 126 + ((seed >>> 5) % 18)],
    [154, 138 + ((seed >>> 9) % 22)],
    [284, 102 + ((seed >>> 13) % 26)],
  ], 10);

  drawRoad([
    [74 + ((seed >>> 2) % 18), -24],
    [98 + ((seed >>> 6) % 22), 84],
    [90 + ((seed >>> 10) % 26), 172],
    [126 + ((seed >>> 14) % 18), 284],
  ], 8);

  ctx.fillStyle = '#9fb3ba';
  for (let i = 0; i < 8; i += 1) {
    const dotSeed = tileSeed(coords, i + 17);
    ctx.beginPath();
    ctx.arc(18 + (dotSeed % 220), 18 + ((dotSeed >>> 8) % 220), 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  return tile;
}

export default function MapScreen({ active = true, navigate, locationRequest = null, requestLocation = null, focusSpot = null }) {
  const { addToast } = useToast();
  const mapContainerRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);
  const userLocationRef = useRef(null);
  const routeLayerRef = useRef(null);
  const fallbackLayerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const tileErrorCountRef = useRef(0);
  const tileFallbackRef = useRef(false);
  const initStarted = useRef(false);
  const initialLocationRef = useRef(parseInitialLocation());
  const bootRequestRef = useRef(0);
  const handledLocationRequestRef = useRef(null);
  const focusHandledRef = useRef(null);
  const pendingFocusRef = useRef(null);
  const startupLocationRetryRef = useRef(0);
  const lastBrowseModeRef = useRef('nearby');
  const searchRequestRef = useRef(0);

  const [spots, setSpots] = useState([]);
  const [highlightSpotId, setHighlightSpotId] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [mapMode, setMapMode] = useState('nearby');
  const [searchQuery, setSearchQuery] = useState('');
  const [emptyMessage, setEmptyMessage] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locatingUser, setLocatingUser] = useState(false);
  const [showBookingSheet, setShowBookingSheet] = useState(false);
  const [bookingHours, setBookingHours] = useState(1);
  const [bookingOffset, setBookingOffset] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [spotDetail, setSpotDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bookingAvailability, setBookingAvailability] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeError, setRouteError] = useState(null);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(null);
  const [tilesReady, setTilesReady] = useState(true);
  const [tileMessage, setTileMessage] = useState('');
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [favoritePending, setFavoritePending] = useState(false);
  const [ratableBooking, setRatableBooking] = useState(null);
  const [showRating, setShowRating] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);

  const [ratingComment, setRatingComment] = useState('');
  const [bookingStartDate, setBookingStartDate] = useState(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [ratingLoading, setRatingLoading] = useState(false);

  const displaySpot = spotDetail?.spot ? { ...selectedSpot, ...spotDetail.spot } : selectedSpot;
  const availableSpaces = spotDetail?.availability?.available_spaces ?? displaySpot?.available_spaces ?? displaySpot?.capacity ?? 1;
  const totalSpaces = spotDetail?.availability?.capacity ?? displaySpot?.capacity ?? 1;
  const isFull = availableSpaces <= 0;
  // Prefer a live client-side distance (user location → spot) so the detail
  // merge can never blank it out or show a bogus 0 m.
  const liveDistanceM = haversineMeters(userLocation, [displaySpot?.lat, displaySpot?.lng]);
  const distanceM = liveDistanceM ?? displaySpot?.distance_m ?? null;

  const clearRoute = useCallback(() => {
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    setRouteInfo(null);
    setRouteError(null);
    setGoogleMapsUrl(null);
    setRouteLoading(false);
  }, []);

  const updateUserMarker = useCallback((latlng) => {
    if (!window.L || !mapInstance.current || !isValidLatLng(latlng?.[0], latlng?.[1])) return;

    const userIcon = window.L.divIcon({
      html: `<div style="width:20px;height:20px;background:linear-gradient(135deg,#2563eb,#0ea5e9);border:3px solid white;border-radius:50%;box-shadow:0 2px 10px rgba(37,99,235,0.55),0 0 0 4px rgba(14,165,233,0.18)"></div>`,
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(latlng);
    } else {
      userMarkerRef.current = window.L.marker(latlng, { icon: userIcon, zIndexOffset: 1000 })
        .addTo(mapInstance.current)
        .bindTooltip('Your location', { direction: 'top', offset: [0, -10] });
    }
  }, []);

  const setCurrentLocation = useCallback((latlng) => {
    if (!isValidLatLng(latlng?.[0], latlng?.[1])) return;
    setUserLocation(latlng);
    userLocationRef.current = latlng;
    updateUserMarker(latlng);
  }, [updateUserMarker]);

  const createSpotIcon = useCallback((highlight = false) => {
    if (!window.L) return null;
    const pin = `<div style="width:38px;height:38px;background:linear-gradient(135deg,#06b6d4,#0891b2);border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 3px 14px rgba(6,182,212,0.7),0 0 0 3px rgba(6,182,212,0.15);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-size:15px;font-weight:bold">P</span></div>`;
    return window.L.divIcon({
      // When highlighted, wrap the pin so it pulses to draw the eye to the spot
      // the user just tapped in Home's Nearby list.
      html: highlight ? `<div class="spot-pin-blink">${pin}</div>` : pin,
      className: '',
      iconSize: [38, 38],
      iconAnchor: [19, 38],
    });
  }, []);

  const fitToVisible = useCallback((spotsList, { includeUser = true } = {}) => {
    const map = mapInstance.current;
    if (!map || !window.L) return;

    const bounds = [];
    const currentLocation = userLocationRef.current;
    if (includeUser && isValidLatLng(currentLocation?.[0], currentLocation?.[1])) {
      bounds.push(currentLocation);
    }

    spotsList.forEach((spot) => {
      if (isValidLatLng(spot.lat, spot.lng)) bounds.push([spot.lat, spot.lng]);
    });

    if (!bounds.length) {
      if (isValidLatLng(currentLocation?.[0], currentLocation?.[1])) {
        map.setView(currentLocation, 15, { animate: false });
      }
      return;
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], Math.max(map.getZoom(), 15), { animate: false });
      return;
    }

    map.fitBounds(bounds, {
      paddingTopLeft: [40, 132],
      paddingBottomRight: [40, 210],
      maxZoom: 16,
      animate: false,
    });
  }, []);

  const renderMarkers = useCallback((spotsList, options = {}) => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    const map = mapInstance.current;
    if (!map || !window.L) return;

    spotsList.forEach((spot) => {
      if (!isValidLatLng(spot.lat, spot.lng)) return;
      const isHighlighted = highlightSpotId != null && String(spot.id) === String(highlightSpotId);
      const marker = window.L.marker([spot.lat, spot.lng], {
        icon: createSpotIcon(isHighlighted),
        keyboard: true,
        zIndexOffset: isHighlighted ? 900 : 0,
      })
        .addTo(map)
        .on('click', (e) => {
          if (e.originalEvent) window.L.DomEvent.stopPropagation(e.originalEvent);
          setHighlightSpotId(null);
          clearRoute();
          setSelectedSpot(spot);
          setSpotDetail(null);
          setShowDetail(true);
          setShowBookingSheet(false);
        });
      markersRef.current.push(marker);
    });

    if (options.fit !== false) {
      fitToVisible(spotsList, { includeUser: options.includeUser !== false });
    }
  }, [clearRoute, createSpotIcon, fitToVisible, highlightSpotId]);

  const normalizeSpots = useCallback((incoming) => (
    (incoming || [])
      .map(normalizeSpot)
      .filter(spot => isValidLatLng(spot.lat, spot.lng))
  ), []);

  const applySpots = useCallback((incoming, options = {}) => {
    const list = normalizeSpots(incoming);
    setSpots(list);
    renderMarkers(list, options);
    return list;
  }, [normalizeSpots, renderMarkers]);

  const loadNearby = useCallback(async (latlng = userLocationRef.current, options = {}) => {
    if (!isValidLatLng(latlng?.[0], latlng?.[1])) return [];
    setLoading(true);
    setEmptyMessage('');
    setMapMode('nearby');
    lastBrowseModeRef.current = 'nearby';
    clearRoute();
    try {
      const data = await api.getNearbySpots(latlng[0], latlng[1], NEARBY_RADIUS_M);
      const list = applySpots(data.spots, options);
      if (!list.length && options.toast !== false) {
        setEmptyMessage('No host spots within 2 km.');
        addToast('No host spots within 2 km. Try All spots or search.', 'info');
      }
      return list;
    } catch (err) {
      console.error('Failed to load nearby spots:', err);
      addToast('Failed to load nearby spots', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [addToast, applySpots, clearRoute]);

  const loadAllSpots = useCallback(async (options = {}) => {
    const center = userLocationRef.current;
    setLoading(true);
    setEmptyMessage('');
    setMapMode('all');
    lastBrowseModeRef.current = 'all';
    clearRoute();
    try {
      let data;
      try {
        data = await api.getMapSpots({
          lat: isValidLatLng(center?.[0], center?.[1]) ? center[0] : undefined,
          lng: isValidLatLng(center?.[0], center?.[1]) ? center[1] : undefined,
          limit: ALL_SPOTS_LIMIT,
        });
      } catch (err) {
        if (!isValidLatLng(center?.[0], center?.[1])) throw err;
        console.warn('All spots endpoint failed, falling back to wide nearby search:', err);
        data = await api.getNearbySpots(center[0], center[1], ALL_SPOTS_FALLBACK_RADIUS_M);
      }
      const list = applySpots(data.spots, options);
      if (!list.length) {
        setEmptyMessage('No active host spots are available yet.');
        addToast('No active host spots are available yet', 'info');
      }
      return list;
    } catch (err) {
      console.error('Failed to load all spots:', err);
      addToast('Failed to load host spots', 'error');
      return [];
    } finally {
      setLoading(false);
    }
  }, [addToast, applySpots, clearRoute]);

  const loadSearchResults = useCallback(async (query, { silent = false } = {}) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const center = userLocationRef.current;
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setSearchLoading(true);
    setLoading(true);
    setMapMode('search');
    setEmptyMessage('');
    clearRoute();
    try {
      let data;
      try {
        data = await api.searchSpots({
          q: trimmed,
          lat: isValidLatLng(center?.[0], center?.[1]) ? center[0] : undefined,
          lng: isValidLatLng(center?.[0], center?.[1]) ? center[1] : undefined,
          limit: SEARCH_LIMIT,
        });
      } catch (err) {
        console.warn('Search endpoint failed, falling back to local map results:', err);
        const fallback = await api.getMapSpots({
          lat: isValidLatLng(center?.[0], center?.[1]) ? center[0] : undefined,
          lng: isValidLatLng(center?.[0], center?.[1]) ? center[1] : undefined,
          limit: ALL_SPOTS_LIMIT,
        });
        const q = trimmed.toLowerCase();
        data = {
          spots: (fallback.spots || []).filter((spot) => (
            `${spot.address || ''} ${spot.access_instructions || ''}`.toLowerCase().includes(q)
          )),
        };
      }
      if (requestId !== searchRequestRef.current) return;
      const list = applySpots(data.spots);
      if (!list.length) {
        setEmptyMessage(`No spots found for "${trimmed}".`);
        if (!silent) addToast('No spots match your search', 'info');
      }
    } catch (err) {
      if (requestId !== searchRequestRef.current) return;
      console.error('Spot search failed:', err);
      setEmptyMessage('Search is unavailable right now. Try another area or use All spots.');
      if (!silent) addToast('Search is unavailable right now', 'info');
    } finally {
      if (requestId === searchRequestRef.current) {
        setLoading(false);
        setSearchLoading(false);
      }
    }
  }, [addToast, applySpots, clearRoute]);

  const addTileLayer = useCallback((map, layerIndex = 0) => {
    if (!window.L || !map) return null;

    const config = MAP_TILE_LAYERS[layerIndex] || MAP_TILE_LAYERS[0];
    const layer = window.L.tileLayer(config.url, {
      ...config.options,
      updateWhenIdle: true,
      keepBuffer: 3,
      zIndex: 2,
    });

    layer.on('tileload', () => {
      tileErrorCountRef.current = 0;
      setTilesReady(true);
      setTileMessage('');
    });

    layer.on('load', () => {
      tileErrorCountRef.current = 0;
      setTilesReady(true);
      setTileMessage('');
    });

    layer.on('tileerror', () => {
      tileErrorCountRef.current += 1;
      if (!tileFallbackRef.current && tileErrorCountRef.current >= TILE_ERROR_FALLBACK_THRESHOLD) {
        tileFallbackRef.current = true;
        tileErrorCountRef.current = 0;
        setTileMessage('');
        if (tileLayerRef.current) {
          map.removeLayer(tileLayerRef.current);
        }
        tileLayerRef.current = addTileLayer(map, 1);
        return;
      }
      setTileMessage('Map imagery is loading. Check your connection if it stays blank.');
    });

    layer.addTo(map);
    return layer;
  }, []);

  const addLocalBaseLayer = useCallback((map) => {
    if (!window.L || !map) return null;

    const layer = window.L.gridLayer({
      tileSize: 256,
      updateWhenIdle: false,
      keepBuffer: 4,
      zIndex: 0,
      className: 'parkaddis-local-base-layer',
    });
    layer.createTile = createLocalMapTile;
    layer.addTo(map);
    return layer;
  }, []);

  useEffect(() => {
    if (initStarted.current || !mapContainerRef.current || !window.L) return;
    initStarted.current = true;

    const initialCenter = initialLocationRef.current || userLocationRef.current || DEFAULT_CENTER;
    const map = window.L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(initialCenter, initialLocationRef.current ? 16 : 13);

    fallbackLayerRef.current = addLocalBaseLayer(map);
    tileLayerRef.current = addTileLayer(map);

    window.L.control.zoom({ position: 'bottomright' }).addTo(map);
    window.L.control.attribution({
      position: 'bottomleft',
      prefix: false,
    }).addAttribution(
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" style="color:#64748b">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" style="color:#64748b">CARTO</a>'
    ).addTo(map);

    map.on('click', () => {
      setShowDetail(false);
      setShowBookingSheet(false);
    });

    mapInstance.current = map;

    requestAnimationFrame(() => {
      mapInstance.current?.invalidateSize({ animate: false });
    });

    const boot = async () => {
      const bootId = bootRequestRef.current + 1;
      bootRequestRef.current = bootId;
      setMapMode('nearby');
      lastBrowseModeRef.current = 'nearby';
      setLoading(true);
      setEmptyMessage('');

      const initial = initialLocationRef.current;
      if (initial) {
        setCurrentLocation(initial);
        map.setView(initial, 16, { animate: false });
        await loadNearby(initial, { toast: false });
        return;
      }

      map.setView(DEFAULT_CENTER, 13, { animate: false });
    };

    boot();

    return () => {
      clearRoute();
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      userMarkerRef.current = null;
      fallbackLayerRef.current = null;
      tileLayerRef.current = null;
      tileErrorCountRef.current = 0;
      tileFallbackRef.current = false;
      bootRequestRef.current += 1;
      handledLocationRequestRef.current = null;
      startupLocationRetryRef.current = 0;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
      initStarted.current = false;
    };
  }, [addLocalBaseLayer, addTileLayer, clearRoute, loadNearby, setCurrentLocation]);

  const invalidateMap = useCallback(() => {
    mapInstance.current?.invalidateSize({ animate: false });
  }, []);

  useEffect(() => {
    if (!active) return;

    const rerender = () => {
      invalidateMap();
      renderMarkers(spots, { fit: false });
    };

    const t1 = requestAnimationFrame(rerender);
    const t2 = setTimeout(rerender, 150);
    const t3 = setTimeout(rerender, 400);

    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active, invalidateMap, renderMarkers, spots]);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      invalidateMap();
    });
    ro.observe(el);

    return () => ro.disconnect();
  }, [invalidateMap]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    loadSearchResults(searchQuery);
  }, [loadSearchResults, searchQuery]);

  const handleClearSearch = useCallback(() => {
    searchRequestRef.current += 1;
    setSearchLoading(false);
    setEmptyMessage('');
    setSearchQuery('');
  }, []);

  const activateNearbyFromUserLocation = useCallback(async ({ force = false, recenter = true } = {}) => {
    const existing = userLocationRef.current;
    if (!force && isValidLatLng(existing?.[0], existing?.[1])) {
      if (recenter) mapInstance.current?.setView(existing, 16);
      await loadNearby(existing);
      return existing;
    }

    setLocatingUser(true);
    try {
      const latlng = await getUserLocation({
        force: true,
        allowFallback: false,
        enableHighAccuracy: true,
        timeoutMs: 10000,
      });
      setCurrentLocation(latlng);
      if (recenter) mapInstance.current?.setView(latlng, 16);
      await loadNearby(latlng);
      return latlng;
    } catch {
      addToast('Allow location access to show nearby parking', 'error');
      return null;
    } finally {
      setLocatingUser(false);
    }
  }, [addToast, loadNearby, setCurrentLocation]);

  const applyLocationRequest = useCallback(async (requestInfo, { showDeniedMessage = true } = {}) => {
    if (!requestInfo?.request) return null;
    const requestId = requestInfo.id ?? requestInfo.request;
    handledLocationRequestRef.current = requestId;
    setMapMode('nearby');
    lastBrowseModeRef.current = 'nearby';
    setEmptyMessage('');
    setLocatingUser(true);
    try {
      const latlng = await requestInfo.request;
      startupLocationRetryRef.current = 0;
      setCurrentLocation(latlng);
      const focus = pendingFocusRef.current;
      mapInstance.current?.setView(focus ? [focus.lat, focus.lng] : latlng, 16);
      const list = await loadNearby(latlng, { toast: false, fit: !focus });
      if (focus) {
        // Keep the clicked spot centred and visible even if it's outside the
        // nearby result set, and don't let the fit-to-bounds override it.
        if (!(list || []).some((s) => String(s.id) === String(focus.id))) {
          applySpots([...(list || []), focus], { fit: false });
        }
        mapInstance.current?.setView([focus.lat, focus.lng], 16);
        pendingFocusRef.current = null;
      }
      return latlng;
    } catch {
      if (requestInfo.retryOnFailure !== false && requestLocation && startupLocationRetryRef.current < 1) {
        startupLocationRetryRef.current += 1;
        setTimeout(() => {
          if (!isValidLatLng(userLocationRef.current?.[0], userLocationRef.current?.[1])) {
            requestLocation();
          }
        }, 700);
        return null;
      }

      const focus = pendingFocusRef.current;
      if (focus) {
        // No user location, but the user tapped a specific spot — show it anyway.
        applySpots([focus], { fit: false });
        mapInstance.current?.setView([focus.lat, focus.lng], 16);
        pendingFocusRef.current = null;
        setLoading(false);
        return null;
      }
      if (showDeniedMessage) {
        setEmptyMessage('Allow location access to show nearby parking around you.');
        addToast('Allow location access to show nearby parking', 'error');
      }
      applySpots([], { fit: false });
      setLoading(false);
      return null;
    } finally {
      setLocatingUser(false);
    }
  }, [addToast, applySpots, loadNearby, requestLocation, setCurrentLocation]);

  useEffect(() => {
    if (!active || !mapInstance.current || !locationRequest?.request) return;
    const requestId = locationRequest.id ?? locationRequest.request;
    if (handledLocationRequestRef.current === requestId) return;
    applyLocationRequest(locationRequest);
  }, [active, applyLocationRequest, locationRequest]);

  useEffect(() => {
    if (!active || !mapInstance.current || locationRequest?.request) return;
    if (initialLocationRef.current) return;
    if (isValidLatLng(userLocationRef.current?.[0], userLocationRef.current?.[1])) return;
    requestLocation?.();
  }, [active, locationRequest, requestLocation]);

  // A spot tapped in another screen (e.g. Home's "Nearby Spots" list) arrives via
  // the focusSpot prop — centre the map on its pin. The detail sheet is NOT opened;
  // the user taps the pin themselves to see details.
  useEffect(() => {
    if (!active || !focusSpot?.spot) return;
    if (focusHandledRef.current === focusSpot.nonce) return;
    focusHandledRef.current = focusSpot.nonce;

    const spot = normalizeSpot(focusSpot.spot);
    if (!isValidLatLng(spot.lat, spot.lng)) return;

    // pendingFocusRef lets applyLocationRequest keep this spot centred instead of
    // snapping back to the user's location / fitting all nearby spots.
    pendingFocusRef.current = spot;
    setSpots((prev) => (
      prev.some((s) => String(s.id) === String(spot.id)) ? prev : [...prev, spot]
    ));
    // Blink the pin so the user can tell which one they picked. It keeps blinking
    // until they tap it (see the marker click handler, which clears the highlight).
    setHighlightSpotId(spot.id);
    mapInstance.current?.setView([spot.lat, spot.lng], 16);
  }, [active, focusSpot]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      searchRequestRef.current += 1;
      setSearchLoading(false);
      setEmptyMessage('');
      if (mapMode === 'search') {
        if (lastBrowseModeRef.current === 'all') {
          loadAllSpots();
        } else {
          loadNearby(userLocationRef.current);
        }
      }
      return undefined;
    }

    const timer = setTimeout(() => {
      loadSearchResults(q, { silent: true });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [loadAllSpots, loadNearby, loadSearchResults, mapMode, searchQuery]);

  const handleMyLocation = async () => {
    startupLocationRetryRef.current = 0;
    await activateNearbyFromUserLocation({ force: true });
  };

  const drawRoute = useCallback((coordinates) => {
    if (!mapInstance.current || !window.L || !coordinates?.length) return;
    if (routeLayerRef.current) routeLayerRef.current.remove();
    routeLayerRef.current = window.L.polyline(coordinates, {
      color: '#2563eb',
      weight: 6,
      opacity: 0.9,
      lineJoin: 'round',
    }).addTo(mapInstance.current);
    mapInstance.current.fitBounds(routeLayerRef.current.getBounds(), {
      paddingTopLeft: [40, 120],
      paddingBottomRight: [40, 220],
      maxZoom: 17,
    });
  }, []);

  const handleDirections = async () => {
    if (!selectedSpot) return;

    let origin = userLocationRef.current;
    if (!isValidLatLng(origin?.[0], origin?.[1])) {
      origin = await getUserLocation();
      setCurrentLocation(origin);
    }

    const mapsUrl = googleMapsDirectionsUrl(origin, selectedSpot);
    setGoogleMapsUrl(mapsUrl);
    setRouteLoading(true);
    setRouteError(null);

    try {
      const url = new URL(`https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${selectedSpot.lng},${selectedSpot.lat}`);
      url.searchParams.set('overview', 'full');
      url.searchParams.set('geometries', 'geojson');
      url.searchParams.set('steps', 'false');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OSRM ${response.status}`);
      const data = await response.json();
      const route = data.routes?.[0];
      const coords = route?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [];
      if (!coords.length) throw new Error('No route returned');

      drawRoute(coords);
      setRouteInfo({
        distance_m: route.distance,
        duration_s: route.duration,
      });
    } catch (err) {
      console.warn('Route drawing failed:', err);
      setRouteError('Could not draw the route here. Google Maps is available below.');
      fitToVisible([selectedSpot]);
    } finally {
      setRouteLoading(false);
    }
  };

  const handleOpenGoogleMaps = () => {
    if (!googleMapsUrl && selectedSpot) {
      openExternalUrl(googleMapsDirectionsUrl(userLocationRef.current, selectedSpot));
      return;
    }
    if (googleMapsUrl) openExternalUrl(googleMapsUrl);
  };

  useEffect(() => {
    if (!showDetail || !selectedSpot?.id) return;
    let cancelled = false;
    setDetailLoading(true);
    api.getSpotDetail(selectedSpot.id)
      .then((data) => { if (!cancelled) setSpotDetail(data); })
      .catch(() => { if (!cancelled) setSpotDetail(null); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [showDetail, selectedSpot?.id]);

  const handleBookSpot = async () => {
    setShowDetail(false);
    setShowBookingSheet(true);
    try {
      const data = await api.getVehicles();
      setVehicles(data.vehicles || []);
      const defaultV = (data.vehicles || []).find(v => v.is_default);
      if (defaultV) setSelectedVehicle(defaultV.id);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    }
  };

  // When a spot's detail opens, check whether this user has a completed,
  // unrated booking here — that's the only case where they may leave a rating.
  useEffect(() => {
    if (!showDetail || !selectedSpot?.id) {
      setRatableBooking(null);
      return undefined;
    }
    let cancelled = false;
    api.getRatableBooking(selectedSpot.id)
      .then((data) => { if (!cancelled) setRatableBooking(data.booking || null); })
      .catch(() => { if (!cancelled) setRatableBooking(null); });
    return () => { cancelled = true; };
  }, [showDetail, selectedSpot?.id]);

  const handleSubmitRating = async () => {
    if (!ratableBooking?.id || ratingLoading) return;
    setRatingLoading(true);
    try {
      await api.submitRating(ratableBooking.id, ratingScore, ratingComment.trim() || null);
      addToast('Thanks for rating this spot', 'success');
      setShowRating(false);
      setRatingComment('');
      setRatingScore(5);
      setRatableBooking(null);
      // Refresh reviews so the new one shows up immediately.
      if (selectedSpot?.id) {
        try {
          const fresh = await api.getSpotDetail(selectedSpot.id);
          setSpotDetail(fresh);
        } catch { /* non-critical */ }
      }
    } catch (err) {
      addToast(err.message || 'Failed to submit rating', 'error');
    } finally {
      setRatingLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    api.getFavorites()
      .then((data) => {
        if (cancelled) return;
        setFavoriteIds(new Set((data.favorites || []).map(f => f.id)));
      })
      .catch(() => { /* favorites are non-critical for the map */ });
    return () => { cancelled = true; };
  }, []);

  const handleToggleFavorite = async () => {
    if (!selectedSpot?.id || favoritePending) return;
    const spotId = selectedSpot.id;
    const wasSaved = favoriteIds.has(spotId);

    // Optimistic update
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(spotId);
      else next.add(spotId);
      return next;
    });
    setFavoritePending(true);

    try {
      if (wasSaved) {
        await api.removeFavorite(spotId);
        addToast('Removed from saved spots', 'success');
      } else {
        await api.addFavorite(spotId);
        addToast('Saved to your spots', 'success');
      }
    } catch (err) {
      // Revert on failure
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(spotId);
        else next.delete(spotId);
        return next;
      });
      addToast(err.message || 'Could not update saved spots', 'error');
    } finally {
      setFavoritePending(false);
    }
  };

  useEffect(() => {
    if (!showBookingSheet || !selectedSpot?.id) return;
    let cancelled = false;
    const start = new Date(Date.now() + Number(bookingOffset) * 60 * 1000).toISOString();
    api.getSpotAvailability(selectedSpot.id, { start, hours: bookingHours })
      .then((data) => { if (!cancelled) setBookingAvailability(data.availability); })
      .catch(() => { if (!cancelled) setBookingAvailability(null); });
    return () => { cancelled = true; };
  }, [showBookingSheet, selectedSpot?.id, bookingOffset, bookingHours]);

  const handleConfirmBooking = async () => {
    if (!selectedSpot) return;
    if (bookingAvailability && bookingAvailability.available_spaces <= 0) {
      addToast('No spaces available for that time', 'error');
      return;
    }
    setBookingLoading(true);
    try {
      const created = await api.createBooking({
        spotId: selectedSpot.id,
        startOffsetMin: bookingOffset,
        hours: bookingHours,
        vehicleId: selectedVehicle,
      });
      const bookingId = created.booking.id;

      try {
        const payment = await api.payBooking(bookingId, 'chapa');
        if (payment.checkoutUrl) {
          openExternalUrl(payment.checkoutUrl);
          addToast('Payment checkout opened. QR appears here after payment.', 'success');
        } else {
          addToast('Booking held. Open My Bookings to finish payment.', 'info');
        }
      } catch (paymentErr) {
        console.error('Payment initiation failed:', paymentErr);
        addToast('Booking held. Open My Bookings to retry payment.', 'info');
      }

      setShowBookingSheet(false);
      setSelectedSpot(null);
      clearRoute();
      navigate?.('bookings');
    } catch (err) {
      addToast(err.message || 'Booking failed', 'error');
    } finally {
      setBookingLoading(false);
    }
  };

  const countLabel = mapMode === 'nearby'
    ? `${spots.length} within 2 km`
    : mapMode === 'search'
      ? `${spots.length} search result${spots.length === 1 ? '' : 's'}`
      : `${spots.length} active spot${spots.length === 1 ? '' : 's'}`;
  const routeDistance = routeInfo ? fmtDistance(routeInfo.distance_m) : null;
  const routeDuration = routeInfo?.duration_s ? `${Math.max(1, Math.round(routeInfo.duration_s / 60))} min` : null;
  // A route is being drawn or is on the map — collapse the detail sheet so it's visible.
  const routeActive = routeLoading || !!routeInfo || !!routeError;
  const isLocationNearbyActive = mapMode === 'nearby' && (locatingUser || isValidLatLng(userLocation?.[0], userLocation?.[1]));

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mapContainerRef} className="map-container absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3">
        <div className="pointer-events-auto mx-auto max-w-lg space-y-2">
          <div className="map-brand-surface flex items-center gap-2 rounded-2xl border border-slate-200/80 px-3 py-2.5">
            <Icon name="search" size={18} className="flex-none text-slate-700" />
            <input
              type="text"
              placeholder="Search by area, street, or access note"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-950 placeholder:text-slate-500 outline-none"
            />
            {searchLoading && (
              <div className="h-4 w-4 flex-none animate-spin rounded-full border-2 border-slate-200/80 border-t-cyan-300" />
            )}
            {searchQuery && (
              <button onClick={handleClearSearch} className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-slate-200/80 bg-slate-900/5 text-slate-700 transition-all active:scale-95 active:bg-slate-900/10">
                <Icon name="x" size={15} />
              </button>
            )}
          </div>

          <div className="map-brand-surface grid grid-cols-2 gap-2 rounded-2xl border border-slate-200/80 p-1">
            <button
              onClick={() => activateNearbyFromUserLocation()}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] ${mapMode === 'nearby' ? 'map-brand-chip-active-cyan text-white' : 'map-brand-chip text-slate-700 active:bg-slate-900/10'}`}
            >
              Nearby 2 km
            </button>
            <button
              onClick={() => loadAllSpots()}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-[0.98] ${mapMode === 'all' ? 'map-brand-chip-active-emerald text-white' : 'map-brand-chip text-slate-700 active:bg-slate-900/10'}`}
            >
              All spots
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="pointer-events-none absolute left-1/2 top-32 z-[1000] -translate-x-1/2">
          <div className="map-brand-surface rounded-full border border-slate-200/80 px-4 py-2">
            <p className="text-xs font-semibold text-slate-700">
              {locatingUser
                ? 'Finding your location...'
                : mapMode === 'search'
                  ? 'Searching spots...'
                  : mapMode === 'all'
                    ? 'Loading all spots...'
                    : 'Loading nearby spots...'}
            </p>
          </div>
        </div>
      )}

      {(!tilesReady || tileMessage) && tileMessage && (
        <div className="pointer-events-none absolute left-1/2 top-44 z-[900] -translate-x-1/2">
          <div className="rounded-full border border-slate-300/60 bg-white/90 px-4 py-2 shadow-lg shadow-slate-900/10 backdrop-blur-sm">
            <p className="text-xs font-semibold text-slate-600">{tileMessage}</p>
          </div>
        </div>
      )}

      {!loading && (
        <div className="pointer-events-none absolute left-3 top-32 z-[1000]">
          <div className="map-brand-surface rounded-full border border-slate-200/80 px-3 py-1.5">
            <p className={`text-xs font-semibold ${spots.length ? 'text-emerald-700' : 'text-slate-600'}`}>{countLabel}</p>
          </div>
        </div>
      )}

      {!loading && emptyMessage && spots.length === 0 && (
        <div className="pointer-events-none absolute inset-x-3 top-44 z-[1000]">
          <div className="map-brand-surface pointer-events-auto mx-auto max-w-sm rounded-3xl border border-slate-200/80 p-4 text-center">
            <p className="text-sm font-semibold text-slate-950">{emptyMessage}</p>
            <p className="mt-1 text-xs text-slate-500">Try another area or view the full active host catalog.</p>
            <button
              onClick={() => loadAllSpots()}
              className="mt-3 rounded-xl border border-emerald-700/15 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition-all active:scale-[0.98]"
            >
              Show all spots
            </button>
          </div>
        </div>
      )}

      {/* Floating "my location" control — hidden while a bottom sheet is open so it
          never overlaps the detail / route / booking / rating sheets. */}
      {!showDetail && !showBookingSheet && !showRating && (
        <div className="pointer-events-none absolute bottom-24 right-3 z-[1050] flex flex-col gap-2">
          <button
            onClick={handleMyLocation}
            title="Use my location"
            aria-pressed={isLocationNearbyActive}
            className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border shadow-lg shadow-black/30 backdrop-blur-md transition-all active:bg-cyan-600 ${
              isLocationNearbyActive
                ? 'border-cyan-200 bg-cyan-500 text-white ring-4 ring-cyan-400/25'
                : 'border-white/10 bg-slate-950/92 text-cyan-300 hover:bg-slate-800'
            }`}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={locatingUser ? 'animate-pulse' : ''}>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
          </button>
        </div>
      )}

      {/* Collapsed route summary bar — shown while a route is on the map so it stays visible */}
      {showDetail && displaySpot && routeActive && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1100]">
          <div className="map-brand-sheet pointer-events-auto mx-3 mb-4 rounded-3xl border border-slate-200/80">
            <div className="flex justify-center pb-1 pt-3">
              <span className="h-1 w-9 rounded-full bg-slate-300" />
            </div>
            <div className="px-4 pb-4 pt-1 glass-sheet-text">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-cyan-500/15 text-cyan-700">
                  <Icon name="navigation" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{displaySpot.address || 'Parking spot'}</p>
                  <p className="mt-0.5 text-sm text-slate-600">
                    {routeLoading && 'Drawing route…'}
                    {!routeLoading && routeInfo && `${routeDistance || ''}${routeDistance && routeDuration ? ' · ' : ''}${routeDuration || ''} by car`}
                    {!routeLoading && !routeInfo && routeError && 'Route unavailable — use Google Maps'}
                  </p>
                </div>
                <button
                  onClick={clearRoute}
                  aria-label="Back to details"
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-slate-200/80 bg-slate-900/5 text-slate-700 transition-all active:scale-95 active:bg-slate-900/10"
                >
                  <Icon name="arrowLeft" size={17} />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={handleOpenGoogleMaps}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-900/5 py-3 text-sm font-semibold text-slate-700 transition-all active:scale-[0.98] active:bg-slate-900/10"
                >
                  <Icon name="mapPin" size={16} />Google Maps
                </button>
                <button
                  onClick={handleBookSpot}
                  disabled={isFull}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3 text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-900/5 disabled:text-slate-400 disabled:shadow-none"
                >
                  <Icon name={isFull ? 'x' : 'checkCircle'} size={16} />{isFull ? 'Full' : 'Book'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full detail sheet — clean minimal layout */}
      {showDetail && displaySpot && !routeActive && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1100]">
          <div className="map-brand-sheet pointer-events-auto mx-3 mb-4 max-h-[78vh] overflow-y-auto rounded-3xl border border-slate-200/80">
            <div className="sticky top-0 z-10 flex justify-center bg-white/70 pb-2 pt-3 backdrop-blur-xl">
              <span className="h-1 w-9 rounded-full bg-slate-300" />
            </div>

            <div className="px-5 pb-5 glass-sheet-text">
              {/* Header: title + status/distance, with heart & close */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <span className={`inline-flex items-center gap-1.5 ${isFull ? 'text-rose-700' : 'text-emerald-700'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isFull ? 'bg-rose-400' : 'bg-slate-950'}`} />
                      {isFull ? 'Full' : 'Available'}
                    </span>
                    {fmtDistance(distanceM) && (
                      <span className="text-slate-600">· {fmtDistance(distanceM)} away</span>
                    )}
                  </div>
                  <h3 className="mt-1.5 text-xl font-bold leading-snug text-slate-950">{displaySpot.address || 'Parking spot'}</h3>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <button
                    onClick={handleToggleFavorite}
                    disabled={favoritePending}
                    aria-pressed={favoriteIds.has(displaySpot.id)}
                    title={favoriteIds.has(displaySpot.id) ? 'Remove from saved spots' : 'Save this spot'}
                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-all disabled:opacity-60 ${
                      favoriteIds.has(displaySpot.id)
                        ? 'border border-rose-300/25 bg-rose-300/15 text-rose-700'
                        : 'border border-slate-200/80 bg-slate-900/5 text-slate-600 active:bg-slate-900/10 active:text-slate-950'
                    }`}
                  >
                    <Icon name="heart" size={17} className={favoriteIds.has(displaySpot.id) ? 'fill-current' : ''} />
                  </button>
                  <button
                    onClick={() => setShowDetail(false)}
                    aria-label="Close"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-900/5 text-slate-600 transition-all active:scale-95 active:bg-slate-900/10 active:text-slate-950"
                  >
                    <Icon name="x" size={17} />
                  </button>
                </div>
              </div>

              {displaySpot.photos?.length > 0 && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {displaySpot.photos.map((src, index) => (
                    <img key={src || index} src={src} alt="Parking spot" className="h-28 w-40 flex-none rounded-2xl object-cover" />
                  ))}
                </div>
              )}

              {/* Price + at-a-glance facts as clean typography, not boxes */}
              <div className="mt-5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-slate-950">{fmtMoney(displaySpot.price_per_hour)}</span>
                  <span className="text-sm font-medium text-slate-600">ETB / hour</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                    <Icon name="star" size={14} className="fill-current" />
                    {Number(displaySpot.rating_count) > 0
                      ? <>{Number(displaySpot.rating_avg || 0).toFixed(1)} <span className="font-normal text-slate-500">({displaySpot.rating_count})</span></>
                      : <span className="font-normal text-slate-500">New</span>}
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className={isFull ? 'text-rose-700' : 'text-slate-600'}>
                    {availableSpaces} of {totalSpaces} space{totalSpaces === 1 ? '' : 's'} free
                  </span>
                </div>
              </div>

              {/* Amenities */}
              {(displaySpot.covered || displaySpot.guarded || displaySpot.ev_charging) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {displaySpot.covered && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-700/15 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700">
                      <Icon name="umbrella" size={14} className="text-cyan-700" />Covered
                    </span>
                  )}
                  {displaySpot.guarded && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/15 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                      <Icon name="shield" size={14} className="text-emerald-400" />Guarded
                    </span>
                  )}
                  {displaySpot.ev_charging && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/15 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-700">
                      <Icon name="zap" size={14} className="text-amber-400" />EV charging
                    </span>
                  )}
                </div>
              )}

              {displaySpot.access_instructions && (
                <div className="mt-5 border-t border-slate-200/80 pt-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                    <Icon name="info" size={15} className="text-cyan-700" />Access information
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">{displaySpot.access_instructions}</p>
                </div>
              )}

              {/* Reviews */}
              <div className="mt-5 border-t border-slate-200/80 pt-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-950">Reviews</span>
                  {Number(spotDetail?.reviewCount) > 0 && (
                    <span className="text-xs text-slate-500">{spotDetail.reviewCount} total</span>
                  )}
                </div>
                {detailLoading && <p className="text-sm text-slate-600">Loading…</p>}
                {!detailLoading && (!spotDetail?.reviews || spotDetail.reviews.length === 0) && (
                  <p className="text-sm text-slate-600">No reviews yet. Book and park here to be the first.</p>
                )}
                {spotDetail?.reviews?.length > 0 && (
                  <div className="space-y-3">
                    {spotDetail.reviews.slice(0, 3).map(review => (
                      <div key={review.id}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-medium text-slate-700">{review.driver_name}</span>
                          <span className="flex flex-none items-center gap-0.5 text-xs font-semibold text-amber-700">
                            <Icon name="star" size={12} className="fill-current" />{review.score}
                          </span>
                        </div>
                        {review.comment && <p className="mt-1 text-sm leading-relaxed text-slate-600">{review.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {ratableBooking && (
                  <button
                    onClick={() => setShowRating(true)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700 active:text-cyan-200"
                  >
                    <Icon name="star" size={15} />Rate your visit
                  </button>
                )}
              </div>

              {/* Actions: primary Book, secondary Directions */}
              <div className="mt-6 space-y-2">
                <button
                  onClick={handleBookSpot}
                  disabled={isFull}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3.5 text-base font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-900/5 disabled:text-slate-400 disabled:shadow-none"
                >
                  <Icon name={isFull ? 'x' : 'checkCircle'} size={18} />
                  {isFull ? 'Spot full' : `Book · ${fmtMoney(displaySpot.price_per_hour)} ETB/hr`}
                </button>
                <button
                  onClick={handleDirections}
                  disabled={routeLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-900/5 py-3 text-sm font-semibold text-slate-700 transition-all active:scale-[0.98] active:bg-slate-900/10 disabled:cursor-wait disabled:opacity-70"
                >
                  <Icon name="navigation" size={16} />Directions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rating sheet */}
      {showRating && ratableBooking && (
        <div className="pointer-events-none absolute inset-0 z-[1300] flex items-end">
          <div className="pointer-events-auto absolute inset-0 bg-black/50" onClick={() => setShowRating(false)} />
          <div className="map-brand-sheet pointer-events-auto relative mx-3 mb-4 w-[calc(100%-1.5rem)] rounded-3xl border border-slate-200/80 p-5 glass-sheet-text">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your visit</p>
                <h3 className="mt-1 text-lg font-bold text-slate-950">Rate this spot</h3>
              </div>
              <button
                onClick={() => setShowRating(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-slate-900/5 text-slate-600 transition-all active:scale-95 active:bg-slate-900/10 active:text-slate-950"
              >
                <Icon name="x" size={17} />
              </button>
            </div>

            <div className="mb-4 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRatingScore(star)}
                  aria-label={`${star} star${star === 1 ? '' : 's'}`}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl transition active:scale-90 ${
                    star <= ratingScore ? 'border border-amber-300/25 bg-amber-400/15 text-amber-700' : 'border border-slate-200/80 bg-slate-900/5 text-slate-600'
                  }`}
                >
                  <Icon name="star" size={24} className={star <= ratingScore ? 'fill-current' : ''} />
                </button>
              ))}
            </div>

            <textarea
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
              placeholder="Share what the spot was like (optional)"
              rows={3}
              maxLength={500}
              className="map-brand-field mb-4 w-full resize-none rounded-2xl border border-slate-200/80 p-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:border-cyan-300/45"
            />

            <button
              onClick={handleSubmitRating}
              disabled={ratingLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-base font-semibold text-slate-950 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {ratingLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Icon name="star" size={18} className="fill-current" />
              )}
              {ratingLoading ? 'Submitting…' : 'Submit rating'}
            </button>
          </div>
        </div>
      )}

      {showBookingSheet && selectedSpot && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1200]">
          <div className="map-brand-sheet pointer-events-auto mx-3 mb-4 max-h-[82vh] overflow-y-auto rounded-3xl border border-slate-200/80">
            <div className="sticky top-0 z-10 flex justify-center bg-white/70 pb-2 pt-3 backdrop-blur-xl">
              <span className="h-1 w-9 rounded-full bg-slate-300" />
            </div>

            <div className="px-5 pb-5 glass-sheet-text">
              {/* Header: title + spot, with close */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-bold leading-snug text-slate-950">Book this spot</h3>
                  <p className="mt-1 truncate text-sm text-slate-600">{selectedSpot.address || 'Parking spot'}</p>
                </div>
                <button
                  onClick={() => setShowBookingSheet(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-slate-200/80 bg-slate-900/5 text-slate-600 transition-all active:scale-95 active:bg-slate-900/10 active:text-slate-950"
                >
                  <Icon name="x" size={17} />
                </button>
              </div>

              {/* Duration — number input with quick-select chips */}
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                  <Icon name="clock" size={15} className="text-cyan-700" />Duration
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0.5}
                    max={24}
                    step={0.5}
                    value={bookingHours}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (Number.isFinite(val) && val > 0 && val <= 24) setBookingHours(val);
                    }}
                    onBlur={() => {
                      if (!Number.isFinite(bookingHours) || bookingHours <= 0) setBookingHours(1);
                      if (bookingHours > 24) setBookingHours(24);
                    }}
                    className="map-brand-field w-24 rounded-xl border border-slate-200/80 px-4 py-3 text-sm text-slate-950 outline-none transition-all focus:border-cyan-300/45 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-sm font-medium text-slate-600">hours</span>
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  {[
                    { label: '1h', value: 1 },
                    { label: '2h', value: 2 },
                    { label: '4h', value: 4 },
                    { label: '8h', value: 8 },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setBookingHours(opt.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        bookingHours === opt.value
                          ? 'border border-emerald-300/25 bg-emerald-50 text-emerald-700'
                          : 'border border-slate-200/80 bg-slate-900/5 text-slate-500 active:bg-slate-900/10 active:text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start time — full date & time picker */}
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                  <Icon name="calendar" size={15} className="text-cyan-700" />Start time
                </div>
                <input
                  type="datetime-local"
                  value={bookingStartDate}
                  min={(() => {
                    const d = new Date();
                    d.setMinutes(0, 0, 0);
                    const pad = (n) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  })()}
                  onChange={(e) => {
                    setBookingStartDate(e.target.value);
                    const selected = new Date(e.target.value);
                    const offset = Math.max(0, Math.round((selected.getTime() - Date.now()) / 60000));
                    setBookingOffset(offset);
                  }}
                  className="map-brand-field w-full rounded-xl border border-slate-200/80 px-4 py-3 text-sm text-slate-950 outline-none transition-all focus:border-cyan-300/45 [color-scheme:dark]"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  {bookingOffset <= 1
                    ? 'Starting now'
                    : bookingOffset < 60
                      ? `Starts in ${bookingOffset} min`
                      : `Starts in ${Math.round(bookingOffset / 60)}h ${bookingOffset % 60 > 0 ? `${bookingOffset % 60}m` : ''}`}
                </p>
              </div>

              {/* Vehicle */}
              {vehicles.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                    <Icon name="car" size={15} className="text-cyan-700" />Vehicle
                  </div>
                  <select
                    value={selectedVehicle || ''}
                    onChange={(e) => setSelectedVehicle(e.target.value ? Number(e.target.value) : null)}
                    className="map-brand-field w-full rounded-xl border border-slate-200/80 px-3 py-3 text-sm text-slate-950 outline-none transition-all focus:border-cyan-300/45"
                  >
                    <option value="" className="text-slate-600">No vehicle</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id} className="text-slate-950">{v.plate_number}{v.color ? ` (${v.color})` : ''}{v.is_default ? ' - Default' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {bookingAvailability && (
                <div className={`mt-4 flex items-center gap-1.5 rounded-xl border p-3 text-xs font-medium ${bookingAvailability.available_spaces > 0 ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700' : 'border-rose-500/20 bg-rose-500/10 text-rose-700'}`}>
                  <span className={`h-1.5 w-1.5 flex-none rounded-full ${bookingAvailability.available_spaces > 0 ? 'bg-slate-950' : 'bg-rose-400'}`} />
                  {bookingAvailability.available_spaces > 0 ? `${bookingAvailability.available_spaces} of ${bookingAvailability.capacity} spaces available for this time` : 'Full for this time'}
                </div>
              )}

              {/* Estimated total */}
              <div className="mt-5 flex items-center justify-between border-t border-slate-200/80 pt-4">
                <span className="text-sm text-slate-600">Estimated total</span>
                <span className="text-2xl font-bold text-slate-950">
                  {fmtMoney(Number(selectedSpot.price_per_hour) * bookingHours)} <span className="text-sm font-medium text-slate-600">ETB</span>
                </span>
              </div>

              {/* Actions */}
              <div className="mt-6 space-y-2">
                <button
                  onClick={handleConfirmBooking}
                  disabled={bookingLoading || (bookingAvailability && bookingAvailability.available_spaces <= 0)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3.5 text-base font-semibold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-900/5 disabled:text-slate-400 disabled:shadow-none"
                >
                  {bookingLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      <Icon name="creditCard" size={18} />Confirm &amp; Pay
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowBookingSheet(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-900/5 py-3 text-sm font-semibold text-slate-700 transition-all active:scale-[0.98] active:bg-slate-900/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
