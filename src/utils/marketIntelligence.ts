import { AgentStyle, ClubAIState, ClubHistoryState, ClubWageBudgetState, ContractPromiseType, Negotiation, NegotiationStatus, Player, ScoutingCertainty, Tactic, TeamDNAState, TransferClauseType } from '../types';
import { getDNAMarketAdjustment } from './teamDNA';
import { getRoleFitScore, POSITION_PRESETS } from './tacticsEngine';
import { toAnnualSalary } from './playerContracts';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const hashRatio = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return hash / 100000;
};

const agentStyles: AgentStyle[] = ['Leale', 'Duro', 'Mediatico', 'Opportunista', 'Paziente'];
const rivalClubs = ['Inter', 'Juventus', 'Milan', 'Napoli', 'Roma', 'Atalanta', 'Como', 'Fiorentina', 'Lazio'];

export const getRealPlayerForTarget = (target: Negotiation, world: ClubAIState[]) => {
  const sourceClub = world.find(club => club.name === target.currentClub);
  return sourceClub?.roster.find(player => player.name === target.playerName);
};

// scoutQuality (0-100, 60 = neutro) restringe solo l'ampiezza della forbice di incertezza gia'
// esistente: un capo scout migliore rende il range piu' stretto e affidabile, uno scarso lo
// allarga leggermente. Non scopre mai il potenziale reale ne' salta livelli di scouting.
const buildPotentialRange = (target: Negotiation, realPlayer?: Player, scoutQuality = 60): [number, number] => {
  // 60 = capo scout neutro: fattore 1, comportamento identico a prima dell'introduzione dello staff.
  const precisionFactor = clamp(1 + (60 - scoutQuality) / 150, 0.6, 1.3);
  if (realPlayer) {
    const uncertainty = (realPlayer.age <= 22 ? 5 : realPlayer.age <= 25 ? 3 : 1) * precisionFactor;
    return [
      Math.max(realPlayer.overall, Math.round(realPlayer.potential - uncertainty)),
      Math.min(94, Math.round(realPlayer.potential + Math.max(1, uncertainty / 2)))
    ];
  }
  const estimated = Math.round(70 + Math.log10(Math.max(target.value, 1000000) / 1000000) * 7.2);
  const youngBias = (target.value <= 25000000 ? 7 : 4) * precisionFactor;
  const lowSpread = 3 * precisionFactor;
  return [Math.max(66, Math.round(estimated - lowSpread)), Math.min(92, Math.round(estimated + youngBias))];
};

const inferHiddenRisk = (target: Negotiation, realPlayer?: Player): Negotiation['hiddenRisk'] => {
  const roll = hashRatio(`${target.id}-${target.playerName}-risk`);
  if (realPlayer?.stamina && realPlayer.stamina < 58) return 'Fragilita fisica';
  if (realPlayer?.personality && realPlayer.personality.ego > 76 && realPlayer.personality.professionalism < 55) return 'Carattere complesso';
  if (roll > 0.82) return 'Fragilita fisica';
  if (roll > 0.64) return 'Carattere complesso';
  if (roll > 0.46) return 'Adattamento campionato';
  return 'Nessuno';
};

const getScoutingCertainty = (level: number): ScoutingCertainty => {
  if (level >= 4) return 'Completa';
  if (level >= 3) return 'Alta';
  if (level >= 2) return 'Media';
  return 'Bassa';
};

const VALID_NEGOTIATION_STATUSES = new Set<string>([
  'draft', 'club_offer_sent', 'club_offer_rejected', 'club_counter_offer', 'club_offer_accepted',
  'player_contract_negotiation', 'player_contract_rejected', 'player_counter_offer',
  'completed', 'withdrawn', 'expired'
]);

// Migra gli stati del vecchio flusso a un solo scatto (pending/accepted/rejected) verso i nuovi
// stati a due fasi: nessun salvataggio resta bloccato su uno stato che il nuovo Market non conosce.
const migrateNegotiationStatus = (raw: unknown): NegotiationStatus => {
  if (typeof raw === 'string' && VALID_NEGOTIATION_STATUSES.has(raw)) return raw as NegotiationStatus;
  if (raw === 'pending') return 'draft';
  if (raw === 'accepted') return 'completed';
  if (raw === 'rejected') return 'club_offer_rejected';
  return 'draft';
};

