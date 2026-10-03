import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const centralSources = () => Promise.all([
  read("src/features/media/MediaPage.jsx"),
  read("src/features/media/MediaSections.jsx"),
  read("src/features/media/AnnounceStudio.jsx"),
  read("src/features/media/MediaShell.jsx"),
]);

test("Mídia segue gerando Agenda, Relacionados, Resumo e Anúncios sem misturar EA Sync", async () => {
  const [page, sections, announce, shell] = await centralSources();
  const all = [page, sections, announce, shell].join("\n");
  const main = await read("src/main.jsx");
  const editor = await read("src/features/agenda/NightRelatedEditor.jsx");
  const jobs = await read("src/features/media/media-jobs.js");
  const assets = await read("src/features/media/media-assets.js");
  assert.match(main, /features\/media\/MediaPage/);
  assert.match(sections, /Agenda do dia/);
  assert.match(sections, /Nenhuma partida hoje/);
  assert.match(sections, /GERAR VÍDEO|mediaGenerateLabel/);
  assert.match(sections, /Relacionados da noite/);
  assert.match(sections, /Resumo da semana/);
  assert.match(sections, /Falta salvar a lista/);
  assert.match(sections, /NightRelatedEditor/);
  assert.match(sections, /describeTonightRelated/);
  assert.match(sections, /startAgendaRender/);
  assert.match(sections, /startRelatedNightRender/);
  assert.match(sections, /startSummaryRender/);
  assert.match(announce, /Anúncios FC27/);
  assert.match(announce, /startAnnounceRender/);
  assert.match(page, /<AnnounceStudio/);
  assert.doesNotMatch(all, /união desses jogadores/);
  assert.doesNotMatch(all, /RESERVA|BANCO|SUPLENTE|XI TITULAR/);
  assert.doesNotMatch(all, /proclubs\.ea\.com/);
  assert.doesNotMatch(all, /services\/ea-sync/);
  assert.doesNotMatch(all, /GAME DAY|GameDayEditor|gameday/);
  assert.doesNotMatch(main, /NightRelatedEditor/);
  assert.doesNotMatch(main, /action-gameday|Abrir Game Day/);
  assert.match(editor, /PREENCHER PELAS ESCALAÇÕES/);
  assert.match(editor, /Salve a lista para gerar o vídeo/);
  assert.doesNotMatch(editor, /Sugestão ainda não salva/);
  assert.match(main, /night_related/);
  assert.match(main, /saveNightRelated/);
  assert.match(jobs, /fingerprint/);
  assert.match(jobs, /GERAR|force/);
  assert.match(assets, /cacheableProviderAssetUrl/);
  assert.match(assets, /createImageBitmap/);
});

test("logos do painter não usam círculo cinza e compartilham a mesma caixa óptica", async () => {
  const paint = await read("src/features/media/agenda-paint.js");
  assert.match(paint, /logoDrawRect/);
  assert.match(paint, /measureOpaqueBounds/);
  assert.match(paint, /paintAmbient/);
  assert.doesNotMatch(paint, /MATCHDAY/);
  assert.doesNotMatch(paint, /paintLockup/);
  assert.doesNotMatch(paint, /fillStyle = GRAPHITE/);
  assert.doesNotMatch(paint, /ctx\.arc\(0, 0, half/);
});

test("encode usa H.264 e nunca troca logo depois que o render começa", async () => {
  const encode = await read("src/features/media/encode-mp4.js");
  const [, sections] = await centralSources();
  const assets = await read("src/features/media/media-assets.js");
  const jobs = await read("src/features/media/media-jobs.js");
  assert.match(encode, /VideoEncoder/);
  assert.match(encode, /avc1/);
  assert.match(encode, /mp4-muxer/);
  assert.match(encode, /createImageBitmap/);
  assert.match(encode, /renderAgendaFrame/);
  assert.match(encode, /agendaFrameTime/);
  assert.match(encode, /encodeQueueSize/);
  assert.doesNotMatch(encode, /desynchronized/);
  assert.match(sections, /renderAgendaFrame/);
  assert.match(sections, /agendaFrameTime/);
  assert.match(sections, /renderRelatedNightFrame/);
  assert.match(sections, /relatedNightFrameTime/);
  assert.match(assets, /loadAgendaAssets/);
  assert.match(jobs, /startAnnounceRender/);
  assert.match(assets, /loadAnnounceAssets/);
  assert.match(encode, /encodeStillPng/);
  assert.doesNotMatch(encode, /html-to-image/);
});

test("a mídia de Seletiva saiu do produto; Anúncios mantém só Individual e Time", async () => {
  const [, , announce] = await centralSources();
  const job = await read("src/features/media/media-jobs.js");
  const renderer = await read("src/features/media/media-renderer.js");
  assert.match(announce, /const CONTENT_ITEMS = \[\["individual", "INDIVIDUAL"\], \["team", "TIME"\]\];/);
  assert.doesNotMatch(announce + renderer, /seletiva|StaticMediaV2|static-media-v2/i);
  assert.doesNotMatch(announce, /startAgendaRender|startRelatedNightRender|startSummaryRender/);
  assert.match(job, /startAgendaRender/);
  assert.match(job, /startRelatedNightRender/);
  assert.match(job, /startSummaryRender/);
});
