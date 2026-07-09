import {
  CareerWorldEvent,
  CareerWorldState,
  ClubHistoryState,
  ClubMemoryDraft,
  ClubProfile,
  FanGroupKey,
  FanGroupState,
  FanGroupTrend,
  FanState,
  OwnershipObjective,
  OwnershipObjectiveCategory,
  OwnershipObjectiveStatus,
  OwnershipState,
  OwnershipType,
  Player,
  PlayerFanStanding,
  PlayerFanStatus,
  Standing,
} from '../types';
import { createInitialMediaState, normalizeMediaState } from './mediaEngine';
import { createInitialClubStaffState, normalizeClubStaffState } from './staff';
import { createInitialClubFacilitiesState, normalizeClubFacilitiesState } from './facilities';
import { createInitialClubWageBudgetState, normalizeClubWageBudgetState } from './playerContracts';
import { createInitialYouthAcademyState, normalizeYouthAcademyState } from './youthAcademy';
import { createInitialOutgoingMarketState, normalizeOutgoingMarketState } from './outgoingMarket';
import { normalizeFutureContractAgreements, normalizeFirstRefusalTriggers, createSeasonTransferWindows, normalizeTransferWindows, normalizeTransferCompetitions, normalizePlayerAgentProfiles } from './transferDeals';
import { CURRENT_SEASON } from './clubHistory';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// ─── Fan Group Definitions ───

const FAN_GROUP_LABELS: Record<FanGroupKey, string> = {
  curva: 'Curva',
  tradizionali: 'Tifosi Tradizionali',
  locali: 'Tifosi Locali',
  occasionali: 'Occasionali',
  sponsor: 'Sponsor & Corporate',
};

// Archetypal priorities per group: fixed identity traits, not derived from club data,
// so they are stable by construction (same every career, no randomness involved).
const FAN_GROUP_PRIORITIES: Record<FanGroupKey, string[]> = {
  curva: ['Derby e rivalità', 'Impegno in campo', 'Bandiere e giocatori simbolo', 'Identità del club'],
  tradizionali: ['Classifica', 'Continuità di risultati', 'Rispetto della storia', 'Stabilità del progetto'],
  locali: ['Giovani del vivaio', 'Legame con la città', 'Giocatori locali'],
  occasionali: ['Vittorie', 'Gol e spettacolo', 'Grandi partite', 'Reputazione'],
  sponsor: ['Risultati', 'Reputazione', 'Stabilità', 'Visibilità'],
};

const createFanGroup = (
  key: FanGroupKey,
  mood: number,
  patience: number,
  influence: number
): FanGroupState => ({
  key,
  label: FAN_GROUP_LABELS[key],
  mood: Math.round(clamp(mood, 0, 100)),
  patience: Math.round(clamp(patience, 0, 100)),
  influence: Math.round(clamp(influence, 0, 100)),
  priorities: FAN_GROUP_PRIORITIES[key],
  recentReasons: [],
  trend: 'stabile',
  updatedAt: new Date().toISOString(),
});

// ─── Ownership Inference from ClubProfile ───

const inferOwnershipType = (ownership: string): OwnershipType => {
  const lower = ownership.toLowerCase();
  if (lower.includes('family') || lower.includes('famiglia') || lower.includes('cairo') || lower.includes('percassi') || lower.includes('pozzo') || lower.includes('commisso') || lower.includes('saputo') || lower.includes('lotito') || lower.includes('stirpe') || lower.includes('sticchi') || lower.includes('giulini')) return 'famiglia';
  if (lower.includes('capital') || lower.includes('oaktree') || lower.includes('fund') || lower.includes('redbird') || lower.includes('exor') || lower.includes('fininvest') || lower.includes('llc')) return 'fondo';
  if (lower.includes('group') || lower.includes('djarum') || lower.includes('krause') || lower.includes('friedkin') || lower.includes('filmauro') || lower.includes('mapei') || lower.includes('newco')) return 'gruppo_industriale';
  if (lower.includes('sucu') || lower.includes('magnate')) return 'magnate';
  return 'gruppo_industriale';
};

const inferFinancialStatus = (budget: number, pressure: number): OwnershipState['financialStatus'] => {
  if (budget >= 70000000 && pressure < 85) return 'solido';
  if (budget >= 35000000) return 'equilibrato';
  if (budget >= 15000000) return 'in_tensione';
  return 'critico';
};

// L1B: rigenera l'obiettivo sportivo stagionale (mai gli altri due, gia' gestiti dal loro ciclo
// normale) quando il club utente cambia divisione, riusando la stessa inferObjectives gia'
// esistente con solo il titolo/promessa societaria sostituiti dal nuovo contesto di lega.
export const regenerateObjectivesForDivisionChange = (club: ClubProfile, objectiveTitle: string): OwnershipObjective[] => (
  inferObjectives({ ...club, objective: objectiveTitle, boardPromise: `Mandato societario per la nuova stagione: ${objectiveTitle}.` })
);

const inferObjectives = (club: ClubProfile): OwnershipObjective[] => {
  const now = new Date().toISOString();
  const sportiveTitle = club.objective || 'Stabilità sportiva';

  return [
    {
      id: `obj_sport_${club.id}`,
      title: sportiveTitle,
      description: club.boardPromise && club.boardPromise !== club.objective
        ? club.boardPromise
        : `Mandato societario per la stagione: ${sportiveTitle}.`,
      category: 'sportivo',
      importance: 80,
      progress: 50,
      status: 'in_corso',
      reason: 'Stagione appena iniziata: obiettivo ancora tutto da scrivere.',
      updatedAt: now,
    },
    {
      id: `obj_youth_${club.id}`,
      title: 'Spazio al vivaio',
      description: `Dare minutaggio a giovani di prospettiva della rosa del ${club.name}.`,
      category: 'identitario',
      importance: 55,
      progress: 0,
      status: 'in_corso',
      reason: 'Il progetto giovani parte da zero in questa stagione.',
      updatedAt: now,
    },
    {
      id: `obj_budget_${club.id}`,
      title: 'Stabilità economica',
      description: 'Gestire con equilibrio il budget trasferimenti a disposizione.',
      category: 'economico',
      importance: 60,
      progress: 100,
      status: 'in_corso',
      reason: 'Il budget iniziale è ancora intatto.',
      updatedAt: now,
    },
  ];
};

// ─── Fanbase Mood Derivation ───

const inferBaseMood = (club: ClubProfile): number => {
  // Start from a neutral-positive base; higher pressure = slightly lower starting mood
  // (fans are expectant but not yet disappointed)
  return clamp(62 - club.pressure * 0.12, 45, 72);
};

const inferFanbasePatience = (fanbase: string, pressure: number): number => {
  const lower = fanbase.toLowerCase();
  if (lower.includes('impazient') || lower.includes('sever') || lower.includes('pretend')) return clamp(36 - pressure * 0.06, 22, 42);
  if (lower.includes('pazient') || lower.includes('seren') || lower.includes('fedel')) return clamp(68 - pressure * 0.05, 50, 76);
  if (lower.includes('ambizios') || lower.includes('esigent')) return clamp(44 - pressure * 0.08, 28, 50);
  return clamp(52 - pressure * 0.06, 34, 62);
};

