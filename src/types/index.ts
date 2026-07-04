export interface ClubProfile {
  id: string;
  name: string;
  shortName: string;
  initials: string;
  logoUrl?: string;
  city: string;
  stadium: string;
  stadiumCapacity: number;
  ownership: string;
  transferBudget: number;
  clubValue: number;
  objective: string;
  boardPromise: string;
  playStyle: string;
  academy: string;
  fanbase: string;
  pressure: number;
  difficulty: 'Facile' | 'Media' | 'Difficile' | 'Estrema';
  primaryColor: string;
  secondaryColor: string;
  highlight: string;
  coach?: ClubCoachProfile;
}

export interface ClubCoachProfile {
  name: string;
  nationality?: string;
  age?: number;
  role?: string;
  overall?: number;
  preferredModule?: string;
  style?: string;
  strengths?: string;
  risks?: string;
  matches?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  winRate?: number;
  pointsPerGame?: number;
  form?: string;
  trophies?: string;
  attributes?: Record<string, number>;
  notes?: string;
}

export type PlayerRole = 'GK' | 'CB' | 'LB' | 'RB' | 'DM' | 'CM' | 'AM' | 'LW' | 'RW' | 'ST';

export interface PlayerPersonality {
  ambition: number;
  loyalty: number;
  ego: number;
  professionalism: number;
  composure: number;
  aggression: number;
  shyness: number;
  leadership: number;
  cityAttachment: number;
  clubLove: number;
  benchTolerance: number;
  mediaPressure: number;
  bigClubDesire: number;
  oneClubManDesire: number;
  finalClutch: number;
  consistency: number;
}

export interface PlayerRelationships {
  coach: number;
  teammates: number;
  fans: number;
  agent: number;
  mentorId?: string;
  rivalIds?: string[];
  bestMateIds?: string[];
}

export interface PlayerCareerMemory {
  seasonsAtClub: number;
  appearances: number;
  goals: number;
  consecutiveStarts: number;
  consecutiveAppearances: number;
  iconicMoments: number;
  benchComplaints: number;
  promisesKept: number;
  promisesBroken: number;
  pressureCarryover: number;
  overuseWarnings: number;
  injuryWeeks: number;
  legendScore: number;
}

export type PlayerStatValue = string | number;

export type PlayerProjectRoleKey =
  | 'untouchableStar'
  | 'silentLeader'
  | 'contestedStarter'
  | 'twelfthMan'
  | 'protectedYoungster'
  | 'brokenPromise'
  | 'decliningVeteran'
  | 'surplus'
  | 'futureCaptain'
  | 'fanSymbol';

export interface PlayerProjectRole {
  key: PlayerProjectRoleKey;
  label: string;
  summary: string;
  expectation: string;
  trust: number;
  tension: number;
  growthModifier: number;
  dressingRoomWeight: number;
  fanWeight: number;
  reasons: string[];
}

export interface PlayerExternalProfile {
  source: string;
  sourceDepartment?: string;
  sourceRole?: string;
  height?: string;
  preferredFoot?: string;
  valueLabel?: string;
  minutes?: number;
  goals?: number;
  assists?: number;
  rating?: number;
  coverage?: string;
  hierarchy?: string;
  statsSummary?: string;
  note?: string;
  rawStats?: Record<string, PlayerStatValue>;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  secondaryRoles?: PlayerRole[];
  positionTraining?: Partial<Record<PlayerRole, number>>;
  age: number;
  nationality: string;
  overall: number;
  potential: number;
  form: number; // 0.0 to 10.0 scale, e.g., 7.5
  morale: number; // 0 to 100
  condition: number; // 0 to 100
  stamina: number; // resistance to repeated starts, 0 to 100
  value: number; // in Euros
  wage: number; // weekly wage in Euros
  contractYears: number; // years remaining
  status: 'Disponibile' | 'Stanco' | 'Infortunato' | 'Cedibile' | 'In Forma';
  height?: string;
  preferredFoot?: string;
  sourceRole?: string;
  valueLabel?: string;
  attributes?: Record<string, number>;
  externalProfile?: PlayerExternalProfile;
  personality: PlayerPersonality;
  relationships: PlayerRelationships;
  careerMemory: PlayerCareerMemory;
}

export type PlayerRecentFormToken = 'G' | 'A' | 'GA' | '-';

export interface PlayerSeasonStat {
  playerId: string;
  playerName: string;
  clubName: string;
  role: PlayerRole;
  appearances: number;
  goals: number;
  assists: number;
  chancesCreated: number;
  recentForm: PlayerRecentFormToken[];
}

