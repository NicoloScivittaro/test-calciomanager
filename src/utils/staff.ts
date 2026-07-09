import {
  ClubHistoryState,
  ClubProfile,
  ClubStaffMember,
  ClubStaffReport,
  ClubStaffRole,
  ClubStaffState,
  ClubStaffWorkStyle,
  Negotiation,
  Player,
  StaffAdvice,
  StaffMember,
  Tactic,
  TeamDNAState
} from '../types';

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

// ─── Staff tecnico/atletico/medico/scouting persistente (Fase 8A) ───
// Sistema separato dal consiglio "da presidenza" sopra: membri assumibili, persistenti,
// che alimentano solo piccoli modificatori dei cicli gia' esistenti (fitness, sviluppo,
// scouting). Nessun bonus immediato, nessuna modifica diretta di overall/potenziale/risultati.

type ClubStaffSpecField =
  | 'tacticalAnalysis'
  | 'workloadManagement'
  | 'injuryPrevention'
  | 'rehabilitation'
  | 'youthDevelopment'
  | 'roleCoaching'
  | 'scoutingAccuracy'
  | 'marketKnowledge';

const CLUB_STAFF_ROLES: ClubStaffRole[] = ['assistant_manager', 'fitness_coach', 'head_physio', 'development_coach', 'chief_scout'];

export const CLUB_STAFF_ROLE_LABELS: Record<ClubStaffRole, string> = {
  assistant_manager: 'Vice allenatore',
  fitness_coach: 'Preparatore atletico',
  head_physio: 'Capo staff medico',
  development_coach: 'Allenatore dello sviluppo',
  chief_scout: 'Capo scout'
};

const CLUB_STAFF_SPECS: Record<ClubStaffRole, ClubStaffSpecField[]> = {
  assistant_manager: ['tacticalAnalysis'],
  fitness_coach: ['workloadManagement', 'injuryPrevention'],
  head_physio: ['rehabilitation', 'injuryPrevention'],
  development_coach: ['youthDevelopment', 'roleCoaching'],
  chief_scout: ['scoutingAccuracy', 'marketKnowledge']
};

const CLUB_STAFF_TRAIT_LABELS: Record<ClubStaffSpecField, string> = {
  tacticalAnalysis: 'Analisi tattica',
  workloadManagement: 'Gestione dei carichi',
  injuryPrevention: 'Prevenzione infortuni',
  rehabilitation: 'Riabilitazione',
  youthDevelopment: 'Sviluppo giovani',
  roleCoaching: 'Apprendimento ruoli',
  scoutingAccuracy: 'Precisione scouting',
  marketKnowledge: 'Conoscenza del mercato'
};

const CLUB_STAFF_WORK_STYLES: ClubStaffWorkStyle[] = ['balanced', 'demanding', 'protective', 'developmental'];

const CLUB_STAFF_NAMES = [
  'Enrico Bassi', 'Michele Farina', 'Cristian Loi', 'Nicola Bruno', 'Tommaso Rinaldi',
  'Gabriele Testa', 'Lorenzo Sartori', 'Emanuele Colombo', 'Federico Gatti', 'Samuele Orlando',
  'Vittorio Amato', 'Leonardo Fabbri', 'Stefano Villa', 'Claudio Moretti', 'Massimo Barbieri'
];

const clubStaffName = (club: ClubProfile, role: ClubStaffRole, index: number) => (
  CLUB_STAFF_NAMES[Math.floor(hashRatio(`${club.id}-clubstaff-name-${role}-${index}`) * CLUB_STAFF_NAMES.length) % CLUB_STAFF_NAMES.length]
);

const pickWorkStyle = (seed: string): ClubStaffWorkStyle => (
  CLUB_STAFF_WORK_STYLES[Math.floor(hashRatio(`${seed}-style`) * CLUB_STAFF_WORK_STYLES.length) % CLUB_STAFF_WORK_STYLES.length]
);

const seasonalCostForRole = (club: ClubProfile, overall: number): number => {
  // Costo una tantum di ingaggio, scalato dal budget trasferimenti reale del club: nessuna
  // economia parallela, e' la stessa cifra che gia' assorbe le operazioni di mercato.
  const scaled = Math.max(club.transferBudget, 1000000) * 0.005 * (overall / 65);
  return Math.round(clamp(scaled, 120000, 3500000) / 10000) * 10000;
};