export const NEGOTIATION_STATUS_LABELS: Record<NegotiationStatus, string> = {
  draft: 'Obiettivo osservato',
  club_offer_sent: 'Offerta al club',
  club_offer_rejected: 'Trattativa fallita',
  club_counter_offer: 'Controproposta club',
  club_offer_accepted: 'Accordo con club',
  player_contract_negotiation: 'Contratto da negoziare',
  player_contract_rejected: 'Trattativa fallita',
  player_counter_offer: 'Controproposta del giocatore',
  // Mercato M3: dopo l'accordo col giocatore, prima dell'ingresso in rosa.
  player_contract_accepted: 'Accordo raggiunto',
  medical_pending: 'In attesa visite mediche',
  medical_warning: 'Rischio medico da valutare',
  medical_failed: 'Visite non superate',
  registration_pending: 'Registrazione in corso',
  registration_failed: 'Registrazione fallita',
  suspended_window_closed: 'Mercato chiuso',
  completed: 'Completata',
  withdrawn: 'Ritirata',
  expired: 'Offerta scaduta'
};

export const normalizeNegotiation = (
  target: Negotiation,
  teamDNA: TeamDNAState,
  world: ClubAIState[]
): Negotiation => {
  const realPlayer = getRealPlayerForTarget(target, world);
  const baseValue = target.baseValue ?? target.value;
  const scoutLevel = clamp(target.scoutLevel ?? 0, 0, 4);
  const style = target.agentStyle ?? agentStyles[Math.floor(hashRatio(`${target.id}-agent`) * agentStyles.length)] ?? 'Paziente';
  const rivalRoll = hashRatio(`${target.playerName}-${target.currentClub}-rival`);
  const rivalClub = target.rivalClub ?? (rivalRoll > 0.34 ? rivalClubs[Math.floor(rivalRoll * rivalClubs.length) % rivalClubs.length] : undefined);
  const dnaMarket = realPlayer ? getDNAMarketAdjustment(realPlayer, teamDNA) : null;
  const potentialRange = target.potentialRange ?? buildPotentialRange(target, realPlayer);
  const hiddenRisk = target.hiddenRisk ?? inferHiddenRisk(target, realPlayer);
  const tacticalFit = target.tacticalFit ?? (dnaMarket?.fit ?? Math.round(clamp(52 + hashRatio(`${target.id}-fit`) * 38, 45, 90)));
  const agentTrust = target.agentTrust ?? Math.round(clamp(42 + teamDNA.reputation * 0.16 + hashRatio(`${target.id}-trust`) * 24, 35, 78));
  const rumorLevel = target.rumorLevel ?? Math.round(hashRatio(`${target.id}-rumor`) * 45);
  const rumoredValue = Math.round(baseValue * (1 + rumorLevel * 0.0015) / 100000) * 100000;

  return {
    ...target,
    status: migrateNegotiationStatus(target.status),
    baseValue,
    value: rumoredValue,
    scoutLevel,
    scoutCertainty: target.scoutCertainty ?? getScoutingCertainty(scoutLevel),
    potentialRange,
    tacticalFit,
    systemNote: target.systemNote ?? (tacticalFit >= 76
      ? 'Nel tuo sistema puo rendere piu del valore grezzo.'
      : tacticalFit <= 48
        ? 'Il talento esiste, ma l adattamento tattico e un rischio.'
        : 'Fit tattico interessante ma non ancora decisivo.'),
    hiddenRisk,
    riskKnown: target.riskKnown ?? scoutLevel >= 4,
    personalityKnown: target.personalityKnown ?? scoutLevel >= 3,
    agentName: target.agentName ?? `Agente ${target.playerName.split(' ').slice(-1)[0]}`,
    agentStyle: style,
    agentTrust,
    agentPatience: target.agentPatience ?? Math.round(clamp(style === 'Paziente' ? 74 : style === 'Opportunista' ? 42 : style === 'Mediatico' ? 50 : 58, 25, 85)),
    daysLeft: target.daysLeft ?? Math.round(clamp(12 + hashRatio(`${target.id}-days`) * 18, 8, 30)),
    rivalClub,
    rivalPressure: target.rivalPressure ?? (rivalClub ? Math.round(18 + hashRatio(`${target.id}-pressure`) * 40) : 0),
    rumorLevel,
    clauseType: target.clauseType ?? 'none',
    promiseType: target.promiseType ?? 'none',
    roleExpectation: target.roleExpectation ?? (realPlayer?.overall && realPlayer.overall >= 84 ? 'Vuole sentirsi centrale nel progetto.' : realPlayer?.age && realPlayer.age <= 22 ? 'Vuole minuti veri e un piano di crescita.' : 'Cerca chiarezza sul ruolo.'),
    projectFit: target.projectFit ?? Math.round(clamp((dnaMarket?.fit ?? tacticalFit) * 0.65 + teamDNA.marketAttraction * 0.22 + teamDNA.internationalReputation * 0.13, 0, 100))
  };
};

