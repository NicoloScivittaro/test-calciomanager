import { ClubAIState, MatchEvent, MatchStats, Player, PlayerRecentFormToken, PlayerRole, PlayerSeasonStat } from '../types';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashNumber = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

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

const buildInitialRecentForm = (goals: number, assists: number, seed: number): PlayerRecentFormToken[] => {
  const form: PlayerRecentFormToken[] = [];
  const size = 5;
  for (let i = 0; i < size; i += 1) {
    if (i === 0 && goals > 0 && assists > 0 && seed % 7 === 0) form.push('GA');
    else if (i < goals && seed % 3 !== 0) form.push('G');
    else if (i < assists && seed % 4 !== 1) form.push('A');
    else form.push('-');
  }
  return form;
};

const getPlayerSeedStats = (player: Player, clubName: string): PlayerSeasonStat => {
  const seed = hashNumber(`${clubName}-${player.id}-${player.name}`);
  const quality = clamp((player.overall - 70) / 18, 0, 1.4);
  const apps = clamp(1 + (seed % 4) + Math.round(quality * 1.4), 1, 6);
  const goals = Math.floor((quality * 2.2 + (seed % 5) * 0.18) * roleGoalBias[player.role]);
  const assists = Math.floor((quality * 2.1 + ((seed >> 3) % 5) * 0.16) * roleAssistBias[player.role]);
  const chancesCreated = Math.round(assists * 2.4 + roleAssistBias[player.role] * (2 + (seed % 4)));

  return {
    playerId: player.id,
    playerName: player.name,
    clubName,
    role: player.role,
    appearances: apps,
    goals: clamp(goals, 0, apps + 1),
    assists: clamp(assists, 0, apps + 1),
    chancesCreated: clamp(chancesCreated, 0, 20),
    recentForm: buildInitialRecentForm(goals, assists, seed)
  };
};

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

    row.appearances += 1;
    row.goals += playerContribution.goals;
    row.assists += playerContribution.assists;
    row.chancesCreated += playerContribution.chances;
    row.recentForm = [token, ...row.recentForm].slice(0, 5);
  });

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
