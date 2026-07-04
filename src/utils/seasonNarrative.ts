import {
  ClubHistoryState,
  ClubMemoryDraft,
  ClubProfile,
  ExternalWorldSignal,
  MatchEvent,
  MatchStats,
  NarrativeArc,
  NarrativeArcChoice,
  NarrativeArcChoiceEffect,
  Player,
  SeasonChapterKey,
  SeasonNarrativeState,
  SeasonStoryEvent,
  Standing,
  TeamDNAState
} from '../types';
import { TEAM_DNA_DEFINITIONS } from './teamDNA';

type ChapterDefinition = {
  key: SeasonChapterKey;
  title: string;
  range: string;
  description: string;
  question: string;
  startRound: number;
};

interface AdvanceSeasonContext {
  club: ClubProfile;
  standings: Standing[];
  players: Player[];
  teamDNA: TeamDNAState;
  history?: ClubHistoryState;
  lastMatch?: {
    opponent: string;
    isHome?: boolean;
    opponentRating?: number;
    scoreUser: number;
    scoreOpponent: number;
    stats?: MatchStats;
    events?: MatchEvent[];
    playedIds?: string[];
    starterIds?: string[];
  };
  round: number;
  seasonFinished?: boolean;
  budget: number;
}

interface SeasonChapterImpact {
  narrative: SeasonNarrativeState;
  players: Player[];
  budgetDelta: number;
  news: { title: string; content: string; category: 'board' | 'training' | 'market' | 'league' }[];
  memories: ClubMemoryDraft[];
}

interface NarrativeMetrics {
  standing?: Standing;
  expectedRank: number;
  overPerformance: number;
  recentLosses: number;
  recentWins: number;
  tiredCore: number;
  unhappyCore: number;
  averageCondition: number;
  captain?: Player;
  captainUnhappy: boolean;
  activePromises: ClubHistoryState['promises'];
  promisesUnderPressure: ClubHistoryState['promises'];
  brokenPromisePlayers: string[];
  veteranRenewal?: Player;
  derbyOrHotRival: boolean;
  hotRivalReason?: string;
  playedYoungster?: Player;
  youngPromisePlayer?: Player;
  ownershipMood: number;
  curvaMood: number;
  sponsorMood: number;
  pressMood: number;
  agentMood: number;
  academyMood: number;
  lost: boolean;
  won: boolean;
  heavyLoss: boolean;
  poorPerformance: boolean;
  lowChanceLoss: boolean;
}

interface CausalWorldImpact {
  event: SeasonStoryEvent;
  pressureDelta: number;
  boardDelta: number;
  beliefDelta: number;
  fanDelta: number;
  moraleDelta: number;
  conditionDelta: number;
  budgetDelta: number;
  newsCategory: 'board' | 'training' | 'market' | 'league';
  memory: ClubMemoryDraft;
  promiseOutcome?: 'kept' | 'broken';
  targetPlayerName?: string;
}

interface NarrativeArcImpact {
  arcs: NarrativeArc[];
  events: SeasonStoryEvent[];
  news: { title: string; content: string; category: 'board' | 'training' | 'market' | 'league' }[];
  memories: ClubMemoryDraft[];
  pressureDelta: number;
  boardDelta: number;
  beliefDelta: number;
  fanDelta: number;
}

interface ResolveNarrativeArcContext {
  arcId: string;
  choiceId: string;
  players: Player[];
  budget: number;
}

interface ResolveNarrativeArcResult {
  narrative: SeasonNarrativeState;
  players: Player[];
  budgetDelta: number;
  news: { title: string; content: string; category: 'board' | 'training' | 'market' | 'league' }[];
  memories: ClubMemoryDraft[];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const SEASON_CHAPTERS: Record<SeasonChapterKey, ChapterDefinition> = {
  preseason: {
    key: 'preseason',
    title: 'Preseason',
    range: 'Prima della 1a giornata',
    description: 'Rosa, promesse, gerarchie, obiettivo del board e primi ruoli nello spogliatoio.',
    question: 'Che identita vuoi promettere alla squadra?',
    startRound: 0
  },
  projectCheck: {
    key: 'projectCheck',
    title: 'Primo capitolo',
    range: 'Giornate 1-8',
    description: 'Le prime partite dicono se il progetto tecnico funziona o se vive solo sulla carta.',
    question: 'Il piano sta convincendo giocatori e tifosi?',
    startRound: 5
  },
  novemberCrisis: {
    key: 'novemberCrisis',
    title: 'Nodo di pressione',
    range: 'Quando la stagione si sporca',
    description: 'Una crisi puo nascere da risultati, infortuni, panchine, mercato o pressione: non e garantita e non ha una data fissa.',
    question: 'La squadra sta accumulando tensione o sta gestendo bene il momento?',
    startRound: 8
  },
  winterMarket: {
    key: 'winterMarket',
    title: 'Mercato invernale',
    range: 'Giornate 16-23',
    description: 'La societa deve scegliere: salvare la stagione ora o pianificare il futuro.',
    question: 'Serve un intervento immediato o continuita?',
    startRound: 19
  },
  finalRun: {
    key: 'finalRun',
    title: 'Corsa finale',
    range: 'Giornate 24-37',
    description: 'Obiettivi, rivalita e pressione trasformano ogni punto in una scelta pesante.',
    question: 'La squadra e pronta a vivere partite da dentro o fuori?',
    startRound: 30
  },
  epilogue: {
    key: 'epilogue',
    title: 'Epilogo',
    range: 'Giornata 38',
    description: 'Premi, addii, record e conseguenze chiudono il racconto della stagione.',
    question: 'Cosa resta davvero di questa annata?',
    startRound: 38
  },
  summer: {
    key: 'summer',
    title: 'Estate',
    range: 'Dopo la stagione',
    description: 'Continuita o rivoluzione: il club riparte dalle conseguenze accumulate.',
    question: 'Il ciclo va protetto o rifondato?',
    startRound: 39
  }
};

export const getSeasonLabel = (seasonIndex: number) => {
  const startYear = 2026 + Math.max(0, seasonIndex - 1);
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
};

export const getChapterForRound = (round: number, seasonFinished = false): SeasonChapterKey => {
  if (seasonFinished) return 'summer';
  if (round >= 38) return 'epilogue';
  if (round >= 30) return 'finalRun';
  if (round >= 19) return 'winterMarket';
  if (round >= 5) return 'projectCheck';
  return 'preseason';
};

const getExpectedRank = (club: ClubProfile) => {
  const meta = club as ClubProfile & { expectedRank?: number };
  if (meta.expectedRank) return meta.expectedRank;
  const objective = club.objective.toLowerCase();
  if (objective.includes('scudetto')) return 2;
  if (objective.includes('champions')) return 4;
  if (objective.includes('europe')) return 7;
  if (objective.includes('salvezza')) return 16;
  return 10;
};

const buildArcSummary = (club: ClubProfile, dna: TeamDNAState, standing?: Standing) => {
  const rankText = standing?.played ? `${standing.rank}a con ${standing.points} punti` : 'ai blocchi di partenza';
  return `${club.shortName} e ${rankText}: il DNA ${TEAM_DNA_DEFINITIONS[dna.active].shortName} sta definendo aspettative e pressione.`;
};

export const createInitialSeasonNarrative = (
  club: ClubProfile,
  teamDNA: TeamDNAState,
  seasonIndex = teamDNA.seasonsTracked
): SeasonNarrativeState => {
  const chapter = SEASON_CHAPTERS.preseason;
  const event: SeasonStoryEvent = {
    id: `chapter_preseason_${Date.now()}`,
    chapter: 'preseason',
    round: 0,
    title: `Preseason: nasce il patto ${club.shortName}`,
    description: `Il board chiede ${club.objective.toLowerCase()}. La rosa entra in stagione con DNA ${TEAM_DNA_DEFINITIONS[teamDNA.active].shortName}.`,
    consequence: 'Fiducia iniziale stabile, ma le promesse del board resteranno sullo sfondo.',
    tone: 'neutral'
  };

  return {
    seasonLabel: getSeasonLabel(seasonIndex),
    seasonIndex,
    currentChapter: 'preseason',
    triggeredChapters: ['preseason'],
    pressure: clamp(42 + club.pressure * 0.35, 35, 82),
    boardTrust: 58,
    squadBelief: 56,
    fanPatience: clamp(64 - club.pressure * 0.18, 40, 70),
    arcTitle: chapter.title,
    arcSummary: buildArcSummary(club, teamDNA),
    keyQuestion: chapter.question,
    worldSignals: [],
    arcs: [],
    events: [event]
  };
};

export const normalizeSeasonNarrative = (
  value: SeasonNarrativeState | null | undefined,
  club: ClubProfile,
  teamDNA: TeamDNAState
) => {
  if (!value?.currentChapter) return createInitialSeasonNarrative(club, teamDNA);
  const chapter = SEASON_CHAPTERS[value.currentChapter] ?? SEASON_CHAPTERS.preseason;

  return {
    ...value,
    seasonLabel: value.seasonLabel ?? getSeasonLabel(value.seasonIndex ?? teamDNA.seasonsTracked),
    seasonIndex: value.seasonIndex ?? teamDNA.seasonsTracked,
    currentChapter: chapter.key,
    triggeredChapters: value.triggeredChapters ?? ['preseason'],
    pressure: clamp(value.pressure ?? 50, 0, 100),
    boardTrust: clamp(value.boardTrust ?? 55, 0, 100),
    squadBelief: clamp(value.squadBelief ?? 55, 0, 100),
    fanPatience: clamp(value.fanPatience ?? 55, 0, 100),
    arcTitle: value.arcTitle ?? chapter.title,
    arcSummary: value.arcSummary ?? buildArcSummary(club, teamDNA),
    keyQuestion: value.keyQuestion ?? chapter.question,
    worldSignals: value.worldSignals ?? [],
    arcs: (value.arcs ?? []).map(arc => ({
      ...arc,
      status: arc.status ?? 'active',
      stage: arc.stage ?? 'birth',
      heat: clamp(arc.heat ?? 50, 0, 100),
      choices: arc.choices ?? [],
      history: arc.history ?? []
    })),
    events: value.events ?? []
  };
};

const createChapterEvent = (
  chapter: SeasonChapterKey,
  round: number,
  title: string,
  description: string,
  consequence: string,
  tone: SeasonStoryEvent['tone']
): SeasonStoryEvent => ({
  id: `chapter_${chapter}_${Date.now()}_${round}`,
  chapter,
  round,
  title,
  description,
  consequence,
  tone
});

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

const seededRatio = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  return hash / 100000;
};

const knownRivalries: Record<string, string[]> = {
  Inter: ['Milan', 'Juventus'],
  Milan: ['Inter', 'Juventus'],
  Juventus: ['Torino', 'Inter', 'Milan'],
  Torino: ['Juventus'],
  Roma: ['Lazio'],
  Lazio: ['Roma'],
  Napoli: ['Roma', 'Juventus'],
  Fiorentina: ['Juventus'],
  Genoa: ['Sampdoria'],
  Bologna: ['Fiorentina']
};

const isKnownRivalry = (club: ClubProfile, opponent?: string) => {
  if (!opponent) return false;
  const rivals = knownRivalries[club.name] ?? knownRivalries[club.shortName] ?? [];
  return rivals.includes(opponent);
};

const signalId = (seasonLabel: string, round: number, label: string) => `signal_${slug(seasonLabel)}_${round}_${slug(label)}`;

