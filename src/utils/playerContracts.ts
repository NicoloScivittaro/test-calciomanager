import {
  ClubHistoryState,
  ClubProfile,
  ClubWageBudgetState,
  ContractSquadRole,
  Player,
  PlayerContract,
  PlayerContractBonuses,
  PlayerSeasonStat
} from '../types';
import { getPlayerProjectRole } from './playerProjectRole';

// ─── Contratti giocatori, monte ingaggi e budget stipendi (Fase 8C) ───
// Stipendi di gameplay CalcioManager, non reali. Unita' canonica interna: EUR annui lordi.
// Il monte ingaggi impegnato non viene mai incrementato/decrementato manualmente: e' sempre
// ricalcolato dal roster reale, cosi' cessioni/acquisti non possono mai contarlo due volte.

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

export const WEEKS_PER_SEASON = 52;

export const toAnnualSalary = (weeklyWage: number) => Math.round(weeklyWage * WEEKS_PER_SEASON);
export const toWeeklyWage = (annualSalary: number) => Math.round(annualSalary / WEEKS_PER_SEASON);

const addSeasons = (season: string, years: number): string => {
  const [startRaw] = season.split('/');
  const start = (parseInt(startRaw, 10) || 2026) + Math.max(0, Math.round(years));
  const endSuffix = String((start + 1) % 100).padStart(2, '0');
  return `${start}/${endSuffix}`;
};

interface ContractContext {
  starters?: string[];
  bench?: string[];
  round?: number;
}

// ─── Ruolo contrattuale (distinto dalla classificazione narrativa di playerProjectRole) ───

export const inferContractSquadRole = (player: Player, context: ContractContext = {}): ContractSquadRole => {
  const isStarter = Boolean(context.starters?.includes(player.id));
  const isBench = Boolean(context.bench?.includes(player.id));
  const isYoungProspect = player.age <= 21 && player.potential - player.overall >= 6;

  if (isYoungProspect && !isStarter) return 'prospect';
  if (player.overall >= 83 || (isStarter && player.overall >= 79)) return 'star';
  if (isStarter || player.overall >= 76) return 'important';
  if (isBench || player.overall >= 68) return 'rotation';
  return 'backup';
};

export const CONTRACT_SQUAD_ROLE_LABELS: Record<ContractSquadRole, string> = {
  star: 'Stella della rosa',
  important: 'Titolare importante',
  rotation: 'Rotazione',
  prospect: 'Prospetto',
  backup: 'Riserva'
};

// ─── Bonus contrattuali: piccole frazioni deterministiche dello stipendio annuale ───

const buildContractBonuses = (
  player: Player,
  annualSalary: number,
  squadRole: ContractSquadRole,
  isNewSigning: boolean
): PlayerContractBonuses => {
  const isGkOrDefender = player.role === 'GK' || player.role === 'CB' || player.role === 'LB' || player.role === 'RB';
  const roleWeight = squadRole === 'star' ? 1.3 : squadRole === 'important' ? 1.1 : squadRole === 'rotation' ? 0.85 : 0.6;

  return {
    signingBonus: 0, // valorizzato solo al momento di una firma reale (applySignedContract)
    agentFee: 0, // idem
    appearanceBonus: Math.round((annualSalary / 40) * roleWeight * 0.06),
    goalBonus: Math.round((annualSalary / 40) * roleWeight * 0.18),
    cleanSheetBonus: isGkOrDefender ? Math.round((annualSalary / 40) * roleWeight * 0.12) : 0,
    annualLoyaltyBonus: Math.round(annualSalary * 0.02 * roleWeight),
    teamAchievementBonus: Math.round(annualSalary * 0.04 * roleWeight)
  };
};

const buildAnnualIncreasePercent = (player: Player): number => {
  if (player.age <= 23) return clamp(6 + seeded(player.id, 'increase-young', -2, 4), 2, 12);
  if (player.age <= 29) return clamp(3 + seeded(player.id, 'increase-prime', -2, 3), 0, 6);
  return clamp(seeded(player.id, 'increase-veteran', 0, 2), 0, 2);
};

