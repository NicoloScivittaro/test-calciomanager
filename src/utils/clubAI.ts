import { CLUB_PROFILES, createPlayersForClub, getClubByName } from '../data/serieAData';
import { ClubAIState, ClubProfile, IncomingTransferOffer, Negotiation, Player, Standing } from '../types';

type ClubMeta = ClubProfile & {
  strength?: number;
  expectedRank?: number;
};

interface RealCandidate {
  sourceClub: ClubAIState;
  player: Player;
  fee: number;
  score: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const roleFloor: Record<Player['role'], number> = {
  GK: 2,
  CB: 4,
  LB: 2,
  RB: 2,
  DM: 2,
  CM: 4,
  AM: 2,
  LW: 2,
  RW: 2,
  ST: 3
};

const estimateOverallFromValue = (value: number) => {
  return Math.round(clamp(68 + Math.log10(Math.max(value, 1000000) / 1000000) * 7.2, 66, 90));
};

const transferFeeFor = (player: Player, buyerAmbition: number, urgency = 1) => {
  const ageMultiplier = player.age <= 22 ? 1.24 : player.age <= 26 ? 1.14 : player.age >= 33 ? 0.76 : 1;
  const qualityMultiplier = player.overall >= 84 ? 1.26 : player.overall >= 80 ? 1.14 : 1.04;
  const ambitionMultiplier = buyerAmbition >= 84 ? 1.08 : buyerAmbition <= 70 ? 0.95 : 1;
  return Math.round(player.value * ageMultiplier * qualityMultiplier * ambitionMultiplier * urgency / 100000) * 100000;
};

const canSourceSell = (club: ClubAIState, player: Player) => {
  const sameRoleCount = club.roster.filter(item => item.role === player.role).length;
  return sameRoleCount > roleFloor[player.role];
};

const findRealReplacementCandidate = (
  world: ClubAIState[],
  buyerName: string,
  role: Player['role'],
  targetOverall: number,
  budget: number,
  userTeamName: string,
  includeUserTeam: boolean
): RealCandidate | null => {
  const buyer = world.find(club => club.name === buyerName);
  if (!buyer) return null;

  const candidates = world
    .filter(club => club.name !== buyerName)
    .filter(club => includeUserTeam || club.name !== userTeamName)
    .flatMap(sourceClub => sourceClub.roster
      .filter(player => player.role === role)
      .filter(player => canSourceSell(sourceClub, player))
      .map(player => {
        const fee = transferFeeFor(player, buyer.ambition, Math.max(0.92, targetOverall / Math.max(player.overall, 1)));
        const levelDistance = Math.abs(player.overall - targetOverall);
        const userPreference = sourceClub.name === userTeamName && (player.status === 'Cedibile' || player.overall <= targetOverall + 1) ? 7 : 0;
        const valueFit = fee <= budget * 0.86 ? 9 : fee <= budget ? 3 : -18;
        return {
          sourceClub,
          player,
          fee,
          score: 100 - levelDistance * 9 + player.potential * 0.18 + valueFit + userPreference
        };
      }))
    .filter(candidate => candidate.fee <= budget)
    .filter(candidate => candidate.player.overall >= targetOverall - 6)
    .sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
};

const moveRealPlayer = (
  world: ClubAIState[],
  sourceClubName: string,
  destinationClubName: string,
  playerId: string,
  fee: number
) => {
  const source = world.find(club => club.name === sourceClubName);
  const player = source?.roster.find(item => item.id === playerId);
  if (!source || !player) return { world, player: null as Player | null };

  const updatedWorld = world.map(club => {
    if (club.name === sourceClubName) {
      return {
        ...club,
        budget: club.budget + fee,
        roster: club.roster.filter(item => item.id !== playerId),
        transferLog: [`${club.name} vende ${player.name} al ${destinationClubName} per ${formatFee(fee)}.`, ...club.transferLog].slice(0, 12)
      };
    }

    if (club.name === destinationClubName) {
      return {
        ...club,
        budget: Math.max(0, club.budget - fee),
        roster: [...club.roster, { ...player, status: 'Disponibile' as const }],
        transferLog: [`${club.name} acquista ${player.name} dal ${sourceClubName} per ${formatFee(fee)}.`, ...club.transferLog].slice(0, 12)
      };
    }

    return club;
  });

  return { world: updatedWorld, player };
};

const formatFee = (value: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
    notation: 'compact'
  }).format(value);
};

