export const fc26Roster = [
  ["5d1d3de1-502d-4452-915b-234beae5f02e", "JOÃO", ["GOL"], "elenco", 2, ["JOÃO"], "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS7qiSaPM50l0MwpqjQKqWmh3cHIkl1bg1Kyqf9x_zVfQ&s=10"],
  ["6d2f9650-d45a-4f7a-9f92-b139debe9626", "YGO", ["ZAG", "MC", "ALA"], "elenco", 3, ["YGO"], "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQbmKuWil8xhu8H9BvIYyEr8f2N1l9MC6vK4q6DeK4QTA&s=10"],
  ["aa5986ca-056f-42b9-b35e-fb9968e75df8", "AIRTON", ["ZAG"], "elenco", 4, ["AIRTON"], null],
  ["dc8962f7-18cc-40be-a924-ec8c3771f07c", "CEDRAZ", ["ZAG", "ALA"], "elenco", 5, ["CEDRAZ"], null],
  ["107c36ef-6a31-47f3-af61-447ae17ded41", "SAMPAIO", ["ZAG"], "elenco", 6, ["SAMPAIO"], null],
  ["248d4a7e-6737-4773-beb3-e64ea7260ae9", "JÚLIO", ["VOL", "ZAG", "MC"], "elenco", 7, ["JÚLIO"], "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTxHSKC5BYtlnm45aeO8ofK0C2zNYME_qwIMP8J4FoweA&s=10"],
  ["68685584-6d12-4a92-88f9-cf21ba3958ca", "NUNES", ["MC"], "elenco", 8, ["NUNES"], null],
  ["476cf8c2-a367-490a-8646-2d59452d3535", "OBEEN", ["MC", "VOL"], "elenco", 9, ["OBEEN", "Obenzera", "Obenzeira"], "https://media.gettyimages.com/id/2278684263/pt/foto/sao-paulo-brazil-andreas-pereira-of-palmeiras-celebrates-after-scoring-the-fourth-goal-of-his.jpg?s=612x612&w=0&k=20&c=jpAXRbVBKibH8usQ3icU6gFGyhYJVFj-X84h2KKzXj4="],
  ["c8e4326b-ecfa-4f73-9d68-b554ffba17e8", "KESTOL", ["ALA"], "complete", 10, ["KESTOL"], "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTmB4zUKoKZZAjWBx3wt-C-aBw2Bdo-RTtRyC28zyxVvmdPtfY2pCxrU0wWNP0T60XR6FJ5Av2h0aHmy6VL5wk1urs2WMh0kEtKjZjAX_fi&s=10"],
  ["08a6ca0b-588e-4f88-8d5d-243fe83dc2dc", "NOGUEIRA", ["ALA"], "elenco", 11, ["NOGUEIRA"], null],
  ["6f40000f-d0b7-4833-a007-d15667d8972d", "SUCK", ["ATA"], "elenco", 13, ["SUCK"], null],
  ["05b0e1f9-fc81-4625-bedd-c3b745d1fb05", "PERSONAL", ["ATA"], "elenco", 14, ["PERSONAL"], null],
  ["21216eb9-f830-441e-9cfe-c6e9b479ea8d", "SANTOZZ", ["ATA"], "elenco", 18, ["SANTOZZ"], "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR5mNNaisAfjq81e_VAGaV7vcZAWMoFeXT7ZGxD4iMjq-p1XxO-A6aYEQR_y1GagflFZq69TY6lXm3wWBOm817rmrxuXpGLKHNRok4_vHK2&s=10"],
  ["602177d5-b358-44f9-a290-c6a4c6bd9486", "PRZ", ["ZAG"], "complete", 19, ["PRZ"], "https://encrypted-tbn0.gstatic.com/licensed-image?q=tbn:ANd9GcQwNJht9KCYVEuHxdEW_EbKG4O8yOMV5l3BoQs-OXJJ3ZyG6LZf_bZXv0cgV0byjc1C6KOEDLt3D8s85cqqanaJG7ZBGM5pM-zEwMgKmlkjPM8OWUOHNoMC-WxQiHa3dWi58DZuoK1v6M0&s=19"],
  ["548cd4ff-7cd4-4ad9-9cf4-9e4a1644c319", "YFRASQUETTI", ["ZAG"], "teste", 20, ["YFRASQUETTI"], null],
  ["328f3e9c-9056-4b78-949f-0e307725428d", "DORNELLAS", ["VOL", "MC", "ZAG"], "elenco", 21, ["DORNELLAS"], "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT4AtcWTnoibZKB3ntmsxK61LmTArm0fYJsizd8GqT70Q&s=10"],
  ["dbfcdedf-b5b8-4e5b-a928-69a4d5a6dca0", "TAYLOR", ["ALA", "ATA"], "elenco", 22, ["TAYLOR"], "https://media.gettyimages.com/id/2264238117/pt/foto/sao-paulo-brazil-allan-of-palmeiras-looks-on-during-campeonato-paulista-first-leg-final-match.jpg?s=612x612&w=0&k=20&c=Sx61z_Qg2q3maLBTZc78oBUS15lgYamXH5yAfTVPrEM="],
  ["7eb1d5d3-ccf5-40cc-9baa-3a9a029537b0", "PERDUGAS", ["GOL"], "complete", 23, ["PERDUGAS"], null],
].map(([sourcePlayerId, displayName, positions, memberType, sourceOrder, aliases, externalAvatarUrl]) => ({
  sourcePlayerId,
  displayName,
  positions,
  memberType,
  sourceOrder,
  aliases,
  externalAvatarUrl,
}));

export const normalizeRosterName = (value) => String(value || "")
  .toLocaleLowerCase("pt-BR")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export function previewFc26Roster(currentPlayers = []) {
  const bySource = new Map(currentPlayers.filter((player) => player.source_system === "fc26" && player.source_player_id).map((player) => [player.source_player_id, player]));
  const byName = new Map(currentPlayers.map((player) => [normalizeRosterName(player.display_name), player]));
  return fc26Roster.map((player) => {
    const existing = bySource.get(player.sourcePlayerId) || byName.get(normalizeRosterName(player.displayName));
    return { ...player, existing, action: existing ? "merge" : "create" };
  });
}
