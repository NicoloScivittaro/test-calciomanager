import {
  ClubFacilitiesState,
  ClubProfile,
  ClubStaffState,
  ClubWageBudgetState,
  Player,
  PlayerRole,
  TeamDNAState,
  YouthAcademyProfile,
  YouthAcademyReport,
  YouthAcademyState,
  YouthAcademyStatus,
  YouthAgeGroup,
  YouthLocalConnection
} from '../types';
import { getFacility } from './facilities';
import { getClubStaffMember } from './staff';
import { buildCareerMemory, buildPlayerPersonality, buildPlayerRelationships } from './playerPersonality';
import { ensurePlayerPhysicalState } from './playerFitness';
import { ensurePlayerDevelopmentState } from './playerDevelopment';
import { applySignedContract } from './playerContracts';

// ─── Settore giovanile (Fase 9) ───
// Vivaio compatto e deterministico: 12-16 prospetti attivi, 4-7 nuovi ingressi a stagione, mai
// generazione a ogni render. Riusa developmentProfile/physicalProfile/personality/contratti gia'
// esistenti: la differenza e' solo squadStatus + un percorso di revisione piu' lento e separato.

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashRatio = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000003;
  }
  return hash / 1000003;
};

const seeded = (seed: string, label: string, min: number, max: number) => (
  Math.round(min + hashRatio(`${seed}-${label}`) * (max - min))
);

export const MAX_ACTIVE_YOUTH = 16;
export const MIN_ACTIVE_YOUTH_TARGET = 12;
export const MAX_INTAKE_PER_SEASON = 7;
export const MIN_INTAKE_PER_SEASON = 4;
export const MAX_DASHBOARD_HIGHLIGHTS = 3;
const REVIEW_INTERVAL_ROUNDS = 4;
const MAX_REPORTS = 12;
const MAX_GRADUATE_IDS = 20;
const MAX_PROCESSED_EVENT_IDS = 30;

// ─── Creazione/normalizzazione stato (pure, non genera mai giocatori: separazione netta) ───

export const createInitialYouthAcademyState = (clubId: string, season: string): YouthAcademyState => ({
  clubId,
  currentSeason: season,
  playerIds: [],
  lastIntakeSeason: undefined,
  lastReviewRound: undefined,
  recentReports: [],
  historicalGraduateIds: [],
  processedAcademyEventIds: []
});

const normalizeReport = (raw: unknown): YouthAcademyReport | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.summary !== 'string') return null;
  const validTypes = new Set(['progress', 'stagnation', 'promotion_recommendation', 'contract_recommendation', 'release_recommendation', 'intake']);
  return {
    id: item.id,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    playerId: typeof item.playerId === 'string' ? item.playerId : undefined,
    type: validTypes.has(item.type as string) ? item.type as YouthAcademyReport['type'] : 'progress',
    title: item.title,
    summary: item.summary,
    importance: typeof item.importance === 'number' ? Math.round(clamp(item.importance, 0, 100)) : 50,
    sourceId: typeof item.sourceId === 'string' ? item.sourceId : item.id
  };
};

export const normalizeYouthAcademyState = (value: unknown, clubId: string, season: string): YouthAcademyState => {
  if (!value || typeof value !== 'object') return createInitialYouthAcademyState(clubId, season);
  const raw = value as Record<string, unknown>;
  if (raw.clubId !== clubId) return createInitialYouthAcademyState(clubId, season);

  return {
    clubId,
    currentSeason: season,
    playerIds: Array.isArray(raw.playerIds) ? raw.playerIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_ACTIVE_YOUTH) : [],
    lastIntakeSeason: typeof raw.lastIntakeSeason === 'string' ? raw.lastIntakeSeason : undefined,
    lastReviewRound: typeof raw.lastReviewRound === 'number' ? raw.lastReviewRound : undefined,
    recentReports: Array.isArray(raw.recentReports)
      ? raw.recentReports.map(normalizeReport).filter((r): r is YouthAcademyReport => r !== null).slice(0, MAX_REPORTS)
      : [],
    historicalGraduateIds: Array.isArray(raw.historicalGraduateIds)
      ? raw.historicalGraduateIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_GRADUATE_IDS)
      : [],
    processedAcademyEventIds: Array.isArray(raw.processedAcademyEventIds)
      ? raw.processedAcademyEventIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_PROCESSED_EVENT_IDS)
      : []
  };
};

