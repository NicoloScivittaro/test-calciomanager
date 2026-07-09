import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Info, Send, RotateCw, Eye, FileSignature, Database, ArrowLeftRight, X } from 'lucide-react';
import { CareerWorldState, ClubAIState, ClubHistoryState, ClubMemoryDraft, ClubProfile, IncomingTransferOffer, Player, Negotiation, NegotiationStatus, PlayerSeasonStat, Tactic, TeamDNAState, ContractPromiseType, ContractSquadRole, TransferBaseType, TransferOfferTerms, TransferPaymentInstallment, PurchaseClauseType, ObligationCondition, TransferAvailability, FutureClauseChoice, SellOnPercentage, BuyBackDuration, BuyBackClause, PlayerSwapTerms, PlayerSwapStatus, SwapCashDirection, FutureContractAgreement, ProtectiveClauseChoice, ProtectiveClauseDuration, AntiRivalClauseMode, AntiRivalPenaltyPercent, ANTI_RIVAL_PENALTY_PERCENTAGES, LoanSwapTerms, LoanSwapStatus, FirstRefusalClause, FirstRefusalTrigger, TransferMedicalCheck } from '../../types';
import {
  AVAILABILITY_LABELS,
  getEffectiveAvailability,
  getOutgoingMarketSummary,
  getPlayerTransferWillingness,
  predictOfferAcceptance,
  resolvePlayerDecisionOnOffer
} from '../../utils/outgoingMarket';
import {
  applySignedContract,
  calculateClubWageBudget,
  calculateContractFinancialImpact,
  evaluateContractOffer,
  getPlayerContractDemand,
  getWageBudgetStatusLabel,
  inferContractSquadRole,
  toAnnualSalary,
  toWeeklyWage
} from '../../utils/playerContracts';
import {
  MAX_INSTALLMENTS,
  TRANSFER_BASE_TYPE_LABELS,
  PURCHASE_CLAUSE_LABELS,
  OBLIGATION_CONDITION_LABELS,
  calculateFutureFinancialCommitment,
  calculateImmediateCost,
  validateTransferTerms,
  computeClubAppealFromTerms,
  buildLoanState,
  buildLoanContract,
  getLoanWeeklyWage,
  SELL_ON_PERCENTAGE_OPTIONS,
  FUTURE_CLAUSE_CHOICE_LABELS,
  SELL_ON_TYPE_LABELS,
  BUYBACK_DURATION_LABELS,
  createSellOnClause,
  createBuyBackClause,
  applySellOnOnSale,
  SWAP_CASH_DIRECTION_LABELS,
  evaluateSwapAppeal,
  pickSwapCounterPlayer,
  resolveSwapOutgoingConsent,
  finalizeSwapTransfer,
  isFreeAgent,
  isPrecontractEligible,
  createFutureContractAgreement,
  PROTECTIVE_CLAUSE_CHOICE_LABELS,
  ANTI_RIVAL_MODE_LABELS,
  getRecognizedRivalClubNames,
  createFirstRefusalClause,
  createFirstRefusalTrigger,
  evaluateFirstRefusalAIDecision,
  createAntiRivalClause,
  checkAntiRivalRestriction,
  applyAntiRivalPenaltyOnSale,
  evaluateLoanSwapAppeal,
  createLoanSwapTerms,
  finalizeLoanSwapTransfer,
  returnLoanSwapPlayersHome,
  runMedicalCheck,
  combineMedicalChecks,
  evaluateRegistrationReadiness,
  getActiveTransferWindow,
  isTransferWindowOpen,
  isMarketWindowRestrictedTarget,
  computeNegotiationDeadline,
  isCompetitionEligibleNegotiation,
  ensurePlayerAgentProfile,
  processAgentReaction,
  resolvePlayerWaitingDecision,
  getTransferCompetitionSummary,
  COMPETITION_STATUS_LABELS,
  AGENT_ARCHETYPE_LABELS
} from '../../utils/transferDeals';
import { getClubByName } from '../../data/serieAData';
import { createRealReplacementTargets, replaceSoldPlayerForClub } from '../../utils/clubAI';
import {
  advanceScouting,
  getMarketFitScore,
  getPromiseLabel,
  getRealPlayerForTarget,
  getScoutReliabilityLabel,
  NEGOTIATION_STATUS_LABELS,
  normalizeNegotiations,
  normalizeNegotiation
} from '../../utils/marketIntelligence';
import { buildPurchaseMemory } from '../../utils/marketConsequences';
import { buildPlayerStamina } from '../../utils/playerFitness';
import { buildCareerMemory, buildPlayerPersonality, buildPlayerRelationships } from '../../utils/playerPersonality';
import { getPlayerProjectRole } from '../../utils/playerProjectRole';
import { getDNAMarketAdjustment } from '../../utils/teamDNA';
import { isAcademyOrLocalPlayer, processCareerWorldAfterTransfer } from '../../utils/careerWorld';
import { getClubStaffModifiers } from '../../utils/staff';
import { applyFacilityBonusToStaffModifiers } from '../../utils/facilities';
import { applyPlayerTransferToClubHistory, applyRivalryTransferImpact } from '../../utils/clubHistory';
import { MarketRumorPlayerSignal, processMarketRumorsAfterTransfer, processMediaAfterTransfer, resolveMarketRumorsAfterTransfer } from '../../utils/mediaEngine';
import ClubInfoModal from '../common/ClubInfoModal';
import PlayerProfileModal from '../common/PlayerProfileModal';
import { ModalPortal, useModalBehavior } from '../common/BaseModal';

const resolveClubId = (clubName: string): string => (
  getClubByName(clubName)?.id ?? clubName.toLowerCase().replace(/[^a-z0-9]+/gi, '_')
);

interface MarketProps {
  clubProfile: ClubProfile;
  scoutedTargets: Negotiation[];
  setScoutedTargets: (targets: Negotiation[]) => void;
  budget: number;
  setBudget: (b: number) => void;
  players: Player[];
  setPlayers: (p: Player[]) => void;
  starters: string[];
  bench: string[];
  setStarters: (ids: string[]) => void;
  setBench: (ids: string[]) => void;
  teamName: string;
  addNewNews: (title: string, content: string, cat: 'board' | 'training' | 'market' | 'league') => void;
  addClubMemory: (memory: ClubMemoryDraft) => void;
  teamDNA: TeamDNAState;
  onTransferDNAEvent: (player: Player, type: 'buy' | 'sell', fee: number) => void;
  clubWorld: ClubAIState[];
  setClubWorld: (world: ClubAIState[]) => void;
  incomingOffers: IncomingTransferOffer[];
  setIncomingOffers: (offers: IncomingTransferOffer[]) => void;
  playerStats: PlayerSeasonStat[];
  clubHistory: ClubHistoryState;
  setClubHistory: React.Dispatch<React.SetStateAction<ClubHistoryState>>;
  currentRound: number;
  careerWorld: CareerWorldState;
  setCareerWorld: React.Dispatch<React.SetStateAction<CareerWorldState>>;
  tactic: Tactic | null;
}

type MarketTab = 'trattative' | 'database';

const ACTIVE_STATUSES: Negotiation['status'][] = [
  'club_offer_sent', 'club_counter_offer', 'club_offer_accepted',
  'player_contract_negotiation', 'player_counter_offer',
  // Mercato M3: dopo l'accordo col giocatore, prima dell'ingresso in rosa.
  'player_contract_accepted', 'medical_pending', 'medical_warning', 'registration_pending'
];
const CONCLUDED_STATUSES: Negotiation['status'][] = [
  'completed', 'club_offer_rejected', 'player_contract_rejected', 'withdrawn', 'expired',
  'medical_failed', 'registration_failed', 'suspended_window_closed'
];

