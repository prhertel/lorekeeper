// App shell: sidebar navigation, hash routing, settings and backup.
import { load, state, save, onChange, setPlayerView, hasData } from './state.js';
import { h, fill, toast, pickFile, pendingFlushes, ask, uid } from './dom.js';
import * as bible from './bible.js';
import * as maps from './map.js';
import * as campaigns from './campaigns.js';
import * as combat from './combat.js';
import { exportAll, importAll } from './io.js';
import { loadSample } from './sample.js';

const VIEWS = { bible, map: maps, campaigns, combat };
const NAV = [
  ['bible', '📖', 'World Bible'],
  ['map', '🗺️', 'World Map'],
  ['campaigns', '📜', 'Campaigns'],
  ['combat', '⚔️', 'Combat'],
];

const main = document.getElementById('main');
const sidebar = document.getElementById('sidebar');
let cleanup = null;
let currentView = null;

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const view = VIEWS[parts[0]] ? parts[0] : 'bible';
  return { view, params: parts.slice(1) };
}

function route() {
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  const { view, params } = parseRoute();
  currentView = view;
  drawNav();
  const container = h('div', { class: 'view view-' + view });
  fill(main, container);
  try {
    cleanup = VIEWS[view].render(container, params) || null;
  } catch (e) {
    console.error(e);
    container.append(h('div', { class: 'empty-state' }, h('h2', {}, 'Something went wrong'), h('pre', {}, String(e.stack || e))));
  }
}

// Themes: index.html applies the saved one before the page draws; this switches it live.
const THEMES = [['plain', 'Plain'], ['wood', 'Wooden (pixel)'], ['gilded', 'Gilded']];
const THEME_CSS = { gilded: 'css/theme-gilded.css', wood: 'css/theme-wood.css' };
const currentTheme = () => document.documentElement.getAttribute('data-theme') || 'plain';
// The Wooden theme uses licensed art that isn't redistributed (it's kept out of the public repo),
// so only offer it where that art is actually present.
const THEME_ASSET = { wood: 'assets/ui/wood/frame.png' };
const themeAvailable = new Map();
async function checkThemeAssets() {
  for (const [id, url] of Object.entries(THEME_ASSET)) {
    try { themeAvailable.set(id, (await fetch(url, { method: 'HEAD', cache: 'no-cache' })).ok); } catch { themeAvailable.set(id, false); }
  }
  if (THEME_ASSET[currentTheme()] && !themeAvailable.get(currentTheme())) setTheme('plain'); // saved theme's art is missing here
  drawNav();
}
const themeOffered = (id) => !THEME_ASSET[id] || themeAvailable.get(id) === true;
function setTheme(id) {
  const link = document.getElementById('theme-css');
  if (THEME_CSS[id]) link.setAttribute('href', THEME_CSS[id]); else link.removeAttribute('href');
  document.documentElement.setAttribute('data-theme', id);
  try { localStorage.setItem('lk.theme', id); } catch { /* storage blocked */ }
}

function drawNav() {
  fill(sidebar, 
    h('div', { class: 'brand' }, h('span', { class: 'brand-mark' }, '✦'), 'Lorekeeper'),
    h('div', { class: 'nav' }, NAV.map(([id, icon, label]) =>
      h('a', { href: '#/' + id, class: currentView === id ? 'active' : '' }, h('span', { class: 'nav-icon' }, icon), h('span', { class: 'nav-label' }, label)))),
    h('div', { class: 'side-bottom' },
      h('label', { class: 'switch', title: 'Hide DM secrets, e.g. when sharing your screen' },
        h('input', { type: 'checkbox', checked: state.playerView, onChange: (e) => setPlayerView(e.target.checked) }),
        h('span', { class: 'switch-track' }),
        h('span', { class: 'nav-label' }, 'Player view')),
      h('label', { class: 'theme-pick', title: 'Look of the app (saved in this browser)' },
        h('span', { class: 'nav-label' }, 'Theme'),
        h('select', { 'aria-label': 'Theme', onChange: (e) => setTheme(e.target.value) },
          THEMES.filter(([id]) => themeOffered(id) || currentTheme() === id)
            .map(([id, label]) => h('option', { value: id, selected: currentTheme() === id }, label)))),
      !hasData() ? h('button', {
        class: 'btn ghost small', onClick: async () => {
          await loadSample();
          toast('Sample world loaded.');
          location.hash = '#/bible';
          route();
        },
      }, '✨ Load sample world') : null,
      h('button', {
        class: 'btn ghost small', title: 'Download everything as one backup file',
        onClick: () => exportAll().then(() => toast('Backup downloaded.')).catch((e) => toast(e.message, 'error')),
      }, '⬇ Export backup'),
      h('button', {
        class: 'btn ghost small', title: 'Restore from a backup file (replaces current data)',
        onClick: async () => {
          const f = await pickFile('application/json,.json');
          if (!f) return;
          if (hasData() && !(await ask('Importing replaces everything currently in Lorekeeper. Continue?', { ok: 'Replace everything', danger: true }))) return;
          try {
            await importAll(f);
            toast('Backup restored.');
            location.hash = '#/bible';
            route();
          } catch (e) { toast(e.message, 'error'); }
        },
      }, '⬆ Import backup'),
      h('p', { class: 'muted tiny' }, 'Saved in this browser only. Export a backup now and then.')),
  );
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') for (const f of [...pendingFlushes]) f.flush();
});

