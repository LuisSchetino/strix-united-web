// Anúncios FC27 in the "night vision" model. One person: his face comes up, the headline lands,
// then his name takes its place and the sentence comes after it. The team: the title, each
// chapter's card, each person one at a time, and everyone on one screen. The feed format is one
// image: the settled frame of the same piece. The shared parts are night-kit.js; the timing is
// night-plan.js `planNightAnnounce` / `planNightSquad`.
import {
  F, GOTHIC, RASTRO_BLUE, WIDE, asWritten, close, dashes, drawBand, drawCrest, drawFace, fit, widthOf, flareAt, geometry, gothic, inCubic, lettersOnly, linear, open,
  pad2, ramp, readout, shade, wrapLines, write,
} from "./night-kit.js";

// Whose picture a person wears: their own, or none. Never another one's by position in a list
// (the pictures are loaded in the order people were picked; the film runs in its chapters).
const photoOf = (assets, person) => assets?.byId?.[person?.id]?.bitmap || null;

// The headline of an individual announcement, by what it announces. No numerals: the blackletter's are not used.
const HEADLINE = { retorno: ["De Volta", "ao Strix"], renovacao: ["Renovado", "com o Strix"] };
const TYPE_LABEL = { jogador: "JOGADOR", retorno: "RETORNO", renovacao: "RENOVAÇÃO", novo: "REFORÇO", staff: "STAFF", diretoria: "DIRETORIA", conselho: "CONSELHO", manager: "MANAGER" };
const FIRST = "ANÚNCIO OFICIAL\nSTRIX UNITED";

/** What is written over a name: where he plays and his number, or his place in the club's structure. */
function roleOf(person = {}) {
  if (person.extraBadge) return person.extraBadge;
  const number = person.number !== "" && person.number != null ? `Nº ${pad2(person.number)}` : "";
  return [person.position || "", number].filter(Boolean).join("   ·   ") || "STRIX UNITED";
}

/** A name over the band, with its role above it and, from `phraseAt`, a sentence above both. */
function nameBlock(ctx, g, t, at, person, { phrase = "", phraseAt = Infinity } = {}) {
  const raw = String(person?.name || ""), plain = lettersOnly(raw), shown = plain ? asWritten(raw) : raw.toUpperCase();
  const family = plain ? GOTHIC : WIDE;
  const size = Math.min(250 * g.s, fit(ctx, shown, family, plain ? 700 : 900, plain ? "normal" : "semi-expanded", g.width - 150, 250));
  const top = g.band - size - 110 * g.k, soft = 1 - ramp(t, at, 0.27), roleTop = top - 44 * g.s;
  shade(ctx, g, roleTop, ramp(t, at, 0.3, linear));
  readout(ctx, roleOf(person), 78, roleTop, 22 * g.s, { color: RASTRO_BLUE, alpha: ramp(t, at + 0.07, 0.25) });
  if (plain) gothic(ctx, shown, 74, top, size, { soft });
  else write(ctx, shown, 74, top + size * 0.1, { weight: 900, size: size * 0.82, stretch: "semi-expanded", glow: 16, soft });
  if (phrase && t >= phraseAt) {
    const text = String(phrase).toUpperCase(), type = { weight: 600, size: 31 * g.s, stretch: "semi-expanded", tracking: 0.05 };
    const lines = wrapLines(ctx, text, { ...type, width: g.width - 240 }), step = type.size * 1.42;
    lines.forEach((line, i) => write(ctx, line, 78, roleTop - 46 * g.s - (lines.length - i) * step, { ...type, alpha: ramp(t, phraseAt + i * 0.07, 0.3), soft: 0.5 * (1 - ramp(t, phraseAt + i * 0.07, 0.25)) }));
  }
}

