import {
  ClubAIState,
  ClubTransferInterest,
  IncomingTransferOffer,
  OutgoingMarketState,
  Player,
  PlayerProjectRole,
  PlayerSeasonStat,
  TransferAvailability,
  TransferInterestLevel
} from '../types';
import { hashRatio } from './marketIntelligence';

// ─── Mercato Cessioni C1: interesse dinamico, disponibilita, offerte spontanee ───
// Le cessioni non "listi e ricevi offerta": i club IA osservano, valutano bisogno/budget/tattica
// reali e solo a volte arrivano a un'offerta ufficiale. Interesse != offerta.

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const roleFamilyOf = (role: string) => (
  role === 'GK' ? 'GK' : /CB|LB|RB/.test(role) ? 'DF' : /DM|CM|AM/.test(role) ? 'MF' : 'FW'
);

export const AVAILABILITY_LABELS: Record<TransferAvailability, string> = {
  not_for_sale: 'Non cedibile',
  available_for_right_offer: 'Cedibile alla giusta offerta',
  listed_for_sale: 'In lista cedibili',
  loan_listed: 'Disponibile solo in prestito',
  sale_or_loan: 'Cessione o prestito',
  out_of_squad: 'Fuori rosa',
  player_requested_exit: 'Ha chiesto la cessione',
  untouchable: 'Incedibile',
  expiring: 'Contratto in scadenza',
  conditional_loan: 'Prestito condizionato'
};

export const INTEREST_LEVEL_LABELS: Record<TransferInterestLevel, string> = {
  watching: 'Osservazione',
  monitoring: 'Monitoraggio',
  concrete_interest: 'Interesse concreto',
  inquiry: 'Sondaggio',
  possible_negotiation: 'Trattativa possibile',
  official_offer: 'Offerta ufficiale'
};

const LEVEL_ORDER: TransferInterestLevel[] = [
  'watching', 'monitoring', 'concrete_interest', 'inquiry', 'possible_negotiation', 'official_offer'
];

// Soglie di punteggio minime per passare dal livello corrente al successivo (indice = livello corrente).
const LEVEL_THRESHOLDS = [8, 22, 38, 54, 70];

// Giornate minime di cooldown prima che un interesse possa evolvere di nuovo dopo aver raggiunto un livello.
const cooldownForLevel = (level: TransferInterestLevel): number => (
  level === 'official_offer' ? 8 :
  level === 'possible_negotiation' ? 3 :
  level === 'inquiry' ? 3 :
  level === 'concrete_interest' ? 2 :
  2
);

// Vecchi salvataggi: mai rigenerata ad ogni render, mai una scrittura automatica. Un giocatore gia'
// segnato 'Cedibile' dal vecchio toggle (Squad.tsx) viene letto come equivalente a 'listed_for_sale'
// senza mai mutare il salvataggio; altrimenti il default sicuro e' 'available_for_right_offer'.
export const getEffectiveAvailability = (player: Player): TransferAvailability => {
  if (player.transferAvailability) return player.transferAvailability;
  if (player.status === 'Cedibile') return 'listed_for_sale';
  return 'available_for_right_offer';
};

export const createInitialOutgoingMarketState = (): OutgoingMarketState => ({
  interests: [],
  lastProcessedRound: null
});

export const normalizeOutgoingMarketState = (raw: unknown): OutgoingMarketState => {
  if (!raw || typeof raw !== 'object') return createInitialOutgoingMarketState();
  const value = raw as Record<string, unknown>;
  const validLevels = new Set<TransferInterestLevel>(LEVEL_ORDER);
  const validStatuses = new Set(['active', 'converted', 'expired', 'withdrawn']);

  const interests = Array.isArray(value.interests)
    ? (value.interests as unknown[])
      .map((item): ClubTransferInterest | null => {
        if (!item || typeof item !== 'object') return null;
        const i = item as Record<string, unknown>;
        if (typeof i.id !== 'string' || typeof i.playerId !== 'string' || typeof i.interestedClubId !== 'string') return null;
        return {
          id: i.id,
          playerId: i.playerId,
          interestedClubId: i.interestedClubId,
          level: validLevels.has(i.level as TransferInterestLevel) ? i.level as TransferInterestLevel : 'watching',
          score: typeof i.score === 'number' ? i.score : 0,
          reasons: Array.isArray(i.reasons) ? (i.reasons as string[]).slice(0, 4) : [],
          firstSeenRound: typeof i.firstSeenRound === 'number' ? i.firstSeenRound : 1,
          lastUpdatedRound: typeof i.lastUpdatedRound === 'number' ? i.lastUpdatedRound : 1,
          nextEligibleActionRound: typeof i.nextEligibleActionRound === 'number' ? i.nextEligibleActionRound : 1,
          isPublic: i.isPublic === true,
          sourceId: typeof i.sourceId === 'string' ? i.sourceId : `${i.playerId}_${i.interestedClubId}`,
          status: validStatuses.has(i.status as string) ? i.status as ClubTransferInterest['status'] : 'active'
        };
      })
      .filter((i): i is ClubTransferInterest => i !== null)
      .slice(-200)
    : [];

  return {
    interests,
    lastProcessedRound: typeof value.lastProcessedRound === 'number' ? value.lastProcessedRound : null
  };
};

