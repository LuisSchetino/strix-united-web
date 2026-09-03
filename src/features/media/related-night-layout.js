import { GROUP_ORDER } from "./related-night-core.js";

function lineUs(count, inset) {
  if (count <= 0) return [];
  if (count === 1) return [0.5];
  return Array.from({ length: count }, (_, index) => inset + ((1 - inset * 2) * index) / (count - 1));
}

function placeLine(players, v, inset) {
  const us = lineUs(players.length, inset);
  return players.map((player, index) => ({
    ...player,
    u: us[index],
    v,
  }));
}

function separate(placed, minDist = 0.1) {
  const next = placed.map((item) => ({ ...item }));
  for (let pass = 0; pass < 4; pass += 1) {
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const left = next[i];
        const right = next[j];
        if (Math.abs(left.v - right.v) > 0.08) continue;
        const dx = left.u - right.u;
        const dist = Math.abs(dx);
        if (dist >= minDist) continue;
        const push = (minDist - dist) / 2;
        const dir = dx === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(dx);
        left.u = Math.max(0.08, Math.min(0.92, left.u + dir * push));
        right.u = Math.max(0.08, Math.min(0.92, right.u - dir * push));
      }
    }
  }
  return next;
}

export function distributeRelatedOnField(players = []) {
  const buckets = { GOL: [], DEF: [], MEI: [], ATA: [] };
  for (const player of players) {
    const group = buckets[player.group] ? player.group : "MEI";
    buckets[group].push(player);
  }

  const placed = [];
  const goalInset = buckets.GOL.length <= 1 ? 0.5 : 0.3;
  placed.push(...placeLine(buckets.GOL, 0.78, buckets.GOL.length <= 1 ? 0.5 : goalInset));

  const defInset = buckets.DEF.length >= 5 ? 0.08 : buckets.DEF.length >= 4 ? 0.1 : 0.16;
  placed.push(...placeLine(buckets.DEF, 0.6, defInset));

  const holding = buckets.MEI.filter((player) => ["VOL", "MC"].includes(player.position));
  const advanced = buckets.MEI.filter((player) => !["VOL", "MC"].includes(player.position));
  if (buckets.MEI.length <= 3) {
    placed.push(...placeLine(buckets.MEI, 0.42, 0.16));
  } else if (holding.length && advanced.length) {
    placed.push(...placeLine(holding, 0.5, holding.length <= 2 ? 0.22 : 0.14));
    placed.push(...placeLine(advanced, 0.34, advanced.length <= 2 ? 0.14 : 0.08));
  } else {
    const mid = Math.ceil(buckets.MEI.length / 2);
    placed.push(...placeLine(buckets.MEI.slice(0, mid), 0.5, 0.16));
    placed.push(...placeLine(buckets.MEI.slice(mid), 0.34, 0.1));
  }

  const atkInset = buckets.ATA.length <= 2 ? 0.22 : 0.12;
  placed.push(...placeLine(buckets.ATA, 0.16, atkInset));

  return separate(placed);
}

export function projectFieldPoint(u, v, timeline, camera = {}) {
  const { width, height, safe } = timeline;
  const zoom = Number.isFinite(camera.zoom) ? camera.zoom : 1;
  const top = safe.top + (timeline.format === "feed" ? 36 : 56) + (camera.y || 0);
  const bottom = height - safe.bottom - (timeline.format === "feed" ? 70 : 110) + (camera.y || 0);
  const depth = 0.4 + v * 0.6;
  const fieldW = width * 0.9 * depth * zoom;
  const y = top + (bottom - top) * (v ** 1.12);
  const x = width / 2 + (u - 0.5) * fieldW + (camera.x || 0);
  return {
    x,
    y,
    scale: 0.5 + v * 0.58,
    depth,
  };
}

export function fieldQuad(timeline, camera = {}) {
  const corners = [
    projectFieldPoint(0, 0, timeline, camera),
    projectFieldPoint(1, 0, timeline, camera),
    projectFieldPoint(1, 1, timeline, camera),
    projectFieldPoint(0, 1, timeline, camera),
  ];
  return corners;
}

export function groupIndex(group) {
  const index = GROUP_ORDER.indexOf(group);
  return index < 0 ? 2 : index;
}
