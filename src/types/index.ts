export type ClubDivision = 'serie_a' | 'serie_b';

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
  division?: ClubDivision; // affidabile: assegnato esplicitamente, mai dedotto dal nome. Assente = legacy Serie A.
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
  | 'fanSymbol'
  | 'steadyStarter'
  | 'keyRotation'
  | 'benchPlayer'
  | 'frustratedTalent';

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

// ─── Condizione fisica, carico e infortuni (persistente su Player) ───
// I valori seguenti sono dati di gameplay CalcioManager (bilanciamento), non informazioni mediche reali.

export interface PlayerPhysicalProfile {
  resilience: number; // robustezza generale 0-100
  recoveryRate: number; // velocita di recupero 0-100
  softTissueRisk: number; // rischio muscolare 0-100
  jointRisk: number; // rischio articolare 0-100
  chronicRisk: number; // rischio ricadute 0-100
  workloadTolerance: number; // tolleranza a minuti ravvicinati 0-100
  explosiveRecovery: number; // recupero di scatto/agilita dopo uno stop 0-100
  injuryProneness: number; // sintesi leggibile, derivata dagli altri valori
}

export interface PlayerRecentMatchLoad {
  round: number;
  minutes: number;
  started: boolean;
  highIntensity: boolean;
}

export interface PlayerWorkloadState {
  minutesLast7Days: number;
  minutesLast14Days: number;
  minutesLast28Days: number;
  startsLast14Days: number;
  consecutiveStarts: number;
  recentHighIntensityMatches: number;
  accumulatedLoad: number; // 0-100
  freshness: number; // 0-100
  matchSharpness: number; // 0-100
  fatigueRisk: number; // 0-100
  lastMatchRound?: number;
  lastUpdatedAt: string;
  recentMatchLoads: PlayerRecentMatchLoad[]; // ultime giornate, alimenta le finestre sopra (calendario settimanale: 1 giornata ~ 7 giorni)
}

export type PlayerInjuryType =
  | 'muscle_overload'
  | 'muscle_strain'
  | 'ankle_sprain'
  | 'knee_ligament'
  | 'acl_tear'
  | 'bone_injury'
  | 'illness';

export type PlayerInjuryBodyArea = 'hamstring' | 'adductor' | 'calf' | 'quadriceps' | 'ankle' | 'knee' | 'other';

export type PlayerInjurySeverity = 'minor' | 'moderate' | 'major' | 'severe';

export interface PlayerInjuryRecord {
  id: string;
  type: PlayerInjuryType;
  bodyArea: PlayerInjuryBodyArea;
  severity: PlayerInjurySeverity;
  occurredAt: string;
  season: string;
  round?: number;
  expectedReturnRound?: number;
  actualReturnRound?: number;
  daysOutEstimate: number; // in giornate/settimane di stop stimate, non una diagnosi medica
  missedMatches: number;
  isRecurring: boolean;
  longTermImpact: number; // 0-100, segno lasciato sul profilo fisico dopo il rientro
}

export type PlayerInjuryStatusValue = 'fit' | 'knock' | 'injured' | 'rehab' | 'return_to_training' | 'managed_return';

export type PlayerMedicalRecommendation = 'available' | 'monitor' | 'rest' | 'unavailable';

export interface PlayerInjuryStatus {
  status: PlayerInjuryStatusValue;
  currentInjury?: PlayerInjuryRecord;
  returnReadiness: number; // 0-100
  reinjuryRisk: number; // 0-100
  temporaryPerformancePenalty: number; // 0-100, si riduce gradualmente durante il rientro guidato
  medicalRecommendation: PlayerMedicalRecommendation;
}

// ─── Allenamento, sviluppo, declino e potenziale dinamico (persistente su Player) ───
// I valori seguenti sono dati di gameplay CalcioManager (bilanciamento), non informazioni reali.

export type TrainingFocus =
  | 'balanced'
  | 'technical'
  | 'physical'
  | 'defensive'
  | 'attacking'
  | 'mental'
  | 'role_learning'
  | 'recovery';

export type TrainingIntensity = 'light' | 'normal' | 'high';

export type PlayerTrainingPlanStatus = 'active' | 'paused' | 'completed' | 'limited_by_fitness' | 'limited_by_injury';

export interface PlayerTrainingPlan {
  playerId: string;
  focus: TrainingFocus;
  intensity: TrainingIntensity;
  targetRole?: PlayerRole;
  startedAtRound: number;
  lastUpdatedRound: number;
  progress: number; // 0-100, "adesione al piano": costanza nel seguirlo, NON sviluppo reale
  developmentProgress: number; // 0-100, sviluppo reale (lento): richiede settimane/mesi, separato dall'adesione
  accumulatedTrainingLoad: number; // 0-100, carico da allenamento (separato dal carico partite)
  weeklyGoal?: string;
  status: PlayerTrainingPlanStatus;
  focusChangesThisSeason: number; // contatore statistico dei cambi nella stagione
  focusChangedAtRound?: number; // ultimo cambio reale di focus/ruolo obiettivo: attiva una penalita' temporanea, non permanente
  notes: string[]; // max 5, piu recenti prima
}

export type PlayerDevelopmentStage = 'academy' | 'prospect' | 'developing' | 'prime' | 'veteran' | 'declining';
export type PlayerDevelopmentTrend = 'crescita' | 'stabile' | 'calo' | 'recupero';

export interface PlayerDevelopmentReview {
  round: number;
  season: string;
  summary: string;
  overallDelta: number;
}

export interface PlayerDevelopmentProfile {
  basePotential: number;
  projectedPotential: number;
  realizedCeiling: number; // tetto dinamico interno, mai mostrato direttamente in UI
  growthRate: number; // 0-100
  declineRate: number; // 0-100
  consistency: number; // 0-100
  adaptability: number; // 0-100
  learningSpeed: number; // 0-100
  ambitionImpact: number; // modificatore leggibile, puo essere negativo
  professionalismImpact: number;
  lateBloomerChance: number; // 0-100
  overPotentialCapacity: number; // margine massimo oltre projectedPotential
  developmentStage: PlayerDevelopmentStage;
  trend: PlayerDevelopmentTrend;
  lastDevelopmentReviewRound?: number;
  seasonGrowth: number; // progresso reale accumulato nella stagione corrente (azzerato a fine stagione)
  seasonDecline: number; // perdita reale accumulata nella stagione corrente (azzerata a fine stagione)
  growthSinceReview: number; // accumulo frazionario dall'ultima revisione periodica
  declineSinceReview: number;
  positiveSeasonStreak?: number; // stagioni consecutive con crescita netta positiva: usato per il raro superamento del potenziale
  reviewHistory: PlayerDevelopmentReview[]; // max 6, piu recenti prima
}

export type PlayerRoleFamiliarityStatus = 'unknown' | 'learning' | 'usable' | 'competent' | 'natural';

