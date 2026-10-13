import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNightAgendaTimeline, buildNightAnnounceTimeline, buildNightRelatedTimeline, buildNightSummaryTimeline, metronome, nightPages, nightPitch,
  planNightAgenda, planNightAnnounce, planNightRelated, planNightSquad, planNightSummary, seededPick,
} from "../src/features/media/night-plan.js";

const games = (count) => Array.from({ length: count }, (unused, i) => ({ id: `m${i}`, kickoff: "21:10", opponent: `Rival ${i}` }));

test("os jogos vão em páginas de até três, equilibradas", () => {
  assert.deepEqual(nightPages(0), []);
  assert.deepEqual(nightPages(1), [[0]]);
  assert.deepEqual(nightPages(4), [[0, 1], [2, 3]]);
  assert.deepEqual(nightPages(6), [[0, 1, 2], [3, 4, 5]]);
  assert.deepEqual(nightPages(7).map((page) => page.length), [3, 3, 1]);
});

test("sem música, o relógio conta batidas iguais e prefere as batidas inteiras", () => {
  const clock = metronome({ bpm: 120, lead: 4, pre: 0 });
  assert.equal(clock.beat, 0.5);
  assert.equal(clock.at(0).at, 2);
  assert.equal(clock.at(-4).at, 0);
  assert.deepEqual(clock.pick(0, [1, 1.5, 2, 2.5, 3], 2), [1, 2]);
  assert.deepEqual(clock.pick(0, [2, 1.5, 2.5], 1), [2]);
  assert.equal(clock.pick(0, [4, 4.5, 5, 5.5, 6, 6.5], 3).length, 3);
});

test("a Agenda anda em ordem: capa, cada página em dois compassos, a capa de volta e a luz apagando", () => {
  const clock = metronome({ bpm: 120, lead: 4, pre: 0 });
  const plan = planNightAgenda({ count: 6, clock });
  assert.equal(plan.pages.length, 2);
  assert.equal(plan.title.agenda, 2);
  assert.equal(plan.pages[0].start, 2 + 8 * 0.5);
  assert.equal(plan.pages[1].start, 2 + 16 * 0.5);
  for (const page of plan.pages) {
    const times = page.rows.map((row) => row.at);
    assert.deepEqual([...times].sort((a, b) => a - b), times, "os jogos entram em ordem");
    assert.equal(times[0], page.start, "o primeiro jogo entra com a página");
    for (const row of page.rows) assert.ok(row.lit > page.rows.at(-1).at && row.lit < page.exit && row.until > row.lit, "a vez de cada jogo vem depois de todos entrarem");
  }
  assert.ok(plan.back.agenda > plan.pages[1].exit && plan.back.dodia > plan.back.agenda);
  assert.ok(plan.off > plan.back.dodia && plan.end > plan.off && plan.duration > plan.end);
  // The light goes out over a whole bar, and its start is a hit like any other: it blinks.
  assert.equal(Number((plan.end - plan.off).toFixed(2)), 4 * 0.5);
  assert.ok(plan.blinks.some(([at, power]) => at === plan.off && power === 1));
  // Every instant is the start of a frame.
  for (const time of [plan.title.agenda, plan.off, plan.end, ...plan.pages.flatMap((page) => page.rows.flatMap((row) => [row.at, row.lit]))]) assert.ok(Math.abs(time * 30 - Math.round(time * 30)) < 1e-6);
  assert.ok(plan.blinks.every(([at, power]) => at >= 0 && power >= 0 && power <= 1));
});

test("um dia sem jogo ou com um jogo só não quebra o plano", () => {
  const clock = metronome();
  assert.equal(planNightAgenda({ count: 0, clock }).pages.length, 0);
  const one = planNightAgenda({ count: 1, clock });
  assert.equal(one.pages.length, 1);
  assert.equal(one.pages[0].rows.length, 1);
});

const eleven = () => ["ATA", "ATA", "ALA", "MC", "MC", "ALA", "VOL", "ZAG", "ZAG", "ZAG", "GOL"].map((position, slot) => ({ id: `s${slot}`, name: `T${slot}`, position, slot }));

