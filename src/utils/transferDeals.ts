import {
  AgentArchetype,
  AntiRivalClauseMode,
  AntiRivalPenaltyPercent,
  AntiRivalTransferClause,
  BuyBackClause,
  BuyBackDuration,
  ClubAIState,
  CompetingClubBid,
  CompetingClubBidStatus,
  ClubHistoryState,
  ClubProfile,
  ClubWageBudgetState,
  ContractSquadRole,
  FirstRefusalClause,
  FirstRefusalTrigger,
  FirstRefusalTriggerStatus,
  FutureClauseChoice,
  FutureContractAgreement,
  IncomingTransferOffer,
  LoanSwapTerms,
  MedicalCheckResult,
  Negotiation,
  NegotiationStatus,
  ObligationCondition,
  Player,
  PlayerAgentProfile,
  PlayerContract,
  PlayerContractBonuses,
  PlayerLoanState,
  PlayerProjectRole,
  ProtectiveClauseChoice,
  ProtectiveClauseDuration,
  PurchaseClauseType,
  SellOnClause,
  SellOnPercentage,
  SellOnType,
  SwapCashDirection,
  TeamDNAState,
  TransferBaseType,
  TransferCompetitionState,
  TransferCompetitionStatus,
  TransferMedicalCheck,
  TransferOfferTerms,
  TransferPaymentInstallment,
  TransferWindowKind,
  TransferWindowState,
  TransferWindowStatus
} from '../types';
import { inferContractSquadRole, toAnnualSalary, toWeeklyWage, applySignedContract } from './playerContracts';
import { applyPlayerTransferToClubHistory } from './clubHistory';
import { getPlayerTransferWillingness, getEffectiveAvailability, PlayerWillingness } from './outgoingMarket';
import { hashRatio } from './marketIntelligence';

// ─── Mercato M1: modello unico dell'operazione (definitivo/rate, prestito secco/diritto/obbligo) ───
// Un solo modello modulare (TransferOfferTerms) per tutte le formule: le funzioni qui sotto
// leggono/validano/valutano i termini reali, mai una formula finta senza campi collegati.

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const MAX_INSTALLMENTS = 3;

export const TRANSFER_BASE_TYPE_LABELS: Record<TransferBaseType, string> = {
  permanent: 'Trasferimento definitivo',
  loan: 'Prestito'
};

export const PURCHASE_CLAUSE_LABELS: Record<PurchaseClauseType, string> = {
  none: 'Prestito secco',
  option: 'Diritto di riscatto',
  obligation: 'Obbligo di riscatto'
};

export const OBLIGATION_CONDITION_LABELS: Record<ObligationCondition, string> = {
  unconditional: 'Obbligo automatico',
  appearances: 'Dopo N presenze'
};

export const createEmptyTransferTerms = (baseType: TransferBaseType, currentSeason: string): TransferOfferTerms => ({
  baseType,
  purchaseClause: 'none',
  upfrontFee: 0,
  installments: [],
  loanFee: baseType === 'loan' ? 0 : undefined,
  loanEndSeason: baseType === 'loan' ? currentSeason : undefined,
  wageSharePercent: baseType === 'loan' ? 50 : undefined,
  purchaseFee: undefined,
  obligationCondition: undefined,
  requiredAppearances: undefined,
  futureFinancialCommitment: 0
});

// Somma delle rate residue (definitivo) o del prezzo dell'obbligo (mai il diritto, facoltativo per
// definizione: non e' un impegno finche' non viene esercitato).
export const calculateFutureFinancialCommitment = (terms: TransferOfferTerms): number => {
  if (terms.baseType === 'permanent') {
    return terms.installments.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0);
  }
  if (terms.purchaseClause === 'obligation') return terms.purchaseFee ?? 0;
  return 0;
};

// Costo che verrebbe sottratto oggi, alla firma: cartellino immediato (definitivo) o indennizzo +
// quota stipendio stimata fino a fine stagione (prestito). Mai le rate future, mai il riscatto.
export const calculateImmediateCost = (terms: TransferOfferTerms, playerWeeklyWage: number, roundsLeftInSeason: number): number => {
  if (terms.baseType === 'permanent') return terms.upfrontFee;
  const loanFee = terms.loanFee ?? 0;
  const estimatedWage = Math.round(playerWeeklyWage * (terms.wageSharePercent ?? 0) / 100 * Math.max(1, roundsLeftInSeason));
  return loanFee + estimatedWage;
};

export interface TransferTermsValidation {
  valid: boolean;
  reason?: string;
}

// Validazione reale sui campi effettivamente presenti: blocca solo per le ragioni elencate nella
// richiesta (prezzo obbligo assente, quota stipendio non definita, soglia presenze mancante,
// obbligo insostenibile rispetto al budget, costo immediato non sostenibile), mai in modo arbitrario.
// immediateCost e' opzionale (gia' calcolato dal chiamante con calculateImmediateCost): se assente,
// il controllo di sostenibilita' immediata viene semplicemente saltato (retrocompatibile).
export const validateTransferTerms = (
  terms: TransferOfferTerms,
  transferBudget: number,
  wageBudget: ClubWageBudgetState,
  immediateCost?: number
): TransferTermsValidation => {
  if (immediateCost !== undefined && immediateCost > transferBudget) {
    return { valid: false, reason: 'Costo immediato non sostenibile con il budget trasferimenti attuale.' };
  }

  if (terms.baseType === 'permanent') {
    if (!terms.upfrontFee || terms.upfrontFee <= 0) return { valid: false, reason: 'Inserisci un cartellino immediato valido.' };
    if (terms.installments.length > MAX_INSTALLMENTS) return { valid: false, reason: `Massimo ${MAX_INSTALLMENTS} rate.` };
    if (terms.installments.some(i => !i.amount || i.amount <= 0)) return { valid: false, reason: 'Ogni rata deve avere un importo valido.' };

    // Mercato M2A: clausola futura facoltativa, ma se scelta deve avere termini completi.
    if (terms.futureClauseChoice === 'buy_back') {
      if (!terms.futureClauseBuyBackFee || terms.futureClauseBuyBackFee <= 0) {
        return { valid: false, reason: 'Il prezzo del contro-riscatto e obbligatorio e non puo essere zero.' };
      }
      if (!terms.futureClauseBuyBackDuration) return { valid: false, reason: 'Seleziona la scadenza del contro-riscatto.' };
    }
    if ((terms.futureClauseChoice === 'sell_on_gross' || terms.futureClauseChoice === 'sell_on_capital_gain') && terms.futureClauseSellOnPercentage === undefined) {
      return { valid: false, reason: 'Seleziona la percentuale della clausola futura.' };
    }

    // Mercato M2C: clausola protettiva facoltativa (al massimo una, distinta da quella economica M2A).
    if (terms.protectiveClauseChoice === 'first_refusal' && !terms.protectiveClauseDuration) {
      return { valid: false, reason: 'Seleziona la scadenza del diritto di prelazione.' };
    }
    if (terms.protectiveClauseChoice === 'anti_rival') {
      if (!terms.antiRivalRestrictedClubIds || terms.antiRivalRestrictedClubIds.length === 0) {
        return { valid: false, reason: 'Seleziona almeno un club protetto per la clausola anti-rivale.' };
      }
      if (terms.antiRivalMode === 'penalty' && !terms.antiRivalPenaltyPercent) {
        return { valid: false, reason: 'Seleziona la percentuale della penale anti-rivale.' };
      }
      if (!terms.protectiveClauseDuration) {
        return { valid: false, reason: 'Seleziona la scadenza della clausola anti-rivale.' };
      }
    }

    return { valid: true };
  }

  if (terms.wageSharePercent === undefined) return { valid: false, reason: 'Definisci la quota di stipendio a carico del tuo club.' };
  if (terms.loanFee === undefined || terms.loanFee < 0) return { valid: false, reason: 'Inserisci un indennizzo prestito valido (anche 0).' };

  if (terms.purchaseClause === 'option' || terms.purchaseClause === 'obligation') {
    if (!terms.purchaseFee || terms.purchaseFee <= 0) {
      return { valid: false, reason: terms.purchaseClause === 'obligation' ? 'Il prezzo dell\'obbligo di riscatto e obbligatorio.' : 'Inserisci il prezzo del diritto di riscatto.' };
    }
  }

  if (terms.purchaseClause === 'obligation') {
    if (terms.obligationCondition === 'appearances' && (!terms.requiredAppearances || terms.requiredAppearances <= 0)) {
      return { valid: false, reason: 'Imposta una soglia presenze valida per l\'obbligo condizionato.' };
    }
    if (!terms.obligationCondition) return { valid: false, reason: 'Seleziona la condizione dell\'obbligo di riscatto.' };
    // Obbligo palesemente insostenibile: il prezzo futuro da solo supera il budget trasferimenti attuale
    // in modo irrealistico (nessun margine minimo di crescita futura del budget).
    if ((terms.purchaseFee ?? 0) > transferBudget * 3) {
      return { valid: false, reason: 'L\'obbligo futuro e palesemente insostenibile rispetto al budget trasferimenti attuale.' };
    }
  }

  const immediateWageImpact = Math.round((terms.loanFee ?? 0));
  if (immediateWageImpact > 0 && wageBudget.availableAnnualWages < 0) {
    return { valid: false, reason: 'Il margine stipendi e gia negativo: sistemalo prima di aggiungere un prestito.' };
  }

  return { valid: true };
};

// Quanto la proposta "vale" per il club cedente: usata solo per decidere se il club accetta,
// contropropone o rifiuta la fase 1 (mai per sottrarre budget, mai per completare l'operazione).
export const computeClubAppealFromTerms = (terms: TransferOfferTerms, playerValue: number): number => {
  if (terms.baseType === 'permanent') {
    const total = terms.upfrontFee + terms.installments.reduce((sum, i) => sum + i.amount, 0);
    const ratio = total / Math.max(1, playerValue);
    // Le rate pesano leggermente meno del contante immediato agli occhi del club cedente.
    const immediateRatio = terms.upfrontFee / Math.max(1, playerValue);
    return (ratio - 0.9) * 100 + (immediateRatio - ratio) * 15;
  }

  const loanValue = (terms.loanFee ?? 0) + playerValue * ((terms.wageSharePercent ?? 0) / 100) * 0.14;
  const baselineLoanValue = Math.max(1, playerValue * 0.1);
  const loanRatio = loanValue / baselineLoanValue;
  const clauseBonus =
    terms.purchaseClause === 'obligation'
      ? (terms.obligationCondition === 'unconditional' ? 24 : 15) + ((terms.purchaseFee ?? 0) / Math.max(1, playerValue)) * 18
      : terms.purchaseClause === 'option'
        ? 6 + ((terms.purchaseFee ?? 0) / Math.max(1, playerValue)) * 8
        : 0;
  return (loanRatio - 1) * 35 + clauseBonus;
};

export const buildLoanState = (
  terms: TransferOfferTerms,
  parentClubId: string,
  parentClubName: string,
  receivingClubId: string,
  season: string,
  originalWeeklyWage: number
): PlayerLoanState => ({
  parentClubId,
  parentClubName,
  receivingClubId,
  startSeason: season,
  endSeason: terms.loanEndSeason ?? season,
  wageSharePercent: terms.wageSharePercent ?? 0,
  originalWeeklyWage,
  purchaseClause: terms.purchaseClause,
  purchaseFee: terms.purchaseFee,
  obligationCondition: terms.obligationCondition,
  requiredAppearances: terms.requiredAppearances,
  obligationTriggered: terms.purchaseClause === 'obligation' && terms.obligationCondition === 'unconditional',
  processedSeasonEnd: false
});