// ─── Interesse del club IA per un mio giocatore: solo segnali reali gia' disponibili ───

export interface AIClubInterestResult {
  score: number; // puo' essere negativo, clampato solo in output finale
  reasons: string[];
}

export const evaluateAIClubInterest = (
  player: Player,
  aiClub: ClubAIState,
  playerStat?: PlayerSeasonStat
): AIClubInterestResult => {
  const reasons: string[] = [];
  let score = 0;

  const availability = getEffectiveAvailability(player);
  const family = roleFamilyOf(player.role);
  const sameFamily = aiClub.roster.filter(p => roleFamilyOf(p.role) === family);
  const bestInFamily = sameFamily.reduce((max, p) => Math.max(max, p.overall), 0);
  const familyFloor = family === 'GK' ? 2 : family === 'DF' ? 7 : family === 'MF' ? 7 : 5;

  // Bisogno reale di reparto
  if (sameFamily.length < familyFloor) {
    score += 22;
    reasons.push('Il club ha una carenza numerica reale in quel reparto.');
  }
  if (player.overall > bestInFamily + 3) {
    score += 20;
    reasons.push('Livello nettamente superiore al miglior giocatore del club in quel ruolo.');
  } else if (player.overall > bestInFamily) {
    score += 10;
    reasons.push('Alzerebbe la gerarchia del ruolo.');
  } else if (bestInFamily - player.overall <= 3) {
    score -= 6;
    reasons.push('Forte concorrenza gia presente in quel ruolo.');
  } else {
    score -= 14;
    reasons.push('Il ruolo e gia coperto da un titolare superiore.');
  }

  // Qualita assoluta
  score += clamp((player.overall - 68) * 1.6, -10, 26);

  // Forma / statistiche stagionali reali, solo se presenti
  if (playerStat && playerStat.appearances > 0) {
    if (playerStat.averageRating >= 6.8) {
      score += 8;
      reasons.push('Rendimento stagionale reale sopra la media.');
    } else if (playerStat.averageRating > 0 && playerStat.averageRating < 5.8) {
      score -= 6;
    }
  }
  if (player.form >= 7.5) score += 5;
  else if (player.form <= 5) score -= 4;

  // Eta e potenziale
  if (player.age <= 24 && player.potential - player.overall >= 5) {
    score += 14;
    reasons.push('Giovane con margine di crescita reale.');
  } else if (player.age >= 32) {
    score -= 10;
    reasons.push('Eta avanzata: investimento meno prioritario.');
  }

  // Contratto
  if (player.contractYears <= 1) {
    score += 12;
    reasons.push('Contratto in scadenza: operazione piu abbordabile.');
  } else if (player.contractYears >= 4) {
    score -= 6;
    reasons.push('Contratto lungo: operazione piu complessa.');
  }

  // Stipendio sostenibile rispetto al budget reale del club IA
  const annualWage = player.wage * 52;
  const wageShare = aiClub.budget > 0 ? annualWage / aiClub.budget : 999;
  if (wageShare > 0.35) {
    score -= 20;
    reasons.push('Stipendio fuori portata per il budget del club interessato.');
  } else if (wageShare < 0.12) {
    score += 6;
  }

  // Disponibilita alla cessione
  switch (availability) {
    case 'not_for_sale': score -= 16; break;
    case 'available_for_right_offer': score += 2; break;
    case 'listed_for_sale': score += 14; reasons.push('Inserito nella lista cedibili: piu visibile sul mercato.'); break;
    case 'loan_listed': score += 8; break;
    case 'sale_or_loan': score += 12; break;
    case 'out_of_squad': score += 16; reasons.push('Fuori dai piani della rosa attuale.'); break;
    case 'player_requested_exit': score += 20; reasons.push('Ha gia chiesto la cessione al proprio club.'); break;
    case 'untouchable': score -= 40; break;
    case 'expiring': score += 18; reasons.push('Contratto in scadenza reale: occasione a basso costo.'); break;
    case 'conditional_loan': score += 6; break;
    default: break;
  }

  // Prezzo richiesto irrealistico
  if (player.askingPrice && player.askingPrice > player.value * 1.6) {
    score -= 14;
    reasons.push('Richiesta economica giudicata irrealistica.');
  }

  // Infortunio serio in corso (dato reale gia' modellato su Player.injuryStatus)
  const severity = player.injuryStatus?.currentInjury?.severity;
  if (player.injuryStatus?.status === 'injured' && (severity === 'major' || severity === 'severe')) {
    score -= 18;
    reasons.push('Infortunio serio in corso: rischio che scoraggia l\'operazione.');
  }

  // Budget assoluto del club IA rispetto al prezzo stimato
  const estimatedFee = player.askingPrice ?? player.value;
  if (aiClub.budget < estimatedFee * 0.55) {
    score -= 30;
    reasons.push('Budget trasferimenti del club interessato insufficiente.');
  }

  // Legame forte col club attuale: trattativa piu dura (segnale reale gia' su personality)
  if (player.personality.loyalty >= 80 && player.personality.clubLove >= 75 && availability !== 'player_requested_exit') {
    score -= 8;
    reasons.push('Forte legame del giocatore col club attuale.');
  }

  // Ambizione reale del club IA
  score += clamp((aiClub.ambition - 70) * 0.3, -6, 8);

  return { score: Math.round(clamp(score, -60, 100)), reasons: reasons.slice(0, 4) };
};