export const normalizeNegotiations = (
  targets: Negotiation[],
  teamDNA: TeamDNAState,
  world: ClubAIState[]
) => targets.map(target => normalizeNegotiation(target, teamDNA, world));

// Livello di affidabilita' leggibile dello scouting gia' esistente (basato su scoutLevel, non un dato nuovo).
export const getScoutReliabilityLabel = (scoutLevel: number): string => (
  scoutLevel >= 4 ? 'Relazione approfondita' :
  scoutLevel >= 2 ? 'Analisi discreta' :
  'Osservazione iniziale'
);

export const getVisibleScoutingReport = (target: Negotiation) => {
  const scoutLevel = target.scoutLevel ?? 0;
  const certainty = target.scoutCertainty ?? getScoutingCertainty(scoutLevel);
  const potential =
    scoutLevel >= 2 && target.potentialRange
      ? `${target.potentialRange[0]}-${target.potentialRange[1]}`
      : '??';
  const personality =
    scoutLevel >= 3
      ? `${target.agentStyle === 'Mediatico' ? 'pressione mediatica alta' : target.agentStyle === 'Duro' ? 'negoziazione rigida' : 'profilo gestibile'}`
      : 'non verificata';
  const risk =
    scoutLevel >= 4
      ? target.hiddenRisk ?? 'Nessuno'
      : 'non scoperto';

  return {
    certainty,
    potential,
    personality,
    risk,
    tacticalFit: scoutLevel >= 1 ? `${target.tacticalFit ?? 50}/100` : '??',
    projectFit: scoutLevel >= 2 ? `${target.projectFit ?? 50}/100` : '??'
  };
};

export const advanceScouting = (
  target: Negotiation,
  realPlayer: Player | undefined,
  teamDNA: TeamDNAState,
  world: ClubAIState[],
  scoutQuality = 60
) => {
  const normalized = normalizeNegotiation(target, teamDNA, world);
  const nextLevel = clamp((normalized.scoutLevel ?? 0) + 1, 0, 4);
  const tacticalFit = realPlayer ? getDNAMarketAdjustment(realPlayer, teamDNA).fit : normalized.tacticalFit ?? 55;
  const potentialRange = buildPotentialRange(normalized, realPlayer, scoutQuality);
  const hiddenRisk = inferHiddenRisk(normalized, realPlayer);
  const nextRumorLevel = clamp((normalized.rumorLevel ?? 0) + (nextLevel >= 3 ? 7 : 4), 0, 100);
  const baseValue = normalized.baseValue ?? normalized.value;
  const reportLine =
    nextLevel === 1 ? `Scout livello 1: adattamento tattico stimato ${tacticalFit}/100.` :
    nextLevel === 2 ? `Scout livello 2: potenziale stimato ${potentialRange[0]}-${potentialRange[1]}, progetto ${normalized.projectFit}/100.` :
    nextLevel === 3 ? `Scout livello 3: personalita e agente piu chiari (${normalized.agentStyle}).` :
    `Scout livello 4: rischio nascosto ${hiddenRisk}.`;

  return {
    ...normalized,
    scoutLevel: nextLevel,
    scoutCertainty: getScoutingCertainty(nextLevel),
    value: Math.round(baseValue * (1 + nextRumorLevel * 0.0015) / 100000) * 100000,
    tacticalFit,
    potentialRange,
    hiddenRisk,
    riskKnown: nextLevel >= 4,
    personalityKnown: nextLevel >= 3,
    rumorLevel: nextRumorLevel,
    rivalPressure: clamp((normalized.rivalPressure ?? 0) + (normalized.rivalClub ? 5 : 0), 0, 100),
    timeline: [...normalized.timeline, reportLine]
  };
};

