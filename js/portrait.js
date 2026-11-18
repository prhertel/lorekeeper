// Draws a stylised portrait (SVG) from a generated NPC's appearance, so every NPC gets a matching picture.
// Works offline and costs nothing: the result is stored as the entry's image.

const SKIN = {
  pale: '#f1d6c4', fair: '#ecc5a6', olive: '#c9a27a', tan: '#c68e5f', golden: '#d6a56b', 'light brown': '#b07a4f', brown: '#8d5a36',
  'dark brown': '#5f3a22', ebony: '#3d2618', ruddy: '#d99a7e', alabaster: '#f6e8dc', copper: '#b8743f', bronze: '#a8763e', dusky: '#7d5a4a',
  'weathered brown': '#8a5d3b', 'deep brown': '#4f2f1c', 'nut-brown': '#946238', 'grey-green': '#7d8f73', 'olive-green': '#7a8a4f',
  'ash-grey': '#8b8b88', 'mottled green': '#6f8a5b', crimson: '#a8323a', 'deep red': '#8a2630', violet: '#7c5aa0', 'dusky blue': '#56648c',
  'human-toned': '#c9a27a', 'blood-red': '#8f2020', 'charcoal-black': '#35302f', 'bruise-purple': '#5b3a5e', 'sickly green': '#7f9157',
  obsidian: '#262229', 'scorched bronze': '#8a5a2b',
};
const SCALES = { bronze: '#9a6b35', brass: '#b8963e', copper: '#b06a3a', gold: '#d4a53a', silver: '#b9bec6', red: '#a83228', blue: '#3a5fa8',
  green: '#3f8a4a', black: '#2a2a2e', white: '#e6e6ea', obsidian: '#1f1c22', 'charred black': '#2b2422', 'blood-red': '#7e1a1a', 'ash-grey': '#77777a' };
const HAIR = { black: '#1d1a18', 'dark brown': '#3b2a1e', brown: '#5c4030', chestnut: '#6e3b22', auburn: '#8a3a1f', red: '#a3381c', copper: '#b4632a',
  blond: '#d9b968', sandy: '#c9a86a', grey: '#8e8e8e', white: '#e9e6df', silver: '#c9ccd1', golden: '#d8b04a', 'raven-black': '#121014',
  'pale blond': '#e8d9a0', 'iron-grey': '#6b6e72', orange: '#d8742a', 'bright pink': '#e26aa8', 'blue-black': '#1b2233', 'dark red': '#5e1a1a', violet: '#6a3c8f' };
const EYES = { brown: '#6a4426', 'dark brown': '#3a2414', blue: '#3f74b8', green: '#3f8a4f', grey: '#7c8794', hazel: '#8a6a33', amber: '#c08a2a',
  violet: '#7a4fb0', silver: '#c9ccd1', emerald: '#1f9a5a', gold: '#d4a72c', sapphire: '#2a4fa8', 'bright blue': '#4aa3ff', 'glittering black': '#151515',
  red: '#b02a2a', yellow: '#d4c02a', black: '#151515', dark: '#2a1a10', 'solid red': '#c01e1e', 'solid black': '#0c0c0c', white: '#f2f2f2',
  'slit-pupilled yellow': '#e0c030', 'burning ember': '#ff6a1a', 'sulfur-yellow': '#e5d33a', 'slit-pupilled crimson': '#e01c1c',
  'pale, glowing white': '#f4f4ff', 'molten gold': '#ffb52e' };
const CLOTH = { commoner: ['#6b5a45', '#56614a', '#7a4a3a', '#4f5a6b', '#8a7a5a'], fighter: ['#6b7280'], rogue: ['#2c3138'], wizard: ['#33427a'],
  cleric: ['#d8d2c0'], ranger: ['#3f5f3a'], paladin: ['#b8bcc6'], barbarian: ['#7a5a3a'], bard: ['#9a2f4a'], warlock: ['#4a2d5a'],
  sorcerer: ['#7a2d2d'], monk: ['#b8692a'], druid: ['#56603a'] };

