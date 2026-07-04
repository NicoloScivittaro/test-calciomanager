import { createPlayersForClub } from '../data/serieAData';
import {
  ClubHistoryEntry,
  ClubHistoryState,
  ClubMemory,
  ClubMemoryActor,
  ClubMemoryDraft,
  ClubMemoryPersistence,
  ClubProfile,
  ClubRivalry,
  ClubStakeholderKey,
  ClubStakeholderState,
  MatchEvent,
  MatchStats,
  Player
} from '../types';

export const CURRENT_SEASON = '2026/27';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const makeId = (prefix: string) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

const MEMORY_DECAY: Record<ClubMemoryPersistence, number> = {
  short: 0.86,
  season: 0.982,
  long: 0.997,
  permanent: 1
};

const STAKEHOLDER_LABELS: Record<ClubStakeholderKey, string> = {
  ownership: 'Proprieta',
  fans: 'Tifosi',
  curva: 'Curva',
  sponsors: 'Sponsor',
  lockerRoom: 'Spogliatoio',
  staff: 'Staff',
  press: 'Stampa',
  agents: 'Agenti',
  academy: 'Vivaio'
};

const STAKEHOLDER_INTERESTS: Record<ClubStakeholderKey, string[]> = {
  ownership: ['sostenibilita', 'obiettivo sportivo', 'asset del club'],
  fans: ['risultati', 'identita', 'giocatori simbolo'],
  curva: ['derby', 'coraggio', 'fedelta alla maglia'],
  sponsors: ['reputazione', 'visibilita', 'stabilita'],
  lockerRoom: ['gerarchie chiare', 'promesse mantenute', 'gestione fisica'],
  staff: ['coerenza tecnica', 'fiducia', 'tempo di lavoro'],
  press: ['narrazione', 'accesso', 'coerenza pubblica'],
  agents: ['minuti', 'contratti', 'valorizzazione'],
  academy: ['spazio ai giovani', 'percorso credibile', 'identita locale']
};

const createStakeholder = (
  key: ClubStakeholderKey,
  mood: number,
  influence: number,
  patience: number
): ClubStakeholderState => ({
  key,
  name: STAKEHOLDER_LABELS[key],
  mood: Math.round(clamp(mood, 0, 100)),
  influence,
  patience: Math.round(clamp(patience, 0, 100)),
  interests: STAKEHOLDER_INTERESTS[key]
});

export const createInitialStakeholders = (club: ClubProfile): ClubStakeholderState[] => {
  const pressure = club.pressure;
  const budgetScale = clamp(club.transferBudget / 100000000, 0.1, 1.2);

  return [
    createStakeholder('ownership', 58, 86, clamp(62 - pressure * 0.16, 40, 72)),
    createStakeholder('fans', clamp(58 + pressure * 0.08, 48, 70), 82, clamp(66 - pressure * 0.2, 38, 68)),
    createStakeholder('curva', clamp(56 + pressure * 0.04, 44, 66), 76, clamp(58 - pressure * 0.22, 28, 60)),
    createStakeholder('sponsors', clamp(58 + budgetScale * 7, 52, 68), 58, 70),
    createStakeholder('lockerRoom', 72, 78, 64),
    createStakeholder('staff', 66, 54, 72),
    createStakeholder('press', clamp(52 - pressure * 0.03, 44, 58), 62, 46),
    createStakeholder('agents', 55, 48, 54),
    createStakeholder('academy', club.academy.toLowerCase().includes('forte') ? 68 : 58, 44, 74)
  ];
};

const fallbackStakeholders = (clubName: string): ClubStakeholderState[] => {
  const syntheticClub: ClubProfile = {
    id: clubName.toLowerCase().replace(/[^a-z0-9]+/gi, '_'),
    name: clubName,
    shortName: clubName,
    initials: clubName.slice(0, 3).toUpperCase(),
    city: '',
    stadium: '',
    stadiumCapacity: 0,
    ownership: '',
    transferBudget: 40000000,
    clubValue: 0,
    objective: '',
    boardPromise: '',
    playStyle: '',
    academy: '',
    fanbase: '',
    pressure: 70,
    difficulty: 'Media',
    primaryColor: '#111827',
    secondaryColor: '#F59E0B',
    highlight: ''
  };
  return createInitialStakeholders(syntheticClub);
};

