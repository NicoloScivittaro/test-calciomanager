import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Trophy, Users, BarChart2, Award, Gauge, Shuffle, SlidersHorizontal, Save } from 'lucide-react';
import { ClubAIState, ClubHistoryState, ClubMemoryDraft, ClubProfile, Player, Match, Standing, MatchEvent, MatchStats, Tactic, TeamDNAState, RivalTacticalMemory, SeasonNarrativeState, PlayerSeasonStat } from '../../types';
import { calculateInitialStandings, createPlayersForClub, DEFAULT_CLUB_PROFILE, generateCalendar, getClubByName, rankStandings } from '../../data/serieAData';
import { getClubCompetitiveRating, runClubAutonomyRound } from '../../utils/clubAI';
import { buildMatchMemories } from '../../utils/clubHistory';
import { evaluateLineupFitness, resolvePostMatchFitness } from '../../utils/playerFitness';
import { evaluateLineupPersonalities, resolvePostMatchPersonalities } from '../../utils/playerPersonality';
import { advanceRivalMemoriesSeason, evaluateRivalAdaptation, evolveRivalAfterMatch, getRivalMemoryForClub, upsertRivalMemory } from '../../utils/rivalAI';
import { advanceSeasonNarrative, startNextSeasonNarrative } from '../../utils/seasonNarrative';
import { applyMatchToPlayerSeasonStats } from '../../utils/playerSeasonStats';
import { evaluateTeamDNAForMatch, evolveTeamDNAAfterMatch, evolveTeamDNAEndOfSeason, TEAM_DNA_DEFINITIONS } from '../../utils/teamDNA';
import { buildLineup, evaluateTactic, POSITION_PRESETS, TacticalEvaluation } from '../../utils/tacticsEngine';
import TeamLogo from '../common/TeamLogo';
import ClubInfoModal from '../common/ClubInfoModal';
import PlayerProfileModal from '../common/PlayerProfileModal';

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
  gameState
}: LiveTacticalBoardProps) {
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
        {frame.steps.map(step => (
          <div key={step.label}>
            <span>{step.label}</span>
            <strong>{step.text}</strong>
          </div>
        ))}
      </div>

      <div className="live-pitch-visual" aria-label="Movimenti tattici live">
        <div className="live-pitch-grass" />
        <div className="live-pitch-direction top">Porta avversaria</div>
        <div className="live-pitch-direction bottom">La tua porta</div>
        <div className={`live-possession-pill ${frame.teamHasBall ? 'user' : 'opponent'}`}>
          {frame.teamHasBall ? `${teamName} in possesso` : `${opponentName} in possesso`}
        </div>
        <div className="live-phase-ribbon" style={{ borderColor: frame.color }}>
          <span>Adesso</span>
          <strong>{frame.phase}</strong>
        </div>
        <div className="live-action-zone" style={{
          left: `${clamp(frame.ball.x - 13, 4, 70)}%`,
          top: `${clamp(frame.ball.y - 10, 4, 76)}%`,
          borderColor: frame.color,
          background: frame.teamHasBall ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'
        }} />

        <svg className="live-pitch-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <marker id="live-arrow-green" markerWidth="4" markerHeight="4" refX="3.5" refY="2" orient="auto">
              <path d="M0,0 L4,2 L0,4 Z" fill="#34D399" />
            </marker>
          </defs>
          <line x1="5" y1={frame.defensiveLineY} x2="95" y2={frame.defensiveLineY} className="live-line-defense" />
          <line x1="5" y1={frame.pressingLineY} x2="95" y2={frame.pressingLineY} className="live-line-press" />
          {playerMarkers.filter(marker => marker.active).map(({ player, slot, target }) => (
            <line
              key={`run-${player.id}`}
              x1={slot.x}
              y1={slot.y}
              x2={target.x}
              y2={target.y}
              className="live-player-run"
            />
          ))}
          <motion.path
            key={`${frame.phase}-${frame.lane}-${minute}`}
            d={sequencePath}
            className="live-ball-path"
            markerEnd="url(#live-arrow-green)"
            initial={{ pathLength: 0, opacity: 0.3 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.75 }}
          />
        </svg>

        <span className="live-line-label defense" style={{ top: `${frame.defensiveLineY}%` }}>Linea difensiva</span>
        <span className="live-line-label press" style={{ top: `${frame.pressingLineY}%` }}>Pressing</span>

        {opponentMarkers.map(({ player, target }) => (
          <motion.div
            key={`opp-${player.id}`}
            className="live-opponent-dot"
            animate={{ left: `${target.x}%`, top: `${target.y}%` }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            title={`${opponentName}: ${player.name}`}
          >
            {frame.teamHasBall ? 'press' : player.role}
          </motion.div>
        ))}

        {playerMarkers.map(({ player, target, fit, active }) => {
          const fitColor = fit?.score && fit.score < 0.65 ? 'var(--color-danger)' : fit?.score && fit.score < 0.92 ? 'var(--color-gold)' : 'var(--color-pitch)';
          return (
            <motion.div
              key={player.id}
              className={`live-player-marker ${active ? 'active' : 'inactive'}`}
              animate={{ left: `${target.x}%`, top: `${target.y}%` }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              style={{ borderColor: fitColor, boxShadow: `0 0 14px ${fitColor}66` }}
              title={`${player.name} - ${player.role}${fit ? ` in ${fit.slotRole}` : ''}`}
            >
              <span>{player.role}</span>
              <small>{active ? playerShortName(player.name) : ''}</small>
            </motion.div>
          );
        })}

        <motion.div
          className={`live-ball ${frame.teamHasBall ? 'user' : 'opponent'}`}
          animate={{ left: `${frame.ball.x}%`, top: `${frame.ball.y}%` }}
          transition={{ duration: 0.36, ease: 'easeOut' }}
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
  clubHistory
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

    const fitnessResolution = resolvePostMatchFitness(personalityResolution.players, {
      opponent: nextMatch.opponent,
      round: roundNumber,
      startedIds: liveStarters,
      playedIds: playedPlayerIds
    });

    const dnaResolution = evolveTeamDNAAfterMatch(teamDNA, {
      tactic: liveTactic,
      stats: liveStats,
      scoreUser,
      scoreOpponent,
      opponent: nextMatch.opponent,
      opponentRating,
      playedPlayers: fitnessResolution.players.filter(player => playedPlayerIds.includes(player.id))
    });
    const seasonResolution = seasonFinished
      ? evolveTeamDNAEndOfSeason(dnaResolution.dna, {
          club: userClubProfile,
          standings: rankedStandings,
          players: fitnessResolution.players,
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
      players: fitnessResolution.players,
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

    setPlayerStats(current => applyMatchToPlayerSeasonStats(
      current.length ? current : playerStats,
      {
        userTeamName: teamName,
        opponentName: nextMatch.opponent,
        userPlayers: chapterPlayers,
        opponentPlayers,
        playedUserIds: playedPlayerIds,
        playedOpponentIds: opponentPlayedPlayerIds.length ? opponentPlayedPlayerIds : opponentStarters,
        events: liveEvents,
        stats: liveStats
      }
    ));

    setPlayers(chapterPlayers);
    setBudget(budget + prize + chapterBudgetDelta);
    setTeamDNA(nextTeamDNA);
    setSeasonNarrative(nextSeasonNarrative);
    setCalendar(seasonFinished ? generateCalendar(teamName, nextTeamDNA.seasonsTracked) : updatedCalendar);
    setStandings(seasonFinished ? calculateInitialStandings() : rankedStandings);
    setClubWorld(worldAfterRound);
    setRivalMemories(current => {
      const updated = upsertRivalMemory(current, rivalResolution.memory, teamName);
      return seasonFinished ? advanceRivalMemoriesSeason(updated) : updated;
    });

    addNewNews(
      `Risultato: ${teamName} ${scoreUser} - ${scoreOpponent} ${nextMatch.opponent}`,
      `La ${roundNumber}a giornata finisce ${scoreUser}-${scoreOpponent}. Valutazione tattica ${tacticalReport.matchScore}/100, intesa ${tacticalReport.compatibility}%, automatismi ${tacticalReport.automatisms}%. Analisi: ${postMatchAnalysis[0] ?? 'partita senza una causa tattica dominante.'} Premio partita ${formatCurrency(prize)}.`,
      'league'
    );
    [...chapterImpact.news, ...(summerImpact?.news ?? [])].forEach(item => {
      addNewNews(item.title, item.content, item.category);
    });
    if (seasonResolution) {
      const finalStanding = rankedStandings.find(item => item.name === teamName);
      addNewNews(
        `Fine stagione: ${teamName} riparte con nuovo status`,
        `${teamName} chiude ${finalStanding?.rank ?? '-'}a con ${finalStanding?.points ?? 0} punti. Il DNA ora pesa di piu su mercato, tifosi e modo in cui i rivali preparano le partite.`,
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
    fitnessResolution.news.forEach(item => addNewNews(item.title, item.content, 'training'));

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
