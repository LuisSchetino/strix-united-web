import test from "node:test";
import assert from "node:assert/strict";
import { parseCompetitionHtml, validateCompetitionUrl } from "../shared/competition-providers.js";
import { selectPreferredKnockoutPreview } from "../shared/bracket-slots.js";

const standingsRows = `
<table><thead><tr><th>#</th><th>Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GS</th><th>SG</th></tr></thead><tbody>
<tr><td>1</td><td><strong>STRIX UNITED</strong><div><span class="forma-v">V</span><span class="forma-e">E</span></div><img src="/strix.png"></td><td>10</td><td>4</td><td>3</td><td>1</td><td>0</td><td>8</td><td>3</td><td>5</td></tr>
<tr><td>2</td><td><strong>POA CITY FC</strong></td><td>7</td><td>4</td><td>2</td><td>1</td><td>1</td><td>6</td><td>4</td><td>2</td></tr>
</tbody></table>`;

test("bloqueia SSRF, protocolos e hosts não suportados", () => {
  for (const url of ["http://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=100", "https://127.0.0.1/fifa.php?file=classificacao&campeonato=100", "file:///etc/passwd", "https://ccbclubs.com.br:8443/fifa.php?file=classificacao&campeonato=100"]) {
    assert.throws(() => validateCompetitionUrl(url));
  }
});

test("normaliza classificação CCB com destaque Strix", () => {
  const html = `<html><body><section><img src="/copa.png"><h1>COPA YESHUA</h1><span>Tipo<br><strong>Grupos + Mata-Mata</strong></span></section><h3>Classificação - Grupo 1</h3>${standingsRows}</body></html>`;
  const parsed = parseCompetitionHtml(html, "https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=100");
  assert.equal(parsed.name, "COPA YESHUA");
  assert.equal(parsed.groups[0].standings[0].team, "STRIX UNITED");
  assert.equal(parsed.strixGroup, "Grupo 1");
  assert.equal(parsed.groups[0].standings[0].points, 10);
});

test("infere o corte pela marcação visual contínua do provider", () => {
  const visualRows = standingsRows
    .replace("<tr><td>1</td>", '<tr><td><div class="posicao classifica">1</div></td>')
    .replace("<tr><td>2</td>", '<tr><td><div class="posicao">2</div></td>');
  const html = `<html><body><h1>LIGA</h1><h3>Classificação - Grupo 1</h3>${visualRows}</body></html>`;
  const parsed = parseCompetitionHtml(html, "https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=100");
  assert.equal(parsed.groups[0].qualificationSlots, 1);
  assert.deepEqual(parsed.qualificationRule, { slots: 1, kind: "top", source: "provider_visual" });
});

test("detecta múltiplos grupos LB", () => {
  const html = `<html><body><img src="/master.png"><h2 class="card-title">MASTER LEAGUE</h2><h3>Classificação - Grupo 1</h3>${standingsRows}<h3>Classificação - Grupo 2</h3>${standingsRows.replace(/STRIX UNITED/g, "OLD SKULL")}</body></html>`;
  const parsed = parseCompetitionHtml(html, "https://www.lbesports.com/fifa.php?file=classificacao&campeonato=73&grupo=1");
  assert.equal(parsed.phase, "groups");
  assert.equal(parsed.groups.length, 2);
  assert.equal(parsed.strixGroup, "Grupo 1");
});

