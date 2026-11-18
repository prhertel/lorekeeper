// Combat: initiative order, rounds, AC, HP (damage/heal/temp), conditions,
// and one-click character upload (drop files anywhere on the tab).
import { h, fill, uid, toast, pickFile, blobUrl, ask } from './dom.js';
import { state, save, remove, onChange } from './state.js';
import { familyOf } from './types.js';
import { parseFiles } from './importers.js';
import { openNpcGenerator } from './npcdialog.js';
import { rollPortraitOnto } from './portraits.js';

const CONDITIONS = ['Blinded', 'Charmed', 'Concentrating', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated',
  'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'];
const ACCEPT = '.pdf,.json,.csv,.tsv,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp,.gif,application/pdf,application/json,text/csv,text/plain,image/*';

const d20 = () => 1 + Math.floor(Math.random() * 20);
const signed = (n) => (n >= 0 ? '+' : '') + n;
const numOrNull = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
const isPeople = (e) => familyOf(e.type).id === 'people';

export function newEncounter(name) {
  const n = state.encounters.size + 1;
  const enc = { id: uid(), name: name || `Encounter ${n}`, createdAt: Date.now(), round: 0, turnId: null, combatants: [] };
  save('encounters', enc);
  return enc;
}

/** Create or update a World Bible entry from an imported character. */
export function upsertEntry(c) {
  const key = c.name.trim().toLowerCase();
  let e = [...state.entries.values()].find((x) => isPeople(x) && x.title.trim().toLowerCase() === key);
  const created = !e;
  if (!e) {
    e = {
      id: uid(), type: c.entryType || (c.kind === 'pc' ? 'Party Member' : 'Creature'), title: c.name,
      overview: c.overview || '', secrets: c.secrets || '', image: null, createdAt: Date.now(),
    };
  } else {
    // Fill in text only where the entry has none, never overwrite the DM's writing.
    if (!e.overview && c.overview) e.overview = c.overview;
    if (!e.secrets && c.secrets) e.secrets = c.secrets;
  }
  const prevStats = e.stats ? { ...e.stats } : null;
  const stats = { ...(e.stats || {}) };
  for (const k of ['ac', 'maxHp', 'initBonus', 'speed']) if (c[k] != null) stats[k] = c[k];
  e.stats = stats;
  save('entries', e);
  return { entry: e, created, prevStats };
}

/** The most recent upload, so it can be undone (kept until the page reloads). */
let lastUpload = null;