// Contratto "leggero" per un giocatore in prestito: riflette solo la quota stipendio a carico del
// mio club (il resto resta a carico del club proprietario), mai un nuovo contratto pluriennale.
export const buildLoanContract = (player: Player, loanState: PlayerLoanState, season: string): PlayerContract => {
  const weeklyShare = Math.round(player.wage * loanState.wageSharePercent / 100);
  return {
    annualSalary: toAnnualSalary(weeklyShare),
    startSeason: season,
    endSeason: loanState.endSeason,
    durationYears: 1,
    squadRole: inferContractSquadRole(player),
    bonuses: {
      signingBonus: 0,
      agentFee: 0,
      appearanceBonus: 0,
      goalBonus: 0,
      cleanSheetBonus: 0,
      annualLoyaltyBonus: 0,
      teamAchievementBonus: 0
    },
    annualSalaryIncreasePercent: 0,
    status: 'active',
    earnedBonusesThisSeason: 0,
    projectedBonusReserve: 0,
    processedBonusMatchIds: []
  };
};

export const getLoanWeeklyWage = (player: Player, loanState: PlayerLoanState): number => (
  Math.round(player.wage * loanState.wageSharePercent / 100)
);

// ─── Fine prestito / obbligo: processati solo nel punto sicuro di fine stagione ───

export interface LoanSeasonEndOutcome {
  player: Player;
  kind: 'returned' | 'converted_permanent' | 'still_active';
  transferBudgetDelta: number; // negativo se sottrae (solo per obbligo attivato)
}

// Applica una sola volta (guardia su processedSeasonEnd) l'esito del prestito: obbligo attivato ->
// diventa un acquisto vero (contratto reale, costo sottratto una sola volta); nessuna clausola o
// diritto non esercitato -> torna al club proprietario; diritto esercitato viene gestito altrove
// (azione esplicita dell'utente, mai automatica).
export const resolveLoanAtSeasonEnd = (
  player: Player,
  club: ClubProfile,
  season: string
): LoanSeasonEndOutcome | null => {
  const loanState = player.loanState;
  if (!loanState || loanState.processedSeasonEnd) return null;

  const shouldConvert = loanState.purchaseClause === 'obligation' && (
    loanState.obligationCondition === 'unconditional' || loanState.obligationTriggered === true
  );

  if (shouldConvert) {
    const purchaseFee = loanState.purchaseFee ?? 0;
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
      }
    };
    return { player: converted, kind: 'converted_permanent', transferBudgetDelta: -purchaseFee };
  }

  // Nessun obbligo attivato: il prestito termina, il giocatore torna al club proprietario
  // (il diritto, se non esercitato esplicitamente durante la stagione, decade con il prestito).
  return { player, kind: 'returned', transferBudgetDelta: 0 };
};

// Verifica reale (solo presenze effettive gia' tracciate) se un obbligo condizionato va attivato:
// mai durante la partita, mai piu' di una volta.
export const checkLoanAppearanceObligation = (player: Player, seasonAppearances: number): Player => {
  const loanState = player.loanState;
  if (!loanState || loanState.obligationTriggered) return player;
  if (loanState.purchaseClause !== 'obligation' || loanState.obligationCondition !== 'appearances') return player;
  if (!loanState.requiredAppearances || seasonAppearances < loanState.requiredAppearances) return player;

  return { ...player, loanState: { ...loanState, obligationTriggered: true } };
};

// ─── Mercato M2A: clausole future reali (percentuale rivendita/plusvalenza, contro-riscatto) ───
// Solo per trasferimenti definitivi, una sola clausola futura per operazione. Le clausole viaggiano
// con il giocatore (sellOnClauses/buyBackClauses), mai duplicate su clubHistory.

export const SELL_ON_PERCENTAGE_OPTIONS: SellOnPercentage[] = [0, 5, 10, 15, 20, 25, 30];

export const FUTURE_CLAUSE_CHOICE_LABELS: Record<FutureClauseChoice, string> = {
  none: 'Nessuna',
  sell_on_gross: '% futura rivendita totale',
  sell_on_capital_gain: '% futura plusvalenza',
  buy_back: 'Contro-riscatto'
};

export const SELL_ON_TYPE_LABELS: Record<SellOnType, string> = {
  gross_sale: 'rivendita totale',
  capital_gain: 'plusvalenza'
};

export const BUYBACK_DURATION_LABELS: Record<BuyBackDuration, string> = {
  current_season: 'Fine stagione corrente',
  next_season: 'Fine prossima stagione',
  two_seasons: 'Due stagioni'
};

// Numero di transizioni di fine stagione (unico contatore stagionale reale gia' incrementato in modo
// affidabile: TeamDNAState.seasonsTracked) dopo le quali il contro-riscatto scade.
const BUYBACK_DURATION_TRANSITIONS: Record<BuyBackDuration, number> = {
  current_season: 1,
  next_season: 2,
  two_seasons: 3
};

// Etichetta leggibile ("2028/29"), solo informativa: la scadenza reale usa expiresAtSeasonsTracked.
const addSeasonsLabel = (season: string, offset: number): string => {
  const startYear = Number.parseInt(season.split('/')[0], 10) || 2026;
  const nextStart = startYear + offset;
  return `${nextStart}/${String((nextStart + 1) % 100).padStart(2, '0')}`;
};

export const createSellOnClause = (
  choice: 'sell_on_gross' | 'sell_on_capital_gain',
  percentage: number,
  originalPurchaseFee: number,
  beneficiaryClubId: string,
  beneficiaryClubName: string,
  createdSeason: string
): SellOnClause => ({
  id: `sellon_${beneficiaryClubId}_${Date.now()}`,
  type: choice === 'sell_on_gross' ? 'gross_sale' : 'capital_gain',
  percentage,
  originalPurchaseFee,
  beneficiaryClubId,
  beneficiaryClubName,
  createdSeason,
  status: 'active'
});

export const createBuyBackClause = (
  buyBackFee: number,
  duration: BuyBackDuration,
  holderClubId: string,
  holderClubName: string,
  playerId: string,
  createdSeason: string,
  currentSeasonsTracked: number
): BuyBackClause => ({
  id: `buyback_${holderClubId}_${playerId}_${Date.now()}`,
  holderClubId,
  holderClubName,
  playerId,
  buyBackFee,
  createdSeason,
  expirySeason: addSeasonsLabel(createdSeason, BUYBACK_DURATION_TRANSITIONS[duration]),
  expiresAtSeasonsTracked: currentSeasonsTracked + BUYBACK_DURATION_TRANSITIONS[duration],
  status: 'active'
});

// Payout reale: mai valore di mercato/overall, mai bonus non garantiti, mai negativo.
export const calculateSellOnPayout = (clause: SellOnClause, saleFee: number): number => {
  if (clause.type === 'gross_sale') return Math.round(saleFee * clause.percentage / 100);
  const capitalGain = Math.max(0, saleFee - clause.originalPurchaseFee);
  return Math.round(capitalGain * clause.percentage / 100);
};

export interface SellOnApplication {
  player: Player;
  payout: number;
  clause: SellOnClause;
  grossRevenue: number;
  netRevenue: number;
}

// Applica (una sola volta: la clausola triggerata viene marcata subito) l'eventuale sell-on dovuta
// a un terzo club quando rivendo un giocatore che la porta con se'. Mai due deduzioni sulla stessa
// vendita: prende solo la PRIMA clausola ancora attiva.
export const applySellOnOnSale = (player: Player, saleFee: number, transferId: string): SellOnApplication | null => {
  const clauses = player.sellOnClauses ?? [];
  const activeIndex = clauses.findIndex(c => c.status === 'active');
  if (activeIndex === -1) return null;

  const clause = clauses[activeIndex];
  const payout = calculateSellOnPayout(clause, saleFee);
  const updatedClause: SellOnClause = { ...clause, status: 'triggered', triggeredAtTransferId: transferId };
  const updatedClauses = clauses.map((c, i) => (i === activeIndex ? updatedClause : c));

  return {
    player: { ...player, sellOnClauses: updatedClauses },
    payout,
    clause: updatedClause,
    grossRevenue: saleFee,
    netRevenue: Math.max(0, saleFee - payout)
  };
};

// Scadenza reale delle clausole (buy-back): confronta expiresAtSeasonsTracked con il contatore
// stagionale del club titolare, gia' incrementato una sola volta a ogni vera transizione di stagione.
// Puro/immutabile: nessun effetto se non c'e' nulla da scadere (mai una rigenerazione inutile).
export const expireClausesForSeason = (players: Player[], seasonsTracked: number): Player[] => (
  players.map(player => {
    const buyBackClauses = player.buyBackClauses;
    if (!buyBackClauses || buyBackClauses.length === 0) return player;
    let changed = false;
    const nextClauses = buyBackClauses.map(clause => {
      if (clause.status === 'active' && seasonsTracked >= clause.expiresAtSeasonsTracked) {
        changed = true;
        return { ...clause, status: 'expired' as const };
      }
      return clause;
    });
    return changed ? { ...player, buyBackClauses: nextClauses } : player;
  })
);

// ─── Mercato M2B: scambi giocatori, svincolati, precontratti ───
// Estende il modello trattative esistente (Negotiation/TransferOfferTerms), non lo sostituisce.

const roleFamilyOf = (role: string) => (
  role === 'GK' ? 'GK' : /CB|LB|RB/.test(role) ? 'DF' : /DM|CM|AM/.test(role) ? 'MF' : 'FW'
);

export const SWAP_CASH_DIRECTION_LABELS: Record<SwapCashDirection, string> = {
  none: 'Nessun conguaglio',
  user_club: 'Pago io',
  other_club: 'Paga il club avversario'
};

// ─── Scambi: valutazione reale del club IA (bisogno di ruolo, qualita, stipendio, valore comparato) ───

export interface SwapAppealResult {
  score: number;
  reasons: string[];
}