// ─── Qualita' dell'intake: livello academy + development coach + DNA + reputazione. Mai un fenomeno garantito ───

const YOUTH_ROLE_POOL: PlayerRole[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'DM', 'CM', 'CM', 'AM', 'LW', 'RW', 'ST', 'ST'];

const buildYouthQualityIndex = (
  club: ClubProfile,
  facilitiesState: ClubFacilitiesState,
  clubStaffState: ClubStaffState,
  teamDNA?: TeamDNAState
): number => {
  const facilityLevel = getFacility(facilitiesState, 'youth_academy')?.level ?? 1;
  const facilityScore = (facilityLevel - 1) * 20; // 0-80
  const devCoach = getClubStaffMember(clubStaffState, 'development_coach');
  const staffScore = devCoach?.youthDevelopment ?? 60;
  const dnaBonus = !teamDNA ? 0 : (
    (teamDNA.active === 'vivaio' || teamDNA.secondary.includes('vivaio') ? 10 : 0)
    + (teamDNA.active === 'giovaniItaliani' || teamDNA.secondary.includes('giovaniItaliani') ? 6 : 0)
  );
  const reputationScore = teamDNA ? clamp(teamDNA.reputation, 0, 100) : clamp(50 + club.transferBudget / 2000000, 30, 85);
  return Math.round(clamp(facilityScore * 0.35 + staffScore * 0.35 + reputationScore * 0.2 + dnaBonus, 0, 100));
};

const YOUTH_FIRST_NAMES = ['Luca', 'Matteo', 'Andrea', 'Marco', 'Simone', 'Davide', 'Alessio', 'Nicolo', 'Gabriele', 'Federico', 'Riccardo', 'Tommaso'];
const YOUTH_LAST_NAMES = ['Ferrari', 'Bruno', 'Galli', 'Conti', 'Rinaldi', 'Marini', 'Barbieri', 'Fontana', 'Serra', 'Longo', 'Villa', 'Gatti'];

const youthName = (seed: string) => {
  const first = YOUTH_FIRST_NAMES[Math.floor(hashRatio(`${seed}-first`) * YOUTH_FIRST_NAMES.length) % YOUTH_FIRST_NAMES.length];
  const last = YOUTH_LAST_NAMES[Math.floor(hashRatio(`${seed}-last`) * YOUTH_LAST_NAMES.length) % YOUTH_LAST_NAMES.length];
  return `${first} ${last}`;
};

const ageGroupForAge = (age: number): YouthAgeGroup => (
  age <= 16 ? 'u16' : age === 17 ? 'u17' : age === 18 ? 'u18' : 'u19'
);

const localConnectionFor = (seed: string): YouthLocalConnection => {
  const roll = hashRatio(`${seed}-local`);
  if (roll < 0.5) return 'local';
  if (roll < 0.8) return 'regional';
  if (roll < 0.95) return 'national';
  return 'international';
};

const pickRole = (seed: string, index: number, batchSize: number, rolesSoFar: PlayerRole[], hasGkAlready: boolean): PlayerRole => {
  const hasGk = hasGkAlready || rolesSoFar.includes('GK');
  // Garantisce almeno un portiere nel gruppo totale: se ancora nessuno, forza l'ultimo slot del batch.
  if (!hasGk && index === batchSize - 1) return 'GK';
  return YOUTH_ROLE_POOL[Math.floor(hashRatio(`${seed}-role-${index}`) * YOUTH_ROLE_POOL.length) % YOUTH_ROLE_POOL.length];
};

