import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Mídia vira gerador automático da Agenda do Dia sem misturar EA Sync", async () => {
  const page = await read("src/features/media/MediaPage.jsx");
  const main = await read("src/main.jsx");
  const jobs = await read("src/features/media/media-jobs.js");
  const assets = await read("src/features/media/media-assets.js");
  assert.match(main, /features\/media\/MediaPage/);
  assert.match(page, /AGENDA DO DIA/);
  assert.match(page, /Nenhuma partida agendada para hoje/);
  assert.match(page, /GERAR VÍDEO/);
  assert.match(page, /STORY 9:16/);
  assert.match(page, /FEED 4:5/);
  assert.match(page, /BAIXAR MP4/);
  assert.doesNotMatch(page, /proclubs\.ea\.com/);
  assert.doesNotMatch(page, /services\/ea-sync/);
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
  assert.doesNotMatch(paint, /fillStyle = GRAPHITE/);
  assert.doesNotMatch(paint, /ctx\.arc\(0, 0, half/);
});

test("encode usa H.264 e nunca troca logo depois que o render começa", async () => {
  const encode = await read("src/features/media/encode-mp4.js");
  const page = await read("src/features/media/MediaPage.jsx");
  const assets = await read("src/features/media/media-assets.js");
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
  assert.match(assets, /loadAgendaAssets/);
  assert.doesNotMatch(encode, /html-to-image/);
});
