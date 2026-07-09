import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, TrendingUp, Award, Activity, Heart, ArrowRight, BookOpen, AlertCircle, Calendar, Users, Landmark, ShieldAlert, ShieldCheck, Stethoscope, GraduationCap, Building2, FileSignature } from 'lucide-react';
import { ClubAIState, Player, Match, Standing, NewsItem, ClubProfile, SeasonNarrativeState, ClubHistoryState, Tactic, TeamDNAState, EmotionalNarrativeState, CareerWorldState, PlayerSeasonStat, PlayerConversationState, LeagueSystemState, ClubStaffRole, FacilityType, Negotiation } from '../../types';
import { getActiveTransferWindow } from '../../utils/transferDeals';
import TeamLogo from '../common/TeamLogo';
import { getClubByName } from '../../data/serieAData';
import ClubInfoModal from '../common/ClubInfoModal';
import { isDecisionWorthyArc, SEASON_CHAPTERS } from '../../utils/seasonNarrative';
import { buildClubStaff, CLUB_STAFF_ROLE_LABELS, getClubStaffModifiers, getClubStaffSummary, getStaffAdvisories } from '../../utils/staff';
import ClubStaffModal from '../common/ClubStaffModal';
import { getClubFacilitiesSummary } from '../../utils/facilities';
import ClubFacilitiesModal from '../common/ClubFacilitiesModal';
import { calculateClubWageBudget, getWageBudgetStatusLabel } from '../../utils/playerContracts';
import { getYouthAcademySummary, getYouthPotentialLabel } from '../../utils/youthAcademy';
import YouthAcademyModal from '../common/YouthAcademyModal';
import { getTopEmotionalNarratives, NARRATIVE_TYPE_LABELS } from '../../utils/emotionalNarratives';
import { getMoodLabel, PLAYER_FAN_STATUS_LABELS } from '../../utils/careerWorld';
import { derivePromotionRelegationContext, getClubMovement, OBJECTIVE_LABELS } from '../../utils/leagueSystem';
import { RIVALRY_STATUS_LABELS } from '../../utils/clubHistory';
import { getPlayerProjectRole } from '../../utils/playerProjectRole';
import { getPlayerAvailabilitySummary } from '../../utils/playerFitness';
import { getDevelopmentSummary, getRoleFamiliarityEntry, ROLE_FAMILIARITY_STATUS_LABELS, TRAINING_PLAN_STATUS_LABELS } from '../../utils/playerDevelopment';
import PressConferenceModal from '../common/PressConferenceModal';

interface DashboardProps {
  players: Player[];
  calendar: Match[];
  standings: Standing[];
  news: NewsItem[];
  teamName: string;
  clubProfile: ClubProfile;
  onNavigate: (tab: string) => void;
  clubWorld: ClubAIState[];
  onCreateTransferTarget: (player: Player, clubName: string) => void;
  seasonNarrative: SeasonNarrativeState;
  clubHistory: ClubHistoryState;
  onResolveNarrativeArc: (arcId: string, choiceId: string) => void;
  budget: number;
  tactic: Tactic | null;
  teamDNA: TeamDNAState;
  starters: string[];
  emotionalNarratives: EmotionalNarrativeState;
  careerWorld: CareerWorldState;
  playerStats: PlayerSeasonStat[];
  currentRound: number;
  playerConversations: PlayerConversationState;
  onResolvePressConference: (optionId: string) => void;
  leagueSystem: LeagueSystemState | null;
  onHireClubStaff: (role: ClubStaffRole, candidateId: string) => void;
  onUpgradeFacility: (type: FacilityType) => void;
  onPromoteYouthPlayer: (player: Player) => void;
  onReleaseYouthPlayer: (player: Player) => void;
  scoutedTargets: Negotiation[];
}

const ZONE_LABELS_BY_DIVISION: Record<'serie_a' | 'serie_b', (rank: number) => string> = {
  serie_a: rank => (rank >= 18 ? 'Zona retrocessione' : 'Salvezza tranquilla'),
  serie_b: rank => (
    rank <= 2 ? 'Zona promozione diretta' :
    rank <= 8 ? 'Zona playoff' :
    rank <= 15 ? 'Salvezza' :
    rank <= 17 ? 'Zona playout' :
    'Zona retrocessione diretta'
  ),
};