export interface PlayerRoleFamiliarity {
  roleId: PlayerRole;
  familiarity: number; // 0-100
  trainingProgress: number; // 0-100, verso il prossimo salto di familiarita
  matchMinutesInRole: number;
  startedAtRound?: number;
  lastUsedRound?: number;
  status: PlayerRoleFamiliarityStatus;
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
  playingTimePromise?: PlayingTimePromise;
  clubHistory?: PlayerClubHistoryEntry[];
  physicalProfile?: PlayerPhysicalProfile;
  workload?: PlayerWorkloadState;
  injuryHistory?: PlayerInjuryRecord[];
  injuryStatus?: PlayerInjuryStatus;
  developmentProfile?: PlayerDevelopmentProfile;
  trainingPlan?: PlayerTrainingPlan;
  roleFamiliarity?: PlayerRoleFamiliarity[];
  contract?: PlayerContract;
  squadStatus?: PlayerSquadStatus; // assente = 'first_team' (default sicuro per vecchi salvataggi)
  youthProfile?: YouthAcademyProfile;
  loanState?: PlayerLoanState; // presente solo se il giocatore e' in prestito nella mia rosa
  // ─── Mercato Cessioni C1: disponibilita reale (assente = 'available_for_right_offer', mai rigenerata) ───
  transferAvailability?: TransferAvailability;
  askingPrice?: number;
  minimumAcceptablePrice?: number;
  listedAtRound?: number;
  lastAvailabilityChangeRound?: number;
  // ─── Mercato M2A: clausole future legate a questo giocatore (assenti = array vuoto, mai rigenerate) ───
  sellOnClauses?: SellOnClause[];
  buyBackClauses?: BuyBackClause[];
  // ─── Mercato M2C: clausole protettive legate a questo giocatore (assenti = array vuoto) ───
  firstRefusalClauses?: FirstRefusalClause[];
  antiRivalClauses?: AntiRivalTransferClause[];
}

// ─── Mercato Cessioni C1: disponibilita/interesse dei club IA (mai un'offerta immediata solo perche' listato) ───

export type TransferAvailability =
  | 'not_for_sale'
  | 'available_for_right_offer'
  | 'listed_for_sale'
  | 'loan_listed'
  | 'sale_or_loan'
  | 'out_of_squad'
  | 'player_requested_exit'
  | 'untouchable'
  | 'expiring'
  | 'conditional_loan';

export type TransferInterestLevel =
  | 'watching'
  | 'monitoring'
  | 'concrete_interest'
  | 'inquiry'
  | 'possible_negotiation'
  | 'official_offer';

export interface ClubTransferInterest {
  id: string;
  playerId: string;
  interestedClubId: string;
  level: TransferInterestLevel;
  score: number;
  reasons: string[];
  firstSeenRound: number;
  lastUpdatedRound: number;
  nextEligibleActionRound: number;
  isPublic?: boolean;
  sourceId: string;
  // Estensione minima necessaria per gestire cooldown/anti-loop senza un secondo array parallelo:
  // 'active' = ancora in evoluzione; 'converted' = diventato un'offerta ufficiale reale (mai riprocessato);
  // 'expired' | 'withdrawn' = trattativa chiusa, soggetta a cooldown prima di un nuovo interesse pulito.
  status: 'active' | 'converted' | 'expired' | 'withdrawn';
}

export interface OutgoingMarketState {
  interests: ClubTransferInterest[]; // max 200, piu' vecchi/risolti rimossi per primi
  lastProcessedRound: number | null; // guardia anti-doppia-elaborazione della stessa giornata
}

// ─── Settore giovanile (Fase 9) ───
// I prospetti sono dati di gameplay fittizi, mai calciatori reali. Riusa Player/developmentProfile/
// contract gia' esistenti: il vivaio non e' un secondo sistema di sviluppo o contratti, solo un
// percorso separato (squadStatus) finche' non arriva una promozione esplicita.

export type PlayerSquadStatus = 'first_team' | 'youth_academy' | 'released';

export type YouthAcademyStatus = 'prospect' | 'high_potential' | 'promotion_candidate' | 'promoted' | 'released';

export type YouthAgeGroup = 'u16' | 'u17' | 'u18' | 'u19';

export type YouthLocalConnection = 'local' | 'regional' | 'national' | 'international';

export interface YouthAcademyProfile {
  academyClubId: string;
  academyClubName: string;
  intakeSeason: string;
  academyStatus: YouthAcademyStatus;
  academyAgeGroup: YouthAgeGroup;
  localConnection: YouthLocalConnection;
  initialScoutConfidence: number; // 0-100
  academyDevelopmentMinutes: number; // attivita' interna simulata, mai minuti ufficiali di prima squadra
  academyForm: number; // 0-100
  lastAcademyReviewRound?: number;
  promotedAtRound?: number;
  releasedAtSeason?: string;
}

export interface YouthAcademyReport {
  id: string;
  createdAt: string;
  playerId?: string;
  type: 'progress' | 'stagnation' | 'promotion_recommendation' | 'contract_recommendation' | 'release_recommendation' | 'intake';
  title: string;
  summary: string;
  importance: number;
  sourceId: string;
}

export interface YouthAcademyState {
  clubId: string;
  currentSeason: string;
  playerIds: string[]; // max 16, solo prospetti attivi (non promossi/rilasciati)
  lastIntakeSeason?: string;
  lastReviewRound?: number;
  recentReports: YouthAcademyReport[]; // max 12
  historicalGraduateIds: string[]; // max 20
  processedAcademyEventIds: string[]; // max 30, anti-doppia-elaborazione
}

// ─── Contratti giocatori (Fase 8C) ───
// Estende Player senza duplicare wage/contractYears: annualSalary/durationYears sono derivati da
// quei campi gia' esistenti (wage settimanale * 52, contractYears residui), mai un secondo valore
// indipendente che puo' andare fuori sincrono.

export type ContractSquadRole = 'star' | 'important' | 'rotation' | 'prospect' | 'backup';

export interface PlayerContractBonuses {
  signingBonus: number; // una tantum, dal budget trasferimenti, solo su nuove firme reali
  agentFee: number; // una tantum, dal budget trasferimenti
  appearanceBonus: number; // per presenza reale in campo
  goalBonus: number; // per gol realmente segnato
  cleanSheetBonus: number; // solo se ruolo/portiere-difesa e clean sheet reale
  annualLoyaltyBonus: number; // una volta a fine stagione se ancora sotto contratto
  teamAchievementBonus: number; // una volta a fine stagione, solo se supportato da un risultato reale
}

export interface PlayerContract {
  annualSalary: number; // EUR annui lordi, unita' canonica interna
  startSeason: string;
  endSeason: string;
  durationYears: number;
  squadRole: ContractSquadRole;
  bonuses: PlayerContractBonuses;
  annualSalaryIncreasePercent: number;
  releaseClause?: number;
  optionalExtensionYears?: number;
  status: 'active' | 'expiring' | 'negotiating' | 'expired';
  lastRenewalSeason?: string;
  earnedBonusesThisSeason: number;
  projectedBonusReserve: number;
  processedBonusMatchIds: string[]; // max 40, anti-doppio-conteggio
}

export interface ClubWageBudgetState {
  season: string;
  annualWageBudget: number; // tetto stagionale, stabile: cambia solo a revisione di stagione
  committedAnnualWages: number; // sempre ricalcolato dal roster reale, mai incrementato/decrementato a mano
  projectedBonusReserve: number; // idem, ricalcolato dal roster reale
  availableAnnualWages: number; // annualWageBudget - committed - reserve
  transferOneOffCostsThisSeason: number; // somma bonus firma + commissioni agente gia' pagati in stagione
  lastBudgetReviewSeason?: string;
  lastProcessedContractEventIds: string[]; // max 30, guardia anti-doppia-elaborazione stagionale
}

export type PlayerClubHistoryTransferType = 'initial' | 'purchase' | 'sale' | 'loan';

export interface PlayerClubHistoryEntry {
  clubId: string;
  clubName: string;
  joinedSeason: string;
  leftSeason?: string;
  transferType: PlayerClubHistoryTransferType;
  fee?: number;
}

export type PlayingTimePromiseType = 'playing_time';
export type PlayingTimePromiseStatus = 'active' | 'at_risk' | 'completed' | 'broken';