// ─── Public API ───

export const getMoodLabel = (value: number): string => {
  if (value >= 82) return 'Entusiasmo';
  if (value >= 70) return 'Fiducia';
  if (value >= 58) return 'Supporto prudente';
  if (value >= 46) return 'Attesa';
  if (value >= 34) return 'Insoddisfazione';
  if (value >= 22) return 'Delusione';
  return 'Contestazione';
};

export const createInitialCareerWorld = (club: ClubProfile, players: Player[] = []): CareerWorldState => {
  const baseMood = inferBaseMood(club);
  const fanPatience = inferFanbasePatience(club.fanbase, club.pressure);
  const budgetScale = clamp(club.transferBudget / 80000000, 0.15, 1.3);

  const fanGroups: FanGroupState[] = [
    createFanGroup('curva', clamp(baseMood - 4, 30, 72), clamp(fanPatience - 8, 18, 58), 82),
    createFanGroup('tradizionali', clamp(baseMood + 2, 40, 76), clamp(fanPatience + 4, 32, 72), 72),
    createFanGroup('locali', clamp(baseMood + 4, 42, 78), clamp(fanPatience + 8, 38, 78), 56),
    createFanGroup('occasionali', clamp(baseMood + 6, 48, 80), clamp(fanPatience + 14, 46, 84), 34),
    createFanGroup('sponsor', clamp(52 + budgetScale * 12, 46, 74), 66, 62),
  ];

  const overallMood = Math.round(
    fanGroups.reduce((sum, g) => sum + g.mood * g.influence, 0) /
    Math.max(1, fanGroups.reduce((sum, g) => sum + g.influence, 0))
  );

  const fanState: FanState = {
    overallMood,
    groups: fanGroups,
    recentReactions: [],
    mostLovedPlayerIds: [],
    mostCriticizedPlayerIds: [],
    lastMoodChange: 0,
    playerStandings: [],
  };

  const ownerType = inferOwnershipType(club.ownership);

  const ownershipState: OwnershipState = {
    ownerType,
    ambition: Math.round(clamp(42 + club.pressure * 0.45, 40, 95)),
    patience: Math.round(clamp(66 - club.pressure * 0.28, 28, 76)),
    liquidity: Math.round(clamp(28 + budgetScale * 45, 25, 92)),
    prudence: Math.round(clamp(
      ownerType === 'fondo' ? 72 :
      ownerType === 'famiglia' ? 62 :
      ownerType === 'magnate' ? 48 :
      55,
      30, 88
    )),
    boardConfidence: 58,
    financialStatus: inferFinancialStatus(club.transferBudget, club.pressure),
    currentObjectives: inferObjectives(club),
    lastConfidenceChange: 0,
    lastReactionNote: '',
  };

  const now = new Date().toISOString();

  return {
    clubId: club.id,
    fanState,
    ownershipState,
    activeEvents: [],
    historicalEvents: [],
    lastProcessedMatchIds: [],
    lastProcessedTransferIds: [],
    mediaState: createInitialMediaState(),
    clubStaffState: createInitialClubStaffState(club, CURRENT_SEASON),
    clubFacilitiesState: createInitialClubFacilitiesState(club),
    clubWageBudgetState: createInitialClubWageBudgetState(players, club, CURRENT_SEASON),
    youthAcademyState: createInitialYouthAcademyState(club.id, CURRENT_SEASON),
    outgoingMarketState: createInitialOutgoingMarketState(),
    futureContractAgreements: [],
    firstRefusalTriggers: [],
    transferWindows: createSeasonTransferWindows(CURRENT_SEASON),
    transferCompetitions: [],
    playerAgentProfiles: [],
    createdAt: now,
    updatedAt: now,
  };
};

// ─── Normalize (migration-safe loader) ───

const VALID_FAN_TRENDS: FanGroupTrend[] = ['positivo', 'stabile', 'negativo'];

const normalizeFanGroup = (raw: Partial<FanGroupState>, key: FanGroupKey): FanGroupState => ({
  key,
  label: raw.label ?? FAN_GROUP_LABELS[key],
  mood: Math.round(clamp(raw.mood ?? 55, 0, 100)),
  patience: Math.round(clamp(raw.patience ?? 50, 0, 100)),
  influence: Math.round(clamp(raw.influence ?? 50, 0, 100)),
  lastReaction: raw.lastReaction,
  priorities: Array.isArray(raw.priorities) && raw.priorities.length > 0 ? raw.priorities : FAN_GROUP_PRIORITIES[key],
  recentReasons: Array.isArray(raw.recentReasons) ? raw.recentReasons.slice(0, 3) : [],
  trend: VALID_FAN_TRENDS.includes(raw.trend as FanGroupTrend) ? raw.trend as FanGroupTrend : 'stabile',
  updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
});

const ALL_FAN_KEYS: FanGroupKey[] = ['curva', 'tradizionali', 'locali', 'occasionali', 'sponsor'];

const VALID_OWNERSHIP_TYPES: OwnershipType[] = ['famiglia', 'fondo', 'magnate', 'azionariato', 'gruppo_industriale'];
const VALID_FINANCIAL_STATUSES: OwnershipState['financialStatus'][] = ['solido', 'equilibrato', 'in_tensione', 'critico'];
const VALID_OBJECTIVE_CATEGORIES: OwnershipObjectiveCategory[] = ['sportivo', 'identitario', 'economico'];
const VALID_OBJECTIVE_STATUSES: OwnershipObjectiveStatus[] = ['in_corso', 'positivo', 'a_rischio', 'completato', 'fallito'];

const normalizeObjective = (raw: unknown, index: number, club: ClubProfile): OwnershipObjective | null => {
  const now = new Date().toISOString();
  if (typeof raw === 'string') {
    return {
      id: `obj_legacy_${index}_${club.id}`,
      title: raw,
      description: raw,
      category: index === 1 ? 'identitario' : index === 2 ? 'economico' : 'sportivo',
      importance: 60,
      progress: 50,
      status: 'in_corso',
      reason: 'Obiettivo ereditato da un salvataggio precedente.',
      updatedAt: now,
    };
  }
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.title !== 'string') return null;
  return {
    id: typeof item.id === 'string' ? item.id : `obj_${index}_${club.id}`,
    title: item.title,
    description: typeof item.description === 'string' ? item.description : item.title,
    category: VALID_OBJECTIVE_CATEGORIES.includes(item.category as OwnershipObjectiveCategory) ? item.category as OwnershipObjectiveCategory : 'sportivo',
    importance: typeof item.importance === 'number' ? Math.round(clamp(item.importance, 0, 100)) : 60,
    progress: typeof item.progress === 'number' ? Math.round(clamp(item.progress, 0, 100)) : 50,
    status: VALID_OBJECTIVE_STATUSES.includes(item.status as OwnershipObjectiveStatus) ? item.status as OwnershipObjectiveStatus : 'in_corso',
    reason: typeof item.reason === 'string' ? item.reason : '',
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
  };
};

