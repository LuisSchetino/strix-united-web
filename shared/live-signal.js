// "Em campo" de verdade: o vigia no PC de quem joga (tools/ao-vivo) lê o texto do placar na
// tela e manda para /api/internal/live-signal. Aqui está a parte que dá para testar sem o jogo:
// achar o placar no texto lido, descobrir qual lado é o Strix e qual jogo da Agenda é aquele.
// Nada aqui lê o jogo: só o texto que o próprio vigia já tirou da tela.

/** Siglas que o Strix pode ter no placar do jogo (o vigia ou o servidor podem trocar a lista). */
export const DEFAULT_STRIX_TAGS = Object.freeze(["STR", "STRIX", "STX", "SU", "STU", "SUN"]);

/**
 * Por quanto tempo o último sinal ainda conta como "em campo". O vigia manda a cada poucos
 * segundos enquanto o relógio anda; replay e comemoração escondem o placar por alguns segundos.
 */
export const LIVE_FRESH_MS = 75_000;
/** Depois de quanto tempo sem sinal um jogo parado no fim (85'+) conta como encerrado. */
export const FINAL_MINUTE = 85;

const strip = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

// Gol escrito na fonte do placar: o OCR lê "0" como "O" e "1" como "I" ou "L".
const SCORE = "[0-9OIL]{1,2}";
const goals = (value) => Number(String(value).replace(/O/g, "0").replace(/[IL]/g, "1"));
// O escudo entre a sigla e o gol vira um ou dois caracteres soltos no texto lido.
const CREST = "(?:\\s+[^\\sA-Z0-9]{1,2}|\\s+[A-Z])?";

/**
 * O placar no texto lido da tela: duas siglas, os gols e o relógio da partida. Entende o placar
 * em linha ("STR 1 - 0 POA") e o empilhado do FC 27 ("STX O" / "BDL 1" / "45:17", com o escudo
 * no meio). Sem relógio não é partida (é menu, replay ou intervalo de tela): `null`.
 */
export function parseScoreboard(text) {
  const clean = strip(text).toUpperCase().replace(/[–—]/g, "-").replace(/[|]/g, " ").replace(/\s+/g, " ").trim();
  const clock = /(?:^|[^\d])(\d{1,3})[:.](\d{2})(?!\d)/.exec(clean);
  if (!clock) return null;
  const minute = Number(clock[1]);
  if (minute > 130 || Number(clock[2]) > 59) return null;
  const board = (left, leftScore, rightScore, right) => (left === right ? null : { left, right, leftScore: goals(leftScore), rightScore: goals(rightScore), minute });
  const end = "(?=\\s|$)";
  // em linha: STR 1 - 0 POA
  const inline = new RegExp(`\\b([A-Z]{2,5})\\s+(${SCORE})\\s*(?:[-X]\\s*)?(${SCORE})\\s+([A-Z]{2,5})\\b`).exec(clean);
  if (inline && /\d/.test(inline[2] + inline[3])) return board(inline[1], inline[2], inline[3], inline[4]);
  // empilhado: STX [escudo] O  BDL [escudo] 1
  const stacked = new RegExp(`\\b([A-Z]{2,5})${CREST}\\s+(${SCORE})${end}\\s*(?:\\S{1,2}\\s+)?\\b([A-Z]{2,5})${CREST}\\s+(${SCORE})${end}`).exec(clean);
  if (stacked) return board(stacked[1], stacked[2], stacked[4], stacked[3]);
  // siglas primeiro, gols depois: STX BDL O 1
  const columns = new RegExp(`\\b([A-Z]{2,5})\\s+([A-Z]{2,5})\\s+(${SCORE})\\s+(${SCORE})${end}`).exec(clean);
  if (columns) return board(columns[1], columns[3], columns[4], columns[2]);
  return null;
}

// "HuntersES" é "Hunters ES": a maiúscula depois da minúscula começa outra palavra.
const letters = (value) => strip(value).replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").trim();

/**
 * Siglas que o jogo mostra e que não saem do nome do clube: sigla → começo do nome do
 * adversário na Agenda. Vale o que o placar do FC 27 escreve de fato.
 */
export const OPPONENT_TAG_ALIASES = Object.freeze({
  NHE: "NIGHT HUNTERS",
});

/**
 * Quanto uma sigla do placar parece o nome do adversário (0 = nada). Vale o começo do nome
 * ("POA" em "POA City"), as iniciais ("SFC" em "Sinceridade FC") ou as letras em ordem a partir
 * da primeira ("SNC" em "Sinceridade").
 */
export function tagScore(tag, name) {
  const words = letters(name).split(" ").filter(Boolean);
  if (!tag || !words.length) return 0;
  const joined = words.join("");
  const alias = OPPONENT_TAG_ALIASES[tag];
  if (alias && words.join(" ").startsWith(alias)) return 4;
  if (joined.startsWith(tag)) return 3;
  // palavras curtas entram inteiras: "Sinceridade FC" vira "SFC"
  const initials = words.map((word) => (word.length <= 3 ? word : word[0])).join("");
  if (initials.startsWith(tag) && tag.length >= 2) return 2;
  if (joined[0] === tag[0]) {
    let at = 0;
    for (const char of tag) {
      at = joined.indexOf(char, at);
      if (at < 0) return 0;
      at += 1;
    }
    return 1;
  }
  return 0;
}

/**
 * Em que pé está o jogo pelo último sinal do vigia:
 *   "live"     — sinal recente: bola rolando;
 *   "halftime" — o relógio parou em 44'–50' e o sinal sumiu há pouco: intervalo;
 *   "ended"    — o relógio passou de 85' e o sinal sumiu: fim de jogo, falta só a súmula;
 *   ""         — sem sinal, ou o sinal sumiu no meio do jogo.
 */
