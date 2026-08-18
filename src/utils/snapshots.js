// Snapshot persistence — save/load whole sessions to localStorage.
//
// A snapshot captures everything you'd want to recall: the chord progression,
// all sequencer patterns, the mixer/voices/FX state, and the key + scale.
// It does NOT capture transient UI bits (selected chord, current playback
// step, drag-state) or the open/closed state of collapsible panels.
//
// Storage shape (single key, JSON-encoded):
//   {
//     version: 1,
//     items: [
//       { id, name, createdAt, data: { ...full state... } },
//       ...
//     ]
//   }
//
// Versioning lets us migrate forward later without breaking old saves.

const STORAGE_KEY    = "harmonic-workbench:snapshots";
const AUTOSAVE_KEY   = "harmonic-workbench:autosave";
const SCHEMA_VERSION = 1;

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: SCHEMA_VERSION, items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.items)) {
      return { version: SCHEMA_VERSION, items: [] };
    }
    return parsed;
  } catch {
    // If localStorage is unavailable (private browsing, quota, parse error)
    // we degrade silently — snapshots just won't persist that session.
    return { version: SCHEMA_VERSION, items: [] };
  }
}

function writeAll(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

// Public API ---------------------------------------------------------------

export function listSnapshots() {
  const { items } = readAll();
  // Newest first.
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

export function saveSnapshot(name, data) {
  const store = readAll();
  const snap = {
    id: "snap_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    name: (name || "Untitled").trim() || "Untitled",
    createdAt: Date.now(),
    data,
  };
  store.items.push(snap);
  writeAll(store);
  return snap;
}

export function deleteSnapshot(id) {
  const store = readAll();
  store.items = store.items.filter(s => s.id !== id);
  writeAll(store);
}

export function renameSnapshot(id, name) {
  const store = readAll();
  const s = store.items.find(s => s.id === id);
  if (s) {
    s.name = (name || "Untitled").trim() || "Untitled";
    writeAll(store);
  }
}

export function getSnapshot(id) {
  return readAll().items.find(s => s.id === id) || null;
}

// ---- JSON import / export ------------------------------------------------
// Treats a snapshot as a portable file. Useful for sharing ideas between
// machines, backing up, or keeping a session alongside the project files.

// Trigger a browser download of one snapshot as a JSON file.
export function exportSnapshotToFile(snap) {
  if (!snap) return;
  // Wrap in an envelope so future-us can spot the format and version.
  const envelope = {
    type:    "harmonic-workbench-snapshot",
    version: SCHEMA_VERSION,
    name:    snap.name,
    createdAt: snap.createdAt,
    data:    snap.data,
  };
  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  // Sanitise the name into something filename-safe.
  const safe = (snap.name || "snapshot").replace(/[^\w\-]+/g, "_").slice(0, 60);
  a.download = `harmonic_${safe}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Read a JSON file the user picked from disk and turn it back into a snapshot.
// Resolves with the new snapshot object; rejects on parse / shape errors.
export function importSnapshotFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read file"));
    reader.onload = () => {
      try {
        const env = JSON.parse(reader.result);
        // Be permissive: accept either the new envelope format or the bare
        // snapshot data (so the user can paste any state object back in).
        const data = env?.data ?? env;
        const name = env?.name || file.name.replace(/\.json$/i, "") || "Imported";
        if (!data || typeof data !== "object") {
          reject(new Error("File doesn't look like a snapshot"));
          return;
        }
        const saved = saveSnapshot(name, data);
        resolve(saved);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
}

// ---- Autosave ------------------------------------------------------------
// A single "current session" slot, separate from the named snapshots list.
// App writes here on a debounce; reads on mount to restore last session.

export function readAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch {
    return null;
  }
}

export function writeAutosave(data) {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ version: SCHEMA_VERSION, data, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function clearAutosave() {
  try { localStorage.removeItem(AUTOSAVE_KEY); } catch { /* ignore */ }
}