const makeSignal = (
  narrative: SeasonNarrativeState,
  round: number,
  category: ExternalWorldSignal['category'],
  label: string,
  detail: string,
  intensity: number,
  source: string,
  tags: string[] = []
): ExternalWorldSignal => ({
  id: signalId(narrative.seasonLabel, round, label),
  category,
  label,
  detail,
  intensity: Math.round(clamp(intensity, 0, 100)),
  round,
  source,
  tags
});

const getCaptainCandidate = (players: Player[]) => (
  [...players].sort((a, b) => (
    (b.overall * 1.1 + b.personality.leadership * 0.6 + b.morale * 0.35 + b.careerMemory.legendScore * 0.35)
    - (a.overall * 1.1 + a.personality.leadership * 0.6 + a.morale * 0.35 + a.careerMemory.legendScore * 0.35)
  ))[0]
);

const promiseNeedsMinutes = (promise: ClubHistoryState['promises'][number], player: Player | undefined, round: number) => {
  if (!player || promise.status !== 'attiva' || round < 5) return false;
  const appearances = player.careerMemory?.appearances ?? 0;
  const starts = player.careerMemory?.consecutiveStarts ?? 0;
  const text = promise.promise.toLowerCase();

  if (text.includes('stella') || text.includes('titolare')) {
    return round >= 6 && appearances < Math.max(2, Math.floor(round * 0.42)) && starts === 0;
  }

  if (text.includes('giovane') || text.includes('progetto')) {
    return round >= 8 && player.age <= 22 && appearances < Math.max(1, Math.floor(round * 0.2));
  }

  if (text.includes('rotazione')) {
    return round >= 9 && appearances <= 1;
  }

  return false;
};

const promiseLooksKept = (promise: ClubHistoryState['promises'][number], player: Player | undefined, round: number) => {
  if (!player || promise.status !== 'attiva' || round < 4) return false;
  const appearances = player.careerMemory?.appearances ?? 0;
  const text = promise.promise.toLowerCase();

  if (text.includes('stella') || text.includes('titolare')) return appearances >= Math.max(3, Math.floor(round * 0.58));
  if (text.includes('giovane') || text.includes('progetto')) return player.age <= 22 && appearances >= Math.max(2, Math.floor(round * 0.28));
  if (text.includes('rotazione')) return appearances >= Math.max(2, Math.floor(round * 0.22));
  return false;
};

const buildNarrativeMetrics = (
  narrative: SeasonNarrativeState,
  context: AdvanceSeasonContext,
  standing: Standing | undefined,
  expectedRank: number
): NarrativeMetrics => {
  const stakeholderMood = (key: string, fallback: number) => (
    context.history?.stakeholders.find(stakeholder => stakeholder.key === key)?.mood ?? fallback
  );
  const form = standing?.form ?? [];
  const recentLosses = form.filter(result => result === 'L').length;
  const recentWins = form.filter(result => result === 'W').length;
  const overPerformance = standing ? expectedRank - standing.rank : 0;
  const tiredCore = context.players.filter(player => player.condition < 62 || player.status === 'Stanco').length;
  const unhappyCore = context.players.filter(player => player.morale < 48 || player.status === 'Cedibile').length;
  const averageCondition = context.players.length
    ? context.players.reduce((sum, player) => sum + player.condition, 0) / context.players.length
    : 70;
  const captain = getCaptainCandidate(context.players);
  const captainUnhappy = Boolean(captain && (captain.morale < 55 || captain.status === 'Cedibile' || captain.relationships.coach < 46));
  const activePromises = context.history?.promises.filter(promise => promise.status === 'attiva') ?? [];
  const promisesUnderPressure = activePromises.filter(promise => (
    promiseNeedsMinutes(promise, context.players.find(player => player.name === promise.playerName), context.round)
  ));
  const brokenPromisePlayers = context.history?.promises
    .filter(promise => promise.status === 'tradita')
    .map(promise => promise.playerName) ?? [];
  const veteranRenewal = context.players
    .filter(player => (
      player.age >= 31
      && player.contractYears <= 1
      && player.morale >= 58
      && player.careerMemory.appearances >= Math.max(4, Math.floor(context.round * 0.34))
    ))
    .sort((a, b) => (b.overall + b.personality.leadership * 0.2) - (a.overall + a.personality.leadership * 0.2))[0];
  const match = context.lastMatch;
  const lost = Boolean(match && match.scoreUser < match.scoreOpponent);
  const won = Boolean(match && match.scoreUser > match.scoreOpponent);
  const heavyLoss = Boolean(match && match.scoreOpponent - match.scoreUser >= 3);
  const poorPerformance = Boolean(match?.stats && match.stats.xGOpponent > match.stats.xGUser + 0.45);
  const lowChanceLoss = Boolean(lost && match?.stats && match.stats.shotsOnTargetUser <= 2);
  const rivalry = context.history?.rivalries.find(item => item.opponent === match?.opponent);
  const derbyOrHotRival = Boolean(match?.opponent && (isKnownRivalry(context.club, match.opponent) || (rivalry?.heat ?? 0) >= 62));
  const hotRivalReason = derbyOrHotRival
    ? isKnownRivalry(context.club, match?.opponent) ? 'derby o rivalita storica' : rivalry?.reason
    : undefined;
  const playedYoungster = context.players
    .filter(player => (
      player.age <= 21
      && (context.lastMatch?.playedIds?.includes(player.id) || context.lastMatch?.events?.some(event => event.playerId === player.id))
    ))
    .sort((a, b) => b.potential - a.potential)[0];
  const youngPromisePlayer = activePromises
    .map(promise => context.players.find(player => player.name === promise.playerName && player.age <= 22))
    .filter(Boolean)
    .sort((a, b) => (b?.potential ?? 0) - (a?.potential ?? 0))[0];

  return {
    standing,
    expectedRank,
    overPerformance,
    recentLosses,
    recentWins,
    tiredCore,
    unhappyCore,
    averageCondition,
    captain,
    captainUnhappy,
    activePromises,
    promisesUnderPressure,
    brokenPromisePlayers,
    veteranRenewal,
    derbyOrHotRival,
    hotRivalReason,
    playedYoungster,
    youngPromisePlayer,
    ownershipMood: stakeholderMood('ownership', narrative.boardTrust),
    curvaMood: stakeholderMood('curva', narrative.fanPatience),
    sponsorMood: stakeholderMood('sponsors', 58),
    pressMood: stakeholderMood('press', 52),
    agentMood: stakeholderMood('agents', 55),
    academyMood: stakeholderMood('academy', 58),
    lost,
    won,
    heavyLoss,
    poorPerformance,
    lowChanceLoss
  };
};

const buildWorldSignals = (
  narrative: SeasonNarrativeState,
  context: AdvanceSeasonContext,
  metrics: NarrativeMetrics
) => {
  const signals: ExternalWorldSignal[] = [];
  const match = context.lastMatch;

  if (metrics.lost && match) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'results',
      metrics.derbyOrHotRival ? `Sconfitta pesante contro ${match.opponent}` : 'Sconfitta recente',
      metrics.derbyOrHotRival
        ? `Il risultato pesa di piu perche nasce in ${metrics.hotRivalReason ?? 'una rivalita calda'}.`
        : `La giornata si chiude con una sconfitta ${metrics.heavyLoss ? 'larga' : 'che abbassa fiducia e classifica'}.`,
      48 + (metrics.heavyLoss ? 20 : 0) + (metrics.derbyOrHotRival ? 18 : 0),
      `${match.scoreUser}-${match.scoreOpponent} vs ${match.opponent}`,
      ['risultato', metrics.derbyOrHotRival ? 'rivalita' : 'campionato']
    ));
  }

  if (metrics.recentLosses >= 2) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'results',
      'Serie negativa',
      `${metrics.recentLosses} sconfitte nelle ultime ${metrics.standing?.form.length ?? 5} gare stanno cambiando la lettura pubblica del progetto.`,
      42 + metrics.recentLosses * 12 + Math.max(0, -metrics.overPerformance) * 4,
      'classifica e forma recente',
      ['forma', 'pressione']
    ));
  }

  if (metrics.tiredCore >= 5 || metrics.averageCondition < 67) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'locker',
      'Rosa stanca',
      `${metrics.tiredCore} giocatori sono stanchi o sotto il 62% di condizione: le rotazioni iniziano a pesare sul racconto.`,
      34 + metrics.tiredCore * 6 + Math.max(0, 67 - metrics.averageCondition),
      'condizione rosa',
      ['fatica', 'rotazioni']
    ));
  }

  if (metrics.captainUnhappy && metrics.captain) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'locker',
      'Leader scontento',
      `${metrics.captain.name} ha morale ${metrics.captain.morale}/100 e rapporto coach ${metrics.captain.relationships.coach}/100.`,
      56 + Math.max(0, 58 - metrics.captain.morale),
      metrics.captain.name,
      ['leader', `player:${metrics.captain.name}`]
    ));
  }

  if (metrics.promisesUnderPressure.length > 0) {
    const promise = metrics.promisesUnderPressure[0];
    signals.push(makeSignal(
      narrative,
      context.round,
      'promise',
      'Promessa sotto pressione',
      `${promise.playerName} aspettava ${promise.promise.toLowerCase()}, ma i minuti fin qui non stanno confermando il patto.`,
      58 + metrics.promisesUnderPressure.length * 10 + Math.max(0, context.round - 8),
      promise.playerName,
      ['promessa', `player:${promise.playerName}`]
    ));
  }

  if (metrics.brokenPromisePlayers.length > 0) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'promise',
      'Promesse tradite ricordate',
      `${metrics.brokenPromisePlayers.slice(0, 2).join(', ')} restano nella memoria dello spogliatoio.`,
      50 + metrics.brokenPromisePlayers.length * 8,
      'storico promesse',
      ['promessa', 'memoria']
    ));
  }

  const activeControversialTransfer = context.history?.memories.find(memory => (
    memory.category === 'transfer'
    && memory.tags.includes('cessione')
    && (memory.tags.includes('leader') || memory.tags.includes('capitano') || memory.tags.includes('rivalita'))
    && (memory.strength ?? memory.importance) >= 46
  ));
  if (activeControversialTransfer) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'market',
      'Cessione controversa ancora viva',
      `${activeControversialTransfer.title} resta nella memoria con forza ${activeControversialTransfer.strength ?? activeControversialTransfer.importance}/100.`,
      50 + (activeControversialTransfer.strength ?? activeControversialTransfer.importance) * 0.35,
      activeControversialTransfer.title,
      ['mercato', 'memoria', 'tifosi']
    ));
  }

  if (metrics.curvaMood < 42) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'curva',
      'Curva gia in tensione',
      `La curva e a ${metrics.curvaMood}/100: derby, leader ceduti o partite senza coraggio pesano piu del normale.`,
      58 + Math.max(0, 42 - metrics.curvaMood) * 1.4 + (metrics.derbyOrHotRival ? 10 : 0),
      'stakeholder curva',
      ['curva', 'tifosi']
    ));
  }

  if (metrics.agentMood < 42 && metrics.promisesUnderPressure.length > 0) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'agent',
      'Agenti nervosi',
      `Gli agenti sono a ${metrics.agentMood}/100 e vedono promesse non trasformate in minuti.`,
      54 + Math.max(0, 42 - metrics.agentMood) * 1.2 + metrics.promisesUnderPressure.length * 8,
      'stakeholder agenti',
      ['agenti', 'promessa']
    ));
  }

  if (metrics.sponsorMood < 44 && (metrics.recentLosses >= 2 || metrics.overPerformance <= -3)) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'sponsor',
      'Sponsor preoccupati',
      `Sponsor a ${metrics.sponsorMood}/100: reputazione e continuita del progetto iniziano a pesare sulle pressioni pubbliche.`,
      50 + Math.max(0, 44 - metrics.sponsorMood) * 1.3 + Math.max(0, -metrics.overPerformance) * 4,
      'stakeholder sponsor',
      ['sponsor', 'reputazione']
    ));
  }

  if (metrics.academyMood < 45 && metrics.youngPromisePlayer) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'youth',
      'Vivaio in attesa',
      `${metrics.youngPromisePlayer.name} e gli altri giovani aspettano spazio: il vivaio e a ${metrics.academyMood}/100.`,
      48 + Math.max(0, 45 - metrics.academyMood) * 1.2,
      'stakeholder vivaio',
      ['vivaio', 'giovani', `player:${metrics.youngPromisePlayer.name}`]
    ));
  }

  if (context.budget < Math.max(2500000, context.club.transferBudget * 0.16)) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'finance',
      'Bilancio rigido',
      `Budget residuo basso rispetto al mandato iniziale: la proprieta puo bloccare richieste extra.`,
      46 + Math.max(0, 35 - narrative.boardTrust) + Math.max(0, -metrics.overPerformance) * 3,
      'budget e fiducia board',
      ['budget', 'proprieta']
    ));
  }

  if (metrics.veteranRenewal) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'board',
      'Veterano a scadenza',
      `${metrics.veteranRenewal.name} gioca molto, e vicino alla scadenza e sente di avere ancora valore.`,
      52 + metrics.veteranRenewal.personality.ambition * 0.18 + metrics.veteranRenewal.overall * 0.08,
      metrics.veteranRenewal.name,
      ['rinnovo', `player:${metrics.veteranRenewal.name}`]
    ));
  }

  if (metrics.won && metrics.playedYoungster && match) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'youth',
      'Giovane lanciato in un momento vero',
      `${metrics.playedYoungster.name} ha trovato minuti in una vittoria contro ${match.opponent}: puo diventare simbolo se il contesto lo spinge.`,
      48 + (metrics.playedYoungster.potential - metrics.playedYoungster.overall) * 4 + Math.max(0, narrative.pressure - 62) * 0.35,
      metrics.playedYoungster.name,
      ['giovane', `player:${metrics.playedYoungster.name}`]
    ));
  }

  if (metrics.won && narrative.pressure >= 68 && narrative.fanPatience <= 48) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'fans',
      'Risposta alla crisi',
      'Una vittoria arriva mentre pressione e pazienza dei tifosi erano gia compromesse.',
      54 + Math.max(0, narrative.pressure - 68) + Math.max(0, 50 - narrative.fanPatience),
      'risultato dopo tensione',
      ['rinascita', 'tifosi']
    ));
  }

  if (metrics.lowChanceLoss || metrics.poorPerformance) {
    signals.push(makeSignal(
      narrative,
      context.round,
      'media',
      'Critica al piano gara',
      metrics.lowChanceLoss
        ? 'Pochi tiri in porta dopo una sconfitta: la stampa cerca una causa tattica.'
        : 'Gli xG avversari raccontano una partita sfuggita al controllo.',
      48 + (metrics.recentLosses * 8) + (metrics.poorPerformance ? 10 : 0),
      'dati partita',
      ['media', 'tattica']
    ));
  }

  return signals
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, 8);
};

