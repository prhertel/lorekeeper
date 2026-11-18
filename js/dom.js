// Tiny DOM helpers: element builders, sanitizing, misc utilities.

const SVGNS = 'http://www.w3.org/2000/svg';

function build(el, props, children, isSvg) {
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.setAttribute('class', v);
    else if (k === 'html') el.innerHTML = v;
    else if (!isSvg && k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

/** Create an HTML element: h('div', {class: 'x', onClick}, ...children) */
export const h = (tag, props, ...children) => build(document.createElement(tag), props, children, false);
/** Create an SVG element. */
export const s = (tag, props, ...children) => build(document.createElementNS(SVGNS, tag), props, children, true);

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function toast(msg, kind = 'info') {
  const t = h('div', { class: 'toast ' + kind }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}

/** Pending debounced saves, flushed when the page is hidden. */
export const pendingFlushes = new Set();

export function debounce(fn, ms) {
  let t = null, args = [];
  const d = (...a) => {
    args = a;
    clearTimeout(t);
    pendingFlushes.add(d);
    t = setTimeout(() => { t = null; pendingFlushes.delete(d); fn(...args); }, ms);
  };
  d.flush = () => {
    if (t) { clearTimeout(t); t = null; pendingFlushes.delete(d); fn(...args); }
  };
  return d;
}

export const plainText = (html) =>
  (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const blobUrls = new WeakMap();
/** Stable object URL for a Blob (cached per blob). */
export function blobUrl(blob) {
  if (!blob) return null;
  let u = blobUrls.get(blob);
  if (!u) { u = URL.createObjectURL(blob); blobUrls.set(blob, u); }
  return u;
}

export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.click();
  });
}

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'H2', 'H3', 'P', 'BR', 'DIV', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'SPAN', 'A']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'svg', 'MATH', 'TEMPLATE', 'LINK', 'META']);

/** Keep only simple formatting tags and mention links. */
export function sanitize(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html || '';
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 1) {
        if (DROP.has(child.tagName)) { child.remove(); continue; }
        walk(child);
        if (!ALLOWED.has(child.tagName)) { child.replaceWith(...child.childNodes); continue; }
        const isMention = child.tagName === 'A' && child.classList.contains('mention') && child.dataset.id;
        for (const a of [...child.attributes]) {
          const keep = isMention && ['class', 'data-id', 'contenteditable'].includes(a.name);
          if (!keep) child.removeAttribute(a.name);
        }
        if (isMention) child.setAttribute('class', 'mention');
        if (child.tagName === 'A' && !isMention) child.replaceWith(...child.childNodes);
      } else if (child.nodeType !== 3) {
        child.remove();
      }
    }
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

/** Replace an element's children, skipping null/false (replaceChildren would print "null"). */
export function fill(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((c) => c != null && c !== false).map((c) => (c instanceof Node ? c : String(c))));
  return el;
}

/**
 * In-app confirmation dialog (the browser's confirm() is blocked in some embedded browsers).
 * Resolves true for OK, false for Cancel / Escape / clicking outside.
 */
export function ask(message, { ok = 'OK', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const done = (v) => {
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      prev?.focus?.();
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); e.stopPropagation(); done(true); }
    };
    const okBtn = h('button', { type: 'button', class: 'btn ' + (danger ? 'danger-solid' : 'primary'), onClick: () => done(true) }, ok);
    const back = h('div', { class: 'ask-backdrop', onMousedown: (e) => { if (e.target === back) done(false); } },
      h('div', { class: 'ask-box', role: 'alertdialog', 'aria-modal': 'true', 'aria-label': message },
        h('p', {}, message),
        h('div', { class: 'ask-actions' },
          h('button', { type: 'button', class: 'btn ghost', onClick: () => done(false) }, cancel),
          okBtn)));
    document.body.append(back);
    document.addEventListener('keydown', onKey, true);
    okBtn.focus();
  });
}
