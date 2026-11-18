// A small sample world so you can try every feature straight away.
import { uid } from './dom.js';
import { save } from './state.js';

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draw a simple ink-on-parchment coastline map on a canvas. */
function drawSampleMap() {
  const W = 1600, H = 1100, r = rng(42);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const ink = '#4a3a28';

  g.fillStyle = '#a9bfba';
  g.fillRect(0, 0, W, H);

  const coastX = (y) => 560 + 70 * Math.sin(y / 110) + 35 * Math.sin(y / 41 + 1) + 12 * Math.sin(y / 13);
  const land = new Path2D();
  land.moveTo(W, 0);
  for (let y = 0; y <= H; y += 6) land.lineTo(coastX(y), y);
  land.lineTo(W, H);
  land.closePath();

  const island = new Path2D();
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2, rad = 70 + 25 * r();
    pts.push([290 + Math.cos(a) * rad * 1.3, 430 + Math.sin(a) * rad]);
  }
  pts.forEach(([x, y], i) => (i ? island.lineTo(x, y) : island.moveTo(x, y)));
  island.closePath();

  // shallow-water ripples
  g.strokeStyle = 'rgba(74,58,40,0.18)';
  g.lineWidth = 2;
  for (let i = 1; i <= 4; i++) {
    g.save(); g.translate(-i * 10, 0); g.stroke(land); g.restore();
  }
  for (const p of [land, island]) {
    g.fillStyle = '#e9dbb8'; g.fill(p);
    g.strokeStyle = ink; g.lineWidth = 3; g.stroke(p);
  }

  // forest
  for (let i = 0; i < 160; i++) {
    const x = 980 + (r() - 0.5) * 380, y = 330 + (r() - 0.5) * 260;
    if (x < coastX(y) + 40) continue;
    g.beginPath(); g.arc(x, y, 9 + r() * 5, 0, Math.PI * 2);
    g.fillStyle = '#8fa676'; g.fill(); g.strokeStyle = ink; g.lineWidth = 1.5; g.stroke();
  }
  // mountains
  for (let i = 0; i < 26; i++) {
    const x = 1150 + (r() - 0.5) * 420, y = 780 + (r() - 0.5) * 200, s = 26 + r() * 22;
    g.beginPath(); g.moveTo(x - s, y + s * 0.7); g.lineTo(x, y - s * 0.7); g.lineTo(x + s, y + s * 0.7);
    g.fillStyle = '#d8c79f'; g.fill(); g.strokeStyle = ink; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.moveTo(x, y - s * 0.7); g.lineTo(x + s * 0.3, y + s * 0.7); g.stroke();
  }
  // river
  g.beginPath(); g.moveTo(1100, 720);
  g.bezierCurveTo(980, 640, 820, 700, coastX(600) + 2, 600);
  g.strokeStyle = '#6f8fa0'; g.lineWidth = 5; g.stroke();

  // compass
  g.save(); g.translate(1460, 150); g.strokeStyle = ink; g.fillStyle = ink; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, 48, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2);
    g.beginPath(); g.moveTo(0, -60); g.lineTo(9, 0); g.lineTo(-9, 0); g.closePath(); g.fill();
  }
  g.restore();
  g.font = 'bold 22px Georgia, serif'; g.fillStyle = ink; g.textAlign = 'center';
  g.fillText('N', 1460, 70);

  // labels
  g.font = 'italic 34px Georgia, serif';
  g.fillText('The Gloamreach', 1000, 200);
  g.fillText('Ashspine Mountains', 1150, 950);
  g.font = 'italic 28px Georgia, serif';
  g.fillStyle = 'rgba(40,60,70,0.7)';
  g.fillText('The Grey Sound', 280, 760);

  // scale bar: 200 px = 20 miles
  g.fillStyle = ink; g.fillRect(80, 1030, 200, 8);
  g.font = '18px Georgia, serif'; g.textAlign = 'left';
  g.fillText('0', 76, 1022); g.fillText('20 miles', 250, 1022);
  g.strokeStyle = ink; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

