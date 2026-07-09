import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trophy, Users, BarChart2, Award, Gauge, Shuffle, SlidersHorizontal, Save } from 'lucide-react';
import { ClubAIState, ClubHistoryState, ClubMemoryDraft, ClubProfile, Player, Match, Standing, MatchEvent, MatchStats, Tactic, TeamDNAState, RivalTacticalMemory, SeasonNarrativeState, PlayerSeasonStat, EmotionalNarrativeState, CareerWorldState, PlayerConversationState, LeagueSystemState, CompetitionId, Negotiation, IncomingTransferOffer } from '../../types';
import { calculateInitialStandings, createPlayersForClub, DEFAULT_CLUB_PROFILE, generateCalendar, getClubByName, rankStandings } from '../../data/serieAData';
import { getClubCompetitiveRating, runClubAutonomyRound, createInitialClubWorld } from '../../utils/clubAI';
import {
  advancePostseasonForCpu,
  advanceSerieBPlayoffFinal,
  advanceSerieBPlayoffStage,
  advanceLeagueSystemToNextSeason,
  applyUserResultToFixtures,
  buildSerieBPlayoffBracket,
  buildSerieBPlayoutBracket,
  computeStandingsFromFixtures,
  COMPETITION_DEFINITIONS,
  createInitialSerieBClubWorld,
  deriveClubMatchCalendar,
  determineRegularSeasonOutcome,
  finalizePostseason,
  getAnyClubByName,
  getAnyClubById,
  getSeasonStartYear,
  OBJECTIVE_LABELS,
  SERIE_B_PROMOTION_RULES,
  simulateCompetitionRound
} from '../../utils/leagueSystem';
import { applyRivalryMatchResult, buildExPlayerReturnMemory, buildMatchMemories, CURRENT_SEASON, isFormerClubPlayer } from '../../utils/clubHistory';
import { MarketRumorPlayerSignal, processMarketRumorsAfterMatch, processMarketRumorsAfterTransfer, processMediaAfterMatch } from '../../utils/mediaEngine';
import { processMatchForEmotionalNarratives } from '../../utils/emotionalNarratives';
import { CareerWorldPlayerContribution, computeMatchImportance, isAcademyOrLocalPlayer, processCareerWorldAfterMatch, regenerateObjectivesForDivisionChange } from '../../utils/careerWorld';
import { resolvePlayingTimePromises } from '../../utils/playerPromises';
import { getPlayerProjectRole } from '../../utils/playerProjectRole';
import { detectPostMatchConversationTriggers } from '../../utils/playerDialogue';
import { evaluateLineupFitness, resolvePostMatchFitness } from '../../utils/playerFitness';
import { advancePlayerDevelopmentCycle } from '../../utils/playerDevelopment';
import { evaluateLineupPersonalities, resolvePostMatchPersonalities } from '../../utils/playerPersonality';
import { advanceClubStaffReports, buildClubStaff, getClubStaffModifiers } from '../../utils/staff';
import { advanceClubFacilities, applyFacilityBonusToStaffModifiers, getFacilityStaffBonus } from '../../utils/facilities';
import { calculateClubWageBudget, processContractBonusesAfterMatch, processContractSeasonTransition } from '../../utils/playerContracts';
import { ensureSeasonalYouthIntake, runYouthAcademyReview } from '../../utils/youthAcademy';
import { checkLoanAppearanceObligation, resolveLoanAtSeasonEnd, expireClausesForSeason, processFutureContractAgreementsAtSeasonEnd, expireProtectiveClausesForSeason, returnLoanSwapPlayersHome, createSeasonTransferWindows, refreshTransferWindowsStatus, processNegotiationDeadlines, processIncomingOfferDeadlines, getActiveTransferWindow, isTransferWindowOpen, isCompetitionEligibleNegotiation, ensurePlayerAgentProfile, processTransferCompetitionTick } from '../../utils/transferDeals';
import { processOutgoingMarketTick } from '../../utils/outgoingMarket';
import { advanceRivalMemoriesSeason, evaluateRivalAdaptation, evolveRivalAfterMatch, getRivalMemoryForClub, upsertRivalMemory } from '../../utils/rivalAI';
import { advanceSeasonNarrative, startNextSeasonNarrative, getSeasonLabel } from '../../utils/seasonNarrative';
import { applyMatchToPlayerSeasonStats, applySimulatedRoundToPlayerSeasonStats } from '../../utils/playerSeasonStats';
import { evaluateTeamDNAForMatch, evolveTeamDNAAfterMatch, evolveTeamDNAEndOfSeason, TEAM_DNA_DEFINITIONS } from '../../utils/teamDNA';
import { buildLineup, evaluateTactic, POSITION_PRESETS, TacticalEvaluation } from '../../utils/tacticsEngine';
import TeamLogo from '../common/TeamLogo';
import ClubInfoModal from '../common/ClubInfoModal';
import PlayerProfileModal from '../common/PlayerProfileModal';
import PitchRenderer, { PitchOverlayState } from './PitchRenderer';
import MatchPlaybackControls, { ReplaySpeed } from './MatchPlaybackControls';
import { buildMatchReplay, buildTimelineMarkers, getReplayPhaseLabel, interpolateReplayFrame } from '../../utils/matchReplayEngine';

interface MatchCenterProps {
  players: Player[];
  calendar: Match[];
  setCalendar: (c: Match[]) => void;
  standings: Standing[];
  setStandings: (s: Standing[]) => void;
  budget: number;
  setBudget: (b: number) => void;
  setPlayers: (p: Player[]) => void;
  onNavigate: (tab: string) => void;
  addNewNews: (title: string, content: string, cat: 'board' | 'training' | 'market' | 'league') => void;
  addClubMemory: (memory: ClubMemoryDraft) => void;
  teamDNA: TeamDNAState;
  setTeamDNA: (dna: TeamDNAState) => void;
  starters: string[];
  bench: string[];
  setStarters: (ids: string[]) => void;
  setBench: (ids: string[]) => void;
  tactic: Tactic;
  saveTactic: (tactic: Tactic) => void;
  teamName: string;
  clubWorld: ClubAIState[];
  setClubWorld: (world: ClubAIState[]) => void;
  playerStats: PlayerSeasonStat[];
  setPlayerStats: React.Dispatch<React.SetStateAction<PlayerSeasonStat[]>>;
  rivalMemories: RivalTacticalMemory[];
  setRivalMemories: React.Dispatch<React.SetStateAction<RivalTacticalMemory[]>>;
  seasonNarrative: SeasonNarrativeState;
  setSeasonNarrative: React.Dispatch<React.SetStateAction<SeasonNarrativeState>>;
  clubHistory: ClubHistoryState;
  setClubHistory: React.Dispatch<React.SetStateAction<ClubHistoryState>>;
  emotionalNarratives: EmotionalNarrativeState;
  setEmotionalNarratives: React.Dispatch<React.SetStateAction<EmotionalNarrativeState>>;
  careerWorld: CareerWorldState;
  setCareerWorld: React.Dispatch<React.SetStateAction<CareerWorldState>>;
  playerConversations: PlayerConversationState;
  setPlayerConversations: React.Dispatch<React.SetStateAction<PlayerConversationState>>;
  leagueSystem: LeagueSystemState | null;
  setLeagueSystem: React.Dispatch<React.SetStateAction<LeagueSystemState | null>>;
  scoutedTargets: Negotiation[];
  setScoutedTargets: (targets: Negotiation[]) => void;
  incomingOffers: IncomingTransferOffer[];
  setIncomingOffers: (offers: IncomingTransferOffer[]) => void;
}

type SimSpeed = 1 | 2 | 4 | 8;

interface LiveActionFrame {
  teamHasBall: boolean;
  phase: string;
  lane: 'Sinistra' | 'Centro' | 'Destra';
  ball: { x: number; y: number };
  sequence: { x: number; y: number }[];
  steps: { label: string; text: string }[];
  activeRoles: Player['role'][];
  adherence: number;
  reading: string;
  color: string;
  defensiveLineY: number;
  pressingLineY: number;
  shapeLabel: string;
}

interface GoalFlash {
  id: number;
  team: 'user' | 'opponent';
  minute: number;
  title: string;
  detail: string;
}

