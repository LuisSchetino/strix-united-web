export const asArray = (value) => Array.isArray(value) ? value : [];

export function librarySource(value) {
  const raw = String(value || "").trim();
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { type: "direct", embedUrl: raw, id: "", trackable: true };
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be" || host.endsWith("youtube.com")) {
    const id = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || "";
    return {
      type: "youtube",
      id,
      embedUrl: id ? `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&rel=0` : raw,
      trackable: Boolean(id),
    };
  }
  if (host === "drive.google.com") {
    const id = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get("id") || "";
    return {
      type: "drive",
      id,
      embedUrl: id ? `https://drive.google.com/file/d/${id}/preview` : raw,
      trackable: false,
    };
  }
  return { type: "direct", id: "", embedUrl: raw, trackable: true };
}

export function progressPatch(position, duration, previous = {}) {
  const safePosition = Math.max(0, Math.round(Number(position) || 0));
  const safeDuration = Math.max(0, Math.round(Number(duration) || 0));
  const percent = safeDuration
    ? Math.min(100, Number(((safePosition / safeDuration) * 100).toFixed(2)))
    : Number(previous.progress_percent || 0);
  const completed = percent >= 90;
  return {
    started_at: previous.started_at || new Date().toISOString(),
    watched_seconds: Math.max(Number(previous.watched_seconds || 0), safePosition),
    last_position_seconds: safePosition,
    progress_percent: percent,
    completed_at: completed ? previous.completed_at || new Date().toISOString() : null,
    last_accessed_at: new Date().toISOString(),
  };
}

export const tierWeight = (tier) => ({ teste: 10, player: 20, conselho: 30, diretoria: 40, dev: 50 })[tier] || 0;

export const canTrackLibrary = (tier) => tierWeight(tier) >= tierWeight("conselho");
export const canManageLibrary = (tier) => tierWeight(tier) >= tierWeight("diretoria");
