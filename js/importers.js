// Character importers. Each returns normalized characters:
// { name, kind: 'pc'|'npc', ac, maxHp, hp, initBonus, speed, source }
//
// Supported:
//  - Fillable D&D 5e character sheet PDFs (official sheet, D&D Beyond PDF export, most clones)
//  - Foundry VTT dnd5e actor JSON
//  - D&D Beyond character JSON (character-service format; AC must be checked)
//  - 5etools monster JSON (single monster or bestiary file)
//  - Improved Initiative JSON
//  - Lorekeeper backups (People entries with combat stats)
//  - Generic JSON {name, ac, hp, init} or arrays of them
//  - CSV / TSV with a header row (name, ac, hp, init, type)
//  - Text: NPC-generator write-ups, 5e stat blocks, "AC: 15 / HP: 27" notes (.txt, or any PDF/image text)
//  - Any other PDF (e.g. a web page printed to PDF), via pdf.js text extraction
//  - Images (PNG/JPG/WebP…), via Tesseract OCR
//
// Text-based characters may also carry: overview/secrets (HTML), entryType, defaulted.

// Heavy readers are downloaded only when needed (free CDNs; internet needed the first time).
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'];

const num = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const m = String(v).match(/[-+]?\d+/);
  return m ? parseInt(m[0], 10) : null;
};
const mod = (score) => (score == null ? null : Math.floor((score - 10) / 2));
const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');

function character(o) {
  const name = String(o.name || '').trim();
  // Skip garbage: empty, very long, or containing control/replacement characters.
  if (!name || name.length > 80 || /[\u0000-\u001F�]/.test(name)) return null;
  const maxHp = num(o.maxHp);
  return {
    name,
    kind: o.kind === 'pc' ? 'pc' : 'npc',
    ac: num(o.ac),
    maxHp,
    hp: num(o.hp) ?? maxHp,
    initBonus: num(o.initBonus) ?? 0,
    speed: o.speed ? String(o.speed) : null,
    source: o.source || '',
    overview: o.overview || '',
    secrets: o.secrets || '',
    entryType: o.entryType || null,
    defaulted: !!o.defaulted,
  };
}

/**
 * @param {File[]} files
 * @param {(msg:string)=>void} [onStatus] progress messages for slow readers
 */
export async function parseFiles(files, onStatus) {
  const chars = [], errors = [];
  for (const f of files) {
    try {
      const found = (await parseFile(f, onStatus)).filter(Boolean);
      if (!found.length) errors.push(`${f.name}: no characters found`);
      chars.push(...found);
    } catch (e) {
      errors.push(`${f.name}: ${e.message}`);
    }
  }
  return { chars, errors };
}

const baseName = (f) => f.name.replace(/\.[^.]+$/, '');

async function parseFile(f, onStatus) {
  const lower = f.name.toLowerCase();
  const ext = (lower.match(/\.([a-z0-9]+)$/) || [])[1] || '';

  if (ext === 'pdf' || f.type === 'application/pdf') {
    const sheet = await parsePdfForm(f);
    if (sheet) return [sheet];
    onStatus?.(`Reading ${f.name}…`);
    return [requireText(parseText(await pdfText(f), baseName(f), 'PDF'), f)];
  }
  if (IMAGE_EXT.includes(ext) || f.type.startsWith('image/')) {
    onStatus?.(`Reading text from ${f.name}… (the first image takes a little longer)`);
    return [requireText(parseText(await ocr(f, onStatus), baseName(f), 'image'), f)];
  }
  if (ext && !['json', 'csv', 'tsv', 'txt', 'md'].includes(ext)) {
    throw new Error(`.${ext} files aren't supported. Use a PDF, an image, JSON, CSV or a text file`);
  }
  const text = await f.text();
  if (looksBinary(text)) throw new Error("this doesn't look like a character file");
  if (ext === 'csv' || ext === 'tsv' || ((ext === 'txt' || !ext) && looksLikeCsv(text))) return parseCsv(text);
  if (ext === 'txt' || ext === 'md') return [requireText(parseText(text, baseName(f), 'text'), f)];
  let data;
  try { data = JSON.parse(text); } catch {
    const t = parseText(text, baseName(f), 'text');
    if (t) return [t];
    throw new Error('this file is not valid JSON');
  }
  return parseJson(data, baseName(f));
}

