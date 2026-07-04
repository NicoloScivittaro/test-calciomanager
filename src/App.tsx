import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Layout
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import TeamSelection from './components/setup/TeamSelection';

// Pages
import Dashboard from './components/dashboard/Dashboard';
import Squad from './components/squad/Squad';
import Tactics from './components/tactics/Tactics';
import Market from './components/market/Market';
import Matches from './components/matches/Matches';
import MatchCenter from './components/matches/MatchCenter';
import ClubHistory from './components/history/ClubHistory';

// Serie A Data & Helpers
import {
  CLUB_PROFILES,
  DATA_VERSION,
  DEFAULT_CLUB_PROFILE,
  MANAGER_NAME,
  generateCalendar,
  calculateInitialStandings,
  SCOUTED_TARGETS,
  createPlayersForClub,
  createInitialNews,
  getClubById
} from './data/serieAData';
import { Player, Tactic, Match, Standing, Negotiation, NewsItem, ClubProfile, ClubAIState, IncomingTransferOffer, ClubHistoryState, ClubMemoryDraft, TeamDNAState, RivalTacticalMemory, SeasonNarrativeState, PlayerSeasonStat } from './types';
import { createInitialClubWorld } from './utils/clubAI';
import { appendClubMemory, createInitialClubHistory, normalizeClubHistory } from './utils/clubHistory';
import { ensurePlayerPersonalities } from './utils/playerPersonality';
import { createInitialRivalMemories, normalizeRivalMemories } from './utils/rivalAI';
import { createInitialSeasonNarrative, isDecisionWorthyArc, normalizeSeasonNarrative, resolveNarrativeArcChoice } from './utils/seasonNarrative';
import { createInitialPlayerSeasonStats, normalizePlayerSeasonStats, syncPlayerSeasonStatsRosters } from './utils/playerSeasonStats';
import { selectBestLineupForModule } from './utils/squadSelection';
import { createInitialTeamDNA, evolveTeamDNAFromTactic, evolveTeamDNAFromTransfer, getDNAMarketAdjustment, normalizeTeamDNA } from './utils/teamDNA';

const createDefaultStarters = (players: Player[]) => {
  return selectBestLineupForModule(players, '4-3-3').starters;
};

const createDefaultBench = (players: Player[], starters: string[]) => players.map(p => p.id).filter(id => !starters.includes(id));

const createDefaultTactic = (players: Player[]): Tactic => {
  const starters = createDefaultStarters(players);
  return {
    module: '4-3-3',
    mentality: 'Bilanciata',
    pressing: 60,
    tempo: 50,
    width: 55,
    buildUp: 'Mista',
    defensiveLine: 55,
    riskLevel: 50,
    chanceCreation: 'Passaggi Filtranti',
    marking: 'Zona',
    transition: 'Riaggressione',
    attackingFocus: 'Equilibrato',
    principles: ['deepPlaymaker'],
    gamePlan: {
      whenLeading: 'Equilibrio',
      whenTrailing: 'Spingi',
      whenRedCard: 'Compatto'
    },
    familiarity: 35,
    styleSignature: '4-3-3|Bilanciata|Mista|Equilibrato|Riaggressione|deepPlaymaker',
    lineupCore: starters.slice(0, 8),
    starters,
    bench: createDefaultBench(players, starters)
  };
};

const getTacticSignature = (tactic: Tactic) => [
  tactic.module,
  tactic.mentality,
  tactic.buildUp,
  tactic.attackingFocus,
  tactic.transition,
  tactic.chanceCreation,
  tactic.marking,
  [...(tactic.principles ?? [])].sort().join('+')
].join('|');

