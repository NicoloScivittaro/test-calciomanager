import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Info, Send, RotateCw, Eye } from 'lucide-react';
import { ClubAIState, ClubHistoryState, ClubMemoryDraft, ClubProfile, IncomingTransferOffer, Player, Negotiation, PlayerSeasonStat, TeamDNAState, TransferClauseType, ContractPromiseType } from '../../types';
import { getClubByName } from '../../data/serieAData';
import { createRealReplacementTargets, replaceSoldPlayerForClub } from '../../utils/clubAI';
import { advanceScouting, getClauseLabel, getPromiseLabel, getRealPlayerForTarget, getVisibleScoutingReport, normalizeNegotiations, normalizeNegotiation } from '../../utils/marketIntelligence';
import { buildPurchaseMemory, evaluateMarketDecisionCosts } from '../../utils/marketConsequences';
import { buildPlayerStamina } from '../../utils/playerFitness';
import { buildCareerMemory, buildPlayerPersonality, buildPlayerRelationships } from '../../utils/playerPersonality';
import { getPlayerProjectRole, getProjectRoleColor } from '../../utils/playerProjectRole';
import { getDNAMarketAdjustment } from '../../utils/teamDNA';
import ClubInfoModal from '../common/ClubInfoModal';
import PlayerProfileModal from '../common/PlayerProfileModal';

interface MarketProps {
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
  currentRound: number;
}

