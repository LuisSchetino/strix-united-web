// Information architecture of the shell. Access stays in access.js; this file
// only decides how the visible pages are grouped and which ones live in the
// mobile tab bar.
import { visibleNavItems } from "./access.js";

export const CENTRAL_ITEM = Object.freeze(["central", "Central", "live"]);

export const NAV_GROUPS = Object.freeze([
  Object.freeze({ id: "clube", label: "Clube", pages: Object.freeze(["central", "agenda", "partidas", "elenco", "campeonatos"]) }),
  Object.freeze({ id: "dados", label: "Dados", pages: Object.freeze(["estatisticas", "analise", "biblioteca"]) }),
  Object.freeze({ id: "estudio", label: "Estúdio", pages: Object.freeze(["midia", "desenvolvedor"]) }),
]);

export const MOBILE_TABS = Object.freeze(["central", "agenda", "partidas", "elenco"]);

/** Groups the pages this profile may open; empty groups disappear. */
export function navGroupsFor(profile) {
  const items = new Map([CENTRAL_ITEM, ...visibleNavItems(profile)].map((item) => [item[0], item]));
  return NAV_GROUPS
    .map((group) => ({ ...group, items: group.pages.map((id) => items.get(id)).filter(Boolean) }))
    .filter((group) => group.items.length > 0);
}

export function mobileTabsFor(profile) {
  const items = new Map([CENTRAL_ITEM, ...visibleNavItems(profile)].map((item) => [item[0], item]));
  return MOBILE_TABS.map((id) => items.get(id)).filter(Boolean);
}

export function pageLabel(id) {
  if (id === "central") return CENTRAL_ITEM[1];
  return visibleNavItems("dev").find((item) => item[0] === id)?.[1] || CENTRAL_ITEM[1];
}
