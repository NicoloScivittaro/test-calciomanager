import {
  ClubMemoryDraft,
  Player,
  PlayerInjuryBodyArea,
  PlayerInjuryRecord,
  PlayerInjuryStatus,
  PlayerInjuryStatusValue,
  PlayerInjuryType,
  PlayerMedicalRecommendation,
  PlayerPhysicalProfile,
  PlayerWorkloadState
} from '../types';

interface FitnessMatchContext {
  opponent: string;
  round: number;
  season: string;
  startedIds: string[];
  playedIds: string[];
  userMatchMinutes: Record<string, number>;
  tacticalIntensity: number; // 0-100, derivata da pressing/tempo tattici reali (non inventata)
  fitnessStaffQuality?: number; // 0-100, dal preparatore atletico persistente (Fase 8A); 60 = neutro
  physioStaffQuality?: number; // 0-100, dal capo staff medico persistente (Fase 8A); 60 = neutro
}

export interface PlayerFitnessStatus {
  restThreshold: number;
  consecutiveStarts: number;
  overload: number;
  needsRest: boolean;
  performancePenalty: number;
  injuryRisk: number;
  label: 'Fresco' | 'Gestibile' | 'Da ruotare' | 'Sovraccarico';
}

export interface LineupFitnessReport {
  performanceSwing: number;
  tacticalDisorderSwing: number;
  injuryRisk: number;
  notes: string[];
  playerModifiers: Record<string, number>;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashRatio = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 37 + seed.charCodeAt(i)) % 1000003;
  }
  return hash / 1000003;
};

const seeded = (seed: string, label: string, min: number, max: number) => {
  return Math.round(min + hashRatio(`${seed}-${label}`) * (max - min));
};

const roleLoad = (role: Player['role']) => {
  if (role === 'GK') return 2;
  if (role === 'LW' || role === 'RW' || role === 'LB' || role === 'RB') return -0.5;
  if (role === 'ST' || role === 'CM') return -0.2;
  return 0;
};

// ─── Condizione fisica, carico e infortuni ───
// Tutti i valori sono dati di gameplay CalcioManager (bilanciamento), non informazioni mediche reali.
// Le durate di stop sono espresse in giornate/settimane stimate, non diagnosi.

const INJURY_BODY_AREAS_BY_TYPE: Record<PlayerInjuryType, PlayerInjuryBodyArea[]> = {
  muscle_overload: ['hamstring', 'calf', 'quadriceps'],
  muscle_strain: ['hamstring', 'adductor', 'calf'],
  ankle_sprain: ['ankle'],
  knee_ligament: ['knee'],
  acl_tear: ['knee'],
  bone_injury: ['other'],
  illness: ['other']
};

const INJURY_DURATION_WEEKS: Record<PlayerInjuryType, [number, number]> = {
  muscle_overload: [1, 2],
  muscle_strain: [2, 4],
  ankle_sprain: [1, 3],
  knee_ligament: [4, 7],
  acl_tear: [20, 28],
  bone_injury: [4, 8],
  illness: [1, 1]
};

const INJURY_SEVERITY: Record<PlayerInjuryType, PlayerInjuryRecord['severity']> = {
  muscle_overload: 'minor',
  muscle_strain: 'moderate',
  ankle_sprain: 'moderate',
  knee_ligament: 'major',
  acl_tear: 'severe',
  bone_injury: 'major',
  illness: 'minor'
};

export const INJURY_TYPE_LABELS: Record<PlayerInjuryType, string> = {
  muscle_overload: 'Sovraccarico muscolare',
  muscle_strain: 'Problema muscolare',
  ankle_sprain: 'Distorsione alla caviglia',
  knee_ligament: 'Trauma al ginocchio',
  acl_tear: 'Rottura del legamento crociato',
  bone_injury: 'Trauma osseo',
  illness: 'Malattia'
};

export const INJURY_BODY_AREA_LABELS: Record<PlayerInjuryBodyArea, string> = {
  hamstring: 'bicipite femorale',
  adductor: 'adduttore',
  calf: 'polpaccio',
  quadriceps: 'quadricipite',
  ankle: 'caviglia',
  knee: 'ginocchio',
  other: 'generico'
};

export const INJURY_STATUS_LABELS: Record<PlayerInjuryStatusValue, string> = {
  fit: 'Nessun problema',
  knock: 'Piccolo acciacco',
  injured: 'Infortunato',
  rehab: 'Riabilitazione',
  return_to_training: 'Rientro in gruppo',
  managed_return: 'Rientro controllato'
};

// Sotto questa soglia di settimane lo stop e diretto (infortunato -> fit); sopra, passa da
// riabilitazione/rientro in gruppo/rientro controllato prima di tornare pienamente disponibile.
const PHASE_PIPELINE_MIN_WEEKS = 8;
const MATCH_LOG_WINDOW = 4; // ~28 giorni: calendario settimanale, 1 giornata ~ 7 giorni

