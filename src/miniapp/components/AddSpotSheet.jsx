import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useToast, useUser } from '../App.jsx';
import * as api from '../api.js';
import { getUserLocation, getCachedLocation, DEFAULT_CENTER } from '../utils/location.js';

const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

function isValidLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

function statusLabel(status) {
  if (status === 'pending_approval') return 'Pending review';
  if (status === 'active') return 'Live';
  if (status === 'rejected') return 'Rejected';
  if (status === 'suspended') return 'Suspended';
  return status || 'Draft';
}

function createSpotMarkerIcon() {
  if (!window.L) return null;
  return window.L.divIcon({
    className: 'spot-picker-marker',
    iconSize: [44, 56],
    iconAnchor: [22, 54],
    html: '<div class="spot-picker-marker-pin"><span>P</span></div>',
  });
}

function fallbackAddress(lat, lng) {
  return lat.toFixed(6) + ', ' + lng.toFixed(6);
}

export default function AddSpotSheet({ open, onClose, onAdded, initialLocation = null }) {
  const { addToast } = useToast();
  const { reload } = useUser();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapElRef = useRef(null);
  const addressRequestRef = useRef(0);
  const selectLocationRef = useRef(null);

  const [step, setStep] = useState('form');
  const [location, setLocation] = useState(initialLocation);
  const [address, setAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [price, setPrice] = useState('');
  const [capacity, setCapacity] = useState('1');
  const [covered, setCovered] = useState(false);
  const [guarded, setGuarded] = useState(false);
  const [evCharging, setEvCharging] = useState(false);
  const [accessInstructions, setAccessInstructions] = useState('');
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const setPin = useCallback((latlng, shouldPan = true) => {
    const lat = Array.isArray(latlng) ? Number(latlng[0]) : Number(latlng.lat);
    const lng = Array.isArray(latlng) ? Number(latlng[1]) : Number(latlng.lng);
    if (!isValidLatLng(lat, lng)) return;

    const next = { lat, lng };
    setLocation(next);

    const map = mapRef.current;
    if (!map || !window.L) return;
    if (!markerRef.current) {
      markerRef.current = window.L.marker([lat, lng], {
        draggable: true,
        icon: createSpotMarkerIcon(),
        keyboard: false,
        riseOnHover: true,
        zIndexOffset: 1000,
      }).addTo(map);
      markerRef.current.on('dragend', () => {
        if (!markerRef.current) return;
        const pos = markerRef.current.getLatLng();
        selectLocationRef.current?.(pos, { shouldPan: false });
      });
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    markerRef.current.setZIndexOffset(1000);
    if (shouldPan) map.setView([lat, lng], Math.max(map.getZoom(), 17));
  }, []);

  const loadAddress = useCallback(async (lat, lng) => {
    const requestId = ++addressRequestRef.current;
    setAddressLoading(true);
    let nextAddress = fallbackAddress(lat, lng);

    try {
      const data = await api.reverseGeocode(lat, lng);
      nextAddress = data.address || nextAddress;
    } catch {
      nextAddress = fallbackAddress(lat, lng);
    } finally {
      if (addressRequestRef.current === requestId) {
        setAddress(nextAddress);
        setAddressLoading(false);
      }
    }

    return nextAddress;
  }, []);

  const selectLocation = useCallback(async (latlng, { shouldPan = true, resolveAddress = true } = {}) => {
    const lat = Array.isArray(latlng) ? Number(latlng[0]) : Number(latlng.lat);
    const lng = Array.isArray(latlng) ? Number(latlng[1]) : Number(latlng.lng);
    if (!isValidLatLng(lat, lng)) return null;

    setPin({ lat, lng }, shouldPan);
    if (resolveAddress) await loadAddress(lat, lng);
    return { lat, lng };
  }, [setPin, loadAddress]);

  useEffect(() => {
    selectLocationRef.current = selectLocation;
  }, [selectLocation]);

  useEffect(() => {
    if (!open) return;
    const initial = initialLocation;
    if (initial && isValidLatLng(initial.lat, initial.lng)) {
      selectLocation(initial);
    }
  }, [open, initialLocation, selectLocation]);

  useEffect(() => {
    if (!open || step !== 'map' || !window.L || !mapElRef.current || mapRef.current) return;
    const cached = getCachedLocation();
    const center = location && isValidLatLng(location.lat, location.lng)
      ? [location.lat, location.lng]
      : cached || DEFAULT_CENTER;

    const map = window.L.map(mapElRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, 15);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true,
      updateWhenIdle: true,
      keepBuffer: 2,
    }).addTo(map);
    window.L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.on('click', (e) => selectLocation(e.latlng));
    mapRef.current = map;

    if (location && isValidLatLng(location.lat, location.lng)) {
      selectLocation(location, { shouldPan: false, resolveAddress: !address });
    } else if (cached) {
      selectLocation({ lat: cached[0], lng: cached[1] }, { shouldPan: false, resolveAddress: !address });
    }

    requestAnimationFrame(() => map.invalidateSize({ animate: false }));

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [open, step, selectLocation]);

  useEffect(() => {
    if (!open || step !== 'map' || !mapRef.current) return;

    const map = mapRef.current;
    const resize = () => {
      map.invalidateSize({ animate: false });
    };

    const frame = requestAnimationFrame(resize);
    const timer = setTimeout(resize, 250);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [open, step]);

  const handlePhotoChange = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_PHOTOS);
    const accepted = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > MAX_PHOTO_BYTES) {
        addToast('Each image must be under 3 MB', 'error');
        continue;
      }
      accepted.push(await fileToDataUrl(file));
    }
    setPhotos(accepted);
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const [lat, lng] = await getUserLocation({ force: true, timeoutMs: 6000 });
      await selectLocation({ lat, lng });
    } catch {
      addToast('Allow location access in Telegram or choose the spot manually on the map', 'error');
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    const parsedPrice = Number(price);
    const parsedCapacity = Number(capacity);
    if (!location) { addToast('Choose the spot location on the map', 'error'); return; }
    if (!address.trim()) { addToast('Address is required', 'error'); return; }
    if (!parsedPrice || parsedPrice <= 0) { addToast('Enter a valid hourly price', 'error'); return; }
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) { addToast('Enter how many cars can park', 'error'); return; }
    if (photos.length === 0) { addToast('Upload at least one spot image', 'error'); return; }

    setSaving(true);
    try {
      const result = await api.createHostSpot({
        lat: location.lat,
        lng: location.lng,
        address: address.trim(),
        pricePerHour: parsedPrice,
        capacity: parsedCapacity,
        covered,
        guarded,
        evCharging,
        accessInstructions: accessInstructions.trim() || null,
        photos,
      });
      addToast('Spot submitted for admin review', 'success');
      await reload?.();
      onAdded?.(result.spot);
      onClose?.();
    } catch (err) {
      addToast(err.message || 'Failed to submit spot', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  const isMapStep = step === 'map';

  return (
    <div className="fixed inset-0 z-[1800] flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`profile-sheet flex w-full max-w-md flex-col rounded-t-[30px] border-t border-cyan-200/15 bg-[#060a12] shadow-[0_-28px_80px_rgba(0,0,0,0.62)] ${isMapStep ? 'h-[92vh]' : 'max-h-[92vh]'}`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between border-b border-white/[0.08] px-4 ${isMapStep ? 'py-2.5' : 'py-3'}`}>
          <div>
            <h3 className="text-base font-bold text-white">{isMapStep ? 'Choose map pin' : 'List parking spot'}</h3>
            {!isMapStep && <p className="text-xs text-slate-400">{statusLabel('pending_approval')} after submit</p>}
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] text-slate-400 active:bg-white/[0.09]">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {!isMapStep && (
          <div className="flex border-b border-white/[0.08] bg-black/20 px-4 py-2">
            <button onClick={() => setStep('form')} className="flex-1 rounded-lg bg-emerald-300 py-2 text-xs font-black text-slate-950 shadow-[0_0_18px_rgba(110,231,183,0.22)]">Details</button>
            <button onClick={() => setStep('map')} className="flex-1 rounded-lg py-2 text-xs font-black text-slate-400 active:bg-white/[0.06]">Map pin</button>
          </div>
        )}

        {isMapStep ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <div ref={mapElRef} className="absolute inset-0" />
            </div>
            <div className="border-t border-white/[0.08] bg-[#060a12] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.045] px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-cyan-300">Selected address</p>
                <p className="mt-1 line-clamp-1 text-xs font-semibold text-white">
                  {addressLoading ? 'Getting address...' : address || 'Tap the map or use current location'}
                </p>
                {location && (
                  <p className="mt-1 font-mono text-[10px] text-slate-400">
                    {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleUseCurrentLocation} disabled={locating} className="rounded-xl border border-white/[0.08] bg-white/[0.06] px-2 py-3 text-sm font-black text-slate-200 disabled:opacity-50">
                  {locating ? 'Finding...' : 'My location'}
                </button>
                <button onClick={() => setStep('form')} className="rounded-xl bg-cyan-300 px-2 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(103,232,249,0.35)] active:bg-cyan-200">Use pin</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            <button onClick={() => setStep('map')} className="w-full rounded-xl border border-cyan-300/25 bg-cyan-300/10 p-3 text-left text-sm text-cyan-100">
              <span className="block font-semibold text-cyan-300">Map address</span>
              <span className="mt-1 block text-xs text-slate-300">{address || 'Choose location on the map'}</span>
            </button>

            <textarea value={address} onChange={e => setAddress(e.target.value)} rows="2" placeholder="Address from map" className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-300/50" />

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Price/hr (ETB)</span>
                <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="1" step="0.01" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/50" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Car spaces</span>
                <input value={capacity} onChange={e => setCapacity(e.target.value)} type="number" min="1" step="1" className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-300/50" />
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[['covered', 'Covered', covered, setCovered], ['guarded', 'Guarded', guarded, setGuarded], ['ev', 'EV', evCharging, setEvCharging]].map(([key, label, value, setter]) => (
                <button key={key} type="button" onClick={() => setter(!value)} className={`rounded-xl border px-2 py-2 text-xs font-black ${value ? 'border-emerald-300/35 bg-emerald-300/15 text-emerald-100' : 'border-white/[0.08] bg-white/[0.045] text-slate-400'}`}>{label}</button>
              ))}
            </div>

            <textarea value={accessInstructions} onChange={e => setAccessInstructions(e.target.value)} rows="3" placeholder="Access instructions: gate, landmark, phone, where to enter" className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-300/50" />

            <label className="block rounded-xl border border-dashed border-cyan-200/20 bg-white/[0.045] p-3 text-center text-sm text-slate-300 active:bg-white/[0.08]">
              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
              Upload spot images
              <span className="mt-1 block text-xs text-slate-500">{photos.length ? photos.length + ' selected' : 'At least one image, max 5'}</span>
            </label>

            {photos.length > 0 && (
              <div className="grid grid-cols-5 gap-2">
                {photos.map((src, index) => <img key={index} src={src} alt="Spot preview" className="aspect-square rounded-lg object-cover" />)}
              </div>
            )}

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
              New listings stay hidden until an admin reviews and approves them.
            </div>
          </div>
        )}

        {!isMapStep && (
          <div className="flex gap-2 border-t border-white/[0.08] p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.045] py-3 text-sm font-black text-slate-300 disabled:opacity-50">Cancel</button>
            <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-xl bg-emerald-300 py-3 text-sm font-black text-slate-950 shadow-[0_0_24px_rgba(110,231,183,0.28)] disabled:opacity-50">
              {saving ? 'Submitting...' : 'Submit for review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
