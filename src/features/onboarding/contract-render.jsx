import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { ContractInstrument } from "./ContractInstrument.jsx";
import { SHEET } from "./contract-art.js";
import { contractDocumentId, contractSignedLabel } from "./contract-core.js";

// The sheet behind every copy of the contract. The PDF and the video mount the
// same ContractInstrument the page shows — at its canonical 794px width, from
// the signed payload — and rasterise it here. One drawing, three outputs.

/** Mounts the still, signed sheet of  off-screen. Call dispose() when done. */
export async function mountContractSheet({ contract, identity }) {
  const props = { identity, season: contract.season, signedAtLabel: contractSignedLabel(contract.signedAt), signature: contract.signature.d, documentId: contractDocumentId(contract) };
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  Object.assign(host.style, { position: "fixed", top: "0", left: "-20000px", width: `${SHEET.width}px`, pointerEvents: "none" });
  document.body.append(host);
  const root = createRoot(host);
  flushSync(() => root.render(<ContractInstrument {...props} isStatic />));
  const dispose = () => { root.unmount(); host.remove(); };
  try {
    const sheet = host.querySelector(".contract-instrument");
    if (!sheet) throw new Error("signed_contract_unavailable");
    await settle(sheet);
    return { sheet, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

async function settle(sheet) {
  const fonts = new Set();
  const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent.trim() || !node.parentElement || node.parentElement.closest("svg")) continue;
    const style = getComputedStyle(node.parentElement);
    fonts.add(`${style.fontStyle} ${style.fontWeight} 16px ${style.fontFamily}`);
  }
  await Promise.all([...fonts].map((font) => document.fonts?.load(font).catch(() => null)));
  await document.fonts?.ready;
  await Promise.all([...sheet.querySelectorAll("img")].map((image) => (image.complete && image.naturalWidth ? null : image.decode().catch(() => null))));
  const missing = [...sheet.querySelectorAll("img")].filter((image) => !image.naturalWidth);
  if (missing.length) throw new Error("Não foi possível carregar o escudo do contrato. Verifique a conexão e tente de novo.");
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

// ------------------------------------------------------------------ painter

const LAYERS = ["seal", "signature", "pen"];

function effectiveOpacity(element, root) {
  let value = 1;
  for (let node = element; node && node !== root.parentElement; node = node.parentElement) {
    value *= Number.parseFloat(getComputedStyle(node).opacity || "1");
  }
  return value;
}

function clipRect(element, root) {
  for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/hidden|clip/.test(style.overflowX) || /hidden|clip/.test(style.overflowY)) return node.getBoundingClientRect();
  }
  return null;
}

function paintBox(ctx, element, origin) {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = rect.left - origin.left;
  const y = rect.top - origin.top;
  const background = style.backgroundColor;
  if (background && background !== "transparent" && !/rgba\(.*,\s*0\)$/.test(background)) {
    ctx.fillStyle = background;
    const radius = Number.parseFloat(style.borderTopLeftRadius) || 0;
    if (radius && ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, rect.width, rect.height, Math.min(radius, rect.width / 2, rect.height / 2));
      ctx.fill();
    } else ctx.fillRect(x, y, rect.width, rect.height);
  }
  const sides = [
    ["Top", (w) => [x, y, rect.width, w]],
    ["Bottom", (w) => [x, y + rect.height - w, rect.width, w]],
    ["Left", (w) => [x, y, w, rect.height]],
    ["Right", (w) => [x + rect.width - w, y, w, rect.height]],
  ];
  for (const [side, box] of sides) {
    const width = Number.parseFloat(style[`border${side}Width`]) || 0;
    const kind = style[`border${side}Style`];
    if (width <= 0 || kind === "none" || kind === "hidden") continue;
    ctx.fillStyle = style[`border${side}Color`];
    if (kind === "dashed" && Number.parseFloat(style.borderTopLeftRadius) > rect.width / 3) {
      // A dashed circle (the pending seal): drawn as one.
      ctx.save();
      ctx.strokeStyle = style[`border${side}Color`];
      ctx.lineWidth = width;
      ctx.setLineDash([width * 3, width * 2.5]);
      ctx.beginPath();
      ctx.arc(x + rect.width / 2, y + rect.height / 2, rect.width / 2 - width / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    }
    ctx.fillRect(...box(width));
  }
}

function paintImage(ctx, image, origin) {
  if (!image.naturalWidth) return;
  const rect = image.getBoundingClientRect();
  const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, rect.left - origin.left + (rect.width - width) / 2, rect.top - origin.top + (rect.height - height) / 2, width, height);
}

async function paintSvg(ctx, svg, origin) {
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));
  clone.removeAttribute("class");
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  await image.decode();
  ctx.drawImage(image, rect.left - origin.left, rect.top - origin.top, rect.width, rect.height);
}

function shown(word, style) {
  if (style.textTransform === "uppercase") return word.toLocaleUpperCase("pt-BR");
  if (style.textTransform === "lowercase") return word.toLocaleLowerCase("pt-BR");
  return word;
}