test("com escalação o campinho é o onze, do gol para a frente, e o resto da lista fica na faixa", () => {
  const pitch = nightPitch([...eleven(), { id: "b1", name: "B1", bench: true }, { id: "b2", name: "B2", bench: true }]);
  assert.equal(pitch.lined, true);
  assert.deepEqual(pitch.rows.map((row) => row.map((entry) => entry.player.position)), [["GOL"], ["ZAG", "ZAG", "ZAG"], ["VOL"], ["ALA", "MC", "MC", "ALA"], ["ATA", "ATA"]]);
  assert.deepEqual(pitch.bench.map((entry) => entry.player.name), ["B1", "B2"]);
  assert.equal(pitch.rows[0][0].u, 0.5);
  for (const row of pitch.rows) {
    const across = row.map((entry) => entry.u);
    assert.deepEqual([...across].sort((a, b) => a - b), across, "a linha vai da esquerda para a direita");
    assert.ok(across.every((u) => u > 0 && u < 1));
    assert.ok(Math.abs(across[0] + across.at(-1) - 1) < 1e-9, "a linha fica centrada");
  }
  // `index` aponta para o jogador na lista do vídeo (é por ele que a foto é achada).
  assert.equal(pitch.rows[1][0].index, 7);
});

test("sem escalação todo mundo vai para o campinho por setor, em linhas de até quatro", () => {
  const group = (position) => (position === "GOL" ? "GOL" : position === "ZAG" ? "DEF" : position === "ATA" ? "ATA" : "MEI");
  const list = ["GOL", "ZAG", "ZAG", "ZAG", "ZAG", "ZAG", "VOL", "MC", "MC", "ATA", "ATA", "ATA"].map((position, i) => ({ id: `p${i}`, name: `P${i}`, position, group: group(position) }));
  const pitch = nightPitch(list);
  assert.equal(pitch.lined, false);
  assert.equal(pitch.bench.length, 0);
  assert.equal(pitch.rows.flat().length, list.length);
  assert.ok(pitch.rows.every((row) => row.length <= 4));
  assert.deepEqual(pitch.rows.map((row) => row.length), [1, 3, 2, 1, 2, 3]);
  assert.deepEqual(nightPitch([]).rows, []);
});

test("nos Relacionados cada linha do time cai numa batida forte e a faixa vem depois da última", () => {
  const clock = metronome({ bpm: 120, lead: 4, pre: 0 });
  const plan = planNightRelated({ rows: 5, bench: true, clock });
  assert.ok(plan.title.first < plan.title.second && plan.title.second < plan.start);
  assert.deepEqual(plan.lines, [2, 3, 4, 5, 6]);
  assert.equal(plan.strip, 7);
  assert.ok(plan.off - plan.strip >= 2, "a faixa fica na tela antes de a luz apagar");
  assert.ok(plan.end > plan.off && plan.duration > plan.end);
  const alone = planNightRelated({ rows: 5, bench: false, clock });
  assert.equal(alone.strip, null);
  assert.equal(planNightRelated({ rows: 0, clock }).lines.length, 0);
});

test("o Resumo anda como a Agenda e fecha no retrospecto do período", () => {
  const clock = metronome({ bpm: 120, lead: 4, pre: 0 });
  const plan = planNightSummary({ count: 4, clock });
  assert.equal(plan.pages.length, 2);
  assert.equal(plan.pages[0].start, 2 + 8 * 0.5);
  assert.ok(plan.totals.start > plan.pages[1].exit);
  assert.ok(plan.totals.start < plan.totals.draws && plan.totals.draws < plan.totals.losses && plan.totals.losses < plan.totals.line);
  assert.ok(plan.off > plan.totals.line && plan.end > plan.off);
  assert.equal(planNightSummary({ count: 0, clock }).pages.length, 0);
});

test("o Anúncio individual: a chamada, depois o nome, depois a frase, e uma imagem tirada com tudo na tela", () => {
  const plan = planNightAnnounce({ clock: metronome({ bpm: 120, lead: 4, pre: 0 }) });
  assert.ok(plan.head.first < plan.head.second && plan.head.second < plan.head.exit && plan.head.exit < plan.name);
  assert.ok(plan.name < plan.phrase && plan.phrase < plan.still && plan.still < plan.off && plan.off < plan.end);
});

