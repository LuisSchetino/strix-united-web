import test from "node:test";
import assert from "node:assert/strict";
import { paintEditorialAgenda, paintEditorialAnnounce, paintEditorialRelated, paintEditorialSummary } from "../src/features/media/editorial-media-paint.js";
import { buildAgendaTimeline } from "../src/features/media/agenda-timeline.js";
import { buildRelatedNightTimeline } from "../src/features/media/related-night-timeline.js";
import { buildSummaryTimeline } from "../src/features/media/summary-timeline.js";
import { buildAnnounceTimeline } from "../src/features/media/announce-timeline.js";

function canvas() {
  const calls = [];
  const ctx = {
    canvas: { width: 1080, height: 1920 },
    width: 1080, height: 1920, texts: [], placements: [], fills: [], calls,
    save() {}, restore() {}, setTransform() {}, translate(...args) { calls.push(args); }, scale() {},
    fillRect(x, y, width, height) { this.fills.push(this.fillStyle); calls.push(["rect", x, y, width, height]); },
    strokeRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, stroke() {}, fill() {},
    drawImage() {}, rect() {}, clip() {},
    createLinearGradient() { return { addColorStop() {} }; },
    fillText(text, x, y) { this.texts.push(String(text)); this.placements.push({ text: String(text), x, y, color: this.fillStyle }); },
    measureText(text) { return { width: String(text).length * 8 }; },
    set fillStyle(value) { this._fillStyle = value; }, get fillStyle() { return this._fillStyle; },
    set strokeStyle(value) { this._strokeStyle = value; }, get strokeStyle() { return this._strokeStyle; },
    globalAlpha: 1, lineWidth: 1, textAlign: "left", textBaseline: "alphabetic", font: "",
  };
  return ctx;
}

const matches = [
  { id: "m1", opponent: "POA CITY", competition: "COPA YESHUA", kickoff: "22:10", dateLabel: "01 OUT", strix_score: 3, opponent_score: 1 },
];
const player = { id: "p1", name: "Nunes", photo: "", position: "MC", group: "MEI", number: 8, extraBadge: "JOGADOR" };

test("agenda: abertura, grade de horários e encerramento com dados reais, revelados pela linha do agora", () => {
  const timeline = buildAgendaTimeline(matches, { format: "story" });
  const assets = { strix: { initials: "SU" }, opponents: [{ initials: "PC" }] };
  const sweeping = canvas(); const settled = canvas();
  paintEditorialAgenda(sweeping, { timeline, time: timeline.introEnd + 0.1, assets });
  paintEditorialAgenda(settled, { timeline, time: timeline.introEnd + 1.2, assets });
  assert.ok(sweeping.fills.some((fill) => typeof fill === "object"), "o palco é uma gradação de tinta, não uma tela lisa");
  assert.ok(settled.texts.includes("HOJE"));
  assert.ok(settled.texts.includes("POA CITY"));
  assert.ok(settled.texts.includes("STRIX UNITED"));
  assert.ok(settled.texts.includes("22:10"));
  assert.ok(settled.texts.some((text) => text.includes("COPA YESHUA")));
  assert.notDeepEqual(sweeping.calls, settled.calls, "quadros diferentes refletem a animação temporal");
  assert.ok(!settled.texts.some((text) => /FILM ROOM|MATCHDAY/.test(text)), "sem rótulos de interface genéricos no quadro");
});

test("resumo: recorte em livro-razão e placar com contraste, sem inventar valores", () => {
  const timeline = buildSummaryTimeline({
    mode: "day", rangeLabel: "01 OUT 2026", matches,
    stats: { games: 1, wins: 1, draws: 0, losses: 0, goalsFor: 3, goalsAgainst: 1, efficiency: 100 },
  });
  const ctx = canvas();
  const stats = timeline.scenes.find((scene) => scene.type === "stats");
  paintEditorialSummary(ctx, { timeline, time: stats.start + 1.6 });
  const heading = ctx.placements.find((item) => item.text === "DA NOITE.");
  const firstLabel = ctx.placements.find((item) => item.text === "JOGOS");
  assert.ok(heading && firstLabel && firstLabel.y > heading.y, "os números começam abaixo da chamada");
  assert.ok(ctx.texts.includes("100%"));
  assert.ok(ctx.texts.includes("3–1"));
  assert.ok(!ctx.texts.some((text) => text === "undefined" || text === "null"));

  const result = canvas();
  const resultScene = timeline.scenes.find((scene) => scene.type === "result");
  paintEditorialSummary(result, { timeline, time: resultScene.start + 1.4 });
  assert.equal(result.placements.find((item) => item.text === "3")?.color, "#fbfaf5", "placar legível no palco escuro");
  assert.equal(result.placements.find((item) => item.text === "1")?.color, "#fbfaf5", "placar visitante mantém contraste");
  assert.equal(result.placements.find((item) => item.text === "PC")?.color, "#fbfaf5", "iniciais aparecem quando não há escudo");
  assert.ok(result.texts.includes("VITÓRIA"));
});

test("relacionados e anúncios preservam imagem, nome e contexto; sem foto o número vira a imagem", () => {
  const relatedTimeline = buildRelatedNightTimeline([player]);
  const related = canvas();
  paintEditorialRelated(related, { timeline: relatedTimeline, time: relatedTimeline.introEnd + 1.2, assets: { players: [{ initials: "N" }], byId: { p1: { initials: "N" } } } });
  assert.ok(related.texts.includes("Nunes"));
  assert.ok(related.texts.includes("MC"));
  assert.ok(related.texts.includes("08"), "jogador sem foto ganha o número como imagem tipográfica");
  assert.ok(!related.fills.includes("#d9d7d0"), "sem quadrado claro no lugar da foto");

  const announceTimeline = buildAnnounceTimeline({ kind: "individual", people: [player], phrase: "A nova temporada." });
  const announce = canvas();
  paintEditorialAnnounce(announce, { timeline: announceTimeline, time: 3.2, assets: { players: [{ initials: "N" }], byId: { p1: { initials: "N" } } } });
  assert.ok(announce.fills.some((fill) => typeof fill === "object"));
  assert.ok(announce.texts.includes("NUNES"));
  assert.ok(announce.texts.includes("MC"));
});

test("estado vazio dos painters é seguro sem assumir que há jogo ou jogador", () => {
  const empty = { width: 1080, height: 1920, format: "story", matches: [], players: [], people: [], kind: "individual", scenes: [] };
  assert.doesNotThrow(() => paintEditorialAgenda(canvas(), { timeline: empty, time: 0 }));
  assert.doesNotThrow(() => paintEditorialRelated(canvas(), { timeline: empty, time: 0 }));
  assert.doesNotThrow(() => paintEditorialSummary(canvas(), { timeline: { ...empty, period: { mode: "day", stats: {} } }, time: 0 }));
  assert.doesNotThrow(() => paintEditorialAnnounce(canvas(), { timeline: empty, time: 0 }));
});
