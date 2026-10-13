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
  state-danger: "#f5f5f5"
  state-warning: "#c9cdd2"
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

Color carries no decoration. The UI is monochrome; warnings and errors carry no hue of their own (no red, no amber: they read by contrast, icon and words). Hue appears only as success feedback (green, sparingly), as the language of measured data (Rastro Blue on values, ratings, trends and chart marks), and inside partner scopes (the Rastro mark, Next Clubs and competition colours in their own surfaces). Density follows the Agenda, the reference surface: generous row heights, firm type contrast, nothing ornamental.

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
- **Warning** (state-warning, a light grey): the "falta um passo" readiness dot in the pauta, warnings. No amber.
- **Danger** (state-danger, off-white): errors and destructive actions. No red. Both sit on a quiet ink panel (5–6% white fill) with a firmer hairline and a line icon.

### Partner scopes
- **Rastro Blue** (rastro-blue, with 16% and 8% soft variants): belongs to the Rastro analytics partner. It has exactly two jobs: the "Powered by Rastro" signatures, and — through the `--data`, `--data-soft`, `--data-subtle`, `--data-line` tokens — every measured value: statistics, ratings, rankings, positions, deltas, progress meters, the first radar series and the night's record.
- **Next Clubs Lime** (next-clubs-accent): competitions partner brand only. Competition identity colours come from each competition's own data.

### Named Rules
**The Data-Blue Rule.** Blue means "this was measured". Use `--data` (or the `.data-value` utility) on numbers that come from EA data or library tracking, on trends and on data marks. Never on backgrounds, buttons, structure, navigation, focus or decoration; labels next to a blue value stay ink/off-white. Legacy blue aliases (`--strix-blue`, `--fc27-blue`) no longer exist.

**The State-Only Hue Rule.** Green appears only when the system is reporting success; warnings and errors are monochrome. A row, header or piece never takes a hue to look lively.

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
**The Paper Exception.** The contract is the one printed object in the product, so it alone sets its clauses in a serif (Source Serif 4, with Georgia as fallback): justified, run-in clause headings in Inter. Its engraving (seal ring, microtext) uses a system sans because the sheet is rasterised for the PDF and the film. Nothing outside `.contract-instrument` uses a serif.

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
- **Readiness dots** (Media pauta): filled off-white = pronta, half-filled = falta um passo, hollow text-4 ring = sem dados.

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

### Contract (paper)
One A4 sheet (`ContractInstrument`) in sheet units, shown on the page and rasterised from the signed payload for the PDF and the signing film, so the three are the same drawing. Aged paper with a guilloche frame, rosettes and the crest as watermark; letterhead over a double rule; identification table; run-in clauses; two signatures: the member's ink (blue-black #1b2546) written by a fountain pen that follows the stored stroke, and the club's stamp, which lands after the pen leaves. Reduced motion shows the finished sheet.

### Match line-up (pitch)
The fixture opens on the Central’s now card (`NowCard`, set flush as a band inside the dialog): the status line (dot, when it happens, competition and group), then the face-off (`FaceOff`): each crest over its club’s name, the kick-off between them in the giant numerals with the day underneath. The now line sweeps the top edge on entrance and again every few seconds, a shine travels the lower rule, the corner light drifts slowly; the numerals come into focus once and the clubs arrive from their sides. No glass, no blur panes, no type and no circles in the background. Strix is written in the opponent’s casing. On a narrow card the kick-off takes its own row above the clubs, as the Central does on a phone. Below, a flat pitch (outline, halfway line, circle, both penalty boxes; each box is deep enough to hold a whole token and no marking crosses a player, so the goal areas are left out) with one round token per player (face, name pill, position) on a sheet where fine diagonal lines drift; the five lines of the 3-1-4-2 are evenly spaced from the goal out. A competition fixture carries its table beside the pitch: both clubs face to face (positions in the data colour, points, wins, goals and goal difference as bars growing from the centre), then the group's rows with Strix on the white edge and the opponent on a grey one. A friendly has no side panel: its stage is taller and the pitch takes the whole sheet.