const normalizeObjectiveList = (raw: unknown, club: ClubProfile): OwnershipObjective[] => {
  if (!Array.isArray(raw) || raw.length === 0) return inferObjectives(club);
  const normalized = raw
    .map((item, index) => normalizeObjective(item, index, club))
    .filter((o): o is OwnershipObjective => o !== null);
  return normalized.length > 0 ? normalized.slice(0, 3) : inferObjectives(club);
};

const VALID_FAN_STATUSES: PlayerFanStatus[] = [
  'idolo_curva', 'molto_amato', 'apprezzato', 'neutrale', 'sotto_osservazione', 'criticato', 'contestato', 'simbolo_club'
];

const normalizePlayerFanStanding = (raw: unknown): PlayerFanStanding | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.playerId !== 'string') return null;
  return {
    playerId: item.playerId,
    affection: typeof item.affection === 'number' ? Math.round(clamp(item.affection, 0, 100)) : 42,
    criticism: typeof item.criticism === 'number' ? Math.round(clamp(item.criticism, 0, 100)) : 12,
    status: VALID_FAN_STATUSES.includes(item.status as PlayerFanStatus) ? item.status as PlayerFanStatus : 'neutrale',
    recentReasons: Array.isArray(item.recentReasons) ? (item.recentReasons as string[]).slice(0, 3) : [],
    lastUpdatedAt: typeof item.lastUpdatedAt === 'string' ? item.lastUpdatedAt : new Date().toISOString(),
    isAcademyOrLocal: item.isAcademyOrLocal === true,
    isClubLegendCandidate: item.isClubLegendCandidate === true,
    isFanFavorite: item.isFanFavorite === true,
    isUnderPressure: item.isUnderPressure === true,
  };
};

const normalizePlayerFanStandingList = (raw: unknown): PlayerFanStanding[] =>
  Array.isArray(raw) ? raw.map(normalizePlayerFanStanding).filter((s): s is PlayerFanStanding => s !== null).slice(0, 60) : [];

const normalizeEvent = (raw: unknown): CareerWorldEvent | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.description !== 'string') return null;

  return {
    id: item.id,
    date: typeof item.date === 'string' ? item.date : new Date().toISOString(),
    season: typeof item.season === 'string' ? item.season : '',
    type: item.type === 'transfer_reaction' ? 'transfer_reaction' : 'match_result',
    title: item.title,
    description: item.description,
    importance: Math.round(clamp(typeof item.importance === 'number' ? item.importance : 0, 0, 100)),
    relatedMatchId: typeof item.relatedMatchId === 'string' ? item.relatedMatchId : undefined,
    relatedPlayerIds: Array.isArray(item.relatedPlayerIds) ? (item.relatedPlayerIds as string[]) : undefined,
    fanMoodChange: typeof item.fanMoodChange === 'number' ? item.fanMoodChange : 0,
    boardConfidenceChange: typeof item.boardConfidenceChange === 'number' ? item.boardConfidenceChange : 0,
    reasons: Array.isArray(item.reasons) ? (item.reasons as string[]) : [],
    isRead: item.isRead === true,
    isHistorical: item.isHistorical === true,
  };
};

const normalizeEventList = (raw: unknown): CareerWorldEvent[] =>
  Array.isArray(raw) ? raw.map(normalizeEvent).filter((event): event is CareerWorldEvent => event !== null).slice(0, 40) : [];

export const normalizeCareerWorld = (value: unknown, club: ClubProfile, players: Player[] = []): CareerWorldState => {
  if (!value || typeof value !== 'object') return createInitialCareerWorld(club, players);

  const raw = value as Record<string, unknown>;
  if (raw.clubId !== club.id) return createInitialCareerWorld(club, players);

  const fallback = createInitialCareerWorld(club, players);

  // Normalize fan groups
  const rawFan = (raw.fanState ?? {}) as Record<string, unknown>;
  const rawGroups = Array.isArray(rawFan.groups) ? rawFan.groups as Partial<FanGroupState>[] : [];
  const groupByKey = new Map(rawGroups.map(g => [g.key, g]));

  const groups = ALL_FAN_KEYS.map(key => {
    const existing = groupByKey.get(key);
    if (existing) return normalizeFanGroup(existing, key);
    const fb = fallback.fanState.groups.find(g => g.key === key);
    return fb ?? normalizeFanGroup({}, key);
  });

  const overallMood = Math.round(
    groups.reduce((sum, g) => sum + g.mood * g.influence, 0) /
    Math.max(1, groups.reduce((sum, g) => sum + g.influence, 0))
  );

  const fanState: FanState = {
    overallMood: typeof rawFan.overallMood === 'number' ? Math.round(clamp(rawFan.overallMood, 0, 100)) : overallMood,
    groups,
    recentReactions: Array.isArray(rawFan.recentReactions) ? (rawFan.recentReactions as string[]).slice(0, 20) : [],
    mostLovedPlayerIds: Array.isArray(rawFan.mostLovedPlayerIds) ? (rawFan.mostLovedPlayerIds as string[]).slice(0, 5) : [],
    mostCriticizedPlayerIds: Array.isArray(rawFan.mostCriticizedPlayerIds) ? (rawFan.mostCriticizedPlayerIds as string[]).slice(0, 5) : [],
    lastMoodChange: typeof rawFan.lastMoodChange === 'number' ? rawFan.lastMoodChange : 0,
    playerStandings: normalizePlayerFanStandingList(rawFan.playerStandings),
  };

  // Normalize ownership
  const rawOwn = (raw.ownershipState ?? {}) as Record<string, unknown>;
  const ownerType = VALID_OWNERSHIP_TYPES.includes(rawOwn.ownerType as OwnershipType)
    ? rawOwn.ownerType as OwnershipType
    : fallback.ownershipState.ownerType;
  const financialStatus = VALID_FINANCIAL_STATUSES.includes(rawOwn.financialStatus as OwnershipState['financialStatus'])
    ? rawOwn.financialStatus as OwnershipState['financialStatus']
    : fallback.ownershipState.financialStatus;

  const ownershipState: OwnershipState = {
    ownerType,
    ambition: typeof rawOwn.ambition === 'number' ? Math.round(clamp(rawOwn.ambition, 0, 100)) : fallback.ownershipState.ambition,
    patience: typeof rawOwn.patience === 'number' ? Math.round(clamp(rawOwn.patience, 0, 100)) : fallback.ownershipState.patience,
    liquidity: typeof rawOwn.liquidity === 'number' ? Math.round(clamp(rawOwn.liquidity, 0, 100)) : fallback.ownershipState.liquidity,
    prudence: typeof rawOwn.prudence === 'number' ? Math.round(clamp(rawOwn.prudence, 0, 100)) : fallback.ownershipState.prudence,
    boardConfidence: typeof rawOwn.boardConfidence === 'number' ? Math.round(clamp(rawOwn.boardConfidence, 0, 100)) : fallback.ownershipState.boardConfidence,
    financialStatus,
    currentObjectives: normalizeObjectiveList(rawOwn.currentObjectives, club),
    lastConfidenceChange: typeof rawOwn.lastConfidenceChange === 'number' ? rawOwn.lastConfidenceChange : 0,
    lastReactionNote: typeof rawOwn.lastReactionNote === 'string' ? rawOwn.lastReactionNote : '',
  };

  return {
    clubId: club.id,
    fanState,
    ownershipState,
    activeEvents: normalizeEventList(raw.activeEvents),
    historicalEvents: normalizeEventList(raw.historicalEvents),
    lastProcessedMatchIds: Array.isArray(raw.lastProcessedMatchIds)
      ? (raw.lastProcessedMatchIds as unknown[]).filter((id): id is string => typeof id === 'string').slice(0, 50)
      : [],
    lastProcessedTransferIds: Array.isArray(raw.lastProcessedTransferIds)
      ? (raw.lastProcessedTransferIds as unknown[]).filter((id): id is string => typeof id === 'string').slice(0, 50)
      : [],
    mediaState: normalizeMediaState(raw.mediaState),
    clubStaffState: normalizeClubStaffState(raw.clubStaffState, club, CURRENT_SEASON),
    clubFacilitiesState: normalizeClubFacilitiesState(raw.clubFacilitiesState, club),
    clubWageBudgetState: normalizeClubWageBudgetState(raw.clubWageBudgetState, players, club, CURRENT_SEASON),
    youthAcademyState: normalizeYouthAcademyState(raw.youthAcademyState, club.id, CURRENT_SEASON),
    outgoingMarketState: normalizeOutgoingMarketState(raw.outgoingMarketState),
    futureContractAgreements: normalizeFutureContractAgreements(raw.futureContractAgreements),
    firstRefusalTriggers: normalizeFirstRefusalTriggers(raw.firstRefusalTriggers),
    transferWindows: normalizeTransferWindows(raw.transferWindows, CURRENT_SEASON),
    transferCompetitions: normalizeTransferCompetitions(raw.transferCompetitions),
    playerAgentProfiles: normalizePlayerAgentProfiles(raw.playerAgentProfiles),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallback.createdAt,
    updatedAt: new Date().toISOString(),
  };
};

