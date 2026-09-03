import { easeInOutCubic } from "./agenda-timeline.js";
import { GROUP_ORDER } from "./related-night-core.js";

export const PITCH = Object.freeze({
  length: 105,
  width: 68,
  penaltyDepth: 16.5 / 105,
  penaltyHalfU: 20.16 / 68,
  goalAreaDepth: 5.5 / 105,
  goalAreaHalfU: 9.16 / 68,
  penaltySpot: 11 / 105,
  circleRu: 9.15 / 68,
  circleRv: 9.15 / 105,
  goalHalfU: 3.66 / 68,
  cornerR: 1 / 105,
});

const SECTOR_CAM = Object.freeze({
  GOL: { lookV: 0.86, lookU: 0.5, zoomAdd: 0.04, y: 16 },
  DEF: { lookV: 0.72, lookU: 0.5, zoomAdd: 0.02, y: 6 },
  MEI: { lookV: 0.48, lookU: 0.5, zoomAdd: 0, y: -4 },
  ATA: { lookV: 0.24, lookU: 0.5, zoomAdd: 0.03, y: -16 },
});

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

function separate(placed, minDist = 0.125) {
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
        left.u = Math.max(0.1, Math.min(0.9, left.u + dir * push));
        right.u = Math.max(0.1, Math.min(0.9, right.u - dir * push));
      }
    }
  }
  return next;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpCam(left, right, t) {
  const ease = easeInOutCubic(t);
  return {
    x: lerp(left.x, right.x, ease),
    y: lerp(left.y, right.y, ease),
    zoom: lerp(left.zoom, right.zoom, ease),
    lookU: lerp(left.lookU, right.lookU, ease),
    lookV: lerp(left.lookV, right.lookV, ease),
    originN: lerp(left.originN ?? 0.44, right.originN ?? 0.44, ease),
  };
}

export function distributeRelatedOnField(players = []) {
  const buckets = { GOL: [], DEF: [], MEI: [], ATA: [] };
  for (const player of players) {
    const group = buckets[player.group] ? player.group : "MEI";
    buckets[group].push(player);
  }

  const placed = [];
  placed.push(...placeLine(buckets.GOL, 0.9, buckets.GOL.length <= 1 ? 0.5 : 0.32));

  const fullbacks = buckets.DEF.filter((player) => ["LD", "LE"].includes(player.position));
  const centerBacks = buckets.DEF.filter((player) => !["LD", "LE"].includes(player.position));
  if (fullbacks.length && centerBacks.length) {
    placed.push(...placeLine(centerBacks, 0.74, centerBacks.length >= 3 ? 0.18 : 0.24));
    placed.push(...placeLine(fullbacks, 0.7, 0.08));
  } else {
    const defInset = buckets.DEF.length >= 5 ? 0.1 : buckets.DEF.length >= 4 ? 0.12 : 0.18;
    placed.push(...placeLine(buckets.DEF, 0.73, defInset));
  }

  const holding = buckets.MEI.filter((player) => player.position === "VOL");
  const mids = buckets.MEI.filter((player) => player.position === "MC");
  const wide = buckets.MEI.filter((player) => player.position === "ALA");
  const advanced = buckets.MEI.filter((player) => !["VOL", "MC", "ALA"].includes(player.position));
  if (holding.length) placed.push(...placeLine(holding, 0.58, holding.length <= 2 ? 0.28 : 0.18));
  if (mids.length) placed.push(...placeLine(mids, 0.46, mids.length <= 2 ? 0.22 : 0.16));
  if (advanced.length) placed.push(...placeLine(advanced, 0.34, advanced.length <= 2 ? 0.2 : 0.14));
  if (wide.length) placed.push(...placeLine(wide, 0.38, 0.08));
  if (!holding.length && !mids.length && !advanced.length && !wide.length && buckets.MEI.length) {
    placed.push(...placeLine(buckets.MEI, 0.44, 0.16));
  }

  const atkInset = buckets.ATA.length <= 2 ? 0.24 : 0.14;
  placed.push(...placeLine(buckets.ATA, 0.16, atkInset));

  return separate(placed);
}

export function fieldStage(timeline, camera = {}) {
  const { width, height, safe } = timeline;
  const story = timeline.format !== "feed";
  return {
    width,
    height,
    top: safe.top + (story ? 92 : 40),
    bottom: height - safe.bottom - (story ? 88 : 36),
    zoom: Number.isFinite(camera.zoom) ? camera.zoom : 1,
    lookU: Number.isFinite(camera.lookU) ? camera.lookU : 0.5,
    lookV: Number.isFinite(camera.lookV) ? camera.lookV : 0.5,
    camZ: 2.55,
    originX: width * (Number.isFinite(camera.originN) ? camera.originN : (story ? 0.44 : 0.5)),
  };
}

