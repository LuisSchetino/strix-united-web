import test from "node:test";
import assert from "node:assert/strict";
import { agoLabel, buildNotifications, markSeen, readSeen, rescheduleLabel, rescheduleOf } from "../src/features/notifications/notifications-core.js";
import { isForPlayer, libraryGlance } from "../src/features/library/library-glance.js";
import { endedEditions } from "../src/features/competitions/ended-editions.js";

const NOW = new Date("2026-10-04T23:20:00Z"); // 20:20 on 04/10 in São Paulo
const me = { id: "p1", display_name: "Dornellas", positions: ["ZAG"] };

test("a kick-off that moved is reported for three days, only while the game is still ahead", () => {
  const match = { id: "a1", opponent_name: "Maquina", scheduled_at: "2026-10-05T00:40:00Z", previous_scheduled_at: "2026-10-05T00:10:00Z", rescheduled_at: "2026-10-04T20:00:00Z", status: "scheduled" };
  const change = rescheduleOf(match, NOW);
  assert.deepEqual(change, { before: "2026-10-05T00:10:00Z", after: "2026-10-05T00:40:00Z" });
  assert.equal(rescheduleLabel(change), "era 21:10");
  assert.equal(rescheduleLabel({ before: "2026-10-04T00:10:00Z", after: "2026-10-05T00:40:00Z" }), "era 03/10 às 21:10");
  assert.equal(rescheduleOf({ ...match, rescheduled_at: "2026-09-30T20:00:00Z" }, NOW), null, "old news");
  assert.equal(rescheduleOf({ ...match, status: "cancelled" }, NOW), null);
  assert.equal(rescheduleOf({ ...match, scheduled_at: "2026-10-04T20:00:00Z" }, NOW), null, "already kicked off");
  assert.equal(rescheduleOf({ ...match, previous_scheduled_at: match.scheduled_at }, NOW), null, "same time");
  assert.equal(rescheduleOf({ id: "x", scheduled_at: match.scheduled_at }, NOW), null, "no columns: never reports");
});

test("notices are built from what the site holds and come newest first", () => {
  const agenda = [
    { id: "a1", opponent_name: "Maquina", scheduled_at: "2026-10-05T00:40:00Z", previous_scheduled_at: "2026-10-05T00:10:00Z", rescheduled_at: "2026-10-04T22:00:00Z", status: "scheduled", updated_at: "2026-10-04T22:00:00Z" },
  ];
  const notices = buildNotifications({
    now: NOW,
    player: me,
    mine: { starting: 1, open: 0, games: [{ id: "a1", opponent: "Maquina", position: "ZAG", scheduledAt: "2026-10-05T00:40:00Z", competition: "Amistoso" }, { id: "a2", opponent: "Outro", position: "", scheduledAt: "2026-10-05T01:10:00Z", competition: "Amistoso" }] },
    agenda,
    matches: [{ id: "m1", opponent_name: "POA City", strix_score: 2, opponent_score: 1, played_at: "2026-10-04T21:00:00Z", competition_name: "Copa" }, { id: "m0", opponent_name: "Velho", strix_score: 0, opponent_score: 0, played_at: "2026-09-20T21:00:00Z" }],
    library: { fresh: [{ id: "l1", title: "Escanteio curto", category: "jogada", published_at: "2026-10-03T18:00:00Z" }] },
    milestones: [{ playerId: "p1", id: "games-10", label: "10 jogos", at: "2026-10-04T21:00:00Z", opponent: "POA City" }, { playerId: "p2", id: "goals-10", label: "10 gols", at: "2026-10-04T21:00:00Z" }],
    notice: { id: "n1", body: "Treino às 20h.", created_at: "2026-10-04T15:00:00Z" },
    endedEditions: [{ id: "e1", name: "Copa X", outcome: "Campeão", at: "2026-10-01T00:00:00Z" }],
    canArchive: false,
  });
  // The line-up and the reschedule carry the same moment: they keep the order they were built in.
  assert.deepEqual(notices.map((item) => item.kind), ["lineup", "reschedule", "result", "milestone", "notice", "material"]);
  assert.ok(!notices.some((item) => /lista/i.test(item.title)), "being on the media list is not a notice");
  const byKind = Object.fromEntries(notices.map((item) => [item.kind, item]));
  assert.equal(byKind.reschedule.title, "Horário mudou: Maquina");
  assert.equal(byKind.reschedule.text, "Agora 04/10 às 21:40 (era 21:10).");
  assert.deepEqual(byKind.lineup.target, { page: "agenda", id: "a1" });
  assert.equal(byKind.lineup.text, "ZAG às 21:40 · Amistoso");
  assert.equal(byKind.result.title, "Strix 2 × 1 POA City");
  assert.equal(byKind.milestone.title, "Novo marco: 10 jogos");
  assert.deepEqual(byKind.material.target, { page: "biblioteca", id: "l1" });
  assert.equal(new Set(notices.map((item) => item.key)).size, notices.length, "every notice has its own key");

  const dev = buildNotifications({ now: NOW, endedEditions: [{ id: "e1", name: "Copa X", outcome: "Campeão", at: "2026-10-01T00:00:00Z" }], canArchive: true });
  assert.equal(dev[0].kind, "competition");
  assert.deepEqual(dev[0].target, { page: "campeonatos", id: "e1" });
  assert.deepEqual(buildNotifications({ now: NOW }), []);
});