// ─── Livello massimo raggiungibile in base alla disponibilita: untouchable si ferma all'interesse "eccezionale" ───
const maxLevelIndexForAvailability = (availability: TransferAvailability): number => (
  availability === 'untouchable' ? LEVEL_ORDER.indexOf('concrete_interest') : LEVEL_ORDER.length - 1
);

const decideNextLevel = (
  current: TransferInterestLevel,
  score: number,
  availability: TransferAvailability,
  listedThisRound: boolean
): TransferInterestLevel => {
  const idx = LEVEL_ORDER.indexOf(current);
  const cappedMaxIdx = listedThisRound
    ? Math.min(maxLevelIndexForAvailability(availability), LEVEL_ORDER.indexOf('inquiry'))
    : maxLevelIndexForAvailability(availability);
  if (idx >= cappedMaxIdx) return current;
  if (score < LEVEL_THRESHOLDS[idx]) return current;
  return LEVEL_ORDER[idx + 1];
};

export const buildIncomingOfferFromInterest = (
  interest: ClubTransferInterest,
  player: Player,
  aiClub: ClubAIState,
  currentRound: number
): IncomingTransferOffer => {
  const availability = getEffectiveAvailability(player);
  const formula: 'permanent' | 'loan' = availability === 'loan_listed' ? 'loan' : 'permanent';
  const basePrice = player.askingPrice ?? player.value;
  const discount = availability === 'out_of_squad' || availability === 'player_requested_exit' ? 0.86 : 1;
  const premium = interest.score >= 70 ? 1.12 : 1;
  const fee = Math.max(100000, Math.round(basePrice * discount * premium / 100000) * 100000);

  return {
    id: `interest_offer_${player.id}_${aiClub.clubId}_${currentRound}`,
    fromClub: aiClub.name,
    playerId: player.id,
    playerName: player.name,
    role: player.role,
    fee,
    reason: interest.reasons[0] ?? `${aiClub.name} ha seguito a lungo ${player.name}.`,
    status: 'pending',
    formula,
    wageShareIfLoan: formula === 'loan' ? 60 : undefined,
    createdAtRound: currentRound,
    expiresAtRound: currentRound + 5,
    sourceInterestId: interest.id
  };
};