export function projectFieldPoint(u, v, timeline, camera = {}) {
  const stage = fieldStage(timeline, camera);
  const camZ = stage.camZ;
  const zoom = stage.zoom;
  const nearPersp = 1 / (camZ - 1);
  const farPersp = 1 / camZ;
  const persp = 1 / Math.max(0.4, camZ - v);
  const perspN = persp / nearPersp;
  const t = (persp - farPersp) / (nearPersp - farPersp);
  const lookShift = (stage.lookV - 0.5) * (stage.bottom - stage.top) * 0.2;
  const y = stage.top + (stage.bottom - stage.top) * t - lookShift + (camera.y || 0);
  const fieldW = timeline.width * 0.84 * zoom * perspN;
  const pan = (0.5 - stage.lookU) * timeline.width * 0.08;
  const x = stage.originX + (u - 0.5) * fieldW + (camera.x || 0) + pan;
  return {
    x,
    y,
    scale: perspN,
    depth: perspN,
    fieldW,
    persp,
  };
}

export function fieldQuad(timeline, camera = {}) {
  return [
    projectFieldPoint(0, 0, timeline, camera),
    projectFieldPoint(1, 0, timeline, camera),
    projectFieldPoint(1, 1, timeline, camera),
    projectFieldPoint(0, 1, timeline, camera),
  ];
}

export function pitchPolyline(samples, fn) {
  return Array.from({ length: samples + 1 }, (_, index) => fn(index / samples));
}

export function groupIndex(group) {
  const index = GROUP_ORDER.indexOf(group);
  return index < 0 ? 2 : index;
}

export function relatedNightSafeBox(timeline) {
  const { width, height, safe } = timeline;
  return {
    top: safe.top,
    bottom: height - safe.bottom,
    left: safe.side,
    right: width - safe.side,
    width: width - safe.side * 2,
    height: height - safe.top - safe.bottom,
  };
}

function playerCamera(player, index, count) {
  const sector = SECTOR_CAM[player.group] || SECTOR_CAM.MEI;
  const accum = count <= 1 ? 0 : index / (count - 1);
  const baseZoom = 1.1 - accum * 0.1;
  return {
    x: (player.u - 0.5) * -18,
    y: sector.y,
    zoom: baseZoom + sector.zoomAdd,
    lookU: 0.5 + (player.u - 0.5) * 0.08,
    lookV: sector.lookV,
    originN: 0.44,
  };
}

export function relatedNightCamera(timeline, time, extras = {}) {
  const t = Number(time) || 0;
  const count = timeline?.players?.length || 0;
  const scenes = (timeline?.scenes || []).filter((scene) => scene.type === "player");
  const introEnd = timeline?.introEnd || 0;
  const finaleStart = timeline?.finaleStart || 0;
  const story = timeline?.format !== "feed";
  const width = timeline?.width || 1080;
  const hero = Math.max(0, Math.min(1, extras.hero || 0));

  const keys = [
    { t: 0, cam: { x: 0, y: -6, zoom: 1.08, lookU: 0.5, lookV: 0.58, originN: 0.46 } },
    { t: introEnd * 0.45, cam: { x: 0, y: 2, zoom: 1.02, lookU: 0.5, lookV: 0.5, originN: 0.45 } },
    { t: introEnd, cam: { x: 0, y: 12, zoom: 1.1, lookU: 0.5, lookV: 0.86, originN: 0.44 } },
  ];

  scenes.forEach((scene, index) => {
    keys.push({
      t: scene.start + Math.min(0.22, (scene.end - scene.start) * 0.18),
      cam: playerCamera(scene.player, index, count),
    });
  });

  const lastPlayer = scenes.at(-1);
  keys.push({
    t: finaleStart,
    cam: lastPlayer
      ? playerCamera(lastPlayer.player, Math.max(0, count - 1), count)
      : { x: 0, y: 0, zoom: 1, lookU: 0.5, lookV: 0.5, originN: 0.47 },
  });
  keys.push({
    t: finaleStart + 0.9,
    cam: { x: 0, y: -8, zoom: 0.9, lookU: 0.5, lookV: 0.5, originN: 0.5 },
  });

  let cam = keys[0].cam;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const left = keys[index];
    const right = keys[index + 1];
    if (t >= right.t) {
      cam = right.cam;
      continue;
    }
    if (t < left.t) break;
    const span = Math.max(0.001, right.t - left.t);
    cam = lerpCam(left.cam, right.cam, (t - left.t) / span);
    break;
  }
  if (t >= keys.at(-1).t) cam = keys.at(-1).cam;

  return {
    x: cam.x + Math.sin(t * 0.41) * 4 - (story ? width * 0.068 : 0) * hero,
    y: cam.y + Math.sin(t * 0.33) * 2.6,
    zoom: cam.zoom * (1 + Math.sin(t * 0.37) * 0.006),
    lookU: cam.lookU,
    lookV: cam.lookV,
    originN: (cam.originN ?? (story ? 0.44 : 0.5)) - (story ? 0.05 : 0) * hero,
  };
}
