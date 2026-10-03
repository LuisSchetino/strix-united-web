import { encodeAgendaMp4 } from "../media/encode-mp4.js";
import { CONTRACT_SEASON } from "./contract-core.js";
import { pdfFromJpeg } from "./contract-pdf.js";

const SCALE = 2;

function sheetOf(node) {
  if (!node) return null;
  return node.classList?.contains("contract-instrument") ? node : node.querySelector?.(".contract-instrument");
}

function paintBox(ctx, element, origin) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const x = rect.left - origin.left;
  const y = rect.top - origin.top;
  const background = style.backgroundColor;
  if (background && background !== "transparent" && background !== "rgba(0, 0, 0, 0)") {
    ctx.fillStyle = background;
    ctx.fillRect(x, y, rect.width, rect.height);
  }
  const width = Number.parseFloat(style.borderTopWidth);
  if (width > 0 && style.borderTopStyle !== "none") {
    ctx.strokeStyle = style.borderTopColor;
    ctx.lineWidth = width;
    ctx.strokeRect(x + width / 2, y + width / 2, Math.max(0, rect.width - width), Math.max(0, rect.height - width));
  }
  if (element.classList?.contains("contract-instrument")) {
    ctx.strokeStyle = "rgba(255,255,255,.45)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 6.5, y + 6.5, Math.max(0, rect.width - 13), Math.max(0, rect.height - 13));
  }
}

function paintImages(ctx, sheet, origin) {
  sheet.querySelectorAll("img").forEach((image) => {
    if (!image.naturalWidth) return;
    const rect = image.getBoundingClientRect();
    const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.drawImage(
      image,
      rect.left - origin.left + (rect.width - width) / 2,
      rect.top - origin.top + (rect.height - height) / 2,
      width,
      height,
    );
  });
}

function shownWord(word, style) {
  if (style.textTransform === "uppercase") return word.toLocaleUpperCase("pt-BR");
  if (style.textTransform === "lowercase") return word.toLocaleLowerCase("pt-BR");
  return word;
}

function paintWords(ctx, sheet, origin) {
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let textNode = walker.nextNode();
  while (textNode) {
    const value = textNode.textContent || "";
    const parent = textNode.parentElement;
    if (parent && !parent.closest("svg") && value.trim()) {
      const style = getComputedStyle(parent);
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.fillStyle = style.color;
      ctx.textBaseline = "middle";
      const spacing = style.letterSpacing !== "normal" ? Number.parseFloat(style.letterSpacing) || 0 : 0;
      for (const match of value.matchAll(/\S+/g)) {
        range.setStart(textNode, match.index);
        range.setEnd(textNode, match.index + match[0].length);
        const rect = range.getBoundingClientRect();
        if (rect.width < 0.4) continue;
        const word = shownWord(match[0], style);
        const y = rect.top - origin.top + rect.height / 2;
        if (!spacing) {
          ctx.fillText(word, rect.left - origin.left, y);
        } else {
          let x = rect.left - origin.left;
          for (const character of word) {
            ctx.fillText(character, x, y);
            x += ctx.measureText(character).width + spacing;
          }
        }
      }
    }
    textNode = walker.nextNode();
  }
}

function signatureStrokes(path) {
  const commands = [...String(path.getAttribute("d") || "").matchAll(/([ML])\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
  const strokes = [];
  let current = [];
  commands.forEach(([, command, rawX, rawY]) => {
    const point = { x: Number(rawX), y: Number(rawY) };
    if (command === "M" && current.length) {
      strokes.push(current);
      current = [];
    }
    current.push(point);
  });
  if (current.length) strokes.push(current);
  return strokes.filter((stroke) => stroke.length > 1);
}

function strokeLength(stroke) {
  let total = 0;
  for (let index = 1; index < stroke.length; index += 1) {
    total += Math.hypot(stroke[index].x - stroke[index - 1].x, stroke[index].y - stroke[index - 1].y);
  }
  return total;
}

function paintSignature(ctx, sheet, origin, progress) {
  const path = sheet.querySelector(".contract-instrument-sign path");
  const svg = path?.ownerSVGElement;
  if (!path || !svg) return;
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox?.baseVal;
  const unitWidth = viewBox?.width || 600;
  const unitHeight = viewBox?.height || 200;
  const drawn = Math.max(0, Math.min(1, progress));
  const strokes = signatureStrokes(path);
  const total = strokes.reduce((sum, stroke) => sum + strokeLength(stroke), 0) || 1;
  let budget = total * drawn;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.left - origin.left, rect.top - origin.top, rect.width, rect.height);
  ctx.clip();
  ctx.translate(rect.left - origin.left, rect.top - origin.top);
  ctx.scale(rect.width / unitWidth, rect.height / unitHeight);
  ctx.strokeStyle = "#f5f5f5";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const stroke of strokes) {
    const length = strokeLength(stroke);
    ctx.moveTo(stroke[0].x, stroke[0].y);
    if (budget >= length) {
      stroke.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      budget -= length;
      continue;
    }
    let left = budget;
    for (let index = 1; index < stroke.length && left > 0; index += 1) {
      const previous = stroke[index - 1];
      const point = stroke[index];
      const segment = Math.hypot(point.x - previous.x, point.y - previous.y) || 1;
      if (left >= segment) {
        ctx.lineTo(point.x, point.y);
        left -= segment;
      } else {
        const ratio = left / segment;
        ctx.lineTo(previous.x + (point.x - previous.x) * ratio, previous.y + (point.y - previous.y) * ratio);
        left = 0;
      }
    }
    break;
  }
  ctx.stroke();
  ctx.restore();
}

