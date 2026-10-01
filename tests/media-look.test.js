import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MEDIA_LOOKS, normalizeMediaLook, withMediaLook } from "../src/features/media/media-look.js";
import { isCollageLook } from "../src/features/media/collage-paint.js";
import { fingerprintAnnounceRender } from "../src/features/media/announce-core.js";
import { fingerprintAgendaRender } from "../src/features/media/agenda-media-core.js";
import { fingerprintRelatedNightRender } from "../src/features/media/related-night-core.js";
import { fingerprintSummaryRender } from "../src/features/media/summary-core.js";

test("V1 e V2 existem como painters internos e nenhuma tela deixa o usuário escolher", async () => {
  const [page, sections, studio, shell] = await Promise.all([
    "MediaPage.jsx", "MediaSections.jsx", "AnnounceStudio.jsx", "MediaShell.jsx",
  ].map((name) => readFile(new URL(`../src/features/media/${name}`, import.meta.url), "utf8")));
  assert.deepEqual(Object.keys(MEDIA_LOOKS), ["campaign", "collage"]);
  assert.equal(normalizeMediaLook("collage"), "collage");
  assert.equal(normalizeMediaLook("campaign"), "campaign");
  for (const source of [page, sections, studio, shell]) {
    assert.doesNotMatch(source, /MediaLookSwitch|MediaLookBadge|mediaLook=|onMediaLook|setLook|readStoredMediaLook|writeStoredMediaLook/);
    assert.doesNotMatch(source, /V1 — |V2 — |VÍDEO · V1|ARTE ESTÁTICA · V2|TEMPLATE VISUAL/);
  }
  assert.match(sections, /renderAgendaFrame/);
  assert.match(sections, /renderRelatedNightFrame/);
  assert.match(sections, /renderSummaryFrame/);
});

test("timeline collage usa o segundo painter sem apagar a campanha", async () => {
  const frame = await readFile(new URL("../src/features/media/announce-frame.js", import.meta.url), "utf8");
  assert.match(frame, /paintCollageAnnounce/);
  assert.match(frame, /paintAnnounceFrame/);
  const campaign = withMediaLook({ kind: "individual" }, "campaign");
  const collage = withMediaLook({ kind: "individual" }, "collage");
  assert.equal(campaign.mediaLook, "campaign");
  assert.equal(isCollageLook(campaign), false);
  assert.equal(isCollageLook(collage), true);
});

test("fingerprint muda entre V1 e V2 para não misturar cache", async () => {
  const people = [{ id: "p1", name: "Júlio", photo: "", position: "VOL", extraRole: "jogador" }];
  const a = await fingerprintAnnounceRender({ people, look: "campaign" });
  const b = await fingerprintAnnounceRender({ people, look: "collage" });
  assert.notEqual(a, b);
  const agendaA = await fingerprintAgendaRender({ day: "2026-09-20", matches: [], look: "campaign" });
  const agendaB = await fingerprintAgendaRender({ day: "2026-09-20", matches: [], look: "collage" });
  assert.notEqual(agendaA, agendaB);
  const relatedA = await fingerprintRelatedNightRender({ day: "2026-09-20", players: people, look: "campaign" });
  const relatedB = await fingerprintRelatedNightRender({ day: "2026-09-20", players: people, look: "collage" });
  assert.notEqual(relatedA, relatedB);
  const summaryA = await fingerprintSummaryRender({ day: "2026-09-20", matches: [], look: "campaign" });
  const summaryB = await fingerprintSummaryRender({ day: "2026-09-20", matches: [], look: "collage" });
  assert.notEqual(summaryA, summaryB);
});