export interface ClubAIState {
  clubId: string;
  name: string;
  budget: number;
  ambition: number;
  roster: Player[];
  transferLog: string[];
}

export interface IncomingTransferOffer {
  id: string;
  fromClub: string;
  playerId: string;
  playerName: string;
  role: PlayerRole;
  fee: number;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export type ClubMemoryCategory = 'match' | 'transfer' | 'locker' | 'rivalry' | 'youth' | 'record' | 'legacy' | 'coach';
export type ClubMemoryPersistence = 'short' | 'season' | 'long' | 'permanent';
export type ClubMemoryActor =
  | 'club'
  | 'player'
  | 'coach'
  | 'fans'
  | 'curva'
  | 'rivalry'
  | 'board'
  | 'media'
  | 'agent'
  | 'academy'
  | 'sponsor';

export type ClubStakeholderKey =
  | 'ownership'
  | 'fans'
  | 'curva'
  | 'sponsors'
  | 'lockerRoom'
  | 'staff'
  | 'press'
  | 'agents'
  | 'academy';

export interface ClubStakeholderState {
  key: ClubStakeholderKey;
  name: string;
  mood: number;
  influence: number;
  patience: number;
  interests: string[];
  lastEvent?: string;
  lastDelta?: number;
}

export interface ClubMemory {
  id: string;
  dateLabel: string;
  season: string;
  category: ClubMemoryCategory;
  title: string;
  description: string;
  importance: number;
  fanImpact: number;
  dressingRoomImpact: number;
  tags: string[];
  persistence?: ClubMemoryPersistence;
  strength?: number;
  actors?: ClubMemoryActor[];
  stakeholderImpacts?: Partial<Record<ClubStakeholderKey, number>>;
  playerNames?: string[];
  opponent?: string;
  score?: string;
}

export type ClubMemoryDraft = Omit<ClubMemory, 'id' | 'dateLabel'> & {
  id?: string;
  dateLabel?: string;
};

export interface ClubHistoryEntry {
  id: string;
  title: string;
  subtitle: string;
  season: string;
  impact: number;
  tags?: string[];
}

export interface ClubRivalry {
  id: string;
  opponent: string;
  heat: number;
  reason: string;
  startedAt: string;
  memories: string[];
}

export interface ClubPromise {
  id: string;
  playerName: string;
  promise: string;
  createdAt: string;
  status: 'attiva' | 'mantenuta' | 'tradita';
  trustImpact: number;
}

export interface ClubHistoryState {
  clubName: string;
  managerName: string;
  startedSeason: string;
  fanMood: number;
  dressingRoom: number;
  identity: number;
  trophies: ClubHistoryEntry[];
  records: ClubHistoryEntry[];
  legends: ClubHistoryEntry[];
  betrayals: ClubHistoryEntry[];
  iconicMatches: ClubHistoryEntry[];
  pastCoaches: ClubHistoryEntry[];
  launchedYoungsters: ClubHistoryEntry[];
  bestSignings: ClubHistoryEntry[];
  worstSignings: ClubHistoryEntry[];
  painfulSales: ClubHistoryEntry[];
  profitableDeals: ClubHistoryEntry[];
  emotionalReturns: ClubHistoryEntry[];
  newEraSignings: ClubHistoryEntry[];
  rivalries: ClubRivalry[];
  promises: ClubPromise[];
  stakeholders: ClubStakeholderState[];
  memories: ClubMemory[];
}

export type StaffRole =
  | 'assistant'
  | 'sportingDirector'
  | 'fitnessCoach'
  | 'goalkeeperCoach'
  | 'scoutingChief'
  | 'academyDirector'
  | 'doctor'
  | 'psychologist'
  | 'teamManager'
  | 'president';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  roleLabel: string;
  competence: number;
  loyalty: number;
  ambition: number;
  relationship: number;
  philosophy: string;
  reputation: number;
  playerManagement: number;
  youthPreference: number;
  veteranPreference: number;
  candor: number;
}

export interface StaffAdvice {
  id: string;
  staffId: string;
  staffName: string;
  roleLabel: string;
  title: string;
  opinion: string;
  benefit: string;
  cost: string;
  urgency: number;
  tone: 'positive' | 'warning' | 'critical' | 'neutral';
}

export type ExternalWorldSignalCategory =
  | 'results'
  | 'market'
  | 'locker'
  | 'fans'
  | 'curva'
  | 'board'
  | 'media'
  | 'finance'
  | 'sponsor'
  | 'agent'
  | 'promise'
  | 'youth';

