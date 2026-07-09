// ─── Rose Serie B 2025/26 — STATO: DATI DA COMPLETARE ───
//
// Questo file NON contiene rose ufficiali o verificate. Non esiste, in questo ambiente,
// accesso affidabile a fonti ufficiali (Lega B, siti club) per compilare rose reali
// verificate giocatore per giocatore, quindi per rispettare il vincolo "non inventare
// giocatori" NESSUN nome, ruolo o dato anagrafico reale viene fabbricato.
//
// Per non lasciare i 20 club senza rosa (il che romperebbe rosa/mercato/tattiche/tifosi),
// ogni club riceve una rosa PLACEHOLDER generata deterministicamente, con nomi
// esplicitamente descrittivi ("CRE Portiere 1") che non possono essere scambiati per
// giocatori reali. Overall/potenziale sono bilanciati per tier di forza del club
// (vedi SERIE_B_STRENGTH_TIER in serieBData2025.ts) e sono dati di gioco CalcioManager.
//
// Quando saranno disponibili rose reali verificate, questo file va sostituito
// club per club e lo stato in serieBSourceManifest.ts va aggiornato di conseguenza.

import { ClubProfile, Player } from '../types';
import { buildPlayerStamina } from '../utils/playerFitness';
import { assignSquadRelationships, buildCareerMemory, buildPlayerPersonality, buildPlayerRelationships } from '../utils/playerPersonality';
import { SERIE_B_STRENGTH_TIER, SerieBStrengthTier } from './serieBData2025';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashRatio = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return hash / 100000;
};

const TIER_OVERALL_RANGE: Record<SerieBStrengthTier, [number, number]> = {
  ex_serie_a: [66, 76],
  strong: [62, 71],
  mid: [58, 67],
  promoted: [54, 63],
};

interface RoleSlot {
  role: Player['role'];
  label: string;
}

// 3 GK, 8 DF, 7 MF, 5 FW — distribuzione plausibile per una rosa completa da Serie B.
const ROSTER_TEMPLATE: RoleSlot[] = [
  { role: 'GK', label: 'Portiere' },
  { role: 'GK', label: 'Portiere' },
  { role: 'GK', label: 'Portiere' },
  { role: 'CB', label: 'Difensore Centrale' },
  { role: 'CB', label: 'Difensore Centrale' },
  { role: 'CB', label: 'Difensore Centrale' },
  { role: 'LB', label: 'Terzino Sinistro' },
  { role: 'LB', label: 'Terzino Sinistro' },
  { role: 'RB', label: 'Terzino Destro' },
  { role: 'RB', label: 'Terzino Destro' },
  { role: 'DM', label: 'Mediano' },
  { role: 'DM', label: 'Mediano' },
  { role: 'CM', label: 'Centrocampista' },
  { role: 'CM', label: 'Centrocampista' },
  { role: 'CM', label: 'Centrocampista' },
  { role: 'AM', label: 'Trequartista' },
  { role: 'AM', label: 'Trequartista' },
  { role: 'LW', label: 'Ala Sinistra' },
  { role: 'RW', label: 'Ala Destra' },
  { role: 'ST', label: 'Attaccante' },
  { role: 'ST', label: 'Attaccante' },
  { role: 'ST', label: 'Attaccante' },
];

const estimateValue = (overall: number, potential: number, age: number) => {
  const ratingBase = Math.max(1, overall - 50);
  const potentialBonus = Math.max(0, potential - overall) * 120000;
  const ageFactor = age <= 23 ? 1.2 : age <= 27 ? 1.05 : age >= 32 ? 0.6 : 0.88;
  return Math.round(((ratingBase * ratingBase * 9000) + potentialBonus) * ageFactor / 50000) * 50000;
};

const estimateWage = (overall: number) => Math.round(Math.max(1200, (overall - 48) * 380) / 100) * 100;

export const createPlaceholderPlayersForSerieBClub = (club: ClubProfile, tierOverride?: SerieBStrengthTier): Player[] => {
  const tier = tierOverride ?? SERIE_B_STRENGTH_TIER[club.id] ?? 'promoted';
  const [minOverall, maxOverall] = TIER_OVERALL_RANGE[tier];

  const players: Player[] = ROSTER_TEMPLATE.map((slot, index) => {
    const seedKey = `${club.id}-${slot.role}-${index}`;
    const id = `${club.id}_p${index + 1}`;
    const name = `${club.initials} ${slot.label} ${index + 1}`;
    const age = 19 + Math.floor(hashRatio(`${seedKey}-age`) * 16); // 19-34
    const overallSpread = hashRatio(`${seedKey}-overall`);
    const overall = Math.round(minOverall + overallSpread * (maxOverall - minOverall));
    const potentialBonus = age <= 22 ? Math.round(hashRatio(`${seedKey}-pot`) * 8) : Math.round(hashRatio(`${seedKey}-pot`) * 2);
    const potential = clamp(overall + potentialBonus, overall, maxOverall + 8);
    const nationality = hashRatio(`${seedKey}-nat`) > 0.82 ? 'Internazionale' : 'Italia';

    const seed = { id, name, role: slot.role, age, nationality, overall, potential };
    const personality = buildPlayerPersonality(seed, club.name, index);
    const relationships = buildPlayerRelationships(seed, personality);

    return {
      id,
      name,
      role: slot.role,
      age,
      nationality,
      overall,
      potential,
      form: Number((6.0 + (overall - minOverall) / 20).toFixed(1)),
      morale: clamp(64 + Math.round(hashRatio(`${seedKey}-morale`) * 20), 45, 90),
      condition: 100,
      stamina: buildPlayerStamina(seed, club.name, index),
      value: estimateValue(overall, potential, age),
      wage: estimateWage(overall),
      contractYears: 2 + (index % 3),
      status: 'Disponibile' as const,
      sourceRole: 'Rosa generata dalla simulazione (dati reali da completare)',
      personality,
      relationships,
      careerMemory: buildCareerMemory(),
    };
  });

  return assignSquadRelationships(players);
};
