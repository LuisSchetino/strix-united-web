/** Which side scored between two readings of the live score ("strix", "opponent" or ""). */
export function goalBetween(previous, next) {
  if (!previous || !next || previous.id !== next.id) return "";
  if (Number(next.strix) > Number(previous.strix)) return "strix";
  if (Number(next.opponent) > Number(previous.opponent)) return "opponent";
  return "";
}
