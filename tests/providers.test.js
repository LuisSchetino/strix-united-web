import test from "node:test";
import assert from "node:assert/strict";
import { parseCompetitionHtml, validateCompetitionUrl } from "../shared/competition-providers.js";

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

test("omits empty round of 16 when the official bracket starts at quarterfinals", () => {
  const html = `<html><body><h1>COPA</h1><table><tr><td>Oitavas de final</td><td>Quartas de final<br>10/08/2026 23:10</td><td>Semifinais</td><td>Final</td></tr>${"x".repeat(500)}<tr><td><a title="A">A</a></td><td><a title="STRIX UNITED">STRIX UNITED</a></td></tr></table></body></html>`;
  const parsed = parseCompetitionHtml(html, "https://ccbclubs.com.br/fifa.php?file=eliminatoria&campeonato=100&grupo=12");
  assert.deepEqual(parsed.knockout.rounds.map((round) => round.type), ["quarterfinal", "semifinal", "final"]);
});
