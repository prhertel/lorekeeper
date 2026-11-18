// Random NPC generator dialog: filters, preview cards, and adding to the World Bible (and a fight).
import { h, fill, uid, toast } from './dom.js';
import { save } from './state.js';
import { RACES, CLASSES, generateNpc } from './npcgen.js';
import { portraitBlob } from './portrait.js';
import { portraitFor } from './portraits.js';

const KEY = 'lk.npcgen';
const MORTAL = Object.keys(RACES).filter((k) => RACES[k].group === 'mortal');
const DEMON = Object.keys(RACES).filter((k) => RACES[k].group === 'demon');
const ALL_CLASSES = Object.keys(CLASSES);
const DEFAULTS = { races: [...MORTAL], classes: [...ALL_CLASSES], level: '1-5', gender: 'any', count: 1 };
const LEVELS = [['1-3', 'Level 1–3'], ['1-5', 'Level 1–5'], ['4-8', 'Level 4–8'], ['5-10', 'Level 5–10'], ['10-15', 'Level 10–15'], ['15-20', 'Level 15–20']];

function loadSettings() {
  try {
    const s = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    s.races = s.races.filter((k) => RACES[k]);
    s.classes = s.classes.filter((k) => CLASSES[k]);
    return s;
  } catch { return { ...DEFAULTS }; }
}
function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked */ } }

/** Save a generated NPC as a World Bible entry. */
export function npcToEntry(npc) {
  const e = {
    id: uid(), type: npc.type, title: npc.title, overview: npc.overview, secrets: npc.secrets, image: npc.portrait || null,
    createdAt: Date.now(), stats: { ...npc.stats }, gen: { race: npc.raceKey, class: npc.classKey, level: npc.level },
    portraitId: npc.portraitId || null, portraitDemon: !!npc.isDemon,
  };
  save('entries', e);
  return e;
}

/**
 * @param {object} o
 * @param {boolean} [o.fight] show "Add to fight" as well
 * @param {(entries:object[], toFight:boolean)=>void} o.onAdd
 */