// ─── Post-match reaction: first version, match_result events only ───

export interface CareerWorldMatchContext {
  matchId: string;
  round: number;
  season: string;
  teamName: string;
  opponentName: string;
  isHome?: boolean;
  scoreUser: number;
  scoreOpponent: number;
  ownRating: number;
  opponentRating: number;
  standings: Standing[];
  rivalryHeat: number; // 0-100, from clubHistory.rivalries
  hasMajorEmotionalStory: boolean; // an Emotional Narrative already covers this match prominently
  club: ClubProfile;
  totalRounds: number; // real calendar length, used as the season-length reference
  seasonFinished: boolean;
  currentBudget: number;
  initialBudget: number;
  youthMinutesTotal: number; // cumulative season minutes played by squad players aged <=21
  decisiveYoungsterName?: string; // set only when a real Emotional Narrative already flags one this match
  matchContributors: CareerWorldPlayerContribution[]; // a handful of real protagonists, pre-filtered by the caller
}

export interface CareerWorldPlayerContribution {
  playerId: string;
  playerName: string;
  age: number;
  goals: number;
  assists: number;
  rating: number; // this match only, neutral 6 if unavailable
  legendScore: number; // player.careerMemory.legendScore, already tracked elsewhere in the project
  isAcademyOrLocal: boolean;
  isNarrativeHero: boolean; // unexpected_hero / redemption_arc tied to this match
  isNarrativeHeroicDefeat: boolean; // heroic_defeat tied to this match
}

export interface CareerWorldMatchResult {
  state: CareerWorldState;
  event: CareerWorldEvent | null;
  fanReaction: string | null;
}

const GROUP_SENSITIVITY: Record<FanGroupKey, number> = {
  curva: 1.35,
  tradizionali: 1.1,
  locali: 1,
  occasionali: 0.8,
  sponsor: 0.45,
};

const computeOverallMood = (groups: FanGroupState[]) => Math.round(
  groups.reduce((sum, g) => sum + g.mood * g.influence, 0) /
  Math.max(1, groups.reduce((sum, g) => sum + g.influence, 0))
);

const getStandingRank = (standings: Standing[], name: string) => standings.find(team => team.name === name)?.rank;

export const computeMatchImportance = (context: CareerWorldMatchContext): number => {
  const totalTeams = context.standings.length || 20;
  const relegationZoneRank = totalTeams - 3;
  const europeZoneRank = 4;
  const ownRank = getStandingRank(context.standings, context.teamName) ?? Math.round(totalTeams / 2);
  const oppRank = getStandingRank(context.standings, context.opponentName) ?? Math.round(totalTeams / 2);

  let importance = 18;
  if (context.round >= 30) importance += 20;
  else if (context.round >= 22) importance += 9;

  if (context.rivalryHeat >= 60) importance += 24;
  else if (context.rivalryHeat >= 38) importance += 12;

  if (ownRank <= europeZoneRank || oppRank <= europeZoneRank) importance += 9;
  if (ownRank >= relegationZoneRank || oppRank >= relegationZoneRank) importance += 13;
  if (Math.abs(ownRank - oppRank) <= 2) importance += 7;

  return Math.round(clamp(importance, 0, 100));
};

interface ReactionPlan {
  fanBaseChange: number;
  groupExtra: Partial<Record<FanGroupKey, number>>;
  groupReasons: Partial<Record<FanGroupKey, string>>;
  boardChange: number;
  fanReaction: string;
  ownerNote: string;
  reasons: string[];
  eventWorthy: boolean;
}

