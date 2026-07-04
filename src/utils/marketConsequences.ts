import {
  ClubAIState,
  ClubHistoryState,
  ClubMemoryDraft,
  ContractPromiseType,
  Negotiation,
  Player,
  TeamDNAState,
  TransferClauseType
} from '../types';
import { getClauseLabel, getPromiseLabel } from './marketIntelligence';

export interface MarketDecisionCost {
  label: string;
  benefit: string;
  cost: string;
  tone: 'positive' | 'warning' | 'critical' | 'neutral';
}

interface MarketDecisionContext {
  target: Negotiation;
  fee: number;
  bonus: number;
  agentFee: number;
  wage: number;
  bidYears: number;
  dealStructure: TransferClauseType;
  promiseType: ContractPromiseType;
  budget: number;
  players: Player[];
  starters: string[];
  clubWorld: ClubAIState[];
  clubHistory: ClubHistoryState;
  teamDNA: TeamDNAState;
}

interface PurchaseMemoryContext extends MarketDecisionContext {
  teamName: string;
  newPlayer: Player;
  remainingBudget: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const roleFamily = (role: string) => {
  if (role === 'GK') return 'GK';
  if (role.match(/CB|LB|RB/)) return 'DF';
  if (role.match(/DM|CM|AM/)) return 'MF';
  return 'FW';
};

const isAttacker = (role: string) => ['ST', 'LW', 'RW'].includes(role);

const findSourcePlayer = (target: Negotiation, clubWorld: ClubAIState[]) => (
  clubWorld.find(club => club.name === target.currentClub)?.roster.find(player => player.name === target.playerName)
);

const hasRivalryWithSource = (history: ClubHistoryState, sourceClub: string) => (
  history.rivalries.some(rivalry => rivalry.opponent === sourceClub && rivalry.heat >= 48)
);

const findBlockedYoungster = (players: Player[], incomingRole: string, starters: string[]) => (
  players
    .filter(player => (
      roleFamily(player.role) === roleFamily(incomingRole)
      && player.age <= 22
      && player.potential - player.overall >= 5
      && !starters.includes(player.id)
    ))
    .sort((a, b) => (b.potential - b.overall) - (a.potential - a.overall))[0]
);

const isEmotionalReturn = (history: ClubHistoryState, playerName: string) => (
  history.legends.some(entry => entry.title === playerName || entry.tags?.includes(`player:${playerName}`))
  || history.memories.some(memory => memory.playerNames?.includes(playerName) && memory.importance >= 65)
);

const packageCostFor = (fee: number, bonus: number, agentFee: number) => fee + bonus * 0.45 + agentFee;

export const evaluateMarketDecisionCosts = (context: MarketDecisionContext): MarketDecisionCost[] => {
  const {
    target,
    fee,
    bonus,
    agentFee,
    wage,
    bidYears,
    dealStructure,
    promiseType,
    budget,
    players,
    starters,
    clubWorld,
    clubHistory,
    teamDNA
  } = context;
  const sourcePlayer = findSourcePlayer(target, clubWorld);
  const incomingRole = sourcePlayer?.role ?? target.role;
  const packageCost = packageCostFor(fee, bonus, agentFee);
  const immediateCost = dealStructure === 'loanObligation' ? Math.round(fee * 0.35) + agentFee : fee + agentFee;
  const budgetShare = immediateCost / Math.max(1, budget);
  const blockedYoungster = findBlockedYoungster(players, incomingRole, starters);
  const rivalryDeal = hasRivalryWithSource(clubHistory, target.currentClub);
  const costs: MarketDecisionCost[] = [];

  if (promiseType !== 'none') {
    const promiseLabel = getPromiseLabel(promiseType);
    costs.push({
      label: promiseLabel,
      benefit: promiseType === 'starRole'
        ? 'Convince il giocatore e alza subito entusiasmo e visibilita.'
        : promiseType === 'youngProject'
          ? 'Crea un patto di crescita chiaro e aumenta la fiducia del giovane.'
          : promiseType === 'starter'
            ? 'Riduce il rischio di rifiuto e chiarisce la gerarchia.'
            : 'Dà coinvolgimento senza promettere centralita assoluta.',
      cost: promiseType === 'starRole'
        ? 'Ogni panchina o gara senza impatto diventa pressione mediatica.'
        : promiseType === 'youngProject'
          ? 'Se i minuti non arrivano, agente e vivaio possono aprire un caso.'
          : promiseType === 'starter'
            ? 'Un titolare attuale nello stesso ruolo puo sentirsi scaricato.'
            : 'Promessa sostenibile, ma va mantenuta con continuita reale.',
      tone: promiseType === 'starRole' ? 'warning' : 'neutral'
    });
  }

  if (dealStructure !== 'none') {
    costs.push({
      label: getClauseLabel(dealStructure),
      benefit: dealStructure === 'loanObligation'
        ? 'Riduce il costo immediato e protegge il budget di questa finestra.'
        : dealStructure === 'buyback'
          ? 'Rende piu facile trattare giovani di valore.'
          : dealStructure === 'sellOn'
            ? 'Aiuta a convincere il club venditore senza alzare troppo il fisso.'
            : 'Sposta parte del rischio sul rendimento futuro.',
      cost: dealStructure === 'loanObligation'
        ? 'Rimanda un debito sportivo e finanziario alla prossima stagione.'
        : dealStructure === 'buyback'
          ? 'Se esplode, il club di provenienza puo riprenderselo.'
          : dealStructure === 'sellOn'
            ? 'Un futuro affare redditizio rendera meno del previsto.'
            : 'Se rende, i bonus peseranno sul bilancio.',
      tone: dealStructure === 'loanObligation' || dealStructure === 'buyback' ? 'warning' : 'neutral'
    });
  }

  if (budgetShare >= 0.62 || packageCost > target.value * 1.28) {
    costs.push({
      label: 'Investimento pesante',
      benefit: 'Il club manda un segnale di ambizione forte a tifosi, sponsor e spogliatoio.',
      cost: 'Se il rendimento non arriva subito, diventa candidato naturale a peggior acquisto.',
      tone: 'critical'
    });
  } else if (budgetShare <= 0.28 && fee <= target.value * 1.02) {
    costs.push({
      label: 'Affare sostenibile',
      benefit: 'Rinforza la rosa senza bloccare il resto del mercato.',
      cost: 'Il profilo potrebbe non cambiare da solo il livello della stagione.',
      tone: 'positive'
    });
  }

  if (isAttacker(incomingRole) && packageCost >= Math.max(25000000, budget * 0.38)) {
    costs.push({
      label: 'Gol richiesti subito',
      benefit: 'Un attaccante costoso accende piazza, media e sponsor.',
      cost: 'Ogni partita senza gol pesera di piu nella narrativa.',
      tone: 'warning'
    });
  }

  if (blockedYoungster) {
    costs.push({
      label: `Spazio chiuso a ${blockedYoungster.name}`,
      benefit: 'Aumenti subito profondita e livello del ruolo.',
      cost: 'Il giovane puo chiedere prestito, minuti o una cessione definitiva.',
      tone: 'warning'
    });
  }

  if (rivalryDeal) {
    costs.push({
      label: `Sgarbo al ${target.currentClub}`,
      benefit: 'Prendere un giocatore da una rivale rafforza identita e rumore mediatico.',
      cost: 'La rivalita si scalda e le prossime sfide avranno piu tensione.',
      tone: 'critical'
    });
  }

  if (agentFee > Math.max(900000, wage * 18) || target.agentStyle === 'Opportunista') {
    costs.push({
      label: 'Agente ingombrante',
      benefit: 'Commissioni e contratto aumentano la probabilita di chiudere.',
      cost: 'Gli agenti capiscono che il club paga; le prossime richieste saranno piu dure.',
      tone: 'warning'
    });
  }

  if (bidYears >= 5) {
    costs.push({
      label: 'Contratto lungo',
      benefit: 'Protegge valore e continuita del progetto.',
      cost: 'Se il giocatore cala o non si adatta, resta un peso difficile da muovere.',
      tone: 'neutral'
    });
  }

  if (teamDNA.active === 'vivaio' && blockedYoungster) {
    costs.push({
      label: 'Coerenza DNA sotto esame',
      benefit: 'Alzi la qualita immediata senza aspettare la crescita interna.',
      cost: 'Tifosi e vivaio possono percepirlo come tradimento del progetto giovani.',
      tone: 'critical'
    });
  }

  return costs.slice(0, 6);
};

export const buildPurchaseMemory = (context: PurchaseMemoryContext): ClubMemoryDraft => {
  const {
    target,
    fee,
    bonus,
    agentFee,
    dealStructure,
    promiseType,
    budget,
    players,
    starters,
    clubWorld,
    clubHistory,
    teamName,
    newPlayer,
    remainingBudget
  } = context;
  const packageCost = packageCostFor(fee, bonus, agentFee);
  const sourcePlayer = findSourcePlayer(target, clubWorld);
  const incomingRole = sourcePlayer?.role ?? newPlayer.role;
  const blockedYoungster = findBlockedYoungster(players, incomingRole, starters);
  const rivalryDeal = hasRivalryWithSource(clubHistory, target.currentClub);
  const emotionalReturn = isEmotionalReturn(clubHistory, target.playerName);
  const expensive = packageCost > Math.max(target.value * 1.28, budget * 0.46);
  const goalPressure = isAttacker(incomingRole) && packageCost >= Math.max(25000000, budget * 0.38);
  const newEra = promiseType === 'starRole' || packageCost >= budget * 0.5 || newPlayer.overall >= 84;
  const riskyDeal = expensive || (target.hiddenRisk !== 'Nessuno' && !target.riskKnown);
  const sustainableDeal = packageCost <= target.value * 1.03 && packageCost <= budget * 0.32;
  const lowBudgetAfter = remainingBudget < Math.max(2500000, budget * 0.12);
  const title =
    emotionalReturn ? `Ritorno emotivo: ${target.playerName}` :
    rivalryDeal ? `Sgarbo di mercato: ${target.playerName}` :
    newEra ? `Acquisto nuova era: ${target.playerName}` :
    riskyDeal ? `Scommessa pesante: ${target.playerName}` :
    `Acquisto di ${target.playerName}`;
  const descriptionParts = [
    `${teamName} porta in rosa ${target.playerName} dal ${target.currentClub} per un pacchetto da ${Math.round(packageCost / 1000000)} milioni.`,
    promiseType !== 'none' ? `La promessa e ${getPromiseLabel(promiseType).toLowerCase()}.` : 'Non ci sono promesse pubbliche forti.',
    dealStructure !== 'none' ? `La struttura include ${getClauseLabel(dealStructure).toLowerCase()}.` : '',
    goalPressure ? 'Da un attaccante pagato cosi la piazza pretendera gol immediati.' : '',
    rivalryDeal ? `Arriva da una rivale gia calda: il prossimo incrocio con il ${target.currentClub} avra piu veleno.` : '',
    emotionalReturn ? 'Il ritorno accende nostalgia e aspettative: puo diventare rinascita o rimpianto.' : '',
    blockedYoungster ? `Nel ruolo ora ${blockedYoungster.name} vede meno spazio e il vivaio osservera la gestione.` : '',
    lowBudgetAfter ? 'Il budget residuo e sottile: la proprieta chiedera disciplina nelle prossime mosse.' : ''
  ].filter(Boolean);
  const tags = [
    'acquisto',
    riskyDeal ? 'flop-risk' : sustainableDeal ? 'affare-sostenibile' : 'rinforzo',
    newEra ? 'nuova-era' : '',
    emotionalReturn ? 'ritorno-emotivo' : '',
    rivalryDeal ? 'rivalita' : '',
    goalPressure ? 'pressione-gol' : '',
    blockedYoungster ? 'giovane-chiuso' : '',
    promiseType !== 'none' ? `promessa:${promiseType}` : '',
    `player:${target.playerName}`
  ].filter((tag): tag is string => Boolean(tag));

  return {
    season: '2026/27',
    category: 'transfer',
    title,
    description: descriptionParts.join(' '),
    importance: clamp(newPlayer.overall * 0.62 + packageCost / 4200000 + (rivalryDeal ? 8 : 0) + (emotionalReturn ? 7 : 0), 48, 94),
    fanImpact: rivalryDeal || emotionalReturn || newEra
      ? 5
      : riskyDeal ? -2 : sustainableDeal ? 3 : 2,
    dressingRoomImpact: blockedYoungster
      ? -2
      : newPlayer.overall >= 84 ? 3 : 1,
    stakeholderImpacts: {
      ownership: lowBudgetAfter ? -4 : sustainableDeal ? 4 : expensive ? -2 : 1,
      sponsors: newEra || goalPressure ? 4 : 1,
      press: goalPressure || rivalryDeal ? 5 : 1,
      academy: blockedYoungster ? -5 : promiseType === 'youngProject' ? 3 : 0,
      agents: agentFee > Math.max(900000, target.wage * 18) ? 4 : 1
    },
    opponent: rivalryDeal ? target.currentClub : undefined,
    actors: ['club', 'board', 'player', 'agent', 'fans', ...(rivalryDeal ? ['rivalry' as const] : [])],
    tags,
    playerNames: [target.playerName]
  };
};
