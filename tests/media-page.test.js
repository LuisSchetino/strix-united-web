import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Mídia vira gerador automático da Agenda do Dia sem misturar EA Sync", async () => {
  const page = await read("src/features/media/MediaPage.jsx");
  const main = await read("src/main.jsx");
  const editor = await read("src/features/agenda/NightRelatedEditor.jsx");
  const jobs = await read("src/features/media/media-jobs.js");
  const assets = await read("src/features/media/media-assets.js");
  assert.match(main, /features\/media\/MediaPage/);
  assert.match(page, /AGENDA DO DIA/);
  assert.match(page, /Nenhuma partida agendada para hoje/);
  assert.match(page, /GERAR VÍDEO/);
  assert.match(page, /STORY 9:16/);
  assert.match(page, /FEED 4:5/);
  assert.match(page, /BAIXAR MP4/);
  assert.match(page, /RELACIONADOS DA NOITE/);
  assert.match(page, /ANÚNCIOS FC 27/);
  assert.match(page, /AnnounceStudio/);
  assert.match(page, /GERAR STORY/);
  assert.match(page, /Salve a lista para gerar o vídeo/);
  assert.match(page, /NightRelatedEditor/);
  assert.match(page, /describeTonightRelated/);
  assert.doesNotMatch(page, /união desses jogadores/);
  assert.doesNotMatch(page, /RESERVA|BANCO|SUPLENTE|XI TITULAR/);
  assert.doesNotMatch(page, /proclubs\.ea\.com/);
  assert.doesNotMatch(page, /services\/ea-sync/);
  assert.doesNotMatch(page, /GAME DAY|GameDayEditor|gameday/);
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
  const page = await read("src/features/media/MediaPage.jsx");
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
  assert.match(page, /renderAgendaFrame/);
  assert.match(page, /agendaFrameTime/);
  assert.match(page, /renderRelatedNightFrame/);
  assert.match(page, /relatedNightFrameTime/);
  assert.match(assets, /loadAgendaAssets/);
  assert.match(jobs, /startAnnounceRender/);
  assert.match(assets, /loadAnnounceAssets/);
  assert.match(encode, /encodeStillPng/);
  assert.doesNotMatch(encode, /html-to-image/);
});