export interface OutgoingMarketTickContext {
  players: Player[];
  clubWorld: ClubAIState[];
  currentRound: number;
  myTeamName: string;
  playerStats: PlayerSeasonStat[];
  incomingOffers: IncomingTransferOffer[];
}

export interface OutgoingMarketTickResult {
  state: OutgoingMarketState;
  newOffers: IncomingTransferOffer[];
  logs: string[];
}

const MAX_ACTIVE_INTERESTS_PER_PLAYER = 4;
const MAX_NEW_INTERESTS_PER_ROUND = 2;

// Un solo tick per giornata (guardia lastProcessedRound), mai piu' di 2 nuovi interessi rilevanti,
// mai piu' di 4 club attivi per giocatore, mai piu' di un'evoluzione per giocatore/giornata.
export const processOutgoingMarketTick = (
  state: OutgoingMarketState,
  context: OutgoingMarketTickContext
): OutgoingMarketTickResult => {
  if (state.lastProcessedRound === context.currentRound) {
    return { state, newOffers: [], logs: [] };
  }

  const { players, clubWorld, currentRound, myTeamName, playerStats, incomingOffers } = context;
  const aiClubs = clubWorld.filter(club => club.name !== myTeamName);
  let interests = [...state.interests];
  const newOffers: IncomingTransferOffer[] = [];
  const logs: string[] = [];
  const evolvedPlayerIds = new Set<string>();

  const statFor = (playerId: string, playerName: string) => (
    playerStats.find(stat => stat.playerId === playerId || stat.playerName === playerName)
  );

  // 1) Evolvi interessi attivi esistenti (max 1 evoluzione per giocatore in questa giornata)
  for (const player of players) {
    const activeForPlayer = interests.filter(i => i.playerId === player.id && i.status === 'active');
    for (const interest of activeForPlayer) {
      if (evolvedPlayerIds.has(player.id)) break;
      if (interest.lastUpdatedRound === currentRound) continue;
      if (currentRound < interest.nextEligibleActionRound) continue;

      const aiClub = clubWorld.find(club => club.clubId === interest.interestedClubId);
      if (!aiClub) continue;

      const evalResult = evaluateAIClubInterest(player, aiClub, statFor(player.id, player.name));
      const availability = getEffectiveAvailability(player);
      const listedThisRound = player.lastAvailabilityChangeRound === currentRound;
      const nextLevel = decideNextLevel(interest.level, evalResult.score, availability, listedThisRound);
      if (nextLevel === interest.level) continue;

      evolvedPlayerIds.add(player.id);

      if (nextLevel === 'official_offer') {
        const alreadyOffered = incomingOffers.some(offer => (
          offer.playerId === player.id && offer.fromClub === aiClub.name
          && (offer.status === 'pending' || offer.status === 'awaiting_player_decision')
        ));
        if (!alreadyOffered && availability !== 'untouchable') {
          const converted: ClubTransferInterest = {
            ...interest,
            level: nextLevel,
            score: evalResult.score,
            reasons: evalResult.reasons,
            lastUpdatedRound: currentRound,
            nextEligibleActionRound: currentRound + cooldownForLevel(nextLevel),
            isPublic: true,
            status: 'converted'
          };
          const offer = buildIncomingOfferFromInterest(converted, player, aiClub, currentRound);
          newOffers.push(offer);
          logs.push(`${aiClub.name} formalizza un'offerta per ${player.name}.`);
          interests = interests.map(i => (i.id === interest.id ? converted : i));
        } else {
          // Offerta duplicata gia' esistente o giocatore incedibile: resta un passo prima, mai un loop.
          interests = interests.map(i => (i.id === interest.id ? {
            ...interest,
            level: 'possible_negotiation',
            score: evalResult.score,
            reasons: evalResult.reasons,
            lastUpdatedRound: currentRound,
            nextEligibleActionRound: currentRound + cooldownForLevel('possible_negotiation'),
            isPublic: true
          } : i));
        }
      } else {
        interests = interests.map(i => (i.id === interest.id ? {
          ...interest,
          level: nextLevel,
          score: evalResult.score,
          reasons: evalResult.reasons,
          lastUpdatedRound: currentRound,
          nextEligibleActionRound: currentRound + cooldownForLevel(nextLevel),
          isPublic: interest.isPublic || nextLevel === 'inquiry' || nextLevel === 'possible_negotiation'
        } : i));
      }
    }
  }

  // 2) Crea nuovi interessi (max 2 rilevanti/giornata complessivi, max 4 club attivi/giocatore)
  let newInterestsThisRound = 0;
  for (const player of players) {
    if (newInterestsThisRound >= MAX_NEW_INTERESTS_PER_ROUND) break;
    const activeCount = interests.filter(i => i.playerId === player.id && i.status === 'active').length;
    if (activeCount >= MAX_ACTIVE_INTERESTS_PER_PLAYER) continue;

    for (const aiClub of aiClubs) {
      if (newInterestsThisRound >= MAX_NEW_INTERESTS_PER_ROUND) break;
      const existing = interests.find(i => i.playerId === player.id && i.interestedClubId === aiClub.clubId);
      if (existing && (existing.status === 'active' || currentRound < existing.nextEligibleActionRound)) continue;

      const evalResult = evaluateAIClubInterest(player, aiClub, statFor(player.id, player.name));
      const availability = getEffectiveAvailability(player);
      const seed = hashRatio(`${player.id}-${aiClub.clubId}-${currentRound}-interest`);
      const threshold = availability === 'untouchable' ? 92 : availability === 'not_for_sale' ? 58 : 40;
      const effectiveScore = evalResult.score + (seed - 0.5) * 12;
      if (effectiveScore < threshold) continue;

      const newInterest: ClubTransferInterest = {
        id: `interest_${player.id}_${aiClub.clubId}_${currentRound}`,
        playerId: player.id,
        interestedClubId: aiClub.clubId,
        level: 'watching',
        score: evalResult.score,
        reasons: evalResult.reasons,
        firstSeenRound: currentRound,
        lastUpdatedRound: currentRound,
        nextEligibleActionRound: currentRound + cooldownForLevel('watching'),
        isPublic: false,
        sourceId: `outgoing_${player.id}_${aiClub.clubId}`,
        status: 'active'
      };
      interests.push(newInterest);
      newInterestsThisRound += 1;
    }
  }

  return {
    state: { interests: interests.slice(-200), lastProcessedRound: currentRound },
    newOffers,
    logs
  };
};