export default function Dashboard({ players, calendar, standings, news, teamName, clubProfile, onNavigate, clubWorld, onCreateTransferTarget, seasonNarrative, clubHistory, onResolveNarrativeArc, budget, tactic, teamDNA, starters, emotionalNarratives, careerWorld, playerStats, currentRound, playerConversations, onResolvePressConference, leagueSystem, onHireClubStaff, onUpgradeFacility, onPromoteYouthPlayer, onReleaseYouthPlayer, scoutedTargets }: DashboardProps) {
  const [selectedClubInfo, setSelectedClubInfo] = useState<ClubProfile | null>(null);
  const [showPressConference, setShowPressConference] = useState(false);
  const [showClubStaffModal, setShowClubStaffModal] = useState(false);
  const [showClubFacilitiesModal, setShowClubFacilitiesModal] = useState(false);
  const [showYouthAcademyModal, setShowYouthAcademyModal] = useState(false);
  const clubStaffModifiers = getClubStaffModifiers(careerWorld.clubStaffState);
  const clubStaffSummary = getClubStaffSummary(careerWorld.clubStaffState);
  const clubFacilitiesSummary = getClubFacilitiesSummary(careerWorld.clubFacilitiesState, currentRound);
  const wageBudget = calculateClubWageBudget(players, clubProfile, careerWorld.clubWageBudgetState.season, careerWorld.clubWageBudgetState);
  const wageBudgetStatus = getWageBudgetStatusLabel(wageBudget);
  const youthAcademySummary = getYouthAcademySummary(players, careerWorld.youthAcademyState, careerWorld.clubFacilitiesState);

  // Find next match
  const nextMatch = calendar.find(m => m.status === 'next') || calendar[0];
  
  // Find selected club standing details
  const myStanding = standings.find(s => s.name === teamName) || { rank: 4, points: 22, form: ['W', 'D', 'W', 'W', 'L'] };
  const userDivision = leagueSystem ? (leagueSystem.clubCompetitionMap[clubProfile.id] ?? 'serie_a') : 'serie_a';
  const otherDivision = userDivision === 'serie_a' ? 'serie_b' : 'serie_a';
  const zoneLabel = ZONE_LABELS_BY_DIVISION[userDivision](myStanding.rank);
  const otherDivisionTopStandings = leagueSystem
    ? [...leagueSystem.competitions[otherDivision].standings].sort((a, b) => a.rank - b.rank).slice(0, 3)
    : [];
  // L1B: contesto promozione/retrocessione, derivato (mai un nuovo stato persistito) da
  // leagueSystem.seasonTransition, gia' salvato dentro leagueSystem.
  const clubMovement = leagueSystem ? getClubMovement(clubProfile.id, userDivision, leagueSystem.seasonTransition) : 'stayed_serie_a';
  const promotionRelegationContext = leagueSystem ? derivePromotionRelegationContext(clubProfile, clubMovement, leagueSystem.season) : null;
  const sportivoObjective = careerWorld.ownershipState.currentObjectives.find(o => o.category === 'sportivo');
  const justMoved = clubMovement === 'promoted_to_serie_a' || clubMovement === 'relegated_to_serie_b';
  const userIsHome = nextMatch?.isHome ?? true;
  const matchRound = nextMatch?.id ? nextMatch.id.split('_')[1] : '12';
  const homeTeam = userIsHome
    ? { club: clubProfile, name: teamName, initials: clubProfile.initials, isUser: true }
    : { club: getClubByName(nextMatch?.opponent ?? ''), name: nextMatch?.opponent ?? 'Avversario', initials: nextMatch?.opponentInitials ?? 'AV', isUser: false };
  const awayTeam = userIsHome
    ? { club: getClubByName(nextMatch?.opponent ?? ''), name: nextMatch?.opponent ?? 'Avversario', initials: nextMatch?.opponentInitials ?? 'AV', isUser: false }
    : { club: clubProfile, name: teamName, initials: clubProfile.initials, isUser: true };

  const teamButtonStyle: React.CSSProperties = {
    background: 'none',
    border: '1px solid transparent',
    color: 'inherit',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    padding: '8px',
    font: 'inherit'
  };

  const miniTeamButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    padding: 0,
    font: 'inherit',
    textAlign: 'left'
  };

  const openClubInfo = (club?: ClubProfile, name?: string) => {
    const resolvedClub = club ?? getClubByName(name ?? '');
    if (resolvedClub) setSelectedClubInfo(resolvedClub);
  };

  const handleClubKeyDown = (event: React.KeyboardEvent, club?: ClubProfile, name?: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openClubInfo(club, name);
  };

  // Calculate team morale & average overall
  const avgMorale = Math.round(players.reduce((sum, p) => sum + p.morale, 0) / players.length);
  const avgForm = (players.reduce((sum, p) => sum + p.form, 0) / players.length).toFixed(1);
  const currentChapter = SEASON_CHAPTERS[seasonNarrative.currentChapter];
  const chapterProgress = Math.round((seasonNarrative.triggeredChapters.length / Object.keys(SEASON_CHAPTERS).length) * 100);
  const stakeholderPulse = [...(clubHistory.stakeholders ?? [])]
    .sort((a, b) => {
      const aTension = (100 - a.mood) * 0.7 + a.influence * 0.3;
      const bTension = (100 - b.mood) * 0.7 + b.influence * 0.3;
      return bTension - aTension;
    })
    .slice(0, 5);
  const activeArcs = (seasonNarrative.arcs ?? [])
    .filter(isDecisionWorthyArc)
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 2);
  const topStories = getTopEmotionalNarratives(emotionalNarratives, 3);
  const sortedFanGroups = [...careerWorld.fanState.groups].sort((a, b) => b.mood - a.mood);
  const happiestFanGroup = sortedFanGroups[0];
  const mostCriticalFanGroup = sortedFanGroups[sortedFanGroups.length - 1];
  const OWNERSHIP_TYPE_LABELS: Record<CareerWorldState['ownershipState']['ownerType'], string> = {
    famiglia: 'Proprietà familiare',
    fondo: 'Fondo di investimento',
    magnate: 'Magnate straniero',
    azionariato: 'Azionariato diffuso',
    gruppo_industriale: 'Gruppo industriale'
  };
  const FINANCIAL_STATUS_LABELS: Record<CareerWorldState['ownershipState']['financialStatus'], string> = {
    solido: 'Solido',
    equilibrato: 'Equilibrato',
    in_tensione: 'In tensione',
    critico: 'Critico'
  };
  const financialStatusColor =
    careerWorld.ownershipState.financialStatus === 'solido' ? 'var(--color-pitch)' :
    careerWorld.ownershipState.financialStatus === 'equilibrato' ? 'var(--color-lime)' :
    careerWorld.ownershipState.financialStatus === 'in_tensione' ? 'var(--color-gold)' :
    'var(--color-danger)';
  const formatSignedChange = (value: number) => (value > 0 ? `+${value}` : `${value}`);
  const changeColor = (value: number) => (value > 0 ? 'var(--color-pitch)' : value < 0 ? 'var(--color-danger)' : 'var(--text-secondary)');
  const latestWorldEvent = careerWorld.activeEvents[0];
  const trendSymbol = (trend: 'positivo' | 'stabile' | 'negativo') => (trend === 'positivo' ? '▲' : trend === 'negativo' ? '▼' : '▬');
  const trendColor = (trend: 'positivo' | 'stabile' | 'negativo') => (trend === 'positivo' ? 'var(--color-pitch)' : trend === 'negativo' ? 'var(--color-danger)' : 'var(--text-secondary)');
  const boardTrend: 'positivo' | 'stabile' | 'negativo' = careerWorld.ownershipState.lastConfidenceChange > 0 ? 'positivo' : careerWorld.ownershipState.lastConfidenceChange < 0 ? 'negativo' : 'stabile';
  const OBJECTIVE_STATUS_LABELS: Record<CareerWorldState['ownershipState']['currentObjectives'][number]['status'], string> = {
    in_corso: 'In corso',
    positivo: 'Positivo',
    a_rischio: 'A rischio',
    completato: 'Completato',
    fallito: 'Fallito'
  };
  const objectiveStatusColor = (status: CareerWorldState['ownershipState']['currentObjectives'][number]['status']) => (
    status === 'completato' || status === 'positivo' ? 'var(--color-pitch)' :
    status === 'a_rischio' ? 'var(--color-gold)' :
    status === 'fallito' ? 'var(--color-danger)' :
    'var(--text-secondary)'
  );
  const mostImportantObjective = [...careerWorld.ownershipState.currentObjectives].sort((a, b) => b.importance - a.importance)[0];
  const mostLovedPlayers = careerWorld.fanState.mostLovedPlayerIds
    .map(id => ({ standing: careerWorld.fanState.playerStandings.find(s => s.playerId === id), player: players.find(p => p.id === id) }))
    .filter((entry): entry is { standing: NonNullable<typeof entry.standing>; player: Player } => Boolean(entry.standing && entry.player))
    .slice(0, 3);
  const mostCriticizedPlayers = careerWorld.fanState.mostCriticizedPlayerIds
    .map(id => ({ standing: careerWorld.fanState.playerStandings.find(s => s.playerId === id), player: players.find(p => p.id === id) }))
    .filter((entry): entry is { standing: NonNullable<typeof entry.standing>; player: Player } => Boolean(entry.standing && entry.player))
    .slice(0, 3);
  const latestTransferReaction = careerWorld.activeEvents.find(event => event.type === 'transfer_reaction');
  const hottestRivalries = [...clubHistory.rivalries].sort((a, b) => b.heat - a.heat).slice(0, 3);
  const rivalryHeatColor = (heat: number) => (heat >= 65 ? 'var(--color-danger)' : heat >= 45 ? 'var(--color-gold)' : 'var(--text-secondary)');
  const recentArticles = careerWorld.mediaState.articles.slice(0, 3);
  const pendingConference = careerWorld.mediaState.pendingConference;
  const pendingConferenceJournalist = pendingConference
    ? careerWorld.mediaState.journalists.find(j => j.id === pendingConference.journalistId)
    : undefined;
  const activeMarketRumors = [...careerWorld.mediaState.marketRumors]
    .filter(rumor => rumor.status === 'active')
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 3);
  const rumorConfidenceLabel = (confidence: number) => (
    confidence >= 75 ? 'Trattativa calda' : confidence >= 55 ? 'Indiscrezione concreta' : 'Voce debole'
  );
  const rumorConfidenceColor = (confidence: number) => (
    confidence >= 75 ? 'var(--color-danger)' : confidence >= 55 ? 'var(--color-gold)' : 'var(--text-secondary)'
  );

  const handleAnswerPressConference = (optionId: string) => {
    onResolvePressConference(optionId);
    setShowPressConference(false);
  };

  const availabilitySummaries = players.map(p => ({ player: p, summary: getPlayerAvailabilitySummary(p, currentRound, clubStaffModifiers.fitnessQuality) }));
  const unavailablePlayers = availabilitySummaries.filter(e => e.summary.label === 'Indisponibile').slice(0, 3);
  const monitorPlayers = availabilitySummaries
    .filter(e => e.summary.label === 'Da monitorare' || e.summary.label === 'A rischio' || e.summary.label === 'Rientro controllato')
    .slice(0, 3);
  const upcomingReturns = availabilitySummaries
    .filter(e => e.player.injuryStatus?.currentInjury?.expectedReturnRound !== undefined)
    .sort((a, b) => (a.player.injuryStatus!.currentInjury!.expectedReturnRound! - b.player.injuryStatus!.currentInjury!.expectedReturnRound!))
    .slice(0, 3);
  const teamAccumulatedLoad = Math.round(players.reduce((sum, p) => sum + (p.workload?.accumulatedLoad ?? 0), 0) / Math.max(1, players.length));
  const isSquadOverloaded = teamAccumulatedLoad >= 60;

  const developmentSummaries = players.map(p => ({ player: p, development: getDevelopmentSummary(p) }));
  const growingPlayers = developmentSummaries
    .filter(e => e.development.trendLabel === 'In crescita')
    .sort((a, b) => b.development.seasonGrowth - a.development.seasonGrowth)
    .slice(0, 3);
  const stagnantOrDecliningPlayers = developmentSummaries
    .filter(e => e.development.trendLabel === 'In calo' || e.development.trendLabel === 'Stabile')
    .sort((a, b) => b.development.seasonDecline - a.development.seasonDecline)
    .slice(0, 2);
  const limitedTrainingPlans = players
    .filter(p => p.trainingPlan?.status === 'limited_by_injury' || p.trainingPlan?.status === 'limited_by_fitness')
    .slice(0, 2);
  const roleConversionsInProgress = players
    .filter(p => p.trainingPlan?.focus === 'role_learning' && p.trainingPlan.targetRole)
    .slice(0, 2);

  const atRiskPromisePlayers = players.filter(p => p.playingTimePromise?.status === 'at_risk');
  const recentlyCompletedPromisePlayers = players.filter(p => p.playingTimePromise?.status === 'completed');
  const frustratedTalents = players.filter(p => (
    getPlayerProjectRole(p, { starters, seasonStats: playerStats, clubHistory, round: currentRound }).key === 'frustratedTalent'
  ));
  const unreadConversations = playerConversations.conversations
    .filter(c => c.unreadForManager && c.status === 'open')
    .sort((a, b) => b.importance - a.importance);
  const lockerRoomAlerts = [
    ...unreadConversations.map(c => ({
      id: `unread_${c.id}`,
      label: 'Messaggio non letto',
      detail: `${players.find(p => p.id === c.playerId)?.name ?? 'Un giocatore'}: ${c.messages[c.messages.length - 1]?.text ?? c.summary}`,
      color: 'var(--color-gold)'
    })),
    ...atRiskPromisePlayers.map(p => ({
      id: `risk_${p.id}`,
      label: 'Promessa a rischio',
      detail: `${p.name}: ${p.playingTimePromise?.currentMinutes ?? 0}'/${p.playingTimePromise?.targetMinutes ?? 0}' promessi.`,
      color: 'var(--color-gold)'
    })),
    ...frustratedTalents.map(p => ({
      id: `frust_${p.id}`,
      label: 'Talento frustrato',
      detail: `${p.name} sente la promessa di minutaggio non rispettata.`,
      color: 'var(--color-danger)'
    })),
    ...recentlyCompletedPromisePlayers.map(p => ({
      id: `done_${p.id}`,
      label: 'Promessa mantenuta',
      detail: `${p.name} ha raggiunto il minutaggio promesso (${p.playingTimePromise?.targetMinutes}').`,
      color: 'var(--color-pitch)'
    }))
  ].slice(0, 3);

  // Mercato M3: nota compatta solo quando serve davvero azione (finestra agli sgoccioli e
  // trattative ancora da completare), mai un avviso permanente.
  const activeTransferWindow = getActiveTransferWindow(careerWorld.transferWindows);
  const marketPendingBeforeClose = scoutedTargets.filter(t => [
    'player_contract_accepted', 'medical_pending', 'medical_warning', 'registration_pending'
  ].includes(t.status)).length;

  const staff = buildClubStaff(clubProfile);
  const staffAdvisories = getStaffAdvisories({ club: clubProfile, players, tactic, budget, history: clubHistory, teamDNA, starters });
  const choiceTone = {
    diplomatic: 'var(--color-pitch)',
    pragmatic: '#93C5FD',
    hard: 'var(--color-danger)',
    risky: 'var(--color-gold)',
    deferred: 'var(--text-muted)',
    delegated: '#A78BFA'
  };

  // Find player in best form
  const bestFormPlayer = [...players].sort((a, b) => b.form - a.form)[0];

  // Stagger variants for intro
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06
      }
    }
  };

  const cardVariants = {
    hidden: { y: 15, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 200, damping: 22 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="page-wrapper"
      style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
    >
      {/* Top Banner Row: Next Match & Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: '24px' }} className="grid-dashboard">
        
        {/* Next Match Hero Card */}
        <motion.div variants={cardVariants} className="card-premium border-glow" style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '260px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(18, 23, 30, 0.95) 100%)',
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span className="badge badge-MF" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--color-pitch)' }}>
                PROSSIMA PARTITA - SERIE A
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{nextMatch.stadium}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', margin: '24px 0' }}>
              {/* Home Team */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openClubInfo(homeTeam.club, homeTeam.name)}
                onKeyDown={(event) => handleClubKeyDown(event, homeTeam.club, homeTeam.name)}
                style={teamButtonStyle}
                aria-label={`Apri scheda club ${homeTeam.name}`}
              >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '120px' }}>
                <TeamLogo club={homeTeam.club} initials={homeTeam.initials} size={56} rounded={12} highlighted={homeTeam.isUser} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, textAlign: 'center' }}>{homeTeam.name}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Casa</span>
              </div>
              </div>

              {/* VS Divider */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--text-muted)' }}>VS</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-gold)', marginTop: '4px' }}>GIORNATA {matchRound}</span>
              </div>

              {/* Away Team */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => openClubInfo(awayTeam.club, awayTeam.name)}
                onKeyDown={(event) => handleClubKeyDown(event, awayTeam.club, awayTeam.name)}
                style={teamButtonStyle}
                aria-label={`Apri scheda club ${awayTeam.name}`}
              >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '120px' }}>
                <TeamLogo club={awayTeam.club} initials={awayTeam.initials} size={56} rounded={12} highlighted={awayTeam.isUser} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>{awayTeam.name}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Trasferta</span>
              </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Condizioni Meteo</p>
                <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sereno, 22°C</p>
              </div>
              <div>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Arbitro</p>
                <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Rizzoli A. (Bologna)</p>
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNavigate('matchcenter')}
              className="btn-primary"
              style={{ padding: '12px 24px', fontSize: '0.9rem' }}
            >
              <Play size={16} fill="#042F1A" />
              Prepara Partita
            </motion.button>
          </div>
        </motion.div>

        {/* Club Status KPI Grid */}
        <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '16px' }}>
          {/* Top Row Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <motion.div variants={cardVariants} className="card-premium" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="kpi-title">Posizione Classifica</span>
                <TrendingUp size={16} style={{ color: 'var(--color-pitch)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="kpi-value text-gradient-green">{myStanding.rank}°</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{myStanding.points} Pti</span>
              </div>
              {leagueSystem && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {userDivision === 'serie_a' ? 'Serie A' : 'Serie B'} · {zoneLabel}
                </span>
              )}
            </motion.div>

            <motion.div variants={cardVariants} className="card-premium" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="kpi-title">Morale Rosa</span>
                <Heart size={16} style={{ color: 'var(--color-danger)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="kpi-value">{avgMorale}%</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-pitch)' }}>Ottimo</span>
              </div>
            </motion.div>
          </div>

          {/* Bottom Row Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <motion.div variants={cardVariants} className="card-premium" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="kpi-title">Media Valutazione</span>
                <Activity size={16} style={{ color: 'var(--color-lime)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span className="kpi-value">{avgForm}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 10</span>
              </div>
            </motion.div>

            <motion.div variants={cardVariants} className="card-premium" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="kpi-title">Forma Recente</span>
                <Award size={16} style={{ color: 'var(--color-gold)' }} />
              </div>
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                {myStanding.form.map((res, idx) => (
                  <span
                    key={idx}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: res === 'W' ? 'rgba(16, 185, 129, 0.2)' : res === 'D' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: res === 'W' ? 'var(--color-pitch)' : res === 'D' ? 'var(--color-gold)' : 'var(--color-danger)',
                      border: `1px solid ${res === 'W' ? 'var(--color-pitch)' : res === 'D' ? 'var(--color-gold)' : 'var(--color-danger)'}`
                    }}
                  >
                    {res}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

      </div>

      {/* Mondo Esterno: Fans & Ownership */}
      <div>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '12px' }}>Mondo Esterno</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="grid-dashboard">
          <motion.div variants={cardVariants} className="card-premium">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Users size={18} style={{ color: 'var(--color-pitch)' }} />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Tifosi</h4>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
              <span className="kpi-value">{careerWorld.fanState.overallMood}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-pitch)' }}>{getMoodLabel(careerWorld.fanState.overallMood)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
              {happiestFanGroup && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.06)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Gruppo più soddisfatto</span>
                  <strong style={{ color: 'var(--color-pitch)' }}>{happiestFanGroup.label} ({happiestFanGroup.mood})</strong>
                </div>
              )}
              {mostCriticalFanGroup && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.06)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Gruppo più critico</span>
                  <strong style={{ color: 'var(--color-danger)' }}>{mostCriticalFanGroup.label} ({mostCriticalFanGroup.mood})</strong>
                </div>
              )}
              {careerWorld.fanState.recentReactions[0] && (
                <div style={{ padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Variazione recente</span>
                    <strong style={{ color: changeColor(careerWorld.fanState.lastMoodChange) }}>{formatSignedChange(careerWorld.fanState.lastMoodChange)}</strong>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{careerWorld.fanState.recentReactions[0]}</p>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '2px' }}>
                {sortedFanGroups.map(group => (
                  <div key={group.key} style={{ display: 'grid', gridTemplateColumns: '84px 40px 1fr', alignItems: 'center', gap: '8px', padding: '5px 8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>{group.label}</span>
                    <span style={{ color: trendColor(group.trend), fontWeight: 800 }}>{group.mood} {trendSymbol(group.trend)}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.recentReasons[0] ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div variants={cardVariants} className="card-premium">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Landmark size={18} style={{ color: 'var(--color-gold)' }} />
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Proprietà</h4>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{OWNERSHIP_TYPE_LABELS[careerWorld.ownershipState.ownerType]}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Fiducia nell'allenatore</span>
                <strong style={{ color: trendColor(boardTrend) }}>{careerWorld.ownershipState.boardConfidence} {trendSymbol(boardTrend)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Stato finanziario</span>
                <strong style={{ color: financialStatusColor }}>{FINANCIAL_STATUS_LABELS[careerWorld.ownershipState.financialStatus]}</strong>
              </div>
              {mostImportantObjective && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Obiettivo più importante</span>
                  <strong style={{ textAlign: 'right', color: objectiveStatusColor(mostImportantObjective.status) }}>
                    {mostImportantObjective.title} · {OBJECTIVE_STATUS_LABELS[mostImportantObjective.status]}
                  </strong>
                </div>
              )}
              {careerWorld.ownershipState.lastReactionNote && (
                <div style={{ padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Variazione fiducia</span>
                    <strong style={{ color: changeColor(careerWorld.ownershipState.lastConfidenceChange) }}>{formatSignedChange(careerWorld.ownershipState.lastConfidenceChange)}</strong>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>{careerWorld.ownershipState.lastReactionNote}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {careerWorld.ownershipState.currentObjectives.length > 0 && (
          <motion.div variants={cardVariants} className="card-premium" style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px' }}>Obiettivi stagionali</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {careerWorld.ownershipState.currentObjectives.slice(0, 3).map(objective => (
                <div key={objective.id} style={{ padding: '9px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                    <strong style={{ fontSize: '0.78rem' }}>{objective.title}</strong>
                    <span style={{ fontSize: '0.66rem', fontWeight: 800, color: objectiveStatusColor(objective.status) }}>{OBJECTIVE_STATUS_LABELS[objective.status]}</span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: '6px' }}>
                    <div style={{ width: `${objective.progress}%`, height: '100%', background: objectiveStatusColor(objective.status) }} />
                  </div>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '5px', lineHeight: 1.35 }}>{objective.reason}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {(mostLovedPlayers.length > 0 || mostCriticizedPlayers.length > 0) && (
          <motion.div variants={cardVariants} className="card-premium" style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px' }}>Termometro della tifoseria</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Più amati</span>
                {mostLovedPlayers.length === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nessun idolo, per ora.</span>}
                {mostLovedPlayers.map(({ standing, player }) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate('squad')}
                    style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.06)', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '0.74rem' }}>{player.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-pitch)', fontWeight: 800 }}>{standing.affection}</span>
                    </div>
                    <span style={{ fontSize: '0.64rem', color: 'var(--color-pitch)' }}>{PLAYER_FAN_STATUS_LABELS[standing.status]}</span>
                    {standing.recentReasons[0] && <p style={{ fontSize: '0.64rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.3 }}>{standing.recentReasons[0]}</p>}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Più criticati</span>
                {mostCriticizedPlayers.length === 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nessuno sotto pressione, per ora.</span>}
                {mostCriticizedPlayers.map(({ standing, player }) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate('squad')}
                    style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '0.74rem' }}>{player.name}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-danger)', fontWeight: 800 }}>{standing.criticism}</span>
                    </div>
                    <span style={{ fontSize: '0.64rem', color: 'var(--color-danger)' }}>{PLAYER_FAN_STATUS_LABELS[standing.status]}</span>
                    {standing.recentReasons[0] && <p style={{ fontSize: '0.64rem', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.3 }}>{standing.recentReasons[0]}</p>}
                  </button>
                ))}
              </div>
            </div>
            {latestTransferReaction && (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                <strong style={{ fontSize: '0.74rem', display: 'block', marginBottom: '3px' }}>{latestTransferReaction.title}</strong>
                <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{latestTransferReaction.description}</p>
              </div>
            )}
          </motion.div>
        )}

        {leagueSystem && otherDivisionTopStandings.length > 0 && (
          <motion.div variants={cardVariants} className="card-premium" style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px' }}>
              {otherDivision === 'serie_a' ? 'Serie A' : 'Serie B'} (l&apos;altra divisione)
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {otherDivisionTopStandings.map(team => (
                <div key={team.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', padding: '4px 0' }}>
                  <span>{team.rank}° {team.name}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{team.points} Pti</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {leagueSystem && (
          <motion.div variants={cardVariants} className="card-premium" style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px' }}>Contesto Stagionale</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.72rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Lega attuale</span>
                <span style={{ fontWeight: 700 }}>{userDivision === 'serie_a' ? 'Serie A' : 'Serie B'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Obiettivo stagionale</span>
                <span style={{ fontWeight: 700 }}>{sportivoObjective?.title ?? '—'}</span>
              </div>
              {justMoved && promotionRelegationContext && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Effetto {clubMovement === 'promoted_to_serie_a' ? 'promozione' : 'retrocessione'}</span>
                  <span style={{ fontWeight: 700, color: clubMovement === 'promoted_to_serie_a' ? 'var(--color-pitch)' : 'var(--color-danger)' }}>
                    {clubMovement === 'promoted_to_serie_a' ? 'Neopromossa' : 'Retrocessa'} · {OBJECTIVE_LABELS[promotionRelegationContext.objective]}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Pressione proprietà</span>
                <span style={{ fontWeight: 700 }}>
                  {promotionRelegationContext?.boardPressure === 'very_high' ? 'Molto alta' : promotionRelegationContext?.boardPressure === 'high' ? 'Alta' : promotionRelegationContext?.boardPressure === 'low' ? 'Bassa' : 'Normale'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Mood tifosi</span>
                <span style={{ fontWeight: 700 }}>{getMoodLabel(careerWorld.fanState.overallMood)}</span>
              </div>
              {wageBudgetStatus === 'Fuori budget' && (
                <div style={{ marginTop: '2px', padding: '7px 9px', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--color-danger)', fontSize: '0.68rem', fontWeight: 600 }}>
                  Monte ingaggi sopra il livello sostenibile per la categoria attuale.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {hottestRivalries.length > 0 && (
          <motion.div variants={cardVariants} className="card-premium" style={{ marginTop: '24px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px' }}>Rivalita Calde</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {hottestRivalries.map(rivalry => {
                const nextClashIndex = calendar.findIndex(match => match.opponent === rivalry.opponent && match.status !== 'played');
                const nextClash = nextClashIndex >= 0 ? calendar[nextClashIndex] : undefined;
                return (
                  <div key={rivalry.id} style={{ padding: '9px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                      <strong style={{ fontSize: '0.78rem' }}>{rivalry.opponent}</strong>
                      <span style={{ fontSize: '0.66rem', fontWeight: 800, color: rivalryHeatColor(rivalry.heat) }}>
                        {RIVALRY_STATUS_LABELS[rivalry.status]} · {Math.round(rivalry.heat)}%
                      </span>
                    </div>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '5px', lineHeight: 1.35 }}>
                      {rivalry.memories[0] ?? rivalry.reason}
                    </p>
                    {nextClash && (
                      <span style={{ display: 'block', marginTop: '4px', fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                        Prossima sfida: Giornata {nextClashIndex + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {pendingConference && (
          <motion.div variants={cardVariants} className="card-premium" style={{ marginTop: '24px', border: '1px solid var(--color-gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Conferenza stampa disponibile</h4>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginBottom: '10px' }}>{pendingConference.question}</p>
            <button className="btn-primary" onClick={() => setShowPressConference(true)} style={{ fontSize: '0.78rem' }}>
              Rispondi ai giornalisti
            </button>
          </motion.div>
        )}

        {(recentArticles.length > 0 || activeMarketRumors.length > 0) && (
          <motion.div variants={cardVariants} className="card-premium" style={{ marginTop: '24px' }}>
            {recentArticles.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px' }}>Dalla stampa</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recentArticles.map(article => (
                    <div key={article.id} style={{ padding: '9px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                      <strong style={{ fontSize: '0.78rem', display: 'block' }}>{article.title}</strong>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.35 }}>{article.body}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeMarketRumors.length > 0 && (
              <div style={recentArticles.length > 0 ? { marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' } : undefined}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px' }}>Mercato sotto osservazione</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeMarketRumors.map(rumor => {
                    const journalist = careerWorld.mediaState.journalists.find(j => j.id === rumor.journalistId);
                    return (
                      <div key={rumor.id} style={{ padding: '9px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                          <strong style={{ fontSize: '0.78rem' }}>{rumor.title}</strong>
                          <span style={{ fontSize: '0.64rem', fontWeight: 800, color: rumorConfidenceColor(rumor.confidence) }}>
                            {rumorConfidenceLabel(rumor.confidence)}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.35 }}>{rumor.summary}</p>
                        <span style={{ display: 'block', marginTop: '4px', fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                          {journalist?.name ?? 'Redazione'}
                          {rumor.playerName ? ` · ${rumor.playerName}` : ''}
                          {rumor.relatedClubName ? ` · ${rumor.relatedClubName}` : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {latestWorldEvent && (
          <motion.div variants={cardVariants} className="card-premium" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Evento recente</h4>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800 }}>Importanza {latestWorldEvent.importance}</span>
            </div>
            <strong style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>{latestWorldEvent.title}</strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.4 }}>{latestWorldEvent.description}</p>
            <span style={{ display: 'block', marginTop: '6px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Dopo l'ultima partita</span>
          </motion.div>
        )}
      </div>

      {/* Main Body Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: '24px' }} className="grid-dashboard">
        
        {/* Left Column: Board News & Next fixtures */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Boardroom News Card */}
          <motion.div variants={cardVariants} className="card-premium" style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <BookOpen size={18} style={{ color: 'var(--color-pitch)' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Notizie del Club & Società</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {news.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: 'rgba(26, 33, 42, 0.3)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 16px',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{item.date}</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{item.content}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Calendar Mini Schedule */}
          <motion.div variants={cardVariants} className="card-premium">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--color-pitch)' }} />
                Prossimi Impegni
              </h3>
              <button
                onClick={() => onNavigate('matches')}
                style={{ background: 'none', border: 'none', color: 'var(--color-pitch)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                Vedi Tutti <ArrowRight size={12} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {calendar.filter(m => m.status === 'future').slice(0, 3).map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    backgroundColor: 'rgba(26, 33, 42, 0.15)'
                  }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openClubInfo(getClubByName(m.opponent), m.opponent)}
                    onKeyDown={(event) => handleClubKeyDown(event, getClubByName(m.opponent), m.opponent)}
                    style={miniTeamButtonStyle}
                    aria-label={`Apri scheda club ${m.opponent}`}
                  >
                    <TeamLogo club={getClubByName(m.opponent)} initials={m.opponentInitials} size={28} rounded={6} />
                    <div>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>{m.opponent}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{m.stadium}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{m.date}</span>
                </div>
              ))}
            </div>
          </motion.div>

        </div>

        {/* Right Column: Player Form, Training, Transfer highlights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <motion.div variants={cardVariants} className="card-premium border-glow" style={{
            background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.07) 0%, rgba(18, 23, 30, 0.95) 100%)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
              <span className="badge badge-MF" style={{ background: 'rgba(96,165,250,0.14)', color: '#93C5FD' }}>
                {seasonNarrative.seasonLabel}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 800 }}>{chapterProgress}% arco</span>
            </div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 850, marginBottom: '5px' }}>{currentChapter.title}</h4>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {seasonNarrative.arcSummary}
            </p>
            <div style={{ marginTop: '12px', padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(11,15,20,0.24)' }}>
              <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>Domanda del capitolo</span>
              <strong style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>{seasonNarrative.keyQuestion}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '12px', fontSize: '0.7rem' }}>
              {[
                ['Pressione', seasonNarrative.pressure],
                ['Board', seasonNarrative.boardTrust],
                ['Gruppo', seasonNarrative.squadBelief],
                ['Tifosi', seasonNarrative.fanPatience]
              ].map(([label, value]) => (
                <div key={label} style={{ padding: '8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <strong style={{ float: 'right', color: Number(value) >= 65 ? 'var(--color-pitch)' : Number(value) <= 40 ? 'var(--color-danger)' : 'var(--color-gold)' }}>{value}</strong>
                </div>
              ))}
            </div>
            {seasonNarrative.worldSignals?.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Cause attive</span>
                {seasonNarrative.worldSignals.slice(0, 3).map(signal => (
                  <div key={signal.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', padding: '7px 8px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(11,15,20,0.2)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.32 }}>{signal.label}</span>
                    <strong style={{ fontSize: '0.68rem', color: signal.intensity >= 72 ? 'var(--color-danger)' : signal.intensity >= 55 ? 'var(--color-gold)' : 'var(--color-pitch)' }}>{signal.intensity}</strong>
                  </div>
                ))}
              </div>
            )}
            {stakeholderPulse.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Interessi in tensione</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '8px' }}>
                  {stakeholderPulse.map(stakeholder => (
                    <div key={stakeholder.key} style={{ display: 'grid', gridTemplateColumns: '82px 1fr auto', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 800 }}>{stakeholder.name}</span>
                      <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                        <div style={{ width: `${stakeholder.mood}%`, height: '100%', background: stakeholder.mood >= 65 ? 'var(--color-pitch)' : stakeholder.mood >= 42 ? 'var(--color-gold)' : 'var(--color-danger)' }} />
                      </div>
                      <strong style={{ fontSize: '0.68rem', color: stakeholder.mood >= 65 ? 'var(--color-pitch)' : stakeholder.mood >= 42 ? 'var(--color-gold)' : 'var(--color-danger)' }}>{stakeholder.mood}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          <motion.div variants={cardVariants} className="card-premium" style={{
            background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.06) 0%, rgba(18, 23, 30, 0.95) 100%)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 850, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Staff vivo
              </h4>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 800 }}>{staff.length} figure</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {staffAdvisories.slice(0, 3).map(advice => {
                const toneColor =
                  advice.tone === 'positive' ? 'var(--color-pitch)' :
                  advice.tone === 'critical' ? 'var(--color-danger)' :
                  advice.tone === 'warning' ? 'var(--color-gold)' :
                  'var(--text-secondary)';
                return (
                  <div key={advice.id} style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px', background: 'rgba(11,15,20,0.24)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                      <strong style={{ fontSize: '0.74rem', lineHeight: 1.3 }}>{advice.title}</strong>
                      <span style={{ color: toneColor, fontSize: '0.66rem', fontWeight: 850 }}>{advice.urgency}</span>
                    </div>
                    <p style={{ marginTop: '4px', fontSize: '0.66rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                      {advice.roleLabel}: {advice.staffName}
                    </p>
                    <p style={{ marginTop: '5px', fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                      {advice.opinion}
                    </p>
                    <p style={{ marginTop: '6px', fontSize: '0.64rem', color: 'var(--color-pitch)', lineHeight: 1.32 }}>
                      Vantaggio: {advice.benefit}
                    </p>
                    <p style={{ marginTop: '3px', fontSize: '0.64rem', color: 'var(--color-gold)', lineHeight: 1.32 }}>
                      Costo: {advice.cost}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div variants={cardVariants} className="card-premium">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} style={{ color: 'var(--color-pitch)' }} />
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Staff del club
                </h4>
              </div>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 800 }}>Qualita media {clubStaffSummary.averageQuality}</span>
            </div>
            {clubStaffSummary.strengths.length > 0 && (
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontSize: '0.64rem', color: 'var(--color-pitch)', fontWeight: 800 }}>Punti di forza: </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{clubStaffSummary.strengths.join(', ')}</span>
              </div>
            )}
            {clubStaffSummary.weaknesses.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '0.64rem', color: 'var(--color-danger)', fontWeight: 800 }}>Aree deboli: </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{clubStaffSummary.weaknesses.join(', ')}</span>
              </div>
            )}
            {careerWorld.clubStaffState.recentReports[0] && (
              <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginBottom: '10px' }}>
                <strong>{careerWorld.clubStaffState.recentReports[0].title}</strong> ({CLUB_STAFF_ROLE_LABELS[careerWorld.clubStaffState.recentReports[0].role]}): {careerWorld.clubStaffState.recentReports[0].detail}
              </p>
            )}
            <button className="btn-secondary" onClick={() => setShowClubStaffModal(true)} style={{ width: '100%', justifyContent: 'center', fontSize: '0.72rem' }}>
              Gestisci staff
            </button>
          </motion.div>

          <motion.div variants={cardVariants} className="card-premium">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={16} style={{ color: 'var(--color-lime)' }} />
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Strutture del club
                </h4>
              </div>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 800 }}>Livello medio {clubFacilitiesSummary.averageLevel}</span>
            </div>
            {clubFacilitiesSummary.strengths.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '0.64rem', color: 'var(--color-pitch)', fontWeight: 800 }}>Punti di forza: </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{clubFacilitiesSummary.strengths.join(', ')}</span>
              </div>
            )}
            {clubFacilitiesSummary.activeProject ? (
              <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginBottom: '10px' }}>
                Progetto in corso: livello {clubFacilitiesSummary.activeProject.targetLevel} ({clubFacilitiesSummary.activeProject.progress}%, {clubFacilitiesSummary.activeProject.roundsLeft} giornate rimanenti).
              </p>
            ) : (
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.35, marginBottom: '10px' }}>
                Nessun progetto strutturale in corso.
              </p>
            )}
            <button className="btn-secondary" onClick={() => setShowClubFacilitiesModal(true)} style={{ width: '100%', justifyContent: 'center', fontSize: '0.72rem' }}>
              Gestisci strutture
            </button>
          </motion.div>

          <motion.div variants={cardVariants} className="card-premium">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSignature size={16} style={{ color: 'var(--color-gold)' }} />
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Budget contratti
                </h4>
              </div>
              <span style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                color: wageBudgetStatus === 'Sano' ? 'var(--color-pitch)' : wageBudgetStatus === 'Sotto pressione' ? 'var(--color-gold)' : 'var(--color-danger)'
              }}>
                {wageBudgetStatus}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.72rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Budget stipendi annuo</span>
                <strong>{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(wageBudget.annualWageBudget)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Monte ingaggi impegnato</span>
                <strong>{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(wageBudget.committedAnnualWages)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Bonus previsti</span>
                <strong>{new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(wageBudget.projectedBonusReserve)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Margine residuo</span>
                <strong style={{ color: wageBudget.availableAnnualWages < 0 ? 'var(--color-danger)' : 'var(--color-pitch)' }}>
                  {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(wageBudget.availableAnnualWages)}
                </strong>
              </div>
            </div>
          </motion.div>

          <motion.div variants={cardVariants} className="card-premium">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GraduationCap size={16} style={{ color: 'var(--color-lime)' }} />
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Settore giovanile
                </h4>
              </div>
              <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 800 }}>
                Livello {youthAcademySummary.academyLevel} · {youthAcademySummary.activeCount} prospetti
              </span>
            </div>
            {youthAcademySummary.topProspects.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {youthAcademySummary.topProspects.map(player => (
                  <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                    <span>{player.name} ({player.age}, {player.role})</span>
                    <span style={{ color: 'var(--color-pitch)' }}>{getYouthPotentialLabel(player, careerWorld.clubStaffState, careerWorld.clubFacilitiesState)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '10px' }}>Nessun prospetto osservato al momento.</p>
            )}
            {youthAcademySummary.topRecommendation && (
              <p style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginBottom: '10px' }}>
                {youthAcademySummary.topRecommendation.summary}
              </p>
            )}
            <button className="btn-secondary" onClick={() => setShowYouthAcademyModal(true)} style={{ width: '100%', justifyContent: 'center', fontSize: '0.72rem' }}>
              Apri vivaio
            </button>
          </motion.div>

          {(unavailablePlayers.length > 0 || monitorPlayers.length > 0 || isSquadOverloaded) && (
            <motion.div variants={cardVariants} className="card-premium">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Stethoscope size={16} style={{ color: 'var(--color-danger)' }} />
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Infermeria e condizione
                </h4>
              </div>
              {isSquadOverloaded && (
                <p style={{ fontSize: '0.7rem', color: 'var(--color-gold)', lineHeight: 1.35, marginBottom: '10px' }}>
                  La squadra sta accumulando troppo carico ({teamAccumulatedLoad}/100): valuta qualche rotazione in più.
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {unavailablePlayers.map(({ player, summary }) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate('squad')}
                    style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.06)', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '0.74rem' }}>{player.name}</strong>
                      <span style={{ fontSize: '0.66rem', color: 'var(--color-danger)', fontWeight: 800 }}>{summary.label}</span>
                    </div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>{summary.prognosis}</span>
                  </button>
                ))}
                {monitorPlayers.map(({ player, summary }) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate('squad')}
                    style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.06)', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '0.74rem' }}>{player.name}</strong>
                      <span style={{ fontSize: '0.66rem', color: 'var(--color-gold)', fontWeight: 800 }}>{summary.label}</span>
                    </div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>{summary.reasons[0]}</span>
                  </button>
                ))}
                {upcomingReturns.length > 0 && (
                  <div style={{ marginTop: '4px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Prossimi rientri</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      {upcomingReturns.map(({ player, summary }) => (
                        <div key={player.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                          <span>{player.name}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{summary.prognosis}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {(growingPlayers.length > 0 || stagnantOrDecliningPlayers.length > 0 || limitedTrainingPlans.length > 0 || roleConversionsInProgress.length > 0) && (
            <motion.div variants={cardVariants} className="card-premium">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <GraduationCap size={16} style={{ color: 'var(--color-lime)' }} />
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Sviluppo e allenamento
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {growingPlayers.map(({ player, development }) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate('squad')}
                    style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.06)', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '0.74rem' }}>{player.name}</strong>
                      <span style={{ fontSize: '0.66rem', color: 'var(--color-pitch)', fontWeight: 800 }}>{development.trendLabel}</span>
                    </div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>{development.explanation}</span>
                  </button>
                ))}
                {stagnantOrDecliningPlayers.map(({ player, development }) => (
                  <button
                    key={player.id}
                    onClick={() => onNavigate('squad')}
                    style={{ textAlign: 'left', padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.06)', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '0.74rem' }}>{player.name}</strong>
                      <span style={{ fontSize: '0.66rem', color: 'var(--color-gold)', fontWeight: 800 }}>{development.trendLabel}</span>
                    </div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>{development.explanation}</span>
                  </button>
                ))}
                {limitedTrainingPlans.map(player => (
                  <div key={player.id} style={{ padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <strong style={{ fontSize: '0.74rem' }}>{player.name}</strong>
                      <span style={{ fontSize: '0.66rem', color: 'var(--color-danger)', fontWeight: 800 }}>{TRAINING_PLAN_STATUS_LABELS[player.trainingPlan!.status]}</span>
                    </div>
                  </div>
                ))}
                {roleConversionsInProgress.map(player => {
                  const entry = getRoleFamiliarityEntry(player, player.trainingPlan!.targetRole!);
                  return (
                    <div key={player.id} style={{ padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <strong style={{ fontSize: '0.74rem' }}>{player.name} → {player.trainingPlan!.targetRole}</strong>
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', fontWeight: 800 }}>{ROLE_FAMILIARITY_STATUS_LABELS[entry.status]}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeArcs.length > 0 && (
            <motion.div variants={cardVariants} className="card-premium border-glow" style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(18, 23, 30, 0.95) 100%)'
            }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', color: 'var(--color-gold)' }}>
                Archi da decidere
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {activeArcs.map(arc => (
                  <div key={arc.id} style={{ padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(11,15,20,0.22)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                      <strong style={{ fontSize: '0.8rem', lineHeight: 1.3 }}>{arc.title}</strong>
                      <span style={{ fontSize: '0.66rem', color: arc.heat >= 78 ? 'var(--color-danger)' : arc.heat >= 56 ? 'var(--color-gold)' : 'var(--color-pitch)', fontWeight: 850 }}>
                        {arc.stage} {arc.heat}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: '5px' }}>{arc.stakes}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '10px' }}>
                      {arc.choices.slice(0, 3).map(choice => (
                        <button
                          key={choice.id}
                          onClick={() => onResolveNarrativeArc(arc.id, choice.id)}
                          className="btn-secondary"
                          style={{
                            alignItems: 'flex-start',
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            padding: '8px',
                            borderColor: `${choiceTone[choice.style]}66`,
                            color: 'var(--text-primary)'
                          }}
                          title={`${choice.benefit} Costo: ${choice.cost}`}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <strong style={{ fontSize: '0.7rem', color: choiceTone[choice.style] }}>{choice.label}</strong>
                            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>{choice.benefit}</span>
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>Costo: {choice.cost}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {topStories.length > 0 && (
            <motion.div variants={cardVariants} className="card-premium border-glow" style={{
              background: 'linear-gradient(135deg, rgba(251, 113, 133, 0.06) 0%, rgba(18, 23, 30, 0.95) 100%)'
            }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', color: '#FB7185' }}>
                Storie del Momento
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topStories.map(story => (
                  <div key={story.id} style={{ padding: '10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(11,15,20,0.22)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                      <span className="badge" style={{ background: 'rgba(251,113,133,0.14)', color: '#FB7185' }}>
                        {NARRATIVE_TYPE_LABELS[story.type]}
                      </span>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 800 }}>{story.stage} · {story.importance}</span>
                    </div>
                    <strong style={{ display: 'block', marginTop: '6px', fontSize: '0.82rem' }}>{story.title}</strong>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.4, marginTop: '4px' }}>{story.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '7px', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                      <span>{story.playerName ?? story.club}</span>
                      <span>{story.moments[0]?.dateLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {lockerRoomAlerts.length > 0 && (
            <motion.div variants={cardVariants} className="card-premium">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <ShieldAlert size={16} style={{ color: 'var(--color-gold)' }} />
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Spogliatoio
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {lockerRoomAlerts.map(alert => (
                  <button
                    key={alert.id}
                    onClick={() => onNavigate('squad')}
                    style={{
                      textAlign: 'left',
                      padding: '10px',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(11,15,20,0.22)',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit'
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '0.72rem', color: alert.color }}>{alert.label}</strong>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{alert.detail}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Giocatore in Forma */}
          <motion.div variants={cardVariants} className="card-premium border-glow" style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(18, 23, 30, 0.95) 100%)',
          }}>
            <h4 className="text-gradient-gold" style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              Giocatore in Forma
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                border: '2px solid var(--color-gold)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-heading)',
                fontWeight: 800,
                fontSize: '1.1rem',
                color: 'var(--color-gold)'
              }}>
                {bestFormPlayer.overall}
              </div>
              <div>
                <p style={{ fontSize: '0.9rem', fontWeight: 700 }}>{bestFormPlayer.name}</p>
                <div style={{ display: 'flex', gap: '6px', marginTop: '2px', alignItems: 'center' }}>
                  <span className={`badge badge-${bestFormPlayer.role === 'GK' ? 'GK' : bestFormPlayer.role.match(/CB|LB|RB/) ? 'DF' : bestFormPlayer.role.match(/DM|CM|AM/) ? 'MF' : 'FW'}`}>{bestFormPlayer.role}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Forma: <strong style={{ color: 'var(--color-lime)' }}>{bestFormPlayer.form}</strong></span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Allenamento di Oggi */}
          <motion.div variants={cardVariants} className="card-premium">
            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              Focus Allenamento Odierno
            </h4>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px' }}>Transizioni Veloci & Tiri</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
              Aumenta l'affiatamento tattico del 4-3-3. Condizione fisica media calata leggermente (-2%) per carico atletico.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '6px 10px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Activity size={12} style={{ color: 'var(--color-pitch)' }} />
              <span style={{ fontSize: '0.65rem', color: 'var(--color-pitch)', fontWeight: 700 }}>+5% Precisione Tiri nel prossimo match</span>
            </div>
          </motion.div>

          {/* Mercato Card */}
          <motion.div variants={cardVariants} className="card-premium border-gold" style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.03) 0%, rgba(18, 23, 30, 0.95) 100%)',
          }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-gold)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={14} />
              Mercato: Trattative Attive
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Offerte pendenti per nuovi acquisti. Verifica la lista obiettivi nel pannello mercato per concludere i contratti.
            </p>
            {activeTransferWindow?.status === 'closing_soon' && marketPendingBeforeClose > 0 && (
              <p style={{ fontSize: '0.7rem', color: 'var(--color-danger)', fontWeight: 700, marginBottom: '8px' }}>
                Mercato: {marketPendingBeforeClose} trattativ{marketPendingBeforeClose === 1 ? 'a' : 'e'} da completare prima della chiusura.
              </p>
            )}
            <button
              onClick={() => onNavigate('market')}
              style={{
                width: '100%',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                color: 'var(--color-gold)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)'}
            >
              Apri Calciomercato <ArrowRight size={12} />
            </button>
          </motion.div>

        </div>

      </div>
      <ClubInfoModal
        club={selectedClubInfo}
        onClose={() => setSelectedClubInfo(null)}
        clubWorld={clubWorld}
        userTeamName={teamName}
        onCreateTransferTarget={onCreateTransferTarget}
        onNavigateMarket={() => onNavigate('market')}
      />
      {showPressConference && pendingConference && (
        <PressConferenceModal
          conference={pendingConference}
          journalist={pendingConferenceJournalist}
          onAnswer={handleAnswerPressConference}
          onClose={() => setShowPressConference(false)}
        />
      )}
      {showClubStaffModal && (
        <ClubStaffModal
          clubStaffState={careerWorld.clubStaffState}
          budget={budget}
          currentRound={currentRound}
          onClose={() => setShowClubStaffModal(false)}
          onHire={(role, candidateId) => onHireClubStaff(role, candidateId)}
        />
      )}
      {showClubFacilitiesModal && (
        <ClubFacilitiesModal
          clubFacilitiesState={careerWorld.clubFacilitiesState}
          clubStaffState={careerWorld.clubStaffState}
          budget={budget}
          currentRound={currentRound}
          club={clubProfile}
          onClose={() => setShowClubFacilitiesModal(false)}
          onUpgrade={onUpgradeFacility}
        />
      )}
      {showYouthAcademyModal && (
        <YouthAcademyModal
          players={players}
          youthAcademyState={careerWorld.youthAcademyState}
          clubStaffState={careerWorld.clubStaffState}
          clubFacilitiesState={careerWorld.clubFacilitiesState}
          onClose={() => setShowYouthAcademyModal(false)}
          onPromote={onPromoteYouthPlayer}
          onRelease={onReleaseYouthPlayer}
        />
      )}
    </motion.div>
  );
}