export interface PlayingTimePromise {
  id: string;
  playerId: string;
  type: PlayingTimePromiseType;
  targetMinutes: number;
  currentMinutes: number;
  createdAt: string;
  expiresAt: string;
  status: PlayingTimePromiseStatus;
  description: string;
  consequenceApplied: boolean;
  updatedAt: string;
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
  averageRating: number;
  minutesPlayed: number;
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

export type IncomingOfferFormula = 'permanent' | 'loan';

export interface IncomingTransferOffer {
  id: string;
  fromClub: string;
  playerId: string;
  playerName: string;
  role: PlayerRole;
  fee: number;
  reason: string;
  // 'awaiting_player_decision': il club ha accettato ma serve il consenso del giocatore prima di
  // completare davvero la cessione (mai una vendita forzata). 'player_declined'/'expired' non toccano
  // mai rosa o budget. 'suspended_first_refusal' (M2C): sospesa mentre il titolare della prelazione
  // decide se eguagliarla; riprende automaticamente se rinuncia/fallisce. 'superseded': il titolare
  // ha esercitato la prelazione, l'operazione si e' conclusa verso di lui invece che verso questo club.
  // Mercato M3: dopo l'accettazione, la cessione passa comunque per visita/registrazione prima di
  // lasciare la rosa ('medical_pending'/'medical_failed'/'registration_pending'/'registration_failed'
  // gestiti in automatico, senza scelta utente: la visita e' del club acquirente).
  status: 'pending' | 'accepted' | 'rejected' | 'awaiting_player_decision' | 'player_declined' | 'expired' | 'suspended_first_refusal' | 'superseded'
    | 'medical_pending' | 'medical_failed' | 'registration_pending' | 'registration_failed' | 'suspended_window_closed';
  formula?: IncomingOfferFormula; // assente = 'permanent' (retrocompatibile)
  wageShareIfLoan?: number; // 0-100, solo se formula === 'loan'
  createdAtRound?: number;
  expiresAtRound?: number;
  sourceInterestId?: string; // collega all'interesse IA (Mercato Cessioni C1) che ha generato l'offerta, se presente
  medicalCheck?: TransferMedicalCheck;
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

export type RivalryType = 'storica' | 'derby' | 'regionale' | 'emergente' | 'corsa_titolo' | 'trasferimento';
export type RivalryStatus = 'tensione' | 'rivalita_riconosciuta' | 'rivalita_forte' | 'nemico_storico';

export interface ClubRivalry {
  id: string;
  opponent: string;
  type: RivalryType;
  heat: number;
  respect: number;
  reason: string;
  startedAt: string;
  status: RivalryStatus;
  memories: string[]; // founding events, max 5, most recent first
  wins: number;
  draws: number;
  losses: number;
  lastMeetingSeason?: string;
  lastMeetingResult?: string;
  exPlayersInvolved: string[]; // player names, max 5
  updatedAt: string;
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

// ─── Staff tecnico/atletico/medico/scouting persistente (Fase 8A) ───
// Sistema distinto dallo StaffMember "da consiglio" sopra: qui i membri sono assumibili,
// persistono nel salvataggio e influenzano gradualmente i cicli gia' esistenti (fitness,
// sviluppo, scouting), mai overall/potenziale/risultati direttamente.

export type ClubStaffRole =
  | 'assistant_manager'
  | 'fitness_coach'
  | 'head_physio'
  | 'development_coach'
  | 'chief_scout';

export type ClubStaffWorkStyle = 'balanced' | 'demanding' | 'protective' | 'developmental';

export interface ClubStaffMember {
  id: string;
  name: string;
  role: ClubStaffRole;
  overall: number;
  tacticalAnalysis?: number;
  workloadManagement?: number;
  injuryPrevention?: number;
  rehabilitation?: number;
  youthDevelopment?: number;
  roleCoaching?: number;
  scoutingAccuracy?: number;
  marketKnowledge?: number;
  workStyle: ClubStaffWorkStyle;
  reputation: number;
  joinedSeason: string;
  seasonalCost: number;
}

export interface ClubStaffReport {
  id: string;
  round: number;
  season: string;
  role: ClubStaffRole;
  staffName: string;
  playerId?: string;
  playerName?: string;
  title: string;
  detail: string;
  createdAt: string;
}

export interface ClubStaffState {
  members: ClubStaffMember[];
  candidatePool: ClubStaffMember[];
  candidateGeneration: number;
  lastReviewRound: number | null;
  lastHireRound: number | null;
  lastReportRound: number | null;
  recentReports: ClubStaffReport[]; // max 12, piu' recenti prima
}

// ─── Strutture del club persistenti (Fase 8B) ───
// Investimenti a lungo termine che affiancano lo staff persistente: migliorano solo
// gradualmente i modificatori gia' esistenti (fitness, sviluppo, scouting, tattica),
// mai overall/potenziale/risultati direttamente.

export type FacilityType =
  | 'training_centre'
  | 'medical_centre'
  | 'youth_academy'
  | 'scouting_network'
  | 'analysis_department';

export interface FacilityProject {
  id: string;
  targetLevel: number;
  startedRound: number;
  completedRound: number;
  cost: number;
  status: 'active' | 'completed' | 'paused';
}

export interface ClubFacility {
  type: FacilityType;
  level: 1 | 2 | 3 | 4 | 5;
  condition: number; // 0-100, degrado lento e reale, non un secondo sistema di infortuni
  lastUpgradeSeason?: string;
  activeProject?: FacilityProject;
}

export interface ClubFacilitiesState {
  facilities: ClubFacility[];
  lastFacilityReviewRound: number | null;
  recentFacilityEvents: string[]; // max 8, piu' recenti prima
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

export type FormationModule =
  | '4-3-3' | '4-2-3-1' | '4-4-2' | '4-4-1-1' | '4-1-4-1' | '4-5-1' | '4-3-1-2' | '4-3-2-1'
  | '4-1-2-1-2' | '4-2-2-2' | '4-2-4' | '4-1-3-2'
  | '3-5-2' | '3-4-3' | '3-4-2-1' | '3-4-1-2' | '3-5-1-1' | '3-3-1-3'
  | '5-3-2' | '5-4-1' | '5-2-3' | '5-3-1-1' | '5-2-1-2'
  | '4-6-0' | '3-6-1' | '2-3-5';

export interface Tactic {
  module: FormationModule;
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
  // T2: ruolo/compito individuale per slot (chiave 'slot_0'..'slot_10', indice posizionale nel
  // modulo). Assente = vecchio salvataggio: i default coerenti si generano dal modulo, mai un reset.
  slotInstructions?: Record<string, SlotInstruction>;
}

// ─── T2: ruoli e compiti individuali per slot/giocatore ───

export type TacticalDuty = 'defend' | 'support' | 'attack';

export type PlayerInstructionRole =
  | 'gk_defend' | 'sweeper_keeper'
  | 'centre_back' | 'ball_playing_defender' | 'aggressive_centre_back' | 'wide_centre_back'
  | 'fullback_defend' | 'fullback_support' | 'wingback_support' | 'wingback_attack' | 'inverted_fullback'
  | 'defensive_midfielder' | 'deep_lying_playmaker' | 'anchor_man' | 'ball_winning_midfielder'
  | 'central_midfielder' | 'box_to_box' | 'mezzala' | 'advanced_playmaker'
  | 'wide_midfielder' | 'winger' | 'inside_forward' | 'wide_playmaker'
  | 'attacking_midfielder' | 'shadow_striker' | 'trequartista'
  | 'advanced_forward' | 'pressing_forward' | 'target_forward' | 'false_nine' | 'second_striker';

export interface SlotInstructionCustomFlags {
  pressMore?: boolean;
  stayBack?: boolean;
  getForward?: boolean;
  cutInside?: boolean;
  stayWide?: boolean;
  roamFromPosition?: boolean;
  markTighter?: boolean;
  takeMoreRisks?: boolean;
}

export interface SlotInstruction {
  slotId: string;
  role: PlayerInstructionRole;
  duty: TacticalDuty;
  customInstructions?: SlotInstructionCustomFlags;
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

// ─── Live Tactical Viewer: replay visivo deterministico (mai una seconda simulazione) ───
// Coordinate normalizzate 0-100. Derivato da matchId + dati reali (eventi, tattica, formazione);
// mai persistito, sempre rigenerabile dal matchId e dai dati gia' salvati.
export type ReplayPhase =
  | 'build_up'
  | 'progression'
  | 'final_third'
  | 'chance'
  | 'pressing'
  | 'counter_attack'
  | 'defensive_block'
  | 'set_piece'
  | 'transition';

export interface PitchPoint {
  x: number;
  y: number;
}

export interface ReplayPlayerState {
  playerId: string;
  teamId: 'user' | 'opponent';
  position: PitchPoint;
  role?: Player['role'];
  jerseyNumber?: number;
  shortName?: string;
  isBallCarrier?: boolean;
  isPressing?: boolean;
  isHighlighted?: boolean;
}

export interface ReplayFrame {
  id: string;
  startSecond: number;
  endSecond: number;
  minute: number;
  phase: ReplayPhase;
  possessionTeamId?: 'user' | 'opponent';
  ball: PitchPoint;
  ballCarrierId?: string;
  players: ReplayPlayerState[];
  passFromPlayerId?: string;
  passToPlayerId?: string;
  defensiveLine?: number;
  eventLabel?: string;
  relatedMatchEventId?: string;
  actionType?: ReplayActionType;
  isOfficialMatchEvent?: boolean;
}

export interface MatchReplay {
  matchId: string;
  durationSeconds: number;
  frames: ReplayFrame[];
}

// Segmenti d'azione: unita' narrativa intermedia tra "evento reale" e "frame disegnato".
// Ogni ReplayFrame puo' essere derivato concatenando questi segmenti (mai una seconda simulazione:
// solo una coreografia coerente di cio' che il motore di partita ha gia' deciso).
export type ReplayActionType =
  | 'short_pass'
  | 'progressive_pass'
  | 'through_ball'
  | 'cross'
  | 'dribble'
  | 'shot'
  | 'save'
  | 'goal'
  | 'clearance'
  | 'tackle'
  | 'interception'
  | 'pressing_trap'
  | 'foul'
  | 'free_kick'
  | 'free_kick_cross'
  | 'free_kick_shot'
  | 'penalty_awarded'
  | 'penalty_shot'
  | 'penalty_save'
  | 'penalty_missed'
  | 'offside'
  | 'restart'
  | 'whistle';

export interface ReplayActionSegment {
  id: string;
  type: ReplayActionType;
  startSecond: number;
  endSecond: number;
  teamId: 'user' | 'opponent';
  actorId?: string;
  targetPlayerId?: string;
  ballStart: PitchPoint;
  ballEnd: PitchPoint;
  ballControlPoint?: PitchPoint; // traiettoria curva (cross)
  playerMovements: { playerId: string; from: PitchPoint; to: PitchPoint }[];
  pressingPlayerIds?: string[];
  phase: ReplayPhase;
  eventLabel?: string;
  relatedMatchEventId?: string;
  // isOfficialMatchEvent=true solo se il segmento rappresenta un dato reale gia' deciso dal motore
  // (gol, cartellino). isVisualOnly=true per episodi di coreografia (fallo, punizione, rigore,
  // fuorigioco sintetici): non modificano MAI risultato, statistiche, cartellini o cronologia ufficiale.
  isOfficialMatchEvent: boolean;
  isVisualOnly: boolean;
}

// ─── Piano di possesso: da' a ogni sequenza di passaggi un intento tattico reale (mai passaggi sterili). ───
export type PossessionObjective =
  | 'build_attack'
  | 'break_lines'
  | 'attack_space'
  | 'overload_wide'
  | 'create_chance'
  | 'finish'
  | 'protect_lead'
  | 'escape_press'
  | 'counter_attack'
  | 'defend_transition';

export type PossessionOutcome =
  | 'shot'
  | 'cross'
  | 'chance_created'
  | 'turnover'
  | 'clearance'
  | 'offside'
  | 'foul'
  | 'restart'
  | 'goal';

export interface ReplayPossessionPlan {
  id: string;
  teamId: 'user' | 'opponent';
  objective: PossessionObjective;
  outcome: PossessionOutcome;
  startSecond: number;
  endSecond: number;
  direction: 'left' | 'right';
  progressionTarget: PitchPoint;
  maxPasses: number;
  relatedMatchEventId?: string;
  isOfficialMatchEvent: boolean;
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

// ─── Acquisto in due fasi (Market rivoluzionato): offerta al club, poi contratto al giocatore ───
// Stati legacy 'pending' | 'accepted' | 'rejected' vengono migrati a questi in normalizeNegotiation,
// mai letti direttamente altrove: nessun salvataggio vecchio resta bloccato su uno stato sconosciuto.
export type NegotiationStatus =
  | 'draft'
  | 'club_offer_sent'
  | 'club_offer_rejected'
  | 'club_counter_offer'
  | 'club_offer_accepted'
  | 'player_contract_negotiation'
  | 'player_contract_rejected'
  | 'player_counter_offer'
  // Mercato M3: dopo l'accordo col giocatore, prima di entrare in rosa.
  | 'player_contract_accepted'
  | 'medical_pending'
  | 'medical_warning'
  | 'medical_failed'
  | 'registration_pending'
  | 'registration_failed'
  | 'suspended_window_closed'
  | 'completed'
  | 'withdrawn'
  | 'expired';

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
  status: NegotiationStatus;
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
  // Fase 1: accordo col club (solo cartellino/bonus/clausola, mai stipendio).
  clubOfferFee?: number;
  clubOfferBonus?: number;
  clubAgreedFee?: number;
  // Fase 2: contratto col giocatore (aperta solo dopo club_offer_accepted).
  contractOfferAnnualSalary?: number;
  contractOfferYears?: number;
  contractOfferSigningBonus?: number;
  contractOfferAgentFee?: number;
  contractCounterAnnualSalary?: number;
  contractCounterYears?: number;
  concludedAt?: string;
  concludedKind?: 'purchase' | 'rejected' | 'withdrawn' | 'expired';
  // Mercato M1: termini reali dell'operazione (definitivo/rate, prestito secco/diritto/obbligo).
  terms?: TransferOfferTerms;
  clubCounterTerms?: TransferOfferTerms;
  // Mercato M2B: presente solo se questa trattativa e' uno scambio giocatore <-> giocatore.
  swapTerms?: PlayerSwapTerms;
  clubCounterSwapTerms?: PlayerSwapTerms;
  // Mercato M2C: presente solo se questa trattativa e' uno scambio di prestiti.
  loanSwapTerms?: LoanSwapTerms;
  // Mercato M3: finestra di mercato, visite mediche, registrazione. Termini contrattuali congelati
  // al momento dell'accordo col giocatore (sopravvivono a un F5 durante visite/registrazione).
  pendingContractSquadRole?: ContractSquadRole;
  medicalCheck?: TransferMedicalCheck;
  registrationFailureReason?: string;
  createdRound?: number;
  expiresAtRound?: number;
  lastUpdatedRound?: number;
  deadlineReason?: string;
  // Mercato M4: il giocatore vuole valutare il mercato prima di rispondere (mai un'attesa infinita:
  // resolvePlayerWaitingDecision la limita da sola). Presente solo mentre l'attesa e' in corso.
  playerWaitingReason?: string;
}

// ─── Mercato M3: finestra di mercato, visite mediche, registrazione ───

export type TransferWindowKind = 'summer' | 'winter';
export type TransferWindowStatus = 'upcoming' | 'open' | 'closing_soon' | 'closed';

export interface TransferWindowState {
  id: string;
  season: string;
  kind: TransferWindowKind;
  opensAtRound: number;
  closesAtRound: number;
  status: TransferWindowStatus;
}

export type MedicalCheckResult = 'pending' | 'passed' | 'warning' | 'failed';

export interface TransferMedicalCheck {
  transferId: string;
  playerId: string;
  status: MedicalCheckResult;
  startedRound: number;
  resolvedRound?: number;
  riskSummary?: string;
  reasons: string[];
  canProceed: boolean;
  processed: boolean;
}

// ─── Mercato M4: concorrenza tra club, aste, agenti/procuratori ───
// Solo per trattative di acquisto a titolo definitivo (mai prestiti/scambi/svincolati/precontratti):
// e' li' che "un altro club puo' rubarmi il giocatore" ha senso reale nel modello dati esistente.

export type TransferCompetitionStatus =
  | 'none'
  | 'monitored'
  | 'competing_clubs'
  | 'auction'
  | 'player_waiting'
  | 'user_outbid'
  | 'user_leading'
  | 'lost_to_other_club'
  | 'won';

export type CompetingClubBidStatus = 'watching' | 'considering' | 'bid_preparing' | 'bid_submitted' | 'withdrawn' | 'won' | 'lost';

export interface CompetingClubBid {
  id: string;
  clubId: string;
  clubName: string;

