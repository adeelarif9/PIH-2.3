// ── LOCAL DASHBOARD STORAGE ──
// IndexedDB keeps uploaded health data local to this browser/profile and supports
// much larger datasets than sessionStorage.

const DASHBOARD_DB_NAME = 'pih_nutrition_dashboard';
const DASHBOARD_DB_VERSION = 1;
const DASHBOARD_STORE = 'datasets';
const DASHBOARD_CURRENT_KEY = 'current';
const DASHBOARD_SESSION_KEY = 'pih_nutrition_data';

function hasIndexedDB() {
  return typeof indexedDB !== 'undefined';
}

function openDashboardDB() {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB non disponible dans ce navigateur.'));
      return;
    }

    const req = indexedDB.open(DASHBOARD_DB_NAME, DASHBOARD_DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DASHBOARD_STORE)) {
        db.createObjectStore(DASHBOARD_STORE, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Impossible d\'ouvrir IndexedDB.'));
  });
}

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erreur IndexedDB.'));
  });
}

async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return null;
  try {
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

async function getStorageEstimate() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try {
    return await navigator.storage.estimate();
  } catch {
    return null;
  }
}

async function saveDashboardData(data) {
  if (!hasIndexedDB()) {
    sessionStorage.setItem(DASHBOARD_SESSION_KEY, JSON.stringify(data));
    return { storage: 'sessionStorage', estimateBefore: null, estimateAfter: null };
  }

  await requestPersistentStorage();
  const estimateBefore = await getStorageEstimate();
  const db = await openDashboardDB();

  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DASHBOARD_STORE, 'readwrite');
      const store = tx.objectStore(DASHBOARD_STORE);
      store.put({
        id: DASHBOARD_CURRENT_KEY,
        data,
        savedAt: new Date().toISOString(),
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Impossible de sauvegarder les données localement.'));
      tx.onabort = () => reject(tx.error || new Error('Sauvegarde locale interrompue.'));
    });
  } finally {
    db.close();
  }

  // Avoid keeping a duplicate large JSON copy in sessionStorage.
  try { sessionStorage.removeItem(DASHBOARD_SESSION_KEY); } catch {}

  const estimateAfter = await getStorageEstimate();
  return { storage: 'indexedDB', estimateBefore, estimateAfter };
}

async function loadDashboardData() {
  if (hasIndexedDB()) {
    try {
      const db = await openDashboardDB();
      try {
        const tx = db.transaction(DASHBOARD_STORE, 'readonly');
        const record = await idbRequest(tx.objectStore(DASHBOARD_STORE).get(DASHBOARD_CURRENT_KEY));
        if (record && record.data) return record.data;
      } finally {
        db.close();
      }
    } catch (err) {
      console.warn('IndexedDB load failed; trying sessionStorage fallback.', err);
    }
  }

  try {
    const raw = sessionStorage.getItem(DASHBOARD_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function clearDashboardData() {
  if (hasIndexedDB()) {
    const db = await openDashboardDB();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DASHBOARD_STORE, 'readwrite');
        tx.objectStore(DASHBOARD_STORE).delete(DASHBOARD_CURRENT_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Impossible d\'effacer les données locales.'));
        tx.onabort = () => reject(tx.error || new Error('Effacement local interrompu.'));
      });
    } finally {
      db.close();
    }
  }

  try { sessionStorage.removeItem(DASHBOARD_SESSION_KEY); } catch {}
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}
