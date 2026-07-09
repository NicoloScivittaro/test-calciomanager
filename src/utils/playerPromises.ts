import { ClubMemoryDraft, Player, PlayingTimePromise } from '../types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// Season is considered "advanced" from this round onward (same threshold used
// elsewhere in the project, e.g. emotionalNarratives/careerWorld match importance).
const LATE_SEASON_ROUND = 30;
const AT_RISK_PACE_RATIO = 0.55;

export interface PlayingTimePromiseOption {
  id: string;
  label: string;
  targetMinutes: number;
}

export const PLAYING_TIME_PROMISE_OPTIONS: PlayingTimePromiseOption[] = [
  { id: 'limited', label: 'Ruolo limitato', targetMinutes: 500 },
  { id: 'rotation', label: 'Rotazione', targetMinutes: 1000 },
  { id: 'important', label: 'Ruolo importante', targetMinutes: 1800 }
];

export const hasActivePlayingTimePromise = (player: Player): boolean => (
  player.playingTimePromise?.status === 'active' || player.playingTimePromise?.status === 'at_risk'
);

export const createPlayingTimePromise = (
  playerId: string,
  targetMinutes: number,
  currentMinutes: number,
  season: string
): PlayingTimePromise => {
  const now = new Date().toISOString();
  return {
    id: `ptp_${playerId}_${Date.now()}`,
    playerId,
    type: 'playing_time',
    targetMinutes,
    currentMinutes,
    createdAt: now,
    expiresAt: season,
    status: 'active',
    description: `Promessa di minutaggio: almeno ${targetMinutes} minuti nella stagione ${season}.`,
    consequenceApplied: false,
    updatedAt: now
  };
};

export const getPlayingTimePromiseProgress = (promise: PlayingTimePromise): number => (
  Math.round(clamp((promise.currentMinutes / Math.max(1, promise.targetMinutes)) * 100, 0, 100))
);

interface PromiseUpdateContext {
  round: number;
  seasonFinished: boolean;
}

interface PromiseUpdateOutcome {
  promise: PlayingTimePromise;
  justCompleted: boolean;
  justBroken: boolean;
}

const updatePromiseStatus = (
  promise: PlayingTimePromise,
  currentMinutes: number,
  context: PromiseUpdateContext
): PromiseUpdateOutcome => {
  // Already resolved promises never re-trigger a consequence.
  if (promise.status === 'completed' || promise.status === 'broken') {
    return { promise: { ...promise, currentMinutes }, justCompleted: false, justBroken: false };
  }

  const now = new Date().toISOString();

  if (currentMinutes >= promise.targetMinutes) {
    return {
      promise: { ...promise, currentMinutes, status: 'completed', updatedAt: now },
      justCompleted: true,
      justBroken: false
    };
  }

  if (context.seasonFinished) {
    return {
      promise: { ...promise, currentMinutes, status: 'broken', updatedAt: now },
      justCompleted: false,
      justBroken: true
    };
  }

  if (
    promise.status === 'active'
    && context.round >= LATE_SEASON_ROUND
    && currentMinutes < promise.targetMinutes * AT_RISK_PACE_RATIO
  ) {
    return {
      promise: { ...promise, currentMinutes, status: 'at_risk', updatedAt: now },
      justCompleted: false,
      justBroken: false
    };
  }

  if (promise.currentMinutes === currentMinutes) return { promise, justCompleted: false, justBroken: false };
  return { promise: { ...promise, currentMinutes, updatedAt: now }, justCompleted: false, justBroken: false };
};

export interface ResolvePlayingTimePromisesContext extends PromiseUpdateContext {
  minutesByPlayerId: Record<string, number>;
}

export const resolvePlayingTimePromises = (
  players: Player[],
  context: ResolvePlayingTimePromisesContext
): { players: Player[]; memories: ClubMemoryDraft[] } => {
  const memories: ClubMemoryDraft[] = [];

  const updatedPlayers = players.map(player => {
    const promise = player.playingTimePromise;
    if (!promise) return player;

    const cumulativeMinutes = context.minutesByPlayerId[player.id] ?? promise.currentMinutes;
    const { promise: nextPromise, justCompleted, justBroken } = updatePromiseStatus(promise, cumulativeMinutes, context);

    if (!justCompleted && !justBroken) {
      return nextPromise === promise ? player : { ...player, playingTimePromise: nextPromise };
    }

    const isAmbitiousOrEgo = player.personality.ambition >= 70 || player.personality.ego >= 70;
    const careerMemory = { ...player.careerMemory };
    let morale = player.morale;

    if (justCompleted) {
      morale = clamp(morale + 8, 0, 100);
      careerMemory.promisesKept += 1;
      memories.push({
        season: nextPromise.expiresAt,
        category: 'locker',
        title: `Promessa mantenuta: ${player.name}`,
        description: `${player.name} raggiunge i ${nextPromise.targetMinutes} minuti promessi in stagione: fiducia nel progetto in crescita.`,
        importance: 58,
        fanImpact: 1,
        dressingRoomImpact: 3,
        tags: ['promessa-mantenuta', 'minutaggio', `player:${player.name}`],
        playerNames: [player.name]
      });
    } else if (justBroken) {
      morale = clamp(morale - 10, 0, 100);
      careerMemory.promisesBroken += 1;
      memories.push({
        season: nextPromise.expiresAt,
        category: 'locker',
        title: `Promessa non mantenuta: ${player.name}`,
        description: `${player.name} chiude la stagione senza raggiungere i ${nextPromise.targetMinutes} minuti promessi.${isAmbitiousOrEgo ? ' Il rapporto con il progetto si complica.' : ''}`,
        importance: isAmbitiousOrEgo ? 66 : 58,
        fanImpact: -1,
        dressingRoomImpact: -3,
        tags: ['promessa-tradita', 'minutaggio', `player:${player.name}`],
        playerNames: [player.name]
      });
    }

    return {
      ...player,
      morale,
      careerMemory,
      playingTimePromise: { ...nextPromise, consequenceApplied: true }
    };
  });

  return { players: updatedPlayers, memories };
};