test("detecta estágios e times de mata-mata", () => {
  const html = `<html><body><img src="/copa.png"><h1>COPA YESHUA</h1><table><tr><td>Quartas de final<br>10/08/2026 23:10</td><td>Semifinais</td><td>Final</td></tr>${"x".repeat(500)}<tr><td><a title="STRIX UNITED">STRIX UNITED</a></td><td><a title="POA CITY FC">POA CITY FC</a></td></tr></table></body></html>`;
  const parsed = parseCompetitionHtml(html, "https://ccbclubs.com.br/fifa.php?file=eliminatoria&campeonato=100&grupo=12");
  assert.equal(parsed.phase, "knockout");
  assert.ok(parsed.knockout.stages.some((stage) => /quartas/i.test(stage)));
  assert.equal(parsed.knockout.hasStrix, true);
  assert.equal(parsed.knockout.currentStage, "Quartas de final");
  assert.equal(parsed.knockout.fixtures[0].awayTeamName, "POA CITY FC");
  assert.equal(parsed.knockout.fixtures[0].scheduledAt, "2026-08-10T23:10:00-03:00");
});

test("associa ao time a logo posicionada antes do link no bracket CCB", () => {
  const html = `<html><body><h1>COPA</h1><table><tr><td>Quartas de final<br>10/08/2026 23:10</td><td>Semifinais</td><td>Final</td></tr>${"x".repeat(500)}<tr><td><img alt="STRIX UNITED" src="/strix.png"><a title="STRIX UNITED">STRIX UNITED</a></td><td><img alt="POA CITY FC" src="/poa.png"><a title="POA CITY FC">POA CITY FC</a></td></tr></table></body></html>`;
  const parsed = parseCompetitionHtml(html, "https://ccbclubs.com.br/fifa.php?file=eliminatoria&campeonato=100&grupo=12");
  assert.equal(parsed.knockout.fixtures[0].homeLogo, "https://ccbclubs.com.br/strix.png");
  assert.equal(parsed.knockout.fixtures[0].awayLogo, "https://ccbclubs.com.br/poa.png");
});

test("discovers fixtures in paginated round pages without competition-specific rules", () => {
  const card = `<div class="glass-dark game-card"><div class="game-top">VPR ELITE - Rodada 4</div><div class="game-main"><div class="game-team">STRIX UNITED<img src="/strix.png"></div><div class="game-score">- x -</div><div class="game-team">Tesoura City<img src="/tesoura.png"></div></div><div class="game-bottom">10/08/2026 23:40 <button data-rodada="13097" data-torneio="106">Jogo</button></div></div>`;
  const html = `<html><body><h1>VPR ELITE</h1><p>Classificam 8</p><h3>Classificacao - Grupo 2</h3>${standingsRows}${card}${"x".repeat(500)}</body></html>`;
  const parsed = parseCompetitionHtml(html, "https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=106&grupo=2&pagina=9");
  assert.equal(parsed.fixtures.length, 1);
  assert.equal(parsed.fixtures[0].externalMatchId, "ccb:106:13097");
  assert.equal(parsed.fixtures[0].awayTeamName, "Tesoura City");
  assert.equal(parsed.fixtures[0].scheduledAt, "2026-08-10T23:40:00-03:00");
  assert.equal(parsed.qualificationRule.slots, 8);
});

test("normalizes LB match-card fixtures and detail identifiers", () => {
  const card = `<div class="match-card"><div class="match-main"><div class="match-team match-team-home"><a><img src="/fenix.png" alt="Fenix"></a><small>Fenix</small><small class="match-status status-finalizado">Finalizado</small></div><div class="match-score-wrap"><div class="match-score">0 <span>x</span> 6</div></div><div class="match-team match-team-away"><a><img src="/strix.png" alt="STRIX UNITED"></a><small>STRIX UNITED</small></div></div><div class="match-footer"><span class="match-date">20/07/2026 22:10</span><a class="match-details-btn" href="fifa.php?file=jogo&idRodada=15381&torneio=73">Ver detalhes</a></div></div>`;
  const html = `<html><body><h1>MASTER LEAGUE</h1><h3>Classificacao - Grupo 1</h3>${standingsRows}${card}${"x".repeat(500)}</body></html>`;
  const parsed = parseCompetitionHtml(html, "https://www.lbesports.com/fifa.php?file=classificacao&campeonato=73&grupo=1");
  assert.equal(parsed.fixtures.length, 1);
  assert.equal(parsed.fixtures[0].externalMatchId, "lb_esports:73:15381");
  assert.equal(parsed.fixtures[0].homeTeamName, "Fenix");
  assert.equal(parsed.fixtures[0].awayTeamName, "STRIX UNITED");
  assert.equal(parsed.fixtures[0].awayLogo, "https://www.lbesports.com/strix.png");
  assert.equal(parsed.fixtures[0].scheduledAt, "2026-07-20T22:10:00-03:00");
  assert.equal(parsed.fixtures[0].homeScore, 0);
  assert.equal(parsed.fixtures[0].awayScore, 6);
  assert.equal(parsed.fixtures[0].status, "completed");
});