export const evaluateSwapAppeal = (
  offeredPlayer: Player,
  targetPlayer: Player,
  cashAdjustment: number,
  cashPaidBy: SwapCashDirection,
  aiClub: ClubAIState
): SwapAppealResult => {
  const reasons: string[] = [];
  let score = 0;

  const family = roleFamilyOf(offeredPlayer.role);
  const sameFamily = aiClub.roster.filter(p => roleFamilyOf(p.role) === family);
  const bestInFamily = sameFamily.reduce((max, p) => Math.max(max, p.overall), 0);
  const familyFloor = family === 'GK' ? 2 : family === 'DF' ? 7 : family === 'MF' ? 7 : 5;

  if (sameFamily.length < familyFloor) { score += 18; reasons.push('Il club ha una reale carenza numerica in quel reparto.'); }
  if (offeredPlayer.overall > bestInFamily) { score += 14; reasons.push('Alzerebbe subito il livello del reparto.'); }
  else if (bestInFamily - offeredPlayer.overall <= 3) { score -= 6; reasons.push('Concorrenza gia forte in quel ruolo.'); }
  else { score -= 16; reasons.push('Il ruolo e gia coperto meglio in rosa.'); }

  score += clamp((offeredPlayer.overall - 68) * 1.4, -10, 22);
  if (offeredPlayer.age <= 24 && offeredPlayer.potential - offeredPlayer.overall >= 5) { score += 10; reasons.push('Giovane con margine di crescita reale.'); }
  else if (offeredPlayer.age >= 32) { score -= 8; reasons.push('Eta avanzata: investimento meno prioritario.'); }

  const annualWage = offeredPlayer.wage * 52;
  const wageShare = aiClub.budget > 0 ? annualWage / aiClub.budget : 999;
  if (wageShare > 0.35) { score -= 16; reasons.push('Stipendio pesante rispetto al budget del club.'); }

  // Confronto reale tra valore del pacchetto ricevuto (giocatore + conguaglio a proprio favore)
  // e valore del proprio giocatore ceduto: mai overall grezzo, sempre value gia' calcolato.
  const cashForClub = cashPaidBy === 'user_club' ? cashAdjustment : cashPaidBy === 'other_club' ? -cashAdjustment : 0;
  const packageDiff = (offeredPlayer.value + cashForClub) - targetPlayer.value;
  if (packageDiff >= 0) {
    score += Math.min(20, (packageDiff / Math.max(1, targetPlayer.value)) * 30);
    reasons.push('Il pacchetto complessivo pareggia o supera il valore del proprio giocatore.');
  } else {
    score -= Math.min(30, (Math.abs(packageDiff) / Math.max(1, targetPlayer.value)) * 40);
    reasons.push('Il pacchetto offerto vale meno del proprio giocatore.');
  }

  if (cashPaidBy === 'other_club' && cashAdjustment > aiClub.budget) {
    score -= 40;
    reasons.push('Il club non ha budget sufficiente per il conguaglio richiesto.');
  }

  const targetAvailability = getEffectiveAvailability(targetPlayer);
  if (targetAvailability === 'untouchable') { score -= 40; reasons.push('Il proprio giocatore richiesto e incedibile.'); }
  else if (targetAvailability === 'not_for_sale') { score -= 14; }

  score += clamp((aiClub.ambition - 70) * 0.25, -5, 6);

  return { score: Math.round(clamp(score, -60, 100)), reasons: reasons.slice(0, 4) };
};

// Controproposta del club: puo' chiedere solo un conguaglio diverso o un ALTRO mio giocatore reale
// gia' in rosa (mai un giocatore inventato). Sceglie il migliore per overall nello stesso reparto.
export const pickSwapCounterPlayer = (
  eligiblePlayers: Player[],
  targetRoleFamily: string,
  excludePlayerId: string
): Player | null => {
  const candidates = eligiblePlayers.filter(p => p.id !== excludePlayerId && roleFamilyOf(p.role) === targetRoleFamily);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => b.overall - a.overall)[0];
};

// Consenso del mio giocatore in uscita: riusa la stessa "voce del giocatore" gia' costruita per le
// cessioni (Mercato Cessioni C1), mai una nuova UI di negoziazione contrattuale con l'IA.
export const resolveSwapOutgoingConsent = (
  player: Player,
  projectRole: PlayerProjectRole,
  seed: string
): { accepts: boolean; willingness: PlayerWillingness } => {
  const willingness = getPlayerTransferWillingness(player, projectRole);
  if (willingness.level === 'wants_to_stay') return { accepts: false, willingness };
  if (willingness.level === 'wants_to_leave') return { accepts: true, willingness };
  const roll = hashRatio(seed);
  const acceptThreshold =
    willingness.level === 'interested' ? 0.25 :
    willingness.level === 'open_to_listen' ? 0.55 :
    0.82;
  return { accepts: roll > acceptThreshold, willingness };
};

export interface FinalizeSwapResult {
  myNewPlayer: Player;
  outgoingPlayerForOtherClub: Player;
  cashDelta: number; // da sommare al budget trasferimenti: positivo se incasso, negativo se pago
}

// Scambio atomico: entrambi i giocatori si muovono nello stesso passo, clubHistory aggiornata per
// entrambi, conguaglio applicato una sola volta. Il chiamante e' responsabile di rimuovere/inserire
// i giocatori negli array players/clubWorld e di applicare cashDelta al budget una sola volta.
export const finalizeSwapTransfer = (
  incomingRealPlayer: Player,
  outgoingMyPlayer: Player,
  sourceClub: ClubAIState,
  myClubId: string,
  myClubName: string,
  season: string,
  contractInput: { annualSalary: number; years: number; squadRole: ContractSquadRole; signingBonus: number; agentFee: number },
  myClub: ClubProfile,
  cashAdjustment: number,
  cashPaidBy: SwapCashDirection
): FinalizeSwapResult => {
  const myNewPlayer = applySignedContract(
    {
      ...incomingRealPlayer,
      id: `swap_in_${incomingRealPlayer.id}_${Date.now()}`,
      status: 'Disponibile' as const,
      clubHistory: applyPlayerTransferToClubHistory(incomingRealPlayer.clubHistory, {
        fromClubId: sourceClub.clubId,
        fromClubName: sourceClub.name,
        toClubId: myClubId,
        toClubName: myClubName,
        season,
        transferType: 'purchase',
        fee: 0
      })
    },
    myClub,
    contractInput,
    season,
    false
  );

  const outgoingPlayerForOtherClub: Player = {
    ...outgoingMyPlayer,
    id: `swap_out_${sourceClub.clubId}_${outgoingMyPlayer.id}_${Date.now()}`,
    status: 'Disponibile' as const,
    clubHistory: applyPlayerTransferToClubHistory(outgoingMyPlayer.clubHistory, {
      fromClubId: myClubId,
      fromClubName: myClubName,
      toClubId: sourceClub.clubId,
      toClubName: sourceClub.name,
      season,
      transferType: 'sale',
      fee: 0
    })
  };

  const cashDelta = cashPaidBy === 'user_club' ? -cashAdjustment : cashPaidBy === 'other_club' ? cashAdjustment : 0;

  return { myNewPlayer, outgoingPlayerForOtherClub, cashDelta };
};

// ─── Svincolati: nessun cartellino, solo il flusso contratto gia' esistente ───

export const isFreeAgent = (player: Player): boolean => player.squadStatus === 'released';

// ─── Precontratti: accordo reale per la stagione successiva, mai un ingresso immediato in rosa ───

export interface PrecontractEligibility {
  eligible: boolean;
  reason?: string;
}

// "Seconda meta di stagione": approssimata con la giornata corrente (unico segnale di calendario gia'
// disponibile qui), coerente sia per Serie A sia per Serie B senza bisogno del totale giornate reale.
const PRECONTRACT_MIN_ROUND = 20;

export const isPrecontractEligible = (
  player: Player,
  currentRound: number,
  existingAgreements: FutureContractAgreement[]
): PrecontractEligibility => {
  if (player.loanState) return { eligible: false, reason: 'Il giocatore e attualmente in prestito.' };
  if (player.contractYears > 1) return { eligible: false, reason: 'Il contratto attuale non e ancora in scadenza.' };
  if (currentRound < PRECONTRACT_MIN_ROUND) return { eligible: false, reason: 'I precontratti sono disponibili solo nella seconda parte della stagione.' };
  const hasActive = existingAgreements.some(a => a.playerId === player.id && a.status === 'active');
  if (hasActive) return { eligible: false, reason: 'Il giocatore ha gia un accordo futuro attivo.' };
  return { eligible: true };
};

export const createFutureContractAgreement = (
  player: Player,
  currentClubId: string,
  currentClubName: string,
  annualSalary: number,
  years: number,
  squadRole: ContractSquadRole,
  bonuses: PlayerContractBonuses,
  signingBonus: number,
  agentFee: number,
  agreedAtSeason: string,
  effectiveSeason: string
): FutureContractAgreement => ({
  id: `precontract_${player.id}_${Date.now()}`,
  playerId: player.id,
  playerName: player.name,
  currentClubId,
  currentClubName,
  agreedAtSeason,
  effectiveSeason,
  annualSalary,
  durationYears: years,
  squadRole,
  bonuses,
  signingBonus,
  agentFee,
  status: 'active'
});

export const normalizeFutureContractAgreements = (raw: unknown): FutureContractAgreement[] => {
  if (!Array.isArray(raw)) return [];
  const validStatuses = new Set(['active', 'completed', 'cancelled', 'failed']);
  return raw
    .map((item): FutureContractAgreement | null => {
      if (!item || typeof item !== 'object') return null;
      const a = item as Record<string, unknown>;
      if (typeof a.id !== 'string' || typeof a.playerId !== 'string' || typeof a.annualSalary !== 'number') return null;
      return {
        id: a.id,
        playerId: a.playerId,
        playerName: typeof a.playerName === 'string' ? a.playerName : 'Giocatore',
        currentClubId: typeof a.currentClubId === 'string' ? a.currentClubId : '',
        currentClubName: typeof a.currentClubName === 'string' ? a.currentClubName : '',
        agreedAtSeason: typeof a.agreedAtSeason === 'string' ? a.agreedAtSeason : '',
        effectiveSeason: typeof a.effectiveSeason === 'string' ? a.effectiveSeason : '',
        annualSalary: a.annualSalary,
        durationYears: typeof a.durationYears === 'number' ? a.durationYears : 3,
        squadRole: (['star', 'important', 'rotation', 'prospect', 'backup'].includes(a.squadRole as string) ? a.squadRole : 'rotation') as ContractSquadRole,
        bonuses: (a.bonuses && typeof a.bonuses === 'object') ? a.bonuses as PlayerContractBonuses : {
          signingBonus: 0, agentFee: 0, appearanceBonus: 0, goalBonus: 0, cleanSheetBonus: 0, annualLoyaltyBonus: 0, teamAchievementBonus: 0
        },
        signingBonus: typeof a.signingBonus === 'number' ? a.signingBonus : 0,
        agentFee: typeof a.agentFee === 'number' ? a.agentFee : 0,
        status: validStatuses.has(a.status as string) ? a.status as FutureContractAgreement['status'] : 'active',
        processedAtSeason: typeof a.processedAtSeason === 'string' ? a.processedAtSeason : undefined
      };
    })
    .filter((a): a is FutureContractAgreement => a !== null)
    .slice(-40);
};

export interface FutureContractProcessResult {
  agreements: FutureContractAgreement[];
  newPlayers: Player[];
  completedPlayerIdsBySourceClub: { sourceClubId: string; playerId: string }[];
  logs: string[];
}

