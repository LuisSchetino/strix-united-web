// A competition's logo is kept as a small copy in the club's own storage: the
// provider serves multi-megabyte originals, far too heavy for a 64px mark.

export const COMPETITION_LOGO_BUCKET = "fc27-team-assets";

/** True when the address is the club's own stored copy, not the provider's original. */
export const isStoredCompetitionLogo = (url) => /\/storage\/v1\/object\/public\/fc27-team-assets\/competitions\//.test(String(url || ""));

const hash = (value) => {
  let state = 0x811c9dc5;
  for (const char of String(value)) state = Math.imul(state ^ char.codePointAt(0), 0x01000193) >>> 0;
  return state.toString(16).padStart(8, "0");
};

/** Storage path (without extension) of the copy of one provider logo: a new original gets a new path. */
export function competitionLogoStem(provider, competitionId, logoUrl) {
  const safe = (value) => String(value || "x").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
  return `competitions/${safe(provider)}-${safe(competitionId)}-${hash(logoUrl)}`;
}

/** The logo a sync should keep: the stored copy when there is one, otherwise what the provider publishes. */
export const logoAfterSync = (currentUrl, providerUrl) => (isStoredCompetitionLogo(currentUrl) ? currentUrl : providerUrl || currentUrl || null);