export const buildClubStaffMember = (
  club: ClubProfile,
  role: ClubStaffRole,
  season: string,
  index: number
): ClubStaffMember => {
  const seed = `${club.id}-clubstaff-${role}-${index}`;
  const overall = clamp(58 + seeded(seed, 'overall', -14, 24), 40, 92);
  const specs: Partial<Record<ClubStaffSpecField, number>> = {};
  CLUB_STAFF_SPECS[role].forEach((field, i) => {
    specs[field] = clamp(overall + seeded(seed, `spec_${i}`, -10, 16), 35, 96);
  });

  return {
    id: `cstaff_${club.id}_${role}_${index}`,
    name: clubStaffName(club, role, index),
    role,
    overall,
    workStyle: pickWorkStyle(seed),
    reputation: clamp(overall + seeded(seed, 'reputation', -10, 10), 35, 95),
    joinedSeason: season,
    seasonalCost: seasonalCostForRole(club, overall),
    ...specs
  };
};

export const createInitialClubStaffState = (club: ClubProfile, season: string): ClubStaffState => ({
  members: CLUB_STAFF_ROLES.map(role => buildClubStaffMember(club, role, season, 0)),
  candidatePool: CLUB_STAFF_ROLES.flatMap(role => [0, 1].map(i => buildClubStaffMember(club, role, season, 100 + i))),
  candidateGeneration: 0,
  lastReviewRound: null,
  lastHireRound: null,
  lastReportRound: null,
  recentReports: []
});

const VALID_CLUB_STAFF_ROLES = new Set<string>(CLUB_STAFF_ROLES);
const VALID_WORK_STYLES = new Set<string>(CLUB_STAFF_WORK_STYLES);

const normalizeClubStaffMember = (
  raw: unknown,
  club: ClubProfile,
  season: string,
  fallbackRole: ClubStaffRole,
  fallbackIndex: number
): ClubStaffMember => {
  if (!raw || typeof raw !== 'object') return buildClubStaffMember(club, fallbackRole, season, fallbackIndex);
  const item = raw as Record<string, unknown>;
  const role = VALID_CLUB_STAFF_ROLES.has(item.role as string) ? item.role as ClubStaffRole : fallbackRole;
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.overall !== 'number') {
    return buildClubStaffMember(club, role, season, fallbackIndex);
  }
  const overall = Math.round(clamp(item.overall, 30, 99));
  const specs: Partial<Record<ClubStaffSpecField, number>> = {};
  CLUB_STAFF_SPECS[role].forEach(field => {
    const value = item[field];
    specs[field] = typeof value === 'number' ? Math.round(clamp(value, 20, 99)) : overall;
  });

  return {
    id: item.id,
    name: item.name,
    role,
    overall,
    workStyle: VALID_WORK_STYLES.has(item.workStyle as string) ? item.workStyle as ClubStaffWorkStyle : pickWorkStyle(item.id),
    reputation: typeof item.reputation === 'number' ? Math.round(clamp(item.reputation, 0, 100)) : 60,
    joinedSeason: typeof item.joinedSeason === 'string' ? item.joinedSeason : season,
    seasonalCost: typeof item.seasonalCost === 'number' ? Math.max(0, Math.round(item.seasonalCost)) : seasonalCostForRole(club, overall),
    ...specs
  };
};

const normalizeClubStaffReport = (raw: unknown): ClubStaffReport | null => {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.detail !== 'string') return null;
  if (!VALID_CLUB_STAFF_ROLES.has(item.role as string)) return null;
  return {
    id: item.id,
    round: typeof item.round === 'number' ? item.round : 0,
    season: typeof item.season === 'string' ? item.season : '',
    role: item.role as ClubStaffRole,
    staffName: typeof item.staffName === 'string' ? item.staffName : '',
    playerId: typeof item.playerId === 'string' ? item.playerId : undefined,
    playerName: typeof item.playerName === 'string' ? item.playerName : undefined,
    title: item.title,
    detail: item.detail,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString()
  };
};

