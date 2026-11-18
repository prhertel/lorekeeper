// Campaigns: arcs contain sessions; each session is a list of beats plus notes.
import { h, fill, uid, ask } from './dom.js';
import { state, save, remove, onChange } from './state.js';
import { createEditor } from './editor.js';
import { newEntry } from './bible.js';

const STATUS = [['played', 'Played'], ['current', 'Current'], ['upcoming', 'Upcoming']];
const KINDS = [['beat', 'Beat'], ['encounter', 'Main encounter'], ['cliffhanger', 'Cliffhanger']];
const HINTS = {
  beat: 'What happens…',
  encounter: 'The big fight, chase or confrontation…',
  cliffhanger: 'End the night on…',
};

export function newCampaign(name = 'New campaign') {
  const c = { id: uid(), name, createdAt: Date.now(), arcs: [{ id: uid(), name: 'Arc 1', sessions: [] }] };
  save('campaigns', c);
  return c;
}

export function newSession(c, arc) {
  const n = c.arcs.reduce((t, a) => t + a.sessions.length, 0) + 1;
  const ss = {
    id: uid(), title: `Session ${n}`, status: 'upcoming', date: '', notes: '',
    beats: KINDS.map(([kind]) => ({ id: uid(), kind, text: '' })),
  };
  arc.sessions.push(ss);
  save('campaigns', c);
  return ss;
}

function find(c, sid) {
  for (const arc of c.arcs) {
    const session = arc.sessions.find((x) => x.id === sid);
    if (session) return { arc, session };
  }
  return null;
}

const byCreated = (a, b) => a.createdAt - b.createdAt;

