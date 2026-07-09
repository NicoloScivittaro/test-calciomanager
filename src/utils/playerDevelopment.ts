import {
  Player,
  PlayerDevelopmentProfile,
  PlayerDevelopmentStage,
  PlayerDevelopmentTrend,
  PlayerRole,
  PlayerRoleFamiliarity,
  PlayerRoleFamiliarityStatus,
  PlayerTrainingPlan,
  PlayerTrainingPlanStatus,
  TrainingFocus,
  TrainingIntensity
} from '../types';

// ─── Allenamento, sviluppo, declino e potenziale dinamico ───
// Tutti i valori sono dati di gameplay CalcioManager (bilanciamento), non informazioni reali
// su giocatori reali. Il sistema non e' "realistico al 100%": e' credibile, spiegabile e calibrato.

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

const ROLE_ORDER: PlayerRole[] = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'];

const ROLE_FAMILY: Record<PlayerRole, 'GK' | 'DF' | 'MF' | 'FW'> = {
  GK: 'GK', CB: 'DF', LB: 'DF', RB: 'DF', DM: 'MF', CM: 'MF', AM: 'MF', LW: 'FW', RW: 'FW', ST: 'FW'
};

// 0 = stesso ruolo, 1 = stessa famiglia, 2 = famiglie adiacenti, 3 = famiglie lontane (es. GK<->qualsiasi).
const roleDistance = (a: PlayerRole, b: PlayerRole): number => {
  if (a === b) return 0;
  const familyA = ROLE_FAMILY[a];
  const familyB = ROLE_FAMILY[b];
  if (familyA === familyB) return 1;
  if (familyA === 'GK' || familyB === 'GK') return 3;
  if ((familyA === 'DF' && familyB === 'FW') || (familyA === 'FW' && familyB === 'DF')) return 3;
  return 2;
};

const familiarityToStatus = (familiarity: number): PlayerRoleFamiliarityStatus => (
  familiarity >= 85 ? 'natural' :
  familiarity >= 65 ? 'competent' :
  familiarity >= 40 ? 'usable' :
  familiarity >= 15 ? 'learning' :
  'unknown'
);

const developmentStageForAge = (age: number): PlayerDevelopmentStage => (
  age <= 19 ? 'academy' :
  age <= 22 ? 'prospect' :
  age <= 26 ? 'developing' :
  age <= 30 ? 'prime' :
  age <= 33 ? 'veteran' :
  'declining'
);

export const TRAINING_FOCUS_LABELS: Record<TrainingFocus, string> = {
  balanced: 'Bilanciato',
  technical: 'Tecnico',
  physical: 'Fisico',
  defensive: 'Difensivo',
  attacking: 'Offensivo',
  mental: 'Mentale',
  role_learning: 'Apprendimento ruolo',
  recovery: 'Recupero'
};

export const TRAINING_INTENSITY_LABELS: Record<TrainingIntensity, string> = {
  light: 'Leggera',
  normal: 'Normale',
  high: 'Alta'
};

export const TRAINING_PLAN_STATUS_LABELS: Record<PlayerTrainingPlanStatus, string> = {
  active: 'In corso',
  paused: 'In pausa',
  completed: 'Completato',
  limited_by_fitness: 'Limitato dal carico fisico',
  limited_by_injury: 'Limitato dall\'infortunio'
};

export const ROLE_FAMILIARITY_STATUS_LABELS: Record<PlayerRoleFamiliarityStatus, string> = {
  unknown: 'Fuori ruolo',
  learning: 'In apprendimento',
  usable: 'Utilizzabile',
  competent: 'Competente',
  natural: 'Naturale'
};

export const DEVELOPMENT_STAGE_LABELS: Record<PlayerDevelopmentStage, string> = {
  academy: 'Settore giovanile',
  prospect: 'Prospetto',
  developing: 'In sviluppo',
  prime: 'Nel pieno della carriera',
  veteran: 'Veterano',
  declining: 'Fine carriera'
};

export const DEVELOPMENT_TREND_LABELS: Record<PlayerDevelopmentTrend, string> = {
  crescita: 'In crescita',
  stabile: 'Stabile',
  calo: 'In calo',
  recupero: 'Recupero'
};

// ─── Profilo di sviluppo persistente ───

