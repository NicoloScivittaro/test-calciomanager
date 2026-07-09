import { ClubHistoryState, Player, PlayerProjectRole, PlayerProjectRoleKey, PlayerSeasonStat } from '../types';

interface PlayerProjectRoleContext {
  starters?: string[];
  bench?: string[];
  seasonStats?: PlayerSeasonStat[];
  clubHistory?: ClubHistoryState;
  round?: number;
}

interface RoleCandidate {
  key: PlayerProjectRoleKey;
  label: string;
  score: number;
  summary: string;
  expectation: string;
  growthModifier: number;
  dressingRoomWeight: number;
  fanWeight: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const clampPercent = (value: number) => Math.round(clamp(value, 0, 100));

const getPromiseState = (player: Player, history?: ClubHistoryState) => {
  const promises = history?.promises.filter(promise => promise.playerName === player.name) ?? [];
  return {
    active: promises.find(promise => promise.status === 'attiva'),
    broken: promises.find(promise => promise.status === 'tradita'),
    kept: promises.find(promise => promise.status === 'mantenuta')
  };
};

const getStatsForPlayer = (player: Player, seasonStats?: PlayerSeasonStat[]) => (
  seasonStats?.find(row => row.playerId === player.id || row.playerName === player.name)
);

const buildReasons = (
  player: Player,
  stats: PlayerSeasonStat | undefined,
  context: PlayerProjectRoleContext,
  trust: number,
  tension: number
) => {
  const reasons: string[] = [];
  const played = stats?.appearances ?? player.careerMemory.appearances ?? 0;
  const contributions = (stats?.goals ?? 0) + (stats?.assists ?? 0);
  const isStarter = Boolean(context.starters?.includes(player.id));
  const isBench = Boolean(context.bench?.includes(player.id));

  if (isStarter) reasons.push('oggi e dentro l undici titolare');
  else if (isBench) reasons.push('parte stabilmente dalle rotazioni');
  else reasons.push('non ha un posto chiaro nella lista partita');

  if (played > 0) reasons.push(`${played} presenze registrate nella stagione/carriera`);
  if (contributions > 0) reasons.push(`${contributions} contributi diretti tra gol e assist`);
  if (player.contractYears <= 1) reasons.push('contratto vicino alla scadenza');
  if (player.age <= 21) reasons.push('eta da sviluppo e protezione');
  if (player.age >= 33) reasons.push('eta da gestione del declino fisico');
  if (player.personality.leadership >= 76) reasons.push('leadership alta nello spogliatoio');
  if (player.personality.clubLove >= 74) reasons.push('forte legame con il club');
  if (player.relationships.coach < 48) reasons.push('rapporto con il mister fragile');
  if (player.relationships.fans >= 78) reasons.push('rapporto forte con i tifosi');
  if (player.careerMemory.benchComplaints >= 2) reasons.push('ha gia accumulato malumore da panchina');
  if (trust >= 72) reasons.push('si sente parte del progetto');
  if (tension >= 70) reasons.push('la sua situazione puo diventare un caso');
  if (player.playingTimePromise?.status === 'completed') reasons.push('ha raggiunto il minutaggio promesso dal mister');
  if (player.playingTimePromise?.status === 'broken') reasons.push('la promessa di minutaggio non e stata rispettata');
  if (player.playingTimePromise?.status === 'at_risk') reasons.push('rischia di non raggiungere il minutaggio promesso');

  return reasons.slice(0, 6);
};

export const getPlayerProjectRole = (
  player: Player,
  context: PlayerProjectRoleContext = {}
): PlayerProjectRole => {
  const stats = getStatsForPlayer(player, context.seasonStats);
  const promise = getPromiseState(player, context.clubHistory);
  const appearances = stats?.appearances ?? player.careerMemory.appearances ?? 0;
  const contributions = (stats?.goals ?? 0) + (stats?.assists ?? 0);
  const round = Math.max(1, context.round ?? Math.max(appearances, 1));
  const minutesShare = clamp(appearances / Math.max(1, round), 0, 1);
  const isStarter = Boolean(context.starters?.includes(player.id));
  const isBench = Boolean(context.bench?.includes(player.id));
  const reputation = clamp(player.overall * 0.55 + player.potential * 0.2 + player.morale * 0.14 + player.careerMemory.legendScore * 0.22, 0, 100);
  const ambitionPressure = clamp(player.personality.ambition * 0.34 + player.personality.ego * 0.28 + player.personality.bigClubDesire * 0.2, 0, 100);
  const acceptance = clamp(player.personality.benchTolerance * 0.34 + player.personality.loyalty * 0.22 + player.personality.clubLove * 0.18 + player.relationships.coach * 0.16 + player.personality.professionalism * 0.1, 0, 100);
  const promisedImportance = promise.active
    ? promise.active.promise.toLowerCase().includes('titolare') || promise.active.promise.toLowerCase().includes('stella') ? 18 :
      promise.active.promise.toLowerCase().includes('giovane') || promise.active.promise.toLowerCase().includes('progetto') ? 12 :
      promise.active.promise.toLowerCase().includes('rotazione') ? 8 : 6
    : 0;
  const ptPromise = player.playingTimePromise;
  const ptPromiseCompleted = ptPromise?.status === 'completed';
  const ptPromiseBroken = ptPromise?.status === 'broken';
  const ptPromiseAtRisk = ptPromise?.status === 'at_risk';
  const isAmbitiousOrEgo = player.personality.ambition >= 70 || player.personality.ego >= 70;

  const trust = clampPercent(
    34
    + minutesShare * 24
    + (isStarter ? 12 : isBench ? 5 : -7)
    + (player.relationships.coach - 50) * 0.28
    + (player.morale - 50) * 0.2
    + (promise.kept ? 12 : 0)
    - (promise.broken ? 22 : 0)
    - (player.status === 'Cedibile' ? 18 : 0)
    + (ptPromiseCompleted ? 10 : 0)
    - (ptPromiseAtRisk ? 6 : 0)
    - (ptPromiseBroken ? 16 : 0)
  );
  const expectedMinutes = clamp((player.overall - 72) * 4.2 + ambitionPressure * 0.42 + promisedImportance - acceptance * 0.22, 0, 100);
  const actualRole = clamp(minutesShare * 70 + (isStarter ? 25 : isBench ? 12 : 0), 0, 100);
  const tension = clampPercent(
    Math.max(0, expectedMinutes - actualRole)
    + Math.max(0, 55 - player.morale) * 0.45
    + Math.max(0, 50 - player.relationships.coach) * 0.38
    + player.careerMemory.benchComplaints * 8
    + (promise.broken ? 28 : 0)
    + (player.status === 'Cedibile' ? 18 : 0)
    - (player.personality.professionalism >= 78 ? 5 : 0)
    + (ptPromiseBroken ? 22 : 0)
    + (ptPromiseAtRisk ? 10 : 0)
    - (ptPromiseCompleted ? 6 : 0)
  );

  const candidates: RoleCandidate[] = [
    {
      key: 'brokenPromise',
      label: 'Promessa non mantenuta',
      score: (promise.broken ? 80 : 0) + (promise.active && tension >= 62 ? 28 : 0) + tension * 0.45,
      summary: `${player.name} sente che il patto con il club non e allineato al campo.`,
      expectation: 'Servono minuti, un chiarimento o una scelta di mercato.',
      growthModifier: -0.12,
      dressingRoomWeight: -4,
      fanWeight: -1
    },
    {
      key: 'surplus',
      label: 'Esubero',
      score: (player.status === 'Cedibile' ? 55 : 0) + (!isStarter && !isBench ? 28 : 0) + Math.max(0, 50 - trust) + Math.max(0, player.age - 29) * 1.5,
      summary: `${player.name} percepisce di essere fuori dal nucleo tecnico.`,
      expectation: 'Puo restare ai margini, ma in emergenza puo ancora riconquistare spazio.',
      growthModifier: -0.18,
      dressingRoomWeight: -3,
      fanWeight: -1
    },
    {
      key: 'untouchableStar',
      label: 'Stella intoccabile',
      score: reputation + (isStarter ? 18 : -12) + minutesShare * 12 + contributions * 2 + Math.max(0, player.overall - 84) * 5,
      summary: `${player.name} si sente al centro del progetto tecnico e mediatico.`,
      expectation: 'Si aspetta titolarita, protezione pubblica e ambizione alta.',
      growthModifier: 0.04,
      dressingRoomWeight: 4,
      fanWeight: 5
    },
    {
      key: 'fanSymbol',
      label: 'Giocatore simbolo della tifoseria',
      score: player.relationships.fans * 0.65 + player.careerMemory.legendScore * 0.7 + player.personality.clubLove * 0.36 + (contributions > 0 ? 8 : 0),
      summary: `${player.name} non e solo un valore tecnico: ha peso emotivo sulla piazza.`,
      expectation: 'Cederlo o metterlo ai margini avrebbe un costo narrativo e ambientale.',
      growthModifier: 0.03,
      dressingRoomWeight: 3,
      fanWeight: 7
    },
    {
      key: 'futureCaptain',
      label: 'Futuro capitano',
      score: player.personality.leadership * 0.58 + player.personality.professionalism * 0.28 + player.relationships.teammates * 0.26 + (player.age <= 26 ? 14 : 0) + trust * 0.18,
      summary: `${player.name} sta costruendo autorevolezza per guidare il gruppo.`,
      expectation: 'Va responsabilizzato senza bruciarlo.',
      growthModifier: 0.08,
      dressingRoomWeight: 5,
      fanWeight: 3
    },
    {
      key: 'protectedYoungster',
      label: 'Giovane da proteggere',
      score: (player.age <= 21 ? 65 : player.age <= 23 ? 40 : 0) + Math.max(0, player.potential - player.overall) * 4 + trust * 0.26 - tension * 0.25,
      summary: `${player.name} ha bisogno di fiducia, minuti scelti bene e una traiettoria credibile.`,
      expectation: 'Cresce meglio con ingressi coerenti, non con esposizione casuale.',
      growthModifier: trust >= 64 ? 0.22 : 0.08,
      dressingRoomWeight: 1,
      fanWeight: 2
    },
    {
      key: 'decliningVeteran',
      label: 'Veterano in declino',
      score: (player.age >= 33 ? 54 : 0) + player.personality.leadership * 0.28 + player.personality.professionalism * 0.24 - minutesShare * 8 - Math.max(0, 62 - player.condition) * 0.5,
      summary: `${player.name} puo perdere centralita in campo ma diventare una chioccia importante.`,
      expectation: 'Serve ridisegnare il patto: meno minuti, piu guida.',
      growthModifier: -0.08,
      dressingRoomWeight: 4,
      fanWeight: player.relationships.fans >= 70 ? 3 : 1
    },
    {
      key: 'contestedStarter',
      label: 'Titolare in discussione',
      score: (isStarter ? 45 : 12) + Math.max(0, player.overall - 77) * 3 + Math.max(0, 60 - player.form * 8) + tension * 0.3,
      summary: `${player.name} ha status da titolare, ma rendimento o fiducia non sono stabili.`,
      expectation: 'Le prossime scelte possono consolidarlo o aprire un caso.',
      growthModifier: -0.02,
      dressingRoomWeight: 1,
      fanWeight: 1
    },
    {
      key: 'silentLeader',
      label: 'Leader silenzioso',
      score: player.personality.professionalism * 0.42 + player.personality.leadership * 0.38 + player.relationships.teammates * 0.24 + acceptance * 0.18 - player.personality.ego * 0.16,
      summary: `${player.name} tiene insieme il gruppo anche senza pretendere la scena.`,
      expectation: 'Puo accettare rotazioni se sente rispetto e chiarezza.',
      growthModifier: 0.02,
      dressingRoomWeight: 5,
      fanWeight: 2
    },
    {
      key: 'twelfthMan',
      label: 'Dodicesimo uomo',
      score: (isBench ? 44 : 8) + acceptance * 0.42 + player.form * 3 + trust * 0.2 - tension * 0.25,
      summary: `${player.name} vive le rotazioni come parte del progetto, non come una bocciatura.`,
      expectation: 'Va coinvolto con continuita per mantenere energia e disponibilita.',
      growthModifier: 0.05,
      dressingRoomWeight: 2,
      fanWeight: 1
    },
    {
      key: 'frustratedTalent',
      label: 'Talento frustrato',
      score: (ptPromiseBroken ? 58 : 0) + (ptPromiseBroken && isAmbitiousOrEgo ? 26 : 0) + tension * 0.32 + Math.max(0, player.potential - player.overall) * 1.4,
      summary: `${player.name} sente che la promessa di minutaggio ricevuta non e stata rispettata.`,
      expectation: 'Serve un chiarimento concreto sul suo spazio, o il rapporto rischia di logorarsi.',
      growthModifier: -0.14,
      dressingRoomWeight: -3,
      fanWeight: -1
    },
    {
      key: 'steadyStarter',
      label: 'Titolare',
      score: (isStarter ? 46 : 0) + trust * 0.34 - Math.max(0, tension - 45) * 0.5 + minutesShare * 14,
      summary: `${player.name} e un punto fermo dell'undici titolare, senza tensioni aperte.`,
      expectation: 'Continuita e prestazioni solide mantengono il suo status.',
      growthModifier: 0.03,
      dressingRoomWeight: 2,
      fanWeight: 2
    },
    {
      key: 'keyRotation',
      label: 'Rotazione importante',
      score: (isBench ? 30 : 12) + minutesShare * 46 + (ptPromise?.status === 'active' ? 3 : 0) + acceptance * 0.15,
      summary: `${player.name} non parte sempre titolare ma incide con continuita nelle rotazioni.`,
      expectation: 'Il minutaggio va gestito con equilibrio per non perderlo.',
      growthModifier: 0.04,
      dressingRoomWeight: 2,
      fanWeight: 1
    },
    {
      key: 'benchPlayer',
      label: 'Riserva',
      score: (isBench ? 26 : 0) + Math.max(0, 40 - minutesShare * 60) + acceptance * 0.1,
      summary: `${player.name} resta un'alternativa dalla panchina, senza grandi tensioni aperte.`,
      expectation: 'Serve continuare a lavorare per guadagnarsi piu spazio.',
      growthModifier: 0,
      dressingRoomWeight: 1,
      fanWeight: 0
    }
  ];

  const selected = candidates.sort((a, b) => b.score - a.score)[0];
  const reasons = buildReasons(player, stats, context, trust, tension);

  return {
    key: selected.key,
    label: selected.label,
    summary: selected.summary,
    expectation: selected.expectation,
    trust,
    tension,
    growthModifier: selected.growthModifier,
    dressingRoomWeight: selected.dressingRoomWeight,
    fanWeight: selected.fanWeight,
    reasons
  };
};

export const getProjectRoleColor = (role: PlayerProjectRole) => {
  if (role.tension >= 72 || role.key === 'brokenPromise' || role.key === 'surplus' || role.key === 'frustratedTalent') return 'var(--color-danger)';
  if (role.key === 'untouchableStar' || role.key === 'fanSymbol' || role.key === 'futureCaptain') return 'var(--color-gold)';
  if (role.trust >= 66) return 'var(--color-pitch)';
  return 'var(--text-secondary)';
};