export const createInitialClubWorld = (): ClubAIState[] => {
  return CLUB_PROFILES.map(club => {
    const meta = club as ClubMeta;
    return {
      clubId: club.id,
      name: club.name,
      budget: Math.round(club.transferBudget * 0.85),
      ambition: meta.strength ?? 72,
      roster: createPlayersForClub(club),
      transferLog: []
    };
  });
};

export const getClubCompetitiveRating = (clubName: string, world: ClubAIState[]) => {
  const clubState = world.find(club => club.name === clubName);
  const meta = getClubByName(clubName) as ClubMeta | undefined;
  const roster = clubState?.roster ?? (meta ? createPlayersForClub(meta) : []);
  const topEleven = [...roster].sort((a, b) => b.overall - a.overall).slice(0, 11);
  const rosterRating = topEleven.length
    ? topEleven.reduce((sum, player) => sum + player.overall, 0) / topEleven.length
    : meta?.strength ?? 70;
  return Math.round(clamp(rosterRating * 0.62 + (meta?.strength ?? rosterRating) * 0.38, 58, 92));
};

export const replaceSoldPlayerForClub = (
  world: ClubAIState[],
  sellingClubName: string,
  soldPlayer: Pick<Player, 'name' | 'role' | 'overall' | 'value'>,
  fee: number,
  userTeamName: string
) => {
  let nextWorld = world.map(club => {
    if (club.name !== sellingClubName) return club;
    return {
      ...club,
      budget: club.budget + fee,
      roster: club.roster.filter(player => player.name !== soldPlayer.name),
      transferLog: [`${club.name} vende ${soldPlayer.name} per ${formatFee(fee)} e cerca un ${soldPlayer.role} reale.`, ...club.transferLog].slice(0, 12)
    };
  });

  const sellingClub = nextWorld.find(club => club.name === sellingClubName);
  const targetOverall = soldPlayer.overall || estimateOverallFromValue(soldPlayer.value);
  const availableBudget = sellingClub?.budget ?? fee;
  const replacementBudget = Math.round(Math.min(availableBudget * 0.72, Math.max(soldPlayer.value * 1.08, fee * 0.68)));
  const candidate = findRealReplacementCandidate(nextWorld, sellingClubName, soldPlayer.role, targetOverall, replacementBudget, userTeamName, true);

  if (!candidate) {
    const log = `${sellingClubName} non trova ancora un ${soldPlayer.role} reale acquistabile al livello di ${soldPlayer.name}.`;
    nextWorld = nextWorld.map(club => club.name === sellingClubName
      ? { ...club, transferLog: [log, ...club.transferLog].slice(0, 12) }
      : club
    );
    return { world: nextWorld, replacement: null as Player | null, log, incomingOffer: null as IncomingTransferOffer | null };
  }

  if (candidate.sourceClub.name === userTeamName) {
    const incomingOffer: IncomingTransferOffer = {
      id: `offer_${sellingClub?.clubId ?? 'club'}_${candidate.player.id}_${Date.now()}`,
      fromClub: sellingClubName,
      playerId: candidate.player.id,
      playerName: candidate.player.name,
      role: candidate.player.role,
      fee: candidate.fee,
      reason: `${sellingClubName} ha venduto ${soldPlayer.name} e cerca un ${soldPlayer.role} reale di livello simile.`,
      status: 'pending'
    };
    const log = `${sellingClubName} prepara un'offerta per ${candidate.player.name} (${userTeamName}) come sostituto reale.`;
    nextWorld = nextWorld.map(club => club.name === sellingClubName
      ? { ...club, transferLog: [log, ...club.transferLog].slice(0, 12) }
      : club
    );
    return { world: nextWorld, replacement: null as Player | null, log, incomingOffer };
  }

  const moved = moveRealPlayer(nextWorld, candidate.sourceClub.name, sellingClubName, candidate.player.id, candidate.fee);
  const log = `${sellingClubName} sostituisce ${soldPlayer.name} con ${candidate.player.name} dal ${candidate.sourceClub.name}.`;
  nextWorld = moved.world.map(club => club.name === sellingClubName
    ? { ...club, transferLog: [log, ...club.transferLog].slice(0, 12) }
    : club
  );

  return { world: nextWorld, replacement: moved.player, log, incomingOffer: null as IncomingTransferOffer | null };
};

