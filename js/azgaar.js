// Import maps saved by Azgaar's Fantasy Map Generator (.map files) and repaint them in a dark, grim style.
// The map's SVG is restyled, rendered to a sharp image, and capitals/markers become pins.
import { uid } from './dom.js';
import { save } from './state.js';

const RENDER_SCALE = 3; // render at 3x so zooming in stays sharp
const SERIF = "Georgia, 'Times New Roman', serif";

const findLine = (lines, test) => lines.find((l) => test(l.trimStart())) || null;
const tryJson = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

/** Pull the pieces we need out of an Azgaar .map file. */
export function parseAzgaar(text, fallbackName = 'Map') {
  // Records are separated by CRLF, but the SVG record contains plain newlines, and line endings can get
  // rewritten (e.g. by git). So cut the SVG out by its tags, and split the rest on any newline.
  const svgStart = text.indexOf('<svg');
  const svgEnd = text.indexOf('</svg>', svgStart);
  if (svgStart < 0 || svgEnd < 0) throw new Error('no map image found in this file');
  const svg = text.slice(svgStart, svgEnd + 6);
  const lines = (text.slice(0, svgStart) + '\n' + text.slice(svgEnd + 6)).split(/\r?\n/);
  if (!/Fantasy-Map-Generator|azgaar/i.test(lines[0] || '')) throw new Error("this isn't an Azgaar Fantasy Map Generator file");
  const settings = (lines[1] || '').split('|');
  const unit = settings[0] || 'mi';
  const scale = parseFloat(settings[1]) || 3;
  // The map name sits a few fields from the end of the settings line.
  const name = settings.slice(-8).find((s) => /^[\p{L}][\p{L}\s'’-]{1,40}$/u.test(s) && !/^(default|true|false)$/i.test(s)) || fallbackName;
  const burgs = tryJson(findLine(lines, (l) => l.startsWith('[0,{"cell"'))) || [];
  const states = tryJson(findLine(lines, (l) => l.startsWith('[{"i":0,"name":"Neutrals"') || l.startsWith('[{"i":0,"name":'))) || [];
  const notes = tryJson(findLine(lines, (l) => l.startsWith('[{"id":"'))) || [];
  const markers = tryJson(findLine(lines, (l) => l.startsWith('[{"icon"'))) || [];
  return { svg, unit, scale, name, burgs, states, notes, markers };
}

/** Repaint Azgaar's SVG in a dark, grim D&D style. Returns SVG markup. */
export function grimify(svgText, title = '') {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;
  const $ = (id) => doc.getElementById(id);
  const W = parseFloat(svg.getAttribute('width')) || 1272;
  const H = parseFloat(svg.getAttribute('height')) || 635;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.removeAttribute('style');
  const set = (el, attrs) => { if (!el) return; for (const [k, v] of Object.entries(attrs)) v == null ? el.removeAttribute(k) : el.setAttribute(k, v); };
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => { const e = doc.createElementNS(NS, tag); set(e, attrs); parent?.append(e); return e; };

  // Remove layers that don't suit a printed, grim map (or that need the live app).
  for (const id of ['scaleBar', 'vignette', 'legend', 'debug', 'ruler', 'fogging-cont', 'emblems', 'texture', 'coordinates', 'gridOverlay',
    'cells', 'compass', 'population', 'prec', 'wind', 'temperature', 'goods', 'armies', 'statesHalo', 'zones', 'oceanPattern', 'provinceLabels',
    'anchors', 'markers', 'tradeAnimation', 'oceanHeights', 'landHeights']) $(id)?.remove();
  for (const img of [...doc.querySelectorAll('image')]) img.remove();

  // Effects
  const defsMarkup = `
    <filter id="grim-desat" x="0" y="0" width="100%" height="100%">
      <feColorMatrix type="saturate" values="0.3"/>
      <feComponentTransfer><feFuncR type="linear" slope="0.5"/><feFuncG type="linear" slope="0.42"/><feFuncB type="linear" slope="0.36"/></feComponentTransfer>
    </filter>
    <filter id="grim-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 0.95"/>
    </filter>
    <filter id="grim-stains" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="4" seed="13"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.03  0 0 0 0 0.02  0 0 0 -2.2 1.25"/>
    </filter>
    <radialGradient id="grim-vignette" cx="50%" cy="50%" r="72%">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.7"/>
    </radialGradient>
    <linearGradient id="grim-land" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#5a4d3b"/><stop offset="1" stop-color="#3b3227"/>
    </linearGradient>`;
  const defsDoc = new DOMParser().parseFromString(`<svg xmlns="${NS}"><defs>${defsMarkup}</defs></svg>`, 'image/svg+xml');
  svg.insertBefore(doc.importNode(defsDoc.documentElement.firstChild, true), svg.firstChild);

  // Sea: near-black, slightly lighter towards the coast.
  set($('oceanBase'), { fill: '#05080a' });
  for (const p of $('oceanLayers')?.querySelectorAll('path') || []) set(p, { fill: '#1a272c', opacity: '0.42', stroke: null });

  // Land: dark umber, masked to the coastline, with stains.
  const land = $('landmass');
  set(land, { fill: 'url(#grim-land)', mask: 'url(#land)', opacity: '1' });
  if (land) land.after(el('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#grim-stains)', mask: 'url(#land)', opacity: '0.9' }));
  // Realm colours: drained and darkened.
  set($('provs'), { opacity: '0.55', filter: 'url(#grim-desat)' });
  set($('statesBody'), { opacity: '0.35', filter: 'url(#grim-desat)' });
  // Water
  set($('rivers'), { fill: '#1f3946' });
  set($('freshwater'), { fill: '#122229', opacity: '0.95', stroke: '#0a1418' });
  set($('salt'), { fill: '#15241f', opacity: '0.95', stroke: '#0b1612' });
  set($('sinkhole'), { fill: '#0f1b21', stroke: '#091116' });
  set($('frozen'), { fill: '#3a464d', stroke: '#2a3439' });
  set($('dry'), { fill: '#3b3428', stroke: '#2a241b' });
  set($('lava'), { fill: '#7a1d08' });
  set($('ice'), { fill: '#3c4950', stroke: '#2a3439', filter: null, opacity: '0.85' });
  // Coasts & borders
  // Azgaar's own CSS gives coastlines fill:none; without it they paint the land solid black.
  set($('coastline'), { fill: 'none' });
  set($('sea_island'), { fill: 'none', stroke: '#000000', 'stroke-width': '0.9', opacity: '0.95', filter: null, style: null });
  set($('lake_island'), { fill: 'none', stroke: '#091116', 'stroke-width': '0.5' });
  set($('stateBorders'), { stroke: '#8c1d1d', 'stroke-width': '1.2', 'stroke-dasharray': '4 2', opacity: '0.9' });
  set($('provinceBorders'), { stroke: '#5c4c3a', 'stroke-width': '0.45', opacity: '0.55' });
  // Routes
  set($('roads'), { stroke: '#a07f48', opacity: '0.55' });
  set($('trails'), { stroke: '#7c6747', opacity: '0.45' });
  set($('searoutes'), { stroke: '#4d5f66', opacity: '0.4' });
  // Settlements: hamlets and villages are clutter on a whole-world map, so only towns and larger keep labels.
  const SMALL = ['hamlet', 'village'];
  for (const g of [...($('burgIcons')?.children || [])]) {
    if (SMALL.includes(g.id)) { g.remove(); continue; }
    set(g, { fill: '#c9b78c', 'fill-opacity': '0.95', stroke: '#120d0a' });
  }
  for (const g of [...($('burgLabels')?.children || []), $('addedLabels')]) {
    if (!g) continue;
    if (SMALL.includes(g.id)) { g.remove(); continue; }
    const fs = parseFloat(g.getAttribute('font-size')) || 3;
    set(g, { fill: '#d4c49e', stroke: '#0b0806', 'stroke-width': String(Math.max(0.2, fs * 0.22)), 'paint-order': 'stroke', style: null, 'stroke-linejoin': 'round' });
  }
  const statesFont = parseFloat($('states')?.getAttribute('font-size')) || 12;
  set($('states'), { fill: '#e8d6a8', stroke: '#0b0806', 'stroke-width': '2.4', 'paint-order': 'stroke', 'stroke-linejoin': 'round', style: 'font-variant: small-caps', class: null, opacity: '0.95', 'font-size': String(statesFont * 0.82) });
  for (const n of doc.querySelectorAll('[font-family]')) n.setAttribute('font-family', SERIF);

  // Overlays: grain, vignette, frame, compass and title cartouche.
  const top = el('g', { id: 'grim-overlay' }, svg);
  el('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#grim-grain)', opacity: '0.3' }, top);
  el('rect', { x: 0, y: 0, width: W, height: H, fill: 'url(#grim-vignette)' }, top);
  el('rect', { x: 6, y: 6, width: W - 12, height: H - 12, fill: 'none', stroke: '#6e5a39', 'stroke-width': '2' }, top);
  el('rect', { x: 11, y: 11, width: W - 22, height: H - 22, fill: 'none', stroke: '#3b3022', 'stroke-width': '1' }, top);
  const cx = W - 70, cy = 70;
  const compass = el('g', { transform: `translate(${cx},${cy})`, opacity: '0.85' }, top);
  el('circle', { r: 30, fill: 'none', stroke: '#8a7650', 'stroke-width': '1.2' }, compass);
  el('circle', { r: 24, fill: 'none', stroke: '#5a4a32', 'stroke-width': '0.6' }, compass);
  el('path', { d: 'M0 -40 L6 0 L0 40 L-6 0 Z M-40 0 L0 6 L40 0 L0 -6 Z', fill: '#2a2118', stroke: '#b09a6a', 'stroke-width': '0.8' }, compass);
  el('path', { d: 'M0 -40 L6 0 L-6 0 Z', fill: '#8c1d1d' }, compass);
  const n = el('text', { y: -46, 'text-anchor': 'middle', fill: '#d4c49e', 'font-family': SERIF, 'font-size': '12', 'font-weight': 'bold' }, compass);
  n.textContent = 'N';
  if (title) {
    const t = el('g', { transform: 'translate(34,52)' }, top);
    el('path', { d: `M-14 -34 H${title.length * 26 + 30} L${title.length * 26 + 44} -10 L${title.length * 26 + 30} 14 H-14 L-28 -10 Z`, fill: '#0d0a08', 'fill-opacity': '0.78', stroke: '#6e5a39', 'stroke-width': '1.4' }, t);
    const tt = el('text', { x: 6, y: 0, fill: '#e2d0a4', stroke: '#000', 'stroke-width': '0.6', 'font-family': SERIF, 'font-size': '34', 'letter-spacing': '9' }, t);
    tt.textContent = title.toUpperCase();
  }
  return new XMLSerializer().serializeToString(svg);
}