// Punto sicuro di fine stagione (gia' usato per prestiti/obblighi/clausole): trasferisce a parametro
// zero solo gli accordi ancora 'active', una sola volta (guardia sullo status stesso: da questo
// momento in poi non e' piu 'active', quindi non verra' mai riprocessato).
export const processFutureContractAgreementsAtSeasonEnd = (
  agreements: FutureContractAgreement[],
  clubWorld: ClubAIState[],
  myClub: ClubProfile,
  season: string,
  currentRound: number
): FutureContractProcessResult => {
  const newPlayers: Player[] = [];
  const completedPlayerIdsBySourceClub: { sourceClubId: string; playerId: string }[] = [];
  const logs: string[] = [];

  const updatedAgreements = agreements.map(agreement => {
    if (agreement.status !== 'active') return agreement;

    const sourceClub = clubWorld.find(club => club.roster.some(p => p.id === agreement.playerId));
    if (!sourceClub) {
      logs.push(`${agreement.playerName}: precontratto non piu eseguibile (giocatore non trovato nel club previsto). Accordo annullato.`);
      return { ...agreement, status: 'failed' as const, processedAtSeason: season };
    }
    const realPlayer = sourceClub.roster.find(p => p.id === agreement.playerId)!;

    // Mercato M3: precontratto -> visita solo ora, alla vera transizione stagionale, prima
    // dell'ingresso in rosa. Nessun costo da annullare: il precontratto e' a parametro zero.
    const medicalCheck = runMedicalCheck(agreement.id, realPlayer, currentRound);
    if (medicalCheck.status === 'failed') {
      logs.push(`${agreement.playerName}: precontratto annullato dopo le visite mediche (${medicalCheck.riskSummary ?? 'idoneita non superata'}).`);
      return { ...agreement, status: 'failed' as const, processedAtSeason: season };
    }

    const signedPlayer = applySignedContract(
      {
        ...realPlayer,
        id: `precontract_signed_${agreement.id}`,
        status: 'Disponibile' as const,
        clubHistory: applyPlayerTransferToClubHistory(realPlayer.clubHistory, {
          fromClubId: sourceClub.clubId,
          fromClubName: sourceClub.name,
          toClubId: myClub.id,
          toClubName: myClub.name,
          season,
          transferType: 'purchase',
          fee: 0
        })
      },
      myClub,
      { annualSalary: agreement.annualSalary, years: agreement.durationYears, squadRole: agreement.squadRole, signingBonus: agreement.signingBonus, agentFee: agreement.agentFee },
      season,
      false
    );
    // I bonus dettagliati erano gia' stati concordati nel precontratto: li ripristino qui invece di
    // lasciare quelli ricalcolati da zero da applySignedContract.
    const finalPlayer: Player = signedPlayer.contract
      ? { ...signedPlayer, contract: { ...signedPlayer.contract, bonuses: agreement.bonuses } }
      : signedPlayer;

    newPlayers.push(finalPlayer);
    completedPlayerIdsBySourceClub.push({ sourceClubId: sourceClub.clubId, playerId: agreement.playerId });
    logs.push(`${agreement.playerName} si trasferisce a parametro zero dal ${sourceClub.name}, come da precontratto firmato in ${agreement.agreedAtSeason}.`);
    return { ...agreement, status: 'completed' as const, processedAtSeason: season };
  });

  return { agreements: updatedAgreements, newPlayers, completedPlayerIdsBySourceClub, logs };
};

// ─── Mercato M2C: prelazione, clausole anti-rivali, scambio di prestiti ───
// Estende i modelli M1/M2A/M2B gia' esistenti, mai una seconda implementazione parallela.

export const PROTECTIVE_CLAUSE_CHOICE_LABELS: Record<ProtectiveClauseChoice, string> = {
  none: 'Nessuna protezione',
  first_refusal: 'Diritto di prelazione',
  anti_rival: 'Clausola anti-rivale'
};

export const ANTI_RIVAL_MODE_LABELS: Record<AntiRivalClauseMode, string> = {
  block: 'Divieto vendita',
  penalty: 'Vendita con penale'
};

// Le durate "protettive" (prelazione/anti-rivale) usano la stessa scala del contro-riscatto
// (M2A): stesso schema di scadenza reale gia' validato, nessuna nuova convenzione temporale.
const PROTECTIVE_DURATION_TRANSITIONS: Record<ProtectiveClauseDuration, number> = BUYBACK_DURATION_TRANSITIONS;

// ─── 1. Diritto di prelazione ───

// Rivali realmente riconosciuti dal sistema esistente (mai una lista inventata).
export const getRecognizedRivalClubNames = (clubHistory: ClubHistoryState, minHeat = 40): string[] => (
  clubHistory.rivalries.filter(r => r.heat >= minHeat).map(r => r.opponent)
);

export const createFirstRefusalClause = (
  playerId: string,
  duration: ProtectiveClauseDuration,
  holderClubId: string,
  holderClubName: string,
  createdSeason: string,
  currentSeasonsTracked: number
): FirstRefusalClause => ({
  id: `firstrefusal_${holderClubId}_${playerId}_${Date.now()}`,
  playerId,
  holderClubId,
  holderClubName,
  createdSeason,
  expirySeason: addSeasonsLabel(createdSeason, PROTECTIVE_DURATION_TRANSITIONS[duration]),
  expiresAtSeasonsTracked: currentSeasonsTracked + PROTECTIVE_DURATION_TRANSITIONS[duration],
  status: 'active',
  processedTriggerIds: []
});

export const createFirstRefusalTrigger = (
  clause: FirstRefusalClause,
  currentOwnerClubId: string,
  proposedBuyerClubId: string,
  sourceOfferId: string,
  matchedTermsSnapshot: TransferOfferTerms,
  createdRound: number
): FirstRefusalTrigger => ({
  id: `frtrigger_${clause.id}_${Date.now()}`,
  clauseId: clause.id,
  playerId: clause.playerId,
  currentOwnerClubId,
  proposedBuyerClubId,
  sourceOfferId,
  matchedTermsSnapshot,
  createdRound,
  deadlineRound: createdRound + 2,
  status: 'pending'
});

export interface FirstRefusalAIDecision {
  exercise: boolean;
  reasons: string[];
}

// Valutazione deterministica: budget reale, bisogno di ruolo, qualita. Esercita solo se il club
// puo' davvero sostenere l'operazione (mai un acquisto IA finto senza budget).
export const evaluateFirstRefusalAIDecision = (
  holderClub: ClubAIState,
  player: Player,
  matchedTerms: TransferOfferTerms
): FirstRefusalAIDecision => {
  const reasons: string[] = [];
  const price = matchedTerms.upfrontFee;
  if (price > holderClub.budget) {
    reasons.push('Budget trasferimenti insufficiente per eguagliare l\'offerta.');
    return { exercise: false, reasons };
  }

  const family = roleFamilyOf(player.role);
  const sameFamily = holderClub.roster.filter(p => roleFamilyOf(p.role) === family);
  const bestInFamily = sameFamily.reduce((max, p) => Math.max(max, p.overall), 0);
  const familyFloor = family === 'GK' ? 2 : family === 'DF' ? 7 : family === 'MF' ? 7 : 5;

  let score = 0;
  if (sameFamily.length < familyFloor) { score += 20; reasons.push('Reparto con reale carenza numerica.'); }
  if (player.overall > bestInFamily) { score += 18; reasons.push('Livello superiore al meglio gia in rosa.'); }
  else if (bestInFamily - player.overall > 4) { score -= 14; }

  const wageShare = holderClub.budget > 0 ? (player.wage * 52) / holderClub.budget : 999;
  if (wageShare > 0.35) { score -= 20; reasons.push('Stipendio pesante rispetto al budget.'); }

  const priceShare = price / Math.max(1, holderClub.budget);
  if (priceShare > 0.75) { score -= 15; reasons.push('Prezzo troppo vicino al budget totale disponibile.'); }

  score += clamp((holderClub.ambition - 70) * 0.3, -6, 8);

  const exercise = score >= 15;
  if (exercise) reasons.push('Il club decide di eguagliare l\'offerta.');
  else if (reasons.length === 0) reasons.push('Il club rinuncia: nessun bisogno reale sufficiente.');
  return { exercise, reasons };
};

export const normalizeFirstRefusalTriggers = (raw: unknown): FirstRefusalTrigger[] => {
  if (!Array.isArray(raw)) return [];
  const validStatuses = new Set(['pending', 'holder_exercising', 'holder_waived', 'holder_failed_contract', 'superseded', 'expired']);
  return raw
    .map((item): FirstRefusalTrigger | null => {
      if (!item || typeof item !== 'object') return null;
      const t = item as Record<string, unknown>;
      if (typeof t.id !== 'string' || typeof t.clauseId !== 'string' || typeof t.playerId !== 'string') return null;
      if (!t.matchedTermsSnapshot || typeof t.matchedTermsSnapshot !== 'object') return null;
      return {
        id: t.id,
        clauseId: t.clauseId,
        playerId: t.playerId,
        currentOwnerClubId: typeof t.currentOwnerClubId === 'string' ? t.currentOwnerClubId : '',
        proposedBuyerClubId: typeof t.proposedBuyerClubId === 'string' ? t.proposedBuyerClubId : '',
        sourceOfferId: typeof t.sourceOfferId === 'string' ? t.sourceOfferId : '',
        matchedTermsSnapshot: t.matchedTermsSnapshot as TransferOfferTerms,
        createdRound: typeof t.createdRound === 'number' ? t.createdRound : 1,
        deadlineRound: typeof t.deadlineRound === 'number' ? t.deadlineRound : 1,
        status: validStatuses.has(t.status as string) ? t.status as FirstRefusalTriggerStatus : 'expired'
      };
    })
    .filter((t): t is FirstRefusalTrigger => t !== null)
    .slice(-30);
};

// ─── 2. Clausole anti-rivali ───

export const createAntiRivalClause = (
  playerId: string,
  mode: AntiRivalClauseMode,
  restrictedClubIds: string[],
  restrictedClubNames: string[],
  penaltyPercent: AntiRivalPenaltyPercent | undefined,
  duration: ProtectiveClauseDuration,
  beneficiaryClubId: string,
  beneficiaryClubName: string,
  createdSeason: string,
  currentSeasonsTracked: number
): AntiRivalTransferClause => ({
  id: `antirival_${beneficiaryClubId}_${playerId}_${Date.now()}`,
  playerId,
  beneficiaryClubId,
  beneficiaryClubName,
  restrictedClubIds: restrictedClubIds.slice(0, 3),
  restrictedClubNames: restrictedClubNames.slice(0, 3),
  mode,
  penaltyPercent: mode === 'penalty' ? penaltyPercent : undefined,
  createdSeason,
  expirySeason: addSeasonsLabel(createdSeason, PROTECTIVE_DURATION_TRANSITIONS[duration]),
  expiresAtSeasonsTracked: currentSeasonsTracked + PROTECTIVE_DURATION_TRANSITIONS[duration],
  status: 'active',
  processedTransferIds: []
});

export interface AntiRivalCheckResult {
  blocked: boolean;
  clause?: AntiRivalTransferClause;
  reason?: string;
  penaltyPercent?: number;
}

// Verifica reale: solo clausole attive che restringono esplicitamente il club coinvolto in QUESTA
// operazione (mai un blocco arbitrario, mai una clausola scaduta mostrata come attiva).
export const checkAntiRivalRestriction = (
  player: Player,
  counterpartClubId: string,
  counterpartClubName: string
): AntiRivalCheckResult => {
  const activeClauses = (player.antiRivalClauses ?? []).filter(c => c.status === 'active' && c.restrictedClubIds.includes(counterpartClubId));
  const blocking = activeClauses.find(c => c.mode === 'block');
  if (blocking) {
    return { blocked: true, clause: blocking, reason: `Cessione vietata a ${counterpartClubName} fino al termine della clausola (${blocking.expirySeason}).` };
  }
  const penalty = activeClauses.find(c => c.mode === 'penalty');
  if (penalty) {
    return { blocked: false, clause: penalty, penaltyPercent: penalty.penaltyPercent };
  }
  return { blocked: false };
};

