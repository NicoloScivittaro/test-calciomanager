import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Award, UserMinus, Calendar, ShieldCheck, Dumbbell, Brain, HeartHandshake, Radio, TrendingUp } from 'lucide-react';
import { CareerWorldState, ClubHistoryState, ClubProfile, ClubStaffState, Player, PlayerClubHistoryEntry, PlayerConversationState, PlayerPublicProfile, PlayerRole, PlayerSeasonStat, TrainingFocus, TrainingIntensity } from '../../types';
import {
  ApplySignedContractInput,
  applySignedContract,
  buildInitialPlayerContract,
  calculateClubWageBudget,
  CONTRACT_SQUAD_ROLE_LABELS,
  getContractStatusLabel,
  toAnnualSalary
} from '../../utils/playerContracts';
import ContractRenewalModal from '../common/ContractRenewalModal';
import YouthAcademyModal from '../common/YouthAcademyModal';
import { getActiveYouthPlayers } from '../../utils/youthAcademy';
import { getManagedReturnRecommendation, getPlayerAvailabilitySummary, getPlayerFitnessStatus, INJURY_BODY_AREA_LABELS, INJURY_TYPE_LABELS } from '../../utils/playerFitness';
import {
  DEVELOPMENT_STAGE_LABELS,
  DEVELOPMENT_TREND_LABELS,
  ROLE_FAMILIARITY_STATUS_LABELS,
  TRAINING_FOCUS_LABELS,
  TRAINING_INTENSITY_LABELS,
  TRAINING_PLAN_STATUS_LABELS,
  getDevelopmentSummary,
  getRoleFamiliarityEntry,
  setPlayerTrainingFocus
} from '../../utils/playerDevelopment';
import { getPersonalityArchetype, getPersonalityShortNote } from '../../utils/playerPersonality';
import { getPlayerProjectRole, getProjectRoleColor } from '../../utils/playerProjectRole';
import { formatFollowersEstimate } from '../../utils/emotionalNarratives';
import { getPlayerRoleAttributes } from '../../utils/playerAttributes';
import PlayerProfileModal from '../common/PlayerProfileModal';
import PlayerConversationModal from '../common/PlayerConversationModal';
import { ModalPortal, useModalBehavior } from '../common/BaseModal';

interface SquadProps {
  players: Player[];
  updatePlayer: (player: Player) => void;
  starters: string[];
  setStarters: (ids: string[]) => void;
  bench: string[];
  setBench: (ids: string[]) => void;
  setPlayers: (players: Player[]) => void;
  playerStats: PlayerSeasonStat[];
  clubHistory: ClubHistoryState;
  currentRound: number;
  playerPublicProfiles?: PlayerPublicProfile[];
  onCreatePlayingTimePromise?: (playerId: string, targetMinutes: number) => void;
  playerConversations?: PlayerConversationState;
  setPlayerConversations?: React.Dispatch<React.SetStateAction<PlayerConversationState>>;
  clubStaffState?: ClubStaffState;
  clubProfile: ClubProfile;
  careerWorld: CareerWorldState;
  setCareerWorld: React.Dispatch<React.SetStateAction<CareerWorldState>>;
  budget: number;
  setBudget: (b: number) => void;
  teamName: string;
  onPromoteYouthPlayer: (player: Player) => void;
  onReleaseYouthPlayer: (player: Player) => void;
}

type SortField = 'name' | 'role' | 'age' | 'overall' | 'form' | 'morale' | 'condition' | 'stamina' | 'value';

const CAREER_TRANSFER_TYPE_LABELS: Record<string, string> = {
  initial: 'Al club dall\'inizio della carriera',
  purchase: 'Acquisto',
  sale: 'Cessione',
  loan: 'Prestito'
};