/** Render SVG markup to an image Blob at the given scale. */
async function rasterize(svgMarkup, width, height, scale) {
  const url = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const g = canvas.getContext('2d');
    g.fillStyle = '#05080a';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.9));
    return blob || await new Promise((r) => canvas.toBlob(r, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Import an Azgaar .map (text) as a Lorekeeper map with pins.
 * @param {string} text
 * @param {object} [o]
 * @param {string} [o.fallbackName]
 * @param {boolean} [o.makeDefault]
 * @param {string} [o.source] identifies a bundled map so it is only seeded once
 */
export async function importAzgaar(text, { fallbackName = 'Map', makeDefault = false, source = null } = {}) {
  const az = parseAzgaar(text, fallbackName);
  const doc = new DOMParser().parseFromString(az.svg, 'image/svg+xml');
  const W = parseFloat(doc.documentElement.getAttribute('width')) || 1272;
  const H = parseFloat(doc.documentElement.getAttribute('height')) || 635;
  const S = RENDER_SCALE;
  const image = await rasterize(grimify(az.svg, az.name), W, H, S);

  const pins = [];
  const stateName = (i) => az.states.find((s) => s && s.i === i);
  for (const b of az.burgs) {
    if (!b || !b.capital || b.removed) continue;
    const st = stateName(b.state);
    pins.push({ id: uid(), x: b.x * S, y: b.y * S, label: b.name, icon: '🏰', color: '#c4a032', entryId: null, submapId: null,
      notes: `Capital of ${st?.fullName || st?.name || 'a realm'}.` });
  }
  for (const m of az.markers) {
    if (!m || m.x == null) continue;
    const note = az.notes.find((n) => n.id === `marker${m.i}`);
    pins.push({ id: uid(), x: m.x * S, y: m.y * S, label: note?.name || m.type || 'Marker', icon: m.icon || '❓', color: '#6e2b8a', entryId: null, submapId: null,
      notes: note?.legend || '', hidden: false, kind: 'marker' });
  }

  const miles = az.unit === 'km' ? az.scale * 0.621371 : az.unit === 'mi' ? az.scale : null;
  const map = {
    id: uid(), name: az.name, image, width: Math.round(W * S), height: Math.round(H * S),
    milesPerPx: miles ? miles / S : null, parentId: null, pins, createdAt: Date.now(), source,
  };
  if (makeDefault) map.isDefault = true;
  save('maps', map);
  return map;
}