// Costruisce un singolo prospetto fittizio: overall/potenziale bassi o medio-bassi, rarissimi
// profili di alto potenziale, mai un sedicenne gia' pronto da titolare.
const buildYouthProspect = (
  club: ClubProfile,
  season: string,
  intakeIndex: number,
  slotIndex: number,
  batchSize: number,
  qualityIndex: number,
  rolesSoFar: PlayerRole[],
  hasGkAlready: boolean
): Player => {
  const seed = `${club.id}-youth-${season}-${intakeIndex}-${slotIndex}`;
  const age = 15 + Math.floor(hashRatio(`${seed}-age`) * 4); // 15-18
  const qualityLift = qualityIndex / 100;

  const overall = Math.round(clamp(36 + hashRatio(`${seed}-ov`) * 16 + qualityLift * 4, 30, 56));
  const isHighPotential = hashRatio(`${seed}-hp`) < 0.03 + qualityLift * 0.05; // max ~8%
  const potentialCeiling = isHighPotential ? 86 + seeded(seed, 'hp-top', 0, 6) : 62 + Math.round(qualityLift * 12);
  const potential = Math.round(clamp(overall + 10 + hashRatio(`${seed}-pot`) * Math.max(6, potentialCeiling - overall - 10), overall + 6, 90));

  const role = pickRole(seed, slotIndex, batchSize, rolesSoFar, hasGkAlready);
  const name = youthName(seed);

  const basePlayer = {
    id: `youth_${club.id}_${season.replace(/[^0-9]/g, '')}_${intakeIndex}_${slotIndex}`,
    name,
    role,
    age,
    nationality: 'Italia',
    overall,
    potential
  };

  const personality = buildPlayerPersonality(basePlayer, club.name, slotIndex);

  const youthProfile: YouthAcademyProfile = {
    academyClubId: club.id,
    academyClubName: club.name,
    intakeSeason: season,
    academyStatus: 'prospect',
    academyAgeGroup: ageGroupForAge(age),
    localConnection: localConnectionFor(seed),
    initialScoutConfidence: Math.round(clamp(30 + qualityLift * 30 + hashRatio(`${seed}-conf`) * 20, 20, 82)),
    academyDevelopmentMinutes: 0,
    academyForm: Math.round(clamp(50 + hashRatio(`${seed}-form`) * 16 - 8, 35, 70))
  };

  const rawPlayer: Player = {
    ...basePlayer,
    form: 6.0,
    morale: 68,
    condition: 100,
    stamina: 55,
    value: Math.round(clamp(overall * 8000, 40000, 900000) / 10000) * 10000,
    wage: Math.round(clamp(150 + overall * 4, 150, 500) / 10) * 10,
    contractYears: 0,
    status: 'Disponibile',
    personality,
    relationships: buildPlayerRelationships(basePlayer, personality),
    careerMemory: buildCareerMemory(),
    clubHistory: [{ clubId: club.id, clubName: club.name, joinedSeason: season, transferType: 'initial' }],
    squadStatus: 'youth_academy',
    youthProfile
  };

  const withPhysical = ensurePlayerPhysicalState(rawPlayer, club.name, slotIndex);
  return ensurePlayerDevelopmentState(withPhysical, club.name, slotIndex, 1);
};

export const generateYouthIntake = (
  club: ClubProfile,
  facilitiesState: ClubFacilitiesState,
  clubStaffState: ClubStaffState,
  season: string,
  intakeIndex: number,
  currentActiveCount: number,
  teamDNA?: TeamDNAState,
  hasExistingGk = false
): Player[] => {
  const qualityIndex = buildYouthQualityIndex(club, facilitiesState, clubStaffState, teamDNA);
  const seed = `${club.id}-intake-${season}-${intakeIndex}`;
  const desired = MIN_INTAKE_PER_SEASON + Math.floor(hashRatio(`${seed}-count`) * (MAX_INTAKE_PER_SEASON - MIN_INTAKE_PER_SEASON + 1));
  const roomLeft = Math.max(0, MAX_ACTIVE_YOUTH - currentActiveCount);
  const count = Math.min(desired, roomLeft);

  const prospects: Player[] = [];
  const roles: PlayerRole[] = [];
  for (let i = 0; i < count; i += 1) {
    const prospect = buildYouthProspect(club, season, intakeIndex, i, count, qualityIndex, roles, hasExistingGk);
    roles.push(prospect.role);
    prospects.push(prospect);
  }
  return prospects;
};

