// "Em campo" de verdade: o vigia no PC de quem joga (tools/ao-vivo) lê o texto do placar na
// tela e manda para /api/internal/live-signal. Aqui está a parte que dá para testar sem o jogo:
// achar o placar no texto lido, descobrir qual lado é o Strix e qual jogo da Agenda é aquele.
// Nada aqui lê o jogo: só o texto que o próprio vigia já tirou da tela.

/** Siglas que o Strix pode ter no placar do jogo (o vigia ou o servidor podem trocar a lista). */
export const DEFAULT_STRIX_TAGS = Object.freeze(["STR", "STRIX", "STX", "SU", "STU", "SUN"]);

/** Por quanto tempo o último sinal ainda conta como "em campo". */
export const LIVE_FRESH_MS = 3 * 60_000;

const strip = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * O placar no texto lido da tela: duas siglas, os gols e o relógio da partida. Sem relógio não é
 * partida (é menu, replay ou intervalo de tela), e o resultado é `null`.
 */
export function parseScoreboard(text) {
  const clean = strip(text).toUpperCase().replace(/[–—]/g, "-").replace(/[|]/g, " ").replace(/\s+/g, " ");
  const clock = /(?:^|[^\d])(\d{1,3})[:.](\d{2})(?!\d)/.exec(clean);
  if (!clock) return null;
  const minute = Number(clock[1]);
  if (minute > 130 || Number(clock[2]) > 59) return null;
  const score = /\b([A-Z]{2,5})\s+(\d{1,2})\s*(?:[-X]\s*)?(\d{1,2})\s+([A-Z]{2,5})\b/.exec(clean);
  if (!score) return null;
  const [, left, leftScore, rightScore, right] = score;
  if (left === right) return null;
  return { left, right, leftScore: Number(leftScore), rightScore: Number(rightScore), minute };
}

const letters = (value) => strip(value).toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").trim();

/**
 * Quanto uma sigla do placar parece o nome do adversário (0 = nada). Vale o começo do nome
 * ("POA" em "POA City"), as iniciais ("SFC" em "Sinceridade FC") ou as letras em ordem a partir
 * da primeira ("SNC" em "Sinceridade").
 */
export function tagScore(tag, name) {
  const words = letters(name).split(" ").filter(Boolean);
  if (!tag || !words.length) return 0;
  const joined = words.join("");
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
 * O jogo da Agenda que está sendo jogado e o lado do Strix no placar. Só entram jogos não
 * cancelados nem encerrados, até 100 min depois do horário. Ganha o adversário que mais parece a
 * sigla (até 2 h antes do horário, porque a noite adianta); sem parecido, o jogo mais próximo de
 * começar (até 45 min antes), se o lado do Strix for conhecido pela sigla.
 */
export function pickAgendaMatch(rows, board, now = new Date(), strixTags = DEFAULT_STRIX_TAGS) {
  if (!board) return null;
  const at = now.getTime();
  const open = (Array.isArray(rows) ? rows : []).filter((row) => row && !["cancelled", "completed"].includes(row.status) && Number.isFinite(new Date(row.scheduled_at).getTime()));
  // Quando a sigla bate, a noite pode ter adiantado: vale até 2 h antes do horário marcado.
  const within = (row, early) => {
    const kickoff = new Date(row.scheduled_at).getTime();
    return kickoff - at <= early * 60_000 && at - kickoff <= 100 * 60_000;
  };
  const named = open.filter((row) => within(row, 120));
  const near = open.filter((row) => within(row, 45));
  if (!named.length) return null;
  const tags = new Set(strixTags.map((tag) => String(tag).toUpperCase()));
  const strixLeft = tags.has(board.left) ? true : tags.has(board.right) ? false : null;
  const distance = (row) => Math.abs(new Date(row.scheduled_at).getTime() - at);
  let best = null;
  for (const row of named) {
    const options = strixLeft === null ? [[true, board.right], [false, board.left]] : [[strixLeft, strixLeft ? board.right : board.left]];
    for (const [left, tag] of options) {
      const score = tagScore(tag, row.opponent_name);
      if (score && (!best || score > best.score || (score === best.score && distance(row) < distance(best.row)))) best = { row, strixLeft: left, score };
    }
  }
  if (best) return { row: best.row, strixLeft: best.strixLeft };
  if (strixLeft === null || !near.length) return null;
  const nearest = [...near].sort((left, right) => distance(left) - distance(right))[0];
  return { row: nearest, strixLeft };
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
  const seen = new Date(match?.live_seen_at || "").getTime();
  return Number.isFinite(seen) && now.getTime() - seen <= LIVE_FRESH_MS && now.getTime() >= seen - 60_000;
}
