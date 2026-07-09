import {
  ClubAIState,
  ClubMemoryDraft,
  ClubProfile,
  CompetitionFixture,
  CompetitionId,
  CompetitionSeasonState,
  LeagueSystemState,
  Match,
  Player,
  PostseasonLeg,
  PostseasonState,
  PostseasonStage,
  PostseasonTie,
  PromotionRelegationRules,
  SeasonTransitionSummary,
  Standing,
} from '../types';
import { CLUB_PROFILES, rankStandings } from '../data/serieAData';
import { SERIE_B_CLUBS, SERIE_B_SEASON, SERIE_C_FEEDER_POOL, SerieBStrengthTier } from '../data/serieBData2025';
import { createPlaceholderPlayersForSerieBClub } from '../data/realSerieBRosters2025';
import { getClubCompetitiveRating } from './clubAI';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// ─── Regole promozione/retrocessione (configurabili) ───

export const SERIE_A_PROMOTION_RULES: PromotionRelegationRules = {
  directPromotions: 0,
  directRelegations: 3,
  playoffZone: [0, 0],
  playoffAutoPromoteGapPoints: 0,
  playoutZone: [0, 0],
  playoutMaxGapPoints: 0,
};

export const SERIE_B_PROMOTION_RULES: PromotionRelegationRules = {
  directPromotions: 2,
  directRelegations: 3,
  playoffZone: [3, 8],
  playoffAutoPromoteGapPoints: 14,
  playoutZone: [16, 17],
  playoutMaxGapPoints: 4,
};

export const COMPETITION_DEFINITIONS: Record<CompetitionId, { name: string; shortName: string; tier: 1 | 2; rounds: number; promotionRules: PromotionRelegationRules }> = {
  serie_a: { name: 'Serie A', shortName: 'Serie A', tier: 1, rounds: 38, promotionRules: SERIE_A_PROMOTION_RULES },
  serie_b: { name: 'Serie B', shortName: 'Serie B', tier: 2, rounds: 38, promotionRules: SERIE_B_PROMOTION_RULES },
};

// ─── Divisione di un club: sempre esplicita, mai dedotta dal nome ───

export const getClubDivision = (club: ClubProfile): CompetitionId => club.division ?? 'serie_a';

export const getAnyClubById = (id: string): ClubProfile | undefined => (
  CLUB_PROFILES.find(club => club.id === id) ?? SERIE_B_CLUBS.find(club => club.id === id)
);

export const getAnyClubByName = (name: string): ClubProfile | undefined => (
  CLUB_PROFILES.find(club => club.name === name) ?? SERIE_B_CLUBS.find(club => club.name === name)
);

// ─── Round robin (metodo del cerchio): genera un calendario reale per l'intera competizione ───

interface ClubRef {
  id: string;
  name: string;
}

const generateRoundRobinPairs = (clubs: ClubRef[]): { round: number; home: ClubRef; away: ClubRef }[] => {
  const list = [...clubs];
  const hasBye = list.length % 2 !== 0;
  if (hasBye) list.push({ id: '__bye__', name: '__bye__' });

  const n = list.length;
  const singleLegRounds = n - 1;
  const half = n / 2;
  const firstLeg: { round: number; home: ClubRef; away: ClubRef }[] = [];
  let arrangement = [...list];

  for (let round = 0; round < singleLegRounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const home = arrangement[i];
      const away = arrangement[n - 1 - i];
      if (home.id === '__bye__' || away.id === '__bye__') continue;
      // alterna la sede della squadra fissa (posizione 0) round per round per bilanciare casa/trasferta
      const swapHomeAway = round % 2 === 1 && i === 0;
      firstLeg.push({
        round: round + 1,
        home: swapHomeAway ? away : home,
        away: swapHomeAway ? home : away,
      });
    }
    arrangement = [arrangement[0], arrangement[n - 1], ...arrangement.slice(1, n - 1)];
  }

  const secondLeg = firstLeg.map(fixture => ({
    round: fixture.round + singleLegRounds,
    home: fixture.away,
    away: fixture.home,
  }));

  return [...firstLeg, ...secondLeg];
};

export const buildCompetitionFixtures = (clubs: ClubRef[], competitionId: CompetitionId, season: string): CompetitionFixture[] => (
  generateRoundRobinPairs(clubs).map((pair, index) => ({
    id: `${competitionId}_${season.replace(/[^0-9]/g, '')}_f${index + 1}`,
    round: pair.round,
    homeClubId: pair.home.id,
    homeClubName: pair.home.name,
    awayClubId: pair.away.id,
    awayClubName: pair.away.name,
    played: false,
  }))
);

// ─── Calendario dal punto di vista di un club (compatibile con il tipo Match esistente) ───

export const getSeasonStartYear = (season: string) => Number.parseInt(season.split('/')[0], 10) || 2025;

