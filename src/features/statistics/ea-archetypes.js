// Official FC 27 archetype catalogue, intentionally separate from EA's
// numeric response identifiers. Names/specialties are official; no numeric
// id relationship is stored until an authoritative mapping is available.
export const officialArchetypes = Object.freeze({
  muralha: Object.freeze({ name: "Muralha", specialties: ["Posicionamento de GL", "Reflexos de GL"] }),
  goleiraLibero: Object.freeze({ name: "Goleira-líbero", specialties: ["Manejo de GL", "Elasticidade de GL"] }),
  comandante: Object.freeze({ name: "Comandante", specialties: ["Lançamento", "Dividida em pé"] }),
  chefia: Object.freeze({ name: "Chefia", specialties: ["Combatividade", "Força"] }),
  ambivalente: Object.freeze({ name: "Ambivalente", specialties: ["Carrinho", "Pique"] }),
  mataAtaques: Object.freeze({ name: "Mata-ataques", specialties: ["Fôlego", "Interceptações"] }),
  compasso: Object.freeze({ name: "Compasso", specialties: ["Noção defensiva", "Passe curto"] }),
  maestria: Object.freeze({ name: "Maestria", specialties: ["Reação", "Controle de bola"] }),
  cerebro: Object.freeze({ name: "Cérebro", specialties: ["Precisão nas faltas", "Visão"] }),
  gatilho: Object.freeze({ name: "Gatilho", specialties: ["Cruzamento", "Condução"] }),
  magiaEmCampo: Object.freeze({ name: "Magia em campo", specialties: ["Efeito", "Aceleração"] }),
  finalizador: Object.freeze({ name: "Finalizador", specialties: ["Frieza", "Finalização"] }),
  target: Object.freeze({ name: "Target", specialties: ["Equilíbrio", "Impulsão"] }),
});

// Keep empty until IDs are confirmed by a reliable EA source. Never infer the
// mapping from catalogue order. No official standalone symbol assets have
// been verified in the project, so consumers should use a textual fallback.
export const verifiedEaArchetypeIdMap = Object.freeze({});

export function describeEaArchetype(archetypeId) {
  if (archetypeId === null || archetypeId === undefined || archetypeId === "") return null;
  const key = String(archetypeId);
  const slug = verifiedEaArchetypeIdMap[key];
  const archetype = slug ? officialArchetypes[slug] : null;
  return archetype
    ? { id: key, name: archetype.name, specialties: archetype.specialties, verified: true, symbol: null }
    : { id: key, name: `ARQUÉTIPO ${key}`, specialties: [], verified: false, symbol: null };
}