### Icons
Every icon comes from Tabler (`@tabler/icons-react`): no hand-drawn paths, no text glyphs as buttons. Metrics share one football vocabulary in `src/ui/StatIcon.jsx` (ball = goal, boot = assist, player striking = shot, challenge = tackle, glove = save).

### Destructive actions
Removing something that cannot come back asks first in `ConfirmDialog`: what goes, what cannot be undone, CANCELAR focused by default (reversible actions are done at once with "Desfazer" in the toast; see below). No red anywhere in the product: the removing action is the outlined white button, cancelling is the quiet one, and error copy reads in off-white on an ink panel with a firmer hairline and an alert icon.

### Cancelled and swapped games
A cancelled game keeps its slot on the Agenda list (dimmed, crest in grey, name struck, hatched row, "Cancelado" outlined) and can be reactivated; it leaves Home, media and the next-match chip. A swapped opponent shows the old name, struck and small, above the new one.

### Comparing series
Charts that compare several people (Raio-X) use a categorical palette — data blue first, then amber, mint, violet, pink, cyan, lime, orange, white, steel, indigo, sand; never red — each with its own line pattern; pointing at a name singles its shape out. Everywhere else data stays in Rastro Blue.

### Notifications
Ink panel, hairline, white type. The tone is a line icon in a ring, a 2px edge and the countdown bar: the same white family for done, errors and attention; the icon and the words tell them apart. No filled colour blocks, no hue.