export const buildPlayerPhysicalProfile = (
  seed: Pick<Player, 'id' | 'name' | 'role' | 'age'>,
  clubName: string,
  index = 0
): PlayerPhysicalProfile => {
  const base = `${clubName}-${seed.name}-${seed.role}-${seed.age}-${index}-physical`;
  const ageResiliencePenalty = seed.age >= 32 ? -8 : seed.age >= 29 ? -3 : seed.age <= 20 ? -4 : 0;
  const isWideOrFullback = seed.role === 'LW' || seed.role === 'RW' || seed.role === 'LB' || seed.role === 'RB';
  const isBackline = seed.role === 'GK' || seed.role === 'CB' || seed.role === 'LB' || seed.role === 'RB';
  const roleJointLoad = isWideOrFullback ? 10 : isBackline ? 8 : 4;
  const roleSoftTissueLoad = isWideOrFullback ? 10 : seed.role === 'ST' ? 6 : 2;

  const resilience = clamp(seeded(base, 'resilience', 42, 88) + ageResiliencePenalty, 20, 96);
  const recoveryRate = clamp(seeded(base, 'recovery', 38, 86) - Math.max(0, seed.age - 30) * 1.4, 20, 95);
  const softTissueRisk = clamp(seeded(base, 'softTissue', 15, 55) + roleSoftTissueLoad, 8, 82);
  const jointRisk = clamp(seeded(base, 'joint', 12, 50) + roleJointLoad + Math.max(0, seed.age - 30) * 1.1, 8, 85);
  const chronicRisk = clamp(seeded(base, 'chronic', 8, 34), 5, 60);
  const workloadTolerance = clamp(seeded(base, 'tolerance', 40, 90) - Math.max(0, seed.age - 31) * 1.6, 20, 96);
  const explosiveRecovery = clamp(seeded(base, 'explosive', 45, 92) - Math.max(0, seed.age - 30) * 1.2, 25, 97);
  const injuryProneness = clamp(
    Math.round((softTissueRisk + jointRisk) * 0.35 + chronicRisk * 0.3 + (100 - resilience) * 0.2 + (100 - workloadTolerance) * 0.15),
    5,
    95
  );

  return { resilience, recoveryRate, softTissueRisk, jointRisk, chronicRisk, workloadTolerance, explosiveRecovery, injuryProneness };
};

const buildInitialWorkloadState = (): PlayerWorkloadState => ({
  minutesLast7Days: 0,
  minutesLast14Days: 0,
  minutesLast28Days: 0,
  startsLast14Days: 0,
  consecutiveStarts: 0,
  recentHighIntensityMatches: 0,
  accumulatedLoad: 0,
  freshness: 88,
  matchSharpness: 70,
  fatigueRisk: 10,
  lastUpdatedAt: new Date().toISOString(),
  recentMatchLoads: []
});

const buildInitialInjuryStatus = (): PlayerInjuryStatus => ({
  status: 'fit',
  returnReadiness: 100,
  reinjuryRisk: 0,
  temporaryPerformancePenalty: 0,
  medicalRecommendation: 'available'
});

// Normalizza un giocatore (nuovo o di un vecchio salvataggio) garantendo che profilo fisico,
// carico e stato infortuni esistano sempre, senza toccare nient'altro.
export const ensurePlayerPhysicalState = (player: Player, clubName = 'Club', index = 0): Player => {
  if (player.physicalProfile && player.workload && player.injuryStatus && player.injuryHistory) return player;
  return {
    ...player,
    physicalProfile: player.physicalProfile ?? buildPlayerPhysicalProfile(player, clubName, index),
    workload: player.workload ?? buildInitialWorkloadState(),
    injuryStatus: player.injuryStatus ?? buildInitialInjuryStatus(),
    injuryHistory: player.injuryHistory ?? []
  };
};