const normalizeStakeholders = (clubName: string, stakeholders?: ClubStakeholderState[]) => {
  const base = fallbackStakeholders(clubName);
  const byKey = new Map((stakeholders ?? []).map(stakeholder => [stakeholder.key, stakeholder]));

  return base.map(stakeholder => {
    const current = byKey.get(stakeholder.key);
    if (!current) return stakeholder;
    return {
      ...stakeholder,
      ...current,
      name: current.name ?? stakeholder.name,
      mood: Math.round(clamp(current.mood ?? stakeholder.mood, 0, 100)),
      influence: Math.round(clamp(current.influence ?? stakeholder.influence, 0, 100)),
      patience: Math.round(clamp(current.patience ?? stakeholder.patience, 0, 100)),
      interests: current.interests?.length ? current.interests : stakeholder.interests
    };
  });
};

const inferPersistence = (memory: Pick<ClubMemory, 'category' | 'importance' | 'tags' | 'fanImpact'>): ClubMemoryPersistence => {
  if (
    memory.tags.some(tag => ['trofeo', 'record', 'leggenda', 'fine-stagione', 'salvezza', 'fallimento', 'rinascita'].includes(tag))
    || memory.category === 'legacy'
    || memory.importance >= 90
  ) return 'permanent';

  if (
    memory.tags.some(tag => ['capitano', 'leader', 'rivalita', 'partita-iconica', 'promessa-tradita', 'traditore', 'causa'].includes(tag))
    || memory.category === 'rivalry'
    || Math.abs(memory.fanImpact) >= 8
  ) return 'long';

  if (memory.tags.some(tag => ['media', 'intervista', 'polemica'].includes(tag))) return 'short';
  return memory.category === 'locker' ? 'short' : 'season';
};

const inferActors = (memory: Pick<ClubMemory, 'category' | 'tags' | 'playerNames' | 'opponent'>): ClubMemoryActor[] => {
  const actors = new Set<ClubMemoryActor>(['club']);
  if (memory.category === 'match') actors.add('fans');
  if (memory.category === 'transfer') actors.add('board');
  if (memory.category === 'locker') actors.add('coach');
  if (memory.category === 'youth') actors.add('academy');
  if (memory.category === 'rivalry' || memory.opponent || memory.tags.includes('rivalita')) actors.add('rivalry');
  if (memory.playerNames?.length || memory.tags.some(tag => tag.startsWith('player:'))) actors.add('player');
  if (memory.tags.some(tag => ['tifosi', 'crisi', 'partita-iconica'].includes(tag))) actors.add('fans');
  if (memory.tags.some(tag => ['curva', 'derby', 'rivalita', 'capitano', 'traditore'].includes(tag))) actors.add('curva');
  if (memory.tags.some(tag => ['media', 'tattica'].includes(tag))) actors.add('media');
  if (memory.tags.some(tag => ['agente', 'promessa-tradita', 'promessa-mantenuta', 'rinnovo'].includes(tag))) actors.add('agent');
  if (memory.tags.some(tag => ['sponsor', 'reputazione'].includes(tag))) actors.add('sponsor');
  return Array.from(actors);
};

const normalizeMemory = (memory: ClubMemory): ClubMemory => {
  const persistence = memory.persistence ?? inferPersistence(memory);
  return {
    ...memory,
    persistence,
    strength: Math.round(clamp(memory.strength ?? memory.importance, 0, 100)),
    actors: memory.actors?.length ? memory.actors : inferActors(memory)
  };
};