const getDateForCompetitionRound = (round: number, seasonStartYear: number): string => {
  const baseDate = new Date(seasonStartYear, 7, 23);
  baseDate.setDate(baseDate.getDate() + (round - 1) * 7);
  return baseDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const deriveClubMatchCalendar = (
  fixtures: CompetitionFixture[],
  clubId: string,
  getStadiumForClubName: (clubName: string) => string,
  seasonStartYear: number
): Match[] => {
  const clubFixtures = fixtures
    .filter(fixture => fixture.homeClubId === clubId || fixture.awayClubId === clubId)
    .sort((a, b) => a.round - b.round);

  const matches: Match[] = clubFixtures.map(fixture => {
    const isHome = fixture.homeClubId === clubId;
    const opponent = isHome ? fixture.awayClubName : fixture.homeClubName;
    const ownClubName = isHome ? fixture.homeClubName : fixture.awayClubName;

    return {
      id: `fixture_${fixture.id}`,
      opponent,
      opponentInitials: opponent.split(' ').map(word => word[0]).join('').slice(0, 3).toUpperCase(),
      stadium: isHome ? getStadiumForClubName(ownClubName) : getStadiumForClubName(opponent),
      isHome,
      date: getDateForCompetitionRound(fixture.round, seasonStartYear),
      status: fixture.played ? 'played' as const : 'future' as const,
      scoreUser: fixture.played ? (isHome ? fixture.homeGoals : fixture.awayGoals) : undefined,
      scoreOpponent: fixture.played ? (isHome ? fixture.awayGoals : fixture.homeGoals) : undefined,
      playedIndex: fixture.round,
    };
  });

  const firstUnplayedIndex = matches.findIndex(match => match.status === 'future');
  if (firstUnplayedIndex >= 0) {
    matches[firstUnplayedIndex] = { ...matches[firstUnplayedIndex], status: 'next' };
  }

  return matches;
};

// ─── Classifica ricalcolata dalle fixture giocate (fonte di verità unica) ───

export const computeStandingsFromFixtures = (clubs: ClubRef[], fixtures: CompetitionFixture[]): Standing[] => {
  const table = new Map<string, Standing>(clubs.map(club => [club.id, {
    rank: 0, name: club.name, points: 0, played: 0, wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0, goalDiff: 0, form: [],
  }]));

  fixtures
    .filter(fixture => fixture.played && fixture.homeGoals !== undefined && fixture.awayGoals !== undefined)
    .sort((a, b) => a.round - b.round)
    .forEach(fixture => {
      const home = table.get(fixture.homeClubId);
      const away = table.get(fixture.awayClubId);
      if (!home || !away) return;
      const homeGoals = fixture.homeGoals as number;
      const awayGoals = fixture.awayGoals as number;
      const homeResult: 'W' | 'D' | 'L' = homeGoals > awayGoals ? 'W' : homeGoals === awayGoals ? 'D' : 'L';
      const awayResult: 'W' | 'D' | 'L' = homeResult === 'W' ? 'L' : homeResult === 'D' ? 'D' : 'W';

      home.played += 1;
      away.played += 1;
      home.wins += homeResult === 'W' ? 1 : 0;
      home.draws += homeResult === 'D' ? 1 : 0;
      home.losses += homeResult === 'L' ? 1 : 0;
      away.wins += awayResult === 'W' ? 1 : 0;
      away.draws += awayResult === 'D' ? 1 : 0;
      away.losses += awayResult === 'L' ? 1 : 0;
      home.points += homeResult === 'W' ? 3 : homeResult === 'D' ? 1 : 0;
      away.points += awayResult === 'W' ? 3 : awayResult === 'D' ? 1 : 0;
      home.goalsFor += homeGoals;
      home.goalsAgainst += awayGoals;
      home.goalDiff = home.goalsFor - home.goalsAgainst;
      away.goalsFor += awayGoals;
      away.goalsAgainst += homeGoals;
      away.goalDiff = away.goalsFor - away.goalsAgainst;
      home.form = [...home.form, homeResult].slice(-5);
      away.form = [...away.form, awayResult].slice(-5);
    });

  return rankStandings(Array.from(table.values()));
};

// ─── Simulazione CPU di una fixture (stessa formula gia' usata in MatchCenter per Serie A) ───
// Deterministica (mai Math.random()): seed stabile da season+round+clubId, cosi' una eventuale
// doppia esecuzione della stessa giornata (F5, doppio click) produce sempre lo stesso risultato
// invece di generarne uno diverso ogni volta.
const seededRandom01 = (seed: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash << 13; hash ^= hash >>> 17; hash ^= hash << 5;
  return ((hash >>> 0) % 100000) / 100000;
};

export const simulateFixtureResult = (homeName: string, awayName: string, clubWorld: ClubAIState[], seed: string) => {
  const homeStrength = getClubCompetitiveRating(homeName, clubWorld);
  const awayStrength = getClubCompetitiveRating(awayName, clubWorld);
  const homeExpected = clamp(1.15 + (homeStrength - awayStrength) / 34, 0.45, 2.05);
  const awayExpected = clamp(0.95 + (awayStrength - homeStrength) / 36, 0.35, 1.85);
  const homeGoals = Math.min(4, Math.max(0, Math.floor(homeExpected * 0.55 + seededRandom01(`${seed}_h`) * homeExpected * 1.05)));
  const awayGoals = Math.min(4, Math.max(0, Math.floor(awayExpected * 0.55 + seededRandom01(`${seed}_a`) * awayExpected * 1.05)));
  return { homeGoals, awayGoals };
};

// Simula tutte le fixture di una giornata, escludendo quella (se presente) del club utente,
// che deve invece essere risolta dal MatchCenter reale. Non simula mai due volte la stessa fixture.
export const simulateCompetitionRound = (
  fixtures: CompetitionFixture[],
  round: number,
  clubWorld: ClubAIState[],
  season: string,
  excludeClubId?: string
): CompetitionFixture[] => (
  fixtures.map(fixture => {
    if (fixture.round !== round || fixture.played) return fixture;
    if (excludeClubId && (fixture.homeClubId === excludeClubId || fixture.awayClubId === excludeClubId)) return fixture;
    const { homeGoals, awayGoals } = simulateFixtureResult(fixture.homeClubName, fixture.awayClubName, clubWorld, `${season}_${round}_${fixture.id}`);
    return { ...fixture, homeGoals, awayGoals, played: true };
  })
);

export const applyUserResultToFixtures = (
  fixtures: CompetitionFixture[],
  round: number,
  userClubId: string,
  userGoals: number,
  opponentGoals: number
): CompetitionFixture[] => (
  fixtures.map(fixture => {
    if (fixture.round !== round || fixture.played) return fixture;
    const userIsHome = fixture.homeClubId === userClubId;
    const userIsAway = fixture.awayClubId === userClubId;
    if (!userIsHome && !userIsAway) return fixture;
    return {
      ...fixture,
      played: true,
      homeGoals: userIsHome ? userGoals : opponentGoals,
      awayGoals: userIsHome ? opponentGoals : userGoals,
    };
  })
);

// ─── Promozioni e retrocessioni (regular season) ───

export interface RegularSeasonOutcome {
  directPromotions: string[]; // clubId, solo Serie B
  directRelegations: string[]; // clubId
  playoffAutoPromotedThirdPlace?: string; // clubId, se il distacco supera la soglia
  playoffParticipants: string[]; // clubId, ordinati per piazzamento (esclude eventuale 3a promossa diretta)
  playoutParticipants: string[]; // clubId
  playoutAutoRelegated?: string; // clubId, se il distacco tra 16a e 17a supera la soglia
}

export const determineRegularSeasonOutcome = (
  standings: Standing[],
  clubsByName: Map<string, string>, // name -> clubId
  rules: PromotionRelegationRules
): RegularSeasonOutcome => {
  const ranked = [...standings].sort((a, b) => a.rank - b.rank);
  const idFor = (name: string) => clubsByName.get(name) ?? name;

  const directPromotions = rules.directPromotions > 0
    ? ranked.slice(0, rules.directPromotions).map(team => idFor(team.name))
    : [];
  const directRelegations = rules.directRelegations > 0
    ? ranked.slice(-rules.directRelegations).map(team => idFor(team.name))
    : [];

  if (rules.playoffZone[0] === 0 && rules.playoffZone[1] === 0) {
    return { directPromotions, directRelegations, playoffParticipants: [], playoutParticipants: [] };
  }

  const thirdPlace = ranked[2];
  const fourthPlace = ranked[3];
  const thirdAutoPromotes = Boolean(thirdPlace && fourthPlace && (thirdPlace.points - fourthPlace.points) > rules.playoffAutoPromoteGapPoints);

  const [playoffFrom, playoffTo] = rules.playoffZone;
  const playoffParticipants = ranked
    .slice(playoffFrom - 1, playoffTo)
    .filter(team => !thirdAutoPromotes || team.rank !== 3)
    .map(team => idFor(team.name));

  const [playoutFrom, playoutTo] = rules.playoutZone;
  const sixteenth = ranked[playoutFrom - 1];
  const seventeenth = ranked[playoutTo - 1];
  const playoutGapTooWide = Boolean(sixteenth && seventeenth && (sixteenth.points - seventeenth.points) > rules.playoutMaxGapPoints);

  return {
    directPromotions,
    directRelegations,
    playoffAutoPromotedThirdPlace: thirdAutoPromotes ? idFor(thirdPlace.name) : undefined,
    playoffParticipants,
    playoutParticipants: playoutGapTooWide ? [] : [sixteenth, seventeenth].filter(Boolean).map(team => idFor((team as Standing).name)),
    playoutAutoRelegated: playoutGapTooWide ? idFor(seventeenth.name) : undefined,
  };
};

// ─── Playoff / playout: costruzione tabellone e risoluzione ───

const createLeg = (leg: 1 | 2, hostId: string, hostName: string, guestId: string, guestName: string): PostseasonLeg => ({
  leg, hostClubId: hostId, hostClubName: hostName, guestClubId: guestId, guestClubName: guestName, played: false,
});

const nameFor = (clubId: string, clubNameById: Map<string, string>) => clubNameById.get(clubId) ?? clubId;

// Preliminari: 5a vs 8a, 6a vs 7a, gara secca in casa della meglio classificata.
// Semifinali: 3a e 4a entrano, ritorno in casa della meglio classificata.
// Finale: andata/ritorno, ritorno in casa della meglio classificata.
export const buildSerieBPlayoffBracket = (
  participants: string[], // clubId in ordine di piazzamento: [3a,4a,5a,6a,7a,8a] oppure meno se 3a promossa diretta
  clubNameById: Map<string, string>,
  season: string
): PostseasonState => {
  const rank = (clubId: string) => participants.indexOf(clubId);
  const seeded = [...participants].sort((a, b) => rank(a) - rank(b));

  const ties: PostseasonTie[] = [];
  const fifth = seeded[2];
  const sixth = seeded[3];
  const seventh = seeded[4];
  const eighth = seeded[5];

  if (fifth && eighth) {
    ties.push({
      id: `po_prelim_${season}_1`,
      stage: 'playoff_preliminary',
      homeClubId: fifth,
      homeClubName: nameFor(fifth, clubNameById),
      awayClubId: eighth,
      awayClubName: nameFor(eighth, clubNameById),
      legs: [createLeg(1, fifth, nameFor(fifth, clubNameById), eighth, nameFor(eighth, clubNameById))],
      resolved: false,
    });
  }
  if (sixth && seventh) {
    ties.push({
      id: `po_prelim_${season}_2`,
      stage: 'playoff_preliminary',
      homeClubId: sixth,
      homeClubName: nameFor(sixth, clubNameById),
      awayClubId: seventh,
      awayClubName: nameFor(seventh, clubNameById),
      legs: [createLeg(1, sixth, nameFor(sixth, clubNameById), seventh, nameFor(seventh, clubNameById))],
      resolved: false,
    });
  }

  return { type: 'playoff', season, ties, completed: false };
};

export const buildSerieBPlayoutBracket = (
  participants: string[], // clubId: [16a, 17a]
  clubNameById: Map<string, string>,
  season: string
): PostseasonState => {
  const [sixteenth, seventeenth] = participants;
  if (!sixteenth || !seventeenth) return { type: 'playout', season, ties: [], completed: true };

  return {
    type: 'playout',
    season,
    ties: [{
      id: `plo_${season}`,
      stage: 'playout',
      homeClubId: sixteenth, // meglio classificata: gioca il ritorno in casa
      homeClubName: nameFor(sixteenth, clubNameById),
      awayClubId: seventeenth,
      awayClubName: nameFor(seventeenth, clubNameById),
      legs: [createLeg(1, seventeenth, nameFor(seventeenth, clubNameById), sixteenth, nameFor(sixteenth, clubNameById))],
      resolved: false,
    }],
    completed: false,
  };
};

// Aggiunge la gara di ritorno (in casa della meglio classificata) dopo che l'andata e' stata giocata.
const withReturnLeg = (tie: PostseasonTie): PostseasonTie => {
  if (tie.legs.length >= 2 || !tie.legs[0]?.played) return tie;
  return {
    ...tie,
    legs: [...tie.legs, createLeg(2, tie.homeClubId, tie.homeClubName, tie.awayClubId, tie.awayClubName)],
  };
};

const resolveTieIfComplete = (tie: PostseasonTie): PostseasonTie => {
  const allLegsPlayed = tie.legs.length > 0 && tie.legs.every(leg => leg.played);
  if (!allLegsPlayed) return tie;

  let homeAggregate = 0;
  let awayAggregate = 0;
  tie.legs.forEach(leg => {
    const homeGoalsThisLeg = leg.hostClubId === tie.homeClubId ? (leg.homeGoals ?? 0) : (leg.awayGoals ?? 0);
    const awayGoalsThisLeg = leg.hostClubId === tie.homeClubId ? (leg.awayGoals ?? 0) : (leg.homeGoals ?? 0);
    homeAggregate += homeGoalsThisLeg;
    awayAggregate += awayGoalsThisLeg;
  });

  if (homeAggregate === awayAggregate) {
    // Parita': vantaggio esplicito alla squadra meglio classificata in regular season (homeClubId per costruzione).
    return {
      ...tie,
      winnerClubId: tie.homeClubId,
      resolved: true,
      tieBreakNote: `Parita' ${homeAggregate}-${awayAggregate}: passa ${tie.homeClubName}, meglio classificata in regular season.`,
    };
  }

  const winnerClubId = homeAggregate > awayAggregate ? tie.homeClubId : tie.awayClubId;
  return { ...tie, winnerClubId, resolved: true };
};

const playLeg = (leg: PostseasonLeg, clubWorld: ClubAIState[], seed: string): PostseasonLeg => {
  if (leg.played) return leg;
  const { homeGoals, awayGoals } = simulateFixtureResult(leg.hostClubName, leg.guestClubName, clubWorld, seed);
  return { ...leg, homeGoals, awayGoals, played: true };
};

// Risolve tutte le gare CPU-vs-CPU di un tabellone (mai quelle del club utente: quelle vanno
// giocate nel MatchCenter e passate qui gia' risolte tramite recordUserPostseasonResult).
export const advancePostseasonForCpu = (postseason: PostseasonState, clubWorld: ClubAIState[], userClubId?: string): PostseasonState => {
  const ties = postseason.ties.map(tie => {
    if (tie.resolved) return tie;
    const involvesUser = userClubId && (tie.homeClubId === userClubId || tie.awayClubId === userClubId);
    if (involvesUser) return tie;

    const legsPlayed = tie.legs.map(leg => playLeg(leg, clubWorld, `${postseason.season}_${tie.id}_leg${leg.leg}`));
    let nextTie: PostseasonTie = { ...tie, legs: legsPlayed };
    const needsReturnLeg = tie.stage !== 'playoff_preliminary' || legsPlayed.length < 2; // preliminari: gara secca
    if (tie.stage !== 'playoff_preliminary' && needsReturnLeg) {
      nextTie = withReturnLeg(nextTie);
      nextTie = { ...nextTie, legs: nextTie.legs.map(leg => playLeg(leg, clubWorld, `${postseason.season}_${tie.id}_leg${leg.leg}`)) };
    }
    return resolveTieIfComplete(nextTie);
  });

  return { ...postseason, ties };
};

// Registra il risultato di una gara reale giocata dal club utente nel MatchCenter.
export const recordUserPostseasonResult = (
  postseason: PostseasonState,
  tieId: string,
  legNumber: 1 | 2,
  matchId: string,
  hostGoals: number,
  guestGoals: number
): PostseasonState => {
  const ties = postseason.ties.map(tie => {
    if (tie.id !== tieId) return tie;
    let legs = tie.legs.map(leg => (
      leg.leg === legNumber ? { ...leg, played: true, homeGoals: hostGoals, awayGoals: guestGoals, matchId } : leg
    ));
    let nextTie: PostseasonTie = { ...tie, legs };
    if (legNumber === 1 && tie.stage !== 'playoff_preliminary') {
      nextTie = withReturnLeg(nextTie);
    }
    return resolveTieIfComplete(nextTie);
  });
  return { ...postseason, ties };
};

// Dopo i preliminari, costruisce le semifinali (3a/4a entrano) usando i vincitori.
export const advanceSerieBPlayoffStage = (
  postseason: PostseasonState,
  standingsRank: (clubId: string) => number,
  thirdPlaceClubId: string | undefined,
  fourthPlaceClubId: string | undefined,
  clubNameById: Map<string, string>
): PostseasonState => {
  const preliminaries = postseason.ties.filter(tie => tie.stage === 'playoff_preliminary');
  const preliminariesResolved = preliminaries.length > 0 && preliminaries.every(tie => tie.resolved);
  const hasSemifinals = postseason.ties.some(tie => tie.stage === 'playoff_semifinal');

  if (!preliminariesResolved || hasSemifinals) return postseason;

  const winners = preliminaries.map(tie => tie.winnerClubId).filter((id): id is string => Boolean(id));
  const seededEntrants = [thirdPlaceClubId, fourthPlaceClubId, ...winners].filter((id): id is string => Boolean(id));
  const sorted = [...seededEntrants].sort((a, b) => standingsRank(a) - standingsRank(b));

  const semifinals: PostseasonTie[] = [];
  if (sorted[0] && sorted[3]) {
    semifinals.push({
      id: `po_semi_${postseason.season}_1`,
      stage: 'playoff_semifinal',
      homeClubId: sorted[0],
      homeClubName: nameFor(sorted[0], clubNameById),
      awayClubId: sorted[3],
      awayClubName: nameFor(sorted[3], clubNameById),
      legs: [createLeg(1, sorted[3], nameFor(sorted[3], clubNameById), sorted[0], nameFor(sorted[0], clubNameById))],
      resolved: false,
    });
  }
  if (sorted[1] && sorted[2]) {
    semifinals.push({
      id: `po_semi_${postseason.season}_2`,
      stage: 'playoff_semifinal',
      homeClubId: sorted[1],
      homeClubName: nameFor(sorted[1], clubNameById),
      awayClubId: sorted[2],
      awayClubName: nameFor(sorted[2], clubNameById),
      legs: [createLeg(1, sorted[2], nameFor(sorted[2], clubNameById), sorted[1], nameFor(sorted[1], clubNameById))],
      resolved: false,
    });
  }

  return { ...postseason, ties: [...postseason.ties, ...semifinals] };
};

export const advanceSerieBPlayoffFinal = (postseason: PostseasonState, clubNameById: Map<string, string>, standingsRank: (clubId: string) => number): PostseasonState => {
  const semifinals = postseason.ties.filter(tie => tie.stage === 'playoff_semifinal');
  const semifinalsResolved = semifinals.length === 2 && semifinals.every(tie => tie.resolved);
  const hasFinal = postseason.ties.some(tie => tie.stage === 'playoff_final');
  if (!semifinalsResolved || hasFinal) return postseason;

  const winners = semifinals.map(tie => tie.winnerClubId).filter((id): id is string => Boolean(id));
  const [a, b] = [...winners].sort((x, y) => standingsRank(x) - standingsRank(y));
  if (!a || !b) return postseason;

  const final: PostseasonTie = {
    id: `po_final_${postseason.season}`,
    stage: 'playoff_final',
    homeClubId: a,
    homeClubName: nameFor(a, clubNameById),
    awayClubId: b,
    awayClubName: nameFor(b, clubNameById),
    legs: [createLeg(1, b, nameFor(b, clubNameById), a, nameFor(a, clubNameById))],
    resolved: false,
  };

  return { ...postseason, ties: [...postseason.ties, final] };
};

export const finalizePostseason = (postseason: PostseasonState): PostseasonState => {
  if (postseason.type === 'playout') {
    const tie = postseason.ties[0];
    if (!tie?.resolved) return postseason;
    const relegatedClubId = tie.winnerClubId === tie.homeClubId ? tie.awayClubId : tie.homeClubId;
    return { ...postseason, relegatedClubId, completed: true };
  }

  const final = postseason.ties.find(tie => tie.stage === 'playoff_final');
  if (!final?.resolved) return postseason;
  return { ...postseason, promotedClubId: final.winnerClubId, completed: true };
};

// ─── Serie C astratta: pool feeder deterministico ───
// L1A-Fix: la Serie B deve sempre compensare esattamente quanti club perde verso il feeder, quindi
// il numero di ingressi non e' piu' fisso (era sempre 4) ma passato da chi chiama in base a quanti
// club sono realmente retrocessi verso il feeder quella stagione (relegatedToSerieC.length).
export const pickNextSerieCPromotions = (feederPoolIds: string[], lastPromoted: string[], count: number): string[] => {
  if (count <= 0) return [];
  const sortedPool = [...feederPoolIds].sort();
  const half = Math.ceil(sortedPool.length / 2);
  const groupA = sortedPool.slice(0, half);
  const groupB = sortedPool.slice(half);
  const lastWasGroupA = lastPromoted.length > 0 && lastPromoted.every(id => groupA.includes(id));
  const primary = lastWasGroupA ? groupB : groupA;
  const secondary = lastWasGroupA ? groupA : groupB;
  const fromPool = [...primary, ...secondary.filter(id => !primary.includes(id))].slice(0, count);

  // Fallback shell deterministico (mai giocatori/rose finte, solo un id di club stabile) se anche
  // l'intero pool reale non basta a coprire il numero di rientri richiesto.
  if (fromPool.length < count) {
    const missing = count - fromPool.length;
    const shellIds = Array.from({ length: missing }, (_, i) => `sc_shell_${fromPool.length + i + 1}`);
    return [...fromPool, ...shellIds];
  }
  return fromPool;
};

// Nome/citta' per un id feeder generato come fallback shell (mai un club reale non presente nel pool).
const feederShellLabel = (feederId: string): { name: string; city: string } => {
  const match = feederId.match(/^sc_shell_(\d+)$/);
  const index = match ? match[1] : feederId;
  return { name: `Club Serie C ${index}`, city: 'Città da definire' };
};

export const createClubProfileFromFeeder = (feederId: string, feederName: string, feederCity: string): ClubProfile => ({
  id: feederId,
  name: feederName,
  shortName: feederName,
  initials: feederName.split(' ').map(word => word[0]).join('').slice(0, 3).toUpperCase(),
  city: feederCity,
  stadium: 'Stadio Comunale',
  stadiumCapacity: 8000,
  ownership: 'Proprietà locale',
  transferBudget: 1800000,
  clubValue: 6000000,
  objective: 'Salvezza',
  boardPromise: 'La proprietà è realistica: l\'obiettivo minimo è restare in categoria.',
  playStyle: 'Assetto equilibrato da neopromossa',
  academy: 'Settore giovanile in sviluppo',
  fanbase: 'Promossa dalla Serie C (astratta, non giocabile)',
  pressure: 38,
  difficulty: 'Difficile',
  primaryColor: '#555555',
  secondaryColor: '#FFFFFF',
  highlight: '#555555',
  division: 'serie_b',
});

// ─── Creazione stato iniziale (nuova carriera) ───

const buildEmptySeasonState = (competitionId: CompetitionId, season: string, clubs: ClubRef[]): CompetitionSeasonState => {
  const fixtures = buildCompetitionFixtures(clubs, competitionId, season);
  const standings = calculateStandingsSkeleton(clubs);
  return {
    competitionId,
    season,
    calendar: [],
    standings,
    fixtures,
    completedRound: 0,
    status: 'regular_season',
  };
};

const calculateStandingsSkeleton = (clubs: ClubRef[]): Standing[] => (
  clubs.map((club, index) => ({
    rank: index + 1, name: club.name, points: 0, played: 0, wins: 0, draws: 0, losses: 0,
    goalsFor: 0, goalsAgainst: 0, goalDiff: 0, form: [],
  }))
);

export const createInitialLeagueSystem = (userClubId: string, season = SERIE_B_SEASON): LeagueSystemState => {
  const serieAClubs: ClubRef[] = CLUB_PROFILES.map(club => ({ id: club.id, name: club.name }));
  const serieBClubs: ClubRef[] = SERIE_B_CLUBS.map(club => ({ id: club.id, name: club.name }));

  const clubCompetitionMap: Record<string, CompetitionId> = {};
  serieAClubs.forEach(club => { clubCompetitionMap[club.id] = 'serie_a'; });
  serieBClubs.forEach(club => { clubCompetitionMap[club.id] = 'serie_b'; });
  if (!clubCompetitionMap[userClubId]) clubCompetitionMap[userClubId] = 'serie_a';

  return {
    season,
    competitions: {
      serie_a: buildEmptySeasonState('serie_a', season, serieAClubs),
      serie_b: buildEmptySeasonState('serie_b', season, serieBClubs),
    },
    clubCompetitionMap,
    serieCFeederPoolIds: SERIE_C_FEEDER_POOL.map(club => club.id),
    lastPromotedFromSerieC: [],
  };
};

// ─── Normalizzazione (migration-safe): salvataggi vecchi senza questa struttura tornano null ───

// Nome di un qualunque club conosciuto (Serie A, Serie B, feeder reale o shell L1A-Fix), o null se
// l'id non e' riconoscibile (voce corrotta da scartare durante la riparazione).
const resolveAnyClubName = (id: string): string | null => (
  getAnyClubById(id)?.name
  ?? SERIE_C_FEEDER_POOL.find(club => club.id === id)?.name
  ?? (/^sc_shell_\d+$/.test(id) ? feederShellLabel(id).name : null)
);

// L1A-Fix: ripara un clubCompetitionMap che non rispetta piu' l'invariante "20 Serie A + 20 Serie B"
// (salvataggi generati dalla vecchia pipeline con il drift del pool feeder). Deterministico, mai
// Math.random(); preserva sempre il club utente nella sua divisione attuale se valida.
const repairClubCompetitionMap = (
  rawMap: Record<string, CompetitionId>,
  userClubId: string
): { serieAIds: string[]; serieBIds: string[]; repaired: boolean } => {
  const knownEntries = Object.entries(rawMap).filter(([id]) => resolveAnyClubName(id) !== null);
  let serieAIds = knownEntries.filter(([, div]) => div === 'serie_a').map(([id]) => id);
  let serieBIds = knownEntries.filter(([, div]) => div === 'serie_b').map(([id]) => id);

  if (!serieAIds.includes(userClubId) && !serieBIds.includes(userClubId)) {
    const homeDivision = getClubDivision(getAnyClubById(userClubId) ?? CLUB_PROFILES[0]);
    if (homeDivision === 'serie_b') serieBIds = [...serieBIds, userClubId];
    else serieAIds = [...serieAIds, userClubId];
  }

  if (serieAIds.length === 20 && serieBIds.length === 20) {
    return { serieAIds, serieBIds, repaired: false };
  }

  // Priorita' di mantenimento quando c'e' un eccesso: il club utente e le squadre "di casa" della
  // propria divisione statica si tengono sempre; si scartano per prime le shell sintetiche, poi gli
  // eventuali feeder reali gia' promossi.
  const keepPriority = (id: string) => (
    id === userClubId ? 3
      : /^sc_shell_\d+$/.test(id) ? 0
        : SERIE_C_FEEDER_POOL.some(club => club.id === id) ? 1
          : 2
  );
  const trimTo20 = (ids: string[]) => [...ids].sort((a, b) => keepPriority(b) - keepPriority(a)).slice(0, 20);

  serieAIds = trimTo20(serieAIds);
  serieBIds = trimTo20(serieBIds);

  const placedIds = new Set([...serieAIds, ...serieBIds]);
  const missingSerieAHome = CLUB_PROFILES.map(club => club.id).filter(id => !placedIds.has(id));
  const missingSerieBHome = SERIE_B_CLUBS.map(club => club.id).filter(id => !placedIds.has(id));

  while (serieAIds.length < 20 && missingSerieAHome.length > 0) {
    serieAIds = [...serieAIds, missingSerieAHome.shift() as string];
  }
  while (serieBIds.length < 20 && missingSerieBHome.length > 0) {
    serieBIds = [...serieBIds, missingSerieBHome.shift() as string];
  }
  // Fallback finale, deterministico, mai una rosa/giocatore finto: solo id di club shell.
  let shellIndex = 1;
  while (serieAIds.length < 20) { serieAIds = [...serieAIds, `sc_shell_a${shellIndex}`]; shellIndex += 1; }
  while (serieBIds.length < 20) { serieBIds = [...serieBIds, `sc_shell_${shellIndex}`]; shellIndex += 1; }

  return { serieAIds, serieBIds, repaired: true };
};

export const normalizeLeagueSystem = (raw: unknown, userClubId: string): LeagueSystemState | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.season !== 'string' || !item.competitions || typeof item.competitions !== 'object') return null;

  const competitions = item.competitions as Record<string, unknown>;
  let serieA = competitions.serie_a as CompetitionSeasonState | undefined;
  let serieB = competitions.serie_b as CompetitionSeasonState | undefined;
  if (!serieA || !serieB || !Array.isArray(serieA.fixtures) || !Array.isArray(serieB.fixtures)) return null;

  const rawMap = (item.clubCompetitionMap as Record<string, CompetitionId>) ?? {};
  const { serieAIds, serieBIds, repaired } = repairClubCompetitionMap(rawMap, userClubId);
  let clubCompetitionMap: Record<string, CompetitionId> = rawMap;

  if (repaired) {
    // L1A-Fix: conteggio non 20/20 in questo salvataggio. Si ricostruisce solo la struttura di
    // competizione (calendario/classifica azzerati per la stagione corrente, mai i dati del club:
    // budget, rosa, clubHistory, careerWorld restano intatti altrove) con l'elenco club corretto.
    const nameById = (id: string) => resolveAnyClubName(id) ?? id;
    const serieAClubs: ClubRef[] = serieAIds.map(id => ({ id, name: nameById(id) }));
    const serieBClubs: ClubRef[] = serieBIds.map(id => ({ id, name: nameById(id) }));
    serieA = buildEmptySeasonState('serie_a', item.season, serieAClubs);
    serieB = buildEmptySeasonState('serie_b', item.season, serieBClubs);
    clubCompetitionMap = {};
    serieAIds.forEach(id => { clubCompetitionMap[id] = 'serie_a'; });
    serieBIds.forEach(id => { clubCompetitionMap[id] = 'serie_b'; });
  }

  return {
    season: item.season,
    competitions: { serie_a: serieA, serie_b: serieB },
    clubCompetitionMap,
    serieCFeederPoolIds: Array.isArray(item.serieCFeederPoolIds) ? (item.serieCFeederPoolIds as string[]) : SERIE_C_FEEDER_POOL.map(club => club.id),
    lastPromotedFromSerieC: Array.isArray(item.lastPromotedFromSerieC) ? (item.lastPromotedFromSerieC as string[]) : [],
    seasonTransition: item.seasonTransition as SeasonTransitionSummary | undefined,
  };
};

