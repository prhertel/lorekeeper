// Minimal IndexedDB wrapper. Everything is stored locally in the browser.

const DB_NAME = 'lorekeeper';
const VERSION = 2;
export const STORES = ['entries', 'maps', 'campaigns', 'encounters'];

let dbPromise = null;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export const db = {
  all: (store) => tx(store, 'readonly', (st) => st.getAll()),
  put: (store, value) => tx(store, 'readwrite', (st) => { st.put(value); }),
  del: (store, id) => tx(store, 'readwrite', (st) => { st.delete(id); }),
  clear: (store) => tx(store, 'readwrite', (st) => { st.clear(); }),
};
