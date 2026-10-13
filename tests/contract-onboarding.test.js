import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CONTRACT_METADATA_KEY,
  CONTRACT_SEASON,
  SIGNATURE_PATH_LIMIT,
  buildContractPayload,
  hasSignedContract,
  isMeaningfulSignature,  normalizeHandle,
  resolveContractIdentity,
  strokesToPath,
} from "../src/features/onboarding/contract-core.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const wave = (points = 60, scale = 1) => [Array.from({ length: points }, (_, index) => [20 + index * (500 / points) * scale, 100 + Math.sin(index / 4) * 60])];

test("@ é normalizado para minúsculas só na apresentação", () => {
  assert.equal(normalizeHandle("VINIDornellas"), "@vinidornellas");
  assert.equal(normalizeHandle("@@Nunes "), "@nunes");
  assert.equal(normalizeHandle(""), "");
});

test("contrato só vale para a temporada FC27 atual e com assinatura real", () => {
  const signed = { user_metadata: { [CONTRACT_METADATA_KEY]: { season: CONTRACT_SEASON, signedAt: "2026-09-30T20:00:00.000Z", signature: { d: "M1 1L9 9" } } } };
  assert.equal(hasSignedContract(signed), true);
  assert.equal(hasSignedContract({ user_metadata: {} }), false);
  assert.equal(hasSignedContract(null), false);
  assert.equal(hasSignedContract({ user_metadata: { [CONTRACT_METADATA_KEY]: { ...signed.user_metadata[CONTRACT_METADATA_KEY], season: "2025/26" } } }), false);
  assert.equal(hasSignedContract({ user_metadata: { [CONTRACT_METADATA_KEY]: { season: CONTRACT_SEASON, signedAt: "x", signature: { d: "M1 1" } } } }), false);
  assert.equal(hasSignedContract({ user_metadata: { [CONTRACT_METADATA_KEY]: { season: CONTRACT_SEASON, signedAt: "2026-09-30T20:00:00.000Z", signature: { d: "" } } } }), false);
});

test("um ponto ou risco curto não libera a assinatura; um desenho real libera", () => {
  assert.equal(isMeaningfulSignature([]), false);
  assert.equal(isMeaningfulSignature([[[10, 10]]]), false);
  assert.equal(isMeaningfulSignature([[[10, 10], [12, 11], [13, 12]]]), false);
  assert.equal(isMeaningfulSignature(wave()), true);
});

test("assinatura vira path compacto e respeita o limite do metadata", () => {
  const dense = [Array.from({ length: 4000 }, (_, index) => [(index * 7) % 600, 100 + Math.sin(index) * 90])];
  const path = strokesToPath(dense);
  assert.ok(path.startsWith("M"));
  assert.ok(path.length > 0 && path.length <= SIGNATURE_PATH_LIMIT, `path ${path.length}`);
  const dot = strokesToPath([[[50, 50]]]);
  assert.match(dot, /^M50 50L51 50$/);
  assert.equal(strokesToPath([]), "");
});

test("identidade: autenticação → perfil Strix → workspace → fallback", () => {
  const session = { user: { user_metadata: { custom_claims: { global_name: "Dornellas" }, user_name: "VINIDornellas", avatar_url: "https://cdn/a.png" } } };
  const players = [{ display_name: "DORNELLAS", positions: ["ZAG"], structure_role: "jogador", is_active: true }];
  const full = resolveContractIdentity({ session, profile: { display_name: "Outro Nome" }, players });
  assert.equal(full.name, "DORNELLAS");
  assert.equal(full.handle, "@vinidornellas");
  assert.equal(full.role, "ZAG · JOGADOR");
  assert.equal(full.avatar, "https://cdn/a.png");

  const profileOnly = resolveContractIdentity({ session: { user: { user_metadata: {} } }, profile: { display_name: "Nunes" }, players: [] });
  assert.equal(profileOnly.name, "NUNES");
  assert.equal(profileOnly.handle, "");
  assert.equal(profileOnly.role, "");

  const fallback = resolveContractIdentity({ session: null, profile: null, players: [] });
  assert.equal(fallback.name, "MEMBRO STRIX");
});