export const buildPlayerDevelopmentProfile = (
  seed: Pick<Player, 'id' | 'name' | 'role' | 'age' | 'potential'>,
  clubName: string,
  index = 0
): PlayerDevelopmentProfile => {
  const base = `${clubName}-${seed.name}-${seed.role}-${seed.age}-${index}-development`;
  const ageGrowthCurve =
    seed.age <= 20 ? 18 :
    seed.age <= 23 ? 10 :
    seed.age <= 27 ? 2 :
    seed.age <= 30 ? -4 :
    seed.age <= 33 ? -10 :
    -16;

  const growthRate = clamp(seeded(base, 'growth', 35, 80) + ageGrowthCurve, 5, 95);
  const declineRate = clamp(seeded(base, 'decline', 20, 60) + Math.max(0, seed.age - 29) * 3, 5, 95);
  const consistency = clamp(seeded(base, 'consistency', 35, 85), 10, 96);
  const adaptability = clamp(seeded(base, 'adaptability', 30, 82) - Math.max(0, seed.age - 28) * 1.2, 8, 95);
  const learningSpeed = clamp(seeded(base, 'learning', 30, 82) + (seed.age <= 23 ? 8 : 0) - Math.max(0, seed.age - 30) * 1.5, 8, 95);
  const ambitionImpact = clamp(seeded(base, 'ambitionImpact', -10, 18), -20, 25);
  const professionalismImpact = clamp(seeded(base, 'professionalismImpact', -8, 20), -20, 28);
  const lateBloomerChance = clamp(seeded(base, 'lateBloomer', 2, 16) + (seed.age <= 22 ? 4 : 0), 0, 25);
  const overPotentialCapacity = clamp(seeded(base, 'overCap', 2, 6), 1, 8);
  const basePotential = seed.potential;

  return {
    basePotential,
    projectedPotential: basePotential,
    realizedCeiling: basePotential,
    growthRate,
    declineRate,
    consistency,
    adaptability,
    learningSpeed,
    ambitionImpact,
    professionalismImpact,
    lateBloomerChance,
    overPotentialCapacity,
    developmentStage: developmentStageForAge(seed.age),
    trend: 'stabile',
    seasonGrowth: 0,
    seasonDecline: 0,
    growthSinceReview: 0,
    declineSinceReview: 0,
    reviewHistory: []
  };
};

// ─── Piano di allenamento individuale ───

export const createDefaultTrainingPlan = (playerId: string, round: number): PlayerTrainingPlan => ({
  playerId,
  focus: 'balanced',
  intensity: 'normal',
  startedAtRound: round,
  lastUpdatedRound: round,
  progress: 0,
  developmentProgress: 0,
  accumulatedTrainingLoad: 0,
  status: 'active',
  focusChangesThisSeason: 0,
  notes: []
});

// ─── Familiarita di ruolo ───

export const buildInitialRoleFamiliarity = (
  player: Pick<Player, 'role' | 'secondaryRoles' | 'positionTraining'>
): PlayerRoleFamiliarity[] => (
  ROLE_ORDER.map(roleId => {
    if (roleId === player.role) {
      return { roleId, familiarity: 92, trainingProgress: 100, matchMinutesInRole: 0, status: 'natural' as const };
    }
    if (player.secondaryRoles?.includes(roleId)) {
      return { roleId, familiarity: 70, trainingProgress: 100, matchMinutesInRole: 0, status: 'competent' as const };
    }
    const legacyProgress = player.positionTraining?.[roleId];
    if (legacyProgress !== undefined && legacyProgress > 0) {
      const familiarity = clamp(Math.round(legacyProgress * 0.5), 5, 60);
      return { roleId, familiarity, trainingProgress: legacyProgress, matchMinutesInRole: 0, status: familiarityToStatus(familiarity) };
    }
    const distance = roleDistance(player.role, roleId);
    const familiarity = distance === 1 ? 25 : distance === 2 ? 8 : 2;
    return { roleId, familiarity, trainingProgress: 0, matchMinutesInRole: 0, status: familiarityToStatus(familiarity) };
  })
);

export const getRoleFamiliarityEntry = (player: Player, roleId: PlayerRole): PlayerRoleFamiliarity => {
  const entry = player.roleFamiliarity?.find(item => item.roleId === roleId);
  if (entry) return entry;
  if (roleId === player.role) return { roleId, familiarity: 92, trainingProgress: 100, matchMinutesInRole: 0, status: 'natural' };
  const distance = roleDistance(player.role, roleId);
  const familiarity = distance === 1 ? 25 : distance === 2 ? 8 : 2;
  return { roleId, familiarity, trainingProgress: 0, matchMinutesInRole: 0, status: familiarityToStatus(familiarity) };
};