const buildReactionPlan = (
  context: CareerWorldMatchContext,
  result: 'W' | 'D' | 'L',
  matchImportance: number,
  strengthGap: number
): ReactionPlan => {
  const isDerby = context.rivalryHeat >= 55;
  const isPositiveVsStronger = result !== 'L' && strengthGap >= 8;
  const goalDiff = context.scoreOpponent - context.scoreUser;
  const isHeavyDefeat = result === 'L' && (goalDiff >= 3 || (matchImportance >= 55 && goalDiff >= 2));
  const important = matchImportance >= 55;
  const reasons: string[] = [];
  const groupExtra: Partial<Record<FanGroupKey, number>> = {};
  const groupReasons: Partial<Record<FanGroupKey, string>> = {};

  let fanBaseChange = 0;
  let boardChange = 0;
  let fanReaction = '';
  let ownerNote = '';

  if (isPositiveVsStronger) {
    fanBaseChange = result === 'W' ? 6 : 4;
    boardChange = 2;
    groupExtra.curva = result === 'W' ? 6 : 4;
    groupExtra.tradizionali = result === 'W' ? 4 : 2.5;
    reasons.push(`${result === 'W' ? 'Vittoria' : 'Pareggio'} contro un avversario stimato ${strengthGap} punti più forte.`);
    fanReaction = result === 'W'
      ? `Un risultato che dà fiducia: battere il ${context.opponentName}, nettamente più forte sulla carta, scalda l'ambiente.`
      : `Il pareggio con il ${context.opponentName}, favorito sulla carta, viene letto come un buon segnale dalla piazza.`;
    ownerNote = 'La proprietà apprezza la reazione contro una squadra più quotata.';
    groupReasons.curva = result === 'W' ? 'Battere una squadra più quotata scalda la curva.' : 'La curva apprezza il carattere mostrato contro una big.';
    groupReasons.tradizionali = 'Un risultato che rilancia le ambizioni della stagione.';
  } else if (result === 'W') {
    fanBaseChange = important ? 5 : 3;
    boardChange = important ? 1 : 0;
    if (important) reasons.push('Vittoria in una partita importante per classifica o calendario.');
    fanReaction = important
      ? `Vittoria pesante con il ${context.opponentName}: la piazza si scalda.`
      : `I tifosi apprezzano la vittoria contro il ${context.opponentName}.`;
    ownerNote = important ? 'La proprietà nota con favore un successo pesante.' : 'La proprietà osserva con soddisfazione moderata.';
    groupReasons.tradizionali = important ? 'La classifica sorride dopo una vittoria pesante.' : 'Un altro passo di continuità per il progetto.';
    groupReasons.occasionali = 'Il pubblico occasionale si gode i tre punti.';
  } else if (result === 'D') {
    fanBaseChange = important ? -1 : 0;
    boardChange = 0;
    fanReaction = important
      ? `Pareggio che lascia qualche rimpianto in una gara che pesava sulla classifica.`
      : `Pareggio digerito senza particolari scosse tra i tifosi.`;
    ownerNote = 'La proprietà resta neutrale dopo un pareggio.';
    if (important) groupReasons.tradizionali = 'Un pareggio che complica la corsa all\'obiettivo.';
  } else {
    fanBaseChange = isHeavyDefeat ? -6 : (important ? -4 : -3);
    boardChange = isHeavyDefeat ? -2 : 0;
    if (isHeavyDefeat) reasons.push('Sconfitta pesante o comunque netta in una gara rilevante.');
    else if (important) reasons.push('Sconfitta in una partita importante per classifica o calendario.');
    fanReaction = isHeavyDefeat
      ? `Sconfitta pesante con il ${context.opponentName}: la pazienza della piazza inizia a calare.`
      : `Qualche mugugno dopo la sconfitta con il ${context.opponentName}, ma senza drammi.`;
    ownerNote = isHeavyDefeat
      ? 'La proprietà inizia a osservare con maggiore attenzione, senza allarmismi dopo una sola gara.'
      : 'La proprietà resta prudente dopo un risultato negativo.';
    groupReasons.tradizionali = isHeavyDefeat ? 'La serie negativa inizia a preoccupare la piazza.' : 'Una sconfitta che non preoccupa, per ora.';
    if (isHeavyDefeat) {
      groupReasons.occasionali = 'Il pubblico occasionale si allontana dopo un ko pesante.';
      groupReasons.sponsor = 'Gli sponsor osservano con più cautela.';
    }
  }

  if (isDerby) {
    reasons.push('Partita sentita come derby o rivalità storica.');
    if (result === 'W') {
      groupExtra.curva = (groupExtra.curva ?? 0) + 6;
      fanReaction = `Vittoria nel derby con il ${context.opponentName}: la curva esplode di entusiasmo.`;
      groupReasons.curva = 'La curva celebra una vittoria che pesa più dei tre punti.';
      groupReasons.tradizionali = 'Il derby vinto rilancia l\'orgoglio della piazza.';
    } else if (result === 'L') {
      groupExtra.curva = (groupExtra.curva ?? 0) - 6;
      fanReaction = `Sconfitta nel derby con il ${context.opponentName}: la curva non la manda giù.`;
      groupReasons.curva = 'La curva non digerisce la sconfitta nella stracittadina.';
      groupReasons.tradizionali = 'Il ko nel derby pesa sulla fiducia della piazza.';
    } else {
      const favored = context.ownRating >= context.opponentRating;
      groupExtra.curva = (groupExtra.curva ?? 0) + (favored ? -2 : 2);
      fanReaction = favored
        ? `Pareggio nel derby con il ${context.opponentName}: la curva avrebbe voluto di più.`
        : `Pareggio nel derby con il ${context.opponentName}: la curva lo accoglie con onore.`;
      groupReasons.curva = favored ? 'La curva avrebbe voluto vincere il derby.' : 'Il pareggio nel derby viene accolto con onore.';
    }
  }

  if (context.decisiveYoungsterName) {
    groupExtra.locali = (groupExtra.locali ?? 0) + 5;
    groupExtra.curva = (groupExtra.curva ?? 0) + 1.5;
    groupReasons.locali = 'Il vivaio torna a far parlare di sé.';
  }

  const eventWorthy = important || isPositiveVsStronger || isHeavyDefeat || isDerby;

  return { fanBaseChange, groupExtra, groupReasons, boardChange, fanReaction, ownerNote, reasons, eventWorthy };
};

// Target minutes for the "youth involvement" objective across a season (~5 full matches worth).
const YOUTH_MINUTES_TARGET = 450;

const evaluateOwnershipObjectives = (
  objectives: OwnershipObjective[],
  context: CareerWorldMatchContext
): OwnershipObjective[] => {
  const now = new Date().toISOString();
  const totalTeams = context.standings.length || 20;
  const ownRank = getStandingRank(context.standings, context.teamName) ?? Math.round(totalTeams / 2);
  const objectiveLower = context.club.objective.toLowerCase();
  const targetRank = objectiveLower.includes('europa') || objectiveLower.includes('champions')
    ? 6
    : objectiveLower.includes('salvezza') || context.club.difficulty === 'Estrema' || context.club.difficulty === 'Difficile'
    ? totalTeams - 4
    : Math.ceil(totalTeams / 2);
  const rankMargin = targetRank - ownRank;

  const seasonProgressRatio = clamp(context.round / Math.max(1, context.totalRounds), 0, 1);
  const youthProgressRaw = clamp((context.youthMinutesTotal / YOUTH_MINUTES_TARGET) * 100, 0, 100);
  const expectedPace = seasonProgressRatio * 100;

  const budgetRatio = context.initialBudget > 0 ? clamp(context.currentBudget / context.initialBudget, 0, 2) : 1;

  return objectives.map(objective => {
    if (objective.category === 'sportivo') {
      const progress = Math.round(clamp(50 + rankMargin * 6, 0, 100));
      const status: OwnershipObjectiveStatus = context.seasonFinished
        ? (ownRank <= targetRank ? 'completato' : 'fallito')
        : rankMargin >= 3 ? 'positivo'
        : rankMargin >= -2 ? 'in_corso'
        : 'a_rischio';
      const reason =
        status === 'completato' ? `Obiettivo raggiunto: la squadra chiude ${ownRank}a.` :
        status === 'fallito' ? `L'obiettivo sportivo non e stato raggiunto: squadra ${ownRank}a a fine stagione.` :
        status === 'positivo' ? `La squadra e ${ownRank}a, sopra le attese societarie.` :
        status === 'a_rischio' ? `La squadra e ${ownRank}a: il margine per l'obiettivo si sta riducendo.` :
        `La squadra e ${ownRank}a, in linea con l'obiettivo stagionale.`;
      return { ...objective, progress, status, reason, updatedAt: now };
    }

    if (objective.category === 'identitario') {
      const progress = Math.round(youthProgressRaw);
      const status: OwnershipObjectiveStatus = context.seasonFinished
        ? (youthProgressRaw >= 100 ? 'completato' : 'fallito')
        : youthProgressRaw >= 100 ? 'completato'
        : youthProgressRaw >= expectedPace ? 'positivo'
        : youthProgressRaw >= expectedPace * 0.5 ? 'in_corso'
        : 'a_rischio';
      const reason =
        status === 'completato' ? 'Il progetto giovani ha raggiunto il minutaggio sperato.' :
        status === 'positivo' ? 'Il progetto giovani sta rispettando le aspettative iniziali.' :
        status === 'a_rischio' ? 'Il vivaio non sta ancora trovando lo spazio sperato.' :
        status === 'fallito' ? 'Il progetto giovani non ha trovato spazio in questa stagione.' :
        'Il progetto giovani e ancora agli inizi.';
      return { ...objective, progress, status, reason, updatedAt: now };
    }

    const progress = Math.round(clamp(budgetRatio * 100, 0, 100));
    const status: OwnershipObjectiveStatus = context.seasonFinished
      ? (budgetRatio >= 0.5 ? 'completato' : 'fallito')
      : budgetRatio >= 0.6 ? 'positivo'
      : budgetRatio >= 0.3 ? 'in_corso'
      : 'a_rischio';
    const reason =
      status === 'completato' ? 'Il budget e stato gestito con equilibrio per tutta la stagione.' :
      status === 'positivo' ? 'Le casse del club restano solide.' :
      status === 'a_rischio' ? 'Il budget si e assottigliato: serve prudenza sul mercato.' :
      status === 'fallito' ? 'La situazione economica ha preoccupato la proprieta per gran parte della stagione.' :
      'Il budget resta nella media, senza particolari tensioni.';
    return { ...objective, progress, status, reason, updatedAt: now };
  });
};

