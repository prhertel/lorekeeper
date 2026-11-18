// App shell: sidebar navigation, hash routing, settings and backup.
import { load, state, save, onChange, setPlayerView, hasData } from './state.js';
import { h, fill, toast, pickFile, pendingFlushes, ask } from './dom.js';
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
  seedDefaultMap();
})();

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
