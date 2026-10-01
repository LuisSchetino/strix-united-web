import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canShowInternalAccess, isOfficialLaunchHost } from "../src/launch.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("o botão visual continua inexistente no domínio oficial", () => {
  assert.equal(isOfficialLaunchHost("strixunited.com.br"), true);
  assert.equal(canShowInternalAccess("strixunited.com.br"), false);
  assert.equal(canShowInternalAccess("www.strixunited.com.br"), false);
});

test("atalho secreto reutiliza o fluxo existente e só vale no countdown do domínio oficial", async () => {
  const gate = await read("src/features/launch/LaunchGate.jsx");
  const effect = gate.slice(gate.indexOf('window.addEventListener("keydown"') - 700, gate.indexOf('removeEventListener("keydown"') + 120);
  assert.match(gate, /const handleInternalAccess = async \(\) => \{[\s\S]*rememberLaunchReturn[\s\S]*setSigningIn\(true\)[\s\S]*setSignInError\(""\)[\s\S]*await onInternalAccess\(\)/);
  assert.match(gate, /onClick=\{handleInternalAccess\}/, "o botão existente usa o mesmo handler");
  assert.match(effect, /mode !== "countdown" \|\| !onInternalAccess \|\| !isOfficialLaunchHost\(window\.location\.hostname\)/);
  assert.match(effect, /event\.ctrlKey && event\.shiftKey && event\.altKey && String\(event\.key\)\.toLowerCase\(\) === "d"/);
  assert.match(effect, /event\.preventDefault\(\)/);
  assert.match(effect, /internalAccessRef\.current\.busy/);
  assert.match(effect, /removeEventListener\("keydown", handleKeyDown\)/);
});

test("a combinação não aparece em nenhum texto, aria-label, tooltip ou CSS da interface", async () => {
  const [gate, css, html] = await Promise.all([
    read("src/features/launch/LaunchGate.jsx"),
    read("src/features/launch/launch.css"),
    read("index.html"),
  ]);
  const visible = gate.replace(/event\.ctrlKey[^\n]*\n/g, "");
  for (const source of [visible, css, html]) assert.doesNotMatch(source, /Ctrl\s*\+|Shift\s*\+|Alt\s*\+|atalho/i);
  assert.doesNotMatch(gate, /title=|aria-keyshortcuts/);
});
