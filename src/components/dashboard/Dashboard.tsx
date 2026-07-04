import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, TrendingUp, Award, Activity, Heart, ArrowRight, BookOpen, AlertCircle, Calendar } from 'lucide-react';
import { ClubAIState, Player, Match, Standing, NewsItem, ClubProfile, SeasonNarrativeState, ClubHistoryState, Tactic, TeamDNAState } from '../../types';
import TeamLogo from '../common/TeamLogo';
import { getClubByName } from '../../data/serieAData';
import ClubInfoModal from '../common/ClubInfoModal';
import { isDecisionWorthyArc, SEASON_CHAPTERS } from '../../utils/seasonNarrative';
import { buildClubStaff, getStaffAdvisories } from '../../utils/staff';

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
}

export default function Dashboard({ players, calendar, standings, news, teamName, clubProfile, onNavigate, clubWorld, onCreateTransferTarget, seasonNarrative, clubHistory, onResolveNarrativeArc, budget, tactic, teamDNA, starters }: DashboardProps) {
  const [selectedClubInfo, setSelectedClubInfo] = useState<ClubProfile | null>(null);

  // Find next match
  const nextMatch = calendar.find(m => m.status === 'next') || calendar[0];
  
  // Find selected club standing details
  const myStanding = standings.find(s => s.name === teamName) || { rank: 4, points: 22, form: ['W', 'D', 'W', 'W', 'L'] };
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
    </motion.div>
  );
}