/** Each word at its laid-out box, on its own baseline. Returns the words for the PDF text layer. */
function paintText(ctx, node, origin, root, words) {
  const value = node.textContent || "";
  const parent = node.parentElement;
  if (!parent || !value.trim()) return;
  const style = getComputedStyle(parent);
  const range = document.createRange();
  const clip = clipRect(parent, root);
  ctx.save();
  if (clip) {
    ctx.beginPath();
    ctx.rect(clip.left - origin.left, clip.top - origin.top, clip.width, clip.height);
    ctx.clip();
  }
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  ctx.fillStyle = style.color;
  ctx.textBaseline = "alphabetic";
  const spacing = style.letterSpacing !== "normal" ? Number.parseFloat(style.letterSpacing) || 0 : 0;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${spacing}px`;
  for (const match of value.matchAll(/\S+/g)) {
    range.setStart(node, match.index);
    range.setEnd(node, match.index + match[0].length);
    const rects = range.getClientRects();
    const rect = rects[0];
    if (!rect || rect.width < 0.4) continue;
    const word = shown(match[0], style);
    const metrics = ctx.measureText(word);
    const ascent = metrics.fontBoundingBoxAscent ?? Number.parseFloat(style.fontSize) * 0.8;
    const x = rect.left - origin.left;
    const y = rect.top - origin.top + ascent;
    if ("letterSpacing" in ctx || !spacing) ctx.fillText(word, x, y);
    else {
      let cursor = x;
      for (const character of word) {
        ctx.fillText(character, cursor, y);
        cursor += ctx.measureText(character).width + spacing;
      }
    }
    words?.push({ text: word, x, y, size: Number.parseFloat(style.fontSize), width: rect.width, bold: Number(style.fontWeight) >= 600 });
  }
  ctx.restore();
}

async function paintTree(ctx, root, origin, { skip = [], words = null } = {}) {
  const elements = [root, ...root.querySelectorAll("*")];
  for (const element of elements) {
    if (element !== root && element.closest("svg") && element.tagName.toLowerCase() !== "svg") continue;
    const layer = element.closest("[data-layer]");
    if (layer && skip.includes(layer.dataset.layer) && root.contains(layer) && layer !== root) continue;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const opacity = effectiveOpacity(element, root);
    if (opacity <= 0.001) continue;
    ctx.save();
    ctx.globalAlpha = opacity;
    if (element.tagName.toLowerCase() === "svg") {
      if (element.hasAttribute("data-capture")) await paintSvg(ctx, element, origin);
      ctx.restore();
      continue;
    }
    paintBox(ctx, element, origin);
    if (element.tagName.toLowerCase() === "img") paintImage(ctx, element, origin);
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) paintText(ctx, child, origin, root, words);
    }
    ctx.restore();
  }
}

function canvasFor(width, height, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(width * scale));
  canvas.height = Math.max(2, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível para gerar o contrato.");
  ctx.scale(scale, scale);
  return { canvas, ctx };
}

const relative = (element, origin) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
};

/**
 * The sheet in layers, in sheet pixels (794 wide) × `scale`:
 *  - paper: everything but the signature and the seal;
 *  - seal: the stamp alone, with its box on the sheet;
 *  - signature: the box the stroke is drawn in (viewBox 600×200, meet).
 * `flatten` paints the full signature and the seal onto the paper as well.
 */
export async function captureContractSheet(sheet, { scale = 2, flatten = false, signature = "" } = {}) {
  const origin = sheet.getBoundingClientRect();
  const words = [];
  const paper = canvasFor(origin.width, origin.height, scale);
  paper.ctx.fillStyle = "#f5f1e7";
  paper.ctx.fillRect(0, 0, origin.width, origin.height);
  await paintTree(paper.ctx, sheet, origin, { skip: LAYERS, words });

  const sealElement = sheet.querySelector('[data-layer="seal"]');
  let seal = null;
  if (sealElement) {
    const box = relative(sealElement, origin);
    const layer = canvasFor(box.width, box.height, scale);
    await paintTree(layer.ctx, sealElement, sealElement.getBoundingClientRect());
    seal = { canvas: layer.canvas, ...box };
  }
  const inkElement = sheet.querySelector('[data-layer="signature"]');
  const sign = inkElement ? relative(inkElement, origin) : null;

  if (flatten) {
    if (sign && signature) drawInk(paper.ctx, sign, signature);
    if (seal) paper.ctx.drawImage(seal.canvas, seal.x, seal.y, seal.width, seal.height);
  }
  return { width: origin.width, height: origin.height, scale, paper: paper.canvas, seal, sign, words };
}

/** Ink in the signature box: same viewBox fit and stroke as the page's <svg>. */
export function drawInk(ctx, box, d, color = "#1b2546") {
  if (!d || typeof Path2D === "undefined") return;
  const k = Math.min(box.width / 600, box.height / 200);
  ctx.save();
  ctx.translate(box.x + (box.width - 600 * k) / 2, box.y + (box.height - 200 * k) / 2);
  ctx.scale(k, k);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(d));
  ctx.restore();
}