// ─── Cambio stagione: promozioni, retrocessioni, ingresso feeder Serie C ───

// ─── L1B: conseguenze credibili di promozione/retrocessione ───
// Puro/derivato, mai un nuovo stato persistito: il "movement" di un club si legge da
// SeasonTransitionSummary (gia' persistito dentro leagueSystem.seasonTransition), quindi ricalcolarlo
// due volte (es. dopo F5) produce sempre lo stesso risultato, senza bisogno di guardie aggiuntive.

export type ClubMovement = 'promoted_to_serie_a' | 'relegated_to_serie_b' | 'stayed_serie_a' | 'stayed_serie_b';

export type SeasonObjectiveKind = 'avoid_relegation' | 'consolidate' | 'mid_table' | 'promotion_push' | 'immediate_return' | 'rebuild';

export interface PromotionRelegationContext {
  clubId: string;
  clubName: string;
  seasonLabel: string;
  movement: ClubMovement;
  previousTier: CompetitionId;
  newTier: CompetitionId;
  objective: SeasonObjectiveKind;
  budgetDeltaPercent: number; // % da applicare a budget trasferimenti/monte ingaggi correnti, non allo storico
  wageBudgetDeltaPercent: number;
  reputationDelta: number;
  strengthDelta: number;
  fanMood: 'excited' | 'hopeful' | 'worried' | 'angry' | 'demanding';
  boardPressure: 'low' | 'normal' | 'high' | 'very_high';
}

