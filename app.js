// Street Marker — highlight the streets you've driven.
// Each "line" is an array of [lat, lng] points, saved in localStorage.

const STORAGE_KEY = 'streetMarker.lines.v1';
const MAX_ACCURACY_M = 35;   // ignore GPS fixes worse than this
const MIN_STEP_M = 8;        // ignore jitter smaller than this
const MAX_JUMP_M = 250;      // start a new line after a big gap
const MAX_GAP_MS = 90_000;   // ...or after a long pause in fixes

const LINE_STYLE = { color: '#facc15', weight: 14, opacity: 0.6, lineCap: 'round', lineJoin: 'round' };

// ---------- state ----------
let lines = load();
let current = null;          // line being recorded right now
let lastFix = null;          // { latlng, time }
let watchId = null;
let wakeLock = null;
let follow = true;
let drawMode = false;
let drawLine = null;

// ---------- map ----------
const map = L.map('map', { zoomControl: false }).setView([39.5, -98.35], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const layer = L.layerGroup().addTo(map);
const polylines = new Map(); // line array -> L.Polyline
const me = L.marker([0, 0], {
  icon: L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [22, 22] }),
  interactive: false,
});

function render() {
  layer.clearLayers();
  polylines.clear();
  for (const line of lines) addPolyline(line);
}
function addPolyline(line) {
  const pl = L.polyline(line, LINE_STYLE).addTo(layer);
  polylines.set(line, pl);
  return pl;
}
render();
if (lines.length) map.fitBounds(L.featureGroup([...polylines.values()]).getBounds(), { maxZoom: 16 });

// ---------- storage ----------
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines.filter(l => l.length > 1))); }
  catch (e) { setStatus('Could not save: ' + e.message); }
}

// ---------- tracking ----------
function startTracking() {
  if (!('geolocation' in navigator)) return setStatus('This browser has no GPS access.');
  watchId = navigator.geolocation.watchPosition(onFix, onGeoError, {
    enableHighAccuracy: true, maximumAge: 0, timeout: 20000,
  });
  requestWakeLock();
  btnTrack.textContent = 'Stop';
  btnTrack.classList.add('recording');
  setStatus('Waiting for GPS…');
}

function stopTracking() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  current = null;
  lastFix = null;
  releaseWakeLock();
  save();
  btnTrack.textContent = 'Start';
  btnTrack.classList.remove('recording');
  setStatus(`Stopped. ${totalKm().toFixed(1)} km marked in total.`);
}

function onFix(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  const latlng = L.latLng(latitude, longitude);
  me.setLatLng(latlng).addTo(map);
  if (follow) map.setView(latlng, Math.max(map.getZoom(), 16), { animate: true });

  if (accuracy > MAX_ACCURACY_M) {
    setStatus(`Weak GPS signal (±${Math.round(accuracy)} m) — not marking`);
    return;
  }

  const now = pos.timestamp;
  if (lastFix) {
    const d = lastFix.latlng.distanceTo(latlng);
    if (d < MIN_STEP_M) return;
    if (d > MAX_JUMP_M || now - lastFix.time > MAX_GAP_MS) current = null;
  }

  if (!current) {
    current = [];
    lines.push(current);
    addPolyline(current);
  }
  current.push([+latitude.toFixed(6), +longitude.toFixed(6)]);
  polylines.get(current).setLatLngs(current);
  lastFix = { latlng, time: now };

  if (current.length % 5 === 0) save();
  setStatus(`Marking… ±${Math.round(accuracy)} m · ${totalKm().toFixed(1)} km total`);
}

function onGeoError(err) {
  const msg = {
    1: 'Location permission denied. Enable it in your browser/phone settings.',
    2: 'Location unavailable.',
    3: 'GPS timed out — still trying…',
  }[err.code] || err.message;
  setStatus(msg);
  if (err.code === 1) stopTracking();
}

// Keep the screen on — most mobile browsers pause GPS when the screen locks.
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* unsupported */ }
}
function releaseWakeLock() { wakeLock?.release?.(); wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && watchId !== null) requestWakeLock();
  if (document.visibilityState === 'hidden') save();
});

// ---------- manual draw mode ----------
map.on('click', e => {
  if (!drawMode) return;
  if (!drawLine) {
    drawLine = [];
    lines.push(drawLine);
    addPolyline(drawLine);
  }
  drawLine.push([+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)]);
  polylines.get(drawLine).setLatLngs(drawLine);
  save();
});

function setDrawMode(on) {
  drawMode = on;
  drawLine = null;
  btnDraw.classList.toggle('on', on);
  btnDraw.textContent = on ? 'Done' : 'Draw';
  if (on) { setFollow(false); setStatus('Tap along a street to mark it. Tap Done to finish.'); }
  else { cleanupEmpty(); save(); setStatus('Drawing saved.'); }
}

// ---------- helpers ----------
function totalKm() {
  let m = 0;
  for (const line of lines)
    for (let i = 1; i < line.length; i++) m += L.latLng(line[i - 1]).distanceTo(line[i]);
  return m / 1000;
}
function cleanupEmpty() {
  lines = lines.filter(l => l.length > 1 || l === current);
  render();
}
function setStatus(text) { statusEl.textContent = text; }
function setFollow(on) {
  follow = on;
  btnFollow.classList.toggle('on', on);
  if (on && lastFix) map.setView(lastFix.latlng, Math.max(map.getZoom(), 16));
}

// ---------- buttons ----------
const $ = id => document.getElementById(id);
const btnTrack = $('btnTrack'), btnFollow = $('btnFollow'), btnDraw = $('btnDraw');
const statusEl = $("status"), menu = $('menu');

btnTrack.onclick = () => (watchId === null ? startTracking() : stopTracking());
btnFollow.onclick = () => setFollow(!follow);
btnDraw.onclick = () => setDrawMode(!drawMode);
$('btnMenu').onclick = () => menu.classList.toggle('hidden');
map.on('dragstart', () => setFollow(false));

$('btnUndo').onclick = () => {
  const removed = lines.pop();
  if (removed === current) current = null;
  if (removed === drawLine) drawLine = null;
  render(); save(); menu.classList.add('hidden');
};

$('btnClear').onclick = () => {
  if (!confirm('Erase every marked street? This cannot be undone.')) return;
  lines = []; current = null; drawLine = null;
  render(); save(); menu.classList.add('hidden');
  setStatus('Cleared.');
};

$('btnExport').onclick = () => {
  const geojson = {
    type: 'FeatureCollection',
    features: lines.filter(l => l.length > 1).map(l => ({
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: l.map(([lat, lng]) => [lng, lat]) },
    })),
  };
  const blob = new Blob([JSON.stringify(geojson)], { type: 'application/geo+json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `streets-${new Date().toISOString().slice(0, 10)}.geojson`;
  a.click();
  URL.revokeObjectURL(a.href);
  menu.classList.add('hidden');
};

$('fileImport').onchange = async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const imported = (data.features || [])
      .filter(f => f.geometry?.type === 'LineString')
      .map(f => f.geometry.coordinates.map(([lng, lat]) => [lat, lng]));
    lines.push(...imported);
    render(); save();
    setStatus(`Imported ${imported.length} lines.`);
  } catch (err) {
    setStatus('Import failed: ' + err.message);
  }
  e.target.value = '';
  menu.classList.add('hidden');
};

// Center on the user once at startup (without recording).
navigator.geolocation?.getCurrentPosition(
  pos => {
    const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
    me.setLatLng(ll).addTo(map);
    if (!lines.length) map.setView(ll, 16);
  },
  () => {},
  { enableHighAccuracy: true, timeout: 10000 },
);
