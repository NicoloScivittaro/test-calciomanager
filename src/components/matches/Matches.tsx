import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Calendar, Eye, X, BarChart2, Zap } from 'lucide-react';
import { ClubAIState, ClubProfile, Match, Player, PlayerSeasonStat, Standing } from '../../types';
import TeamLogo from '../common/TeamLogo';
import { getClubByName } from '../../data/serieAData';
import ClubInfoModal from '../common/ClubInfoModal';
import PlayerProfileModal from '../common/PlayerProfileModal';
import { sortAssistmen, sortScorers } from '../../utils/playerSeasonStats';

interface MatchesProps {
  calendar: Match[];
  standings: Standing[];
  players: Player[];
  teamName: string;
  clubWorld: ClubAIState[];
  playerStats: PlayerSeasonStat[];
  onCreateTransferTarget: (player: Player, clubName: string) => void;
  onNavigate: (tab: string) => void;
}

type MatchesTab = 'table' | 'scorers' | 'assists' | 'calendar';
type LeaderboardKind = 'scorers' | 'assists';

export default function Matches({ calendar, standings, players, teamName, clubWorld, playerStats, onCreateTransferTarget, onNavigate }: MatchesProps) {
  const [activeTab, setActiveTab] = useState<MatchesTab>('table');
  const [selectedMatchDetails, setSelectedMatchDetails] = useState<Match | null>(null);
  const [selectedClubInfo, setSelectedClubInfo] = useState<ClubProfile | null>(null);
  const [playerSheet, setPlayerSheet] = useState<{ player: Player; mode: 'quick' | 'full' } | null>(null);

  const clubButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'none',
    border: 'none',
    color: 'inherit',
    font: 'inherit',
    padding: 0,
    cursor: 'pointer',
    textAlign: 'left'
  };

  const openClubInfo = (name?: string) => {
    const club = getClubByName(name ?? '');
    if (club) setSelectedClubInfo(club);
  };

  const handleClubKeyDown = (event: React.KeyboardEvent, name?: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    openClubInfo(name);
  };

  // Sorting teams
  const sortedStandings = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
    return b.goalsFor - a.goalsFor;
  });
  const selectedUserIsHome = selectedMatchDetails?.isHome ?? true;
  const selectedHomeTeam = selectedUserIsHome ? teamName : selectedMatchDetails?.opponent;
  const selectedAwayTeam = selectedUserIsHome ? selectedMatchDetails?.opponent : teamName;
  const selectedHomeScore = selectedUserIsHome ? selectedMatchDetails?.scoreUser : selectedMatchDetails?.scoreOpponent;
  const selectedAwayScore = selectedUserIsHome ? selectedMatchDetails?.scoreOpponent : selectedMatchDetails?.scoreUser;
  const topScorers = sortScorers(playerStats).filter(row => row.goals > 0).slice(0, 15);
  const topAssistmen = sortAssistmen(playerStats).filter(row => row.assists > 0).slice(0, 15);
  const allKnownPlayers = [...players, ...clubWorld.flatMap(club => club.roster)];

  const findPlayerForStat = (row: PlayerSeasonStat) => {
    const sourceRoster = row.clubName === teamName
      ? players
      : clubWorld.find(club => club.name === row.clubName)?.roster ?? [];
    return sourceRoster.find(player => player.id === row.playerId || player.name === row.playerName);
  };

  const openPlayerStatSheet = (row: PlayerSeasonStat) => {
    const player = findPlayerForStat(row);
    if (player) setPlayerSheet({ player, mode: 'quick' });
  };

  const roleBadgeClass = (role: Player['role']) => `badge badge-${role === 'GK' ? 'GK' : role.match(/CB|LB|RB/) ? 'DF' : role.match(/DM|CM|AM/) ? 'MF' : 'FW'}`;
  const goalAverage = (row: PlayerSeasonStat) => row.appearances ? (row.goals / row.appearances).toFixed(2) : '0.00';
  const formColor = (token: string) => (
    token === 'GA' ? 'var(--color-lime)' :
    token === 'G' ? 'var(--color-pitch)' :
    token === 'A' ? '#93C5FD' :
    'var(--text-muted)'
  );

  const renderRecentForm = (row: PlayerSeasonStat) => (
    <div style={{ display: 'flex', gap: '4px' }}>
      {(row.recentForm.length ? row.recentForm : ['-']).map((token, index) => (
        <span
          key={`${row.playerId}-${token}-${index}`}
          style={{
            minWidth: '20px',
            height: '20px',
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 5px',
            fontSize: '0.58rem',
            fontWeight: 900,
            color: formColor(token),
            background: token === '-' ? 'rgba(148,163,184,0.08)' : 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          {token}
        </span>
      ))}
    </div>
  );

  const renderEmptyLeaderboard = (kind: LeaderboardKind) => (
    <motion.div
      key={`${kind}-empty`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="card-premium border-glow"
      style={{ minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '10px' }}
    >
      <Trophy size={28} style={{ color: 'var(--color-gold)' }} />
      <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{kind === 'scorers' ? 'Nessun marcatore ancora' : 'Nessun assist ancora'}</h3>
      <p style={{ maxWidth: '360px', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.45 }}>
        Simula una partita dal Match Center: appena un evento avra giocatore e assistman, questa classifica si popolera automaticamente.
      </p>
    </motion.div>
  );

  const renderPodium = (rows: PlayerSeasonStat[], kind: LeaderboardKind) => {
    const colors = ['var(--color-gold)', '#93C5FD', '#D8B4FE'];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px', marginBottom: '14px' }}>
        {rows.slice(0, 3).map((row, index) => {
          const isUser = row.clubName === teamName;
          return (
            <motion.div
              layout
              key={`${kind}-podium-${row.playerId}`}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.04 }}
              style={{
                padding: index === 0 ? '14px' : '11px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${isUser ? 'var(--color-pitch)' : 'var(--border-light)'}`,
                background: index === 0 ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(26,33,42,0.36))' : 'rgba(26,33,42,0.26)',
                boxShadow: index === 0 ? 'var(--shadow-glow)' : 'none'
              }}
              onClick={() => openPlayerStatSheet(row)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: colors[index], fontWeight: 900, fontSize: '0.8rem' }}>#{index + 1}</span>
                {isUser && <span className="badge" style={{ color: 'var(--color-pitch)', background: 'rgba(16,185,129,0.12)' }}>{teamName}</span>}
              </div>
              <strong style={{ display: 'block', fontSize: index === 0 ? '0.95rem' : '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.playerName}</strong>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', marginTop: '3px' }}>{row.clubName} - {row.role}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginTop: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{kind === 'scorers' ? 'Gol' : 'Assist'}</span>
                <strong style={{ color: colors[index], fontSize: index === 0 ? '1.4rem' : '1.1rem', lineHeight: 1 }}>
                  {kind === 'scorers' ? row.goals : row.assists}
                </strong>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const renderLeaderboard = (kind: LeaderboardKind) => {
    const rows = kind === 'scorers' ? topScorers : topAssistmen;
    if (rows.length === 0) return renderEmptyLeaderboard(kind);

    return (
      <motion.div
        key={kind}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        {renderPodium(rows, kind)}
        <div className="card-premium" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="premium-table">
            <thead>
              <tr>
                <th style={{ width: '60px', textAlign: 'center' }}>Pos</th>
                <th>Giocatore</th>
                <th>Squadra</th>
                <th style={{ textAlign: 'center' }}>Ruolo</th>
                <th style={{ textAlign: 'center' }}>Pres</th>
                {kind === 'scorers' ? (
                  <>
                    <th style={{ textAlign: 'center' }}>Gol</th>
                    <th style={{ textAlign: 'center' }}>Media gol</th>
                  </>
                ) : (
                  <>
                    <th style={{ textAlign: 'center' }}>Assist</th>
                    <th style={{ textAlign: 'center' }}>Occasioni create</th>
                  </>
                )}
                <th>Forma recente</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isUser = row.clubName === teamName;
                return (
                  <motion.tr
                    layout
                    key={`${kind}-${row.playerId}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: index * 0.025 }}
                    style={{
                      backgroundColor: isUser ? 'rgba(16,185,129,0.07)' : 'transparent',
                      borderLeft: isUser ? '3px solid var(--color-pitch)' : 'none',
                      cursor: findPlayerForStat(row) ? 'pointer' : 'default'
                    }}
                    onClick={() => openPlayerStatSheet(row)}
                  >
                    <td style={{ textAlign: 'center', fontWeight: 900, color: index < 3 ? 'var(--color-gold)' : 'var(--text-secondary)' }}>{index + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isUser && <Zap size={12} fill="var(--color-pitch)" color="var(--color-pitch)" />}
                        <strong style={{ fontSize: '0.82rem' }}>{row.playerName}</strong>
                      </div>
                    </td>
                    <td>{row.clubName}</td>
                    <td style={{ textAlign: 'center' }}><span className={roleBadgeClass(row.role)}>{row.role}</span></td>
                    <td style={{ textAlign: 'center' }}>{row.appearances}</td>
                    {kind === 'scorers' ? (
                      <>
                        <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--color-pitch)' }}>{row.goals}</td>
                        <td style={{ textAlign: 'center' }}>{goalAverage(row)}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: 'center', fontWeight: 900, color: '#93C5FD' }}>{row.assists}</td>
                        <td style={{ textAlign: 'center' }}>{row.chancesCreated}</td>
                      </>
                    )}
                    <td>{renderRecentForm(row)}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="page-wrapper">
      {/* Tab Switcher Headers */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-light)',
        marginBottom: '24px',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        {([
          { id: 'table' as const, label: 'Classifica', icon: Trophy },
          { id: 'scorers' as const, label: 'Marcatori', icon: Zap },
          { id: 'assists' as const, label: 'Assist', icon: BarChart2 },
          { id: 'calendar' as const, label: 'Calendario', icon: Calendar }
        ]).map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: active ? 'rgba(16,185,129,0.08)' : 'none',
                border: 'none',
                borderBottom: active ? '2.5px solid var(--color-pitch)' : '2.5px solid transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                padding: '12px 10px',
                fontSize: '0.95rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'color 0.2s, border-color 0.2s, background 0.2s',
                fontFamily: 'var(--font-heading)',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0'
              }}
            >
              <Icon size={16} style={{ color: active ? 'var(--color-pitch)' : 'var(--text-muted)' }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {activeTab === 'table' && (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="card-premium"
            style={{ padding: 0 }}
          >
            <table className="premium-table">
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center' }}>Pos</th>
                  <th>Squadra</th>
                  <th style={{ textAlign: 'center' }}>Pti</th>
                  <th style={{ textAlign: 'center' }}>G</th>
                  <th style={{ textAlign: 'center' }}>V</th>
                  <th style={{ textAlign: 'center' }}>N</th>
                  <th style={{ textAlign: 'center' }}>P</th>
                  <th style={{ textAlign: 'center' }}>GF</th>
                  <th style={{ textAlign: 'center' }}>GS</th>
                  <th style={{ textAlign: 'center' }}>DR</th>
                  <th>Forma ultime 5</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandings.map((team, idx) => {
                  const isUser = team.name === teamName;
                  const rank = idx + 1;
                  
                  return (
                    <motion.tr
                      layout
                      key={team.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.018 }}
                      onClick={() => openClubInfo(team.name)}
                      style={{
                        backgroundColor: isUser ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                        borderLeft: isUser ? '3px solid var(--color-pitch)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <td style={{
                        textAlign: 'center',
                        fontWeight: 700,
                        color: rank <= 4 ? 'var(--color-gold)' : rank >= 18 ? 'var(--color-danger)' : 'var(--text-secondary)'
                      }}>
                        {rank}
                      </td>
                      <td>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            openClubInfo(team.name);
                          }}
                          onKeyDown={(event) => handleClubKeyDown(event, team.name)}
                          style={clubButtonStyle}
                          aria-label={`Apri scheda club ${team.name}`}
                        >
                          <TeamLogo club={getClubByName(team.name)} initials={team.name.slice(0, 3).toUpperCase()} size={24} rounded={6} highlighted={isUser} />
                          {isUser && <Zap size={12} fill="var(--color-pitch)" color="var(--color-pitch)" />}
                          <span style={{ fontWeight: isUser ? 700 : 500 }}>{team.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)' }}>{team.points}</td>
                      <td style={{ textAlign: 'center' }}>{team.played}</td>
                      <td style={{ textAlign: 'center' }}>{team.wins}</td>
                      <td style={{ textAlign: 'center' }}>{team.draws}</td>
                      <td style={{ textAlign: 'center' }}>{team.losses}</td>
                      <td style={{ textAlign: 'center' }}>{team.goalsFor}</td>
                      <td style={{ textAlign: 'center' }}>{team.goalsAgainst}</td>
                      <td style={{ textAlign: 'center', color: team.goalDiff > 0 ? 'var(--color-pitch)' : team.goalDiff < 0 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                        {team.goalDiff > 0 ? `+${team.goalDiff}` : team.goalDiff}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {team.form.map((res, formIdx) => (
                            <span
                              key={formIdx}
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                fontSize: '0.6rem',
                                fontWeight: 800,
                                margin: '0 auto',
                                justifySelf: 'center',
                                justifyItems: 'center',
                                alignContent: 'center',
                                justifyContent: 'center',
                                backgroundColor: res === 'W' ? 'rgba(16, 185, 129, 0.2)' : res === 'D' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: res === 'W' ? 'var(--color-pitch)' : res === 'D' ? 'var(--color-gold)' : 'var(--color-danger)'
                              }}
                            >
                              {res}
                            </span>
                          ))}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )}
        {activeTab === 'scorers' && renderLeaderboard('scorers')}
        {activeTab === 'assists' && renderLeaderboard('assists')}
        {activeTab === 'calendar' && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {calendar.map((m) => {
              const isPlayed = m.status === 'played';
              const isNext = m.status === 'next';
              const userIsHome = m.isHome ?? true;
              const homeTeam = userIsHome ? teamName : m.opponent;
              const awayTeam = userIsHome ? m.opponent : teamName;
              const homeScore = userIsHome ? m.scoreUser : m.scoreOpponent;
              const awayScore = userIsHome ? m.scoreOpponent : m.scoreUser;

              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: isNext ? '1.5px solid var(--color-pitch)' : '1px solid var(--border-light)',
                    backgroundColor: isNext ? 'rgba(16, 185, 129, 0.04)' : isPlayed ? 'rgba(26, 33, 42, 0.2)' : 'var(--bg-surface-glass)',
                    boxShadow: isNext ? 'var(--shadow-glow)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', width: '90px' }}>
                      Giornata {m.id.split('_')[1]}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openClubInfo(homeTeam)}
                        onKeyDown={(event) => handleClubKeyDown(event, homeTeam)}
                        style={clubButtonStyle}
                        aria-label={`Apri scheda club ${homeTeam}`}
                      >
                        <TeamLogo club={getClubByName(homeTeam ?? '')} initials={(homeTeam ?? 'FC').slice(0, 3).toUpperCase()} size={24} rounded={6} highlighted={homeTeam === teamName} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{homeTeam}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vs</span>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => openClubInfo(awayTeam)}
                        onKeyDown={(event) => handleClubKeyDown(event, awayTeam)}
                        style={clubButtonStyle}
                        aria-label={`Apri scheda club ${awayTeam}`}
                      >
                        <TeamLogo club={getClubByName(awayTeam ?? '')} initials={(awayTeam ?? 'FC').slice(0, 3).toUpperCase()} size={24} rounded={6} highlighted={awayTeam === teamName} />
                        <strong style={{ fontSize: '0.85rem' }}>{awayTeam}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {isPlayed ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{
                          fontFamily: 'var(--font-heading)',
                          fontSize: '1rem',
                          fontWeight: 800,
                          backgroundColor: 'var(--bg-surface-elevated)',
                          padding: '4px 12px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-light)'
                        }}>
                          {homeScore} - {awayScore}
                        </span>
                        
                        <button
                          onClick={() => setSelectedMatchDetails(m)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        >
                          <Eye size={12} />
                          Report
                        </button>
                      </div>
                    ) : isNext ? (
                      <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--color-gold)' }}>
                        Prossimo Turno • {m.date}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {m.date}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match details report Modal */}
      <AnimatePresence>
        {selectedMatchDetails && (
          <div className="modal-backdrop" onClick={() => setSelectedMatchDetails(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-content"
              style={{ width: '550px' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Dettaglio Match</h3>
                <button
                  onClick={() => setSelectedMatchDetails(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Teams & Score */}
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0', marginBottom: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selectedHomeTeam}</h4>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Casa</span>
                </div>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-heading)',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  padding: '6px 20px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-light)'
                }}>
                  {selectedHomeScore} - {selectedAwayScore}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selectedAwayTeam}</h4>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Trasferta</span>
                </div>
              </div>

              {/* Stats and Events timeline grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* Left: Events */}
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    Timeline Eventi
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {selectedMatchDetails.events?.map((ev, idx) => (
                      <div key={idx} style={{ padding: '6px 8px', borderRadius: '4px', backgroundColor: 'rgba(26,33,42,0.3)', border: '1px solid var(--border-light)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--color-pitch)', fontWeight: 700 }}>{ev.minute}'</span> {ev.description}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Statistics values */}
                {selectedMatchDetails.stats && (
                  <div>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BarChart2 size={14} />
                      Statistiche Chiave
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.75rem' }}>
                      
                      {/* Possession */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span>Possesso</span>
                          <span>{selectedMatchDetails.stats.possession}% - {100 - selectedMatchDetails.stats.possession}%</span>
                        </div>
                        <div style={{ height: '4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '2px', display: 'flex' }}>
                          <div style={{ width: `${selectedMatchDetails.stats.possession}%`, height: '100%', backgroundColor: 'var(--color-pitch)', borderRadius: '2px 0 0 2px' }} />
                          <div style={{ width: `${100 - selectedMatchDetails.stats.possession}%`, height: '100%', backgroundColor: 'var(--text-muted)', borderRadius: '0 2px 2px 0' }} />
                        </div>
                      </div>

                      {/* Shots */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                        <span>Tiri (In Porta)</span>
                        <strong>{selectedMatchDetails.stats.shotsUser}({selectedMatchDetails.stats.shotsOnTargetUser}) - {selectedMatchDetails.stats.shotsOpponent}({selectedMatchDetails.stats.shotsOnTargetOpponent})</strong>
                      </div>

                      {/* xG */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px' }}>
                        <span>Expected Goals (xG)</span>
                        <strong>{selectedMatchDetails.stats.xGUser.toFixed(2)} - {selectedMatchDetails.stats.xGOpponent.toFixed(2)}</strong>
                      </div>

                      {/* Fouls */}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Falli</span>
                        <strong>{selectedMatchDetails.stats.foulsUser} - {selectedMatchDetails.stats.foulsOpponent}</strong>
                      </div>

                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ClubInfoModal
        club={selectedClubInfo}
        onClose={() => setSelectedClubInfo(null)}
        clubWorld={clubWorld}
        userTeamName={teamName}
        onCreateTransferTarget={onCreateTransferTarget}
        onNavigateMarket={() => onNavigate('market')}
      />

      <PlayerProfileModal
        player={playerSheet?.player ?? null}
        mode={playerSheet?.mode ?? 'quick'}
        onClose={() => setPlayerSheet(null)}
        onModeChange={mode => setPlayerSheet(current => current ? { ...current, mode } : current)}
        players={allKnownPlayers}
        playerStats={playerStats}
        contextLabel="Classifiche stagione"
      />

    </div>
  );
}