export interface AntiRivalPenaltyApplication {
  player: Player;
  penalty: number;
  clause: AntiRivalTransferClause;
}

// Penale sempre sul ricavo LORDO (mai a cascata su un sell-on gia' dedotto), processata una sola
// volta: la clausola viene marcata subito con l'id del trasferimento.
export const applyAntiRivalPenaltyOnSale = (
  player: Player,
  grossRevenue: number,
  counterpartClubId: string,
  transferId: string
): AntiRivalPenaltyApplication | null => {
  const clauses = player.antiRivalClauses ?? [];
  const index = clauses.findIndex(c => (
    c.status === 'active' && c.mode === 'penalty' && c.restrictedClubIds.includes(counterpartClubId) && !c.processedTransferIds.includes(transferId)
  ));
  if (index === -1) return null;
  const clause = clauses[index];
  const penalty = Math.round(grossRevenue * (clause.penaltyPercent ?? 0) / 100);
  const updatedClause: AntiRivalTransferClause = { ...clause, processedTransferIds: [transferId, ...clause.processedTransferIds].slice(0, 10) };
  const updatedClauses = clauses.map((c, i) => (i === index ? updatedClause : c));
  return { player: { ...player, antiRivalClauses: updatedClauses }, penalty, clause: updatedClause };
};

// Scadenza reale di prelazione/anti-rivale, stesso punto sicuro di fine stagione delle altre clausole.
export const expireProtectiveClausesForSeason = (players: Player[], seasonsTracked: number): Player[] => (
  players.map(player => {
    const firstRefusalClauses = player.firstRefusalClauses;
    const antiRivalClauses = player.antiRivalClauses;
    if ((!firstRefusalClauses || firstRefusalClauses.length === 0) && (!antiRivalClauses || antiRivalClauses.length === 0)) return player;
    let changed = false;
    const nextFirstRefusal = firstRefusalClauses?.map(c => {
      if (c.status === 'active' && seasonsTracked >= c.expiresAtSeasonsTracked) { changed = true; return { ...c, status: 'expired' as const }; }
      return c;
    });
    const nextAntiRival = antiRivalClauses?.map(c => {
      if (c.status === 'active' && seasonsTracked >= c.expiresAtSeasonsTracked) { changed = true; return { ...c, status: 'expired' as const }; }
      return c;
    });
    return changed ? { ...player, firstRefusalClauses: nextFirstRefusal, antiRivalClauses: nextAntiRival } : player;
  })
);

// ─── 3. Scambio di prestiti ───

export const evaluateLoanSwapAppeal = (
  offeredPlayer: Player,
  aiClubWageSharePercent: number,
  aiClub: ClubAIState
): { score: number; reasons: string[] } => {
  const reasons: string[] = [];
  let score = 0;

  const family = roleFamilyOf(offeredPlayer.role);
  const sameFamily = aiClub.roster.filter(p => roleFamilyOf(p.role) === family);
  const bestInFamily = sameFamily.reduce((max, p) => Math.max(max, p.overall), 0);
  const familyFloor = family === 'GK' ? 2 : family === 'DF' ? 7 : family === 'MF' ? 7 : 5;

  if (sameFamily.length < familyFloor) { score += 20; reasons.push('Il club ha una reale carenza numerica in quel reparto.'); }
  if (offeredPlayer.overall > bestInFamily) { score += 14; reasons.push('Rinforzerebbe subito il reparto in prestito.'); }
  else if (bestInFamily - offeredPlayer.overall > 5) { score -= 12; reasons.push('Il ruolo e gia coperto meglio in rosa.'); }

  const weeklyShare = Math.round(offeredPlayer.wage * aiClubWageSharePercent / 100);
  const wageShare = aiClub.budget > 0 ? (weeklyShare * 52) / aiClub.budget : 999;
  if (wageShare > 0.15) { score -= 14; reasons.push('Quota stipendio pesante per un prestito.'); }
  else { score += 6; }

  score += clamp((aiClub.ambition - 70) * 0.25, -5, 6);
  return { score: Math.round(clamp(score, -60, 100)), reasons: reasons.slice(0, 4) };
};

export const createLoanSwapTerms = (
  userOutgoingPlayerId: string,
  userOutgoingPlayerName: string,
  otherClubOutgoingPlayerId: string,
  otherClubId: string,
  otherClubName: string,
  userPaysIncomingWageSharePercent: 0 | 25 | 50 | 75 | 100,
  otherClubPaysIncomingWageSharePercent: 0 | 25 | 50 | 75 | 100,
  season: string
): LoanSwapTerms => ({
  id: `loanswap_${userOutgoingPlayerId}_${otherClubOutgoingPlayerId}_${Date.now()}`,
  userOutgoingPlayerId,
  userOutgoingPlayerName,
  otherClubOutgoingPlayerId,
  otherClubId,
  otherClubName,
  userPaysIncomingWageSharePercent,
  otherClubPaysIncomingWageSharePercent,
  startSeason: season,
  endSeason: season,
  status: 'club_negotiation'
});

export interface FinalizeLoanSwapResult {
  incomingPlayerForMe: Player;
  outgoingPlayerForOtherClub: Player;
}

// Scambio di prestiti atomico: mai cartellino/conguaglio/rate/diritto/obbligo, entrambi i loanState
// condividono lo stesso loanSwapId (mai una cessione/acquisto permanente in clubHistory).
export const finalizeLoanSwapTransfer = (
  incomingRealPlayer: Player,
  outgoingMyPlayer: Player,
  terms: LoanSwapTerms,
  myClubId: string,
  myClubName: string,
  season: string
): FinalizeLoanSwapResult => {
  const incomingLoanState: PlayerLoanState = {
    parentClubId: terms.otherClubId,
    parentClubName: terms.otherClubName,
    receivingClubId: myClubId,
    startSeason: season,
    endSeason: terms.endSeason,
    wageSharePercent: terms.userPaysIncomingWageSharePercent,
    originalWeeklyWage: incomingRealPlayer.wage,
    purchaseClause: 'none',
    processedSeasonEnd: false,
    loanSwapId: terms.id
  };
  const outgoingLoanState: PlayerLoanState = {
    parentClubId: myClubId,
    parentClubName: myClubName,
    receivingClubId: terms.otherClubId,
    startSeason: season,
    endSeason: terms.endSeason,
    wageSharePercent: terms.otherClubPaysIncomingWageSharePercent,
    originalWeeklyWage: outgoingMyPlayer.wage,
    purchaseClause: 'none',
    processedSeasonEnd: false,
    loanSwapId: terms.id
  };

  const incomingPlayerForMe: Player = {
    ...incomingRealPlayer,
    id: `loanswap_in_${incomingRealPlayer.id}_${Date.now()}`,
    wage: getLoanWeeklyWage(incomingRealPlayer, incomingLoanState),
    contractYears: 1,
    loanState: incomingLoanState,
    contract: buildLoanContract(incomingRealPlayer, incomingLoanState, season),
    status: 'Disponibile' as const
  };
  // A differenza di un trasferimento permanente, il prestito e' un round-trip nella stessa stagione:
  // l'id originale va preservato (non rigenerato) cosi' il giocatore rientra come lo stesso record
  // (career memory, personalita', storico) quando returnLoanSwapPlayersHome lo riporta a casa.
  const outgoingPlayerForOtherClub: Player = {
    ...outgoingMyPlayer,
    wage: getLoanWeeklyWage(outgoingMyPlayer, outgoingLoanState),
    contractYears: 1,
    loanState: outgoingLoanState,
    contract: buildLoanContract(outgoingMyPlayer, outgoingLoanState, season),
    status: 'Disponibile' as const
  };

  return { incomingPlayerForMe, outgoingPlayerForOtherClub };
};

export interface LoanSwapReturnResult {
  clubWorld: ClubAIState[];
  returningPlayers: Player[];
}

// Fine stagione: riporta a casa i MIEI giocatori attualmente in prestito presso un altro club come
// meta' di uno scambio di prestiti. L'altra meta' (in players, gia' mia rosa) e' gia' gestita dal
// loop prestiti esistente in MatchCenter tramite resolveLoanAtSeasonEnd (purchaseClause 'none' ->
// sempre 'returned'): qui serve solo il percorso simmetrico mancante.
export const returnLoanSwapPlayersHome = (clubWorld: ClubAIState[], myClubId: string): LoanSwapReturnResult => {
  const returningPlayers: Player[] = [];
  const nextWorld = clubWorld.map(club => {
    const staying: Player[] = [];
    let changed = false;
    club.roster.forEach(player => {
      if (player.loanState?.loanSwapId && player.loanState.parentClubId === myClubId) {
        changed = true;
        const annualSalary = toAnnualSalary(player.loanState.originalWeeklyWage || player.wage);
        returningPlayers.push({ ...player, wage: toWeeklyWage(annualSalary), contractYears: 3, loanState: undefined });
      } else {
        staying.push(player);
      }
    });
    return changed ? { ...club, roster: staying } : club;
  });
  return { clubWorld: nextWorld, returningPlayers };
};

// ─── Mercato M3: finestra di mercato, visite mediche, registrazione ───
// Estende il flusso M1/M2A/M2B/M2C gia' esistente con una pipeline reale tra accordo e ingresso in
// rosa; nessuna riscrittura delle formule gia' funzionanti.

const TOTAL_SEASON_ROUNDS = 38;
const WINDOW_CLOSING_SOON_ROUNDS = 2;

// Finestre deterministiche per stagione, ancorate alle giornate (nessuna data reale nel progetto):
// estiva a inizio stagione, invernale a meta' (coerente con COMPETITION_DEFINITIONS: 38 giornate).
export const createSeasonTransferWindows = (season: string): TransferWindowState[] => ([
  { id: `window_summer_${season}`, season, kind: 'summer', opensAtRound: 1, closesAtRound: 5, status: 'open' },
  { id: `window_winter_${season}`, season, kind: 'winter', opensAtRound: 19, closesAtRound: 23, status: 'upcoming' }
]);

const computeWindowStatus = (window: TransferWindowState, currentRound: number): TransferWindowStatus => {
  if (currentRound < window.opensAtRound) return 'upcoming';
  if (currentRound > window.closesAtRound) return 'closed';
  if (window.closesAtRound - currentRound <= WINDOW_CLOSING_SOON_ROUNDS) return 'closing_soon';
  return 'open';
};

// Aggiorna lo stato persistito una volta per giornata (stesso schema del tick C1): mai durante il render.
export const refreshTransferWindowsStatus = (windows: TransferWindowState[], currentRound: number): TransferWindowState[] => (
  windows.map(w => {
    const status = computeWindowStatus(w, currentRound);
    return status === w.status ? w : { ...w, status };
  })
);

export const getActiveTransferWindow = (windows: TransferWindowState[]): TransferWindowState | undefined => (
  windows.find(w => w.status === 'open' || w.status === 'closing_soon')
);

export const isTransferWindowOpen = (windows: TransferWindowState[]): boolean => !!getActiveTransferWindow(windows);

