---
name: STRIX UNITED FC27
description: The club's private room for match nights. Ink, off-white and hairlines, anchored on the now line.
colors:
  ink-0: "#050607"
  ink-1: "#0c0c0d"
  ink-2: "#121314"
  ink-3: "#18191a"
  ink-4: "#1f2021"
  ink-5: "#2a2b2c"
  text-1: "#f5f5f5"
  text-2: "#c9cdd2"
  text-3: "#8e969f"
  text-4: "#767e88"
  text-on-light: "#08090a"
  line-1: "rgba(255, 255, 255, 0.06)"
  line-2: "rgba(255, 255, 255, 0.1)"
  line-3: "rgba(255, 255, 255, 0.16)"
  line-focus: "rgba(245, 245, 245, 0.72)"
  paper-1: "#f3f3f3"
  paper-2: "#ffffff"
  state-danger: "#e5484d"
  state-warning: "#e8b04a"
  state-success: "#4cc38a"
  rastro-blue: "#2F80FF"
  data: "var(--rastro-blue)"
  next-clubs-accent: "#c7ff2f"
typography:
  kickoff:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(64px, 8.4vw, 124px)"
    fontWeight: 800
    lineHeight: 0.86
    letterSpacing: "-0.055em"
    fontFeature: "tnum"
  score:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(44px, 6vw, 76px)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
    fontFeature: "tnum"
  display:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "clamp(34px, 4.2vw, 54px)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.25
  time:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.12em"
rounded:
  xs: "6px"
  sm: "10px"
  md: "14px"
  lg: "20px"
  pill: "999px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "20px"
  space-6: "24px"
  space-8: "32px"
  space-10: "40px"
  space-12: "48px"
  space-16: "64px"
  gutter: "clamp(16px, 3vw, 32px)"
  page-max: "1240px"
  hit: "44px"
components:
  button-primary:
    backgroundColor: "{colors.paper-1}"
    textColor: "{colors.text-on-light}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.text-on-light}"
  button-primary-disabled:
    backgroundColor: "{colors.ink-4}"
    textColor: "{colors.text-4}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.text-1}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-3}"
    rounded: "{rounded.sm}"
  nav-item-hover:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.text-1}"
  nav-item-active:
    backgroundColor: "{colors.ink-3}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.sm}"
  search-field:
    backgroundColor: "{colors.ink-1}"
    textColor: "{colors.text-3}"
    rounded: "{rounded.sm}"
  now-block:
    backgroundColor: "{colors.ink-1}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.lg}"
    padding: "32px"
  timetable-row:
    backgroundColor: "transparent"
    textColor: "{colors.text-1}"
    typography: "{typography.title}"
    height: "64px"
  status-pill-next:
    backgroundColor: "{colors.paper-1}"
    textColor: "{colors.text-on-light}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 9px"
  next-match-chip:
    backgroundColor: "{colors.ink-1}"
    textColor: "{colors.text-1}"
    rounded: "{rounded.pill}"
  pauta-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-2}"
    padding: "12px 12px 12px 16px"
    height: "68px"
  pauta-item-active:
    backgroundColor: "{colors.ink-1}"
    textColor: "{colors.text-1}"
  stage-piece:
    backgroundColor: "{colors.ink-1}"
    rounded: "{rounded.md}"
---

# Design System: STRIX UNITED FC27

## Overview

**Creative North Star: "The Night Ledger"**

STRIX UNITED is the club's own room at night, read as a timetable. The ground is near-black ink, type is off-white Inter at heavy display weights with tabular numerals, and structure comes from hairlines rather than boxes. Most content sits directly on the ground as rows divided by 1px lines; only one object per screen gets lifted onto a raised ink surface (the next match on the Home, the preview piece in the Central de mídia, the Agenda's list frame).

The signature is the **now line**: a 1px off-white hairline with a 7px dot that marks where the night stands inside the timetable. It draws in from the left on the Home and in the Agenda, and the same mark sweeps down the generated videos as their scene transition. The product and its social pieces speak one language: same ink stage, same type, same hairlines, same now line.

Color carries no decoration. The UI is monochrome; hue appears only as system state (success, warning, danger), as the language of measured data (Rastro Blue on values, ratings, trends and chart marks), and inside partner scopes (the Rastro mark, Next Clubs and competition colours in their own surfaces). Density follows the Agenda, the reference surface: generous row heights, firm type contrast, nothing ornamental.

