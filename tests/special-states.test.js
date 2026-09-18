import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyAuthFailure } from "../src/ui/special-state/classify-auth-failure.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("special states cover the product error screens without raw stacks", async () => {
  const [screen, accessDenied, main, developer] = await Promise.all([
    read("../src/ui/special-state/SpecialState.jsx"),
    read("../src/ui/AccessDenied.jsx"),
    read("../src/main.jsx"),
    read("../src/features/developer/DeveloperPage.jsx"),
  ]);
  for (const kind of ["offline", "not-found", "forbidden", "session", "unexpected", "unavailable", "restricted"]) {
    assert.match(screen, new RegExp(`"${kind}"|${kind.replace("-", "\\-")}:`));
  }
  assert.match(screen, /Tentar novamente/);
  assert.match(screen, /Ir para a Central/);
  assert.match(screen, /Entrar novamente/);
  assert.match(screen, /Verificar conexão/);
  assert.match(screen, /Recurso não público/);
  assert.doesNotMatch(screen, /error\.stack/);
  assert.match(accessDenied, /kind="forbidden"/);
  assert.match(main, /AppErrorBoundary/);
  assert.match(main, /kind="offline"/);
  assert.match(main, /kind="session"/);
  assert.match(main, /kind="not-found"/);
  assert.match(main, /kind="restricted"/);
  assert.match(main, /function DataPage[\s\S]*if \(!canViewPage[\s\S]*return <AccessDenied[\s\S]*MediaPage/);
  assert.match(main, /AUTH_FETCH_MS/);
  assert.match(main, /setRoute/);
  assert.match(developer, /AccessDenied page="desenvolvedor"/);
});

test("auth failure classification keeps Discord ACL errors off the session screen", () => {
  assert.equal(classifyAuthFailure("supabase_not_configured"), "unavailable");
  assert.equal(classifyAuthFailure({ message: "JWT expired", status: 401 }, { hadSession: true }), "session");
  assert.equal(classifyAuthFailure({ message: "invalid_session", status: 401 }, { hadSession: true }), "session");
  assert.equal(classifyAuthFailure({ name: "AbortError", message: "The user aborted a request" }, { hadSession: true }), "session");
  assert.equal(classifyAuthFailure({ message: "not_in_team_server", status: 403 }, { hadSession: true }), "");
  assert.equal(classifyAuthFailure({ message: "insufficient_permission", status: 403 }, { hadSession: true }), "");
});