// Vecchi salvataggi: finestre valide senza rompere trattative attive (mai finestre diverse ad ogni
// carriera, sempre le stesse per stagione).
export const normalizeTransferWindows = (raw: unknown, season: string): TransferWindowState[] => {
  if (!Array.isArray(raw) || raw.length === 0) return createSeasonTransferWindows(season);
  const validKinds = new Set(['summer', 'winter']);
  const validStatuses = new Set(['upcoming', 'open', 'closing_soon', 'closed']);
  const normalized = raw
    .map((item): TransferWindowState | null => {
      if (!item || typeof item !== 'object') return null;
      const w = item as Record<string, unknown>;
      if (typeof w.id !== 'string' || typeof w.season !== 'string' || !validKinds.has(w.kind as string)) return null;
      if (typeof w.opensAtRound !== 'number' || typeof w.closesAtRound !== 'number') return null;
      return {
        id: w.id,
        season: w.season,
        kind: w.kind as TransferWindowKind,
        opensAtRound: w.opensAtRound,
        closesAtRound: w.closesAtRound,
        status: validStatuses.has(w.status as string) ? w.status as TransferWindowStatus : 'upcoming'
      };
    })
    .filter((w): w is TransferWindowState => w !== null);
  return normalized.length > 0 ? normalized : createSeasonTransferWindows(season);
};

const buildMedicalCheck = (
  transferId: string,
  playerId: string,
  currentRound: number,
  status: MedicalCheckResult,
  riskSummary: string | undefined,
  reasons: string[]
): TransferMedicalCheck => ({
  transferId,
  playerId,
  status,
  startedRound: currentRound,
  resolvedRound: currentRound,
  riskSummary,
  reasons,
  canProceed: status !== 'failed',
  processed: true
});

// Visita medica deterministica (mai Math.random): stessa trattativa, stesso esito ad ogni F5. Usa
// solo dati fisici gia' presenti sul giocatore (injuryStatus/injuryHistory/physicalProfile), nessuna
// diagnosi inventata. FALLITA solo con segnali forti e reali; AVVERTENZA solo con segnali fisici
// reali; mai un ostacolo casuale o punitivo per un giocatore sano.
export const runMedicalCheck = (transferId: string, player: Player, currentRound: number): TransferMedicalCheck => {
  const injuryStatus = player.injuryStatus;
  const profile = player.physicalProfile;
  const reasons: string[] = [];

  const severeCurrentInjury = injuryStatus?.status === 'injured'
    && (injuryStatus.currentInjury?.severity === 'major' || injuryStatus.currentInjury?.severity === 'severe');
  if (severeCurrentInjury) {
    return buildMedicalCheck(transferId, player.id, currentRound, 'failed',
      'La visita ha evidenziato una condizione incompatibile con la registrazione attuale.',
      ['Infortunio grave in corso.']);
  }
  const notReadyForReturn = injuryStatus?.status === 'return_to_training' && injuryStatus.returnReadiness < 35;
  if (notReadyForReturn) {
    return buildMedicalCheck(transferId, player.id, currentRound, 'failed',
      'Il giocatore non e\' pronto per l\'idoneita\' immediata.',
      ['Rientro dall\'infortunio non ancora completato.']);
  }
  const chronicRiskCritical = (profile?.chronicRisk ?? 0) >= 88 && (injuryStatus?.reinjuryRisk ?? 0) >= 75;
  if (chronicRiskCritical) {
    return buildMedicalCheck(transferId, player.id, currentRound, 'failed',
      'La visita ha evidenziato una condizione incompatibile con la registrazione attuale.',
      ['Rischio cronico di ricaduta molto elevato.']);
  }

  if (injuryStatus?.status === 'injured' || injuryStatus?.status === 'rehab') {
    reasons.push('Il giocatore e\' attualmente fermo per infortunio.');
  }
  if (injuryStatus?.status === 'managed_return') {
    reasons.push('Il giocatore e\' in rientro controllato dopo un infortunio.');
  }
  if ((injuryStatus?.reinjuryRisk ?? 0) >= 55) {
    reasons.push('Rischio di ricaduta superiore alla media.');
  }
  if ((profile?.chronicRisk ?? 0) >= 75) {
    reasons.push('Storico fisico con rischio cronico elevato.');
  }
  if (reasons.length > 0) {
    return buildMedicalCheck(transferId, player.id, currentRound, 'warning', 'Rischio fisico superiore alle attese.', reasons);
  }

  return buildMedicalCheck(transferId, player.id, currentRound, 'passed', undefined, []);
};

// Scambio (permanente o di prestiti): entrambi i giocatori devono superare la visita. Vince il
// peggiore dei due esiti (failed > warning > passed); se uno fallisce l'intero scambio fallisce,
// nessun giocatore si muove (finalizeSwap/finalizeLoanSwap semplicemente non vengono mai chiamate).
export const combineMedicalChecks = (a: TransferMedicalCheck, b: TransferMedicalCheck): TransferMedicalCheck => {
  const rank: Record<MedicalCheckResult, number> = { failed: 3, warning: 2, pending: 1, passed: 0 };
  const worse = rank[a.status] >= rank[b.status] ? a : b;
  return { ...worse, reasons: [...a.reasons, ...b.reasons], canProceed: a.status !== 'failed' && b.status !== 'failed' };
};

export interface RegistrationReadinessInput {
  windowOpen: boolean;
  transferBudgetOk: boolean;
  wageBudgetOk: boolean;
  playerStillAvailable: boolean;
  incompatibleActiveState: boolean;
}

export interface RegistrationReadinessResult {
  ok: boolean;
  reasons: string[];
}

// Solo controlli reali gia' modellati nel progetto (finestra, budget, disponibilita del giocatore,
// stato incompatibile): mai visti/tasse/regolamenti UEFA inventati.
export const evaluateRegistrationReadiness = (input: RegistrationReadinessInput): RegistrationReadinessResult => {
  const reasons: string[] = [];
  if (!input.playerStillAvailable) reasons.push('Il giocatore non e\' piu\' disponibile per questa operazione.');
  if (input.incompatibleActiveState) reasons.push('Il giocatore e\' coinvolto in un\'altra operazione incompatibile.');
  if (!input.windowOpen) reasons.push('La finestra di mercato e\' chiusa.');
  if (!input.transferBudgetOk) reasons.push('Budget trasferimenti insufficiente.');
  if (!input.wageBudgetOk) reasons.push('Budget stipendi insufficiente.');
  return { ok: reasons.length === 0, reasons };
};

const DEADLINE_STAGES: NegotiationStatus[] = ['club_offer_sent', 'club_counter_offer', 'player_contract_negotiation', 'player_counter_offer'];
const WINDOW_SUSPENDABLE_STAGES: NegotiationStatus[] = [
  'club_offer_accepted', 'player_contract_negotiation', 'player_counter_offer', 'player_contract_accepted',
  'medical_pending', 'medical_warning', 'registration_pending'
];
const NORMAL_OFFER_DURATION_ROUNDS = 6;
const CLOSING_SOON_OFFER_DURATION_ROUNDS = 2;

// Durata di una trattativa attiva: piu' breve se la finestra e' agli sgoccioli (urgenza reale, non
// un timer arbitrario).
export const computeNegotiationDeadline = (currentRound: number, windowClosingSoon: boolean): number => (
  currentRound + (windowClosingSoon ? CLOSING_SOON_OFFER_DURATION_ROUNDS : NORMAL_OFFER_DURATION_ROUNDS)
);

// Svincolati e precontratti restano possibili fuori finestra (comportamento gia' esistente,
// nessun nuovo ostacolo): non vengono mai sospesi per chiusura mercato.
export const isMarketWindowRestrictedTarget = (negotiationId: string): boolean => (
  !negotiationId.startsWith('freeagent_') && !negotiationId.startsWith('precontract_target_')
);

// Processa scadenze e chiusura finestra una sola volta per giornata (mai durante il render): nessun
// costo, nessun giocatore spostato, solo un cambio di stato con motivazione compatta in storico.
export const processNegotiationDeadlines = (
  negotiations: Negotiation[],
  currentRound: number,
  windows: TransferWindowState[]
): Negotiation[] => {
  const windowOpen = isTransferWindowOpen(windows);
  return negotiations.map(target => {
    if (DEADLINE_STAGES.includes(target.status) && target.expiresAtRound !== undefined && currentRound > target.expiresAtRound) {
      return {
        ...target,
        status: 'expired' as const,
        deadlineReason: 'Tempo scaduto prima della chiusura del mercato.',
        concludedAt: new Date().toISOString(),
        concludedKind: 'expired' as const,
        timeline: [...target.timeline, 'Offerta scaduta: tempo esaurito.']
      };
    }
    if (!windowOpen && WINDOW_SUSPENDABLE_STAGES.includes(target.status) && isMarketWindowRestrictedTarget(target.id)) {
      return {
        ...target,
        status: 'suspended_window_closed' as const,
        deadlineReason: 'Mercato chiuso prima del completamento dell\'operazione.',
        timeline: [...target.timeline, 'Trattativa sospesa: mercato chiuso.']
      };
    }
    return target;
  });
};

// Stesso principio per le offerte ricevute (cessioni): nessuna offerta resta pending per sempre,
// nessuna operazione a mercato chiuso.
export const processIncomingOfferDeadlines = (
  offers: IncomingTransferOffer[],
  currentRound: number,
  windows: TransferWindowState[]
): IncomingTransferOffer[] => {
  const windowOpen = isTransferWindowOpen(windows);
  return offers.map(offer => {
    if (offer.status === 'pending' && offer.expiresAtRound !== undefined && currentRound > offer.expiresAtRound) {
      return { ...offer, status: 'expired' as const };
    }
    if (!windowOpen && (offer.status === 'pending' || offer.status === 'medical_pending' || offer.status === 'registration_pending')) {
      return { ...offer, status: 'suspended_window_closed' as const };
    }
    return offer;
  });
};

// ─── Mercato M4: concorrenza tra club, aste, agenti/procuratori ───
// Solo trattative di acquisto a titolo definitivo (mai prestiti/scambi/svincolati/precontratti/
// contro-riscatto): e' l'unico caso in cui "un altro club puo' rubarmi il giocatore" ha un senso
// reale con il modello dati gia' esistente (CompetingClubBid.offerValue e' un cartellino).

export const isCompetitionEligibleNegotiation = (negotiationId: string, baseType?: TransferBaseType, hasSwapTerms?: boolean, hasLoanSwapTerms?: boolean): boolean => (
  !hasSwapTerms && !hasLoanSwapTerms && baseType !== 'loan'
  && !negotiationId.startsWith('freeagent_') && !negotiationId.startsWith('buyback_') && !negotiationId.startsWith('precontract_target_')
);

const COMPETITION_ACTIVE_STAGES: NegotiationStatus[] = [
  'club_offer_sent', 'club_counter_offer', 'club_offer_accepted',
  'player_contract_negotiation', 'player_counter_offer', 'player_contract_accepted',
  'medical_pending', 'medical_warning', 'registration_pending'
];

const MAX_COMPETING_CLUBS = 3;
const COMPETITOR_ENTRY_COOLDOWN_ROUNDS = 2;
const BID_ADVANCE_COOLDOWN_ROUNDS = 1;
const MAX_PLAYER_WAIT_ROUNDS = 3;

