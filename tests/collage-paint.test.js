import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { withMediaLook } from "../src/features/media/media-look.js";
import {
  collageLetterPlan,
  isCollageLook,
  paintCollageAgenda,
  paintCollageAnnounce,
  paintCollagePitch,
  paintCollageRelated,
  paintCollageSummary,
  paintCollageWord,
} from "../src/features/media/collage-paint.js";
import { fingerprintAnnounceRender } from "../src/features/media/announce-core.js";
import { fingerprintAgendaRender } from "../src/features/media/agenda-media-core.js";
import { fingerprintRelatedNightRender } from "../src/features/media/related-night-core.js";
import { fingerprintSummaryRender } from "../src/features/media/summary-core.js";
import { buildRelatedNightTimeline } from "../src/features/media/related-night-timeline.js";
import { fieldQuad } from "../src/features/media/related-night-layout.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function mockCtx() {
  const calls = [];
  return {
    calls,
    canvas: { width: 1080, height: 1920 },
    save() { calls.push("save"); },
    restore() { calls.push("restore"); },
    translate(...args) { calls.push(["translate", args]); },
    rotate(value) { calls.push(["rotate", value]); },
    fillRect() { calls.push("fillRect"); },
    strokeRect() {},
    fillText(text) { calls.push(["fillText", String(text)]); },
    stroke() { calls.push("stroke"); },
    fill() { calls.push("fill"); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    clip() {},
    rect() {},
    arc() {},
    scale() {},
    drawImage() { calls.push("drawImage"); },
    measureText(text) { return { width: String(text).length * 18 }; },
    createRadialGradient() { return { addColorStop() {} }; },
    decode() {},
    globalCompositeOperation: "source-over",
    filter: "none",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
  };
}

const timelineBase = {
  width: 1080,
  height: 1920,
  format: "story",
  safe: { top: 120, bottom: 120, side: 64 },
  still: true,
  mediaLook: "collage",
};

test("V2 monta headline letra a letra com rotação própria", () => {
  const plan = collageLetterPlan("AGENDA", 2);
  assert.equal(plan.length, 6);
  assert.ok(plan.some((item) => item.rot !== plan[0].rot || item.lift !== plan[0].lift));
  const ctx = mockCtx();
  paintCollageWord(ctx, "AGENDA", 40, 80, { size: 72, seed: 2, time: 2 });
  assert.ok(ctx.calls.filter((item) => Array.isArray(item) && item[0] === "rotate").length >= 6);
  assert.deepEqual(
    ctx.calls.filter((item) => Array.isArray(item) && item[0] === "fillText").map((item) => item[1]),
    ["A", "G", "E", "N", "D", "A"],
  );
});

test("painters V2 são independentes da V1 e o campo usa fieldQuad", async () => {
  const [collage, announceFrame, agendaFrame, relatedFrame, summaryFrame, jobs, announcePaint] = await Promise.all([
    read("../src/features/media/collage-paint.js"),
    read("../src/features/media/announce-frame.js"),
    read("../src/features/media/agenda-frame.js"),
    read("../src/features/media/related-night-frame.js"),
    read("../src/features/media/summary-frame.js"),
    read("../src/features/media/media-jobs.js"),
    read("../src/features/media/announce-paint.js"),
  ]);
  assert.doesNotMatch(collage, /from "\.\/announce-paint\.js"/);
  assert.doesNotMatch(collage, /from "\.\/agenda-paint\.js"/);
  assert.doesNotMatch(collage, /from "\.\/related-night-paint\.js"/);
  assert.doesNotMatch(collage, /fillText\("STRIX UNITED"/);
  assert.match(collage, /function shirtLabel/);
  assert.match(collage, /player\?\.number \?\? player\?\.shirt_number/);
  assert.match(announceFrame, /paintCollageAnnounce/);
  assert.match(agendaFrame, /paintCollageAgenda/);
  assert.match(relatedFrame, /paintCollageRelated/);
  assert.match(summaryFrame, /paintCollageSummary/);
  assert.match(jobs, /renderAnnounceFrame/);
  assert.match(jobs, /renderRelatedNightFrame/);
  assert.match(announcePaint, /paintAnnounceFrame|cinematicCamera|paintRoleSweep/);
  assert.equal(isCollageLook(withMediaLook({ kind: "individual" }, "collage")), true);
  assert.equal(isCollageLook(withMediaLook({ kind: "individual" }, "campaign")), false);

  const related = buildRelatedNightTimeline([
    { id: "p1", name: "João", photo: "", position: "GOL", group: "GOL", number: 1 },
  ], { format: "story" });
  const pitchCtx = mockCtx();
  paintCollagePitch(pitchCtx, related, 1);
  const quad = fieldQuad(related, { zoom: 0.9, lookU: 0.5, lookV: 0.5, originN: 0.5 });
  assert.equal(quad.length, 4);
  assert.ok(quad.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
  const minX = Math.min(...quad.map((point) => point.x));
  const maxX = Math.max(...quad.map((point) => point.x));
  assert.ok(minX > 40 && maxX < related.width - 40);
  assert.ok(pitchCtx.calls.includes("stroke"));

  paintCollageAnnounce(mockCtx(), { timeline: { ...timelineBase, person: { name: "Nunes", position: "MC", extraBadge: "CAPITÃO", shirt_number: 8 } }, time: 2 });
  paintCollageAgenda(mockCtx(), { timeline: { ...timelineBase, matches: [{ kickoff: "22:10", opponent: "MÁQUINA", competition: "AMISTOSO" }] }, time: 2, dayLabel: "20/09" });
  paintCollageRelated(mockCtx(), { timeline: withMediaLook(related, "collage"), time: 2 });
  paintCollageSummary(mockCtx(), { timeline: { ...timelineBase, matches: [{ opponent: "POA CITY", strix_score: 2, opponent_score: 1 }], stats: { games: 1, wins: 1, goalsFor: 2 } }, time: 2 });
});

test("export/fingerprint V2 não reutiliza o cache da V1", async () => {
  const people = [{ id: "p1", name: "Júlio", photo: "", position: "VOL", extraRole: "jogador", shirt_number: 5 }];
  const a = await fingerprintAnnounceRender({ people, look: "campaign" });
  const b = await fingerprintAnnounceRender({ people, look: "collage" });
  assert.notEqual(a, b);
  assert.notEqual(
    await fingerprintAgendaRender({ day: "2026-09-20", matches: [], look: "campaign" }),
    await fingerprintAgendaRender({ day: "2026-09-20", matches: [], look: "collage" }),
  );
  assert.notEqual(
    await fingerprintRelatedNightRender({ day: "2026-09-20", players: people, look: "campaign" }),
    await fingerprintRelatedNightRender({ day: "2026-09-20", players: people, look: "collage" }),
  );
  assert.notEqual(
    await fingerprintSummaryRender({ day: "2026-09-20", matches: [], look: "campaign" }),
    await fingerprintSummaryRender({ day: "2026-09-20", matches: [], look: "collage" }),
  );
});