// ─── Normalizzazione sicura (vecchi salvataggi e nuovi giocatori) ───

export const ensurePlayerDevelopmentState = (player: Player, clubName = 'Club', index = 0, round = 1): Player => {
  // Vecchi salvataggi possono avere un trainingPlan gia' esistente ma privo del nuovo campo
  // "developmentProgress" (sviluppo reale, separato dall'adesione): va comunque completato.
  if (player.developmentProfile && player.trainingPlan && typeof player.trainingPlan.developmentProgress === 'number' && player.roleFamiliarity) {
    return player;
  }
  return {
    ...player,
    developmentProfile: player.developmentProfile ?? buildPlayerDevelopmentProfile(player, clubName, index),
    trainingPlan: player.trainingPlan
      ? { ...player.trainingPlan, developmentProgress: player.trainingPlan.developmentProgress ?? 0 }
      : createDefaultTrainingPlan(player.id, round),
    roleFamiliarity: player.roleFamiliarity ?? buildInitialRoleFamiliarity(player)
  };
};

// ─── Impostazione del piano (il "bottone allenamento": imposta solo un piano, nessun effetto immediato) ───

export interface TrainingPlanUpdate {
  focus: TrainingFocus;
  intensity: TrainingIntensity;
  targetRole?: PlayerRole;
}

export const setPlayerTrainingFocus = (player: Player, update: TrainingPlanUpdate, round: number): Player => {
  const withState = ensurePlayerDevelopmentState(player, 'Club', 0, round);
  const plan = withState.trainingPlan!;
  const injuryStatus = withState.injuryStatus?.status ?? 'fit';

  let nextFocus = update.focus;
  let nextIntensity = update.intensity;
  let nextTargetRole = update.targetRole;

  // Vincoli fisici: niente piani intensi durante un infortunio o un rientro controllato.
  if (injuryStatus === 'injured' || injuryStatus === 'rehab') {
    nextFocus = 'recovery';
    nextIntensity = 'light';
    nextTargetRole = undefined;
  } else if (injuryStatus === 'managed_return') {
    nextFocus = nextFocus === 'role_learning' ? 'role_learning' : 'recovery';
    nextIntensity = 'light';
  }
  if (nextFocus === 'role_learning' && !nextTargetRole) {
    nextFocus = 'balanced';
  }
  if (nextFocus !== 'role_learning') {
    nextTargetRole = undefined;
  }

  const focusChanged = plan.focus !== nextFocus || plan.targetRole !== nextTargetRole;
  // La primissima configurazione di un piano appena creato non e' un "cambio": nessuna penalita'.
  const isInitialConfiguration = plan.lastUpdatedRound === plan.startedAtRound && plan.focusChangesThisSeason === 0
    && plan.progress === 0 && plan.developmentProgress === 0;
  const focusChangesThisSeason = focusChanged ? plan.focusChangesThisSeason + 1 : plan.focusChangesThisSeason;
  // L'adesione (non lo sviluppo reale, che non viene mai toccato qui) si riduce quando si cambia idea spesso.
  const progress = focusChanged ? Math.round(plan.progress * 0.5) : plan.progress;
  const focusChangedAtRound = focusChanged && !isInitialConfiguration ? round : plan.focusChangedAtRound;
  const targetLabel = nextTargetRole ? ` (${nextTargetRole})` : '';
  const note = focusChanged ? `Piano aggiornato: ${TRAINING_FOCUS_LABELS[nextFocus]}${targetLabel}.` : undefined;

  const nextPlan: PlayerTrainingPlan = {
    ...plan,
    focus: nextFocus,
    intensity: nextIntensity,
    targetRole: nextTargetRole,
    lastUpdatedRound: round,
    progress,
    // Lo sviluppo reale gia' accumulato non viene mai azzerato da un cambio di piano.
    developmentProgress: plan.developmentProgress,
    status: injuryStatus === 'injured' || injuryStatus === 'rehab' ? 'limited_by_injury' : 'active',
    focusChangesThisSeason,
    focusChangedAtRound,
    notes: note ? [note, ...plan.notes].slice(0, 5) : plan.notes
  };

  return { ...withState, trainingPlan: nextPlan };
};