const decayMemory = (memory: ClubMemory): ClubMemory => {
  const normalized = normalizeMemory(memory);
  const persistence = normalized.persistence ?? 'season';
  if (persistence === 'permanent') {
    return { ...normalized, strength: Math.max(normalized.strength ?? 0, normalized.importance) };
  }

  return {
    ...normalized,
    persistence,
    strength: Math.round(clamp((normalized.strength ?? normalized.importance) * MEMORY_DECAY[persistence], 0, 100))
  };
};

const decayMemoryBank = (memories: ClubMemory[]) => (
  memories
    .map(decayMemory)
    .filter(memory => memory.persistence === 'permanent' || (memory.strength ?? memory.importance) >= 8)
);

export const normalizeClubHistory = (history: ClubHistoryState): ClubHistoryState => ({
  ...history,
  trophies: history.trophies ?? [],
  records: history.records ?? [],
  legends: history.legends ?? [],
  betrayals: history.betrayals ?? [],
  iconicMatches: history.iconicMatches ?? [],
  pastCoaches: history.pastCoaches ?? [],
  launchedYoungsters: history.launchedYoungsters ?? [],
  bestSignings: history.bestSignings ?? [],
  worstSignings: history.worstSignings ?? [],
  painfulSales: history.painfulSales ?? [],
  profitableDeals: history.profitableDeals ?? [],
  emotionalReturns: history.emotionalReturns ?? [],
  newEraSignings: history.newEraSignings ?? [],
  rivalries: history.rivalries ?? [],
  promises: history.promises ?? [],
  stakeholders: normalizeStakeholders(history.clubName, history.stakeholders),
  memories: (history.memories ?? []).map(normalizeMemory)
});

export const getEffectiveMemoryStrength = (memory: ClubMemory) => (
  normalizeMemory(memory).strength ?? memory.importance
);

const addImpact = (
  impacts: Partial<Record<ClubStakeholderKey, number>>,
  key: ClubStakeholderKey,
  delta: number
) => {
  impacts[key] = (impacts[key] ?? 0) + delta;
};

const getStakeholderImpacts = (memory: ClubMemory): Partial<Record<ClubStakeholderKey, number>> => {
  const impacts: Partial<Record<ClubStakeholderKey, number>> = { ...(memory.stakeholderImpacts ?? {}) };
  const fanImpact = memory.fanImpact;
  const lockerImpact = memory.dressingRoomImpact;
  const strengthScale = clamp((memory.strength ?? memory.importance) / 72, 0.45, 1.4);

  addImpact(impacts, 'fans', fanImpact * strengthScale);
  addImpact(impacts, 'curva', fanImpact * 1.18 * strengthScale);
  addImpact(impacts, 'lockerRoom', lockerImpact * strengthScale);
  addImpact(impacts, 'staff', lockerImpact * 0.45 * strengthScale);

  if (memory.category === 'transfer') {
    addImpact(impacts, 'ownership', memory.fanImpact < 0 && memory.tags.includes('leader') ? 2 : memory.tags.includes('flop-risk') ? -3 : 1);
    addImpact(impacts, 'agents', memory.tags.includes('acquisto') ? 3 : memory.tags.includes('rifiuto-offerta') ? -3 : 1);
    if (memory.tags.includes('capitano') || memory.tags.includes('leader')) {
      addImpact(impacts, 'fans', -3);
      addImpact(impacts, 'curva', -5);
      addImpact(impacts, 'lockerRoom', -2);
    }
  }

  if (memory.tags.includes('rifiuto-offerta')) {
    addImpact(impacts, 'ownership', -1);
    addImpact(impacts, 'fans', 3);
    addImpact(impacts, 'curva', 4);
    addImpact(impacts, 'lockerRoom', 3);
  }

  if (memory.tags.includes('giovane-lanciato')) {
    addImpact(impacts, 'academy', 8);
    addImpact(impacts, 'fans', 2);
    addImpact(impacts, 'curva', 2);
    addImpact(impacts, 'sponsors', 1);
  }

  if (memory.tags.includes('promessa-tradita')) {
    addImpact(impacts, 'agents', -9);
    addImpact(impacts, 'lockerRoom', -5);
    addImpact(impacts, 'press', -2);
  }

  if (memory.tags.includes('promessa-mantenuta')) {
    addImpact(impacts, 'agents', 6);
    addImpact(impacts, 'lockerRoom', 4);
    addImpact(impacts, 'academy', memory.tags.includes('giovane-lanciato') ? 4 : 0);
  }

  if (memory.tags.includes('budget') || memory.tags.includes('proprieta')) {
    addImpact(impacts, 'ownership', memory.fanImpact <= 0 ? 4 : -2);
    addImpact(impacts, 'curva', -3);
    addImpact(impacts, 'agents', -3);
    addImpact(impacts, 'sponsors', 2);
  }

  if (memory.tags.includes('media') || memory.tags.includes('tattica')) {
    addImpact(impacts, 'press', memory.fanImpact < 0 ? -5 : 2);
    addImpact(impacts, 'staff', memory.dressingRoomImpact < 0 ? -2 : 1);
  }

  if (memory.category === 'rivalry' || memory.tags.includes('rivalita')) {
    addImpact(impacts, 'curva', Math.max(1, fanImpact * 0.6));
    addImpact(impacts, 'press', 2);
  }

  if (memory.tags.includes('trofeo') || memory.category === 'record') {
    addImpact(impacts, 'sponsors', 5);
    addImpact(impacts, 'ownership', 4);
  }

  return impacts;
};

