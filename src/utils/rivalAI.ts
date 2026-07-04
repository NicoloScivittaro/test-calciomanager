import { CLUB_PROFILES } from '../data/serieAData';
import { ClubMemoryDraft, ClubProfile, MatchStats, RivalTacticalMemory, Tactic, TeamDNAKey, TeamDNAState } from '../types';
import { TEAM_DNA_DEFINITIONS } from './teamDNA';

type ClubMeta = ClubProfile & {
  strength?: number;
  expectedRank?: number;
};

type UserWeapon = 'wideCross' | 'centralCombinations' | 'pressingWave' | 'verticalCounter' | 'possessionLock' | 'lowBlock' | 'romanticRisk';

interface RivalAdaptationReport {
  adaptationScore: number;
  userAttackPenalty: number;
  opponentBoost: number;
  tacticalDisorderSwing: number;
  plannedResponse: string;
  notes: string[];
}

interface RivalMatchContext {
  opponentName: string;
  teamName: string;
  tactic: Tactic;
  teamDNA: TeamDNAState;
  stats: MatchStats;
  scoreUser: number;
  scoreOpponent: number;
  round: number;
  exUserPlayerCount: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const DNA_KEYS = Object.keys(TEAM_DNA_DEFINITIONS) as TeamDNAKey[];

const createEmptyFamiliarity = (): Record<TeamDNAKey, number> => ({
  pressingFeroce: 0,
  possesso: 0,
  contropiedeVerticale: 0,
  giovaniItaliani: 0,
  sudamericaniTecnici: 0,
  vivaio: 0,
  clubVenditore: 0,
  galacticos: 0,
  difesaGranitica: 0,
  squadraCinica: 0,
  calcioRomantico: 0
});

const philosophyFromClub = (club: ClubMeta): TeamDNAKey => {
  const text = `${club.playStyle} ${club.objective} ${club.academy}`.toLowerCase();
  if (text.includes('press') || text.includes('duelli') || text.includes('aggress')) return 'pressingFeroce';
  if (text.includes('possesso') || text.includes('costruzione')) return 'possesso';
  if (text.includes('riparten') || text.includes('transizion') || text.includes('diretto')) return 'contropiedeVerticale';
  if (text.includes('vivaio') || text.includes('primavera')) return 'vivaio';
  if (text.includes('giovani') && text.includes('ital')) return 'giovaniItaliani';
  if (text.includes('salvezza') || text.includes('compatto') || text.includes('solid')) return 'difesaGranitica';
  if ((club.strength ?? 72) >= 86 || club.objective.toLowerCase().includes('scudetto')) return 'galacticos';
  if (text.includes('attacco') || text.includes('coraggio')) return 'calcioRomantico';
  return club.transferBudget < 25000000 ? 'clubVenditore' : 'squadraCinica';
};

const moduleFromClub = (club: ClubMeta): Tactic['module'] => {
  const text = club.playStyle.toLowerCase();
  if (text.includes('difesa a tre') || text.includes('quinti')) return '3-5-2';
  if (text.includes('trequarti') || text.includes('costruzione')) return '4-2-3-1';
  return '4-3-3';
};

const weaknessFromPhilosophy = (philosophy: TeamDNAKey) => {
  switch (philosophy) {
    case 'pressingFeroce':
      return 'soffre cambi campo e uscite pulite se il primo pressing viene saltato';
    case 'possesso':
      return 'puo concedere transizioni se perde palla con tanti uomini sopra linea';
    case 'contropiedeVerticale':
      return 'fatica quando deve costruire contro blocchi bassi pazienti';
    case 'difesaGranitica':
      return 'puo abbassarsi troppo e lasciare tiri dal limite';
    case 'galacticos':
      return 'pressione alta e spogliatoio sensibile se la gara si sporca';
    case 'vivaio':
    case 'giovaniItaliani':
      return 'i giovani possono soffrire pressione e partite fisiche';
    case 'clubVenditore':
      return 'rosa meno profonda se il mercato ha tolto leader';
    case 'sudamericaniTecnici':
    case 'calcioRomantico':
      return 'talento enorme, ma campo aperto alle spalle se perde ordine';
    case 'squadraCinica':
    default:
      return 'produce poco se costretta a inseguire e alzare il ritmo';
  }
};

const createMemoryForClub = (club: ClubMeta): RivalTacticalMemory => {
  const philosophy = philosophyFromClub(club);
  const strength = club.strength ?? 72;
  const expectedRank = club.expectedRank ?? 12;

  return {
    clubName: club.name,
    coachName: club.coach?.name ?? `Tecnico ${club.shortName}`,
    coachGeneration: 1,
    philosophy,
    preferredModule: moduleFromClub(club),
    courage: Math.round(clamp(38 + strength * 0.48 + (expectedRank <= 6 ? 10 : expectedRank >= 16 ? -8 : 0), 34, 92)),
    adaptability: Math.round(clamp(34 + strength * 0.42 + (club.pressure > 80 ? 7 : 0), 32, 88)),
    weakness: weaknessFromPhilosophy(philosophy),
    relationship: 0,
    meetings: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    familiarity: createEmptyFamiliarity(),
    wideTrap: 0,
    centralTrap: 0,
    pressingTrap: 0,
    counterTrap: 0,
    possessionTrap: 0,
    lowBlockBias: expectedRank >= 14 ? 38 : expectedRank >= 9 ? 22 : 8,
    exPlayerKnowledge: 0,
    lastUserWeapon: 'Sconosciuta',
    lastMeetingSummary: 'Nessun precedente nella carriera.',
    history: []
  };
};

export const createInitialRivalMemories = (userTeamName: string): RivalTacticalMemory[] => (
  CLUB_PROFILES
    .filter(club => club.name !== userTeamName)
    .map(club => createMemoryForClub(club as ClubMeta))
);

export const normalizeRivalMemories = (
  stored: RivalTacticalMemory[] | null | undefined,
  userTeamName: string
): RivalTacticalMemory[] => {
  const byName = new Map((stored ?? []).map(memory => [memory.clubName, memory]));

  return CLUB_PROFILES
    .filter(club => club.name !== userTeamName)
    .map(club => {
      const base = createMemoryForClub(club as ClubMeta);
      const current = byName.get(club.name);
      if (!current) return base;

      return {
        ...base,
        ...current,
        familiarity: {
          ...createEmptyFamiliarity(),
          ...(current.familiarity ?? {})
        },
        courage: clamp(current.courage ?? base.courage, 0, 100),
        adaptability: clamp(current.adaptability ?? base.adaptability, 0, 100),
        relationship: clamp(current.relationship ?? 0, -100, 100),
        wideTrap: clamp(current.wideTrap ?? 0, 0, 100),
        centralTrap: clamp(current.centralTrap ?? 0, 0, 100),
        pressingTrap: clamp(current.pressingTrap ?? 0, 0, 100),
        counterTrap: clamp(current.counterTrap ?? 0, 0, 100),
        possessionTrap: clamp(current.possessionTrap ?? 0, 0, 100),
        lowBlockBias: clamp(current.lowBlockBias ?? base.lowBlockBias, 0, 100),
        exPlayerKnowledge: clamp(current.exPlayerKnowledge ?? 0, 0, 100),
        history: current.history ?? []
      };
    });
};

export const getRivalMemoryForClub = (
  memories: RivalTacticalMemory[],
  clubName: string
) => {
  const existing = memories.find(memory => memory.clubName === clubName);
  if (existing) return existing;
  const club = CLUB_PROFILES.find(item => item.name === clubName) as ClubMeta | undefined;
  return club ? createMemoryForClub(club) : null;
};

const getUserWeapon = (tactic: Tactic, stats?: MatchStats): UserWeapon => {
  if (tactic.attackingFocus === 'Fasce' || tactic.chanceCreation === 'Cross') return 'wideCross';
  if (tactic.pressing >= 76 && tactic.transition === 'Riaggressione') return 'pressingWave';
  if (tactic.buildUp === 'Manovrata' && (stats?.possession ?? 56) >= 56) return 'possessionLock';
  if (tactic.transition === 'Contropiede' || tactic.tempo >= 72 || tactic.buildUp === 'Lancio Lungo') return 'verticalCounter';
  if (tactic.mentality === 'Difensiva' || tactic.defensiveLine <= 42) return 'lowBlock';
  if (tactic.mentality === 'Offensiva' && tactic.riskLevel >= 68) return 'romanticRisk';
  return 'centralCombinations';
};

const weaponLabel: Record<UserWeapon, string> = {
  wideCross: 'esterni larghi e cross',
  centralCombinations: 'combinazioni centrali',
  pressingWave: 'pressing alto e riaggressione',
  verticalCounter: 'ripartenza verticale',
  possessionLock: 'possesso e controllo',
  lowBlock: 'blocco basso',
  romanticRisk: 'attacco rischioso'
};

const getWeaponMemory = (memory: RivalTacticalMemory, weapon: UserWeapon) => {
  switch (weapon) {
    case 'wideCross':
      return memory.wideTrap;
    case 'centralCombinations':
      return memory.centralTrap;
    case 'pressingWave':
      return memory.pressingTrap;
    case 'verticalCounter':
      return memory.counterTrap;
    case 'possessionLock':
      return memory.possessionTrap;
    case 'lowBlock':
      return memory.lowBlockBias;
    case 'romanticRisk':
    default:
      return Math.max(memory.centralTrap, memory.counterTrap);
  }
};

const plannedResponseFor = (weapon: UserWeapon, memory: RivalTacticalMemory, opponentRating: number) => {
  if (opponentRating <= 74) return 'blocco basso, pochi rischi e transizioni appena recupera palla';
  if (opponentRating >= 84 && memory.courage >= 70) return 'pressione alta nei primi minuti per toglierti sicurezza';

  switch (weapon) {
    case 'wideCross':
      return 'raddoppi sulle fasce e terzino meno aggressivo';
    case 'centralCombinations':
      return 'mediano schermante davanti alla difesa e densita centrale';
    case 'pressingWave':
      return 'uscita diretta sul lato debole per saltare il primo pressing';
    case 'verticalCounter':
      return 'linea piu prudente e possesso difensivo per togliere campo';
    case 'possessionLock':
      return 'blocco medio, pazienza e ripartenza sulle tue perdite centrali';
    case 'lowBlock':
      return 'pazienza, tiri dal limite e tanti uomini dietro la palla persa';
    case 'romanticRisk':
    default:
      return 'difesa stretta e attacchi rapidi nello spazio lasciato alle spalle';
  }
};

export const evaluateRivalAdaptation = (
  memory: RivalTacticalMemory | null,
  tactic: Tactic,
  teamDNA: TeamDNAState,
  opponentRating: number,
  round: number,
  exUserPlayerCount = 0
): RivalAdaptationReport => {
  if (!memory) {
    return {
      adaptationScore: 0,
      userAttackPenalty: 0,
      opponentBoost: 0,
      tacticalDisorderSwing: 0,
      plannedResponse: 'analisi avversaria non disponibile',
      notes: []
    };
  }

  const weapon = getUserWeapon(tactic);
  const weaponMemory = getWeaponMemory(memory, weapon);
  const dnaFamiliarity = memory.familiarity[teamDNA.active] ?? 0;
  const reputationTarget = Math.max(0, teamDNA.reputation - 58) * 0.42;
  const repeatedMeetings = Math.min(memory.meetings, 8) * 2.8;
  const exKnowledge = Math.max(memory.exPlayerKnowledge, exUserPlayerCount * 18);
  const lateSeasonScouting = round >= 10 ? 5 : round >= 5 ? 2 : 0;

  const adaptationScore = Math.round(clamp(
    memory.adaptability * 0.26 +
    weaponMemory * 0.31 +
    dnaFamiliarity * 0.26 +
    repeatedMeetings +
    reputationTarget +
    exKnowledge * 0.18 +
    lateSeasonScouting +
    (opponentRating >= 84 ? 6 : opponentRating <= 72 ? -4 : 0),
    0,
    100
  ));
  const plannedResponse = plannedResponseFor(weapon, memory, opponentRating);
  const smallTeamCaution = opponentRating <= Math.max(74, teamDNA.reputation + 6) ? Math.min(3.4, memory.lowBlockBias * 0.04) : 0;
  const bigTeamCourage = opponentRating >= 84 && memory.courage >= 70 ? 1.8 : 0;

  const notes = [
    adaptationScore >= 68 ? `${memory.coachName} ha studiato il tuo piano: ${plannedResponse}.` : '',
    weaponMemory >= 55 ? `Hai usato spesso ${weaponLabel[weapon]}: il rivale ora la prepara meglio.` : '',
    dnaFamiliarity >= 58 ? `Conoscono il DNA ${TEAM_DNA_DEFINITIONS[teamDNA.active].shortName} e provano a sporcarlo.` : '',
    exUserPlayerCount > 0 ? `${exUserPlayerCount} ex della tua rosa conosce alcuni automatismi.` : '',
    opponentRating <= 74 ? 'Squadra piccola: tende a chiudersi e a farti forzare la giocata.' : '',
    opponentRating >= 84 ? 'Big match: il rivale non ti aspetta, prova a toglierti campo.' : ''
  ].filter(Boolean);

  return {
    adaptationScore,
    userAttackPenalty: Number(clamp((adaptationScore - 45) * 0.065 + smallTeamCaution, 0, 7.5).toFixed(2)),
    opponentBoost: Number(clamp((adaptationScore - 52) * 0.045 + bigTeamCourage, 0, 5.5).toFixed(2)),
    tacticalDisorderSwing: Number(clamp((adaptationScore - 48) * 0.04 + exKnowledge * 0.012, 0, 5.2).toFixed(2)),
    plannedResponse,
    notes
  };
};

const increaseWeaponMemory = (memory: RivalTacticalMemory, weapon: UserWeapon, amount: number): RivalTacticalMemory => {
  switch (weapon) {
    case 'wideCross':
      return { ...memory, wideTrap: clamp(memory.wideTrap + amount, 0, 100) };
    case 'centralCombinations':
      return { ...memory, centralTrap: clamp(memory.centralTrap + amount, 0, 100) };
    case 'pressingWave':
      return { ...memory, pressingTrap: clamp(memory.pressingTrap + amount, 0, 100) };
    case 'verticalCounter':
      return { ...memory, counterTrap: clamp(memory.counterTrap + amount, 0, 100) };
    case 'possessionLock':
      return { ...memory, possessionTrap: clamp(memory.possessionTrap + amount, 0, 100) };
    case 'lowBlock':
      return { ...memory, lowBlockBias: clamp(memory.lowBlockBias + amount * 0.45, 0, 100) };
    case 'romanticRisk':
    default:
      return {
        ...memory,
        centralTrap: clamp(memory.centralTrap + amount * 0.5, 0, 100),
        counterTrap: clamp(memory.counterTrap + amount * 0.5, 0, 100)
      };
  }
};

const counterPhilosophyFor = (teamDNA: TeamDNAKey): TeamDNAKey => {
  switch (teamDNA) {
    case 'pressingFeroce':
      return 'possesso';
    case 'possesso':
      return 'contropiedeVerticale';
    case 'contropiedeVerticale':
      return 'difesaGranitica';
    case 'calcioRomantico':
      return 'squadraCinica';
    case 'difesaGranitica':
      return 'calcioRomantico';
    default:
      return 'squadraCinica';
  }
};

const maybeReplaceCoach = (memory: RivalTacticalMemory, teamDNA: TeamDNAState) => {
  const pressureToChange = memory.meetings >= 4 && memory.losses - memory.wins >= 3;
  if (!pressureToChange) return memory;

  const philosophy = counterPhilosophyFor(teamDNA.active);
  return {
    ...memory,
    coachName: `Nuovo tecnico ${memory.clubName}`,
    coachGeneration: memory.coachGeneration + 1,
    philosophy,
    preferredModule: philosophy === 'difesaGranitica' ? '3-5-2' as const : philosophy === 'possesso' ? '4-2-3-1' as const : '4-3-3' as const,
    adaptability: clamp(memory.adaptability + 8, 0, 100),
    courage: clamp(memory.courage + (philosophy === 'difesaGranitica' ? -6 : 5), 0, 100),
    weakness: weaknessFromPhilosophy(philosophy),
    history: [`Cambio allenatore: arriva un tecnico preparato per neutralizzare il tuo DNA ${TEAM_DNA_DEFINITIONS[teamDNA.active].shortName}.`, ...memory.history].slice(0, 12)
  };
};

export const evolveRivalAfterMatch = (
  memory: RivalTacticalMemory | null,
  context: RivalMatchContext
) => {
  if (!memory) return { memory: null as RivalTacticalMemory | null, clubMemory: null as ClubMemoryDraft | null };

  const userWon = context.scoreUser > context.scoreOpponent;
  const draw = context.scoreUser === context.scoreOpponent;
  const weapon = getUserWeapon(context.tactic, context.stats);
  const hurtByWeapon = context.scoreUser >= 2 || context.stats.xGUser >= 1.25 || context.stats.shotsUser >= 12;
  const amount = hurtByWeapon ? 12 : context.stats.xGUser <= 0.8 ? 4 : 8;
  const nextFamiliarity = {
    ...memory.familiarity,
    [context.teamDNA.active]: clamp((memory.familiarity[context.teamDNA.active] ?? 0) + (hurtByWeapon ? 13 : 8), 0, 100)
  };
  const scoreLine = `${context.teamName} ${context.scoreUser}-${context.scoreOpponent} ${context.opponentName}`;
  const meetingSummary = userWon
    ? `${context.opponentName} perde contro ${weaponLabel[weapon]} e prepara contromisure.`
    : draw
      ? `${context.opponentName} strappa un pari leggendo ${weaponLabel[weapon]}.`
      : `${context.opponentName} batte il tuo piano basato su ${weaponLabel[weapon]}.`;

  let next: RivalTacticalMemory = {
    ...memory,
    meetings: memory.meetings + 1,
    wins: memory.wins + (!userWon && !draw ? 1 : 0),
    draws: memory.draws + (draw ? 1 : 0),
    losses: memory.losses + (userWon ? 1 : 0),
    relationship: clamp(memory.relationship + (Math.abs(context.scoreUser - context.scoreOpponent) >= 3 ? -8 : userWon ? -4 : 3), -100, 100),
    familiarity: nextFamiliarity,
    exPlayerKnowledge: clamp(Math.max(memory.exPlayerKnowledge, context.exUserPlayerCount * 18), 0, 100),
    lastUserWeapon: weaponLabel[weapon],
    lastMeetingSummary: `${scoreLine}: ${meetingSummary}`,
    history: [`${scoreLine}: studiato ${weaponLabel[weapon]}.`, ...memory.history].slice(0, 12)
  };

  next = increaseWeaponMemory(next, weapon, amount);
  const beforeCoach = next.coachGeneration;
  next = maybeReplaceCoach(next, context.teamDNA);
  const coachChanged = next.coachGeneration !== beforeCoach;
  const rivalryIsHot = next.meetings >= 3 && Math.abs(next.relationship) >= 18;

  const clubMemory: ClubMemoryDraft | null = coachChanged || rivalryIsHot
    ? {
        season: `Stagione ${context.teamDNA.seasonsTracked}`,
        category: 'rivalry',
        title: coachChanged ? `${context.opponentName} cambia guida tecnica` : `Duello tattico con ${context.opponentName}`,
        description: coachChanged
          ? `${context.opponentName} cambia allenatore dopo le sconfitte contro il tuo DNA. Il nuovo piano nasce per neutralizzarti.`
          : `${context.opponentName} conosce sempre meglio ${weaponLabel[weapon]}: la prossima sfida sara meno prevedibile.`,
        importance: coachChanged ? 82 : 70,
        fanImpact: rivalryIsHot ? 2 : 0,
        dressingRoomImpact: 1,
        tags: ['rivali', 'tattica', context.opponentName],
        opponent: context.opponentName,
        score: scoreLine
      }
    : null;

  return { memory: next, clubMemory };
};

export const upsertRivalMemory = (
  memories: RivalTacticalMemory[],
  nextMemory: RivalTacticalMemory | null,
  userTeamName: string
) => {
  if (!nextMemory) return normalizeRivalMemories(memories, userTeamName);
  const normalized = normalizeRivalMemories(memories, userTeamName);
  const exists = normalized.some(memory => memory.clubName === nextMemory.clubName);
  if (!exists) return [...normalized, nextMemory];
  return normalized.map(memory => memory.clubName === nextMemory.clubName ? nextMemory : memory);
};

export const advanceRivalMemoriesSeason = (memories: RivalTacticalMemory[]) => (
  memories.map(memory => ({
    ...memory,
    familiarity: DNA_KEYS.reduce((scores, key) => {
      scores[key] = clamp((memory.familiarity[key] ?? 0) * 0.86, 0, 100);
      return scores;
    }, createEmptyFamiliarity()),
    wideTrap: clamp(memory.wideTrap * 0.88, 0, 100),
    centralTrap: clamp(memory.centralTrap * 0.88, 0, 100),
    pressingTrap: clamp(memory.pressingTrap * 0.88, 0, 100),
    counterTrap: clamp(memory.counterTrap * 0.88, 0, 100),
    possessionTrap: clamp(memory.possessionTrap * 0.88, 0, 100),
    lowBlockBias: clamp(memory.lowBlockBias * 0.94, 0, 100),
    exPlayerKnowledge: clamp(memory.exPlayerKnowledge * 0.9, 0, 100),
    history: [`Nuova stagione: parte della memoria tattica resta, ma alcuni automatismi vanno riscoperti.`, ...memory.history].slice(0, 12)
  }))
);
