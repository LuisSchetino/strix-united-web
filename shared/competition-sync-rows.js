const placeholder = (row) => Boolean(row?.metadata?.placeholder)
  || /^vencedor\b/i.test(String(row?.home_team_name || ""))
  || /^vencedor\b/i.test(String(row?.away_team_name || ""));

const populated = (value) => value !== null && value !== undefined && value !== "";

const completeness = (row) => [
  row?.home_team_id,
  row?.away_team_id,
  row?.home_score,
  row?.away_score,
  row?.scheduled_at,
  row?.metadata?.homeLogo,
  row?.metadata?.awayLogo,
].filter(populated).length
  + (row?.status === "completed" ? 8 : 0)
  + (placeholder(row) ? -16 : 0);

export function mergeCompetitionRow(current, incoming) {
  if (!current) return incoming;
  const preferred = completeness(incoming) >= completeness(current) ? incoming : current;
  const fallback = preferred === incoming ? current : incoming;
  const merged = {
    ...fallback,
    ...Object.fromEntries(Object.entries(preferred).filter(([, value]) => populated(value))),
  };
  const metadata = { ...(fallback.metadata || {}), ...(preferred.metadata || {}) };
  if (Object.keys(metadata).length || placeholder(current) || placeholder(incoming)) {
    merged.metadata = { ...metadata, placeholder: placeholder(preferred) };
  }
  return merged;
}

export function dedupeCompetitionRows(rows, keyFor) {
  const unique = new Map();
  const collisions = [];
  for (const row of rows || []) {
    const key = keyFor(row);
    if (!key) continue;
    const current = unique.get(key);
    if (current) collisions.push({ key, current, incoming: row });
    unique.set(key, mergeCompetitionRow(current, row));
  }
  return { rows: [...unique.values()], collisions };
}

export const fixtureConflictKey = (row) => row?.bracket_slot_key
  ? `${row.edition_id}|bracket|${row.bracket_slot_key}`
  : `${row?.edition_id}|fixture|${row?.external_match_id}`;

export const teamConflictKey = (row, normalizeName) => `${row?.edition_id}|${normalizeName(row?.name || "")}`;
