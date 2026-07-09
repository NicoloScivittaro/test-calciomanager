import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Brain, Calendar, Dumbbell, FileSignature, GraduationCap, Heart, HeartHandshake, Maximize2, MessageCircle, Radio, ShieldCheck, Stethoscope, Target, TrendingUp, X } from 'lucide-react';
import { ClubHistoryState, ClubProfile, ClubStaffState, FutureContractAgreement, Negotiation, Player, PlayerClubHistoryEntry, PlayerConversationState, PlayerRole, PlayerPublicProfile, PlayerSeasonStat } from '../../types';
import { getClubStaffMember } from '../../utils/staff';
import { buildInitialPlayerContract, CONTRACT_SQUAD_ROLE_LABELS, getContractStatusLabel } from '../../utils/playerContracts';
import { CURRENT_SEASON } from '../../utils/clubHistory';
import { isFreeAgent } from '../../utils/transferDeals';
import { NEGOTIATION_STATUS_LABELS } from '../../utils/marketIntelligence';
import { ModalPortal, useModalBehavior } from './BaseModal';
import { getManagedReturnRecommendation, getPlayerAvailabilitySummary, getPlayerFitnessStatus, INJURY_BODY_AREA_LABELS, INJURY_TYPE_LABELS } from '../../utils/playerFitness';
import {
  getDevelopmentSummary,
  getRoleFamiliarityEntry,
  ROLE_FAMILIARITY_STATUS_LABELS,
  TRAINING_FOCUS_LABELS,
  TRAINING_INTENSITY_LABELS,
  TRAINING_PLAN_STATUS_LABELS
} from '../../utils/playerDevelopment';
import { getPersonalityArchetype, getPersonalityShortNote } from '../../utils/playerPersonality';
import { getPlayerProjectRole, getProjectRoleColor } from '../../utils/playerProjectRole';
import { formatFollowersEstimate } from '../../utils/emotionalNarratives';
import { getPlayingTimePromiseProgress, PLAYING_TIME_PROMISE_OPTIONS } from '../../utils/playerPromises';
import { getPlayerRoleAttributes } from '../../utils/playerAttributes';
import { getOpenConversationForPlayer } from '../../utils/playerDialogue';

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
  playerPublicProfiles?: PlayerPublicProfile[];
  currentRound?: number;
  contextLabel?: string;
  actions?: React.ReactNode;
  onCreateOffer?: () => void;
  canCreateOffer?: boolean;
  onCreatePlayingTimePromise?: (playerId: string, targetMinutes: number) => void;
  playerConversations?: PlayerConversationState;
  onOpenConversation?: (player: Player) => void;
  clubStaffState?: ClubStaffState;
  clubProfile?: ClubProfile;
  onRenewContract?: (player: Player) => void;
  futureContractAgreements?: FutureContractAgreement[];
  activeNegotiation?: Negotiation;
}

const YOUTH_STATUS_LABELS: Record<string, string> = {
  prospect: 'Da osservare',
  high_potential: 'Alto potenziale',
  promotion_candidate: 'Candidato promozione',
  promoted: 'Promosso in prima squadra',
  released: 'Rilasciato dal vivaio'
};

const PROMISE_STATUS_LABELS: Record<string, string> = {
  active: 'In corso',
  at_risk: 'A rischio',
  completed: 'Mantenuta',
  broken: 'Non mantenuta'
};

const promiseStatusColor = (status: string) => (
  status === 'completed' ? 'var(--color-pitch)' :
  status === 'broken' ? 'var(--color-danger)' :
  status === 'at_risk' ? 'var(--color-gold)' :
  'var(--text-secondary)'
);

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

const TRANSFER_TYPE_LABELS: Record<string, string> = {
  initial: 'Al club dall\'inizio della carriera',
  purchase: 'Acquisto',
  sale: 'Cessione',
  loan: 'Prestito'
};

