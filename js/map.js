// World map: your own image with pins, distance/travel measuring and nested sub-maps.
import { h, fill, s, uid, clamp, blobUrl, pickFile, toast, ask } from './dom.js';
import { state, save, remove, onChange } from './state.js';
import { colorOf } from './types.js';
import { newEntry } from './bible.js';
import { importAzgaar } from './azgaar.js';

const ICONS = ['📍', '🏰', '🏠', '🏘️', '⛺', '⚔️', '💀', '🐉', '⛪', '🌲', '⛰️', '⚓', '🕳️', '💎', '❓', '⭐'];
const COLORS = ['#d65a52', '#e08a3c', '#c4a032', '#4fa86a', '#4189cc', '#9160cc', '#e8e4da', '#2b2b2b'];
// Miles per day of travel (8 hours), roughly D&D normal pace.
const PACES = [['On foot', 24], ['On horse', 30], ['By wagon', 18]];

export async function createMapFromFile(file, parentId = null) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch { /* handled below */ }
  URL.revokeObjectURL(url);
  if (!img.naturalWidth) { toast("Couldn't read that image.", 'error'); return null; }
  const m = {
    id: uid(), name: file.name.replace(/\.[^.]+$/, '') || 'Map', image: file,
    width: img.naturalWidth, height: img.naturalHeight, milesPerPx: null, parentId, pins: [], createdAt: Date.now(),
  };
  save('maps', m);
  return m;
}

async function uploadMap(parentId = null) {
  const f = await pickFile('image/*,.map');
  if (!f) return null;
  if (/\.map$/i.test(f.name)) {
    toast(`Reading ${f.name} and repainting it… this takes a few seconds.`);
    try {
      const m = await importAzgaar(await f.text(), { fallbackName: f.name.replace(/\s*\d{4}-\d{2}-\d{2}.*$|\.map$/gi, '') || 'Map' });
      if (parentId) { m.parentId = parentId; save('maps', m); }
      toast(`Imported ${m.name} with ${m.pins.length} pins.`);
      return m;
    } catch (e) {
      toast(`${f.name}: ${e.message}`, 'error');
      return null;
    }
  }
  return createMapFromFile(f, parentId);
}

/** Make one map the default shown when opening the World Map tab. */
export function setDefaultMap(map) {
  for (const m of state.maps.values()) if (m.isDefault && m !== map) { m.isDefault = false; save('maps', m); }
  map.isDefault = true;
  save('maps', map);
}

function fmtMiles(mi) { return mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString(); }
function fmtTravel(miles, perDay) {
  const days = miles / perDay;
  if (days < 1) { const hrs = days * 8; return hrs < 1 ? `${Math.round(hrs * 60)} min` : `${hrs.toFixed(1)} hours`; }
  return `${days < 10 ? days.toFixed(1) : Math.round(days)} days`;
}