export interface ExternalWorldSignal {
  id: string;
  category: ExternalWorldSignalCategory;
  label: string;
  detail: string;
  intensity: number;
  round: number;
  source: string;
  tags: string[];
}

export type TeamDNAKey =
  | 'pressingFeroce'
  | 'possesso'
  | 'contropiedeVerticale'
  | 'giovaniItaliani'
  | 'sudamericaniTecnici'
  | 'vivaio'
  | 'clubVenditore'
  | 'galacticos'
  | 'difesaGranitica'
  | 'squadraCinica'
  | 'calcioRomantico';

export interface TeamDNAState {
  clubName: string;
  active: TeamDNAKey;
  secondary: TeamDNAKey[];
  scores: Record<TeamDNAKey, number>;
  reputation: number;
  internationalReputation: number;
  fanAlignment: number;
  marketAttraction: number;
  youthDevelopment: number;
  seasonsTracked: number;
  lastNarrative: string;
  history: string[];
}

export interface Tactic {
  module: '4-3-3' | '4-2-3-1' | '3-5-2';
  mentality: 'Difensiva' | 'Bilanciata' | 'Offensiva';
  pressing: number; // 0-100
  tempo: number; // 0-100
  width: number; // 0-100
  buildUp: 'Lancio Lungo' | 'Manovrata' | 'Mista';
  defensiveLine: number; // 0-100
  riskLevel: number; // 0-100
  chanceCreation: 'Cross' | 'Tagli Interni' | 'Tiri da Fuori' | 'Passaggi Filtranti';
  marking: 'Zona' | 'Uomo' | 'Mista';
  transition: 'Contropiede' | 'Riaggressione' | 'Conservativa';
  attackingFocus: 'Fasce' | 'Centro' | 'Equilibrato';
  principles?: TacticalPrinciple[];
  gamePlan?: MatchGamePlan;
  familiarity?: number;
  styleSignature?: string;
  lineupCore?: string[];
  starters: string[]; // Player IDs (exactly 11 elements matching visual positions)
  bench: string[]; // Player IDs for substitutes
}

export type TacticalPrinciple = 'overlaps' | 'falseNine' | 'mezzalaRuns' | 'deepPlaymaker' | 'manMarkKey';
export type MatchPlanMode = 'Proteggi' | 'Equilibrio' | 'Spingi';
export type RedCardPlanMode = 'Blocco basso' | 'Compatto' | 'Rischia';

export interface MatchGamePlan {
  whenLeading: MatchPlanMode;
  whenTrailing: MatchPlanMode;
  whenRedCard: RedCardPlanMode;
}

export interface RivalTacticalMemory {
  clubName: string;
  coachName: string;
  coachGeneration: number;
  philosophy: TeamDNAKey;
  preferredModule: Tactic['module'];
  courage: number;
  adaptability: number;
  weakness: string;
  relationship: number;
  meetings: number;
  wins: number;
  draws: number;
  losses: number;
  familiarity: Record<TeamDNAKey, number>;
  wideTrap: number;
  centralTrap: number;
  pressingTrap: number;
  counterTrap: number;
  possessionTrap: number;
  lowBlockBias: number;
  exPlayerKnowledge: number;
  lastUserWeapon: string;
  lastMeetingSummary: string;
  history: string[];
}

export type SeasonChapterKey =
  | 'preseason'
  | 'projectCheck'
  | 'novemberCrisis'
  | 'winterMarket'
  | 'finalRun'
  | 'epilogue'
  | 'summer';

export interface SeasonStoryEvent {
  id: string;
  chapter: SeasonChapterKey;
  round: number;
  title: string;
  description: string;
  consequence: string;
  tone: 'positive' | 'neutral' | 'warning' | 'critical';
  causalKey?: string;
  causeScore?: number;
  causes?: string[];
}

export type NarrativeArcType =
  | 'youngster_path'
  | 'promise_case'
  | 'renewal_case'
  | 'fan_crisis'
  | 'market_wound'
  | 'media_pressure'
  | 'ownership_project';

export type NarrativeArcStage = 'birth' | 'growth' | 'critical' | 'resolution' | 'consequence';
export type NarrativeArcStatus = 'active' | 'resolved' | 'permanent';
export type NarrativeChoiceStyle = 'diplomatic' | 'pragmatic' | 'hard' | 'risky' | 'deferred' | 'delegated';