(async () => {
  try {
    await load();
  } catch (e) {
    fill(main, h('div', { class: 'empty-state' }, h('h2', {}, 'Could not open storage'), h('p', {}, String(e.message || e))));
    return;
  }
  navigator.storage?.persist?.().catch(() => {});
  document.body.classList.toggle('player-view', state.playerView);
  addEventListener('hashchange', route);
  let hadData = hasData();
  onChange(() => { if (hasData() !== hadData) { hadData = hasData(); drawNav(); } });
  route();
  checkThemeAssets();
  // The map first, so built-in places can pin themselves onto it.
  seedDefaultMap()
    .then(() => seedBundled('assets/party.json', 'characters', 'party member'))
    .then(() => seedBundled('assets/world.json', 'entries', 'world entry', 'world entries'))
    .then(resolveKeyLinks)
    .then(seedBundledMaps);
})();

/**
 * Extra built-in maps (assets/maps.json): plain images restyled to match Suxyland, imported once per
 * browser, with their own pins and an optional pin on a parent map that opens them.
 */
async function seedBundledMaps() {
  let data;
  try {
    const res = await fetch('assets/maps.json', { cache: 'no-cache' });
    if (!res.ok) return;
    data = await res.json();
  } catch { return; }
  const entryByKey = (k) => k && [...state.entries.values()].find((e) => e.partyKey === k);
  const pinFrom = (p, scale = 1) => ({
    id: uid(), x: p.x * scale, y: p.y * scale, label: p.label || 'Pin', icon: p.icon || '📍', color: p.color || '#e08a3c',
    entryId: entryByKey(p.entry)?.id || null, submapId: null, notes: p.notes || '', bundledKey: p.key || null,
  });
  let added = 0;
  for (const def of data.maps || []) {
    const source = `bundled:${def.key}`;
    let map = [...state.maps.values()].find((m) => m.source === source);
    if (map && (map.bundledVersion || 0) >= (def.version || 1)) continue;
    let img;
    try {
      const { grimRasterMap } = await import('./mapstyle.js');
      img = await grimRasterMap(def.src, { crop: def.crop, title: def.style === 'grim' ? def.name : '' });
    } catch (e) { console.error(e); continue; }
    const parent = def.parent && [...state.maps.values()].find((m) => m.source === def.parent);
    const isNew = !map;
    map ??= { id: uid(), pins: [], createdAt: Date.now(), source };
    Object.assign(map, {
      name: def.name, image: img.blob, width: img.width, height: img.height,
      milesPerPx: def.milesPerPx ?? map.milesPerPx ?? null, parentId: parent?.id || map.parentId || null, bundledVersion: def.version || 1,
    });
    for (const p of def.pins || []) if (!map.pins.some((x) => x.bundledKey === p.key)) map.pins.push(pinFrom(p));
    save('maps', map);
    // A pin on the parent map that opens this one.
    if (parent && def.parentPin && !parent.pins.some((x) => x.submapId === map.id)) {
      parent.pins.push({ ...pinFrom(def.parentPin, BUNDLED_MAP_SCALE), submapId: map.id });
      save('maps', parent);
    }
    if (isNew) added++;
  }
  if (added) toast(`Added ${added} built-in map${added > 1 ? 's' : ''}.`);
  if (added && currentView === 'map') route();
}

/**
 * Built-in entries link to each other with data-key="<key>" (entry IDs differ per browser).
 * Turn those into real @-mention links once the target entries exist.
 */
function resolveKeyLinks() {
  const byKey = new Map([...state.entries.values()].filter((e) => e.partyKey).map((e) => [e.partyKey, e]));
  const fix = (html) => html.replace(/<a class="mention" data-key="([^"]+)"([^>]*)>([^<]*)<\/a>/g, (whole, key, rest, text) => {
    const target = byKey.get(key);
    return target ? `<a class="mention" data-id="${target.id}" contenteditable="false">${target.title}</a>` : text;
  });
  let any = false;
  for (const e of byKey.values()) {
    let changed = false;
    for (const field of ['overview', 'secrets']) {
      if (e[field]?.includes('data-key=')) { e[field] = fix(e[field]); changed = true; }
    }
    if (changed) { save('entries', e); any = true; }
  }
  if (any && currentView === 'bible') route(); // show the finished links in an open entry
}

