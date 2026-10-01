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

test("painter nightshift compõe abertura, wipe e páginas legíveis de Agenda", () => {
  const timeline = buildAgendaTimeline(matches, { format: "story" });
  const early = canvas(); const settled = canvas();
  paintEditorialAgenda(early, { timeline, time: timeline.introEnd + 0.02, assets: { strix: { initials: "SU" }, opponents: [{ initials: "PC" }] } });
  paintEditorialAgenda(settled, { timeline, time: timeline.introEnd + 0.42, assets: { strix: { initials: "SU" }, opponents: [{ initials: "PC" }] } });

  assert.ok(early.fills.some((fill) => typeof fill === "object"), "o palco aplica gradação carvão em vez de uma tela branca lisa");
  assert.ok(settled.fills.includes("#efeee8"));
  assert.ok(settled.texts.includes("COPA YESHUA"));
  assert.ok(settled.texts.includes("POA CITY"));
  assert.ok(settled.texts.includes("STRIX UNITED"));
  assert.ok(settled.texts.some((text) => text.includes("22:10")));
  assert.notDeepEqual(early.calls, settled.calls, "quadros diferentes refletem a animação temporal");
});

test("resumo separa headline dos cards e mantém campos não disponíveis como traço", () => {
  const timeline = buildSummaryTimeline({
    mode: "day", rangeLabel: "01 OUT 2026", matches,
    stats: { games: 1, wins: 1, draws: 0, losses: 0, goalsFor: 3, goalsAgainst: 1, efficiency: 100 },
  });
  const ctx = canvas();
  paintEditorialSummary(ctx, { timeline, time: timeline.introEnd + 0.4 });
  const heading = ctx.placements.find((item) => item.text === "DA NOITE.");
  const firstLabel = ctx.placements.find((item) => item.text === "JOGOS");
  assert.ok(heading && firstLabel && firstLabel.y > heading.y, "os painéis começam abaixo da chamada editorial");
  assert.ok(ctx.texts.includes("100%"));
  assert.ok(ctx.texts.includes("3–1"));
  assert.ok(!ctx.texts.some((text) => text === "undefined" || text === "null"));

  const result = canvas();
  const resultScene = timeline.scenes.find((scene) => scene.type === "result");
  paintEditorialSummary(result, { timeline, time: resultScene.start + 0.2 });
  assert.equal(result.placements.find((item) => item.text === "3")?.color, "#fbfaf5", "placar branco fica legível no painel escuro");
  assert.equal(result.placements.find((item) => item.text === "1")?.color, "#fbfaf5", "placar visitante mantém contraste");
  assert.equal(result.placements.find((item) => item.text === "PC")?.color, "#fbfaf5", "fallback de iniciais permanece visível sem logo");
});

test("relacionados e anúncios preservam imagem, nome e contexto, sem depender de collage", () => {
  const relatedTimeline = buildRelatedNightTimeline([player]);
  const related = canvas();
  paintEditorialRelated(related, { timeline: relatedTimeline, time: relatedTimeline.introEnd + 0.2, assets: { players: [{ initials: "N" }], byId: { p1: { initials: "N" } } } });
  assert.ok(related.texts.includes("Nunes"));
  assert.ok(related.texts.some((text) => text.includes("MC")));

  const announceTimeline = buildAnnounceTimeline({ kind: "individual", people: [player], phrase: "A nova temporada." });
  const announce = canvas();
  paintEditorialAnnounce(announce, { timeline: announceTimeline, time: 3.2, assets: { players: [{ initials: "N" }], byId: { p1: { initials: "N" } } } });
  assert.ok(announce.fills.some((fill) => typeof fill === "object"));
  assert.ok(announce.texts.includes("Nunes"));
  assert.ok(announce.texts.some((text) => text.includes("MC")));
});

test("estado vazio dos painters é seguro sem assumir que há jogo ou jogador", () => {
  const empty = { width: 1080, height: 1920, format: "story", matches: [], players: [], people: [], kind: "individual", scenes: [] };
  assert.doesNotThrow(() => paintEditorialAgenda(canvas(), { timeline: empty, time: 0 }));
  assert.doesNotThrow(() => paintEditorialRelated(canvas(), { timeline: empty, time: 0 }));
  assert.doesNotThrow(() => paintEditorialSummary(canvas(), { timeline: { ...empty, period: { mode: "day", stats: {} } }, time: 0 }));
  assert.doesNotThrow(() => paintEditorialAnnounce(canvas(), { timeline: empty, time: 0 }));
});