const buildReleaseClause = (player: Player, annualSalary: number, club: ClubProfile): number | undefined => {
  const ambitious = player.personality.ambition >= 68 || player.personality.ego >= 68;
  const strongPlayer = player.overall >= 80;
  const smallerClub = club.transferBudget < 30000000;
  const wantsClause = strongPlayer && (ambitious || smallerClub) && hashRatio(`${player.id}-clause`) > 0.42;
  if (!wantsClause) return undefined;
  const base = Math.max(player.value, annualSalary * 6);
  return Math.round((base * (1.25 + seeded(player.id, 'clause-mult', 0, 25) / 100)) / 100000) * 100000;
};

// ─── Contratto iniziale deterministico: riusa wage/contractYears gia' esistenti, non li duplica ───

export const buildInitialPlayerContract = (
  player: Player,
  club: ClubProfile,
  season: string
): PlayerContract => {
  const annualSalary = toAnnualSalary(player.wage);
  const squadRole = inferContractSquadRole(player);
  const durationYears = Math.max(1, player.contractYears);
  const isNewSigning = false;

  return {
    annualSalary,
    startSeason: season,
    endSeason: addSeasons(season, durationYears),
    durationYears,
    squadRole,
    bonuses: buildContractBonuses(player, annualSalary, squadRole, isNewSigning),
    annualSalaryIncreasePercent: buildAnnualIncreasePercent(player),
    releaseClause: buildReleaseClause(player, annualSalary, club),
    status: player.contractYears <= 1 ? 'expiring' : 'active',
    earnedBonusesThisSeason: 0,
    projectedBonusReserve: Math.round(annualSalary * 0.05),
    processedBonusMatchIds: []
  };
};

export const ensurePlayerContract = (player: Player, club: ClubProfile, season: string): Player => (
  player.contract ? player : { ...player, contract: buildInitialPlayerContract(player, club, season) }
);

export const ensureSquadContracts = (players: Player[], club: ClubProfile, season: string): Player[] => (
  players.map(player => ensurePlayerContract(player, club, season))
);

// ─── Budget stipendi: sempre ricalcolato dal roster reale, mai incrementato/decrementato a mano ───

export const calculateClubWageBudget = (
  players: Player[],
  club: ClubProfile,
  season: string,
  previous?: ClubWageBudgetState
): ClubWageBudgetState => {
  const ensured = ensureSquadContracts(players, club, season);
  const committedAnnualWages = ensured.reduce((sum, player) => sum + (player.contract?.annualSalary ?? 0), 0);
  const projectedBonusReserve = ensured.reduce((sum, player) => sum + (player.contract?.projectedBonusReserve ?? 0), 0);
  const annualWageBudget = previous?.annualWageBudget ?? Math.round(clamp(committedAnnualWages * 1.35, club.transferBudget * 0.55, club.transferBudget * 2.2));

  return {
    season,
    annualWageBudget,
    committedAnnualWages,
    projectedBonusReserve,
    availableAnnualWages: Math.round(annualWageBudget - committedAnnualWages - projectedBonusReserve),
    transferOneOffCostsThisSeason: previous?.transferOneOffCostsThisSeason ?? 0,
    lastBudgetReviewSeason: previous?.lastBudgetReviewSeason,
    lastProcessedContractEventIds: previous?.lastProcessedContractEventIds ?? []
  };
};

export const createInitialClubWageBudgetState = (players: Player[], club: ClubProfile, season: string): ClubWageBudgetState => (
  calculateClubWageBudget(players, club, season)
);

export const normalizeClubWageBudgetState = (
  value: unknown,
  players: Player[],
  club: ClubProfile,
  season: string
): ClubWageBudgetState => {
  const raw = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  const previous: ClubWageBudgetState = {
    season,
    annualWageBudget: typeof raw.annualWageBudget === 'number' ? raw.annualWageBudget : 0,
    committedAnnualWages: 0,
    projectedBonusReserve: 0,
    availableAnnualWages: 0,
    transferOneOffCostsThisSeason: typeof raw.transferOneOffCostsThisSeason === 'number' ? Math.max(0, raw.transferOneOffCostsThisSeason) : 0,
    lastBudgetReviewSeason: typeof raw.lastBudgetReviewSeason === 'string' ? raw.lastBudgetReviewSeason : undefined,
    lastProcessedContractEventIds: Array.isArray(raw.lastProcessedContractEventIds)
      ? raw.lastProcessedContractEventIds.filter((id): id is string => typeof id === 'string').slice(0, 30)
      : []
  };
  if (!previous.annualWageBudget) return calculateClubWageBudget(players, club, season);
  return calculateClubWageBudget(players, club, season, previous);
};

