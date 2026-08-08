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
