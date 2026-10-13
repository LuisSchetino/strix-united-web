// Anúncios FC27 in the "night vision" model. One person: his face comes up, the headline lands,
// then his name takes its place and the sentence comes after it. The team: the title, each
// chapter's card, each person one at a time, and everyone on one screen. The feed format is one
// image: the settled frame of the same piece. The shared parts are night-kit.js; the timing is
// night-plan.js `planNightAnnounce` / `planNightSquad`.
import {
  F, GOTHIC, RASTRO_BLUE, WIDE, asWritten, close, dashes, drawBand, drawFace, fit, flareAt, geometry, gothic, inCubic, lettersOnly, linear, open,
  pad2, ramp, readout, shade, wrapLines, write,
} from "./night-kit.js";

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
  const photo = assets?.byId?.[person.id]?.bitmap || assets?.players?.[0]?.bitmap;
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

/** Everyone on one screen: the chapters one after the other, in two columns. */
function castList(ctx, g, t, plan, sections) {
  const items = sections.flatMap((section) => [...(sections.length > 1 ? [{ heading: String(section.title?.[0] || "").toUpperCase() }] : []), ...(section.people || []).map((person) => ({ name: String(person.name || "").toUpperCase() }))]);
  const weight = (item) => (item.heading ? 1.5 : 1), total = items.reduce((sum, item) => sum + weight(item), 0);
  // The first column takes half of it, and never ends on a heading.
  let cut = 0, filled = 0;
  while (cut < items.length && filled + weight(items[cut]) <= total / 2 + 0.5) { filled += weight(items[cut]); cut += 1; }
  if (cut > 0 && items[cut - 1].heading) cut -= 1;
  const columns = [items.slice(0, cut), items.slice(cut)], top = 350 * g.k, room = g.band - 34 * g.k - top;
  const tallest = Math.max(1, ...columns.map((column) => column.reduce((sum, item) => sum + weight(item), 0)));
  const lineH = Math.min(96 * g.s, room / tallest), width = g.width / 2 - 110;
  columns.forEach((column, c) => {
    const x = c ? g.width / 2 + 24 : 74, from = c ? plan.list.second : plan.list.start;
    let y = top;
    column.forEach((item, i) => {
      const alpha = ramp(t, from + 0.08 + i * F * 1.5, 0.22);
      if (item.heading) readout(ctx, item.heading, x + 4, y + lineH * 0.62, Math.min(lineH * 0.34, 18 * g.s), { color: RASTRO_BLUE, alpha });
      else write(ctx, item.name, x + 4, y, { weight: 700, size: Math.min(lineH * 0.62, fit(ctx, item.name, WIDE, 700, "expanded", width, lineH * 0.62, 0.04)), stretch: "expanded", tracking: 0.04, alpha });
      y += lineH * weight(item);
    });
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
    drawFace(ctx, crest, g.box, { alpha: 0.24, zoom: 1.03, punch, flare, whole: true });
    const size = Math.min(132 * g.s, fit(ctx, first, GOTHIC, 700, "normal", g.width - 420, 132));
    gothic(ctx, first, 74, 168 * g.k, size, { soft: 1 - ramp(t, L, 0.27) });
    if (second) write(ctx, second, g.width - 74, 168 * g.k + size * 0.3, { weight: 900, size: 58 * g.s, stretch: "semi-expanded", align: "right", color: RASTRO_BLUE, alpha: ramp(t, L + 0.1, 0.3) });
    castList(ctx, g, t, plan, sections);
    band(count);
  } else if (!scene) {
    // the cover: the crest, the piece's title
    drawFace(ctx, crest, g.box, { alpha: ramp(t, 0, 0.5, linear), zoom: 1.03, punch, flare, whole: true });
    const plain = lettersOnly(second), head = Math.min(280 * g.s, fit(ctx, first, GOTHIC, 700, "normal", g.width - 180, 280));
    const top = g.band - head * 1.84 - 84 * g.k;
    if (t >= plan.title.first) gothic(ctx, first, 74, top, head, { soft: 1 - ramp(t, plan.title.first, 0.27) });
    if (second && t >= plan.title.second) {
      if (plain) gothic(ctx, asWritten(second), 250, top + head * 0.84, Math.min(head, fit(ctx, asWritten(second), GOTHIC, 700, "normal", g.width - 320, head)), { soft: 1 - ramp(t, plan.title.second, 0.27) });
      else write(ctx, second, 250, top + head * 0.92, { weight: 900, size: Math.min(head * 0.7, fit(ctx, second, WIDE, 900, "semi-expanded", g.width - 320, head * 0.7)), stretch: "semi-expanded", glow: 16, soft: 1 - ramp(t, plan.title.second, 0.27) });
    }
    drawBand(ctx, g, ramp(t, plan.title.second, 0.27, linear), { first: FIRST, middle: `${count}\nTEMPORADA FC 27` });
  } else if (scene.type === "section") {
    // a chapter's card
    const section = sections[scene.section] || {}, word = asWritten(section.title?.[0] || "");
    drawFace(ctx, crest, g.box, { alpha: 0.7, zoom: 1.03 + 0.04 * (t - scene.at) / Math.max(F, scene.until - scene.at), punch, flare, whole: true });
    const size = Math.min(250 * g.s, fit(ctx, word, GOTHIC, 700, "normal", g.width - 150, 250)), top = g.band - size - 110 * g.k;
    readout(ctx, String(section.kicker || ""), 78, top - 44 * g.s, 22 * g.s, { color: RASTRO_BLUE, alpha: ramp(t, scene.at + 0.07, 0.25) });
    gothic(ctx, word, 74, top, size, { soft: 1 - ramp(t, scene.at, 0.27) });
    band(`${pad2((section.people || []).length)} ${(section.people || []).length === 1 ? "NOME" : "NOMES"}`);
  } else {
    // one person at a time: the face, the name, the role
    const person = people[scene.index] || {}, photo = assets?.byId?.[person.id]?.bitmap || assets?.players?.[scene.index]?.bitmap;
    drawFace(ctx, photo || crest, g.box, { zoom: 1.03 + 0.05 * (t - scene.at) / Math.max(F, scene.until - scene.at), punch, flare, whole: !photo });
    nameBlock(ctx, g, t, scene.at, person);
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