const recomputeWorkloadWindows = (
  workload: PlayerWorkloadState,
  physicalProfile: PlayerPhysicalProfile,
  round: number,
  fitnessStaffQuality = 60
): PlayerWorkloadState => {
  const log = workload.recentMatchLoads;
  const thisRound = log.filter(entry => entry.round === round);
  const last2 = log.slice(-2);
  const last4 = log.slice(-MATCH_LOG_WINDOW);

  const minutesLast7Days = thisRound.reduce((sum, entry) => sum + entry.minutes, 0);
  const minutesLast14Days = last2.reduce((sum, entry) => sum + entry.minutes, 0);
  const minutesLast28Days = last4.reduce((sum, entry) => sum + entry.minutes, 0);
  const startsLast14Days = last2.filter(entry => entry.started).length;
  const recentHighIntensityMatches = last4.filter(entry => entry.highIntensity).length;
  // Un titolare fisso con un match a settimana (~360' su 4 giornate) e' il carico NORMALE, non un
  // sovraccarico: il carico "in eccesso" conta solo oltre questa base, insieme alle partite
  // davvero ad alta intensita' tattica (pressing/tempo reali, non semplicemente "ha giocato").
  const normalLoad28 = 4 * 90 * 0.85;
  const excessLoad = Math.max(0, minutesLast28Days - normalLoad28);
  const accumulatedLoad = clamp(excessLoad * 0.35 + recentHighIntensityMatches * 10, 0, 100);
  const restBonus = minutesLast7Days === 0 ? clamp((100 - physicalProfile.recoveryRate) * -0.12 + 10, -5, 10) : 0;
  // Un preparatore atletico migliore legge meglio il sovraccarico e affina il recupero: effetto
  // piccolo e graduale (max +-3 punti di freschezza), mai un bonus improvviso o un dimezzamento del carico.
  const staffRecoveryAdjustment = clamp((fitnessStaffQuality - 60) * 0.05, -3, 3);
  const freshness = clamp(100 - accumulatedLoad * 0.7 + restBonus + staffRecoveryAdjustment, 5, 100);
  const matchSharpness = clamp(workload.matchSharpness + (minutesLast7Days > 0 ? physicalProfile.explosiveRecovery * 0.06 : -4), 10, 100);
  const fatigueRisk = clamp(
    accumulatedLoad * 0.6 + Math.max(0, 60 - physicalProfile.workloadTolerance) * 0.25,
    0,
    100
  );

  return {
    ...workload,
    minutesLast7Days,
    minutesLast14Days,
    minutesLast28Days,
    startsLast14Days,
    recentHighIntensityMatches,
    accumulatedLoad: Math.round(accumulatedLoad),
    freshness: Math.round(freshness),
    matchSharpness: Math.round(matchSharpness),
    fatigueRisk: Math.round(fatigueRisk)
  };
};

// Rischio infortunio per l'esposizione corrente (0-100): riusa la soglia di riposo/overload gia'
// calcolata da getPlayerFitnessStatus (dipende da stamina, ruolo, eta, professionalita' del
// giocatore, quindi un titolare fisso non e' automaticamente "a rischio" solo perche' gioca ogni
// giornata) e la combina con predisposizione fisica, eta e storico recente.
export const getPlayerInjuryRisk = (player: Player, context: { round: number }): number => {
  const profile = player.physicalProfile ?? buildPlayerPhysicalProfile(player, 'Club', 0);
  const workload = player.workload ?? buildInitialWorkloadState();
  const history = player.injuryHistory ?? [];
  const overloadStatus = getPlayerFitnessStatus(player);

  const ageRisk = player.age >= 32 ? 5 : player.age >= 29 ? 2 : 0;
  const youthOveruseRisk = player.age <= 20 && workload.recentHighIntensityMatches >= 3 ? 4 : 0;
  const recentSameAreaSignal = history.some(record => record.round !== undefined && context.round - record.round <= 8);
  const recurrenceRisk = recentSameAreaSignal ? 6 : 0;

  const raw =
    overloadStatus.injuryRisk * 0.34
    + workload.fatigueRisk * 0.16
    + profile.softTissueRisk * 0.16
    + profile.jointRisk * 0.10
    + (100 - profile.resilience) * 0.10
    + ageRisk + youthOveruseRisk + recurrenceRisk
    - profile.workloadTolerance * 0.05
    - (workload.freshness - 60) * 0.04;

  return Math.round(clamp(raw, 1, 42));
};

interface PostMatchInjuryContext {
  round: number;
  season: string;
  opponent: string;
}