### Generated pieces (videos)
The stage is never still, and it moves like an institution, not like a party: under one fixed light, an outlined word crosses, hairlines travel left to right at a constant pace, one soft band drifts through, quiet dust falls and a ticker runs on the edge. Straight lines only: no circles, no rays, nothing that sways or pulses; every piece opens on its cover (the title card is whole on frame zero, because the first frame is the thumbnail a gallery or a chat shows, and it grows into place from a touch smaller instead of being revealed from an empty stage); after it, each scene opens with the now line and a short flash and lifts away before the next. Relacionados is a televised line-up: a pitch board seen from behind our goal where each shirt and name lands on its real position (holding midfielder behind the midfield line, wing-backs wide; a crowded line splits in two rows) and stays, while the player of the moment is presented below with his number outlined; it closes with every name on the board. Outlined display text is always the outer edge only (stroke, then the interior cut out), never a raw glyph stroke; portraits dissolve by fading the photo itself, never by a dark block over it. The squad film runs in chapters (board in gold, council in platinum, staff in white, squad from the back line forward), each person with a solid role plate; a role's ground is a still wash of its colour under a fine pinstripe, with hairlines and one soft band passing in that colour, all kept below the portrait and fading in from the top of the name block, so nothing crosses a face and no edge shows; it closes with every name on one screen and the crest. Agenda opens with every crest of the night over its kick-off time (two balanced rows past five games), pages are balanced (six games read 3 + 3), competition matches own a lit row with a ringed crest, and it closes on the Strix crest growing from small until it takes the frame.
One painter for every piece. Ink stage (gradient #0e1114 → ink-0 → #08090b) with one slow, faint light drifting across it. Header: crest, "STRIX UNITED" tracked 800, piece name right-aligned in meta grey, over a hairline; footer: date and count over a hairline at a 64px margin (1080 base). Timetable rows and ledgers mirror the app. Names never clip: they shrink to fit one line down to 50%, then split into two balanced lines; fixed-size meta truncates with an ellipsis. Missing values paint as "—".

### Adicionar campeonato (import sheet)
Two steps in one sheet. *Escolher*: the provider's tournaments in progress (the ones Strix plays tagged, read at most every ten minutes) or a pasted address. *Conferir e adicionar*: logo on a soft stage, name, the group Strix plays in as a white tag, four facts (phase, groups, teams, Strix games), Strix's group table, then the single primary action. Reading shows a hairline progress with the page count; a partial read says how many pages are missing and offers to read only those. The logo is kept as a small copy in the club's storage.

### Competitions
The competition reads like the rest of the product. Identity on the same now card (status line with a dot and the organiser, the edition on the right; logo beside the name in display type with the phase and Strix’s group under it; the last update and the update button in the foot above the hairline). The next match is that card again, with the face-off and, in the foot, whether it is on the club’s Agenda and where the opponent stands. Then text tabs like the Agenda's (active = ink-3 pill, counts in tabular numerals), facts on hairlines (phase, group, position and points in the data colour). Tables and games use the Agenda's list frame; club names are never cut: they wrap. The qualification zone is a dashed cut line inside the table and one sentence under it (the rule comes from the organiser; a field to type it appears only when the organiser did not publish one). A competition has no colour of its own: the only colour is its logo.

### Scenarios
Every remaining game of Strix's group is played in every way (win, draw, loss). The screen states, in this order: the verdict as a headline ("Garante a vaga com 13 pontos."), the facts, how each result of the next game changes the share of combinations that qualify, then, near the end (up to 8 games left in the group and 2 of ours), a card per result of ours with what the other games have to be, and the ladder of final points. Odds are bars in the data colour; a finish level on points with the cut line is a hatched stretch and is always named as a tie-break, never counted as in or out. Percentages never read "100%" for almost all or "0%" for a few.

### Night list (Relacionados)
The whole squad by sector, each name a switch: in = paper pill with a check, out = outlined with a plus. One list, tap to put in or take out; a counter, the draft state ("Alterações não salvas"), fill from today's line-ups, clear, save.

### Summary period
A summary can be made for today or any earlier day (or week) that has imported results: pills with the day and its game count; after midnight it opens on the last day that had games.

### Library measurement
The percentage is real play time, not the position of the bar: dragging forward does not complete a video and replaying the start does not inflate it; it never goes back. Google Drive reports nothing about playback, so those materials show the time spent with the player open after the member pressed play ("3 min no player"), never a percentage. A save that fails is shown.

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

### Direct links and link cards
A match, a result, a player, a competition edition and a library material each have an address (`/agenda/<id>`, `/partidas/<id>`, `/elenco/<id>`, `/campeonatos/<id>`, `/biblioteca/<id>?t=83`). Opening one writes it to the address bar, closing restores the page's; "Copiar link" (`CopyLinkButton`: outlined pill, link icon, label type) hands it out, and in the Library it can carry the minute on screen. Pasted in a chat, a link shows a card: the item's own title, one line of text and a banner. The site's banner (`public/brand/strix/strix-united-fc27-share.jpg`, 1200×630) is the Central's card at poster scale: ink, corner light, fine diagonal lines, crest, STRIX UNITED in display type, label type top and bottom above a hairline. A material's banner is the same layout over the material's own picture (clipped to the right side, fading into ink where the title sits), its title as large as it fits in three lines, the crest and the club in the foot. Chat apps crop: WhatsApp's compact card keeps only the middle of the image at about 3:2, so everything readable lives between x=176 and x=1024 and no frame is drawn (a frame would be cut). A new banner layout gets a new storage folder (`library/share/v2`), so every material is drawn again.

### Avisos (the bell)
A round outlined button in the top bar; the count of notices this device has not shown sits on its corner as a paper pill. The panel is the raised ink surface: label-type header, rows on hairlines (icon in an outlined square, title, one line, when). A new notice is white with a dot on its icon; a seen one is quiet. Notices are derived from data (tonight's list, the member's position in a line-up, a kick-off that moved, a result, a new material, a mark reached, the club notice): there is no inbox to manage, and closing the panel marks everything seen.

### Central, beyond the hero
Under the greeting, the club notice is a strip between two hairlines (dot + "Recado da diretoria", author and time, the message in off-white); whoever may publish it edits it there. In the next-match card, "Em jogo" (label) and one sentence say what the game is worth (the Cenários count, only when it is certain), and a moved kick-off is said under the time ("Horário mudou · era 20:40"). "Esta noite" opens with one line about the member's own night, read from the line-ups alone ("Você está escalado em 1 de 3 jogos de hoje"; the relacionados list is a media matter and is never called "a lista" here); a game he plays carries "VOCÊ · ZAG" in an outlined pill (under the name on a phone), a game already played stays on the list with its score. Every row opens what it names. For whoever builds the night, "Preparo da noite" lists the line-ups and results that are ready (green check) or missing. The Central carries no Library block and no marks block: those live on their own pages.

### Taking back instead of asking first
An action that can be undone is done at once and the toast carries the way back: the toast shows "Desfazer" as an outlined pill, pressing it reverts, and it stays 7 s (cancelling a game, removing a library material, archiving a player; line-up tools keep their own "Desfazer" beside them). `ConfirmDialog` is kept for what cannot be undone (deleting a match, a result, a competition).

### Error note
One look for a failure on any page (`ErrorNote`): an ink strip with a firmer hairline, an alert icon, the sentence in off-white, an optional technical line in grey, and "Tentar de novo" as an outlined pill when a retry exists. No hue.

### Adicionar material (Library)
The sheet a manager uses to put a video on the shelves. The link leads: it is the largest field, and as soon as a link is pasted the sheet says what it is (a paper badge with the service's name), what will be tracked for that source, and, for YouTube, fills the title with the video's own. A link that is not a video (a Drive folder, a channel, a playlist) is refused in a sentence that says what to copy instead. Only the link and the title are required; kind (Jogada / Review, two cards), theme and positions (paper chips when chosen) and audience already have an answer. A card on the right shows the material as the shelf will show it, changing as the manager types. Header and footer stay in place and only the fields scroll; the footer's left side always says what is still missing or that it is ready. On a phone it is a full-height sheet in one column, the card after the fields. No kicker over the title, no accent colour. The same sheet edits a material ("Editar material" in the card's menu, above "Remover"): it opens filled in, its footer says whether anything changed, and saving writes the title, the section and the rest over the material without touching who created it, its cover (unless the link or the cover was changed) or what each member has watched.

### A player's photo in a round token
A roster photo is framed on the face. Photos come in every shape; the ones that lost their head in a token were body shots cut out of their background (the figure standing, the head at the very top). For those the figure's own outline says where the head is, and the token closes in on head and shoulders, following the figure when it is off-centre. A photograph with its background, or a square portrait, keeps the usual framing (a little above the middle): nothing is guessed.

### Change history: a line that opens
In "Histórico desta partida" a line that kept what changed has a chevron and opens in place. A line-up change is read as a manager would say it, one row each: "+ Yuri entrou no lugar de Vini · ATA", "− Bitten saiu · MC", "↔ Nunes mudou de posição · ALA → MC", then the count (11/11 → 10/11). The sign is a small tile: paper for who came in, hollow for who left, quiet for a move; who left is struck through. No green and no red. A changed kick-off opens to "21:10 → 21:40". Rows arrive one after the other (45 ms apart); with reduced motion they are simply there.

### A tab left open across a deploy
The product never shows a raw "Failed to fetch dynamically imported module" or a 500 because the site was updated under an open tab: the tab notices the new build on its own and the next move between pages is a full load; a page or download whose file is gone reloads the tab once, on the address the member was going to; the 500 screen's "Tentar novamente" reloads when that was the cause. The signed-contract screen comes back after such a reload, with its downloads.

### Link da noite (the one public page)
`/noite/<token>` shows today's games and their line-ups to someone who is not signed in: a single ink column, the club's mark and the date on top, one row per game (kick-off, crest, opponent, competition, how many of the eleven are set), and the game's stage and pitch under the row that was tapped. It is the product's own match stage and pitch, read-only; nothing else of the site is reachable from it. The link is the day's (it changes every day) and only answers while a game of the day has a line-up; a dead link says so in one sentence and offers the site.

### Relacionados is not the line-up
The night's list holds more names than a team fields, and who starts each game is decided game by game in the Agenda. The Relacionados video keeps its pitch board (each shirt and name on the position he plays), so the words carry the difference: the piece calls itself "Relacionados da noite" in the opening, over the board in every scene, in the closing title and in the footer count ("15 relacionados"). The word "Escalação" never appears in it, and no sentence explains anything.

### The top of a story belongs to Instagram
Posted as a story, the top of the frame is covered by Instagram itself: the account's picture and name, and the music's title. In the tall format every piece's own header (crest, "STRIX UNITED", the piece's name), its rule and everything under them start 150 px lower, past that band; the feed format has no such band and keeps the header at the top.