// Genera l'intake stagionale una sola volta per stagione (guardia su lastIntakeSeason): sicuro sia
// per una nuova carriera (prima chiamata) sia per un cambio stagione reale successivo.
export const ensureSeasonalYouthIntake = (
  players: Player[],
  state: YouthAcademyState,
  club: ClubProfile,
  facilitiesState: ClubFacilitiesState,
  clubStaffState: ClubStaffState,
  season: string,
  teamDNA?: TeamDNAState
): { players: Player[]; state: YouthAcademyState } => {
  if (state.lastIntakeSeason === season) return { players, state };

  const activePlayers = players.filter(p => state.playerIds.includes(p.id) && isActiveAcademyPlayer(p));
  const activeCount = activePlayers.length;
  const hasExistingGk = activePlayers.some(p => p.role === 'GK');
  const intakeIndex = state.lastIntakeSeason ? 1 : 0;
  const newProspects = generateYouthIntake(club, facilitiesState, clubStaffState, season, intakeIndex, activeCount, teamDNA, hasExistingGk);

  if (newProspects.length === 0) {
    return { players, state: { ...state, lastIntakeSeason: season } };
  }

  const report: YouthAcademyReport = {
    id: `yrep_intake_${season}_${intakeIndex}`,
    createdAt: new Date().toISOString(),
    type: 'intake',
    title: 'Nuovi ingressi nel vivaio',
    summary: `${newProspects.length} nuovi prospetti si aggiungono al settore giovanile in questa stagione.`,
    importance: 40,
    sourceId: `intake-${season}`
  };

  return {
    players: [...players, ...newProspects],
    state: {
      ...state,
      playerIds: [...state.playerIds, ...newProspects.map(p => p.id)].slice(-MAX_ACTIVE_YOUTH * 2),
      lastIntakeSeason: season,
      recentReports: [report, ...state.recentReports].slice(0, MAX_REPORTS)
    }
  };
};

// ─── Sviluppo nel vivaio: cicli lenti, mai un overall istantaneo, riusa developmentProfile ───

const isActiveAcademyPlayer = (player: Player) => (
  player.squadStatus === 'youth_academy'
  && player.youthProfile
  && player.youthProfile.academyStatus !== 'promoted'
  && player.youthProfile.academyStatus !== 'released'
);

const advanceYouthDevelopment = (
  player: Player,
  club: ClubProfile,
  facilitiesState: ClubFacilitiesState,
  clubStaffState: ClubStaffState,
  round: number,
  teamDNA?: TeamDNAState
): { player: Player; noteworthy?: { type: YouthAcademyReport['type']; summary: string; importance: number } } => {
  const withDev = ensurePlayerDevelopmentState(player, club.name, 0, round);
  const profile = withDev.developmentProfile!;
  const youthProfile = withDev.youthProfile!;
  const qualityIndex = buildYouthQualityIndex(club, facilitiesState, clubStaffState, teamDNA);
  const seed = `${player.id}-review-${round}`;

  // Il coach dello sviluppo + il centro giovanile influenzano in modo MODERATO, mai decisivo.
  const staffFactor = 0.8 + (qualityIndex / 100) * 0.4; // 0.8-1.2
  const ageCurve = withDev.age <= 16 ? 1.1 : withDev.age <= 18 ? 1 : 0.85;
  const formDelta = Math.round(clamp((hashRatio(`${seed}-form`) - 0.42) * 14, -6, 8));
  const nextAcademyForm = Math.round(clamp(youthProfile.academyForm + formDelta, 25, 92));

  // Crescita interna: deliberatamente piu' lenta di un giovane che gioca davvero in prima squadra.
  const growthDelta = Math.max(0, 0.008 + hashRatio(`${seed}-growth`) * 0.02) * staffFactor * ageCurve * (nextAcademyForm / 70);
  const nextSeasonGrowth = Number((profile.seasonGrowth + growthDelta).toFixed(3));
  const nextMinutes = youthProfile.academyDevelopmentMinutes + 120 + Math.round(hashRatio(`${seed}-minutes`) * 60);

  // Soglia cumulativa (non legata alle giornate trascorse dall'ultima review, che resetterebbe
  // sempre a 4): quando la crescita interna accumulata supera la soglia, tenta un piccolo passo
  // avanti e "spende" la soglia, cosi' il prossimo passo richiede nuova crescita accumulata.
  const BUMP_THRESHOLD = 0.3;
  const dueForBump = nextSeasonGrowth >= BUMP_THRESHOLD;
  let nextOverall = withDev.overall;
  let carriedSeasonGrowth = nextSeasonGrowth;
  let noteworthy: { type: YouthAcademyReport['type']; summary: string; importance: number } | undefined;

  if (dueForBump && withDev.overall < withDev.potential) {
    carriedSeasonGrowth = Number((nextSeasonGrowth - BUMP_THRESHOLD).toFixed(3));
    if (hashRatio(`${seed}-bump`) < clamp(0.22 + qualityIndex / 400, 0.15, 0.42)) {
      nextOverall = Math.min(withDev.overall + 1, withDev.potential);
      noteworthy = { type: 'progress', summary: `${withDev.name} risponde bene al percorso nel vivaio: piccolo passo avanti.`, importance: 42 };
    }
  } else if (growthDelta < 0.01 && nextAcademyForm < 45) {
    noteworthy = { type: 'stagnation', summary: `${withDev.name} fatica a fare progressi visibili nel vivaio.`, importance: 34 };
  }

  const nextGap = withDev.potential - nextOverall;
  let nextAcademyStatus: YouthAcademyStatus = youthProfile.academyStatus;
  if (youthProfile.academyStatus === 'prospect' && nextGap >= 20 && hashRatio(`${seed}-hp-check`) > 0.5) {
    nextAcademyStatus = 'high_potential';
  }
  if (withDev.age >= 17 && nextAcademyForm >= 58 && nextOverall >= 46 && youthProfile.academyStatus !== 'high_potential') {
    nextAcademyStatus = 'promotion_candidate';
  } else if (withDev.age >= 17 && youthProfile.academyStatus === 'high_potential' && nextAcademyForm >= 55) {
    nextAcademyStatus = 'promotion_candidate';
  }
  if (nextAcademyStatus === 'promotion_candidate' && youthProfile.academyStatus !== 'promotion_candidate') {
    noteworthy = { type: 'promotion_recommendation', summary: `${withDev.name} e' pronto per una valutazione di promozione in prima squadra.`, importance: 62 };
  }

  const updatedPlayer: Player = {
    ...withDev,
    overall: nextOverall,
    developmentProfile: { ...profile, seasonGrowth: carriedSeasonGrowth },
    youthProfile: {
      ...youthProfile,
      academyForm: nextAcademyForm,
      academyDevelopmentMinutes: nextMinutes,
      academyStatus: nextAcademyStatus,
      lastAcademyReviewRound: round,
      academyAgeGroup: ageGroupForAge(withDev.age)
    }
  };

  return { player: updatedPlayer, noteworthy };
};

