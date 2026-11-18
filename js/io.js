// Backup export/import as a single JSON file (images embedded as data URLs).
import { h } from './dom.js';
import { state, save, clearAll } from './state.js';

const blobToDataURL = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});
const dataURLToBlob = async (url) => (url ? (await fetch(url)).blob() : null);

export async function exportAll() {
  const out = { app: 'lorekeeper', version: 1, exportedAt: new Date().toISOString(), entries: [], maps: [], campaigns: [] };
  for (const e of state.entries.values()) out.entries.push({ ...e, image: e.image ? await blobToDataURL(e.image) : null });
  for (const m of state.maps.values()) out.maps.push({ ...m, image: await blobToDataURL(m.image) });
  out.campaigns = [...state.campaigns.values()];
  for (const x of state.encounters.values()) {
    const combatants = [];
    for (const c of x.combatants) combatants.push({ ...c, image: c.image ? await blobToDataURL(c.image) : null });
    (out.encounters ??= []).push({ ...x, combatants });
  }
  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `lorekeeper-backup-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function importAll(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'lorekeeper') throw new Error('That file is not a Lorekeeper backup.');
  const entries = [], maps = [];
  for (const x of data.encounters || []) {
    for (const c of x.combatants || []) c.image = typeof c.image === 'string' ? await dataURLToBlob(c.image) : null;
  }
  for (const e of data.entries || []) entries.push({ ...e, image: await dataURLToBlob(e.image) });
  for (const m of data.maps || []) maps.push({ ...m, image: await dataURLToBlob(m.image) });
  await clearAll();
  for (const e of entries) save('entries', e);
  for (const m of maps) save('maps', m);
  for (const c of data.campaigns || []) save('campaigns', c);
  for (const x of data.encounters || []) save('encounters', x);
}