export const OBJECTIVE_LABELS: Record<SeasonObjectiveKind, string> = {
  avoid_relegation: 'Salvezza',
  consolidate: 'Consolidamento in Serie A',
  mid_table: 'Metà classifica',
  promotion_push: 'Corsa alla promozione',
  immediate_return: 'Risalita immediata',
  rebuild: 'Ricostruzione',
};

export const getClubMovement = (clubId: string, currentTier: CompetitionId, seasonTransition?: SeasonTransitionSummary): ClubMovement => {
  if (seasonTransition?.promotedToSerieA.includes(clubId)) return 'promoted_to_serie_a';
  if (seasonTransition?.relegatedToSerieB.includes(clubId)) return 'relegated_to_serie_b';
  return currentTier === 'serie_a' ? 'stayed_serie_a' : 'stayed_serie_b';
};

// Proxy di "grandezza" del club: usa solo il budget statico gia' esistente in ClubProfile, mai un
// nuovo campo persistito di reputazione/forza.
const clubSizeTier = (club: ClubProfile): 'big' | 'medium' | 'small' => (
  club.transferBudget >= 60000000 ? 'big' : club.transferBudget >= 20000000 ? 'medium' : 'small'
);

export const derivePromotionRelegationContext = (
  club: ClubProfile,
  movement: ClubMovement,
  seasonLabel: string
): PromotionRelegationContext => {
  const size = clubSizeTier(club);
  const base = { clubId: club.id, clubName: club.name, seasonLabel, movement };

  if (movement === 'promoted_to_serie_a') {
    return {
      ...base,
      previousTier: 'serie_b', newTier: 'serie_a',
      objective: size === 'big' ? 'consolidate' : 'avoid_relegation',
      budgetDeltaPercent: size === 'big' ? 40 : size === 'medium' ? 28 : 15,
      wageBudgetDeltaPercent: size === 'big' ? 30 : size === 'medium' ? 20 : 10,
      reputationDelta: 4,
      strengthDelta: 2,
      fanMood: 'excited',
      boardPressure: 'low',
    };
  }
  if (movement === 'relegated_to_serie_b') {
    return {
      ...base,
      previousTier: 'serie_a', newTier: 'serie_b',
      objective: size === 'big' ? 'immediate_return' : size === 'medium' ? 'promotion_push' : 'rebuild',
      budgetDeltaPercent: size === 'big' ? -35 : size === 'medium' ? -27 : -20,
      wageBudgetDeltaPercent: size === 'big' ? -25 : size === 'medium' ? -18 : -10,
      reputationDelta: -4,
      strengthDelta: -3,
      fanMood: size === 'big' ? 'angry' : 'worried',
      boardPressure: size === 'big' ? 'very_high' : 'high',
    };
  }
  return {
    ...base,
    previousTier: movement === 'stayed_serie_a' ? 'serie_a' : 'serie_b',
    newTier: movement === 'stayed_serie_a' ? 'serie_a' : 'serie_b',
    objective: 'mid_table',
    budgetDeltaPercent: 0,
    wageBudgetDeltaPercent: 0,
    reputationDelta: 0,
    strengthDelta: 0,
    fanMood: 'hopeful',
    boardPressure: 'normal',
  };
};