export const getWageBudgetStatusLabel = (state: ClubWageBudgetState): 'Sano' | 'Sotto pressione' | 'Al limite' | 'Fuori budget' => {
  if (state.availableAnnualWages < 0) return 'Fuori budget';
  const ratio = state.availableAnnualWages / Math.max(1, state.annualWageBudget);
  if (ratio < 0.06) return 'Al limite';
  if (ratio < 0.18) return 'Sotto pressione';
  return 'Sano';
};

// ─── Richiesta contrattuale: segnali reali, seed deterministico, mai casualita' libera ───

export interface ContractDemandContext {
  starters?: string[];
  bench?: string[];
  seasonStats?: PlayerSeasonStat[];
  clubHistory?: ClubHistoryState;
  round?: number;
  rivalInterest?: boolean;
}

export interface ContractDemand {
  demandedAnnualSalary: number;
  demandedYears: number;
  releaseClauseRequested: boolean;
  reasons: string[];
}

export const getPlayerContractDemand = (player: Player, club: ClubProfile, context: ContractDemandContext = {}): ContractDemand => {
  const currentAnnual = toAnnualSalary(player.wage);
  const projectRole = getPlayerProjectRole(player, {
    starters: context.starters,
    bench: context.bench,
    seasonStats: context.seasonStats,
    clubHistory: context.clubHistory,
    round: context.round
  });
  const squadRole = inferContractSquadRole(player, context);
  const isExpiring = player.contractYears <= 1;
  const reasons: string[] = [];

  let multiplier = 1;
  if (player.overall >= 84) { multiplier += 0.22; reasons.push('overall di alto livello'); }
  else if (player.overall >= 78) { multiplier += 0.1; }
  if (player.potential - player.overall >= 8 && player.age <= 23) { multiplier += 0.08; reasons.push('margine di crescita importante'); }
  if (squadRole === 'star') { multiplier += 0.14; reasons.push('ruolo di stella nel progetto'); }
  else if (squadRole === 'important') { multiplier += 0.06; }
  if (projectRole.trust >= 70) { multiplier += 0.05; reasons.push('si sente parte del progetto'); }
  if (player.personality.ambition >= 72) { multiplier += 0.06; reasons.push('ambizione personale alta'); }
  if (player.morale < 45) { multiplier -= 0.05; reasons.push('morale basso'); }
  if (isExpiring) { multiplier += 0.1; reasons.push('contratto in scadenza'); }
  if (context.rivalInterest) { multiplier += 0.12; reasons.push('interesse concreto di un club rivale'); }
  if (player.age >= 32) { multiplier -= 0.08; reasons.push('eta avanzata'); }

  const noise = (hashRatio(`${player.id}-demand-${club.id}`) - 0.5) * 0.06;
  const demandedAnnualSalary = Math.round(clamp(currentAnnual * (multiplier + noise), currentAnnual * 0.85, currentAnnual * 1.7) / 1000) * 1000;

  const demandedYears = player.age <= 23 ? 5 : player.age <= 29 ? clamp(player.contractYears + 2, 3, 5) : player.age <= 33 ? 2 : 1;
  const releaseClauseRequested = squadRole === 'star' && (player.personality.ambition >= 68 || club.transferBudget < 30000000);

  return { demandedAnnualSalary, demandedYears, releaseClauseRequested, reasons: reasons.slice(0, 4) };
};

// ─── Valutazione offerta di rinnovo/firma ───

export type ContractOfferDecision =
  | 'accepted'
  | 'rejected'
  | 'counter'
  | 'blocked_budget'
  | 'blocked_role'
  | 'blocked_duration'
  | 'hierarchy_warning';

export interface ContractOfferInput {
  annualSalary: number;
  years: number;
  squadRole: ContractSquadRole;
  releaseClause?: number;
}

export interface ContractOfferEvaluation {
  decision: ContractOfferDecision;
  message: string;
  counterOffer?: ContractDemand;
}