function requireText(ch, f) {
  if (!ch) throw new Error("couldn't find a name or stats (AC, HP, ability scores) in it");
  return ch;
}

/** A header row naming known columns, and the same delimiter on most lines. */
function looksLikeCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  if (lines.length < 2) return false;
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const head = lines[0].split(delim).map(norm);
  if (!head.some((h) => ['name', 'charactername', 'creature'].includes(h))) return false;
  return lines.every((l) => l.split(delim).length >= 2);
}

// ---- loaders for pdf.js and Tesseract ---------------------------------------

const loaded = {};
function loadScript(src) {
  loaded[src] ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => { delete loaded[src]; s.remove(); reject(new Error('could not download the file reader. Are you online?')); };
    document.head.append(s);
  });
  return loaded[src];
}

async function pdfText(file) {
  await loadScript(PDFJS + 'pdf.min.js');
  const lib = window.pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  let doc;
  try {
    doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  } catch (e) {
    throw new Error(e?.name === 'PasswordException' ? 'this PDF is password-protected' : "couldn't open this PDF");
  }
  const lines = [];
  for (let p = 1; p <= Math.min(doc.numPages, 12); p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    let line = '', lastY = null;
    for (const it of items) {
      const y = it.transform ? it.transform[5] : lastY;
      if (lastY != null && Math.abs(y - lastY) > 2 && line.trim()) { lines.push(line); line = ''; }
      line += it.str;
      if (it.hasEOL) { lines.push(line); line = ''; }
      lastY = y;
    }
    if (line.trim()) lines.push(line);
  }
  doc.destroy();
  const text = lines.join('\n');
  if (!text.trim()) throw new Error('this PDF has no readable text (it may be a scan). Try a screenshot image instead');
  return text;
}

async function ocr(file, onStatus) {
  await loadScript(TESSERACT);
  let last = -1;
  const worker = await window.Tesseract.createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round(m.progress * 100);
        if (pct >= last + 25) { last = pct; onStatus?.(`Reading ${file.name}… ${pct}%`); }
      }
    },
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

// ---- free text (NPC write-ups, stat blocks, notes) ----------------------------

const HEADINGS = ['description', 'appearance', 'personality traits', 'personality', 'ability scores', 'abilities',
  'relationships', 'alignment tendencies', 'alignment', 'plot hook', 'plot hooks', 'hooks', 'background', 'notes',
  'secrets', 'secret', 'motivation', 'motivations', 'traits', 'actions', 'reactions', 'legendary actions'];