test("omits empty round of 16 when the official bracket starts at quarterfinals", () => {
  const html = `<html><body><h1>COPA</h1><table><tr><td>Oitavas de final</td><td>Quartas de final<br>10/08/2026 23:10</td><td>Semifinais</td><td>Final</td></tr>${"x".repeat(500)}<tr><td><a title="A">A</a></td><td><a title="STRIX UNITED">STRIX UNITED</a></td></tr></table></body></html>`;
  const parsed = parseCompetitionHtml(html, "https://ccbclubs.com.br/fifa.php?file=eliminatoria&campeonato=100&grupo=12");
  assert.deepEqual(parsed.knockout.rounds.map((round) => round.type), ["quarterfinal", "semifinal", "final"]);
});

test("reconciles every populated bracket round and replaces provider placeholders", () => {
  const team = (name, score, offset = 0) => `<tr>${offset ? `<td colspan="${offset}"></td>` : ""}<td><img alt="${name}" src="/${name}.png"><a title="${name}">${name}</a></td><td>${score ?? "-"}</td></tr>`;
  const html = `<html><body><h1>SUPERLIGA</h1><table>
    <tr><td colspan="4">Quartas de final<br>10/08/2026 21:40</td><td colspan="4">Semifinais<br>11/08/2026 21:40</td><td colspan="4">Final<br>13/08/2026 21:40</td></tr>
    ${team("A", 2)}${team("B", 0)}${team("C", 2)}${team("D", 1)}${team("E", 0)}${team("STRIX UNITED", 2)}${team("G", 0)}${team("H", 3)}
    ${team("A", 3, 4)}${team("C", 2, 4)}${team("STRIX UNITED", 0, 4)}${team("H", 2, 4)}
    ${team("H", null, 8)}${team("A", null, 8)}
  </table>${"x".repeat(500)}</body></html>`;
  const parsed = parseCompetitionHtml(html, "https://ccbclubs.com.br/fifa.php?file=eliminatoria&campeonato=97&grupo=12");
  assert.equal(parsed.knockout.currentStage, "Final");
  assert.equal(parsed.knockout.fixtures.length, 7);
  assert.deepEqual(parsed.knockout.fixtures.filter((fixture) => fixture.roundLabel === "Semifinais").map((fixture) => [fixture.homeTeamName, fixture.awayTeamName]), [["A", "C"], ["STRIX UNITED", "H"]]);
  const final = parsed.knockout.fixtures.find((fixture) => fixture.roundLabel === "Final");
  assert.equal(final.homeTeamName, "H");
  assert.equal(final.awayTeamName, "A");
  assert.equal(final.status, "scheduled");
});