export const evaluateContractOffer = (
  player: Player,
  club: ClubProfile,
  offer: ContractOfferInput,
  wageBudget: ClubWageBudgetState,
  context: ContractDemandContext = {},
  highestSquadAnnualSalary = 0
): ContractOfferEvaluation => {
  if (offer.years < 1) {
    return { decision: 'blocked_duration', message: 'Durata contratto troppo corta per essere presa in considerazione.' };
  }

  const currentAnnual = toAnnualSalary(player.wage);
  const projectedAvailable = wageBudget.availableAnnualWages + currentAnnual; // il vecchio stipendio esce dal monte quando il nuovo entra
  if (offer.annualSalary > projectedAvailable) {
    return { decision: 'blocked_budget', message: `Il budget stipendi non regge questo ingaggio: mancano ${Math.round((offer.annualSalary - projectedAvailable) / 1000)}k€/anno.` };
  }

  const demand = getPlayerContractDemand(player, club, context);
  const squadRole = inferContractSquadRole(player, context);
  if (offer.squadRole === 'backup' && squadRole === 'star') {
    return { decision: 'blocked_role', message: 'Il ruolo proposto e incompatibile con lo status del giocatore in rosa.' };
  }

  const hierarchyBroken = highestSquadAnnualSalary > 0 && offer.annualSalary > highestSquadAnnualSalary * 1.05 && squadRole !== 'star';
  const ratio = offer.annualSalary / Math.max(1, demand.demandedAnnualSalary);
  const acceptChance = clamp(0.35 + (ratio - 1) * 1.4 + (offer.years >= demand.demandedYears ? 0.1 : -0.15), 0.05, 0.95);
  const roll = hashRatio(`${player.id}-offer-${offer.annualSalary}-${offer.years}`);

  if (ratio >= 1.08 || roll < acceptChance) {
    return {
      decision: 'accepted',
      message: hierarchyBroken
        ? 'Offerta accettata, ma rompe la gerarchia salariale della rosa.'
        : 'Offerta accettata.'
    };
  }

  if (ratio < 0.75) {
    return { decision: 'rejected', message: `${player.name} rifiuta: la proposta e troppo lontana dalle sue aspettative.` };
  }

  return { decision: 'counter', message: `${player.name} chiede una controproposta.`, counterOffer: demand };
};

// ─── Impatto finanziario e applicazione contratto ───

export interface ContractFinancialImpact {
  oneOffCost: number;
  annualCost: number;
  transferBudgetOk: boolean;
  wageBudgetOk: boolean;
}

export const calculateContractFinancialImpact = (
  offer: { annualSalary: number; signingBonus: number; agentFee: number },
  transferBudget: number,
  wageBudget: ClubWageBudgetState,
  previousAnnualSalary = 0
): ContractFinancialImpact => {
  const oneOffCost = offer.signingBonus + offer.agentFee;
  const projectedAvailable = wageBudget.availableAnnualWages + previousAnnualSalary;
  return {
    oneOffCost,
    annualCost: offer.annualSalary,
    transferBudgetOk: oneOffCost <= transferBudget,
    wageBudgetOk: offer.annualSalary <= projectedAvailable
  };
};

export interface ApplySignedContractInput {
  annualSalary: number;
  years: number;
  squadRole: ContractSquadRole;
  signingBonus?: number;
  agentFee?: number;
  releaseClause?: number;
}

// Applica un contratto firmato/rinnovato: sincronizza sempre wage/contractYears esistenti, non li duplica.
export const applySignedContract = (
  player: Player,
  club: ClubProfile,
  input: ApplySignedContractInput,
  season: string,
  isRenewal: boolean
): Player => {
  const bonuses = buildContractBonuses(player, input.annualSalary, input.squadRole, !isRenewal);
  const contract: PlayerContract = {
    annualSalary: input.annualSalary,
    startSeason: season,
    endSeason: addSeasons(season, input.years),
    durationYears: input.years,
    squadRole: input.squadRole,
    bonuses: {
      ...bonuses,
      signingBonus: input.signingBonus ?? 0,
      agentFee: input.agentFee ?? 0
    },
    annualSalaryIncreasePercent: buildAnnualIncreasePercent(player),
    releaseClause: input.releaseClause,
    status: 'active',
    lastRenewalSeason: isRenewal ? season : undefined,
    earnedBonusesThisSeason: 0,
    projectedBonusReserve: Math.round(input.annualSalary * 0.05),
    processedBonusMatchIds: []
  };

  return {
    ...player,
    wage: toWeeklyWage(input.annualSalary),
    contractYears: input.years,
    contract
  };
};

// ─── Bonus da eventi reali di partita: idempotente per matchId ───

export interface ContractBonusMatchContext {
  matchId: string;
  round: number;
  season: string;
  playedIds: string[];
  startedIds: string[];
  userMatchMinutes: Record<string, number>;
  goalsByPlayerId: Record<string, number>;
  cleanSheet: boolean;
}

