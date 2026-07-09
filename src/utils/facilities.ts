import { ClubFacilitiesState, ClubFacility, ClubProfile, FacilityProject, FacilityType } from '../types';
import { ClubStaffModifiers } from './staff';

// ─── Strutture del club persistenti (Fase 8B) ───
// Investimenti a lungo termine: livelli 1-5, un solo progetto attivo alla volta, costo e durata
// crescenti, nessun Math.random (tutto deterministico dal club.id), nessun effetto pieno finche'
// il progetto non e' completato. Mai un secondo sistema economico o di infortuni parallelo.

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashRatio = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000003;
  }
  return hash / 1000003;
};

const FACILITY_TYPES: FacilityType[] = ['training_centre', 'medical_centre', 'youth_academy', 'scouting_network', 'analysis_department'];

export const FACILITY_LABELS: Record<FacilityType, string> = {
  training_centre: 'Centro sportivo',
  medical_centre: 'Centro medico',
  youth_academy: 'Settore giovanile',
  scouting_network: 'Rete scouting',
  analysis_department: 'Analisi tattica'
};

export const FACILITY_EFFECT_LABELS: Record<FacilityType, string> = {
  training_centre: 'Piani di sviluppo e lettura del carico piu efficaci.',
  medical_centre: 'Raccomandazioni mediche e riabilitazione piu affidabili.',
  youth_academy: 'Sviluppo piu rapido per i giovani gia in rosa/vivaio.',
  scouting_network: 'Report scouting piu ampi, precisi e affidabili.',
  analysis_department: 'Analisi tattica e report dell\'assistente piu utili.'
};

export const FACILITY_STAFF_ROLE_LABEL: Record<FacilityType, string> = {
  training_centre: 'Preparatore atletico / Allenatore sviluppo',
  medical_centre: 'Capo staff medico',
  youth_academy: 'Allenatore sviluppo',
  scouting_network: 'Capo scout',
  analysis_department: 'Vice allenatore'
};

const LEVEL_UPGRADE_COST_BASE: Record<number, number> = { 2: 900000, 3: 2400000, 4: 5200000, 5: 11000000 };
const LEVEL_UPGRADE_DURATION_ROUNDS: Record<number, number> = { 2: 6, 3: 9, 4: 13, 5: 20 };
const CONDITION_DECAY_PER_ROUND = 0.15;
const CONDITION_DEGRADED_THRESHOLD = 40;
const MAX_RECENT_EVENTS = 8;

export const getFacilityUpgradeCost = (club: ClubProfile, targetLevel: number): number => {
  const base = LEVEL_UPGRADE_COST_BASE[targetLevel] ?? LEVEL_UPGRADE_COST_BASE[2];
  const scale = clamp(club.transferBudget / 40000000, 0.5, 2.2);
  return Math.round((base * scale) / 10000) * 10000;
};

export const getFacilityUpgradeDurationRounds = (targetLevel: number): number => (
  LEVEL_UPGRADE_DURATION_ROUNDS[targetLevel] ?? LEVEL_UPGRADE_DURATION_ROUNDS[2]
);

// Livello iniziale coerente col profilo del club (budget/academy), mai casuale: club piu
// strutturati partono leggermente avanti, ma nessuno parte oltre il livello 3 (il 5 resta raro
// e raggiungibile solo con investimenti reali).
const buildInitialFacilityLevel = (club: ClubProfile, type: FacilityType): 1 | 2 | 3 | 4 | 5 => {
  const seed = `${club.id}-facility-${type}`;
  const budgetTier = club.transferBudget >= 60000000 ? 2 : club.transferBudget >= 28000000 ? 1 : 0;
  const academyBias = type === 'youth_academy' && club.academy.toLowerCase().includes('forte') ? 1 : 0;
  const bit = hashRatio(seed) > 0.55 ? 1 : 0;
  const level = clamp(1 + budgetTier + academyBias + bit, 1, 3);
  return level as 1 | 2 | 3 | 4 | 5;
};

const buildInitialCondition = (club: ClubProfile, type: FacilityType): number => (
  Math.round(clamp(72 + hashRatio(`${club.id}-facility-${type}-condition`) * 20, 60, 92))
);

const buildInitialFacility = (club: ClubProfile, type: FacilityType): ClubFacility => ({
  type,
  level: buildInitialFacilityLevel(club, type),
  condition: buildInitialCondition(club, type)
});

export const createInitialClubFacilitiesState = (club: ClubProfile): ClubFacilitiesState => ({
  facilities: FACILITY_TYPES.map(type => buildInitialFacility(club, type)),
  lastFacilityReviewRound: null,
  recentFacilityEvents: []
});

const VALID_FACILITY_TYPES = new Set<string>(FACILITY_TYPES);
const VALID_PROJECT_STATUSES = new Set(['active', 'completed', 'paused']);