test("seleciona a árvore eliminatória mais completa sem depender da competição", () => {
  const quarterfinal = { sourceKind: "knockout", source: "qf", fetchedAt: "2026-08-13T20:00:00Z", knockout: { currentStage: "Quartas de final", hasStrix: true, fixtures: Array.from({ length: 4 }, (_, index) => ({ roundLabel: "Quartas de final", bracketPosition: index, homeTeamName: `A${index}`, awayTeamName: `B${index}`, status: "completed", homeScore: 1, awayScore: 0 })) } };
  const final = { sourceKind: "knockout", source: "final", fetchedAt: "2026-08-13T19:00:00Z", knockout: { currentStage: "Final", hasStrix: true, fixtures: [...quarterfinal.knockout.fixtures, { roundLabel: "Semifinais", homeTeamName: "A0", awayTeamName: "A1", status: "completed", homeScore: 2, awayScore: 1 }, { roundLabel: "Semifinais", homeTeamName: "A2", awayTeamName: "STRIX UNITED", status: "completed", homeScore: 0, awayScore: 2 }, { roundLabel: "Final", homeTeamName: "A0", awayTeamName: "STRIX UNITED", status: "scheduled", homeScore: null, awayScore: null }] } };
  assert.equal(selectPreferredKnockoutPreview([quarterfinal, final]), final);
});

test("the provider's list of tournaments in progress is read card by card", async () => {
  const { parseTournamentList, TOURNAMENT_LISTS } = await import("../shared/competition-providers.js");
  const html = `<div class="torneios-lista">
    <div class="torneio-card torneio-item"><div class="torneio-logo-box"><img src="src/image/proclubs/Torneios/Logo A 1.png" alt=""></div>
      <div class="torneio-info"><div class="torneio-title"><h3>P11 - CHAMPIONS TROPHY</h3><span class="badge-purple">EM ANDAMENTO</span></div>
      <div class="torneio-meta"><div><span>Início<br><strong>05/10/2026</strong></span></div><div><span>Times<br><strong>16</strong></span></div><div><span>Plataforma<br><strong>PS5</strong></span></div></div></div>
      <div class="torneio-premio"><a href="fifa.php?file=classificacao&campeonato=123" class="btn-torneio">VER</a></div></div>
    <div class="modal fade" id="modalTorneio123"><a href="fifa.php?file=classificacao&campeonato=123">dup</a></div>
    <div class="torneio-card torneio-item"><h3>COPA &amp; LIGA</h3><a href="fifa.php?file=classificacao&amp;campeonato=122">VER</a></div>
    <div class="torneio-card torneio-item"><h3>SEM LINK</h3></div>
  </div>`;
  const list = parseTournamentList(html, TOURNAMENT_LISTS.ccb);
  assert.deepEqual(list.map((item) => item.id), ["123", "122"]);
  assert.equal(list[0].name, "P11 - CHAMPIONS TROPHY");
  assert.equal(list[0].teams, 16);
  assert.equal(list[0].startsAt, "05/10/2026");
  assert.equal(list[0].platform, "PS5");
  assert.equal(list[0].url, "https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=123");
  assert.equal(list[0].logo, "https://ccbclubs.com.br/src/image/proclubs/Torneios/Logo%20A%201.png");
  assert.equal(list[1].name, "COPA & LIGA");
  assert.equal(validateCompetitionUrl(list[1].url).competitionId, "122");
});

test("discovery marks a tournament only when its table was read: unreadable tables stay unknown", async () => {
  const { discoverTournaments } = await import("../shared/competition-bundle.js");
  const list = `<div class="torneio-card torneio-item"><h3>TORNEIO X</h3><a href="fifa.php?file=classificacao&campeonato=77">VER</a></div>`;
  const requested = [];
  const loadPage = async (url) => {
    requested.push(String(url));
    return String(url).includes("file=torneio") ? list : "<html><body>sem tabela</body></html>";
  };
  const result = await discoverTournaments("ccb", loadPage);
  assert.equal(requested[0], "https://ccbclubs.com.br/fifa.php?file=torneio&status=andamento");
  assert.equal(result.tournaments.length, 1);
  assert.equal(result.tournaments[0].id, "77");
  assert.equal(result.tournaments[0].strix, null, "tabela vazia ou ilegível não vira 'não participa'");
  await assert.rejects(() => discoverTournaments("desconhecido", loadPage), /Provider não suportado/);
});

