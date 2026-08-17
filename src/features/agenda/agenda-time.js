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
