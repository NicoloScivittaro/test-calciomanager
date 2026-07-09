import {
  ClubMemoryDraft,
  EmotionalNarrative,
  EmotionalNarrativeMoment,
  EmotionalNarrativeState,
  EmotionalNarrativeStatus,
  EmotionalNarrativeType,
  MatchEmotionalImpact,
  MatchEvent,
  MatchStats,
  NewsItem,
  Player,
  PlayerPublicProfile,
  Standing
} from '../types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// Cooldown (in match rounds) between two brand-new "major" narratives, so a strong
// story stays rare. Bypassed by NARRATIVE_MAJOR_IMPORTANCE (derby/final/eccezionale).
const NARRATIVE_COOLDOWN_ROUNDS = 5;
const NARRATIVE_MAJOR_IMPORTANCE = 82;
const NEW_NARRATIVE_SCORE_THRESHOLD = 34;
const NARRATIVE_FADE_THRESHOLD = 22;

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const pickVariant = <T,>(seed: string, options: T[]): T => options[hashString(seed) % options.length];

const makeId = (prefix: string, seed: string) => `${prefix}_${seed}_${hashString(seed)}`;

// ─── Match emotional impact ───

export interface EmotionalNarrativeMatchContext {
  matchId: string;
  round: number;
  season: string;
  seasonFinished: boolean;
  teamName: string;
  opponentName: string;
  scoreUser: number;
  scoreOpponent: number;
  ownRating: number;
  opponentRating: number;
  standings: Standing[];
  rivalryHeat: number;
  events: MatchEvent[];
  stats: MatchStats;
  prematchPlayers: Player[];
  postmatchPlayers: Player[];
  playedPlayerIds: string[];
  starterIds: string[];
}

const getStandingRank = (standings: Standing[], name: string) => standings.find(team => team.name === name)?.rank;

const computeMatchImportance = (context: EmotionalNarrativeMatchContext) => {
  const totalTeams = context.standings.length || 20;
  const relegationZoneRank = totalTeams - 3;
  const europeZoneRank = 4;
  const ownRank = getStandingRank(context.standings, context.teamName) ?? Math.round(totalTeams / 2);
  const oppRank = getStandingRank(context.standings, context.opponentName) ?? Math.round(totalTeams / 2);

  let importance = 20;
  if (context.round >= 30) importance += 22;
  else if (context.round >= 22) importance += 10;

  if (context.rivalryHeat >= 60) importance += 22;
  else if (context.rivalryHeat >= 38) importance += 10;

  if (ownRank <= europeZoneRank || oppRank <= europeZoneRank) importance += 10;
  if (ownRank >= relegationZoneRank || oppRank >= relegationZoneRank) importance += 14;
  if (Math.abs(ownRank - oppRank) <= 2) importance += 8;

  return Math.round(clamp(importance, 0, 100));
};

const analyzeGoalTimeline = (events: MatchEvent[]) => {
  let userGoals = 0;
  let opponentGoals = 0;
  let wasTrailing = false;
  let lateDecisiveUserGoal = false;

  [...events]
    .filter(event => event.type === 'goal')
    .sort((a, b) => a.minute - b.minute)
    .forEach(event => {
      if (event.team === 'user') {
        userGoals += 1;
        if (event.minute >= 80 && userGoals >= opponentGoals) lateDecisiveUserGoal = true;
      } else {
        opponentGoals += 1;
      }
      if (opponentGoals > userGoals) wasTrailing = true;
    });

  return { wasTrailing, lateDecisiveUserGoal };
};

interface PlayerContribution {
  goals: number;
  assists: number;
  lateContribution: boolean;
}

interface MatchAnalysis {
  impact: MatchEmotionalImpact;
  cleanSheet: boolean;
  contributions: Map<string, PlayerContribution>;
}