export default function Market({
  clubProfile,
  scoutedTargets,
  setScoutedTargets,
  budget,
  setBudget,
  players,
  setPlayers,
  starters,
  bench,
  setStarters,
  setBench,
  teamName,
  addNewNews,
  addClubMemory,
  teamDNA,
  onTransferDNAEvent,
  clubWorld,
  setClubWorld,
  incomingOffers,
  setIncomingOffers,
  playerStats,
  clubHistory,
  setClubHistory,
  currentRound,
  careerWorld,
  setCareerWorld,
  tactic
}: MarketProps) {
  const [marketTab, setMarketTab] = useState<MarketTab>('trattative');

  // ─ Fase 1: offerta al club (cartellino/rate o prestito con termini reali, mai stipendio qui) ─
  const [biddingPlayer, setBiddingPlayer] = useState<Negotiation | null>(null);
  const [offerBaseType, setOfferBaseType] = useState<TransferBaseType>('permanent');
  const [offerUpfrontFee, setOfferUpfrontFee] = useState<string>('');
  const [offerInstallments, setOfferInstallments] = useState<TransferPaymentInstallment[]>([]);
  const [offerLoanFee, setOfferLoanFee] = useState<string>('0');
  const [offerWageShare, setOfferWageShare] = useState<0 | 25 | 50 | 75 | 100>(50);
  const [offerPurchaseClause, setOfferPurchaseClause] = useState<PurchaseClauseType>('none');
  const [offerPurchaseFee, setOfferPurchaseFee] = useState<string>('');
  const [offerObligationCondition, setOfferObligationCondition] = useState<ObligationCondition>('unconditional');
  const [offerRequiredAppearances, setOfferRequiredAppearances] = useState<string>('15');
  // Mercato M2A: clausola futura facoltativa, solo per trasferimento definitivo, una sola per operazione.
  const [offerFutureClauseChoice, setOfferFutureClauseChoice] = useState<FutureClauseChoice>('none');
  const [offerFutureClauseSellOnPercentage, setOfferFutureClauseSellOnPercentage] = useState<SellOnPercentage>(10);
  const [offerFutureClauseBuyBackFee, setOfferFutureClauseBuyBackFee] = useState<string>('');
  const [offerFutureClauseBuyBackDuration, setOfferFutureClauseBuyBackDuration] = useState<BuyBackDuration>('next_season');
  // Mercato M2B: scambio giocatori, formula reale alternativa al cartellino per il trasferimento definitivo.
  const [offerIsSwap, setOfferIsSwap] = useState(false);
  const [swapOfferedPlayerId, setSwapOfferedPlayerId] = useState<string>('');
  const [swapCashAdjustment, setSwapCashAdjustment] = useState<string>('0');
  const [swapCashPaidBy, setSwapCashPaidBy] = useState<SwapCashDirection>('none');
  // Mercato M2C: clausola protettiva facoltativa (prelazione o anti-rivale), indipendente dalla
  // clausola economica M2A: al massimo una per operazione, ma le due categorie possono coesistere.
  const [offerProtectiveClauseChoice, setOfferProtectiveClauseChoice] = useState<ProtectiveClauseChoice>('none');
  const [offerProtectiveClauseDuration, setOfferProtectiveClauseDuration] = useState<ProtectiveClauseDuration>('next_season');
  const [offerAntiRivalMode, setOfferAntiRivalMode] = useState<AntiRivalClauseMode>('block');
  const [offerAntiRivalClubNames, setOfferAntiRivalClubNames] = useState<string[]>([]);
  const [offerAntiRivalPenaltyPercent, setOfferAntiRivalPenaltyPercent] = useState<AntiRivalPenaltyPercent>(15);
  // Mercato M2C: scambio di prestiti, terza formula alternativa quando offerBaseType === 'loan'.
  const [offerIsLoanSwap, setOfferIsLoanSwap] = useState(false);
  const [loanSwapOfferedPlayerId, setLoanSwapOfferedPlayerId] = useState<string>('');
  const [loanSwapUserPaysPercent, setLoanSwapUserPaysPercent] = useState<0 | 25 | 50 | 75 | 100>(50);
  const [loanSwapOtherPaysPercent, setLoanSwapOtherPaysPercent] = useState<0 | 25 | 50 | 75 | 100>(50);
  const [isSimulatingDeal, setIsSimulatingDeal] = useState(false);

  // ─ Fase 2: contratto al giocatore (permanente) o accettazione prestito (termini gia' fissati in fase 1) ─
  const [contractTarget, setContractTarget] = useState<Negotiation | null>(null);
  const [loanTarget, setLoanTarget] = useState<Negotiation | null>(null);
  const [contractWage, setContractWage] = useState<string>('');
  const [contractYears, setContractYears] = useState<number>(3);
  const [contractSigningBonus, setContractSigningBonus] = useState<string>('0');
  const [contractAgentFee, setContractAgentFee] = useState<string>('0');
  // Mercato M2B: precontratto (accordo per la stagione successiva, non tocca subito rosa/budget).
  const [precontractTarget, setPrecontractTarget] = useState<Negotiation | null>(null);
  const [precontractWage, setPrecontractWage] = useState<string>('');
  const [precontractYears, setPrecontractYears] = useState<number>(3);
  const [precontractSigningBonus, setPrecontractSigningBonus] = useState<string>('0');
  const [precontractAgentFee, setPrecontractAgentFee] = useState<string>('0');
  const [isProposingPrecontract, setIsProposingPrecontract] = useState(false);
  const [promiseType, setPromiseType] = useState<ContractPromiseType>('none');
  const [isNegotiatingContract, setIsNegotiatingContract] = useState(false);

  // UI Polish: Esc + blocco scroll per le modali di questa pagina (portal + centratura via CSS
  // .modal-backdrop/.modal-content, gia' corrette globalmente).
  useModalBehavior(!!biddingPlayer, () => setBiddingPlayer(null));
  useModalBehavior(!!contractTarget, () => setContractTarget(null));
  useModalBehavior(!!loanTarget, () => setLoanTarget(null));
  useModalBehavior(!!precontractTarget, () => setPrecontractTarget(null));

  const [playerSheet, setPlayerSheet] = useState<{ player: Player; mode: 'quick' | 'full' } | null>(null);
  const [selectedClubInfo, setSelectedClubInfo] = useState<ClubProfile | null>(null);
  const [playerToAddToOutgoing, setPlayerToAddToOutgoing] = useState<string>('');
  // Mercato M2A: clausola futura facoltativa quando VENDO (accetto un'offerta ricevuta), stessa scelta
  // del form d'acquisto ma beneficiario = il mio club. Un solo editor aperto alla volta.
  const [outgoingClauseOfferId, setOutgoingClauseOfferId] = useState<string | null>(null);
  const [outgoingClauseChoice, setOutgoingClauseChoice] = useState<FutureClauseChoice>('none');
  const [outgoingClauseSellOnPercentage, setOutgoingClauseSellOnPercentage] = useState<SellOnPercentage>(10);
  const [outgoingClauseBuyBackFee, setOutgoingClauseBuyBackFee] = useState<string>('');
  const [outgoingClauseBuyBackDuration, setOutgoingClauseBuyBackDuration] = useState<BuyBackDuration>('next_season');

  // ─ Database giocatori: ricerca/filtri/ordinamento ─
  const [dbSearch, setDbSearch] = useState('');
  const [dbRoleFilter, setDbRoleFilter] = useState('ALL');
  // Mercato M2B: filtro semplice per disponibilita reale (svincolati/in scadenza/in prestito/acquistabili).
  const [dbAvailabilityFilter, setDbAvailabilityFilter] = useState<'ALL' | 'FREE_AGENT' | 'EXPIRING' | 'ON_LOAN' | 'PURCHASABLE_ONLY'>('ALL');
  const [dbAgeMin, setDbAgeMin] = useState<number>(0);
  const [dbAgeMax, setDbAgeMax] = useState<number>(45);
  const [dbOverallMin, setDbOverallMin] = useState<number>(0);
  const [dbOverallMax, setDbOverallMax] = useState<number>(99);
  const [dbPotentialMin, setDbPotentialMin] = useState<number>(0);
  const [dbValueMin, setDbValueMin] = useState<number>(0);
  const [dbValueMax, setDbValueMax] = useState<number>(0); // 0 = nessun limite
  const [dbWageMax, setDbWageMax] = useState<number>(0); // 0 = nessun limite, €/settimana
  const [dbContractMaxYears, setDbContractMaxYears] = useState<number>(0); // 0 = nessun limite
  const [dbStatusFilter, setDbStatusFilter] = useState<'ALL' | Player['status']>('ALL');
  const [dbFootFilter, setDbFootFilter] = useState<'ALL' | 'Destro' | 'Sinistro' | 'Ambidestro'>('ALL');
  const [dbSustainableOnly, setDbSustainableOnly] = useState(false);
  const [dbDnaCompatibleOnly, setDbDnaCompatibleOnly] = useState(false);
  const [dbShowOwnRoster, setDbShowOwnRoster] = useState(false);
  const [dbShowAdvancedFilters, setDbShowAdvancedFilters] = useState(false);
  const [dbSortKey, setDbSortKey] = useState<'fit' | 'overall' | 'age' | 'value' | 'wage' | 'contract' | 'dna' | 'scout' | 'potential'>('fit');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const roleFamilyOf = (role: string) => (role === 'GK' ? 'GK' : /CB|LB|RB/.test(role) ? 'DF' : /DM|CM|AM/.test(role) ? 'MF' : 'FW');
  const roleContext = { starters, bench, seasonStats: playerStats, clubHistory, round: currentRound };
  const allKnownPlayers = [...players, ...clubWorld.flatMap(club => club.roster)];

  const findActiveRumorForSubject = (subjectId: string) => careerWorld.mediaState.marketRumors
    .filter(rumor => rumor.status === 'active' && rumor.playerId === subjectId)
    .sort((a, b) => b.importance - a.importance)[0];

  const rumorBadgeLabel = (rumor: { type: string; confidence: number }) => {
    if (rumor.confidence >= 75) return 'Trattativa calda';
    if (rumor.type === 'fan_fear') return 'Attenzione della curva';
    if (rumor.type === 'possible_sale' || rumor.type === 'club_interest' || rumor.type === 'rival_interest') return 'Futuro incerto';
    return 'Seguito dalla stampa';
  };

  const openPlayerSheet = (player?: Player | null) => {
    if (player) setPlayerSheet({ player, mode: 'quick' });
  };

  const findPlayerForOffer = (offer: IncomingTransferOffer) => (
    players.find(player => player.id === offer.playerId || player.name === offer.playerName)
  );

  const findPlayerForTarget = (target: Negotiation) => (
    getRealPlayerForTarget(target, clubWorld)
    ?? allKnownPlayers.find(player => player.name === target.playerName)
  );

  const openClubInfo = (name?: string) => {
    const club = getClubByName(name ?? '');
    if (club) setSelectedClubInfo(club);
  };

  const likelyCaptainId = [...players]
    .sort((a, b) => (b.morale + b.overall * 1.25) - (a.morale + a.overall * 1.25))[0]?.id;

  const isSquadLeader = (player: Player) => {
    const projectRole = getPlayerProjectRole(player, roleContext);
    return (
      player.id === likelyCaptainId
      || (starters.includes(player.id) && (player.overall >= 82 || player.morale >= 84))
      || projectRole.dressingRoomWeight >= 5
      || projectRole.key === 'fanSymbol'
    );
  };

  const getSaleMemoryProfile = (player: Player, buyerName?: string, fee?: number) => {
    const projectRole = getPlayerProjectRole(player, roleContext);
    const centralRole = ['untouchableStar', 'fanSymbol', 'futureCaptain', 'brokenPromise'].includes(projectRole.key);
    const leaderSale = isSquadLeader(player);
    const painfulSale = leaderSale || centralRole || projectRole.fanWeight >= 5 || projectRole.dressingRoomWeight >= 5;
    const cleanExit = projectRole.key === 'surplus' || projectRole.key === 'decliningVeteran';
    const profitableDeal = typeof fee === 'number' && fee >= player.value * 1.22 && !painfulSale;
    const buyerText = buyerName ? ` al ${buyerName}` : '';
    const baseImportance = painfulSale
      ? 66 + projectRole.tension * 0.18 + projectRole.trust * 0.12 + player.overall * 0.16
      : player.overall * 0.62 + projectRole.tension * 0.12 + (profitableDeal ? 8 : 0);

    return {
      projectRole,
      painfulSale,
      profitableDeal,
      title: painfulSale ? `Addio pesante: ${player.name}` : profitableDeal ? `Affare redditizio: ${player.name}` : cleanExit ? `Uscita concordata: ${player.name}` : `Cessione di ${player.name}`,
      description: painfulSale
        ? `${teamName} vende ${player.name}${buyerText}: era percepito come ${projectRole.label.toLowerCase()}, quindi la scelta lascia un segno su tifosi e spogliatoio.`
        : profitableDeal
          ? `${player.name} parte${buyerText}: il prezzo supera il valore tecnico percepito e la proprieta legge l'operazione come un affare.`
          : cleanExit
          ? `${player.name} lascia il club${buyerText}: era ${projectRole.label.toLowerCase()}, una separazione leggibile dentro il progetto.`
          : `${player.name} lascia il club${buyerText}: scelta utile per finanziare il progetto, con impatto limitato sul gruppo.`,
      importance: painfulSale ? clamp(baseImportance, 72, 94) : clamp(baseImportance, 42, 70),
      fanImpact: painfulSale
        ? clamp(-4 - Math.max(0, projectRole.fanWeight), -12, -2)
        : profitableDeal ? -1 : cleanExit ? 1 : player.age <= 22 ? -3 : 2,
      dressingRoomImpact: painfulSale
        ? clamp(-3 - Math.max(0, projectRole.dressingRoomWeight), -12, -2)
        : cleanExit ? 0 : -1,
      tags: [
        'cessione',
        painfulSale ? 'ferita-progetto' : cleanExit ? 'uscita-concordata' : 'rotazione',
        profitableDeal ? 'affare-redditizio' : '',
        projectRole.key,
        leaderSale ? 'leader' : '',
        player.id === likelyCaptainId ? 'capitano' : '',
        `player:${player.name}`
      ].filter((tag): tag is string => Boolean(tag))
    };
  };

  const hashRatio = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
    }
    return hash / 100000;
  };

  const estimateSignedPlayer = (target: Negotiation, offeredWage: number, years: number): Player => {
    const ageRoll = hashRatio(`${target.id}-age`);
    const age = target.value >= 38000000 ? 24 + Math.floor(ageRoll * 5) : 20 + Math.floor(ageRoll * 10);
    const valueOverall = Math.round(69 + Math.log10(Math.max(target.value, 1000000) / 1000000) * 7.4);
    const wageOverall = Math.round(70 + Math.log10(Math.max(offeredWage, 10000) / 10000) * 4.5);
    const overall = Math.max(72, Math.min(88, Math.round((valueOverall * 0.68 + wageOverall * 0.32))));
    const potentialBonus = age <= 21 ? 7 : age <= 24 ? 5 : age <= 27 ? 3 : 1;
    const basePlayer = {
      id: `signed_${Date.now()}`,
      name: target.playerName,
      role: target.role as Player['role'],
      age,
      nationality: 'Internazionale',
      overall,
      potential: Math.min(92, overall + potentialBonus)
    };
    const personality = buildPlayerPersonality(basePlayer, teamName, players.length);

    return {
      ...basePlayer,
      form: 7.0,
      morale: 92,
      condition: 100,
      stamina: buildPlayerStamina(basePlayer, teamName, players.length),
      value: target.value,
      wage: offeredWage,
      contractYears: years,
      status: 'Disponibile',
      personality,
      relationships: buildPlayerRelationships(basePlayer, personality),
      careerMemory: buildCareerMemory()
    };
  };

  const marketTargets = normalizeNegotiations(scoutedTargets, teamDNA, clubWorld);
  const activeNegotiations = marketTargets.filter(t => ACTIVE_STATUSES.includes(t.status));
  const concludedNegotiations = [...marketTargets.filter(t => CONCLUDED_STATUSES.includes(t.status))]
    .sort((a, b) => (b.concludedAt ?? '').localeCompare(a.concludedAt ?? ''))
    .slice(0, 5);

  const activeNegotiationsCount = activeNegotiations.length;
  const wageBudget = calculateClubWageBudget(players, clubProfile, careerWorld.clubWageBudgetState.season, careerWorld.clubWageBudgetState);
  const wageBudgetStatus = getWageBudgetStatusLabel(wageBudget);

  // Mercato M3: finestra di mercato reale (estiva/invernale), stessa fonte per gate e UI.
  const activeTransferWindow = getActiveTransferWindow(careerWorld.transferWindows);
  const marketWindowOpen = !!activeTransferWindow;
  const negotiationsNearingDeadline = activeNegotiations.filter(t => (
    t.expiresAtRound !== undefined && t.expiresAtRound - currentRound <= 2
  )).length;

  // ─────────────────────────────────────────────────────────────
  // FASE 1: offerta al club (cartellino + struttura). Nessun budget toccato qui.
  // ─────────────────────────────────────────────────────────────

  const handleStartClubOffer = (target: Negotiation) => {
    const normalized = normalizeNegotiation(target, teamDNA, clubWorld);
    setBiddingPlayer(normalized);
    setOfferBaseType('permanent');
    setOfferUpfrontFee(Math.round(normalized.value * 0.95).toString());
    setOfferInstallments([]);
    setOfferLoanFee(Math.round(normalized.value * 0.08).toString());
    setOfferWageShare(50);
    setOfferPurchaseClause('none');
    setOfferPurchaseFee(Math.round(normalized.value * 1.05).toString());
    setOfferObligationCondition('unconditional');
    setOfferRequiredAppearances('15');
    setOfferFutureClauseChoice('none');
    setOfferFutureClauseSellOnPercentage(10);
    setOfferFutureClauseBuyBackFee(Math.round(normalized.value * 1.1).toString());
    setOfferFutureClauseBuyBackDuration('next_season');
    setOfferIsSwap(false);
    setSwapOfferedPlayerId('');
    setSwapCashAdjustment('0');
    setSwapCashPaidBy('none');
    setOfferProtectiveClauseChoice('none');
    setOfferProtectiveClauseDuration('next_season');
    setOfferAntiRivalMode('block');
    setOfferAntiRivalClubNames([]);
    setOfferAntiRivalPenaltyPercent(15);
    setOfferIsLoanSwap(false);
    setLoanSwapOfferedPlayerId('');
    setLoanSwapUserPaysPercent(50);
    setLoanSwapOtherPaysPercent(50);
  };

  // Costruisce il modello unico dei termini (Mercato M1/M2A/M2C) a partire dal form attuale della
  // fase 1. Mai una formula finta: ogni campo qui e' collegato a un valore reale mostrato/salvato.
  const buildOfferTerms = (): TransferOfferTerms => {
    if (offerBaseType === 'permanent') {
      const terms: TransferOfferTerms = {
        baseType: 'permanent',
        purchaseClause: 'none',
        upfrontFee: Number(offerUpfrontFee) || 0,
        installments: offerInstallments,
        futureFinancialCommitment: 0,
        futureClauseChoice: offerFutureClauseChoice,
        futureClauseSellOnPercentage: offerFutureClauseChoice === 'sell_on_gross' || offerFutureClauseChoice === 'sell_on_capital_gain' ? offerFutureClauseSellOnPercentage : undefined,
        futureClauseBuyBackFee: offerFutureClauseChoice === 'buy_back' ? (Number(offerFutureClauseBuyBackFee) || 0) : undefined,
        futureClauseBuyBackDuration: offerFutureClauseChoice === 'buy_back' ? offerFutureClauseBuyBackDuration : undefined,
        protectiveClauseChoice: offerProtectiveClauseChoice,
        protectiveClauseDuration: offerProtectiveClauseChoice !== 'none' ? offerProtectiveClauseDuration : undefined,
        antiRivalMode: offerProtectiveClauseChoice === 'anti_rival' ? offerAntiRivalMode : undefined,
        antiRivalRestrictedClubIds: offerProtectiveClauseChoice === 'anti_rival' ? offerAntiRivalClubNames.map(name => resolveClubId(name)) : undefined,
        antiRivalRestrictedClubNames: offerProtectiveClauseChoice === 'anti_rival' ? offerAntiRivalClubNames : undefined,
        antiRivalPenaltyPercent: offerProtectiveClauseChoice === 'anti_rival' && offerAntiRivalMode === 'penalty' ? offerAntiRivalPenaltyPercent : undefined
      };
      terms.futureFinancialCommitment = calculateFutureFinancialCommitment(terms);
      return terms;
    }
    const terms: TransferOfferTerms = {
      baseType: 'loan',
      purchaseClause: offerPurchaseClause,
      upfrontFee: 0,
      installments: [],
      loanFee: Number(offerLoanFee) || 0,
      loanEndSeason: careerWorld.clubWageBudgetState.season,
      wageSharePercent: offerWageShare,
      purchaseFee: offerPurchaseClause === 'none' ? undefined : (Number(offerPurchaseFee) || 0),
      obligationCondition: offerPurchaseClause === 'obligation' ? offerObligationCondition : undefined,
      requiredAppearances: offerPurchaseClause === 'obligation' && offerObligationCondition === 'appearances' ? (Number(offerRequiredAppearances) || 0) : undefined,
      futureFinancialCommitment: 0
    };
    terms.futureFinancialCommitment = calculateFutureFinancialCommitment(terms);
    return terms;
  };

  // Diff reale fra la mia ultima offerta e la richiesta del club: mai una controproposta "a scatola
  // chiusa". Confronta solo i campi realmente implementati (mai clausole finte).
  const buildCounterDiff = (mine: TransferOfferTerms, theirs: TransferOfferTerms): { label: string; mine: string; theirs: string }[] => {
    const rows: { label: string; mine: string; theirs: string }[] = [];
    if (mine.baseType === 'permanent' && theirs.baseType === 'permanent') {
      if (mine.upfrontFee !== theirs.upfrontFee) rows.push({ label: 'Cartellino', mine: formatCurrency(mine.upfrontFee), theirs: formatCurrency(theirs.upfrontFee) });
      const mineInst = mine.installments.reduce((s, i) => s + i.amount, 0);
      const theirInst = theirs.installments.reduce((s, i) => s + i.amount, 0);
      if (mineInst !== theirInst) rows.push({ label: 'Rate future', mine: formatCurrency(mineInst), theirs: formatCurrency(theirInst) });
    } else if (mine.baseType === 'loan' && theirs.baseType === 'loan') {
      if ((mine.loanFee ?? 0) !== (theirs.loanFee ?? 0)) rows.push({ label: 'Indennizzo', mine: formatCurrency(mine.loanFee ?? 0), theirs: formatCurrency(theirs.loanFee ?? 0) });
      if ((mine.wageSharePercent ?? 0) !== (theirs.wageSharePercent ?? 0)) rows.push({ label: 'Quota stipendio', mine: `${mine.wageSharePercent ?? 0}%`, theirs: `${theirs.wageSharePercent ?? 0}%` });
      if ((mine.purchaseFee ?? 0) !== (theirs.purchaseFee ?? 0)) rows.push({ label: `Prezzo ${theirs.purchaseClause === 'option' ? 'diritto' : 'obbligo'}`, mine: formatCurrency(mine.purchaseFee ?? 0), theirs: formatCurrency(theirs.purchaseFee ?? 0) });
      if (mine.obligationCondition !== theirs.obligationCondition && theirs.obligationCondition) rows.push({ label: 'Condizione obbligo', mine: mine.obligationCondition ? OBLIGATION_CONDITION_LABELS[mine.obligationCondition] : '—', theirs: OBLIGATION_CONDITION_LABELS[theirs.obligationCondition] });
      if ((mine.requiredAppearances ?? 0) !== (theirs.requiredAppearances ?? 0) && theirs.requiredAppearances) rows.push({ label: 'Soglia presenze', mine: `${mine.requiredAppearances ?? '—'}`, theirs: `${theirs.requiredAppearances}` });
    }
    return rows;
  };

  const handleScoutTarget = (target: Negotiation) => {
    const normalized = normalizeNegotiation(target, teamDNA, clubWorld);
    if ((normalized.scoutLevel ?? 0) >= 4) return;
    const nextLevel = (normalized.scoutLevel ?? 0) + 1;
    const scoutCost = Math.round((120000 + nextLevel * 180000 + normalized.value * 0.002) / 10000) * 10000;
    if (scoutCost > budget) {
      alert(`Budget insufficiente per scouting avanzato: servono ${formatCurrency(scoutCost)}.`);
      return;
    }

    const realPlayer = getRealPlayerForTarget(normalized, clubWorld);
    const scoutQuality = applyFacilityBonusToStaffModifiers(
      getClubStaffModifiers(careerWorld.clubStaffState),
      careerWorld.clubFacilitiesState
    ).scoutingQuality;
    const updated = advanceScouting(normalized, realPlayer, teamDNA, clubWorld, scoutQuality);
    setBudget(budget - scoutCost);
    setScoutedTargets(scoutedTargets.map(item => item.id === target.id ? updated : item));
    addNewNews(
      `Report scouting: ${target.playerName}`,
      `${target.playerName}: rete scouting livello ${updated.scoutLevel}/4. ${updated.timeline[updated.timeline.length - 1]}`,
      'market'
    );

    if ((updated.scoutLevel ?? 0) >= 2) {
      const rumorSignal: MarketRumorPlayerSignal = {
        playerId: target.id,
        playerName: target.playerName,
        scoutLevel: updated.scoutLevel,
        scoutingJustAdvanced: true,
        tacticalFitHigh: (updated.tacticalFit ?? 0) >= 80,
        sourceClubName: target.currentClub,
        sourceClubId: resolveClubId(target.currentClub),
      };
      setCareerWorld(current => processMarketRumorsAfterTransfer(current, {
        round: currentRound,
        season: '2026/27',
        signal: rumorSignal,
      }));
    }
  };

  // Assicura che il giocatore sia gia' tracciato come obiettivo (crea un draft se serve), poi avvia
  // subito la fase 1. Usato dal Database Giocatori quando non esiste ancora una scheda di scouting.
  const ensureTrackedTarget = (player: Player, clubName: string): Negotiation => {
    const existing = scoutedTargets.find(t => t.playerName === player.name && t.currentClub === clubName);
    if (existing) return existing;
    const draft: Negotiation = {
      id: `direct_${clubName.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}_${player.id}_${Date.now()}`,
      playerName: player.name,
      role: player.role,
      currentClub: clubName,
      value: player.value,
      wage: player.wage,
      offeredFee: 0,
      offeredWage: 0,
      offeredContractYears: 0,
      probability: player.overall >= 84 ? 30 : player.overall >= 78 ? 42 : 58,
      status: 'draft',
      timeline: [`${player.name} osservato nella rosa del ${clubName}.`]
    };
    setScoutedTargets([draft, ...scoutedTargets]);
    return draft;
  };

  const handleSendClubOffer = () => {
    if (!biddingPlayer) return;
    // Mercato M3: nuove offerte reali al club solo a finestra di mercato aperta.
    if (!marketWindowOpen) {
      alert('Il mercato e chiuso: nessuna nuova offerta possibile fino alla prossima finestra.');
      return;
    }
    const terms = buildOfferTerms();
    const realPlayerForOffer = findPlayerForTarget(biddingPlayer);
    const weeklyWageForOffer = realPlayerForOffer?.wage ?? toWeeklyWage(toAnnualSalary(biddingPlayer.wage));
    const immediateCostForOffer = calculateImmediateCost(terms, weeklyWageForOffer, Math.max(1, 38 - currentRound));
    const validation = validateTransferTerms(terms, budget, careerWorld.clubWageBudgetState, immediateCostForOffer);
    if (!validation.valid) {
      alert(validation.reason);
      return;
    }
    // Mercato M2C: divieto di vendita anti-rivale. Blocca l'invio, nessuna trattativa/rosa/budget toccati.
    if (terms.baseType === 'permanent' && realPlayerForOffer) {
      const myClubRestriction = checkAntiRivalRestriction(realPlayerForOffer, resolveClubId(teamName), teamName);
      if (myClubRestriction.blocked) {
        alert(myClubRestriction.reason);
        return;
      }
    }

    const sentTarget = normalizeNegotiation(biddingPlayer, teamDNA, clubWorld);
    const offeredFeeDisplay = terms.baseType === 'permanent' ? terms.upfrontFee : (terms.loanFee ?? 0);
    // L'offerta risulta subito "inviata" nella lista trattative: la risoluzione (accordo/rifiuto/
    // controproposta) arriva poco dopo, ma lo stato intermedio e' visibile anche se si chiude il modal.
    setScoutedTargets(scoutedTargets.map(t => (t.id === sentTarget.id ? { ...sentTarget, status: 'club_offer_sent' as const, terms, clubOfferFee: offeredFeeDisplay } : t)));
    setBiddingPlayer(null);
    setTimeout(() => {
      const dealTarget = sentTarget;
      const sourceClub = clubWorld.find(club => club.name === dealTarget.currentClub);
      const realPlayer = sourceClub?.roster.find(player => player.name === dealTarget.playerName);
      const dnaMarket = realPlayer ? getDNAMarketAdjustment(realPlayer, teamDNA) : null;

      const clubAppeal = computeClubAppealFromTerms(terms, dealTarget.value);
      const sellingClubDifficulty =
        ['Inter', 'Juventus', 'Milan', 'Napoli', 'Roma', 'Atalanta'].includes(dealTarget.currentClub) ? 14 :
        ['Como', 'Fiorentina', 'Lazio', 'Bologna'].includes(dealTarget.currentClub) ? 8 : 2;
      const nextDaysLeft = clamp((dealTarget.daysLeft ?? 14) - 4, 0, 60);
      const nextRivalPressure = clamp((dealTarget.rivalPressure ?? 0) + (dealTarget.rivalClub ? 10 + (dealTarget.rumorLevel ?? 0) * 0.06 : 0), 0, 100);
      const rivalPenalty = dealTarget.rivalClub ? nextRivalPressure * 0.1 : 0;
      const successThreshold = dealTarget.probability + clubAppeal - sellingClubDifficulty + (teamDNA.reputation - 55) * 0.08 + (dnaMarket?.probabilityBonus ?? 0) - rivalPenalty;
      const stolenByRival = Boolean(dealTarget.rivalClub && nextRivalPressure >= 80 && clubAppeal < 15);

      let nextStatus: Negotiation['status'];
      let logMsg: string;
      let clubCounterTerms: TransferOfferTerms | undefined;
      // Il club puo' cambiare solo campi realmente implementati (indennizzo/cartellino/rate, quota
      // stipendio, prezzo diritto/obbligo): mai una clausola inventata.
      const buildHigherCounter = (multiplier: number): TransferOfferTerms => {
        if (terms.baseType === 'permanent') {
          return { ...terms, upfrontFee: Math.round(dealTarget.value * multiplier), installments: [], futureFinancialCommitment: 0 };
        }
        const raisedWageShare = terms.wageSharePercent !== undefined
          ? (Math.min(100, terms.wageSharePercent + 25) as 0 | 25 | 50 | 75 | 100)
          : terms.wageSharePercent;
        const raisedPurchaseFee = terms.purchaseClause !== 'none' && terms.purchaseFee
          ? Math.round(terms.purchaseFee * multiplier)
          : terms.purchaseFee;
        return {
          ...terms,
          loanFee: Math.round((terms.loanFee ?? 0) * multiplier + dealTarget.value * 0.015),
          wageSharePercent: raisedWageShare,
          purchaseFee: raisedPurchaseFee
        };
      };

      if (clubAppeal < -15) {
        nextStatus = 'club_counter_offer';
        clubCounterTerms = buildHigherCounter(1.08);
        logMsg = `Il ${dealTarget.currentClub} giudica la proposta troppo bassa e formula una controproposta.`;
      } else if (stolenByRival) {
        nextStatus = 'club_offer_rejected';
        logMsg = `Il ${dealTarget.rivalClub} si inserisce con forza: il club preferisce trattare con loro.`;
      } else if (clubAppeal >= 20) {
        nextStatus = 'club_offer_accepted';
        logMsg = `Il ${dealTarget.currentClub} accetta i termini proposti.`;
      } else {
        const roll = Math.random() * 100;
        if (roll < successThreshold) {
          nextStatus = 'club_offer_accepted';
          logMsg = `Accordo raggiunto con il ${dealTarget.currentClub} dopo una trattativa complessa.`;
        } else {
          nextStatus = 'club_counter_offer';
          clubCounterTerms = buildHigherCounter(1.12);
          logMsg = `Il ${dealTarget.currentClub} chiede condizioni migliori per proseguire.`;
        }
      }

      const agreedFee = terms.baseType === 'permanent' ? terms.upfrontFee : (terms.loanFee ?? 0);
      const updated: Negotiation = {
        ...dealTarget,
        status: nextStatus,
        terms,
        clubCounterTerms,
        clubOfferFee: agreedFee,
        clubAgreedFee: nextStatus === 'club_offer_accepted' ? agreedFee : undefined,
        offeredFee: agreedFee,
        daysLeft: nextDaysLeft,
        rivalPressure: nextRivalPressure,
        timeline: [
          ...dealTarget.timeline,
          `Offerta al club: ${TRANSFER_BASE_TYPE_LABELS[terms.baseType]}${terms.baseType === 'loan' ? ' - ' + PURCHASE_CLAUSE_LABELS[terms.purchaseClause] : (terms.installments.length > 0 ? ' con rate' : '')}.`,
          logMsg
        ]
      };
      setScoutedTargets(scoutedTargets.map(t => t.id === updated.id ? updated : t));
    }, 1200);
  };

  const handleAcceptClubCounter = (target: Negotiation) => {
    // Riapre la fase 1 precaricata con la controproposta reale del club (mai una cifra inventata).
    const counter = target.clubCounterTerms;
    setBiddingPlayer(target);
    if (counter) {
      setOfferBaseType(counter.baseType);
      setOfferUpfrontFee(counter.upfrontFee.toString());
      setOfferInstallments(counter.installments);
      setOfferLoanFee((counter.loanFee ?? 0).toString());
      setOfferWageShare((counter.wageSharePercent ?? 50) as 0 | 25 | 50 | 75 | 100);
      setOfferPurchaseClause(counter.purchaseClause);
      setOfferPurchaseFee((counter.purchaseFee ?? 0).toString());
      setOfferObligationCondition(counter.obligationCondition ?? 'unconditional');
      setOfferRequiredAppearances((counter.requiredAppearances ?? 15).toString());
      setOfferFutureClauseChoice(counter.futureClauseChoice ?? 'none');
      setOfferFutureClauseSellOnPercentage(counter.futureClauseSellOnPercentage ?? 10);
      setOfferFutureClauseBuyBackFee((counter.futureClauseBuyBackFee ?? Math.round(target.value * 1.1)).toString());
      setOfferFutureClauseBuyBackDuration(counter.futureClauseBuyBackDuration ?? 'next_season');
    } else {
      setOfferBaseType('permanent');
      setOfferUpfrontFee(Math.round(target.value * 1.1).toString());
      setOfferInstallments([]);
    }
  };

  // Mercato M2B: giocatori miei realmente idonei allo scambio (mai in prestito, mai fuori prima
  // squadra, mai gia' offerti in un altro scambio ancora aperto).
  const activeSwapOfferedPlayerIds = new Set(
    activeNegotiations.filter(t => t.swapTerms && t.swapTerms.status !== 'failed').map(t => t.swapTerms!.offeredPlayerId)
  );
  const swapEligiblePlayers = players.filter(p => (
    (p.squadStatus ?? 'first_team') === 'first_team'
    && !p.loanState
    && !activeSwapOfferedPlayerIds.has(p.id)
    && p.overall > 0
  ));

  // Mercato M2C: giocatori miei idonei allo scambio di prestiti (in piu' rispetto allo scambio
  // permanente: mai con un precontratto attivo incompatibile, mai gia' offerti in un altro scambio
  // di prestiti ancora aperto).
  const activeLoanSwapOfferedPlayerIds = new Set(
    activeNegotiations.filter(t => t.loanSwapTerms && t.loanSwapTerms.status !== 'failed').map(t => t.loanSwapTerms!.userOutgoingPlayerId)
  );
  const loanSwapEligiblePlayers = swapEligiblePlayers.filter(p => (
    !activeLoanSwapOfferedPlayerIds.has(p.id)
    && !careerWorld.futureContractAgreements.some(a => a.playerId === p.id && a.status === 'active')
  ));

  const handleSendSwapOffer = () => {
    if (!biddingPlayer) return;
    if (!marketWindowOpen) {
      alert('Il mercato e chiuso: nessuna nuova offerta possibile fino alla prossima finestra.');
      return;
    }
    const offeredPlayer = players.find(p => p.id === swapOfferedPlayerId);
    if (!offeredPlayer) {
      alert('Seleziona un tuo giocatore da offrire nello scambio.');
      return;
    }
    const cashAdjustment = Math.max(0, Number(swapCashAdjustment) || 0);
    if (swapCashPaidBy === 'user_club' && cashAdjustment > budget) {
      alert('Budget trasferimenti insufficiente per il conguaglio.');
      return;
    }

    const sentTarget = normalizeNegotiation(biddingPlayer, teamDNA, clubWorld);
    const swapTerms: PlayerSwapTerms = {
      offeredPlayerId: offeredPlayer.id,
      offeredPlayerName: offeredPlayer.name,
      cashAdjustment,
      cashPaidBy: swapCashPaidBy,
      estimatedPlayerValue: offeredPlayer.value,
      status: 'club_negotiation'
    };
    setScoutedTargets(scoutedTargets.map(t => (t.id === sentTarget.id ? { ...sentTarget, status: 'club_offer_sent' as const, swapTerms, terms: undefined, clubOfferFee: cashAdjustment } : t)));
    setBiddingPlayer(null);

    setTimeout(() => {
      const dealTarget = sentTarget;
      const sourceClub = clubWorld.find(club => club.name === dealTarget.currentClub);
      const targetRealPlayer = sourceClub?.roster.find(player => player.name === dealTarget.playerName);
      if (!sourceClub || !targetRealPlayer) {
        setScoutedTargets(scoutedTargets.map(t => (t.id === dealTarget.id ? {
          ...dealTarget,
          status: 'club_offer_rejected' as const,
          swapTerms: { ...swapTerms, status: 'failed' as const },
          concludedAt: new Date().toISOString(),
          concludedKind: 'rejected' as const,
          timeline: [...dealTarget.timeline, 'Il club non ha piu questo giocatore disponibile per lo scambio.']
        } : t)));
        return;
      }

      const appeal = evaluateSwapAppeal(offeredPlayer, targetRealPlayer, cashAdjustment, swapCashPaidBy, sourceClub);
      const nextDaysLeft = clamp((dealTarget.daysLeft ?? 14) - 4, 0, 60);

      let nextStatus: Negotiation['status'];
      let nextSwapStatus: PlayerSwapStatus;
      let logMsg: string;
      let clubCounterSwapTerms: PlayerSwapTerms | undefined;

      if (appeal.score < -10) {
        nextStatus = 'club_counter_offer';
        nextSwapStatus = 'club_negotiation';
        const altPlayer = pickSwapCounterPlayer(swapEligiblePlayers, roleFamilyOf(targetRealPlayer.role), offeredPlayer.id);
        if (altPlayer && altPlayer.overall > offeredPlayer.overall) {
          clubCounterSwapTerms = { offeredPlayerId: altPlayer.id, offeredPlayerName: altPlayer.name, cashAdjustment, cashPaidBy: swapCashPaidBy, estimatedPlayerValue: altPlayer.value, status: 'club_negotiation' };
          logMsg = `Il ${dealTarget.currentClub} preferirebbe ${altPlayer.name} al posto di ${offeredPlayer.name}.`;
        } else {
          const extraCash = Math.max(500000, Math.round((targetRealPlayer.value - offeredPlayer.value) * 0.6 / 100000) * 100000);
          clubCounterSwapTerms = { offeredPlayerId: offeredPlayer.id, offeredPlayerName: offeredPlayer.name, cashAdjustment: cashAdjustment + extraCash, cashPaidBy: 'user_club', estimatedPlayerValue: offeredPlayer.value, status: 'club_negotiation' };
          logMsg = `Il ${dealTarget.currentClub} chiede un conguaglio piu alto per accettare lo scambio.`;
        }
      } else {
        const roll = Math.random() * 100;
        if (appeal.score >= 15 || roll < dealTarget.probability + appeal.score) {
          nextStatus = 'club_offer_accepted';
          nextSwapStatus = 'clubs_agreed';
          logMsg = `Il ${dealTarget.currentClub} accetta lo scambio proposto.`;
        } else {
          nextStatus = 'club_counter_offer';
          nextSwapStatus = 'club_negotiation';
          const extraCash = Math.max(300000, Math.round(targetRealPlayer.value * 0.08 / 100000) * 100000);
          clubCounterSwapTerms = { offeredPlayerId: offeredPlayer.id, offeredPlayerName: offeredPlayer.name, cashAdjustment: cashAdjustment + extraCash, cashPaidBy: 'user_club', estimatedPlayerValue: offeredPlayer.value, status: 'club_negotiation' };
          logMsg = `Il ${dealTarget.currentClub} chiede condizioni migliori per lo scambio.`;
        }
      }

      if (nextSwapStatus === 'clubs_agreed') {
        // Consenso del mio giocatore in uscita: risolto subito, deterministico, mai una nuova UI.
        const projectRole = getPlayerProjectRole(offeredPlayer, roleContext);
        const consent = resolveSwapOutgoingConsent(offeredPlayer, projectRole, `${offeredPlayer.id}-${dealTarget.id}-swapconsent`);
        if (!consent.accepts) {
          setScoutedTargets(scoutedTargets.map(t => (t.id === dealTarget.id ? {
            ...dealTarget,
            status: 'club_offer_rejected' as const,
            swapTerms: { ...swapTerms, status: 'failed' as const },
            daysLeft: nextDaysLeft,
            concludedAt: new Date().toISOString(),
            concludedKind: 'rejected' as const,
            timeline: [...dealTarget.timeline, logMsg, `${offeredPlayer.name} non vuole trasferirsi al ${dealTarget.currentClub}: ${consent.willingness.label.toLowerCase()}.`]
          } : t)));
          return;
        }
        setScoutedTargets(scoutedTargets.map(t => (t.id === dealTarget.id ? {
          ...dealTarget,
          status: nextStatus,
          swapTerms: { ...swapTerms, status: 'waiting_player_decisions' as const },
          clubAgreedFee: cashAdjustment,
          daysLeft: nextDaysLeft,
          timeline: [...dealTarget.timeline, logMsg, `${offeredPlayer.name} apre al trasferimento (${consent.willingness.label.toLowerCase()}).`]
        } : t)));
        return;
      }

      setScoutedTargets(scoutedTargets.map(t => (t.id === dealTarget.id ? {
        ...dealTarget,
        status: nextStatus,
        swapTerms: { ...swapTerms, status: nextSwapStatus },
        clubCounterSwapTerms,
        daysLeft: nextDaysLeft,
        timeline: [...dealTarget.timeline, logMsg]
      } : t)));
    }, 1200);
  };

  const handleAcceptSwapCounter = (target: Negotiation) => {
    const counter = target.clubCounterSwapTerms;
    setBiddingPlayer(target);
    setOfferIsSwap(true);
    setOfferBaseType('permanent');
    if (counter) {
      setSwapOfferedPlayerId(counter.offeredPlayerId);
      setSwapCashAdjustment(counter.cashAdjustment.toString());
      setSwapCashPaidBy(counter.cashPaidBy);
    }
  };

  // Mercato M2C: scambio di prestiti. Mai cartellino/conguaglio/rate/diritto/obbligo/clausole future;
  // accordo club -> consenso deterministico del mio giocatore in uscita -> fase prestito esistente
  // (loanTarget) per il giocatore in entrata, che resta l'unico passaggio con una UI dedicata.
  const handleSendLoanSwapOffer = () => {
    if (!biddingPlayer) return;
    if (!marketWindowOpen) {
      alert('Il mercato e chiuso: nessuna nuova offerta possibile fino alla prossima finestra.');
      return;
    }
    const offeredPlayer = players.find(p => p.id === loanSwapOfferedPlayerId);
    if (!offeredPlayer) {
      alert('Seleziona un tuo giocatore da offrire nello scambio di prestiti.');
      return;
    }

    const sentTarget = normalizeNegotiation(biddingPlayer, teamDNA, clubWorld);
    const shellTerms: TransferOfferTerms = {
      baseType: 'loan', purchaseClause: 'none', upfrontFee: 0, installments: [],
      loanFee: 0, loanEndSeason: careerWorld.clubWageBudgetState.season,
      wageSharePercent: loanSwapUserPaysPercent, futureFinancialCommitment: 0
    };
    setScoutedTargets(scoutedTargets.map(t => (t.id === sentTarget.id ? { ...sentTarget, status: 'club_offer_sent' as const, terms: shellTerms, loanSwapTerms: undefined, clubOfferFee: 0 } : t)));
    setBiddingPlayer(null);

    setTimeout(() => {
      const dealTarget = sentTarget;
      const sourceClub = clubWorld.find(club => club.name === dealTarget.currentClub);
      const targetRealPlayer = sourceClub?.roster.find(p => p.name === dealTarget.playerName);
      if (!sourceClub || !targetRealPlayer) {
        setScoutedTargets(scoutedTargets.map(t => (t.id === dealTarget.id ? { ...dealTarget, status: 'club_offer_rejected' as const, concludedAt: new Date().toISOString(), concludedKind: 'rejected' as const, timeline: [...dealTarget.timeline, 'Il club non ha piu questo giocatore disponibile.'] } : t)));
        return;
      }

      const appeal = evaluateLoanSwapAppeal(offeredPlayer, loanSwapOtherPaysPercent, sourceClub);
      const nextDaysLeft = clamp((dealTarget.daysLeft ?? 14) - 4, 0, 60);
      const terms = createLoanSwapTerms(offeredPlayer.id, offeredPlayer.name, targetRealPlayer.id, sourceClub.clubId, sourceClub.name, loanSwapUserPaysPercent, loanSwapOtherPaysPercent, careerWorld.clubWageBudgetState.season);

      if (appeal.score < 10) {
        setScoutedTargets(scoutedTargets.map(t => (t.id === dealTarget.id ? {
          ...dealTarget, status: 'club_offer_rejected' as const, daysLeft: nextDaysLeft,
          concludedAt: new Date().toISOString(), concludedKind: 'rejected' as const,
          timeline: [...dealTarget.timeline, `Il ${dealTarget.currentClub} rifiuta lo scambio di prestiti: ${appeal.reasons[0] ?? 'nessun bisogno reale sufficiente'}.`]
        } : t)));
        return;
      }

      // Consenso del mio giocatore in uscita: risolto subito, deterministico, mai una nuova UI.
      const projectRole = getPlayerProjectRole(offeredPlayer, roleContext);
      const consent = resolveSwapOutgoingConsent(offeredPlayer, projectRole, `${offeredPlayer.id}-${dealTarget.id}-loanswapconsent`);
      if (!consent.accepts) {
        setScoutedTargets(scoutedTargets.map(t => (t.id === dealTarget.id ? {
          ...dealTarget, status: 'club_offer_rejected' as const, loanSwapTerms: { ...terms, status: 'failed' as const }, daysLeft: nextDaysLeft,
          concludedAt: new Date().toISOString(), concludedKind: 'rejected' as const,
          timeline: [...dealTarget.timeline, `${offeredPlayer.name} non vuole trasferirsi in prestito al ${dealTarget.currentClub}: ${consent.willingness.label.toLowerCase()}.`]
        } : t)));
        return;
      }

      setScoutedTargets(scoutedTargets.map(t => (t.id === dealTarget.id ? {
        ...dealTarget, status: 'club_offer_accepted' as const, terms: shellTerms,
        loanSwapTerms: { ...terms, status: 'waiting_player_decisions' as const }, daysLeft: nextDaysLeft,
        timeline: [...dealTarget.timeline, `Il ${dealTarget.currentClub} accetta lo scambio di prestiti.`, `${offeredPlayer.name} apre al trasferimento (${consent.willingness.label.toLowerCase()}).`]
      } : t)));
    }, 1200);
  };

  const handleWithdrawNegotiation = (targetId: string) => {
    setScoutedTargets(scoutedTargets.map(t => (
      t.id === targetId ? { ...t, status: 'withdrawn' as const, concludedAt: new Date().toISOString(), concludedKind: 'withdrawn' as const } : t
    )));
  };

  // ─────────────────────────────────────────────────────────────
  // FASE 2: contratto al giocatore. Apre solo dopo club_offer_accepted.
  // ─────────────────────────────────────────────────────────────

  const handleOpenContractNegotiation = (target: Negotiation) => {
    if (target.status !== 'club_offer_accepted' && target.status !== 'player_counter_offer') return;
    if (target.terms?.baseType === 'loan') {
      setLoanTarget(target);
      setScoutedTargets(scoutedTargets.map(t => (t.id === target.id ? { ...t, status: 'player_contract_negotiation' as const } : t)));
      return;
    }
    const realPlayer = findPlayerForTarget(target);
    const demand = realPlayer
      ? getPlayerContractDemand(realPlayer, clubProfile, { starters, bench, seasonStats: playerStats, clubHistory, round: currentRound })
      : null;
    const suggestedAnnual = target.contractCounterAnnualSalary ?? demand?.demandedAnnualSalary ?? toAnnualSalary(target.wage);
    const suggestedYears = target.contractCounterYears ?? demand?.demandedYears ?? 3;
    setContractTarget(target);
    setContractWage(Math.round(toWeeklyWage(suggestedAnnual)).toString());
    setContractYears(suggestedYears);
    setContractSigningBonus(Math.round(suggestedAnnual * 0.08).toString());
    setContractAgentFee(Math.round(suggestedAnnual * 0.12).toString());
    setPromiseType(target.promiseType ?? (target.value >= 45000000 ? 'starRole' : target.value >= 25000000 ? 'starter' : 'rotation'));
    setScoutedTargets(scoutedTargets.map(t => (t.id === target.id ? { ...t, status: 'player_contract_negotiation' as const } : t)));
  };

  const highestSquadAnnualSalary = Math.max(0, ...players.map(p => p.contract?.annualSalary ?? toAnnualSalary(p.wage)));

  // Fase 2 per i prestiti: la quota stipendio e' gia' fissata in fase 1, qui il giocatore la valuta
  // (riusa evaluateContractOffer, lo stesso motore del flusso permanente) e si conclude in un solo passo.
  const loanContractPreview = loanTarget && loanTarget.terms ? (() => {
    const terms = loanTarget.terms!;
    const realPlayer = getRealPlayerForTarget(loanTarget, clubWorld);
    const evalPlayer = realPlayer ?? estimateSignedPlayer(loanTarget, loanTarget.wage, 1);
    const squadRole: ContractSquadRole = inferContractSquadRole(evalPlayer, { starters, bench });
    const weeklyShare = Math.round(evalPlayer.wage * (terms.wageSharePercent ?? 0) / 100);
    const annualShare = toAnnualSalary(weeklyShare);
    const evaluation = evaluateContractOffer(
      evalPlayer,
      clubProfile,
      { annualSalary: annualShare, years: 1, squadRole },
      wageBudget,
      { starters, bench, seasonStats: playerStats, clubHistory, round: currentRound },
      highestSquadAnnualSalary
    );
    const impact = calculateContractFinancialImpact(
      { annualSalary: annualShare, signingBonus: 0, agentFee: 0 },
      budget - (terms.loanFee ?? 0),
      wageBudget
    );
    return { terms, evalPlayer, squadRole, weeklyShare, annualShare, evaluation, impact };
  })() : null;

  const contractPreview = contractTarget ? (() => {
    const annualSalary = toAnnualSalary(Number(contractWage) || 0);
    const signingBonus = Number(contractSigningBonus) || 0;
    const agentFeeNum = Number(contractAgentFee) || 0;
    const realPlayer = findPlayerForTarget(contractTarget);
    const evalPlayer = realPlayer ?? estimateSignedPlayer(contractTarget, Number(contractWage) || contractTarget.wage, contractYears);
    const squadRole: ContractSquadRole = inferContractSquadRole(evalPlayer, { starters, bench });
    const evaluation = evaluateContractOffer(
      evalPlayer,
      clubProfile,
      { annualSalary, years: contractYears, squadRole },
      wageBudget,
      { starters, bench, seasonStats: playerStats, clubHistory, round: currentRound },
      highestSquadAnnualSalary
    );
    const impact = calculateContractFinancialImpact(
      { annualSalary, signingBonus, agentFee: agentFeeNum },
      budget - (contractTarget.clubAgreedFee ?? 0),
      wageBudget
    );
    return { annualSalary, signingBonus, agentFeeNum, evaluation, impact, evalPlayer, squadRole };
  })() : null;

  const finalizePurchase = (target: Negotiation, annualSalary: number, years: number, signingBonus: number, agentFeeNum: number, squadRole: ContractSquadRole) => {
    const dealTarget = target;
    const feeNum = dealTarget.clubAgreedFee ?? 0;
    const sourceClub = clubWorld.find(club => club.name === dealTarget.currentClub);
    const realPlayer = sourceClub?.roster.find(player => player.name === dealTarget.playerName);
    const dnaMarket = realPlayer ? getDNAMarketAdjustment(realPlayer, teamDNA) : null;
    const weeklyWage = toWeeklyWage(annualSalary);

    const remainingBudget = budget - (feeNum + signingBonus + agentFeeNum);
    setBudget(remainingBudget);

    const signedPlayer = realPlayer
      ? {
          ...realPlayer,
          id: `signed_${realPlayer.id}_${Date.now()}`,
          wage: weeklyWage,
          contractYears: years,
          morale: Math.max(realPlayer.morale, 84),
          condition: dealTarget.hiddenRisk === 'Fragilita fisica' && !dealTarget.riskKnown ? 86 : 100,
          status: dealTarget.hiddenRisk === 'Fragilita fisica' && !dealTarget.riskKnown ? 'Stanco' as const : 'Disponibile' as const
        }
      : estimateSignedPlayer(dealTarget, weeklyWage, years);
    const buyerUserClubId = resolveClubId(teamName);
    const sellerClubId = sourceClub?.clubId ?? resolveClubId(dealTarget.currentClub);
    const currentSeason = careerWorld.clubWageBudgetState.season;

    // Mercato M2A: esercizio di un mio contro-riscatto attivo (negoziazione sintetica id "buyback_...").
    // Marca la clausola exercised una sola volta; non ne crea una nuova per questa stessa operazione.
    const exercisedBuyBackId = dealTarget.id.startsWith('buyback_') ? dealTarget.id.replace('buyback_', '') : null;
    let carriedBuyBackClauses = signedPlayer.buyBackClauses ?? [];
    if (exercisedBuyBackId) {
      carriedBuyBackClauses = carriedBuyBackClauses.map(c => (c.id === exercisedBuyBackId ? { ...c, status: 'exercised' as const } : c));
    }
    let carriedSellOnClauses = signedPlayer.sellOnClauses ?? [];

    // Clausola futura scelta nella mia offerta (mai per un contro-riscatto in corso: gia' un diritto
    // esistente, non una nuova clausola). Una sola clausola futura per operazione.
    const chosenClause = dealTarget.terms?.futureClauseChoice;
    let clauseNewsLine = '';
    if (!exercisedBuyBackId && chosenClause && chosenClause !== 'none') {
      if (chosenClause === 'sell_on_gross' || chosenClause === 'sell_on_capital_gain') {
        const pct = dealTarget.terms?.futureClauseSellOnPercentage ?? 0;
        const clause = createSellOnClause(chosenClause, pct, feeNum, sellerClubId, dealTarget.currentClub, currentSeason);
        carriedSellOnClauses = [...carriedSellOnClauses, clause];
        clauseNewsLine = ` Il ${dealTarget.currentClub} mantiene il ${pct}% ${SELL_ON_TYPE_LABELS[clause.type]} su una futura rivendita.`;
      } else if (chosenClause === 'buy_back') {
        const buyBackFee = dealTarget.terms?.futureClauseBuyBackFee ?? 0;
        const duration = dealTarget.terms?.futureClauseBuyBackDuration ?? 'next_season';
        const clause = createBuyBackClause(buyBackFee, duration, sellerClubId, dealTarget.currentClub, signedPlayer.id, currentSeason, teamDNA.seasonsTracked);
        carriedBuyBackClauses = [...carriedBuyBackClauses, clause];
        clauseNewsLine = ` Il ${dealTarget.currentClub} conserva un contro-riscatto a ${formatCurrency(buyBackFee)} fino al ${clause.expirySeason}.`;
      }
    }

    // Mercato M2C: clausola protettiva scelta nella mia offerta (mai per un contro-riscatto in
    // corso). Beneficiario = il club venditore, come per la clausola economica M2A.
    let carriedFirstRefusalClauses = signedPlayer.firstRefusalClauses ?? [];
    let carriedAntiRivalClauses = signedPlayer.antiRivalClauses ?? [];
    const chosenProtectiveClause = dealTarget.terms?.protectiveClauseChoice;
    if (!exercisedBuyBackId && chosenProtectiveClause && chosenProtectiveClause !== 'none') {
      if (chosenProtectiveClause === 'first_refusal') {
        const duration = dealTarget.terms?.protectiveClauseDuration ?? 'next_season';
        const clause = createFirstRefusalClause(signedPlayer.id, duration, sellerClubId, dealTarget.currentClub, currentSeason, teamDNA.seasonsTracked);
        carriedFirstRefusalClauses = [...carriedFirstRefusalClauses, clause];
        clauseNewsLine += ` Il ${dealTarget.currentClub} conserva il diritto di prelazione fino al ${clause.expirySeason}.`;
      } else if (chosenProtectiveClause === 'anti_rival') {
        const duration = dealTarget.terms?.protectiveClauseDuration ?? 'next_season';
        const mode = dealTarget.terms?.antiRivalMode ?? 'block';
        const restrictedIds = dealTarget.terms?.antiRivalRestrictedClubIds ?? [];
        const restrictedNames = dealTarget.terms?.antiRivalRestrictedClubNames ?? [];
        const clause = createAntiRivalClause(signedPlayer.id, mode, restrictedIds, restrictedNames, dealTarget.terms?.antiRivalPenaltyPercent, duration, sellerClubId, dealTarget.currentClub, currentSeason, teamDNA.seasonsTracked);
        carriedAntiRivalClauses = [...carriedAntiRivalClauses, clause];
        clauseNewsLine += ` Clausola anti-rivale a favore del ${dealTarget.currentClub} verso ${restrictedNames.join(', ')} (${ANTI_RIVAL_MODE_LABELS[mode]}).`;
      }
    }

    const newPlayer = applySignedContract(
      {
        ...signedPlayer,
        sellOnClauses: carriedSellOnClauses,
        buyBackClauses: carriedBuyBackClauses,
        firstRefusalClauses: carriedFirstRefusalClauses,
        antiRivalClauses: carriedAntiRivalClauses,
        clubHistory: applyPlayerTransferToClubHistory(realPlayer?.clubHistory, {
          fromClubId: sellerClubId,
          fromClubName: dealTarget.currentClub,
          toClubId: buyerUserClubId,
          toClubName: teamName,
          season: '2026/27',
          transferType: 'purchase',
          fee: feeNum
        })
      },
      clubProfile,
      { annualSalary, years, squadRole, signingBonus, agentFee: agentFeeNum },
      wageBudget.season,
      false
    );

    setPlayers([...players, newPlayer]);
    if (!starters.includes(newPlayer.id) && !bench.includes(newPlayer.id)) {
      setBench([...bench, newPlayer.id]);
    }
    setCareerWorld(current => ({
      ...current,
      clubWageBudgetState: {
        ...current.clubWageBudgetState,
        transferOneOffCostsThisSeason: current.clubWageBudgetState.transferOneOffCostsThisSeason + signingBonus + agentFeeNum
      }
    }));
    onTransferDNAEvent(newPlayer, 'buy', feeNum);

    addClubMemory(buildPurchaseMemory({
      target: dealTarget,
      fee: feeNum,
      bonus: signingBonus,
      agentFee: agentFeeNum,
      wage: weeklyWage,
      bidYears: years,
      dealStructure: dealTarget.clauseType ?? 'none',
      promiseType,
      budget,
      players,
      starters,
      clubWorld,
      clubHistory,
      teamDNA,
      teamName,
      newPlayer,
      remainingBudget
    }));

    const purchasePackageCost = feeNum + signingBonus * 0.45 + agentFeeNum;
    const isBigPurchase = promiseType === 'starRole' || purchasePackageCost >= budget * 0.5 || newPlayer.overall >= 84;
    const isRivalPurchase = clubHistory.rivalries.some(r => r.opponent === dealTarget.currentClub && r.heat >= 48);
    const purchaseTransferReaction = processCareerWorldAfterTransfer(careerWorld, {
      transferId: `buy_${newPlayer.id}`,
      season: '2026/27',
      direction: 'buy',
      playerId: newPlayer.id,
      playerName: newPlayer.name,
      playerAge: newPlayer.age,
      fee: feeNum,
      counterpartClub: dealTarget.currentClub,
      isRivalCounterpart: isRivalPurchase,
      isAcademyOrLocal: false,
      isPainfulSale: false,
      isBigSignature: isBigPurchase,
      isDnaAligned: (dnaMarket?.fit ?? 0) >= 72
    });
    setCareerWorld(purchaseTransferReaction.state);
    setClubHistory(current => applyRivalryTransferImpact(current, {
      opponentClub: dealTarget.currentClub,
      playerName: newPlayer.name,
      isRivalCounterpart: isRivalPurchase,
      isBigTransfer: isBigPurchase,
      season: '2026/27',
      direction: 'buy'
    }));
    const purchaseMediaResult = processMediaAfterTransfer(purchaseTransferReaction.state, {
      transferId: `buy_${newPlayer.id}`,
      season: '2026/27',
      round: currentRound,
      playerName: newPlayer.name,
      counterpartClub: dealTarget.currentClub,
      fee: feeNum,
      direction: 'buy',
      isRivalCounterpart: isRivalPurchase,
      isPainfulSale: false,
      isBigSignature: isBigPurchase,
      boardConfidence: purchaseTransferReaction.state.ownershipState.boardConfidence
    });
    setCareerWorld(purchaseMediaResult.state);
    purchaseMediaResult.news.forEach(item => addNewNews(item.title, item.content, item.category));
    setCareerWorld(current => resolveMarketRumorsAfterTransfer(current, { playerId: dealTarget.id, transferId: `buy_${newPlayer.id}` }));

    if (sourceClub) {
      const aiReplacement = replaceSoldPlayerForClub(
        clubWorld,
        dealTarget.currentClub,
        { name: dealTarget.playerName, role: newPlayer.role, overall: newPlayer.overall, value: dealTarget.value },
        feeNum,
        teamName
      );
      setClubWorld(aiReplacement.world);
      if (aiReplacement.incomingOffer) {
        const incomingOffer = aiReplacement.incomingOffer;
        setIncomingOffers([incomingOffer, ...incomingOffers]);
        const isRivalOffer = clubHistory.rivalries.some(r => r.opponent === incomingOffer.fromClub && r.heat >= 48);
        const rumorSignal: MarketRumorPlayerSignal = {
          playerId: incomingOffer.playerId,
          playerName: incomingOffer.playerName,
          hasIncomingOffer: true,
          incomingOfferFromClub: incomingOffer.fromClub,
          incomingOfferFromClubId: resolveClubId(incomingOffer.fromClub),
          incomingOfferIsRival: isRivalOffer,
          isBelovedOrIdol: careerWorld.fanState.mostLovedPlayerIds.includes(incomingOffer.playerId),
          isAcademyOrLocal: isAcademyOrLocalPlayer(clubHistory, incomingOffer.playerName),
          financialFragile: careerWorld.ownershipState.financialStatus === 'in_tensione' || careerWorld.ownershipState.financialStatus === 'critico',
        };
        setCareerWorld(current => processMarketRumorsAfterTransfer(current, { round: currentRound, season: '2026/27', signal: rumorSignal }));
      }
      if (aiReplacement.log) addNewNews('Mercato IA', aiReplacement.log, 'market');
    }

    addNewNews(
      exercisedBuyBackId ? `UFFICIALE: Contro-riscatto esercitato per ${dealTarget.playerName}!` : `UFFICIALE: Acquistato ${dealTarget.playerName}!`,
      `${teamName} chiude l'operazione: ${dealTarget.playerName} arriva dal ${dealTarget.currentClub} per ${formatCurrency(feeNum)}. Contratto: ${formatCurrency(annualSalary)}/anno per ${years} anni.${clauseNewsLine}`,
      'market'
    );

    setScoutedTargets(scoutedTargets.map(t => (
      t.id === dealTarget.id
        ? { ...dealTarget, status: 'completed' as const, concludedAt: new Date().toISOString(), concludedKind: 'purchase' as const }
        : t
    )));
    setContractTarget(null);
  };

  // Mercato M2B: scambio atomico. Completa SOLO qui (accordo club + contratto giocatore in entrata +
  // consenso gia' raccolto del mio giocatore in uscita): entrambi i giocatori si muovono nello stesso
  // passo, conguaglio applicato una sola volta, mai un budget/roster parziale.
  const finalizeSwap = (target: Negotiation, annualSalary: number, years: number, signingBonus: number, agentFeeNum: number, squadRole: ContractSquadRole) => {
    const dealTarget = target;
    const swapTerms = dealTarget.swapTerms;
    if (!swapTerms) return;
    const outgoingMyPlayer = players.find(p => p.id === swapTerms.offeredPlayerId);
    const sourceClub = clubWorld.find(club => club.name === dealTarget.currentClub);
    const incomingRealPlayer = sourceClub?.roster.find(player => player.name === dealTarget.playerName);
    if (!outgoingMyPlayer || !sourceClub || !incomingRealPlayer) {
      alert('Lo scambio non e piu eseguibile: uno dei due giocatori non e piu disponibile.');
      setContractTarget(null);
      return;
    }
    const currentSeason = careerWorld.clubWageBudgetState.season;

    const swapResult = finalizeSwapTransfer(
      incomingRealPlayer,
      outgoingMyPlayer,
      sourceClub,
      resolveClubId(teamName),
      teamName,
      currentSeason,
      { annualSalary, years, squadRole, signingBonus, agentFee: agentFeeNum },
      clubProfile,
      swapTerms.cashAdjustment,
      swapTerms.cashPaidBy
    );

    setBudget(budget - signingBonus - agentFeeNum + swapResult.cashDelta);
    setPlayers([...players.filter(p => p.id !== outgoingMyPlayer.id), swapResult.myNewPlayer]);
    setStarters(starters.filter(id => id !== outgoingMyPlayer.id));
    setBench([...bench.filter(id => id !== outgoingMyPlayer.id), swapResult.myNewPlayer.id]);
    setClubWorld(clubWorld.map(club => (
      club.clubId === sourceClub.clubId
        ? {
            ...club,
            roster: [...club.roster.filter(p => p.id !== incomingRealPlayer.id), swapResult.outgoingPlayerForOtherClub],
            transferLog: [`${club.name} scambia ${incomingRealPlayer.name} con ${outgoingMyPlayer.name} (${teamName}).`, ...club.transferLog].slice(0, 12)
          }
        : club
    )));
    setCareerWorld(current => ({
      ...current,
      clubWageBudgetState: {
        ...current.clubWageBudgetState,
        transferOneOffCostsThisSeason: current.clubWageBudgetState.transferOneOffCostsThisSeason + signingBonus + agentFeeNum
      }
    }));
    onTransferDNAEvent(swapResult.myNewPlayer, 'buy', swapTerms.estimatedPlayerValue ?? incomingRealPlayer.value);
    onTransferDNAEvent(outgoingMyPlayer, 'sell', swapTerms.estimatedPlayerValue ?? outgoingMyPlayer.value);

    const cashNote = swapTerms.cashPaidBy === 'none' ? 'senza conguaglio' : `con conguaglio di ${formatCurrency(swapTerms.cashAdjustment)} (${SWAP_CASH_DIRECTION_LABELS[swapTerms.cashPaidBy].toLowerCase()})`;
    addNewNews(
      `UFFICIALE: Scambio con il ${dealTarget.currentClub}!`,
      `${teamName} riceve ${dealTarget.playerName} e cede ${outgoingMyPlayer.name} al ${dealTarget.currentClub}, ${cashNote}. Contratto per ${dealTarget.playerName}: ${formatCurrency(annualSalary)}/anno per ${years} anni.`,
      'market'
    );

    setScoutedTargets(scoutedTargets.map(t => (
      t.id === dealTarget.id
        ? { ...dealTarget, status: 'completed' as const, swapTerms: { ...swapTerms, status: 'completed' as const }, concludedAt: new Date().toISOString(), concludedKind: 'purchase' as const }
        : t
    )));
    setContractTarget(null);
  };

  // Mercato M2B: svincolato. Nessun cartellino, solo il flusso contratto gia' esistente; il
  // giocatore e' gia' reale (players array), mai fabbricato. Entra in rosa in modo atomico.
  const finalizeFreeAgentSigning = (target: Negotiation, annualSalary: number, years: number, signingBonus: number, agentFeeNum: number, squadRole: ContractSquadRole) => {
    const dealTarget = target;
    const realPlayer = players.find(p => p.id === dealTarget.id.replace('freeagent_', ''));
    if (!realPlayer) {
      alert('Il giocatore svincolato non e piu disponibile.');
      setContractTarget(null);
      return;
    }
    const weeklyWage = toWeeklyWage(annualSalary);
    const remainingBudget = budget - (signingBonus + agentFeeNum);
    setBudget(remainingBudget);

    const newPlayer = applySignedContract(
      {
        ...realPlayer,
        wage: weeklyWage,
        contractYears: years,
        status: 'Disponibile' as const,
        squadStatus: 'first_team' as const,
        clubHistory: applyPlayerTransferToClubHistory(realPlayer.clubHistory, {
          fromClubId: resolveClubId('Svincolato'),
          fromClubName: 'Svincolato',
          toClubId: resolveClubId(teamName),
          toClubName: teamName,
          season: careerWorld.clubWageBudgetState.season,
          transferType: 'purchase',
          fee: 0
        })
      },
      clubProfile,
      { annualSalary, years, squadRole, signingBonus, agentFee: agentFeeNum },
      wageBudget.season,
      false
    );

    setPlayers(players.map(p => (p.id === realPlayer.id ? newPlayer : p)));
    if (!starters.includes(newPlayer.id) && !bench.includes(newPlayer.id)) {
      setBench([...bench, newPlayer.id]);
    }
    setCareerWorld(current => ({
      ...current,
      clubWageBudgetState: {
        ...current.clubWageBudgetState,
        transferOneOffCostsThisSeason: current.clubWageBudgetState.transferOneOffCostsThisSeason + signingBonus + agentFeeNum
      }
    }));
    onTransferDNAEvent(newPlayer, 'buy', 0);

    addNewNews(
      `UFFICIALE: Tesserato ${realPlayer.name}!`,
      `${teamName} tessera lo svincolato ${realPlayer.name} a parametro zero. Contratto: ${formatCurrency(annualSalary)}/anno per ${years} anni.`,
      'market'
    );

    setScoutedTargets(scoutedTargets.map(t => (
      t.id === dealTarget.id
        ? { ...dealTarget, status: 'completed' as const, concludedAt: new Date().toISOString(), concludedKind: 'purchase' as const }
        : t
    )));
    setContractTarget(null);
  };

  // Conclude un prestito: entra temporaneamente in rosa, indennizzo sottratto una sola volta alla
  // firma, nessun riscatto sottratto ora (diritto/obbligo si processano solo dopo, mai qui).
  const finalizeLoan = (target: Negotiation) => {
    const terms = target.terms;
    if (!terms) return;
    const loanFee = terms.loanFee ?? 0;
    const sourceClub = clubWorld.find(club => club.name === target.currentClub);
    const realPlayer = sourceClub?.roster.find(player => player.name === target.playerName);
    const basePlayer = realPlayer ?? estimateSignedPlayer(target, target.wage, 1);
    const season = careerWorld.clubWageBudgetState.season;
    const parentClubId = sourceClub?.clubId ?? resolveClubId(target.currentClub);
    const receivingClubId = resolveClubId(teamName);

    const loanState = buildLoanState(terms, parentClubId, target.currentClub, receivingClubId, season, basePlayer.wage);
    const weeklyShare = getLoanWeeklyWage(basePlayer, loanState);

    const loanedPlayer: Player = {
      ...basePlayer,
      id: `loan_${basePlayer.id}_${Date.now()}`,
      wage: weeklyShare,
      contractYears: 1,
      loanState,
      contract: buildLoanContract({ ...basePlayer, wage: weeklyShare }, loanState, season),
      morale: Math.max(basePlayer.morale, 80),
      condition: 100,
      status: 'Disponibile' as const,
      clubHistory: applyPlayerTransferToClubHistory(realPlayer?.clubHistory, {
        fromClubId: parentClubId,
        fromClubName: target.currentClub,
        toClubId: receivingClubId,
        toClubName: teamName,
        season,
        transferType: 'loan',
        fee: loanFee
      })
    };

    setBudget(budget - loanFee);
    setPlayers([...players, loanedPlayer]);
    if (!starters.includes(loanedPlayer.id) && !bench.includes(loanedPlayer.id)) {
      setBench([...bench, loanedPlayer.id]);
    }

    addNewNews(
      `UFFICIALE: ${target.playerName} in prestito!`,
      `${teamName} preleva in prestito ${target.playerName} dal ${target.currentClub} (${PURCHASE_CLAUSE_LABELS[terms.purchaseClause]}). Indennizzo: ${formatCurrency(loanFee)}.`,
      'market'
    );

    setScoutedTargets(scoutedTargets.map(t => (
      t.id === target.id
        ? { ...target, status: 'completed' as const, concludedAt: new Date().toISOString(), concludedKind: 'purchase' as const }
        : t
    )));
    setLoanTarget(null);
  };

  // Mercato M2C: scambio di prestiti atomico. Mai cartellino/conguaglio/rate/diritto/obbligo; il
  // budget trasferimenti non cambia. Entrambi i loanState condividono lo stesso loanSwapId.
  const finalizeLoanSwap = (target: Negotiation) => {
    const terms = target.loanSwapTerms;
    if (!terms) return;
    const sourceClub = clubWorld.find(club => club.name === target.currentClub);
    const incomingRealPlayer = sourceClub?.roster.find(p => p.name === target.playerName);
    const outgoingMyPlayer = players.find(p => p.id === terms.userOutgoingPlayerId);
    if (!sourceClub || !incomingRealPlayer || !outgoingMyPlayer) {
      alert('Lo scambio di prestiti non e piu eseguibile: uno dei due giocatori non e piu disponibile.');
      setLoanTarget(null);
      return;
    }
    const season = careerWorld.clubWageBudgetState.season;
    const swapResult = finalizeLoanSwapTransfer(incomingRealPlayer, outgoingMyPlayer, terms, resolveClubId(teamName), teamName, season);

    setPlayers([...players.filter(p => p.id !== outgoingMyPlayer.id), swapResult.incomingPlayerForMe]);
    setStarters(starters.filter(id => id !== outgoingMyPlayer.id));
    setBench([...bench.filter(id => id !== outgoingMyPlayer.id), swapResult.incomingPlayerForMe.id]);
    setClubWorld(clubWorld.map(club => (
      club.clubId === sourceClub.clubId
        ? {
            ...club,
            roster: [...club.roster.filter(p => p.id !== incomingRealPlayer.id), swapResult.outgoingPlayerForOtherClub],
            transferLog: [`${club.name} scambia in prestito ${incomingRealPlayer.name} con ${outgoingMyPlayer.name} (${teamName}).`, ...club.transferLog].slice(0, 12)
          }
        : club
    )));
    addNewNews(
      `UFFICIALE: Scambio di prestiti con il ${target.currentClub}!`,
      `${teamName} preleva in prestito ${target.playerName} e cede in prestito ${outgoingMyPlayer.name} al ${target.currentClub}, fino a fine stagione. Nessun cartellino, nessun conguaglio.`,
      'market'
    );
    setScoutedTargets(scoutedTargets.map(t => (
      t.id === target.id
        ? { ...target, status: 'completed' as const, loanSwapTerms: { ...terms, status: 'completed' as const }, concludedAt: new Date().toISOString(), concludedKind: 'purchase' as const }
        : t
    )));
    setLoanTarget(null);
  };

  // ─────────────────────────────────────────────────────────────
  // Mercato M3: dopo accordo club + accordo giocatore, la trattativa NON completa subito. Passa a
  // visite mediche -> registrazione -> completamento atomico (le finalizeXxx esistenti restano il
  // punto 5 "registrazione completata", invariate). Il giocatore entra in rosa/lascia la rosa solo
  // a quel punto.
  // ─────────────────────────────────────────────────────────────

  // Trova il/i giocatori reali coinvolti in questa trattativa per la visita medica: entrambe le meta'
  // per scambio/scambio di prestiti, altrimenti solo il giocatore in arrivo.
  const findMedicalCheckPlayers = (target: Negotiation): Player[] => {
    if (target.swapTerms) {
      const incoming = findPlayerForTarget(target);
      const outgoing = players.find(p => p.id === target.swapTerms!.offeredPlayerId);
      return [incoming, outgoing].filter((p): p is Player => !!p);
    }
    if (target.loanSwapTerms) {
      const sourceClub = clubWorld.find(club => club.name === target.currentClub);
      const incoming = sourceClub?.roster.find(p => p.name === target.playerName);
      const outgoing = players.find(p => p.id === target.loanSwapTerms!.userOutgoingPlayerId);
      return [incoming, outgoing].filter((p): p is Player => !!p);
    }
    if (target.terms?.baseType === 'loan') {
      const sourceClub = clubWorld.find(club => club.name === target.currentClub);
      const found = sourceClub?.roster.find(p => p.name === target.playerName);
      return found ? [found] : [];
    }
    if (target.id.startsWith('freeagent_')) {
      const found = players.find(p => p.id === target.id.replace('freeagent_', ''));
      return found ? [found] : [];
    }
    const found = findPlayerForTarget(target);
    return found ? [found] : [];
  };

  // Accordo raggiunto (club + giocatore): congela i termini contrattuali (sopravvivono a un F5) e
  // ferma la trattativa a 'player_contract_accepted'. Nessuna visita ancora: l'utente la avvia.
  const beginPostAgreementPipeline = (
    target: Negotiation,
    frozenContract: { annualSalary: number; years: number; signingBonus: number; agentFee: number; squadRole: ContractSquadRole } | null
  ) => {
    setScoutedTargets(scoutedTargets.map(t => (t.id === target.id ? {
      ...t,
      status: 'player_contract_accepted' as const,
      contractOfferAnnualSalary: frozenContract?.annualSalary ?? t.contractOfferAnnualSalary,
      contractOfferYears: frozenContract?.years ?? t.contractOfferYears,
      contractOfferSigningBonus: frozenContract?.signingBonus ?? t.contractOfferSigningBonus,
      contractOfferAgentFee: frozenContract?.agentFee ?? t.contractOfferAgentFee,
      pendingContractSquadRole: frozenContract?.squadRole ?? t.pendingContractSquadRole,
      lastUpdatedRound: currentRound,
      playerWaitingReason: undefined,
      timeline: [...t.timeline, 'Accordo raggiunto: in attesa di avviare le visite mediche.']
    } : t)));
    setContractTarget(null);
    setLoanTarget(null);
  };

  // Visita medica: deterministica, non punitiva. Un solo esito per trattativa (guardia sullo status:
  // una volta lasciato 'player_contract_accepted' non si torna indietro a rieseguirla).
  const handleStartMedicalCheck = (target: Negotiation) => {
    setScoutedTargets(scoutedTargets.map(t => (t.id === target.id ? { ...t, status: 'medical_pending' as const } : t)));
    setTimeout(() => {
      const medicalPlayers = findMedicalCheckPlayers(target);
      if (medicalPlayers.length === 0) {
        setScoutedTargets(scoutedTargets.map(t => (t.id === target.id ? {
          ...t,
          status: 'registration_failed' as const,
          registrationFailureReason: 'Il giocatore non e piu disponibile per questa operazione.',
          concludedAt: new Date().toISOString(),
          concludedKind: 'rejected' as const
        } : t)));
        return;
      }
      const checks = medicalPlayers.map(p => runMedicalCheck(target.id, p, currentRound));
      const check = checks.length > 1 ? combineMedicalChecks(checks[0], checks[1]) : checks[0];
      const nextStatus: NegotiationStatus = check.status === 'failed' ? 'medical_failed' : check.status === 'warning' ? 'medical_warning' : 'registration_pending';
      setScoutedTargets(scoutedTargets.map(t => (t.id === target.id ? {
        ...t,
        status: nextStatus,
        medicalCheck: check,
        lastUpdatedRound: currentRound,
        concludedAt: nextStatus === 'medical_failed' ? new Date().toISOString() : t.concludedAt,
        concludedKind: nextStatus === 'medical_failed' ? 'rejected' as const : t.concludedKind,
        timeline: [...t.timeline, nextStatus === 'medical_failed'
          ? `Visite mediche non superate: ${check.riskSummary ?? 'idoneita non confermata'}.`
          : nextStatus === 'medical_warning'
            ? `Visite mediche: ${check.riskSummary ?? 'rischio da valutare'}.`
            : 'Visite mediche superate: si procede con la registrazione.']
      } : t)));
    }, 900);
  };

  // Avvertenza medica: scelta esplicita dell'utente, mai automatica. "Procede comunque" non tocca
  // rosa/budget: sposta solo alla registrazione, che ha i suoi controlli reali.
  const handleProceedDespiteWarning = (target: Negotiation) => {
    setScoutedTargets(scoutedTargets.map(t => (t.id === target.id ? {
      ...t,
      status: 'registration_pending' as const,
      lastUpdatedRound: currentRound,
      timeline: [...t.timeline, 'Il club procede nonostante l\'avvertenza medica.']
    } : t)));
  };

  // Registrazione: controlli reali (finestra, budget, disponibilita del giocatore), poi completamento
  // atomico tramite le finalizeXxx esistenti (mai una doppia implementazione della mutazione).
  const handleCompleteRegistration = (target: Negotiation) => {
    const medicalPlayers = findMedicalCheckPlayers(target);
    const windowRestricted = isMarketWindowRestrictedTarget(target.id);
    const annualSalary = target.contractOfferAnnualSalary ?? 0;
    const signingBonus = target.contractOfferSigningBonus ?? 0;
    const agentFee = target.contractOfferAgentFee ?? 0;
    let financeOk = { transferBudgetOk: true, wageBudgetOk: true };
    if (target.loanSwapTerms) {
      // Mercato M2C: nessun costo/budget trasferimenti per uno scambio di prestiti.
      financeOk = { transferBudgetOk: true, wageBudgetOk: true };
    } else if (target.terms?.baseType === 'loan') {
      const weeklyShare = Math.round((target.wage ?? 0) * (target.terms.wageSharePercent ?? 0) / 100);
      const impact = calculateContractFinancialImpact(
        { annualSalary: toAnnualSalary(weeklyShare), signingBonus: 0, agentFee: 0 },
        budget - (target.terms.loanFee ?? 0),
        wageBudget
      );
      financeOk = impact;
    } else {
      const cashToPay = target.swapTerms ? (target.swapTerms.cashPaidBy === 'user_club' ? target.swapTerms.cashAdjustment : 0) : (target.clubAgreedFee ?? 0);
      const impact = calculateContractFinancialImpact(
        { annualSalary, signingBonus, agentFee },
        budget - cashToPay,
        wageBudget
      );
      financeOk = impact;
    }
    const readiness = evaluateRegistrationReadiness({
      windowOpen: !windowRestricted || marketWindowOpen,
      transferBudgetOk: financeOk.transferBudgetOk,
      wageBudgetOk: financeOk.wageBudgetOk,
      playerStillAvailable: medicalPlayers.length > 0 && (medicalPlayers.length === 1 || medicalPlayers.length === 2),
      incompatibleActiveState: false
    });
    if (!readiness.ok) {
      setScoutedTargets(scoutedTargets.map(t => (t.id === target.id ? {
        ...t,
        status: 'registration_failed' as const,
        registrationFailureReason: readiness.reasons.join(' '),
        concludedAt: new Date().toISOString(),
        concludedKind: 'rejected' as const,
        timeline: [...t.timeline, `Registrazione fallita: ${readiness.reasons.join(' ')}`]
      } : t)));
      return;
    }
    const years = target.contractOfferYears ?? 1;
    const squadRole = target.pendingContractSquadRole ?? 'rotation';
    if (target.swapTerms) {
      finalizeSwap(target, annualSalary, years, signingBonus, agentFee, squadRole);
    } else if (target.loanSwapTerms) {
      finalizeLoanSwap(target);
    } else if (target.terms?.baseType === 'loan') {
      finalizeLoan(target);
    } else if (target.id.startsWith('freeagent_')) {
      finalizeFreeAgentSigning(target, annualSalary, years, signingBonus, agentFee, squadRole);
    } else {
      finalizePurchase(target, annualSalary, years, signingBonus, agentFee, squadRole);
    }
  };

  const handleSendLoanAcceptance = () => {
    if (!loanTarget || !loanContractPreview) return;
    const { evaluation, impact } = loanContractPreview;

    setIsNegotiatingContract(true);
    setTimeout(() => {
      setIsNegotiatingContract(false);

      if (evaluation.decision === 'accepted') {
        if (loanTarget.loanSwapTerms) {
          // Mercato M3: nessun costo per lo scambio di prestiti, ma visite/registrazione restano obbligatorie.
          beginPostAgreementPipeline(loanTarget, null);
          return;
        }
        if (!impact.transferBudgetOk) {
          alert('Budget trasferimenti insufficiente per l\'indennizzo del prestito.');
          return;
        }
        if (!impact.wageBudgetOk) {
          alert('Budget stipendi insufficiente per la quota a tuo carico.');
          return;
        }
        beginPostAgreementPipeline(loanTarget, null);
        return;
      }

      if (evaluation.decision === 'blocked_budget' || evaluation.decision === 'blocked_role' || evaluation.decision === 'blocked_duration') {
        alert(evaluation.message);
        return;
      }

      // Per i prestiti la quota stipendio e' gia' fissata in fase 1: se il giocatore non l'accetta
      // (controproposta o rifiuto), la trattativa fallisce senza toccare rosa o budget.
      setScoutedTargets(scoutedTargets.map(t => (
        t.id === loanTarget.id
          ? { ...t, status: 'player_contract_rejected' as const, concludedAt: new Date().toISOString(), concludedKind: 'rejected' as const, timeline: [...t.timeline, evaluation.message] }
          : t
      )));
      setLoanTarget(null);
    }, 1200);
  };

  // Diritto di riscatto: azione esplicita dell'utente, mai automatica. Converte subito in acquisto
  // definitivo, sottraendo il prezzo del diritto una sola volta.
  const handleExerciseLoanOption = (player: Player) => {
    const loanState = player.loanState;
    if (!loanState || loanState.purchaseClause !== 'option') return;
    const purchaseFee = loanState.purchaseFee ?? 0;
    if (purchaseFee > budget) {
      alert(`Budget trasferimenti insufficiente per esercitare il diritto di riscatto (${formatCurrency(purchaseFee)}).`);
      return;
    }
    const season = careerWorld.clubWageBudgetState.season;
    const annualSalary = toAnnualSalary(loanState.originalWeeklyWage || player.wage);
    const converted: Player = {
      ...player,
      wage: toWeeklyWage(annualSalary),
      contractYears: 3,
      loanState: undefined,
      contract: {
        annualSalary,
        startSeason: season,
        endSeason: season,
        durationYears: 3,
        squadRole: inferContractSquadRole(player),
        bonuses: {
          signingBonus: 0, agentFee: 0, appearanceBonus: 0, goalBonus: 0,
          cleanSheetBonus: 0, annualLoyaltyBonus: 0, teamAchievementBonus: 0
        },
        annualSalaryIncreasePercent: 0,
        status: 'active',
        earnedBonusesThisSeason: 0,
        projectedBonusReserve: Math.round(annualSalary * 0.05),
        processedBonusMatchIds: []
      },
      clubHistory: applyPlayerTransferToClubHistory(player.clubHistory, {
        fromClubId: loanState.parentClubId,
        fromClubName: loanState.parentClubName,
        toClubId: resolveClubId(teamName),
        toClubName: teamName,
        season,
        transferType: 'purchase',
        fee: purchaseFee
      })
    };
    setBudget(budget - purchaseFee);
    setPlayers(players.map(p => (p.id === player.id ? converted : p)));
    addNewNews(
      `UFFICIALE: Riscattato ${player.name}!`,
      `${teamName} esercita il diritto di riscatto per ${player.name}: operazione a titolo definitivo per ${formatCurrency(purchaseFee)}.`,
      'market'
    );
  };

  // Restituzione anticipata al club proprietario: libera subito lo spazio stipendio (il budget e'
  // sempre ricalcolato dal vivo sulla rosa attuale, nessuna contabilita' manuale necessaria).
  const handleReturnLoanedPlayer = (player: Player) => {
    const loanState = player.loanState;
    if (!loanState) return;
    setPlayers(players.filter(p => p.id !== player.id));
    setStarters(starters.filter(id => id !== player.id));
    setBench(bench.filter(id => id !== player.id));
    addNewNews(
      `Fine prestito: ${player.name}`,
      `${player.name} rientra al ${loanState.parentClubName} al termine del prestito.`,
      'market'
    );
  };

  // Mercato M2A: contro-riscatto attivo del mio club. Avvia la normale fase contratto (prezzo gia'
  // fissato dalla clausola), non completa subito il ritorno in rosa: serve il si del giocatore.
  const handleExerciseBuyBack = (player: Player, clause: BuyBackClause) => {
    if (clause.buyBackFee > budget) {
      alert(`Budget trasferimenti insufficiente per il contro-riscatto (${formatCurrency(clause.buyBackFee)}).`);
      return;
    }
    const ownerClub = clubWorld.find(club => club.roster.some(p => p.id === player.id));
    if (!ownerClub) {
      alert(`${player.name} non e piu nel club previsto: il contro-riscatto non e al momento eseguibile.`);
      return;
    }
    const negotiation: Negotiation = {
      id: `buyback_${clause.id}`,
      playerName: player.name,
      role: player.role,
      currentClub: ownerClub.name,
      value: clause.buyBackFee,
      wage: player.wage,
      offeredFee: clause.buyBackFee,
      offeredWage: 0,
      offeredContractYears: 0,
      probability: 100,
      status: 'club_offer_accepted',
      timeline: [`Contro-riscatto attivato: ${teamName} puo riacquistare ${player.name} dal ${ownerClub.name} per ${formatCurrency(clause.buyBackFee)}.`],
      clubAgreedFee: clause.buyBackFee,
      terms: { baseType: 'permanent', purchaseClause: 'none', upfrontFee: clause.buyBackFee, installments: [], futureFinancialCommitment: 0 }
    };
    setScoutedTargets([negotiation, ...scoutedTargets.filter(t => t.id !== negotiation.id)]);
    handleOpenContractNegotiation(negotiation);
    setMarketTab('trattative');
  };

  // Mercato M2B: svincolato reale (squadStatus 'released' gia' esistente nel salvataggio). Nessun
  // cartellino: apre direttamente la fase contratto, "Tratta contratto" al posto di "Avvia trattativa".
  const handleTreatFreeAgent = (player: Player) => {
    const negotiation: Negotiation = {
      id: `freeagent_${player.id}`,
      playerName: player.name,
      role: player.role,
      currentClub: 'Svincolato',
      value: 0,
      wage: player.wage,
      offeredFee: 0,
      offeredWage: 0,
      offeredContractYears: 0,
      probability: 100,
      status: 'club_offer_accepted',
      timeline: [`${player.name} e svincolato: nessun cartellino, solo il contratto.`],
      clubAgreedFee: 0,
      terms: { baseType: 'permanent', purchaseClause: 'none', upfrontFee: 0, installments: [], futureFinancialCommitment: 0 }
    };
    setScoutedTargets([negotiation, ...scoutedTargets.filter(t => t.id !== negotiation.id)]);
    handleOpenContractNegotiation(negotiation);
    setMarketTab('trattative');
  };

  // Mercato M2B: propone un precontratto (stagione successiva). Apre un modal dedicato: mai il
  // flusso "contractTarget" normale, perche' l'accordo non deve toccare rosa/budget ora.
  const handleProposePrecontract = (player: Player, clubName: string) => {
    const eligibility = isPrecontractEligible(player, currentRound, careerWorld.futureContractAgreements);
    if (!eligibility.eligible) {
      alert(eligibility.reason ?? 'Precontratto non disponibile per questo giocatore.');
      return;
    }
    const negotiation: Negotiation = {
      id: `precontract_target_${player.id}`,
      playerName: player.name,
      role: player.role,
      currentClub: clubName,
      value: 0,
      wage: player.wage,
      offeredFee: 0,
      offeredWage: 0,
      offeredContractYears: 0,
      probability: 100,
      status: 'draft',
      timeline: [`Proposta di precontratto per la prossima stagione a ${player.name}.`]
    };
    const demand = getPlayerContractDemand(player, clubProfile, { starters, bench, seasonStats: playerStats, clubHistory, round: currentRound });
    setPrecontractTarget(negotiation);
    setPrecontractWage(Math.round(toWeeklyWage(demand.demandedAnnualSalary)).toString());
    setPrecontractYears(demand.demandedYears);
    setPrecontractSigningBonus(Math.round(demand.demandedAnnualSalary * 0.08).toString());
    setPrecontractAgentFee(Math.round(demand.demandedAnnualSalary * 0.12).toString());
    setMarketTab('trattative');
  };

  const precontractPreview = precontractTarget ? (() => {
    const annualSalary = toAnnualSalary(Number(precontractWage) || 0);
    const signingBonus = Number(precontractSigningBonus) || 0;
    const agentFeeNum = Number(precontractAgentFee) || 0;
    const realPlayer = findPlayerForTarget(precontractTarget);
    const evalPlayer = realPlayer ?? estimateSignedPlayer(precontractTarget, Number(precontractWage) || precontractTarget.wage, precontractYears);
    const squadRole: ContractSquadRole = inferContractSquadRole(evalPlayer, {});
    // Riusa lo stesso motore di valutazione contrattuale: un precontratto e' un'offerta di contratto,
    // solo con effetto rimandato alla stagione successiva (nessun segnale nuovo da inventare).
    const evaluation = evaluateContractOffer(
      evalPlayer,
      clubProfile,
      { annualSalary, years: precontractYears, squadRole },
      wageBudget,
      { starters, bench, seasonStats: playerStats, clubHistory, round: currentRound },
      highestSquadAnnualSalary
    );
    return { annualSalary, signingBonus, agentFeeNum, evaluation, evalPlayer, squadRole };
  })() : null;

  // Il precontratto NON tocca subito rosa/budget/clubHistory: salva solo l'impegno futuro. Si
  // completa una sola volta, al punto sicuro di fine stagione (MatchCenter).
  const handleSendPrecontractOffer = () => {
    if (!precontractTarget || !precontractPreview) return;
    const { annualSalary, signingBonus, agentFeeNum, evaluation, evalPlayer, squadRole } = precontractPreview;
    if (isNaN(annualSalary) || annualSalary <= 0) {
      alert('Inserisci uno stipendio annuo valido.');
      return;
    }

    setIsProposingPrecontract(true);
    setTimeout(() => {
      setIsProposingPrecontract(false);

      if (evaluation.decision !== 'accepted') {
        alert(evaluation.message);
        setPrecontractTarget(null);
        return;
      }

      const sourceClub = clubWorld.find(c => c.name === precontractTarget.currentClub);
      const agreement = createFutureContractAgreement(
        evalPlayer,
        sourceClub?.clubId ?? resolveClubId(precontractTarget.currentClub),
        precontractTarget.currentClub,
        annualSalary,
        precontractYears,
        squadRole,
        {
          signingBonus, agentFee: agentFeeNum, appearanceBonus: Math.round(annualSalary / 40 * 0.06),
          goalBonus: Math.round(annualSalary / 40 * 0.18), cleanSheetBonus: 0,
          annualLoyaltyBonus: Math.round(annualSalary * 0.02), teamAchievementBonus: Math.round(annualSalary * 0.04)
        },
        signingBonus,
        agentFeeNum,
        careerWorld.clubWageBudgetState.season,
        careerWorld.clubWageBudgetState.season
      );
      setCareerWorld(current => ({
        ...current,
        futureContractAgreements: [agreement, ...current.futureContractAgreements].slice(0, 40)
      }));
      addNewNews(
        `Precontratto firmato: ${evalPlayer.name}`,
        `${evalPlayer.name} accetta un precontratto con ${teamName} per la prossima stagione: ${formatCurrency(annualSalary)}/anno per ${precontractYears} anni. Si trasferira a parametro zero a fine stagione.`,
        'market'
      );
      setPrecontractTarget(null);
    }, 1200);
  };

  const handleSendContractOffer = () => {
    if (!contractTarget || !contractPreview) return;
    const { annualSalary, signingBonus, agentFeeNum, evaluation, impact, squadRole } = contractPreview;

    if (isNaN(annualSalary) || annualSalary <= 0) {
      alert('Inserisci uno stipendio annuo valido.');
      return;
    }

    setIsNegotiatingContract(true);
    setTimeout(() => {
      setIsNegotiatingContract(false);

      if (evaluation.decision === 'accepted') {
        if (!impact.transferBudgetOk) {
          alert(contractTarget.swapTerms ? 'Budget trasferimenti insufficiente per conguaglio + costi una tantum (bonus firma/agente).' : 'Budget trasferimenti insufficiente per cartellino + costi una tantum (bonus firma/agente).');
          return;
        }
        if (!impact.wageBudgetOk) {
          alert('Budget stipendi insufficiente per questo ingaggio.');
          return;
        }
        // Mercato M4: solo per acquisti definitivi in scope, il giocatore puo' voler valutare il
        // mercato prima di rispondere (agente paziente/aggressivo/career_focused, o concorrenza
        // attiva). Mai un'attesa infinita: resolvePlayerWaitingDecision la limita da sola.
        if (isCompetitionEligibleNegotiation(contractTarget.id, contractTarget.terms?.baseType, !!contractTarget.swapTerms, !!contractTarget.loanSwapTerms)) {
          const playerForAgent = findPlayerForTarget(contractTarget);
          if (playerForAgent) {
            const agentProfile = ensurePlayerAgentProfile(playerForAgent, careerWorld.playerAgentProfiles);
            if (!careerWorld.playerAgentProfiles.some(p => p.playerId === agentProfile.playerId)) {
              setCareerWorld(current => ({ ...current, playerAgentProfiles: [...current.playerAgentProfiles, agentProfile] }));
            }
            const competition = careerWorld.transferCompetitions.find(c => c.negotiationId === contractTarget.id);
            const waitingSince = contractTarget.lastUpdatedRound ?? contractTarget.createdRound ?? currentRound;
            const waitDecision = resolvePlayerWaitingDecision(agentProfile, competition, waitingSince, currentRound, activeTransferWindow?.status === 'closing_soon');
            if (waitDecision.waits) {
              setScoutedTargets(scoutedTargets.map(t => (t.id === contractTarget.id ? {
                ...t,
                lastUpdatedRound: t.lastUpdatedRound ?? currentRound,
                playerWaitingReason: waitDecision.reason,
                timeline: [...t.timeline, waitDecision.reason]
              } : t)));
              setContractTarget(null);
              return;
            }
          }
        }
        // Mercato M3: l'accordo col giocatore non completa piu subito l'operazione. Congela i termini
        // e passa a visite mediche -> registrazione (vedi beginPostAgreementPipeline).
        beginPostAgreementPipeline(contractTarget, { annualSalary, years: contractYears, signingBonus, agentFee: agentFeeNum, squadRole });
        return;
      }

      if (evaluation.decision === 'blocked_budget' || evaluation.decision === 'blocked_role' || evaluation.decision === 'blocked_duration') {
        alert(evaluation.message);
        return;
      }

      if (evaluation.decision === 'counter') {
        setScoutedTargets(scoutedTargets.map(t => (
          t.id === contractTarget.id
            ? {
                ...t,
                status: 'player_counter_offer' as const,
                contractCounterAnnualSalary: evaluation.counterOffer?.demandedAnnualSalary,
                contractCounterYears: evaluation.counterOffer?.demandedYears,
                timeline: [...t.timeline, `Il giocatore chiede ${formatCurrency(evaluation.counterOffer?.demandedAnnualSalary ?? annualSalary)}/anno.`]
              }
            : t
        )));
        setContractTarget(null);
        return;
      }

      // rejected
      setScoutedTargets(scoutedTargets.map(t => (
        t.id === contractTarget.id
          ? { ...t, status: 'player_contract_rejected' as const, concludedAt: new Date().toISOString(), concludedKind: 'rejected' as const, timeline: [...t.timeline, evaluation.message] }
          : t
      )));
      setContractTarget(null);
    }, 1200);
  };

  const pendingIncomingOffers = incomingOffers.filter(offer => offer.status === 'pending' || offer.status === 'awaiting_player_decision');
  const recentOutgoingOutcomes = incomingOffers
    .filter(offer => ['accepted', 'rejected', 'player_declined', 'expired'].includes(offer.status))
    .slice(0, 5);

  // Mercato M2C: prelazioni da esercitare, clausole anti-rivali attive, scambi di prestiti attivi (entrambe le meta').
  const pendingFirstRefusalTriggers = careerWorld.firstRefusalTriggers.filter(t => t.status === 'pending');
  const myActiveAntiRivalClauses = players
    .filter(p => (p.antiRivalClauses ?? []).some(c => c.status === 'active'))
    .map(p => ({ player: p, clause: p.antiRivalClauses!.find(c => c.status === 'active')! }));
  const loanSwapHomePlayers = players.filter(p => p.loanState?.loanSwapId);
  const loanSwapAwayPlayers = clubWorld.flatMap(club => club.roster
    .filter(p => p.loanState?.loanSwapId && p.loanState.parentClubId === resolveClubId(teamName))
    .map(p => ({ player: p, atClub: club.name })));

  // ─────────────────────────────────────────────────────────────
  // Mercato Cessioni C1: interesse dinamico, disponibilita reale, offerte spontanee.
  // Metti in vendita = piu' visibilita, mai un'offerta garantita.
  // ─────────────────────────────────────────────────────────────
  const outgoingMarketSummary = getOutgoingMarketSummary(careerWorld.outgoingMarketState, players, clubWorld);
  const firstTeamPlayers = players.filter(player => (player.squadStatus ?? 'first_team') === 'first_team');
  const outgoingPlayers = firstTeamPlayers.filter(player => getEffectiveAvailability(player) !== 'available_for_right_offer');
  const availablePlayersToList = firstTeamPlayers.filter(player => getEffectiveAvailability(player) === 'available_for_right_offer');

  const handleSetPlayerAvailability = (player: Player, availability: TransferAvailability) => {
    const marksAsListed = ['listed_for_sale', 'loan_listed', 'sale_or_loan'].includes(availability);
    setPlayers(players.map(p => (p.id === player.id ? {
      ...p,
      transferAvailability: availability,
      lastAvailabilityChangeRound: currentRound,
      listedAtRound: marksAsListed && p.listedAtRound === undefined ? currentRound : p.listedAtRound
    } : p)));
  };

  const handleCommitAskingPrice = (player: Player, raw: string) => {
    const num = Number(raw);
    setPlayers(players.map(p => (p.id === player.id ? { ...p, askingPrice: raw.trim() === '' || isNaN(num) ? undefined : Math.max(0, Math.round(num)) } : p)));
  };

  const handleCommitMinimumPrice = (player: Player, raw: string) => {
    const num = Number(raw);
    setPlayers(players.map(p => (p.id === player.id ? { ...p, minimumAcceptablePrice: raw.trim() === '' || isNaN(num) ? undefined : Math.max(0, Math.round(num)) } : p)));
  };
  // Riepilogo economico fisso (Mercato M1): sempre calcolato dai termini reali del form fase 1,
  // qualunque sia la formula scelta. Mai un'etichetta generica tipo "Cartellino offerto".
  const roundsLeftInSeason = Math.max(1, 38 - currentRound);
  const offerTermsPreview = biddingPlayer ? buildOfferTerms() : null;
  const offerRealPlayer = biddingPlayer ? findPlayerForTarget(biddingPlayer) : undefined;
  const offerWeeklyWage = offerRealPlayer?.wage ?? (biddingPlayer ? toWeeklyWage(toAnnualSalary(biddingPlayer.wage)) : 0);
  const offerImmediateCost = offerTermsPreview ? calculateImmediateCost(offerTermsPreview, offerWeeklyWage, roundsLeftInSeason) : 0;
  const offerValidation = offerTermsPreview ? validateTransferTerms(offerTermsPreview, budget, careerWorld.clubWageBudgetState, offerImmediateCost) : { valid: true, reason: undefined };
  const offerFutureCommitment = offerTermsPreview ? calculateFutureFinancialCommitment(offerTermsPreview) : 0;
  const offerSeasonWageCost = offerTermsPreview && offerTermsPreview.baseType === 'loan'
    ? Math.round(offerWeeklyWage * (offerTermsPreview.wageSharePercent ?? 0) / 100 * roundsLeftInSeason)
    : 0;
  const offerBudgetAfter = budget - offerImmediateCost;
  const offerAnnualWageImpact = offerTermsPreview && offerTermsPreview.baseType === 'loan'
    ? toAnnualSalary(Math.round(offerWeeklyWage * (offerTermsPreview.wageSharePercent ?? 0) / 100))
    : 0;
  const offerWageMarginAfter = wageBudget.availableAnnualWages - offerAnnualWageImpact;
  const offerCreatesFuturePressure = offerFutureCommitment > 0 && offerFutureCommitment > Math.max(0, offerBudgetAfter) * 1.5;

  // Cessione reale: eseguita SOLO dopo che un'offerta ufficiale e' stata accettata dal club e
  // confermata dal giocatore (vedi handleAcceptIncomingOffer). Mai un buyer inventato al volo.
  const finalizeAcceptedIncomingOffer = (
    offer: IncomingTransferOffer,
    outgoingClause?: { choice: FutureClauseChoice; sellOnPercentage: SellOnPercentage; buyBackFee: number; buyBackDuration: BuyBackDuration }
  ) => {
    const player = players.find(item => item.id === offer.playerId);
    if (!player) return;

    const transferId = `sell_offer_${offer.id}`;
    // Mercato M2A: se il giocatore porta gia' una sell-on a favore di un terzo club, il payout si
    // applica una sola volta (la clausola viene marcata triggered qui stesso) e va dedotto dal ricavo
    // PRIMA di aggiornare il budget trasferimenti.
    const sellOnApplication = applySellOnOnSale(player, offer.fee, transferId);
    let playerForTransfer = sellOnApplication ? sellOnApplication.player : player;

    // Mercato M2C: penale anti-rivale, calcolata SEMPRE sul ricavo lordo (mai a cascata sul sell-on
    // gia' dedotto), processata una sola volta. Accredita il beneficiario solo se e' un club IA reale
    // (contabilita' modellata via clubWorld.budget).
    const antiRivalApplication = applyAntiRivalPenaltyOnSale(playerForTransfer, offer.fee, resolveClubId(offer.fromClub), transferId);
    if (antiRivalApplication) playerForTransfer = antiRivalApplication.player;
    const totalDeductions = (sellOnApplication?.payout ?? 0) + (antiRivalApplication?.penalty ?? 0);
    const netRevenue = Math.max(0, offer.fee - totalDeductions);

    // Clausola futura che il MIO club sceglie di inserire in QUESTA cessione (beneficiario = io).
    let outgoingClauseNewsLine = '';
    const currentSeason = careerWorld.clubWageBudgetState.season;
    const myClubId = resolveClubId(teamName);
    if (outgoingClause && outgoingClause.choice !== 'none') {
      if (outgoingClause.choice === 'sell_on_gross' || outgoingClause.choice === 'sell_on_capital_gain') {
        const clause = createSellOnClause(outgoingClause.choice, outgoingClause.sellOnPercentage, offer.fee, myClubId, teamName, currentSeason);
        playerForTransfer = { ...playerForTransfer, sellOnClauses: [...(playerForTransfer.sellOnClauses ?? []), clause] };
        outgoingClauseNewsLine = ` ${teamName} mantiene il ${outgoingClause.sellOnPercentage}% ${SELL_ON_TYPE_LABELS[clause.type]} su una futura rivendita.`;
      } else if (outgoingClause.choice === 'buy_back' && outgoingClause.buyBackFee > 0) {
        const clause = createBuyBackClause(outgoingClause.buyBackFee, outgoingClause.buyBackDuration, myClubId, teamName, player.id, currentSeason, teamDNA.seasonsTracked);
        playerForTransfer = { ...playerForTransfer, buyBackClauses: [...(playerForTransfer.buyBackClauses ?? []), clause] };
        outgoingClauseNewsLine = ` ${teamName} conserva un contro-riscatto a ${formatCurrency(outgoingClause.buyBackFee)} fino al ${clause.expirySeason}.`;
      }
    }

    setPlayers(players.filter(item => item.id !== offer.playerId));
    setStarters(starters.filter(id => id !== offer.playerId));
    setBench(bench.filter(id => id !== offer.playerId));
    setBudget(budget + netRevenue);
    onTransferDNAEvent(player, 'sell', offer.fee);
    const saleMemory = getSaleMemoryProfile(player, offer.fromClub, offer.fee);
    addClubMemory({
      season: '2026/27',
      category: 'transfer',
      title: saleMemory.painfulSale ? `Offerta accettata: addio a ${player.name}` : `Offerta accettata per ${player.name}`,
      description: saleMemory.painfulSale
        ? `${offer.fromClub} prende un giocatore percepito come ${saleMemory.projectRole.label.toLowerCase()}. La scelta entra nella memoria del progetto, non solo nel bilancio.`
        : saleMemory.description,
      importance: saleMemory.painfulSale ? Math.max(78, saleMemory.importance) : saleMemory.importance,
      fanImpact: saleMemory.painfulSale ? Math.min(-5, saleMemory.fanImpact) : saleMemory.fanImpact,
      dressingRoomImpact: saleMemory.painfulSale ? Math.min(-4, saleMemory.dressingRoomImpact) : saleMemory.dressingRoomImpact,
      tags: [...saleMemory.tags, 'offerta-ia'],
      playerNames: [player.name]
    });
    const isRivalOfferSale = clubHistory.rivalries.some(r => r.opponent === offer.fromClub && r.heat >= 48);
    const isAcademyOfferSale = isAcademyOrLocalPlayer(clubHistory, player.name);
    const isBigOfferSale = saleMemory.painfulSale || isAcademyOfferSale || offer.fee >= budget * 0.25;
    const incomingTransferReaction = processCareerWorldAfterTransfer(careerWorld, {
      transferId: `sell_offer_${offer.id}`,
      season: '2026/27',
      direction: 'sell',
      playerId: player.id,
      playerName: player.name,
      playerAge: player.age,
      fee: offer.fee,
      counterpartClub: offer.fromClub,
      isRivalCounterpart: isRivalOfferSale,
      isAcademyOrLocal: isAcademyOfferSale,
      isPainfulSale: saleMemory.painfulSale,
      isBigSignature: false,
      isDnaAligned: false
    });
    setCareerWorld(incomingTransferReaction.state);
    if (incomingTransferReaction.memory) addClubMemory(incomingTransferReaction.memory);
    setClubHistory(current => applyRivalryTransferImpact(current, {
      opponentClub: offer.fromClub,
      playerName: player.name,
      isRivalCounterpart: isRivalOfferSale,
      isBigTransfer: isBigOfferSale,
      season: '2026/27',
      direction: 'sell'
    }));
    const incomingMediaResult = processMediaAfterTransfer(incomingTransferReaction.state, {
      transferId: `sell_offer_${offer.id}`,
      season: '2026/27',
      round: currentRound,
      playerName: player.name,
      counterpartClub: offer.fromClub,
      fee: offer.fee,
      direction: 'sell',
      isRivalCounterpart: isRivalOfferSale,
      isPainfulSale: saleMemory.painfulSale || isAcademyOfferSale,
      isBigSignature: false,
      boardConfidence: incomingTransferReaction.state.ownershipState.boardConfidence
    });
    setCareerWorld(incomingMediaResult.state);
    incomingMediaResult.news.forEach(item => addNewNews(item.title, item.content, item.category));
    setCareerWorld(current => resolveMarketRumorsAfterTransfer(current, { playerId: player.id, transferId: `sell_offer_${offer.id}` }));
    setIncomingOffers(incomingOffers.map(item => item.id === offer.id ? { ...item, status: 'accepted' } : item));

    const offerSoldPlayerClubHistory = applyPlayerTransferToClubHistory(player.clubHistory, {
      fromClubId: resolveClubId(teamName),
      fromClubName: teamName,
      toClubId: resolveClubId(offer.fromClub),
      toClubName: offer.fromClub,
      season: '2026/27',
      transferType: 'sale',
      fee: offer.fee
    });
    setClubWorld(clubWorld.map(club => {
      if (club.name === offer.fromClub) {
        return {
          ...club,
          budget: Math.max(0, club.budget - offer.fee),
          roster: [...club.roster, { ...playerForTransfer, id: `ai_offer_${club.clubId}_${player.id}`, status: 'Disponibile', clubHistory: offerSoldPlayerClubHistory }],
          transferLog: [`${club.name} acquista ${player.name} dal ${teamName} per ${formatCurrency(offer.fee)}.`, ...club.transferLog].slice(0, 12)
        };
      }
      // Mercato M2C: accredita la penale anti-rivale solo se il beneficiario e' un club IA con
      // contabilita' reale (clubWorld.budget) e diverso dall'acquirente.
      if (antiRivalApplication && club.clubId === antiRivalApplication.clause.beneficiaryClubId) {
        return {
          ...club,
          budget: club.budget + antiRivalApplication.penalty,
          transferLog: [`${club.name} incassa una penale anti-rivale di ${formatCurrency(antiRivalApplication.penalty)} dalla cessione di ${player.name}.`, ...club.transferLog].slice(0, 12)
        };
      }
      return club;
    }));

    const realReplacementTargets = createRealReplacementTargets(player, teamName, clubWorld);
    if (realReplacementTargets.length > 0) {
      setScoutedTargets([...realReplacementTargets, ...scoutedTargets]);
    }
    const sellOnNewsLine = sellOnApplication
      ? ` Clausola sell-on verso il ${sellOnApplication.clause.beneficiaryClubName}: quota dovuta ${formatCurrency(sellOnApplication.payout)}.`
      : '';
    const antiRivalNewsLine = antiRivalApplication
      ? ` Penale anti-rivale verso il ${antiRivalApplication.clause.beneficiaryClubName}: ${formatCurrency(antiRivalApplication.penalty)}.`
      : '';
    const netRevenueLine = totalDeductions > 0
      ? ` Ricavo lordo ${formatCurrency(offer.fee)}, ricavo netto ${formatCurrency(netRevenue)}.`
      : '';
    addNewNews(
      `Offerta accettata: ${player.name}`,
      `${teamName} vende ${player.name} al ${offer.fromClub} per ${formatCurrency(offer.fee)}. ${realReplacementTargets.length > 0 ? 'Lo scouting ha proposto sostituti reali.' : 'Nessun sostituto reale immediato disponibile.'}${sellOnNewsLine}${antiRivalNewsLine}${netRevenueLine}${outgoingClauseNewsLine}`,
      'market'
    );
  };

  // Prosegue il normale flusso di accettazione (consenso giocatore -> cessione reale). Riusato sia
  // quando non c'e' nessuna prelazione attiva, sia dopo che un trigger di prelazione si e' risolto
  // con rinuncia/fallimento contratto (l'offerta originaria "riprende" esattamente da qui).
  const proceedWithNormalAcceptance = (offer: IncomingTransferOffer, player: Player) => {
    // Mercato M2A: cattura la clausola futura scelta ORA (mai quella eventualmente in modifica su
    // un'altra offerta al momento in cui la risoluzione asincrona termina).
    const clauseChoice = outgoingClauseOfferId === offer.id ? outgoingClauseChoice : 'none';
    const clauseSellOnPercentage = outgoingClauseSellOnPercentage;
    const clauseBuyBackFee = Number(outgoingClauseBuyBackFee) || 0;
    const clauseBuyBackDuration = outgoingClauseBuyBackDuration;
    setOutgoingClauseOfferId(null);
    setIncomingOffers(incomingOffers.map(item => (item.id === offer.id ? { ...item, status: 'awaiting_player_decision' as const } : item)));
    setTimeout(() => {
      const projectRole = getPlayerProjectRole(player, roleContext);
      const accepts = resolvePlayerDecisionOnOffer(player, offer, projectRole, currentRound);
      if (!accepts) {
        setIncomingOffers(incomingOffers.map(item => (item.id === offer.id ? { ...item, status: 'player_declined' as const } : item)));
        addNewNews(
          `Il giocatore rifiuta: ${player.name}`,
          `${player.name} non apre al trasferimento al ${offer.fromClub}, nonostante l'accordo raggiunto tra i club. Rosa e budget restano invariati.`,
          'market'
        );
        return;
      }
      // Mercato M3: anche in cessione il giocatore lascia la rosa solo dopo visita e registrazione
      // (qui automatiche: la visita e' del club acquirente, nessuna scelta dell'utente da fare).
      const medicalCheck = runMedicalCheck(offer.id, player, currentRound);
      if (medicalCheck.status === 'failed') {
        setIncomingOffers(incomingOffers.map(item => (item.id === offer.id ? { ...item, status: 'medical_failed' as const, medicalCheck } : item)));
        addNewNews(
          `Cessione saltata: ${player.name}`,
          `Le visite mediche presso il ${offer.fromClub} hanno evidenziato una condizione incompatibile: ${player.name} resta al ${teamName}, nessun costo per nessuna delle parti.`,
          'market'
        );
        return;
      }
      if (!marketWindowOpen) {
        setIncomingOffers(incomingOffers.map(item => (item.id === offer.id ? { ...item, status: 'suspended_window_closed' as const, medicalCheck } : item)));
        return;
      }
      finalizeAcceptedIncomingOffer(offer, { choice: clauseChoice, sellOnPercentage: clauseSellOnPercentage, buyBackFee: clauseBuyBackFee, buyBackDuration: clauseBuyBackDuration });
    }, 1200);
  };

  // Mercato M2C: esito di rinuncia/fallimento contratto del titolare della prelazione. L'offerta
  // originaria riprende esattamente dal punto normale (mai un doppio controllo prelazione: la
  // stessa clausola resta attiva per future offerte, ma questo trigger e' gia' risolto).
  const finalizeFirstRefusalOutcome = (
    trigger: FirstRefusalTrigger,
    offer: IncomingTransferOffer,
    status: 'holder_waived' | 'holder_failed_contract'
  ) => {
    setCareerWorld(current => ({
      ...current,
      firstRefusalTriggers: current.firstRefusalTriggers.map(t => (t.id === trigger.id ? { ...t, status } : t))
    }));
    setIncomingOffers(incomingOffers.map(item => (item.id === offer.id ? { ...item, status: 'pending' as const } : item)));
    addNewNews(
      'Diritto di prelazione',
      status === 'holder_waived'
        ? `Il titolare della prelazione rinuncia: l'offerta del ${offer.fromClub} per ${offer.playerName} riprende.`
        : `Il titolare della prelazione non riesce a completare l'operazione: l'offerta del ${offer.fromClub} per ${offer.playerName} riprende.`,
      'market'
    );
    const player = players.find(p => p.id === offer.playerId);
    if (player) proceedWithNormalAcceptance(offer, player);
  };

  // Mercato M2C: il titolare esercita la prelazione. Sposta il giocatore a lui con gli stessi
  // termini congelati (mai un prezzo diverso), marca clausola/trigger/offerta originaria una sola volta.
  const finalizeFirstRefusalExercise = (
    trigger: FirstRefusalTrigger,
    offer: IncomingTransferOffer,
    player: Player,
    clause: FirstRefusalClause,
    holderClub: ClubAIState,
    matchedTerms: TransferOfferTerms
  ) => {
    const price = matchedTerms.upfrontFee;
    const updatedClause = { ...clause, status: 'exercised' as const, processedTriggerIds: [trigger.id, ...clause.processedTriggerIds].slice(0, 10) };
    const playerWithClauseUpdated: Player = { ...player, firstRefusalClauses: (player.firstRefusalClauses ?? []).map(c => (c.id === clause.id ? updatedClause : c)) };

    setCareerWorld(current => ({
      ...current,
      firstRefusalTriggers: current.firstRefusalTriggers.map(t => (t.id === trigger.id ? { ...t, status: 'superseded' as const } : t))
    }));
    setIncomingOffers(incomingOffers.map(item => (item.id === offer.id ? { ...item, status: 'superseded' as const } : item)));

    const myClubId = resolveClubId(teamName);
    const soldClubHistory = applyPlayerTransferToClubHistory(playerWithClauseUpdated.clubHistory, {
      fromClubId: myClubId,
      fromClubName: teamName,
      toClubId: holderClub.clubId,
      toClubName: holderClub.name,
      season: careerWorld.clubWageBudgetState.season,
      transferType: 'sale',
      fee: price
    });
    setPlayers(players.filter(p => p.id !== offer.playerId));
    setStarters(starters.filter(id => id !== offer.playerId));
    setBench(bench.filter(id => id !== offer.playerId));
    setBudget(budget + price);
    setClubWorld(clubWorld.map(club => (club.clubId === holderClub.clubId ? {
      ...club,
      budget: Math.max(0, club.budget - price),
      roster: [...club.roster, { ...playerWithClauseUpdated, id: `firstrefusal_${club.clubId}_${player.id}`, status: 'Disponibile' as const, clubHistory: soldClubHistory }],
      transferLog: [`${club.name} esercita la prelazione su ${player.name} per ${formatCurrency(price)}.`, ...club.transferLog].slice(0, 12)
    } : club)));
    onTransferDNAEvent(player, 'sell', price);
    addNewNews(
      `Prelazione esercitata: ${player.name}`,
      `${holderClub.name} esercita il diritto di prelazione e acquista ${player.name} per ${formatCurrency(price)}, eguagliando l'offerta del ${offer.fromClub}.`,
      'market'
    );
  };

  // Trigger di prelazione: si attiva solo per offerte reali/ufficiali di trasferimento definitivo,
  // mai per prestiti/scambi/svincolati/precontratti. Congela i termini, sospende l'offerta
  // originaria, poi il titolare (IA: valutazione deterministica reale) decide di eguagliare o
  // rinunciare; se eguaglia, il giocatore deve comunque accettare il contratto.
  const handleFirstRefusalFlow = (offer: IncomingTransferOffer, player: Player, clause: FirstRefusalClause) => {
    const holderClub = clubWorld.find(c => c.clubId === clause.holderClubId);
    const matchedTerms: TransferOfferTerms = { baseType: 'permanent', purchaseClause: 'none', upfrontFee: offer.fee, installments: [], futureFinancialCommitment: 0 };
    const trigger = createFirstRefusalTrigger(clause, resolveClubId(teamName), resolveClubId(offer.fromClub), offer.id, matchedTerms, currentRound);
    setCareerWorld(current => ({ ...current, firstRefusalTriggers: [trigger, ...current.firstRefusalTriggers].slice(-30) }));
    setIncomingOffers(incomingOffers.map(item => (item.id === offer.id ? { ...item, status: 'suspended_first_refusal' as const } : item)));

    setTimeout(() => {
      if (!holderClub) { finalizeFirstRefusalOutcome(trigger, offer, 'holder_waived'); return; }
      const decision = evaluateFirstRefusalAIDecision(holderClub, player, matchedTerms);
      if (!decision.exercise) { finalizeFirstRefusalOutcome(trigger, offer, 'holder_waived'); return; }

      const projectRole = getPlayerProjectRole(player, roleContext);
      const consent = resolveSwapOutgoingConsent(player, projectRole, `${player.id}-${trigger.id}-firstrefusal`);
      if (!consent.accepts || matchedTerms.upfrontFee > holderClub.budget) {
        finalizeFirstRefusalOutcome(trigger, offer, 'holder_failed_contract');
        return;
      }
      // Mercato M3: visita medica anche per l'esercizio della prelazione, prima del completamento.
      const medicalCheck = runMedicalCheck(trigger.id, player, currentRound);
      if (medicalCheck.status === 'failed') {
        finalizeFirstRefusalOutcome(trigger, offer, 'holder_failed_contract');
        return;
      }
      finalizeFirstRefusalExercise(trigger, offer, player, clause, holderClub, matchedTerms);
    }, 1200);
  };

  // Accettare l'offerta del CLUB non vende subito: serve prima il consenso reale del giocatore.
  // Se rifiuta, rosa e budget restano invariati; se accetta, si usa il flusso di cessione gia' esistente.
  const handleAcceptIncomingOffer = (offer: IncomingTransferOffer) => {
    const player = players.find(item => item.id === offer.playerId);
    if (!player) return;
    // Mercato M2C: divieto di vendita anti-rivale. Blocca l'accettazione, nessuna rosa/budget toccati.
    const restriction = checkAntiRivalRestriction(player, resolveClubId(offer.fromClub), offer.fromClub);
    if (restriction.blocked) {
      alert(restriction.reason);
      return;
    }
    // Mercato M2C: prelazione attiva di un titolare diverso da me, solo per definitivo ufficiale.
    const activeFirstRefusalClause = offer.formula !== 'loan'
      ? (player.firstRefusalClauses ?? []).find(c => c.status === 'active' && c.holderClubId !== resolveClubId(teamName))
      : undefined;
    if (activeFirstRefusalClause) {
      handleFirstRefusalFlow(offer, player, activeFirstRefusalClause);
      return;
    }
    proceedWithNormalAcceptance(offer, player);
  };

  const handleRejectIncomingOffer = (offer: IncomingTransferOffer) => {
    const player = players.find(item => item.id === offer.playerId);
    if (player) {
      const projectRole = getPlayerProjectRole(player, roleContext);
      const refusalMatters = isSquadLeader(player)
        || ['untouchableStar', 'fanSymbol', 'futureCaptain', 'brokenPromise'].includes(projectRole.key)
        || offer.fee >= player.value * 1.2;
      if (refusalMatters) {
        addClubMemory({
          season: '2026/27',
          category: 'transfer',
          title: projectRole.key === 'brokenPromise' ? `Scelta rischiosa: resta ${player.name}` : `Fedelta al progetto: resta ${player.name}`,
          description: projectRole.key === 'brokenPromise'
            ? `${teamName} rifiuta il ${offer.fromClub}, ma ${player.name} si sente ancora una ${projectRole.label.toLowerCase()}: serviranno minuti o dialogo.`
            : `${teamName} rifiuta il ${offer.fromClub}: trattenere un ${projectRole.label.toLowerCase()} diventa un segnale tecnico e identitario.`,
          importance: clamp(58 + projectRole.trust * 0.16 + projectRole.tension * 0.18 + Math.max(0, projectRole.fanWeight) * 2, 62, 84),
          fanImpact: projectRole.key === 'fanSymbol' ? 6 : 4,
          dressingRoomImpact: projectRole.tension >= 70 ? -1 : Math.max(2, projectRole.dressingRoomWeight),
          tags: ['rifiuto-offerta', projectRole.key, `player:${player.name}`],
          playerNames: [player.name]
        });
      }
    }
    setIncomingOffers(incomingOffers.map(item => item.id === offer.id ? { ...item, status: 'rejected' } : item));
    setClubWorld(clubWorld.map(club => club.name === offer.fromClub
      ? { ...club, transferLog: [`${teamName} rifiuta l'offerta per ${offer.playerName}.`, ...club.transferLog].slice(0, 12) }
      : club
    ));
    addNewNews(
      `Offerta rifiutata: ${offer.playerName}`,
      `${teamName} respinge la proposta del ${offer.fromClub} da ${formatCurrency(offer.fee)}.`,
      'market'
    );
  };

  // ─────────────────────────────────────────────────────────────
  // DATABASE GIOCATORI: deriva sempre dal roster reale, mai una lista statica.
  // ─────────────────────────────────────────────────────────────

  const scoutingByKey = useMemo(() => {
    const map = new Map<string, Negotiation>();
    marketTargets.forEach(t => map.set(`${t.currentClub}::${t.playerName}`, t));
    return map;
  }, [marketTargets]);

  const negotiationForPlayer = (playerName: string, clubName: string) => (
    marketTargets.find(t => t.playerName === playerName && t.currentClub === clubName && ACTIVE_STATUSES.includes(t.status))
  );

  const databaseBase = useMemo(() => {
    // Esclude sempre la squadra usata dall'utente: clubWorld contiene un roster AI "ombra" con lo
    // stesso nome del club scelto in TeamSelection, mai la rosa reale (quella vive in players/App.tsx).
    const external = clubWorld
      .filter(club => club.name !== teamName)
      .flatMap(club => club.roster.map(player => ({ player, clubName: club.name })));
    const ownRoster = dbShowOwnRoster ? players.map(player => ({ player, clubName: teamName })) : [];
    const firstTeamEntries = [...external, ...ownRoster].filter(entry => (
      (entry.player.squadStatus ?? 'first_team') === 'first_team'
    ));
    // Mercato M2B: svincolati reali gia' presenti nel salvataggio (mai generati qui). In questo
    // progetto l'unico bacino reale e' il vivaio rilasciato del mio club (squadStatus 'released').
    const freeAgentEntries = players
      .filter(player => isFreeAgent(player))
      .map(player => ({ player, clubName: 'Svincolato' }));
    return [...firstTeamEntries, ...freeAgentEntries];
  }, [clubWorld, players, dbShowOwnRoster, teamName]);

  const databaseFiltered = useMemo(() => {
    return databaseBase.filter(({ player, clubName }) => {
      if (dbSearch) {
        const q = dbSearch.toLowerCase();
        const matches = player.name.toLowerCase().includes(q) || clubName.toLowerCase().includes(q) || player.nationality?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (dbRoleFilter !== 'ALL') {
        const family = player.role === 'GK' ? 'GK' : /CB|LB|RB/.test(player.role) ? 'DF' : /DM|CM|AM/.test(player.role) ? 'MF' : 'FW';
        if (dbRoleFilter === 'DF' || dbRoleFilter === 'MF' || dbRoleFilter === 'FW' || dbRoleFilter === 'GK') {
          if (family !== dbRoleFilter) return false;
        } else if (player.role !== dbRoleFilter && !player.secondaryRoles?.includes(dbRoleFilter as Player['role'])) return false;
      }
      if (player.age < dbAgeMin || player.age > dbAgeMax) return false;
      if (player.overall < dbOverallMin || player.overall > dbOverallMax) return false;
      if (player.potential < dbPotentialMin) return false;
      if (dbValueMin > 0 && player.value < dbValueMin) return false;
      if (dbValueMax > 0 && player.value > dbValueMax) return false;
      if (dbWageMax > 0 && player.wage > dbWageMax) return false;
      if (dbContractMaxYears > 0 && player.contractYears > dbContractMaxYears) return false;
      if (dbStatusFilter !== 'ALL' && player.status !== dbStatusFilter) return false;
      if (dbFootFilter !== 'ALL' && player.preferredFoot !== dbFootFilter) return false;
      if (dbSustainableOnly) {
        const annual = toAnnualSalary(player.wage);
        if (player.value > budget || annual > wageBudget.availableAnnualWages) return false;
      }
      if (dbDnaCompatibleOnly && getDNAMarketAdjustment(player, teamDNA).fit < 65) return false;
      if (dbAvailabilityFilter === 'FREE_AGENT' && !isFreeAgent(player)) return false;
      if (dbAvailabilityFilter === 'EXPIRING' && player.contractYears > 1) return false;
      if (dbAvailabilityFilter === 'ON_LOAN' && !player.loanState) return false;
      if (dbAvailabilityFilter === 'PURCHASABLE_ONLY' && (isFreeAgent(player) || Boolean(negotiationForPlayer(player.name, clubName)))) return false;
      return true;
    });
  }, [
    databaseBase, dbSearch, dbRoleFilter, dbAgeMin, dbAgeMax, dbOverallMin, dbOverallMax, dbPotentialMin,
    dbValueMin, dbValueMax, dbWageMax, dbContractMaxYears, dbStatusFilter, dbFootFilter,
    dbSustainableOnly, dbDnaCompatibleOnly, dbAvailabilityFilter, budget, wageBudget, teamDNA
  ]);

  const databaseRanked = useMemo(() => {
    const fitContext = { tactic, teamDNA, players, starters, transferBudget: budget, wageBudget, clubHistory };
    return databaseFiltered.map(({ player, clubName }) => {
      const scouting = scoutingByKey.get(`${clubName}::${player.name}`);
      const fit = getMarketFitScore(player, { ...fitContext, scouting });
      return { player, clubName, scouting, fit };
    }).sort((a, b) => {
      switch (dbSortKey) {
        case 'overall': return b.player.overall - a.player.overall;
        case 'age': return a.player.age - b.player.age;
        case 'value': return b.player.value - a.player.value;
        case 'wage': return b.player.wage - a.player.wage;
        case 'contract': return a.player.contractYears - b.player.contractYears;
        case 'potential': return b.player.potential - a.player.potential;
        case 'dna': return getDNAMarketAdjustment(b.player, teamDNA).fit - getDNAMarketAdjustment(a.player, teamDNA).fit;
        case 'scout': return (b.scouting?.scoutLevel ?? 0) - (a.scouting?.scoutLevel ?? 0);
        case 'fit':
        default: return b.fit.score - a.fit.score;
      }
    });
  }, [databaseFiltered, dbSortKey, scoutingByKey, tactic, teamDNA, players, starters, budget, wageBudget, clubHistory]);

  const fitLabelColor = (label: string) => (
    label === 'Perfetto per il progetto' ? 'var(--color-pitch)' :
    label === 'Ottima opzione' ? 'var(--color-lime)' :
    label === 'Compatibile' ? 'var(--color-gold)' :
    label === 'Da valutare' ? 'var(--text-secondary)' :
    'var(--color-danger)'
  );

  const handleObservePlayer = (player: Player, clubName: string) => {
    ensureTrackedTarget(player, clubName);
  };

  const handleStartNegotiationFromDatabase = (player: Player, clubName: string) => {
    const target = ensureTrackedTarget(player, clubName);
    handleStartClubOffer(target);
    setMarketTab('trattative');
  };

  // Mercato M2B: apre la stessa fase 1 gia' precaricata in modalita' scambio.
  const handleProposeSwapFromDatabase = (player: Player, clubName: string) => {
    const target = ensureTrackedTarget(player, clubName);
    handleStartClubOffer(target);
    setOfferIsSwap(true);
    setMarketTab('trattative');
  };

  return (
    <div className="page-wrapper">
      {/* Header sempre visibile */}
      <div className="card-premium market-header-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div className="market-header-stats" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Budget trasferimenti</span>
            <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--color-pitch)' }}>{formatCurrency(budget)}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Margine stipendi</span>
            <strong style={{ display: 'block', fontSize: '0.95rem', color: wageBudgetStatus === 'Fuori budget' ? 'var(--color-danger)' : 'var(--color-lime)' }}>
              {formatCurrency(wageBudget.availableAnnualWages)} · {wageBudgetStatus}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Trattative attive</span>
            <strong style={{ display: 'block', fontSize: '0.95rem' }}>{activeNegotiationsCount}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Finestra di mercato</span>
            <strong style={{ display: 'block', fontSize: '0.95rem', color: !activeTransferWindow ? 'var(--color-danger)' : activeTransferWindow.status === 'closing_soon' ? 'var(--color-gold)' : 'var(--color-lime)' }}>
              {!activeTransferWindow
                ? 'Mercato chiuso'
                : activeTransferWindow.status === 'closing_soon'
                  ? `Ultimi giorni di mercato (${activeTransferWindow.kind === 'summer' ? 'estivo' : 'invernale'})`
                  : `Mercato ${activeTransferWindow.kind === 'summer' ? 'estivo' : 'invernale'} aperto`}
            </strong>
            {activeTransferWindow && (
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                {Math.max(0, activeTransferWindow.closesAtRound - currentRound)} giornate residue
                {negotiationsNearingDeadline > 0 ? ` · ${negotiationsNearingDeadline} in scadenza` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="market-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setMarketTab('trattative')}
            className={marketTab === 'trattative' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.78rem', justifyContent: 'center', flex: 1 }}
          >
            <ArrowLeftRight size={14} /> Trattative
          </button>
          <button
            onClick={() => setMarketTab('database')}
            className={marketTab === 'database' ? 'btn-primary' : 'btn-secondary'}
            style={{ fontSize: '0.78rem', justifyContent: 'center', flex: 1 }}
          >
            <Database size={14} /> Database giocatori
          </button>
        </div>
      </div>

      {marketTab === 'trattative' && (
        <div>
          {/* A. Acquisti in corso */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--color-gold)' }}>Acquisti in corso</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
              {activeNegotiations.length === 0 ? (
                <div className="card-premium ui-empty-state" style={{ gridColumn: '1 / -1' }}>
                  <Info size={20} />
                  <p>Nessuna trattativa attiva. Cerca un obiettivo nel Database giocatori.</p>
                </div>
              ) : activeNegotiations.map(target => {
                const terms = target.terms;
                const isLoan = terms?.baseType === 'loan';
                const annualEstimate = target.contractOfferAnnualSalary
                  ?? target.contractCounterAnnualSalary
                  ?? toAnnualSalary(target.wage);
                // Mercato M4: concorrenza/asta, solo se questa trattativa e' nello scope (acquisto definitivo).
                const competition = careerWorld.transferCompetitions.find(c => c.negotiationId === target.id);
                const competitionSummary = competition && competition.status !== 'none' ? getTransferCompetitionSummary(competition) : null;
                const canRebidPhase1 = target.status === 'club_offer_sent' || target.status === 'club_counter_offer';
                const canImproveContract = target.status === 'player_contract_negotiation' || target.status === 'player_counter_offer';
                return (
                  <div key={target.id} className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <button className="inline-player-link" onClick={() => openPlayerSheet(findPlayerForTarget(target))}>
                        {target.playerName}
                      </button>
                      <span className="badge" style={{ fontSize: '0.62rem' }}>{NEGOTIATION_STATUS_LABELS[target.status]}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Da <button className="inline-club-link" onClick={() => openClubInfo(target.currentClub)}>{target.currentClub}</button>
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {target.loanSwapTerms ? (
                        <>
                          <span>Scambio di prestiti: offro {target.loanSwapTerms.userOutgoingPlayerName}</span>
                          <span>Quota mia (in arrivo): {target.loanSwapTerms.userPaysIncomingWageSharePercent}%</span>
                          <span>Quota loro (in uscita): {target.loanSwapTerms.otherClubPaysIncomingWageSharePercent}%</span>
                        </>
                      ) : target.swapTerms ? (
                        <>
                          <span>Scambio: offro {target.swapTerms.offeredPlayerName}</span>
                          <span>{SWAP_CASH_DIRECTION_LABELS[target.swapTerms.cashPaidBy]}{target.swapTerms.cashPaidBy !== 'none' ? `: ${formatCurrency(target.swapTerms.cashAdjustment)}` : ''}</span>
                        </>
                      ) : terms ? (
                        <>
                          <span>{TRANSFER_BASE_TYPE_LABELS[terms.baseType]}{isLoan ? ` (${PURCHASE_CLAUSE_LABELS[terms.purchaseClause]})` : ''}</span>
                          <span>{isLoan ? 'Indennizzo' : 'Cartellino'}: {formatCurrency(isLoan ? (terms.loanFee ?? 0) : terms.upfrontFee)}</span>
                          {isLoan && <span>Quota stipendio: {terms.wageSharePercent ?? 0}%</span>}
                          {!isLoan && terms.installments.length > 0 && <span>Rate: {formatCurrency(terms.futureFinancialCommitment)}</span>}
                          {isLoan && terms.purchaseClause !== 'none' && <span>Prezzo {terms.purchaseClause === 'option' ? 'diritto' : 'obbligo'}: {formatCurrency(terms.purchaseFee ?? 0)}</span>}
                        </>
                      ) : (
                        <span>Cartellino: {formatCurrency(target.clubOfferFee ?? target.value)}</span>
                      )}
                      {!isLoan && !target.swapTerms && target.status !== 'club_offer_sent' && target.status !== 'club_counter_offer' && (
                        <span>Costo annuo: {formatCurrency(annualEstimate)}</span>
                      )}
                      {target.daysLeft !== undefined && <span>{target.daysLeft} giorni residui</span>}
                      {target.expiresAtRound !== undefined && <span>Scade alla giornata {target.expiresAtRound}</span>}
                    </div>
                    {target.status === 'medical_warning' && target.medicalCheck && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-gold)', background: 'rgba(212,175,55,0.1)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
                        {target.medicalCheck.riskSummary} {target.medicalCheck.reasons.join(' ')}
                      </div>
                    )}
                    {target.playerWaitingReason && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(147,197,253,0.08)', borderRadius: 'var(--radius-sm)', padding: '6px 10px' }}>
                        Giocatore indeciso: {target.playerWaitingReason}
                      </div>
                    )}
                    {competitionSummary && (
                      <div style={{
                        fontSize: '0.7rem',
                        color: competition!.status === 'user_outbid' || competition!.status === 'lost_to_other_club' ? 'var(--color-danger)' : competition!.status === 'user_leading' ? 'var(--color-lime)' : 'var(--color-gold)',
                        background: 'rgba(212,175,55,0.06)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '3px'
                      }}>
                        <strong>{competitionSummary.statusLabel} · {competitionSummary.positionLabel}</strong>
                        {competitionSummary.activeRivalNames.length > 0 && <span>Club interessati: {competitionSummary.activeRivalNames.join(', ')}</span>}
                        {competitionSummary.bestKnownOffer !== undefined && <span>Miglior offerta conosciuta: {formatCurrency(competitionSummary.bestKnownOffer)}</span>}
                        {competition!.status === 'user_leading' && <span style={{ color: 'var(--text-muted)' }}>Altri club possono ancora rilanciare prima della chiusura.</span>}
                        {competitionSummary.reasons.length > 0 && <span style={{ color: 'var(--text-muted)' }}>{competitionSummary.reasons.slice(-2).join(' ')}</span>}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '8px', flexWrap: 'wrap' }}>
                      {target.status === 'club_counter_offer' && (
                        <button className="btn-primary" onClick={() => (target.swapTerms ? handleAcceptSwapCounter(target) : handleAcceptClubCounter(target))} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Rispondi al club</button>
                      )}
                      {target.status === 'club_offer_accepted' && (
                        <button className="btn-primary" onClick={() => handleOpenContractNegotiation(target)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>{target.loanSwapTerms ? 'Concludi scambio prestiti' : isLoan ? 'Concludi prestito' : target.swapTerms ? 'Concludi scambio' : 'Negozia contratto'}</button>
                      )}
                      {target.status === 'player_counter_offer' && (
                        <button className="btn-primary" onClick={() => handleOpenContractNegotiation(target)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Accetta controproposta</button>
                      )}
                      {(target.status === 'club_offer_sent') && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>In attesa di risposta del club...</span>
                      )}
                      {/* Mercato M3: dopo l'accordo, visite mediche -> registrazione, mai un ingresso in rosa immediato. */}
                      {target.status === 'player_contract_accepted' && (
                        <button className="btn-primary" onClick={() => handleStartMedicalCheck(target)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Avvia visite</button>
                      )}
                      {target.status === 'medical_pending' && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Visite mediche in corso...</span>
                      )}
                      {target.status === 'medical_warning' && (
                        <button className="btn-primary" onClick={() => handleProceedDespiteWarning(target)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Procedi nonostante l'avvertenza</button>
                      )}
                      {target.status === 'registration_pending' && (
                        <button className="btn-primary" onClick={() => handleCompleteRegistration(target)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Completa registrazione</button>
                      )}
                      {/* Mercato M4: azioni reali quando la concorrenza mi ha superato. */}
                      {competitionSummary && (competition!.status === 'user_outbid' || competition!.status === 'auction') && canRebidPhase1 && (
                        <>
                          <button className="btn-primary" onClick={() => handleStartClubOffer(target)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Rilancia</button>
                          <button className="btn-secondary" onClick={() => handleStartClubOffer(target)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Cambia formula</button>
                        </>
                      )}
                      {competitionSummary && (competition!.status === 'user_outbid' || competition!.status === 'auction') && canImproveContract && (
                        <button className="btn-primary" onClick={() => handleOpenContractNegotiation(target)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Migliora contratto</button>
                      )}
                      {target.status !== 'medical_pending' && (
                        <button className="btn-secondary" onClick={() => handleWithdrawNegotiation(target.id)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Ritira offerta</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* A2. Prestiti attivi */}
          {players.some(p => p.loanState) && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--color-lime)' }}>Prestiti attivi</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                {players.filter(p => p.loanState).map(player => {
                  const loanState = player.loanState!;
                  return (
                    <div key={player.id} className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <button className="inline-player-link" onClick={() => openPlayerSheet(player)}>{player.name}</button>
                        <span className="badge" style={{ fontSize: '0.62rem' }}>Prestito attivo</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Di proprieta del <button className="inline-club-link" onClick={() => openClubInfo(loanState.parentClubName)}>{loanState.parentClubName}</button>
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                        <span>Quota stipendio: {loanState.wageSharePercent}%</span>
                        <span>Clausola: {PURCHASE_CLAUSE_LABELS[loanState.purchaseClause]}</span>
                        {loanState.purchaseClause !== 'none' && <span>Prezzo: {formatCurrency(loanState.purchaseFee ?? 0)}</span>}
                      </div>
                      {loanState.purchaseClause === 'obligation' && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: loanState.obligationTriggered ? 'var(--color-danger)' : 'var(--color-gold)' }}>
                          {loanState.obligationTriggered
                            ? 'Obbligo attivato: riscatto a fine stagione'
                            : loanState.obligationCondition === 'unconditional'
                              ? 'Obbligo automatico a fine stagione'
                              : `In attesa (presenze richieste: ${loanState.requiredAppearances ?? 0})`}
                        </span>
                      )}
                      {loanState.purchaseClause === 'option' && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-gold)' }}>Diritto esercitabile</span>
                      )}
                      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '8px', flexWrap: 'wrap' }}>
                        {loanState.purchaseClause === 'option' && (
                          <button className="btn-primary" onClick={() => handleExerciseLoanOption(player)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Esercita diritto</button>
                        )}
                        <button className="btn-secondary" onClick={() => handleReturnLoanedPlayer(player)} style={{ fontSize: '0.7rem', padding: '6px 10px' }}>Restituisci al club</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* A3. Accordi per la prossima stagione (precontratti) */}
          {careerWorld.futureContractAgreements.filter(a => a.status === 'active').length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--color-lime)' }}>Accordi per la prossima stagione</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {careerWorld.futureContractAgreements.filter(a => a.status === 'active').map(agreement => (
                  <div key={agreement.id} className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <strong style={{ fontSize: '0.82rem' }}>{agreement.playerName}</strong>
                      <span className="badge" style={{ fontSize: '0.6rem' }}>Precontratto</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Da {agreement.currentClubName}, effettivo dal {agreement.effectiveSeason}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{formatCurrency(agreement.annualSalary)}/anno · {agreement.durationYears} anni</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* A4. Mercato M2C: prelazioni da esercitare (lato IA titolare del diritto) */}
          {pendingFirstRefusalTriggers.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--color-gold)' }}>Prelazioni da esercitare</h3>
              <div className="card-premium" style={{ padding: '14px' }}>
                {pendingFirstRefusalTriggers.map(trigger => (
                  <div key={trigger.id} style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', padding: '6px 0' }}>
                    Offerta reale in corso per un giocatore soggetto a prelazione: valutazione del club titolare in corso...
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* A5. Mercato M2C: clausole anti-rivali attive sui miei giocatori */}
          {myActiveAntiRivalClauses.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--color-gold)' }}>Clausole anti-rivali attive</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {myActiveAntiRivalClauses.map(({ player, clause }) => (
                  <div key={clause.id} className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <button className="inline-player-link" onClick={() => openPlayerSheet(player)}>{player.name}</button>
                      <span className="badge" style={{ fontSize: '0.6rem' }}>{ANTI_RIVAL_MODE_LABELS[clause.mode]}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Club protetti: {clause.restrictedClubNames.join(', ')}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                      {clause.mode === 'penalty' ? `Penale: ${clause.penaltyPercent}% · ` : ''}Scadenza: {clause.expirySeason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* A6. Mercato M2C: scambi di prestiti attivi (entrambe le meta') */}
          {(loanSwapHomePlayers.length > 0 || loanSwapAwayPlayers.length > 0) && (
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--color-lime)' }}>Scambio di prestiti attivo</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {loanSwapHomePlayers.map(player => (
                  <div key={player.id} className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <button className="inline-player-link" onClick={() => openPlayerSheet(player)}>{player.name}</button>
                      <span className="badge" style={{ fontSize: '0.6rem' }}>In arrivo</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Di proprieta del <button className="inline-club-link" onClick={() => openClubInfo(player.loanState!.parentClubName)}>{player.loanState!.parentClubName}</button> · Quota stipendio: {player.loanState!.wageSharePercent}%
                    </span>
                  </div>
                ))}
                {loanSwapAwayPlayers.map(({ player, atClub }) => (
                  <div key={player.id} className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{player.name}</span>
                      <span className="badge" style={{ fontSize: '0.6rem' }}>In uscita</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      In prestito al <button className="inline-club-link" onClick={() => openClubInfo(atClub)}>{atClub}</button> · Quota stipendio a carico loro: {player.loanState!.wageSharePercent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B. Offerte ricevute */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px', color: 'var(--color-pitch)' }}>Offerte ricevute</h3>
            <div className="card-premium" style={{ padding: pendingIncomingOffers.length ? 0 : '22px' }}>
              {pendingIncomingOffers.length === 0 ? (
                <div className="ui-empty-state">
                  <Send size={22} />
                  <p>Nessuna offerta ricevuta al momento. L'interesse dei club puo crescere prima che arrivi.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                <table className="premium-table" style={{ minWidth: '760px' }}>
                  <thead>
                    <tr>
                      <th>Club</th><th>Giocatore</th><th>Formula</th><th>Offerta</th><th>Volonta giocatore</th><th style={{ textAlign: 'center' }}>Decisione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingIncomingOffers.map(offer => {
                      const offerPlayer = findPlayerForOffer(offer);
                      const awaitingPlayer = offer.status === 'awaiting_player_decision';
                      const prediction = offerPlayer ? predictOfferAcceptance(offerPlayer, offer, getPlayerProjectRole(offerPlayer, roleContext)) : null;
                      const clauseEditorOpen = outgoingClauseOfferId === offer.id;
                      const canAddClause = offer.formula !== 'loan';
                      const antiRivalCheck = offerPlayer ? checkAntiRivalRestriction(offerPlayer, resolveClubId(offer.fromClub), offer.fromClub) : null;
                      return (
                        <React.Fragment key={offer.id}>
                          <tr>
                            <td><button className="inline-club-link" onClick={() => openClubInfo(offer.fromClub)}>{offer.fromClub}</button></td>
                            <td><button className="inline-player-link" onClick={() => openPlayerSheet(offerPlayer)} disabled={!offerPlayer}>{offer.playerName}</button></td>
                            <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{offer.formula === 'loan' ? `Prestito (quota ${offer.wageShareIfLoan ?? 0}%)` : 'Definitivo'}</td>
                            <td style={{ fontWeight: 800, color: 'var(--color-pitch)' }}>{formatCurrency(offer.fee)}</td>
                            <td style={{ fontSize: '0.72rem', color: prediction?.likelyAccept ? 'var(--color-pitch)' : 'var(--color-gold)' }}>
                              {prediction ? prediction.label : '—'}
                            </td>
                            <td>
                              {awaitingPlayer ? (
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', textAlign: 'center' }}>Attesa decisione giocatore...</span>
                              ) : (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  {canAddClause && (
                                    <button
                                      className="btn-secondary"
                                      onClick={() => {
                                        if (clauseEditorOpen) { setOutgoingClauseOfferId(null); return; }
                                        setOutgoingClauseOfferId(offer.id);
                                        setOutgoingClauseChoice('none');
                                        setOutgoingClauseSellOnPercentage(10);
                                        setOutgoingClauseBuyBackFee(Math.round(offer.fee * 1.1).toString());
                                        setOutgoingClauseBuyBackDuration('next_season');
                                      }}
                                      style={{ padding: '6px 8px', fontSize: '0.64rem' }}
                                    >
                                      {clauseEditorOpen ? 'Chiudi clausola' : 'Clausola futura'}
                                    </button>
                                  )}
                                  <button className="btn-primary" onClick={() => handleAcceptIncomingOffer(offer)} style={{ padding: '6px 10px', fontSize: '0.72rem' }}>Accetta</button>
                                  <button className="btn-secondary" onClick={() => handleRejectIncomingOffer(offer)} style={{ padding: '6px 10px', fontSize: '0.72rem' }}>Rifiuta</button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {antiRivalCheck?.penaltyPercent && (
                            <tr>
                              <td colSpan={6} style={{ background: 'rgba(214,69,69,0.08)', padding: '8px 14px', fontSize: '0.68rem', color: 'var(--color-danger)' }}>
                                Attenzione: clausola anti-rivale attiva verso {offer.fromClub} — penale del {antiRivalCheck.penaltyPercent}% sulla plusvalenza lorda in caso di accettazione.
                              </td>
                            </tr>
                          )}
                          {clauseEditorOpen && (
                            <tr>
                              <td colSpan={6} style={{ background: 'rgba(212,175,55,0.06)', padding: '10px 14px' }}>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                  {(['none', 'sell_on_gross', 'sell_on_capital_gain', 'buy_back'] as FutureClauseChoice[]).map(choice => (
                                    <button key={choice} type="button" onClick={() => setOutgoingClauseChoice(choice)}
                                      className={outgoingClauseChoice === choice ? 'btn-primary' : 'btn-secondary'}
                                      style={{ fontSize: '0.64rem', padding: '5px 8px' }}>
                                      {FUTURE_CLAUSE_CHOICE_LABELS[choice]}
                                    </button>
                                  ))}
                                </div>
                                {(outgoingClauseChoice === 'sell_on_gross' || outgoingClauseChoice === 'sell_on_capital_gain') && (
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Percentuale ({teamName} beneficiario):</span>
                                    {SELL_ON_PERCENTAGE_OPTIONS.map(pct => (
                                      <button key={pct} type="button" onClick={() => setOutgoingClauseSellOnPercentage(pct)}
                                        className={outgoingClauseSellOnPercentage === pct ? 'btn-primary' : 'btn-secondary'}
                                        style={{ fontSize: '0.6rem', padding: '4px 7px' }}>
                                        {pct}%
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {outgoingClauseChoice === 'buy_back' && (
                                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <label style={{ fontSize: '0.64rem', color: 'var(--text-muted)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                                      Prezzo riacquisto
                                      <input type="number" value={outgoingClauseBuyBackFee} onChange={e => setOutgoingClauseBuyBackFee(e.target.value)} style={{ width: '110px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '5px', fontSize: '0.68rem', color: 'var(--text-primary)' }} />
                                    </label>
                                    {(['current_season', 'next_season', 'two_seasons'] as BuyBackDuration[]).map(d => (
                                      <button key={d} type="button" onClick={() => setOutgoingClauseBuyBackDuration(d)}
                                        className={outgoingClauseBuyBackDuration === d ? 'btn-primary' : 'btn-secondary'}
                                        style={{ fontSize: '0.6rem', padding: '4px 7px' }}>
                                        {BUYBACK_DURATION_LABELS[d]}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>

          {/* C. Interesse dei club */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px' }}>Interesse dei club</h3>
            <div className="card-premium" style={{ padding: outgoingMarketSummary.length ? '14px' : '22px' }}>
              {outgoingMarketSummary.length === 0 ? (
                <div className="ui-empty-state">
                  <Eye size={22} />
                  <p>Nessun club sta ancora osservando i tuoi giocatori.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {outgoingMarketSummary.slice(0, 8).map(entry => (
                    <div key={entry.playerId} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                      <strong style={{ fontSize: '0.82rem' }}>{entry.playerName}</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                        {entry.interests.map((interest, idx) => (
                          <div key={idx} title={interest.reasons.join(' · ')} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.68rem' }}>
                            <span style={{ fontWeight: 700 }}>{interest.clubName}</span>
                            <span style={{ color: 'var(--text-muted)' }}> · {interest.levelLabel}</span>
                            <div style={{ color: interest.probabilityLabel === 'Possibile offerta' ? 'var(--color-gold)' : 'var(--text-secondary)', marginTop: '2px' }}>{interest.probabilityLabel}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* D. Giocatori in uscita: gestione disponibilita, mai un'offerta garantita */}
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px' }}>Giocatori in uscita</h3>
            <div className="card-premium" style={{ marginBottom: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={playerToAddToOutgoing} onChange={e => setPlayerToAddToOutgoing(e.target.value)} style={{ flex: '1 1 200px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                <option value="">Aggiungi un giocatore alla lista...</option>
                {availablePlayersToList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.role})</option>)}
              </select>
              <button
                className="btn-secondary"
                disabled={!playerToAddToOutgoing}
                onClick={() => {
                  const target = players.find(p => p.id === playerToAddToOutgoing);
                  if (target) handleSetPlayerAvailability(target, 'listed_for_sale');
                  setPlayerToAddToOutgoing('');
                }}
                style={{ fontSize: '0.75rem', padding: '8px 12px' }}
              >
                Metti in lista
              </button>
            </div>
            <div className="card-premium" style={{ padding: outgoingPlayers.length ? 0 : '22px' }}>
              {outgoingPlayers.length === 0 ? (
                <div className="ui-empty-state">
                  <ArrowLeftRight size={22} />
                  <p>Nessun giocatore con disponibilita segnalata.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                <table className="premium-table" style={{ minWidth: '820px' }}>
                  <thead>
                    <tr><th>Giocatore</th><th>Disponibilita</th><th>Prezzo richiesto</th><th>Minimo privato</th><th>Contratto</th><th>Interesse</th><th>Motivazione</th></tr>
                  </thead>
                  <tbody>
                    {outgoingPlayers.map(player => {
                      const projectRole = getPlayerProjectRole(player, roleContext);
                      const availability = getEffectiveAvailability(player);
                      const interestCount = outgoingMarketSummary.find(e => e.playerId === player.id)?.interests.length ?? 0;
                      return (
                        <tr key={player.id}>
                          <td>
                            <button className="inline-player-link" onClick={() => openPlayerSheet(player)}>{player.name}</button>
                            {(() => {
                              const rumor = findActiveRumorForSubject(player.id);
                              return rumor ? <span className="badge" style={{ marginLeft: '6px', fontSize: '0.6rem' }}>{rumorBadgeLabel(rumor)}</span> : null;
                            })()}
                          </td>
                          <td>
                            <select
                              value={availability}
                              onChange={e => handleSetPlayerAvailability(player, e.target.value as TransferAvailability)}
                              style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: '0.68rem', color: 'var(--text-primary)' }}
                            >
                              {(Object.keys(AVAILABILITY_LABELS) as TransferAvailability[]).map(opt => (
                                <option key={opt} value={opt}>{AVAILABILITY_LABELS[opt]}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              defaultValue={player.askingPrice ?? ''}
                              placeholder={formatCurrency(player.value)}
                              onBlur={e => handleCommitAskingPrice(player, e.target.value)}
                              style={{ width: '110px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: '0.7rem', color: 'var(--text-primary)' }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              defaultValue={player.minimumAcceptablePrice ?? ''}
                              placeholder="—"
                              onBlur={e => handleCommitMinimumPrice(player, e.target.value)}
                              style={{ width: '100px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontSize: '0.7rem', color: 'var(--text-primary)' }}
                            />
                          </td>
                          <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{player.contractYears} ann{player.contractYears === 1 ? 'o' : 'i'}</td>
                          <td style={{ fontSize: '0.72rem', color: interestCount > 0 ? 'var(--color-gold)' : 'var(--text-muted)' }}>{interestCount > 0 ? `${interestCount} club` : 'Nessuno'}</td>
                          <td style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', maxWidth: '220px' }}>{projectRole.summary}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>

          {/* E. Trattative concluse di recente */}
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px' }}>Trattative concluse di recente</h3>
            <div className="card-premium" style={{ padding: concludedNegotiations.length ? 0 : '22px' }}>
              {concludedNegotiations.length === 0 ? (
                <div className="ui-empty-state">
                  <FileSignature size={22} />
                  <p>Nessuna trattativa conclusa di recente.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {concludedNegotiations.map(target => {
                    const clauseChoice = target.terms?.futureClauseChoice;
                    const clauseBadge =
                      clauseChoice === 'sell_on_gross' ? `${target.terms?.futureClauseSellOnPercentage ?? 0}% futura rivendita` :
                      clauseChoice === 'sell_on_capital_gain' ? `${target.terms?.futureClauseSellOnPercentage ?? 0}% plusvalenza` :
                      clauseChoice === 'buy_back' && target.terms?.futureClauseBuyBackDuration ? `Contro-riscatto (${BUYBACK_DURATION_LABELS[target.terms.futureClauseBuyBackDuration]})` :
                      null;
                    return (
                      <div key={target.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '0.76rem' }}>
                        <span>
                          {target.playerName} <span style={{ color: 'var(--text-muted)' }}>({target.currentClub})</span>
                          {clauseBadge && <span className="badge" style={{ marginLeft: '8px', fontSize: '0.6rem' }}>{clauseBadge}</span>}
                        </span>
                        <span style={{
                          color: target.status === 'completed' ? 'var(--color-pitch)' : 'var(--color-danger)',
                          fontWeight: 700
                        }}>
                          {NEGOTIATION_STATUS_LABELS[target.status]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* F. Cessioni recenti (offerte ricevute concluse) */}
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px' }}>Cessioni recenti</h3>
            <div className="card-premium" style={{ padding: recentOutgoingOutcomes.length ? 0 : '22px' }}>
              {recentOutgoingOutcomes.length === 0 ? (
                <div className="ui-empty-state">
                  <Send size={22} />
                  <p>Nessuna offerta ricevuta conclusa di recente.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {recentOutgoingOutcomes.map(offer => (
                    <div key={offer.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '0.76rem' }}>
                      <span>{offer.playerName} <span style={{ color: 'var(--text-muted)' }}>({offer.fromClub})</span></span>
                      <span style={{ color: offer.status === 'accepted' ? 'var(--color-pitch)' : 'var(--color-danger)', fontWeight: 700 }}>
                        {offer.status === 'accepted' ? 'Completata'
                          : offer.status === 'rejected' ? 'Rifiutata'
                          : offer.status === 'player_declined' ? 'Il giocatore ha rifiutato'
                          : 'Scaduta'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {marketTab === 'database' && (
        <div>
          <div className="card-premium" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: '1 1 200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Nome, club o nazionalita..."
                  value={dbSearch}
                  onChange={e => setDbSearch(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px 10px 8px 30px', fontSize: '0.8rem', color: 'var(--text-primary)' }}
                />
              </div>
              <select value={dbRoleFilter} onChange={e => setDbRoleFilter(e.target.value)} style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                <option value="ALL">Tutti i ruoli</option>
                <option value="GK">Portieri</option>
                <option value="DF">Difensori</option>
                <option value="MF">Centrocampisti</option>
                <option value="FW">Attaccanti</option>
              </select>
              <select value={dbSortKey} onChange={e => setDbSortKey(e.target.value as typeof dbSortKey)} style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                <option value="fit">Ordina: Compatibilita</option>
                <option value="overall">Ordina: Overall</option>
                <option value="potential">Ordina: Potenziale</option>
                <option value="age">Ordina: Eta</option>
                <option value="value">Ordina: Valore</option>
                <option value="wage">Ordina: Stipendio</option>
                <option value="contract">Ordina: Scadenza contratto</option>
                <option value="dna">Ordina: DNA fit</option>
                <option value="scout">Ordina: Qualita scouting</option>
              </select>
              <select value={dbAvailabilityFilter} onChange={e => setDbAvailabilityFilter(e.target.value as typeof dbAvailabilityFilter)} style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                <option value="ALL">Tutti</option>
                <option value="FREE_AGENT">Svincolati</option>
                <option value="EXPIRING">In scadenza</option>
                <option value="ON_LOAN">In prestito</option>
                <option value="PURCHASABLE_ONLY">Solo acquistabili</option>
              </select>
              <button className="btn-secondary" onClick={() => setDbShowAdvancedFilters(v => !v)} style={{ fontSize: '0.72rem', padding: '8px 12px' }}>
                {dbShowAdvancedFilters ? 'Nascondi filtri' : 'Filtri avanzati'}
              </button>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{databaseRanked.length} giocatori</span>
            </div>

            {dbShowAdvancedFilters && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Eta
                  <input type="number" value={dbAgeMin} onChange={e => setDbAgeMin(Number(e.target.value) || 0)} style={{ width: '48px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', color: 'var(--text-primary)' }} />
                  -
                  <input type="number" value={dbAgeMax} onChange={e => setDbAgeMax(Number(e.target.value) || 45)} style={{ width: '48px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', color: 'var(--text-primary)' }} />
                </label>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Overall
                  <input type="number" value={dbOverallMin} onChange={e => setDbOverallMin(Number(e.target.value) || 0)} style={{ width: '48px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', color: 'var(--text-primary)' }} />
                  -
                  <input type="number" value={dbOverallMax} onChange={e => setDbOverallMax(Number(e.target.value) || 99)} style={{ width: '48px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', color: 'var(--text-primary)' }} />
                </label>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Potenziale min
                  <input type="number" value={dbPotentialMin} onChange={e => setDbPotentialMin(Number(e.target.value) || 0)} style={{ width: '48px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', color: 'var(--text-primary)' }} />
                </label>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Valore
                  <input type="number" value={dbValueMin || ''} placeholder="min" onChange={e => setDbValueMin(Number(e.target.value) || 0)} style={{ width: '80px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', color: 'var(--text-primary)' }} />
                  -
                  <input type="number" value={dbValueMax || ''} placeholder="max" onChange={e => setDbValueMax(Number(e.target.value) || 0)} style={{ width: '80px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', color: 'var(--text-primary)' }} />
                </label>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Stipendio max (€/sett)
                  <input type="number" value={dbWageMax || ''} placeholder="nessuno" onChange={e => setDbWageMax(Number(e.target.value) || 0)} style={{ width: '80px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', color: 'var(--text-primary)' }} />
                </label>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Contratto max (anni)
                  <input type="number" value={dbContractMaxYears || ''} placeholder="nessuno" onChange={e => setDbContractMaxYears(Number(e.target.value) || 0)} style={{ width: '56px', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', color: 'var(--text-primary)' }} />
                </label>
                <select value={dbStatusFilter} onChange={e => setDbStatusFilter(e.target.value as typeof dbStatusFilter)} style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', fontSize: '0.72rem', color: 'var(--text-primary)' }}>
                  <option value="ALL">Ogni stato</option>
                  <option value="Disponibile">Disponibile</option>
                  <option value="In Forma">In forma</option>
                  <option value="Stanco">Stanco</option>
                  <option value="Infortunato">Infortunato</option>
                  <option value="Cedibile">Cedibile</option>
                </select>
                <select value={dbFootFilter} onChange={e => setDbFootFilter(e.target.value as typeof dbFootFilter)} style={{ backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '6px', fontSize: '0.72rem', color: 'var(--text-primary)' }}>
                  <option value="ALL">Ogni piede</option>
                  <option value="Destro">Destro</option>
                  <option value="Sinistro">Sinistro</option>
                  <option value="Ambidestro">Ambidestro</option>
                </select>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input className="ui-checkbox" type="checkbox" checked={dbSustainableOnly} onChange={e => setDbSustainableOnly(e.target.checked)} /> Solo sostenibili
                </label>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input className="ui-checkbox" type="checkbox" checked={dbDnaCompatibleOnly} onChange={e => setDbDnaCompatibleOnly(e.target.checked)} /> Solo DNA compatibile
                </label>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input className="ui-checkbox" type="checkbox" checked={dbShowOwnRoster} onChange={e => setDbShowOwnRoster(e.target.checked)} /> Mostra rosa attuale (confronto)
                </label>
              </div>
            )}
          </div>

          <div className="card-premium" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Giocatore</th><th>Ruolo</th><th>Club</th><th>Eta</th><th>Scouting</th><th>Compatibilita</th><th>Valore</th><th>Stipendio</th><th>Contratto</th><th style={{ textAlign: 'center' }}>Azione</th>
                </tr>
              </thead>
              <tbody>
                {databaseRanked.slice(0, 120).map(({ player, clubName, scouting, fit }) => {
                  const scoutLevel = scouting?.scoutLevel ?? 0;
                  const negotiation = negotiationForPlayer(player.name, clubName);
                  const isOwn = clubName === teamName;
                  // Mercato M2A: badge visibile solo per un contro-riscatto attivo del MIO club, mai per clausole di terzi.
                  const myActiveBuyBack = player.buyBackClauses?.find(c => c.status === 'active' && c.holderClubId === resolveClubId(teamName));
                  // Mercato M2B: svincolato, in scadenza, scambio possibile, accordo futuro gia' firmato.
                  const isFreeAgentPlayer = isFreeAgent(player);
                  const isExpiring = player.contractYears <= 1 && !isFreeAgentPlayer;
                  const existingFutureAgreement = careerWorld.futureContractAgreements.find(a => a.playerId === player.id && a.status === 'active');
                  const precontractEligibility = isPrecontractEligible(player, currentRound, careerWorld.futureContractAgreements);
                  const canSwap = !isOwn && !isFreeAgentPlayer && !negotiation && !existingFutureAgreement && swapEligiblePlayers.length > 0;
                  // Mercato M2C: prelazione mia attiva, clausola anti-rivale attiva, scambio di prestiti possibile/attivo.
                  const myActiveFirstRefusal = player.firstRefusalClauses?.find(c => c.status === 'active' && c.holderClubId === resolveClubId(teamName));
                  const activeAntiRival = player.antiRivalClauses?.find(c => c.status === 'active');
                  const isOnLoanSwap = !!player.loanState?.loanSwapId;
                  const canLoanSwap = !isOwn && !isFreeAgentPlayer && !negotiation && !existingFutureAgreement && !player.loanState
                    && (player.squadStatus ?? 'first_team') === 'first_team' && loanSwapEligiblePlayers.length > 0;
                  // Mercato M4: badge solo con scouting sufficiente (mai dati non noti mostrati a caso).
                  const hasEnoughScoutingForM4 = scoutLevel >= 2;
                  const negotiationCompetition = negotiation ? careerWorld.transferCompetitions.find(c => c.negotiationId === negotiation.id) : undefined;
                  const showHighCompetition = hasEnoughScoutingForM4 && !!negotiationCompetition && negotiationCompetition.pressureLevel >= 50;
                  const showAuctionPossible = hasEnoughScoutingForM4 && (negotiationCompetition?.status === 'auction' || (negotiationCompetition?.competingBids.filter(b => b.status === 'bid_submitted').length ?? 0) >= 2);
                  const showOutbidRisk = hasEnoughScoutingForM4 && negotiationCompetition?.status === 'user_outbid';
                  const showPlayerWaiting = hasEnoughScoutingForM4 && !!negotiation?.playerWaitingReason;
                  const showDifficultAgent = hasEnoughScoutingForM4 && !isOwn && !isFreeAgentPlayer && (() => {
                    const agentProfile = ensurePlayerAgentProfile(player, careerWorld.playerAgentProfiles);
                    return agentProfile.archetype === 'aggressive' && agentProfile.negotiationAggressiveness >= 60;
                  })();
                  return (
                    <tr key={`${clubName}-${player.id}`}>
                      <td>
                        <button className="inline-player-link" onClick={() => openPlayerSheet(player)}>{player.name}</button>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '3px' }}>
                          {myActiveBuyBack && <span className="badge" style={{ fontSize: '0.58rem', color: 'var(--color-gold)' }}>Contro-riscatto disponibile</span>}
                          {isFreeAgentPlayer && <span className="badge" style={{ fontSize: '0.58rem' }}>Svincolato</span>}
                          {isExpiring && <span className="badge" style={{ fontSize: '0.58rem', color: 'var(--color-gold)' }}>In scadenza</span>}
                          {!isOwn && !isFreeAgentPlayer && !negotiation && !existingFutureAgreement && precontractEligibility.eligible && <span className="badge" style={{ fontSize: '0.58rem' }}>Precontratto disponibile</span>}
                          {canSwap && <span className="badge" style={{ fontSize: '0.58rem' }}>Scambio possibile</span>}
                          {myActiveFirstRefusal && <span className="badge" style={{ fontSize: '0.58rem', color: 'var(--color-gold)' }}>Prelazione attiva</span>}
                          {activeAntiRival && <span className="badge" style={{ fontSize: '0.58rem', color: 'var(--color-danger)' }}>Clausola anti-rivale</span>}
                          {isOnLoanSwap && <span className="badge" style={{ fontSize: '0.58rem', color: 'var(--color-lime)' }}>Scambio di prestiti attivo</span>}
                          {!isOnLoanSwap && canLoanSwap && <span className="badge" style={{ fontSize: '0.58rem' }}>Scambio di prestiti possibile</span>}
                          {negotiation && <span className="badge" style={{ fontSize: '0.58rem', color: 'var(--color-gold)' }}>Gia in trattativa</span>}
                          {existingFutureAgreement && <span className="badge" style={{ fontSize: '0.58rem', color: 'var(--color-pitch)' }}>Accordo futuro gia firmato</span>}
                          {showHighCompetition && <span className="badge" style={{ fontSize: '0.58rem', color: 'var(--color-danger)' }}>Concorrenza alta</span>}
                          {showAuctionPossible && <span className="badge" style={{ fontSize: '0.58rem', color: 'var(--color-gold)' }}>Asta possibile</span>}
                          {showOutbidRisk && <span className="badge" style={{ fontSize: '0.58rem', color: 'var(--color-danger)' }}>Rischio sorpasso</span>}
                          {showPlayerWaiting && <span className="badge" style={{ fontSize: '0.58rem' }}>Giocatore in attesa</span>}
                          {showDifficultAgent && <span className="badge" style={{ fontSize: '0.58rem' }}>Agente difficile</span>}
                        </div>
                      </td>
                      <td><span className={`badge badge-${player.role === 'GK' ? 'GK' : player.role.match(/CB|LB|RB/) ? 'DF' : player.role.match(/DM|CM|AM/) ? 'MF' : 'FW'}`}>{player.role}</span></td>
                      <td><button className="inline-club-link" onClick={() => openClubInfo(clubName)}>{clubName}</button></td>
                      <td>{player.age}</td>
                      <td style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{getScoutReliabilityLabel(scoutLevel)}</td>
                      <td>
                        <strong style={{ color: fitLabelColor(fit.label), fontSize: '0.7rem' }}>{fit.label}</strong>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{fit.reasons[0]}</div>
                      </td>
                      <td>{isFreeAgentPlayer ? '—' : formatCurrency(player.value)}</td>
                      <td>{formatCurrency(player.wage)}/sett</td>
                      <td>{player.contractYears} anni</td>
                      <td style={{ textAlign: 'center' }}>
                        {isOwn ? (
                          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Rosa attuale</span>
                        ) : existingFutureAgreement ? (
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                            {formatCurrency(existingFutureAgreement.annualSalary)}/anno dal {existingFutureAgreement.effectiveSeason}
                          </span>
                        ) : myActiveBuyBack ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{formatCurrency(myActiveBuyBack.buyBackFee)} · fino al {myActiveBuyBack.expirySeason}</span>
                            <button className="btn-primary" onClick={() => handleExerciseBuyBack(player, myActiveBuyBack)} style={{ padding: '4px 8px', fontSize: '0.64rem' }}>Esercita contro-riscatto</button>
                          </div>
                        ) : isFreeAgentPlayer ? (
                          <button className="btn-primary" onClick={() => handleTreatFreeAgent(player)} style={{ padding: '4px 8px', fontSize: '0.64rem' }}>Tratta contratto</button>
                        ) : negotiation ? (
                          <span style={{ fontSize: '0.66rem', color: 'var(--color-gold)', fontWeight: 700 }}>In trattativa</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {!scouting ? (
                              <button className="btn-secondary" onClick={() => handleObservePlayer(player, clubName)} style={{ padding: '4px 8px', fontSize: '0.64rem' }}>Osserva</button>
                            ) : (
                              <>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Gia osservato</span>
                                {scoutLevel < 4 && (
                                  <button className="btn-secondary" onClick={() => handleScoutTarget(scouting)} style={{ padding: '4px 8px', fontSize: '0.64rem' }}>
                                    <Eye size={10} /> Scout
                                  </button>
                                )}
                              </>
                            )}
                            <button className="btn-primary" onClick={() => handleStartNegotiationFromDatabase(player, clubName)} style={{ padding: '4px 8px', fontSize: '0.64rem' }}>
                              <Send size={10} /> Avvia trattativa
                            </button>
                            {canSwap && (
                              <button className="btn-secondary" onClick={() => handleProposeSwapFromDatabase(player, clubName)} style={{ padding: '4px 8px', fontSize: '0.64rem' }}>
                                Proponi scambio
                              </button>
                            )}
                            {precontractEligibility.eligible && (
                              <button className="btn-secondary" onClick={() => handleProposePrecontract(player, clubName)} style={{ padding: '4px 8px', fontSize: '0.64rem' }}>
                                Proponi precontratto
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {databaseRanked.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '26px', color: 'var(--text-muted)' }}>Nessun giocatore corrisponde ai filtri.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fase 1: modal offerta al club (Mercato M1: formule reali, mai finte) */}
      <ModalPortal>
      <AnimatePresence>
        {biddingPlayer && (
          <div className="modal-backdrop" onClick={() => setBiddingPlayer(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content" style={{ width: '520px', maxHeight: '88vh', overflowY: 'auto' }} onClick={event => event.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Offerta al club per {biddingPlayer.playerName}</h3>
                <button className="btn-secondary" onClick={() => setBiddingPlayer(null)} aria-label="Chiudi offerta al club" style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center', flex: '0 0 auto' }}>
                  <X size={15} />
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Fase 1 di 2: qui tratti solo con il {biddingPlayer.currentClub}. Il contratto/prestito col giocatore si negozia dopo, solo se il club accetta.
              </p>
              {biddingPlayer.terms && biddingPlayer.clubCounterTerms && (() => {
                const diffRows = buildCounterDiff(biddingPlayer.terms!, biddingPlayer.clubCounterTerms!);
                return diffRows.length > 0 ? (
                  <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(212,175,55,0.08)', padding: '10px', marginBottom: '12px' }}>
                    <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-gold)', marginBottom: '6px' }}>Differenza tra la tua offerta e la richiesta del club</p>
                    {diffRows.map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginTop: '2px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                        <span><span style={{ color: 'var(--text-muted)' }}>{row.mine}</span> → <strong style={{ color: 'var(--color-gold)' }}>{row.theirs}</strong></span>
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tipo di operazione</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['permanent', 'loan'] as TransferBaseType[]).map(bt => (
                      <button key={bt} type="button" onClick={() => setOfferBaseType(bt)}
                        className={offerBaseType === bt ? 'btn-primary' : 'btn-secondary'}
                        style={{ flex: 1, justifyContent: 'center', fontSize: '0.76rem', padding: '8px' }}>
                        {TRANSFER_BASE_TYPE_LABELS[bt]}
                      </button>
                    ))}
                  </div>
                </div>

                {offerBaseType === 'permanent' && (
                  <>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Formula</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => setOfferIsSwap(false)} className={!offerIsSwap ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, justifyContent: 'center', fontSize: '0.72rem', padding: '8px' }}>Cartellino</button>
                        <button type="button" onClick={() => setOfferIsSwap(true)} className={offerIsSwap ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, justifyContent: 'center', fontSize: '0.72rem', padding: '8px' }}>Scambio giocatori</button>
                      </div>
                    </div>

                    {offerIsSwap ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Mio giocatore da offrire</label>
                          <select value={swapOfferedPlayerId} onChange={e => setSwapOfferedPlayerId(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            <option value="">Seleziona un giocatore...</option>
                            {swapEligiblePlayers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.role}, {formatCurrency(p.value)})</option>)}
                          </select>
                        </div>
                        {swapOfferedPlayerId && (() => {
                          const offeredPlayer = players.find(p => p.id === swapOfferedPlayerId);
                          if (!offeredPlayer) return null;
                          const projectRole = getPlayerProjectRole(offeredPlayer, roleContext);
                          const willingness = getPlayerTransferWillingness(offeredPlayer, projectRole);
                          return (
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Valore stimato: {formatCurrency(offeredPlayer.value)} vs {formatCurrency(biddingPlayer.value)}</span>
                              <span style={{ color: willingness.level === 'wants_to_stay' ? 'var(--color-danger)' : 'var(--color-pitch)' }}>{willingness.label}</span>
                            </div>
                          );
                        })()}
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Conguaglio</label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {(['none', 'user_club', 'other_club'] as SwapCashDirection[]).map(dir => (
                              <button key={dir} type="button" onClick={() => setSwapCashPaidBy(dir)} className={swapCashPaidBy === dir ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, justifyContent: 'center', fontSize: '0.66rem', padding: '6px' }}>
                                {SWAP_CASH_DIRECTION_LABELS[dir]}
                              </button>
                            ))}
                          </div>
                        </div>
                        {swapCashPaidBy !== 'none' && (
                          <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Importo conguaglio (€)</label>
                            <input type="number" value={swapCashAdjustment} onChange={e => setSwapCashAdjustment(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }} />
                          </div>
                        )}
                        <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                          Impatto su budget trasferimenti: {formatCurrency(swapCashPaidBy === 'user_club' ? -(Number(swapCashAdjustment) || 0) : swapCashPaidBy === 'other_club' ? (Number(swapCashAdjustment) || 0) : 0)}. Il contratto del giocatore in entrata incide sul budget stipendi separatamente.
                        </p>
                      </div>
                    ) : (
                      <>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Cartellino (pagamento immediato, €)</label>
                      <input type="number" value={offerUpfrontFee} onChange={e => setOfferUpfrontFee(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '0.85rem', color: 'var(--text-primary)' }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Valore di mercato: {formatCurrency(biddingPlayer.value)}</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Rate future (max {MAX_INSTALLMENTS})</label>
                        {offerInstallments.length < MAX_INSTALLMENTS && (
                          <button type="button" className="btn-secondary" style={{ fontSize: '0.65rem', padding: '4px 8px' }}
                            onClick={() => setOfferInstallments([...offerInstallments, { id: `inst_${Date.now()}_${offerInstallments.length}`, amount: 0, dueSeason: `Stagione +${offerInstallments.length + 1}`, status: 'pending' }])}>
                            + Aggiungi rata
                          </button>
                        )}
                      </div>
                      {offerInstallments.map((inst, idx) => (
                        <div key={inst.id} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                          <input type="number" value={inst.amount}
                            onChange={e => setOfferInstallments(offerInstallments.map((it, i) => (i === idx ? { ...it, amount: Number(e.target.value) || 0 } : it)))}
                            placeholder={`Importo rata ${idx + 1}`}
                            style={{ flex: 1, backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }} />
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', minWidth: '80px' }}>{inst.dueSeason}</span>
                          <button type="button" className="btn-secondary" style={{ fontSize: '0.65rem', padding: '4px 8px' }} onClick={() => setOfferInstallments(offerInstallments.filter((_, i) => i !== idx))}>×</button>
                        </div>
                      ))}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Clausole future (facoltativo)</label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(['none', 'sell_on_gross', 'sell_on_capital_gain', 'buy_back'] as FutureClauseChoice[]).map(choice => (
                          <button key={choice} type="button" onClick={() => setOfferFutureClauseChoice(choice)}
                            className={offerFutureClauseChoice === choice ? 'btn-primary' : 'btn-secondary'}
                            style={{ flex: '1 1 auto', justifyContent: 'center', fontSize: '0.68rem', padding: '6px 8px' }}>
                            {FUTURE_CLAUSE_CHOICE_LABELS[choice]}
                          </button>
                        ))}
                      </div>

                      {(offerFutureClauseChoice === 'sell_on_gross' || offerFutureClauseChoice === 'sell_on_capital_gain') && (
                        <div style={{ marginTop: '10px' }}>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Percentuale</label>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {SELL_ON_PERCENTAGE_OPTIONS.map(pct => (
                              <button key={pct} type="button" onClick={() => setOfferFutureClauseSellOnPercentage(pct)}
                                className={offerFutureClauseSellOnPercentage === pct ? 'btn-primary' : 'btn-secondary'}
                                style={{ flex: '1 1 auto', justifyContent: 'center', fontSize: '0.66rem', padding: '5px' }}>
                                {pct}%
                              </button>
                            ))}
                          </div>
                          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                            Beneficiario: {biddingPlayer.currentClub}. {offerFutureClauseChoice === 'sell_on_gross'
                              ? `Riceve il ${offerFutureClauseSellOnPercentage}% dell'incasso lordo se rivendi il giocatore in futuro.`
                              : `Riceve il ${offerFutureClauseSellOnPercentage}% della plusvalenza (incasso futuro meno il cartellino pagato ora) se rivendi il giocatore in futuro.`}
                          </p>
                        </div>
                      )}

                      {offerFutureClauseChoice === 'buy_back' && (
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Prezzo di riacquisto (€)</label>
                            <input type="number" value={offerFutureClauseBuyBackFee} onChange={e => setOfferFutureClauseBuyBackFee(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.8rem', color: 'var(--text-primary)' }} />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Scadenza</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {(['current_season', 'next_season', 'two_seasons'] as BuyBackDuration[]).map(d => (
                                <button key={d} type="button" onClick={() => setOfferFutureClauseBuyBackDuration(d)}
                                  className={offerFutureClauseBuyBackDuration === d ? 'btn-primary' : 'btn-secondary'}
                                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.66rem', padding: '6px' }}>
                                  {BUYBACK_DURATION_LABELS[d]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <p style={{ fontSize: '0.62rem', color: 'var(--color-gold)' }}>
                            Il club venditore ({biddingPlayer.currentClub}) potra riacquistare il giocatore entro la data scelta.
                          </p>
                        </div>
                      )}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Protezioni (facoltativo)</label>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(['none', 'first_refusal', 'anti_rival'] as ProtectiveClauseChoice[]).map(choice => (
                          <button key={choice} type="button" onClick={() => setOfferProtectiveClauseChoice(choice)}
                            className={offerProtectiveClauseChoice === choice ? 'btn-primary' : 'btn-secondary'}
                            style={{ flex: '1 1 auto', justifyContent: 'center', fontSize: '0.68rem', padding: '6px 8px' }}>
                            {PROTECTIVE_CLAUSE_CHOICE_LABELS[choice]}
                          </button>
                        ))}
                      </div>

                      {offerProtectiveClauseChoice === 'first_refusal' && (
                        <div style={{ marginTop: '10px' }}>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Scadenza</label>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {(['current_season', 'next_season', 'two_seasons'] as ProtectiveClauseDuration[]).map(d => (
                              <button key={d} type="button" onClick={() => setOfferProtectiveClauseDuration(d)}
                                className={offerProtectiveClauseDuration === d ? 'btn-primary' : 'btn-secondary'}
                                style={{ flex: 1, justifyContent: 'center', fontSize: '0.66rem', padding: '6px' }}>
                                {BUYBACK_DURATION_LABELS[d]}
                              </button>
                            ))}
                          </div>
                          <p style={{ fontSize: '0.62rem', color: 'var(--color-gold)', marginTop: '6px' }}>
                            Il club venditore ({biddingPlayer.currentClub}) potra eguagliare una futura offerta prima della cessione.
                          </p>
                        </div>
                      )}

                      {offerProtectiveClauseChoice === 'anti_rival' && (
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Modalita</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {(['block', 'penalty'] as AntiRivalClauseMode[]).map(m => (
                                <button key={m} type="button" onClick={() => setOfferAntiRivalMode(m)}
                                  className={offerAntiRivalMode === m ? 'btn-primary' : 'btn-secondary'}
                                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.68rem', padding: '6px' }}>
                                  {ANTI_RIVAL_MODE_LABELS[m]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Club protetti (max 3, solo rivali reali)</label>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {getRecognizedRivalClubNames(clubHistory).length === 0 ? (
                                <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Nessuna rivalita reale ancora riconosciuta dal sistema.</span>
                              ) : getRecognizedRivalClubNames(clubHistory).map(name => (
                                <button key={name} type="button"
                                  onClick={() => setOfferAntiRivalClubNames(current => (
                                    current.includes(name) ? current.filter(n => n !== name) : current.length < 3 ? [...current, name] : current
                                  ))}
                                  className={offerAntiRivalClubNames.includes(name) ? 'btn-primary' : 'btn-secondary'}
                                  style={{ fontSize: '0.64rem', padding: '5px 8px' }}>
                                  {name}
                                </button>
                              ))}
                            </div>
                          </div>
                          {offerAntiRivalMode === 'penalty' && (
                            <div>
                              <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Percentuale penale</label>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {ANTI_RIVAL_PENALTY_PERCENTAGES.map(pct => (
                                  <button key={pct} type="button" onClick={() => setOfferAntiRivalPenaltyPercent(pct)}
                                    className={offerAntiRivalPenaltyPercent === pct ? 'btn-primary' : 'btn-secondary'}
                                    style={{ flex: 1, justifyContent: 'center', fontSize: '0.64rem', padding: '5px' }}>
                                    {pct}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Scadenza</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {(['current_season', 'next_season', 'two_seasons'] as ProtectiveClauseDuration[]).map(d => (
                                <button key={d} type="button" onClick={() => setOfferProtectiveClauseDuration(d)}
                                  className={offerProtectiveClauseDuration === d ? 'btn-primary' : 'btn-secondary'}
                                  style={{ flex: 1, justifyContent: 'center', fontSize: '0.66rem', padding: '6px' }}>
                                  {BUYBACK_DURATION_LABELS[d]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                      </>
                    )}
                  </>
                )}

                {offerBaseType === 'loan' && (
                  <>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Formula</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => setOfferIsLoanSwap(false)} className={!offerIsLoanSwap ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, justifyContent: 'center', fontSize: '0.72rem', padding: '8px' }}>Prestito</button>
                        <button type="button" onClick={() => setOfferIsLoanSwap(true)} className={offerIsLoanSwap ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, justifyContent: 'center', fontSize: '0.72rem', padding: '8px' }}>Scambio di prestiti</button>
                      </div>
                    </div>

                    {offerIsLoanSwap ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Mio giocatore da offrire in prestito</label>
                          <select value={loanSwapOfferedPlayerId} onChange={e => setLoanSwapOfferedPlayerId(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                            <option value="">Seleziona un giocatore...</option>
                            {loanSwapEligiblePlayers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.role}, {formatCurrency(p.wage)}/sett)</option>)}
                          </select>
                        </div>
                        {loanSwapOfferedPlayerId && (() => {
                          const offeredPlayer = players.find(p => p.id === loanSwapOfferedPlayerId);
                          if (!offeredPlayer) return null;
                          const projectRole = getPlayerProjectRole(offeredPlayer, roleContext);
                          const willingness = getPlayerTransferWillingness(offeredPlayer, projectRole);
                          return (
                            <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{offeredPlayer.role} · {formatCurrency(offeredPlayer.value)} · {biddingPlayer.playerName}: {formatCurrency(biddingPlayer.value)}</span>
                              <span style={{ color: willingness.level === 'wants_to_stay' ? 'var(--color-danger)' : 'var(--color-pitch)' }}>{willingness.label}</span>
                            </div>
                          );
                        })()}
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Quota stipendio che pago io per il giocatore in entrata</label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {([0, 25, 50, 75, 100] as const).map(pct => (
                              <button key={pct} type="button" onClick={() => setLoanSwapUserPaysPercent(pct)} className={loanSwapUserPaysPercent === pct ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, justifyContent: 'center', fontSize: '0.64rem', padding: '5px' }}>{pct}%</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Quota stipendio che paga il {biddingPlayer.currentClub} per il mio giocatore in uscita</label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {([0, 25, 50, 75, 100] as const).map(pct => (
                              <button key={pct} type="button" onClick={() => setLoanSwapOtherPaysPercent(pct)} className={loanSwapOtherPaysPercent === pct ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, justifyContent: 'center', fontSize: '0.64rem', padding: '5px' }}>{pct}%</button>
                            ))}
                          </div>
                        </div>
                        <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                          Nessun cartellino, nessun conguaglio, nessuna rata, nessun diritto/obbligo. Durata: fino a fine stagione ({careerWorld.clubWageBudgetState.season}), ritorno automatico a entrambi i club proprietari.
                        </p>
                      </div>
                    ) : (
                      <>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Indennizzo prestito (€)</label>
                      <input type="number" value={offerLoanFee} onChange={e => setOfferLoanFee(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '0.85rem', color: 'var(--text-primary)' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Quota stipendio a tuo carico</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {([0, 25, 50, 75, 100] as const).map(pct => (
                          <button key={pct} type="button" onClick={() => setOfferWageShare(pct)}
                            className={offerWageShare === pct ? 'btn-primary' : 'btn-secondary'}
                            style={{ flex: 1, justifyContent: 'center', fontSize: '0.72rem', padding: '6px' }}>
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Clausola</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {(['none', 'option', 'obligation'] as PurchaseClauseType[]).map(pc => (
                          <button key={pc} type="button" onClick={() => setOfferPurchaseClause(pc)}
                            className={offerPurchaseClause === pc ? 'btn-primary' : 'btn-secondary'}
                            style={{ flex: 1, justifyContent: 'center', fontSize: '0.7rem', padding: '8px' }}>
                            {PURCHASE_CLAUSE_LABELS[pc]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>Durata: fino a fine stagione ({careerWorld.clubWageBudgetState.season}).</p>
                    {(offerPurchaseClause === 'option' || offerPurchaseClause === 'obligation') && (
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Prezzo {offerPurchaseClause === 'option' ? 'diritto' : 'obbligo'} di riscatto (€)
                        </label>
                        <input type="number" value={offerPurchaseFee} onChange={e => setOfferPurchaseFee(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '0.85rem', color: 'var(--text-primary)' }} />
                        {offerPurchaseClause === 'option' && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Facoltativo: sottratto solo se eserciti il diritto.</span>}
                      </div>
                    )}
                    {offerPurchaseClause === 'obligation' && (
                      <>
                        <div>
                          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Condizione obbligo</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {(['unconditional', 'appearances'] as ObligationCondition[]).map(oc => (
                              <button key={oc} type="button" onClick={() => setOfferObligationCondition(oc)}
                                className={offerObligationCondition === oc ? 'btn-primary' : 'btn-secondary'}
                                style={{ flex: 1, justifyContent: 'center', fontSize: '0.7rem', padding: '8px' }}>
                                {OBLIGATION_CONDITION_LABELS[oc]}
                              </button>
                            ))}
                          </div>
                        </div>
                        {offerObligationCondition === 'appearances' && (
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Soglia presenze richiesta</label>
                            <input type="number" value={offerRequiredAppearances} onChange={e => setOfferRequiredAppearances(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '0.85rem', color: 'var(--text-primary)' }} />
                          </div>
                        )}
                      </>
                    )}
                      </>
                    )}
                  </>
                )}

                {/* Riepilogo economico fisso: sempre visibile per le formule con cartellino/prestito. */}
                {!(offerBaseType === 'permanent' && offerIsSwap) && !(offerBaseType === 'loan' && offerIsLoanSwap) && (
                  <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.28)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Costo oggi</span>
                      <strong>{formatCurrency(offerImmediateCost)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Rate future</span>
                      <strong>{formatCurrency(offerBaseType === 'permanent' ? offerFutureCommitment : 0)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Stipendio fino a fine stagione</span>
                      <strong>{formatCurrency(offerSeasonWageCost)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Impegno futuro (rate/obbligo)</span>
                      <strong>{formatCurrency(offerFutureCommitment)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Budget trasferimenti residuo</span>
                      <strong style={{ color: offerBudgetAfter >= 0 ? 'var(--color-pitch)' : 'var(--color-danger)' }}>{formatCurrency(offerBudgetAfter)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Margine stipendio residuo</span>
                      <strong style={{ color: offerWageMarginAfter >= 0 ? 'var(--color-pitch)' : 'var(--color-danger)' }}>{formatCurrency(offerWageMarginAfter)}</strong>
                    </div>
                    {offerCreatesFuturePressure && (
                      <p style={{ fontSize: '0.66rem', color: 'var(--color-gold)', marginTop: '4px' }}>Attenzione: questa operazione crea un impegno futuro rilevante rispetto al budget attuale.</p>
                    )}
                    {!offerValidation.valid && (
                      <p style={{ fontSize: '0.68rem', color: 'var(--color-danger)', marginTop: '4px' }}>{offerValidation.reason}</p>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                  <button disabled={isSimulatingDeal} onClick={() => setBiddingPlayer(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Annulla</button>
                  <button
                    disabled={isSimulatingDeal || (
                      offerBaseType === 'permanent' && offerIsSwap ? !swapOfferedPlayerId :
                      offerBaseType === 'loan' && offerIsLoanSwap ? !loanSwapOfferedPlayerId :
                      !offerValidation.valid
                    )}
                    onClick={
                      offerBaseType === 'permanent' && offerIsSwap ? handleSendSwapOffer :
                      offerBaseType === 'loan' && offerIsLoanSwap ? handleSendLoanSwapOffer :
                      handleSendClubOffer
                    }
                    className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {isSimulatingDeal ? <><RotateCw size={14} className="ui-spin" /> Negoziazione...</> : <><Send size={14} /> Invia offerta al club</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </ModalPortal>

      {/* Fase 2: modal contratto al giocatore */}
      <ModalPortal>
      <AnimatePresence>
        {contractTarget && contractPreview && (
          <div className="modal-backdrop" onClick={() => setContractTarget(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content" style={{ width: '520px' }} onClick={event => event.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Contratto per {contractTarget.playerName}</h3>
                <button className="btn-secondary" onClick={() => setContractTarget(null)} aria-label="Chiudi contratto" style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center', flex: '0 0 auto' }}>
                  <X size={15} />
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Fase 2 di 2: il club ha accettato {formatCurrency(contractTarget.clubAgreedFee ?? 0)}. Ora negozi solo con il giocatore.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Stipendio settimanale (€)</label>
                    <input type="number" value={contractWage} onChange={e => setContractWage(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Durata (anni)</label>
                    <select value={contractYears} onChange={e => setContractYears(Number(e.target.value))} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      {[2, 3, 4, 5].map(y => <option key={y} value={y}>{y} anni</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bonus firma (una tantum)</label>
                    <input type="number" value={contractSigningBonus} onChange={e => setContractSigningBonus(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Commissione agente</label>
                    <input type="number" value={contractAgentFee} onChange={e => setContractAgentFee(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Ruolo promesso</label>
                  <select value={promiseType} onChange={e => setPromiseType(e.target.value as ContractPromiseType)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                    <option value="none">Nessuna promessa</option>
                    <option value="rotation">Rotazione importante</option>
                    <option value="starter">Titolare</option>
                    <option value="youngProject">Progetto giovane</option>
                    <option value="starRole">Stella centrale</option>
                  </select>
                </div>

                {/* Mercato M4: box agente, solo per acquisti definitivi in scope. */}
                {isCompetitionEligibleNegotiation(contractTarget.id, contractTarget.terms?.baseType, !!contractTarget.swapTerms, !!contractTarget.loanSwapTerms) && (() => {
                  const agentProfile = ensurePlayerAgentProfile(contractPreview.evalPlayer, careerWorld.playerAgentProfiles);
                  const competition = careerWorld.transferCompetitions.find(c => c.negotiationId === contractTarget.id);
                  const reaction = processAgentReaction(agentProfile, competition, currentRound, activeTransferWindow?.status === 'closing_soon');
                  return (
                    <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(212,175,55,0.05)', padding: '10px' }}>
                      <strong style={{ fontSize: '0.76rem', display: 'block', marginBottom: '4px' }}>Agente: {AGENT_ARCHETYPE_LABELS[agentProfile.archetype]}</strong>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Aggressivita {agentProfile.negotiationAggressiveness}/100 · Sensibilita stipendio {agentProfile.wageSensitivity}/100 · Attenzione al progetto {agentProfile.projectSensitivity}/100
                      </p>
                      {reaction.reasons.length > 0 && (
                        <ul style={{ margin: '6px 0 0', paddingLeft: '16px', fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                          {reaction.reasons.map((reason, idx) => <li key={idx}>{reason}</li>)}
                        </ul>
                      )}
                      {reaction.wantsReleaseClause && (
                        <p style={{ fontSize: '0.66rem', color: 'var(--color-gold)', marginTop: '4px' }}>Il procuratore chiede una clausola rescissoria nel contratto.</p>
                      )}
                    </div>
                  );
                })()}

                <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.28)', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Costo una tantum (cartellino + bonus + agente)</span>
                    <strong style={{ color: contractPreview.impact.transferBudgetOk ? 'var(--color-pitch)' : 'var(--color-danger)' }}>
                      {formatCurrency((contractTarget.clubAgreedFee ?? 0) + contractPreview.signingBonus + contractPreview.agentFeeNum)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginTop: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Impegno annuo (budget stipendi)</span>
                    <strong style={{ color: contractPreview.impact.wageBudgetOk ? 'var(--color-pitch)' : 'var(--color-danger)' }}>{formatCurrency(contractPreview.annualSalary)}/anno</strong>
                  </div>
                  <p style={{ fontSize: '0.68rem', marginTop: '6px', color: contractPreview.evaluation.decision === 'accepted' ? 'var(--color-pitch)' : contractPreview.evaluation.decision.startsWith('blocked') ? 'var(--color-danger)' : 'var(--color-gold)' }}>
                    {contractPreview.evaluation.message}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                  <button disabled={isNegotiatingContract} onClick={() => setContractTarget(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Annulla</button>
                  <button disabled={isNegotiatingContract} onClick={handleSendContractOffer} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                    {isNegotiatingContract ? <><RotateCw size={14} className="ui-spin" /> Negoziazione...</> : <><FileSignature size={14} /> Proponi contratto</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </ModalPortal>

      {/* Fase 2 (prestiti): il giocatore valuta la quota stipendio gia' fissata in fase 1 */}
      <ModalPortal>
      <AnimatePresence>
        {loanTarget && loanContractPreview && (
          <div className="modal-backdrop" onClick={() => setLoanTarget(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content" style={{ width: '480px' }} onClick={event => event.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Prestito per {loanTarget.playerName}</h3>
                <button className="btn-secondary" onClick={() => setLoanTarget(null)} aria-label="Chiudi prestito" style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center', flex: '0 0 auto' }}>
                  <X size={15} />
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Fase 2 di 2: il club ha accettato i termini del prestito. Ora il giocatore valuta la quota stipendio a tuo carico.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.28)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Clausola</span>
                    <strong>{PURCHASE_CLAUSE_LABELS[loanContractPreview.terms.purchaseClause]}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Indennizzo (una tantum)</span>
                    <strong style={{ color: loanContractPreview.impact.transferBudgetOk ? 'var(--color-pitch)' : 'var(--color-danger)' }}>
                      {formatCurrency(loanContractPreview.terms.loanFee ?? 0)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Quota stipendio a tuo carico</span>
                    <strong style={{ color: loanContractPreview.impact.wageBudgetOk ? 'var(--color-pitch)' : 'var(--color-danger)' }}>
                      {formatCurrency(loanContractPreview.annualShare)}/anno ({loanContractPreview.terms.wageSharePercent ?? 0}%)
                    </strong>
                  </div>
                  {loanContractPreview.terms.purchaseClause !== 'none' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Prezzo {loanContractPreview.terms.purchaseClause === 'option' ? 'diritto' : 'obbligo'}</span>
                      <strong>{formatCurrency(loanContractPreview.terms.purchaseFee ?? 0)}</strong>
                    </div>
                  )}
                  <p style={{ fontSize: '0.68rem', marginTop: '6px', color: loanContractPreview.evaluation.decision === 'accepted' ? 'var(--color-pitch)' : loanContractPreview.evaluation.decision.startsWith('blocked') ? 'var(--color-danger)' : 'var(--color-gold)' }}>
                    {loanContractPreview.evaluation.message}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                  <button disabled={isNegotiatingContract} onClick={() => setLoanTarget(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Annulla</button>
                  <button disabled={isNegotiatingContract} onClick={handleSendLoanAcceptance} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                    {isNegotiatingContract ? <><RotateCw size={14} className="ui-spin" /> Negoziazione...</> : <><FileSignature size={14} /> Concludi prestito</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </ModalPortal>

      {/* Mercato M2B: precontratto (stagione successiva). Non tocca rosa/budget ora: solo un impegno futuro. */}
      <ModalPortal>
      <AnimatePresence>
        {precontractTarget && precontractPreview && (
          <div className="modal-backdrop" onClick={() => setPrecontractTarget(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="modal-content" style={{ width: '480px' }} onClick={event => event.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Precontratto per {precontractTarget.playerName}</h3>
                <button className="btn-secondary" onClick={() => setPrecontractTarget(null)} aria-label="Chiudi precontratto" style={{ width: '34px', height: '34px', padding: 0, justifyContent: 'center', flex: '0 0 auto' }}>
                  <X size={15} />
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Accordo per la prossima stagione: nessun cartellino, nessuna modifica alla rosa ora. Il giocatore si trasferira a parametro zero a fine stagione, se l'accordo resta valido.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Stipendio settimanale (€)</label>
                    <input type="number" value={precontractWage} onChange={e => setPrecontractWage(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Durata (anni)</label>
                    <select value={precontractYears} onChange={e => setPrecontractYears(Number(e.target.value))} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                      {[2, 3, 4, 5].map(y => <option key={y} value={y}>{y} anni</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bonus firma (una tantum)</label>
                    <input type="number" value={precontractSigningBonus} onChange={e => setPrecontractSigningBonus(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Commissione agente</label>
                    <input type="number" value={precontractAgentFee} onChange={e => setPrecontractAgentFee(e.target.value)} style={{ width: '100%', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' }} />
                  </div>
                </div>
                <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.28)', padding: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Impegno futuro stipendio</span>
                    <strong>{formatCurrency(precontractPreview.annualSalary)}/anno dalla prossima stagione</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginTop: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Costi una tantum riservati</span>
                    <strong>{formatCurrency(precontractPreview.signingBonus + precontractPreview.agentFeeNum)}</strong>
                  </div>
                  <p style={{ fontSize: '0.68rem', marginTop: '6px', color: precontractPreview.evaluation.decision === 'accepted' ? 'var(--color-pitch)' : 'var(--color-gold)' }}>
                    {precontractPreview.evaluation.message}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
                  <button disabled={isProposingPrecontract} onClick={() => setPrecontractTarget(null)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Annulla</button>
                  <button disabled={isProposingPrecontract} onClick={handleSendPrecontractOffer} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                    {isProposingPrecontract ? <><RotateCw size={14} className="ui-spin" /> Trattativa...</> : <><FileSignature size={14} /> Proponi precontratto</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </ModalPortal>

      <PlayerProfileModal
        player={playerSheet?.player ?? null}
        mode={playerSheet?.mode ?? 'quick'}
        onClose={() => setPlayerSheet(null)}
        onModeChange={mode => setPlayerSheet(current => current ? { ...current, mode } : current)}
        players={allKnownPlayers}
        starters={starters}
        bench={bench}
        playerStats={playerStats}
        clubHistory={clubHistory}
        currentRound={currentRound}
        contextLabel="Mercato"
        clubProfile={clubProfile}
        futureContractAgreements={careerWorld.futureContractAgreements}
        activeNegotiation={playerSheet?.player
          ? marketTargets.find(t => ACTIVE_STATUSES.includes(t.status) && (t.id === playerSheet.player!.id || t.playerName === playerSheet.player!.name))
          : undefined}
        actions={(() => {
          const sheetPlayer = playerSheet?.player;
          if (!sheetPlayer) return undefined;
          const myActiveBuyBack = sheetPlayer.buyBackClauses?.find(c => c.status === 'active' && c.holderClubId === resolveClubId(teamName));
          if (!myActiveBuyBack) return undefined;
          return (
            <button className="btn-primary" onClick={() => { handleExerciseBuyBack(sheetPlayer, myActiveBuyBack); setPlayerSheet(null); }}>
              Esercita contro-riscatto ({formatCurrency(myActiveBuyBack.buyBackFee)})
            </button>
          );
        })()}
      />

      <ClubInfoModal
        club={selectedClubInfo}
        onClose={() => setSelectedClubInfo(null)}
        clubWorld={clubWorld}
        userTeamName={teamName}
      />
    </div>
  );
}