// ─── Player fan standings: idols, criticised players, and their evolution ───

export const PLAYER_FAN_STATUS_LABELS: Record<PlayerFanStatus, string> = {
  idolo_curva: 'Idolo della curva',
  molto_amato: 'Molto amato',
  apprezzato: 'Apprezzato',
  neutrale: 'Neutrale',
  sotto_osservazione: 'Sotto osservazione',
  criticato: 'Criticato',
  contestato: 'Contestato',
  simbolo_club: 'Simbolo del club',
};

// A real, already-existing signal (not invented): players the club history system
// has already recorded as launched youngsters carry the `player:<name>` tag.
export const isAcademyOrLocalPlayer = (history: ClubHistoryState | undefined, playerName: string): boolean => (
  history?.launchedYoungsters.some(entry => entry.tags?.includes(`player:${playerName}`)) ?? false
);

const determineFanStatus = (affection: number, criticism: number, isClubLegendCandidate: boolean): PlayerFanStatus => {
  if (criticism >= 70 && criticism > affection) return 'contestato';
  if (criticism >= 52 && criticism > affection * 0.8) return 'criticato';
  if (criticism >= 35 && affection < 45) return 'sotto_osservazione';
  if (isClubLegendCandidate && affection >= 82) return 'simbolo_club';
  if (affection >= 85) return 'idolo_curva';
  if (affection >= 66) return 'molto_amato';
  if (affection >= 48) return 'apprezzato';
  return 'neutrale';
};

const createDefaultFanStanding = (playerId: string): PlayerFanStanding => ({
  playerId,
  affection: 42,
  criticism: 12,
  status: 'neutrale',
  recentReasons: [],
  lastUpdatedAt: new Date().toISOString(),
  isAcademyOrLocal: false,
  isClubLegendCandidate: false,
  isFanFavorite: false,
  isUnderPressure: false,
});

const applyContributionToStanding = (
  standing: PlayerFanStanding,
  contribution: CareerWorldPlayerContribution
): PlayerFanStanding => {
  const isYoung = contribution.age <= 21;
  const isVeteran = contribution.age >= 32;
  const isDecisive = contribution.goals > 0 || contribution.assists > 0 || contribution.isNarrativeHero;
  const goodPerformance = contribution.isNarrativeHero || contribution.isNarrativeHeroicDefeat || contribution.rating >= 7 || isDecisive;
  const poorPerformance = !isDecisive && !contribution.isNarrativeHero && !contribution.isNarrativeHeroicDefeat && contribution.rating > 0 && contribution.rating <= 5.2;
  const wasCriticized = standing.criticism >= 45;

  let affectionDelta = 0;
  let criticismDelta = 0;
  let reason = '';

  if (contribution.isNarrativeHero && isYoung) {
    affectionDelta = 14; criticismDelta = -6;
    reason = 'Il vivaio torna a far parlare di sé con una prestazione da protagonista.';
  } else if (contribution.isNarrativeHero && isVeteran) {
    affectionDelta = 10; criticismDelta = -5;
    reason = `${contribution.playerName} dimostra ancora il proprio valore da veterano.`;
  } else if (contribution.isNarrativeHero) {
    affectionDelta = 11; criticismDelta = -5;
    reason = 'Prestazione da protagonista in una gara che conta.';
  } else if (contribution.isNarrativeHeroicDefeat) {
    affectionDelta = 6; criticismDelta = -3;
    reason = 'La prestazione viene apprezzata anche in una sconfitta di carattere.';
  } else if (goodPerformance) {
    affectionDelta = isYoung ? 8 : 5;
    criticismDelta = -3;
    reason = contribution.goals > 0 ? 'Decisivo con un gol pesante.' : contribution.assists > 0 ? 'Assist decisivo per la squadra.' : 'Prestazione solida e continua.';
  } else if (poorPerformance) {
    affectionDelta = -2;
    criticismDelta = 6;
    reason = 'Prestazione sottotono, ma senza drammi.';
  } else {
    return standing;
  }

  if (goodPerformance && wasCriticized) {
    affectionDelta += 6;
    criticismDelta -= 8;
    reason = 'Prova di riscatto dopo un periodo di critiche.';
  }

  const affection = Math.round(clamp(standing.affection + affectionDelta, 0, 100));
  const criticism = Math.round(clamp(standing.criticism + criticismDelta, 0, 100));
  const isClubLegendCandidate = contribution.legendScore >= 60 || standing.isClubLegendCandidate;
  const status = determineFanStatus(affection, criticism, isClubLegendCandidate);

  return {
    ...standing,
    affection,
    criticism,
    status,
    recentReasons: [reason, ...standing.recentReasons].slice(0, 3),
    lastUpdatedAt: new Date().toISOString(),
    isAcademyOrLocal: standing.isAcademyOrLocal || contribution.isAcademyOrLocal,
    isClubLegendCandidate,
    isFanFavorite: affection >= 66,
    isUnderPressure: criticism >= 52,
  };
};

const updatePlayerFanStandings = (
  fanState: FanState,
  contributors: CareerWorldPlayerContribution[]
): FanState => {
  if (contributors.length === 0) return fanState;

  const standingsById = new Map(fanState.playerStandings.map(s => [s.playerId, s]));
  contributors.slice(0, 5).forEach(contribution => {
    const existing = standingsById.get(contribution.playerId) ?? createDefaultFanStanding(contribution.playerId);
    const updated = applyContributionToStanding(existing, contribution);
    standingsById.set(contribution.playerId, updated);
  });

  const playerStandings = Array.from(standingsById.values());
  const mostLovedPlayerIds = [...playerStandings]
    .sort((a, b) => b.affection - a.affection)
    .filter(s => s.affection >= 60)
    .slice(0, 5)
    .map(s => s.playerId);
  const mostCriticizedPlayerIds = [...playerStandings]
    .sort((a, b) => b.criticism - a.criticism)
    .filter(s => s.criticism >= 40)
    .slice(0, 5)
    .map(s => s.playerId);

  return { ...fanState, playerStandings, mostLovedPlayerIds, mostCriticizedPlayerIds };
};