export const getClauseLabel = (clause: TransferClauseType) => {
  switch (clause) {
    case 'goalBonus':
      return 'Bonus gol/presenze';
    case 'loanObligation':
      return 'Prestito con obbligo';
    case 'buyback':
      return 'Diritto di recompra';
    case 'sellOn':
      return 'Percentuale rivendita';
    case 'none':
    default:
      return 'Nessuna clausola';
  }
};

// ─── "Trova il giocatore perfetto": punteggio spiegabile da soli dati reali gia' esistenti ───

export interface MarketFitContext {
  tactic: Tactic | null;
  teamDNA: TeamDNAState;
  players: Player[]; // rosa prima squadra attuale, per la necessita di reparto
  starters: string[];
  transferBudget: number;
  wageBudget: ClubWageBudgetState;
  clubHistory: ClubHistoryState;
  scouting?: Negotiation; // se il profilo e' gia' stato osservato/scoutato
}

export type MarketFitLabel = 'Perfetto per il progetto' | 'Ottima opzione' | 'Compatibile' | 'Da valutare' | 'Poco adatto';

export interface MarketFitResult {
  score: number; // 0-100
  label: MarketFitLabel;
  reasons: string[]; // max 3, solo motivi reali
}

const roleFamilyOf = (role: string) => (
  role === 'GK' ? 'GK' : /CB|LB|RB/.test(role) ? 'DF' : /DM|CM|AM/.test(role) ? 'MF' : 'FW'
);

