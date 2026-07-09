import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Flag, Gauge, Heart, MapPin, Send, Shield, Star, Target, Trophy, Users, Wallet, X } from 'lucide-react';
import { ClubAIState, ClubProfile, Player } from '../../types';
import { createPlayersForClub } from '../../data/serieAData';
import { getPersonalityArchetype, getPersonalityShortNote } from '../../utils/playerPersonality';
import { getPlayerProjectRole, getProjectRoleColor } from '../../utils/playerProjectRole';
import PlayerProfileModal from './PlayerProfileModal';
import TeamLogo from './TeamLogo';
import { ModalPortal, useModalBehavior } from './BaseModal';

interface ClubInfoModalProps {
  club: ClubProfile | null;
  onClose: () => void;
  clubWorld?: ClubAIState[];
  userTeamName?: string;
  onCreateTransferTarget?: (player: Player, clubName: string) => void;
  onNavigateMarket?: () => void;
}

type ClubMeta = ClubProfile & {
  strength?: number;
  expectedRank?: number;
};

const roleBand = (role: Player['role']) => {
  if (role === 'GK') return 'GK';
  if (role.match(/CB|LB|RB/)) return 'DF';
  if (role.match(/DM|CM|AM/)) return 'MF';
  return 'FW';
};

const formatCurrency = (value: number) => new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
}).format(value);

const formatCompactCurrency = (value: number) => new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1
}).format(value);

const formatNumber = (value: number) => new Intl.NumberFormat('it-IT').format(value);