// Deterministico (nessun Math.random), stesso schema a soglie di getPersonalityArchetype
// (playerPersonality.ts) applicato ai tratti reali gia' presenti sul giocatore.
export const deriveAgentArchetype = (player: Player): AgentArchetype => {
  const p = player.personality;
  if (!p) return 'pragmatic';
  if (p.bigClubDesire >= 65 && p.ambition >= 60) return 'career_focused';
  if (p.ego >= 65 && p.mediaPressure >= 55) return 'aggressive';
  if (p.loyalty >= 65 && p.clubLove >= 60) return 'loyal';
  if (p.ambition <= 40 && p.professionalism >= 55) return 'patient';
  if (p.ego >= 55 || p.ambition >= 60) return 'money_focused';
  return 'pragmatic';
};

export const AGENT_ARCHETYPE_LABELS: Record<AgentArchetype, string> = {
  loyal: 'Leale',
  pragmatic: 'Pragmatico',
  aggressive: 'Aggressivo',
  career_focused: 'Orientato alla carriera',
  money_focused: 'Orientato al denaro',
  patient: 'Paziente'
};

const AGENT_ARCHETYPE_BASE: Record<AgentArchetype, { aggressiveness: number; commission: number; wage: number; project: number; clause: number; patience: number }> = {
  loyal: { aggressiveness: 30, commission: 35, wage: 40, project: 65, clause: 20, patience: 55 },
  pragmatic: { aggressiveness: 45, commission: 45, wage: 50, project: 50, clause: 35, patience: 50 },
  aggressive: { aggressiveness: 78, commission: 75, wage: 55, project: 40, clause: 55, patience: 40 },
  career_focused: { aggressiveness: 50, commission: 45, wage: 40, project: 80, clause: 30, patience: 55 },
  money_focused: { aggressiveness: 60, commission: 70, wage: 80, project: 35, clause: 45, patience: 35 },
  patient: { aggressiveness: 35, commission: 40, wage: 50, project: 55, clause: 30, patience: 78 }
};

// Profilo agente deterministico per giocatore (playerId + personalita' + eta' + contratto), lazy:
// creato una sola volta, poi sempre riletto dall'elenco persistito (mai rigenerato/duplicato).
export const ensurePlayerAgentProfile = (player: Player, existing: PlayerAgentProfile[]): PlayerAgentProfile => {
  const found = existing.find(p => p.playerId === player.id);
  if (found) return found;
  const archetype = deriveAgentArchetype(player);
  const base = AGENT_ARCHETYPE_BASE[archetype];
  const jitter = (seed: string, spread: number) => Math.round((hashRatio(`${player.id}_${seed}`) - 0.5) * spread);
  return {
    id: `agent_${player.id}`,
    playerId: player.id,
    archetype,
    negotiationAggressiveness: clamp(base.aggressiveness + jitter('aggr', 16), 5, 95),
    commissionSensitivity: clamp(base.commission + jitter('comm', 16), 5, 95),
    wageSensitivity: clamp(base.wage + jitter('wage', 16), 5, 95),
    projectSensitivity: clamp(base.project + jitter('proj', 16), 5, 95),
    releaseClausePreference: clamp(base.clause + jitter('clause', 16), 5, 95),
    patience: clamp(base.patience + jitter('pat', 16), 5, 95),
    processedAgentEventIds: []
  };
};

export const normalizePlayerAgentProfiles = (raw: unknown): PlayerAgentProfile[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is PlayerAgentProfile => (
      !!item && typeof item === 'object'
      && typeof (item as Record<string, unknown>).id === 'string'
      && typeof (item as Record<string, unknown>).playerId === 'string'
      && typeof (item as Record<string, unknown>).archetype === 'string'
    ))
    .slice(-400);
};

// Segnali reali che rendono un giocatore appetibile per un concorrente: mai concorrenza su un
// giocatore normale senza motivo.
const isPlayerCompetitiveTarget = (player: Player): boolean => (
  player.overall >= 76
  || ((player.potential - player.overall) >= 8 && player.age <= 23)
  || player.contractYears <= 1
  || player.form >= 7.2
);

// Un club concorrente entra solo con bisogno di ruolo reale + budget reale, mai a caso.
export const evaluateCompetingClubEntry = (
  player: Player,
  candidateClub: ClubAIState,
  sellingClubId: string,
  myClubId: string
): { eligible: boolean; reasons: string[] } => {
  if (candidateClub.clubId === sellingClubId || candidateClub.clubId === myClubId) return { eligible: false, reasons: [] };
  if (candidateClub.budget < player.value * 0.85) return { eligible: false, reasons: [] };
  if (!isPlayerCompetitiveTarget(player)) return { eligible: false, reasons: [] };

  const family = roleFamilyOf(player.role);
  const sameFamily = candidateClub.roster.filter(p => roleFamilyOf(p.role) === family);
  const familyFloor = family === 'GK' ? 3 : family === 'DF' ? 8 : family === 'MF' ? 8 : 6;
  const bestInFamily = sameFamily.reduce((max, p) => Math.max(max, p.overall), 0);
  const hasRoleNeed = sameFamily.length < familyFloor || bestInFamily < player.overall - 2;
  if (!hasRoleNeed) return { eligible: false, reasons: [] };

  const reasons: string[] = [
    sameFamily.length < familyFloor ? `Il ${candidateClub.name} ha una reale carenza numerica nel reparto.` : `Il ${candidateClub.name} cerca un rinforzo di qualita in quel ruolo.`,
    'Il giocatore attira interesse reale sul mercato.'
  ];
  return { eligible: true, reasons };
};

// Sceglie al massimo UN nuovo concorrente reale tra i club non ancora coinvolti (mai piu di uno a
// giornata): il piu ambizioso/capiente tra quelli realmente eleggibili, deterministico.
const pickNewCompetingClub = (
  player: Player,
  clubWorld: ClubAIState[],
  sellingClubId: string,
  myClubId: string,
  existingBidClubIds: string[]
): { club: ClubAIState; reasons: string[] } | null => {
  const candidates = clubWorld
    .filter(club => !existingBidClubIds.includes(club.clubId))
    .map(club => ({ club, evaluation: evaluateCompetingClubEntry(player, club, sellingClubId, myClubId) }))
    .filter(c => c.evaluation.eligible)
    .sort((a, b) => (b.club.ambition + b.club.budget / 1000000) - (a.club.ambition + a.club.budget / 1000000));
  return candidates.length > 0 ? { club: candidates[0].club, reasons: candidates[0].evaluation.reasons } : null;
};

// Prima offerta di un club concorrente: deterministica (seed su clubId+playerId), mai a caso e mai
// oltre il budget reale del club (offerValue puo' comunque crescere piu avanti via rilancio, sempre
// ricontrollato contro il budget corrente).
export const evaluateCompetingClubBid = (candidateClub: ClubAIState, player: Player, currentRound: number, entryReasons: string[]): CompetingClubBid => {
  const seed = hashRatio(`${candidateClub.clubId}_${player.id}_bid`);
  const offerValue = Math.min(candidateClub.budget, Math.round(player.value * (0.95 + seed * 0.3)));
  const wagePower = clamp(Math.round(40 + candidateClub.ambition * 0.5 + seed * 20), 10, 95);
  const projectAppeal = clamp(Math.round(candidateClub.ambition * 0.7 + seed * 25), 10, 95);
  const playerPreference = clamp(Math.round(35 + seed * 40), 10, 90);
  return {
    id: `bid_${candidateClub.clubId}_${player.id}_${currentRound}`,
    clubId: candidateClub.clubId,
    clubName: candidateClub.name,
    offerValue,
    wagePower,
    projectAppeal,
    playerPreference,
    status: 'watching',
    lastUpdatedRound: currentRound,
    reasons: entryReasons
  };
};

const BID_PROGRESSION: CompetingClubBidStatus[] = ['watching', 'considering', 'bid_preparing', 'bid_submitted'];

// Avanza la bid di UNA sola fase per giornata al massimo (guardia lastUpdatedRound/cooldown), mai
// piu' rilanci nello stesso render. Un club puo' anche ritirarsi con causa reale (budget eroso).
const advanceCompetingBid = (bid: CompetingClubBid, candidateClub: ClubAIState, currentRound: number, windowClosingSoon: boolean): CompetingClubBid => {
  if (bid.status === 'withdrawn' || bid.status === 'won' || bid.status === 'lost') return bid;
  if (currentRound - bid.lastUpdatedRound < BID_ADVANCE_COOLDOWN_ROUNDS) return bid;
  const seed = hashRatio(`${bid.id}_${currentRound}_advance`);
  if (bid.status !== 'bid_submitted' && candidateClub.budget < bid.offerValue * 0.9 && seed < 0.25) {
    return { ...bid, status: 'withdrawn', lastUpdatedRound: currentRound, reasons: [...bid.reasons, `Il ${candidateClub.name} si ritira: budget non piu sufficiente.`].slice(-6) };
  }
  const idx = BID_PROGRESSION.indexOf(bid.status);
  if (idx === -1 || idx === BID_PROGRESSION.length - 1) return bid;
  const advanceChance = 0.35 + (windowClosingSoon ? 0.25 : 0) + bid.playerPreference / 300;
  if (seed > advanceChance) return bid;
  return { ...bid, status: BID_PROGRESSION[idx + 1], lastUpdatedRound: currentRound };
};

// Rilancio reale: solo se il club e' gia' in asta (bid_submitted), solo se e' indietro rispetto alla
// mia offerta, mai due volte nella stessa giornata, mai oltre il budget reale.
const maybeRebidCompetingBid = (bid: CompetingClubBid, candidateClub: ClubAIState, myOfferValue: number, currentRound: number, windowClosingSoon: boolean): CompetingClubBid => {
  if (bid.status !== 'bid_submitted') return bid;
  if (currentRound - bid.lastUpdatedRound < BID_ADVANCE_COOLDOWN_ROUNDS) return bid;
  if (bid.offerValue >= myOfferValue) return bid;
  const seed = hashRatio(`${bid.id}_${currentRound}_rebid`);
  const rebidChance = 0.3 + (windowClosingSoon ? 0.3 : 0);
  if (seed > rebidChance) return bid;
  const raise = Math.round((myOfferValue - bid.offerValue) * (0.55 + seed * 0.35)) + Math.round(bid.offerValue * 0.03);
  const newOffer = Math.min(candidateClub.budget, bid.offerValue + raise);
  if (newOffer <= bid.offerValue) return bid;
  return { ...bid, offerValue: newOffer, lastUpdatedRound: currentRound, reasons: [...bid.reasons, `Il ${candidateClub.name} rilancia: nuova offerta piu alta.`].slice(-6) };
};

export const COMPETITION_STATUS_LABELS: Record<TransferCompetitionStatus, string> = {
  none: 'Trattativa privata',
  monitored: 'Monitorata da altri club',
  competing_clubs: 'Concorrenza attiva',
  auction: 'Asta aperta',
  player_waiting: 'Giocatore indeciso',
  user_outbid: 'Offerta superata',
  user_leading: 'In testa',
  lost_to_other_club: 'Giocatore perso',
  won: 'Operazione vinta'
};

export interface TransferCompetitionTickContext {
  player: Player;
  negotiationId: string;
  negotiationStatus: NegotiationStatus;
  myOfferValue: number;
  sellingClubId: string;
  myClubId: string;
  clubWorld: ClubAIState[];
  currentRound: number;
  windowOpen: boolean;
  windowClosingSoon: boolean;
}