// Review periodica: ogni 4 giornate reali, massimo un report rilevante per chiamata, mai piu' di
// una modifica per giovane nella stessa giornata.
export const runYouthAcademyReview = (
  players: Player[],
  state: YouthAcademyState,
  club: ClubProfile,
  facilitiesState: ClubFacilitiesState,
  clubStaffState: ClubStaffState,
  round: number,
  teamDNA?: TeamDNAState
): { players: Player[]; state: YouthAcademyState } => {
  if (state.lastReviewRound !== undefined && round - state.lastReviewRound < REVIEW_INTERVAL_ROUNDS) {
    return { players, state };
  }

  let bestNoteworthy: { type: YouthAcademyReport['type']; summary: string; importance: number; playerId: string } | undefined;

  const updatedPlayers = players.map(rawPlayer => {
    if (!isActiveAcademyPlayer(rawPlayer)) return rawPlayer;
    if (rawPlayer.youthProfile?.lastAcademyReviewRound === round) return rawPlayer;

    const { player, noteworthy } = advanceYouthDevelopment(rawPlayer, club, facilitiesState, clubStaffState, round, teamDNA);
    if (noteworthy && (!bestNoteworthy || noteworthy.importance > bestNoteworthy.importance)) {
      bestNoteworthy = { ...noteworthy, playerId: player.id };
    }
    return player;
  });

  const report: YouthAcademyReport | null = bestNoteworthy ? {
    id: `yrep_${round}_${bestNoteworthy.playerId}`,
    createdAt: new Date().toISOString(),
    playerId: bestNoteworthy.playerId,
    type: bestNoteworthy.type,
    title: bestNoteworthy.type === 'promotion_recommendation' ? 'Candidato alla promozione' :
      bestNoteworthy.type === 'stagnation' ? 'Crescita in stallo' : 'Progressi nel vivaio',
    summary: bestNoteworthy.summary,
    importance: bestNoteworthy.importance,
    sourceId: `review-${round}`
  } : null;

  return {
    players: updatedPlayers,
    state: {
      ...state,
      lastReviewRound: round,
      recentReports: report ? [report, ...state.recentReports].slice(0, MAX_REPORTS) : state.recentReports
    }
  };
};

// ─── Promozione e rilascio ───

export const getPromotionCandidates = (players: Player[], state: YouthAcademyState): Player[] => (
  players
    .filter(p => state.playerIds.includes(p.id) && isActiveAcademyPlayer(p) && p.age >= 16)
    .filter(p => p.youthProfile!.academyStatus === 'promotion_candidate' || p.youthProfile!.academyStatus === 'high_potential')
    .sort((a, b) => (b.overall + b.potential) - (a.overall + a.potential))
);

export interface PromoteYouthPlayerResult {
  success: boolean;
  reason?: string;
  player?: Player;
}

