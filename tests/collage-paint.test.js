import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { withMediaLook } from "../src/features/media/media-look.js";
import {
  collageHeadlineMode,
  collageLetterPlan,
  isCollageLook,
  paintCollageAgenda,
  paintCollageAnnounce,
  paintCollageRelated,
  paintCollageSummary,
  paintCollageWord,
} from "../src/features/media/collage-paint.js";
import { fingerprintAnnounceRender } from "../src/features/media/announce-core.js";
import { fingerprintAgendaRender } from "../src/features/media/agenda-media-core.js";
import { fingerprintRelatedNightRender } from "../src/features/media/related-night-core.js";
import { fingerprintSummaryRender } from "../src/features/media/summary-core.js";
import { buildRelatedNightTimeline } from "../src/features/media/related-night-timeline.js";
import { buildAgendaTimeline } from "../src/features/media/agenda-timeline.js";
import { renderAgendaFrame } from "../src/features/media/agenda-frame.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function mockCtx() {
  const calls = [];
  const grad = { addColorStop() {} };
  return {
    calls,
    canvas: { width: 1080, height: 1920 },
    save() { calls.push("save"); },
    restore() { calls.push("restore"); },
    translate(...args) { calls.push(["translate", args]); },
    rotate(value) { calls.push(["rotate", value]); },
    scale() {},
    fillRect() { calls.push("fillRect"); },
    strokeRect() {},
    fillText(text, x = 0, y = 0) { this.texts.push(String(text)); this.placed.push({ text: String(text), y: Number(y) || 0 }); calls.push(["fillText", String(text), Number(y) || 0]); },
    stroke() { calls.push("stroke"); },
    fill() { calls.push("fill"); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    clip() {},
    rect() {},
    arc() {},
    ellipse() {},
    quadraticCurveTo() {},
    bezierCurveTo() {},
    setLineDash() {},
    setTransform() { calls.push("setTransform"); },
    getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; },
    transform() {},
    drawImage() { calls.push("drawImage"); },
    measureText(text) { return { width: String(text).length * 18 }; },
    createRadialGradient() { return grad; },
    createLinearGradient() { return grad; },
    texts: [],
    placed: [],
    globalCompositeOperation: "source-over",
    filter: "none",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    shadowColor: "",
    shadowBlur: 0,
  };
}

const timelineBase = {
  width: 1080,
  height: 1920,
  format: "story",
  safe: { top: 120, bottom: 120, side: 64 },
  still: true,
  mediaLook: "collage",
  introEnd: 2.2,
  finaleStart: 8,
  duration: 10,
  matches: [{ kickoff: "22:10", opponent: "MÁQUINA", competition: "AMISTOSO" }],
};

test("V2 monta headline letra a letra com rotação própria", () => {
  const plan = collageLetterPlan("AGENDA", 2);
  assert.equal(plan.length, 6);
  assert.ok(plan.some((item) => item.rot !== plan[0].rot || item.lift !== plan[0].lift));
  const ctx = mockCtx();
  paintCollageWord(ctx, "AGENDA", 40, 80, { size: 72, seed: 2, time: 2, still: true });
  assert.ok(ctx.calls.filter((item) => Array.isArray(item) && item[0] === "rotate").length >= 6);
  assert.deepEqual(ctx.texts, ["A", "G", "E", "N", "D", "A"]);
  assert.equal(collageHeadlineMode(true, 4), "static");
  assert.equal(collageHeadlineMode(false, 0.2), "assemble");
  assert.equal(collageHeadlineMode(false, 1.1), "chaos");
  assert.equal(collageHeadlineMode(false, 1.7), "match_cut");
  assert.equal(collageHeadlineMode(false, 2.1), "chaos");
  assert.equal(collageHeadlineMode(false, 2.6), "static");
});

