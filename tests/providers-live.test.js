import test from "node:test";
import assert from "node:assert/strict";
import { parseCompetitionHtml } from "../shared/competition-providers.js";
import { fetchCompetitionBundle } from "../functions/_lib/competition-providers.js";

const live = process.env.RUN_LIVE_PROVIDER_TESTS === "1";
const sources = [
  ["CCB classificação", "https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=100", "standings"],
  ["CCB mata-mata", "https://ccbclubs.com.br/fifa.php?file=eliminatoria&campeonato=100&grupo=12", "knockout"],
  ["CCB mata-mata Superliga", "https://ccbclubs.com.br/fifa.php?file=eliminatoria&campeonato=97&grupo=12", "knockout"],
  ["LB múltiplos grupos", "https://www.lbesports.com/fifa.php?file=classificacao&campeonato=73&grupo=1", "standings"],
];

for (const [name, url, kind] of sources) {
  test(name, { skip: !live, timeout: 30000 }, async () => {
    const response = await fetch(url, { headers: { accept: "text/html", "user-agent": "StrixFC27ProviderVerifier/1.0" } });
    assert.equal(response.ok, true);
    const parsed = parseCompetitionHtml(await response.text(), url);
    assert.equal(parsed.sourceKind, kind);
    assert.ok(parsed.name.length > 2);
    if (kind === "standings") {
      assert.ok(parsed.groups.length > 0);
      assert.ok(parsed.groups.some((group) => group.standings.some((row) => row.isStrix)));
      const strixGroup = parsed.groups.find((group) => group.standings.some((row) => row.isStrix));
      const strix = strixGroup.standings.find((row) => row.isStrix);
      assert.ok(Number(strix.position) > 0);
      assert.ok(Number(strix.points) >= 0);
      assert.ok(Number(parsed.qualificationRule?.slots) > 0);
      if (name.startsWith("CCB")) assert.match(parsed.name, /COPA YESHUA/i);
      if (name.startsWith("LB")) {
        assert.ok(parsed.groups.length >= 3);
        assert.ok(parsed.fixtures.length > 0);
        assert.ok(parsed.fixtures.some((fixture) => fixture.isStrix));
      }
    } else {
      assert.ok(parsed.knockout.stages.length > 0);
      assert.equal(parsed.knockout.hasStrix, true);
      assert.equal(parsed.knockout.fixtures.length, 7);
      assert.ok(parsed.knockout.fixtures.some((fixture) => fixture.roundLabel === "Final"));
    }
  });
}

test("CCB relaciona classificação e eliminatória da Copa Yeshua", { skip: !live, timeout: 30000 }, async () => {
  const bundle = await fetchCompetitionBundle("https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=100");
  const knockout = bundle.relatedPreviews.find((preview) => preview.sourceKind === "knockout");
  assert.equal(knockout.externalCompetitionId, bundle.externalCompetitionId);
  assert.ok(knockout.knockout.rounds.some((round) => round.name === knockout.knockout.currentStage));
  assert.ok(knockout.knockout.fixtures.some((fixture) => fixture.roundLabel === knockout.knockout.currentStage));
  assert.ok(knockout.knockout.fixtures.some((fixture) => fixture.isStrix));
});

test("CCB discovers VPR Elite fixtures across paginated rounds", { skip: !live, timeout: 60000 }, async () => {
  const bundle = await fetchCompetitionBundle("https://ccbclubs.com.br/fifa.php?file=classificacao&campeonato=106&grupo=2");
  const strixFixtures = bundle.fixtures.filter((fixture) => fixture.isStrix);
  assert.ok(strixFixtures.length >= 4);
  assert.ok(strixFixtures.some((fixture) => fixture.status === "scheduled" && /Tesoura City/i.test(`${fixture.homeTeamName} ${fixture.awayTeamName}`)));
});
