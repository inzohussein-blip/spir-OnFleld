// صفحة الخريطة (MapLibre GL + بلاط OpenFreeMap المجاني بدون مفتاح)
// نفس الصفحة تشتغل داخل WebView على الهاتف وداخل iframe على المتصفح.
// الفكرة مأخوذة من خرائط spir-medical: مكتبة متّجهة واضحة + إضافة تشكيل
// الحروف العربية حتى أسماء الشوارع تطلع موصولة وصحيحة.

export const MAPLIBRE_VERSION = '6.18.0';
export const MAPLIBRE_JS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.mjs`;
export const MAPLIBRE_CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
export const RTL_PLUGIN = 'https://cdn.jsdelivr.net/npm/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';
export const MAP_STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface MapOptions {
  points: MapPoint[];
  dark: boolean;
  primary: string;
  /** وضع تحديد الموقع (لوحة التحكم): الضغط على الخريطة يحط الدبوس */
  pick?: { lat: number; lng: number } | null;
  pickMode?: boolean;
  center: { lat: number; lng: number };
  /** الملاعب اللي تنفتح عليها الخريطة أول مرة (أكبر تجمّع) — الباقي يبين بزر «كل الملاعب» */
  initialIds?: string[];
}

/** رسائل الخريطة للتطبيق */
export type MapMessage =
  | { type: 'ready' }
  | { type: 'select'; id: string | null }
  | { type: 'pick'; lat: number; lng: number }
  | { type: 'error'; message: string };

/** رسائل التطبيق للخريطة */
export type HostMessage =
  | { type: 'focus'; id: string | null }
  | { type: 'user'; lat: number; lng: number; nearIds?: string[] }
  | { type: 'fit' };

/** JSON آمن داخل <script> */
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

export function parseMapMessage(raw: unknown): MapMessage | null {
  try {
    const m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!m || typeof m !== 'object' || (m as { __balmalaab?: number }).__balmalaab !== 1) return null;
    const t = (m as { type?: string }).type;
    return t === 'ready' || t === 'select' || t === 'pick' || t === 'error' ? (m as MapMessage) : null;
  } catch {
    return null;
  }
}

export function buildMapHtml(o: MapOptions): string {
  const cfg = {
    points: o.points,
    style: o.dark ? MAP_STYLE.dark : MAP_STYLE.light,
    dark: o.dark,
    primary: o.primary,
    pick: o.pick ?? null,
    pickMode: !!o.pickMode,
    center: o.center,
    initial: o.initialIds ?? null,
    rtl: RTL_PLUGIN,
  };
  const bg = o.dark ? '#0B1226' : '#EEF2FA';
  return `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE_CSS}">