// Decide se, in questa partita, nasce un nuovo infortunio: dipende dal rischio calcolato sopra,
// non da un tiro di dado indipendente dal carico. La gravita e rara ed e ulteriormente filtrata
// se il giocatore ha gia avuto uno stop serio nella stessa stagione (niente doppio infortunio
// grave casuale senza un segnale reale).
export const evaluatePostMatchInjury = (
  player: Player,
  risk: number,
  context: PostMatchInjuryContext
): PlayerInjuryRecord | null => {
  const history = player.injuryHistory ?? [];
  const hasSevereThisSeason = history.some(record => (
    record.season === context.season && (record.severity === 'major' || record.severity === 'severe')
  ));

  let type: PlayerInjuryType | null = null;
  const roll = Math.random() * 100;

  if (roll < risk) {
    const severityRoll = Math.random() * 100;
    if (severityRoll < 68) {
      type = 'muscle_overload';
    } else if (severityRoll < 90) {
      type = Math.random() < 0.5 ? 'muscle_strain' : 'ankle_sprain';
    } else if (severityRoll < 99.3 || hasSevereThisSeason || risk < 20) {
      type = Math.random() < 0.5 ? 'knee_ligament' : 'bone_injury';
    } else if (risk >= 25) {
      type = 'acl_tear';
    } else {
      type = 'knee_ligament';
    }
  } else if (Math.random() * 100 < 1.2) {
    type = 'illness';
  }

  if (!type) return null;

  const bodyAreas = INJURY_BODY_AREAS_BY_TYPE[type];
  const bodyArea = bodyAreas[Math.floor(Math.random() * bodyAreas.length)];
  const [minWeeks, maxWeeks] = INJURY_DURATION_WEEKS[type];
  const durationWeeks = Math.round(minWeeks + Math.random() * (maxWeeks - minWeeks));
  const isRecurring = history.some(record => record.bodyArea === bodyArea && context.round - (record.round ?? 0) <= 20);

  return {
    id: `injury_${player.id}_${context.round}_${Math.round(Math.random() * 1e6)}`,
    type,
    bodyArea,
    severity: INJURY_SEVERITY[type],
    occurredAt: new Date().toISOString(),
    season: context.season,
    round: context.round,
    expectedReturnRound: context.round + durationWeeks,
    daysOutEstimate: durationWeeks,
    missedMatches: 0,
    isRecurring,
    longTermImpact: 0
  };
};

// Avanza la fase di recupero di un infortunio in corso. Gli stop brevi/medi tornano disponibili
// direttamente; solo quelli lunghi (crociato compreso) passano da riabilitazione, rientro in
// gruppo e rientro controllato prima di tornare pienamente fit.
const advanceInjuryRehabilitation = (injuryStatus: PlayerInjuryStatus, round: number, physioStaffQuality = 60): PlayerInjuryStatus => {
  const injury = injuryStatus.currentInjury;
  if (!injury || injury.round === undefined || injury.expectedReturnRound === undefined) return injuryStatus;

  const totalWeeks = injury.daysOutEstimate;
  const usesPhasePipeline = totalWeeks >= PHASE_PIPELINE_MIN_WEEKS;
  const managedReturnEndRound = injury.expectedReturnRound + 3;

  if (!usesPhasePipeline) {
    if (round >= injury.expectedReturnRound) {
      return { status: 'fit', returnReadiness: 100, reinjuryRisk: 0, temporaryPerformancePenalty: 0, medicalRecommendation: 'available' };
    }
    return { ...injuryStatus, status: 'injured', medicalRecommendation: 'unavailable' as PlayerMedicalRecommendation };
  }

  // Un capo staff medico migliore rende le fasi di rientro solo leggermente piu rapide (al massimo
  // un paio di giornate su stop lunghi): mai una "guarigione" automatica di infortuni gravi.
  const physioAdjustment = Math.round(clamp((physioStaffQuality - 60) / 20, -2, 2));
  const rehabStartRound = injury.round + Math.floor(totalWeeks * 0.6) - physioAdjustment;
  const trainingStartRound = injury.round + Math.floor(totalWeeks * 0.85) - physioAdjustment;

  if (round < rehabStartRound) {
    return { ...injuryStatus, status: 'injured', returnReadiness: 15, medicalRecommendation: 'unavailable' };
  }
  if (round < trainingStartRound) {
    const progress = (round - rehabStartRound) / Math.max(1, trainingStartRound - rehabStartRound);
    return { ...injuryStatus, status: 'rehab', returnReadiness: clamp(Math.round(35 + progress * 30), 35, 65), medicalRecommendation: 'unavailable' };
  }
  if (round < injury.expectedReturnRound) {
    const progress = (round - trainingStartRound) / Math.max(1, injury.expectedReturnRound - trainingStartRound);
    return { ...injuryStatus, status: 'return_to_training', returnReadiness: clamp(Math.round(65 + progress * 25), 65, 90), medicalRecommendation: 'monitor' };
  }
  if (round < managedReturnEndRound) {
    const progress = (round - injury.expectedReturnRound) / Math.max(1, managedReturnEndRound - injury.expectedReturnRound);
    return {
      ...injuryStatus,
      status: 'managed_return',
      returnReadiness: clamp(Math.round(90 + progress * 10), 90, 100),
      temporaryPerformancePenalty: Math.round(clamp(14 * (1 - progress), 0, 14)),
      medicalRecommendation: 'monitor'
    };
  }

  return { status: 'fit', returnReadiness: 100, reinjuryRisk: 0, temporaryPerformancePenalty: 0, medicalRecommendation: 'available' };
};