const normalizeTactic = (tactic: Tactic, fallback: Tactic): Tactic => {
  const fallbackGamePlan = fallback.gamePlan ?? {
    whenLeading: 'Equilibrio',
    whenTrailing: 'Spingi',
    whenRedCard: 'Compatto'
  };

  return {
    ...fallback,
    ...tactic,
    principles: tactic.principles ?? fallback.principles,
    gamePlan: {
      whenLeading: tactic.gamePlan?.whenLeading ?? fallbackGamePlan.whenLeading,
      whenTrailing: tactic.gamePlan?.whenTrailing ?? fallbackGamePlan.whenTrailing,
      whenRedCard: tactic.gamePlan?.whenRedCard ?? fallbackGamePlan.whenRedCard
    },
    familiarity: tactic.familiarity ?? fallback.familiarity ?? 35,
    styleSignature: tactic.styleSignature ?? getTacticSignature(tactic),
    lineupCore: tactic.lineupCore ?? tactic.starters?.slice(0, 8) ?? fallback.lineupCore
  };
};

const CAREER_STORAGE_KEYS = [
  'cm_players',
  'cm_budget',
  'cm_calendar',
  'cm_standings',
  'cm_targets',
  'cm_news',
  'cm_starters',
  'cm_bench',
  'cm_tactic',
  'cm_club_world',
  'cm_player_stats',
  'cm_incoming_offers',
  'cm_club_history',
  'cm_team_dna',
  'cm_rival_memories',
  'cm_season_narrative',
  'cm_selected_club',
  'cm_data_version'
];

