// Talks to functions/api/night/required.js ("Obrigatório da noite") and, for the board, marks
// and unmarks the day's plays. What a member watched is only ever written by the server.
import { loadYouTubeApi } from "./youtube-api.js";

let lastToken = "";
async function tokenOf(client) {
  const { data } = await client.auth.getSession();
  lastToken = data.session?.access_token || "";
  return lastToken;
}
const headers = (token) => ({ "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) });

/** The day's plays and what this member watched; with `team`, every member (Conselho and above). */
/**
 * What a member watched as "obrigatório da noite" also counts in his Library progress
 * (library_view_progress, the row the tracking screen reads). `row` is the server's answer
 * for one play; `duration` the play's length. It only ever adds: a row that already says as
 * much is left alone. Returns true when something was written.
 */
export async function mirrorToLibrary(client, userId, row, duration = 0, now = new Date()) {
  const watched = Math.round(Number(row?.watched_seconds) || 0);
  if (!client || !userId || !row?.item_id || (watched <= 0 && !row.completed_at)) return false;
  const table = () => client.from("library_view_progress");
  const { data: current, error } = await table().select("*").eq("item_id", row.item_id).eq("user_id", userId).maybeSingle();
  if (error) return false;
  const values = libraryValues(current, row, duration, now);
  if (!values) return false;
  const saved = current
    ? await table().update(values).eq("item_id", row.item_id).eq("user_id", userId)
    : await table().insert({ item_id: row.item_id, ...values });
  return !saved.error;
}

/** The Library row a watched required play is worth, or null when the row already says it. */
export function libraryValues(current, row, duration = 0, now = new Date()) {
  const stamp = new Date(now).toISOString();
  const length = Math.max(0, Math.round(Number(duration) || 0));
  const watched = Math.max(Math.round(Number(current?.watched_seconds) || 0), Math.round(Number(row?.watched_seconds) || 0));
  const measured = length ? Math.min(100, Number((watched / length * 100).toFixed(2))) : 0;
  // The server decided the play is done: the Library shows it done too (its own line is 90%).
  const percent = Math.max(Number(current?.progress_percent) || 0, measured, row?.completed_at ? 90 : 0);
  const completed = current?.completed_at || row?.completed_at || null;
  if (current && watched <= (Number(current.watched_seconds) || 0) && percent <= (Number(current.progress_percent) || 0) && completed === (current.completed_at || null)) return null;
  return {
    started_at: current?.started_at || stamp,
    watched_seconds: watched,
    last_position_seconds: Math.max(Number(current?.last_position_seconds) || 0, length ? Math.min(length, watched) : 0),
    progress_percent: percent,
    completed_at: completed,
    last_accessed_at: stamp,
  };
}

export async function readRequired(client, { team = false } = {}) {
  const response = await fetch(`/api/night/required${team ? "?team=1" : ""}`, { headers: headers(await tokenOf(client)), cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "night_required_unavailable");
  return payload;
}

/** One report from the player. `keepalive` lets the last one leave while the page is closing. */
export async function reportRequired(client, { day, itemId, playing }, { keepalive = false } = {}) {
  const token = keepalive && lastToken ? lastToken : await tokenOf(client);
  const response = await fetch("/api/night/required", { method: "POST", headers: headers(token), body: JSON.stringify({ day, itemId, playing: Boolean(playing) }), keepalive });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "night_required_unavailable");
  return payload;
}

/**
 * The length of a YouTube video, read from the player itself (the board's browser does this
 * once, when it marks a play; the server then holds every member to that length).
 */
export async function readYouTubeDuration(videoId) {
  const YT = await loadYouTubeApi();
  return new Promise((resolve, reject) => {
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-9999px;top:0;width:320px;height:180px;opacity:0;pointer-events:none";
    const target = document.createElement("div");
    holder.appendChild(target); document.body.appendChild(holder);
    let player = null, timer = 0, tries = 0;
    const finish = (value, error) => {
      window.clearInterval(timer);
      try { player?.destroy(); } catch { /* already gone */ }
      holder.remove();
      if (error) reject(error); else resolve(value);
    };
    player = new YT.Player(target, {
      videoId,
      host: "https://www.youtube-nocookie.com",
      playerVars: { controls: 0, playsinline: 1 },
      events: {
        onReady: () => {
          timer = window.setInterval(() => {
            const length = Math.round(Number(player.getDuration?.()) || 0);
            tries += 1;
            if (length > 0) return finish(length);
            // Some videos only tell their length once they start loading: nudge them, silently.
            if (tries === 6) { try { player.mute(); player.playVideo(); } catch { /* keep waiting */ } }
            if (tries > 40) finish(0, new Error("duration_unavailable"));
          }, 250);
        },
        onError: () => finish(0, new Error("video_unavailable")),
      },
    });
  });
}

/** Marks a play as required for `day`. Three a day at most (the database enforces it too). */
export async function markRequired(client, { day, itemId, position = 0, duration }) {
  const { error } = await client.from("night_required_items").insert({ day, item_id: itemId, position, duration_seconds: Math.round(duration) });
  if (error) throw error;
  // The length is kept on the material too, so the next time it is marked nothing has to be read.
  await client.from("library_items").update({ duration_seconds: Math.round(duration) }).eq("id", itemId).then(() => null, () => null);
}

export async function unmarkRequired(client, { day, itemId }) {
  const { error } = await client.from("night_required_items").delete().eq("day", day).eq("item_id", itemId);
  if (error) throw error;
}

/** What to tell whoever was marking when it fails. */
export function markFailure(cause) {
  const message = String(cause?.message || "");
  if (message.includes("night_required_limit")) return "Já são três jogadas obrigatórias hoje. Tire uma para pôr outra.";
  if (["42P01", "PGRST205"].includes(cause?.code)) return "O obrigatório da noite ainda não foi ligado no banco (falta aplicar a migração).";
  if (cause?.code === "23505") return "Essa jogada já é obrigatória hoje.";
  if (message === "duration_unavailable" || message === "video_unavailable") return "Não consegui ler a duração desse vídeo no YouTube. Confira se ele abre e tente de novo.";
  if (cause?.code === "42501") return "Só a diretoria marca jogada obrigatória.";
  return "Não foi possível mudar o obrigatório de hoje. Tente de novo.";
}
