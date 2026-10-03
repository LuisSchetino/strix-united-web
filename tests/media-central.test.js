import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MEDIA_SECTIONS,
  MEDIA_SECTION_IDS,
  mediaGenerateLabel,
  normalizeMediaSection,
  resolveMediaFormat,
  resolveMediaLook,
  resolveMediaOutput,
} from "../src/features/media/media-renderer.js";
import { MOTION, motionMs } from "../src/ui/motion/motion-tokens.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a navegação tem exatamente as cinco áreas editoriais, na ordem do produto", () => {
  assert.deepEqual(MEDIA_SECTION_IDS, ["agenda", "related", "summary-day", "summary-week", "announce"]);
  assert.deepEqual(MEDIA_SECTIONS.map((section) => section.label), ["AGENDA", "RELACIONADOS", "RESUMO DO DIA", "RESUMO DA SEMANA", "ANÚNCIOS FC27"]);
  assert.equal(normalizeMediaSection("nao-existe"), "agenda");
  assert.equal(normalizeMediaSection("announce"), "announce");
});

test("o MediaRenderer decide o painter e o formato; o usuário nunca escolhe", () => {
  assert.equal(resolveMediaLook({ collageReady: true }), "editorial");
  assert.equal(resolveMediaLook({ collageReady: false }), "editorial", "o painter novo não depende dos assets antigos");
  assert.equal(resolveMediaLook(), "editorial");
  assert.equal(resolveMediaFormat("related", "feed"), "story", "Relacionados só produz Reels");
  assert.equal(resolveMediaFormat("agenda", "feed"), "feed");
  assert.equal(resolveMediaFormat("announce", "feed"), "feed");
  assert.deepEqual(resolveMediaOutput({ sectionId: "agenda", format: "feed" }), { type: "video", ext: "mp4", label: "MP4" });
  assert.equal(resolveMediaOutput({ sectionId: "announce", kind: "individual", format: "feed" }).type, "image");
  assert.equal(resolveMediaOutput({ sectionId: "announce", kind: "team", format: "story" }).type, "video");
  assert.equal(mediaGenerateLabel({ type: "image" }), "GERAR PNG");
  assert.equal(mediaGenerateLabel({ type: "video" }), "GERAR VÍDEO");
});

test("a interface principal não expõe V1, V2, renderer, template ou arte estática", async () => {
  const sources = await Promise.all(["MediaPage", "MediaSections", "MediaShell", "AnnounceStudio"].map((name) => read(`src/features/media/${name}.jsx`)));
  const css = (await Promise.all(["media.css", "announce.css"].map((name) => read(`src/features/media/${name}`)))).join("\n");
  for (const source of sources) {
    assert.doesNotMatch(source, /VÍDEO · V1|ARTE ESTÁTICA|V1 — Campanha|V2 — Collage|Collage Editorial|TEMPLATE VISUAL|MediaLookSwitch|StaticMediaV2Studio/);
    assert.doesNotMatch(source, /localStorage|sessionStorage/);
  }
  assert.doesNotMatch(css, /media-output-tabs|media-look-switch|media-look-badge/);
  const page = sources[0];
  assert.match(page, /resolveMediaLook/);
  assert.match(page, /MediaBoundary/);
  assert.match(page, /key=\{active\}/);
});

test("estrutura estável: nav → toolbar → workspace com preview protagonista e ações junto dele", async () => {
  const [shell, css] = await Promise.all([read("src/features/media/MediaShell.jsx"), read("src/features/media/media.css")]);
  for (const part of ["MediaNav", "MediaToolbar", "ToolbarGroup", "FormatGroup", "MediaWorkspace", "PreviewStage", "PreviewCanvas", "PieceActions", "ArchiveList", "Options", "MediaViewer", "MediaBoundary"]) {
    assert.match(shell, new RegExp(`export (function|class) ${part}\\b`), part);
  }
  assert.match(css, /grid-template-areas:\s*"stage actions" "stage rail"/);
  assert.match(css, /grid-template-areas:\s*"stage" "actions" "rail"/);
  assert.match(css, /min-height:\s*calc\(var\(--stage-h\) \+ var\(--stage-pad\) \* 2\)/, "o quadro reserva a altura: trocar de formato não desloca o layout");
  // pauta → peça → resultado: generation runs on the stage and the file plays in place.
  for (const part of ["StageProgress", "StageResult"]) assert.match(shell, new RegExp(`export function ${part}\\b`), part);
  assert.match(css, /\.media-stage-progress/);
  assert.match(css, /\.media-pauta-item/);
  assert.match(css, /@keyframes media-piece-in/);
  assert.match(css, /@keyframes media-section-in/);
});

test("modais e controles usam o CloseButton SVG compartilhado, sem X textual", async () => {
  const [shell, motion] = await Promise.all([read("src/features/media/MediaShell.jsx"), read("src/ui/motion/motion.jsx")]);
  assert.match(shell, /<CloseButton onClick=\{dismiss\} \/>/);
  assert.doesNotMatch(shell, />\s*[×✕xX]\s*</);
  assert.match(motion, /<CloseIcon size=\{14\} \/>/);
  assert.doesNotMatch(motion, /<em aria-hidden="true">×<\/em>/);
});

test("motion: tokens centralizados, sem spring com overshoot e com reduced motion", async () => {
  const [css, tokens] = await Promise.all([read("src/ui/motion/motion.css"), read("src/ui/motion/motion-tokens.js")]);
  for (const token of ["micro", "control", "modal", "section", "hero"]) assert.match(css, new RegExp(`--motion-${token}:`));
  assert.match(css, /--motion-ease-in:/);
  assert.doesNotMatch(css, /--motion-spring/, "o spring antigo saltava; o alias foi removido e todos usam --motion-ease");
  assert.doesNotMatch(css, /cubic-bezier\(0\.2, 0\.9, 0\.25, 1\.15\)/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*:root \{[^}]*--motion-section: 1ms/);
  assert.deepEqual(Object.keys(MOTION), ["micro", "control", "modal", "section", "hero"]);
  for (const [name, value] of Object.entries(MOTION)) assert.match(css, new RegExp(`--motion-${name}: ${value}ms`), `${name} deve espelhar o CSS`);
  assert.equal(typeof motionMs("modal"), "number");
  assert.match(tokens, /prefers-reduced-motion: reduce/);
  const media = await read("src/features/media/media.css");
  assert.match(media, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(media, /\d+ms/, "a Central não espalha durações: usa os tokens");
});

test("a Central não usa azul genérico nem vermelho decorativo", async () => {
  const css = (await Promise.all(["media.css", "announce.css"].map((name) => read(`src/features/media/${name}`)))).join("\n");
  const hexes = [...css.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((match) => match[1].toLowerCase());
  const channel = (hex, index) => parseInt(hex.slice(index, index + 2), 16);
  assert.deepEqual(hexes.filter((hex) => channel(hex, 4) - channel(hex, 0) >= 36 && channel(hex, 4) >= channel(hex, 2) && channel(hex, 4) > 60), []);
  assert.deepEqual(hexes.filter((hex) => channel(hex, 0) - Math.max(channel(hex, 2), channel(hex, 4)) >= 70 && channel(hex, 0) > 120), []);
  assert.doesNotMatch(css, /2f80ff|rastro/i);
});

test("jobs identificam o template dono para o progresso aparecer só na área certa", async () => {
  const jobs = await read("src/features/media/media-jobs.js");
  assert.equal((jobs.match(/template: (AGENDA|RELATED_NIGHT|SUMMARY|ANNOUNCE)_TEMPLATE_ID,/g) || []).length, 12);
});