const buildMatchAnalysis = (context: EmotionalNarrativeMatchContext): MatchAnalysis => {
  const strengthGap = Math.round(context.opponentRating - context.ownRating);
  const matchImportance = computeMatchImportance(context);
  const timeline = analyzeGoalTimeline(context.events);
  const diff = context.scoreUser - context.scoreOpponent;
  const absDiff = Math.abs(diff);
  const won = diff > 0;
  const lost = diff < 0;
  const draw = diff === 0;
  const cleanSheet = context.scoreOpponent === 0;

  const isUpset = won && strengthGap >= 8;
  const isComeback = timeline.wasTrailing && !lost;
  const isHeroicDefeat = (lost || draw) && strengthGap >= 9 && absDiff <= 1;

  const reasons: string[] = [];
  if (isUpset) reasons.push(`Vittoria contro un avversario stimato ${strengthGap} punti di forza sopra la squadra.`);
  if (isComeback) reasons.push('La squadra era sotto nel punteggio e ha reagito prima del fischio finale.');
  if (isHeroicDefeat) reasons.push(`Sconfitta o pareggio di misura contro una squadra nettamente più forte (+${strengthGap}).`);
  if (matchImportance >= 70) reasons.push('Partita ad alta posta in palio tra classifica, rivalità o calendario.');
  if (cleanSheet && (won || draw)) reasons.push('Porta inviolata in una gara pesante.');

  let score = matchImportance * 0.32;
  score += clamp(strengthGap, 0, 30) * (won || draw ? 0.5 : 0.3);
  score += isComeback ? 14 : 0;
  score += isHeroicDefeat ? 20 : 0;
  score += isUpset ? 16 : 0;
  score += timeline.lateDecisiveUserGoal ? 10 : 0;

  const impact: MatchEmotionalImpact = {
    matchId: context.matchId,
    round: context.round,
    score: Math.round(clamp(score, 0, 100)),
    matchImportance,
    strengthGap,
    isUpset,
    isHeroicDefeat,
    isComeback,
    reasons
  };

  const contributions = new Map<string, PlayerContribution>();
  const addContribution = (playerId: string | undefined, key: 'goals' | 'assists', minute: number) => {
    if (!playerId) return;
    const current = contributions.get(playerId) ?? { goals: 0, assists: 0, lateContribution: false };
    current[key] += 1;
    if (minute >= 80) current.lateContribution = true;
    contributions.set(playerId, current);
  };

  context.events.forEach(event => {
    if (event.type !== 'goal' || event.team !== 'user') return;
    addContribution(event.playerId, 'goals', event.minute);
    addContribution(event.assistPlayerId, 'assists', event.minute);
  });

  return { impact, cleanSheet, contributions };
};

export const evaluateMatchEmotionalImpact = (context: EmotionalNarrativeMatchContext): MatchEmotionalImpact => (
  buildMatchAnalysis(context).impact
);

// ─── Candidate detection ───

export interface EmotionalNarrativeCandidate {
  type: EmotionalNarrativeType;
  playerId?: string;
  playerName?: string;
  baseImportance: number;
  reasons: string[];
  titleOptions: string[];
  descriptionOptions: string[];
}

interface PlayerNarrativeProfile {
  isStarter: boolean;
  isYoungster: boolean;
  isVeteran: boolean;
  isUnderPressure: boolean;
}

const classifyPlayer = (player: Player, starterIds: string[]): PlayerNarrativeProfile => ({
  isStarter: starterIds.includes(player.id),
  isYoungster: player.age <= 21,
  isVeteran: player.age >= 33,
  isUnderPressure: player.status === 'Cedibile' || player.morale <= 44 || player.form <= 5.4 || player.relationships.fans <= 42
});

const heroDescriptor = (profile: PlayerNarrativeProfile, isGoalkeeper: boolean) => {
  if (isGoalkeeper) return 'portiere';
  if (profile.isVeteran) return 'veterano';
  if (profile.isYoungster) return 'giovane';
  if (!profile.isStarter) return 'riserva';
  return 'meno considerato';
};

