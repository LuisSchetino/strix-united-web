---
version: 1
slug: "src-features-media-mediapage-jsx"
primary_target: "src/features/media/MediaPage.jsx"
related_targets: ["src/features/media/media.css","src/features/media/MediaShell.jsx"]
---

Scope: Central de mídia (route /midia) of STRIX UNITED FC27. Visitor mode: Operate. Access: dev tier only (confirmed 2026-10-02).
Audience: the club's developer/media operator on match nights. Job: produce tonight's social pieces (Agenda do dia, Relacionados da noite, Resumo do dia/semana, Anúncios FC27) as MP4/PNG without touching renderer concepts.
Content: real agenda, saved night list, imported results, active roster; in-browser H.264 encode and render cache with fingerprints.

## Direction contract

THESIS: An editing room, not a control panel: the night's pauta says what can be made and what it still needs; the piece is the protagonist; the file comes back where the preview was. It refuses the template gallery and the step wizard.

OWN-WORLD: Same ink/graphite/off-white world as the product; pauta as a hairline list with a 1px active rule and readiness dots (off-white = pronta, amber = falta um passo, hollow = sem dados); the preview piece rounded 14px on a shadowed ink frame; no corner viewfinder marks, no blue.

STORY: Pick a piece in the pauta (readiness visible before clicking) → see it at viewport scale → choose Reels 9:16 or Post 4:5 → generate with progress on the piece → the MP4 plays in place → Baixar / Tela cheia / Gerar de novo / Voltar à prévia.

FIRST VIEWPORT: PageHeader "Central de mídia." Left 248px pauta. Right: toolbar (piece title + count/date; format segmented control), then the stage (piece sized from viewport height) beside the actions column (primary GERAR VÍDEO, then context list and archive).

FORM: Pauta → Peça → Resultado (direction A of the exploration, docs/design/EXPLORATION.md), taking from the wizard only its reading order. Seed key: none (structure chosen in the documented exploration round after the user moved to autonomous selection).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: generation runs on the piece (dim layer, label and percentage), and the result replaces the preview in place; the generated videos use the now line as their scene transition.