  offerValue: number;
  wagePower: number;
  projectAppeal: number;
  playerPreference: number;

  status: CompetingClubBidStatus;

  lastUpdatedRound: number;
  reasons: string[];
}

export interface TransferCompetitionState {
  negotiationId: string;
  playerId: string;

  status: TransferCompetitionStatus;
  competingBids: CompetingClubBid[];

  userBidRank: number;
  highestKnownOffer?: number;

  lastCompetitionRound?: number;
  nextEligibleCompetitionRound?: number;

  pressureLevel: number;
  reasons: string[];

  processedCompetitionEventIds: string[];
}

export type AgentArchetype = 'loyal' | 'pragmatic' | 'aggressive' | 'career_focused' | 'money_focused' | 'patient';

export interface PlayerAgentProfile {
  id: string;
  playerId: string;

  archetype: AgentArchetype;
  negotiationAggressiveness: number;
  commissionSensitivity: number;
  wageSensitivity: number;
  projectSensitivity: number;
  releaseClausePreference: number;
  patience: number;

  lastDemandRound?: number;
  processedAgentEventIds: string[];
}

// ─── Mercato M1: modello unico dell'operazione (definitivo/rate, prestito secco/diritto/obbligo) ───
// Un solo modello modulare per tutte le formule: cambia solo quali campi sono valorizzati, mai la
// struttura. Nessun tipo scollegato per formula.

export type TransferBaseType = 'permanent' | 'loan';

export type PurchaseClauseType = 'none' | 'option' | 'obligation';

export type ObligationCondition = 'unconditional' | 'appearances';

export interface TransferPaymentInstallment {
  id: string;
  amount: number;
  dueSeason: string;
  status: 'pending' | 'paid';
}

export interface TransferOfferTerms {
  baseType: TransferBaseType;
  purchaseClause: PurchaseClauseType; // per i prestiti; ignorato per il definitivo

