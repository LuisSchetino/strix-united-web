const ZONE = "America/Sao_Paulo";

export const saoPauloDay = (value) => new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(value));

export function classifyAgendaMatch(match, now = new Date()) {
  if (["completed", "cancelled"].includes(match?.status)) return match.status;
  const kickoff = new Date(match?.scheduled_at);
  if (Number.isNaN(kickoff.getTime())) return "upcoming";
  if (kickoff.getTime() < now.getTime()) return "overdue";
  return saoPauloDay(kickoff) === saoPauloDay(now) ? "today" : "upcoming";
}

export function activeAgendaMatches(matches = [], now = new Date()) {
  return (Array.isArray(matches) ? matches : [])
    .filter((match) => !["completed", "cancelled"].includes(match?.status))
    .map((match) => ({ ...match, temporal_status: classifyAgendaMatch(match, now) }))
    .sort((left, right) => new Date(left.scheduled_at) - new Date(right.scheduled_at));
}

export function nextAgendaMatches(matches = [], now = new Date()) {
  return activeAgendaMatches(matches, now).filter((match) => match.temporal_status !== "overdue");
}

export function todayAgendaMatches(matches = [], now = new Date()) {
  const today = saoPauloDay(now);
  return activeAgendaMatches(matches, now).filter(
    (match) => saoPauloDay(match.scheduled_at) === today,
  );
}

export function agendaHeroSelection(matches = [], now = new Date()) {
  const today = todayAgendaMatches(matches, now);
  const nextToday = today.find((match) => new Date(match.scheduled_at).getTime() >= now.getTime());
  if (nextToday) return { match: nextToday, isToday: true };
  if (today.length) {
    const closest = [...today].sort((left, right) => (
      Math.abs(new Date(left.scheduled_at).getTime() - now.getTime())
      - Math.abs(new Date(right.scheduled_at).getTime() - now.getTime())
    ))[0];
    return { match: closest, isToday: true };
  }
  return { match: nextAgendaMatches(matches, now)[0] || null, isToday: false };
}
