import { encodeAgendaMp4 } from "../media/encode-mp4.js";
import { captureContractSheet, drawInk, mountContractSheet } from "./contract-render.jsx";
import { CONTRACT_CREST } from "./ContractInstrument.jsx";
import { PEN_SVG, SHEET } from "./contract-art.js";
import { SIGNATURE_VIEWBOX, contractDocumentId } from "./contract-core.js";
import { PEN_LEAD, PEN_TAIL, inkPath, penPose, signatureAt, signatureTimeline } from "./signature-motion.js";

// The signing film: the same sheet the page shows, shot like a title sequence.
// The paper rises into frame, the camera pushes in on the signature box, the
// pen writes the stored stroke, the camera crosses to the club's stamp, the
// stamp lands, and the camera pulls back over the finished document.

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const PAPER_WIDTH = 960;
const BASE = PAPER_WIDTH / SHEET.width;

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - clamp(t)) ** 3;
const span = (time, start, end) => clamp((time - start) / Math.max(0.0001, end - start));
const mix = (a, b, t) => a + (b - a) * t;

async function loadImage(src) {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image;
}

/** Stamp scale/opacity/blur over its 0.62s, matching the page's keyframes. */
function stampAt(local) {
  if (local <= 0) return { scale: 1.9, alpha: 0, blur: 4 };
  if (local < 0.55) { const t = easeOut(local / 0.55); return { scale: mix(1.9, 0.94, t), alpha: t, blur: mix(4, 0, t) }; }
  if (local < 0.78) { const t = easeInOut((local - 0.55) / 0.23); return { scale: mix(0.94, 1.025, t), alpha: 1, blur: 0 }; }
  const t = easeInOut(clamp((local - 0.78) / 0.22));
  return { scale: mix(1.025, 1, t), alpha: 1, blur: 0 };
}

function plan(sheet, timeline) {
  const signCenter = { x: sheet.sign.x + sheet.sign.width / 2, y: sheet.sign.y + sheet.sign.height / 2 };
  const sealCenter = sheet.seal ? { x: sheet.seal.x + sheet.seal.width / 2, y: sheet.seal.y + sheet.seal.height / 2 } : signCenter;
  const page = { x: SHEET.width / 2, y: SHEET.height / 2 };
  const penStart = 1.75;
  const writeEnd = penStart + PEN_LEAD + timeline.duration + PEN_TAIL;
  const stamp = writeEnd + 0.4;
  const pull = [stamp + 0.95, stamp + 2.0];
  const end = [pull[1] + 0.15, pull[1] + 1.0];
  return { signCenter, sealCenter, page, penStart, writeEnd, stamp, pull, end, duration: end[1] + 1.5 };
}

/** Camera focus (sheet units) and zoom at `time`. */
function cameraAt(time, shot, pen) {
  const { signCenter, sealCenter, page, writeEnd, stamp, pull, end } = shot;
  const signZoom = 2.2;
  const sealZoom = 2.5;
  let focus = page;
  let zoom = 1;
  const toSign = easeInOut(span(time, 1.0, 1.8));
  focus = { x: mix(page.x, signCenter.x, toSign), y: mix(page.y, signCenter.y, toSign) };
  zoom = mix(1, signZoom, toSign);
  if (pen && time > 1.8 && time < writeEnd) focus = { x: mix(signCenter.x, pen.x, 0.22), y: signCenter.y };
  const toSeal = easeInOut(span(time, writeEnd - 0.2, stamp + 0.05));
  if (toSeal > 0) {
    const from = pen ? { x: mix(signCenter.x, pen.x, 0.22), y: signCenter.y } : signCenter;
    focus = { x: mix(from.x, sealCenter.x, toSeal), y: mix(from.y, sealCenter.y, toSeal) };
    zoom = mix(signZoom, sealZoom, toSeal);
  }
  const back = easeInOut(span(time, pull[0], pull[1]));
  if (back > 0) {
    focus = { x: mix(sealCenter.x, page.x, back), y: mix(sealCenter.y, page.y, back) };
    zoom = mix(sealZoom, 1, back);
  }
  const settle = easeInOut(span(time, end[0], end[1]));
  if (settle > 0) {
    zoom = mix(1, 0.86, settle);
    focus = { x: page.x, y: page.y + 150 * settle };
  }
  return { focus, zoom };
}

