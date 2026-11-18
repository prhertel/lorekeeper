// World Bible: linked entries for people, places, factions, items, lore and plot.
import { h, fill, s, uid, plainText, blobUrl, pickFile, toast, ask } from './dom.js';
import { state, save, remove, onChange } from './state.js';
import { FAMILIES, familyOf, colorOf } from './types.js';
import { createEditor } from './editor.js';
import { parseFiles } from './importers.js';
import { upsertEntry } from './combat.js';
import { openNpcGenerator } from './npcdialog.js';
import { rollPortraitOnto } from './portraits.js';

const filter = { family: null, q: '' }; // kept across navigation

export function newEntry(title = 'New entry', type = 'NPC') {
  const e = { id: uid(), type, title, overview: '', secrets: '', image: null, createdAt: Date.now() };
  save('entries', e);
  return e;
}

const mentions = (html, id) => !!html && html.includes(`data-id="${id}"`);

const IMPORT_ACCEPT = '.pdf,.json,.csv,.tsv,.txt,.md,.png,.jpg,.jpeg,.webp,.bmp,.gif,image/*';

/** Import character files as World Bible entries (without adding them to a fight). */
async function importToBible(files) {
  if (!files.length) return;
  const { chars, errors } = await parseFiles(files, (msg) => toast(msg));
  if (chars.length > 40 && !(await ask(`These files contain ${chars.length} characters. Import them all?`, { ok: 'Add them all' }))) return;
  let first = null;
  for (const ch of chars) {
    const { entry } = upsertEntry(ch);
    first ??= entry;
    if (ch.defaulted) toast(`${ch.name}: no AC/HP in the file, so Commoner stats were used. Edit them if needed.`);
  }
  if (chars.length) toast(`Imported ${chars.map((c) => c.name).join(', ')}.`);
  for (const err of errors) toast(err, 'error');
  if (first) location.hash = '#/bible/' + first.id;
}