export function render(root, [eid]) {
  let enc = (eid && state.encounters.get(eid)) || [...state.encounters.values()].sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!enc) enc = newEncounter();
  if (enc.id !== eid) history.replaceState(null, '', '#/combat/' + enc.id);

  const persist = () => save('encounters', enc);
  const list = enc.combatants;
  const byId = (id) => list.find((c) => c.id === id);
  const active = () => list.filter((c) => !(c.kind !== 'pc' && c.hp != null && c.hp <= 0));

  function uniqueName(base) {
    if (!list.some((c) => c.name === base)) return base;
    let i = 2;
    while (list.some((c) => c.name === `${base} ${i}`)) i++;
    return `${base} ${i}`;
  }

  function addCombatant(o) {
    const c = {
      id: uid(), entryId: o.entryId || null, name: uniqueName(o.name || 'Unnamed'), kind: o.kind === 'pc' ? 'pc' : 'npc',
      init: null, initBonus: o.initBonus ?? 0, ac: o.ac ?? null, maxHp: o.maxHp ?? null, hp: o.hp ?? o.maxHp ?? null,
      temp: 0, conditions: [],
    };
    // Join a running fight in initiative order.
    if (enc.round > 0) { c.init = d20() + c.initBonus; placeByInit(c); } else list.push(c);
    return c;
  }
  function fromEntry(e) {
    const st = e.stats || {};
    return addCombatant({ entryId: e.id, name: e.title, kind: e.type === 'Party Member' ? 'pc' : 'npc', ac: st.ac, maxHp: st.maxHp, initBonus: st.initBonus ?? 0 });
  }
  function placeByInit(c) {
    const idx = list.findIndex((o) => (o.init ?? -99) < c.init);
    if (idx < 0) list.push(c); else list.splice(idx, 0, c);
  }
  function sortByInit() {
    // Stable sort, so ties keep their manual order.
    list.sort((a, b) => (b.init ?? -99) - (a.init ?? -99) || (b.initBonus ?? 0) - (a.initBonus ?? 0));
  }
  function rollFor(c) { c.init = d20() + (c.initBonus || 0); }

  // ---- turn flow -----------------------------------------------------------
  function start() {
    if (!list.length) return toast('Add some combatants first.');
    const rolled = list.filter((c) => c.init == null);
    rolled.forEach(rollFor);
    sortByInit();
    enc.round = 1;
    enc.turnId = active()[0]?.id ?? list[0].id;
    persist();
    draw();
    scrollToTurn();
    if (rolled.length) toast(`Rolled initiative for ${rolled.length} combatant${rolled.length > 1 ? 's' : ''}.`);
    announceRound();
  }
  function step(dir) {
    if (!enc.round) return start();
    const order = active();
    if (!order.length) return;
    let i = order.findIndex((c) => c.id === enc.turnId);
    if (i < 0) {
      // Current combatant dropped to 0 HP or was removed: continue from its place in the order.
      const pos = list.findIndex((c) => c.id === enc.turnId);
      let nextIdx = order.findIndex((c) => list.indexOf(c) > pos);
      if (nextIdx < 0) nextIdx = order.length;
      i = dir > 0 ? nextIdx - 1 : nextIdx;
    }
    i += dir;
    let newRound = false;
    if (i >= order.length) { i = 0; enc.round++; newRound = true; }
    if (i < 0) {
      if (enc.round > 1) { enc.round--; i = order.length - 1; } else i = 0;
    }
    enc.turnId = order[i].id;
    persist();
    draw();
    scrollToTurn();
    if (newRound) announceRound();
  }

  /** Everyone has acted: flash the bar and announce the new round. */
  function announceRound() {
    toast(`⚔ Round ${enc.round} begins: ${byId(enc.turnId)?.name || ''} acts first.`);
    turnBar.classList.remove('flash');
    void turnBar.offsetWidth; // restart the animation
    turnBar.classList.add('flash');
  }
  async function endCombat() {
    if (!(await ask('End combat? Round and turn reset; combatants stay.', { ok: 'End combat' }))) return;
    enc.round = 0;
    enc.turnId = null;
    persist();
    draw();
  }

  // ---- HP -----------------------------------------------------------------
  function damage(c, amt) {
    if (!(amt > 0)) return;
    const fromTemp = Math.min(c.temp || 0, amt);
    c.temp = (c.temp || 0) - fromTemp;
    if (c.hp != null) c.hp = Math.max(0, c.hp - (amt - fromTemp));
    if (c.hp === 0 && c.conditions.includes('Concentrating')) c.conditions = c.conditions.filter((x) => x !== 'Concentrating');
    else if (c.conditions.includes('Concentrating')) toast(`${c.name}: Concentration check, DC ${Math.max(10, Math.floor(amt / 2))}`);
  }
  function heal(c, amt) {
    if (!(amt > 0) || c.hp == null) return;
    c.hp = c.maxHp != null ? Math.min(c.maxHp, c.hp + amt) : c.hp + amt;
  }
  function healthWord(c) {
    if (c.hp == null || !c.maxHp) return '';
    if (c.hp <= 0) return 'Down';
    if (c.hp <= c.maxHp / 2) return 'Bloodied';
    return c.hp < c.maxHp ? 'Hurt' : 'Healthy';
  }

  // ---- layout -----------------------------------------------------------------
  const head = h('div', { class: 'combat-head' });
  const addBar = h('div', { class: 'add-bar' });
  const quick = h('div', { class: 'quick-add hidden' });
  const rowsEl = h('div', { class: 'combat-rows' });
  const dropOverlay = h('div', { class: 'drop-overlay hidden' }, h('div', {}, '⬆', h('strong', {}, 'Drop character files to add them'), h('span', { class: 'muted' }, 'PDFs, images, text, JSON or CSV')));
  const turnBar = h('div', { class: 'turn-bar', role: 'region', 'aria-label': 'Turn tracker' });
  const wrap = h('div', { class: 'combat' }, head, turnBar, addBar, quick, rowsEl, dropOverlay);
  root.append(wrap);

  function drawHead() {
    const cur = byId(enc.turnId);
    fill(head,
      h('div', { class: 'enc-pick' },
        h('select', {
          'aria-label': 'Choose encounter',
          onChange: (ev) => {
            if (ev.target.value === '__new') location.hash = '#/combat/' + newEncounter().id;
            else location.hash = '#/combat/' + ev.target.value;
          },
        }, [...state.encounters.values()].sort((a, b) => a.createdAt - b.createdAt).map((x) => h('option', { value: x.id, selected: x.id === enc.id }, x.name)),
          h('option', { value: '__new' }, '+ New encounter…')),
        h('input', { class: 'enc-name', value: enc.name, 'aria-label': 'Encounter name', onChange: (ev) => { enc.name = ev.target.value || 'Encounter'; persist(); drawHead(); } })),
      enc.round ? h('button', { class: 'btn ghost small', title: 'End combat and reset the round counter', onClick: endCombat }, 'End combat') : null);
    drawTurnBar();
  }

  /** Sticky bar: round, who is acting, who is next, and the End turn button. */
  function drawTurnBar() {
    if (!enc.round) {
      fill(turnBar,
        h('div', { class: 'tb-round muted' }, list.length ? 'Ready when you are' : 'Add combatants to begin'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn primary tb-go', disabled: !list.length, title: 'Roll missing initiative and start round 1', onClick: () => step(1) }, '⚔ Start combat'));
      turnBar.classList.remove('live');
      return;
    }
    const cur = byId(enc.turnId);
    const nxt = nextUp();
    const face = (c) => {
      const img = c && (state.entries.get(c.entryId)?.image || c.image);
      return img ? h('img', { class: 'tb-face', src: blobUrl(img), alt: '' }) : h('span', { class: 'tb-face tb-initials' }, (c?.name || '?').slice(0, 1));
    };
    fill(turnBar,
      h('div', { class: 'tb-round' }, h('span', { class: 'muted' }, 'Round'), h('strong', {}, enc.round)),
      h('button', { class: 'tb-now', title: 'Scroll to the active combatant', onClick: () => scrollToTurn() },
        face(cur), h('span', { class: 'tb-label' }, h('small', {}, 'Now acting'), h('b', {}, cur?.name || '—'))),
      nxt && nxt !== cur ? h('div', { class: 'tb-next' }, h('small', {}, 'Up next'), h('span', {}, nxt.name, nxt === order()[0] ? h('em', {}, ' (new round)') : null)) : null,
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn tb-prev', title: 'Back to the previous turn (B)', onClick: () => step(-1) }, '◀'),
      h('button', { class: 'btn primary tb-go', title: 'End this turn and move to the next combatant (N)', onClick: () => step(1) }, 'End turn ➜'));
    turnBar.classList.add('live');
  }

  const order = () => active();
  /** Who acts after the current combatant (wrapping to the top of the order). */
  function nextUp() {
    const o = order();
    if (!o.length) return null;
    let i = o.findIndex((c) => c.id === enc.turnId);
    if (i < 0) {
      const pos = list.findIndex((c) => c.id === enc.turnId);
      const n = o.findIndex((c) => list.indexOf(c) > pos);
      return n < 0 ? o[0] : o[n];
    }
    return o[(i + 1) % o.length];
  }

  function scrollToTurn() {
    rowsEl.querySelector('.combatant.turn')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function drawAddBar() {
    const people = [...state.entries.values()].filter(isPeople).sort((a, b) => a.title.localeCompare(b.title));
    const party = people.filter((e) => e.type === 'Party Member');
    const missingParty = party.filter((e) => !list.some((c) => c.entryId === e.id));
    const picker = h('select', {
      class: 'bible-pick', 'aria-label': 'Add from World Bible',
      onChange: (ev) => {
        const e = state.entries.get(ev.target.value);
        if (e) { fromEntry(e); persist(); draw(); }
        ev.target.value = '';
      },
    }, h('option', { value: '' }, '+ From World Bible…'),
      people.map((e) => h('option', { value: e.id }, `${e.title} (${e.type})${e.stats?.ac != null ? ` · AC ${e.stats.ac}` : ''}${e.stats?.maxHp != null ? ` · ${e.stats.maxHp} HP` : ''}`)));
    fill(addBar,
      h('button', {
        class: 'btn upload-btn', title: 'Upload character sheets (PDF), JSON or CSV. You can pick several files at once.',
        onClick: () => { const i = h('input', { type: 'file', accept: ACCEPT, multiple: true }); i.addEventListener('change', () => importFiles([...i.files])); i.click(); },
      }, '⬆ Upload characters'),
      h('button', {
        class: 'btn', title: 'Generate random NPCs or demons and add them to the World Bible (and this fight)',
        onClick: () => openNpcGenerator({
          fight: true,
          onAdd: (entries, toFight) => { if (toFight) { entries.forEach(fromEntry); persist(); } draw(); },
        }),
      }, '🎲 Random NPC'),
      lastUpload?.encId === enc.id ? h('button', {
        class: 'btn', title: 'Remove everything the last upload added and restore any stats it changed',
        onClick: undoUpload,
      }, `↶ Undo upload`) : null,
      h('button', {
        class: 'btn', disabled: !missingParty.length,
        title: party.length ? (missingParty.length ? `Add ${missingParty.map((e) => e.title).join(', ')}` : 'The whole party is already here') : 'No Party Member entries yet; upload some characters',
        onClick: () => { missingParty.forEach(fromEntry); persist(); draw(); },
      }, `👥 Add party${missingParty.length ? ` (${missingParty.length})` : ''}`),
      picker,
      h('button', { class: 'btn', onClick: () => { quick.classList.toggle('hidden'); quick.querySelector('input')?.focus(); } }, '＋ Quick add'),
      h('span', { class: 'spacer' }),
      list.length ? h('button', {
        class: 'btn ghost small', title: 'Re-roll initiative for every NPC',
        onClick: () => { list.filter((c) => c.kind !== 'pc').forEach(rollFor); sortByInit(); persist(); draw(); },
      }, '🎲 Roll NPCs') : null,
      list.length ? h('button', { class: 'btn ghost small', onClick: () => { sortByInit(); persist(); draw(); } }, '⇅ Sort') : null,
      h('button', {
        class: 'btn ghost small danger', title: 'Delete this encounter',
        onClick: async () => {
          if (!(await ask(`Delete “${enc.name}”?`, { ok: 'Delete', danger: true }))) return;
          remove('encounters', enc.id);
          location.hash = '#/combat';
        },
      }, 'Delete'));
  }

  function drawQuick() {
    const f = {
      name: h('input', { placeholder: 'Goblin', 'aria-label': 'Name', required: true }),
      ac: h('input', { type: 'number', placeholder: '15', 'aria-label': 'AC' }),
      hp: h('input', { type: 'number', placeholder: '7', 'aria-label': 'HP' }),
      init: h('input', { type: 'number', placeholder: '+2', 'aria-label': 'Initiative bonus' }),
      count: h('input', { type: 'number', value: '1', min: '1', max: '30', 'aria-label': 'How many' }),
      kind: h('select', { 'aria-label': 'Side' }, h('option', { value: 'npc' }, 'NPC / monster'), h('option', { value: 'pc' }, 'Player character')),
      saveBible: h('input', { type: 'checkbox' }),
    };
    const submit = (ev) => {
      ev.preventDefault();
      const name = f.name.value.trim();
      if (!name) return f.name.focus();
      const base = { name, kind: f.kind.value, ac: numOrNull(f.ac.value), maxHp: numOrNull(f.hp.value), initBonus: numOrNull(f.init.value) ?? 0 };
      let entryId = null;
      if (f.saveBible.checked) entryId = upsertEntry({ ...base, speed: null }).entry.id;
      const count = Math.max(1, Math.min(30, numOrNull(f.count.value) || 1));
      for (let i = 0; i < count; i++) addCombatant({ ...base, entryId, name: count > 1 ? `${name} ${i + 1}` : name });
      persist();
      draw();
      f.name.value = '';
      f.name.focus();
    };
    fill(quick, h('form', { class: 'quick-form', onSubmit: submit },
      h('label', {}, 'Name', f.name), h('label', {}, 'AC', f.ac), h('label', {}, 'HP', f.hp), h('label', {}, 'Init bonus', f.init),
      h('label', {}, 'How many', f.count), h('label', {}, 'Side', f.kind),
      h('label', { class: 'check' }, f.saveBible, 'Save to World Bible'),
      h('button', { class: 'btn primary', type: 'submit' }, 'Add')));
  }

  function hpCell(c) {
    const pct = c.maxHp ? Math.max(0, Math.min(1, (c.hp ?? 0) / c.maxHp)) : 0;
    const amt = h('input', { type: 'number', min: '0', class: 'amt', placeholder: '0', 'aria-label': `Amount for ${c.name}` });
    const apply = (fn) => { const v = numOrNull(amt.value); if (v == null) return amt.focus(); fn(c, v); persist(); draw(); };
    amt.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); apply(ev.shiftKey ? heal : damage); }
    });
    const field = (key, label, cls) => h('input', {
      type: 'number', class: cls, value: c[key] ?? '', 'aria-label': label, title: label,
      onChange: (ev) => {
        c[key] = numOrNull(ev.target.value);
        if (key === 'maxHp' && c.hp == null) c.hp = c.maxHp;
        if (key === 'temp') c.temp = Math.max(0, c.temp || 0);
        persist();
        draw();
      },
    });
    const bloodied = c.maxHp && c.hp != null && c.hp <= c.maxHp / 2;
    return h('div', { class: 'hp-cell' },
      h('div', { class: 'hp-top' },
        h('span', { class: 'hp-nums' + (c.kind === 'pc' ? '' : ' dm-only') },
          field('hp', 'Current HP', 'hp-cur'), h('span', { class: 'muted' }, '/'), field('maxHp', 'Max HP', 'hp-max'),
          h('span', { class: 'temp-wrap', title: 'Temporary HP' }, '+', field('temp', 'Temporary HP', 'hp-temp'), h('small', {}, 'tmp'))),
        c.kind !== 'pc' ? h('span', { class: 'player-only health-word' }, healthWord(c)) : null),
      c.maxHp ? h('div', { class: 'hp-bar' + (bloodied ? ' bloodied' : '') }, h('div', { style: `width:${pct * 100}%` }),
        c.temp ? h('div', { class: 'temp', style: `width:${Math.min(1, c.temp / c.maxHp) * 100}%` }) : null) : null,
      h('div', { class: 'hp-actions dm-only-for-npc' },
        amt,
        h('button', { class: 'btn small dmg', title: 'Damage (Enter)', onClick: () => apply(damage) }, '− Dmg'),
        h('button', { class: 'btn small heal', title: 'Heal (Shift+Enter)', onClick: () => apply(heal) }, '+ Heal')));
  }

  function conditionsCell(c) {
    return h('div', { class: 'conds' },
      c.conditions.map((x) => h('span', { class: 'cond' + (x === 'Concentrating' ? ' conc' : '') }, x,
        h('button', { title: `Remove ${x}`, onClick: () => { c.conditions = c.conditions.filter((y) => y !== x); persist(); draw(); } }, '×'))),
      h('select', {
        class: 'cond-add', 'aria-label': `Add condition to ${c.name}`,
        onChange: (ev) => { if (ev.target.value) { c.conditions.push(ev.target.value); persist(); draw(); } },
      }, h('option', { value: '' }, '+ condition'), CONDITIONS.filter((x) => !c.conditions.includes(x)).map((x) => h('option', { value: x }, x))));
  }

  /** Portrait beside the name: the World Bible image, or initials. Click to upload a picture. */
  function avatar(c, entry) {
    const img = entry?.image || c.image || null;
    const initials = c.name.replace(/\s+\d+$/, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    const face = h('button', {
      class: 'avatar' + (img ? ' has-img' : ''), type: 'button',
      title: img ? `Upload a different picture for ${c.name}` : `Upload a picture for ${c.name}`,
      onClick: async () => {
        const f = await pickFile('image/*');
        if (!f) return;
        if (entry) { entry.image = f; entry.portraitId = null; entry.imageFromParty = false; save('entries', entry); }
        else { c.image = f; persist(); }
        draw();
      },
    }, img ? h('img', { src: blobUrl(img), alt: '' }) : h('span', {}, initials || '?'));
    const roll = h('button', {
      class: 'avatar-roll', type: 'button', title: `Roll a painted portrait for ${c.name}`,
      onClick: async () => {
        try {
          if (entry) { await rollPortraitOnto(entry); save('entries', entry); }
          else { await rollPortraitOnto(c); persist(); }
          draw();
        } catch (e) { toast(e.message, 'error'); }
      },
    }, '🎲');
    return h('div', { class: 'avatar-wrap' }, face, roll);
  }

  function row(c, i) {
    const entry = c.entryId && state.entries.get(c.entryId);
    const down = c.hp != null && c.hp <= 0;
    return h('div', {
      class: `combatant kind-${c.kind}` + (c.id === enc.turnId && enc.round ? ' turn' : '') + (down ? ' down' : ''),
    },
      h('div', { class: 'turn-mark' }, c.id === enc.turnId && enc.round
        ? h('button', { class: 'turn-arrow', title: `${c.name} is done: end turn and move to the next combatant (N)`, onClick: () => step(1) }, h('span', {}, '➜'), h('small', {}, 'Done'))
        : ''),
      h('div', { class: 'init-cell' },
        h('input', {
          type: 'number', class: 'init', value: c.init ?? '', placeholder: '—', 'aria-label': `Initiative for ${c.name}`,
          onChange: (ev) => { c.init = numOrNull(ev.target.value); sortByInit(); persist(); draw(); },
        }),
        h('button', { class: 'icon-btn small', title: `Roll d20 ${signed(c.initBonus || 0)}`, onClick: () => { rollFor(c); sortByInit(); persist(); draw(); } }, '🎲')),
      h('div', { class: 'name-cell' }, avatar(c, entry), h('div', { class: 'name-main' },
        h('div', { class: 'name-line' },
          h('button', {
            class: 'kind-tag', title: 'Click to switch between player character and NPC',
            onClick: () => { c.kind = c.kind === 'pc' ? 'npc' : 'pc'; persist(); draw(); },
          }, c.kind === 'pc' ? 'PC' : 'NPC'),
          h('input', { class: 'cname', value: c.name, 'aria-label': 'Name', onChange: (ev) => { c.name = ev.target.value || 'Unnamed'; persist(); drawHead(); } }),
          entry ? h('a', { class: 'entry-link', href: '#/bible/' + entry.id, title: 'Open in World Bible' }, '↗') : null,
          h('span', { class: 'muted small' }, `init ${signed(c.initBonus || 0)}`)),
        conditionsCell(c))),
      h('label', { class: 'ac-cell', title: 'Armor Class' },
        h('span', {}, 'AC'),
        h('input', { type: 'number', value: c.ac ?? '', placeholder: '—', onChange: (ev) => { c.ac = numOrNull(ev.target.value); persist(); } })),
      hpCell(c),
      h('div', { class: 'row-actions' },
        h('button', { class: 'icon-btn', title: 'Move up', disabled: i === 0, onClick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; persist(); draw(); } }, '↑'),
        h('button', { class: 'icon-btn', title: 'Move down', disabled: i === list.length - 1, onClick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; persist(); draw(); } }, '↓'),
        h('button', {
          class: 'icon-btn', title: 'Duplicate',
          onClick: () => {
            const base = c.name.replace(/\s+\d+$/, '');
            const copy = { ...structuredClone(c), id: uid(), name: uniqueName(base), init: enc.round ? d20() + (c.initBonus || 0) : null, hp: c.maxHp, temp: 0, conditions: [] };
            if (enc.round) placeByInit(copy); else list.splice(i + 1, 0, copy);
            persist(); draw();
          },
        }, '⧉'),
        h('button', {
          class: 'icon-btn danger', title: 'Remove from fight',
          onClick: () => {
            if (c.id === enc.turnId && enc.round) step(1);
            const idx = list.indexOf(c);
            if (idx >= 0) list.splice(idx, 1);
            if (enc.turnId === c.id) enc.turnId = active()[0]?.id ?? null;
            persist(); draw();
          },
        }, '✕')));
  }

  function drawRows() {
    if (!list.length) {
      fill(rowsEl, h('div', { class: 'combat-empty' },
        h('div', { class: 'big-icon' }, '⚔'),
        h('h2', {}, 'No one is fighting yet'),
        h('p', {}, 'Drop character sheets anywhere on this page, or press ', h('strong', {}, '⬆ Upload characters'), '. Each file becomes a World Bible entry with its stats and joins the fight.'),
        h('p', { class: 'muted small' }, 'Works with 5e character sheet PDFs (including D&D Beyond exports), any PDF or screenshot of an NPC or stat block (e.g. from an NPC generator), text files, Foundry VTT and 5etools JSON, Improved Initiative, and CSV (name, ac, hp, init).')));
      return;
    }
    fill(rowsEl,
      h('div', { class: 'combat-cols' }, h('span', {}), h('span', {}, 'Init'), h('span', {}, 'Combatant'), h('span', {}, 'AC'), h('span', {}, 'Hit points'), h('span', {})),
      list.map(row));
  }

  function draw() { drawHead(); drawAddBar(); drawRows(); }

  // ---- upload -----------------------------------------------------------
  async function importFiles(files) {
    if (!files.length) return;
    const { chars, errors } = await parseFiles(files, (msg) => toast(msg));
    if (chars.length > 40 && !(await ask(`These files contain ${chars.length} characters. Add them all?`, { ok: 'Add them all' }))) return;
    const undo = { encId: enc.id, createdEntries: [], prevStats: new Map(), combatants: [], prevCombatants: new Map() };
    for (const ch of chars) {
      const { entry: e, created, prevStats } = upsertEntry(ch);
      if (created) undo.createdEntries.push(e.id);
      else if (!undo.prevStats.has(e.id)) undo.prevStats.set(e.id, prevStats);
      const existing = list.find((c) => c.entryId === e.id);
      if (existing && ch.kind === 'pc') {
        // Re-uploading refreshes stats rather than adding a duplicate PC.
        if (!undo.prevCombatants.has(existing.id)) undo.prevCombatants.set(existing.id, { ac: existing.ac, maxHp: existing.maxHp, initBonus: existing.initBonus });
        Object.assign(existing, { ac: ch.ac ?? existing.ac, maxHp: ch.maxHp ?? existing.maxHp, initBonus: ch.initBonus });
        continue;
      }
      const c = fromEntry(e);
      if (ch.hp != null) c.hp = ch.hp;
      undo.combatants.push(c.id);
    }
    if (chars.length) lastUpload = undo;
    persist();
    draw();
    if (chars.length) {
      const noAc = chars.filter((c) => c.ac == null).map((c) => c.name);
      toast(`Added ${chars.map((c) => c.name).join(', ')}${noAc.length ? `. Set AC for ${noAc.join(', ')}` : ''}`);
      for (const c of chars.filter((x) => x.defaulted)) {
        toast(`${c.name}: the file had no AC/HP, so Commoner stats were used (AC ${c.ac}, ${c.maxHp} HP). Edit them if needed.`);
      }
    }
    for (const err of errors) toast(err, 'error');
  }

  function undoUpload() {
    const u = lastUpload;
    if (!u || u.encId !== enc.id) return;
    const ids = new Set(u.combatants);
    const removedCount = list.filter((c) => ids.has(c.id)).length;
    for (let i = list.length - 1; i >= 0; i--) if (ids.has(list[i].id)) list.splice(i, 1);
    for (const [cid, prev] of u.prevCombatants) { const c = byId(cid); if (c) Object.assign(c, prev); }
    if (enc.turnId && !byId(enc.turnId)) enc.turnId = active()[0]?.id ?? null;
    lastUpload = null;
    persist();
    for (const [eid, prev] of u.prevStats) {
      const e = state.entries.get(eid);
      if (e) { e.stats = prev; save('entries', e); }
    }
    for (const eid of u.createdEntries) if (state.entries.has(eid)) remove('entries', eid);
    draw();
    toast(`Undid upload: removed ${removedCount} combatant${removedCount === 1 ? '' : 's'} and ${u.createdEntries.length} new entr${u.createdEntries.length === 1 ? 'y' : 'ies'}.`);
  }

  let dragDepth = 0;
  const hasFiles = (ev) => [...(ev.dataTransfer?.types || [])].includes('Files');
  wrap.addEventListener('dragenter', (ev) => { if (!hasFiles(ev)) return; ev.preventDefault(); dragDepth++; dropOverlay.classList.remove('hidden'); });
  wrap.addEventListener('dragover', (ev) => { if (hasFiles(ev)) ev.preventDefault(); });
  wrap.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; dropOverlay.classList.add('hidden'); } });
  wrap.addEventListener('drop', (ev) => {
    if (!hasFiles(ev)) return;
    ev.preventDefault();
    dragDepth = 0;
    dropOverlay.classList.add('hidden');
    importFiles([...ev.dataTransfer.files]);
  });

  function onKey(ev) {
    if (ev.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (ev.key === 'n' || ev.key === 'N') step(1);
    else if (ev.key === 'b' || ev.key === 'B') step(-1);
  }
  document.addEventListener('keydown', onKey);

  drawQuick();
  draw();
  const off = onChange((kind) => { if (kind === 'entries') drawAddBar(); });
  return () => { off(); document.removeEventListener('keydown', onKey); };
}