export function render(root, [mapId, pinId]) {
  const all = [...state.maps.values()].sort((a, b) => a.createdAt - b.createdAt);
  const map = (mapId && state.maps.get(mapId)) || all.find((m) => m.isDefault) || all.find((m) => !m.parentId) || all[0];

  if (!map) {
    root.append(h('div', { class: 'empty-state center' },
      h('h2', {}, 'World Map'),
      h('p', {}, 'Upload your map image (JPG, PNG or WebP), or a .map file saved from Azgaar\'s Fantasy Map Generator. Drop pins on it, link them to World Bible entries, measure travel time and nest sub-maps inside pins.'),
      h('button', { class: 'btn primary', onClick: async () => { const m = await uploadMap(); if (m) location.hash = '#/map/' + m.id; } }, 'Upload a map')));
    return null;
  }
  if (map.id !== mapId) history.replaceState(null, '', '#/map/' + map.id);

  let mode = 'select';
  let selected = (pinId && map.pins.find((p) => p.id === pinId)) || null;
  let view = { x: 0, y: 0, k: 1 };
  let measure = [];
  let hover = null;
  let drag = null;

  const img = h('img', { class: 'map-img', src: blobUrl(map.image), draggable: false, alt: map.name });
  const overlay = s('svg', { class: 'overlay', viewBox: `0 0 ${map.width} ${map.height}` });
  const pinsLayer = h('div', { class: 'pins' });
  const stage = h('div', { class: 'stage', style: `width:${map.width}px;height:${map.height}px` }, img, pinsLayer, overlay);
  const hud = h('div', { class: 'hud hidden' });
  const viewport = h('div', { class: 'viewport mode-select' }, stage, hud);
  const toolbar = h('div', { class: 'map-toolbar' });
  const panel = h('aside', { class: 'pane map-panel' });
  root.append(h('div', { class: 'mapview' }, h('div', { class: 'map-main' }, toolbar, viewport), panel));

  // ---- view transform ---------------------------------------------------
  function apply() {
    stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    stage.style.setProperty('--k', view.k);
    viewport.classList.toggle('far', view.k < fitK() * 1.7); // hide pin labels when zoomed out
    if (measure.length) drawOverlay();
  }
  function fitK() {
    const r = viewport.getBoundingClientRect();
    return Math.min(r.width / map.width, r.height / map.height) * 0.95 || 1;
  }
  function fit() {
    const r = viewport.getBoundingClientRect();
    const k = fitK();
    view = { k, x: (r.width - map.width * k) / 2, y: (r.height - map.height * k) / 2 };
    apply();
  }
  function centerOn(p, k = view.k) {
    const r = viewport.getBoundingClientRect();
    view = { k, x: r.width / 2 - p.x * k, y: r.height / 2 - p.y * k };
    apply();
  }
  const toImg = (ev) => {
    const r = viewport.getBoundingClientRect();
    return { x: (ev.clientX - r.left - view.x) / view.k, y: (ev.clientY - r.top - view.y) / view.k };
  };
  const inside = (p) => p.x >= 0 && p.y >= 0 && p.x <= map.width && p.y <= map.height;

  // ---- pins ---------------------------------------------------------------
  function pinEl(p) {
    const entry = p.entryId && state.entries.get(p.entryId);
    return h('div', {
      class: 'pin' + (p === selected ? ' selected' : ''), 'data-id': p.id,
      style: `left:${p.x}px;top:${p.y}px;--c:${p.color}`,
      title: p.label + (entry ? ` — ${entry.title}` : '') + (p.submapId ? ' (double-click to open sub-map)' : ''),
    },
      h('div', { class: 'pin-head' }, p.icon),
      h('div', { class: 'pin-label' }, p.label, p.submapId ? ' ⤵' : ''));
  }
  // Imported points of interest stay hidden until switched on (a selected one always shows).
  const visiblePins = () => map.pins.filter((p) => p.kind !== 'marker' || map.showMarkers || p === selected);
  function drawPins() { fill(pinsLayer, ...visiblePins().map(pinEl)); }

  function select(p, focus = false) {
    selected = p;
    drawPins();
    drawPanel();
    if (focus) panel.querySelector('.pin-label-input')?.select();
  }

  // ---- measuring overlay -------------------------------------------------
  function drawOverlay() {
    fill(overlay);
    const pts = [...measure];
    if (pts.length === 1 && hover) pts.push(hover);
    if (pts.length === 2) {
      overlay.append(s('line', { x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y, class: 'measure-line' + (mode === 'scale' ? ' scale' : '') }));
    }
    for (const p of pts) overlay.append(s('circle', { cx: p.x, cy: p.y, r: 6 / view.k, class: 'measure-pt' }));
    // HUD with a live readout
    if (pts.length === 2) {
      const px = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      hud.textContent = map.milesPerPx && mode === 'measure' ? `${fmtMiles(px * map.milesPerPx)} miles` : `${Math.round(px)} px`;
      hud.classList.remove('hidden');
    } else hud.classList.add('hidden');
  }
  const measuredPx = () => (measure.length === 2 ? Math.hypot(measure[1].x - measure[0].x, measure[1].y - measure[0].y) : 0);

  function setMode(m) {
    mode = m;
    measure = [];
    hover = null;
    viewport.className = 'viewport mode-' + m;
    if (m !== 'select') selected = null;
    drawToolbar();
    drawOverlay();
    drawPins();
    drawPanel();
  }

  // ---- pointer input -------------------------------------------------------
  viewport.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const pinNode = ev.target.closest('.pin');
    drag = {
      sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y, moved: false, pinNode,
      pin: pinNode && mode === 'select' ? map.pins.find((p) => p.id === pinNode.dataset.id) : null,
    };
    viewport.setPointerCapture(ev.pointerId);
  });
  viewport.addEventListener('pointermove', (ev) => {
    if (drag) {
      const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > 4) { drag.moved = true; viewport.classList.add('dragging'); }
      if (drag.moved) {
        if (drag.pin) {
          const p = toImg(ev);
          drag.pin.x = clamp(p.x, 0, map.width);
          drag.pin.y = clamp(p.y, 0, map.height);
          drag.pinNode.style.left = drag.pin.x + 'px';
          drag.pinNode.style.top = drag.pin.y + 'px';
        } else {
          view.x = drag.vx + dx;
          view.y = drag.vy + dy;
          apply();
        }
      }
    }
    if ((mode === 'measure' || mode === 'scale') && measure.length === 1 && !drag?.moved) { hover = toImg(ev); drawOverlay(); }
  });
  viewport.addEventListener('pointerup', (ev) => {
    const d = drag;
    drag = null;
    viewport.classList.remove('dragging');
    if (!d) return;
    if (d.moved) { if (d.pin) save('maps', map); return; }
    if (d.pinNode && mode === 'select') { select(map.pins.find((p) => p.id === d.pinNode.dataset.id) || null); return; }
    const p = toImg(ev);
    if (mode === 'pin') {
      if (!inside(p)) return;
      const pin = { id: uid(), x: p.x, y: p.y, label: 'New pin', icon: '📍', color: COLORS[0], entryId: null, submapId: null, notes: '' };
      map.pins.push(pin);
      save('maps', map);
      mode = 'select';
      viewport.className = 'viewport mode-select';
      drawToolbar();
      select(pin, true);
    } else if (mode === 'measure' || mode === 'scale') {
      if (measure.length >= 2) measure = [];
      measure.push(p);
      hover = null;
      drawOverlay();
      drawPanel();
    } else if (selected) {
      select(null);
    }
  });
  viewport.addEventListener('pointercancel', () => { drag = null; viewport.classList.remove('dragging'); });
  viewport.addEventListener('dblclick', (ev) => {
    const pinNode = ev.target.closest('.pin');
    const p = pinNode && map.pins.find((x) => x.id === pinNode.dataset.id);
    if (p?.submapId && state.maps.has(p.submapId)) location.hash = '#/map/' + p.submapId;
  });
  viewport.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const r = viewport.getBoundingClientRect();
    const cx = ev.clientX - r.left, cy = ev.clientY - r.top;
    const k2 = clamp(view.k * Math.exp(-ev.deltaY * 0.0015), fitK() * 0.5, 8);
    view.x = cx - ((cx - view.x) * k2) / view.k;
    view.y = cy - ((cy - view.y) * k2) / view.k;
    view.k = k2;
    apply();
  }, { passive: false });

  function onKey(ev) {
    if (ev.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (ev.key === 'Escape') setMode('select');
    else if (ev.key === 'p') setMode('pin');
    else if (ev.key === 'm') setMode('measure');
    else if (ev.key === 'f') fit();
  }
  document.addEventListener('keydown', onKey);

  // ---- toolbar ---------------------------------------------------------------
  function drawToolbar() {
    const crumbs = [];
    for (let m = state.maps.get(map.parentId), guard = 0; m && guard < 20; m = state.maps.get(m.parentId), guard++) crumbs.unshift(m);
    const modeBtn = (m, label, title) => h('button', { class: 'btn tool-btn' + (mode === m ? ' on' : ''), title, onClick: () => setMode(mode === m ? 'select' : m) }, label);
    fill(toolbar, 
      h('div', { class: 'crumbs' },
        crumbs.map((m) => [h('a', { href: '#/map/' + m.id }, m.name), h('span', { class: 'muted' }, ' › ')]),
        h('select', {
          class: 'map-select', 'aria-label': 'Choose map',
          onChange: async (ev) => {
            if (ev.target.value === '__new') { const m = await uploadMap(); if (m) location.hash = '#/map/' + m.id; else drawToolbar(); }
            else location.hash = '#/map/' + ev.target.value;
          },
        },
          [...state.maps.values()].sort((a, b) => a.createdAt - b.createdAt)
            .map((m) => h('option', { value: m.id, selected: m.id === map.id }, (m.parentId ? '↳ ' : '') + m.name)),
          h('option', { value: '__new' }, '+ Upload new map…'))),
      h('div', { class: 'tools' },
        modeBtn('pin', '📍 Add pin', 'Click the map to drop a pin (P)'),
        modeBtn('measure', '📏 Measure', 'Click two points to measure distance (M)'),
        h('button', { class: 'btn tool-btn', title: 'Fit map to screen (F)', onClick: fit }, '⤢ Fit')),
    );
  }

  // ---- side panel ----------------------------------------------------------
  function drawPanel() {
    if (mode === 'measure' || mode === 'scale') return drawMeasurePanel();
    if (selected) return drawPinPanel(selected);
    drawMapPanel();
  }

  function drawMeasurePanel() {
    const px = measuredPx();
    if (mode === 'scale') {
      const miles = h('input', { type: 'number', min: '0', step: 'any', class: 'num', placeholder: 'miles' });
      fill(panel, 
        h('h3', {}, 'Set map scale'),
        h('p', { class: 'muted' }, 'Click two points on the map that you know the distance between, for example a scale bar or two towns.'),
        px ? h('div', { class: 'stack' },
          h('label', {}, 'That line is ', miles, ' miles long'),
          h('button', {
            class: 'btn primary', onClick: () => {
              const v = parseFloat(miles.value);
              if (!(v > 0)) return toast('Enter a distance in miles.');
              map.milesPerPx = v / px;
              save('maps', map);
              toast('Scale saved.');
              setMode('measure');
            },
          }, 'Save scale')) : null,
        h('button', { class: 'btn ghost', onClick: () => setMode('select') }, 'Cancel'));
      if (px) miles.focus();
      return;
    }
    const miles = map.milesPerPx ? px * map.milesPerPx : 0;
    fill(panel, 
      h('h3', {}, 'Measure distance'),
      !map.milesPerPx
        ? h('div', { class: 'note' }, 'This map has no scale yet, so distances are in pixels. ', h('button', { class: 'btn small', onClick: () => setMode('scale') }, 'Set scale'))
        : null,
      px
        ? h('div', { class: 'measure-result' },
          h('div', { class: 'big' }, map.milesPerPx ? `${fmtMiles(miles)} miles` : `${Math.round(px)} px`),
          map.milesPerPx ? h('table', { class: 'paces' }, PACES.map(([name, perDay]) => h('tr', {}, h('td', {}, name), h('td', {}, fmtTravel(miles, perDay))))) : null,
          h('p', { class: 'muted small' }, 'Travel assumes 8 hours a day at a normal pace. Click again to start a new line.'))
        : h('p', { class: 'muted' }, 'Click a start point, then an end point.'),
      map.milesPerPx ? h('button', { class: 'btn ghost small', onClick: () => setMode('scale') }, 'Re-calibrate scale') : null,
      h('button', { class: 'btn ghost', onClick: () => setMode('select') }, 'Done'));
  }

  function drawPinPanel(p) {
    const entry = p.entryId && state.entries.get(p.entryId);
    const sub = p.submapId && state.maps.get(p.submapId);
    const label = h('input', {
      class: 'pin-label-input', value: p.label, placeholder: 'Label',
      onInput: (ev) => { p.label = ev.target.value; save('maps', map); drawPins(); },
    });
    const entrySel = h('select', {
      onChange: (ev) => { p.entryId = ev.target.value || null; save('maps', map); drawPins(); drawPanel(); },
    }, h('option', { value: '' }, '— none —'),
      [...state.entries.values()].sort((a, b) => a.title.localeCompare(b.title))
        .map((e) => h('option', { value: e.id, selected: e.id === p.entryId }, `${e.title} (${e.type})`)));
    const subSel = h('select', {
      onChange: async (ev) => {
        if (ev.target.value === '__new') {
          const m = await uploadMap(map.id);
          if (m) p.submapId = m.id;
        } else p.submapId = ev.target.value || null;
        save('maps', map);
        drawPins();
        drawPanel();
      },
    }, h('option', { value: '' }, '— none —'),
      [...state.maps.values()].filter((m) => m.id !== map.id)
        .map((m) => h('option', { value: m.id, selected: m.id === p.submapId }, m.name)),
      h('option', { value: '__new' }, '+ Upload new sub-map…'));

    fill(panel, 
      h('div', { class: 'panel-head' }, h('h3', {}, 'Pin'), h('button', { class: 'icon-btn', title: 'Close', onClick: () => select(null) }, '✕')),
      h('label', { class: 'field-label' }, 'Label'), label,
      h('label', { class: 'field-label' }, 'Icon'),
      h('div', { class: 'icon-grid' }, ICONS.map((i) => h('button', {
        class: 'icon-choice' + (p.icon === i ? ' on' : ''), onClick: () => { p.icon = i; save('maps', map); drawPins(); drawPanel(); },
      }, i))),
      h('label', { class: 'field-label' }, 'Colour'),
      h('div', { class: 'swatches' }, COLORS.map((c) => h('button', {
        class: 'swatch' + (p.color === c ? ' on' : ''), style: `--c:${c}`, title: c,
        onClick: () => { p.color = c; save('maps', map); drawPins(); drawPanel(); },
      }))),
      h('label', { class: 'field-label' }, 'World Bible entry'), entrySel,
      h('div', { class: 'row' },
        entry ? h('a', { class: 'btn small', href: '#/bible/' + entry.id, style: `--c:${colorOf(entry.type)}` }, 'Open entry →') : null,
        !entry ? h('button', {
          class: 'btn small', onClick: () => {
            const e = newEntry(p.label || 'New place', 'Location');
            p.entryId = e.id;
            save('maps', map);
            drawPanel();
          },
        }, '+ Create entry from pin') : null),
      h('label', { class: 'field-label' }, 'Sub-map (e.g. a city or dungeon)'), subSel,
      sub ? h('div', { class: 'row' }, h('a', { class: 'btn small', href: '#/map/' + sub.id }, 'Open sub-map →')) : null,
      h('label', { class: 'field-label' }, 'Notes'),
      h('textarea', { rows: 4, value: p.notes || '', placeholder: 'Quick notes…', onInput: (ev) => { p.notes = ev.target.value; save('maps', map); } }),
      h('p', { class: 'muted small' }, 'Drag the pin to move it.'),
      h('button', {
        class: 'btn danger ghost', onClick: () => {
          map.pins = map.pins.filter((x) => x !== p);
          save('maps', map);
          select(null);
        },
      }, 'Delete pin'));
  }

  function drawMapPanel() {
    const parent = map.parentId && state.maps.get(map.parentId);
    fill(panel, 
      h('h3', {}, 'Map'),
      h('label', { class: 'field-label' }, 'Name'),
      h('input', { value: map.name, onInput: (ev) => { map.name = ev.target.value; save('maps', map); } }),
      map.isDefault
        ? h('p', { class: 'small default-badge' }, '★ Default map: opens when you click World Map')
        : h('button', { class: 'btn small', onClick: () => { setDefaultMap(map); drawPanel(); toast(`${map.name} is now the default map.`); } }, '☆ Set as default map'),
      h('label', { class: 'field-label' }, 'Scale'),
      h('div', { class: 'row' },
        h('span', {}, !map.milesPerPx ? 'Not set' : map.milesPerPx >= 0.5 ? `1 px ≈ ${map.milesPerPx.toFixed(2)} mi` : `1 mile ≈ ${Math.round(1 / map.milesPerPx)} px`),
        h('button', { class: 'btn small', onClick: () => setMode('scale') }, map.milesPerPx ? 'Change' : 'Set scale')),
      parent ? h('p', { class: 'small' }, 'Inside ', h('a', { href: '#/map/' + parent.id }, parent.name)) : null,
      map.pins.some((p) => p.kind === 'marker') ? h('label', { class: 'check-row' },
        h('input', { type: 'checkbox', checked: !!map.showMarkers, onChange: (ev) => { map.showMarkers = ev.target.checked; save('maps', map); drawPins(); } }),
        `Show points of interest (${map.pins.filter((p) => p.kind === 'marker').length})`) : null,
      h('label', { class: 'field-label' }, `Pins (${map.pins.length})`),
      map.pins.length
        ? h('div', { class: 'pin-list' }, [...map.pins].sort((a, b) => a.label.localeCompare(b.label)).map((p) => h('button', {
          class: 'pin-row', style: `--c:${p.color}`,
          onClick: () => { select(p); centerOn(p, Math.max(view.k, fitK() * 2)); },
        }, h('span', { class: 'pin-row-icon' }, p.icon), p.label)))
        : h('p', { class: 'muted small' }, 'Press 📍 Add pin, then click the map.'),
      h('p', { class: 'muted small help' }, 'Scroll to zoom, drag to pan. Double-click a pin with ⤵ to open its sub-map.'),
      h('button', {
        class: 'btn danger ghost', onClick: async () => {
          if (!(await ask(`Delete the map “${map.name}”? Its pins are deleted too. Entries are kept.`, { ok: 'Delete', danger: true }))) return;
          for (const m of state.maps.values()) {
            let changed = false;
            if (m.parentId === map.id) { m.parentId = null; changed = true; }
            for (const p of m.pins) if (p.submapId === map.id) { p.submapId = null; changed = true; }
            if (changed) save('maps', m);
          }
          remove('maps', map.id);
          location.hash = map.parentId && state.maps.has(map.parentId) ? '#/map/' + map.parentId : '#/map';
        },
      }, 'Delete map'));
  }

  drawToolbar();
  drawPins();
  drawPanel();
  requestAnimationFrame(() => {
    if (selected) centerOn(selected, Math.max(1, fitK()));
    else fit();
  });

  const off = onChange((kind) => {
    if (kind === 'maps') drawToolbar();
    if (kind === 'entries') drawPins();
    if (kind === 'all') location.hash = '#/map';
  });
  const ro = new ResizeObserver(() => apply());
  ro.observe(viewport);

  return () => { off(); ro.disconnect(); document.removeEventListener('keydown', onKey); };
}