// Promozione: crea un contratto giovanile reale (stipendio basso, ruolo prospect) solo se il budget
// stipendi lo regge; mai un costo di cartellino, mai un bonus firma rilevante.
export const promoteYouthPlayer = (
  player: Player,
  club: ClubProfile,
  wageBudget: ClubWageBudgetState,
  season: string,
  round: number
): PromoteYouthPlayerResult => {
  if (player.squadStatus !== 'youth_academy' || !player.youthProfile) {
    return { success: false, reason: 'Il giocatore non fa parte del vivaio.' };
  }
  if (player.youthProfile.academyStatus === 'released') {
    return { success: false, reason: 'Il giocatore e gia stato rilasciato dal vivaio.' };
  }
  if (player.age < 16) {
    return { success: false, reason: 'Il giocatore non ha ancora l\'eta minima per essere promosso.' };
  }

  const annualSalary = Math.round(clamp(45000 + player.overall * 1400, 45000, 160000) / 1000) * 1000;
  if (annualSalary > wageBudget.availableAnnualWages) {
    return { success: false, reason: 'Il budget stipendi non regge nemmeno il contratto minimo previsto per la promozione.' };
  }

  const promotedPlayer = applySignedContract(
    { ...player, squadStatus: 'first_team' as const },
    club,
    { annualSalary, years: 3, squadRole: 'prospect', signingBonus: 0, agentFee: 0 },
    season,
    false
  );

  return {
    success: true,
    player: {
      ...promotedPlayer,
      youthProfile: { ...player.youthProfile, academyStatus: 'promoted', promotedAtRound: round }
    }
  };
};

export const releaseYouthPlayer = (player: Player, season: string): Player => {
  if (!player.youthProfile) return player;
  return {
    ...player,
    squadStatus: 'released',
    youthProfile: { ...player.youthProfile, academyStatus: 'released', releasedAtSeason: season }
  };
};

// ─── Riepilogo per la UI ───

export type YouthPotentialLabel = 'Da osservare' | 'Prospetto interessante' | 'Potenziale da prima squadra' | 'Talento raro';

// Non mostra mai realizedCeiling: solo una lettura qualitativa, la cui precisione dipende dallo
// staff/struttura (development_coach, youth_academy, chief_scout se disponibile).
export const getYouthPotentialLabel = (
  player: Player,
  clubStaffState: ClubStaffState,
  facilitiesState: ClubFacilitiesState
): YouthPotentialLabel => {
  const devCoach = getClubStaffMember(clubStaffState, 'development_coach')?.youthDevelopment ?? 60;
  const scoutQuality = getClubStaffMember(clubStaffState, 'chief_scout')?.scoutingAccuracy ?? 55;
  const academyLevel = getFacility(facilitiesState, 'youth_academy')?.level ?? 1;
  const precision = clamp((devCoach + scoutQuality) / 2 + (academyLevel - 1) * 4, 30, 95) / 100;

  const gap = player.potential - player.overall;
  const noisyGap = gap + (hashRatio(`${player.id}-potential-noise`) - 0.5) * (1 - precision) * 24;

  if (noisyGap >= 30) return 'Talento raro';
  if (noisyGap >= 18) return 'Potenziale da prima squadra';
  if (noisyGap >= 9) return 'Prospetto interessante';
  return 'Da osservare';
};

export interface YouthAcademySummary {
  academyLevel: number;
  activeCount: number;
  topProspects: Player[];
  topRecommendation: YouthAcademyReport | null;
}

export const getYouthAcademySummary = (
  players: Player[],
  state: YouthAcademyState,
  facilitiesState: ClubFacilitiesState
): YouthAcademySummary => {
  const active = players.filter(p => state.playerIds.includes(p.id) && isActiveAcademyPlayer(p));
  const topProspects = [...active]
    .sort((a, b) => (b.overall + b.potential * 0.6) - (a.overall + a.potential * 0.6))
    .slice(0, MAX_DASHBOARD_HIGHLIGHTS);

  return {
    academyLevel: getFacility(facilitiesState, 'youth_academy')?.level ?? 1,
    activeCount: active.length,
    topProspects,
    topRecommendation: state.recentReports[0] ?? null
  };
};

export const getActiveYouthPlayers = (players: Player[], state: YouthAcademyState): Player[] => (
  players.filter(p => state.playerIds.includes(p.id) && isActiveAcademyPlayer(p))
);
