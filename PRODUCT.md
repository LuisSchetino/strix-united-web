# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Roster players (primary).** Members of the Strix United Pro Clubs squad (EA FC27) who log in through Discord to see what is happening with the club tonight and this season: the next match, the night's schedule, recent results and where the club stands. They open it on the phone before and between matches far more than on desktop.
- **Conselho / Diretoria.** Same product, plus analysis (Conselho+) and management of agenda, lineup, roster and library (Diretoria+).
- **Desenvolvimento (dev tier).** Operates everything, including EA match import, competitions, the Central Media (social video/image generation) and developer tools.

Access tier comes from the member's current Discord roles (`team_members.access_tier`: teste < player < conselho < diretoria < dev). The browser never authorizes a mutation.

## Product Purpose

The club's private operating space for the FC27 season: Agenda (tonight's matches and lineups), match history imported from EA, roster, competitions (CCB / Liga providers, standings, brackets, scenarios), statistics and analysis computed only from reconciled real data, a review library, and a Central Media that produces the club's social pieces (Agenda do Dia, Relacionados da Noite, Resumo do Dia/Semana, Anúncios FC27) as MP4/PNG in the browser.

Success: a player opening the app understands in seconds what is happening tonight and where the club is; staff run match nights without friction; social pieces come out on-brand without anyone touching technical concepts.

## Positioning

It is the club's own room, not a generic team-management SaaS: Discord is the source of truth for who belongs, EA data is the source of truth for what happened, and nothing is filled in by guesswork.

## Operating Context

- Match nights: several friendlies/competition games in sequence (e.g. 21:10, 21:40, 22:10), lineups set in the Agenda, results imported from EA afterwards.
- Season contract: every member signs the FC27 contract on first login (UX state in user metadata).
- Launch Gate controls public opening; dev tier can pass it.
- EA Sync runs as a separate service/bridge; competitions sync from external providers.
- Social pieces are posted to Instagram (Reels 9:16, Post 4:5).

## Capabilities and Constraints

- React 19 + Vite SPA, Cloudflare Pages Functions, Supabase (auth via Discord, Postgres with RLS, Realtime, Storage).
- Video generation is canvas painters + timelines encoded to H.264 in the browser (mp4-muxer); no server rendering.
- ACL lives in `src/access.js` mirrored server-side; do not change business rules or access tiers without an explicit decision.
- Central Media stays exclusive to the dev tier (confirmed 2026-10-02).
- Home shows club context only — no individual player statistics on the Home (confirmed 2026-10-02). Player identity on the Home is the authenticated profile (name, avatar, tier), not inferred stats.
- The link between a Discord login and a roster player is name-based only; there is no hard user↔player key.
- Never invent metrics; missing EA data renders as "—", never as zero.

## Brand Commitments

- Name: Strix United (FC 27). Crest: the Strix owl badge (`public/brand/strix`).
- Voice: Portuguese (pt-BR), short, confident, club-room tone ("A noite começa aqui.").
- Base palette commitment from the club: black, graphite, off-white, neutrals and hairlines; the general UI must not read as blue.
- **Rastro Blue `#2F80FF` belongs to the Rastro system** (the analytics/data partner signature: "Powered by Rastro", "Analytics by Rastro"). It is kept, never replaced, and never spread into Strix structural UI.
- Next Clubs is the competitions partner brand; competition identity colors come from the competition itself.
- The Agenda is the reference surface for hierarchy, typography, density and editorial composition.

## Evidence on Hand

- Real data only from Supabase tables (`agenda_matches`, `club_matches` with raw EA payloads, `club_players`, competitions, `night_related`).
- Brand assets in `public/brand`, collage/paper textures in `src/assets/collage` (licensed packs under `design-assets/curated/licenses`).
- No testimonials, external metrics or invented stats exist and none may be fabricated.

## Product Principles

1. Tonight first: the next match and the night's schedule outrank everything else.
2. Real data or an honest empty state — never a fallback that hides an error or a number that was not recorded.
3. One club, one voice: every surface and every generated piece must read as Strix, with Rastro clearly scoped as a partner signature.
4. Outcomes over internals: users choose what they want to make or do, never renderer/engine/version concepts.
5. Mobile is the main stage, not a reduced desktop.

## Accessibility & Inclusion

Respect `prefers-reduced-motion`; keyboard-operable navigation, dialogs and menus with visible focus; touch targets ≥ 44px on mobile; contrast that holds on true-black surfaces.