// ─── Riepiloghi leggibili per la UI ───

export interface PlayerDevelopmentSummary {
  stageLabel: string;
  trendLabel: string;
  potentialLevel: 'Contenuto' | 'Buono' | 'Alto' | 'Eccezionale';
  potentialRangeLabel: string;
  explanation: string;
  seasonGrowth: number;
  seasonDecline: number;
}

export const getDevelopmentSummary = (player: Player): PlayerDevelopmentSummary => {
  const profile = player.developmentProfile ?? buildPlayerDevelopmentProfile(player, 'Club', 0);
  const potentialLevel: PlayerDevelopmentSummary['potentialLevel'] =
    profile.projectedPotential >= 86 ? 'Eccezionale' :
    profile.projectedPotential >= 79 ? 'Alto' :
    profile.projectedPotential >= 71 ? 'Buono' :
    'Contenuto';
  const rangeLow = Math.max(player.overall, Math.round(profile.projectedPotential - 3));
  const rangeHigh = Math.round(profile.projectedPotential + 2);
  const isUnavailable = player.injuryStatus && player.injuryStatus.status !== 'fit' && player.injuryStatus.status !== 'managed_return';

  const explanation =
    isUnavailable ? 'Lo sviluppo e\' fermo per motivi fisici.' :
    profile.trend === 'crescita' ? 'Sta crescendo grazie a minuti e continuita\'.' :
    profile.trend === 'calo' ? (player.age >= 31 ? 'Il fisico inizia a cedere con l\'eta\'.' : 'Il poco utilizzo o il carico fisico rallentano lo sviluppo.') :
    profile.trend === 'recupero' ? 'Segnali di recupero dopo un momento difficile.' :
    'Lo sviluppo procede in modo regolare, senza scatti evidenti.';

  return {
    stageLabel: DEVELOPMENT_STAGE_LABELS[profile.developmentStage],
    trendLabel: DEVELOPMENT_TREND_LABELS[profile.trend],
    potentialLevel,
    potentialRangeLabel: `${Math.round(rangeLow)}-${Math.round(rangeHigh)}`,
    explanation,
    seasonGrowth: Number(profile.seasonGrowth.toFixed(1)),
    seasonDecline: Number(profile.seasonDecline.toFixed(1))
  };
};

const getFocusRelevance = (focus: TrainingFocus, role: PlayerRole): number => {
  const isAttacker = role === 'ST' || role === 'LW' || role === 'RW' || role === 'AM';
  const isDefender = role === 'CB' || role === 'LB' || role === 'RB' || role === 'GK';
  const isMid = role === 'DM' || role === 'CM';
  switch (focus) {
    case 'attacking': return isAttacker ? 1.2 : isMid ? 0.9 : 0.6;
    case 'defensive': return isDefender ? 1.2 : isMid ? 0.9 : 0.6;
    case 'technical': return isMid || isAttacker ? 1.1 : 0.85;
    case 'physical': return 1;
    case 'mental': return 1;
    case 'balanced': return 0.85;
    default: return 0.8;
  }
};

// ─── Avanzamento nel tempo: da chiamare solo a fine giornata/settimana o a fine stagione ───

const REVIEW_INTERVAL_ROUNDS = 4;
// Un cambio di focus penalizza l'efficacia solo temporaneamente (poche giornate), non per l'intera stagione.
const CONTINUITY_PENALTY_WINDOW = 6;
// Scala il progresso "sviluppo reale" (developmentProgress): deliberatamente basso, cresce per settimane/mesi.
const DEVELOPMENT_PROGRESS_MULTIPLIER = 13;

export interface DevelopmentMatchContext {
  round: number;
  season: string;
  playedIds: string[];
  startedIds: string[];
  userMatchMinutes: Record<string, number>;
  matchRatings?: Record<string, number>;
  slotRoleByPlayerId?: Record<string, PlayerRole | undefined>;
  projectGrowthModifierByPlayerId?: Record<string, number>;
  staffCompetence: number; // 0-100
  seasonFinished: boolean;
}

export interface DevelopmentReviewEvent {
  playerId: string;
  playerName: string;
  kind: 'role_converted' | 'over_potential';
  summary: string;
}