function paintOne(ctx, timeline, t, assets) {
  const plan = timeline.night, g = geometry(timeline), person = timeline.person || {};
  const punch = timeline.still ? 0 : plan.punchAt?.(t) || 0, flare = timeline.still ? 0 : flareAt(plan, t);
  open(ctx, timeline, t, timeline.still ? Infinity : plan.name, 1.08);
  const photo = photoOf(assets, person);
  drawFace(ctx, photo || assets?.strix?.bitmap, g.box, { alpha: ramp(t, plan.intro[0], 0.8, linear), zoom: 1.03 + 0.06 * t / plan.duration, punch, flare, whole: !photo });

  if (t < plan.name) {
    const [first, second] = HEADLINE[timeline.announceType] || ["Confirmado", "no Strix"];
    const head = Math.min(300 * g.s, fit(ctx, first, GOTHIC, 700, "normal", g.width - 180, 300), fit(ctx, second, GOTHIC, 700, "normal", g.width - 320, 300));
    const top = g.band - head * 1.84 - 84 * g.k, shown = 1 - ramp(t, plan.head.exit, plan.name - plan.head.exit, inCubic);
    if (t >= plan.head.first) gothic(ctx, first, 74, top, head, { alpha: shown, soft: 1 - ramp(t, plan.head.first, 0.27) });
    if (t >= plan.head.second) gothic(ctx, second, 250, top + head * 0.84, head, { alpha: shown, soft: 1 - ramp(t, plan.head.second, 0.27) });
  } else nameBlock(ctx, g, t, plan.name, person, { phrase: timeline.phrase, phraseAt: plan.phrase });
  drawBand(ctx, g, ramp(t, plan.intro[1], 0.4, linear), { first: FIRST, middle: `${TYPE_LABEL[timeline.announceType] || "JOGADOR"}\nTEMPORADA FC 27` });
  dashes(ctx, g);
  close(ctx, timeline, t, flare);
}

/** A title such as "ELENCO FC 27" as the two lines it is set in; the second is blackletter only when it is letters. */
function titleLines(title) {
  const words = String(title || "ELENCO FC 27").trim().split(/\s+/);
  return [asWritten(words[0]), words.slice(1).join(" ")];
}

/**
 * A title card: the crest small at the top in its blue light, and the words big, filling the
 * width, over a giant ghost of the first one. `lines` are set in blackletter when they are
 * letters. The words come up out of focus and settle; a blue rule runs under them.
 */
function titleCard(ctx, g, t, at, { crest, kicker = "", lines = [], second = Infinity, punch = 0, flare = 0 }) {
  const rise = (from) => (1 - ramp(t, from, 0.5)) * 46 * g.k;
  // the crest: small, high, in a round blue light
  crestMark(ctx, crest, g.width / 2, 520 * g.k, 380 * g.k, { alpha: ramp(t, at - 0.2, 0.5, linear), punch, grow: 0.04 * ramp(t, at, 3, linear) });

  const shown = lines.filter(Boolean).map((line) => ({ text: lettersOnly(line) ? asWritten(line) : String(line).toUpperCase(), gothic: lettersOnly(line) }));
  if (!shown.length) return;
  const room = g.width - 148;
  const sizes = shown.map((line) => (line.gothic ? Math.min(330 * g.s, fit(ctx, line.text, GOTHIC, 700, "normal", room, 330)) : Math.min(150 * g.s, fit(ctx, line.text, WIDE, 900, "semi-expanded", room, 150))));
  const gap = 0.86, stack = sizes.reduce((sum, size, i) => sum + (i ? size * gap : size), 0);
  const bottom = g.band - 150 * g.k, top = bottom - stack;
  // the ghost: the first word, huge and faint, behind everything
  const ghost = Math.min(560 * g.s, fit(ctx, shown[0].text, shown[0].gothic ? GOTHIC : WIDE, 700, "normal", g.width * 1.5, 560));
  write(ctx, shown[0].text, g.width / 2, top - ghost * 0.32, { family: shown[0].gothic ? GOTHIC : WIDE, weight: 700, size: ghost, align: "center", color: RASTRO_BLUE, alpha: 0.13 * ramp(t, at, 0.8, linear), cap: 0.74 });
  shade(ctx, g, top + stack * 0.5, ramp(t, at, 0.3, linear));
  if (kicker) readout(ctx, kicker, 78, top - 58 * g.s, 26 * g.s, { color: RASTRO_BLUE, alpha: ramp(t, at + 0.07, 0.25) });
  let y = top;
  shown.forEach((line, i) => {
    const from = i ? Math.max(at, Math.min(second, at + 0.25 * i)) : at, size = sizes[i];
    const x = i ? Math.min(250, g.width - 74 - widthOfLine(ctx, line, size)) : 74;
    if (t >= from) {
      if (line.gothic) gothic(ctx, line.text, x, y + rise(from), size, { soft: 1 - ramp(t, from, 0.3), glow: 22 });
      else write(ctx, line.text, x, y + size * 0.08 + rise(from), { weight: 900, size, stretch: "semi-expanded", glow: 16, soft: 1 - ramp(t, from, 0.3) });
    }
    y += size * gap;
  });
  // the rule that runs under the words
  const run = ramp(t, at + 0.15, 0.9);
  ctx.save(); ctx.fillStyle = RASTRO_BLUE; ctx.globalAlpha *= 0.95; ctx.shadowColor = RASTRO_BLUE; ctx.shadowBlur = 14;
  ctx.fillRect(78, bottom - 10 * g.k, (g.width - 156) * run, 4 * g.k); ctx.restore();
}
/** The crest in black and white, centred on (`cx`, `cy`), `size` wide, in a soft round halo. */
function crestMark(ctx, crest, cx, cy, size, { alpha = 1, punch = 0, grow = 0 } = {}) {
  if (alpha <= 0) return;
  const r = size * 1.75, halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  halo.addColorStop(0, `rgba(47,128,255,${(0.85 + 0.15 * punch).toFixed(3)})`); halo.addColorStop(0.3, "rgba(47,128,255,0.5)"); halo.addColorStop(0.62, "rgba(47,128,255,0.14)"); halo.addColorStop(1, "rgba(47,128,255,0)");
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  const shown = size * (1 + grow + 0.03 * punch);
  ctx.save(); ctx.shadowColor = "rgba(47,128,255,0.9)"; ctx.shadowBlur = 40 * (0.6 + punch);
  drawCrest(ctx, crest, cx - shown / 2, cy - shown / 2, shown, alpha);
  ctx.restore();
}
const widthOfLine = (ctx, line, size) => {
  ctx.save(); ctx.font = line.gothic ? `700 ${size}px ${GOTHIC}` : `900 ${size}px ${WIDE}`;
  const width = ctx.measureText(line.text).width; ctx.restore();
  return width;
};

