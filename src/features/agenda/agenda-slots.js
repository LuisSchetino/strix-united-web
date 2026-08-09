const normalizeDay = (value) => {
  const raw = String(value || "").trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(date);
};

const clockOf = (entry) => {
  if (entry?.time) {
    const parts = String(entry.time).match(/\d+/g) || [];
    return `${String(Number(parts[0] || 0)).padStart(2, "0")}:${String(Number(parts[1] || 0)).padStart(2, "0")}`;
  }
  if (!entry?.scheduled_at) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(new Date(entry.scheduled_at));
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;
  return hour && minute ? `${hour}:${minute}` : "";
};

const dayOf = (entry) =>
  normalizeDay(entry?.date || entry?.scheduled_at || entry?.scheduledAt);

export function nextAgendaSlot(entries, selectedDay, start = "21:10") {
  const day = normalizeDay(selectedDay);
  const occupied = new Set(
    (entries || [])
      .filter((entry) => dayOf(entry) === day && entry?.status !== "cancelled")
      .map(clockOf)
      .filter(Boolean),
  );
  const [startHour, startMinute] = start.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  for (let index = 0; index < 48; index += 1) {
    const total = (startTotal + index * 30) % (24 * 60);
    const slot = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    if (!occupied.has(slot)) return slot;
  }
  return start;
}

export { normalizeDay as normalizeAgendaDay };