export default function App() {
  const [selectedClub, setSelectedClub] = useState<ClubProfile | null>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return null;

      const storedClubId = localStorage.getItem('cm_selected_club');
      return storedClubId ? getClubById(storedClubId) ?? null : null;
    } catch {
      return null;
    }
  });
  const activeClub = selectedClub ?? DEFAULT_CLUB_PROFILE;
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Core States (Loaded synchronously using lazy initializers to prevent blank renders)
  const [players, setPlayers] = useState<Player[]>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return createPlayersForClub(activeClub);

      const stored = localStorage.getItem('cm_players');
      return stored ? JSON.parse(stored) : createPlayersForClub(activeClub);
    } catch {
      return createPlayersForClub(activeClub);
    }
  });

  const [budget, setBudget] = useState<number>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return activeClub.transferBudget;

      const stored = localStorage.getItem('cm_budget');
      return stored ? Number(stored) : activeClub.transferBudget;
    } catch {
      return activeClub.transferBudget;
    }
  });

  const [calendar, setCalendar] = useState<Match[]>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return generateCalendar(activeClub.name);

      const stored = localStorage.getItem('cm_calendar');
      return stored ? JSON.parse(stored) : generateCalendar(activeClub.name);
    } catch {
      return generateCalendar(activeClub.name);
    }
  });

  const [standings, setStandings] = useState<Standing[]>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return calculateInitialStandings();

      const stored = localStorage.getItem('cm_standings');
      if (stored) return JSON.parse(stored);
      return calculateInitialStandings();
    } catch {
      return calculateInitialStandings();
    }
  });

  const [scoutedTargets, setScoutedTargets] = useState<Negotiation[]>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return SCOUTED_TARGETS;

      const stored = localStorage.getItem('cm_targets');
      return stored ? JSON.parse(stored) : SCOUTED_TARGETS;
    } catch {
      return SCOUTED_TARGETS;
    }
  });

  const [news, setNews] = useState<NewsItem[]>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return createInitialNews(activeClub);

      const stored = localStorage.getItem('cm_news');
      return stored ? JSON.parse(stored) : createInitialNews(activeClub);
    } catch {
      return createInitialNews(activeClub);
    }
  });

  const [starters, setStarters] = useState<string[]>(() => {
    try {
      const defaultPlayers = createPlayersForClub(activeClub);
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return createDefaultStarters(defaultPlayers);

      const stored = localStorage.getItem('cm_starters');
      return stored ? JSON.parse(stored) : createDefaultStarters(defaultPlayers);
    } catch {
      return createDefaultStarters(createPlayersForClub(activeClub));
    }
  });

  const [bench, setBench] = useState<string[]>(() => {
    try {
      const defaultPlayers = createPlayersForClub(activeClub);
      const defaultStarters = createDefaultStarters(defaultPlayers);
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return createDefaultBench(defaultPlayers, defaultStarters);

      const stored = localStorage.getItem('cm_bench');
      if (stored) return JSON.parse(stored);
      
      return createDefaultBench(defaultPlayers, defaultStarters);
    } catch {
      const defaultPlayers = createPlayersForClub(activeClub);
      return createDefaultBench(defaultPlayers, createDefaultStarters(defaultPlayers));
    }
  });

  const [tactic, setTactic] = useState<Tactic>(() => {
    const defaultTactic = createDefaultTactic(createPlayersForClub(activeClub));
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return defaultTactic;

      const stored = localStorage.getItem('cm_tactic');
      return stored ? normalizeTactic(JSON.parse(stored), defaultTactic) : defaultTactic;
    } catch {
      return defaultTactic;
    }
  });

  const [clubWorld, setClubWorld] = useState<ClubAIState[]>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return createInitialClubWorld();

      const stored = localStorage.getItem('cm_club_world');
      return stored ? JSON.parse(stored) : createInitialClubWorld();
    } catch {
      return createInitialClubWorld();
    }
  });

  const [playerStats, setPlayerStats] = useState<PlayerSeasonStat[]>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      const baseWorld = createInitialClubWorld();
      if (storedVersion !== DATA_VERSION) return createInitialPlayerSeasonStats(activeClub.name, players, baseWorld);

      const stored = localStorage.getItem('cm_player_stats');
      return stored
        ? normalizePlayerSeasonStats(JSON.parse(stored), activeClub.name, players, clubWorld)
        : createInitialPlayerSeasonStats(activeClub.name, players, clubWorld);
    } catch {
      return createInitialPlayerSeasonStats(activeClub.name, players, clubWorld);
    }
  });

  const [incomingOffers, setIncomingOffers] = useState<IncomingTransferOffer[]>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return [];

      const stored = localStorage.getItem('cm_incoming_offers');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [clubHistory, setClubHistory] = useState<ClubHistoryState>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return createInitialClubHistory(activeClub, MANAGER_NAME, createPlayersForClub(activeClub));

      const stored = localStorage.getItem('cm_club_history');
      return stored ? normalizeClubHistory(JSON.parse(stored)) : createInitialClubHistory(activeClub, MANAGER_NAME, createPlayersForClub(activeClub));
    } catch {
      return createInitialClubHistory(activeClub, MANAGER_NAME, createPlayersForClub(activeClub));
    }
  });

  const [teamDNA, setTeamDNA] = useState<TeamDNAState>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      const basePlayers = createPlayersForClub(activeClub);
      if (storedVersion !== DATA_VERSION) return createInitialTeamDNA(activeClub, basePlayers, createDefaultTactic(basePlayers));

      const stored = localStorage.getItem('cm_team_dna');
      return stored
        ? normalizeTeamDNA(JSON.parse(stored), activeClub, basePlayers, tactic)
        : createInitialTeamDNA(activeClub, basePlayers, tactic);
    } catch {
      const basePlayers = createPlayersForClub(activeClub);
      return createInitialTeamDNA(activeClub, basePlayers, createDefaultTactic(basePlayers));
    }
  });

  const [rivalMemories, setRivalMemories] = useState<RivalTacticalMemory[]>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return createInitialRivalMemories(activeClub.name);

      const stored = localStorage.getItem('cm_rival_memories');
      return stored
        ? normalizeRivalMemories(JSON.parse(stored), activeClub.name)
        : createInitialRivalMemories(activeClub.name);
    } catch {
      return createInitialRivalMemories(activeClub.name);
    }
  });

  const [seasonNarrative, setSeasonNarrative] = useState<SeasonNarrativeState>(() => {
    try {
      const storedVersion = localStorage.getItem('cm_data_version');
      if (storedVersion !== DATA_VERSION) return createInitialSeasonNarrative(activeClub, teamDNA);

      const stored = localStorage.getItem('cm_season_narrative');
      return stored
        ? normalizeSeasonNarrative(JSON.parse(stored), activeClub, teamDNA)
        : createInitialSeasonNarrative(activeClub, teamDNA);
    } catch {
      return createInitialSeasonNarrative(activeClub, teamDNA);
    }
  });

  // Save states to localStorage on change
  useEffect(() => {
    if (selectedClub) {
      localStorage.setItem('cm_data_version', DATA_VERSION);
      localStorage.setItem('cm_selected_club', selectedClub.id);
    }
  }, [selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    if (players.length > 0) localStorage.setItem('cm_players', JSON.stringify(players));
  }, [players, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    localStorage.setItem('cm_budget', budget.toString());
  }, [budget, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    if (calendar.length > 0) localStorage.setItem('cm_calendar', JSON.stringify(calendar));
  }, [calendar, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    if (standings.length > 0) localStorage.setItem('cm_standings', JSON.stringify(standings));
  }, [standings, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    if (scoutedTargets.length > 0) localStorage.setItem('cm_targets', JSON.stringify(scoutedTargets));
  }, [scoutedTargets, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    if (news.length > 0) localStorage.setItem('cm_news', JSON.stringify(news));
  }, [news, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    if (tactic) localStorage.setItem('cm_tactic', JSON.stringify(tactic));
  }, [tactic, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    if (starters.length > 0) localStorage.setItem('cm_starters', JSON.stringify(starters));
  }, [starters, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    if (bench.length > 0) localStorage.setItem('cm_bench', JSON.stringify(bench));
  }, [bench, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    if (clubWorld.length > 0) localStorage.setItem('cm_club_world', JSON.stringify(clubWorld));
  }, [clubWorld, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    if (playerStats.length > 0) localStorage.setItem('cm_player_stats', JSON.stringify(playerStats));
  }, [playerStats, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    const syncedStats = syncPlayerSeasonStatsRosters(playerStats, selectedClub.name, players, clubWorld);
    if (syncedStats !== playerStats) setPlayerStats(syncedStats);
  }, [clubWorld, playerStats, players, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    localStorage.setItem('cm_incoming_offers', JSON.stringify(incomingOffers));
  }, [incomingOffers, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    localStorage.setItem('cm_club_history', JSON.stringify(clubHistory));
  }, [clubHistory, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    localStorage.setItem('cm_team_dna', JSON.stringify(teamDNA));
  }, [teamDNA, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    localStorage.setItem('cm_rival_memories', JSON.stringify(rivalMemories));
  }, [rivalMemories, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    localStorage.setItem('cm_season_narrative', JSON.stringify(seasonNarrative));
  }, [seasonNarrative, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    setClubWorld(current => current.map(club => (
      club.name === selectedClub.name
        ? { ...club, roster: players, budget }
        : club
    )));
  }, [budget, players, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    const normalizedPlayers = ensurePlayerPersonalities(players, selectedClub.name);
    if (normalizedPlayers !== players) setPlayers(normalizedPlayers);
  }, [players, selectedClub]);

  useEffect(() => {
    if (!selectedClub) return;
    let changed = false;
    const normalizedWorld = clubWorld.map(club => {
      const roster = ensurePlayerPersonalities(club.roster, club.name);
      if (roster !== club.roster) changed = true;
      return roster === club.roster ? club : { ...club, roster };
    });
    if (changed) setClubWorld(normalizedWorld);
  }, [clubWorld, selectedClub]);

  // Actions
  const handleStartCareer = (club: ClubProfile) => {
    CAREER_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));

    const freshPlayers = createPlayersForClub(club);
    const freshCalendar = generateCalendar(club.name);
    const freshStandings = calculateInitialStandings();
    const freshStarters = createDefaultStarters(freshPlayers);
    const freshBench = createDefaultBench(freshPlayers, freshStarters);
    const freshTactic = createDefaultTactic(freshPlayers);
    const freshDNA = createInitialTeamDNA(club, freshPlayers, freshTactic);

    localStorage.setItem('cm_data_version', DATA_VERSION);
    localStorage.setItem('cm_selected_club', club.id);
    setSelectedClub(club);
    setCurrentTab('dashboard');
    setPlayers(freshPlayers);
    setBudget(club.transferBudget);
    setCalendar(freshCalendar);
    setStandings(freshStandings);
    setScoutedTargets(SCOUTED_TARGETS);
    setNews(createInitialNews(club));
    setStarters(freshStarters);
    setBench(freshBench);
    setTactic(freshTactic);
    const freshWorld = createInitialClubWorld();
    setClubWorld(freshWorld);
    setPlayerStats(createInitialPlayerSeasonStats(club.name, freshPlayers, freshWorld));
    setIncomingOffers([]);
    setClubHistory(createInitialClubHistory(club, MANAGER_NAME, freshPlayers));
    setTeamDNA(freshDNA);
    setRivalMemories(createInitialRivalMemories(club.name));
    setSeasonNarrative(createInitialSeasonNarrative(club, freshDNA));
  };

  const handleRestartCareer = () => {
    const confirmed = window.confirm('Vuoi davvero ricominciare la carriera? Tornerai alla scelta squadra e i dati attuali verranno cancellati.');
    if (!confirmed) return;

    CAREER_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
    setSelectedClub(null);
    setCurrentTab('dashboard');
    setPlayers(createPlayersForClub(DEFAULT_CLUB_PROFILE));
    setBudget(DEFAULT_CLUB_PROFILE.transferBudget);
    setCalendar(generateCalendar(DEFAULT_CLUB_PROFILE.name));
    setStandings(calculateInitialStandings());
    setScoutedTargets(SCOUTED_TARGETS);
    setNews(createInitialNews(DEFAULT_CLUB_PROFILE));
    const defaultPlayers = createPlayersForClub(DEFAULT_CLUB_PROFILE);
    const defaultStarters = createDefaultStarters(defaultPlayers);
    const defaultTactic = createDefaultTactic(defaultPlayers);
    const defaultDNA = createInitialTeamDNA(DEFAULT_CLUB_PROFILE, defaultPlayers, defaultTactic);
    setStarters(defaultStarters);
    setBench(createDefaultBench(defaultPlayers, defaultStarters));
    setTactic(defaultTactic);
    const defaultWorld = createInitialClubWorld();
    setClubWorld(defaultWorld);
    setPlayerStats(createInitialPlayerSeasonStats(DEFAULT_CLUB_PROFILE.name, defaultPlayers, defaultWorld));
    setIncomingOffers([]);
    setClubHistory(createInitialClubHistory(DEFAULT_CLUB_PROFILE, MANAGER_NAME, defaultPlayers));
    setTeamDNA(defaultDNA);
    setRivalMemories(createInitialRivalMemories(DEFAULT_CLUB_PROFILE.name));
    setSeasonNarrative(createInitialSeasonNarrative(DEFAULT_CLUB_PROFILE, defaultDNA));
  };

  const handleUpdatePlayer = (updated: Player) => {
    setPlayers(players.map(p => p.id === updated.id ? updated : p));
  };

  const handleSaveTactic = (newTactic: Tactic) => {
    const fallback = createDefaultTactic(players);
    const normalized = normalizeTactic(newTactic, fallback);
    const signature = getTacticSignature(normalized);
    const previousCore = tactic.lineupCore ?? tactic.starters.slice(0, 8);
    const nextCore = normalized.starters.slice(0, 8);
    const coreOverlap = nextCore.filter(id => previousCore.includes(id)).length / Math.max(1, nextCore.length);
    const sameStyle = signature === tactic.styleSignature;
    const familiarityDelta = sameStyle && coreOverlap >= 0.62 ? 5 : sameStyle ? 2 : -8;
    const enriched = {
      ...normalized,
      styleSignature: signature,
      lineupCore: nextCore,
      familiarity: Math.max(15, Math.min(100, (tactic.familiarity ?? 35) + familiarityDelta))
    };

    setTactic(enriched);
    setTeamDNA(current => evolveTeamDNAFromTactic(current, enriched, players));
  };

  const handleMarkNewsAsRead = (id: string) => {
    setNews(news.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleAddNewNews = (title: string, content: string, category: NewsItem['category']) => {
    const item: NewsItem = {
      id: `news_${Date.now()}`,
      date: 'Oggi',
      title,
      content,
      category,
      read: false
    };
    setNews(current => [item, ...current]);
  };

  const handleAddClubMemory = (memory: ClubMemoryDraft) => {
    setClubHistory(current => appendClubMemory(current, memory));
  };

  const handleResolveNarrativeArc = (arcId: string, choiceId: string) => {
    const resolution = resolveNarrativeArcChoice(seasonNarrative, {
      arcId,
      choiceId,
      players,
      budget
    });

    setSeasonNarrative(resolution.narrative);
    setPlayers(resolution.players);
    setBudget(Math.max(0, budget + resolution.budgetDelta));
    resolution.memories.forEach(handleAddClubMemory);
    resolution.news.forEach(item => handleAddNewNews(item.title, item.content, item.category));
  };

  const handleTransferDNAEvent = (player: Player, type: 'buy' | 'sell', fee: number) => {
    setTeamDNA(current => evolveTeamDNAFromTransfer(current, player, type, fee));
  };

  const handleCreateTransferTarget = (player: Player, clubName: string) => {
    if (clubName === activeClub.name) return;

    const alreadyTracked = scoutedTargets.some(target => (
      target.status === 'pending'
      && target.playerName === player.name
      && target.currentClub === clubName
    ));

    if (!alreadyTracked) {
      const premium =
        player.overall >= 86 ? 1.32 :
        player.overall >= 82 ? 1.22 :
        player.age <= 22 ? 1.18 :
        1.1;
      const dnaMarket = getDNAMarketAdjustment(player, teamDNA);
      const targetValue = Math.round(player.value * premium * dnaMarket.costMultiplier / 100000) * 100000;
      const probability =
        player.overall >= 86 ? 24 :
        player.overall >= 82 ? 36 :
        player.overall >= 78 ? 52 :
        66;
      const target: Negotiation = {
        id: `direct_${clubName.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}_${player.id}_${Date.now()}`,
        playerName: player.name,
        role: player.role,
        currentClub: clubName,
        value: targetValue,
        wage: player.wage,
        offeredFee: 0,
        offeredWage: 0,
        offeredContractYears: 0,
        probability: Math.max(8, Math.min(88, probability + dnaMarket.probabilityBonus)),
        status: 'pending',
        timeline: [
          `${player.name} osservato nella rosa del ${clubName}.`,
          `DNA club: ${dnaMarket.note}`,
          `Trattativa diretta aperta: offerta iniziale consigliata almeno vicina a ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(targetValue)}.`
        ]
      };
      setScoutedTargets([target, ...scoutedTargets]);
    }

    setCurrentTab('market');
  };

  if (!selectedClub) {
    return (
      <TeamSelection
        clubs={CLUB_PROFILES}
        managerName={MANAGER_NAME}
        onSelect={handleStartCareer}
      />
    );
  }

  const nextMatch = calendar.find(m => m.status === 'next') || { date: 'Non definita' };
  const currentRound = 'id' in nextMatch && typeof nextMatch.id === 'string'
    ? Number(nextMatch.id.split('_')[1]) || 1
    : 1;
  const activeDecisionCount = (seasonNarrative.arcs ?? []).filter(isDecisionWorthyArc).length;

  return (
    <div className="app-container">
      {/* Sidebar Nav */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        coachName={MANAGER_NAME}
        teamName={activeClub.name}
        onRestartCareer={handleRestartCareer}
      />

      {/* Main Container */}
      <main className="main-content">
        {/* Topbar Info deck */}
        <Topbar
          currentTab={currentTab}
          budget={budget}
          currentMatchDate={nextMatch.date}
          news={news}
          markNewsAsRead={handleMarkNewsAsRead}
          activeDecisionCount={activeDecisionCount}
        />

        {/* Dynamic Page Views */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            {currentTab === 'dashboard' && (
              <Dashboard
                players={players}
                calendar={calendar}
                standings={standings}
                news={news}
                teamName={activeClub.name}
                clubProfile={activeClub}
                onNavigate={setCurrentTab}
                clubWorld={clubWorld}
                onCreateTransferTarget={handleCreateTransferTarget}
                seasonNarrative={seasonNarrative}
                clubHistory={clubHistory}
                onResolveNarrativeArc={handleResolveNarrativeArc}
                budget={budget}
                tactic={tactic}
                teamDNA={teamDNA}
                starters={starters}
              />
            )}

            {currentTab === 'squad' && (
              <Squad
                players={players}
                updatePlayer={handleUpdatePlayer}
                starters={starters}
                setStarters={setStarters}
                bench={bench}
                setBench={setBench}
                setPlayers={setPlayers}
                playerStats={playerStats}
                clubHistory={clubHistory}
                currentRound={currentRound}
              />
            )}

            {currentTab === 'tactics' && tactic && (
              <Tactics
                players={players}
                tactic={tactic}
                saveTactic={handleSaveTactic}
                starters={starters}
                setStarters={setStarters}
                bench={bench}
                setBench={setBench}
                teamDNA={teamDNA}
              />
            )}

            {currentTab === 'market' && (
              <Market
                scoutedTargets={scoutedTargets}
                setScoutedTargets={setScoutedTargets}
                budget={budget}
                setBudget={setBudget}
                players={players}
                setPlayers={setPlayers}
                starters={starters}
                bench={bench}
                setStarters={setStarters}
                setBench={setBench}
                teamName={activeClub.name}
                addNewNews={handleAddNewNews}
                addClubMemory={handleAddClubMemory}
                teamDNA={teamDNA}
                onTransferDNAEvent={handleTransferDNAEvent}
                clubWorld={clubWorld}
                setClubWorld={setClubWorld}
                incomingOffers={incomingOffers}
                setIncomingOffers={setIncomingOffers}
                playerStats={playerStats}
                clubHistory={clubHistory}
                currentRound={currentRound}
              />
            )}

            {currentTab === 'matches' && (
              <Matches
                calendar={calendar}
                standings={standings}
                players={players}
                teamName={activeClub.name}
                clubWorld={clubWorld}
                playerStats={playerStats}
                onCreateTransferTarget={handleCreateTransferTarget}
                onNavigate={setCurrentTab}
              />
            )}

            {currentTab === 'history' && (
              <ClubHistory
                history={clubHistory}
                teamName={activeClub.name}
                clubProfile={activeClub}
                players={players}
                teamDNA={teamDNA}
                seasonNarrative={seasonNarrative}
                standings={standings}
              />
            )}

            {currentTab === 'matchcenter' && (
              <MatchCenter
                players={players}
                calendar={calendar}
                setCalendar={setCalendar}
                standings={standings}
                setStandings={setStandings}
                budget={budget}
                setBudget={setBudget}
                setPlayers={setPlayers}
                onNavigate={setCurrentTab}
                addNewNews={handleAddNewNews}
                addClubMemory={handleAddClubMemory}
                teamDNA={teamDNA}
                setTeamDNA={setTeamDNA}
                starters={starters}
                bench={bench}
                setStarters={setStarters}
                setBench={setBench}
                tactic={tactic}
                saveTactic={handleSaveTactic}
                teamName={activeClub.name}
                clubWorld={clubWorld}
                setClubWorld={setClubWorld}
                playerStats={playerStats}
                setPlayerStats={setPlayerStats}
                rivalMemories={rivalMemories}
                setRivalMemories={setRivalMemories}
                seasonNarrative={seasonNarrative}
                setSeasonNarrative={setSeasonNarrative}
                clubHistory={clubHistory}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