/**
 * Everyone on one screen: each chapter under its heading, the names in two columns, all the same
 * size (the longest decides it), the shirt number in blue before each name.
 */
function castList(ctx, g, t, plan, sections) {
  const blocks = sections.map((section) => ({ heading: String(section.title?.[0] || "").toUpperCase(), people: (section.people || []).filter((person) => person?.name) })).filter((block) => block.people.length);
  const headed = blocks.length > 1;
  const top = 400 * g.k, bottom = g.band - 60 * g.k, gutter = 36, colW = (g.width - 148 - gutter) / 2;
  const rows = blocks.reduce((sum, block) => sum + Math.ceil(block.people.length / 2) + (headed ? 1.15 : 0), 0) + (blocks.length - 1) * 0.45;
  const lineH = Math.min(128 * g.s, (bottom - top) / Math.max(1, rows));
  const names = blocks.flatMap((block) => block.people.map((person) => String(person.name).toUpperCase()));
  // one size for every name; a long one is set a little narrower (down to 78%) before it is set smaller
  const sizeFor = (room) => Math.min(lineH * 0.56, 72 * g.s, ...names.map((name) => fit(ctx, name, WIDE, 800, "semi-expanded", room / 0.78, lineH * 0.56, 0.02)));
  // the number column is as wide as "00" at the numbers' size, plus a gap
  const numberColumn = (size) => widthOf(ctx, "00", WIDE, 800, size * 0.62, "expanded", 0.04) + size * 0.45;
  let size = sizeFor(colW - 58);
  const numW = numberColumn(size);
  size = Math.min(size, sizeFor(colW - numW));
  let y = top, index = 0;
  blocks.forEach((block, b) => {
    if (b) y += lineH * 0.45;
    if (headed) {
      const alpha = ramp(t, plan.list.start + 0.05 + index * F * 1.2, 0.25);
      readout(ctx, `${block.heading}   ·   ${pad2(block.people.length)}`, 78, y + lineH * 0.15, 24 * g.s, { color: RASTRO_BLUE, alpha });
      ctx.save(); ctx.globalAlpha *= alpha * 0.55; ctx.fillStyle = RASTRO_BLUE; ctx.fillRect(78, y + lineH * 0.15 + 40 * g.s, g.width - 156, 2); ctx.restore();
      y += lineH * 1.15;
    }
    // a chapter without shirt numbers (the board) starts its names at the margin
    const numbered = block.people.some((person) => person.number !== "" && person.number != null), lead = numbered ? numW : 0;
    block.people.forEach((person, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = 74 + col * (colW + gutter), rowY = y + row * lineH;
      const from = (col ? plan.list.second : plan.list.start) + 0.08 + index * F * 1.2, alpha = ramp(t, from, 0.22);
      const number = person.number !== "" && person.number != null ? pad2(person.number) : "";
      if (number) write(ctx, number, x + 4, rowY + (size - size * 0.62) * 0.5, { weight: 800, size: size * 0.62, stretch: "expanded", color: RASTRO_BLUE, alpha, tracking: 0.04 });
      const name = String(person.name).toUpperCase(), wide = widthOf(ctx, name, WIDE, 800, size, "semi-expanded", 0.02), squeeze = Math.min(1, (colW - lead) / Math.max(1, wide));
      ctx.save(); ctx.translate(x + lead + (numbered ? 0 : 4), 0); ctx.scale(squeeze, 1);
      write(ctx, name, 0, rowY, { weight: 800, size, stretch: "semi-expanded", tracking: 0.02, alpha, soft: 0.6 * (1 - ramp(t, from, 0.2)) });
      ctx.restore();
      index += 1;
    });
    y += Math.ceil(block.people.length / 2) * lineH;
  });
}