// Normalizzatore migration-safe: vecchi salvataggi senza staff operativo ricevono uno staff
// base valido; salvataggi gia' aggiornati mantengono membri, candidati e report esistenti.
export const normalizeClubStaffState = (value: unknown, club: ClubProfile, season: string): ClubStaffState => {
  if (!value || typeof value !== 'object') return createInitialClubStaffState(club, season);
  const raw = value as Record<string, unknown>;

  const rawMembers = Array.isArray(raw.members) ? raw.members : [];
  const memberByRole = new Map<ClubStaffRole, unknown>();
  rawMembers.forEach(entry => {
    if (entry && typeof entry === 'object' && VALID_CLUB_STAFF_ROLES.has((entry as Record<string, unknown>).role as string)) {
      memberByRole.set((entry as Record<string, unknown>).role as ClubStaffRole, entry);
    }
  });
  const members = CLUB_STAFF_ROLES.map(role => normalizeClubStaffMember(memberByRole.get(role), club, season, role, 0));

  const generation = typeof raw.candidateGeneration === 'number' ? Math.max(0, Math.round(raw.candidateGeneration)) : 0;
  const rawCandidates = Array.isArray(raw.candidatePool) ? raw.candidatePool : [];
  const candidatesByRole = new Map<ClubStaffRole, unknown[]>();
  rawCandidates.forEach(entry => {
    if (entry && typeof entry === 'object' && VALID_CLUB_STAFF_ROLES.has((entry as Record<string, unknown>).role as string)) {
      const role = (entry as Record<string, unknown>).role as ClubStaffRole;
      const list = candidatesByRole.get(role) ?? [];
      list.push(entry);
      candidatesByRole.set(role, list);
    }
  });
  const candidatePool = CLUB_STAFF_ROLES.flatMap(role => {
    const existing = (candidatesByRole.get(role) ?? []).slice(0, 2)
      .map((entry, i) => normalizeClubStaffMember(entry, club, season, role, 100 + generation * 10 + i));
    while (existing.length < 2) {
      existing.push(buildClubStaffMember(club, role, season, 100 + generation * 10 + existing.length));
    }
    return existing;
  });

  const recentReports = Array.isArray(raw.recentReports)
    ? raw.recentReports.map(normalizeClubStaffReport).filter((r): r is ClubStaffReport => r !== null).slice(0, 12)
    : [];

  return {
    members,
    candidatePool,
    candidateGeneration: generation,
    lastReviewRound: typeof raw.lastReviewRound === 'number' ? raw.lastReviewRound : null,
    lastHireRound: typeof raw.lastHireRound === 'number' ? raw.lastHireRound : null,
    lastReportRound: typeof raw.lastReportRound === 'number' ? raw.lastReportRound : null,
    recentReports
  };
};

export const getClubStaffMember = (state: ClubStaffState, role: ClubStaffRole): ClubStaffMember | undefined => (
  state.members.find(member => member.role === role)
);

// Massimo una sostituzione staff ogni 4 giornate.
export const canHireClubStaff = (state: ClubStaffState, round: number): boolean => (
  state.lastHireRound === null || round - state.lastHireRound >= 4
);

export const hireClubStaffMember = (
  state: ClubStaffState,
  club: ClubProfile,
  role: ClubStaffRole,
  candidateId: string,
  round: number,
  season: string
): ClubStaffState => {
  if (!canHireClubStaff(state, round)) return state;
  const candidate = state.candidatePool.find(item => item.id === candidateId && item.role === role);
  if (!candidate) return state;

  const members = state.members.map(member => (member.role === role ? candidate : member));
  const candidateGeneration = state.candidateGeneration + 1;
  // Candidati rigenerati solo per il ruolo appena sostituito, con seed deterministico legato alla nuova generazione.
  const refreshedForRole = [0, 1].map(i => buildClubStaffMember(club, role, season, 100 + candidateGeneration * 10 + i));
  const candidatePool = state.candidatePool.filter(item => item.role !== role).concat(refreshedForRole);

  return {
    ...state,
    members,
    candidatePool,
    candidateGeneration,
    lastHireRound: round
  };
};

export const describeStaffCandidateComparison = (current: ClubStaffMember | undefined, candidate: ClubStaffMember): string => {
  if (!current) return `${candidate.name} entrerebbe come primo titolare del ruolo (qualita ${candidate.overall}).`;
  const delta = candidate.overall - current.overall;
  if (delta >= 4) return `${candidate.name} e valutato meglio di ${current.name} (${candidate.overall} contro ${current.overall}).`;
  if (delta <= -4) return `${candidate.name} ha una valutazione piu bassa di ${current.name} (${candidate.overall} contro ${current.overall}), ma porta uno stile diverso (${candidate.workStyle}).`;
  return `${candidate.name} e sostanzialmente equivalente a ${current.name} (${candidate.overall} contro ${current.overall}), con uno stile di lavoro ${candidate.workStyle}.`;
};

export interface ClubStaffSummary {
  averageQuality: number;
  strengths: string[]; // max 2
  weaknesses: string[]; // max 2
}

export const getClubStaffSummary = (state: ClubStaffState): ClubStaffSummary => {
  const averageQuality = state.members.length
    ? Math.round(state.members.reduce((sum, member) => sum + member.overall, 0) / state.members.length)
    : 60;

  const traits: { label: string; value: number }[] = [];
  state.members.forEach(member => {
    CLUB_STAFF_SPECS[member.role].forEach(field => {
      const value = member[field];
      if (typeof value === 'number') traits.push({ label: `${CLUB_STAFF_TRAIT_LABELS[field]} (${member.name})`, value });
    });
  });

  const strengths = [...traits].sort((a, b) => b.value - a.value).filter(t => t.value >= 72).slice(0, 2).map(t => t.label);
  const weaknesses = [...traits].sort((a, b) => a.value - b.value).filter(t => t.value <= 48).slice(0, 2).map(t => t.label);

  return { averageQuality, strengths, weaknesses };
};

