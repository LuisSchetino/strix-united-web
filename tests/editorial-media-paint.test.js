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
  const heading = ctx.placements.find((item) => item.text === "A NOITE.");
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
  assert.ok(related.texts.includes("NUNES"), "o nome entra na placa, em caixa alta");
  assert.ok(related.texts.some((text) => text.includes("MC")), "a posição acompanha a placa");
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

test("every piece opens on its cover: the first frame of the file already carries the title", () => {
  // Frame zero is what a gallery or a chat shows as the thumbnail; it must not be an empty stage.
  const agenda = canvas();
  paintEditorialAgenda(agenda, { timeline: buildAgendaTimeline(matches, { format: "story" }), time: 0, assets: { strix: { initials: "SU" }, opponents: [{ initials: "PC" }] }, dayLabel: "01 de out de 2026" });
  for (const text of ["AGENDA", "DO DIA"]) assert.ok(agenda.texts.includes(text), `agenda: ${text}`);
  // The count of games left the cover (the title took its room).
  assert.ok(!agenda.texts.includes("JOGO MARCADO") && !agenda.texts.includes("JOGOS MARCADOS"), "a capa não conta os jogos");
  // The cover is the title alone: which games, and when, is what the piece goes on to show.
  assert.ok(!agenda.texts.includes("22:10") && !agenda.texts.includes("POA CITY"), "a capa não adianta os jogos");
  // In a story Instagram covers the top band: the piece's own header starts below it.
  const header = agenda.placements.find((item) => item.text === "STRIX UNITED");
  assert.ok(header.y >= 250, "o cabeçalho fica abaixo da faixa que o Instagram cobre");
  const feed = canvas();
  paintEditorialAgenda(feed, { timeline: buildAgendaTimeline(matches, { format: "feed" }), time: 0, assets: { strix: { initials: "SU" }, opponents: [{ initials: "PC" }] }, dayLabel: "01 de out de 2026" });
  assert.ok(feed.placements.find((item) => item.text === "STRIX UNITED").y < 120, "no formato de feed nada cobre o topo: o cabeçalho fica onde estava");

  const related = canvas();
  paintEditorialRelated(related, { timeline: buildRelatedNightTimeline([player], { format: "story" }), time: 0, assets: { strix: { initials: "SU" }, byId: {} } });
  assert.ok(related.texts.includes("RELACIONADOS") && related.texts.includes("DA NOITE"), "relacionados");

  const team = canvas();
  paintEditorialAnnounce(team, { timeline: buildAnnounceTimeline({ kind: "team", format: "story", people: [player, { ...player, id: "p2", name: "Ceni", group: "GOL" }], title: "ELENCO FC 27", announceType: "jogador" }), time: 0, assets: { strix: { initials: "SU" }, byId: {} } });
  assert.ok(team.texts.includes("UM CLUBE.") && team.texts.includes("UMA TEMPORADA."), "anúncio do time");

  const single = canvas();
  paintEditorialAnnounce(single, { timeline: buildAnnounceTimeline({ kind: "individual", format: "story", people: [player], phrase: "", title: "", announceType: "jogador" }), time: 0, assets: { strix: { initials: "SU" }, byId: {} } });
  assert.ok(single.texts.includes("UM NOVO") && single.texts.includes("CAPÍTULO."), "anúncio individual");
});

test("relacionados fica no campinho e nunca se apresenta como escalação", () => {
  // Fifteen names: more than a team fields. The board stays; the piece's name says what it is.
  const groups = ["GOL", "DEF", "DEF", "DEF", "DEF", "MEI", "MEI", "MEI", "MEI", "MEI", "MEI", "MEI", "ATA", "ATA", "ATA"];
  const squad = groups.map((group, index) => ({ id: `p${index}`, name: `Jogador${index}`, position: group, group, number: index + 1 }));
  const timeline = buildRelatedNightTimeline(squad, { format: "story" });
  const assets = { players: squad.map(() => ({ initials: "J" })), byId: {} };
  const scenes = timeline.scenes.filter((scene) => scene.player);
  const during = canvas(); const end = canvas();
  paintEditorialRelated(during, { timeline, time: scenes.at(-1).start + 1.2, assets });
  // The piece's own last frame (after it comes the closing every video shares).
  paintEditorialRelated(end, { timeline, time: timeline.outroStart - 0.05, assets });

  for (const frame of [during, end]) {
    assert.ok(!frame.texts.some((text) => /ESCALAÇÃO/.test(text)), "a palavra escalação não aparece em nenhum quadro");
    // While the names are called, the header alone names the piece (no heading over the board);
    // the full board, with no line-up to name, is titled with the piece's name.
    assert.ok(frame.texts.includes(frame === end ? "RELACIONADOS DA NOITE" : "RELACIONADOS"), "a peça se chama Relacionados da noite");
    if (frame === during) assert.ok(!frame.texts.includes("RELACIONADOS DA NOITE") && !frame.texts.some((text) => /^(GOLEIRO|DEFESA|MEIO-CAMPO|ATAQUE)$/.test(text)), "sem título nem setor sobre o campinho");
    assert.ok(frame.texts.includes("15 RELACIONADOS"), "o rodapé conta relacionados");
    for (const member of squad) assert.ok(frame.texts.includes(member.name.toUpperCase()), `${member.name} está no campinho`);
  }
  assert.ok(!end.texts.includes("RELACIONADOS."));
  assert.ok(!end.texts.some((text) => /PARA OS JOGOS DE HOJE|SAI NA AGENDA/.test(text)), "sem frases de explicação no fechamento");
  // The pitch: the names spread across the board, not down a column.
  const xs = squad.map((member) => Math.round(end.placements.find((item) => item.text === member.name.toUpperCase()).x));
  assert.ok(new Set(xs).size >= 5, "os nomes ocupam o campo, não uma coluna");
});