// Riepilogo leggibile per la UI: disponibilita, livello di rischio, motivi principali e fase di recupero.
export interface PlayerAvailabilitySummary {
  label: 'Disponibile' | 'Da monitorare' | 'A rischio' | 'Indisponibile' | 'Rientro controllato';
  riskLabel: 'Basso' | 'Moderato' | 'Alto' | 'Critico';
  risk: number;
  reasons: string[];
  prognosis: string;
  recoveryPhaseLabel: string;
}

// fitnessStaffQuality, se fornito, distorce SOLO il rischio mostrato in UI (mai la vera estrazione
// usata da evaluatePostMatchInjury): uno staff scarso legge peggio il sovraccarico e produce alert
// meno affidabili, non genera infortuni in piu'. Senza il parametro il comportamento resta invariato.
export const getPlayerAvailabilitySummary = (player: Player, round?: number, fitnessStaffQuality?: number): PlayerAvailabilitySummary => {
  const injuryStatus = player.injuryStatus ?? buildInitialInjuryStatus();
  const workload = player.workload ?? buildInitialWorkloadState();
  const effectiveRound = round ?? workload.lastMatchRound ?? 0;
  const trueRisk = getPlayerInjuryRisk(player, { round: effectiveRound });
  const alertNoise = fitnessStaffQuality === undefined
    ? 0
    : clamp((70 - fitnessStaffQuality) / 10, 0, 6) * (hashRatio(`${player.id}-alert-${effectiveRound}`) * 2 - 1);
  const risk = Math.round(clamp(trueRisk + alertNoise, 1, 42));

  const riskLabel: PlayerAvailabilitySummary['riskLabel'] =
    risk >= 32 ? 'Critico' : risk >= 22 ? 'Alto' : risk >= 12 ? 'Moderato' : 'Basso';

  const label: PlayerAvailabilitySummary['label'] =
    injuryStatus.status === 'injured' || injuryStatus.status === 'rehab' || injuryStatus.status === 'return_to_training' ? 'Indisponibile' :
    injuryStatus.status === 'managed_return' ? 'Rientro controllato' :
    riskLabel === 'Critico' ? 'A rischio' :
    riskLabel === 'Alto' || riskLabel === 'Moderato' ? 'Da monitorare' :
    'Disponibile';

  const reasons: string[] = [];
  if (workload.fatigueRisk >= 55) reasons.push(`Carico partite elevato (${workload.fatigueRisk}/100 nelle ultime giornate).`);
  if ((player.physicalProfile?.softTissueRisk ?? 0) >= 55) reasons.push('Predisposizione a problemi muscolari.');
  if ((player.physicalProfile?.jointRisk ?? 0) >= 55) reasons.push('Predisposizione a problemi articolari.');
  if (player.age >= 32) reasons.push('Eta avanzata: richiede gestione dei minuti.');
  if (workload.startsLast14Days >= 2 && player.age <= 21) reasons.push('Giovane esposto a molti minuti di fila.');
  if (workload.freshness < 45) reasons.push('Freschezza fisica bassa dopo le ultime uscite.');
  if (!reasons.length) reasons.push('Nessun segnale di rischio rilevante al momento.');

  let prognosis = 'Nessun infortunio in corso.';
  const injury = injuryStatus.currentInjury;
  if (injury) {
    if (injuryStatus.status === 'managed_return') {
      prognosis = 'Rientrato: gestire il minutaggio per qualche altra giornata.';
    } else if (injury.expectedReturnRound !== undefined) {
      const remaining = Math.max(0, injury.expectedReturnRound - effectiveRound);
      prognosis = remaining > 0
        ? `Rientro stimato tra ${remaining} giornat${remaining === 1 ? 'a' : 'e'}.`
        : 'Rientro imminente.';
    }
  }

  return {
    label,
    riskLabel,
    risk,
    reasons: reasons.slice(0, 3),
    prognosis,
    recoveryPhaseLabel: INJURY_STATUS_LABELS[injuryStatus.status]
  };
};

export const getManagedReturnRecommendation = (player: Player): string | null => {
  if (player.injuryStatus?.status !== 'managed_return') return null;
  const injury = player.injuryStatus.currentInjury;
  const areaLabel = injury ? INJURY_BODY_AREA_LABELS[injury.bodyArea] : 'il problema fisico';
  return `Rientro guidato dopo un problema al ${areaLabel}: evita 90' consecutivi ed alterna il minutaggio nelle prossime partite.`;
};