export interface NarrativeArcChoiceEffect {
  pressureDelta?: number;
  boardTrustDelta?: number;
  squadBeliefDelta?: number;
  fanPatienceDelta?: number;
  budgetDelta?: number;
  playerMoraleDelta?: number;
  playerCoachDelta?: number;
  playerFanDelta?: number;
  arcHeatDelta?: number;
  resolveArc?: boolean;
  permanent?: boolean;
  memoryImportance?: number;
  memoryFanImpact?: number;
  memoryDressingRoomImpact?: number;
  stakeholderImpacts?: Partial<Record<ClubStakeholderKey, number>>;
  tags?: string[];
}

export interface NarrativeArcChoice {
  id: string;
  label: string;
  style: NarrativeChoiceStyle;
  description: string;
  benefit: string;
  cost: string;
  effect: NarrativeArcChoiceEffect;
}

export interface NarrativeArc {
  id: string;
  type: NarrativeArcType;
  title: string;
  protagonistName?: string;
  relatedClub?: string;
  stage: NarrativeArcStage;
  status: NarrativeArcStatus;
  startedRound: number;
  lastRound: number;
  deadlineRound?: number;
  heat: number;
  summary: string;
  stakes: string;
  choices: NarrativeArcChoice[];
  history: string[];
  outcome?: string;
}

export interface SeasonNarrativeState {
  seasonLabel: string;
  seasonIndex: number;
  currentChapter: SeasonChapterKey;
  triggeredChapters: SeasonChapterKey[];
  pressure: number;
  boardTrust: number;
  squadBelief: number;
  fanPatience: number;
  arcTitle: string;
  arcSummary: string;
  keyQuestion: string;
  worldSignals: ExternalWorldSignal[];
  arcs: NarrativeArc[];
  events: SeasonStoryEvent[];
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'card_yellow' | 'card_red' | 'substitution' | 'injury' | 'opportunity';
  description: string;
  team: 'user' | 'opponent';
  playerId?: string;
  playerName?: string;
  assistPlayerId?: string;
  assistPlayerName?: string;
}

export interface MatchStats {
  possession: number; // 0-100 for user, opponent is 100 - possession
  shotsUser: number;
  shotsOpponent: number;
  shotsOnTargetUser: number;
  shotsOnTargetOpponent: number;
  xGUser: number;
  xGOpponent: number;
  foulsUser: number;
  foulsOpponent: number;
}

export interface Match {
  id: string;
  opponent: string;
  opponentInitials: string;
  stadium: string;
  isHome?: boolean;
  date: string;
  status: 'played' | 'next' | 'future';
  scoreUser?: number;
  scoreOpponent?: number;
  playedIndex?: number; // week index 1-38
  stats?: MatchStats;
  events?: MatchEvent[];
}

export type AgentStyle = 'Leale' | 'Duro' | 'Mediatico' | 'Opportunista' | 'Paziente';
export type TransferClauseType = 'none' | 'goalBonus' | 'loanObligation' | 'buyback' | 'sellOn';
export type ContractPromiseType = 'none' | 'starter' | 'rotation' | 'youngProject' | 'starRole';
export type ScoutingCertainty = 'Bassa' | 'Media' | 'Alta' | 'Completa';

export interface Negotiation {
  id: string; // matches player id
  playerName: string;
  role: string;
  currentClub: string;
  baseValue?: number;
  value: number;
  wage: number;
  offeredFee: number;
  offeredWage: number;
  offeredContractYears: number;
  probability: number;
  status: 'pending' | 'accepted' | 'rejected';
  timeline: string[]; // logs of negotiation steps
  scoutLevel?: number;
  scoutCertainty?: ScoutingCertainty;
  potentialRange?: [number, number];
  tacticalFit?: number;
  systemNote?: string;
  hiddenRisk?: 'Fragilita fisica' | 'Carattere complesso' | 'Adattamento campionato' | 'Nessuno';
  riskKnown?: boolean;
  personalityKnown?: boolean;
  agentName?: string;
  agentStyle?: AgentStyle;
  agentTrust?: number;
  agentPatience?: number;
  daysLeft?: number;
  rivalClub?: string;
  rivalPressure?: number;
  rumorLevel?: number;
  clauseType?: TransferClauseType;
  promiseType?: ContractPromiseType;
  roleExpectation?: string;
  projectFit?: number;
}

export interface Standing {
  rank: number;
  name: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  form: ('W' | 'D' | 'L')[];
}

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  content: string;
  category: 'board' | 'training' | 'market' | 'league';
  read: boolean;
}