const BUNDLED_MAP_SCALE = 3; // the bundled map is rendered at 3x its Azgaar size (see azgaar.js)

/**
 * Built-in World Bible entries ship with the app (assets/party.json, assets/world.json). Each browser
 * adds them once; a higher `version` pushes updates (stats, write-up, picture) to browsers that
 * already have them. DM secrets and any picture a player uploaded are kept.
 */
async function seedBundled(url, listKey, singular, plural = singular + 's') {
  let data;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return;
    data = await res.json();
  } catch { return; }
  const { PORTRAITS, renderPortrait, renderCrop } = await import('./portraits.js');
  let added = 0, updated = 0;
  for (const ch of data[listKey] || []) {
    if (!ch.key || !ch.title) continue;
    const all = [...state.entries.values()];
    let e = all.find((x) => x.partyKey === ch.key)
      || all.find((x) => !x.partyKey && x.title.trim().toLowerCase() === ch.title.trim().toLowerCase());
    if (e && (e.partyVersion || 0) >= (ch.version || 1)) { placePin(e, ch); continue; }
    const isNew = !e;
    e ??= { id: uid(), image: null, secrets: '', createdAt: Date.now() };
    Object.assign(e, {
      title: ch.title, type: ch.type || 'Party Member', overview: ch.overview || e.overview || '',
      secrets: e.secrets || ch.secrets || '', stats: { ...(e.stats || {}), ...(ch.stats || {}) },
      gen: ch.gen || e.gen, partyKey: ch.key, partyVersion: ch.version || 1,
    });
    // Pictures: replace one that came from the bundle or the portrait library, never a player's own upload.
    const replaceable = !e.image || e.imageFromParty || !!e.portraitId;
    if (replaceable && ch.image?.src) {
      try {
        e.image = await renderCrop(ch.image);
        e.portraitId = null;
        e.imageFromParty = true;
      } catch { /* keep the current picture */ }
    } else if (!e.image && ch.portraitId) {
      const p = PORTRAITS.find((x) => x.id === ch.portraitId);
      if (p) { try { e.image = await renderPortrait(p); e.portraitId = p.id; } catch { /* no picture */ } }
    }
    save('entries', e);
    placePin(e, ch);
    if (isNew) added++; else updated++;
  }
  if (added) toast(`Added ${added} ${added > 1 ? plural : singular} to the World Bible.`);
  if (updated) toast(`Updated ${updated} ${updated > 1 ? plural : singular}.`);
  if ((added || updated) && ['bible', 'combat', 'map'].includes(currentView)) route();
}

/** Put a built-in entry's pin on its bundled map once (if the DM deletes it later, it stays deleted). */
function placePin(e, ch) {
  if (!ch.pin || e.pinPlaced) return;
  const map = [...state.maps.values()].find((m) => m.source === ch.pin.map);
  if (!map) return; // map not imported yet: try again next load
  if (!map.pins.some((p) => p.entryId === e.id)) {
    map.pins.push({
      id: uid(), x: ch.pin.x * BUNDLED_MAP_SCALE, y: ch.pin.y * BUNDLED_MAP_SCALE, label: ch.title,
      icon: ch.pin.icon || '📍', color: ch.pin.color || '#e08a3c', entryId: e.id, submapId: null, notes: '',
    });
    save('maps', map);
  }
  e.pinPlaced = true;
  save('entries', e);
}

/** The campaign's world map ships with the app: import it once (restyled) and make it the default. */
const BUNDLED_MAP = { key: 'lk.seed.suxyland', source: 'bundled:suxyland', url: 'assets/suxyland.map', name: 'Suxyland' };
async function seedDefaultMap() {
  try { if (localStorage.getItem(BUNDLED_MAP.key)) return; } catch { return; }
  const markDone = () => { try { localStorage.setItem(BUNDLED_MAP.key, '1'); } catch { /* storage blocked */ } };
  if ([...state.maps.values()].some((m) => m.source === BUNDLED_MAP.source)) return markDone();
  try {
    const res = await fetch(BUNDLED_MAP.url);
    if (!res.ok) return;
    toast(`Preparing the ${BUNDLED_MAP.name} map…`);
    const { importAzgaar } = await import('./azgaar.js');
    const map = await importAzgaar(await res.text(), { fallbackName: BUNDLED_MAP.name, makeDefault: true, source: BUNDLED_MAP.source });
    for (const m of state.maps.values()) if (m !== map && m.isDefault) { m.isDefault = false; save('maps', m); }
    markDone();
    toast(`${map.name} is ready on the World Map.`);
    if (currentView === 'map') location.hash = '#/map/' + map.id;
  } catch (e) {
    console.error(e);
    toast(`Couldn't prepare the ${BUNDLED_MAP.name} map: ${e.message}`, 'error');
  }
}