const detectNarrativeCandidates = (
  context: EmotionalNarrativeMatchContext,
  analysis: MatchAnalysis
): EmotionalNarrativeCandidate[] => {
  const candidates: EmotionalNarrativeCandidate[] = [];
  const { impact, cleanSheet, contributions } = analysis;
  const won = context.scoreUser > context.scoreOpponent;
  const draw = context.scoreUser === context.scoreOpponent;

  if ((won || draw) && impact.strengthGap >= 8) {
    candidates.push({
      type: 'underdog_run',
      baseImportance: clamp(38 + impact.matchImportance * 0.25 + impact.strengthGap * 0.6, 30, 92),
      reasons: [...impact.reasons, `${context.teamName} tiene testa a un avversario stimato ${impact.strengthGap} punti sopra.`],
      titleOptions: ['La favola della stagione', `${context.teamName} non si spaventa più`, 'Il piccolo che gioca alla pari'],
      descriptionOptions: [
        `${context.teamName} si toglie lo sfizio contro ${context.opponentName}: il divario di forza c'era, il risultato racconta altro.`,
        `Contro ${context.opponentName} nessuno si aspettava questo esito: la piazza inizia a crederci davvero.`,
        `Un'altra big non riesce a piegare ${context.teamName}: la resistenza sta diventando un'abitudine.`
      ]
    });
  }

  if (impact.isHeroicDefeat) {
    candidates.push({
      type: 'heroic_defeat',
      baseImportance: clamp(48 + impact.matchImportance * 0.3 + impact.strengthGap * 0.7, 40, 94),
      reasons: [...impact.reasons],
      titleOptions: ["L'ultima resistenza", 'Sconfitta a testa alta', 'Il muro che ha retto quasi fino alla fine'],
      descriptionOptions: [
        `Sotto per valore rispetto a ${context.opponentName}, ${context.teamName} resta in partita fino ai minuti finali ed esce sconfitta senza aver mai mollato.`,
        `Il tabellino dice sconfitta o pareggio, ma la prestazione contro ${context.opponentName} lascia un segno diverso tra spogliatoio e curva.`,
        `${context.teamName} cede il passo a ${context.opponentName} solo nel finale, dopo aver retto un urto che sembrava impossibile.`
      ]
    });
  }

  contributions.forEach((contribution, playerId) => {
    const player = context.prematchPlayers.find(item => item.id === playerId);
    if (!player) return;
    const profile = classifyPlayer(player, context.starterIds);
    const decisive = contribution.goals > 0 || contribution.assists > 0;
    if (!decisive) return;

    const isNotable = !profile.isStarter || profile.isYoungster || profile.isVeteran;
    if (isNotable && (impact.matchImportance >= 42 || impact.strengthGap >= 6)) {
      const descriptor = heroDescriptor(profile, false);
      candidates.push({
        type: 'unexpected_hero',
        playerId,
        playerName: player.name,
        baseImportance: clamp(42 + impact.matchImportance * 0.28 + (contribution.lateContribution ? 12 : 0), 35, 92),
        reasons: [`${player.name} (${descriptor}) decisivo in una gara pesante contro ${context.opponentName}.`, ...impact.reasons],
        titleOptions: ['Eroe inatteso', 'Il nome nuovo della stagione', 'Chi non ti aspetti diventa decisivo'],
        descriptionOptions: [
          profile.isVeteran
            ? `Dopo mesi ai margini, il veterano ${player.name} decide la sfida contro ${context.opponentName} e riscrive il proprio ruolo in stagione.`
            : profile.isYoungster
              ? `${player.name}, cresciuto nel vivaio, segna o decide nel momento più pesante contro ${context.opponentName} e conquista la fiducia della piazza.`
              : `Partito dalle rotazioni, ${player.name} entra nella partita contro ${context.opponentName} e la cambia.`
        ]
      });
    }

    if (profile.isUnderPressure && impact.matchImportance >= 35) {
      candidates.push({
        type: 'redemption_arc',
        playerId,
        playerName: player.name,
        baseImportance: clamp(40 + impact.matchImportance * 0.3, 32, 88),
        reasons: [`${player.name} era in discussione ed è stato decisivo contro ${context.opponentName}.`, ...impact.reasons],
        titleOptions: ['Riscatto', `Il ritorno di ${player.name}`, 'Da bersaglio a protagonista'],
        descriptionOptions: [
          `Contestato nelle ultime settimane, ${player.name} risponde nel modo migliore possibile: decisivo contro ${context.opponentName} quando la squadra aveva più bisogno di lui.`,
          `${player.name} arrivava da un momento difficile: la prova contro ${context.opponentName} è il primo passo di un possibile riscatto.`
        ]
      });
    }
  });

  if (cleanSheet && (won || draw) && impact.matchImportance >= 42) {
    const goalkeeper = context.prematchPlayers.find(player => player.role === 'GK' && context.playedPlayerIds.includes(player.id));
    if (goalkeeper) {
      const profile = classifyPlayer(goalkeeper, context.starterIds);
      if (profile.isVeteran || profile.isYoungster || !profile.isStarter) {
        candidates.push({
          type: 'unexpected_hero',
          playerId: goalkeeper.id,
          playerName: goalkeeper.name,
          baseImportance: clamp(44 + impact.matchImportance * 0.28, 35, 90),
          reasons: [`${goalkeeper.name} blinda la porta in una gara pesante contro ${context.opponentName}.`, ...impact.reasons],
          titleOptions: ['Eroe inatteso', 'Il muro silenzioso'],
          descriptionOptions: [
            `${goalkeeper.name} tiene la porta inviolata contro ${context.opponentName} in una serata che pesava più del solito.`
          ]
        });
      }
    }
  }

  return candidates;
};

