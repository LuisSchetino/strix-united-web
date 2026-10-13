import assert from "node:assert/strict";
import { test } from "node:test";
import { energyCurve, estimateBeat, findEntry, onsetEnvelope, planExcerpt, warpToBeats } from "../src/features/media/music-core.js";

const RATE = 22050;
/** A click track: a short low thump every beat, louder from `loudFrom` seconds on. */
function song({ bpm = 128, seconds = 40, offset = 0.13, loudFrom = Infinity }) {
  const samples = new Float32Array(Math.round(seconds * RATE));
  const beat = 60 / bpm;
  for (let t = offset; t < seconds; t += beat) {
    const level = t >= loudFrom ? 0.9 : 0.25;
    const start = Math.round(t * RATE);
    for (let i = 0; i < 1800 && start + i < samples.length; i += 1) samples[start + i] += level * Math.sin(2 * Math.PI * 70 * i / RATE) * Math.exp(-i / 500);
  }
  return samples;
}

test("acha o andamento e onde a batida cai", () => {
  for (const bpm of [96, 128, 150]) {
    const found = estimateBeat(onsetEnvelope(song({ bpm }), RATE));
    assert.ok(Math.abs(found.bpm - bpm) < 0.25, `bpm ${found.bpm} para ${bpm}`);
    // A beat falls on the click (offset 0.13 s), give or take a few hundredths.
    const beat = 60 / bpm;
    const distance = Math.abs(((found.first - 0.13) % beat + beat + beat / 2) % beat - beat / 2);
    assert.ok(distance < 0.03, `fase ${found.first} (distância ${distance})`);
    assert.ok(found.confidence > 0.5);
  }
});

test("acha onde a música entra de vez", () => {
  const samples = song({ seconds: 60, loudFrom: 24 });
  const entry = findEntry(energyCurve(samples, RATE), { length: 20 });
  assert.ok(Math.abs(entry - 24) <= 1, `entrada em ${entry}`);
});

test("o trecho começa numa batida e a entrada da música cai no primeiro corte do vídeo", () => {
  const beat = 60 / 120;
  const plan = planExcerpt({ entry: 24.3, beat, downbeat: 0.1, cue: 2.6, songLength: 180, videoLength: 20 });
  // Entry goes to the bar line at 24.1; 2.6 s of opening is 5 beats.
  assert.equal(plan.cueBeats, 5);
  assert.ok(Math.abs(plan.start - (24.1 - 5 * beat)) < 1e-6);
  // A song that comes in right at its start still gives a start that is not negative.
  assert.ok(planExcerpt({ entry: 0.6, beat, downbeat: 0.1, cue: 2.6 }).start >= 0);
});

test("as trocas de cena vão para a batida mais próxima e nada é cortado", () => {
  const beat = 0.5;
  const warp = warpToBeats([0, 2.6, 6.1, 9.6, 14.6], beat);
  assert.deepEqual(warp.targets, [0, 2.5, 6, 9.5, 14.5]);
  assert.equal(warp.duration, 14.5);
  assert.equal(warp.toSource(0), 0);
  assert.equal(warp.toSource(2.5), 2.6);
  assert.equal(warp.toSource(14.5), 14.6);
  // Inside a scene time runs evenly, and it never goes backwards.
  let last = -1;
  for (let t = 0; t <= 14.5; t += 0.1) { const s = warp.toSource(t); assert.ok(s >= last); last = s; }
  // Two changes that would land on the same beat stay one beat apart.
  assert.deepEqual(warpToBeats([0, 1.0, 1.1, 3], beat).targets, [0, 1, 1.5, 3]);
  // The first cut can be told how many beats in it must fall.
  assert.deepEqual(warpToBeats([0, 2.6, 6.1], beat, { firstBeats: 4 }).targets, [0, 2, 6]);
});