  upfrontFee: number; // definitivo: cartellino immediato
  installments: TransferPaymentInstallment[]; // definitivo: max 3 rate opzionali

  loanFee?: number; // prestito: indennizzo
  loanEndSeason?: string; // prestito: fine stagione
  wageSharePercent?: 0 | 25 | 50 | 75 | 100; // prestito: quota stipendio a carico del mio club

  purchaseFee?: number; // prestito con diritto/obbligo: prezzo del riscatto

  obligationCondition?: ObligationCondition;
  requiredAppearances?: number;

  futureFinancialCommitment: number; // rate residue (definitivo) o prezzo obbligo (mai il diritto, facoltativo)

  // ─── Mercato M2A: clausola economica future, solo per baseType 'permanent', una sola per operazione ───
  futureClauseChoice?: FutureClauseChoice;
  futureClauseSellOnPercentage?: SellOnPercentage;
  futureClauseBuyBackFee?: number;
  futureClauseBuyBackDuration?: BuyBackDuration;

  // ─── Mercato M2C: clausola protettiva, solo per baseType 'permanent', una sola per operazione ───
  protectiveClauseChoice?: ProtectiveClauseChoice;
  protectiveClauseDuration?: ProtectiveClauseDuration;
  antiRivalMode?: AntiRivalClauseMode;
  antiRivalRestrictedClubIds?: string[];
  antiRivalRestrictedClubNames?: string[];
  antiRivalPenaltyPercent?: AntiRivalPenaltyPercent;
}

// ─── Mercato M2A: clausole future reali (percentuale rivendita/plusvalenza, contro-riscatto) ───
// Viaggiano con il giocatore (Player.sellOnClauses/buyBackClauses), mai duplicate su clubHistory.

export type FutureClauseChoice = 'none' | 'sell_on_gross' | 'sell_on_capital_gain' | 'buy_back';

export type SellOnPercentage = 0 | 5 | 10 | 15 | 20 | 25 | 30;

export type BuyBackDuration = 'current_season' | 'next_season' | 'two_seasons';

export type SellOnType = 'gross_sale' | 'capital_gain';

export interface SellOnClause {
  id: string;
  type: SellOnType;
  percentage: number;
  originalPurchaseFee: number; // prezzo pagato nell'operazione che ha creato la clausola (base plusvalenza)
  beneficiaryClubId: string;
  beneficiaryClubName: string;
  createdSeason: string;
  expirySeason?: string;
  status: 'active' | 'triggered' | 'expired';
  triggeredAtTransferId?: string;
}

export interface BuyBackClause {
  id: string;
  holderClubId: string; // club titolare del diritto di riacquisto
  holderClubName: string;
  playerId: string;
  buyBackFee: number;
  createdSeason: string;
  expirySeason: string; // etichetta leggibile (es. "2028/29")
  // Soglia reale di scadenza: confrontata con TeamDNAState.seasonsTracked del club titolare alla
  // transizione di fine stagione (unico contatore stagionale gia' incrementato in modo affidabile
  // in questo progetto, a differenza della stringa stagione che resta fissa fuori dal leagueSystem).
  expiresAtSeasonsTracked: number;
  status: 'active' | 'exercised' | 'expired' | 'waived';
}

// ─── Mercato M2B: scambi giocatori, svincolati, precontratti ───
// Estende il modello trattative esistente (Negotiation/TransferOfferTerms), non lo sostituisce.

export type AdvancedDealKind = 'player_swap' | 'free_agent' | 'precontract';

export type SwapCashDirection = 'user_club' | 'other_club' | 'none';

export type PlayerSwapStatus = 'club_negotiation' | 'clubs_agreed' | 'waiting_player_decisions' | 'completed' | 'failed';

// Termini dello scambio: il giocatore "in entrata" e' gia' descritto dalla Negotiation stessa
// (playerName/currentClub/value); questi termini descrivono solo il MIO giocatore offerto e l'eventuale
// conguaglio. Un solo giocatore per lato in questa fase (mai scambi multipli).
export interface PlayerSwapTerms {
  offeredPlayerId: string;
  offeredPlayerName: string;
  cashAdjustment: number;
  cashPaidBy: SwapCashDirection;
  estimatedPlayerValue?: number;
  status: PlayerSwapStatus;
}

export type FutureContractAgreementStatus = 'active' | 'completed' | 'cancelled' | 'failed';

// Precontratto: accordo reale per la stagione successiva. Non tocca rosa/budget/clubHistory finche'
// non viene processato al punto sicuro di fine stagione (stesso schema di PlayerLoanState/BuyBackClause).
export interface FutureContractAgreement {
  id: string;
  playerId: string;
  playerName: string;
  currentClubId: string;
  currentClubName: string;