### The Agenda's cover is the title alone
The cover says what this is and how much of it there is ("AGENDA DO DIA", the date, "06 jogos marcados · 04 jogos oficiais") and nothing about which games: the title holds the middle of the stage. The opponents, the times and the competitions are what the pages after it show, so whoever wants the night watches on.

### Partners in the generated videos
Rastro and Next Clubs sign every generated piece, always as flat white shapes (their silhouettes), never in their own colours: the pieces are one ink stage with white type, and Rastro Blue stays data language. In every frame of every piece the two marks sit small in the middle of the footer row, between the date on the left and the count on the right, the same height, a hairline between them, without a word. The Agenda do dia also closes on them: once the crest covers the frame it keeps drifting in, the frame darkens over it (deeper at the edges, so the owl stays as a shadow), and the two marks build themselves large in the middle, piece by piece. Rastro arrives left to right as its name says: the first chevron, the second, then the R drawn behind a ">" that runs across it. Next Clubs starts from its X: the two arrows come from each side and meet, the letters open outwards from them, and CLUBS settles underneath. A hairline grows from the centre under them and, once they are whole, one band of light crosses them.

### Próximo jogo takes turns (Campeonatos)
The "next game" card of a competition shows the earliest game still to play. When the competition has more than one game that night, the card takes turns between them, eight seconds each: the kick-off, the opponent and the lines about that game leave to the left and the next ones arrive from the right, while Strix stays where it is. The head says "Jogo 1 de 2" and under the fixture there is one short bar per game; the bar of the game on show fills while it is there and any bar can be pressed. It turns on one steady clock: a pointer resting on the card does not stop it (the card is the middle of the page, a pointer is nearly always there), and pressing a bar shows that game and starts its eight seconds again. With reduced motion it does not turn by itself at all, and a hidden tab keeps the game it had.