const recentCausalEventExists = (narrative: SeasonNarrativeState, causalKey: string, round: number, cooldown = 5) => (
  narrative.events.some(event => event.causalKey === causalKey && round - event.round <= cooldown)
);

const canExplode = (narrative: SeasonNarrativeState, context: AdvanceSeasonContext, causalKey: string, score: number, threshold: number, cooldown = 5) => {
  if (recentCausalEventExists(narrative, causalKey, context.round, cooldown)) return false;
  const timingNoise = seededRatio(`${narrative.seasonLabel}_${context.round}_${causalKey}`) * 16;
  return score >= threshold + 10 || score + timingNoise >= threshold;
};

const createCausalEvent = (
  narrative: SeasonNarrativeState,
  context: AdvanceSeasonContext,
  causalKey: string,
  score: number,
  title: string,
  description: string,
  consequence: string,
  tone: SeasonStoryEvent['tone'],
  causes: string[]
): SeasonStoryEvent => ({
  id: `causal_${causalKey}_${slug(narrative.seasonLabel)}_${context.round}_${Date.now()}`,
  chapter: narrative.currentChapter,
  round: context.round,
  title,
  description,
  consequence,
  tone,
  causalKey,
  causeScore: Math.round(score),
  causes: causes.slice(0, 4)
});