const normalizeFacilityProject = (raw: unknown): FacilityProject | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const item = raw as Record<string, unknown>;
  if (
    typeof item.id !== 'string'
    || typeof item.targetLevel !== 'number'
    || typeof item.startedRound !== 'number'
    || typeof item.completedRound !== 'number'
    || typeof item.cost !== 'number'
    || !VALID_PROJECT_STATUSES.has(item.status as string)
  ) return undefined;
  return {
    id: item.id,
    targetLevel: Math.round(clamp(item.targetLevel, 2, 5)),
    startedRound: Math.max(0, Math.round(item.startedRound)),
    completedRound: Math.max(0, Math.round(item.completedRound)),
    cost: Math.max(0, Math.round(item.cost)),
    status: item.status as FacilityProject['status']
  };
};

const normalizeFacility = (raw: unknown, club: ClubProfile, type: FacilityType): ClubFacility => {
  if (!raw || typeof raw !== 'object') return buildInitialFacility(club, type);
  const item = raw as Record<string, unknown>;
  const level = typeof item.level === 'number' ? Math.round(clamp(item.level, 1, 5)) as 1 | 2 | 3 | 4 | 5 : buildInitialFacilityLevel(club, type);
  return {
    type,
    level,
    condition: typeof item.condition === 'number' ? Math.round(clamp(item.condition, 15, 100)) : buildInitialCondition(club, type),
    lastUpgradeSeason: typeof item.lastUpgradeSeason === 'string' ? item.lastUpgradeSeason : undefined,
    activeProject: normalizeFacilityProject(item.activeProject)
  };
};

// Normalizzatore migration-safe: vecchi salvataggi senza strutture ricevono un set valido e
// coerente; salvataggi gia' aggiornati mantengono livelli, progetti e storico eventi.
export const normalizeClubFacilitiesState = (value: unknown, club: ClubProfile): ClubFacilitiesState => {
  if (!value || typeof value !== 'object') return createInitialClubFacilitiesState(club);
  const raw = value as Record<string, unknown>;

  const rawFacilities = Array.isArray(raw.facilities) ? raw.facilities : [];
  const byType = new Map<FacilityType, unknown>();
  rawFacilities.forEach(entry => {
    if (entry && typeof entry === 'object' && VALID_FACILITY_TYPES.has((entry as Record<string, unknown>).type as string)) {
      byType.set((entry as Record<string, unknown>).type as FacilityType, entry);
    }
  });
  const facilities = FACILITY_TYPES.map(type => normalizeFacility(byType.get(type), club, type));

  // Al massimo un progetto attivo: se un salvataggio corrotto ne avesse piu' d'uno, tiene solo il primo.
  let activeSeen = false;
  facilities.forEach(facility => {
    if (facility.activeProject?.status === 'active') {
      if (activeSeen) facility.activeProject = undefined;
      else activeSeen = true;
    }
  });

  return {
    facilities,
    lastFacilityReviewRound: typeof raw.lastFacilityReviewRound === 'number' ? raw.lastFacilityReviewRound : null,
    recentFacilityEvents: Array.isArray(raw.recentFacilityEvents)
      ? raw.recentFacilityEvents.filter((e): e is string => typeof e === 'string').slice(0, MAX_RECENT_EVENTS)
      : []
  };
};

export const getFacility = (state: ClubFacilitiesState, type: FacilityType): ClubFacility | undefined => (
  state.facilities.find(f => f.type === type)
);

export const hasActiveFacilityProject = (state: ClubFacilitiesState): boolean => (
  state.facilities.some(f => f.activeProject?.status === 'active')
);

export const canStartFacilityUpgrade = (state: ClubFacilitiesState, type: FacilityType): boolean => {
  const facility = getFacility(state, type);
  if (!facility) return false;
  if (facility.level >= 5) return false;
  return !hasActiveFacilityProject(state);
};

// Avvia un upgrade: nessun effetto immediato, il livello sale solo a completamento del progetto.
export const startFacilityUpgrade = (
  state: ClubFacilitiesState,
  club: ClubProfile,
  type: FacilityType,
  round: number
): ClubFacilitiesState => {
  if (!canStartFacilityUpgrade(state, type)) return state;
  const facility = getFacility(state, type);
  if (!facility) return state;

  const targetLevel = facility.level + 1;
  const cost = getFacilityUpgradeCost(club, targetLevel);
  const duration = getFacilityUpgradeDurationRounds(targetLevel);
  const project: FacilityProject = {
    id: `fproj_${type}_${round}`,
    targetLevel,
    startedRound: round,
    completedRound: round + duration,
    cost,
    status: 'active'
  };

  const event = `Progetto avviato: ${FACILITY_LABELS[type]} verso il livello ${targetLevel} (${duration} giornate stimate).`;
  return {
    facilities: state.facilities.map(f => (f.type === type ? { ...f, activeProject: project } : f)),
    lastFacilityReviewRound: state.lastFacilityReviewRound,
    recentFacilityEvents: [event, ...state.recentFacilityEvents].slice(0, MAX_RECENT_EVENTS)
  };
};