export const processCareerWorldAfterMatch = (
  state: CareerWorldState,
  context: CareerWorldMatchContext
): CareerWorldMatchResult => {
  if (state.lastProcessedMatchIds.includes(context.matchId)) {
    return { state, event: null, fanReaction: null };
  }

  const result: 'W' | 'D' | 'L' = context.scoreUser > context.scoreOpponent
    ? 'W'
    : context.scoreUser === context.scoreOpponent ? 'D' : 'L';
  const strengthGap = Math.round(context.opponentRating - context.ownRating);
  const matchImportance = computeMatchImportance(context);
  const plan = buildReactionPlan(context, result, matchImportance, strengthGap);

  const now = new Date().toISOString();

  const groups = state.fanState.groups.map(group => {
    const change = plan.fanBaseChange * GROUP_SENSITIVITY[group.key] + (plan.groupExtra[group.key] ?? 0);
    const groupReason = plan.groupReasons[group.key];
    const trend: FanGroupTrend = change > 1.5 ? 'positivo' : change < -1.5 ? 'negativo' : 'stabile';

    if (!change && !groupReason) return { ...group, updatedAt: now };

    return {
      ...group,
      mood: Math.round(clamp(group.mood + change, 0, 100)),
      lastReaction: groupReason ?? plan.fanReaction,
      recentReasons: groupReason ? [groupReason, ...group.recentReasons].slice(0, 3) : group.recentReasons,
      trend,
      updatedAt: now,
    };
  });

  const fanStateWithGroups: FanState = {
    ...state.fanState,
    overallMood: computeOverallMood(groups),
    groups,
    recentReactions: [plan.fanReaction, ...state.fanState.recentReactions].slice(0, 20),
    lastMoodChange: Math.round(plan.fanBaseChange),
  };
  const fanState = updatePlayerFanStandings(fanStateWithGroups, context.matchContributors);

  const nextObjectives = evaluateOwnershipObjectives(state.ownershipState.currentObjectives, context);
  const objectivesBoardDelta = nextObjectives.reduce((sum, objective) => {
    const previous = state.ownershipState.currentObjectives.find(item => item.id === objective.id);
    if (!previous || previous.status === objective.status) return sum;
    if (objective.status === 'completato') return sum + 6;
    if (objective.status === 'fallito') return sum - 4;
    if (objective.status === 'a_rischio') return sum - 1;
    return sum;
  }, 0);

  const ownershipState: OwnershipState = {
    ...state.ownershipState,
    boardConfidence: Math.round(clamp(state.ownershipState.boardConfidence + plan.boardChange + objectivesBoardDelta, 0, 100)),
    lastConfidenceChange: Math.round(plan.boardChange + objectivesBoardDelta),
    lastReactionNote: plan.ownerNote,
    currentObjectives: nextObjectives,
  };

  let event: CareerWorldEvent | null = null;
  let activeEvents = state.activeEvents;
  let historicalEvents = state.historicalEvents;

  if (plan.eventWorthy) {
    const complementary = context.hasMajorEmotionalStory;
    event = {
      id: `cwe_${context.matchId}`,
      date: new Date().toISOString(),
      season: context.season,
      type: 'match_result',
      title: `${context.teamName} ${context.scoreUser}-${context.scoreOpponent} ${context.opponentName}`,
      description: complementary
        ? `${plan.ownerNote}`
        : `${plan.fanReaction} ${plan.ownerNote}`,
      importance: Math.round(clamp(complementary ? matchImportance * 0.7 : matchImportance, 0, 100)),
      relatedMatchId: context.matchId,
      fanMoodChange: Math.round(plan.fanBaseChange),
      boardConfidenceChange: Math.round(plan.boardChange),
      reasons: plan.reasons,
      isRead: false,
      isHistorical: false,
    };

    activeEvents = [event, ...state.activeEvents].slice(0, 5);
    const overflow = [event, ...state.activeEvents].slice(5);
    if (overflow.length > 0) {
      historicalEvents = [
        ...overflow.map(item => ({ ...item, isHistorical: true, isRead: true })),
        ...state.historicalEvents,
      ].slice(0, 40);
    }
  }

  const nextState: CareerWorldState = {
    ...state,
    fanState,
    ownershipState,
    activeEvents,
    historicalEvents,
    lastProcessedMatchIds: [context.matchId, ...state.lastProcessedMatchIds].slice(0, 50),
    updatedAt: new Date().toISOString(),
  };

  return { state: nextState, event, fanReaction: plan.fanReaction };
};

// ─── Transfer reactions: fans, board and club memory after a completed deal ───

export interface CareerWorldTransferContext {
  transferId: string; // unique per completed deal, used for de-duplication
  season: string;
  direction: 'buy' | 'sell';
  playerId: string;
  playerName: string;
  playerAge: number;
  fee: number;
  counterpartClub: string; // buyer club on a sell, selling club on a buy
  isRivalCounterpart: boolean; // real rivalry heat >=48, same threshold used elsewhere for market rivalry deals
  isAcademyOrLocal: boolean;
  isPainfulSale: boolean; // only meaningful when direction === 'sell' (central role / squad leader)
  isBigSignature: boolean; // only meaningful when direction === 'buy'
  isDnaAligned: boolean; // only meaningful when direction === 'buy', from getDNAMarketAdjustment().fit >= 72
}

export interface CareerWorldTransferResult {
  state: CareerWorldState;
  memory: ClubMemoryDraft | null;
}

const formatFeeShort = (fee: number) => `${Math.round(fee / 1000000)} milioni`;

