import { ClubMemoryDraft, ClubProfile, MatchStats, Player, Standing, Tactic, TeamDNAKey, TeamDNAState } from '../types';

export interface TeamDNADefinition {
  key: TeamDNAKey;
  name: string;
  shortName: string;
  description: string;
  fanPromise: string;
  attracts: string;
  neutralizedBy: string;
  color: string;
}

interface MatchDNAContext {
  tactic: Tactic;
  stats: MatchStats;
  scoreUser: number;
  scoreOpponent: number;
  opponent: string;
  opponentRating: number;
  playedPlayers: Player[];
}

interface SeasonDNAContext {
  club?: ClubProfile;
  standings: Standing[];
  players: Player[];
  tactic: Tactic;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getSeasonLabel = (seasonIndex: number) => {
  const startYear = 2026 + Math.max(0, seasonIndex - 1);
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
};

export const TEAM_DNA_DEFINITIONS: Record<TeamDNAKey, TeamDNADefinition> = {
  pressingFeroce: {
    key: 'pressingFeroce',
    name: 'Pressing feroce',
    shortName: 'Pressing',
    description: 'Recupero palla alto, aggressivita organizzata e ritmo continuo.',
    fanPromise: 'I tifosi vogliono una squadra che aggredisce ogni pallone.',
    attracts: 'giocatori resistenti, aggressivi e professionali',
    neutralizedBy: 'uscita pulita dal basso e cambi campo rapidi',
    color: '#34D399'
  },
  possesso: {
    key: 'possesso',
    name: 'Calcio di possesso',
    shortName: 'Possesso',
    description: 'Pazienza, costruzione dal basso, controllo emotivo e dominio territoriale.',
    fanPromise: 'La piazza si aspetta identita tecnica e controllo.',
    attracts: 'centrocampisti freddi, tecnici e intelligenti',
    neutralizedBy: 'blocchi bassi e transizioni veloci',
    color: '#60A5FA'
  },
  contropiedeVerticale: {
    key: 'contropiedeVerticale',
    name: 'Contropiede verticale',
    shortName: 'Verticale',
    description: 'Pochi tocchi, campo aperto e attacchi diretti alle spalle.',
    fanPromise: 'Conta essere letali quando si apre lo spazio.',
    attracts: 'ali, punte mobili e giocatori rapidi mentalmente',
    neutralizedBy: 'difese prudenti e possesso difensivo',
    color: '#F59E0B'
  },
  giovaniItaliani: {
    key: 'giovaniItaliani',
    name: 'Giovani italiani',
    shortName: 'Italiani U23',
    description: 'Costruire valore e appartenenza con talento nazionale giovane.',
    fanPromise: 'Il pubblico si affeziona ai ragazzi che crescono nel campionato.',
    attracts: 'giovani italiani con potenziale e fame',
    neutralizedBy: 'pressione mediatica e poca pazienza',
    color: '#22C55E'
  },
  sudamericaniTecnici: {
    key: 'sudamericaniTecnici',
    name: 'Sudamericani tecnici',
    shortName: 'Tecnica SA',
    description: 'Creativita, personalita offensiva e giocatori tecnici da valorizzare.',
    fanPromise: 'La gente vuole fantasia e colpi che spostano le partite.',
    attracts: 'talenti sudamericani tecnici e ambiziosi',
    neutralizedBy: 'marcature dure e pressing fisico',
    color: '#A3E635'
  },
  vivaio: {
    key: 'vivaio',
    name: 'Vivaio prima di tutto',
    shortName: 'Vivaio',
    description: 'Minuti veri ai giovani, pazienza tecnica e crescita interna.',
    fanPromise: 'Ogni giovane lanciato rafforza il legame col club.',
    attracts: 'prospetti, giocatori leali e veterani mentori',
    neutralizedBy: 'club ricchi che rubano i migliori talenti',
    color: '#2DD4BF'
  },
  clubVenditore: {
    key: 'clubVenditore',
    name: 'Club venditore',
    shortName: 'Trading',
    description: 'Comprare bene, valorizzare e vendere al momento giusto.',
    fanPromise: 'La sostenibilita conta, ma le cessioni dolorose vanno sostituite.',
    attracts: 'giovani rivendibili e giocatori in cerca di vetrina',
    neutralizedBy: 'piazze ambiziose e procuratori aggressivi',
    color: '#C084FC'
  },
  galacticos: {
    key: 'galacticos',
    name: 'Galacticos',
    shortName: 'Stelle',
    description: 'Reputazione, stelle, grandi stipendi e pressione da vittoria immediata.',
    fanPromise: 'Arrivano nomi pesanti: ora bisogna vincere.',
    attracts: 'campioni, ego forti e giocatori da copertina',
    neutralizedBy: 'spogliatoi fragili e squadre piu affamate',
    color: '#FDE68A'
  },
  difesaGranitica: {
    key: 'difesaGranitica',
    name: 'Difesa granitica',
    shortName: 'Muro',
    description: 'Compattezza, marcature, portiere centrale e pochi spazi concessi.',
    fanPromise: 'La squadra deve essere difficile da battere.',
    attracts: 'difensori affidabili, portieri freddi e mediani tattici',
    neutralizedBy: 'pazienza tecnica e tiri da fuori',
    color: '#93C5FD'
  },
  squadraCinica: {
    key: 'squadraCinica',
    name: 'Squadra cinica',
    shortName: 'Cinismo',
    description: 'Poche occasioni sprecate, freddezza e gestione dei momenti.',
    fanPromise: 'Conta vincere le partite sporche.',
    attracts: 'finalizzatori, portieri da big match e leader freddi',
    neutralizedBy: 'ritmi alti che aumentano il numero di episodi',
    color: '#F97316'
  },
  calcioRomantico: {
    key: 'calcioRomantico',
    name: 'Calcio romantico offensivo',
    shortName: 'Romantico',
    description: 'Attacco, rischio, fantasia e partite che restano nella memoria.',
    fanPromise: 'I tifosi vogliono emozione, gol e coraggio.',
    attracts: 'talenti offensivi, trequartisti e giocatori creativi',
    neutralizedBy: 'difese basse e transizioni letali',
    color: '#FB7185'
  }
};

const DNA_KEYS = Object.keys(TEAM_DNA_DEFINITIONS) as TeamDNAKey[];

const createEmptyScores = (): Record<TeamDNAKey, number> => ({
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

const rankScores = (scores: Record<TeamDNAKey, number>) => (
  [...DNA_KEYS].sort((a, b) => scores[b] - scores[a])
);

const refreshDNA = (dna: TeamDNAState): TeamDNAState => {
  const ranked = rankScores(dna.scores);
  const active = ranked[0] ?? 'possesso';
  const secondary = ranked.filter(key => key !== active && dna.scores[key] >= 34).slice(0, 2);
  const definition = TEAM_DNA_DEFINITIONS[active];
  return {
    ...dna,
    active,
    secondary,
    lastNarrative: `${definition.name}: ${definition.description}`
  };
};

const addScores = (
  dna: TeamDNAState,
  deltas: Partial<Record<TeamDNAKey, number>>,
  decay = 0.985
): TeamDNAState => {
  const scores = createEmptyScores();
  DNA_KEYS.forEach(key => {
    scores[key] = clamp((dna.scores[key] ?? 0) * decay + (deltas[key] ?? 0), 0, 100);
  });

  return refreshDNA({
    ...dna,
    scores
  });
};

export const createInitialTeamDNA = (club: ClubProfile, players: Player[], tactic?: Tactic): TeamDNAState => {
  const scores = createEmptyScores();
  const playStyle = `${club.playStyle} ${club.academy} ${club.objective}`.toLowerCase();
  const italianU23 = players.filter(player => player.nationality === 'Italia' && player.age <= 23).length;
  const youngPlayers = players.filter(player => player.age <= 23).length;
  const stars = players.filter(player => player.overall >= 84).length;
  const defenders = players.filter(player => ['GK', 'CB', 'LB', 'RB', 'DM'].includes(player.role) && player.overall >= 78).length;

  scores.pressingFeroce = playStyle.includes('press') || playStyle.includes('rapido') ? 45 : 28;
  scores.possesso = playStyle.includes('possesso') || playStyle.includes('costruzione') ? 48 : 30;
  scores.contropiedeVerticale = playStyle.includes('verticale') || playStyle.includes('transizion') ? 44 : 26;
  scores.giovaniItaliani = clamp(24 + italianU23 * 7, 18, 74);
  scores.vivaio = clamp(24 + youngPlayers * 4 + (playStyle.includes('vivaio') || playStyle.includes('primavera') ? 18 : 0), 20, 78);
  scores.galacticos = clamp(20 + stars * 14 + club.transferBudget / 6000000, 18, 82);
  scores.difesaGranitica = clamp(24 + defenders * 4 + (playStyle.includes('solid') ? 12 : 0), 20, 72);
  scores.squadraCinica = 30 + Math.round(club.pressure / 8);
  scores.calcioRomantico = playStyle.includes('attacco') || playStyle.includes('offens') ? 45 : 28;
  scores.sudamericaniTecnici = 24;
  scores.clubVenditore = club.transferBudget < 35000000 ? 45 : 25;

  const base = refreshDNA({
    clubName: club.name,
    active: 'possesso',
    secondary: [],
    scores,
    reputation: clamp(42 + club.pressure * 0.28, 35, 76),
    internationalReputation: clamp(32 + club.clubValue / 35000000, 28, 78),
    fanAlignment: 54,
    marketAttraction: clamp(42 + club.transferBudget / 3500000, 35, 84),
    youthDevelopment: clamp(40 + youngPlayers * 2 + italianU23 * 2, 35, 78),
    seasonsTracked: 1,
    lastNarrative: '',
    history: [`Inizio carriera: il club parte da ${club.playStyle}`]
  });

  return tactic ? evolveTeamDNAFromTactic(base, tactic, players) : base;
};

export const normalizeTeamDNA = (dna: TeamDNAState | null | undefined, club: ClubProfile, players: Player[], tactic?: Tactic) => {
  if (!dna?.scores) return createInitialTeamDNA(club, players, tactic);
  const scores = createEmptyScores();
  DNA_KEYS.forEach(key => {
    scores[key] = clamp(Number(dna.scores[key] ?? 0), 0, 100);
  });
  return refreshDNA({
    ...dna,
    clubName: dna.clubName ?? club.name,
    scores,
    reputation: clamp(dna.reputation ?? 50, 0, 100),
    internationalReputation: clamp(dna.internationalReputation ?? 42, 0, 100),
    fanAlignment: clamp(dna.fanAlignment ?? 50, 0, 100),
    marketAttraction: clamp(dna.marketAttraction ?? 50, 0, 100),
    youthDevelopment: clamp(dna.youthDevelopment ?? 45, 0, 100),
    seasonsTracked: dna.seasonsTracked ?? 1,
    history: dna.history ?? []
  });
};

export const getTacticalDNADeltas = (tactic: Tactic): Partial<Record<TeamDNAKey, number>> => ({
  pressingFeroce: Math.max(0, tactic.pressing - 62) * 0.16 + (tactic.transition === 'Riaggressione' ? 5 : 0) + (tactic.marking === 'Uomo' ? 2 : 0),
  possesso: (tactic.buildUp === 'Manovrata' ? 7 : 0) + Math.max(0, 62 - tactic.tempo) * 0.09 + (tactic.attackingFocus === 'Centro' ? 2 : 0),
  contropiedeVerticale: (tactic.transition === 'Contropiede' ? 7 : 0) + (tactic.buildUp === 'Lancio Lungo' ? 4 : 0) + Math.max(0, tactic.tempo - 62) * 0.09,
  difesaGranitica: (tactic.mentality === 'Difensiva' ? 5 : 0) + Math.max(0, 48 - tactic.defensiveLine) * 0.12 + (tactic.marking === 'Zona' ? 2 : 0),
  squadraCinica: (tactic.mentality !== 'Offensiva' ? 2 : 0) + (tactic.chanceCreation === 'Passaggi Filtranti' ? 2 : 0) + Math.max(0, 58 - tactic.riskLevel) * 0.08,
  calcioRomantico: (tactic.mentality === 'Offensiva' ? 5 : 0) + Math.max(0, tactic.riskLevel - 60) * 0.13 + (tactic.chanceCreation === 'Tagli Interni' ? 3 : 0)
});

export const evolveTeamDNAFromTactic = (dna: TeamDNAState, tactic: Tactic, players: Player[]): TeamDNAState => {
  const youngItalianStarters = tactic.starters
    .map(id => players.find(player => player.id === id))
    .filter(Boolean)
    .filter(player => player!.age <= 23 && player!.nationality === 'Italia').length;
  const youngStarters = tactic.starters
    .map(id => players.find(player => player.id === id))
    .filter(Boolean)
    .filter(player => player!.age <= 22).length;
  const deltas = {
    ...getTacticalDNADeltas(tactic),
    giovaniItaliani: youngItalianStarters * 1.8,
    vivaio: youngStarters * 1.4
  };
  const nextDNA = addScores(dna, deltas, 0.992);

  return {
    ...nextDNA,
    history: [`Tattica salvata: identita orientata verso ${TEAM_DNA_DEFINITIONS[nextDNA.active].name}.`, ...dna.history].slice(0, 20)
  };
};

const nationalityIsSouthAmerican = (nationality: string) => (
  ['Argentina', 'Brasile', 'Uruguay', 'Colombia', 'Ecuador', 'Paraguay', 'Cile', 'Peru', 'Venezuela'].some(country => nationality.includes(country))
);

const getPlayerDNAFitByKey = (player: Player, key: TeamDNAKey) => {
  const growth = Math.max(0, player.potential - player.overall);
  const p = player.personality;
  switch (key) {
    case 'pressingFeroce':
      return player.stamina * 0.28 + p.aggression * 0.24 + p.professionalism * 0.18 + (['CM', 'DM', 'LW', 'RW', 'ST', 'LB', 'RB'].includes(player.role) ? 18 : 8);
    case 'possesso':
      return p.composure * 0.28 + p.professionalism * 0.18 + (['CM', 'DM', 'AM', 'CB', 'GK'].includes(player.role) ? 26 : 12);
    case 'contropiedeVerticale':
      return player.stamina * 0.18 + p.composure * 0.18 + p.ambition * 0.16 + (['LW', 'RW', 'ST', 'AM'].includes(player.role) ? 30 : 10);
    case 'giovaniItaliani':
      return (player.nationality === 'Italia' ? 42 : 8) + (player.age <= 23 ? 28 : player.age <= 26 ? 12 : 0) + growth * 3;
    case 'sudamericaniTecnici':
      return (nationalityIsSouthAmerican(player.nationality) ? 44 : 8) + p.composure * 0.18 + p.ambition * 0.14 + (['AM', 'LW', 'RW', 'ST', 'CM'].includes(player.role) ? 20 : 8);
    case 'vivaio':
      return (player.age <= 21 ? 35 : player.age <= 24 ? 18 : 5) + p.loyalty * 0.18 + p.professionalism * 0.16 + growth * 3.2;
    case 'clubVenditore':
      return (player.age <= 24 ? 28 : 8) + growth * 4 + Math.max(0, 82 - player.overall) * 0.18 + p.ambition * 0.12;
    case 'galacticos':
      return Math.max(0, player.overall - 78) * 5 + p.ambition * 0.2 + p.ego * 0.18 + (player.value >= 45000000 ? 18 : 0);
    case 'difesaGranitica':
      return p.composure * 0.2 + p.professionalism * 0.18 + (['GK', 'CB', 'LB', 'RB', 'DM'].includes(player.role) ? 36 : 8);
    case 'squadraCinica':
      return p.composure * 0.26 + p.finalClutch * 0.22 + (['ST', 'AM', 'GK', 'CB'].includes(player.role) ? 22 : 10);
    case 'calcioRomantico':
      return p.ambition * 0.16 + p.composure * 0.17 + p.ego * 0.1 + (['AM', 'LW', 'RW', 'ST', 'CM'].includes(player.role) ? 28 : 8);
    default:
      return 50;
  }
};

export const getPlayerDNAFit = (player: Player, dna: TeamDNAState) => {
  const weighted = DNA_KEYS.reduce((sum, key) => {
    const weight = Math.max(0, dna.scores[key] ?? 0);
    return sum + getPlayerDNAFitByKey(player, key) * weight;
  }, 0);
  const totalWeight = DNA_KEYS.reduce((sum, key) => sum + Math.max(0, dna.scores[key] ?? 0), 0);
  return clamp(totalWeight ? weighted / totalWeight : getPlayerDNAFitByKey(player, dna.active), 0, 100);
};

export const getDNAMarketAdjustment = (player: Player, dna: TeamDNAState) => {
  const fit = getPlayerDNAFit(player, dna);
  const reputationPull = (dna.internationalReputation - 50) * 0.08 + (dna.marketAttraction - 50) * 0.07;
  const activeBoost = getPlayerDNAFitByKey(player, dna.active) >= 70 ? 4 : 0;
  const probabilityBonus = Math.round(clamp((fit - 56) * 0.32 + reputationPull + activeBoost, -12, 16));
  const costMultiplier = clamp(1 + Math.max(0, fit - 72) * 0.002 + (dna.active === 'galacticos' && player.overall >= 84 ? 0.08 : 0), 0.94, 1.14);
  const note = fit >= 72
    ? `${player.name} si incastra nel DNA ${TEAM_DNA_DEFINITIONS[dna.active].shortName}.`
    : fit <= 42
      ? `${player.name} non sembra pienamente coerente con il DNA ${TEAM_DNA_DEFINITIONS[dna.active].shortName}.`
      : `${player.name} ha compatibilita media col DNA attuale.`;
  return { fit: Math.round(fit), probabilityBonus, costMultiplier, note };
};

export const evolveTeamDNAFromTransfer = (
  dna: TeamDNAState,
  player: Player,
  type: 'buy' | 'sell',
  fee: number
): TeamDNAState => {
  const deltas: Partial<Record<TeamDNAKey, number>> = {};
  if (type === 'buy') {
    DNA_KEYS.forEach(key => {
      const fit = getPlayerDNAFitByKey(player, key);
      if (fit >= 70) deltas[key] = (deltas[key] ?? 0) + (fit - 64) * 0.08;
    });
    if (player.overall >= 84 || fee >= 50000000) deltas.galacticos = (deltas.galacticos ?? 0) + 6;
    if (player.age <= 23 && player.nationality === 'Italia') deltas.giovaniItaliani = (deltas.giovaniItaliani ?? 0) + 7;
    if (player.age <= 21) deltas.vivaio = (deltas.vivaio ?? 0) + 5;
    if (nationalityIsSouthAmerican(player.nationality)) deltas.sudamericaniTecnici = (deltas.sudamericaniTecnici ?? 0) + 7;
  } else {
    deltas.clubVenditore = (fee >= player.value * 0.95 ? 7 : 3);
    if (player.age <= 24 && player.potential > player.overall + 4) deltas.clubVenditore += 4;
  }

  const next = addScores(dna, deltas, 0.99);
  return {
    ...next,
    marketAttraction: clamp(next.marketAttraction + (type === 'buy' ? 1 : 0.4), 0, 100),
    internationalReputation: clamp(next.internationalReputation + (type === 'buy' && player.overall >= 84 ? 2 : 0), 0, 100),
    history: [`Mercato: ${type === 'buy' ? 'preso' : 'venduto'} ${player.name}, DNA ora ${TEAM_DNA_DEFINITIONS[next.active].shortName}.`, ...dna.history].slice(0, 20)
  };
};

export const getTacticalDNAAlignment = (dna: TeamDNAState, tactic: Tactic) => {
  const deltas = getTacticalDNADeltas(tactic);
  const activeDelta = deltas[dna.active] ?? 0;
  const secondaryDelta = dna.secondary.reduce((sum, key) => sum + (deltas[key] ?? 0), 0) / Math.max(1, dna.secondary.length);
  const contradiction =
    dna.active === 'pressingFeroce' && tactic.pressing < 48 ? 16 :
    dna.active === 'possesso' && tactic.buildUp === 'Lancio Lungo' ? 14 :
    dna.active === 'contropiedeVerticale' && tactic.tempo < 42 ? 12 :
    dna.active === 'difesaGranitica' && tactic.riskLevel > 74 ? 14 :
    dna.active === 'calcioRomantico' && tactic.mentality === 'Difensiva' ? 15 :
    0;
  return Math.round(clamp(48 + activeDelta * 5.6 + secondaryDelta * 2.4 - contradiction, 0, 100));
};

export const evaluateTeamDNAForMatch = (
  dna: TeamDNAState,
  tactic: Tactic,
  opponentRating: number
) => {
  const alignment = getTacticalDNAAlignment(dna, tactic);
  const identityStrength = dna.scores[dna.active] ?? 0;
  const reputationBonus = (dna.reputation - 50) * 0.025;
  const performanceSwing = clamp((alignment - 58) * 0.075 + reputationBonus, -4, 5);
  const predictable = identityStrength >= 72 && dna.reputation >= 65;
  const neutralizedRisk = predictable ? clamp((opponentRating - 72) * 0.06 + (100 - alignment) * 0.025, 0, 3.5) : 0;
  const notes = [
    alignment >= 72 ? `DNA ${TEAM_DNA_DEFINITIONS[dna.active].shortName} coerente con il piano partita.` : '',
    alignment <= 45 ? `Il piano va contro il DNA ${TEAM_DNA_DEFINITIONS[dna.active].shortName}: i tifosi e la squadra lo sentono.` : '',
    neutralizedRisk > 1.4 ? `${TEAM_DNA_DEFINITIONS[dna.active].neutralizedBy}: l'avversario prova a neutralizzare il tuo marchio.` : ''
  ].filter(Boolean);

  return {
    alignment,
    performanceSwing: Number(performanceSwing.toFixed(2)),
    tacticalDisorderSwing: Number(clamp((55 - alignment) * 0.035 + neutralizedRisk, 0, 5).toFixed(2)),
    fanMoodSwing: Math.round(clamp((alignment - 58) * 0.08, -4, 4)),
    notes
  };
};

export const evolveTeamDNAAfterMatch = (
  dna: TeamDNAState,
  context: MatchDNAContext
) => {
  const won = context.scoreUser > context.scoreOpponent;
  const cleanSheet = context.scoreOpponent === 0;
  const goals = context.scoreUser;
  const xG = context.stats.xGUser;
  const youngItalianPlayed = context.playedPlayers.filter(player => player.age <= 23 && player.nationality === 'Italia').length;
  const youngPlayed = context.playedPlayers.filter(player => player.age <= 22).length;
  const deltas: Partial<Record<TeamDNAKey, number>> = {
    ...getTacticalDNADeltas(context.tactic),
    possesso: (context.stats.possession >= 58 ? 3 : 0) + (context.stats.possession >= 63 ? 2 : 0),
    difesaGranitica: (cleanSheet ? 4 : 0) + (context.stats.xGOpponent <= 0.65 ? 3 : 0),
    squadraCinica: (won && xG > 0 && goals / xG >= 1.15 ? 4 : 0) + (won && Math.abs(context.scoreUser - context.scoreOpponent) <= 1 ? 2 : 0),
    calcioRomantico: (goals >= 3 ? 4 : 0) + (context.stats.shotsUser >= 14 ? 2 : 0),
    giovaniItaliani: youngItalianPlayed * 1.6,
    vivaio: youngPlayed * 1.3
  };
  const previousActive = dna.active;
  const next = addScores(dna, deltas, 0.995);
  const upsetBonus = won && context.opponentRating >= 84 ? 4 : won ? 1.4 : context.scoreUser < context.scoreOpponent ? -1.2 : 0.2;
  const alignment = getTacticalDNAAlignment(next, context.tactic);
  const fanSwing = (won ? 2 : context.scoreUser < context.scoreOpponent ? -2 : 0) + (alignment >= 70 ? 1 : alignment <= 42 ? -2 : 0);
  const historyLine = previousActive !== next.active
    ? `La squadra cambia pelle: da ${TEAM_DNA_DEFINITIONS[previousActive].shortName} a ${TEAM_DNA_DEFINITIONS[next.active].shortName}.`
    : `Gara contro ${context.opponent}: DNA ${TEAM_DNA_DEFINITIONS[next.active].shortName} rafforzato.`;

  const memory: ClubMemoryDraft | null = previousActive !== next.active || (next.scores[next.active] >= 78 && dna.scores[dna.active] < 78)
    ? {
        season: '2026/27',
        category: 'legacy',
        title: `DNA consolidato: ${TEAM_DNA_DEFINITIONS[next.active].name}`,
        description: `${next.clubName} sta diventando riconoscibile: ${TEAM_DNA_DEFINITIONS[next.active].description}`,
        importance: clamp(62 + next.scores[next.active] * 0.28, 68, 92),
        fanImpact: Math.max(1, fanSwing),
        dressingRoomImpact: 2,
        tags: ['dna', next.active]
      }
    : null;

  return {
    dna: {
      ...next,
      reputation: clamp(next.reputation + upsetBonus + (alignment >= 72 ? 0.6 : 0), 0, 100),
      internationalReputation: clamp(next.internationalReputation + (won && context.opponentRating >= 84 ? 2.5 : won ? 0.4 : 0), 0, 100),
      fanAlignment: clamp(next.fanAlignment + fanSwing, 0, 100),
      youthDevelopment: clamp(next.youthDevelopment + youngPlayed * 0.45 + youngItalianPlayed * 0.35, 0, 100),
      history: [historyLine, ...dna.history].slice(0, 20)
    },
    memory
  };
};

export const evolveTeamDNAEndOfSeason = (
  dna: TeamDNAState,
  context: SeasonDNAContext
) => {
  const standing = context.standings.find(team => team.name === dna.clubName);
  if (!standing) return { dna, memory: null as ClubMemoryDraft | null };

  const clubMeta = context.club as (ClubProfile & { expectedRank?: number; strength?: number }) | undefined;
  const expectedRank =
    clubMeta?.expectedRank ??
    (context.club?.objective.toLowerCase().includes('salvezza') ? 16 :
      context.club?.objective.toLowerCase().includes('scudetto') ? 2 :
        context.club?.objective.toLowerCase().includes('champions') ? 4 : 10);
  const overPerformance = expectedRank - standing.rank;
  const pointsPerGame = standing.played ? standing.points / standing.played : 0;
  const goalsPerGame = standing.played ? standing.goalsFor / standing.played : 0;
  const concededPerGame = standing.played ? standing.goalsAgainst / standing.played : 0;
  const youngCore = context.players.filter(player => player.age <= 23).length;
  const highValueStars = context.players.filter(player => player.overall >= 84).length;
  const deltas: Partial<Record<TeamDNAKey, number>> = {
    ...getTacticalDNADeltas(context.tactic),
    galacticos: (standing.rank <= 4 ? 5 : 0) + highValueStars * 1.2,
    squadraCinica: (standing.wins >= 20 ? 5 : 0) + (pointsPerGame >= 1.75 ? 4 : 0),
    difesaGranitica: concededPerGame <= 1 ? 7 : concededPerGame <= 1.25 ? 3 : 0,
    calcioRomantico: goalsPerGame >= 1.85 ? 7 : goalsPerGame >= 1.55 ? 3 : 0,
    vivaio: youngCore >= 8 ? 5 : youngCore >= 5 ? 2 : 0,
    giovaniItaliani: context.players.filter(player => player.age <= 23 && player.nationality === 'Italia').length * 0.8,
    clubVenditore: context.club && context.club.transferBudget < 35000000 && standing.rank <= 10 ? 4 : 0
  };

  if (overPerformance >= 8) {
    deltas.squadraCinica = (deltas.squadraCinica ?? 0) + 7;
    deltas.galacticos = (deltas.galacticos ?? 0) + 3;
  }
  if (standing.rank <= 2) deltas.galacticos = (deltas.galacticos ?? 0) + 8;

  const next = addScores(dna, deltas, 0.982);
  const jumpBonus =
    standing.rank <= 2 ? 9 :
    standing.rank <= 4 ? 6 :
    overPerformance >= 7 ? 5 :
    overPerformance >= 3 ? 2.5 :
    overPerformance <= -5 ? -4 :
    standing.rank >= 17 ? -5 :
    0.8;
  const newStatus =
    standing.rank <= 2 || next.reputation + jumpBonus >= 84 ? 'candidata allo scudetto' :
    standing.rank <= 4 || next.reputation + jumpBonus >= 76 ? 'club da Champions' :
    standing.rank <= 7 || next.reputation + jumpBonus >= 66 ? 'progetto europeo' :
    standing.rank <= 13 ? 'squadra di meta classifica' :
    'club in lotta salvezza';
  const statusJump = expectedRank >= 14 && standing.rank <= 7;
  const title = statusJump
    ? `Salto di status: ${context.club?.shortName ?? dna.clubName} ora guarda in alto`
    : `Fine stagione: ${TEAM_DNA_DEFINITIONS[next.active].shortName} diventa identita`;
  const description = statusJump
    ? `${dna.clubName} parteva con ambizioni basse e chiude ${standing.rank}a: il club non ragiona piu solo da salvezza, ma da ${newStatus}.`
    : `${dna.clubName} chiude ${standing.rank}a con ${standing.points} punti. Il DNA ora racconta una ${newStatus}.`;

  const updatedDNA: TeamDNAState = {
    ...next,
    seasonsTracked: dna.seasonsTracked + 1,
    reputation: clamp(next.reputation + jumpBonus, 0, 100),
    internationalReputation: clamp(next.internationalReputation + (standing.rank <= 4 ? 5 : standing.rank <= 7 ? 2 : overPerformance >= 6 ? 1.5 : 0), 0, 100),
    marketAttraction: clamp(next.marketAttraction + (standing.rank <= 4 ? 6 : standing.rank <= 7 ? 3 : overPerformance >= 5 ? 2 : standing.rank >= 17 ? -3 : 0.6), 0, 100),
    fanAlignment: clamp(next.fanAlignment + (overPerformance >= 5 ? 7 : standing.rank <= expectedRank ? 2 : -4), 0, 100),
    youthDevelopment: clamp(next.youthDevelopment + youngCore * 0.35, 0, 100),
    history: [
      `${getSeasonLabel(dna.seasonsTracked)}: ${description}`,
      ...dna.history
    ].slice(0, 20)
  };

  return {
    dna: updatedDNA,
    memory: {
      season: getSeasonLabel(dna.seasonsTracked),
      category: statusJump ? 'record' as const : 'legacy' as const,
      title,
      description,
      importance: clamp(64 + Math.abs(overPerformance) * 3 + (standing.rank <= 4 ? 10 : 0), 65, 96),
      fanImpact: statusJump ? 8 : overPerformance >= 3 ? 4 : standing.rank >= 17 ? -5 : 1,
      dressingRoomImpact: statusJump ? 5 : overPerformance >= 3 ? 2 : 0,
      tags: ['fine-stagione', 'dna', next.active]
    } satisfies ClubMemoryDraft
  };
};