**Key Characteristics:**
- Ink ramp ground (#050607 up to graphite #2a2b2c) with off-white type in four tiers.
- Hairline rows (1px, 6–16% white) instead of cards.
- One elevated object per view; everything else is flat on the ground.
- Inter only; contrast from size, weight (800 for display) and tracking; tabular numerals for every time, score and count.
- The now line as the single recurring signature, in the app and in the videos.
- Paper-white pill for the one primary action.

## Colors

A restrained, near-monochrome palette: ink, graphite, off-white and translucent white hairlines, with hue reserved for state and partners.

### Primary
- **Paper White** (paper-1, hover paper-2): the only filled light surface. Used for the primary action pill, the "PRÓXIMO" status pill on the next match, the active thumb of segmented controls and the NOVO button. Text on it is near-black (text-on-light).

### Neutral
- **Pitch Ink** (ink-0): page ground, sidebar, topbar (at 86% with blur), tab bar, player sheet.
- **Raised Ink** (ink-1): the one raised object (now block, Agenda list frame, preview piece), search field, menus, user card, active pauta row.
- **Field Ink** (ink-2): inputs, tooltips, hover fill on nav and secondary buttons.
- **Selected Ink** (ink-3): active nav item, hover inside menus.
- **Pressed Ink** (ink-4): pressed and disabled fills.
- **Graphite** (ink-5): dividers that must read as objects, scrollbar thumbs.
- **Off-White** (text-1): titles, values, times, the now line and its dot.
- **Body Grey** (text-2): body copy, section headings on the Home, pauta titles at rest.
- **Meta Grey** (text-3): secondary text, competitions, descriptions under the page title.
- **Quiet Grey** (text-4): rail group labels, separators, the "×" between teams. Holds 4.9:1 on ink-0.
- **Hairlines** (line-1 for row dividers, line-2 for section heads and control borders, line-3 for hover borders and progress tracks; line-focus for the focus ring).

### State
- **Success Green** (state-success): a defined lineup (check icon), success feedback. Never decoration.
- **Warning Amber** (state-warning): the "falta um passo" readiness dot in the pauta, warnings.
- **Danger Red** (state-danger): errors and destructive actions. Each has a 14% soft fill for backgrounds.

### Partner scopes
- **Rastro Blue** (rastro-blue, with 16% and 8% soft variants): belongs to the Rastro analytics partner. It has exactly two jobs: the "Powered by Rastro" signatures, and — through the `--data`, `--data-soft`, `--data-subtle`, `--data-line` tokens — every measured value: statistics, ratings, rankings, positions, deltas, progress meters, the first radar series and the night's record.
- **Next Clubs Lime** (next-clubs-accent): competitions partner brand only. Competition identity colours come from each competition's own data.

### Named Rules
**The Data-Blue Rule.** Blue means "this was measured". Use `--data` (or the `.data-value` utility) on numbers that come from EA data or library tracking, on trends and on data marks. Never on backgrounds, buttons, structure, navigation, focus or decoration; labels next to a blue value stay ink/off-white. Legacy blue aliases (`--strix-blue`, `--fc27-blue`) no longer exist.

**The State-Only Hue Rule.** Green, amber and red appear only when the system is reporting a state. A row, header or piece never takes a hue to look lively.

**The One Paper Rule.** Paper white is the only filled light surface. One primary pill per action group; the rest is outlined or text.

## Typography

**Display Font:** Inter (with system-ui, -apple-system, Segoe UI, sans-serif)
**Body Font:** Inter
**Label Font:** Inter, uppercase and tracked

**Character:** One family doing everything. Display weights run at 800 with tight negative tracking so headlines and numerals read like a printed fixture list; labels are small, bold and widely tracked; body stays regular and calm.

### Hierarchy
- **Kickoff** (800, clamp(64px, 8.4vw, 124px), line-height 0.86, -0.055em, tabular): the next match's kickoff time in the Home now block. One per screen.
- **Score** (800, clamp(44px, 6vw, 76px), tabular): last result scoreline, season figures (V/E/D, aproveitamento).
- **Display** (800, clamp(34px, 4.2vw, 54px), line-height 1.02, -0.035em): page titles in the PageHeader and the Home greeting. Compact tool pages drop to 36px.
- **Headline** (800, 28px, -0.02em): the selected piece title in the Central de mídia toolbar, player sheet name (36px).
- **Time** (800, 22px, -0.02em, tabular): kickoff times in timetable rows.
- **Title** (700, 15px, line-height 1.25): opponent names, player names, pauta titles, menu item names (13–13.5px in the rail).
- **Body** (400, 15px, line-height 1.5, max 62ch): page descriptions, empty states (max 46ch), prose.
- **Meta** (400–600, 12–13px): competitions, counts, dates, sub-lines under names.
- **Label** (700, 11px, 0.12em, uppercase): section heads ("ESTA NOITE", "ÚLTIMO RESULTADO"), column heads, rail group names, breadcrumb, status words. Button text uses 12px 800 at 0.06em.

### Named Rules
**The Tabular Rule.** Every time, score, count and date renders with tabular numerals (`time`, `.tabular`, `[data-tabular]`).

**The Tagline Title Rule.** Page titles are short declarative taglines that end with a period ("Elenco FC 27.", "Central de mídia.", "Boa noite, Dornellas."). The period is intentional.

**The No-Eyebrow Rule.** Nothing sits above a page title. The route name lives in the topbar breadcrumb; uppercase labels are reserved for data metadata (section heads, columns, status), never as an overtitle.

## Layout

A fixed shell around a single centred content column. Desktop: a 248px rail (72px compact, with tooltips) on ink-0 behind a 1px hairline, grouped by purpose into **Clube** (Central, Agenda, Partidas, Elenco, Campeonatos), **Dados** (Estatísticas, Análise, Biblioteca) and **Estúdio** (Mídia, Desenvolvedor); groups emptied by access tier disappear. A sticky 64px topbar carries the breadcrumb (STRIX / ROUTE), the search field with its Ctrl K hint, the next-match chip on routes other than Central, and the NOVO menu.

Routes sit in one column capped at 1240px (page-max) with a fluid gutter (clamp(16px, 3vw, 32px)) as the only side margin; routes add no outer padding. Spacing follows a 4pt scale (4–64px); the Home stacks its sections 48px apart, page headers sit 40px below the topbar with 32px beneath and a line-1 rule under them.

Breakpoints: 1280px collapses the next-match chip's text; **900px** turns the rail into a bottom sheet, hides the next-match chip, reduces the topbar to crest + route title + icon search + round "+" and shows a 64px bottom tab bar (Central, Agenda, Partidas, Elenco, Mais); 760px stacks the page header and stretches its actions; 560px is the phone single column. Two-column workspaces (Home stage 1.45fr / 1fr, Media pauta 248px + stage + actions) open from 1180px and fold to one column below. Touch targets are at least 44px.

## Elevation & Depth

Flat by default, with tonal layering. Depth comes from stepping up the ink ramp and from hairlines; shadows are reserved for the few things that actually float or are lifted.

### Shadow Vocabulary
- **Raise** (`box-shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 10px 28px rgba(0,0,0,0.35)`): the one raised object on a page (Home now block).
- **Pop** (`box-shadow: 0 18px 48px rgba(0,0,0,0.62)`): menus, tooltips, the player sheet, and the preview piece (paired with a line-2 ring).
- **Sheet** (`box-shadow: 0 -16px 48px rgba(0,0,0,0.6)`): bottom sheets on mobile (menu, ficha).

### Named Rules
**The One Lift Rule.** A view lifts one object. Lists, ledgers and section content stay flat on the ground.

**The Soft Shadow Rule.** Shadows are offset and softly blurred black. No zero-offset glows, no hard offset shadows.

## Shapes

Gentle, consistent corners on objects; rows have none. Small controls use 6–10px (xs/sm), menus and the preview piece 14px (md), the raised blocks and mobile sheets 20px (lg, top corners only on sheets). Every button, status pill, chip and the NOVO button is a full pill. Crests and avatars sit in circles with a hairline ring. Rows, timetable lines and ledgers are square, divided only by 1px hairlines. Active states are drawn with thin rules: a 1px off-white vertical rule on the active pauta item, a 2px top bar on the active mobile tab.

## Components

### Buttons
Confident and quiet: one paper pill, everything else outlined.
- **Shape:** full pill (999px), 44px tall.
- **Primary:** paper-1 fill, near-black text, 12px 800 at 0.06em, 20px side padding; uppercase on tool actions (GERAR VÍDEO, ADICIONAR JOGADOR). Hover goes to pure white; press scales to 0.98 over 140ms. A trailing arrow nudges 3px on hover.
- **Secondary:** transparent with a line-2 border, text-2; hover lifts to ink-2 fill, line-3 border, off-white text.
- **Disabled:** ink-4 fill, text-4.
- **Text link:** text-3, 13px 600, arrow that moves 2px on hover, colour to text-1.

### Chips and status pills
- **Status words** in rows are 11px 700 tracked uppercase in text-3 ("AGENDADO", "JOGADO").
- **Next / now:** the next match's status becomes a paper pill ("PRÓXIMO").
- **Outlined pill:** inset line-2 ring for neutral statuses in Agenda and Elenco rows; line-3 for emphasis.
- **Readiness dots** (Media pauta): filled off-white = pronta, amber = falta um passo, hollow text-4 ring = sem dados.

### Containers
- **Now block:** ink-1, line-2 border, 20px radius, 32px padding, Raise shadow, a faint top-left radial light. Holds status line, kickoff numerals, fixture with crests, and a foot (lineup state + actions) above a line-1 rule.
- **Agenda list frame:** ink-1, line-1 border, 20px radius; rows inside share one grid (time | crest | opponent + competition | status | actions).
- Everything else is not a card: sections are a 44px head with a label and a link above a line-2 rule, then hairline rows.

### Inputs / Fields
- **Search:** ink-1 fill, line-2 border, 10px radius, text-3 placeholder, a bordered kbd hint; hover line-3 border and ink-2 fill. Collapses to an icon below 900px.
- **Focus (global):** 2px solid line-focus outline, 2px offset (inset −2px on full-bleed rows). Caret is off-white.

### Navigation
- **Rail:** group labels in 11px tracked uppercase text-4; items 13.5px 600 text-3 with a 10px radius; hover ink-2, active ink-3 fill with an inset line-1 ring and off-white text. The Rastro signature and the user card sit in the dock above a line-1 rule.
- **Topbar:** ink-0 at 86% with blur and a line-1 rule; breadcrumb in label type with the current route in off-white.
- **Mobile:** bottom tab bar on ink-0 at 94% with a line-1 top rule; 10.5px labels; active tab is off-white with a 20×2px top bar that grows in. "Mais" opens the rail as a bottom sheet (ink-1, 20px top radius, Sheet shadow).

### Rows (Agenda, Home timetable, Elenco, pauta)
- Hairline rows on the ground: line-1 bottom rule, 60–76px tall, never truncate the opponent or player name (wrap instead).
- **Timetable row:** 58px time column (22px 800 tabular), 28px crest, name + competition, status. Past rows dim to text-3.
- **Elenco row:** avatar circle, name + position + games, shirt number, menu; the whole row opens the player's ficha. Sectors head each group with a label, position codes and count.
- **Pauta item:** 68px, title + meta + readiness; active row on ink-1 with a 1px off-white rule on its left edge.

### The Now Line (signature)
A 1px hairline fading from off-white to 8% across the timetable, with a 7px off-white dot at its start and the current time in 11px 800 tabular label type beside it. It draws in from the left over 560ms with the decelerate ease (instant under reduced motion). In the generated videos the same line (1.5px, with a dot at the margin) sweeps down the stage, revealing the scene above it.

### Next-match chip
A pill in the topbar (ink-1, line-2 border): crest, "PRÓXIMA PARTIDA" micro-label, fixture, kickoff in tabular 800. Hover ink-2 and line-3. Shown on routes other than Central; text collapses at 1280px; hidden at 900px and below.

### Central de mídia stage
Pauta (248px) → toolbar (piece title in headline type, count/date meta, format segmented control Reels 9:16 / Post 4:5) → stage. The piece is sized from viewport height, 14px radius on ink-1 with a line-2 ring and the Pop shadow. Generation runs on the piece: a 90% ink veil with 8px blur, step label and percentage, and a 2px progress bar (off-white on line-3). The finished MP4 replaces the preview in place, followed by Baixar / Tela cheia / Gerar de novo / Voltar à prévia. Section swaps fade up 10px over 320ms, staggered 45ms per area.

### Player sheet (ficha)
One component wherever a player is opened: from the right on desktop (up to 760px, ink-0, line-2 left border, Pop shadow, 60% black scrim), from the bottom on phones (20px top radius).

### Generated pieces (videos)
One painter for every piece. Ink stage (gradient #0e1114 → ink-0 → #08090b) with one slow, faint light drifting across it. Header: crest, "STRIX UNITED" tracked 800, piece name right-aligned in meta grey, over a hairline; footer: date and count over a hairline at a 64px margin (1080 base). Timetable rows and ledgers mirror the app. Names never clip: they shrink to fit one line down to 50%, then split into two balanced lines; fixed-size meta truncates with an ellipsis. Missing values paint as "—".

### Data trend
`DataTrend` (src/ui/DataTrend.jsx): arrow · amount · "vs <window>". Up in --data, down in --text-2, stable in --text-3; red is not used for performance. Methodology sits on the label line as `.data-criterion` ("PRECISÃO DE PASSE · mín. 10 passes").

### Reading blocks (Análise)
Four blocks with one structure: a 32px hairline ring holding the block's mark, the title on a hairline, three metrics divided by hairlines, values in --data with the trend on the label line. Two label lines are reserved so values share a baseline.

### Resumo da noite (edition)
Dateline (date · last whistle), a now-line rule that draws once, the night's record (partidas / vitórias / empates / derrotas / gols) in --data, the games in kickoff order, then the standouts. Rows arrive in sequence with `.data-arrive`.

### Home states
The hero reflects the club: `next` (match today), `recent` (result imported in the last 12 h: score, result, top rating, the night's record) or `free` (crest composition + "Próximo compromisso" from the agenda, or "Agenda livre"). In `recent` the season holds the ledger alone.

### Library shelves and covers
One editorial cover per shelf (public/assets/library/<id>.svg): ink ground, one soft light, hairline pitch, off-white drawing, a single data-blue move that names the concept (route, playhead, build-up steps, closing trap, the line, the run). Materials without a manual thumbnail use their shelf's cover. Covers zoom slightly and catch one pass of light on hover.

### Acompanhamento
Member rows (initials inside a progress ring in --data, completed/total, last access, shelf meters). The member panel slides in from the right with blur: shelf breakdown, then every published material with status (Concluído / Em andamento / Aberto / Sem registro), percent and meter when the player measures it, last access and last position. Built only from library_view_progress.

### Contract document
The contract is paper on ink: letterhead (crest, club, Nº and document id), identification ledger, numbered clauses, signature block, paginated footer. The pad writes ink under a pen that follows the pointer; after signing the stroke redraws, a seal settles in focus and one light passes across the paper. The PDF (contract-pdf.js) draws the same document as A4 vectors with the crest embedded.

### Next Clubs lockup
Partner mark · one lime hairline that draws in once · "Powered by Next Clubs" + what the partner does. Lime never leaves the lockup.

## Do's and Don'ts

### Do:
- **Do** build on the ink ramp and four text tiers from `src/design/tokens.css`; read tokens, never literals.
- **Do** divide content with 1px hairlines (line-1 rows, line-2 section heads) and keep it flat on ink-0.
- **Do** lift exactly one object per view onto ink-1 with the Raise or Pop shadow.
- **Do** use the now line to mark the present wherever a timetable or a generated scene shows the night.
- **Do** set every time, score and count in tabular numerals at 800 weight.
- **Do** use the paper pill for the single primary action and outlined pills for the rest.
- **Do** keep motion to decelerating entrances (140ms micro, 200ms controls, 320ms sections, 560ms hero) and collapse it to 1ms under `prefers-reduced-motion`.
- **Do** render missing data as "—" and write honest empty states (max 46ch, text-3).

### Don't:
- **Don't** let Rastro Blue into structure, surfaces or decoration; it belongs to measured values (`--data`) and the Rastro mark only.
- **Don't** show a trend without two real samples: "↑ 0,4 vs 5 anteriores" needs a previous window; a season no longer than the recent window shows the value alone.
- **Don't** loop entrance animations. Compositions enter once (blur → focus → rings → now-line sweep → copy) and rest.
- **Don't** put an eyebrow or kicker label above a page title; the breadcrumb already names the route.
- **Don't** mark state with thick coloured side stripes on rows or cards; active rows use the 1px off-white rule or a fill step.
- **Don't** use zero-offset glows, hard offset shadows, bounce or parallax.
- **Don't** wrap rows in individual cards or build dashboards of metric tiles.
- **Don't** truncate opponent or player names; wrap in the app, shrink-then-split in the videos.
- **Don't** add a second typeface.