const renderCareerHistoryEntry = (entry: PlayerClubHistoryEntry, index: number) => (
  <div key={`${entry.clubId}_${entry.joinedSeason}_${index}`} style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 10px', background: 'rgba(11, 15, 20, 0.25)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
      <strong style={{ fontSize: '0.8rem' }}>{entry.clubName}</strong>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{entry.joinedSeason} — {entry.leftSeason ?? 'Oggi'}</span>
    </div>
    {entry.transferType !== 'initial' && (
      <span style={{ display: 'block', marginTop: '3px', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
        {TRANSFER_TYPE_LABELS[entry.transferType]}{entry.fee !== undefined ? `: ${formatCurrency(entry.fee)}` : ''}
      </span>
    )}
  </div>
);

// Mercato M2A: sezione compatta "Clausole trasferimento" (diritti attivi, beneficiario,
// prezzo/percentuale, scadenza, stato). Nessun badge/attivazione IA finta per clausole di terzi.
const CLAUSE_STATUS_LABELS: Record<string, string> = {
  active: 'Attiva',
  triggered: 'Applicata',
  exercised: 'Esercitato',
  expired: 'Scaduta',
  waived: 'Rinunciata'
};

const clauseStatusColor = (status: string) => (
  status === 'active' ? 'var(--color-gold)' :
  status === 'triggered' || status === 'exercised' ? 'var(--color-pitch)' :
  'var(--text-muted)'
);

const renderTransferClausesSection = (player: Player, myClubId?: string) => {
  const sellOnClauses = player.sellOnClauses ?? [];
  const buyBackClauses = player.buyBackClauses ?? [];
  const firstRefusalClauses = player.firstRefusalClauses ?? [];
  const antiRivalClauses = player.antiRivalClauses ?? [];
  const activeLoanSwap = player.loanState?.loanSwapId ? player.loanState : undefined;
  if (sellOnClauses.length === 0 && buyBackClauses.length === 0 && firstRefusalClauses.length === 0 && antiRivalClauses.length === 0 && !activeLoanSwap) return null;

  return (
    <section className="card-premium player-profile-section">
      <h3><TrendingUp size={16} /> Clausole trasferimento</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {activeLoanSwap && (
          <div style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 10px', background: 'rgba(11, 15, 20, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
              <strong style={{ fontSize: '0.78rem' }}>Scambio di prestiti attivo</strong>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-lime)', fontWeight: 700 }}>In corso</span>
            </div>
            <span style={{ display: 'block', marginTop: '3px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Di proprieta del {activeLoanSwap.parentClubName}, fine prestito {activeLoanSwap.endSeason}.
            </span>
          </div>
        )}
        {firstRefusalClauses.filter(c => c.status === 'active').map(clause => (
          <div key={clause.id} style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 10px', background: myClubId === clause.holderClubId ? 'rgba(212,175,55,0.1)' : 'rgba(11, 15, 20, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
              <strong style={{ fontSize: '0.78rem' }}>Diritto di prelazione</strong>
              <span style={{ fontSize: '0.7rem', color: clauseStatusColor(clause.status), fontWeight: 700 }}>{CLAUSE_STATUS_LABELS[clause.status]}</span>
            </div>
            <span style={{ display: 'block', marginTop: '3px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {myClubId === clause.holderClubId
                ? `Il tuo club potra' eguagliare una futura offerta reale fino al ${clause.expirySeason}.`
                : `Il ${clause.holderClubName} potra' eguagliare una futura offerta reale fino al ${clause.expirySeason}.`}
            </span>
          </div>
        ))}
        {antiRivalClauses.filter(c => c.status === 'active').map(clause => (
          <div key={clause.id} style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 10px', background: 'rgba(11, 15, 20, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
              <strong style={{ fontSize: '0.78rem' }}>Clausola anti-rivale ({clause.mode === 'block' ? 'divieto vendita' : `penale ${clause.penaltyPercent}%`})</strong>
              <span style={{ fontSize: '0.7rem', color: clauseStatusColor(clause.status), fontWeight: 700 }}>{CLAUSE_STATUS_LABELS[clause.status]}</span>
            </div>
            <span style={{ display: 'block', marginTop: '3px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              Club coinvolti: {clause.restrictedClubNames.join(', ')} · Scadenza: {clause.expirySeason}
            </span>
          </div>
        ))}
        {sellOnClauses.map(clause => (
          <div key={clause.id} style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 10px', background: 'rgba(11, 15, 20, 0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
              <strong style={{ fontSize: '0.78rem' }}>{clause.percentage}% {clause.type === 'gross_sale' ? 'futura rivendita' : 'futura plusvalenza'}</strong>
              <span style={{ fontSize: '0.7rem', color: clauseStatusColor(clause.status), fontWeight: 700 }}>{CLAUSE_STATUS_LABELS[clause.status]}</span>
            </div>
            <span style={{ display: 'block', marginTop: '3px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Beneficiario: {clause.beneficiaryClubName}</span>
          </div>
        ))}
        {buyBackClauses.map(clause => {
          const isMine = myClubId !== undefined && clause.holderClubId === myClubId;
          return (
            <div key={clause.id} style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 10px', background: isMine && clause.status === 'active' ? 'rgba(212,175,55,0.1)' : 'rgba(11, 15, 20, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                <strong style={{ fontSize: '0.78rem' }}>Contro-riscatto {formatCurrency(clause.buyBackFee)}</strong>
                <span style={{ fontSize: '0.7rem', color: clauseStatusColor(clause.status), fontWeight: 700 }}>{CLAUSE_STATUS_LABELS[clause.status]}</span>
              </div>
              <span style={{ display: 'block', marginTop: '3px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {isMine
                  ? `Il tuo club conserva il diritto di riacquisto fino al ${clause.expirySeason}.`
                  : `Il ${clause.holderClubName} conserva un diritto di riacquisto fino al ${clause.expirySeason}.`}
              </span>
              {!isMine && clause.status === 'active' && (
                <span style={{ display: 'block', marginTop: '2px', fontSize: '0.62rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Nessuna attivazione automatica: l'IA non esercita ancora questo diritto in questa fase.
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// Mercato M2B: precontratto attivo per questo giocatore, se presente (mai per giocatori gia' miei).
const renderFutureAgreementSection = (agreement: FutureContractAgreement) => (
  <section className="card-premium player-profile-section">
    <h3><Calendar size={16} /> Accordo per la prossima stagione</h3>
    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
      Precontratto firmato in {agreement.agreedAtSeason}: si trasferira a parametro zero dal {agreement.currentClubName}, effettivo dalla stagione {agreement.effectiveSeason}.
    </p>
    <div className="player-profile-stat-grid">
      {infoTile('Stipendio annuo', formatCurrency(agreement.annualSalary))}
      {infoTile('Durata', `${agreement.durationYears} anni`)}
      {infoTile('Ruolo concordato', CONTRACT_SQUAD_ROLE_LABELS[agreement.squadRole])}
      {infoTile('Bonus firma', formatCurrency(agreement.signingBonus))}
      {infoTile('Commissione agente', formatCurrency(agreement.agentFee))}
    </div>
  </section>
);

// Mercato M3: fase corrente, stato medico sintetico, deadline. Nessun dato medico sensibile o eccessivo.
const renderActiveNegotiationSection = (negotiation: Negotiation) => (
  <section className="card-premium player-profile-section">
    <h3><FileSignature size={16} /> Trattativa in corso</h3>
    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
      Fase attuale: <strong>{NEGOTIATION_STATUS_LABELS[negotiation.status]}</strong>
    </p>
    {negotiation.medicalCheck && (negotiation.status === 'medical_warning' || negotiation.status === 'medical_pending') && (
      <p style={{ fontSize: '0.72rem', color: 'var(--color-gold)' }}>
        Stato medico: {negotiation.medicalCheck.riskSummary ?? 'in valutazione'}
      </p>
    )}
    {negotiation.expiresAtRound !== undefined && (
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Scade alla giornata {negotiation.expiresAtRound}</p>
    )}
  </section>
);

const renderCareerHistorySection = (player: Player) => {
  const entries = [...(player.clubHistory ?? [])].reverse();
  return (
    <section className="card-premium player-profile-section">
      <h3><Calendar size={16} /> Carriera nel salvataggio</h3>
      {entries.length <= 1 ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Al club dall'inizio della carriera.</p>
      ) : entries.length > 4 ? (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{entries.length} squadre nel salvataggio</summary>
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {entries.map(renderCareerHistoryEntry)}
          </div>
        </details>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {entries.map(renderCareerHistoryEntry)}
        </div>
      )}
    </section>
  );
};

// Griglia attributi canonica per famiglia di ruolo (stesso numero/ordine/significato per tutti i
// giocatori dello stesso ruolo): src/utils/playerAttributes.ts, riusata anche da Squad.tsx.
const getAttributes = getPlayerRoleAttributes;

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
  playerPublicProfiles = [],
  currentRound = 1,
  contextLabel,
  actions,
  onCreateOffer,
  canCreateOffer = false,
  onCreatePlayingTimePromise,
  playerConversations,
  onOpenConversation,
  clubStaffState,
  clubProfile,
  onRenewContract,
  futureContractAgreements = [],
  activeNegotiation
}: PlayerProfileModalProps) {
  useModalBehavior(!!player, onClose);
  if (!player) return null;

  const activeFutureAgreement = futureContractAgreements.find(a => a.playerId === player.id && a.status === 'active');
  const playerIsFreeAgent = isFreeAgent(player);

  const projectRole = getPlayerProjectRole(player, {
    starters,
    bench,
    seasonStats: playerStats,
    clubHistory,
    round: currentRound
  });
  const projectRoleColor = getProjectRoleColor(projectRole);
  const fitness = getPlayerFitnessStatus(player);
  const availability = getPlayerAvailabilitySummary(player, currentRound);
  const managedReturnNote = getManagedReturnRecommendation(player);
  const availabilityColor =
    availability.label === 'Disponibile' ? 'var(--color-pitch)' :
    availability.label === 'Rientro controllato' ? 'var(--color-gold)' :
    availability.label === 'Da monitorare' ? 'var(--color-gold)' :
    'var(--color-danger)';
  const stats = playerStats.find(row => row.playerId === player.id || row.playerName === player.name);
  const publicProfile = playerPublicProfiles.find(profile => profile.playerId === player.id);
  const activePromise = player.playingTimePromise;
  const canPromise = Boolean(onCreatePlayingTimePromise) && (!activePromise || activePromise.status === 'completed' || activePromise.status === 'broken');
  const openConversation = playerConversations ? getOpenConversationForPlayer(playerConversations, player.id) : undefined;
  const hasUnreadConversation = Boolean(openConversation?.unreadForManager);

  const handlePromiseChoice = (label: string, targetMinutes: number) => {
    const confirmed = window.confirm(`Prometti a ${player.name} un minutaggio da "${label}" (obiettivo ${targetMinutes} minuti stagionali)?\nVuoi continuare?`);
    if (!confirmed) return;
    onCreatePlayingTimePromise?.(player.id, targetMinutes);
  };

  return (
    <ModalPortal>
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
                {player.buyBackClauses?.some(c => c.status === 'active' && c.holderClubId === clubProfile?.id) && (
                  <span className="badge" style={{ color: 'var(--color-gold)', border: '1px solid var(--color-gold)' }}>Contro-riscatto disponibile</span>
                )}
                {playerIsFreeAgent && <span className="badge">Svincolato</span>}
                {activeFutureAgreement && <span className="badge" style={{ color: 'var(--color-pitch)' }}>Accordo futuro firmato</span>}
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
              <button className="btn-secondary" onClick={onClose} aria-label="Chiudi scheda giocatore" style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center' }}>
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
                {infoTile('Disponibilità', availability.label, availabilityColor)}
                {infoTile('Valore', formatCurrency(player.value))}
                {infoTile('Presenze', stats?.appearances ?? player.careerMemory.appearances)}
                {infoTile('Gol', stats?.goals ?? player.careerMemory.goals)}
                {infoTile('Assist', stats?.assists ?? 0)}
                {infoTile('Media voto', stats && stats.appearances > 0 ? stats.averageRating.toFixed(2) : '-', stats && stats.averageRating >= 6.5 ? 'var(--color-lime)' : undefined)}
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
              <div className="card-premium" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '9px', gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--color-gold)', fontWeight: 850, fontSize: '0.8rem' }}>
                  <Target size={14} />
                  Promesse e Ruolo
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px', fontSize: '0.72rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Ruolo percepito</span>
                    <strong style={{ color: projectRoleColor }}>{projectRole.label}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Minuti stagionali</span>
                    <strong>{stats?.minutesPlayed ?? 0}'</strong>
                  </div>
                </div>
                {traitBar('Soddisfazione ruolo', projectRole.trust)}

                {activePromise && (activePromise.status === 'active' || activePromise.status === 'at_risk') ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Promessa attiva</span>
                      <strong style={{ color: promiseStatusColor(activePromise.status) }}>{PROMISE_STATUS_LABELS[activePromise.status]}</strong>
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{activePromise.description}</p>
                    <div style={{ height: '5px', borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ width: `${getPlayingTimePromiseProgress(activePromise)}%`, height: '100%', background: promiseStatusColor(activePromise.status) }} />
                    </div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                      {activePromise.currentMinutes}' / {activePromise.targetMinutes}' ({getPlayingTimePromiseProgress(activePromise)}%)
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '1px solid var(--border-light)' }}>
                    {activePromise && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Ultima promessa</span>
                        <strong style={{ color: promiseStatusColor(activePromise.status) }}>{PROMISE_STATUS_LABELS[activePromise.status]}</strong>
                      </div>
                    )}
                    {canPromise ? (
                      <>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Prometti minutaggio</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {PLAYING_TIME_PROMISE_OPTIONS.map(option => (
                            <button
                              key={option.id}
                              className="btn-secondary"
                              style={{ padding: '6px 9px', fontSize: '0.68rem' }}
                              onClick={() => handlePromiseChoice(option.label, option.targetMinutes)}
                            >
                              {option.label} · {option.targetMinutes}'
                            </button>
                          ))}
                        </div>
                      </>
                    ) : !activePromise ? (
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Nessuna promessa attiva.</span>
                    ) : null}
                  </div>
                )}
              </div>
              {((player.sellOnClauses?.length ?? 0) > 0 || (player.buyBackClauses?.length ?? 0) > 0) && (
                <div style={{ gridColumn: '1 / -1' }}>
                  {renderTransferClausesSection(player, clubProfile?.id)}
                </div>
              )}
              {activeFutureAgreement && (
                <div style={{ gridColumn: '1 / -1' }}>
                  {renderFutureAgreementSection(activeFutureAgreement)}
                </div>
              )}
              {activeNegotiation && (
                <div style={{ gridColumn: '1 / -1' }}>
                  {renderActiveNegotiationSection(activeNegotiation)}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', gridColumn: '1 / -1' }}>
                {onOpenConversation && (
                  <button
                    className="btn-secondary"
                    onClick={() => onOpenConversation(player)}
                    style={{ position: 'relative' }}
                  >
                    <MessageCircle size={14} />
                    Parla con il giocatore
                    {hasUnreadConversation && (
                      <span style={{
                        position: 'absolute', top: '-4px', right: '-4px', width: '9px', height: '9px',
                        borderRadius: '50%', background: 'var(--color-gold)', boxShadow: '0 0 6px var(--color-gold)'
                      }} />
                    )}
                  </button>
                )}
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

              {renderCareerHistorySection(player)}
              {activeFutureAgreement && renderFutureAgreementSection(activeFutureAgreement)}
              {activeNegotiation && renderActiveNegotiationSection(activeNegotiation)}
              {renderTransferClausesSection(player, clubProfile?.id)}

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
                <h3><Stethoscope size={16} /> Condizione fisica</h3>
                <div className="player-profile-stat-grid">
                  {infoTile('Disponibilità', availability.label, availabilityColor)}
                  {infoTile('Rischio infortunio', availability.riskLabel, availabilityColor)}
                  {infoTile('Fase di recupero', availability.recoveryPhaseLabel)}
                  {infoTile('Carico 7gg', `${player.workload?.minutesLast7Days ?? 0}'`)}
                  {infoTile('Carico 14gg', `${player.workload?.minutesLast14Days ?? 0}'`)}
                  {infoTile('Carico 28gg', `${player.workload?.minutesLast28Days ?? 0}'`)}
                  {infoTile('Freschezza', `${player.workload?.freshness ?? 100}%`, traitColor(player.workload?.freshness ?? 100))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                  {availability.reasons.map(reason => <span key={reason}>- {reason}</span>)}
                </div>
                <p>{availability.prognosis}</p>
                {managedReturnNote && <p style={{ color: 'var(--color-gold)' }}>{managedReturnNote}</p>}
                {player.injuryStatus?.currentInjury && (
                  <p>
                    Infortunio attuale: {INJURY_TYPE_LABELS[player.injuryStatus.currentInjury.type]} ({INJURY_BODY_AREA_LABELS[player.injuryStatus.currentInjury.bodyArea]}).
                  </p>
                )}
                {(player.injuryHistory?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Storico infortuni</span>
                    {player.injuryHistory!.slice(0, 3).map(record => (
                      <span key={record.id} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {record.season} · {INJURY_TYPE_LABELS[record.type]} ({INJURY_BODY_AREA_LABELS[record.bodyArea]}) · {record.daysOutEstimate} settimane
                      </span>
                    ))}
                  </div>
                )}
              </section>

              {player.trainingPlan && (
                <section className="card-premium player-profile-section">
                  <h3><Dumbbell size={16} /> Piano di allenamento</h3>
                  <div className="player-profile-stat-grid">
                    {infoTile('Focus', TRAINING_FOCUS_LABELS[player.trainingPlan.focus])}
                    {infoTile('Intensità', TRAINING_INTENSITY_LABELS[player.trainingPlan.intensity])}
                    {infoTile('Stato', TRAINING_PLAN_STATUS_LABELS[player.trainingPlan.status], player.trainingPlan.status === 'active' ? 'var(--color-pitch)' : 'var(--color-gold)')}
                    {infoTile('Adesione al piano', `${player.trainingPlan.progress}%`, 'var(--color-lime)')}
                    {infoTile('Sviluppo reale', `${player.trainingPlan.developmentProgress}%`, 'var(--color-pitch)')}
                    {infoTile('Carico allenamento', `${player.trainingPlan.accumulatedTrainingLoad}/100`, player.trainingPlan.accumulatedTrainingLoad >= 70 ? 'var(--color-danger)' : 'var(--text-primary)')}
                    {infoTile('Cambi focus stagione', player.trainingPlan.focusChangesThisSeason)}
                  </div>
                  <p>
                    {player.trainingPlan.focus === 'role_learning'
                      ? `Beneficio atteso: familiarita' crescente nel ruolo ${player.trainingPlan.targetRole ?? ''}, non un cambiamento immediato.`
                      : player.trainingPlan.focus === 'recovery'
                      ? 'Beneficio atteso: recupero del carico, nessuna crescita di overall in questo piano.'
                      : 'Beneficio atteso: progressi piccoli e gradual, confermati con revisioni periodiche.'}
                  </p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    L'adesione indica solo quanto il giocatore segue il piano; lo sviluppo reale è più lento e richiede settimane di continuità.
                  </p>
                  {player.trainingPlan.status === 'limited_by_injury' && <p style={{ color: 'var(--color-danger)' }}>Il piano è fermo: il giocatore non è fisicamente disponibile.</p>}
                  {player.trainingPlan.status === 'limited_by_fitness' && <p style={{ color: 'var(--color-gold)' }}>Il carico fisico consiglia prudenza: intensità ridotta di fatto.</p>}
                  {player.developmentProfile?.lastDevelopmentReviewRound !== undefined && (
                    <p>Ultima revisione: giornata {player.developmentProfile.lastDevelopmentReviewRound}.</p>
                  )}
                  {player.trainingPlan.notes.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>Ultime revisioni</span>
                      {player.trainingPlan.notes.slice(0, 3).map(note => <span key={note} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{note}</span>)}
                    </div>
                  )}
                </section>
              )}

              <section className="card-premium player-profile-section">
                <h3><TrendingUp size={16} /> Sviluppo</h3>
                {(() => {
                  const development = getDevelopmentSummary(player);
                  return (
                    <>
                      <div className="player-profile-stat-grid">
                        {infoTile('Fase carriera', development.stageLabel)}
                        {infoTile('Trend', development.trendLabel, development.trendLabel === 'In crescita' ? 'var(--color-pitch)' : development.trendLabel === 'In calo' ? 'var(--color-danger)' : 'var(--text-primary)')}
                        {infoTile('Potenziale stimato', development.potentialLevel)}
                        {infoTile('Livello indicativo', development.potentialRangeLabel)}
                        {infoTile('Sviluppo stagionale', `+${development.seasonGrowth}`, 'var(--color-pitch)')}
                        {infoTile('Calo stagionale', `-${development.seasonDecline}`, development.seasonDecline > 0 ? 'var(--color-danger)' : 'var(--text-primary)')}
                      </div>
                      <p>{development.explanation}</p>
                    </>
                  );
                })()}
              </section>

              {player.trainingPlan?.focus === 'role_learning' && player.trainingPlan.targetRole && (
                <section className="card-premium player-profile-section">
                  <h3><ShieldCheck size={16} /> Apprendimento ruolo</h3>
                  {(() => {
                    const target = player.trainingPlan!.targetRole!;
                    const entry = getRoleFamiliarityEntry(player, target);
                    const forecast =
                      entry.status === 'natural' || entry.status === 'competent' ? 'Sta diventando utilizzabile.' :
                      entry.status === 'usable' ? 'Serve ancora esperienza in campo.' :
                      'Conversione complessa: progresso lento.';
                    return (
                      <>
                        <div className="player-profile-stat-grid">
                          {infoTile('Ruolo obiettivo', target)}
                          {infoTile('Familiarità', `${Math.round(entry.familiarity)}/100`)}
                          {infoTile('Stato', ROLE_FAMILIARITY_STATUS_LABELS[entry.status])}
                          {infoTile('Minuti nel ruolo', `${entry.matchMinutesInRole}'`)}
                          {infoTile('Progresso ruolo', `${Math.round(entry.trainingProgress)}%`)}
                        </div>
                        <p>{forecast}</p>
                      </>
                    );
                  })()}
                </section>
              )}

              {clubStaffState && (
                <section className="card-premium player-profile-section">
                  <h3><ShieldCheck size={16} /> Valutazione staff</h3>
                  <div className="player-profile-stat-grid">
                    {infoTile('Carico (preparatore)', `${player.workload?.fatigueRisk ?? 0}/100`, (player.workload?.fatigueRisk ?? 0) >= 62 ? 'var(--color-danger)' : 'var(--text-primary)')}
                    {infoTile('Sviluppo (allenatore sviluppo)', getDevelopmentSummary(player).trendLabel)}
                    {player.injuryStatus && player.injuryStatus.status !== 'fit' && (
                      infoTile('Recupero (staff medico)', `${player.injuryStatus.returnReadiness}/100`, 'var(--color-gold)')
                    )}
                  </div>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {getClubStaffMember(clubStaffState, 'fitness_coach')?.name ?? 'Il preparatore'} segue il carico, {getClubStaffMember(clubStaffState, 'development_coach')?.name ?? 'l\'allenatore dello sviluppo'} segue i piani di crescita: nessuno dei due modifica overall o potenziale direttamente.
                  </p>
                </section>
              )}

              {player.youthProfile && (
                <section className="card-premium player-profile-section">
                  <h3><GraduationCap size={16} /> Prodotto del vivaio</h3>
                  <div className="player-profile-stat-grid">
                    {infoTile('Stagione ingresso', player.youthProfile.intakeSeason)}
                    {infoTile('Percorso', player.youthProfile.academyClubName)}
                    {infoTile('Status corrente', YOUTH_STATUS_LABELS[player.youthProfile.academyStatus])}
                    {player.youthProfile.promotedAtRound !== undefined && infoTile('Promosso alla giornata', player.youthProfile.promotedAtRound)}
                  </div>
                </section>
              )}

              {clubProfile && (() => {
                const contract = player.contract ?? buildInitialPlayerContract(player, clubProfile, CURRENT_SEASON);
                const statusLabel = getContractStatusLabel(contract);
                return (
                  <section className="card-premium player-profile-section">
                    <h3><Calendar size={16} /> Contratto</h3>
                    <div className="player-profile-stat-grid">
                      {infoTile('Stipendio annuo', formatCurrency(contract.annualSalary))}
                      {infoTile('Durata residua', `${contract.durationYears} anni (${contract.endSeason})`)}
                      {infoTile('Ruolo contrattuale', CONTRACT_SQUAD_ROLE_LABELS[contract.squadRole])}
                      {infoTile('Situazione', statusLabel, statusLabel === 'In scadenza' ? 'var(--color-danger)' : statusLabel === 'Da monitorare' ? 'var(--color-gold)' : 'var(--color-pitch)')}
                      {infoTile('Bonus gol', formatCurrency(contract.bonuses.goalBonus))}
                      {infoTile('Bonus presenza', formatCurrency(contract.bonuses.appearanceBonus))}
                    </div>
                    {contract.releaseClause && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                        Clausola rescissoria: {formatCurrency(contract.releaseClause)} (informativa: nessuna attivazione automatica nei flussi di mercato).
                      </p>
                    )}
                    {onRenewContract && (
                      <button className="btn-secondary" onClick={() => onRenewContract(player)} style={{ marginTop: '8px', justifyContent: 'center' }}>
                        Rinnova contratto
                      </button>
                    )}
                  </section>
                );
              })()}

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

              {publicProfile && (
                <section className="card-premium player-profile-section">
                  <h3><Radio size={16} /> Impatto pubblico</h3>
                  <div className="player-profile-stat-grid">
                    {infoTile('Popolarità', `${publicProfile.popularity}/100`, traitColor(publicProfile.popularity))}
                    {infoTile('Attenzione media', `${publicProfile.mediaAttention}/100`, traitColor(publicProfile.mediaAttention))}
                    {infoTile('Seguito stimato', formatFollowersEstimate(publicProfile.followersEstimate), 'var(--color-gold)')}
                    {infoTile('Status narrativo', publicProfile.narrativeTitles[0] ?? 'Nessuna storia attiva')}
                  </div>
                  {publicProfile.iconicMoments[0] && (
                    <p style={{ marginTop: '6px' }}>
                      Momento iconico più recente: {publicProfile.iconicMoments[0].description}
                    </p>
                  )}
                </section>
              )}

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
    </ModalPortal>
  );
}