### Crests in the generated videos
A crest is never ringed or circled: a competition match is told by its competition's name written in white and by its lit row; the cover counts them as "jogos oficiais" (the expression "vale campeonato" is not used). Every crest on a screen has the same size. Names and competition names are written whole (shrunk, or split at a word), never cut with an ellipsis beside a crest. The Agenda video closes on the Strix crest alone: it lands as soon as the last page leaves and grows without pause until its disc is wider than the frame's diagonal, so the last frame has no corner left.

### Abertura (the season opens)
The one full-screen moment of the product (`SeasonOpening`), about three seconds, once. The screen is two ink halves closed along the middle: the crest comes into focus on the upper one, "Temporada 2026/27" is written in display type on the lower one with a status line under it, and the now line is drawn along the seam; then the halves part along that line and whatever comes next (the sign-in, the contract, the Central) is behind. Whoever is on the countdown when it reaches zero sees the counter rest on 00:00:00:00 ("É agora.") and then this opening; whoever signs in after the launch sees it once per device, before the contract and the walk. It is never a replayed countdown: a countdown shown after the date acts out a moment that already passed. "Pular", a click, Enter, Space or Escape end it; with reduced motion the composition stands still and leaves.

### First-visit walk
Four cards after the first sign-in (`Tour`): the site dims, the control being explained stays lit inside a hairline frame, a card (ink-1, line-3, radius 20, sheet shadow) sits beside or under it with a counter, a title, two lines and Pular / Voltar / Próximo. Arrow keys and Enter move, Escape leaves; it is taken once per member per device and can be opened again from the search.