<style>
html,body,#map{margin:0;height:100%;width:100%;background:${bg};overflow:hidden}
body{font-family:Cairo,system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;-webkit-tap-highlight-color:transparent}
.pin{display:flex;flex-direction:column;align-items:center;cursor:pointer;transform-origin:bottom center;transition:transform .15s}
.pin .tag{background:${o.dark ? '#16213F' : '#fff'};color:${o.dark ? '#E6ECFF' : '#0B1226'};font-weight:700;font-size:12px;line-height:1;padding:7px 10px;border-radius:14px;white-space:nowrap;box-shadow:0 3px 10px rgba(6,19,74,.25);border:1.5px solid ${o.primary}}
.pin .dot{width:14px;height:14px;border-radius:50%;background:${o.primary};border:3px solid #fff;margin-top:4px;box-shadow:0 2px 6px rgba(6,19,74,.35)}
.pin.on{transform:scale(1.12);z-index:5}
.far .pin:not(.on) .tag{display:none}
.pin.on .tag{background:${o.primary};color:#fff}
.me{width:16px;height:16px;border-radius:50%;background:#1A73E8;border:3px solid #fff;box-shadow:0 0 0 6px rgba(26,115,232,.25)}
.maplibregl-ctrl-attrib{font-size:10px}
#err{position:absolute;inset:0;display:none;align-items:center;justify-content:center;text-align:center;padding:24px;color:${o.dark ? '#AEB9DA' : '#56607A'};font-size:15px}
</style></head>
<body><div id="map"></div><div id="err">ما كدرنا نحمّل الخريطة. تأكد من الإنترنت وارجع افتحها.</div>
<script type="module">
const cfg = ${safeJson(cfg)};
function send(m){
  m.__balmalaab = 1;
  try{ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); else window.parent.postMessage(m, '*'); }catch(e){}
}
function fail(e){ document.getElementById('err').style.display='flex'; send({type:'error', message:String(e && e.message || e)}); }
let ml;
try { ml = await import('${MAPLIBRE_JS}'); } catch (e) { fail(e); throw e; }
try { ml.setRTLTextPlugin(cfg.rtl, true).catch(()=>{}); } catch (e) {}
const map = new ml.Map({
  container: 'map', style: cfg.style, center: [cfg.center.lng, cfg.center.lat], zoom: 11,
  attributionControl: false, dragRotate: false, pitchWithRotate: false,
});
map.touchZoomRotate.disableRotation();
map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-left');
map.on('error', (e) => { if (!map.loaded() && e && e.error && /style/i.test(String(e.error.message))) fail(e.error); });
// أسماء الأماكن بالعربي إذا متوفرة
map.on('styledata', () => {
  try {
    for (const l of map.getStyle().layers || []) {
      if (l.type === 'symbol' && l.layout && l.layout['text-field'])
        map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:ar'], ['get', 'name']]);
    }
  } catch (e) {}
});

const markers = new Map();
let selected = null;
function select(id, fly){
  selected = id;
  for (const [k, m] of markers) m.getElement().classList.toggle('on', k === id);
  const p = cfg.points.find((x) => x.id === id);
  if (p && fly) map.easeTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 13.5), duration: 500, padding: { bottom: 220 } });
}
for (const p of cfg.points) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', p.name);
  el.dataset.id = p.id;
  const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = p.name;
  const dot = document.createElement('div'); dot.className = 'dot';
  el.append(tag, dot);
  el.addEventListener('click', (ev) => { ev.stopPropagation(); select(p.id, true); send({ type: 'select', id: p.id }); });
  markers.set(p.id, new ml.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(map));
}
function fitAll(ids){
  const pts = ids ? cfg.points.filter((p) => ids.includes(p.id)) : cfg.points;
  if (!pts.length) return;
  if (pts.length === 1) { map.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 13 }); return; }
  const b = new ml.LngLatBounds();
  for (const p of pts) b.extend([p.lng, p.lat]);
  map.fitBounds(b, { padding: { top: 90, bottom: 240, left: 50, right: 50 }, maxZoom: 13.5, duration: 0 });
}
// دبوس تحديد الموقع (لوحة التحكم)
let pickMarker = null;
function setPick(lng, lat){
  if (!pickMarker) {
    pickMarker = new ml.Marker({ color: cfg.primary, draggable: true }).setLngLat([lng, lat]).addTo(map);
    pickMarker.on('dragend', () => { const q = pickMarker.getLngLat(); send({ type: 'pick', lat: q.lat, lng: q.lng }); });
  } else pickMarker.setLngLat([lng, lat]);
  send({ type: 'pick', lat, lng });
}
if (cfg.pickMode) {
  if (cfg.pick) { pickMarker = new ml.Marker({ color: cfg.primary, draggable: true }).setLngLat([cfg.pick.lng, cfg.pick.lat]).addTo(map);
    pickMarker.on('dragend', () => { const q = pickMarker.getLngLat(); send({ type: 'pick', lat: q.lat, lng: q.lng }); });
    map.jumpTo({ center: [cfg.pick.lng, cfg.pick.lat], zoom: 15 }); }
  map.on('click', (e) => setPick(e.lngLat.lng, e.lngLat.lat));
} else {
  fitAll(cfg.initial && cfg.initial.length ? cfg.initial : null);
  map.on('click', () => { if (selected) { select(null); send({ type: 'select', id: null }); } });
}
let me = null;
function onHost(m){
  if (!m || typeof m !== 'object') return;
  if (m.type === 'focus') select(m.id, true);
  else if (m.type === 'fit') fitAll(null);
  else if (m.type === 'user') {
    if (!me) { const el = document.createElement('div'); el.className = 'me'; me = new ml.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map); }
    else me.setLngLat([m.lng, m.lat]);
    // نبيّن موقعك وأقرب الملاعب سوا
    const near = cfg.points.filter((p) => (m.nearIds || []).includes(p.id));
    if (near.length) {
      const b = new ml.LngLatBounds([m.lng, m.lat], [m.lng, m.lat]);
      for (const p of near) b.extend([p.lng, p.lat]);
      map.fitBounds(b, { padding: { top: 110, bottom: 250, left: 60, right: 60 }, maxZoom: 14, duration: 600 });
    } else map.easeTo({ center: [m.lng, m.lat], zoom: Math.max(map.getZoom(), 12.5), duration: 600, padding: { bottom: 220 } });
  }
}
// من بعيد (مستوى العراق) نخفي أسماء الملاعب حتى ما تتراكب — تبقى النقاط
const zoomClass = () => document.body.classList.toggle('far', map.getZoom() < 9.5);
map.on('zoom', zoomClass);
zoomClass();
window.__onHost = onHost;
window.addEventListener('message', (e) => { const d = e.data; if (d && d.__host === 1) onHost(d); });
map.once('load', () => send({ type: 'ready' }));
</script></body></html>`;
}