test("pintores legados permanecem isolados e os quatro MP4s ativos chamam o novo painter", async () => {
  const [collage, announceFrame, agendaFrame, relatedFrame, summaryFrame, jobs, announcePaint, agendaPaint] = await Promise.all([
    read("../src/features/media/collage-paint.js"),
    read("../src/features/media/announce-frame.js"),
    read("../src/features/media/agenda-frame.js"),
    read("../src/features/media/related-night-frame.js"),
    read("../src/features/media/summary-frame.js"),
    read("../src/features/media/media-jobs.js"),
    read("../src/features/media/announce-paint.js"),
    read("../src/features/media/agenda-paint.js"),
  ]);
  assert.match(collage, /from "\.\/agenda-paint\.js"/);
  assert.match(collage, /from "\.\/related-night-paint\.js"/);
  assert.match(collage, /from "\.\/announce-paint\.js"/);
  assert.match(collage, /from "\.\/summary-paint\.js"/);
  assert.match(collage, /paintAgendaFrame/);
  assert.match(collage, /paintCutoutText/);
  assert.match(collage, /collageHeadlineMode/);
  assert.match(collage, /\["AGENDA", "DO", "DIA"\]/);
  assert.match(collage, /\["RELACIONADOS", "DA", "NOITE"\]/);
  assert.match(collage, /\["RESUMO", "DO", "DIA"\]/);
  assert.match(collage, /pickCollageAsset\("brushes"/);
  assert.match(collage, /paintHeadlineAccents/);
  assert.doesNotMatch(collage, /noise-paper-1|cut-fill|PAPER_IDS/);
  assert.doesNotMatch(collage, /width \* 0\.92|source-atop/);
  assert.doesNotMatch(collage, /paintCollagePitch/);
  assert.match(announceFrame, /paintEditorialAnnounce/);
  assert.doesNotMatch(announceFrame, /paintAnnounceFrame/);
  assert.match(agendaFrame, /paintEditorialAgenda/);
  assert.match(relatedFrame, /paintEditorialRelated/);
  assert.match(summaryFrame, /paintEditorialSummary/);
  assert.match(jobs, /renderAnnounceFrame/);
  assert.match(announcePaint, /paintAnnounceFrame|cinematicCamera|paintRoleSweep/);
  assert.doesNotMatch(announcePaint, /paintCutoutText/);
  assert.doesNotMatch(agendaPaint, /paintCutoutText/);
  assert.equal(isCollageLook(withMediaLook({ kind: "individual" }, "collage")), true);
  assert.equal(isCollageLook(withMediaLook({ kind: "individual" }, "campaign")), false);

  const related = buildRelatedNightTimeline([
    { id: "p1", name: "João", photo: "", position: "GOL", group: "GOL", number: 1 },
  ], { format: "story" });
  const announceCtx = mockCtx();
  announceCtx.font = "700 176px Inter, sans-serif";
  paintCollageAnnounce(announceCtx, { timeline: { ...timelineBase, kind: "individual", person: { name: "Nunes", position: "MC", extraBadge: "CAPITÃO", shirt_number: 8 } }, time: 2 });
  assert.equal(announceCtx.texts.includes("NUNES"), false);
  assert.ok(announceCtx.texts.includes("MC"));
  assert.ok(announceCtx.texts.includes("CAPITÃO"));

  const agendaDay = buildAgendaTimeline([
    { id: "1", kickoff: "22:10", opponent: "MÁQUINA", competition: "AMISTOSO" },
  ], { format: "story" });
  const agendaMatchCtx = mockCtx();
  renderAgendaFrame(agendaMatchCtx, {
    timeline: agendaDay,
    timeSec: agendaDay.introEnd + 0.8,
    dayLabel: "20/09",
    assets: { strix: { initials: "SU" }, opponents: [{ initials: "MA" }] },
  });
  assert.ok(agendaMatchCtx.texts.includes("22:10"));
  assert.ok(agendaMatchCtx.texts.includes("AMISTOSO"));
  const agendaFinaleCtx = mockCtx();
  renderAgendaFrame(agendaFinaleCtx, {
    timeline: agendaDay,
    timeSec: agendaDay.finaleStart + 0.6,
    dayLabel: "20 SET 2026",
    assets: { strix: { initials: "SU" }, opponents: [{ initials: "MA" }] },
  });
  assert.ok(agendaFinaleCtx.texts.some((text) => text.includes("01 JOGO")));

  const relatedCtx = mockCtx();
  paintCollageRelated(relatedCtx, { timeline: withMediaLook(related, "collage"), time: 0.85 });
  assert.equal(relatedCtx.texts.includes("RELACIONADOS"), false);
  assert.equal(relatedCtx.texts.includes("DA NOITE"), false);

  const summaryCtx = mockCtx();
  paintCollageSummary(summaryCtx, { timeline: { ...timelineBase, matches: [{ opponent: "POA CITY", strix_score: 2, opponent_score: 1 }], stats: { games: 1, wins: 1, goalsFor: 2 }, period: { title: "RESUMO DO DIA", stats: { games: 1 } } }, time: 1.2 });
  assert.equal(summaryCtx.texts.includes("RESUMO"), false);
  assert.equal(summaryCtx.texts.includes("DO DIA"), false);
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
