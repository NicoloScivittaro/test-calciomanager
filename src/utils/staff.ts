import { ClubHistoryState, ClubProfile, Player, StaffAdvice, StaffMember, Tactic, TeamDNAState } from '../types';

interface StaffAdviceContext {
  club: ClubProfile;
  players: Player[];
  tactic: Tactic | null;
  budget: number;
  history: ClubHistoryState;
  teamDNA: TeamDNAState;
  starters: string[];
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const hashRatio = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 37 + seed.charCodeAt(i)) % 1000003;
  }
  return hash / 1000003;
};

const seeded = (seed: string, label: string, min: number, max: number) => (
  Math.round(min + hashRatio(`${seed}-${label}`) * (max - min))
);

const STAFF_NAMES = [
  'Luca Marino',
  'Andrea Ferri',
  'Matteo Riva',
  'Davide Conti',
  'Simone Greco',
  'Paolo Serra',
  'Roberto Neri',
  'Alessio Costa',
  'Giorgio Mancini',
  'Fabio Leone',
  'Riccardo Sala',
  'Marco Vitale'
];

const staffName = (clubName: string, role: string, index: number) => (
  STAFF_NAMES[(index + Math.floor(hashRatio(`${clubName}-${role}`) * STAFF_NAMES.length)) % STAFF_NAMES.length]
);

export const buildClubStaff = (club: ClubProfile): StaffMember[] => {
  const seed = club.id;
  const roles: Array<Pick<StaffMember, 'role' | 'roleLabel' | 'philosophy'> & { base: number }> = [
    { role: 'assistant', roleLabel: 'Vice allenatore', philosophy: club.playStyle || 'equilibrio tattico', base: 66 },
    { role: 'sportingDirector', roleLabel: 'Direttore sportivo', philosophy: 'valore patrimoniale e opportunita', base: 64 },
    { role: 'fitnessCoach', roleLabel: 'Preparatore atletico', philosophy: 'carichi, recupero e prevenzione', base: 62 },
    { role: 'goalkeeperCoach', roleLabel: 'Allenatore portieri', philosophy: 'dettaglio tecnico e personalita', base: 60 },
    { role: 'scoutingChief', roleLabel: 'Responsabile scouting', philosophy: 'mercati sottovalutati e dati', base: 63 },
    { role: 'academyDirector', roleLabel: 'Responsabile vivaio', philosophy: club.academy || 'percorso giovani', base: 62 },
    { role: 'doctor', roleLabel: 'Medico', philosophy: 'rischio controllato e salute', base: 61 },
    { role: 'psychologist', roleLabel: 'Psicologo sportivo', philosophy: 'fiducia, pressione e gruppo', base: 60 },
    { role: 'teamManager', roleLabel: 'Team manager', philosophy: 'relazioni e ordine quotidiano', base: 59 },
    { role: 'president', roleLabel: 'Presidente', philosophy: club.boardPromise || 'sostenibilita del progetto', base: 65 }
  ];

  return roles.map((role, index) => {
    const roleSeed = `${seed}-${role.role}`;
    const pressurePenalty = role.role === 'president' ? Math.round(club.pressure * 0.08) : 0;
    return {
      id: `staff_${seed}_${role.role}`,
      name: staffName(club.name, role.role, index),
      role: role.role,
      roleLabel: role.roleLabel,
      philosophy: role.philosophy,
      competence: clamp(role.base + seeded(roleSeed, 'competence', -8, 15), 42, 92),
      loyalty: clamp(58 + seeded(roleSeed, 'loyalty', -12, 22), 35, 92),
      ambition: clamp(46 + seeded(roleSeed, 'ambition', -10, 28) + pressurePenalty, 30, 94),
      relationship: clamp(62 + seeded(roleSeed, 'relationship', -14, 18), 35, 92),
      reputation: clamp(role.base + seeded(roleSeed, 'reputation', -10, 14), 38, 90),
      playerManagement: clamp(56 + seeded(roleSeed, 'management', -10, 24), 35, 93),
      youthPreference: clamp(50 + seeded(roleSeed, 'youth', -14, 28) + (club.academy.toLowerCase().includes('forte') ? 8 : 0), 25, 94),
      veteranPreference: clamp(52 + seeded(roleSeed, 'veteran', -14, 24), 25, 90),
      candor: clamp(48 + seeded(roleSeed, 'candor', -10, 30), 30, 96)
    };
  });
};

