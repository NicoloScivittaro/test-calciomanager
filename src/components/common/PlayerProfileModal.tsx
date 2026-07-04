import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Brain, Calendar, Dumbbell, Heart, HeartHandshake, Maximize2, ShieldCheck, X } from 'lucide-react';
import { ClubHistoryState, Player, PlayerRole, PlayerSeasonStat } from '../../types';
import { getPlayerFitnessStatus } from '../../utils/playerFitness';
import { getPersonalityArchetype, getPersonalityShortNote } from '../../utils/playerPersonality';
import { getPlayerProjectRole, getProjectRoleColor } from '../../utils/playerProjectRole';

type PlayerProfileMode = 'quick' | 'full';

interface PlayerProfileModalProps {
  player: Player | null;
  mode: PlayerProfileMode;
  onClose: () => void;
  onModeChange: (mode: PlayerProfileMode) => void;
  players?: Player[];
  starters?: string[];
  bench?: string[];
  playerStats?: PlayerSeasonStat[];
  clubHistory?: ClubHistoryState;
  currentRound?: number;
  contextLabel?: string;
  actions?: React.ReactNode;
  onCreateOffer?: () => void;
  canCreateOffer?: boolean;
}

const roleBand = (role: PlayerRole) => {
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

const formatStatValue = (value: string | number) => (
  typeof value === 'number'
    ? value.toLocaleString('it-IT', { maximumFractionDigits: 2 })
    : value
);

const traitColor = (value: number) => (
  value >= 75 ? 'var(--color-pitch)' :
  value >= 55 ? 'var(--color-gold)' :
  'var(--color-danger)'
);

const traitBar = (label: string, value: number) => (
  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.7rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <strong style={{ color: traitColor(value) }}>{value}</strong>
    </div>
    <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: traitColor(value) }} />
    </div>
  </div>
);

const infoTile = (label: string, value: React.ReactNode, tone = 'var(--text-primary)') => (
  <div key={label} style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px', background: 'rgba(11, 15, 20, 0.25)' }}>
    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.64rem', textTransform: 'uppercase', fontWeight: 850 }}>{label}</span>
    <strong style={{ display: 'block', marginTop: '5px', color: tone, fontSize: '0.84rem' }}>{value}</strong>
  </div>
);

const getAttributes = (player: Player) => {
  const sourceAttributes = Object.entries(player.attributes ?? {})
    .filter(([, value]) => Number.isFinite(value))
    .map(([label, val]) => ({ label, val }));

  if (sourceAttributes.length) return sourceAttributes;

  const isGK = player.role === 'GK';
  const isDF = ['CB', 'LB', 'RB'].includes(player.role);
  const isMF = ['DM', 'CM', 'AM'].includes(player.role);

  if (isGK) {
    return [
      { label: 'Riflessi', val: player.overall + 3 },
      { label: 'Presa', val: player.overall - 1 },
      { label: 'Rinvio', val: player.overall - 4 },
      { label: 'Piazzamento', val: player.overall }
    ];
  }
  if (isDF) {
    return [
      { label: 'Velocità', val: player.overall - 6 },
      { label: 'Forza', val: player.overall + 5 },
      { label: 'Marcatura', val: player.overall + 2 },
      { label: 'Colpo di Testa', val: player.overall + 4 }
    ];
  }
  if (isMF) {
    return [
      { label: 'Resistenza', val: player.overall + 6 },
      { label: 'Pass. Corto', val: player.overall + 4 },
      { label: 'Visione', val: player.overall + 1 },
      { label: 'Dribbling', val: player.overall - 1 }
    ];
  }
  return [
    { label: 'Velocità', val: player.overall + 5 },
    { label: 'Dribbling', val: player.overall + 3 },
    { label: 'Tiro', val: player.overall + 4 },
    { label: 'Posizionamento', val: player.overall + 2 }
  ];
};