const selectCausalWorldImpact = (
  narrative: SeasonNarrativeState,
  context: AdvanceSeasonContext,
  metrics: NarrativeMetrics,
  signals: ExternalWorldSignal[]
): CausalWorldImpact | null => {
  const findSignal = (tag: string) => signals.find(signal => signal.tags.includes(tag));
  const signalLabels = (items: (ExternalWorldSignal | undefined)[]) => items.filter(Boolean).map(signal => `${signal?.label}: ${signal?.detail}`) as string[];
  const match = context.lastMatch;
  const candidates: (CausalWorldImpact & { score: number; threshold: number; cooldown?: number })[] = [];

  if (metrics.lost && match) {
    const rivalrySignal = findSignal('rivalita');
    const streakSignal = findSignal('forma');
    const fatigueSignal = findSignal('fatica');
    const promiseSignal = findSignal('promessa');
    const leaderSignal = findSignal('leader');
    const curvaSignal = findSignal('curva');
    const marketMemorySignal = findSignal('mercato');
    const causeSignals = signalLabels([rivalrySignal, streakSignal, fatigueSignal, promiseSignal, leaderSignal, curvaSignal, marketMemorySignal]);
    const score =
      32
      + (rivalrySignal?.intensity ?? 0) * 0.36
      + (streakSignal?.intensity ?? 0) * 0.25
      + (fatigueSignal?.intensity ?? 0) * 0.18
      + (promiseSignal?.intensity ?? 0) * 0.22
      + (leaderSignal?.intensity ?? 0) * 0.2
      + (curvaSignal?.intensity ?? 0) * 0.2
      + (marketMemorySignal?.intensity ?? 0) * 0.16
      + (metrics.heavyLoss ? 18 : 0)
      + Math.max(0, narrative.pressure - 66) * 0.45
      + Math.max(0, 48 - narrative.fanPatience) * 0.55;

    if (causeSignals.length >= 2 && canExplode(narrative, context, 'fan_crisis', score, 76, 4)) {
      const event = createCausalEvent(
        narrative,
        context,
        'fan_crisis',
        score,
        metrics.derbyOrHotRival ? 'La sconfitta diventa crisi di piazza' : 'La sconfitta accende la piazza',
        metrics.derbyOrHotRival
          ? `Perdere contro ${match.opponent} non basta da solo: pesa perche arriva sopra rivalita, forma e tensioni gia aperte.`
          : `Il risultato negativo diventa pubblico perche si somma a segnali che la carriera aveva gia accumulato.`,
        'Pressione mediatica e pazienza dei tifosi peggiorano: le prossime scelte dovranno dare una risposta leggibile.',
        'critical',
        causeSignals
      );
      candidates.push({
        score,
        threshold: 76,
        event,
        pressureDelta: 10,
        boardDelta: -5,
        beliefDelta: -5,
        fanDelta: -8,
        moraleDelta: -3,
        conditionDelta: -1,
        budgetDelta: 0,
        newsCategory: 'league',
        memory: {
          season: narrative.seasonLabel,
          category: metrics.derbyOrHotRival ? 'rivalry' : 'locker',
          title: event.title,
          description: `${event.description} Cause: ${event.causes?.join(' / ')}`,
          importance: 84,
          fanImpact: -8,
          dressingRoomImpact: -5,
          tags: ['causa', 'crisi', 'tifosi', metrics.derbyOrHotRival ? 'rivalita' : 'pressione'].filter(Boolean),
          opponent: match.opponent,
          score: `${context.club.shortName} ${match.scoreUser}-${match.scoreOpponent} ${match.opponent}`
        }
      });
    }
  }

  if (metrics.lost && (metrics.recentLosses >= 2 || metrics.lowChanceLoss || metrics.poorPerformance)) {
    const mediaSignal = findSignal('media');
    const streakSignal = findSignal('forma');
    const causes = signalLabels([mediaSignal, streakSignal]);
    const score = 42 + (mediaSignal?.intensity ?? 0) * 0.5 + metrics.recentLosses * 7 + Math.max(0, narrative.pressure - 70) * 0.35;
    if (causes.length >= 1 && canExplode(narrative, context, 'media_tactical_case', score, 73, 4)) {
      const event = createCausalEvent(
        narrative,
        context,
        'media_tactical_case',
        score,
        'La stampa apre il processo tattico',
        'Il dibattito non nasce dal risultato isolato: dati partita e forma recente danno un bersaglio preciso alle critiche.',
        'La fiducia nel piano cala: serve una prestazione coerente, non solo un risultato.',
        'warning',
        causes
      );
      candidates.push({
        score,
        threshold: 73,
        event,
        pressureDelta: 7,
        boardDelta: -3,
        beliefDelta: -3,
        fanDelta: -3,
        moraleDelta: -1,
        conditionDelta: 0,
        budgetDelta: 0,
        newsCategory: 'league',
        memory: {
          season: narrative.seasonLabel,
          category: 'coach',
          title: event.title,
          description: `${event.description} Cause: ${event.causes?.join(' / ')}`,
          importance: 70,
          fanImpact: -3,
          dressingRoomImpact: -3,
          tags: ['causa', 'media', 'tattica']
        }
      });
    }
  }

  if (metrics.promisesUnderPressure.length > 0 || metrics.captainUnhappy || metrics.unhappyCore >= 3) {
    const promiseSignal = findSignal('promessa');
    const leaderSignal = findSignal('leader');
    const agentSignal = findSignal('agenti');
    const causes = signalLabels([promiseSignal, leaderSignal, agentSignal]);
    if (metrics.unhappyCore >= 3) causes.push(`${metrics.unhappyCore} giocatori hanno morale basso o status cedibile.`);
    const score = 38 + (promiseSignal?.intensity ?? 0) * 0.44 + (leaderSignal?.intensity ?? 0) * 0.32 + (agentSignal?.intensity ?? 0) * 0.22 + metrics.unhappyCore * 7;
    if (causes.length >= 1 && canExplode(narrative, context, 'locker_hierarchy_case', score, 72, 5)) {
      const targetPromise = metrics.promisesUnderPressure[0];
      const targetPlayerName = targetPromise?.playerName ?? metrics.captain?.name;
      const severePromise = Boolean(targetPromise && context.round >= 10);
      const event = createCausalEvent(
        narrative,
        context,
        'locker_hierarchy_case',
        score,
        'Lo spogliatoio chiede gerarchie chiare',
        targetPromise
          ? `${targetPromise.playerName} sente che la promessa di ${targetPromise.promise.toLowerCase()} non sta diventando campo.`
          : 'Leader e seconde linee iniziano a leggere le scelte come segnali politici, non solo tecnici.',
        severePromise ? 'Una promessa entra nella memoria negativa: recuperare fiducia richiedera minuti e coerenza.' : 'La squadra accetta rotazioni solo se vede una logica chiara.',
        severePromise ? 'critical' : 'warning',
        causes
      );
      candidates.push({
        score,
        threshold: 72,
        event,
        pressureDelta: 5,
        boardDelta: -1,
        beliefDelta: -7,
        fanDelta: -2,
        moraleDelta: -4,
        conditionDelta: 0,
        budgetDelta: 0,
        newsCategory: 'training',
        promiseOutcome: severePromise && targetPromise ? 'broken' : undefined,
        targetPlayerName,
        memory: {
          season: narrative.seasonLabel,
          category: 'locker',
          title: event.title,
          description: `${event.description} Cause: ${event.causes?.join(' / ')}`,
          importance: severePromise ? 82 : 74,
          fanImpact: -2,
          dressingRoomImpact: -7,
          tags: ['causa', 'spogliatoio', severePromise ? 'promessa-tradita' : 'promessa-sotto-pressione', targetPlayerName ? `player:${targetPlayerName}` : ''].filter(Boolean),
          playerNames: targetPlayerName ? [targetPlayerName] : undefined
        }
      });
    }
  }

  if (context.budget < Math.max(2500000, context.club.transferBudget * 0.16) && (narrative.boardTrust < 50 || metrics.overPerformance <= -2)) {
    const financeSignal = findSignal('budget');
    const sponsorSignal = findSignal('sponsor');
    const causes = signalLabels([financeSignal, sponsorSignal]);
    const score = 48 + (financeSignal?.intensity ?? 0) * 0.5 + (sponsorSignal?.intensity ?? 0) * 0.18 + Math.max(0, 50 - narrative.boardTrust) * 0.5 + Math.max(0, -metrics.overPerformance) * 4;
    if (causes.length && canExplode(narrative, context, 'board_market_lock', score, 75, 8)) {
      const reduction = Math.min(context.budget, Math.max(1200000, Math.round(context.budget * 0.12)));
      const event = createCausalEvent(
        narrative,
        context,
        'board_market_lock',
        score,
        'La proprieta stringe il mercato',
        'Il blocco non arriva a caso: budget residuo, fiducia board e traiettoria sportiva stanno andando nella stessa direzione.',
        'Il margine mercato cala: prima di chiedere extra servono risultati o una cessione sostenibile.',
        'critical',
        causes
      );
      candidates.push({
        score,
        threshold: 75,
        event,
        pressureDelta: 6,
        boardDelta: -5,
        beliefDelta: -2,
        fanDelta: -2,
        moraleDelta: -1,
        conditionDelta: 0,
        budgetDelta: -reduction,
        newsCategory: 'board',
        memory: {
          season: narrative.seasonLabel,
          category: 'transfer',
          title: event.title,
          description: `${event.description} Cause: ${event.causes?.join(' / ')}`,
          importance: 78,
          fanImpact: -2,
          dressingRoomImpact: -2,
          tags: ['causa', 'budget', 'proprieta']
        }
      });
    }
  }

  if (metrics.veteranRenewal) {
    const renewalSignal = findSignal('rinnovo');
    const causes = signalLabels([renewalSignal]);
    const score = 46 + (renewalSignal?.intensity ?? 0) * 0.5 + Math.max(0, narrative.pressure - 65) * 0.24;
    if (causes.length && canExplode(narrative, context, 'veteran_renewal_case', score, 76, 10)) {
      const event = createCausalEvent(
        narrative,
        context,
        'veteran_renewal_case',
        score,
        `${metrics.veteranRenewal.name} vuole chiarezza sul rinnovo`,
        'Il caso nasce da campo, eta e contratto: un veterano usato molto non si sente un dettaglio amministrativo.',
        'Il board si aspetta una scelta: rinnovo, gestione minuti o addio preparato.',
        'warning',
        causes
      );
      candidates.push({
        score,
        threshold: 76,
        cooldown: 10,
        event,
        pressureDelta: 3,
        boardDelta: -2,
        beliefDelta: -2,
        fanDelta: 0,
        moraleDelta: -1,
        conditionDelta: 0,
        budgetDelta: 0,
        newsCategory: 'board',
        targetPlayerName: metrics.veteranRenewal.name,
        memory: {
          season: narrative.seasonLabel,
          category: 'locker',
          title: event.title,
          description: `${event.description} Cause: ${event.causes?.join(' / ')}`,
          importance: 68,
          fanImpact: 0,
          dressingRoomImpact: -2,
          tags: ['causa', 'rinnovo', `player:${metrics.veteranRenewal.name}`],
          playerNames: [metrics.veteranRenewal.name]
        }
      });
    }
  }

  if (metrics.won && metrics.playedYoungster && (narrative.pressure >= 64 || narrative.fanPatience <= 50 || metrics.recentLosses >= 1)) {
    const youthSignal = findSignal('giovane');
    const rescueSignal = findSignal('rinascita');
    const causes = signalLabels([youthSignal, rescueSignal]);
    const keptPromise = metrics.activePromises.some(promise => (
      promise.playerName === metrics.playedYoungster?.name
      && promiseLooksKept(promise, metrics.playedYoungster, context.round)
    ));
    const score = 44 + (youthSignal?.intensity ?? 0) * 0.48 + (rescueSignal?.intensity ?? 0) * 0.28 + (keptPromise ? 10 : 0);
    if (causes.length && canExplode(narrative, context, 'youngster_rebirth_symbol', score, 72, 5)) {
      const event = createCausalEvent(
        narrative,
        context,
        'youngster_rebirth_symbol',
        score,
        `${metrics.playedYoungster.name} cambia il racconto`,
        'La vittoria pesa di piu perche arriva con un giovane dentro un contesto di pressione reale.',
        'I tifosi vedono una via d uscita: il progetto giovani guadagna credito e lo spogliatoio respira.',
        'positive',
        causes
      );
      candidates.push({
        score,
        threshold: 72,
        event,
        pressureDelta: -5,
        boardDelta: 3,
        beliefDelta: 5,
        fanDelta: 7,
        moraleDelta: 3,
        conditionDelta: 0,
        budgetDelta: 0,
        newsCategory: 'league',
        promiseOutcome: keptPromise ? 'kept' : undefined,
        targetPlayerName: metrics.playedYoungster.name,
        memory: {
          season: narrative.seasonLabel,
          category: 'youth',
          title: event.title,
          description: `${event.description} Cause: ${event.causes?.join(' / ')}`,
          importance: 84,
          fanImpact: 7,
          dressingRoomImpact: 5,
          tags: ['causa', 'giovane-lanciato', keptPromise ? 'promessa-mantenuta' : '', `player:${metrics.playedYoungster.name}`].filter(Boolean),
          playerNames: [metrics.playedYoungster.name]
        }
      });
    }
  }

  if (metrics.won && narrative.pressure >= 70 && narrative.fanPatience <= 48) {
    const rescueSignal = findSignal('rinascita');
    const causes = signalLabels([rescueSignal]);
    const score = 48 + (rescueSignal?.intensity ?? 0) * 0.5 + Math.max(0, narrative.pressure - 70) * 0.3;
    if (causes.length && canExplode(narrative, context, 'crisis_response', score, 74, 4)) {
      const event = createCausalEvent(
        narrative,
        context,
        'crisis_response',
        score,
        'La squadra risponde quando serviva',
        'Il risultato diventa racconto perche arriva dopo tensione, pressione e pazienza ridotta.',
        'La crisi non sparisce, ma cambia tono: ora il progetto ha una prova a suo favore.',
        'positive',
        causes
      );
      candidates.push({
        score,
        threshold: 74,
        event,
        pressureDelta: -6,
        boardDelta: 4,
        beliefDelta: 5,
        fanDelta: 5,
        moraleDelta: 3,
        conditionDelta: 0,
        budgetDelta: 0,
        newsCategory: 'league',
        memory: {
          season: narrative.seasonLabel,
          category: 'match',
          title: event.title,
          description: `${event.description} Cause: ${event.causes?.join(' / ')}`,
          importance: 78,
          fanImpact: 5,
          dressingRoomImpact: 5,
          tags: ['causa', 'rinascita', 'risposta']
        }
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
};

const makeChoice = (
  id: string,
  label: string,
  style: NarrativeArcChoice['style'],
  description: string,
  benefit: string,
  cost: string,
  effect: NarrativeArcChoiceEffect
): NarrativeArcChoice => ({ id, label, style, description, benefit, cost, effect });

const buildArcChoices = (arcType: NarrativeArc['type'], protagonistName?: string): NarrativeArcChoice[] => {
  const name = protagonistName ?? 'il gruppo';

  switch (arcType) {
    case 'youngster_path':
      return [
        makeChoice(
          'minutes_plan',
          'Piano minuti condiviso',
          'diplomatic',
          `Parli con ${name}, agente e staff: minuti graduali, ruolo chiaro e verifica tra un mese.`,
          'Ricuce fiducia e protegge il progetto tecnico.',
          'Richiede coerenza: se poi non gioca, la prossima crisi sara piu dura.',
          {
            squadBeliefDelta: 3,
            fanPatienceDelta: 1,
            playerMoraleDelta: 5,
            playerCoachDelta: 5,
            arcHeatDelta: -24,
            resolveArc: true,
            memoryImportance: 72,
            memoryFanImpact: 2,
            memoryDressingRoomImpact: 4,
            stakeholderImpacts: { agents: 5, academy: 5, lockerRoom: 3 },
            tags: ['ricucitura', 'promessa-mantenuta']
          }
        ),
        makeChoice(
          'protected_loan',
          'Prestito o rotazione protetta',
          'pragmatic',
          `Gestisci ${name} come asset: percorso protetto, minuti misurati e meno rumore nello spogliatoio.`,
          'Riduce il conflitto e tutela il valore del giocatore.',
          'La curva puo leggerla come poca audacia con i giovani.',
          {
            boardTrustDelta: 2,
            playerMoraleDelta: 2,
            playerCoachDelta: 2,
            fanPatienceDelta: -1,
            arcHeatDelta: -18,
            resolveArc: true,
            memoryImportance: 66,
            memoryFanImpact: -1,
            memoryDressingRoomImpact: 2,
            stakeholderImpacts: { ownership: 3, agents: 3, academy: -2 },
            tags: ['gestione-asset']
          }
        ),
        makeChoice(
          'start_now',
          'Lanciarlo subito',
          'risky',
          `${name} entra al centro del progetto: titolarita immediata e responsabilita pubblica.`,
          'Puo trasformarlo in simbolo e accendere tifosi e vivaio.',
          'Alza il rischio sportivo: se sbaglia, pressione e media colpiranno forte.',
          {
            pressureDelta: 4,
            boardTrustDelta: -1,
            squadBeliefDelta: 2,
            fanPatienceDelta: 4,
            playerMoraleDelta: 8,
            playerFanDelta: 5,
            arcHeatDelta: -28,
            resolveArc: true,
            memoryImportance: 82,
            memoryFanImpact: 5,
            memoryDressingRoomImpact: 2,
            stakeholderImpacts: { academy: 8, fans: 4, curva: 3, press: 3 },
            tags: ['scommessa', 'giovane-lanciato']
          }
        )
      ];
    case 'renewal_case':
      return [
        makeChoice(
          'renew_leader',
          'Rinnovare il leader',
          'diplomatic',
          `Offri a ${name} un rinnovo breve con ruolo chiaro nello spogliatoio.`,
          'Stabilizza gerarchie e manda un messaggio ai veterani.',
          'Consuma budget e puo rallentare il ricambio.',
          {
            budgetDelta: -1400000,
            squadBeliefDelta: 4,
            boardTrustDelta: -2,
            playerMoraleDelta: 7,
            playerCoachDelta: 4,
            arcHeatDelta: -26,
            resolveArc: true,
            memoryImportance: 72,
            memoryFanImpact: 2,
            memoryDressingRoomImpact: 5,
            stakeholderImpacts: { lockerRoom: 5, ownership: -2, agents: 3 },
            tags: ['rinnovo', 'leader']
          }
        ),
        makeChoice(
          'delay_renewal',
          'Rinviare a fine stagione',
          'deferred',
          `Spieghi a ${name} che ogni discorso verra riaperto a obiettivo definito.`,
          'Tiene flessibile il budget e rimanda il costo.',
          'Il giocatore resta in bilico e l agente puo riaccendere il caso.',
          {
            boardTrustDelta: 2,
            squadBeliefDelta: -2,
            playerMoraleDelta: -3,
            playerCoachDelta: -3,
            arcHeatDelta: 8,
            resolveArc: false,
            memoryImportance: 58,
            memoryFanImpact: 0,
            memoryDressingRoomImpact: -2,
            stakeholderImpacts: { ownership: 2, agents: -4 },
            tags: ['rinvio', 'rinnovo']
          }
        ),
        makeChoice(
          'prepare_exit',
          'Preparare l addio',
          'hard',
          `Comunichi a ${name} che il ciclo tecnico guarda oltre e cerchi una separazione ordinata.`,
          'Libera spazio salariale e chiarisce la linea societaria.',
          'Puo ferire spogliatoio e tifosi se il giocatore e un simbolo.',
          {
            boardTrustDelta: 4,
            squadBeliefDelta: -5,
            fanPatienceDelta: -3,
            playerMoraleDelta: -10,
            playerCoachDelta: -8,
            arcHeatDelta: -14,
            resolveArc: true,
            permanent: true,
            memoryImportance: 78,
            memoryFanImpact: -4,
            memoryDressingRoomImpact: -5,
            stakeholderImpacts: { ownership: 4, lockerRoom: -5, fans: -3, curva: -4 },
            tags: ['addio-preparato', 'ferita']
          }
        )
      ];
    case 'fan_crisis':
    case 'market_wound':
      return [
        makeChoice(
          'public_accountability',
          'Assumersi responsabilita',
          'diplomatic',
          'Vai davanti a tifosi e stampa: spieghi cause, errori e prossimi passi.',
          'Riduce il rumore e mostra controllo emotivo.',
          'Espone l allenatore: se i risultati non arrivano, la frase resta in memoria.',
          {
            pressureDelta: -3,
            boardTrustDelta: -1,
            fanPatienceDelta: 5,
            squadBeliefDelta: 1,
            arcHeatDelta: -20,
            resolveArc: true,
            memoryImportance: 70,
            memoryFanImpact: 5,
            memoryDressingRoomImpact: 1,
            stakeholderImpacts: { fans: 5, curva: 4, press: 3, ownership: -1 },
            tags: ['responsabilita', 'ricucitura']
          }
        ),
        makeChoice(
          'defend_project',
          'Difendere il progetto',
          'hard',
          'Ribadisci che la linea tecnica non cambia per pressione esterna.',
          'Dai forza a proprietà e staff.',
          'Tifosi e curva possono viverla come distanza dal sentimento popolare.',
          {
            pressureDelta: 3,
            boardTrustDelta: 4,
            fanPatienceDelta: -5,
            squadBeliefDelta: 2,
            arcHeatDelta: 4,
            resolveArc: false,
            memoryImportance: 64,
            memoryFanImpact: -4,
            memoryDressingRoomImpact: 2,
            stakeholderImpacts: { ownership: 4, staff: 4, fans: -4, curva: -5, press: -2 },
            tags: ['linea-dura']
          }
        ),
        makeChoice(
          'bold_promise',
          'Promettere una svolta',
          'risky',
          'Alzi l asticella pubblica: punti, giovani o mercato devono cambiare il racconto subito.',
          'Può riaccendere entusiasmo e trasformare la crisi in sfida.',
          'Se non mantieni la promessa, diventa una ferita storica.',
          {
            pressureDelta: 6,
            fanPatienceDelta: 4,
            squadBeliefDelta: 3,
            arcHeatDelta: 10,
            resolveArc: false,
            memoryImportance: 76,
            memoryFanImpact: 3,
            memoryDressingRoomImpact: 2,
            stakeholderImpacts: { fans: 4, curva: 5, press: 4, ownership: -2 },
            tags: ['promessa-pubblica', 'rischio']
          }
        )
      ];
    case 'media_pressure':
      return [
        makeChoice(
          'open_training',
          'Aprire il lavoro',
          'diplomatic',
          'Concedi accesso controllato alla stampa e spieghi il piano tattico.',
          'Riduce speculazioni e rende leggibile il progetto.',
          'Dai informazioni anche agli avversari e accetti piu scrutinio.',
          {
            pressureDelta: -2,
            fanPatienceDelta: 2,
            squadBeliefDelta: 1,
            arcHeatDelta: -18,
            resolveArc: true,
            memoryImportance: 62,
            memoryFanImpact: 1,
            memoryDressingRoomImpact: 1,
            stakeholderImpacts: { press: 5, staff: -1 },
            tags: ['media', 'trasparenza']
          }
        ),
        makeChoice(
          'delegate_staff',
          'Delegare allo staff',
          'delegated',
          'Lasci parlare lo staff tecnico: il messaggio resta professionale e meno personale.',
          'Protegge l allenatore e abbassa il volume.',
          'Può sembrare una fuga se la crisi è già calda.',
          {
            pressureDelta: -1,
            boardTrustDelta: 1,
            squadBeliefDelta: -1,
            arcHeatDelta: -10,
            resolveArc: true,
            memoryImportance: 56,
            memoryFanImpact: 0,
            memoryDressingRoomImpact: -1,
            stakeholderImpacts: { staff: 3, press: 1 },
            tags: ['delegata', 'staff']
          }
        ),
        makeChoice(
          'attack_press',
          'Attaccare la stampa',
          'hard',
          'Trasformi le critiche in noi contro loro.',
          'Può compattare lo spogliatoio nel breve.',
          'Danneggia reputazione e tiene viva la polemica.',
          {
            pressureDelta: 4,
            squadBeliefDelta: 3,
            fanPatienceDelta: -2,
            arcHeatDelta: 8,
            resolveArc: false,
            memoryImportance: 64,
            memoryFanImpact: -1,
            memoryDressingRoomImpact: 3,
            stakeholderImpacts: { lockerRoom: 3, press: -7, sponsors: -2 },
            tags: ['media', 'scontro']
          }
        )
      ];
    case 'ownership_project':
      return [
        makeChoice(
          'accept_limits',
          'Accettare i limiti',
          'pragmatic',
          'Proteggi il bilancio e adatti obiettivi e mercato alla realtà economica.',
          'La proprietà guadagna fiducia e il budget resta sostenibile.',
          'La curva può leggerla come mancanza di ambizione.',
          {
            boardTrustDelta: 5,
            fanPatienceDelta: -3,
            pressureDelta: -1,
            arcHeatDelta: -18,
            resolveArc: true,
            memoryImportance: 66,
            memoryFanImpact: -2,
            memoryDressingRoomImpact: 0,
            stakeholderImpacts: { ownership: 6, sponsors: 3, curva: -4, agents: -2 },
            tags: ['sostenibilita']
          }
        ),
        makeChoice(
          'demand_backing',
          'Chiedere garanzie',
          'risky',
          'Metti pressione alla proprietà: senza supporto, l obiettivo va rivisto pubblicamente.',
          'Può sbloccare risorse e proteggere il tecnico.',
          'Rischia frattura con il board.',
          {
            pressureDelta: 5,
            boardTrustDelta: -6,
            fanPatienceDelta: 3,
            arcHeatDelta: 8,
            resolveArc: false,
            memoryImportance: 72,
            memoryFanImpact: 2,
            memoryDressingRoomImpact: 1,
            stakeholderImpacts: { ownership: -7, fans: 3, press: 4 },
            tags: ['proprieta', 'braccio-di-ferro']
          }
        ),
        makeChoice(
          'sporting_director',
          'Delegare al direttore',
          'delegated',
          'Sposti la tensione su una linea societaria condivisa.',
          'Riduce il conflitto personale con il board.',
          'Meno controllo diretto sulla narrazione.',
          {
            boardTrustDelta: 2,
            squadBeliefDelta: -1,
            arcHeatDelta: -10,
            resolveArc: true,
            memoryImportance: 58,
            memoryFanImpact: 0,
            memoryDressingRoomImpact: -1,
            stakeholderImpacts: { ownership: 2, staff: 2, press: -1 },
            tags: ['delegata', 'proprieta']
          }
        )
      ];
    case 'promise_case':
    default:
      return [
        makeChoice(
          'private_meeting',
          'Colloquio privato',
          'diplomatic',
          `Chiarisci con ${name} ruolo, minuti e aspettative.`,
          'Abbassa tensione e recupera rapporto.',
          'Non soddisfa chi chiede segnali pubblici.',
          {
            squadBeliefDelta: 2,
            playerMoraleDelta: 4,
            playerCoachDelta: 5,
            arcHeatDelta: -18,
            resolveArc: true,
            memoryImportance: 62,
            memoryFanImpact: 0,
            memoryDressingRoomImpact: 3,
            stakeholderImpacts: { lockerRoom: 3, agents: 3 },
            tags: ['colloquio', 'ricucitura']
          }
        ),
        makeChoice(
          'earn_place',
          'Meritocrazia dura',
          'hard',
          `${name} deve riconquistare spazio in allenamento, senza eccezioni.`,
          'Rafforza autorità e gerarchie.',
          'Può spingere giocatore e agente verso l uscita.',
          {
            boardTrustDelta: 1,
            squadBeliefDelta: -1,
            playerMoraleDelta: -7,
            playerCoachDelta: -7,
            arcHeatDelta: 8,
            resolveArc: false,
            memoryImportance: 64,
            memoryFanImpact: 0,
            memoryDressingRoomImpact: -2,
            stakeholderImpacts: { lockerRoom: -2, agents: -6, staff: 2 },
            tags: ['linea-dura', 'gerarchie']
          }
        ),
        makeChoice(
          'market_solution',
          'Aprire alla cessione',
          'pragmatic',
          `Comunichi a ${name} che valuterai offerte se il progetto non combacia.`,
          'Evita una lunga guerra interna e protegge il valore.',
          'Se esplode altrove, diventa una cicatrice.',
          {
            boardTrustDelta: 3,
            squadBeliefDelta: -3,
            fanPatienceDelta: -2,
            playerMoraleDelta: -5,
            arcHeatDelta: -8,
            resolveArc: true,
            permanent: true,
            memoryImportance: 78,
            memoryFanImpact: -3,
            memoryDressingRoomImpact: -4,
            stakeholderImpacts: { ownership: 3, agents: -1, academy: -4, fans: -2 },
            tags: ['cessione-aperta', 'cicatrice-potenziale']
          }
        )
      ];
  }
};

const arcStageForHeat = (arc: NarrativeArc, round: number): NarrativeArc['stage'] => {
  if (arc.status !== 'active') return arc.stage;
  if (arc.heat >= 78 || (arc.deadlineRound !== undefined && round >= arc.deadlineRound)) return 'critical';
  if (arc.heat >= 56 || round - arc.startedRound >= 2) return 'growth';
  return 'birth';
};

const ARC_MEMORY_WORTHY_HEAT = 74;
const HIGH_STAKES_ARC_HEAT = 70;
const HIGH_STAKES_ARC_TYPES: NarrativeArc['type'][] = ['fan_crisis', 'market_wound', 'ownership_project'];

const isMemoryWorthyArc = (arc: NarrativeArc) => (
  arc.status === 'permanent'
  || arc.stage === 'critical'
  || arc.heat >= ARC_MEMORY_WORTHY_HEAT
  || (HIGH_STAKES_ARC_TYPES.includes(arc.type) && arc.heat >= HIGH_STAKES_ARC_HEAT)
);

export const isDecisionWorthyArc = (arc: NarrativeArc) => (
  arc.status === 'active' && isMemoryWorthyArc(arc)
);

const stageLabel: Record<NarrativeArc['stage'], string> = {
  birth: 'nascita',
  growth: 'crescita',
  critical: 'punto critico',
  resolution: 'risoluzione',
  consequence: 'conseguenza'
};

const createArcEvent = (
  narrative: SeasonNarrativeState,
  arc: NarrativeArc,
  round: number,
  title: string,
  tone: SeasonStoryEvent['tone']
): SeasonStoryEvent => ({
  id: `arc_${arc.id}_${round}_${Date.now()}`,
  chapter: narrative.currentChapter,
  round,
  title,
  description: `${arc.summary} Fase: ${stageLabel[arc.stage]}.`,
  consequence: isDecisionWorthyArc(arc)
    ? `Serve una scelta: ${arc.stakes}${arc.relatedClub && arc.type === 'youngster_path' ? `. Il ${arc.relatedClub} osserva la situazione` : ''}.`
    : arc.stage === 'growth'
      ? `La storia resta aperta: ${arc.stakes}`
      : 'La carriera registra un nuovo filo narrativo.',
  tone,
  causalKey: `arc:${arc.type}`,
  causeScore: Math.round(arc.heat),
  causes: [arc.summary, arc.stakes]
});

const makeArc = (
  narrative: SeasonNarrativeState,
  context: AdvanceSeasonContext,
  type: NarrativeArc['type'],
  title: string,
  summary: string,
  stakes: string,
  heat: number,
  protagonistName?: string,
  relatedClub?: string,
  deadlineOffset = 4
): NarrativeArc => ({
  id: `arc_${type}_${slug(protagonistName ?? relatedClub ?? title)}`,
  type,
  title,
  protagonistName,
  relatedClub,
  stage: 'birth',
  status: 'active',
  startedRound: context.round,
  lastRound: context.round,
  deadlineRound: context.round + deadlineOffset,
  heat: Math.round(clamp(heat, 0, 100)),
  summary,
  stakes,
  choices: buildArcChoices(type, protagonistName),
  history: [`${narrative.seasonLabel}, G${context.round}: nasce - ${summary}`]
});

const buildArcCandidates = (
  narrative: SeasonNarrativeState,
  context: AdvanceSeasonContext,
  metrics: NarrativeMetrics,
  signals: ExternalWorldSignal[]
): NarrativeArc[] => {
  const candidates: NarrativeArc[] = [];
  const signalWithTag = (tag: string) => signals.find(signal => signal.tags.includes(tag));
  const promiseSignal = signalWithTag('promessa');
  const renewalSignal = signalWithTag('rinnovo');
  const curvaSignal = signalWithTag('curva');
  const mediaSignal = signalWithTag('media');
  const financeSignal = signalWithTag('budget');
  const marketSignal = signalWithTag('mercato');

  if (metrics.promisesUnderPressure[0]) {
    const promise = metrics.promisesUnderPressure[0];
    const player = context.players.find(item => item.name === promise.playerName);
    const isYoung = (player?.age ?? 30) <= 22 || promise.promise.toLowerCase().includes('giovane');
    const rivalObserver = knownRivalries[context.club.name]?.[0] ?? knownRivalries[context.club.shortName]?.[0] ?? 'un club rivale';
    candidates.push(makeArc(
      narrative,
      context,
      isYoung ? 'youngster_path' : 'promise_case',
      isYoung ? `${promise.playerName} vuole diventare parte del progetto` : `Caso promessa: ${promise.playerName}`,
      `${promise.playerName} aspettava ${promise.promise.toLowerCase()}, ma il campo non ha ancora confermato il patto.`,
      isYoung
        ? `rilanciarlo, proteggerlo o rischiare una rottura con agente, vivaio e interesse del ${rivalObserver}`
        : 'ricucire il rapporto, imporre gerarchie o preparare una soluzione di mercato',
      promiseSignal?.intensity ?? 62,
      promise.playerName,
      isYoung ? rivalObserver : undefined,
      isYoung ? 4 : 3
    ));
  }

  if (metrics.veteranRenewal) {
    candidates.push(makeArc(
      narrative,
      context,
      'renewal_case',
      `${metrics.veteranRenewal.name} e il rinnovo che pesa`,
      `${metrics.veteranRenewal.name} gioca molto, ha contratto breve e leadership sufficiente per condizionare lo spogliatoio.`,
      'rinnovare, rinviare o preparare un addio senza rompere il gruppo',
      renewalSignal?.intensity ?? 58,
      metrics.veteranRenewal.name,
      undefined,
      5
    ));
  }

  if ((curvaSignal && metrics.lost) || (metrics.curvaMood < 38 && metrics.recentLosses >= 2)) {
    candidates.push(makeArc(
      narrative,
      context,
      'fan_crisis',
      'La piazza chiede una risposta',
      `Curva e tifosi arrivano gia carichi: forma, rivalita o ferite di mercato stanno amplificando ogni risultato.`,
      'parlare alla piazza, difendere il progetto o alzare pubblicamente la posta',
      Math.max(curvaSignal?.intensity ?? 0, 62 + metrics.recentLosses * 6),
      undefined,
      context.club.shortName,
      3
    ));
  }

  if (marketSignal) {
    candidates.push(makeArc(
      narrative,
      context,
      'market_wound',
      'La ferita di mercato torna nel presente',
      marketSignal.detail,
      'ricucire con una risposta tecnica, difendere la scelta o trasformarla in una promessa pubblica',
      marketSignal.intensity,
      undefined,
      context.club.shortName,
      5
    ));
  }

  if (mediaSignal && (metrics.recentLosses >= 1 || metrics.poorPerformance)) {
    candidates.push(makeArc(
      narrative,
      context,
      'media_pressure',
      'La stampa cerca il punto debole',
      mediaSignal.detail,
      'spiegare il lavoro, delegare allo staff o usare lo scontro per compattare il gruppo',
      mediaSignal.intensity,
      undefined,
      context.club.shortName,
      3
    ));
  }

  if (financeSignal && (metrics.ownershipMood < 50 || context.budget < Math.max(2500000, context.club.transferBudget * 0.16))) {
    candidates.push(makeArc(
      narrative,
      context,
      'ownership_project',
      'La proprieta misura il progetto',
      financeSignal.detail,
      'accettare limiti, chiedere garanzie o delegare la tensione alla struttura societaria',
      financeSignal.intensity,
      undefined,
      context.club.shortName,
      4
    ));
  }

  return candidates;
};

const advanceNarrativeArcs = (
  narrative: SeasonNarrativeState,
  context: AdvanceSeasonContext,
  metrics: NarrativeMetrics,
  signals: ExternalWorldSignal[]
): NarrativeArcImpact => {
  const events: SeasonStoryEvent[] = [];
  const news: NarrativeArcImpact['news'] = [];
  const memories: ClubMemoryDraft[] = [];
  let pressureDelta = 0;
  let boardDelta = 0;
  let beliefDelta = 0;
  let fanDelta = 0;
  const candidates = buildArcCandidates(narrative, context, metrics, signals);
  const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const currentArcs = narrative.arcs ?? [];

  const nextArcs = currentArcs.map(arc => {
    if (arc.status !== 'active') return arc;
    const candidate = candidateById.get(arc.id);
    const previousStage = arc.stage;
    const nextHeat = candidate
      ? clamp(arc.heat * 0.72 + candidate.heat * 0.38 + 6, 0, 100)
      : clamp(arc.heat - 4, 0, 100);
    const updated: NarrativeArc = {
      ...arc,
      heat: Math.round(nextHeat),
      lastRound: context.round,
      summary: candidate?.summary ?? arc.summary,
      stakes: candidate?.stakes ?? arc.stakes,
      choices: buildArcChoices(arc.type, arc.protagonistName)
    };
    updated.stage = arcStageForHeat(updated, context.round);
    if (updated.stage !== previousStage) {
      updated.history = [`${narrative.seasonLabel}, G${context.round}: ${stageLabel[updated.stage]} - ${updated.stakes}`, ...updated.history].slice(0, 8);
      const event = createArcEvent(
        narrative,
        updated,
        context.round,
        updated.stage === 'critical' ? `Punto critico: ${updated.title}` : `L'arco cresce: ${updated.title}`,
        updated.stage === 'critical' ? 'critical' : 'warning'
      );
      news.push({ title: event.title, content: `${event.description} ${event.consequence}`, category: updated.type === 'media_pressure' ? 'league' : 'training' });
      if (isMemoryWorthyArc(updated)) {
        events.push(event);
        memories.push({
          season: narrative.seasonLabel,
          category: updated.type === 'youngster_path' ? 'youth' : updated.type === 'market_wound' ? 'transfer' : 'locker',
          title: event.title,
          description: event.description,
          importance: updated.stage === 'critical' ? 76 : Math.round(clamp(updated.heat, 62, 74)),
          fanImpact: updated.stage === 'critical' ? -2 : updated.type === 'fan_crisis' || updated.type === 'market_wound' ? -1 : 0,
          dressingRoomImpact: updated.stage === 'critical' ? -3 : -1,
          persistence: updated.stage === 'critical' || updated.heat >= 82 ? 'long' : 'season',
          tags: ['arco-narrativo', updated.type, updated.stage, updated.protagonistName ? `player:${updated.protagonistName}` : ''].filter(Boolean),
          playerNames: updated.protagonistName ? [updated.protagonistName] : undefined
        });
      }
      if (updated.stage === 'critical') {
        pressureDelta += 3;
        beliefDelta -= 2;
        fanDelta -= updated.type === 'fan_crisis' || updated.type === 'market_wound' ? 3 : 1;
      }
    }
    return updated;
  });

  candidates.forEach(candidate => {
    const alreadyTracked = nextArcs.some(arc => arc.id === candidate.id);
    const wasResolved = currentArcs.some(arc => arc.id === candidate.id && arc.status !== 'active');
    if (alreadyTracked || wasResolved) return;
    const event = createArcEvent(narrative, candidate, context.round, `Nasce un arco: ${candidate.title}`, 'warning');
    news.push({ title: event.title, content: `${event.description} ${event.consequence}`, category: candidate.type === 'ownership_project' ? 'board' : candidate.type === 'media_pressure' ? 'league' : 'training' });
    if (isMemoryWorthyArc(candidate)) {
      events.push(event);
      memories.push({
        season: narrative.seasonLabel,
        category: candidate.type === 'youngster_path' ? 'youth' : candidate.type === 'market_wound' ? 'transfer' : 'locker',
        title: event.title,
        description: event.description,
        importance: Math.round(clamp(candidate.heat, 60, 76)),
        fanImpact: candidate.type === 'fan_crisis' || candidate.type === 'market_wound' ? -2 : 0,
        dressingRoomImpact: candidate.type === 'ownership_project' ? 0 : -1,
        persistence: candidate.heat >= 82 ? 'long' : 'season',
        tags: ['arco-narrativo', candidate.type, 'birth', candidate.protagonistName ? `player:${candidate.protagonistName}` : ''].filter(Boolean),
        playerNames: candidate.protagonistName ? [candidate.protagonistName] : undefined
      });
    }
    nextArcs.push(candidate);
  });

  const arcs = nextArcs
    .filter(arc => arc.status !== 'active' || arc.heat >= 18 || arc.stage === 'critical')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.heat - a.heat;
    })
    .slice(0, 14);

  return { arcs, events, news, memories, pressureDelta, boardDelta, beliefDelta, fanDelta };
};

const applyCausalPromiseOutcome = (
  players: Player[],
  impact: CausalWorldImpact | null
) => {
  if (!impact?.promiseOutcome || !impact.targetPlayerName) return players;
  return players.map(player => {
    if (player.name !== impact.targetPlayerName) return player;
    const kept = impact.promiseOutcome === 'kept';
    return {
      ...player,
      morale: Math.round(clamp(player.morale + (kept ? 6 : -8), 0, 100)),
      relationships: {
        ...player.relationships,
        coach: Math.round(clamp(player.relationships.coach + (kept ? 5 : -8), 0, 100)),
        fans: Math.round(clamp(player.relationships.fans + (kept ? 4 : -3), 0, 100))
      },
      careerMemory: {
        ...player.careerMemory,
        promisesKept: player.careerMemory.promisesKept + (kept ? 1 : 0),
        promisesBroken: player.careerMemory.promisesBroken + (kept ? 0 : 1)
      }
    };
  });
};

const applyPlayerMood = (players: Player[], moraleDelta: number, conditionDelta = 0) => (
  players.map(player => ({
    ...player,
    morale: Math.round(clamp(player.morale + moraleDelta + (player.personality.professionalism - 50) * 0.025, 5, 100)),
    condition: Math.round(clamp(player.condition + conditionDelta, 5, 100)),
    status: player.condition + conditionDelta < 55 ? 'Stanco' as const : player.status
  }))
);

const getWeakestMoodLeaders = (players: Player[]) => (
  [...players]
    .filter(player => player.role !== 'GK')
    .sort((a, b) => (a.morale + a.condition) - (b.morale + b.condition))
    .slice(0, 2)
);

const getDynamicChapterForContext = (
  narrative: SeasonNarrativeState,
  round: number,
  seasonFinished: boolean | undefined,
  standing: Standing | undefined,
  expectedRank: number,
  players: Player[]
): SeasonChapterKey => {
  if (seasonFinished) return 'summer';
  if (round >= 38) return 'epilogue';
  if (round >= 30) return 'finalRun';
  if (round >= 19) return 'winterMarket';

  const form = standing?.form ?? [];
  const recentLosses = form.filter(result => result === 'L').length;
  const overPerformance = standing ? expectedRank - standing.rank : 0;
  const tiredCore = players.filter(player => player.condition < 62 || player.status === 'Stanco').length;
  const unhappyCore = players.filter(player => player.morale < 48).length;
  const crisisScore =
    recentLosses * 16 +
    Math.max(0, -overPerformance) * 5 +
    Math.max(0, tiredCore - 4) * 4 +
    unhappyCore * 5 +
    Math.max(0, narrative.pressure - 68) * 0.55 +
    Math.max(0, 48 - narrative.squadBelief) * 0.6;
  const canTriggerPressureNode = round >= 8 && round <= 27 && !narrative.triggeredChapters.includes('novemberCrisis');

  if (canTriggerPressureNode && crisisScore >= 58) return 'novemberCrisis';
  if (narrative.currentChapter === 'novemberCrisis' && round < 19) return 'novemberCrisis';
  if (round >= 5) return 'projectCheck';
  return 'preseason';
};

export const advanceSeasonNarrative = (
  narrative: SeasonNarrativeState,
  context: AdvanceSeasonContext
): SeasonChapterImpact => {
  const normalized = normalizeSeasonNarrative(narrative, context.club, context.teamDNA);
  const standing = context.standings.find(team => team.name === context.club.name);
  const expectedRank = getExpectedRank(context.club);
  const chapterKey = getDynamicChapterForContext(normalized, context.round, context.seasonFinished, standing, expectedRank, context.players);
  const chapter = SEASON_CHAPTERS[chapterKey];
  const metrics = buildNarrativeMetrics(normalized, context, standing, expectedRank);
  const worldSignals = buildWorldSignals(normalized, context, metrics);
  const causalImpact = selectCausalWorldImpact(normalized, context, metrics, worldSignals);
  const arcImpact = advanceNarrativeArcs(normalized, context, metrics, worldSignals);
  const overPerformance = standing ? expectedRank - standing.rank : 0;
  const form = standing?.form ?? [];
  const recentLosses = form.filter(result => result === 'L').length;
  const recentWins = form.filter(result => result === 'W').length;
  const alreadyTriggered = normalized.triggeredChapters.includes(chapterKey);

  const baseNext: SeasonNarrativeState = {
    ...normalized,
    currentChapter: chapterKey,
    arcTitle: chapter.title,
    arcSummary: buildArcSummary(context.club, context.teamDNA, standing),
    keyQuestion: chapter.question,
    worldSignals,
    arcs: arcImpact.arcs
  };

  let chapterEvent: SeasonStoryEvent | null = null;
  let pressureDelta = 0;
  let boardDelta = 0;
  let beliefDelta = 0;
  let fanDelta = 0;
  let moraleDelta = 0;
  let conditionDelta = 0;
  let budgetDelta = 0;
  const memories: ClubMemoryDraft[] = [];
  const standingLabel = standing ? `${standing.rank}a, ${standing.points} punti` : 'classifica ancora vuota';
  const crisisPlayers = getWeakestMoodLeaders(context.players).map(player => player.name).join(', ');

  if (!alreadyTriggered) {
    switch (chapterKey) {
      case 'projectCheck': {
        const positive = overPerformance >= 2 || recentWins >= 3;
        chapterEvent = createChapterEvent(
          chapterKey,
          context.round,
          positive ? 'Il progetto prende forma' : 'Primo bivio tecnico',
          positive
            ? `${context.club.shortName} e ${standingLabel}: il gruppo inizia a credere nel piano ${TEAM_DNA_DEFINITIONS[context.teamDNA.active].shortName}.`
            : `${context.club.shortName} e ${standingLabel}: il board vuole capire se il piano e davvero sostenibile.`,
          positive ? 'Spogliatoio piu convinto e tifosi piu pazienti.' : 'Aumenta la pressione: le prossime scelte tattiche peseranno di piu.',
          positive ? 'positive' : 'warning'
        );
        pressureDelta = positive ? -4 : 7;
        boardDelta = positive ? 6 : -5;
        beliefDelta = positive ? 7 : -4;
        fanDelta = positive ? 5 : -4;
        moraleDelta = positive ? 3 : -2;
        break;
      }
      case 'novemberCrisis': {
        const hardCrisis = recentLosses >= 3 || overPerformance <= -4;
        chapterEvent = createChapterEvent(
          chapterKey,
          context.round,
          hardCrisis ? 'La stagione diventa una prova di nervi' : 'La pressione chiede gestione',
          hardCrisis
            ? `Calendario e pressione colpiscono: ${crisisPlayers || 'alcuni titolari'} mostrano segnali di fatica e lo spogliatoio chiede risposte.`
            : `La squadra entra nella fase sporca della stagione: rotazioni, gestione fisica e panchine diventano decisive.`,
          hardCrisis ? 'Morale e condizione calano: serve ruotare e ritrovare risultati.' : 'La rosa accetta rotazioni se il progetto resta coerente.',
          hardCrisis ? 'critical' : 'warning'
        );
        pressureDelta = hardCrisis ? 12 : 5;
        boardDelta = hardCrisis ? -7 : 0;
        beliefDelta = hardCrisis ? -8 : -2;
        fanDelta = hardCrisis ? -7 : -2;
        moraleDelta = hardCrisis ? -5 : -2;
        conditionDelta = hardCrisis ? -5 : -2;
        break;
      }
      case 'winterMarket': {
        const needRescue = overPerformance <= -3 || recentLosses >= 3;
        chapterEvent = createChapterEvent(
          chapterKey,
          context.round,
          needRescue ? 'Gennaio: salvare la stagione' : 'Gennaio: continuita o occasione',
          needRescue
            ? `La societa apre un extra budget per correggere la rosa: il campionato chiede interventi immediati.`
            : `Il board non vuole mosse disperate: ogni acquisto deve rispettare DNA e futuro del club.`,
          needRescue ? 'Budget extra disponibile, ma fiducia board piu fragile.' : 'Piccolo margine mercato e fiducia se non rompi gli equilibri.',
          needRescue ? 'critical' : 'neutral'
        );
        budgetDelta = needRescue ? Math.round(Math.max(4500000, context.club.transferBudget * 0.12)) : Math.round(Math.max(1800000, context.club.transferBudget * 0.04));
        pressureDelta = needRescue ? 8 : -1;
        boardDelta = needRescue ? -3 : 3;
        beliefDelta = needRescue ? -2 : 2;
        fanDelta = needRescue ? -2 : 2;
        break;
      }
      case 'finalRun': {
        const targetAlive = standing ? standing.rank <= expectedRank + 2 : true;
        chapterEvent = createChapterEvent(
          chapterKey,
          context.round,
          targetAlive ? 'La corsa finale accende tutto' : 'Finale in salita',
          targetAlive
            ? `${context.club.shortName} e dentro il suo obiettivo: ogni punto puo cambiare reputazione, mercato e memoria dei tifosi.`
            : `${context.club.shortName} rincorre: servono partite coraggiose per evitare una stagione incompiuta.`,
          targetAlive ? 'Pressione alta ma fiducia forte nei leader.' : 'Pressione alta, tifosi meno pazienti e gruppo sotto esame.',
          targetAlive ? 'positive' : 'critical'
        );
        pressureDelta = targetAlive ? 6 : 12;
        boardDelta = targetAlive ? 5 : -7;
        beliefDelta = targetAlive ? 6 : -6;
        fanDelta = targetAlive ? 4 : -6;
        moraleDelta = targetAlive ? 2 : -3;
        break;
      }
      case 'epilogue': {
        const successful = standing ? standing.rank <= expectedRank : false;
        chapterEvent = createChapterEvent(
          chapterKey,
          context.round,
          successful ? 'Epilogo: stagione che lascia traccia' : 'Epilogo: conti aperti',
          successful
            ? `${context.club.shortName} chiude ${standingLabel}: record, leader e DNA finiscono nella memoria del club.`
            : `${context.club.shortName} chiude ${standingLabel}: l estate portera scelte difficili e possibili addii.`,
          successful ? 'Fiducia board e reputazione interna crescono.' : 'La prossima estate avra piu tensione e meno pazienza.',
          successful ? 'positive' : 'warning'
        );
        pressureDelta = successful ? -8 : 7;
        boardDelta = successful ? 9 : -8;
        beliefDelta = successful ? 8 : -5;
        fanDelta = successful ? 7 : -5;
        moraleDelta = successful ? 4 : -3;
        memories.push({
          season: normalized.seasonLabel,
          category: successful ? 'record' : 'legacy',
          title: chapterEvent.title,
          description: chapterEvent.description,
          importance: successful ? 82 : 70,
          fanImpact: successful ? 5 : -3,
          dressingRoomImpact: successful ? 4 : -2,
          tags: ['stagione', 'epilogo', chapterKey]
        });
        break;
      }
      case 'summer': {
        const revolution = normalized.boardTrust < 45 || normalized.fanPatience < 40;
        chapterEvent = createChapterEvent(
          chapterKey,
          context.round,
          revolution ? 'Estate: aria di rivoluzione' : 'Estate: continuita intelligente',
          revolution
            ? `Il club entra in estate con tensioni aperte: qualche leader puo partire e il mercato dovra cambiare volto alla rosa.`
            : `Il club protegge il ciclo: continuita, pochi innesti mirati e ruoli piu chiari per ripartire.`,
          revolution ? 'Pressione alta nella nuova stagione, ma budget di manovra leggermente piu alto.' : 'Fiducia e morale ripartono meglio.',
          revolution ? 'warning' : 'positive'
        );
        pressureDelta = revolution ? 8 : -7;
        boardDelta = revolution ? -2 : 5;
        beliefDelta = revolution ? -3 : 5;
        fanDelta = revolution ? -4 : 4;
        moraleDelta = revolution ? -2 : 3;
        budgetDelta = revolution ? Math.round(context.club.transferBudget * 0.06) : 0;
        memories.push({
          season: normalized.seasonLabel,
          category: 'legacy',
          title: chapterEvent.title,
          description: chapterEvent.description,
          importance: revolution ? 76 : 70,
          fanImpact: revolution ? -2 : 3,
          dressingRoomImpact: revolution ? -2 : 3,
          tags: ['estate', 'continuita', 'rivoluzione']
        });
        break;
      }
      case 'preseason':
      default:
        chapterEvent = createChapterEvent(
          chapterKey,
          context.round,
          `Preseason: nasce il patto ${context.club.shortName}`,
          `Il board chiede ${context.club.objective.toLowerCase()} e la rosa entra in stagione con DNA ${TEAM_DNA_DEFINITIONS[context.teamDNA.active].shortName}.`,
          'Il patto iniziale diventa il metro con cui verranno giudicati i prossimi capitoli.',
          'neutral'
        );
        break;
    }
  }

  if (causalImpact) {
    pressureDelta += causalImpact.pressureDelta;
    boardDelta += causalImpact.boardDelta;
    beliefDelta += causalImpact.beliefDelta;
    fanDelta += causalImpact.fanDelta;
    moraleDelta += causalImpact.moraleDelta;
    conditionDelta += causalImpact.conditionDelta;
    budgetDelta += causalImpact.budgetDelta;
    memories.push(causalImpact.memory);
  }

  pressureDelta += arcImpact.pressureDelta;
  boardDelta += arcImpact.boardDelta;
  beliefDelta += arcImpact.beliefDelta;
  fanDelta += arcImpact.fanDelta;
  memories.push(...arcImpact.memories);

  const eventsToAdd = [causalImpact?.event, ...arcImpact.events, chapterEvent].filter(Boolean) as SeasonStoryEvent[];

  if (!eventsToAdd.length) {
    return {
      narrative: baseNext,
      players: context.players,
      budgetDelta: 0,
      news: arcImpact.news,
      memories: []
    };
  }

  const nextNarrative: SeasonNarrativeState = {
    ...baseNext,
    triggeredChapters: alreadyTriggered ? baseNext.triggeredChapters : [...baseNext.triggeredChapters, chapterKey],
    pressure: Math.round(clamp(baseNext.pressure + pressureDelta, 0, 100)),
    boardTrust: Math.round(clamp(baseNext.boardTrust + boardDelta, 0, 100)),
    squadBelief: Math.round(clamp(baseNext.squadBelief + beliefDelta, 0, 100)),
    fanPatience: Math.round(clamp(baseNext.fanPatience + fanDelta, 0, 100)),
    events: [...eventsToAdd, ...baseNext.events].slice(0, 18)
  };

  const players = applyCausalPromiseOutcome(
    applyPlayerMood(context.players, moraleDelta, conditionDelta),
    causalImpact
  );
  const eventNews = eventsToAdd.map(event => ({
    title: event.title,
    content: `${event.description} ${event.causes?.length ? `Cause: ${event.causes.join(' / ')}. ` : ''}Conseguenza: ${event.consequence}`,
    category: event.causalKey?.startsWith('arc:')
      ? 'training' as const
      : event.causalKey
      ? causalImpact?.newsCategory ?? 'league'
      : chapterKey === 'winterMarket' ? 'market' as const : chapterKey === 'novemberCrisis' ? 'training' as const : 'board' as const
  }));
  const eventNewsTitles = new Set(eventNews.map(item => item.title));
  const news = [
    ...eventNews,
    ...arcImpact.news.filter(item => !eventNewsTitles.has(item.title))
  ];

  if (chapterEvent) {
    memories.push({
      season: normalized.seasonLabel,
      category: chapterKey === 'winterMarket' ? 'transfer' : chapterKey === 'novemberCrisis' ? 'locker' : 'legacy',
      title: chapterEvent.title,
      description: chapterEvent.description,
      importance: chapterEvent.tone === 'critical' ? 78 : chapterEvent.tone === 'positive' ? 74 : 66,
      fanImpact: fanDelta,
      dressingRoomImpact: beliefDelta,
      tags: ['capitolo-stagione', chapterKey]
    });
  }

  return {
    narrative: nextNarrative,
    players,
    budgetDelta,
    news,
    memories
  };
};

const arcMemoryCategory = (arc: NarrativeArc): ClubMemoryDraft['category'] => {
  if (arc.type === 'youngster_path') return 'youth';
  if (arc.type === 'market_wound' || arc.type === 'ownership_project') return 'transfer';
  if (arc.type === 'fan_crisis') return 'legacy';
  if (arc.type === 'media_pressure') return 'coach';
  return 'locker';
};

const arcNewsCategory = (arc: NarrativeArc): 'board' | 'training' | 'market' | 'league' => {
  if (arc.type === 'ownership_project') return 'board';
  if (arc.type === 'market_wound') return 'market';
  if (arc.type === 'fan_crisis' || arc.type === 'media_pressure') return 'league';
  return 'training';
};

export const resolveNarrativeArcChoice = (
  narrative: SeasonNarrativeState,
  context: ResolveNarrativeArcContext
): ResolveNarrativeArcResult => {
  const normalized = {
    ...narrative,
    arcs: narrative.arcs ?? []
  };
  const arc = normalized.arcs.find(item => item.id === context.arcId);
  const choice = arc?.choices.find(item => item.id === context.choiceId);

  if (!arc || !choice || !isDecisionWorthyArc(arc)) {
    return {
      narrative: normalized,
      players: context.players,
      budgetDelta: 0,
      news: [],
      memories: []
    };
  }

  const effect = choice.effect;
  const resolved = Boolean(effect.resolveArc);
  const permanent = Boolean(effect.permanent);
  const nextArc: NarrativeArc = {
    ...arc,
    status: permanent ? 'permanent' : resolved ? 'resolved' : 'active',
    stage: permanent ? 'consequence' : resolved ? 'resolution' : arc.stage === 'critical' ? 'growth' : arc.stage,
    heat: Math.round(clamp(arc.heat + (effect.arcHeatDelta ?? 0), 0, 100)),
    lastRound: arc.lastRound,
    outcome: choice.label,
    history: [
      `Scelta ${choice.style}: ${choice.label}. Beneficio: ${choice.benefit} Costo: ${choice.cost}`,
      ...arc.history
    ].slice(0, 10),
    choices: resolved || permanent ? [] : buildArcChoices(arc.type, arc.protagonistName)
  };

  const event: SeasonStoryEvent = {
    id: `arc_choice_${arc.id}_${choice.id}_${Date.now()}`,
    chapter: normalized.currentChapter,
    round: arc.lastRound,
    title: `Scelta sull'arco: ${arc.title}`,
    description: `${choice.label}: ${choice.description}`,
    consequence: `${choice.benefit} Costo: ${choice.cost}`,
    tone: permanent ? 'warning' : resolved ? 'positive' : 'neutral',
    causalKey: `choice:${arc.type}`,
    causeScore: nextArc.heat,
    causes: [arc.summary, arc.stakes]
  };

  const players = context.players.map(player => {
    if (!arc.protagonistName || player.name !== arc.protagonistName) return player;
    return {
      ...player,
      morale: Math.round(clamp(player.morale + (effect.playerMoraleDelta ?? 0), 0, 100)),
      relationships: {
        ...player.relationships,
        coach: Math.round(clamp(player.relationships.coach + (effect.playerCoachDelta ?? 0), 0, 100)),
        fans: Math.round(clamp(player.relationships.fans + (effect.playerFanDelta ?? 0), 0, 100))
      },
      careerMemory: {
        ...player.careerMemory,
        promisesKept: player.careerMemory.promisesKept + (effect.tags?.includes('promessa-mantenuta') ? 1 : 0),
        promisesBroken: player.careerMemory.promisesBroken + (effect.tags?.some(tag => tag.includes('cicatrice')) ? 1 : 0)
      }
    };
  });

  const nextNarrative: SeasonNarrativeState = {
    ...normalized,
    pressure: Math.round(clamp(normalized.pressure + (effect.pressureDelta ?? 0), 0, 100)),
    boardTrust: Math.round(clamp(normalized.boardTrust + (effect.boardTrustDelta ?? 0), 0, 100)),
    squadBelief: Math.round(clamp(normalized.squadBelief + (effect.squadBeliefDelta ?? 0), 0, 100)),
    fanPatience: Math.round(clamp(normalized.fanPatience + (effect.fanPatienceDelta ?? 0), 0, 100)),
    arcs: [
      nextArc,
      ...normalized.arcs.filter(item => item.id !== arc.id)
    ].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.heat - a.heat;
    }).slice(0, 14),
    events: [event, ...normalized.events].slice(0, 18)
  };

  const memory: ClubMemoryDraft = {
    season: normalized.seasonLabel,
    category: arcMemoryCategory(arc),
    title: event.title,
    description: `${choice.description} Beneficio: ${choice.benefit} Costo: ${choice.cost}`,
    importance: effect.memoryImportance ?? (permanent ? 80 : resolved ? 70 : 62),
    fanImpact: effect.memoryFanImpact ?? (effect.fanPatienceDelta ?? 0),
    dressingRoomImpact: effect.memoryDressingRoomImpact ?? (effect.squadBeliefDelta ?? 0),
    persistence: permanent ? 'permanent' : resolved ? 'long' : 'season',
    stakeholderImpacts: effect.stakeholderImpacts,
    tags: ['scelta-giocatore', arc.type, choice.style, ...(effect.tags ?? []), arc.protagonistName ? `player:${arc.protagonistName}` : ''].filter(Boolean),
    playerNames: arc.protagonistName ? [arc.protagonistName] : undefined
  };

  return {
    narrative: nextNarrative,
    players,
    budgetDelta: effect.budgetDelta ?? 0,
    news: [{
      title: event.title,
      content: `${event.description} ${event.consequence}`,
      category: arcNewsCategory(arc)
    }],
    memories: [memory]
  };
};

