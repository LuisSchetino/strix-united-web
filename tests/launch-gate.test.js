import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  LAUNCH_CONFIG,
  consumeLaunchReturn,
  countdownParts,
  displayRemainingMs,
  isLaunchConfigPending,
  isLaunchGateHost,
  isOfficialLaunchHost,
  isQaPreviewHost,
  isLaunchUnlocked,
  launchGateDecision,
  parseLaunchAt,
  rememberLaunchReturn,
  remainingMs,
} from "../src/launch.js";

const official = "strixunited.com.br";
const www = "www.strixunited.com.br";
const qa = "strix-united-fc27.pages.dev";
const otherPages = "algum-outro.pages.dev";
const launchAt = "2026-10-06T20:00:00-03:00";
const pre = Date.parse("2026-09-16T23:00:00-03:00");
const justBefore = Date.parse("2026-10-06T19:59:59-03:00");
const exact = Date.parse(launchAt);
const post = Date.parse("2026-10-06T20:00:01-03:00");
const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

test("launchAt is the absolute Sao Paulo instant", () => {
  assert.equal(LAUNCH_CONFIG.enabled, true);
  assert.equal(LAUNCH_CONFIG.timezone, "America/Sao_Paulo");
  assert.equal(LAUNCH_CONFIG.launchAt, launchAt);
  assert.equal(parseLaunchAt(LAUNCH_CONFIG), exact);
  assert.equal(isLaunchConfigPending(LAUNCH_CONFIG), false);
  assert.equal(isLaunchUnlocked(justBefore, LAUNCH_CONFIG), false);
  assert.equal(isLaunchUnlocked(exact, LAUNCH_CONFIG), true);
  assert.equal(isLaunchUnlocked(post, LAUNCH_CONFIG), true);
});

test("official apex pre-launch shows countdown", () => {
  assert.equal(isOfficialLaunchHost(official), true);
  assert.equal(
    launchGateDecision({ hostname: official, now: pre, profile: null, authLoading: false, config: LAUNCH_CONFIG }),
    "countdown",
  );
});

test("www pre-launch matches the apex", () => {
  assert.equal(isOfficialLaunchHost(www), true);
  assert.equal(
    launchGateDecision({ hostname: www, now: pre, profile: null, authLoading: false, config: LAUNCH_CONFIG }),
    "countdown",
  );
});

test("DEV bypasses the official gate before launch", () => {
  assert.equal(
    launchGateDecision({
      hostname: official,
      now: pre,
      profile: { access_tier: "dev" },
      authLoading: false,
      config: LAUNCH_CONFIG,
    }),
    "app",
  );
});

test("non-DEV stays on the gate before launch", () => {
  for (const tier of ["diretoria", "conselho", "player", "teste"]) {
    assert.equal(
      launchGateDecision({
        hostname: official,
        now: pre,
        profile: { access_tier: tier },
        authLoading: false,
        config: LAUNCH_CONFIG,
      }),
      "countdown",
    );
  }
});

test("internal access does not grant bypass by itself", () => {
  assert.equal(
    launchGateDecision({ hostname: official, now: pre, profile: null, authLoading: false, config: LAUNCH_CONFIG }),
    "countdown",
  );
  assert.equal(
    launchGateDecision({
      hostname: official,
      now: pre,
      profile: { access_tier: "diretoria" },
      authLoading: false,
      config: LAUNCH_CONFIG,
    }),
    "countdown",
  );
});

test("FC27 pages.dev bypasses the gate", () => {
  assert.equal(isQaPreviewHost(qa), true);
  assert.equal(isLaunchGateHost(qa), false);
  assert.equal(
    launchGateDecision({ hostname: qa, now: pre, profile: null, authLoading: false, config: LAUNCH_CONFIG }),
    "app",
  );
});

test("other pages.dev hosts do not bypass the gate", () => {
  assert.equal(isQaPreviewHost(otherPages), false);
  assert.equal(isQaPreviewHost("pages.dev"), false);
  assert.equal(isLaunchGateHost(otherPages), true);
  assert.equal(
    launchGateDecision({ hostname: otherPages, now: pre, profile: null, authLoading: false, config: LAUNCH_CONFIG }),
    "countdown",
  );
});

test("post-launch unlocks every role on the official domain", () => {
  for (const profile of [null, { access_tier: "player" }, { access_tier: "diretoria" }, { access_tier: "dev" }]) {
    assert.equal(
      launchGateDecision({ hostname: official, now: post, profile, authLoading: false, config: LAUNCH_CONFIG }),
      "app",
    );
  }
});

test("deep link is remembered across internal access and not rewritten to central", async () => {
  const storage = memoryStorage();
  assert.equal(rememberLaunchReturn("/agenda", storage), "/agenda");
  assert.equal(consumeLaunchReturn(storage), "/agenda");
  assert.equal(consumeLaunchReturn(storage), "");
  const [main, gate] = await Promise.all([
    readFile(new URL("../src/main.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/launch/LaunchGate.jsx", import.meta.url), "utf8"),
  ]);
  assert.match(gate, /Acesso interno/);
  assert.match(gate, /rememberLaunchReturn/);
  assert.match(gate, /onInternalAccess/);
  assert.match(main, /onInternalAccess=\{auth\.signIn\}/);
  assert.match(main, /consumeLaunchReturn/);
  assert.match(main, /pageFromLocation/);
  assert.doesNotMatch(main, /LaunchGate[\s\S]{0,400}navigate\("central"\)/);
  assert.doesNotMatch(gate, /TODO\/CONFIG/);
  assert.doesNotMatch(gate, /DATA EM REVISÃO/);
});

test("session check renders bootstrap, never login, while auth is loading on official host", () => {
  assert.equal(
    launchGateDecision({ hostname: official, now: pre, profile: null, authLoading: true, config: LAUNCH_CONFIG }),
    "bootstrap",
  );
});

test("public countdown uses the real remaining time", () => {
  const left = displayRemainingMs(pre, LAUNCH_CONFIG);
  assert.equal(left, remainingMs(pre, LAUNCH_CONFIG));
  assert.ok(left > 0);
  assert.equal(countdownParts(left).days >= 19, true);
  assert.doesNotMatch(String(LAUNCH_CONFIG.launchAt), /TODO\/CONFIG/);
});

test("disabled config never gates", () => {
  assert.equal(
    launchGateDecision({
      hostname: official,
      now: pre,
      profile: null,
      config: { ...LAUNCH_CONFIG, enabled: false },
    }),
    "app",
  );
});