// Tick reale unico per trattativa: chiamare solo a fine giornata/avanzamento round (mai a render).
// Idempotente sull'evento round (processedCompetitionEventIds), mai un rilancio duplicato dopo F5.
export const processTransferCompetitionTick = (
  existing: TransferCompetitionState | undefined,
  ctx: TransferCompetitionTickContext
): TransferCompetitionState => {
  const eventId = `tick_${ctx.negotiationId}_${ctx.currentRound}`;
  const base: TransferCompetitionState = existing ?? {
    negotiationId: ctx.negotiationId, playerId: ctx.player.id, status: 'none',
    competingBids: [], userBidRank: 1, pressureLevel: 0, reasons: [], processedCompetitionEventIds: []
  };
  if (base.processedCompetitionEventIds.includes(eventId)) return base;
  if (!COMPETITION_ACTIVE_STAGES.includes(ctx.negotiationStatus)) return base;

  const activeCount = base.competingBids.filter(b => b.status !== 'withdrawn' && b.status !== 'lost').length;
  const canAddNew = ctx.windowOpen
    && activeCount < MAX_COMPETING_CLUBS
    && (base.lastCompetitionRound === undefined || ctx.currentRound - base.lastCompetitionRound >= COMPETITOR_ENTRY_COOLDOWN_ROUNDS);

  let bids = base.competingBids;
  let lastCompetitionRound = base.lastCompetitionRound;
  if (canAddNew) {
    const picked = pickNewCompetingClub(ctx.player, ctx.clubWorld, ctx.sellingClubId, ctx.myClubId, bids.map(b => b.clubId));
    if (picked) {
      bids = [...bids, evaluateCompetingClubBid(picked.club, ctx.player, ctx.currentRound, picked.reasons)];
      lastCompetitionRound = ctx.currentRound;
    }
  }

  bids = bids.map(bid => {
    const club = ctx.clubWorld.find(c => c.clubId === bid.clubId);
    if (!club) return bid;
    const advanced = advanceCompetingBid(bid, club, ctx.currentRound, ctx.windowClosingSoon);
    return maybeRebidCompetingBid(advanced, club, ctx.myOfferValue, ctx.currentRound, ctx.windowClosingSoon);
  });

  // Rischio concreto di perdita: un rivale sottomesso e in vantaggio puo' chiudere l'operazione,
  // mai istantaneo (stesso cooldown del rilancio), probabilita' bassa e leggibile.
  const submittedBids = bids.filter(b => b.status === 'bid_submitted');
  const leadingRival = submittedBids.filter(b => b.offerValue > ctx.myOfferValue).sort((a, b) => b.offerValue - a.offerValue)[0];
  if (leadingRival && ctx.currentRound - leadingRival.lastUpdatedRound >= BID_ADVANCE_COOLDOWN_ROUNDS) {
    const closeSeed = hashRatio(`${leadingRival.id}_${ctx.currentRound}_close`);
    const edgeRatio = ctx.myOfferValue > 0 ? Math.min(0.15, (leadingRival.offerValue - ctx.myOfferValue) / ctx.myOfferValue * 0.3) : 0.1;
    const closeChance = 0.08 + (ctx.windowClosingSoon ? 0.14 : 0) + edgeRatio;
    if (closeSeed < closeChance) {
      bids = bids.map(b => (
        b.id === leadingRival.id
          ? { ...b, status: 'won' as const, lastUpdatedRound: ctx.currentRound }
          : (b.status === 'bid_submitted' || b.status === 'bid_preparing' || b.status === 'considering' || b.status === 'watching')
            ? { ...b, status: 'lost' as const, lastUpdatedRound: ctx.currentRound }
            : b
      ));
    }
  }

  const activeBids = bids.filter(b => b.status !== 'withdrawn' && b.status !== 'lost');
  const finalSubmitted = activeBids.filter(b => b.status === 'bid_submitted');
  const wonBid = activeBids.find(b => b.status === 'won');
  const highestKnownOffer = finalSubmitted.length > 0 ? Math.max(...finalSubmitted.map(b => b.offerValue)) : undefined;
  const userBidRank = 1 + finalSubmitted.filter(b => b.offerValue > ctx.myOfferValue).length;

  let status: TransferCompetitionStatus;
  if (wonBid) status = 'lost_to_other_club';
  else if (activeBids.length === 0) status = 'none';
  else if (finalSubmitted.length === 0) status = 'monitored';
  else if (finalSubmitted.length >= 2) status = 'auction';
  else if (userBidRank > 1) status = 'user_outbid';
  else status = 'user_leading';

  const pressureLevel = clamp(Math.round(activeBids.length * 22 + (ctx.windowClosingSoon ? 20 : 0) + (userBidRank - 1) * 15), 0, 100);
  const reasons = activeBids.flatMap(b => b.reasons).slice(-6);

  return {
    ...base,
    status,
    competingBids: bids,
    userBidRank,
    highestKnownOffer,
    lastCompetitionRound,
    nextEligibleCompetitionRound: (lastCompetitionRound ?? ctx.currentRound) + COMPETITOR_ENTRY_COOLDOWN_ROUNDS,
    pressureLevel,
    reasons,
    processedCompetitionEventIds: [...base.processedCompetitionEventIds, eventId].slice(-30)
  };
};

export const normalizeTransferCompetitions = (raw: unknown): TransferCompetitionState[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is TransferCompetitionState => (
      !!item && typeof item === 'object'
      && typeof (item as Record<string, unknown>).negotiationId === 'string'
      && typeof (item as Record<string, unknown>).playerId === 'string'
      && Array.isArray((item as Record<string, unknown>).competingBids)
    ))
    .slice(-60);
};

export interface AgentReactionResult {
  demandMultiplier: number;
  commissionMultiplier: number;
  signingBonusMultiplier: number;
  wantsReleaseClause: boolean;
  delayed: boolean;
  reasons: string[];
}

// Il procuratore influisce SOLO in fase giocatore, solo con causa reale (concorrenza attiva,
// archetipo): mai un rialzo automatico ad ogni chiamata senza motivo.
export const processAgentReaction = (
  profile: PlayerAgentProfile,
  competition: TransferCompetitionState | undefined,
  currentRound: number,
  windowClosingSoon: boolean
): AgentReactionResult => {
  const reasons: string[] = [];
  const hasCompetition = !!competition && competition.competingBids.some(b => b.status !== 'withdrawn' && b.status !== 'lost');
  let demandMultiplier = 1;
  let commissionMultiplier = 1;
  let signingBonusMultiplier = 1;
  let wantsReleaseClause = false;

  if (hasCompetition && competition) {
    const pressureBoost = clamp((competition.pressureLevel / 100) * (profile.negotiationAggressiveness / 100), 0, 0.35);
    demandMultiplier += pressureBoost * (profile.wageSensitivity / 100);
    commissionMultiplier += pressureBoost * (profile.commissionSensitivity / 100) * 1.4;
    if (profile.archetype === 'aggressive') {
      reasons.push('Il procuratore sa che altri club osservano il giocatore e chiede una commissione piu alta.');
    }
  }
  if (profile.archetype === 'career_focused') {
    reasons.push('Il giocatore vuole garanzie sul ruolo e sul progetto sportivo.');
  }
  if (profile.archetype === 'money_focused') {
    signingBonusMultiplier += 0.15 * (profile.wageSensitivity / 100);
    reasons.push('Il procuratore insiste su bonus alla firma e stipendio.');
  }
  if (profile.releaseClausePreference >= 65 && (hasCompetition || profile.archetype === 'career_focused')) {
    wantsReleaseClause = true;
    reasons.push('Il procuratore chiede una clausola rescissoria nel contratto.');
  }
  if (profile.archetype === 'loyal' && !hasCompetition) {
    demandMultiplier -= 0.05;
    reasons.push('Il giocatore apprezza la continuita del progetto: richieste piu contenute.');
  }
  const delayed = profile.archetype === 'patient' && !windowClosingSoon
    ? hashRatio(`${profile.id}_${currentRound}_delay`) < (profile.patience / 220)
    : false;

  return {
    demandMultiplier: clamp(demandMultiplier, 0.85, 1.35),
    commissionMultiplier: clamp(commissionMultiplier, 0.85, 1.6),
    signingBonusMultiplier: clamp(signingBonusMultiplier, 0.85, 1.4),
    wantsReleaseClause,
    delayed,
    reasons
  };
};

export interface PlayerWaitingDecision {
  waits: boolean;
  decidesNow: boolean;
  reason: string;
}

// Attesa reale ma limitata (max qualche giornata), piu' probabile con concorrenza/archetipo
// patient/aggressive/career_focused, mai infinita: a ridosso della chiusura deve decidere.
export const resolvePlayerWaitingDecision = (
  profile: PlayerAgentProfile,
  competition: TransferCompetitionState | undefined,
  waitingSinceRound: number,
  currentRound: number,
  windowClosingSoon: boolean
): PlayerWaitingDecision => {
  const roundsWaited = currentRound - waitingSinceRound;
  if (roundsWaited >= MAX_PLAYER_WAIT_ROUNDS || windowClosingSoon) {
    return {
      waits: false,
      decidesNow: true,
      reason: windowClosingSoon ? 'Il mercato sta per chiudere: il giocatore deve decidere ora.' : 'Il tempo a disposizione e scaduto: il giocatore decide ora.'
    };
  }
  const hasCompetition = !!competition && competition.competingBids.some(b => b.status !== 'withdrawn' && b.status !== 'lost');
  const waitAffinity = (
    profile.archetype === 'patient' ? 0.6
    : profile.archetype === 'aggressive' ? 0.4
    : profile.archetype === 'career_focused' ? 0.35
    : 0.15
  ) + (hasCompetition ? 0.2 : 0);
  const seed = hashRatio(`${profile.id}_${currentRound}_wait`);
  const waits = seed < clamp(waitAffinity, 0.05, 0.75);
  return {
    waits,
    decidesNow: !waits,
    reason: waits
      ? (hasCompetition ? 'Il mio agente vuole valutare il mercato: altri club osservano.' : 'La proposta economica e buona, ma il progetto non convince ancora del tutto.')
      : 'Il giocatore e pronto a decidere.'
  };
};

export interface TransferCompetitionSummary {
  statusLabel: string;
  positionLabel: string;
  bestKnownOffer?: number;
  activeRivalNames: string[];
  reasons: string[];
}

export const getTransferCompetitionSummary = (competition: TransferCompetitionState): TransferCompetitionSummary => {
  const activeRivalNames = competition.competingBids.filter(b => b.status !== 'withdrawn' && b.status !== 'lost').map(b => b.clubName);
  const positionLabel =
    competition.status === 'lost_to_other_club' ? 'Giocatore perso' :
    competition.status === 'user_outbid' ? 'Offerta superata' :
    competition.status === 'auction' ? 'Asta aperta' :
    competition.status === 'user_leading' ? 'In testa' :
    competition.userBidRank === 1 ? 'In testa' : `Posizione ${competition.userBidRank}`;
  return {
    statusLabel: COMPETITION_STATUS_LABELS[competition.status],
    positionLabel,
    bestKnownOffer: competition.highestKnownOffer,
    activeRivalNames,
    reasons: competition.reasons
  };
};