export function render(root, [cid, sid]) {
  const c = (cid && state.campaigns.get(cid)) || [...state.campaigns.values()].sort(byCreated)[0];
  if (!c) {
    root.append(h('div', { class: 'empty-state center' },
      h('h2', {}, 'Campaigns'),
      h('p', {}, 'Plan your story as arcs, each made of sessions. Every session is a short list of beats with a main encounter and a cliffhanger.'),
      h('button', { class: 'btn primary', onClick: () => { const n = newCampaign(); location.hash = '#/campaigns/' + n.id; } }, '+ New campaign')));
    return null;
  }
  if (c.id !== cid) history.replaceState(null, '', '#/campaigns/' + c.id);
  const found = sid ? find(c, sid) : null;
  let quiet = false;
  const quietSave = () => { quiet = true; save('campaigns', c); quiet = false; };

  const selWrap = h('div', { class: 'camp-select' });
  const nameInput = h('input', {
    class: 'title-input small', value: c.name, placeholder: 'Campaign name', 'aria-label': 'Campaign name',
    onInput: (ev) => { c.name = ev.target.value; save('campaigns', c); },
  });
  const tree = h('div', { class: 'tree' });
  const left = h('section', { class: 'pane list-pane' }, selWrap, nameInput, tree);
  const detail = h('section', { class: 'pane detail-pane' });
  root.append(h('div', { class: 'split' }, left, detail));

  function drawSelect() {
    fill(selWrap, h('select', {
      'aria-label': 'Choose campaign',
      onChange: (ev) => {
        if (ev.target.value === '__new') { const n = newCampaign(); location.hash = '#/campaigns/' + n.id; }
        else location.hash = '#/campaigns/' + ev.target.value;
      },
    }, [...state.campaigns.values()].sort(byCreated).map((x) => h('option', { value: x.id, selected: x.id === c.id }, x.name || 'Untitled')),
      h('option', { value: '__new' }, '+ New campaign…')));
  }

  function drawTree() {
    fill(tree, 
      ...c.arcs.map((a, ai) => h('div', { class: 'arc' },
        h('div', { class: 'arc-head' },
          h('button', { class: 'icon-btn caret', title: a.collapsed ? 'Expand' : 'Collapse', onClick: () => { a.collapsed = !a.collapsed; save('campaigns', c); } }, a.collapsed ? '▸' : '▾'),
          h('input', { class: 'arc-name', value: a.name, 'aria-label': 'Arc name', onInput: (ev) => { a.name = ev.target.value; quietSave(); } }),
          h('button', {
            class: 'icon-btn', title: 'Add session to this arc',
            onClick: () => { a.collapsed = false; const ss = newSession(c, a); location.hash = `#/campaigns/${c.id}/${ss.id}`; },
          }, '+'),
          h('button', {
            class: 'icon-btn danger', title: 'Delete arc',
            onClick: async () => {
              if (a.sessions.length && !(await ask(`Delete “${a.name}” and its ${a.sessions.length} session(s)?`, { ok: 'Delete', danger: true }))) return;
              c.arcs.splice(ai, 1);
              save('campaigns', c);
              if (found && !find(c, found.session.id)) location.hash = '#/campaigns/' + c.id;
            },
          }, '✕')),
        a.collapsed ? null : h('div', { class: 'sessions' },
          a.sessions.map((ss) => h('a', {
            class: `session-row st-${ss.status}` + (ss.id === sid ? ' active' : ''), href: `#/campaigns/${c.id}/${ss.id}`,
          }, h('span', { class: 'st-dot' }), h('span', { class: 't' }, ss.title || 'Untitled session'), ss.date ? h('span', { class: 'ty' }, ss.date) : null)),
          a.sessions.length ? null : h('p', { class: 'muted small pad' }, 'No sessions yet. Press + to add one.')))),
      h('button', { class: 'btn ghost wide', onClick: () => { c.arcs.push({ id: uid(), name: `Arc ${c.arcs.length + 1}`, sessions: [] }); save('campaigns', c); } }, '+ Add arc'),
      h('div', { class: 'legend' }, STATUS.map(([k, l]) => h('span', { class: 'st-' + k }, h('span', { class: 'st-dot' }), l))),
      h('button', {
        class: 'btn danger ghost small', onClick: async () => {
          if (!(await ask(`Delete the campaign “${c.name}” and all its sessions?`, { ok: 'Delete', danger: true }))) return;
          remove('campaigns', c.id);
          location.hash = '#/campaigns';
        },
      }, 'Delete campaign'),
    );
  }

  drawSelect();
  drawTree();
  const notes = found ? renderSession(detail, c, found) : renderOverview(detail, c);

  const off = onChange((kind) => {
    if (kind === 'campaigns' && !quiet) {
      if (!state.campaigns.has(c.id)) return;
      drawSelect();
      drawTree();
    }
    if (kind === 'entries') notes?.refresh();
  });
  return () => { off(); notes?.flush(); };
}

function renderOverview(root, c) {
  const all = c.arcs.flatMap((a) => a.sessions);
  const current = all.find((x) => x.status === 'current');
  const next = all.find((x) => x.status === 'upcoming');
  const count = (st) => all.filter((x) => x.status === st).length;
  root.append(h('div', { class: 'empty-state' },
    h('h2', {}, c.name || 'Untitled campaign'),
    h('div', { class: 'stats' },
      STATUS.map(([k, l]) => h('div', { class: 'stat st-' + k }, h('div', { class: 'big' }, count(k)), h('div', {}, l)))),
    current ? h('p', {}, 'Current session: ', h('a', { href: `#/campaigns/${c.id}/${current.id}` }, current.title)) : null,
    !current && next ? h('p', {}, 'Next up: ', h('a', { href: `#/campaigns/${c.id}/${next.id}` }, next.title)) : null,
    !all.length ? h('p', { class: 'muted' }, 'Press + next to an arc to add your first session.') : null));
  return null;
}

