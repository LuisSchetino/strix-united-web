import test from "node:test";
import assert from "node:assert/strict";
import { describeMediaRundown } from "../src/features/media/media-rundown.js";

const now = new Date("2026-10-02T23:30:00Z");

test("a pauta lista as cinco peças, na ordem do produto, com prontidão real", () => {
  const rundown = describeMediaRundown({ agenda: [], matches: [], players: [], nightRelated: [] }, now);
  assert.deepEqual(rundown.map((item) => item.id), ["agenda", "related", "summary-day", "summary-week", "announce"]);
  assert.ok(rundown.every((item) => item.state === "empty"), "sem dados nenhuma peça se diz pronta");
  assert.equal(rundown[0].meta, "Nenhum jogo marcado hoje");
});

test("agenda e resumo ficam prontos só com dados do dia", () => {
  const workspace = {
    agenda: [{ id: "a1", scheduled_at: "2026-10-03T00:10:00Z", opponent_name: "Maquina", status: "scheduled" }],
    matches: [{ id: "m1", played_at: "2026-10-02T23:00:00Z", opponent_name: "POA", strix_score: 2, opponent_score: 1 }],
    players: [{ id: "p1", display_name: "NUNES", positions: ["MC"], is_active: true }],
    nightRelated: [],
  };
  const byId = Object.fromEntries(describeMediaRundown(workspace, now).map((item) => [item.id, item]));
  assert.equal(byId.agenda.state, "ready");
  assert.equal(byId.agenda.meta, "1 jogo hoje");
  assert.equal(byId["summary-day"].state, "ready");
  assert.equal(byId.announce.meta, "1 pessoa no elenco");
});