const speedDelays: Record<SimSpeed, number> = {
  1: 420,
  2: 220,
  4: 110,
  8: 55
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const indexRandom = (max: number) => Math.floor(Math.random() * Math.max(max, 1));
const averageNumber = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const playerShortName = (name: string) => name.split(' ').slice(-1)[0] ?? name;

interface MatchPlanReading {
  label: string;
  attackSwing: number;
  defenseSwing: number;
  possessionSwing: number;
  riskSwing: number;
  description: string;
}

const getCurrentMatchPlan = (
  tactic: Tactic,
  scoreUser: number,
  scoreOpponent: number,
  userRedCards: number
): MatchPlanReading => {
  const basePlan = scoreUser > scoreOpponent
    ? tactic.gamePlan?.whenLeading ?? 'Equilibrio'
    : scoreUser < scoreOpponent
      ? tactic.gamePlan?.whenTrailing ?? 'Spingi'
      : 'Equilibrio';

  if (userRedCards > 0) {
    const redPlan = tactic.gamePlan?.whenRedCard ?? 'Compatto';
    if (redPlan === 'Blocco basso') {
      return {
        label: 'Rosso: blocco basso',
        attackSwing: -8,
        defenseSwing: 8,
        possessionSwing: -3,
        riskSwing: -9,
        description: 'Inferiorita numerica gestita abbassando squadra e rischio.'
      };
    }
    if (redPlan === 'Rischia') {
      return {
        label: 'Rosso: rischia',
        attackSwing: 4,
        defenseSwing: -7,
        possessionSwing: 1,
        riskSwing: 9,
        description: 'Anche in dieci provi a restare alto: piu occasioni, ma campo aperto.'
      };
    }
    return {
      label: 'Rosso: compatto',
      attackSwing: -4,
      defenseSwing: 4,
      possessionSwing: -1,
      riskSwing: -4,
      description: 'La squadra resta compatta e sceglie meglio quando uscire.'
    };
  }

  if (basePlan === 'Proteggi') {
    return {
      label: 'Proteggi vantaggio',
      attackSwing: -5,
      defenseSwing: 5,
      possessionSwing: -1,
      riskSwing: -6,
      description: 'Meno uomini sopra palla: riduci transizioni subite, ma produci meno.'
    };
  }

  if (basePlan === 'Spingi') {
    return {
      label: 'Spingi',
      attackSwing: 6,
      defenseSwing: -4,
      possessionSwing: 2,
      riskSwing: 7,
      description: 'Aumenti ritmo e uomini in area: piu tiri, piu spazio alle spalle.'
    };
  }

  return {
    label: 'Equilibrio',
    attackSwing: 0,
    defenseSwing: 0,
    possessionSwing: 0,
    riskSwing: 0,
    description: 'Mantieni distanze e rischi coerenti con la tattica base.'
  };
};

const buildPostMatchAnalysis = ({
  scoreUser,
  scoreOpponent,
  stats,
  tactic,
  report,
  matchPlan,
  rivalAdaptation,
  startingPlayers,
  opponentName
}: {
  scoreUser: number;
  scoreOpponent: number;
  stats: MatchStats;
  tactic: Tactic;
  report: TacticalEvaluation;
  matchPlan: MatchPlanReading;
  rivalAdaptation: ReturnType<typeof evaluateRivalAdaptation>;
  startingPlayers: Player[];
  opponentName: string;
}) => {
  const analysis: string[] = [];
  const lost = scoreUser < scoreOpponent;
  const won = scoreUser > scoreOpponent;
  const strikerPower = averageNumber(startingPlayers.filter(player => player.role === 'ST').map(player => player.overall));
  const midfieldPower = averageNumber(startingPlayers.filter(player => ['DM', 'CM', 'AM'].includes(player.role)).map(player => player.overall));

  if (lost && stats.xGOpponent > stats.xGUser + 0.35 && tactic.defensiveLine > 65 && !tactic.principles?.includes('manMarkKey')) {
    analysis.push(`Hai perso perche il loro trequartista riceveva tra le linee: linea alta, mediano troppo aggressivo e nessun marcatore chiave su quella zona.`);
  }

  if (report.opponentRisk >= 70) {
    analysis.push(`Il rischio difensivo era alto (${report.opponentRisk}/100): quando perdevi palla, ${opponentName} trovava campo alle spalle dei centrocampisti.`);
  }

  if (stats.possession >= 56 && stats.shotsUser <= Math.max(5, stats.shotsOpponent) && !won) {
    analysis.push('Il possesso e stato sterile: hai tenuto palla, ma ritmo e verticalita non hanno trasformato il controllo in tiri puliti.');
  }

  if (tactic.chanceCreation === 'Cross' && strikerPower > 0 && strikerPower < 76) {
    analysis.push('Hai cercato tanti cross senza una punta dominante: il piano ha riempito le fasce, ma non abbastanza l area.');
  }

  if (tactic.principles?.includes('falseNine') && tactic.chanceCreation === 'Cross') {
    analysis.push('Falso nove e cross si sono pestati i piedi: la punta veniva incontro proprio mentre serviva presenza in area.');
  }

  if (rivalAdaptation.adaptationScore >= 65) {
    analysis.push(`Il rivale ti ha letto bene: ${rivalAdaptation.plannedResponse}`);
  }

  if (report.automatisms < 45) {
    analysis.push('Gli automatismi bassi hanno pesato: il piano si vedeva, ma tempi di uscita e distanze non erano ancora naturali.');
  }

  if (won && stats.xGUser >= stats.xGOpponent + 0.25) {
    analysis.push(`Hai vinto con merito: piano ${matchPlan.label.toLowerCase()}, compatibilita ${report.compatibility}% e qualita occasioni ${report.chanceQuality}/100 hanno prodotto tiri migliori.`);
  } else if (won && stats.xGUser < stats.xGOpponent) {
    analysis.push('Hai vinto, ma il risultato e stato piu cinico che dominante: l analisi suggerisce di ridurre il rischio con la palla scoperta.');
  }

  if (analysis.length === 0) {
    analysis.push(midfieldPower >= 78
      ? 'La partita e stata equilibrata: il centrocampo ha tenuto il piano, ma servono principi piu netti per creare un vantaggio chiaro.'
      : 'La partita e stata decisa dai dettagli: aumenta compatibilita ruoli e automatismi prima di alzare ulteriormente il rischio.');
  }

  return analysis.slice(0, 4);
};

const buildActionFrame = (
  minute: number,
  stats: MatchStats,
  tactic: Tactic,
  report: TacticalEvaluation,
  matchEdge: number
): LiveActionFrame => {
  const cycle = minute % 12;
  const principles = tactic.principles ?? [];
  const plannedWide = tactic.attackingFocus === 'Fasce' || tactic.chanceCreation === 'Cross' || principles.includes('overlaps');
  const centralPlan = tactic.attackingFocus === 'Centro' || tactic.chanceCreation === 'Passaggi Filtranti' || tactic.chanceCreation === 'Tiri da Fuori' || principles.includes('falseNine');
  const sideLane: LiveActionFrame['lane'] = Math.floor(minute / 8) % 2 === 0 ? 'Sinistra' : 'Destra';
  const lane: LiveActionFrame['lane'] = plannedWide ? sideLane : centralPlan ? 'Centro' : cycle < 6 ? 'Centro' : sideLane;
  const possessionPulse = stats.possession + Math.sin(minute / 4) * 6 + matchEdge * 0.15;
  const teamHasBall = possessionPulse >= 50 || (cycle < 8 && stats.possession >= 47);
  const laneX = lane === 'Sinistra' ? 22 : lane === 'Destra' ? 78 : 50;

  let phase = 'Difesa posizionale';
  let ball = { x: laneX, y: 62 };
  let sequence: { x: number; y: number }[] = [{ x: 50, y: 84 }, { x: 50, y: 64 }, ball];
  let activeRoles: Player['role'][] = ['CB', 'DM', 'CM'];

  if (teamHasBall) {
    if (cycle < 3) {
      phase = principles.includes('deepPlaymaker') && tactic.buildUp !== 'Lancio Lungo'
        ? 'Regista basso in uscita'
        : tactic.buildUp === 'Lancio Lungo' ? 'Lancio sulla profondita' : tactic.buildUp === 'Manovrata' ? 'Costruzione dal basso' : 'Uscita mista';
      ball = { x: tactic.buildUp === 'Lancio Lungo' ? laneX : 50, y: tactic.buildUp === 'Lancio Lungo' ? 48 : 68 };
      sequence = tactic.buildUp === 'Lancio Lungo'
        ? [{ x: 50, y: 84 }, { x: laneX, y: 52 }, ball]
        : [{ x: 50, y: 86 }, { x: 42, y: 72 }, { x: 50, y: 60 }, ball];
      activeRoles = tactic.buildUp === 'Lancio Lungo' ? ['GK', 'CB', 'ST', 'LW', 'RW'] : ['GK', 'CB', 'DM', 'CM'];
    } else if (cycle < 7) {
      phase = plannedWide ? `Sviluppo sulla ${lane.toLowerCase()}` : 'Rifinitura centrale';
      ball = { x: laneX, y: 38 };
      sequence = plannedWide
        ? [{ x: 50, y: 70 }, { x: lane === 'Sinistra' ? 16 : 84, y: 56 }, ball]
        : [{ x: 50, y: 70 }, { x: 50, y: 52 }, ball];
      activeRoles = plannedWide
        ? lane === 'Sinistra' ? ['LB', 'LW', 'CM', 'ST'] : ['RB', 'RW', 'CM', 'ST']
        : ['DM', 'CM', 'AM', 'ST'];
    } else if (cycle < 10) {
      phase =
        principles.includes('falseNine') && tactic.chanceCreation !== 'Cross' ? 'Falso nove tra le linee' :
        principles.includes('mezzalaRuns') && tactic.chanceCreation !== 'Cross' ? 'Mezzala attacca l area' :
        tactic.chanceCreation === 'Cross' ? `Cross dalla ${lane.toLowerCase()}` :
        tactic.chanceCreation === 'Tagli Interni' ? 'Taglio interno tra le linee' :
        tactic.chanceCreation === 'Tiri da Fuori' ? 'Tiro preparato dal limite' :
        'Passaggio filtrante';
      ball = {
        x: tactic.chanceCreation === 'Cross' ? laneX : tactic.chanceCreation === 'Tiri da Fuori' ? 50 : laneX,
        y: tactic.chanceCreation === 'Tiri da Fuori' ? 30 : 18
      };
      sequence =
        tactic.chanceCreation === 'Cross' ? [{ x: 50, y: 58 }, { x: laneX, y: 30 }, { x: laneX, y: 18 }, { x: 50, y: 12 }] :
        tactic.chanceCreation === 'Passaggi Filtranti' ? [{ x: 50, y: 55 }, { x: 50, y: 36 }, { x: 50, y: 14 }] :
        [{ x: laneX, y: 48 }, { x: 50, y: 34 }, ball];
      activeRoles =
        principles.includes('falseNine') && tactic.chanceCreation !== 'Cross' ? ['ST', 'AM', 'CM', 'LW', 'RW'] :
        principles.includes('mezzalaRuns') && tactic.chanceCreation !== 'Cross' ? ['CM', 'AM', 'ST'] :
        tactic.chanceCreation === 'Cross' ? lane === 'Sinistra' ? ['LB', 'LW', 'ST'] : ['RB', 'RW', 'ST'] :
        tactic.chanceCreation === 'Tiri da Fuori' ? ['CM', 'AM', 'ST'] :
        ['AM', 'LW', 'RW', 'ST'];
    } else {
      phase = tactic.transition === 'Contropiede' ? 'Transizione rapida' : 'Riciclo del possesso';
      ball = { x: laneX, y: tactic.transition === 'Contropiede' ? 26 : 44 };
      sequence = tactic.transition === 'Contropiede'
        ? [{ x: 48, y: 74 }, { x: laneX, y: 46 }, ball]
        : [{ x: laneX, y: 34 }, { x: 50, y: 46 }, ball];
      activeRoles = tactic.transition === 'Contropiede' ? ['DM', 'LW', 'RW', 'ST'] : ['DM', 'CM', 'AM'];
    }
  } else {
    phase = tactic.pressing > 72 ? 'Pressing sul portatore' : tactic.defensiveLine < 45 ? 'Blocco basso compatto' : 'Riordino difensivo';
    ball = { x: cycle < 6 ? 36 : 64, y: tactic.defensiveLine > 70 ? 56 : 68 };
    sequence = [{ x: 50, y: 22 }, { x: ball.x, y: 42 }, ball];
    activeRoles = tactic.pressing > 72 ? ['ST', 'LW', 'RW', 'AM', 'CM'] : ['CB', 'LB', 'RB', 'DM'];
  }

  let planBonus = 0;
  if (teamHasBall && plannedWide && lane !== 'Centro') planBonus += 8;
  if (teamHasBall && centralPlan && lane === 'Centro') planBonus += 8;
  if (teamHasBall && tactic.buildUp === 'Manovrata' && phase.includes('Costruzione')) planBonus += 6;
  if (teamHasBall && principles.includes('deepPlaymaker') && phase.includes('Regista')) planBonus += 6;
  if (teamHasBall && principles.includes('falseNine') && phase.includes('Falso')) planBonus += 6;
  if (teamHasBall && principles.includes('mezzalaRuns') && phase.includes('Mezzala')) planBonus += 5;
  if (teamHasBall && tactic.buildUp === 'Lancio Lungo' && phase.includes('Lancio')) planBonus += 6;
  if (!teamHasBall && principles.includes('manMarkKey') && report.opponentRisk < 66) planBonus += 4;
  if (!teamHasBall && tactic.pressing > 72 && phase.includes('Pressing')) planBonus += 7;
  if (!teamHasBall && tactic.defensiveLine < 45 && phase.includes('Blocco basso')) planBonus += 6;
  if (report.opponentRisk > 66 && !teamHasBall) planBonus -= 10;
  if (report.compatibility < 70) planBonus -= 8;

  const adherence = Math.round(clamp(
    report.compatibility * 0.48 +
    report.cohesion * 0.24 +
    report.matchScore * 0.18 +
    report.automatisms * 0.08 +
    planBonus +
    (stats.possession - 50) * 0.18,
    32,
    96
  ));
  const reading =
    adherence >= 78 ? 'La squadra sta rispettando distanze, zona palla e intenzione tattica.' :
    adherence >= 62 ? 'L idea si vede, ma alcune distanze o scelte tecniche sono ancora sporche.' :
    'La squadra sta uscendo dal piano: reparti lunghi o movimenti poco coerenti.';
  const color = adherence >= 78 ? 'var(--color-pitch)' : adherence >= 62 ? 'var(--color-gold)' : 'var(--color-danger)';
  const defensiveLineY = clamp(82 - tactic.defensiveLine * 0.42, 38, 76);
  const pressingLineY = clamp(72 - tactic.pressing * 0.42, 24, 70);
  const shapeLabel = tactic.width >= 68 ? 'molto larga' : tactic.width <= 38 ? 'stretta' : 'equilibrata';
  const steps = teamHasBall ? [
    {
      label: '1. Uscita',
      text: tactic.buildUp === 'Manovrata' ? 'palla bassa e centrocampista vicino' : tactic.buildUp === 'Lancio Lungo' ? 'palla subito in avanti' : 'uscita alternata'
    },
    {
      label: '2. Sviluppo',
      text: lane === 'Centro' ? 'si cerca il centro' : `si attacca a ${lane.toLowerCase()}`
    },
    {
      label: '3. Obiettivo',
      text:
        tactic.chanceCreation === 'Cross' ? 'cross per la punta' :
        tactic.chanceCreation === 'Tagli Interni' ? 'taglio dentro l area' :
        tactic.chanceCreation === 'Tiri da Fuori' ? 'tiro dal limite' :
        'imbucata filtrante'
    }
  ] : [
    {
      label: '1. Non possesso',
      text: tactic.pressing > 72 ? 'pressione immediata' : tactic.defensiveLine < 45 ? 'squadra bassa' : 'squadra ordinata'
    },
    {
      label: '2. Distanze',
      text: tactic.width >= 68 ? 'reparti larghi' : tactic.width <= 38 ? 'reparti stretti' : 'distanze medie'
    },
    {
      label: '3. Rischio',
      text: report.opponentRisk > 66 ? 'spazio concesso' : 'copertura accettabile'
    }
  ];

  return { teamHasBall, phase, lane, ball, sequence, steps, activeRoles, adherence, reading, color, defensiveLineY, pressingLineY, shapeLabel };
};

const emptyStats = (): MatchStats => ({
  possession: 50,
  shotsUser: 0,
  shotsOpponent: 0,
  shotsOnTargetUser: 0,
  shotsOnTargetOpponent: 0,
  xGUser: 0,
  xGOpponent: 0,
  foulsUser: 0,
  foulsOpponent: 0
});

const createLineupIds = (players: Player[], module: Tactic['module'] = '4-3-3') => {
  const used = new Set<string>();
  const slots = POSITION_PRESETS[module].map(slot => {
    const role = slot.role;
    if (role === 'LB') return ['LB', 'CB'] as Player['role'][];
    if (role === 'RB') return ['RB', 'CB'] as Player['role'][];
    if (role === 'DM') return ['DM', 'CM'] as Player['role'][];
    if (role === 'CM') return ['CM', 'DM', 'AM'] as Player['role'][];
    if (role === 'AM') return ['AM', 'CM', 'LW', 'RW'] as Player['role'][];
    if (role === 'LW') return ['LW', 'AM', 'ST'] as Player['role'][];
    if (role === 'RW') return ['RW', 'AM', 'ST'] as Player['role'][];
    if (role === 'ST') return ['ST', 'LW', 'RW'] as Player['role'][];
    return [role] as Player['role'][];
  });

  return slots.map(roles => {
    const pick = players
      .filter(player => roles.includes(player.role) && !used.has(player.id))
      .sort((a, b) => b.overall - a.overall)[0] ?? players.filter(player => !used.has(player.id)).sort((a, b) => b.overall - a.overall)[0];
    if (pick) used.add(pick.id);
    return pick?.id;
  }).filter(Boolean) as string[];
};

interface LiveTacticalBoardProps {
  lineup: Player[];
  opponentLineup: Player[];
  tactic: Tactic;
  report: TacticalEvaluation;
  stats: MatchStats;
  minute: number;
  matchEdge: number;
  teamName: string;
  opponentName: string;
  opponentModule: Tactic['module'];
  gameState: 'playing' | 'finished';
  matchId: string;
  events: MatchEvent[];
  userBench: Player[];
  opponentBench: Player[];
  userColors: { primary: string; secondary: string };
  opponentColors: { primary: string; secondary: string };
}

function LiveTacticalBoard({
  lineup,
  opponentLineup,
  tactic,
  report,
  stats,
  minute,
  matchEdge,
  teamName,
  opponentName,
  opponentModule,
  gameState,
  matchId,
  events,
  userBench,
  opponentBench,
  userColors,
  opponentColors
}: LiveTacticalBoardProps) {
  const userSquad = useMemo(() => [...lineup, ...userBench], [lineup, userBench]);
  const opponentSquad = useMemo(() => [...opponentLineup, ...opponentBench], [opponentLineup, opponentBench]);
  const matchReplay = useMemo(
    () => buildMatchReplay({
      matchId,
      tactic,
      opponentModule,
      userLineup: lineup,
      opponentLineup,
      userSquad,
      opponentSquad,
      events,
      durationMinutes: Math.max(minute, 1)
    }),
    [matchId, tactic, opponentModule, lineup, opponentLineup, userSquad, opponentSquad, events, minute]
  );
  const [playback, setPlayback] = useState<{ currentSecond: number; playing: boolean; speed: ReplaySpeed }>(
    { currentSecond: 0, playing: true, speed: 0.75 }
  );
  const [overlays, setOverlays] = useState<PitchOverlayState>({
    passes: true,
    pressing: true,
    defensiveLine: true,
    width: false,
    depth: false,
    names: false
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const interpolatedFrame = useMemo(
    () => interpolateReplayFrame(matchReplay.frames, playback.currentSecond),
    [matchReplay, playback.currentSecond]
  );
  const timelineMarkers = useMemo(() => buildTimelineMarkers(matchId, events, matchReplay), [matchId, events, matchReplay]);

  // Stato autoritativo della partita reale (MatchCenter): il replay non deve mai vivere oltre di esso.
  const isMatchFinished = gameState === 'finished';
  const isAuthoritativeMatchRunning = gameState === 'playing';

  // Al fischio finale: ferma per sempre l'orologio del replay e blocca palla/giocatori sull'ultimo frame
  // coerente. Gira una sola volta per partita (gameState/duration non cambiano piu' dopo il fischio finale),
  // quindi non impedisce un restart/play manuale successivo dell'utente.
  useEffect(() => {
    if (!isMatchFinished) return;
    setPlayback(prev => (
      prev.playing || prev.currentSecond < matchReplay.durationSeconds
        ? { ...prev, playing: false, currentSecond: matchReplay.durationSeconds }
        : prev
    ));
  }, [isMatchFinished, matchReplay.durationSeconds]);

  const handleTick = useCallback((nextSecond: number) => setPlayback(prev => ({ ...prev, currentSecond: nextSecond })), []);
  const handleTogglePlay = useCallback(() => setPlayback(prev => ({ ...prev, playing: !prev.playing })), []);
  const handleSpeedChange = useCallback((speed: ReplaySpeed) => setPlayback(prev => ({ ...prev, speed })), []);
  const handleSeek = useCallback(
    (seconds: number) => setPlayback(prev => ({ ...prev, currentSecond: clamp(seconds, 0, matchReplay.durationSeconds) })),
    [matchReplay.durationSeconds]
  );
  const handleRestart = useCallback(() => setPlayback(prev => ({ ...prev, currentSecond: 0 })), []);
  const toggleOverlay = useCallback((key: keyof PitchOverlayState) => (
    setOverlays(prev => ({ ...prev, [key]: !prev[key] }))
  ), []);

  const possessionLabel = interpolatedFrame?.possessionTeamId === 'user'
    ? teamName
    : interpolatedFrame?.possessionTeamId === 'opponent'
      ? opponentName
      : 'Fase equilibrata';
  const phaseLabel = isMatchFinished && playback.currentSecond >= matchReplay.durationSeconds - 0.05
    ? 'Finale'
    : interpolatedFrame ? getReplayPhaseLabel(interpolatedFrame.phase) : 'In attesa';

  const frame = useMemo(
    () => buildActionFrame(minute, stats, tactic, report, matchEdge),
    [matchEdge, minute, report, stats, tactic]
  );
  const slots = POSITION_PRESETS[tactic.module];
  const opponentSlots = POSITION_PRESETS[opponentModule];
  const compactness = Math.round(clamp(
    96 - Math.abs(tactic.width - 50) * 0.65 - Math.max(0, tactic.riskLevel - 64) * 0.35 + report.compatibility * 0.12,
    42,
    98
  ));
  const phaseIntensity = gameState === 'playing' ? 1 : 0.25;

  const getPlayerTarget = (slot: typeof slots[number], index: number) => {
    const role = slot.role;
    const widthScale = 0.68 + tactic.width / 118;
    let x = 50 + (slot.x - 50) * widthScale;
    let y = slot.y + (50 - tactic.defensiveLine) * 0.12;

    if (frame.teamHasBall) {
      y -= tactic.mentality === 'Offensiva' ? 7 : tactic.mentality === 'Difensiva' ? 2 : 4;
      if (role === 'LB' || role === 'RB') {
        y -= tactic.attackingFocus === 'Fasce' || tactic.chanceCreation === 'Cross' ? 10 : 5;
        x += role === 'LB' ? -4 : 4;
      }
      if (role === 'LW' || role === 'RW') {
        if (tactic.chanceCreation === 'Tagli Interni') x += role === 'LW' ? 14 : -14;
        if (tactic.chanceCreation === 'Cross') x += role === 'LW' ? -8 : 8;
        y -= 6;
      }
      if (role === 'AM' || role === 'CM') {
        if (tactic.buildUp === 'Manovrata') y += 2;
        if (tactic.chanceCreation === 'Tiri da Fuori') y -= 7;
      }
      if (role === 'ST') y -= tactic.riskLevel > 62 ? 5 : 2;
    } else {
      x = 50 + (x - 50) * 0.72;
      y += tactic.mentality === 'Difensiva' ? 6 : 3;
      if (tactic.pressing > 72 && ['ST', 'LW', 'RW', 'AM'].includes(role)) y -= 12;
      if (tactic.defensiveLine < 45 && ['CB', 'LB', 'RB', 'DM'].includes(role)) y += 6;
    }

    x += Math.sin((minute + index) * 0.68) * phaseIntensity * 0.9;
    y += Math.cos((minute + index) * 0.55) * phaseIntensity * 0.85;

    return {
      x: clamp(x, 8, 92),
      y: clamp(y, 8, 92)
    };
  };

  const playerMarkers = lineup.slice(0, 11).map((player, index) => {
    const slot = slots[index] ?? slots[slots.length - 1];
    const target = getPlayerTarget(slot, index);
    const fit = report.slotFits[index];
    const active = frame.activeRoles.includes(slot.role) || frame.activeRoles.includes(player.role);
    return { player, slot, target, fit, active };
  });

  const opponentMarkers = opponentLineup.slice(0, 11).map((player, index) => {
    const slot = opponentSlots[index] ?? opponentSlots[opponentSlots.length - 1];
    const baseY = 100 - slot.y;
    const target = {
      x: clamp(50 + (slot.x - 50) * (frame.teamHasBall ? 0.78 : 0.92), 8, 92),
      y: clamp(baseY + (frame.teamHasBall ? -5 : 7) + Math.sin((minute + index) * 0.44) * phaseIntensity, 8, 92)
    };
    return { player, target, index };
  }).filter(({ index }) => [1, 2, 5, 7, 8, 9].includes(index));

  const sequencePath = frame.sequence.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  const gk = lineup.find(player => player.role === 'GK');
  const deepBuilder = tactic.buildUp === 'Manovrata'
    ? lineup.find(player => player.role === 'CB')
    : lineup.find(player => player.role === 'DM') ?? lineup.find(player => player.role === 'CM');
  const wideOutlet = frame.lane === 'Sinistra'
    ? lineup.find(player => player.role === 'LB') ?? lineup.find(player => player.role === 'LW')
    : frame.lane === 'Destra'
      ? lineup.find(player => player.role === 'RB') ?? lineup.find(player => player.role === 'RW')
      : lineup.find(player => player.role === 'CM') ?? lineup.find(player => player.role === 'AM');
  const finisher =
    tactic.chanceCreation === 'Cross' ? lineup.find(player => player.role === 'ST') :
    tactic.chanceCreation === 'Tagli Interni' ? (frame.lane === 'Sinistra' ? lineup.find(player => player.role === 'LW') : lineup.find(player => player.role === 'RW')) ?? lineup.find(player => player.role === 'AM') :
    tactic.chanceCreation === 'Tiri da Fuori' ? lineup.find(player => player.role === 'AM') ?? lineup.find(player => player.role === 'CM') :
    lineup.find(player => player.role === 'AM') ?? lineup.find(player => player.role === 'ST');
  const presser = tactic.pressing > 72
    ? lineup.find(player => ['ST', 'LW', 'RW'].includes(player.role))
    : lineup.find(player => ['CB', 'DM'].includes(player.role));
  const coverDefender = lineup.find(player => player.role === 'CB');
  const opponentCarrier = opponentLineup.find(player => ['AM', 'CM', 'ST', 'LW', 'RW'].includes(player.role)) ?? opponentLineup[0];

  const narratedSteps = frame.teamHasBall ? [
    {
      label: '1. Uscita',
      text: tactic.buildUp === 'Manovrata'
        ? `${gk?.name ?? 'Il portiere'} appoggia corto, ${deepBuilder?.name ?? 'un difensore'} imposta con calma.`
        : tactic.buildUp === 'Lancio Lungo'
          ? `${gk?.name ?? 'Il portiere'} lancia lungo, si salta la costruzione.`
          : `${deepBuilder?.name ?? 'Un centrocampista'} scende a prendere palla e detta il ritmo.`
    },
    {
      label: '2. Sviluppo',
      text: frame.lane === 'Centro'
        ? `${wideOutlet?.name ?? 'La squadra'} cerca profondita per vie centrali.`
        : `${wideOutlet?.name ?? 'Un esterno'} avanza sulla fascia ${frame.lane.toLowerCase()}.`
    },
    {
      label: '3. Obiettivo',
      text:
        tactic.chanceCreation === 'Cross' ? `Cross previsto per ${finisher?.name ?? 'la punta'}.` :
        tactic.chanceCreation === 'Tagli Interni' ? `${finisher?.name ?? 'Un esterno'} punta il taglio interno.` :
        tactic.chanceCreation === 'Tiri da Fuori' ? `${finisher?.name ?? 'Un centrocampista'} prepara il tiro dal limite.` :
        `Si cerca il filtrante per ${finisher?.name ?? 'la punta'}.`
    }
  ] : [
    {
      label: '1. Non possesso',
      text: tactic.pressing > 72
        ? `${presser?.name ?? 'La squadra'} pressa ${opponentCarrier?.name ?? 'il portatore avversario'}.`
        : tactic.defensiveLine < 45
          ? `${presser?.name ?? 'La difesa'} resta bassa e compatta.`
          : `${presser?.name ?? 'La squadra'} mantiene ordine e distanze.`
    },
    {
      label: '2. Distanze',
      text: tactic.width >= 68 ? 'I reparti restano larghi per coprire il campo.' : tactic.width <= 38 ? 'I reparti si stringono per non lasciare spazi centrali.' : 'Le distanze tra reparti sono equilibrate.'
    },
    {
      label: '3. Rischio',
      text: report.opponentRisk > 66
        ? `${coverDefender?.name ?? 'La difesa'} rischia di lasciare spazio alle spalle.`
        : `${coverDefender?.name ?? 'La difesa'} copre la profondita senza affanni.`
    }
  ];

  const phaseCategory = frame.teamHasBall
    ? (frame.phase.includes('Uscita') || frame.phase.includes('Regista') || frame.phase.includes('Lancio') || frame.phase.includes('Costruzione'))
      ? 'buildup'
      : (frame.phase.includes('Sviluppo') || frame.phase.includes('Rifinitura'))
        ? 'development'
        : (frame.phase.includes('Transizione') || frame.phase.includes('Riciclo'))
          ? 'transition'
          : 'finishing'
    : 'defensive';

  const nowSentence =
    phaseCategory === 'buildup' ? `${deepBuilder?.name ?? gk?.name ?? 'La squadra'} fa ripartire l azione dal basso.` :
    phaseCategory === 'development' ? `${wideOutlet?.name ?? 'Un giocatore'} porta palla avanti, si cerca spazio ${frame.lane === 'Centro' ? 'al centro' : `sulla fascia ${frame.lane.toLowerCase()}`}.` :
    phaseCategory === 'finishing' ? `${finisher?.name ?? 'La squadra'} rifinisce l azione verso la porta.` :
    phaseCategory === 'transition' ? `${wideOutlet?.name ?? finisher?.name ?? 'La squadra'} riparte veloce in transizione.` :
    `${presser?.name ?? 'La squadra'} si oppone a ${opponentCarrier?.name ?? opponentName}.`;

  return (
    <div className="card-premium live-tactical-card">
      <div className="live-tactical-header">
        <div>
          <h3>Cosa sta succedendo in campo</h3>
          <p>Segui palla, reparto coinvolto e quanto la squadra rispetta il piano.</p>
        </div>
        <div className="live-tactical-score" style={{ borderColor: frame.color }}>
          <span>Fedelta piano</span>
          <strong style={{ color: frame.color }}>{frame.adherence}%</strong>
        </div>
      </div>

      <div className="live-action-steps">
        {narratedSteps.map(step => (
          <div key={step.label}>
            <span>{step.label}</span>
            <strong>{step.text}</strong>
          </div>
        ))}
      </div>

      <div className="pitch-viewer-shell">
        <div className="pitch-overlay-toggles" role="group" aria-label="Overlay tattici">
          {([
            ['passes', 'Passaggi'],
            ['pressing', 'Pressing'],
            ['defensiveLine', 'Linea difensiva'],
            ['width', 'Ampiezza'],
            ['depth', 'Profondita'],
            ['names', 'Nomi giocatori']
          ] as [keyof PitchOverlayState, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`pitch-overlay-toggle${overlays[key] ? ' active' : ''}`}
              aria-pressed={overlays[key]}
              onClick={() => toggleOverlay(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <PitchRenderer
          frame={interpolatedFrame}
          teamA={{ primary: userColors.primary, secondary: userColors.secondary, label: teamName }}
          teamB={{ primary: opponentColors.primary, secondary: opponentColors.secondary, label: opponentName }}
          overlays={overlays}
          selectedPlayerId={selectedPlayerId}
          onSelectPlayer={setSelectedPlayerId}
          authoritativeMatchStatus={gameState}
          authoritativeMinute={minute}
          isAuthoritativeMatchRunning={isAuthoritativeMatchRunning}
          isAuthoritativePaused={false}
          isMatchFinished={isMatchFinished}
        />

        <MatchPlaybackControls
          currentSecond={playback.currentSecond}
          durationSeconds={matchReplay.durationSeconds}
          playing={playback.playing}
          speed={playback.speed}
          phaseLabel={phaseLabel}
          possessionLabel={possessionLabel}
          markers={timelineMarkers}
          onTick={handleTick}
          onTogglePlay={handleTogglePlay}
          onSpeedChange={handleSpeedChange}
          onSeekSeconds={handleSeek}
          onRestart={handleRestart}
        />
      </div>

      <div className="live-tactical-readout">
        <div>
          <span>Fase azione</span>
          <strong>{frame.phase}</strong>
          <p>{frame.reading}</p>
        </div>
        <div className="live-tactical-meter">
          <div>
            <span>{teamName}</span>
            <strong>{frame.teamHasBall ? 'in possesso' : `${opponentName} in possesso`}</strong>
          </div>
          <div className="live-meter-track">
            <motion.div animate={{ width: `${frame.adherence}%` }} style={{ backgroundColor: frame.color }} />
          </div>
        </div>
      </div>

      <div className="live-tactical-tags">
        <span>Ampiezza {frame.shapeLabel}</span>
        <span>Zona {frame.lane}</span>
        <span>Compattezza {compactness}%</span>
        <span>Modulo {tactic.module}</span>
        <span>Rivale {opponentModule}</span>
      </div>

      <div className="live-legend">
        <span><i className="live-legend-swatch defense" />Linea difensiva</span>
        <span><i className="live-legend-swatch press" />Linea di pressing</span>
        <span><i className="live-legend-swatch fit-ok" />Ruolo adatto</span>
        <span><i className="live-legend-swatch fit-bad" />Fuori ruolo</span>
        <span><i className="live-legend-swatch opponent" />{opponentName}{frame.teamHasBall ? ' in pressing' : ' in possesso'}</span>
      </div>
    </div>
  );
}

export default function MatchCenter({
  players,
  calendar,
  setCalendar,
  standings,
  setStandings,
  budget,
  setBudget,
  setPlayers,
  onNavigate,
  addNewNews,
  addClubMemory,
  teamDNA,
  setTeamDNA,
  starters,
  bench,
  setStarters,
  setBench,
  tactic,
  saveTactic,
  teamName,
  clubWorld,
  setClubWorld,
  playerStats,
  setPlayerStats,
  rivalMemories,
  setRivalMemories,
  seasonNarrative,
  setSeasonNarrative,
  clubHistory,
  setClubHistory,
  emotionalNarratives,
  setEmotionalNarratives,
  careerWorld,
  setCareerWorld,
  playerConversations,
  setPlayerConversations,
  leagueSystem,
  setLeagueSystem,
  scoutedTargets,
  setScoutedTargets,
  incomingOffers,
  setIncomingOffers
}: MatchCenterProps) {
  const [gameState, setGameState] = useState<'preview' | 'playing' | 'finished'>('preview');
  const [minute, setMinute] = useState(0);
  const [scoreUser, setScoreUser] = useState(0);
  const [scoreOpponent, setScoreOpponent] = useState(0);
  const [liveEvents, setLiveEvents] = useState<MatchEvent[]>([]);
  const [goalFlash, setGoalFlash] = useState<GoalFlash | null>(null);
  const [liveStats, setLiveStats] = useState<MatchStats>(emptyStats());
  const [liveRatings, setLiveRatings] = useState<Record<string, number>>({});
  const [simSpeed, setSimSpeed] = useState<SimSpeed>(2);
  const [liveTactic, setLiveTactic] = useState<Tactic>(tactic);
  const [liveStarters, setLiveStarters] = useState<string[]>(starters);
  const [liveBench, setLiveBench] = useState<string[]>(bench);
  const kickoffStartersRef = useRef<string[]>(starters);
  const [subOutId, setSubOutId] = useState('');
  const [subInId, setSubInId] = useState('');
  const [substitutions, setSubstitutions] = useState(0);
  const [opponentStarters, setOpponentStarters] = useState<string[]>([]);
  const [opponentBench, setOpponentBench] = useState<string[]>([]);
  const [opponentSubstitutions, setOpponentSubstitutions] = useState(0);
  const [userRedCards, setUserRedCards] = useState(0);
  const [opponentRedCards, setOpponentRedCards] = useState(0);
  const [playedPlayerIds, setPlayedPlayerIds] = useState<string[]>(starters);
  const [opponentPlayedPlayerIds, setOpponentPlayedPlayerIds] = useState<string[]>([]);
  const [selectedClubInfo, setSelectedClubInfo] = useState<ClubProfile | null>(null);
  const [playerSheet, setPlayerSheet] = useState<{ player: Player; mode: 'quick' | 'full' } | null>(null);
  const simInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const goalFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishMatchInFlightRef = useRef(false);

  const nextMatch = calendar.find(m => m.status === 'next') || calendar[0];
  const userClub = getClubByName(teamName);
  const userClubProfile = userClub ?? DEFAULT_CLUB_PROFILE;
  const opponentClub = getClubByName(nextMatch?.opponent ?? '');
  const opponentRating = getClubCompetitiveRating(nextMatch?.opponent ?? '', clubWorld);
  const opponentPlayers = useMemo(() => {
    const aiClub = clubWorld.find(club => club.name === nextMatch?.opponent);
    return aiClub?.roster ?? (opponentClub ? createPlayersForClub(opponentClub) : []);
  }, [clubWorld, nextMatch?.opponent, opponentClub]);
  const allKnownPlayers = useMemo(() => [...players, ...opponentPlayers], [players, opponentPlayers]);

  const openClubInfo = (name?: string) => {
    const club = getClubByName(name ?? '');
    if (club) setSelectedClubInfo(club);
  };

  const openPlayerSheet = (player: Player) => {
    setPlayerSheet({ player, mode: 'quick' });
  };
  const rivalMemory = useMemo(
    () => getRivalMemoryForClub(rivalMemories, nextMatch?.opponent ?? ''),
    [nextMatch?.opponent, rivalMemories]
  );
  const exUserPlayerCount = useMemo(
    () => userClub ? opponentPlayers.filter(player => player.id.startsWith(`${userClub.id}_`)).length : 0,
    [opponentPlayers, userClub]
  );

  useEffect(() => {
    if (gameState !== 'preview') return;
    setLiveStarters(starters);
    setLiveBench(bench);
    setLiveTactic(tactic);
    setPlayedPlayerIds(starters);
    const opponentIds = createLineupIds(opponentPlayers, rivalMemory?.preferredModule ?? '4-3-3');
    setOpponentStarters(opponentIds);
    setOpponentBench(opponentPlayers.map(player => player.id).filter(id => !opponentIds.includes(id)));
    setOpponentPlayedPlayerIds(opponentIds);
    setOpponentSubstitutions(0);
    setUserRedCards(0);
    setOpponentRedCards(0);
  }, [bench, gameState, opponentPlayers, rivalMemory?.preferredModule, starters, tactic]);

  const startingPlayers = useMemo(
    () => buildLineup(players, liveStarters).slice(0, 11),
    [players, liveStarters]
  );

  const benchPlayers = useMemo(
    () => liveBench.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[],
    [players, liveBench]
  );
  const opponentStartingPlayers = useMemo(
    () => opponentStarters.map(id => opponentPlayers.find(player => player.id === id)).filter(Boolean) as Player[],
    [opponentPlayers, opponentStarters]
  );
  const opponentBenchPlayers = useMemo(
    () => opponentBench.map(id => opponentPlayers.find(player => player.id === id)).filter(Boolean) as Player[],
    [opponentBench, opponentPlayers]
  );

  const tacticalReport = useMemo(
    () => evaluateTactic(players, liveStarters, liveTactic),
    [players, liveStarters, liveTactic]
  );

  const personalityReport = useMemo(
    () => evaluateLineupPersonalities(startingPlayers, benchPlayers, {
      opponentRating,
      isHome: nextMatch?.isHome ?? true,
      round: nextMatch?.playedIndex ?? 1
    }),
    [benchPlayers, nextMatch?.isHome, nextMatch?.playedIndex, opponentRating, startingPlayers]
  );

  const fitnessReport = useMemo(
    () => evaluateLineupFitness(startingPlayers),
    [startingPlayers]
  );

  const dnaMatchReport = useMemo(
    () => evaluateTeamDNAForMatch(teamDNA, liveTactic, opponentRating),
    [liveTactic, opponentRating, teamDNA]
  );

  const rivalAdaptation = useMemo(
    () => evaluateRivalAdaptation(
      rivalMemory,
      liveTactic,
      teamDNA,
      opponentRating,
      nextMatch?.playedIndex ?? 1,
      exUserPlayerCount
    ),
    [exUserPlayerCount, liveTactic, nextMatch?.playedIndex, opponentRating, rivalMemory, teamDNA]
  );

  const matchBalance = useMemo(() => {
    const weightedLineup = averageNumber(startingPlayers.map((player, index) => {
      const fit = tacticalReport.slotFits[index]?.score ?? 0.78;
      return player.overall * fit
        + player.condition * 0.04
        + player.form * 0.55
        + (personalityReport.playerModifiers[player.id] ?? 0)
        + (fitnessReport.playerModifiers[player.id] ?? 0);
    }));
    const opponentLineupRating = averageNumber(opponentStartingPlayers.map(player => player.overall)) || opponentRating;
    const tacticalDisorder =
      Math.max(0, 76 - tacticalReport.compatibility) * 0.42 +
      Math.max(0, tacticalReport.warnings.length - 1) * 1.8 +
      Math.max(0, tacticalReport.fatigueLoad - 25) * 0.48 +
      personalityReport.tacticalDisorderSwing +
      fitnessReport.tacticalDisorderSwing +
      dnaMatchReport.tacticalDisorderSwing +
      rivalAdaptation.tacticalDisorderSwing;
    const homeBoost = (nextMatch?.isHome ?? true) ? 1.6 : -1.6;
    const redCardSwing = opponentRedCards * 4.8 - userRedCards * 5.4;
    const userEffective = tacticalReport.matchScore * 0.54 + weightedLineup * 0.46 - tacticalDisorder - rivalAdaptation.userAttackPenalty + homeBoost + personalityReport.performanceSwing + fitnessReport.performanceSwing + dnaMatchReport.performanceSwing + redCardSwing;
    const opponentEffective = opponentRating * 0.52 + opponentLineupRating * 0.48 - homeBoost * 0.45 + (opponentRating >= 84 ? 1.2 : 0) + rivalAdaptation.opponentBoost - opponentRedCards * 5 + userRedCards * 4.4;

    return {
      edge: clamp(userEffective - opponentEffective, -28, 28),
      tacticalDisorder,
      userEffective,
      opponentEffective
    };
  }, [dnaMatchReport, fitnessReport, nextMatch?.isHome, opponentRating, opponentRedCards, opponentStartingPlayers, personalityReport, rivalAdaptation, startingPlayers, tacticalReport, userRedCards]);

  const matchEdge = matchBalance.edge;
  const currentMatchPlan = useMemo(
    () => getCurrentMatchPlan(liveTactic, scoreUser, scoreOpponent, userRedCards),
    [liveTactic, scoreOpponent, scoreUser, userRedCards]
  );
  const postMatchAnalysis = useMemo(
    () => buildPostMatchAnalysis({
      scoreUser,
      scoreOpponent,
      stats: liveStats,
      tactic: liveTactic,
      report: tacticalReport,
      matchPlan: currentMatchPlan,
      rivalAdaptation,
      startingPlayers,
      opponentName: nextMatch.opponent
    }),
    [currentMatchPlan, liveStats, liveTactic, nextMatch.opponent, rivalAdaptation, scoreOpponent, scoreUser, startingPlayers, tacticalReport]
  );

  useEffect(() => {
    const ratings: Record<string, number> = {};
    startingPlayers.forEach((player, index) => {
      ratings[player.id] = Number((6.1
        + (player.overall - 72) * 0.035
        + (index % 3) * 0.05
        + (personalityReport.playerModifiers[player.id] ?? 0)
        + (fitnessReport.playerModifiers[player.id] ?? 0) * 0.08
      ).toFixed(1));
    });
    setLiveRatings(ratings);
  }, [fitnessReport.playerModifiers, personalityReport.playerModifiers, startingPlayers]);

  const pushEvent = useCallback((event: MatchEvent) => {
    setLiveEvents(events => [event, ...events]);
  }, []);

  const triggerGoalFlash = useCallback((flash: Omit<GoalFlash, 'id'>) => {
    if (goalFlashTimeout.current) clearTimeout(goalFlashTimeout.current);
    setGoalFlash({ ...flash, id: Date.now() });
    goalFlashTimeout.current = setTimeout(() => setGoalFlash(null), 3200);
  }, []);

  useEffect(() => () => {
    if (goalFlashTimeout.current) clearTimeout(goalFlashTimeout.current);
  }, []);

  const pickPlayer = useCallback((roles: Player['role'][]) => {
    const candidates = startingPlayers.filter(player => roles.includes(player.role));
    return (candidates.length ? candidates : startingPlayers)[indexRandom(candidates.length ? candidates.length : startingPlayers.length)];
  }, [startingPlayers]);

  const pickOpponentPlayer = useCallback((roles: Player['role'][]) => {
    const candidates = opponentStartingPlayers.filter(player => roles.includes(player.role));
    return (candidates.length ? candidates : opponentStartingPlayers)[indexRandom(candidates.length ? candidates.length : opponentStartingPlayers.length)];
  }, [opponentStartingPlayers]);

  const pickCreator = useCallback((lineup: Player[], scorer?: Player) => {
    const creatorRoles: Player['role'][] = ['AM', 'CM', 'LW', 'RW', 'LB', 'RB', 'ST'];
    const candidates = lineup.filter(player => player.id !== scorer?.id && creatorRoles.includes(player.role));
    return (candidates.length ? candidates : lineup.filter(player => player.id !== scorer?.id))[indexRandom(candidates.length ? candidates.length : Math.max(1, lineup.length - 1))];
  }, []);

  const resolveShot = useCallback((team: 'user' | 'opponent', shotMinute: number) => {
    const isUser = team === 'user';
    const goalChance = isUser
      ? clamp(0.022 + tacticalReport.chanceQuality * 0.00055 + personalityReport.chanceSwing * 0.0011 + matchEdge * 0.00095 - matchBalance.tacticalDisorder * 0.00055 - rivalAdaptation.userAttackPenalty * 0.0005 + currentMatchPlan.attackSwing * 0.0007, 0.014, 0.118)
      : clamp(0.028 + tacticalReport.opponentRisk * 0.00072 - matchEdge * 0.00105 + matchBalance.tacticalDisorder * 0.00058 + opponentRating * 0.00008 + rivalAdaptation.opponentBoost * 0.00055 - currentMatchPlan.defenseSwing * 0.00065 + currentMatchPlan.riskSwing * 0.00042, 0.02, 0.13);

    const isGoal = Math.random() < goalChance;
    const eventType: MatchEvent['type'] = isGoal ? 'goal' : 'opportunity';
    const shooterRoles: Player['role'][] = liveTactic.chanceCreation === 'Tiri da Fuori'
      ? ['AM', 'CM', 'DM']
      : liveTactic.chanceCreation === 'Cross'
        ? ['ST', 'LW', 'RW']
        : ['ST', 'AM', 'LW', 'RW'];
    const scorer = isUser ? pickPlayer(shooterRoles) : pickOpponentPlayer(shooterRoles);
    const creator = isUser ? pickCreator(startingPlayers, scorer) : pickCreator(opponentStartingPlayers, scorer);

    if (isGoal) {
      if (isUser) {
        setScoreUser(score => score + 1);
        setLiveRatings(ratings => {
          const updated = { ...ratings };
          startingPlayers.forEach(player => {
            const boost = player.id === scorer?.id ? 1.2 : 0.12;
            updated[player.id] = Number(clamp((updated[player.id] ?? 6.1) + boost, 4.5, 10).toFixed(1));
          });
          return updated;
        });
        triggerGoalFlash({
          team: 'user',
          minute: shotMinute,
          title: 'GOL!',
          detail: `${scorer?.name ?? teamName} segna per ${teamName}${creator ? `, assist di ${creator.name}` : ''}.`
        });
      } else {
        setScoreOpponent(score => score + 1);
        setLiveRatings(ratings => {
          const updated = { ...ratings };
          startingPlayers.forEach(player => {
            updated[player.id] = Number(clamp((updated[player.id] ?? 6.1) - 0.18, 4.5, 10).toFixed(1));
          });
          return updated;
        });
        triggerGoalFlash({
          team: 'opponent',
          minute: shotMinute,
          title: 'GOL SUBITO',
          detail: `${scorer?.name ?? nextMatch.opponent} trova la rete per ${nextMatch.opponent}.`
        });
      }
    }

    if (isUser) {
      const action =
        liveTactic.chanceCreation === 'Cross' ? 'sul cross preparato dalle fasce' :
        liveTactic.chanceCreation === 'Tagli Interni' ? 'dopo un taglio interno alle spalle del terzino' :
        liveTactic.chanceCreation === 'Tiri da Fuori' ? 'con una conclusione dalla distanza' :
        'sul passaggio filtrante tra centrale e terzino';
      pushEvent({
        minute: shotMinute,
        type: eventType,
        team: 'user',
        playerId: scorer?.id,
        playerName: scorer?.name,
        assistPlayerId: creator?.id,
        assistPlayerName: creator?.name,
        description: isGoal
          ? `GOL! ${scorer?.name ?? 'La tua squadra'} segna ${action}${creator ? `, assist di ${creator.name}` : ''}.`
          : `${scorer?.name ?? 'La tua squadra'} va vicino al gol ${action}${creator ? ` dopo l idea di ${creator.name}` : ''}.`
      });
    } else if (isGoal || Math.random() < 0.28) {
      pushEvent({
        minute: shotMinute,
        type: eventType,
        team: 'opponent',
        playerId: scorer?.id,
        playerName: scorer?.name,
        assistPlayerId: creator?.id,
        assistPlayerName: creator?.name,
        description: isGoal
          ? `Gol del ${nextMatch.opponent}: ${scorer?.name ?? 'un avversario'} punisce${creator ? ` su assist di ${creator.name}` : ''}.`
          : `Occasione per il ${nextMatch.opponent}: ${scorer?.name ?? 'un avversario'} trova spazio${creator ? ` dopo la giocata di ${creator.name}` : ''}.`
      });
    }
  }, [currentMatchPlan, liveTactic.chanceCreation, matchBalance.tacticalDisorder, matchEdge, nextMatch.opponent, opponentRating, opponentStartingPlayers, personalityReport.chanceSwing, pickCreator, pickOpponentPlayer, pickPlayer, pushEvent, rivalAdaptation.opponentBoost, rivalAdaptation.userAttackPenalty, startingPlayers, tacticalReport, teamName, triggerGoalFlash]);

  const handleOpponentSubstitution = useCallback((subMinute: number) => {
    if (opponentSubstitutions >= 5 || opponentBench.length === 0 || opponentStarters.length === 0) return;

    const tiredOut = opponentStartingPlayers
      .filter(player => player.role !== 'GK')
      .sort((a, b) => a.overall - b.overall)[indexRandom(Math.min(5, opponentStartingPlayers.length - 1))];
    const replacement = opponentBenchPlayers
      .filter(player => player.role !== 'GK' && (!tiredOut || player.role === tiredOut.role || Math.abs(player.overall - tiredOut.overall) <= 5))
      .sort((a, b) => b.overall - a.overall)[0] ?? opponentBenchPlayers.find(player => player.role !== 'GK');

    if (!tiredOut || !replacement) return;
    setOpponentStarters(ids => ids.map(id => id === tiredOut.id ? replacement.id : id));
    setOpponentBench(ids => ids.map(id => id === replacement.id ? tiredOut.id : id));
    setOpponentPlayedPlayerIds(ids => Array.from(new Set([...ids, replacement.id])));
    setOpponentSubstitutions(count => count + 1);
    pushEvent({
      minute: subMinute,
      type: 'substitution',
      team: 'opponent',
      description: `Cambio ${nextMatch.opponent}: entra ${replacement.name}, esce ${tiredOut.name}.`
    });
  }, [nextMatch.opponent, opponentBench.length, opponentBenchPlayers, opponentStartingPlayers, opponentStarters.length, opponentSubstitutions, pushEvent]);

  useEffect(() => {
    if (gameState !== 'playing') return;

    if (simInterval.current) clearInterval(simInterval.current);

    simInterval.current = setInterval(() => {
      setMinute(prev => {
        const nextMin = prev + 1;
        const possessionBase =
          50 +
          matchEdge * 0.48 +
          (tacticalReport.midfield - 75) * 0.16 -
          matchBalance.tacticalDisorder * 0.12 +
          personalityReport.cohesionSwing * 0.09 +
          fitnessReport.performanceSwing * 0.18 +
          (liveTactic.buildUp === 'Manovrata' ? 4 : liveTactic.buildUp === 'Lancio Lungo' ? -3 : 1) +
          (liveTactic.mentality === 'Offensiva' ? 2 : liveTactic.mentality === 'Difensiva' ? -2 : 0) +
          currentMatchPlan.possessionSwing;

        setLiveStats(stats => {
          const possession = Math.round(clamp(possessionBase + Math.sin(nextMin / 8) * 3 + (Math.random() * 4 - 2), 30, 70));
          return { ...stats, possession };
        });

        const userShotProb = clamp(
          0.011 +
          tacticalReport.attack * 0.00034 +
          tacticalReport.chanceQuality * 0.00016 +
          personalityReport.chanceSwing * 0.00022 +
          matchEdge * 0.00052 +
          liveTactic.riskLevel * 0.00008 -
          matchBalance.tacticalDisorder * 0.00032 +
          fitnessReport.performanceSwing * 0.00018 -
          rivalAdaptation.userAttackPenalty * 0.00036 +
          currentMatchPlan.attackSwing * 0.00052 +
          currentMatchPlan.riskSwing * 0.00012,
          0.012,
          0.086
        );
        const oppShotProb = clamp(
          0.016 +
          tacticalReport.opponentRisk * 0.00055 +
          (opponentRating - tacticalReport.defense) * 0.00078 -
          matchEdge * 0.00068 +
          Math.max(0, liveTactic.riskLevel - 55) * 0.00022 +
          matchBalance.tacticalDisorder * 0.00042 +
          rivalAdaptation.opponentBoost * 0.00028 -
          currentMatchPlan.defenseSwing * 0.00048 +
          currentMatchPlan.riskSwing * 0.0002,
          0.016,
          0.102
        );
        const userShot = Math.random() < userShotProb;
        const oppShot = Math.random() < oppShotProb;

        if (userShot || oppShot) {
          setLiveStats(stats => {
            const userOnTarget = userShot && Math.random() < clamp(0.29 + (tacticalReport.chanceQuality - 70) * 0.005 - matchBalance.tacticalDisorder * 0.002 + currentMatchPlan.attackSwing * 0.003, 0.18, 0.58);
            const oppOnTarget = oppShot && Math.random() < clamp(0.31 + (opponentRating - tacticalReport.defense) * 0.006 + matchBalance.tacticalDisorder * 0.002 - currentMatchPlan.defenseSwing * 0.0025 + currentMatchPlan.riskSwing * 0.0015, 0.22, 0.62);
            const xGUserAdd = userShot ? clamp(0.025 + (tacticalReport.chanceQuality - 65) * 0.00125 - matchBalance.tacticalDisorder * 0.00045 - rivalAdaptation.userAttackPenalty * 0.0012 + currentMatchPlan.attackSwing * 0.001 + Math.random() * 0.055, 0.01, 0.13) : 0;
            const xGOppAdd = oppShot ? clamp(0.032 + (tacticalReport.opponentRisk - 48) * 0.0016 + matchBalance.tacticalDisorder * 0.00065 + rivalAdaptation.opponentBoost * 0.001 - currentMatchPlan.defenseSwing * 0.001 + currentMatchPlan.riskSwing * 0.0008 + Math.random() * 0.065, 0.02, 0.16) : 0;
            return {
              ...stats,
              shotsUser: stats.shotsUser + (userShot ? 1 : 0),
              shotsOpponent: stats.shotsOpponent + (oppShot ? 1 : 0),
              shotsOnTargetUser: stats.shotsOnTargetUser + (userOnTarget ? 1 : 0),
              shotsOnTargetOpponent: stats.shotsOnTargetOpponent + (oppOnTarget ? 1 : 0),
              xGUser: Number((stats.xGUser + xGUserAdd).toFixed(2)),
              xGOpponent: Number((stats.xGOpponent + xGOppAdd).toFixed(2))
            };
          });

          if (userShot) resolveShot('user', nextMin);
          if (oppShot) resolveShot('opponent', nextMin);
        }

        const foulRoll = Math.random();
        const redThreshold = userRedCards < 1
          ? clamp((tacticalReport.foulRisk + personalityReport.foulSwing - 16) / 8500 + (currentMatchPlan.riskSwing > 5 ? 0.001 : 0), 0.0002, 0.0048)
          : 0;
        if (foulRoll < redThreshold && nextMin > 10) {
          const carded = startingPlayers.filter(player => player.role !== 'GK')[indexRandom(Math.max(1, startingPlayers.length - 1))];
          setUserRedCards(cards => cards + 1);
          pushEvent({
            minute: nextMin,
            type: 'card_red',
            team: 'user',
            description: `Rosso per ${carded?.name ?? 'un tuo giocatore'}: il piano ora passa a "${liveTactic.gamePlan?.whenRedCard ?? 'Compatto'}".`
          });
          setLiveStats(stats => ({ ...stats, foulsUser: stats.foulsUser + 1 }));
          setLiveRatings(ratings => {
            const updated = { ...ratings };
            startingPlayers.forEach(player => {
              updated[player.id] = Number(clamp((updated[player.id] ?? 6.1) - 0.25, 4.5, 9.8).toFixed(1));
            });
            return updated;
          });
        } else if (foulRoll < (tacticalReport.foulRisk + personalityReport.foulSwing) / 1400) {
          const carded = startingPlayers[indexRandom(startingPlayers.length)];
          pushEvent({
            minute: nextMin,
            type: 'card_yellow',
            team: 'user',
            description: `Giallo per ${carded?.name ?? 'un tuo giocatore'}: pressing troppo aggressivo in mezzo al campo.`
          });
          setLiveStats(stats => ({ ...stats, foulsUser: stats.foulsUser + 1 }));
        } else if (foulRoll < (tacticalReport.foulRisk + 10) / 1400) {
          pushEvent({
            minute: nextMin,
            type: 'card_yellow',
            team: 'opponent',
            description: `Ammonito un giocatore del ${nextMatch.opponent}: fallo tattico per fermare la transizione.`
          });
          setLiveStats(stats => ({ ...stats, foulsOpponent: stats.foulsOpponent + 1 }));
          if (opponentRedCards < 1 && foulRoll > 0.98) setOpponentRedCards(cards => cards + 1);
        }

        if (nextMin % 15 === 0 && tacticalReport.fatigueLoad > 23) {
          setLiveRatings(ratings => {
            const updated = { ...ratings };
            startingPlayers.forEach(player => {
              updated[player.id] = Number(clamp((updated[player.id] ?? 6.1) - 0.1, 4.5, 9.8).toFixed(1));
            });
            return updated;
          });
        }

        if ([58, 68, 78].includes(nextMin) && Math.random() < 0.72) {
          handleOpponentSubstitution(nextMin);
        }

        if (nextMin >= 90) {
          if (simInterval.current) clearInterval(simInterval.current);
          setGameState('finished');
          return 90;
        }

        return nextMin;
      });
    }, speedDelays[simSpeed]);

    return () => {
      if (simInterval.current) clearInterval(simInterval.current);
    };
  }, [currentMatchPlan, fitnessReport.performanceSwing, gameState, handleOpponentSubstitution, liveTactic, matchBalance.tacticalDisorder, matchEdge, nextMatch.opponent, opponentRating, opponentRedCards, personalityReport.chanceSwing, personalityReport.cohesionSwing, personalityReport.foulSwing, pushEvent, resolveShot, rivalAdaptation.opponentBoost, rivalAdaptation.userAttackPenalty, simSpeed, startingPlayers, tacticalReport, userRedCards]);

  const startSimulation = () => {
    setGameState('playing');
    setMinute(0);
    setScoreUser(0);
    setScoreOpponent(0);
    setLiveEvents([]);
    if (goalFlashTimeout.current) clearTimeout(goalFlashTimeout.current);
    setGoalFlash(null);
    setLiveStats(emptyStats());
    setSubstitutions(0);
    setSubOutId('');
    setSubInId('');
    setUserRedCards(0);
    setOpponentRedCards(0);
    setPlayedPlayerIds(liveStarters);
    setOpponentPlayedPlayerIds(opponentStarters);
    pushEvent({
      minute: 0,
      type: 'opportunity',
      team: 'user',
      description: `Piano partita: ${currentMatchPlan.label}. ${currentMatchPlan.description}`
    });
    personalityReport.notes.slice(0, 2).forEach(note => {
      pushEvent({
        minute: 0,
        type: 'opportunity',
        team: 'user',
        description: `Spogliatoio: ${note}`
      });
    });
    fitnessReport.notes.slice(0, 2).forEach(note => {
      pushEvent({
        minute: 0,
        type: 'opportunity',
        team: 'user',
        description: `Staff fisico: ${note}`
      });
    });
    dnaMatchReport.notes.slice(0, 2).forEach(note => {
      pushEvent({
        minute: 0,
        type: 'opportunity',
        team: 'user',
        description: `DNA: ${note}`
      });
    });
    rivalAdaptation.notes.slice(0, 2).forEach(note => {
      pushEvent({
        minute: 0,
        type: 'opportunity',
        team: 'opponent',
        description: `Analisi rivale: ${note}`
      });
    });
  };

  const handleLiveSubstitution = () => {
    if (!subOutId || !subInId || substitutions >= 5 || gameState !== 'playing') return;
    const outPlayer = players.find(player => player.id === subOutId);
    const inPlayer = players.find(player => player.id === subInId);
    if (!outPlayer || !inPlayer) return;

    setLiveStarters(ids => ids.map(id => id === subOutId ? subInId : id));
    setLiveBench(ids => ids.map(id => id === subInId ? subOutId : id));
    setPlayedPlayerIds(ids => Array.from(new Set([...ids, subInId])));
    setLiveRatings(ratings => ({ ...ratings, [subInId]: 6.1 }));
    setSubstitutions(value => value + 1);
    setSubOutId('');
    setSubInId('');
    pushEvent({
      minute,
      type: 'substitution',
      team: 'user',
      description: `Cambio: entra ${inPlayer.name}, esce ${outPlayer.name}.`
    });
  };

  const saveLivePlan = () => {
    setStarters(liveStarters);
    setBench(liveBench);
    saveTactic({ ...liveTactic, starters: liveStarters, bench: liveBench });
    pushEvent({
      minute,
      type: 'substitution',
      team: 'user',
      description: 'Piano partita salvato: le nuove istruzioni tattiche diventano la base della squadra.'
    });
  };

  const handleFinishMatch = () => {
    // Guardia anti-doppio-click/anti-riesecuzione: l'intera pipeline di fine giornata/fine
    // stagione (prestiti, obblighi, precontratti, contratti, budget) e' sincrona e non idempotente
    // rispetto a una seconda chiamata sulla stessa closure di stato. Blocca qualunque riesecuzione
    // finche' il componente non viene rimontato (onNavigate cambia schermata a fine funzione).
    if (finishMatchInFlightRef.current) return;
    finishMatchInFlightRef.current = true;

    const matchIndex = Number(nextMatch.id.split('_')[1]);
    const updatedCalendar = calendar.map(match => {
      if (match.id === nextMatch.id) {
        return {
          ...match,
          status: 'played' as const,
          scoreUser,
          scoreOpponent,
          stats: liveStats,
          events: liveEvents
        };
      }

      if (match.id === `match_${matchIndex + 1}`) {
        return { ...match, status: 'next' as const };
      }
      return match;
    });

    const userResult = scoreUser > scoreOpponent ? 'W' : scoreUser === scoreOpponent ? 'D' : 'L';
    const oppResult = userResult === 'W' ? 'L' : userResult === 'D' ? 'D' : 'W';

    let prize = 500000;
    if (userResult === 'W') prize = 1800000;
    if (userResult === 'L') prize = 100000;

    const standingsByName = new Map(standings.map(team => [team.name, team]));
    const applyResult = (teamNameToUpdate: string, goalsFor: number, goalsAgainst: number, result: 'W' | 'D' | 'L') => {
      const team = standingsByName.get(teamNameToUpdate);
      if (!team) return;

      standingsByName.set(teamNameToUpdate, {
        ...team,
        played: team.played + 1,
        wins: team.wins + (result === 'W' ? 1 : 0),
        draws: team.draws + (result === 'D' ? 1 : 0),
        losses: team.losses + (result === 'L' ? 1 : 0),
        points: team.points + (result === 'W' ? 3 : result === 'D' ? 1 : 0),
        goalsFor: team.goalsFor + goalsFor,
        goalsAgainst: team.goalsAgainst + goalsAgainst,
        goalDiff: team.goalsFor + goalsFor - (team.goalsAgainst + goalsAgainst),
        form: [...team.form, result].slice(-5) as ('W' | 'D' | 'L')[]
      });
    };

    applyResult(teamName, scoreUser, scoreOpponent, userResult);
    applyResult(nextMatch.opponent, scoreOpponent, scoreUser, oppResult);

    const otherTeams = standings
      .map(team => team.name)
      .filter(name => name !== teamName && name !== nextMatch.opponent);

    const rosterByClub = new Map(clubWorld.map(club => [club.name, club.roster]));
    const simulatedFixtures: { clubName: string; roster: Player[]; goalsScored: number }[] = [];

    for (let i = 0; i < otherTeams.length; i += 2) {
      const home = otherTeams[i];
      const away = otherTeams[i + 1];
      if (!home || !away) continue;
      const homeStrength = getClubCompetitiveRating(home, clubWorld);
      const awayStrength = getClubCompetitiveRating(away, clubWorld);
      const homeExpected = clamp(1.15 + (homeStrength - awayStrength) / 34, 0.45, 2.05);
      const awayExpected = clamp(0.95 + (awayStrength - homeStrength) / 36, 0.35, 1.85);
      const homeGoals = Math.min(4, Math.max(0, Math.floor(homeExpected * 0.55 + Math.random() * homeExpected * 1.05)));
      const awayGoals = Math.min(4, Math.max(0, Math.floor(awayExpected * 0.55 + Math.random() * awayExpected * 1.05)));
      const homeResult = homeGoals > awayGoals ? 'W' : homeGoals === awayGoals ? 'D' : 'L';
      const awayResult = homeResult === 'W' ? 'L' : homeResult === 'D' ? 'D' : 'W';

      applyResult(home, homeGoals, awayGoals, homeResult);
      applyResult(away, awayGoals, homeGoals, awayResult);
      simulatedFixtures.push({ clubName: home, roster: rosterByClub.get(home) ?? [], goalsScored: homeGoals });
      simulatedFixtures.push({ clubName: away, roster: rosterByClub.get(away) ?? [], goalsScored: awayGoals });
    }

    const parsedRound = Number(nextMatch.id.split('_')[1]);
    const roundNumber = nextMatch.playedIndex ?? (Number.isFinite(parsedRound) ? parsedRound : 1);
    const rankedStandings = rankStandings(Array.from(standingsByName.values()));
    const seasonFinished = matchIndex >= calendar.length || !updatedCalendar.some(match => match.status === 'next' || match.status === 'future');
    const worldAfterRound = runClubAutonomyRound(clubWorld, rankedStandings, teamName, roundNumber);

    const fitByPlayer = new Map(tacticalReport.slotFits.map(fit => [fit.playerId, fit.score]));
    const baseUpdatedPlayers = players.map(player => {
      const played = playedPlayerIds.includes(player.id);
      let nextMorale = player.morale;
      let nextCondition = player.condition;
      let nextStatus = player.status;

      if (played) {
        const fit = fitByPlayer.get(player.id) ?? 0.82;
        const fatigue = Math.round(tacticalReport.fatigueLoad + (1 - fit) * 18 + Math.random() * 5);
        nextCondition = Math.max(player.condition - fatigue, 10);
        if (nextCondition < 60) nextStatus = 'Stanco';
        if (userResult === 'W') nextMorale = Math.min(player.morale + 10, 100);
        else if (userResult === 'L') nextMorale = Math.max(player.morale - 12, 10);
        else nextMorale = Math.max(player.morale - 2, 10);
      } else {
        nextCondition = Math.min(player.condition + 12, 100);
        if (nextCondition >= 85 && nextStatus === 'Stanco') nextStatus = 'Disponibile';
        nextMorale = Math.max(player.morale - 2, 10);
      }

      return {
        ...player,
        morale: nextMorale,
        condition: nextCondition,
        status: nextStatus
      };
    });

    const personalityResolution = resolvePostMatchPersonalities(baseUpdatedPlayers, {
      opponent: nextMatch.opponent,
      round: roundNumber,
      isHome: nextMatch.isHome ?? true,
      opponentRating,
      scoreUser,
      scoreOpponent,
      events: liveEvents,
      playedIds: playedPlayerIds,
      starterIds: liveStarters
    });

    const kickoffStarters = kickoffStartersRef.current;
    const userMatchMinutes: Record<string, number> = {};
    playedPlayerIds.forEach(playerId => {
      const wasKickoffStarter = kickoffStarters.includes(playerId);
      const isFinalStarter = liveStarters.includes(playerId);
      userMatchMinutes[playerId] = wasKickoffStarter && isFinalStarter ? 90
        : wasKickoffStarter && !isFinalStarter ? 70
        : !wasKickoffStarter && isFinalStarter ? 20
        : 45;
    });
    const tacticalIntensity = Math.round((liveTactic.pressing + liveTactic.tempo) / 2);
    // Fase 8A: piccoli modificatori dallo staff operativo persistente (preparatore, fisioterapista,
    // allenatore dello sviluppo), da sommare - non sostituire - ai cicli fitness/sviluppo gia' esistenti.
    // Fase 8B: le strutture del club aggiungono solo un piccolo bonus aggiuntivo, con lo stesso cap,
    // allo staff coerente (centro sportivo, centro medico, settore giovanile, scouting, analisi).
    const clubStaffModifiers = applyFacilityBonusToStaffModifiers(
      getClubStaffModifiers(careerWorld.clubStaffState),
      careerWorld.clubFacilitiesState
    );

    const fitnessResolution = resolvePostMatchFitness(personalityResolution.players, {
      opponent: nextMatch.opponent,
      round: roundNumber,
      season: CURRENT_SEASON,
      startedIds: liveStarters,
      playedIds: playedPlayerIds,
      userMatchMinutes,
      tacticalIntensity,
      fitnessStaffQuality: clubStaffModifiers.fitnessQuality,
      physioStaffQuality: clubStaffModifiers.physioQuality
    });

    // ─ Allenamento e sviluppo: avanza solo qui (una volta a giornata), mai al click di un bottone ─
    const slotPresets = POSITION_PRESETS[liveTactic.module] ?? [];
    const slotRoleByPlayerId: Record<string, Player['role'] | undefined> = {};
    liveStarters.forEach((playerId, index) => { slotRoleByPlayerId[playerId] = slotPresets[index]?.role; });
    const clubStaffForDevelopment = buildClubStaff(userClubProfile);
    const boardStaffCompetence = clubStaffForDevelopment.length
      ? clubStaffForDevelopment.reduce((sum, member) => sum + member.competence, 0) / clubStaffForDevelopment.length
      : 60;
    // L'allenatore dello sviluppo persistente pesa quanto la media storica del resto dello staff dirigenziale.
    const staffCompetence = (boardStaffCompetence + clubStaffModifiers.developmentQuality) / 2;
    // Il settore giovanile aiuta lo sviluppo solo dei giocatori gia' academy/local esistenti:
    // nessun nuovo giovane viene creato, e' solo un piccolo extra sul modificatore di crescita gia' presente.
    const youthAcademyGrowthBonus = getFacilityStaffBonus(careerWorld.clubFacilitiesState).youthAcademyBonus / 100;
    const projectGrowthModifierByPlayerId: Record<string, number> = {};
    playedPlayerIds.forEach(playerId => {
      const projectPlayer = fitnessResolution.players.find(item => item.id === playerId);
      if (!projectPlayer) return;
      const role = getPlayerProjectRole(projectPlayer, { starters: liveStarters, bench: liveBench, seasonStats: playerStats, clubHistory, round: roundNumber });
      const academyBonus = isAcademyOrLocalPlayer(clubHistory, projectPlayer.name) ? youthAcademyGrowthBonus : 0;
      projectGrowthModifierByPlayerId[playerId] = role.growthModifier + academyBonus;
    });
    const developmentResolution = advancePlayerDevelopmentCycle(fitnessResolution.players, {
      round: roundNumber,
      season: CURRENT_SEASON,
      startedIds: liveStarters,
      playedIds: playedPlayerIds,
      userMatchMinutes,
      matchRatings: liveRatings,
      slotRoleByPlayerId,
      projectGrowthModifierByPlayerId,
      staffCompetence,
      seasonFinished
    });

    const dnaResolution = evolveTeamDNAAfterMatch(teamDNA, {
      tactic: liveTactic,
      stats: liveStats,
      scoreUser,
      scoreOpponent,
      opponent: nextMatch.opponent,
      opponentRating,
      playedPlayers: developmentResolution.players.filter(player => playedPlayerIds.includes(player.id))
    });
    const seasonResolution = seasonFinished
      ? evolveTeamDNAEndOfSeason(dnaResolution.dna, {
          club: userClubProfile,
          standings: rankedStandings,
          players: developmentResolution.players,
          tactic: liveTactic
        })
      : null;
    const nextTeamDNA = seasonResolution?.dna ?? dnaResolution.dna;
    const rivalResolution = evolveRivalAfterMatch(rivalMemory, {
      opponentName: nextMatch.opponent,
      teamName,
      tactic: liveTactic,
      teamDNA: dnaResolution.dna,
      stats: liveStats,
      scoreUser,
      scoreOpponent,
      round: roundNumber,
      exUserPlayerCount
    });
    const chapterImpact = advanceSeasonNarrative(seasonNarrative, {
      club: userClubProfile,
      standings: rankedStandings,
      players: developmentResolution.players,
      teamDNA: nextTeamDNA,
      history: clubHistory,
      lastMatch: {
        opponent: nextMatch.opponent,
        isHome: nextMatch.isHome,
        opponentRating,
        scoreUser,
        scoreOpponent,
        stats: liveStats,
        events: liveEvents,
        playedIds: playedPlayerIds,
        starterIds: liveStarters
      },
      round: roundNumber,
      seasonFinished: false,
      budget: budget + prize
    });
    const summerImpact = seasonFinished
      ? advanceSeasonNarrative(chapterImpact.narrative, {
          club: userClubProfile,
          standings: rankedStandings,
          players: chapterImpact.players,
          teamDNA: nextTeamDNA,
          history: clubHistory,
          round: roundNumber + 1,
          seasonFinished: true,
          budget: budget + prize + chapterImpact.budgetDelta
        })
      : null;
    const chapterPlayers = summerImpact?.players ?? chapterImpact.players;
    const chapterBudgetDelta = chapterImpact.budgetDelta + (summerImpact?.budgetDelta ?? 0);
    const nextSeasonNarrative = seasonFinished && summerImpact
      ? startNextSeasonNarrative(summerImpact.narrative, userClubProfile, nextTeamDNA)
      : chapterImpact.narrative;

    const rivalryHeat = clubHistory.rivalries.find(rivalry => rivalry.opponent === nextMatch.opponent)?.heat ?? 0;
    const emotionalResult = processMatchForEmotionalNarratives(emotionalNarratives, {
      matchId: nextMatch.id,
      round: roundNumber,
      season: CURRENT_SEASON,
      seasonFinished,
      teamName,
      opponentName: nextMatch.opponent,
      scoreUser,
      scoreOpponent,
      ownRating: getClubCompetitiveRating(teamName, clubWorld),
      opponentRating,
      standings: rankedStandings,
      rivalryHeat,
      events: liveEvents,
      stats: liveStats,
      prematchPlayers: players,
      postmatchPlayers: chapterPlayers,
      playedPlayerIds,
      starterIds: liveStarters
    });
    setEmotionalNarratives(emotionalResult.state);

    const hasMajorEmotionalStory = emotionalResult.state.narratives.some(
      narrative => narrative.relatedMatchIds.includes(nextMatch.id) && narrative.importance >= 55
    );

    const nextPlayerStats = applySimulatedRoundToPlayerSeasonStats(
      applyMatchToPlayerSeasonStats(
        playerStats,
        {
          userTeamName: teamName,
          opponentName: nextMatch.opponent,
          userPlayers: chapterPlayers,
          opponentPlayers,
          playedUserIds: playedPlayerIds,
          playedOpponentIds: opponentPlayedPlayerIds.length ? opponentPlayedPlayerIds : opponentStarters,
          events: liveEvents,
          stats: liveStats,
          ratings: liveRatings,
          userMatchMinutes
        }
      ),
      simulatedFixtures
    );
    setPlayerStats(nextPlayerStats);

    const minutesByPlayerId: Record<string, number> = {};
    nextPlayerStats.forEach(stat => { minutesByPlayerId[stat.playerId] = stat.minutesPlayed; });
    const promiseResolution = resolvePlayingTimePromises(chapterPlayers, {
      round: roundNumber,
      seasonFinished,
      minutesByPlayerId
    });
    promiseResolution.memories.forEach(addClubMemory);

    const justBrokenPromisePlayerIds = chapterPlayers
      .filter(before => {
        const after = promiseResolution.players.find(p => p.id === before.id);
        return after && before.playingTimePromise?.status !== 'broken' && after.playingTimePromise?.status === 'broken';
      })
      .map(p => p.id);
    const justAtRiskPromisePlayerIds = chapterPlayers
      .filter(before => {
        const after = promiseResolution.players.find(p => p.id === before.id);
        return after && before.playingTimePromise?.status !== 'at_risk' && after.playingTimePromise?.status === 'at_risk';
      })
      .map(p => p.id);
    const justCompletedPromisePlayerIds = chapterPlayers
      .filter(before => {
        const after = promiseResolution.players.find(p => p.id === before.id);
        return after && before.playingTimePromise?.status !== 'completed' && after.playingTimePromise?.status === 'completed';
      })
      .map(p => p.id);

    const youthMinutesTotal = chapterPlayers
      .filter(player => player.age <= 21)
      .reduce((sum, player) => sum + (nextPlayerStats.find(stat => stat.playerId === player.id)?.minutesPlayed ?? 0), 0);
    const decisiveYoungsterName = emotionalResult.state.narratives.find(narrative => (
      narrative.relatedMatchIds.includes(nextMatch.id)
      && (narrative.type === 'unexpected_hero' || narrative.type === 'redemption_arc')
      && chapterPlayers.some(player => player.id === narrative.playerId && player.age <= 23)
    ))?.playerName;

    const scorerIds = new Set(liveEvents.filter(e => e.type === 'goal' && e.team === 'user' && e.playerId).map(e => e.playerId as string));
    const assistIds = new Set(liveEvents.filter(e => e.type === 'goal' && e.team === 'user' && e.assistPlayerId).map(e => e.assistPlayerId as string));
    const matchNarrativeIds = new Set(
      emotionalResult.state.narratives
        .filter(n => n.relatedMatchIds.includes(nextMatch.id) && n.playerId)
        .map(n => n.playerId as string)
    );
    const worstRatedUserId = Object.entries(liveRatings)
      .filter(([, rating]) => rating <= 5.2)
      .sort((a, b) => a[1] - b[1])[0]?.[0];
    const contributorIds = new Set<string>([...scorerIds, ...assistIds, ...matchNarrativeIds, ...(worstRatedUserId ? [worstRatedUserId] : [])]);
    const matchContributors: CareerWorldPlayerContribution[] = Array.from(contributorIds).slice(0, 5).map(id => {
      const contributorPlayer = chapterPlayers.find(p => p.id === id);
      if (!contributorPlayer) return null;
      const narrative = emotionalResult.state.narratives.find(n => n.playerId === id && n.relatedMatchIds.includes(nextMatch.id));
      return {
        playerId: id,
        playerName: contributorPlayer.name,
        age: contributorPlayer.age,
        goals: liveEvents.filter(e => e.type === 'goal' && e.team === 'user' && e.playerId === id).length,
        assists: liveEvents.filter(e => e.type === 'goal' && e.team === 'user' && e.assistPlayerId === id).length,
        rating: liveRatings[id] ?? 6,
        legendScore: contributorPlayer.careerMemory.legendScore,
        isAcademyOrLocal: isAcademyOrLocalPlayer(clubHistory, contributorPlayer.name),
        isNarrativeHero: narrative?.type === 'unexpected_hero' || narrative?.type === 'redemption_arc',
        isNarrativeHeroicDefeat: narrative?.type === 'heroic_defeat'
      };
    }).filter((c): c is CareerWorldPlayerContribution => c !== null);

    const matchContext = {
      matchId: nextMatch.id,
      round: roundNumber,
      season: CURRENT_SEASON,
      teamName,
      opponentName: nextMatch.opponent,
      isHome: nextMatch.isHome,
      scoreUser,
      scoreOpponent,
      ownRating: getClubCompetitiveRating(teamName, clubWorld),
      opponentRating,
      standings: rankedStandings,
      rivalryHeat,
      hasMajorEmotionalStory,
      club: userClubProfile,
      totalRounds: calendar.length,
      seasonFinished,
      currentBudget: budget,
      initialBudget: userClubProfile.transferBudget,
      youthMinutesTotal,
      decisiveYoungsterName,
      matchContributors
    };
    const careerWorldResult = processCareerWorldAfterMatch(careerWorld, matchContext);
    // Fase 8A: al massimo un report staff per giornata, generato solo da segnali reali gia' calcolati sopra.
    const clubStaffState = advanceClubStaffReports(careerWorldResult.state.clubStaffState, {
      round: roundNumber,
      season: CURRENT_SEASON,
      players: developmentResolution.players,
      starters: liveStarters,
      tactic: liveTactic,
      scoutedTargets
    });
    // Fase 8B: avanza progetti/degrado strutture una volta a giornata, in linea con lo staff.
    const clubFacilitiesState = advanceClubFacilities(careerWorldResult.state.clubFacilitiesState, roundNumber, CURRENT_SEASON);
    setCareerWorld({ ...careerWorldResult.state, clubStaffState, clubFacilitiesState });

    const matchImportance = computeMatchImportance(matchContext);
    const isDerbyMatch = Boolean(userClubProfile.city && opponentClub?.city && userClubProfile.city === opponentClub.city);
    const ownStandingRank = rankedStandings.find(item => item.name === teamName)?.rank ?? 99;
    const oppStandingRank = rankedStandings.find(item => item.name === nextMatch.opponent)?.rank ?? 99;
    const isTitleRaceMatch = roundNumber >= 20 && ownStandingRank <= 4 && oppStandingRank <= 4 && Math.abs(ownStandingRank - oppStandingRank) <= 3;

    const exUserClubOpponentPlayers = (userClub && opponentClub)
      ? opponentPlayers.filter(item => isFormerClubPlayer(item, userClub.id, opponentClub.id, opponentClub.name, CURRENT_SEASON))
      : [];
    const decisiveExPlayer = exUserClubOpponentPlayers.find(item => (
      liveEvents.some(e => e.type === 'goal' && e.team === 'opponent' && e.playerId === item.id)
    ));
    // Fan standings (Fase 4B) are keyed by the player's pre-sale id; the sale wraps it as
    // `ai_buy_/ai_offer_<clubId>_<originalId>`, so recover the suffix to bridge the two records.
    const decisiveExPlayerOriginalId = decisiveExPlayer && userClub
      ? decisiveExPlayer.id.match(new RegExp(`${userClub.id}_p\\d+$`))?.[0]
      : undefined;
    const decisiveExPlayerIsNotable = Boolean(decisiveExPlayer && (
      (decisiveExPlayerOriginalId && careerWorld.fanState.playerStandings.some(s => s.playerId === decisiveExPlayerOriginalId && s.affection >= 60))
      || isAcademyOrLocalPlayer(clubHistory, decisiveExPlayer.name)
    ));

    setClubHistory(current => applyRivalryMatchResult(current, {
      opponent: nextMatch.opponent,
      season: CURRENT_SEASON,
      round: roundNumber,
      scoreUser,
      scoreOpponent,
      isDerby: isDerbyMatch,
      isTitleRace: isTitleRaceMatch,
      hasMajorEmotionalStory,
      matchImportance,
      decisiveExPlayerName: decisiveExPlayer?.name
    }));
    const exPlayerReturnMemory = decisiveExPlayer ? buildExPlayerReturnMemory({
      playerName: decisiveExPlayer.name,
      opponent: nextMatch.opponent,
      season: CURRENT_SEASON,
      scoreUser,
      scoreOpponent,
      isNotable: decisiveExPlayerIsNotable
    }) : null;
    if (exPlayerReturnMemory) addClubMemory(exPlayerReturnMemory);

    // Media processing runs last: fans, board, narratives and rivalry are already settled above.
    const isStrongRivalryMatch = ['rivalita_forte', 'nemico_storico'].includes(
      clubHistory.rivalries.find(r => r.opponent === nextMatch.opponent)?.status ?? ''
    );
    const criticizedPlayerName = careerWorldResult.state.fanState.mostCriticizedPlayerIds
      .map(id => chapterPlayers.find(p => p.id === id)?.name)
      .find((name): name is string => Boolean(name));
    const brokenPromisePlayerName = justBrokenPromisePlayerIds
      .map(id => chapterPlayers.find(p => p.id === id)?.name)
      .find((name): name is string => Boolean(name));
    const objectiveJustAtRisk = careerWorldResult.state.ownershipState.currentObjectives.find(objective => {
      const before = careerWorld.ownershipState.currentObjectives.find(o => o.id === objective.id);
      return objective.status === 'a_rischio' && before?.status !== 'a_rischio';
    });
    const objectiveJustCompleted = careerWorldResult.state.ownershipState.currentObjectives.find(objective => {
      const before = careerWorld.ownershipState.currentObjectives.find(o => o.id === objective.id);
      return objective.status === 'completato' && before?.status !== 'completato';
    });
    const goalDiffForMedia = scoreOpponent - scoreUser;
    const isHeavyDefeatForMedia = goalDiffForMedia >= 3 || (matchImportance >= 55 && goalDiffForMedia >= 2);
    const isSurpriseResultForMedia = (scoreUser >= scoreOpponent && oppStandingRank <= ownStandingRank - 6)
      || (scoreUser < scoreOpponent && ownStandingRank <= oppStandingRank - 6);

    const mediaMatchResult = processMediaAfterMatch(careerWorldResult.state, {
      matchId: nextMatch.id,
      season: CURRENT_SEASON,
      round: roundNumber,
      teamName,
      opponentName: nextMatch.opponent,
      scoreUser,
      scoreOpponent,
      isDerby: isDerbyMatch,
      isStrongRivalry: isStrongRivalryMatch,
      matchImportance,
      hasMajorEmotionalStory,
      decisiveYoungsterName,
      isHeavyDefeat: isHeavyDefeatForMedia,
      isSurpriseResult: isSurpriseResultForMedia,
      criticizedPlayerName,
      brokenPromisePlayerName,
      boardConfidence: careerWorldResult.state.ownershipState.boardConfidence,
      objectiveAtRiskTitle: objectiveJustAtRisk?.title,
      objectiveCompletedTitle: objectiveJustCompleted?.title
    });
    setCareerWorld(mediaMatchResult.state);
    mediaMatchResult.news.forEach(item => addNewNews(item.title, item.content, item.category));

    // Market rumors: build signals only for a handful of real candidates (promise involved,
    // listed for sale, or already flagged by fan sentiment), never for the whole squad.
    const rumorCandidateIds = new Set<string>([
      ...promiseResolution.players.filter(player => player.playingTimePromise).map(player => player.id),
      ...promiseResolution.players.filter(player => player.status === 'Cedibile').map(player => player.id),
      ...mediaMatchResult.state.fanState.mostCriticizedPlayerIds,
      ...mediaMatchResult.state.fanState.mostLovedPlayerIds,
    ]);
    const isFinancialFragile = mediaMatchResult.state.ownershipState.financialStatus === 'in_tensione'
      || mediaMatchResult.state.ownershipState.financialStatus === 'critico';
    const marketRumorPlayerSignals: MarketRumorPlayerSignal[] = Array.from(rumorCandidateIds)
      .map(id => promiseResolution.players.find(player => player.id === id))
      .filter((player): player is Player => Boolean(player))
      .map(player => {
        const role = getPlayerProjectRole(player, { starters: liveStarters, bench: liveBench, seasonStats: nextPlayerStats, clubHistory, round: roundNumber });
        const minutesShare = (nextPlayerStats.find(stat => stat.playerId === player.id)?.minutesPlayed ?? 0) / Math.max(1, roundNumber * 90);
        const signal: MarketRumorPlayerSignal = {
          playerId: player.id,
          playerName: player.name,
          promiseId: player.playingTimePromise?.id,
          promiseJustAtRisk: justAtRiskPromisePlayerIds.includes(player.id),
          promiseJustBroken: justBrokenPromisePlayerIds.includes(player.id),
          promiseJustCompleted: justCompletedPromisePlayerIds.includes(player.id),
          moraleVeryLow: player.morale <= 32,
          moraleLow: player.morale <= 45,
          isFrustratedTalent: role.key === 'frustratedTalent',
          isOutOfProject: role.key === 'surplus' || role.key === 'brokenPromise',
          longMinutesDrought: roundNumber >= 8 && minutesShare < 0.15,
          coachRelationVeryLow: player.relationships.coach < 35,
          isBelovedOrIdol: mediaMatchResult.state.fanState.mostLovedPlayerIds.includes(player.id),
          isAcademyOrLocal: isAcademyOrLocalPlayer(clubHistory, player.name),
          isListedForSale: player.status === 'Cedibile',
          financialFragile: isFinancialFragile,
        };
        return signal;
      });

    const rumorResult = processMarketRumorsAfterMatch(mediaMatchResult.state, {
      round: roundNumber,
      season: CURRENT_SEASON,
      playerSignals: marketRumorPlayerSignals,
    });
    setCareerWorld(rumorResult);

    const dialogueTriggerResult = detectPostMatchConversationTriggers(playerConversations, {
      round: roundNumber,
      matchId: nextMatch.id,
      opponentName: nextMatch.opponent,
      rivalryHeat,
      beforePlayers: players,
      afterPlayers: promiseResolution.players,
      playerStats: nextPlayerStats,
      starters: liveStarters,
      playedPlayerIds,
      justBrokenPromisePlayerIds,
      emotionalNarratives: emotionalResult.state,
      clubHistory
    });
    setPlayerConversations(dialogueTriggerResult.state);

    // Fase 8C: bonus contrattuali reali (presenza/gol/clean sheet), idempotenti per matchId; a fine
    // stagione anche aumenti, bonus fedelta e scadenze contrattuali, anch'essi idempotenti per stagione.
    const goalsByPlayerId: Record<string, number> = {};
    liveEvents.filter(e => e.type === 'goal' && e.team === 'user' && e.playerId).forEach(e => {
      goalsByPlayerId[e.playerId as string] = (goalsByPlayerId[e.playerId as string] ?? 0) + 1;
    });
    const contractBonusResolution = processContractBonusesAfterMatch(promiseResolution.players, userClubProfile, {
      matchId: nextMatch.id,
      round: roundNumber,
      season: CURRENT_SEASON,
      playedIds: playedPlayerIds,
      startedIds: liveStarters,
      userMatchMinutes,
      goalsByPlayerId,
      cleanSheet: scoreOpponent === 0
    });
    const achievedTeamGoal = seasonFinished && careerWorldResult.state.ownershipState.currentObjectives.some(
      o => o.category === 'sportivo' && o.status === 'completato'
    );
    // Bug fix stabilizzazione: CURRENT_SEASON e' una costante statica ('2026/27'), mai la vera
    // stagione trascorsa. Usarla come season-id del guard idempotente bloccava aumenti/scadenze
    // contrattuali gia' dalla seconda transizione di stagione in poi (eventId sempre uguale ->
    // "gia' processato"). getSeasonLabel(nextTeamDNA.seasonsTracked) e' invece l'identificatore
    // reale gia' usato altrove (finestre di mercato) per la stagione appena chiusa.
    const contractSeasonTransition = seasonFinished
      ? processContractSeasonTransition(contractBonusResolution.players, userClubProfile, getSeasonLabel(nextTeamDNA.seasonsTracked), careerWorld.clubWageBudgetState, achievedTeamGoal)
      : null;
    const finalPlayersWithContracts = contractSeasonTransition?.players ?? contractBonusResolution.players;

    // Fase 9: review del vivaio ogni 4 giornate (mai piu' spesso), intake stagionale idempotente
    // (funge anche da rete di sicurezza per i vecchi salvataggi che non hanno ancora un vivaio).
    const youthReviewResult = runYouthAcademyReview(
      finalPlayersWithContracts,
      careerWorld.youthAcademyState,
      userClubProfile,
      careerWorld.clubFacilitiesState,
      careerWorld.clubStaffState,
      roundNumber,
      nextTeamDNA
    );
    const youthIntakeResult = seasonFinished
      ? ensureSeasonalYouthIntake(
          youthReviewResult.players,
          youthReviewResult.state,
          userClubProfile,
          careerWorld.clubFacilitiesState,
          careerWorld.clubStaffState,
          // Stesso bug fix del guard contrattuale sopra: CURRENT_SEASON e' statica, lastIntakeSeason
          // andrebbe altrimenti confrontato sempre con lo stesso valore, bloccando i nuovi prospetti
          // dalla seconda stagione in poi.
          getSeasonLabel(nextTeamDNA.seasonsTracked),
          nextTeamDNA
        )
      : null;
    const finalPlayersWithYouth = youthIntakeResult?.players ?? youthReviewResult.players;
    const finalYouthAcademyState = youthIntakeResult?.state ?? youthReviewResult.state;

    // Fase M1: verifica reale (solo presenze effettive gia' tracciate) se un obbligo di riscatto
    // condizionato va attivato; mai un acquisto qui, solo il flag (processato solo a fine stagione).
    const playersWithLoanChecks = finalPlayersWithYouth.map(player => {
      if (!player.loanState) return player;
      const seasonAppearances = nextPlayerStats.find(stat => stat.playerId === player.id)?.appearances ?? 0;
      return checkLoanAppearanceObligation(player, seasonAppearances);
    });

    // Fine stagione (stesso punto sicuro gia' usato per contratti/vivaio): risolve prestiti e obblighi
    // attivati una sola volta (guardia su processedSeasonEnd dentro resolveLoanAtSeasonEnd).
    let loanTransferBudgetDelta = 0;
    const returnedLoanPlayerIds: string[] = [];
    const convertedLoanPlayerIds: string[] = [];
    const finalPlayersWithLoans = seasonFinished
      ? playersWithLoanChecks.reduce<Player[]>((acc, player) => {
          if (!player.loanState) { acc.push(player); return acc; }
          const outcome = resolveLoanAtSeasonEnd(player, userClubProfile, CURRENT_SEASON);
          if (!outcome) { acc.push(player); return acc; }
          loanTransferBudgetDelta += outcome.transferBudgetDelta;
          if (outcome.kind === 'returned') { returnedLoanPlayerIds.push(player.id); return acc; }
          if (outcome.kind === 'converted_permanent') { convertedLoanPlayerIds.push(player.id); }
          acc.push(outcome.player);
          return acc;
        }, [])
      : playersWithLoanChecks;

    // Mercato M2A: scadenza reale del contro-riscatto alla vera transizione di stagione (unico
    // contatore stagionale affidabile: nextTeamDNA.seasonsTracked, gia' incrementato una sola volta).
    // Tocca sia la mia rosa sia i roster IA, perche' una clausola puo restare legata a un giocatore
    // che ora gioca altrove.
    const finalPlayersWithClauses = seasonFinished
      ? expireClausesForSeason(finalPlayersWithLoans, nextTeamDNA.seasonsTracked)
      : finalPlayersWithLoans;
    const worldAfterClauseExpiry = seasonFinished
      ? worldAfterRound.map(club => ({ ...club, roster: expireClausesForSeason(club.roster, nextTeamDNA.seasonsTracked) }))
      : worldAfterRound;

    // Mercato M2C: scadenza reale di prelazione/anti-rivale (stesso schema del contro-riscatto M2A).
    const finalPlayersWithProtectiveClauses = seasonFinished
      ? expireProtectiveClausesForSeason(finalPlayersWithClauses, nextTeamDNA.seasonsTracked)
      : finalPlayersWithClauses;
    const worldAfterProtectiveClauseExpiry = seasonFinished
      ? worldAfterClauseExpiry.map(club => ({ ...club, roster: expireProtectiveClausesForSeason(club.roster, nextTeamDNA.seasonsTracked) }))
      : worldAfterClauseExpiry;

    // Mercato M2C: fine scambio di prestiti. Riporta a casa i MIEI giocatori attualmente in prestito
    // presso un altro club come meta' di uno scambio (l'altra meta', gia' in players, e' gestita dal
    // loop prestiti sopra tramite resolveLoanAtSeasonEnd: purchaseClause 'none' -> sempre 'returned').
    const loanSwapReturn = seasonFinished ? returnLoanSwapPlayersHome(worldAfterProtectiveClauseExpiry, userClubProfile.id) : null;
    const finalPlayersWithLoanSwaps = loanSwapReturn
      ? [...finalPlayersWithProtectiveClauses, ...loanSwapReturn.returningPlayers]
      : finalPlayersWithProtectiveClauses;
    const worldAfterLoanSwapReturn = loanSwapReturn ? loanSwapReturn.clubWorld : worldAfterProtectiveClauseExpiry;

    // Mercato M2B: precontratti. Trasferisce a parametro zero, una sola volta, solo qui (guardia
    // sullo status stesso: da 'active' passa a 'completed'/'failed', mai riprocessato dopo F5).
    // Mercato M3: visita medica reale alla vera transizione stagionale (parametro currentRound in piu).
    const futureContractResult = seasonFinished
      ? processFutureContractAgreementsAtSeasonEnd(careerWorld.futureContractAgreements, worldAfterLoanSwapReturn, userClubProfile, CURRENT_SEASON, roundNumber)
      : null;
    const finalPlayersWithPrecontracts = futureContractResult
      ? [...finalPlayersWithLoanSwaps, ...futureContractResult.newPlayers]
      : finalPlayersWithLoanSwaps;
    const worldAfterPrecontracts = futureContractResult && futureContractResult.completedPlayerIdsBySourceClub.length > 0
      ? worldAfterLoanSwapReturn.map(club => {
          const idsToRemove = futureContractResult.completedPlayerIdsBySourceClub.filter(e => e.sourceClubId === club.clubId).map(e => e.playerId);
          if (idsToRemove.length === 0) return club;
          return { ...club, roster: club.roster.filter(p => !idsToRemove.includes(p.id)) };
        })
      : worldAfterLoanSwapReturn;

    // Mercato Cessioni C1: interesse dinamico dei club IA sulla mia rosa. Un solo tick per giornata
    // (guardia lastProcessedRound dentro processOutgoingMarketTick), mai un'offerta immediata solo
    // perche' un giocatore e' stato listato: interesse != offerta.
    const outgoingMarketTick = processOutgoingMarketTick(careerWorld.outgoingMarketState, {
      players: finalPlayersWithPrecontracts,
      clubWorld: worldAfterPrecontracts,
      currentRound: roundNumber,
      myTeamName: teamName,
      playerStats: nextPlayerStats,
      incomingOffers
    });

    // Mercato M3: finestra di mercato reale. A fine stagione si rigenera (estiva/invernale della
    // nuova stagione, gia' corrette per la giornata 1); altrimenti si aggiorna lo stato una volta a
    // giornata (stesso schema del tick C1 sopra).
    const nextTransferWindows = seasonFinished
      ? createSeasonTransferWindows(getSeasonLabel(nextTeamDNA.seasonsTracked))
      : refreshTransferWindowsStatus(careerWorld.transferWindows, roundNumber);

    // Mercato M3: scadenze reali delle trattative/offerte, processate una sola volta a giornata (mai
    // durante il render). Nessun costo, nessun giocatore spostato: solo un cambio di stato.
    const scoutedTargetsAfterDeadlines = processNegotiationDeadlines(scoutedTargets, roundNumber, nextTransferWindows);
    const incomingOffersAfterDeadlines = processIncomingOfferDeadlines(incomingOffers, roundNumber, nextTransferWindows);

    // Mercato M4: concorrenza tra club/aste/agenti, solo per trattative di acquisto a titolo
    // definitivo ancora attive (mai prestiti/scambi/svincolati/precontratti). Un tick reale a
    // giornata per trattativa (idempotente su processedCompetitionEventIds dentro il tick stesso).
    const activeTransferWindowForCompetition = getActiveTransferWindow(nextTransferWindows);
    let nextTransferCompetitions = careerWorld.transferCompetitions;
    let nextPlayerAgentProfiles = careerWorld.playerAgentProfiles;
    const scoutedTargetsAfterCompetition = scoutedTargetsAfterDeadlines.map(target => {
      if (!isCompetitionEligibleNegotiation(target.id, target.terms?.baseType, !!target.swapTerms, !!target.loanSwapTerms)) return target;
      const sourceClub = worldAfterPrecontracts.find(club => club.name === target.currentClub);
      const realPlayer = sourceClub?.roster.find(p => p.name === target.playerName);
      if (!sourceClub || !realPlayer) return target;

      if (!nextPlayerAgentProfiles.some(p => p.playerId === realPlayer.id)) {
        nextPlayerAgentProfiles = [...nextPlayerAgentProfiles, ensurePlayerAgentProfile(realPlayer, nextPlayerAgentProfiles)].slice(-400);
      }

      const existingCompetition = nextTransferCompetitions.find(c => c.negotiationId === target.id);
      const myOfferValue = target.clubAgreedFee ?? target.clubOfferFee ?? target.terms?.upfrontFee ?? 0;
      const updatedCompetition = processTransferCompetitionTick(existingCompetition, {
        player: realPlayer,
        negotiationId: target.id,
        negotiationStatus: target.status,
        myOfferValue,
        sellingClubId: sourceClub.clubId,
        myClubId: userClubProfile.id,
        clubWorld: worldAfterPrecontracts,
        currentRound: roundNumber,
        windowOpen: isTransferWindowOpen(nextTransferWindows),
        windowClosingSoon: activeTransferWindowForCompetition?.status === 'closing_soon'
      });
      nextTransferCompetitions = [updatedCompetition, ...nextTransferCompetitions.filter(c => c.negotiationId !== target.id)].slice(-60);

      // Rischio concreto di perdita: un rivale chiude prima di me. Nessun costo/rosa toccati (non
      // era ancora completata): la trattativa fallisce in modo pulito, come un'offerta respinta.
      if (updatedCompetition.status === 'lost_to_other_club' && target.status !== 'completed') {
        const winner = updatedCompetition.competingBids.find(b => b.status === 'won')?.clubName ?? 'un club rivale';
        return {
          ...target,
          status: 'club_offer_rejected' as const,
          concludedAt: new Date().toISOString(),
          concludedKind: 'rejected' as const,
          timeline: [...target.timeline, `Il ${winner} chiude l'operazione prima di te: giocatore perso.`]
        };
      }
      return target;
    });

    setCareerWorld(current => ({
      ...current,
      clubWageBudgetState: contractSeasonTransition?.wageBudget
        ?? calculateClubWageBudget(finalPlayersWithContracts, userClubProfile, current.clubWageBudgetState.season, current.clubWageBudgetState),
      youthAcademyState: finalYouthAcademyState,
      outgoingMarketState: outgoingMarketTick.state,
      futureContractAgreements: futureContractResult?.agreements ?? current.futureContractAgreements,
      transferWindows: nextTransferWindows,
      transferCompetitions: nextTransferCompetitions,
      playerAgentProfiles: nextPlayerAgentProfiles
    }));

    if (futureContractResult) {
      futureContractResult.logs.forEach(log => addNewNews('Precontratto', log, 'market'));
    }

    setScoutedTargets(scoutedTargetsAfterCompetition);

    setIncomingOffers([...outgoingMarketTick.newOffers, ...incomingOffersAfterDeadlines]);
    if (outgoingMarketTick.newOffers.length > 0) {
      outgoingMarketTick.newOffers.forEach(offer => {
        const sourceClub = worldAfterRound.find(club => club.name === offer.fromClub);
        const isRivalOffer = clubHistory.rivalries.some(r => r.opponent === offer.fromClub && r.heat >= 48);
        const rumorSignal: MarketRumorPlayerSignal = {
          playerId: offer.playerId,
          playerName: offer.playerName,
          hasIncomingOffer: true,
          incomingOfferFromClub: offer.fromClub,
          incomingOfferFromClubId: sourceClub?.clubId,
          incomingOfferIsRival: isRivalOffer,
          isBelovedOrIdol: careerWorld.fanState.mostLovedPlayerIds.includes(offer.playerId),
          isAcademyOrLocal: isAcademyOrLocalPlayer(clubHistory, offer.playerName),
          financialFragile: careerWorld.ownershipState.financialStatus === 'in_tensione' || careerWorld.ownershipState.financialStatus === 'critico',
        };
        setCareerWorld(current => processMarketRumorsAfterTransfer(current, { round: roundNumber, season: CURRENT_SEASON, signal: rumorSignal }));
      });
    }

    setPlayers(finalPlayersWithPrecontracts);
    const returningLoanSwapPlayerIds = loanSwapReturn?.returningPlayers.map(p => p.id) ?? [];
    if (returnedLoanPlayerIds.length > 0 || (futureContractResult?.newPlayers.length ?? 0) > 0 || returningLoanSwapPlayerIds.length > 0) {
      const newPrecontractPlayerIds = futureContractResult?.newPlayers.map(p => p.id) ?? [];
      setStarters(liveStarters.filter(id => !returnedLoanPlayerIds.includes(id)));
      setBench([...liveBench.filter(id => !returnedLoanPlayerIds.includes(id)), ...newPrecontractPlayerIds, ...returningLoanSwapPlayerIds]);
    }
    setBudget(budget + prize + chapterBudgetDelta + loanTransferBudgetDelta);
    setTeamDNA(nextTeamDNA);
    setSeasonNarrative(nextSeasonNarrative);
    setCalendar(seasonFinished ? generateCalendar(teamName, nextTeamDNA.seasonsTracked) : updatedCalendar);
    setStandings(seasonFinished ? calculateInitialStandings() : rankedStandings);
    setClubWorld(worldAfterPrecontracts);
    setRivalMemories(current => {
      const updated = upsertRivalMemory(current, rivalResolution.memory, teamName);
      return seasonFinished ? advanceRivalMemoriesSeason(updated) : updated;
    });

    // ─── Multi-divisione (Serie A / Serie B): estende il flusso sopra, non lo sostituisce.
    // In modalita legacy (leagueSystem === null, salvataggi precedenti a questa fase) questo
    // blocco non fa nulla e resta valido tutto cio' che e' gia' stato impostato sopra. ───
    if (leagueSystem) {
      const userClubId = getAnyClubByName(teamName)?.id;
      const userDivision: CompetitionId = userClubId ? (leagueSystem.clubCompetitionMap[userClubId] ?? 'serie_a') : 'serie_a';
      const otherDivision: CompetitionId = userDivision === 'serie_a' ? 'serie_b' : 'serie_a';
      const userCompetition = leagueSystem.competitions[userDivision];
      const otherCompetition = leagueSystem.competitions[otherDivision];

      const userFixturesAfterResult = userClubId
        ? applyUserResultToFixtures(userCompetition.fixtures, roundNumber, userClubId, scoreUser, scoreOpponent)
        : userCompetition.fixtures;
      const userFixtures = simulateCompetitionRound(userFixturesAfterResult, roundNumber, worldAfterRound, leagueSystem.season, userClubId);

      const otherClubWorld = otherDivision === 'serie_b' ? createInitialSerieBClubWorld() : createInitialClubWorld();
      const otherFixtures = simulateCompetitionRound(otherCompetition.fixtures, roundNumber, otherClubWorld, leagueSystem.season);

      const clubsInDivision = (division: CompetitionId) => Object.entries(leagueSystem.clubCompetitionMap)
        .filter(([, div]) => div === division)
        .map(([id]) => ({ id, name: getAnyClubById(id)?.name ?? id }));

      const userStandingsAfterRound = computeStandingsFromFixtures(clubsInDivision(userDivision), userFixtures);
      const otherStandingsAfterRound = computeStandingsFromFixtures(clubsInDivision(otherDivision), otherFixtures);

      const stadiumFor = (name: string) => getAnyClubByName(name)?.stadium ?? 'Stadio Comunale';
      const seasonStartYear = getSeasonStartYear(leagueSystem.season);
      const userLeagueCalendar = userClubId
        ? deriveClubMatchCalendar(userFixtures, userClubId, stadiumFor, seasonStartYear)
        : updatedCalendar;

      const totalRounds = COMPETITION_DEFINITIONS[userDivision].rounds;
      const regularSeasonJustFinished = roundNumber >= totalRounds;

      let nextLeagueSystem: LeagueSystemState = {
        ...leagueSystem,
        competitions: {
          ...leagueSystem.competitions,
          [userDivision]: { ...userCompetition, fixtures: userFixtures, standings: userStandingsAfterRound, calendar: userLeagueCalendar, completedRound: roundNumber },
          [otherDivision]: { ...otherCompetition, fixtures: otherFixtures, standings: otherStandingsAfterRound, completedRound: roundNumber },
        },
      };

      setCalendar(userLeagueCalendar);
      setStandings(userStandingsAfterRound);

      if (regularSeasonJustFinished) {
        const clubNameById = new Map<string, string>();
        Object.keys(leagueSystem.clubCompetitionMap).forEach(id => clubNameById.set(id, getAnyClubById(id)?.name ?? id));
        const clubIdByName = new Map<string, string>();
        clubNameById.forEach((name, id) => clubIdByName.set(name, id));

        const serieBFinal = nextLeagueSystem.competitions.serie_b;
        const serieAFinal = nextLeagueSystem.competitions.serie_a;
        const serieBOutcome = determineRegularSeasonOutcome(serieBFinal.standings, clubIdByName, SERIE_B_PROMOTION_RULES);
        const serieBWorldForRating = userDivision === 'serie_b' ? worldAfterRound : otherClubWorld;

        const rankedSerieB = [...serieBFinal.standings].sort((a, b) => a.rank - b.rank);
        const thirdPlaceClubId = serieBOutcome.playoffAutoPromotedThirdPlace ? undefined : clubIdByName.get(rankedSerieB[2]?.name ?? '');
        const fourthPlaceClubId = clubIdByName.get(rankedSerieB[3]?.name ?? '');
        const standingsRank = (clubId: string) => serieBFinal.standings.find(s => s.name === clubNameById.get(clubId))?.rank ?? 99;

        // Postseason risolto interamente via simulatore CPU esistente (rating/forma), anche se il
        // club utente vi partecipa: la partecipazione interattiva reale nel MatchCenter e' un
        // passo successivo, documentato nel report finale, non ancora cablato in questa fase.
        let playoff = buildSerieBPlayoffBracket(serieBOutcome.playoffParticipants, clubNameById, leagueSystem.season);
        playoff = advancePostseasonForCpu(playoff, serieBWorldForRating);
        playoff = advanceSerieBPlayoffStage(playoff, standingsRank, thirdPlaceClubId, fourthPlaceClubId, clubNameById);
        playoff = advancePostseasonForCpu(playoff, serieBWorldForRating);
        playoff = advanceSerieBPlayoffFinal(playoff, clubNameById, standingsRank);
        playoff = advancePostseasonForCpu(playoff, serieBWorldForRating);
        playoff = finalizePostseason(playoff);

        let playout = buildSerieBPlayoutBracket(serieBOutcome.playoutParticipants, clubNameById, leagueSystem.season);
        playout = advancePostseasonForCpu(playout, serieBWorldForRating);
        playout = finalizePostseason(playout);

        const nextSeasonLabel = `${seasonStartYear + 1}/${String((seasonStartYear + 2) % 100).padStart(2, '0')}`;
        const transition = advanceLeagueSystemToNextSeason({
          serieAFinal,
          serieBFinal,
          serieBPlayoff: playoff,
          serieBPlayout: playout,
          userClubId: userClubId ?? '',
          userClubProfile,
          nextSeason: nextSeasonLabel,
          previousLastPromotedFromSerieC: leagueSystem.lastPromotedFromSerieC,
        });

        const userNewDivision = transition.summary.userClubDivision;
        const userNewCompetition = transition.leagueSystem.competitions[userNewDivision];
        const userNewCalendar = userClubId
          ? deriveClubMatchCalendar(userNewCompetition.fixtures, userClubId, stadiumFor, getSeasonStartYear(nextSeasonLabel))
          : [];

        nextLeagueSystem = {
          ...transition.leagueSystem,
          competitions: {
            ...transition.leagueSystem.competitions,
            [userNewDivision]: { ...userNewCompetition, calendar: userNewCalendar },
          },
        };

        setCalendar(userNewCalendar);
        setStandings(userNewCompetition.standings);
        if (transition.summary.userClubMovedDivision) {
          setClubWorld(userNewDivision === 'serie_b' ? createInitialSerieBClubWorld() : createInitialClubWorld());
        }
        transition.clubMemories.forEach(addClubMemory);
        addNewNews(
          'Cambio stagione: promozioni e retrocessioni',
          `Serie A: campione ${transition.summary.serieAChampion ?? '-'}. Serie B: campione ${transition.summary.serieBChampion ?? '-'}. Promosse in A: ${transition.summary.promotedToSerieA.map(id => clubNameById.get(id) ?? id).join(', ') || 'nessuna'}. Retrocesse in B: ${transition.summary.relegatedToSerieB.map(id => clubNameById.get(id) ?? id).join(', ') || 'nessuna'}.`,
          'league'
        );

        // L1B: conseguenze credibili quando il club utente cambia divisione. Stesso punto sicuro
        // gia' usato per l'intera transizione di stagione (dentro regularSeasonJustFinished, protetto
        // da finishMatchInFlightRef): applicato una sola volta, mai due volte dopo F5/doppio click.
        // Mai licenziamenti/reset rosa/vendite automatiche/downgrade overall.
        if (transition.summary.userClubMovedDivision) {
          const consequenceCtx = transition.userClubContext;
          const preConsequenceBudget = budget + prize + chapterBudgetDelta + loanTransferBudgetDelta;
          setBudget(Math.max(0, Math.round(preConsequenceBudget * (1 + consequenceCtx.budgetDeltaPercent / 100))));
          setCareerWorld(current => ({
            ...current,
            clubWageBudgetState: {
              ...current.clubWageBudgetState,
              annualWageBudget: Math.max(0, Math.round(current.clubWageBudgetState.annualWageBudget * (1 + consequenceCtx.wageBudgetDeltaPercent / 100)))
            },
            ownershipState: {
              ...current.ownershipState,
              currentObjectives: regenerateObjectivesForDivisionChange(userClubProfile, OBJECTIVE_LABELS[consequenceCtx.objective])
            }
          }));
          addNewNews(
            consequenceCtx.newTier === 'serie_a' ? 'Il club riparte dalla Serie A' : 'Il club riparte dalla Serie B',
            `Nuovo obiettivo dichiarato dalla proprietà: ${OBJECTIVE_LABELS[consequenceCtx.objective]}. Budget trasferimenti adattato al nuovo contesto (${consequenceCtx.budgetDeltaPercent > 0 ? '+' : ''}${consequenceCtx.budgetDeltaPercent}%), monte ingaggi ${consequenceCtx.wageBudgetDeltaPercent > 0 ? '+' : ''}${consequenceCtx.wageBudgetDeltaPercent}%.`,
            'board'
          );
        }
      }

      setLeagueSystem(nextLeagueSystem);
    }

    addNewNews(
      `Risultato: ${teamName} ${scoreUser} - ${scoreOpponent} ${nextMatch.opponent}`,
      `La ${roundNumber}a giornata finisce ${scoreUser}-${scoreOpponent}. Valutazione tattica ${tacticalReport.matchScore}/100, intesa ${tacticalReport.compatibility}%, automatismi ${tacticalReport.automatisms}%. Analisi: ${postMatchAnalysis[0] ?? 'partita senza una causa tattica dominante.'} Premio partita ${formatCurrency(prize)}.`,
      'league'
    );
    [...chapterImpact.news, ...(summerImpact?.news ?? [])].forEach(item => {
      addNewNews(item.title, item.content, item.category);
    });
    emotionalResult.news.forEach(item => addNewNews(item.title, item.content, item.category));
    if (seasonResolution) {
      const finalStanding = rankedStandings.find(item => item.name === teamName);
      addNewNews(
        `Fine stagione: ${teamName} riparte con nuovo status`,
        `${teamName} chiude ${finalStanding?.rank ?? '-'}a con ${finalStanding?.points ?? 0} punti. Il DNA ora pesa di piu su mercato, tifosi e modo in cui i rivali preparano le partite.`,
        'board'
      );

      // UI minima riepilogo cambio stagione: aggrega solo dati gia' calcolati sopra dalla pipeline
      // (nessuna nuova logica), un'unica news compatta invece di una nuova pagina/modale dedicata.
      const expiringContractsCount = finalPlayersWithContracts.filter(p => p.contract?.status === 'expiring').length;
      const newTransferBudget = budget + prize + chapterBudgetDelta + loanTransferBudgetDelta;
      const summaryLines = [
        `Prestiti rientrati: ${returnedLoanPlayerIds.length}.`,
        `Riscatti obbligatori eseguiti: ${convertedLoanPlayerIds.length}.`,
        `Precontratti completati: ${futureContractResult?.newPlayers.length ?? 0}.`,
        `Contratti in scadenza: ${expiringContractsCount}.`,
        `Budget trasferimenti nuova stagione: ${formatCurrency(newTransferBudget)}.`
      ];
      addNewNews(
        'Riepilogo cambio stagione',
        summaryLines.join(' '),
        'board'
      );
    }

    buildMatchMemories({
      teamName,
      opponent: nextMatch.opponent,
      round: roundNumber,
      scoreUser,
      scoreOpponent,
      events: liveEvents,
      stats: liveStats,
      playedPlayers: chapterPlayers.filter(player => playedPlayerIds.includes(player.id))
    }).forEach(addClubMemory);
    personalityResolution.memories.forEach(addClubMemory);
    fitnessResolution.memories.forEach(addClubMemory);
    if (dnaResolution.memory) addClubMemory(dnaResolution.memory);
    if (seasonResolution?.memory) addClubMemory(seasonResolution.memory);
    if (rivalResolution.clubMemory) addClubMemory(rivalResolution.clubMemory);
    [...chapterImpact.memories, ...(summerImpact?.memories ?? [])].forEach(addClubMemory);
    emotionalResult.memories.forEach(addClubMemory);
    fitnessResolution.news.forEach(item => addNewNews(item.title, item.content, 'training'));
    developmentResolution.events.forEach(event => {
      addNewNews(
        event.kind === 'over_potential' ? `Esplosione inattesa: ${event.playerName}` : `Nuovo ruolo per ${event.playerName}`,
        event.summary,
        'training'
      );
      addClubMemory({
        season: CURRENT_SEASON,
        category: 'youth',
        title: event.kind === 'over_potential' ? `Esplosione inattesa: ${event.playerName}` : `Conversione di ruolo: ${event.playerName}`,
        description: event.summary,
        importance: event.kind === 'over_potential' ? 74 : 58,
        fanImpact: event.kind === 'over_potential' ? 4 : 1,
        dressingRoomImpact: 2,
        tags: ['sviluppo', event.kind, `player:${event.playerName}`],
        playerNames: [event.playerName]
      });
    });

    onNavigate('dashboard');
  };

  const getMVP = () => {
    let bestId = '';
    let maxRating = 0;
    Object.entries(liveRatings).forEach(([id, rating]) => {
      if (rating > maxRating) {
        maxRating = rating;
        bestId = id;
      }
    });
    return players.find(player => player.id === bestId);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

  const updateLiveTactic = <K extends keyof Tactic>(key: K, value: Tactic[K]) => {
    setLiveTactic(current => ({ ...current, [key]: value }));
  };

  const mvpPlayer = getMVP();

  return (
    <div className="page-wrapper">
      {gameState === 'preview' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card-premium pitch-viewer-fallback">
            La visualizzazione tattica sarà disponibile dopo l'avvio della partita.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }} className="match-layout">
          <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Confronto Formazioni</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>La partita parte dalla tua lavagna tattica salvata.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-pitch)', marginBottom: '8px' }}>{teamName} titolari</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {startingPlayers.map((player, index) => {
                    const fit = tacticalReport.slotFits[index];
                    return (
                      <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '6px 10px', backgroundColor: 'rgba(26,33,42,0.3)', borderRadius: '4px', border: '1px solid var(--border-light)', fontSize: '0.75rem' }}>
                        <span>{player.name}</span>
                        <span style={{ color: fit?.score && fit.score < 0.65 ? 'var(--color-danger)' : fit?.score && fit.score < 0.92 ? 'var(--color-gold)' : 'var(--color-lime)', fontWeight: 800 }}>
                          {fit?.slotRole ?? player.role} / {player.overall}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>Piano Partita</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                  {[
                    ['Tattica', tacticalReport.matchScore],
                    ['Intesa', tacticalReport.compatibility],
                    ['Auto', tacticalReport.automatisms],
                    ['Attacco', tacticalReport.attack],
                    ['Difesa', tacticalReport.defense],
                    ['Rischio', tacticalReport.opponentRisk]
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: '10px', backgroundColor: 'rgba(26,33,42,0.15)', border: '1px solid var(--border-light)', borderRadius: '4px' }}>
                      <p style={{ color: 'var(--text-secondary)' }}>{label}</p>
                      <strong style={{ color: label === 'Rischio' && Number(value) >= 70 ? 'var(--color-gold)' : 'var(--text-primary)', fontSize: '1rem' }}>{value}</strong>
                    </div>
                  ))}
                </div>
                {tacticalReport.principleReports.length > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tacticalReport.principleReports.slice(0, 3).map(report => (
                      <p key={report.key} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                        <strong style={{ color: report.score >= 68 ? 'var(--color-pitch)' : report.score >= 56 ? 'var(--color-gold)' : 'var(--color-danger)' }}>
                          {report.label} {report.score}/100:
                        </strong> {report.note}
                      </p>
                    ))}
                  </div>
                )}
                {tacticalReport.warnings.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tacticalReport.warnings.slice(0, 3).map(warning => (
                      <p key={warning} style={{ fontSize: '0.72rem', color: 'var(--color-gold)', lineHeight: 1.35 }}>{warning}</p>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: '12px', padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.22)' }}>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px' }}>Lettura caratteriale</p>
                  {personalityReport.notes.length ? (
                    personalityReport.notes.slice(0, 3).map(note => (
                      <p key={note} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginBottom: '4px' }}>{note}</p>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                      Gruppo stabile: leadership, professionalita e rapporti non creano tensioni evidenti.
                    </p>
                  )}
                </div>
                <div style={{ marginTop: '10px', padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.22)' }}>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px' }}>Carico fisico</p>
                  {fitnessReport.notes.length ? (
                    fitnessReport.notes.slice(0, 3).map(note => (
                      <p key={note} style={{ fontSize: '0.72rem', color: 'var(--color-gold)', lineHeight: 1.35, marginBottom: '4px' }}>{note}</p>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                      Rotazioni sotto controllo: nessun titolare supera la soglia fisica.
                    </p>
                  )}
                  <span style={{ display: 'block', marginTop: '5px', fontSize: '0.68rem', color: fitnessReport.injuryRisk >= 20 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                    Rischio infortunio massimo nel tuo undici: {fitnessReport.injuryRisk}%
                  </span>
                </div>
                <div style={{ marginTop: '10px', padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.22)' }}>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px' }}>DNA partita</p>
                  <strong style={{ color: TEAM_DNA_DEFINITIONS[teamDNA.active].color, fontSize: '0.8rem' }}>
                    {TEAM_DNA_DEFINITIONS[teamDNA.active].name} - coerenza {dnaMatchReport.alignment}%
                  </strong>
                  {dnaMatchReport.notes.length ? (
                    dnaMatchReport.notes.slice(0, 2).map(note => (
                      <p key={note} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: '5px' }}>{note}</p>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: '5px' }}>
                      Identita neutra: il piano non spinge ne contraddice troppo il DNA.
                    </p>
                  )}
                </div>
                <div style={{ marginTop: '10px', padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.06)' }}>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px' }}>Avversario che ti studia</p>
                  <strong style={{ color: rivalAdaptation.adaptationScore >= 68 ? 'var(--color-danger)' : rivalAdaptation.adaptationScore >= 45 ? 'var(--color-gold)' : 'var(--text-primary)', fontSize: '0.8rem' }}>
                    Adattamento {rivalAdaptation.adaptationScore}% - {rivalMemory?.preferredModule ?? 'modulo ignoto'}
                  </strong>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: '5px' }}>
                    {rivalAdaptation.plannedResponse}
                  </p>
                  {rivalMemory && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px' }}>
                      <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)' }}>
                        {TEAM_DNA_DEFINITIONS[rivalMemory.philosophy].shortName}
                      </span>
                      <span className="badge" style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--color-gold)' }}>
                        Precedenti {rivalMemory.meetings}
                      </span>
                      <span className="badge" style={{ background: 'rgba(96,165,250,0.12)', color: '#93C5FD' }}>
                        Relazione {rivalMemory.relationship}
                      </span>
                    </div>
                  )}
                  {rivalAdaptation.notes.slice(0, 2).map(note => (
                    <p key={note} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: '6px' }}>{note}</p>
                  ))}
                  {rivalMemory && (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.35, marginTop: '6px' }}>
                      Punto debole: {rivalMemory.weakness}.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card-premium border-glow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '34px 20px', minHeight: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '18px' }}>
                <TeamLogo club={userClub} initials={teamName.slice(0, 3).toUpperCase()} size={58} rounded={14} highlighted />
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-muted)' }}>VS</span>
                <TeamLogo club={opponentClub} initials={nextMatch.opponentInitials} size={58} rounded={14} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>
                <button className="inline-club-link" onClick={() => openClubInfo(teamName)}>{teamName}</button>
                {' - '}
                <button className="inline-club-link" onClick={() => openClubInfo(nextMatch.opponent)}>{nextMatch.opponent}</button>
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '320px', lineHeight: '1.4', marginBottom: '20px' }}>
                Scegli la velocita e avvia. Durante la gara potrai cambiare ritmo tattico e fare sostituzioni.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', width: '100%', maxWidth: '280px', marginBottom: '18px' }}>
                {([1, 2, 4, 8] as SimSpeed[]).map(speed => (
                  <button
                    key={speed}
                    onClick={() => setSimSpeed(speed)}
                    style={{
                      padding: '8px 0',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-light)',
                      backgroundColor: simSpeed === speed ? 'var(--color-pitch)' : 'var(--bg-surface-elevated)',
                      color: simSpeed === speed ? '#042F1A' : 'var(--text-primary)',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              <button
                onClick={startSimulation}
                className="btn-primary"
                style={{ padding: '14px 28px', fontSize: '1rem', width: '100%', maxWidth: '280px', justifyContent: 'center' }}
              >
                <Play size={18} fill="#042F1A" />
                Avvia Simulazione Gara
              </button>
            </div>
          </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.2fr', gap: '24px' }} className="match-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card-premium border-glow" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '24px',
              background: 'linear-gradient(180deg, rgba(26, 33, 42, 0.9) 0%, rgba(10, 13, 16, 0.95) 100%)'
            }}>
              <span className="badge badge-GK" style={{ marginBottom: '8px', color: 'var(--color-pitch)' }}>
                {gameState === 'playing' ? 'LIVE MATCH SIMULATION' : 'FINALE DI GARA'}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '22px', margin: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <TeamLogo club={userClub} initials={teamName.slice(0, 3).toUpperCase()} size={42} rounded={10} highlighted />
                  <button className="inline-club-link live-score-club-link" onClick={() => openClubInfo(teamName)}>{teamName}</button>
                </div>
                <span style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '2.5rem',
                  fontWeight: 900,
                  backgroundColor: 'var(--bg-main)',
                  padding: '4px 24px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-light)',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
                }}>
                  {scoreUser} - {scoreOpponent}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button className="inline-club-link live-score-club-link" onClick={() => openClubInfo(nextMatch.opponent)}>{nextMatch.opponent}</button>
                  <TeamLogo club={opponentClub} initials={nextMatch.opponentInitials} size={42} rounded={10} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-lime)' }}>
                  {minute}'
                </span>
                {gameState === 'playing' && (
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-danger)', display: 'inline-block', animation: 'pulse 1s infinite alternate' }} />
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Velocita {simSpeed}x</span>
              </div>
            </div>

            <AnimatePresence>
              {goalFlash && (
                <motion.div
                  key={goalFlash.id}
                  className={`goal-flash-card ${goalFlash.team === 'user' ? 'user' : 'opponent'}`}
                  initial={{ opacity: 0, scale: 0.86, y: -12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -10 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <span>{goalFlash.minute}'</span>
                  <strong>{goalFlash.title}</strong>
                  <p>{goalFlash.detail}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <LiveTacticalBoard
              key={nextMatch.id}
              lineup={startingPlayers}
              opponentLineup={opponentStartingPlayers}
              tactic={liveTactic}
              report={tacticalReport}
              stats={liveStats}
              minute={minute}
              matchEdge={matchEdge}
              teamName={teamName}
              opponentName={nextMatch.opponent}
              opponentModule={rivalMemory?.preferredModule ?? '4-3-3'}
              gameState={gameState}
              matchId={nextMatch.id}
              events={liveEvents}
              userBench={benchPlayers}
              opponentBench={opponentBenchPlayers}
              userColors={{ primary: userClubProfile.primaryColor ?? '#1E293B', secondary: userClubProfile.secondaryColor ?? '#0F172A' }}
              opponentColors={{ primary: opponentClub?.primaryColor ?? '#1E293B', secondary: opponentClub?.secondaryColor ?? '#0F172A' }}
            />

            <div className="card-premium">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={16} />
                Statistiche in Tempo Reale
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Possesso Palla</span>
                    <strong>{liveStats.possession}% - {100 - liveStats.possession}%</strong>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '3px', display: 'flex' }}>
                    <motion.div animate={{ width: `${liveStats.possession}%` }} style={{ height: '100%', backgroundColor: 'var(--color-pitch)', borderRadius: '3px 0 0 3px' }} />
                    <motion.div animate={{ width: `${100 - liveStats.possession}%` }} style={{ height: '100%', backgroundColor: 'var(--text-muted)', borderRadius: '0 3px 3px 0' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                      <span>Tiri Totali</span>
                      <strong>{liveStats.shotsUser} - {liveStats.shotsOpponent}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                      <span>Tiri in Porta</span>
                      <strong>{liveStats.shotsOnTargetUser} - {liveStats.shotsOnTargetOpponent}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                      <span>Expected Goals (xG)</span>
                      <strong>{liveStats.xGUser.toFixed(2)} - {liveStats.xGOpponent.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                      <span>Falli Commessi</span>
                      <strong>{liveStats.foulsUser} - {liveStats.foulsOpponent}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-premium">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} />
                Valutazioni Live Giocatori
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {startingPlayers.map((player, index) => {
                  const fit = tacticalReport.slotFits[index];
                  return (
                    <div key={player.id} style={{ padding: '8px', borderRadius: '4px', backgroundColor: 'rgba(26, 33, 42, 0.25)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{player.name.split(' ').slice(-1)[0]}</p>
                      <span style={{ fontSize: '0.65rem', color: fit?.score && fit.score < 0.65 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>{player.role} in {fit?.slotRole ?? player.role}</span>
                      <h4 style={{
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        color: (liveRatings[player.id] || 6.0) >= 7.5 ? 'var(--color-lime)' : (liveRatings[player.id] || 6.0) >= 6.5 ? 'var(--text-primary)' : 'var(--color-gold)',
                        marginTop: '4px'
                      }}>
                        {liveRatings[player.id] || 6.0}
                      </h4>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {gameState === 'playing' && (
              <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Gauge size={16} />
                  Regia Live
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {([1, 2, 4, 8] as SimSpeed[]).map(speed => (
                    <button
                      key={speed}
                      onClick={() => setSimSpeed(speed)}
                      style={{
                        padding: '7px 0',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-light)',
                        backgroundColor: simSpeed === speed ? 'var(--color-pitch)' : 'var(--bg-surface-elevated)',
                        color: simSpeed === speed ? '#042F1A' : 'var(--text-primary)',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>

                <div style={{ padding: '9px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: currentMatchPlan.riskSwing > 4 ? 'rgba(245,158,11,0.08)' : 'rgba(26,33,42,0.22)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Piano attivo</span>
                    <strong style={{ fontSize: '0.74rem', color: currentMatchPlan.riskSwing > 4 ? 'var(--color-gold)' : 'var(--color-pitch)' }}>{currentMatchPlan.label}</strong>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{currentMatchPlan.description}</p>
                  {userRedCards > 0 && (
                    <span style={{ display: 'inline-block', marginTop: '5px', fontSize: '0.68rem', color: 'var(--color-danger)', fontWeight: 800 }}>
                      Rossi tuoi: {userRedCards}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Mentalita</label>
                    <select value={liveTactic.mentality} onChange={e => updateLiveTactic('mentality', e.target.value as Tactic['mentality'])} style={smallSelectStyle}>
                      <option value="Difensiva">Difensiva</option>
                      <option value="Bilanciata">Bilanciata</option>
                      <option value="Offensiva">Offensiva</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Transizione</label>
                    <select value={liveTactic.transition} onChange={e => updateLiveTactic('transition', e.target.value as Tactic['transition'])} style={smallSelectStyle}>
                      <option value="Riaggressione">Riaggressione</option>
                      <option value="Contropiede">Contropiede</option>
                      <option value="Conservativa">Conservativa</option>
                    </select>
                  </div>
                </div>

                {[
                  ['Pressing', 'pressing', liveTactic.pressing],
                  ['Ritmo', 'tempo', liveTactic.tempo],
                  ['Linea', 'defensiveLine', liveTactic.defensiveLine],
                  ['Rischio', 'riskLevel', liveTactic.riskLevel]
                ].map(([label, key, value]) => (
                  <div key={String(key)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <strong>{value}%</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={Number(value)}
                      onChange={e => updateLiveTactic(key as keyof Tactic, Number(e.target.value) as never)}
                      className="tactic-slider"
                    />
                  </div>
                ))}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.72rem' }}>
                  <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Tattica</span>
                    <strong style={{ display: 'block', fontSize: '1rem' }}>{tacticalReport.matchScore}</strong>
                  </div>
                  <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Auto</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: tacticalReport.automatisms >= 70 ? 'var(--color-pitch)' : 'var(--text-primary)' }}>{tacticalReport.automatisms}%</strong>
                  </div>
                  <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Carico</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: tacticalReport.fatigueLoad > 24 ? 'var(--color-gold)' : 'var(--text-primary)' }}>{tacticalReport.fatigueLoad}</strong>
                  </div>
                  <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Rivale</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: rivalAdaptation.adaptationScore >= 68 ? 'var(--color-danger)' : rivalAdaptation.adaptationScore >= 45 ? 'var(--color-gold)' : 'var(--text-primary)' }}>{rivalAdaptation.adaptationScore}%</strong>
                  </div>
                  <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>DNA</span>
                    <strong style={{ display: 'block', fontSize: '1rem', color: TEAM_DNA_DEFINITIONS[teamDNA.active].color }}>{dnaMatchReport.alignment}%</strong>
                  </div>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                  Lettura rivale: {rivalAdaptation.plannedResponse}.
                </p>

                <button className="btn-secondary" onClick={saveLivePlan} style={{ justifyContent: 'center', fontSize: '0.75rem' }}>
                  <Save size={13} />
                  Salva piano partita
                </button>
              </div>
            )}

            {gameState === 'playing' && (
              <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shuffle size={16} />
                  Cambi ({substitutions}/5)
                </h3>
                <select value={subOutId} onChange={e => setSubOutId(e.target.value)} style={smallSelectStyle}>
                  <option value="">Esce...</option>
                  {startingPlayers.map(player => (
                    <option key={player.id} value={player.id}>{player.name} ({player.role})</option>
                  ))}
                </select>
                <select value={subInId} onChange={e => setSubInId(e.target.value)} style={smallSelectStyle}>
                  <option value="">Entra...</option>
                  {benchPlayers.map(player => (
                    <option key={player.id} value={player.id}>{player.name} ({player.role})</option>
                  ))}
                </select>
                {subOutId && subInId && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Fit ruolo: <strong style={{ color: 'var(--color-lime)' }}>{players.find(p => p.id === subInId)?.role}</strong> pronto a entrare.
                  </p>
                )}
                <button
                  className="btn-primary"
                  onClick={handleLiveSubstitution}
                  disabled={!subOutId || !subInId || substitutions >= 5}
                  style={{ justifyContent: 'center', opacity: !subOutId || !subInId || substitutions >= 5 ? 0.45 : 1 }}
                >
                  Applica Cambio
                </button>
              </div>
            )}

            {(gameState === 'playing' || gameState === 'finished') && (
              <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} />
                  <button className="inline-club-link" onClick={() => openClubInfo(nextMatch.opponent)}>
                    {nextMatch.opponent}
                  </button>
                  <span>({opponentSubstitutions}/5 cambi)</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {opponentStartingPlayers.slice(0, 11).map(player => (
                    <div key={player.id} style={{ padding: '6px 8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(26,33,42,0.22)' }}>
                      <button
                        className="inline-player-link"
                        onClick={() => openPlayerSheet(player)}
                        style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.72rem' }}
                      >
                        {player.name}
                      </button>
                      <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{player.role} · {player.overall}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Panchina visibile</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {opponentBenchPlayers.slice(0, 8).map(player => (
                      <button
                        key={player.id}
                        className={`badge match-player-badge-button badge-${player.role === 'GK' ? 'GK' : player.role.match(/CB|LB|RB/) ? 'DF' : player.role.match(/DM|CM|AM/) ? 'MF' : 'FW'}`}
                        onClick={() => openPlayerSheet(player)}
                      >
                        {player.name.split(' ').slice(-1)[0]} {player.role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '360px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={16} />
                Cronaca di Gara
              </h3>

              <div className="simulation-timeline" style={{ flex: 1 }}>
                <AnimatePresence>
                  {liveEvents.map((ev, index) => (
                    <motion.div
                      key={`${ev.minute}-${index}-${ev.description}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className={`timeline-event-card ${ev.type === 'goal' ? `goal ${ev.team === 'opponent' ? 'opponent-goal' : ''}` : ev.type === 'card_red' ? 'card-red' : ''}`}
                    >
                      <span className="timeline-event-minute">{ev.minute}'</span>
                      {ev.type === 'goal' && (
                        <strong className={`goal-event-label ${ev.team === 'user' ? 'user' : 'opponent'}`}>
                          {ev.team === 'user' ? 'GOL' : 'GOL SUBITO'}
                        </strong>
                      )}
                      <p style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>{ev.description}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {liveEvents.length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>
                    Fischio d'inizio! La gara reagira alle tue istruzioni.
                  </p>
                )}
              </div>
            </div>

            {gameState === 'finished' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-premium border-glow"
                style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(18, 23, 30, 0.95) 100%)' }}
              >
                <div style={{ marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border-light)' }}>
                  <h4 style={{ fontSize: '0.86rem', fontWeight: 800, marginBottom: '8px' }}>Analisi tattica</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {postMatchAnalysis.map(item => (
                      <p key={item} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.38 }}>
                        {item}
                      </p>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <Award size={18} style={{ color: 'var(--color-gold)' }} />
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Migliore in Campo (MVP)</h4>
                </div>
                {mvpPlayer && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.15)', border: '1px solid var(--color-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--color-gold)', fontSize: '0.85rem' }}>
                      {liveRatings[mvpPlayer.id]}
                    </div>
                    <div>
                      <button className="inline-player-link" onClick={() => openPlayerSheet(mvpPlayer)}>
                        {mvpPlayer.name}
                      </button>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Posizione: {mvpPlayer.role}</p>
                    </div>
                  </div>
                )}

                <button onClick={handleFinishMatch} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <Trophy size={14} fill="#042F1A" />
                  Applica Risultato & Esci
                </button>
              </motion.div>
            )}
          </div>
        </div>
      )}

      <ClubInfoModal
        club={selectedClubInfo}
        onClose={() => setSelectedClubInfo(null)}
        clubWorld={clubWorld}
        userTeamName={teamName}
      />

      <PlayerProfileModal
        player={playerSheet?.player ?? null}
        mode={playerSheet?.mode ?? 'quick'}
        onClose={() => setPlayerSheet(null)}
        onModeChange={mode => setPlayerSheet(current => current ? { ...current, mode } : current)}
        players={allKnownPlayers}
        starters={starters}
        bench={bench}
        playerStats={playerStats}
        clubHistory={clubHistory}
        currentRound={nextMatch?.playedIndex ?? 1}
        contextLabel="Match Center"
      />

      <style>{`
        @keyframes pulse {
          0% { opacity: 0.2; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const smallSelectStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-light)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px',
  fontSize: '0.75rem',
  color: 'var(--text-primary)',
  fontWeight: 600,
  marginTop: '4px'
};