async function capture(node, progress) {
  const sheet = sheetOf(node);
  if (!sheet) throw new Error("signed_contract_unavailable");
  await document.fonts?.ready;
  const origin = sheet.getBoundingClientRect();
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.ceil(origin.width * SCALE));
  canvas.height = Math.max(2, Math.ceil(origin.height * SCALE));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("signed_contract_unavailable");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#090b0d";
  ctx.fillRect(0, 0, origin.width, origin.height);
  sheet.querySelectorAll("*").forEach((element) => {
    if (element.closest("svg")) return;
    paintBox(ctx, element, origin);
  });
  paintImages(ctx, sheet, origin);
  paintSignature(ctx, sheet, origin, progress);
  paintWords(ctx, sheet, origin);
  return canvas;
}

function assertPainted(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let light = 0;
  for (let index = 0; index < data.length; index += 64) {
    if (data[index] + data[index + 1] + data[index + 2] > 90) light += 1;
  }
  if (light < 12) throw new Error("A captura do contrato saiu vazia. Deixa o contrato aberto na tela e tenta de novo.");
}

function downloadBytes(bytes, fileName, type) {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** PDF is a raster of the contract already on screen: logo, type and signature. */
export async function downloadSignedContractPdf(node, season = CONTRACT_SEASON) {
  if (!node?.querySelector && !node?.classList?.contains("contract-instrument")) {
    throw new Error("signed_contract_unavailable");
  }
  const sheet = node.classList?.contains("contract-instrument") ? node : node.querySelector(".contract-instrument");
  if (!sheet) throw new Error("signed_contract_unavailable");
  const canvas = await capture(sheet, 1);
  assertPainted(canvas);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("signed_contract_unavailable"))), "image/jpeg", 0.92);
  });
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const pdf = pdfFromJpeg(jpeg, canvas.width, canvas.height);
  downloadBytes(pdf, `strix-fc27-contrato-${String(season).replaceAll("/", "-")}.pdf`, "application/pdf");
}

/** Same sheet, with the signature drawing across the frames. */
export async function renderContractVideo(node, { onProgress, signal } = {}) {
  const sheet = node?.classList?.contains("contract-instrument") ? node : node?.querySelector?.(".contract-instrument");
  if (!sheet) throw new Error("signed_contract_unavailable");
  const fps = 30;
  const totalFrames = 60;
  const frames = [];
  for (let index = 0; index < totalFrames; index += 1) {
    if (signal?.aborted) throw new DOMException("Render cancelado.", "AbortError");
    const progress = index / (totalFrames - 1);
    const pen = Math.max(0, Math.min(1, (progress - 0.12) / 0.7));
    const drawn = 1 - (1 - pen) ** 3;
    const frame = await capture(sheet, drawn);
    if (index === totalFrames - 1) assertPainted(frame);
    frames.push(frame);
    onProgress?.({ frame: index + 1, totalFrames, ratio: (index + 1) / totalFrames });
  }
  const width = 1080;
  const height = 1920;
  const draw = (ctx, frame) => {
    ctx.fillStyle = "#090b0d";
    ctx.fillRect(0, 0, width, height);
    const scale = Math.min((width - 96) / frame.width, (height - 160) / frame.height);
    const w = Math.round(frame.width * scale);
    const h = Math.round(frame.height * scale);
    ctx.drawImage(frame, Math.round((width - w) / 2), Math.round((height - h) / 2), w, h);
  };
  try {
    return await encodeAgendaMp4({
      timeline: { width, height, fps, totalFrames, duration: totalFrames / fps },
      frameTime: (index) => index / fps,
      onProgress,
      signal,
      renderFrame: (ctx, { timeSec }) => {
        const index = Math.min(totalFrames - 1, Math.round((timeSec || 0) * fps));
        draw(ctx, frames[index]);
      },
    });
  } catch (error) {
    if (!/codec|H\.264|MP4/i.test(error?.message || "")) throw error;
    return encodeWebm(frames, width, height, fps, draw);
  }
}

function encodeWebm(frames, width, height, fps, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
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
    for (const frame of frames) {
      draw(ctx, frame);
      track.requestFrame?.();
      await new Promise((resolve) => setTimeout(resolve, Math.round(1000 / fps)));
    }
    recorder.stop();
    await stopped;
    track.stop();
    return new Blob(chunks, { type: "video/webm" });
  })();
}