const applyStakeholderMemoryImpact = (stakeholders: ClubStakeholderState[], memory: ClubMemory) => {
  const impacts = getStakeholderImpacts(memory);
  return stakeholders.map(stakeholder => {
    const rawDelta = impacts[stakeholder.key] ?? 0;
    const delta = Math.round(clamp(rawDelta * (stakeholder.influence / 72), -14, 14));
    if (delta === 0) return stakeholder;

    return {
      ...stakeholder,
      mood: Math.round(clamp(stakeholder.mood + delta, 0, 100)),
      patience: Math.round(clamp(stakeholder.patience + delta * 0.35, 0, 100)),
      lastEvent: memory.title,
      lastDelta: delta
    };
  });
};

const entryFromMemory = (memory: ClubMemory): ClubHistoryEntry => ({
  id: `entry_${memory.id}`,
  title: memory.title,
  subtitle: memory.score ? `${memory.score} - ${memory.description}` : memory.description,
  season: memory.season,
  impact: getEffectiveMemoryStrength(memory),
  tags: memory.tags
});

const putFirstUnique = <T extends { title: string }>(items: T[], item: T, limit = 10) => {
  const filtered = items.filter(existing => existing.title !== item.title);
  return [item, ...filtered].slice(0, limit);
};

const putFirstUniqueByPlayer = (items: ClubHistoryEntry[], item: ClubHistoryEntry, playerName?: string, limit = 10) => {
  if (!playerName) return putFirstUnique(items, item, limit);
  const filtered = items.filter(existing => !existing.tags?.includes(`player:${playerName}`));
  return [item, ...filtered].slice(0, limit);
};

const promiseLabels: Record<string, string> = {
  rotation: 'Rotazione importante',
  starter: 'Titolare',
  youngProject: 'Progetto giovane',
  starRole: 'Stella centrale'
};

const extractPromiseTag = (memory: ClubMemory) => (
  memory.tags.find(tag => tag.startsWith('promessa:'))?.replace('promessa:', '')
);