// ─── Narrative creation & evolution ───

const nextStage = (importance: number, momentsCount: number): EmotionalNarrative['stage'] => {
  if (importance >= 85 && momentsCount >= 3) return 'culmine';
  if (importance >= 65 || momentsCount >= 2) return 'in_crescita';
  return 'nascente';
};

export const createEmotionalNarrative = (
  candidate: EmotionalNarrativeCandidate,
  context: EmotionalNarrativeMatchContext
): EmotionalNarrative => {
  const seed = `${context.matchId}_${candidate.type}_${candidate.playerId ?? context.teamName}`;
  const now = new Date().toISOString();
  const moment: EmotionalNarrativeMoment = {
    id: makeId('moment', seed),
    round: context.round,
    matchId: context.matchId,
    dateLabel: `Giornata ${context.round}`,
    title: pickVariant(seed, candidate.titleOptions),
    description: pickVariant(`${seed}_desc`, candidate.descriptionOptions)
  };

  return {
    id: makeId('narrative', seed),
    type: candidate.type,
    club: context.teamName,
    playerId: candidate.playerId,
    playerName: candidate.playerName,
    season: context.season,
    title: moment.title,
    description: moment.description,
    stage: 'nascente',
    importance: Math.round(candidate.baseImportance),
    status: 'attiva',
    reasons: candidate.reasons.slice(0, 6),
    relatedMatchIds: [context.matchId],
    moments: [moment],
    consequencesApplied: [],
    createdRound: context.round,
    updatedAt: now
  };
};

export const updateEmotionalNarrative = (
  existing: EmotionalNarrative,
  candidate: EmotionalNarrativeCandidate,
  context: EmotionalNarrativeMatchContext
): { narrative: EmotionalNarrative; stageEscalated: boolean } => {
  const seed = `${context.matchId}_${existing.id}`;
  const moment: EmotionalNarrativeMoment = {
    id: makeId('moment', seed),
    round: context.round,
    matchId: context.matchId,
    dateLabel: `Giornata ${context.round}`,
    title: pickVariant(seed, candidate.titleOptions),
    description: pickVariant(`${seed}_desc`, candidate.descriptionOptions)
  };

  const importance = Math.round(clamp(existing.importance * 0.55 + candidate.baseImportance * 0.55, 0, 100));
  const moments = [moment, ...existing.moments].slice(0, 8);
  const stage = nextStage(importance, moments.length);

  const narrative: EmotionalNarrative = {
    ...existing,
    importance,
    stage,
    reasons: Array.from(new Set([...candidate.reasons, ...existing.reasons])).slice(0, 8),
    relatedMatchIds: Array.from(new Set([context.matchId, ...existing.relatedMatchIds])).slice(0, 12),
    moments,
    updatedAt: new Date().toISOString()
  };

  return { narrative, stageEscalated: stage !== existing.stage };
};

const decayNarrative = (narrative: EmotionalNarrative): EmotionalNarrative => {
  if (narrative.status !== 'attiva') return narrative;
  const importance = Math.round(narrative.importance * 0.9);
  if (importance < NARRATIVE_FADE_THRESHOLD) {
    return { ...narrative, importance, status: 'conclusa', stage: 'in_dissolvenza', updatedAt: new Date().toISOString() };
  }
  return { ...narrative, importance };
};

// ─── Player public profile ───