export default function Market({
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
  currentRound
}: MarketProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  
  // Negotiation triggers
  const [biddingPlayer, setBiddingPlayer] = useState<Negotiation | null>(null);
  const [bidFee, setBidFee] = useState<string>('');
  const [bidWage, setBidWage] = useState<string>('');
  const [bidYears, setBidYears] = useState<number>(3);
  const [bidBonus, setBidBonus] = useState<string>('0');
  const [agentFee, setAgentFee] = useState<string>('0');
  const [sellOn, setSellOn] = useState<number>(0);
  const [dealStructure, setDealStructure] = useState<TransferClauseType>('none');
  const [promiseType, setPromiseType] = useState<ContractPromiseType>('none');
  
  // Status simulation
  const [isSimulatingDeal, setIsSimulatingDeal] = useState(false);
  const [playerSheet, setPlayerSheet] = useState<{ player: Player; mode: 'quick' | 'full' } | null>(null);
  const [selectedClubInfo, setSelectedClubInfo] = useState<ClubProfile | null>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const roleContext = { starters, bench, seasonStats: playerStats, clubHistory, round: currentRound };
  const allKnownPlayers = [...players, ...clubWorld.flatMap(club => club.roster)];

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

  const estimateSignedPlayer = (target: Negotiation, offeredWage: number): Player => {
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
      contractYears: bidYears,
      status: 'Disponibile',
      personality,
      relationships: buildPlayerRelationships(basePlayer, personality),
      careerMemory: buildCareerMemory()
    };
  };

  const marketTargets = normalizeNegotiations(scoutedTargets, teamDNA, clubWorld);

  const filteredTargets = marketTargets.filter(t => {
    const matchesSearch = t.playerName.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'ALL' ? true : t.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleStartBid = (player: Negotiation) => {
    const normalized = normalizeNegotiation(player, teamDNA, clubWorld);
    setBiddingPlayer(normalized);
    // Auto-fill default values
    setBidFee(Math.round(normalized.value * 0.95).toString());
    setBidWage(normalized.wage.toString());
    setBidYears(3);
    setBidBonus(Math.round(normalized.value * 0.08).toString());
    setAgentFee(Math.round(normalized.wage * (normalized.agentStyle === 'Opportunista' ? 20 : normalized.agentStyle === 'Duro' ? 16 : 12)).toString());
    setSellOn(normalized.clauseType === 'sellOn' ? 12 : 5);
    setDealStructure(normalized.clauseType ?? 'none');
    setPromiseType(normalized.promiseType ?? (normalized.value >= 45000000 ? 'starRole' : normalized.value >= 25000000 ? 'starter' : 'rotation'));
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
    const updated = advanceScouting(normalized, realPlayer, teamDNA, clubWorld);
    setBudget(budget - scoutCost);
    setScoutedTargets(scoutedTargets.map(item => item.id === target.id ? updated : item));
    addNewNews(
      `Report scouting: ${target.playerName}`,
      `${target.playerName}: rete scouting livello ${updated.scoutLevel}/4. ${updated.timeline[updated.timeline.length - 1]}`,
      'market'
    );
  };

  const handleSendOffer = () => {
    if (!biddingPlayer) return;
    const feeNum = Number(bidFee);
    const wageNum = Number(bidWage);
    const bonusNum = Number(bidBonus);
    const agentFeeNum = Number(agentFee);
    const immediateFee = dealStructure === 'loanObligation' ? Math.round(feeNum * 0.35) : feeNum;
    const immediateCost = immediateFee + agentFeeNum;
    
    if (isNaN(feeNum) || feeNum <= 0 || isNaN(wageNum) || wageNum <= 0 || isNaN(bonusNum) || bonusNum < 0 || isNaN(agentFeeNum) || agentFeeNum < 0) {
      alert('Inserisci una cifra di offerta valida.');
      return;
    }
    if (immediateCost > budget) {
      alert('Costo immediato superiore al budget: considera anche commissione agente.');
      return;
    }

    setIsSimulatingDeal(true);

    // Simulate negotiation delay (1.5s)
    setTimeout(() => {
      setIsSimulatingDeal(false);
      
      const newTargets = [...scoutedTargets];
      const targetIndex = newTargets.findIndex(t => t.id === biddingPlayer.id);
      const dealTarget = normalizeNegotiation(biddingPlayer, teamDNA, clubWorld);
      
      const valueRatio = feeNum / dealTarget.value;
      const clauseClubValue =
        dealStructure === 'goalBonus' ? bonusNum * 0.72 :
        dealStructure === 'buyback' ? dealTarget.value * 0.11 :
        dealStructure === 'sellOn' ? dealTarget.value * (sellOn / 100) * 0.34 :
        dealStructure === 'loanObligation' ? feeNum * 0.16 :
        0;
      const totalPackageRatio = (feeNum + bonusNum * 0.45 + dealTarget.value * (sellOn / 100) * 0.25 + clauseClubValue) / dealTarget.value;
      const wageRatio = wageNum / dealTarget.wage;
      const agentRatio = agentFeeNum / Math.max(1, dealTarget.wage * 20);
      const sourceClub = clubWorld.find(club => club.name === dealTarget.currentClub);
      const realPlayer = sourceClub?.roster.find(player => player.name === dealTarget.playerName);
      const dnaMarket = realPlayer ? getDNAMarketAdjustment(realPlayer, teamDNA) : null;
      const sellingClubDifficulty =
        ['Inter', 'Juventus', 'Milan', 'Napoli', 'Roma', 'Atalanta'].includes(dealTarget.currentClub) ? 14 :
        ['Como', 'Fiorentina', 'Lazio', 'Bologna'].includes(dealTarget.currentClub) ? 8 : 2;
      const promiseAppeal =
        promiseType === 'starRole' ? 11 :
        promiseType === 'starter' ? 8 :
        promiseType === 'youngProject' ? (realPlayer?.age ?? 25) <= 22 ? 10 : 2 :
        promiseType === 'rotation' ? 3 :
        -4;
      const agentDemand =
        dealTarget.agentStyle === 'Opportunista' ? 10 :
        dealTarget.agentStyle === 'Duro' ? 7 :
        dealTarget.agentStyle === 'Mediatico' ? 4 :
        dealTarget.agentStyle === 'Leale' ? -2 :
        0;
      const playerAppeal = (wageRatio - 1) * 22 + (bidYears >= 4 ? 7 : bidYears === 2 ? -6 : 0) + agentRatio * 8 + promiseAppeal + ((dealTarget.projectFit ?? 50) - 50) * 0.12;
      const clubAppeal = (totalPackageRatio - 0.9) * 120 + sellOn * 0.8 - sellingClubDifficulty + (teamDNA.reputation - 55) * 0.08;
      const nextDaysLeft = clamp((dealTarget.daysLeft ?? 14) - (dealTarget.agentStyle === 'Paziente' ? 3 : 5), 0, 60);
      const nextRivalPressure = clamp((dealTarget.rivalPressure ?? 0) + (dealTarget.rivalClub ? 12 + (dealTarget.rumorLevel ?? 0) * 0.08 : 0), 0, 100);
      const rivalPenalty = dealTarget.rivalClub ? nextRivalPressure * 0.13 + Math.max(0, 5 - nextDaysLeft) * 3 : 0;
      const successThreshold = dealTarget.probability + playerAppeal + clubAppeal + (dnaMarket?.probabilityBonus ?? 0) - agentDemand - rivalPenalty;
      let success = false;
      let logMsg = '';
      const stolenByRival = Boolean(dealTarget.rivalClub && nextRivalPressure >= 78 && totalPackageRatio < 1.15 && wageRatio < 1.12);

      if (valueRatio < 0.78 && totalPackageRatio < 0.9) {
        success = false;
        logMsg = `Offerta rifiutata: il ${dealTarget.currentClub} giudica il pacchetto troppo basso. Richiesta indicativa: ${formatCurrency(Math.round(dealTarget.value * 1.08))} piu bonus.`;
      } else if (stolenByRival) {
        success = false;
        logMsg = `Furto dell'ultimo secondo: il ${dealTarget.rivalClub} si inserisce mentre l'agente perde pazienza e diventa favorito.`;
      } else if (totalPackageRatio >= 1.18 && wageRatio >= 1 && agentRatio >= 0.35) {
        success = true;
        logMsg = `Offerta accettata: parte fissa, ${getClauseLabel(dealStructure).toLowerCase()}, promessa ${getPromiseLabel(promiseType).toLowerCase()} e commissioni convincono club, agente e giocatore.`;
      } else {
        const roll = Math.random() * 100;
        if (roll < successThreshold) {
          success = true;
          logMsg = `Accordo raggiunto dopo una trattativa complessa: ${formatCurrency(feeNum)} + ${formatCurrency(bonusNum)} bonus, ${getClauseLabel(dealStructure)}, promessa ${getPromiseLabel(promiseType)}.`;
        } else {
          success = false;
          logMsg = `Controfferta ricevuta: il ${dealTarget.currentClub} chiede ${formatCurrency(Math.round(dealTarget.value * 1.12))}, bonus piu realistici e agente da soddisfare.`;
        }
      }

      if (success) {
        // Complete transfer
        if (targetIndex >= 0) {
          newTargets[targetIndex] = {
            ...dealTarget,
            status: 'accepted',
            offeredFee: feeNum,
            offeredWage: wageNum,
            offeredContractYears: bidYears,
            daysLeft: nextDaysLeft,
            rivalPressure: nextRivalPressure,
            clauseType: dealStructure,
            promiseType,
            agentTrust: clamp((dealTarget.agentTrust ?? 50) + 8, 0, 100),
            timeline: [...dealTarget.timeline, `Offerta: ${formatCurrency(feeNum)} + bonus ${formatCurrency(bonusNum)}, agente ${formatCurrency(agentFeeNum)}, ${getClauseLabel(dealStructure)}, promessa ${getPromiseLabel(promiseType)}`, logMsg, 'Trattativa completata con successo!']
          };
        }

        // Subtract from budget
        const remainingBudget = budget - immediateCost;
        setBudget(remainingBudget);

        // Add player to roster
        const newPlayer = realPlayer
          ? {
              ...realPlayer,
              id: `signed_${realPlayer.id}_${Date.now()}`,
              wage: wageNum,
              contractYears: bidYears,
              morale: Math.max(realPlayer.morale, 84),
              condition: dealTarget.hiddenRisk === 'Fragilita fisica' && !dealTarget.riskKnown ? 86 : 100,
              status: dealTarget.hiddenRisk === 'Fragilita fisica' && !dealTarget.riskKnown ? 'Stanco' as const : 'Disponibile' as const
          }
          : estimateSignedPlayer(dealTarget, wageNum);
        setPlayers([...players, newPlayer]);
        onTransferDNAEvent(newPlayer, 'buy', feeNum);

        addClubMemory(buildPurchaseMemory({
          target: dealTarget,
          fee: feeNum,
          bonus: bonusNum,
          agentFee: agentFeeNum,
          wage: wageNum,
          bidYears,
          dealStructure,
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

        if (sourceClub) {
          const aiReplacement = replaceSoldPlayerForClub(
            clubWorld,
            dealTarget.currentClub,
            {
              name: dealTarget.playerName,
              role: newPlayer.role,
              overall: newPlayer.overall,
              value: dealTarget.value
            },
            feeNum,
            teamName
          );
          setClubWorld(aiReplacement.world);
          if (aiReplacement.incomingOffer) {
            setIncomingOffers([aiReplacement.incomingOffer, ...incomingOffers]);
          }
          if (aiReplacement.log) {
            addNewNews('Mercato IA', aiReplacement.log, 'market');
          }
        }

        // Publish board news
        addNewNews(
          `UFFICIALE: Acquistato ${dealTarget.playerName}!`,
          `${teamName} chiude l'operazione: ${dealTarget.playerName} arriva dal ${dealTarget.currentClub} per ${formatCurrency(feeNum)} piu bonus. Clausola: ${getClauseLabel(dealStructure)}. Promessa: ${getPromiseLabel(promiseType)}. Commissioni agente: ${formatCurrency(agentFeeNum)}.`,
          'market'
        );
      } else {
        if (targetIndex >= 0) {
          newTargets[targetIndex] = {
            ...dealTarget,
            status: 'rejected',
            offeredFee: feeNum,
            offeredWage: wageNum,
            offeredContractYears: bidYears,
            daysLeft: nextDaysLeft,
            rivalPressure: nextRivalPressure,
            clauseType: dealStructure,
            promiseType,
            agentTrust: clamp((dealTarget.agentTrust ?? 50) - (stolenByRival ? 12 : 5), 0, 100),
            timeline: [
              ...dealTarget.timeline,
              `Offerta: ${formatCurrency(feeNum)} + bonus ${formatCurrency(bonusNum)}, agente ${formatCurrency(agentFeeNum)}, ${getClauseLabel(dealStructure)}, promessa ${getPromiseLabel(promiseType)}`,
              dnaMarket ? `DNA: ${dnaMarket.note}` : 'DNA: profilo non pienamente valutabile.',
              dealTarget.rivalClub ? `Rivale: ${dealTarget.rivalClub} ora pressione ${Math.round(nextRivalPressure)}/100, tempo residuo ${Math.round(nextDaysLeft)} giorni.` : 'Nessun rivale forte ancora emerso.',
              logMsg
            ]
          };
        }
      }

      setScoutedTargets(newTargets);
      setBiddingPlayer(null);
    }, 1500);
  };

  const handleResetTarget = (targetId: string) => {
    const newTargets = scoutedTargets.map(t => {
      if (t.id === targetId) {
        return {
          ...t,
          status: 'pending' as const,
          timeline: [`Il club ha resettato la trattativa.`]
        };
      }
      return t;
    });
    setScoutedTargets(newTargets);
  };

  const listedPlayers = players.filter(player => player.status === 'Cedibile');
  const pendingIncomingOffers = incomingOffers.filter(offer => offer.status === 'pending');
  const offerForListedPlayer = (player: Player) => {
    const ageFactor = player.age <= 23 ? 1.12 : player.age <= 28 ? 1 : player.age >= 33 ? 0.68 : 0.86;
    const formFactor = 0.88 + player.form / 45;
    const marketNoise = 0.82 + hashRatio(`${player.id}-${player.value}-${player.form}`) * 0.28;
    return Math.round(player.value * ageFactor * formFactor * marketNoise / 100000) * 100000;
  };
  const marketDecisionPreview = biddingPlayer
    ? evaluateMarketDecisionCosts({
        target: normalizeNegotiation(biddingPlayer, teamDNA, clubWorld),
        fee: Number(bidFee) || biddingPlayer.value,
        bonus: Number(bidBonus) || 0,
        agentFee: Number(agentFee) || 0,
        wage: Number(bidWage) || biddingPlayer.wage,
        bidYears,
        dealStructure,
        promiseType,
        budget,
        players,
        starters,
        clubWorld,
        clubHistory,
        teamDNA
      })
    : [];

  const handleAcceptOutgoing = (player: Player, offer: number) => {
    const buyer = [...clubWorld]
      .filter(club => club.name !== teamName && club.budget > offer)
      .sort((a, b) => {
        const aNeed = a.roster.filter(item => item.role === player.role).length;
        const bNeed = b.roster.filter(item => item.role === player.role).length;
        if (aNeed !== bNeed) return aNeed - bNeed;
        return b.ambition - a.ambition;
      })[0];

    setPlayers(players.filter(p => p.id !== player.id));
    setStarters(starters.filter(id => id !== player.id));
    setBench(bench.filter(id => id !== player.id));
    setBudget(budget + offer);
    onTransferDNAEvent(player, 'sell', offer);
    const saleMemory = getSaleMemoryProfile(player, buyer?.name, offer);
    addClubMemory({
      season: '2026/27',
      category: 'transfer',
      title: saleMemory.title,
      description: saleMemory.description,
      importance: saleMemory.importance,
      fanImpact: saleMemory.fanImpact,
      dressingRoomImpact: saleMemory.dressingRoomImpact,
      tags: saleMemory.tags,
      playerNames: [player.name]
    });
    if (buyer) {
      setClubWorld(clubWorld.map(club => {
        if (club.clubId !== buyer.clubId) return club;
        return {
          ...club,
          budget: Math.max(0, club.budget - offer),
          roster: [...club.roster, { ...player, id: `ai_buy_${club.clubId}_${player.id}`, status: 'Disponibile' }],
          transferLog: [`${club.name} acquista ${player.name} da ${teamName} per ${formatCurrency(offer)}.`, ...club.transferLog].slice(0, 12)
        };
      }));
    }
    const realReplacementTargets = createRealReplacementTargets(player, teamName, clubWorld);
    if (realReplacementTargets.length > 0) {
      setScoutedTargets([...realReplacementTargets, ...scoutedTargets]);
    }
    addNewNews(
      `Cessione completata: ${player.name}`,
      `${teamName} incassa ${formatCurrency(offer)} dalla cessione di ${player.name}${buyer ? ` al ${buyer.name}` : ''}. ${realReplacementTargets.length > 0 ? 'Lo scouting ha aggiunto sostituti reali nello stesso ruolo.' : 'Lo scouting non ha trovato subito un sostituto reale acquistabile.'}`,
      'market'
    );
  };

  const handleAcceptIncomingOffer = (offer: IncomingTransferOffer) => {
    const player = players.find(item => item.id === offer.playerId);
    if (!player) return;

    setPlayers(players.filter(item => item.id !== offer.playerId));
    setStarters(starters.filter(id => id !== offer.playerId));
    setBench(bench.filter(id => id !== offer.playerId));
    setBudget(budget + offer.fee);
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
    setIncomingOffers(incomingOffers.map(item => item.id === offer.id ? { ...item, status: 'accepted' } : item));

    setClubWorld(clubWorld.map(club => {
      if (club.name !== offer.fromClub) return club;
      return {
        ...club,
        budget: Math.max(0, club.budget - offer.fee),
        roster: [...club.roster, { ...player, id: `ai_offer_${club.clubId}_${player.id}`, status: 'Disponibile' }],
        transferLog: [`${club.name} acquista ${player.name} dal ${teamName} per ${formatCurrency(offer.fee)}.`, ...club.transferLog].slice(0, 12)
      };
    }));

    const realReplacementTargets = createRealReplacementTargets(player, teamName, clubWorld);
    if (realReplacementTargets.length > 0) {
      setScoutedTargets([...realReplacementTargets, ...scoutedTargets]);
    }
    addNewNews(
      `Offerta accettata: ${player.name}`,
      `${teamName} vende ${player.name} al ${offer.fromClub} per ${formatCurrency(offer.fee)}. ${realReplacementTargets.length > 0 ? 'Lo scouting ha proposto sostituti reali.' : 'Nessun sostituto reale immediato disponibile.'}`,
      'market'
    );
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

  return (
    <div className="page-wrapper">
      
      {/* Active negotiations section */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', color: 'var(--color-gold)' }}>
          Trattative Recenti
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {scoutedTargets.filter(t => t.status !== 'pending').length === 0 ? (
            <div className="card-premium" style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              <Info size={24} style={{ marginBottom: '10px' }} />
              <p style={{ fontSize: '0.85rem' }}>Nessuna trattativa avviata in questa sessione.</p>
            </div>
          ) : (
            scoutedTargets.filter(t => t.status !== 'pending').map(t => {
              const targetPlayer = findPlayerForTarget(t);
              return (
              <div key={t.id} className={`card-premium ${t.status === 'accepted' ? 'border-glow' : 'border-gold'}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                        <button
                          className="inline-player-link"
                          onClick={() => openPlayerSheet(targetPlayer)}
                          disabled={!targetPlayer}
                        >
                          {t.playerName}
                        </button>
                      </h4>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        Da:{' '}
                        <button className="inline-club-link" onClick={() => openClubInfo(t.currentClub)}>
                          {t.currentClub}
                        </button>
                      </p>
                    </div>
                    <span className={`badge`} style={{
                      backgroundColor: t.status === 'accepted' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: t.status === 'accepted' ? 'var(--color-pitch)' : 'var(--color-danger)',
                      border: `1px solid ${t.status === 'accepted' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                    }}>
                      {t.status === 'accepted' ? 'Accettata' : 'Rifiutata'}
                    </span>
                  </div>

                  {/* Logs/Timeline preview */}
                  <div style={{ marginTop: '12px', padding: '8px', backgroundColor: 'rgba(26,33,42,0.3)', borderRadius: '4px', border: '1px solid var(--border-light)', fontSize: '0.7rem', maxHeight: '90px', overflowY: 'auto' }}>
                    {t.timeline.map((log, idx) => (
                      <p key={idx} style={{ color: 'var(--text-secondary)', marginBottom: '4px', lineHeight: '1.3' }}>
                        • {log}
                      </p>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
                  <button
                    onClick={() => handleResetTarget(t.id)}
                    className="btn-secondary"
                    style={{ flex: 1, padding: '6px 12px', fontSize: '0.75rem', justifyContent: 'center' }}
                  >
                    <RotateCw size={12} />
                    Riprova Trattativa
                  </button>
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', color: 'var(--color-pitch)' }}>
          Offerte ricevute da club IA
        </h3>
        <div className="card-premium" style={{ padding: pendingIncomingOffers.length ? 0 : '26px' }}>
          {pendingIncomingOffers.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Nessuna offerta ricevuta. I club possono bussare quando cercano un sostituto reale nel tuo ruolo.
            </p>
          ) : (
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Club</th>
                  <th>Giocatore richiesto</th>
                  <th>Ruolo</th>
                  <th>Motivo</th>
                  <th>Offerta</th>
                  <th style={{ textAlign: 'center' }}>Decisione</th>
                </tr>
              </thead>
              <tbody>
                {pendingIncomingOffers.map(offer => {
                  const offerPlayer = findPlayerForOffer(offer);
                  return (
                    <tr key={offer.id}>
                      <td>
                        <button className="inline-club-link" onClick={() => openClubInfo(offer.fromClub)}>
                          {offer.fromClub}
                        </button>
                      </td>
                      <td>
                        <button
                          className="inline-player-link"
                          onClick={() => openPlayerSheet(offerPlayer)}
                          disabled={!offerPlayer}
                        >
                          {offer.playerName}
                        </button>
                      </td>
                      <td><span className={`badge badge-${offer.role === 'GK' ? 'GK' : offer.role.match(/CB|LB|RB/) ? 'DF' : offer.role.match(/DM|CM|AM/) ? 'MF' : 'FW'}`}>{offer.role}</span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{offer.reason}</td>
                      <td style={{ fontWeight: 800, color: 'var(--color-pitch)' }}>{formatCurrency(offer.fee)}</td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                          <button className="btn-primary" onClick={() => handleAcceptIncomingOffer(offer)} style={{ padding: '6px 10px', fontSize: '0.72rem' }}>
                            Accetta
                          </button>
                          <button className="btn-secondary" onClick={() => handleRejectIncomingOffer(offer)} style={{ padding: '6px 10px', fontSize: '0.72rem' }}>
                            Rifiuta
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px' }}>
          Cessioni in Uscita
        </h3>
        <div className="card-premium" style={{ padding: listedPlayers.length ? 0 : '26px' }}>
          {listedPlayers.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Nessun giocatore in lista trasferimenti. Puoi marcarli come Cedibile dalla rosa.
            </p>
          ) : (
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Giocatore</th>
                  <th>Ruolo</th>
                  <th>Valore</th>
                  <th>Offerta stimata</th>
                  <th>Impatto</th>
                  <th style={{ textAlign: 'center' }}>Azione</th>
                </tr>
              </thead>
              <tbody>
                {listedPlayers.map(player => {
                  const offer = offerForListedPlayer(player);
                  const projectRole = getPlayerProjectRole(player, roleContext);
                  const projectRoleColor = getProjectRoleColor(projectRole);
                  const impact = projectRole.key === 'surplus'
                    ? 'Uscita sostenibile'
                    : projectRole.key === 'fanSymbol' || projectRole.key === 'untouchableStar'
                      ? 'Vendita dolorosa'
                      : starters.includes(player.id) ? 'Titolare: rischio tecnico' : projectRole.label;
                  return (
                    <tr key={player.id}>
                      <td>
                        <button className="inline-player-link" onClick={() => openPlayerSheet(player)}>
                          {player.name}
                        </button>
                      </td>
                      <td><span className={`badge badge-${player.role === 'GK' ? 'GK' : player.role.match(/CB|LB|RB/) ? 'DF' : player.role.match(/DM|CM|AM/) ? 'MF' : 'FW'}`}>{player.role}</span></td>
                      <td>{formatCurrency(player.value)}</td>
                      <td style={{ fontWeight: 700, color: offer >= player.value ? 'var(--color-pitch)' : 'var(--color-gold)' }}>{formatCurrency(offer)}</td>
                      <td style={{ color: projectRoleColor }}>
                        <strong style={{ display: 'block', fontSize: '0.74rem' }}>{impact}</strong>
                        <span style={{ display: 'block', marginTop: '2px', fontSize: '0.66rem', color: 'var(--text-secondary)' }}>
                          {projectRole.label}, fiducia {projectRole.trust}, tensione {projectRole.tension}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn-secondary" onClick={() => handleAcceptOutgoing(player, offer)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                          Accetta offerta
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Scouted Database Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Database Obiettivi di Calciomercato
          </h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Rete scouting: scopri gradualmente potenziale, personalita, fragilita e adattamento tattico.
          </span>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Cerca obiettivi..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 10px 6px 30px',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                fontSize: '0.8rem',
                color: 'var(--text-primary)'
              }}
            >
              <option value="ALL">Tutti i ruoli</option>
              <option value="GK">Portieri</option>
              <option value="LB">Terzini Sinistri</option>
              <option value="RB">Terzini Destri</option>
              <option value="CB">Difensori Centrali</option>
              <option value="DM">Centrocampisti Difensivi</option>
              <option value="CM">Centrocampisti Centrali</option>
              <option value="AM">Trequartisti</option>
              <option value="ST">Attaccanti</option>
            </select>
          </div>
        </div>

        {/* Targets Table list */}
        <div className="card-premium" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="premium-table">
            <thead>
              <tr>
                <th>Giocatore</th>
                <th>Ruolo</th>
                <th>Club Attuale</th>
                <th>Scouting</th>
                <th>Agente</th>
                <th>Tempo/Rivali</th>
                <th>Probabilità Acquisto</th>
                <th>Valore Stimato</th>
                <th>Stipendio Attuale</th>
                <th style={{ textAlign: 'center' }}>Azione</th>
              </tr>
            </thead>
            <tbody>
              {filteredTargets.filter(t => t.status === 'pending').map(target => {
                const report = getVisibleScoutingReport(target);
                const rivalHot = (target.rivalPressure ?? 0) >= 65;
                const targetPlayer = findPlayerForTarget(target);
                return (
                <tr key={target.id}>
                  <td>
                    <button
                      className="inline-player-link"
                      onClick={() => openPlayerSheet(targetPlayer)}
                      disabled={!targetPlayer}
                    >
                      {target.playerName}
                    </button>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '3px' }}>{target.systemNote}</p>
                  </td>
                  <td>
                    <span className={`badge badge-${target.role === 'GK' ? 'GK' : target.role.match(/CB|LB|RB/) ? 'DF' : target.role.match(/DM|CM|AM/) ? 'MF' : 'FW'}`}>
                      {target.role}
                    </span>
                  </td>
                  <td>
                    <button className="inline-club-link" onClick={() => openClubInfo(target.currentClub)}>
                      {target.currentClub}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.68rem' }}>
                      <strong>{target.scoutLevel ?? 0}/4 - {report.certainty}</strong>
                      <span style={{ color: 'var(--text-secondary)' }}>Pot. {report.potential} · Fit {report.tacticalFit}</span>
                      <span style={{ color: report.risk !== 'non scoperto' && report.risk !== 'Nessuno' ? 'var(--color-danger)' : 'var(--text-muted)' }}>Rischio: {report.risk}</span>
                      <button className="btn-secondary" onClick={() => handleScoutTarget(target)} disabled={(target.scoutLevel ?? 0) >= 4} style={{ padding: '4px 7px', fontSize: '0.65rem', justifyContent: 'center', opacity: (target.scoutLevel ?? 0) >= 4 ? 0.45 : 1 }}>
                        <Eye size={10} />
                        Scout
                      </button>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.68rem' }}>
                      <strong>{target.agentName}</strong>
                      <span style={{ color: 'var(--text-secondary)' }}>{target.agentStyle} · fiducia {target.agentTrust}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{target.roleExpectation}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.68rem' }}>
                      <strong>{target.daysLeft} giorni</strong>
                      <span style={{ color: rivalHot ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                        {target.rivalClub ? `${target.rivalClub} ${target.rivalPressure}/100` : 'Nessun rivale'}
                      </span>
                      <span style={{ color: target.rumorLevel && target.rumorLevel > 55 ? 'var(--color-gold)' : 'var(--text-muted)' }}>Rumor {target.rumorLevel}/100</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '60px', height: '4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '2px' }}>
                        <div style={{ width: `${target.probability}%`, height: '100%', borderRadius: '2px', backgroundColor: target.probability >= 75 ? 'var(--color-pitch)' : target.probability >= 50 ? 'var(--color-gold)' : 'var(--color-danger)' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{target.probability}%</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(target.value)}</td>
                  <td>{formatCurrency(target.wage)}/sett</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleStartBid(target)}
                      className="btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    >
                      <Send size={12} fill="#042F1A" />
                      Avvia Trattativa
                    </button>
                  </td>
                </tr>
                );
              })}
              {filteredTargets.filter(t => t.status === 'pending').length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    Nessun obiettivo trovato corrispondente ai filtri.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Negotiation Send Modal */}
      <AnimatePresence>
        {biddingPlayer && (
          <div className="modal-backdrop">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              style={{ width: '560px' }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', color: 'var(--text-primary)' }}>
                Presenta Offerta per {biddingPlayer.playerName}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px', fontSize: '0.72rem' }}>
                <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Agente</span>
                  <strong style={{ display: 'block', marginTop: '3px' }}>{biddingPlayer.agentStyle} · fiducia {biddingPlayer.agentTrust}</strong>
                </div>
                <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Rivale/tempo</span>
                  <strong style={{ display: 'block', marginTop: '3px', color: biddingPlayer.rivalClub ? 'var(--color-gold)' : 'var(--text-primary)' }}>
                    {biddingPlayer.rivalClub ? `${biddingPlayer.rivalClub} ${biddingPlayer.rivalPressure}/100` : 'nessun rivale'} · {biddingPlayer.daysLeft}g
                  </strong>
                </div>
                <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Scout</span>
                  <strong style={{ display: 'block', marginTop: '3px' }}>{biddingPlayer.scoutLevel}/4 · fit {biddingPlayer.tacticalFit}/100</strong>
                </div>
                <div style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Richiesta ruolo</span>
                  <strong style={{ display: 'block', marginTop: '3px' }}>{biddingPlayer.roleExpectation}</strong>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Cifra di Trasferimento Offerta (€)
                  </label>
                  <input
                    type="number"
                    value={bidFee}
                    onChange={e => setBidFee(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Valore di mercato: {formatCurrency(biddingPlayer.value)}
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Stipendio Settimanale Proposto (€)
                  </label>
                  <input
                    type="number"
                    value={bidWage}
                    onChange={e => setBidWage(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Stipendio attuale: {formatCurrency(biddingPlayer.wage)}/sett
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Bonus Obiettivi
                    </label>
                    <input
                      type="number"
                      value={bidBonus}
                      onChange={e => setBidBonus(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Commissione Agente
                    </label>
                    <input
                      type="number"
                      value={agentFee}
                      onChange={e => setAgentFee(e.target.value)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Clausola proposta
                    </label>
                    <select
                      value={dealStructure}
                      onChange={e => setDealStructure(e.target.value as TransferClauseType)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="none">Nessuna</option>
                      <option value="goalBonus">Bonus gol/presenze</option>
                      <option value="loanObligation">Prestito con obbligo</option>
                      <option value="buyback">Diritto di recompra</option>
                      <option value="sellOn">Percentuale rivendita</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Promessa al giocatore
                    </label>
                    <select
                      value={promiseType}
                      onChange={e => setPromiseType(e.target.value as ContractPromiseType)}
                      style={{
                        width: '100%',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px',
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="none">Nessuna promessa</option>
                      <option value="rotation">Rotazione importante</option>
                      <option value="starter">Titolare</option>
                      <option value="youngProject">Progetto giovane</option>
                      <option value="starRole">Stella centrale</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Durata Contratto (Anni)
                  </label>
                  <select
                    value={bidYears}
                    onChange={e => setBidYears(Number(e.target.value))}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value={2}>2 Anni</option>
                    <option value={3}>3 Anni (Standard)</option>
                    <option value={4}>4 Anni</option>
                    <option value={5}>5 Anni (Lungo termine)</option>
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Percentuale futura rivendita</span>
                    <strong style={{ color: 'var(--color-lime)' }}>{sellOn}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={sellOn}
                    onChange={e => setSellOn(Number(e.target.value))}
                    className="tactic-slider"
                  />
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                    Costo immediato: {formatCurrency((dealStructure === 'loanObligation' ? Math.round((Number(bidFee) || 0) * 0.35) : (Number(bidFee) || 0)) + (Number(agentFee) || 0))}
                  </span>
                </div>

                {marketDecisionPreview.length > 0 && (
                  <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.28)', padding: '12px' }}>
                    <h4 style={{ fontSize: '0.78rem', fontWeight: 850, marginBottom: '8px', color: 'var(--color-gold)' }}>
                      Costi della scelta
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {marketDecisionPreview.map(item => {
                        const toneColor =
                          item.tone === 'positive' ? 'var(--color-pitch)' :
                          item.tone === 'critical' ? 'var(--color-danger)' :
                          item.tone === 'warning' ? 'var(--color-gold)' :
                          'var(--text-secondary)';
                        return (
                          <div key={`${item.label}-${item.cost}`} style={{ borderLeft: `3px solid ${toneColor}`, paddingLeft: '9px' }}>
                            <strong style={{ display: 'block', fontSize: '0.72rem', color: toneColor }}>{item.label}</strong>
                            <p style={{ fontSize: '0.66rem', lineHeight: 1.35, color: 'var(--text-secondary)', marginTop: '3px' }}>
                              Vantaggio: {item.benefit}
                            </p>
                            <p style={{ fontSize: '0.66rem', lineHeight: 1.35, color: 'var(--text-muted)', marginTop: '2px' }}>
                              Costo: {item.cost}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: '8px' }}>
                  <button
                    disabled={isSimulatingDeal}
                    onClick={() => setBiddingPlayer(null)}
                    className="btn-secondary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Annulla
                  </button>
                  <button
                    disabled={isSimulatingDeal}
                    onClick={handleSendOffer}
                    className="btn-primary"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    {isSimulatingDeal ? (
                      <>
                        <RotateCw size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                        Negoziazione...
                      </>
                    ) : (
                      <>
                        <Send size={14} fill="#042F1A" />
                        Invia Offerta
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Simple style animation injection for spin */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

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