export function livePhase(match, now = new Date()) {
  const seen = new Date(match?.live_seen_at || "").getTime();
  if (!Number.isFinite(seen)) return "";
  const age = now.getTime() - seen;
  if (age < -2 * 60_000) return "";
  if (age <= LIVE_FRESH_MS) return "live";
  const minute = Number(match.live_minute);
  if (minute >= 44 && minute <= 50 && age <= 12 * 60_000) return "halftime";
  if (minute >= FINAL_MINUTE && age <= 6 * 3_600_000) return "ended";
  return "";
}

const kickoffOf = (row) => new Date(row.scheduled_at).getTime();

/**
 * O jogo da Agenda que está sendo jogado e o lado do Strix no placar. Só entram jogos não
 * cancelados, não encerrados e não terminados pelo vigia, até 100 min depois do horário. Na ordem:
 *   1. o jogo que já está em campo continua sendo ele (o relógio só anda para a frente);
 *   2. uma sigla forte (o nome, as iniciais ou um apelido conhecido como NHE) de outro jogo da
 *      noite, até 2 h antes do horário: a noite pode ter adiantado;
 *   3. o jogo da vez pelo horário: o último que já começou (ou começa em até 10 min). Às 23:23,
 *      com jogos às 23:10 e às 23:40, é o das 23:10;
 *   4. qualquer sigla parecida, até 2 h antes do horário.
 */
export function pickAgendaMatch(rows, board, now = new Date(), strixTags = DEFAULT_STRIX_TAGS) {
  if (!board) return null;
  const at = now.getTime();
  const tags = new Set(strixTags.map((tag) => String(tag).toUpperCase()));
  const known = tags.has(board.left) ? true : tags.has(board.right) ? false : null;
  const open = (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row || ["cancelled", "completed"].includes(row.status) || !Number.isFinite(kickoffOf(row))) return false;
    const phase = livePhase(row, now);
    if (phase === "ended") return false;
    // o relógio voltou para trás de um jogo que já foi visto: o placar é de outro jogo
    if (Number.isFinite(row.live_minute) && row.live_seen_at && board.minute < row.live_minute - 3 && phase !== "halftime") return false;
    if (phase === "halftime" && board.minute < 40) return false;
    return true;
  });
  const within = (row, early) => kickoffOf(row) - at <= early * 60_000 && at - kickoffOf(row) <= 100 * 60_000;
  const named = open.filter((row) => within(row, 120));
  if (!named.length) return null;
  // o lado do Strix: pela sigla dele; sem ela, pelo lado em que a sigla do adversário bate
  const side = (row) => {
    if (known !== null) return { strixLeft: known, score: tagScore(known ? board.right : board.left, row.opponent_name) };
    const right = tagScore(board.right, row.opponent_name);
    const left = tagScore(board.left, row.opponent_name);
    if (right > left) return { strixLeft: true, score: right };
    if (left > right) return { strixLeft: false, score: left };
    return { strixLeft: null, score: right };
  };
  const pick = (row) => {
    const { strixLeft } = side(row);
    if (strixLeft !== null) return { row, strixLeft };
    // sem sigla nenhuma: o lado que não faz o placar andar para trás
    if (row.live_seen_at) {
      const fits = (left) => (left ? board.leftScore : board.rightScore) >= (row.live_strix_score || 0) && (left ? board.rightScore : board.leftScore) >= (row.live_opponent_score || 0);
      if (fits(true) !== fits(false)) return { row, strixLeft: fits(true) };
    }
    return null;
  };
  // 1. já em campo
  const playing = named.find((row) => ["live", "halftime"].includes(livePhase(row, now)));
  if (playing) return pick(playing);
  const distance = (row) => Math.abs(kickoffOf(row) - at);
  const ranked = named.map((row) => ({ row, ...side(row) })).filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || distance(left.row) - distance(right.row));
  const current = named.filter((row) => within(row, 10)).sort((left, right) => kickoffOf(right) - kickoffOf(left))[0];
  const currentScore = current ? side(current).score : 0;
  // 2. sigla forte de outro jogo
  if (ranked[0] && ranked[0].score >= 2 && currentScore < 2 && ranked[0].strixLeft !== null) return { row: ranked[0].row, strixLeft: ranked[0].strixLeft };
  // 3. o jogo da vez
  if (current) {
    const chosen = pick(current);
    if (chosen) return chosen;
  }
  // 4. sigla parecida
  const best = ranked.find((item) => item.strixLeft !== null);
  return best ? { row: best.row, strixLeft: best.strixLeft } : null;
}

/** O que gravar no jogo da Agenda a partir de um placar lido. */
export function liveUpdate(board, strixLeft, now = new Date(), previous = {}) {
  return {
    live_seen_at: now.toISOString(),
    live_started_at: previous.live_started_at || now.toISOString(),
    live_strix_score: strixLeft ? board.leftScore : board.rightScore,
    live_opponent_score: strixLeft ? board.rightScore : board.leftScore,
    live_minute: board.minute,
  };
}

/** O jogo está em campo agora pelo último sinal do vigia? */
export function isLiveFresh(match, now = new Date()) {
  return livePhase(match, now) === "live";
}

/** Em campo ou no intervalo: o jogo ainda está acontecendo. */
export function isOnPitch(match, now = new Date()) {
  return ["live", "halftime"].includes(livePhase(match, now));
}