function paintStage(ctx, time) {
  const stage = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  stage.addColorStop(0, "#15181d");
  stage.addColorStop(0.55, "#0a0c0f");
  stage.addColorStop(1, "#040506");
  ctx.fillStyle = stage;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const drift = Math.sin(time * 0.6) * 60;
  const light = ctx.createRadialGradient(WIDTH / 2 + drift, HEIGHT * 0.42, 40, WIDTH / 2, HEIGHT * 0.45, 980);
  light.addColorStop(0, "rgba(255,255,255,0.10)");
  light.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function paintFrame(ctx, time, assets) {
  const { sheet, shot, timeline, pen, crest, contract, identity, documentId } = assets;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  paintStage(ctx, time);

  const penTime = time - shot.penStart - PEN_LEAD;
  const writing = time >= shot.penStart;
  const ink = writing ? signatureAt(timeline, clamp(penTime, -1, timeline.duration)).ink : [];
  const pose = writing ? penPose(timeline, penTime) : null;
  const k = Math.min(sheet.sign.width / SIGNATURE_VIEWBOX.width, sheet.sign.height / SIGNATURE_VIEWBOX.height);
  const ox = sheet.sign.x + (sheet.sign.width - SIGNATURE_VIEWBOX.width * k) / 2;
  const oy = sheet.sign.y + (sheet.sign.height - SIGNATURE_VIEWBOX.height * k) / 2;
  const tip = pose ? { x: ox + pose.x * k, y: oy + pose.y * k } : null;
  const { focus: aim, zoom } = cameraAt(time, shot, tip);
  // Pushed in, the frame never leaves the paper: the focus is held inside its edges.
  const halfW = WIDTH / (2 * BASE * zoom);
  const halfH = HEIGHT / (2 * BASE * zoom);
  const focus = zoom > 1 ? {
    x: halfW < SHEET.width / 2 ? clamp(aim.x, halfW, SHEET.width - halfW) : aim.x,
    y: halfH < SHEET.height / 2 ? clamp(aim.y, halfH, SHEET.height - halfH) : aim.y,
  } : aim;

  // Entrance: the paper rises, straightens and comes into focus.
  const rise = easeOut(span(time, 0, 1.05));
  const stampLocal = (time - shot.stamp) / 0.62;
  const impact = stampLocal > 0.5 ? Math.max(0, 1 - (stampLocal - 0.5) / 0.6) : 0;
  const shake = impact * 5 * Math.sin(time * 90);
  const scale = BASE * zoom * mix(0.9, 1, rise);

  ctx.save();
  ctx.globalAlpha = rise;
  ctx.translate(WIDTH / 2 + shake, HEIGHT * 0.5 + (1 - rise) * 420 + impact * 3);
  ctx.rotate((1 - rise) * -0.05);
  ctx.scale(scale, scale);
  ctx.translate(-focus.x, -focus.y);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 60 / scale;
  ctx.shadowOffsetY = 24 / scale;
  ctx.fillStyle = "#f5f1e7";
  ctx.fillRect(0, 0, SHEET.width, SHEET.height);
  ctx.restore();
  ctx.drawImage(sheet.paper, 0, 0, SHEET.width, SHEET.height);

  if (ink.length) drawInk(ctx, sheet.sign, inkPath(ink));
  if (time > shot.writeEnd) drawInk(ctx, sheet.sign, contract.signature.d);

  if (sheet.seal && stampLocal > 0) {
    const stamp = stampAt(clamp(stampLocal));
    const cx = sheet.seal.x + sheet.seal.width / 2;
    const cy = sheet.seal.y + sheet.seal.height / 2;
    ctx.save();
    ctx.globalAlpha *= stamp.alpha;
    if (stamp.blur > 0.05 && "filter" in ctx) ctx.filter = `blur(${(stamp.blur * scale).toFixed(2)}px)`;
    ctx.translate(cx, cy);
    ctx.scale(stamp.scale, stamp.scale);
    ctx.drawImage(sheet.seal.canvas, -sheet.seal.width / 2, -sheet.seal.height / 2, sheet.seal.width, sheet.seal.height);
    ctx.restore();
    const ring = span(time, shot.stamp + 0.26, shot.stamp + 1.16);
    if (ring > 0 && ring < 1) {
      ctx.save();
      ctx.globalAlpha = 0.32 * (1 - ring);
      ctx.strokeStyle = "#1b2546";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, sheet.seal.width * 0.46 * mix(0.96, 1.32, easeOut(ring)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // One light crosses the finished paper.
  const sweep = span(time, shot.pull[1] - 0.35, shot.pull[1] + 0.95);
  if (sweep > 0 && sweep < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SHEET.width, SHEET.height);
    ctx.clip();
    const x = mix(-SHEET.width, SHEET.width * 1.6, easeInOut(sweep));
    const band = ctx.createLinearGradient(x, 0, x + SHEET.width * 0.5, SHEET.height * 0.2);
    band.addColorStop(0, "rgba(255,255,255,0)");
    band.addColorStop(0.5, "rgba(255,255,255,0.5)");
    band.addColorStop(1, "rgba(255,255,255,0)");
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, SHEET.width, SHEET.height);
    ctx.restore();
  }

  if (pose && pose.opacity > 0.01) {
    const size = 150;
    const lift = pose.lift;
    ctx.save();
    ctx.globalAlpha *= pose.opacity;
    ctx.shadowColor = "rgba(10,12,16,0.32)";
    ctx.shadowOffsetX = (3 + lift * 12) * scale;
    ctx.shadowOffsetY = (4 + lift * 14) * scale;
    ctx.shadowBlur = (2.5 + lift * 6) * 2 * scale;
    ctx.drawImage(pen, tip.x - size * 0.05, tip.y - size * 0.95, size, size);
    ctx.restore();
  }
  ctx.restore();

  // Closing card under the document.
  const card = easeOut(span(time, shot.end[0] + 0.2, shot.end[1] + 0.3));
  if (card > 0) {
    ctx.save();
    ctx.globalAlpha = card;
    const y = HEIGHT - 300 + (1 - card) * 30;
    ctx.drawImage(crest, WIDTH / 2 - 36, y - 36, 72, 72);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f5f5f2";
    ctx.font = "900 44px Inter, Arial, sans-serif";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "6px";
    ctx.fillText("VÍNCULO REGISTRADO", WIDTH / 2, y + 96);
    ctx.font = "700 22px Inter, Arial, sans-serif";
    ctx.fillStyle = "rgba(245,245,242,0.62)";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "4px";
    ctx.fillText(`${String(identity?.name || "").toLocaleUpperCase("pt-BR")} · ${documentId}`, WIDTH / 2, y + 140);
    ctx.restore();
  }
}

/** The signing film for a signed contract, from its payload. */
export async function renderContractVideo({ contract, identity } = {}, { onProgress, signal } = {}) {
  if (!contract?.signature?.d) throw new Error("signed_contract_unavailable");
  const documentId = contractDocumentId(contract);
  const mounted = await mountContractSheet({ contract, identity });
  let sheet;
  try {
    sheet = await captureContractSheet(mounted.sheet, { scale: 3 });
  } finally {
    mounted.dispose();
  }
  if (!sheet.sign) throw new Error("signed_contract_unavailable");
  const [pen, crest] = await Promise.all([
    loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(PEN_SVG)}`),
    loadImage(CONTRACT_CREST),
  ]);
  const timeline = signatureTimeline(contract.signature.d);
  const shot = plan(sheet, timeline);
  const totalFrames = Math.round(shot.duration * FPS);
  const assets = { sheet, shot, timeline, pen, crest, contract, identity, documentId };
  try {
    return await encodeAgendaMp4({
      timeline: { width: WIDTH, height: HEIGHT, fps: FPS, totalFrames, duration: shot.duration },
      frameTime: (index) => index / FPS,
      onProgress,
      signal,
      renderFrame: (ctx, { timeSec }) => paintFrame(ctx, timeSec || 0, assets),
    });
  } catch (error) {
    if (!/codec|H\.264|MP4/i.test(error?.message || "")) throw error;
    return encodeWebm(totalFrames, (ctx, index) => paintFrame(ctx, index / FPS, assets));
  }
}

function encodeWebm(totalFrames, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d", { alpha: false });
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((item) => MediaRecorder.isTypeSupported?.(item));
  if (!mime || !ctx) throw new Error("Este navegador não conseguiu gerar o vídeo do contrato.");
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();
  return (async () => {
    for (let index = 0; index < totalFrames; index += 1) {
      draw(ctx, index);
      track.requestFrame?.();
      await new Promise((resolve) => setTimeout(resolve, Math.round(1000 / FPS)));
    }
    recorder.stop();
    await stopped;
    track.stop();
    return new Blob(chunks, { type: "video/webm" });
  })();
}