export default function Squad({ players, updatePlayer, starters, setStarters, bench, setBench, setPlayers, playerStats, clubHistory, currentRound, playerPublicProfiles = [], onCreatePlayingTimePromise, playerConversations, setPlayerConversations, clubStaffState, clubProfile, careerWorld, setCareerWorld, budget, setBudget, teamName, onPromoteYouthPlayer, onReleaseYouthPlayer }: SquadProps) {
  const [chatPlayer, setChatPlayer] = useState<Player | null>(null);
  const [renewingPlayer, setRenewingPlayer] = useState<Player | null>(null);
  const [showYouthAcademyModal, setShowYouthAcademyModal] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'STARTER' | 'INJURED' | 'SALE'>('ALL');
  const [sortField, setSortField] = useState<SortField>('overall');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerSheetMode, setPlayerSheetMode] = useState<'quick' | 'full'>('quick');
  useModalBehavior(!!selectedPlayer && playerSheetMode === 'full', () => setSelectedPlayer(null));
  const [teamTrainingFocus, setTeamTrainingFocus] = useState<TrainingFocus>('balanced');
  const [teamTrainingIntensity, setTeamTrainingIntensity] = useState<TrainingIntensity>('normal');
  const [individualFocus, setIndividualFocus] = useState<TrainingFocus>('balanced');
  const [individualIntensity, setIndividualIntensity] = useState<TrainingIntensity>('normal');
  const [positionTarget, setPositionTarget] = useState<PlayerRole>('CM');
  const roleContext = { starters, bench, seasonStats: playerStats, clubHistory, round: currentRound };

  // Il selettore del piano individuale riflette il piano gia' impostato per il giocatore aperto.
  useEffect(() => {
    if (!selectedPlayer) return;
    if (selectedPlayer.trainingPlan) {
      setIndividualFocus(selectedPlayer.trainingPlan.focus);
      setIndividualIntensity(selectedPlayer.trainingPlan.intensity);
    }
    if (selectedPlayer.trainingPlan?.targetRole) setPositionTarget(selectedPlayer.trainingPlan.targetRole);
  }, [selectedPlayer?.id]);

  // Formatting currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

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
        <div style={{ width: `${value}%`, height: '100%', background: traitColor(value) }} />
      </div>
    </div>
  );

  const impactChip = (label: string, value: number) => {
    const color = value >= 4 ? 'var(--color-pitch)' : value <= -3 ? 'var(--color-danger)' : value > 0 ? 'var(--color-gold)' : 'var(--text-secondary)';
    return (
      <div key={label} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '8px', background: 'rgba(11, 15, 20, 0.22)' }}>
        <span style={{ display: 'block', fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>{label}</span>
        <strong style={{ display: 'block', marginTop: '4px', color }}>{value > 0 ? `+${value}` : value}</strong>
      </div>
    );
  };

  const infoTileLike = (label: string, value: React.ReactNode, color = 'var(--text-primary)') => (
    <div key={label} style={{ padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.25)' }}>
      <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-muted)' }}>{label}</span>
      <strong style={{ display: 'block', marginTop: '3px', color }}>{value}</strong>
    </div>
  );

  // Sort & Filter logic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Fase 9: la rosa prima squadra non mescola mai i prospetti non promossi (assente = 'first_team').
  const firstTeamRoster = players.filter(player => (player.squadStatus ?? 'first_team') === 'first_team');

  const filteredPlayers = firstTeamRoster.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(search.toLowerCase());
    
    let matchesRole = true;
    if (roleFilter !== 'ALL') {
      const rolesToCheck = [player.role, ...(player.secondaryRoles ?? [])];
      if (roleFilter === 'DF') matchesRole = rolesToCheck.some(role => ['CB', 'LB', 'RB'].includes(role));
      else if (roleFilter === 'MF') matchesRole = rolesToCheck.some(role => ['DM', 'CM', 'AM'].includes(role));
      else if (roleFilter === 'FW') matchesRole = rolesToCheck.some(role => ['LW', 'RW', 'ST'].includes(role));
      else matchesRole = rolesToCheck.includes(roleFilter as PlayerRole);
    }

    let matchesStatus = true;
    if (statusFilter === 'STARTER') matchesStatus = starters.includes(player.id);
    else if (statusFilter === 'INJURED') matchesStatus = player.status === 'Infortunato';
    else if (statusFilter === 'SALE') matchesStatus = player.status === 'Cedibile';

    return matchesSearch && matchesRole && matchesStatus;
  }).sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'role') {
      const order = { 'GK': 0, 'CB': 1, 'LB': 2, 'RB': 3, 'DM': 4, 'CM': 5, 'AM': 6, 'LW': 7, 'RW': 8, 'ST': 9 };
      aVal = order[a.role as keyof typeof order];
      bVal = order[b.role as keyof typeof order];
    }

    if (aVal < bVal) return sortAsc ? -1 : 1;
    if (aVal > bVal) return sortAsc ? 1 : -1;
    return 0;
  });

  const openPlayerSheet = (player: Player) => {
    setSelectedPlayer(player);
    setPlayerSheetMode('full');
  };

  const toggleStarter = (player: Player) => {
    const isStarter = starters.includes(player.id);
    if (isStarter) {
      // Remove from starter, add to bench
      setStarters(starters.filter(id => id !== player.id));
      if (!bench.includes(player.id)) setBench([...bench, player.id]);
    } else {
      if (starters.length >= 11) {
        alert('Ci sono già 11 titolari. Rimuovi un titolare prima di inserirne un altro.');
        return;
      }
      // Remove from bench, add to starter
      setBench(bench.filter(id => id !== player.id));
      setStarters([...starters, player.id]);
    }
  };

  // Rinnovo: sostituisce il contratto solo dopo conferma esplicita, scala bonus firma/agente una
  // sola volta dal budget trasferimenti e aggiorna subito il monte ingaggi (sempre ricalcolato dal
  // roster reale, mai incrementato/decrementato a mano: nessun rischio di doppio conteggio).
  const handleConfirmRenewal = (player: Player, input: ApplySignedContractInput) => {
    const oneOffCost = (input.signingBonus ?? 0) + (input.agentFee ?? 0);
    const renewedPlayer = applySignedContract(player, clubProfile, input, careerWorld.clubWageBudgetState.season, true);
    const updatedPlayers = players.map(p => (p.id === player.id ? renewedPlayer : p));
    setPlayers(updatedPlayers);
    setBudget(Math.max(0, budget - oneOffCost));
    setCareerWorld(current => ({
      ...current,
      clubWageBudgetState: {
        ...calculateClubWageBudget(updatedPlayers, clubProfile, current.clubWageBudgetState.season, current.clubWageBudgetState),
        transferOneOffCostsThisSeason: current.clubWageBudgetState.transferOneOffCostsThisSeason + oneOffCost
      }
    }));
    setRenewingPlayer(null);
    setSelectedPlayer(null);
  };

  // Il piano di allenamento non da MAI un effetto immediato: imposta solo focus/intensita/ruolo
  // obiettivo. I risultati arrivano nel tempo tramite advancePlayerDevelopmentCycle (post-partita).
  const applyIndividualPlan = (player: Player) => {
    const updated = setPlayerTrainingFocus(player, {
      focus: individualFocus,
      intensity: individualIntensity,
      targetRole: individualFocus === 'role_learning' ? positionTarget : undefined
    }, currentRound);
    updatePlayer(updated);
    setSelectedPlayer(updated);
  };

  const applyTeamTrainingPlan = () => {
    const updated = players.map(player => setPlayerTrainingFocus(player, { focus: teamTrainingFocus, intensity: teamTrainingIntensity }, currentRound));
    setPlayers(updated);
    if (selectedPlayer) setSelectedPlayer(updated.find(player => player.id === selectedPlayer.id) ?? selectedPlayer);
  };

  // Griglia attributi canonica per famiglia di ruolo (stesso numero/ordine/significato per tutti i
  // giocatori dello stesso ruolo): src/utils/playerAttributes.ts, riusata anche da PlayerProfileModal.
  const getAttributes = getPlayerRoleAttributes;

  return (
    <div className="page-wrapper">
      {/* Filters Toolbar Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        {/* Left Side: Search & Role Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Search Box */}
          <div style={{
            position: 'relative',
            width: '240px'
          }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Cerca giocatore..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px 10px 38px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)'
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Role Filters buttons */}
          <div style={{
            display: 'flex',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px'
          }}>
            {['ALL', 'GK', 'DF', 'MF', 'FW'].map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                style={{
                  background: roleFilter === role ? 'rgba(16, 185, 129, 0.15)' : 'none',
                  border: 'none',
                  color: roleFilter === role ? 'var(--color-pitch)' : 'var(--text-secondary)',
                  fontWeight: roleFilter === role ? 700 : 500,
                  fontSize: '0.75rem',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s, color 0.2s'
                }}
              >
                {role === 'ALL' ? 'Tutti' : role}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Status Toggles */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-sm)',
          padding: '2px'
        }}>
          {[
            { id: 'ALL', label: 'Tutti' },
            { id: 'STARTER', label: 'Titolari' },
            { id: 'INJURED', label: 'Infortunati' },
            { id: 'SALE', label: 'Cedibili' }
          ].map(status => (
            <button
              key={status.id}
              onClick={() => setStatusFilter(status.id as any)}
              style={{
                background: statusFilter === status.id ? 'var(--border-light)' : 'none',
                border: 'none',
                color: statusFilter === status.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: statusFilter === status.id ? 600 : 500,
                fontSize: '0.75rem',
                padding: '8px 14px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {status.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowYouthAcademyModal(true)}
          className="btn-secondary"
          style={{ fontSize: '0.75rem', padding: '8px 14px' }}
        >
          Vivaio ({getActiveYouthPlayers(players, careerWorld.youthAcademyState).length})
        </button>
      </div>

      <div className="card-premium" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Dumbbell size={16} style={{ color: 'var(--color-pitch)' }} />
            Piano di Squadra
          </h3>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Imposta il focus di lavoro per tutta la rosa: i risultati arrivano nel tempo con le partite, non subito.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={teamTrainingFocus} onChange={e => setTeamTrainingFocus(e.target.value as TrainingFocus)} style={selectStyle}>
            {(['balanced', 'technical', 'physical', 'defensive', 'attacking', 'mental', 'recovery'] as TrainingFocus[]).map(focus => (
              <option key={focus} value={focus}>{TRAINING_FOCUS_LABELS[focus]}</option>
            ))}
          </select>
          <select value={teamTrainingIntensity} onChange={e => setTeamTrainingIntensity(e.target.value as TrainingIntensity)} style={selectStyle}>
            {(['light', 'normal', 'high'] as TrainingIntensity[]).map(intensity => (
              <option key={intensity} value={intensity}>{TRAINING_INTENSITY_LABELS[intensity]}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={applyTeamTrainingPlan} style={{ justifyContent: 'center' }}>
            Applica alla rosa
          </button>
        </div>
      </div>

      {/* Roster Table Card */}
      <div className="card-premium" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="premium-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')}>Nome</th>
              <th>Carattere</th>
              <th>Progetto</th>
              <th onClick={() => handleSort('role')}>Ruolo</th>
              <th onClick={() => handleSort('age')} style={{ textAlign: 'center' }}>Età</th>
              <th onClick={() => handleSort('overall')} style={{ textAlign: 'center' }}>Valutazione</th>
              <th onClick={() => handleSort('form')} style={{ textAlign: 'center' }}>Forma</th>
              <th onClick={() => handleSort('morale')}>Morale</th>
              <th onClick={() => handleSort('condition')}>Fisico</th>
              <th onClick={() => handleSort('stamina')}>Res.</th>
              <th onClick={() => handleSort('value')}>Valore</th>
              <th style={{ textAlign: 'center' }}>Stato</th>
              <th style={{ textAlign: 'center' }}>Disponibilità</th>
              <th style={{ textAlign: 'center' }}>Contratto</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((player) => {
              const isStarter = starters.includes(player.id);
              const fitness = getPlayerFitnessStatus(player);
              const availability = getPlayerAvailabilitySummary(player, currentRound);
              const availabilityColor =
                availability.label === 'Disponibile' ? 'var(--color-pitch)' :
                availability.label === 'Indisponibile' ? 'var(--color-danger)' :
                'var(--color-gold)';
              const projectRole = getPlayerProjectRole(player, roleContext);
              const projectRoleColor = getProjectRoleColor(projectRole);
              
              return (
                <tr key={player.id} onClick={() => openPlayerSheet(player)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        backgroundColor: isStarter ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        color: isStarter ? 'var(--color-pitch)' : 'var(--text-muted)',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        border: isStarter ? '1px solid var(--color-pitch)' : '1px solid rgba(255,255,255,0.08)'
                      }}>
                        {isStarter ? 'TIT' : 'PAN'}
                      </span>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>{player.name}</strong>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        maxWidth: '150px',
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        color: player.personality.ego >= 82 ? 'var(--color-danger)' : player.personality.clubLove >= 76 ? 'var(--color-pitch)' : 'var(--color-gold)',
                        background: 'rgba(26, 33, 42, 0.42)',
                        border: '1px solid var(--border-light)',
                        borderRadius: '999px',
                        padding: '3px 8px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {getPersonalityArchetype(player)}
                    </span>
                  </td>
                  <td>
                    <span
                      title={`${projectRole.summary} ${projectRole.expectation}`}
                      style={{
                        display: 'inline-flex',
                        maxWidth: '170px',
                        fontSize: '0.66rem',
                        fontWeight: 850,
                        color: projectRoleColor,
                        background: 'rgba(26, 33, 42, 0.42)',
                        border: `1px solid ${projectRoleColor === 'var(--text-secondary)' ? 'var(--border-light)' : projectRoleColor}`,
                        borderRadius: '999px',
                        padding: '3px 8px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {projectRole.label}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${player.role === 'GK' ? 'GK' : player.role.match(/CB|LB|RB/) ? 'DF' : player.role.match(/DM|CM|AM/) ? 'MF' : 'FW'}`}>
                      {player.role}
                    </span>
                    {player.secondaryRoles?.length ? (
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        +{player.secondaryRoles.join('/')}
                      </span>
                    ) : null}
                  </td>
                  <td style={{ textAlign: 'center' }}>{player.age}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span style={{ fontWeight: 700, color: player.overall >= 80 ? 'var(--color-gold)' : 'var(--text-primary)' }}>{player.overall}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({player.potential})</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--color-lime)' }}>{player.form}</td>
                  
                  {/* Morale Progress Bar */}
                  <td style={{ minWidth: '110px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '2px' }}>
                        <div style={{ width: `${player.morale}%`, height: '100%', borderRadius: '2px', backgroundColor: player.morale >= 80 ? 'var(--color-pitch)' : player.morale >= 50 ? 'var(--color-gold)' : 'var(--color-danger)' }} />
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', width: '24px' }}>{player.morale}%</span>
                    </div>
                  </td>

                  {/* Physical Condition Progress Bar */}
                  <td style={{ minWidth: '110px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '2px' }}>
                        <div style={{ width: `${player.condition}%`, height: '100%', borderRadius: '2px', backgroundColor: player.condition >= 85 ? 'var(--color-pitch)' : player.condition >= 70 ? 'var(--color-gold)' : 'var(--color-danger)' }} />
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', width: '24px' }}>{player.condition}%</span>
                    </div>
                  </td>

                  <td style={{ minWidth: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '2px' }}>
                        <div style={{ width: `${player.stamina}%`, height: '100%', borderRadius: '2px', backgroundColor: fitness.needsRest ? 'var(--color-danger)' : player.stamina >= 78 ? 'var(--color-pitch)' : player.stamina >= 58 ? 'var(--color-gold)' : 'var(--color-danger)' }} />
                      </div>
                      <span style={{ fontSize: '0.68rem', color: fitness.needsRest ? 'var(--color-danger)' : 'var(--text-secondary)', width: '42px' }}>
                        {player.stamina}/{fitness.consecutiveStarts}
                      </span>
                    </div>
                  </td>

                  <td style={{ fontWeight: 600 }}>{formatCurrency(player.value)}</td>
                  
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${
                      player.status === 'In Forma' ? 'status-active' :
                      player.status === 'Stanco' ? 'status-fatigue' :
                      player.status === 'Infortunato' ? 'status-injured' :
                      player.status === 'Cedibile' ? 'status-sale' : 'status-active'
                    }`} style={{ display: 'inline-block', minWidth: '85px', textAlign: 'center' }}>
                      {player.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span
                      title={availability.reasons[0]}
                      style={{
                        display: 'inline-block',
                        minWidth: '110px',
                        textAlign: 'center',
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        padding: '3px 6px',
                        borderRadius: '999px',
                        color: availabilityColor,
                        border: `1px solid ${availabilityColor}`,
                        background: 'rgba(26,33,42,0.42)'
                      }}
                    >
                      {availability.label}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {(() => {
                      const contract = player.contract ?? buildInitialPlayerContract(player, clubProfile, careerWorld.clubWageBudgetState.season);
                      const statusLabel = getContractStatusLabel(contract);
                      const statusColor = statusLabel === 'In scadenza' ? 'var(--color-danger)' : statusLabel === 'Da monitorare' ? 'var(--color-gold)' : 'var(--color-pitch)';
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', fontSize: '0.64rem' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(contract.annualSalary)}/anno</strong>
                          <span style={{ color: 'var(--text-muted)' }}>{contract.durationYears} anni · {CONTRACT_SQUAD_ROLE_LABELS[contract.squadRole]}</span>
                          <span style={{ color: statusColor, fontWeight: 800 }}>{statusLabel}</span>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PlayerProfileModal
        player={playerSheetMode === 'quick' ? selectedPlayer : null}
        mode={playerSheetMode}
        onClose={() => setSelectedPlayer(null)}
        onModeChange={setPlayerSheetMode}
        players={players}
        starters={starters}
        bench={bench}
        playerStats={playerStats}
        clubHistory={clubHistory}
        currentRound={currentRound}
        playerPublicProfiles={playerPublicProfiles}
        contextLabel="Scheda rapida rosa"
        onCreatePlayingTimePromise={onCreatePlayingTimePromise}
        playerConversations={playerConversations}
        onOpenConversation={setPlayerConversations ? setChatPlayer : undefined}
        clubStaffState={clubStaffState}
        clubProfile={clubProfile}
        onRenewContract={setRenewingPlayer}
      />

      {chatPlayer && playerConversations && setPlayerConversations && (
        <PlayerConversationModal
          player={chatPlayer}
          playerStats={playerStats}
          clubHistory={clubHistory}
          currentRound={currentRound}
          conversationState={playerConversations}
          setConversationState={setPlayerConversations}
          onApplyMoraleDelta={(playerId, delta) => {
            const target = players.find(p => p.id === playerId);
            if (target) updatePlayer({ ...target, morale: Math.max(0, Math.min(100, target.morale + delta)) });
          }}
          onClose={() => setChatPlayer(null)}
        />
      )}

      {/* Roster Drawer Details Panel */}
      <ModalPortal>
      <AnimatePresence>
        {selectedPlayer && playerSheetMode === 'full' && (
          <div className="drawer-backdrop player-fullscreen-backdrop" onClick={() => setSelectedPlayer(null)}>
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="drawer-panel player-fullscreen-panel"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{selectedPlayer.name}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{selectedPlayer.nationality} • {selectedPlayer.age} anni</p>
                </div>
                <button
                  onClick={() => setPlayerSheetMode('quick')}
                  className="btn-secondary"
                  style={{ padding: '7px 10px', fontSize: '0.72rem' }}
                >
                  Scheda rapida
                </button>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  aria-label="Chiudi scheda giocatore"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '50%'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-light)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Player Attributes / Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                
                {/* Stats Panel */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Overall</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-gold)' }}>{selectedPlayer.overall}</h3>
                  </div>
                  <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Potenziale</span>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedPlayer.potential}</h3>
                  </div>
                </div>

                {(() => {
                  const projectRole = getPlayerProjectRole(selectedPlayer, roleContext);
                  const projectRoleColor = getProjectRoleColor(projectRole);
                  return (
                    <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShieldCheck size={14} style={{ color: projectRoleColor }} />
                            Posto nel progetto
                          </h4>
                          <strong style={{ display: 'block', marginTop: '5px', fontSize: '0.95rem', color: projectRoleColor }}>{projectRole.label}</strong>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: '5px' }}>
                            {projectRole.summary}
                          </p>
                        </div>
                        <span style={{
                          border: `1px solid ${projectRoleColor === 'var(--text-secondary)' ? 'var(--border-light)' : projectRoleColor}`,
                          borderRadius: '999px',
                          padding: '4px 8px',
                          fontSize: '0.66rem',
                          fontWeight: 850,
                          color: projectRoleColor
                        }}>
                          Tensione {projectRole.tension}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                        {projectRole.expectation}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {traitBar('Fiducia', projectRole.trust)}
                        {traitBar('Tensione', projectRole.tension)}
                        {impactChip('Spogliatoio', projectRole.dressingRoomWeight)}
                        {impactChip('Tifosi', projectRole.fanWeight)}
                      </div>
                      {projectRole.reasons.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {projectRole.reasons.map(reason => (
                            <span key={reason} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                              - {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const publicProfile = playerPublicProfiles.find(profile => profile.playerId === selectedPlayer.id);
                  if (!publicProfile) return null;
                  return (
                    <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Radio size={14} style={{ color: '#FB7185' }} />
                        Impatto pubblico
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        {traitBar('Popolarità', publicProfile.popularity)}
                        {traitBar('Attenzione media', publicProfile.mediaAttention)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <span>Seguito stimato: <strong>{formatFollowersEstimate(publicProfile.followersEstimate)}</strong></span>
                        <span>Status: <strong>{publicProfile.narrativeTitles[0] ?? 'nessuna storia attiva'}</strong></span>
                      </div>
                      {publicProfile.iconicMoments[0] && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                          Momento iconico più recente: {publicProfile.iconicMoments[0].description}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {selectedPlayer.externalProfile && (
                  <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Award size={14} style={{ color: 'var(--color-gold)' }} />
                      Dati Excel 2025/26
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      {[
                        ['Ruolo file', selectedPlayer.sourceRole ?? selectedPlayer.externalProfile.sourceRole],
                        ['Altezza', selectedPlayer.height ?? selectedPlayer.externalProfile.height],
                        ['Piede', selectedPlayer.preferredFoot ?? selectedPlayer.externalProfile.preferredFoot],
                        ['Valore fonte', selectedPlayer.valueLabel ?? selectedPlayer.externalProfile.valueLabel],
                        ['Minuti', selectedPlayer.externalProfile.minutes],
                        ['Gol', selectedPlayer.externalProfile.goals],
                        ['Assist', selectedPlayer.externalProfile.assists],
                        ['Rating', selectedPlayer.externalProfile.rating],
                        ['Copertura', selectedPlayer.externalProfile.coverage],
                        ['Gerarchia', selectedPlayer.externalProfile.hierarchy]
                      ].filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => (
                        <div key={label as string} style={{ padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.25)' }}>
                          <span style={{ display: 'block', fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800 }}>{label}</span>
                          <strong style={{ display: 'block', marginTop: '3px', fontSize: '0.78rem' }}>{formatStatValue(value as string | number)}</strong>
                        </div>
                      ))}
                    </div>
                    {selectedPlayer.externalProfile.statsSummary && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{selectedPlayer.externalProfile.statsSummary}</p>
                    )}
                    {selectedPlayer.externalProfile.note && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{selectedPlayer.externalProfile.note}</p>
                    )}
                    {selectedPlayer.externalProfile.rawStats && (
                      <div style={{ maxHeight: '170px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', paddingRight: '4px' }}>
                        {Object.entries(selectedPlayer.externalProfile.rawStats).map(([label, value]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.68rem', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '4px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                            <strong style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{formatStatValue(value)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(() => {
                    const fitness = getPlayerFitnessStatus(selectedPlayer);
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Dumbbell size={14} style={{ color: fitness.needsRest ? 'var(--color-danger)' : 'var(--color-pitch)' }} />
                              Resistenza e rotazioni
                            </h4>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: '5px' }}>
                              Soglia consigliata: {fitness.restThreshold} titolarita di fila. Dopo quella soglia calano prestazione e sicurezza fisica.
                            </p>
                          </div>
                          <span style={{
                            border: '1px solid var(--border-light)',
                            borderRadius: '999px',
                            padding: '4px 8px',
                            fontSize: '0.66rem',
                            fontWeight: 900,
                            color: fitness.label === 'Sovraccarico' ? 'var(--color-danger)' : fitness.label === 'Da ruotare' ? 'var(--color-gold)' : 'var(--color-pitch)'
                          }}>
                            {fitness.label}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {[
                            ['Resistenza', selectedPlayer.stamina],
                            ['Titolarita fila', fitness.consecutiveStarts],
                            ['Soglia riposo', fitness.restThreshold],
                            ['Rischio inf.', fitness.injuryRisk]
                          ].map(([label, value]) => (
                            <div key={label} style={{ padding: '8px 10px', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', background: 'rgba(26,33,42,0.25)' }}>
                              <span style={{ display: 'block', fontSize: '0.66rem', color: 'var(--text-muted)' }}>{label}</span>
                              <strong style={{ display: 'block', marginTop: '3px', color: label === 'Rischio inf.' && Number(value) >= 18 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                                {label === 'Rischio inf.' ? `${value}%` : value}
                              </strong>
                            </div>
                          ))}
                        </div>
                        {fitness.needsRest && (
                          <p style={{ fontSize: '0.72rem', color: 'var(--color-gold)', lineHeight: 1.35 }}>
                            Consiglio staff: fallo riposare una partita o usalo solo dalla panchina.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(() => {
                    const availability = getPlayerAvailabilitySummary(selectedPlayer, currentRound);
                    const managedReturnNote = getManagedReturnRecommendation(selectedPlayer);
                    const availabilityColor =
                      availability.label === 'Disponibile' ? 'var(--color-pitch)' :
                      availability.label === 'Indisponibile' ? 'var(--color-danger)' :
                      'var(--color-gold)';
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)' }}>Condizione fisica</h4>
                          <span style={{ border: `1px solid ${availabilityColor}`, borderRadius: '999px', padding: '4px 8px', fontSize: '0.66rem', fontWeight: 900, color: availabilityColor }}>
                            {availability.label}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          {infoTileLike('Rischio', availability.riskLabel, availabilityColor)}
                          {infoTileLike('Fase recupero', availability.recoveryPhaseLabel)}
                          {infoTileLike('Carico 14gg', `${selectedPlayer.workload?.minutesLast14Days ?? 0}'`)}
                          {infoTileLike('Freschezza', `${selectedPlayer.workload?.freshness ?? 100}%`)}
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{availability.prognosis}</p>
                        {availability.reasons.map(reason => (
                          <p key={reason} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>- {reason}</p>
                        ))}
                        {managedReturnNote && (
                          <p style={{ fontSize: '0.72rem', color: 'var(--color-gold)', lineHeight: 1.35 }}>{managedReturnNote}</p>
                        )}
                        {selectedPlayer.injuryStatus?.currentInjury && (
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                            {INJURY_TYPE_LABELS[selectedPlayer.injuryStatus.currentInjury.type]} ({INJURY_BODY_AREA_LABELS[selectedPlayer.injuryStatus.currentInjury.bodyArea]})
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Sub-attributes breakdown list */}
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Award size={14} style={{ color: 'var(--color-pitch)' }} />
                    Dettagli Attributi Chiave
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {getAttributes(selectedPlayer).map((attr, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(26,33,42,0.3)',
                        borderRadius: '4px',
                        border: '1px solid var(--border-light)'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{attr.label}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: attr.val >= 85 ? 'var(--color-pitch)' : attr.val >= 78 ? 'var(--color-gold)' : 'var(--text-primary)' }}>{attr.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Brain size={14} style={{ color: 'var(--color-gold)' }} />
                        Personalita
                      </h4>
                      <strong style={{ display: 'block', marginTop: '5px', fontSize: '0.9rem' }}>{getPersonalityArchetype(selectedPlayer)}</strong>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: '5px' }}>
                        {getPersonalityShortNote(selectedPlayer)}
                      </p>
                    </div>
                    <span style={{
                      border: '1px solid var(--border-light)',
                      borderRadius: '999px',
                      padding: '4px 8px',
                      fontSize: '0.66rem',
                      fontWeight: 800,
                      color: traitColor(selectedPlayer.personality.clubLove)
                    }}>
                      Amore club {selectedPlayer.personality.clubLove}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      ['Ambizione', selectedPlayer.personality.ambition],
                      ['Lealta', selectedPlayer.personality.loyalty],
                      ['Ego', selectedPlayer.personality.ego],
                      ['Professionalita', selectedPlayer.personality.professionalism],
                      ['Freddezza', selectedPlayer.personality.composure],
                      ['Leadership', selectedPlayer.personality.leadership],
                      ['Panchina', selectedPlayer.personality.benchTolerance],
                      ['Pressione media', selectedPlayer.personality.mediaPressure]
                    ].map(([label, value]) => traitBar(label as string, value as number))}
                  </div>
                </div>

                <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HeartHandshake size={14} style={{ color: 'var(--color-pitch)' }} />
                    Relazioni che contano
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {[
                      ['Allenatore', selectedPlayer.relationships.coach],
                      ['Compagni', selectedPlayer.relationships.teammates],
                      ['Tifosi', selectedPlayer.relationships.fans],
                      ['Agente', selectedPlayer.relationships.agent],
                      ['Voglia big', selectedPlayer.personality.bigClubDesire],
                      ['Bandiera', selectedPlayer.personality.oneClubManDesire]
                    ].map(([label, value]) => traitBar(label as string, value as number))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    <span>
                      Mentore: <strong>{players.find(player => player.id === selectedPlayer.relationships.mentorId)?.name ?? 'nessuno'}</strong>
                    </span>
                    <span>
                      Rivalita interne: <strong>{selectedPlayer.relationships.rivalIds?.map(id => players.find(player => player.id === id)?.name).filter(Boolean).join(', ') || 'nessuna'}</strong>
                    </span>
                    <span>
                      Presenze/leggenda: <strong>{selectedPlayer.careerMemory.appearances} presenze, indice {Math.round(selectedPlayer.careerMemory.legendScore)}/100</strong>
                    </span>
                  </div>
                </div>

                {/* Contract Info */}
                <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Contratto Attuale</h4>
                  {(() => {
                    const contract = selectedPlayer.contract ?? buildInitialPlayerContract(selectedPlayer, clubProfile, careerWorld.clubWageBudgetState.season);
                    const statusLabel = getContractStatusLabel(contract);
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Valore di Mercato:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(selectedPlayer.value)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Stipendio annuo:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(contract.annualSalary)}/anno</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Scadenza Contratto:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{contract.durationYears} anni rimasti ({contract.endSeason})</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Ruolo contrattuale:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{CONTRACT_SQUAD_ROLE_LABELS[contract.squadRole]}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Situazione:</span>
                          <strong style={{ color: statusLabel === 'In scadenza' ? 'var(--color-danger)' : statusLabel === 'Da monitorare' ? 'var(--color-gold)' : 'var(--color-pitch)' }}>{statusLabel}</strong>
                        </div>
                        {contract.releaseClause && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Clausola rescissoria:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(contract.releaseClause)}</strong>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Career History */}
                <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} />
                    Carriera nel salvataggio
                  </h4>
                  {(() => {
                    const careerEntries = [...(selectedPlayer.clubHistory ?? [])].reverse();
                    const renderEntry = (entry: PlayerClubHistoryEntry, index: number) => (
                      <div key={`${entry.clubId}_${entry.joinedSeason}_${index}`} style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                          <strong style={{ fontSize: '0.78rem' }}>{entry.clubName}</strong>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{entry.joinedSeason} — {entry.leftSeason ?? 'Oggi'}</span>
                        </div>
                        {entry.transferType !== 'initial' && (
                          <span style={{ display: 'block', marginTop: '3px', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                            {CAREER_TRANSFER_TYPE_LABELS[entry.transferType]}{entry.fee !== undefined ? `: ${formatCurrency(entry.fee)}` : ''}
                          </span>
                        )}
                      </div>
                    );

                    if (careerEntries.length <= 1) {
                      return <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Al club dall'inizio della carriera.</p>;
                    }
                    if (careerEntries.length > 4) {
                      return (
                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{careerEntries.length} squadre nel salvataggio</summary>
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {careerEntries.map(renderEntry)}
                          </div>
                        </details>
                      );
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {careerEntries.map(renderEntry)}
                      </div>
                    );
                  })()}
                </div>

                <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Dumbbell size={14} />
                    Piano di allenamento
                  </h4>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    Qui imposti solo l'obiettivo di lavoro: i miglioramenti arrivano lentamente con partite e continuita', non al click.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Focus</label>
                      <select value={individualFocus} onChange={e => setIndividualFocus(e.target.value as TrainingFocus)} style={selectStyle}>
                        {(['balanced', 'technical', 'physical', 'defensive', 'attacking', 'mental', 'role_learning', 'recovery'] as TrainingFocus[]).map(focus => (
                          <option key={focus} value={focus}>{TRAINING_FOCUS_LABELS[focus]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Intensita'</label>
                      <select value={individualIntensity} onChange={e => setIndividualIntensity(e.target.value as TrainingIntensity)} style={selectStyle}>
                        {(['light', 'normal', 'high'] as TrainingIntensity[]).map(intensity => (
                          <option key={intensity} value={intensity}>{TRAINING_INTENSITY_LABELS[intensity]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {individualFocus === 'role_learning' && (
                    <div>
                      <label style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Ruolo obiettivo</label>
                      <select value={positionTarget} onChange={e => setPositionTarget(e.target.value as PlayerRole)} style={selectStyle}>
                        {(['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST'] as PlayerRole[]).filter(role => role !== selectedPlayer.role).map(role => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button className="btn-primary" onClick={() => applyIndividualPlan(selectedPlayer)} style={{ justifyContent: 'center' }}>
                    Salva piano
                  </button>
                  {selectedPlayer.trainingPlan && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px', borderTop: '1px solid var(--border-light)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        Stato: <strong>{TRAINING_PLAN_STATUS_LABELS[selectedPlayer.trainingPlan.status]}</strong> · Adesione al piano: <strong style={{ color: 'var(--color-lime)' }}>{selectedPlayer.trainingPlan.progress}%</strong> · Sviluppo reale: <strong style={{ color: 'var(--color-pitch)' }}>{selectedPlayer.trainingPlan.developmentProgress}%</strong>
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        L'adesione riflette solo la costanza; lo sviluppo reale richiede settimane di continuità.
                      </span>
                      {selectedPlayer.trainingPlan.notes[0] && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{selectedPlayer.trainingPlan.notes[0]}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(() => {
                    const development = getDevelopmentSummary(selectedPlayer);
                    return (
                      <>
                        <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TrendingUp size={14} />
                          Sviluppo
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          {infoTileLike('Fase carriera', development.stageLabel)}
                          {infoTileLike('Trend', development.trendLabel, development.trendLabel === 'In crescita' ? 'var(--color-pitch)' : development.trendLabel === 'In calo' ? 'var(--color-danger)' : 'var(--text-primary)')}
                          {infoTileLike('Potenziale stimato', `${development.potentialLevel} (${development.potentialRangeLabel})`)}
                          {infoTileLike('Sviluppo stagionale', `+${development.seasonGrowth} / -${development.seasonDecline}`)}
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>{development.explanation}</p>
                      </>
                    );
                  })()}
                </div>

                {selectedPlayer.trainingPlan?.focus === 'role_learning' && selectedPlayer.trainingPlan.targetRole && (
                  <div className="card-premium" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(() => {
                      const target = selectedPlayer.trainingPlan!.targetRole!;
                      const entry = getRoleFamiliarityEntry(selectedPlayer, target);
                      return (
                        <>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Apprendimento ruolo: {target}</h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {infoTileLike('Familiarita\'', `${Math.round(entry.familiarity)}/100`)}
                            {infoTileLike('Stato', ROLE_FAMILIARITY_STATUS_LABELS[entry.status])}
                            {infoTileLike('Minuti nel ruolo', `${entry.matchMinutesInRole}'`)}
                            {infoTileLike('Progresso ruolo', `${Math.round(entry.trainingProgress)}%`)}
                          </div>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                            {entry.status === 'natural' || entry.status === 'competent' ? 'Sta diventando utilizzabile.' :
                              entry.status === 'usable' ? 'Serve ancora esperienza in campo.' :
                              'Conversione complessa: progresso lento.'}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                )}

              </div>

              {/* Drawer Actions CTA */}
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                <button
                  onClick={() => {
                    toggleStarter(selectedPlayer);
                    // Refresh locally
                    setSelectedPlayer(null);
                  }}
                  className="btn-primary"
                  style={{ justifyContent: 'center' }}
                >
                  <ShieldCheck size={16} fill="#042F1A" />
                  {starters.includes(selectedPlayer.id) ? 'Metti in Panchina' : 'Imposta Titolare'}
                </button>

                <button
                  onClick={() => setRenewingPlayer(selectedPlayer)}
                  className="btn-secondary"
                  style={{ justifyContent: 'center' }}
                >
                  <Calendar size={16} />
                  Rinnova contratto
                </button>

                <button
                  onClick={() => {
                    const nextStatus = selectedPlayer.status === 'Cedibile' ? 'Disponibile' : 'Cedibile';
                    updatePlayer({ ...selectedPlayer, status: nextStatus, morale: nextStatus === 'Cedibile' ? Math.max(selectedPlayer.morale - 10, 20) : selectedPlayer.morale });
                    setSelectedPlayer(null);
                  }}
                  className="btn-danger"
                  style={{ justifyContent: 'center' }}
                >
                  <UserMinus size={16} />
                  {selectedPlayer.status === 'Cedibile' ? 'Togli dalla Lista Trasferimenti' : 'Metti in Lista Trasferimenti'}
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </ModalPortal>
      {renewingPlayer && (
        <ContractRenewalModal
          player={renewingPlayer}
          club={clubProfile}
          wageBudget={careerWorld.clubWageBudgetState}
          transferBudget={budget}
          season={careerWorld.clubWageBudgetState.season}
          highestSquadAnnualSalary={Math.max(0, ...players.map(p => p.contract?.annualSalary ?? toAnnualSalary(p.wage)))}
          starters={starters}
          bench={bench}
          currentRound={currentRound}
          onClose={() => setRenewingPlayer(null)}
          onConfirm={input => handleConfirmRenewal(renewingPlayer, input)}
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
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-light)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px',
  fontSize: '0.78rem',
  color: 'var(--text-primary)',
  fontWeight: 600
};
