// "Primeira vez": a short walk through the site right after the first sign-in. Pure: the steps
// and the once-per-member memory. The component (Tour.jsx) points at the real controls.

export const TOUR_VERSION = 1;
const KEY = (userId) => `strix:tour:v${TOUR_VERSION}:${userId}`;

/**
 * The steps, in order. `targets` are tried in order and the first control that is on screen is
 * pointed at (the desktop menu, or the phone's tab bar); a step whose controls are all hidden
 * is still shown, centred.
 */
export function tourSteps({ firstName = "", canSeeAnalysis = false } = {}) {
  return [
    {
      id: "central",
      targets: ['[data-tour="nav-central"]', '[data-tour="tab-central"]'],
      title: firstName ? `Bem-vindo, ${firstName}.` : "Bem-vindo ao Strix.",
      text: "A Central é a sua noite: o próximo jogo, em quais partidas você está escalado e em que posição joga em cada uma.",
    },
    {
      id: "agenda",
      targets: ['[data-tour="nav-agenda"]', '[data-tour="tab-agenda"]'],
      title: "Agenda: a escalação de cada jogo.",
      text: "Abra uma partida para ver a escalação, a tabela do campeonato e o que já se sabe do adversário.",
    },
    {
      id: "biblioteca",
      targets: ['[data-tour="nav-biblioteca"]', '[data-tour="tab-more"]'],
      title: "Biblioteca: jogadas e reviews.",
      text: `Assista aqui dentro e continue de onde parou. O link de um material pode abrir já no minuto do lance${canSeeAnalysis ? "; a comissão acompanha quem assistiu" : ""}.`,
    },
    {
      id: "avisos",
      targets: ['[data-tour="bell"]', '[data-tour="search"]'],
      title: "O sino e a busca.",
      text: "No sino chegam a sua escalação, mudança de horário, resultado e material novo. A busca (Ctrl K) abre qualquer partida, jogador ou material.",
    },
  ];
}

/** Whether this member still has the walk to take on this device. */
export function shouldShowTour(storage, userId) {
  if (!userId) return false;
  try { return storage.getItem(KEY(userId)) !== "done"; } catch { return false; }
}

export function finishTour(storage, userId) {
  if (!userId) return;
  try { storage.setItem(KEY(userId), "done"); } catch { /* storage blocked: the walk may appear again */ }
}

export function resetTour(storage, userId) {
  if (!userId) return;
  try { storage.removeItem(KEY(userId)); } catch { /* nothing to reset */ }
}

/**
 * Where the card goes for a control at `rect` in a viewport: below it when there is room,
 * above otherwise, kept inside the screen. All values in CSS pixels.
 */
export function tourCardPosition(rect, viewport, card = { width: 340, height: 220 }, gap = 14) {
  const margin = 12;
  const width = Math.min(card.width, viewport.width - margin * 2);
  if (!rect) {
    return { left: Math.round((viewport.width - width) / 2), top: Math.round(Math.max(margin, (viewport.height - card.height) / 2)), width, placement: "center" };
  }
  const below = rect.bottom + gap + card.height <= viewport.height - margin;
  const above = rect.top - gap - card.height >= margin;
  const beside = rect.right + gap + width <= viewport.width - margin;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  if (beside && rect.height < viewport.height * 0.5 && rect.width < viewport.width * 0.4) {
    return { left: Math.round(rect.right + gap), top: Math.round(clamp(rect.top, margin, viewport.height - card.height - margin)), width, placement: "right" };
  }
  const left = Math.round(clamp(rect.left + rect.width / 2 - width / 2, margin, viewport.width - width - margin));
  if (below) return { left, top: Math.round(rect.bottom + gap), width, placement: "below" };
  if (above) return { left, top: Math.round(rect.top - gap - card.height), width, placement: "above" };
  return { left, top: Math.round(clamp(viewport.height - card.height - margin, margin, viewport.height)), width, placement: "over" };
}