function paintSquad(ctx, timeline, t, assets) {
  const plan = timeline.night, g = geometry(timeline), people = timeline.people || [], sections = timeline.sections || [];
  const punch = timeline.still ? 0 : plan.punchAt?.(t) || 0, flare = timeline.still ? 0 : flareAt(plan, t);
  const L = plan.list.start, crest = assets?.strix?.bitmap, [first, second] = titleLines(timeline.title);
  open(ctx, timeline, t, timeline.still ? Infinity : L, 1.06);
  const band = (middle) => drawBand(ctx, g, 1, { first: FIRST, middle: `${middle}\nTEMPORADA FC 27` });
  const count = `${pad2(people.length)} ${people.length === 1 ? "NOME" : "NOMES"}`;
  const scene = plan.scenes.findLast((item) => t >= item.at);

  if (t >= L) {
    // everyone: a header with the crest small at the right, then the chapters
    const size = Math.min(190 * g.s, fit(ctx, first, GOTHIC, 700, "normal", g.width - 420, 190));
    gothic(ctx, first, 74, 140 * g.k, size, { soft: 1 - ramp(t, L, 0.27), glow: 20 });
    if (second) write(ctx, second.toUpperCase(), 80, 140 * g.k + size * 1.0, { weight: 900, size: 46 * g.s, stretch: "expanded", tracking: 0.08, color: RASTRO_BLUE, alpha: ramp(t, L + 0.1, 0.3) });
    crestMark(ctx, crest, g.width - 74 - 95 * g.k, 150 * g.k + 95 * g.k, 190 * g.k, { alpha: ramp(t, L, 0.4, linear), punch });
    castList(ctx, g, t, plan, sections);
    band(count);
  } else if (!scene) {
    // the cover: the piece's title
    titleCard(ctx, g, t, plan.title.first, { crest, kicker: "ANÚNCIO OFICIAL", lines: [first, second], second: plan.title.second, punch, flare });
    drawBand(ctx, g, ramp(t, plan.title.second, 0.27, linear), { first: FIRST, middle: `${count}\nTEMPORADA FC 27` });
  } else if (scene.type === "section") {
    // a chapter's card
    const section = sections[scene.section] || {};
    titleCard(ctx, g, t, scene.at, { crest, kicker: String(section.kicker || ""), lines: [section.title?.[0] || ""], punch, flare });
    band(`${pad2((section.people || []).length)} ${(section.people || []).length === 1 ? "NOME" : "NOMES"}`);
  } else {
    // one person at a time: the face, the name, the role; without a picture, his name is the card
    const person = people[scene.index] || {}, photo = photoOf(assets, person);
    if (photo) {
      drawFace(ctx, photo, g.box, { zoom: 1.03 + 0.05 * (t - scene.at) / Math.max(F, scene.until - scene.at), punch, flare });
      nameBlock(ctx, g, t, scene.at, person);
    } else titleCard(ctx, g, t, scene.at, { crest, kicker: roleOf(person), lines: [person.name || ""], punch, flare });
    band(`${pad2(scene.index + 1)} / ${pad2(people.length)}`);
  }
  dashes(ctx, g);
  close(ctx, timeline, t, flare);
}

export function paintNightAnnounce(ctx, { timeline, time = 0, assets } = {}) {
  if (!timeline?.night) return;
  // One image is the piece at rest: everything in, nothing blinking, the light still on.
  const t = timeline.still ? timeline.night.still : time;
  if (timeline.kind === "team") paintSquad(ctx, timeline, t, assets);
  else paintOne(ctx, timeline, t, assets);
}