export const processCareerWorldAfterTransfer = (
  state: CareerWorldState,
  context: CareerWorldTransferContext
): CareerWorldTransferResult => {
  if (state.lastProcessedTransferIds.includes(context.transferId)) {
    return { state, memory: null };
  }

  const now = new Date().toISOString();
  const standing = state.fanState.playerStandings.find(s => s.playerId === context.playerId);
  const wasBelovedPlayer = context.isPainfulSale || (standing?.affection ?? 0) >= 66 || Boolean(standing?.isFanFavorite);
  const isYoungAcademySale = context.direction === 'sell' && context.isAcademyOrLocal && context.playerAge <= 23;
  const bigFee = context.fee >= 20000000;
  const financiallyFragile = state.ownershipState.financialStatus === 'critico' || state.ownershipState.financialStatus === 'in_tensione';

  const groupExtra: Partial<Record<FanGroupKey, number>> = {};
  const groupReasons: Partial<Record<FanGroupKey, string>> = {};
  let fanBaseChange = 0;
  let boardChange = 0;
  let ownerNote = '';
  let memory: ClubMemoryDraft | null = null;

  if (context.direction === 'sell') {
    boardChange = bigFee ? 5 : 2;
    fanBaseChange = 1;

    if (context.isRivalCounterpart) {
      fanBaseChange = -10;
      groupExtra.curva = -14;
      groupExtra.tradizionali = -8;
      groupReasons.curva = `La curva non perdona la cessione di ${context.playerName} a una rivale.`;
      groupReasons.tradizionali = 'Un rinforzo diretto per una rivale storica non va giù alla piazza.';
      ownerNote = bigFee
        ? `La proprietà ha incassato una grande cifra, ma la curva non perdona la cessione di ${context.playerName} a una rivale.`
        : `La cessione a una rivale pesa più del bilancio agli occhi della piazza.`;
      memory = {
        season: context.season,
        category: 'rivalry',
        title: `Sgarbo alla piazza: ${context.playerName} alla rivale`,
        description: `${context.playerName} passa al ${context.counterpartClub}, club rivale, per ${formatFeeShort(context.fee)}: la curva non dimentica, anche se le casse del club ne beneficiano.`,
        importance: 84,
        fanImpact: -8,
        dressingRoomImpact: -2,
        tags: ['reazione-tifosi', 'cessione-rivale', `player:${context.playerName}`],
        playerNames: [context.playerName],
        opponent: context.counterpartClub,
      };
    } else if (isYoungAcademySale) {
      fanBaseChange = -5;
      groupExtra.locali = -12;
      groupExtra.curva = -4;
      groupReasons.locali = `Il vivaio perde ${context.playerName}: un pezzo di identità che se ne va.`;
      ownerNote = bigFee
        ? `La proprietà ha incassato una grande cifra, ma la curva non perdona la vendita del giovane cresciuto nel vivaio.`
        : `La cessione del giovane cresciuto in casa lascia più di un dubbio tra i tifosi.`;
      memory = {
        season: context.season,
        category: 'youth',
        title: `Il vivaio perde ${context.playerName}`,
        description: `${context.playerName}, cresciuto in casa, lascia il club per ${formatFeeShort(context.fee)}: la proprietà incassa, ma i tifosi locali sentono la perdita.`,
        importance: 74,
        fanImpact: -5,
        dressingRoomImpact: -1,
        tags: ['reazione-tifosi', 'cessione-vivaio', `player:${context.playerName}`],
        playerNames: [context.playerName],
      };
    } else if (wasBelovedPlayer) {
      fanBaseChange = -6;
      groupExtra.curva = -8;
      groupExtra.tradizionali = -5;
      groupReasons.curva = `La cessione di ${context.playerName} lascia un vuoto tra i tifosi più vicini alla squadra.`;
      ownerNote = bigFee
        ? `La proprietà ha incassato una grande cifra, ma una parte della piazza non dimentica l'addio a ${context.playerName}.`
        : `L'addio a ${context.playerName} pesa più del previsto sulla piazza.`;
      memory = {
        season: context.season,
        category: 'transfer',
        title: `Addio a un idolo: ${context.playerName}`,
        description: `${context.playerName} lascia il club per ${formatFeeShort(context.fee)}: per una parte della tifoseria era un punto fermo, e la notizia pesa più del bilancio.`,
        importance: 78,
        fanImpact: -6,
        dressingRoomImpact: -2,
        tags: ['reazione-tifosi', 'cessione-idolo', `player:${context.playerName}`],
        playerNames: [context.playerName],
      };
    } else {
      ownerNote = bigFee ? 'La proprietà apprezza un incasso importante.' : 'La proprietà valuta positivamente l\'operazione in uscita.';
      groupReasons.sponsor = bigFee ? 'Un incasso importante rassicura sulla gestione economica.' : undefined;
    }
  } else {
    if (context.isBigSignature) {
      groupExtra.occasionali = 6;
      groupExtra.sponsor = 5;
      groupReasons.occasionali = `L'arrivo di ${context.playerName} accende l'entusiasmo del pubblico.`;
      if (!financiallyFragile) {
        groupExtra.tradizionali = 4;
        groupReasons.tradizionali = 'Un colpo che rilancia le ambizioni della stagione.';
        boardChange = 3;
        ownerNote = 'La proprietà sostiene con convinzione un acquisto importante.';
      } else {
        boardChange = -1;
        ownerNote = 'La proprietà resta cauta: un acquisto importante in una situazione economica fragile.';
      }
    } else {
      ownerNote = 'La proprietà valuta l\'acquisto come un rinforzo funzionale al progetto.';
    }

    if (context.isDnaAligned) {
      groupExtra.curva = (groupExtra.curva ?? 0) + 2;
      groupReasons.curva = groupReasons.curva ?? `L'acquisto di ${context.playerName} è coerente con l'identità del progetto.`;
    }
  }

  const groups = state.fanState.groups.map(group => {
    const change = fanBaseChange * GROUP_SENSITIVITY[group.key] * 0.4 + (groupExtra[group.key] ?? 0);
    const groupReason = groupReasons[group.key];
    if (!change && !groupReason) return group;
    const trend: FanGroupTrend = change > 1.5 ? 'positivo' : change < -1.5 ? 'negativo' : 'stabile';
    return {
      ...group,
      mood: Math.round(clamp(group.mood + change, 0, 100)),
      lastReaction: groupReason ?? group.lastReaction,
      recentReasons: groupReason ? [groupReason, ...group.recentReasons].slice(0, 3) : group.recentReasons,
      trend,
      updatedAt: now,
    };
  });

  const fanState: FanState = {
    ...state.fanState,
    overallMood: computeOverallMood(groups),
    groups,
  };

  const ownershipState: OwnershipState = {
    ...state.ownershipState,
    boardConfidence: Math.round(clamp(state.ownershipState.boardConfidence + boardChange, 0, 100)),
    lastConfidenceChange: Math.round(boardChange),
    lastReactionNote: ownerNote || state.ownershipState.lastReactionNote,
  };

  let activeEvents = state.activeEvents;
  let historicalEvents = state.historicalEvents;

  if (memory) {
    const event: CareerWorldEvent = {
      id: `cwe_transfer_${context.transferId}`,
      date: now,
      season: context.season,
      type: 'transfer_reaction',
      title: memory.title,
      description: memory.description,
      importance: memory.importance,
      relatedPlayerIds: [context.playerId],
      fanMoodChange: Math.round(fanBaseChange),
      boardConfidenceChange: Math.round(boardChange),
      reasons: [memory.description],
      isRead: false,
      isHistorical: false,
    };
    activeEvents = [event, ...state.activeEvents].slice(0, 5);
    const overflow = [event, ...state.activeEvents].slice(5);
    if (overflow.length > 0) {
      historicalEvents = [
        ...overflow.map(item => ({ ...item, isHistorical: true, isRead: true })),
        ...state.historicalEvents,
      ].slice(0, 40);
    }
  }

  const nextState: CareerWorldState = {
    ...state,
    fanState,
    ownershipState,
    activeEvents,
    historicalEvents,
    lastProcessedTransferIds: [context.transferId, ...state.lastProcessedTransferIds].slice(0, 50),
    updatedAt: now,
  };

  return { state: nextState, memory };
};