test("an edition is read page by page: a failed page is retried, and what still fails is reported", async () => {
  const { assembleCompetitionBundle } = await import("../shared/competition-bundle.js");
  const base = "https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=77";
  const group = (number, strix = false) => ({
    sourceKind: "standings", externalCompetitionId: "77", source: `${base}&grupo=${number}`,
    groups: [{ name: `Grupo ${number}`, isStrixGroup: strix, standings: [] }],
    fixtures: [{ externalMatchId: `g${number}-1` }], relatedSourceUrls: [],
  });
  const attempts = {};
  const progress = [];
  const loadPreview = async (url) => {
    attempts[url] = (attempts[url] || 0) + 1;
    if (url === `${base}&grupo=2`) return { ...group(2, true), relatedSourceUrls: [`${base}&grupo=1`, `${base}&grupo=3`, `${base}&grupo=4`] };
    if (url === `${base}&grupo=3` && attempts[url] === 1) throw new Error("provider_timeout");
    if (url === `${base}&grupo=4`) throw new Error("provider_http_503");
    return group(Number(new URL(url).searchParams.get("grupo")));
  };
  const bundle = await assembleCompetitionBundle(`${base}&grupo=2`, loadPreview, { concurrency: 2, onProgress: (state) => progress.push(`${state.done}/${state.total}`) });
  assert.deepEqual(bundle.groups.map((item) => item.name), ["Grupo 1", "Grupo 2", "Grupo 3"], "grupos na ordem natural, com o que foi lido na segunda tentativa");
  assert.equal(bundle.groups.find((item) => item.isStrixGroup).name, "Grupo 2");
  assert.equal(attempts[`${base}&grupo=3`], 2);
  assert.deepEqual(bundle.sourceReport, { expected: 4, failed: 1, failedUrls: [`${base}&grupo=4`] });
  assert.equal(progress[0], "1/4");
  assert.equal(progress.at(-1), "4/4");
});

test("the page reader only opens provider pages: a competition page or the tournament list", async () => {
  const { validateProviderPageUrl, TOURNAMENT_LISTS } = await import("../shared/competition-providers.js");
  assert.equal(validateProviderPageUrl(TOURNAMENT_LISTS.ccb), TOURNAMENT_LISTS.ccb);
  assert.equal(validateProviderPageUrl("https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=122&grupo=2#rodadas"), "https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=122&grupo=2");
  for (const url of ["https://ccbclubs.com.br/fifa.php?file=torneio&status=encerrado", "https://ccbclubs.com.br/admin.php", "https://example.com/fifa.php?file=classificacao&campeonato=1", "http://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=1", "nada"]) {
    assert.throws(() => validateProviderPageUrl(url), undefined, url);
  }
});

test("a sync keeps the stored copy of a competition logo instead of going back to the provider original", async () => {
  const { competitionLogoStem, isStoredCompetitionLogo, logoAfterSync } = await import("../shared/competition-logo.js");
  const stored = "https://x.supabase.co/storage/v1/object/public/fc27-team-assets/competitions/ccb-123-0a1b2c3d.webp";
  const original = "https://ccbclubs.com.br/src/image/proclubs/Torneios/Logo.png";
  assert.equal(isStoredCompetitionLogo(stored), true);
  assert.equal(isStoredCompetitionLogo(original), false);
  assert.equal(logoAfterSync(stored, original), stored);
  assert.equal(logoAfterSync(original, "https://ccbclubs.com.br/novo.png"), "https://ccbclubs.com.br/novo.png");
  assert.equal(logoAfterSync(null, null), null);
  assert.match(competitionLogoStem("ccb", "123", original), /^competitions\/ccb-123-[0-9a-f]{8}$/);
  assert.notEqual(competitionLogoStem("ccb", "123", original), competitionLogoStem("ccb", "123", `${original}?v=2`));
});
