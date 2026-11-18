// Rich text editor with a small toolbar and @-mentions that link to World Bible entries.
import { h, fill, sanitize, debounce } from './dom.js';
import { state } from './state.js';
import { colorOf } from './types.js';

const TOOLS = [
  ['B', 'bold', 'Bold (Ctrl+B)', 'b'],
  ['I', 'italic', 'Italic (Ctrl+I)', 'i'],
  ['U', 'underline', 'Underline (Ctrl+U)', 'u'],
  ['H', 'h2', 'Heading'],
  ['•', 'insertUnorderedList', 'Bulleted list'],
  ['1.', 'insertOrderedList', 'Numbered list'],
  ['❝', 'quote', 'Quote'],
  ['⨯', 'removeFormat', 'Clear formatting'],
];

/**
 * @param {object} o
 * @param {string} o.html initial (sanitized) html
 * @param {string} [o.placeholder]
 * @param {(html:string)=>void} o.onChange debounced
 * @param {(id:string)=>void} [o.onNavigate] mention clicked
 * @param {(title:string)=>object} [o.onCreate] create a new entry from an @query
 */
export function createEditor({ html = '', placeholder = '', onChange, onNavigate, onCreate, className = '' }) {
  const save = debounce(() => onChange?.(sanitize(body.innerHTML)), 400);

  const body = h('div', {
    class: 'editor-body',
    contentEditable: 'true',
    spellcheck: true,
    'data-placeholder': placeholder,
  });
  body.innerHTML = sanitize(html);

  const toolbar = h('div', { class: 'editor-toolbar' },
    TOOLS.map(([label, cmd, title, cls]) => h('button', {
      type: 'button', title, class: 'tool' + (cls ? ' tool-' + cls : ''),
      onMousedown: (e) => e.preventDefault(),
      onClick: () => exec(cmd),
    }, label)),
    h('span', { class: 'editor-hint' }, 'Type @ to link'),
  );

  const pop = h('div', { class: 'mention-pop hidden' });
  const wrap = h('div', { class: 'editor ' + className }, toolbar, body, pop);

  function isIn(tag) {
    let n = getSelection().anchorNode;
    while (n && n !== body) { if (n.nodeName === tag) return true; n = n.parentNode; }
    return false;
  }

  function exec(cmd) {
    body.focus();
    if (cmd === 'h2') document.execCommand('formatBlock', false, isIn('H2') ? '<p>' : '<h2>');
    else if (cmd === 'quote') document.execCommand('formatBlock', false, isIn('BLOCKQUOTE') ? '<p>' : '<blockquote>');
    else document.execCommand(cmd);
    changed();
  }

  function changed() {
    wrap.classList.toggle('is-empty', !body.textContent.trim() && !body.querySelector('li,.mention'));
    save();
  }

  // ---- @-mentions -------------------------------------------------------
  let mq = null; // { node, start, end, query, items, index }

  function close() { mq = null; pop.classList.add('hidden'); }

  function checkMention() {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return close();
    const node = sel.anchorNode, off = sel.anchorOffset;
    if (!node || node.nodeType !== 3 || !body.contains(node)) return close();
    const m = node.data.slice(0, off).match(/(?:^|[\s( ])@([^\s@ ]{0,40})$/);
    if (!m) return close();
    const query = m[1];
    const start = off - query.length - 1;
    const q = query.toLowerCase();
    const items = [...state.entries.values()]
      .filter((e) => (e.title || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const sa = a.title.toLowerCase().startsWith(q) ? 0 : 1;
        const sb = b.title.toLowerCase().startsWith(q) ? 0 : 1;
        return sa - sb || a.title.localeCompare(b.title);
      })
      .slice(0, 8)
      .map((entry) => ({ entry }));
    if (query && onCreate && !items.some((i) => i.entry.title.toLowerCase() === q)) items.push({ create: query });
    if (!items.length) return close();
    mq = { node, start, end: off, query, items, index: Math.min(mq?.index ?? 0, items.length - 1) };
    drawPop();
    const r = document.createRange();
    r.setStart(node, start);
    r.setEnd(node, start + 1);
    const rect = r.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(rect.left, innerWidth - 280)) + 'px';
    pop.style.top = (rect.bottom + 6) + 'px';
  }

  function drawPop() {
    pop.classList.remove('hidden');
    fill(pop, ...mq.items.map((it, i) => h('div', {
      class: 'mention-item' + (i === mq.index ? ' on' : ''),
      onMousedown: (e) => { e.preventDefault(); pick(i); },
    }, it.entry
      ? [h('span', { class: 'dot', style: `--c:${colorOf(it.entry.type)}` }), h('span', { class: 't' }, it.entry.title), h('span', { class: 'ty' }, it.entry.type)]
      : [h('span', { class: 'plus' }, '+'), h('span', { class: 't' }, `Create “${it.create}”`)])));
  }

  function mentionEl(e) {
    return h('a', { class: 'mention', 'data-id': e.id, contenteditable: 'false', style: `--c:${colorOf(e.type)}` }, e.title);
  }

  function pick(i) {
    const it = mq.items[i];
    const entry = it.entry || onCreate?.(it.create);
    if (!entry) return close();
    const range = document.createRange();
    range.setStart(mq.node, mq.start);
    range.setEnd(mq.node, mq.end);
    range.deleteContents();
    const space = document.createTextNode(' ');
    range.insertNode(space);
    range.insertNode(mentionEl(entry));
    const after = document.createRange();
    after.setStartAfter(space);
    after.collapse(true);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(after);
    close();
    changed();
  }

  body.addEventListener('keydown', (e) => {
    if (!mq) return;
    if (e.key === 'ArrowDown') { mq.index = (mq.index + 1) % mq.items.length; drawPop(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { mq.index = (mq.index - 1 + mq.items.length) % mq.items.length; drawPop(); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === 'Tab') { pick(mq.index); e.preventDefault(); }
    else if (e.key === 'Escape') { close(); e.preventDefault(); }
  });
  body.addEventListener('input', () => { changed(); checkMention(); });
  body.addEventListener('keyup', (e) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) checkMention(); });
  body.addEventListener('blur', () => { close(); save.flush(); });
  body.addEventListener('click', (e) => {
    const m = e.target.closest('.mention');
    if (m) { e.preventDefault(); onNavigate?.(m.dataset.id); }
  });
  body.addEventListener('paste', (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });
  body.addEventListener('drop', (e) => e.preventDefault());

  /** Update mention labels/colours after entries change. */
  function refresh() {
    for (const a of body.querySelectorAll('.mention')) {
      const e = state.entries.get(a.dataset.id);
      a.contentEditable = 'false';
      if (e) {
        if (a.textContent !== e.title) a.textContent = e.title;
        a.style.setProperty('--c', colorOf(e.type));
        a.classList.remove('broken');
        a.title = e.type;
      } else {
        a.classList.add('broken');
        a.title = 'This entry was deleted';
      }
    }
  }

  refresh();
  wrap.classList.toggle('is-empty', !body.textContent.trim() && !body.querySelector('li,.mention'));

  return { el: wrap, flush: save.flush, refresh, focus: () => body.focus() };
}