export default function PlayerProfileModal({
  player,
  mode,
  onClose,
  onModeChange,
  players = [],
  starters = [],
  bench = [],
  playerStats = [],
  clubHistory,
  currentRound = 1,
  contextLabel,
  actions,
  onCreateOffer,
  canCreateOffer = false
}: PlayerProfileModalProps) {
  if (!player) return null;

  const projectRole = getPlayerProjectRole(player, {
    starters,
    bench,
    seasonStats: playerStats,
    clubHistory,
    round: currentRound
  });
  const projectRoleColor = getProjectRoleColor(projectRole);
  const fitness = getPlayerFitnessStatus(player);
  const stats = playerStats.find(row => row.playerId === player.id || row.playerName === player.name);

  return (
    <AnimatePresence>
      <div
        className={`player-profile-backdrop ${mode === 'full' ? 'full' : 'quick'}`}
        onClick={event => {
          event.stopPropagation();
          onClose();
        }}
      >
        <motion.div
          initial={mode === 'full' ? { opacity: 0, scale: 0.98, y: 14 } : { opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          transition={{ type: 'spring', damping: 24, stiffness: 230 }}
          className={`player-profile-card ${mode}`}
          onClick={event => event.stopPropagation()}
        >
          <div className="player-profile-hero">
            <div style={{ minWidth: 0 }}>
              <span className="selection-kicker">{contextLabel ?? 'Scheda giocatore'}</span>
              <h2>{player.name}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginTop: '10px' }}>
                <span className={`badge badge-${roleBand(player.role)}`}>{player.role}</span>
                {player.secondaryRoles?.map(role => (
                  <span key={role} className={`badge badge-${roleBand(role)}`} style={{ opacity: 0.78 }}>{role}</span>
                ))}
                <span className="badge" style={{ color: projectRoleColor, background: 'rgba(11,15,20,0.34)', border: `1px solid ${projectRoleColor}` }}>
                  {projectRole.label}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {mode === 'quick' ? (
                <button className="btn-primary" onClick={() => onModeChange('full')} style={{ padding: '8px 10px', fontSize: '0.72rem' }}>
                  <Maximize2 size={13} />
                  Scheda completa
                </button>
              ) : (
                <button className="btn-secondary" onClick={() => onModeChange('quick')} style={{ padding: '8px 10px', fontSize: '0.72rem' }}>
                  Scheda rapida
                </button>
              )}
              <button className="btn-secondary" onClick={onClose} style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center' }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {mode === 'quick' ? (
            <div className="player-profile-quick-grid">
              <div className="player-profile-score">
                <span>OVR</span>
                <strong>{player.overall}</strong>
                <small>Potenziale {player.potential}</small>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                {infoTile('Età', `${player.age} anni`)}
                {infoTile('Nazione', player.nationality)}
                {infoTile('Forma', player.form.toFixed(1), 'var(--color-lime)')}
                {infoTile('Morale', `${player.morale}%`, traitColor(player.morale))}
                {infoTile('Condizione', `${player.condition}%`, traitColor(player.condition))}
                {infoTile('Valore', formatCurrency(player.value))}
              </div>
              <div className="card-premium" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: projectRoleColor, fontWeight: 850, fontSize: '0.8rem' }}>
                  <ShieldCheck size={14} />
                  {projectRole.label}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', lineHeight: 1.42 }}>{projectRole.summary}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px' }}>
                  {traitBar('Fiducia', projectRole.trust)}
                  {traitBar('Tensione', projectRole.tension)}
                </div>
              </div>
              <div className="card-premium" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--color-gold)', fontWeight: 850, fontSize: '0.8rem' }}>
                  <Brain size={14} />
                  {getPersonalityArchetype(player)}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.74rem', lineHeight: 1.42 }}>{getPersonalityShortNote(player)}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  <span>Stato</span>
                  <strong style={{ color: player.status === 'Cedibile' ? 'var(--color-danger)' : 'var(--color-pitch)' }}>{player.status}</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', gridColumn: '1 / -1' }}>
                {canCreateOffer && (
                  <button className="btn-primary" onClick={onCreateOffer}>
                    Fai offerta
                  </button>
                )}
                {actions}
              </div>
            </div>
          ) : (
            <div className="player-profile-full-grid">
              <section className="card-premium player-profile-section">
                <h3><Award size={16} /> Identità tecnica</h3>
                <div className="player-profile-stat-grid">
                  {infoTile('Overall', player.overall, 'var(--color-gold)')}
                  {infoTile('Potenziale', player.potential, player.potential > player.overall ? 'var(--color-lime)' : 'var(--text-primary)')}
                  {infoTile('Ruolo', player.role)}
                  {infoTile('Età', `${player.age} anni`)}
                  {infoTile('Nazionalità', player.nationality)}
                  {infoTile('Stato', player.status, player.status === 'Cedibile' ? 'var(--color-danger)' : 'var(--color-pitch)')}
                  {infoTile('Valore', formatCurrency(player.value))}
                  {infoTile('Ingaggio', `${formatCurrency(player.wage)}/sett.`)}
                  {infoTile('Contratto', `${player.contractYears} anni`)}
                  {infoTile('Altezza', player.height ?? 'N/D')}
                  {infoTile('Piede', player.preferredFoot ?? 'N/D')}
                  {infoTile('Fonte ruolo', player.sourceRole ?? player.role)}
                </div>
              </section>

              <section className="card-premium player-profile-section">
                <h3><ShieldCheck size={16} /> Posto nel progetto</h3>
                <strong style={{ color: projectRoleColor }}>{projectRole.label}</strong>
                <p>{projectRole.summary}</p>
                <p>{projectRole.expectation}</p>
                <div className="player-profile-stat-grid two">
                  {traitBar('Fiducia', projectRole.trust)}
                  {traitBar('Tensione', projectRole.tension)}
                  {infoTile('Spogliatoio', projectRole.dressingRoomWeight > 0 ? `+${projectRole.dressingRoomWeight}` : projectRole.dressingRoomWeight, projectRole.dressingRoomWeight >= 0 ? 'var(--color-pitch)' : 'var(--color-danger)')}
                  {infoTile('Tifosi', projectRole.fanWeight > 0 ? `+${projectRole.fanWeight}` : projectRole.fanWeight, projectRole.fanWeight >= 0 ? 'var(--color-pitch)' : 'var(--color-danger)')}
                </div>
                {projectRole.reasons.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {projectRole.reasons.map(reason => <span key={reason}>- {reason}</span>)}
                  </div>
                )}
              </section>

              <section className="card-premium player-profile-section">
                <h3><Dumbbell size={16} /> Forma, fisico e stagione</h3>
                <div className="player-profile-stat-grid">
                  {infoTile('Forma', player.form.toFixed(1), 'var(--color-lime)')}
                  {infoTile('Morale', `${player.morale}%`, traitColor(player.morale))}
                  {infoTile('Condizione', `${player.condition}%`, traitColor(player.condition))}
                  {infoTile('Resistenza', player.stamina)}
                  {infoTile('Titolarità fila', fitness.consecutiveStarts)}
                  {infoTile('Soglia riposo', fitness.restThreshold)}
                  {infoTile('Rischio infortunio', `${fitness.injuryRisk}%`, fitness.injuryRisk >= 18 ? 'var(--color-danger)' : 'var(--text-primary)')}
                  {infoTile('Status fisico', fitness.label, fitness.needsRest ? 'var(--color-gold)' : 'var(--color-pitch)')}
                  {infoTile('Presenze', stats?.appearances ?? player.careerMemory.appearances)}
                  {infoTile('Gol', stats?.goals ?? player.careerMemory.goals)}
                  {infoTile('Assist', stats?.assists ?? 0)}
                  {infoTile('Rating fonte', player.externalProfile?.rating?.toFixed(2) ?? 'N/D')}
                </div>
              </section>

              <section className="card-premium player-profile-section">
                <h3><Award size={16} /> Attributi</h3>
                <div className="player-profile-stat-grid">
                  {getAttributes(player).map(attr => infoTile(attr.label, attr.val, Number(attr.val) >= 85 ? 'var(--color-pitch)' : Number(attr.val) >= 78 ? 'var(--color-gold)' : 'var(--text-primary)'))}
                </div>
              </section>

              <section className="card-premium player-profile-section">
                <h3><Brain size={16} /> Personalità</h3>
                <strong>{getPersonalityArchetype(player)}</strong>
                <p>{getPersonalityShortNote(player)}</p>
                <div className="player-profile-stat-grid two">
                  {traitBar('Ambizione', player.personality.ambition)}
                  {traitBar('Lealtà', player.personality.loyalty)}
                  {traitBar('Ego', player.personality.ego)}
                  {traitBar('Professionalità', player.personality.professionalism)}
                  {traitBar('Freddezza', player.personality.composure)}
                  {traitBar('Leadership', player.personality.leadership)}
                  {traitBar('Panchina', player.personality.benchTolerance)}
                  {traitBar('Pressione media', player.personality.mediaPressure)}
                </div>
              </section>

              <section className="card-premium player-profile-section">
                <h3><HeartHandshake size={16} /> Relazioni e memoria</h3>
                <div className="player-profile-stat-grid two">
                  {traitBar('Allenatore', player.relationships.coach)}
                  {traitBar('Compagni', player.relationships.teammates)}
                  {traitBar('Tifosi', player.relationships.fans)}
                  {traitBar('Agente', player.relationships.agent)}
                  {traitBar('Voglia big', player.personality.bigClubDesire)}
                  {traitBar('Bandiera', player.personality.oneClubManDesire)}
                </div>
                <p>Mentore: <strong>{players.find(item => item.id === player.relationships.mentorId)?.name ?? 'nessuno'}</strong></p>
                <p>Rivalità interne: <strong>{player.relationships.rivalIds?.map(id => players.find(item => item.id === id)?.name).filter(Boolean).join(', ') || 'nessuna'}</strong></p>
                <p>Leggenda: <strong>{Math.round(player.careerMemory.legendScore)}/100</strong></p>
              </section>

              {player.externalProfile && (
                <section className="card-premium player-profile-section wide">
                  <h3><Calendar size={16} /> Dati Excel 2025/26</h3>
                  <div className="player-profile-stat-grid">
                    {[
                      ['Ruolo file', player.sourceRole ?? player.externalProfile.sourceRole],
                      ['Altezza', player.height ?? player.externalProfile.height],
                      ['Piede', player.preferredFoot ?? player.externalProfile.preferredFoot],
                      ['Valore fonte', player.valueLabel ?? player.externalProfile.valueLabel],
                      ['Minuti', player.externalProfile.minutes],
                      ['Gol', player.externalProfile.goals],
                      ['Assist', player.externalProfile.assists],
                      ['Rating', player.externalProfile.rating],
                      ['Copertura', player.externalProfile.coverage],
                      ['Gerarchia', player.externalProfile.hierarchy]
                    ].filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => infoTile(label as string, formatStatValue(value as string | number)))}
                  </div>
                  {player.externalProfile.statsSummary && <p>{player.externalProfile.statsSummary}</p>}
                  {player.externalProfile.note && <p>{player.externalProfile.note}</p>}
                  {player.externalProfile.rawStats && (
                    <div className="player-profile-raw-grid">
                      {Object.entries(player.externalProfile.rawStats).map(([label, value]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{formatStatValue(value)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {actions && (
                <section className="card-premium player-profile-section wide">
                  <h3><Heart size={16} /> Azioni</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>{actions}</div>
                </section>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
