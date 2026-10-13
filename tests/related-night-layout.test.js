import test from "node:test";
import assert from "node:assert/strict";
import { orderRelated } from "../src/features/media/related-night-core.js";
import { distributeRelatedOnField, projectFieldPoint, relatedNightCamera, PITCH } from "../src/features/media/related-night-layout.js";
import { buildRelatedNightTimeline } from "../src/features/media/related-night-timeline.js";

function sample(spec) {
  const players = [];
  let index = 0;
  for (const [position, count] of spec) {
    for (let i = 0; i < count; i += 1) {
      const group = position === "GOL" ? "GOL" : position === "ZAG" ? "DEF" : position === "ATA" ? "ATA" : "MEI";
      players.push({
        id: `p${index}`,
        name: `${position} ${i + 1}`,
        photo: "",
        position,
        group,
      });
      index += 1;
    }
  }
  return orderRelated(players);
}

function overlaps(placed) {
  return placed.some((left, i) => placed.some((right, j) => {
    if (j <= i) return false;
    const du = Math.abs(left.u - right.u);
    const dv = Math.abs(left.v - right.v);
    return du < 0.08 && dv < 0.07;
  }));
}

test("11, 13 e 15 relacionados cabem no campo sem overlap", () => {
  const packs = [
    sample([["GOL", 1], ["ZAG", 3], ["VOL", 1], ["MC", 2], ["ALA", 2], ["ATA", 2]]),
    sample([["GOL", 2], ["ZAG", 4], ["VOL", 1], ["MC", 2], ["MEI", 1], ["ALA", 1], ["ATA", 2]]),
    sample([["GOL", 2], ["ZAG", 5], ["VOL", 2], ["MC", 2], ["ALA", 2], ["ATA", 2]]),
  ];
  assert.equal(packs[0].length, 11);
  assert.equal(packs[1].length, 13);
  assert.equal(packs[2].length, 15);
  for (const pack of packs) {
    const placed = distributeRelatedOnField(pack);
    assert.equal(placed.length, pack.length);
    assert.equal(placed.filter((item) => item.group === "GOL").length, pack.filter((item) => item.group === "GOL").length);
    assert.ok(!overlaps(placed), `overlap em ${pack.length}`);
    assert.ok(placed.every((item) => item.u >= 0.07 && item.u <= 0.93));
    assert.ok(placed.every((item) => item.v >= 0.1 && item.v <= 0.94));
  }
});

test("dois goleiros ficam no mesmo setor e ninguém vira reserva visual", () => {
  const placed = distributeRelatedOnField(sample([["GOL", 2], ["ZAG", 4], ["MC", 5], ["ATA", 2]]));
  const goals = placed.filter((item) => item.group === "GOL");
  assert.equal(goals.length, 2);
  assert.ok(Math.abs(goals[0].v - goals[1].v) < 0.02);
  assert.ok(goals.every((item) => item.v > 0.86 && item.v < 0.94));
  assert.ok(placed.every((item) => item.v <= 0.94));
});

test("projeção em perspectiva mantém profundidade", () => {
  const timeline = buildRelatedNightTimeline(sample([["GOL", 1], ["ATA", 1]]), { format: "story" });
  const near = projectFieldPoint(0.5, 1, timeline, { zoom: 1 });
  const far = projectFieldPoint(0.5, 0.2, timeline, { zoom: 1 });
  assert.ok(near.scale > far.scale);
  assert.ok(near.y > far.y);
  assert.ok(near.fieldW > far.fieldW);
  assert.ok(near.fieldW > timeline.width * 0.7);
  const boxEdge = PITCH.penaltyDepth;
  assert.ok(boxEdge > 0.14 && boxEdge < 0.18);
});

test("câmera começa próxima e abre no final", () => {
  const timeline = buildRelatedNightTimeline(sample([["GOL", 2], ["ZAG", 4], ["MC", 5], ["ATA", 2]]), { format: "story" });
  const first = timeline.scenes.find((scene) => scene.type === "player");
  const early = relatedNightCamera(timeline, first.start + 0.3);
  const finale = relatedNightCamera(timeline, timeline.duration - 0.2);
  assert.ok(early.zoom > finale.zoom);
  assert.ok(early.lookV > finale.lookV);
});

test("line-up board: holding midfielder behind the midfield line, wing-backs on the flanks", async () => {
  const { lineupBoardPositions } = await import("../src/features/media/related-night-layout.js");
  const squad = [
    { id: "g", position: "GOL", group: "GOL" },
    { id: "z1", position: "ZAG", group: "DEF" }, { id: "z2", position: "ZAG", group: "DEF" }, { id: "z3", position: "ZAG", group: "DEF" },
    { id: "v", position: "VOL", group: "MEI" },
    { id: "m1", position: "MC", group: "MEI" }, { id: "m2", position: "MC", group: "MEI" },
    { id: "al", position: "ALA", group: "MEI" }, { id: "ar", position: "ALA", group: "MEI" },
    { id: "a1", position: "ATA", group: "ATA" }, { id: "a2", position: "ATA", group: "ATA" },
  ];
  const spots = Object.fromEntries(lineupBoardPositions(squad).map((spot, index) => [squad[index].id, spot]));
  assert.ok(spots.v.v > spots.m1.v, "o volante fica atrás dos meias");
  assert.equal(spots.m1.v, spots.al.v, "alas na linha dos meias");
  assert.ok(spots.al.u < 0.15 && spots.ar.u > 0.85, "um ala em cada lateral");
  assert.ok(spots.m1.u > spots.al.u && spots.m2.u < spots.ar.u, "meias por dentro dos alas");
  assert.ok(spots.g.v > spots.z1.v && spots.z1.v > spots.v.v && spots.m1.v > spots.a1.v, "do gol ao ataque");
  const crowded = Array.from({ length: 6 }, (_, index) => ({ id: `d${index}`, position: "ZAG", group: "DEF" }));
  const rows = new Set(lineupBoardPositions(crowded).map((spot) => spot.v));
  assert.equal(rows.size, 2, "linha cheia vira duas fileiras");
});