test("o Anúncio do time: cada capítulo abre com seu cartão só quando há mais de um, e todos fecham numa tela", () => {
  const clock = metronome({ bpm: 120, lead: 4, pre: 0 });
  const one = planNightSquad({ sections: [3], clock });
  assert.deepEqual(one.scenes.map((scene) => scene.type), ["person", "person", "person"]);
  const two = planNightSquad({ sections: [1, 2], clock });
  assert.deepEqual(two.scenes.map((scene) => scene.type), ["section", "person", "section", "person", "person"]);
  assert.deepEqual(two.scenes.filter((scene) => scene.type === "person").map((scene) => scene.index), [0, 1, 2]);
  two.scenes.forEach((scene, i) => assert.equal(scene.until, two.scenes[i + 1]?.at ?? two.list.start));
  assert.ok(two.list.start < two.list.second && two.list.second < two.still && two.still < two.off);
});

test("a linha do tempo carrega o formato, quem aparece e sabe se refazer em outro relógio", () => {
  const face = { id: "p1", name: "Nunes", photo: "/x.png" };
  const story = buildNightAgendaTimeline(games(3), { format: "story", face });
  assert.equal(story.width, 1080); assert.equal(story.height, 1920);
  assert.equal(story.face, face); assert.equal(story.matches.length, 3);
  assert.equal(story.totalFrames, Math.round(story.duration * story.fps));
  const onSong = story.build(metronome({ bpm: 140 }));
  assert.equal(onSong.face, face); assert.equal(onSong.matches.length, 3);
  assert.ok(onSong.duration < story.duration, "num andamento mais rápido a peça fica mais curta");
  const feed = buildNightAgendaTimeline(games(3), { format: "feed" });
  assert.equal(feed.height, 1350); assert.equal(feed.face, null);
  const related = buildNightRelatedTimeline([{ id: "a", name: "A", group: "DEF" }, { id: "b", name: "B", group: "ATA" }]);
  assert.equal(related.night.lines.length, 2);
  assert.equal(related.pitch.rows.length, 2);
  assert.equal(related.build(metronome({ bpm: 100 })).players.length, 2);
  const period = { mode: "week", matches: games(4), stats: { wins: 3 } };
  const summary = buildNightSummaryTimeline(period, { face });
  assert.equal(summary.period, period); assert.equal(summary.matches.length, 4); assert.equal(summary.face, face);
  assert.equal(summary.build(metronome({ bpm: 100 })).night.pages.length, 2);
});

test("o Anúncio em vídeo e em imagem saem da mesma peça", () => {
  const person = { id: "p1", name: "Nunes" };
  const video = buildNightAnnounceTimeline({ kind: "individual", format: "story", people: [person, { id: "p2", name: "Outro" }], phrase: "Frase.", announceType: "retorno" });
  assert.equal(video.kind, "individual"); assert.equal(video.person, person); assert.equal(video.people.length, 1);
  assert.equal(video.phrase, "Frase."); assert.equal(video.still, undefined);
  assert.equal(video.build(metronome({ bpm: 100 })).announceType, "retorno");
  const image = buildNightAnnounceTimeline({ kind: "individual", format: "feed", people: [person] });
  assert.equal(image.still, true); assert.equal(image.totalFrames, 1); assert.equal(image.height, 1350);
  const sections = [{ id: "staff", title: ["O STAFF", "STRIX."], people: [{ id: "s", name: "S" }] }, { id: "elenco", title: ["O ELENCO", "FC 27."], people: [person] }];
  const team = buildNightAnnounceTimeline({ kind: "team", format: "story", people: [person], sections, title: "PLANTEL FC 27" });
  assert.equal(team.kind, "team"); assert.equal(team.title, "PLANTEL FC 27");
  assert.deepEqual(team.people.map((item) => item.id), ["s", "p1"], "a ordem é a dos capítulos");
  assert.equal(team.night.scenes.length, 4);
  // Ninguém escolhido: não há peça.
  assert.equal(buildNightAnnounceTimeline({ kind: "team", sections: [] }).totalFrames, 0);
  assert.equal(buildNightAnnounceTimeline({ kind: "individual", people: [] }).totalFrames, 0);
});

test("o rosto sorteado é o mesmo para o mesmo dia e muda quando se sorteia de novo", () => {
  const pool = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  assert.equal(seededPick([], "x"), null);
  assert.equal(seededPick(pool, "2026-10-08:0"), seededPick(pool, "2026-10-08:0"));
  const picks = new Set(Array.from({ length: 12 }, (unused, roll) => seededPick(pool, `2026-10-08:${roll}`).id));
  assert.ok(picks.size >= 3, "sortear de novo percorre o elenco");
});