export interface OutgoingMarketInterestView {
  clubName: string;
  level: TransferInterestLevel;
  levelLabel: string;
  reasons: string[];
  probabilityLabel: 'Solo osservazione' | 'Interesse concreto' | 'Possibile offerta';
}

export interface OutgoingMarketPlayerSummary {
  playerId: string;
  playerName: string;
  interests: OutgoingMarketInterestView[];
}

// Vista compatta per la UI: max 3 club per giocatore, mai un'offerta ufficiale mostrata come "certa" qui.
export const getOutgoingMarketSummary = (
  state: OutgoingMarketState,
  players: Player[],
  clubWorld: ClubAIState[]
): OutgoingMarketPlayerSummary[] => {
  const active = state.interests.filter(i => i.status === 'active');
  const byPlayer = new Map<string, ClubTransferInterest[]>();
  active.forEach(interest => {
    const list = byPlayer.get(interest.playerId) ?? [];
    list.push(interest);
    byPlayer.set(interest.playerId, list);
  });

  const results: OutgoingMarketPlayerSummary[] = [];
  byPlayer.forEach((list, playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    const top = [...list].sort((a, b) => b.score - a.score).slice(0, 3);
    results.push({
      playerId,
      playerName: player.name,
      interests: top.map(interest => {
        const club = clubWorld.find(c => c.clubId === interest.interestedClubId);
        const levelIdx = LEVEL_ORDER.indexOf(interest.level);
        return {
          clubName: club?.name ?? 'Club sconosciuto',
          level: interest.level,
          levelLabel: INTEREST_LEVEL_LABELS[interest.level],
          reasons: interest.reasons,
          probabilityLabel: levelIdx <= 1 ? 'Solo osservazione' : levelIdx <= 3 ? 'Interesse concreto' : 'Possibile offerta'
        };
      })
    });
  });

  return results.sort((a, b) => (
    Math.max(...b.interests.map(i => LEVEL_ORDER.indexOf(i.level)))
    - Math.max(...a.interests.map(i => LEVEL_ORDER.indexOf(i.level)))
  ));
};