export const getMarketFitScore = (player: Player, context: MarketFitContext): MarketFitResult => {
  const scoutLevel = context.scouting?.scoutLevel ?? 0;
  const reasons: { text: string; weight: number }[] = [];

  // Compatibilita ruolo/modulo: riusa la stessa matrice di fit gia' usata in Tactics.
  const slots = context.tactic ? POSITION_PRESETS[context.tactic.module] : undefined;
  const roleFit = slots?.length
    ? Math.max(...slots.map(slot => getRoleFitScore(player.role, slot.role)))
    : (player.role ? 0.6 : 0.5);
  if (roleFit >= 0.85) reasons.push({ text: 'Copre in pieno un ruolo chiave del modulo attuale.', weight: 3 });
  else if (roleFit >= 0.6) reasons.push({ text: 'Compatibile con il modulo e la tattica attuale.', weight: 2 });

  // Necessita di reparto: quanti giocatori reali coprono gia' lo stesso reparto in rosa.
  const sameFamilyCount = context.players.filter(p => roleFamilyOf(p.role) === roleFamilyOf(player.role)).length;
  const squadNeed = sameFamilyCount <= 3 ? 1 : sameFamilyCount <= 5 ? 0.6 : 0.3;
  if (sameFamilyCount <= 3) reasons.push({ text: 'Copre un reparto in rosa con poche alternative reali.', weight: 3 });

  // DNA fit: riusa la stessa funzione gia' usata per il mercato normale.
  const dnaMarket = getDNAMarketAdjustment(player, context.teamDNA);
  const dnaScore = clamp(dnaMarket.fit, 0, 100) / 100;
  if (dnaMarket.fit >= 72) reasons.push({ text: 'Profilo coerente con il DNA e l\'identita della squadra.', weight: 2 });

  // Eta: picco 23-29, penalizza estremi.
  const ageScore = player.age <= 20 ? 0.55 : player.age <= 29 ? 1 : player.age <= 32 ? 0.7 : 0.4;

  // Overall reale (sempre visibile) + potenziale solo se scoutato a sufficienza.
  const overallScore = clamp((player.overall - 60) / 30, 0, 1);
  const potentialKnown = scoutLevel >= 2 && Boolean(context.scouting?.potentialRange);
  const potentialScore = potentialKnown
    ? clamp(((context.scouting!.potentialRange![0] + context.scouting!.potentialRange![1]) / 2 - 60) / 30, 0, 1)
    : 0.5;

  // Sostenibilita economica: cartellino vs budget trasferimenti, stipendio vs margine stipendi.
  const estimatedFee = context.scouting?.value ?? player.value;
  const feeRatio = context.transferBudget > 0 ? clamp(estimatedFee / context.transferBudget, 0, 3) : 1.5;
  const transferAffordable = feeRatio <= 1;
  const annualSalary = toAnnualSalary(player.wage);
  const wageAffordable = annualSalary <= context.wageBudget.availableAnnualWages;
  const budgetScore = (transferAffordable ? 0.55 : clamp(1 - (feeRatio - 1) * 0.4, 0, 0.55))
    + (wageAffordable ? 0.45 : 0.1);
  if (transferAffordable && wageAffordable) reasons.push({ text: 'Costo cartellino e stipendio sostenibili per il budget attuale.', weight: 2 });
  else if (!wageAffordable) reasons.push({ text: 'Profilo interessante, ma stipendio fuori dal margine attuale.', weight: -2 });
  else if (!transferAffordable) reasons.push({ text: 'Cartellino oltre il budget trasferimenti disponibile.', weight: -2 });

  // Contratto in scadenza: piu' facile da trattare, segnale reale gia' presente sul giocatore.
  if (player.contractYears <= 1) reasons.push({ text: 'Contratto vicino alla scadenza: trattativa piu abbordabile.', weight: 1 });

  // Rischio fisico solo se davvero scoutato.
  const riskKnown = scoutLevel >= 4 && context.scouting?.hiddenRisk && context.scouting.hiddenRisk !== 'Nessuno';
  if (riskKnown) reasons.push({ text: `Rischio noto dallo scouting: ${context.scouting!.hiddenRisk!.toLowerCase()}.`, weight: -1 });

  // Rivalita: solo come warning, mai come blocco al punteggio.
  const rivalClub = context.clubHistory.rivalries.find(r => r.heat >= 55 && r.opponent === context.scouting?.rivalClub);
  if (rivalClub) {
    reasons.push({ text: `Acquisto delicato: interesse concreto anche del ${rivalClub.opponent}, rivale diretto.`, weight: -1 });
  }

  const weighted =
    roleFit * 22
    + squadNeed * 14
    + dnaScore * 18
    + ageScore * 12
    + overallScore * 16
    + potentialScore * 10
    + budgetScore * 8;
  const score = Math.round(clamp(weighted, 0, 100));

  const label: MarketFitLabel =
    score >= 82 ? 'Perfetto per il progetto' :
    score >= 68 ? 'Ottima opzione' :
    score >= 52 ? 'Compatibile' :
    score >= 36 ? 'Da valutare' :
    'Poco adatto';

  const topReasons = reasons
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, 3)
    .map(r => r.text);

  return { score, label, reasons: topReasons };
};

export const getPromiseLabel = (promise: ContractPromiseType) => {
  switch (promise) {
    case 'starter':
      return 'Titolare';
    case 'rotation':
      return 'Rotazione importante';
    case 'youngProject':
      return 'Progetto giovane';
    case 'starRole':
      return 'Stella centrale';
    case 'none':
    default:
      return 'Nessuna promessa';
  }
};
