import { ClubAIState, MatchEvent, MatchStats, Player, PlayerRecentFormToken, PlayerRole, PlayerSeasonStat } from '../types';

const roleGoalBias: Record<PlayerRole, number> = {
  GK: 0,
  CB: 0.14,
  LB: 0.18,
  RB: 0.18,
  DM: 0.22,
  CM: 0.34,
  AM: 0.58,
  LW: 0.7,
  RW: 0.7,
  ST: 0.96
};

const roleAssistBias: Record<PlayerRole, number> = {
  GK: 0,
  CB: 0.08,
  LB: 0.34,
  RB: 0.34,
  DM: 0.24,
  CM: 0.42,
  AM: 0.82,
  LW: 0.76,
  RW: 0.76,
  ST: 0.42
};

const getPlayerSeedStats = (player: Player, clubName: string): PlayerSeasonStat => ({
  playerId: player.id,
  playerName: player.name,
  clubName,
  role: player.role,
  appearances: 0,
  goals: 0,
  assists: 0,
  chancesCreated: 0,
  averageRating: 0,
  minutesPlayed: 0,
  recentForm: []
});

export const createInitialPlayerSeasonStats = (
  userTeamName: string,
  userPlayers: Player[],
  clubWorld: ClubAIState[]
): PlayerSeasonStat[] => {
  const rows = new Map<string, PlayerSeasonStat>();
  const addPlayer = (player: Player, clubName: string) => {
    rows.set(player.id, getPlayerSeedStats(player, clubName));
  };

  userPlayers.forEach(player => addPlayer(player, userTeamName));
  clubWorld.forEach(club => {
    if (club.name === userTeamName) return;
    club.roster.forEach(player => addPlayer(player, club.name));
  });

  return Array.from(rows.values());
};

export const normalizePlayerSeasonStats = (
  stored: unknown,
  userTeamName: string,
  userPlayers: Player[],
  clubWorld: ClubAIState[]
): PlayerSeasonStat[] => {
  const fallback = createInitialPlayerSeasonStats(userTeamName, userPlayers, clubWorld);
  if (!Array.isArray(stored)) return fallback;

  const fallbackById = new Map(fallback.map(row => [row.playerId, row]));
  const normalized = stored
    .filter((row): row is Partial<PlayerSeasonStat> => typeof row === 'object' && row !== null && typeof (row as PlayerSeasonStat).playerId === 'string')
    .map(row => {
      const fallbackRow = fallbackById.get(row.playerId ?? '') ?? fallback[0];
      return {
        playerId: row.playerId ?? fallbackRow.playerId,
        playerName: row.playerName ?? fallbackRow.playerName,
        clubName: row.clubName ?? fallbackRow.clubName,
        role: row.role ?? fallbackRow.role,
        appearances: Number(row.appearances ?? fallbackRow.appearances),
        goals: Number(row.goals ?? fallbackRow.goals),
        assists: Number(row.assists ?? fallbackRow.assists),
        chancesCreated: Number(row.chancesCreated ?? fallbackRow.chancesCreated),
        averageRating: Number(row.averageRating ?? fallbackRow.averageRating),
        minutesPlayed: Number(row.minutesPlayed ?? fallbackRow.minutesPlayed),
        recentForm: Array.isArray(row.recentForm) ? row.recentForm.slice(0, 5) as PlayerRecentFormToken[] : fallbackRow.recentForm
      };
    });

  const knownIds = new Set(normalized.map(row => row.playerId));
  fallback.forEach(row => {
    if (!knownIds.has(row.playerId)) normalized.push(row);
  });

  return normalized;
};

export const syncPlayerSeasonStatsRosters = (
  currentStats: PlayerSeasonStat[],
  userTeamName: string,
  userPlayers: Player[],
  clubWorld: ClubAIState[]
): PlayerSeasonStat[] => {
  const rosterById = new Map<string, { player: Player; clubName: string }>();
  userPlayers.forEach(player => rosterById.set(player.id, { player, clubName: userTeamName }));
  clubWorld.forEach(club => {
    if (club.name === userTeamName) return;
    club.roster.forEach(player => rosterById.set(player.id, { player, clubName: club.name }));
  });

  let changed = false;
  const next = currentStats.map(row => {
    const source = rosterById.get(row.playerId);
    if (!source) return row;
    if (row.clubName === source.clubName && row.playerName === source.player.name && row.role === source.player.role) return row;
    changed = true;
    return {
      ...row,
      playerName: source.player.name,
      clubName: source.clubName,
      role: source.player.role
    };
  });

  const knownIds = new Set(next.map(row => row.playerId));
  rosterById.forEach(({ player, clubName }, playerId) => {
    if (knownIds.has(playerId)) return;
    changed = true;
    next.push({
      playerId,
      playerName: player.name,
      clubName,
      role: player.role,
      appearances: 0,
      goals: 0,
      assists: 0,
      chancesCreated: 0,
      averageRating: 0,
      minutesPlayed: 0,
      recentForm: []
    });
  });

  return changed ? next : currentStats;
};