export function openNpcGenerator({ fight = false, onAdd } = {}) {
  const st = loadSettings();
  let npcs = [];

  const close = () => { document.removeEventListener('keydown', onKey); backdrop.remove(); };
  function onKey(ev) {
    if (ev.key === 'Escape') close();
    else if (ev.key === 'Enter' && ev.target.tagName !== 'BUTTON' && ev.target.tagName !== 'SELECT') { ev.preventDefault(); generate(); }
  }

  const raceEl = h('div', { class: 'gen-section' });
  const classEl = h('div', { class: 'gen-section' });
  const optsEl = h('div', { class: 'gen-opts' });
  const previewEl = h('div', { class: 'gen-preview' });
  const footer = h('div', { class: 'gen-footer' });

  const chip = (on, label, onClick, cls = '') => h('button', { type: 'button', class: `chip-toggle ${cls}` + (on ? ' on' : ''), 'aria-pressed': String(on), onClick }, label);
  const toggle = (arr, k) => { const i = arr.indexOf(k); if (i >= 0) arr.splice(i, 1); else arr.push(k); };
  const persist = () => saveSettings(st);

  function drawRaces() {
    const setRaces = (list) => { st.races = [...list]; persist(); drawRaces(); };
    fill(raceEl,
      h('div', { class: 'gen-label' }, 'Race',
        h('span', { class: 'presets' },
          h('button', { type: 'button', class: 'link-btn', onClick: () => setRaces(MORTAL) }, 'Mostly human'),
          h('button', { type: 'button', class: 'link-btn', onClick: () => setRaces(['human']) }, 'Humans only'),
          h('button', { type: 'button', class: 'link-btn', onClick: () => setRaces(DEMON) }, 'Demons only'),
          h('button', { type: 'button', class: 'link-btn', onClick: () => setRaces([...MORTAL, ...DEMON]) }, 'Everything'))),
      h('div', { class: 'chips-row' }, MORTAL.map((k) => chip(st.races.includes(k), RACES[k].name, () => { toggle(st.races, k); persist(); drawRaces(); }))),
      h('div', { class: 'chips-row demons' }, h('span', { class: 'row-tag' }, '😈 Demons'),
        DEMON.map((k) => chip(st.races.includes(k), RACES[k].name.replace(/^Demon /, ''), () => { toggle(st.races, k); persist(); drawRaces(); }, 'demon'))),
      h('p', { class: 'muted tiny' }, 'Picks are weighted, so most NPCs come out human. Demons are demon-touched versions of each race: horns, ember eyes, claws, fiendish resistances, darker hooks and loot.'));
  }

  function drawClasses() {
    const setClasses = (list) => { st.classes = [...list]; persist(); drawClasses(); };
    fill(classEl,
      h('div', { class: 'gen-label' }, 'Class',
        h('span', { class: 'presets' },
          h('button', { type: 'button', class: 'link-btn', onClick: () => setClasses(ALL_CLASSES) }, 'Everyone'),
          h('button', { type: 'button', class: 'link-btn', onClick: () => setClasses(['commoner']) }, 'Townsfolk'),
          h('button', { type: 'button', class: 'link-btn', onClick: () => setClasses(ALL_CLASSES.filter((k) => k !== 'commoner')) }, 'Adventurers'),
          h('button', { type: 'button', class: 'link-btn', onClick: () => setClasses(['fighter', 'barbarian', 'paladin', 'rogue']) }, 'Warriors'),
          h('button', { type: 'button', class: 'link-btn', onClick: () => setClasses(['wizard', 'sorcerer', 'warlock', 'cleric', 'druid', 'bard']) }, 'Casters'))),
      h('div', { class: 'chips-row' }, ALL_CLASSES.map((k) => chip(st.classes.includes(k), k === 'commoner' ? 'Commoner (job)' : CLASSES[k].name, () => { toggle(st.classes, k); persist(); drawClasses(); }))));
  }

  function drawOpts() {
    fill(optsEl,
      h('label', {}, 'Level', h('select', { onChange: (ev) => { st.level = ev.target.value; persist(); } },
        h('optgroup', { label: 'Random' }, LEVELS.map(([v, l]) => h('option', { value: v, selected: st.level === v }, l))),
        h('optgroup', { label: 'Exactly' }, Array.from({ length: 20 }, (_, i) => String(i + 1)).map((v) => h('option', { value: v, selected: st.level === v }, `Level ${v}`))))),
      h('label', {}, 'Gender', h('select', { onChange: (ev) => { st.gender = ev.target.value; persist(); } },
        [['any', 'Any'], ['f', 'Female'], ['m', 'Male'], ['x', 'Nonbinary']].map(([v, l]) => h('option', { value: v, selected: st.gender === v }, l)))),
      h('label', {}, 'How many', h('input', { type: 'number', min: '1', max: '12', value: st.count, onChange: (ev) => { st.count = Math.max(1, Math.min(12, parseInt(ev.target.value, 10) || 1)); ev.target.value = st.count; persist(); } })),
      h('button', { type: 'button', class: 'btn primary gen-btn', onClick: generate }, '🎲 Generate'));
  }

  async function gen(used = []) {
    const n = generateNpc(st);
    const lib = await portraitFor(n.look, used);
    n.portrait = lib?.blob || portraitBlob(n.look); // painted portrait, or the drawn one as a fallback
    n.portraitId = lib?.id || null;
    n.portraitUrl = URL.createObjectURL(n.portrait);
    return n;
  }

  let busy = 0;
  async function generate() {
    if (!st.races.length) return toast('Pick at least one race.');
    if (!st.classes.length) return toast('Pick at least one class.');
    const ticket = ++busy;
    const out = [];
    for (let i = 0; i < st.count; i++) out.push(await gen(out.map((x) => x.portraitId).filter(Boolean)));
    if (ticket !== busy) return; // a newer roll replaced this one
    npcs = out;
    drawPreview();
  }

  async function reroll(i) {
    npcs[i] = await gen(npcs.filter((_, j) => j !== i).map((x) => x.portraitId).filter(Boolean));
    drawPreview();
  }

  function card(n, i) {
    const details = h('details', { class: 'gen-full' }, h('summary', {}, 'Full write-up'),
      h('div', { class: 'gen-html', html: n.overview }), h('div', { class: 'gen-html secret', html: n.secrets }));
    return h('div', { class: 'gen-card' + (n.isDemon ? ' demon' : '') },
      h('div', { class: 'gen-card-head' },
        h('img', { class: 'gen-portrait', src: n.portraitUrl, alt: `Portrait of ${n.title}` }),
        h('div', { class: 'gen-title' }, h('div', { class: 'gen-name' }, n.title), h('div', { class: 'muted small' }, n.headline)),
        h('div', { class: 'gen-card-actions' },
          h('button', { type: 'button', class: 'icon-btn', title: 'Re-roll this one', onClick: () => reroll(i) }, '↻'),
          h('button', { type: 'button', class: 'icon-btn danger', title: 'Remove', onClick: () => { npcs.splice(i, 1); drawPreview(); } }, '✕'))),
      h('div', { class: 'gen-stats' },
        h('span', {}, h('b', {}, 'AC '), n.ac), h('span', {}, h('b', {}, 'HP '), n.hp), h('span', {}, h('b', {}, 'Init '), (n.init >= 0 ? '+' : '−') + Math.abs(n.init)), h('span', {}, h('b', {}, 'Speed '), `${n.speed} ft`)),
      h('p', { class: 'gen-summary' }, n.summary),
      h('p', { class: 'small' }, h('b', {}, 'Gear: '), n.gear.join(', ')),
      h('p', { class: 'small dm-only' }, h('b', {}, '🔒 Loot: '), n.loot.join('; ')),
      h('p', { class: 'small dm-only' }, h('b', {}, '🔒 Hook: '), n.hook),
      details);
  }

  function drawPreview() {
    if (!npcs.length) {
      fill(previewEl, h('div', { class: 'gen-empty muted' }, 'Pick your filters and press 🎲 Generate (or Enter).'));
    } else {
      fill(previewEl, npcs.map(card));
    }
    const add = (toFight) => {
      const entries = npcs.map(npcToEntry);
      close();
      onAdd?.(entries, toFight);
      toast(`Added ${entries.map((e) => e.title).join(', ')} to the World Bible${toFight ? ' and the fight' : ''}.`);
    };
    fill(footer,
      npcs.length ? h('button', { type: 'button', class: 'btn', onClick: generate }, '↻ Re-roll all') : null,
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'btn ghost', onClick: close }, 'Cancel'),
      fight && npcs.length ? h('button', { type: 'button', class: 'btn', onClick: () => add(true) }, `⚔ Add to World Bible + fight`) : null,
      npcs.length ? h('button', { type: 'button', class: 'btn primary', onClick: () => add(false) }, `Add ${npcs.length > 1 ? npcs.length + ' NPCs' : 'NPC'} to World Bible`) : null);
  }

  const panel = h('div', { class: 'gen-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Random NPC generator' },
    h('div', { class: 'gen-head' }, h('h2', {}, '🎲 Random NPC'), h('button', { type: 'button', class: 'icon-btn', title: 'Close (Esc)', onClick: close }, '✕')),
    h('div', { class: 'gen-body' },
      h('div', { class: 'gen-filters' }, raceEl, classEl, optsEl),
      previewEl),
    footer);
  const backdrop = h('div', { class: 'gen-backdrop', onMousedown: (ev) => { if (ev.target === backdrop) close(); } }, panel);

  drawRaces();
  drawClasses();
  drawOpts();
  drawPreview();
  document.body.append(backdrop);
  document.addEventListener('keydown', onKey);
  generate(); // show a first result straight away: one click = one NPC
  panel.querySelector('.gen-btn')?.focus();
}