export async function loadSample() {
  const E = {};
  const now = Date.now();
  let n = 0;
  const add = (key, type, title) => { E[key] = { id: uid(), type, title, overview: '', secrets: '', image: null, createdAt: now + n++ }; };
  add('saltmere', 'Settlement', 'Saltmere');
  add('gloam', 'Region', 'The Gloamreach');
  add('marrow', 'NPC', 'Captain Ilsa Marrow');
  add('carto', 'Villain', 'The Pale Cartographer');
  add('guild', 'Faction', 'The Lantern Guild');
  add('atlas', 'Artifact', 'The Unfinished Atlas');
  add('light', 'Location', 'Greyhook Lighthouse');
  add('quest', 'Quest', 'The Drowned Light');
  add('bran', 'Party Member', 'Brannoc Ashvale');
  const m = (k) => `<a class="mention" data-id="${E[k].id}" contenteditable="false">${E[k].title}</a>`;

  E.saltmere.overview = `<p>A fog-bound fishing port on the edge of ${m('gloam')}. The harbour watch answers to ${m('marrow')}, and the ${m('guild')} keeps every lamp on the seawall lit.</p>`;
  E.saltmere.secrets = `<p>Half the fishing fleet owes money to the ${m('guild')}. Nobody will admit it.</p>`;
  E.gloam.overview = '<p>An old forest where the fog never fully lifts. Paths that were there yesterday are gone today.</p>';
  E.gloam.secrets = `<p>The forest is shrinking where ${m('carto')} has been "correcting" it.</p>`;
  E.marrow.overview = `<p>Weathered, blunt and fair. Runs the Saltmere watch from a tower above the harbour. Owes ${m('bran')} a favour.</p>`;
  E.marrow.secrets = `<p>Saw the light at ${m('light')} go out from the inside and has told no one.</p>`;
  E.carto.overview = '<p>A rumour in sailors\' songs: a figure in white who walks the coast with a quill and a lantern.</p>';
  E.carto.secrets = `<h2>Goal</h2><p>Finish ${m('atlas')}. Anything not drawn in it stops existing.</p><h2>Next move</h2><p>Erase ${m('light')} so ships wreck and nobody can reach Saltmere by sea.</p>`;
  E.guild.overview = '<p>Lamplighters, signal-keepers and lantern makers. Powerful in every port town.</p>';
  E.guild.secrets = `<p>Their guildmaster is quietly working for ${m('carto')}.</p>`;
  E.atlas.overview = '<p>A huge leather atlas with blank pages that slowly fill with ink.</p>';
  E.light.overview = `<p>A lighthouse on a rocky island in the Grey Sound, kept by the ${m('guild')}. Its light went dark three nights ago.</p>`;
  E.quest.overview = `<p>Find out why ${m('light')} went dark before the herring fleet sails.</p><p>Given by ${m('marrow')}.</p>`;
  E.bran.overview = '<p>Half-orc ranger, grew up in Saltmere. Hates fog.</p>';
  E.bran.stats = { ac: 15, maxHp: 31, initBonus: 3, speed: '30 ft' };
  E.marrow.stats = { ac: 17, maxHp: 52, initBonus: 1, speed: '30 ft' };
  E.carto.stats = { ac: 15, maxHp: 99, initBonus: 2, speed: '30 ft' };
  add('drowned', 'Creature', 'Drowned Keeper');
  E.drowned.overview = '<p>A bloated lighthouse keeper, waterlogged and silent. Smells of kelp and lamp oil.</p>';
  E.drowned.stats = { ac: 8, maxHp: 22, initBonus: -2, speed: '20 ft' };
  for (const e of Object.values(E)) save('entries', e);

  const map = {
    id: uid(), name: 'The Unmapped Coast', image: await drawSampleMap(), width: 1600, height: 1100,
    milesPerPx: 0.1, parentId: null, createdAt: now,
    pins: [
      { id: uid(), x: 640, y: 590, label: 'Saltmere', icon: '🏘️', color: '#e08a3c', entryId: E.saltmere.id, submapId: null, notes: '' },
      { id: uid(), x: 300, y: 425, label: 'Greyhook Lighthouse', icon: '⚓', color: '#4189cc', entryId: E.light.id, submapId: null, notes: '' },
      { id: uid(), x: 1000, y: 330, label: 'Gloamreach', icon: '🌲', color: '#4fa86a', entryId: E.gloam.id, submapId: null, notes: '' },
      { id: uid(), x: 1240, y: 760, label: 'Cartographer\'s camp?', icon: '❓', color: '#9160cc', entryId: E.carto.id, submapId: null, notes: 'Only a rumour so far.' },
    ],
  };
  save('maps', map);

  const beat = (kind, text) => ({ id: uid(), kind, text });
  save('campaigns', {
    id: uid(), name: 'The Unmapped Coast', createdAt: now,
    arcs: [
      {
        id: uid(), name: 'Act I: Fog over Saltmere', sessions: [
          {
            id: uid(), title: 'Session 1: The Dark Lamp', status: 'played', date: '', notes: `<p>The party arrived in ${m('saltmere')} and met ${m('marrow')}.</p>`,
            beats: [beat('beat', 'Arrive in Saltmere in the fog'), beat('encounter', 'Smugglers on the docks'), beat('cliffhanger', 'The lighthouse goes dark mid-fight')],
          },
          {
            id: uid(), title: 'Session 2: Crossing the Sound', status: 'current', date: '', notes: `<p>Rowing out to ${m('light')}. Read-aloud: <em>the sea is too calm…</em></p>`,
            beats: [beat('beat', 'Hire a boat from a nervous fisher'), beat('beat', 'Fog-bank: navigation challenge'), beat('encounter', 'Drowned keepers inside the lighthouse'), beat('cliffhanger', 'A page of the Atlas, still wet with ink')],
          },
          {
            id: uid(), title: 'Session 3: The Lantern Guild', status: 'upcoming', date: '', notes: '',
            beats: [beat('beat', 'Report back to Marrow'), beat('encounter', 'Guild enforcers'), beat('cliffhanger', 'The guildmaster mentions the Cartographer by name')],
          },
        ],
      },
      { id: uid(), name: 'Act II: Into the Gloamreach', sessions: [] },
    ],
  });
}