// Segnala (mai vende/rimuove) i giocatori piu' a rischio partenza dopo una retrocessione: valore
// alto, stipendio alto, ambizione alta, overall (proxy di "livello superiore alla Serie B"),
// contratto in scadenza. Puro e deterministico, massimo `maxCount` giocatori, nessuna offerta forzata.
export const getRelegationDepartureRiskPlayerIds = (players: Player[], maxCount = 5): string[] => {
  const scored = players
    .map(player => {
      let score = 0;
      if (player.value >= 8000000) score += 2;
      if (player.wage * 52 >= 1500000) score += 2;
      if ((player.personality?.ambition ?? 0) >= 70) score += 2;
      if (player.overall >= 78) score += 2;
      if (player.contract && (player.contract.status === 'expiring' || player.contract.durationYears <= 1)) score += 2;
      return { id: player.id, score };
    })
    .filter(entry => entry.score >= 4)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCount).map(entry => entry.id);
};

export interface SeasonTransitionInput {
  serieAFinal: CompetitionSeasonState;
  serieBFinal: CompetitionSeasonState;
  serieBPlayoff: PostseasonState | null; // completato: promotedClubId valorizzato se presente
  serieBPlayout: PostseasonState | null; // completato: relegatedClubId valorizzato se presente
  userClubId: string;
  userClubProfile: ClubProfile;
  nextSeason: string;
  previousLastPromotedFromSerieC: string[]; // per alternare deterministicamente il pool feeder
}