### Library focus
"Indicado para" is a row of position chips in the material's header (on = paper); it never hides a material, it only says who should watch first, and the card of such a material says "Indicado para a sua posição" on a paper tag for those players. There are no marked moments inside a video: what is shared is the link at the minute on screen. The video takes at most half the screen's height in the dialog so the actions stay in view.

### Line-up tools and the opponent's card
While editing a line-up: "Repetir última escalação", "Sugerir escalação", "Limpar" and, after any of them, "Desfazer", as outlined pills above the pitch with one line saying what was done; the player chooser says how much each one has played ("2 jogos na semana · jogou ontem"). Rotation belongs to the Agenda: the night list in Mídia stays a plain list of names. On the match sheet, under the pitch: "Adversário" in two columns on hairlines (Strix's record against it with the last games; its published results in this competition), with result marks like the Central's form chips (paper = win, outline = draw, quiet = loss). Whoever runs the Agenda also sees "Histórico desta partida".

### Player progress and comparison
The ficha carries "Últimos 7 dias" (2×2 cells: value in the data colour, the trend against the 7 days before) and "Marcos" (round numbers reached, newest first, then what is left to the next ones). In Estatísticas, "Frente a frente" compares two players with the match sheet's duel: average rating as the headline, bars growing from the centre, the leader in white.

### Obrigatório da noite
The board marks up to three plays a day from a material's menu in the Library ("Obrigatório hoje"; YouTube only, because nothing else can be measured). The same choice is in the game form of the Agenda (`.required-day`: what is marked on that game's day and "Escolher jogadas", which opens a small sheet of checkboxes over the Library). Until a player has watched them, every place that tells the day's line-up is closed to him: the match view shows the gate (`.required-gate`: label, one sentence, one primary button) where the pitch would be, the Central says "Assista às jogadas de hoje para ver a escalação", and the bell stays quiet about his position. The plays are watched in the sheet "Jogadas de hoje" (`.required-sheet`): a video under a shield with no bar, no speed and no link out, only our "Assistir / Pausar / Continuar"; it pauses by itself when the tab is not in front or the sound is off and says so in one plain line. The counted time and the plays done are the only things in the data colour. Whoever picks the team sees the board (`.required-board`) under the line-up of that day's games: one line per member with what he watched, when he opened the site, or "Isento" for Conselho, Diretoria and Desenvolvimento. Time is counted by the server, never by the browser (`shared/night-required.js`).

## Do's and Don'ts

### Do:
- **Do** give anything a person may want to send (a match, a player, a material at a minute) its own address and a "Copiar link".
- **Do** undo instead of asking when the action is reversible; ask only before what cannot come back.
- **Do** keep every "generate" action inside Mídia; other pages never offer to generate a piece.
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
- **Don't** decorate a stage with circles, rings, orbits or outlined words; and do not build it from glass panes: a stage is the Central’s now card, and its motion is the now line, the shine on the lower rule and the slow corner light.
- **Don't** colour a warning or an error: no red, no amber, no tinted stripe. A firmer hairline, an icon and plain words.
- **Don't** mark state with thick coloured side stripes on rows or cards; active rows use the 1px off-white rule or a fill step.
- **Don't** use zero-offset glows, hard offset shadows, bounce or parallax.
- **Don't** wrap rows in individual cards or build dashboards of metric tiles.
- **Don't** truncate opponent or player names; wrap in the app, shrink-then-split in the videos.
- **Don't** add a second typeface.