export const processContractBonusesAfterMatch = (
  players: Player[],
  club: ClubProfile,
  context: ContractBonusMatchContext
): { players: Player[]; totalBonusAwarded: number } => {
  let totalBonusAwarded = 0;

  const updatedPlayers = players.map(rawPlayer => {
    const player = ensurePlayerContract(rawPlayer, club, context.season);
    const contract = player.contract!;
    if (contract.processedBonusMatchIds.includes(context.matchId)) return player;
    if (!context.playedIds.includes(player.id)) return player;

    const minutes = context.userMatchMinutes[player.id] ?? 0;
    const goals = context.goalsByPlayerId[player.id] ?? 0;
    const isDefensiveRole = player.role === 'GK' || player.role === 'CB' || player.role === 'LB' || player.role === 'RB';

    let earned = contract.bonuses.appearanceBonus;
    earned += goals * contract.bonuses.goalBonus;
    if (context.cleanSheet && isDefensiveRole && minutes >= 60) earned += contract.bonuses.cleanSheetBonus;

    totalBonusAwarded += earned;

    return {
      ...player,
      contract: {
        ...contract,
        earnedBonusesThisSeason: Math.round(contract.earnedBonusesThisSeason + earned),
        processedBonusMatchIds: [context.matchId, ...contract.processedBonusMatchIds].slice(0, 40)
      }
    };
  });

  return { players: updatedPlayers, totalBonusAwarded };
};

// ─── Cambio stagione: aumenti, fedelta, scadenze. Idempotente per stagione (lastProcessedContractEventIds) ───

export const processContractSeasonTransition = (
  players: Player[],
  club: ClubProfile,
  season: string,
  wageBudget: ClubWageBudgetState,
  achievedTeamGoal: boolean
): { players: Player[]; wageBudget: ClubWageBudgetState } => {
  const eventId = `season-transition-${season}`;
  if (wageBudget.lastProcessedContractEventIds.includes(eventId)) {
    return { players, wageBudget: calculateClubWageBudget(players, club, season, wageBudget) };
  }

  const updatedPlayers = players.map(rawPlayer => {
    const player = ensurePlayerContract(rawPlayer, club, season);
    const contract = player.contract!;
    const nextDurationYears = Math.max(0, contract.durationYears - 1);
    const isNowExpiring = nextDurationYears <= 1 && nextDurationYears > 0;
    const isExpired = nextDurationYears <= 0;

    const increasedSalary = Math.round(contract.annualSalary * (1 + contract.annualSalaryIncreasePercent / 100));
    const loyaltyBonus = contract.status !== 'expired' ? contract.bonuses.annualLoyaltyBonus : 0;
    const achievementBonus = achievedTeamGoal ? contract.bonuses.teamAchievementBonus : 0;

    const nextContract: PlayerContract = {
      ...contract,
      annualSalary: isExpired ? contract.annualSalary : increasedSalary,
      durationYears: nextDurationYears,
      endSeason: addSeasons(season, nextDurationYears),
      status: isExpired ? 'expired' : isNowExpiring ? 'expiring' : 'active',
      earnedBonusesThisSeason: 0,
      projectedBonusReserve: Math.round((isExpired ? contract.annualSalary : increasedSalary) * 0.05)
    };

    return {
      ...player,
      wage: isExpired ? player.wage : toWeeklyWage(nextContract.annualSalary),
      contractYears: nextDurationYears,
      status: isExpired ? ('Cedibile' as const) : player.status,
      contract: nextContract
    };
  });

  const nextWageBudget: ClubWageBudgetState = {
    ...calculateClubWageBudget(updatedPlayers, club, season),
    lastBudgetReviewSeason: season,
    transferOneOffCostsThisSeason: 0,
    lastProcessedContractEventIds: [eventId, ...wageBudget.lastProcessedContractEventIds].slice(0, 30)
  };

  return { players: updatedPlayers, wageBudget: nextWageBudget };
};

// ─── Etichette leggibili per la UI ───

export const getContractStatusLabel = (contract: PlayerContract): 'Tranquillo' | 'Da monitorare' | 'In scadenza' | 'Negoziazione delicata' => {
  if (contract.status === 'negotiating') return 'Negoziazione delicata';
  if (contract.status === 'expiring' || contract.status === 'expired') return 'In scadenza';
  if (contract.durationYears <= 2) return 'Da monitorare';
  return 'Tranquillo';
};