export interface ClubStaffModifiers {
  fitnessQuality: number; // gestione carichi + prevenzione infortuni
  physioQuality: number; // riabilitazione + prevenzione infortuni
  developmentQuality: number; // sviluppo giovani + apprendimento ruoli
  scoutingQuality: number; // precisione scouting + conoscenza mercato
  tacticalQuality: number; // analisi tattica del vice
}

const blendSpecs = (...values: (number | undefined)[]): number => {
  const known = values.filter((v): v is number => typeof v === 'number');
  if (!known.length) return 60;
  return Math.round(known.reduce((sum, v) => sum + v, 0) / known.length);
};

// Espone modificatori piccoli e spiegabili da iniettare nei sistemi gia' esistenti
// (fitness, sviluppo, scouting): non creano mai un effetto immediato, solo un input
// aggiuntivo che i cicli esistenti applicano gradualmente.
export const getClubStaffModifiers = (state: ClubStaffState): ClubStaffModifiers => {
  const assistant = getClubStaffMember(state, 'assistant_manager');
  const fitness = getClubStaffMember(state, 'fitness_coach');
  const physio = getClubStaffMember(state, 'head_physio');
  const development = getClubStaffMember(state, 'development_coach');
  const scout = getClubStaffMember(state, 'chief_scout');

  return {
    fitnessQuality: blendSpecs(fitness?.workloadManagement, fitness?.injuryPrevention, fitness?.overall),
    physioQuality: blendSpecs(physio?.rehabilitation, physio?.injuryPrevention, physio?.overall),
    developmentQuality: blendSpecs(development?.youthDevelopment, development?.roleCoaching, development?.overall),
    scoutingQuality: blendSpecs(scout?.scoutingAccuracy, scout?.marketKnowledge, scout?.overall),
    tacticalQuality: blendSpecs(assistant?.tacticalAnalysis, assistant?.overall)
  };
};

// ─── Report staff: solo da segnali reali gia' calcolati altrove, mai testo generico ───

export interface ClubStaffReportContext {
  round: number;
  season: string;
  players: Player[];
  starters: string[];
  tactic: Tactic | null;
  scoutedTargets: Negotiation[];
}

const makeClubStaffReport = (
  context: ClubStaffReportContext,
  member: ClubStaffMember | undefined,
  title: string,
  detail: string,
  playerId?: string,
  playerName?: string
): ClubStaffReport | null => {
  if (!member) return null;
  return {
    id: `cstaffrep_${context.round}_${member.role}_${hashRatio(`${context.round}-${member.role}-${title}`).toString(36).slice(2, 8)}`,
    round: context.round,
    season: context.season,
    role: member.role,
    staffName: member.name,
    playerId,
    playerName,
    title,
    detail,
    createdAt: new Date().toISOString()
  };
};

const findFitnessReport = (state: ClubStaffState, context: ClubStaffReportContext): ClubStaffReport | null => {
  const overloaded = context.players
    .filter(p => context.starters.includes(p.id) && (p.workload?.fatigueRisk ?? 0) >= 62)
    .sort((a, b) => (b.workload?.fatigueRisk ?? 0) - (a.workload?.fatigueRisk ?? 0))[0];
  if (!overloaded) return null;
  return makeClubStaffReport(
    context,
    getClubStaffMember(state, 'fitness_coach'),
    'Carico da monitorare',
    `Il carico di ${overloaded.name} e oltre la soglia consigliata (${overloaded.workload?.fatigueRisk}/100).`,
    overloaded.id,
    overloaded.name
  );
};

const findPhysioReport = (state: ClubStaffState, context: ClubStaffReportContext): ClubStaffReport | null => {
  const notReady = context.players.find(p => p.injuryStatus?.status === 'managed_return' && (p.injuryStatus?.reinjuryRisk ?? 0) >= 25);
  if (notReady) {
    return makeClubStaffReport(
      context,
      getClubStaffMember(state, 'head_physio'),
      'Rientro da gestire',
      `${notReady.name} non e pronto per un rientro da titolare: rischio ricaduta ${notReady.injuryStatus?.reinjuryRisk}/100.`,
      notReady.id,
      notReady.name
    );
  }
  const respondingWell = context.players.find(p => p.injuryStatus?.status === 'rehab' && (p.injuryStatus?.returnReadiness ?? 0) >= 55);
  if (respondingWell) {
    return makeClubStaffReport(
      context,
      getClubStaffMember(state, 'head_physio'),
      'Recupero in linea',
      `${respondingWell.name} sta rispondendo bene al percorso di riabilitazione (${respondingWell.injuryStatus?.returnReadiness}/100).`,
      respondingWell.id,
      respondingWell.name
    );
  }
  return null;
};