export const upsertPlayerPublicProfile = (
  profiles: PlayerPublicProfile[],
  player: Player,
  moment: EmotionalNarrativeMoment,
  narrativeTitle: string,
  narrativeId: string,
  popularityGain: number
): PlayerPublicProfile[] => {
  const now = new Date().toISOString();
  const existing = profiles.find(profile => profile.playerId === player.id);

  if (!existing) {
    return [...profiles, {
      playerId: player.id,
      playerName: player.name,
      popularity: Math.round(clamp(38 + popularityGain, 0, 100)),
      mediaAttention: Math.round(clamp(34 + popularityGain * 0.8, 0, 100)),
      followersEstimate: Math.round(1200 + popularityGain * 380 + player.overall * 40),
      narrativeTitles: [narrativeTitle],
      activeNarrativeIds: [narrativeId],
      iconicMoments: [moment],
      updatedAt: now
    }];
  }

  return profiles.map(profile => (profile.playerId === player.id ? {
    ...profile,
    playerName: player.name,
    popularity: Math.round(clamp(profile.popularity + popularityGain, 0, 100)),
    mediaAttention: Math.round(clamp(profile.mediaAttention + popularityGain * 0.6, 0, 100)),
    followersEstimate: Math.round(profile.followersEstimate + popularityGain * 260),
    narrativeTitles: profile.narrativeTitles.includes(narrativeTitle)
      ? profile.narrativeTitles
      : [narrativeTitle, ...profile.narrativeTitles].slice(0, 8),
    activeNarrativeIds: profile.activeNarrativeIds.includes(narrativeId)
      ? profile.activeNarrativeIds
      : [narrativeId, ...profile.activeNarrativeIds].slice(0, 6),
    iconicMoments: [moment, ...profile.iconicMoments].slice(0, 6),
    updatedAt: now
  } : profile));
};

const decayPlayerProfile = (profile: PlayerPublicProfile): PlayerPublicProfile => ({
  ...profile,
  popularity: Math.round(clamp(profile.popularity * 0.985, 0, 100)),
  mediaAttention: Math.round(clamp(profile.mediaAttention * 0.93, 0, 100))
});

// ─── State lifecycle & persistence ───

export const createInitialEmotionalNarrativeState = (): EmotionalNarrativeState => ({
  narratives: [],
  playerProfiles: [],
  lastMajorNarrativeRound: 0,
  updatedAt: new Date().toISOString()
});

export const normalizeEmotionalNarrativeState = (value: unknown): EmotionalNarrativeState => {
  if (!value || typeof value !== 'object') return createInitialEmotionalNarrativeState();
  const raw = value as Partial<EmotionalNarrativeState>;
  const validStatuses: EmotionalNarrativeStatus[] = ['attiva', 'conclusa', 'storica'];

  return {
    narratives: Array.isArray(raw.narratives)
      ? raw.narratives.filter((item): item is EmotionalNarrative => (
        Boolean(item) && typeof item === 'object' && validStatuses.includes((item as EmotionalNarrative).status)
      ))
      : [],
    playerProfiles: Array.isArray(raw.playerProfiles)
      ? raw.playerProfiles.filter((item): item is PlayerPublicProfile => Boolean(item) && typeof item === 'object')
      : [],
    lastMajorNarrativeRound: typeof raw.lastMajorNarrativeRound === 'number' ? raw.lastMajorNarrativeRound : 0,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
  };
};

// ─── Main integration entry point (called after a match is finished) ───

interface ProcessMatchResult {
  state: EmotionalNarrativeState;
  memories: ClubMemoryDraft[];
  news: { title: string; content: string; category: NewsItem['category'] }[];
}

const buildNarrativeMemory = (narrative: EmotionalNarrative, matchLabel: string): ClubMemoryDraft => ({
  season: narrative.season,
  category: narrative.playerName ? 'legacy' : 'match',
  title: narrative.title,
  description: narrative.description,
  importance: Math.round(clamp(narrative.importance, 30, 96)),
  fanImpact: narrative.type === 'heroic_defeat' ? 5 : 6,
  dressingRoomImpact: 4,
  tags: [
    'emotional-narrative',
    narrative.type,
    ...(narrative.playerName ? [] : ['partita-iconica']),
    ...(narrative.playerName ? [`player:${narrative.playerName}`] : [])
  ],
  playerNames: narrative.playerName ? [narrative.playerName] : undefined,
  score: matchLabel
});

const buildNarrativeNews = (narrative: EmotionalNarrative, isNew: boolean) => ({
  title: isNew ? `Nasce una storia: ${narrative.title}` : `${narrative.title}: la storia continua`,
  content: narrative.description,
  category: 'league' as NewsItem['category']
});

