// Explicitly isolated local QA adapter. It is never used by the application.
// Implements only the query surface exercised by the real roster repository.
import { playerNameKey } from "../features/squad/player-save.js";

export function createRosterFixtureClient(storage, key, seed = []) {
  if (!storage.getItem(key)) storage.setItem(key, JSON.stringify(seed));
  const rows = () => JSON.parse(storage.getItem(key));
  const persist = value => storage.setItem(key, JSON.stringify(value));
  return {
    rows,
    from(table) {
      if (table !== "club_players") throw new Error("QA adapter: unsupported table");
      let operation = "read", payload, one = false;
      const filters = [];
      const execute = () => {
        const all = rows();
        let selected = all.filter(row => filters.every(([name, value]) => row[name] === value));
        if (operation === "insert") {
          if (all.some(row => playerNameKey(row.display_name) === playerNameKey(payload.display_name))) return { data: null, error: { code: "23505", message: "duplicate normalized_name" } };
          const item = { id: crypto.randomUUID(), ...payload };
          persist([...all, item]); selected = [item];
        } else if (operation === "update") {
          if (payload.display_name && all.some(row => !selected.some(target => target.id === row.id) && playerNameKey(row.display_name) === playerNameKey(payload.display_name))) return { data: null, error: { code: "23505", message: "duplicate normalized_name" } };
          const ids = new Set(selected.map(row => row.id));
          persist(all.map(row => ids.has(row.id) ? { ...row, ...payload } : row));
          selected = rows().filter(row => ids.has(row.id));
        }
        if (one && selected.length !== 1) return { data: null, error: { code: "PGRST116", message: "Expected one row" } };
        return { data: one ? selected[0] : selected, error: null };
      };
      const query = {
        select: () => query,
        eq: (name, value) => { filters.push([name, value]); return query; },
        insert: value => { operation = "insert"; payload = value; return query; },
        update: value => { operation = "update"; payload = value; return query; },
        single: () => { one = true; return query; },
        then: (resolve, reject) => Promise.resolve().then(execute).then(resolve, reject),
      };
      return query;
    },
  };
}