const syncPromisesFromMemory = (history: ClubHistoryState, memory: ClubMemory): ClubHistoryState => {
  const playerName = memory.playerNames?.[0];
  if (!playerName) return history;

  if (memory.tags.includes('promessa-tradita') || memory.tags.includes('promessa-mantenuta')) {
    const status = memory.tags.includes('promessa-tradita') ? 'tradita' as const : 'mantenuta' as const;
    return {
      ...history,
      promises: history.promises.map(promise => (
        promise.playerName === playerName && promise.status === 'attiva'
          ? { ...promise, status, trustImpact: promise.trustImpact + (status === 'mantenuta' ? 6 : -10) }
          : promise
      ))
    };
  }

  const promiseType = extractPromiseTag(memory);
  if (!promiseType || promiseType === 'none') return history;
  const promiseLabel = promiseLabels[promiseType];
  if (!promiseLabel) return history;

  const alreadyActive = history.promises.some(promise => (
    promise.playerName === playerName
    && promise.promise === promiseLabel
    && promise.status === 'attiva'
  ));
  if (alreadyActive) return history;

  return {
    ...history,
    promises: [{
      id: `promise_${playerName.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}_${Date.now()}`,
      playerName,
      promise: promiseLabel,
      createdAt: memory.season,
      status: 'attiva' as const,
      trustImpact: memory.tags.includes('flop-risk') ? -1 : 1
    }, ...history.promises].slice(0, 18)
  };
};

const upsertRivalry = (rivalries: ClubRivalry[], memory: ClubMemory) => {
  if (!memory.opponent) return rivalries;

  const existing = rivalries.find(rivalry => rivalry.opponent === memory.opponent);
  if (!existing) {
    return [{
      id: `rivalry_${memory.opponent.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}_${Date.now()}`,
      opponent: memory.opponent,
      heat: clamp(48 + memory.importance * 0.35, 35, 95),
      reason: memory.title,
      startedAt: memory.season,
      memories: [memory.description]
    }, ...rivalries].slice(0, 8);
  }

  return rivalries.map(rivalry => rivalry.id === existing.id
    ? {
        ...rivalry,
        heat: clamp(rivalry.heat + 8 + memory.importance * 0.08, 0, 100),
        reason: memory.title,
        memories: [memory.description, ...rivalry.memories].slice(0, 5)
      }
    : rivalry
  );
};

export const createInitialClubHistory = (
  club: ClubProfile,
  managerName: string,
  basePlayers = createPlayersForClub(club)
): ClubHistoryState => {
  const symbols = [...basePlayers].sort((a, b) => b.overall - a.overall).slice(0, 2);

  return {
    clubName: club.name,
    managerName,
    startedSeason: CURRENT_SEASON,
    fanMood: clamp(58 + club.pressure * 0.22, 45, 82),
    dressingRoom: 72,
    identity: 45,
    trophies: [],
    records: [],
    legends: symbols.map((player, index) => ({
      id: `initial_legend_${player.id}`,
      title: player.name,
      subtitle: index === 0 ? 'Simbolo tecnico della rosa iniziale.' : 'Leader riconosciuto nello spogliatoio.',
      season: CURRENT_SEASON,
      impact: player.overall,
      tags: [`player:${player.name}`, 'inizio-carriera']
    })),
    betrayals: [],
    iconicMatches: [],
    pastCoaches: [{
      id: `coach_${managerName.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}_${Date.now()}`,
      title: managerName,
      subtitle: `Inizia il progetto ${club.name}: ${club.objective}`,
      season: CURRENT_SEASON,
      impact: 50,
      tags: ['allenatore-attuale']
    }],
    launchedYoungsters: [],
    bestSignings: [],
    worstSignings: [],
    painfulSales: [],
    profitableDeals: [],
    emotionalReturns: [],
    newEraSignings: [],
    rivalries: [],
    promises: [],
    stakeholders: createInitialStakeholders(club),
    memories: [{
      id: `memory_start_${club.id}`,
      dateLabel: 'Inizio carriera',
      season: CURRENT_SEASON,
      category: 'coach',
      title: `Nasce il progetto ${club.name}`,
      description: `${managerName} prende il controllo del club. Mandato: ${club.objective}`,
      importance: 52,
      fanImpact: 0,
      dressingRoomImpact: 0,
      persistence: 'permanent',
      strength: 52,
      actors: ['club', 'coach', 'board'],
      tags: ['inizio-carriera']
    }]
  };
};

