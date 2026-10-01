import { encodeAgendaMp4 } from "../media/encode-mp4.js";
import { CONTRACT_COMMITMENT, CONTRACT_SEASON, SIGNATURE_VIEWBOX } from "./contract-core.js";

const WIDTH = 1080;
const HEIGHT = 1920;
const FPS = 30;
const DURATION = 2.6;

function pathLength(d) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "path");
  node.setAttribute("d", d);
  return node.getTotalLength?.() || 800;
}

function paintSignatureFrame(ctx, time, { contract, identity, length }) {
  const progress = Math.max(0, Math.min(1, (time - 0.35) / 1.7));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const stage = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  stage.addColorStop(0, "#1d2025");
  stage.addColorStop(0.55, "#0b0d10");
  stage.addColorStop(1, "#050607");
  ctx.fillStyle = stage;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const x = 72;
  const y = 280;
  const w = WIDTH - 144;
  const h = 1180;
  ctx.fillStyle = "#101318";
  ctx.strokeStyle = "rgba(255,255,255,.14)";
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = "#aeb4bb";
  ctx.font = "700 22px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("STRIX UNITED", x + 48, y + 78);
  ctx.textAlign = "right";
  ctx.fillText(`FC 27 · ${contract.season || CONTRACT_SEASON}`, x + w - 48, y + 78);
  ctx.textAlign = "left";
  ctx.strokeStyle = "rgba(255,255,255,.12)";
  ctx.beginPath();
  ctx.moveTo(x + 48, y + 108);
  ctx.lineTo(x + w - 48, y + 108);
  ctx.stroke();

  ctx.fillStyle = "#f5f5f5";
  ctx.font = "800 64px Rajdhani, Inter, sans-serif";
  ctx.fillText("CONTRATO DE VÍNCULO", x + 48, y + 210);
  ctx.fillStyle = "#8e969f";
  ctx.font = "700 18px Inter, Arial, sans-serif";
  ctx.fillText("NOME", x + 48, y + 280);
  ctx.fillText("IDENTIFICAÇÃO", x + w / 2, y + 280);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "800 32px Inter, Arial, sans-serif";
  ctx.fillText(identity?.name || "MEMBRO STRIX", x + 48, y + 324);
  ctx.fillText(identity?.handle || "—", x + w / 2, y + 324);
  ctx.fillStyle = "#d8dce0";
  ctx.font = "500 24px Inter, Arial, sans-serif";
  const words = CONTRACT_COMMITMENT.split(" ");
  let line = "";
  let lineY = y + 430;
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > w - 96) {
      ctx.fillText(line, x + 48, lineY);
      line = word;
      lineY += 36;
    } else line = next;
  });
  if (line) ctx.fillText(line, x + 48, lineY);

  const padX = x + 48;
  const padY = lineY + 48;
  const padW = w - 96;
  const padH = 280;
  ctx.fillStyle = "#07090b";
  ctx.strokeStyle = "rgba(255,255,255,.14)";
  ctx.fillRect(padX, padY, padW, padH);
  ctx.strokeRect(padX, padY, padW, padH);
  ctx.fillStyle = "#aeb4bb";
  ctx.font = "700 16px Inter, Arial, sans-serif";
  ctx.fillText("ASSINATURA REGISTRADA", padX + 24, padY + 36);

  if (!contract?.signature?.d || typeof ctx.stroke !== "function") return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(padX + 16, padY + 56, padW - 32, padH - 80);
  ctx.clip();
  ctx.translate(padX + 24, padY + 64);
  ctx.scale((padW - 48) / SIGNATURE_VIEWBOX.width, (padH - 100) / SIGNATURE_VIEWBOX.height);
  const path = new Path2D(contract.signature.d);
  ctx.strokeStyle = "#f5f5f5";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.setLineDash([length, length]);
  ctx.lineDashOffset = length * (1 - progress);
  ctx.stroke(path);
  ctx.restore();
}

export async function renderSignatureMp4({ contract, identity, onProgress, signal } = {}) {
  const length = pathLength(contract?.signature?.d || "");
  const timeline = { width: WIDTH, height: HEIGHT, fps: FPS, duration: DURATION, totalFrames: Math.round(DURATION * FPS) };
  return encodeAgendaMp4({
    timeline,
    signal,
    onProgress,
    frameTime: (index) => Math.min(DURATION, index / FPS),
    renderFrame: (ctx, { timeSec }) => paintSignatureFrame(ctx, timeSec, { contract, identity, length }),
  });
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