const pick = (a) => a[Math.floor(Math.random() * a.length)];
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${200 - x} ${y}`);

/** @returns {string} SVG markup */
export function makePortrait(look = {}) {
  const demon = !!look.demon;
  const race = look.race || 'human';
  const scaly = race === 'dragonborn';
  const skin = scaly ? (SCALES[look.scales] || '#9a6b35') : (SKIN[look.skin] || '#c9a27a');
  const skinDark = shade(skin, -0.25);
  const hair = HAIR[look.hairColor] || '#3b2a1e';
  const eye = EYES[look.eyes] || '#5a3a22';
  const glowEyes = demon || /glowing|ember|molten/.test(look.eyes || '');
  const solidEyes = glowEyes || /^solid|^white$/.test(look.eyes || '');
  const cloth = pick(CLOTH[look.cls] || CLOTH.commoner);
  const long = ['long', 'very long', 'waist-length', 'shoulder-length'].includes(look.hairLen);
  const bald = look.hairLen === 'bald' || scaly;
  const small = race === 'halfling' || race === 'gnome' || race === 'dwarf';
  const face = { round: [37, 40], angular: [32, 42], oblong: [31, 45], 'heart-shaped': [35, 41], square: [35, 40], narrow: [29, 44] }[look.face] || [34, 42];
  const [rx, ry] = face;
  const cy = 92;
  const out = [];

  out.push(`<defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${demon ? '#5c1717' : '#39404f'}"/><stop offset="1" stop-color="${demon ? '#160606' : '#171a21'}"/></radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`);
  out.push('<rect width="200" height="200" fill="url(#bg)"/>');
  if (demon) {
    for (let i = 0; i < 14; i++) out.push(`<circle cx="${10 + Math.random() * 180}" cy="${10 + Math.random() * 190}" r="${0.8 + Math.random() * 1.8}" fill="#ff7a2a" opacity="${0.3 + Math.random() * 0.5}"/>`);
    if (/wings/.test(look.extra || '')) {
      const wing = 'M70 150 Q20 110 14 60 Q36 84 46 80 Q40 104 58 108 Q50 124 76 132 Z';
      out.push(`<path d="${wing}" fill="#2a1414" stroke="#120808" stroke-width="2"/><path d="${mirror(wing)}" fill="#2a1414" stroke="#120808" stroke-width="2"/>`);
    }
  }

  // Hood behind the head (rogues, rangers, some warlocks)
  if ((look.cls === 'rogue' || look.cls === 'ranger' || (look.cls === 'warlock' && Math.random() < 0.5)) && !scaly) {
    out.push(`<path d="M52 150 Q46 60 100 42 Q154 60 148 150 Z" fill="${shade(cloth, -0.2)}"/>`);
  }
  // Long hair behind
  if (long && !bald) {
    const len = look.hairLen === 'shoulder-length' ? 150 : 178;
    out.push(`<path d="M${100 - rx - 5} ${cy - 6} Q${100 - rx - 12} ${len - 30} ${100 - rx + 4} ${len} L${100 + rx - 4} ${len} Q${100 + rx + 12} ${len - 30} ${100 + rx + 5} ${cy - 6} Z" fill="${shade(hair, -0.15)}"/>`);
  }

  // Body & clothes
  const shoulders = small ? 'M40 200 C44 166 70 152 100 152 C130 152 156 166 160 200 Z' : 'M24 200 C30 160 62 146 100 146 C138 146 170 160 176 200 Z';
  out.push(`<rect x="88" y="${cy + 26}" width="24" height="36" rx="8" fill="${skinDark}"/>`);
  out.push(`<path d="${shoulders}" fill="${cloth}"/>`);
  if (['wizard', 'sorcerer', 'warlock', 'cleric', 'druid', 'monk'].includes(look.cls)) {
    out.push(`<path d="M84 150 L100 178 L116 150" fill="none" stroke="${shade(cloth, -0.35)}" stroke-width="3"/>`);
    if (look.cls === 'cleric') out.push('<path d="M100 166 v14 M93 172 h14" stroke="#d4a53a" stroke-width="3"/>');
  }
  if (['fighter', 'paladin'].includes(look.cls)) {
    out.push(`<ellipse cx="46" cy="170" rx="26" ry="16" fill="${shade(cloth, 0.15)}" stroke="${shade(cloth, -0.4)}" stroke-width="2"/><ellipse cx="154" cy="170" rx="26" ry="16" fill="${shade(cloth, 0.15)}" stroke="${shade(cloth, -0.4)}" stroke-width="2"/>`);
  }
  if (look.cls === 'barbarian') out.push('<path d="M40 166 Q60 146 100 150 Q140 146 160 166 Q140 160 100 162 Q60 160 40 166 Z" fill="#a08060"/>');
  if (look.cls === 'bard') out.push('<path d="M92 150 L100 160 L108 150 Z" fill="#e8d8b0"/>');

  // Ears
  if (race === 'elf' || race === 'halfelf') {
    const ear = race === 'elf' ? `M${100 - rx + 3} ${cy - 2} L${100 - rx - 20} ${cy - 22} L${100 - rx + 4} ${cy + 12} Z` : `M${100 - rx + 3} ${cy - 2} L${100 - rx - 10} ${cy - 12} L${100 - rx + 4} ${cy + 12} Z`;
    out.push(`<path d="${ear}" fill="${skin}"/><path d="${mirror(ear)}" fill="${skin}"/>`);
  } else if (!scaly) {
    out.push(`<ellipse cx="${100 - rx + 1}" cy="${cy + 2}" rx="6" ry="9" fill="${skinDark}"/><ellipse cx="${100 + rx - 1}" cy="${cy + 2}" rx="6" ry="9" fill="${skinDark}"/>`);
  }

  // Head
  if (scaly) {
    out.push(`<path d="M78 52 L70 30 L86 48 Z M122 52 L130 30 L114 48 Z" fill="${shade(skin, -0.4)}"/>`);
    out.push(`<ellipse cx="100" cy="${cy - 4}" rx="30" ry="36" fill="${skin}"/>`);
    out.push(`<ellipse cx="100" cy="${cy + 22}" rx="23" ry="19" fill="${shade(skin, 0.08)}"/>`);
    out.push(`<path d="M86 ${cy - 30} Q100 ${cy - 40} 114 ${cy - 30}" stroke="${shade(skin, -0.3)}" stroke-width="3" fill="none"/>`);
    out.push(`<circle cx="93" cy="${cy + 18}" r="1.8" fill="#111"/><circle cx="107" cy="${cy + 18}" r="1.8" fill="#111"/>`);
    out.push(`<path d="M82 ${cy + 30} Q100 ${cy + 38} 118 ${cy + 30}" stroke="${shade(skin, -0.45)}" stroke-width="2" fill="none"/>`);
  } else if (look.face === 'square') {
    out.push(`<rect x="${100 - rx}" y="${cy - ry}" width="${rx * 2}" height="${ry * 2}" rx="${rx * 0.6}" fill="${skin}"/>`);
  } else {
    out.push(`<ellipse cx="100" cy="${cy}" rx="${rx}" ry="${ry}" fill="${skin}"/>`);
  }

  // Hair on top
  if (!bald) {
    const top = cy - ry;
    out.push(`<path d="M${100 - rx - 2} ${cy - 2} Q${100 - rx} ${top - 4} 100 ${top - 6} Q${100 + rx} ${top - 4} ${100 + rx + 2} ${cy - 2} Q${100 + rx - 6} ${top + 20} 100 ${top + 16} Q${100 - rx + 10} ${top + 22} ${100 - rx - 2} ${cy - 2} Z" fill="${hair}"/>`);
    if (long) out.push(`<path d="M${100 - rx - 3} ${cy - 4} Q${100 - rx - 6} ${cy + 30} ${100 - rx + 2} ${cy + 52} L${100 - rx + 9} ${cy + 46} Q${100 - rx + 2} ${cy + 20} ${100 - rx + 6} ${cy - 4} Z" fill="${hair}"/><path d="M${100 + rx + 3} ${cy - 4} Q${100 + rx + 6} ${cy + 30} ${100 + rx - 2} ${cy + 52} L${100 + rx - 9} ${cy + 46} Q${100 + rx - 2} ${cy + 20} ${100 + rx - 6} ${cy - 4} Z" fill="${hair}"/>`);
  }

  // Horns
  if (look.horns) {
    const hc = look.horns === 'demon' ? '#1c1517' : '#4a3434';
    const horn = look.horns === 'demon' && Math.random() < 0.5
      ? `M${100 - rx + 10} ${cy - ry + 14} Q${100 - rx - 18} ${cy - ry - 10} ${100 - rx - 8} ${cy - ry - 40} Q${100 - rx + 2} ${cy - ry - 8} ${100 - rx + 22} ${cy - ry + 8} Z`
      : `M${100 - rx + 12} ${cy - ry + 12} Q${100 - rx - 22} ${cy - ry - 6} ${100 - rx - 12} ${cy - ry + 30} Q${100 - rx - 8} ${cy - ry + 6} ${100 - rx + 22} ${cy - ry + 6} Z`;
    out.push(`<path d="${horn}" fill="${hc}" stroke="${shade(hc, 0.3)}" stroke-width="1.5"/><path d="${mirror(horn)}" fill="${hc}" stroke="${shade(hc, 0.3)}" stroke-width="1.5"/>`);
  }

  // Eyes & brows
  if (!scaly || true) {
    const ey = scaly ? cy - 8 : cy - 2;
    for (const ex of [scaly ? 88 : 86, scaly ? 112 : 114]) {
      if (solidEyes) out.push(`<ellipse cx="${ex}" cy="${ey}" rx="6.5" ry="${scaly ? 4 : 4.2}" fill="${eye}" ${glowEyes ? 'filter="url(#glow)"' : ''}/>`);
      else out.push(`<ellipse cx="${ex}" cy="${ey}" rx="6.5" ry="4.2" fill="#f4efe6"/><circle cx="${ex}" cy="${ey}" r="3.3" fill="${eye}"/><circle cx="${ex}" cy="${ey}" r="1.4" fill="#111"/>`);
      if (/slit/.test(look.eyes || '')) out.push(`<rect x="${ex - 0.8}" y="${ey - 3.5}" width="1.6" height="7" fill="#111"/>`);
    }
    if (!scaly) {
      const browC = bald ? shade(skin, -0.45) : shade(hair, -0.1);
      const slant = demon ? 4 : 0;
      out.push(`<path d="M78 ${ey - 9 - slant} L94 ${ey - 9 + slant}" stroke="${browC}" stroke-width="3.2" stroke-linecap="round"/><path d="M122 ${ey - 9 - slant} L106 ${ey - 9 + slant}" stroke="${browC}" stroke-width="3.2" stroke-linecap="round"/>`);
    }
  }

  // Nose, mouth, tusks
  if (!scaly) {
    out.push(`<path d="M100 ${cy + 2} Q96 ${cy + 14} 99 ${cy + 16} Q102 ${cy + 17} 105 ${cy + 15}" stroke="${shade(skin, -0.3)}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    const smile = demon ? -3 : Math.random() < 0.5 ? 3 : 1;
    out.push(`<path d="M90 ${cy + 27} Q100 ${cy + 27 + smile} 110 ${cy + 27}" stroke="${shade(skin, -0.5)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
    if (race === 'halforc') out.push(`<path d="M91 ${cy + 28} l2 -8 l3 8 Z M109 ${cy + 28} l-2 -8 l-3 8 Z" fill="#f2ead8"/>`);
  }

  // Beard
  if (look.beard && !scaly) {
    const len = race === 'dwarf' ? 62 : 40;
    out.push(`<path d="M${100 - rx + 2} ${cy + 4} Q${100 - rx + 4} ${cy + len} 100 ${cy + len + 8} Q${100 + rx - 4} ${cy + len} ${100 + rx - 2} ${cy + 4} Q${100 + rx - 10} ${cy + 34} 100 ${cy + 33} Q${100 - rx + 10} ${cy + 34} ${100 - rx + 2} ${cy + 4} Z" fill="${hair}"/>`);
    out.push(`<path d="M90 ${cy + 27} Q100 ${cy + 30} 110 ${cy + 27}" stroke="${shade(hair, -0.4)}" stroke-width="2.4" fill="none"/>`);
  }

  // Marks & corruption
  const mark = look.mark || '';
  if (/scar/.test(mark)) out.push(`<path d="M${100 + rx - 18} ${cy - 12} L${100 + rx - 8} ${cy + 16}" stroke="${shade(skin, -0.35)}" stroke-width="2.5"/>`);
  if (/piercing|nose ring/.test(mark)) out.push(`<circle cx="${/nose/.test(mark) ? 103 : 76}" cy="${/nose/.test(mark) ? cy + 16 : cy - 13}" r="2" fill="#d8d8d8"/>`);
  if (/tattoo/.test(mark)) out.push(`<path d="M92 ${cy + 40} q6 6 0 12 q-6 6 0 12" stroke="#2a3a5a" stroke-width="2.5" fill="none"/>`);
  if (demon) {
    out.push(`<path d="M${100 - rx + 6} ${cy + 6} l8 6 l-3 7 l8 6 M${100 + rx - 6} ${cy + 6} l-8 6 l3 7 l-8 6" stroke="#ff6a1a" stroke-width="1.4" fill="none" opacity="0.75" filter="url(#glow)"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${out.join('')}</svg>`;
}

export function portraitBlob(look) {
  return new Blob([makePortrait(look)], { type: 'image/svg+xml' });
}
