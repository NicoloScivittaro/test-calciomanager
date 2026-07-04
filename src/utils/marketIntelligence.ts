import { AgentStyle, ClubAIState, ContractPromiseType, Negotiation, Player, ScoutingCertainty, TeamDNAState, TransferClauseType } from '../types';
import { getDNAMarketAdjustment } from './teamDNA';

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

const buildPotentialRange = (target: Negotiation, realPlayer?: Player): [number, number] => {
  if (realPlayer) {
    const uncertainty = realPlayer.age <= 22 ? 5 : realPlayer.age <= 25 ? 3 : 1;
    return [
      Math.max(realPlayer.overall, realPlayer.potential - uncertainty),
      Math.min(94, realPlayer.potential + Math.max(1, Math.round(uncertainty / 2)))
    ];
  }
  const estimated = Math.round(70 + Math.log10(Math.max(target.value, 1000000) / 1000000) * 7.2);
  const youngBias = target.value <= 25000000 ? 7 : 4;
  return [Math.max(66, estimated - 3), Math.min(92, estimated + youngBias)];
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
  world: ClubAIState[]
) => {
  const normalized = normalizeNegotiation(target, teamDNA, world);
  const nextLevel = clamp((normalized.scoutLevel ?? 0) + 1, 0, 4);
  const tacticalFit = realPlayer ? getDNAMarketAdjustment(realPlayer, teamDNA).fit : normalized.tacticalFit ?? 55;
  const potentialRange = buildPotentialRange(normalized, realPlayer);
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