export const appendClubMemory = (history: ClubHistoryState, draft: ClubMemoryDraft): ClubHistoryState => {
  const normalizedHistory = normalizeClubHistory(history);
  const memory: ClubMemory = {
    ...draft,
    id: draft.id ?? makeId('memory'),
    dateLabel: draft.dateLabel ?? 'Oggi',
    persistence: draft.persistence ?? inferPersistence(draft),
    strength: Math.round(clamp(draft.strength ?? draft.importance, 0, 100)),
    actors: draft.actors?.length ? draft.actors : inferActors(draft)
  };
  const normalizedMemory = normalizeMemory(memory);

  const alreadyStored = normalizedHistory.memories.some(item => (
    item.title === normalizedMemory.title
    && item.category === normalizedMemory.category
    && item.score === normalizedMemory.score
  ));
  if (alreadyStored) return normalizedHistory;

  const decayedMemories = decayMemoryBank(normalizedHistory.memories);
  const entry = entryFromMemory(normalizedMemory);
  let next: ClubHistoryState = {
    ...normalizedHistory,
    fanMood: clamp(normalizedHistory.fanMood + normalizedMemory.fanImpact, 0, 100),
    dressingRoom: clamp(normalizedHistory.dressingRoom + normalizedMemory.dressingRoomImpact, 0, 100),
    identity: clamp(normalizedHistory.identity + (normalizedMemory.importance >= 75 ? 3 : normalizedMemory.importance >= 55 ? 1 : 0), 0, 100),
    stakeholders: applyStakeholderMemoryImpact(normalizedHistory.stakeholders, normalizedMemory),
    rivalries: normalizedHistory.rivalries.map(rivalry => ({
      ...rivalry,
      heat: clamp(35 + (rivalry.heat - 35) * 0.997, 0, 100)
    })),
    memories: [normalizedMemory, ...decayedMemories].slice(0, 140)
  };

  if (normalizedMemory.tags.includes('trofeo')) {
    next = { ...next, trophies: putFirstUnique(next.trophies, entry) };
  }

  if (normalizedMemory.category === 'record' || normalizedMemory.tags.includes('record')) {
    next = { ...next, records: putFirstUnique(next.records, entry) };
  }

  if (normalizedMemory.category === 'match' && (normalizedMemory.importance >= 72 || normalizedMemory.tags.includes('partita-iconica'))) {
    next = { ...next, iconicMatches: putFirstUnique(next.iconicMatches, entry, 12) };
  }

  if (normalizedMemory.category === 'transfer' && normalizedMemory.tags.includes('acquisto')) {
    if (normalizedMemory.tags.includes('flop-risk')) {
      next = { ...next, worstSignings: putFirstUnique(next.worstSignings, entry) };
    } else if (normalizedMemory.importance >= 55) {
      next = { ...next, bestSignings: putFirstUnique(next.bestSignings, entry) };
    }
    if (normalizedMemory.tags.includes('ritorno-emotivo')) {
      next = { ...next, emotionalReturns: putFirstUnique(next.emotionalReturns, entry) };
    }
    if (normalizedMemory.tags.includes('nuova-era')) {
      next = { ...next, newEraSignings: putFirstUnique(next.newEraSignings, entry) };
    }
  }

  if (normalizedMemory.category === 'transfer' && normalizedMemory.tags.includes('cessione') && (normalizedMemory.fanImpact < 0 || normalizedMemory.tags.includes('leader'))) {
    next = { ...next, betrayals: putFirstUnique(next.betrayals, entry) };
  }

  if (normalizedMemory.category === 'transfer' && normalizedMemory.tags.includes('cessione') && (normalizedMemory.tags.includes('ferita-progetto') || normalizedMemory.fanImpact <= -4)) {
    next = { ...next, painfulSales: putFirstUnique(next.painfulSales, entry) };
  }

  if (normalizedMemory.category === 'transfer' && normalizedMemory.tags.includes('affare-redditizio')) {
    next = { ...next, profitableDeals: putFirstUnique(next.profitableDeals, entry) };
  }

  if (normalizedMemory.category === 'youth' && normalizedMemory.playerNames?.[0]) {
    next = {
      ...next,
      launchedYoungsters: putFirstUniqueByPlayer(next.launchedYoungsters, entry, normalizedMemory.playerNames[0])
    };
  }

  if (normalizedMemory.category === 'legacy' && normalizedMemory.playerNames?.[0]) {
    next = {
      ...next,
      legends: putFirstUniqueByPlayer(next.legends, entry, normalizedMemory.playerNames[0])
    };
  }

  if (normalizedMemory.category === 'rivalry' || normalizedMemory.tags.includes('rivalita')) {
    next = { ...next, rivalries: upsertRivalry(next.rivalries, normalizedMemory) };
  }

  next = syncPromisesFromMemory(next, normalizedMemory);

  return next;
};

