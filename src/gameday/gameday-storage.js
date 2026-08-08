import { safeFileName } from "./defaults.js";

const DRAFT_KEY = "strix-fc27-gameday-draft-v1";
const BUCKET = "fc27-team-assets";

export function loadDraft(fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    return saved?.templateId ? saved : fallback;
  } catch {
    return fallback;
  }
}

export function storeDraft(project) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...project, updatedAt: new Date().toISOString() }));
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export async function uploadGameDayAsset(client, profile, file, folder = "projects") {
  if (!client || !profile?.user_id) throw new Error("Sessão indisponível para enviar a imagem.");
  if (!file?.type?.startsWith("image/")) throw new Error("Envie uma imagem PNG, JPG ou WebP.");
  if (file.size > 18 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 18 MB.");
  const path = `gameday/${folder}/${profile.user_id}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
  const { error } = await client.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return { path, url: client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}

export async function listProjects(client) {
  const { data, error } = await client.from("gameday_projects").select("id,name,template_id,project,updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveProject(client, profile, project) {
  const payload = {
    name: project.name.trim() || "GameDay sem título",
    template_id: project.templateId,
    project: { ...project, updatedAt: new Date().toISOString() },
    updated_by: profile.user_id,
  };
  const query = project.id
    ? client.from("gameday_projects").update(payload).eq("id", project.id).select().single()
    : client.from("gameday_projects").insert({ ...payload, created_by: profile.user_id }).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return { ...data.project, id: data.id, name: data.name };
}

export async function deleteProject(client, id) {
  const { error } = await client.from("gameday_projects").delete().eq("id", id);
  if (error) throw error;
}

export async function listPlayerAssets(client) {
  const { data, error } = await client.from("gameday_player_assets").select("*").order("display_name");
  if (error) throw error;
  return data || [];
}

export async function savePlayerAsset(client, profile, player) {
  const payload = {
    display_name: player.display_name.trim(), nickname: player.nickname?.trim() || null,
    position: player.position || "MC", original_path: player.original_path || null,
    cutout_path: player.cutout_path || null, uniform_path: player.uniform_path || null,
    poses: player.poses || [], updated_by: profile.user_id,
  };
  const query = player.id
    ? client.from("gameday_player_assets").update(payload).eq("id", player.id).select().single()
    : client.from("gameday_player_assets").insert({ ...payload, created_by: profile.user_id }).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function removePlayerAsset(client, id) {
  const { error } = await client.from("gameday_player_assets").delete().eq("id", id);
  if (error) throw error;
}

export function publicAssetUrl(client, path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\/)/.test(path)) return path;
  return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