  agreedAtSeason: string;
  effectiveSeason: string;

  annualSalary: number;
  durationYears: number;
  squadRole: ContractSquadRole;
  bonuses: PlayerContractBonuses;

  signingBonus: number;
  agentFee: number;

  status: FutureContractAgreementStatus;
  processedAtSeason?: string;
}

// Stato di un giocatore attualmente in prestito nella mia rosa: conserva il club proprietario,
// non viene mai trattato come acquisto definitivo finche' diritto/obbligo non si attivano davvero.
export interface PlayerLoanState {
  parentClubId: string;
  parentClubName: string;
  receivingClubId: string;
  startSeason: string;
  endSeason: string;
  wageSharePercent: number;
  // Stipendio settimanale pieno (a carico del club proprietario) prima della quota: necessario per
  // ricostruire un contratto reale se l'obbligo di riscatto si attiva a fine stagione.
  originalWeeklyWage: number;

  purchaseClause: PurchaseClauseType;
  purchaseFee?: number;

  obligationCondition?: ObligationCondition;
  requiredAppearances?: number;
  obligationTriggered?: boolean;

  processedSeasonEnd?: boolean;
  // Mercato M2C: presente solo se questo prestito fa parte di uno scambio di prestiti (LoanSwapTerms.id).
  loanSwapId?: string;
}

// ─── Mercato M2C: prelazione, clausole anti-rivali, scambio di prestiti ───
// Estende i modelli M1/M2A/M2B gia' esistenti, non li sostituisce.

export type FirstRefusalStatus = 'active' | 'expired' | 'exercised';

// Diritto di prelazione: il titolare puo' eguagliare una futura offerta reale prima della cessione.
// Mai un contro-riscatto: il prezzo non e' fissato ora, dipende dall'offerta futura reale.
export interface FirstRefusalClause {
  id: string;
  playerId: string;
  holderClubId: string;
  holderClubName: string;
  createdSeason: string;
  expirySeason: string;
  expiresAtSeasonsTracked: number; // soglia reale (stesso schema di BuyBackClause)
  status: FirstRefusalStatus;
  processedTriggerIds: string[]; // max 10, anti-doppia-attivazione
}

export type FirstRefusalTriggerStatus =
  | 'pending'
  | 'holder_exercising'
  | 'holder_waived'
  | 'holder_failed_contract'
  | 'superseded'
  | 'expired';

export interface FirstRefusalTrigger {
  id: string;
  clauseId: string;
  playerId: string;
  currentOwnerClubId: string;
  proposedBuyerClubId: string;
  sourceOfferId: string;
  matchedTermsSnapshot: TransferOfferTerms;
  createdRound: number;
  deadlineRound: number;
  status: FirstRefusalTriggerStatus;
}

export type AntiRivalClauseMode = 'block' | 'penalty';

export const ANTI_RIVAL_PENALTY_PERCENTAGES = [10, 15, 20, 25, 30] as const;
export type AntiRivalPenaltyPercent = typeof ANTI_RIVAL_PENALTY_PERCENTAGES[number];

export interface AntiRivalTransferClause {
  id: string;
  playerId: string;
  beneficiaryClubId: string;
  beneficiaryClubName: string;
  restrictedClubIds: string[]; // max 3
  restrictedClubNames: string[];
  mode: AntiRivalClauseMode;
  penaltyPercent?: AntiRivalPenaltyPercent;
  createdSeason: string;
  expirySeason: string;
  expiresAtSeasonsTracked: number;
  status: 'active' | 'expired';
  processedTransferIds: string[]; // max 10, anti-doppio-conteggio penale
}

// Scelta unica di clausola protettiva M2C nel form offerta: al massimo una per operazione,
// distinta dalla clausola economica M2A (sell-on/plusvalenza/contro-riscatto).
export type ProtectiveClauseChoice = 'none' | 'first_refusal' | 'anti_rival';
export type ProtectiveClauseDuration = 'current_season' | 'next_season' | 'two_seasons';

export type LoanSwapStatus = 'club_negotiation' | 'clubs_agreed' | 'waiting_player_decisions' | 'active' | 'completed' | 'failed';

// Scambio di prestiti: un giocatore per lato, mai cartellino/conguaglio/rate/diritto/obbligo.
export interface LoanSwapTerms {
  id: string;
  userOutgoingPlayerId: string;
  userOutgoingPlayerName: string;
  otherClubOutgoingPlayerId: string;
  otherClubId: string;
  otherClubName: string;
  userPaysIncomingWageSharePercent: 0 | 25 | 50 | 75 | 100;
  otherClubPaysIncomingWageSharePercent: 0 | 25 | 50 | 75 | 100;
  startSeason: string;
  endSeason: string;
  status: LoanSwapStatus;
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

// ─── Career World: External World Persistence ───

export type FanGroupKey = 'curva' | 'tradizionali' | 'locali' | 'occasionali' | 'sponsor';
export type FanGroupTrend = 'positivo' | 'stabile' | 'negativo';

export interface FanGroupState {
  key: FanGroupKey;
  label: string;
  mood: number; // 0-100
  patience: number; // 0-100
  influence: number; // 0-100
  lastReaction?: string;
  priorities: string[];
  recentReasons: string[]; // max 3, most recent first
  trend: FanGroupTrend;
  updatedAt: string;
}

export type PlayerFanStatus =
  | 'idolo_curva'
  | 'molto_amato'
  | 'apprezzato'
  | 'neutrale'
  | 'sotto_osservazione'
  | 'criticato'
  | 'contestato'
  | 'simbolo_club';

export interface PlayerFanStanding {
  playerId: string;
  affection: number; // 0-100
  criticism: number; // 0-100
  status: PlayerFanStatus;
  recentReasons: string[]; // max 3, most recent first
  lastUpdatedAt: string;
  isAcademyOrLocal: boolean;
  isClubLegendCandidate: boolean;
  isFanFavorite: boolean;
  isUnderPressure: boolean;
}

export interface FanState {
  overallMood: number; // 0-100
  groups: FanGroupState[];
  recentReactions: string[];
  mostLovedPlayerIds: string[];
  mostCriticizedPlayerIds: string[];
  lastMoodChange: number; // signed delta applied by the last processed match
  playerStandings: PlayerFanStanding[];
}

export type OwnershipType = 'famiglia' | 'fondo' | 'magnate' | 'azionariato' | 'gruppo_industriale';

export type OwnershipObjectiveCategory = 'sportivo' | 'identitario' | 'economico';
export type OwnershipObjectiveStatus = 'in_corso' | 'positivo' | 'a_rischio' | 'completato' | 'fallito';

export interface OwnershipObjective {
  id: string;
  title: string;
  description: string;
  category: OwnershipObjectiveCategory;
  importance: number; // 0-100
  progress: number; // 0-100
  status: OwnershipObjectiveStatus;
  reason: string;
  updatedAt: string;
}

export interface OwnershipState {
  ownerType: OwnershipType;
  ambition: number; // 0-100
  patience: number; // 0-100
  liquidity: number; // 0-100
  prudence: number; // 0-100
  boardConfidence: number; // 0-100
  financialStatus: 'solido' | 'equilibrato' | 'in_tensione' | 'critico';
  currentObjectives: OwnershipObjective[];
  lastConfidenceChange: number; // signed delta applied by the last processed match
  lastReactionNote: string;
}

export type CareerWorldEventType = 'match_result' | 'transfer_reaction';

export interface CareerWorldEvent {
  id: string;
  date: string;
  season: string;
  type: CareerWorldEventType;
  title: string;
  description: string;
  importance: number; // 0-100
  relatedMatchId?: string;
  relatedPlayerIds?: string[];
  fanMoodChange: number;
  boardConfidenceChange: number;
  reasons: string[];
  isRead: boolean;
  isHistorical: boolean;
}

// ─── Media & Press Conferences (Fase 6A) ───

export type JournalistArchetype = 'tactical' | 'polemical' | 'transfer_expert' | 'romantic' | 'local_reporter';

export interface Journalist {
  id: string;
  archetype: JournalistArchetype;
  name: string;
  outlet: string;
  toneNote: string;
  respect: number; // 0-100, grows/shrinks only via press conference answers
}

export type MediaArticleCategory =
  | 'derby'
  | 'big_match'
  | 'emotional_story'
  | 'young_hero'
  | 'heavy_defeat'
  | 'surprise_result'
  | 'transfer_rival'
  | 'transfer_idol_sale'
  | 'transfer_big_buy'
  | 'ownership_objective'
  | 'rumor_update';

export interface MediaArticle {
  id: string;
  date: string;
  season: string;
  journalistId: string;
  category: MediaArticleCategory;
  title: string;
  body: string;
  importance: number; // 0-100
  relatedMatchId?: string;
  relatedTransferId?: string;
  relatedPlayerIds?: string[];
}

export type PressConferenceTrigger =
  | 'derby'
  | 'strong_rivalry'
  | 'painful_sale'
  | 'broken_promise'
  | 'criticized_player'
  | 'low_board_confidence'
  | 'objective_at_risk'
  | 'emotional_narrative'
  | 'market_rumor';

export type PressConferenceTone = 'diplomatico' | 'aggressivo' | 'difensivo' | 'onesto';

export interface PressConferenceOption {
  id: string;
  label: string;
  tone: PressConferenceTone;
  fanMoodEffect: number;
  boardConfidenceEffect: number;
  journalistRespectEffect: number;
  previewNote: string;
}

export interface PressConference {
  id: string;
  createdAt: string;
  season: string;
  round: number;
  journalistId: string;
  trigger: PressConferenceTrigger;
  question: string;
  context: string;
  options: PressConferenceOption[];
  status: 'pending' | 'resolved';
  chosenOptionId?: string;
  resolvedAt?: string;
  relatedMatchId?: string;
  relatedTransferId?: string;
}

export type MarketRumorType =
  | 'player_unhappy'
  | 'playing_time_doubt'
  | 'promise_pressure'
  | 'club_interest'
  | 'possible_sale'
  | 'possible_purchase'
  | 'rival_interest'
  | 'fan_fear';

export type MarketRumorStatus = 'active' | 'confirmed' | 'denied' | 'expired';

export interface MarketRumor {
  id: string;
  createdAt: string;
  updatedAt: string;
  journalistId: string;
  type: MarketRumorType;
  status: MarketRumorStatus;
  confidence: number; // 0-100
  importance: number; // 0-100
  title: string;
  summary: string;
  playerId?: string;
  playerName?: string;
  relatedClubId?: string;
  relatedClubName?: string;
  relatedPromiseId?: string;
  relatedTransferId?: string;
  sourceId: string;
  reasons: string[];
  round: number; // giornata di creazione, usata per gli anti-spam
  season: string;
  expiresAfterRound?: number;
}

export interface MediaState {
  journalists: Journalist[];
  articles: MediaArticle[]; // max 20, most recent first
  pendingConference: PressConference | null;
  lastConferenceRound: number | null;
  lastProcessedMatchIds: string[];
  lastProcessedTransferIds: string[];
  marketRumors: MarketRumor[]; // max 30 salvati, max 10 attivi
  lastRumorRound: number | null;
  lastProcessedRumorSourceIds: string[];
}

export interface CareerWorldState {
  clubId: string;
  fanState: FanState;
  ownershipState: OwnershipState;
  activeEvents: CareerWorldEvent[];
  historicalEvents: CareerWorldEvent[];
  lastProcessedMatchIds: string[];
  lastProcessedTransferIds: string[];
  mediaState: MediaState;
  clubStaffState: ClubStaffState;
  clubFacilitiesState: ClubFacilitiesState;
  clubWageBudgetState: ClubWageBudgetState;
  youthAcademyState: YouthAcademyState;
  outgoingMarketState: OutgoingMarketState;
  // Mercato M2B: precontratti attivi/conclusi, mai duplicati (max 40 conservati, guardia status/processedAtSeason).
  futureContractAgreements: FutureContractAgreement[];
  // Mercato M2C: trigger di prelazione pendenti/risolti (max 30 conservati, guardia sullo status).
  firstRefusalTriggers: FirstRefusalTrigger[];
  transferWindows: TransferWindowState[]; // Mercato M3
  transferCompetitions: TransferCompetitionState[]; // Mercato M4
  playerAgentProfiles: PlayerAgentProfile[]; // Mercato M4
  createdAt: string;
  updatedAt: string;
}

// ─── Emotional Narratives: rare, contextual career stories ───

export type EmotionalNarrativeType = 'underdog_run' | 'unexpected_hero' | 'heroic_defeat' | 'redemption_arc';

export type EmotionalNarrativeStage = 'nascente' | 'in_crescita' | 'culmine' | 'in_dissolvenza' | 'leggenda';

export type EmotionalNarrativeStatus = 'attiva' | 'conclusa' | 'storica';

export interface EmotionalNarrativeMoment {
  id: string;
  round: number;
  matchId?: string;
  dateLabel: string;
  title: string;
  description: string;
}

export interface EmotionalNarrative {
  id: string;
  type: EmotionalNarrativeType;
  club: string;
  playerId?: string;
  playerName?: string;
  season: string;
  title: string;
  description: string;
  stage: EmotionalNarrativeStage;
  importance: number; // 0-100
  status: EmotionalNarrativeStatus;
  reasons: string[];
  relatedMatchIds: string[];
  moments: EmotionalNarrativeMoment[];
  consequencesApplied: string[];
  createdRound: number;
  updatedAt: string;
}

export interface PlayerPublicProfile {
  playerId: string;
  playerName: string;
  popularity: number; // 0-100
  mediaAttention: number; // 0-100
  followersEstimate: number; // simulated narrative-only indicator, not a real social metric
  narrativeTitles: string[];
  activeNarrativeIds: string[];
  iconicMoments: EmotionalNarrativeMoment[];
  updatedAt: string;
}

export interface MatchEmotionalImpact {
  matchId: string;
  round: number;
  score: number; // 0-100 overall emotional weight of the match
  matchImportance: number; // 0-100 stakes of the fixture
  strengthGap: number; // opponent rating - own rating
  isUpset: boolean;
  isHeroicDefeat: boolean;
  isComeback: boolean;
  reasons: string[];
}

export interface EmotionalNarrativeState {
  narratives: EmotionalNarrative[];
  playerProfiles: PlayerPublicProfile[];
  lastMajorNarrativeRound: number;
  updatedAt: string;
}

// ─── Player Conversations: locally-generated (or optionally AI-assisted) dialogue with the squad ───

export type PlayerDialogueCommunicationStyle =
  | 'veteran_professional'
  | 'ambitious_talent'
  | 'selfish_star'
  | 'shy_youngster'
  | 'club_flag'
  | 'frustrated_reserve'
  | 'balanced';

export type PlayerConversationTopic =
  | 'playing_time'
  | 'project_role'
  | 'promise'
  | 'match_reaction'
  | 'morale'
  | 'training'
  | 'injury_return'
  | 'transfer_interest'
  | 'contract_expectation'
  | 'team_conflict';

export type PlayerConversationStatus = 'open' | 'resolved' | 'archived';
export type PlayerConversationTone = 'calm' | 'direct' | 'frustrated' | 'grateful' | 'confident' | 'reserved';
export type PlayerConversationIntent = 'request' | 'complaint' | 'gratitude' | 'clarification' | 'response';
export type PlayerConversationSender = 'manager' | 'player' | 'system';

export interface PlayerDialoguePersona {
  playerId: string;
  communicationStyle: PlayerDialogueCommunicationStyle;
  formality: number; // 0-100
  directness: number; // 0-100
  emotionality: number; // 0-100
  confidence: number; // 0-100
  patience: number; // 0-100
  loyalty: number; // 0-100
  ambition: number; // 0-100
  ego: number; // 0-100
  leadership: number; // 0-100
  humor: number; // 0-100
  conflictTendency: number; // 0-100
  messageLength: number; // 0-100, short..long
  speechSeed: number;
  preferredTopics: PlayerConversationTopic[];
  dislikedTopics: PlayerConversationTopic[];
}

export interface PlayerConversationMessage {
  id: string;
  sender: PlayerConversationSender;
  text: string;
  createdAt: string;
  tone: PlayerConversationTone;
  intent: PlayerConversationIntent;
  isImportant: boolean;
  relatedActionId?: string;
}

export interface PlayerConversationMemory {
  id: string;
  text: string;
  createdAt: string;
}

export interface PlayerConversation {
  id: string;
  playerId: string;
  createdAt: string;
  updatedAt: string;
  status: PlayerConversationStatus;
  topic: PlayerConversationTopic;
  messages: PlayerConversationMessage[];
  summary: string;
  memory: PlayerConversationMemory[];
  unreadForManager: boolean;
  unreadForPlayer: boolean;
  lastPlayerInitiatedAt?: string;
  lastManagerMessageAt?: string;
  relatedPromiseId?: string;
  relatedEventId?: string;
  relatedMatchId?: string;
  importance: number; // 0-100
  sentiment: number; // 0-100, player's current disposition in this thread
}

export interface PlayerDialogueQuickReply {
  label: string;
  tone: 'supportive' | 'firm' | 'cautious' | 'ambitious';
  action: string;
}

export interface PlayerDialogueResponse {
  playerMessage: string;
  tone: PlayerConversationTone;
  intent: PlayerConversationIntent;
  memoryCandidate?: string;
  suggestedReplies: PlayerDialogueQuickReply[];
}

// ─── Sistema multi-divisione: Serie A / Serie B ───

export type CompetitionId = 'serie_a' | 'serie_b';

export interface PromotionRelegationRules {
  directPromotions: number; // Serie B: 2 (1a e 2a); Serie A non promuove
  directRelegations: number; // Serie A: 3 (18a,19a,20a); Serie B: 3 verso Serie C astratta
  playoffZone: [number, number]; // Serie B: [3,8] inclusi, promozione playoff
  playoffAutoPromoteGapPoints: number; // 3a promossa diretta se il distacco dalla 4a supera questa soglia
  playoutZone: [number, number]; // Serie B: [16,17]
  playoutMaxGapPoints: number; // playout solo se il distacco tra le due è entro questa soglia
}

export interface CompetitionDefinition {
  id: CompetitionId;
  name: string;
  shortName: string;
  tier: 1 | 2;
  clubIds: string[];
  season: string;
  rounds: number;
  promotionRules: PromotionRelegationRules;
}

export interface CompetitionFixture {
  id: string;
  round: number;
  homeClubId: string;
  homeClubName: string;
  awayClubId: string;
  awayClubName: string;
  homeGoals?: number;
  awayGoals?: number;
  played: boolean;
}

export type PostseasonStage = 'playoff_preliminary' | 'playoff_semifinal' | 'playoff_final' | 'playout';

export interface PostseasonLeg {
  leg: 1 | 2;
  hostClubId: string;
  hostClubName: string;
  guestClubId: string;
  guestClubName: string;
  homeGoals?: number;
  awayGoals?: number;
  played: boolean;
  matchId?: string; // collegato a un Match reale se il club utente ha giocato questa gara nel MatchCenter
}

export interface PostseasonTie {
  id: string;
  stage: PostseasonStage;
  homeClubId: string; // meglio classificata nella regular season: ritorno in casa sua
  homeClubName: string;
  awayClubId: string;
  awayClubName: string;
  legs: PostseasonLeg[];
  winnerClubId?: string;
  resolved: boolean;
  tieBreakNote?: string; // spiega esplicitamente perché ha vinto in caso di parità
}

export interface PostseasonState {
  type: 'playoff' | 'playout';
  season: string;
  ties: PostseasonTie[];
  promotedClubId?: string; // esito playoff
  relegatedClubId?: string; // esito playout
  completed: boolean;
}

export interface CompetitionSeasonState {
  competitionId: CompetitionId;
  season: string;
  calendar: Match[]; // vista dal club utente, popolata solo se il suo club milita in questa competizione
  standings: Standing[];
  fixtures: CompetitionFixture[]; // calendario completo a girone di andata/ritorno, fonte di verità per la simulazione
  completedRound: number;
  status: 'regular_season' | 'playoff' | 'playout' | 'completed';
  postseason?: PostseasonState;
}

export interface SeasonTransitionSummary {
  previousSeason: string;
  newSeason: string;
  serieAChampion?: string;
  serieBChampion?: string;
  promotedToSerieA: string[]; // clubId, da Serie B (diretta + vincitrice playoff)
  relegatedToSerieB: string[]; // clubId, da Serie A
  promotedToSerieB: string[]; // clubId, dai feeder Serie C astratta
  relegatedToSerieC: string[]; // clubId, da Serie B (diretta + perdente playout)
  userClubDivision: CompetitionId;
  userClubMovedDivision: boolean;
}

export interface LeagueSystemState {
  season: string;
  competitions: Record<CompetitionId, CompetitionSeasonState>;
  clubCompetitionMap: Record<string, CompetitionId>; // clubId -> competizione attuale
  serieCFeederPoolIds: string[]; // pool persistente di club feeder (Serie C astratta, non giocabile)
  lastPromotedFromSerieC: string[]; // ultimi 4 clubId promossi, per rotazione deterministica
  seasonTransition?: SeasonTransitionSummary; // riepilogo dell'ultimo cambio stagione, per la UI
}

export interface RosterSourceStatus {
  clubId: string;
  season: '2025/26';
  verifiedPlayerCount: number;
  minimumRequired: number;
  status: 'complete' | 'partial' | 'missing';
  sourceType: 'official' | 'local_verified' | 'missing';
}

export interface PlayerConversationState {
  personas: PlayerDialoguePersona[];
  conversations: PlayerConversation[];
  lastImportantMessageRoundByPlayer: Record<string, number>;
  updatedAt: string;
}