export interface SeasonTransitionResult {
  leagueSystem: LeagueSystemState;
  summary: SeasonTransitionSummary;
  clubMemories: ClubMemoryDraft[];
  userClubContext: PromotionRelegationContext;
}

export const advanceLeagueSystemToNextSeason = (input: SeasonTransitionInput): SeasonTransitionResult => {
  const { serieAFinal, serieBFinal, serieBPlayoff, serieBPlayout, userClubId, userClubProfile, nextSeason, previousLastPromotedFromSerieC } = input;

  const clubIdByName = new Map<string, string>();
  CLUB_PROFILES.forEach(club => clubIdByName.set(club.name, club.id));
  SERIE_B_CLUBS.forEach(club => clubIdByName.set(club.name, club.id));

  const serieAOutcome = determineRegularSeasonOutcome(serieAFinal.standings, clubIdByName, SERIE_A_PROMOTION_RULES);
  const serieBOutcome = determineRegularSeasonOutcome(serieBFinal.standings, clubIdByName, SERIE_B_PROMOTION_RULES);

  const relegatedFromA = serieAOutcome.directRelegations;
  const promotedFromBDirect = serieBOutcome.directPromotions;
  const promotedFromBPlayoff = serieBPlayoff?.promotedClubId ? [serieBPlayoff.promotedClubId] : [];
  const promotedFromBThird = serieBOutcome.playoffAutoPromotedThirdPlace ? [serieBOutcome.playoffAutoPromotedThirdPlace] : [];
  // L1A-Fix: quando la 3a si promuove direttamente per distacco, lo spareggio tra 4a-8a resta
  // comunque costruito altrove (bracket gia' esistente) e produrrebbe una 4a promozione in piu'
  // rispetto alle 3 previste (2 dirette + 1 sola tra "3a diretta" e "vincitore playoff"). L'invariante
  // richiesta e' "Serie A rimuove 3, aggiunge 3": si tagliano qui le promozioni oltre la terza,
  // dando priorita' alle dirette e alla 3a auto-promossa sul vincitore del playoff.
  let promotedToSerieA = [...promotedFromBDirect, ...promotedFromBThird, ...promotedFromBPlayoff].slice(0, 3);
  // Rete di sicurezza: se un playoff/playout resta irrisolto perche' coinvolge il club utente (non
  // ancora giocabile in modo interattivo, vedi advancePostseasonForCpu), promotedToSerieA potrebbe
  // avere meno di 3 club. L'invariante "Serie A sempre 20" non e' negoziabile: si completa in modo
  // deterministico con i migliori piazzati Serie B rimasti (mai casuale, mai un duplicato).
  if (promotedToSerieA.length < 3) {
    const rankedSerieB = [...serieBFinal.standings].sort((a, b) => a.rank - b.rank);
    for (const team of rankedSerieB) {
      if (promotedToSerieA.length >= 3) break;
      const id = clubIdByName.get(team.name) ?? team.name;
      if (!promotedToSerieA.includes(id)) promotedToSerieA = [...promotedToSerieA, id];
    }
  }

  const relegatedFromBDirect = serieBOutcome.directRelegations;
  const relegatedFromBPlayout = serieBPlayout?.relegatedClubId
    ? [serieBPlayout.relegatedClubId]
    : (serieBOutcome.playoutAutoRelegated ? [serieBOutcome.playoutAutoRelegated] : []);
  const relegatedToSerieC = [...relegatedFromBDirect, ...relegatedFromBPlayout]
    .filter(id => !promotedToSerieA.includes(id));

  // L1A-Fix: il feeder deve compensare esattamente quanti club la Serie B perde verso di esso
  // (relegatedToSerieC.length), mai un numero fisso: e' questa la causa del drift segnalato.
  const nextSerieCPromotions = pickNextSerieCPromotions(SERIE_C_FEEDER_POOL.map(club => club.id), previousLastPromotedFromSerieC, relegatedToSerieC.length);
  const feederClubsPromoted: ClubProfile[] = nextSerieCPromotions.map(feederId => {
    const feeder = SERIE_C_FEEDER_POOL.find(club => club.id === feederId);
    if (feeder) return createClubProfileFromFeeder(feederId, feeder.name, feeder.city);
    const shell = feederShellLabel(feederId);
    return createClubProfileFromFeeder(feederId, shell.name, shell.city);
  });

  const nextSerieAClubIds = [
    ...CLUB_PROFILES.map(club => club.id).filter(id => !relegatedFromA.includes(id)),
    ...promotedToSerieA,
  ];
  const nextSerieBClubIds = [
    ...SERIE_B_CLUBS.map(club => club.id).filter(id => !promotedToSerieA.includes(id) && !relegatedToSerieC.includes(id)),
    ...relegatedFromA,
    ...feederClubsPromoted.map(club => club.id),
  ];

  const nameById = new Map<string, string>();
  [...CLUB_PROFILES, ...SERIE_B_CLUBS, ...feederClubsPromoted].forEach(club => nameById.set(club.id, club.name));

  const serieAClubs: ClubRef[] = nextSerieAClubIds.map(id => ({ id, name: nameById.get(id) ?? id }));
  const serieBClubs: ClubRef[] = nextSerieBClubIds.map(id => ({ id, name: nameById.get(id) ?? id }));

  const clubCompetitionMap: Record<string, CompetitionId> = {};
  serieAClubs.forEach(club => { clubCompetitionMap[club.id] = 'serie_a'; });
  serieBClubs.forEach(club => { clubCompetitionMap[club.id] = 'serie_b'; });

  const userClubDivision = clubCompetitionMap[userClubId] ?? 'serie_a';
  const userWasInSerieA = getClubDivision(getAnyClubById(userClubId) ?? CLUB_PROFILES[0]) === 'serie_a';
  const userClubMovedDivision = (userWasInSerieA && userClubDivision === 'serie_b') || (!userWasInSerieA && userClubDivision === 'serie_a');

  const serieAChampion = [...serieAFinal.standings].sort((a, b) => a.rank - b.rank)[0]?.name;
  const serieBChampion = [...serieBFinal.standings].sort((a, b) => a.rank - b.rank)[0]?.name;

  const summary: SeasonTransitionSummary = {
    previousSeason: serieAFinal.season,
    newSeason: nextSeason,
    serieAChampion,
    serieBChampion,
    promotedToSerieA,
    relegatedToSerieB: relegatedFromA,
    promotedToSerieB: feederClubsPromoted.map(club => club.id),
    relegatedToSerieC,
    userClubDivision,
    userClubMovedDivision,
  };

  // L1B: contesto conseguenze (obiettivo/budget/mood/pressione) per il club utente, derivato in modo
  // puro dal movimento appena calcolato. Sempre calcolato (anche se il club resta nella sua divisione),
  // cosi' la UI ha sempre un obiettivo stagionale coerente da mostrare.
  const userMovement = getClubMovement(userClubId, userClubDivision, summary);
  const userClubContext = derivePromotionRelegationContext(userClubProfile, userMovement, nextSeason);

  const clubMemories: ClubMemoryDraft[] = [];
  if (userClubMovedDivision) {
    clubMemories.push({
      season: nextSeason,
      category: 'record',
      title: userClubDivision === 'serie_a' ? 'Promozione in Serie A' : 'Retrocessione in Serie B',
      description: userClubDivision === 'serie_a'
        ? `Il club conquista la promozione in Serie A per la stagione ${nextSeason}. Obiettivo dichiarato: ${OBJECTIVE_LABELS[userClubContext.objective]}.`
        : `Il club retrocede in Serie B per la stagione ${nextSeason}. Obiettivo dichiarato: ${OBJECTIVE_LABELS[userClubContext.objective]}.`,
      importance: 92,
      fanImpact: userClubDivision === 'serie_a' ? 10 : -10,
      dressingRoomImpact: userClubDivision === 'serie_a' ? 6 : -6,
      tags: ['cambio-divisione', userClubDivision],
      persistence: 'permanent',
    });
  }

  const leagueSystem: LeagueSystemState = {
    season: nextSeason,
    competitions: {
      serie_a: buildEmptySeasonState('serie_a', nextSeason, serieAClubs),
      serie_b: buildEmptySeasonState('serie_b', nextSeason, serieBClubs),
    },
    clubCompetitionMap,
    serieCFeederPoolIds: SERIE_C_FEEDER_POOL.map(club => club.id),
    lastPromotedFromSerieC: nextSerieCPromotions,
    seasonTransition: summary,
  };

  return { leagueSystem, summary, clubMemories, userClubContext };
};

export const createInitialSerieBClubWorld = (): ClubAIState[] => (
  SERIE_B_CLUBS.map(club => ({
    clubId: club.id,
    name: club.name,
    budget: Math.round(club.transferBudget * 0.85),
    ambition: 55,
    roster: createPlaceholderPlayersForSerieBClub(club),
    transferLog: [],
  }))
);

export const isStage = (stage: PostseasonStage, target: PostseasonStage) => stage === target;
