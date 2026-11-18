// In-memory cache of all data, mirrored to IndexedDB, with change notifications.
import { db, STORES } from './db.js';
import { toast } from './dom.js';

export const state = {
  entries: new Map(),
  maps: new Map(),
  campaigns: new Map(),
  encounters: new Map(),
  playerView: false,
};

const listeners = new Set();
/** Subscribe to changes: fn(kind, id). Returns an unsubscribe function. */
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = (kind, id) => { for (const fn of [...listeners]) fn(kind, id); };

export async function load() {
  for (const kind of STORES) {
    for (const v of await db.all(kind)) state[kind].set(v.id, v);
  }
  try { state.playerView = localStorage.getItem('lk.playerView') === '1'; } catch { /* storage blocked */ }
}

export function save(kind, obj) {
  obj.updatedAt = Date.now();
  state[kind].set(obj.id, obj);
  db.put(kind, obj).catch((e) => toast('Save failed: ' + e.message, 'error'));
  emit(kind, obj.id);
}

export function remove(kind, id) {
  state[kind].delete(id);
  db.del(kind, id).catch((e) => toast('Delete failed: ' + e.message, 'error'));
  emit(kind, id);
}

export async function clearAll() {
  for (const kind of STORES) {
    state[kind].clear();
    await db.clear(kind);
  }
  emit('all', null);
}

export const hasData = () => state.entries.size + state.maps.size + state.campaigns.size > 0;

export function setPlayerView(on) {
  state.playerView = on;
  try { localStorage.setItem('lk.playerView', on ? '1' : '0'); } catch { /* storage blocked */ }
  document.body.classList.toggle('player-view', on);
  emit('playerView', null);
}
