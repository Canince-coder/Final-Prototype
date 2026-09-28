/**
 * Tiny localStorage-backed collection for frontend-only DEMO data.
 * Swap a collection for real API calls later; the method names mirror CRUD.
 */
const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode): changes last for this page only */
  }
};

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

export function collection(key, seed) {
  const all = () => read(key, null) ?? seed();
  return {
    list: () => all(),
    get: (id) => all().find((x) => x.id === id),
    create(item) {
      const row = { ...item, id: newId(), created_at: new Date().toISOString() };
      write(key, [row, ...all()]);
      return row;
    },
    update(id, changes) {
      const rows = all().map((x) => (x.id === id ? { ...x, ...changes } : x));
      write(key, rows);
      return rows.find((x) => x.id === id);
    },
    remove(id) {
      write(key, all().filter((x) => x.id !== id));
    },
    reset() {
      localStorage.removeItem(key);
    },
  };
}

export const localValue = { read, write };
