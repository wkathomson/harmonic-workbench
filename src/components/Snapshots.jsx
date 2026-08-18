import { useRef, useState } from "react";
import { Save, Trash2, Download, Upload, Pencil, Check, X, FileDown } from "lucide-react";
import {
  listSnapshots, saveSnapshot, deleteSnapshot, renameSnapshot,
  exportSnapshotToFile, importSnapshotFromFile,
} from "../utils/snapshots.js";

// Snapshots panel — save and recall whole sessions.
//
// All persistence is in localStorage; we don't bother with a server. The
// component re-reads the list after every mutation so it always reflects
// what's actually in storage (cheap — there'll only ever be a few dozen).
export default function Snapshots({ getCurrentState, applyState }) {
  const [snaps, setSnaps] = useState(() => listSnapshots());
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const fileInputRef = useRef(null);

  const refresh = () => setSnaps(listSnapshots());

  const onSave = () => {
    const data = getCurrentState();
    saveSnapshot(name || `Idea ${snaps.length + 1}`, data);
    setName("");
    refresh();
  };

  const onLoad = (snap) => {
    if (!snap?.data) return;
    applyState(snap.data);
  };

  const onDelete = (id) => {
    if (!confirm("Delete this snapshot?")) return;
    deleteSnapshot(id);
    refresh();
  };

  const beginRename = (snap) => {
    setEditingId(snap.id);
    setEditingName(snap.name);
  };
  const commitRename = () => {
    if (editingId) {
      renameSnapshot(editingId, editingName);
      refresh();
    }
    setEditingId(null);
  };
  const cancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  const onExport = (snap) => exportSnapshotToFile(snap);

  const onPickImport = () => fileInputRef.current?.click();
  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be re-imported
    if (!file) return;
    try {
      await importSnapshotFromFile(file);
      refresh();
    } catch (err) {
      alert("Couldn't import snapshot: " + (err?.message || "unknown error"));
    }
  };

  return (
    <div className="hw-snap">
      <div className="hw-snap-save">
        <input
          type="text"
          className="hw-snap-input"
          placeholder="Name this idea…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSave(); }}
        />
        <button className="hw-btn pri" onClick={onSave} title="Save snapshot">
          <Save size={11} /> Save
        </button>
        <button className="hw-btn" onClick={onPickImport} title="Import a snapshot from a JSON file">
          <Upload size={11} /> Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={onImportFile}
        />
      </div>

      {snaps.length === 0 ? (
        <div className="hw-snap-empty">
          No snapshots yet. Save one to recall this session later.
        </div>
      ) : (
        <ul className="hw-snap-list">
          {snaps.map(s => (
            <li key={s.id} className="hw-snap-item">
              {editingId === s.id ? (
                <>
                  <input
                    type="text"
                    className="hw-snap-input"
                    value={editingName}
                    autoFocus
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") cancelRename();
                    }}
                  />
                  <button className="hw-snap-act" onClick={commitRename} title="Save name">
                    <Check size={11} />
                  </button>
                  <button className="hw-snap-act" onClick={cancelRename} title="Cancel">
                    <X size={11} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="hw-snap-name"
                    onClick={() => onLoad(s)}
                    title="Click to load"
                  >
                    <span className="hw-snap-nm">{s.name}</span>
                    <span className="hw-snap-dt">{formatDate(s.createdAt)}</span>
                  </button>
                  <button className="hw-snap-act" onClick={() => onLoad(s)} title="Load">
                    <Download size={11} />
                  </button>
                  <button className="hw-snap-act" onClick={() => onExport(s)} title="Export to JSON file">
                    <FileDown size={11} />
                  </button>
                  <button className="hw-snap-act" onClick={() => beginRename(s)} title="Rename">
                    <Pencil size={11} />
                  </button>
                  <button className="hw-snap-act danger" onClick={() => onDelete(s.id)} title="Delete">
                    <Trash2 size={11} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Compact relative-ish date format. Same day → "14:32". Otherwise "12 May".
function formatDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}