export const processMatchForEmotionalNarratives = (
  state: EmotionalNarrativeState,
  context: EmotionalNarrativeMatchContext
): ProcessMatchResult => {
  const normalized = normalizeEmotionalNarrativeState(state);
  const analysis = buildMatchAnalysis(context);
  const candidates = detectNarrativeCandidates(context, analysis);
  const matchLabel = `${context.teamName} ${context.scoreUser}-${context.scoreOpponent} ${context.opponentName}`;

  const memories: ClubMemoryDraft[] = [];
  const news: { title: string; content: string; category: NewsItem['category'] }[] = [];
  const reinforcedIds = new Set<string>();
  const touchedPlayerIds = new Set<string>();

  let narratives = [...normalized.narratives];
  let profiles = [...normalized.playerProfiles];
  let lastMajorRound = normalized.lastMajorNarrativeRound;

  const canSpawnMajor = context.round - lastMajorRound >= NARRATIVE_COOLDOWN_ROUNDS
    || analysis.impact.matchImportance >= NARRATIVE_MAJOR_IMPORTANCE;

  candidates.forEach(candidate => {
    const existing = narratives.find(item => (
      item.status === 'attiva'
      && item.type === candidate.type
      && item.club === context.teamName
      && (candidate.playerId ? item.playerId === candidate.playerId : !item.playerId)
    ));

    let activeNarrative: EmotionalNarrative | null = null;
    let isNew = false;

    if (existing) {
      const { narrative, stageEscalated } = updateEmotionalNarrative(existing, candidate, context);
      narratives = narratives.map(item => (item.id === existing.id ? narrative : item));
      reinforcedIds.add(narrative.id);
      activeNarrative = narrative;
      if (stageEscalated) {
        memories.push(buildNarrativeMemory(narrative, matchLabel));
        news.push(buildNarrativeNews(narrative, false));
      }
    } else if (analysis.impact.score >= NEW_NARRATIVE_SCORE_THRESHOLD && canSpawnMajor) {
      const created = createEmotionalNarrative(candidate, context);
      narratives = [created, ...narratives];
      reinforcedIds.add(created.id);
      lastMajorRound = context.round;
      isNew = true;
      activeNarrative = created;
      memories.push(buildNarrativeMemory(created, matchLabel));
      news.push(buildNarrativeNews(created, true));
    }

    if (activeNarrative && candidate.playerId) {
      const player = context.postmatchPlayers.find(item => item.id === candidate.playerId)
        ?? context.prematchPlayers.find(item => item.id === candidate.playerId);
      if (player) {
        const moment = activeNarrative.moments[0];
        const popularityGain = isNew ? 10 : 5;
        profiles = upsertPlayerPublicProfile(profiles, player, moment, activeNarrative.title, activeNarrative.id, popularityGain);
        touchedPlayerIds.add(player.id);
      }
    }
  });

  narratives = narratives
    .map(narrative => (reinforcedIds.has(narrative.id) ? narrative : decayNarrative(narrative)))
    .slice(0, 40);

  if (context.seasonFinished) {
    narratives = narratives.map(narrative => {
      if (narrative.status !== 'attiva') return narrative;
      if (narrative.importance >= 60 && narrative.moments.length >= 2) {
        return { ...narrative, status: 'storica', stage: 'leggenda', updatedAt: new Date().toISOString() };
      }
      return { ...narrative, status: 'conclusa', stage: 'in_dissolvenza', updatedAt: new Date().toISOString() };
    });
  }

  profiles = profiles
    .map(profile => (touchedPlayerIds.has(profile.playerId) ? profile : decayPlayerProfile(profile)))
    .slice(0, 60);

  return {
    state: {
      narratives,
      playerProfiles: profiles,
      lastMajorNarrativeRound: lastMajorRound,
      updatedAt: new Date().toISOString()
    },
    memories,
    news
  };
};

// ─── UI helpers ───

export const getTopEmotionalNarratives = (state: EmotionalNarrativeState, limit = 3) => (
  [...state.narratives]
    .filter(narrative => narrative.status !== 'conclusa')
    .sort((a, b) => b.importance - a.importance)
    .slice(0, limit)
);

export const getPlayerPublicProfile = (state: EmotionalNarrativeState, playerId: string) => (
  state.playerProfiles.find(profile => profile.playerId === playerId)
);

export const NARRATIVE_TYPE_LABELS: Record<EmotionalNarrativeType, string> = {
  underdog_run: 'Favola della stagione',
  unexpected_hero: 'Eroe inatteso',
  heroic_defeat: 'Sconfitta eroica',
  redemption_arc: 'Riscatto'
};

export const formatFollowersEstimate = (value: number) => (
  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`
);