export const buildPlayerStamina = (
  seed: Pick<Player, 'id' | 'name' | 'role' | 'age' | 'overall'>,
  clubName: string,
  index = 0
) => {
  const base = `${clubName}-${seed.name}-${seed.role}-${seed.age}-${index}-stamina`;
  const ageCurve =
    seed.age <= 21 ? 5 :
    seed.age <= 27 ? 10 :
    seed.age <= 31 ? 3 :
    seed.age <= 34 ? -7 :
    -14;
  const roleBonus =
    seed.role === 'GK' ? 12 :
    seed.role === 'CM' || seed.role === 'DM' ? 4 :
    seed.role === 'LW' || seed.role === 'RW' ? -2 :
    0;
  const elitePreparation = seed.overall >= 84 ? 4 : seed.overall >= 78 ? 2 : 0;
  return clamp(seeded(base, 'base', 48, 86) + ageCurve + roleBonus + elitePreparation, 35, 96);
};

export const normalizeCareerMemory = (player: Player) => ({
  seasonsAtClub: player.careerMemory?.seasonsAtClub ?? 1,
  appearances: player.careerMemory?.appearances ?? 0,
  goals: player.careerMemory?.goals ?? 0,
  consecutiveStarts: player.careerMemory?.consecutiveStarts ?? 0,
  consecutiveAppearances: player.careerMemory?.consecutiveAppearances ?? 0,
  iconicMoments: player.careerMemory?.iconicMoments ?? 0,
  benchComplaints: player.careerMemory?.benchComplaints ?? 0,
  promisesKept: player.careerMemory?.promisesKept ?? 0,
  promisesBroken: player.careerMemory?.promisesBroken ?? 0,
  pressureCarryover: player.careerMemory?.pressureCarryover ?? 0,
  overuseWarnings: player.careerMemory?.overuseWarnings ?? 0,
  injuryWeeks: player.careerMemory?.injuryWeeks ?? 0,
  legendScore: player.careerMemory?.legendScore ?? 0
});

export const getRestThreshold = (player: Player) => {
  const agePenalty = player.age >= 34 ? 1.1 : player.age >= 31 ? 0.65 : 0;
  const professionBonus = player.personality ? (player.personality.professionalism - 58) / 42 : 0;
  const raw = 2.45 + player.stamina / 24 + professionBonus + roleLoad(player.role) - agePenalty;
  return Math.round(clamp(raw, player.role === 'GK' ? 4 : 2, player.role === 'GK' ? 8 : 6));
};

export const getPlayerFitnessStatus = (player: Player): PlayerFitnessStatus => {
  const restThreshold = getRestThreshold(player);
  const consecutiveStarts = player.careerMemory?.consecutiveStarts ?? 0;
  const overload = Math.max(0, consecutiveStarts - restThreshold + 1);
  const lowCondition = Math.max(0, 64 - player.condition);
  const ageRisk = player.age >= 34 ? 4 : player.age >= 31 ? 2 : 0;
  const staminaRisk = Math.max(0, 68 - player.stamina) * 0.08;
  const performancePenalty = overload <= 0
    ? Math.max(0, lowCondition * 0.035)
    : overload * 1.15 + lowCondition * 0.075 + Math.max(0, 58 - player.stamina) * 0.018;
  const injuryRisk = overload <= 0
    ? clamp(lowCondition * 0.08 + ageRisk, 0, 9)
    : clamp(5 + overload * 5.4 + lowCondition * 0.22 + staminaRisk + ageRisk + (player.status === 'Stanco' ? 4 : 0), 4, 38);
  const label =
    overload >= 2 || injuryRisk >= 22 ? 'Sovraccarico' :
    overload >= 1 || consecutiveStarts >= restThreshold ? 'Da ruotare' :
    player.condition < 72 ? 'Gestibile' :
    'Fresco';

  return {
    restThreshold,
    consecutiveStarts,
    overload,
    needsRest: consecutiveStarts >= restThreshold,
    performancePenalty: Number(performancePenalty.toFixed(2)),
    injuryRisk: Math.round(injuryRisk),
    label
  };
};

export const evaluateLineupFitness = (starters: Player[]): LineupFitnessReport => {
  const statuses = starters.map(player => ({ player, status: getPlayerFitnessStatus(player) }));
  const playerModifiers = Object.fromEntries(statuses.map(({ player, status }) => [
    player.id,
    Number((-status.performancePenalty - (player.injuryStatus?.temporaryPerformancePenalty ?? 0) * 0.04).toFixed(2))
  ]));
  const totalPenalty = statuses.reduce((sum, item) => sum + item.status.performancePenalty, 0);
  const highRisk = statuses.filter(item => item.status.injuryRisk >= 18);
  const needsRest = statuses.filter(item => item.status.needsRest);
  const managedReturn = starters.filter(player => player.injuryStatus?.status === 'managed_return');
  const maxRisk = statuses.reduce((max, item) => Math.max(max, item.status.injuryRisk), 0);
  const notes = [
    needsRest[0] ? `${needsRest[0].player.name} ha ${needsRest[0].status.consecutiveStarts} titolarita di fila: dovrebbe riposare.` : '',
    highRisk[0] ? `${highRisk[0].player.name} e a rischio infortunio da sovraccarico (${highRisk[0].status.injuryRisk}%).` : '',
    needsRest.length >= 3 ? `${needsRest.length} titolari sono in zona rotazione: la prestazione collettiva cala.` : '',
    managedReturn[0] ? `${managedReturn[0].name} e in rientro controllato: meglio non forzarlo per 90 minuti.` : ''
  ].filter(Boolean);

  return {
    performanceSwing: Number(clamp(-totalPenalty * 0.22, -7, 0).toFixed(2)),
    tacticalDisorderSwing: Number(clamp(needsRest.length * 0.35 + highRisk.length * 0.55, 0, 5).toFixed(2)),
    injuryRisk: maxRisk,
    notes,
    playerModifiers
  };
};