export const appendClubMemories = (history: ClubHistoryState, drafts: ClubMemoryDraft[]) => {
  return drafts.reduce((nextHistory, draft) => appendClubMemory(nextHistory, draft), history);
};

const resultLabel = (scoreUser: number, scoreOpponent: number) => {
  if (scoreUser > scoreOpponent) return 'Vittoria';
  if (scoreUser === scoreOpponent) return 'Pareggio';
  return 'Sconfitta';
};

const detectGoalStory = (events: MatchEvent[]) => {
  let userGoals = 0;
  let opponentGoals = 0;
  let opponentLed = false;
  let userLed = false;
  let lateUserGoal = false;

  [...events]
    .filter(event => event.type === 'goal')
    .sort((a, b) => a.minute - b.minute)
    .forEach(event => {
      if (event.team === 'user') {
        userGoals += 1;
        if (event.minute >= 80) lateUserGoal = true;
      } else {
        opponentGoals += 1;
      }
      if (opponentGoals > userGoals) opponentLed = true;
      if (userGoals > opponentGoals) userLed = true;
    });

  return { opponentLed, userLed, lateUserGoal };
};

export const buildMatchMemories = ({
  teamName,
  opponent,
  round,
  scoreUser,
  scoreOpponent,
  events,
  stats,
  playedPlayers
}: {
  teamName: string;
  opponent: string;
  round: number;
  scoreUser: number;
  scoreOpponent: number;
  events: MatchEvent[];
  stats: MatchStats;
  playedPlayers: Player[];
}): ClubMemoryDraft[] => {
  const result = resultLabel(scoreUser, scoreOpponent);
  const goalDiff = scoreUser - scoreOpponent;
  const absoluteDiff = Math.abs(goalDiff);
  const totalGoals = scoreUser + scoreOpponent;
  const story = detectGoalStory(events);
  const score = `${teamName} ${scoreUser}-${scoreOpponent} ${opponent}`;
  const comeback = story.opponentLed && scoreUser > scoreOpponent;
  const collapse = story.userLed && scoreUser < scoreOpponent;
  const lateWin = story.lateUserGoal && scoreUser > scoreOpponent;
  const bigWin = scoreUser > scoreOpponent && absoluteDiff >= 3;
  const heavyLoss = scoreOpponent > scoreUser && absoluteDiff >= 3;
  const wildMatch = totalGoals >= 5;
  const tacticalMasterpiece = scoreUser > scoreOpponent && stats.xGUser >= stats.xGOpponent + 0.75;
  const tags = ['partita', result.toLowerCase()];
  if (comeback || lateWin || bigWin || heavyLoss || wildMatch) tags.push('partita-iconica');

  const memories: ClubMemoryDraft[] = [{
    season: CURRENT_SEASON,
    category: 'match',
    title: `Giornata ${round}: ${result} contro ${opponent}`,
    description: comeback
      ? 'La squadra rimonta una partita che sembrava scivolata via.'
      : lateWin
        ? 'Il risultato arriva nel finale e resta addosso allo spogliatoio.'
        : heavyLoss
          ? 'Una serata pesante che lascia pressione e domande tattiche.'
          : tacticalMasterpiece
            ? 'Il piano partita funziona: la produzione offensiva racconta una gara controllata.'
            : `La gara entra nella timeline della stagione con xG ${stats.xGUser.toFixed(2)}-${stats.xGOpponent.toFixed(2)}.`,
    importance: clamp(
      42
      + (scoreUser > scoreOpponent ? 12 : scoreUser === scoreOpponent ? 3 : 7)
      + (comeback ? 28 : 0)
      + (lateWin ? 18 : 0)
      + (bigWin ? 18 : 0)
      + (heavyLoss ? 20 : 0)
      + (wildMatch ? 8 : 0),
      30,
      96
    ),
    fanImpact: scoreUser > scoreOpponent ? (comeback || bigWin ? 9 : 4) : scoreUser === scoreOpponent ? 0 : (heavyLoss ? -8 : -4),
    dressingRoomImpact: scoreUser > scoreOpponent ? (comeback ? 8 : 4) : scoreUser === scoreOpponent ? -1 : (collapse || heavyLoss ? -8 : -5),
    tags,
    opponent,
    score
  }];

  if (comeback) {
    memories.push({
      season: CURRENT_SEASON,
      category: 'record',
      title: `Rimonta simbolo contro ${opponent}`,
      description: `Sotto nel punteggio, ${teamName} ribalta la gara e costruisce un ricordo da spogliatoio.`,
      importance: 88,
      fanImpact: 6,
      dressingRoomImpact: 7,
      tags: ['rimonta', 'record', 'partita-iconica'],
      opponent,
      score
    });
  }

  if (collapse || heavyLoss) {
    memories.push({
      season: CURRENT_SEASON,
      category: 'locker',
      title: collapse ? `Crollo emotivo contro ${opponent}` : `Ferita aperta contro ${opponent}`,
      description: collapse
        ? 'La squadra era avanti e non e riuscita a reggere la pressione.'
        : 'Il risultato diventa materiale di lavoro per staff e leader.',
      importance: heavyLoss ? 82 : 74,
      fanImpact: heavyLoss ? -7 : -4,
      dressingRoomImpact: heavyLoss ? -7 : -5,
      tags: ['ferita', 'partita-iconica'],
      opponent,
      score
    });
  }

  const heatedGame = events.filter(event => event.type === 'card_yellow' || event.type === 'card_red').length >= 4 || (absoluteDiff <= 1 && totalGoals >= 4);
  if (heatedGame) {
    memories.push({
      season: CURRENT_SEASON,
      category: 'rivalry',
      title: `Scintille con ${opponent}`,
      description: 'La partita lascia tensione: da qui puo nascere una rivalita sportiva.',
      importance: 66 + (wildMatch ? 10 : 0),
      fanImpact: 2,
      dressingRoomImpact: 1,
      tags: ['rivalita'],
      opponent,
      score
    });
  }

  playedPlayers
    .filter(player => player.age <= 21)
    .sort((a, b) => b.potential - a.potential)
    .slice(0, 2)
    .forEach(player => {
      memories.push({
        season: CURRENT_SEASON,
        category: 'youth',
        title: `${player.name} entra nella storia dei giovani lanciati`,
        description: `${player.age} anni, minuti veri in una gara ufficiale contro ${opponent}.`,
        importance: clamp(52 + (player.potential - player.overall) * 3, 50, 82),
        fanImpact: 2,
        dressingRoomImpact: 1,
        tags: ['giovane-lanciato', `player:${player.name}`],
        playerNames: [player.name],
        opponent,
        score
      });
    });

  return memories;
};