test("payload guarda só temporada, versão, data e o traço — sem nome nem @ (já existem em team_members)", () => {
  const payload = buildContractPayload({ strokes: wave(), now: new Date("2026-09-30T20:00:00Z") });
  assert.deepEqual(Object.keys(payload).sort(), ["season", "signature", "signedAt", "version"]);
  assert.equal(payload.season, CONTRACT_SEASON);
  assert.equal(payload.signedAt, "2026-09-30T20:00:00.000Z");
  assert.ok(payload.signature.d.startsWith("M"));
  assert.throws(() => buildContractPayload({ strokes: [] }), /signature_empty/);
});

test("JWT: o contrato no tamanho máximo não infla o token", () => {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const discordMeta = {
    avatar_url: "https://cdn.discordapp.com/avatars/412345678901234567/a_0123456789abcdef0123456789abcdef.png",
    custom_claims: { global_name: "Dornellas" },
    email: "vinidornellas@example.com", email_verified: true, full_name: "vinidornellas",
    iss: "https://discord.com/api", name: "vinidornellas",
    picture: "https://cdn.discordapp.com/avatars/412345678901234567/a_0123456789abcdef0123456789abcdef.png",
    provider_id: "412345678901234567", sub: "412345678901234567",
  };
  const claims = (meta) => ({
    aud: "authenticated", exp: 1790000000, iat: 1789996400, iss: "https://abcdefghijklmnop.supabase.co/auth/v1",
    sub: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", email: "vinidornellas@example.com", phone: "",
    app_metadata: { provider: "discord", providers: ["discord"] }, user_metadata: meta, role: "authenticated", aal: "aal1",
    amr: [{ method: "oauth", timestamp: 1789996400 }], session_id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", is_anonymous: false,
  });
  const token = (meta) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims(meta))}.${"s".repeat(43)}`;
  const worstCase = [Array.from({ length: 6000 }, (_, index) => [(index * 37) % 600, 100 + Math.sin(index / 3) * 95])];
  const contract = buildContractPayload({ strokes: worstCase });
  assert.ok(contract.signature.d.length <= SIGNATURE_PATH_LIMIT);
  const without = token(discordMeta).length;
  const withContract = token({ ...discordMeta, [CONTRACT_METADATA_KEY]: contract }).length;
  // Limites típicos de header: 8 KB (proxy) e 16 KB (Node). Orçamento do produto: 4,5 KB.
  assert.ok(withContract <= 4608, `JWT com contrato: ${withContract} bytes (sem: ${without}, delta: ${withContract - without})`);
  assert.ok(withContract - without <= 3000, `o contrato deve custar no máximo 3 KB no token (custou ${withContract - without})`);
});

test("onboarding persiste no usuário autenticado e bloqueia o app até assinar", async () => {
  const [main, gate, pad, css] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/features/onboarding/ContractGate.jsx"),
    read("../src/features/onboarding/SignaturePad.jsx"),
    read("../src/features/onboarding/contract.css"),
  ]);
  assert.match(main, /hasSignedContract\(contractUser\)/);
  assert.match(main, /<ContractGate/);
  assert.ok(main.indexOf("<ContractGate") < main.indexOf('<div className="app-shell">'), "o contrato precisa vir antes do app");
  assert.match(gate, /client\.auth\.updateUser\(\{ data: \{ \[CONTRACT_METADATA_KEY\]: payload, \.\.\.\(mustChoose && chosen \? \{ \[PLAYER_LINK_KEY\]: chosen \} : \{\}\) \} \}\)/);
  assert.match(gate, /session\.user\.id !== profile\?\.user_id/, "nunca assina por uma identidade ainda não revalidada");
  assert.match(gate, /export function ContractValidating/);
  assert.match(main, /<ContractValidating \/>/);
  assert.match(main, /auth\.profile\?\.user_id === contractUser\.id/);
  assert.match(main, /contractShownFor/, "o gate fica montado até a confirmação terminar");
  assert.doesNotMatch(gate + pad, /sessionStorage|localStorage/);
  assert.match(gate, /disabled=\{!ready \|\| busy \|\| \(mustChoose && !chosen\)\}/);
  assert.match(gate, /ASSINAR E CONTINUAR/);
  assert.match(gate, /CONTRATO STRIX UNITED · FC27/);
  assert.match(pad, /onPointerDown/);
  assert.match(pad, /onPointerMove/);
  assert.match(pad, /onPointerCancel/);
  assert.match(css, /touch-action:none/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("contrato assinado pode ser revisto e baixado sem reenviar assinatura", async () => {
  const [main, archive, css] = await Promise.all([
    read("../src/main.jsx"),
    read("../src/features/onboarding/SignedContractArchive.jsx"),
    read("../src/features/onboarding/contract-archive.css"),
  ]);
  assert.doesNotMatch(main, /ContractArchiveAction/, "o contrato não fica no menu");
  assert.match(main, /<SquadPageV3 workspace=\{workspace\} profile=\{auth\.profile\} contract=\{signedContract\} identity=\{contractIdentity\} client=\{auth\.client\} ownPlayer=\{ownPlayer\} declaredPlayerId=\{readPlayerLink\(auth\.session\?\.user\)\} \/>/);
  assert.match(archive, /REVER ANIMAÇÃO/);
  assert.match(archive, /<DocumentDownload contract=\{contract\} identity=\{identity\}/);
  assert.match(archive, /BAIXAR VÍDEO/);
  // Video and document are drawn from the signed payload (the same sheet, mounted
  // off-screen at its canonical size), never printed from the screen.
  assert.match(archive, /renderContractVideo\(\{ contract, identity \}\)/);
  assert.doesNotMatch(archive, /sheetRef/);
  assert.match(archive, /lockScroll: true/);
  assert.match(archive, /aria-modal="true"/);
  assert.match(css, /100dvh/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(archive, /updateUser|CONTRACT_METADATA_KEY/, "rever e baixar não assinam nem mutam metadata");
});

test("nenhuma migration nova foi criada para o contrato", async () => {
  const { readdir } = await import("node:fs/promises");
  const names = await readdir(new URL("../supabase/migrations/", import.meta.url));
  assert.equal(names.some((name) => /contract|onboarding|signature/i.test(name)), false);
});

test("a member whose Discord name is not on the roster is found by the entry they declared", async () => {
  const { PLAYER_LINK_KEY, PLAYER_LINK_NONE, matchOwnPlayerByName, readPlayerLink, resolveContractIdentity, resolveOwnPlayer } = await import("../src/features/onboarding/contract-core.js");
  const players = [
    { id: "p-dornelas", display_name: "Dornelas", positions: ["ZAG"], is_active: true },
    { id: "p-clayton", display_name: "Clayton", positions: ["ATA"], is_active: true },
    { id: "p-old", display_name: "Antigo", positions: ["GOL"], is_active: false },
  ];
  const account = (data = {}) => ({ user: { id: "u1", user_metadata: { custom_claims: { global_name: "Ninguém Do Elenco" }, ...data }, identities: [] } });
  const profile = { user_id: "u1", display_name: "Ninguém Do Elenco" };

  assert.equal(resolveOwnPlayer({ session: account(), profile, players }), null, "no name of the account is on the roster");
  assert.equal(resolveOwnPlayer({ session: account({ [PLAYER_LINK_KEY]: "p-dornelas" }), profile, players }).id, "p-dornelas");
  assert.equal(readPlayerLink(account({ [PLAYER_LINK_KEY]: " p-dornelas " }).user), "p-dornelas");
  // The declaration wins over a name that happens to match someone else.
  const named = { user_id: "u1", display_name: "Clayton" };
  assert.equal(matchOwnPlayerByName({ session: account(), profile: named, players }).id, "p-clayton");
  assert.equal(resolveOwnPlayer({ session: account({ [PLAYER_LINK_KEY]: "p-dornelas" }), profile: named, players }).id, "p-dornelas");
  assert.equal(resolveOwnPlayer({ session: account({ [PLAYER_LINK_KEY]: PLAYER_LINK_NONE }), profile: named, players }), null, "staff who said they are not on the roster");
  // An entry that left the roster, or an id that does not exist, falls back to the name.
  assert.equal(resolveOwnPlayer({ session: account({ [PLAYER_LINK_KEY]: "p-old" }), profile: named, players }).id, "p-clayton");
  assert.equal(resolveOwnPlayer({ session: account({ [PLAYER_LINK_KEY]: "nope" }), profile, players }), null);
  // The contract shows the role of the entry being chosen, before it is saved.
  assert.match(resolveContractIdentity({ session: account(), profile, players, playerId: "p-dornelas" }).role, /ZAG/);
  assert.equal(resolveContractIdentity({ session: account(), profile, players, playerId: PLAYER_LINK_NONE }).role, "");
});