interface ApplyMatchStatsContext {
  userTeamName: string;
  opponentName: string;
  userPlayers: Player[];
  opponentPlayers: Player[];
  playedUserIds: string[];
  playedOpponentIds: string[];
  events: MatchEvent[];
  stats: MatchStats;
  ratings?: Record<string, number>;
  userMatchMinutes?: Record<string, number>;
}

export const applyMatchToPlayerSeasonStats = (
  currentStats: PlayerSeasonStat[],
  context: ApplyMatchStatsContext
): PlayerSeasonStat[] => {
  const next = new Map(currentStats.map(row => [row.playerId, { ...row, recentForm: [...row.recentForm] }]));
  const playersById = new Map<string, { player: Player; clubName: string }>();

  context.userPlayers.forEach(player => playersById.set(player.id, { player, clubName: context.userTeamName }));
  context.opponentPlayers.forEach(player => playersById.set(player.id, { player, clubName: context.opponentName }));

  const ensureRow = (playerId: string) => {
    const existing = next.get(playerId);
    const source = playersById.get(playerId);
    if (existing) {
      if (source) {
        existing.playerName = source.player.name;
        existing.clubName = source.clubName;
        existing.role = source.player.role;
      }
      return existing;
    }
    if (!source) return null;
    const row: PlayerSeasonStat = {
      playerId,
      playerName: source.player.name,
      clubName: source.clubName,
      role: source.player.role,
      appearances: 0,
      goals: 0,
      assists: 0,
      chancesCreated: 0,
      averageRating: 0,
      minutesPlayed: 0,
      recentForm: []
    };
    next.set(playerId, row);
    return row;
  };

  const contribution = new Map<string, { goals: number; assists: number; chances: number }>();
  const addContribution = (playerId: string | undefined, key: 'goals' | 'assists' | 'chances', amount = 1) => {
    if (!playerId) return;
    const row = ensureRow(playerId);
    if (!row) return;
    const current = contribution.get(playerId) ?? { goals: 0, assists: 0, chances: 0 };
    current[key] += amount;
    contribution.set(playerId, current);
  };

  context.events.forEach(event => {
    if (event.type === 'goal') {
      addContribution(event.playerId, 'goals');
      addContribution(event.assistPlayerId, 'assists');
      addContribution(event.assistPlayerId, 'chances', 2);
      return;
    }

    if (event.type === 'opportunity') {
      addContribution(event.assistPlayerId, 'chances');
    }
  });

  let userGoals = 0;
  let opponentGoals = 0;
  context.events.forEach(event => {
    if (event.type !== 'goal' || !event.playerId) return;
    if (playersById.get(event.playerId)?.clubName === context.userTeamName) userGoals += 1;
    else opponentGoals += 1;
  });

  const playedIds = Array.from(new Set([...context.playedUserIds, ...context.playedOpponentIds]));
  playedIds.forEach(playerId => {
    const row = ensureRow(playerId);
    if (!row) return;
    const playerContribution = contribution.get(playerId) ?? { goals: 0, assists: 0, chances: 0 };
    const token: PlayerRecentFormToken =
      playerContribution.goals > 0 && playerContribution.assists > 0 ? 'GA' :
      playerContribution.goals > 0 ? 'G' :
      playerContribution.assists > 0 ? 'A' :
      '-';

    const isUserPlayer = row.clubName === context.userTeamName;
    const resultModifier = userGoals === opponentGoals ? 0 : (isUserPlayer ? (userGoals > opponentGoals ? 0.15 : -0.15) : (opponentGoals > userGoals ? 0.15 : -0.15));
    const fallbackRating = clamp(6 + playerContribution.goals * 0.9 + playerContribution.assists * 0.5 + resultModifier, 4.5, 9.5);
    const matchRating = context.ratings?.[playerId] ?? fallbackRating;

    const minutesThisMatch = isUserPlayer ? (context.userMatchMinutes?.[playerId] ?? 90) : 90;

    row.appearances += 1;
    row.goals += playerContribution.goals;
    row.assists += playerContribution.assists;
    row.chancesCreated += playerContribution.chances;
    row.averageRating = Number((((row.averageRating || 6) * (row.appearances - 1) + matchRating) / row.appearances).toFixed(2));
    row.minutesPlayed = (row.minutesPlayed || 0) + minutesThisMatch;
    row.recentForm = [token, ...row.recentForm].slice(0, 5);
  });

  return Array.from(next.values());
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const pickWeightedIndex = (weights: number[]) => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return Math.floor(Math.random() * weights.length);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return weights.length - 1;
};

