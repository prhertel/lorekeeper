// Painted portrait library: sheets of character portraits shipped in assets/portraits/.
// Each tile is tagged with race, class and gender; NPCs get the closest match.
// To add more, append a sheet below with its tile rectangles and tags.

const SHEETS = [
  {
    src: 'assets/portraits/sheet-01.webp',
    // Face crop inside each card (x, y, size), above the name banner.
    tiles: [
      ['human', 'fighter', 'm', 37, 11], ['elf', 'rogue', 'f', 351, 11], ['dwarf', 'cleric', 'm', 665, 11], ['halfling', 'ranger', 'f', 979, 11],
      ['gnome', 'wizard', 'm', 37, 326], ['halforc', 'barbarian', 'm', 351, 326], ['tiefling', 'warlock', 'f', 665, 326], ['dragonborn', 'sorcerer', 'x', 979, 326],
      ['human', 'paladin', 'm', 37, 640], ['halfelf', 'bard', 'f', 351, 640], ['warforged', 'monk', 'x', 665, 640], ['dwarf', 'druid', 'm', 979, 640],
      ['gnome', 'druid', 'f', 37, 952], ['tiefling', 'sorcerer', 'f', 351, 952], ['elf', 'monk', 'f', 665, 952], ['halforc', 'ranger', 'm', 979, 952],
    ].map(([race, cls, gender, x, y]) => ({ race, cls, gender, x, y, size: 240 })),
  },
];

// Races that can stand in for one another when there's no exact portrait (closest first).
const SIMILAR = {
  human: ['human', 'halfelf', 'elf'],
  halfelf: ['halfelf', 'human', 'elf'],
  elf: ['elf', 'halfelf'],
  dwarf: ['dwarf', 'gnome'],
  halfling: ['halfling', 'gnome', 'human'],
  gnome: ['gnome', 'halfling', 'dwarf'],
  halforc: ['halforc', 'human'],
  tiefling: ['tiefling'],
  dragonborn: ['dragonborn'],
  warforged: ['warforged'],
};

export const PORTRAITS = SHEETS.flatMap((s, si) => s.tiles.map((t, ti) => ({ ...t, sheet: si, id: `${si}-${ti}` })));

const sheetImages = new Map();
function loadSheet(i) {
  if (!sheetImages.has(i)) {
    sheetImages.set(i, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { sheetImages.delete(i); reject(new Error('portrait sheet missing')); };
      img.src = SHEETS[i].src;
    }));
  }
  return sheetImages.get(i);
}

/** Rank library portraits for a look: same race & gender first, then class, then similar races. */
export function matchPortraits({ race = 'human', cls = '', gender = '' } = {}) {
  const chain = SIMILAR[race] || [race, 'human'];
  const scored = PORTRAITS.map((p) => {
    const ri = chain.indexOf(p.race);
    let score = ri < 0 ? 100 : ri * 10;
    // A different gender is more jarring than a closely related race, so it costs more than one race step.
    if (gender && p.gender !== 'x' && gender !== 'x' && p.gender !== gender) score += 12;
    if (cls && p.cls !== cls) score += 1;
    return { p, score };
  }).sort((a, b) => a.score - b.score);
  return scored;
}

/** Pick one of the best matches at random (ties broken randomly). */
export function pickPortrait(look, exclude = []) {
  const ranked = matchPortraits(look);
  const best = ranked[0].score;
  const top = ranked.filter((x) => x.score <= best + 1);
  // Prefer a face not already used, but never trade a good match for a worse one.
  const fresh = top.filter((x) => !exclude.includes(x.p.id));
  const pool = fresh.length ? fresh : top;
  return pool[Math.floor(Math.random() * pool.length)].p;
}

/**
 * Render a library portrait to an image Blob.
 * @param {object} p a PORTRAITS entry
 * @param {object} [o]
 * @param {boolean} [o.demon] apply the demonic treatment
 * @param {boolean} [o.flip] mirror horizontally
 */
export async function renderPortrait(p, { demon = false, flip = false, size = 320 } = {}) {
  const img = await loadSheet(p.sheet);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  if (flip) { g.translate(size, 0); g.scale(-1, 1); }
  g.drawImage(img, p.x, p.y, p.size, p.size, 0, 0, size, size);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (demon) demonize(g, size);
  return new Promise((resolve) => c.toBlob(resolve, 'image/webp', 0.9));
}

/** Square crop of any bundled image (e.g. a player's own character art) as a portrait Blob. */
export async function renderCrop({ src, x = 0, y = 0, size }, out = 360) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error(`picture missing: ${src}`));
    i.src = src;
  });
  const s = size || Math.min(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = c.height = out;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, x, y, s, s, 0, 0, out, out);
  return new Promise((resolve) => c.toBlob(resolve, 'image/webp', 0.92));
}

/** Converted by profane ritual: drained colour, a blood-red cast, darkness creeping in and drifting embers. */
function demonize(g, size) {
  g.globalCompositeOperation = 'saturation';
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.55;
  g.fillStyle = '#d0483a';
  g.fillRect(0, 0, size, size);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  const v = g.createRadialGradient(size / 2, size * 0.42, size * 0.25, size / 2, size / 2, size * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(15,0,0,0.6)');
  g.fillStyle = v;
  g.fillRect(0, 0, size, size);
  g.globalCompositeOperation = 'screen';
  const glow = g.createRadialGradient(size / 2, size, 0, size / 2, size, size * 0.6);
  glow.addColorStop(0, 'rgba(255,90,20,0.45)');
  glow.addColorStop(1, 'rgba(255,90,20,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size, y = size * (0.35 + Math.random() * 0.65), r = 0.8 + Math.random() * 2.2;
    g.fillStyle = `rgba(255,${120 + Math.floor(Math.random() * 80)},40,${0.4 + Math.random() * 0.5})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}

/**
 * Roll a portrait for a World Bible entry (or a plain combatant): generated NPCs get a matching one,
 * anyone else steps through the whole library. Sets image, portraitId and portraitDemon on the target.
 */
export async function rollPortraitOnto(target) {
  let p;
  const race = target.gen?.race;
  if (race) {
    const demon = race.startsWith('demon_');
    p = pickPortrait({ race: demon ? race.slice(6) : race, cls: target.gen.class }, target.portraitId ? [target.portraitId] : []);
    target.portraitDemon = demon;
  } else {
    p = PORTRAITS[(PORTRAITS.findIndex((x) => x.id === target.portraitId) + 1) % PORTRAITS.length];
  }
  target.image = await renderPortrait(p, { demon: !!target.portraitDemon, flip: Math.random() < 0.5 });
  target.imageFromParty = false;
  target.portraitId = p.id;
  return target;
}

/** One call: best-matching portrait for a generated NPC's look. Returns null if the library can't load. */
export async function portraitFor(look = {}, exclude = []) {
  try {
    const p = pickPortrait(look, exclude);
    const blob = await renderPortrait(p, { demon: !!look.demon, flip: Math.random() < 0.5 });
    return { blob, id: p.id };
  } catch {
    return null;
  }
}