test("what was seen stays seen on this device and the list is bounded", () => {
  const data = new Map();
  const storage = { getItem: (key) => (data.has(key) ? data.get(key) : null), setItem: (key, value) => data.set(key, value) };
  assert.equal(readSeen(storage).size, 0);
  assert.ok(markSeen(storage, ["a", "b"]).has("b"));
  assert.ok(readSeen(storage).has("a"));
  markSeen(storage, Array.from({ length: 400 }, (_, index) => `k${index}`));
  const seen = readSeen(storage);
  assert.equal(seen.size, 300);
  assert.ok(!seen.has("a"), "the oldest keys leave");
  assert.ok(seen.has("k399"));
  const broken = { getItem: () => "{not json", setItem: () => { throw new Error("blocked"); } };
  assert.equal(readSeen(broken).size, 0);
  assert.ok(markSeen(broken, ["x"]).has("x"), "a blocked storage does not break the bell");
});

test("when a notice happened, in words", () => {
  assert.equal(agoLabel("2026-10-04T23:19:40Z", NOW), "agora");
  assert.equal(agoLabel("2026-10-04T23:08:00Z", NOW), "há 12 min");
  assert.equal(agoLabel("2026-10-04T20:20:00Z", NOW), "há 3 h");
  assert.equal(agoLabel("2026-10-04T01:00:00Z", NOW), "ontem");
  assert.equal(agoLabel("2026-10-01T15:00:00Z", NOW), "01/10");
});

test("the Library from outside: what to resume, what is pending, what is for my position", () => {
  const items = [
    { id: "l1", title: "Em andamento", source_url: "https://youtu.be/dQw4w9WgXcQ", status: "active", published_at: "2026-09-01T00:00:00Z", focus_positions: [] },
    { id: "l2", title: "Para zagueiros", source_url: "https://youtu.be/jNQXAC9IVRw", status: "active", published_at: "2026-09-10T00:00:00Z", focus_positions: ["ZAG", "GOL"] },
    { id: "l3", title: "Novo", source_url: "https://youtu.be/jNQXAC9IVRw", status: "active", published_at: "2026-10-03T00:00:00Z" },
    { id: "l4", title: "Concluído", source_url: "https://youtu.be/jNQXAC9IVRw", status: "active", published_at: "2026-10-02T00:00:00Z" },
    { id: "l5", title: "Arquivado", source_url: "https://youtu.be/jNQXAC9IVRw", status: "archived", published_at: "2026-10-03T00:00:00Z" },
    { id: "l6", title: "Drive aberto", source_url: "https://drive.google.com/file/d/abc/view", status: "active", published_at: "2026-08-01T00:00:00Z" },
  ];
  const progress = [
    { item_id: "l1", user_id: "u1", progress_percent: 42, last_position_seconds: 201, last_accessed_at: "2026-10-03T12:00:00Z" },
    { item_id: "l4", user_id: "u1", progress_percent: 96, last_position_seconds: 500, completed_at: "2026-10-03T13:00:00Z" },
    { item_id: "l6", user_id: "u1", progress_percent: 0, last_position_seconds: 0, last_accessed_at: "2026-10-04T12:00:00Z" },
    { item_id: "l3", user_id: "someone-else", progress_percent: 100, completed_at: "2026-10-03T13:00:00Z" },
  ];
  const glance = libraryGlance({ items, progress, userId: "u1", player: me, now: NOW });
  assert.equal(glance.resume.item.id, "l1");
  assert.equal(glance.resume.position, 201);
  assert.equal(glance.resume.percent, 42);
  assert.deepEqual(glance.pending.map((entry) => [entry.item.id, entry.forYou, entry.started]), [["l2", true, false], ["l3", false, false], ["l6", false, true]]);
  assert.equal(glance.forYou, 1);
  assert.deepEqual(glance.fresh.map((item) => item.id), ["l3"]);
  assert.equal(glance.total, 5);
  assert.equal(isForPlayer({ focus_positions: ["ata"] }, { positions: ["ATA"] }), true);
  assert.equal(isForPlayer({ focus_positions: [] }, me), false);
  assert.equal(isForPlayer({ focus_positions: ["ATA"] }, null), false);
  const empty = libraryGlance({});
  assert.equal(empty.resume, null);
  assert.deepEqual(empty.pending, []);
});

test("only an edition that certainly ended for Strix is offered to the Histórico", () => {
  const editions = [{ id: "e1", competition_id: "c1", status: "active" }, { id: "e2", competition_id: "c2", status: "active" }, { id: "e3", competition_id: "c1", status: "historical" }];
  const competitions = [{ id: "c1", name: "Copa Mata-mata" }, { id: "c2", name: "Liga" }];
  const fixtures = [
    { id: "f1", edition_id: "e1", home_team_name: "Strix United", away_team_name: "Rival", home_score: 0, away_score: 2, status: "completed", round_label: "Quartas de final", scheduled_at: "2026-10-01T00:00:00Z" },
    { id: "f2", edition_id: "e2", home_team_name: "Strix United", away_team_name: "Rival", home_score: 0, away_score: 2, status: "completed", round_label: "Rodada 3", scheduled_at: "2026-10-01T00:00:00Z" },
    { id: "f3", edition_id: "e3", home_team_name: "Strix United", away_team_name: "Rival", home_score: 0, away_score: 2, status: "completed", round_label: "Semifinal", scheduled_at: "2026-09-01T00:00:00Z" },
  ];
  const ended = endedEditions({ editions, competitions, sources: [], fixtures });
  assert.deepEqual(ended.map((item) => [item.id, item.name, item.outcome]), [["e1", "Copa Mata-mata", "Eliminado nas quartas de final"]]);
});