export default function ClubInfoModal({
  club,
  onClose,
  clubWorld = [],
  userTeamName,
  onCreateTransferTarget,
  onNavigateMarket
}: ClubInfoModalProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [playerSheet, setPlayerSheet] = useState<{ player: Player; mode: 'quick' | 'full' } | null>(null);
  const clubState = club ? clubWorld.find(item => item.name === club.name) : undefined;
  const roster = useMemo(() => {
    if (!club) return [];
    return [...(clubState?.roster ?? createPlayersForClub(club))].sort((a, b) => {
      if (b.overall !== a.overall) return b.overall - a.overall;
      return b.potential - a.potential;
    });
  }, [club, clubState?.roster]);

  useEffect(() => {
    setSelectedPlayerId(null);
    setPlayerSheet(null);
  }, [club?.id]);

  useModalBehavior(!!club, onClose);

  const meta = club as ClubMeta | null;
  const avgOverall = Math.round(roster.reduce((sum, player) => sum + player.overall, 0) / Math.max(1, roster.length));
  const avgPotential = Math.round(roster.reduce((sum, player) => sum + player.potential, 0) / Math.max(1, roster.length));
  const topPlayer = roster[0];
  const bestProspect = [...roster].sort((a, b) => {
    const growthA = a.potential - a.overall;
    const growthB = b.potential - b.overall;
    if (growthB !== growthA) return growthB - growthA;
    return b.potential - a.potential;
  })[0];
  const roleCounts = {
    GK: roster.filter(player => player.role === 'GK').length,
    DF: roster.filter(player => player.role.match(/CB|LB|RB/)).length,
    MF: roster.filter(player => player.role.match(/DM|CM|AM/)).length,
    FW: roster.filter(player => player.role.match(/LW|RW|ST/)).length
  };
  const focusedPlayer = roster.find(player => player.id === selectedPlayerId) ?? topPlayer;
  const focusedProjectRole = focusedPlayer ? getPlayerProjectRole(focusedPlayer) : null;
  const canCreateOffer = Boolean(club && focusedPlayer && club.name !== userTeamName && onCreateTransferTarget);

  const handleCreateOffer = () => {
    if (!club || !focusedPlayer || !onCreateTransferTarget) return;
    onCreateTransferTarget(focusedPlayer, club.name);
    onNavigateMarket?.();
    onClose();
  };

  const handlePlayerKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, playerId: string) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    const player = roster.find(item => item.id === playerId);
    if (!player) return;
    setSelectedPlayerId(playerId);
    setPlayerSheet({ player, mode: 'quick' });
  };

  const openPlayerSheet = (player: Player) => {
    setSelectedPlayerId(player.id);
    setPlayerSheet({ player, mode: 'quick' });
  };

  return (
    <ModalPortal>
    <AnimatePresence>
      {club && (
        <div className="modal-backdrop" onClick={onClose}>
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 16 }}
            className="modal-content"
            style={{
              width: 'min(980px, calc(100vw - 32px))',
              maxHeight: '88vh',
              overflowY: 'auto',
              padding: 0
            }}
            onClick={event => event.stopPropagation()}
          >
            <div
              style={{
                padding: '22px 24px',
                borderBottom: '1px solid var(--border-light)',
                background: `linear-gradient(135deg, ${club.primaryColor}24 0%, rgba(18, 23, 30, 0.98) 70%)`,
                display: 'flex',
                justifyContent: 'space-between',
                gap: '18px',
                alignItems: 'flex-start'
              }}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', minWidth: 0 }}>
                <TeamLogo club={club} size={72} rounded={16} highlighted />
                <div style={{ minWidth: 0 }}>
                  <span className="selection-kicker">Scheda club</span>
                  <h2 style={{ marginTop: '4px', fontSize: '1.9rem', lineHeight: 1 }}>{club.name}</h2>
                  <p style={{ marginTop: '8px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{club.highlight}</p>
                </div>
              </div>

              <button
                className="btn-secondary"
                onClick={onClose}
                aria-label="Chiudi scheda club"
                style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center', flex: '0 0 auto' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {[
                  { icon: MapPin, label: 'Stadio', value: club.stadium },
                  { icon: Users, label: 'Capienza', value: formatNumber(club.stadiumCapacity) },
                  { icon: Wallet, label: 'Fondi mercato', value: formatCurrency(clubState?.budget ?? club.transferBudget) },
                  { icon: Building2, label: 'Proprieta', value: club.ownership },
                  { icon: Flag, label: 'Allenatore', value: club.coach ? `${club.coach.name}${club.coach.overall ? ` (${club.coach.overall})` : ''}` : 'N/D' },
                  { icon: Trophy, label: 'Valore club', value: formatCompactCurrency(club.clubValue) },
                  { icon: Gauge, label: 'Pressione', value: `${club.pressure}/100` }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="club-mission-card" style={{ marginBottom: 0, minHeight: '102px' }}>
                      <div>
                        <Icon size={16} />
                        <span>{item.label}</span>
                      </div>
                      <strong>{item.value}</strong>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                <div className="club-mission-card" style={{ marginBottom: 0 }}>
                  <div>
                    <Target size={18} />
                    <span>Mandato dirigenza</span>
                  </div>
                  <strong>{club.objective}</strong>
                  <p>{club.boardPromise}</p>
                </div>

                {club.coach && (
                  <div className="club-mission-card" style={{ marginBottom: 0 }}>
                    <div>
                      <Flag size={18} />
                      <span>Guida tecnica</span>
                    </div>
                    <strong>{club.coach.name}{club.coach.nationality ? `, ${club.coach.nationality}` : ''}</strong>
                    <p>{club.coach.style ?? club.coach.strengths ?? 'Profilo allenatore caricato dal dataset rosa.'}</p>
                  </div>
                )}

                <div className="club-detail-list" style={{ gap: '8px' }}>
                  <div>
                    <Shield size={15} />
                    <span>Identita</span>
                    <strong>{club.playStyle}</strong>
                  </div>
                  <div>
                    <Flag size={15} />
                    <span>Vivaio</span>
                    <strong>{club.academy}</strong>
                  </div>
                  <div>
                    <Star size={15} />
                    <span>Ambiente</span>
                    <strong>{club.fanbase}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: '10px' }}>
                {[
                  { label: 'Rosa', value: `${roster.length} giocatori` },
                  { label: 'Media OVR', value: avgOverall },
                  { label: 'Media POT', value: avgPotential },
                  { label: 'Forza', value: meta?.strength ?? 'N/D' },
                  { label: 'Rank atteso', value: meta?.expectedRank ? `${meta.expectedRank} posto` : 'N/D' }
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(26, 33, 42, 0.34)',
                      padding: '12px'
                    }}
                  >
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>{item.label}</p>
                    <strong style={{ display: 'block', marginTop: '4px', fontSize: '1rem' }}>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {topPlayer && (
                  <div className="club-mission-card" style={{ marginBottom: 0 }}>
                    <div>
                      <Star size={16} />
                      <span>Leader tecnico</span>
                    </div>
                    <strong>{topPlayer.name}</strong>
                    <p>{topPlayer.role} - OVR {topPlayer.overall} - Valore {formatCompactCurrency(topPlayer.value)}</p>
                  </div>
                )}
                {bestProspect && (
                  <div className="club-mission-card" style={{ marginBottom: 0 }}>
                    <div>
                      <Users size={16} />
                      <span>Talento da curare</span>
                    </div>
                    <strong>{bestProspect.name}</strong>
                    <p>{bestProspect.age} anni - POT {bestProspect.potential} - crescita +{bestProspect.potential - bestProspect.overall}</p>
                  </div>
                )}
                <div className="club-mission-card" style={{ marginBottom: 0 }}>
                  <div>
                    <Shield size={16} />
                    <span>Copertura ruoli</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {Object.entries(roleCounts).map(([role, count]) => (
                      <span key={role} className={`badge badge-${role}`} style={{ fontWeight: 800 }}>
                        {role} {count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Rosa completa</h3>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Ordine per valore tecnico</span>
                </div>
                {clubState?.transferLog.length ? (
                  <div style={{ marginBottom: '10px', padding: '10px 12px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26, 33, 42, 0.32)' }}>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em', marginBottom: '4px' }}>Ultima mossa mercato IA</p>
                    <strong style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>{clubState.transferLog[0]}</strong>
                  </div>
                ) : null}

                {focusedPlayer && (
                  <div
                    style={{
                      marginBottom: '12px',
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(26, 33, 42, 0.42)',
                      padding: '14px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '14px',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em' }}>
                        Scheda giocatore
                      </p>
                      <h4 style={{ marginTop: '4px', fontSize: '1.05rem', fontWeight: 900 }}>{focusedPlayer.name}</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        <span className={`badge badge-${roleBand(focusedPlayer.role)}`}>{focusedPlayer.role}</span>
                        {focusedPlayer.secondaryRoles?.map(role => (
                          <span key={role} className={`badge badge-${roleBand(role)}`} style={{ opacity: 0.78 }}>{role}</span>
                        ))}
                      </div>
                      <p style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                        <strong style={{ color: 'var(--color-gold)' }}>{getPersonalityArchetype(focusedPlayer)}</strong> - {getPersonalityShortNote(focusedPlayer)}
                      </p>
                      {focusedProjectRole && (
                        <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          <span
                            title={`${focusedProjectRole.summary} ${focusedProjectRole.expectation}`}
                            style={{
                              border: `1px solid ${getProjectRoleColor(focusedProjectRole)}`,
                              borderRadius: '999px',
                              color: getProjectRoleColor(focusedProjectRole),
                              fontSize: '0.66rem',
                              fontWeight: 850,
                              padding: '3px 8px'
                            }}
                          >
                            {focusedProjectRole.label}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.66rem' }}>
                            Fiducia {focusedProjectRole.trust} / Tensione {focusedProjectRole.tension}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))', gap: '8px' }}>
                      {[
                        { label: 'Eta', value: focusedPlayer.age },
                        { label: 'Naz.', value: focusedPlayer.nationality },
                        { label: 'Ruolo file', value: focusedPlayer.sourceRole ?? focusedPlayer.role },
                        { label: 'Altezza', value: focusedPlayer.height ?? 'N/D' },
                        { label: 'Piede', value: focusedPlayer.preferredFoot ?? 'N/D' },
                        { label: 'Minuti', value: focusedPlayer.externalProfile?.minutes ?? 'N/D' },
                        { label: 'OVR', value: focusedPlayer.overall },
                        { label: 'POT', value: focusedPlayer.potential },
                        { label: 'Forma', value: focusedPlayer.form.toFixed(1) },
                        { label: 'Morale', value: `${focusedPlayer.morale}%` },
                        { label: 'Cond.', value: `${focusedPlayer.condition}%` },
                        { label: 'Resistenza', value: focusedPlayer.stamina },
                        { label: 'Ambizione', value: focusedPlayer.personality.ambition },
                        { label: 'Ego', value: focusedPlayer.personality.ego },
                        { label: 'Lealta', value: focusedPlayer.personality.loyalty },
                        { label: 'Contratto', value: `${focusedPlayer.contractYears} anni` },
                        { label: 'Valore', value: formatCompactCurrency(focusedPlayer.value) },
                        { label: 'Ingaggio', value: `${formatCompactCurrency(focusedPlayer.wage)}/sett.` }
                      ].map(item => (
                        <div key={item.label} style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '7px', padding: '8px', background: 'rgba(11, 15, 20, 0.22)' }}>
                          <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>{item.label}</p>
                          <strong style={{ display: 'block', marginTop: '3px', fontSize: '0.78rem' }}>{item.value}</strong>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '148px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: focusedPlayer.morale >= 80 ? 'var(--color-pitch)' : 'var(--color-gold)', fontSize: '0.72rem', fontWeight: 800 }}>
                        <Heart size={13} />
                        {focusedPlayer.status}
                      </div>
                      {canCreateOffer ? (
                        <button
                          className="btn-primary"
                          onClick={handleCreateOffer}
                          style={{ justifyContent: 'center', padding: '8px 10px', fontSize: '0.74rem' }}
                        >
                          <Send size={13} fill="#042F1A" />
                          Fai offerta
                        </button>
                      ) : (
                        <span style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.7rem', lineHeight: 1.35 }}>
                          {club.name === userTeamName ? 'Giocatore della tua rosa' : 'Trattativa non disponibile'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table className="premium-table" style={{ marginTop: 0, minWidth: '780px' }}>
                    <thead>
                      <tr>
                        <th>Giocatore</th>
                        <th>Ruolo</th>
                        <th style={{ textAlign: 'center' }}>Eta</th>
                        <th>Naz.</th>
                        <th style={{ textAlign: 'center' }}>OVR</th>
                        <th style={{ textAlign: 'center' }}>POT</th>
                        <th>Valore</th>
                        <th>Ingaggio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map(player => (
                        <tr
                          key={player.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openPlayerSheet(player)}
                          onKeyDown={event => handlePlayerKeyDown(event, player.id)}
                          style={{
                            cursor: 'pointer',
                            background: focusedPlayer?.id === player.id ? 'rgba(16, 185, 129, 0.08)' : undefined,
                            outline: 'none'
                          }}
                        >
                          <td style={{ fontWeight: 700 }}>{player.name}</td>
                          <td>
                            <span className={`badge badge-${roleBand(player.role)}`}>{player.role}</span>
                            {player.secondaryRoles?.length ? (
                              <span style={{ marginLeft: '6px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                + {player.secondaryRoles.join(', ')}
                              </span>
                            ) : null}
                          </td>
                          <td style={{ textAlign: 'center' }}>{player.age}</td>
                          <td>{player.nationality}</td>
                          <td style={{ textAlign: 'center', fontWeight: 800 }}>{player.overall}</td>
                          <td style={{ textAlign: 'center', color: player.potential > player.overall ? 'var(--color-lime)' : 'var(--text-secondary)', fontWeight: 800 }}>
                            {player.potential}
                          </td>
                          <td>{formatCompactCurrency(player.value)}</td>
                          <td>{formatCompactCurrency(player.wage)}/sett.</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
          <PlayerProfileModal
            player={playerSheet?.player ?? null}
            mode={playerSheet?.mode ?? 'quick'}
            onClose={() => setPlayerSheet(null)}
            onModeChange={mode => setPlayerSheet(current => current ? { ...current, mode } : current)}
            players={roster}
            contextLabel={club.name}
            canCreateOffer={Boolean(playerSheet?.player && club.name !== userTeamName && onCreateTransferTarget)}
            onCreateOffer={() => {
              if (!club || !playerSheet?.player || !onCreateTransferTarget) return;
              onCreateTransferTarget(playerSheet.player, club.name);
              setPlayerSheet(null);
              onNavigateMarket?.();
              onClose();
            }}
          />
        </div>
      )}
    </AnimatePresence>
    </ModalPortal>
  );
}