const SECRET_HEADINGS = new Set(['plot hook', 'plot hooks', 'hooks', 'secrets', 'secret', 'motivation', 'motivations']);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Parse a character out of plain text. Returns a character or null. */
export function parseText(text, fallbackName = '', sourceLabel = 'text') {
  const t = String(text || '').replace(/\r/g, '').replace(/[ \t ]+/g, ' ').replace(/[−–—]/g, '-');
  const lines = t.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return null;
  const grab = (re) => { const m = t.match(re); return m ? parseInt(m[1].replace(/\s/g, ''), 10) : null; };
  const ability = (full, short) => grab(new RegExp(String.raw`\b(?:${full}|${short})\b\s*[-:]?\s*(\d{1,2})\b`, 'i'));

  const dex = ability('Dexterity', 'DEX');
  let ac = grab(/\b(?:Armou?r Class|AC)\b\s*[-:]?\s*(\d{1,2})\b/i);
  let maxHp = grab(/\b(?:Hit Points?(?: Maximum)?|Max(?:imum)? HP|HP Max|HP)\b\s*[-:]?\s*(\d{1,4})\b/i);
  const init = grab(/\bInit(?:iative)?\b\s*(?:bonus|mod(?:ifier)?)?\s*[-:]?\s*([+-]?\s?\d{1,2})\b/i);
  const speedM = t.match(/\bSpeed\b\s*[-:]?\s*(\d{1,3}\s*ft\.?)/i);

  // Name
  let name = null, entryType = null, kind = 'npc', defaulted = false;
  const gen = t.match(/(?:^|\n)\s*([A-Z][\p{L}'’-]+(?: [A-Z][\p{L}'’-]+){0,3}) is an? \d+[ -]?years?[ -]old\b[^.\n]*/u);
  const labelled = t.match(/\b(?:Character Name|Name)\s*[:-]\s*([^\n]{2,60})/i);
  if (gen) { name = gen[1]; entryType = 'NPC'; }
  else if (labelled) name = labelled[1].trim();
  else if ((ac != null || maxHp != null) && lines[0].length <= 50 && !/\d/.test(lines[0])) { name = lines[0]; entryType = 'Creature'; }
  const hasStats = ac != null || maxHp != null || dex != null;
  if (!name && hasStats && fallbackName) name = fallbackName;
  if (!name) return null;
  if (/\b(?:Party|Player|PC)\b/i.test(t.match(/\b(?:Player Name|Class ?& ?Level|Class Level)\b/i)?.[0] || '')) kind = 'pc';

  // NPC write-ups rarely include combat numbers: fall back to a 5e Commoner.
  if (gen && ac == null && maxHp == null) { ac = 10 + (mod(dex) ?? 0); maxHp = 4; defaulted = true; }

  // Sections -> overview / DM secrets
  const isHeading = (l) => HEADINGS.includes(l.toLowerCase().replace(/[:#*]+/g, '').trim());
  const junk = (l) => /^(https?:\/\/|www\.)|^\d+\s*\/\s*\d+$|^page \d+/i.test(l) || /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s/.test(l);
  const sections = [];
  let cur = null;
  for (const l of lines) {
    if (isHeading(l)) { cur = { title: titleCase(l.replace(/[:#*]+/g, '').trim()), lines: [] }; sections.push(cur); }
    else if (cur && !junk(l)) cur.lines.push(l);
  }
  const block = (s) => `<h2>${esc(s.title)}</h2>` + s.lines.map((l) => `<p>${esc(l)}</p>`).join('');
  let overview = '', secrets = '';
  if (sections.length) {
    overview = sections.filter((s) => !SECRET_HEADINGS.has(s.title.toLowerCase()) && s.lines.length).map(block).join('');
    secrets = sections.filter((s) => SECRET_HEADINGS.has(s.title.toLowerCase()) && s.lines.length).map(block).join('');
  } else {
    overview = lines.filter((l) => !junk(l)).slice(0, 80).map((l) => `<p>${esc(l)}</p>`).join('');
  }
  if (overview.length > 20000) overview = overview.slice(0, 20000);

  return character({
    name, kind, ac, maxHp,
    initBonus: init ?? mod(dex) ?? 0,
    speed: speedM ? speedM[1].replace(/\.$/, '') : null,
    source: sourceLabel, overview, secrets, entryType, defaulted,
  });
}

/** True for images, zips, Word docs, etc. read as text. */
function looksBinary(text) {
  const sample = text.slice(0, 4000);
  if (sample.includes('\u0000')) return true;
  const bad = (sample.match(/[�\u0001-\u0008\u000E-\u001F]/g) || []).length;
  return bad > sample.length * 0.02;
}

// ---- JSON ---------------------------------------------------------------

function parseJson(data, fallbackName) {
  if (Array.isArray(data)) return data.flatMap((d) => parseJson(d, fallbackName));
  if (!data || typeof data !== 'object') return [];

  // Lorekeeper backup
  if (data.app === 'lorekeeper') {
    return (data.entries || []).filter((e) => e.stats).map((e) => character({
      name: e.title, kind: e.type === 'Party Member' ? 'pc' : 'npc', ...e.stats, source: 'Lorekeeper',
    }));
  }
  // Containers
  if (Array.isArray(data.monster)) return data.monster.flatMap((d) => parseJson(d, fallbackName)); // 5etools bestiary
  for (const key of ['characters', 'party', 'combatants', 'actors', 'creatures']) {
    if (Array.isArray(data[key])) return data[key].flatMap((d) => parseJson(d, fallbackName));
  }
  // D&D Beyond character service: { data: { name, stats, baseHitPoints, ... } }
  const ddb = data.data && data.data.baseHitPoints != null ? data.data : data.baseHitPoints != null ? data : null;
  if (ddb && Array.isArray(ddb.stats)) return [fromDdb(ddb)];
  // Foundry VTT actor (v10+: system, older: data)
  const sys = data.system?.attributes ? data.system : data.data?.attributes ? data.data : null;
  if (sys) return [fromFoundry(data, sys)];
  // Improved Initiative
  if (data.Name && (data.HP || data.AC)) {
    return [character({
      name: data.Name, kind: data.Player === 'player' ? 'pc' : 'npc',
      ac: data.AC?.Value ?? data.AC, maxHp: data.HP?.Value ?? data.HP, initBonus: data.InitiativeModifier, source: 'Improved Initiative',
    })];
  }
  // 5etools monster
  if (data.name && data.hp && (data.hp.average != null || data.hp.special) && data.ac) {
    const ac = Array.isArray(data.ac) ? (typeof data.ac[0] === 'object' ? data.ac[0].ac : data.ac[0]) : data.ac;
    const speed = data.speed?.walk != null ? `${typeof data.speed.walk === 'object' ? data.speed.walk.number : data.speed.walk} ft` : null;
    return [character({ name: data.name, kind: 'npc', ac, maxHp: data.hp.average, initBonus: mod(num(data.dex)), speed, source: '5etools' })];
  }
  // Generic
  const flat = {};
  for (const [k, v] of Object.entries(data)) flat[norm(k)] = v;
  const pick = (...keys) => { for (const k of keys) if (flat[k] != null && flat[k] !== '') return flat[k]; return null; };
  const name = pick('name', 'charactername', 'title');
  const hpVal = pick('maxhp', 'hpmax', 'hitpoints', 'hp');
  const ac = pick('ac', 'armorclass', 'armourclass');
  if (!name && hpVal == null && ac == null) return [];
  const dex = num(typeof pick('dex', 'dexterity') === 'object' ? null : pick('dex', 'dexterity'));
  const typeStr = String(pick('kind', 'type', 'side') || '').toLowerCase();
  return [character({
    name: name || fallbackName,
    kind: /^(pc|player|character|party)/.test(typeStr) ? 'pc' : 'npc',
    ac: typeof ac === 'object' ? (ac.value ?? ac.ac) : ac,
    maxHp: typeof hpVal === 'object' ? (hpVal.max ?? hpVal.average ?? hpVal.value) : hpVal,
    hp: pick('currenthp', 'hpcurrent'),
    initBonus: pick('initbonus', 'initiativebonus', 'initiativemodifier', 'init', 'initiative') ?? mod(dex),
    speed: pick('speed'),
    source: 'JSON',
  })];
}

function fromFoundry(actor, sys) {
  const at = sys.attributes || {};
  const dex = num(sys.abilities?.dex?.value);
  const ac = num(at.ac?.flat) ?? num(at.ac?.value) ?? (dex != null ? 10 + mod(dex) : null);
  const walk = at.movement?.walk;
  return character({
    name: actor.name, kind: actor.type === 'character' ? 'pc' : 'npc',
    ac, maxHp: at.hp?.max, hp: at.hp?.value,
    initBonus: (mod(dex) ?? 0) + (num(at.init?.bonus) ?? 0),
    speed: walk ? `${walk} ${at.movement?.units || 'ft'}` : null,
    source: 'Foundry VTT',
  });
}

function fromDdb(d) {
  const score = (id) => {
    const ov = d.overrideStats?.find((s) => s.id === id)?.value;
    if (ov != null) return ov;
    return (d.stats.find((s) => s.id === id)?.value ?? 10) + (d.bonusStats?.find((s) => s.id === id)?.value ?? 0);
  };
  const level = (d.classes || []).reduce((t, c) => t + (c.level || 0), 0) || 1;
  const maxHp = d.overrideHitPoints ?? ((d.baseHitPoints || 0) + (d.bonusHitPoints || 0) + mod(score(3)) * level);
  return character({
    name: d.name, kind: 'pc', ac: null, maxHp, hp: maxHp - (d.removedHitPoints || 0),
    initBonus: mod(score(2)), source: 'D&D Beyond (check AC)',
  });
}

// ---- CSV ----------------------------------------------------------------

function splitRow(line, delim) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  let header = splitRow(lines[0], delim).map(norm);
  const hasHeader = header.some((h) => ['name', 'ac', 'hp', 'maxhp', 'init', 'initiative'].includes(h));
  if (!hasHeader) header = ['name', 'ac', 'hp', 'init', 'type'];
  const col = (...names) => header.findIndex((h) => names.includes(h));
  const ci = {
    name: col('name', 'charactername', 'character', 'creature'),
    ac: col('ac', 'armorclass'),
    hp: col('maxhp', 'hpmax', 'hp', 'hitpoints'),
    init: col('init', 'initiative', 'initbonus', 'initiativebonus', 'initmod'),
    type: col('type', 'kind', 'side'),
    speed: col('speed'),
  };
  return lines.slice(hasHeader ? 1 : 0).map((l) => {
    const r = splitRow(l, delim);
    const get = (i) => (i >= 0 ? r[i] : null);
    return character({
      name: get(ci.name), ac: get(ci.ac), maxHp: get(ci.hp), initBonus: get(ci.init), speed: get(ci.speed),
      kind: /^(pc|player|party|character)/i.test(get(ci.type) || '') ? 'pc' : 'npc', source: 'CSV',
    });
  });
}

// ---- PDF (fillable character sheets) -------------------------------------

const latin1 = (bytes) => new TextDecoder('latin1').decode(bytes);

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate');
  const writer = ds.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

function decodePdfString(raw) {
  let bytes;
  if (raw.startsWith('<')) {
    const hex = raw.slice(1, -1).replace(/\s+/g, '');
    bytes = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2).padEnd(2, '0'), 16));
  } else {
    const s = raw.slice(1, -1);
    bytes = [];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch !== '\\') { bytes.push(s.charCodeAt(i) & 0xff); continue; }
      const n = s[++i];
      const map = { n: 10, r: 13, t: 9, b: 8, f: 12, '(': 40, ')': 41, '\\': 92 };
      if (n in map) bytes.push(map[n]);
      else if (/[0-7]/.test(n)) {
        let oct = n;
        while (oct.length < 3 && /[0-7]/.test(s[i + 1])) oct += s[++i];
        bytes.push(parseInt(oct, 8) & 0xff);
      } else if (n === '\r' || n === '\n') { if (n === '\r' && s[i + 1] === '\n') i++; }
      else if (n != null) bytes.push(n.charCodeAt(0) & 0xff);
    }
  }
  const u8 = new Uint8Array(bytes);
  if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder('utf-16be').decode(u8.slice(2));
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return new TextDecoder().decode(u8.slice(3));
  return latin1(u8);
}

const STR = String.raw`\((?:\\[\s\S]|[^\\)])*\)|<[0-9A-Fa-f\s]*>`;
const V_RE = new RegExp(String.raw`\/V\s*(${STR}|\/[^\s\/<>\[\]()]+)`);

function readV(s, last = false) {
  if (!last) { const m = s.match(V_RE); return m ? m[1] : null; }
  const all = [...s.matchAll(new RegExp(V_RE.source, 'g'))];
  return all.length ? all[all.length - 1][1] : null;
}

function extractFields(text) {
  const fields = {};
  const tRe = new RegExp(String.raw`\/T\s*(${STR})`, 'g');
  const marks = [];
  for (const m of text.matchAll(tRe)) marks.push({ i: m.index, end: m.index + m[0].length, name: decodePdfString(m[1]) });
  marks.forEach((mk, k) => {
    const hi = k + 1 < marks.length ? marks[k + 1].i : text.length;
    let after = text.slice(mk.end, Math.min(hi, mk.end + 1500));
    const stop = after.search(/endobj|>>\s*<</);
    if (stop >= 0) after = after.slice(0, stop);
    let before = text.slice(Math.max(k ? marks[k - 1].end : 0, mk.i - 1500), mk.i);
    const cut = Math.max(before.lastIndexOf('endobj'), before.lastIndexOf(' obj'), ...[...before.matchAll(/>>\s*<</g)].map((x) => x.index));
    if (cut >= 0) before = before.slice(cut);
    const raw = readV(after) ?? readV(before, true);
    if (raw == null) return;
    const val = raw.startsWith('/') ? raw.slice(1) : decodePdfString(raw);
    if (val.trim() && !(mk.name in fields)) fields[mk.name] = val.trim();
  });
  return fields;
}

/** Read a fillable character sheet's form fields. Returns null if it has none (caller falls back to text). */
async function parsePdfForm(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = latin1(bytes);
  if (/\/Encrypt\s/.test(text) || !/\/AcroForm/.test(text) && !/\/ObjStm/.test(text)) return null;
  const parts = [text];
  // Modern PDFs keep form fields inside compressed object streams.
  for (const m of text.matchAll(/stream\r?\n/g)) {
    const objStart = text.lastIndexOf(' obj', m.index);
    const dict = text.slice(objStart, m.index);
    if (!/\/FlateDecode/.test(dict) || !/\/Type\s*\/ObjStm/.test(dict)) continue;
    const start = m.index + m[0].length;
    let end = text.indexOf('endstream', start);
    if (end < 0) continue;
    while (end > start && (text[end - 1] === '\n' || text[end - 1] === '\r')) end--;
    try { parts.push(latin1(await inflate(bytes.slice(start, end)))); } catch { /* skip unreadable stream */ }
  }
  const raw = extractFields(parts.join('\n'));
  const f = {};
  for (const [k, v] of Object.entries(raw)) f[norm(k)] ??= v;
  const pick = (...keys) => { for (const k of keys) if (f[k] != null) return f[k]; return null; };

  const name = pick('charactername', 'charactername2', 'name', 'pcname', 'character');
  const ac = pick('ac', 'armorclass', 'armourclass');
  const maxHp = pick('hpmax', 'maxhp', 'hitpointmaximum', 'hpmaximum', 'maxhitpoints');
  if (!name && ac == null && maxHp == null) return null;
  const dex = num(pick('dex', 'dexterity', 'dexscore'));
  const init = pick('initiative', 'init', 'initbonus');
  return character({
    name: name || file.name.replace(/\.pdf$/i, ''),
    kind: 'pc',
    ac, maxHp,
    hp: pick('hpcurrent', 'currenthp', 'currenthitpoints'),
    initBonus: init ?? pick('dexmod') ?? mod(dex),
    speed: pick('speed'),
    source: 'PDF sheet',
  });
}