export const advancePlayerDevelopmentCycle = (
  players: Player[],
  context: DevelopmentMatchContext
): { players: Player[]; events: DevelopmentReviewEvent[] } => {
  const events: DevelopmentReviewEvent[] = [];

  const updatedPlayers = players.map(rawPlayer => {
    // Anti-doppia-elaborazione: se questa giornata e' gia' stata applicata a questo piano, non rielaborare.
    const alreadyProcessedThisRound = rawPlayer.trainingPlan?.lastUpdatedRound === context.round;
    const withState = ensurePlayerDevelopmentState(rawPlayer, 'Club', 0, context.round);
    if (alreadyProcessedThisRound) return withState;

    const played = context.playedIds.includes(withState.id);
    const started = context.startedIds.includes(withState.id);
    const minutes = played ? (context.userMatchMinutes[withState.id] ?? (started ? 90 : 30)) : 0;
    const rating = context.matchRatings?.[withState.id] ?? 6.2;
    const slotRole = context.slotRoleByPlayerId?.[withState.id];
    const projectGrowthModifier = context.projectGrowthModifierByPlayerId?.[withState.id] ?? 0;

    let profile = withState.developmentProfile!;
    let plan = withState.trainingPlan!;
    let roleFamiliarity = [...withState.roleFamiliarity!];
    let overall = withState.overall;
    let stamina = withState.stamina;
    const notes: string[] = [];

    const injuryStatus = withState.injuryStatus?.status ?? 'fit';
    const fatigueRisk = withState.workload?.fatigueRisk ?? 20;

    // ─ Vincoli difensivi: il piano si autolimita se le condizioni fisiche cambiano ─
    let effectivePlanStatus: PlayerTrainingPlanStatus = plan.status;
    let allowGrowth = true;
    if (injuryStatus === 'injured' || injuryStatus === 'rehab') {
      effectivePlanStatus = 'limited_by_injury';
      allowGrowth = false;
    } else if (fatigueRisk >= 75 && plan.intensity === 'high') {
      effectivePlanStatus = 'limited_by_fitness';
    } else if (plan.status === 'limited_by_injury' || plan.status === 'limited_by_fitness') {
      effectivePlanStatus = 'active';
    }

    const intensityMultiplier = plan.intensity === 'high' ? 1.35 : plan.intensity === 'light' ? 0.65 : 1;
    const exposureFactor = played ? clamp((minutes / 90) * (started ? 1 : 0.75), 0, 1) : 0;

    const ageCurve =
      withState.age <= 21 ? 1.15 :
      withState.age <= 24 ? 1 :
      withState.age <= 27 ? 0.75 :
      withState.age <= 30 ? 0.45 :
      withState.age <= 33 ? 0.22 :
      0.1;
    const professionalismFactor = clamp((withState.personality.professionalism - 50) / 50, -1, 1);
    const moraleFactor = clamp((withState.morale - 45) / 55, -0.6, 1);
    const consistencyFactor = profile.consistency / 100;
    const learningFactor = profile.learningSpeed / 100;
    const staffFactor = 0.7 + (context.staffCompetence / 100) * 0.6; // 0.7-1.3
    // Penalita' temporanea (non permanente) dopo un cambio di focus/ruolo obiettivo: 60% -> 100% in poche giornate.
    const roundsSinceFocusChange = plan.focusChangedAtRound ? context.round - plan.focusChangedAtRound : Infinity;
    const continuityPenalty = roundsSinceFocusChange < CONTINUITY_PENALTY_WINDOW
      ? clamp(0.6 + (roundsSinceFocusChange / CONTINUITY_PENALTY_WINDOW) * 0.4, 0.6, 1)
      : 1;
    const performanceFactor = played ? clamp((rating - 6) / 3, -0.7, 1) : 0;
    const focusRelevance = getFocusRelevance(plan.focus, withState.role);

    let growthDelta = 0;
    let declineDelta = 0;

    if (plan.focus === 'recovery') {
      growthDelta = 0; // e' un piano di scarico: niente crescita, aiuta solo il recupero fisico (gia' gestito da playerFitness).
    } else if (plan.focus === 'role_learning') {
      // Il progresso vero va nella familiarita' di ruolo qui sotto; solo un trickle tecnico generico.
      growthDelta = exposureFactor * 0.015 * learningFactor;
    } else if (allowGrowth) {
      // Il termine fisso e' volutamente minimo: senza minuti reali un giocatore non deve crescere
      // come un titolare, anche allenandosi bene.
      const base = 0.01 + exposureFactor * 0.13 + performanceFactor * 0.035;
      growthDelta = Math.max(0, base
        * ageCurve
        * intensityMultiplier
        * staffFactor
        * continuityPenalty
        * focusRelevance
        * (1 + professionalismFactor * 0.35 + profile.professionalismImpact / 100)
        * (1 + moraleFactor * 0.25)
        * (1 + projectGrowthModifier)
        * (0.7 + consistencyFactor * 0.3)
        * (0.75 + learningFactor * 0.35));
    }

    const isVeteranStage = profile.developmentStage === 'veteran' || profile.developmentStage === 'declining';
    if (isVeteranStage || fatigueRisk >= 70 || injuryStatus === 'injured') {
      const baseDecline = 0.02
        + Math.max(0, withState.age - 30) * 0.01
        + (fatigueRisk >= 70 ? 0.03 : 0)
        + (injuryStatus === 'injured' ? 0.04 : 0)
        + (withState.morale < 35 ? 0.02 : 0)
        + (exposureFactor < 0.1 && isVeteranStage ? 0.02 : 0);
      declineDelta = baseDecline * (profile.declineRate / 100) * (plan.focus === 'mental' ? 0.55 : plan.focus === 'physical' ? 0.9 : 1);
    }

    profile = {
      ...profile,
      seasonGrowth: Number((profile.seasonGrowth + growthDelta).toFixed(3)),
      seasonDecline: Number((profile.seasonDecline + declineDelta).toFixed(3)),
      growthSinceReview: Number(((profile.growthSinceReview ?? 0) + growthDelta).toFixed(3)),
      declineSinceReview: Number(((profile.declineSinceReview ?? 0) + declineDelta).toFixed(3))
    };

    // ─ Apprendimento ruolo ─
    if (plan.focus === 'role_learning' && plan.targetRole) {
      const target = plan.targetRole;
      const entryIndex = roleFamiliarity.findIndex(entry => entry.roleId === target);
      if (entryIndex >= 0) {
        const entry = roleFamiliarity[entryIndex];
        const distance = roleDistance(withState.role, target);
        const difficulty = distance === 0 ? 0.2 : distance === 1 ? 0.55 : distance === 2 ? 0.85 : 1.25;
        const inRoleMinutes = slotRole === target ? minutes : 0;
        const familiarityCap = distance === 0 ? 100 : distance === 1 ? 100 : distance === 2 ? 75 : 45;
        const progressGain = played
          ? (4 + inRoleMinutes * 0.08) * (profile.adaptability / 100) * staffFactor * intensityMultiplier * continuityPenalty / (1 + difficulty)
          : 0.4 * (profile.adaptability / 100);
        const nextTrainingProgress = clamp(entry.trainingProgress + progressGain, 0, 100);
        let nextFamiliarity = entry.familiarity;
        let nextStatus = entry.status;

        if (nextTrainingProgress >= 100 && entry.familiarity < familiarityCap) {
          const jump = distance === 0 ? 18 : distance === 1 ? 14 : distance === 2 ? 9 : 5;
          let candidateFamiliarity = clamp(entry.familiarity + jump, 0, familiarityCap);
          // "Naturale" per un ruolo non di partenza deve restare rarissimo: quasi sempre si ferma appena sotto.
          if (distance > 0 && candidateFamiliarity >= 85 && entry.familiarity < 85 && Math.random() >= 0.12) {
            candidateFamiliarity = 84;
          }
          nextFamiliarity = candidateFamiliarity;
          nextStatus = familiarityToStatus(nextFamiliarity);
          if (nextStatus !== entry.status) {
            notes.push(`Ruolo ${target}: familiarita' salita a ${ROLE_FAMILIARITY_STATUS_LABELS[nextStatus].toLowerCase()}.`);
            if (nextStatus === 'competent' || nextStatus === 'natural') {
              events.push({
                playerId: withState.id,
                playerName: withState.name,
                kind: 'role_converted',
                summary: `${withState.name} sta diventando affidabile nel ruolo di ${target}.`
              });
            }
          }
        }

        roleFamiliarity[entryIndex] = {
          ...entry,
          trainingProgress: nextTrainingProgress >= 100 ? 0 : nextTrainingProgress,
          familiarity: nextFamiliarity,
          status: nextStatus,
          matchMinutesInRole: entry.matchMinutesInRole + inRoleMinutes,
          startedAtRound: entry.startedAtRound ?? context.round,
          lastUsedRound: inRoleMinutes > 0 ? context.round : entry.lastUsedRound
        };
      }
    }

    // Un ruolo completamente ignorato per molte giornate perde lentamente confidenza (mai il ruolo naturale).
    roleFamiliarity = roleFamiliarity.map(entry => {
      if (entry.roleId === withState.role) return entry;
      if (plan.focus === 'role_learning' && plan.targetRole === entry.roleId) return entry;
      if (entry.familiarity <= 20) return entry;
      const roundsSinceUse = entry.lastUsedRound ? context.round - entry.lastUsedRound : 999;
      if (roundsSinceUse < 12) return entry;
      const decayed = clamp(entry.familiarity - 0.3, 5, 100);
      return { ...entry, familiarity: decayed, status: familiarityToStatus(decayed) };
    });

    // Traccia i minuti reali giocati nello slot assegnato, anche fuori da un piano di apprendimento attivo.
    if (slotRole && played && slotRole !== withState.role && !(plan.focus === 'role_learning' && plan.targetRole === slotRole)) {
      const idx = roleFamiliarity.findIndex(entry => entry.roleId === slotRole);
      if (idx >= 0) {
        roleFamiliarity[idx] = { ...roleFamiliarity[idx], matchMinutesInRole: roleFamiliarity[idx].matchMinutesInRole + minutes, lastUsedRound: context.round };
      }
    }

    // Adesione al piano: quanto il giocatore sta seguendo il piano attuale (non e' sviluppo reale).
    const adherenceGain = plan.focus === 'recovery'
      ? (played ? 6 : 3)
      : allowGrowth
        ? (played ? 8 : 3) * (plan.intensity === 'high' ? 1.1 : plan.intensity === 'light' ? 0.85 : 1) * continuityPenalty
        : 1.5;
    // Sviluppo reale: molto piu' lento, richiede settimane/mesi per diventare leggibile.
    const developmentProgressGain = growthDelta * DEVELOPMENT_PROGRESS_MULTIPLIER * continuityPenalty;

    plan = {
      ...plan,
      status: effectivePlanStatus,
      accumulatedTrainingLoad: Math.round(clamp(plan.accumulatedTrainingLoad + intensityMultiplier * (played ? minutes / 90 : 0.3) * 10, 0, 100)),
      progress: Math.round(clamp(plan.progress + adherenceGain, 0, 100)),
      developmentProgress: Math.round(clamp((plan.developmentProgress ?? 0) + developmentProgressGain, 0, 100)),
      lastUpdatedRound: context.round,
      notes: notes.length ? [...notes, ...plan.notes].slice(0, 5) : plan.notes
    };

    // ─ Revisione periodica: converte l'accumulo in un cambiamento reale, piccolo, di overall/stamina ─
    const roundsSinceReview = context.round - (profile.lastDevelopmentReviewRound ?? (context.round - REVIEW_INTERVAL_ROUNDS));
    const dueForReview = roundsSinceReview >= REVIEW_INTERVAL_ROUNDS || context.seasonFinished;

    if (dueForReview) {
      const netWindow = (profile.growthSinceReview ?? 0) - (profile.declineSinceReview ?? 0);
      // Probabilistico, non un tiro-a-segno deterministico: a parita' di segnale, stagioni diverse
      // possono dare risultati leggermente diversi, com'e' credibile per uno sviluppo reale.
      let overallDelta = 0;
      if (netWindow > 0.12) {
        const growthChance = clamp(netWindow * 0.5, 0.05, 0.68);
        if (Math.random() < growthChance) overallDelta = 1;
      } else if (netWindow < -0.12) {
        const declineChance = clamp(-netWindow * 0.5, 0.05, 0.68);
        if (Math.random() < declineChance) overallDelta = -1;
      }

      if (overallDelta === 1 && netWindow >= 1.5) {
        const strongTrackRecord = profile.reviewHistory.filter(review => review.overallDelta > 0).length >= 2;
        const exceptional = strongTrackRecord && profile.consistency >= 70 && withState.personality.professionalism >= 70
          && withState.morale >= 60 && injuryStatus === 'fit' && withState.age <= 27;
        if (exceptional && Math.random() < 0.3) overallDelta = 2;
      } else if (overallDelta === -1 && netWindow <= -1.5 && Math.random() < 0.3) {
        overallDelta = -2;
      }

      let nextOverall = overall;
      let nextCeiling = profile.realizedCeiling;
      let summary = '';
      let eventKind: DevelopmentReviewEvent['kind'] | null = null;

      if (overallDelta > 0) {
        if (overall < nextCeiling) {
          nextOverall = Math.min(overall + overallDelta, nextCeiling);
          summary = nextOverall > overall
            ? `Crescita confermata: overall ${overall} -> ${nextOverall}.`
            : 'Vicino al livello stimato: la crescita rallenta.';
        } else {
          // Ha gia' raggiunto il tetto attuale: al massimo una valutazione seria a stagione (a fine stagione),
          // e solo con almeno due stagioni consecutive di crescita netta positiva alle spalle.
          const coachTrust = withState.relationships?.coach ?? 55;
          const noRecentSevereInjury = !(withState.injuryHistory ?? []).some(injury => (
            (injury.severity === 'major' || injury.severity === 'severe') && context.round - (injury.round ?? 0) < 10
          ));
          const overPotentialSignal = context.seasonFinished
            && (profile.positiveSeasonStreak ?? 0) >= 2
            && profile.consistency >= 66 && withState.personality.professionalism >= 66 && withState.morale >= 58
            && coachTrust >= 60 && injuryStatus === 'fit' && noRecentSevereInjury
            && withState.age <= 29 && exposureFactor >= 0.5
            && nextCeiling < profile.projectedPotential + profile.overPotentialCapacity;
          if (overPotentialSignal && Math.random() < 0.07) {
            nextCeiling = Math.min(nextCeiling + 1, profile.projectedPotential + profile.overPotentialCapacity);
            summary = `Esplosione inattesa: ${withState.name} sta superando le attese iniziali.`;
            eventKind = 'over_potential';
          } else {
            summary = 'Ha gia\' espresso il proprio potenziale stimato.';
          }
        }
      } else if (overallDelta < 0) {
        nextOverall = Math.max(overall + overallDelta, 38);
        summary = `Calo prestativo: overall ${overall} -> ${nextOverall}.`;
      } else {
        summary = netWindow > 0.15 ? 'Progressi minimi, nella direzione giusta.' :
          netWindow < -0.15 ? 'Lieve flessione, nulla di preoccupante.' :
          'Rendimento stabile in questa fase.';
      }

      let staminaDelta = 0;
      if (plan.focus === 'physical' && exposureFactor > 0.3 && allowGrowth && Math.random() < 0.3) staminaDelta += 1;
      if (isVeteranStage && (profile.declineSinceReview ?? 0) > 0.4 && Math.random() < 0.4) staminaDelta -= 1;
      const nextStamina = clamp(stamina + staminaDelta, 35, 96);

      const trend: PlayerDevelopmentTrend =
        overallDelta > 0 ? 'crescita' :
        overallDelta < 0 ? 'calo' :
        netWindow > 0.15 ? 'recupero' :
        'stabile';

      // A fine stagione si aggiorna la sequenza di stagioni consecutive con crescita netta positiva
      // (usata solo per il rarissimo superamento del potenziale) e si azzerano i contatori stagionali.
      const seasonNet = context.seasonFinished ? profile.seasonGrowth - profile.seasonDecline : null;
      const nextPositiveSeasonStreak = seasonNet === null
        ? profile.positiveSeasonStreak ?? 0
        : (seasonNet > 0.3 ? (profile.positiveSeasonStreak ?? 0) + 1 : 0);

      profile = {
        ...profile,
        realizedCeiling: nextCeiling,
        developmentStage: developmentStageForAge(withState.age),
        trend,
        lastDevelopmentReviewRound: context.round,
        growthSinceReview: 0,
        declineSinceReview: 0,
        seasonGrowth: context.seasonFinished ? 0 : profile.seasonGrowth,
        seasonDecline: context.seasonFinished ? 0 : profile.seasonDecline,
        positiveSeasonStreak: nextPositiveSeasonStreak,
        reviewHistory: [{ round: context.round, season: context.season, summary, overallDelta: nextOverall - overall }, ...profile.reviewHistory].slice(0, 6)
      };

      if (eventKind) {
        events.push({ playerId: withState.id, playerName: withState.name, kind: eventKind, summary });
      }

      overall = nextOverall;
      stamina = nextStamina;
    }

    return {
      ...withState,
      overall,
      stamina,
      developmentProfile: profile,
      trainingPlan: plan,
      roleFamiliarity
    };
  });

  return { players: updatedPlayers, events };
};