export const startNextSeasonNarrative = (
  previous: SeasonNarrativeState,
  club: ClubProfile,
  teamDNA: TeamDNAState
) => {
  const next = createInitialSeasonNarrative(club, teamDNA, previous.seasonIndex + 1);
  const carriedArcs = (previous.arcs ?? [])
    .filter(arc => arc.status === 'active' || arc.status === 'permanent')
    .map(arc => ({
      ...arc,
      heat: arc.status === 'permanent' ? arc.heat : Math.round(clamp(arc.heat * 0.72, 18, 82)),
      stage: arc.status === 'permanent' ? 'consequence' as const : arc.stage,
      history: [`${next.seasonLabel}: l'arco entra nella nuova stagione con forza ${Math.round(arc.heat)}.`, ...arc.history].slice(0, 10)
    }))
    .slice(0, 8);
  return {
    ...next,
    pressure: Math.round(clamp((previous.pressure + next.pressure) / 2, 0, 100)),
    boardTrust: Math.round(clamp(previous.boardTrust * 0.45 + 35, 25, 82)),
    squadBelief: Math.round(clamp(previous.squadBelief * 0.48 + 34, 25, 85)),
    fanPatience: Math.round(clamp(previous.fanPatience * 0.5 + 30, 25, 82)),
    arcs: carriedArcs,
    events: [
      ...next.events,
      ...previous.events.slice(0, 4)
    ].slice(0, 18)
  };
};