function renderSession(root, c, { arc, session: ss }) {
  const alive = () => state.campaigns.has(c.id) && find(c, ss.id);
  const statusBar = h('div', { class: 'seg-buttons', role: 'group', 'aria-label': 'Status' });
  function drawStatus() {
    fill(statusBar, ...STATUS.map(([k, l]) => h('button', {
      class: `seg-btn st-${k}` + (ss.status === k ? ' on' : ''),
      onClick: () => {
        if (k === 'current') {
          for (const a of c.arcs) for (const o of a.sessions) if (o !== ss && o.status === 'current') o.status = 'played';
        }
        ss.status = k;
        save('campaigns', c);
        drawStatus();
      },
    }, h('span', { class: 'st-dot' }), l)));
  }
  drawStatus();

  const beatsEl = h('ol', { class: 'beats' });
  function move(i, d) {
    const j = i + d;
    if (j < 0 || j >= ss.beats.length) return;
    [ss.beats[i], ss.beats[j]] = [ss.beats[j], ss.beats[i]];
    save('campaigns', c);
    drawBeats();
  }
  function drawBeats(focusIdx) {
    fill(beatsEl, ...ss.beats.map((b, i) => h('li', { class: 'beat k-' + b.kind },
      h('select', {
        class: 'beat-kind', 'aria-label': 'Beat type',
        onChange: (ev) => { b.kind = ev.target.value; save('campaigns', c); drawBeats(); },
      }, KINDS.map(([k, l]) => h('option', { value: k, selected: k === b.kind }, l))),
      h('input', {
        class: 'beat-text', value: b.text, placeholder: HINTS[b.kind], 'aria-label': 'Beat',
        onInput: (ev) => { b.text = ev.target.value; save('campaigns', c); },
        onKeydown: (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            ss.beats.splice(i + 1, 0, { id: uid(), kind: 'beat', text: '' });
            save('campaigns', c);
            drawBeats(i + 1);
          }
        },
      }),
      h('div', { class: 'beat-actions' },
        h('button', { class: 'icon-btn', title: 'Move up', disabled: i === 0, onClick: () => move(i, -1) }, '↑'),
        h('button', { class: 'icon-btn', title: 'Move down', disabled: i === ss.beats.length - 1, onClick: () => move(i, 1) }, '↓'),
        h('button', { class: 'icon-btn danger', title: 'Remove beat', onClick: () => { ss.beats.splice(i, 1); save('campaigns', c); drawBeats(); } }, '✕')))));
    if (focusIdx != null) beatsEl.querySelectorAll('.beat-text')[focusIdx]?.focus();
  }
  drawBeats();

  const notes = createEditor({
    html: ss.notes, placeholder: 'Prep notes, read-aloud text, what happened at the table…',
    onChange: (v) => { if (!alive()) return; ss.notes = v; save('campaigns', c); },
    onNavigate: (id) => { location.hash = '#/bible/' + id; },
    onCreate: (title) => newEntry(title, 'NPC'),
  });

  root.append(h('div', { class: 'entry session' },
    h('div', { class: 'session-header' },
      h('input', { class: 'title-input', value: ss.title, placeholder: 'Session title', 'aria-label': 'Session title', onInput: (ev) => { ss.title = ev.target.value; save('campaigns', c); } }),
      h('div', { class: 'row wrap' },
        statusBar,
        h('label', { class: 'date-label' }, 'Play date ', h('input', { type: 'date', value: ss.date, onChange: (ev) => { ss.date = ev.target.value; save('campaigns', c); } })),
        h('span', { class: 'muted small' }, arc.name))),
    h('div', { class: 'field' },
      h('label', { class: 'field-label' }, 'Beats'),
      beatsEl,
      h('button', { class: 'btn ghost small', onClick: () => { ss.beats.push({ id: uid(), kind: 'beat', text: '' }); save('campaigns', c); drawBeats(ss.beats.length - 1); } }, '+ Add beat'),
      h('p', { class: 'muted small' }, 'Press Enter in a beat to add another below it.')),
    h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Notes'), notes.el),
    h('button', {
      class: 'btn danger ghost', onClick: async () => {
        if (!(await ask(`Delete “${ss.title}”?`, { ok: 'Delete', danger: true }))) return;
        arc.sessions = arc.sessions.filter((x) => x !== ss);
        save('campaigns', c);
        location.hash = '#/campaigns/' + c.id;
      },
    }, 'Delete session')));
  return notes;
}