// Avanza le strutture di una giornata: completa il progetto se e' arrivato a scadenza, applica un
// lento degrado di condizione (con evento reale solo alla prima discesa sotto soglia) e rientra
// gradualmente in caso di scarso utilizzo.
export const advanceClubFacilities = (state: ClubFacilitiesState, round: number, season: string): ClubFacilitiesState => {
  if (state.lastFacilityReviewRound === round) return state;

  const events: string[] = [];
  const facilities = state.facilities.map(facility => {
    let next = facility;

    if (next.activeProject?.status === 'active' && round >= next.activeProject.completedRound) {
      const targetLevel = next.activeProject.targetLevel as 1 | 2 | 3 | 4 | 5;
      events.push(`Progetto completato: ${FACILITY_LABELS[next.type]} ha raggiunto il livello ${targetLevel}.`);
      if (targetLevel === 5) events.push(`${FACILITY_LABELS[next.type]} ha raggiunto il livello massimo: un investimento raro nella storia del club.`);
      next = { ...next, level: targetLevel, condition: 92, lastUpgradeSeason: season, activeProject: undefined };
    }

    const wasHealthy = next.condition >= CONDITION_DEGRADED_THRESHOLD;
    const decayed = Math.round(clamp(next.condition - CONDITION_DECAY_PER_ROUND, 25, 100));
    if (wasHealthy && decayed < CONDITION_DEGRADED_THRESHOLD) {
      events.push(`${FACILITY_LABELS[next.type]} mostra segni di usura: la manutenzione va valutata.`);
    }
    next = decayed === next.condition ? next : { ...next, condition: decayed };

    return next;
  });

  return {
    facilities,
    lastFacilityReviewRound: round,
    recentFacilityEvents: events.length ? [...events.reverse(), ...state.recentFacilityEvents].slice(0, MAX_RECENT_EVENTS) : state.recentFacilityEvents
  };
};

export interface ClubFacilitiesSummary {
  averageLevel: number;
  strengths: string[]; // max 2
  activeProject: { type: FacilityType; targetLevel: number; progress: number; roundsLeft: number } | null;
}

export const getClubFacilitiesSummary = (state: ClubFacilitiesState, round: number): ClubFacilitiesSummary => {
  const averageLevel = state.facilities.length
    ? Math.round((state.facilities.reduce((sum, f) => sum + f.level, 0) / state.facilities.length) * 10) / 10
    : 1;
  const strengths = [...state.facilities]
    .sort((a, b) => b.level - a.level)
    .filter(f => f.level >= 3)
    .slice(0, 2)
    .map(f => `${FACILITY_LABELS[f.type]} (liv. ${f.level})`);

  const activeFacility = state.facilities.find(f => f.activeProject?.status === 'active');
  const activeProject = activeFacility?.activeProject
    ? {
        type: activeFacility.type,
        targetLevel: activeFacility.activeProject.targetLevel,
        progress: Math.round(clamp(
          ((round - activeFacility.activeProject.startedRound) / Math.max(1, activeFacility.activeProject.completedRound - activeFacility.activeProject.startedRound)) * 100,
          0,
          99
        )),
        roundsLeft: Math.max(0, activeFacility.activeProject.completedRound - round)
      }
    : null;

  return { averageLevel, strengths, activeProject };
};

// ─── Sinergia con lo staff persistente: bonus piccoli, con cap, mai un sostituto dello staff ───

export interface FacilityStaffBonus {
  fitnessBonus: number;
  physioBonus: number;
  developmentBonus: number;
  youthAcademyBonus: number; // usato solo per giocatori gia' academy/local, non globale
  scoutingBonus: number;
  tacticalBonus: number;
}

const facilityLevelBonus = (state: ClubFacilitiesState, type: FacilityType): number => {
  const level = getFacility(state, type)?.level ?? 1;
  return clamp((level - 1) * 1.5, 0, 6);
};

export const getFacilityStaffBonus = (state: ClubFacilitiesState): FacilityStaffBonus => ({
  fitnessBonus: facilityLevelBonus(state, 'training_centre'),
  developmentBonus: facilityLevelBonus(state, 'training_centre'),
  youthAcademyBonus: facilityLevelBonus(state, 'youth_academy'),
  physioBonus: facilityLevelBonus(state, 'medical_centre'),
  scoutingBonus: facilityLevelBonus(state, 'scouting_network'),
  tacticalBonus: facilityLevelBonus(state, 'analysis_department')
});

// Somma i bonus struttura ai modificatori staff gia' calcolati, sempre con lo stesso cap 0-100:
// una struttura eccellente con uno staff scarso resta comunque limitata dal cap, mai eccellente da sola.
export const applyFacilityBonusToStaffModifiers = (
  modifiers: ClubStaffModifiers,
  state: ClubFacilitiesState
): ClubStaffModifiers => {
  const bonus = getFacilityStaffBonus(state);
  return {
    fitnessQuality: Math.round(clamp(modifiers.fitnessQuality + bonus.fitnessBonus, 0, 100)),
    physioQuality: Math.round(clamp(modifiers.physioQuality + bonus.physioBonus, 0, 100)),
    developmentQuality: Math.round(clamp(modifiers.developmentQuality + bonus.developmentBonus, 0, 100)),
    scoutingQuality: Math.round(clamp(modifiers.scoutingQuality + bonus.scoutingBonus, 0, 100)),
    tacticalQuality: Math.round(clamp(modifiers.tacticalQuality + bonus.tacticalBonus, 0, 100))
  };
};