const findDevelopmentReport = (state: ClubStaffState, context: ClubStaffReportContext): ClubStaffReport | null => {
  const growing = context.players
    .filter(p => p.developmentProfile?.trend === 'crescita' && (p.developmentProfile?.seasonGrowth ?? 0) > 0.3)
    .sort((a, b) => (b.developmentProfile?.seasonGrowth ?? 0) - (a.developmentProfile?.seasonGrowth ?? 0))[0];
  if (growing) {
    return makeClubStaffReport(
      context,
      getClubStaffMember(state, 'development_coach'),
      'Crescita confermata',
      `${growing.name} sta rispondendo bene al piano tecnico.`,
      growing.id,
      growing.name
    );
  }
  const learningRole = context.players.find(p => (p.roleFamiliarity ?? []).some(entry => entry.status === 'learning' && entry.trainingProgress >= 70));
  if (learningRole) {
    return makeClubStaffReport(
      context,
      getClubStaffMember(state, 'development_coach'),
      'Apprendimento ruolo vicino al salto',
      `${learningRole.name} e vicino a un salto di affidabilita nel nuovo ruolo.`,
      learningRole.id,
      learningRole.name
    );
  }
  return null;
};

const findScoutReport = (state: ClubStaffState, context: ClubStaffReportContext): ClubStaffReport | null => {
  const target = context.scoutedTargets
    .filter(t => (t.scoutLevel ?? 0) >= 2 && (t.projectFit ?? 0) >= 78)
    .sort((a, b) => (b.projectFit ?? 0) - (a.projectFit ?? 0))[0];
  if (!target) return null;
  return makeClubStaffReport(
    context,
    getClubStaffMember(state, 'chief_scout'),
    'Profilo compatibile',
    `Il profilo osservato (${target.playerName}) ha un'ottima compatibilita con il DNA del progetto (${target.projectFit}/100).`,
    undefined,
    target.playerName
  );
};

const findAssistantReport = (state: ClubStaffState, context: ClubStaffReportContext): ClubStaffReport | null => {
  if (!context.tactic) return null;
  const startersList = context.players.filter(p => context.starters.includes(p.id));
  const avgCondition = startersList.length
    ? startersList.reduce((sum, p) => sum + p.condition, 0) / startersList.length
    : 100;

  if (context.tactic.pressing >= 72 && avgCondition < 74) {
    return makeClubStaffReport(
      context,
      getClubStaffMember(state, 'assistant_manager'),
      'Pressing e fatica',
      `Il pressing a ${context.tactic.pressing} sta consumando la squadra (condizione media ${Math.round(avgCondition)}): rischio spazi nel finale.`
    );
  }
  if ((context.tactic.defensiveLine ?? 50) >= 68) {
    return makeClubStaffReport(
      context,
      getClubStaffMember(state, 'assistant_manager'),
      'Linea alta esposta',
      'La linea difensiva molto alta lascia spazio alle spalle contro le ripartenze rapide.'
    );
  }
  return null;
};

const CLUB_STAFF_REPORT_CHECKS: Array<(state: ClubStaffState, context: ClubStaffReportContext) => ClubStaffReport | null> = [
  findFitnessReport,
  findPhysioReport,
  findDevelopmentReport,
  findScoutReport,
  findAssistantReport
];

// Avanza i report staff di al massimo una unita' per giornata, solo se esiste una causa reale.
export const advanceClubStaffReports = (state: ClubStaffState, context: ClubStaffReportContext): ClubStaffState => {
  if (state.lastReportRound === context.round) return state;

  const offset = context.round % CLUB_STAFF_REPORT_CHECKS.length;
  let report: ClubStaffReport | null = null;
  for (let i = 0; i < CLUB_STAFF_REPORT_CHECKS.length && !report; i += 1) {
    const check = CLUB_STAFF_REPORT_CHECKS[(offset + i) % CLUB_STAFF_REPORT_CHECKS.length];
    report = check(state, context);
  }

  return {
    ...state,
    lastReportRound: context.round,
    recentReports: report ? [report, ...state.recentReports].slice(0, 12) : state.recentReports
  };
};