export const runClubAutonomyRound = (
  world: ClubAIState[],
  standings: Standing[],
  userTeamName: string,
  round: number
) => {
  let nextWorld = world.map(club => {
    if (club.name === userTeamName) return club;
    const meta = getClubByName(club.name) as ClubMeta | undefined;
    const matchdayIncome = Math.round(350000 + (meta?.strength ?? club.ambition) * 9500);
    const wageBill = club.roster.reduce((sum, player) => sum + player.wage, 0);
    return {
      ...club,
      budget: Math.max(0, club.budget + matchdayIncome - Math.round(wageBill * 0.82))
    };
  });

  nextWorld.forEach(club => {
    if (club.name === userTeamName) return;
    const standing = standings.find(item => item.name === club.name);
    const meta = getClubByName(club.name) as ClubMeta | undefined;
    const expectedRank = meta?.expectedRank ?? 12;
    const rank = standing?.rank ?? expectedRank;
    const underPressure = rank > expectedRank + 3;
    const canActThisRound = round % 4 === 0 || underPressure;
    if (!canActThisRound) return;

    const roleNeedingCover = (Object.keys(roleFloor) as Player['role'][]).find(role => (
      club.roster.filter(player => player.role === role).length < roleFloor[role]
    ));

    const weakStarter = [...club.roster].sort((a, b) => a.overall - b.overall)[0];
    const targetRole = roleNeedingCover ?? (underPressure ? weakStarter?.role : undefined);
    if (!targetRole || club.budget < 6000000) return;

    const targetOverall = roleNeedingCover
      ? clamp((meta?.strength ?? club.ambition) - 4, 63, 84)
      : clamp((weakStarter?.overall ?? club.ambition) + 3, 66, 85);
    const candidate = findRealReplacementCandidate(nextWorld, club.name, targetRole, targetOverall, Math.round(club.budget * 0.62), userTeamName, false);
    if (!candidate) return;

    const moved = moveRealPlayer(nextWorld, candidate.sourceClub.name, club.name, candidate.player.id, candidate.fee);
    nextWorld = moved.world.map(item => item.name === club.name
      ? { ...item, transferLog: [`${club.name} si gestisce da solo: preso ${candidate.player.name} (${targetRole}) dal ${candidate.sourceClub.name}.`, ...item.transferLog].slice(0, 12) }
      : item
    );
  });

  return nextWorld;
};

export const createRealReplacementTargets = (
  soldPlayer: Player,
  teamName: string,
  world: ClubAIState[],
  limit = 4
): Negotiation[] => {
  const targetOverall = Math.max(66, soldPlayer.overall - 2);
  return world
    .filter(club => club.name !== teamName)
    .flatMap(club => club.roster
      .filter(player => player.role === soldPlayer.role)
      .filter(player => canSourceSell(club, player))
      .map(player => {
        const fee = transferFeeFor(player, 74, Math.max(0.94, targetOverall / Math.max(player.overall, 1)));
        return { club, player, fee, score: 100 - Math.abs(player.overall - soldPlayer.overall) * 8 + player.potential * 0.15 };
      }))
    .filter(candidate => candidate.player.overall >= soldPlayer.overall - 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((candidate, index) => ({
      id: `rt_${candidate.club.clubId}_${candidate.player.id}_${Date.now()}_${index}`,
      playerName: candidate.player.name,
      role: candidate.player.role,
      currentClub: candidate.club.name,
      value: candidate.fee,
      wage: candidate.player.wage,
      offeredFee: 0,
      offeredWage: 0,
      offeredContractYears: 0,
      probability: candidate.player.overall >= soldPlayer.overall ? 44 : 62,
      status: 'draft' as const,
      timeline: [
        `${teamName} ha ceduto ${soldPlayer.name}.`,
        `${candidate.player.name} e un sostituto reale nello stesso ruolo dal ${candidate.club.name}.`
      ]
    }));
};