function arcPath(cx, cy, r0, r1, a0, a1) {
  const p = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

export function render(root, [id]) {
  const wheelEl = h('div', { class: 'wheel' });
  const listEl = h('div', { class: 'entry-list' });
  const search = h('input', {
    class: 'search', type: 'search', placeholder: 'Search the world…', value: filter.q,
    onInput: (e) => { filter.q = e.target.value; drawList(); },
  });
  const addBtn = h('button', {
    class: 'btn primary', title: 'New entry',
    onClick: () => {
      const fam = FAMILIES.find((f) => f.id === filter.family);
      const e = newEntry('New entry', fam ? fam.types[0] : 'NPC');
      location.hash = '#/bible/' + e.id;
    },
  }, '+ New');
  const importBtn = h('button', {
    class: 'btn', title: 'Import characters or NPCs from PDFs, images, text, JSON or CSV',
    onClick: () => {
      const i = h('input', { type: 'file', multiple: true, accept: IMPORT_ACCEPT });
      i.addEventListener('change', () => importToBible([...i.files]));
      i.click();
    },
  }, '⬆');
  const npcBtn = h('button', {
    class: 'btn', title: 'Random NPC generator',
    onClick: () => openNpcGenerator({ onAdd: (entries) => { location.hash = '#/bible/' + entries[0].id; } }),
  }, '🎲');
  const left = h('section', { class: 'pane list-pane' }, wheelEl, h('div', { class: 'list-tools' }, search, npcBtn, importBtn, addBtn), listEl);
  const detail = h('section', { class: 'pane detail-pane' });
  root.append(h('div', { class: 'split' }, left, detail));

  function setFamily(f) { filter.family = f; drawWheel(); drawList(); }

  function drawWheel() {
    const counts = Object.fromEntries(FAMILIES.map((f) => [f.id, 0]));
    for (const e of state.entries.values()) counts[familyOf(e.type).id]++;
    const cx = 110, cy = 110, r0 = 44, r1 = 106, n = FAMILIES.length, gap = 0.025;
    const svg = s('svg', { viewBox: '0 0 220 220', class: 'wheel-svg', role: 'img', 'aria-label': 'Entry families' });
    FAMILIES.forEach((f, i) => {
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n + gap;
      const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / n - gap;
      const mid = (a0 + a1) / 2, lr = (r0 + r1) / 2;
      const active = filter.family === f.id;
      svg.append(s('g', {
        class: 'seg' + (active ? ' active' : '') + (filter.family && !active ? ' dim' : ''),
        onClick: () => setFamily(active ? null : f.id),
      },
        s('title', {}, `${f.name}: ${f.types.join(', ')}`),
        s('path', { d: arcPath(cx, cy, r0, r1, a0, a1), fill: f.color }),
        s('text', { x: cx + lr * Math.cos(mid), y: cy + lr * Math.sin(mid) - 3, 'text-anchor': 'middle', class: 'seg-label' }, f.name),
        s('text', { x: cx + lr * Math.cos(mid), y: cy + lr * Math.sin(mid) + 11, 'text-anchor': 'middle', class: 'seg-count' }, counts[f.id]),
      ));
    });
    svg.append(s('g', { class: 'hub' + (filter.family ? '' : ' active'), onClick: () => setFamily(null) },
      s('title', {}, 'Show everything'),
      s('circle', { cx, cy, r: r0 - 5 }),
      s('text', { x: cx, y: cy - 3, 'text-anchor': 'middle', class: 'hub-label' }, 'Your World'),
      s('text', { x: cx, y: cy + 12, 'text-anchor': 'middle', class: 'seg-count' }, `${state.entries.size} entries`),
    ));
    fill(wheelEl, svg);
  }

  function drawList() {
    const q = filter.q.trim().toLowerCase();
    const items = [...state.entries.values()]
      .filter((e) => !filter.family || familyOf(e.type).id === filter.family)
      .filter((e) => !q
        || e.title.toLowerCase().includes(q)
        || e.type.toLowerCase().includes(q)
        || plainText(e.overview).toLowerCase().includes(q)
        || (!state.playerView && plainText(e.secrets).toLowerCase().includes(q)))
      .sort((a, b) => a.title.localeCompare(b.title));
    fill(listEl, ...(items.length
      ? items.map((e) => h('a', {
        class: 'entry-row' + (e.id === id ? ' active' : ''), href: '#/bible/' + e.id, style: `--c:${colorOf(e.type)}`,
      }, h('span', { class: 'dot' }), h('span', { class: 't' }, e.title || 'Untitled'), h('span', { class: 'ty' }, e.type)))
      : [h('p', { class: 'muted pad' }, state.entries.size ? 'Nothing matches.' : 'Your world is empty. Create your first entry.')]));
  }

  drawWheel();
  drawList();
  const detailApi = renderDetail(detail, id);

  const off = onChange((kind, changedId) => {
    if (kind === 'entries' || kind === 'playerView') { drawWheel(); drawList(); }
    detailApi?.update(kind, changedId);
  });
  return () => { off(); detailApi?.destroy(); };
}

function renderDetail(root, id) {
  const e = id && state.entries.get(id);
  if (!e) {
    root.append(h('div', { class: 'empty-state' },
      h('h2', {}, 'World Bible'),
      h('p', {}, 'Every person, place and secret in your world, linked together. Pick a family on the wheel to filter, or press + New.'),
      h('p', { class: 'muted' }, 'In any text field, type @ and a name to link to another entry. Clicking the link jumps to it.')));
    return null;
  }

  const alive = () => state.entries.has(e.id);
  const nav = (target) => { location.hash = '#/bible/' + target; };
  const create = (title) => newEntry(title, 'NPC');

  // Header
  const portrait = h('button', { class: 'portrait', title: 'Set image', onClick: setImage });
  const removeImg = h('button', { class: 'icon-btn small', title: 'Remove image', onClick: () => { e.image = null; save('entries', e); drawImg(); } }, '✕');
  function drawImg() {
    fill(portrait, e.image ? h('img', { src: blobUrl(e.image), alt: '' }) : h('span', {}, '+ Image'));
    removeImg.hidden = !e.image;
  }
  async function setImage() {
    const f = await pickFile('image/*');
    if (!f) return;
    if (f.size > 8e6) toast('That image is large; it will still work, but backups will be bigger.');
    e.image = f; e.portraitId = null; e.imageFromParty = false; // the player's own picture
    save('entries', e);
    drawImg();
  }
  drawImg();

  /** Generated NPCs get a matching portrait; anyone else steps through the whole library. */
  async function rollPortrait() {
    try {
      await rollPortraitOnto(e);
      save('entries', e);
      drawImg();
    } catch (err) { toast(err.message, 'error'); }
  }

  const famLabel = h('span', { class: 'fam-label' }, familyOf(e.type).name);
  const header = h('div', { class: 'entry-header', style: `--c:${colorOf(e.type)}` });
  const title = h('input', {
    class: 'title-input', value: e.title, placeholder: 'Name', 'aria-label': 'Name',
    onInput: (ev) => { e.title = ev.target.value; save('entries', e); },
  });
  const typeSel = h('select', {
    class: 'type-select', 'aria-label': 'Type',
    onChange: (ev) => {
      e.type = ev.target.value;
      save('entries', e);
      header.style.setProperty('--c', colorOf(e.type));
      famLabel.textContent = familyOf(e.type).name;
      statsEl.hidden = familyOf(e.type).id !== 'people';
    },
  }, FAMILIES.map((f) => h('optgroup', { label: f.name }, f.types.map((t) => h('option', { value: t, selected: t === e.type }, t)))));

  header.append(
    h('div', { class: 'portrait-wrap' }, portrait, removeImg,
      h('button', { class: 'icon-btn small roll-portrait', title: 'Roll a painted portrait', onClick: rollPortrait }, '🎲')),
    h('div', { class: 'entry-meta' }, title, h('div', { class: 'type-row' }, famLabel, typeSel)),
    h('button', {
      class: 'btn danger ghost', title: 'Delete entry',
      onClick: async () => {
        if (!(await ask(`Delete “${e.title || 'Untitled'}”? Links to it will show as broken.`, { ok: 'Delete', danger: true }))) return;
        remove('entries', e.id);
        location.hash = '#/bible';
      },
    }, 'Delete'),
  );

  const overview = createEditor({
    html: e.overview, placeholder: 'Description, appearance, what the players know…',
    onChange: (v) => { if (!alive()) return; e.overview = v; save('entries', e); },
    onNavigate: nav, onCreate: create,
  });
  const secrets = createEditor({
    html: e.secrets, placeholder: 'Motives, twists, stat notes — only you see this.', className: 'secret',
    onChange: (v) => { if (!alive()) return; e.secrets = v; save('entries', e); },
    onNavigate: nav, onCreate: create,
  });

  // Combat stats (People only), used by the Combat tab.
  const stat = (key, label, opts = {}) => h('label', { class: 'stat-field' },
    h('span', {}, label),
    h('input', {
      type: opts.text ? 'text' : 'number', value: e.stats?.[key] ?? '', placeholder: opts.ph || '—',
      onInput: (ev) => {
        const raw = ev.target.value.trim();
        e.stats = { ...(e.stats || {}) };
        e.stats[key] = raw === '' ? null : opts.text ? raw : Number(raw);
        save('entries', e);
      },
    }));
  const statsEl = h('div', { class: 'field' },
    h('label', { class: 'field-label' }, '⚔ Combat stats'),
    h('div', { class: 'stat-grid' },
      stat('ac', 'AC'), stat('maxHp', 'Max HP'), stat('initBonus', 'Init bonus', { ph: '+0' }), stat('speed', 'Speed', { text: true, ph: '30 ft' })),
    h('p', { class: 'muted small' }, 'Used when this character is added to a fight in the Combat tab.'));
  statsEl.hidden = familyOf(e.type).id !== 'people';

  const links = h('div', { class: 'backlinks' });
  function drawLinks() {
    const refs = [...state.entries.values()].filter((o) => o.id !== e.id
      && (mentions(o.overview, e.id) || (!state.playerView && mentions(o.secrets, e.id))));
    const pins = [];
    for (const m of state.maps.values()) for (const p of m.pins) if (p.entryId === e.id) pins.push([m, p]);
    const sessions = [];
    for (const c of state.campaigns.values()) {
      for (const a of c.arcs) for (const ss of a.sessions) if (mentions(ss.notes, e.id)) sessions.push([c, ss]);
    }
    const chip = (href, color, label, sub) =>
      h('a', { class: 'chip', href, style: `--c:${color}` }, h('span', { class: 'dot' }), label, sub ? h('span', { class: 'ty' }, sub) : null);
    fill(links, 
      h('h3', {}, 'Mentioned in'),
      refs.length || sessions.length
        ? h('div', { class: 'chips' },
          refs.map((o) => chip('#/bible/' + o.id, colorOf(o.type), o.title, o.type)),
          sessions.map(([c, ss]) => chip(`#/campaigns/${c.id}/${ss.id}`, 'var(--accent)', ss.title, c.name)))
        : h('p', { class: 'muted small' }, 'Nothing links here yet. Type @' + (e.title.split(' ')[0] || '') + ' in another entry.'),
      pins.length ? h('h3', {}, 'On maps') : null,
      pins.length ? h('div', { class: 'chips' }, pins.map(([m, p]) => chip(`#/map/${m.id}/${p.id}`, p.color, `${p.icon} ${p.label}`, m.name))) : null,
    );
  }
  drawLinks();

  root.append(h('div', { class: 'entry' },
    header,
    statsEl,
    h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Overview'), overview.el),
    h('div', { class: 'field dm-only' }, h('label', { class: 'field-label secret-label' }, '🔒 DM secrets'), secrets.el),
    links,
  ));
  if (e.title === 'New entry') { title.focus(); title.select(); }

  return {
    update(kind, changedId) {
      if (kind === 'entries' && changedId === e.id && !alive()) return;
      if (kind === 'entries' && changedId !== e.id) { overview.refresh(); secrets.refresh(); }
      if (kind !== 'entries' || changedId !== e.id) drawLinks();
    },
    destroy() { overview.flush(); secrets.flush(); },
  };
}
