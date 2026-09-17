import { STRIX_BRAND } from "../brand.js";

export const STORY_SIZE = { width: 1080, height: 1920 };
export const FEED_SIZE = { width: 1080, height: 1350 };
export const TEMPLATE_ID = "strix-collage-2026";

const layer = (id, x, y, scale = 1, rotation = 0, zIndex = 1) => ({
  id,
  x,
  y,
  scale,
  rotation,
  opacity: 1,
  zIndex,
  visible: true,
  locked: false,
  flipX: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
});

export function createDefaultProject() {
  return {
    id: null,
    name: "GameDay Strix — Collage 2026",
    templateId: TEMPLATE_ID,
    mode: "group",
    matchDate: new Date().toISOString().slice(0, 10),
    matchTime: "22:00",
    season: "2026",
    championshipName: "PLATAFORMA CLUBS",
    championshipLogo: "",
    competitionLogos: [],
    opponentName: "ADVERSÁRIO",
    opponentLogo: "",
    teamLogo: STRIX_BRAND.logo,
    topTeamName: "STRIX\nUNITED",
    timePrefix: "HOJE ÀS",
    groupTitle: "NOSSO GRUPO:",
    footerLeft: "STRIX UNITED //\nCORUJÃO 2026",
    footerCenter: "2026",
    footerRight: "A UNIÃO FAZ\nA FORÇA",
    slogan: "A UNIÃO FAZ A FORÇA",
    dailyGames: [],
    players: [],
    uniform: {
      enabled: false,
      assetUrl: "",
      targetPlayer: "player-main",
      x: 350,
      y: 500,
      scale: 1,
      rotation: 0,
      skewX: 0,
      skewY: 0,
      opacity: 100,
      clipTop: 0,
      clipRight: 0,
      clipBottom: 0,
      clipLeft: 0,
    },
    groupTeams: [
      {
        id: crypto.randomUUID(),
        name: "STRIX UNITED",
        logoUrl: STRIX_BRAND.logo,
      },
      { id: crypto.randomUUID(), name: "CLUBE DO POVO", logoUrl: "" },
      { id: crypto.randomUUID(), name: "CLUBE ARMÊNIO", logoUrl: "" },
      { id: crypto.randomUUID(), name: "CHAPE E-SPORTS", logoUrl: "" },
    ],
    elements: {
      headerTeam: { ...layer("header-team", 72, 72, 1, 0, 50), visible: true },
      championship: {
        ...layer("championship", 330, 64, 1, 0, 50),
        visible: true,
      },
      season: { ...layer("season", 880, 72, 1, 0, 50), visible: true },
      timeCard: { ...layer("time-card", 82, 455, 1.08, -3, 55), visible: true },
      mainLogo: { ...layer("main-logo", 500, 920, 0.9, 0, 60), visible: true },
      group: { ...layer("group", 92, 735, 1.42, 0, 65), visible: true },
      dailyGames: { ...layer("daily-games", 88, 700, 1, 0, 65), visible: true },
      stamp: { ...layer("stamp", 820, 485, 1, 10, 70), visible: true },
    },
    visualSettings: {
      primaryColor: "#075BFF",
      secondaryColor: "#003CCF",
      textureIntensity: 48,
      brushIntensity: 86,
      noiseIntensity: 24,
      showStamp: true,
      showVerticalText: true,
      showTape: true,
      showGuides: true,
      snap: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function hydrateGameDayProject(value) {
  const base = createDefaultProject();
  if (!value || typeof value !== "object") return base;
  return {
    ...base,
    ...value,
    mode: value.mode === "agenda" ? "agenda" : "group",
    players: Array.isArray(value.players) ? value.players : base.players,
    groupTeams: Array.isArray(value.groupTeams)
      ? value.groupTeams
      : base.groupTeams,
    dailyGames: Array.isArray(value.dailyGames)
      ? value.dailyGames.slice(0, 6)
      : [],
    competitionLogos: Array.isArray(value.competitionLogos)
      ? value.competitionLogos.slice(0, 5)
      : value.championshipLogo
        ? [
            {
              id: "legacy-championship",
              name: value.championshipName || "Campeonato",
              url: value.championshipLogo,
            },
          ]
        : [],
    elements: Object.fromEntries(
      Object.entries(base.elements).map(([key, fallback]) => [
        key,
        { ...fallback, ...(value.elements?.[key] || {}) },
      ]),
    ),
    visualSettings: { ...base.visualSettings, ...(value.visualSettings || {}) },
    uniform: { ...base.uniform, ...(value.uniform || {}) },
  };
}

export const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, Number(value) || 0));
export const safeFileName = (name = "asset") =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "asset";
export { canUseDeveloperTools as canManageGameDay } from "../access.js";
