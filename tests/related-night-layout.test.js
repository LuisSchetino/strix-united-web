import test from "node:test";
import assert from "node:assert/strict";
import { orderRelated } from "../src/features/media/related-night-core.js";
import { distributeRelatedOnField, projectFieldPoint } from "../src/features/media/related-night-layout.js";
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
    assert.ok(placed.every((item) => item.v >= 0.12 && item.v <= 0.93));
  }
});

test("dois goleiros ficam no mesmo setor e ninguém vira reserva visual", () => {
  const placed = distributeRelatedOnField(sample([["GOL", 2], ["ZAG", 4], ["MC", 5], ["ATA", 2]]));
  const goals = placed.filter((item) => item.group === "GOL");
  assert.equal(goals.length, 2);
  assert.ok(Math.abs(goals[0].v - goals[1].v) < 0.02);
  assert.ok(goals.every((item) => item.v > 0.72 && item.v < 0.86));
  assert.ok(placed.every((item) => item.v <= 0.86));
});

test("projeção em perspectiva mantém profundidade", () => {
  const timeline = buildRelatedNightTimeline(sample([["GOL", 1], ["ATA", 1]]), { format: "story" });
  const near = projectFieldPoint(0.5, 0.9, timeline, { zoom: 1 });
  const far = projectFieldPoint(0.5, 0.2, timeline, { zoom: 1 });
  assert.ok(near.scale > far.scale);
  assert.ok(near.y > far.y);
});
