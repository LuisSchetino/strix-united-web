export const STORY_SIZE = { width: 1080, height: 1920 };
export const FEED_SIZE = { width: 1080, height: 1350 };
export const TEMPLATE_ID = "strix-collage-2026";

const layer = (id, x, y, scale = 1, rotation = 0, zIndex = 1) => ({
  id, x, y, scale, rotation, opacity: 1, zIndex, visible: true, locked: false,
  flipX: false, brightness: 100, contrast: 100, saturation: 100,
});

export function createDefaultProject() {
  return {
    id: null,
    name: "GameDay Strix — Collage 2026",
    templateId: TEMPLATE_ID,
    matchDate: new Date().toISOString().slice(0, 10),
    matchTime: "22:00",
    season: "2026",
    championshipName: "PLATAFORMA CLUBS",
    championshipLogo: "",
    teamLogo: "/assets/strix-logo.png",
    topTeamName: "STRIX\nUNITED",
    timePrefix: "HOJE ÀS",
    groupTitle: "NOSSO GRUPO:",
    footerLeft: "STRIX UNITED //\nCORUJÃO 2026",
    footerCenter: "2026",
    footerRight: "A UNIÃO FAZ\nA FORÇA",
    slogan: "A UNIÃO FAZ A FORÇA",
    players: [
      { ...layer("player-left", 178, 308, 1.05, -2, 20), role: "left", name: "Jogador esquerdo", originalUrl: "", cutoutUrl: "", uniformUrl: "", activeUrl: "", shadow: 36 },
      { ...layer("player-right", 654, 310, 1.08, 2, 21), role: "right", name: "Jogador direito", originalUrl: "", cutoutUrl: "", uniformUrl: "", activeUrl: "", shadow: 34 },
      { ...layer("player-main", 330, 230, 1.28, 0, 30), role: "main", name: "Jogador principal", originalUrl: "", cutoutUrl: "", uniformUrl: "", activeUrl: "", shadow: 44 },
    ],
    uniform: {
      enabled: false, assetUrl: "", targetPlayer: "player-main", x: 350, y: 500,
      scale: 1, rotation: 0, skewX: 0, skewY: 0, opacity: 100,
      clipTop: 0, clipRight: 0, clipBottom: 0, clipLeft: 0,
    },
    groupTeams: [
      { id: crypto.randomUUID(), name: "STRIX UNITED", logoUrl: "/assets/strix-logo.png" },
      { id: crypto.randomUUID(), name: "CLUBE DO POVO", logoUrl: "" },
      { id: crypto.randomUUID(), name: "CLUBE ARMÊNIO", logoUrl: "" },
      { id: crypto.randomUUID(), name: "CHAPE E-SPORTS", logoUrl: "" },
    ],
    elements: {
      headerTeam: { ...layer("header-team", 72, 72, 1, 0, 50), visible: true },
      championship: { ...layer("championship", 330, 64, 1, 0, 50), visible: true },
      season: { ...layer("season", 880, 72, 1, 0, 50), visible: true },
      timeCard: { ...layer("time-card", 64, 876, 1, -4, 55), visible: true },
      mainLogo: { ...layer("main-logo", 300, 1030, 1, 0, 60), visible: true },
      group: { ...layer("group", 44, 1240, 1, 0, 65), visible: true },
    },
    visualSettings: {
      primaryColor: "#075BFF", secondaryColor: "#003CCF", textureIntensity: 48,
      brushIntensity: 86, noiseIntensity: 24, showStamp: true, showVerticalText: true,
      showTape: true, showGuides: true, snap: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
export const safeFileName = (name = "asset") => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "asset";
export const canManageGameDay = (profile) => ["diretoria", "dev"].includes(profile?.access_tier);