interface SimulatedClubFixture {
  clubName: string;
  roster: Player[];
  goalsScored: number;
}

const applyClubRoundResult = (
  next: Map<string, PlayerSeasonStat>,
  fixture: SimulatedClubFixture
) => {
  const startingXI = [...fixture.roster].sort((a, b) => b.overall - a.overall).slice(0, 11);
  if (startingXI.length === 0) return;

  const contribution = new Map<string, { goals: number; assists: number; chances: number }>();
  const addContribution = (playerId: string, key: 'goals' | 'assists' | 'chances', amount = 1) => {
    const current = contribution.get(playerId) ?? { goals: 0, assists: 0, chances: 0 };
    current[key] += amount;
    contribution.set(playerId, current);
  };

  for (let goal = 0; goal < fixture.goalsScored; goal += 1) {
    const scorer = startingXI[pickWeightedIndex(startingXI.map(player => roleGoalBias[player.role] || 0.02))];
    addContribution(scorer.id, 'goals');

    if (Math.random() < 0.72) {
      const assistCandidates = startingXI.filter(player => player.id !== scorer.id);
      if (assistCandidates.length > 0) {
        const assister = assistCandidates[pickWeightedIndex(assistCandidates.map(player => roleAssistBias[player.role] || 0.05))];
        addContribution(assister.id, 'assists');
        addContribution(assister.id, 'chances', 2);
      }
    }
  }

  startingXI.forEach(player => {
    const existing = next.get(player.id);
    const row: PlayerSeasonStat = existing ?? {
      playerId: player.id,
      playerName: player.name,
      clubName: fixture.clubName,
      role: player.role,
      appearances: 0,
      goals: 0,
      assists: 0,
      chancesCreated: 0,
      averageRating: 0,
      minutesPlayed: 0,
      recentForm: []
    };
    const playerContribution = contribution.get(player.id) ?? { goals: 0, assists: 0, chances: 0 };
    const token: PlayerRecentFormToken =
      playerContribution.goals > 0 && playerContribution.assists > 0 ? 'GA' :
      playerContribution.goals > 0 ? 'G' :
      playerContribution.assists > 0 ? 'A' :
      '-';
    const matchRating = clamp(6 + playerContribution.goals * 0.9 + playerContribution.assists * 0.5 + (Math.random() * 0.6 - 0.3), 4.5, 9.5);

    row.playerName = player.name;
    row.clubName = fixture.clubName;
    row.role = player.role;
    row.appearances += 1;
    row.goals += playerContribution.goals;
    row.assists += playerContribution.assists;
    row.chancesCreated += playerContribution.chances;
    row.averageRating = Number((((row.averageRating || 6) * (row.appearances - 1) + matchRating) / row.appearances).toFixed(2));
    row.minutesPlayed = (row.minutesPlayed || 0) + 90;
    row.recentForm = [token, ...row.recentForm].slice(0, 5);
    next.set(player.id, row);
  });
};

export const applySimulatedRoundToPlayerSeasonStats = (
  currentStats: PlayerSeasonStat[],
  fixtures: SimulatedClubFixture[]
): PlayerSeasonStat[] => {
  const next = new Map(currentStats.map(row => [row.playerId, { ...row, recentForm: [...row.recentForm] }]));
  fixtures.forEach(fixture => applyClubRoundResult(next, fixture));
  return Array.from(next.values());
};

export const sortScorers = (rows: PlayerSeasonStat[]) => [...rows].sort((a, b) => {
  if (b.goals !== a.goals) return b.goals - a.goals;
  const bAverage = b.appearances ? b.goals / b.appearances : 0;
  const aAverage = a.appearances ? a.goals / a.appearances : 0;
  if (bAverage !== aAverage) return bAverage - aAverage;
  if (b.assists !== a.assists) return b.assists - a.assists;
  return b.chancesCreated - a.chancesCreated;
});

export const sortAssistmen = (rows: PlayerSeasonStat[]) => [...rows].sort((a, b) => {
  if (b.assists !== a.assists) return b.assists - a.assists;
  if (b.chancesCreated !== a.chancesCreated) return b.chancesCreated - a.chancesCreated;
  if (b.goals !== a.goals) return b.goals - a.goals;
  return a.playerName.localeCompare(b.playerName);
});
