---
version: 1
slug: "src-features-home-homepage-jsx"
primary_target: "src/features/home/HomePage.jsx"
related_targets: ["src/features/home/home.css"]
---

Scope: Home (Central) of STRIX UNITED FC27. Visitor mode: Operate.
Audience: roster players, mostly on the phone, before and between match nights. Job: understand in seconds what is happening tonight and where the club stands. Club context only — no individual statistics (confirmed 2026-10-02).
Content: authenticated profile (name, tier), agenda_matches (tonight, next days, lineup), club_matches (last result, season record and form). Nothing inferred; empty states written, never filled.

## Direction contract

THESIS: The Home is the night anchored on the present. It refuses the broadcast-hero template (VS banner + cards repeating the same match) and the dashboard of metric tiles.

OWN-WORLD: Ink (#050607) ground, one raised ink-1 surface for the next match only, off-white type, hairline dividers (rgba 255/0.06–0.16), Inter at display weight with tabular numerals, no hue except state (success dot for a defined lineup).

STORY: The player reads who they are, the next kickoff and how long until it, the night's timetable with the now line, then the last result and the season record; one action takes them to the Agenda.

FIRST VIEWPORT: Greeting (display size) with tier · season · date. Left: the now block — status line, kickoff in 124px numerals, Strix × opponent with crests, lineup state and "Ver escalação/Abrir Agenda". Right: "Esta noite" timetable with the now line. Below: Último resultado (score in score-size numerals) and Temporada (V/E/D/aproveitamento ledger + form letters).

FORM: Ledger anchored on a "now line" (structure 6 of the ranked list, THE ROLL lead), hybridised with a "Próximos dias" tail from the week strip and real status signals from the attention board. Seed key 4be9e7f2.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: the now line — a hairline with a dot that draws in from the left at the current minute inside tonight's timetable; the same mark sweeps scenes in the generated videos.
Unresolved: no hard login↔player key exists, so the Home cannot address the player's own lineup slot.