const getStaff = (staff: StaffMember[], role: StaffMember['role']) => staff.find(member => member.role === role) ?? staff[0];

const roleFamily = (role: Player['role']) => {
  if (role === 'GK') return 'GK';
  if (role.match(/CB|LB|RB/)) return 'DF';
  if (role.match(/DM|CM|AM/)) return 'MF';
  return 'FW';
};

const makeAdvice = (
  staff: StaffMember,
  title: string,
  opinion: string,
  benefit: string,
  cost: string,
  urgency: number,
  tone: StaffAdvice['tone']
): StaffAdvice => ({
  id: `${staff.id}_${title.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}`,
  staffId: staff.id,
  staffName: staff.name,
  roleLabel: staff.roleLabel,
  title,
  opinion,
  benefit,
  cost,
  urgency: Math.round(clamp(urgency, 0, 100)),
  tone
});

export const getStaffAdvisories = (context: StaffAdviceContext): StaffAdvice[] => {
  const staff = buildClubStaff(context.club);
  const avgCondition = context.players.reduce((sum, player) => sum + player.condition, 0) / Math.max(1, context.players.length);
  const avgStamina = context.players.reduce((sum, player) => sum + player.stamina, 0) / Math.max(1, context.players.length);
  const avgMorale = context.players.reduce((sum, player) => sum + player.morale, 0) / Math.max(1, context.players.length);
  const tiredCore = context.players.filter(player => player.condition < 68 || player.stamina < 62).length;
  const expiringValue = context.players
    .filter(player => player.contractYears <= 1 && player.value >= 6000000)
    .sort((a, b) => b.value - a.value)[0];
  const blockedYoungster = context.players
    .filter(player => (
      player.age <= 22
      && player.potential - player.overall >= 6
      && !context.starters.includes(player.id)
    ))
    .sort((a, b) => (b.potential - b.overall) - (a.potential - a.overall))[0];
  const veteranMentor = context.players
    .filter(player => player.age >= 32 && player.personality.leadership >= 70 && player.personality.professionalism >= 68)
    .sort((a, b) => b.personality.leadership - a.personality.leadership)[0];
  const thinRole = ['GK', 'DF', 'MF', 'FW']
    .map(group => ({
      group,
      count: context.players.filter(player => roleFamily(player.role) === group).length
    }))
    .sort((a, b) => a.count - b.count)[0];
  const advice: StaffAdvice[] = [];
  const assistant = getStaff(staff, 'assistant');
  const director = getStaff(staff, 'sportingDirector');
  const fitness = getStaff(staff, 'fitnessCoach');
  const academy = getStaff(staff, 'academyDirector');
  const psychologist = getStaff(staff, 'psychologist');
  const scouting = getStaff(staff, 'scoutingChief');
  const president = getStaff(staff, 'president');

  if ((context.tactic?.pressing ?? 50) >= 72 && (avgCondition < 76 || tiredCore >= 5)) {
    advice.push(makeAdvice(
      assistant,
      'Il pressing sta consumando la rosa',
      `Con pressing ${context.tactic?.pressing} e ${tiredCore} giocatori affaticati, il vice teme un calo nel finale.`,
      'Abbassare il carico protegge lucidita e riduce rischio infortuni.',
      'Meno aggressivita puo togliere identita a una squadra costruita per mordere alta.',
      74 + tiredCore * 2,
      'warning'
    ));
  }

  if (expiringValue) {
    advice.push(makeAdvice(
      director,
      `Nodo contratto: ${expiringValue.name}`,
      `Il direttore sportivo segnala che ${expiringValue.name} ha valore ma contratto corto.`,
      'Rinnovare o vendere ora protegge il patrimonio del club.',
      'Una scelta fredda puo irritare tifosi o spogliatoio se il giocatore e centrale.',
      68 + expiringValue.overall * 0.18,
      'warning'
    ));
  } else if (context.budget < Math.max(2500000, context.club.transferBudget * 0.14)) {
    advice.push(makeAdvice(
      director,
      'Budget quasi chiuso',
      'Il direttore sportivo suggerisce una cessione sostenibile prima di forzare nuovi acquisti.',
      'Una vendita intelligente riapre il mercato e tranquillizza la proprieta.',
      'Se il sacrificio colpisce un simbolo, la curva non dimentichera facilmente.',
      72,
      'critical'
    ));
  }

  if (blockedYoungster) {
    advice.push(makeAdvice(
      academy,
      `${blockedYoungster.name} chiede una traiettoria`,
      `Il vivaio vede in ${blockedYoungster.name} un potenziale da +${blockedYoungster.potential - blockedYoungster.overall}, ma il campo non lo sta certificando.`,
      'Dargli minuti o un prestito mirato rafforza identita e crescita.',
      'Tenerlo bloccato puo trasformare un talento locale in rimpianto storico.',
      66 + (blockedYoungster.potential - blockedYoungster.overall) * 2,
      'warning'
    ));
  }

  if (avgStamina < 70 || avgCondition < 72) {
    advice.push(makeAdvice(
      fitness,
      'Recupero prima del prossimo strappo',
      `Preparatore e medico vedono condizione media ${Math.round(avgCondition)} e resistenza media ${Math.round(avgStamina)}.`,
      'Una settimana piu leggera migliora disponibilita e riduce emergenze.',
      'Potresti perdere brillantezza offensiva nel breve.',
      62 + Math.max(0, 72 - avgCondition),
      avgCondition < 66 ? 'critical' : 'warning'
    ));
  }

  if (avgMorale < 62 || context.history.dressingRoom < 58) {
    advice.push(makeAdvice(
      psychologist,
      'Il gruppo ha bisogno di chiarezza',
      `Lo psicologo legge morale media ${Math.round(avgMorale)} e spogliatoio ${context.history.dressingRoom}.`,
      'Un confronto interno puo ridurre tensione e proteggere i leader positivi.',
      'Promettere troppo senza minuti reali peggiora la fiducia.',
      70 + Math.max(0, 62 - avgMorale),
      'critical'
    ));
  }

  if (thinRole && thinRole.count <= 4) {
    advice.push(makeAdvice(
      scouting,
      `Copertura corta: ${thinRole.group}`,
      `Lo scouting vede solo ${thinRole.count} profili nel reparto ${thinRole.group}.`,
      'Un acquisto mirato evita emergenze tattiche e rotazioni forzate.',
      'Comprare nel reparto puo chiudere spazio a un giovane gia in rosa.',
      58 + (4 - thinRole.count) * 10,
      'neutral'
    ));
  }

  if (context.teamDNA.active === 'vivaio' && blockedYoungster) {
    advice.push(makeAdvice(
      president,
      'Il progetto giovani deve vedersi',
      'La presidenza apprezza il DNA vivaio, ma vuole che sia leggibile anche nelle scelte domenicali.',
      'Lanciare un giovane rafforza identita e reputazione del progetto.',
      'Nel breve puoi pagare qualcosa in esperienza e risultati.',
      64,
      'positive'
    ));
  } else if (veteranMentor) {
    advice.push(makeAdvice(
      psychologist,
      `Usa ${veteranMentor.name} come ponte`,
      `${veteranMentor.name} ha leadership e professionalita per trasformare un ruolo minore in guida del gruppo.`,
      'Dargli responsabilita aiuta giovani e panchina ad accettare le gerarchie.',
      'Se lo esponi troppo in campo, il declino fisico puo diventare evidente.',
      52,
      'positive'
    ));
  }

  if (advice.length === 0) {
    advice.push(makeAdvice(
      assistant,
      'Staff allineato',
      'Nessun reparto segnala una crisi immediata: il club puo lavorare sulla prossima scelta identitaria.',
      'Stabilita e chiarezza aiutano a costruire fiducia.',
      'L assenza di urgenze non deve diventare immobilismo.',
      38,
      'neutral'
    ));
  }

  return advice.sort((a, b) => b.urgency - a.urgency).slice(0, 5);
};