export const resolvePostMatchFitness = (players: Player[], context: FitnessMatchContext) => {
  const memories: ClubMemoryDraft[] = [];
  const news: { title: string; content: string }[] = [];
  let newInjuriesThisMatch = 0;

  const updatedPlayers = players.map(rawPlayer => {
    // Anti-doppia-elaborazione: se questa giornata e' gia' stata applicata a questo giocatore
    // (stesso matchId elaborato due volte), non rielaborare carico/infortuni.
    if (rawPlayer.workload?.lastMatchRound === context.round) return rawPlayer;

    const player = ensurePlayerPhysicalState(rawPlayer);
    const started = context.startedIds.includes(player.id);
    const played = context.playedIds.includes(player.id);
    const beforeStatus = getPlayerFitnessStatus(player);
    const careerMemory = normalizeCareerMemory(player);
    let condition = player.condition;
    let morale = player.morale;
    let status = player.status;
    let injuryStatus = player.injuryStatus!;
    const injuryHistory = [...player.injuryHistory!];
    let physicalProfile = player.physicalProfile!;

    // ─ Avanzamento della fase di recupero (rientro dal precedente infortivo, se presente) ─
    if (injuryStatus.status !== 'fit') {
      const resolvingInjury = injuryStatus.currentInjury;
      injuryStatus = advanceInjuryRehabilitation(injuryStatus, context.round, context.physioStaffQuality ?? 60);

      if (injuryStatus.status === 'fit' && resolvingInjury) {
        // Nessun downgrade automatico di overall/potenziale: un impatto di lungo periodo esiste
        // solo se l'infortunio era severo e c'e' un segnale reale (eta, recidiva, rientro affrettato).
        const priorSameAreaSevere = injuryHistory.some(record => (
          record.id !== resolvingInjury.id && record.bodyArea === resolvingInjury.bodyArea && (record.severity === 'major' || record.severity === 'severe')
        ));
        const earlyReturnFlag = injuryStatus.reinjuryRisk >= 30;
        const triggersLongTermImpact = resolvingInjury.severity === 'severe' && (player.age >= 29 || priorSameAreaSevere || earlyReturnFlag);
        if (triggersLongTermImpact) {
          physicalProfile = {
            ...physicalProfile,
            explosiveRecovery: clamp(physicalProfile.explosiveRecovery - 8, 15, 97),
            chronicRisk: clamp(physicalProfile.chronicRisk + 6, 5, 70)
          };
        }
        const historyIndex = injuryHistory.findIndex(record => record.id === resolvingInjury.id);
        if (historyIndex >= 0) {
          injuryHistory[historyIndex] = {
            ...injuryHistory[historyIndex],
            actualReturnRound: context.round,
            longTermImpact: triggersLongTermImpact ? 35 : 5
          };
        }
        careerMemory.injuryWeeks = 0;
      }
    }

    if (careerMemory.injuryWeeks > 0 && !played) {
      careerMemory.injuryWeeks = Math.max(0, careerMemory.injuryWeeks - 1);
    }

    // ─ Carico partita: aggiorna la finestra di minuti recenti per tutti (giocato o no) ─
    const minutesThisMatch = played ? (context.userMatchMinutes[player.id] ?? (started ? 90 : 30)) : 0;
    const highIntensity = played && context.tacticalIntensity >= 68;
    const recentMatchLoads = [...player.workload!.recentMatchLoads, {
      round: context.round,
      minutes: minutesThisMatch,
      started: started && played,
      highIntensity
    }].slice(-MATCH_LOG_WINDOW);
    let workload = recomputeWorkloadWindows({ ...player.workload!, recentMatchLoads }, physicalProfile, context.round, context.fitnessStaffQuality ?? 60);

    if (started) {
      careerMemory.consecutiveStarts += 1;
      careerMemory.consecutiveAppearances += 1;
      if (beforeStatus.needsRest) careerMemory.overuseWarnings += 1;
    } else if (played) {
      careerMemory.consecutiveStarts = 0;
      careerMemory.consecutiveAppearances += 1;
    } else {
      careerMemory.consecutiveStarts = 0;
      careerMemory.consecutiveAppearances = 0;
      careerMemory.overuseWarnings = Math.max(0, careerMemory.overuseWarnings - 1);
      if (status === 'Stanco' && condition >= 70 && careerMemory.injuryWeeks === 0 && injuryStatus.status === 'fit') status = 'Disponibile';
    }

    if (played && injuryStatus.status === 'fit') {
      if (beforeStatus.needsRest) {
        status = 'Stanco';
        morale = Math.max(10, morale - 2);
        if (careerMemory.overuseWarnings >= 2) {
          memories.push({
            season: context.season,
            category: 'locker',
            title: `Allarme rotazioni: ${player.name}`,
            description: `${player.name} continua a giocare oltre la sua soglia fisica. La prestazione cala e lo staff chiede riposo.`,
            importance: 60,
            fanImpact: 0,
            dressingRoomImpact: -2,
            tags: ['rotazioni', 'sovraccarico', `player:${player.name}`],
            playerNames: [player.name],
            opponent: context.opponent
          });
        }
      }

      // Al massimo un nuovo infortunio rilevante per squadra nella stessa gara.
      if (newInjuriesThisMatch === 0) {
        const playerWithUpdatedLoad = { ...player, workload, physicalProfile };
        const risk = getPlayerInjuryRisk(playerWithUpdatedLoad, { round: context.round });
        const newInjury = evaluatePostMatchInjury(playerWithUpdatedLoad, risk, {
          round: context.round,
          season: context.season,
          opponent: context.opponent
        });

        if (newInjury) {
          newInjuriesThisMatch += 1;
          injuryHistory.unshift(newInjury);
          injuryStatus = {
            status: 'injured',
            currentInjury: newInjury,
            returnReadiness: 0,
            reinjuryRisk: 0,
            temporaryPerformancePenalty: 0,
            medicalRecommendation: 'unavailable'
          };
          careerMemory.injuryWeeks = newInjury.daysOutEstimate;
          careerMemory.consecutiveStarts = 0;
          status = 'Infortunato';
          const severityConditionHit = newInjury.severity === 'severe' ? 35 : newInjury.severity === 'major' ? 30 : 20;
          condition = Math.max(20, condition - severityConditionHit);
          morale = Math.max(10, morale - (newInjury.severity === 'severe' || newInjury.severity === 'major' ? 9 : 6));

          const typeLabel = INJURY_TYPE_LABELS[newInjury.type];
          const areaLabel = INJURY_BODY_AREA_LABELS[newInjury.bodyArea];
          const isSerious = newInjury.severity === 'major' || newInjury.severity === 'severe';
          const title = isSerious ? `Infortunio serio: ${player.name}` : `Infortunio: ${player.name}`;
          const content = `${player.name} ha rimediato un problema di tipo ${typeLabel.toLowerCase()} (${areaLabel}). Stop stimato: ${newInjury.daysOutEstimate} settimane.`;
          news.push({ title, content });
          if (isSerious) {
            memories.push({
              season: context.season,
              category: 'locker',
              title,
              description: content,
              importance: newInjury.severity === 'severe' ? 82 : 68,
              fanImpact: -4,
              dressingRoomImpact: -5,
              tags: ['infortunio', newInjury.type, `player:${player.name}`],
              playerNames: [player.name],
              opponent: context.opponent
            });
          }
        }
      }
    }

    // Rientro guidato: se lo si forza oltre il minutaggio consigliato il rischio ricaduta sale,
    // altrimenti si riduce gradualmente partita dopo partita. Un buon capo staff medico accelera
    // leggermente questo calo (mai la componente di rischio da sovra-utilizzo).
    if (injuryStatus.status === 'managed_return') {
      const physioDecayBonus = Math.round(clamp(((context.physioStaffQuality ?? 60) - 60) / 25, -2, 2));
      injuryStatus = {
        ...injuryStatus,
        reinjuryRisk: minutesThisMatch > 55
          ? clamp(injuryStatus.reinjuryRisk + 10, 0, 60)
          : Math.max(0, injuryStatus.reinjuryRisk - 4 - physioDecayBonus)
      };
    }

    workload = { ...workload, consecutiveStarts: careerMemory.consecutiveStarts, lastMatchRound: context.round, lastUpdatedAt: new Date().toISOString() };

    return {
      ...player,
      condition,
      morale,
      status,
      careerMemory,
      physicalProfile,
      workload,
      injuryStatus,
      injuryHistory: injuryHistory.slice(0, 20)
    };
  });

  return { players: updatedPlayers, memories, news };
};