test("os parceiros aparecem em todas as peças e fecham a Agenda do dia", () => {
  const sponsors = [{ name: "Rastro", bitmap: { width: 1080, height: 1080 } }, { name: "Next Clubs", bitmap: { width: 1407, height: 385 } }];
  const tracked = () => {
    const ctx = canvas();
    ctx.images = [];
    ctx.drawImage = (image, ...rest) => { ctx.images.push({ image, y: rest.length >= 8 ? rest[5] : rest[1], h: rest.length >= 8 ? rest[7] : rest[3] }); };
    return ctx;
  };
  const marksIn = (ctx) => ctx.images.filter((entry) => sponsors.some((mark) => mark.bitmap === entry.image));

  // The strip: both marks, the same height, at the foot of a frame of every piece.
  const agendaTimeline = buildAgendaTimeline(matches, { format: "story" });
  const pieces = [
    ["agenda", (ctx, assets) => paintEditorialAgenda(ctx, { timeline: agendaTimeline, time: agendaTimeline.introEnd + 1.2, assets: { strix: { initials: "SU" }, opponents: [{ initials: "PC" }], ...assets } })],
    ["relacionados", (ctx, assets) => { const timeline = buildRelatedNightTimeline([player], { format: "story" }); paintEditorialRelated(ctx, { timeline, time: timeline.introEnd + 1.2, assets: { players: [{ initials: "N" }], byId: {}, ...assets } }); }],
    ["resumo", (ctx, assets) => { const timeline = buildSummaryTimeline({ mode: "day", matches, stats: {}, rangeLabel: "01 OUT" }, { format: "story" }); paintEditorialSummary(ctx, { timeline, time: 0.5, assets: { strix: { initials: "SU" }, opponents: [{ initials: "PC" }], ...assets } }); }],
    ["anúncio", (ctx, assets) => paintEditorialAnnounce(ctx, { timeline: buildAnnounceTimeline({ kind: "individual", format: "story", people: [player], phrase: "A nova temporada." }), time: 1, assets: { players: [{ initials: "N" }], byId: {}, ...assets } })],
  ];
  for (const [name, paint] of pieces) {
    const withMarks = tracked();
    paint(withMarks, { sponsors });
    const drawn = marksIn(withMarks);
    assert.equal(drawn.length, 2, `${name}: os dois parceiros na faixa do rodapé`);
    assert.ok(drawn.every((entry) => entry.y + entry.h / 2 > 1920 - 100 && entry.y + entry.h / 2 < 1920 - 84), `${name}: as marcas ficam na linha do rodapé, entre a data e a contagem`);
    assert.ok(Math.abs(drawn[0].h - drawn[1].h) < 0.5, `${name}: as duas marcas têm a mesma altura`);
    const without = tracked();
    assert.doesNotThrow(() => paint(without, {}), `${name}: sem as marcas a peça segue inteira`);
    assert.equal(marksIn(without).length, 0);
  }

  // The Agenda's close: after the crest covers the frame, the marks come back large, in the middle.
  const early = tracked(); const end = tracked();
  const assets = { strix: { bitmap: { width: 1254, height: 1254 } }, opponents: [{ initials: "PC" }], sponsors };
  paintEditorialAgenda(early, { timeline: agendaTimeline, time: agendaTimeline.finaleStart + 1.2, assets });
  paintEditorialAgenda(end, { timeline: agendaTimeline, time: agendaTimeline.duration - 0.05, assets });
  assert.equal(marksIn(early).length, 2, "enquanto o escudo cresce, só a faixa");
  const closing = marksIn(end).filter((entry) => entry.h > 100);
  assert.equal(closing.length, 2, "no fim, as duas marcas grandes");
  assert.ok(closing.every((entry) => entry.y > 1920 * 0.38 && entry.y < 1920 * 0.52), "no meio do quadro");
  assert.ok(!end.texts.some((text) => /PATROC|APOIO|POWERED/i.test(text)), "sem palavra nenhuma: só as marcas");
});