// ─── Voce del giocatore: solo dati esistenti (ruolo percepito, promesse, morale, contratto, status) ───

export type PlayerWillingnessLevel = 'wants_to_stay' | 'reluctant' | 'open_to_listen' | 'interested' | 'wants_to_leave';

export const WILLINGNESS_LABELS: Record<PlayerWillingnessLevel, string> = {
  wants_to_stay: 'Vuole restare',
  reluctant: 'Poco interessato',
  open_to_listen: 'Aperto ad ascoltare',
  interested: 'Interessato',
  wants_to_leave: 'Vuole partire'
};

export interface PlayerWillingness {
  level: PlayerWillingnessLevel;
  label: string;
  reasons: string[];
}

export const getPlayerTransferWillingness = (player: Player, projectRole: PlayerProjectRole): PlayerWillingness => {
  const availability = getEffectiveAvailability(player);
  const reasons: string[] = [];
  let score = (projectRole.tension - projectRole.trust) * 0.5;

  if (projectRole.tension >= 65) reasons.push('Situazione tesa nel progetto tecnico.');
  if (projectRole.trust >= 70) reasons.push('Si sente centrale nel progetto.');

  if (availability === 'player_requested_exit') { score += 40; reasons.push('Ha gia chiesto la cessione.'); }
  if (availability === 'not_for_sale' || availability === 'untouchable') score -= 20;
  if (availability === 'out_of_squad') { score += 18; reasons.push('E fuori dai piani della rosa attuale.'); }

  if (player.morale <= 45) { score += 14; reasons.push('Morale basso.'); }
  else if (player.morale >= 80) score -= 8;

  if (player.contractYears <= 1) { score += 10; reasons.push('Contratto in scadenza.'); }

  if (player.personality.ambition >= 75 && projectRole.trust < 55) {
    score += 12;
    reasons.push('Ambizione personale non soddisfatta dal ruolo attuale.');
  }
  if (player.personality.loyalty >= 78 && player.personality.clubLove >= 75) {
    score -= 14;
    reasons.push('Forte legame con il club.');
  }
  if (player.playingTimePromise?.status === 'broken') {
    score += 16;
    reasons.push('Promessa di minutaggio non rispettata.');
  }

  const level: PlayerWillingnessLevel =
    score >= 32 ? 'wants_to_leave' :
    score >= 14 ? 'interested' :
    score >= -6 ? 'open_to_listen' :
    score >= -22 ? 'reluctant' :
    'wants_to_stay';

  return { level, label: WILLINGNESS_LABELS[level], reasons: reasons.slice(0, 3) };
};

export interface PlayerOfferPrediction extends PlayerWillingness {
  likelyAccept: boolean;
}

// Previsione mostrata PRIMA di accettare: mai una certezza assoluta, solo una lettura qualitativa.
export const predictOfferAcceptance = (
  player: Player,
  offer: IncomingTransferOffer,
  projectRole: PlayerProjectRole
): PlayerOfferPrediction => {
  const willingness = getPlayerTransferWillingness(player, projectRole);
  const feeRatio = offer.fee / Math.max(1, player.value);
  const strongOffer = feeRatio >= 1.25 && offer.formula !== 'loan';
  const likelyAccept =
    willingness.level === 'wants_to_leave'
    || willingness.level === 'interested'
    || (willingness.level === 'open_to_listen' && strongOffer);
  return { ...willingness, likelyAccept };
};

// Decisione reale del giocatore quando il manager accetta l'offerta del club: mai Math.random,
// seed deterministico su playerId + offerId + giornata (F5-safe, ripetibile).
export const resolvePlayerDecisionOnOffer = (
  player: Player,
  offer: IncomingTransferOffer,
  projectRole: PlayerProjectRole,
  currentRound: number
): boolean => {
  const prediction = predictOfferAcceptance(player, offer, projectRole);
  if (prediction.level === 'wants_to_stay') return false;
  if (prediction.level === 'wants_to_leave') return true;
  const seed = hashRatio(`${player.id}-${offer.id}-${currentRound}-decision`);
  const acceptThreshold =
    prediction.level === 'interested' ? 0.25 :
    prediction.level === 'open_to_listen' ? 0.55 :
    0.82;
  return seed > acceptThreshold;
};
